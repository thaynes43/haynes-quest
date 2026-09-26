"""WO111 rival-mayor: run validate.mjs inside the instance-2 Blender pod (subprocess node) against the exact GLB."""
import json,sys
sys.dont_write_bytecode=True
from transfer import MCP,LOCAL,REMOTE,upload
c=MCP(timeout=600)
c.execute("import bpy; sc=bpy.context.scene; assert sc.get('work_order')=='WO111' and sc.get('asset_id')=='rival-mayor' and sc.get('scene_lease')=='active'")
print(json.dumps(upload(c,LOCAL/'validate.mjs','source/validate.mjs')))
print(c.text("import subprocess\nr=subprocess.run(['node',%r,%r],capture_output=True,text=True,timeout=300)\nprint('EXIT',r.returncode);print(r.stdout[-3000:]);print(r.stderr[-2000:])"%(REMOTE+'/source/validate.mjs',REMOTE)))
