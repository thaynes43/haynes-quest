"""Download and verify the exact WO-016 artifact inventory from its service.

Editable masters are retained on the local PVC under ignored test-results;
public candidate/evidence files go only to this work order's owned media paths.
"""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

BASE='http://blender-authoring.dev.svc.cluster.local:8000/artifacts/haynes-quest/era-2024/v001/'
ASSETS={'loop-dancer','prism-mimic','trendweaver'}
PRESERVED={'concept.png','prompt.txt','concept-provenance.json'}

def collect(repo,base):
 repo=Path(repo)
 raw=urlopen(base+'delivery-manifest.json',timeout=60).read()
 manifest=json.loads(raw);results={}
 for name,asset in manifest['assets'].items():
  assert name in ASSETS,name
  media=repo/'docs/assets/media'/name/'v001';media.mkdir(parents=True,exist_ok=True)
  masters=repo/'test-results/era-2024-masters'/name;masters.mkdir(parents=True,exist_ok=True)
  results[name]=[]
  for entry in asset['files']:
   relative=Path(entry['remote_relative_path']);filename=entry['local_name']
   assert not relative.is_absolute() and '..' not in relative.parts
   assert relative.parts[0]==name and Path(filename).name==filename
   assert filename not in PRESERVED
   data=urlopen(base+relative.as_posix(),timeout=60).read()
   assert len(data)==entry['bytes'],str(relative)
   actual=hashlib.sha256(data).hexdigest();assert actual==entry['sha256'],str(relative)
   destination=(masters if entry['role']=='editable_master' else media)/filename
   destination.write_bytes(data)
   results[name].append({'path':str(destination),'bytes':len(data),'sha256':actual})
  (media/'manifest.json').write_text(json.dumps(asset,indent=2)+'\n')
 record={'remote_manifest_sha256':hashlib.sha256(raw).hexdigest(),'files':results,'all_downloads_hash_verified':True}
 (repo/'scripts/assets/era-2024/collection-verification.json').write_text(json.dumps(record,indent=2)+'\n')
 print(json.dumps({'assets':{name:len(files) for name,files in results.items()},'all_downloads_hash_verified':True}))

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--repo',default='.');parser.add_argument('--base',default=BASE)
 args=parser.parse_args();collect(args.repo,args.base)
