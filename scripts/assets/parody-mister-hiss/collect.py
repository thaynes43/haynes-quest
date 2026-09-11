"""Retrieve and hash-verify the exact complete WO027 authoring package."""
from pathlib import Path
from urllib.request import urlopen
import hashlib,json,base64

REPO=Path(__file__).resolve().parents[3]
MEDIA=REPO/'docs/assets/media/mister-hiss/v001'
MASTERS=REPO/'.docs-build/mister-hiss-masters'
SCRIPTS=Path(__file__).resolve().parent
BASE='http://blender-authoring.dev.svc.cluster.local:8000/artifacts/haynes-quest/parody/mister-hiss/v001/'
PRESERVE={'concept.png','prompt.txt','concept-provenance.json'}

def digest(data):return hashlib.sha256(data).hexdigest()
def fetch(name):return urlopen(BASE+name,timeout=60).read()
def main():
    MEDIA.mkdir(parents=True,exist_ok=True);MASTERS.mkdir(parents=True,exist_ok=True)
    raw=fetch('delivery-manifest.json');delivery=json.loads(raw);manifest=delivery['asset'];results=[]
    for entry in manifest['files']:
        name=entry['local_name'];assert Path(name).name==name and name not in PRESERVE
        data=fetch(entry['remote_relative_path']);assert len(data)==entry['bytes'] and digest(data)==entry['sha256'],name
        target=(MASTERS if entry['role']=='editable_master' else MEDIA)/name;target.write_bytes(data)
        results.append({'path':str(target.relative_to(REPO)),'bytes':len(data),'sha256':digest(data),'transfer_verified':True})
    manifest_bytes=fetch('manifest.json');assert digest(manifest_bytes)==delivery['manifest']['sha256']
    (MEDIA/'manifest.json').write_bytes(manifest_bytes)
    bundle=fetch('source-bundle.json');assert digest(bundle)==manifest['source_bundle']['sha256']
    (SCRIPTS/'source-bundle.json').write_bytes(bundle)
    source_results=[]
    for entry in json.loads(bundle)['files']:
        data=base64.b64decode(entry['base64']);assert len(data)==entry['bytes'] and digest(data)==entry['sha256']
        target=SCRIPTS/entry['file'];assert target.parent==SCRIPTS
        assert target.read_bytes()==data,entry['file']
        source_results.append({'file':entry['file'],'bytes':len(data),'sha256':digest(data),'roundtrip_verified':True})
    (SCRIPTS/'delivery-manifest.json').write_bytes(raw)
    for name in ['scene-lease.json','render-process-completion.json']:(SCRIPTS/name).write_bytes((MEDIA/name).read_bytes())
    proof={'work_order':'WO-027','glb_sha256':manifest['glb_sha256'],'artifact_files':results,'source_files':source_results,
        'preserved_root_files':{name:digest((MEDIA/name).read_bytes()) for name in sorted(PRESERVE)},
        'all_transfer_hashes_match':True,'master_directory':str(MASTERS)}
    (SCRIPTS/'collection-verification.json').write_text(json.dumps(proof,indent=2)+'\n')
    print(json.dumps({'artifact_files':len(results),'source_files':len(source_results),'masters':str(MASTERS),'all_hashes_match':True}))

if __name__=='__main__':main()
