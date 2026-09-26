"""WO111 radio-host-showman acting, baked at 30 fps into exactly five NLA clips.

idle   3.0 s loop  the approved sheet pose at 0 s (cane planted in his right fist, left glove raised in
                   the "welcome, folks!" wave, head tilted 4 deg toward the mic); heel-toe bounce with a
                   cane tap on every beat, a slow creepy wave, one snapped head tick (a sudden extra tilt
                   held, then snapped back), glowing eyes pulsing on the beat, tufts bobbing, halo wobbling
move   1.0 s loop  jaunty vaudeville strut: bouncing steps, the cane swinging forward and back off the
                   floor, the free hand pumping, tufts bouncing
attack 2.0 s       sweeping mic-cane swing with a showy lean: a quick cane twirl and heel click, the
                   wind-up (leans back and twists, the mic raised back over his right shoulder, free hand
                   flared), then the overhead sweep and lunge that brings the mic head down at the player
                   at the 1.25 s contact, where the radio-static burst pops open round the mic; a short
                   vibrato hold, a quick bow and back to the planted sheet pose
hit    0.7 s       jolts back a step: eyes pop wide, tufts squash flat and boing back, the cane wobbles,
                   the bow tie spins, the halo glitches, the free hand flails; the grin stays
defeat 2.4 s       a jerky, glitchy bow: a shudder of stepped jolts, then a bow that proceeds in stepped
                   stutters, leaning on the planted cane, the free arm across the waist, head snapped up
                   and cocked toward the player, eyes stuck wide, halo askew; frozen mid-grin, held from
                   1.752 s

Arms and legs are two-bone IK chains solved in the armature's rest space with bend-plane frames
(adapted from the demon-band-idol / rival-mayor v001 animate.py). The bind pose is rest (rig.py);
idle at 0 s reproduces the sheet pose exactly (asserted below against the blockout cane, wave and
feet). No root motion: the root bone is never keyed and the hips carry every translation.
"""
import bpy, math, json, hashlib, importlib.util
from pathlib import Path
from mathutils import Vector, Matrix, Euler, Quaternion
ROOT=Path('/workspace/haynes-quest/family-eras/radio-host-showman/v001')
spec=importlib.util.spec_from_file_location('wo111_rhs_rig',ROOT/'source/rig.py');RG=importlib.util.module_from_spec(spec);spec.loader.exec_module(RG)
FPS=30
arm=bpy.data.objects['Radio_Host_Showman_Rig'];skin=bpy.data.objects['Radio_Host_Showman_Skin'];bones=arm.data.bones
CLIPS=[('idle',3.0,True),('move',1.0,True),('attack',2.0,False),('hit',.7,False),('defeat',2.4,False)]
CONTACT=.625;DEFEAT_HOLD=.73
SCALED={'burst','eye_R','eye_L','halo'}
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
def dirkeyed(t,keys):return keyed(t,keys).normalized()
def hashn(i,k=0):
 """Deterministic pseudo-random value in [-1, 1] for glitch steps."""
 x=math.sin(i*12.9898+k*78.233)*43758.5453;return 2*(x-math.floor(x))-1

RESTM={b.name:b.matrix_local.copy() for b in bones}
def rot3(m):return m.to_3x3().normalized()
def head_of(n):return RESTM[n].translation.copy()
def tail_of(n):return bones[n].tail_local.copy()
ARM={s:(head_of('upper_arm_'+s),head_of('forearm_'+s),head_of('hand_'+s)) for s in 'RL'}
LEG={s:(head_of('thigh_'+s),head_of('shin_'+s),head_of('foot_'+s)) for s in 'RL'}
LEN={s:((ARM[s][1]-ARM[s][0]).length,(ARM[s][2]-ARM[s][1]).length,(LEG[s][1]-LEG[s][0]).length,(LEG[s][2]-LEG[s][1]).length) for s in 'RL'}
POLE_LEG0={s:RG.pole_of(*LEG[s]) for s in 'RL'}
CANE0=(tail_of('cane')-head_of('cane')).normalized()
def bone_dir(n):return (tail_of(n)-head_of(n)).normalized()
def swing(n,toward,angle):
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
 """Controls whose solve is the approved sheet pose (cane planted, wave raised, head tilted)."""
 c={'hips_shift':V(0,0,0),'hips_rot':None,'spine_rot':None,'chest_rot':None,'neck_rot':None,'head_rot':Euler(RG.SHEET_HEAD_ROT).to_matrix(),
  'tuft_R_1':None,'tuft_R_2':None,'tuft_L_1':None,'tuft_L_2':None,'eye_R':1.0,'eye_L':1.0,'halo_rot':None,'halo_spin':0.0,'halo_scale':1.0,'bowtie_spin':0.0,
  'wrist_R':ARM['R'][2].copy(),'wrist_R_world':ARM['R'][2].copy(),'wrist_R_world_w':1.0,'pole_R':RG.SHEET_POLE['R'].copy(),'hand_R_rot':None,'hand_R_world_w':1.0,
  'cane_aim':None,'cane_aim_w':0.0,'cane_twirl':0.0,'burst':1.0,'burst_spin':0.0,
  'wrist_L':RG.SHEET_WRIST['L'].copy(),'wrist_L_world':None,'wrist_L_world_w':0.0,'pole_L':RG.SHEET_POLE['L'].copy(),'hand_L_rot':None,'hand_L_wave':0.0}
 for s in 'RL':
  loc,yaw=RG.FOOT[s];c['ankle_'+s]=RG.ankle_of(loc,yaw);c['foot_'+s+'_rot']=None;c['pole_leg_'+s]=POLE_LEG0[s].copy()
 return c

def rest_controls():
 c=sheet_controls();c['head_rot']=None;c['wrist_R_world_w']=0.0;c['hand_R_world_w']=0.0
 c['wrist_L']=ARM['L'][2].copy();c['pole_L']=RG.REST_POLE['L'].copy()
 return c

WAVE_AXIS=V(0.08,1,0).normalized()
def build_pose(c):
 P=Pose()
 P.put('root',head_of('root'),rot3(RESTM['root']))
 P.put('hips',head_of('hips')+c['hips_shift'],R3(c['hips_rot'])@rot3(RESTM['hips']))
 P.follow('spine',c['spine_rot']);P.follow('chest',c['chest_rot']);P.follow('neck',c['neck_rot']);P.follow('head',c['head_rot'])
 for s in 'RL':
  P.follow('eye_'+s,scale=c['eye_'+s]);P.follow('tuft_%s_1'%s,c['tuft_%s_1'%s]);P.follow('tuft_%s_2'%s,c['tuft_%s_2'%s])
 P.follow('halo',c['halo_rot'],local_rot=Euler((0,c['halo_spin'],0)).to_matrix(),scale=c['halo_scale'])
 P.follow('bowtie',local_rot=Euler((0,c['bowtie_spin'],0)).to_matrix())
 Dc=P.delta('chest');l1,l2,_,_=LEN['R']
 # right arm: wrist target carried by the chest, blended toward a world point (the planted cane)
 S0,E0,W0=ARM['R'];target=P.point('chest',c['wrist_R'])
 if c['wrist_R_world'] is not None:target=target.lerp(Vector(c['wrist_R_world']),c['wrist_R_world_w'])
 P.chain('upper_arm_R','forearm_R',S0,E0,W0,P.point('chest',S0),target,Dc@c['pole_R'],l1,l2)
 W=P.point('forearm_R',W0);RH=P.delta('forearm_R')@R3(c['hand_R_rot'])
 if c['hand_R_world_w']>0:RH=RH.to_quaternion().slerp(Quaternion(),c['hand_R_world_w']).to_matrix()   # toward the world-fixed rest orientation (planted cane)
 if c['cane_aim'] is not None and c['cane_aim_w']>0:
  q=(RH@CANE0).rotation_difference(Vector(c['cane_aim']).normalized());RH=Quaternion().slerp(q,c['cane_aim_w']).to_matrix()@RH
 P.put('hand_R',W,RH@rot3(RESTM['hand_R']))
 P.follow('cane',local_rot=Euler((0,c['cane_twirl'],0)).to_matrix())
 P.follow('burst',local_rot=Euler((0,c['burst_spin'],0)).to_matrix(),scale=c['burst'])
 # left arm: wrist target carried by the chest, optionally blended toward a world point
 S0,E0,W0=ARM['L'];target=P.point('chest',c['wrist_L'])
 if c.get('wrist_L_spine') is not None:target=target.lerp(P.point('spine',c['wrist_L_spine']),c['wrist_L_spine_w'])
 if c['wrist_L_world'] is not None:target=target.lerp(Vector(c['wrist_L_world']),c['wrist_L_world_w'])
 P.chain('upper_arm_L','forearm_L',S0,E0,W0,P.point('chest',S0),target,Dc@c['pole_L'],l1,l2)
 W=P.point('forearm_L',W0);D=P.delta('forearm_L')
 wave=Matrix.Rotation(c['hand_L_wave'],3,(D@RG.HAND_MAP['L'].to_3x3()@WAVE_AXIS).normalized()) if c['hand_L_wave'] else Matrix.Identity(3)
 P.put('hand_L',W,wave@D@R3(c['hand_L_rot'])@rot3(RESTM['hand_L']))
 for s in 'RL':
  H0,K0,A0=LEG[s];_,_,t1,t2=LEN[s]
  P.chain('thigh_'+s,'shin_'+s,H0,K0,A0,P.point('hips',H0),Vector(c['ankle_'+s]),Vector(c['pole_leg_'+s]),t1,t2)
  A=P.point('shin_'+s,A0);P.put('foot_'+s,A,R3(c['foot_'+s+'_rot'])@rot3(RESTM['foot_'+s]))
 return P

# ---------------- acting ----------------
UP=V(0,0,1);DOWN=V(0,0,-1);FWD=V(0,1,0);BACK=V(0,-1,0)
def E(x=0,y=0,z=0):return Euler((x,y,z)).to_matrix()
def mul(*ms):
 out=Matrix.Identity(3)
 for m in ms:
  if m is not None:out=out@R3(m)
 return out
HR0=Euler(RG.SHEET_HEAD_ROT).to_matrix()
W0R=ARM['R'][2].copy()
def tufts(c,a1,a2,b1=None,b2=None,toward=FWD):
 """Tuft chains swing toward a head-relative direction (positive = forward/up, negative = back/flat)."""
 b1=a1 if b1 is None else b1;b2=a2 if b2 is None else b2
 for s,x1,x2 in (('R',a1,a2),('L',b1,b2)):
  c['tuft_%s_1'%s]=swing('tuft_%s_1'%s,toward if x1>=0 else BACK,abs(x1));c['tuft_%s_2'%s]=swing('tuft_%s_2'%s,toward if x2>=0 else BACK,abs(x2))

def evaluate(clip,t):
 c=sheet_controls();tau=math.tau*t
 if clip=='idle':
  beat=4*tau;bounce=.5-.5*math.cos(beat)
  c['hips_shift']=V(.006*math.sin(2*tau),0,-.016*bounce)
  c['hips_rot']=E(0,-.02*math.sin(2*tau),0)
  c['spine_rot']=E(.012*bounce,.025*math.sin(2*tau),0)
  c['chest_rot']=E(0,.035*math.sin(2*tau),.03*math.sin(2*tau))
  tick=keyed(t,[(0,0),(.40,0),(.415,1),(.60,1),(.615,0),(1,0)])
  # the tick snaps the head away from the mic (toward his left) and turns it to the audience, never into the capsule
  c['head_rot']=mul(E(-.03*bounce,.0,.03*math.sin(tau)),E(.04*tick,-.30*tick,.12*tick),HR0)
  c['wrist_R_world']=W0R+V(0,0,.02*bounce)                         # cane taps on every beat
  c['hand_L_wave']=.32*math.sin(4*tau)
  c['wrist_L']=RG.SHEET_WRIST['L']+V(0,0,.010*math.sin(4*tau))
  c['eye_R']=c['eye_L']=1+.06*bounce+.15*tick
  tufts(c,.10*bounce,.16*bounce,.12*bounce,.18*bounce)
  c['halo_spin']=.22*math.sin(tau);c['halo_scale']=1+.03*math.sin(3*tau)
  c['bowtie_spin']=.06*math.sin(2*tau)
 elif clip=='move':
  sn=math.sin(tau);bounce=.5-.5*math.cos(2*tau)
  c['hips_shift']=V(.012*sn,.0,-.030+.014*bounce)
  c['hips_rot']=E(0,.03*sn,-.06*sn)
  c['spine_rot']=E(-.05,0,.03*sn);c['chest_rot']=E(0,-.05*sn,.07*sn)
  c['head_rot']=mul(E(.03*math.sin(2*tau),-.03*sn,.05*sn),HR0)
  for s,off in (('R',0.0),('L',math.pi)):
   ph=tau+off;lift=.06*max(0.0,-math.sin(ph));loc,yaw=RG.FOOT[s]
   c['ankle_'+s]=RG.ankle_of(V(loc.x,loc.y+.105*math.cos(ph),RG.FOOT_Z+lift),yaw)
   c['foot_'+s+'_rot']=Matrix.Rotation(.30*max(0.0,-math.sin(ph))*max(0.0,math.cos(ph)+.2),3,Matrix.Rotation(yaw,3,'Z')@V(1,0,0))
   c['pole_leg_'+s]=V(0,1,.1).normalized()
  # the cane swings forward and back off the floor like a vaudeville walk
  c['wrist_R_world_w']=0.0;c['hand_R_world_w']=0.0
  c['wrist_R']=W0R+V(0,.07*math.sin(tau),.13+.015*math.cos(2*tau))
  c['cane_aim']=Matrix.Rotation(-.30*math.sin(tau),3,'X')@CANE0;c['cane_aim_w']=1.0
  # the free hand pumps with the strut (it swings against the left leg)
  c['wrist_L']=ARM['L'][2].lerp(RG.SHEET_WRIST['L'],.45)+V(0,.09*math.sin(tau)+.03,.03*math.sin(tau));c['pole_L']=RG.REST_POLE['L'].lerp(RG.SHEET_POLE['L'],.45).normalized()
  tufts(c,.12*bounce,.20*bounce,.14*bounce,.22*bounce)
  c['halo_spin']=.15*math.sin(2*tau);c['bowtie_spin']=.05*math.sin(2*tau)
 elif clip=='attack':
  A=keyed(t,[(0,0),(.14,0),(.42,1),(.47,1),(.625,0),(1,0)])            # wind-up amount
  S=keyed(t,[(0,0),(.47,0),(CONTACT,1),(.80,1),(.95,0),(1,0)])         # swing / lunge amount
  bow=bell(t,.87,.08)
  shiver=math.sin(math.tau*9*t)*bell(t,.455,.03)
  vib=math.sin(math.tau*8*(t-CONTACT))*keyed(t,[(0,0),(CONTACT,0),(.66,1),(.78,1),(.82,0),(1,0)])
  c['hips_shift']=V(0,-.05*A+.10*S,-.015*A-.05*S-.02*bow)
  c['hips_rot']=E(.05*A-.08*S-.05*bow,0,-.10*A+.12*S)
  c['spine_rot']=E(.12*A-.16*S-.25*bow+.01*shiver,0,-.14*A+.12*S)
  c['chest_rot']=E(.10*A-.14*S-.15*bow,.05*A,-.16*A+.14*S)
  c['head_rot']=mul(E(.20*A-.03*S+.10*bow+.02*vib,.15*A-.06*S,-.08*A+.12*S),HR0)   # at contact he leans in but keeps the grin on the player
  c['wrist_R_world']=keyed(t,[(0,tuple(W0R)),(.14,tuple(W0R+V(0,.03,.18))),(.42,(.36,-.08,1.58)),(.47,(.37,-.09,1.60)),(.55,(.40,.20,1.62)),(.59,(.36,.36,1.42)),(CONTACT,(.24,.42,1.10)),(.80,(.24,.40,1.12)),(.93,tuple(W0R+V(0,0,.03))),(1,tuple(W0R))])+V(0,0,.008*vib)
  c['wrist_R_world_w']=1.0
  c['hand_R_world_w']=keyed(t,[(0,1),(.12,0),(.90,0),(1,1)])
  c['cane_aim']=dirkeyed(t,[(0,tuple(CANE0)),(.07,tuple(Matrix.Rotation(-.35,3,'X')@CANE0)),(.14,tuple(CANE0)),(.42,(.25,-.50,.83)),(.47,(.25,-.52,.82)),(.55,(.20,.20,.96)),(.59,(.08,.62,.78)),(CONTACT,(-.08,.90,.42)),(.80,(-.06,.88,.46)),(.93,tuple(CANE0)),(1,tuple(CANE0))])+V(.04*vib,0,0)
  c['cane_aim_w']=1.0
  # elbow out and down for the wind-up, raised out to the side for the downswing so the shaft clears the upper arm
  c['pole_R']=dirkeyed(t,[(0,tuple(RG.SHEET_POLE['R'])),(.14,tuple(RG.SHEET_POLE['R'])),(.42,(1,-.2,-.6)),(.50,(1,-.2,-.6)),(.58,(1,-.1,.45)),(.80,(1,-.1,.45)),(.95,tuple(RG.SHEET_POLE['R'])),(1,tuple(RG.SHEET_POLE['R']))])
  c['cane_twirl']=math.tau*keyed(t,[(0,0),(.02,0),(.14,1),(1,1)])
  c['burst']=keyed(t,[(0,RG.BURST_REST_SCALE),(.59,RG.BURST_REST_SCALE),(CONTACT,1.0),(.68,1.15),(.80,RG.BURST_REST_SCALE),(1,RG.BURST_REST_SCALE)])/RG.BURST_REST_SCALE
  c['burst_spin']=.8*keyed(t,[(0,0),(.59,0),(.80,1),(1,1)])
  flare=keyed(t,[(0,0),(.16,0),(.40,1),(.47,1),(.60,.6),(.80,.6),(.95,0),(1,0)])
  c['wrist_L_world']=keyed(t,[(0,(-.58,.10,1.36)),(.47,(-.58,.10,1.36)),(CONTACT,(-.50,-.18,1.46)),(1,(-.50,-.18,1.46))]);c['wrist_L_world_w']=flare
  c['pole_L']=(RG.SHEET_POLE['L']*(1-flare)+V(-.4,-.4,-1).normalized()*flare).normalized()
  c['hand_L_wave']=.25*math.sin(math.tau*3*t)*flare
  step=keyed(t,[(0,0),(.50,0),(.60,1),(.84,1),(.96,0),(1,0)]);lift=bell(t,.55,.06)+bell(t,.90,.06)
  loc,yaw=RG.FOOT['R'];c['ankle_R']=RG.ankle_of(loc+V(0,.20*step,.045*lift),yaw)
  loc,yaw=RG.FOOT['L'];c['ankle_L']=RG.ankle_of(loc+V(0,0,.035*bell(t,.08,.05)),yaw)
  c['foot_L_rot']=Matrix.Rotation(.25*bell(t,.08,.05),3,Matrix.Rotation(yaw,3,'Z')@V(1,0,0))
  c['eye_R']=c['eye_L']=1+.10*A+.28*bell(t,CONTACT+.02,.08)
  tufts(c,.25*A-.15*S+.10*vib,.35*A-.20*S+.15*vib,.28*A-.15*S+.10*vib,.40*A-.22*S+.15*vib)
  c['halo_spin']=1.2*keyed(t,[(0,0),(.47,0),(CONTACT,1),(1,1)])-1.2*keyed(t,[(0,0),(.80,0),(1,1)])
  c['halo_scale']=1+.18*bell(t,CONTACT+.02,.08)
  c['bowtie_spin']=.42*math.sin(math.tau*3*(t-.55))*keyed(t,[(0,0),(.55,0),(.60,1),(.85,1),(.95,0),(1,0)])   # a frantic wobble; a full spin sweeps the wings into the chin
 elif clip=='hit':
  recoil=keyed(t,[(0,0),(.14,1),(.45,.35),(.85,0),(1,0)])
  whip=keyed(t,[(0,0),(.18,1),(.55,.2),(.88,0),(1,0)])
  osc=math.sin(math.tau*4*t)*(1-t)**2*keyed(t,[(0,0),(.06,1),(1,1)])
  squash=keyed(t,[(0,0),(.10,1),(.26,-.55),(.42,.30),(.58,-.12),(.72,0),(1,0)])
  step=keyed(t,[(0,0),(.08,0),(.30,1),(.70,1),(1,0)]);lift=bell(t,.18,.12)+bell(t,.84,.12)
  glitch=[hashn(int(t*14),k) for k in range(4)] if 0.05<t<0.6 else [0,0,0,0]
  c['hips_shift']=V(0,-.06*recoil,.010*recoil-.03*whip)
  c['hips_rot']=E(.10*recoil,0,.04*recoil)
  c['spine_rot']=E(.14*recoil,0,0);c['chest_rot']=E(.14*recoil,-.05*recoil,0)
  c['head_rot']=mul(E(.24*whip,.12*whip,-.08*whip),HR0)
  c['eye_R']=keyed(t,[(0,1),(.10,1.45),(.40,1.30),(.80,1),(1,1)]);c['eye_L']=keyed(t,[(0,1),(.12,1.40),(.42,1.28),(.82,1),(1,1)])
  tufts(c,-.55*squash if squash>0 else -.9*squash,-.45*squash if squash>0 else -1.1*squash)
  c['wrist_R_world']=W0R+V(.02,-.03,.06)*recoil;c['hand_R_world_w']=1.0
  c['cane_aim']=Matrix.Rotation(.18*osc+.10*recoil,3,'X')@CANE0;c['cane_aim_w']=1.0
  c['wrist_L_world']=V(-.40,-.02,1.62);c['wrist_L_world_w']=recoil*.8
  c['pole_L']=(RG.SHEET_POLE['L']*(1-recoil)+V(-1,-.2,-.2).normalized()*recoil).normalized()
  loc,yaw=RG.FOOT['L'];c['ankle_L']=RG.ankle_of(loc+V(0,-.09*step,.035*lift),yaw)
  c['halo_scale']=1+.20*glitch[0];c['halo_spin']=.5*glitch[1];c['halo_rot']=E(.15*glitch[2],0,0)
  c['bowtie_spin']=.42*math.sin(math.tau*3*t)*(1-t)
 elif clip=='defeat':
  H=DEFEAT_HOLD
  # glitch shudder: stepped jolts that change every 2 frames, fading out by 0.20
  step_i=int(t*2.4*15);sh=keyed(t,[(0,0),(.02,1),(.16,1),(.20,0),(1,0)])
  g=[hashn(step_i,k)*sh for k in range(6)]
  # the bow proceeds in seven stepped stutters from 0.22 to 0.62, each with a small overshoot jitter
  u=min(max((t-.22)/.40,0.0),1.0);k=min(int(u*7),6);f=u*7-k
  bow=(k+smooth(min(1.0,f/0.12)))/7 if u<1 else 1.0
  jit=(hashn(k,9)*.06*(1-f) if u<1 and t>.22 else 0.0)
  final=keyed(t,[(0,0),(.64,0),(.66,1),(1,1)])                           # head snaps up at the player
  settle=keyed(t,[(0,0),(.66,0),(.70,1),(1,1)])
  c['hips_shift']=V(.012*g[0],-.055*bow+.01*g[1],-.07*bow-.01*abs(g[2]))
  c['hips_rot']=E(-.16*bow+.05*g[3],0,.04*g[4])
  c['spine_rot']=E(-.50*bow+jit+.06*g[5],.04*g[0],0)
  c['chest_rot']=E(-.40*bow+jit,.06*g[1],.05*g[2])
  # head snaps up and cocks toward the player; probe_defeat.py: a net neck+head extension of about 0.5 rad clears the collar
  c['neck_rot']=E(-.10*bow-.05*final,0,0)
  c['head_rot']=mul(E(.66*final+.18*g[3],.12*g[4]+.20*final,.30*final+.20*g[5]),HR0)
  c['eye_R']=1+.22*max(sh,final)+.10*abs(g[0]);c['eye_L']=1+.16*max(sh,final)+.10*abs(g[1])
  tufts(c,.15*final+.3*g[2],.20*final+.3*g[3],.35*final+.3*g[4],.65*final+.3*g[5])   # right tuft perks, left flops forward (a backward flop met the halo)
  # right fist leans on the planted cane throughout (world-fixed wrist and hand)
  c['wrist_R_world']=W0R+V(0,0,.004*abs(g[0]));c['hand_R_world_w']=1.0   # jolts only ever lift the planted cane
  # free arm sweeps down across the waist for the bow
  WAIST=V(-.03,.23,1.08)                                                   # in front of the belly, carried by the spine
  c['wrist_L']=RG.SHEET_WRIST['L']+V(.02*g[1],.02*g[2],.02*g[3]);c['wrist_L_spine']=WAIST;c['wrist_L_spine_w']=min(1.0,bow*1.1)
  c['pole_L']=(RG.SHEET_POLE['L']*(1-bow)+V(-1,-.3,-.3).normalized()*bow).normalized()
  c['hand_L_rot']=None
  loc,yaw=RG.FOOT['L'];c['ankle_L']=RG.ankle_of(loc+V(0,-.05*bow,0),yaw)
  # the halo counter-tilts as the head snaps up, so its lower arc swings back off the bowed shoulders
  c['halo_rot']=E(-.38*final+.2*g[0],.0,.25*settle)   # probe_halo.py: -0.30..-0.45 clears head and body at the held scale;c['halo_spin']=.6*g[1]+.4*settle;c['halo_scale']=1+.25*g[2]-.12*settle
  c['bowtie_spin']=.35*g[3]+.30*settle
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

def world(P,n,p=None):return P.M[n]@RESTM[n].inverted()@(head_of(n) if p is None else Vector(p))
def sheet_check():
 """Idle 0 s must return the cane, the fist, the waving wrist and the feet to the blockout's sheet positions."""
 P=build_pose(evaluate('idle',0.0))
 out={'cane_tip_err_m':(world(P,'cane',RG.CANE_P0)-RG.CANE_P0).length,'mic_centre_err_m':(world(P,'burst')-RG.MIC_C).length,'grip_err_m':(world(P,'cane')-RG.GRIP).length,
  'wave_wrist_err_m':(world(P,'hand_L')-RG.BLK_WRIST['L']).length}
 for s in 'RL':
  loc,yaw=RG.FOOT[s];out['ankle_%s_err_m'%s]=(world(P,'foot_'+s)-RG.ankle_of(loc,yaw)).length
 return out

if __name__=='__main__':
 scene=bpy.context.scene;scene.render.fps=FPS;scene.frame_start=0;scene.frame_end=90
 assert scene.get('work_order')=='WO111' and scene.get('scene_lease')=='active' and scene.get('asset_id')=='radio-host-showman'
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
   'windup_s':[round(.14*duration,4),round(.47*duration,4)] if name=='attack' else None,
   'burst_open_s':[round(.59*duration,4),round(.80*duration,4)] if name=='attack' else None,
   'held_final_pose_from_s':round(DEFEAT_HOLD*duration,4) if name=='defeat' else None})
 arm.animation_data.action=None
 for pb in arm.pose.bones:pb.matrix_basis=Matrix.Identity(4)
 scene.frame_set(0);bpy.context.view_layer.update()
 arm['attack_contact_seconds']=1.25;arm['attack_contact_fraction']=CONTACT
 bp=ROOT/'source/bounds.json'
 if bp.exists():
  br=json.loads(bp.read_text());skin['model_space_bounds_y_up']=br['safe_culling_envelope'];skin['bounds_method']=br['method']
 for name in ('build.py','common.py','paint.py','rig.py','animate.py'):
  old=bpy.data.texts.get('WO111 radio host showman '+name)
  if old:bpy.data.texts.remove(old)
  block=bpy.data.texts.new('WO111 radio host showman '+name);block.write((ROOT/'source'/name).read_text())
 bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'radio-host-showman.blend'),compress=True)
 bpy.ops.export_scene.gltf(filepath=str(ROOT/'radio-host-showman.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_optimize_animation_size=False,export_skins=True,export_def_bones=False,export_armature_object_remove=True,export_all_influences=False,export_influence_nb=4,export_apply=False,export_texcoords=True,export_normals=True,export_tangents=False,export_materials='EXPORT',export_vertex_color='NONE',export_image_format='AUTO',export_all_vertex_colors=False,export_cameras=False,export_lights=False,export_extras=True)
 record=json.loads((ROOT/'construction.json').read_text());record['clips']=records;record['rest_reproduction_max_error']=err;record['sheet_pose_reproduction_m']=sheet
 record['files']={name:{'bytes':(ROOT/name).stat().st_size,'sha256':hashlib.sha256((ROOT/name).read_bytes()).hexdigest()} for name in ['radio-host-showman.blend','radio-host-showman.glb','pigment.png']}
 (ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({'clips':[(r['name'],r['frames']) for r in records],'rest_error':err,'sheet':sheet,'files':record['files']}))
