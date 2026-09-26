"""WO111 demon-band-idol: upload local sources to instance 2 (sha256-verified) and exec the last .py.

Every run first asserts this author still holds the instance-2 scene lease.
Usage: python3 author_run.py common.py build.py   (uploads both, runs build.py)
"""
import json,sys,time
from pathlib import Path
sys.dont_write_bytecode=True
from transfer import MCP,LOCAL,REMOTE,upload
client=MCP(timeout=1800);client.guard()
for name in sys.argv[1:]:
 assert Path(name).name==name
 print(json.dumps(upload(client,LOCAL/name,'source/'+name)))
last=[n for n in sys.argv[1:] if n.endswith('.py')][-1]
start=time.time()
out=client.text('import runpy,traceback\ntry:\n runpy.run_path('+repr(REMOTE+'/source/'+last)+', run_name="__main__")\nexcept Exception:\n print("RUN FAILED\\n"+traceback.format_exc())')
print(out[-8000:]);print('elapsed %.1fs'%(time.time()-start))
