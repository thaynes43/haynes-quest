"""WO111 rival-mayor: saved exclusive scene release on Blender instance 2; the final GLB stays untouched.
Also used on failure: pass FAILURE=<reason> (module global) to release without the report assertions."""
import bpy,json,hashlib,datetime
from pathlib import Path
ROOT=Path('/workspace/haynes-quest/family-eras/rival-mayor/v001')
FAILURE=globals().get('FAILURE')
sc=bpy.context.scene
assert sc.get('work_order')=='WO111' and sc.get('asset_id')=='rival-mayor' and sc.get('scene_lease')=='active'
jobs={j:bpy.app.is_job_running(j) for j in ['RENDER','RENDER_PREVIEW','OBJECT_BAKE','COMPOSITE']}
assert not any(jobs.values()),jobs
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
glb=ROOT/'rival-mayor.glb';glb_hash=sha(glb) if glb.exists() else 'none'
if not FAILURE:
 for name in ['validation.json','three-inspection.json','browser-inspection.json','attachment-inspection.json']:
  report=json.loads((ROOT/name).read_text());assert report.get('sha256',report.get('glb_sha256'))==glb_hash,(name,'wrong GLB');assert all(report['checks'].values()),(name,report['checks'])
lease=json.loads((ROOT/'scene-lease.json').read_text())
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
sc['scene_owner']='none';sc['scene_lease']='released'
sc['candidate_status']="WO111 rival-mayor v001 · Awaiting Tom's review · used in the family release"
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'live-scene-release.blend'),compress=True)
lease.update(status='released' if not FAILURE else 'released-after-failure',scene_owner='none',scene_lease='released',author_jobs_running=False,released_utc=now,glb_sha256=glb_hash)
if FAILURE:lease['failure']=FAILURE
(ROOT/'scene-lease.json').write_text(json.dumps(lease,indent=2)+'\n')
record={'work_order':'WO111','asset_id':'rival-mayor','version':'v001','blender_instance':'blender-authoring-2','released_utc':now,'scene_owner':'none','scene_lease':'released',
 'saved_live_scene':str(ROOT/'live-scene-release.blend'),'saved_live_scene_sha256':sha(ROOT/'live-scene-release.blend'),
 'editable_master':str(ROOT/'rival-mayor.blend'),'editable_master_sha256':sha(ROOT/'rival-mayor.blend') if (ROOT/'rival-mayor.blend').exists() else 'none',
 'construction_master_sha256':sha(ROOT/'rival-mayor-construction.blend') if (ROOT/'rival-mayor-construction.blend').exists() else 'none',
 'glb_sha256':glb_hash,'author_jobs_running':any(jobs.values()),'job_checks':jobs,'failure':FAILURE,
 'scope':"Awaiting Tom's review · used in the family release. Candidate technical delivery only; the coordinator owns catalog publication and runtime integration. No physical-device acceptance."}
(ROOT/'scene-release.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
