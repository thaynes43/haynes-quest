"""Upload reviewed local scripts to instance 2 and execute the last Python file.

The scene must already be claimed by claim_resume.py. No other Blender instance is used.
"""
import json, sys
from pathlib import Path
sys.dont_write_bytecode = True
from transfer import MCP, GUARD, LOCAL, REMOTE, upload

c = MCP()
print(c.text(GUARD))
for name in sys.argv[1:]:
    assert Path(name).name == name
    print(json.dumps(upload(c, LOCAL / name, 'source/' + name)))
if sys.argv[-1].endswith('.py'):
    print(c.text('import runpy; runpy.run_path(' + repr(REMOTE + '/source/' + sys.argv[-1]) + ', run_name="__main__")'))
