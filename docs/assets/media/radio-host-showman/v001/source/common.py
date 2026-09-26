"""WO111 radio-host-showman mesh, atlas-UV and skin helpers.

Adapted from the WO111 demon-band-idol v001 helpers (rigid parts plus blended weights, flat atlas
tiles, parts authored in a source frame and placed by a matrix), with region UVs for this character:

* 'F'   the painted face: planar front projection (along -Y) of head-local source coordinates into the
        top-left 512 px, so the grin, teeth, eye whites and brows land where the blockout decals sit;
* 'J'   the candy-stripe jacket: a cylindrical (lathe-angle, height) map into the bottom-left 512 px,
        seam on the right side under the arm; stripes, shawl lapels, shirt, cutaway and back belt are paint;
* 'E_R', 'E_L'  the two glowing iris shells: local front projection round each eye centre into one
        shared 256 px iris painting (bottom-right);
* 'M'   the mic capsule: height along the capsule axis into a 256 px band painting (grille bands).
Everything else uses 128 px flat colour tiles (top-right quadrant, plus the upper half of the
bottom-right quadrant).

Two materials share the one atlas: 0 matte painted, 1 glow (the atlas also drives emission, so the
red irises, the on-air bulb, the static halo and the static burst glow in the dark casino rooms).
All authored coordinates are Blender +Z up / +Y forward, character right = +X.
The glTF exporter maps them to +Y up / -Z forward.
"""
import bpy, bmesh, math
from pathlib import Path
from mathutils import Vector, Matrix, Euler

PARTS=[]; MATS=[]; ROOT=None
ATLAS=1024
FACE='F'; JACKET='J'; EYE_R='E_R'; EYE_L='E_L'; MIC='M'
# Face: head-local (before the head transform) x/z rectangle -> atlas px (0,0)-(512,512).
FACE_SRC=(-0.19,0.19,1.495,1.875)
# Jacket: lathe angle 0..2pi (0 = character right side, pi/2 = front) and world z 0.80..1.49 -> (0,512)-(512,1024).
JACKET_Z=(0.80,1.49); JACKET_PAD=8/512
# Iris shells: q = (dx/EYE_RX, dz/EYE_RZ); |q| = 1.25 reaches the region edge. (512,768)-(768,1024).
EYE_RX=0.021; EYE_RZ=0.027; EYE_Q=1.25
EYE_C={}   # 'E_R'/'E_L' -> head-local (x, z) centre, set by build.py
# Mic capsule: t in 0..1 along its axis (bottom->top) -> (768,768)-(1024,1024).
MIC_LEN=[1.0]
RECT={'F':(0,0,512,512),'J':(0,512,512,512),'E':(512,768,256,256),'M':(768,768,256,256)}

def setup(root,materials,atlas_path,atlas_name):
 """materials: [(label, roughness, emissive)]. One packed atlas image drives colour (and emission)."""
 global ROOT
 ROOT=Path(root)
 if bpy.context.object and bpy.context.object.mode!='OBJECT':bpy.ops.object.mode_set(mode='OBJECT')
 for ob in list(bpy.data.objects):bpy.data.objects.remove(ob,do_unlink=True)
 for coll in list(bpy.data.collections):bpy.data.collections.remove(coll)
 for blocks in (bpy.data.meshes,bpy.data.armatures,bpy.data.materials,bpy.data.actions,bpy.data.images,bpy.data.textures,bpy.data.curves,bpy.data.cameras,bpy.data.lights,bpy.data.node_groups,bpy.data.texts,bpy.data.linestyles):
  for block in list(blocks):blocks.remove(block)
 bpy.data.orphans_purge(do_local_ids=True,do_linked_ids=True,do_recursive=True)
 PARTS.clear();MATS.clear()
 sc=bpy.context.scene;sc.unit_settings.system='METRIC';sc.unit_settings.scale_length=1
 image=bpy.data.images.load(str(atlas_path),check_existing=False);image.name=atlas_name;image.pack()
 for label,rough,emissive in materials:
  mat=bpy.data.materials.new(label);mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF')
  bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=0;bs.inputs['Specular IOR Level'].default_value=.30
  tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;tex.extension='EXTEND';tex.interpolation='Linear'
  mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
  if emissive:
   mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Emission Color']);bs.inputs['Emission Strength'].default_value=1.0
  MATS.append(mat)

def tile_origin(t):
 """Top-left pixel of a 128 px flat tile: tiles 0-15 fill the top-right quadrant, 16-23 the upper half of the bottom-right."""
 assert 0<=t<24,t
 q=t%16;x=512+(q%4)*128;y=(q//4)*128+(512 if t>=16 else 0);return x,y

def tile_uv(t,u,v):
 x,y=tile_origin(t)
 # the centre 50% of each tile: mip levels never bleed a neighbouring colour into a part
 return ((x+32+64*u)/ATLAS,1-(y+32+64*(1-v))/ATLAS)

def rect_uv(key,fx,fy):
 x0,y0,w,h=RECT[key];return ((x0+fx*w)/ATLAS,1-(y0+fy*h)/ATLAS)

def clamp(a,lo=0.002,hi=0.998):return max(lo,min(hi,a))

def region_uvs(kind,pts):
 """UVs for one polygon's source points in a painted region."""
 if kind==FACE:
  x0,x1,z0,z1=FACE_SRC;return [rect_uv('F',clamp((p.x-x0)/(x1-x0)),clamp((z1-p.z)/(z1-z0))) for p in pts]
 if kind==JACKET:
  z0,z1=JACKET_Z;ph=[math.atan2(p.y/JACKET_EY[0],p.x)%math.tau for p in pts]
  if max(ph)-min(ph)>math.pi:ph=[a+math.tau if a<math.pi else a for a in ph]
  return [rect_uv('J',JACKET_PAD+(1-2*JACKET_PAD)*a/math.tau,clamp((z1-p.z)/(z1-z0))) for a,p in zip(ph,pts)]
 if kind in (EYE_R,EYE_L):
  cx,cz=EYE_C[kind]
  return [rect_uv('E',.5+(p.x-cx)/EYE_RX/(2*EYE_Q),.5-(p.z-cz)/EYE_RZ/(2*EYE_Q)) for p in pts]
 if kind==MIC:
  return [rect_uv('M',.5,.03+.94*(1-clamp(p.z/MIC_LEN[0],0,1))) for p in pts]
 raise KeyError(kind)
JACKET_EY=[0.70]

def assign_uv(me,tile,face_tile=None,src=None):
 """Flat tiles use a tiny per-face planar spread inside the tile centre; region faces use region_uvs of src."""
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
   uvs=region_uvs(t,[co[me.loops[li].vertex_index] for li in p.loop_indices])
   for li,q in zip(p.loop_indices,uvs):uv.data[li].uv=q
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

def weighted_normals(ob):
 bpy.context.view_layer.objects.active=ob;ob.select_set(True)
 mod=ob.modifiers.new('Weighted authored face normals','WEIGHTED_NORMAL');mod.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 ob.select_set(False)

def box(name,c,s,tile,bn='chest',bevel=.008,segments=2,mat=0,rot=(0,0,0),weights=None,transform=None,face_tile=None):
 bm=bmesh.new();bmesh.ops.create_cube(bm,size=1.0)
 for v in bm.verts:v.co=Vector((v.co.x*s[0],v.co.y*s[1],v.co.z*s[2]))
 if bevel:
  bmesh.ops.bevel(bm,geom=bm.verts[:]+bm.edges[:],offset=bevel,segments=segments,affect='EDGES',profile=.5)
 tr=Matrix.Translation(c)@Euler(rot).to_matrix().to_4x4()
 if transform is not None:tr=transform@tr
 verts=[v.co.copy() for v in bm.verts];faces=[[v.index for v in f.verts] for f in bm.faces];bm.free()
 ob=mesh(name,verts,faces,tile,bn,mat,True,weights,face_tile,tr,merge=False)
 if bevel:weighted_normals(ob)
 return ob

def rings(name,rr,tile,bn='chest',mat=0,caps=True,smooth=True,weights=None,face_tile=None,closed=True,transform=None):
 n=len(rr[0]);verts=[p for r in rr for p in r];faces=[]
 m=n if closed else n-1
 for j in range(len(rr)-1):
  for i in range(m):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
 if caps is True:caps=(True,True)
 if caps:
  if caps[0]:faces.append(tuple(range(n-1,-1,-1)))
  if caps[1]:faces.append(tuple((len(rr)-1)*n+i for i in range(n)))
 return mesh(name,verts,faces,tile,bn,mat,smooth,weights,face_tile,transform)

def ellipsoid(name,c,s,tile,bn='chest',mat=0,n=16,r=8,rot=(0,0,0),weights=None,transform=None,face_tile=None):
 n=max(6,round(n/2)*2);r=max(3,round(r))
 tr=Matrix.Translation(c)@Euler(rot).to_matrix().to_4x4()
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

def frustum(name,c,r1,r2,depth,tile,bn='chest',mat=0,n=12,rot=(0,0,0),scale=(1,1,1),weights=None,transform=None,face_tile=None,caps=True):
 """Blender create_cone equivalent: centred at c, axis local +Z, radius1 at -depth/2, radius2 at +depth/2."""
 tr=Matrix.Translation(c)@Euler(rot).to_matrix().to_4x4()@Matrix.Diagonal((scale[0],scale[1],scale[2],1))
 if transform is not None:tr=transform@tr
 rr=[[Vector((r*math.cos(math.tau*i/n),r*math.sin(math.tau*i/n),z)) for i in range(n)] for z,r in ((-depth/2,r1),(depth/2,r2))]
 if r2<1e-6:
  verts=rr[0]+[Vector((0,0,depth/2))];faces=[tuple(range(n-1,-1,-1))]+[(i,(i+1)%n,n) for i in range(n)]
  return mesh(name,verts,faces,tile,bn,mat,True,weights,face_tile,tr)
 return rings(name,rr,tile,bn,mat,caps,True,weights,face_tile,True,tr)

def lathe_rows(name,rows,tile,bn='chest',mat=0,n=24,ey=1.0,caps=True,weights=None,face_tile=None,transform=None,axis_xy=(0,0),phase=0.0):
 """Vertical surface of revolution from explicit (z, radius) rows; ey scales the local y radius."""
 rr=[[Vector((axis_xy[0]+r*math.cos(math.tau*(i+phase)/n),axis_xy[1]+r*ey*math.sin(math.tau*(i+phase)/n),z)) for i in range(n)] for z,r in rows]
 return rings(name,rr,tile,bn,mat,caps,True,weights,face_tile,True,transform)

def bspline(points,samples):
 """Clamped uniform B-spline of order min(4, n) (Blender NURBS, endpoint on, unit weights)."""
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
  t=tmax*s/samples;p=Vector((0,0,0));wsum=0
  for i in range(nctrl):
   b=basis(i,deg,t);p+=P[i]*b;wsum+=b
  out.append(p/wsum if wsum>0 else P[-1])
 return out

def bspline_radii(radii,samples):
 return [p.x for p in bspline([(r,0,0) for r in radii],samples)]

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

def sweep(name,pts,radii,tile,band=None,n=8,per=3,flat=1.0,up=(0,0,1),bn='chest',mat=0,weights=None,transform=None,caps=True,path=None,phase=0.0):
 """Tube along the blockout's Catmull-Rom path; band(u) -> tile (or None) per ring segment."""
 path=path or catmull_pad(pts,per)
 rr,us=sweep_rings(path,radii,n,flat,up,phase)
 ft=None
 if band:
  zs=[(p,u) for p,u in zip(path,us)]
  def ft(c,nn):
   i=min(range(len(path)),key=lambda k:(path[k]-c).length)
   j=min(max(i,0),len(us)-1);return band(us[j])
 ob=rings(name,rr,tile,bn,mat,caps,True,weights,ft,True,transform)
 return ob,path,us

def prism(name,pts,thick,tile,bn='chest',mat=0,M=None,weights=None,face_tile=None,smooth=False):
 """Flat 2-D outline pts[(x, z)] extruded along local Y (thickness centred), fan-triangulated from its centroid."""
 n=len(pts);cx=sum(p[0] for p in pts)/n;cz=sum(p[1] for p in pts)/n;h=thick/2
 verts=[Vector((cx,-h,cz)),Vector((cx,h,cz))]+[Vector((x,-h,z)) for x,z in pts]+[Vector((x,h,z)) for x,z in pts]
 faces=[]
 for i in range(n):
  j=(i+1)%n;faces+=[(0,2+j,2+i),(1,2+n+i,2+n+j),(2+i,2+j,2+n+j,2+n+i)]
 ob=mesh(name,verts,faces,tile,bn,mat,smooth,weights,face_tile,M)
 weighted_normals(ob);return ob

def frame(y_axis,z_hint,origin=(0,0,0)):
 """World matrix whose local +Y is y_axis and local +Z is as close to z_hint as possible."""
 Y=Vector(y_axis).normalized();Z=Vector(z_hint);Z=(Z-Z.dot(Y)*Y).normalized();X=Y.cross(Z)
 M=Matrix((X,Y,Z)).transposed().to_4x4();M.translation=Vector(origin);return M

def star_pts(r_out,r_in,n=5,rot=0.0,cx=0.0,cz=0.0):
 out=[]
 for k in range(2*n):
  a=math.pi/2+rot+math.pi*k/n;r=r_out if k%2==0 else r_in
  out.append((cx+r*math.cos(a),cz+r*math.sin(a)))
 return out

def sparkle_pts(r,e=3.0,samples=12,cx=0.0,cz=0.0):
 out=[]
 for k in range(samples):
  t=math.tau*k/samples;c=math.cos(t);s=math.sin(t)
  out.append((cx+r*math.copysign(abs(c)**e,c),cz+r*math.copysign(abs(s)**e,s)))
 return out

def ellipse_pts(rx,rz,cx=0.0,cz=0.0,n=28,rot=0.0):
 out=[]
 for k in range(n):
  t=math.tau*k/n;x=rx*math.cos(t);z=rz*math.sin(t)
  out.append((cx+x*math.cos(rot)-z*math.sin(rot),cz+x*math.sin(rot)+z*math.cos(rot)))
 return out

def ribbon(name,centers,normals,binormals,widths,thickness,tile,bn='chest',mat=0,closed=True,weights=None,face_tile=None):
 """Solid flat strap: per sample a base centre on a surface, the outward normal and a width direction."""
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

def smooth_profile(profile,step=0.008):
 """The blockout's lathe profile densify + smooth, so silhouettes and projected features match it."""
 t0,t1=profile[0][0],profile[-1][0];n=max(8,int((t1-t0)/step))
 ts=[t0+(t1-t0)*i/n for i in range(n+1)];rs=[interp(profile,t) for t in ts]
 for _ in range(2):
  rs=[rs[0]]+[(rs[i-1]+2*rs[i]+rs[i+1])/4 for i in range(1,len(rs)-1)]+[rs[-1]]
 return list(zip(ts,rs))
