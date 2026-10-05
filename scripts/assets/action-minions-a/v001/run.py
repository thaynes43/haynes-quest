"""Action minions A: upload local sources to instance 1 (sha256-verified) and exec the last .py there.

Every run first asserts this author holds the lease. Usage: python3 run.py common.py hopper_build.py
Optional init globals: RUN_GLOBALS='{"ASSET":"gadget-hammer-hopper"}' in the environment.
"""
import json, os, sys, time
from pathlib import Path
sys.dont_write_bytecode = True
from client import MCP, LOCAL, REMOTE, upload

client = MCP(timeout=3600)
print(client.guard())
for name in sys.argv[1:]:
    assert Path(name).name == name
    print(json.dumps(upload(client, LOCAL / name, 'source/' + name)))
last = [n for n in sys.argv[1:] if n.endswith('.py')][-1]
g = json.loads(os.environ.get('RUN_GLOBALS', '{}'))
start = time.time()
out = client.text('import runpy,traceback\ntry:\n runpy.run_path(' + repr(REMOTE + '/source/' + last) + ', run_name="__main__", init_globals=' + repr(g) + ')\nexcept Exception:\n print("RUN FAILED\\n"+traceback.format_exc())')
print(out[-12000:]); print('elapsed %.1fs' % (time.time() - start))
