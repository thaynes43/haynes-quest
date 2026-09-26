"""WO111 inator-monster acting, baked at 30 fps into exactly five NLA clips.

idle   3.0 s loop  costume waddle-sway with a lazy tail swish; the googly pupils drift; the scientist taps
                   the remote twice, then his shoulders bob in a silent cackle
move   1.2 s loop  stompy, bouncy waddle in the baggy suit; tail sways, plates bob, jaw flaps; the scientist
                   points ahead
attack 2.0 s       0.00-0.55 the scientist raises the remote and mashes the big red button (antenna wiggles);
                   0.55-1.05 the monster rears back, tiny arms up, roaring; 1.05-1.25 it drops into a big
                   belly-bounce stomp: the right foot hits the floor at 1.25 s (contact) as the scientist jabs
                   the remote; 1.25-2.00 it wobbles back, pupils spin, and the scientist grabs the rim
hit    0.7 s       jolt, googly pupils rattle, the zipper pull tab flips up, the scientist bonks his head on
                   the glass and the dome wobbles
defeat 2.4 s       the suit goes floppy: it sits down hard, legs splayed, slumps sideways with its tongue out
                   and pupils crossed; the cockpit dome pops open, the antenna droops into a limp squiggle and
                   the scientist shakes a tiny fist; held from 1.8 s

Legs are two-bone IK chains with world ankle targets; a foot floor guard lifts a target when a rolled foot
would dip below the floor, and a tail floor guard pitches the tail root up just enough that the floor-resting
tail never sinks when the body bobs, rears or sits. The bind pose is the approved sheet pose; the controls at
rest reproduce it exactly (asserted). While the dome is closed the antenna's lower rod stays in the brass
port (the remote jabs are a vertical parallelogram of the right arm). No root motion.
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler
ROOT=Path('/workspace/haynes-quest/family-eras/inator-monster/v001')
FPS=30
arm=bpy.data.objects['Inator_Monster_Rig'];skin=bpy.data.objects['Inator_Monster_Skin'];bones=arm.data.bones
CLIPS=[('idle',3.0,True),('move',1.2,True),('attack',2.0,False),('hit',.7,False),('defeat',2.4,False)]
CONTACT=.625;DEFEAT_HOLD=.75
RIG=json.loads((ROOT/'source/rig-rest.json').read_text())
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
RESTI={k:m.inverted() for k,m in RESTM.items()}
def rot3(m):return m.to_3x3().normalized()
def head_of(n):return RESTM[n].translation.copy()
def tail_of(n):return bones[n].tail_local.copy()
def pole_of(S,E,W):
 line=(W-S).normalized();return ((E-S)-line*(E-S).dot(line)).normalized()
LEG={s:(head_of('thigh_'+s),head_of('shin_'+s),head_of('foot_'+s)) for s in 'RL'}
POLE_LEG0={s:pole_of(*LEG[s]) for s in 'RL'}
L_TH=(LEG['R'][1]-LEG['R'][0]).length;L_SH=(LEG['R'][2]-LEG['R'][1]).length
TAIL_S=[(Vector(d['p']),d['r'],d['w']) for d in RIG['tail_samples']]
FEET={s:[(Vector(c),Vector(sz)) for c,sz in RIG['feet'][s]] for s in 'RL'}
PUP={s:{k:Vector(v) for k,v in RIG['pupils'][s].items()} for s in 'RL'}
TAIL_ROOT=head_of('tail_1')
_d=(Vector(RIG['tail_samples'][-1]['p'])-TAIL_ROOT);_d.z=0;TAIL_AXIS=_d.normalized().cross(V(0,0,1)).normalized()

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
 def point(self,n,p):return self.M[n]@RESTI[n]@Vector(p)
 def put(self,n,head,R3):self.M[n]=Matrix.Translation(head)@R3.to_4x4()
 def follow(self,n,rot=None,shift=None,local_rot=None,pre=None):
  """Rotation `rot` is an Euler in armature axes carried by the parent's pose; `pre` a world-axis 3x3."""
  b=bones[n];rest=RESTM[n]
  if b.parent:D=self.delta(b.parent.name);head=self.point(b.parent.name,rest.translation)
  else:D=Matrix.Identity(3);head=rest.translation.copy()
  if shift is not None:head=head+D@Vector(shift)
  R3=D@(Euler(rot).to_matrix() if rot is not None else Matrix.Identity(3))@rot3(rest)
  if local_rot is not None:R3=R3@Euler(local_rot).to_matrix()
  if pre is not None:R3=pre@R3
  self.put(n,head,R3)
 def chain(self,up,fore,S0,E0,W0,S,target,pole,l1,l2):
  E,W=solve_two(S,target,l1,l2,pole)
  n0=(E0-S0).cross(W0-E0);n1=(E-S).cross(W-E)
  if n1.length<1e-6:n1=n0
  self.put(up,S,frame_rot(E0-S0,n0,E-S,n1)@rot3(RESTM[up]))
  self.put(fore,E,frame_rot(W0-E0,n0,W-E,n1)@rot3(RESTM[fore]))
  return E,W

ZERO=lambda:V(0,0,0)
NAMES_ROT=['hips_rot','spine_1','spine_2','spine_3','neck','head','jaw','tongue','tab','cockpit','dome','pilot_root','pilot_spine','pilot_head',
 'pu_R','pl_R','remote','ant1','ant2','ant3','pu_L','pl_L','ph_L','arm_upper_R','arm_lower_R','arm_upper_L','arm_lower_L',
 'tail_1','tail_2','tail_3','tail_4','tail_5','foot_R_rot','foot_L_rot']
def rest_controls():
 c={k:ZERO() for k in NAMES_ROT}
 c.update({'hips_shift':ZERO(),'tongue_shift':ZERO(),'cockpit_shift':ZERO(),'pilot_shift':ZERO(),'pilot_head_shift':ZERO(),
  'pupil_R':0.0,'pupil_L':0.0,'jab':0.0,
  'ankle_R':LEG['R'][2].copy(),'ankle_L':LEG['L'][2].copy(),'pole_leg_R':POLE_LEG0['R'].copy(),'pole_leg_L':POLE_LEG0['L'].copy()})
 return c

def foot_low(P,s):
 """Lowest point of the foot and toe-nub ellipsoids under the posed foot bone (analytic)."""
 M=P.M['foot_'+s]@RESTI['foot_'+s];R=M.to_3x3();lo=9.0
 for c,sz in FEET[s]:
  cz=(M@c).z;row=R[2];lo=min(lo,cz-math.sqrt((row[0]*sz.x)**2+(row[1]*sz.y)**2+(row[2]*sz.z)**2))
 return lo
REST_FOOT_LOW={}
def pose_leg(P,c,s):
 H0,K0,A0=LEG[s];target=Vector(c['ankle_'+s])
 for _ in range(3):
  P.chain('thigh_'+s,'shin_'+s,H0,K0,A0,P.point('hips',H0),target,Vector(c['pole_leg_'+s]),L_TH,L_SH)
  A=P.M['shin_'+s]@RESTI['shin_'+s]@A0
  P.put('foot_'+s,A,Euler(c['foot_'+s+'_rot']).to_matrix()@rot3(RESTM['foot_'+s]))
  # a rolled or moving foot keeps a smooth 4 mm margin above its rest contact so interpolation stays clear
  moved=max(Vector(c['foot_'+s+'_rot']).length/0.08,(Vector(c['ankle_'+s])-A0).length/0.03)
  low=foot_low(P,s);need=min(0.0,REST_FOOT_LOW.get(s,0.0))+0.004*smooth(moved)
  if low>=need-1e-7:break
  target=target+V(0,0,need-low+1e-5)

def tail_bottoms(P):
 out=[];pts=[]
 for p,r,w in TAIL_S:
  q=Vector();tot=0
  for b,x in w.items():q+=(P.M[b]@RESTI[b]@p)*x;tot+=x
  pts.append(q/tot)
 for i,(q,(p,r,w)) in enumerate(zip(pts,TAIL_S)):
  t=(pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)]).normalized()
  out.append(q.z-r*math.sqrt(max(0.0,1-t.z*t.z)))
 return out
REST_TAIL=None
def pose_tail(P,c,pitch):
 pre=Matrix.Rotation(pitch,3,TAIL_AXIS) if pitch else None
 P.follow('tail_1',c['tail_1'],pre=pre)
 for j in range(2,6):P.follow('tail_%d'%j,c['tail_%d'%j])
def tail_ok(P):
 for b,rb in zip(tail_bottoms(P),REST_TAIL):
  allowed=rb if rb<=0.003 else 0.003   # touching samples may not sink; free ones keep 3 mm clearance
  if b<allowed-1e-6:return False
 return True

def build_pose(c,guards=True):
 P=Pose()
 P.put('root',head_of('root'),rot3(RESTM['root']))
 P.put('hips',head_of('hips')+c['hips_shift'],Euler(c['hips_rot']).to_matrix()@rot3(RESTM['hips']))
 for b in ('spine_1','spine_2','spine_3','neck','head','jaw'):P.follow(b,c[b])
 P.follow('tongue',c['tongue'],c['tongue_shift'])
 P.follow('pupil_R',local_rot=(0,c['pupil_R'],0));P.follow('pupil_L',local_rot=(0,c['pupil_L'],0))
 P.follow('zipper_tab',c['tab'])
 for s in 'RL':P.follow('arm_upper_'+s,c['arm_upper_'+s]);P.follow('arm_lower_'+s,c['arm_lower_'+s])
 P.follow('cockpit',c['cockpit'],c['cockpit_shift']);P.follow('dome',c['dome'])
 P.follow('pilot_root',c['pilot_root'],c['pilot_shift']);P.follow('pilot_spine',c['pilot_spine'])
 P.follow('pilot_head',c['pilot_head'],c['pilot_head_shift'])
 # vertical remote jab: the upper arm lifts about Y and the forearm counter-rotates, so the forearm,
 # remote and antenna rod translate straight up through the port
 P.follow('pilot_upper_R',V(0,-c['jab'],0)+c['pu_R']);P.follow('pilot_lower_R',V(0,c['jab'],0)+c['pl_R'])
 P.follow('remote',c['remote']);P.follow('antenna_1',c['ant1']);P.follow('antenna_2',c['ant2']);P.follow('antenna_3',c['ant3'])
 P.follow('pilot_upper_L',c['pu_L']);P.follow('pilot_lower_L',c['pl_L']);P.follow('pilot_hand_L',c['ph_L'])
 for s in 'RL':
  if guards:pose_leg(P,c,s)
  else:
   H0,K0,A0=LEG[s];P.chain('thigh_'+s,'shin_'+s,H0,K0,A0,P.point('hips',H0),Vector(c['ankle_'+s]),Vector(c['pole_leg_'+s]),L_TH,L_SH)
   A=P.M['shin_'+s]@RESTI['shin_'+s]@A0;P.put('foot_'+s,A,Euler(c['foot_'+s+'_rot']).to_matrix()@rot3(RESTM['foot_'+s]))
 pose_tail(P,c,0.0)
 P.tail_pitch=0.0
 if guards and not tail_ok(P):
  lo,hi=0.0,1.4
  for _ in range(24):
   mid=(lo+hi)/2;pose_tail(P,c,mid)
   if tail_ok(P):hi=mid
   else:lo=mid
  pose_tail(P,c,hi);P.tail_pitch=hi
 return P

# ---------------- pupils: angle (about the eye normal) that points a pupil toward a world direction ----------------
def pupil_angle(s,direction):
 n=PUP[s]['normal'].normalized();o=PUP[s]['offset'];d=Vector(direction)
 o=(o-n*o.dot(n)).normalized();d=(d-n*d.dot(n)).normalized()
 ang=math.atan2(o.cross(d).dot(n),o.dot(d))
 # the pupil bone's local Y is the eye normal, so a local Y rotation spins the pupil about it
 ny=(rot3(RESTM['pupil_'+s])@V(0,1,0)).normalized()
 return ang if ny.dot(n)>0 else -ang
CROSS_R=pupil_angle('R',PUP['L']['centre']-PUP['R']['centre']+V(0,0,-0.12))
CROSS_L=pupil_angle('L',PUP['R']['centre']-PUP['L']['centre']+V(0,0,-0.12))

# ---------------- acting ----------------
def evaluate(clip,t,duration):
 c=rest_controls();tau=math.tau*t;sn=math.sin(tau);cs=math.cos(tau);T=t*duration
 S=lambda keys:keyed(T,keys)   # keys in seconds
 if clip=='idle':
  c['hips_shift']=V(0.022*sn,0,-0.010*(.5-.5*math.cos(2*tau)))
  c['hips_rot']=V(0,0,0.025*sn)
  c['spine_1']=V(0.012*(.5-.5*math.cos(2*tau)),0.035*sn,-0.02*sn)
  c['spine_2']=V(0,0.02*math.sin(tau-.4),0)
  c['spine_3']=V(-0.012*math.sin(2*tau),0.012*math.sin(tau-.8),0)
  c['head']=V(0.03*math.sin(2*tau+.6),-0.04*math.sin(tau-1.0),0.05*math.sin(tau-.5))
  c['jaw']=V(-0.06*(.5-.5*math.cos(2*tau+.9)),0,0)
  c['pupil_R']=0.45*math.sin(tau+.3)+0.18*math.sin(3*tau)
  c['pupil_L']=-0.5*math.sin(tau+1.7)+0.15*math.sin(2*tau+.4)
  for j in range(2,6):c['tail_%d'%j]=V(0,0,0.045*math.sin(tau-0.7*j))
  c['tail_1']=V(0,0,0.03*math.sin(tau-0.5))
  c['arm_upper_R']=V(0.08*math.sin(2*tau),0,0);c['arm_upper_L']=V(0.08*math.sin(2*tau+.5),0,0)
  c['arm_lower_R']=V(0.10*math.sin(2*tau+.8),0,0);c['arm_lower_L']=V(0.10*math.sin(2*tau+1.3),0,0)
  c['tab']=V(0.14*math.sin(tau-1.2),0,0.10*sn)
  tap=bell(T,.60,.14)+bell(T,.95,.14)
  c['jab']=0.20*tap
  c['ant2']=V(0.10*math.sin(2*tau+.4)+0.12*tap,0.07*sn,0);c['ant3']=V(0.14*math.sin(2*tau+1.1)+0.18*tap,0.10*math.sin(tau+.5),0)
  cackle=S([(0,0),(1.45,0),(1.65,1),(2.55,1),(2.75,0),(3.0,0)])
  bob=abs(math.sin(math.tau*3.5*(T-1.55)))*cackle
  c['pilot_spine']=V(0.05*cackle,0,0.03*math.sin(tau))
  c['pilot_head']=V(0.14*cackle+0.05*bob,0,0.04*sn)
  c['pilot_shift']=V(0,0,0.006*bob)
  c['pu_L']=V(0.05*math.sin(2*tau),0,0.04*sn);c['ph_L']=V(0.10*math.sin(2*tau+.7),0,0)
  c['cockpit']=V(0.010*math.sin(2*tau-.8),0.012*math.sin(tau-1.2),0)
 elif clip=='move':
  for s,off in (('R',0.0),('L',math.pi)):
   ph=tau+off;lift=0.14*max(0.0,math.sin(ph))
   c['ankle_'+s]=LEG[s][2]+V(0,-0.12*math.cos(ph),lift)
   c['foot_'+s+'_rot']=V(0.22*max(0.0,math.sin(ph))*math.cos(ph),0,0)
   c['pole_leg_'+s]=V(0,1,.05)
  c['hips_shift']=V(-0.03*sn,0,-0.060-0.026*(.5+.5*math.cos(2*tau-.35)))
  c['hips_rot']=V(0,0,0.05*sn)
  c['spine_1']=V(-0.03+0.02*math.cos(2*tau),-0.05*sn,-0.03*sn)
  c['spine_2']=V(0.015*math.cos(2*tau-.4),-0.02*math.sin(tau-.3),0)
  c['spine_3']=V(0.02*math.cos(2*tau-.8),0,0)
  c['head']=V(0.04*math.cos(2*tau-1.1),0.04*math.sin(tau-.6),-0.05*sn)
  c['jaw']=V(-0.05-0.06*(.5+.5*math.cos(2*tau-1.4)),0,0)
  for j in range(1,6):c['tail_%d'%j]=V(0,0,-0.07*math.sin(tau-0.55*j))
  c['arm_upper_R']=V(0.22*sn,0,0);c['arm_upper_L']=V(-0.22*sn,0,0)
  c['arm_lower_R']=V(0.15*math.sin(tau-.5),0,0);c['arm_lower_L']=V(-0.15*math.sin(tau-.5),0,0)
  c['pupil_R']=0.30*math.sin(2*tau);c['pupil_L']=-0.30*math.sin(2*tau+.7)
  c['tab']=V(0.25*math.cos(2*tau-1.0),0,0.15*sn)
  c['cockpit']=V(0.02*math.cos(2*tau-1.2),0.02*math.sin(tau-.9),0)
  c['pilot_spine']=V(-0.025,0,0.025*math.sin(tau-1.0))
  c['pilot_shift']=V(0,0,0.006*math.cos(2*tau-1.3))
  c['pu_L']=V(0.12+0.05*math.cos(2*tau),0,0.05*sn);c['pl_L']=V(0.10,0,0);c['ph_L']=V(0.08*math.cos(2*tau),0,0)
  c['pilot_head']=V(0.05*math.cos(2*tau-1.5),0,0.10)
  c['ant2']=V(0.14*math.cos(2*tau-.6),0.06*sn,0);c['ant3']=V(0.18*math.cos(2*tau-1.1),0.10*sn,0)
  c['jab']=0.05*(.5+.5*math.cos(2*tau))
 elif clip=='attack':
  mash=S([(0,0),(0.08,1),(0.50,1),(0.58,0),(2.0,0)])
  big=S([(0,0),(1.10,0),(1.22,1),(1.34,1),(1.50,0),(2.0,0)])
  raise_=S([(0,0),(0.18,1),(1.10,1),(1.60,0),(2.0,0)])
  c['jab']=0.10*raise_+0.20*mash*(.5-.5*math.cos(math.tau*5*T))+0.26*big
  point=S([(0,0),(0.10,1),(0.45,1),(0.70,0),(2.0,0)])
  c['pu_L']=V(0.12*point+0.06*point*math.sin(math.tau*4*T),0,0);c['ph_L']=V(0.25*point*abs(math.sin(math.tau*4*T)),0,0)
  wig=S([(0,0),(0.10,1),(1.60,1),(2.0,0)])
  c['ant2']=V(0.22*wig*math.sin(math.tau*4.5*T),0.12*wig*math.sin(math.tau*3*T+.5),0)
  c['ant3']=V(0.30*wig*math.sin(math.tau*4.5*T-.9),0.18*wig*math.sin(math.tau*3*T-.3),0)
  look=S([(0,0),(0.20,1),(0.50,1),(0.70,0),(2.0,0)])
  rear=S([(0,0),(0.55,0),(1.00,1),(1.06,1),(1.22,0),(2.0,0)])
  stomp=S([(0,0),(1.05,0),(1.25,1),(1.32,1),(1.85,0),(2.0,0)])
  lift=S([(0,0),(0.55,0),(0.98,1),(1.06,1),(1.25,0),(2.0,0)])
  roar=S([(0,0),(0.60,0),(0.98,1),(1.45,1),(1.90,0),(2.0,0)])
  armsup=S([(0,0),(0.55,0),(0.98,1),(1.10,1),(1.30,0),(2.0,0)])
  bounce=S([(0,0),(1.10,0),(1.25,1),(1.40,-.3),(1.62,0),(2.0,0)])
  wob=S([(0,0),(1.25,0),(1.35,1),(1.80,.4),(2.0,0)])*math.sin(math.tau*2.2*(T-1.25))
  spin=S([(0,0),(1.25,0),(1.85,1),(2.0,1)])
  grab=S([(0,0),(1.22,0),(1.32,1),(1.70,1),(1.95,0),(2.0,0)])
  jost=S([(0,0),(1.22,0),(1.30,1),(1.70,0),(2.0,0)])*math.sin(math.tau*3*(T-1.22))
  c['hips_shift']=V(0,-0.08*rear+0.05*stomp,-0.03*rear-0.075*bounce)+V(0,0,-0.012*look)
  c['hips_rot']=V(0.06*rear-0.05*stomp,0,0.04*wob)
  c['spine_1']=V(0.11*rear-0.09*stomp,0.05*wob,0.03*look)
  c['spine_2']=V(0.07*rear-0.06*stomp,0.04*wob,0)
  c['spine_3']=V(0.04*rear-0.04*stomp,0.03*wob,0)
  c['neck']=V(0.02*rear-0.06*stomp,0,0)
  c['head']=V(0.04*look+0.05*rear-0.14*stomp,-0.06*wob,0.10*look)
  c['jaw']=V(-0.36*roar,0,0);c['tongue']=V(-0.10*roar,0,0)
  c['arm_upper_R']=V(0.95*armsup,0,-0.2*armsup);c['arm_upper_L']=V(0.95*armsup,0,0.2*armsup)
  c['arm_lower_R']=V(0.45*armsup+0.2*math.sin(math.tau*6*T)*armsup,0,0);c['arm_lower_L']=V(0.45*armsup+0.2*math.sin(math.tau*6*T+1)*armsup,0,0)
  c['ankle_R']=LEG['R'][2]+V(0,0.07,0.21)*lift
  c['foot_R_rot']=V(0.18*lift,0,0)
  c['pole_leg_R']=V(0,1,0.1)
  for j in range(1,6):c['tail_%d'%j]=V(0,0,0.05*wob+0.02*j*stomp*math.sin(math.tau*3*(T-1.2)))
  c['pupil_R']=math.tau*2*spin+0.35*look;c['pupil_L']=-math.tau*2*spin-0.35*look
  c['tab']=V(-0.9*stomp*abs(math.sin(math.tau*2.5*(T-1.25))) if T>1.25 else 0,0,0.2*wob)
  c['cockpit']=V(0.05*jost,0.03*wob,0)
  c['pilot_root']=V(0.02*jost,0.015*jost,0);c['pilot_spine']=V(0.03*look-0.06*jost,0.03*jost,0)
  c['pilot_head']=V(0.10*look+0.12*jost,0,-0.1*jost)
  c['pu_L']=c['pu_L']+V(-1.05*grab,0,0.25*grab);c['pl_L']=V(-0.25*grab,0,0)
 elif clip=='hit':
  recoil=keyed(t,[(0,0),(.14,1),(.45,.3),(.80,0),(1,0)])
  whip=keyed(t,[(0,0),(.20,1),(.55,.1),(.85,0),(1,0)])
  flip=keyed(t,[(0,0),(.12,1),(.42,1),(.80,0),(1,0)])
  bonk=keyed(t,[(0,0),(.10,1),(.20,.2),(.30,0),(1,0)])
  dizzy=keyed(t,[(0,0),(.15,1),(.75,.3),(1,0)])*math.sin(math.tau*3*t)
  decay=(1-t)**2
  c['hips_shift']=V(0,-0.05,-0.02)*recoil
  c['spine_1']=V(0.10*recoil,0,0.03*whip);c['spine_2']=V(0.06*recoil,0,0);c['spine_3']=V(0.04*recoil,0,0)
  c['head']=V(0.22*whip,0.06*whip,-0.05*whip);c['jaw']=V(-0.22*whip,0,0)
  c['pupil_R']=1.1*math.sin(math.tau*8*t)*decay*keyed(t,[(0,0),(.05,1),(1,1)]);c['pupil_L']=-1.2*math.sin(math.tau*8*t+.9)*decay*keyed(t,[(0,0),(.05,1),(1,1)])
  c['tab']=V(-2.2*flip,0,0.3*flip*math.sin(math.tau*2*t))
  c['arm_upper_R']=V(0.5*recoil,0,-0.3*recoil);c['arm_upper_L']=V(0.5*recoil,0,0.3*recoil)
  c['arm_lower_R']=V(0.3*whip,0,0);c['arm_lower_L']=V(0.3*whip,0,0)
  c['dome']=V(0.02*abs(math.sin(math.tau*3.5*t))*decay,0,0)
  c['cockpit']=V(0.06*recoil*math.cos(math.tau*2*t),0,0.03*whip)
  c['pilot_head_shift']=V(0,0,0.020*bonk)   # the frizz just reaches the glass (2.4 cm clearance at rest);c['pilot_head']=V(-0.20*bonk+0.10*dizzy,0,0.18*dizzy)
  c['pilot_spine']=V(0.03*bonk,0,0.03*dizzy);c['pilot_root']=V(0.01*recoil,0,0)
  c['jab']=0.12*recoil
  c['ant2']=V(0.35*math.sin(math.tau*4*t)*decay,0.15*math.sin(math.tau*3*t)*decay,0);c['ant3']=V(0.45*math.sin(math.tau*4*t-.8)*decay,0.2*math.sin(math.tau*3*t-.5)*decay,0)
  c['pu_L']=V(0.08*recoil,0,0.10*recoil);c['ph_L']=V(-0.25*recoil,0,0)
  for j in range(1,6):c['tail_%d'%j]=V(0,0,0.06*whip*math.sin(math.tau*2*t-0.5*j))
 elif clip=='defeat':
  jolt=keyed(t,[(0,0),(.05,1),(.12,0),(1,0)])
  sit=keyed(t,[(0,0),(.10,0),(.30,1),(.34,.92),(.40,1),(1,1)])
  splay=keyed(t,[(0,0),(.10,0),(.30,1),(1,1)])
  slump=keyed(t,[(0,0),(.34,0),(.58,1),(1,1)])
  pop=keyed(t,[(0,0),(.36,0),(.42,1.10),(.47,.95),(.52,1.0),(1,1)])
  droop=keyed(t,[(0,0),(.40,0),(.62,1),(1,1)])
  shake=keyed(t,[(0,0),(.46,0),(.50,1),(.70,1),(.74,0),(1,0)])
  fist=keyed(t,[(0,0),(.40,0),(.50,1),(1,1)])
  cross=keyed(t,[(0,0),(.30,0),(.50,1),(1,1)])
  flop=keyed(t,[(0,0),(.12,0),(.36,1),(1,1)])
  wob=math.sin(math.tau*3.2*(t-.36)/.3)*bell(t,.47,.12) if .36<t<.60 else 0.0
  c['hips_shift']=V(0,0,0.04*jolt)+V(-0.02,-0.10,-0.44)*sit
  c['hips_rot']=V(0.10*sit,0,0.04*slump)
  c['spine_1']=V(0.06*sit-0.06*slump,-0.20*slump,0.04*slump);c['spine_2']=V(-0.02*slump,-0.13*slump+0.03*wob,0);c['spine_3']=V(-0.01*slump,-0.07*slump,0)
  c['neck']=V(-0.03*slump,-0.08*slump,0);c['head']=V(0.10*jolt-0.05*slump,-0.22*slump,0.10*slump)
  c['jaw']=V(-0.08*jolt-0.30*flop,0,0);c['tongue']=V(-0.35*flop,0,-0.2*flop);c['tongue_shift']=V(0,0.07,-0.015)*flop
  c['pupil_R']=CROSS_R*cross;c['pupil_L']=CROSS_L*cross
  for s,x in (('R',0.55),('L',-0.55)):
   c['ankle_'+s]=LEG[s][2].lerp(V(x,0.62,0.18),splay)+V(0,0,0.10*math.sin(math.pi*splay))
   c['foot_'+s+'_rot']=V(0.95*splay,0,0.30*splay*(1 if s=='R' else -1))
   c['pole_leg_'+s]=POLE_LEG0[s].lerp(V(0.35*(1 if s=='R' else -1),0.5,1).normalized(),splay)
  c['arm_upper_R']=V(-0.55*flop,0,0.25*flop);c['arm_upper_L']=V(-0.55*flop,0,-0.25*flop)
  c['arm_lower_R']=V(-0.35*flop,0,0);c['arm_lower_L']=V(-0.35*flop,0,0)
  c['tab']=V(0.25*slump,0,0.35*slump)
  for j in range(1,6):c['tail_%d'%j]=V(0,0,-0.04*j*slump)
  c['cockpit']=V(0.08*jolt+0.04*wob,0.05*wob,0)
  c['dome']=V(1.92*pop,0,0)
  c['pilot_spine']=V(-0.10*fist,0,0.10*fist);c['pilot_head']=V(-0.12*fist+0.05*shake*math.sin(math.tau*6*t),0,0.15*fist)
  c['pilot_shift']=V(0,0,0.01*jolt)
  c['pu_L']=V(1.05*fist+0.16*shake*math.sin(math.tau*7*t),0,0.30*fist);c['pl_L']=V(0.55*fist,0,0);c['ph_L']=V(0.30*fist,0,0)
  c['pu_R']=V(0,0.35*droop,0);c['pl_R']=V(-0.45*droop,0,0.2*droop)
  c['ant1']=V(-0.45*droop,0.20*droop,0);c['ant2']=V(-0.75*droop,0.45*droop,0);c['ant3']=V(-0.95*droop,-0.55*droop,0)
 return c

PREV={}
def apply(P):
 for b in bones:
  pb=arm.pose.bones[b.name];rest=RESTM[b.name]
  prefix=P.M[b.parent.name]@RESTI[b.parent.name]@rest if b.parent else rest
  basis_=prefix.inverted()@P.M[b.name];loc,quat,scale=basis_.decompose()
  if b.name in PREV and PREV[b.name].dot(quat)<0:quat.negate()
  PREV[b.name]=quat.copy()
  pb.rotation_mode='QUATERNION';pb.location=loc;pb.rotation_quaternion=quat;pb.scale=(1,1,1)

def rest_check():
 P=build_pose(rest_controls());worst=0.0
 for b in bones:
  rest=RESTM[b.name];prefix=P.M[b.parent.name]@RESTI[b.parent.name]@rest if b.parent else rest
  basis_=prefix.inverted()@P.M[b.name]
  worst=max(worst,max(abs(basis_[i][j]-(1 if i==j else 0)) for i in range(4) for j in range(4)))
 return worst,P.tail_pitch

def init_guards():
 global REST_TAIL
 P=build_pose(rest_controls(),guards=False)
 for s in 'RL':REST_FOOT_LOW[s]=foot_low(P,s)
 REST_TAIL=tail_bottoms(P)

if __name__=='__main__':
 scene=bpy.context.scene;scene.render.fps=FPS;scene.frame_start=0;scene.frame_end=90
 assert scene.get('work_order')=='WO111' and scene.get('scene_lease')=='active' and scene.get('asset_id')=='inator-monster'
 init_guards()
 err,rest_pitch=rest_check();assert err<1e-4 and rest_pitch==0.0,('rest controls do not reproduce the bind pose',err,rest_pitch)
 arm.animation_data_clear();arm.animation_data_create()
 for action in list(bpy.data.actions):bpy.data.actions.remove(action)
 records=[];guard_log={}
 for name,duration,loop in CLIPS:
  action=bpy.data.actions.new(name);arm.animation_data.action=action;end=round(duration*FPS);PREV.clear();pitches=[]
  for frame in range(end+1):
   scene.frame_set(frame);P=build_pose(evaluate(name,frame/end,duration));pitches.append(P.tail_pitch);apply(P)
   for pb in arm.pose.bones:
    if pb.name=='root':continue
    for field in ('location','rotation_quaternion'):pb.keyframe_insert(data_path=field,frame=frame,group=pb.name)
  for fc in action.fcurves:
   for k in fc.keyframe_points:k.interpolation='LINEAR'
  track=arm.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,0,action);strip.action_frame_start=0;strip.action_frame_end=end;track.mute=True
  guard_log[name]={'max_tail_pitch_rad':round(max(pitches),4),'frames_with_tail_lift':sum(1 for p in pitches if p>0)}
  records.append({'name':name,'duration_s':duration,'loop':loop,'clamp_when_finished':not loop,'frames':end+1,'fps':FPS,
   'contact_time_s':round(CONTACT*duration,4) if name=='attack' else None,'contact_fraction':CONTACT if name=='attack' else None,
   'held_final_pose_from_s':round(DEFEAT_HOLD*duration,4) if name=='defeat' else None})
 arm.animation_data.action=None
 for pb in arm.pose.bones:pb.matrix_basis=Matrix.Identity(4)
 scene.frame_set(0);bpy.context.view_layer.update()
 arm['attack_contact_seconds']=1.25;arm['attack_contact_fraction']=CONTACT
 bp=ROOT/'source/bounds.json'
 if bp.exists():
  br=json.loads(bp.read_text());skin['model_space_bounds_y_up']=br['safe_culling_envelope'];skin['bounds_method']=br['method']
 for name in ('build.py','common.py','animate.py'):
  old=bpy.data.texts.get('WO111 inator monster '+name)
  if old:bpy.data.texts.remove(old)
  block=bpy.data.texts.new('WO111 inator monster '+name);block.write((ROOT/'source'/name).read_text())
 bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'inator-monster.blend'),compress=True)
 bpy.ops.export_scene.gltf(filepath=str(ROOT/'inator-monster.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_def_bones=False,export_armature_object_remove=True,export_all_influences=False,export_influence_nb=4,export_apply=False,export_texcoords=True,export_normals=True,export_tangents=False,export_materials='EXPORT',export_vertex_color='NONE',export_image_format='AUTO',export_all_vertex_colors=False,export_cameras=False,export_lights=False,export_extras=True)
 record=json.loads((ROOT/'construction.json').read_text());record['clips']=records;record['rest_reproduction_max_error']=err;record['floor_guards']=guard_log
 record['pupil_cross_angles_rad']={'R':CROSS_R,'L':CROSS_L}
 record['files']={name:{'bytes':(ROOT/name).stat().st_size,'sha256':hashlib.sha256((ROOT/name).read_bytes()).hexdigest()} for name in ['inator-monster.blend','inator-monster.glb','pigment.png']}
 (ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({'clips':[(r['name'],r['frames']) for r in records],'rest_error':err,'guards':guard_log,'files':record['files']}))
