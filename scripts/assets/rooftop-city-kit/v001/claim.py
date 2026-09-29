"""Claim released Blender instance 2; preserve all predecessor masters and exports."""
import json, sys
from urllib.request import urlopen
sys.dont_write_bytecode = True
from transfer import MCP, HOST, REMOTE, OWNER

ready = json.loads(urlopen(HOST + '/readyz', timeout=10).read())
assert ready.get('ready') and not ready.get('busy'), ready
c = MCP()
print(c.text(r'''
import bpy,json,datetime,hashlib
from pathlib import Path
sc=bpy.context.scene
props={k:str(sc[k]) for k in ('work_order','scene_owner','scene_lease','asset_id','asset_version','candidate_status') if k in sc}
jobs={j:bpy.app.is_job_running(j) for j in ('RENDER','RENDER_PREVIEW','OBJECT_BAKE','COMPOSITE')}
assert not any(jobs.values()),jobs
assert sc.get('scene_lease')=='released' and sc.get('scene_owner')=='none',props
assert not bpy.data.is_dirty, 'Predecessor is unsaved'
root=Path(%r); assert not root.exists(), 'Candidate directory already exists; inspect before resuming'
root.mkdir(parents=True); (root/'source').mkdir()
prior={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in Path('/workspace/haynes-quest/family-eras').rglob('*') if p.suffix in ('.blend','.glb')}
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
lease={'work_order':'WO111','delivery_work_order':'WO142','asset_id':'rooftop-city-kit','version':'v001',
 'authoring_model':'gpt-6-astra max','blender_instance':'blender-authoring-2',
 'scene_owner':%r,'scene_lease':'active','status':'active','claimed_utc':now,
 'task':'Reference sheet first; coordinator ratification before production export; four exact static props',
 'predecessor':{'path':bpy.data.filepath,'sha256':prior[bpy.data.filepath],'props':props,'dirty':bpy.data.is_dirty},
 'prior_files':prior,'jobs_at_claim':jobs,'readyz_at_claim':%r}
(root/'scene-lease.json').write_text(json.dumps(lease,indent=2)+'\n')
sc['work_order']='WO111';sc['scene_owner']=%r;sc['scene_lease']='active'
sc['asset_id']='rooftop-city-kit';sc['asset_version']='v001';sc['authoring_model']='gpt-6-astra max'
sc['candidate_status']='WO111 rooftop-city-kit v001 reference sheet; no production export'
bpy.ops.wm.save_as_mainfile(filepath=str(root/'claim-checkpoint.blend'),compress=True)
print(json.dumps({'claimed':now,'predecessor':lease['predecessor'],'prior_file_count':len(prior)}))
''' % (REMOTE, OWNER, ready, OWNER)))
