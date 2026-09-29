"""WO111 web-slinger-helper v001: the original 1024 painted atlas, generated with numpy inside Blender.

Every painted detail replays the approved blockout's own construction (build_blockout.py) in the matching
projection, so it lands where the blockout's decal or strand sat:

* FACE (top-left 512): grin, top-teeth strip, tongue, cheek blush and a soft nose shade in the face's front
  projection, plus the tangerine mask shape (under the mask shell) with a thin plum edge like the sheet's ink;
* HOOD (top-right 512): an azimuthal map from the crown. The eight cream dew-drop strands, the two sagging rings,
  the crown knot and the six strand-tip drops, clipped 1.17x clear of the face opening exactly like the blockout,
  with a faint deeper-cobalt halo so the painted strands read raised; a deeper-cobalt groove just outside the rim;
* TF / TB (bottom-left 512 x 256 each): the torso front and back halves by lathe angle and height, painted in the
  blockout's arc-length (u, v) torso coordinates: the ten rays, two sagging scallop rings and dew drops round each
  star (front star 0.075 m, back star 0.052 m), clipped to the blockout's yoke region;
* EYE (256): the eye-local front projection shared by both eyes: the blockout's eye-white, iris, pupil and two
  glint ellipsoids layered by depth, with a thin plum rim;
* MITT (128): the palm projection shared by both mittens with the three painted finger grooves;
* eleven 128 px flat tiles holding the sheet colours plus three deeper shades.
Supersampled and box-filtered; written as an RGB PNG with zlib (no external image tools).
"""
import math, struct, zlib
import numpy as np

HEX={'suit':'3b7dd8','cream':'fbf6ea','sun':'f7c64a','tang':'f28c3a','skin':'f0c7a0','hair':'7a4a30','heart':'e8566f',
 'sole':'4a3f63','ink':'342c46','iris':'7b5234','tongue':'ef8f98','blush':'f4a79d',
 'suit_d':'2c63b6','sun_d':'d9a53a','tang_d':'cf6f28','iris_d':'5a3a24','skin_d':'dba47f'}
TILES=['suit','cream','sun','tang','skin','hair','heart','sole','suit_d','sun_d','tang_d']
T={name:i for i,name in enumerate(TILES)}
TILE_RECTS=[(512,512),(640,512),(768,512),(896,512),(512,640),(640,640),(768,640),(896,640),(896,768),(768,896),(896,896)]
FACE_RECT=(0,0,512,512);FACE_SRC=(-0.165,0.165,0.807,1.137)
HOOD_RECT=(512,0,512,512);HOOD_T_SPLIT=1.45;HOOD_R_SPLIT=0.82
TF_RECT=(0,512,512,256);TB_RECT=(0,768,512,256);TORSO_Z=(0.485,0.815)
EYE_RECT=(512,768,256,256);EYE_SRC=(-0.04,0.04,-0.048,0.048)
MITT_RECT=(768,768,128,128);MITT_SRC=(-0.052,0.052,-0.012,0.128)

# ---------------- blockout geometry (identical numbers to build_blockout.py / rig.py) ----------------
HC=(0.0,0.0,0.99);HR=(0.185,0.178,0.195);HOLE_AX=0.128;HOLE_AZ=0.138;HOLE_ZC=0.960
TORSO_EY=0.74
TORSO_PROF=[(0.395,0.03),(0.405,0.075),(0.425,0.115),(0.46,0.14),(0.52,0.150),(0.60,0.148),(0.67,0.150),
 (0.72,0.152),(0.75,0.142),(0.775,0.118),(0.795,0.08),(0.808,0.03)]
def _interp(profile,z):
 if z<=profile[0][0]:return profile[0][1]
 for (z0,r0),(z1,r1) in zip(profile,profile[1:]):
  if z0<=z<=z1:return r0+(r1-r0)*(z-z0)/(z1-z0)
 return profile[-1][1]
def _smooth_profile(profile,step=0.004):
 t0,t1=profile[0][0],profile[-1][0];n=max(8,int((t1-t0)/step))
 ts=[t0+(t1-t0)*i/n for i in range(n+1)];rs=[_interp(profile,t) for t in ts]
 for _ in range(3):rs=[rs[0]]+[(rs[i-1]+2*rs[i]+rs[i+1])/4 for i in range(1,len(rs)-1)]+[rs[-1]]
 return list(zip(ts,rs))
TP=_smooth_profile(TORSO_PROF);TPZ=np.array([p[0] for p in TP]);TPR=np.array([p[1] for p in TP])
def torso_r(z):return np.interp(z,TPZ,TPR)
_ARC=[(0.0,0.0)]
for _i in range(1,1600):
 _t=math.pi*_i/1599
 _ARC.append((_t,_ARC[-1][1]+math.sqrt(math.cos(_t)**2+(TORSO_EY*math.sin(_t))**2)*math.pi/1599))
ARC_T=np.array([a for a,_ in _ARC]);ARC_S=np.array([s for _,s in _ARC]);QUARTER=_ARC[800][1]
STAR_Z=0.655;STAR_TILT=math.radians(10);BELT=(0.452,0.492)

def rgb(h):return np.array([int(h[i:i+2],16) for i in (0,2,4)],dtype=np.float64)

def chaikin(pts,it=2):
 P=[tuple(p) for p in pts]
 for _ in range(it):
  Q=[];m=len(P)
  for i in range(m):
   a=P[i];b=P[(i+1)%m];Q+=[(0.75*a[0]+0.25*b[0],0.75*a[1]+0.25*b[1]),(0.25*a[0]+0.75*b[0],0.25*a[1]+0.75*b[1])]
  P=Q
 return P
def star_outline(cu,cv,R,r,tilt,it=2):
 pts=[]
 for k in range(10):
  ang=math.pi/2+tilt+math.pi*k/5;rad=R if k%2==0 else r
  pts.append((cu+rad*math.cos(ang),cv+rad*math.sin(ang)))
 return chaikin(pts,it)
def mask_outline(it=2):
 half_top=[(0.0,1.046),(0.02,1.054),(0.04,1.07),(0.062,1.076),(0.085,1.066),(0.105,1.06),(0.122,1.062)]
 half_bot=[(0.124,1.03),(0.114,0.99),(0.096,0.95),(0.066,0.932),(0.04,0.935),(0.02,0.95),(0.0,0.966)]
 right=half_top+half_bot
 return chaikin(right+[(-x,z) for x,z in reversed(right[1:-1])],it)

# ---------------- region pixel maps (scalar; build.py calls these per vertex) ----------------
def face_px(x,z):
 x0,x1,z0,z1=FACE_SRC;return (FACE_RECT[0]+(x-x0)/(x1-x0)*FACE_RECT[2],FACE_RECT[1]+(z1-z)/(z1-z0)*FACE_RECT[3])
def hood_theta_phi(p):
 u=((p[0]-HC[0])/HR[0],(p[1]-HC[1])/HR[1],(p[2]-HC[2])/HR[2]);L=math.sqrt(sum(c*c for c in u))
 u=[c/L for c in u];return math.acos(max(-1.0,min(1.0,u[2]))),math.atan2(u[0],u[1])
def hood_rho(theta):
 if theta<=HOOD_T_SPLIT:return HOOD_R_SPLIT*theta/HOOD_T_SPLIT
 return HOOD_R_SPLIT+(1-HOOD_R_SPLIT)*(theta-HOOD_T_SPLIT)/(math.pi-HOOD_T_SPLIT)
def hood_px(p):
 th,ph=hood_theta_phi(p);r=min(hood_rho(th),0.995)
 return (HOOD_RECT[0]+HOOD_RECT[2]*0.5*(1+r*math.sin(ph)),HOOD_RECT[1]+HOOD_RECT[3]*0.5*(1+r*math.cos(ph)))
def torso_px(p,front):
 A=math.atan2(p[1]/TORSO_EY,p[0])
 if front:
  if A<-math.pi/2:A+=math.tau
  t=math.pi/2-A;rect=TF_RECT
 else:
  if A>math.pi/2:A-=math.tau
  t=A+math.pi/2;rect=TB_RECT
 u=min(1.0,max(0.0,0.5+t/math.pi));z0,z1=TORSO_Z;v=min(1.0,max(0.0,(z1-p[2])/(z1-z0)))
 return (rect[0]+u*rect[2],rect[1]+v*rect[3])
def eye_px(x,z):
 x0,x1,z0,z1=EYE_SRC;return (EYE_RECT[0]+(x-x0)/(x1-x0)*EYE_RECT[2],EYE_RECT[1]+(z1-z)/(z1-z0)*EYE_RECT[3])
def mitt_px(x,z):
 x0,x1,z0,z1=MITT_SRC;return (MITT_RECT[0]+(x-x0)/(x1-x0)*MITT_RECT[2],MITT_RECT[1]+(z1-z)/(z1-z0)*MITT_RECT[3])

# ---------------- raster helpers ----------------
class Canvas:
 def __init__(self,w,h,ss,bg):
  self.w=w*ss;self.h=h*ss;self.ss=ss;self.img=np.empty((self.h,self.w,3));self.img[:]=rgb(HEX[bg])
  self.cu=(np.arange(self.w)+.5)/self.w;self.cv=(np.arange(self.h)+.5)/self.h
 def put(self,mask,color,alpha=1.0):
  if isinstance(color,str):color=rgb(HEX.get(color,color))
  self.img[mask]=self.img[mask]*(1-alpha)+color*alpha
 def down(self):
  s=self.ss;return self.img.reshape(self.h//s,s,self.w//s,s,3).mean(axis=(1,3))

def inside(A,B,poly):
 res=np.zeros(A.shape,dtype=bool);n=len(poly)
 for i in range(n):
  (xi,zi),(xj,zj)=poly[i],poly[(i-1)%n]
  cond=((zi>B)!=(zj>B))
  with np.errstate(divide='ignore',invalid='ignore'):xint=(xj-xi)*(B-zi)/(zj-zi+1e-30)+xi
  res^=cond&(A<xint)
 return res
def seg_dist(A,B,p,q):
 d=(q[0]-p[0],q[1]-p[1]);L=d[0]*d[0]+d[1]*d[1]
 t=np.clip(((A-p[0])*d[0]+(B-p[1])*d[1])/max(L,1e-18),0,1)
 return np.hypot(A-(p[0]+t*d[0]),B-(p[1]+t*d[1])),t
def poly_edge_dist(A,B,poly):
 best=np.full(A.shape,1e9)
 for i in range(len(poly)):
  dd,_=seg_dist(A,B,poly[i],poly[(i+1)%len(poly)]);best=np.minimum(best,dd)
 return best

# ---------------- FACE ----------------
MW=0.06
def zu(x):return 0.912-0.011*(1-(x/MW)**2)
def zl(x):return 0.910-0.054*np.maximum(0.0,1-(x/MW)**2)**0.7
def paint_face():
 cv=Canvas(512,512,3,'skin');x0,x1,z0,z1=FACE_SRC
 X,Z=np.meshgrid(x0+cv.cu*(x1-x0),z1-cv.cv*(z1-z0))
 # soft nose shade under the geometry button nose, cheek blush
 cv.put(((X/0.024)**2+((Z-0.931)/0.010)**2)<1,'skin_d',0.35)
 for sx in (1,-1):
  cv.put((((X-0.088*sx)/0.021)**2+((Z-0.914)/0.012)**2)<1,'blush')
 # the grin: ink mouth between the blockout's two curves, the top-teeth strip and the tongue inside it
 mouth=(np.abs(X)<MW)&(Z<zu(X))&(Z>zl(X));cv.put(mouth,'ink')
 tw=0.043;q=np.sqrt(np.maximum(0.0,1-(X/tw)**2))**0.6
 cv.put(mouth&(np.abs(X)<tw)&(Z<zu(X)-0.0025)&(Z>zu(X)-0.0025-0.0105*q),'cream')
 cv.put(mouth&(((X/0.027)**2+((Z-0.873)/0.013)**2)<1),'tongue')
 # the tangerine mask shape under the mask shell, with a thin plum edge just outside it (the sheet's ink line)
 poly=mask_outline(1);m=inside(X,Z,poly)
 cv.put((~m)&(poly_edge_dist(X,Z,poly)<0.0016),'ink',0.85);cv.put(m,'tang')
 return cv.down()

# ---------------- HOOD ----------------
def paint_hood():
 cv=Canvas(512,512,2,'suit')
 A,B=np.meshgrid(cv.cu*2-1,cv.cv*2-1);rho=np.hypot(A,B);phi=np.arctan2(A,B)
 th=np.where(rho<=HOOD_R_SPLIT,rho/HOOD_R_SPLIT*HOOD_T_SPLIT,HOOD_T_SPLIT+(rho-HOOD_R_SPLIT)/(1-HOOD_R_SPLIT)*(math.pi-HOOD_T_SPLIT))
 th=np.minimum(th,math.pi)
 st,ct,sp,cp=np.sin(th),np.cos(th),np.sin(phi),np.cos(phi)
 X=HC[0]+HR[0]*st*sp;Y=HC[1]+HR[1]*st*cp;Z=HC[2]+HR[2]*ct
 def hole(grow):return (Y>HC[1])&((X/(HOLE_AX*grow))**2+((Z-HOLE_ZC)/(HOLE_AZ*grow))**2<1)
 keep=~hole(1.17)
 Rh=np.sqrt((HR[0]*sp)**2+(HR[1]*cp)**2);Rm=np.sqrt((HR[2]*st)**2+(Rh*ct)**2)
 def wrap(a):return (a+math.pi)%math.tau-math.pi
 NM=8;TH_END=1.3;phis=[math.radians(22.5+45*k) for k in range(NM)]
 def hp(t,p,s=1.0):return (HC[0]+HR[0]*math.sin(t)*math.sin(p)*s,HC[1]+HR[1]*math.sin(t)*math.cos(p)*s,HC[2]+HR[2]*math.cos(t)*s)
 def blk_hole(q,grow=1.17):return q[1]>HC[1] and (q[0]/(HOLE_AX*grow))**2+((q[2]-HOLE_ZC)/(HOLE_AZ*grow))**2<1
 strand=np.full(th.shape,1e9)
 full=[]
 for ph in phis:
  d=np.abs(wrap(phi-ph))*st*Rh
  along=np.where(th<0.03,(0.03-th)*Rm,np.where(th>TH_END,(th-TH_END)*Rm,0.0))
  strand=np.minimum(strand,np.hypot(d,along)/0.0042)
  line=[hp(0.03+(TH_END-0.03)*i/50,ph,1.012) for i in range(51)]
  full.append(not any(blk_hole(q) for q in line))
 for rk,t0 in enumerate((0.52,1.0)):
  for k in range(NM):
   f=np.mod(phi-phis[k],math.tau)/(math.pi/4)
   seg=f<=1.0
   tr=t0*(1-0.1*np.sin(math.pi*np.clip(f,0,1)))
   d=np.where(seg,np.abs(th-tr)*Rm,1e9)
   strand=np.minimum(strand,d/0.0038)
 drops=np.full(th.shape,1e9)
 for ph,ok in zip(phis,full):
  if ok:
   c=hp(TH_END+0.02,ph,1.02);drops=np.minimum(drops,np.sqrt((X-c[0])**2+(Y-c[1])**2+(Z-c[2])**2)/0.0095)
 knot=np.sqrt((X-HC[0])**2+(Y-HC[1])**2+(Z-(HC[2]+HR[2]))**2)/0.0095
 web=np.minimum(np.minimum(strand,drops),knot)
 # groove just outside the rim tube, then the halo and the strands
 cv.put(hole(1.12)&~hole(1.0),'suit_d',0.9)
 cv.put(keep&(web<1.0+0.0022/0.004)&(web>=1.0),'suit_d',0.45)
 cv.put(keep&(web<1.0),'cream')
 return cv.down(),{'full_strands':sum(full),'drops':sum(full)}

# ---------------- TORSO ----------------
def region_ok(u,v,rv):return (BELT[1]+0.012<v<0.782) and abs(u)<0.9*QUARTER*rv
def web_paths(cv_star,R,rr,tilt,reach,dists):
 """The blockout's rays (first kept run) and scallop arcs (all kept runs), plus the dew drops of full rays."""
 rays=[];arcs=[];drops=[]
 rf=lambda v:float(torso_r(v))
 angs=[math.pi/2+tilt+math.pi*k/5 for k in range(10)]
 for k,al in enumerate(angs):
  d0=(R*0.8) if k%2==0 else (rr*1.05);steps=int((reach-d0)/0.005)+1
  uv=[(math.cos(al)*d,cv_star+math.sin(al)*d) for d in [d0+(reach-d0)*i/(steps-1) for i in range(steps)]]
  runs=[];cur=[]
  for p in uv:
   if region_ok(p[0],p[1],rf(p[1])):cur.append(p)
   else:
    if len(cur)>=3:runs.append(cur)
    cur=[]
  if len(cur)>=3:runs.append(cur)
  if runs:
   rays.append(runs[0])
   if len(runs[0])==len(uv):drops.append(runs[0][-1])
 for dist in dists:
  for k in range(10):
   a0=angs[k];a1=angs[(k+1)%10]+(math.tau if k==9 else 0.0);uv=[]
   for i in range(15):
    f=i/14;al=a0+(a1-a0)*f;d=dist*(1-0.13*math.sin(math.pi*f));uv.append((math.cos(al)*d,cv_star+math.sin(al)*d))
   cur=[]
   for p in uv:
    if region_ok(p[0],p[1],rf(p[1])):cur.append(p)
    else:
     if len(cur)>=3:arcs.append(cur)
     cur=[]
   if len(cur)>=3:arcs.append(cur)
 return rays,arcs,drops
def paint_torso(front):
 cv=Canvas(512,256,3,'suit');z0,z1=TORSO_Z
 zs=z1-cv.cv*(z1-z0);t=(cv.cu-0.5)*math.pi
 rz=torso_r(zs)[:,None];arc=np.interp(np.abs(t),ARC_T,ARC_S)[None,:]*np.sign(t)[None,:]
 U=rz*arc;Vv=np.repeat(zs[:,None],U.shape[1],axis=1)
 if front:star=(STAR_Z,0.075,0.037,STAR_TILT,0.205,(0.115,0.17))
 else:star=(STAR_Z+0.01,0.052,0.026,-STAR_TILT,0.18,(0.095,0.145))
 rays,arcs,drops=web_paths(star[0],star[1],star[2],star[3],star[4],star[5])
 D=np.full(U.shape,1e9)
 dz=float(z1-z0)/cv.h
 def stroke(pts,r):
  for p,q in zip(pts,pts[1:]):
   lo=min(p[1],q[1])-r-0.004;hi=max(p[1],q[1])+r+0.004
   i0=max(0,int((z1-hi)/dz));i1=min(cv.h,int((z1-lo)/dz)+1)
   if i1<=i0:continue
   dd,_=seg_dist(U[i0:i1],Vv[i0:i1],p,q);D[i0:i1]=np.minimum(D[i0:i1],dd/r)
 for pts in rays:stroke(pts,0.0042)
 for pts in arcs:stroke(pts,0.0038)
 for c in drops:
  D=np.minimum(D,np.hypot(U-c[0],Vv-c[1])/0.0085)
 cv.put((D<1.0+0.0022/0.004)&(D>=1.0),'suit_d',0.45);cv.put(D<1.0,'cream')
 cv.put(inside(U,Vv,star_outline(0.0,star[0],star[1],star[2],star[3])),'sun')
 return cv.down(),{'rays':len(rays),'arcs':len(arcs),'drops':len(drops)}

# ---------------- EYE ----------------
def paint_eye():
 cv=Canvas(256,256,4,'cream');x0,x1,z0,z1=EYE_SRC
 X,Z=np.meshgrid(x0+cv.cu*(x1-x0),z1-cv.cv*(z1-z0))
 def front(c,s):
  q=1-((X-c[0])/s[0])**2-((Z-c[2])/s[2])**2
  return np.where(q>0,c[1]+s[1]*np.sqrt(np.maximum(q,0)),-1.0),q
 yw,qw=front((0,0,0),(0.038,0.02,0.046))
 yi,qi=front((0,0.014,0.004),(0.025,0.011,0.029))
 yp,qp=front((0,0.02,0.005),(0.015,0.008,0.018))
 yg1,_=front((0.009,0.026,0.016),(0.0075,0.004,0.0085))
 yg2,_=front((-0.008,0.025,-0.006),(0.0038,0.003,0.0042))
 top=np.maximum.reduce([yw,yi,yp,yg1,yg2])
 iris=(yi>=top)&(yi>0);cv.put(iris,'iris');cv.put(iris&(qi<0.28),'iris_d')
 cv.put((yp>=top)&(yp>0),'ink')
 cv.put(((yg1>=top)&(yg1>0))|((yg2>=top)&(yg2>0)),'cream')
 cv.put((qw<0.075)&(qw>-0.2),'ink',0.9)
 return cv.down()

# ---------------- MITT ----------------
def paint_mitt():
 cv=Canvas(128,128,4,'sun');x0,x1,z0,z1=MITT_SRC
 X,Z=np.meshgrid(x0+cv.cu*(x1-x0),z1-cv.cv*(z1-z0))
 for fx in (-0.0155,0.0,0.0155):
  pts=[(fx,0.058+0.062-0.03*i/6) for i in range(7)];rad=[0.0012,0.0017,0.0022,0.0022,0.0022,0.0017,0.0012]
  m=np.zeros(X.shape,dtype=bool)
  for i,(p,q) in enumerate(zip(pts,pts[1:])):
   dd,tt=seg_dist(X,Z,p,q);m|=dd<(rad[i]+(rad[i+1]-rad[i])*tt)
  cv.put(m,'ink',0.9)
 return cv.down()

def png(path,img):
 img=np.clip(np.round(img),0,255).astype(np.uint8)
 def chunk(name,data):return struct.pack('>I',len(data))+name+data+struct.pack('>I',zlib.crc32(name+data)&0xffffffff)
 raw=b''.join(b'\x00'+row.tobytes() for row in img)
 data=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',img.shape[1],img.shape[0],8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
 open(path,'wb').write(data)

def paint_atlas(path):
 A=np.empty((1024,1024,3));A[:]=rgb(HEX['suit'])
 def blit(rect,img):x,y,w,h=rect;A[y:y+h,x:x+w]=img
 blit(FACE_RECT,paint_face());hood,hinfo=paint_hood();blit(HOOD_RECT,hood)
 tf,finfo=paint_torso(True);tb,binfo=paint_torso(False);blit(TF_RECT,tf);blit(TB_RECT,tb)
 blit(EYE_RECT,paint_eye());blit(MITT_RECT,paint_mitt())
 for name,(x,y) in zip(TILES,TILE_RECTS):A[y:y+128,x:x+128]=rgb(HEX[name])
 png(path,A)
 return {'tiles':dict(zip(TILES,TILE_RECTS)),'regions':{'FACE':FACE_RECT,'HOOD':HOOD_RECT,'TORSO_FRONT':TF_RECT,'TORSO_BACK':TB_RECT,'EYE':EYE_RECT,'MITT':MITT_RECT},
  'face_src_xz':FACE_SRC,'torso_z':TORSO_Z,'eye_src_local_xz':EYE_SRC,'mitt_src_local_xz':MITT_SRC,'hood_map':'azimuthal from the crown; rho = 0.82 theta/1.45 up to theta 1.45 rad, then linear to pi',
  'hood':hinfo,'torso_front_web':finfo,'torso_back_web':binfo,'hex':HEX}
