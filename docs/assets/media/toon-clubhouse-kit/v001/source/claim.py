"""WO111 toon-clubhouse-kit: claim the exclusive scene lease on Blender instance 1 (after /readyz ready+not busy).
The prior (released) scene file is hashed before and after and is never saved over: the first save goes to this
kit's own claim-checkpoint.blend, which moves bpy.data.filepath into this kit's directory."""
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
props={k:str(sc[k])[:400] for k in ('work_order','scene_owner','scene_lease','asset_id','asset_version','authoring_model','candidate_status') if k in sc.keys()}
jobs={j:bpy.app.is_job_running(j) for j in ['RENDER','RENDER_PREVIEW','OBJECT_BAKE','COMPOSITE']}
assert not any(jobs.values()),jobs
assert props.get('scene_lease') in (None,'released'),('scene held',props)
assert props.get('scene_owner') in (None,'none'),('scene owned',props)
root=Path(%r);root.mkdir(parents=True,exist_ok=True);(root/'source').mkdir(exist_ok=True)
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
prior_file=bpy.data.filepath or 'unsaved default startup scene'
prior={}
if bpy.data.filepath:
 prior['prior_scene_file']={'path':prior_file,'sha256':hashlib.sha256(Path(prior_file).read_bytes()).hexdigest()}
sc['work_order']='WO111';sc['scene_owner']=%r;sc['scene_lease']='active'
sc['asset_id']='toon-clubhouse-kit';sc['asset_version']='v001';sc['authoring_model']='claude-opus-5-5 xhigh'
sc['candidate_status']='WO111 toon-clubhouse-kit v001 · authoring in progress'
lease={'work_order':'WO111','asset_id':'toon-clubhouse-kit','version':'v001',
 'task':'full static props kit (five GLBs) from the Codex Astra concept draft: build, export, stills, contact sheet, Khronos + three.js checks',
 'blender_instance':'blender-authoring (instance 1); instance 2 untouched','scene_owner':sc['scene_owner'],'scene_lease':'active','status':'active','claimed_utc':now,
 'props_before_claim':props,'scene_before_claim':{'file':prior_file,'object_count':len(bpy.data.objects)},'prior_files':prior,'jobs_at_claim':jobs,'readyz_at_claim':%r,
 'note':'Claimed from the released web-slinger-helper v001 reference-sheet scene. That file is never saved over; the first save is this kit\'s claim-checkpoint.blend.'}
(root/'scene-lease.json').write_text(json.dumps(lease,indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(root/'claim-checkpoint.blend'),compress=True)
print(json.dumps({'claimed':now,'filepath_now':bpy.data.filepath,'prior':prior,'props_before':props}))
''' % (REMOTE, OWNER, ready)))
