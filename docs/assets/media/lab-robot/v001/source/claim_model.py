"""WO111 lab-robot v001: claim the exclusive scene lease on Blender instance 1 for the MODEL stage.

Runs inside Blender via author_run.py (after a local /readyz ready+not-busy check passed in READYZ).
Refuses if a lease is active, an author job is running or the predecessor scene has unsaved edits.
Verifies the approved sheet inputs on the remote against the durable sha256 manifest (EXPECT), copies
the reference-sheet stage lease records to sheet-stage/ (never overwriting), keeps a recovery copy of
the released predecessor live scene as model-claim-checkpoint.blend, fingerprints every earlier
family-era .blend/.glb so the release can prove none changed, then stamps this author's lease.
Adapted from the radio-host-showman v001 claim_model.py.
"""
import bpy, json, hashlib, datetime, shutil
from pathlib import Path

ROOT = Path('/workspace/haynes-quest/family-eras/lab-robot/v001')
ERAS = ROOT.parent.parent
OWNER = 'claude-opus-5-5 lab-robot model subagent (session_016rSS1uA4XaroamTk1brNXn)'
READYZ = globals().get('READYZ'); EXPECT = globals().get('EXPECT')
assert READYZ and READYZ.get('ready') and not READYZ.get('busy'), READYZ
assert EXPECT and len(EXPECT) >= 3, EXPECT
sc = bpy.context.scene
props = {k: str(sc[k]) for k in ('work_order', 'scene_owner', 'scene_lease', 'asset_id', 'asset_version', 'authoring_model', 'candidate_status') if k in sc.keys()}
jobs = {j: bpy.app.is_job_running(j) for j in ['RENDER', 'RENDER_PREVIEW', 'OBJECT_BAKE', 'COMPOSITE']}
assert not any(jobs.values()), jobs
assert props.get('scene_lease') in (None, 'released') and props.get('scene_owner') in (None, 'none'), ('scene held', props)
assert not bpy.data.is_dirty, 'predecessor scene has unsaved edits'
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
inputs = {name: sha(ROOT / name) for name in EXPECT}
bad = {k: v for k, v in inputs.items() if v != EXPECT[k]}
assert not bad, ('approved sheet inputs differ from the durable manifest', bad)
stage = ROOT / 'sheet-stage'; stage.mkdir(exist_ok=True); kept = {}
for name in ('scene-lease.json', 'scene-release.json', 'live-scene-release.blend', 'claim-checkpoint.blend', 'sheet-render.json'):
    dst = stage / name
    if not dst.exists(): shutil.copy2(ROOT / name, dst)
    assert sha(dst) == sha(ROOT / name), ('sheet-stage copy differs', name)
    kept[name] = sha(dst)
pred = bpy.data.filepath
prior = {}
for p in sorted(ERAS.glob('*/v*/*')):
    if p.suffix in ('.blend', '.glb') and 'lab-robot' not in p.parts:
        prior[str(p.relative_to(ERAS))] = {'path': str(p), 'sha256': sha(p)}
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'model-claim-checkpoint.blend'), copy=True, compress=True)
for k in list(sc.keys()):
    if not k.startswith(('blendermcp_', 'cycles')) and k not in ('work_order',): del sc[k]
sc['work_order'] = 'WO111'; sc['scene_owner'] = OWNER; sc['scene_lease'] = 'active'
sc['asset_id'] = 'lab-robot'; sc['asset_version'] = 'v001'; sc['authoring_model'] = 'claude-opus-5-5 xhigh'
sc['candidate_status'] = 'WO111 lab-robot v001 · model in progress (Blender reference sheet, no generated concept)'
lease = {
    'work_order': 'WO111', 'asset_id': 'lab-robot', 'version': 'v001',
    'task': 'full model from the approved Blender reference sheet (refine, UV, rig, five clips, export, evidence)',
    'blender_instance': 'blender-authoring (instance 1, primary)',
    'scene_owner': OWNER, 'scene_lease': 'active', 'status': 'active', 'claimed_utc': now,
    'readyz_at_claim': READYZ, 'approved_inputs_verified': inputs,
    'predecessor': {'scene_file': pred, 'scene_file_sha256': sha(pred) if pred else None, 'dirty': False, 'props_before': props},
    'claim_checkpoint': str(ROOT / 'model-claim-checkpoint.blend'), 'claim_checkpoint_sha256': sha(ROOT / 'model-claim-checkpoint.blend'),
    'sheet_stage_records_kept': kept, 'jobs_at_claim': jobs, 'prior_files': prior,
}
(ROOT / 'scene-lease.json').write_text(json.dumps(lease, indent=2) + '\n')
print(json.dumps({k: lease[k] for k in ('claimed_utc', 'scene_owner', 'scene_lease', 'predecessor', 'claim_checkpoint_sha256', 'sheet_stage_records_kept', 'approved_inputs_verified')} | {'prior_files': len(prior)}, indent=1))
