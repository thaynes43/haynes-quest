"""Retrieve only owned WO-017 artifact paths, preserving lead concepts.

Run after build/render/validator finish remotely. Editable master byte streams
are hash-verified and stay on the dedicated authoring PVC. Browser intake runs
locally after collection, and finalize.py records its exact artifacts.
"""
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

REPO = Path(__file__).resolve().parents[3]
BASE = 'http://blender-authoring.dev.svc.cluster.local:8000/artifacts/haynes-quest/era-equipment/v001/'
NAMES = ['spark-mallet', 'acorn-shield', 'prism-wand', 'ribbon-shield']


def fetch(relative):
    assert not relative.startswith('/') and '..' not in Path(relative).parts
    return urlopen(BASE + relative, timeout=60).read()


def collect():
    verified = []
    for name in NAMES:
        folder = REPO / 'docs/assets/media/era-equipment/v001' / name
        folder.mkdir(parents=True, exist_ok=True)
        construction_data = fetch(name + '/construction.json'); construction = json.loads(construction_data)
        entries = [name + '.glb', 'construction.json', 'validation.json', 'reimport.json', 'render-complete.json', 'beauty.png', 'front.png', 'side.png', 'back.png']
        if 'shield' in name: entries.append('rear-grip.png')
        for file in entries:
            data = construction_data if file == 'construction.json' else fetch(name + '/' + file)
            hash_value = hashlib.sha256(data).hexdigest()
            if file in construction['files']:
                assert hash_value == construction['files'][file]['sha256'] and len(data) == construction['files'][file]['bytes']
            (folder / file).write_bytes(data)
            verified.append({'file': name + '/' + file, 'sha256': hash_value, 'bytes': len(data), 'saved_in_repository': True})
        for file in [name + '.blend', name + '-export-review.blend']:
            data = fetch(name + '/' + file); hash_value = hashlib.sha256(data).hexdigest()
            if file in construction['files']:
                assert hash_value == construction['files'][file]['sha256'] and len(data) == construction['files'][file]['bytes']
            verified.append({'file': name + '/' + file, 'artifact_id': 'haynes-quest/era-equipment/v001/' + name + '/' + file, 'sha256': hash_value, 'bytes': len(data), 'saved_in_repository': False})
        print(name, 'collected and master byte streams verified')
    for file in ['live-scene-release.blend', 'scene-release.json', 'source-bundle.json', 'render-job-completion.json']:
        data = fetch(file); hash_value = hashlib.sha256(data).hexdigest()
        saved = file.endswith('.json')
        if saved: Path(__file__).with_name(file).write_bytes(data)
        verified.append({'file': file, 'artifact_id': 'haynes-quest/era-equipment/v001/' + file, 'sha256': hash_value, 'bytes': len(data), 'saved_in_repository': saved})
    (Path(__file__).with_name('collection-verification.json')).write_text(json.dumps({'artifact_root': 'haynes-quest/era-equipment/v001', 'files': verified}, indent=2) + '\n')


if __name__ == '__main__': collect()
