"""WO111 original stubborn broccoli ordinary, built only through Blender MCP.

The selected Astra concept supplies proportions, colours and part attachment:
a chunky pale-lime stalk that splits into two stubby rounded feet, a broad
dark-green crown of big scalloped florets on short branches, two thin stalk
arms ending in folded leaf mittens, big cream oval eyes glaring inward, thick
dark plum brows tilted down to the middle, a tiny pursed frown and warm
cheeks. Shapes, painted atlas, rig and acting are original.
Blender +Y forward becomes glTF -Z forward; anatomical left is Blender -X.
"""
import bpy, bmesh, math, json, hashlib, importlib.util, struct, zlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler
import numpy as np

ROOT=Path('/workspace/haynes-quest/family-eras/yes-yes-veggie/v001')
sc=bpy.context.scene
assert sc.get('work_order')=='WO111' and sc.get('scene_lease')=='active' and sc.get('asset_id')=='yes-yes-veggie'
spec=importlib.util.spec_from_file_location('wo111_veggie_common',ROOT/'source/common.py')
C=importlib.util.module_from_spec(spec);spec.loader.exec_module(C);C.BASE=ROOT.parent

# ---- Atlas tiles (4x4 of 256 px, 16 palette levels each).
T_BODY,T_BODY_DEEP,T_FOOT,T_CURD,T_CURD_DEEP,T_LEAF,T_BRANCH,T_EYE,T_PUPIL,T_CATCH,T_BROW,T_MOUTH,T_BLUSH,T_STEM,T_CREASE,T_SPARE=range(16)
V_TOP=.80;STALK_TRIS=3800
BODY_RAMP=[(0,'6f8a33'),(.28,'a0a946'),(.62,'c2cb62'),(1,'dade7c')]
def body_level(V):return (.42+.52*min(V,.8)**1.1)*(1-.62*smooth((V-.79)/.17))
def hexrgb(h):return np.array([int(h[j:j+2],16)/255 for j in (0,2,4)])
def ramp_color(stops,x):
 x=min(1,max(0,x))
 for (a,ca),(b,cb) in zip(stops,stops[1:]):
  if x<=b:t=(x-a)/(b-a);return hexrgb(ca)*(1-t)+hexrgb(cb)*t
 return hexrgb(stops[-1][1])
CHEEK_Z=.428
BLUSH_EDGE=ramp_color(BODY_RAMP,body_level(CHEEK_Z/V_TOP))
def rgbhex(c):return ''.join('%02x'%int(round(v*255)) for v in c)

def atlas():
 rng=np.random.default_rng(11104);yy,xx=np.mgrid[0:256,0:256]
 U=np.clip((xx/255-C.TILE_INSET)/C.TILE_SPAN,0,1);V=np.clip((yy/255-C.TILE_INSET)/C.TILE_SPAN,0,1)
 fine=rng.integers(-1,2,(256,256))*.012
 def curd(seed,count):
  r=np.random.default_rng(seed);pts=r.uniform(-.05,1.05,(count,2));tone=r.uniform(.62,1.0,count)
  d1=np.full((256,256),9.0);d2=np.full((256,256),9.0);idx=np.zeros((256,256),int)
  for k,(px,py) in enumerate(pts):
   dd=np.hypot(U-px,V-py);m=dd<d1;d2=np.where(m,d1,np.minimum(d2,dd));idx[m]=k;d1[m]=dd[m]
  dmax=.5/math.sqrt(count)*1.3
  edge=np.clip((d2-d1)/.010,0,1)**.5
  dome=np.sqrt(np.clip(1-(d1/dmax)**2,0,1))
  broad=.5+.5*np.sin(U*7.1+1.2)*np.sin(V*6.3+.4)
  return np.clip(.14+.62*tone[idx]*edge*(.45+.55*dome)+.10*broad+fine,0,1)
 def seg(ax,ay,bx,by):
  px,py=U-ax,V-ay;vx,vy=bx-ax,by-ay;t=np.clip((px*vx+py*vy)/(vx*vx+vy*vy),0,1)
  return np.hypot(px-t*vx,py-t*vy),t
 streak=(.030*np.sin(math.tau*7*U+1.3+.6*np.sin(3*V))+.022*np.sin(math.tau*13*U+.4)+.016*np.sin(math.tau*23*U+2.1+.8*V)+.010*np.sin(math.tau*37*U+.9))
 leaf=.30+.05*np.sin(U*9+V*5)+fine
 mid,_=seg(.5,1.0,.5,.04);leaf=np.where(mid<.020,1.0,np.where(mid<.034,np.maximum(leaf,.62),leaf))
 for vk in (.80,.60,.40,.22):
  for s in (-1,1):
   dd,t=seg(.5,vk,.5+s*.40,vk-.20);w=.014*(1-.5*t)
   leaf=np.where(dd<w,np.maximum(leaf,.85-.25*t),leaf)
 r=np.hypot(U-.5,V-.5)*2
 tiles={
  T_BODY:(BODY_RAMP,np.clip(body_level(V)+streak+fine*.5,0,1)),
  T_BODY_DEEP:([(0,'5d6a26'),(1,'86913b')],np.clip(.5+streak+fine,0,1)),
  T_FOOT:([(0,'a9b24e'),(.5,'c3cb68'),(1,'d8de82')],np.clip(.35+.45*V+streak*.8+fine*.5,0,1)),
  T_CURD:([(0,'1b3011'),(.45,'3a5f25'),(1,'6c9844')],curd(21,1000)),
  T_CURD_DEEP:([(0,'142610'),(1,'3d5f26')],curd(22,1000)),
  T_LEAF:([(0,'2b4c1c'),(.30,'3c6628'),(.62,'527c35'),(1,'98b866')],np.clip(leaf,0,1)),
  T_BRANCH:([(0,'98a947'),(1,'b8c55c')],np.clip(.35+.4*V+streak+fine,0,1)),
  T_EYE:([(0,'e6d8bb'),(1,'f6ecd6')],np.clip(.55+.35*V+fine,0,1)),
  T_PUPIL:([(0,'120e0d'),(1,'2a2220')],np.clip(.4+fine*2,0,1)),
  T_CATCH:([(0,'f7efe2'),(1,'fffbf2')],np.clip(.6+fine,0,1)),
  T_BROW:([(0,'3a2023'),(1,'5a3436')],np.clip(.45+.3*V+fine,0,1)),
  T_MOUTH:([(0,'3e1f25'),(1,'5c3037')],np.clip(.5+fine,0,1)),
  T_BLUSH:([(0,'ee9a7a'),(.35,'eea07e'),(1,rgbhex(BLUSH_EDGE))],np.clip((r-.05)/.95,0,1)**.9),
  T_STEM:([(0,'9fb04c'),(1,'c0ca63')],np.clip(.45+.3*V+streak+fine,0,1)),
  T_CREASE:([(0,'98a246'),(1,'aeb656')],np.clip(.5+fine,0,1)),
  T_SPARE:([(0,'c9d06e'),(1,'dfe48c')],np.clip(.5+fine,0,1)),
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

smooth=C.smooth
def lerp_profile(rows,z,k):
 if z<=rows[0][0]:return rows[0][k]
 for r0,r1 in zip(rows,rows[1:]):
  if z<=r1[0]:t=(z-r0[0])/(r1[0]-r0[0]);return r0[k]+(r1[k]-r0[k])*t
 return rows[-1][k]

# ---- Stalk sculpt volume: the trunk (slight stubborn forward lean at the
# face, concave flare under the crown), two stubby feet and the branches are
# lofted separately, merged by a voxel remesh, softened into organic fillets
# and decimated, so the stalk flows into the feet and splits into arched
# branches like the concept. Face parts are ray-cast onto the result.
from mathutils.bvhtree import BVHTree
E_TRUNK=2.6
KEY=[(.12,.05,.035,-.02),(.13,.11,.08,-.02),(.15,.14,.10,-.02),(.18,.158,.114,-.018),(.23,.166,.121,-.013),(.30,.162,.121,-.002),(.38,.156,.12,.012),(.45,.157,.124,.022),(.50,.161,.126,.02),(.54,.170,.130,.014),(.58,.188,.138,.004),(.61,.207,.146,-.006),(.63,.218,.150,-.013),(.645,.214,.146,-.018),(.655,.19,.128,-.021),(.662,.13,.088,-.023),(.665,.05,.035,-.024)]
def trunk_cy(z):return lerp_profile(KEY,min(z,.665),3)
LEG=[(0.0,.068,.098,.125,.006),(.006,.086,.118,.125,.006),(.02,.096,.13,.125,.002),(.055,.10,.133,.125,-.004),(.095,.096,.123,.12,-.01),(.13,.092,.113,.108,-.014),(.17,.089,.106,.093,-.017),(.22,.082,.09,.078,-.016),(.28,.074,.082,.075,-.014),(.34,.064,.072,.07,-.012)]
# Branch lofts: wide flattened bases that ring the flare rim and overlap, so
# the flare continues up into the branches with arched crotches between them.
BRANCHES=[([(0,.085,.60),(0,.07,.69),(0,.02,.79)],(.075,.055),(.042,.042)),
 ([(-.15,.055,.60),(-.17,.045,.68),(-.215,.03,.75)],(.07,.05),(.042,.042)),([(.15,.055,.60),(.17,.045,.68),(.215,.03,.75)],(.07,.05),(.042,.042)),
 ([(-.20,-.02,.60),(-.225,-.045,.60),(-.245,-.065,.595)],(.06,.05),(.038,.036)),([(.20,-.02,.60),(.225,-.045,.60),(.245,-.065,.595)],(.06,.05),(.038,.036)),
 ([(-.12,-.10,.60),(-.145,-.15,.665),(-.17,-.20,.715)],(.07,.05),(.042,.042)),([(.12,-.10,.60),(.145,-.15,.665),(.17,-.20,.715)],(.07,.05),(.042,.042)),
 ([(0,-.13,.60),(0,-.18,.61),(0,-.22,.61)],(.07,.05),(.04,.04))]
geo_v=[];geo_f=[]
def add_rings(rr,caps=True):
 base=len(geo_v);n=len(rr[0])
 for r in rr:geo_v.extend(tuple(p) for p in r)
 for j in range(len(rr)-1):
  for i in range(n):geo_f.append((base+j*n+i,base+j*n+(i+1)%n,base+(j+1)*n+(i+1)%n,base+(j+1)*n+i))
 if caps:geo_f.extend([tuple(base+i for i in range(n-1,-1,-1)),tuple(base+(len(rr)-1)*n+i for i in range(n))])
rr=[]
for z,a_,b_,cy in KEY:
 e=E_TRUNK-.45*smooth((z-.56)/.08)
 rr.append([(x,cy+y,z) for x,y in (C.superellipse(a_,b_,e,math.tau*i/48) for i in range(48))])
add_rings(rr)
for side in (-1,1):add_rings([[(side*cx+x,cy+y,z) for x,y in (C.superellipse(a_,b_,2.4,math.tau*i/32) for i in range(32))] for z,a_,b_,cx,cy in LEG])
for pts,(w0,d0),(w1,d1) in BRANCHES:
 path=[Vector(q) for q in C.catmull(pts,4)];s_,_=C.arclength(path);B=path[0]
 radial=Vector((B.x,B.y-trunk_cy(.60),0)).normalized();rows=[]
 for i,(q,t) in enumerate(zip(path,s_)):
  tg=(path[min(i+1,len(path)-1)]-path[max(i-1,0)]).normalized();S=tg.cross(radial).normalized();D=S.cross(tg).normalized()
  w=w0+(w1-w0)*smooth(t);d=d0+(d1-d0)*smooth(t)
  rows.append([q+w*math.cos(math.tau*j/16)*S+d*math.sin(math.tau*j/16)*D for j in range(16)])
 add_rings(rows)
sd=bpy.data.meshes.new('Stalk sculpt volume');sd.from_pydata(geo_v,[],geo_f);sd.update()
bm=bmesh.new();bm.from_mesh(sd);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(sd);bm.free()
stalk=bpy.data.objects.new('Stalk sculpt volume',sd);bpy.context.collection.objects.link(stalk)
bpy.context.view_layer.objects.active=stalk;stalk.select_set(True)
m=stalk.modifiers.new('Voxel merge','REMESH');m.mode='VOXEL';m.voxel_size=.005;m.adaptivity=0;m.use_smooth_shade=True
m=stalk.modifiers.new('Organic fillets','SMOOTH');m.factor=.6;m.iterations=8
m=stalk.modifiers.new('Game budget','DECIMATE');m.decimate_type='COLLAPSE';m.use_collapse_triangulate=True
stalk.modifiers['Game budget'].ratio=1.0
for mod in list(stalk.modifiers)[:2]:bpy.ops.object.modifier_apply(modifier=mod.name)
dense=len(stalk.data.polygons)
stalk.modifiers['Game budget'].ratio=min(1.0,STALK_TRIS/(2.0*dense));bpy.ops.object.modifier_apply(modifier='Game budget')
stalk.select_set(False)
def stalk_weights(p):
 z=p.z;wl=(1-smooth((z-.10)/.15))*smooth(abs(p.x)/.03)
 wb=smooth((z-.26)/.16);wc=smooth((z-.63)/.12)
 w={'hips':(1-wb)*(1-wl),'body':wb*(1-wc)*(1-wl),'crown':wb*wc*(1-wl)}
 w['leg_L' if p.x<0 else 'leg_R']=wl
 return w
C.finish(stalk,'Pale lime broccoli stalk, feet and branches',T_BODY,'body',weights=stalk_weights)
def stalk_uv(co,p):
 cy=trunk_cy(co.z);u=abs(math.atan2(co.x,co.y-cy))/math.pi;v=co.z/V_TOP
 deep=p.center.z>.655 and math.hypot(p.center.x/.20,(p.center.y-trunk_cy(.66))/.14)<.55
 return (T_BODY_DEEP if deep else T_BODY),u,v
C.custom_uv(stalk,stalk_uv)
BVH=BVHTree.FromPolygons([tuple(v.co) for v in stalk.data.vertices],[tuple(p.vertices) for p in stalk.data.polygons])
def surface(x,z,off=0.0):
 hit,n,_,_=BVH.ray_cast(Vector((x,1.0,z)),Vector((0,-1,0)))
 assert hit is not None,(x,z)
 n=n.normalized()
 if n.y<0:n=-n
 return hit+n*off,n
def front_y(x,z):return surface(x,z)[0].y
for side,bn in ((-1,'leg_L'),(1,'leg_R')):
 for k,dx in enumerate((-.03,.03)):
  pts=[surface(side*.125+dx,z,-.0012)[0] for z in (.03,.042,.055,.068,.08)]
  C.tube('Soft toe crease %s %d'%(bn,k),pts,.0032,T_CREASE,bn,n=5)

# ---- Crown: big scalloped florets (broad soft lobes, curd detail in the atlas).
def floret(name,c,R,seed,n=28,r=15,lobes=7,amp=.075,width=.62,flat=.74):
 g=np.random.default_rng(seed);dirs=[]
 golden=math.pi*(3-math.sqrt(5))
 for k in range(lobes):
  zz=1-1.35*(k+.5)/lobes;zz=max(-.35,min(.98,zz+g.uniform(-.08,.08)));phi=k*golden+g.uniform(0,.6)
  rad=math.sqrt(max(0,1-zz*zz));dirs.append(Vector((rad*math.cos(phi),rad*math.sin(phi),zz)).normalized())
 center=Vector(c);rows=[]
 for j in range(r+1):
  a=-math.pi/2+math.pi*j/r;ca=max(.00015,math.cos(a))
  row=[]
  for i in range(n):
   th=math.tau*i/n;d=Vector((ca*math.cos(th),ca*math.sin(th),math.sin(a)))
   b=sum(math.exp(-((d.angle(k))/width)**2)**4 for k in dirs)**.25
   radius=R*(1-amp+amp*min(1,b))
   p=d*radius
   if p.z<0:p.z*=flat
   row.append(center+p)
  rows.append(row)
 return C.rings(name,rows,T_CURD,'crown',face_tile=lambda cc,nn:T_CURD_DEEP if nn.z<-.80 else None)
FLORETS=[('Top centre floret',(0,-.03,.855),.148,1,28,15),('Front left floret',(-.245,.025,.74),.158,2,28,15),('Front right floret',(.245,.025,.74),.152,3,28,15),
 ('Back left floret',(-.17,-.22,.74),.15,4,24,13),('Back right floret',(.17,-.22,.74),.15,5,24,13),
 ('Low left floret',(-.25,-.07,.585),.105,6,20,11),('Low right floret',(.25,-.07,.59),.105,7,20,11),
 ('Top back left floret',(-.15,-.13,.87),.112,8,20,11),('Top back right floret',(.15,-.13,.87),.112,9,20,11),('Low back floret',(0,-.24,.60),.12,10,20,11)]
for name,c,R,seed,n,r in FLORETS:floret(name,c,R,seed,n,r)

# ---- Face: big cream oval eyes with inward-glaring pupils, thick plum brows,
# a tiny pursed frown and radial blush cheeks painted on the stalk surface.
EYE_Z=.495;EYE_X=.075;EYE_R=(.043,.021,.052)
def aligned(n):return Vector((0,1,0)).rotation_difference(n).to_euler()
EYES={}
for side in (-1,1):
 c,n=surface(side*EYE_X,EYE_Z,-.004);rot=aligned(n);M=rot.to_matrix()
 C.ellipsoid('Cream oval eye '+str(side),tuple(c),EYE_R,T_EYE,'body',1,n=20,r=9,rot=tuple(rot))
 dx,dz=-side*.012,.004;q=max(0,1-(dx/EYE_R[0])**2-(dz/EYE_R[2])**2)
 pc=c+M@Vector((dx,EYE_R[1]*math.sqrt(q)-.0045,dz))
 C.ellipsoid('Ink pupil '+str(side),tuple(pc),(.021,.009,.025),T_PUPIL,'pupils',1,n=16,r=8,rot=tuple(rot))
 C.ellipsoid('Pupil catchlight '+str(side),tuple(pc+M@Vector((side*.006,.0075,.008))),(.0065,.003,.0075),T_CATCH,'pupils',1,n=10,r=5,rot=tuple(rot))
 EYES[side]={'centre':list(c),'normal':list(n),'pupil':list(pc)}
BROWS={}
for side,bn in ((-1,'brow_L'),(1,'brow_R')):
 ctrl=[(side*.028,.536),(side*.055,.549),(side*.086,.562),(side*.116,.568)]
 pts=[surface(x,z,.005)[0] for x,z in [(p.x,p.z) for p in C.catmull([(x,0,z) for x,z in ctrl],3)]]
 k=len(pts);hu=[.0105+.002*math.sin(math.pi*min(1,i/(k-1)*1.4))-.004*(i/(k-1))**2 for i in range(k)]
 C.taper_sweep('Thick plum brow '+bn,pts,hu,.0075,2.6,T_BROW,bn,n=10)
 BROWS[bn]={'inner':list(pts[0]),'outer':list(pts[-1])}
mouth=[surface(x,.444+.011*(1-(x/.024)**2),.0025)[0] for x in np.linspace(-.024,.024,9)]
C.tube('Tiny pursed frown',mouth,[.0042,.0052,.0058,.006,.006,.006,.0058,.0052,.0042],T_MOUTH,'body',n=7)
for side in (-1,1):
 cx=side*.103;R=.032;verts=[];faces=[];K=5;S=18
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

# ---- Thin stalk arms and folded leaf mittens.
SH={-1:Vector((-.15,0,.43)),1:Vector((.15,0,.43))};EL={-1:Vector((-.205,.012,.39)),1:Vector((.205,.012,.39))};WR={-1:Vector((-.24,.03,.325)),1:Vector((.24,.03,.325))}
LEAF_L=.18;LEAF_HW=.074
def leaf_frame(side):
 wax=Vector((side*.08,.03,-1)).normalized();nax=Vector((side*.36,.93,0));nax=(nax-wax*nax.dot(wax)).normalized();uax=nax.cross(wax).normalized()*(-side)
 return wax,uax,nax
def leaf_hw(t):
 t=min(1,max(0,t));base=math.sin(math.pi*t**.85)**.45*(1-.10*t)
 scallop=.84+.16*abs(math.sin(math.pi*(t*2.4+.08)))
 return LEAF_HW*base*scallop
LEAVES={}
for side,(arm,fore,hand) in ((-1,('arm_L','fore_L','hand_L')),(1,('arm_R','fore_R','hand_R'))):
 path=C.catmull([tuple(SH[side]+Vector((-side*.04,0,.002))),tuple(SH[side]),tuple(SH[side].lerp(EL[side],.55)+Vector((side*.004,0,.006))),tuple(EL[side]),tuple(EL[side].lerp(WR[side],.5)+Vector((side*.004,0,0))),tuple(WR[side]),tuple(WR[side]+Vector((side*.004,.002,-.018)))],3)
 s,_=C.arclength(path)
 def aw(p,path=path,s=s,arm=arm,fore=fore,hand=hand):
  i=min(range(len(path)),key=lambda k:(path[k]-Vector(p)).length);t=s[i]
  if t<.14:u=smooth(t/.14);return {'body':1-u,arm:u}
  if t<.40:return {arm:1}
  if t<.56:u=smooth((t-.40)/.16);return {arm:1-u,fore:u}
  if t<.86:return {fore:1}
  u=smooth((t-.86)/.14);return {fore:1-u,hand:u}
 C.tube('Thin stalk arm '+arm,path,[.022-.006*t for t in s],T_STEM,'body',n=9,weights=aw)
 wax,uax,nax=leaf_frame(side);W=WR[side]+Vector((0,0,.004))
 rows=[];NR=16;NP=12
 for j in range(NR):
  t=.015+.975*j/(NR-1);hw=max(.004,leaf_hw(t));th=.0035+.0065*math.sin(math.pi*t)**.5
  ring=[]
  for i in range(NP):
   ph=math.tau*i/NP;u=hw*math.cos(ph)
   nn=th*math.sin(ph)-.018*(abs(u)/LEAF_HW)**1.5+.015*t*t
   ring.append(W+wax*(t*LEAF_L)+uax*u+nax*nn)
  rows.append(ring)
 ob=C.rings('Folded leaf mitten '+hand,rows,T_LEAF,hand)
 inv=Matrix((uax,wax,nax))
 C.custom_uv(ob,lambda co,p,W=W,inv=inv:(T_LEAF,.5+(inv@(co-W))[0]/(2*LEAF_HW*1.05),1-(inv@(co-W))[1]/LEAF_L))
 LEAVES[hand]={'wrist':list(W),'w_axis':list(wax),'u_axis':list(uax),'n_axis':list(nax)}

# ---- Rig: stationary root, hips/body/crown chain, feet, brows, pupils, arms.
def fy(x,z):return front_y(x,z)
REST={'root':((0,0,0),(0,0,.10),None),
 'hips':((0,-.02,.13),(0,-.02,.30),'root'),
 'body':((0,-.005,.30),(0,-.005,.56),'hips'),
 'crown':((0,-.03,.61),(0,-.03,.82),'body'),
 'pupils':((0,.16,.50),(0,.20,.50),'body'),
 'brow_L':((-.072,fy(-.072,.556),.556),(-.072,fy(-.072,.556)+.04,.556),'body'),
 'brow_R':((.072,fy(.072,.556),.556),(.072,fy(.072,.556)+.04,.556),'body'),
 'leg_L':((-.10,-.02,.26),(-.125,-.01,.03),'root'),
 'leg_R':((.10,-.02,.26),(.125,-.01,.03),'root'),
 'arm_L':(tuple(SH[-1]),tuple(EL[-1]),'body'),'fore_L':(tuple(EL[-1]),tuple(WR[-1]),'arm_L'),'hand_L':(tuple(WR[-1]),tuple(WR[-1]+Vector((-.015,.01,-.16))),'fore_L'),
 'arm_R':(tuple(SH[1]),tuple(EL[1]),'body'),'fore_R':(tuple(EL[1]),tuple(WR[1]),'arm_R'),'hand_R':(tuple(WR[1]),tuple(WR[1]+Vector((.015,.01,-.16))),'fore_R')}
REST={k:(tuple(float(x) for x in h),tuple(float(x) for x in t),p) for k,(h,t,p) in REST.items()}

sources=bpy.data.collections.new('EDITABLE original yes-yes veggie parts - excluded from export');sc.collection.children.link(sources)
inventory=[];copies=[]
for ob in C.PARTS:
 ob.data.calc_loop_triangles();inventory.append({'name':ob.name,'triangles':len(ob.data.loop_triangles),'bone_groups':[g.name for g in ob.vertex_groups],'atlas_tile':ob.get('atlas_tile')})
 cp=ob.copy();cp.data=ob.data.copy();sc.collection.objects.link(cp);copies.append(cp)
 for col in list(ob.users_collection):col.objects.unlink(ob)
 sources.objects.link(ob)
sources.hide_render=True;sources.hide_viewport=True
bpy.ops.object.select_all(action='DESELECT')
for ob in copies:ob.select_set(True)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();skin=bpy.context.object;skin.name='Yes_Yes_Veggie_Skin'
for tag in ['source_part','rigid_weight','atlas_tile']:
 if tag in skin:del skin[tag]
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
 'rest_bounds_blender_z_up':{'min':lo,'max':hi},'height_m':hi[2],'triangles':tris,'vertices':len(skin.data.vertices),'material_count':len(skin.data.materials),'bone_count':len(data.bones),
 'texture':{'file':'pigment.png','width':1024,'height':1024,'origin':'Original deterministic painted palette atlas generated in Blender Python (stalk streak gradient, Voronoi floret curds, leaf veins, radial cheek blush); no external textures.'},
 'parts':inventory,'face':{'eyes':EYES,'brows':BROWS},'leaves':LEAVES,
 'concept_resolution':['Front, side and back construction views are attachment authority: two feet split by a narrow notch, arms leave the stalk sides just below the eyes, leaf mittens hang at hip height, crown about 0.75 m wide.','Side view: the stalk leans forward at the face and tucks back under the crown; crown centred about 0.1 m behind the face and about 0.55 m deep.','Crown modelled as ten broad scalloped floret domes on short branches; the fine curd texture is painted in the atlas, not modelled.','Pupils glare inward toward the nose as in the concept front view; brows tilt down to the middle.'],
 'notes':['Original vegetable character; no franchise face, lettering, costume or borrowed media.','No teeth, spikes or scary features; comic stubborn expression only.','Every part is skinned to one rig.']}
(ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n');(ROOT/'source/rig-rest.json').write_text(json.dumps({'rest':REST},indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'yes-yes-veggie-construction.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(ROOT/'yes-yes-veggie-checkpoint.glb'),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_yup=True,export_apply=False,export_armature_object_remove=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=True)
print(json.dumps({k:record[k] for k in ['triangles','vertices','height_m','material_count','bone_count','rest_bounds_blender_z_up']}))
print(json.dumps([(p['name'],p['triangles']) for p in inventory]))
