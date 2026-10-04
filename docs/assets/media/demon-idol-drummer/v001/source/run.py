"""Upload local scripts to instance 2 (under source/) and execute the last .py with runpy.

Usage: python3 run.py common.py rig.py broccoli.py [-- arg=value ...]
The scene must already be claimed by claim.py. No other Blender instance is used.
"""
import json, sys
from pathlib import Path
sys.dont_write_bytecode = True
from transfer import MCP, LOCAL, REMOTE, upload

argv = sys.argv[1:]; extra = []
if '--' in argv: i = argv.index('--'); extra = argv[i + 1:]; argv = argv[:i]
c = MCP()
print(c.guard())
for name in argv:
    assert Path(name).name == name
    print(json.dumps(upload(c, LOCAL / name, 'source/' + name)))
if argv and argv[-1].endswith('.py'):
    code = ('import sys,runpy; sys.path.insert(0,' + repr(REMOTE + '/source') + '); sys.argv=' + repr([argv[-1]] + extra) +
            '\nfor m in [k for k in list(sys.modules) if k in ("common","rig","anim","kit")]: del sys.modules[m]' +
            '\nrunpy.run_path(' + repr(REMOTE + '/source/' + argv[-1]) + ', run_name="__main__")')
    print(c.text(code))
