"""WO111 web-slinger-helper acting, baked at 30 fps into exactly five NLA clips (the friendly clip contract).

The runtime friendly scene (src/game/friendly-scene.ts) loops `idle`, plays `hit` for 0.6 s when the friend loses
health and holds the end of `defeat` until Make amends; the WO099/WO111 contract still needs all five clips.

idle   3.0 s loop  the approved sheet pose at 0 s (right hand up in a palm-forward wave, left fist on the hip, head
                   tilted into the wave, toes out); bouncy weight shift, four big waves, head bob, fringe bounce,
                   heart buttons pulsing, one blink; doubles as the greeting
move   1.0 s loop  skippy kid jog in place: knees up, loose fists pumping, coil bouncing on the hip, hood bobbing
attack 2.0 s       the helping "heal toss" (a friendly never hits the player): spots you and points while the heart
                   buttons blink; crouches, cocks the arm beside his hood and taps the cuff heart ("charging up");
                   overhand "thwip!" toss with the mitten open at a child's chest height at the 1.25 s contact; fist
                   pump with a hop and back into the sheet pose by 2.0 s
hit    0.6 s       sheepish "ow!" flinch: mittens up by the hood, eyes squeezed shut, a hop back on one foot, the
                   hood bouncing; ends exactly on the sheet pose (the runtime switches straight back to idle 0 s)
defeat 2.0 s       cartoon plop, no gore: the coil unspools and the rope wraps both ankles, he topples back and sits
                   down with a bump, mask askew and head tilted, sheepish squint, rubbing the back of his hood;
                   held from 1.6 s

Arms and legs are two-bone IK chains solved in the armature's rest space with bend-plane frames (adapted from the
WO111 demon-band-idol / rival-mayor animate.py). The bind pose is neutral (rig.py); idle at 0 s reproduces the sheet
pose exactly (asserted below against the blockout wrists, ankles and the sheet-authored heart buttons). No root
motion: the root bone is never keyed and the hips carry every translation.
"""
import bpy, math, json, hashlib, importlib.util
from pathlib import Path
from mathutils import Vector, Matrix, Euler, Quaternion
ROOT=Path('/workspace/haynes-quest/family-eras/web-slinger-helper/v001')
spec=importlib.util.spec_from_file_location('wo111_wsh_rig',ROOT/'source/rig.py');RG=importlib.util.module_from_spec(spec);spec.loader.exec_module(RG)
FPS=30
arm=bpy.data.objects['Web_Slinger_Helper_Rig'];skin=bpy.data.objects['Web_Slinger_Helper_Skin'];bones=arm.data.bones
CLIPS=[('idle',3.0,True),('move',1.0,True),('attack',2.0,False),('hit',.6,False),('defeat',2.0,False)]
CONTACT=.625;DEFEAT_HOLD=.8
SCALED={'eye_R','eye_L','heart_R','heart_L','coil','rope'}
def V(*a):return Vector(a)
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
def bell(t,c,w):return smooth(1-abs(t-c)/w)
def keyed(t,keys):
 """Smoothstep between (time, value) keys; values are floats or 3-tuples."""
 if t<=keys[0][0]:a=keys[0][1];return Vector(a) if isinstance(a,(tuple,list,Vector)) else a
 for (a,x),(b,y) in zip(keys,keys[1:]):
  if t<=b:
   s=smooth((t-a)/(b-a)) if b>a else 1
   return Vector(x).lerp(Vector(y),s) if isinstance(x,(tuple,list,Vector)) else x+(y-x)*s
 a=keys[-1][1];return Vector(a) if isinstance(a,(tuple,list,Vector)) else a

RESTM={b.name:b.matrix_local.copy() for b in bones}
def rot3(m):return m.to_3x3().normalized()
def head_of(n):return RESTM[n].translation.copy()
def tail_of(n):return bones[n].tail_local.copy()
ARM={s:(head_of('upper_arm_'+s),head_of('forearm_'+s),head_of('hand_'+s)) for s in 'RL'}
LEG={s:(head_of('thigh_'+s),head_of('shin_'+s),head_of('foot_'+s)) for s in 'RL'}
LEN={s:((ARM[s][1]-ARM[s][0]).length,(ARM[s][2]-ARM[s][1]).length,(LEG[s][1]-LEG[s][0]).length,(LEG[s][2]-LEG[s][1]).length) for s in 'RL'}
POLE_LEG0={s:RG.pole_of(*LEG[s]) for s in 'RL'}
HAND3={s:RG.hand_matrix(s).to_3x3() for s in 'RL'}          # right: proper frame; left: its mirror (det -1)
def hand_dir(s,d):return (HAND3[s]@Vector(d)).normalized()
CURL_AXIS={s:hand_dir(s,(0,0,1)).cross(hand_dir(s,(0,1,0))).normalized() for s in 'RL'}   # +angle folds fingers to the palm
THUMB_AXIS={s:hand_dir(s,RG.THUMB_DIR).cross(hand_dir(s,(0,1,0))).normalized() for s in 'RL'}
def R3(rot):
 if rot is None:return Matrix.Identity(3)
 if isinstance(rot,Matrix):return rot
 return Euler(rot).to_matrix()
def E(x=0,y=0,z=0):return Euler((x,y,z)).to_matrix()
def mul(*ms):
 out=Matrix.Identity(3)
 for m in ms:
  if m is not None:out=out@R3(m)
 return out
def about(axis,angle):return Matrix.Rotation(angle,3,Vector(axis).normalized())
def frame_rot(a0,n0,a1,n1):return RG.basis(a1,n1)@RG.basis(a0,n0).transposed()
def hand_target(s,z_dir,palm_dir):
 """World delta that turns the rest hand so its fingers point along z_dir with the palm facing palm_dir."""
 Z=Vector(z_dir).normalized();Y=Vector(palm_dir);Y=(Y-Y.dot(Z)*Z).normalized()
 Zr=hand_dir(s,(0,0,1));Yr=hand_dir(s,(0,1,0));Yr=(Yr-Yr.dot(Zr)*Zr).normalized()
 return Matrix((Z,Y,Z.cross(Y))).transposed()@Matrix((Zr,Yr,Zr.cross(Yr)))

class Pose:
 def __init__(self):self.M={}
 def delta(self,n):return rot3(self.M[n])@rot3(RESTM[n]).inverted()
 def point(self,n,p):return self.M[n]@RESTM[n].inverted()@Vector(p)
 def put(self,n,head,R,scale=None):
  M=Matrix.Translation(head)@R.to_4x4()
  if scale is not None:
   sv=Vector(scale) if isinstance(scale,(tuple,list,Vector)) else Vector((scale,scale,scale))
   M=M@Matrix.Diagonal((sv.x,sv.y,sv.z,1))
  self.M[n]=M
 def follow(self,n,rot=None,shift=None,local_rot=None,scale=None):
  b=bones[n];rest=RESTM[n]
  if b.parent:D=self.delta(b.parent.name);head=self.point(b.parent.name,rest.translation)
  else:D=Matrix.Identity(3);head=rest.translation.copy()
  if shift is not None:head=head+Vector(shift)
  R=D@R3(rot)@rot3(rest)
  if local_rot is not None:R=R@R3(local_rot)
  self.put(n,head,R,scale)
 def chain(self,up,fore,S0,E0,W0,S,target,pole,l1,l2):
  E_,W=RG.solve_two(S,target,l1,l2,pole)
  n0=(E0-S0).cross(W0-E0);n1=(E_-S).cross(W-E_)
  if n1.length<1e-6:n1=n0
  self.put(up,S,frame_rot(E0-S0,n0,E_-S,n1)@rot3(RESTM[up]))
  self.put(fore,E_,frame_rot(W0-E0,n0,W-E_,n1)@rot3(RESTM[fore]))
  return E_,W

FIST=2.0;THUMB_FIST=0.9
FLOOR=RG.SOLE_LIFT-1e-9           # lowest boot point never below the rest sole clearance (3 mm)
def sheet_controls():
 """Controls whose solve is the approved sheet pose."""
 c={'hips_shift':V(0,0,0),'hips_rot':None,'spine_rot':None,'chest_rot':None,'neck_rot':None,'head_rot':about((0,1,0),RG.SHEET_HEAD_ROLL),
  'fringe':None,'mask':0.0,'eyes':1.0,'eye_R':1.0,'eye_L':1.0,'coil':None,'coil_scale':1.0,'rope':1.0,
  'wrist_R':RG.SHEET_WRIST['R'].copy(),'wrist_R_frame':'chest','wrist_R_blend':[],'pole_R':RG.SHEET_POLE['R'].copy(),
  'wrist_L':RG.SHEET_WRIST['L'].copy(),'wrist_L_frame':'hips','wrist_L_blend':[],'pole_L':RG.SHEET_POLE['L'].copy(),
  'hand_R_rot':None,'hand_R_blend':[],'hand_L_rot':None,'hand_L_blend':[],'wrist_R_offset':None,'wrist_L_offset':None,
  'fingers_R':0.0,'fingers_L':FIST,'thumb_R':0.0,'thumb_L':THUMB_FIST,'heart_R':1.0,'heart_L':1.0,'left_follows_right_heart':0.0}
 for s in 'RL':
  c['ankle_'+s]=LEG[s][2].copy();c['foot_'+s+'_rot']=Matrix.Rotation(RG.SHEET_FOOT_YAW[s],3,'Z');c['pole_leg_'+s]=POLE_LEG0[s].copy()
 c['right_foot_on_left']=None
 return c

def rest_controls():
 c=sheet_controls();c['head_rot']=None;c['fingers_L']=0.0;c['thumb_L']=0.0
 for s in 'RL':
  c['wrist_'+s]=ARM[s][2].copy();c['pole_'+s]=RG.REST_POLE[s].copy();c['wrist_%s_frame'%s]='chest';c['foot_'+s+'_rot']=None
 return c

def arm_chain(P,c,s,Dc):
 """Wrist target: a point in a bone's rest frame, then blended toward further (frame, point, weight) targets
 ('world' = absolute). Hand: follows the forearm, then slerps toward (frame, fingers_dir, palm_dir, weight) goals
 whose directions are given in that bone's rest frame (turned by its current delta)."""
 l1,l2,_,_=LEN[s];S0,E0,W0=ARM[s]
 target=P.point(c['wrist_%s_frame'%s],c['wrist_'+s])
 for frame,point,w in c['wrist_%s_blend'%s]:
  if w>0:target=target.lerp(Vector(point) if frame=='world' else P.point(frame,point),w)
 if c['wrist_%s_offset'%s] is not None:target=target+Dc@Vector(c['wrist_%s_offset'%s])   # detours in the chest frame
 P.chain('upper_arm_'+s,'forearm_'+s,S0,E0,W0,P.point('chest',S0),target,Dc@c['pole_'+s],l1,l2)
 W=P.point('forearm_'+s,W0);RH=P.delta('forearm_'+s)@R3(c['hand_%s_rot'%s])
 for frame,zd,pd,w in c['hand_%s_blend'%s]:
  if w<=0:continue
  D=Matrix.Identity(3) if frame=='world' else P.delta(frame)
  q=RH.to_quaternion();qt=hand_target(s,D@Vector(zd),D@Vector(pd)).to_quaternion()
  if q.dot(qt)<0:qt.negate()
  RH=q.slerp(qt,min(1.0,w)).to_matrix()
 P.put('hand_'+s,W,RH@rot3(RESTM['hand_'+s]))
 P.follow('fingers_'+s,about(CURL_AXIS[s],c['fingers_'+s]))
 P.follow('thumb_'+s,about(THUMB_AXIS[s],c['thumb_'+s]))
 P.follow('heart_'+s,scale=c['heart_'+s])

def build_pose(c):
 P=Pose()
 P.put('root',head_of('root'),rot3(RESTM['root']))
 P.put('hips',head_of('hips')+c['hips_shift'],R3(c['hips_rot'])@rot3(RESTM['hips']))
 P.follow('spine',c['spine_rot']);P.follow('chest',c['chest_rot']);P.follow('neck',c['neck_rot']);P.follow('head',c['head_rot'])
 P.follow('fringe',c['fringe']);P.follow('mask',about(RG.V(0,1,0),c['mask']))
 for s in 'RL':P.follow('eye_'+s,scale=V(1,c['eyes']*c['eye_'+s],1))
 P.follow('coil',c['coil'],scale=c['coil_scale'])
 Dc=P.delta('chest')
 arm_chain(P,c,'R',Dc)
 if c['left_follows_right_heart']>0:
  # the left mitten reaches for the right cuff's heart button (the attack's "charging up" tap)
  hp=P.point('heart_R',head_of('heart_R'));hn=(P.delta('heart_R')@(tail_of('heart_R')-head_of('heart_R'))).normalized()
  goal=hp+hn*(0.035+c.get('tap',0.0));S=P.point('chest',ARM['L'][0]);d=(goal-S).normalized()
  c['wrist_L_blend']=c['wrist_L_blend']+[('world',goal-d*0.118,c['left_follows_right_heart'])]
 arm_chain(P,c,'L',Dc)
 # feet: targets and world rotations first; the right boot may ride rigidly on the left one (rope-bound ankles)
 tgt={s:Vector(c['ankle_'+s]) for s in 'LR'};rot={s:R3(c['foot_'+s+'_rot']) for s in 'LR'}
 if c['right_foot_on_left'] is not None:
  w,REL_T_,REL_R_=c['right_foot_on_left'];DL=rot['L']
  tgt['R']=tgt['R'].lerp(tgt['L']+DL@REL_T_,w)
  qa=rot['R'].to_quaternion();qb=(DL@REL_R_).to_quaternion()
  if qa.dot(qb)<0:qb.negate()
  rot['R']=qa.slerp(qb,w).to_matrix()
  # floor safety for the pair: lift both by the larger deficit so the relation stays exact
  lift=max(0.0,max(FLOOR-RG.boot_lowest(rot[s])-tgt[s].z for s in 'LR'))
  for s in 'LR':tgt[s].z+=lift
 else:
  for s in 'LR':tgt[s].z=max(tgt[s].z,FLOOR-RG.boot_lowest(rot[s]))
 for s in ('L','R'):
  H0,K0,A0=LEG[s];_,_,t1,t2=LEN[s]
  P.chain('thigh_'+s,'shin_'+s,H0,K0,A0,P.point('hips',H0),tgt[s],c['pole_leg_'+s],t1,t2)
  A=P.point('shin_'+s,A0);P.put('foot_'+s,A,rot[s]@rot3(RESTM['foot_'+s]))
 P.follow('rope',scale=c['rope'])
 return P

# ---------------- acting ----------------
UP=V(0,0,1);FWD=V(0,1,0)
WR0=RG.SHEET_WRIST['R'];WL0=RG.SHEET_WRIST['L']
HR0=about((0,1,0),RG.SHEET_HEAD_ROLL)
FR_OUT=V(0.3,0.5,0.8).normalized()
def fringe_rot(a):
 d=(tail_of('fringe')-head_of('fringe')).normalized();ax=d.cross(FR_OUT)
 return about(ax,a) if ax.length>1e-6 else None
# defeat: the right foot relative to the left one in the held seated pose (rest-space delta form)
AL_REST=LEG['L'][2];AR_REST=LEG['R'][2]
DL_F=RG.defeat_foot_rot('L');DR_F=RG.defeat_foot_rot('R')
REL_T=DL_F.inverted()@(RG.DEFEAT_ANKLE['R']-RG.DEFEAT_ANKLE['L'])
REL_R=DL_F.inverted()@DR_F
def jog_pole(s):return V(0.2*(1 if s=='R' else -1),-1.0,-0.35).normalized()

def evaluate(clip,t):
 c=sheet_controls();tau=math.tau*t
 if clip=='idle':
  bounce=.5-.5*math.cos(3*tau);sway=math.sin(tau)
  c['hips_shift']=V(.008*sway,0,-.012*bounce)
  c['hips_rot']=E(0,-.025*sway,0)
  c['spine_rot']=E(.012*bounce,.02*sway,0);c['chest_rot']=E(0,.02*sway,.015*math.sin(2*tau))
  c['head_rot']=mul(E(-.03*bounce,-.02*sway,.025*math.sin(2*tau)),HR0)
  wave=math.sin(4*tau)
  # the wave swings outward from the sheet pose (never in toward the hood)
  c['wrist_R']=WR0+V(.02*wave+.035*(.5-.5*math.cos(4*tau)),.012*math.sin(8*tau),-.012*(.5-.5*math.cos(8*tau)))
  c['hand_R_rot']=about(FWD,.22*wave+.10*(.5-.5*math.cos(4*tau)))
  c['fingers_R']=.08*(.5-.5*math.cos(8*tau))
  c['wrist_L']=WL0+V(0,0,.005*math.sin(3*tau))
  c['fringe']=fringe_rot(.10*bounce+.05*(.5-.5*math.cos(6*tau)))
  pulse=lambda x:max(0.0,math.sin(math.tau*2*x))**6
  c['heart_R']=1+.16*pulse(t);c['heart_L']=1+.16*pulse(t-.04)
  c['eyes']=1-.9*bell(t,.72,.035)
  c['coil']=E(.05*math.sin(3*tau),0,.06*sway)
 elif clip=='move':
  ph=tau;bounce=.5-.5*math.cos(2*ph)
  c['hips_shift']=V(.008*math.sin(ph),.01,-.035+.03*bounce)
  c['hips_rot']=E(-.04,0,.10*math.sin(ph))
  c['spine_rot']=E(.10,0,-.05*math.sin(ph));c['chest_rot']=E(.02,0,-.08*math.sin(ph))
  c['head_rot']=mul(E(-.10+.04*math.sin(2*ph),0,.05*math.sin(ph)),HR0)
  for s,off in (('R',0.0),('L',math.pi)):
   p=ph+off;lift=.075*max(0.0,-math.sin(p));x=LEG[s][2].x
   c['ankle_'+s]=V(x,.02+.085*math.cos(p),RG.ANKLE_Z+lift)
   c['foot_'+s+'_rot']=about(V(1,0,0),.35*max(0.0,-math.sin(p))*max(0.0,math.cos(p)+.3))
   c['pole_leg_'+s]=V(0,1,.15).normalized()
  for s,sx,off in (('R',1,math.pi),('L',-1,0.0)):
   p=ph+off;c['wrist_%s_frame'%s]='chest'
   c['wrist_'+s]=V(.235*sx,.08+.10*math.cos(p),.62+.035*math.cos(p)+.02*bounce)
   c['pole_'+s]=jog_pole(s)
   c['fingers_'+s]=1.6;c['thumb_'+s]=.8
   c['hand_%s_blend'%s]=[('chest',V(.15*sx,.75,.3),V(-sx,0,.3),.6)]
  c['fringe']=fringe_rot(.14*bounce+.05)
  c['coil']=E(.22*math.sin(2*ph-.8),0,.18*math.sin(ph-.6))
 elif clip=='attack':
  point=keyed(t,[(0,0),(.12,1),(.22,1),(.30,0),(1,0)])
  charge=keyed(t,[(0,0),(.22,0),(.32,1),(.47,1),(.53,0),(1,0)])
  wind=keyed(t,[(0,0),(.47,0),(.535,1),(.565,1),(CONTACT,0),(1,0)])
  throw=keyed(t,[(0,0),(.555,0),(CONTACT,1),(.70,1),(.80,0),(1,0)])
  follow=keyed(t,[(0,0),(.62,0),(.72,1),(.78,1),(.84,0),(1,0)])
  pump=keyed(t,[(0,0),(.76,0),(.84,1),(.90,1),(1,0)])
  crouch=keyed(t,[(0,0),(.25,0),(.36,1),(.50,1),(.58,-.25),(.66,0),(.80,0),(.86,-.9),(.92,.2),(1,0)])
  twist=keyed(t,[(0,0),(.30,0),(.46,-.4),(.55,-1),(.62,.8),(.72,.5),(.82,0),(1,0)])
  step=keyed(t,[(0,0),(.46,0),(.58,1),(.80,1),(.92,0),(1,0)]);lift=bell(t,.52,.06)
  hop=bell(t,.87,.05)
  c['hips_shift']=V(0,.03*throw-.02*charge+.02*step,-.06*crouch+.045*hop)
  c['hips_rot']=E(0,0,.10*twist)
  c['spine_rot']=E(.10*charge+.08*throw,0,.12*twist);c['chest_rot']=E(-.03*charge+.08*throw-.06*wind,0,.14*twist)
  c['head_rot']=mul(E(-.08*point+.10*charge-.05*throw-.10*pump,0,-.10*twist),HR0)
  # right arm: wave -> point -> "charging" fist in front of the chest -> wind-up behind the shoulder -> overhand
  # toss -> follow-through -> fist pump -> wave
  POINT=V(.19,.33,.86);CHARGE=V(.15,.25,.72);WIND=V(.31,-.08,.93);TOSS=V(.13,.37,.83);FOLLOW=V(.16,.28,.62);PUMP=V(.29,.08,1.02)
  w=WR0.lerp(POINT,point);w=w.lerp(CHARGE,charge);w=w.lerp(WIND,wind);w=w.lerp(TOSS,throw);w=w.lerp(FOLLOW,follow);w=w.lerp(PUMP,pump)
  c['wrist_R']=w
  c['wrist_R_offset']=V(.07,0,0)*bell(t,.50,.045)+V(.07,-.02,0)*bell(t,.59,.045)
  p=RG.SHEET_POLE['R'].lerp(V(.6,-.2,-.8).normalized(),charge);p=p.lerp(V(1,-.3,.4).normalized(),wind);p=p.lerp(V(.8,-.3,-.5).normalized(),min(1.0,throw+follow))
  c['pole_R']=p.normalized()
  c['hand_R_blend']=[('world',V(.12,1,.05),V(-1,0,.1),point),('world',V(.15,-.3,.94),V(0,1,.3),wind),('world',V(.05,.55,.83),V(0,.83,-.55),throw),('world',V(.1,.6,-.5),V(-.3,.4,.6),follow*.7)]
  c['fingers_R']=1.6*charge+1.7*pump-.05*throw;c['thumb_R']=.8*charge+.9*pump
  # the heart buttons blink while he points, then pulse as he taps them, and flash at the toss
  c['heart_R']=1+.35*point*abs(math.sin(math.tau*6.4*t))+.30*charge*abs(math.sin(math.tau*4.4*(t-.34)))+.25*bell(t,CONTACT,.05)
  c['heart_L']=1+.25*point*abs(math.sin(math.tau*6.4*t+.6))
  # left mitten leaves the hip to tap the right cuff's heart twice, swings back for the toss
  c['left_follows_right_heart']=charge
  c['tap']=-.018*(math.sin(math.pi*(t-.36)/.06)**2) if .36<t<.48 else 0.0
  c['fingers_L']=FIST*(1-charge)+.1*charge;c['thumb_L']=THUMB_FIST*(1-charge)
  c['wrist_L']=WL0+V(-.05,-.12,.06)*throw+V(-.03,-.05,.10)*follow
  c['pole_L']=RG.SHEET_POLE['L'].lerp(V(-1,-.3,-.3).normalized(),charge).normalized()
  c['eyes']=1-.25*charge+.10*bell(t,CONTACT,.05)
  locL=LEG['L'][2];c['ankle_L']=V(locL.x+.01*step,locL.y+.08*step,RG.ANKLE_Z+.04*lift+.035*hop)
  locR=LEG['R'][2];c['ankle_R']=V(locR.x,locR.y,RG.ANKLE_Z+.035*hop)
  c['fringe']=fringe_rot(.10*charge+.25*throw+.30*hop)
  c['coil']=E(-.35*throw+.25*hop,0,.2*twist)
 elif clip=='hit':
  flinch=keyed(t,[(0,0),(.12,1),(.55,1),(.85,0),(1,0)])
  hop=keyed(t,[(0,0),(.10,0),(.35,1),(.62,1),(.88,0),(1,0)])
  up=bell(t,.33,.14)
  squeeze=keyed(t,[(0,0),(.08,1),(.62,1),(.82,0),(1,0)])
  osc=math.sin(math.tau*3*t)*(1-t)**2*keyed(t,[(0,0),(.05,1),(1,1)])
  c['hips_shift']=V(0,-.05*hop,.03*up-.02*flinch)
  c['hips_rot']=E(.08*flinch,0,.05*hop)
  c['spine_rot']=E(.12*flinch,0,0);c['chest_rot']=E(.10*flinch+.05*osc,0,0)
  c['head_rot']=mul(E(-.18*flinch+.20*osc,0,.10*osc),HR0)
  for s,sx in (('R',1),('L',-1)):
   # both mittens up beside the hood, palms out
   c['wrist_%s_blend'%s]=[('chest',V(.275*sx,.10,.97),flinch)]
   c['hand_%s_blend'%s]=[('chest',V(.15*sx,.1,1),V(0,1,0),flinch)]
   c['pole_'+s]=c['pole_'+s].lerp(V(sx,-.4,-.4).normalized(),flinch).normalized()
  c['fingers_L']=FIST*(1-flinch)+.2*flinch;c['thumb_L']=THUMB_FIST*(1-flinch)
  c['eyes']=1-.88*squeeze
  locL=LEG['L'][2];c['ankle_L']=V(locL.x-.01*hop,locL.y-.03*hop,RG.ANKLE_Z+.11*hop)
  c['pole_leg_L']=POLE_LEG0['L'].lerp(V(0,1,.3).normalized(),hop).normalized()
  locR=LEG['R'][2];c['ankle_R']=V(locR.x,locR.y-.04*hop,RG.ANKLE_Z+.035*up)
  c['foot_L_rot']=mul(c['foot_L_rot'],about(V(1,0,0),.35*hop))
  c['fringe']=fringe_rot(.25*flinch+.15*max(0.0,osc))
  c['coil']=E(.25*osc,-.30*flinch,.30*osc)
  c['heart_R']=1-.1*flinch;c['heart_L']=1-.1*flinch
 elif clip=='defeat':
  trip=keyed(t,[(0,0),(.10,0),(.26,1),(1,1)])
  fall=keyed(t,[(0,0),(.14,0),(.42,1),(1,1)])
  bump=keyed(t,[(0,0),(.40,0),(.46,1),(.53,-.35),(.60,.12),(.66,0),(1,0)])
  flail=keyed(t,[(0,0),(.04,0),(.14,1),(.36,1),(.48,0),(1,0)])
  settle=keyed(t,[(0,0),(.40,0),(.58,1),(1,1)])
  rub=math.sin(math.tau*(t-.56)/.08)*bell(t,.66,.10) if .56<t<.76 else 0.0
  wob=math.sin(math.tau*3*t)*bell(t,.25,.2)
  unspool=keyed(t,[(0,0),(.05,0),(.20,1),(1,1)])
  wrap=keyed(t,[(0,0),(.42,0),(.47,1),(1,1)])   # springs round both ankles as he lands (feet already at rest)
  # hips: topple back and down onto the seat, bounce once, settle
  c['hips_shift']=V(.015*wob,-.03*fall,-.35*fall+.035*bump-.012*trip*(1-fall))
  c['hips_rot']=E(.22*fall-.05*bump+.06*trip*(1-fall),0,.04*wob)
  c['spine_rot']=E(-.12*fall+.06*bump,.03*wob,0);c['chest_rot']=E(-.06*fall+.08*bump,.04*wob,0)
  c['neck_rot']=E(-.05*settle,0,0)
  c['head_rot']=mul(E(-.10*settle+.12*bump,0,.10*wob),about((0,1,0),RG.SHEET_HEAD_ROLL*(1-settle)+math.radians(15)*settle))
  c['mask']=math.radians(-13)*settle+.15*wob
  c['eyes']=1-.35*flail-.22*settle
  c['fringe']=fringe_rot(.35*flail+.20*bump+.10*settle)
  c['coil']=E(.6*unspool*(1-settle)+.3*settle,0,.4*wob);c['coil_scale']=1-.45*unspool
  c['rope']=1+(1/RG.ROPE_REST_SCALE-1)*wrap
  # feet: the right boot snaps against the left one (the rope binds both ankles), then both slide out front
  c['ankle_L']=LEG['L'][2].lerp(RG.DEFEAT_ANKLE['L'],fall)+V(0,0,.05*bell(t,.24,.12))
  c['foot_L_rot']=Matrix.Rotation(RG.SHEET_FOOT_YAW['L'],3,'Z').to_quaternion().slerp(DL_F.to_quaternion(),fall).to_matrix()
  for s in 'LR':c['pole_leg_'+s]=POLE_LEG0[s].lerp(V(0,.4,1).normalized(),fall).normalized()
  c['right_foot_on_left']=(trip,REL_T,REL_R)
  # arms: windmill up as he topples; then the left mitten lands on the floor beside him and the right one
  # rubs the back of his hood
  c['wrist_R_blend']=[('chest',V(.30,.02,1.08),flail),('head',RG.HC+V(.215,-.07+.012*rub,-.01+.012*rub),settle)]
  c['hand_R_blend']=[('head',V(-.15,-.5,.85),V(-1,0,0),settle)]
  c['pole_R']=RG.SHEET_POLE['R'].lerp(V(1,-.3,.1).normalized(),settle).normalized()
  c['wrist_R_offset']=V(.09,0,0)*bell(t,.46,.07);c['wrist_L_offset']=V(-.09,0,.04)*bell(t,.46,.07)
  c['wrist_L_blend']=[('chest',V(-.30,.06,1.02),flail*(1-settle)),('world',V(-.27,.02,.13),settle)]
  c['hand_L_blend']=[('world',V(-.35,.25,-.9),V(.3,0,-1),settle)]
  c['pole_L']=RG.SHEET_POLE['L'].lerp(V(-1,-.3,.3).normalized(),settle).normalized()
  c['fingers_R']=.25*settle;c['fingers_L']=FIST*(1-flail)*(1-settle)+.15*settle;c['thumb_L']=THUMB_FIST*(1-flail)*(1-settle)
 return c

PREV={}
def apply(P):
 for b in bones:
  pb=arm.pose.bones[b.name];rest=RESTM[b.name]
  prefix=P.M[b.parent.name]@RESTM[b.parent.name].inverted()@rest if b.parent else rest
  basis=prefix.inverted()@P.M[b.name];loc,quat,scale=basis.decompose()
  if b.name in PREV and PREV[b.name].dot(quat)<0:quat.negate()
  PREV[b.name]=quat.copy()
  pb.rotation_mode='QUATERNION';pb.location=loc;pb.rotation_quaternion=quat;pb.scale=scale

def basis_error(P):
 worst=0.0
 for b in bones:
  rest=RESTM[b.name];prefix=P.M[b.parent.name]@RESTM[b.parent.name].inverted()@rest if b.parent else rest
  basis=prefix.inverted()@P.M[b.name]
  worst=max(worst,max(abs(basis[i][j]-(1 if i==j else 0)) for i in range(4) for j in range(4)))
 return worst

def sheet_check():
 """Idle 0 s must return the wrists, ankles and the sheet-authored heart buttons to the blockout sheet."""
 P=build_pose(evaluate('idle',0.0));M=P.M;out={}
 for s in 'RL':
  W=M['hand_'+s]@RESTM['hand_'+s].inverted()@head_of('hand_'+s);out['wrist_%s_err_m'%s]=(W-RG.SHEET_WRIST[s]).length
  A=M['foot_'+s]@RESTM['foot_'+s].inverted()@head_of('foot_'+s);out['ankle_%s_err_m'%s]=(A-LEG[s][2]).length
  Ss,Es,Ws=RG.SHEET_CHAIN[s];Ts=RG.SHEET_T[s];bd=RG.BUTTON_DIR[s]-RG.BUTTON_DIR[s].dot(Ts)*Ts;bd.normalize()
  hc=M['heart_'+s]@RESTM['heart_'+s].inverted()@head_of('heart_'+s);out['heart_%s_err_m'%s]=(hc-(Ws-Ts*0.045+bd*0.058)).length
 mc=M['hand_R']@RESTM['hand_R'].inverted()@RG.hand_world('R',V(0,0,RG.MITTEN_C))
 out['mitten_R_centre_err_m']=(mc-(RG.MH_SHEET@V(0,0,RG.MITTEN_C))).length
 return out

def defeat_check():
 P=build_pose(evaluate('defeat',1.0));M=P.M;out={}
 for s in 'LR':
  A=M['foot_'+s]@RESTM['foot_'+s].inverted()@head_of('foot_'+s);out['ankle_%s_err_m'%s]=(A-RG.DEFEAT_ANKLE[s]).length
 D=P.delta('foot_L');out['foot_L_rot_err']=max(abs(D[i][j]-DL_F[i][j]) for i in range(3) for j in range(3))
 return out

if __name__=='__main__':
 scene=bpy.context.scene;scene.render.fps=FPS;scene.frame_start=0;scene.frame_end=90
 assert scene.get('work_order')=='WO111' and scene.get('scene_lease')=='active' and scene.get('asset_id')=='web-slinger-helper'
 err=basis_error(build_pose(rest_controls()));assert err<1e-4,('rest controls do not reproduce the bind pose',err)
 sheet=sheet_check();assert all(v<1e-4 for k,v in sheet.items() if not k.startswith('mitten')),('idle 0 s is not the sheet pose',sheet)
 dchk=defeat_check();assert all(v<1e-4 for v in dchk.values()),('held defeat misses the rope-tangle feet',dchk)
 arm.animation_data_clear();arm.animation_data_create()
 for action in list(bpy.data.actions):bpy.data.actions.remove(action)
 records=[]
 for name,duration,loop in CLIPS:
  action=bpy.data.actions.new(name);arm.animation_data.action=action;end=round(duration*FPS);PREV.clear()
  for frame in range(end+1):
   scene.frame_set(frame);apply(build_pose(evaluate(name,frame/end)))
   for pb in arm.pose.bones:
    if pb.name=='root':continue
    fields=('location','rotation_quaternion','scale') if pb.name in SCALED else ('location','rotation_quaternion')
    for field in fields:pb.keyframe_insert(data_path=field,frame=frame,group=pb.name)
  for fc in action.fcurves:
   for k in fc.keyframe_points:k.interpolation='LINEAR'
  track=arm.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,0,action);strip.action_frame_start=0;strip.action_frame_end=end;track.mute=True
  records.append({'name':name,'duration_s':duration,'loop':loop,'clamp_when_finished':not loop,'frames':end+1,'fps':FPS,
   'contact_time_s':round(CONTACT*duration,4) if name=='attack' else None,'contact_fraction':CONTACT if name=='attack' else None,
   'held_final_pose_from_s':round(DEFEAT_HOLD*duration,4) if name=='defeat' else None,
   'ends_on_sheet_pose':name in ('hit','attack','idle')})
 arm.animation_data.action=None
 for pb in arm.pose.bones:pb.matrix_basis=Matrix.Identity(4)
 scene.frame_set(0);bpy.context.view_layer.update()
 arm['attack_contact_seconds']=1.25;arm['attack_contact_fraction']=CONTACT
 bp=ROOT/'source/bounds.json'
 if bp.exists():
  br=json.loads(bp.read_text());skin['model_space_bounds_y_up']=br['safe_culling_envelope'];skin['bounds_method']=br['method']
 for name in ('build.py','common.py','paint.py','rig.py','animate.py'):
  old=bpy.data.texts.get('WO111 web-slinger helper '+name)
  if old:bpy.data.texts.remove(old)
  block=bpy.data.texts.new('WO111 web-slinger helper '+name);block.write((ROOT/'source'/name).read_text())
 bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'web-slinger-helper.blend'),compress=True)
 bpy.ops.export_scene.gltf(filepath=str(ROOT/'web-slinger-helper.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_optimize_animation_size=False,export_skins=True,export_def_bones=False,export_armature_object_remove=True,export_all_influences=False,export_influence_nb=4,export_apply=False,export_texcoords=True,export_normals=True,export_tangents=False,export_materials='EXPORT',export_vertex_color='NONE',export_image_format='AUTO',export_all_vertex_colors=False,export_cameras=False,export_lights=False,export_extras=True)
 record=json.loads((ROOT/'construction.json').read_text());record['clips']=records;record['rest_reproduction_max_error']=err;record['sheet_pose_reproduction_m']=sheet;record['defeat_feet_reproduction']=dchk
 record['files']={name:{'bytes':(ROOT/name).stat().st_size,'sha256':hashlib.sha256((ROOT/name).read_bytes()).hexdigest()} for name in ['web-slinger-helper.blend','web-slinger-helper.glb','pigment.png']}
 (ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({'clips':[(r['name'],r['frames']) for r in records],'rest_error':err,'sheet':sheet,'defeat':dchk,'files':record['files']}))
