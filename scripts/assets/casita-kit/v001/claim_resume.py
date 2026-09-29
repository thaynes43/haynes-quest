"""Claim the released instance-2 scene while retaining the unfinished sheet history."""
import bpy, datetime, hashlib, json, shutil
from pathlib import Path

ROOT = Path('/workspace/haynes-quest/family-eras/casita-kit/v001')
OWNER = 'gpt-6-astra/casita-kit-props'
sc = bpy.context.scene
jobs = {j: bpy.app.is_job_running(j) for j in ['RENDER', 'RENDER_PREVIEW', 'OBJECT_BAKE', 'COMPOSITE']}
assert not any(jobs.values()), jobs
assert sc.get('scene_owner') == 'none' and sc.get('scene_lease') == 'released'
assert not bpy.data.is_dirty, 'released predecessor must have no unsaved edits'
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
prior = {str(p): sha(p) for p in ROOT.parent.parent.rglob('*') if p.suffix in ('.blend', '.glb')}
history = ROOT / 'partial-0926-preserved'
assert not history.exists(), 'do not overwrite the historical checkpoint'
history.mkdir()
for p in list(ROOT.iterdir()):
    if p == history or p.name == 'source': continue
    if p.is_dir(): shutil.copytree(p, history / p.name)
    else: shutil.copy2(p, history / p.name)
# The local source history was copied before this script upload; copy only the
# original names here so newly uploaded resume scripts do not become history.
(history / 'source').mkdir()
for name in ['crops.py', 'sheet.py', 'measure_parts.py', 'claim.py', 'final_render.py', 'build_blockout.py', 'iterate_preview.py']:
    shutil.copy2(ROOT / 'source' / name, history / 'source' / name)
old = json.loads((history / 'scene-lease.json').read_text())
record = {
    'work_order': 'WO111', 'asset_id': 'casita-kit', 'version': 'v001',
    'authoring_model': 'gpt-6-astra max', 'scene_owner': OWNER, 'scene_lease': 'active',
    'blender_instance': 'blender-authoring-2',
    'claimed_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'task': 'Complete reference sheet; await coordinator ratification; author four exact props',
    'predecessor': {'path': bpy.data.filepath, 'sha256': sha(bpy.data.filepath), 'dirty': False,
                    'live_owner': sc.get('scene_owner'), 'live_lease': sc.get('scene_lease')},
    'historical_lease': {'owner': old.get('scene_owner'), 'lease': old.get('scene_lease'),
                         'path': str(history / 'scene-lease.json'), 'sha256': sha(history / 'scene-lease.json')},
    'takeover_reason': 'The unfinished September 26 sheet has a stale active lease JSON. The live instance-2 scene is explicitly released, clean, and idle; its coordinator checkpoint and all prior files are preserved before claiming.',
    'jobs_at_claim': jobs, 'prior_files': prior,
    'partial_sheet_sha256': sha(history / 'reference-sheet.png'),
    'partial_blockout_sha256': sha(history / 'casita-kit-blockout.blend'),
}
(ROOT / 'scene-lease.json').write_text(json.dumps(record, indent=2) + '\n')
sc['scene_owner'] = OWNER; sc['scene_lease'] = 'active'; sc['authoring_model'] = 'gpt-6-astra max'
sc['candidate_status'] = "WO111 casita-kit v001 · reference-sheet completion · Awaiting Tom's review"
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'resume-claim-checkpoint.blend'), copy=True, compress=True)
print(json.dumps({k:record[k] for k in ['claimed_utc','scene_owner','scene_lease','partial_sheet_sha256','partial_blockout_sha256','historical_lease']}))
