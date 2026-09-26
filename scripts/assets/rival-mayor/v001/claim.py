"""WO111 rival-mayor: claim the exclusive scene lease on Blender instance 2."""
import json,sys,datetime
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
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
objects=[o.name for o in bpy.data.objects]
sc['work_order']='WO111';sc['scene_owner']='claude-opus-5-5/rival-mayor-model';sc['scene_lease']='active'
sc['asset_id']='rival-mayor';sc['asset_version']='v001';sc['authoring_model']='claude-opus-5-5 xhigh'
lease={'work_order':'WO111','asset_id':'rival-mayor','version':'v001','task':'full model from the approved Blender reference sheet (refine, UV, rig, five clips, export, evidence)',
 'blender_instance':'blender-authoring-2 (isolated second instance; own scene and /workspace)','scene_owner':sc['scene_owner'],'scene_lease':'active','status':'active','claimed_utc':now,
 'props_before_claim':props,'scene_before_claim':{'file':bpy.data.filepath or 'unsaved default startup scene','objects':objects},'jobs_at_claim':jobs,'readyz_at_claim':%r}
(root/'scene-lease.json').write_text(json.dumps(lease,indent=2)+'\n')
print(json.dumps(lease,indent=1))
'''%(REMOTE,ready)))
