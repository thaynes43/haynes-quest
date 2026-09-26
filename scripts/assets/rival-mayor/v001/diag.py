"""WO111 rival-mayor author diagnostic (not evidence): per-clip floor minimum, dominant bone, loop seams."""
import bpy,json
from mathutils import Vector
arm=bpy.data.objects['Rival_Mayor_Rig'];skin=bpy.data.objects['Rival_Mayor_Skin'];sc=bpy.context.scene
names=[g.name for g in skin.vertex_groups]
dom=[]
for v in skin.data.vertices:
 best=max(v.groups,key=lambda g:g.weight);dom.append(names[best.group])
out={}
for tr in arm.animation_data.nla_tracks:
 arm.animation_data.action=tr.strips[0].action;end=int(tr.strips[0].action_frame_end)
 lows=[];first=None;last=None;bb=[[9,9,9],[-9,-9,-9]]
 for f in range(end+1):
  sc.frame_set(f);dg=bpy.context.evaluated_depsgraph_get();ev=skin.evaluated_get(dg);me=ev.to_mesh()
  co=[ev.matrix_world@v.co for v in me.vertices]
  i=min(range(len(co)),key=lambda k:co[k].z);lows.append((round(co[i].z,4),f,dom[i]))
  for p in co:
   for k in range(3):bb[0][k]=min(bb[0][k],p[k]);bb[1][k]=max(bb[1][k],p[k])
  if f==0:first=co
  if f==end:last=co
  ev.to_mesh_clear()
 seam=max((a-b).length for a,b in zip(first,last))
 out[tr.name]={'min':min(lows),'bounds':[[round(x,3) for x in bb[0]],[round(x,3) for x in bb[1]]],'seam':round(seam,5),'lowest_by_frame':[l for l in lows if l[0]<0.004][:12]}
arm.animation_data.action=None;sc.frame_set(0)
print(json.dumps(out))
