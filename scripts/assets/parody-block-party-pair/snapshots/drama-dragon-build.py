"""WO028 original procedural toy construction and articulated export.

Execute only while holding the exclusive authoring lease. Blender +Z up/+Y
forward exports to glTF +Y up/-Z forward. Named source parts stay in the master;
runtime joins them into one skin and a small set of opaque textured primitives.
"""
import argparse, bpy, bmesh, hashlib, json, math, sys
from pathlib import Path
from mathutils import Vector, Matrix, Euler

BASE=Path('/workspace/haynes-quest/parody/block-party-pair/v001')
FPS=40
PARTS=[]; BONES={}; LIMBS={}; MATS=[]; XFORM=Matrix.Identity(4)
NAME=None; ROOT=None; SPEC=None; ARM=None; REST={}; DESIRED={}

def clear():
    if bpy.context.object and bpy.context.object.mode!='OBJECT':bpy.ops.object.mode_set(mode='OBJECT')
    for ob in list(bpy.data.objects):bpy.data.objects.remove(ob,do_unlink=True)
    for blocks in [bpy.data.meshes,bpy.data.armatures,bpy.data.materials,bpy.data.actions,bpy.data.collections]:
        for block in list(blocks):blocks.remove(block)
    bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=1

def materials():
    im=bpy.data.images.load(str(ROOT/'pigment.png'),check_existing=False);im.name=NAME+' original pigment atlas';im.pack()
    settings=([('Banana skin',.68,0),('Navy woven cloth',.90,0),('Warm brass',.4,.65),('Boot leather and dark eyes',.34,0)]
              if NAME=='peel-patrol' else [('Soft voxel scale and cardboard',.80,0),('Wing and ruff fabric',.92,0),('Purple eye glow',.33,0)])
    for i,(name,rough,metal) in enumerate(settings):
        mat=bpy.data.materials.new(name);mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF')
        bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal;bs.inputs['Specular IOR Level'].default_value=.25
        tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im;tex.interpolation='Linear';tex.extension='EXTEND'
        mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
        if NAME=='drama-dragon' and i==2:
            mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Emission Color']);bs.inputs['Emission Strength'].default_value=.75
        MATS.append(mat)

def uv_project(ob,tile):
    for layer in list(ob.data.uv_layers):ob.data.uv_layers.remove(layer)
    uv=ob.data.uv_layers.new(name='Original atlas UV');uv.active_render=True
    ps=[v.co for v in ob.data.vertices];lo=[min(p[k] for p in ps) for k in range(3)]
    spans=[max(.00001,max(p[k] for p in ps)-lo[k]) for k in range(3)]
    for p in ob.data.polygons:
        dominant=max(range(3),key=lambda k:abs(p.normal[k]));axes=[a for a in range(3) if a!=dominant]
        for li in p.loop_indices:
            v=ob.data.vertices[ob.data.loops[li].vertex_index].co
            u=(v[axes[0]]-lo[axes[0]])/spans[axes[0]];vv=(v[axes[1]]-lo[axes[1]])/spans[axes[1]]
            uv.data[li].uv=((tile%4+.035+.93*u)/4,(3-tile//4+.035+.93*vv)/4)

def finish(ob,name,tile,bone,mat=0,smooth=False):
    ob.name=name
    for p in ob.data.polygons:p.use_smooth=smooth
    uv_project(ob,tile)
    for v in ob.data.vertices:v.co=XFORM@v.co
    ob.data.materials.append(MATS[mat]);ob.vertex_groups.new(name=bone).add(list(range(len(ob.data.vertices))),1,'REPLACE')
    ob['source_part']=name;ob['rigid_weight']=bone;ob['atlas_tile']=tile
    PARTS.append(ob);ob.select_set(False);return ob

def mesh(name,vertices,faces,tile,bone='body',mat=0,smooth=False):
    data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update()
    bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(data);bm.free()
    ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob)
    return finish(ob,name,tile,bone,mat,smooth)

def box(name,c,size,tile=0,bone='body',bevel=.006,mat=0,rot=(0,0,0),segments=2):
    bpy.ops.mesh.primitive_cube_add(size=1);ob=bpy.context.object;ob.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=ob.modifiers.new('Soft deliberate edges','BEVEL');mod.width=bevel;mod.segments=segments
        bpy.ops.object.modifier_apply(modifier=mod.name)
    transform=Matrix.Translation(c)@Euler(rot).to_matrix().to_4x4();finish(ob,name,tile,bone,mat,True)
    for v in ob.data.vertices:v.co=XFORM@transform@XFORM.inverted()@v.co
    if bevel:
        mod=ob.modifiers.new('Weighted planar normals','WEIGHTED_NORMAL');mod.keep_sharp=True
        bpy.context.view_layer.objects.active=ob;bpy.ops.object.modifier_apply(modifier=mod.name)
    return ob

def ellipsoid(name,c,size,tile=0,bone='body',mat=0,segments=20,rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1)
    ob=bpy.context.object
    for v in ob.data.vertices:v.co=Vector(c)+Vector((v.co.x*size[0],v.co.y*size[1],v.co.z*size[2]))
    return finish(ob,name,tile,bone,mat,True)

def rings(name,rr,tile,bone='body',mat=0,smooth=True,caps=True):
    n=len(rr[0]);vertices=[p for r in rr for p in r];faces=[]
    for j in range(len(rr)-1):
        for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    if caps:faces.extend([tuple(range(n-1,-1,-1)),tuple((len(rr)-1)*n+i for i in range(n))])
    return mesh(name,vertices,faces,tile,bone,mat,smooth)

def tube(name,points,radii,tile,bone='body',mat=0,n=12):
    pts=list(map(Vector,points));rr=[]
    for j,(p,r) in enumerate(zip(pts,radii)):
        tangent=pts[min(j+1,len(pts)-1)]-pts[max(j-1,0)];tangent.normalize()
        u=tangent.cross(Vector((0,1,0)))
        if u.length<.01:u=tangent.cross(Vector((1,0,0)))
        u.normalize();v=tangent.cross(u).normalized()
        rr.append([p+r*(u*math.cos(math.tau*i/n)+v*math.sin(math.tau*i/n)) for i in range(n)])
    return rings(name,rr,tile,bone,mat)

def between(name,a,b,width,depth,tile,bone='body',bevel=.006,mat=0):
    a,b=Vector(a),Vector(b);vec=b-a
    rot=vec.to_track_quat('Z','Y').to_euler()
    return box(name,(a+b)/2,(width,depth,vec.length+.009),tile,bone,bevel,mat,rot)

def ribbon(name,points,widths,tile,bone='body',thickness=.006,mat=0):
    """Solid curved strip. Cross-strip axis is X; side seams and caps are real."""
    pts=list(map(Vector,points));rr=[]
    for j,(p,w) in enumerate(zip(pts,widths)):
        tangent=(pts[min(j+1,len(pts)-1)]-pts[max(j-1,0)]).normalized()
        u=Vector((1,0,0));normal=tangent.cross(u).normalized()
        rr.append([p+u*w/2+normal*thickness/2,p-u*w/2+normal*thickness/2,p-u*w/2-normal*thickness/2,p+u*w/2-normal*thickness/2])
    return rings(name,rr,tile,bone,mat,smooth=True)

def extrude_xz(name,poly,y,depth,tile,bone='body',mat=0):
    n=len(poly);vertices=[(x,yy,z) for yy in [y-depth/2,y+depth/2] for x,z in poly]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,vertices,faces,tile,bone,mat)

def bone(name,p,parent='root'):
    BONES[name]=(Vector(p),parent)

def weights(ob,fn):
    for group in list(ob.vertex_groups):ob.vertex_groups.remove(group)
    groups={}
    for vertex in ob.data.vertices:
        for n,w in fn(vertex.co).items():
            if w<=0:continue
            if n not in groups:groups[n]=ob.vertex_groups.new(name=n)
            groups[n].add([vertex.index],w,'REPLACE')
    ob['rigid_weight']='blended attachment'

def wrap(name,z0,z1,rx,ry,tile,bone='body',mat=1,gap=None):
    """Closed fabric/belt circuit, optionally leaving one deliberate front gap."""
    rr=[];count=32
    if gap is None:angles=[math.tau*i/count for i in range(count+1)]
    else:angles=[gap+(math.tau-2*gap)*i/count for i in range(count+1)]
    # angle 0 faces +Y.
    v=[]
    for radiusoff,z in [(0,z0),(0,z1),(-.006,z0),(-.006,z1)]:
        v.extend(((rx+radiusoff)*math.sin(a),(ry+radiusoff)*math.cos(a),z) for a in angles)
    n=len(angles);faces=[]
    for i in range(n-1):
        j=i+1;faces.extend([(i,j,n+j,n+i),(2*n+i,3*n+i,3*n+j,2*n+j),(n+i,n+j,3*n+j,3*n+i),(i,2*n+i,2*n+j,j)])
    faces.extend([(0,n,3*n,2*n),(n-1,3*n-1,4*n-1,2*n-1)])
    return mesh(name,v,faces,tile,bone,mat,True)

def banana_badge(name,c,size,bone='body'):
    x,y,z=c
    p=[(-.45,.42),(-.35,.48),(-.30,.10),(-.08,-.16),(.25,-.26),(.46,-.12),(.34,-.40),(.04,-.49),(-.27,-.37),(-.46,-.07)]
    extrude_xz(name,[(x+a*size,z+b*size) for a,b in p],y,.009,9,bone,2)

def peel_patrol():
    global XFORM
    bone('body',(0,0,.33));bone('head',(0,0,.68),'body');bone('whistle',(0,.168,.45),'body')
    profile=[(.265,.018,0,0),(.285,.070,0,-.005),(.34,.108,0,-.003),(.43,.130,0,0),(.54,.143,0,0),(.65,.143,-.003,-.006),(.76,.125,-.012,-.022),(.87,.103,-.021,-.035),(.97,.071,-.029,-.040),(1.055,.044,-.026,-.014),(1.096,.026,-.021,.006)]
    rr=[]
    for z,r,cx,cy in profile:
        rr.append([(cx+r*math.cos(math.tau*i/28)*(1+.035*math.cos(math.tau*i/7)),cy+r*.78*math.sin(math.tau*i/28),z) for i in range(28)])
    ob=rings('Banana | continuous tall curved yellow skin',rr,0)
    weights(ob,lambda v:{'body':1-max(0,min(1,(v.z-.60)/.16)),'head':max(0,min(1,(v.z-.60)/.16))})
    # A quiet longitudinal highlight is a shallow, attached skin ridge.
    for s in [-1,1]:
        tube('Banana | attached side ridge '+str(s),[(s*.10,.065,.40),(s*.123,.069,.60),(s*.10-.01,.047,.77),(s*.063-.026,.02,.95)],[.005,.005,.004,.003],1,'body',n=8)
        ridge=PARTS[-1];weights(ridge,lambda v:{'body':1-max(0,min(1,(v.z-.60)/.16)),'head':max(0,min(1,(v.z-.60)/.16))})
    box('Banana | brown blunt stem',(-.018,.010,1.126),(.063,.051,.071),3,'head',.008,rot=(.06,-.17,0))
    for s,label in [(1,'L'),(-1,'R')]:
        # Broad peel flaps emerge continuously from the top banana skin.
        pts=[(-.023+s*.029,.0,1.065),(-.023+s*.070,-.012,1.105),(-.023+s*.108,-.006,1.08),(-.023+s*.130,.0,1.010),(-.023+s*.164,.006,.985)]
        flap=ribbon('Banana | attached upper peel flap '+label,pts,[.035,.048,.046,.037,.020],1,'head',.009)
        # Face is mounted to the banana's upper front skin, not a separate head.
        ellipsoid('Face | dark oval eye '+label,(-.015+s*.051,.076,.824),(.034,.019,.055),8,'head',3,20,12)
        bone('brow_'+label,(-.015+s*.050,.036,.902),'head')
        box('Face | stern brow '+label,(-.015+s*.050,.041,.902),(.062,.019,.014),3,'brow_'+label,.004,0,rot=(0,s*.27,0))
    # One short vest with a continuous back and obvious front opening.
    wrap('Vest | continuous navy back and side panels',.405,.581,.153,.127,4,mat=1,gap=.30)
    for s,label in [(1,'L'),(-1,'R')]:
        lapel=extrude_xz('Vest | lapel '+label,[(s*.042,.581),(s*.135,.584),(s*.112,.526)],.131,.007,5,'body',1)
        for v in lapel.data.vertices:v.co.y+=.127*math.sqrt(max(0,1-(v.co.x/.153)**2))+.002-.131
        box('Vest | small pocket '+label,(s*.103,.102,.451),(.050,.025,.048),5,bevel=.006,mat=1)
        tube('Vest | pocket top seam '+label,[(s*.082,.118,.476),(s*.125,.112,.476)],[.0018,.0018],6,mat=1,n=6)
    for side in [-1,1]:box('Vest | concealed shoulder fastening '+str(side),(side*.144,0,.548),(.030,.045,.056),4,bevel=.002,mat=1)
    banana_badge('Badge | single brass banana insignia',(.101,.105,.527),.065)
    wrap('Belt | continuous dark belt',.343,.383,.118,.096,8,mat=3)
    box('Belt | brass buckle',(0,.103,.363),(.067,.021,.049),7,bevel=.006,mat=2)
    box('Belt | inset leather buckle',(0,.116,.363),(.045,.006,.031),10,bevel=.004,mat=3)
    # Navy cap intersects the upper skin on its underside; no floating hat.
    XFORM=Matrix.Translation((-.025,.010,1.044))@Euler((-.10,-.16,-.12)).to_matrix().to_4x4()
    rings('Cap | softly tailored navy crown',[[(.092*scale*math.cos(math.tau*i/24),.080*scale*math.sin(math.tau*i/24),z) for i in range(24)] for z,scale in [(-.015,.85),(0,1),(.033,.92),(.061,.62),(.069,.2)]],4,'head',1)
    rings('Cap | fitted lower band',[[(.081*math.cos(math.tau*i/24),.071*math.sin(math.tau*i/24),z) for i in range(24)] for z in [-.022,0]],6,'head',1)
    ellipsoid('Cap | short forward visor',(0,.082,-.012),(.104,.075,.011),6,'head',1,24,8)
    ellipsoid('Cap | brass side button',(.085,.022,.013),(.009,.009,.009),7,'head',2,12,8)
    XFORM=Matrix.Identity(4)
    # Whistle shell/mouthpiece are one prop. The black inset is not another item.
    tube('Whistle | single brass barrel',[(-.024,.174,.455),(.024,.174,.455)],[.023,.023],7,'whistle',2,16)
    box('Whistle | attached mouthpiece',(0,.178,.427),(.025,.032,.046),7,'whistle',.005,2)
    box('Whistle | dark windway',(0,.197,.428),(.013,.004,.020),8,'whistle',.002,3)
    for s,label in [(1,'L'),(-1,'R')]:
        cord=tube('Whistle cord | secured '+label,[(s*.087,.108,.571),(s*.075,.145,.526),(s*.037,.163,.477),(0,.168,.477)],[.0035]*4,8,'body',3,n=8)
        weights(cord,lambda v:{'body':max(0,min(1,(v.z-.482)/.086)),'whistle':1-max(0,min(1,(v.z-.482)/.086))})
    # Exactly two attached arms, each with a mitten palm and four fingers.
    for s,label in [(1,'L'),(-1,'R')]:
        sh=Vector((s*.143,.002,.558));el=Vector((s*.222,.011,.450));wr=Vector((s*.184,.047,.364))
        bone('upper_arm_'+label,sh,'body');bone('forearm_'+label,el,'upper_arm_'+label);bone('hand_'+label,wr,'forearm_'+label)
        LIMBS['arm_'+label]=(sh,el,wr,'upper_arm_'+label,'forearm_'+label,'hand_'+label)
        tube('Arm | upper '+label,[sh,sh.lerp(el,.42),el],[.025,.024,.022],0,'upper_arm_'+label,n=12)
        ellipsoid('Arm | elbow '+label,el,(.023,.022,.024),0,'forearm_'+label,segments=12,rings=8)
        tube('Arm | forearm '+label,[el,el.lerp(wr,.63),wr],[.022,.019,.018],0,'forearm_'+label,n=12)
        ellipsoid('Hand | mitten palm '+label,wr+Vector((0,.008,-.013)),(.029,.025,.034),0,'hand_'+label,segments=16,rings=10)
        for j in range(3):
            ellipsoid('Hand | '+label+' finger '+str(j+1),wr+Vector(((j-1)*.014,.019,-.034)),(.009,.012,.019),0,'hand_'+label,segments=10,rings=8)
        ellipsoid('Hand | '+label+' thumb',wr+Vector((-s*.027,.026,-.005)),(.013,.015,.020),0,'hand_'+label,segments=10,rings=8)
        hip=Vector((s*.063,0,.302));knee=Vector((s*.077,.017,.205));ankle=Vector((s*.084,.003,.101))
        bone('thigh_'+label,hip,'body');bone('shin_'+label,knee,'thigh_'+label);bone('foot_'+label,ankle,'shin_'+label)
        LIMBS['leg_'+label]=(hip,knee,ankle,'thigh_'+label,'shin_'+label,'foot_'+label)
        tube('Leg | upper '+label,[hip,knee],[.023,.021],0,'thigh_'+label,n=12)
        ellipsoid('Leg | knee '+label,knee,(.022,.022,.023),0,'shin_'+label,segments=12,rings=8)
        tube('Leg | shin '+label,[knee,ankle],[.020,.018],0,'shin_'+label,n=12)
        box('Boot | sole '+label,(s*.084,.037,.014),(.112,.171,.028),10,'foot_'+label,.009,3)
        ellipsoid('Boot | round toe '+label,(s*.084,.064,.044),(.055,.072,.037),8,'foot_'+label,3,20,10)
        box('Boot | ankle leather '+label,(s*.084,.0,.079),(.080,.094,.100),8,'foot_'+label,.016,3,segments=3)
        box('Boot | rolled cuff '+label,(s*.084,.0,.12),(.086,.098,.018),12,'foot_'+label,.007,3)
        for j in range(3):tube('Boot | brass lace '+label+str(j),[(s*.084-.022,.055+j*.012,.085-j*.015),(s*.084+.022,.055+j*.012,.085-j*.015)],[.0028,.0028],9,'foot_'+label,2,n=6)
    # Character-left is +X; one peel hangs from that belt side to the ground.
    bone('peel_upper',(.129,-.017,.364),'body');bone('peel_lower',(.153,-.023,.192),'peel_upper');bone('peel_tip',(.157,-.060,.060),'peel_lower')
    for a,b in [((.130,-.016,.358),(.130,-.016,.389)),((.113,-.025,.373),(.142,-.025,.373))]:tube('Peel attachment | brass secured loop '+str(a),[a,b],[.005,.005],7,mat=2,n=8)
    peel=ribbon('Peel | single attached left belt trailing strip',[(.13,-.017,.368),(.151,-.026,.316),(.140,-.046,.250),(.153,-.023,.192),(.156,-.06,.108),(.161,-.09,.040),(.177,-.143,.013),(.178,-.196,.016),(.176,-.213,.032)],[.043,.049,.048,.041,.040,.035,.041,.033,.015],1,'peel_upper',.007)
    def pw(v):
        if v.z>.21:w=max(0,min(1,(v.z-.21)/.08));return {'peel_upper':w,'peel_lower':1-w}
        w=max(0,min(1,(v.z-.075)/.075));return {'peel_lower':w,'peel_tip':1-w}
    weights(peel,pw)

def drama_dragon():
    bone('body',(0,-.12,.65));bone('neck',(0,.24,.88),'body');bone('head',(0,.41,1.18),'neck');bone('jaw',(0,.80,1.28),'head')
    box('Torso | angular black voxel chest',(0,-.09,.73),(.59,.88,.56),0,bevel=.023)
    box('Torso | softer belly plate',(0,.24,.62),(.45,.035,.38),3,bevel=.012)
    for j in range(4):box('Torso | stepped belly tile '+str(j),(0,.265,.465+j*.10),(.40,.018,.086),1,bevel=.003)
    neckpts=[(0,.21,.86),(0,.32,1.02),(0,.41,1.18),(0,.49,1.32)]
    for j in range(3):between('Neck | connected voxel segment '+str(j),neckpts[j],neckpts[j+1],.27-j*.025,.25-j*.015,[1,0,1][j],'neck' if j<2 else 'head',.009)
    box('Head | oversized square black head',(0,.72,1.435),(.52,.48,.41),0,'head',.017)
    box('Head | long rectangular muzzle',(0,1.005,1.335),(.46,.35,.22),1,'head',.012)
    box('Jaw | attached blunt lower jaw',(0,.970,1.235),(.425,.33,.083),2,'jaw',.007)
    for s,label in [(1,'L'),(-1,'R')]:
        box('Face | purple rectangular eye '+label,(s*.150,.968,1.469),(.130,.019,.100),10,'head',.002,2)
        box('Face | purple inner eye glow '+label,(s*.133,.982,1.462),(.056,.009,.063),11,'head',.001,2)
        bone('brow_'+label,(s*.145,.952,1.557),'head')
        box('Face | expressive block brow '+label,(s*.145,.972,1.557),(.184,.050,.048),2,'brow_'+label,.004,rot=(0,s*.18,0))
        box('Face | square nostril '+label,(s*.145,1.184,1.388),(.044,.010,.032),12,'head',.001)
        for j in range(2):box('Jaw | blunt square tooth '+label+str(j),(s*(.11+j*.066),1.118,1.273),(.039,.052,.042),13,'jaw',.003)
        # Grey horns use two joined blunt blocks, visibly sunk into the head.
        between('Horn | attached lower '+label,(s*.180,.605,1.603),(s*.210,.590,1.714),.075,.079,4,'head',.004)
        between('Horn | blunt upper '+label,(s*.208,.590,1.697),(s*.225,.572,1.773),.066,.069,5,'head',.004)
    # Tiny cardboard crown: three front points, continuous low rear band.
    wrap('Crown | connected cardboard lower band',1.633,1.692,.102,.086,8,'head',mat=0)
    crown=PARTS[-1]
    for v in crown.data.vertices:v.co.y+=.717
    extrude_xz('Crown | exactly three cardboard points',[(-.106,1.677),(-.107,1.811),(-.065,1.811),(-.050,1.715),(-.022,1.719),(-.021,1.841),(.021,1.841),(.029,1.714),(.056,1.718),(.070,1.804),(.109,1.800),(.103,1.674)],.774,.019,8,'head')
    for x,z in [(-.083,1.772),(0,1.800),(.088,1.764)]:box('Crown | embossed cardboard score '+str(x),(x,.787,z),(.012,.005,.026),9,'head',.001)
    # Ruff sits at neck base: closed collar under twelve connected thick pleats.
    wrap('Ruff | continuous plum inner collar',.884,.963,.139,.129,6,'neck',mat=1)
    inner=PARTS[-1]
    for v in inner.data.vertices:v.co.y+=.25
    for j in range(12):
        a=math.tau*j/12;cx=.205*math.sin(a);cy=.25+.197*math.cos(a)
        box('Ruff | broad cloth pleat %02d'%j,(cx,cy,.915),(.107,.154,.117),7 if j%3==0 else 6,'neck',.007,1,rot=(.15*math.cos(a),-.15*math.sin(a),-a))
    box('Ruff | secure back brass clasp',(0,-.020,.935),(.065,.034,.072),8,'neck',.004)
    box('Ruff | back clasp inset',(0,-.040,.935),(.036,.012,.041),14,'neck',.002,1)
    # Raise the complete collar above the chest so its rear fastening is visible.
    for ob in PARTS:
        if ob.name.startswith('Ruff |'):
            for v in ob.data.vertices:v.co+=Vector((0,.11,.16))
    # Four limbs remain separated in the rest geometry and bind to distinct bones.
    for where,hip_y,knee_y,ankle_y in [('front',.23,.39,.42),('rear',-.42,-.52,-.48)]:
        for s,label in [(1,'L'),(-1,'R')]:
            key=where+'_'+label
            hip=Vector((s*.237,hip_y,.736 if where=='front' else .686))
            knee=Vector((s*.322,knee_y,.385));ankle=Vector((s*.315,ankle_y,.117))
            bone('thigh_'+key,hip,'body');bone('shin_'+key,knee,'thigh_'+key);bone('foot_'+key,ankle,'shin_'+key)
            LIMBS['leg_'+key]=(hip,knee,ankle,'thigh_'+key,'shin_'+key,'foot_'+key)
            between('Leg | '+key+' thigh block',hip,knee,.188,.213,0,'thigh_'+key,.012)
            box('Leg | '+key+' square knee',knee,(.192,.196,.154),1,'shin_'+key,.010)
            between('Leg | '+key+' shin block',knee,ankle,.155,.167,0,'shin_'+key,.009)
            box('Foot | '+key+' broad dark foot',(s*.315,ankle_y+.037,.085),(.255,.320,.170),2,'foot_'+key,.010)
            for j in range(3):box('Foot | '+key+' blunt grey toe '+str(j),(s*.315+(j-1)*.076,ankle_y+.198,.061),(.067,.078,.122),4,'foot_'+key,.005)
    # Two large angular wings, closed thick membranes and continuous grey struts.
    for s,label in [(1,'L'),(-1,'R')]:
        shoulder=Vector((s*.235,-.08,1.00));bone('wing_'+label,shoulder,'body')
        outline=[(s*.235,-.08,1.00),(s*.695,-.125,1.485),(s*1.335,-.36,1.244),(s*1.410,-.48,.805),(s*1.085,-.34,.945),(s*.930,-.30,.595),(s*.652,-.17,.782),(s*.395,-.10,.625)]
        count=len(outline);vertices=[(x,y+d,z) for d in [-.010,.010] for x,y,z in outline]
        faces=[tuple(range(count-1,-1,-1)),tuple(range(count,count*2))]+[(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
        mesh('Wing | '+label+' angular opaque membrane',vertices,faces,2,'wing_'+label,1)
        elbow=Vector(outline[1]);tip=Vector(outline[2])
        for j,(a,b,w) in enumerate([(shoulder,elbow,.087),(elbow,tip,.067),(elbow,Vector(outline[4]),.040),(elbow,Vector(outline[5]),.043),(elbow,Vector(outline[7]),.043)]):
            between('Wing | '+label+' attached grey strut '+str(j),a,b,w,.047,4 if j<2 else 5,'wing_'+label,.005)
        box('Wing | '+label+' block elbow joint',elbow,(.118,.087,.120),4,'wing_'+label,.006)
    # One chain of eight tail segments; every dorsal tile rides its segment.
    tail=[(0,-.49,.685),(0,-.73,.610),(0,-.96,.545),(0,-1.18,.493),(0,-1.385,.470),(0,-1.58,.486),(0,-1.752,.548),(0,-1.892,.644),(0,-2.012,.750)]
    for j in range(8):
        bn='tail_%02d'%j;bone(bn,tail[j],'body' if j==0 else 'tail_%02d'%(j-1))
        w=.244-j*.024
        between('Tail | single chain segment %02d'%j,tail[j],tail[j+1],w,w*.84,[0,1,0,2][j%4],bn,.006)
        center=(Vector(tail[j])+Vector(tail[j+1]))/2
        box('Tail | attached grey dorsal tile %02d'%j,center+Vector((0,0,w*.5+.032)),(w*.43,.087,.071),5,bn,.004)
    for j in range(4):box('Back | attached grey dorsal tile '+str(j),(0,.10-j*.19,1.038),(.10,.095,.082),5,bevel=.005)

def setup_rig():
    ps=[v.co for ob in PARTS for v in ob.data.vertices]
    low=min(p.z for p in ps);high=max(p.z for p in ps)
    scale=Vector((1,1,SPEC['height_m']/(high-low)))
    if NAME=='drama-dragon':
        scale.x=SPEC['rest_wingspan_m']/(max(p.x for p in ps)-min(p.x for p in ps))
        scale.y=SPEC['rest_nose_to_tail_m']/(max(p.y for p in ps)-min(p.y for p in ps))
    def transform(p):return Vector((p.x*scale.x,p.y*scale.y,(p.z-low)*scale.z))
    for ob in PARTS:
        for v in ob.data.vertices:v.co=transform(v.co)
    for n,(p,parent) in list(BONES.items()):BONES[n]=(transform(p),parent)
    for key,entry in list(LIMBS.items()):LIMBS[key]=(*[transform(p) for p in entry[:3]],*entry[3:])
    inventory=[];source=bpy.data.collections.new('Editable named parts | excluded from export');bpy.context.scene.collection.children.link(source)
    copies=[]
    for ob in PARTS:
        ob.data.calc_loop_triangles();points=[v.co for v in ob.data.vertices]
        inventory.append({'name':ob.name,'weighting':ob['rigid_weight'],'atlas_tile':ob['atlas_tile'],'vertices':len(ob.data.vertices),'triangles':len(ob.data.loop_triangles),
                          'bounds':{'min':[min(p[k] for p in points) for k in range(3)],'max':[max(p[k] for p in points) for k in range(3)]}})
        cp=ob.copy();cp.data=ob.data.copy();bpy.context.collection.objects.link(cp);copies.append(cp)
        for c in list(ob.users_collection):c.objects.unlink(ob)
        source.objects.link(ob)
    source.hide_render=True;source.hide_viewport=True
    bpy.ops.object.select_all(action='DESELECT')
    for ob in copies:ob.select_set(True)
    bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();skin=bpy.context.object;skin.name=NAME+'_skin'
    skin['named_construction_parts']=[p['name'] for p in inventory]
    data=bpy.data.armatures.new(NAME+' articulated skeleton');arm=bpy.data.objects.new(NAME+'_rig',data);bpy.context.collection.objects.link(arm)
    skin.select_set(False);arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
    root=data.edit_bones.new('root');root.head=(0,0,0);root.tail=(0,0,.08);root.use_deform=False
    for n,(p,parent) in BONES.items():
        b=data.edit_bones.new(n);b.head=p;b.tail=p+Vector((0,0,.065));b.parent=data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    mod=skin.modifiers.new('Deliberate rigid and joint blend weights','ARMATURE');mod.object=arm
    skin.parent=arm;skin.matrix_parent_inverse=arm.matrix_world.inverted()
    arm['asset_id']=NAME;arm['version']='v001';arm['candidate_approval']='pending';arm['forward']='glTF -Z';arm['attack_contact_time_s']=SPEC['attack_contact_s'];arm['attack_contact_fraction']=SPEC['attack_contact_fraction']
    return arm,skin,inventory,scale

def smooth(x):x=max(0,min(1,x));return x*x*(3-2*x)
def bell(t,c,w):return smooth(1-abs(t-c)/w)
def motion(n):return DESIRED[n]@REST[n].inverted()
def point_on(n,p):return motion(n)@Vector(p)
def fk(n,rot=(0,0,0),loc=(0,0,0)):
    parent=BONES[n][1];inherit=motion(parent)
    DESIRED[n]=inherit@Matrix.Translation(BONES[n][0]+Vector(loc))@Euler(rot).to_matrix().to_4x4()@REST[n].to_3x3().to_4x4()

def segment(n,start,end,reststart,restend):
    rotation=(restend-reststart).normalized().rotation_difference((end-start).normalized())
    DESIRED[n]=Matrix.Translation(start)@rotation.to_matrix().to_4x4()@REST[n].to_3x3().to_4x4()

def ik(key,start,end,bend=(0,1,0),endrot=(0,0,0)):
    a,b,c,upper,lower,foot=LIMBS[key];start,end=Vector(start),Vector(end)
    l1=(b-a).length;l2=(c-b).length;delta=end-start;length=delta.length;direction=delta.normalized()
    distance=max(abs(l1-l2)+.00001,min(length,l1+l2-.00001));end=start+direction*distance
    along=(l1*l1-l2*l2+distance*distance)/(2*distance)
    bv=Vector(bend);bv=(bv-direction*bv.dot(direction)).normalized()
    middle=start+direction*along+bv*math.sqrt(max(0,l1*l1-along*along))
    segment(upper,start,middle,a,b);segment(lower,middle,end,b,c)
    DESIRED[foot]=Matrix.Translation(end)@Euler(endrot).to_matrix().to_4x4()@REST[foot].to_3x3().to_4x4()

def apply_pose():
    for pb in ARM.pose.bones:
        desired=DESIRED.get(pb.name,REST[pb.name]);parent=pb.parent
        base=(DESIRED.get(parent.name,REST[parent.name])@REST[parent.name].inverted()@REST[pb.name]) if parent else REST[pb.name]
        pb.matrix_basis=base.inverted()@desired;pb.rotation_mode='QUATERNION'

def animate_peel(clip,t):
    wave=math.sin(math.tau*t);liftL=liftR=0;footshiftL=footshiftR=0
    lean=roll=turn=drop=slide=0;wind=slip=settle=0
    if clip=='idle':roll=.010*wave;turn=.028*wave
    elif clip=='move':
        roll=.034*wave;turn=.022*wave;liftL=.055*max(0,wave);liftR=.055*max(0,-wave)
        footshiftL=.035*wave;footshiftR=-.035*wave
    elif clip=='attack':
        wind=smooth(t/.36)*(1-smooth((t-.48)/.14));slip=bell(t,.625,.23)
        lean=-.13*wind+.28*slip;roll=-.14*slip;slide=.018*slip
        footshiftL=.085*slip;footshiftR=-.060*slip;liftR=.010*slip;drop=.025*slip
    elif clip=='hit':
        q=bell(t,.20,.28);lean=-.17*q;roll=.10*math.sin(math.tau*t*2)*(1-t)
    elif clip=='defeat':
        settle=smooth((t-.18)/.63);roll=.13*math.sin(math.tau*t*2)*(1-settle);lean=-.12*settle;drop=.256*settle
        footshiftL=footshiftR=.165*settle
    fk('body',rot=(lean,roll,0),loc=(0,slide,-drop));fk('head',rot=(-lean*.50,turn,.01*wave if clip=='idle' else 0))
    for s,label,ft,lift in [(1,'L',footshiftL,liftL),(-1,'R',footshiftR,liftR)]:
        a,b,c,*_=LIMBS['leg_'+label];end=c+Vector((s*.033*settle,ft,lift))
        ik('leg_'+label,point_on('body',a),end,bend=(s*.35,1,2*settle))
    whistle_lift=Vector((-.018,.037,.255))*wind
    fk('whistle',rot=(-.50*wind,0,0),loc=whistle_lift)
    for s,label in [(1,'L'),(-1,'R')]:
        a,b,c,*_=LIMBS['arm_'+label];wrist=point_on('body',c)
        if clip=='move':wrist+=Vector((0,-s*.054*wave,.038*abs(wave)))
        if clip=='attack':
            if label=='L':wrist=wrist.lerp(point_on('body',a)+Vector((.19,.10,.075)),wind*.85)
            else:wrist=wrist.lerp(point_on('whistle',BONES['whistle'][0])+Vector((-.017,0,-.004)),wind)
            wrist+=Vector((s*.10*slip,0,.10*slip))
        if clip=='hit':wrist+=Vector((s*.04*bell(t,.2,.3),0,.035*bell(t,.2,.3)))
        if clip=='defeat':wrist=wrist.lerp(Vector((s*.24,-.05,.05)),settle)
        ik('arm_'+label,point_on('body',a),wrist,bend=(s,0,-.2),endrot=(0,0,-s*.10*slip))
        fk('brow_'+label,rot=(0,s*(.12*wind-.12*settle),0))
    fk('peel_upper',rot=(.045*wave if clip=='move' else -lean-.20*slip-1.22*settle,-roll,0))
    fk('peel_lower',rot=(-.03*wave if clip=='move' else -.40*slip-.35*settle,0,0))
    # Keep the trailing tip clear of the ground when the body lowers to sit.
    fk('peel_tip',rot=(0,0,0),loc=(0,0,.013*slip+.16*abs(roll)*(1-settle)))

def animate_dragon(clip,t):
    wave=math.sin(math.tau*t);wind=stomp=settle=0;lift=0;drop=0;lean=0;roll=0
    if clip=='idle':lean=.013*wave
    elif clip=='move':lean=.018*math.sin(math.tau*t*2);roll=.018*wave
    elif clip=='attack':
        wind=smooth(t/.42)*(1-smooth((t-.52)/.105));stomp=bell(t,.625,.14)
        lift=.12*wind;drop=.045*stomp;lean=-.10*wind+.12*stomp
    elif clip=='hit':lean=-.14*bell(t,.24,.32);roll=.06*bell(t,.28,.35)
    elif clip=='defeat':settle=smooth((t-.18)/.60);drop=.40*settle;lean=.07*settle
    fk('body',rot=(lean,roll,0),loc=(0,0,lift-drop))
    fk('neck',rot=(-.025*wave if clip=='idle' else .08*wind-.14*stomp-.12*settle,0,0))
    fk('head',rot=(.018*wave if clip=='idle' else .11*wind-.09*stomp-.22*settle,.04*wave if clip in ['idle','hit'] else 0,0))
    fk('jaw',rot=(-.07*wind-.045*settle,0,0))
    for s,label in [(1,'L'),(-1,'R')]:
        fold=.34+(.035*wave if clip=='idle' else 0)
        fk('wing_'+label,rot=(0,-s*(.51*wind-.12*settle),-s*(fold-.26*wind+.15*settle)))
        fk('brow_'+label,rot=(0,s*(.16*stomp-.18*settle),0))
    for i in range(8):fk('tail_%02d'%i,rot=(.012*wave if clip=='idle' else -.065*settle,0,.032*math.sin(math.tau*t-i*.45) if clip in ['idle','move'] else .025*stomp))
    for where in ['front','rear']:
        for s,label in [(1,'L'),(-1,'R')]:
            key='leg_'+where+'_'+label;a,b,c,*_=LIMBS[key]
            phase=math.tau*t+(0 if (where=='front')==(label=='L') else math.pi)
            footlift=.065*max(0,math.sin(phase)) if clip=='move' else (.085*wind if where=='front' else .025*wind)
            forward=.065*math.sin(phase) if clip=='move' else (.08*settle if where=='front' else -.03*settle)
            end=c+Vector((s*.08*settle,forward,footlift))
            ik(key,point_on('body',a),end,bend=(s*.3,1 if where=='front' else -1,0))

def animations(arm):
    global ARM,REST,DESIRED
    ARM=arm;REST={b.name:b.matrix_local.copy() for b in arm.data.bones}
    sc=bpy.context.scene;sc.render.fps=FPS;arm.animation_data_create();records=[]
    for name,duration in SPEC['clips'].items():
        end=round(duration*FPS);action=bpy.data.actions.new(name);arm.animation_data.action=action
        for frame in range(end+1):
            sc.frame_set(frame);DESIRED={'root':REST['root'].copy()}
            (animate_peel if NAME=='peel-patrol' else animate_dragon)(name,frame/end)
            apply_pose()
            for pb in arm.pose.bones:
                for field in ['location','rotation_quaternion','scale']:pb.keyframe_insert(data_path=field,frame=frame,group=pb.name)
        track=arm.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,0,action)
        strip.action_frame_start=0;strip.action_frame_end=end;track.mute=True
        records.append({'name':name,'duration_s':end/FPS,'loop':name in ['idle','move'],'clamp_when_finished':name not in ['idle','move'],
                        'contact_time_s':SPEC['attack_contact_s'] if name=='attack' else None,'contact_fraction':SPEC['attack_contact_fraction'] if name=='attack' else None})
    arm.animation_data.action=None;arm.animation_data.use_nla=True
    for p in arm.pose.bones:p.matrix_basis=Matrix.Identity(4)
    sc.frame_set(0);bpy.context.view_layer.update();return records

def main(name,base=BASE):
    global NAME,ROOT,SPEC
    NAME=name;ROOT=Path(base)/name;ROOT.mkdir(parents=True,exist_ok=True)
    contract=json.loads((Path(base)/'contract.json').read_text());SPEC=contract['assets'][name]
    clear();materials();(peel_patrol if name=='peel-patrol' else drama_dragon)()
    arm,skin,inventory,scale=setup_rig();clips=animations(arm)
    text=bpy.data.texts.new('WO028 original build.py');text.write(Path(__file__).read_text())
    bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
    master=ROOT/(name+'.blend');bpy.ops.wm.save_as_mainfile(filepath=str(master));glb=ROOT/(name+'.glb')
    # Runtime mesh is a scene root: glTF skinning ignores parent-node transforms.
    skin.parent=None;skin.matrix_world=Matrix.Identity(4)
    bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_yup=True,
        export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_def_bones=False,export_all_influences=False,
        export_influence_nb=4,export_apply=False,export_texcoords=True,export_normals=True,export_tangents=False,export_materials='EXPORT',
        export_vertex_color='NONE',export_image_format='JPEG',export_jpeg_quality=93,export_all_vertex_colors=False,
        export_cameras=False,export_lights=False,export_extras=True,export_force_sampling=True,export_frame_range=False,
        export_frame_step=1,export_optimize_animation_size=True,export_current_frame=False,export_rest_position_armature=True,
        export_anim_slide_to_zero=True,export_draco_mesh_compression_enable=False)
    skin.parent=arm;skin.matrix_parent_inverse=arm.matrix_world.inverted()
    skin.data.calc_loop_triangles();points=[v.co for v in skin.data.vertices]
    record={'asset_id':name,'version':'v001','work_order':'WO-028','authoring_model':'gpt-6-astra','reasoning_effort':'max','blender':bpy.app.version_string,
        'private_inputs':False,'downloaded_meshes_or_textures':False,'triangles':len(skin.data.loop_triangles),'vertices':len(skin.data.vertices),
        'material_count':len(skin.data.materials),'joints':['root',*BONES],'spec':{'height':SPEC['height_m'],'floor':0,'forward':'glTF -Z','up':'glTF +Y',**SPEC},
        'clips':clips,'source_scale_xyz':list(scale),'animation_fps':FPS,
        'bounds_blender':{'min':[min(p[k] for p in points) for k in range(3)],'max':[max(p[k] for p in points) for k in range(3)]},
        'rig_limb_contract':{k:{'rest_points':[list(p) for p in v[:3]],'joints':list(v[3:])} for k,v in LIMBS.items()},'named_source_parts':inventory,'runtime_construction':'Editable named sources retained; single skin, opaque original-atlas materials, rigid parts plus smooth banana/cord/peel attachment weights.',
        'files':{p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [master,glb,ROOT/'pigment.png']}}
    (ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n')
    print(json.dumps({k:v for k,v in record.items() if k!='named_source_parts'}))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--name',choices=['peel-patrol','drama-dragon'],required=True);parser.add_argument('--base',default=str(BASE))
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []);main(args.name,args.base)
