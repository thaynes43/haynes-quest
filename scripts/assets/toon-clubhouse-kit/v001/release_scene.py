"""WO111 toon-clubhouse-kit v001: saved exclusive scene release on Blender instance 1 (the GLBs stay untouched).
Also used on failure: pass FAILURE=<reason> (module global) to release without the report assertions.
Adapted from the WO111 bin-chicken / rival-mayor release_model.py."""
import bpy, json, hashlib, datetime
from pathlib import Path
ROOT = Path('/workspace/haynes-quest/family-eras/toon-clubhouse-kit/v001')
OWNER = 'claude-opus-5-5/toon-clubhouse-kit-props'
IDS = ['clubhouse-tower-facade', 'curly-slide', 'gadget-toolbox-stand', 'rounded-hedge', 'stage-marker']
FAILURE = globals().get('FAILURE')
sc = bpy.context.scene
assert sc.get('work_order') == 'WO111' and sc.get('asset_id') == 'toon-clubhouse-kit' and sc.get('scene_lease') == 'active' and sc.get('scene_owner') == OWNER
jobs = {j: bpy.app.is_job_running(j) for j in ['RENDER', 'RENDER_PREVIEW', 'OBJECT_BAKE', 'COMPOSITE']}
assert not any(jobs.values()), jobs
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
glbs = {i: (sha(ROOT / f'{i}.glb') if (ROOT / f'{i}.glb').exists() else 'none') for i in IDS}
if not FAILURE:
    V = json.loads((ROOT / 'validation.json').read_text()); T = json.loads((ROOT / 'three-inspection.json').read_text())
    B = json.loads((ROOT / 'stills' / 'browser-inspection.json').read_text())
    assert V['all_checks_pass'] and T['all_checks_pass'] and B['all_checks_pass']
    for p in V['props']: assert p['sha256'] == glbs[p['prop_id']], ('validation names another GLB', p['prop_id'])
    for i in IDS: assert T['props'][i]['sha256'] == glbs[i] and B['props'][i]['glb_sha256'] == glbs[i], ('report names another GLB', i)
lease = json.loads((ROOT / 'scene-lease.json').read_text())
prior = {k: {'path': e['path'], 'sha256_at_claim': e['sha256'], 'sha256_now': sha(e['path']), 'unchanged': sha(e['path']) == e['sha256']} for k, e in lease['prior_files'].items()}
assert all(e['unchanged'] for e in prior.values()), prior
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
sc['scene_owner'] = 'none'; sc['scene_lease'] = 'released'
sc['candidate_status'] = "WO111 toon-clubhouse-kit v001 · Awaiting Tom's review · used in the family release"
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'live-scene-release.blend'), compress=True)
lease.update(status='released' if not FAILURE else 'released-after-failure', scene_owner='none', scene_lease='released', author_jobs_running=False, released_utc=now, glb_sha256=glbs)
if FAILURE: lease['failure'] = FAILURE
(ROOT / 'scene-lease.json').write_text(json.dumps(lease, indent=2) + '\n')
record = {'work_order': 'WO111', 'asset_id': 'toon-clubhouse-kit', 'version': 'v001', 'blender_instance': 'blender-authoring (instance 1)', 'released_utc': now,
          'scene_owner': 'none', 'scene_lease': 'released', 'saved_live_scene': str(ROOT / 'live-scene-release.blend'), 'saved_live_scene_sha256': sha(ROOT / 'live-scene-release.blend'),
          'editable_master': str(ROOT / 'toon-clubhouse-kit.blend'), 'editable_master_sha256': sha(ROOT / 'toon-clubhouse-kit.blend'),
          'sheet_scene_sha256': sha(ROOT / 'toon-clubhouse-kit-sheets.blend') if (ROOT / 'toon-clubhouse-kit-sheets.blend').exists() else 'none',
          'glb_sha256': glbs, 'author_jobs_running': any(jobs.values()), 'job_checks': jobs, 'prior_scene_files_unchanged': prior, 'failure': FAILURE,
          'scope': "Awaiting Tom's review · used in the family release. Candidate technical delivery only; the coordinator owns catalog publication and registry/runtime integration. No physical-device acceptance."}
(ROOT / 'scene-release.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps({k: record[k] for k in ['released_utc', 'scene_lease', 'saved_live_scene_sha256', 'editable_master_sha256']}))
