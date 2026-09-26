"""WO111 saved exclusive scene release; final GLB remains untouched."""
import bpy,json,hashlib,datetime
from pathlib import Path
ROOT=Path('/workspace/haynes-quest/family-eras/honk-bus/v001')
sc=bpy.context.scene
assert sc.get('work_order')=='WO111' and sc.get('asset_id')=='honk-bus' and sc.get('scene_lease')=='active'
jobs={j:bpy.app.is_job_running(j) for j in ['RENDER','RENDER_PREVIEW','OBJECT_BAKE','COMPOSITE']}
assert not any(jobs.values()),jobs
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
glb_hash=sha(ROOT/'honk-bus.glb')
for name in ['validation.json','three-inspection.json','browser-inspection.json','attachment-inspection.json']:
 report=json.loads((ROOT/name).read_text());assert report.get('sha256',report.get('glb_sha256'))==glb_hash,(name,'wrong GLB');assert all(report['checks'].values()),(name,report['checks'])
lease=json.loads((ROOT/'scene-lease.json').read_text())
for entry in lease['prior_masters'].values():assert sha(Path(entry['path']))==entry['sha256'],entry['path']
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
sc['scene_owner']='none';sc['scene_lease']='released'
sc['candidate_status']="WO111 honk-bus v001 · Awaiting Tom's review · used in the family release"
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'live-scene-release.blend'),compress=True)
lease.update(status='released',scene_owner='none',scene_lease='released',author_jobs_running=False,released_utc=now,glb_sha256=glb_hash)
(ROOT/'scene-lease.json').write_text(json.dumps(lease,indent=2)+'\n')
record={'work_order':'WO111','asset_id':'honk-bus','version':'v001','released_utc':now,'scene_owner':'none','scene_lease':'released','saved_live_scene':str(ROOT/'live-scene-release.blend'),'saved_live_scene_sha256':sha(ROOT/'live-scene-release.blend'),'editable_master':str(ROOT/'honk-bus.blend'),'editable_master_sha256':sha(ROOT/'honk-bus.blend'),'glb_sha256':glb_hash,'author_jobs_running':any(jobs.values()),'job_checks':jobs,'prior_masters_unchanged':lease['prior_masters'],'scope':"Awaiting Tom's review · used in the family release. Candidate technical delivery only; lead owns publication and runtime integration. No physical-device acceptance."}
(ROOT/'scene-release.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
