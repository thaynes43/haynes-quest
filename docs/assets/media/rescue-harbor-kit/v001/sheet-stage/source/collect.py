"""Copy the remote v001 directory durably to /home/dev/artifacts and write sha256-manifest.json.

Adapted from the playroom-kit v001 collect.py (lab-robot / putty-grunt lineage). Lists the remote files read-only (hash computed inside the Blender
pod), downloads each through GET /artifacts/, verifies the downloaded bytes against the remote hash, and records
local-only files separately. Run after release.py.
"""
from pathlib import Path
from urllib.request import urlopen
from urllib.error import HTTPError
import hashlib, json, sys, datetime
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from transfer import MCP, REMOTE, ARTIFACTS

LOCAL = Path(__file__).resolve().parent.parent
SKIP_SUFFIX = ('.blend1',)
c = MCP()
listing = json.loads(c.text(r'''
import hashlib, json
from pathlib import Path
root = Path(%r); out = {}
for p in sorted(root.rglob('*')):
    if p.is_file(): out[str(p.relative_to(root))] = {'sha256': hashlib.sha256(p.read_bytes()).hexdigest(), 'bytes': p.stat().st_size}
print('LISTING' + json.dumps(out))
''' % REMOTE).split('LISTING', 1)[1].strip())
files = {}; skipped = []
for rel, meta in listing.items():
    if rel.endswith(SKIP_SUFFIX): skipped.append(rel); continue
    dst = LOCAL / rel; dst.parent.mkdir(parents=True, exist_ok=True)
    try:
        data = urlopen(ARTIFACTS + rel, timeout=300).read(); how = 'downloaded'
    except HTTPError as e:
        # The artifact route does not serve .py or .md files; these were uploaded from the local copy with a sha256
        # check, so the local bytes are the source of truth and must hash to the remote listing.
        if e.code != 404 or not dst.exists(): raise
        data = dst.read_bytes(); how = 'uploaded from local (artifact route does not serve .py/.md)'
    digest = hashlib.sha256(data).hexdigest(); assert digest == meta['sha256'], (rel, digest, meta['sha256'])
    if dst.exists() and dst.read_bytes() != data:
        raise SystemExit(f'local {rel} differs from the remote copy; refusing to overwrite')
    dst.write_bytes(data)
    files[rel] = {'sha256': digest, 'bytes': len(data), 'remote_match': True, 'transfer': how}
local_only = {}
for p in sorted(LOCAL.rglob('*')):
    rel = str(p.relative_to(LOCAL))
    if p.is_file() and rel not in files and rel != 'sha256-manifest.json' and '__pycache__' not in rel:
        local_only[rel] = {'sha256': hashlib.sha256(p.read_bytes()).hexdigest(), 'bytes': p.stat().st_size, 'remote_match': False}
release = json.loads((LOCAL / 'scene-release.json').read_text())
manifest = {
    'work_order': 'WO111', 'asset_id': 'rescue-harbor-kit', 'version': 'v001', 'status': 'sheet-ready',
    'source': 'Blender reference sheet, no generated concept', 'blender_instance': 'blender-authoring-2 (instance 2)',
    'remote_dir': REMOTE, 'durable_dir': str(LOCAL), 'glb_sha256': 'none', 'scene_released_utc': release['released_utc'],
    'generated_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'notes': [
        'remote *.blend1 files are Blender automatic backups of earlier blockout saves and are not copied: ' + (', '.join(skipped) or 'none'),
        'claim-checkpoint.blend is a copy of the released predecessor (playroom-kit v001) live scene taken at claim time, kept for recovery.',
        'rescue-harbor-kit-reference-sheet-checkpoint.blend is the sheet scene saved right after the final render and crops, before the release stamp.',
        'preview/sheet-preview.png is the last half-size iteration preview (16 samples) of the same final blockout; reference-sheet.png is the final 2048x1024 render (48 samples).',
        'preview/crop-*.png are 1024x1024 close-ups (32 samples) of the final sheet scene: front and three-quarter per prop, plus the small boat from above.',
        'local_only files are the local MCP runner and helpers (source/run.py, source/transfer.py, source/upload_notes.py, source/collect.py, source/fetchprev.py), never executed inside Blender.',
        'The artifact route serves neither .py nor .md, so source/*.py and reference-notes.md were uploaded from these local bytes with a sha256 check; the manifest confirms each against the remote listing.',
    ],
    'files': files, 'local_only': local_only,
}
(LOCAL / 'sha256-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'copied': len(files), 'local_only': sorted(local_only), 'skipped': skipped,
                  'reference_sheet': files['reference-sheet.png']['sha256'], 'blockout': files['rescue-harbor-kit-blockout.blend']['sha256']}, indent=1))
