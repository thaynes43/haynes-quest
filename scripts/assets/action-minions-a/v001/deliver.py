"""Action minions A v001: deliver one candidate (local side, after its final bake).

  python3 deliver.py <asset-id>

1. runs validate.mjs in the instance-1 pod against the exact GLB (Khronos + budgets);
2. fetches the masters and remote records through the service /artifacts/ route into the durable directory;
3. runs the Three inspection and the Chromium preview against those exact fetched bytes;
4. writes provenance.json, uploads the local evidence back to the remote asset directory, and writes a
   SHA-256 manifest with a remote/local byte match for every mirrored file;
5. copies the review set into docs/assets/media/<asset-id>/v001/ in this worktree.
Every report must name the same GLB hash and pass, or the delivery stops.
"""
import hashlib, json, shutil, subprocess, sys, datetime
from pathlib import Path
from urllib.request import urlopen
sys.dont_write_bytecode = True
from client import MCP, LOCAL, REMOTE, ARTIFACTS, DURABLE, OWNER, upload
REPO = LOCAL.parents[3]
asset = sys.argv[1]
D = DURABLE / asset; D.mkdir(parents=True, exist_ok=True); (D / 'preview').mkdir(exist_ok=True); (D / 'source').mkdir(exist_ok=True)
MEDIA = REPO / 'docs/assets/media' / asset / 'v001'
sha = lambda b: hashlib.sha256(b).hexdigest()
run = lambda args, **kw: subprocess.run(args, capture_output=True, text=True, **kw)

c = MCP(timeout=900); c.guard()
r = run([sys.executable, str(LOCAL / 'run_validate.py'), asset], cwd=LOCAL); print(r.stdout[-600:])
MASTERS = [asset + '.glb', asset + '.blend', asset + '-construction.blend', asset + '-checkpoint.glb', 'pigment.png', 'construction.json', 'validation.json', 'rig-rest.json', 'bounds.json']
for n in MASTERS: (D / n).write_bytes(urlopen(ARTIFACTS + asset + '/' + n, timeout=300).read())
glb_hash = sha((D / (asset + '.glb')).read_bytes())
r = run([str(REPO / 'node_modules/.bin/tsx'), str(LOCAL / 'inspect-three.mjs'), asset, str(D)], cwd=REPO); print(r.stdout[-400:], r.stderr[-1500:])
concept_row = Path('/tmp/minions-a') / (asset + '-concept-row.png')
shutil.copy2(concept_row, D / 'concept-row.png')
r = run(['node', str(LOCAL / 'preview.mjs'), asset, str(D / (asset + '.glb')), str(D / 'preview'), str(D / 'concept-row.png')], cwd=REPO); print(r.stdout[-400:], r.stderr[-1500:])
shutil.copy2(D / 'preview/browser-inspection.json', D / 'browser-inspection.json')
for name in ('validation.json', 'three-inspection.json', 'browser-inspection.json'):
    rep = json.loads((D / name).read_text()); assert rep.get('sha256', rep.get('glb_sha256')) == glb_hash, (name, 'names a different GLB')
    bad = [k for k, v in rep['checks'].items() if not v]; assert not bad, (name, bad)
val = json.loads((D / 'validation.json').read_text()); ins = json.loads((D / 'three-inspection.json').read_text()); bro = json.loads((D / 'browser-inspection.json').read_text())
con = json.loads((D / 'construction.json').read_text())
_t = c.text("import bpy,json,socket,addon_utils\ntry:\n import io_scene_gltf2 as g; gv='.'.join(map(str,addon_utils.module_bl_info(g)['version']))\nexcept Exception as e: gv='unknown: '+str(e)\nprint(json.dumps({'blender':bpy.app.version_string,'build_hash':bpy.app.build_hash.decode() if isinstance(bpy.app.build_hash,bytes) else str(bpy.app.build_hash),'host':socket.gethostname(),'gltf_addon':gv}))")
info = json.loads(_t[_t.index('{'):_t.rindex('}') + 1])
sources = sorted(p for p in LOCAL.iterdir() if p.suffix in ('.py', '.mjs') and p.is_file())
for p in sources: shutil.copy2(p, D / 'source' / p.name)
prov = {'asset_id': asset, 'version': 'v001', 'pack': 'action-minions-a', 'design': 'DESIGN-029 (action and inhabited worlds)',
        'work_order': '/home/dev/work/hq-action-worlds-1004/.agents/work-orders/20261004-opus-action-minions-a.md',
        'review_state': "Awaiting Tom's review (PRD-004 Q-03 family-release candidate); coordinator review and owner approval are separate",
        'concept': {'file': 'docs/assets/media/action-minions-a/v001/concept.png', 'sha256': sha(Path('/home/dev/work/hq-action-worlds-1004/docs/assets/media/action-minions-a/v001/concept.png').read_bytes()),
                    'row_crop': 'docs/assets/media/%s/v001/concept-row.png' % asset, 'row_crop_sha256': sha((D / 'concept-row.png').read_bytes()),
                    'origin': 'Coordinator-generated construction reference supplied in the lead worktree; used as build direction only. No image is projected or pasted onto the model.'},
        'authoring': {'tool': 'Claude Code (agent-run headless task session, Max plan; no API key)', 'model': 'claude-opus-5-5', 'effort': 'xhigh',
                      'worktree': '/home/dev/work/haynes-quest-1004-180133 (branch agent/haynes-quest-1004-180133)', 'scene_owner': OWNER},
        'blender': {'version': info.get('blender'), 'build_hash': info.get('build_hash'), 'gltf_exporter': info.get('gltf_addon'), 'service': 'blender-authoring (instance 1) over streamable-HTTP MCP execute_blender_code', 'pod': info.get('host'),
                    'method': 'Procedural Blender Python only: bevelled boxes, lathes, ellipsoids, swept tubes and extruded plates per part, per-face atlas tiles, one joined skin, armature with tent-weighted chains, poses baked from world-space deltas at 60 fps into five muted NLA tracks. No sculpt, no downloaded or copied meshes, logos or textures.'},
        'export_settings': {'format': 'GLB', 'export_yup': True, 'export_animation_mode': 'NLA_TRACKS', 'export_optimize_animation_size': False, 'export_skins': True, 'export_def_bones': False,
                            'export_armature_object_remove': True, 'export_influence_nb': 4, 'export_apply': False, 'export_tangents': False, 'export_image_format': 'AUTO', 'export_extras': True,
                            'scene_extras': 'identity keys only (asset_id, asset_version, pack, candidate_status, source_reference, source_concept_sha256, orientation, role, authoring_model, design)'},
        'checks_tools': {'khronos': 'gltf-validator ' + str(val['validator'].get('validatorVersion')) + ' in the Blender pod', 'three': 'three r' + str(ins['three_revision']) + ' via tsx with the real src/game/enemy-animation.ts',
                         'browser': 'Chromium ' + bro['browser'] + ' headless, ANGLE SwiftShader'},
        'budgets': {'triangles': val['triangles'], 'triangle_budget': 15000, 'materials': len(val['materials']), 'material_budget': 2, 'draw_primitives': val['draw_primitives'], 'glb_bytes': val['bytes'], 'glb_budget_bytes': 2097152,
                    'atlas': '1024 x 1024 PNG, %d bytes embedded' % val['images'][0]['bytes'], 'joints': len(val['joints']), 'max_influences': ins['max_skin_influences']},
        'size_m': {'height': round(ins['height_m'], 4), 'rest_bounds_y_up': ins['rest_bounds_y_up'], 'all_animation_bounds_y_up': ins['all_animation_bounds_y_up']},
        'clips': {cl['name']: {k: v for k, v in cl.items() if k != 'name'} for cl in con['clips']},
        'adapter_mapping': {'idle': 'idle', 'chasing': 'move', 'windup/strike': 'attack (contact at 1.25 s, contactFraction 0.625)', 'hit (HP drop)': 'hit', 'defeated': 'defeat (held pose, then the adapter vanish)'},
        'scene_catalog_motion': {'contactFraction': .625, 'height': round(ins['height_m'], 6)},
        'source_scripts': {p.name: sha(p.read_bytes()) for p in sources},
        'glb_sha256': glb_hash, 'created_utc': datetime.datetime.now(datetime.timezone.utc).isoformat()}
(D / 'provenance.json').write_text(json.dumps(prov, indent=2) + '\n')
# mirror local evidence to the remote asset directory
STILLS = sorted(p.name for p in (D / 'preview').iterdir() if p.suffix in ('.png', '.webm', '.json'))
for n in STILLS: upload(c, D / 'preview' / n, asset + '/preview/' + n)
for n in ('three-inspection.json', 'browser-inspection.json', 'provenance.json', 'concept-row.png'): upload(c, D / n, asset + '/' + n)
for p in sources: upload(c, p, asset + '/source/' + p.name)
files = []
mirrored = MASTERS + ['three-inspection.json', 'browser-inspection.json', 'provenance.json', 'concept-row.png'] + ['preview/' + n for n in STILLS] + ['source/' + p.name for p in sources]
for n in mirrored:
    data = (D / n).read_bytes()
    if n.endswith(('.py', '.mjs', '.webm')):
        c.execute('import hashlib\nfrom pathlib import Path\nassert hashlib.sha256(Path(%r).read_bytes()).hexdigest()==%r' % (REMOTE + '/' + asset + '/' + n, sha(data))); how = 'MCP SHA-256 in the pod (the artifact route serves neither sources nor .webm)'
    else:
        assert sha(urlopen(ARTIFACTS + asset + '/' + n, timeout=300).read()) == sha(data), n; how = 'HTTP byte round trip'
    files.append({'path': n, 'bytes': len(data), 'sha256': sha(data), 'remote_local_match': True, 'verified_by': how})
manifest = {'asset_id': asset, 'version': 'v001', 'glb_sha256': glb_hash, 'remote_root': REMOTE + '/' + asset, 'durable_root': str(D), 'files': files,
            'excluded': ['*.blend1 automatic backups', 'scene lease/release records live at the pack root'], 'manifest_self_hash': 'excluded (recursive)'}
(D / 'sha256-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n'); upload(c, D / 'sha256-manifest.json', asset + '/sha256-manifest.json')
# repo review set
MEDIA.mkdir(parents=True, exist_ok=True)
REVIEW = ['concept-row.png', asset + '.glb', asset + '.blend', 'pigment.png', 'construction.json', 'validation.json', 'three-inspection.json', 'browser-inspection.json', 'provenance.json', 'bounds.json', 'sha256-manifest.json']
for n in REVIEW: shutil.copy2(D / n, MEDIA / n)
for n in STILLS:
    if n.endswith(('.png', '.webm')): shutil.copy2(D / 'preview' / n, MEDIA / n)
total = sum(p.stat().st_size for p in MEDIA.iterdir())
print(json.dumps({'asset': asset, 'glb_sha256': glb_hash, 'master_sha256': sha((D / (asset + '.blend')).read_bytes()), 'triangles': val['triangles'], 'glb_bytes': val['bytes'],
                  'height_m': ins['height_m'], 'files_mirrored': len(files), 'repo_media_bytes': total, 'repo_media_files': len(list(MEDIA.iterdir()))}))
