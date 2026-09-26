"""WO111 inator-monster: claim the exclusive scene lease on Blender instance 2 for the full-model stage
(named claim_model.py so it never overwrites the reference-sheet stage's own source/claim.py).

Checks /readyz ready + not busy, no render/bake jobs, and a released (or absent) lease on the
live scene. Records the prior scene and hashes of the other assets' instance-2 workspace files
so the release can prove they were not changed."""
import json,sys
from urllib.request import urlopen
sys.dont_write_bytecode=True
from transfer import MCP,HOST,REMOTE
ready=json.loads(urlopen(HOST+'/readyz',timeout=10).read())
assert ready.get('ready') and not ready.get('busy'),ready
c=MCP()
print(c.text(r'''
import bpy,json,datetime,hashlib
from pathlib import Path
sc=bpy.context.scene
props={k:str(sc[k]) for k in ('work_order','scene_owner','scene_lease','asset_id','asset_version','authoring_model') if k in sc.keys()}
jobs={j:bpy.app.is_job_running(j) for j in ['RENDER','RENDER_PREVIEW','OBJECT_BAKE','COMPOSITE']}
assert not any(jobs.values()),jobs
assert props.get('scene_lease') in (None,'released'),('scene held',props)
root=Path(%r);root.mkdir(parents=True,exist_ok=True);(root/'source').mkdir(exist_ok=True)
fam=root.parent.parent
prior={str(p.relative_to(fam)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(fam.glob('*/v001/*')) if p.is_file() and not str(p).startswith(str(root)) and p.suffix in ('.blend','.glb','.png')}
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
objects=[o.name for o in bpy.data.objects]
sc['work_order']='WO111';sc['scene_owner']='claude-opus-5-5/inator-monster-model';sc['scene_lease']='active'
sc['asset_id']='inator-monster';sc['asset_version']='v001';sc['authoring_model']='claude-opus-5-5 xhigh'
lease={'work_order':'WO111','asset_id':'inator-monster','version':'v001','task':'full model from the approved Blender reference sheet (refine, UV, rig, five clips, export, evidence)',
 'blender_instance':'blender-authoring-2 (isolated second instance; own scene and /workspace)','scene_owner':sc['scene_owner'],'scene_lease':'active','status':'active','claimed_utc':now,
 'props_before_claim':props,'scene_before_claim':{'file':bpy.data.filepath or 'unsaved default startup scene','object_count':len(objects)},'jobs_at_claim':jobs,'readyz_at_claim':%r,
 'prior_instance2_files_sha256':prior,'prior_scene_file_sha256':(hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest() if bpy.data.filepath else None)}
(root/'scene-lease.json').write_text(json.dumps(lease,indent=2)+'\n')
print(json.dumps({k:v for k,v in lease.items() if k!='prior_instance2_files_sha256'},indent=1));print('prior files recorded:',len(prior))
'''%(REMOTE,ready)))
