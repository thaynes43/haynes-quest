"""WO105: correct WO103 Moth metadata in its saved master, then re-export.

Run only after an exclusive WO105 scene lease and immutable input backup exist.
The original animation exporter settings are retained; no build or animation
generation is run, and no geometry, material, rig or keyframe is changed.
"""
import bpy, datetime, hashlib, json
from pathlib import Path

ROOT=Path('/workspace/haynes-quest/rat-casino-cast/moth-projectionist/v001')
sc=bpy.context.scene
assert sc.get('work_order')=='WO103' and sc.get('scene_lease')=='active'
assert sc.get('scene_owner')=='/root/moth_metadata_reexport'
lease=json.loads((ROOT/'scene-lease.json').read_text())
assert lease['work_order']=='WO105' and lease['scene_lease']=='active'
assert not any(bpy.app.is_job_running(j) for j in ('RENDER','RENDER_PREVIEW','OBJECT_BAKE'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
backup=ROOT/'pre-WO105-metadata-correction'
assert sha(backup/'moth-projectionist.glb')=='90792e085c7a93c481101d4136a20220de7749831098079c8f4809cefcbcebe9'
assert sha(backup/'moth-projectionist.blend')=='2ea9c6c06a8d1ad3c755460db1038ba5ddc3d8a963a451c80de5f71027624064'
skin=bpy.data.objects['Moth_Projectionist_Skin']
arm=bpy.data.objects['Moth_Projectionist_Rig']
assert sc.frame_current==0 and arm.animation_data.action is None
assert len(arm.animation_data.nla_tracks)==5
sc['candidate_status']='WO103 Moth Projectionist v001 studio candidate; exact owner art and later gameplay/device gates remain pending.'
sc['correction_work_order']='WO105'
for name in ('build.py','common.py','animate.py','reexport-metadata.py'):
    label=('WO105 ' if name=='reexport-metadata.py' else 'WO103 ')+name
    text=bpy.data.texts.get(label)
    if text:text.clear()
    else:text=bpy.data.texts.new(label)
    text.write((ROOT/'source'/name).read_text())
bpy.ops.object.select_all(action='DESELECT')
skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'moth-projectionist.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'moth-projectionist.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_def_bones=False,export_armature_object_remove=True,export_all_influences=False,export_influence_nb=4,export_apply=False,export_texcoords=True,export_normals=True,export_tangents=False,export_materials='EXPORT',export_vertex_color='NONE',export_image_format='AUTO',export_all_vertex_colors=False,export_cameras=False,export_lights=False,export_extras=True,export_force_sampling=True,export_frame_range=False,export_frame_step=1,export_optimize_animation_size=True,export_current_frame=False,export_rest_position_armature=True,export_anim_slide_to_zero=True,export_draco_mesh_compression_enable=False)
record=json.loads((ROOT/'construction.json').read_text())
record['files']={p.name:{'bytes':p.stat().st_size,'sha256':sha(p)} for p in (ROOT/'moth-projectionist.blend',ROOT/'moth-projectionist.glb',ROOT/'pigment.png')}
record['metadata_correction']={'work_order':'WO105','created_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'candidate_status':sc['candidate_status'],'original_glb_sha256':sha(backup/'moth-projectionist.glb'),'original_master_sha256':sha(backup/'moth-projectionist.blend'),'method':'Opened exact original master and re-exported with identical options; changed scene metadata and embedded source text only.'}
(ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'candidate_status':sc['candidate_status'],'files':record['files']}))
