"""Run validate.mjs inside the instance-2 Blender pod (subprocess node + its installed Khronos validator).
usage: python3 run_validate.py <asset-dir>/<id>.glb [--static hx,h,hz]"""
import json, sys
sys.dont_write_bytecode = True
from transfer import MCP, LOCAL, REMOTE, upload
c = MCP(timeout=600); print(c.guard())
print(json.dumps(upload(c, LOCAL / 'validate.mjs', 'source/validate.mjs')))
glb = REMOTE + '/' + sys.argv[1]; outp = glb[:-4] + '-validation.json'
extra = sys.argv[2:]
print(c.text("import subprocess\nr=subprocess.run(['node',%r,%r,%r]+%r,capture_output=True,text=True,timeout=300)\nprint('EXIT',r.returncode);print(r.stdout[-3000:]);print(r.stderr[-2000:])" % (REMOTE + '/source/validate.mjs', glb, outp, extra)))
