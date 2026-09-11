"""Download the exact WO-007 candidate delivery and verify every byte stream.

Run from the repository root after authoring delivery-manifest.json is saved:
  python3 scripts/assets/travelers/collect.py
Large editable .blend masters are verified in transit and remain on the remote
PVC. Only scoped preview/runtime assets are written into docs/assets/media.
"""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

BASE='http://blender-authoring.dev.svc.cluster.local:8000/artifacts/haynes-quest/travelers/v001/'


def collect(repo,base=BASE):
    manifest=json.load(urlopen(base+'delivery-manifest.json',timeout=20))
    for stage in ('infant','child'):
        target=Path(repo)/'docs/assets/media'/('traveler-'+stage)/'v001'
        target.mkdir(parents=True,exist_ok=True)
        entry=manifest['stages'][stage]
        for item in entry['files']:
            remote=item['remote_relative_path']
            if remote.startswith('/') or '..' in Path(remote).parts:
                raise ValueError('Unsafe artifact path')
            data=urlopen(base+remote,timeout=60).read()
            assert len(data)==item['bytes'],remote
            assert hashlib.sha256(data).hexdigest()==item['sha256'],remote
            name=item.get('local_name')
            if name:
                assert Path(name).name==name,name
                (target/name).write_bytes(data)
        (target/'manifest.json').write_text(json.dumps(entry,indent=2)+'\n')
        print(stage, 'verified',len(entry['files']),'files')


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--repo',default='.')
    parser.add_argument('--base',default=BASE)
    args=parser.parse_args()
    collect(args.repo,args.base)
