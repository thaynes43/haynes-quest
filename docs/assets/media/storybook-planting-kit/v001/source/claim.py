"""Claim released Blender instance 2 for action minions B; record every predecessor master/export hash."""
import json, sys
from urllib.request import urlopen, Request
sys.dont_write_bytecode = True
from transfer import MCP, HOST, REMOTE, OWNER, WORK_ORDER

ready = json.loads(urlopen(HOST + '/readyz', timeout=10).read())
assert ready.get('ready') and not ready.get('busy'), ready
c = MCP()
print(c.text(r'''
import bpy,json,datetime,hashlib,socket
from pathlib import Path
sc=bpy.context.scene
props={k:str(sc[k]) for k in ('work_order','delivery_work_order','scene_owner','scene_lease','asset_id','asset_version','candidate_status') if k in sc}
jobs={j:bpy.app.is_job_running(j) for j in ('RENDER','RENDER_PREVIEW','OBJECT_BAKE','COMPOSITE')}
assert not any(jobs.values()),jobs
assert sc.get('scene_lease')=='released' and sc.get('scene_owner')=='none',props
assert not bpy.data.is_dirty, 'Predecessor is unsaved'
root=Path(%r); assert not root.exists(), 'Candidate directory already exists; inspect before resuming'
prior={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(Path('/workspace/haynes-quest').rglob('*')) if p.suffix in ('.blend','.glb')}
root.mkdir(parents=True); (root/'source').mkdir()
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
lease={'work_order':%r,'asset_pack':'action-minions-b','version':'v001',
 'assets':['broccoli-bouncer@v001','bin-chicken-flower-thief@v001','demon-idol-drummer@v001','storybook-planting-kit@v001'],
 'authoring_model':'claude-opus-5-5 xhigh (Claude Code agent-run session on the Max plan)','blender_instance':'blender-authoring-2',
 'pod_hostname':socket.gethostname(),'blender_version':bpy.app.version_string,
 'scene_owner':%r,'scene_lease':'active','status':'active','claimed_utc':now,
 'task':'Three animated original parody minions and a three-prop static planting kit; separate masters; release at the end',
 'predecessor':{'path':bpy.data.filepath,'sha256':prior.get(bpy.data.filepath),'props':props,'dirty':bpy.data.is_dirty},
 'prior_files':prior,'jobs_at_claim':jobs,'readyz_at_claim':%r}
(root/'scene-lease.json').write_text(json.dumps(lease,indent=2)+'\n')
sc['work_order']=%r;sc['scene_owner']=%r;sc['scene_lease']='active'
sc['asset_id']='action-minions-b';sc['asset_version']='v001';sc['authoring_model']='claude-opus-5-5 xhigh'
sc['candidate_status']='action-minions-b v001 authoring in progress; no released export'
for k in ('delivery_work_order','reference_sheet_sha256','source_reference','orientation'):
  if k in sc: del sc[k]
bpy.ops.wm.save_as_mainfile(filepath=str(root/'claim-checkpoint.blend'),compress=True)
print(json.dumps({'claimed':now,'host':socket.gethostname(),'predecessor':lease['predecessor'],'prior_file_count':len(prior)}))
''' % (REMOTE, WORK_ORDER, OWNER, ready, WORK_ORDER, OWNER)))
