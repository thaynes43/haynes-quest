"""WO111 web-slinger-helper v001: rest skeleton, sheet-pose targets, defeat feet and the shared two-bone solver.

Imported by build.py (rest geometry, bones, the sheet-authored cuffs and the defeat rope tangle) and animate.py
(the acting). Pure mathutils; Blender +Z up / +Y forward, character right = +X. All numbers in metres.

Bind pose (per the sheet notes): head straight, arms in a relaxed A-pose (45 deg abduction, 40 deg forward elbow
bend) with open mittens, feet parallel. The sheet pose (head roll 6 deg toward the wave, right hand raised in a
palm-forward wave, left fist on the hip, toes turned out 8 / 15 deg) is recreated at idle 0 s. The cuffs, heart
buttons, nozzles and the right mitten are authored at the blockout's sheet coordinates along the sheet IK chain and
carried into the rest pose by the forearm frame, so the idle 0 s solve returns them exactly to the sheet.
"""
import math
from mathutils import Vector, Matrix, Euler

def V(*a):return Vector(a)

# ---------------- blockout head (rest: tilt zeroed; the sheet tilt is recreated in idle) ----------------
HC=V(0.0,0.0,0.99);HRAD=V(0.185,0.178,0.195)                 # cobalt hood ellipsoid
HOLE_AX=0.128;HOLE_AZ=0.138;HOLE_ZC=0.960                      # open-face hole (front projection)
FC=V(0.0,0.028,0.972);FR=V(0.155,0.155,0.162)                 # face ellipsoid inside the hood
HEAD_PIVOT=V(0.0,0.0,0.815);SHEET_HEAD_ROLL=math.radians(6.0) # the blockout pivot rotation_euler = (0, 6 deg, 0)

def face_pt(x,z):
 q=max(1e-6,1-((x-FC.x)/FR.x)**2-((z-FC.z)/FR.z)**2);y=FC.y+FR.y*math.sqrt(q)
 n=V((x-FC.x)/FR.x**2,(y-FC.y)/FR.y**2,(z-FC.z)/FR.z**2).normalized()
 return V(x,y,z),n
def hood_pt(theta,phi,s=1.0):
 return HC+V(HRAD.x*math.sin(theta)*math.sin(phi)*s,HRAD.y*math.sin(theta)*math.cos(phi)*s,HRAD.z*math.cos(theta)*s)
def hole_top(x):return HOLE_ZC+HOLE_AZ*math.sqrt(max(0.0,1-(x/HOLE_AX)**2))
def in_hole(p,grow=1.0):return p.y>HC.y and (p.x/(HOLE_AX*grow))**2+((p.z-HOLE_ZC)/(HOLE_AZ*grow))**2<1

# ---------------- torso (the blockout lathe) ----------------
TORSO_EY=0.74
TORSO_PROF=[(0.395,0.03),(0.405,0.075),(0.425,0.115),(0.46,0.14),(0.52,0.150),(0.60,0.148),(0.67,0.150),
 (0.72,0.152),(0.75,0.142),(0.775,0.118),(0.795,0.08),(0.808,0.03)]
def interp(profile,z):
 if z<=profile[0][0]:return profile[0][1]
 for (z0,r0),(z1,r1) in zip(profile,profile[1:]):
  if z0<=z<=z1:return r0+(r1-r0)*(z-z0)/(z1-z0)
 return profile[-1][1]
def smooth_profile(profile,step=0.004):
 t0,t1=profile[0][0],profile[-1][0];n=max(8,int((t1-t0)/step))
 ts=[t0+(t1-t0)*i/n for i in range(n+1)];rs=[interp(profile,t) for t in ts]
 for _ in range(3):rs=[rs[0]]+[(rs[i-1]+2*rs[i]+rs[i+1])/4 for i in range(1,len(rs)-1)]+[rs[-1]]
 return list(zip(ts,rs))
TP=smooth_profile(TORSO_PROF)
def torso_r(z):return interp(TP,z)
def torso_pt(a,z):
 r=torso_r(z);x=r*math.cos(a);y=TORSO_EY*r*math.sin(a)
 dr=(torso_r(z+0.002)-torso_r(z-0.002))/0.004
 n=V(x/r**2,y/(TORSO_EY**2*r**2),-dr/r).normalized()
 return V(x,y,z),n
_ARC=[(0.0,0.0)]
for _i in range(1,1600):
 _t=math.pi*_i/1599
 _ARC.append((_t,_ARC[-1][1]+math.sqrt(math.cos(_t)**2+(TORSO_EY*math.sin(_t))**2)*math.pi/1599))
def arc_to_angle(s):
 lo,hi=0,len(_ARC)-1
 if s>=_ARC[-1][1]:return _ARC[-1][0]
 while hi-lo>1:
  mid=(lo+hi)//2
  if _ARC[mid][1]<s:lo=mid
  else:hi=mid
 (t0,s0),(t1,s1)=_ARC[lo],_ARC[hi]
 return t0+(t1-t0)*(s-s0)/max(1e-12,s1-s0)
def torso_map(front=True):
 """(u, v) -> torso surface: u is arc length toward the character's right (+X), v is height z (blockout)."""
 def f(u,v):
  t=arc_to_angle(abs(u)/torso_r(v))*(1 if u>=0 else -1)
  a=(math.pi/2-t) if front else (-math.pi/2+t)
  return torso_pt(a,v)
 return f
STAR_Z=0.655;STAR_TILT=math.radians(10);BELT=(0.452,0.492)

# ---------------- two-bone helpers (from the WO111 rival-mayor / demon-band-idol rigs) ----------------
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
def frame(y_axis,z_hint,origin=(0,0,0)):
 """World matrix whose local +Y is y_axis and local +Z is as close to z_hint as possible."""
 Y=Vector(y_axis).normalized();Z=Vector(z_hint);Z=(Z-Z.dot(Y)*Y).normalized();X=Y.cross(Z)
 M=Matrix((X,Y,Z)).transposed().to_4x4();M.translation=Vector(origin);return M

# ---------------- arms ----------------
SHOULDER_Z=0.742;SHOULDER_X=0.16
L_UP=0.18;L_FORE=0.14
ABD=math.radians(45);BEND=math.radians(40)
ARM={}
for s,sx in (('R',1),('L',-1)):
 S=V(SHOULDER_X*sx,0,SHOULDER_Z);du=V(math.sin(ABD)*sx,0,-math.cos(ABD))
 df=du*math.cos(BEND)+V(0,1,0)*math.sin(BEND)
 E=S+du*L_UP;W=E+df*L_FORE;ARM[s]=(S,E,W)
# blockout sheet chains: wrists (IK targets) and elbows (pole directions)
SHEET_WRIST={'R':V(0.327,0.024,1.0),'L':V(-0.2,0.008,0.545)}
SHEET_ELBOW_BLOCKOUT={'R':V(0.296,0.012,0.862),'L':V(-0.292,-0.03,0.625)}
SHEET_POLE={s:pole_of(ARM[s][0],SHEET_ELBOW_BLOCKOUT[s],SHEET_WRIST[s]) for s in 'RL'}
SHEET_CHAIN={}
for s in 'RL':
 S=ARM[s][0];E,W=solve_two(S,SHEET_WRIST[s],L_UP,L_FORE,SHEET_POLE[s]);SHEET_CHAIN[s]=(S,E,W)
REST_POLE={s:pole_of(*ARM[s]) for s in 'RL'}
# rigid map from sheet-authored forearm/hand geometry to the rest pose
FORE_MAP={s:forearm_frame(*ARM[s])@forearm_frame(*SHEET_CHAIN[s]).inverted() for s in 'RL'}
SHEET_T={s:(SHEET_CHAIN[s][2]-SHEET_CHAIN[s][1]).normalized() for s in 'RL'}
# web-shooter button directions from the blockout (right: the waving palm; left: out and forward)
BUTTON_DIR={'R':V(0.55,1.0,0.0),'L':V(-0.75,0.66,0.1)}
# the waving right mitten frame at the sheet (blockout: frame(palm, T + (0.08,0,0), W + T*0.058)), origin at the wrist
PALM_R=V(0.55,1.0,0.0)
MH_SHEET=frame(PALM_R,SHEET_T['R']+V(0.08,0,0),SHEET_WRIST['R'])
# rest hand frames: the right one carried by the forearm map, the left one its mirror image across x = 0
MIRROR=Matrix.Diagonal((-1,1,1,1))
HAND_REST={'R':FORE_MAP['R']@MH_SHEET}
HAND_REST['L']=MIRROR@HAND_REST['R']@MIRROR      # an improper-free mirror: columns stay right-handed after the double flip
MITTEN_C=0.058;MITTEN_S=(0.048,0.030,0.066)
KNUCKLE=V(0.0,0.012,0.066)                        # hand-local fingers pivot (palm side, mid mitten)
THUMB_BASE=V(-0.036,0.004,0.030);THUMB_DIR=V(-0.75,0.0,0.66).normalized()
THUMB_C=V(-0.0585,0.0,0.0445);THUMB_S=(0.017,0.017,0.032)
def hand_matrix(s):
 """Placement of right-hand-local geometry: the right rest frame, or its mirror image for the left (det -1)."""
 return HAND_REST['R'].copy() if s=='R' else MIRROR@HAND_REST['R']
def hand_world(s,q):
 """Right-hand-local point q (mitten along +Z, palm +Y, thumb toward -X) -> world rest point for side s."""
 return hand_matrix(s)@Vector(q)
def hand_axis(s,d):
 return (hand_matrix(s).to_3x3()@Vector(d)).normalized()

# ---------------- legs and feet ----------------
LEG={}
ANKLE_Z=0.095
for s,sx in (('R',1),('L',-1)):
 LEG[s]=(V(0.084*sx,0.0,0.47),V(0.096*sx,0.012,0.285),V(0.104*sx,0.0,ANKLE_Z))
SOLE_LIFT=0.003                                   # 3 mm sole clearance so interpolated frames never dip below the floor
FOOT_FWD=0.036
SHEET_FOOT_YAW={'R':math.radians(-8),'L':math.radians(15)}

# ---------------- coil ----------------
CLIP_P,CLIP_N=torso_pt(-0.16,0.472)
COIL_A=V(1.0,0.62,0.0).normalized();COIL_C=CLIP_P+CLIP_N*0.070+V(0,0,-0.046)   # 4.2 cm further out than the blockout: clear of the thigh
COIL_HEAD=CLIP_P+CLIP_N*0.017

# ---------------- defeat: the final seated feet (world), used by build.py for the rope tangle ----------------
# Seated plop: both boots in front, heels on the floor, toes up. The right foot is carried rigidly by the left one
# from the trip onward, so one rope bone on the left foot can bind both ankles. The ankle heights come from the
# lowest point of each pitched boot (sole and foot ellipsoids, shaft rim) plus 3 mm floor clearance.
DEFEAT_FOOT_PITCH=math.radians(55)                # about world +X: positive lifts the toes (heels down, shafts along the shins)
DEFEAT_FOOT_YAW={'L':0.0,'R':0.0}                 # parallel shafts, so one loop can wrap both at a constant height
def defeat_foot_rot(s):return Matrix.Rotation(DEFEAT_FOOT_YAW[s],3,'Z')@Matrix.Rotation(DEFEAT_FOOT_PITCH,3,'X')
def boot_lowest(R):
 """Lowest z (relative to the ankle) of the rotated boot: ellipsoid support along -Z plus the shaft's bottom rim."""
 A=LEG['R'][2];low=0.0
 for c,sz in (((A.x,A.y+FOOT_FWD,0.02+SOLE_LIFT),(0.064,0.104,0.02)),((A.x,A.y+FOOT_FWD,0.052+SOLE_LIFT),(0.06,0.098,0.052))):
  cc=R@(V(*c)-A);d=R.transposed()@V(0,0,-1)
  low=min(low,cc.z-math.sqrt((sz[0]*d.x)**2+(sz[1]*d.y)**2+(sz[2]*d.z)**2))
 for k in range(24):
  a=math.tau*k/24;q=R@(V(A.x+0.058*math.cos(a),A.y+0.058*math.sin(a),0.035+SOLE_LIFT)-A);low=min(low,q.z)
 return low
DEFEAT_ANKLE={}
for _s,_x,_y in (('L',-0.088,0.300),('R',0.088,0.300)):
 DEFEAT_ANKLE[_s]=V(_x,_y,0.003-boot_lowest(defeat_foot_rot(_s)))
ROPE_HEAD=V(-0.104,0.022,0.058)                   # inside the left boot foot: the tangle binds collapsed here
ROPE_REST_SCALE=0.01

def rest_bones(fringe_root,fringe_tip,eyes,hearts):
 """name -> (head, tail, parent) in the world rest pose."""
 R={'root':((0,0,0),(0,0,.1),None),'hips':((0,0,.47),(0,0,.53),'root'),'spine':((0,0,.53),(0,0,.64),'hips'),
  'chest':((0,0,.64),(0,0,.765),'spine'),'neck':((0,-.005,.765),tuple(HEAD_PIVOT),'chest'),'head':(tuple(HEAD_PIVOT),(0,0,1.10),'neck'),
  'fringe':(tuple(fringe_root),tuple(fringe_tip),'head'),'mask':(tuple(FC),tuple(FC+V(0,0.12,0)),'head'),
  'coil':(tuple(COIL_HEAD),tuple(COIL_HEAD+V(0,0,-0.07)),'hips'),'rope':(tuple(ROPE_HEAD),tuple(ROPE_HEAD+V(0,0,0.04)),'foot_L')}
 for s in 'RL':
  c,up=eyes[s];R['eye_'+s]=(tuple(c),tuple(c+up*0.04),'head')
  S,E,W=ARM[s]
  R['upper_arm_'+s]=(tuple(S),tuple(E),'chest');R['forearm_'+s]=(tuple(E),tuple(W),'upper_arm_'+s)
  R['hand_'+s]=(tuple(W),tuple(hand_world(s,V(0,0,0.07))),'forearm_'+s)
  R['fingers_'+s]=(tuple(hand_world(s,KNUCKLE)),tuple(hand_world(s,V(0,0.006,0.118))),'hand_'+s)
  R['thumb_'+s]=(tuple(hand_world(s,THUMB_BASE)),tuple(hand_world(s,THUMB_BASE+THUMB_DIR*0.05)),'hand_'+s)
  hc,hn=hearts[s];R['heart_'+s]=(tuple(hc),tuple(hc+hn*0.02),'forearm_'+s)
  H,K,A=LEG[s];R['thigh_'+s]=(tuple(H),tuple(K),'hips');R['shin_'+s]=(tuple(K),tuple(A),'thigh_'+s)
  R['foot_'+s]=(tuple(A),tuple(A+V(0,0.12,-0.06)),'shin_'+s)
 return R
