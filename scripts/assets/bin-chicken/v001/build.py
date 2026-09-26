"""WO111 bin-chicken v001: final budgeted model from the approved Blender reference sheet.

Source authority: reference-sheet.png and bin-chicken-blockout.blend (coordinator approved
Sept 26, "Blender reference sheet, no generated concept"). The blockout's measured coordinates
are kept for silhouette, colour and parody hooks: floppy banana-peel hat, big bald plum-black
head with googly eyes (right wide under a raised brow, left half-lidded, pupils glancing to its
right), long down-curved graphite beak holding one stolen hot chip crosswise, pink gape grin,
bare black S-neck in a scruffy white ruff, grubby-white egg body with beige bin-grime smudges,
folded wings whose black tips cross behind its back over a blue-and-white striped paper cone of
chips, lacy black plume tail, and knobbly mauve stilt legs (thickened about 20% per the
coordinator note) on big three-toed feet. Topology, weights, rig and atlas are new.

Bind pose: head straight and both feet flat (rig friendly, per the sheet notes). The sheet's
design pose (head turned 17 degrees to its right and tilted 7 degrees, left foot on tiptoe) is
recreated by the idle clip at 0 s, which the matched stills show.

Blender +Z up / +Y forward (glTF +Y up / -Z forward), floor-centred root, right = +X.
"""
import bpy, math, json, hashlib, importlib.util, struct, zlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler
import numpy as np

ROOT=Path('/workspace/haynes-quest/family-eras/bin-chicken/v001')
sc=bpy.context.scene
assert sc.get('work_order')=='WO111' and sc.get('scene_lease')=='active' and sc.get('asset_id')=='bin-chicken'
spec=importlib.util.spec_from_file_location('wo111_bin_chicken_common',ROOT/'source/common.py')
C=importlib.util.module_from_spec(spec);spec.loader.exec_module(C)

# ---- Atlas: 16 sheet colours, each a 256 px tile with a quiet painted field.
COLORS=['f1f0ea','c9bca6','2e2a38','4c4657','7d6c7a','e3998d','fbf8f2','a8683e','f2c94c','f7e7b4','7a5634','f6f0e2','5d8fbf','e7b451','e6e3da','3a3547']
WHITE,GRIME,INK,BEAK,LEG,PINK,EYE,IRIS,PEEL,PEELIN,BROWN,PAPER,STRIPE,CHIP,SHADE,INK_SOFT=range(16)
def atlas():
 rng=np.random.default_rng(11109);yy,xx=np.mgrid[0:256,0:256]
 indices=np.zeros((1024,1024),dtype=np.uint8);palette=[]
 for i,h in enumerate(COLORS):
  rgb=np.array([int(h[j:j+2],16)/255 for j in (0,2,4)])
  field=.012*np.sin(xx*.029+yy*.019+i)+.008*np.cos(xx*.067-yy*.041+2*i)
  field+=rng.integers(-1,2,(256,256))*.002
  levels=np.clip(np.round((field+.04)/.0055),0,15).astype(np.uint8)
  for level in range(16):palette.extend(np.round(np.clip(rgb+(-.04+level*.0055),.01,.99)*255).astype(np.uint8).tolist())
  row=3-i//4;col=i%4;indices[row*256:(row+1)*256,col*256:(col+1)*256]=i*16+levels
 def chunk(name,data):return struct.pack('>I',len(data))+name+data+struct.pack('>I',zlib.crc32(name+data)&0xffffffff)
 raw=b''.join(b'\x00'+row.tobytes() for row in indices[::-1])
 png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1024,1024,8,3,0,0,0))+chunk(b'PLTE',bytes(palette))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
 (ROOT/'pigment.png').write_bytes(png)

atlas()
keep={k:sc[k] for k in sc.keys() if k.startswith('blendermcp_') or k in ('work_order','scene_owner','scene_lease','asset_id','asset_version','authoring_model')}
C.setup(ROOT,[('Matte painted feathers, skin, peel and paper',.86),('Satin eyes and beak',.40)],'bin-chicken original painted 1024 atlas')
for key in list(sc.keys()):
 if key not in keep and key!='cycles':del sc[key]
sc['candidate_status']="WO111 bin-chicken v001 · Awaiting Tom's review · used in the family release"
sc['source_reference']='Blender reference sheet, no generated concept'
sc['source_sheet_sha256']=hashlib.sha256((ROOT/'reference-sheet.png').read_bytes()).hexdigest()
sc['source_blockout_sha256']=hashlib.sha256((ROOT/'bin-chicken-blockout.blend').read_bytes()).hexdigest()
sc['orientation']='Blender +Z up/+Y forward; glTF +Y up/-Z forward; stationary identity floor root; character right = +X'

def V(*a):return Vector(a)
smooth=C.smooth

# ================= Key blockout dimensions (metres) =================
TAIL_END=V(0.0,-0.27,0.535);CHEST=V(0.0,0.235,0.665)
BODY_RAW=[(0.0,0.03),(0.03,0.085),(0.08,0.135),(0.16,0.176),(0.26,0.192),(0.35,0.188),(0.42,0.165),(0.47,0.125),(0.50,0.075),(0.515,0.02)]
BODY_EY=1.06
HC=V(0.0,0.175,1.075);HR=V(0.118,0.13,0.108)
NECK_PTS=[(0.0,0.18,0.70),(0.0,0.215,0.79),(0.0,0.21,0.88),(0.0,0.168,0.95),(0.0,0.163,1.0),(0.0,0.168,1.035)]
PIVOT=V(0.0,0.165,1.0)

def smooth_profile(profile,step):
 t0,t1=profile[0][0],profile[-1][0];n=max(8,int((t1-t0)/step))
 ts=[t0+(t1-t0)*i/n for i in range(n+1)];rs=[C.interp(profile,t) for t in ts]
 for _ in range(2):rs=[rs[0]]+[(rs[i-1]+2*rs[i]+rs[i+1])/4 for i in range(1,len(rs)-1)]+[rs[-1]]
 return list(zip(ts,rs))

BODY=[(-0.004,0.0)]+smooth_profile(BODY_RAW,0.034)+[(0.519,0.0)]
BODY_M=C.axis_frame(TAIL_END,CHEST,(0,0,1));BODY_MI=BODY_M.inverted()
def g_body(p):
 q=BODY_MI@p
 if q.z<0 or q.z>0.515:return 9.0
 r=C.interp(BODY_RAW,q.z)
 if r<1e-4:return 9.0
 return (q.x*q.x+(q.y/BODY_EY)**2)/(r*r)
def body_normal(p,h=1e-3):
 return V(g_body(p+V(h,0,0))-g_body(p-V(h,0,0)),g_body(p+V(0,h,0))-g_body(p-V(0,h,0)),g_body(p+V(0,0,h))-g_body(p-V(0,0,h))).normalized()
def hit_body(origin,direction):
 o=V(*origin);d=V(*direction).normalized();s=0.0
 while g_body(o+d*s)>=1 and s<2.0:s+=0.002
 assert s<2.0,('ray missed the body',origin)
 lo,hi=s-0.002,s
 for _ in range(40):
  mid=(lo+hi)/2
  if g_body(o+d*mid)<1:hi=mid
  else:lo=mid
 p=o+d*hi;return p,body_normal(p)

def head_pt(x,z,off=0.0):
 q=max(0.0,1-(x/HR.x)**2-((z-HC.z)/HR.z)**2);y=HC.y+HR.y*math.sqrt(q)
 n=V(x/HR.x**2,(y-HC.y)/HR.y**2,(z-HC.z)/HR.z**2).normalized()
 return V(x,y,z)+n*off,n
def sph(theta,phi,s=1.0):
 return HC+V(HR.x*math.sin(theta)*math.sin(phi)*s,HR.y*math.sin(theta)*math.cos(phi)*s,HR.z*math.cos(theta)*s)

# ================= Rig rest layout (bind pose: head straight, feet flat) =================
P=[V(*p) for p in NECK_PTS]
LEG_X=0.08
HIP=lambda s:V(s*LEG_X,0.0,0.39)
KNEE=lambda s:V(s*0.082,-0.045,0.205)
BALL=lambda s:V(s*0.085,0.03,0.030)
TOE_Z=0.014
BEAK_CTRL=[(0.0,0.245,1.055),(0.0,0.33,1.05),(0.0,0.42,1.022),(0.0,0.50,0.968),(0.0,0.555,0.90),(0.0,0.582,0.835)]
BEAK_PATH=C.catmull_ext(BEAK_CTRL,4)
tipc=BEAK_PATH[int(len(BEAK_PATH)*0.86)]
CHIP_C=V(tipc.x+0.012,tipc.y+0.002,tipc.z-0.004);CHIP_R=Euler((0.0,0.22,0.12))
CHIP_AX=CHIP_R.to_matrix()@V(1,0,0)
CONE_A=V(0.0,-0.365,0.565);CONE_B=V(-0.058,-0.35,0.735);CONE_AX=(CONE_B-CONE_A).normalized()
EYES={}
for sx,big in ((1,1.08),(-1,1.0)):
 p,n=head_pt(0.061*sx,1.12);nf=(n*0.45+V(0,1,0)*0.55).normalized()
 EYES[sx]=(Matrix.Translation(p-n*0.016)@nf.to_track_quat('Y','Z').to_matrix().to_4x4(),big,nf)
# Banana-peel flap paths (blockout): (azimuth deg, end polar angle, curl)
TOP=sph(0.0,0.0,1.0)
FLAPS=[('flap_R',98,1.78,0.03),('flap_B',172,1.62,0.028),('flap_L',252,1.9,0.034),(None,134,1.2,0.02)]
FLAP_PATHS=[]
for bone,phi,th_end,curl in FLAPS:
 ph=math.radians(phi);h=V(math.sin(ph),math.cos(ph),0)
 pts=[TOP+V(0,0,0.014)+h*0.004]+[sph(t*th_end,ph,1.07) for t in (0.22,0.45,0.68,0.86,1.0)]
 Pe=pts[-1];pts+=[Pe+h*curl*0.6+V(0,0,-0.018),Pe+h*curl*1.3+V(0,0,-0.022)]
 FLAP_PATHS.append((bone,C.catmull_ext(pts,2) if bone else C.catmull_ext(pts,2)))
def at_arc(path,u):
 acc=C.arclength(path);x=u*acc[-1]
 for i in range(len(path)-1):
  if acc[i+1]>=x:f=(x-acc[i])/max(1e-9,acc[i+1]-acc[i]);return path[i].lerp(path[i+1],f)
 return path[-1]
BROW_L=[V(-0.044,0.022,0.072),V(-0.005,0.03,0.095),V(0.04,0.025,0.086)]
EM_R=EYES[1][0];EM_L=EYES[-1][0]
REST={'root':((0,0,0),(0,0,.1),None),
 'hips':((0,-0.02,0.47),(0,0.05,0.60),'root'),
 'chest':((0,0.05,0.60),tuple(P[0]),'hips'),
 'neck_1':(tuple(P[0]),tuple(P[1]),'chest'),'neck_2':(tuple(P[1]),tuple(P[2]),'neck_1'),
 'neck_3':(tuple(P[2]),tuple(P[3]),'neck_2'),'neck_4':(tuple(P[3]),tuple(P[4]),'neck_3'),
 'head':(tuple(P[4]),(0,0.165,1.16),'neck_4'),
 'beak':((0,0.27,1.055),(0,0.45,1.02),'head'),
 'beak_chip':(tuple(CHIP_C),tuple(CHIP_C+CHIP_AX*0.06),'beak'),
 'peel':(tuple(TOP),tuple(TOP+V(0,0,0.075)),'head'),
 'lid_L':(tuple(EM_L@V(0,0,0)),tuple(EM_L@V(0,0.05,0)),'head'),
 'brow_R':(tuple(EM_R@BROW_L[1]),tuple(EM_R@(BROW_L[1]+V(0,0,0.04))),'head'),
 'loot':(tuple(CONE_A),tuple(CONE_B),'hips'),
 'loot_chips':(tuple(CONE_B-CONE_AX*0.03),tuple(CONE_B+CONE_AX*0.07),'loot'),
 'tail':((0,-0.29,0.575),(0,-0.385,0.40),'hips')}
for bone,path in FLAP_PATHS:
 if bone:REST[bone]=(tuple(at_arc(path,0.25)),tuple(path[-1]),'peel')
for label,s in (('R',1),('L',-1)):
 REST['wing_'+label]=((s*0.17,0.11,0.66),(s*0.152,-0.06,0.62),'chest')
 REST['wing_tip_'+label]=((s*0.152,-0.06,0.62),(s*0.10,-0.27,0.60),'wing_'+label)
 REST['leg_'+label]=(tuple(HIP(s)),tuple(KNEE(s)),'hips')
 REST['shank_'+label]=(tuple(KNEE(s)),tuple(BALL(s)),'leg_'+label)
 REST['foot_'+label]=(tuple(BALL(s)),tuple(BALL(s)+V(0,0.14,-0.016)),'shank_'+label)

# ================= Body, grime, wings, wing tips, plumes =================
def body_w(p):
 t=(BODY_MI@p).z/0.515;f=smooth((t-0.30)/0.34);return {'hips':1-f,'chest':f}
C.lathe('Grubby white egg body',BODY,WHITE,'hips',a=TAIL_END,b=CHEST,ey=BODY_EY,n=32,weights=body_w)
for k,(org,dirn,s,spin) in enumerate((((-0.40,0.9,0.62),(0.45,-1,-0.05),(0.034,0.024,0.006),0.4),
  ((0.30,0.7,0.30),(-0.23,-0.58,0.17),(0.026,0.018,0.006),-0.6),((0.12,-1.0,0.95),(-0.07,0.88,-0.21),(0.03,0.022,0.006),1.1),
  ((0.45,-0.25,0.70),(-1,0.15,-0.05),(0.024,0.017,0.006),0.2))):
 p,n=hit_body(org,dirn)
 q=(n.to_track_quat('Z','Y').to_matrix().to_4x4()@Matrix.Rotation(spin,4,'Z'))
 F=Matrix.Translation(p+n*0.0015)@q
 C.ellipsoid('Bin-grime smudge %d'%k,(0,0,0),s,GRIME,'hips',n=10,r=4,transform=F,weights=body_w)
 C.ellipsoid('Bin-grime smudge %d lobe'%k,(s[0]*0.8,s[1]*0.5,0),(s[0]*0.55,s[1]*0.6,s[2]),GRIME,'hips',n=10,r=4,transform=F,weights=body_w)
 C.ellipsoid('Bin-grime crumb %d'%k,(-s[0]*1.5,-s[1]*0.9,0),(0.007,0.007,0.004),GRIME,'hips',n=6,r=3,transform=F,weights=body_w)

WING=[(-0.002,0.0),(0.02,0.012),(0.0558,0.0207),(0.10,0.029),(0.15,0.036),(0.21,0.041),(0.26,0.043),(0.30,0.042),(0.33,0.038),(0.355,0.025),(0.374,0.0)]
for label,s in (('R',1),('L',-1)):
 a=V(0.142*s,-0.215,0.585);b=V(0.176*s,0.13,0.665);ax=(b-a);Lw=ax.length;ax.normalize()
 def wing_w(p,a=a,ax=ax,Lw=Lw,label=label):
  f=(p-a).dot(ax)/Lw;t=smooth((f-0.30)/0.30);return {'wing_tip_'+label:1-t,'wing_'+label:t}
 C.lathe(label+' folded white wing',WING,WHITE,'wing_'+label,a=a,b=b,ey=2.55,n=20,weights=wing_w,
         band=lambda tm,am:INK if (-0.002+tm*0.376)<0.0558 else None)
 for k,z0 in enumerate((0.625,0.665)):
  yend=-0.352 if s>0 else -0.336
  pts=C.catmull_ext([(0.135*s,-0.19,z0),(0.105*s,-0.285,z0-0.025),(-0.05*s,yend,z0-0.075-0.01*k)],4)
  C.sweep(label+' black wing-tip feather %d'%k,pts,[0.026,0.032,0.03,0.016],INK,'wing_tip_'+label,n=8,up=(1,0,0),flat=0.42)
for k,(xo,reach,curl) in enumerate(((-0.04,0.9,-0.03),(0.0,1.0,0.02),(0.042,0.84,0.03))):
 pts=[(xo*0.4,-0.29,0.575),(xo,-0.345,0.53),(xo*1.25,-0.375,0.465+0.05*(1-reach)),(xo*1.35,-0.385,0.40+0.07*(1-reach)),(xo*1.35+curl,-0.365,0.36+0.08*(1-reach))]
 def plume_w(p):
  t=smooth((0.56-p.z)/0.05);return {'hips':1-t,'tail':t}
 C.sweep('Lacy black plume drape %d'%k,C.catmull_ext(pts,3),[0.018,0.03,0.036,0.03,0.037,0.029,0.033,0.02,0.009],INK,'tail',n=8,up=(0,-1,0),flat=0.3,weights=plume_w)

# ================= The loot: striped paper cone of stolen chips behind its back =================
CONE=[(0.0,0.0),(0.004,0.006),(0.02,0.012),(0.07,0.0297),(0.126,0.0495),(0.15,0.058),(0.17,0.064),(0.168,0.052),(0.14,0.0)]
C.lathe('Striped paper chip cone',CONE,PAPER,'loot',a=CONE_A,b=CONE_B,n=18,
        band=lambda tm,am:PAPER if tm*0.14>=0.126-1e-6 else (STRIPE if int(am*18)%2==0 else PAPER))
for k,(dx,dy,tx,ty,L) in enumerate(((-0.03,0.0,-0.35,0.05,0.10),(-0.01,0.022,-0.1,0.25,0.115),(0.012,-0.015,0.15,-0.2,0.11),
  (0.03,0.01,0.4,0.1,0.095),(0.0,-0.03,0.05,-0.4,0.09),(0.018,0.028,0.25,0.35,0.1))):
 base=CONE_B+V(dx,dy,-0.03);d=(CONE_AX+V(tx,ty,0)*0.9).normalized()
 C.box('Stolen loot chip %d'%k,tuple(base+d*L/2),(0.017,0.017,L),CHIP,'loot_chips',bevel=.004,segments=1,rot=d.to_track_quat('Z','Y'))

# ================= Ruff, neck =================
C.ellipsoid('White lower neck',(0.0,0.18,0.705),(0.09,0.085,0.07),WHITE,'chest',n=16,r=8)
rc=V(0.0,0.185,0.742)
def ruff_w(p):
 t=smooth((p.z-0.74)/0.06)*0.35;return {'chest':1-t,'neck_1':t}
for k in range(14):
 ang=math.tau*k/14+0.2;o=V(math.cos(ang),math.sin(ang),0)
 L=0.05+0.02*((k*7)%3)/2
 a=rc+V(o.x*0.058,o.y*0.052,-0.012-0.008*(k%2));d=(o*0.95+V(0,0,0.42+0.14*(k%2))).normalized()
 C.ellipsoid('Scruffy ruff feather %d'%k,tuple(a+d*L*0.45),(0.03,0.011,L*0.55),WHITE,'chest',n=6,r=4,rot=d.to_track_quat('Z','X'),weights=ruff_w)
for k,(dx,dz) in enumerate(((-0.02,0.0),(0.016,0.012))):
 a=V(dx,0.228,0.75+dz);d=V(dx*1.5,0.03,0.07).normalized()
 C.ellipsoid('Ruff cowlick %d'%k,tuple(a+d*0.03),(0.018,0.01,0.04),WHITE,'chest',n=6,r=4,rot=d.to_track_quat('Z','X'),weights=ruff_w)
NECK_PATH=C.catmull_ext(NECK_PTS,3);NACC=C.arclength(NECK_PATH)
JOINTS=[]
for q in P[:5]:JOINTS.append(NACC[min(range(len(NECK_PATH)),key=lambda i:(NECK_PATH[i]-q).length)])
CHAIN=['chest','neck_1','neck_2','neck_3','neck_4','head']
def neck_w(p):
 i=min(range(len(NECK_PATH)),key=lambda k:(NECK_PATH[k]-p).length);s=NACC[i];h=0.028;w={};carry=1.0
 for j,js in enumerate(JOINTS):
  f=smooth((s-js+h)/(2*h)) if j>0 else smooth((s-js+0.005)/0.04)
  w[CHAIN[j]]=w.get(CHAIN[j],0)+carry*(1-f);carry*=f
 w['head']=w.get('head',0)+carry;return w
C.sweep('Bare black S neck',NECK_PATH,[0.052,0.046,0.041,0.04,0.045,0.05],INK,'neck_2',n=10,weights=neck_w)

# ================= Head, beak, chip, nostrils, grin, eyes =================
C.ellipsoid('Bald plum-black head',tuple(HC),tuple(HR),INK,'head',n=28,r=14)
C.sweep('Long down-curved beak',BEAK_PATH,[0.04,0.034,0.025,0.017,0.0115,0.0092],BEAK,'beak',mat=1,n=10,up=(0,0,1),flat=0.9)
C.ellipsoid('Beak tip',tuple(BEAK_PATH[-1]),(0.0094,0.0094,0.0094),BEAK,'beak',mat=1,n=8,r=4)
for sx in (1,-1):
 C.sweep('Nostril slit %+d'%sx,[V(0.029*sx,0.335,1.07),V(0.027*sx,0.3525,1.066),V(0.025*sx,0.37,1.06)],0.0036,INK,'beak',n=4)
C.box('Stolen hot chip in beak',tuple(CHIP_C),(0.13,0.018,0.018),CHIP,'beak_chip',bevel=.004,segments=1,rot=CHIP_R)
for name,pts in (('Pink gape grin right',[(0.032,1.04),(0.056,1.03),(0.078,1.036),(0.094,1.054),(0.1,1.07)]),
                 ('Pink gape grin left',[(-0.032,1.04),(-0.056,1.032),(-0.078,1.035)])):
 path=C.catmull_ext([head_pt(x,z,0.0025)[0] for x,z in pts],2)
 C.sweep(name,path,[0.0052,0.0062,0.0062,0.0058,0.0045][:len(pts)],PINK,'head',n=5)
for sx,(M,big,nf) in EYES.items():
 C.ellipsoid('Googly eye white %+d'%sx,(0,0,0),(0.058*big,0.04*big,0.068*big),EYE,'head',mat=1,n=18,r=10,transform=M)
 C.ellipsoid('Amber iris %+d'%sx,(0.02,0.026*big,-0.007),(0.033,0.018,0.04),IRIS,'head',mat=1,n=14,r=6,transform=M)
 C.ellipsoid('Big plum pupil %+d'%sx,(0.025,0.035*big,-0.008),(0.022,0.014,0.028),INK,'head',mat=1,n=12,r=6,transform=M)
 C.ellipsoid('Eye highlight big %+d'%sx,(0.012,0.045*big,0.015),(0.011,0.008,0.012),EYE,'head',mat=1,n=8,r=4,transform=M)
 C.ellipsoid('Eye highlight small %+d'%sx,(0.036,0.042*big,-0.024),(0.006,0.005,0.006),EYE,'head',mat=1,n=6,r=3,transform=M)
 if sx<0:
  C.ellipsoid('Cheeky half-lid left',(0,0.002,0.04),(0.062,0.0435,0.034),INK,'lid_L',n=16,r=8,transform=M@Matrix.Rotation(-0.32,4,'Y'))
 else:
  C.sweep('Raised brow right',[M@q for q in C.catmull_ext(BROW_L,3)],[0.008,0.011,0.006],INK,'brow_R',n=6)

# ================= Floppy banana-peel hat =================
C.ellipsoid('Banana peel cap',tuple(TOP+V(0,0,0.006)),(0.04,0.04,0.028),PEEL,'peel',n=12,r=6)
sd=Euler((0.2,0.1,0.0)).to_matrix()@V(0,0,1);sc_=TOP+V(0.003,-0.004,0.042)
C.lathe('Banana peel stem',[(0.0,0.0),(0.001,0.014),(0.03,0.0115),(0.045,0.01),(0.046,0.0)],PEEL,'peel',a=sc_-sd*0.0225,b=sc_+sd*0.0225,n=8)
C.ellipsoid('Banana peel stem tip',tuple(TOP+V(0.007,-0.01,0.066)),(0.012,0.012,0.008),BROWN,'peel',n=8,r=4)
WIDTHS=[(0.0,0.032),(0.25,0.088),(0.6,0.078),(0.88,0.046),(1.0,0.02)]
for k,(bone,path) in enumerate(FLAP_PATHS):
 acc=C.arclength(path)
 def flap_w(p,path=path,acc=acc,bone=bone):
  if not bone:return {'peel':1.0}
  i=min(range(len(path)),key=lambda j:(path[j]-p).length);u=acc[i]/acc[-1];t=smooth((u-0.18)/0.30)
  return {'peel':1-t,bone:t}
 ob,sample,pp,pacc=C.petal('Banana peel flap %d'%k,path,WIDTHS,HC,0.006,0.2,PEEL,PEELIN,BROWN,bone or 'peel',tip_from=0.9,weights=flap_w)
 for j,(u,s) in enumerate(((0.40,-0.35),(0.62,0.4))):
  q,out=sample(u,s)
  F=Matrix.Translation(q+out*0.0008)@out.to_track_quat('Z','Y').to_matrix().to_4x4()@Matrix.Rotation(0.5*j,4,'Z')
  C.ellipsoid('Banana speckle %d %d'%(k,j),(0,0,0),(0.0075,0.0058,0.0024),BROWN,bone or 'peel',n=6,r=3,transform=F,weights=flap_w)

# ================= Legs: feathered thighs, knobbly mauve stilts, big three-toed feet =================
L1=(KNEE(1)-HIP(1)).length;L2=(BALL(1)-KNEE(1)).length
for label,s in (('R',1),('L',-1)):
 C.ellipsoid(label+' feathered white thigh',(0.08*s,0.0,0.43),(0.062,0.076,0.085),WHITE,'hips',n=14,r=8,rot=(0.2,0,0))
 path=[HIP(s).lerp(KNEE(s),t) for t in (0,.34,.67,1)]+[KNEE(s).lerp(BALL(s),t) for t in (.34,.67,1)]
 acc=C.arclength(path)
 def leg_w(p,path=path,acc=acc,label=label):
  i=min(range(len(path)),key=lambda j:(path[j]-p).length)
  a=path[i];segs=[]
  # project onto the polyline for a continuous arc position
  best=(9,0)
  for j in range(len(path)-1):
   d=path[j+1]-path[j];t=max(0,min(1,(p-path[j]).dot(d)/d.length_squared));dist=(path[j]+d*t-p).length
   if dist<best[0]:best=(dist,acc[j]+t*d.length)
  x=best[1];f1=smooth((x-L1+0.03)/0.06);f2=smooth((x-(L1+L2)+0.035)/0.03)
  return {'leg_'+label:1-f1,'shank_'+label:f1*(1-f2),'foot_'+label:f1*f2}
 C.sweep(label+' bare mauve stilt leg',path,[0.025,0.024,0.023,0.0225,0.022],LEG,'shank_'+label,n=8,up=(0,1,0),weights=leg_w)
 C.ellipsoid(label+' knobbly knee',tuple(KNEE(s)),(0.034,0.036,0.036),LEG,'shank_'+label,n=10,r=6)
 C.ellipsoid(label+' foot ball',tuple(BALL(s)),(0.034,0.038,0.028),LEG,'foot_'+label,n=10,r=6)
 b=BALL(s)
 for k,(d,Lt) in enumerate(((-26,0.13),(3,0.155),(32,0.125))):
  a=math.radians(d);dv=V(s*math.sin(a),math.cos(a),0)
  tip=b+dv*Lt;tip.z=TOE_Z;mid=b+dv*Lt*0.5;mid.z=(b.z+TOE_Z)/2+0.004
  C.sweep(label+' big toe %d'%k,C.catmull_ext([b,mid,tip],2),[0.02,0.016,0.0125],LEG,'foot_'+label,n=6)
  C.ellipsoid(label+' toe tip pad %d'%k,tuple(tip),(0.014,0.016,0.012),LEG,'foot_'+label,n=8,r=4,rot=(0,0,-a*s))
 bd=V(0.1*s,-1,0).normalized();tip=b+bd*0.065;tip.z=TOE_Z
 C.sweep(label+' back toe',[b,b.lerp(tip,0.5)+V(0,0,0.003),tip],[0.017,0.013,0.01],LEG,'foot_'+label,n=6)

# ================= Join one skin, build the rig, checkpoint =================
sources=bpy.data.collections.new('EDITABLE original bin chicken parts - excluded from export');sc.collection.children.link(sources)
inventory=[];copies=[]
for ob in C.PARTS:
 ob.data.calc_loop_triangles();inventory.append({'name':ob.name,'triangles':len(ob.data.loop_triangles),'bone_groups':[g.name for g in ob.vertex_groups],'atlas_tile':ob.get('atlas_tile')})
 cp=ob.copy();cp.data=ob.data.copy();sc.collection.objects.link(cp);copies.append(cp)
 for col in list(ob.users_collection):col.objects.unlink(ob)
 sources.objects.link(ob)
sources.hide_render=True;sources.hide_viewport=True
bpy.ops.object.select_all(action='DESELECT')
for ob in copies:ob.select_set(True)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();skin=bpy.context.object;skin.name='Bin_Chicken_Skin'
for tag in ['source_part','rigid_weight','atlas_tile']:
 if tag in skin:del skin[tag]
skin.data.calc_loop_triangles();tris=len(skin.data.loop_triangles)
data=bpy.data.armatures.new('Original bin chicken rig');arm=bpy.data.objects.new('Bin_Chicken_Rig',data);sc.collection.objects.link(arm)
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
arm['asset_id']='bin-chicken';arm['version']='v001';arm['forward']='Blender +Y / glTF -Z';arm['neutral_total_height_m']=round(hi[2],4);arm['attack_contact_fraction']=.625
record={'asset_id':'bin-chicken','version':'v001','work_order':'WO111','authoring_model':'claude-opus-5-5 xhigh (Claude Code subagent; Tom ruled Sept 26 that Claude Opus 5.5 does the WO111 Blender work)','blender_version':bpy.app.version_string,
 'blender_instance':'blender-authoring-2',
 'source_reference':'Blender reference sheet, no generated concept','source_sheet_sha256':sc['source_sheet_sha256'],'source_blockout_sha256':sc['source_blockout_sha256'],
 'bind_pose':'Head straight and both feet flat; the sheet design pose (head turned 17 deg right and tilted 7 deg, left tiptoe) is the idle clip at 0 s.',
 'rest_bounds_blender_z_up':{'min':lo,'max':hi},'height_m':hi[2],'triangles':tris,'vertices':len(skin.data.vertices),'material_count':len(skin.data.materials),'bone_count':len(data.bones),
 'texture':{'file':'pigment.png','width':1024,'height':1024,'origin':'Original deterministic soft painted palette atlas generated in Blender Python from the sheet colours; no external textures.','palette':COLORS},
 'parts':inventory}
(ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n')
rest_json={k:[list(map(float,h)),list(map(float,t)),p] for k,(h,t,p) in REST.items()}
(ROOT/'source/rig-rest.json').write_text(json.dumps({'rest':rest_json},indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'bin-chicken-construction.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(ROOT/'bin-chicken-checkpoint.glb'),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_yup=True,export_apply=False,export_armature_object_remove=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=True)
big=sorted(inventory,key=lambda r:-r['triangles'])
print(json.dumps({'triangles':tris,'vertices':len(skin.data.vertices),'height_m':hi[2],'bounds':[lo,hi],'bones':len(data.bones),'largest':[(r['name'],r['triangles']) for r in big[:25]]}))
