"""WO027 Mister Hiss v001 — original Creeper/confetti parody construction.

Run via the exclusive live Blender lease after transferring pigment.png.
Blender +Z up, +Y forward; glTF +Y up and -Z forward. No factory reset.
The editable source preserves every named part. Runtime joins those parts into
one skinned node / three opaque material primitives with a 1024px atlas.
"""
import bpy, bmesh, math, json, hashlib, random
from pathlib import Path
from mathutils import Vector, Matrix, Euler

ROOT=Path('/workspace/haynes-quest/parody/mister-hiss/v001')
PARTS=[]; BONES={}; MATS=[]; XFORM=Matrix.Identity(4)
FPS=24
CLIPS=[('idle',60,True),('move',24,True),('attack',36,False),('hit',12,False),('defeat',48,False)]
RANDOM=random.Random(27001)

def clear_owned_scene():
    if bpy.context.object and bpy.context.object.mode!='OBJECT':bpy.ops.object.mode_set(mode='OBJECT')
    for ob in list(bpy.data.objects):bpy.data.objects.remove(ob,do_unlink=True)
    for blocks in (bpy.data.meshes,bpy.data.armatures,bpy.data.materials,bpy.data.actions,bpy.data.collections):
        for block in list(blocks):blocks.remove(block)
    bpy.context.scene.unit_settings.system='METRIC'
    bpy.context.scene.unit_settings.scale_length=1

def materials():
    image=bpy.data.images.load(str(ROOT/'pigment.png'),check_existing=False)
    image.name='Mister Hiss | original 1024 paper atlas';image.pack()
    for name,rough,metal in [('Paper and printed pigment',.86,0),('Eye glaze',.34,0),('Small brass clasp',.42,.65)]:
        mat=bpy.data.materials.new(name);mat.use_nodes=True
        bs=mat.node_tree.nodes.get('Principled BSDF')
        bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
        bs.inputs['Specular IOR Level'].default_value=.27
        tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;tex.interpolation='Linear';tex.extension='EXTEND'
        mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
        MATS.append(mat)

def uv_project(ob,tile):
    # Primitive cubes arrive with UVMap; keep one explicitly active atlas layer.
    for layer in list(ob.data.uv_layers):ob.data.uv_layers.remove(layer)
    uv=ob.data.uv_layers.new(name='Paper atlas UV')
    uv.active_render=True
    points=[v.co for v in ob.data.vertices]
    lo=[min(p[k] for p in points) for k in range(3)]
    span=[max(.0001,max(p[k] for p in points)-lo[k]) for k in range(3)]
    for p in ob.data.polygons:
        k=max(range(3),key=lambda k:abs(p.normal[k]));axes=[a for a in range(3) if a!=k]
        for li in p.loop_indices:
            v=ob.data.vertices[ob.data.loops[li].vertex_index].co
            u=(v[axes[0]]-lo[axes[0]])/span[axes[0]];vv=(v[axes[1]]-lo[axes[1]])/span[axes[1]]
            # PNG top row tile zero becomes V .75..1 in Blender.
            uv.data[li].uv=((tile%4+.028+.944*u)/4,(3-tile//4+.028+.944*vv)/4)

def finish(ob,name,tile,bone,mat=0,smooth=False):
    ob.name=name
    for p in ob.data.polygons:p.use_smooth=smooth
    uv_project(ob,tile)
    for v in ob.data.vertices:v.co=XFORM@v.co
    ob.data.materials.append(MATS[mat])
    ob.vertex_groups.new(name=bone).add(list(range(len(ob.data.vertices))),1,'REPLACE')
    ob['source_part']=name;ob['rigid_weight']=bone;ob['atlas_tile']=tile
    PARTS.append(ob);ob.select_set(False)
    return ob

def mesh(name,verts,faces,tile,bone='body',mat=0,smooth=False):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(data);bm.free()
    ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob)
    return finish(ob,name,tile,bone,mat,smooth)

def box(name,c,s,tile=0,bone='body',bevel=.006,segments=2,mat=0,rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1)
    ob=bpy.context.object;ob.scale=s
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=ob.modifiers.new('Soft paper toy edges','BEVEL');mod.width=bevel;mod.segments=segments
        bpy.ops.object.modifier_apply(modifier=mod.name)
        for p in ob.data.polygons:p.use_smooth=True
    transform=Matrix.Translation(c)@Euler(rot).to_matrix().to_4x4()
    # Project before rotation so grain follows each constructed piece.
    finish(ob,name,tile,bone,mat,True)
    for v in ob.data.vertices:v.co=XFORM@transform@XFORM.inverted()@v.co
    if bevel:
        mod=ob.modifiers.new('Weighted cuboid face normals','WEIGHTED_NORMAL');mod.keep_sharp=True
        bpy.context.view_layer.objects.active=ob;bpy.ops.object.modifier_apply(modifier=mod.name)
    return ob

def prism(name,poly,depth,tile,bone='head',mat=0):
    # Front-facing X/Z polygon, centered on local Y=0, closed opaque volume.
    n=len(poly);v=[(x,y,z) for y in (-depth/2,depth/2) for x,z in poly]
    f=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]
    f.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    return mesh(name,v,f,tile,bone,mat)

def rings(name,rr,tile,bone='body',mat=0,smooth=True,caps=True):
    n=len(rr[0]);v=[p for ring in rr for p in ring];f=[]
    for j in range(len(rr)-1):
        for i in range(n):f.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    if caps:f.extend([tuple(range(n-1,-1,-1)),tuple((len(rr)-1)*n+i for i in range(n))])
    return mesh(name,v,f,tile,bone,mat,smooth)

def lathe(name,c,profile,tile,bone='body',mat=0,n=20):
    return rings(name,[[(c[0]+r*math.cos(math.tau*i/n),c[1]+r*math.sin(math.tau*i/n),c[2]+z) for i in range(n)] for z,r in profile],tile,bone,mat)

def disc(name,c,r,depth,tile,bone='head',mat=1,n=24):
    return rings(name,[[(c[0]+r*scale*math.cos(math.tau*i/n),y,c[2]+r*scale*math.sin(math.tau*i/n)) for i in range(n)] for y,scale in [(c[1]-depth/2,.88),(c[1],1),(c[1]+depth/2,.90)]],tile,bone,mat)

def patch(name,center,width,height,normal,bone,tile):
    """One attached thick fringe tab: flush top, shallow lifted lower edge."""
    n=Vector(normal);u=Vector((n.y,-n.x,0));up=Vector((0,0,1));c=Vector(center)
    # Two tiny notches give paper edges without fragile strips.
    outline=[(-.50,.5),(.5,.5),(.5,-.46),(.16,-.50),(.11,-.40),(.01,-.50),(-.24,-.46),(-.50,-.48)]
    front=[]
    for a,b in outline:
        lift=.0017+.0035*(.5-b)
        front.append(c+u*(width*a)+up*(height*b)+n*lift)
    back=[p-n*.0028 for p in front];v=back+front;count=len(front)
    faces=[tuple(range(count-1,-1,-1)),tuple(range(count,count*2))]
    faces.extend((i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count))
    return mesh(name,v,faces,tile,bone)

def fringe_cube(name,c,s,bone,cols=6,rows=5,mask_face=False):
    for face,n in [('front',(0,1,0)),('back',(0,-1,0)),('right',(1,0,0)),('left',(-1,0,0))]:
        horiz=s[0] if n[1] else s[1];count=cols if n[1] else max(3,round(cols*s[1]/s[0]))
        step=horiz/count;zstep=s[2]/rows
        for row in range(rows):
            for col in range(count):
                horizontal=-horiz/2+step*(col+.5)
                z=c[2]+s[2]/2-zstep*(row+.5)
                # Preserve the iconic black frown and expressive eyes at front.
                if mask_face and face=='front' and -.174<horizontal<.174 and .574<z<.827:continue
                center=Vector(c)+Vector(n)*(s[1]/2 if n[1] else s[0]/2)
                center+=Vector((n[1],-n[0],0))*horizontal;center.z=z
                tile=RANDOM.choices([1,2,3,4],[.35,.22,.30,.13])[0]
                patch(name+' | '+face+' tab r%02dc%02d'%(row,col),center,step*.97,zstep*(1.1+RANDOM.random()*.15),n,bone,tile)

def bone(name,p,parent='root'):
    BONES[name]=(Vector(p),parent)

def character():
    global XFORM, MUZZLE
    bone('body',(0,0,.14));bone('head',(0,0,.55),'body')
    box('Torso | tall narrow armless paper core',(0,0,.346),(.245,.218,.416),0,'body',.010)
    fringe_cube('Torso | layered paper',(0,0,.348),(.248,.222,.406),'body',4,6)
    # Four feet, each a solid cuboid, all the way to an exact shared floor.
    for x,labelx in [(-.116,'L'),(.116,'R')]:
        for y,labely in [(.109,'front'),(-.109,'rear')]:
            bn='foot_'+labely+'_'+labelx;bone(bn,(x,y,.073))
            box('Foot | '+labely+' '+labelx+' dark sole',(x,y,.026),(.166,.176,.052),5,bn,.006)
            box('Foot | '+labely+' '+labelx+' green cuboid',(x,y,.091),(.166,.176,.116),0,bn,.007)
            fringe_cube('Foot | '+labely+' '+labelx,(x,y,.105),(.167,.177,.083),bn,3,2)
    box('Head | broad cuboid core',(0,0,.725),(.448,.360,.360),0,'head',.012,3)
    fringe_cube('Head | layered paper',(0,0,.727),(.450,.362,.351),'head',7,5,True)
    # A few laid-flat overlapping crown strips establish the paper construction.
    for i in range(7):
        box('Head | crown paper strip %02d'%i,(-.192+i*.064,-.005,.906),(.061,.342,.004),[1,3,2,1,4,2,1][i],'head',.001,1)
    # The frown retains the characteristic stepped pixel silhouette.
    XFORM=Matrix.Translation((0,.188,0))
    prism('Face | unmistakable black pixel frown',[(-.047,.733),(.047,.733),(.047,.683),(.105,.683),(.105,.584),(.053,.584),(.053,.628),(-.053,.628),(-.053,.584),(-.105,.584),(-.105,.683),(-.047,.683)],.010,9)
    XFORM=Matrix.Identity(4)
    for side,x in [('L',-.101),('R',.101)]:
        box('Face | '+side+' cream pixel eye',(x,.188,.781),(.107,.015,.082),10,'head',.007,2,1)
        # Pupils turn slightly inward, producing the comic nervous cross-eye.
        ex=x+(.019 if x<0 else -.019)
        disc('Face | '+side+' amber iris',(ex,.201,.779),.031,.009,11)
        disc('Face | '+side+' black pupil',(ex,.207,.781),.020,.007,9)
        disc('Face | '+side+' catchlight',(ex-.007,.212,.792),.0062,.003,10,n=12)
        bn='brow_'+side;bone(bn,(x,.187,.831),'head')
        box('Face | '+side+' lopsided black eyebrow',(x,.201,.833),(.119,.021,.032),9,bn,.003,1,rot=(0,-.18 if side=='L' else .24,0))
    # One continuous rectangular belt circuit; slope is identical at shared edges.
    corners=[(-.139,.132),(.139,.132),(.139,-.132),(-.139,-.132)]
    verts=[]
    for inward in (0,.007):
        for upper in (-.039,.039):
            for x,y in corners:
                xx=x-math.copysign(inward,x);yy=y-math.copysign(inward,y)
                verts.append((xx,yy,.300-.26*xx+upper))
    faces=[]
    for i in range(4):
        j=(i+1)%4
        faces.extend([(i,j,4+j,4+i),(8+i,12+i,12+j,8+j),(4+i,4+j,12+j,12+i),(i,8+i,8+j,j)])
    mesh('Sash | continuous diagonal plum wrap front sides back',verts,faces,6)
    # Two hidden glued tabs bridge the small paper-layer clearance. Each tab
    # intersects both the solid torso and sash wall, fixing the loop physically.
    for sx in [-1,1]:
        x=sx*.128
        box('Sash | concealed glued fastening tab '+('L' if sx<0 else 'R'),
            (x,0,.300-.26*x),(.018,.090,.050),6,bevel=.0015,segments=1)
    # Cylinder axis rises toward viewer-right (negative Blender X in front view).
    XFORM=Matrix.Translation((-.055,.197,.320))@Euler((-.14,-.53,0)).to_matrix().to_4x4()
    lathe('Popper | strapped printed plum canister',(0,0,0),[(-.148,.049),(-.139,.059),(.136,.059),(.148,.051)],7,n=24)
    lathe('Popper | lower plum folded rim',(0,0,0),[(-.153,.050),(-.148,.065),(-.136,.066),(-.130,.055)],6,n=24)
    lathe('Popper | tiny brass mouth rim',(0,0,0),[(.136,.055),(.142,.066),(.151,.066),(.157,.053)],8,mat=2,n=24)
    lathe('Popper | recessed dark open mouth',(0,0,0),[(.147,.050),(.150,.050)],9,n=24)
    # Retaining strap wraps the canister itself and joins the continuous sash.
    lathe('Popper | secure plum retaining band',(0,0,0),[(-.035,.060),(.016,.060)],6,n=24)
    box('Popper | brass clasp plate',(0,.064,-.008),(.073,.016,.065),8,bevel=.009,segments=2,mat=2)
    box('Popper | clasp inset',(0,.075,-.008),(.050,.005,.044),6,bevel=.007,segments=1)
    # Simple black smile stamp built from two eyes and a solid U shape.
    for sx in [-.010,.010]:box('Popper | clasp smile eye '+str(sx),(sx,.080,.003),(.006,.004,.008),9,bevel=.001,segments=1)
    prism('Popper | clasp smile',[(-.017,-.008),(-.010,-.008),(-.008,-.017),(.008,-.017),(.010,-.008),(.017,-.008),(.013,-.023),(-.013,-.023)],.003,9,'body')
    # Position smile onto clasp's forward surface.
    smile=PARTS[-1]
    for v in smile.data.vertices:v.co+=XFORM.to_3x3()@Vector((0,.080,0))
    MUZZLE=XFORM@Vector((0,0,.155))
    XFORM=Matrix.Identity(4)
    # Crooked tiny party hat on the opposite top corner from the canister.
    hatbase=Vector((.119,-.002,.908));bone('hat',hatbase,'head')
    XFORM=Matrix.Translation(hatbase)@Euler((.04,.23,-.03)).to_matrix().to_4x4()
    lathe('Hat | plum cone with original party print',(0,0,0),[(0,.061),(.008,.061),(.119,.006)],7,'hat',n=16)
    lathe('Hat | rolled plum brim',(0,0,0),[(-.002,.059),(.002,.066),(.011,.063),(.014,.058)],6,'hat',n=20)
    # Paper pompom is eight chunky creased petals, not detached hair strands.
    for i in range(8):
        a=math.tau*i/8
        box('Hat | paper pompom fold %02d'%i,(math.cos(a)*.008,math.sin(a)*.008,.124),(.032,.008,.015),12,'hat',.002,1,rot=(0,.4,a))
    XFORM=Matrix.Identity(4)
    for i in range(6):
        bn='confetti_%d'%i;bone(bn,MUZZLE,'body')
        # Rest is inside the open canister; animation scales from tiny to full.
        c=MUZZLE-Vector((0,0,.009))
        patch('Confetti | folded paper bit %d'%i,c,.032,.024,(0,1,0),bn,[12,13,14,15,13,12][i])

def rig():
    """Keep source pieces editable, and build only one runtime skin."""
    coords=[v.co for ob in PARTS for v in ob.data.vertices]
    low=min(p.z for p in coords);top=max(p.z for p in coords);factor=1/(top-low)
    for ob in PARTS:
        for v in ob.data.vertices:v.co=(v.co.x*factor,v.co.y*factor,(v.co.z-low)*factor)
    inventory=[]
    sources=bpy.data.collections.new('Editable named construction | excluded from export')
    bpy.context.scene.collection.children.link(sources)
    copies=[]
    for ob in PARTS:
        ob.data.calc_loop_triangles()
        inventory.append({'name':ob.name,'bone':ob['rigid_weight'],'atlas_tile':ob['atlas_tile'],'vertices':len(ob.data.vertices),'triangles':len(ob.data.loop_triangles)})
        cp=ob.copy();cp.data=ob.data.copy();bpy.context.collection.objects.link(cp);copies.append(cp)
        for c in list(ob.users_collection):c.objects.unlink(ob)
        sources.objects.link(ob)
    sources.hide_render=True;sources.hide_viewport=True
    bpy.ops.object.select_all(action='DESELECT')
    for ob in copies:ob.select_set(True)
    bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();skin=bpy.context.object
    skin.name='mister-hiss_skin';skin['named_construction_parts']=[p['name'] for p in inventory]
    data=bpy.data.armatures.new('Mister Hiss articulated toy skeleton')
    arm=bpy.data.objects.new('mister-hiss_rig',data);bpy.context.collection.objects.link(arm)
    skin.select_set(False);arm.select_set(True);bpy.context.view_layer.objects.active=arm
    bpy.ops.object.mode_set(mode='EDIT')
    root=data.edit_bones.new('root');root.head=(0,0,0);root.tail=(0,0,.07);root.use_deform=False
    for name,(p,parent) in BONES.items():
        b=data.edit_bones.new(name);b.head=(p.x*factor,p.y*factor,(p.z-low)*factor);b.tail=b.head+Vector((0,0,.05));b.parent=data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    mod=skin.modifiers.new('Rigid paper construction weights','ARMATURE');mod.object=arm
    arm['asset_id']='mister-hiss';arm['version']='v001';arm['candidate_approval']='pending'
    arm['forward']='Blender +Y; glTF -Z';arm['attack_contact_time_s']=.9;arm['attack_contact_fraction']=.6
    return arm,skin,inventory,factor

def pose(pb,rot=(0,0,0),loc=(0,0,0),scale=(1,1,1)):
    basis=pb.bone.matrix_local.to_3x3()
    pb.rotation_mode='QUATERNION'
    pb.rotation_quaternion=(basis.inverted()@Euler(rot).to_matrix()@basis).to_quaternion()
    pb.location=basis.inverted()@Vector(loc)
    # Bones' local Y axes point up in Blender; author scale in world XYZ.
    pb.scale=(scale[0],scale[2],scale[1])

def smooth(x):x=max(0,min(1,x));return x*x*(3-2*x)
def bell(t,c,w):return smooth(1-abs(t-c)/w)

def animate_pose(arm,clip,t):
    p=arm.pose.bones
    for b in p:pose(b)
    for i in range(6):pose(p['confetti_%d'%i],scale=(.001,.001,.001))
    if clip=='idle':
        wave=math.sin(math.tau*t)
        pose(p['body'],scale=(1+.008*wave,1+.009*wave,1+.005*wave))
        pose(p['head'],rot=(.007*wave,.022*wave,.011*math.sin(math.tau*t*2)))
        pose(p['hat'],rot=(.014*wave,.025*wave,0))
        pose(p['brow_L'],rot=(0,.025*wave,0))
    elif clip=='move':
        wave=math.sin(math.tau*t*2)
        pose(p['body'],rot=(.019*wave,0,.024*math.sin(math.tau*t)),loc=(0,0,.008*(1-math.cos(math.tau*t*2))))
        pose(p['head'],rot=(-.030*wave,.024*math.sin(math.tau*t),0))
        for i,bn in enumerate(['foot_front_L','foot_rear_R','foot_front_R','foot_rear_L']):
            phase=math.tau*t+(math.pi if i>1 else 0);lift=max(0,math.sin(phase))
            pose(p[bn],loc=(0,.017*math.sin(phase),.027*lift))
        pose(p['hat'],rot=(.04*wave,.035*math.sin(math.tau*t),0))
    elif clip=='attack':
        wind=smooth(t/.55)*(1-smooth((t-.57)/.12));sneeze=bell(t,.63,.10);wobble=math.sin((t-.66)*math.tau*5)*smooth((t-.66)/.06)*(1-smooth((t-.84)/.16))
        pose(p['body'],rot=(-.065*wind+.13*sneeze,0,.045*wobble),scale=(1+.055*wind,1+.055*wind,1-.045*wind))
        pose(p['head'],rot=(-.05*wind+.13*sneeze,.075*wobble,0),scale=(1+.035*wind,1+.035*wind,1+.02*wind))
        pose(p['brow_L'],rot=(0,-.32*wind,0),loc=(0,.002,-.011*wind))
        pose(p['brow_R'],rot=(0,.32*wind,0),loc=(0,.002,-.011*wind))
        pose(p['hat'],rot=(-.18*sneeze,.18*wobble,0))
        for i in range(6):
            progress=max(0,(t-.60)/.36);visibility=smooth(progress/.045)*(1-smooth((progress-.78)/.22))
            a=(i/5-.5)*1.8
            loc=(math.sin(a)*.24*progress, .48*progress, .23*math.sin(progress*math.pi)-.06*progress)
            pose(p['confetti_%d'%i],rot=(progress*(i+2),progress*2,progress*(i-2)),loc=loc,scale=(max(.001,visibility),)*3)
    elif clip=='hit':
        q=bell(t,.22,.26);w=math.sin(math.tau*t*2)*(1-t)
        pose(p['body'],rot=(-.11*q,.07*q,.02*w),loc=(0,-.018*q,0))
        pose(p['head'],rot=(-.10*q,-.08*q,0));pose(p['hat'],rot=(.14*w,0,0))
    elif clip=='defeat':
        settle=smooth((t-.25)/.54);w=math.sin(math.tau*t*3)*(1-smooth((t-.25)/.7))
        height=1-.38*settle
        pose(p['body'],rot=(-.10*settle,.03*w,.075*w),loc=(0,-.024*settle,-.023*settle),scale=(1+.04*settle,1+.02*settle,height))
        pose(p['head'],rot=(.025*settle,.05*w,.025*settle),scale=(1,1,1/height))
        pose(p['hat'],rot=(.16*w,.10*settle,0))
        for bn in ['foot_front_L','foot_rear_L','foot_front_R','foot_rear_R']:
            pose(p[bn],loc=((-.020 if bn.endswith('L') else .020)*settle,(.014 if 'front' in bn else -.014)*settle,0))
        pose(p['brow_L'],rot=(0,.2*settle,0));pose(p['brow_R'],rot=(0,-.18*settle,0))

def animations(arm):
    scene=bpy.context.scene;scene.render.fps=FPS;arm.animation_data_create();records=[]
    for name,end,loop in CLIPS:
        act=bpy.data.actions.new(name);arm.animation_data.action=act
        for frame in range(end+1):
            scene.frame_set(frame);animate_pose(arm,name,frame/end)
            for pb in arm.pose.bones:
                for field in ('location','rotation_quaternion','scale'):pb.keyframe_insert(data_path=field,frame=frame,group=pb.name)
        track=arm.animation_data.nla_tracks.new();track.name=name
        strip=track.strips.new(name,0,act);strip.action_frame_start=0;strip.action_frame_end=end;track.mute=True
        records.append({'name':name,'duration_s':end/FPS,'loop':loop,'clamp_when_finished':not loop,'contact_time_s':.9 if name=='attack' else None,'contact_fraction':.6 if name=='attack' else None})
    arm.animation_data.action=None
    for p in arm.pose.bones:pose(p)
    # Small paper pieces sit within the prop at bind/rest and expand only in attack.
    for i in range(6):pose(arm.pose.bones['confetti_%d'%i],scale=(.001,)*3)
    scene.frame_set(0);bpy.context.view_layer.update()
    return records

def main():
    clear_owned_scene();materials();character();arm,skin,inventory,factor=rig();clips=animations(arm)
    text=bpy.data.texts.new('WO027 original build.py');text.write(Path(__file__).read_text())
    bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
    master=ROOT/'mister-hiss.blend';bpy.ops.wm.save_as_mainfile(filepath=str(master))
    glb=ROOT/'mister-hiss.glb'
    bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_yup=True,
        export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_def_bones=False,
        export_all_influences=False,export_influence_nb=4,export_apply=False,export_texcoords=True,
        export_normals=True,export_tangents=False,export_materials='EXPORT',export_vertex_color='NONE',
        export_image_format='JPEG',export_jpeg_quality=93,export_all_vertex_colors=False,
        export_cameras=False,export_lights=False,export_extras=True,export_force_sampling=True,
        export_frame_range=False,export_frame_step=1,export_optimize_animation_size=True,
        export_current_frame=False,export_rest_position_armature=True,export_anim_slide_to_zero=True,
        export_draco_mesh_compression_enable=False)
    skin.data.calc_loop_triangles();points=[v.co for v in skin.data.vertices]
    record={'asset_id':'mister-hiss','version':'v001','work_order':'WO-027','authoring_model':'gpt-6-astra','reasoning_effort':'max','blender':bpy.app.version_string,
        'reference':'Minecraft Creeper confetti parody; exact root concept retained','private_inputs':False,'downloaded_meshes_or_textures':False,
        'triangles':len(skin.data.loop_triangles),'vertices':len(skin.data.vertices),'material_count':len(skin.data.materials),'joints':['root',*BONES],
        'spec':{'height':1.0,'floor':0,'forward':'glTF -Z','up':'glTF +Y','feet':4,'arms':0},'clips':clips,'source_scale_factor':factor,
        'bounds_blender':{'min':[min(p[k] for p in points) for k in range(3)],'max':[max(p[k] for p in points) for k in range(3)]},
        'named_source_parts':inventory,'runtime_construction':'Named editable parts retained in excluded source collection; joined into one runtime skin and three opaque material primitives.',
        'files':{p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [master,glb,ROOT/'pigment.png']}}
    (ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n')
    print(json.dumps({k:v for k,v in record.items() if k!='named_source_parts'}))

if __name__=='__main__':main()
