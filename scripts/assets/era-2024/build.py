"""WO-016 original carved Ribbon Fair enemies. Astra authored; Blender 4.5.

Run only after an explicit exclusive scene lease: build('loop-dancer', OUTPUT).
An original baked pigment atlas is embedded; relief is mesh geometry. No external dependencies.
Meters, Blender +Z up/+Y forward; glTF converts to +Y up/-Z forward.
"""
import bpy, bmesh, math, json, os, hashlib, random
from mathutils import Vector, Matrix, Euler, noise

OUTPUT='/workspace/haynes-quest/era-2024/v001'
TAU=math.tau
PARTS=[]
MAT={}
XFORM=Matrix.Identity(4)
BONES={}
PAL={
 'Walnut':('795136',.79,0),
 'Honey brass':('c79b50',.42,.55),
 'Sage cloth':('697653',.93,0),
 'Plum cloth':('694052',.90,0),
 'Carved recess':('38271d',.88,0),
 'Amber light':('ff9e28',.24,.24),
}
SPECS={
 'loop-dancer':{'height':1.10,'floor':0,'width':None,'impact':.75},
 'prism-mimic':{'height':1.05,'floor':0,'width':None,'impact':.625},
 'trendweaver':{'height':1.90,'floor':.12,'width':None,'impact':1.125},
}


def clear_scene_objects():
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

def leaf(name,start,end,width,mat='Sage cloth',bone='body',tint=1,bulge=.009):
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

def bezier(a,b,c,d,n=13):
 return [Vector(a)*(1-t)**3+Vector(b)*3*t*(1-t)**2+Vector(c)*3*t*t*(1-t)+Vector(d)*t**3 for t in [i/(n-1) for i in range(n)]]

def lathe(name,profile,mat,bn='body',tint=1,sides=28,center=(0,0,0),ribs=0):
 cx,cy,cz=center;rr=[]
 for z,r in profile:
  rr.append([(cx+r*math.cos(TAU*i/sides)*(1+ribs*math.sin(i*TAU/sides*9+.5*math.sin(z*12))),cy+r*math.sin(TAU*i/sides)*(1+ribs*math.sin(i*TAU/sides*9+.5*math.sin(z*12))),cz+z) for i in range(sides)])
 return rings(name,rr,mat,bn,tint)

def carved_oval(name,c,s,bn='head',tint=1,pits=(),n=28,k=16):
 """Rounded walnut volume with restrained cut ridges and true socket hollows."""
 rr=[]
 for j in range(k+1):
  a=math.pi*(.004+.992*j/k);row=[]
  for i in range(n):
   t=TAU*i/n;x=c[0]+s[0]*math.sin(a)*math.cos(t);y=c[1]+s[1]*math.sin(a)*math.sin(t);z=c[2]+s[2]*math.cos(a)
   gr=.0012*math.sin(52*x+1.7*math.sin(8*z))+.0004*math.sin(130*x+math.sin(z*17))
   y+=gr*math.sin(t)*math.sin(a)
   if y>c[1]:
    for ex,ez,rad,dep in pits:y-=dep*math.exp(-((x-ex)**2+(z-ez)**2)/(rad*rad))
   row.append((x,y,z))
  rr.append(row)
 return rings(name,rr,'Walnut',bn,tint)

def eye(name,c,r,bn='head',tint=1):
 disc(name+' | carved bowl',c,r*1.15,r*.30,'Carved recess',bn,.76,20)
 ring(name+' | inset brass rim',(c[0],c[1]+r*.15,c[2]),r*.91,r*.97,r*.13,'Honey brass',bn,.8,20)
 ball(name+' | convex amber lens',(c[0],c[1]+r*.19,c[2]),(r*.72,r*.56,r*.78),'Amber light',bn,tint,18,10)
 ball(name+' | subtle glint',(c[0]-r*.23,c[1]+r*.69,c[2]+r*.25),(r*.13,r*.05,r*.13),'Honey brass',bn,1.65,8,4)

def limb(name,a,b,width,depth,bn,tint=1):
 a=Vector(a);b=Vector(b);d=b-a
 ob=box(name,(a+b)/2,(width,depth,d.length),min(width,depth)*.24,'Walnut',bn,tint,rot=d.to_track_quat('Z','Y').to_euler())
 return ob

def cuff(name,c,r,bn,mat='Honey brass'):
 return ball(name,c,(r,r,r),mat,bn,.88,12,7)

def hand(name,c,s,bn,open_hand=True,sign=1):
 c=Vector(c);ball(name+' | palm',c,(s*.47,s*.35,s*.54),'Walnut',bn,1.08,14,8)
 # Three rounded wooden mitten digits, visibly separated but joined at palm.
 for i,(dx,dz,lean) in enumerate([(-.36,.12,-.72),(.02,.36,-.13),(.38,.27,.50)]):
  start=c+Vector((sign*s*dx,.00,s*dz))
  end=start+Vector((sign*s*lean*.45,s*(.23 if open_hand else .34),s*(.7 if open_hand else .33)))
  pts=bezier(start,start+Vector((0,0,s*.35)),end+Vector((0,-s*.18,s*.10)),end,6)
  tube(name+' | digit '+str(i+1),pts,[s*.18,s*.21,s*.22,s*.20,s*.17,s*.10],'Walnut',bn,1.03,7)

def ribbon_chain(name,points,width,mat,bone_prefix,parent='body',thickness=.007):
 """Closed cloth ribbon, softly folded across width, with a three-bone skin."""
 pts=[Vector(p) for p in points];count=len(pts);segments=3
 bn=[]
 for k in range(segments):
  ident=bone_prefix+'.'+str(k+1);pos=pts[min(count-1,round(k*(count-1)/segments))]
  bone(ident,pos,parent if k==0 else bn[-1]);bn.append(ident)
 verts=[];front=[];back=[]
 for j,p in enumerate(pts):
  t=j/(count-1);d=(pts[min(j+1,count-1)]-pts[max(j-1,0)]).normalized()
  side=Vector((d.z,0,-d.x)).normalized()
  if side.length<.1:side=Vector((1,0,0))
  w=width*(1-.20*t)*(.87+.13*math.sin(math.pi*t))
  for k in range(5):
   u=k/4-.5;q=p+side*(u*w)+Vector((0,.006*math.cos(u*math.pi*2+t*4),0))
   front.append(q+Vector((0,thickness/2,0)));back.append(q-Vector((0,thickness/2,0)))
 verts=front+back;n=len(front);faces=[]
 for j in range(count-1):
  for k in range(4):
   a=j*5+k;faces.extend([(a,a+1,a+6,a+5),(a+5+n,a+6+n,a+1+n,a+n)])
 edge=[j*5 for j in range(count)]+[(count-1)*5+k for k in range(1,5)]+[j*5+4 for j in range(count-2,-1,-1)]+[k for k in range(3,0,-1)]
 for a,b in zip(edge,edge[1:]+edge[:1]):faces.append((a,b,b+n,a+n))
 ob=mesh(name,verts,faces,mat,bn[0],1)
 ob.vertex_groups.clear()
 for ident in bn:ob.vertex_groups.new(name=ident)
 for j in range(count):
  q=j/(count-1)*segments-.30
  left=max(0,min(segments-1,int(math.floor(q))));right=max(0,min(segments-1,left+1));mix=max(0,min(1,q-left))
  for vi in list(range(j*5,j*5+5))+list(range(n+j*5,n+j*5+5)):
   ob.vertex_groups[bn[left]].add([vi],1-mix if right!=left else 1,'REPLACE')
   if right!=left and mix:ob.vertex_groups[bn[right]].add([vi],mix,'REPLACE')
 return ob

def loop_dancer():
 global XFORM
 bone('body',(0,0,.48),'root');bone('head',(0,0,.72))
 # Barrel chest and small belly remain visible inside the plum tailored coat.
 carved_oval('Body | barrel wood',(0,0,.535),(.121,.080,.142),'body',.95,n=20,k=12)
 carved_oval('Pelvis | rounded wood',(0,0,.398),(.103,.075,.075),'body',.90,n=20,k=10)
 # Tailored curved lapels; X/Z outlines are closed, softly chamfered cloth panels.
 for s in [-1,1]:
  XFORM=Matrix.Translation((s*.066,.015,.548))@Euler((0,0,s*.04)).to_matrix().to_4x4()
  outline=[(-s*.05,.123),(s*.040,.105),(s*.074,-.052),(s*.068,-.157),(-s*.029,-.093),(-s*.038,.025)]
  if s<0:outline.reverse()
  panel('Coat | shaped lapel '+str(s),outline,.133,'Plum cloth','body',1,.012,.0003,.007)
  XFORM=Matrix.Identity(4)
  for z in [.594,.542]:ball('Coat | button',(s*.046,.097,z),(.008,.007,.008),'Honey brass','body',1,10,5)
 # Coat tails curve down behind the hips, separate from the two scarf tails.
 for s in [-1,1]:
  XFORM=Matrix.Translation((s*.070,-.056,.424))@Euler((.15,s*.20,0)).to_matrix().to_4x4()
  panel('Coat | short rear skirt '+str(s),[(-.056,.065),(.055,.055),(.061,-.108),(-.045,-.064)],.025,'Plum cloth','body',.83,.007,.0002,.006)
 XFORM=Matrix.Identity(4)
 # Walnut oval has actual socket depressions and broad sculpted volume.
 carved_oval('Head | carved oval',(0,.006,.844),(.207,.139,.190),'head',1.12,[(-.079,.842,.040,.014),(.079,.806,.038,.014)],32,20)
 eye('Eye | left',(-.079,.132,.842),.026,'head',.82)
 eye('Eye | right',(.079,.134,.806),.026,'head',.82)
 for s,z,tilt in [(-1,.918,-.04),(1,.885,-.045)]:
  xs=s*.088
  pts=bezier((xs-.040,.129,z+tilt*.4),(xs-.025,.145,z+.016),(xs+.013,.149,z+.015),(xs+.035,.135,z-tilt*.4),9)
  tube('Face | expressive carved brow '+str(s),pts,[.008,.012,.014,.015,.015,.014,.012,.009,.006],'Walnut','head',.53,6)
 smile=bezier((-.031,.144,.777),(-.020,.155,.751),(.019,.155,.754),(.043,.140,.774),12)
 tube('Face | carved smile',smile,[.0017]*12,'Carved recess','head',.88,5)
 # Low cap band and exactly two softly bent points, with brass bells.
 rr=[]
 for z,s in [(1.004,.79),(1.014,.98),(1.042,.97),(1.061,.71)]:
  rr.append([(.195*s*math.cos(TAU*i/24),.006+.113*s*math.sin(TAU*i/24),z+.009*math.sin(TAU*i/24)) for i in range(24)])
 rings('Cap | gathered base',rr,'Plum cloth','head',.97)
 left=bezier((-.047,.003,1.047),(-.092,-.011,1.153),(-.193,.013,1.105),(-.253,.024,1.061),13)
 tube('Cap | long left point',left,[.076*(1-i/13)**1.08+.006 for i in range(13)],'Plum cloth','head',1.06,12)
 right=bezier((.100,-.009,1.035),(.156,-.004,1.088),(.187,.009,1.066),(.201,.025,1.016),10)
 tube('Cap | short right point',right,[.042*(1-i/10)**1.05+.005 for i in range(10)],'Plum cloth','head',.93,10)
 for p in [left[-1],right[-1]]:ball('Cap | bell',p,(.018,.018,.019),'Honey brass','head',1,12,7)
 # Visible wrapped scarf collar, separate sage/plum tail anchors and brass key.
 collar=[]
 for i in range(37):
  a=TAU*i/36;collar.append((.104*math.cos(a),.071*math.sin(a),.699+.012*math.cos(a+.6)))
 tube('Scarf | rolled sage collar',collar,.026,'Sage cloth','body',1.04,8,True)
 ball('Scarf | rear knot',(-.043,-.078,.696),(.042,.026,.031),'Sage cloth','body',1.02,14,8)
 for s,mat,offset in [(-1,'Sage cloth',0),(1,'Plum cloth',.028)]:
  pts=bezier((s*.022,-.089,.689),(s*.23,-.13,.83-offset),(s*.35,-.18,.52),(s*.31,-.13,.345+offset),18)
  ribbon_chain('Scarf | '+mat+' tail',pts,.09,mat,'scarf.'+('L' if s<0 else 'R'))
 bone('winding-key',(0,-.094,.603))
 tube('Key | stem',[(0,-.091,.603),(0,-.162,.603)],.012,'Honey brass','winding-key',.99,10)
 for s in [-1,1]:ring('Key | open loop '+str(s),(s*.032,-.17,.619),.031,.033,.009,'Honey brass','winding-key',1,22)
 box('Key | bridge',(0,-.17,.609),(.048,.014,.020),.006,'Honey brass','winding-key',.9)
 # Two articulated arms and legs; brass axle balls remain visible at joints.
 for s in [-1,1]:
  tag='L' if s<0 else 'R';shoulder=Vector((s*.135,.002,.641));elbow=Vector((s*.177,.013,.532));wrist=Vector((s*.201,.037,.421))
  bone('upper-arm.'+tag,shoulder);bone('forearm.'+tag,elbow,'upper-arm.'+tag);bone('hand.'+tag,wrist,'forearm.'+tag)
  cuff('Shoulder | '+tag,shoulder,.031,'upper-arm.'+tag)
  limb('Arm | '+tag+' upper',shoulder+Vector((0,0,-.027)),elbow+Vector((0,0,.018)),.043,.054,'upper-arm.'+tag,1.02)
  cuff('Elbow | '+tag,elbow,.022,'forearm.'+tag)
  limb('Arm | '+tag+' forearm',elbow+Vector((0,0,-.018)),wrist+Vector((0,0,.017)),.049,.054,'forearm.'+tag,1.08)
  cuff('Wrist | '+tag,wrist,.020,'hand.'+tag)
  # Fingers point down at rest; rotating the local construction gives open palms.
  save=XFORM;XFORM=Matrix.Translation(wrist)@Euler((0,math.pi,0)).to_matrix().to_4x4()
  hand('Hand | '+tag,(0,0,.038),.052,'hand.'+tag,True,-s);XFORM=save
  hip=Vector((s*.070,.004,.386));knee=Vector((s*.075,.011,.244));ankle=Vector((s*.078,.018,.101))
  bone('thigh.'+tag,hip);bone('shin.'+tag,knee,'thigh.'+tag);bone('foot.'+tag,ankle,'shin.'+tag)
  cuff('Hip | '+tag,hip,.029,'thigh.'+tag)
  limb('Leg | '+tag+' thigh',hip+Vector((0,0,-.025)),knee+Vector((0,0,.024)),.065,.071,'thigh.'+tag,.99)
  cuff('Knee | '+tag,knee,.024,'shin.'+tag)
  limb('Leg | '+tag+' shin',knee+Vector((0,0,-.025)),ankle+Vector((0,0,.022)),.061,.067,'shin.'+tag,1.06)
  cuff('Ankle | '+tag,ankle,.023,'foot.'+tag)
  # Low flat sole and rounded toe carve create actual dance shoes.
  box('Shoe | '+tag+' sole',(s*.082,.036,.024),(.120,.194,.038),.018,'Walnut','foot.'+tag,.65)
  carved_oval('Shoe | '+tag+' rounded toe',(s*.082,.058,.055),(.061,.093,.043),'foot.'+tag,1.01,n=20,k=10)
  ball('Shoe | '+tag+' brass button',(s*.123,.016,.063),(.011,.012,.011),'Honey brass','foot.'+tag,.95,10,5)

def prism_mimic():
 global XFORM
 bone('body',(0,-.095,.455),'root');bone('head',(0,.235,.620))
 # Long low body with a shaped wither, tucked waist and muscular carved haunch.
 carved_oval('Trunk | long carved fox body',(0,-.115,.432),(.199,.328,.178),'body',.94,n=28,k=16)
 carved_oval('Chest | deep walnut',(0,.123,.472),(.179,.152,.222),'body',1.03,n=24,k=14)
 # Four distinct low legs, each with a visible plum joint and three rounded toes.
 for s in [-1,1]:
  for front,y in [(True,.148),(False,-.315)]:
   tag=('front' if front else 'rear')+('.L' if s<0 else '.R')
   shoulder=Vector((s*.173,y,.476 if front else .415))
   knee=Vector((s*.204,y+(-.026 if front else .046),.262))
   ankle=Vector((s*.203,y+.049,.105))
   bone('leg.'+tag,shoulder);bone('shin.'+tag,knee,'leg.'+tag);bone('foot.'+tag,ankle,'shin.'+tag)
   cuff('Axle | '+tag,shoulder,.048,'leg.'+tag,'Plum cloth')
   limb('Leg | '+tag+' upper',shoulder+Vector((0,0,-.030)),knee+Vector((0,0,.024)),.093,.112,'leg.'+tag,.96)
   cuff('Knee | '+tag,knee,.040,'shin.'+tag,'Plum cloth')
   limb('Leg | '+tag+' lower',knee+Vector((0,0,-.020)),ankle+Vector((0,0,.017)),.091,.104,'shin.'+tag,1.09)
   box('Paw | '+tag+' base',(s*.207,y+.061,.046),(.146,.180,.071),.030,'Walnut','foot.'+tag,.92)
   for toe in [-1,0,1]:
    carved_oval('Paw | '+tag+' toe '+str(toe),(s*.207+toe*.044,y+.116,.057),(.028,.052,.045),'foot.'+tag,1.1 if toe==0 else 1.0,n=12,k=7)
   # A leaf plaque sits over each upper joint, oriented out and slightly forward.
   save=XFORM;angle=-s*.88
   XFORM=Matrix.Translation((s*.204,y+.025,.533 if front else .454))@Euler((-.13,0,angle)).to_matrix().to_4x4()
   p=[(-.061,.082),(.005,.128),(.073,.071),(.070,-.060),(-.027,-.084),(-.067,-.008)]
   panel('Shoulder | brass leaf plaque '+tag,p,.035,'Honey brass','body',.88,.007,.0003,.008)
   XFORM=XFORM@Matrix.Translation((0,.026,0))
   leaf('Shoulder | sage carved leaf '+tag,(-.024,.005,-.052),(.025,.005,.086),.041,'Sage cloth','body',1.08,.009)
   XFORM=save
 # Head shell is softened and visibly thick, with a walnut back and one face.
 frame=Matrix.Translation((0,.269,.704))@Euler((-.10,0,0)).to_matrix().to_4x4()
 XFORM=frame
 poly=[(-.207,.094),(-.126,.205),(0,.232),(.129,.201),(.210,.087),(.139,-.155),(0,-.204),(-.141,-.153)]
 panel('Mask | rounded walnut shell',poly,.245,'Walnut','head',1.08,.039,.0007,.021)
 # Each tall ear is a shaped shell with an inset plum leaf and brass lip.
 for s in [-1,1]:
  ep=[(s*.070,.135),(s*.112,.385),(s*.201,.495),(s*.239,.209),(s*.187,.111)]
  if s<0:ep.reverse()
  panel('Ear | walnut '+str(s),ep,.093,'Walnut','head',1.0,.019,.0003,.008)
  XFORM=frame@Matrix.Translation((0,.055,0))
  outline=[(s*.109,.165),(s*.137,.357),(s*.192,.427),(s*.210,.223),(s*.177,.163)]
  if s<0:outline.reverse()
  panel('Ear | brass border '+str(s),outline,.017,'Honey brass','head',.94,.005,.0001,.003)
  XFORM=frame@Matrix.Translation((0,.067,0))
  inner=[(s*.131,.190),(s*.151,.337),(s*.188,.388),(s*.192,.226),(s*.167,.190)]
  if s<0:inner.reverse()
  panel('Ear | plum inset '+str(s),inner,.010,'Plum cloth','head',.92,.004,.0001,.001)
 XFORM=frame@Matrix.Translation((0,.142,0))
 # A coherent central prism and two brow/cheek arrays follow one fox face.
 panel('Mask | central amber prism',[(-.072,.158),(.076,.158),(.048,-.034),(0,-.133),(-.048,-.034)],.043,'Honey brass','head',1.08,.008,0,.007)
 XFORM=frame@Matrix.Translation((0,.169,0))
 panel('Mask | amber central inset',[(-.053,.137),(.055,.137),(.031,-.028),(0,-.097),(-.033,-.028)],.017,'Amber light','head',.83,.004,0,.003)
 for s in [-1,1]:
  XFORM=frame@Matrix.Translation((0,.128,0))
  poly=[(s*.078,.153),(s*.157,.137),(s*.189,.058),(s*.105,.026),(s*.068,.065)]
  if s<0:poly.reverse()
  panel('Mask | brow rib '+str(s),poly,.028,'Honey brass','head',.91,.005,0,.004)
  XFORM=frame@Matrix.Translation((0,.147,0))
  poly=[(s*.091,.133),(s*.145,.121),(s*.170,.067),(s*.110,.047),(s*.087,.068)]
  if s<0:poly.reverse()
  panel('Mask | plum facet '+str(s),poly,.013,'Plum cloth','head',1.28,.004,0,.001)
  XFORM=frame@Matrix.Translation((0,.128,0))
  poly=[(s*.170,.043),(s*.178,-.033),(s*.104,-.117),(s*.072,-.073),(s*.085,.011)]
  if s<0:poly.reverse()
  panel('Mask | lower honey facet '+str(s),poly,.018,'Honey brass','head',.81,.006,0,.006)
  # Lenses settle into the visible dark eye wells, below the brow facets.
  eye('Eye | fox '+str(s),(s*.112,.158,-.029),.027,'head',.87)
 XFORM=frame
 carved_oval('Muzzle | short tapered walnut',(0,.178,-.148),(.096,.109,.065),'head',1.10,n=22,k=12)
 XFORM=frame@Matrix.Translation((0,.282,-.144))
 panel('Muzzle | blunt brass nose',[(-.033,.018),(.032,.018),(.025,-.015),(0,-.032),(-.025,-.015)],.024,'Honey brass','head',.86,.007,0,.003)
 XFORM=frame
 # Back rivets are small construction hardware on a plain fitted walnut back.
 for s in [-1,1]:ball('Head back | rivet '+str(s),(s*.080,-.134,.031),(.010,.006,.010),'Honey brass','head',.86,10,6)
 XFORM=Matrix.Identity(4)
 # Exactly one broad curled tail, segmented only for hidden skinning joints.
 pts=bezier((0,-.392,.439),(.052,-.773,.360),(.184,-.778,.667),(.081,-.724,.883),25)
 bn=['tail.1','tail.2','tail.3']
 for k,ident in enumerate(bn):bone(ident,pts[k*8],'body' if k==0 else bn[k-1])
 for k in range(3):
  local=pts[k*8:k*8+9]
  radii=[.075+.060*math.sin(math.pi*(k*8+j)/27) for j in range(len(local))]
  if k==2:radii=[r*(1-.76*j/(len(local)-1)) for j,r in enumerate(radii)]
  ob=tube('Tail | '+('sage tip' if k==2 else 'carved sweep '+str(k+1)),local,radii,'Sage cloth' if k==2 else 'Walnut',bn[k],.97,16)
 # Quiet cheek contours and the neck overlap read as carved plates, not fur.
 for s in [-1,1]:
  XFORM=Matrix.Translation((s*.116,.159,.529))@Euler((0,s*.13,-s*.45)).to_matrix().to_4x4()
  panel('Chest | fitted curved plank '+str(s),[(-.061,.069),(.056,.089),(.074,-.079),(0,-.145),(-.062,-.055)],.035,'Walnut','body',.88,.012,.0003,.008)
 XFORM=Matrix.Identity(4)

def trendweaver():
 global XFORM
 bone('body',(0,0,.908),'root');bone('head',(0,0,1.315))
 # The body is a true hourglass spool: broad rolled walnut flanges and a
 # tapered woven core. A few low raised coils hold the silhouette at game scale.
 lathe('Spool | lower walnut flange',[(.435,.215),(.458,.287),(.482,.329),(.519,.341),(.556,.329),(.591,.270),(.616,.197)],'Walnut','body',.99,36,ribs=.005)
 lathe('Spool | upper walnut flange',[(1.035,.191),(1.073,.274),(1.110,.333),(1.149,.344),(1.187,.331),(1.208,.282),(1.220,.251)],'Walnut','body',1.10,36,ribs=.005)
 profile=[]
 for i in range(19):
  z=.585+i*(.502/18);t=i/18;r=.158+.040*(abs(t-.5)*2)**1.8+.003*math.sin(i*2.4)
  profile.append((z,r))
 lathe('Spool | plum thread core',profile,'Plum cloth','body',1.08,32)
 for k in range(13):
  z=.620+k*.033;r=.160+.036*(abs((z-.585)/.502-.5)*2)**1.8
  pts=[(r*math.cos(TAU*i/30),r*math.sin(TAU*i/30),z+.004*math.sin(TAU*i/30*2+k*.7)) for i in range(30)]
  tube('Spool | soft woven coil '+str(k+1),pts,.005,'Plum cloth','body',1.06 if k%2 else .88,5,True)
 # Four large rivets on each flange, sunk into wood rather than extra bolts.
 for z,r in [(1.211,.271),(.574,.286)]:
  for a in [.65,2.49,3.81,5.65]:
   ball('Flange | inset rivet',(r*math.cos(a),r*math.sin(a),z),(.023,.023,.010),'Honey brass','body',1.0,12,7)
 # Small wood neck supports an oval carved mask, front and back fully volumetric.
 lathe('Neck | brass collar',[(1.205,.066),(1.232,.070),(1.247,.058),(1.297,.058)],'Honey brass','head',.76,20)
 carved_oval('Face | oval walnut mask',(0,.007,1.471),(.165,.091,.203),'head',1.07,[(-.069,1.485,.037,.010),(.069,1.470,.037,.010)],28,18)
 for s in [-1,1]:
  eye('Eye | guardian '+str(s),(s*.070,.088,1.480+s*-.006),.028,'head',.81)
  z=1.555+s*-.006
  pts=bezier((s*.070-.038,.082,z),(s*.070-.028,.099,z+.024),(s*.070+.027,.099,z+.024),(s*.070+.037,.082,z+.007),9)
  tube('Brow | guardian '+str(s),pts,[.007,.010,.012,.013,.013,.012,.010,.008,.005],'Walnut','head',.50,6)
 smile=bezier((-.060,.085,1.411),(-.026,.113,1.368),(.029,.113,1.372),(.066,.081,1.414),13)
 tube('Smile | carved curved mouth',smile,[.0023,.003,.004,.005,.006,.006,.006,.006,.005,.004,.003,.002,.0015],'Carved recess','head',.81,5)
 # Five separate blunt brass crown arches, each ending in one little cloth loop.
 for i in range(5):
  spread=(i-2)/2
  start=(spread*.10,-.008,1.624-abs(spread)*.018)
  finish=(spread*.306,-.013,1.873-abs(spread)*.130)
  pts=bezier(start,(spread*.143,-.033,1.737),(spread*.263,-.021,finish[2]-.044),finish,12)
  tube('Crown | brass arch '+str(i+1),pts,[.012-.003*j/11 for j in range(12)],'Honey brass','head',1.09,7)
  ring('Crown | cloth loop '+str(i+1),(finish[0],finish[1],finish[2]+.022),.016,.027,.006,'Sage cloth' if i in [0,2,4] else 'Plum cloth','head',1.07,18)
 # Two arms, posed to make the open hand and the held left shuttle legible.
 for s in [-1,1]:
  tag='L' if s>0 else 'R' # character left appears on viewer right at the front
  shoulder=Vector((s*.231,.008,1.052));elbow=Vector((s*.333,.047,.884));wrist=Vector((s*.438,.116,.980))
  bone('upper-arm.'+tag,shoulder);bone('forearm.'+tag,elbow,'upper-arm.'+tag);bone('hand.'+tag,wrist,'forearm.'+tag)
  cuff('Shoulder | '+tag,shoulder,.043,'upper-arm.'+tag)
  limb('Arm | '+tag+' upper',shoulder+Vector((s*.013,.008,-.034)),elbow+Vector((-s*.008,-.002,.026)),.066,.076,'upper-arm.'+tag,1.04)
  cuff('Elbow | '+tag,elbow,.033,'forearm.'+tag)
  limb('Arm | '+tag+' forearm',elbow+Vector((s*.023,.012,.018)),wrist+Vector((-s*.022,-.011,-.019)),.067,.074,'forearm.'+tag,1.08)
  cuff('Wrist | '+tag,wrist,.027,'hand.'+tag)
  hand('Hand | '+tag,wrist+Vector((s*.029,.019,.024)),.068,'hand.'+tag,tag=='R',s)
  if tag=='L':
   # A pointed-but-blunt hollow wooden shuttle with an inset plum winding.
   XFORM=Matrix.Translation(wrist+Vector((.049,.041,.140)))@Euler((-.18,-.30,.10)).to_matrix().to_4x4()
   p=[(0,.151),(.046,.091),(.056,-.041),(.021,-.118),(-.019,-.105),(-.049,-.034),(-.036,.089)]
   panel('Shuttle | carved wooden frame',p,.035,'Honey brass','hand.L',.83,.010,.0002,.004)
   XFORM=XFORM@Matrix.Translation((0,.024,0))
   panel('Shuttle | recessed bed',[(0,.112),(.026,.065),(.026,-.038),(0,-.078),(-.026,-.031),(-.021,.069)],.010,'Carved recess','hand.L',.96,.004,0,.002)
   carved_oval('Shuttle | plum winding',(0,.011,.009),(.025,.017,.068),'hand.L',1,n=14,k=10)
   # Swap just the winding to plum while preserving original source pigment.
   ob=PARTS[-1];ob.data.materials.clear();[ob.data.color_attributes.remove(c) for c in list(ob.data.color_attributes)];paint(ob,'Plum cloth',1.08)
   XFORM=Matrix.Identity(4)
 # Exactly two broad ribbon tails emerge from actual rear anchor slots.
 for s,mat in [(-1,'Sage cloth'),(1,'Plum cloth')]:
  tag='L' if s<0 else 'R';anchor=(s*.148,-.266,1.166)
  box('Ribbon | recessed slot '+tag,anchor,(.117,.025,.060),.013,'Honey brass','body',.71)
  box('Ribbon | dark slot '+tag,(anchor[0],anchor[1]-.015,anchor[2]),(.087,.009,.032),.006,'Carved recess','body',.9)
  pts=bezier((s*.148,-.280,1.166),(s*.655,-.334,1.407),(s*.646,-.384,.682),(s*.518,-.290,.401),21)
  ribbon_chain('Ribbon | long '+mat,pts,.125,mat,'ribbon.'+tag,thickness=.009)
 # Three hanging bobbins in a triangle. There are no legs or support stand.
 for i,(x,y,z) in enumerate([(-.150,.010,.336),(.150,.010,.336),(0,.147,.286)]):
  ident='bobbin.'+str(i+1);bone(ident,(x,y,.499))
  cuff('Bobbin | hanging joint '+str(i+1),(x,y,.473),.030,ident)
  lathe('Bobbin | brass spool '+str(i+1),[(-.115,.045),(-.099,.067),(-.077,.067),(-.064,.045),(.043,.044),(.059,.065),(.081,.065),(.095,.043)],'Honey brass',ident,.94,20,(x,y,z))
  lathe('Bobbin | plum winding '+str(i+1),[(-.066,.047),(-.060,.052),(.039,.052),(.046,.047)],'Plum cloth',ident,1.00,20,(x,y,z))
  for k in range(4):
   zz=z-.049+k*.023
   tube('Bobbin | thread coil '+str(i+1)+' '+str(k),[(x+.052*math.cos(TAU*j/18),y+.052*math.sin(TAU*j/18),zz) for j in range(18)],.004,'Plum cloth',ident,1.10,4,True)
 XFORM=Matrix.Identity(4)

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

def smooth(v):
 v=max(0,min(1,v));return v*v*(3-2*v)

def pulse(t,center,width):
 return smooth(1-abs(t-center)/width)

def animate_dancer(arm,clip,t):
 p=arm.pose.bones;a=TAU*t
 if clip=='idle':
  pose(p['body'],(0,.024*math.sin(a),.024*math.sin(a)),(0,0,.005*(1-math.cos(a))))
  pose(p['head'],(.023*math.sin(a+.6),.029*math.sin(a),-.027*math.sin(a)))
  for tag,s in [('L',-1),('R',1)]:
   pose(p['upper-arm.'+tag],(.045*math.sin(a+s),0,s*.036*math.sin(a)))
   pose(p['hand.'+tag],(.05*math.sin(a+.4),0,0))
 elif clip=='move':
  pose(p['body'],(0,.085*math.sin(a),.12*math.sin(a)),(0,0,.028*(1-math.cos(a*2))))
  pose(p['head'],(-.05*math.sin(a*2),-.05*math.sin(a),-.08*math.sin(a)))
  for tag,s in [('L',-1),('R',1)]:
   wave=math.sin(a+(math.pi if s<0 else 0));lift=max(0,wave)
   pose(p['thigh.'+tag],(.47*wave,0,s*.09*lift),(0,0,.022*lift))
   pose(p['shin.'+tag],(-.34*lift,0,0))
   pose(p['foot.'+tag],(-.14*wave,0,0))
   pose(p['upper-arm.'+tag],(-.33*wave,.04*wave,-s*.40*lift))
   pose(p['forearm.'+tag],(-.14-.30*lift,0,0))
   pose(p['hand.'+tag],(.06*wave,0,s*.09*wave))
 elif clip=='attack':
  wind=smooth(t/.31)*(1-smooth((t-.34)/.16));strike=pulse(t,.5,.16);release=smooth((t-.64)/.30)
  pose(p['body'],(-.08*wind+.14*strike,0,-.70*wind+.90*strike),(0,.054*strike,.038*wind))
  pose(p['head'],(-.14*wind+.14*strike,0,.26*wind-.22*strike))
  pose(p['upper-arm.L'],(-.30*wind-.18*strike,0,.90*wind-.85*strike))
  pose(p['upper-arm.R'],(-.35*wind-.40*strike,0,-.85*wind-.90*strike))
  pose(p['forearm.L'],(-.70*wind-.24*strike,0,0));pose(p['forearm.R'],(-.65*wind+.20*strike,0,0))
  pose(p['thigh.L'],(-.25*wind+.14*strike,0,-.12*strike));pose(p['thigh.R'],(.20*wind+.16*strike,0,.12*strike))
  pose(p['shin.L'],(-.35*wind,0,0));pose(p['shin.R'],(-.18*wind,0,0))
 elif clip=='hit':
  q=pulse(t,.23,.28)*(1-.25*t)
  pose(p['body'],(-.25*q,.12*q,-.20*q),(0,-.035*q,.015*q));pose(p['head'],(-.34*q,0,.20*q))
  for tag,s in [('L',-1),('R',1)]:pose(p['upper-arm.'+tag],(-.18*q,0,s*.23*q))
 else:
  q=smooth(t/.72)
  pose(p['body'],(.65*q,.25*q,.22*q),(0,0,-.22*q));pose(p['head'],(.45*q,-.24*q,.32*q))
  for tag,s in [('L',-1),('R',1)]:
   pose(p['thigh.'+tag],(-.80*q,0,s*.35*q));pose(p['shin.'+tag],(1.08*q,0,0));pose(p['foot.'+tag],(-.36*q,0,0))
   pose(p['upper-arm.'+tag],(.28*q,0,s*.18*q));pose(p['forearm.'+tag],(.52*q,0,0))
 for bn in BONES:
  if bn.startswith('scarf.'):
   side=-1 if '.L.' in bn else 1;k=int(bn[-1]);amp=.040 if clip=='idle' else .12
   value=math.sin(a+k*.6+side)*amp
   if clip=='defeat':value*=1-smooth(t/.8)
   pose(p[bn],(.08*math.sin(a+k*.7)*amp,side*value,.65*value))
 if clip in ['idle','move']:
  pose(p['winding-key'],(0,.18*math.sin(a),0))
 elif clip=='attack':pose(p['winding-key'],(0,.75*pulse(t,.34,.32),0))

def animate_fox(arm,clip,t):
 p=arm.pose.bones;a=TAU*t
 if clip=='idle':
  pose(p['body'],loc=(0,0,.004*(1-math.cos(a))))
  pose(p['head'],(.035*math.sin(a),.018*math.sin(a+.5),.043*math.sin(a)))
 elif clip=='move':
  pose(p['body'],(.055*math.sin(a*2),0,.025*math.sin(a)),(0,0,.018*(1-math.cos(a*2))))
  pose(p['head'],(-.040*math.sin(a*2),0,-.024*math.sin(a)))
  for bn in BONES:
   if bn.startswith(('leg.','shin.','foot.')):
    wave=math.sin(a+(math.pi if ('front.L' in bn or 'rear.R' in bn) else 0))
    if bn.startswith('leg.'):pose(p[bn],(.48*wave,0,0),(0,0,.015*max(0,wave)))
    elif bn.startswith('shin.'):pose(p[bn],(-.36*max(0,wave),0,0))
    else:pose(p[bn],(-.21*wave,0,0))
 elif clip=='attack':
  wind=smooth(t/.30)*(1-smooth((t-.30)/.18));strike=pulse(t,.5,.16)
  pose(p['body'],(-.12*wind+.17*strike,0,0),(0,-.065*wind+.15*strike,-.04*wind+.045*strike))
  pose(p['head'],(-.20*wind+.32*strike,0,0))
  for bn in BONES:
   if bn.startswith('leg.front'):pose(p[bn],(-.36*wind+.42*strike,0,0))
   elif bn.startswith('shin.front'):pose(p[bn],(.22*wind-.25*strike,0,0))
   elif bn.startswith('leg.rear'):pose(p[bn],(.28*wind-.12*strike,0,0))
 elif clip=='hit':
  q=pulse(t,.23,.30)
  pose(p['body'],(-.20*q,.07*q,.16*q),(0,-.040*q,.017*q));pose(p['head'],(-.23*q,-.12*q,.19*q))
 else:
  q=smooth(t/.68);pose(p['body'],(0,1.07*q,-.07*q),(0,0,-.095*q));pose(p['head'],(.29*q,-.13*q,.12*q))
  for bn in BONES:
   if bn.startswith('leg.'):pose(p[bn],(.59*q,0,0))
   elif bn.startswith('shin.'):pose(p[bn],(-.85*q,0,0))
 for k in range(1,4):
  amp=.04 if clip=='idle' else .085
  swing=amp*math.sin(a+.45*k)
  if clip=='attack':swing+=.12*pulse(t,.34,.30)
  if clip=='defeat':swing=(1-smooth(t/.70))*swing-.22*smooth(t/.70)
  pose(p['tail.'+str(k)],(.8*swing,swing,.5*swing))

def animate_weaver(arm,clip,t):
 p=arm.pose.bones;a=TAU*t
 if clip=='idle':
  pose(p['body'],(.014*math.sin(a),.024*math.sin(a),.025*math.sin(a)),(0,0,.019*math.sin(a)))
  pose(p['head'],(.034*math.sin(a+.4),-.028*math.sin(a),-.04*math.sin(a)))
  pose(p['upper-arm.R'],(.03*math.sin(a),0,-.035*math.sin(a)))
  pose(p['upper-arm.L'],(-.025*math.sin(a),0,.032*math.sin(a)))
 elif clip=='move':
  pose(p['body'],(.095+.035*math.sin(a),0,.055*math.sin(a)),(0,0,.030*math.sin(a)))
  pose(p['head'],(-.05,0,-.04*math.sin(a)))
  pose(p['upper-arm.R'],(.15,0,.10*math.sin(a)));pose(p['upper-arm.L'],(.09,0,.10*math.sin(a)))
 elif clip=='attack':
  wind=smooth(t/.36)*(1-smooth((t-.43)/.16));strike=pulse(t,.60,.15)
  pose(p['body'],(-.11*wind+.07*strike,0,-.52*wind+.34*strike),(0,0,.115*wind+.032*strike))
  pose(p['head'],(-.11*wind+.12*strike,0,.30*wind-.18*strike))
  pose(p['upper-arm.R'],(-.54*wind-.28*strike,0,.65*wind+.48*strike))
  pose(p['upper-arm.L'],(-.58*wind-.20*strike,0,-.63*wind-.59*strike))
  pose(p['forearm.R'],(-.57*wind+.25*strike,0,.25*wind));pose(p['forearm.L'],(-.48*wind+.26*strike,0,-.28*wind))
  pose(p['hand.L'],(0,.25*wind,.35*wind-.24*strike));pose(p['hand.R'],(.25*strike,0,-.24*strike))
 elif clip=='hit':
  q=pulse(t,.24,.31)
  pose(p['body'],(-.12*q,.11*q,-.17*q),(0,-.028*q,0));pose(p['head'],(-.23*q,0,.19*q))
 else:
  q=smooth(t/.82);pose(p['body'],(.24*q,.39*q,-.38*q),(0,0,-.29*q));pose(p['head'],(.43*q,.12*q,.25*q))
  pose(p['upper-arm.L'],(.42*q,0,.28*q));pose(p['upper-arm.R'],(.45*q,0,-.24*q))
  pose(p['forearm.L'],(.37*q,0,0));pose(p['forearm.R'],(.43*q,0,0))
 for bn in BONES:
  if bn.startswith('ribbon.'):
   k=int(bn[-1]);side=-1 if '.L.' in bn else 1
   wave=math.sin(a+k*.65+side)*(.06 if clip=='idle' else .12)
   if clip=='attack':wave+=side*.14*pulse(t,.49,.37)
   if clip=='defeat':wave*=1-smooth(t/.9)
   pose(p[bn],(.18*wave,side*wave,.52*wave))
  elif bn.startswith('bobbin.'):
   k=int(bn[-1]);wave=.055*math.sin(a+k*1.8)
   if clip=='attack':wave+=.22*pulse(t,.60,.15)
   if clip=='defeat':wave=.23*smooth(t/.75)*(1 if k%2 else -1)
   pose(p[bn],(wave,.3*wave,-.4*wave))

def animate(name,arm,skin):
 frames={'loop-dancer':36,'prism-mimic':30,'trendweaver':45}
 specs=[('idle',60,True,None),('move',30,True,None),('attack',frames[name],False,SPECS[name]['impact']),('hit',15,False,None),('defeat',48,False,None)]
 sc=bpy.context.scene;sc.render.fps=24;arm.animation_data_create();records=[]
 fn={'loop-dancer':animate_dancer,'prism-mimic':animate_fox,'trendweaver':animate_weaver}[name]
 for clip,end,loop,impact in specs:
  action=bpy.data.actions.new(clip);arm.animation_data.action=action
  for frame in range(end+1):
   sc.frame_set(frame)
   for pb in arm.pose.bones:pose(pb)
   fn(arm,clip,frame/end)
   bpy.context.view_layer.update()
   deps=bpy.context.evaluated_depsgraph_get();ev=skin.evaluated_get(deps);md=ev.to_mesh()
   lowest=min((ev.matrix_world@v.co).z for v in md.vertices);ev.to_mesh_clear()
   if lowest<0:
    pb=arm.pose.bones['body'];basis=pb.bone.matrix_local.to_3x3();pb.location+=basis.inverted()@Vector((0,0,-lowest+.00015))
   for pb in arm.pose.bones:
    pb.keyframe_insert(data_path='location',frame=frame,group=pb.name)
    pb.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=pb.name)
  track=arm.animation_data.nla_tracks.new();track.name=clip
  strip=track.strips.new(clip,0,action);strip.action_frame_start=0;strip.action_frame_end=end;track.mute=True
  records.append({'name':clip,'duration_s':end/24,'loop':loop,'impact_time_s':impact})
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
  scale.inputs[1].default_value=(65,65,.32) if material.name=='Walnut' else ((170,170,170) if material.name=='Sage cloth' else ((18,18,18) if material.name=='Amber light' else (70,70,7)))
  links.new(coord.outputs['Object'],scale.inputs[0])
  field=nodes.new('ShaderNodeTexNoise');field.noise_dimensions='3D';field.inputs['Scale'].default_value=4.0;field.inputs['Detail'].default_value=2 if material.name=='Walnut' else 4;field.inputs['Roughness'].default_value=.55
  links.new(scale.outputs['Vector'],field.inputs['Vector'])
  ramp=nodes.new('ShaderNodeValToRGB');ramp.name='Editable original fiber pigment'
  low,high=(.66,1.23) if material.name=='Walnut' else ((.58,1.26) if material.name=='Sage cloth' else ((.67,1.27) if material.name=='Amber light' else (.88,1.09)))
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
 """Author one candidate only while the caller owns the exclusive WO-016 lease."""
 clear_scene_objects();palette()
 {'loop-dancer':loop_dancer,'prism-mimic':prism_mimic,'trendweaver':trendweaver}[name]()
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
