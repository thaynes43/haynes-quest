"""Minimal streamable-HTTP MCP client for Blender instance 1 (blender-authoring, NOT -2)."""
from urllib.request import Request, urlopen
import json
ENDPOINT = 'http://blender-authoring.dev.svc.cluster.local:8000/mcp'
HOST = 'http://blender-authoring.dev.svc.cluster.local:8000'

class MCP:
    def __init__(self):
        self.session = None; self.counter = 0
        self.call('initialize', {'protocolVersion': '2024-11-05', 'capabilities': {}, 'clientInfo': {'name': 'wo111-demon-band-idol', 'version': '1'}})
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
    def text(self, code):
        r = self.execute(code)
        return '\n'.join(c.get('text', '') for c in (r or {}).get('content', []))
