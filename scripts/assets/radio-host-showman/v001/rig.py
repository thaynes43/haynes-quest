"""WO111 radio-host-showman v001: rest skeleton, sheet-pose targets and the shared two-bone solver.

Imported by build.py (to place the rest geometry and bones) and animate.py (to rebuild the approved
sheet pose at idle 0 s). Pure mathutils; Blender +Z up / +Y forward, right = +X.

Bind pose (per the sheet notes, "rebuild the arms in a rig-friendly A-pose"): head straight (the
blockout's 4 deg roll toward the mic is recreated in idle), both arms in the same relaxed A-pose.
The sheet's right arm already hangs in that A-pose with the fist round the planted mic cane, so the
right arm, fist and cane are authored exactly at the blockout coordinates and the bind pose keeps the
cane planted. The left arm binds as the mirror of the right; its open waving glove is authored at the
blockout's sheet coordinates and carried into the rest pose by the forearm frame of the sheet IK
solution, so the idle 0 s solve returns it exactly to the blockout wave. Legs and the 12 deg toe-out
are the same in rest and sheet pose.
"""
import math
from mathutils import Vector, Matrix, Euler

def V(*a):return Vector(a)

# ---- head: the blockout head group (head-local coordinates) scaled 1.08 about the neck pivot
PIVOT=V(0,0,1.49);HEAD_SCALE=1.08
HR=Matrix.Translation(PIVOT)@Matrix.Scale(HEAD_SCALE,4)@Matrix.Translation(-PIVOT)
SHEET_HEAD_ROT=(0.0,math.radians(4.0),0.0)      # the blockout pivot's rotation_euler (XYZ): tilt toward the mic
HEAD_Z0=1.50;HEAD_Y0=0.012;HEAD_EY=0.90
HEAD=[(0.0,0.0),(0.012,0.05),(0.035,0.095),(0.07,0.13),(0.12,0.153),(0.18,0.161),(0.24,0.158),(0.29,0.142),(0.33,0.112),(0.36,0.07),(0.38,0.0)]
EYE_X=0.057;EYE_Z=1.738
IRIS={'R':V(0.055,0,1.734),'L':V(-0.055,0,1.734)}   # glowing iris shell centres (head-local x, z): a slight inward stare

# ---- two-bone helpers (from the demon-band-idol / rival-mayor v001 rig)
def solve_two(a,target,l1,l2,pole):
 delta=target-a;dist=min(max(delta.length,1e-5),(l1+l2)*.9995);d=delta.normalized()
 side=Vector(pole)-d*d.dot(Vector(pole))
 if side.length<1e-5:side=Vector((0,1,0))-d*d.y
 side.normalize();along=(l1*l1-l2*l2+dist*dist)/(2*dist)
 return a+d*along+side*math.sqrt(max(0,l1*l1-along*along)),a+d*dist
def basis(a,n):
 a=a.normalized();n=(n-a*a.dot(n)).normalized();return Matrix((a,n,a.cross(n))).transposed()
def pole_of(S,E,W):
 line=(W-S).normalized();return ((E-S)-line*(E-S).dot(line)).normalized()
def forearm_frame(S,E,W):
 """World matrix at the wrist: x along the forearm, y the bend-plane normal."""
 M=basis(W-E,(E-S).cross(W-E)).to_4x4();M.translation=W;return M

# ---- arms (blockout sleeve paths: right hangs to the cane grip, left rises to the wave)
L_UP=0.265;L_FORE=0.215
SHOULDER={'R':V(0.17,0,1.40),'L':V(-0.17,0,1.40)}
BLK_WRIST={'R':V(0.445,0.125,1.068),'L':V(-0.503,0.095,1.412)}
BLK_ELBOW={'R':V(0.345,0.045,1.20),'L':V(-0.38,0.032,1.25)}
ARM={}
S=SHOULDER['R'];E,W=solve_two(S,BLK_WRIST['R'],L_UP,L_FORE,pole_of(S,BLK_ELBOW['R'],BLK_WRIST['R']))
ARM['R']=(S.copy(),E,W)
mirror=lambda p:V(-p.x,p.y,p.z)
ARM['L']=(mirror(ARM['R'][0]),mirror(ARM['R'][1]),mirror(ARM['R'][2]))
SHEET_WRIST={'R':ARM['R'][2].copy(),'L':BLK_WRIST['L'].copy()}
SHEET_POLE={'R':pole_of(*ARM['R']),'L':pole_of(SHOULDER['L'],BLK_ELBOW['L'],BLK_WRIST['L'])}
SHEET_CHAIN={'R':ARM['R']}
E,W=solve_two(SHOULDER['L'],SHEET_WRIST['L'],L_UP,L_FORE,SHEET_POLE['L']);SHEET_CHAIN['L']=(SHOULDER['L'].copy(),E,W)
REST_POLE={s:pole_of(*ARM[s]) for s in 'RL'}
# rigid map from sheet-authored hand geometry to the rest pose (identity for the right: rest = sheet)
HAND_MAP={s:forearm_frame(*ARM[s])@forearm_frame(*SHEET_CHAIN[s]).inverted() for s in 'RL'}
BLK_WAVE_PREV=V(-0.465,0.07,1.315)   # the blockout's last sleeve point before the wave wrist (palm frame)

# ---- mic cane (blockout coordinates; the fist grips it at 1.03 m)
CANE_P0=V(0.530,0.190,0.003);CANE_P1=V(0.455,0.130,1.400)   # tip 3 mm off the floor (blockout 1.4 mm) for clearance
CANE_D=(CANE_P1-CANE_P0).normalized()
GRIP=CANE_P0+CANE_D*((1.03-CANE_P0.z)/CANE_D.z)
MS=1.35
MIC_C=CANE_P1+CANE_D*0.118*MS          # capsule centre
BULB=MIC_C+CANE_D*0.089*MS
BURST_REST_SCALE=0.04                  # static burst binds collapsed inside the capsule; the bone scales it by 25 at contact

# ---- legs and feet
FOOT_Z=0.003                           # 3 mm sole clearance so interpolated frames never dip below the floor
TOE_OUT=math.radians(12)
ANKLE_LOCAL=V(0,-0.012,0.100)
FOOT={'R':(V(0.112,0.035,FOOT_Z),-TOE_OUT),'L':(V(-0.112,0.035,FOOT_Z),TOE_OUT)}
def ankle_of(loc,yaw):return loc+Matrix.Rotation(yaw,3,'Z')@ANKLE_LOCAL
LEG={}
for s,sx in (('R',1),('L',-1)):
 H=V(0.085*sx,0.0,0.92);A=ankle_of(*FOOT[s]);K=V((H.x+A.x)/2,0.030,0.515);LEG[s]=(H,K,A)

# ---- hair tufts (head-local, from the blockout: right tuft full size, left 0.86)
def tuft_root(sx):return V(0.04*sx,-0.045-0.01*(sx<0),1.866)
TUFT_K={'R':1.0,'L':0.86}
TUFT_STRANDS=[('main',[(0,0,0),(0.012,-0.012,0.05),(0.035,-0.035,0.085),(0.062,-0.056,0.094)],[0.021,0.018,0.012,0.005]),
 ('back',[(-0.01,-0.008,0.0),(0.0,-0.03,0.046),(0.01,-0.066,0.066),(0.022,-0.094,0.062)],[0.019,0.016,0.01,0.0045]),
 ('flick',[(0.018,0.006,-0.004),(0.04,0.002,0.03),(0.068,-0.012,0.046)],[0.015,0.011,0.004])]
def tuft_pts(s,rel):
 sx=1 if s=='R' else -1;k=TUFT_K[s];R=tuft_root(sx);return [R+V(x*sx,y,z)*k for x,y,z in rel]

# ---- static halo behind the head (head-local), bow tie knot (world)
HALO_C=V(0,-0.205,1.712);HALO_R=0.238

def rest_bones(bowtie_knot):
 """name -> (head, tail, parent) in the world rest pose."""
 R={'root':((0,0,0),(0,0,.1),None),'hips':((0,0,.92),(0,0,1.05),'root'),'spine':((0,0,1.05),(0,0,1.22),'hips'),
  'chest':((0,0,1.22),(0,0,1.43),'spine'),'neck':((0,.004,1.43),tuple(PIVOT),'chest'),'head':(tuple(PIVOT),(0,0,1.86),'neck'),
  'halo':(tuple(HR@HALO_C),tuple(HR@(HALO_C+V(0,-0.08,0))),'head'),
  'bowtie':(tuple(bowtie_knot),tuple(bowtie_knot+V(0,0.06,0)),'chest')}
 for s,sx in (('R',1),('L',-1)):
  c=HR@V(IRIS[s].x,head_y(IRIS[s].x,IRIS[s].z),IRIS[s].z);R['eye_'+s]=(tuple(c),tuple(c+V(0,0.04,0)),'head')
  main=tuft_pts(s,TUFT_STRANDS[0][1])
  R['tuft_%s_1'%s]=(tuple(HR@main[0]),tuple(HR@main[2]),'head');R['tuft_%s_2'%s]=(tuple(HR@main[2]),tuple(HR@main[3]),'tuft_%s_1'%s)
  S,E,W=ARM[s];fd=(W-E).normalized()
  R['upper_arm_'+s]=(tuple(S),tuple(E),'chest');R['forearm_'+s]=(tuple(E),tuple(W),'upper_arm_'+s)
  R['hand_'+s]=(tuple(W),tuple(W+fd*0.07),'forearm_'+s)
  H,K,A=LEG[s];R['thigh_'+s]=(tuple(H),tuple(K),'hips');R['shin_'+s]=(tuple(K),tuple(A),'thigh_'+s)
  loc,yaw=FOOT[s];R['foot_'+s]=(tuple(A),tuple(loc+Matrix.Rotation(yaw,3,'Z')@V(0,0.16,0.03)),'shin_'+s)
 R['cane']=(tuple(GRIP),tuple(MIC_C),'hand_R')
 R['burst']=(tuple(MIC_C),tuple(MIC_C+CANE_D*0.1),'cane')
 return R

# ---- analytic head surface (head-local), shared with paint.py's maths
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
HP=smooth_profile(HEAD)
def head_r(z):return interp(HP,z-HEAD_Z0) if HEAD_Z0<=z<=HEAD_Z0+0.38 else 0.0
def head_y(x,z):return HEAD_Y0+HEAD_EY*math.sqrt(max(head_r(z)**2-x*x,0.0))
def head_inside(p):
 r=head_r(p.z);return r>0 and p.x*p.x+((p.y-HEAD_Y0)/HEAD_EY)**2<r*r
def head_hit(origin,d):
 """First point where the ray from origin (inside the head) along d leaves the analytic head (bisection)."""
 lo=0.0;hi=0.5
 for _ in range(48):
  mid=(lo+hi)/2
  if head_inside(origin+d*mid):lo=mid
  else:hi=mid
 return origin+d*lo
