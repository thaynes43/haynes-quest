"""WO-014 original carved storybook enemies. Astra authored; Blender 4.5.

Run through the exclusive live MCP lease: build('blockling', OUTPUT).
All colors and relief are mesh data; no textures, external meshes, or decoders.
Meters, Blender +Z up/+Y forward; glTF converts to +Y up/-Z forward.
"""
import bpy, bmesh, math, json, os, hashlib, random
from mathutils import Vector, Matrix, Euler, noise

OUTPUT='/workspace/haynes-quest/era-2020/v001'
TAU=math.tau
PARTS=[]
MAT={}
XFORM=Matrix.Identity(4)
BONES={}
PAL={
 'Walnut':('69472f',.79,0),
 'Honey brass':('c79b50',.42,.55),
 'Sage moss':('697647',.94,0),
 'Plum inlay':('694052',.43,.12),
 'Carved recess':('2b1b14',.88,0),
 'Amber light':('ff9e28',.24,.24),
}
SPECS={
 'blockling':{'height':.85,'floor':0,'width':None,'impact':.65},
 'signal-moth':{'height':.90,'floor':.12,'width':1.25,'impact':.70},
 'buffer-baron':{'height':1.85,'floor':.10,'width':None,'impact':1.05},
}

def reset():
 global PARTS,MAT,XFORM,BONES
 if bpy.context.object and bpy.context.object.mode!='OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
 for ob in list(bpy.data.objects): bpy.data.objects.remove(ob,do_unlink=True)
 for sequence in (bpy.data.meshes,bpy.data.armatures,bpy.data.materials,bpy.data.actions,bpy.data.texts):
  for block in list(sequence): sequence.remove(block)
 PARTS=[];MAT={};XFORM=Matrix.Identity(4);BONES={}
 bpy.context.scene.unit_settings.system='METRIC'
 bpy.context.scene.unit_settings.scale_length=1

def srgb(v): return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4

def palette():
 for name,(hexc,rough,metal) in PAL.items():
  mat=bpy.data.materials.new(name);mat.use_nodes=True
  bs=mat.node_tree.nodes.get('Principled BSDF')
  base=tuple(srgb(int(hexc[i:i+2],16)/255) for i in (0,2,4))
  bs.inputs['Base Color'].default_value=(1,1,1,1)
  bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
  bs.inputs['Specular IOR Level'].default_value=.32
  v=mat.node_tree.nodes.new('ShaderNodeVertexColor');v.layer_name='Color'
  mat.node_tree.links.new(v.outputs['Color'],bs.inputs['Base Color'])
  if name=='Amber light':
   # glTF emissiveFactor is uniform; it cannot take a vertex-color connection.
   bs.inputs['Emission Color'].default_value=(*base,1)
   bs.inputs['Emission Strength'].default_value=.055
  mat.diffuse_color=(*base,1);mat['palette_srgb']='#'+hexc
  MAT[name]=(mat,base)

def paint(ob,material,tint=1):
 mat,base=MAT[material];ob.data.materials.append(mat)
 color=ob.data.color_attributes.new(name='Color',type='BYTE_COLOR',domain='CORNER')
 for poly in ob.data.polygons:
  for li in poly.loop_indices:
   p=ob.data.vertices[ob.data.loops[li].vertex_index].co
   broad=.25*noise.noise_vector(p*9.2)[0]+.09*noise.noise_vector(p*55)[1]
   grain=.015*math.sin(p.z*110)
   value=tint*(1+broad+grain)
   if 'Head | tilted pentagonal walnut | carved face' in ob.name:
    local=XFORM.inverted()@p
    for seam in [-.073,.069]:value*=1-.12*math.exp(-((local.x-seam-.002*math.sin(local.z*14))/.010)**2)
   color.data[li].color=(*[max(.001,min(1,c*value)) for c in base],1)
 ob.data.color_attributes.active_color=color

def mesh(name,verts,faces,material,bone='body',tint=1,smooth=True):
 verts=[XFORM@Vector(p) for p in verts]
 data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
 bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(data);bm.free()
 ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob)
 for p in data.polygons:p.use_smooth=smooth
 paint(ob,material,tint)
 ob.vertex_groups.new(name=bone).add(list(range(len(data.vertices))),1,'REPLACE')
 PARTS.append(ob);return ob

def rings(name,rr,mat,bone='body',tint=1,caps=True,smooth=True):
 n=len(rr[0]);v=[p for ring in rr for p in ring];f=[]
 for j in range(len(rr)-1):
  for i in range(n):a=j*n+i;b=j*n+(i+1)%n;f.append((a,b,b+n,a+n))
 if caps is True or caps=='first':f.append(tuple(range(n-1,-1,-1)))
 if caps is True or caps=='last':f.append(tuple((len(rr)-1)*n+i for i in range(n)))
 return mesh(name,v,f,mat,bone,tint,smooth)

def ball(name,c,s,mat,bone='body',tint=1,n=16,k=9,ribs=0):
 rr=[]
 for j in range(k+1):
  a=math.pi*(.006+.988*j/k);ring=[]
  for i in range(n):
   t=TAU*i/n;gr=1+ribs*math.cos(t*8+.35*math.sin(a*4))
   ring.append((c[0]+s[0]*math.sin(a)*math.cos(t)*gr,c[1]+s[1]*math.sin(a)*math.sin(t)*gr,c[2]+s[2]*math.cos(a)))
  rr.append(ring)
 return rings(name,rr,mat,bone,tint)

def tube(name,points,radius,mat,bone='body',tint=1,sides=5,closed=False):
 pts=[Vector(p) for p in points];rr=[]
 for i,p in enumerate(pts):
  d=(pts[(i+1)%len(pts)]-pts[(i-1)%len(pts)]) if closed else (pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)])
  d.normalize();ax=Vector((0,1,0)) if abs(d.y)<.9 else Vector((1,0,0));a=d.cross(ax).normalized();b=d.cross(a).normalized()
  r=radius[i] if isinstance(radius,list) else radius
  rr.append([p+r*(a*math.cos(TAU*j/sides)+b*math.sin(TAU*j/sides)) for j in range(sides)])
 if closed:rr.append(rr[0])
 return rings(name,rr,mat,bone,tint,caps=not closed)

def box(name,c,s,bevel,mat,bone='body',tint=1,rot=(0,0,0)):
 bpy.ops.mesh.primitive_cube_add(size=1,location=c)
 ob=bpy.context.object;ob.name=name;ob.scale=s;ob.rotation_euler=rot
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 m=ob.modifiers.new('Hand softened edges','BEVEL');m.width=bevel;m.segments=3
 bpy.ops.object.modifier_apply(modifier=m.name)
 # Bake requested transform and current sculpting frame before painting/rigging.
 transform=XFORM@ob.matrix_world
 for v in ob.data.vertices:v.co=transform@v.co
 ob.matrix_world=Matrix.Identity(4)
 for p in ob.data.polygons:p.use_smooth=True
 mod=ob.modifiers.new('Weighted flat planes and soft corners','WEIGHTED_NORMAL');mod.keep_sharp=True;mod.weight=50
 bpy.context.view_layer.objects.active=ob;bpy.ops.object.modifier_apply(modifier=mod.name)
 paint(ob,mat,tint);ob.vertex_groups.new(name=bone).add(list(range(len(ob.data.vertices))),1,'REPLACE')
 ob.select_set(False);PARTS.append(ob);return ob

def disc(name,c,r,depth,mat,bone='body',tint=1,n=20):
 rr=[]
 for y,scale in [(c[1]-depth/2,.87),(c[1]-depth*.3,1),(c[1]+depth*.3,1),(c[1]+depth/2,.87)]:
  rr.append([(c[0]+r*scale*math.cos(TAU*i/n),y,c[2]+r*scale*math.sin(TAU*i/n)) for i in range(n)])
 return rings(name,rr,mat,bone,tint)

def ring(name,c,rx,rz,r,mat,bone='body',tint=1,n=24):
 return tube(name,[(c[0]+rx*math.cos(TAU*i/n),c[1],c[2]+rz*math.sin(TAU*i/n)) for i in range(n)],r,mat,bone,tint,5,True)

def leaf(name,start,end,width,mat='Sage moss',bone='body',tint=1,bulge=.009):
 a=Vector(start);b=Vector(end);d=b-a;side=Vector((d.z,0,-d.x)).normalized()
 if side.length<.1:side=Vector((1,0,0))
 v=[];steps=7
 for j in range(steps):
  t=j/(steps-1);mid=a+d*t;mid.y+=bulge*math.sin(math.pi*t)
  w=width*math.sin(math.pi*t)**.8+.0003
  v.extend([mid-side*w,mid+Vector((0,bulge*.45*math.sin(math.pi*t),0)),mid+side*w])
 faces=[]
 for j in range(steps-1):
  for i in range(2):faces.append((j*3+i,j*3+i+1,(j+1)*3+i+1,(j+1)*3+i))
 n=len(v);v.extend([p-Vector((0,.004,0)) for p in v[:]]);faces.extend([tuple(n+i for i in reversed(f)) for f in faces[:]])
 edge=[j*3 for j in range(steps)]+[j*3+2 for j in reversed(range(steps))]
 for i,j in zip(edge,edge[1:]+edge[:1]):faces.append((i,j,j+n,i+n))
 ob=mesh(name,v,faces,mat,bone,tint)
 tube(name+' | midrib',[a+d*t+Vector((0,bulge*1.52*math.sin(math.pi*t)+.001,0)) for t in [j/6 for j in range(7)]],.0018,mat,bone,tint*1.26,4)
 return ob

def grainlines(name,xmin,xmax,y,zmin,zmax,bone,spacing=.035,depth=.0017,tint=.84):
 count=max(2,int((xmax-xmin)/spacing))
 for i in range(count):
  x=xmin+(xmax-xmin)*(i+.3)/count
  points=[]
  for j in range(7):
   z=zmin+(zmax-zmin)*j/6;points.append((x+.0035*math.sin(z*33+i),y+.0008*math.sin(j),z))
  tube(name+' | incised grain '+str(i),points,depth*.58,'Walnut',bone,tint*.60,3)

def endgrain(name,c,rx,rz,bone='body',n=4):
 for k in range(1,n+1):
  q=k/(n+1)
  pts=[(c[0]+rx*q*math.cos(TAU*j/22)*(1+.055*math.sin(j*1.4+k)),c[1],c[2]+rz*q*math.sin(TAU*j/22)) for j in range(22)]
  tube(name+' | growth ring '+str(k),pts,.0013,'Walnut',bone,.78,3,True)

def panel(name,poly,depth,mat,bone='body',tint=1,bevel=.012,relief=.0025,bulge=0,pits=()):
 """Closed chamfered polygon shell with a tessellated, carved front surface."""
 cx=sum(p[0] for p in poly)/len(poly);cz=sum(p[1] for p in poly)/len(poly)
 contour=[]
 for i,p in enumerate(poly):
  prev=Vector(poly[(i-1)%len(poly)]);mid=Vector(p);nxt=Vector(poly[(i+1)%len(poly)])
  a=mid.lerp(prev,.10);b=mid.lerp(nxt,.10)
  for j in range(4):
   t=j/3;contour.append(a*(1-t)**2+mid*2*t*(1-t)+b*t*t)
 rr=[]
 for y,s in [(-depth/2,.86),(-depth/2+bevel*.6,.96),(-depth/2+bevel,1),(depth/2-bevel,1),(depth/2-bevel*.35,.98),(depth/2,.92)]:
  rr.append([(cx+(p.x-cx)*s,y,cz+(p.y-cz)*s) for p in contour])
 rings(name+' | chamfered shell',rr,mat,bone,tint,True,True)
 # A regular clipped grid gives directional wood relief without concentric
 # triangulation ridges. Dense front geometry also carries a broad color wash.
 inner=[(cx+(x-cx)*.918,cz+(z-cz)*.918) for x,z in poly]
 zlo=min(z for x,z in inner);zhi=max(z for x,z in inner)
 nu=25 if bulge else 12;nv=17 if bulge else 10
 verts=[];faces=[]
 for j in range(nv):
  v=.0001+.9998*j/(nv-1);z=zlo+(zhi-zlo)*v;cross=[]
  for i,(x1,z1) in enumerate(inner):
   x2,z2=inner[(i+1)%len(inner)]
   if min(z1,z2)<=z<max(z1,z2) and z2!=z1:cross.append(x1+(x2-x1)*(z-z1)/(z2-z1))
  xmin=min(cross);xmax=max(cross)
  for i in range(nu):
   u=i/(nu-1);x=xmin+(xmax-xmin)*u
   y=depth/2+.0003+bulge*math.sin(math.pi*u)*math.sin(math.pi*v)
   y+=relief*.25*math.sin(x*48+1.2*math.sin(z*8))*math.sin(math.pi*u)
   if name.startswith('Head | tilted'):
    for seam in [-.073,.069]:y-=.0013*math.exp(-((x-seam-.002*math.sin(z*14))/.009)**2)
   for ex,ez,rad in pits:y-=.013*math.exp(-((x-ex)**2+(z-ez)**2)/(rad*rad))
   verts.append((x,y,z))
 for j in range(nv-1):
  for i in range(nu-1):k=j*nu+i;faces.append((k,k+1,k+nu+1,k+nu))
 mesh(name+' | carved face',verts,faces,mat,bone,tint*1.10,True)
 # Broad side panels contain carved undulation and color subdivisions, not
 # texture-only shader detail or an undecorated extrusion wall.
 for ei in []:
  a=Vector(poly[ei]);b=Vector(poly[(ei+1)%len(poly)]);d=b-a
  norm=Vector((-d.y,0,d.x)).normalized()
  verts=[];faces=[];nu=9;nv=5
  for j in range(nv):
   v=j/(nv-1)
   for i in range(nu):
    u=.04+.92*i/(nu-1);p=a.lerp(b,u)
    q=Vector((p.x,-depth/2+bevel+(depth-2*bevel)*v,p.y))
    q+=norm*(.0005+relief*.5*math.sin(i*1.7+j*.7)*math.sin(math.pi*v))
    verts.append(q)
  for j in range(nv-1):
   for i in range(nu-1):k=j*nu+i;faces.append((k,k+1,k+nu+1,k+nu))
  mesh(name+' | side relief '+str(ei),verts,faces,mat,bone,tint*.88,False)

def bone(name,head,parent='body'):
 BONES[name]=(Vector(head),parent)

def blockling():
 global XFORM
 bone('body',(0,0,.31),'root');bone('head',(0,.20,.47))
 # A low barrel of wooden blocks, with a sloping forward neck.
 rr=[]
 for z,rx,ry in [(.165,.095,.12),(.19,.135,.17),(.24,.173,.205),(.32,.18,.225),(.40,.178,.22),(.452,.142,.188)]:
  rr.append([(rx*math.cos(TAU*i/28)*(1+.014*math.sin(i*1.8)),ry*math.sin(TAU*i/28)-.035,z+.003*math.cos(i*.8)) for i in range(28)])
 rings('Trunk | rounded carved barrel',rr,'Walnut',tint=.92)
 box('Chest | short neck block',(0,.16,.38),(.26,.20,.21),.04,'Walnut',tint=.97)
 grainlines('Chest',-.105,.105,.269,.30,.43,'body',.038)
 for s in [-1,1]:
  for isfront,y in [(True,.17),(False,-.18)]:
   tag=('front' if isfront else 'back')+('.L' if s<0 else '.R');joint=(s*.184,y,.29)
   knee=Vector((s*.214,y+(-.045 if isfront else .015),.174));ankle=Vector((s*.205,y+.038,.065))
   bone('leg.'+tag,joint);bone('shin.'+tag,knee,'leg.'+tag);bone('foot.'+tag,ankle,'shin.'+tag)
   # Four independent upper blocks and feet, each with a plum axle.
   for part,a,b,bn in [('upper',Vector(joint),knee,'leg.'+tag),('lower',knee,ankle,'shin.'+tag)]:
    d=b-a;c=(a+b)/2
    box('Leg | '+tag+' '+part,c,(.106,.121,d.length+.045),.029,'Walnut',bn,.94,rot=d.to_track_quat('Z','Y').to_euler())
   box('Foot | '+tag,(s*.204,y+.034,.040),(.125,.152,.08),.023,'Honey brass','foot.'+tag,.88)
   # Axis normal outward, with a darker recessed socket and inset plum pin.
   save=XFORM;XFORM=Matrix.Translation((s*.247,y,.286))@Euler((0,0,-s*math.pi/2)).to_matrix().to_4x4()
   disc('Axle socket | '+tag,(0,0,0),.045,.017,'Honey brass','leg.'+tag,.68,16)
   disc('Plum axle | '+tag,(0,.011,0),.034,.022,'Plum inlay','leg.'+tag,1,16)
   XFORM=save
   # Grain is baked from the pigment field; no dark raised wires on the limbs.
   endgrain('Foot '+tag,(s*.204,y+.112,.041),.05,.026,'foot.'+tag,n=2)
   # Beveled shoulder end grain plaques remain below the enormous head.
   box('Shoulder | '+tag,(s*.20,y,.355),(.145,.17,.15),.032,'Walnut','body',1.02,rot=(0,s*.28,0))
   box('Shoulder cut end | '+tag,(s*.213,y+.088,.369),(.125,.023,.12),.026,'Honey brass','body',.9,rot=(0,s*.28,0))
   endgrain('Shoulder '+tag,(s*.213,y+.099,.368),.048,.046,n=2)
 # Large asymmetric pentagonal head, tilted from the neck at an animal angle.
 XFORM=Matrix.Translation((0,.223,.575))@Euler((-.07,-.20,.025)).to_matrix().to_4x4()
 poly=[(-.232,.074),(-.042,.236),(.216,.113),(.175,-.190),(-.151,-.206)]
 panel('Head | tilted pentagonal walnut',poly,.215,'Walnut','head',1.02,.040,.0004,.042,[(-.105,-.078,.031),(.102,-.024,.031)])
 for x,z in [(-.105,-.078),(.102,-.024)]:
  disc('Eye | deep socket',(x,.134,z),.032,.013,'Carved recess','head',.9,20)
  ring('Eye | brass inset rim',(x,.143,z),.025,.026,.004,'Honey brass','head',.55,20)
  ball('Eye | honey lens',(x,.143,z),(.020,.023,.023),'Amber light','head',.63,20,10)
  ball('Eye | small warm glint',(x-.006,.163,z+.008),(.0035,.002,.0035),'Honey brass','head',1.65,8,4)
 # Long disjoint grooves and a branched split follow the selected head's planks.
 for i in range(0):
  x=-.15+i*.038;zlo=-.163+(abs(x)*.11);zhi=.18-abs(x)*.60
  pts=[]
  for j in range(8):
   z=zlo+(zhi-zlo)*j/7;px=x+.0025*math.sin(j*.8+i)
   yy=.1075+.036*max(0,1-(px/.22)**2-(z/.225)**2)
   pts.append((px,yy,z))
  tube('Head | irregular incised plank '+str(i),pts,.00075,'Walnut','head',.54,3)
 tube('Head | forked edge crack',[(.147,.12,.135),(.13,.126,.095),(.14,.126,.058),(.132,.127,.04)],.0012,'Walnut','head',.45,3)
 tube('Head | fork branch',[(.13,.126,.095),(.112,.13,.102),(.096,.129,.125)],.0008,'Walnut','head',.52,3)
 # Moss gathers along the top and neck; seed-based tufts make a scalloped surface.
 rng=random.Random(14)
 for i in range(20):
  x=rng.uniform(-.015,.11);z=.213-x*.5+rng.uniform(-.006,.012);y=rng.uniform(-.11,.032)
  ball('Crown moss tuft '+str(i),(x,y,z),(.027,.030,.010),'Sage moss','head',rng.uniform(.66,1.15),8,4)
 tube('Crown | sapling stem',[(.02,-.025,.21),(.027,-.018,.256),(.018,-.01,.307)],.004,'Walnut','head',.64,6)
 leaf('Crown | left leaf',(.026,-.015,.253),(-.038,-.006,.286),.023,bone='head')
 leaf('Crown | high leaf',(.021,-.01,.272),(.054,-.013,.337),.023,bone='head',tint=1.06)
 leaf('Crown | right leaf',(.029,-.008,.252),(.102,.005,.272),.020,bone='head',tint=.9)
 XFORM=Matrix.Identity(4)
 ball('Trunk | continuous moss blanket',(0,-.055,.443),(.166,.177,.012),'Sage moss',tint=.77,n=20,k=5)
 for i in range(28):
  x=rng.uniform(-.17,.17);y=rng.uniform(-.23,.15)
  ball('Trunk | moss tuft '+str(i),(x,y,.455),(.023,.024,.011),'Sage moss',tint=rng.uniform(.63,1.15),n=8,k=4)
 tube('Back | seedling stem',[(.076,-.20,.447),(.08,-.20,.49),(.063,-.19,.535)],.0035,'Walnut',tint=.7)
 leaf('Back | seedling leaf A',(.078,-.19,.484),(.143,-.175,.523),.022)
 leaf('Back | seedling leaf B',(.069,-.19,.505),(.035,-.178,.554),.024)

def bezier(a,b,c,d,n=12):
 a,b,c,d=[Vector(p) for p in [a,b,c,d]]
 return [a*(1-t)**3+b*3*t*(1-t)**2+c*3*t*t*(1-t)+d*t**3 for t in [i/n for i in range(n)]]

def wing_patch(name,poly,y,mat,bn,tint=1,bulge=.008,trim=True):
 """A domed inset pane/rim with a real closed edge, no transparent sorting."""
 if mat=='Amber light':
  rounded=[]
  for i,p in enumerate(poly):
   mid=Vector(p);a=mid.lerp(Vector(poly[(i-1)%len(poly)]),.16);b=mid.lerp(Vector(poly[(i+1)%len(poly)]),.16)
   for t in [0,.5,1]:
    q=a*(1-t)**2+mid*2*t*(1-t)+b*t*t;rounded.append((q.x,q.y))
  poly=rounded
 cx=sum(x for x,z in poly)/len(poly);cz=sum(z for x,z in poly)/len(poly)
 rr=[]
 profile=[(.01,bulge),(.45,bulge*.75),(.82,bulge*.32),(1,0),(1,-.007),(.94,-.037 if mat=='Amber light' else -.01)]
 for q,dy in profile:
  rr.append([(cx+(x-cx)*q,y+dy,cz+(z-cz)*q) for x,z in poly])
 rings(name,rr,mat,bn,tint,True,True)
 if trim:tube(name+' | brass bezel',[(x,y+.0008,z) for x,z in poly],.0035,'Honey brass',bn,.84,4,True)

def signal_moth():
 global XFORM
 bone('body',(0,0,.49),'root');bone('head',(0,.015,.635))
 bone('abdomen',(0,-.015,.395))
 ball('Thorax | carved walnut heart',(0,0,.49),(.16,.112,.177),'Walnut',n=32,k=12,ribs=.026)
 # Two gently overlapping petal plates and the sage V echo the reference chest.
 leaf('Chest | right carved petal',(.01,.109,.362),(.086,.101,.635),.065,'Walnut',tint=1.04,bulge=.018)
 leaf('Chest | left carved petal',(-.01,.112,.366),(-.086,.101,.635),.065,'Walnut',tint=1.09,bulge=.018)
 leaf('Chest | sage collar point',(0,.122,.525),(.002,.095,.637),.062,bone='body',bulge=.011)
 ball('Head | rounded owl mask',(0,.014,.654),(.13,.103,.103),'Walnut','head',1.1,n=28,k=10,ribs=.016)
 for s in [-1,1]:
  leaf('Face | carved brow '+str(s),(s*.014,.120,.600),(s*.092,.090,.720),.039,'Walnut','head',1.29,.012)
  disc('Eye | dark socket '+str(s),(s*.073,.108,.670),.047,.018,'Carved recess','head',.8,20)
  ring('Eye | walnut rim '+str(s),(s*.073,.119,.670),.041,.047,.008,'Honey brass','head',.73,24)
  ball('Eye | plum glass '+str(s),(s*.073,.129,.670),(.033,.030,.040),'Plum inlay','head',.85,20,12)
 leaf('Face | sage forehead',(0,.119,.646),(0,.045,.746),.038,bone='head',tint=1.05,bulge=.006)
 # Spiral brass antennae, tapering into curled tips rather than straight rods.
 for s in [-1,1]:
  pts=bezier((s*.045,.015,.724),(s*.050,.016,.852),(s*.111,.010,.970),(s*.180,.02,.884),14)
  for j in range(16):
   a=.52-math.tau*.85*j/15;r=.037*(1-j/21)
   pts.append(Vector((s*(.146+r*math.cos(a)),.02,.865+r*math.sin(a))))
  tube('Antenna | brass scroll '+str(s),pts,[.006*(1-.4*i/(len(pts)-1)) for i in range(len(pts))],'Honey brass','head',.92,7)
 # The tapered abdomen hangs aft, with three brass hoops and a pointed finial.
 rr=[]
 for z,r in [(.195,.003),(.23,.023),(.275,.055),(.32,.073),(.37,.086),(.415,.080)]:
  rr.append([(r*math.cos(TAU*i/24),-.052+r*.72*math.sin(TAU*i/24),z) for i in range(24)])
 rings('Abdomen | fluted tail',rr,'Walnut','abdomen',.88)
 for z,r in [(.235,.026),(.278,.057),(.326,.075),(.381,.085)]:
  tube('Abdomen | brass hoop '+str(z),[(r*math.cos(TAU*i/24),-.052+r*.74*math.sin(TAU*i/24),z) for i in range(24)],.006,'Honey brass','abdomen',.83,5,True)
 # One hinge and an independently articulated bone per actual wing.
 upper=bezier((.14,.545),(.31,.535),(.635,.620),(.648,.925),14)+bezier((.648,.925),(.501,.929),(.270,.767),(.14,.545),14)
 lower=bezier((.147,.517),(.299,.55),(.580,.418),(.611,.274),14)+bezier((.611,.274),(.420,.238),(.244,.31),(.147,.517),14)
 upper_panes=[[(.341,.678),(.46,.810),(.579,.867),(.563,.755),(.503,.670),(.411,.642)],[(.285,.566),(.357,.577),(.391,.631),(.339,.668),(.240,.605)],[(.379,.574),(.481,.612),(.505,.655),(.406,.635)]]
 lower_panes=[[(.228,.486),(.333,.468),(.354,.412),(.298,.331),(.234,.378)],[(.362,.463),(.478,.405),(.552,.310),(.431,.311),(.343,.36)]]
 for s in [-1,1]:
  side='L' if s<0 else 'R'
  for layer,outline,panes in [('upper',upper,upper_panes),('lower',lower,lower_panes)]:
   bn='wing.'+layer+'.'+side;bone(bn,(s*.145,0,.532))
   poly=[(s*p.x,p.y) for p in outline]
   wing_patch('Wing | '+layer+' '+side+' walnut frame',poly,0,'Walnut',bn,.76,.006,False)
   tube('Wing | '+layer+' '+side+' outer brass edge',[(x,.008,z) for x,z in poly],.004,'Honey brass',bn,.80,5,True)
   # Interior pane divisions are individual inset solids, leaving walnut mullions.
   for k,pp in enumerate(panes):
    wing_patch('Wing | '+layer+' '+side+' amber pane '+str(k),[(s*x,z) for x,z in pp],.014,'Amber light',bn,.87+.07*k,.01,True)
   if layer=='upper':
    leaf('Wing | '+side+' sage basal vein',(s*.165,.022,.554),(s*.35,.027,.738),.023,bone=bn,tint=.89,bulge=.006)
   # Raised center vein and short ribs make the leaf construction legible behind.
   tube('Wing | '+layer+' '+side+' rear spine',[(s*.15,-.014,.53),(s*.34,-.016,.66 if layer=='upper' else .42),(s*.55,-.015,.84 if layer=='upper' else .31)],.004,'Honey brass',bn,.72,5)
  save=XFORM;XFORM=Matrix.Translation((s*.164,.022,.538))@Euler((0,0,-s*math.pi/2)).to_matrix().to_4x4()
  disc('Wing | '+side+' bearing',(0,0,0),.049,.045,'Honey brass','body',.84,20)
  disc('Wing | '+side+' plum axle',(0,.025,0),.025,.014,'Plum inlay','body',.76,18)
  XFORM=save
 # Six small hinged legs, readable in the side and rear without becoming arms.
 for s in [-1,1]:
  for j in range(3):
   bn='claw.'+str(j)+('.L' if s<0 else '.R');start=(s*(.105+j*.012),.078-j*.047,.427-j*.012)
   bone(bn,start)
   end=(s*(.12+j*.016),.113-j*.023,.35-j*.005)
   tube('Leg | '+bn,[start,(s*(.144+j*.008),.116-j*.04,.396-j*.01),end],[.009,.009,.004],'Honey brass',bn,.81,7)
   ball('Leg | joint '+bn,start,(.013,.014,.014),'Honey brass',bn,.67,10,5)
 # Back sage plate and carved flow lines remain visible through a full orbit.
 leaf('Back | sage diamond',(0,-.105,.51),(0,-.06,.699),.071,bone='body',tint=.76,bulge=-.012)

def animate_flying(name,arm,clip,t):
 a=TAU*t;s=math.sin(a)
 if name=='signal-moth':
  pose(arm.pose.bones['body'],(.05*s,0,.018*s),(0,0,.017*s))
  pose(arm.pose.bones['head'],(.025*s,0,.02*s))
  flap=.32*math.sin(a*3)
  if clip=='move':
   pose(arm.pose.bones['body'],(-.18+.06*s,0,0),(0,0,.023*math.sin(a*2)));flap=.48*math.sin(a*4)
  elif clip=='attack':
   wind=math.sin(math.pi*min(t/.50,1)) if t<.5 else 0
   strike=math.exp(-((t-.56)/.10)**2)
   pose(arm.pose.bones['body'],(.20*wind-.48*strike,0,0),(0,-.035*wind+.13*strike,.045*wind-.055*strike))
   flap=.58*wind-.7*strike+.09*math.sin(a*3)
  elif clip=='hit':
   r=math.sin(math.pi*t)*(1-t);pose(arm.pose.bones['body'],(.30*r,0,-.38*r),(0,-.07*r,0));flap=.12*math.sin(a*4)
  elif clip=='defeat':
   q=min(t/.80,1);q=q*q*(3-2*q);pose(arm.pose.bones['body'],(.62*q,0,.3*q),(0,0,-.19*q));flap=-1.1*q
   pose(arm.pose.bones['abdomen'],(.25*q,0,0))
  for bn in BONES:
   if bn.startswith('wing.'):
    sign=-1 if bn.endswith('.L') else 1;lag=.82 if 'lower' in bn else 1
    pose(arm.pose.bones[bn],(0,sign*flap*lag,sign*.055*math.sin(a*3)))
   elif bn.startswith('claw.'):
    pose(arm.pose.bones[bn],(.18*s if clip!='defeat' else -.8*t,0,0))
 else:
  animate_baron(arm,clip,t)

def halo_segment(index,angle,bn):
 center=Vector((0,-.025,1.546));r0=.355;r1=.452;span=.74;steps=10
 rr=[]
 for y in [-.045,-.033,.006,.018]:
  inset=.008 if y in [-.045,.018] else 0
  points=[]
  for j in range(steps+1):
   a=angle-span/2+span*j/steps;points.append((center.x+(r1-inset)*math.cos(a),y,center.z+(r1-inset)*math.sin(a)))
  for j in reversed(range(steps+1)):
   a=angle-span/2+span*j/steps;points.append((center.x+(r0+inset)*math.cos(a),y,center.z+(r0+inset)*math.sin(a)))
  rr.append(points)
 rings('Halo | separate segment '+str(index),rr,'Honey brass',bn,.95,True,True)
 # Two incised scrolling tendrils per segment, kept to low-contrast bronze.
 for sign in [-1,1]:
  pts=[]
  for j in range(16):
   a=j/15*TAU*.9;r=.024*(1-j/20)
   along=sign*.045+r*math.cos(a);rad=.402+r*math.sin(a)
   theta=angle+along/.402
   pts.append((rad*math.cos(theta),.020,center.z+rad*math.sin(theta)))
  tube('Halo | engraved scroll '+str(index)+' '+str(sign),pts,.0022,'Walnut',bn,.91,4)
 # A continuous warm raised border follows the segment's two arcs.
 outline=[]
 for rradius,sequence in [(.442,range(9)),(.367,reversed(range(9)))]:
  for j in sequence:
   a=angle-span*.44+span*.88*j/8;outline.append((rradius*math.cos(a),.021,center.z+rradius*math.sin(a)))
 tube('Halo | beveled border '+str(index),outline,.0028,'Honey brass',bn,1.22,4,True)

def buffer_baron():
 global XFORM
 bone('body',(0,0,.95),'root');bone('head',(0,0,1.30));bone('halo',(0,-.025,1.546),'head')
 # Pear lantern body, with real longitudinal channels between gently uneven staves.
 profile=[(.38,.07,.07),(.43,.13,.12),(.51,.215,.18),(.65,.283,.225),(.82,.327,.245),(.99,.343,.249),(1.13,.313,.227),(1.24,.234,.19),(1.28,.18,.155)]
 rr=[]
 for z,rx,ry in profile:
  ringpts=[]
  for i in range(40):
   a=TAU*i/40;groove=.005*math.cos(a*10+.18*math.sin(z*4))
   ringpts.append(((rx+groove)*math.cos(a),(ry+groove)*math.sin(a),z))
  rr.append(ringpts)
 rings('Body | pear-shaped carved lantern',rr,'Walnut',tint=.94)
 # A golden turned brass finial hangs clear of the ground.
 rr=[]
 for z,r in [(.105,.004),(.13,.015),(.155,.015),(.17,.026),(.20,.036),(.225,.029),(.246,.015),(.26,.019),(.284,.055),(.30,.062),(.317,.043),(.34,.082),(.367,.09),(.389,.066)]:
  rr.append([(r*math.cos(TAU*i/20),r*math.sin(TAU*i/20),z) for i in range(20)])
 rings('Body | turned brass finial',rr,'Honey brass',tint=.89)
 # Carved mask sits proud of a walnut cranium; rim and relief are distinct shells.
 ball('Head | rounded walnut cranium',(0,-.018,1.544),(.258,.155,.277),'Walnut','head',.86,n=28,k=11,ribs=.014)
 poly=[(-.205,1.689),(-.079,1.806),(.095,1.791),(.221,1.659),(.222,1.453),(.080,1.314),(-.111,1.344),(-.225,1.480)]
 XFORM=Matrix.Translation((0,.118,0))
 panel('Face | carved smiling mask',poly,.115,'Walnut','head',1.10,.025,.0008,.028,[(-.093,1.522,.042),(.093,1.515,.042),(0,1.396,.045)])
 XFORM=Matrix.Identity(4)
 for s in [-1,1]:
  x=s*.093;z=1.519+s*.003
  disc('Face | inset dark eye '+str(s),(x,.200,z),.048,.021,'Carved recess','head',.83,20)
  ring('Face | bronze eye bevel '+str(s),(x,.215,z),.039,.045,.006,'Honey brass','head',.52,24)
  ball('Face | amber eye lens '+str(s),(x,.211,z),(.031,.031,.037),'Amber light','head',.70,20,10)
  ball('Face | tiny warm glint '+str(s),(x-.009,.24,z+.012),(.004,.002,.004),'Honey brass','head',1.5,8,4)
  tube('Face | expressive carved brow '+str(s),[(s*.037,.199,1.643),(s*.074,.209,1.653),(s*.127,.201,1.632),(s*.169,.181,1.607)],[.020,.026,.024,.012],'Walnut','head',.75,7)
 leaf('Face | central carved bridge',(0,.21,1.446),(0,.185,1.779),.033,'Walnut','head',1.12,.012)
 smile=[(-.071,.186,1.421),(0,.215,1.391),(.071,.189,1.423),(.046,.201,1.377),(0,.215,1.365),(-.046,.201,1.383)]
 mesh('Face | recessed gentle smile',smile,[tuple(range(6))],'Carved recess','head',.84,False)
 for i in range(6):halo_segment(i,TAU*i/6,'halo')
 # Amber chest lantern, deeply inset with a brass spoke wheel and broad bezel.
 disc('Chest | dark lantern socket',(0,.243,.984),.17,.025,'Carved recess',tint=.85,n=28)
 ring('Chest | broad honey bezel',(0,.263,.984),.153,.166,.017,'Honey brass',tint=.88,n=32)
 ball('Chest | amber glass',(0,.266,.984),(.132,.045,.145),'Amber light',tint=.87,n=28,k=10)
 for i in range(4):
  a=TAU*i/4;points=[]
  for j in range(6):
   r=.027+.105*j/5;points.append((r*math.cos(a),.315-.025*(r/.14)**2,.984+r*1.06*math.sin(a)))
  tube('Chest | brass spoke '+str(i),points,.0075,'Honey brass',tint=.96,sides=6)
 disc('Chest | raised central hub',(0,.315,.984),.030,.018,'Honey brass',tint=1.09,n=20)
 disc('Chest | lower pendant',(0,.243,.775),.035,.025,'Honey brass',tint=.89,n=18)
 disc('Chest | pendant inset',(0,.261,.775),.018,.009,'Amber light',tint=.78,n=16)
 # Rear service hatch, hinge pins, pull ring and a recessed keyhole.
 box('Back | inset service hatch',(0,-.247,.871),(.217,.023,.325),.034,'Walnut',tint=1.10)
 for s in [-1,1]:
  for z in [.784,.952]:ball('Back | hinge '+str(s)+' '+str(z),(s*.104,-.266,z),(.011,.013,.028),'Honey brass',tint=.78,n=10,k=6)
 ball('Back | round latch',(.056,-.274,.873),(.018,.012,.018),'Honey brass',tint=.94,n=14,k=8)
 ball('Back | keyhole',(0,-.261,.873),(.009,.004,.011),'Carved recess',tint=.8,n=12,k=7)
 ring('Back | hanging ring',(0,-.221,1.239),.038,.052,.010,'Honey brass',tint=.94,n=24)
 # Two articulated arms, each with a plum shoulder, brass elbow, carved gauntlet,
 # an open palm, two jointed fingers and a thumb for readable wind-up gestures.
 for s in [-1,1]:
  side='L' if s<0 else 'R';shoulder=Vector((s*.327,.0,1.198));elbow=Vector((s*.427,.018,.989));wrist=Vector((s*.473,.053,.701))
  bone('arm.'+side,shoulder);bone('forearm.'+side,elbow,'arm.'+side);bone('hand.'+side,wrist,'forearm.'+side)
  ball('Arm | plum shoulder '+side,shoulder,(.124,.123,.127),'Plum inlay','arm.'+side,.92,n=20,k=10)
  save=XFORM;XFORM=Matrix.Translation(shoulder)@Euler((0,0,-s*math.pi/2)).to_matrix().to_4x4()
  disc('Arm | shoulder brass bearing '+side,(0,.093,0),.104,.037,'Honey brass','arm.'+side,.83,24)
  XFORM=save
  tube('Arm | upper turned shaft '+side,[shoulder,shoulder.lerp(elbow,.43),elbow],[.058,.044,.033],'Honey brass','arm.'+side,.84,12)
  ball('Arm | brass elbow '+side,elbow,(.049,.049,.05),'Honey brass','forearm.'+side,.93,n=16,k=8)
  centers=[elbow.lerp(wrist,j/5) for j in range(6)];rr=[]
  for j,p in enumerate(centers):
   r=[.048,.089,.105,.101,.083,.061][j]
   rr.append([(p.x+r*math.cos(TAU*i/24),p.y+r*.83*math.sin(TAU*i/24),p.z) for i in range(24)])
  rings('Arm | carved forearm '+side,rr,'Walnut','forearm.'+side,1.06)
  tube('Arm | wrist cuff '+side,[(wrist.x+.072*math.cos(TAU*i/24),wrist.y+.064*math.sin(TAU*i/24),wrist.z+.013) for i in range(24)],.013,'Honey brass','forearm.'+side,.94,6,True)
  palm=wrist+Vector((s*.005,.025,-.063))
  ball('Hand | carved palm '+side,palm,(.074,.061,.083),'Walnut','hand.'+side,1.06,n=18,k=9)
  for j in range(2):
   bn='finger.'+str(j)+'.'+side;start=palm+Vector((s*(-.033+j*.061),.025,-.027));bone(bn,start,'hand.'+side)
   points=[start,start+Vector((0,.053,-.033)),start+Vector((-s*.008,.077,-.075)),start+Vector((-s*.012,.059,-.099))]
   tube('Hand | curled finger '+bn,points,[.025,.027,.025,.019],'Walnut',bn,1.09,9)
   tube('Hand | finger joint seam '+bn,[points[1]+Vector((-.024,0,0)),points[1]+Vector((.024,0,0))],.0018,'Walnut',bn,.57,4)
  thumb=palm+Vector((-s*.068,.020,.011))
  tube('Hand | thumb '+side,[thumb,thumb+Vector((-s*.027,.058,-.012)),thumb+Vector((-s*.010,.079,-.031))],[.028,.027,.019],'Walnut','hand.'+side,1.10,9)
  # Leaf shoulder mantle fans outward, with a short vine descending beside light.
  for j in range(3):
   leaf('Mantle | shoulder leaf '+side+' '+str(j),(s*(.18+j*.018),.01+j*.045,1.245),(s*(.43+j*.019),.017+j*.043,1.255-j*.047),.045,bone='body',tint=.82+j*.08,bulge=.025)
  tube('Mantle | curled vine '+side,[(s*.181,.15,1.25),(s*.207,.205,1.17),(s*.206,.236,1.10),(s*.232,.211,1.05)],.009,'Sage moss',tint=.91,sides=6)
  for j in range(3):
   leaf('Mantle | chest leaf '+side+' '+str(j),(s*.207,.218,1.17-j*.054),(s*(.255 if j%2==0 else .153),.238,1.226-j*.054),.025,bone='body',tint=.91,bulge=.011)
  leaf('Gauntlet | outer leaf '+side,(s*.463,.112,.752),(s*.484,.103,.936),.05,bone='forearm.'+side,tint=.82,bulge=.015)

def animate_baron(arm,clip,t):
 a=TAU*t;s=math.sin(a)
 pose(arm.pose.bones['body'],(.016*s,0,.018*s),(0,0,.021*s))
 pose(arm.pose.bones['head'],(.025*s,.035*s,0));pose(arm.pose.bones['halo'],(0,.12*s,0))
 wind=0;pulse=0;defeat=0
 if clip=='move':pose(arm.pose.bones['body'],(-.10+.025*s,0,.022*s),(0,0,.023*math.sin(a*2)))
 elif clip=='attack':
  wind=math.sin(math.pi*min(t/.62,1)) if t<.62 else 0
  pulse=math.exp(-((t-.60)/.085)**2)
  pose(arm.pose.bones['body'],(-.10*wind+.20*pulse,0,0),(0,0,.08*wind-.045*pulse))
  pose(arm.pose.bones['head'],(-.18*wind+.12*pulse,0,0));pose(arm.pose.bones['halo'],(0,1.0*wind+.7*pulse,0))
 elif clip=='hit':
  recoil=math.sin(math.pi*t)*(1-t);pose(arm.pose.bones['body'],(-.20*recoil,.10*recoil,.13*recoil),(0,-.04*recoil,0))
 elif clip=='defeat':
  defeat=min(t/.85,1);defeat=defeat*defeat*(3-2*defeat)
  pose(arm.pose.bones['body'],(.22*defeat,0,.35*defeat),(0,0,-.23*defeat));pose(arm.pose.bones['head'],(.31*defeat,0,0));pose(arm.pose.bones['halo'],(0,.65*defeat,0),(0,0,-.045*defeat))
 for sign,side in [(-1,'L'),(1,'R')]:
  pose(arm.pose.bones['arm.'+side],(-.08*s-.72*wind+.65*pulse+.23*defeat,0,sign*(-.04*s+.55*wind+.78*pulse)))
  pose(arm.pose.bones['forearm.'+side],(-.07*s-.50*wind+.42*pulse+.45*defeat,0,sign*.08*s))
  pose(arm.pose.bones['hand.'+side],(-.04*s-.18*wind+.22*pulse,0,sign*.08*wind))
  for j in range(2):pose(arm.pose.bones['finger.'+str(j)+'.'+side],(-.42*wind+.23*pulse+.18*defeat,0,0))

def make_rig(name,spec):
 global PARTS
 bpy.ops.object.select_all(action='DESELECT')
 for ob in PARTS:ob.select_set(True)
 bpy.context.view_layer.objects.active=PARTS[0];bpy.ops.object.join()
 skin=bpy.context.object;skin.name=name+' | carved skin'
 # Final metric normalization changes every mesh and bone consistently. Floating
 # actors preserve specified clearance; root itself remains ground-centered.
 points=[v.co.copy() for v in skin.data.vertices];zmin=min(p.z for p in points);zmax=max(p.z for p in points)
 factor=(spec['height']-spec['floor'])/(zmax-zmin)
 xfactor=factor if spec['width'] is None else spec['width']/(max(p.x for p in points)-min(p.x for p in points))
 for v in skin.data.vertices:v.co=(v.co.x*xfactor,v.co.y*factor,(v.co.z-zmin)*factor+spec['floor'])
 data=bpy.data.armatures.new(name+' | editable rigid-part skeleton')
 arm=bpy.data.objects.new(name+' | rig',data);bpy.context.collection.objects.link(arm)
 bpy.context.view_layer.objects.active=arm;arm.select_set(True);skin.select_set(False)
 bpy.ops.object.mode_set(mode='EDIT')
 root=data.edit_bones.new('root');root.head=(0,0,0);root.tail=(0,0,.08);root.use_deform=False
 for bn,(p,parent) in BONES.items():
  b=data.edit_bones.new(bn);b.head=(p.x*xfactor,p.y*factor,(p.z-zmin)*factor+spec['floor']);b.tail=b.head+Vector((0,0,.07));b.parent=data.edit_bones[parent]
 bpy.ops.object.mode_set(mode='OBJECT')
 # The mesh is a scene root, preventing a glTF skinned-parent-transform warning.
 mod=skin.modifiers.new('Rigid articulated carved parts','ARMATURE');mod.object=arm
 arm['asset_id']=name;arm['version']='v001';arm['candidate_approval']='pending';arm['forward']='Blender +Y; glTF -Z'
 return arm,skin,{'uniform_yz':factor,'width':xfactor,'source_min_z':zmin}

def pose(pb,rot=(0,0,0),loc=(0,0,0)):
 basis=pb.bone.matrix_local.to_3x3()
 pb.rotation_mode='QUATERNION';pb.rotation_quaternion=(basis.inverted()@Euler(rot).to_matrix()@basis).to_quaternion()
 pb.location=basis.inverted()@Vector(loc)

def animate(name,arm,skin):
 specs=[('idle',60,True,None),('move',24,True,None),('attack',42 if name=='buffer-baron' else 30,False,SPECS[name]['impact']),('hit',14,False,None),('defeat',42,False,None)]
 sc=bpy.context.scene;sc.render.fps=24
 arm.animation_data_create();records=[]
 for clip,frames,loop,impact in specs:
  action=bpy.data.actions.new(clip);arm.animation_data.action=action
  for f in range(frames+1):
   sc.frame_set(f)
   t=f/frames;a=TAU*t;s=math.sin(a);c=math.cos(a)
   for pb in arm.pose.bones:pose(pb)
   if name=='blockling':
    if clip=='idle':
     pose(arm.pose.bones['body'],loc=(0,0,.0025*math.sin(a)))
     pose(arm.pose.bones['head'],(.025*s,.025*s,.012*c))
    elif clip=='move':
     pose(arm.pose.bones['body'],(.035*s,0,0),(0,0,.014*(1-math.cos(a*2))))
     pose(arm.pose.bones['head'],(.035*s,0,.015*s))
     for bn in BONES:
      if bn.startswith('leg.'):
       phase=a+(math.pi if ('front.L' in bn or 'back.R' in bn) else 0)
       pose(arm.pose.bones[bn],(.32*math.sin(phase),0,0),loc=(0,0,.014*max(0,math.sin(phase))))
      elif bn.startswith('foot.'):
       phase=a+(math.pi if ('front.L' in bn or 'back.R' in bn) else 0)
       pose(arm.pose.bones[bn],(-.25*math.sin(phase),0,0))
      elif bn.startswith('shin.'):
       phase=a+(math.pi if ('front.L' in bn or 'back.R' in bn) else 0)
       pose(arm.pose.bones[bn],(-.15*math.sin(phase),0,0))
    elif clip=='attack':
     wind=math.sin(math.pi*min(t/.50,1)) if t<.50 else 0
     strike=math.sin(math.pi*min(max((t-.40)/.24,0),1))
     pose(arm.pose.bones['body'],(-.10*wind+.14*strike,0,0),(0,-.025*wind+.08*strike,.016*wind))
     pose(arm.pose.bones['head'],(-.26*wind+.35*strike,0,0))
     for bn in BONES:
      if bn.startswith('leg.front'):pose(arm.pose.bones[bn],(-.13*wind+.25*strike,0,0))
    elif clip=='hit':
     recoil=math.sin(math.pi*t)*(1-t)
     pose(arm.pose.bones['body'],(-.17*recoil,0,.14*recoil),(0,-.027*recoil,.008*recoil))
     pose(arm.pose.bones['head'],(-.25*recoil,.12*recoil,.10*recoil))
    else:
     q=min(t/.66,1);q=q*q*(3-2*q)
     pose(arm.pose.bones['body'],(0,.84*q,0),(0,0,-.075*q))
     pose(arm.pose.bones['head'],(.20*q,-.08*q,-.12*q))
     for bn in BONES:
      if bn.startswith('leg.'):pose(arm.pose.bones[bn],(.48*q,0,0))
   else:
    animate_flying(name,arm,clip,t)
   # Keep visual feet/shell above the ground while root translation stays fixed.
   bpy.context.view_layer.update()
   deps=bpy.context.evaluated_depsgraph_get();ev=skin.evaluated_get(deps);md=ev.to_mesh()
   lowest=min((ev.matrix_world@v.co).z for v in md.vertices);ev.to_mesh_clear()
   if lowest<0:
    pb=arm.pose.bones['body'];basis=pb.bone.matrix_local.to_3x3();pb.location+=basis.inverted()@Vector((0,0,-lowest+.00015))
   for pb in arm.pose.bones:
    pb.keyframe_insert(data_path='location',frame=f,group=pb.name);pb.keyframe_insert(data_path='rotation_quaternion',frame=f,group=pb.name)
  track=arm.animation_data.nla_tracks.new();track.name=clip
  strip=track.strips.new(clip,0,action);strip.action_frame_start=0;strip.action_frame_end=frames;track.mute=True
  records.append({'name':clip,'duration_s':frames/24,'loop':loop,'impact_time_s':impact})
 arm.animation_data.action=None
 for pb in arm.pose.bones:pose(pb)
 sc.frame_set(0);bpy.context.view_layer.update()
 return records

def bake_pigment(skin,folder,name):
 """Bake original directional pigment into one embedded 1024px RGB atlas.

 This is a Blender-authored procedural field, not a downloaded/photo texture.
 Surface relief remains mesh geometry; baking keeps browser materials cheap.
 """
 sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.samples=1;sc.cycles.device='CPU'
 sc.render.threads_mode='FIXED';sc.render.threads=6
 bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);bpy.context.view_layer.objects.active=skin
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
 bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.006,area_weight=.5)
 bpy.ops.object.mode_set(mode='OBJECT')
 atlas=bpy.data.images.new(name+' | original pigment atlas',width=1024,height=1024,alpha=False)
 atlas.colorspace_settings.name='sRGB';atlas.generated_color=(.32,.20,.10,1)
 for material in skin.data.materials:
  nodes=material.node_tree.nodes;links=material.node_tree.links;bs=nodes.get('Principled BSDF')
  source=next(n for n in nodes if n.type=='VERTEX_COLOR')
  coord=nodes.new('ShaderNodeTexCoord');coord.name='Editable pigment coordinates'
  scale=nodes.new('ShaderNodeVectorMath');scale.operation='MULTIPLY'
  scale.inputs[1].default_value=(65,65,.32) if material.name=='Walnut' else ((170,170,170) if material.name=='Sage moss' else ((18,18,18) if material.name=='Amber light' else (70,70,7)))
  links.new(coord.outputs['Object'],scale.inputs[0])
  field=nodes.new('ShaderNodeTexNoise');field.noise_dimensions='3D';field.inputs['Scale'].default_value=4.0;field.inputs['Detail'].default_value=2 if material.name=='Walnut' else 4;field.inputs['Roughness'].default_value=.55
  links.new(scale.outputs['Vector'],field.inputs['Vector'])
  ramp=nodes.new('ShaderNodeValToRGB');ramp.name='Editable original fiber pigment'
  low,high=(.43,1.34) if material.name=='Walnut' else ((.58,1.26) if material.name=='Sage moss' else ((.67,1.27) if material.name=='Amber light' else (.88,1.09)))
  ramp.color_ramp.elements[0].position=.22;ramp.color_ramp.elements[0].color=(low,low,low,1)
  ramp.color_ramp.elements[1].position=.78;ramp.color_ramp.elements[1].color=(high,high,high,1)
  links.new(field.outputs['Fac'],ramp.inputs['Fac'])
  mult=nodes.new('ShaderNodeMixRGB');mult.blend_type='MULTIPLY';mult.inputs[0].default_value=1
  links.new(source.outputs['Color'],mult.inputs[1]);links.new(ramp.outputs['Color'],mult.inputs[2]);links.new(mult.outputs['Color'],bs.inputs['Base Color'])
  target=nodes.new('ShaderNodeTexImage');target.name='Embedded pigment atlas';target.image=atlas
  nodes.active=target;target.select=True
 sc.render.bake.use_pass_direct=False;sc.render.bake.use_pass_indirect=False;sc.render.bake.use_pass_color=True
 bpy.ops.object.bake(type='DIFFUSE',pass_filter={'COLOR'},margin=5,use_clear=True)
 atlas.filepath_raw=os.path.join(folder,'pigment.png');atlas.file_format='PNG';atlas.save();atlas.pack()
 skin.data.color_attributes['Color'].name='SourcePigment'
 white=skin.data.color_attributes.new(name='Color',type='BYTE_COLOR',domain='CORNER')
 for entry in white.data:entry.color=(1,1,1,1)
 skin.data.color_attributes.active_color=white
 skin.data.color_attributes.render_color_index=skin.data.color_attributes.find('Color')
 for material in skin.data.materials:
  nodes=material.node_tree.nodes;links=material.node_tree.links
  for n in nodes:
   if n.type=='VERTEX_COLOR':n.layer_name='SourcePigment'
  links.new(nodes['Embedded pigment atlas'].outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color'])
 return {'file':'pigment.png','width':1024,'height':1024,'source':'Original Blender Noise Texture fields multiplied by retained SourcePigment vertex washes; diffuse-color-only bake','bytes':os.path.getsize(atlas.filepath_raw),'sha256':hashlib.sha256(open(atlas.filepath_raw,'rb').read()).hexdigest()}

def build(name,output=OUTPUT):
 reset();palette()
 if name=='blockling':blockling()
 elif name=='signal-moth':signal_moth()
 elif name=='buffer-baron':buffer_baron()
 else:raise ValueError(name)
 arm,skin,scale=make_rig(name,SPECS[name]);clips=animate(name,arm,skin)
 folder=os.path.join(output,name);os.makedirs(folder,exist_ok=True)
 texture=bake_pigment(skin,folder,name)
 source=os.path.join(output,'build.py')
 if os.path.exists(source):text=bpy.data.texts.new('build.py');text.write(open(source).read())
 bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
 master=os.path.join(folder,name+'.blend');bpy.ops.wm.save_as_mainfile(filepath=master)
 target=os.path.join(folder,name+'.glb')
 bpy.ops.export_scene.gltf(filepath=target,export_format='GLB',use_selection=True,export_yup=True,
  export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_def_bones=False,
  export_all_influences=False,export_influence_nb=4,export_apply=False,export_texcoords=True,
  export_normals=True,export_tangents=False,export_materials='EXPORT',export_vertex_color='ACTIVE',
  export_image_format='JPEG',export_jpeg_quality=90,
  export_all_vertex_colors=False,export_cameras=False,export_lights=False,export_extras=True,
  export_force_sampling=True,export_frame_range=False,export_frame_step=1,export_optimize_animation_size=True,
  export_current_frame=False,export_rest_position_armature=True,export_anim_slide_to_zero=True,
  export_draco_mesh_compression_enable=False)
 skin.data.calc_loop_triangles();coords=[v.co for v in skin.data.vertices]
 record={'asset_id':name,'version':'v001','blender':bpy.app.version_string,'triangles':len(skin.data.loop_triangles),
  'vertices':len(skin.data.vertices),'material_count':len(skin.data.materials),'bones':list(BONES),
  'bounds_blender':{'min':[min(p[k] for p in coords) for k in range(3)],'max':[max(p[k] for p in coords) for k in range(3)]},
  'clips':clips,'scale_correction':scale,'spec':SPECS[name],'pigment_atlas':texture,
  'files':{os.path.basename(p):{'bytes':os.path.getsize(p),'sha256':hashlib.sha256(open(p,'rb').read()).hexdigest()} for p in [master,target]}}
 open(os.path.join(folder,'construction.json'),'w').write(json.dumps(record,indent=2)+'\n')
 print(json.dumps(record));return record
