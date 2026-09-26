"""WO111 bin-chicken mesh, atlas-UV and skin helpers.

Adapted from the WO111 rival-mayor / gadget-helper / honk-bus helpers (rigid parts plus
blended weights, per-face atlas tiles, bisected paint bands). Additions for this character:
a per-face tile attribute that survives the bmesh clean-up, a general lathe along any axis
(the blockout's egg body, wings and chip cone are tilted lathes), a band callback per face,
and a solid cupped petal for the banana-peel flaps.

All authored coordinates are Blender +Z up / +Y forward, character right = +X.
The glTF exporter maps them to +Y up / -Z forward. No startup reset or addon changes are used.
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
 attr=ob.data.attributes.get('atlas_tile')
 tiles=None
 if attr is not None:
  tiles=[0]*len(ob.data.polygons);attr.data.foreach_get('value',tiles)
 for layer in list(ob.data.uv_layers):ob.data.uv_layers.remove(layer)
 uv=ob.data.uv_layers.new(name='Original painted atlas UV');uv.active_render=True
 points=[v.co for v in ob.data.vertices];lo=[min(p[k] for p in points) for k in range(3)];span=[max(.0001,max(p[k] for p in points)-lo[k]) for k in range(3)]
 for p in ob.data.polygons:
  t=tile
  if tiles is not None and tiles[p.index]>=0:t=tiles[p.index]
  if face_tile:
   chosen=face_tile(p.center,p.normal)
   if chosen is not None:t=chosen
  k=max(range(3),key=lambda k:abs(p.normal[k]));axes=[a for a in range(3) if a!=k]
  for li in p.loop_indices:
   v=ob.data.vertices[ob.data.loops[li].vertex_index].co
   uv.data[li].uv=tile_uv(t,(v[axes[0]]-lo[axes[0]])/span[axes[0]],(v[axes[1]]-lo[axes[1]])/span[axes[1]])
 if attr is not None:ob.data.attributes.remove(ob.data.attributes['atlas_tile'])

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

def mesh(name,verts,faces,tile,bn='hips',mat=0,smooth=True,weights=None,face_tile=None,planes=None,transform=None,tiles=None,merge=True):
 if transform is not None:verts=[tuple(transform@Vector(v)) for v in verts]
 data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
 if tiles is not None:
  assert len(tiles)==len(data.polygons),(name,len(tiles),len(data.polygons))
  a=data.attributes.new('atlas_tile','INT','FACE');a.data.foreach_set('value',[int(t) for t in tiles])
 bm=bmesh.new();bm.from_mesh(data)
 if merge:bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-7)
 bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(data);bm.free()
 if tiles is not None:assert data.attributes.get('atlas_tile') is not None,(name,'tile attribute lost')
 cut(data,planes)
 ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob)
 return finish(ob,name,tile,bn,mat,smooth,weights,face_tile)

def weighted_normals(ob):
 bpy.context.view_layer.objects.active=ob;ob.select_set(True)
 mod=ob.modifiers.new('Weighted authored face normals','WEIGHTED_NORMAL');mod.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 ob.select_set(False)

def box(name,c,s,tile,bn='hips',bevel=.004,segments=1,mat=0,rot=(0,0,0),weights=None,transform=None,face_tile=None):
 bpy.ops.mesh.primitive_cube_add(size=1);ob=bpy.context.object;ob.scale=s
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=ob.modifiers.new('Soft chip edge','BEVEL');mod.width=bevel;mod.segments=segments;bpy.ops.object.modifier_apply(modifier=mod.name)
 tr=Matrix.Translation(c)@(rot.to_matrix().to_4x4() if hasattr(rot,'to_matrix') else Euler(rot).to_matrix().to_4x4())
 if transform is not None:tr=transform@tr
 for v in ob.data.vertices:v.co=tr@v.co
 finish(ob,name,tile,bn,mat,True,weights,face_tile)
 if bevel:weighted_normals(ob)
 return ob

def rings(name,rr,tile,bn='hips',mat=0,caps=True,smooth=True,weights=None,face_tile=None,planes=None,closed=True,transform=None,tiles=None):
 n=len(rr[0]);verts=[p for r in rr for p in r];faces=[]
 m=n if closed else n-1
 for j in range(len(rr)-1):
  for i in range(m):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
 if caps is True:caps=(True,True)
 if caps:
  if caps[0]:faces.append(tuple(range(n-1,-1,-1)))
  if caps[1]:faces.append(tuple((len(rr)-1)*n+i for i in range(n)))
 if tiles is not None:
  body=list(tiles);assert len(body)==(len(rr)-1)*m,(name,len(body),(len(rr)-1)*m)
  if caps:
   if caps[0]:body.append(body[0])
   if caps[1]:body.append(body[-1])
  tiles=body
 return mesh(name,verts,faces,tile,bn,mat,smooth,weights,face_tile,planes,transform,tiles)

def ellipsoid(name,c,s,tile,bn='hips',mat=0,n=24,r=12,rot=(0,0,0),weights=None,transform=None,face_tile=None):
 n=max(6,round(n/2)*2);r=max(3,round(r))
 tr=Matrix.Translation(c)@(rot.to_matrix().to_4x4() if hasattr(rot,'to_matrix') else Euler(rot).to_matrix().to_4x4())
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

def axis_frame(a,b,up=(0,0,1)):
 """Matrix whose local Z runs from a toward b and whose local Y leans toward `up` (blockout to_track_quat('Z','Y'))."""
 a=Vector(a);d=(Vector(b)-a).normalized();u=Vector(up)
 y=(u-d*u.dot(d))
 if y.length<1e-6:y=Vector((0,1,0))-d*d.y
 y.normalize();x=y.cross(d).normalized()
 return Matrix.Translation(a)@Matrix((x,y,d)).transposed().to_4x4()

def lathe(name,profile,tile,bn='hips',mat=0,a=(0,0,0),b=(0,0,1),ey=1.0,n=24,band=None,weights=None,caps=True,up=(0,0,1),planes=None,transform=None):
 """Surface of revolution along the a->b axis. profile: (distance along the axis, radius); ey scales the
 radial axis that leans toward `up`. band(t_fraction, angle_fraction) -> tile per face (or None)."""
 M=axis_frame(a,b,up)
 if transform is not None:M=transform@M
 L=profile[-1][0]-profile[0][0];rr=[];tiles=[] if band else None
 for d,radius in profile:
  rr.append([tuple(M@Vector((radius*math.cos(math.tau*i/n),radius*ey*math.sin(math.tau*i/n),d))) for i in range(n)])
 if band:
  for j in range(len(profile)-1):
   tm=((profile[j][0]+profile[j+1][0])/2-profile[0][0])/L if L else 0
   for i in range(n):
    t=band(tm,(i+.5)/n);tiles.append(tile if t is None else t)
 return rings(name,rr,tile,bn,mat,caps,True,weights,None,planes,True,None,tiles)

def catmull(points,steps):
 p=[Vector(x) for x in points];out=[]
 for i in range(len(p)-1):
  a,b,c,d=p[max(0,i-1)],p[i],p[i+1],p[min(i+2,len(p)-1)]
  for j in range(steps):
   t=j/steps;out.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
 out.append(p[-1]);return out

def catmull_ext(points,steps):
 """Catmull-Rom with reflected end tangents (the blockout's sweep path)."""
 P=[Vector(p) for p in points];P=[P[0]+(P[0]-P[1])]+P+[P[-1]+(P[-1]-P[-2])];out=[]
 for i in range(1,len(P)-2):
  p0,p1,p2,p3=P[i-1],P[i],P[i+1],P[i+2]
  for s in range(steps):
   t=s/steps;out.append(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t**3))
 out.append(P[-2]);return out

def arclength(pts):
 s=[0.0]
 for a,b in zip(pts,pts[1:]):s.append(s[-1]+(b-a).length)
 return s

def interp(profile,z):
 if z<=profile[0][0]:return profile[0][1]
 for (z0,r0),(z1,r1) in zip(profile,profile[1:]):
  if z0<=z<=z1:return r0+(r1-r0)*(z-z0)/(z1-z0)
 return profile[-1][1]

def sweep(name,path,radii,tile,bn='hips',mat=0,n=10,weights=None,up=(0,0,1),flat=1.0,caps=True,band=None,face_tile=None):
 """Tube along sampled points with rotation-minimising frames started from `up` (blockout sweep).
 flat scales the cross-section along the frame axis nearest `up`; radii is a list over arc fraction
 (interpolated) or one number; band(u) -> tile per ring segment."""
 pts=[Vector(p) for p in path];m=len(pts);acc=arclength(pts);total=acc[-1]
 T=(pts[1]-pts[0]).normalized();U=Vector(up);N=U-U.dot(T)*T
 if N.length<1e-4:N=T.cross(Vector((1,0,0)))
 N.normalize();rr=[]
 for i in range(m):
  if i>0:
   T=(pts[min(i+1,m-1)]-pts[i-1]).normalized();N=(N-N.dot(T)*T).normalized()
  B=T.cross(N);u=acc[i]/total
  if isinstance(radii,(list,tuple)):
   k=u*(len(radii)-1);k0=min(int(k),len(radii)-2);r=radii[k0]+(radii[k0+1]-radii[k0])*(k-k0)
  else:r=radii
  rr.append([tuple(pts[i]+r*(flat*math.cos(math.tau*j/n)*N+math.sin(math.tau*j/n)*B)) for j in range(n)])
 tiles=None
 if band:
  tiles=[]
  for i in range(m-1):
   t=band((acc[i]+acc[i+1])/2/total);tiles+=[tile if t is None else t]*n
 return rings(name,rr,tile,bn,mat,caps,True,weights,face_tile,None,True,None,tiles)

def petal(name,path,widths,centre,thick,cup,tile_out,tile_in,tile_tip,bn='peel',mat=0,tip_from=.9,weights=None,across=4):
 """Solid cupped strip (a banana-peel flap) along `path`: the outer face bulges away from `centre`
 by cup*width; the inner face sits `thick` inward. Returns (object, sampler(u,s)->(point,normal))."""
 C=Vector(centre);pts=[Vector(p) for p in path];m=len(pts);acc=arclength(pts);total=acc[-1]
 frames=[];S_prev=None
 for i,p in enumerate(pts):
  T=(pts[min(i+1,m-1)]-pts[max(i-1,0)]).normalized();out=(p-C);out=(out-out.dot(T)*T).normalized()
  S=T.cross(out)
  S=S_prev if (S.length<1e-5 and S_prev is not None) else S.normalized()
  if S_prev is not None and S.dot(S_prev)<0:S=-S
  S_prev=S;frames.append((T,out,S,interp(widths,acc[i]/total)))
 ss=[-1+2*k/(across-1) for k in range(across)]
 def outer(i,s):
  T,out,S,w=frames[i];return pts[i]+S*s*w/2+out*cup*w*(1-s*s)
 verts=[];tiles=[];faces=[]
 for i in range(m):
  T,out,S,w=frames[i]
  for s in ss:verts.append(tuple(outer(i,s)))
  for s in ss:verts.append(tuple(outer(i,s)-out*thick))
 K=across;row=2*K
 def tip(i):return (acc[i]+acc[i+1])/2/total>tip_from
 for i in range(m-1):
  a=i*row;b=(i+1)*row;tt=tip(i)
  for k in range(K-1):
   faces.append((a+k,a+k+1,b+k+1,b+k));tiles.append(tile_tip if tt else tile_out)
   faces.append((a+K+k+1,a+K+k,b+K+k,b+K+k+1));tiles.append(tile_tip if tt else tile_in)
  faces.append((a+K,a,b,b+K));tiles.append(tile_tip if tt else tile_out)
  faces.append((a+K-1,a+2*K-1,b+2*K-1,b+K-1));tiles.append(tile_tip if tt else tile_out)
 faces.append(tuple(list(range(0,K))+list(range(2*K-1,K-1,-1))));tiles.append(tile_out)
 e=(m-1)*row;faces.append(tuple(list(range(e+K-1,e-1,-1))+list(range(e+K,e+2*K))));tiles.append(tile_tip)
 ob=mesh(name,verts,faces,tile_out,bn,mat,True,weights,None,None,None,tiles,merge=False)
 def sample(u,s):
  x=u*total;i=max(0,min(m-2,max(k for k in range(m) if acc[k]<=x)))
  f=(x-acc[i])/max(1e-9,acc[i+1]-acc[i]);p=outer(i,s).lerp(outer(i+1,s),f)
  T,out,S,w=frames[i];return p,out
 return ob,sample,pts,acc

def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
def bell(t,c,w):return smooth(1-abs(t-c)/w)
