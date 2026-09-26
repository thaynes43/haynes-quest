"""WO111 radio-host-showman v001: the original 1024 painted atlas, generated with numpy.

Regions (see common.py for the UV side):
* face (top-left 512 px): head-local front projection. The sheet's big eyes, high brows, button-nose
  shadow and rosy cheeks, pushed creepier per the revised sheet notes (Tom, Sept 26, DESIGN-027):
  hollow shadowed sockets, heavy lids, sharper brows and a too-wide grin (corners 17% wider than the
  sheet, lifted toward the cheeks) full of sharp teeth. No blood, no gore;
* jacket (bottom-left 512 px): cylindrical lathe-angle x height map of the red/cream candy stripes
  (the blockout's 24 stripes by lathe angle), the white shirt V, black shawl lapels with a thin brass
  piping (the sheet review's "brass highlights so he reads at a distance"), the rounded cutaway, the
  pocket welt and lapel pin in front, the half-belt and vent at the back;
* iris (bottom-right, 256 px): one glowing red iris with a dark rim, a pinprick pupil and a glint,
  shared by both iris shells (the glow material also uses the atlas as emission);
* mic bands (bottom-right, 256 px): silver capsule with five grille bands along its axis;
* 128 px flat tiles holding the sheet colours plus the glow colours.
Supersampled 3x and box-filtered; written as an RGB PNG with zlib (no external image tools).
"""
import math, struct, zlib
import numpy as np

HEX={'skin':'efc9a4','skinlo':'e0a98a','hair':'6f2f32','hairtip':'3a2230','ink':'2a2230','red':'c0463e','cream':'f3e6cf',
 'white':'fbf6ec','silver':'c9ccd6','grille':'7d8196','brass':'dca953','brass_hi':'f2cf78','mouth':'2b1224','tongue':'7a2436',
 'cheek':'e89a8f','ink_hi':'3b3142','glow_red':'ff3326','halo_red':'86303a','halo_pale':'bdb5cc','static_pale':'e9e2f6','burst_red':'ff5a47',
 'bulb':'ff4436','teeth':'f3ebd3','shirt':'fbf6ec','sole':'1c1720','sclera':'f6eed8','pupil':'342c46'}
# Flat tile order (common.tile_uv index): 0-15 matte, 16-23 (16-21 glow).
TILES=['skin','skinlo','hair','hairtip','ink','red','cream','white','silver','grille','brass','brass_hi','mouth','tongue','cheek','ink_hi',
 'glow_red','halo_red','static_pale','burst_red','bulb','halo_pale','shirt','sole']
T={name:i for i,name in enumerate(TILES)}
GLOW_TILES={'glow_red','halo_red','static_pale','burst_red','bulb','halo_pale'}
FACE_SRC=(-0.19,0.19,1.495,1.875)
JACKET_Z=(0.80,1.49);JACKET_PAD=8/512;JACKET_EY=0.70
TORSO=[(0.0,0.172),(0.05,0.166),(0.14,0.150),(0.20,0.148),(0.30,0.160),(0.42,0.182),(0.52,0.19),(0.58,0.188),(0.62,0.17),(0.655,0.125),(0.675,0.08),(0.69,0.05)]
EYE_Q=1.25
MIC_BANDS=[(0.316,0.362),(0.408,0.454),(0.5,0.546),(0.592,0.638),(0.684,0.73)]
GRIN_GW=0.138;GRIN_MZ=1.600
SS=3

def rgb(h):return np.array([int(h[i:i+2],16) for i in (0,2,4)],dtype=np.float64)
def interp(profile,z):
 if z<=profile[0][0]:return profile[0][1]
 for (z0,r0),(z1,r1) in zip(profile,profile[1:]):
  if z0<=z<=z1:return r0+(r1-r0)*(z-z0)/(z1-z0)
 return profile[-1][1]
def smooth_profile(profile,step=0.008):
 t0,t1=profile[0][0],profile[-1][0];n=max(8,int((t1-t0)/step))
 ts=[t0+(t1-t0)*i/n for i in range(n+1)];rs=[interp(profile,t) for t in ts]
 for _ in range(2):rs=[rs[0]]+[(rs[i-1]+2*rs[i]+rs[i+1])/4 for i in range(1,len(rs)-1)]+[rs[-1]]
 return list(zip(ts,rs))
TP=smooth_profile(TORSO)

def bspline(points,samples):
 P=[np.array(p,dtype=np.float64) for p in points];k=min(4,len(P));nctrl=len(P);deg=k-1
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
  t=tmax*s/samples;p=np.zeros(len(P[0]));w=0
  for i in range(nctrl):
   b=basis(i,deg,t);p=p+P[i]*b;w+=b
  out.append(p/w if w>0 else P[-1])
 return np.array(out)
def ellipse_pts(rx,rz,cx=0.0,cz=0.0,n=48):
 return [(cx+rx*math.cos(math.tau*k/n),cz+rz*math.sin(math.tau*k/n)) for k in range(n)]

class Canvas:
 """Supersampled region canvas: world x/z of each supersample (front projection) and an RGB buffer."""
 def __init__(self,px,src,bg):
  self.n=px*SS;x0,x1,z0,z1=src
  c=(np.arange(self.n)+.5)/self.n
  self.X,self.Z=np.meshgrid(x0+c*(x1-x0),z1-c*(z1-z0))
  self.img=np.empty((self.n,self.n,3));self.img[:]=rgb(bg)
 def put(self,mask,color,alpha=1.0):
  self.img[mask]=self.img[mask]*(1-alpha)+rgb(color)*alpha
 def down(self):
  n=self.n//SS;return self.img.reshape(n,SS,n,SS,3).mean(axis=(1,3))

def inside(A,B,poly):
 res=np.zeros(A.shape,dtype=bool);n=len(poly)
 for i in range(n):
  (xi,zi),(xj,zj)=poly[i],poly[(i-1)%n]
  cond=((zi>B)!=(zj>B))
  with np.errstate(divide='ignore',invalid='ignore'):
   xint=(xj-xi)*(B-zi)/(zj-zi+1e-30)+xi
  res^=cond&(A<xint)
 return res
def seg_dist(A,B,p,q):
 d=q-p;L=float(d@d)
 t=np.clip(((A-p[0])*d[0]+(B-p[1])*d[1])/max(L,1e-18),0,1)
 return np.hypot(A-(p[0]+t*d[0]),B-(p[1]+t*d[1])),t
def poly_edge_dist(A,B,poly):
 best=np.full(A.shape,1e9)
 for i in range(len(poly)):
  dd,_=seg_dist(A,B,np.array(poly[i]),np.array(poly[(i+1)%len(poly)]));best=np.minimum(best,dd)
 return best
def decal(cv,poly,color,outline=0.0,outline_color=HEX['ink'],outline_alpha=.85,alpha=1.0,clip=None,X=None,Z=None):
 """Absolute (x, z) outline painted in front projection (X/Z default to the canvas grid)."""
 X=cv.X if X is None else X;Z=cv.Z if Z is None else Z
 m=inside(X,Z,poly)
 if clip is not None:m&=clip
 cv.put(m,color,alpha)
 if outline>0:
  e=m&(poly_edge_dist(X,Z,poly)<outline);cv.put(e,outline_color,outline_alpha)
 return m
def stroke(cv,pts,radii,color,samples=48,alpha=1.0,clip=None,X=None,Z=None):
 """A NURBS tube through (x, z) points (front view width = 2 radius)."""
 X=cv.X if X is None else X;Z=cv.Z if Z is None else Z
 P=bspline(pts,samples);R=bspline([(r,0) for r in radii],samples)[:,0]
 m=np.zeros(X.shape,dtype=bool)
 for i in range(len(P)-1):
  dd,t=seg_dist(X,Z,P[i],P[i+1]);m|=dd<(R[i]+(R[i+1]-R[i])*t)
 if clip is not None:m&=clip
 cv.put(m,color,alpha);return m

def grin_curves(GW=GRIN_GW,MZ=GRIN_MZ):
 up=lambda x:MZ+0.004+0.052*(x/GW)**2
 lo=lambda x:MZ+0.056-0.105*max(0.0,1-(x/GW)**2)**0.8
 return up,lo

# ---------------- the face (head-local, before the head transform) ----------------
def paint_face():
 cv=Canvas(512,FACE_SRC,HEX['skin'])
 for sx in (1,-1):
  ex,ez=0.057*sx,1.738
  decal(cv,ellipse_pts(0.050,0.061,ex,ez+0.002),'c9937a',alpha=.55)                 # hollow shadowed socket
  decal(cv,ellipse_pts(0.036,0.047,ex,ez),HEX['sclera'],outline=.0013)                 # pale eye white
  decal(cv,ellipse_pts(0.0236,0.0296,0.055*sx,1.734),HEX['ink'])                       # iris rim under the glowing shell
  lid=[(ex+0.038*math.cos(math.radians(a)),ez+0.049*math.sin(math.radians(a))+0.001) for a in (4,34,64,90,116,146,176)]
  stroke(cv,lid,[0.003,0.0055,0.0064,0.0066,0.0064,0.0055,0.003],HEX['pupil'])         # heavy upper lid
  low=[(ex+0.035*math.cos(math.radians(a)),ez+0.046*math.sin(math.radians(a))) for a in (205,238,270,302,335)]
  stroke(cv,low,[0.0012,0.002,0.0024,0.002,0.0012],'6e3f45',alpha=.75)                 # thin lower lid
  brow=[(0.018*sx,1.792),(0.037*sx,1.812),(0.061*sx,1.822),(0.085*sx,1.813),(0.101*sx,1.794)]
  stroke(cv,brow,[0.0035,0.0068,0.0072,0.0054,0.0022],HEX['hairtip'])                  # high showman brows (blockout heights), sharper outer flick
  decal(cv,ellipse_pts(0.02,0.012,0.104*sx,1.676),HEX['cheek'],alpha=.42)              # faint rosy cheek
 decal(cv,ellipse_pts(0.021,0.0065,0.0,1.651),'c99378',alpha=.5)                        # button-nose shadow
 up,lo=grin_curves();GW=GRIN_GW;MZ=GRIN_MZ
 xs=[GW*(-1+2*k/80) for k in range(81)]
 mouth_poly=[(x,up(x)) for x in xs]+[(x,lo(x)) for x in reversed(xs)]
 M=decal(cv,mouth_poly,HEX['mouth'])
 decal(cv,ellipse_pts(0.036,0.011,0.0,MZ-0.031),HEX['tongue'],clip=M)
 teeth=[]
 def tooth(pts):
  m=decal(cv,pts,HEX['teeth'],clip=M);teeth.append((pts,m))
 N=13;x0=-0.127;w=-2*x0/N
 for i in range(N):
  xa=x0+i*w;xb=xa+w;xm=(xa+xb)/2
  L=min(0.025*(1-0.5*(xm/GW)**2),0.50*(up(xm)-lo(xm)))
  tooth([(xa,up(xa)+0.004),(xb,up(xb)+0.004),(xm+0.1*w,up(xm)-L)])
 N=12;x0=-0.115;w=-2*x0/N
 for i in range(N):
  xa=x0+i*w;xb=xa+w;xm=(xa+xb)/2
  L=min(0.020*(1-0.5*(xm/GW)**2),0.42*(up(xm)-lo(xm)))
  tooth([(xa,lo(xa)-0.004),(xm-0.1*w,lo(xm)+L),(xb,lo(xb)-0.004)])
 for pts,m in teeth:
  cv.put(m&(poly_edge_dist(cv.X,cv.Z,pts)<0.0009),HEX['ink'],.7)
 stroke(cv,[(x,up(x)) for x in xs[::8]]+[(GW,up(GW))],[0.0024]*12,HEX['ink'])
 stroke(cv,[(x,lo(x)) for x in xs[::8]]+[(GW,lo(GW))],[0.0024]*12,HEX['ink'])
 for sx in (1,-1):
  stroke(cv,[(sx*GW,up(GW)),(sx*(GW+0.010),up(GW)+0.014),(sx*(GW+0.006),up(GW)+0.030)],[0.0026,0.0022,0.0011],HEX['ink'])
 return cv.down()

# ---------------- the jacket (lathe angle x height) ----------------
class JCanvas:
 def __init__(self,px,bg):
  self.n=px*SS;c=(np.arange(self.n)+.5)/self.n
  fx,fy=np.meshgrid(c,c)
  self.PHI=(fx-JACKET_PAD)/(1-2*JACKET_PAD)*math.tau
  z0,z1=JACKET_Z;self.Z=z1-fy*(z1-z0)
  ts=[p[0] for p in TP];rs=[p[1] for p in TP]
  R=np.interp(self.Z-z0,ts,rs)
  self.X=R*np.cos(self.PHI);self.Y=R*JACKET_EY*np.sin(self.PHI)
  self.img=np.empty((self.n,self.n,3));self.img[:]=rgb(bg)
 put=Canvas.put
 def down(self):
  n=self.n//SS;return self.img.reshape(n,SS,n,SS,3).mean(axis=(1,3))

def lapel_polys():
 K=18;out=[]
 for sx in (1,-1):
  inner=[];outer=[]
  for k in range(K+1):
   t=0.06+0.94*k/K;ix=0.072*(1-t)*sx;iz=1.47-0.345*t
   w=0.032+0.024*math.sin(math.pi*min(1.0,t*1.05))
   inner.append((ix,iz));outer.append((ix+sx*w*0.975,iz-w*0.22))
  out.append((sx,inner,outer))
 return out

def paint_jacket():
 cv=JCanvas(512,HEX['cream'])
 deg=np.degrees(cv.PHI)%360.0
 red=(np.floor((deg+7.5)/15.0).astype(int)%24)%2==0
 cv.put(red,HEX['red'])
 F=cv.Y>0;B=~F;X=cv.X;Z=cv.Z
 decal(cv,[(-0.072,1.47),(0.072,1.47),(0.0,1.125)],HEX['shirt'],clip=F,X=X,Z=Z,outline=.0012)
 for sx,inner,outer in lapel_polys():
  decal(cv,inner+outer[::-1],HEX['ink'],clip=F,X=X,Z=Z)
  stroke(cv,outer,[0.0034]*len(outer),HEX['brass_hi'],clip=F,X=X,Z=Z)                # brass piping on the lapel edge
 cut=[(0.085*(1-k/10)**0.7,0.806+0.149*k/10) for k in range(11)]
 decal(cv,[(-x,z) for x,z in cut[::-1]]+cut[1:],HEX['ink'],clip=F,X=X,Z=Z)          # rounded morning-coat cutaway
 stroke(cv,[(-0.165,1.272),(-0.126,1.272),(-0.087,1.272)],[0.0065,0.0065,0.0065],HEX['ink'],clip=F,X=X,Z=Z)   # pocket welt
 arch=[(0.067-0.017,1.315),(0.067+0.017,1.315)]+[(0.067+0.017*math.cos(math.radians(a)),1.335+0.017*math.sin(math.radians(a))) for a in range(0,181,20)]
 decal(cv,arch,HEX['brass_hi'],clip=F,X=X,Z=Z,outline=.0015,outline_alpha=.6)       # tiny cathedral-radio lapel pin
 decal(cv,ellipse_pts(0.008,0.008,0.067,1.332,n=16),HEX['ink'],clip=F,X=X,Z=Z)
 decal(cv,[(-0.095,0.982),(0.095,0.982),(0.095,1.018),(-0.095,1.018)],HEX['ink'],clip=B,X=X,Z=Z)   # back half-belt
 stroke(cv,[(0.0,0.80),(0.0,0.88),(0.0,0.965)],[0.0045,0.0045,0.0045],HEX['ink'],clip=B,X=X,Z=Z)  # centre vent
 cv.put(Z<0.807,HEX['ink'],.85)                                                     # hem edge
 return cv.down()

# ---------------- glowing iris (shared by both shells) ----------------
def paint_iris():
 n=256*SS;c=(np.arange(n)+.5)/n;fx,fy=np.meshgrid(c,c)
 qx=(fx-.5)*2*EYE_Q;qz=(.5-fy)*2*EYE_Q;rho=np.hypot(qx,qz)
 img=np.empty((n,n,3));img[:]=rgb('2a0f14')
 core=rho<1.0
 mix=np.clip(rho/0.8,0,1)[...,None]
 img[core]=(rgb('ff7a45')*(1-mix)+rgb('ff2a22')*mix)[core]
 ring=(rho>=0.80)&(rho<1.0);img[ring]=rgb('b3121a')
 img[rho<0.17]=rgb('12060a')                                   # pinprick pupil
 glint=np.hypot(qx+0.36,qz-0.40)<0.15;img[glint]=rgb('fff4e8')
 return img.reshape(256,SS,256,SS,3).mean(axis=(1,3))

# ---------------- mic capsule bands ----------------
def paint_mic():
 n=256*SS;c=(np.arange(n)+.5)/n;fx,fy=np.meshgrid(c,c)
 t=1-(fy-0.03)/0.94
 img=np.empty((n,n,3));img[:]=rgb(HEX['silver'])
 for a,b in MIC_BANDS:
  img[(t>=a)&(t<b)]=rgb(HEX['grille'])
 return img.reshape(256,SS,256,SS,3).mean(axis=(1,3))

def png(path,img):
 img=np.clip(np.round(img),0,255).astype(np.uint8)
 def chunk(name,data):return struct.pack('>I',len(data))+name+data+struct.pack('>I',zlib.crc32(name+data)&0xffffffff)
 raw=b''.join(b'\x00'+row.tobytes() for row in img)
 data=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',img.shape[1],img.shape[0],8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
 open(path,'wb').write(data)

def paint_atlas(path):
 A=np.empty((1024,1024,3));A[:]=rgb(HEX['skin'])
 A[0:512,0:512]=paint_face()
 A[512:1024,0:512]=paint_jacket()
 for i,name in enumerate(TILES):
  q=i%16;x=512+(q%4)*128;y=(q//4)*128+(512 if i>=16 else 0);A[y:y+128,x:x+128]=rgb(HEX[name])
 A[768:1024,512:768]=paint_iris()
 A[768:1024,768:1024]=paint_mic()
 png(path,A)
 return {'tiles':TILES,'glow_tiles':sorted(GLOW_TILES),'face_src':FACE_SRC,'jacket_z':JACKET_Z,'jacket_pad':JACKET_PAD,'iris_q':EYE_Q,'mic_bands':MIC_BANDS,
  'grin':{'half_width_m':GRIN_GW,'mid_z':GRIN_MZ,'sheet_half_width_m':0.118},'supersampling':SS}

if __name__=='__main__':
 import sys;print(paint_atlas(sys.argv[1] if len(sys.argv)>1 else 'pigment.png'))
