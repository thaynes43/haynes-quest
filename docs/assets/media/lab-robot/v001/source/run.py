"""WO111 lab-robot v001: upload local source files to instance 1 (sha256-verified) and exec the last .py.

Every run first asserts this author holds the lease. Usage: python3 run.py a.py b.py [exec.py]
Optional init globals: RUN_GLOBALS='{"SHEET_PERCENT":50}' in the environment.
"""
import json, os, sys, hashlib
from pathlib import Path
sys.dont_write_bytecode = True
from transfer import MCP, GUARD, REMOTE, LOCAL, upload

if __name__ == '__main__':
    c = MCP()
    if sys.argv[-1] != 'claim.py':
        print(c.text(GUARD))
    for name in sys.argv[1:]:
        assert Path(name).name == name
        print(json.dumps(upload(c, LOCAL / name, 'source/' + name)))
    last = sys.argv[-1]
    if last.endswith('.py'):
        g = json.loads(os.environ.get('RUN_GLOBALS', '{}'))
        out = c.text('import runpy; runpy.run_path(' + repr(REMOTE + '/source/' + last) + ', run_name="__main__", init_globals=' + repr(g) + ')')
        print(out[-8000:])
