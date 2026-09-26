"""WO111 bounded source-geometry attachment audit, supplementing exact GLB checks."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path('/workspace/haynes-quest/family-eras/honk-bus/v001')
arm=bpy.data.objects['Honk_Bus_Rig'];scene=bpy.context.scene
parts=bpy.data.collections['EDITABLE original honk bus parts - excluded from export'].objects
data=json.loads((ROOT/'source/rig-rest.json').read_text());factor=data['factor'];ground=data['ground'];cy=data['forward_center']
inv={b.name:b.matrix_local.inverted() for b in arm.data.bones}
fenders=[o for o in parts if o.name.startswith('Teal rounded wheel arch ')]
struts=[o for o in parts if o.name.startswith('Continuous suspension strut ')]
stem=next(o for o in parts if o.name=='Continuous extending trumpet support')
def point(ob,v):
 out=Vector((0,0,0))
 for g in v.groups:
  name=ob.vertex_groups[g.group].name;out+=(arm.pose.bones[name].matrix@inv[name]@v.co)*g.weight
 return out
results={};root=bpy.context.scene
for clip in ['idle','move','attack','hit','defeat']:
 action=bpy.data.actions[clip];arm.animation_data.action=action
 duration=action.frame_range[1]/scene.render.fps;minimum=math.inf;cause=None;max_strut_gap=0;max_stem_gap=0
 for frame in range(round(action.frame_range[1])+1):
  scene.frame_set(frame);bpy.context.view_layer.update()
  for ob in fenders:
   bn=ob.name.split('Teal rounded wheel arch ',1)[1];center=arm.pose.bones[bn].matrix.translation
   for v in ob.data.vertices:
    p=point(ob,v)
    if abs(p.x-center.x)<=.171*factor:
     gap=math.hypot(p.y-center.y,p.z-center.z)-.382*factor
     if gap<minimum:minimum=gap;cause={'part':ob.name,'frame':frame,'time_s':frame/scene.render.fps,'point':list(p)}
  for ob in struts:
   for end,bn in [('bottom','root'),('top','body')]:
    extreme=min(v.co.z for v in ob.data.vertices) if end=='bottom' else max(v.co.z for v in ob.data.vertices)
    vs=[v for v in ob.data.vertices if abs(v.co.z-extreme)<1e-5]
    rest=sum((v.co for v in vs),Vector())/len(vs);posed=sum((point(ob,v) for v in vs),Vector())/len(vs)
    expected=arm.pose.bones[bn].matrix@inv[bn]@rest;max_strut_gap=max(max_strut_gap,(posed-expected).length)
  for end,bn in [('bottom','body'),('top','horn_lift')]:
   extreme=min(v.co.z for v in stem.data.vertices) if end=='bottom' else max(v.co.z for v in stem.data.vertices)
   vs=[v for v in stem.data.vertices if abs(v.co.z-extreme)<1e-5]
   rest=sum((v.co for v in vs),Vector())/len(vs);posed=sum((point(stem,v) for v in vs),Vector())/len(vs)
   expected=arm.pose.bones[bn].matrix@inv[bn]@rest;max_stem_gap=max(max_stem_gap,(posed-expected).length)
 results[clip]={'samples':round(action.frame_range[1])+1,'minimum_fender_wheel_cylinder_clearance_m':minimum,'minimum_location':cause,'maximum_suspension_endpoint_gap_m':max_strut_gap,'maximum_extending_horn_support_endpoint_gap_m':max_stem_gap}
arm.animation_data.action=None
for pb in arm.pose.bones:pb.matrix_basis=Matrix.Identity(4)
scene.frame_set(0);bpy.context.view_layer.update()
record={'asset_id':'honk-bus','version':'v001','glb_sha256':hashlib.sha256((ROOT/'honk-bus.glb').read_bytes()).hexdigest(),'method':'Same authored mesh vertices and baked source actions as exact GLB; 60 Hz. Fender vertices are tested against a conservative full tire cylinder. All four continuous suspension-strut ends and both extending horn-support ends are tested against their actual rig attachments. This supplements exact exported all-vertex floor and horn/roof checks, and is not a universal triangle collision proof.','clips':results,'checks':{'fender_tire_clearance':all(r['minimum_fender_wheel_cylinder_clearance_m']>=-.00001 for r in results.values()),'all_suspension_ends_attached':all(r['maximum_suspension_endpoint_gap_m']<.00001 for r in results.values()),'extending_horn_support_attached':all(r['maximum_extending_horn_support_endpoint_gap_m']<.00001 for r in results.values())}}
(ROOT/'attachment-inspection.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
