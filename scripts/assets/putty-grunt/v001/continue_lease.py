"""WO111 putty-grunt: record that a fresh Claude Opus 5.5 session continues the same full-model work order under the
existing instance-2 lease (the first session stopped at its plan's usage limit after the geometry checkpoint; the
scene stayed claimed, saved and not dirty). No other author held or touched the scene in between."""
import json,sys,datetime
from urllib.request import urlopen
sys.dont_write_bytecode=True
from transfer import MCP,HOST,REMOTE
ready=json.loads(urlopen(HOST+'/readyz',timeout=10).read())
c=MCP()
print(c.text(r'''
import bpy,json,datetime
from pathlib import Path
sc=bpy.context.scene
assert sc.get('work_order')=='WO111' and sc.get('asset_id')=='putty-grunt' and sc.get('scene_lease')=='active' and sc.get('scene_owner')=='claude-opus-5-5/putty-grunt-model'
jobs={j:bpy.app.is_job_running(j) for j in ['RENDER','RENDER_PREVIEW','OBJECT_BAKE','COMPOSITE']}
assert not any(jobs.values()),jobs
root=Path(%r);lease=json.loads((root/'scene-lease.json').read_text())
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
lease.setdefault('continuations',[]).append({'utc':now,'by':'claude-opus-5-5 xhigh (fresh session of the same WO111 putty-grunt full-model task after the owner restored plan usage)',
 'reason':'The first session stopped at its 5-hour plan usage limit after the 20:15 UTC geometry checkpoint without releasing the lease; the live scene was saved and not dirty.',
 'live_scene_file':bpy.data.filepath,'dirty':bpy.data.is_dirty,'objects':len(bpy.data.objects),'readyz':%r,'jobs':jobs})
(root/'scene-lease.json').write_text(json.dumps(lease,indent=2)+'\n')
print(json.dumps(lease['continuations'][-1]))
'''%(REMOTE,ready)))
