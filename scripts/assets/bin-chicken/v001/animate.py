"""WO111 bin-chicken acting, baked at 30 fps into exactly five NLA clips.

idle   3.0 s loop  the sheet's sneaky "who, me?" pose (head turned 17 deg right and tilted 7 deg,
                   left foot on tiptoe): tiptoe shuffle, head bobs, a quick side glance to its left
                   with a raised brow, a slow half-lid blink, the stolen chip wiggling in its beak
move   1.0 s loop  jerky head-bobbing strut on stilt legs (fast head thrust, slow return per step),
                   peel flaps flopping, plumes swishing
attack 2.0 s       crouches, rears back with the neck coiled and the eyes squinting, quivers, then
                   lunges with a long beak jab ("chip snatch") landing at 1.25 s (contact), holds,
                   recovers and flips the chip smugly back into its beak
hit    0.7 s       recoil and neck whip, the banana peel pops up off its head, the loot chips jump
                   out of the cone, wings flare, feathers settle
defeat 2.4 s       startled hop, DROPS THE CHIP (it falls to the floor in front), flops belly-down
                   with the legs splayed behind and the neck draped along the floor, the peel slides
                   over its eyes and the cone tips over; held from 1.80 s

Legs are two-bone IK chains solved in the armature's rest space with bend-plane frames. The bind
pose is neutral (head straight, feet flat); rest controls reproduce it exactly (asserted). The
sheet design pose is idle at 0 s. No root motion.
"""
import bpy, math, json, hashlib, sys
from pathlib import Path
from mathutils import Vector, Matrix, Euler, Quaternion
ROOT=Path('/workspace/haynes-quest/family-eras/bin-chicken/v001')
FPS=30
arm=bpy.data.objects['Bin_Chicken_Rig'];skin=bpy.data.objects['Bin_Chicken_Skin'];bones=arm.data.bones
CLIPS=[('idle',3.0,True),('move',1.0,True),('attack',2.0,False),('hit',.7,False),('defeat',2.4,False)]
CONTACT=.625;DEFEAT_HOLD=.75
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
LEG={s:(head_of('leg_'+s),head_of('shank_'+s),head_of('foot_'+s)) for s in 'RL'}
POLE_LEG0={s:pole_of(*LEG[s]) for s in 'RL'}
L_TH=(LEG['R'][1]-LEG['R'][0]).length;L_SH=(LEG['R'][2]-LEG['R'][1]).length
# Middle toe tip relative to the ball at rest (the tiptoe solve keeps its pad on the floor).
TOE_REL={'R':V(0.155*math.sin(math.radians(3)),0.155*math.cos(math.radians(3)),0.014-0.030),
         'L':V(-0.155*math.sin(math.radians(3)),0.155*math.cos(math.radians(3)),0.014-0.030)}
PAD=0.012;SOLE=0.002

def solve_two(a,target,l1,l2,pole):
 delta=target-a;dist=min(max(delta.length,1e-5),(l1+l2)*.9995);d=delta.normalized()
 side=Vector(pole)-d*d.dot(Vector(pole))
 if side.length<1e-5:side=Vector((0,-1,0))-d*d.y
 side.normalize();along=(l1*l1-l2*l2+dist*dist)/(2*dist)
 return a+d*along+side*math.sqrt(max(0,l1*l1-along*along)),a+d*dist
def basis(a,n):
 a=a.normalized();n=(n-a*a.dot(n)).normalized();return Matrix((a,n,a.cross(n))).transposed()
def frame_rot(a0,n0,a1,n1):return basis(a1,n1)@basis(a0,n0).transposed()

def tiptoe(s,ball_z,tip_y):
 """Ball target and foot pitch that keep the middle toe pad on the floor with the ball at ball_z."""
 rel=TOE_REL[s];lo,hi=-1.2,0.0
 f=lambda a:ball_z+(Matrix.Rotation(a,3,'X')@rel).z-PAD-SOLE
 if f(0.0)<=0:return V(LEG[s][2].x,tip_y-rel.y,ball_z),0.0
 for _ in range(50):
  mid=(lo+hi)/2
  if f(mid)>0:hi=mid
  else:lo=mid
 a=hi;y=(Matrix.Rotation(a,3,'X')@rel).y
 return V(LEG[s][2].x,tip_y-y,ball_z),a
REST_TIP_Y=LEG['R'][2].y+TOE_REL['R'].y

class Pose:
 def __init__(self):self.M={}
 def delta(self,n):return rot3(self.M[n])@rot3(RESTM[n]).inverted()
 def point(self,n,p):return self.M[n]@RESTM[n].inverted()@Vector(p)
 def put(self,n,head,R3):self.M[n]=Matrix.Translation(head)@R3.to_4x4()
 def follow(self,n,rot=None,shift=None,local_rot=None):
  b=bones[n];rest=RESTM[n]
  if b.parent:D=self.delta(b.parent.name);head=self.point(b.parent.name,rest.translation)
  else:D=Matrix.Identity(3);head=rest.translation.copy()
  if shift is not None:head=head+D@Vector(shift)
  R3=D@(Euler(rot).to_matrix() if rot is not None else Matrix.Identity(3))@rot3(rest)
  if local_rot is not None:R3=R3@Euler(local_rot).to_matrix()
  self.put(n,head,R3)
 def chain(self,up,fore,S0,E0,W0,S,target,pole):
  E,W=solve_two(S,target,L_TH,L_SH,pole)
  n0=(E0-S0).cross(W0-E0);n1=(E-S).cross(W-E)
  if n1.length<1e-6:n1=n0
  self.put(up,S,frame_rot(E0-S0,n0,E-S,n1)@rot3(RESTM[up]))
  self.put(fore,E,frame_rot(W0-E0,n0,W-E,n1)@rot3(RESTM[fore]))
  return E,W

def rest_controls():
 c={'hips_shift':V(0,0,0),'hips_rot':V(0,0,0),'chest_rot':V(0,0,0),'head_rot':V(0,0,0),'beak_rot':V(0,0,0),
  'chip_rot':V(0,0,0),'chip_shift':V(0,0,0),'chip_world':None,'chip_world_w':0.0,
  'peel_shift':V(0,0,0),'peel_rot':V(0,0,0),'lid':0.0,'brow_rot':V(0,0,0),'brow_shift':V(0,0,0),
  'loot_rot':V(0,0,0),'loot_shift':V(0,0,0),'chips_shift':V(0,0,0),'chips_rot':V(0,0,0),'tail_rot':V(0,0,0),
  'world_rot':{},'world_full':{}}
 for i in range(1,5):c['neck_%d'%i]=V(0,0,0)
 for f in ('flap_R','flap_B','flap_L'):c[f]=V(0,0,0)
 for s in 'RL':
  c['wing_'+s]=V(0,0,0);c['wing_tip_'+s]=V(0,0,0)
  c['ankle_'+s]=LEG[s][2].copy();c['foot_'+s+'_rot']=V(0,0,0);c['pole_leg_'+s]=POLE_LEG0[s].copy()
 return c

def override(P,c,n):
 """Blend a posed bone toward a world delta rotation from its rest orientation (position kept), or
 toward a full world placement (position, delta rotation from rest)."""
 if n in c['world_rot']:
  d,w=c['world_rot'][n]
  if w>0:
   q=(d.to_matrix()@rot3(RESTM[n])).to_quaternion()
   A=P.M[n];P.M[n]=Matrix.Translation(A.translation)@A.to_quaternion().slerp(q,w).to_matrix().to_4x4()
 if n in c['world_full']:
  (pos,d),w=c['world_full'][n]
  if w>0:
   q=(d.to_matrix()@rot3(RESTM[n])).to_quaternion()
   A=P.M[n];qq=A.to_quaternion().slerp(q,w)
   P.M[n]=Matrix.Translation(A.translation.lerp(Vector(pos),w))@qq.to_matrix().to_4x4()

def build_pose(c):
 P=Pose()
 P.put('root',head_of('root'),rot3(RESTM['root']))
 P.put('hips',head_of('hips')+c['hips_shift'],Euler(c['hips_rot']).to_matrix()@rot3(RESTM['hips']))
 P.follow('chest',c['chest_rot'])
 for i in range(1,5):P.follow('neck_%d'%i,c['neck_%d'%i])
 P.follow('head',c['head_rot']);override(P,c,'head');P.follow('beak',c['beak_rot'])
 P.follow('beak_chip',c['chip_rot'],c['chip_shift'])
 if c['chip_world'] is not None and c['chip_world_w']>0:
  A=P.M['beak_chip'];B=c['chip_world'];w=c['chip_world_w']
  q=A.to_quaternion().slerp(B.to_quaternion(),w);P.M['beak_chip']=Matrix.Translation(A.translation.lerp(B.translation,w))@q.to_matrix().to_4x4()
 P.follow('peel',c['peel_rot'],c['peel_shift'])
 for f in ('flap_R','flap_B','flap_L'):P.follow(f,c[f])
 P.follow('lid_L',local_rot=(-c['lid'],0,0));P.follow('brow_R',c['brow_rot'],c['brow_shift'])
 P.follow('loot',c['loot_rot'],c['loot_shift']);P.follow('loot_chips',c['chips_rot'],c['chips_shift']);override(P,c,'loot_chips')
 P.follow('tail',c['tail_rot'])
 for s in 'RL':
  P.follow('wing_'+s,c['wing_'+s]);P.follow('wing_tip_'+s,c['wing_tip_'+s])
  H0,K0,A0=LEG[s]
  P.chain('leg_'+s,'shank_'+s,H0,K0,A0,P.point('hips',H0),Vector(c['ankle_'+s]),Vector(c['pole_leg_'+s]))
  A=P.M['shank_'+s]@RESTM['shank_'+s].inverted()@A0
  P.put('foot_'+s,A,Euler(c['foot_'+s+'_rot']).to_matrix()@rot3(RESTM['foot_'+s]))
 return P

# ---------------- the sheet design pose ----------------
YAW=math.radians(-17);ROLL=math.radians(7)
SHEET_LEFT_TIP_Y=0.075
def sheet_pose(c,left_ball_z=0.07,right_ball_z=0.030,yaw=YAW,roll=ROLL):
 c['head_rot']=V(0,roll,yaw)
 tgt,a=tiptoe('L',left_ball_z,SHEET_LEFT_TIP_Y);c['ankle_L']=tgt;c['foot_L_rot']=V(a,0,0)
 tgt,a=tiptoe('R',right_ball_z,REST_TIP_Y);c['ankle_R']=tgt;c['foot_R_rot']=V(a,0,0)
 return c

def evaluate(clip,t):
 c=rest_controls();tau=math.tau*t;sn=math.sin(tau);cs=math.cos(tau)
 if clip=='sheet':
  sheet_pose(c)
 elif clip=='idle':
  glance=keyed(t,[(0,0),(.30,0),(.36,1),(.58,1),(.66,0),(1,0)])
  blink=keyed(t,[(0,0),(.80,0),(.84,1),(.88,0),(1,0)])
  shuffle=.5-.5*math.cos(2*tau)
  sheet_pose(c,left_ball_z=0.07-0.018*shuffle,right_ball_z=0.030+0.016*shuffle,
             yaw=YAW+glance*math.radians(30)+math.radians(3)*math.sin(2*tau),roll=ROLL-glance*math.radians(10))
  c['hips_shift']=V(0,0,-0.008*shuffle)
  c['chest_rot']=V(0.02*math.sin(2*tau),0,0.015*sn)
  c['neck_1']=V(-0.03*math.sin(2*tau),0,0);c['neck_3']=V(0.04*math.sin(2*tau+.6),0,0)
  c['head_rot']=c['head_rot']+V(-0.03*math.sin(2*tau+.9)+0.05*glance,0,0)
  c['brow_rot']=V(0.25*glance,0,0);c['brow_shift']=V(0,0,0.008*glance)
  c['lid']=0.9*blink
  c['chip_rot']=V(0,0.10*math.sin(3*tau),0.14*math.sin(4*tau))
  for f,ph in (('flap_R',0),('flap_B',.8),('flap_L',1.6)):c[f]=V(0.05*math.sin(2*tau+ph),0.04*math.sin(2*tau+ph+.5),0)
  for s,k in (('R',1),('L',-1)):
   c['wing_'+s]=V(0,-0.03*k*glance,0.02*k*glance+0.012*k*math.sin(2*tau))
   c['wing_tip_'+s]=V(0,0,0.01*k*math.sin(2*tau+.4))
  c['tail_rot']=V(0.06*math.sin(2*tau+.5),0,0.05*sn)
 elif clip=='move':
  for s,off in (('R',0.0),('L',math.pi)):
   ph=tau+off;swing=max(0.0,-math.sin(ph));lift=0.06*swing
   c['ankle_'+s]=LEG[s][2]+V(0,0.09*math.cos(ph),lift)
   c['foot_'+s+'_rot']=V(-0.30*swing*max(0.0,-math.cos(ph)),0,0)
   c['pole_leg_'+s]=POLE_LEG0[s]
  bob=0.5-0.5*math.cos(2*tau)
  c['hips_shift']=V(0.012*sn,0.0,-0.034+0.012*bob)
  c['hips_rot']=V(-0.05,0.03*sn,-0.06*sn)
  c['chest_rot']=V(-0.03,-0.02*sn,0.05*sn)
  u=(2*t)%1.0
  thrust=smooth(u/0.22) if u<0.22 else 1-smooth((u-0.22)/0.78)
  c['neck_1']=V(-0.10-0.16*thrust,0,0);c['neck_2']=V(-0.06-0.10*thrust,0,0);c['neck_3']=V(0.08+0.10*thrust,0,0)
  c['head_rot']=V(0.10+0.14*thrust,0,math.radians(-6)+0.04*sn)
  c['chip_rot']=V(0,0.12*math.sin(2*tau),0.10*math.sin(4*tau+.5))
  for f,ph in (('flap_R',0),('flap_B',.7),('flap_L',1.4)):c[f]=V(0.14*math.sin(4*tau-ph),0.10*math.sin(2*tau-ph),0)
  c['peel_rot']=V(0.04*math.sin(4*tau-.3),0,0)
  for s,k in (('R',1),('L',-1)):
   c['wing_'+s]=V(0,-0.05*k*bob,0.04*k+0.03*k*math.sin(2*tau+(0 if s=='R' else math.pi)))
   c['wing_tip_'+s]=V(0,0,0.02*k*math.sin(2*tau))
  c['tail_rot']=V(-0.10-0.08*bob,0,0.12*sn)
 elif clip=='attack':
  sheet_pose(c)
  face=keyed(t,[(0,0),(.10,1),(.80,1),(1,0)])
  crouch=keyed(t,[(0,0),(.10,1),(.16,.6),(.50,1),(.55,1),(.62,.2),(.80,0),(1,0)])
  rear=keyed(t,[(0,0),(.08,0),(.45,1),(.55,1),(CONTACT,0),(1,0)])
  lunge=keyed(t,[(0,0),(.55,0),(CONTACT,1),(.70,1),(.90,0),(1,0)])
  squint=keyed(t,[(0,0),(.10,0),(.35,1),(CONTACT,1),(.72,0),(1,0)])
  quiver=math.sin(math.tau*9*t)*keyed(t,[(0,0),(.40,0),(.44,1),(.54,1),(.56,0),(1,0)])
  flip=keyed(t,[(0,0),(.76,0),(.92,1),(1,1)])
  hop=math.sin(math.pi*min(1,max(0,(t-.76)/.16)))
  c['head_rot']=V(0,ROLL*(1-face),YAW*(1-face))
  c['hips_shift']=V(0,-0.025*rear+0.08*lunge,-0.028*crouch-0.02*lunge)
  c['hips_rot']=V(0.08*rear-0.22*lunge,0,0)
  c['chest_rot']=V(0.12*rear-0.14*lunge+0.02*quiver,0,0.03*quiver)
  c['neck_1']=V(0.30*rear-0.62*lunge,0,0);c['neck_2']=V(0.34*rear-0.30*lunge,0,0)
  c['neck_3']=V(-0.32*rear+0.05*lunge,0,0);c['neck_4']=V(-0.10*rear+0.05*lunge,0,0)
  c['head_rot']=c['head_rot']+V(0.20*rear+0.95*lunge+0.03*quiver,0,0.02*quiver)
  c['beak_rot']=V(0.05*rear-0.06*lunge,0,0)
  c['lid']=0.62*squint;c['brow_rot']=V(-0.30*squint,0,0.10*squint);c['brow_shift']=V(0,0.004*squint,-0.010*squint)
  c['chip_rot']=V(-math.tau*flip,0,0);c['chip_shift']=V(0,0,0.07*hop)
  for f,ph in (('flap_R',0),('flap_B',.5),('flap_L',1.0)):
   c[f]=V(-0.35*lunge+0.25*rear+0.05*quiver,0.10*math.sin(math.tau*3*t-ph)*(rear+lunge),0)
  for s,k in (('R',1),('L',-1)):
   c['wing_'+s]=V(0,-0.12*k*rear-0.05*k*lunge,0.10*k*rear+0.06*k*lunge)
   c['wing_tip_'+s]=V(0,0,0.04*k*quiver)
  c['tail_rot']=V(-0.20*rear+0.25*lunge,0,0.06*quiver)
  c['loot_rot']=V(0.02*quiver,0,0)
 elif clip=='hit':
  sheet_pose(c)
  recoil=keyed(t,[(0,0),(.16,1),(.45,.3),(.80,0),(1,0)])
  whip=keyed(t,[(0,0),(.22,1),(.52,.1),(.85,0),(1,0)])
  pop=keyed(t,[(0,0),(.06,0),(.30,1),(.52,0),(.60,.08),(.68,0),(1,0)])
  jump=keyed(t,[(0,0),(.05,0),(.26,1),(.50,0),(.58,.12),(.66,0),(1,0)])
  flare=keyed(t,[(0,0),(.14,1),(.55,.2),(1,0)])
  osc=math.sin(math.tau*3.5*t)*(1-t)**2*keyed(t,[(0,0),(.08,1),(1,1)])
  c['hips_shift']=V(0,-0.04*recoil,-0.015*recoil)
  c['hips_rot']=V(0.10*recoil,0,0.04*osc);c['chest_rot']=V(0.12*recoil,0,-0.05*recoil)
  c['neck_1']=V(0.22*whip,0,0);c['neck_2']=V(0.18*whip,0,0);c['neck_3']=V(-0.10*whip,0,0)
  c['head_rot']=c['head_rot']+V(0.30*whip,0.10*osc,0.12*whip)
  c['lid']=0.95*keyed(t,[(0,0),(.05,1),(.40,1),(.60,0),(1,0)])
  c['brow_rot']=V(0.35*recoil,0,0);c['brow_shift']=V(0,0,0.010*recoil)
  c['peel_shift']=V(0,-0.01*pop,0.11*pop);c['peel_rot']=V(-0.40*pop,0.25*pop,0.3*pop)
  c['chips_shift']=V(0,-0.02*jump,0.11*jump);c['chips_rot']=V(0.3*jump,0,0.5*jump)
  c['chip_rot']=V(0,0.30*osc,0.25*osc)
  env=keyed(t,[(0,0),(.08,1),(1,1)])*(1-t)
  for f,ph in (('flap_R',0),('flap_B',.6),('flap_L',1.2)):c[f]=V(0.35*math.sin(math.tau*3*t-ph)*env,0.2*osc,0)
  for s,k in (('R',1),('L',-1)):
   c['wing_'+s]=V(0,-0.30*k*flare,0.28*k*flare);c['wing_tip_'+s]=V(0,-0.1*k*flare,0.10*k*flare)
  c['tail_rot']=V(-0.35*flare,0,0.10*osc)
 elif clip=='defeat':
  c=defeat_controls(t)
 return c

# ---------------- defeat: drop the chip, flop belly-down, held ----------------
T_RELEASE=0.07;T_LAND=0.26
CHIP_FLOOR=Matrix.Translation((0.30,0.70,0.0115))@Euler((0,0,0.55)).to_matrix().to_4x4()
_M0=None
def defeat_controls(t,with_chip=True):
 global _M0
 c=rest_controls();sheet_pose(c)
 surprise=keyed(t,[(0,0),(.06,1),(.14,0),(1,0)])
 flop=keyed(t,[(0,0),(.12,0),(.40,1),(.46,.93),(.54,1),(1,1)])
 legs=keyed(t,[(0,0),(.14,0),(.42,1),(1,1)])
 drape=keyed(t,[(0,0),(.20,0),(.52,1),(.58,.96),(.66,1),(1,1)])
 slide=keyed(t,[(0,0),(.28,0),(.50,1),(1,1)])
 spill=keyed(t,[(0,0),(.30,0),(.62,1),(1,1)])
 settle=keyed(t,[(0,0),(.40,0),(.72,1),(1,1)])
 # startled hop: everything jolts up, wings flare, peel lifts
 c['hips_shift']=V(0,0,0.035*surprise)+FLOP_HIPS_SHIFT*flop
 c['hips_rot']=FLOP_HIPS_ROT*flop
 c['chest_rot']=V(-0.08*surprise,0,0)+FLOP_CHEST_ROT*flop
 for i,v in enumerate(DRAPE_NECK,1):c['neck_%d'%i]=V(0.12*surprise if i<3 else 0,0,0)+v*drape
 c['head_rot']=V(0.20*surprise,ROLL*(1-drape),YAW*(1-drape))+DRAPE_HEAD*drape
 c['lid']=0.2*surprise+0.35*settle
 c['brow_rot']=V(0.35*surprise-0.1*settle,0,0);c['brow_shift']=V(0,0,0.01*surprise)
 c['peel_shift']=V(0,0,0.05*surprise)+PEEL_SLIDE_SHIFT*slide;c['peel_rot']=V(-0.15*surprise,0,0)+PEEL_SLIDE_ROT*slide
 for f,ph in (('flap_R',0),('flap_B',.4),('flap_L',.8)):
  wob=math.sin(math.tau*3*(t-.5)/.2+ph)*bell(t,.6,.12) if .48<t<.72 else 0.0
  c[f]=FLAP_SLIDE[f]*slide+V(0.10*wob,0,0)
 for s,k in (('R',1),('L',-1)):
  base=c['ankle_'+s].copy();brot=c['foot_'+s+'_rot'].copy()
  lift=V(0,0,0.03*surprise+0.10*math.sin(math.pi*legs))
  c['ankle_'+s]=base.lerp(SPLAY_ANKLE[s],legs)+lift
  c['foot_'+s+'_rot']=brot.lerp(SPLAY_FOOT[s],legs)
  c['pole_leg_'+s]=POLE_LEG0[s].lerp(SPLAY_POLE[s],legs).normalized()
  fl=keyed(t,[(0,0),(.08,1),(.30,.35),(.60,.15),(1,.15)])
  c['wing_'+s]=V(0,-0.30*k*fl,0.28*k*fl)+FLOP_WING[s]*settle
  c['wing_tip_'+s]=V(0,-0.1*k*fl,0.1*k*fl)
 c['tail_rot']=V(-0.30*surprise,0,0)+FLOP_TAIL*flop
 c['loot_rot']=LOOT_TIP_ROT*spill;c['loot_shift']=LOOT_TIP_SHIFT*spill
 c['chips_shift']=CHIPS_SPILL_SHIFT*spill;c['chips_rot']=CHIPS_SPILL_ROT*spill
 c['world_rot']['head']=(HEAD_FLOP_Q,drape)
 c['world_full']['loot_chips']=(CHIPS_FLOOR,keyed(t,[(0,0),(.36,0),(.60,1),(1,1)]))
 # the stolen chip slips out of the beak and falls to the floor in front (a small bounce)
 if with_chip and t>T_RELEASE:
  if _M0 is None:_M0=build_pose(defeat_controls(T_RELEASE,False)).M['beak_chip'].copy()
  u=min(1,(t-T_RELEASE)/(T_LAND-T_RELEASE))
  p0=_M0.translation;p1=CHIP_FLOOR.translation
  horiz=p0.lerp(p1,smooth(u) if u<1 else 1)
  if u<1:z=p0.z+(p1.z-p0.z)*u*u
  else:
   b=(t-T_LAND)/0.10;z=p1.z+(0.035*math.sin(math.pi*b) if b<1 else 0.0)
  q=_M0.to_quaternion().slerp(CHIP_FLOOR.to_quaternion(),smooth(min(1,(t-T_RELEASE)/(T_LAND+0.06-T_RELEASE))))
  c['chip_world']=Matrix.Translation(V(horiz.x,horiz.y,z))@q.to_matrix().to_4x4();c['chip_world_w']=1.0
 return c

# Tuned constants for the held belly-flop (world-space, see diag.py for the floor audit).
FLOP_HIPS_SHIFT=V(0,0.06,-0.339)
FLOP_HIPS_ROT=V(-0.22,0,0)
FLOP_CHEST_ROT=V(-0.10,0,0)
DRAPE_NECK=[V(-1.229,0,0),V(-0.863,0,0),V(-0.572,0,0),V(0.878,0,0)]
DRAPE_HEAD=V(0,0,0)
# held head: lying on its left cheek (rolled 75 deg), nose 6 deg down, beak along the floor
HEAD_FLOP_Q=(Matrix.Rotation(math.radians(-6),3,'X')@Matrix.Rotation(math.radians(-75),3,'Y')).to_quaternion()
PEEL_SLIDE_SHIFT=V(0.02,0.06,-0.05);PEEL_SLIDE_ROT=V(-0.85,0.6,0)
FLAP_SLIDE={'flap_R':V(-0.1,0.35,0),'flap_B':V(0.3,0,0),'flap_L':V(0,0.30,0)}
SPLAY_ANKLE={'R':V(0.20,-0.36,0.08),'L':V(-0.20,-0.36,0.08)}
SPLAY_FOOT={'R':V(1.9,0,0.3),'L':V(1.9,0,-0.3)}
SPLAY_POLE={'R':V(0.6,0,1),'L':V(-0.6,0,1)}
FLOP_WING={'R':V(0,-0.25,0.08),'L':V(0,0.25,-0.08)}
FLOP_TAIL=V(-0.55,0,0)
LOOT_TIP_ROT=V(0.0,-1.15,0.3);LOOT_TIP_SHIFT=V(-0.06,-0.02,-0.02)
CHIPS_SPILL_SHIFT=V(-0.02,-0.06,0.0);CHIPS_SPILL_ROT=V(0.2,-0.3,0.4)
# spilled chip bundle lying on the floor behind its left side (bone axis along the floor)
CHIPS_FLOOR=(V(-0.30,-0.44,0.058),(Matrix.Rotation(0.6,3,'Z')@Matrix.Rotation(1.5,3,'X')).to_quaternion())

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

def bake(names=None):
 scene=bpy.context.scene;scene.render.fps=FPS
 arm.animation_data_clear();arm.animation_data_create()
 for action in list(bpy.data.actions):bpy.data.actions.remove(action)
 records=[]
 global _M0
 for name,duration,loop in CLIPS:
  _M0=None
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
   'rear_back_hold_s':[round(.45*duration,4),round(.55*duration,4)] if name=='attack' else None,
   'chip_release_s':round(T_RELEASE*duration,4) if name=='defeat' else None,'chip_lands_s':round(T_LAND*duration,4) if name=='defeat' else None,
   'held_final_pose_from_s':round(DEFEAT_HOLD*duration,4) if name=='defeat' else None})
 arm.animation_data.action=None
 for pb in arm.pose.bones:pb.matrix_basis=Matrix.Identity(4)
 scene.frame_set(0);bpy.context.view_layer.update()
 return records

def pose_static(clip,t):
 """Author preview helper: put the rig in one evaluated pose (no keys)."""
 arm.animation_data_clear();PREV.clear();apply(build_pose(evaluate(clip,t)));bpy.context.view_layer.update()

if __name__=='__main__':
 scene=bpy.context.scene;scene.frame_start=0;scene.frame_end=90
 assert scene.get('work_order')=='WO111' and scene.get('scene_lease')=='active' and scene.get('asset_id')=='bin-chicken'
 err=rest_check();assert err<1e-4,('rest controls do not reproduce the bind pose',err)
 records=bake()
 arm['attack_contact_seconds']=1.25;arm['attack_contact_fraction']=CONTACT
 bp=ROOT/'source/bounds.json'
 if bp.exists():
  br=json.loads(bp.read_text());skin['model_space_bounds_y_up']=br['safe_culling_envelope'];skin['bounds_method']=br['method']
 for name in ('build.py','common.py','animate.py'):
  old=bpy.data.texts.get('WO111 bin chicken '+name)
  if old:bpy.data.texts.remove(old)
  block=bpy.data.texts.new('WO111 bin chicken '+name);block.write((ROOT/'source'/name).read_text())
 bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'bin-chicken.blend'),compress=True)
 # The live lease/session keys are author state, not asset data: keep them out of the shipped GLB extras.
 stash={k:scene[k] for k in list(scene.keys()) if k in ('scene_owner','scene_lease') or k.startswith('blendermcp_')}
 try:
  for k in stash:del scene[k]
  bpy.ops.export_scene.gltf(filepath=str(ROOT/'bin-chicken.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_def_bones=False,export_armature_object_remove=True,export_all_influences=False,export_influence_nb=4,export_apply=False,export_texcoords=True,export_normals=True,export_tangents=False,export_materials='EXPORT',export_vertex_color='NONE',export_image_format='AUTO',export_all_vertex_colors=False,export_cameras=False,export_lights=False,export_extras=True)
 finally:
  for k,v in stash.items():scene[k]=v
 assert scene.get('scene_lease')=='active'
 record=json.loads((ROOT/'construction.json').read_text());record['clips']=records;record['rest_reproduction_max_error']=err
 record['files']={name:{'bytes':(ROOT/name).stat().st_size,'sha256':hashlib.sha256((ROOT/name).read_bytes()).hexdigest()} for name in ['bin-chicken.blend','bin-chicken.glb','pigment.png']}
 (ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({'clips':[(r['name'],r['frames']) for r in records],'rest_error':err,'files':record['files']}))
