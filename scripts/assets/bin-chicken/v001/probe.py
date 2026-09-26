"""WO111 bin-chicken author probe (not evidence): evaluated control points per clip time, no baking."""
import runpy,json
from mathutils import Vector
A=runpy.run_path('/workspace/haynes-quest/family-eras/bin-chicken/v001/source/animate.py',run_name='probe')
RESTM=A['RESTM'];build=A['build_pose'];ev=A['evaluate']
TIP=Vector((0.0,0.5905,0.835))
def carried(P,bone,p):return P.M[bone]@RESTM[bone].inverted()@Vector(p)
out={}
for clip,times in (('attack',[0,.2,.45,.55,.6,.625,.7,.85,1]),('defeat',[0,.3,.5,.75,1]),('idle',[0,.5]),('move',[0,.5])):
 rows=[]
 for t in times:
  P=build(ev(clip,t))
  rows.append({'t':t,'tip':[round(x,3) for x in carried(P,'beak',TIP)],'head':[round(x,3) for x in P.M['head'].translation],'hips':[round(x,3) for x in P.M['hips'].translation]})
 out[clip]=rows
print(json.dumps(out))
