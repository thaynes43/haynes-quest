"""Release instance 2 after exact-byte validation, preserving every prior master."""
import bpy, datetime, hashlib, json
from pathlib import Path

ROOT=Path('/workspace/haynes-quest/family-eras/casita-kit/v001')
sc=bpy.context.scene
assert sc.get('scene_owner')=='gpt-6-astra/casita-kit-props' and sc.get('scene_lease')=='active'
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
jobs={j:bpy.app.is_job_running(j) for j in ['RENDER','RENDER_PREVIEW','OBJECT_BAKE','COMPOSITE']}
assert not any(jobs.values()),jobs
lease=json.loads((ROOT/'scene-lease.json').read_text())
prior={p:{'sha256_at_claim':h,'sha256_now':sha(p),'unchanged':h==sha(p)} for p,h in lease['prior_files'].items()}
assert all(p['unchanged'] for p in prior.values()),prior
reports={p:json.loads((ROOT/p).read_text()) for p in ['validation.json','reimport.json','three-inspection.json','stills/browser-inspection.json']}
assert all(r['all_checks_pass'] for r in reports.values())
glbs={p:sha(ROOT/(p+'.glb')) for p in ['casita-terrace-wall','flower-planter','patterned-door','butterfly-arch']}
for prop,h in glbs.items():
    for name,r in reports.items():assert r['props'][prop].get('sha256',r['props'][prop].get('glb_sha256'))==h,(name,prop)
sc['scene_owner']='none';sc['scene_lease']='released'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'live-scene-release.blend'),compress=True)
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
lease.update(scene_owner='none',scene_lease='released',status='released',released_utc=now,author_jobs_running=False)
(ROOT/'scene-lease.json').write_text(json.dumps(lease,indent=2)+'\n')
record={'work_order':'WO111','asset_id':'casita-kit','version':'v001','blender_instance':'blender-authoring-2',
    'released_utc':now,'scene_owner':'none','scene_lease':'released','author_jobs_running':False,'job_checks':jobs,
    'saved_live_scene':str(ROOT/'live-scene-release.blend'),'saved_live_scene_sha256':sha(ROOT/'live-scene-release.blend'),
    'editable_master_sha256':sha(ROOT/'casita-kit.blend'),'reference_sheet_sha256':sha(ROOT/'reference-sheet.png'),
    'glb_sha256':glbs,'prior_scene_files_unchanged':prior,'owner_review':'pending',
    'scope':"Awaiting Tom's review · used in the family release. Coordinator-approved private candidates; no owner/device approval or deployment claim."}
(ROOT/'scene-release.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({k:record[k] for k in ['released_utc','scene_lease','saved_live_scene_sha256','editable_master_sha256']}))
