"""Action minions A: run validate.mjs inside the instance-1 Blender pod (subprocess node) against the exact exported GLB."""
import json, sys
sys.dont_write_bytecode = True
from client import MCP, LOCAL, REMOTE, upload
asset = sys.argv[1]
c = MCP(timeout=600); print(c.guard())
print(json.dumps(upload(c, LOCAL / 'validate.mjs', 'source/validate.mjs')))
print(c.text("import subprocess\nr=subprocess.run(['node',%r,%r,%r],capture_output=True,text=True,timeout=300)\nprint('EXIT',r.returncode);print(r.stdout[-3000:]);print(r.stderr[-2000:])" % (REMOTE + '/source/validate.mjs', asset, REMOTE + '/' + asset)))
