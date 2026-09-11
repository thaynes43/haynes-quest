"""Collect only scoped WO-010 deliverables; stream-verify remotely retained masters.
Run from any repository worktree. No concept or lead-owned review file is modified.
"""
import hashlib
import base64
import json
from pathlib import Path
import urllib.request

REPO=Path(__file__).resolve().parents[4]
BASE='http://blender-authoring.dev.svc.cluster.local:8000/artifacts/haynes-quest/clearing-kit/v001/'


def collect():
    manifest_bytes=urllib.request.urlopen(BASE+'delivery-manifest.json',timeout=30).read()
    manifest=json.loads(manifest_bytes)
    verified=[]
    for entry in manifest['files']:
        destination=entry['repository_path']
        out=None;path=None;partial=None
        if destination:
            path=(REPO/destination).resolve()
            assert path.is_relative_to(REPO)
            assert destination.startswith(('docs/assets/media/','scripts/assets/blender/clearing-kit-v001/'))
            assert path.name not in ('concept.png','prompt.txt','concept-provenance.json')
            path.parent.mkdir(parents=True,exist_ok=True)
            partial=path.with_name(path.name+'.download');out=partial.open('wb')
        digest=hashlib.sha256();size=0
        try:
            with urllib.request.urlopen(entry['url'],timeout=60) as response:
                while block:=response.read(1048576):
                    digest.update(block);size+=len(block)
                    if out: out.write(block)
        finally:
            if out: out.close()
        assert digest.hexdigest()==entry['sha256'] and size==entry['bytes'],entry['file']
        if partial:partial.replace(path)
        verified.append({'artifact_id':entry['artifact_id'],'sha256':digest.hexdigest(),'bytes':size,'saved_in_repository':bool(destination)})
        if entry.get('source_files'):
            bundle=json.loads(path.read_text())
            for source in entry['source_files']:
                assert source['file'] in ['build.py','render.py','validate.mjs','inspect-three.mjs','delivery.py','collect.py']
                data=base64.b64decode(bundle['files'][source['file']]['base64'],validate=True)
                assert hashlib.sha256(data).hexdigest()==source['sha256'] and len(data)==source['bytes'],source['file']
                target=REPO/'scripts/assets/blender/clearing-kit-v001'/source['file']
                temp=target.with_name(target.name+'.download');temp.write_bytes(data);temp.replace(target)
    folder=REPO/'scripts/assets/blender/clearing-kit-v001'
    (folder/'delivery-manifest.json').write_bytes(manifest_bytes)
    (folder/'collection-verification.json').write_text(json.dumps({'manifest_sha256':hashlib.sha256(manifest_bytes).hexdigest(),'verified_streams':verified},indent=2)+'\n')
    print(json.dumps({'verified_streams':len(verified),'saved_artifacts':sum(x['saved_in_repository'] for x in verified),'decoded_source_files':6,'master_files_verified':sum(x['artifact_id'].endswith('.blend') for x in verified)}))


if __name__=='__main__': collect()
