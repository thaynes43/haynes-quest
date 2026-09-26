"""WO111 demon-band-idol v001: rest skeleton, sheet-pose targets and the shared two-bone solver.

Imported by build.py (to place the rest geometry and bones) and animate.py (to rebuild the
approved sheet pose at idle 0 s). Pure mathutils; Blender +Z up / +Y forward, right = +X.

Bind pose (per the sheet notes): head straight, arms in a relaxed A-pose (50 deg abduction,
40 deg forward elbow bend) with the mic in the right fist, both feet forward. The sheet pose
(head roll 6 deg / yaw -5 deg, mic by the chin, left fist on the hip, left foot turned out) is
recreated in idle. The fists and mic are authored at the blockout's sheet coordinates and
carried into the rest pose by the forearm frame of the sheet IK solution, so the idle solve
returns them exactly to the blockout positions.
"""
import math
from mathutils import Vector, Matrix, Euler

def V(*a):return Vector(a)

# ---- head: the blockout head group hangs from a pivot at the neck (roll/yaw zeroed for rest, scale + drop kept)
PIVOT_BLOCKOUT=V(0,0,0.975);HEAD_DROP=0.012;HEAD_SCALE=1.08
HEAD_PIVOT=V(0,0,0.975-HEAD_DROP)
HR=Matrix.Translation(HEAD_PIVOT)@Matrix.Scale(HEAD_SCALE,4)@Matrix.Translation(-PIVOT_BLOCKOUT)
SHEET_HEAD_ROT=(0.0,math.radians(6.0),math.radians(-5.0))   # the blockout pivot's rotation_euler (XYZ)

# ---- two-bone helpers (from the rival-mayor v001 animate.py)
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

# ---- arms
L_UP=0.20;L_FORE=0.165
ABD=math.radians(50);BEND=math.radians(40)
ARM={}
for s,sx in (('R',1),('L',-1)):
 S=V(0.150*sx,0,0.870);du=V(math.sin(ABD)*sx,0,-math.cos(ABD))
 df=du*math.cos(BEND)+V(0,1,0)*math.sin(BEND)
 E=S+du*L_UP;W=E+df*L_FORE;ARM[s]=(S,E,W)
# blockout sheet chains (wrist targets and elbow directions)
SHEET_WRIST={'R':V(0.23,0.152,0.862),'L':V(-0.158,0.004,0.625)}
SHEET_ELBOW_BLOCKOUT={'R':V(0.283,0.05,0.745),'L':V(-0.298,-0.02,0.72)}
SHEET_POLE={s:pole_of(ARM[s][0],SHEET_ELBOW_BLOCKOUT[s],SHEET_WRIST[s]) for s in 'RL'}
SHEET_CHAIN={}
for s in 'RL':
 S=ARM[s][0];E,W=solve_two(S,SHEET_WRIST[s],L_UP,L_FORE,SHEET_POLE[s]);SHEET_CHAIN[s]=(S,E,W)
REST_POLE={s:pole_of(*ARM[s]) for s in 'RL'}
# rigid map from sheet-authored hand geometry (fists, mic) to the rest pose
HAND_MAP={s:forearm_frame(*ARM[s])@forearm_frame(*SHEET_CHAIN[s]).inverted() for s in 'RL'}

# ---- mic (sheet coordinates from the blockout)
MIC_A=V(0.227,0.168,0.83);MIC_B=V(0.22,0.184,0.955);MIC_DIR=(MIC_B-MIC_A).normalized()
MIC_G=MIC_B+MIC_DIR*0.034
FIST_R=V(0.226,0.17,0.885);CHARM_END=V(0.239,0.17,0.762)
FIST_L=V(-0.14,0.006,0.622)
BURST_REST_SCALE=0.04          # burst sparkles bind collapsed inside the grille; the bone scales them by 25 at contact

# ---- legs and feet
LEG_X_TOP=0.072;KNEE_Z=0.335;KNEE_Y=0.035   # 3.5 cm forward knee bend: the sheet's splayed left foot stays in reach
FOOT_Z=0.003                   # 3 mm sole clearance so interpolated frames never dip below the floor
ANKLE_LOCAL=V(0,-0.012,0.105)
REST_FOOT={'R':(V(0.088,0.022,FOOT_Z),0.0),'L':(V(-0.088,0.022,FOOT_Z),0.0)}
SHEET_FOOT={'R':(V(0.088,0.022,FOOT_Z),math.radians(-8)),'L':(V(-0.122,0.040,FOOT_Z),math.radians(22))}
def ankle_of(loc,yaw):return loc+Matrix.Rotation(yaw,3,'Z')@ANKLE_LOCAL
LEG={}
for s,sx in (('R',1),('L',-1)):
 H=V(LEG_X_TOP*sx,0,0.575);A=ankle_of(*REST_FOOT[s]);K=V(0.080*sx,KNEE_Y,KNEE_Z);LEG[s]=(H,K,A)

# ---- tail (blockout path, thickened 20% for play-distance read)
TAIL_PTS=[(0.0,-0.07,0.605),(0.04,-0.15,0.53),(0.10,-0.215,0.50),(0.148,-0.25,0.545),(0.162,-0.255,0.615)]
TAIL_R=[0.023,0.019,0.017,0.0145,0.013]
FRINGE_MAIN=[(-0.075,-0.01,1.262),(-0.03,0.07,1.265),(0.03,0.12,1.228),(0.085,0.128,1.178),(0.12,0.1,1.142),(0.137,0.062,1.13),(0.143,0.024,1.138)]
SWALLOW={s:[(0.058*sx,-0.072,0.64),(0.068*sx,-0.092,0.57),(0.078*sx,-0.102,0.50),(0.085*sx,-0.106,0.445)] for s,sx in (('R',1),('L',-1))}
EPAULETTE={s:V(0.152*sx,0,0.905) for s,sx in (('R',1),('L',-1))}
EAR_DIR={s:V(0.86*sx,-0.22,0.46).normalized() for s,sx in (('R',1),('L',-1))}
EAR_BASE={s:V(0.112*sx,-0.004,1.098) for s,sx in (('R',1),('L',-1))}

def rest_bones(tail_path,bow_paths):
 """name -> (head, tail, parent) in the world rest pose."""
 R={'root':((0,0,0),(0,0,.1),None),'hips':((0,0,.58),(0,0,.68),'root'),'spine':((0,0,.68),(0,0,.79),'hips'),
  'chest':((0,0,.79),(0,0,.915),'spine'),'neck':((0,.004,.915),tuple(HEAD_PIVOT),'chest'),'head':(tuple(HEAD_PIVOT),(0,0,1.26),'neck'),
  'fringe_1':(tuple(HR@V(*FRINGE_MAIN[1])),tuple(HR@V(*FRINGE_MAIN[3])),'head'),
  'fringe_2':(tuple(HR@V(*FRINGE_MAIN[3])),tuple(HR@V(*FRINGE_MAIN[6])),'fringe_1'),
  'earring':(tuple(HR@V(-0.13,0.004,1.078)),tuple(HR@V(-0.134,0.006,1.04)),'head')}
 for s in 'RL':
  R['ear_'+s]=(tuple(HR@EAR_BASE[s]),tuple(HR@(EAR_BASE[s]+EAR_DIR[s]*0.09)),'head')
  S,E,W=ARM[s];fd=(W-E).normalized()
  R['upper_arm_'+s]=(tuple(S),tuple(E),'chest');R['forearm_'+s]=(tuple(E),tuple(W),'upper_arm_'+s)
  R['hand_'+s]=(tuple(W),tuple(W+fd*0.06),'forearm_'+s)
  e=EPAULETTE[s];R['sparkle_'+s]=(tuple(e+V(0,0,0.03)),tuple(e+V(0,0,0.10)),'chest')
  H,K,A=LEG[s];R['thigh_'+s]=(tuple(H),tuple(K),'hips');R['shin_'+s]=(tuple(K),tuple(A),'thigh_'+s)
  R['foot_'+s]=(tuple(A),tuple(A+V(0,0.12,-0.06)),'shin_'+s)
  sw=SWALLOW[s];R['coat_'+s]=(sw[0],sw[-1],'hips')
 M=HAND_MAP['R']
 R['mic']=(tuple(M@FIST_R),tuple(M@MIC_G),'hand_R')
 R['charm']=(tuple(M@MIC_A),tuple(M@CHARM_END),'mic')
 R['burst']=(tuple(M@MIC_G),tuple(M@(MIC_G+MIC_DIR*0.08)),'mic')
 # tail chain: four bones on arc-length quarters of the rest tail path
 acc=[0.0]
 for a,b in zip(tail_path,tail_path[1:]):acc.append(acc[-1]+(b-a).length)
 def at(s):
  for i in range(len(acc)-1):
   if acc[i]<=s<=acc[i+1]:
    f=(s-acc[i])/max(acc[i+1]-acc[i],1e-9);return tail_path[i].lerp(tail_path[i+1],f)
  return tail_path[-1]
 L=acc[-1];prev='hips'
 for k in range(4):
  R['tail_%d'%(k+1)]=(tuple(at(L*k/4)),tuple(at(L*(k+1)/4)),prev);prev='tail_%d'%(k+1)
 for k,(a,b) in enumerate(bow_paths):R['bow_%d'%(k+1)]=(tuple(a),tuple(b),'hips')
 return R,acc
