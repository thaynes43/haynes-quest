"""Save and release instance 2. Rehash every predecessor master/export unchanged."""
import bpy,json,hashlib,datetime
from pathlib import Path
ROOT=Path('/workspace/haynes-quest/family-eras/rooftop-city-kit/v001')
sc=bpy.context.scene
assert sc.get('scene_owner')=='gpt-6-astra/rooftop-city-kit-props' and sc.get('scene_lease')=='active'
jobs={j:bpy.app.is_job_running(j) for j in ('RENDER','RENDER_PREVIEW','OBJECT_BAKE','COMPOSITE')}
assert not any(jobs.values()),jobs
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
V=json.loads((ROOT/'validation.json').read_text());T=json.loads((ROOT/'three-inspection.json').read_text())
B=json.loads((ROOT/'stills/browser-inspection.json').read_text());R=json.loads((ROOT/'reimport.json').read_text())
assert all(r['all_checks_pass'] for r in (V,T,B,R))
glbs={p:sha(ROOT/(p+'.glb')) for p in V['props']}
for p,h in glbs.items():
    assert V['props'][p]['sha256']==T['props'][p]['sha256']==R['props'][p]['sha256']==B['props'][p]['glb_sha256']==h
lease=json.loads((ROOT/'scene-lease.json').read_text())
prior={p:{'sha256_at_claim':h,'sha256_now':sha(p),'unchanged':sha(p)==h} for p,h in lease['prior_files'].items()}
assert all(x['unchanged'] for x in prior.values())
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
sc['scene_owner']='none';sc['scene_lease']='released'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'live-scene-release.blend'),compress=True)
lease.update(status='released',scene_owner='none',scene_lease='released',released_utc=now,author_jobs_running=False)
(ROOT/'scene-lease.json').write_text(json.dumps(lease,indent=2)+'\n')
result={'work_order':'WO111','delivery_work_order':'WO142','asset_id':'rooftop-city-kit','version':'v001',
    'blender_instance':'blender-authoring-2','released_utc':now,'scene_owner':'none','scene_lease':'released',
    'editable_master':str(ROOT/'rooftop-city-kit.blend'),'editable_master_sha256':sha(ROOT/'rooftop-city-kit.blend'),
    'reference_master_sha256':sha(ROOT/'rooftop-city-kit-reference.blend'),
    'saved_live_scene':str(ROOT/'live-scene-release.blend'),'saved_live_scene_sha256':sha(ROOT/'live-scene-release.blend'),
    'glb_sha256':glbs,'job_checks':jobs,'author_jobs_running':False,'prior_scene_files_unchanged':prior,
    'owner_exact_version_review':'pending under PRD-004 Q-03','deployment':'coordinator owns PR review, merge and release'}
(ROOT/'scene-release.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'released_utc':now,'prior_files_unchanged':len(prior),'master_sha256':result['editable_master_sha256']}))
