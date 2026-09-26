"""WO111 toon-clubhouse-kit: run validate.mjs inside the instance-1 Blender pod (subprocess node) against the exact GLBs."""
import json, sys
sys.dont_write_bytecode = True
from transfer import MCP, LOCAL, REMOTE, upload, GUARD
c = MCP(timeout=600); c.execute(GUARD)
print(json.dumps(upload(c, LOCAL / 'validate.mjs', 'source/validate.mjs')))
print(c.text("import subprocess\nr=subprocess.run(['node',%r,%r],capture_output=True,text=True,timeout=300)\nprint('EXIT',r.returncode);print(r.stdout[-4000:]);print(r.stderr[-2000:])" % (REMOTE + '/source/validate.mjs', REMOTE)))
