"""Collect the finished storybook planting kit into the repo media directory and the durable artifact mirror.
usage: python3 deliver_kit.py   (after the kit checks wrote /tmp/mb/kit/three-inspection.json and /tmp/mb/kit/preview)"""
import hashlib, json, shutil, subprocess, sys
from pathlib import Path
sys.dont_write_bytecode = True
from transfer import fetch, LOCAL

REPO = LOCAL.parents[3]; KIT = 'storybook-planting-kit'
CONCEPT = Path('/home/dev/work/hq-action-worlds-1004/docs/assets/media/storybook-planting-kit/v001/concept.png')
PROMPT = CONCEPT.with_name('prompt.txt')
PROPS = ['storybook-canopy-tree', 'storybook-cypress', 'storybook-flowering-shrub']
dest = REPO / 'docs/assets/media' / KIT / 'v001'; mirror = Path('/home/dev/artifacts/haynes-quest/action-worlds/v001/minions-b') / KIT
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
dest.mkdir(parents=True, exist_ok=True)
for rel, name in [(f'{KIT}/{KIT}.blend', f'{KIT}.blend'), (f'{KIT}/construction.json', 'construction.json')] + \
                 [(f'{KIT}/{p}.glb', f'{p}.glb') for p in PROPS] + [(f'{KIT}/{p}-validation.json', f'validation-{p}.json') for p in PROPS]:
    fetch(rel, dest / name)
con = json.loads((dest / 'construction.json').read_text())
for n, f in con['files'].items(): assert sha(dest / n) == f['sha256'], n
three = json.loads(Path('/tmp/mb/kit/three-inspection.json').read_text()); browser = json.loads(Path('/tmp/mb/kit/preview/browser-inspection.json').read_text())
for p in PROPS:
    g = sha(dest / f'{p}.glb'); v = json.loads((dest / f'validation-{p}.json').read_text())
    assert v['sha256'] == g and not v['failures'] and three['props'][p]['glb_sha256'] == g and all(three['props'][p]['checks'].values()) and browser['glb_sha256'][p] == g, p
assert all(browser['checks'].values()) and three['shared_material_across_kit']
shutil.copy('/tmp/mb/kit/three-inspection.json', dest / 'three-inspection.json')
for f in Path('/tmp/mb/kit/preview').rglob('*'):
    if f.is_file(): t = dest / f.relative_to('/tmp/mb/kit/preview'); t.parent.mkdir(parents=True, exist_ok=True); shutil.copy(f, t)
shutil.copy(CONCEPT, dest / 'concept.png'); shutil.copy(PROMPT, dest / 'prompt.txt')
subprocess.run(['node', str(LOCAL / 'compare-kit.mjs'), str(dest / 'concept.png'), str(dest / 'stills'), str(dest / 'concept-vs-model.png')], check=True, cwd=REPO)
src = dest / 'source'; src.mkdir(exist_ok=True)
names = ['transfer.py', 'run.py', 'claim.py', 'common.py', 'kit.py', 'look.py', 'validate.mjs', 'run_validate.py', 'inspect-static.mjs', 'preview-kit.mjs', 'compare-kit.mjs', 'deliver_kit.py', 'fetch_look.py']
for n in names: shutil.copy(LOCAL / n, src / n)
prov = {'asset_id': KIT, 'version': 'v001', 'props': PROPS, 'work_order': '20261004-opus-action-minions-b', 'design': 'DESIGN-029 action and inhabited worlds',
        'glb_sha256': {p: sha(dest / f'{p}.glb') for p in PROPS},
        'candidate_status': "Awaiting Tom's exact-version review; technically checked family-release candidate under PRD-004 Q-03",
        'authoring_agent': 'Claude Code, claude-opus-5-5 at xhigh effort, agent-run session on the Max plan (no API key)',
        'authoring_tool': 'Blender MCP execute_blender_code on the isolated second authoring service (blender-authoring-2) through source/transfer.py; instance 1 and the native blender MCP server were not used',
        'blender_version': con['blender_version'],
        'concept': {'file': 'concept.png', 'sha256': sha(dest / 'concept.png'), 'prompt': 'prompt.txt', 'prompt_sha256': sha(dest / 'prompt.txt'),
                    'generator': 'Coordinator image generation (Codex GPT-6 Astra built-in image tool), October 4, 2026', 'use': 'Construction reference only; no image pixels are applied to the props'},
        'source_scripts': {n: sha(src / n) for n in names},
        'original_work': ['Every trunk, root flare, limb, shingled leaf crown, cypress scale, shrub leaf, stem and five-petal flower is new procedural Blender Python (source/kit.py).',
                          'One shared vertex-coloured material for all three props; no image texture.'],
        'excluded_inputs': ['No family photos or likenesses.', 'No downloaded meshes, scanned plants, logos or textures.'],
        'tool_versions': {'blender': con['blender_version'], 'khronos_gltf_validator': json.loads((dest / f'validation-{PROPS[0]}.json').read_text())['validator']['version'],
                          'three': three['three_revision'], 'chromium': browser.get('browser')},
        'orientation': 'glTF +Y up; each prop is one identity-transform mesh node named for the prop, its planting base centred on the ground origin; no soil disc, pot or slab.',
        'scope': 'Technical candidate delivery. The coordinator owns catalog publication, theme placement and user-facing copy; owner exact-version review remains open.'}
(dest / 'provenance.json').write_text(json.dumps(prov, indent=2) + '\n')
files = sorted(p for p in dest.rglob('*') if p.is_file() and p.name != 'sha256-manifest.json')
(dest / 'sha256-manifest.json').write_text(json.dumps({'asset_id': KIT, 'version': 'v001', 'files': {str(p.relative_to(dest)): {'bytes': p.stat().st_size, 'sha256': sha(p)} for p in files}}, indent=2) + '\n')
if mirror.exists(): shutil.rmtree(mirror)
shutil.copytree(dest, mirror)
print(json.dumps({'kit': KIT, 'glb': prov['glb_sha256'], 'files': len(files) + 1, 'bytes': sum(p.stat().st_size for p in dest.rglob('*') if p.is_file())}))
