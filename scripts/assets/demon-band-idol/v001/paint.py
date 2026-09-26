"""WO111 demon-band-idol v001: the original 1024 painted atlas, generated with numpy.

Three kinds of atlas area (see common.py for the UV side):
* the face region (top-left 512 px): the approved blockout's face decals, painted in
  head-local front projection. Every decal is tested exactly the way the blockout built
  it: a 2-D outline around a centre, projected along a direction onto the head (the
  analytic lathe surface for the tilted blush stars), and NURBS lash/brow/wink lines;
* the jacket-front region (bottom-left 512 px): the white shirt V, gold lapel piping
  and three gold buttons, at the blockout's projected positions;
* 128 px flat tiles holding the sheet colours (top-right quadrant) plus skin fill.
Thin plum outlines stand in for the sheet's Freestyle ink around raised decals.
Supersampled 3x and box-filtered; written as an RGB PNG with zlib (no external image tools).
"""
import math, struct, zlib
import numpy as np

HEX={'skin':'c9b6f0','skinlo':'ad97e0','hair':'2c2a5a','pink':'ec4f93','blush':'ff8fc0','gold':'f4c75b','jacket':'1f7a86',
 'trouser':'2a2446','white':'f7f3fb','silver':'cfd3e6','mouth':'4a2548','eye':'fbf8ff','iris':'c2479a',
 'gold_d':'d6a441','jacket_d':'17656f','pink_d':'c93b7a'}
# Flat tile order (common.tile_uv index).
TILES=['skin','skinlo','hair','pink','blush','gold','jacket','trouser','white','silver','mouth','eye','iris','gold_d','jacket_d','pink_d']
T={name:i for i,name in enumerate(TILES)}
INK='2c2a5a'
FACE_SRC=(-0.16,0.16,0.955,1.275)
JACKET_SRC=(-0.185,0.185,0.58,0.95)
SS=3

def rgb(h):return np.array([int(h[i:i+2],16) for i in (0,2,4)],dtype=np.float64)

# ---------------- geometry helpers (same maths as the blockout / common.py) ----------------
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
HEAD=[(0.0,0.0),(0.012,0.042),(0.035,0.078),(0.07,0.108),(0.11,0.126),(0.15,0.131),(0.19,0.127),(0.23,0.108),(0.26,0.072),(0.28,0.0)]
HEAD_Z0=0.975;HEAD_Y0=0.012;HEAD_EY=0.94
HP=smooth_profile(HEAD)
def head_y(X,Z):
 t=np.clip(Z-HEAD_Z0,HP[0][0],HP[-1][0]);r=np.interp(t,[p[0] for p in HP],[p[1] for p in HP])
 return HEAD_Y0+HEAD_EY*np.sqrt(np.maximum(r*r-X*X,0.0))

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

def star_pts(r_out,r_in,n=5,rot=0.0):
 return [(r_out if k%2==0 else r_in)*np.array([math.cos(math.pi/2+rot+math.pi*k/n),math.sin(math.pi/2+rot+math.pi*k/n)]) for k in range(2*n)]
def sparkle_pts(r,e=3.0,samples=48):
 out=[]
 for k in range(samples):
  t=math.tau*k/samples;c=math.cos(t);s=math.sin(t);out.append((r*math.copysign(abs(c)**e,c),r*math.copysign(abs(s)**e,s)))
 return out
def ellipse_pts(rx,rz,cx=0.0,cz=0.0,n=48):
 return [(cx+rx*math.cos(math.tau*k/n),cz+rz*math.sin(math.tau*k/n)) for k in range(n)]

# ---------------- canvas ----------------
class Canvas:
 """Supersampled region canvas; world x/z of each supersample and an RGB buffer."""
 def __init__(self,px,src,bg):
  self.n=px*SS;x0,x1,z0,z1=src
  c=(np.arange(self.n)+.5)/self.n
  self.X,self.Z=np.meshgrid(x0+c*(x1-x0),z1-c*(z1-z0))
  self.img=np.empty((self.n,self.n,3));self.img[:]=rgb(bg);self.src=src
 def put(self,mask,color,alpha=1.0):
  self.img[mask]=self.img[mask]*(1-alpha)+rgb(color)*alpha
 def down(self):
  n=self.n//SS;return self.img.reshape(n,SS,n,SS,3).mean(axis=(1,3))

def inside(A,B,poly):
 """Even-odd point-in-polygon on arrays A,B for outline poly [(a,b)]."""
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

def decal(cv,poly,center,color,D=(0,-1,0),outline=0.0,outline_color=INK,outline_alpha=.85,surface=None):
 """Blockout decal(): outline (a,b) around `center` projected along D; a/b measured on the surface point."""
 D=np.array(D,dtype=np.float64);D/=np.linalg.norm(D);R=np.array([1.0,0,0]);R-=R.dot(D)*D;R/=np.linalg.norm(R)
 U=np.array([0,0,1.0]);U=U-U.dot(D)*D-U.dot(R)*R;U/=np.linalg.norm(U);C=np.array(center,dtype=np.float64)
 if abs(D[1]+1)<1e-9:
  A=cv.X-C[0];B=cv.Z-C[2]
 else:
  Y=surface(cv.X,cv.Z);A=(cv.X-C[0])*R[0]+(Y-C[1])*R[1]+(cv.Z-C[2])*R[2];B=(cv.X-C[0])*U[0]+(Y-C[1])*U[1]+(cv.Z-C[2])*U[2]
 m=inside(A,B,poly)
 cv.put(m,color)
 if outline>0:
  cv.put(m&(poly_edge_dist(A,B,poly)<outline),outline_color,outline_alpha)
 return m

def stroke(cv,pts,radii,color,samples=48,alpha=1.0):
 """Blockout surf_line(): a NURBS tube through projected points (front view width = 2 radius)."""
 P=bspline(pts,samples);R=bspline([(r,0) for r in radii],samples)[:,0]
 m=np.zeros(cv.X.shape,dtype=bool)
 for i in range(len(P)-1):
  dd,t=seg_dist(cv.X,cv.Z,P[i],P[i+1]);m|=dd<(R[i]+(R[i+1]-R[i])*t)
 cv.put(m,color,alpha);return m

def rot(pts,ang):
 return [(x*math.cos(ang)-z*math.sin(ang),x*math.sin(ang)+z*math.cos(ang)) for x,z in pts]

# ---------------- the face (blockout coordinates, head-local before the head transform) ----------------
def paint_face():
 cv=Canvas(512,FACE_SRC,HEX['skin'])
 EL=(-0.052,1.098);ER=(0.052,1.098);O=.0011
 decal(cv,ellipse_pts(0.03,0.038),(EL[0],0.2,EL[1]),HEX['eye'],outline=O)
 decal(cv,ellipse_pts(0.02,0.028),(EL[0]+0.002,0.2,EL[1]-0.004),HEX['iris'],outline=.0008,outline_alpha=.55)
 # a softer inner ring gives the iris the sheet's two-tone read
 decal(cv,ellipse_pts(0.0145,0.0205),(EL[0]+0.0025,0.2,EL[1]-0.005),'d8609f')
 decal(cv,ellipse_pts(0.011,0.016),(EL[0]+0.003,0.2,EL[1]-0.006),HEX['hair'])
 decal(cv,sparkle_pts(0.011,e=2.0),(EL[0]-0.006,0.2,EL[1]+0.008),HEX['eye'],outline=.0007,outline_alpha=.5)
 decal(cv,ellipse_pts(0.0042,0.0042,n=24),(EL[0]+0.01,0.2,EL[1]-0.016),HEX['eye'])
 lash=[(EL[0]+0.03*math.cos(a),EL[1]+0.038*math.sin(a)+0.001) for a in [math.radians(d) for d in (-5,25,55,90,125,160,185)]]
 stroke(cv,lash,[0.0035,0.005,0.006,0.006,0.006,0.0055,0.0045],HEX['hair'])
 stroke(cv,[(EL[0]-0.027,EL[1]+0.008),(EL[0]-0.036,EL[1]+0.016),(EL[0]-0.041,EL[1]+0.025)],[0.005,0.0035,0.002],HEX['hair'])
 stroke(cv,[(ER[0]-0.027,ER[1]-0.008),(ER[0]-0.013,ER[1]+0.007),(ER[0],ER[1]+0.012),(ER[0]+0.014,ER[1]+0.007),(ER[0]+0.027,ER[1]-0.008)],[0.004,0.0058,0.0062,0.0058,0.004],HEX['hair'])
 for dx,dz in ((0.009,0.01),(0.012,-0.001)):
  stroke(cv,[(ER[0]+0.025,ER[1]-0.005+dz*0.3),(ER[0]+0.025+dx,ER[1]+dz)],[0.0035,0.002],HEX['hair'])
 stroke(cv,[(-0.08,1.146),(-0.062,1.16),(-0.04,1.163),(-0.025,1.155)],[0.004,0.0065,0.006,0.004],HEX['hair'])
 stroke(cv,[(0.028,1.145),(0.048,1.152),(0.07,1.148),(0.082,1.14)],[0.004,0.006,0.0055,0.0035],HEX['hair'])
 ang=math.radians(9);mouth=[(0.026*math.cos(math.pi+math.pi*k/24),0.019*math.sin(math.pi+math.pi*k/24)) for k in range(25)]+[(0.012,0.0),(-0.012,0.0)]
 MC=(0.012,0.2,1.035)
 decal(cv,rot(mouth,ang),MC,HEX['mouth'],outline=O)
 decal(cv,rot(ellipse_pts(0.014,0.0075,cx=0.004,cz=-0.011),ang),MC,HEX['blush'],outline=.0006,outline_alpha=.35)
 decal(cv,rot([(-0.023,-0.001),(0.023,-0.001),(0.021,-0.006),(-0.021,-0.006)],ang),MC,HEX['white'],outline=.0006,outline_alpha=.4)
 for sx in (1,-1):
  decal(cv,star_pts(0.021,0.0095,rot=math.radians(-8*sx)),(0.084*sx,0.1,1.058),HEX['blush'],D=(-0.45*sx,-0.89,0),outline=.0009,outline_alpha=.55,surface=head_y)
 # button nose (ellipsoid 0.009 x 0.007 at the ray hit through x=0, z=1.07) with a soft lower shade
 decal(cv,ellipse_pts(0.009,0.007),(0.0,0.2,1.07),HEX['skinlo'],outline=.0008,outline_alpha=.55)
 decal(cv,ellipse_pts(0.0035,0.0022),(-0.003,0.2,1.0725),'c3b0ee')
 return cv.down()

# ---------------- the jacket front (world rest coordinates) ----------------
def paint_jacket():
 cv=Canvas(512,JACKET_SRC,HEX['jacket'])
 decal(cv,[(-0.044,0.034),(0.044,0.034),(0.0,-0.05)],(0,0.2,0.89),HEX['white'],outline=.0012)
 for sx in (1,-1):
  stroke(cv,[(0.046*sx,0.92),(0.026*sx,0.884),(0.0,0.834)],[0.0065,0.0065,0.0065],HEX['gold'])
 for z in (0.75,0.70,0.65):
  decal(cv,ellipse_pts(0.011,0.011),(0.062,0.2,z),HEX['gold'],outline=.0012,outline_alpha=.7)
  decal(cv,ellipse_pts(0.0035,0.0035),(0.059,0.2,z+0.004),'fbe7a8')
 return cv.down()

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
  x=512+(i%4)*128;y=(i//4)*128;A[y:y+128,x:x+128]=rgb(HEX[name])
 png(path,A)
 return {'tiles':TILES,'face_src':FACE_SRC,'jacket_src':JACKET_SRC,'supersampling':SS}
