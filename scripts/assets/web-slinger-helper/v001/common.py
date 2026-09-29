"""WO111 web-slinger-helper mesh, atlas-UV and skin helpers.

Adapted from the WO111 demon-band-idol / rival-mayor helpers (rigid parts plus blended weights, flat atlas tiles,
parts authored in a source frame and placed by a matrix). Projection regions are generalised: build.py registers
region functions that map a part's SOURCE coordinates (before its placement matrix) to atlas pixels, so the painted
details (paint.py) land exactly where the approved blockout's decals and web strands sit:

* FACE   front projection of the face ellipsoid (grin, teeth, tongue, blush, nose shade, mask edge ink);
* HOOD   azimuthal map of the hood from the crown (the dew-drop web);
* TF/TB  the torso front and back halves by lathe angle and height (the chest and back webs round the stars);
* EYE    eye-local front projection shared by both eyes (iris, pupil, glints);
* MITT   hand-local palm projection shared by both mittens (finger grooves).

All authored coordinates are Blender +Z up / +Y forward, character right = +X. The glTF exporter maps them to
+Y up / -Z forward.
"""
import bpy, bmesh, math
from pathlib import Path
from mathutils import Vector, Matrix, Euler

PARTS=[]; MATS=[]; ROOT=None
ATLAS=1024
REGIONS={}          # name -> fn(source Vector) -> (px, py) atlas pixels from the top-left
TILE_RECTS=[]       # tile index -> (x, y) top-left pixel of a 128 px flat tile

def setup(root,materials,atlas_path,atlas_name,tile_rects):
 global ROOT
 ROOT=Path(root)
 if bpy.context.object and bpy.context.object.mode!='OBJECT':bpy.ops.object.mode_set(mode='OBJECT')
 for ob in list(bpy.data.objects):bpy.data.objects.remove(ob,do_unlink=True)
 for coll in list(bpy.data.collections):bpy.data.collections.remove(coll)
 for blocks in (bpy.data.meshes,bpy.data.armatures,bpy.data.materials,bpy.data.actions,bpy.data.images,bpy.data.textures,bpy.data.curves,bpy.data.cameras,bpy.data.lights,bpy.data.node_groups,bpy.data.texts,bpy.data.linestyles,bpy.data.worlds):
  for block in list(blocks):blocks.remove(block)
 bpy.data.orphans_purge(do_local_ids=True,do_linked_ids=True,do_recursive=True)
 PARTS.clear();MATS.clear();TILE_RECTS[:]=tile_rects
 sc=bpy.context.scene;sc.unit_settings.system='METRIC';sc.unit_settings.scale_length=1
 image=bpy.data.images.load(str(atlas_path),check_existing=False);image.name=atlas_name;image.pack()
 for label,rough,glow in materials:
  mat=bpy.data.materials.new(label);mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF')
  bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=0;bs.inputs['Specular IOR Level'].default_value=.30
  tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;tex.extension='EXTEND';tex.interpolation='Linear'
  mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
  if glow:
   mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Emission Color']);bs.inputs['Emission Strength'].default_value=glow
  MATS.append(mat)

def tile_uv(t,u,v):
 x,y=TILE_RECTS[t]
 # the centre 50% of each tile: mip levels never bleed a neighbouring colour into a part
 return ((x+32+64*u)/ATLAS,1-(y+32+64*(1-v))/ATLAS)

def assign_uv(me,tile,face_tile=None,src=None):
 """Flat tiles use a tiny per-face planar spread inside the tile centre; region faces use their source projection."""
 for layer in list(me.uv_layers):me.uv_layers.remove(layer)
 uv=me.uv_layers.new(name='Original painted atlas UV');uv.active_render=True
 co=src if src is not None else [v.co.copy() for v in me.vertices]
 lo=[min(p[k] for p in co) for k in range(3)];span=[max(1e-4,max(p[k] for p in co)-lo[k]) for k in range(3)]
 for p in me.polygons:
  c=sum((co[i] for i in p.vertices),Vector())/len(p.vertices)
  n=(co[p.vertices[1]]-co[p.vertices[0]]).cross(co[p.vertices[2]]-co[p.vertices[0]])
  n=n.normalized() if n.length>1e-12 else Vector((0,0,1))
  t=tile
  if face_tile:
   chosen=face_tile(c,n)
   if chosen is not None:t=chosen
  if isinstance(t,str):
   fn=REGIONS[t]
   for li in p.loop_indices:
    px,py=fn(co[me.loops[li].vertex_index],c);uv.data[li].uv=(px/ATLAS,1-py/ATLAS)
   continue
  k=max(range(3),key=lambda k:abs(n[k]));axes=[a for a in range(3) if a!=k]
  for li in p.loop_indices:
   q=co[me.loops[li].vertex_index]
   uv.data[li].uv=tile_uv(t,(q[axes[0]]-lo[axes[0]])/span[axes[0]],(q[axes[1]]-lo[axes[1]])/span[axes[1]])

def finish(ob,name,tile,bn,mat=0,smooth=True,weights=None,face_tile=None,src=None):
 ob.name=name
 for p in ob.data.polygons:p.use_smooth=smooth
 assign_uv(ob.data,tile,face_tile,src);ob.data.materials.append(MATS[mat]);groupnames=set()
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
 ob['source_part']=name;ob['rigid_weight']=bn if not weights else 'weighted';ob['atlas_tile']=str(tile)
 PARTS.append(ob);ob.select_set(False);return ob

def mesh(name,verts,faces,tile,bn='chest',mat=0,smooth=True,weights=None,face_tile=None,transform=None,merge=True):
 """verts/faces in a source frame; UVs are computed from the source frame, then `transform` places the part."""
 data=bpy.data.meshes.new(name);data.from_pydata([tuple(v) for v in verts],[],faces);data.update()
 bm=bmesh.new();bm.from_mesh(data)
 if merge:bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-7)
 bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(data);bm.free()
 src=[v.co.copy() for v in data.vertices]
 if transform is not None:
  for v in data.vertices:v.co=transform@v.co
  if transform.determinant()<0:data.flip_normals()
 ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob)
 return finish(ob,name,tile,bn,mat,smooth,weights,face_tile,src)

def oriented(ob,center):
 """Recalc_face_normals can fail on open shells; force outward normals relative to a centre point."""
 me=ob.data;s=sum((Vector(p.center)-center).dot(p.normal) for p in me.polygons)
 if s<0:me.flip_normals()

def weighted_normals(ob):
 bpy.context.view_layer.objects.active=ob;ob.select_set(True)
 mod=ob.modifiers.new('Weighted authored face normals','WEIGHTED_NORMAL');mod.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 ob.select_set(False)

def rings(name,rr,tile,bn='chest',mat=0,caps=True,smooth=True,weights=None,face_tile=None,closed=True,transform=None,poles=None):
 """Stacked vertex rings; caps as n-gons, or `poles` (bottom, top) points for triangle fans."""
 n=len(rr[0]);verts=[p for r in rr for p in r];faces=[]
 m=n if closed else n-1
 for j in range(len(rr)-1):
  for i in range(m):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
 if poles:
  b,t=poles
  if b is not None:
   verts.append(Vector(b));k=len(verts)-1;faces+=[(k,(i+1)%n,i) for i in range(n)]
  if t is not None:
   verts.append(Vector(t));k=len(verts)-1;base=(len(rr)-1)*n;faces+=[(base+i,base+(i+1)%n,k) for i in range(n)]
 else:
  if caps is True:caps=(True,True)
  if caps:
   if caps[0]:faces.append(tuple(range(n-1,-1,-1)))
   if caps[1]:faces.append(tuple((len(rr)-1)*n+i for i in range(n)))
 return mesh(name,verts,faces,tile,bn,mat,smooth,weights,face_tile,transform)

def ellipsoid(name,c,s,tile,bn='chest',mat=0,n=16,r=8,rot=(0,0,0),weights=None,transform=None,face_tile=None,M=None):
 """UV-sphere ellipsoid; `M` (a 4x4 local frame incl. translation) overrides c/rot."""
 n=max(6,round(n/2)*2);r=max(3,round(r))
 tr=M.copy() if M is not None else Matrix.Translation(c)@(rot.to_4x4() if isinstance(rot,Matrix) else Euler(rot).to_matrix().to_4x4())
 if transform is not None:tr=transform@tr
 verts=[Vector((0,0,-s[2]))]
 for j in range(1,r):
  a=-math.pi/2+math.pi*j/r;ca=math.cos(a)
  verts+=[Vector((s[0]*ca*math.cos(math.tau*i/n),s[1]*ca*math.sin(math.tau*i/n),s[2]*math.sin(a))) for i in range(n)]
 verts.append(Vector((0,0,s[2])))
 faces=[(0,1+(i+1)%n,1+i) for i in range(n)]
 for j in range(r-2):
  for i in range(n):faces.append((1+j*n+i,1+j*n+(i+1)%n,1+(j+1)*n+(i+1)%n,1+(j+1)*n+i))
 top=len(verts)-1;base=1+(r-2)*n
 faces+=[(base+i,base+(i+1)%n,top) for i in range(n)]
 return mesh(name,verts,faces,tile,bn,mat,True,weights,face_tile,tr)

def frustum(name,a,b,r1,r2,tile,bn='chest',mat=0,n=12,caps=True,weights=None,transform=None,face_tile=None,bevel=0.0):
 """Cylinder/cone from point a (radius r1) to point b (radius r2); optional rounded rim of size `bevel`."""
 a=Vector(a);b=Vector(b);ax=(b-a);L=ax.length;ax.normalize()
 M=ax.to_track_quat('Z','Y').to_matrix().to_4x4();M.translation=a
 if bevel>0:
  rows=[(0.0,r1-bevel),(bevel*0.35,r1-bevel*0.12),(bevel,r1),(L-bevel,r2),(L-bevel*0.35,r2-bevel*0.12),(L,r2-bevel)]
 else:
  rows=[(0.0,r1),(L,r2)]
 rr=[[Vector((r*math.cos(math.tau*(i+.5)/n),r*math.sin(math.tau*(i+.5)/n),z)) for i in range(n)] for z,r in rows]
 poles=((0,0,0),(0,0,L)) if caps else None
 tr=M if transform is None else transform@M
 return rings(name,rr,tile,bn,mat,False,True,weights,face_tile,True,tr,poles=poles)

def catmull_pad(pts,per):
 """The blockout's Catmull-Rom (end tangents padded by reflection)."""
 P=[Vector(p) for p in pts];P=[P[0]+(P[0]-P[1])]+P+[P[-1]+(P[-1]-P[-2])];out=[]
 for i in range(1,len(P)-2):
  p0,p1,p2,p3=P[i-1],P[i],P[i+1],P[i+2]
  for s in range(per):
   t=s/per
   out.append(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t**3))
 out.append(P[-2]);return out

def arclength(pts):
 s=[0.0]
 for a,b in zip(pts,pts[1:]):s.append(s[-1]+(b-a).length)
 return s

def sweep_rings(path,radii,n,flat=1.0,up=(0,0,1),phase=0.0):
 """The blockout sweep: rotation-minimising frames from `up`; `flat` scales the cross-section along N."""
 m=len(path);lens=arclength(path);total=lens[-1];rr=[];us=[]
 T=(path[1]-path[0]).normalized();U=Vector(up);N=U-U.dot(T)*T
 if N.length<1e-3:N=T.cross(Vector((1,0,0)))
 N.normalize()
 for i in range(m):
  if i>0:
   T=(path[min(i+1,m-1)]-path[i-1]).normalized();N=(N-N.dot(T)*T).normalized()
  B=T.cross(N);u=lens[i]/total
  k=u*(len(radii)-1);k0=min(int(k),len(radii)-2);r=radii[k0]+(radii[k0+1]-radii[k0])*(k-k0)
  rr.append([path[i]+r*(flat*math.cos(math.tau*(j+phase)/n)*N+math.sin(math.tau*(j+phase)/n)*B) for j in range(n)]);us.append(u)
 return rr,us

def tube(name,path,radii,tile,n=8,flat=1.0,up=(0,0,1),bn='chest',mat=0,weights=None,transform=None,caps=True,closed_loop=False,face_tile=None):
 """Tube along an explicit dense path; closed_loop joins the last ring to the first (no caps)."""
 if closed_loop:
  pts=list(path)+[path[0],path[1]]
  rr,us=sweep_rings(pts,radii,n,flat,up);rr=rr[:-2];us=us[:-2]
  nn=len(rr[0]);verts=[p for r in rr for p in r];faces=[]
  for j in range(len(rr)):
   a=j;b=(j+1)%len(rr)
   for i in range(nn):faces.append((a*nn+i,a*nn+(i+1)%nn,b*nn+(i+1)%nn,b*nn+i))
  return mesh(name,verts,faces,tile,bn,mat,True,weights,face_tile,transform),us
 rr,us=sweep_rings(path,radii,n,flat,up)
 poles=(path[0]-(path[1]-path[0]).normalized()*radii[0]*0.6,path[-1]+(path[-1]-path[-2]).normalized()*radii[-1]*0.6) if caps else None
 return rings(name,rr,tile,bn,mat,False,True,weights,face_tile,True,transform,poles=poles),us

def conformal_decal(name,outline,mapfn,top,bottom,tile,wall_tile=None,bn='chest',mat=0,rings_n=3,weights=None,face_tile=None):
 """A raised painted shape laid on a surface: a star-convex outline [(u, v)] mapped by mapfn(u, v) -> (point,
 normal); the top surface floats `top` above the surface (centre fan plus rings) and a side wall drops to `bottom`."""
 n=len(outline);cu=sum(p[0] for p in outline)/n;cv=sum(p[1] for p in outline)/n
 p0,n0=mapfn(cu,cv);verts=[p0+n0*top]
 for k in range(1,rings_n+1):
  f=k/rings_n
  for (u,v) in outline:
   p,nn=mapfn(cu+(u-cu)*f,cv+(v-cv)*f);verts.append(p+nn*top)
 base=len(verts)
 for (u,v) in outline:
  p,nn=mapfn(u,v);verts.append(p+nn*bottom)
 faces=[(0,1+i,1+(i+1)%n) for i in range(n)]
 for k in range(rings_n-1):
  a=1+k*n;b=1+(k+1)*n
  faces+=[(a+i,b+i,b+(i+1)%n,a+(i+1)%n) for i in range(n)]
 rim=1+(rings_n-1)*n
 wall=[]
 for i in range(n):
  f=(rim+i,base+i,base+(i+1)%n,rim+(i+1)%n);faces.append(f);wall.append(len(faces)-1)
 data=bpy.data.meshes.new(name);data.from_pydata([tuple(v) for v in verts],[],faces);data.update()
 # orient the top along the surface normal
 if sum(p.normal.dot(n0) for p in data.polygons[:n])<0:data.flip_normals()
 src=[v.co.copy() for v in data.vertices]
 ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob)
 ob=finish(ob,name,tile,bn,mat,True,weights,face_tile,src)
 if wall_tile is not None:
  # re-assign the wall faces to their own tile (a darker rim reads as the sheet's raised edge)
  uv=ob.data.uv_layers.active
  for fi in wall:
   p=ob.data.polygons[fi]
   for j,li in enumerate(p.loop_indices):uv.data[li].uv=tile_uv(wall_tile,(j in (1,2))*1.0,(j in (2,3))*1.0)
 return ob

def prism(name,pts,thick,tile,bn='chest',mat=0,M=None,weights=None,face_tile=None,smooth=False,side_tile=None):
 """Flat 2-D outline pts[(x, z)] extruded along local Y (thickness centred), fan-triangulated from its centroid."""
 n=len(pts);cx=sum(p[0] for p in pts)/n;cz=sum(p[1] for p in pts)/n;h=thick/2
 verts=[Vector((cx,-h,cz)),Vector((cx,h,cz))]+[Vector((x,-h,z)) for x,z in pts]+[Vector((x,h,z)) for x,z in pts]
 faces=[]
 for i in range(n):
  j=(i+1)%n;faces+=[(0,2+j,2+i),(1,2+n+i,2+n+j),(2+i,2+j,2+n+j,2+n+i)]
 ob=mesh(name,verts,faces,tile,bn,mat,smooth,weights,face_tile,M)
 weighted_normals(ob);return ob

def chaikin(pts,it=2,closed=True):
 P=[tuple(p) for p in pts]
 for _ in range(it):
  Q=[];m=len(P)
  for i in range(m if closed else m-1):
   a=P[i];b=P[(i+1)%m]
   Q+=[(0.75*a[0]+0.25*b[0],0.75*a[1]+0.25*b[1]),(0.25*a[0]+0.75*b[0],0.25*a[1]+0.75*b[1])]
  P=Q
 return P

def heart_outline(w,n=24):
 pts=[]
 for i in range(n):
  t=math.tau*i/n
  x=16*math.sin(t)**3;z=13*math.cos(t)-5*math.cos(2*t)-2*math.cos(3*t)-math.cos(4*t)
  pts.append((x*w/32,(z+2)*w/32))
 return pts

def star_outline(cu,cv,R,r,tilt,it=2):
 pts=[]
 for k in range(10):
  ang=math.pi/2+tilt+math.pi*k/5;rad=R if k%2==0 else r
  pts.append((cu+rad*math.cos(ang),cv+rad*math.sin(ang)))
 return chaikin(pts,it)

def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
