"""Retrieve actual authoring artifacts and verify every byte against delivery."""
from pathlib import Path
import urllib.request,json,hashlib,sys,base64

BASE='http://blender-authoring.dev.svc.cluster.local:8000/artifacts/haynes-quest/era-2020/v001/'
REPO=Path(__file__).resolve().parents[3]
OUT=REPO/'scripts/assets/era-2020'
BUNDLED={}

def get(relative,expected=None):
 data=base64.b64decode(BUNDLED[relative]['base64'],validate=True) if relative in BUNDLED else urllib.request.urlopen(BASE+relative,timeout=60).read()
 actual={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
 if expected is not None:assert actual==expected,(relative,actual,expected)
 return data,actual

def collect():
 global BUNDLED
 data,manifest_digest=get('delivery-manifest.json');manifest=json.loads(data)
 bundle,_=get('source-bundle.json',manifest['scripts']['source-bundle.json']);BUNDLED=json.loads(bundle)['files']
 report={'delivery_manifest':manifest_digest,'assets':{},'scripts':{}}
 for name,asset in manifest['assets'].items():
  verified={}
  for file,expected in asset['files'].items():
   data,actual=get(name+'/'+file,expected)
   if file.endswith('.blend'):target=REPO/'test-results/era-2020-masters'/file
   elif file=='construction-source.py':target=OUT/'snapshots'/(name+'-build.py')
   else:target=REPO/'docs/assets/media'/name/'v001'/file
   target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data);verified[file]={**actual,'local_path':str(target.relative_to(REPO))}
  report['assets'][name]=verified
 for file,expected in manifest['scripts'].items():
  data,actual=get(file,expected);target=OUT/file
  if target.exists() and file!='scene-lease.json':assert target.read_bytes()==data,('local source differs',file)
  else:target.write_bytes(data)
  report['scripts'][file]=actual
 (OUT/'delivery-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 (OUT/'collection-verification.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps({'verified_files':sum(len(v) for v in report['assets'].values()),'assets':list(report['assets']),'masters_verified_and_retained_locally':True,'delivery_manifest':manifest_digest}))

if __name__=='__main__':collect()
