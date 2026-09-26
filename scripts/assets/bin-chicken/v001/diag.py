"""WO111 bin-chicken author diagnostic (not evidence): per-clip floor minimum with its dominant bone, bounds, loop seams."""
import bpy,json
arm=bpy.data.objects['Bin_Chicken_Rig'];skin=bpy.data.objects['Bin_Chicken_Skin'];sc=bpy.context.scene
names=[g.name for g in skin.vertex_groups]
dom=[names[max(v.groups,key=lambda g:g.weight).group] for v in skin.data.vertices]
out={}
for tr in arm.animation_data.nla_tracks:
 arm.animation_data.action=tr.strips[0].action;end=int(tr.strips[0].action_frame_end)
 lows=[];first=None;last=None;bb=[[9,9,9],[-9,-9,-9]]
 for f in range(end+1):
  sc.frame_set(f);dg=bpy.context.evaluated_depsgraph_get();ev=skin.evaluated_get(dg);me=ev.to_mesh()
  co=[ev.matrix_world@v.co for v in me.vertices]
  i=min(range(len(co)),key=lambda k:co[k].z);lows.append((round(co[i].z,4),f,dom[i]))
  per={}
  for k,p in enumerate(co):
   if p.z<0.002:per[dom[k]]=min(per.get(dom[k],9),round(p.z,4))
  if per:lows[-1]=lows[-1]+(per,)
  for p in co:
   for k in range(3):bb[0][k]=min(bb[0][k],p[k]);bb[1][k]=max(bb[1][k],p[k])
  if f==0:first=co
  if f==end:last=co
  ev.to_mesh_clear()
 seam=max((a-b).length for a,b in zip(first,last))
 out[tr.name]={'min':min(lows)[:3],'bounds':[[round(x,3) for x in bb[0]],[round(x,3) for x in bb[1]]],'seam':round(seam,5),'below_2mm':[l for l in lows if l[0]<0.0][:40]}
arm.animation_data.action=None;sc.frame_set(0)
print(json.dumps(out))
