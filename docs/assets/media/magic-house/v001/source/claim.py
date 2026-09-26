"""WO111 magic-house v001: claim the exclusive scene lease on blender-authoring-2.

Runs inside Blender through transfer.py. Asserts the previous author released the scene, records the
predecessor and the hashes of every file already in this instance's workspace (checked unchanged at
release), then claims the lease and saves a claim checkpoint. Nothing of the predecessor is modified.
"""
import bpy, json, hashlib, datetime, os
from pathlib import Path

ROOT = Path('/workspace/haynes-quest/family-eras/magic-house/v001')
OWNER = 'claude-opus-5-5 magic-house model subagent (session_016rSS1uA4XaroamTk1brNXn) on blender-authoring-2'
sc = bpy.context.scene
jobs = {j: bpy.app.is_job_running(j) for j in ['RENDER', 'RENDER_PREVIEW', 'OBJECT_BAKE', 'COMPOSITE']}
assert not any(jobs.values()), jobs
assert sc.get('scene_lease') in (None, 'released') and sc.get('scene_owner') in (None, 'none'), (sc.get('scene_lease'), sc.get('scene_owner'))
assert not bpy.data.is_dirty, 'predecessor scene has unsaved edits'
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
props_before = {k: (v if isinstance(v, (str, int, float)) else str(v)) for k, v in sc.items() if not k.startswith('blendermcp_') and k != 'cycles'}
prior = {}
for d, _, fs in os.walk('/workspace'):
    for f in fs:
        p = Path(d) / f
        if ROOT in p.parents or '__pycache__' in p.parts: continue
        if p.suffix in ('.blend', '.glb', '.json', '.png') and ('/final-preview/' not in str(p)):
            prior[str(p.relative_to('/workspace/haynes-quest/family-eras'))] = {'path': str(p), 'sha256': sha(p)}
ROOT.mkdir(parents=True, exist_ok=True)
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
lease = {
    'work_order': 'WO111', 'asset_id': 'magic-house', 'version': 'v001',
    'task': 'full model from the approved Blender reference sheet (refine, UV, rig, five clips, export, evidence)',
    'blender_instance': 'blender-authoring-2 (isolated second instance; own scene and /workspace)',
    'scene_owner': OWNER, 'scene_lease': 'active', 'status': 'active', 'claimed_utc': now,
    'predecessor': {'scene_file': bpy.data.filepath, 'scene_file_sha256': sha(bpy.data.filepath) if bpy.data.filepath else None,
                    'dirty': bpy.data.is_dirty, 'props_before': props_before,
                    'release_record': '/workspace/haynes-quest/family-eras/rival-mayor/v001/scene-release.json'},
    'jobs_at_claim': jobs, 'prior_files': prior,
}
(ROOT / 'scene-lease.json').write_text(json.dumps(lease, indent=2) + '\n')
for key in list(sc.keys()):
    if not (key.startswith('blendermcp_') or key == 'cycles'): del sc[key]
sc['work_order'] = 'WO111'; sc['asset_id'] = 'magic-house'; sc['asset_version'] = 'v001'
sc['scene_owner'] = OWNER; sc['scene_lease'] = 'active'
sc['authoring_model'] = 'claude-opus-5-5 xhigh'
sc['source_reference'] = 'Blender reference sheet, no generated concept'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'claim-checkpoint.blend'), compress=True)
print(json.dumps({'claimed_utc': now, 'predecessor': lease['predecessor']['scene_file'], 'prior_files': len(prior)}))
