"""WO111 mischief-kitten v001: final budgeted model from the approved Blender reference sheet.

Source authority: reference-sheet.png and mischief-kitten-blockout.blend (coordinator approved
Sept 26, "Blender reference sheet, no generated concept"; SHEET-REVIEWS.md: keep the mini
stovepipe hat, gadget pack, bell collar and question-mark tail; pounce attack). The blockout's
measured coordinates are kept for silhouette, colour and parody hooks: oversized round head,
big honey eyes glancing to its right, raised right brow, sly squint on the left eye, cream
muzzle with a lopsided smirk and tongue blep, whiskers, a straight right ear and a cocked left
ear, a mini plum stovepipe hat tipped to its left, lilac-grey tabby bean body with plum-lilac
stripes, cream bib, belly, socks and paws, bunched haunches, the question-mark tail swung up on
its right, a raspberry collar with a honey bell and a teal gadget pack with a raspberry button,
a brass spring antenna and a tiny cream propeller. Topology, weights, rig and atlas are new.

Blender +Z up / +Y forward (glTF +Y up / -Z forward), floor-centred root, right = +X.
Bind pose: four paws down and the question-mark tail in its sheet curl, as the sheet notes
suggest; the sheet's tiptoe (raised right forepaw) is recreated at idle t = 0.
"""
import bpy, math, json, hashlib, importlib.util, struct, zlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler
import numpy as np

ROOT=Path('/workspace/haynes-quest/family-eras/mischief-kitten/v001')
sc=bpy.context.scene
assert sc.get('work_order')=='WO111' and sc.get('scene_lease')=='active' and sc.get('asset_id')=='mischief-kitten'
assert sc.get('scene_owner')=='claude-opus-5-5/mischief-kitten-model'
spec=importlib.util.spec_from_file_location('wo111_mischief_kitten_common',ROOT/'source/common.py')
C=importlib.util.module_from_spec(spec);spec.loader.exec_module(C)

# ---- Atlas: 16 sheet colours, each a 256 px tile with a quiet painted field.
COLORS=['9a8cae','6b5a84','f3e6cf','dca953','e39a88','d9677a','b54a5a','3f7f7a','2f2740','342c46','c9923e','fbf6ec','cdb89a','2f625e','8f3848','c77f70']
FUR,STRIPE,CREAM,HONEY,PINK,TONGUE,COLLAR,TEAL,HAT,INK,BRASS,WHITE,CREASE,TEAL_D,COLLAR_D,PINK_D=range(16)
def atlas():
 rng=np.random.default_rng(11108);yy,xx=np.mgrid[0:256,0:256]
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
C.setup(ROOT,[('Matte painted fur, felt and cloth',.84),('Satin eyes, nose, bell, brass and pack hardware',.42)],'mischief-kitten original painted 1024 atlas')
for key in list(sc.keys()):
 if key not in keep and key!='cycles':del sc[key]
sc['candidate_status']="WO111 mischief-kitten v001 · Awaiting Tom's review · used in the family release"
sc['source_reference']='Blender reference sheet, no generated concept'
sc['source_sheet_sha256']=hashlib.sha256((ROOT/'reference-sheet.png').read_bytes()).hexdigest()
sc['source_blockout_sha256']=hashlib.sha256((ROOT/'mischief-kitten-blockout.blend').read_bytes()).hexdigest()
sc['orientation']='Blender +Z up/+Y forward; glTF +Y up/-Z forward; stationary identity floor root; character right = +X'

def V(*a):return Vector(a)
def track(d):return Vector(d).to_track_quat('Z','Y').to_matrix().to_4x4()
def densify(profile,step):
 """Resample a (t, r) profile at about `step` spacing with two light smoothing passes (as the blockout)."""
 t0,t1=profile[0][0],profile[-1][0];n=max(6,int(round((t1-t0)/step)))
 ts=[t0+(t1-t0)*i/n for i in range(n+1)];rs=[C.interp(profile,t) for t in ts]
 for _ in range(2):rs=[rs[0]]+[(rs[i-1]+2*rs[i]+rs[i+1])/4 for i in range(1,len(rs)-1)]+[rs[-1]]
 return list(zip(ts,rs))
def blockout_catmull(pts,per):
 """The blockout's Catmull-Rom with reflected ghost end points (reproduces its tail path)."""
 P=[Vector(p) for p in pts];P=[P[0]+(P[0]-P[1])]+P+[P[-1]+(P[-1]-P[-2])];out=[]
 for i in range(1,len(P)-2):
  p0,p1,p2,p3=P[i-1],P[i],P[i+1],P[i+2]
  for s in range(per):
   t=s/per;out.append(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t**3))
 out.append(P[-2]);return out
def loop(name,pts,radius,tile,bn='body',mat=0,n=8,weights=None,hint=(0,0,1),face_tile=None):
 """Closed round-section ring along a closed planar path (collar, straps, bell band)."""
 P=[Vector(p) for p in pts];m=len(P);rr=[]
 h=Vector(hint).normalized()
 for i,p in enumerate(P):
  t=(P[(i+1)%m]-P[i-1]).normalized();u=t.cross(h).normalized();v=u.cross(t).normalized()
  rr.append([p+radius*(math.cos(math.tau*j/n)*u+math.sin(math.tau*j/n)*v) for j in range(n)])
 verts=[q for r in rr for q in r];faces=[]
 for i in range(m):
  a=i;b=(i+1)%m
  for j in range(n):faces.append((a*n+j,a*n+(j+1)%n,b*n+(j+1)%n,b*n+j))
 return C.mesh(name,[tuple(v) for v in verts],faces,tile,bn,mat,True,weights,face_tile)
def cone(name,base,axis,r,length,tile,bn,n=6,mat=0,weights=None):
 """Small closed cone (fur tufts)."""
 ax=Vector(axis).normalized();M=Matrix.Translation(base)@track(ax)
 return C.lathe(name,(0,0,0),[(0,r),(length,0.0)],tile,bn,mat,n=n,transform=M,weights=weights)

# ================= Body: tilted bean from rump to chest, painted tabby, cream belly =================
RUMP=V(0.0,-0.30,0.265);CHEST=V(0.0,0.16,0.345)
BODY=[(0.0,0.03),(0.02,0.09),(0.06,0.135),(0.12,0.158),(0.22,0.163),(0.32,0.158),(0.40,0.143),(0.45,0.108),(0.47,0.06),(0.478,0.02)]
BODY_EY=1.04;BL=BODY[-1][0]
BODY_M=Matrix.Translation(RUMP)@track(CHEST-RUMP);BODY_MI=BODY_M.inverted();BODY_R=BODY_M.to_3x3()
AXIS=(CHEST-RUMP).normalized()
def body_w(p):
 w=(BODY_MI@p).z/BL;t=C.smooth((w-.36)/.26);return {'hips':1-t,'chest':t}
# Four slanted, tapering back stripes (blockout t centres 0.20/0.36/0.52/0.67). In body-local
# coordinates (u lateral, v up, w along the axis) each edge is the plane w = A + B v, so the band
# narrows to a point at v = -0.3 R on both flanks and leans back toward the belly.
RB=0.163*BODY_EY
STRIPE_EDGES=[]
for c in (0.20,0.36,0.52,0.67):
 wk=c*BL;slant=.05*BL;htop=.036*BL
 # centre w_c(v)=wk-slant*(1-v/R); half-width h(v)=htop*(v/R+0.3)/1.3
 for sgn in (-1,1):
  A=wk-slant+sgn*htop*.3/1.3;B=slant/RB+sgn*htop/(1.3*RB)
  STRIPE_EDGES.append((A,B))
def stripe_planes():
 out=[]
 for A,B in STRIPE_EDGES:
  n_local=V(0,-B,1).normalized();p_local=V(0,0,A)
  out.append((tuple(BODY_M@p_local),tuple((BODY_R@n_local).normalized())))
 return out
BELLY_V=-0.70
def body_tiles(c,n):
 q=BODY_MI@c;r=max(C.interp(BODY,q.z),1e-4);vn=q.y/(r*BODY_EY)
 if q.y<BELLY_V*RB-1e-5:return CREAM
 if vn<-0.3:return None
 for k in range(4):
  A0,B0=STRIPE_EDGES[2*k];A1,B1=STRIPE_EDGES[2*k+1]
  if A0+B0*q.y<q.z<A1+B1*q.y:return STRIPE
 return None
belly_plane=(tuple(BODY_M@V(0,BELLY_V*RB,0)),tuple((BODY_R@V(0,1,0)).normalized()))
C.lathe('Lilac tabby bean body',(0,0,0),densify(BODY,.034),FUR,'hips',n=26,ey=BODY_EY,transform=BODY_M,weights=body_w,face_tile=body_tiles,planes=stripe_planes()+[belly_plane])
C.ellipsoid('Cream chest bib',(0.0,0.245,0.35),(0.118,0.075,0.125),CREAM,'chest',n=16,r=9)

# ================= Rig rest layout (bind pose: four paws down, sheet tail curl) =================
FS=V(0.10,0.14,0.33);FE=V(0.104,0.128,0.198);FW=V(0.106,0.16,0.078)
HH=V(0.118,-0.19,0.25);HK=V(0.12,-0.128,0.152);HA=V(0.122,-0.15,0.075)
HEAD_PIV=V(0,0.19,0.43)
HAT_M=Matrix.Translation((-0.03,0.185,0.782))@Euler((-0.06,-0.26,0.0)).to_matrix().to_4x4()
# Pack sits 4 cm further back than the blockout so its top-front edge clears the back of the head.
PACK_M=Matrix.Translation((0.0,-0.09,0.505))@Euler((-0.17,0.0,0.0)).to_matrix().to_4x4()
COLLAR_M=Matrix.Translation((0.0,0.19,0.40))@Euler((-0.25,0.0,0.0)).to_matrix().to_4x4()
BELL_M=Matrix.Translation((0.0,0.352,0.325))@Euler((0.2,0.0,0.0)).to_matrix().to_4x4()
EAR_BASE={'R':V(0.145,0.18,0.70),'L':V(-0.145,0.18,0.70)};EAR_TIP={'R':V(0.228,0.145,0.915),'L':V(-0.268,0.14,0.885)}
TAIL_PTS=[(0.0,-0.30,0.30),(0.07,-0.40,0.34),(0.20,-0.46,0.42),(0.33,-0.45,0.55),(0.385,-0.40,0.69),(0.36,-0.34,0.80),(0.29,-0.30,0.835),(0.245,-0.285,0.785)]
TAIL_PATH=blockout_catmull(TAIL_PTS,12);TAIL_S=C.arclength(TAIL_PATH);TAIL_LEN=TAIL_S[-1]
def tail_at(s):
 s=max(0,min(TAIL_LEN,s))
 for i in range(len(TAIL_S)-1):
  if TAIL_S[i]<=s<=TAIL_S[i+1]:
   f=(s-TAIL_S[i])/max(1e-9,TAIL_S[i+1]-TAIL_S[i]);return TAIL_PATH[i].lerp(TAIL_PATH[i+1],f)
 return TAIL_PATH[-1].copy()
NTAIL=6;TAIL_KNOTS=[TAIL_LEN*k/NTAIL for k in range(NTAIL+1)]
REST={'root':((0,0,0),(0,0,.1),None),
 'hips':((0,-.19,.275),(0,-.02,.30),'root'),
 'chest':((0,-.02,.30),(0,.17,.36),'hips'),
 'neck':((0,.17,.36),tuple(HEAD_PIV),'chest'),
 'head':(tuple(HEAD_PIV),(0,.19,.80),'neck'),
 'hat':(tuple(HAT_M@V(0,0,0)),tuple(HAT_M@V(0,0,.13)),'head'),
 'tongue':((-.018,.368,.476),(-.02,.392,.442),'head'),
 'bell':((0,.337,.362),(0,.352,.30),'neck'),
 'pack':(tuple(PACK_M@V(0,0,-.05)),tuple(PACK_M@V(0,0,.05)),'chest'),
 'antenna_1':(tuple(PACK_M@V(-.03,-.055,.05)),tuple(PACK_M@V(-.03,-.075,.115)),'pack'),
 'antenna_2':(tuple(PACK_M@V(-.03,-.075,.115)),tuple(PACK_M@V(-.03,-.095,.20)),'antenna_1'),
 'propeller':(tuple(PACK_M@V(-.03,-.095,.215)),tuple(PACK_M@V(-.03,-.095,.26)),'antenna_2')}
for s,sx in (('R',1),('L',-1)):
 m=lambda p:V(p.x*sx,p.y,p.z)
 REST['ear_'+s]=(tuple(EAR_BASE[s]),tuple(EAR_BASE[s].lerp(EAR_TIP[s],.8)),'head')
 REST['front_upper_'+s]=(tuple(m(FS)),tuple(m(FE)),'chest');REST['front_lower_'+s]=(tuple(m(FE)),tuple(m(FW)),'front_upper_'+s)
 REST['front_paw_'+s]=(tuple(m(FW)),tuple(m(FW)+V(0,.075,-.035)),'front_lower_'+s)
 REST['hind_thigh_'+s]=(tuple(m(HH)),tuple(m(HK)),'hips');REST['hind_shin_'+s]=(tuple(m(HK)),tuple(m(HA)),'hind_thigh_'+s)
 REST['hind_paw_'+s]=(tuple(m(HA)),tuple(m(HA)+V(0,.075,-.035)),'hind_shin_'+s)
for k in range(NTAIL):
 REST['tail_%d'%(k+1)]=(tuple(tail_at(TAIL_KNOTS[k])),tuple(tail_at(TAIL_KNOTS[k+1])),'hips' if k==0 else 'tail_%d'%k)

# ================= Legs, socks, paws =================
def limb(label,ctrl,radii_fn,parent,upper,lower,tile_fn,s_joint_top,s_elbow):
 path=C.catmull(ctrl,3);acc=C.arclength(path);total=acc[-1]
 def w(p):
  i=min(range(len(path)),key=lambda k:(path[k]-p).length);s_=acc[i]
  if s_<s_joint_top:t=C.smooth(s_/s_joint_top);return {parent:1-t,upper:t}
  t=C.smooth((s_-(s_elbow-.035))/.07);return {upper:1-t,lower:t}
 def ft(c,n):
  i=min(range(len(path)),key=lambda k:(path[k]-c).length);return tile_fn(acc[i]/total,acc[i],total)
 return C.tube(label,path,[radii_fn(a/total) for a in acc],FUR,upper,n=10,weights=w,face_tile=ft)
for s,sx in (('R',1),('L',-1)):
 m=lambda p:V(p.x*sx,p.y,p.z)
 S0=m(V(0.098,0.13,0.37));S,E,W=m(FS),m(FE),m(FW)
 ctrl=[S0,S,S.lerp(E,.5),E,E.lerp(W,.5),W]
 elbow=(S0-S).length+(E-S).length
 limb(s+' front leg with cream sock',ctrl,lambda f:.051-.007*f,'chest','front_upper_'+s,'front_lower_'+s,
      lambda f,a,tot:CREAM if a>tot-.075 else None,(S0-S).length+.02,elbow)
 pc=V(0.106*sx,0.185,0.051);ps=(0.064,0.08,0.048)   # 3 mm sole clearance
 C.ellipsoid(s+' cream front mitten paw',tuple(pc),ps,CREAM,'front_paw_'+s,n=16,r=8)
 # toe grooves and pink toe beans (pads on the sole show when a paw lifts or pounces)
 for k,dx in enumerate((-0.021,0.021)):
  q=math.sqrt(max(0.0,1-(dx/ps[0])**2));pts=[(pc.x+dx,pc.y+math.cos(e)*q*ps[1]*.99,pc.z+math.sin(e)*q*ps[2]*.99) for e in (.2,.45,.75)]
  C.tube(s+' front toe groove %d'%k,C.bspline(pts,3),[.0038,.0048,.0032,.003],CREASE,'front_paw_'+s,n=4)
 def sole(dx,dy):
  f=1-(dx/ps[0])**2-(dy/ps[1])**2;return pc.z-ps[2]*math.sqrt(max(0.0,f))
 for k,(dx,dy,rx,ry) in enumerate(((-.029,.024,.012,.012),(-.0105,.038,.012,.012),(.0105,.038,.012,.012),(.029,.024,.012,.012),(0,-.008,.028,.022))):
  z=sole(dx,dy);C.ellipsoid(s+' pink toe bean %d'%k,(pc.x+dx,pc.y+dy,max(z+.0035,.0039+.0065)),(rx,ry,.0065),PINK,'front_paw_'+s,n=10 if k<4 else 12,r=4 if k<4 else 5)
 H0=m(V(0.118,-0.215,0.30));H,K,A=m(HH),m(HK),m(HA)
 ctrl=[H0,H,H.lerp(K,.5),K,K.lerp(A,.5),A]
 knee=(H0-H).length+(K-H).length
 limb(s+' hind leg',ctrl,lambda f:.055-.009*f,'hips','hind_thigh_'+s,'hind_shin_'+s,lambda f,a,tot:None,(H0-H).length+.02,knee)
 def haunch_w(p,s=s,H=H):
  t=C.smooth((H.z+.05-p.z)/.09);return {'hips':1-t,'hind_thigh_'+s:t}
 hm=Matrix.Translation((0.118*sx,-0.185,0.245))@Matrix.Rotation(0.25,4,'X')
 C.ellipsoid(s+' bunched haunch',(0,0,0),(0.078,0.135,0.118),FUR,'hips',n=16,r=9,transform=hm,weights=haunch_w)
 hs=hm@Matrix.Diagonal((0.078,0.135,0.118,1.0))
 for k,(a0,a1) in enumerate(((-0.35,0.55),(-0.62,0.2))):
  pts=[]
  for i in range(4):
   el=a0+(a1-a0)*i/3;az=-0.35-0.55*k+0.12*i
   pts.append(tuple(hs@V(math.cos(el)*math.cos(az)*sx,math.cos(el)*math.sin(az),math.sin(el))))
  C.tube(s+' haunch tabby stripe %d'%k,C.bspline(pts,5),C.bspline_radii([.0055,.0095,.0095,.0045],5),STRIPE,'hips',n=5,weights=haunch_w)
 pc=V(0.122*sx,-0.125,0.050);ps=(0.066,0.088,0.047)   # 3 mm sole clearance
 C.ellipsoid(s+' cream hind sock paw',tuple(pc),ps,CREAM,'hind_paw_'+s,n=16,r=8)
 for k,dx in enumerate((-0.021,0.021)):
  q=math.sqrt(max(0.0,1-(dx/ps[0])**2));pts=[(pc.x+dx,pc.y+math.cos(e)*q*ps[1]*.99,pc.z+math.sin(e)*q*ps[2]*.99) for e in (.2,.45,.75)]
  C.tube(s+' hind toe groove %d'%k,C.bspline(pts,3),[.0038,.0048,.0032,.003],CREASE,'hind_paw_'+s,n=4)

# ================= Question-mark tail with painted rings and a cream tip =================
def tail_w(p):
 i=min(range(len(TAIL_PATH)),key=lambda k:(TAIL_PATH[k]-p).length);s=TAIL_S[i]
 seg=min(NTAIL-1,int(s/(TAIL_LEN/NTAIL)));f=s/(TAIL_LEN/NTAIL)-seg
 names=['hips']+['tail_%d'%(k+1) for k in range(NTAIL)]
 cur=names[seg+1]
 if f<.3 and seg>=0:
  prev=names[seg];t=C.smooth(.5+f/.6);return {prev:1-t,cur:t}
 if f>.7 and seg<NTAIL-1:
  nxt=names[seg+2];t=C.smooth((f-.7)/.6);return {cur:1-t,nxt:t}
 return {cur:1.0}
BANDS=[(0.30,0.032),(0.45,0.032),(0.60,0.032),(0.74,0.032)]
marks=sorted(set([TAIL_LEN*i/26 for i in range(27)]+[TAIL_LEN*(c+sg*w) for c,w in BANDS for sg in (-1,1)]+[TAIL_LEN*.86]))
marks=[x for i,x in enumerate(marks) if i==0 or x-marks[i-1]>.004]
tpts=[tail_at(x) for x in marks]
TR=[0.05,0.046,0.042,0.04,0.04,0.041,0.043]
def tail_r(u):
 k=u*(len(TR)-1);k0=min(int(k),len(TR)-2);return TR[k0]+(TR[k0+1]-TR[k0])*(k-k0)
def tail_tiles(c,n):
 # arclength at the midpoint of the nearest ring pair
 best=min(range(len(tpts)-1),key=lambda k:((tpts[k]+tpts[k+1])/2-c).length);u=(marks[best]+marks[best+1])/2/TAIL_LEN
 if u>0.86:return CREAM
 for cc,w in BANDS:
  if abs(u-cc)<w:return STRIPE
 return None
C.tube('Question-mark tail',tpts,[tail_r(x/TAIL_LEN) for x in marks],FUR,'tail_1',n=10,weights=tail_w,hint=(1,0,0),face_tile=tail_tiles)
C.ellipsoid('Fluffy cream tail tip',tuple(TAIL_PATH[-1]),(0.05,0.05,0.05),CREAM,'tail_6',n=14,r=8)

# ================= Collar and bell =================
cpts=[COLLAR_M@V(0.132*math.cos(math.tau*i/26),0.152*math.sin(math.tau*i/26),0) for i in range(26)]
loop('Raspberry collar',cpts,0.021,COLLAR,'neck',n=7,hint=tuple(COLLAR_M.to_3x3()@V(0,0,1)))
C.ellipsoid('Honey collar bell',(0,0,0),(0.037,0.035,0.037),HONEY,'bell',1,n=14,r=8,transform=BELL_M)
loop('Brass bell equator band',[BELL_M@V(0.0375*math.cos(math.tau*i/16),0.0355*math.sin(math.tau*i/16),0) for i in range(16)],0.0045,BRASS,'bell',1,n=5,hint=tuple(BELL_M.to_3x3()@V(0,0,1)))
C.box('Bell bottom slot',(0,0.0,-0.031),(0.04,0.008,0.012),INK,'bell',bevel=.002,segments=1,mat=1,transform=BELL_M)
C.lathe('Brass bell loop',(0,-0.004,0.032),[(0,.012),(.012,.012)],BRASS,'bell',1,n=10,axis='y',transform=BELL_M)

# ================= Teal gadget pack, straps, button, dial, rivets, spring antenna, propeller =================
def pack_tiles(c,n):
 ln=PACK_M.to_3x3().inverted()@n
 return TEAL_D if abs(ln.x)>.7 or ln.z<-.7 else None
C.box('Teal gadget pack',(0,0,0),(0.2,0.17,0.105),TEAL,'pack',bevel=.026,segments=2,transform=PACK_M,face_tile=pack_tiles)
C.lathe('Big raspberry mischief button',(0.035,0.04,0.047),[(0,.032),(.020,.031),(.026,.026),(.027,0.0)],COLLAR,'pack',1,n=14,transform=PACK_M)
C.lathe('Honey pack dial',(-0.055,0.045,0.050),[(0,.018),(.014,.018),(.016,.013),(.017,0.0)],HONEY,'pack',1,n=12,transform=PACK_M)
C.lathe('Dial pointer',(-0.055,0.052,0.066),[(0,.004),(.004,.0)],INK,'pack',1,n=4,transform=PACK_M)
for sx in (1,-1):
 C.lathe('Brass pack rivet %+d'%sx,(0.099*sx,0,0),[(0,.014),(.008,.013),(.011,0.0)] if sx>0 else [(-.011,0.0),(-.008,.013),(0,.014)],BRASS,'pack',1,n=10,axis='x',transform=PACK_M)
coil=[PACK_M@V(-0.03+0.013*math.cos(t*math.tau*5),-0.055-0.04*t+0.013*math.sin(t*math.tau*5),0.05+0.13*t) for t in [i/40 for i in range(41)]]
def ant_w(p):
 zl=(PACK_M.inverted()@p).z;t=C.smooth((zl-.10)/.04);return {'antenna_1':1-t,'antenna_2':t}
C.tube('Brass spring antenna',coil,.0048,BRASS,'antenna_1',1,n=4,weights=ant_w,hint=tuple(PACK_M.to_3x3()@V(0,0,1)))
C.ellipsoid('Honey antenna ball',(-0.03,-0.095,0.2),(0.026,0.026,0.026),HONEY,'antenna_2',1,n=12,r=7,transform=PACK_M)
C.lathe('Propeller spindle',(-0.03,-0.095,0.214),[(0,.0042),(.034,.0042)],INK,'propeller',1,n=6,transform=PACK_M)
for k,(ry,rz) in enumerate(((.12,.5),(-.12,.5+math.pi/2))):
 C.ellipsoid('Tiny cream propeller blade '+'AB'[k],(-0.03,-0.095,0.246),(0.056,0.013,0.0055),CREAM,'propeller',n=10,r=4,rot=(0,ry,rz),transform=PACK_M)
for k,yy in enumerate((0.05,-0.135)):
 t=(yy-RUMP.y)/(CHEST.y-RUMP.y);cc=RUMP+(CHEST-RUMP)*t;r=C.interp(BODY,(cc-RUMP).length)+0.006
 M=Matrix.Translation(cc)@track(AXIS)
 loop('Teal pack strap %d'%k,[M@V(r*math.cos(math.tau*i/24),r*BODY_EY*math.sin(math.tau*i/24),0) for i in range(24)],0.0085,TEAL,'hips',n=4,weights=body_w,hint=tuple(AXIS))

# ================= Head =================
HEAD=[(0.395,0.02),(0.405,0.10),(0.425,0.160),(0.46,0.205),(0.52,0.232),(0.585,0.238),(0.65,0.228),(0.705,0.203),(0.75,0.160),(0.782,0.100),(0.798,0.035),(0.80,0.0)]
HEAD_EY=0.82;HEAD_Y=0.20
def head_y(x,z,off=0.0):
 r=C.interp(HEAD,z);return HEAD_Y+HEAD_EY*math.sqrt(max(0.0,r*r-x*x))+off
def head_x(y,z,sx=1,off=0.0):
 r=C.interp(HEAD,z);d=(y-HEAD_Y)/HEAD_EY;return sx*(math.sqrt(max(0.0,r*r-d*d))+off)
def head_frame(x,z,inset=0.0):
 r=max(C.interp(HEAD,z),1e-3);y=head_y(x,z);nx=x/r**2;ny=(y-HEAD_Y)/(HEAD_EY*r)**2
 return Matrix.Translation((x,y-inset,z))@Matrix.Rotation(-math.atan2(nx,ny),4,'Z')
C.lathe('Big round kitten head',(0,HEAD_Y,0),densify(HEAD,.0225),FUR,'head',n=34,ey=HEAD_EY)
# Painted crown stripes: three thin flat plum-lilac bands (x = 0 and x = +/-0.064) laid on the head
# surface, pointed at the front just above the brows and running over the crown and down the back.
def g_head(p):return p.x*p.x+((p.y-HEAD_Y)/HEAD_EY)**2-C.interp(HEAD,p.z)**2
def head_n(p,h=1e-4):
 return V(g_head(p+V(h,0,0))-g_head(p-V(h,0,0)),g_head(p+V(0,h,0))-g_head(p-V(0,h,0)),g_head(p+V(0,0,h))-g_head(p-V(0,0,h))).normalized()
def slice_hit(x,phi,zc=0.585):
 lo,hi=0.0,0.45
 for _ in range(40):
  mid=(lo+hi)/2;p=V(x,HEAD_Y+mid*math.cos(phi),zc+mid*math.sin(phi))
  if 0.395<=p.z<=0.80 and g_head(p)<=0:lo=mid
  else:hi=mid
 return V(x,HEAD_Y+lo*math.cos(phi),zc+lo*math.sin(phi))
def phi_for(x,z,a,b):
 for _ in range(40):
  m=(a+b)/2
  if (slice_hit(x,m).z<z)==(slice_hit(x,a).z<z):a=m
  else:b=m
 return (a+b)/2
for k,(cx,w) in enumerate(((0.0,0.012),(0.064,0.011),(-0.064,0.011))):
 f0=phi_for(cx,0.768,math.radians(25),math.radians(90));f1=phi_for(cx,0.585,math.radians(95),math.radians(200))
 N_=14;cent=[];nor=[];wid=[];bi=[]
 for i in range(N_+1):
  u=i/N_;phi=f0+(f1-f0)*u;hit=slice_hit(cx,phi);n_=head_n(hit)
  cent.append(hit-n_*0.0012);nor.append(n_);wid.append(max(.0018,w*min(1,u/.16)*(1-.55*C.smooth((u-.7)/.3))))
 for i in range(N_+1):
  t_=(cent[min(i+1,N_)]-cent[max(i-1,0)]).normalized();bi.append(t_.cross(nor[i]).normalized())
 C.ribbon('Crown tabby stripe %d'%k,cent,nor,wid,.0034,STRIPE,'head',closed=False,binormals=bi)
for s,sx in (('R',1),('L',-1)):
 base=EAR_BASE[s];tip=EAR_TIP[s];L=(tip-base).length;M=Matrix.Translation(base)@track(tip-base)
 C.lathe('Big ear '+s,(0,0,0),[(0.0,0.104),(L*0.45,0.074),(L*0.8,0.036),(L*0.93,0.018),(L,0.0)],FUR,'ear_'+s,n=16,ey=0.52,transform=M)
 C.lathe('Pink inner ear '+s,(0,0.026,0),[(0.018,0.070),(L*0.45,0.049),(L*0.78,0.021),(L*0.88,0.0)],PINK,'ear_'+s,n=10,ey=0.36,transform=M)
 for k,(dx,a_) in enumerate(((-0.018,0.25),(0.012,-0.2))):
  ax=(M.to_3x3()@(Euler((0.15,a_*sx,0)).to_matrix()@V(0,0,1)))
  cone('Cream ear tuft %s %d'%(s,k),M@V(dx*sx,0.035,0.015),ax,0.014,0.07,CREAM,'ear_'+s,n=5)
# forehead/cheek tabby strokes and cheek fluff tufts
for sx in (1,-1):
 for k,(y0,z0) in enumerate(((0.26,0.605),(0.235,0.565))):
  pts=[(head_x(y,z0+0.01*i,sx,-0.004),y,z0+0.01*i) for i,y in enumerate((y0,y0-0.045,y0-0.09))]
  C.tube('Cheek tabby stripe %+d %d'%(sx,k),C.bspline(pts,4),C.bspline_radii([.012,.011,.006],4),STRIPE,'head',n=5)
 for k,(z,a_) in enumerate(((0.47,-0.35),(0.515,-0.1),(0.56,0.2))):
  y=0.24;ax=Euler((0,sx*(math.pi/2+a_),0)).to_matrix()@V(0,0,1)
  cone('Cheek fluff tuft %+d %d'%(sx,k),V(head_x(y,z,sx,-0.045),y,z),ax,0.032,0.075,FUR,'head',n=6)
# eyes: big honey irises glancing to the kitten's right, two highlights, sly squint on the left eye
for sx in (1,-1):
 F=head_frame(0.095*sx,0.60,inset=0.02)
 C.ellipsoid('Eye white %+d'%sx,(0,0,0),(0.054,0.032,0.066),WHITE,'head',1,n=16,r=9,transform=F)
 C.ellipsoid('Honey iris %+d'%sx,(0.014,0.018,-0.004),(0.037,0.02,0.046),HONEY,'head',1,n=14,r=7,transform=F)
 C.ellipsoid('Big plum pupil %+d'%sx,(0.018,0.028,-0.004),(0.023,0.014,0.032),INK,'head',1,n=12,r=6,transform=F)
 C.ellipsoid('Eye highlight big %+d'%sx,(0.004,0.038,0.018),(0.011,0.008,0.012),WHITE,'head',1,n=8,r=4,transform=F)
 C.ellipsoid('Eye highlight small %+d'%sx,(0.03,0.036,-0.022),(0.006,0.005,0.006),WHITE,'head',1,n=6,r=4,transform=F)
 if sx<0:
  C.ellipsoid('Sly squint lid left',(0,0.0015,0.056),(0.06,0.0345,0.028),FUR,'head',n=14,r=7,transform=F@Matrix.Rotation(0.30,4,'Y'))
BROW=1.18
rb=[(0.05,0.705),(0.095,0.735),(0.14,0.722)];lb=[(-0.05,0.676),(-0.095,0.688),(-0.138,0.703)]
for name,pts in (('Raised mischief brow right',rb),('Scheming slanted brow left',lb)):
 C.tube(name,C.bspline([(x,head_y(abs(x),z,0.002),z) for x,z in pts],6),[r*BROW for r in C.bspline_radii([.009,.012,.006],6)],STRIPE,'head',n=6)
# muzzle: cream patch, whisker pads, pink nose, chin, philtrum, lopsided smirk, tongue blep
MUZ=[((0.0,head_y(0,0.51)-0.05,0.505),(0.12,0.07,0.078)),((0.04,head_y(0.04,0.505)-0.006,0.505),(0.05,0.036,0.04)),((-0.04,head_y(0.04,0.505)-0.006,0.505),(0.05,0.036,0.04))]
C.ellipsoid('Cream muzzle patch',MUZ[0][0],MUZ[0][1],CREAM,'head',n=16,r=8)
for k in (1,2):C.ellipsoid('Cream whisker pad %+d'%(1 if k==1 else -1),MUZ[k][0],MUZ[k][1],CREAM,'head',n=14,r=7)
C.ellipsoid('Little cream chin',(0.0,head_y(0,0.44)-0.03,0.445),(0.06,0.04,0.035),CREAM,'head',n=12,r=6)
C.ellipsoid('Pink kitten nose',(0.0,head_y(0,0.54)+0.018,0.54),(0.026,0.016,0.017),PINK,'head',1,n=12,r=6)
def muzzle_front(x,z,off=0.003):
 best=None
 for (cx,cy,cz),(sx_,sy,sz) in MUZ:
  f=1-((x-cx)/sx_)**2-((z-cz)/sz)**2
  if f>0:
   y=cy+sy*math.sqrt(f);best=y if best is None else max(best,y)
 return V(x,best+off,z)
C.tube('Philtrum',[muzzle_front(0.0,z) for z in (0.524,0.505,0.487)],[.0042,.0047,.0047],INK,'head',n=5)
smirk=[(-0.07,0.484),(-0.04,0.472),(-0.014,0.475),(0.0,0.484),(0.014,0.475),(0.046,0.471),(0.074,0.483),(0.092,0.503),(0.097,0.52)]
C.tube('Lopsided smirk',C.bspline([muzzle_front(x,z) for x,z in smirk],16),C.bspline_radii([.0038,.0048,.0052,.0052,.0052,.0052,.005,.0044,.003],16),INK,'head',n=5)
TNG=Matrix.Translation((-0.018,head_y(0.018,0.466)+0.018,0.458))@Euler((0.35,0.0,0.12)).to_matrix().to_4x4()
C.ellipsoid('Tongue blep',(0,0,0),(0.019,0.012,0.022),TONGUE,'tongue',1,n=10,r=6,transform=TNG)
for sx in (1,-1):
 for k,(z1,dz) in enumerate(((0.52,0.025),(0.505,0.0),(0.49,-0.028))):
  y0=head_y(0.07,z1)-0.005
  C.tube('Whisker %+d %d'%(sx,k),C.bspline([(0.07*sx,y0,z1),(0.19*sx,y0-0.03,z1+dz*0.6),(0.3*sx,y0-0.075,z1+dz)],4),C.bspline_radii([.0056,.0046,.003],4),INK,'head',n=4)

# ================= Mini plum stovepipe hat tipped to the kitten's left =================
C.lathe('Mini hat brim',(0,0,0),[(.007,.048),(.007,.083),(.004,.089),(-.002,.0905),(-.007,.085),(-.007,.048)],HAT,'hat',n=24,ey=1.05,closed_profile=True,transform=HAT_M)
C.lathe('Mini stovepipe crown',(0,0,0),[(0.0,0.056),(0.06,0.057),(0.11,0.063),(0.125,0.061),(0.128,0.04),(0.13,0.0)],HAT,'hat',n=24,ey=1.05,transform=HAT_M)
C.lathe('Mini honey hat band',(0,0,0),[(0.006,0.0575),(0.009,0.0598),(0.036,0.0604),(0.039,0.0582)],HONEY,'hat',1,n=24,ey=1.05,caps=False,transform=HAT_M)

# ================= Join one skin, build the rig, checkpoint =================
sources=bpy.data.collections.new('EDITABLE original mischief kitten parts - excluded from export');sc.collection.children.link(sources)
inventory=[];copies=[]
for ob in C.PARTS:
 ob.data.calc_loop_triangles();inventory.append({'name':ob.name,'triangles':len(ob.data.loop_triangles),'bone_groups':[g.name for g in ob.vertex_groups],'atlas_tile':ob.get('atlas_tile')})
 cp=ob.copy();cp.data=ob.data.copy();sc.collection.objects.link(cp);copies.append(cp)
 for col in list(ob.users_collection):col.objects.unlink(ob)
 sources.objects.link(ob)
sources.hide_render=True;sources.hide_viewport=True
bpy.ops.object.select_all(action='DESELECT')
for ob in copies:ob.select_set(True)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();skin=bpy.context.object;skin.name='Mischief_Kitten_Skin'
for tag in ['source_part','rigid_weight','atlas_tile']:
 if tag in skin:del skin[tag]
skin.data.calc_loop_triangles();tris=len(skin.data.loop_triangles)
data=bpy.data.armatures.new('Original mischief kitten rig');arm=bpy.data.objects.new('Mischief_Kitten_Rig',data);sc.collection.objects.link(arm)
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
arm['asset_id']='mischief-kitten';arm['version']='v001';arm['forward']='Blender +Y / glTF -Z';arm['neutral_total_height_m']=round(hi[2],4);arm['attack_contact_fraction']=.625
record={'asset_id':'mischief-kitten','version':'v001','work_order':'WO111','authoring_model':'claude-opus-5-5 xhigh (Claude Code subagent; Tom ruled Sept 26 that Claude Opus 5.5 does the WO111 Blender work)','blender_version':bpy.app.version_string,
 'source_reference':'Blender reference sheet, no generated concept','source_sheet_sha256':sc['source_sheet_sha256'],'source_blockout_sha256':sc['source_blockout_sha256'],
 'rest_bounds_blender_z_up':{'min':lo,'max':hi},'height_m':hi[2],'triangles':tris,'vertices':len(skin.data.vertices),'material_count':len(skin.data.materials),'bone_count':len(data.bones),
 'texture':{'file':'pigment.png','width':1024,'height':1024,'origin':'Original deterministic soft painted palette atlas generated in Blender Python from the sheet colours; no external textures.','palette':COLORS},
 'parts':inventory}
(ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n')
rest_json={k:[list(map(float,h)),list(map(float,t)),p] for k,(h,t,p) in REST.items()}
(ROOT/'source/rig-rest.json').write_text(json.dumps({'rest':rest_json},indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'mischief-kitten-construction.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(ROOT/'mischief-kitten-checkpoint.glb'),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_yup=True,export_apply=False,export_armature_object_remove=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=True)
big=sorted(inventory,key=lambda r:-r['triangles'])
print(json.dumps({'triangles':tris,'vertices':len(skin.data.vertices),'height_m':hi[2],'bounds':[lo,hi],'bones':len(data.bones),'largest':[(r['name'],r['triangles']) for r in big[:24]]}))
