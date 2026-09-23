"""WO099 final saved release. Does not modify or re-export the validated GLB."""
import bpy,json,hashlib,datetime
from pathlib import Path
ROOT=Path('/workspace/haynes-quest/rat-casino-cast/rat-pit-boss/v002')
sc=bpy.context.scene
assert sc.get('work_order')=='WO099' and sc.get('scene_lease')=='active'
jobs={j:bpy.app.is_job_running(j) for j in ['RENDER','RENDER_PREVIEW','OBJECT_BAKE']}
assert not any(jobs.values()),jobs
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
glb_hash=sha(ROOT/'rat-pit-boss.glb')
for name in ['validation.json','three-inspection.json','browser-inspection.json']:
 report=json.loads((ROOT/name).read_text())
 assert report.get('sha256',report.get('glb_sha256'))==glb_hash,(name,'wrong GLB')
 assert all(report['checks'].values()),(name,report['checks'])
lease=json.loads((ROOT/'scene-lease.json').read_text())
previous=Path('/workspace/haynes-quest/rat-casino-cast/rat-pit-boss/v001/paused-art-direction.blend')
props=Path('/workspace/haynes-quest/rat-casino-kit/v001/rat-casino-kit.blend')
assert sha(previous)==lease['prior_v001_sha256']
assert sha(props)==lease['prior_prop_sha256']
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
sc['scene_owner']='none';sc['scene_lease']='released'
sc['candidate_status']='WO099 v002 validated studio candidate. Lead construction/motion direction accepted; exact Tom final-art approval and gameplay gates remain pending.'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'live-scene-release.blend'),compress=True)
lease.update(status='released',released_utc=now,glb_sha256=glb_hash)
(ROOT/'scene-lease.json').write_text(json.dumps(lease,indent=2)+'\n')
record={'work_order':'WO099','asset_id':'rat-pit-boss','version':'v002','released_utc':now,'scene_owner':'none','scene_lease':'released','saved_live_scene':str(ROOT/'live-scene-release.blend'),'saved_live_scene_sha256':sha(ROOT/'live-scene-release.blend'),'glb_sha256':glb_hash,'author_jobs_running':any(jobs.values()),'job_checks':jobs,'prior_v001_master_unchanged':sha(previous),'prior_prop_master_unchanged':sha(props),'scope':'Studio candidate only. No gameplay mapping or levels. Exact owner review remains pending.'}
(ROOT/'scene-release.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record))
