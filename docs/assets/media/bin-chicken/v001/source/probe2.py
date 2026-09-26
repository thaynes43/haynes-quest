"""WO111 bin-chicken author probe (not evidence): defeat held-pose tuning numbers."""
import runpy,json
from mathutils import Vector,Euler
A=runpy.run_path('/workspace/haynes-quest/family-eras/bin-chicken/v001/source/animate.py',run_name='probe')
G=A['build_pose'].__globals__
RESTM=G['RESTM'];build=G['build_pose'];ev=G['evaluate']
import sys
ov=globals().get('OVERRIDES',{})
for k,v in ov.items():G[k]=v
def carried(P,bone,p):return P.M[bone]@RESTM[bone].inverted()@Vector(p)
P=build(G['defeat_controls'](1.0,False))
r=lambda v:[round(x,3) for x in v]
out={'neck_heads':{n:r(P.M[n].translation) for n in ['neck_1','neck_2','neck_3','neck_4','head']},
 'head_centre':r(carried(P,'head',(0,0.175,1.075))),'beak_tip':r(carried(P,'beak',(0,0.5905,0.835))),'eyeR':r(carried(P,'head',(0.08,0.27,1.12))),'eyeL':r(carried(P,'head',(-0.08,0.27,1.12))),
 'peel_top':r(carried(P,'peel',(0,0.175,1.25))),'hips':r(P.M['hips'].translation),'feet':{s:r(P.M['foot_'+s].translation) for s in 'RL'},
 'cone_top':r(carried(P,'loot',(-0.058,-0.35,0.735))),'chips':r(P.M['loot_chips'].translation)}
print(json.dumps(out))
