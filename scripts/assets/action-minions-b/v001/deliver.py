"""Collect one finished asset into the repo media directory and the durable artifact mirror.

usage: python3 deliver.py <asset-id> <concept-top,height> <script.py> [extra remote files...]
Fetches the exact master/GLB/records from instance 2's /artifacts route, copies the local three.js and Chromium
evidence from /tmp/mb/insp, crops this asset's concept row losslessly, copies the source scripts, writes
provenance.json and sha256-manifest.json, then mirrors the directory to /home/dev/artifacts.
"""
import hashlib, json, shutil, subprocess, sys
from pathlib import Path
sys.dont_write_bytecode = True
from transfer import fetch, LOCAL

REPO = LOCAL.parents[3]
CONCEPT = Path('/home/dev/work/hq-action-worlds-1004/docs/assets/media/action-minions-b/v001/concept.png')
asset, rows, script = sys.argv[1], sys.argv[2], sys.argv[3]
extra = sys.argv[4:]
dest = REPO / 'docs/assets/media' / asset / 'v001'
mirror = Path('/home/dev/artifacts/haynes-quest/action-worlds/v001/minions-b') / asset
insp = Path('/tmp/mb/insp')
dest.mkdir(parents=True, exist_ok=True)
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()

for rel, name in [(f'{asset}/{asset}.blend', f'{asset}.blend'), (f'{asset}/{asset}.glb', f'{asset}.glb'),
                  (f'{asset}/construction.json', 'construction.json'), (f'{asset}/{asset}-validation.json', 'validation.json')] + [(f'{asset}/{e}', e) for e in extra]:
    fetch(rel, dest / name)
construction = json.loads((dest / 'construction.json').read_text())
glb = sha(dest / f'{asset}.glb'); assert glb == construction['files'][f'{asset}.glb']['sha256'], 'GLB differs from construction record'
assert sha(dest / f'{asset}.blend') == construction['files'][f'{asset}.blend']['sha256'], 'master differs from construction record'
validation = json.loads((dest / 'validation.json').read_text()); assert validation['sha256'] == glb and not validation['failures'], validation['failures']
three = json.loads((insp / f'{asset}-three.json').read_text()); assert three['glb_sha256'] == glb and all(three['checks'].values())
shutil.copy(insp / f'{asset}-three.json', dest / 'three-inspection.json')
prev = insp / f'{asset}-preview'
browser = json.loads((prev / 'browser-inspection.json').read_text()); assert browser['glb_sha256'] == glb and all(browser['checks'].values())
for f in prev.iterdir(): shutil.copy(f, dest / f.name)
top, height = map(int, rows.split(','))
js = ("import sharp from 'sharp';const m=await sharp(%r).metadata();await sharp(%r).extract({left:0,top:%d,width:m.width,height:%d}).png({compressionLevel:9}).toFile(%r)"
      % (str(CONCEPT), str(CONCEPT), top, height, str(dest / 'concept.png')))
subprocess.run(['node', '--input-type=module', '-e', js], check=True, cwd=REPO)
subprocess.run(['node', str(LOCAL / 'compare.mjs'), str(dest / 'concept.png'), '0,%d' % height, str(dest), str(dest / 'concept-vs-model.png')], check=True, cwd=REPO)
src = dest / 'source'; src.mkdir(exist_ok=True)
names = ['transfer.py', 'run.py', 'claim.py', 'common.py', script, 'look.py', 'diag.py', 'validate.mjs', 'run_validate.py',
         'inspect-three.mjs', 'preview.mjs', 'compare.mjs', 'assets.json', 'deliver.py', 'fetch_look.py']
for n in names: shutil.copy(LOCAL / n, src / n)
cfg = json.loads((LOCAL / 'assets.json').read_text())[asset]
provenance = {
    'asset_id': asset, 'version': 'v001', 'title': cfg['title'], 'work_order': '20261004-opus-action-minions-b',
    'design': 'DESIGN-029 action and inhabited worlds', 'glb_sha256': glb,
    'candidate_status': 'Awaiting Tom\'s exact-version review; technically checked family-release candidate under PRD-004 Q-03',
    'authoring_agent': 'Claude Code, claude-opus-5-5 at xhigh effort, agent-run session on the Max plan (no API key)',
    'authoring_tool': 'Blender MCP execute_blender_code on the isolated second authoring service (blender-authoring-2) through source/transfer.py; instance 1 and the native blender MCP server were not used',
    'blender_version': construction.get('blender_version'),
    'concept': {'file': 'concept.png', 'sha256': sha(dest / 'concept.png'),
                'source_sheet': 'docs/assets/media/action-minions-b/v001/concept.png', 'source_sheet_sha256': sha(CONCEPT),
                'crop_rows_px': [top, top + height],
                'generator': 'Coordinator image generation (Codex GPT-6 Astra built-in image tool), October 4, 2026; prompt in the pack directory prompt.txt',
                'use': 'Construction reference only; no image pixels are applied to the model'},
    'source_scripts': {n: sha(src / n) for n in names},
    'original_work': ['All topology, flat vertex colours, the rigid 1-influence skin, bone layout and the five procedural clips are new Blender Python in source/.',
                      'Faces, brows, mouths, shoes and props are modelled geometry; the GLB carries no image texture.',
                      'The instance-2 transfer client follows the rooftop-city-kit v001 transfer.py; validation and preview harnesses follow the WO111 demon-band-idol / web-slinger-helper patterns.'],
    'excluded_inputs': ['No family photos, names, birthdays or likenesses.', 'No downloaded meshes, franchise logos, costumes, lettering, recordings or textures.'],
    'tool_versions': {'blender': construction.get('blender_version'), 'khronos_gltf_validator': validation['validator']['version'],
                      'three': three['three_revision'], 'chromium': browser.get('browser'), 'node': subprocess.run(['node', '--version'], capture_output=True, text=True).stdout.strip()},
    'rights_note': 'Original authored parody study; no exclusive-rights or franchise-endorsement claim.',
    'scope': 'Technical candidate delivery. The coordinator owns catalog publication, runtime registration and user-facing copy; owner exact-version and physical-device review remain open.',
}
(dest / 'provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')
files = sorted(p for p in dest.rglob('*') if p.is_file() and p.name != 'sha256-manifest.json')
manifest = {'asset_id': asset, 'version': 'v001', 'files': {str(p.relative_to(dest)): {'bytes': p.stat().st_size, 'sha256': sha(p)} for p in files}}
(dest / 'sha256-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
if mirror.exists(): shutil.rmtree(mirror)
shutil.copytree(dest, mirror)
total = sum(p.stat().st_size for p in dest.rglob('*') if p.is_file())
print(json.dumps({'asset': asset, 'glb_sha256': glb, 'files': len(files) + 1, 'bytes': total, 'dest': str(dest), 'mirror': str(mirror)}))
