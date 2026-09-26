"""WO111 inator-monster v001: final budgeted model from the approved Blender reference sheet.

Source authority: reference-sheet.png and inator-monster-blockout.blend (coordinator approved
Sept 26, "Blender reference sheet, no generated concept"). The blockout's measured coordinates are
kept for silhouette, colour and parody hooks: a googly-eyed rubber-suit kaiju with a pear torso,
butter belly with scute bands, baggy ankle wrinkles, round feet with cream toe nubs, tiny T-rex arms,
a thick tail swept to its left with a curled tip, two staggered rows of toy-coloured back plates, a
costume zipper with a dangling pull tab, a strapped-on violet cockpit tub with signal lights, a clear
bubble dome, and the small evil scientist inside (bald crown, pointed side-and-back frizz, brass
goggles, lab coat with a mint collar and pens, purple gloves) pointing forward and holding up the
-inator remote whose zig-zag antenna pokes out through a brass port. Topology, UVs, weights, rig
and atlas are new.

Blender +Z up / +Y forward (glTF +Y up / -Z forward), floor-centred root, character right = +X.
The bind pose is the sheet pose (head tilt, mismatched pupils, the pilot's raised remote and
pointing arm). Material 0 is the opaque painted atlas; material 1 is the alpha-blended bubble glass
sampling the same atlas (its tile carries the rim tint and the painted window glint).
"""
import bpy, bmesh, math, json, hashlib, importlib.util, struct, zlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler
import numpy as np

ROOT=Path('/workspace/haynes-quest/family-eras/inator-monster/v001')
sc=bpy.context.scene
assert sc.get('work_order')=='WO111' and sc.get('scene_lease')=='active' and sc.get('asset_id')=='inator-monster'
spec=importlib.util.spec_from_file_location('wo111_inator_monster_common',ROOT/'source/common.py')
C=importlib.util.module_from_spec(spec);spec.loader.exec_module(C)

# ---- Atlas: 31 sheet colours (7 painted shade levels each), a pocket tile, a remote-face tile and a
#      2x2 glass block (alpha rim tint + window glint) on one 1024 px indexed PNG with a tRNS chunk.
COLORS=['72a95c','4f7f48','f0d58c','d9b466','f08a3c','f4c542','ef7fa8','5eaee0','f3e6cf','fbf8f2','c9d3d8','2b2238','9c3a52','ef8a9a','fbf6ec','f2a08f',
        '3a3548','c9ccd3','6b5b95','c9923e','e0524f','7cc26b','eef0ec','cfd8d4','f2cfae','e8a08c','dcd6ee','7b5ea7','a9d8ea','4b4f63','3f9d9a']
(SUIT,SUIT_D,BELLY,BELLY_L,PL_OR,PL_YE,PL_PK,PL_BL,CLAW,EYE,EYE_RIM,INK,MOUTH,TONGUE,TOOTH,BLUSH,
 STRAP,ZIP,COCKPIT,BRASS,RED,GREEN,COAT,COAT_S,SKIN,NOSE,HAIR,GLOVE,LENS,REMOTE,TEAL)=range(31)
POCKET=32;REMOTE_FACE=33;GLASS=54   # GLASS spans tiles 54,55,62,63 (bottom-right 256 px block)
C.SPAN[GLASS]=2
GLASS_HEX='bfe6f0';GLINT_HEX='fbfdff'
NG=32   # glass alpha levels (fine enough that the rim gradient shows no banding)
# cockpit-local glint direction: azimuth 150 deg (front-left, character left = -X), elevation 38 deg. From the
# front it sits beside the pointing hand; from the three-quarter and chase views it is on the culled far side,
# so it never covers the pilot from the main cameras.
GLINT_AZ,GLINT_EL=math.radians(150),math.radians(38)
GLINT_DIR=Vector((math.cos(GLINT_EL)*math.cos(GLINT_AZ),math.cos(GLINT_EL)*math.sin(GLINT_AZ),math.sin(GLINT_EL)))
GLASS_A0,GLASS_A1=0.06,0.32   # alpha at the top and extra alpha toward the rim
LEVELS=7

def atlas():
 rng=np.random.default_rng(11106);S=128;G=8
 idx=np.zeros((1024,1024),dtype=np.uint16)   # row 0 = bottom (UV v = 0)
 palette=[];alpha=[]
 def rgb(h):return np.array([int(h[j:j+2],16)/255 for j in (0,2,4)])
 # glass block entries first so the tRNS chunk stays short
 g=rgb(GLASS_HEX)
 for k in range(NG):palette.append(np.round(g*255).astype(int).tolist());alpha.append(k)
 GLINT0=len(palette)
 for a in (0.78,0.88,1.0):palette.append(np.round(rgb(GLINT_HEX)*255).astype(int).tolist());alpha.append(None)
 glint_alpha=[.78,.88,1.0]
 base={}
 for i,h in enumerate(COLORS):
  base[i]=len(palette);c=rgb(h)
  for level in range(LEVELS):palette.append(np.round(np.clip(c+(-.018+level*.006),.01,.99)*255).astype(int).tolist())
 yy,xx=np.mgrid[0:S,0:S]
 def field(i):
  f=.010*np.sin(xx*.061+yy*.043+i)+.006*np.cos(xx*.13-yy*.089+2*i)+rng.integers(-1,2,(S,S))*.0015
  return np.clip(np.round((f+.018)/.006),0,LEVELS-1).astype(np.uint16)
 def block(t,span=1):
  r=G-span-t//G;c=t%G;return slice(r*S,(r+span)*S),slice(c*S,(c+span)*S)
 for t in range(64):
  ys,xs=block(t);idx[ys,xs]=base[SUIT]+field(t)
 for i in range(len(COLORS)):
  ys,xs=block(i);idx[ys,xs]=base[i]+field(i)
 # pocket tile: coat-shadow pocket with three pens (red, blue, yellow) standing out of the top third
 ys,xs=block(POCKET);tile=base[COAT_S]+field(POCKET)
 u=(xx/S-C.TILE_INSET)/C.TILE_SPAN;v=(yy/S-C.TILE_INSET)/C.TILE_SPAN
 for k,col in enumerate((RED,PL_BL,PL_YE)):
  m=(v>.62)&(np.abs(u-(.28+.22*k))<.075);tile=np.where(m,base[col]+field(POCKET+k+1),tile)
 m=(v>.58)&(v<.64);tile=np.where(m,base[COAT]+3,tile)
 idx[ys,xs]=tile
 # remote face tile: slate body with three dark speaker-grille slots across the lower part
 ys,xs=block(REMOTE_FACE);tile=base[REMOTE]+field(REMOTE_FACE)
 for k in range(3):
  m=(np.abs(v-(.12+.13*k))<.035)&(np.abs(u-.5)<.34);tile=np.where(m,base[INK]+3,tile)
 idx[ys,xs]=tile
 # glass block (2 x 2 tiles): u = azimuth / 2pi, v = elevation / (pi/2); alpha rises toward the rim
 ys,xs=block(GLASS,2);B=2*S;by,bx=np.mgrid[0:B,0:B]
 gu=np.clip((bx/S-C.TILE_INSET)/(2-2*C.TILE_INSET),0,1);gv=np.clip((by/S-C.TILE_INSET)/(2-2*C.TILE_INSET),0,1)
 a_curve=GLASS_A0+GLASS_A1*(1-gv)**2.4
 level=np.clip(np.round((a_curve-GLASS_A0)/(GLASS_A1/(NG-1))),0,NG-1).astype(np.uint16)
 az=gu*math.tau;el=gv*math.pi/2
 d=np.stack([np.cos(el)*np.cos(az),np.cos(el)*np.sin(az),np.sin(el)],-1)
 ang=np.degrees(np.arccos(np.clip(d@np.array(GLINT_DIR),-1,1)))
 # a round window glint and a short arc streak on its lower-left side (fixed to the dome, not a camera)
 # the arc sits on the upper-outer side of the spot: offset direction from the glint toward +up/outward
 Gd=np.array(GLINT_DIR);off=d-(d@Gd)[...,None]*Gd;offn=off/np.maximum(np.linalg.norm(off,axis=-1,keepdims=True),1e-9)
 up=np.array([0.0,0.0,1.0])-Gd*Gd[2];up/=np.linalg.norm(up);outw=np.array([Gd[0],Gd[1],0.0]);outw/=np.linalg.norm(outw)
 arcdir=(0.75*up+0.66*outw);arcdir/=np.linalg.norm(arcdir)
 spot_core=ang<5.5;spot=ang<8.5;arc=(ang>15.5)&(ang<19.5)&(offn@arcdir>0.45)
 glass=level.copy()
 glass=np.where(arc,GLINT0+1,glass);glass=np.where(spot,GLINT0+0,glass);glass=np.where(spot_core,GLINT0+2,glass)
 idx[ys,xs]=glass
 assert len(palette)<=256,len(palette)
 amap=[int(round((GLASS_A0+(GLASS_A1/(NG-1))*a)*255)) if a is not None else int(round(glint_alpha[k-GLINT0]*255)) for k,a in enumerate(alpha)]
 def chunk(name,data):return struct.pack('>I',len(data))+name+data+struct.pack('>I',zlib.crc32(name+data)&0xffffffff)
 raw=b''.join(b'\x00'+row.astype(np.uint8).tobytes() for row in idx[::-1])
 png=(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1024,1024,8,3,0,0,0))+chunk(b'PLTE',bytes(sum(palette,[])))
      +chunk(b'tRNS',bytes(amap))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b''))
 (ROOT/'pigment.png').write_bytes(png)
 return {'palette_entries':len(palette),'transparent_entries':len(amap),'glass_alpha_range':[amap[0]/255,amap[NG-1]/255],'glint_alpha':glint_alpha}

ATLAS=atlas()
keep={k:sc[k] for k in sc.keys() if k.startswith('blendermcp_') or k in ('work_order','scene_owner','scene_lease','asset_id','asset_version','authoring_model')}
C.setup(ROOT,[('Painted rubber suit, toy plastic, cloth and skin',.78,'opaque'),('Clear bubble cockpit glass',.12,'glass')],'inator-monster original painted 1024 atlas')
for key in list(sc.keys()):
 if key not in keep and key!='cycles':del sc[key]
sc['candidate_status']="WO111 inator-monster v001 · Awaiting Tom's review · used in the family release"
sc['source_reference']='Blender reference sheet, no generated concept'
sc['source_sheet_sha256']=hashlib.sha256((ROOT/'reference-sheet.png').read_bytes()).hexdigest()
sc['source_blockout_sha256']=hashlib.sha256((ROOT/'inator-monster-blockout.blend').read_bytes()).hexdigest()
sc['orientation']='Blender +Z up/+Y forward; glTF +Y up/-Z forward; stationary identity floor root; character right = +X'

def V(*a):return Vector(a)
def frame_matrix(Tv,N):
 """Columns X=T, Y=N x T, Z=N (orthonormalised); from the blockout."""
 Tv=Vector(Tv).normalized();N=Vector(N);N=(N-N.dot(Tv)*Tv).normalized();B=N.cross(Tv)
 return Matrix((Tv,B,N)).transposed()
def M4(R3,loc):return Matrix.Translation(loc)@R3.to_4x4()

# ================= Torso frame and surface (blockout values) =================
TORSO_LOC=V(0.0,0.05,0.60);TORSO_ROT=Euler((-0.15,0.0,0.0))
TORSO_M=Matrix.Translation(TORSO_LOC)@TORSO_ROT.to_matrix().to_4x4();TMi=TORSO_M.inverted()
TORSO=[(0.00,0.30),(0.06,0.47),(0.18,0.61),(0.40,0.70),(0.64,0.71),(0.88,0.66),(1.08,0.58),(1.26,0.48),(1.40,0.38),(1.50,0.27),(1.56,0.12),(1.58,0.0)]
TORSO_EY=0.86
def tsurf(x,z,side=1,off=0.0):
 r=C.interp(TORSO,z);y=side*TORSO_EY*math.sqrt(max(0.0,r*r-x*x))
 n=V(x/r**2,y/(TORSO_EY*r)**2,0.0).normalized();return V(x,y,z)+n*off,n
def tw(v):return TORSO_M@Vector(v)
def tn(v):return (TORSO_ROT.to_matrix()@Vector(v)).normalized()
SPINE_J=[0.55,0.95,1.25]   # torso-local z of the hips/spine joints
SPINE_B=['hips','spine_1','spine_2','spine_3']
def spine_w_local(z,width=0.12):
 w={SPINE_B[0]:1.0}
 for j,(zj,bn) in enumerate(zip(SPINE_J,SPINE_B[1:])):
  t=C.smooth((z-(zj-width))/(2*width))
  w={k:v*(1-t) for k,v in w.items()};w[bn]=w.get(bn,0)+t
 return w
def torso_w(p):return spine_w_local((TMi@p).z)

# ================= Legs and feet =================
LEG_X=0.40
def leg_w(label):
 def f(p):
  z=p.z
  if z>=0.52:return {'thigh_'+label:1.0}
  if z>=0.36:t=C.smooth((0.52-z)/0.16);return {'thigh_'+label:1-t,'shin_'+label:t}
  if z>=0.27:return {'shin_'+label:1.0}
  u=C.smooth((0.27-z)/0.09);return {'shin_'+label:1-u,'foot_'+label:u}
 return f
LEG_PROF=[(0.0,0.205),(0.12,0.215),(0.20,0.205),(0.28,0.235),(0.46,0.262),(0.66,0.28),(0.80,0.27)]
for label,s in (('R',1),('L',-1)):
 x=LEG_X*s
 C.ellipsoid(label+' big round foot',(x,0.14,0.135),(0.235,0.33,0.135),SUIT,'foot_'+label,n=16,r=8)
 for k,dx in enumerate((-0.12,0.0,0.12)):
  C.ellipsoid(label+' cream toe nub %d'%k,(x+dx,0.44-abs(dx)*0.35,0.075),(0.062,0.07,0.058),CLAW,'foot_'+label,n=8,r=4)
 C.lathe(label+' stumpy baggy suit leg',(x,0.06,0.16),LEG_PROF,SUIT,'thigh_'+label,n=14,caps=False,weights=leg_w(label))
 C.torus(label+' baggy ankle wrinkle low',(x,0.06,0.29),0.212,0.022,SUIT_D,'shin_'+label,n=16,m=4)
 C.torus(label+' baggy ankle wrinkle high',(x,0.06,0.39),0.232,0.020,SUIT_D,'shin_'+label,n=16,m=4,weights=leg_w(label))

# ================= Pear torso, butter belly with scute bands =================
C.lathe('Pear kaiju rubber-suit torso',(0,0,0),TORSO,SUIT,'hips',n=30,ey=TORSO_EY,transform=TORSO_M,weights=torso_w)
BELLY_C=V(0.0,0.45,0.62);BELLY_S=V(0.46,0.21,0.56)
SCUTES=(0.26,0.42,0.58,0.74,0.90);SCUTE_HW=0.014
rows=sorted(set([0.06+1e-4,0.10,0.16,0.21,0.33,0.50,0.66,0.82,0.98,1.05,1.12,1.18-1e-4]+[z+d for z in SCUTES for d in (-SCUTE_HW,SCUTE_HW)]))
bprof=[(z-BELLY_C.z,BELLY_S.x*math.sqrt(max(0.0,1-((z-BELLY_C.z)/BELLY_S.z)**2))) for z in rows]
bprof=[(BELLY_C.z-BELLY_S.z-BELLY_C.z,0.0)]+bprof+[(BELLY_S.z,0.0)]
def belly_tiles(c,n):
 q=TMi@c;dz=(q.z-BELLY_C.z)/BELLY_S.z
 half=BELLY_S.x*math.sqrt(max(0.0,1-dz*dz))*0.80
 if q.y>BELLY_C.y and abs(q.x)<half and any(abs(q.z-z)<SCUTE_HW for z in SCUTES):return BELLY_L
 return None
C.lathe('Butter belly patch with scute bands',(0,BELLY_C.y,BELLY_C.z),bprof,BELLY,'hips',n=16,ey=BELLY_S.y/BELLY_S.x,transform=TORSO_M,weights=torso_w,face_tile=belly_tiles)

# ================= Harness belt, buckle =================
ZB=1.16;cen=[];nor=[];bi=[];S=30
for i in range(S):
 a=math.tau*i/S;r=C.interp(TORSO,ZB);p=V(r*math.cos(a),r*TORSO_EY*math.sin(a),ZB)
 n=V(p.x/r**2,p.y/(TORSO_EY*r)**2,0).normalized()
 cen.append(tw(p+n*0.004));nor.append(tn(n));bi.append(tn(V(0,0,1)))
C.ribbon('Cockpit harness chest belt',cen,nor,0.05,0.022,STRAP,'spine_2',weights=torso_w,binormals=bi)
p,n=tsurf(0.0,ZB,1,0.03)
BUCKLE_M=M4(TORSO_ROT.to_matrix()@frame_matrix(V(1,0,0),n)@Matrix.Rotation(-math.pi/2,3,'X'),tw(p))
C.box('Brass harness buckle',(0,0,0),(0.13,0.03,0.10),BRASS,'spine_2',bevel=.01,segments=1,transform=BUCKLE_M,weights=torso_w)

# ================= Tiny T-rex arms with mitten hands =================
ARMS={}
for label,sx in (('R',1),('L',-1)):
 sh,_=tsurf(0.40*sx,0.98,1,-0.05)
 el=V(0.50*sx,sh.y+0.14,0.86);ha=V(0.40*sx,sh.y+0.28,0.90)
 SH,EL,HA=tw(sh),tw(el),tw(ha);ARMS[label]=(SH,EL,HA)
 path=C.catmull([SH,EL,HA],3);acc=C.arclength(path)
 iE=3;sE=acc[iE]
 def aw(p,path=path,acc=acc,sE=sE,label=label):
  i=min(range(len(path)),key=lambda k:(path[k]-p).length);s_=acc[i]
  if s_<0.10:t=C.smooth(s_/0.10);d=torso_w(p);d={k:v*(1-t) for k,v in d.items()};d['arm_upper_'+label]=d.get('arm_upper_'+label,0)+t;return d
  t=C.smooth((s_-(sE-.05))/.10);return {'arm_upper_'+label:1-t,'arm_lower_'+label:t}
 rad=[0.092+(0.068-0.092)*a/acc[-1] for a in acc]
 C.tube(label+' tiny T-rex arm',path,rad,SUIT,'arm_upper_'+label,n=10,weights=aw)
 d=(HA-EL).normalized()
 WR=Matrix.Translation(EL+(HA-EL)*0.62)@(HA-EL).normalized().to_track_quat('Z','Y').to_matrix().to_4x4()
 C.torus(label+' suit wrist wrinkle',(0,0,0),0.070,0.014,SUIT_D,'arm_lower_'+label,n=12,m=4,transform=WR)
 hd=tw(ha+(ha-el).normalized()*0.06)
 C.ellipsoid(label+' mitten hand',tuple(hd),(0.075,0.085,0.07),SUIT,'arm_lower_'+label,n=12,r=6,rot=(0.5,0,0.3*sx))
 for k,dx in enumerate((-0.04,0.0,0.04)):
  C.ellipsoid(label+' mitten claw nub %d'%k,tuple(hd+V(dx*sx+0.01*sx,0.075,-0.035+abs(dx)*0.2)),(0.024,0.03,0.022),CLAW,'arm_lower_'+label,n=6,r=4)
 ARMS[label]=(SH,EL,HA,hd)

# ================= Thick tail swept to its left, curled tip =================
TAIL=[(0.0,-0.20,0.95),(-0.02,-0.72,0.66),(-0.10,-1.14,0.36),(-0.28,-1.48,0.17),(-0.52,-1.70,0.12),(-0.74,-1.80,0.16),(-0.88,-1.84,0.30),(-0.90,-1.80,0.44)]
TAIL_R=[0.36,0.30,0.22,0.16,0.12,0.095,0.075,0.06]
TP=C.catmull(TAIL,3);TR=[]
for i in range(len(TAIL)-1):
 for j in range(3):TR.append(TAIL_R[i]+(TAIL_R[i+1]-TAIL_R[i])*j/3)
TR.append(TAIL_R[-1]);TACC=C.arclength(TP);TL=TACC[-1]
TAIL_NODES=[0.0,0.17,0.36,0.55,0.74,1.0]   # arclength fractions of the 5 tail bones
def tail_point(f):
 s_=f*TL
 for i in range(len(TP)-1):
  if TACC[i]<=s_<=TACC[i+1]:t=(s_-TACC[i])/max(1e-9,TACC[i+1]-TACC[i]);return TP[i].lerp(TP[i+1],t)
 return TP[-1].copy()
def tail_w_s(s_,width=0.07):
 f=s_/TL;w={'tail_1':1.0}
 for j in range(1,5):
  t=C.smooth((f-(TAIL_NODES[j]-width))/(2*width))
  w={k:v*(1-t) for k,v in w.items()};w['tail_%d'%(j+1)]=w.get('tail_%d'%(j+1),0)+t
 # the root blends into the hips so the tail stays attached inside the torso
 h=1-C.smooth(f/0.06)
 if h>0:w={k:v*(1-h) for k,v in w.items()};w['hips']=w.get('hips',0)+h
 return w
def tail_w(p):
 i=min(range(len(TP)),key=lambda k:(TP[k]-p).length);return tail_w_s(TACC[i])
C.tube('Thick swept kaiju tail',TP,TR,SUIT,'tail_1',n=12,weights=tail_w,hint=(0,0,1))

# ================= Costume zipper down the spine, slider and dangling pull tab =================
ZN=28;Z0,Z1=0.36,1.16;ZHW=0.034;ZT=0.013
zrows=[]
for i in range(ZN+1):
 z=Z0+(Z1-Z0)*i/ZN
 row=[]
 for x,off in ((-ZHW,ZT),(0.0,ZT),(ZHW,ZT),(ZHW,-0.004),(0.0,-0.004),(-ZHW,-0.004)):
  p,nn=tsurf(x,z,-1,0.004+off);row.append(tw(p))
 zrows.append(row)
zverts=[p for r in zrows for p in r];zf=[]
for i in range(ZN):
 for k in range(6):
  a=i*6+k;b=i*6+(k+1)%6;zf.append((a,b,b+6,a+6))
zf+=[(5,4,3,2,1,0),tuple(ZN*6+k for k in range(6))]
def zip_tiles(c,n):
 q=TMi@c;k=int((q.z-Z0)/((Z1-Z0)/ZN))
 _,out=tsurf(0.0,min(max(q.z,Z0),Z1),-1);out=tn(out)
 if n.dot(out)>0.6 and Z0<q.z<Z1:
  left=q.x<0
  return ZIP if (k%2==0)==left else STRAP
 return STRAP
C.mesh('Costume zipper tape with interlocking teeth',zverts,zf,STRAP,'spine_1',weights=torso_w,face_tile=zip_tiles)
p,n=tsurf(0.0,1.13,-1,0.030)
SLIDER_M=M4(TORSO_ROT.to_matrix()@frame_matrix(V(1,0,0),n)@Matrix.Rotation(math.pi/2,3,'X'),tw(p))
C.box('Zipper slider',(0,0,0),(0.055,0.03,0.075),ZIP,'spine_2',bevel=.008,segments=1,transform=SLIDER_M,weights=torso_w)
# the pull tab hangs from the slider along the bulging back (the blockout's straight-down tab sank into the suit)
TAB_TOP=tw(tsurf(0.0,1.11,-1,0.054)[0]);TAB_DIR=(tw(tsurf(0.0,0.90,-1,0.052)[0])-TAB_TOP).normalized()
TAB_M=M4(frame_matrix(V(1,0,0),-TAB_DIR),TAB_TOP)
C.plate('Dangling zipper pull tab',[(-0.032,0.0),(0.032,0.0),(0.05,-0.17),(0.0,-0.21),(-0.05,-0.17)],0.018,ZIP,'zipper_tab',bevel=.006,segments=1,transform=TAB_M)

# ================= Two staggered rows of toy back plates (torso, then tail) =================
def plate_outline(w,h,lean=0.18,pinch=0.42,n=8):
 pts=[(0.5*w,-0.10*h)]
 for k in range(n+1):
  th=math.pi*k/n;u=0.5*w*math.cos(th)*(1-pinch*math.sin(th));v=h*math.sin(th)
  pts.append((u+lean*w*(v/h)**2,v))
 pts.append((-0.5*w,-0.10*h));out=[]
 for q in pts:
  if not out or (Vector(q)-Vector(out[-1])).length>1e-5:out.append(q)
 return out
CYCLE=[PL_OR,PL_YE,PL_PK,PL_BL];k=0;PLATES=[]
for i,(z,h) in enumerate([(1.40,0.44),(1.28,0.48),(1.12,0.44),(0.96,0.42),(0.80,0.38),(0.64,0.33),(0.48,0.28),(0.32,0.24)]):
 sx=1 if i%2==0 else -1;x=0.12*sx
 p,n=tsurf(x,z,-1,-0.03);p2,_=tsurf(x,z-0.02,-1,-0.03);Tv=tn(p2-p)
 N=tn(n);N=(N+V(0,0,0.55)+V(sx*(0.62 if i<2 else 0.35),0,0)).normalized()
 bn=max(torso_w(tw(p)).items(),key=lambda kv:kv[1])[0]
 C.plate('Toy back plate %02d'%k,plate_outline(0.34*h/0.42+0.06,h),0.07,CYCLE[k%4],bn,bevel=.018,segments=1,transform=M4(frame_matrix(Tv,N),tw(p)))
 PLATES.append(('torso',k,bn));k+=1
for j,(frac,h) in enumerate([(0.13,0.22),(0.29,0.19),(0.45,0.16),(0.61,0.13),(0.77,0.10),(0.88,0.08)]):
 i=min(range(len(TP)),key=lambda q:abs(TACC[q]-frac*TL));c=TP[i];Tv=(TP[min(i+1,len(TP)-1)]-TP[max(i-1,0)]).normalized()
 up=V(0,0,1);N=(up-up.dot(Tv)*Tv).normalized();B=N.cross(Tv);sx=1 if j%2==0 else -1
 N2=(N+B*0.42*sx).normalized();base=c+N2*(TR[i]*0.78)
 w=tail_w_s(TACC[i]);bn=max(w.items(),key=lambda kv:kv[1])[0]
 C.plate('Toy back plate %02d'%k,plate_outline(0.30*h/0.3+0.05,h),0.06,CYCLE[k%4],bn,bevel=.014,segments=1,transform=M4(frame_matrix(Tv,N2),base))
 PLATES.append(('tail',k,bn));k+=1

# ================= Head: bean cranium, snout with the open grin, jaw, chin, tongue, teeth, eyes =================
HEAD_P=V(0.0,0.60,1.98);HEAD_M=Matrix.Translation(HEAD_P)@Euler((0.10,0.10,0.0)).to_matrix().to_4x4()
def H(*a):return HEAD_M@V(*a)
CRAN=(V(0,0.0,0.10),V(0.39,0.40,0.30));SNOUT=(V(0,0.34,0.02),V(0.33,0.32,0.21));JAW=(V(0,0.28,-0.14),V(0.30,0.30,0.13))
BOWL=(V(0,0.46,-0.035),V(0.25,0.26,0.13))
HMi=HEAD_M.inverted()
def inside(p_local,e,margin=0.0):
 c,s=e;d=p_local-c;return (d.x/(s.x+margin))**2+(d.y/(s.y+margin))**2+(d.z/(s.z+margin))**2<1.0
JAW_HINGE_L=V(0,0.06,-0.05)
def ell_data(name,c,s,n,r):
 verts=[(c.x,c.y,c.z-s.z)]
 for j in range(1,r):
  a=-math.pi/2+math.pi*j/r;ca=math.cos(a)
  verts+=[(c.x+s.x*ca*math.cos(math.tau*i/n),c.y+s.y*ca*math.sin(math.tau*i/n),c.z+s.z*math.sin(a)) for i in range(n)]
 verts.append((c.x,c.y,c.z+s.z))
 faces=[(0,1+(i+1)%n,1+i) for i in range(n)]
 for j in range(r-2):
  for i in range(n):faces.append((1+j*n+i,1+j*n+(i+1)%n,1+(j+1)*n+(i+1)%n,1+(j+1)*n+i))
 top=len(verts)-1;base=1+(r-2)*n;faces+=[(base+i,base+(i+1)%n,top) for i in range(n)]
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
 bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(me);bm.free();return me
def bowl_cutter():
 c,s=BOWL;n=24;r=12;verts=[(c.x,c.y,c.z-s.z)];faces=[]
 rings_=[]
 for j in range(1,r//2+1):
  a=-math.pi/2+math.pi*j/r;ca=math.cos(a)
  zz=c.z+s.z*math.sin(a) if j<r//2 else c.z+0.02*s.z
  rings_.append([(c.x+s.x*ca*math.cos(math.tau*i/n),c.y+s.y*ca*math.sin(math.tau*i/n),zz) for i in range(n)])
 for rr in rings_:verts+=rr
 faces+=[(0,1+(i+1)%n,1+i) for i in range(n)]
 for j in range(len(rings_)-1):
  for i in range(n):faces.append((1+j*n+i,1+j*n+(i+1)%n,1+(j+1)*n+(i+1)%n,1+(j+1)*n+i))
 last=1+(len(rings_)-1)*n;faces.append(tuple(last+i for i in range(n)))
 me=bpy.data.meshes.new('Grin bowl cutter');me.from_pydata(verts,[],faces);me.update()
 bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(me);bm.free()
 ob=bpy.data.objects.new('Grin bowl cutter',me);bpy.context.collection.objects.link(ob);return ob
CUTTER=bowl_cutter()
def carved(name,e,n,r,tile,bn,other,weights=None,carve=True):
 """Head-local ellipsoid carved by the grin bowl (exact boolean), mouth tile inside the bowl or the other part."""
 me=ell_data(name,e[0],e[1],n,r);ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob)
 if carve:
  bpy.context.view_layer.objects.active=ob;ob.select_set(True)
  md=ob.modifiers.new('Grin cavity','BOOLEAN');md.operation='DIFFERENCE';md.solver='EXACT';md.object=CUTTER
  bpy.ops.object.modifier_apply(modifier=md.name);ob.select_set(False)
 bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.triangulate(bm,faces=[f for f in bm.faces if len(f.verts)>4]);bm.to_mesh(ob.data);bm.free()
 for v in ob.data.vertices:v.co=HEAD_M@v.co
 R3i=HEAD_M.to_3x3().inverted()
 def fval(q,el):
  c,s=el;d=q-c;return (d.x/s.x)**2+(d.y/s.y)**2+(d.z/s.z)**2
 def grad(q,el):
  c,s=el;d=q-c;return V(d.x/s.x**2,d.y/s.y**2,d.z/s.z**2)
 def ft(c,nn):
  q=HMi@c;nl=R3i@nn
  # cavity faces lie on the bowl and face into it (against the bowl's outward gradient)
  if carve and fval(q,BOWL)<1.3 and nl.dot(grad(q,BOWL))<0 and fval(q,e)<1.02:return MOUTH
  if other is not None and fval(q,other)<0.96:return MOUTH
  return None
 C.finish(ob,name,tile,bn,0,True,weights,ft)
 # crisp lip edge: sharp edges between mouth and suit faces
 uvt={}
 for p in ob.data.polygons:
  t=ft(p.center,p.normal);uvt[p.index]=MOUTH if t==MOUTH else tile
 bm=bmesh.new();bm.from_mesh(ob.data)
 for e_ in bm.edges:
  fs=e_.link_faces
  if len(fs)==2 and uvt[fs[0].index]!=uvt[fs[1].index]:e_.smooth=False
 bm.to_mesh(ob.data);bm.free()
 return ob
carved('Bean cranium',CRAN,28,14,SUIT,'head',None,carve=False)
carved('Snout with the ear-to-ear grin',SNOUT,32,16,SUIT,'head',JAW)
carved('Lower jaw',JAW,28,12,SUIT,'jaw',SNOUT)
bpy.data.objects.remove(CUTTER,do_unlink=True)
C.ellipsoid('Butter chin',(0,0,0),(0.25,0.26,0.066),BELLY,'jaw',n=16,r=6,transform=HEAD_M@Matrix.Translation((0,0.25,-0.212)))
C.ellipsoid('Pink tongue',(0,0,0),(0.10,0.12,0.04),TONGUE,'tongue',n=12,r=6,transform=HEAD_M@Matrix.Translation((0.07,0.47,-0.125))@Euler((0.15,0.0,-0.35)).to_matrix().to_4x4())
for sx in (1,-1):
 C.box('Buck tooth %+d'%sx,(0,0,0),(0.07,0.03,0.075),TOOTH,'head',bevel=.012,segments=1,transform=HEAD_M@Matrix.Translation((0.042*sx,0.64,-0.055))@Euler((0.25,0,0)).to_matrix().to_4x4())
 C.ellipsoid('Nostril %+d'%sx,(0,0,0),(0.03,0.02,0.018),INK,'head',n=8,r=4,transform=HEAD_M@Matrix.Translation((0.085*sx,0.60,0.16))@Euler((0.7,0,0)).to_matrix().to_4x4())
 C.ellipsoid('Cheek blush %+d'%sx,(0,0,0),(0.07,0.05,0.045),BLUSH,'head',n=10,r=5,transform=HEAD_M@Matrix.Translation((0.235*sx,0.40,0.0))@Euler((0,0,0.9*sx)).to_matrix().to_4x4())
EYES={}
for sx,pupil in ((1,(-0.35,-0.45)),(-1,(0.40,0.42))):
 d=V(0.52*sx,0.58,0.66).normalized();c,s=CRAN
 t=1/math.sqrt(sum((d[i]/s[i])**2 for i in range(3)));p=c+d*t
 nrm=V(p.x/s.x**2,(p.y-c.y)/s.y**2,(p.z-c.z)/s.z**2).normalized();nrm=(nrm+V(0,0.5,0)).normalized()
 FR=HEAD_M@Matrix.Translation(p+nrm*0.02)@nrm.to_track_quat('Z','Y').to_matrix().to_4x4()
 lab='R' if sx==1 else 'L'
 C.ellipsoid('Googly eye white '+lab,(0,0,0),(0.165,0.165,0.07),EYE,'head',n=20,r=8,transform=FR)
 C.torus('Googly eye plastic rim '+lab,(0,0,0.012),0.162,0.013,EYE_RIM,'head',n=20,m=4,transform=FR)
 pc=(pupil[0]*0.165*sx,pupil[1]*0.165,0.058)
 C.ellipsoid('Googly pupil '+lab,pc,(0.072,0.072,0.022),INK,'pupil_'+lab,n=12,r=5,transform=FR)
 EYES[lab]=FR

# ================= Bubble cockpit strapped to the shoulders =================
CK=V(0.0,-0.12,2.34);CK_M=Matrix.Translation(CK)
def K(*a):return CK+V(*a)
C.lathe('Violet cockpit tub',(0,0,0),[(-0.34,0.20),(-0.30,0.33),(-0.18,0.42),(-0.05,0.455),(0.0,0.455)],COCKPIT,'cockpit',n=24,transform=CK_M)
C.torus('Brass cockpit rim',(0,0,0),0.458,0.028,BRASS,'cockpit',n=24,m=4,transform=CK_M)
for kk,(da,col) in enumerate(((0.28,RED),(0.0,PL_YE),(-0.28,GREEN))):
 for sx,base in ((1,0.0),(-1,math.pi)):
  a=base+sx*da
  C.ellipsoid('Cockpit signal light %d %+d'%(kk,sx),tuple(K(0.445*math.cos(a),0.445*math.sin(a),-0.12)),(0.036,0.036,0.036),col,'cockpit',n=8,r=4)
# (the blockout's eight rim rivets are omitted: sub-2 cm details that do not read at play distance)
R_DOME=0.48;DN=24;DR=8
def dome_uv(poly,cos):
 cen=poly.center-CK;ac=math.atan2(cen.y,cen.x)%math.tau;out=[]
 for co in cos:
  q=co-CK
  if math.hypot(q.x,q.y)<1e-5:a=ac
  else:
   a=math.atan2(q.y,q.x)%math.tau
   if a-ac>math.pi:a-=math.tau
   elif ac-a>math.pi:a+=math.tau
  e=math.asin(max(-1,min(1,q.z/R_DOME)))
  out.append((a/math.tau,e/(math.pi/2)))
 return out
dprof=[(R_DOME*math.sin(math.pi/2*i/DR),R_DOME*math.cos(math.pi/2*i/DR)) for i in range(DR+1)]
C.lathe('Clear bubble cockpit dome',(0,0,0),dprof,GLASS,'dome',mat=1,n=DN,caps=False,transform=CK_M,uv_fn=dome_uv)
PORT_D=V(0.40,0.13,0.91).normalized();PORT=PORT_D*R_DOME
# the brass port ring sits exactly where the vertical antenna rod crosses the dome (the blockout's port was 8 mm off)
_ax,_ay=PORT.x-0.005,PORT.y-0.005;PORT_X=V(_ax,_ay,math.sqrt(R_DOME**2-_ax**2-_ay**2));PORT_XD=PORT_X.normalized()
PORT_M=CK_M@Matrix.Translation(PORT_X+PORT_XD*0.004)@V(0,0,1).lerp(PORT_XD,0.6).normalized().to_track_quat('Z','Y').to_matrix().to_4x4()
C.torus('Brass antenna port',(0,0,0),0.058,0.013,BRASS,'dome',n=12,m=4,transform=PORT_M)

# ================= The cartoon evil scientist inside the dome =================
bx=-0.06
def coat_w(p):
 z=(p-CK).z;t=C.smooth((z-0.04)/0.08);return {'pilot_root':1-t,'pilot_spine':t}
C.lathe('Scientist lab coat body',(bx,0,0),[(-0.02,0.15),(0.08,0.155),(0.15,0.14),(0.20,0.11),(0.235,0.05),(0.24,0.0)],COAT,'pilot_spine',n=16,ey=0.82,caps=(False,True),transform=CK_M,weights=coat_w)
C.lathe('Mint high collar',(bx,0,0.20),[(0.0,0.075),(0.05,0.068)],TEAL,'pilot_spine',n=12,transform=CK_M)
C.box('Lab coat pocket with pens',(bx-0.04,0.119,0.095),(0.07,0.012,0.058),POCKET,'pilot_spine',bevel=.003,segments=1,transform=CK_M,face_tile=lambda c,n:POCKET if n.y>0.7 else COAT_S)
hx,hy,hz=-0.075,0.03,0.315
C.ellipsoid('Scientist round bald head',(hx,hy-0.003,hz+0.006),(0.105,0.10,0.116),SKIN,'pilot_head',n=16,r=8,transform=CK_M)
for sx in (1,-1):
 C.ellipsoid('Scientist ear %+d'%sx,(hx+0.103*sx,hy-0.005,hz-0.01),(0.018,0.026,0.03),SKIN,'pilot_head',n=8,r=4,transform=CK_M)
C.ellipsoid('Scientist round pink nose',(hx+0.004,hy+0.107,hz-0.03),(0.025,0.022,0.022),NOSE,'pilot_head',n=8,r=5,transform=CK_M)
C.torus('Goggle strap',(hx,hy,hz+0.018),0.106,0.011,STRAP,'pilot_head',n=16,m=3,ey=0.96,transform=CK_M)
for sx in (1,-1):
 gx=hx+0.043*sx;gy=hy+0.086;gz=hz+0.02
 GF=CK_M@Matrix.Translation((gx,gy,gz))@Euler((-math.pi/2+0.08,0.0,-sx*0.30)).to_matrix().to_4x4()
 C.lathe('Goggle lens %+d'%sx,(0,0,0),[(-0.015,0.040),(0.015,0.040)],LENS,'pilot_head',n=12,transform=GF)
 C.torus('Goggle brass rim %+d'%sx,(0,0,0.016),0.041,0.009,BRASS,'pilot_head',n=12,m=3,transform=GF)
 C.ellipsoid('Gleeful pupil %+d'%sx,(0.014,-0.014,0.017),(0.013,0.013,0.005),INK,'pilot_head',n=8,r=4,transform=GF)
 brow=[(hx+0.018*sx,hy+0.098,hz+0.066),(hx+0.05*sx,hy+0.092,hz+0.08),(hx+0.082*sx,hy+0.074,hz+0.092)]
 C.tube('Scheming brow %+d'%sx,[K(*q) for q in C.bspline(brow,4)],C.bspline_radii([0.011,0.012,0.009],4),HAIR,'pilot_head',n=5)
GRIN_M=CK_M@Matrix.Translation((hx,hy+0.094,hz-0.046))@Matrix.Rotation(-0.35,4,'X')
C.plate('Scientist cut-in grin',[(-0.050,0.0),(0.050,0.0),(0.042,-0.016),(0.022,-0.028),(0.0,-0.032),(-0.022,-0.028),(-0.042,-0.016)],0.016,MOUTH,'pilot_head',bevel=.003,segments=1,transform=GRIN_M)
C.box('Scientist top teeth',(0,0.006,-0.007),(0.058,0.008,0.012),TOOTH,'pilot_head',bevel=.002,segments=1,transform=GRIN_M)
# pointed side-and-back frizz below the crown line (no lobes on top of the head)
frizz=[(0.0,0.00,0.085),(-0.35,0.025,0.08),(0.35,-0.02,0.075),(-0.75,-0.01,0.07),(0.7,0.03,0.065)]
def spike(name,base,tip,r0):
 d=(tip-base);L=d.length;Mx=Matrix.Translation(base)@d.normalized().to_track_quat('Z','Y').to_matrix().to_4x4()
 C.lathe(name,(0,0,0),[(0.0,r0),(L*0.55,r0*0.62),(L,0.0)],HAIR,'pilot_head',n=5,transform=Mx)
kk=0
for sx in (1,-1):
 for yaw,dz,ln in frizz:
  d=V(sx*math.cos(yaw*0.9),-abs(math.sin(yaw*0.9))*(1 if yaw<0 else 0.4)+0.05,dz*3).normalized()
  base=V(hx,hy-0.015,hz+0.01+dz)+V(d.x,d.y,0).normalized()*0.075
  spike('Wild hair spike %d'%kk,K(*base),K(*(base+d*ln)),0.03);kk+=1
for j,(dx,dz) in enumerate(((-0.04,0.0),(0.04,0.0),(0.0,-0.035))):
 base=V(hx+dx,hy-0.085,hz+0.02+dz);d=V(dx*4,-1,-0.15).normalized()
 spike('Wild hair spike back %d'%j,K(*base),K(*(base+d*0.07)),0.03)
# right arm raised up-right holding the -inator remote under the port; left arm pointing forward
REM_LOC=V(PORT.x-0.005,PORT.y-0.005,0.315);REM_M=CK_M@Matrix.Translation(REM_LOC)@Euler((0.0,0.0,0.30)).to_matrix().to_4x4()
GRIP=REM_LOC+V(0.0,0.0,-0.07)
PR_S=V(bx+0.09,0.0,0.17);PR_E=V(bx+0.22,0.04,0.19);PR_W=GRIP+V(0.0,0.0,-0.03)
PL_S=V(bx-0.09,0.0,0.17);PL_E=V(bx-0.15,0.12,0.16);PL_W=V(bx-0.125,0.245,0.205)
FING_A=V(bx-0.118,0.285,0.215);FING_B=V(bx-0.113,0.33,0.225)
def sleeve(name,S0,E0,W0,label):
 path=[K(*q) for q in C.catmull([S0,E0,W0],3)];acc=C.arclength(path);sE=acc[3]
 def w(p):
  i=min(range(len(path)),key=lambda k:(path[k]-p).length);s_=acc[i]
  if s_<0.03:t=C.smooth(s_/0.03);return {'pilot_spine':1-t,'pilot_upper_'+label:t}
  t=C.smooth((s_-(sE-.025))/.05);return {'pilot_upper_'+label:1-t,'pilot_lower_'+label:t}
 C.tube(name,path,[0.035+(0.030-0.035)*a/acc[-1] for a in acc],COAT,'pilot_upper_'+label,n=8,weights=w)
sleeve('Scientist raised coat sleeve',PR_S,PR_E,PR_W,'R')
sleeve('Scientist pointing coat sleeve',PL_S,PL_E,PL_W,'L')
C.ellipsoid('Purple glove holding remote',tuple(K(*GRIP)),(0.034,0.031,0.036),GLOVE,'pilot_lower_R',n=10,r=6)
C.ellipsoid('Purple glove pointing',tuple(K(bx-0.12,0.265,0.21)),(0.033,0.036,0.03),GLOVE,'pilot_hand_L',n=10,r=6)
C.tube('Pointing finger',[K(*FING_A),K(*FING_B)],[0.012,0.011],GLOVE,'pilot_hand_L',n=6)
C.box('Chunky -inator remote',(0,0,0),(0.085,0.055,0.13),REMOTE,'remote',bevel=.011,segments=1,transform=REM_M,face_tile=lambda c,n:REMOTE_FACE if (REM_M.to_3x3().inverted()@n).y>0.8 else None)
C.lathe('Big red -inator button',(0,0.0275,0.03),[(0.0,0.022),(0.013,0.021),(0.018,0.0)],RED,'remote',n=10,axis='y',transform=REM_M)
for kk,(x,col) in enumerate(((-0.022,PL_YE),(0.022,TEAL))):
 C.lathe('Remote dial %d'%kk,(x,0.0275,-0.022),[(0.0,0.011),(0.008,0.011),(0.011,0.0)],col,'remote',n=8,axis='y',transform=REM_M)
T0=REM_LOC+V(0,0,0.06);UP=PORT.z+0.03
ZIG=[T0,V(T0.x,T0.y,UP)]
for a,b in ((0.05,0.08),(-0.045,0.155),(0.055,0.23),(-0.035,0.30),(0.02,0.345)):ZIG.append(V(T0.x+a*0.76,T0.y-a*0.76,UP+b))
BALL=ZIG[-1]+V(0,0,0.03)
def antenna_w(p):
 z=(p-CK).z;t1=C.smooth((z-(UP-0.02))/0.04);t2=C.smooth((z-(ZIG[3].z-0.02))/0.04)
 return {'antenna_1':1-t1,'antenna_2':t1*(1-t2),'antenna_3':t1*t2}
# mitred zig-zag rod: corner rings widen by 1/cos(half-angle) so the rod keeps its thickness
ZP=[K(*q) for q in ZIG];ZR=[]
for i in range(len(ZP)):
 if 0<i<len(ZP)-1:
  a=(ZP[i]-ZP[i-1]).normalized();b=(ZP[i+1]-ZP[i]).normalized();ZR.append(0.015/max(0.45,math.sqrt((1+a.dot(b))/2)))
 else:ZR.append(0.015)
C.tube('Zig-zag -inator antenna',ZP,ZR,PL_YE,'antenna_1',n=6,weights=antenna_w,hint=(1,0,0))
C.ellipsoid('Pink antenna ball',tuple(K(*BALL)),(0.036,0.036,0.036),PL_PK,'antenna_3',n=10,r=6)

# ================= Straps from the tub down to the chest belt =================
def outside(pw,off):
 q=TMi@pw;r=C.interp(TORSO,max(0.0,min(q.z,1.58)))
 if r<1e-3:return pw
 e=math.sqrt(q.x**2+(q.y/TORSO_EY)**2)/r
 if e<1+off/r:
  s_=(1+off/r)/max(e,1e-4);q=V(q.x*s_,q.y*s_,q.z)
 return TORSO_M@q
for j,az in enumerate((20,160,238,302)):
 a=math.radians(az);p1=CK+V(0.31*math.cos(a),0.31*math.sin(a),-0.29)
 r=C.interp(TORSO,ZB);lp=V(r*math.cos(a),r*TORSO_EY*math.sin(a),ZB);p2=tw(lp)
 pts=[p1.lerp(p2,t) for t in (0.0,0.25,0.5,0.75,1.0)];pts=[pts[0]]+[outside(q,0.018) for q in pts[1:]]
 side=V(-math.sin(a),math.cos(a),0.0)
 normals=[]
 for q in pts:
  qq=TMi@q;rr=C.interp(TORSO,max(0.0,min(qq.z,1.45)));nn=tn(V(qq.x/rr**2,qq.y/(TORSO_EY*rr)**2,0).normalized());normals.append(nn)
 def sw(p,p1=p1,p2=p2):
  f=max(0.0,min(1.0,(p-p1).dot(p2-p1)/(p2-p1).length_squared));t=C.smooth(f*1.4)
  d={k:v*t for k,v in torso_w(p).items()};d['cockpit']=d.get('cockpit',0)+(1-t);return d
 bis=[(side-side.dot(nn)*nn).normalized() for nn in normals]
 C.ribbon('Cockpit strap %d'%j,[q-nn*0.01 for q,nn in zip(pts,normals)],normals,0.038,0.02,STRAP,'cockpit',closed=False,weights=sw,binormals=bis)

# ================= Rig rest layout (bind pose = approved sheet pose) =================
def TLZ(z):return tuple(tw(V(0,0,z)))
tp=lambda f:tuple(tail_point(f))
REST={'root':((0,0,0),(0,0,.1),None),
 'hips':(TLZ(0.30),TLZ(0.55),'root'),
 'spine_1':(TLZ(0.55),TLZ(0.95),'hips'),
 'spine_2':(TLZ(0.95),TLZ(1.25),'spine_1'),
 'spine_3':(TLZ(1.25),TLZ(1.58),'spine_2'),
 'neck':((0,0.36,1.78),tuple(HEAD_P),'spine_3'),
 'head':(tuple(HEAD_P),tuple(H(0,0,0.40)),'neck'),
 'jaw':(tuple(H(*JAW_HINGE_L)),tuple(H(0,0.50,-0.16)),'head'),
 'tongue':(tuple(H(0.03,0.36,-0.12)),tuple(H(0.10,0.58,-0.13)),'jaw'),
 'zipper_tab':(tuple(TAB_TOP),tuple(TAB_TOP+TAB_DIR*0.21),'spine_2'),
 'cockpit':(tuple(K(0,0,-0.34)),tuple(K(0,0,0.0)),'spine_3'),
 'dome':(tuple(K(0,-0.46,0.0)),tuple(K(0,-0.46,0.20)),'cockpit'),
 'pilot_root':(tuple(K(bx,0,0.0)),tuple(K(bx,0,0.10)),'cockpit'),
 'pilot_spine':(tuple(K(bx,0,0.10)),tuple(K(bx,0,0.22)),'pilot_root'),
 'pilot_head':(tuple(K(hx,hy,hz-0.09)),tuple(K(hx,hy,hz+0.12)),'pilot_spine'),
 'pilot_upper_R':(tuple(K(*PR_S)),tuple(K(*PR_E)),'pilot_spine'),
 'pilot_lower_R':(tuple(K(*PR_E)),tuple(K(*GRIP)),'pilot_upper_R'),
 'remote':(tuple(K(*GRIP)),tuple(K(*T0)),'pilot_lower_R'),
 'antenna_1':(tuple(K(*T0)),tuple(K(*ZIG[1])),'remote'),
 'antenna_2':(tuple(K(*ZIG[1])),tuple(K(*ZIG[3])),'antenna_1'),
 'antenna_3':(tuple(K(*ZIG[3])),tuple(K(*BALL)),'antenna_2'),
 'pilot_upper_L':(tuple(K(*PL_S)),tuple(K(*PL_E)),'pilot_spine'),
 'pilot_lower_L':(tuple(K(*PL_E)),tuple(K(*PL_W)),'pilot_upper_L'),
 'pilot_hand_L':(tuple(K(*PL_W)),tuple(K(*FING_B)),'pilot_lower_L')}
for lab in 'RL':
 FR=EYES[lab];REST['pupil_'+lab]=(tuple(FR@V(0,0,0)),tuple(FR@V(0,0,0.10)),'head')
 SH,EL,HA,hd=ARMS[lab];REST['arm_upper_'+lab]=(tuple(SH),tuple(EL),'spine_2');REST['arm_lower_'+lab]=(tuple(EL),tuple(hd),'arm_upper_'+lab)
 x=LEG_X*(1 if lab=='R' else -1)
 REST['thigh_'+lab]=((x,0.06,0.80),(x,0.10,0.44),'hips');REST['shin_'+lab]=((x,0.10,0.44),(x,0.08,0.20),'thigh_'+lab)
 REST['foot_'+lab]=((x,0.08,0.20),(x,0.40,0.08),'shin_'+lab)
for j in range(5):REST['tail_%d'%(j+1)]=(tp(TAIL_NODES[j]),tp(TAIL_NODES[j+1]),'hips' if j==0 else 'tail_%d'%j)

# ================= Join one skin, clamp the floor, build the rig, checkpoint =================
sources=bpy.data.collections.new('EDITABLE original inator monster parts - excluded from export');sc.collection.children.link(sources)
inventory=[];copies=[]
for ob in C.PARTS:
 ob.data.calc_loop_triangles();inventory.append({'name':ob.name,'triangles':len(ob.data.loop_triangles),'bone_groups':[g.name for g in ob.vertex_groups],'atlas_tile':ob.get('atlas_tile'),'material':ob.data.materials[0].name})
 cp=ob.copy();cp.data=ob.data.copy();sc.collection.objects.link(cp);copies.append(cp)
 for col in list(ob.users_collection):col.objects.unlink(ob)
 sources.objects.link(ob)
sources.hide_render=True;sources.hide_viewport=True
bpy.ops.object.select_all(action='DESELECT')
for ob in copies:ob.select_set(True)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();skin=bpy.context.object;skin.name='Inator_Monster_Skin';skin.data.name='Inator_Monster_Skin'
for tag in ['source_part','rigid_weight','atlas_tile']:
 if tag in skin:del skin[tag]
clamped=0
# Floor contact: the round soles and the floor-resting tail are clamped to a 6 mm contact plane, which keeps
# baked-keyframe interpolation (about 2 mm at most between 30 fps keys) above the floor.
FLOOR_CLEAR=0.006
for v in skin.data.vertices:
 if -0.05<v.co.z<FLOOR_CLEAR:v.co.z=FLOOR_CLEAR;clamped+=1
skin.data.update();skin.data.calc_loop_triangles();tris=len(skin.data.loop_triangles)
data=bpy.data.armatures.new('Original inator monster rig');arm=bpy.data.objects.new('Inator_Monster_Rig',data);sc.collection.objects.link(arm)
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
mats=[0,0]
for p in skin.data.polygons:mats[p.material_index]+=len(p.vertices)-2
arm['asset_id']='inator-monster';arm['version']='v001';arm['forward']='Blender +Y / glTF -Z';arm['neutral_total_height_m']=round(hi[2],4);arm['attack_contact_fraction']=.625
record={'asset_id':'inator-monster','version':'v001','work_order':'WO111','authoring_model':'claude-opus-5-5 xhigh (Claude Code subagent; Tom ruled Sept 26 that Opus 5.5 does the WO111 Blender work)','blender_version':bpy.app.version_string,
 'blender_instance':'blender-authoring-2','source_reference':'Blender reference sheet, no generated concept','source_sheet_sha256':sc['source_sheet_sha256'],'source_blockout_sha256':sc['source_blockout_sha256'],
 'rest_bounds_blender_z_up':{'min':lo,'max':hi},'height_m':hi[2],'triangles':tris,'triangles_by_material':{'opaque':mats[0],'glass':mats[1]},'vertices':len(skin.data.vertices),'material_count':len(skin.data.materials),'bone_count':len(data.bones),
 'floor_clamped_vertices':clamped,
 'texture':{'file':'pigment.png','width':1024,'height':1024,'format':'8-bit indexed PNG with a tRNS chunk (only the glass block entries are translucent)','origin':'Original deterministic painted palette atlas generated in Blender Python from the sheet colours; no external textures.','palette':COLORS,'glass':GLASS_HEX,**ATLAS},
 'plates':PLATES,'parts':inventory}
(ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n')
rest_json={k:[list(map(float,h)),list(map(float,t)),p] for k,(h,t,p) in REST.items()}
# guard data for animate.py: tail tube samples (centre, radius, weights), foot/toe ellipsoids, pupil offsets
tail_samples=[{'p':list(map(float,TP[i])),'r':float(TR[i]),'w':{k:float(v) for k,v in tail_w_s(TACC[i]).items()}} for i in range(len(TP))]
feet={lab:[[[LEG_X*sg,0.14,0.135],[0.235,0.33,0.135]]]+[[[LEG_X*sg+dx,0.44-abs(dx)*0.35,0.075],[0.062,0.07,0.058]] for dx in (-0.12,0.0,0.12)] for lab,sg in (('R',1),('L',-1))}
pupils={}
for lab,(sx,pupil) in (('R',(1,(-0.35,-0.45))),('L',(-1,(0.40,0.42)))):
 FR=EYES[lab];o=FR@V(0,0,0);pc=FR@V(pupil[0]*0.165*sx,pupil[1]*0.165,0.058)
 pupils[lab]={'centre':list(o),'normal':list((FR.to_3x3()@V(0,0,1)).normalized()),'offset':list(pc-o)}
(ROOT/'source/rig-rest.json').write_text(json.dumps({'rest':rest_json,'tail_samples':tail_samples,'feet':feet,'pupils':pupils,
 'dome':{'centre':list(CK),'radius':R_DOME,'port_centre':list(CK+PORT_X),'port_hole_radius':0.058-0.013,'antenna_radius':0.015},
 'torso_bottom':{'matrix':[list(r) for r in TORSO_M],'profile':TORSO[:4],'ey':TORSO_EY}},indent=1)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'inator-monster-construction.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(ROOT/'inator-monster-checkpoint.glb'),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_yup=True,export_apply=False,export_armature_object_remove=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=True)
big=sorted(inventory,key=lambda r:-r['triangles'])
print(json.dumps({'triangles':tris,'by_material':mats,'vertices':len(skin.data.vertices),'height_m':hi[2],'bounds':[lo,hi],'bones':len(data.bones),'clamped':clamped,'atlas':ATLAS,'largest':[(r['name'],r['triangles']) for r in big[:25]]}))
