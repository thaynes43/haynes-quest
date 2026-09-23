"""WO101 reusable authored-mesh, tactile-atlas, skin and exact-clip helpers.

All authored coordinates are Blender +Z up/+Y forward. The GLB exporter maps
these to +Y up/-Z forward. No startup reset or addon changes are used.
"""
import bpy, bmesh, math, json, hashlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler

BASE=Path('/workspace/haynes-quest/rat-casino-cast/jackrabbit-drummer')
PARTS=[]; BONES={}; MATS=[]; CONTACTS=[]; SPEC={}; CURRENT=None
FPS=30

def setup(name,height,contact,duration,materials):
 global CURRENT,SPEC
 CURRENT=BASE/name;CURRENT.mkdir(parents=True,exist_ok=True)
 SPEC={'asset_id':name,'height':height,'contact_time_s':contact,'attack_duration_s':duration,'contact_fraction':contact/duration}
 if bpy.context.object and bpy.context.object.mode!='OBJECT':bpy.ops.object.mode_set(mode='OBJECT')
 for ob in list(bpy.data.objects):bpy.data.objects.remove(ob,do_unlink=True)
 for blocks in (bpy.data.meshes,bpy.data.armatures,bpy.data.materials,bpy.data.actions,bpy.data.collections):
  for block in list(blocks):blocks.remove(block)
 PARTS.clear();BONES.clear();MATS.clear();CONTACTS.clear()
 sc=bpy.context.scene;sc.unit_settings.system='METRIC';sc.unit_settings.scale_length=1;sc.render.fps=FPS
 image=bpy.data.images.load(str(CURRENT/'pigment.png'),check_existing=False);image.name=name+' original tactile 1024 atlas';image.pack()
 for label,rough,metal in materials:
  mat=bpy.data.materials.new(label);mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF')
  bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal;bs.inputs['Specular IOR Level'].default_value=.30
  tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;tex.extension='EXTEND'
  mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color']);MATS.append(mat)

def bone(name,point,parent='chest'):
 BONES[name]=(Vector(point),parent)

def uv_project(ob,tile):
 for layer in list(ob.data.uv_layers):ob.data.uv_layers.remove(layer)
 uv=ob.data.uv_layers.new(name='Original tactile atlas UV');uv.active_render=True
 points=[v.co for v in ob.data.vertices];lo=[min(p[k] for p in points) for k in range(3)];span=[max(.0001,max(p[k] for p in points)-lo[k]) for k in range(3)]
 for p in ob.data.polygons:
  k=max(range(3),key=lambda k:abs(p.normal[k]));axes=[a for a in range(3) if a!=k]
  for li in p.loop_indices:
   v=ob.data.vertices[ob.data.loops[li].vertex_index].co;u=(v[axes[0]]-lo[axes[0]])/span[axes[0]];vv=(v[axes[1]]-lo[axes[1]])/span[axes[1]]
   uv.data[li].uv=((tile%4+.025+.950*u)/4,(3-tile//4+.025+.950*vv)/4)

def finish(ob,name,tile,bn,mat=0,smooth=True,weights=None):
 ob.name=name
 for p in ob.data.polygons:p.use_smooth=smooth
 uv_project(ob,tile);ob.data.materials.append(MATS[mat]);groupnames=set()
 for v in ob.data.vertices:
  w=weights(v.co) if weights else {bn:1.0}
  total=sum(w.values());assert total>0
  for b,value in w.items():
   if value<=0:continue
   if b not in groupnames:
    ob.vertex_groups.new(name=b);groupnames.add(b)
   ob.vertex_groups[b].add([v.index],value/total,'REPLACE')
 ob['source_part']=name;ob['rigid_weight']=bn if not weights else 'weighted';ob['atlas_tile']=tile
 PARTS.append(ob);ob.select_set(False);return ob

def mesh(name,verts,faces,tile,bn='chest',mat=0,smooth=True,weights=None):
 data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
 bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(data);bm.free()
 ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob)
 return finish(ob,name,tile,bn,mat,smooth,weights)

def box(name,c,s,tile,bn='chest',bevel=.008,segments=3,mat=0,rot=(0,0,0),weights=None):
 bpy.ops.mesh.primitive_cube_add(size=1);ob=bpy.context.object;ob.scale=s
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=ob.modifiers.new('Softly tailored toy edge','BEVEL');mod.width=bevel;mod.segments=segments if segments>=5 else min(segments,2);bpy.ops.object.modifier_apply(modifier=mod.name)
 tr=Matrix.Translation(c)@Euler(rot).to_matrix().to_4x4()
 for v in ob.data.vertices:v.co=tr@v.co
 finish(ob,name,tile,bn,mat,True,weights)
 if bevel:
  bpy.context.view_layer.objects.active=ob;mod=ob.modifiers.new('Weighted authored face normals','WEIGHTED_NORMAL');mod.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 return ob

def rings(name,rr,tile,bn='chest',mat=0,caps=True,smooth=True,weights=None):
 n=len(rr[0]);verts=[p for r in rr for p in r];faces=[]
 for j in range(len(rr)-1):
  for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
 if caps:faces.extend([tuple(range(n-1,-1,-1)),tuple((len(rr)-1)*n+i for i in range(n))])
 return mesh(name,verts,faces,tile,bn,mat,smooth,weights)

def ellipsoid(name,c,s,tile,bn='chest',mat=0,n=24,r=12,rot=(0,0,0),weights=None):
 n=max(8,round(n*.72/2)*2);r=max(4,round(r*.72))
 tr=Matrix.Translation(c)@Euler(rot).to_matrix().to_4x4();rr=[]
 for j in range(r+1):
  a=-math.pi/2+math.pi*j/r; ca=max(.00015,math.cos(a))
  rr.append([tr@Vector((s[0]*ca*math.cos(math.tau*i/n),s[1]*ca*math.sin(math.tau*i/n),s[2]*math.sin(a))) for i in range(n)])
 return rings(name,rr,tile,bn,mat,True,True,weights)

def lathe(name,c,profile,tile,bn='chest',mat=0,n=32,ellipse=(1,1),caps=True,weights=None):
 return rings(name,[[(c[0]+radius*ellipse[0]*math.cos(math.tau*i/n),c[1]+radius*ellipse[1]*math.sin(math.tau*i/n),c[2]+z) for i in range(n)] for z,radius in profile],tile,bn,mat,caps,True,weights)

def tube(name,points,radii,tile,bn='chest',mat=0,n=10,weights=None):
 n=max(5,round(n*.8))
 pts=[Vector(p) for p in points];rr=[]
 for i,p in enumerate(pts):
  tangent=(pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)]).normalized()
  hint=Vector((0,1,0)) if abs(tangent.y)<.9 else Vector((1,0,0))
  u=tangent.cross(hint).normalized();v=tangent.cross(u).normalized();radius=radii[i] if isinstance(radii,(tuple,list)) else radii
  rr.append([p+radius*(math.cos(math.tau*j/n)*u+math.sin(math.tau*j/n)*v) for j in range(n)])
 return rings(name,rr,tile,bn,mat,True,True,weights)

def curve(name,points,radii,tile,bn='chest',mat=0,n=10,steps=5,weights=None):
 """Catmull-Rom center line; actual closed low-poly tube, no curve export dependency."""
 p=[Vector(x) for x in points];r=radii if isinstance(radii,(tuple,list)) else [radii]*len(p);out=[];rr=[]
 for i in range(len(p)-1):
  a,b,c,d=p[max(0,i-1)],p[i],p[i+1],p[min(i+2,len(p)-1)]
  for j in range(steps):
   t=j/steps;out.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t));rr.append(r[i]*(1-t)+r[i+1]*t)
 out.append(p[-1]);rr.append(r[-1]);return tube(name,out,rr,tile,bn,mat,n,weights)

def prism(name,poly,y,depth,tile,bn='chest',mat=0,bevel=0):
 n=len(poly);verts=[(x,yy,z) for yy in (y-depth/2,y+depth/2) for x,z in poly];faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
 faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n));ob=mesh(name,verts,faces,tile,bn,mat,False)
 if bevel:
  # Apply before final re-projection; new vertices inherit the single rigid group.
  bpy.context.view_layer.objects.active=ob;ob.select_set(True);mod=ob.modifiers.new('Rounded sculpt outline','BEVEL');mod.width=bevel;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name);uv_project(ob,tile)
  for p in ob.data.polygons:p.use_smooth=True
  ob.select_set(False)
 return ob

def ellipse_loop(name,c,rx,ry,radius,tile,bn='chest',mat=0,normal='z',n=48,tube_n=8):
 n=max(12,round(n*.75))
 if normal=='z':pts=[(c[0]+rx*math.cos(math.tau*i/n),c[1]+ry*math.sin(math.tau*i/n),c[2]) for i in range(n+1)]
 else:pts=[(c[0]+rx*math.cos(math.tau*i/n),c[1],c[2]+ry*math.sin(math.tau*i/n)) for i in range(n+1)]
 return tube(name,pts,radius,tile,bn,mat,tube_n)

def bow(name,c,size,tile,bn,mat=0,back=False):
 x,y,z=c;sign=-1 if back else 1
 for side in [-1,1]:
  ellipsoid(name+' | '+('left' if side<0 else 'right')+' folded loop',(x+side*size*.38,y,z+size*.06),(size*.42,size*.13,size*.31),tile,bn,mat,n=12,r=6,rot=(0,side*.18,0))
 box(name+' | sewn center knot',(x,y+sign*size*.035,z),(size*.22,size*.30,size*.25),tile,bn,bevel=size*.06,segments=2,mat=mat)

def contact(a,b,kind='overlap'):
 CONTACTS.append({'part_a':a,'part_b':b,'required':kind})

def pose(pb,rot=(0,0,0),loc=(0,0,0),scale=(1,1,1)):
 basis=pb.bone.matrix_local.to_3x3();pb.rotation_mode='QUATERNION';pb.rotation_quaternion=(basis.inverted()@Euler(rot).to_matrix()@basis).to_quaternion();pb.location=basis.inverted()@Vector(loc);pb.scale=(scale[0],scale[2],scale[1])
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
def bell(t,c,w):return smooth(1-abs(t-c)/w)
