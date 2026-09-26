"""WO111 putty-grunt: upload local sources to instance 2 (sha256-verified) and exec the last .py.

Every run first asserts this author still holds the instance-2 scene lease.
Usage: python3 author_run.py [KEY=json ...] common.py build.py   (uploads both, runs build.py with KEY globals)
Adapted from the mischief-kitten v001 author_run.py.
"""
import json,sys,time
from pathlib import Path
sys.dont_write_bytecode=True
from transfer import MCP,LOCAL,REMOTE,upload
OWNER='claude-opus-5-5/putty-grunt-model'
client=MCP(timeout=3600)
client.execute("import bpy; sc=bpy.context.scene; assert sc.get('work_order')=='WO111' and sc.get('asset_id')=='putty-grunt' and sc.get('scene_lease')=='active' and sc.get('scene_owner')=="+repr(OWNER)+", 'lease not held'")
init={};files=[]
for arg in sys.argv[1:]:
 if '=' in arg and not arg.endswith(('.py','.mjs','.json')):
  k,v=arg.split('=',1);init[k]=json.loads(v)
 else:files.append(arg)
for name in files:
 assert Path(name).name==name
 print(json.dumps(upload(client,LOCAL/name,'source/'+name)))
last=[n for n in files if n.endswith('.py')][-1]
start=time.time()
out=client.text('import runpy,traceback\ntry:\n runpy.run_path('+repr(REMOTE+'/source/'+last)+', init_globals='+repr(init)+', run_name="__main__")\nexcept Exception:\n print("RUN FAILED\\n"+traceback.format_exc())')
print(out[-12000:]);print('elapsed %.1fs'%(time.time()-start))
