"""WO111 demon-band-idol: claim the exclusive scene lease on Blender instance 2 (model stage).
Checks /readyz ready + not busy, no running jobs and a released prior lease, saves a claim-time
recovery copy of the prior live scene, then records the claim."""
import json,sys
from urllib.request import urlopen
sys.dont_write_bytecode=True
from transfer import MCP,HOST,REMOTE,OWNER
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
prior_file=bpy.data.filepath or 'unsaved default startup scene'
objects=[o.name for o in bpy.data.objects]
# Recovery copy of the prior released live scene, as found (copy=True leaves the open file path alone).
bpy.ops.wm.save_as_mainfile(filepath=str(root/'model-claim-checkpoint.blend'),copy=True,compress=True)
fam=Path('/workspace/haynes-quest/family-eras')
prior={str(p.relative_to(fam)):{'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(fam.glob('*/v001/*')) if p.suffix in ('.blend','.glb') and 'demon-band-idol' not in str(p)}
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
sc['work_order']='WO111';sc['scene_owner']=%r;sc['scene_lease']='active'
sc['asset_id']='demon-band-idol';sc['asset_version']='v001';sc['authoring_model']='claude-opus-5-5 xhigh'
lease={'work_order':'WO111','asset_id':'demon-band-idol','version':'v001','task':'full model from the approved Blender reference sheet (refine, UV, rig, five clips, export, evidence)',
 'blender_instance':'blender-authoring-2 (isolated second instance; own scene and /workspace)','scene_owner':sc['scene_owner'],'scene_lease':'active','status':'active','claimed_utc':now,
 'props_before_claim':props,'scene_before_claim':{'file':prior_file,'objects':len(objects)},'claim_checkpoint':str(root/'model-claim-checkpoint.blend'),
 'claim_checkpoint_sha256':hashlib.sha256((root/'model-claim-checkpoint.blend').read_bytes()).hexdigest(),'jobs_at_claim':jobs,'readyz_at_claim':%r,'prior_files':prior}
(root/'scene-lease.json').write_text(json.dumps(lease,indent=2)+'\n')
print(json.dumps({k:v for k,v in lease.items() if k!='prior_files'},indent=1),len(prior),'prior family-era files hashed')
'''%(REMOTE,OWNER,ready)))
