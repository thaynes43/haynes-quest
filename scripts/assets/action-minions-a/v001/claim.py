"""Action minions A: claim the exclusive scene lease on Blender instance 1 for the whole three-model pack.

Checks /readyz ready + not busy, no render/bake jobs, a released lease and a clean (saved) live scene.
Saves an as-found checkpoint copy BEFORE changing anything, then hashes every earlier workspace file
(masters, exports, renders, records) so the release can prove they are byte-for-byte unchanged."""
import json, sys
from urllib.request import urlopen
sys.dont_write_bytecode = True
from client import MCP, HOST, REMOTE, OWNER, WORK_ORDER
ready = json.loads(urlopen(HOST + '/readyz', timeout=10).read())
assert ready.get('ready') and not ready.get('busy'), ready
c = MCP(timeout=900)
print(c.text(r'''
import bpy, json, datetime, hashlib, socket
from pathlib import Path
sc = bpy.context.scene
props = {k: str(sc[k]) for k in sc.keys() if not k.startswith(('cycles', 'blendermcp'))}
jobs = {j: bpy.app.is_job_running(j) for j in ['RENDER', 'RENDER_PREVIEW', 'OBJECT_BAKE', 'COMPOSITE']}
assert not any(jobs.values()), jobs
assert props.get('scene_lease') in (None, 'released') and props.get('scene_owner') in (None, 'none'), ('scene held', props)
assert not bpy.data.is_dirty, 'live scene has unsaved edits; stop and inspect instead of claiming'
root = Path(%r); assert not (root / 'scene-lease.json').exists(), 'a lease record already exists here'
root.mkdir(parents=True, exist_ok=True); (root / 'source').mkdir(exist_ok=True)
found = bpy.data.filepath
found_sha = hashlib.sha256(Path(found).read_bytes()).hexdigest() if found else None
# 1. as-found checkpoint before any change (copy=True keeps the live file path untouched)
bpy.ops.wm.save_as_mainfile(filepath=str(root / 'claim-checkpoint.blend'), copy=True, compress=True)
# 2. hash every earlier workspace file outside this pack
ws = Path('/workspace/haynes-quest'); prior = {}
for p in sorted(ws.rglob('*')):
    if p.is_file() and root not in p.parents and p.suffix not in ('.blend1', '.pyc', '.log'):
        prior[str(p.relative_to(ws))] = hashlib.sha256(p.read_bytes()).hexdigest()
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
sc['work_order'] = %r; sc['scene_owner'] = %r; sc['scene_lease'] = 'active'
sc['asset_id'] = 'action-minions-a'; sc['asset_version'] = 'v001'; sc['authoring_model'] = 'claude-opus-5-5 xhigh (Claude Code, Max plan)'
for k in ('candidate_status', 'source_reference', 'source_sheet_sha256', 'source_blockout_sha256', 'role'):
    if k in sc.keys(): del sc[k]
lease = {'work_order': %r, 'pack': 'action-minions-a', 'version': 'v001',
         'assets': ['gadget-hammer-hopper@v001', 'mischief-kitten-skater@v001', 'lab-robot-sentry@v001'],
         'task': 'Three ordinary enemy models from the coordinator concept sheet: build, UV, rig, five clips, export, evidence',
         'blender_instance': 'blender-authoring (instance 1, primary); host ' + socket.gethostname(), 'blender_version': bpy.app.version_string,
         'scene_owner': %r, 'scene_lease': 'active', 'status': 'active', 'claimed_utc': now,
         'scene_before_claim': {'file': found, 'file_sha256': found_sha, 'dirty': False, 'object_count': len(bpy.data.objects), 'props': props},
         'claim_checkpoint': str(root / 'claim-checkpoint.blend'), 'claim_checkpoint_sha256': hashlib.sha256((root / 'claim-checkpoint.blend').read_bytes()).hexdigest(),
         'jobs_at_claim': jobs, 'readyz_at_claim': %r, 'prior_workspace_files': len(prior)}
(root / 'scene-lease.json').write_text(json.dumps(lease, indent=2) + '\n')
(root / 'prior-workspace-sha256.json').write_text(json.dumps(prior, indent=1) + '\n')
print(json.dumps(lease, indent=1))
''' % (REMOTE, WORK_ORDER, OWNER, WORK_ORDER, OWNER, ready)))
