"""WO103 bounded source transfer and execution through the supported MCP route."""
from pathlib import Path
from urllib.request import Request,urlopen
import base64,hashlib,json,sys

LOCAL=Path(__file__).resolve().parent
REMOTE='/workspace/haynes-quest/rat-casino-cast/moth-projectionist/v001'
ENDPOINT='http://blender-authoring.dev.svc.cluster.local:8000/mcp'

class MCP:
 def __init__(self):
  self.session=None;self.counter=0
  self.call('initialize',{'protocolVersion':'2024-11-05','capabilities':{},'clientInfo':{'name':'wo103-scoped-transfer','version':'1'}})
  self.call('notifications/initialized',None,True)
 def call(self,method,params,notification=False):
  self.counter+=1;body={'jsonrpc':'2.0','method':method}
  if not notification:body['id']=self.counter
  if params is not None:body['params']=params
  headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream'}
  if self.session:headers['Mcp-Session-Id']=self.session
  with urlopen(Request(ENDPOINT,data=json.dumps(body).encode(),headers=headers),timeout=180) as r:
   self.session=r.headers.get('Mcp-Session-Id',self.session);raw=r.read().decode()
  if not raw.strip():return None
  response=json.loads(raw) if raw.lstrip().startswith('{') else next(json.loads(line[5:].strip()) for line in raw.splitlines() if line.startswith('data:') and json.loads(line[5:].strip()).get('id')==self.counter)
  if 'error' in response:raise RuntimeError(response['error'])
  result=response.get('result')
  if isinstance(result,dict) and result.get('isError'):raise RuntimeError(result)
  return result
 def execute(self,code):
  return self.call('tools/call',{'name':'execute_blender_code','arguments':{'code':code}})

if __name__=='__main__':
 client=MCP()
 client.execute("import bpy; assert bpy.context.scene.get('work_order')=='WO103' and bpy.context.scene.get('scene_lease')=='active'")
 for name in sys.argv[1:]:
  assert Path(name).name==name
  source=LOCAL/name;data=source.read_bytes();target=REMOTE+'/source/'+name
  result=client.execute('from pathlib import Path\nimport base64,hashlib\np=Path('+repr(target)+')\np.write_bytes(base64.b64decode('+repr(base64.b64encode(data).decode())+'))\nassert hashlib.sha256(p.read_bytes()).hexdigest()=='+repr(hashlib.sha256(data).hexdigest()))
  print(json.dumps({'file':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'remote_verified':True}))
