"""WO111 rival-mayor v001: saved exclusive scene release after the reference-sheet task (no GLB exists)."""
import bpy, json, hashlib, datetime
from pathlib import Path

ROOT = Path('/workspace/haynes-quest/family-eras/rival-mayor/v001')
OWNER = 'claude-opus-5-5 rival-mayor reference-sheet subagent (session_016rSS1uA4XaroamTk1brNXn)'
sc = bpy.context.scene
assert sc.get('work_order') == 'WO111' and sc.get('asset_id') == 'rival-mayor' and sc.get('scene_lease') == 'active' and sc.get('scene_owner') == OWNER
jobs = {j: bpy.app.is_job_running(j) for j in ['RENDER', 'RENDER_PREVIEW', 'OBJECT_BAKE', 'COMPOSITE']}
assert not any(jobs.values()), jobs
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
lease = json.loads((ROOT / 'scene-lease.json').read_text())
changed = {k: e['path'] for k, e in lease['prior_files'].items() if sha(e['path']) != e['sha256']}
assert not changed, changed
for need in ['reference-sheet.png', 'reference-notes.md', 'rival-mayor-blockout.blend']:
    assert (ROOT / need).exists(), need
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
sc['scene_owner'] = 'none'; sc['scene_lease'] = 'released'
sc['candidate_status'] = 'WO111 rival-mayor v001 · Blender reference sheet, no generated concept · sheet-ready for coordinator review; no GLB'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'rival-mayor-reference-sheet.blend'), copy=True, compress=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'live-scene-release.blend'), compress=True)
lease.update(scene_owner='none', scene_lease='released', status='released', released_utc=now, author_jobs_running=False)
(ROOT / 'scene-lease.json').write_text(json.dumps(lease, indent=2) + '\n')
record = {
    'work_order': 'WO111', 'asset_id': 'rival-mayor', 'version': 'v001', 'released_utc': now,
    'scene_owner': 'none', 'scene_lease': 'released',
    'saved_live_scene': str(ROOT / 'live-scene-release.blend'), 'saved_live_scene_sha256': sha(ROOT / 'live-scene-release.blend'),
    'reference_sheet': str(ROOT / 'reference-sheet.png'), 'reference_sheet_sha256': sha(ROOT / 'reference-sheet.png'),
    'reference_notes_sha256': sha(ROOT / 'reference-notes.md'),
    'blockout_master': str(ROOT / 'rival-mayor-blockout.blend'), 'blockout_master_sha256': sha(ROOT / 'rival-mayor-blockout.blend'),
    'sheet_scene': str(ROOT / 'rival-mayor-reference-sheet.blend'), 'sheet_scene_sha256': sha(ROOT / 'rival-mayor-reference-sheet.blend'),
    'glb_sha256': 'none', 'author_jobs_running': False, 'job_checks': jobs,
    'prior_files_unchanged': lease['prior_files'],
    'scope': 'Reference sheet only: Blender reference sheet, no generated concept. Coordinator review pending before detailing; no GLB, rig or animation; Tom review open.',
}
(ROOT / 'scene-release.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps({k: record[k] for k in ['released_utc', 'saved_live_scene_sha256', 'reference_sheet_sha256', 'blockout_master_sha256', 'sheet_scene_sha256']}))
