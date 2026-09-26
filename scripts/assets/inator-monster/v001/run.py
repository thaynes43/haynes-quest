"""WO111 inator-monster v001: upload a local source file and execute it through the Blender MCP route (instance 1).

Adapted from the rival-mayor / bin-chicken run.py precedent. Every run first asserts this author holds the lease,
copies the exact bytes to the remote source/ directory with a sha256 check, then execs the last .py named.

  python3 run.py --inspect          read-only: scene lease props, file, jobs (no lease needed)
  python3 run.py claim.py           claim is guarded by its own checks, not the lease guard
  python3 run.py a.py b.py          upload all, execute the last
"""
from pathlib import Path
from urllib.request import Request, urlopen
import base64, hashlib, json, sys

LOCAL = Path(__file__).resolve().parent
REMOTE = '/workspace/haynes-quest/family-eras/inator-monster/v001'
HOST = 'http://blender-authoring.dev.svc.cluster.local:8000'
ENDPOINT = HOST + '/mcp'
OWNER = 'claude-opus-5-5 inator-monster reference-sheet subagent (session_016rSS1uA4XaroamTk1brNXn)'

class MCP:
    def __init__(self):
        self.session = None; self.counter = 0
        self.call('initialize', {'protocolVersion': '2024-11-05', 'capabilities': {}, 'clientInfo': {'name': 'wo111-inator-monster', 'version': '1'}})
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

INSPECT = r'''
import bpy, json
sc = bpy.context.scene
props = {k: str(sc[k]) for k in sc.keys() if k in ('work_order', 'scene_owner', 'scene_lease', 'asset_id', 'asset_version', 'authoring_model', 'candidate_status')}
jobs = {j: bpy.app.is_job_running(j) for j in ['RENDER', 'RENDER_PREVIEW', 'OBJECT_BAKE', 'COMPOSITE']}
print(json.dumps({'file': bpy.data.filepath, 'dirty': bpy.data.is_dirty, 'props': props, 'jobs': jobs, 'objects': len(bpy.data.objects), 'blender': bpy.app.version_string}))
'''

def upload(client, name):
    assert Path(name).name == name
    data = (LOCAL / name).read_bytes(); digest = hashlib.sha256(data).hexdigest(); target = REMOTE + '/source/' + name
    client.execute('from pathlib import Path\nimport base64,hashlib\np=Path(' + repr(target) + ')\np.parent.mkdir(parents=True,exist_ok=True)\n'
                   'p.write_bytes(base64.b64decode(' + repr(base64.b64encode(data).decode()) + '))\nassert hashlib.sha256(p.read_bytes()).hexdigest()==' + repr(digest))
    print(json.dumps({'file': name, 'bytes': len(data), 'sha256': digest, 'remote_verified': True}))
    return target

if __name__ == '__main__':
    client = MCP()
    args = sys.argv[1:]
    if args == ['--inspect']:
        print(urlopen(HOST + '/readyz', timeout=10).read().decode())
        print(text(client.execute(INSPECT))); sys.exit(0)
    if args != ['claim.py']:
        guard = ("import bpy; sc=bpy.context.scene; assert sc.get('work_order')=='WO111' and sc.get('asset_id')=='inator-monster' "
                 "and sc.get('scene_lease')=='active' and sc.get('scene_owner')==" + repr(OWNER) + ", 'lease not held'")
        print(text(client.execute(guard)))
    for name in args:
        target = upload(client, name)
        if name.endswith('.py') and name == args[-1]:
            out = client.execute('import runpy; runpy.run_path(' + repr(target) + ', run_name="__main__")')
            print(text(out)[-8000:])
