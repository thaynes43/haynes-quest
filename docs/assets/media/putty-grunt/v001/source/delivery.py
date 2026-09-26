"""WO111 putty-grunt: supported MCP/HTTP transfer between Blender instance 2 and the durable artifact directory.

  fetch     keep the reference-sheet stage's top-level lease, release, manifest, live-scene save and the two sheet
            scripts whose names the model stage reuses (source/transfer.py, source/claim.py) under sheet-stage/,
            then copy the exact masters and remote reports down (after the final animate/validate/attachment runs)
  collect W copy the locally produced reports (three-inspection.json, sheet-vs-export.png, final-preview/) from the
            scratch work directory W
  stage     copy sources locally, push sources, stills and locally produced reports up, assert every report names
            the same GLB and passes (before the scene release)
  finish    after release_model.py: fetch the release files and write the SHA-256 manifest with a remote/local byte
            match for every mirrored file
The reference-sheet stage files (sheet, blockout, notes, previews and the other sheet scripts) stay where the sheet
notes name them. Adapted from the inator-monster v001 delivery script."""
from pathlib import Path
from urllib.request import urlopen
import hashlib, json, shutil, sys, datetime
sys.dont_write_bytecode = True
from transfer import MCP, REMOTE, ARTIFACTS, upload
LOCAL = Path('/home/dev/artifacts/haynes-quest/family-eras/putty-grunt/v001')
SOURCE = Path(__file__).resolve().parent
sha = lambda data: hashlib.sha256(data).hexdigest()
MASTERS = ['putty-grunt.glb', 'putty-grunt.blend', 'pigment.png', 'construction.json', 'validation.json', 'attachment-inspection.json',
           'putty-grunt-construction.blend', 'putty-grunt-checkpoint.glb', 'putty-grunt-geometry-checkpoint.blend', 'putty-grunt-static-review.glb',
           'source/rig-rest.json', 'source/fidelity-samples.json', 'source/layout.json', 'source/bake-ao.npy']
STILLS = ['front.png', 'side.png', 'back.png', 'threequarter.png', 'beauty.png', 'motion-contact-sheet.png', 'attack-strip.png', 'attack-gameplay-scale.png', 'browser-inspection.json']
REPORTS = ['three-inspection.json', 'visual-review.json', 'provenance.json', 'tool-settings.json', 'bounds.json', 'sheet-vs-export.png']
INPUTS = ['reference-sheet.png', 'reference-notes.md', 'putty-grunt-blockout.blend', 'putty-grunt-reference-sheet.blend', 'blockout-measurements.json', 'part-measurements.json', 'sheet-render.json']
SHEET_RECORDS = ['scene-lease.json', 'scene-release.json', 'sha256-manifest.json', 'live-scene-release.blend']
SHEET_SOURCE_REUSED = ['transfer.py', 'claim.py']
SHEET_LOCAL = ['claim-checkpoint.blend', 'putty-grunt-reference-sheet-checkpoint.blend']
SHEET_ONLY_SCRIPTS = ['collect.py', 'crops.py', 'final_render.py', 'iterate_preview.py', 'measure_parts.py', 'release.py', 'run.py', 'upload_notes.py']
REPORT_CHECKS = ['validation.json', 'three-inspection.json', 'browser-inspection.json', 'attachment-inspection.json']

MCP_ONLY = ('.npy',)          # the /artifacts/ route does not serve these types; they move through MCP with a SHA-256 check

def fetch(relative, client=None):
    p = LOCAL / relative; p.parent.mkdir(parents=True, exist_ok=True)
    if Path(relative).suffix in MCP_ONLY:
        import base64
        client = client or MCP(); target = REMOTE + '/' + relative
        size = int(client.text('from pathlib import Path\nprint(Path(%r).stat().st_size)' % target).split()[-1]); data = b''; step = 600000
        for off in range(0, size, step):
            out = client.text('import base64\nfrom pathlib import Path\nb=Path(%r).read_bytes()[%d:%d]\nprint("B64:"+base64.b64encode(b).decode())' % (target, off, off + step))
            data += base64.b64decode(out[out.index('B64:') + 4:].strip())
        digest = client.text('import hashlib\nfrom pathlib import Path\nprint(hashlib.sha256(Path(%r).read_bytes()).hexdigest())' % target).split()[-1]
        assert len(data) == size and sha(data) == digest, (relative, len(data), size)
        p.write_bytes(data); return p
    p.write_bytes(urlopen(ARTIFACTS + relative, timeout=120).read()); return p

def preserve_sheet_records():
    dest = LOCAL / 'sheet-stage'
    if dest.exists(): return
    (dest / 'source').mkdir(parents=True)
    for name in SHEET_RECORDS:
        if (LOCAL / name).exists(): shutil.copy2(LOCAL / name, dest / name)
    for name in SHEET_SOURCE_REUSED:
        if (LOCAL / 'source' / name).exists(): shutil.copy2(LOCAL / 'source' / name, dest / 'source' / name)
    (dest / 'README.md').write_text('Records of the reference-sheet stage (blender-authoring instance 1, Sept 26), kept when the full-model stage on\n'
                                    'instance 2 wrote its own scene-lease.json, scene-release.json, live-scene-release.blend and sha256-manifest.json at the\n'
                                    'top level. source/transfer.py and source/claim.py are the sheet-stage scripts of those names (instance 1); the model\n'
                                    'stage reuses the names in ../source/. The sheet inputs, previews and the other sheet scripts stay where the sheet\n'
                                    'notes name them.\n')

def check_reports():
    expected = sha((LOCAL / 'putty-grunt.glb').read_bytes())
    for name in REPORT_CHECKS:
        r = json.loads((LOCAL / name).read_text()); assert r.get('sha256', r.get('glb_sha256')) == expected, (name, 'wrong GLB')
        assert all(r['checks'].values()), (name, {k: v for k, v in r['checks'].items() if not v})
    return expected

def model_sources():
    return [p for p in sorted(SOURCE.iterdir()) if p.suffix in ('.py', '.mjs', '.json', '.sh') and p.is_file()]

mode = sys.argv[1]
if mode == 'fetch':
    preserve_sheet_records()
    for name in MASTERS: fetch(name)
    print(json.dumps({'fetched': MASTERS, 'glb_sha256': sha((LOCAL / 'putty-grunt.glb').read_bytes())}))
elif mode == 'collect':
    W = Path(sys.argv[2])
    for name in ['three-inspection.json', 'sheet-vs-export.png']: shutil.copy2(W / name, LOCAL / name)
    if (LOCAL / 'final-preview').exists(): shutil.rmtree(LOCAL / 'final-preview')
    shutil.copytree(W / 'final-preview', LOCAL / 'final-preview')
    for name in STILLS: shutil.copy2(LOCAL / 'final-preview' / name, LOCAL / name)
    print(json.dumps({'collected_from': str(W), 'final_preview_files': len(list((LOCAL / 'final-preview').iterdir()))}))
elif mode == 'stage':
    client = MCP()
    client.execute("import bpy; sc=bpy.context.scene; assert sc.get('work_order')=='WO111' and sc.get('asset_id')=='putty-grunt' and sc.get('scene_lease')=='active' and sc.get('scene_owner')=='claude-opus-5-5/putty-grunt-model'")
    (LOCAL / 'source').mkdir(exist_ok=True)
    for p in model_sources():
        assert p.name not in SHEET_ONLY_SCRIPTS + ['sheet.py', 'build_blockout.py'], ('would overwrite a sheet-stage script', p.name)
        if p.name in SHEET_SOURCE_REUSED: assert (LOCAL / 'sheet-stage/source' / p.name).exists(), ('sheet-stage copy missing', p.name)
        shutil.copy2(p, LOCAL / 'source' / p.name); upload(client, p, 'source/' + p.name)
    for name in STILLS: upload(client, LOCAL / name, name)
    for p in sorted((LOCAL / 'final-preview').iterdir()):
        if p.suffix in ('.png', '.json'): upload(client, p, 'final-preview/' + p.name)
    for name in REPORTS: upload(client, LOCAL / name, name)
    expected = check_reports()
    print(json.dumps({'stage': 'ready-for-release', 'glb_sha256': expected, 'all_checks': True}))
elif mode == 'finish':
    client = MCP()
    for name in ['scene-lease.json', 'scene-release.json', 'live-scene-release.blend']: fetch(name)
    release = json.loads((LOCAL / 'scene-release.json').read_text()); assert release['scene_lease'] == 'released' and release['blender_instance'] == 'blender-authoring-2'
    expected = check_reports(); assert release['glb_sha256'] == expected
    mirrored = MASTERS + STILLS + REPORTS + INPUTS + ['scene-lease.json', 'scene-release.json', 'live-scene-release.blend']
    mirrored += ['source/' + p.name for p in model_sources()]
    mirrored += ['final-preview/' + p.name for p in sorted((LOCAL / 'final-preview').iterdir()) if p.suffix in ('.png', '.json')]
    mirrored += ['source/build_blockout.py', 'source/sheet.py']
    local_only = ['sheet-stage/' + str(p.relative_to(LOCAL / 'sheet-stage')) for p in sorted((LOCAL / 'sheet-stage').rglob('*')) if p.is_file()]
    local_only += ['preview/' + p.name for p in sorted((LOCAL / 'preview').iterdir())] + SHEET_LOCAL
    local_only += ['source/' + n for n in SHEET_ONLY_SCRIPTS if (LOCAL / 'source' / n).exists()]
    files = []; seen = set()
    for name in mirrored:
        if name in seen: continue
        seen.add(name); data = (LOCAL / name).read_bytes()
        remote = 'sheet-source/' + name.split('/', 1)[1] if name in ('source/build_blockout.py', 'source/sheet.py') else name
        if Path(name).suffix in ('.py', '.mjs', '.md', '.txt', '.sh') + MCP_ONLY:
            client.execute('import hashlib\nfrom pathlib import Path\nassert hashlib.sha256(Path(' + repr(REMOTE + '/' + remote) + ').read_bytes()).hexdigest()==' + repr(sha(data)))
        else: assert sha(data) == sha(urlopen(ARTIFACTS + remote, timeout=120).read()), name
        files.append({'path': name, 'bytes': len(data), 'sha256': sha(data), 'remote_local_match': True})
    for name in local_only:
        if name in seen: continue
        seen.add(name); data = (LOCAL / name).read_bytes()
        files.append({'path': name, 'bytes': len(data), 'sha256': sha(data), 'remote_local_match': 'not mirrored: reference-sheet stage record from instance 1, kept unchanged'})
    record = {'work_order': 'WO111', 'asset_id': 'putty-grunt', 'version': 'v001', 'status': 'model-delivered', 'source': 'Blender reference sheet, no generated concept',
              'created_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'local_root': str(LOCAL), 'remote_root': REMOTE, 'blender_instance': 'blender-authoring-2',
              'scene_lease': 'released', 'candidate_status': "Awaiting Tom's review · used in the family release", 'glb_sha256': expected, 'files': files,
              'all_mirrored_remote_local_hashes_match': True, 'verification_method': 'MCP SHA-256 for source/text extensions and the .npy bake array (which the artifacts route does not serve); HTTP byte round trip for media, JSON and masters.',
              'excluded': ['sheet-stage/ holds the reference-sheet stage lease, release, manifest and the two reused-name sheet scripts (instance 1); they, the sheet previews, the sheet claim/checkpoint saves and the sheet-only helper scripts are listed but not mirrored on instance 2.',
                           'putty-grunt-geometry-checkpoint.blend1 (a Blender autosave backup on instance 2) is not copied.'],
              'manifest_self_hash': 'Excluded to avoid recursive hashing.'}
    (LOCAL / 'sha256-manifest.json').write_text(json.dumps(record, indent=2) + '\n'); upload(client, LOCAL / 'sha256-manifest.json', 'sha256-manifest.json')
    print(json.dumps({'stage': 'complete', 'files': len(files), 'manifest_sha256': sha((LOCAL / 'sha256-manifest.json').read_bytes()), 'scene_lease': 'released', 'glb_sha256': expected,
                      'master_sha256': sha((LOCAL / 'putty-grunt.blend').read_bytes())}))
else: raise SystemExit('Use fetch, collect <W>, stage or finish')
