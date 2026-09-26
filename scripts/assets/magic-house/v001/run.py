"""WO111 magic-house v001: upload a local source file and execute it through the Blender MCP route.

Adapted from the honk-bus transfer.py precedent. Every run first asserts this author holds the lease,
copies the exact bytes to the remote source/ directory with a sha256 check, then execs them.
"""
from pathlib import Path
from urllib.request import Request, urlopen
import base64, hashlib, json, sys

LOCAL = Path(__file__).resolve().parent
REMOTE = '/workspace/haynes-quest/family-eras/magic-house/v001'
ENDPOINT = 'http://blender-authoring.dev.svc.cluster.local:8000/mcp'
OWNER = 'claude-opus-5-5 magic-house reference-sheet subagent (session_016rSS1uA4XaroamTk1brNXn)'

class MCP:
    def __init__(self):
        self.session = None; self.counter = 0
        self.call('initialize', {'protocolVersion': '2024-11-05', 'capabilities': {}, 'clientInfo': {'name': 'wo111-magic-house', 'version': '1'}})
        self.call('notifications/initialized', None, True)
    def call(self, method, params, notification=False):
        self.counter += 1; body = {'jsonrpc': '2.0', 'method': method}
        if not notification: body['id'] = self.counter
        if params is not None: body['params'] = params
        headers = {'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream'}
        if self.session: headers['Mcp-Session-Id'] = self.session
        with urlopen(Request(ENDPOINT, data=json.dumps(body).encode(), headers=headers), timeout=1800) as r:
            self.session = r.headers.get('Mcp-Session-Id', self.session); raw = r.read().decode()
        if not raw.strip(): return None
        if raw.lstrip().startswith('{'):
            response = json.loads(raw)
        else:
            response = next(json.loads(l[5:].strip()) for l in raw.splitlines() if l.startswith('data:') and json.loads(l[5:].strip()).get('id') == self.counter)
        if 'error' in response: raise RuntimeError(response['error'])
        result = response.get('result')
        if isinstance(result, dict) and result.get('isError'): raise RuntimeError(json.dumps(result)[:4000])
        return result
    def execute(self, code):
        return self.call('tools/call', {'name': 'execute_blender_code', 'arguments': {'code': code}})

def text(result):
    return '\n'.join(c.get('text', '') for c in (result or {}).get('content', []))

if __name__ == '__main__':
    client = MCP()
    guard = ("import bpy; sc=bpy.context.scene; assert sc.get('work_order')=='WO111' and sc.get('asset_id')=='magic-house' "
             "and sc.get('scene_lease')=='active' and sc.get('scene_owner')==" + repr(OWNER) + ", 'lease not held'")
    print(text(client.execute(guard)))
    for name in sys.argv[1:]:
        if '=' in name:  # upload-only form: <path under v001/>=<path under remote v001/>
            local, rel = name.split('=', 1); assert '..' not in rel and not rel.startswith('/')
            data = (LOCAL.parent / local).read_bytes(); digest = hashlib.sha256(data).hexdigest(); target = REMOTE + '/' + rel
            client.execute('from pathlib import Path\nimport base64,hashlib\np=Path(' + repr(target) + ')\np.parent.mkdir(parents=True,exist_ok=True)\n'
                           'p.write_bytes(base64.b64decode(' + repr(base64.b64encode(data).decode()) + '))\nassert hashlib.sha256(p.read_bytes()).hexdigest()==' + repr(digest))
            print(json.dumps({'file': target, 'bytes': len(data), 'sha256': digest, 'remote_verified': True})); continue
        assert Path(name).name == name
        data = (LOCAL / name).read_bytes(); digest = hashlib.sha256(data).hexdigest(); target = REMOTE + '/source/' + name
        client.execute('from pathlib import Path\nimport base64,hashlib\np=Path(' + repr(target) + ')\np.parent.mkdir(parents=True,exist_ok=True)\n'
                       'p.write_bytes(base64.b64decode(' + repr(base64.b64encode(data).decode()) + '))\nassert hashlib.sha256(p.read_bytes()).hexdigest()==' + repr(digest))
        print(json.dumps({'file': name, 'bytes': len(data), 'sha256': digest, 'remote_verified': True}))
        if name.endswith('.py') and name != 'run.py' and name == sys.argv[-1]:
            out = client.execute('import runpy; runpy.run_path(' + repr(target) + ', run_name="__main__")')
            print(text(out)[-6000:])
