"""WO111 web-slinger-helper: run validate.mjs inside the instance-1 Blender pod (subprocess node + the installed Khronos
glTF Validator) against the exact GLB. Adapted from the demon-band-idol v001 run_validate.py."""
import json,sys
sys.dont_write_bytecode=True
from transfer import MCP,LOCAL,REMOTE,upload
c=MCP(timeout=600);c.guard()
print(json.dumps(upload(c,LOCAL/'validate.mjs','source/validate.mjs')))
print(c.text("import subprocess\nr=subprocess.run(['node',%r,%r],capture_output=True,text=True,timeout=300)\nprint('EXIT',r.returncode);print(r.stdout[-3000:]);print(r.stderr[-2000:])"%(REMOTE+'/source/validate.mjs',REMOTE)))
