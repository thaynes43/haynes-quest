"""WO111 playroom-kit v001: saved exclusive scene release on instance 2 after the kit reference-sheet task (no GLB).

Adapted from the lab-robot v001 release.py (itself from putty-grunt / demon-band-idol / inator-monster). Verifies no
earlier family-era .blend/.glb changed, no author job is running and every deliverable exists, then saves the sheet
scene and live-scene-release.blend with scene_lease='released' and writes scene-release.json. On a failure path it
can be run with RELEASE_FAILURE='<message>' so the lease is still released and the error recorded.
"""
import bpy, json, hashlib, datetime
from pathlib import Path

ROOT = Path('/workspace/haynes-quest/family-eras/playroom-kit/v001')
OWNER = 'claude-opus-5-5 playroom-kit reference-sheet subagent (session_016rSS1uA4XaroamTk1brNXn)'
FAILURE = globals().get('RELEASE_FAILURE')
sc = bpy.context.scene
assert sc.get('work_order') == 'WO111' and sc.get('asset_id') == 'playroom-kit' and sc.get('scene_lease') == 'active' and sc.get('scene_owner') == OWNER
jobs = {j: bpy.app.is_job_running(j) for j in ['RENDER', 'RENDER_PREVIEW', 'OBJECT_BAKE', 'COMPOSITE']}
assert not any(jobs.values()), jobs
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
lease = json.loads((ROOT / 'scene-lease.json').read_text())
changed = {k: e['path'] for k, e in lease['prior_files'].items() if sha(e['path']) != e['sha256']}
assert not changed, changed
PROPS = ['stacking-block-tower', 'toy-bus-garage', 'crib-rail-fence', 'giant-plush-ball']
NEED = ['reference-sheet.png', 'reference-notes.md', 'playroom-kit-blockout.blend', 'blockout-measurements.json', 'part-measurements.json',
        'sheet-render.json', 'claim-checkpoint.blend', 'playroom-kit-reference-sheet-checkpoint.blend', 'preview/sheet-preview.png']
NEED += [f'preview/crop-{p}-{v}.png' for p in PROPS for v in ('front', 'three-quarter')]
if not FAILURE:
    for need in NEED:
        assert (ROOT / need).exists(), need
    assert json.loads((ROOT / 'sheet-render.json').read_text())['sha256'] == sha(ROOT / 'reference-sheet.png')
    assert sc.render.resolution_percentage == 100 and sc.camera is not None
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
sc['scene_owner'] = 'none'; sc['scene_lease'] = 'released'
sc['candidate_status'] = ('WO111 playroom-kit v001 · Blender reference sheet, no generated concept · sheet-ready for coordinator review; no GLB'
                          if not FAILURE else 'WO111 playroom-kit v001 · reference sheet stopped: ' + FAILURE)
if not FAILURE:
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'playroom-kit-reference-sheet.blend'), copy=True, compress=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'live-scene-release.blend'), compress=True)
lease.update(scene_owner='none', scene_lease='released', status='released', released_utc=now, author_jobs_running=False)
(ROOT / 'scene-lease.json').write_text(json.dumps(lease, indent=2) + '\n')
opt = lambda rel: sha(ROOT / rel) if (ROOT / rel).exists() else None
record = {
    'work_order': 'WO111', 'asset_id': 'playroom-kit', 'version': 'v001', 'blender_instance': 'blender-authoring-2 (instance 2)',
    'released_utc': now, 'scene_owner': 'none', 'scene_lease': 'released',
    'saved_live_scene': str(ROOT / 'live-scene-release.blend'), 'saved_live_scene_sha256': sha(ROOT / 'live-scene-release.blend'),
    'reference_sheet': str(ROOT / 'reference-sheet.png'), 'reference_sheet_sha256': opt('reference-sheet.png'),
    'reference_notes_sha256': opt('reference-notes.md'),
    'blockout_master': str(ROOT / 'playroom-kit-blockout.blend'), 'blockout_master_sha256': opt('playroom-kit-blockout.blend'),
    'sheet_scene': str(ROOT / 'playroom-kit-reference-sheet.blend'), 'sheet_scene_sha256': opt('playroom-kit-reference-sheet.blend'),
    'glb_sha256': 'none', 'author_jobs_running': False, 'job_checks': jobs, 'failure': FAILURE,
    'prior_files_unchanged': lease['prior_files'],
    'scope': ('Kit reference sheet only: Blender reference sheet, no generated concept, for the four playroom theme-kit props. '
              'Coordinator review pending before modeling; no GLB; Tom review open.'),
}
(ROOT / 'scene-release.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps({k: record[k] for k in ['released_utc', 'saved_live_scene_sha256', 'reference_sheet_sha256', 'blockout_master_sha256', 'sheet_scene_sha256', 'reference_notes_sha256', 'failure']}))
