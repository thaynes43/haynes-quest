"""WO111 toon-clubhouse-kit v001: upload local source files (sha256-verified) and execute the last .py through the
Blender MCP route on INSTANCE 1. Every run first asserts this author holds the lease.
Usage: python3 run.py kit_common.py build_kit.py [--globals '{"KEY": value}']"""
import json, sys
sys.dont_write_bytecode = True
from transfer import MCP, LOCAL, REMOTE, GUARD, upload

args = sys.argv[1:]
init = {}
if '--globals' in args:
    i = args.index('--globals'); init = json.loads(args[i + 1]); del args[i:i + 2]
client = MCP(timeout=3000)
client.execute(GUARD)
for name in args:
    print(json.dumps(upload(client, LOCAL / name, 'source/' + name)))
last = [a for a in args if a.endswith('.py')][-1]
code = ('import runpy, sys\nsys.path.insert(0, ' + repr(REMOTE + '/source') + ')\n'
        'for m in [k for k in sys.modules if k.startswith("kit_")]: del sys.modules[m]\n'
        'runpy.run_path(' + repr(REMOTE + '/source/' + last) + ', run_name="__main__", init_globals=' + repr(init) + ')')
out = client.text(code)
print(out[-12000:])
