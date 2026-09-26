"""WO111 gadget-helper mesh, atlas UV and skin helpers.

Adapted from the WO099/WO111 honk-bus helpers: the same rigid-part plus
blended-weight construction, with superellipse lofts for the toolbox shell,
strap sweeps for the handle, a ribbed accordion hose and per-face atlas tiles
so painted stripes follow real bisected mesh edges instead of stair steps.

All authored coordinates are Blender +Z up/+Y forward. The GLB exporter maps
these to +Y up/-Z forward. No startup reset or addon changes are used.
"""
import bpy, bmesh, math
from pathlib import Path
from mathutils import Vector, Matrix, Euler

BASE=Path('/workspace/haynes-quest/family-eras/gadget-helper')
PARTS=[]; MATS=[]; CURRENT=None
# UVs use the centre 76% of each 256px tile so mip levels never bleed a
# neighbouring colour into a part.
TILE_INSET=.12; TILE_SPAN=.76

def setup(name,materials):
 global CURRENT
 CURRENT=BASE/name;CURRENT.mkdir(parents=True,exist_ok=True)
 if bpy.context.object and bpy.context.object.mode!='OBJECT':bpy.ops.object.mode_set(mode='OBJECT')
 for ob in list(bpy.data.objects):bpy.data.objects.remove(ob,do_unlink=True)
 for blocks in (bpy.data.meshes,bpy.data.armatures,bpy.data.materials,bpy.data.actions,bpy.data.collections,bpy.data.images,bpy.data.textures,bpy.data.curves,bpy.data.cameras,bpy.data.lights,bpy.data.node_groups,bpy.data.texts):
  for block in list(blocks):blocks.remove(block)
 bpy.data.orphans_purge(do_local_ids=True,do_linked_ids=True,do_recursive=True)
 PARTS.clear();MATS.clear()
 sc=bpy.context.scene;sc.unit_settings.system='METRIC';sc.unit_settings.scale_length=1
 image=bpy.data.images.load(str(CURRENT/'pigment.png'),check_existing=False);image.name='gadget-helper original painted 1024 atlas';image.pack()
 for label,rough in materials:
  mat=bpy.data.materials.new(label);mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF')
  bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=0;bs.inputs['Specular IOR Level'].default_value=.30
  tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;tex.extension='EXTEND'
  mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color']);MATS.append(mat)

def uv_project(ob,tile,face_tile=None):
 for layer in list(ob.data.uv_layers):ob.data.uv_layers.remove(layer)
 uv=ob.data.uv_layers.new(name='Original painted atlas UV');uv.active_render=True
 points=[v.co for v in ob.data.vertices];lo=[min(p[k] for p in points) for k in range(3)];span=[max(.0001,max(p[k] for p in points)-lo[k]) for k in range(3)]
 for p in ob.data.polygons:
  t=tile
  if face_tile:
   chosen=face_tile(p.center,p.normal)
   if chosen is not None:t=chosen
  k=max(range(3),key=lambda k:abs(p.normal[k]));axes=[a for a in range(3) if a!=k]
  for li in p.loop_indices:
   v=ob.data.vertices[ob.data.loops[li].vertex_index].co;u=(v[axes[0]]-lo[axes[0]])/span[axes[0]];vv=(v[axes[1]]-lo[axes[1]])/span[axes[1]]
   uv.data[li].uv=((t%4+TILE_INSET+TILE_SPAN*u)/4,(3-t//4+TILE_INSET+TILE_SPAN*vv)/4)

def finish(ob,name,tile,bn,mat=0,smooth=True,weights=None,face_tile=None):
 ob.name=name
 for p in ob.data.polygons:p.use_smooth=smooth
 uv_project(ob,tile,face_tile);ob.data.materials.append(MATS[mat]);groupnames=set()
 for v in ob.data.vertices:
  w=weights(v.co) if weights else {bn:1.0}
  w={b:x for b,x in w.items() if x>1e-4}
  total=sum(w.values());assert total>0
  for b,value in w.items():
   if b not in groupnames:
    ob.vertex_groups.new(name=b);groupnames.add(b)
   ob.vertex_groups[b].add([v.index],value/total,'REPLACE')
 ob['source_part']=name;ob['rigid_weight']=bn if not weights else 'weighted';ob['atlas_tile']=tile
 PARTS.append(ob);ob.select_set(False);return ob

def cut(data,planes):
 """Bisect real edges along (point, normal) planes so painted bands are crisp."""
 if not planes:return
 bm=bmesh.new();bm.from_mesh(data)
 for co,no in planes:
  bmesh.ops.bisect_plane(bm,geom=bm.verts[:]+bm.edges[:]+bm.faces[:],plane_co=Vector(co),plane_no=Vector(no).normalized(),dist=1e-6)
 bm.to_mesh(data);bm.free();data.update()

def mesh(name,verts,faces,tile,bn='body',mat=0,smooth=True,weights=None,face_tile=None,planes=None):
 data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
 bm=bmesh.new();bm.from_mesh(data);bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-7);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(data);bm.free()
 cut(data,planes)
 ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob)
 return finish(ob,name,tile,bn,mat,smooth,weights,face_tile)

def soften(ob,width,segments=2,angle=.6):
 """Rounded toy edges on a flat-sided solid, then weighted authored normals."""
 bpy.context.view_layer.objects.active=ob;ob.select_set(True)
 mod=ob.modifiers.new('Soft toy edge','BEVEL');mod.width=width;mod.segments=segments;mod.limit_method='ANGLE';mod.angle_limit=angle;bpy.ops.object.modifier_apply(modifier=mod.name)
 mod=ob.modifiers.new('Weighted authored face normals','WEIGHTED_NORMAL');mod.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 for p in ob.data.polygons:p.use_smooth=True
 ob.select_set(False)

def box(name,c,s,tile,bn='body',bevel=.008,segments=2,mat=0,rot=(0,0,0),weights=None):
 bpy.ops.mesh.primitive_cube_add(size=1);ob=bpy.context.object;ob.scale=s
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=ob.modifiers.new('Softly tailored toy edge','BEVEL');mod.width=bevel;mod.segments=segments;bpy.ops.object.modifier_apply(modifier=mod.name)
 tr=Matrix.Translation(c)@Euler(rot).to_matrix().to_4x4()
 for v in ob.data.vertices:v.co=tr@v.co
 finish(ob,name,tile,bn,mat,True,weights)
 if bevel:
  bpy.context.view_layer.objects.active=ob;mod=ob.modifiers.new('Weighted authored face normals','WEIGHTED_NORMAL');mod.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 return ob

def rings(name,rr,tile,bn='body',mat=0,caps=True,smooth=True,weights=None,face_tile=None,planes=None,closed=True):
 n=len(rr[0]);verts=[p for r in rr for p in r];faces=[]
 m=n if closed else n-1
 for j in range(len(rr)-1):
  for i in range(m):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
 if caps:faces.extend([tuple(range(n-1,-1,-1)),tuple((len(rr)-1)*n+i for i in range(n))])
 return mesh(name,verts,faces,tile,bn,mat,smooth,weights,face_tile,planes)

def ellipsoid(name,c,s,tile,bn='body',mat=0,n=24,r=12,rot=(0,0,0),weights=None):
 n=max(8,round(n/2)*2);r=max(4,round(r))
 tr=Matrix.Translation(c)@Euler(rot).to_matrix().to_4x4();rr=[]
 for j in range(r+1):
  a=-math.pi/2+math.pi*j/r; ca=max(.00015,math.cos(a))
  rr.append([tr@Vector((s[0]*ca*math.cos(math.tau*i/n),s[1]*ca*math.sin(math.tau*i/n),s[2]*math.sin(a))) for i in range(n)])
 return rings(name,rr,tile,bn,mat,True,True,weights)

def superellipse(a,b,e,t):
 c=math.cos(t);s=math.sin(t)
 return (a*math.copysign(abs(c)**(2/e),c),b*math.copysign(abs(s)**(2/e),s))

def superloft(name,c,a,b,e,profile,tile,bn='body',mat=0,n=40,caps=True,weights=None,face_tile=None,planes=None):
 """Rounded-rectangle toy shell: rings of a superellipse, scaled per height."""
 rr=[]
 for z,scale in profile:
  rr.append([(c[0]+x,c[1]+y,z) for x,y in (superellipse(a*scale,b*scale,e,math.tau*i/n) for i in range(n))])
 return rings(name,rr,tile,bn,mat,caps,True,weights,face_tile,planes)

def superloft_surface_y(a,b,e,x,scale=1.0):
 """Front surface depth of the superellipse shell at lateral x."""
 A=a*scale;B=b*scale;q=max(0.0,1-abs(x/A)**e)
 return B*q**(1/e)

def lathe(name,c,profile,tile,bn='body',mat=0,n=32,axis='z',caps=True,weights=None,face_tile=None,closed_profile=False):
 """Surface of revolution; profile is (distance along axis, radius)."""
 rr=[]
 for d,radius in profile:
  row=[]
  for i in range(n):
   a=math.tau*i/n;u=radius*math.cos(a);v=radius*math.sin(a)
   if axis=='z':p=(c[0]+u,c[1]+v,c[2]+d)
   elif axis=='x':p=(c[0]+d,c[1]+u,c[2]+v)
   else:p=(c[0]+u,c[1]+d,c[2]+v)
   row.append(p)
  rr.append(row)
 if closed_profile:rr.append(rr[0])
 return rings(name,rr,tile,bn,mat,caps,True,weights,face_tile)

def catmull(points,steps):
 p=[Vector(x) for x in points];out=[]
 for i in range(len(p)-1):
  a,b,c,d=p[max(0,i-1)],p[i],p[i+1],p[min(i+2,len(p)-1)]
  for j in range(steps):
   t=j/steps;out.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
 out.append(p[-1]);return out

def frames(pts,hint=(0,1,0)):
 """Tangent frames along a path; u in the path plane, v near the hint axis."""
 out=[];h=Vector(hint)
 for i,p in enumerate(pts):
  tangent=(pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)]).normalized()
  u=tangent.cross(h)
  if u.length<1e-6:u=tangent.cross(Vector((1,0,0)))
  u.normalize();v=u.cross(tangent).normalized();out.append((tangent,u,v))
 return out

def tube(name,points,radii,tile,bn='body',mat=0,n=10,weights=None,hint=(0,1,0),caps=True):
 pts=[Vector(p) for p in points];rr=[]
 for i,(p,(t,u,v)) in enumerate(zip(pts,frames(pts,hint))):
  radius=radii[i] if isinstance(radii,(tuple,list)) else radii
  rr.append([p+radius*(math.cos(math.tau*j/n)*u+math.sin(math.tau*j/n)*v) for j in range(n)])
 return rings(name,rr,tile,bn,mat,caps,True,weights)

def sweep(name,points,half_u,half_v,e,tile,bn='body',mat=0,n=16,weights=None,hint=(0,1,0),caps=True):
 """Rounded-rectangle strap swept along a path (handle strap)."""
 pts=[Vector(p) for p in points];rr=[]
 for p,(t,u,v) in zip(pts,frames(pts,hint)):
  rr.append([p+x*u+y*v for x,y in (superellipse(half_u,half_v,e,math.tau*j/n) for j in range(n))])
 return rings(name,rr,tile,bn,mat,caps,True,weights)

def arclength(pts):
 s=[0.0]
 for a,b in zip(pts,pts[1:]):s.append(s[-1]+(b-a).length)
 return [x/s[-1] for x in s],s[-1]

def plate(name,outline,y,depth,tile,bn='body',mat=0,bevel=.012,segments=2,transform=None,face_tile=None,planes=None,weights=None):
 """Extruded rounded plate from an (x, z) outline; optional placement matrix."""
 n=len(outline);verts=[(x,yy,z) for yy in (y-depth/2,y+depth/2) for x,z in outline];faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
 faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
 data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
 bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bmesh.ops.triangulate(bm,faces=[f for f in bm.faces if len(f.verts)>4],quad_method='BEAUTY',ngon_method='BEAUTY');bm.to_mesh(data);bm.free()
 ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob)
 if bevel:
  bpy.context.view_layer.objects.active=ob;ob.select_set(True)
  mod=ob.modifiers.new('Rounded sculpt outline','BEVEL');mod.width=bevel;mod.segments=segments;mod.limit_method='ANGLE';mod.angle_limit=.9;bpy.ops.object.modifier_apply(modifier=mod.name)
  ob.select_set(False)
 cut(ob.data,planes)
 if transform is not None:
  for v in ob.data.vertices:v.co=transform@v.co
 finish(ob,name,tile,bn,mat,True,weights,face_tile)
 bpy.context.view_layer.objects.active=ob;ob.select_set(True)
 mod=ob.modifiers.new('Weighted authored face normals','WEIGHTED_NORMAL');mod.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=mod.name);ob.select_set(False)
 return ob

def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
def bell(t,c,w):return smooth(1-abs(t-c)/w)
