"""WO111 demon-band-idol acting, baked at 30 fps into exactly five NLA clips.

idle   3.0 s loop  the approved sheet pose at 0 s (mic by the chin, fist on hip, head tilted into
                   the mic, left foot turned out); on-the-beat bounce, shoulder shimmy that jiggles
                   the sparkles, one quick mic twirl, swaying tail, fringe, earring and charm
move   1.0 s loop  strutting groove walk: bouncing steps, shoulder roll, mic up, fist on hip,
                   bow tails and swallowtails bouncing, tail wagging
attack 2.0 s       mic spin with a sparkle burst: pulls the mic in and leans back, spins a full
                   turn in place while twirling the mic, lunges and thrusts the mic at the
                   player with the free hand flung up; the sparkle burst pops open round the
                   grille at the 1.25 s contact; hair flip and back to the sheet pose
hit    0.7 s       stumbles back a step: head whips, fringe flops over the eyes, arms flail,
                   tail stiffens, sparkles and ears shake
defeat 2.4 s       dizzy wobble, then a dramatic over-deep curtain-call bow with the mic flung
                   wide and the free hand on the belly; held from 1.752 s

Arms and legs are two-bone IK chains solved in the armature's rest space with bend-plane frames
(adapted from the rival-mayor v001 animate.py). The bind pose is neutral (rig.py); idle at 0 s
reproduces the sheet pose exactly (asserted below against the blockout mic and foot positions).
No root motion: the root bone is never keyed and the hips carry every translation.
"""
import bpy, math, json, hashlib, importlib.util
from pathlib import Path
from mathutils import Vector, Matrix, Euler, Quaternion
ROOT=Path('/workspace/haynes-quest/family-eras/demon-band-idol/v001')
spec=importlib.util.spec_from_file_location('wo111_dbi_rig',ROOT/'source/rig.py');RG=importlib.util.module_from_spec(spec);spec.loader.exec_module(RG)
FPS=30
arm=bpy.data.objects['Demon_Band_Idol_Rig'];skin=bpy.data.objects['Demon_Band_Idol_Skin'];bones=arm.data.bones
CLIPS=[('idle',3.0,True),('move',1.0,True),('attack',2.0,False),('hit',.7,False),('defeat',2.4,False)]
CONTACT=.625;DEFEAT_HOLD=.73
SCALED={'burst','sparkle_R','sparkle_L'}
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
def bone_dir(n):return (tail_of(n)-head_of(n)).normalized()
def swing(n,toward,angle):
 """World rotation that swings bone n's rest direction toward a world direction by `angle`."""
 a=bone_dir(n).cross(Vector(toward))
 if a.length<1e-6:return Matrix.Identity(3)
 return Matrix.Rotation(angle,3,a.normalized())
def R3(rot):
 if rot is None:return Matrix.Identity(3)
 if isinstance(rot,Matrix):return rot
 return Euler(rot).to_matrix()

def frame_rot(a0,n0,a1,n1):return RG.basis(a1,n1)@RG.basis(a0,n0).transposed()
class Pose:
 def __init__(self):self.M={}
 def delta(self,n):return rot3(self.M[n])@rot3(RESTM[n]).inverted()
 def point(self,n,p):return self.M[n]@RESTM[n].inverted()@Vector(p)
 def put(self,n,head,R,scale=None):
  M=Matrix.Translation(head)@R.to_4x4()
  if scale is not None:M=M@Matrix.Diagonal((scale,scale,scale,1))
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
  E,W=RG.solve_two(S,target,l1,l2,pole)
  n0=(E0-S0).cross(W0-E0);n1=(E-S).cross(W-E)
  if n1.length<1e-6:n1=n0
  self.put(up,S,frame_rot(E0-S0,n0,E-S,n1)@rot3(RESTM[up]))
  self.put(fore,E,frame_rot(W0-E0,n0,W-E,n1)@rot3(RESTM[fore]))
  return E,W

def sheet_controls():
 """Controls whose solve is the approved sheet pose."""
 c={'hips_shift':V(0,0,0),'hips_rot':None,'spine_rot':None,'chest_rot':None,'neck_rot':None,'head_rot':Euler(RG.SHEET_HEAD_ROT).to_matrix(),
  'fringe_1':None,'fringe_2':None,'ear_R':None,'ear_L':None,'earring':None,
  'wrist_R':RG.SHEET_WRIST['R'].copy(),'wrist_R_world':None,'wrist_R_world_w':0.0,'pole_R':RG.SHEET_POLE['R'].copy(),'hand_R_rot':None,
  'mic_rot':None,'mic_aim':None,'mic_aim_w':0.0,'burst_spin':0.0,'charm':None,'burst':1.0,
  'wrist_L':RG.SHEET_WRIST['L'].copy(),'wrist_L_world':None,'wrist_L_world_w':0.0,'pole_L':RG.SHEET_POLE['L'].copy(),'hand_L_rot':None,
  'sparkle_R':None,'sparkle_L':None,'sparkle_scale':1.0,'spin':0.0,
  'tail':[None]*4,'bow_1':None,'bow_2':None,'coat_R':None,'coat_L':None}
 for s in 'RL':
  loc,yaw=RG.SHEET_FOOT[s];c['ankle_'+s]=RG.ankle_of(loc,yaw);c['foot_'+s+'_rot']=Euler((0,0,yaw)).to_matrix();c['pole_leg_'+s]=POLE_LEG0[s].copy()
 return c

def rest_controls():
 c=sheet_controls();c['head_rot']=None
 for s in 'RL':
  c['wrist_'+s]=ARM[s][2].copy();c['pole_'+s]=RG.REST_POLE[s].copy()
  loc,yaw=RG.REST_FOOT[s];c['ankle_'+s]=RG.ankle_of(loc,yaw);c['foot_'+s+'_rot']=None
 return c

def build_pose(c):
 P=Pose();spin=Matrix.Rotation(c['spin'],3,'Z')
 P.put('root',head_of('root'),rot3(RESTM['root']))
 P.put('hips',head_of('hips')+c['hips_shift'],spin@R3(c['hips_rot'])@rot3(RESTM['hips']))
 P.follow('spine',c['spine_rot']);P.follow('chest',c['chest_rot']);P.follow('neck',c['neck_rot']);P.follow('head',c['head_rot'])
 P.follow('fringe_1',c['fringe_1']);P.follow('fringe_2',c['fringe_2'])
 for n in ('ear_R','ear_L','earring'):P.follow(n,c[n])
 for s in 'RL':P.follow('sparkle_'+s,c['sparkle_'+s],scale=c['sparkle_scale'])
 Dc=P.delta('chest');l1,l2,_,_=LEN['R']
 # right arm: wrist target carried by the chest, optionally blended toward a world point
 S0,E0,W0=ARM['R'];target=P.point('chest',c['wrist_R'])
 if c['wrist_R_world'] is not None:target=target.lerp(spin@Vector(c['wrist_R_world']),c['wrist_R_world_w'])
 P.chain('upper_arm_R','forearm_R',S0,E0,W0,P.point('chest',S0),target,Dc@c['pole_R'],l1,l2)
 W=P.point('forearm_R',W0);RH=P.delta('forearm_R')@R3(c['hand_R_rot'])
 if c['mic_aim'] is not None and c['mic_aim_w']>0:
  # turn the fist so the mic points along a chest-frame aim direction (the high-note thrust)
  q=(RH@bone_dir('mic')).rotation_difference(Dc@(spin@Vector(c['mic_aim'])).normalized());RH=Quaternion().slerp(q,c['mic_aim_w']).to_matrix()@RH
 P.put('hand_R',W,RH@rot3(RESTM['hand_R']))
 P.follow('mic',local_rot=c['mic_rot']);P.follow('charm',c['charm']);P.follow('burst',local_rot=E(0,c['burst_spin'],0),scale=c['burst'])
 # left arm: wrist target carried by the hips (fist on the hip), optionally blended toward a world point
 S0,E0,W0=ARM['L'];target=P.point('hips',c['wrist_L'])
 if c['wrist_L_world'] is not None:target=target.lerp(spin@Vector(c['wrist_L_world']),c['wrist_L_world_w'])
 P.chain('upper_arm_L','forearm_L',S0,E0,W0,P.point('chest',S0),target,Dc@c['pole_L'],l1,l2)
 W=P.point('forearm_L',W0);P.put('hand_L',W,P.delta('forearm_L')@R3(c['hand_L_rot'])@rot3(RESTM['hand_L']))
 for s in 'RL':
  H0,K0,A0=LEG[s];_,_,t1,t2=LEN[s]
  P.chain('thigh_'+s,'shin_'+s,H0,K0,A0,P.point('hips',H0),spin@Vector(c['ankle_'+s]),spin@Vector(c['pole_leg_'+s]),t1,t2)
  A=P.point('shin_'+s,A0);P.put('foot_'+s,A,spin@R3(c['foot_'+s+'_rot'])@rot3(RESTM['foot_'+s]))
  P.follow('coat_'+s,c['coat_'+s])
 for k in range(4):P.follow('tail_%d'%(k+1),c['tail'][k])
 P.follow('bow_1',c['bow_1']);P.follow('bow_2',c['bow_2'])
 return P

# ---------------- acting ----------------
UP=V(0,0,1);DOWN=V(0,0,-1);FWD=V(0,1,0);BACK=V(0,-1,0)
# Fringe motion only ever lifts the swoop off the head (head-relative, amplitudes >= 0): the main
# strand's front rises up/forward, its dip-dyed end swings out from the right temple. Swinging it
# 'down' in the head frame buried the pink tips in the cheek (author check, first hit bake).
FR1_OUT=V(.3,.6,.75).normalized();FR2_OUT=V(1,.4,.2).normalized()
def E(x=0,y=0,z=0):return Euler((x,y,z)).to_matrix()
def mul(*ms):
 out=Matrix.Identity(3)
 for m in ms:
  if m is not None:out=out@R3(m)
 return out
def tail_wave(amp_z,amp_x,tau,n=1,lag=.55):
 """Zero at tau=0: sin and (1-cos) terms give the travelling lag without a t=0 offset."""
 out=[]
 for k in range(4):
  ph=lag*k;a=math.sin(n*tau)*math.cos(ph)+(1-math.cos(n*tau))*math.sin(ph)*.5
  out.append(E(amp_x*a*(.6+.2*k),0,amp_z*a*(.6+.25*k)))
 return out

def evaluate(clip,t):
 c=sheet_controls();tau=math.tau*t;HR0=Euler(RG.SHEET_HEAD_ROT).to_matrix()
 if clip=='idle':
  beat=4*tau;bounce=.5-.5*math.cos(beat)
  c['hips_shift']=V(.004*math.sin(2*tau),0,-.014*bounce)
  c['hips_rot']=E(0,-.02*math.sin(2*tau),0)
  c['spine_rot']=E(.015*bounce,.03*math.sin(2*tau),0)
  c['chest_rot']=E(0,.05*math.sin(2*tau),.03*math.sin(2*tau))
  tw=keyed(t,[(0,0),(.52,0),(.60,1),(.74,1),(.82,0),(1,0)])
  c['head_rot']=mul(E(-.035*bounce,-.02*math.sin(2*tau),.03*math.sin(tau)),HR0,E(.05*tw,0,0))
  c['wrist_R']=RG.SHEET_WRIST['R']+V(.03,.03,.02)*tw+V(0,0,.008*math.sin(beat))
  c['mic_rot']=E(math.tau*smooth((t-.58)/.18),0,0) if .58<t<.76 else (E(math.tau,0,0) if t>=.76 else None)
  c['hand_R_rot']=E(0,.10*tw,0)
  c['wrist_L']=RG.SHEET_WRIST['L']+V(0,0,.004*math.sin(beat))
  c['fringe_1']=swing('fringe_1',FR1_OUT,.08*bounce);c['fringe_2']=swing('fringe_2',FR2_OUT,.12*bounce+.08*(.5-.5*math.cos(2*beat)))
  c['sparkle_R']=E(.10*math.sin(2*tau)+.06*math.sin(beat),.08*math.sin(beat),0);c['sparkle_L']=E(-.10*math.sin(2*tau)+.06*math.sin(beat),-.08*math.sin(beat),0)
  c['earring']=E(.25*math.sin(2*tau),.20*math.sin(tau),0)
  c['charm']=E(.35*math.sin(2*tau+.0)*math.sin(2*tau)+.2*math.sin(2*tau),0,.2*math.sin(tau))
  c['tail']=tail_wave(.28,.10,tau,1)
  for s,sg in (('R',1),('L',-1)):c['coat_'+s]=E(-.05*bounce,0,.03*sg*math.sin(2*tau))
  c['bow_1']=E(.08*math.sin(2*tau),.05*bounce,0);c['bow_2']=E(-.07*math.sin(2*tau),-.04*bounce,0)
  c['ear_R']=swing('ear_R',UP,.05*math.sin(beat));c['ear_L']=swing('ear_L',UP,.05*math.sin(beat))
 elif clip=='move':
  sn=math.sin(tau);bounce=.5-.5*math.cos(2*tau)
  c['hips_shift']=V(.012*sn,0,-.018+.018*(1-bounce)-.012)
  c['hips_rot']=E(0,.03*sn,-.07*sn)
  c['spine_rot']=E(-.03,0,.03*sn);c['chest_rot']=E(0,-.06*sn,.08*sn)
  c['head_rot']=mul(E(.02*math.sin(2*tau),-.03*sn,.04*sn),HR0)
  for s,off in (('R',0.0),('L',math.pi)):
   ph=tau+off;lift=.055*max(0.0,-math.sin(ph));x=.092*(1 if s=='R' else -1)
   c['ankle_'+s]=RG.ankle_of(V(x,.022+.085*math.cos(ph),RG.FOOT_Z+lift),0.0)
   c['foot_'+s+'_rot']=E(.30*max(0.0,-math.sin(ph))*max(0.0,math.cos(ph)+.2),0,0)
   c['pole_leg_'+s]=V(0,1,.1).normalized()
  c['wrist_R']=RG.SHEET_WRIST['R']+V(0,-.015*math.cos(2*tau),.02*math.sin(2*tau))
  c['hand_R_rot']=E(-.06*math.sin(2*tau),0,0)
  c['wrist_L']=RG.SHEET_WRIST['L']+V(0,0,.006*math.sin(2*tau))
  c['fringe_1']=swing('fringe_1',FR1_OUT,.10*bounce);c['fringe_2']=swing('fringe_2',FR2_OUT,.18*bounce)
  c['sparkle_R']=E(.12*math.sin(2*tau+.5),0,.06*sn);c['sparkle_L']=E(.12*math.sin(2*tau+.5),0,.06*sn)
  c['earring']=E(.35*math.sin(2*tau-.7),.2*sn,0);c['charm']=E(.45*math.sin(2*tau-.9),0,.25*sn)
  c['tail']=[E(.10*math.sin(2*tau-.5*k),0,.38*math.sin(tau-.6*k)*(.6+.2*k)) for k in range(4)]
  for s in 'RL':c['coat_'+s]=E(-.10-.10*math.sin(2*tau-.9),0,.05*sn)
  c['bow_1']=E(.14*math.sin(2*tau-.8),.06*sn,0);c['bow_2']=E(.12*math.sin(2*tau-1.1),.05*sn,0)
  c['ear_R']=swing('ear_R',UP,.06*math.sin(2*tau-.4));c['ear_L']=swing('ear_L',UP,.06*math.sin(2*tau-.4))
 elif clip=='attack':
  antic=keyed(t,[(0,0),(.10,1),(.22,1),(.30,0),(1,0)])
  spin_f=keyed(t,[(0,0),(.20,0),(.52,1),(1,1)])
  flare=bell(t,.36,.18)
  lunge=keyed(t,[(0,0),(.46,0),(CONTACT,1),(.74,1),(.95,0),(1,0)])
  up_arm=keyed(t,[(0,0),(.25,0),(.40,.55),(.50,.55),(.60,1),(.76,1),(.95,0),(1,0)])
  flip=bell(t,.80,.10)
  c['spin']=math.tau*spin_f
  c['hips_shift']=V(0,-.02*antic+.06*lunge,-.035*antic+.012*flare-.03*lunge)
  c['hips_rot']=E(.06*antic-.10*lunge,0,0)
  c['spine_rot']=E(.10*antic-.14*lunge,0,.10*flare)
  c['chest_rot']=E(.10*antic-.12*lunge,-.06*flare,.08*flare)
  c['head_rot']=mul(E(.14*antic-.06*lunge-.18*flip,0,-.10*flip),HR0)
  CHEST_IN=V(.10,.16,.84);THRUST=V(.22,.44,1.03)
  c['wrist_R']=RG.SHEET_WRIST['R'].lerp(CHEST_IN,antic*(1-flare*.4))+V(.12,0,.02)*flare+(THRUST-RG.SHEET_WRIST['R'])*lunge
  c['pole_R']=(RG.SHEET_POLE['R']*(1-lunge)+V(1,-.2,-.6).normalized()*lunge).normalized()
  c['mic_aim']=V(.18,.86,.48);c['mic_aim_w']=lunge
  c['mic_rot']=E(2*math.tau*keyed(t,[(0,0),(.24,0),(.50,1),(1,1)]),0,0)
  c['burst']=keyed(t,[(0,RG.BURST_REST_SCALE),(.585,RG.BURST_REST_SCALE),(CONTACT,1.0),(.70,1.15),(.80,RG.BURST_REST_SCALE),(1,RG.BURST_REST_SCALE)])/RG.BURST_REST_SCALE
  c['burst_spin']=.9*keyed(t,[(0,0),(.585,0),(.80,1),(1,1)])
  c['sparkle_scale']=1.0+.35*bell(t,CONTACT+.02,.07)
  c['wrist_L_world']=V(-.25,.02,1.16);c['wrist_L_world_w']=up_arm
  c['pole_L']=(RG.SHEET_POLE['L']*(1-up_arm)+V(-1,-.3,.2).normalized()*up_arm).normalized()
  c['hand_L_rot']=E(0,-.6*up_arm,0)
  step=keyed(t,[(0,0),(.50,0),(.60,1),(.78,1),(.96,0),(1,0)]);lift=bell(t,.55,.06)+bell(t,.87,.08)
  locR,yawR=RG.SHEET_FOOT['R'];c['ankle_R']=RG.ankle_of(locR+V(0,.10*step,.04*lift),yawR)
  c['fringe_1']=swing('fringe_1',FR1_OUT,.20*antic+.30*flare+.30*flip)
  c['fringe_2']=swing('fringe_2',FR2_OUT,.15*antic+.45*flare+.45*flip)
  shake=math.sin(math.tau*6*t)*(antic*.7+flare)
  c['sparkle_R']=E(.20*shake,.10*shake,0);c['sparkle_L']=E(-.20*shake,-.10*shake,0)
  c['earring']=E(.5*flare,.4*flare,0);c['charm']=E(.9*flare-.4*lunge,0,.6*flare)
  # the spin flings the tail out to his right and up, away from the seat and swallowtails
  c['tail']=[E(-.20*flare,0,-.40*flare*(.6+.2*k)+.2*math.sin(math.tau*2*t)*lunge) for k in range(4)]
  for s,sg in (('R',1),('L',-1)):c['coat_'+s]=E(-.55*flare-.2*lunge,0,.25*sg*flare)
  c['bow_1']=E(-.5*flare,.3*flare,0);c['bow_2']=E(-.45*flare,-.3*flare,0)
  c['ear_R']=swing('ear_R',BACK,.25*flare);c['ear_L']=swing('ear_L',BACK,.25*flare)
 elif clip=='hit':
  recoil=keyed(t,[(0,0),(.14,1),(.45,.35),(.85,0),(1,0)])
  whip=keyed(t,[(0,0),(.20,1),(.55,.2),(.88,0),(1,0)])
  flop=keyed(t,[(0,0),(.12,0),(.30,1),(.62,1),(.90,0),(1,0)])
  osc=math.sin(math.tau*4*t)*(1-t)**2*keyed(t,[(0,0),(.06,1),(1,1)])
  step=keyed(t,[(0,0),(.08,0),(.30,1),(.70,1),(1,0)]);lift=bell(t,.18,.12)+bell(t,.84,.12)
  c['hips_shift']=V(0,-.05*recoil,.012*recoil-.03*whip)
  c['hips_rot']=E(.10*recoil,0,.04*recoil)
  c['spine_rot']=E(.16*recoil,0,0);c['chest_rot']=E(.16*recoil,-.06*recoil,0)
  c['head_rot']=mul(E(.30*whip,.10*whip,-.06*whip),HR0)
  c['fringe_1']=swing('fringe_1',FR1_OUT,.40*flop+.12*max(0.0,osc));c['fringe_2']=swing('fringe_2',FR2_OUT,.65*flop+.20*max(0.0,osc))
  c['wrist_R']=RG.SHEET_WRIST['R']+V(.10,-.04,.14)*recoil;c['hand_R_rot']=E(.4*recoil,0,0)
  c['wrist_L_world']=V(-.34,-.04,1.02);c['wrist_L_world_w']=recoil*.85
  c['pole_L']=(RG.SHEET_POLE['L']*(1-recoil)+V(-1,-.2,-.2).normalized()*recoil).normalized()
  locL,yawL=RG.SHEET_FOOT['L'];c['ankle_L']=RG.ankle_of(locL+V(0,-.09*step,.035*lift),yawL)
  c['sparkle_R']=E(.35*osc,.2*osc,0);c['sparkle_L']=E(-.35*osc,-.2*osc,0)
  c['ear_R']=swing('ear_R',BACK,.45*recoil+.15*osc);c['ear_L']=swing('ear_L',BACK,.45*recoil-.15*osc)
  c['earring']=E(.7*osc,.4*osc,0);c['charm']=E(.9*osc,0,.4*osc)
  c['tail']=[E(-.35*recoil*(k+1)/4+.12*osc,0,.25*osc*(k+1)/4) for k in range(4)]
  for s in 'RL':c['coat_'+s]=E(-.30*recoil+.1*osc,0,0)
  c['bow_1']=E(.3*recoil+.2*osc,0,0);c['bow_2']=E(.25*recoil-.2*osc,0,0)
 elif clip=='defeat':
  H=DEFEAT_HOLD;u=lambda x:x*H/.73
  dizzy=keyed(t,[(0,0),(u(.05),1),(u(.34),1),(u(.44),0),(1,0)])
  # every defeat motion is still by 0.70 (1.68 s): the declared hold from 0.73 (1.752 s) sits a full key later
  bow=keyed(t,[(0,0),(u(.36),0),(u(.55),1.12),(u(.62),.94),(u(.70),1.0),(1,1)])
  flop=keyed(t,[(0,0),(u(.10),0),(u(.40),.4),(u(.58),1),(1,1)])
  wob=math.sin(math.tau*2.2*t/(.34*H/.73))*dizzy if t<u(.44) else 0.0
  wob2=math.cos(math.tau*2.2*t/(.34*H/.73))*dizzy if t<u(.44) else 0.0
  settle=math.sin(math.tau*(t-u(.55))/(u(.15)))*bell(t,u(.625),u(.075)) if u(.55)<t<u(.70) else 0.0
  c['hips_shift']=V(.022*wob,.018*wob2*1.0-.02*bow*0,-.02*dizzy-.07*bow)
  c['hips_rot']=E(-.45*bow+.05*wob2,.06*wob,0)
  c['spine_rot']=E(-.40*bow,.08*wob,.04*settle)
  c['chest_rot']=E(-.30*bow+.06*wob2,.10*wob,0)
  # the dizzy loll circles mostly as nod and turn; a small roll keeps the head off the shoulder sparkles
  c['neck_rot']=E(.10*wob2,.06*wob,0)
  c['head_rot']=mul(E(-.25*bow+.14*wob2,.07*wob,.22*wob2),HR0)
  c['fringe_1']=swing('fringe_1',FR1_OUT,.15*dizzy+.45*flop);c['fringe_2']=swing('fringe_2',FR2_OUT,.20*dizzy+.55*flop)
  # right arm: mic droops in the wobble, then is flung wide and back for the curtain-call flourish
  c['wrist_R']=RG.SHEET_WRIST['R']+V(.06,0,-.12)*dizzy
  c['wrist_R_world']=V(.52,.22,.64);c['wrist_R_world_w']=bow if bow<1 else 1.0
  c['pole_R']=(RG.SHEET_POLE['R']*(1-flop)+V(.3,-.2,-1).normalized()*flop).normalized()
  c['hand_R_rot']=E(0,.5*flop,-.3*flop)
  # left hand: falls off the hip, then settles across the belly
  BELLY=V(-.02,.17,.70)
  c['wrist_L']=RG.SHEET_WRIST['L']+V(-.05,0,-.06)*dizzy
  c['wrist_L_world_w']=0.0
  c['wrist_L']=c['wrist_L'].lerp(BELLY,min(1.0,bow))
  c['pole_L']=(RG.SHEET_POLE['L']*(1-flop)+V(-1,-.4,-.3).normalized()*flop).normalized()
  c['hand_L_rot']=E(0,0,.4*flop)
  locR,yawR=RG.SHEET_FOOT['R'];slide=keyed(t,[(0,0),(u(.38),0),(u(.56),1),(1,1)])
  c['ankle_R']=RG.ankle_of(locR+V(.02*slide,-.11*slide,.03*bell(t,u(.47),u(.08))),yawR+.25*slide)
  c['foot_R_rot']=E(0,0,yawR+.25*slide)
  locL,yawL=RG.SHEET_FOOT['L'];c['ankle_L']=RG.ankle_of(locL+V(.015*wob,.01*wob2,.02*max(0,wob)*dizzy),yawL)
  droop=keyed(t,[(0,0),(u(.30),0),(u(.62),1),(1,1)])
  c['tail']=[E(.42*droop*(1 if k<2 else .6)+.10*wob,0,.12*wob) for k in range(4)]
  c['sparkle_R']=E(.2*wob,.25*dizzy+.08*wob2,-.45*droop);c['sparkle_L']=E(-.2*wob,-.25*dizzy-.08*wob2,.12*droop)
  c['ear_R']=swing('ear_R',DOWN,.35*droop);c['ear_L']=swing('ear_L',DOWN,.35*droop)
  c['earring']=E(.3*wob+.9*flop,.3*wob2,0);c['charm']=E(-1.1*flop+.3*wob,0,.3*wob2)
  for s in 'RL':c['coat_'+s]=E(.35*droop+.05*wob,0,0)
  c['bow_1']=E(.55*droop,0,0);c['bow_2']=E(.50*droop,0,0)
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
 """Idle 0 s must return the fists, mic and feet to the blockout's sheet positions."""
 P=build_pose(evaluate('idle',0.0));M=P.M
 mic=M['mic']@RESTM['mic'].inverted()@head_of('mic');grille=M['burst']@RESTM['burst'].inverted()@head_of('burst')
 out={'mic_fist_err_m':(mic-RG.FIST_R).length,'grille_err_m':(grille-RG.MIC_G).length}
 for s in 'RL':
  loc,yaw=RG.SHEET_FOOT[s];a=M['foot_'+s]@RESTM['foot_'+s].inverted()@head_of('foot_'+s);out['ankle_%s_err_m'%s]=(a-RG.ankle_of(loc,yaw)).length
 W=M['hand_L']@RESTM['hand_L'].inverted()@head_of('hand_L');out['wrist_L_err_m']=(W-RG.SHEET_WRIST['L']).length
 return out

if __name__=='__main__':
 scene=bpy.context.scene;scene.render.fps=FPS;scene.frame_start=0;scene.frame_end=90
 assert scene.get('work_order')=='WO111' and scene.get('scene_lease')=='active' and scene.get('asset_id')=='demon-band-idol'
 err=basis_error(build_pose(rest_controls()));assert err<1e-4,('rest controls do not reproduce the bind pose',err)
 sheet=sheet_check();assert all(v<1e-4 for v in sheet.values()),('idle 0 s is not the sheet pose',sheet)
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
   'spin_s':[round(.20*duration,4),round(.52*duration,4)] if name=='attack' else None,
   'burst_open_s':[round(.585*duration,4),round(.80*duration,4)] if name=='attack' else None,
   'held_final_pose_from_s':round(DEFEAT_HOLD*duration,4) if name=='defeat' else None})
 arm.animation_data.action=None
 for pb in arm.pose.bones:pb.matrix_basis=Matrix.Identity(4)
 scene.frame_set(0);bpy.context.view_layer.update()
 arm['attack_contact_seconds']=1.25;arm['attack_contact_fraction']=CONTACT
 bp=ROOT/'source/bounds.json'
 if bp.exists():
  br=json.loads(bp.read_text());skin['model_space_bounds_y_up']=br['safe_culling_envelope'];skin['bounds_method']=br['method']
 for name in ('build.py','common.py','paint.py','rig.py','animate.py'):
  old=bpy.data.texts.get('WO111 demon band idol '+name)
  if old:bpy.data.texts.remove(old)
  block=bpy.data.texts.new('WO111 demon band idol '+name);block.write((ROOT/'source'/name).read_text())
 bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'demon-band-idol.blend'),compress=True)
 bpy.ops.export_scene.gltf(filepath=str(ROOT/'demon-band-idol.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_optimize_animation_size=False,export_skins=True,export_def_bones=False,export_armature_object_remove=True,export_all_influences=False,export_influence_nb=4,export_apply=False,export_texcoords=True,export_normals=True,export_tangents=False,export_materials='EXPORT',export_vertex_color='NONE',export_image_format='AUTO',export_all_vertex_colors=False,export_cameras=False,export_lights=False,export_extras=True)
 record=json.loads((ROOT/'construction.json').read_text());record['clips']=records;record['rest_reproduction_max_error']=err;record['sheet_pose_reproduction_m']=sheet
 record['files']={name:{'bytes':(ROOT/name).stat().st_size,'sha256':hashlib.sha256((ROOT/name).read_bytes()).hexdigest()} for name in ['demon-band-idol.blend','demon-band-idol.glb','pigment.png']}
 (ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({'clips':[(r['name'],r['frames']) for r in records],'rest_error':err,'sheet':sheet,'files':record['files']}))
