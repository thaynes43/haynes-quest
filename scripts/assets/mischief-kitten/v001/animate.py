"""WO111 mischief-kitten acting, baked at 30 fps into exactly five NLA clips.

idle   3.0 s loop  the sheet's sneaky tiptoe: right forepaw raised and curled (toe beans out), a
                   quick paw tap, smug head tilt, cocked-ear twitches, tail-tip flicks, antenna
                   wobble and a lazy propeller
move   0.8 s loop  bouncy in-place trot (diagonal pairs), pack and antenna jiggle, bell swing,
                   tail sway, ear flop, fast propeller
attack 2.0 s       pounce: crouch, bottom wiggle while the propeller spins up, spring forward and
                   bop the floor with both forepaws at 1.25 s (contact), belly-flop squash, hop
                   back to its spot
hit    0.7 s       startled hop back: hat pops up, ears flatten, tail bristles straight, recovers
defeat 2.4 s       knocked up into a spinning tumble, plops down sitting on its bottom, dizzy head
                   wobble, hat slides over its eye, tongue out; held from 1.92 s

Legs are two-bone IK chains solved with bend-plane frames (front elbows back, hind knees forward).
Leg targets are world points (planted paws) or points carried rigidly by the chest/hips (airborne
or spinning paws), blended per leg. The bind pose is four paws down; the controls at rest
reproduce it exactly (asserted below). The root never moves; the body travels only through the
hips and always returns.
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler, Quaternion
ROOT=Path('/workspace/haynes-quest/family-eras/mischief-kitten/v001')
FPS=30
arm=bpy.data.objects['Mischief_Kitten_Rig'];skin=bpy.data.objects['Mischief_Kitten_Skin'];bones=arm.data.bones
CLIPS=[('idle',3.0,True),('move',0.8,True),('attack',2.0,False),('hit',.7,False),('defeat',2.4,False)]
CONTACT=.625;DEFEAT_HOLD=.80
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
def pole_of(S,E,W):
 line=(W-S).normalized();return ((E-S)-line*(E-S).dot(line)).normalized()
LEGS={}
for s in 'RL':
 LEGS['F'+s]=dict(up='front_upper_'+s,lo='front_lower_'+s,paw='front_paw_'+s,parent='chest')
 LEGS['H'+s]=dict(up='hind_thigh_'+s,lo='hind_shin_'+s,paw='hind_paw_'+s,parent='hips')
for k,L in LEGS.items():
 L['S'],L['E'],L['W']=head_of(L['up']),head_of(L['lo']),head_of(L['paw'])
 L['l1']=(L['E']-L['S']).length;L['l2']=(L['W']-L['E']).length;L['pole']=pole_of(L['S'],L['E'],L['W'])
TAILS=['tail_%d'%(k+1) for k in range(6)]
# Rest curl axis per tail bone: normal of the plane through this bone and the next (the question mark bends about it).
CURL_AXIS={}
for i,n in enumerate(TAILS):
 d0=(tail_of(n)-head_of(n)).normalized()
 d1=(tail_of(TAILS[min(i+1,5)])-head_of(TAILS[min(i+1,5)])).normalized() if i<5 else d0
 ax=d0.cross(d1)
 if ax.length<1e-4:ax=CURL_AXIS[TAILS[i-1]] if i else V(1,0,0)
 CURL_AXIS[n]=ax.normalized()
BODY_PIVOT=V(0,-.03,.29)   # hips rotate about the body centre, not the rump
HAT_REST_POS=head_of('hat');HAT_REST_AXIS=(tail_of('hat')-head_of('hat')).normalized()
def _head_surface(x,z):
 prof=[(0.395,0.02),(0.405,0.10),(0.425,0.160),(0.46,0.205),(0.52,0.232),(0.585,0.238),(0.65,0.228),(0.705,0.203),(0.75,0.160),(0.782,0.100),(0.798,0.035),(0.80,0.0)]
 def r(z):
  for (z0,r0),(z1,r1) in zip(prof,prof[1:]):
   if z0<=z<=z1:return r0+(r1-r0)*(z-z0)/(z1-z0)
  return 0.0
 y=0.20+0.82*math.sqrt(max(0,r(z)**2-x*x));h=1e-3
 dr=(r(z+h)-r(z-h))/(2*h);n=V(x,(y-0.20)/0.82**2,-r(z)*dr).normalized()
 return V(x,y,z),n
_p,_n=_head_surface(-0.075,0.685)
HAT_DZ_SHIFT=_p+_n*0.012-HAT_REST_POS
_axis=(_n+V(0,0,-0.10)).normalized()
HAT_DZ_ROT=HAT_REST_AXIS.rotation_difference(_axis).to_euler()
EAR_AXIS={s:(tail_of('ear_'+s)-head_of('ear_'+s)).normalized() for s in 'RL'}

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
 def put(self,n,head,R3):self.M[n]=Matrix.Translation(head)@R3.to_4x4()
 def follow(self,n,rot=None,shift=None,pre=None):
  """World-aligned rotation `rot` (Euler, parent-delta frame) and optional pre-rotation matrix about the bone head."""
  b=bones[n];rest=RESTM[n]
  if b.parent:D=self.delta(b.parent.name);head=self.point(b.parent.name,rest.translation)
  else:D=Matrix.Identity(3);head=rest.translation.copy()
  if shift is not None:head=head+D@Vector(shift)
  R=Euler(rot).to_matrix() if rot is not None else Matrix.Identity(3)
  if pre is not None:R=R@pre
  self.put(n,head,D@R@rot3(rest))
 def leg(self,key,target,pole,paw_R):
  L=LEGS[key];S=self.point(L['parent'],L['S'])
  E,W=solve_two(S,target,L['l1'],L['l2'],pole)
  S0,E0,W0=L['S'],L['E'],L['W'];n0=(E0-S0).cross(W0-E0);n1=(E-S).cross(W-E)
  if n1.length<1e-7:n1=n0
  self.put(L['up'],S,frame_rot(E0-S0,n0,E-S,n1)@rot3(RESTM[L['up']]))
  self.put(L['lo'],E,frame_rot(W0-E0,n0,W-E,n1)@rot3(RESTM[L['lo']]))
  Wp=self.M[L['lo']]@RESTM[L['lo']].inverted()@W0
  self.put(L['paw'],Wp,paw_R@rot3(RESTM[L['paw']]))

def rest_controls():
 c={'hips_shift':V(0,0,0),'hips_rot':V(0,0,0),'chest_rot':V(0,0,0),'neck_rot':V(0,0,0),'head_rot':V(0,0,0),
  'ear_R':V(0,0,0),'ear_L':V(0,0,0),'ear_twist_R':0.0,'ear_twist_L':0.0,'hat_shift':V(0,0,0),'hat_rot':V(0,0,0),'tongue':V(0,0,0),'bell':V(0,0,0),
  'pack':V(0,0,0),'ant1':V(0,0,0),'ant2':V(0,0,0),'prop':0.0,
  'tail_rot':[V(0,0,0) for _ in TAILS],'tail_curl':[0.0]*6}
 for k,L in LEGS.items():
  c['t_'+k]=L['W'].copy();c['carry_'+k]=0.0;c['local_'+k]=L['W'].copy();c['pole_'+k]=L['pole'].copy();c['paw_'+k]=V(0,0,0);c['pawl_'+k]=V(0,0,0)
 return c

def build_pose(c):
 P=Pose()
 P.put('root',head_of('root'),rot3(RESTM['root']))
 R=Euler(c['hips_rot']).to_matrix();piv=BODY_PIVOT
 P.put('hips',piv+R@(head_of('hips')-piv)+c['hips_shift'],R@rot3(RESTM['hips']))
 P.follow('chest',c['chest_rot']);P.follow('neck',c['neck_rot']);P.follow('head',c['head_rot'])
 P.follow('hat',c['hat_rot'],c['hat_shift']);P.follow('tongue',c['tongue'])
 for s in 'RL':P.follow('ear_'+s,c['ear_'+s],pre=Matrix.Rotation(c['ear_twist_'+s],3,EAR_AXIS[s]))
 P.follow('bell',c['bell'])
 P.follow('pack',c['pack']);P.follow('antenna_1',c['ant1']);P.follow('antenna_2',c['ant2'])
 pax=(tail_of('propeller')-head_of('propeller')).normalized()
 P.follow('propeller',pre=Matrix.Rotation(c['prop'],3,pax))
 for i,n in enumerate(TAILS):P.follow(n,c['tail_rot'][i],pre=Matrix.Rotation(c['tail_curl'][i],3,CURL_AXIS[n]))
 for k,L in LEGS.items():
  w=c['carry_'+k];D=P.delta(L['parent'])
  target=Vector(c['t_'+k]).lerp(P.point(L['parent'],c['local_'+k]),w)
  target.z=max(target.z,L['W'].z+.014*w)   # an ankle never drops below its planted height; carried paws clear it
  pole=(Vector(c['pole_'+k])).lerp(D@Vector(c['pole_'+k]),w)
  qa=Euler(c['paw_'+k]).to_matrix().to_quaternion();qb=(D@Euler(c['pawl_'+k]).to_matrix()).to_quaternion()
  P.leg(k,target,pole,qa.slerp(qb,w).to_matrix())
 return P

# ---------------- acting ----------------
def prop_angle(t,duration,rate_fn=None,loop_revs=None,snap=False):
 """Integrated propeller angle; loops (and snapped one-shots) end on a whole number of revolutions."""
 if loop_revs is not None:return math.tau*loop_revs*t
 def integral(x):
  steps=max(1,int(400*x));acc=0.0
  for i in range(steps):acc+=rate_fn((i+.5)/steps*x)*x/steps
  return acc*duration
 a=integral(t)
 if snap:
  total=integral(1.0);a*=max(1,round(total))/total
 return math.tau*a

FR=LEGS['FR']['W'];FL=LEGS['FL']['W'];HR=LEGS['HR']['W'];HL=LEGS['HL']['W']
RAISED_R=V(0.112,0.238,0.207)          # sheet tiptoe: right wrist lifted forward, paw curled
RAISED_POLE=V(0,-.35,-1).normalized()
def raise_right(c,amount,curl):
 c['t_FR']=FR.lerp(RAISED_R,amount);c['pole_FR']=LEGS['FR']['pole'].lerp(RAISED_POLE,amount).normalized()
 c['paw_FR']=V(1.05*curl,0,-.10*curl)

def evaluate(clip,t):
 c=rest_controls();tau=math.tau*t;sn=math.sin(tau);cs=math.cos(tau)
 if clip=='idle':
  # paw raised at t=0 (sheet pose); quick tap down at 0.42-0.62; toe-bean tease wiggles
  tap=keyed(t,[(0,0),(.40,0),(.48,1),(.54,1),(.64,0),(1,0)])
  lift=1-tap;curl=1-.85*tap+.12*math.sin(2*tau)*lift
  raise_right(c,lift,curl)
  c['t_FR']=c['t_FR']+V(0,.035*tap,0)
  c['hips_shift']=V(0,0,-.006*(.5-.5*math.cos(2*tau)))
  c['chest_rot']=V(-.02*(.5-.5*math.cos(2*tau)),0,.02*sn)
  c['head_rot']=V(.03*math.sin(2*tau+.4),0,.07*math.sin(tau+.3))
  c['neck_rot']=V(0,0,.03*sn)
  twL=bell(t,.30,.06)+bell(t,.80,.06)
  c['ear_L']=V(-.10*twL,-.26*twL,0);c['ear_twist_L']=.25*twL
  c['ear_R']=V(-.22*bell(t,.58,.05),0,0)
  flick=math.sin(4*tau)
  c['tail_rot'][0]=V(0,0,.07*sn);c['tail_rot'][1]=V(0,0,.05*math.sin(tau-.5))
  c['tail_curl'][3]=.10*math.sin(2*tau-.8);c['tail_curl'][4]=.22*flick;c['tail_curl'][5]=.30*math.sin(4*tau-.6)
  c['tongue']=V(.12*math.sin(3*tau),0,.08*math.sin(2*tau))
  c['ant2']=V(.07*math.sin(2*tau+.4),.05*math.sin(tau),0);c['ant1']=V(.03*math.sin(2*tau),0,0)
  c['bell']=V(.10*math.sin(2*tau),0,.05*sn);c['hat_rot']=V(.02*math.sin(2*tau-.6),.02*sn,0)
  c['prop']=prop_angle(t,3.0,loop_revs=2)
 elif clip=='move':
  bounce=.5-.5*math.cos(2*tau)
  c['hips_shift']=V(.006*sn,0,-.012+.024*bounce)
  c['hips_rot']=V(.04*math.sin(2*tau+.6),.03*sn,.04*sn)
  c['chest_rot']=V(-.05*math.sin(2*tau+.9),0,-.03*sn)
  c['head_rot']=V(.06*math.sin(2*tau+1.8),.03*sn,-.03*sn)
  for k,off,base in (('FR',0.0,FR),('HL',0.0,HL),('FL',math.pi,FL),('HR',math.pi,HR)):
   ph=tau+off;up=max(0.0,math.sin(ph))
   c['t_'+k]=base+V(0,.055*math.cos(ph),.045*up)
   c['paw_'+k]=V(.35*up*(1 if k[0]=='F' else -.6),0,0)
  flop=math.sin(2*tau+2.2)
  c['ear_R']=V(-.18*flop,0,0);c['ear_L']=V(-.22*flop,0,.05*flop)
  c['tail_rot'][0]=V(.05*math.sin(2*tau+.5),0,.14*sn);c['tail_rot'][1]=V(0,0,.08*math.sin(tau-.6))
  c['tail_curl'][2]=.06*math.sin(2*tau+1);c['tail_curl'][4]=.12*math.sin(2*tau+1.6);c['tail_curl'][5]=.16*math.sin(2*tau+2.2)
  c['pack']=V(.10*math.sin(2*tau+1.4),0,.04*sn)
  c['ant1']=V(.10*math.sin(2*tau+1.9),.05*sn,0);c['ant2']=V(.20*math.sin(2*tau+2.4),.10*math.sin(tau+.6),0)
  c['bell']=V(.30*math.sin(2*tau+1.7),0,.12*sn)
  c['hat_rot']=V(.06*math.sin(2*tau+2.0),.03*sn,0);c['hat_shift']=V(0,0,.008*max(0,math.sin(2*tau+2.3)))
  c['tongue']=V(.15*math.sin(2*tau+2),0,0)
  c['prop']=prop_angle(t,.8,loop_revs=3)
 elif clip=='attack':
  crouch=keyed(t,[(0,0),(.06,0),(.24,1),(.44,1),(.47,1.15),(.52,0),(1,0)])
  wig=keyed(t,[(0,0),(.20,0),(.26,1),(.42,1),(.46,0),(1,0)])   # about 4.8 Hz: two wiggles in 0.42 s
  leap=keyed(t,[(0,0),(.46,0),(.535,1),(CONTACT,0),(1,0)])        # airborne height
  fwd=keyed(t,[(0,0),(.46,0),(CONTACT,1),(.74,1),(.92,0),(1,0)])  # forward travel of the body
  reach=keyed(t,[(0,0),(.47,0),(.55,1),(.60,1),(CONTACT,0),(1,0)]) # forepaws reaching up/forward in the air
  squash=keyed(t,[(0,0),(.60,0),(CONTACT,1),(.70,1),(.80,0),(1,0)])
  hop=bell(t,.84,.06)                                              # little hop back to the spot
  wv=math.sin(math.tau*2*(t-.25)/.21)*wig if .25<=t<=.46 else 0.0
  TRAVEL=.30
  c['hips_shift']=V(.018*wv,TRAVEL*fwd,-.045*crouch+.13*leap-.045*squash+.035*hop)
  c['hips_rot']=V(-.07*crouch-.08*wig+.20*leap*(1-reach*.5)-.14*squash,.05*wv,.13*wv)
  c['chest_rot']=V(-.20*crouch+.08*leap-.26*squash+.10*reach,0,-.10*wv)
  c['neck_rot']=V(-.04*crouch-.04*squash,0,0)
  c['head_rot']=V(.15*crouch-.10*leap+.10*squash,0,.05*wv)
  c['ear_R']=V(-.28*crouch-.30*squash+.35*leap,0,0);c['ear_L']=V(-.25*crouch-.30*squash+.40*leap,-.12*crouch,0)
  c['hat_shift']=V(0,0,.035*bell(t,.53,.06)+.01*squash);c['hat_rot']=V(-.12*leap+.10*squash,0,.05*wv)
  # forepaws: planted until take-off, carried forward and up in flight, slam down in front at contact
  for s,base in (('R',FR),('L',FL)):
   k='F'+s;land=base+V(0,TRAVEL+.06,0)
   air=keyed(t,[(0,0),(.46,0),(.50,1),(.60,1),(CONTACT,0),(1,0)])
   c['carry_'+k]=air;c['local_'+k]=LEGS[k]['W']+V(0,.12,.14)*reach
   planted=base.lerp(land,smooth((t-.55)/(CONTACT-.55)))
   if t>.80:planted=land.lerp(base,smooth((t-.80)/.12))+V(0,0,.05*hop)
   c['t_'+k]=planted
   c['pawl_'+k]=V(.55*reach,0,0);c['paw_'+k]=V(0,0,.10*squash*(1 if s=='R' else -1))
   c['pole_'+k]=LEGS[k]['pole']
  for s,base in (('R',HR),('L',HL)):
   k='H'+s;air=keyed(t,[(0,0),(.47,0),(.50,1),(.57,1),(.63,0),(1,0)])
   c['carry_'+k]=air;c['local_'+k]=LEGS[k]['W']+V(0,-.07,.05)
   land=base+V(0,TRAVEL,0)
   planted=base.lerp(land,smooth((t-.55)/(.63-.55)))
   if t>.80:planted=land.lerp(base,smooth((t-.80)/.12))+V(0,0,.05*hop)
   c['t_'+k]=planted;c['pawl_'+k]=V(-.30*air,0,0)
  tw=math.sin(math.tau*6*t)
  c['tail_rot'][0]=V(.20*crouch-.25*leap+.15*squash,0,.10*wv);c['tail_rot'][1]=V(0,0,-.08*wv)
  c['tail_curl'][3]=.10*tw*crouch;c['tail_curl'][4]=.25*tw*wig-.35*leap;c['tail_curl'][5]=.35*math.sin(math.tau*6*t-.7)*wig-.40*leap
  c['pack']=V(.22*crouch-.10*leap+.14*squash,0,.05*wv);c['ant1']=V(-.15*leap+.20*squash,0,.08*wv);c['ant2']=V(-.30*leap+.35*squash+.08*tw*wig,0,.12*wv)
  c['bell']=V(-.40*leap+.30*squash,0,.10*wv);c['tongue']=V(.20*squash,0,0)
  rate=lambda x:.4+3.2*keyed(x,[(0,0),(.20,0),(.44,1),(.70,1),(1,.2)])
  c['prop']=prop_angle(t,2.0,rate,snap=True)
 elif clip=='hit':
  recoil=keyed(t,[(0,0),(.14,1),(.45,.3),(.80,0),(1,0)])
  hop=keyed(t,[(0,0),(.05,0),(.22,1),(.42,0),(1,0)])
  pop=keyed(t,[(0,0),(.06,0),(.26,1),(.50,0),(.58,.12),(.66,0),(1,0)])
  flat=keyed(t,[(0,0),(.08,1),(.55,1),(.90,0),(1,0)])
  bris=keyed(t,[(0,0),(.08,1),(.50,.7),(.92,0),(1,0)])
  c['hips_shift']=V(0,-.05*recoil,.05*hop)
  c['hips_rot']=V(.12*recoil,0,0);c['chest_rot']=V(.10*recoil,0,0);c['head_rot']=V(.10*recoil,.05*recoil,0)
  for k,base in (('FR',FR),('FL',FL),('HR',HR),('HL',HL)):
   c['carry_'+k]=hop;c['local_'+k]=LEGS[k]['W']+V(.025*(1 if k[1]=='R' else -1),0,-.01)
   c['t_'+k]=base+V(0,-.05*recoil,0)
  c['hat_shift']=V(0,-.01*pop,.11*pop);c['hat_rot']=V(-.30*pop,.25*pop,0)
  c['ear_R']=V(.95*flat,.25*flat,0);c['ear_L']=V(.85*flat,-.30*flat,0)
  c['tail_rot'][0]=V(-.95*bris,0,-.35*bris)
  for i in range(1,6):c['tail_curl'][i]=-.26*bris
  osc=math.sin(math.tau*3*t)*(1-t)**2
  c['pack']=V(.25*recoil+.15*osc,0,0);c['ant2']=V(.45*osc,.15*osc,0);c['ant1']=V(.15*osc,0,0);c['bell']=V(.5*osc,0,0)
  c['tongue']=V(-.3*flat,0,0)
  c['prop']=math.tau*smooth(t)
 elif clip=='defeat':
  knock=keyed(t,[(0,0),(.06,1),(.12,1),(1,1)])
  air=keyed(t,[(0,0),(.05,0),(.12,1),(.40,1),(.47,0),(1,0)])      # off the floor while spinning
  spin=keyed(t,[(0,0),(.10,0),(.44,1),(1,1)])
  sit=keyed(t,[(0,0),(.40,0),(.52,1),(.56,.9),(.62,1),(1,1)])
  dz=keyed(t,[(0,0),(.52,0),(.60,1),(1,1)])
  hold=keyed(t,[(0,0),(.56,0),(DEFEAT_HOLD,1),(1,1)])
  wob=math.sin(math.tau*2.5*(t-.56)/(DEFEAT_HOLD-.56))*(1-hold) if .56<t<DEFEAT_HOLD else 0.0
  wob2=math.cos(math.tau*2.5*(t-.56)/(DEFEAT_HOLD-.56))*(1-hold) if .56<t<DEFEAT_HOLD else 0.0
  bank=.22*math.sin(math.pi*spin)*air
  SIT_SHIFT=V(0,-.03,-.036);SIT_PITCH=.62
  c['hips_shift']=V(0,0,.13*air)+SIT_SHIFT*sit
  c['hips_rot']=V(SIT_PITCH*sit-.10*air,bank,math.tau*spin)
  c['chest_rot']=V(.10*sit,0,0);c['neck_rot']=V(-.25*sit,0,0)
  c['head_rot']=V(-.18*sit+.10*air+.08*wob2*dz+.06*hold,.20*wob*dz+.24*hold,.06*wob*dz)
  for k in LEGS:
   c['carry_'+k]=air if k[0]=='F' else air
  # sitting legs: forepaws dangle limply in front of the chest, hind paws on the floor beside the rump
  for s,sx in (('R',1),('L',-1)):
   k='F'+s;c['carry_'+k]=max(air,sit);c['local_'+k]=LEGS[k]['W'].lerp(V(.12*sx,.25,.085),sit)
   c['pole_'+k]=LEGS[k]['pole'].lerp(V(0,-.2,-1).normalized(),sit).normalized();c['pawl_'+k]=V(.9*sit,0,.15*sx*sit)
   k='H'+s;c['carry_'+k]=air;c['local_'+k]=LEGS[k]['W']+V(0,0,-.005)
   c['t_'+k]=LEGS[k]['W'].lerp(V(.15*sx,.02,LEGS[k]['W'].z),sit)
   c['paw_'+k]=V(0,0,.35*sx*sit)
  c['hat_shift']=V(0,0,.12*bell(t,.10,.10)+.07*math.sin(math.pi*dz))+HAT_DZ_SHIFT*dz
  c['hat_rot']=V(-.35*bell(t,.14,.12),0,0)+V(*HAT_DZ_ROT)*dz
  c['ear_R']=V(.45*knock*(1-dz)+.15*dz,.55*dz,0);c['ear_L']=V(.45*knock*(1-dz)+.20*dz,-.80*dz,0);c['ear_twist_L']=.35*dz
  c['tongue']=V(.35*dz,0,.25*dz)
  limp=keyed(t,[(0,0),(.40,0),(.60,1),(1,1)])
  # limp: the question-mark curl lies down flat on the floor beside the seated kitten (searched pose, clear of floor and head)
  c['tail_rot'][0]=V(1.1*limp,-.6*limp,.5*limp+.30*air*(1-limp));c['tail_curl'][1]=-.4*limp
  c['pack']=V(.20*bell(t,.52,.06),0,0);c['ant1']=V(.25*dz,.20*dz,0);c['ant2']=V(.55*dz+.2*wob,.45*dz,0);c['bell']=V(.3*wob,0,.2*wob2)
  rate=lambda x:1.4*(1-smooth(x/DEFEAT_HOLD))
  c['prop']=prop_angle(min(t,DEFEAT_HOLD),2.4,rate)
 return c

PREV={}
def apply(P):
 for b in bones:
  pb=arm.pose.bones[b.name];rest=RESTM[b.name]
  prefix=P.M[b.parent.name]@RESTM[b.parent.name].inverted()@rest if b.parent else rest
  basis_=prefix.inverted()@P.M[b.name];loc,quat,scale=basis_.decompose()
  if b.name in PREV and PREV[b.name].dot(quat)<0:quat.negate()
  PREV[b.name]=quat.copy()
  pb.rotation_mode='QUATERNION';pb.location=loc;pb.rotation_quaternion=quat;pb.scale=(1,1,1)

def rest_check():
 P=build_pose(rest_controls());worst=0.0
 for b in bones:
  rest=RESTM[b.name];prefix=P.M[b.parent.name]@RESTM[b.parent.name].inverted()@rest if b.parent else rest
  basis_=prefix.inverted()@P.M[b.name]
  worst=max(worst,max(abs(basis_[i][j]-(1 if i==j else 0)) for i in range(4) for j in range(4)))
 return worst

def bake(export=True):
 scene=bpy.context.scene;scene.render.fps=FPS;scene.frame_start=0;scene.frame_end=90
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
    for field in ('location','rotation_quaternion'):pb.keyframe_insert(data_path=field,frame=frame,group=pb.name)
  for fc in action.fcurves:
   for k in fc.keyframe_points:k.interpolation='LINEAR'
  track=arm.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,0,action);strip.action_frame_start=0;strip.action_frame_end=end;track.mute=True
  records.append({'name':name,'duration_s':duration,'loop':loop,'clamp_when_finished':not loop,'frames':end+1,'fps':FPS,
   'contact_time_s':round(CONTACT*duration,4) if name=='attack' else None,'contact_fraction':CONTACT if name=='attack' else None,
   'held_final_pose_from_s':round(DEFEAT_HOLD*duration,4) if name=='defeat' else None})
 arm.animation_data.action=None
 for pb in arm.pose.bones:pb.matrix_basis=Matrix.Identity(4)
 scene.frame_set(0);bpy.context.view_layer.update()
 return err,records

if __name__=='__main__':
 scene=bpy.context.scene
 assert scene.get('work_order')=='WO111' and scene.get('scene_lease')=='active' and scene.get('asset_id')=='mischief-kitten'
 assert scene.get('scene_owner')=='claude-opus-5-5/mischief-kitten-model'
 err,records=bake()
 arm['attack_contact_seconds']=1.25;arm['attack_contact_fraction']=CONTACT
 bp=ROOT/'source/bounds.json'
 if bp.exists():
  br=json.loads(bp.read_text());skin['model_space_bounds_y_up']=br['safe_culling_envelope'];skin['bounds_method']=br['method']
 for name in ('build.py','common.py','animate.py'):
  old=bpy.data.texts.get('WO111 mischief kitten '+name)
  if old:bpy.data.texts.remove(old)
  block=bpy.data.texts.new('WO111 mischief kitten '+name);block.write((ROOT/'source'/name).read_text())
 bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'mischief-kitten.blend'),compress=True)
 bpy.ops.export_scene.gltf(filepath=str(ROOT/'mischief-kitten.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_def_bones=False,export_armature_object_remove=True,export_all_influences=False,export_influence_nb=4,export_apply=False,export_texcoords=True,export_normals=True,export_tangents=False,export_materials='EXPORT',export_vertex_color='NONE',export_image_format='AUTO',export_all_vertex_colors=False,export_cameras=False,export_lights=False,export_extras=True)
 record=json.loads((ROOT/'construction.json').read_text());record['clips']=records;record['rest_reproduction_max_error']=err
 record['files']={name:{'bytes':(ROOT/name).stat().st_size,'sha256':hashlib.sha256((ROOT/name).read_bytes()).hexdigest()} for name in ['mischief-kitten.blend','mischief-kitten.glb','pigment.png']}
 (ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({'clips':[(r['name'],r['frames']) for r in records],'rest_error':err,'files':record['files']}))
