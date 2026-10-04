"""Action minions A: authoring loop for one asset (local side).

  python3 cycle.py <asset-id> inspect        fetch the exported GLB + construction record, run the Three inspection
  python3 cycle.py <asset-id> bounds <anim>  as inspect with --write-bounds, upload bounds.json, re-run <anim>.py
                                             (re-export with the culling envelope) and inspect the new bytes
"""
import json, subprocess, sys
from pathlib import Path
sys.dont_write_bytecode = True
from client import MCP, fetch, upload, LOCAL
REPO = LOCAL.parents[3]
asset, mode = sys.argv[1], sys.argv[2]
work = Path('/tmp/minions-a') / asset / 'art'
def pull():
    for n in (asset + '.glb', 'construction.json'): fetch(asset + '/' + n, work / n)
def inspect(extra=()):
    r = subprocess.run([str(REPO / 'node_modules/.bin/tsx'), str(LOCAL / 'inspect-three.mjs'), asset, str(work), *extra], cwd=REPO, capture_output=True, text=True)
    print(r.stdout[-6000:], r.stderr[-3000:]); return r.returncode
pull()
if mode == 'inspect': sys.exit(inspect())
if mode == 'bounds':
    inspect(['--write-bounds'])
    c = MCP(); print(c.guard()); print(json.dumps(upload(c, work / 'bounds.json', asset + '/bounds.json')))
    r = subprocess.run([sys.executable, str(LOCAL / 'run.py'), sys.argv[3] + '.py'], cwd=LOCAL, capture_output=True, text=True); print(r.stdout[-1500:])
    pull(); sys.exit(inspect())
