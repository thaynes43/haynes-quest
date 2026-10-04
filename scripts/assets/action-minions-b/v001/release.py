"""Assemble the released pack master from the four separate masters, verify every predecessor master/export is
byte-identical to the claim record, then release the instance-2 lease (scene saved clean as live-scene-release.blend)."""
import bpy, sys, json, hashlib
from pathlib import Path
sys.path.insert(0, '/workspace/haynes-quest/action-worlds/minions-b/v001/source')
import common as C
C.lease_ok()
R = C.REMOTE
lease = json.loads((R / 'scene-lease.json').read_text())
out = R / 'live-scene-release.blend'; assert not out.exists(), 'release master already exists'
masters = {'broccoli-bouncer': R / 'broccoli-bouncer/broccoli-bouncer.blend', 'bin-chicken-flower-thief': R / 'bin-chicken-flower-thief/bin-chicken-flower-thief.blend',
           'demon-idol-drummer': R / 'demon-idol-drummer/demon-idol-drummer.blend', 'storybook-planting-kit': R / 'storybook-planting-kit/storybook-planting-kit.blend'}
outputs = {str(p): C.sha(p) for p in sorted(R.rglob('*')) if p.suffix in ('.blend', '.glb') and p.name != 'pack-assembly-start.blend'}
C.reset('Action minions B v001 pack', {})
# Blender cannot append from the file that is open (the kit master), so the empty assembly scene gets its own path first.
asm = R / 'pack-assembly-start.blend'
if asm.exists(): asm.unlink()
bpy.ops.wm.save_as_mainfile(filepath=str(asm), compress=True)
offsets = {'broccoli-bouncer': -3.0, 'bin-chicken-flower-thief': -1.5, 'demon-idol-drummer': 0.0}
for aid, path in masters.items():
    with bpy.data.libraries.load(str(path), link=False) as (src, dst):
        dst.collections = [c for c in src.collections]
    for coll in dst.collections:
        bpy.context.scene.collection.children.link(coll)
        if aid in offsets:
            for ob in coll.objects:
                if ob.parent is None: ob.location.x += offsets[aid]
        else:
            xs = {'Kit storybook-canopy-tree': 3.5, 'Kit storybook-cypress': 6.5, 'Kit storybook-flowering-shrub': 8.0}
            for ob in coll.objects: ob.location.x += xs.get(coll.name, 0)
for lib in list(bpy.data.libraries): bpy.data.libraries.remove(lib)
prior = lease['prior_files']; now = {}
for p, h in prior.items():
    now[p] = hashlib.sha256(Path(p).read_bytes()).hexdigest() if Path(p).exists() else None
unchanged = all(now[p] == h for p, h in prior.items())
assert unchanged, [p for p in prior if now[p] != prior[p]]
sc = bpy.context.scene
release = {'work_order': lease['work_order'], 'released_utc': C.now(), 'released_by': lease['scene_owner'], 'blender_instance': 'blender-authoring-2',
           'predecessor_files_checked': len(prior), 'predecessor_files_unchanged': unchanged, 'claimed_from': lease['predecessor']['path'],
           'pack_master': str(out), 'separate_masters': {k: str(v) for k, v in masters.items()}, 'outputs_sha256': outputs,
           'scene_after_release': {'scene_owner': 'none', 'scene_lease': 'released'}}
sc['work_order'] = lease['work_order']; sc['scene_owner'] = 'none'; sc['scene_lease'] = 'released'
sc['asset_id'] = 'action-minions-b'; sc['asset_version'] = 'v001'; sc['authoring_model'] = 'claude-opus-5-5 xhigh'
sc['candidate_status'] = 'action-minions-b v001 released: broccoli-bouncer, bin-chicken-flower-thief, demon-idol-drummer, storybook-planting-kit · awaiting owner review'
for k in ('pack_id',):
    if k in sc: del sc[k]
bpy.ops.wm.save_as_mainfile(filepath=str(out), compress=True)
release['pack_master_sha256'] = C.sha(out); release['open_file_dirty_after_save'] = bpy.data.is_dirty
(R / 'scene-release.json').write_text(json.dumps(release, indent=2) + '\n')
print(json.dumps({k: release[k] for k in ('released_utc', 'predecessor_files_checked', 'predecessor_files_unchanged', 'pack_master_sha256', 'open_file_dirty_after_save')}))
