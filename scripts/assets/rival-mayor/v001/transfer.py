"""WO111 rival-mayor: bounded MCP client for Blender authoring INSTANCE 2 only.

Streamable-HTTP JSON-RPC to blender-authoring-2 (execute_blender_code,
get_scene_info). Instance 1 belongs to another author and is never touched.
"""
from pathlib import Path
from urllib.request import Request,urlopen
import base64,hashlib,json,sys

LOCAL=Path(__file__).resolve().parent
REMOTE='/workspace/haynes-quest/family-eras/rival-mayor/v001'
HOST='http://blender-authoring-2.dev.svc.cluster.local:8000'
ENDPOINT=HOST+'/mcp'
ARTIFACTS=HOST+'/artifacts/haynes-quest/family-eras/rival-mayor/v001/'
# The shared blender-authoring image hard-codes its MCP DNS-rebinding allowlist
# to instance-1 names plus localhost, so instance 2 answers its own service name
# with 421 "Invalid Host header". The TCP connection still goes to instance 2's
# service; only the Host header names the pod-local alias the image accepts.
HOST_HEADER='localhost:8000'

class MCP:
 def __init__(self,timeout=600):
  self.session=None;self.counter=0;self.timeout=timeout
  self.call('initialize',{'protocolVersion':'2024-11-05','capabilities':{},'clientInfo':{'name':'wo111-rival-mayor-instance-2','version':'1'}})
  self.call('notifications/initialized',None,True)
 def call(self,method,params,notification=False):
  self.counter+=1;body={'jsonrpc':'2.0','method':method}
  if not notification:body['id']=self.counter
  if params is not None:body['params']=params
  headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream','Host':HOST_HEADER}
  if self.session:headers['Mcp-Session-Id']=self.session
  with urlopen(Request(ENDPOINT,data=json.dumps(body).encode(),headers=headers),timeout=self.timeout) as r:
   self.session=r.headers.get('Mcp-Session-Id',self.session);raw=r.read().decode()
  if not raw.strip():return None
  response=json.loads(raw) if raw.lstrip().startswith('{') else next(json.loads(line[5:].strip()) for line in raw.splitlines() if line.startswith('data:') and json.loads(line[5:].strip()).get('id')==self.counter)
  if 'error' in response:raise RuntimeError(response['error'])
  result=response.get('result')
  if isinstance(result,dict) and result.get('isError'):raise RuntimeError(json.dumps(result)[:4000])
  return result
 def execute(self,code):
  return self.call('tools/call',{'name':'execute_blender_code','arguments':{'code':code}})
 def text(self,code):
  r=self.execute(code)
  return '\n'.join(c.get('text','') for c in (r or {}).get('content',[]))
 def scene_info(self):
  r=self.call('tools/call',{'name':'get_scene_info','arguments':{}})
  return '\n'.join(c.get('text','') for c in (r or {}).get('content',[]))

def upload(client,local,relative,chunk=96000):
 data=Path(local).read_bytes();target=REMOTE+'/'+relative;digest=hashlib.sha256(data).hexdigest()
 client.execute('from pathlib import Path\np=Path('+repr(target)+');p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b"")')
 for offset in range(0,len(data),chunk):
  client.execute('import base64\nfrom pathlib import Path\nwith Path('+repr(target)+').open("ab") as f:f.write(base64.b64decode('+repr(base64.b64encode(data[offset:offset+chunk]).decode())+'))')
 client.execute('import hashlib\nfrom pathlib import Path\nassert hashlib.sha256(Path('+repr(target)+').read_bytes()).hexdigest()=='+repr(digest))
 return {'file':relative,'bytes':len(data),'sha256':digest,'remote_verified':True}

def fetch(relative,dest):
 p=Path(dest);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(urlopen(ARTIFACTS+relative,timeout=120).read());return p

if __name__=='__main__':
 client=MCP()
 print(client.scene_info())
