"""Scoped file transfer through the authoring service's supported MCP endpoint.

Requires an explicit active WO051 lease. No scene objects or addons are changed.
Chunked base64 uploads are checksum-verified remotely; downloads use /artifacts/.
"""
from pathlib import Path
from urllib.request import Request,urlopen
import base64,hashlib,json,sys

LOCAL=Path(__file__).resolve().parent;REPO=LOCAL.parents[2]
REMOTE='/workspace/haynes-quest/bickering-besties/v001'
ENDPOINT='http://blender-authoring.dev.svc.cluster.local:8000/mcp'
ARTIFACTS='http://blender-authoring.dev.svc.cluster.local:8000/artifacts/haynes-quest/bickering-besties/v001/'

class MCP:
 def __init__(self):
  self.session=None;self.counter=0
  self.call('initialize',{'protocolVersion':'2024-11-05','capabilities':{},'clientInfo':{'name':'wo051-scoped-file-transfer','version':'1'}})
  self.call('notifications/initialized',None,notification=True)
 def call(self,method,params,notification=False):
  self.counter+=1;body={'jsonrpc':'2.0','method':method}
  if not notification:body['id']=self.counter
  if params is not None:body['params']=params
  headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream'}
  if self.session:headers['Mcp-Session-Id']=self.session
  with urlopen(Request(ENDPOINT,data=json.dumps(body).encode(),headers=headers),timeout=180) as r:
   self.session=r.headers.get('Mcp-Session-Id',self.session);raw=r.read().decode()
  if not raw.strip():return None
  if raw.lstrip().startswith('{'):response=json.loads(raw)
  else:
   events=[json.loads(line[5:].strip()) for line in raw.splitlines() if line.startswith('data:')]
   response=next(e for e in events if e.get('id')==self.counter)
  if 'error' in response:raise RuntimeError(response['error'])
  result=response.get('result')
  if isinstance(result,dict) and result.get('isError'):raise RuntimeError(result)
  return result
 def execute(self,code):return self.call('tools/call',{'name':'execute_blender_code','arguments':{'code':code}})

def main():
 if '--lease-granted' not in sys.argv:raise SystemExit('An explicit active root lease is required.')
 lease=json.loads(urlopen(ARTIFACTS+'scene-lease.json',timeout=30).read())
 assert lease['owner']=='/root/besties_models' and lease['status'].startswith('active'),lease
 (LOCAL/'scene-lease.json').write_text(json.dumps(lease,indent=2)+'\n')
 selected=[a for a in sys.argv[1:] if not a.startswith('--')]
 files=[]
 if selected:
  for name in selected:
   if '/' in name:
    asset,file=name.split('/',1);assert asset in ['bestie-pink','bestie-black'] and Path(file).name==file and file not in ['concept.png','prompt.txt','concept-provenance.json']
    source=REPO/'docs/assets/media'/asset/'v001'/file
   else:
    source=LOCAL/name;assert source.parent==LOCAL
   assert source.is_file();files.append((source,name))
 else:
  files.extend((p,p.name) for p in sorted(LOCAL.iterdir()) if p.suffix in ('.py','.mjs') or p.name=='concept-references.json')
  for name in ['bestie-pink','bestie-black']:
   for file in ['pigment.png','atlas-provenance.json']:files.append((REPO/'docs/assets/media'/name/'v001'/file,name+'/'+file))
 client=MCP();reports=[]
 for local,relative in files:
  data=local.read_bytes();sha=hashlib.sha256(data).hexdigest();target=REMOTE+'/'+relative
  client.execute('from pathlib import Path\np=Path('+repr(target)+')\np.parent.mkdir(parents=True,exist_ok=True)\np.write_bytes(b"")')
  for offset in range(0,len(data),96000):
   chunk=base64.b64encode(data[offset:offset+96000]).decode()
   client.execute('import base64\nfrom pathlib import Path\nwith Path('+repr(target)+').open("ab") as f:f.write(base64.b64decode('+repr(chunk)+'))')
  result=client.execute('import hashlib,json\nfrom pathlib import Path\np=Path('+repr(target)+')\nassert p.stat().st_size=='+str(len(data))+' and hashlib.sha256(p.read_bytes()).hexdigest()=='+repr(sha)+'\nprint(json.dumps({"file":'+repr(relative)+',"bytes":p.stat().st_size,"sha256":hashlib.sha256(p.read_bytes()).hexdigest()}))')
  reports.append({'file':relative,'bytes':len(data),'sha256':sha,'remote_verified':True})
  print(json.dumps(reports[-1]),flush=True)
 (LOCAL/'upload-verification.json').write_text(json.dumps({'work_order':'WO-032','files':reports,'all_remote_hashes_match':True},indent=2)+'\n')
if __name__=='__main__':main()
