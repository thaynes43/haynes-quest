"""WO111 bin-chicken author diagnostic (not evidence): per-bone lowest point at chosen frames of one clip."""
import bpy,json
arm=bpy.data.objects['Bin_Chicken_Rig'];skin=bpy.data.objects['Bin_Chicken_Skin'];sc=bpy.context.scene
CLIP=globals().get('CLIP','defeat');FRAMES=globals().get('FRAMES',None)
names=[g.name for g in skin.vertex_groups]
dom=[names[max(v.groups,key=lambda g:g.weight).group] for v in skin.data.vertices]
tr=arm.animation_data.nla_tracks[CLIP];arm.animation_data.action=tr.strips[0].action;end=int(tr.strips[0].action_frame_end)
out={}
for f in (FRAMES or range(0,end+1,3)):
 sc.frame_set(f);dg=bpy.context.evaluated_depsgraph_get();ev=skin.evaluated_get(dg);me=ev.to_mesh()
 per={}
 for k,v in enumerate(me.vertices):
  z=(ev.matrix_world@v.co).z;per[dom[k]]=min(per.get(dom[k],9),z)
 ev.to_mesh_clear()
 out[f]={b:round(z,4) for b,z in sorted(per.items(),key=lambda kv:kv[1])[:6]}
arm.animation_data.action=None;sc.frame_set(0)
print(json.dumps(out))
