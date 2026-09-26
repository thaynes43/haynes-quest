"""WO111 rival-mayor mesh, atlas-UV and skin helpers.

Adapted from the WO111 gadget-helper / honk-bus helpers (rigid parts plus
blended weights, per-face atlas tiles, bisected paint bands) with additions
for this character: elliptical lathes, clamped cubic B-spline paths that match
the approved blockout's NURBS curves, solid ribbons laid on a surface, and an
explicit transform for parts authored in a local frame (hat, remote, rosette).

All authored coordinates are Blender +Z up / +Y forward, character right = +X.
The glTF exporter maps them to +Y up / -Z forward. No startup reset or addon
changes are used.
"""
import bpy, bmesh, math
from pathlib import Path
from mathutils import Vector, Matrix, Euler

PARTS=[]; MATS=[]; ROOT=None
GRID=4
# UVs use the centre 76% of each 256 px tile so mip levels never bleed a
# neighbouring colour into a part.
TILE_INSET=.12; TILE_SPAN=.76

def setup(root,materials,atlas_name):
 global ROOT
 ROOT=Path(root)
 if bpy.context.object and bpy.context.object.mode!='OBJECT':bpy.ops.object.mode_set(mode='OBJECT')
 for ob in list(bpy.data.objects):bpy.data.objects.remove(ob,do_unlink=True)
 for blocks in (bpy.data.meshes,bpy.data.armatures,bpy.data.materials,bpy.data.actions,bpy.data.collections,bpy.data.images,bpy.data.textures,bpy.data.curves,bpy.data.cameras,bpy.data.lights,bpy.data.node_groups,bpy.data.texts,bpy.data.linestyles):
  for block in list(blocks):blocks.remove(block)
 bpy.data.orphans_purge(do_local_ids=True,do_linked_ids=True,do_recursive=True)
 PARTS.clear();MATS.clear()
 sc=bpy.context.scene;sc.unit_settings.system='METRIC';sc.unit_settings.scale_length=1
 image=bpy.data.images.load(str(ROOT/'pigment.png'),check_existing=False);image.name=atlas_name;image.pack()
 for label,rough in materials:
  mat=bpy.data.materials.new(label);mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF')
  bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=0;bs.inputs['Specular IOR Level'].default_value=.30
  tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;tex.extension='EXTEND'
  mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color']);MATS.append(mat)

def tile_uv(t,u,v):
 return ((t%GRID+TILE_INSET+TILE_SPAN*u)/GRID,(GRID-1-t//GRID+TILE_INSET+TILE_SPAN*v)/GRID)

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
   v=ob.data.vertices[ob.data.loops[li].vertex_index].co
   uv.data[li].uv=tile_uv(t,(v[axes[0]]-lo[axes[0]])/span[axes[0]],(v[axes[1]]-lo[axes[1]])/span[axes[1]])

def finish(ob,name,tile,bn,mat=0,smooth=True,weights=None,face_tile=None):
 ob.name=name
 for p in ob.data.polygons:p.use_smooth=smooth
 uv_project(ob,tile,face_tile);ob.data.materials.append(MATS[mat]);groupnames=set()
 for v in ob.data.vertices:
  w=weights(v.co) if weights else {bn:1.0}
  w={b:x for b,x in w.items() if x>1e-4}
  # Keep the strongest four influences (contract: one skin, <= 4 per vertex).
  w=dict(sorted(w.items(),key=lambda kv:-kv[1])[:4])
  total=sum(w.values());assert total>0,(name,v.co)
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

def mesh(name,verts,faces,tile,bn='body',mat=0,smooth=True,weights=None,face_tile=None,planes=None,transform=None):
 if transform is not None:verts=[tuple(transform@Vector(v)) for v in verts]
 data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
 bm=bmesh.new();bm.from_mesh(data);bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-7);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(data);bm.free()
 cut(data,planes)
 ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob)
 return finish(ob,name,tile,bn,mat,smooth,weights,face_tile)

def weighted_normals(ob):
 bpy.context.view_layer.objects.active=ob;ob.select_set(True)
 mod=ob.modifiers.new('Weighted authored face normals','WEIGHTED_NORMAL');mod.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 ob.select_set(False)

def box(name,c,s,tile,bn='body',bevel=.008,segments=2,mat=0,rot=(0,0,0),weights=None,transform=None,face_tile=None):
 bpy.ops.mesh.primitive_cube_add(size=1);ob=bpy.context.object;ob.scale=s
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=ob.modifiers.new('Softly tailored toy edge','BEVEL');mod.width=bevel;mod.segments=segments;bpy.ops.object.modifier_apply(modifier=mod.name)
 tr=Matrix.Translation(c)@Euler(rot).to_matrix().to_4x4()
 if transform is not None:tr=transform@tr
 for v in ob.data.vertices:v.co=tr@v.co
 finish(ob,name,tile,bn,mat,True,weights,face_tile)
 if bevel:weighted_normals(ob)
 return ob

def rings(name,rr,tile,bn='body',mat=0,caps=True,smooth=True,weights=None,face_tile=None,planes=None,closed=True,transform=None):
 n=len(rr[0]);verts=[p for r in rr for p in r];faces=[]
 m=n if closed else n-1
 for j in range(len(rr)-1):
  for i in range(m):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
 if caps is True:caps=(True,True)
 if caps:
  if caps[0]:faces.append(tuple(range(n-1,-1,-1)))
  if caps[1]:faces.append(tuple((len(rr)-1)*n+i for i in range(n)))
 return mesh(name,verts,faces,tile,bn,mat,smooth,weights,face_tile,planes,transform)

def ellipsoid(name,c,s,tile,bn='body',mat=0,n=24,r=12,rot=(0,0,0),weights=None,transform=None,face_tile=None):
 n=max(6,round(n/2)*2);r=max(4,round(r))
 tr=Matrix.Translation(c)@Euler(rot).to_matrix().to_4x4()
 if transform is not None:tr=transform@tr
 verts=[tuple(tr@Vector((0,0,-s[2])))]
 for j in range(1,r):
  a=-math.pi/2+math.pi*j/r;ca=math.cos(a)
  verts+=[tuple(tr@Vector((s[0]*ca*math.cos(math.tau*i/n),s[1]*ca*math.sin(math.tau*i/n),s[2]*math.sin(a)))) for i in range(n)]
 verts.append(tuple(tr@Vector((0,0,s[2]))))
 faces=[(0,1+(i+1)%n,1+i) for i in range(n)]
 for j in range(r-2):
  for i in range(n):faces.append((1+j*n+i,1+j*n+(i+1)%n,1+(j+1)*n+(i+1)%n,1+(j+1)*n+i))
 top=len(verts)-1;base=1+(r-2)*n
 faces+=[(base+i,base+(i+1)%n,top) for i in range(n)]
 return mesh(name,verts,faces,tile,bn,mat,True,weights,face_tile)

def lathe(name,c,profile,tile,bn='body',mat=0,n=32,axis='z',caps=True,weights=None,face_tile=None,closed_profile=False,ey=1.0,transform=None,planes=None):
 """Surface of revolution; profile is (distance along axis, radius); ey scales the second radial axis."""
 rr=[]
 for d,radius in profile:
  row=[]
  for i in range(n):
   a=math.tau*i/n;u=radius*math.cos(a);v=radius*ey*math.sin(a)
   if axis=='z':p=(c[0]+u,c[1]+v,c[2]+d)
   elif axis=='x':p=(c[0]+d,c[1]+u,c[2]+v)
   else:p=(c[0]+u,c[1]+d,c[2]+v)
   row.append(p)
  rr.append(row)
 if closed_profile:rr.append(rr[0]);caps=False
 return rings(name,rr,tile,bn,mat,caps,True,weights,face_tile,planes,True,transform)

def bspline(points,samples):
 """Clamped uniform cubic B-spline (Blender NURBS, endpoint on, order 4, unit weights)."""
 P=[Vector(p) for p in points];k=min(4,len(P));nctrl=len(P);deg=k-1
 knots=[0]*k+list(range(1,nctrl-deg))+[nctrl-deg]*k
 def basis(i,d,t):
  if d==0:
   if knots[i]<=t<knots[i+1] or (t==knots[-1] and knots[i]<t<=knots[i+1]):return 1.0
   return 0.0
  a=0.0;b=0.0
  if knots[i+d]!=knots[i]:a=(t-knots[i])/(knots[i+d]-knots[i])*basis(i,d-1,t)
  if knots[i+d+1]!=knots[i+1]:b=(knots[i+d+1]-t)/(knots[i+d+1]-knots[i+1])*basis(i+1,d-1,t)
  return a+b
 out=[];tmax=knots[-1]
 for s in range(samples+1):
  t=tmax*s/samples;p=Vector();wsum=0
  for i in range(nctrl):
   b=basis(i,deg,t);p+=P[i]*b;wsum+=b
  out.append(p/wsum if wsum>0 else P[-1])
 return out

def bspline_radii(radii,samples):
 """Radius per sample, interpolated the same way as the control points."""
 return [p.x for p in bspline([(r,0,0) for r in radii],samples)]

def catmull(points,steps):
 p=[Vector(x) for x in points];out=[]
 for i in range(len(p)-1):
  a,b,c,d=p[max(0,i-1)],p[i],p[i+1],p[min(i+2,len(p)-1)]
  for j in range(steps):
   t=j/steps;out.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
 out.append(p[-1]);return out

def frames(pts,hint=(0,1,0)):
 """Parallel-transport tangent frames starting from a hint axis (no flips on curls)."""
 out=[];h=Vector(hint)
 t0=(pts[1]-pts[0]).normalized();u=t0.cross(h)
 if u.length<1e-6:u=t0.cross(Vector((1,0,0)))
 u.normalize()
 for i,p in enumerate(pts):
  tangent=(pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)]).normalized()
  u=(u-tangent*u.dot(tangent))
  if u.length<1e-8:u=tangent.cross(h)
  u.normalize();v=u.cross(tangent).normalized();out.append((tangent,u,v))
 return out

def tube(name,points,radii,tile,bn='body',mat=0,n=10,weights=None,hint=(0,1,0),caps=True,squash=1.0,face_tile=None,transform=None):
 pts=[Vector(p) for p in points];rr=[]
 for i,(p,(t,u,v)) in enumerate(zip(pts,frames(pts,hint))):
  radius=radii[i] if isinstance(radii,(tuple,list)) else radii
  rr.append([p+radius*(math.cos(math.tau*j/n)*u+squash*math.sin(math.tau*j/n)*v) for j in range(n)])
 return rings(name,rr,tile,bn,mat,caps,True,weights,face_tile,None,True,transform)

def arclength(pts):
 s=[0.0]
 for a,b in zip(pts,pts[1:]):s.append(s[-1]+(b-a).length)
 return s

def plate(name,outline,depth,tile,bn='body',mat=0,bevel=.012,segments=2,transform=None,face_tile=None,weights=None):
 """Extruded rounded plate from an (x, z) outline centred on y=0; optional placement matrix."""
 n=len(outline);verts=[(x,yy,z) for yy in (-depth/2,depth/2) for x,z in outline];faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
 faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
 data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
 bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bmesh.ops.triangulate(bm,faces=[f for f in bm.faces if len(f.verts)>4],quad_method='BEAUTY',ngon_method='BEAUTY');bm.to_mesh(data);bm.free()
 ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob)
 if bevel:
  bpy.context.view_layer.objects.active=ob;ob.select_set(True)
  mod=ob.modifiers.new('Rounded sculpt outline','BEVEL');mod.width=bevel;mod.segments=segments;mod.limit_method='ANGLE';mod.angle_limit=.9;bpy.ops.object.modifier_apply(modifier=mod.name)
  ob.select_set(False)
 if transform is not None:
  for v in ob.data.vertices:v.co=transform@v.co
 finish(ob,name,tile,bn,mat,True,weights,face_tile)
 weighted_normals(ob)
 return ob

def ribbon(name,centers,normals,widths,thickness,tile,bn='body',mat=0,closed=True,weights=None,binormals=None,face_tile=None):
 """Solid flat strap: per sample a centre on a surface, the surface normal and a width direction."""
 rr=[]
 for i,(p,N) in enumerate(zip(centers,normals)):
  w=binormals[i];hw=widths[i] if isinstance(widths,(list,tuple)) else widths
  rr.append([p+w*hw,p+w*hw+N*thickness,p-w*hw+N*thickness,p-w*hw])
 n=4;verts=[q for r in rr for q in r];faces=[]
 segs=len(rr) if closed else len(rr)-1
 for j in range(segs):
  a=j;b=(j+1)%len(rr)
  for i in range(n):faces.append((a*n+i,a*n+(i+1)%n,b*n+(i+1)%n,b*n+i))
 if not closed:
  faces+=[(3,2,1,0),((len(rr)-1)*n+0,(len(rr)-1)*n+1,(len(rr)-1)*n+2,(len(rr)-1)*n+3)]
 return mesh(name,verts,faces,tile,bn,mat,True,weights,face_tile)

def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
def bell(t,c,w):return smooth(1-abs(t-c)/w)
def interp(profile,z):
 if z<=profile[0][0]:return profile[0][1]
 for (z0,r0),(z1,r1) in zip(profile,profile[1:]):
  if z0<=z<=z1:return r0+(r1-r0)*(z-z0)/(z1-z0)
 return profile[-1][1]
