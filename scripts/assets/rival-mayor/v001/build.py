"""WO111 rival-mayor v001: final budgeted model from the approved Blender reference sheet.

Source authority: reference-sheet.png and rival-mayor-blockout.blend (coordinator
approved Sept 26, "Blender reference sheet, no generated concept"). The blockout's
measured coordinates are kept for silhouette, colour and parody hooks: tilted
stovepipe hat with a kitten badge, egg head, long rosy nose, smug side-glance,
huge curly handlebar mustache (enlarged 12% per the coordinator note), pear
aubergine tailcoat over a honey waistcoat, raspberry sash with a kitten rosette,
skinny pinstripe legs, cream spats, long pointed shoes, left fist on the hip and a
teal remote with a big button, dials, a brass crank and a spring antenna topped by
a tiny propeller. Topology, weights, rig and atlas are new.

Blender +Z up / +Y forward (glTF +Y up / -Z forward), floor-centred root, right = +X.
The bind pose is the sheet pose (fist on hip, remote held out); every limb has
blended joint weights so animation can leave it.
"""
import bpy, math, json, hashlib, importlib.util, struct, zlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler
import numpy as np

ROOT=Path('/workspace/haynes-quest/family-eras/rival-mayor/v001')
sc=bpy.context.scene
assert sc.get('work_order')=='WO111' and sc.get('scene_lease')=='active' and sc.get('asset_id')=='rival-mayor'
spec=importlib.util.spec_from_file_location('wo111_rival_mayor_common',ROOT/'source/common.py')
C=importlib.util.module_from_spec(spec);spec.loader.exec_module(C)

# ---- Atlas: 16 sheet colours, each a 256 px tile with a quiet painted field.
COLORS=['5b3b6a','2f2740','b54a5a','dca953','3f7f7a','f3e6cf','efc9a4','e39a88','2b2238','342c46','c9923e','3a2e4d','8a7c96','fbf6ec','2f625e','8f3848']
COAT,PLUM,SASH,HONEY,TEAL,CREAM,SKIN,NOSE,STACHE,INK,BRASS,STRIPE_D,STRIPE_L,WHITE,TEAL_D,SASH_D=range(16)
def atlas():
 rng=np.random.default_rng(11104);yy,xx=np.mgrid[0:256,0:256]
 indices=np.zeros((1024,1024),dtype=np.uint8);palette=[]
 for i,h in enumerate(COLORS):
  rgb=np.array([int(h[j:j+2],16)/255 for j in (0,2,4)])
  field=.012*np.sin(xx*.029+yy*.019+i)+.008*np.cos(xx*.067-yy*.041+2*i)
  field+=rng.integers(-1,2,(256,256))*.002
  levels=np.clip(np.round((field+.04)/.0055),0,15).astype(np.uint8)
  for level in range(16):palette.extend(np.round(np.clip(rgb+(-.04+level*.0055),.01,.98)*255).astype(np.uint8).tolist())
  row=3-i//4;col=i%4;indices[row*256:(row+1)*256,col*256:(col+1)*256]=i*16+levels
 def chunk(name,data):return struct.pack('>I',len(data))+name+data+struct.pack('>I',zlib.crc32(name+data)&0xffffffff)
 raw=b''.join(b'\x00'+row.tobytes() for row in indices[::-1])
 png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1024,1024,8,3,0,0,0))+chunk(b'PLTE',bytes(palette))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
 (ROOT/'pigment.png').write_bytes(png)

atlas()
keep={k:sc[k] for k in sc.keys() if k.startswith('blendermcp_') or k in ('work_order','scene_owner','scene_lease','asset_id','asset_version','authoring_model')}
C.setup(ROOT,[('Matte painted felt, cloth and skin',.84),('Satin eyes, buttons, brass, shoes and remote',.42)],'rival-mayor original painted 1024 atlas')
for key in list(sc.keys()):
 if key not in keep and key!='cycles':del sc[key]
sc['candidate_status']="WO111 rival-mayor v001 · Awaiting Tom's review · used in the family release"
sc['source_reference']='Blender reference sheet, no generated concept'
sc['source_sheet_sha256']=hashlib.sha256((ROOT/'reference-sheet.png').read_bytes()).hexdigest()
sc['source_blockout_sha256']=hashlib.sha256((ROOT/'rival-mayor-blockout.blend').read_bytes()).hexdigest()
sc['orientation']='Blender +Z up/+Y forward; glTF +Y up/-Z forward; stationary identity floor root; character right = +X'

def V(*a):return Vector(a)

# ================= Body surfaces (shared by coat, waistcoat, sash, lapels) =================
COAT_P=[(0.62,0.0),(0.625,0.20),(0.636,0.27),(0.655,0.305),(0.70,0.335),(0.82,0.365),(0.95,0.372),(1.08,0.360),(1.20,0.330),(1.30,0.290),(1.38,0.245),(1.44,0.190),(1.48,0.125),(1.51,0.0)]
COAT_EY=0.90
VEST_C=V(0,0.20,1.10);VEST_S=V(0.165,0.15,0.38)
def g_coat(p):
 r=C.interp(COAT_P,p.z)
 if p.z<COAT_P[0][0] or p.z>COAT_P[-1][0] or r<1e-4:return 9.0
 return (p.x/r)**2+(p.y/(COAT_EY*r))**2
def g_vest(p):
 d=p-VEST_C;return (d.x/VEST_S.x)**2+(d.y/VEST_S.y)**2+(d.z/VEST_S.z)**2
def g_body(p):return min(g_coat(p),g_vest(p))
def body_normal(p,h=1e-3):
 gx=g_body(p+V(h,0,0))-g_body(p-V(h,0,0));gy=g_body(p+V(0,h,0))-g_body(p-V(0,h,0));gz=g_body(p+V(0,0,h))-g_body(p-V(0,0,h))
 return V(gx,gy,gz).normalized()
def ray_surface(c,d,far=0.9):
 lo,hi=0.0,far
 for _ in range(44):
  mid=(lo+hi)/2
  if g_body(c+d*mid)<1:lo=mid
  else:hi=mid
 p=c+d*lo;return p,body_normal(p)
def front_y(x,z):
 p,_=ray_surface(V(x,0,z),V(0,1,0),0.7);return p.y
def coat_w(p):
 t=C.smooth((p.z-0.92)/0.22);return {'hips':1-t,'chest':t}

def patch(name,grid,tile,thick,off=0.003,sink=0.004,mat=0,weights=None,face_tile=None):
 """Thick surface patch: grid[row][col] of (x, z) projected onto the front body surface."""
 R=len(grid);K=len(grid[0]);top=[];bot=[]
 for row in grid:
  for x,z in row:
   p,N=ray_surface(V(x,0,z),V(0,1,0),0.7)
   top.append(p+N*(off+thick));bot.append(p-N*sink)
 verts=top+bot;faces=[];nb=R*K
 idx=lambda r,c:r*K+c
 for r in range(R-1):
  for c in range(K-1):
   faces.append((idx(r,c),idx(r,c+1),idx(r+1,c+1),idx(r+1,c)))
   faces.append((nb+idx(r,c),nb+idx(r+1,c),nb+idx(r+1,c+1),nb+idx(r,c+1)))
 ring=[idx(0,c) for c in range(K)]+[idx(r,K-1) for r in range(1,R)]+[idx(R-1,c) for c in range(K-2,-1,-1)]+[idx(r,0) for r in range(R-2,0,-1)]
 for a,b in zip(ring,ring[1:]+ring[:1]):faces.append((a,b,nb+b,nb+a))
 return C.mesh(name,[tuple(v) for v in verts],faces,tile,'chest',mat,True,weights or coat_w,face_tile)

# ================= Rig rest layout (bind pose = approved sheet pose) =================
S_R=V(0.235,0.0,1.385);E_R=V(0.445,0.05,1.095)
L_UP=(E_R-S_R).length;L_FORE=0.235
W_R=E_R+V(0.431,0.431,-0.794).normalized()*L_FORE
S_L=V(-0.235,0.0,1.385);E_L=S_L+V(-0.776,-0.075,-0.626).normalized()*L_UP
FIST_L=V(-0.385,0.05,0.93);W_L=E_L+(FIST_L-E_L).normalized()*L_FORE
REM_M=Matrix.Translation((0.60,0.18,0.99))@Matrix.Rotation(0.12,4,'X')@Matrix.Diagonal((1.32,1.32,1.32,1))
def R(p):return REM_M@V(*p)
HAT_M=Matrix.Translation((0.0,-0.005,1.955))@Euler((-0.05,0.11,0.0)).to_matrix().to_4x4()
ST_PIV=V(0,0.31,1.70);ST_M=Matrix.Translation(ST_PIV)@Matrix.Diagonal((1.12,1.12,1.12,1))@Matrix.Translation(-ST_PIV)
LEG_X=0.135;HIP_Z=0.77;KNEE=V(0,0.015,0.445);ANK_Z=0.13
# Swallow tails hang from the back hem forward-down toward the calves, as in the sheet's side view.
TAIL_TILT=0.30
REST={'root':((0,0,0),(0,0,.1),None),
 'hips':((0,0,.80),(0,0,1.00),'root'),
 'chest':((0,0,1.00),(0,0,1.44),'hips'),
 'neck':((0,.01,1.44),(0,.01,1.56),'chest'),
 'head':((0,.01,1.56),(0,.01,1.95),'neck'),
 'hat':(tuple(HAT_M@V(0,0,0)),tuple(HAT_M@V(0,0,.30)),'head'),
 'mustache_R':(tuple(ST_M@V(.035,.318,1.668)),tuple(ST_M@V(.30,.17,1.74)),'head'),
 'mustache_L':(tuple(ST_M@V(-.035,.318,1.668)),tuple(ST_M@V(-.30,.17,1.74)),'head'),
 'upper_arm_R':(tuple(S_R),tuple(E_R),'chest'),'forearm_R':(tuple(E_R),tuple(W_R),'upper_arm_R'),
 'hand_R':(tuple(W_R),tuple(W_R+V(.05,.03,-.045)),'forearm_R'),
 'upper_arm_L':(tuple(S_L),tuple(E_L),'chest'),'forearm_L':(tuple(E_L),tuple(W_L),'upper_arm_L'),
 'hand_L':(tuple(W_L),tuple(W_L+(FIST_L-E_L).normalized()*.07),'forearm_L'),
 'remote':(tuple(R((0,0,-.06))),tuple(R((0,0,.06))),'hand_R'),
 'button':(tuple(R((0,.034,.055))),tuple(R((0,.07,.055))),'remote'),
 'thumb_R':(tuple(R((-.03,.036,-.03))),tuple(R((-.012,.056,.04))),'remote'),
 'antenna_1':(tuple(R((.03,0,.10))),tuple(R((.04,0,.20))),'remote'),
 'antenna_2':(tuple(R((.04,0,.20))),tuple(R((.05,0,.335))),'antenna_1'),
 'propeller':(tuple(R((.05,0,.36))),tuple(R((.05,0,.42))),'antenna_2')}
for label,s in (('R',1),('L',-1)):
 hip=V(s*LEG_X,0,HIP_Z);knee=V(s*LEG_X,KNEE.y,KNEE.z);ank=V(s*LEG_X,0,ANK_Z)
 REST['thigh_'+label]=(tuple(hip),tuple(knee),'hips');REST['shin_'+label]=(tuple(knee),tuple(ank),'thigh_'+label)
 REST['foot_'+label]=(tuple(ank),tuple(ank+V(0,.20,-.08)),'shin_'+label)
 REST['tail_'+label]=((s*.10,-.235,.665),tuple(V(s*.10,-.235,.665)+Matrix.Rotation(TAIL_TILT,3,'X')@V(0,0,-.365)),'hips')

# ================= Legs, spats, shoes =================
def leg_w(label):
 def f(p):
  z=p.z
  if z>=0.49:return {'thigh_'+label:1.0}
  if z>=0.39:t=C.smooth((0.49-z)/0.10);return {'thigh_'+label:1-t,'shin_'+label:t}
  if z>=0.21:return {'shin_'+label:1.0}
  u=C.smooth((0.21-z)/0.09);return {'shin_'+label:1-u,'foot_'+label:u}
 return f
for label,s in (('R',1),('L',-1)):
 x=s*LEG_X
 prof=[(0.14,0.056),(0.25,0.060),(0.37,0.064),(0.415,0.066),(0.445,0.067),(0.475,0.068),(0.53,0.071),(0.65,0.077),(0.79,0.080)]
 def stripes(c,n,x=x):
  a=math.atan2(c.y,c.x-x)%math.tau;col=int(a/(math.tau/36))
  if abs(n.z)>.9:return STRIPE_D
  return STRIPE_L if col%3==0 else STRIPE_D
 C.lathe(label+' pinstripe trouser leg',(x,0,0),prof,STRIPE_D,'thigh_'+label,n=36,caps=False,weights=leg_w(label),face_tile=stripes)
 C.lathe(label+' cream spat',(x,.008,0),[(0.075,0.064),(0.088,0.074),(0.12,0.080),(0.20,0.075),(0.222,0.070),(0.226,0.060)],CREAM,'foot_'+label,n=18,weights=leg_w(label))
 # Long pointed shoe lofted heel-to-toe with a flat sole and an upturned tip.
 shoe=[(-0.108,.030,.026,.060),(-0.096,.058,.050,.063),(-0.07,.074,.060,.065),(-0.02,.082,.066,.066),(0.04,.083,.063,.064),(0.10,.078,.054,.058),(0.155,.066,.044,.055),(0.20,.050,.034,.057),(0.24,.034,.025,.064),(0.272,.020,.017,.078),(0.294,.010,.010,.094),(0.306,.004,.004,.104)]
 rr=[]
 for y,w,h,cz in shoe:
  row=[]
  for i in range(14):
   a=math.tau*i/14;z=cz+h*math.sin(a)
   row.append((x+w*math.cos(a),y,max(z,0.004) if y<0.2 else z))
  rr.append(row)
 C.rings(label+' long pointed plum shoe',rr,INK,'foot_'+label,mat=1)
 C.box(label+' brass shoe buckle',(x,.15,.112),(.062,.02,.034),BRASS,'foot_'+label,bevel=.006,segments=1,mat=1,rot=(.5,0,0))

# ================= Tailcoat, waistcoat, lapels, sash, rosette, tails =================
C.lathe('Aubergine pear tailcoat body',(0,0,0),COAT_P,COAT,'hips',n=34,ey=COAT_EY,weights=coat_w)
C.ellipsoid('Honey waistcoat front',tuple(VEST_C),tuple(VEST_S),HONEY,'chest',n=18,r=10,weights=coat_w)
for z in (0.96,1.08,1.20,1.32):
 y=front_y(0,z)
 C.ellipsoid('Plum waistcoat button %.2f'%z,(0,y+.002,z),(.022,.012,.022),INK,'chest',1,n=10,r=5,weights=coat_w)
for s,label in ((1,'R'),(-1,'L')):
 grid=[]
 for k in range(11):
  t=k/10;z=1.47-0.47*t;xc=s*(0.085+0.10*t);hw=0.052*(1-t)+0.012*t
  grid.append([(xc+s*hw*(j/2-1),z) for j in range(5)])
 patch(label+' dark plum coat lapel',grid,PLUM,0.012)
 C.ellipsoid(label+' padded coat shoulder',(s*.205,0,1.405),(.115,.105,.085),COAT,'chest',n=14,r=8)
 y=-(COAT_EY*math.sqrt(max(0,C.interp(COAT_P,.76)**2-.075**2)))-.002
 C.ellipsoid(label+' brass coat-back button',(s*.075,y,.76),(.02,.012,.02),BRASS,'hips',1,n=10,r=5)
 tail=[(-0.085,0.03),(0.085,0.03),(0.080,-0.12),(0.068,-0.24),(0.045,-0.33),(0.0,-0.40),(-0.045,-0.33),(-0.068,-0.24),(-0.080,-0.12)]
 C.plate(label+' swallow coat tail',tail,.026,COAT,'tail_'+label,bevel=.010,segments=2,transform=Matrix.Translation((s*.10,-.232,.665))@Matrix.Rotation(TAIL_TILT,4,'X')@Matrix.Rotation(-s*.05,4,'Z'))

# Sash: a raspberry strap on the plane through the belly tilted 48 degrees up to the right shoulder.
SA=math.radians(48);SC=V(0,0,1.075);SU=V(math.cos(SA),0,math.sin(SA));SV=V(0,1,0);SN=SU.cross(SV).normalized()
def sash_point(t):
 d=math.cos(t)*SU+math.sin(t)*SV;p,N=ray_surface(SC,d.normalized());w=(SN-SN.dot(N)*N).normalized();return p,N,w
cent=[];nor=[];bi=[]
for i in range(48):
 p,N,w=sash_point(math.tau*i/48);cent.append(p+N*.003);nor.append(N);bi.append(w)
C.ribbon('Raspberry mayoral sash',cent,nor,.052,.013,SASH,'chest',weights=coat_w,binormals=bi)
tr=math.pi/2+0.62;p,N,w=sash_point(tr)
up=(V(0,0,1)-N*N.z).normalized();side=up.cross(N).normalized()
ROS=Matrix.Translation(p+N*.018)@Matrix((side,N,up)).transposed().to_4x4()
pleat=[((0.090 if i%2==0 else 0.075)*math.cos(math.tau*i/16),(0.090 if i%2==0 else 0.075)*math.sin(math.tau*i/16)) for i in range(16)]
C.plate('Pleated raspberry rosette',pleat,.020,SASH,'hips',bevel=.004,segments=1,transform=ROS,weights=coat_w)
C.lathe('Honey rosette disc',(0,0,0),[(-.004,.064),(.014,.064),(.018,.058),(.019,0.0)],HONEY,'hips',n=20,axis='y',transform=ROS,weights=coat_w)
C.ellipsoid('Cream kitten face on rosette',(0,.020,0),(.036,.012,.031),CREAM,'hips',n=12,r=6,transform=ROS,weights=coat_w)
for sx in (1,-1):
 C.lathe('Kitten rosette ear %+d'%sx,(0,0,0),[(0,.013),(.026,0.0)],CREAM,'hips',n=4,transform=ROS@Matrix.Translation((.021*sx,.020,.020))@Matrix.Rotation(-.40*sx,4,'Y'),weights=coat_w)
 C.plate('Rosette ribbon tail %+d'%sx,[(-.018,0),(.018,0),(.020,-.10),(0,-.085),(-.020,-.10)],.008,SASH_D,'hips',bevel=.003,segments=1,transform=ROS@Matrix.Translation((.026*sx,-.004,-.06))@Matrix.Rotation(.20*sx,4,'Y'),weights=coat_w)

# ================= Neck, collar, bow tie =================
def neck_w(p):
 t=C.smooth((p.z-1.46)/0.06);u=C.smooth((p.z-1.53)/0.05)
 return {'chest':1-t,'neck':t*(1-u),'head':u}
C.lathe('Neck',(0,.01,1.43),[(0,.066),(.15,.066)],SKIN,'neck',n=12,caps=False,weights=neck_w)
C.lathe('Cream high shirt collar',(0,.012,1.445),[(0,.124),(.012,.126),(.09,.104),(.10,.098),(.10,.07)],CREAM,'chest',n=20)
for sx in (1,-1):
 C.plate('Cream collar point %+d'%sx,[(0,0),(.05*sx,0),(.012*sx,-.06)],.012,CREAM,'chest',bevel=.003,segments=1,transform=Matrix.Translation((.012*sx,.118,1.49))@Matrix.Rotation(-.2,4,'X'))
 C.ellipsoid('Teal bow tie wing %+d'%sx,(.052*sx,.128,1.462),(.052,.024,.034),TEAL,'chest',n=12,r=6,rot=(0,.35*sx,0))
C.ellipsoid('Teal bow tie knot',(0,.142,1.462),(.024,.02,.026),TEAL_D,'chest',n=10,r=5)

# ================= Head =================
HEAD=[(1.50,0.0),(1.515,0.075),(1.55,0.132),(1.62,0.172),(1.71,0.190),(1.80,0.190),(1.88,0.178),(1.94,0.150),(1.985,0.090),(2.00,0.0)]
HEAD_EY=1.05;HEAD_Y=0.01
def head_y(x,z,off=0.0):
 r=C.interp(HEAD,z);return HEAD_Y+HEAD_EY*math.sqrt(max(0.0,r*r-x*x))+off
C.lathe('Egg-shaped head',(0,HEAD_Y,0),HEAD,SKIN,'head',n=32,ey=HEAD_EY)
for sx in (1,-1):
 C.ellipsoid('Ear %+d'%sx,(.188*sx,0,1.765),(.032,.05,.068),SKIN,'head',n=12,r=7)
 ex=.078*sx;ez=1.83;ey=head_y(abs(ex),ez)-.018
 C.ellipsoid('Eye white %+d'%sx,(ex,ey,ez),(.05,.034,.062),WHITE,'head',1,n=14,r=8)
 C.ellipsoid('Side-glancing pupil %+d'%sx,(ex+.019,ey+.03,ez-.012),(.021,.012,.024),INK,'head',1,n=10,r=6)
 C.ellipsoid('Smug heavy eyelid %+d'%sx,(ex,ey+.004,1.872),(.056,.038,.036),SKIN,'head',n=12,r=7,rot=(0,-.25*sx,0))
 C.ellipsoid('Plum side hair tuft %+d'%sx,(.158*sx,-.075,1.875),(.034,.075,.05),STACHE,'head',n=10,r=6,rot=(0,.3*sx,0))
rb=[(0.03,1.905),(0.08,1.935),(0.135,1.915)];lb=[(-0.03,1.895),(-0.08,1.905),(-0.135,1.93)]
for name,pts in (('Raised skeptical brow right',rb),('Scheming slanted brow left',lb)):
 path=C.bspline([(x,head_y(abs(x),z,.012),z) for x,z in pts],8)
 C.tube(name,path,C.bspline_radii([.017,.019,.012],8),STACHE,'head',n=8)
nb=head_y(0,1.765)-.03
path=C.bspline([(0,nb,1.768),(0,nb+.08,1.752),(0,nb+.15,1.728)],6)
C.tube('Long nose',path,C.bspline_radii([.058,.046,.036],6),SKIN,'head',n=12)
C.ellipsoid('Rosy nose tip',(0,nb+.17,1.722),(.046,.044,.042),NOSE,'head',1,n=14,r=8)
mz=[(-0.065,1.595),(0.0,1.584),(0.06,1.592),(0.098,1.614)]
C.tube('Smug smirk',C.bspline([(x,head_y(abs(x),z,.004),z) for x,z in mz],8),.012,STACHE,'head',n=6)
C.ellipsoid('Plum back hair tuft',(0,-.162,1.885),(.125,.035,.05),STACHE,'head',n=12,r=6)
C.ellipsoid('Little chin',(0,head_y(0,1.545)-.03,1.545),(.07,.04,.045),SKIN,'head',n=12,r=7)

# Huge curly handlebar mustache (12% larger than the blockout for play-distance read).
def stache_w(label):
 def f(p):
  t=C.smooth((abs(p.x)-.025)/.12);return {'head':1-t,'mustache_'+label:t}
 return f
ST=[(0.0,0.325,1.672),(0.07,0.305,1.662),(0.15,0.255,1.655),(0.24,0.20,1.672),(0.31,0.165,1.715),(0.345,0.15,1.775),(0.322,0.148,1.818),(0.282,0.148,1.802),(0.286,0.15,1.766)]
STR=[0.046,0.05,0.045,0.036,0.027,0.021,0.017,0.014,0.011]
for sx,label in ((1,'R'),(-1,'L')):
 path=[ST_M@p for p in C.bspline([(x*sx,y,z) for x,y,z in ST],24)]
 C.tube('Curly handlebar mustache '+label,path,[r*1.12 for r in C.bspline_radii(STR,24)],STACHE,'head',n=10,weights=stache_w(label),squash=.92)

# ================= Tall jaunty stovepipe hat with kitten badge =================
C.lathe('Hat brim',(0,0,0),[(.014,.158),(.014,.262),(.008,.281),(-.003,.286),(-.012,.272),(-.014,.158)],PLUM,'hat',n=40,ey=1.06,closed_profile=True,transform=HAT_M)
C.lathe('Tall stovepipe crown',(0,0,0),[(0.0,0.166),(0.16,0.168),(0.33,0.178),(0.47,0.196),(0.495,0.194),(0.505,0.15),(0.508,0.0)],PLUM,'hat',n=32,ey=1.05,transform=HAT_M)
C.lathe('Honey hat band',(0,0,0),[(0.014,0.1705),(0.018,0.1735),(0.084,0.1745),(0.088,0.1715)],HONEY,'hat',n=32,ey=1.05,caps=False,transform=HAT_M)
by=.1745*1.05
C.ellipsoid('Cream kitten hat badge',(0,by+.004,.052),(.044,.014,.036),CREAM,'hat',n=12,r=6,transform=HAT_M)
for sx in (1,-1):
 C.lathe('Kitten hat badge ear %+d'%sx,(0,0,0),[(0,.015),(.03,0.0)],CREAM,'hat',n=4,transform=HAT_M@Matrix.Translation((.026*sx,by+.004,.078))@Matrix.Rotation(.35*sx,4,'Y'))

# ================= Arms: continuous sleeves with blended shoulder/elbow weights =================
def arm_parts(label,S,E,W,s):
 S0=V(s*.17,0,1.415);fdir=(W-E).normalized()
 ctrl=[S0,S,S.lerp(E,.5),E,E.lerp(W,.5),W-fdir*.012]
 path=C.catmull(ctrl,3);acc=C.arclength(path)
 iS=3;iE=9
 sS=acc[iS];sE=acc[iE]
 def w(p):
  i=min(range(len(path)),key=lambda k:(path[k]-p).length);s_=acc[i]
  if s_<sS:t=C.smooth(s_/sS);return {'chest':1-t,'upper_arm_'+label:t}
  t=C.smooth((s_-(sE-.06))/.12);return {'upper_arm_'+label:1-t,'forearm_'+label:t}
 radii=[]
 for s_ in acc:
  f=s_/acc[-1];radii.append(.080-.020*f)
 C.tube(label+' aubergine coat sleeve',path,radii,COAT,'upper_arm_'+label,n=12,weights=w)
 cuff=[W-fdir*.040,W-fdir*.036,W-fdir*.004,W]
 C.tube(label+' cream shirt cuff',cuff,[.058,.066,.066,.058],CREAM,'forearm_'+label,n=14)
arm_parts('R',S_R,E_R,W_R,1);arm_parts('L',S_L,E_L,W_L,-1)
C.ellipsoid('Right cream glove gripping remote',(.595,.18,.895),(.08,.062,.064),CREAM,'hand_R',n=14,r=8)
fd=(FIST_L-E_L).normalized()
C.ellipsoid('Left cream glove fist on hip',tuple(FIST_L),(.062,.058,.056),CREAM,'hand_L',n=14,r=8)
C.ellipsoid('Left glove thumb',tuple(FIST_L+V(.012,.045,.018)),(.022,.02,.03),CREAM,'hand_L',n=10,r=6,rot=(.5,0,-.3))

# ================= Remote-control contraption =================
def remote_tiles(c,n):
 ln=REM_M.to_3x3().normalized().inverted()@n
 return TEAL_D if abs(ln.x)>.7 or ln.z<-.7 else None
C.box('Teal remote-control box',(0,0,0),(.125,.068,.205),TEAL,'remote',bevel=.016,segments=2,mat=1,transform=REM_M,face_tile=remote_tiles)
C.lathe('Big raspberry button',(0,.030,.055),[(0,.031),(.014,.031),(.022,.027),(.024,0.0)],SASH,'button',1,n=16,axis='y',transform=REM_M)
for sx in (1,-1):
 C.lathe('Honey dial %+d'%sx,(.032*sx,.030,-.012),[(0,.016),(.012,.016),(.016,.011),(.017,0.0)],HONEY,'remote',1,n=12,axis='y',transform=REM_M)
C.lathe('Brass crank arm',(.062,0,-.02),[(0,.009),(.045,.009)],BRASS,'remote',1,n=8,axis='x',transform=REM_M)
C.lathe('Brass crank handle',(.104,0,-.02),[(-.004,.012),(.045,.012),(.05,.008)],BRASS,'remote',1,n=10,axis='y',transform=REM_M)
C.ellipsoid('Glove thumb on the remote',(-.018,.05,.0),(.02,.018,.034),CREAM,'thumb_R',n=10,r=6,rot=(0,.3,0),transform=REM_M)
coil=[]
for i in range(57):
 t=i/56;a=t*math.tau*7
 coil.append(REM_M@V(.03+.017*math.cos(a)+.02*t,.017*math.sin(a),.10+.20*t))
def ant_w(p):
 zl=(REM_M.inverted()@p).z;t=C.smooth((zl-.13)/.14);return {'antenna_1':1-t,'antenna_2':t}
C.tube('Brass spring antenna',coil,.0055*1.32,BRASS,'antenna_1',1,n=5,weights=ant_w,hint=(0,0,1))
C.ellipsoid('Honey antenna ball',(.05,0,.335),(.036,.036,.036),HONEY,'antenna_2',1,n=10,r=7,transform=REM_M)
C.lathe('Propeller spindle',(.05,0,.36),[(0,.006),(.05,.006)],INK,'propeller',1,n=6,transform=REM_M)
for k,(ry,rz) in enumerate(((.12,.35),(-.12,.35+math.pi/2))):
 C.ellipsoid('Tiny cream propeller blade '+'AB'[k],(.05,0,.402),(.075,.016,.006),CREAM,'propeller',n=12,r=4,rot=(0,ry,rz),transform=REM_M)

# ================= Join one skin, build the rig, checkpoint =================
sources=bpy.data.collections.new('EDITABLE original rival mayor parts - excluded from export');sc.collection.children.link(sources)
inventory=[];copies=[]
for ob in C.PARTS:
 ob.data.calc_loop_triangles();inventory.append({'name':ob.name,'triangles':len(ob.data.loop_triangles),'bone_groups':[g.name for g in ob.vertex_groups],'atlas_tile':ob.get('atlas_tile')})
 cp=ob.copy();cp.data=ob.data.copy();sc.collection.objects.link(cp);copies.append(cp)
 for col in list(ob.users_collection):col.objects.unlink(ob)
 sources.objects.link(ob)
sources.hide_render=True;sources.hide_viewport=True
bpy.ops.object.select_all(action='DESELECT')
for ob in copies:ob.select_set(True)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();skin=bpy.context.object;skin.name='Rival_Mayor_Skin'
for tag in ['source_part','rigid_weight','atlas_tile']:
 if tag in skin:del skin[tag]
skin.data.calc_loop_triangles();tris=len(skin.data.loop_triangles)
data=bpy.data.armatures.new('Original rival mayor rig');arm=bpy.data.objects.new('Rival_Mayor_Rig',data);sc.collection.objects.link(arm)
skin.select_set(False);arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
for name,(h,t,parent) in REST.items():
 b=data.edit_bones.new(name);b.head=h;b.tail=t
 if parent:b.parent=data.edit_bones[parent];b.use_connect=False
 b.use_deform=name!='root'
bpy.ops.object.mode_set(mode='OBJECT');mod=skin.modifiers.new('Attached painted skin','ARMATURE');mod.object=arm;skin.parent=arm
missing=sorted({g.name for g in skin.vertex_groups}-set(REST))
assert not missing,missing
pts=[v.co for v in skin.data.vertices]
lo=[min(p[k] for p in pts) for k in range(3)];hi=[max(p[k] for p in pts) for k in range(3)]
arm['asset_id']='rival-mayor';arm['version']='v001';arm['forward']='Blender +Y / glTF -Z';arm['neutral_total_height_m']=round(hi[2],4);arm['attack_contact_fraction']=.625
record={'asset_id':'rival-mayor','version':'v001','work_order':'WO111','authoring_model':'claude-opus-5-5 xhigh (Claude Code subagent; Tom ruled Sept 26 that Opus 5.5 does the WO111 Blender work)','blender_version':bpy.app.version_string,
 'source_reference':'Blender reference sheet, no generated concept','source_sheet_sha256':sc['source_sheet_sha256'],'source_blockout_sha256':sc['source_blockout_sha256'],
 'rest_bounds_blender_z_up':{'min':lo,'max':hi},'height_m':hi[2],'triangles':tris,'vertices':len(skin.data.vertices),'material_count':len(skin.data.materials),'bone_count':len(data.bones),
 'texture':{'file':'pigment.png','width':1024,'height':1024,'origin':'Original deterministic soft painted palette atlas generated in Blender Python from the sheet colours; no external textures.','palette':COLORS},
 'parts':inventory}
(ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n')
rest_json={k:[list(map(float,h)),list(map(float,t)),p] for k,(h,t,p) in REST.items()}
(ROOT/'source/rig-rest.json').write_text(json.dumps({'rest':rest_json},indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'rival-mayor-construction.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(ROOT/'rival-mayor-checkpoint.glb'),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_yup=True,export_apply=False,export_armature_object_remove=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=True)
big=sorted(inventory,key=lambda r:-r['triangles'])
print(json.dumps({'triangles':tris,'vertices':len(skin.data.vertices),'height_m':hi[2],'bounds':[lo,hi],'bones':len(data.bones),'largest':[(r['name'],r['triangles']) for r in big]}))
