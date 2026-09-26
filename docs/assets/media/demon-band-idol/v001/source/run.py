"""WO111 demon-band-idol v001: upload a local source file and execute it through the Blender MCP route (instance 1).

Adapted from the bin-chicken / inator-monster run.py precedent. Every run first asserts this author holds the lease
(except claim.py, which takes it), copies the exact bytes to the remote source/ directory with a sha256 check, then
execs the last named .py file.  Usage: python3 run.py file1.py [file2.py ...]
"""
from pathlib import Path
import base64, hashlib, json, sys
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from mcpclient import MCP

LOCAL = Path(__file__).resolve().parent
REMOTE = '/workspace/haynes-quest/family-eras/demon-band-idol/v001'
OWNER = 'claude-opus-5-5 demon-band-idol reference-sheet subagent (session_016rSS1uA4XaroamTk1brNXn)'

if __name__ == '__main__':
    client = MCP()
    if sys.argv[-1] != 'claim.py':
        guard = ("import bpy; sc=bpy.context.scene; assert sc.get('work_order')=='WO111' and sc.get('asset_id')=='demon-band-idol' "
                 "and sc.get('scene_lease')=='active' and sc.get('scene_owner')==" + repr(OWNER) + ", 'lease not held'")
        print(client.text(guard))
    for name in sys.argv[1:]:
        assert Path(name).name == name
        data = (LOCAL / name).read_bytes(); digest = hashlib.sha256(data).hexdigest(); target = REMOTE + '/source/' + name
        client.execute('from pathlib import Path\nimport base64,hashlib\np=Path(' + repr(target) + ')\np.parent.mkdir(parents=True,exist_ok=True)\n'
                       'p.write_bytes(base64.b64decode(' + repr(base64.b64encode(data).decode()) + '))\nassert hashlib.sha256(p.read_bytes()).hexdigest()==' + repr(digest))
        print(json.dumps({'file': name, 'bytes': len(data), 'sha256': digest, 'remote_verified': True}))
        if name.endswith('.py') and name == sys.argv[-1]:
            out = client.text('import runpy; runpy.run_path(' + repr(target) + ', run_name="__main__")')
            print(out[-8000:])
