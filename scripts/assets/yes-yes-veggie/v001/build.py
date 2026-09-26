"""WO111 original stubborn broccoli ordinary, built only through Blender MCP (rebuild 2).

The selected Astra concept supplies proportions, colours and part attachment:
a chunky pale-lime stalk that splits into two stubby rounded feet and, at the
top, into thick branches with dark slits between them; a broad dark-green
crown of big lumpy florets; two thin stalk arms ending in cupped leaf mittens;
big cream oval eyes glaring inward, thick dark brows tilted down to the
middle, a tiny pursed frown and warm cheeks. Shapes, atlas, rig and acting are
original.

Rebuild 2 replaces checkpoint 1 (preserved as build-checkpoint1.py and
*-checkpoint1.* files) after the author comparison against the concept found a
flat, jagged shelf on top of the stalk, a thin pole under the top floret,
smooth mushroom-cap florets, a scale-like curd texture, a trunk about 20%
too wide and pointed generic leaves.

Soft occlusion is ray-traced once in Blender against the stalk, crown, eyes
and floor and stored as the active COLOR_0 multiplier, so the slits, floret
crevices, leg notch and foot contact read dark in any three.js renderer.
Blender +Y forward becomes glTF -Z forward; anatomical left is Blender -X.
"""
import bpy, bmesh, math, json, hashlib, importlib.util, struct, zlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler
from mathutils.bvhtree import BVHTree
import numpy as np

ROOT=Path('/workspace/haynes-quest/family-eras/yes-yes-veggie/v001')
sc=bpy.context.scene
assert sc.get('work_order')=='WO111' and sc.get('scene_lease')=='active' and sc.get('asset_id')=='yes-yes-veggie'
spec=importlib.util.spec_from_file_location('wo111_veggie_common',ROOT/'source/common.py')
C=importlib.util.module_from_spec(spec);spec.loader.exec_module(C);C.BASE=ROOT.parent
def smooth(t):t=max(0.0,min(1.0,t));return t*t*(3-2*t)
def lerp_profile(rows,z,k):
 if z<=rows[0][0]:return rows[0][k]
 for r0,r1 in zip(rows,rows[1:]):
  if z<=r1[0]:t=(z-r0[0])/(r1[0]-r0[0]);return r0[k]+(r1[k]-r0[k])*t
 return rows[-1][k]

# ---- Atlas tiles (4x4 of 256 px, 16 palette levels each).
T_BODY,T_CURD_A,T_CURD_B,T_LEAF,T_STEM,T_EYE,T_PUPIL,T_CATCH,T_BROW,T_MOUTH,T_BLUSH,T_CREASE,T_S12,T_S13,T_S14,T_S15=range(16)
V_TOP=.82
BODY_RAMP=[(0,'7a9430'),(.30,'9bb63b'),(.60,'b8d150'),(.85,'c8de5d'),(1,'d6ea73')]
def nsmooth(t):t=np.clip(t,0,1);return t*t*(3-2*t)
def body_level(V):return .60+.20*nsmooth(V/.45)-.12*nsmooth((V-.74)/.22)
def hexrgb(h):return np.array([int(h[j:j+2],16)/255 for j in (0,2,4)])
def ramp_color(stops,x):
 x=min(1,max(0,x))
 for (a,ca),(b,cb) in zip(stops,stops[1:]):
  if x<=b:t=(x-a)/(b-a);return hexrgb(ca)*(1-t)+hexrgb(cb)*t
 return hexrgb(stops[-1][1])
def rgbhex(c):return ''.join('%02x'%int(round(v*255)) for v in c)
CHEEK_Z=.428;CHEEK_X=.100
BLUSH_EDGE=ramp_color(BODY_RAMP,body_level(CHEEK_Z/V_TOP))

def atlas():
 rng=np.random.default_rng(11104);yy,xx=np.mgrid[0:256,0:256]
 U=np.clip((xx/255-C.TILE_INSET)/C.TILE_SPAN,0,1);V=np.clip((yy/255-C.TILE_INSET)/C.TILE_SPAN,0,1)
 fine=rng.integers(-1,2,(256,256))*.012
 def curd(seed,bumps,clusters):
  """Round curd bumps lit from the upper left, grouped into clusters with dark crevices."""
  r=np.random.default_rng(seed)
  g=int(math.ceil(math.sqrt(bumps)));pts=[]
  for i in range(g):
   for j in range(g):pts.append(((i+.5+r.uniform(-.42,.42))/g*1.1-.05,(j+.5+r.uniform(-.42,.42))/g*1.1-.05))
  pts=np.array(pts);rad=.62/g*1.1
  d1=np.full((256,256),9.0);idx=np.zeros((256,256),int)
  for k,(px,py) in enumerate(pts):
   dd=np.hypot(U-px,V-py);m=dd<d1;idx[m]=k;d1[m]=dd[m]
  dx=(U-pts[idx,0])/rad;dy=(V-pts[idx,1])/rad;h=np.sqrt(np.clip(1-dx*dx-dy*dy,0,1))
  L=np.array([-.45,.55,.70]);L=L/np.linalg.norm(L)
  lam=np.clip(-dx*L[0]+dy*L[1]+h*L[2],0,1)
  bump=np.where(h>0,.30+.70*lam*(.55+.45*h),.10)
  cp=r.uniform(-.05,1.05,(clusters,2));tone=r.uniform(.80,1.0,clusters)
  c1=np.full((256,256),9.0);c2=np.full((256,256),9.0);ci=np.zeros((256,256),int)
  for k,(px,py) in enumerate(cp):
   dd=np.hypot(U-px,V-py);m=dd<c1;c2=np.where(m,c1,np.minimum(c2,dd));ci[m]=k;c1[m]=dd[m]
  crevice=np.clip((c2-c1)/.045,0,1)**.7
  return np.clip(.04+.92*bump*(.35+.65*crevice)*tone[ci]+fine,0,1)
 def seg(ax,ay,bx,by):
  px,py=U-ax,V-ay;vx,vy=bx-ax,by-ay;t=np.clip((px*vx+py*vy)/(vx*vx+vy*vy),0,1)
  return np.hypot(px-t*vx,py-t*vy),t
 streak=(.030*np.sin(math.tau*7*U+1.3+.6*np.sin(3*V))+.022*np.sin(math.tau*13*U+.4)+.016*np.sin(math.tau*23*U+2.1+.8*V)+.010*np.sin(math.tau*37*U+.9))
 leaf=.46+.05*np.sin(U*9+V*5)-.14*np.abs(U-.5)**1.5*2+fine
 mid,_=seg(.5,1.0,.5,.03);leaf=np.where(mid<.016,.82,np.where(mid<.028,np.maximum(leaf,.64),leaf))
 for vk in (.86,.66,.46,.28):
  for s in (-1,1):
   dd,t=seg(.5,vk,.5+s*.40,vk-.22);w=.012*(1-.55*t)
   leaf=np.where(dd<w,np.maximum(leaf,.68-.18*t),leaf)
 r=np.hypot(U-.5,V-.5)*2
 tiles={
  T_BODY:(BODY_RAMP,np.clip(body_level(V)+streak+fine*.5,0,1)),
  T_CURD_A:([(0,'13240c'),(.40,'2f5a1e'),(.75,'4f8032'),(1,'7fa653')],curd(21,420,16)),
  T_CURD_B:([(0,'122209'),(.40,'2c561c'),(.75,'4b7a2f'),(1,'77a04d')],curd(22,380,14)),
  T_LEAF:([(0,'25441a'),(.35,'37622a'),(.65,'4c7a37'),(1,'8cb265')],np.clip(leaf,0,1)),
  T_STEM:([(0,'98a53f'),(1,'c8cf62')],np.clip(.55+.25*V+streak+fine,0,1)),
  T_EYE:([(0,'e2d4b7'),(1,'faf2e0')],np.clip(.55+.40*V+fine,0,1)),
  T_PUPIL:([(0,'0f0b0a'),(1,'2a211f')],np.clip(.40+fine*2,0,1)),
  T_CATCH:([(0,'f7efe2'),(1,'fffbf2')],np.clip(.60+fine,0,1)),
  T_BROW:([(0,'2c1b17'),(1,'4d3127')],np.clip(.45+.30*V+fine,0,1)),
  T_MOUTH:([(0,'3a1d20'),(1,'5a2e31')],np.clip(.50+fine,0,1)),
  T_BLUSH:([(0,'ea9677'),(.35,'eb9d7b'),(1,rgbhex(BLUSH_EDGE))],np.clip((r-.05)/.95,0,1)**.9),
  T_CREASE:([(0,'9aa543'),(1,'b0b953')],np.clip(.50+fine,0,1)),
  T_S12:([(0,'c9d06e'),(1,'dfe48c')],np.clip(.5+fine,0,1)),T_S13:([(0,'c9d06e'),(1,'dfe48c')],np.clip(.5+fine,0,1)),
  T_S14:([(0,'c9d06e'),(1,'dfe48c')],np.clip(.5+fine,0,1)),T_S15:([(0,'c9d06e'),(1,'dfe48c')],np.clip(.5+fine,0,1)),
 }
 indices=np.zeros((1024,1024),dtype=np.uint8);palette=[]
 for i in range(16):
  stops,field=tiles[i]
  levels=np.clip(np.round(field*15),0,15).astype(np.uint8)
  for level in range(16):palette.extend(np.round(np.clip(ramp_color(stops,level/15),0,1)*255).astype(np.uint8).tolist())
  row=3-i//4;col=i%4;indices[row*256:(row+1)*256,col*256:(col+1)*256]=i*16+levels
 def chunk(name,data):return struct.pack('>I',len(data))+name+data+struct.pack('>I',zlib.crc32(name+data)&0xffffffff)
 raw=b''.join(b'\x00'+row.tobytes() for row in indices[::-1])
 png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1024,1024,8,3,0,0,0))+chunk(b'PLTE',bytes(palette))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
 (ROOT/'pigment.png').write_bytes(png)

atlas();C.setup('v001',[('Matte painted broccoli skin and leaves',.86),('Satin eyes',.38)])
for key in list(sc.keys()):
 if not (key.startswith('blendermcp_') or key in ('cycles','work_order','scene_owner','scene_lease','asset_id','asset_version','authoring_model')):del sc[key]
sc['work_order']='WO111';sc['scene_lease']='active';sc['asset_id']='yes-yes-veggie';sc['asset_version']='v001'
sc['candidate_status']="WO111 yes-yes-veggie v001 · Awaiting Tom's review · used in the family release"
sc['authoring_model']='claude-opus-5-5 xhigh'
sc['source_concept_sha256']=hashlib.sha256((ROOT/'concept.png').read_bytes()).hexdigest()
sc['orientation']='Blender +Z up/+Y forward; glTF +Y up/-Z forward; stationary identity floor root; feet planted on the floor at rest'

# ---- Stalk sculpt volume: trunk, two stubby feet and nine thick branches are
# lofted separately, merged by a voxel remesh, softened into organic fillets
# and decimated. The trunk closes in a low dome hidden under the crown, so the
# only stalk visible between the florets is branch surface and dark slits.
E_TRUNK=2.4
TRUNK=[(.115,.085,.070,.000),(.125,.138,.102,.000),(.14,.153,.112,.000),(.18,.154,.116,.002),(.24,.147,.117,.006),(.30,.139,.117,.010),(.37,.134,.117,.015),
 (.44,.138,.119,.018),(.50,.147,.122,.016),(.545,.160,.126,.008),(.58,.176,.132,-.006),(.61,.188,.138,-.024),(.635,.190,.140,-.038),(.66,.176,.132,-.050),
 (.685,.146,.112,-.058),(.705,.100,.080,-.062),(.72,.040,.035,-.064)]
def trunk_cy(z):return lerp_profile(TRUNK,min(max(z,.115),.70),3)
LEG=[(0.0,.056,.070,.122,.018),(.010,.082,.099,.122,.018),(.025,.095,.114,.121,.016),(.050,.102,.121,.119,.012),(.075,.099,.116,.114,.006),(.100,.088,.100,.105,.002),
 (.125,.079,.088,.096,.000),(.16,.075,.084,.088,.002),(.21,.073,.082,.084,.004)]
FLORETS=[('Top centre floret',(0,-.045,.845),.155,1,26,13,T_CURD_A),('Front left floret',(-.232,.03,.765),.150,2,26,13,T_CURD_B),('Front right floret',(.232,.03,.76),.148,3,26,13,T_CURD_A),
 ('Low left floret',(-.262,-.10,.60),.115,4,20,11,T_CURD_A),('Low right floret',(.262,-.10,.605),.115,5,20,11,T_CURD_B),
 ('Back left floret',(-.15,-.23,.72),.16,6,24,12,T_CURD_A),('Back right floret',(.15,-.23,.72),.16,7,24,12,T_CURD_B),
 ('Top back floret',(0,-.21,.87),.13,8,20,11,T_CURD_B),('Top left filler floret',(-.13,-.13,.90),.10,9,16,9,T_CURD_B),('Top right filler floret',(.13,-.13,.90),.10,10,16,9,T_CURD_A),
 ('Low back left floret',(-.235,-.21,.585),.11,11,18,10,T_CURD_B),('Low back right floret',(.235,-.21,.59),.11,12,18,10,T_CURD_A)]
# Branch lofts: (path, (half width, half depth) at base, at tip); tips end inside their floret.
BRANCHES=[([(-.03,.035,.53),(-.052,.05,.66),(-.035,-.02,.78)],(.052,.052),(.040,.040)),([(.03,.035,.53),(.052,.05,.66),(.035,-.02,.78)],(.052,.052),(.040,.040)),
 ([(-.08,.05,.53),(-.17,.055,.64),(-.225,.035,.735)],(.062,.052),(.046,.042)),([(.08,.05,.53),(.17,.055,.64),(.225,.035,.73)],(.062,.052),(.046,.042)),
 ([(-.10,-.02,.50),(-.19,-.05,.565),(-.255,-.09,.595)],(.060,.048),(.045,.040)),([(.10,-.02,.50),(.19,-.05,.57),(.255,-.09,.60)],(.060,.048),(.045,.040)),
 ([(-.06,-.07,.54),(-.10,-.155,.64),(-.145,-.21,.70)],(.066,.054),(.048,.042)),([(.06,-.07,.54),(.10,-.155,.64),(.145,-.21,.70)],(.066,.054),(.048,.042)),
 ([(-.03,-.08,.56),(-.04,-.15,.70),(-.02,-.20,.83)],(.048,.048),(.038,.038)),([(.03,-.08,.56),(.04,-.15,.70),(.02,-.20,.83)],(.048,.048),(.038,.038)),
 ([(-.07,-.07,.50),(-.16,-.15,.56),(-.225,-.20,.585)],(.050,.045),(.040,.036)),([(.07,-.07,.50),(.16,-.15,.565),(.225,-.20,.59)],(.050,.045),(.040,.036))]
STALK_TRIS=4300
geo_v=[];geo_f=[]
def add_rings(rr,caps=True):
 base=len(geo_v);n=len(rr[0])
 for r in rr:geo_v.extend(tuple(p) for p in r)
 for j in range(len(rr)-1):
  for i in range(n):geo_f.append((base+j*n+i,base+j*n+(i+1)%n,base+(j+1)*n+(i+1)%n,base+(j+1)*n+i))
 if caps:geo_f.extend([tuple(base+i for i in range(n-1,-1,-1)),tuple(base+(len(rr)-1)*n+i for i in range(n))])
add_rings([[(x,cy+y,z) for x,y in (C.superellipse(a_,b_,E_TRUNK,math.tau*i/48) for i in range(48))] for z,a_,b_,cy in TRUNK])
for side in (-1,1):add_rings([[(side*cx+x,cy+y,z) for x,y in (C.superellipse(a_,b_,2.4,math.tau*i/32) for i in range(32))] for z,a_,b_,cx,cy in LEG])
for pts,(w0,d0),(w1,d1) in BRANCHES:
 path=[Vector(q) for q in C.catmull(pts,5)];s_,_=C.arclength(path);B=path[0]
 radial=Vector((B.x,B.y-trunk_cy(B.z),0))
 radial=radial.normalized() if radial.length>1e-4 else Vector((0,1,0))
 rows=[]
 for i,(q,t) in enumerate(zip(path,s_)):
  tg=(path[min(i+1,len(path)-1)]-path[max(i-1,0)]).normalized();S=tg.cross(radial).normalized();D=S.cross(tg).normalized()
  w=w0+(w1-w0)*smooth(t);d=d0+(d1-d0)*smooth(t)
  rows.append([q+w*math.cos(math.tau*j/20)*S+d*math.sin(math.tau*j/20)*D for j in range(20)])
 add_rings(rows)
sd=bpy.data.meshes.new('Stalk sculpt volume');sd.from_pydata(geo_v,[],geo_f);sd.update()
bm=bmesh.new();bm.from_mesh(sd);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(sd);bm.free()
stalk=bpy.data.objects.new('Stalk sculpt volume',sd);bpy.context.collection.objects.link(stalk)
bpy.context.view_layer.objects.active=stalk;stalk.select_set(True)
m=stalk.modifiers.new('Voxel merge','REMESH');m.mode='VOXEL';m.voxel_size=.0045;m.adaptivity=0;m.use_smooth_shade=True
m=stalk.modifiers.new('Organic fillets','SMOOTH');m.factor=.6;m.iterations=10
for mod in list(stalk.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
dense=len(stalk.data.polygons)
m=stalk.modifiers.new('Game budget','DECIMATE');m.decimate_type='COLLAPSE';m.use_collapse_triangulate=True;m.ratio=min(1.0,STALK_TRIS/(2.0*dense))
bpy.ops.object.modifier_apply(modifier='Game budget')
stalk.select_set(False)
zmin=min(v.co.z for v in stalk.data.vertices)
for v in stalk.data.vertices:v.co.z-=zmin
stalk.data.update()
def stalk_weights(p):
 # Leg influence fades with height; across the notch it splits smoothly
 # between both legs, so the crotch rides with the feet instead of tearing.
 z=p.z;wl=1-smooth((z-.09)/.15);fL=smooth((.03-p.x)/.06)
 wb=smooth((z-.24)/.18);wc=smooth((z-.60)/.12)
 return {'hips':(1-wb)*(1-wl),'body':wb*(1-wc)*(1-wl),'crown':wb*wc*(1-wl),'leg_L':wl*fL,'leg_R':wl*(1-fL)}
C.finish(stalk,'Pale lime broccoli stalk, feet and branches',T_BODY,'body',weights=stalk_weights)
C.custom_uv(stalk,lambda co,p:(T_BODY,abs(math.atan2(co.x,co.y-trunk_cy(co.z)))/math.pi,co.z/V_TOP))
STALK_BVH=BVHTree.FromPolygons([tuple(v.co) for v in stalk.data.vertices],[tuple(p.vertices) for p in stalk.data.polygons])
def surface(x,z,off=0.0):
 hit,n,_,_=STALK_BVH.ray_cast(Vector((x,1.0,z)),Vector((0,-1,0)))
 assert hit is not None,(x,z)
 n=n.normalized()
 if n.y<0:n=-n
 return hit+n*off,n
def front_y(x,z):return surface(x,z)[0].y
for side,bn in ((-1,'leg_L'),(1,'leg_R')):
 for k,dx in enumerate((-.03,.03)):
  pts=[surface(side*.118+dx,z,-.0012)[0] for z in (.028,.040,.052,.064,.075)]
  C.tube('Soft toe crease %s %d'%(bn,k),pts,.0030,T_CREASE,bn,n=5)

# ---- Crown: big lumpy florets. Each is a flattened-underside dome whose
# radius swells into 6-8 soft sub-clusters; curd bumps are painted.
def floret(name,c,R,seed,n,r,tile,lobes=7,amp=.12,width=.55,flat=.86):
 g=np.random.default_rng(seed);dirs=[];golden=math.pi*(3-math.sqrt(5))
 for k in range(lobes):
  zz=1-1.45*(k+.5)/lobes;zz=max(-.40,min(.97,zz+g.uniform(-.08,.08)));phi=k*golden+g.uniform(0,.6)
  rad=math.sqrt(max(0,1-zz*zz));dirs.append(Vector((rad*math.cos(phi),rad*math.sin(phi),zz)).normalized())
 center=Vector(c);rows=[]
 for j in range(r+1):
  a=-math.pi/2+math.pi*j/r;ca=max(.00015,math.cos(a));row=[]
  for i in range(n):
   th=math.tau*i/n;d=Vector((ca*math.cos(th),ca*math.sin(th),math.sin(a)))
   b=sum(math.exp(-((d.angle(k))/width)**2)**4 for k in dirs)**.25
   p=d*(R*(1-amp+amp*min(1,b)))
   if p.z<0:p.z*=flat
   row.append(center+p)
  rows.append(row)
 return C.rings(name,rows,tile,'crown')
FLORET_OBS=[floret(name,c,R,seed,n,r,tile) for name,c,R,seed,n,r,tile in FLORETS]

# ---- Face: big cream oval eyes with inward-glaring pupils, thick brows, a
# tiny pursed frown and radial blush cheeks, ray-cast onto the stalk.
EYE_Z=.495;EYE_X=.076;EYE_R=(.043,.021,.052)
def aligned(n):return Vector((0,1,0)).rotation_difference(n).to_euler()
EYES={};EYE_OBS=[];FACE_OBS=[]
for side in (-1,1):
 c,n=surface(side*EYE_X,EYE_Z,-.004);rot=aligned(n);M=rot.to_matrix()
 EYE_OBS.append(C.ellipsoid('Cream oval eye '+str(side),tuple(c),EYE_R,T_EYE,'body',1,n=20,r=9,rot=tuple(rot)))
 dx,dz=-side*.012,.004;q=max(0,1-(dx/EYE_R[0])**2-(dz/EYE_R[2])**2)
 pc=c+M@Vector((dx,EYE_R[1]*math.sqrt(q)-.0045,dz))
 FACE_OBS.append(C.ellipsoid('Ink pupil '+str(side),tuple(pc),(.022,.009,.026),T_PUPIL,'pupils',1,n=14,r=7,rot=tuple(rot)))
 FACE_OBS.append(C.ellipsoid('Pupil catchlight '+str(side),tuple(pc+M@Vector((side*.006,.0075,.008))),(.0065,.003,.0075),T_CATCH,'pupils',1,n=10,r=5,rot=tuple(rot)))
 EYES[side]={'centre':list(c),'normal':list(n),'pupil':list(pc)}
BROWS={}
for side,bn in ((-1,'brow_L'),(1,'brow_R')):
 ctrl=[(side*.028,.537),(side*.055,.550),(side*.086,.563),(side*.116,.569)]
 pts=[surface(x,z,.005)[0] for x,z in [(p.x,p.z) for p in C.catmull([(x,0,z) for x,z in ctrl],3)]]
 k=len(pts);hu=[.0110+.002*math.sin(math.pi*min(1,i/(k-1)*1.4))-.004*(i/(k-1))**2 for i in range(k)]
 FACE_OBS.append(C.taper_sweep('Thick brow '+bn,pts,hu,.0078,2.6,T_BROW,bn,n=10))
 BROWS[bn]={'inner':list(pts[0]),'outer':list(pts[-1])}
mouth=[surface(x,.444+.011*(1-(x/.024)**2),.0025)[0] for x in np.linspace(-.024,.024,9)]
FACE_OBS.append(C.tube('Tiny pursed frown',mouth,[.0042,.0052,.0058,.006,.006,.006,.0058,.0052,.0042],T_MOUTH,'body',n=7))
CHEEK_OBS=[]
for side in (-1,1):
 cx=side*CHEEK_X;R=.032;verts=[];faces=[];K=5;S=18
 verts.append(tuple(surface(cx,CHEEK_Z,.0014)[0]))
 for k in range(1,K+1):
  for i in range(S):
   a=math.tau*i/S;x=cx+R*k/K*math.cos(a);z=CHEEK_Z+R*k/K*math.sin(a);verts.append(tuple(surface(x,z,.0014)[0]))
 for i in range(S):faces.append((0,1+i,1+(i+1)%S))
 for k in range(1,K):
  for i in range(S):
   a0=1+(k-1)*S;a1=1+k*S;faces.append((a0+i,a1+i,a1+(i+1)%S,a0+(i+1)%S))
 ob=C.mesh('Warm blush cheek '+str(side),verts,faces,T_BLUSH,'body')
 if sum(p.normal.y for p in ob.data.polygons)<0:
  for p in ob.data.polygons:p.flip()
  ob.data.update()
 C.custom_uv(ob,lambda co,p,cx=cx,R=R:(T_BLUSH,.5+(co.x-cx)/(2*R),.5+(co.z-CHEEK_Z)/(2*R)))
 CHEEK_OBS.append(ob)

# ---- Thin stalk arms and cupped leaf mittens (broad face turned outward-forward).
SH={s:Vector((s*.125,0,.405)) for s in (-1,1)};EL={s:Vector((s*.183,.010,.362)) for s in (-1,1)};WR={s:Vector((s*.216,.020,.305)) for s in (-1,1)}
LEAF_L=.182;LEAF_HW=.074
def leaf_frame(side):
 wax=Vector((side*.10,.03,-1)).normalized();nax=Vector((side*.55,.83,0));nax=(nax-wax*nax.dot(wax)).normalized();uax=nax.cross(wax).normalized()*(-side)
 return wax,uax,nax
def leaf_hw(t):
 t=min(1,max(0,t));tt=t**.72;base=max(0,1-(2*tt-1)**2)**.58
 scallop=.90+.10*abs(math.sin(math.pi*(t*2.6+.15)))
 return LEAF_HW*base*scallop
LEAVES={};ARM_OBS=[];LEAF_OBS=[]
for side,(arm,fore,hand) in ((-1,('arm_L','fore_L','hand_L')),(1,('arm_R','fore_R','hand_R'))):
 path=C.catmull([tuple(SH[side]+Vector((-side*.035,0,.002))),tuple(SH[side]),tuple(SH[side].lerp(EL[side],.55)+Vector((side*.004,0,.005))),tuple(EL[side]),tuple(EL[side].lerp(WR[side],.5)+Vector((side*.004,0,0))),tuple(WR[side]),tuple(WR[side]+Vector((side*.003,.002,-.016)))],3)
 s,_=C.arclength(path)
 def aw(p,path=path,s=s,arm=arm,fore=fore,hand=hand):
  i=min(range(len(path)),key=lambda k:(path[k]-Vector(p)).length);t=s[i]
  if t<.14:u=smooth(t/.14);return {'body':1-u,arm:u}
  if t<.40:return {arm:1}
  if t<.56:u=smooth((t-.40)/.16);return {arm:1-u,fore:u}
  if t<.86:return {fore:1}
  u=smooth((t-.86)/.14);return {fore:1-u,hand:u}
 ARM_OBS.append(C.tube('Thin stalk arm '+arm,path,[.0145-.0035*t for t in s],T_STEM,'body',n=8,weights=aw))
 wax,uax,nax=leaf_frame(side);W=WR[side]+Vector((0,0,.002))
 rows=[];NR=15;NP=12
 for j in range(NR):
  t=.02+.97*j/(NR-1);hw=max(.004,leaf_hw(t));th=.0035+.006*math.sin(math.pi*t)**.5
  ring=[]
  for i in range(NP):
   ph=math.tau*i/NP;u=hw*math.cos(ph)
   nn=th*math.sin(ph)-.020*(abs(u)/LEAF_HW)**1.6+.012*t*t
   ring.append(W+wax*(t*LEAF_L)+uax*u+nax*nn)
  rows.append(ring)
 ob=C.rings('Cupped leaf mitten '+hand,rows,T_LEAF,hand)
 inv=Matrix((uax,wax,nax))
 C.custom_uv(ob,lambda co,p,W=W,inv=inv:(T_LEAF,.5+(inv@(co-W))[0]/(2*LEAF_HW*1.05),1-(inv@(co-W))[1]/LEAF_L))
 LEAF_OBS.append(ob)
 LEAVES[hand]={'wrist':list(W),'w_axis':list(wax),'u_axis':list(uax),'n_axis':list(nax)}

# ---- Baked soft occlusion (COLOR_0 multiplier). Occluders: stalk, crown,
# eyes and the floor, which stay rigidly placed relative to each other at rest.
AO_NAME='Baked soft occlusion'
DARK=np.array([.22,.29,.20])
def hemisphere(count=48):
 dirs=[];g=math.pi*(3-math.sqrt(5))
 for i in range(count):
  u=(i+.5)/count;r=math.sqrt(u);phi=i*g
  dirs.append((r*math.cos(phi),r*math.sin(phi),math.sqrt(max(0,1-u))))
 return dirs
DIRS=hemisphere()
occ_v=[];occ_f=[]
for ob in [stalk]+FLORET_OBS+EYE_OBS:
 base=len(occ_v);occ_v.extend(tuple(v.co) for v in ob.data.vertices);occ_f.extend(tuple(base+i for i in p.vertices) for p in ob.data.polygons)
base=len(occ_v);occ_v.extend([(-3,-3,0),(3,-3,0),(3,3,0),(-3,3,0)]);occ_f.append((base,base+1,base+2,base+3))
OCC=BVHTree.FromPolygons(occ_v,occ_f)
AO_STATS={}
def bake(ob,strength,dist=.24):
 me=ob.data;attr=me.color_attributes.new(AO_NAME,'BYTE_COLOR','POINT');vals=[]
 for v in me.vertices:
  n=v.normal.normalized();t=n.orthogonal().normalized();b=n.cross(t);o=v.co+n*.0015;occ=0.0
  if strength>0:
   for dx,dy,dz in DIRS:
    hit=OCC.ray_cast(o,t*dx+b*dy+n*dz,dist)
    if hit[0] is not None:occ+=1-(hit[3]/dist)**2
   occ/=len(DIRS)
  light=max(.10,1-strength*occ**.9);vals.append(light)
  c=DARK*(1-light)+light;attr.data[v.index].color_srgb=(float(c[0]),float(c[1]),float(c[2]),1.0)
 me.color_attributes.active_color=attr;me.color_attributes.render_color_index=me.color_attributes.active_color_index
 AO_STATS[ob.name]={'strength':strength,'min_light':round(min(vals),3),'mean_light':round(sum(vals)/len(vals),3)}
for ob in C.PARTS:
 nm=ob.name
 if nm.startswith(('Ink pupil','Pupil catchlight','Thick brow','Tiny pursed')):s=0.0
 elif nm.startswith('Cream oval eye'):s=.45
 elif nm.startswith('Thin stalk arm'):s=.55
 elif nm.startswith('Cupped leaf'):s=.45
 else:s=1.0
 bake(ob,s)

# ---- Rig: stationary root, hips/body/crown chain, feet, brows, pupils, arms.
REST={'root':((0,0,0),(0,0,.10),None),
 'hips':((0,-.01,.14),(0,-.01,.30),'root'),
 'body':((0,-.005,.30),(0,-.01,.56),'hips'),
 'crown':((0,-.06,.62),(0,-.08,.84),'body'),
 'pupils':((0,.16,.495),(0,.20,.495),'body'),
 'brow_L':((-.072,front_y(-.072,.556),.556),(-.072,front_y(-.072,.556)+.04,.556),'body'),
 'brow_R':((.072,front_y(.072,.556),.556),(.072,front_y(.072,.556)+.04,.556),'body'),
 'leg_L':((-.10,-.004,.24),(-.118,.01,.03),'root'),
 'leg_R':((.10,-.004,.24),(.118,.01,.03),'root'),
 'arm_L':(tuple(SH[-1]),tuple(EL[-1]),'body'),'fore_L':(tuple(EL[-1]),tuple(WR[-1]),'arm_L'),'hand_L':(tuple(WR[-1]),tuple(WR[-1]+leaf_frame(-1)[0]*.16),'fore_L'),
 'arm_R':(tuple(SH[1]),tuple(EL[1]),'body'),'fore_R':(tuple(EL[1]),tuple(WR[1]),'arm_R'),'hand_R':(tuple(WR[1]),tuple(WR[1]+leaf_frame(1)[0]*.16),'fore_R')}
REST={k:(tuple(float(x) for x in h),tuple(float(x) for x in t),p) for k,(h,t,p) in REST.items()}

sources=bpy.data.collections.new('EDITABLE original yes-yes veggie parts - excluded from export');sc.collection.children.link(sources)
inventory=[];copies=[]
for ob in C.PARTS:
 ob.data.calc_loop_triangles();inventory.append({'name':ob.name,'triangles':len(ob.data.loop_triangles),'bone_groups':[g.name for g in ob.vertex_groups],'atlas_tile':ob.get('atlas_tile'),'occlusion':AO_STATS.get(ob.name)})
 cp=ob.copy();cp.data=ob.data.copy();sc.collection.objects.link(cp);copies.append(cp)
 for col in list(ob.users_collection):col.objects.unlink(ob)
 sources.objects.link(ob)
sources.hide_render=True;sources.hide_viewport=True
bpy.ops.object.select_all(action='DESELECT')
for ob in copies:ob.select_set(True)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();skin=bpy.context.object;skin.name='Yes_Yes_Veggie_Skin'
for tag in ['source_part','rigid_weight','atlas_tile']:
 if tag in skin:del skin[tag]
ca=skin.data.color_attributes;assert len(ca)==1 and ca[0].name==AO_NAME,[a.name for a in ca]
ca.active_color=ca[0];ca.render_color_index=0
skin.data.calc_loop_triangles();tris=len(skin.data.loop_triangles);assert tris<=15000,tris
data=bpy.data.armatures.new('Original yes-yes veggie bounce rig');arm=bpy.data.objects.new('Yes_Yes_Veggie_Rig',data);sc.collection.objects.link(arm)
skin.select_set(False);arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
for name,(head_,tail_,parent) in REST.items():
 b=data.edit_bones.new(name);b.head=head_;b.tail=tail_
 if parent:b.parent=data.edit_bones[parent]
 b.use_deform=True
bpy.ops.object.mode_set(mode='OBJECT');mod=skin.modifiers.new('Attached broccoli skin','ARMATURE');mod.object=arm;skin.parent=arm
pts=[v.co for v in skin.data.vertices]
lo=[min(p[k] for p in pts) for k in range(3)];hi=[max(p[k] for p in pts) for k in range(3)]
arm['asset_id']='yes-yes-veggie';arm['version']='v001';arm['forward']='Blender +Y / glTF -Z';arm['neutral_total_height_m']=round(hi[2],4);arm['attack_contact_fraction']=.625
record={'asset_id':'yes-yes-veggie','version':'v001','work_order':'WO111','authoring_model':'claude-opus-5-5 xhigh (Claude Code subagent; Tom ruled Sept 26 that Opus 5.5 continues WO111 Blender work)','blender_version':bpy.app.version_string,'source_concept_sha256':sc['source_concept_sha256'],
 'build_revision':'rebuild 2 (checkpoint 1 preserved as build-checkpoint1.py, yes-yes-veggie-checkpoint1.glb and yes-yes-veggie-construction-checkpoint1.blend)',
 'rest_bounds_blender_z_up':{'min':lo,'max':hi},'height_m':hi[2],'triangles':tris,'vertices':len(skin.data.vertices),'material_count':len(skin.data.materials),'bone_count':len(data.bones),
 'texture':{'file':'pigment.png','width':1024,'height':1024,'origin':'Original deterministic indexed-palette atlas generated in Blender Python (stalk streak gradient, lit round curd bumps in crevice-edged clusters, leaf veins, radial cheek blush); no external textures.'},
 'vertex_color':{'name':AO_NAME,'use':'COLOR_0 multiplier; soft occlusion ray-traced in Blender at rest (48 cosine rays, 0.24 m) against stalk, crown, eyes and floor. Pupils, catchlights, brows and mouth stay white.','dark_srgb':DARK.tolist()},
 'parts':inventory,'face':{'eyes':EYES,'brows':BROWS},'leaves':LEAVES,
 'concept_resolution':['Front, side and back construction views are attachment authority: two feet split by a narrow notch, arms leave the stalk sides just below the cheeks, leaf mittens hang at hip height, crown about 0.72 m wide.',
  'Measured from the concept back view: trunk half-width about 0.13-0.15 m below the flare, flare from about 0.55 m, crown from about 0.52 m to 1.0 m.',
  'The stalk rises and splits into nine thick branches whose tips end inside their florets; the trunk closes in a low dome hidden under the crown, so slits between branches read dark (baked occlusion) instead of a cut shelf.',
  'Side view: crown centred about 0.1 m behind the face and about 0.58 m deep; its front edge sits slightly ahead of the face.',
  'Crown modelled as eleven lumpy floret domes; fine curd bumps are painted in the atlas, not modelled.',
  'Leaf mittens are broad rounded spinach-like leaves cupped along the midrib, broad face turned outward-forward so they read in front, side and back views.',
  'Pupils glare inward toward the nose as in the concept front view; brows tilt down to the middle.'],
 'notes':['Original vegetable character; no franchise face, lettering, costume or borrowed media.','No teeth, spikes or scary features; comic stubborn expression only.','Every part is skinned to one rig.']}
(ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n');(ROOT/'source/rig-rest.json').write_text(json.dumps({'rest':REST},indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'yes-yes-veggie-construction.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(ROOT/'yes-yes-veggie-checkpoint.glb'),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_yup=True,export_apply=False,export_armature_object_remove=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_vertex_color='ACTIVE',export_all_vertex_colors=False,export_cameras=False,export_lights=False,export_extras=True)
print(json.dumps({k:record[k] for k in ['triangles','vertices','height_m','material_count','bone_count','rest_bounds_blender_z_up']}))
print(json.dumps([(p['name'],p['triangles'],p['occlusion']) for p in inventory]))
