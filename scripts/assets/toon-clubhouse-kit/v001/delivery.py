"""WO111 toon-clubhouse-kit v001: supported MCP/HTTP transfer between Blender instance 1 and the durable artifact dir.
  stage   push local sources, reports, stills and records up (sha256-verified), assert every report names the same GLBs
  release run release_scene.py through the MCP route (the scene lease ends here)
  finish  fetch the release files read-only over HTTP, then write sha256-manifest.json with a remote/local byte
          match for every mirrored file (no remote writes after the release)"""
from pathlib import Path
from urllib.request import urlopen
import hashlib, json, sys, datetime
sys.dont_write_bytecode = True
from transfer import MCP, REMOTE, ARTIFACTS, upload, GUARD, LOCAL as SOURCE
KIT = SOURCE.parent
IDS = ['clubhouse-tower-facade', 'curly-slide', 'gadget-toolbox-stand', 'rounded-hedge', 'stage-marker']
sha = lambda b: hashlib.sha256(b).hexdigest()
REPORTS = ['three-inspection.json', 'bounds.json', 'provenance.json', 'tool-settings.json', 'visual-review.json', 'delivery.json', 'kit-beauty.png', 'concept-vs-export.png']
REMOTE_MADE = [f'{i}.glb' for i in IDS] + ['construction.json', 'validation.json', 'toon-clubhouse-kit.blend', 'toon-clubhouse-kit-sheets.blend', 'claim-checkpoint.blend',
               'sheets/sheet-render.json'] + [f'sheets/{i}-reference-sheet.png' for i in IDS] + ['sheets/kit-contact-sheet.png']
def stills(): return ['stills/' + p.name for p in sorted((KIT / 'stills').iterdir()) if p.suffix in ('.png', '.json')]
def sources(): return ['source/' + p.name for p in sorted(SOURCE.iterdir()) if p.suffix in ('.py', '.mjs') and p.is_file()]
def previews(): return ['preview/' + p.name for p in sorted((KIT / 'preview').iterdir()) if p.suffix == '.png']
def fetch(rel): p = KIT / rel; p.parent.mkdir(parents=True, exist_ok=True); p.write_bytes(urlopen(ARTIFACTS + rel, timeout=300).read()); return p
mode = sys.argv[1]
if mode == 'stage':
    c = MCP(); c.execute(GUARD)
    for rel in sources() + REPORTS + stills(): print(json.dumps(upload(c, KIT / rel, rel)))
    for rel in REMOTE_MADE: assert sha((KIT / rel).read_bytes()) == sha(urlopen(ARTIFACTS + rel, timeout=300).read()), ('local copy differs from remote', rel)
    print(json.dumps({'stage': 'ready-for-release', 'uploaded': len(sources() + REPORTS + stills()), 'remote_made_verified': len(REMOTE_MADE)}))
elif mode == 'release':
    c = MCP(); c.execute(GUARD)
    print(json.dumps(upload(c, SOURCE / 'release_scene.py', 'source/release_scene.py')))
    fail = sys.argv[2] if len(sys.argv) > 2 else None
    print(c.text('import runpy\nrunpy.run_path(%r, run_name="__main__", init_globals=%r)' % (REMOTE + '/source/release_scene.py', {'FAILURE': fail} if fail else {})))
elif mode == 'finish':
    for rel in ['scene-lease.json', 'scene-release.json', 'live-scene-release.blend']: fetch(rel)
    rel_rec = json.loads((KIT / 'scene-release.json').read_text()); assert rel_rec['scene_lease'] == 'released'
    d = json.loads((KIT / 'delivery.json').read_text()); d['sceneLease']['released_utc'] = rel_rec['released_utc']
    (KIT / 'delivery.json').write_text(json.dumps(d, indent=2) + '\n')
    mirrored = REMOTE_MADE + [r for r in REPORTS if r != 'delivery.json'] + stills() + previews() + ['scene-lease.json', 'scene-release.json', 'live-scene-release.blend']
    # The artifact route does not serve .py/.mjs; their remote hashes come from one read-only MCP hash pass taken after
    # the release while the scene was still unclaimed (source-remote-hashes.json).
    remote_src = json.loads((KIT / 'source-remote-hashes.json').read_text())
    assert remote_src['state']['scene_lease'] == 'released'
    inputs = {'concept-draft.png': 'inputs/concept-draft.png', 'prompt.txt': 'inputs/prompt.txt', 'revision-prompt.txt': 'inputs/revision-prompt.txt'}
    files = []
    for rel in mirrored:
        data = (KIT / rel).read_bytes(); remote = urlopen(ARTIFACTS + rel, timeout=300).read()
        assert sha(data) == sha(remote), rel
        files.append({'path': rel, 'bytes': len(data), 'sha256': sha(data), 'remote_local_match': True})
    for rel in sources():
        data = (KIT / rel).read_bytes()
        if rel == 'source/delivery.py' and remote_src['hashes']['delivery.py'] != sha(data):
            files.append({'path': rel, 'bytes': len(data), 'sha256': sha(data), 'remote_local_match': 'updated locally after the release (finish step reads source hashes from source-remote-hashes.json); remote copy is the staged version',
                          'remote_sha256': remote_src['hashes']['delivery.py']}); continue
        assert remote_src['hashes'][rel.split('/', 1)[1]] == sha(data), rel
        files.append({'path': rel, 'bytes': len(data), 'sha256': sha(data), 'remote_local_match': True, 'method': 'read-only MCP sha256 (source-remote-hashes.json)'})
    data = (KIT / 'source-remote-hashes.json').read_bytes()
    files.append({'path': 'source-remote-hashes.json', 'bytes': len(data), 'sha256': sha(data), 'remote_local_match': 'local record of the read-only remote source hash pass'})
    for rel, remote_rel in inputs.items():
        data = (KIT / rel).read_bytes()
        if rel.endswith('.png'):
            assert sha(data) == sha(urlopen(ARTIFACTS + remote_rel, timeout=300).read()), rel; how = 'HTTP GET round trip'
        else:
            how = 'sha256 asserted remotely at upload by upload_inputs.py (the artifact route does not serve .txt)'
        files.append({'path': rel, 'bytes': len(data), 'sha256': sha(data), 'remote_local_match': True, 'remote_path': remote_rel, 'method': how, 'note': 'Codex Astra concept draft input (unchanged)'})
    data = (KIT / 'delivery.json').read_bytes()
    files.append({'path': 'delivery.json', 'bytes': len(data), 'sha256': sha(data), 'remote_local_match': 'updated locally after the release (released_utc filled in); the staged remote copy predates it'})
    for rel in ['sheets/' + p.name for p in sorted((KIT / 'sheets').iterdir())]:
        if rel not in mirrored: raise SystemExit('unlisted sheet file ' + rel)
    glbs = {i: sha((KIT / f'{i}.glb').read_bytes()) for i in IDS}
    assert glbs == rel_rec['glb_sha256'], 'release names other GLBs'
    record = {'work_order': 'WO111', 'asset_id': 'toon-clubhouse-kit', 'version': 'v001', 'status': 'delivered', 'created_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'local_root': str(KIT), 'remote_root': REMOTE, 'blender_instance': 'blender-authoring (instance 1)', 'scene_lease': 'released', 'released_utc': rel_rec['released_utc'],
              'candidate_status': "Awaiting Tom's review · used in the family release", 'glb_sha256': glbs, 'files': files, 'all_mirrored_remote_local_hashes_match': True,
              'verification_method': 'HTTP GET /artifacts round trip for every mirrored media/JSON/blend file; read-only MCP sha256 for source .py/.mjs (the route does not serve them). No remote writes after the release.',
              'excluded': ['toon-clubhouse-kit.blend1 (Blender auto-backup) and preview/sheets/ (half-size sheet previews) stay remote only.'],
              'manifest_self_hash': 'Excluded to avoid recursive hashing.'}
    (KIT / 'sha256-manifest.json').write_text(json.dumps(record, indent=2) + '\n')
    print(json.dumps({'stage': 'complete', 'files': len(files), 'manifest_sha256': sha((KIT / 'sha256-manifest.json').read_bytes()), 'released_utc': rel_rec['released_utc'], 'glb_sha256': glbs}))
else:
    raise SystemExit('Use stage, release or finish')
