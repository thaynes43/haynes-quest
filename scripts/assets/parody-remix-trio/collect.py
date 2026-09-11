"""Hash-verify every WO032 runtime/media/master/source through the artifact route."""
from pathlib import Path
from urllib.request import urlopen
import argparse,hashlib,json,base64

REPO=Path(__file__).resolve().parents[3];SCRIPTS=Path(__file__).resolve().parent
MASTERS=REPO/'.docs-build/remix-trio-masters'
BASE='http://blender-authoring.dev.svc.cluster.local:8000/artifacts/haynes-quest/parody/remix-trio/v001/'
PRESERVE={'concept.png','prompt.txt','concept-provenance.json'}
def digest(data):return hashlib.sha256(data).hexdigest()
def fetch(name):return urlopen(BASE+name,timeout=60).read()

def main(manifest_file='delivery-manifest.json'):
 raw=fetch(manifest_file);delivery=json.loads(raw);results=[]
 for entry in delivery['assets']:
  manifest=entry['asset'];name=manifest['asset_id'];media=REPO/'docs/assets/media'/name/'v001';masters=MASTERS/name;masters.mkdir(parents=True,exist_ok=True)
  original={n:digest((media/n).read_bytes()) for n in PRESERVE}
  for file in manifest['files']:
   n=file['local_name'];assert Path(n).name==n and n not in PRESERVE
   data=fetch(file['remote_relative_path']);assert len(data)==file['bytes'] and digest(data)==file['sha256'],(name,n)
   target=(masters if file['role']=='editable_master' else media)/n;target.write_bytes(data)
   results.append({'path':str(target.relative_to(REPO)),'bytes':len(data),'sha256':digest(data),'transfer_verified':True})
  m=entry['manifest'];data=fetch(m['relative_path']);assert len(data)==m['bytes'] and digest(data)==m['sha256'];(media/'manifest.json').write_bytes(data)
  assert original=={n:digest((media/n).read_bytes()) for n in PRESERVE}
 for entry in delivery['global_files']:
  data=fetch(entry['file']);assert len(data)==entry['bytes'] and digest(data)==entry['sha256'];(SCRIPTS/entry['file']).write_bytes(data)
 sources=[]
 for entry in json.loads((SCRIPTS/'source-bundle.json').read_text())['files']:
  data=base64.b64decode(entry['base64']);assert len(data)==entry['bytes'] and digest(data)==entry['sha256'];target=SCRIPTS/entry['file'];assert target.parent==SCRIPTS and target.read_bytes()==data
  sources.append({'file':entry['file'],'bytes':len(data),'sha256':digest(data),'roundtrip_verified':True})
 (SCRIPTS/manifest_file).write_bytes(raw)
 proof={'work_order':'WO-032','artifact_files':results,'source_files':sources,'all_transfer_hashes_match':True,'master_directory':str(MASTERS),'preserved_root_files':{a['asset']['asset_id']:{n:digest((REPO/'docs/assets/media'/a['asset']['asset_id']/'v001'/n).read_bytes()) for n in sorted(PRESERVE)} for a in delivery['assets']}}
 proof_file=manifest_file.replace('delivery-manifest','collection-verification')
 (SCRIPTS/proof_file).write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps({'artifact_files':len(results),'source_files':len(sources),'masters':str(MASTERS),'all_hashes_match':True}))
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--manifest',default='delivery-manifest.json');args=parser.parse_args();assert Path(args.manifest).name==args.manifest;main(args.manifest)
