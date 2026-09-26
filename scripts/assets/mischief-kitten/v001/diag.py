"""WO111 mischief-kitten author diagnostic (not evidence): bake the clips without exporting, then per clip
the floor minimum with its dominant bone and frame, bounds and loop seams."""
import bpy,json,runpy,sys
from mathutils import Vector
A=runpy.run_path('/workspace/haynes-quest/family-eras/mischief-kitten/v001/source/animate.py',run_name='diag')
err,records=A['bake'](export=False)
arm=bpy.data.objects['Mischief_Kitten_Rig'];skin=bpy.data.objects['Mischief_Kitten_Skin'];sc=bpy.context.scene
names=[g.name for g in skin.vertex_groups]
dom=[names[max(v.groups,key=lambda g:g.weight).group] for v in skin.data.vertices]
out={'rest_error':err}
for tr in arm.animation_data.nla_tracks:
 arm.animation_data.action=tr.strips[0].action;end=int(tr.strips[0].action_frame_end)
 lows=[];first=None;last=None;bb=[[9,9,9],[-9,-9,-9]];bonelow={}
 for f in range(end+1):
  sc.frame_set(f);dg=bpy.context.evaluated_depsgraph_get();ev=skin.evaluated_get(dg);me=ev.to_mesh()
  co=[ev.matrix_world@v.co for v in me.vertices]
  for i,p in enumerate(co):
   b=dom[i]
   if p.z<bonelow.get(b,(9,0))[0]:bonelow[b]=(round(p.z,4),f)
  i=min(range(len(co)),key=lambda k:co[k].z);lows.append((round(co[i].z,4),f,dom[i]))
  for p in co:
   for k in range(3):bb[0][k]=min(bb[0][k],p[k]);bb[1][k]=max(bb[1][k],p[k])
  if f==0:first=co
  if f==end:last=co
  ev.to_mesh_clear()
 seam=max((a-b).length for a,b in zip(first,last))
 out[tr.name]={'min':min(lows),'bounds':[[round(x,3) for x in bb[0]],[round(x,3) for x in bb[1]]],'seam':round(seam,5),'below':[l for l in lows if l[0]<0.0][:40],'neg_bones':{b:v for b,v in bonelow.items() if v[0]<0.001}}
arm.animation_data.action=None;sc.frame_set(0)
print(json.dumps(out))
