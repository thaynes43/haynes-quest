"""WO111 lab-robot v001: claim the exclusive scene lease on Blender instance 1 (blender-authoring).

Runs inside Blender (via run.py). Refuses if a lease is active, an author job is running or the predecessor scene
has unsaved edits. Keeps a recovery copy of the released predecessor scene, fingerprints every earlier family-era
.blend/.glb so the release can prove none changed, then stamps the scene with this author's lease.
Adapted from the putty-grunt v001 claim.py precedent (itself from demon-band-idol / inator-monster).
"""
import bpy, json, hashlib, datetime
from pathlib import Path
from urllib.request import urlopen

ROOT = Path('/workspace/haynes-quest/family-eras/lab-robot/v001')
ERAS = ROOT.parent.parent
OWNER = 'claude-opus-5-5 lab-robot reference-sheet subagent (session_016rSS1uA4XaroamTk1brNXn)'
sc = bpy.context.scene
props = {k: str(sc[k]) for k in ('work_order', 'scene_owner', 'scene_lease', 'asset_id', 'asset_version', 'authoring_model', 'candidate_status') if k in sc.keys()}
jobs = {j: bpy.app.is_job_running(j) for j in ['RENDER', 'RENDER_PREVIEW', 'OBJECT_BAKE', 'COMPOSITE']}
assert not any(jobs.values()), jobs
assert props.get('scene_lease') in (None, 'released') and props.get('scene_owner') in (None, 'none'), ('scene held', props)
assert not bpy.data.is_dirty, 'predecessor scene has unsaved edits'
ROOT.mkdir(parents=True, exist_ok=True); (ROOT / 'source').mkdir(exist_ok=True); (ROOT / 'preview').mkdir(exist_ok=True)
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
pred = bpy.data.filepath
prior = {}
for p in sorted(ERAS.glob('*/v*/*')):
    if p.suffix in ('.blend', '.glb') and 'lab-robot' not in p.parts:
        prior[str(p.relative_to(ERAS))] = {'path': str(p), 'sha256': sha(p)}
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'claim-checkpoint.blend'), copy=True, compress=True)
# Drop the predecessor's asset-specific stamps so nothing stale rides along with this lease.
for k in ('candidate_status', 'source_concept_sha256', 'blockout_bounds_m', 'blockout_tops_m', 'orientation'):
    if k in sc.keys(): del sc[k]
sc['work_order'] = 'WO111'; sc['scene_owner'] = OWNER; sc['scene_lease'] = 'active'
sc['asset_id'] = 'lab-robot'; sc['asset_version'] = 'v001'; sc['authoring_model'] = 'claude-opus-5-5'
sc['candidate_status'] = 'WO111 lab-robot v001 · reference sheet in progress (Blender reference sheet, no generated concept)'
lease = {
    'work_order': 'WO111', 'asset_id': 'lab-robot', 'version': 'v001',
    'task': 'reference sheet only (no final topology, no rig, no GLB)',
    'blender_instance': 'blender-authoring (instance 1, primary)',
    'scene_owner': OWNER, 'scene_lease': 'active', 'status': 'active', 'claimed_utc': now,
    'predecessor': {'scene_file': pred, 'scene_file_sha256': sha(pred) if pred else None, 'dirty': False, 'props_before': props},
    'claim_checkpoint': str(ROOT / 'claim-checkpoint.blend'), 'claim_checkpoint_sha256': sha(ROOT / 'claim-checkpoint.blend'),
    'jobs_at_claim': jobs, 'prior_files': prior,
}
(ROOT / 'scene-lease.json').write_text(json.dumps(lease, indent=2) + '\n')
print(json.dumps({k: lease[k] for k in ('claimed_utc', 'scene_owner', 'scene_lease', 'predecessor', 'claim_checkpoint_sha256')} | {'prior_files': len(prior)}, indent=1))
