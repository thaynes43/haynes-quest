"""Retrieve every required WO028 artifact via the service and verify exact hashes."""
from pathlib import Path
from urllib.request import urlopen
import base64,hashlib,json

REPO=Path(__file__).resolve().parents[3];SCRIPTS=Path(__file__).resolve().parent
MASTERS=SCRIPTS/'masters'
BASE='http://blender-authoring.dev.svc.cluster.local:8000/artifacts/haynes-quest/parody/block-party-pair/v001/'
PRESERVE={'concept.png','prompt.txt','concept-provenance.json'}

def digest(data):return hashlib.sha256(data).hexdigest()
def fetch(name):return urlopen(BASE+name,timeout=60).read()
def verified(entry,name):
    data=fetch(name);assert len(data)==entry['bytes'] and digest(data)==entry['sha256'],name;return data

def main():
    MASTERS.mkdir(parents=True,exist_ok=True)
    raw=fetch('delivery-manifest.json');checksum=fetch('delivery-checksum.json');advertised=json.loads(checksum)
    assert len(raw)==advertised['bytes'] and digest(raw)==advertised['sha256'],'delivery manifest checksum'
    delivery=json.loads(raw);results=[];preserved={}
    for asset,item in delivery['assets'].items():
        media=REPO/'docs/assets/media'/asset/'v001';manifest=item['manifest']
        preserved[asset]={n:digest((media/n).read_bytes()) for n in sorted(PRESERVE)}
        for entry in manifest['files']:
            name=entry['local_name'];assert Path(name).name==name and name not in PRESERVE
            data=verified(entry,entry['remote_relative_path'])
            target=(MASTERS/asset if entry['role']=='editable_master' else media)/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
            results.append({'path':str(target.relative_to(REPO)),'bytes':len(data),'sha256':digest(data),'transfer_verified':True})
        manifest_bytes=verified(item,item['file']);(media/'manifest.json').write_bytes(manifest_bytes)
        results.append({'path':str((media/'manifest.json').relative_to(REPO)),'bytes':len(manifest_bytes),'sha256':digest(manifest_bytes),'transfer_verified':True})
        source=json.loads((media/'source-build.json').read_text());decoded=base64.b64decode(source['base64'])
        assert source['file']=='source-build.py' and len(decoded)==source['bytes'] and digest(decoded)==source['sha256']
        snapshot=SCRIPTS/'snapshots'/(asset+'-build.py');snapshot.parent.mkdir(exist_ok=True);snapshot.write_bytes(decoded)
        results.append({'path':str(snapshot.relative_to(REPO)),'bytes':len(decoded),'sha256':digest(decoded),'transfer_verified':True,'transfer_encoding':'source-build.json base64 envelope'})
    for entry in delivery['shared_files']:
        data=verified(entry,entry['file']);target=(MASTERS if entry['file'].endswith('.blend') else SCRIPTS)/entry['file'];target.write_bytes(data)
        results.append({'path':str(target.relative_to(REPO)),'bytes':len(data),'sha256':digest(data),'transfer_verified':True})
    source_results=[]
    for entry in json.loads((SCRIPTS/'source-bundle.json').read_text())['files']:
        data=base64.b64decode(entry['base64']);assert len(data)==entry['bytes'] and digest(data)==entry['sha256']
        target=SCRIPTS/entry['file'];assert target.parent==SCRIPTS and target.read_bytes()==data,entry['file']
        source_results.append({'file':entry['file'],'bytes':len(data),'sha256':digest(data),'roundtrip_verified':True})
    (SCRIPTS/'delivery-manifest.json').write_bytes(raw)
    (SCRIPTS/'delivery-checksum.json').write_bytes(checksum)
    results.append({'path':str((SCRIPTS/'delivery-manifest.json').relative_to(REPO)),'bytes':len(raw),'sha256':digest(raw),'transfer_verified':True})
    proof={'work_order':'WO-028','artifact_files':results,'source_files':source_results,'preserved_root_files':preserved,
           'all_transfer_hashes_match':True,'master_directory':str(MASTERS)}
    (SCRIPTS/'collection-verification.json').write_text(json.dumps(proof,indent=2)+'\n')
    print(json.dumps({'artifacts':len(results),'sources':len(source_results),'masters':str(MASTERS),'all_hashes_match':True}))

if __name__=='__main__':main()
