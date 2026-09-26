"""WO111 magic-house v001: bounded MCP client for Blender INSTANCE 2 only.

Adapted from the honk-bus / golden-after-hours-rat transfer.py precedent. Instance 1
(blender-authoring) belongs to another author; this lane only talks to blender-authoring-2.
Usage:
  python3 transfer.py run <script.py>        upload source/<script> (sha-verified) and exec it (lease guard first)
  python3 transfer.py upload <local> <rel>   chunked upload of a local file to REMOTE/<rel>, sha-verified
  python3 transfer.py exec '<code>'          run a short snippet (no guard)
"""
from pathlib import Path
from urllib.request import Request, urlopen
import base64, hashlib, json, sys
sys.dont_write_bytecode = True

LOCAL = Path(__file__).resolve().parent
REMOTE = '/workspace/haynes-quest/family-eras/magic-house/v001'
HOST = 'http://blender-authoring-2.dev.svc.cluster.local:8000'
ENDPOINT = HOST + '/mcp'
ARTIFACTS = HOST + '/artifacts/haynes-quest/family-eras/magic-house/v001/'
# The blender-authoring 0.1.0 image hard-codes its MCP DNS-rebinding allowlist to the
# instance-1 names (blender-authoring*, localhost, 127.0.0.1), so instance 2 answers its own
# service name with "421 Invalid Host header". The TCP connection below still goes to
# instance 2's own service address; only the Host header uses an allowlisted loopback name.
# Tracked for a proper fix in thaynes43/haynes-ops#3209 (service.py allowed_hosts).
HOST_HEADER = 'localhost:8000'
OWNER = 'claude-opus-5-5 magic-house model subagent (session_016rSS1uA4XaroamTk1brNXn) on blender-authoring-2'
sha = lambda data: hashlib.sha256(data).hexdigest()

class MCP:
    def __init__(self):
        self.session = None; self.counter = 0
        self.call('initialize', {'protocolVersion': '2024-11-05', 'capabilities': {}, 'clientInfo': {'name': 'wo111-magic-house-model', 'version': '1'}})
        self.call('notifications/initialized', None, True)
    def call(self, method, params, notification=False):
        self.counter += 1; body = {'jsonrpc': '2.0', 'method': method}
        if not notification: body['id'] = self.counter
        if params is not None: body['params'] = params
        headers = {'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream', 'Host': HOST_HEADER}
        if self.session: headers['Mcp-Session-Id'] = self.session
        with urlopen(Request(ENDPOINT, data=json.dumps(body).encode(), headers=headers), timeout=1800) as r:
            self.session = r.headers.get('Mcp-Session-Id', self.session); raw = r.read().decode()
        if not raw.strip(): return None
        if raw.lstrip().startswith('{'): response = json.loads(raw)
        else: response = next(json.loads(l[5:].strip()) for l in raw.splitlines() if l.startswith('data:') and json.loads(l[5:].strip()).get('id') == self.counter)
        if 'error' in response: raise RuntimeError(response['error'])
        result = response.get('result')
        if isinstance(result, dict) and result.get('isError'): raise RuntimeError(json.dumps(result)[:6000])
        return result
    def execute(self, code):
        return self.call('tools/call', {'name': 'execute_blender_code', 'arguments': {'code': code}})
    def scene_info(self):
        return self.call('tools/call', {'name': 'get_scene_info', 'arguments': {}})

def text(result):
    return '\n'.join(c.get('text', '') for c in (result or {}).get('content', []))

GUARD = ("import bpy; sc=bpy.context.scene; assert sc.get('work_order')=='WO111' and sc.get('asset_id')=='magic-house' "
         "and sc.get('scene_lease')=='active' and sc.get('scene_owner')==" + repr(OWNER) + ", ('lease not held', dict(sc.items()) if False else [sc.get(k) for k in ('work_order','asset_id','scene_lease','scene_owner')])")

def upload(client, data, target, chunk=96000):
    client.execute('from pathlib import Path\np=Path(' + repr(target) + ');p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b"")')
    for off in range(0, len(data), chunk):
        client.execute('import base64\nfrom pathlib import Path\nwith Path(' + repr(target) + ').open("ab") as f:f.write(base64.b64decode(' + repr(base64.b64encode(data[off:off + chunk]).decode()) + '))')
    client.execute('import hashlib\nfrom pathlib import Path\nassert hashlib.sha256(Path(' + repr(target) + ').read_bytes()).hexdigest()==' + repr(sha(data)))
    return {'file': target, 'bytes': len(data), 'sha256': sha(data), 'remote_verified': True}

def fetch(rel, dest):
    data = urlopen(ARTIFACTS + rel, timeout=120).read(); Path(dest).parent.mkdir(parents=True, exist_ok=True); Path(dest).write_bytes(data); return sha(data)

if __name__ == '__main__':
    client = MCP(); cmd = sys.argv[1]
    if cmd == 'run':
        print(text(client.execute(GUARD)))
        for name in sys.argv[2:]:
            data = (LOCAL / name).read_bytes(); target = REMOTE + '/source/' + name
            print(json.dumps(upload(client, data, target)))
        last = REMOTE + '/source/' + sys.argv[-1]
        if last.endswith('.py'):
            out = client.execute('import runpy; runpy.run_path(' + repr(last) + ', run_name="__main__")')
            print(text(out)[-8000:])
    elif cmd == 'upload':
        for local, rel in zip(sys.argv[2::2], sys.argv[3::2]):
            print(json.dumps(upload(client, Path(local).read_bytes(), REMOTE + '/' + rel)))
    elif cmd == 'exec':
        print(text(client.execute(sys.argv[2]))[-8000:])
    elif cmd == 'info':
        print(text(client.scene_info())[-8000:])
    elif cmd == 'fetch':
        for rel, dest in zip(sys.argv[2::2], sys.argv[3::2]): print(rel, fetch(rel, dest))
