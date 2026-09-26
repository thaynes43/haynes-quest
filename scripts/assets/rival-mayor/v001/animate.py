"""WO111 rival-mayor acting, baked at 30 fps into exactly five NLA clips.

idle   3.0 s loop  smug bob; the left fist leaves the hip to twirl the mustache tip, then returns
move   1.2 s loop  pompous strut: chin up, fist on hip, remote swinging, coat tails flapping
attack 2.0 s       raises the remote high (propeller spins up), holds, thrusts it forward with a
                   forward lean and jabs the big button at 1.25 s (contact), recovers
hit    0.7 s       hat pops up off his head, mustache boings, recoil
defeat 2.4 s       surprised hop, plops down onto his coat tails, hat slides down over his eyes,
                   antenna droops; held from 1.728 s

Arms and legs are two-bone IK chains solved in the armature's rest space with bend-plane
frames, so the sleeve and trouser twist stays consistent. The bind pose is the sheet pose and
the controls at rest reproduce it exactly (asserted below). No root motion.
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler
ROOT=Path('/workspace/haynes-quest/family-eras/rival-mayor/v001')
FPS=30
arm=bpy.data.objects['Rival_Mayor_Rig'];skin=bpy.data.objects['Rival_Mayor_Skin'];bones=arm.data.bones
CLIPS=[('idle',3.0,True),('move',1.2,True),('attack',2.0,False),('hit',.7,False),('defeat',2.4,False)]
CONTACT=.625;DEFEAT_HOLD=.72
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
S_R,E_R,W_R=head_of('upper_arm_R'),head_of('forearm_R'),head_of('hand_R')
S_L,E_L,W_L=head_of('upper_arm_L'),head_of('forearm_L'),head_of('hand_L')
FIST_OFF_L=(tail_of('hand_L')-W_L).normalized()*0.0393
def pole_of(S,E,W):
 line=(W-S).normalized();return ((E-S)-line*(E-S).dot(line)).normalized()
POLE_R0=pole_of(S_R,E_R,W_R);POLE_L0=pole_of(S_L,E_L,W_L)
LEG={s:(head_of('thigh_'+s),head_of('shin_'+s),head_of('foot_'+s)) for s in 'RL'}
POLE_LEG0={s:pole_of(*LEG[s]) for s in 'RL'}
L_UP=(E_R-S_R).length;L_FORE=(W_R-E_R).length
L_TH=(LEG['R'][1]-LEG['R'][0]).length;L_SH=(LEG['R'][2]-LEG['R'][1]).length

def solve_two(a,target,l1,l2,pole):
 delta=target-a;dist=min(max(delta.length,1e-5),(l1+l2)*.9995);d=delta.normalized()
 side=Vector(pole)-d*d.dot(Vector(pole))
 if side.length<1e-5:side=Vector((0,1,0))-d*d.y
 side.normalize();along=(l1*l1-l2*l2+dist*dist)/(2*dist)
 return a+d*along+side*math.sqrt(max(0,l1*l1-along*along)),a+d*dist
def basis(a,n):
 a=a.normalized();n=(n-a*a.dot(n)).normalized();return Matrix((a,n,a.cross(n))).transposed()
def frame_rot(a0,n0,a1,n1):return basis(a1,n1)@basis(a0,n0).transposed()

class Pose:
 def __init__(self):self.M={}
 def delta(self,n):return rot3(self.M[n])@rot3(RESTM[n]).inverted()
 def point(self,n,p):return self.M[n]@RESTM[n].inverted()@Vector(p)
 def put(self,n,head,R3,scale=None):
  M=Matrix.Translation(head)@R3.to_4x4()
  if scale is not None:M=M@Matrix.Diagonal((scale[0],scale[1],scale[2],1))
  self.M[n]=M
 def follow(self,n,rot=None,shift=None,local_rot=None,scale=None):
  b=bones[n];rest=RESTM[n]
  if b.parent:D=self.delta(b.parent.name);head=self.point(b.parent.name,rest.translation)
  else:D=Matrix.Identity(3);head=rest.translation.copy()
  if shift is not None:head=head+D@Vector(shift)
  R3=D@(Euler(rot).to_matrix() if rot is not None else Matrix.Identity(3))@rot3(rest)
  if local_rot is not None:R3=R3@Euler(local_rot).to_matrix()
  self.put(n,head,R3,scale)
 def chain(self,up,fore,S0,E0,W0,S,target,pole):
  E,W=solve_two(S,target,L_UP if up.startswith('upper') else L_TH,L_FORE if up.startswith('upper') else L_SH,pole)
  n0=(E0-S0).cross(W0-E0);n1=(E-S).cross(W-E)
  if n1.length<1e-6:n1=n0
  self.put(up,S,frame_rot(E0-S0,n0,E-S,n1)@rot3(RESTM[up]))
  self.put(fore,E,frame_rot(W0-E0,n0,W-E,n1)@rot3(RESTM[fore]))
  return E,W

def rest_controls():
 return {'hips_shift':V(0,0,0),'hips_rot':V(0,0,0),'chest_rot':V(0,0,0),'neck_rot':V(0,0,0),'head_rot':V(0,0,0),
  'hat_shift':V(0,0,0),'hat_rot':V(0,0,0),'hat_scale':V(1,1,1),'stache_R':V(0,0,0),'stache_L':V(0,0,0),
  'wrist_R':W_R.copy(),'wrist_R_world':None,'wrist_R_world_w':0.0,'pole_R':POLE_R0.copy(),'hand_R_rot':V(0,0,0),
  'fist_L':W_L+FIST_OFF_L,'twirl':0.0,'twirl_target':V(0,0,0),'fist_L_world':None,'fist_L_world_w':0.0,'pole_L':POLE_L0.copy(),'hand_L_rot':V(0,0,0),
  'remote_rot':V(0,0,0),'button':0.0,'thumb_rot':V(0,0,0),'ant1':V(0,0,0),'ant2':V(0,0,0),'prop':0.0,
  'ankle_R':LEG['R'][2].copy(),'ankle_L':LEG['L'][2].copy(),'foot_R_rot':V(0,0,0),'foot_L_rot':V(0,0,0),
  'pole_leg_R':POLE_LEG0['R'].copy(),'pole_leg_L':POLE_LEG0['L'].copy(),'tail_R':V(0,0,0),'tail_L':V(0,0,0)}

def build_pose(c):
 P=Pose()
 P.put('root',head_of('root'),rot3(RESTM['root']))
 P.put('hips',head_of('hips')+c['hips_shift'],Euler(c['hips_rot']).to_matrix()@rot3(RESTM['hips']))
 P.follow('chest',c['chest_rot']);P.follow('neck',c['neck_rot']);P.follow('head',c['head_rot'])
 P.follow('hat',c['hat_rot'],c['hat_shift'],scale=c['hat_scale'])
 P.follow('mustache_R',c['stache_R']);P.follow('mustache_L',c['stache_L'])
 # Right arm: wrist target in the chest frame, optionally blended toward a world target.
 target=P.point('chest',c['wrist_R'])
 if c['wrist_R_world'] is not None:target=target.lerp(Vector(c['wrist_R_world']),c['wrist_R_world_w'])
 P.chain('upper_arm_R','forearm_R',S_R,E_R,W_R,P.point('chest',S_R),target,P.delta('chest')@c['pole_R'])
 W=P.M['forearm_R']@RESTM['forearm_R'].inverted()@W_R
 P.put('hand_R',W,P.delta('chest')@Euler(c['hand_R_rot']).to_matrix()@rot3(RESTM['hand_R']))
 # Left arm: fist target on the hip (hips frame), blended to a head-frame twirl point or a world point.
 fist=P.point('hips',c['fist_L'])
 if c['twirl']>0:fist=fist.lerp(P.point('head',c['twirl_target']),c['twirl'])
 if c['fist_L_world'] is not None:fist=fist.lerp(Vector(c['fist_L_world']),c['fist_L_world_w'])
 SL=P.point('chest',S_L);guess=(fist-SL).normalized()
 wt=fist-FIST_OFF_L.length*guess
 for _ in range(4):
  P.chain('upper_arm_L','forearm_L',S_L,E_L,W_L,SL,wt,P.delta('chest')@c['pole_L'])
  fd=P.delta('forearm_L')@(W_L-E_L).normalized();wt=fist-fd*FIST_OFF_L.length
 P.chain('upper_arm_L','forearm_L',S_L,E_L,W_L,SL,wt,P.delta('chest')@c['pole_L'])
 WLp=P.M['forearm_L']@RESTM['forearm_L'].inverted()@W_L
 P.put('hand_L',WLp,P.delta('forearm_L')@Euler(c['hand_L_rot']).to_matrix()@rot3(RESTM['hand_L']))
 P.follow('remote',c['remote_rot'])
 bdir=(tail_of('button')-head_of('button')).normalized()
 P.follow('button',shift=-bdir*c['button']);P.follow('thumb_R',c['thumb_rot'])
 P.follow('antenna_1',c['ant1']);P.follow('antenna_2',c['ant2']);P.follow('propeller',local_rot=(0,c['prop'],0))
 for s in 'RL':
  H0,K0,A0=LEG[s]
  P.chain('thigh_'+s,'shin_'+s,H0,K0,A0,P.point('hips',H0),Vector(c['ankle_'+s]),Vector(c['pole_leg_'+s]))
  A=P.M['shin_'+s]@RESTM['shin_'+s].inverted()@A0
  P.put('foot_'+s,A,Euler(c['foot_'+s+'_rot']).to_matrix()@rot3(RESTM['foot_'+s]))
  P.follow('tail_'+s,c['tail_'+s])
 return P

# ---------------- acting ----------------
def prop_angle(t,duration,rate_fn,loop_revs=None):
 """Integrated propeller angle; loops snap to a whole number of revolutions."""
 if loop_revs is not None:return math.tau*loop_revs*t
 steps=max(1,int(400*t));acc=0.0
 for i in range(steps):acc+=rate_fn((i+.5)/steps*t)*t/steps
 return math.tau*acc*duration

def evaluate(clip,t):
 c=rest_controls();tau=math.tau*t;sn=math.sin(tau);cs=math.cos(tau)
 if clip=='idle':
  c['hips_shift'].z=-.012*(.5-.5*math.cos(2*tau))
  c['chest_rot'].x=.025*(.5-.5*cs);c['chest_rot'].z=.012*sn
  tw=keyed(t,[(0,0),(.26,0),(.40,1),(.70,1),(.84,0),(1,0)])
  phi=math.tau*3*(t-.40)/.30 if .40<=t<=.70 else 0.0
  circle=V(.012*math.cos(phi)-.012,0,.012*math.sin(phi))*tw
  c['twirl']=tw;c['twirl_target']=V(-.435,.205,1.748)+circle
  c['pole_L']=POLE_L0.lerp(V(-.75,-.35,-.55).normalized(),tw)
  c['hand_L_rot']=V(0,0,0).lerp(V(-.6,.3,.9),tw)
  boing=math.sin(math.tau*2.5*max(0,t-.70)/.30)*bell(t,.80,.12)
  c['stache_L']=V(0,.10*math.sin(phi)*tw+.08*tw+.10*boing,0)
  c['stache_R']=V(0,-.03*math.sin(2*tau),0)
  c['head_rot']=V(.05*tw+.02*(.5-.5*cs),-.07*tw,.03*sn)
  c['wrist_R']=W_R+V(0,.012*math.sin(tau+.5),.014*math.sin(2*tau))
  c['hand_R_rot']=V(.05*math.sin(2*tau),0,.04*sn)
  c['ant2']=V(.06*math.sin(2*tau+.4),.05*math.sin(tau),0)
  c['hat_rot']=V(.02*math.sin(2*tau-.6),0,0)
  for s in 'RL':c['tail_'+s]=V(-.03*(.5-.5*math.cos(2*tau)),0,.02*sn)
  c['prop']=prop_angle(t,3.0,None,2)
 elif clip=='move':
  c['hips_shift']=V(.018*sn,0,-.045+.016*(.5-.5*math.cos(2*tau)))
  c['hips_rot']=V(0,.03*sn,-.05*sn)
  c['chest_rot']=V(.07+.015*math.sin(2*tau),-.02*sn,.07*sn)
  c['head_rot']=V(.07-.02*math.sin(2*tau),.02*sn,-.04*sn)
  for s,off in (('R',0.0),('L',math.pi)):
   ph=tau+off;lift=.075*max(0.0,-math.sin(ph))
   c['ankle_'+s]=LEG[s][2]+V(0,.12*math.cos(ph),lift)
   c['foot_'+s+'_rot']=V(.35*max(0.0,-math.sin(ph))*max(0.0,math.cos(ph)+.3),0,0)
   c['pole_leg_'+s]=V(0,1,.15)
  c['wrist_R']=W_R+V(0,-.06*cs,.03*(.5-.5*math.cos(2*tau)))
  c['hand_R_rot']=V(-.10*cs,0,0)
  for s in 'RL':c['tail_'+s]=V(-.22-.10*(.5-.5*math.cos(2*tau+.8)),0,.05*sn)
  c['hat_rot']=V(.035*math.sin(2*tau-.7),.02*sn,0)
  c['stache_R']=V(0,.07*math.sin(2*tau-.9),0);c['stache_L']=V(0,-.07*math.sin(2*tau-.9),0)
  c['ant2']=V(.12*math.sin(2*tau-.5),.06*sn,0);c['ant1']=V(.04*math.sin(2*tau-.2),0,0)
  c['prop']=prop_angle(t,1.2,None,1)
 elif clip=='attack':
  antic=keyed(t,[(0,0),(.10,1),(.16,1),(.26,0),(1,0)])
  raise_=keyed(t,[(0,0),(.12,0),(.42,1),(.55,1),(CONTACT,0),(1,0)])
  thrust=keyed(t,[(0,0),(.55,0),(CONTACT,1),(.72,1),(.95,0),(1,0)])
  hold=keyed(t,[(0,0),(.40,0),(.44,1),(.54,1),(.57,0),(1,0)])
  press=keyed(t,[(0,0),(.585,0),(CONTACT,1),(.72,1),(.80,0),(1,0)])
  shake=math.sin(math.tau*7*t)*hold
  RAISED=V(.43,.10,1.84);AT=V(.42,.52,1.30)
  c['wrist_R']=W_R+V(-.10,.06,.05)*antic+(RAISED-W_R)*raise_+(AT-W_R)*thrust+V(.012,0,.01)*shake
  c['pole_R']=(POLE_R0*(1-raise_-thrust)+V(1,-.1,-.25).normalized()*raise_+V(1,-.3,-.5).normalized()*thrust).normalized()
  c['hand_R_rot']=V(.15*antic+.10*raise_-.38*thrust+.05*shake,-.20*raise_,.25*raise_+.10*thrust)
  c['hips_shift']=V(0,-.02*raise_+.035*thrust,-.035*antic-.015*raise_-.035*thrust)
  c['chest_rot']=V(-.07*antic+.11*raise_-.21*thrust,0,.04*shake-.05*raise_+.05*thrust+.05*antic)
  c['head_rot']=V(-.05*antic+.12*raise_-.07*thrust,-.05*raise_,.10*raise_-.03*thrust-.08*antic)
  c['stache_R']=V(0,-.10*raise_-.16*thrust+.05*shake,0);c['stache_L']=V(0,.10*raise_+.16*thrust-.05*shake,0)
  c['thumb_rot']=V(-.55*press,0,.35*press);c['button']=.011*press
  wob=math.sin(math.tau*5*t)
  c['ant2']=V(.10*wob*(raise_+hold)*(1-thrust)-.25*bell(t,.66,.10),.06*wob*raise_,0)
  c['ant1']=V(-.10*bell(t,.66,.10),0,0)
  c['hat_rot']=V(.04*raise_-.06*thrust,0,0);c['hat_shift']=V(0,0,.02*bell(t,.64,.08))
  for s in 'RL':c['tail_'+s]=V(-.06*raise_-.12*thrust,0,0)
  c['fist_L']=c['fist_L']+V(-.01,0,.01)*shake
  rate=lambda x:.6+2.6*keyed(x,[(0,0),(.12,0),(.42,1),(.72,1),(1,.1)])
  c['prop']=prop_angle(t,2.0,rate)
 elif clip=='hit':
  recoil=keyed(t,[(0,0),(.16,1),(.45,.25),(.80,0),(1,0)])
  whip=keyed(t,[(0,0),(.24,1),(.55,.15),(.85,0),(1,0)])
  pop=keyed(t,[(0,0),(.08,0),(.30,1),(.52,0),(.60,.10),(.68,0),(1,0)])
  c['hips_shift']=V(0,-.045,-.02)*recoil
  c['chest_rot']=V(.20*recoil,0,-.05*recoil);c['head_rot']=V(.24*whip,.07*whip,-.05*whip)
  c['hat_shift']=V(0,-.02*pop,.17*pop);c['hat_rot']=V(.35*pop,0,.12*pop)
  osc=math.sin(math.tau*3.5*t)*(1-t)**2*keyed(t,[(0,0),(.08,1),(1,1)])
  c['stache_R']=V(0,.38*osc,0);c['stache_L']=V(0,-.38*osc,0)
  c['wrist_R']=W_R+V(.07,-.05,.13)*recoil;c['hand_R_rot']=V(.25*recoil,0,-.15*recoil)
  c['fist_L']=c['fist_L']+V(-.02,0,.03)*recoil
  c['ant2']=V(.30*math.sin(math.tau*4*t)*(1-t)**2,0,0);c['ant1']=V(.10*recoil,0,0)
  for s in 'RL':c['tail_'+s]=V(-.12*whip,0,0)
  c['prop']=math.tau*smooth(t)
 elif clip=='defeat':
  surprise=keyed(t,[(0,0),(.07,1),(.14,0),(1,0)])
  sit=keyed(t,[(0,0),(.13,0),(.46,1),(.53,.93),(.62,1),(1,1)])
  legs=keyed(t,[(0,0),(.14,0),(.44,1),(1,1)])
  slide=keyed(t,[(0,0),(.47,0),(.64,1),(1,1)])
  flop=keyed(t,[(0,0),(.16,0),(.48,1),(1,1)])
  droop=keyed(t,[(0,0),(.40,0),(.72,1),(1,1)])
  settle=keyed(t,[(0,0),(.46,0),(.72,1),(1,1)])
  SIT_HIPS=V(0,-.10,-.555)
  c['hips_shift']=V(0,0,.05)*surprise+SIT_HIPS*sit
  c['hips_rot']=V(.12*sit,0,0)
  c['chest_rot']=V(-.05*surprise-.10*settle,0,.04*settle);c['head_rot']=V(.08*surprise-.12*settle,.10*settle,.05*settle)
  for s,x in (('R',.165),('L',-.165)):
   c['ankle_'+s]=LEG[s][2].lerp(V(x,.50,.165),legs)+V(0,0,.03*surprise+.16*math.sin(math.pi*legs))
   c['foot_'+s+'_rot']=V(1.05*legs,0,.12*legs*(1 if s=='R' else -1))
   c['pole_leg_'+s]=POLE_LEG0[s].lerp(V(0,.3,1).normalized(),legs)
  c['wrist_R']=W_R+V(.05,0,.16)*surprise
  c['wrist_R_world']=V(.40+.28*math.sin(math.pi*flop),.20,.40+.10*math.sin(math.pi*flop)+.555*(1-sit));c['wrist_R_world_w']=flop
  c['hand_R_rot']=V(-.35*flop,.35*flop,-.10*flop)
  c['pole_R']=POLE_R0.lerp(V(1,-.4,.3).normalized(),flop)
  c['fist_L']=c['fist_L']+V(-.05,0,.12)*surprise
  c['fist_L_world']=V(-.44,-.02,.075);c['fist_L_world_w']=flop
  c['pole_L']=POLE_L0.lerp(V(-.6,-.6,.4).normalized(),flop);c['hand_L_rot']=V(.4*flop,0,.3*flop)
  c['hat_shift']=V(0,0,.06*surprise)+V(0,.018,-.115)*slide
  c['hat_rot']=V(.10*surprise-.10*slide,0,.03*slide)
  c['hat_scale']=V(1,1,1).lerp(V(1.22,.95,1.22),slide)
  c['stache_R']=V(0,-.15*surprise+.26*droop,0);c['stache_L']=V(0,.15*surprise-.26*droop,0)
  wob=math.sin(math.tau*3*(t-.46)/.26)*bell(t,.59,.13) if .46<t<.72 else 0.0
  c['ant1']=V(.35*droop,.30*droop,0);c['ant2']=V(.45*droop+.15*wob,.55*droop,0)
  flare=keyed(t,[(0,0),(.10,0),(.38,1),(1,1)])
  for s in 'RL':c['tail_'+s]=V(-1.88*flare,0,.10*flare*(1 if s=='R' else -1))
  rate=lambda x:1.2*(1-smooth(x/DEFEAT_HOLD))
  c['prop']=prop_angle(min(t,DEFEAT_HOLD),2.4,rate)
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

def rest_check():
 P=build_pose(rest_controls());worst=0.0
 for b in bones:
  rest=RESTM[b.name];prefix=P.M[b.parent.name]@RESTM[b.parent.name].inverted()@rest if b.parent else rest
  basis=prefix.inverted()@P.M[b.name]
  worst=max(worst,max(abs(basis[i][j]-(1 if i==j else 0)) for i in range(4) for j in range(4)))
 return worst

if __name__=='__main__':
 scene=bpy.context.scene;scene.render.fps=FPS;scene.frame_start=0;scene.frame_end=90
 assert scene.get('work_order')=='WO111' and scene.get('scene_lease')=='active' and scene.get('asset_id')=='rival-mayor'
 err=rest_check();assert err<1e-4,('rest controls do not reproduce the bind pose',err)
 arm.animation_data_clear();arm.animation_data_create()
 for action in list(bpy.data.actions):bpy.data.actions.remove(action)
 records=[]
 for name,duration,loop in CLIPS:
  action=bpy.data.actions.new(name);arm.animation_data.action=action;end=round(duration*FPS);PREV.clear()
  for frame in range(end+1):
   scene.frame_set(frame);apply(build_pose(evaluate(name,frame/end)))
   for pb in arm.pose.bones:
    if pb.name=='root':continue
    fields=('location','rotation_quaternion','scale') if pb.name=='hat' else ('location','rotation_quaternion')
    for field in fields:pb.keyframe_insert(data_path=field,frame=frame,group=pb.name)
  for fc in action.fcurves:
   for k in fc.keyframe_points:k.interpolation='LINEAR'
  track=arm.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,0,action);strip.action_frame_start=0;strip.action_frame_end=end;track.mute=True
  records.append({'name':name,'duration_s':duration,'loop':loop,'clamp_when_finished':not loop,'frames':end+1,'fps':FPS,
   'contact_time_s':round(CONTACT*duration,4) if name=='attack' else None,'contact_fraction':CONTACT if name=='attack' else None,
   'raised_warning_hold_s':[round(.42*duration,4),round(.55*duration,4)] if name=='attack' else None,
   'held_final_pose_from_s':round(DEFEAT_HOLD*duration,4) if name=='defeat' else None})
 arm.animation_data.action=None
 for pb in arm.pose.bones:pb.matrix_basis=Matrix.Identity(4)
 scene.frame_set(0);bpy.context.view_layer.update()
 arm['attack_contact_seconds']=1.25;arm['attack_contact_fraction']=CONTACT
 bp=ROOT/'source/bounds.json'
 if bp.exists():
  br=json.loads(bp.read_text());skin['model_space_bounds_y_up']=br['safe_culling_envelope'];skin['bounds_method']=br['method']
 for name in ('build.py','common.py','animate.py'):
  old=bpy.data.texts.get('WO111 rival mayor '+name)
  if old:bpy.data.texts.remove(old)
  block=bpy.data.texts.new('WO111 rival mayor '+name);block.write((ROOT/'source'/name).read_text())
 bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'rival-mayor.blend'),compress=True)
 bpy.ops.export_scene.gltf(filepath=str(ROOT/'rival-mayor.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_def_bones=False,export_armature_object_remove=True,export_all_influences=False,export_influence_nb=4,export_apply=False,export_texcoords=True,export_normals=True,export_tangents=False,export_materials='EXPORT',export_vertex_color='NONE',export_image_format='AUTO',export_all_vertex_colors=False,export_cameras=False,export_lights=False,export_extras=True)
 record=json.loads((ROOT/'construction.json').read_text());record['clips']=records;record['rest_reproduction_max_error']=err
 record['files']={name:{'bytes':(ROOT/name).stat().st_size,'sha256':hashlib.sha256((ROOT/name).read_bytes()).hexdigest()} for name in ['rival-mayor.blend','rival-mayor.glb','pigment.png']}
 (ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({'clips':[(r['name'],r['frames']) for r in records],'rest_error':err,'files':record['files']}))
