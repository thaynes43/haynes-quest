"""WO111 radio-host-showman (model stage): upload local sources to instance 1 (sha256-verified) and exec the last .py.

Every run first asserts this author still holds the instance-1 scene lease (claim_model.py excepted).
Usage: python3 author_run.py common.py build.py   (uploads both, runs build.py)
Optional init globals: RUN_GLOBALS='{"FAILURE":"..."}' in the environment.
"""
import json, os, sys, time
from pathlib import Path
sys.dont_write_bytecode = True
from mclient import MCP, LOCAL, REMOTE, upload

client = MCP(timeout=1800)
if sys.argv[-1] != 'claim_model.py':
    client.guard()
for name in sys.argv[1:]:
    assert Path(name).name == name
    print(json.dumps(upload(client, LOCAL / name, 'source/' + name)))
last = [n for n in sys.argv[1:] if n.endswith('.py')][-1]
g = json.loads(os.environ.get('RUN_GLOBALS', '{}'))
start = time.time()
out = client.text('import runpy,traceback\ntry:\n runpy.run_path(' + repr(REMOTE + '/source/' + last) + ', run_name="__main__", init_globals=' + repr(g) + ')\nexcept Exception:\n print("RUN FAILED\\n"+traceback.format_exc())')
print(out[-10000:]); print('elapsed %.1fs' % (time.time() - start))
