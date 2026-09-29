"""WO111 rescue-harbor-kit v001: bounded MCP client for Blender authoring INSTANCE 1 only.

Streamable-HTTP JSON-RPC to blender-authoring (execute_blender_code, get_scene_info).
Instance 2 (blender-authoring-2) belongs to another author and is never touched.
Adapted from the WO111 bin-chicken / rival-mayor transfer.py.
"""
from pathlib import Path
from urllib.request import Request, urlopen
import base64, hashlib, json, sys

LOCAL = Path(__file__).resolve().parent
REMOTE = '/workspace/haynes-quest/family-eras/rescue-harbor-kit/v001'
HOST = 'http://blender-authoring.dev.svc.cluster.local:8000'
ENDPOINT = HOST + '/mcp'
ARTIFACTS = HOST + '/artifacts/haynes-quest/family-eras/rescue-harbor-kit/v001/'
OWNER = 'gpt-6-astra/rescue-harbor-kit-props'
GUARD = ("import bpy; sc=bpy.context.scene; assert sc.get('work_order')=='WO111' and sc.get('asset_id')=='rescue-harbor-kit' "
         "and sc.get('scene_lease')=='active' and sc.get('scene_owner')==" + repr(OWNER) + ", 'lease not held'")


class MCP:
    def __init__(self, timeout=1800):
        self.session = None; self.counter = 0; self.timeout = timeout
        self.call('initialize', {'protocolVersion': '2024-11-05', 'capabilities': {}, 'clientInfo': {'name': 'wo111-rescue-harbor-kit', 'version': '1'}})
        self.call('notifications/initialized', None, True)

    def call(self, method, params, notification=False):
        self.counter += 1; body = {'jsonrpc': '2.0', 'method': method}
        if not notification: body['id'] = self.counter
        if params is not None: body['params'] = params
        headers = {'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream'}
        if self.session: headers['Mcp-Session-Id'] = self.session
        with urlopen(Request(ENDPOINT, data=json.dumps(body).encode(), headers=headers), timeout=self.timeout) as r:
            self.session = r.headers.get('Mcp-Session-Id', self.session); raw = r.read().decode()
        if not raw.strip(): return None
        if raw.lstrip().startswith('{'):
            response = json.loads(raw)
        else:
            response = next(json.loads(l[5:].strip()) for l in raw.splitlines()
                            if l.startswith('data:') and json.loads(l[5:].strip()).get('id') == self.counter)
        if 'error' in response: raise RuntimeError(response['error'])
        result = response.get('result')
        if isinstance(result, dict) and result.get('isError'): raise RuntimeError(json.dumps(result)[:6000])
        return result

    def execute(self, code):
        return self.call('tools/call', {'name': 'execute_blender_code', 'arguments': {'code': code}})

    def text(self, code):
        r = self.execute(code)
        return '\n'.join(c.get('text', '') for c in (r or {}).get('content', []))

    def scene_info(self):
        r = self.call('tools/call', {'name': 'get_scene_info', 'arguments': {}})
        return '\n'.join(c.get('text', '') for c in (r or {}).get('content', []))


def upload(client, local, relative, chunk=96000):
    data = Path(local).read_bytes(); target = REMOTE + '/' + relative; digest = hashlib.sha256(data).hexdigest()
    client.execute('from pathlib import Path\np=Path(' + repr(target) + ');p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b"")')
    for offset in range(0, len(data), chunk):
        client.execute('import base64\nfrom pathlib import Path\nwith Path(' + repr(target) + ').open("ab") as f:f.write(base64.b64decode('
                       + repr(base64.b64encode(data[offset:offset + chunk]).decode()) + '))')
    client.execute('import hashlib\nfrom pathlib import Path\nassert hashlib.sha256(Path(' + repr(target) + ').read_bytes()).hexdigest()==' + repr(digest))
    return {'file': relative, 'bytes': len(data), 'sha256': digest, 'remote_verified': True}


def fetch(relative, dest):
    p = Path(dest); p.parent.mkdir(parents=True, exist_ok=True); p.write_bytes(urlopen(ARTIFACTS + relative, timeout=300).read()); return p


if __name__ == '__main__':
    client = MCP()
    print(client.scene_info()[:3000])
    print(client.text("import bpy,json,os\nsc=bpy.context.scene\nprint(json.dumps({'file':bpy.data.filepath,'props':{k:str(sc[k])[:300] for k in sc.keys() if not k.startswith('cycles')},'objects':len(bpy.data.objects),'version':bpy.app.version_string}))\n"
                      "print(sorted(os.listdir('/workspace/haynes-quest/family-eras')) if os.path.isdir('/workspace/haynes-quest/family-eras') else 'no family-eras')\n"
                      "print(os.listdir('/workspace/haynes-quest/family-eras/rescue-harbor-kit') if os.path.isdir('/workspace/haynes-quest/family-eras/rescue-harbor-kit') else 'no kit dir')"))
