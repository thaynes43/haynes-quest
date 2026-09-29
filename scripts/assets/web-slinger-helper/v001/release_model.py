"""WO111 web-slinger-helper: saved exclusive scene release on Blender instance 1; the final GLB stays untouched.
Also used on failure: pass FAILURE=<reason> (module global, or a FAILURE file next to the lease) to release without
the report assertions. Adapted from the demon-band-idol v001 release_model.py; re-hashes every earlier family-era
.blend/.glb recorded at claim so the release proves none changed."""
import bpy,json,hashlib,datetime
from pathlib import Path
ROOT=Path('/workspace/haynes-quest/family-eras/web-slinger-helper/v001')
FAILURE=globals().get('FAILURE') or ((ROOT/'FAILURE').read_text().strip() if (ROOT/'FAILURE').exists() else None)
sc=bpy.context.scene
assert sc.get('work_order')=='WO111' and sc.get('asset_id')=='web-slinger-helper' and sc.get('scene_lease')=='active'
jobs={j:bpy.app.is_job_running(j) for j in ['RENDER','RENDER_PREVIEW','OBJECT_BAKE','COMPOSITE']}
assert not any(jobs.values()),jobs
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
glb=ROOT/'web-slinger-helper.glb';glb_hash=sha(glb) if glb.exists() else 'none'
lease=json.loads((ROOT/'scene-lease.json').read_text())
changed={k:e['path'] for k,e in lease.get('prior_files',{}).items() if not Path(e['path']).exists() or sha(e['path'])!=e['sha256']}
if not FAILURE:
 assert not changed,('earlier family-era files changed',changed)
 for name in ['validation.json','three-inspection.json','browser-inspection.json','attachment-inspection.json']:
  report=json.loads((ROOT/name).read_text());assert report.get('sha256',report.get('glb_sha256'))==glb_hash,(name,'wrong GLB');assert all(report['checks'].values()),(name,report['checks'])
 inputs={n:sha(ROOT/n) for n in lease['approved_inputs_sha256']};assert inputs==lease['approved_inputs_sha256'],('sheet inputs changed',inputs)
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
sc['scene_owner']='none';sc['scene_lease']='released'
sc['candidate_status']="WO111 web-slinger-helper v001 · Awaiting Tom's review · used in the family release"
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'live-scene-release.blend'),compress=True)
lease.update(status='released' if not FAILURE else 'released-after-failure',scene_owner='none',scene_lease='released',author_jobs_running=False,released_utc=now,glb_sha256=glb_hash)
if FAILURE:lease['failure']=FAILURE
(ROOT/'scene-lease.json').write_text(json.dumps(lease,indent=2)+'\n')
record={'work_order':'WO111','asset_id':'web-slinger-helper','version':'v001','blender_instance':'blender-authoring (instance 1, primary)','released_utc':now,'scene_owner':'none','scene_lease':'released',
 'saved_live_scene':str(ROOT/'live-scene-release.blend'),'saved_live_scene_sha256':sha(ROOT/'live-scene-release.blend'),
 'editable_master':str(ROOT/'web-slinger-helper.blend'),'editable_master_sha256':sha(ROOT/'web-slinger-helper.blend') if (ROOT/'web-slinger-helper.blend').exists() else 'none',
 'construction_master_sha256':sha(ROOT/'web-slinger-helper-construction.blend') if (ROOT/'web-slinger-helper-construction.blend').exists() else 'none',
 'glb_sha256':glb_hash,'author_jobs_running':any(jobs.values()),'job_checks':jobs,'failure':FAILURE,
 'approved_inputs_sha256':lease.get('approved_inputs_sha256'),
 'prior_family_era_files_checked':len(lease.get('prior_files',{})),'prior_family_era_files_changed':changed,
 'sheet_stage_records':'sheet-stage/ keeps the reference-sheet stage lease, release and live scene',
 'scope':"Awaiting Tom's review · used in the family release. Candidate technical delivery only; the coordinator owns catalog publication and runtime integration. No physical-device acceptance."}
(ROOT/'scene-release.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({k:v for k,v in record.items() if k!='prior_family_era_files_changed'}))
