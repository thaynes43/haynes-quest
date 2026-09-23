"""WO103 release the saved Blender scene without changing validated GLB bytes."""
import bpy, json, hashlib, datetime
from pathlib import Path

ROOT=Path('/workspace/haynes-quest/rat-casino-cast/moth-projectionist/v001')
sc=bpy.context.scene
assert sc.get('work_order')=='WO103' and sc.get('scene_lease')=='active'
jobs={j:bpy.app.is_job_running(j) for j in ['RENDER','RENDER_PREVIEW','OBJECT_BAKE']}
assert not any(jobs.values()),jobs
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
glb_hash=sha(ROOT/'moth-projectionist.glb')
for name in ['validation.json','three-inspection.json','browser-inspection.json']:
 report=json.loads((ROOT/name).read_text())
 assert report.get('sha256',report.get('glb_sha256'))==glb_hash,(name,'wrong GLB')
 assert all(report['checks'].values()),(name,report['checks'])
lease=json.loads((ROOT/'scene-lease.json').read_text())
for name,prior in lease['prior_masters'].items():
 assert prior['exists'] and sha(Path(prior['path']))==prior['sha256'],(name,'prior master changed')
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
sc['scene_owner']='none';sc['scene_lease']='released'
sc['candidate_status']='WO103 v001 validated studio candidate. Lead visual review passed; Tom exact-version art and later gameplay/device gates remain pending.'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'live-scene-release.blend'),compress=True)
lease.update(scene_owner='none',scene_lease='released',released_utc=now,glb_sha256=glb_hash)
(ROOT/'scene-lease.json').write_text(json.dumps(lease,indent=2)+'\n')
record={'work_order':'WO103','asset_id':'moth-projectionist','version':'v001','released_utc':now,'scene_owner':'none','scene_lease':'released','saved_live_scene':str(ROOT/'live-scene-release.blend'),'saved_live_scene_sha256':sha(ROOT/'live-scene-release.blend'),'glb_sha256':glb_hash,'author_jobs_running':False,'job_checks':jobs,'prior_masters_unchanged':lease['prior_masters'],'scope':'Studio candidate only. No levels, gameplay mapping or owner-art approval.'}
(ROOT/'scene-release.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record))
