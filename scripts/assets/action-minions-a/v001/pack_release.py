"""Action minions A v001: assemble the released pack master and release the instance-1 scene lease.

Appends each delivered asset's skin + rig (with its five NLA clips and packed atlas) from its own editable master into
one clean scene, 2.2 m apart, saves action-minions-a-pack.blend, then releases the live scene (owner none, lease
released), saves live-scene-release.blend in the pack root and proves every earlier workspace file is byte-identical
to the hashes taken at the claim. Runs inside Blender instance 1."""
import bpy, json, hashlib, datetime, importlib.util
from pathlib import Path
SRC = Path('/workspace/haynes-quest/action-worlds/minions-a/v001/source')
spec = importlib.util.spec_from_file_location('mna_common', SRC / 'common.py'); C = importlib.util.module_from_spec(spec); spec.loader.exec_module(C)
PACK = C.PACK; ASSETS = ['gadget-hammer-hopper', 'mischief-kitten-skater', 'lab-robot-sentry']
RIGS = {'gadget-hammer-hopper': ('Gadget_Hammer_Hopper_Rig', 'Gadget_Hammer_Hopper_Skin'), 'mischief-kitten-skater': ('Mischief_Kitten_Skater_Rig', 'Mischief_Kitten_Skater_Skin'),
        'lab-robot-sentry': ('Lab_Robot_Sentry_Rig', 'Lab_Robot_Sentry_Skin')}
C.guard('action-minions-a')
sc = bpy.context.scene
jobs = {j: bpy.app.is_job_running(j) for j in ['RENDER', 'RENDER_PREVIEW', 'OBJECT_BAKE', 'COMPOSITE']}
assert not any(jobs.values()), jobs
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
# every delivered asset must have its passing records on the remote before the pack is assembled
for a in ASSETS:
    for n in ('validation.json', 'three-inspection.json', 'browser-inspection.json'):
        r = json.loads((PACK / a / n).read_text()); assert all(r['checks'].values()), (a, n)
        assert r.get('sha256', r.get('glb_sha256')) == sha(PACK / a / (a + '.glb')), (a, n, 'names another GLB')
C.clear_scene()
placed = {}
for i, a in enumerate(ASSETS):
    rig, skin = RIGS[a]
    with bpy.data.libraries.load(str(PACK / a / (a + '.blend')), link=False) as (src, dst):
        dst.objects = [rig, skin]
    col = bpy.data.collections.new('%s v001 (awaiting review)' % a); sc.collection.children.link(col)
    for ob in dst.objects: col.objects.link(ob)
    bpy.data.objects[rig].location = ((i - 1) * 2.2, 0, 0)
    placed[a] = {'rig': rig, 'skin': skin, 'offset_x_m': (i - 1) * 2.2, 'clips': [t.name for t in bpy.data.objects[rig].animation_data.nla_tracks], 'source_master_sha256': sha(PACK / a / (a + '.blend'))}
txt = bpy.data.texts.new('README action minions A v001')
txt.write('Released pack master: three original ordinary-enemy candidates (DESIGN-029), awaiting Tom\'s review.\n'
          'Each asset\'s own editable master (with its hidden part collection and source scripts) is the authoritative edit file:\n' +
          '\n'.join('  %s/%s.blend' % (a, a) for a in ASSETS) + '\nThis file is an assembled overview for review and is not exported.\n')
sc['work_order'] = 'action-worlds/minions-a'; sc['pack'] = 'action-minions-a'; sc['asset_version'] = 'v001'
sc['candidate_status'] = "action-minions-a v001 · three candidates · Awaiting Tom's review"
bpy.ops.wm.save_as_mainfile(filepath=str(PACK / 'action-minions-a-pack.blend'), copy=True, compress=True)
# release
lease = json.loads((PACK / 'scene-lease.json').read_text())
prior = json.loads((PACK / 'prior-workspace-sha256.json').read_text()); ws = Path('/workspace/haynes-quest')
changed = [k for k, v in prior.items() if not (ws / k).exists() or sha(ws / k) != v]
assert not changed, ('earlier workspace files changed', changed[:20])
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
sc['scene_owner'] = 'none'; sc['scene_lease'] = 'released'
if 'current_asset' in sc.keys(): del sc['current_asset']
bpy.ops.wm.save_as_mainfile(filepath=str(PACK / 'live-scene-release.blend'), compress=True)
lease.update(status='released', scene_owner='none', scene_lease='released', released_utc=now, author_jobs_running=False)
(PACK / 'scene-lease.json').write_text(json.dumps(lease, indent=2) + '\n')
record = {'work_order': 'action-worlds/minions-a', 'pack': 'action-minions-a', 'version': 'v001', 'blender_instance': lease['blender_instance'], 'released_utc': now,
          'scene_owner': 'none', 'scene_lease': 'released', 'live_scene_file': bpy.data.filepath, 'saved_live_scene_sha256': sha(PACK / 'live-scene-release.blend'),
          'pack_master': str(PACK / 'action-minions-a-pack.blend'), 'pack_master_sha256': sha(PACK / 'action-minions-a-pack.blend'), 'pack_contents': placed,
          'assets': {a: {'glb_sha256': sha(PACK / a / (a + '.glb')), 'editable_master_sha256': sha(PACK / a / (a + '.blend')), 'construction_master_sha256': sha(PACK / a / (a + '-construction.blend'))} for a in ASSETS},
          'claim_checkpoint_sha256': sha(PACK / 'claim-checkpoint.blend'), 'scene_before_claim': lease['scene_before_claim']['file'],
          'prior_workspace_files_checked': len(prior), 'prior_workspace_files_changed': changed, 'author_jobs_running': False, 'job_checks': jobs,
          'scope': "Candidate technical delivery only; the coordinator owns catalog publication and runtime integration. Awaiting Tom's review; no physical-device acceptance."}
(PACK / 'scene-release.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps({k: record[k] for k in ('released_utc', 'saved_live_scene_sha256', 'pack_master_sha256', 'prior_workspace_files_checked', 'prior_workspace_files_changed', 'live_scene_file')}))
