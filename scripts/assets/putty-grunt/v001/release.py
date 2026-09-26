"""WO111 putty-grunt v001: saved exclusive scene release after the reference-sheet task (no GLB exists).

Adapted from the demon-band-idol v001 release.py (itself from inator-monster). Verifies no earlier family-era .blend/.glb changed, no author job
is running and every deliverable exists, then saves the sheet scene and live-scene-release.blend with
scene_lease='released' and writes scene-release.json.
"""
import bpy, json, hashlib, datetime
from pathlib import Path

ROOT = Path('/workspace/haynes-quest/family-eras/putty-grunt/v001')
OWNER = 'claude-opus-5-5 putty-grunt reference-sheet subagent (session_016rSS1uA4XaroamTk1brNXn)'
sc = bpy.context.scene
assert sc.get('work_order') == 'WO111' and sc.get('asset_id') == 'putty-grunt' and sc.get('scene_lease') == 'active' and sc.get('scene_owner') == OWNER
jobs = {j: bpy.app.is_job_running(j) for j in ['RENDER', 'RENDER_PREVIEW', 'OBJECT_BAKE', 'COMPOSITE']}
assert not any(jobs.values()), jobs
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
lease = json.loads((ROOT / 'scene-lease.json').read_text())
changed = {k: e['path'] for k, e in lease['prior_files'].items() if sha(e['path']) != e['sha256']}
assert not changed, changed
for need in ['reference-sheet.png', 'reference-notes.md', 'putty-grunt-blockout.blend', 'blockout-measurements.json', 'part-measurements.json',
             'sheet-render.json', 'claim-checkpoint.blend', 'putty-grunt-reference-sheet-checkpoint.blend', 'preview/sheet-preview.png',
             'preview/crop-front.png', 'preview/crop-face-front.png', 'preview/crop-face-three-quarter.png',
             'preview/crop-three-quarter.png', 'preview/crop-side.png', 'preview/crop-back.png']:
    assert (ROOT / need).exists(), need
assert json.loads((ROOT / 'sheet-render.json').read_text())['sha256'] == sha(ROOT / 'reference-sheet.png')
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
assert sc.render.resolution_percentage == 100 and sc.camera is not None
sc['scene_owner'] = 'none'; sc['scene_lease'] = 'released'
sc['candidate_status'] = 'WO111 putty-grunt v001 · Blender reference sheet, no generated concept · sheet-ready for coordinator review; no GLB'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'putty-grunt-reference-sheet.blend'), copy=True, compress=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'live-scene-release.blend'), compress=True)
lease.update(scene_owner='none', scene_lease='released', status='released', released_utc=now, author_jobs_running=False)
(ROOT / 'scene-lease.json').write_text(json.dumps(lease, indent=2) + '\n')
record = {
    'work_order': 'WO111', 'asset_id': 'putty-grunt', 'version': 'v001', 'blender_instance': 'blender-authoring (instance 1, primary)',
    'released_utc': now, 'scene_owner': 'none', 'scene_lease': 'released',
    'saved_live_scene': str(ROOT / 'live-scene-release.blend'), 'saved_live_scene_sha256': sha(ROOT / 'live-scene-release.blend'),
    'reference_sheet': str(ROOT / 'reference-sheet.png'), 'reference_sheet_sha256': sha(ROOT / 'reference-sheet.png'),
    'reference_notes_sha256': sha(ROOT / 'reference-notes.md'),
    'blockout_master': str(ROOT / 'putty-grunt-blockout.blend'), 'blockout_master_sha256': sha(ROOT / 'putty-grunt-blockout.blend'),
    'sheet_scene': str(ROOT / 'putty-grunt-reference-sheet.blend'), 'sheet_scene_sha256': sha(ROOT / 'putty-grunt-reference-sheet.blend'),
    'glb_sha256': 'none', 'author_jobs_running': False, 'job_checks': jobs, 'failure': None,
    'prior_files_unchanged': lease['prior_files'],
    'scope': 'Reference sheet only: Blender reference sheet, no generated concept. Coordinator review pending before detailing; no GLB, rig or animation; Tom review open.',
}
(ROOT / 'scene-release.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps({k: record[k] for k in ['released_utc', 'saved_live_scene_sha256', 'reference_sheet_sha256', 'blockout_master_sha256', 'sheet_scene_sha256', 'reference_notes_sha256']}))
