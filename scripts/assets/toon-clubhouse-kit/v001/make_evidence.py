"""WO111 toon-clubhouse-kit v001: local evidence records (provenance, tool settings, visual review, delivery record).
Runs locally after the exact-GLB checks: python3 make_evidence.py. Every record names the same five GLB hashes."""
import json, hashlib, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IDS = ['clubhouse-tower-facade', 'curly-slide', 'gadget-toolbox-stand', 'rounded-hedge', 'stage-marker']
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
C = json.loads((ROOT / 'construction.json').read_text())
V = json.loads((ROOT / 'validation.json').read_text())
T = json.loads((ROOT / 'three-inspection.json').read_text())
B = json.loads((ROOT / 'stills' / 'browser-inspection.json').read_text())
S = json.loads((ROOT / 'sheets' / 'sheet-render.json').read_text())
L = json.loads((ROOT / 'scene-lease.json').read_text())
glb = {i: sha(ROOT / f'{i}.glb') for i in IDS}
vmap = {p['prop_id']: p for p in V['props']}
for i in IDS:
    assert glb[i] == vmap[i]['sha256'] == T['props'][i]['sha256'] == B['props'][i]['glb_sha256'] == C['props'][i]['glb']['sha256'], i
assert V['all_checks_pass'] and T['all_checks_pass'] and B['all_checks_pass']
STATUS = "Awaiting Tom's review · used in the family release"
concept = {'file': 'concept-draft.png', 'sha256': sha(ROOT / 'concept-draft.png'), 'prompt': 'prompt.txt', 'prompt_sha256': sha(ROOT / 'prompt.txt'),
           'revision_prompt': 'revision-prompt.txt', 'revision_prompt_sha256': sha(ROOT / 'revision-prompt.txt'),
           'author': 'Codex GPT-6 Astra, WO111 driving lead (concept draft; the requested ivory-background revision was never produced, so the draft is the reference)'}

provenance = {
    'work_order': 'WO111', 'asset_id': 'toon-clubhouse-kit', 'version': 'v001', 'created_utc': now, 'candidate_status': STATUS,
    'authoring': {'model': 'claude-opus-5-5 (Claude Code subagent, effort xhigh)', 'ruling': "Tom, September 26: Claude Opus 5.5 does the WO111 Blender work",
                  'blender_instance': 'blender-authoring (instance 1); blender-authoring-2 was not touched', 'session': 'https://claude.ai/code/session_016rSS1uA4XaroamTk1brNXn'},
    'source_concept': concept,
    'original_work': ['Five original static props modelled procedurally in Blender Python (kit_common.py + build_kit.py): lathes, outline slabs, swept sections, surface-projected reliefs and noise blobs.',
                      'Colour is per-vertex only: base palette x low-frequency pigment mottling x ray-traced soft occlusion (BVH, 40 cosine rays) tinted plum-blue; no textures, images, fonts or external assets.',
                      'Reference sheets and the kit contact sheet are Blender Cycles renders of the exact export meshes; beauty/matched stills are headless-Chromium three.js renders of the exact GLB bytes.'],
    'adapted_from': ['WO111 bin-chicken / rival-mayor sheet.py layout (parchment sheet, ruler, palette row, parody-hooks footer) and transfer/claim/release lease scripts',
                     'WO097 Rat Casino kit (vertex-tinted static props, per-prop Khronos checks)', 'WO111 yes-yes-veggie baked soft occlusion as COLOR_0'],
    'kid_safety_and_originality': 'Original parody props: no mouse ears or paired round lobes, no franchise characters, faces, logos, text, song references or copied clubhouse layout. No family names, birthdays, photos or likenesses.',
    'glb_sha256': glb,
}
tool = {
    'work_order': 'WO111', 'asset_id': 'toon-clubhouse-kit', 'version': 'v001', 'created_utc': now, 'glb_sha256': glb,
    'blender': {'version': C['blender_version'], 'instance': 'blender-authoring (instance 1)', 'units': 'METRIC, scale 1', 'axes': C['axes']},
    'export': {'format': 'GLB', 'operator': 'bpy.ops.export_scene.gltf', 'use_selection': True, 'export_yup': True, 'export_apply': False, 'export_normals': True,
               'export_texcoords': False, 'export_vertex_color': 'ACTIVE (one BYTE_COLOR POINT attribute "Col" -> COLOR_0)', 'export_materials': 'EXPORT',
               'export_animations': False, 'export_extras': True, 'scene_extras': 'identity keys only; the lease keys are stashed during export and restored after',
               'custom_normals': 'tower body and roof only (stylised rounder shading of the shallow elliptic facade; geometry unchanged)', 'compression': 'none'},
    'materials': C['materials'],
    'sheets': {'engine': 'Cycles CPU', 'samples': 48, 'denoise': True, 'view_transform': 'Standard', 'freestyle': 'plum ink #342c46, 1.7 px', 'resolution': {k: v['resolution'] for k, v in S.items()},
               'render_seconds': {k: v['render_seconds'] for k, v in S.items()}},
    'validation': {'khronos_validator': V['validator'], 'runtime': 'node inside the blender-authoring pod'},
    'three': {'revision': T['three_revision'], 'loader': T['loader'], 'envelope': T['envelope']},
    'browser': {'chromium': B['browser'], 'renderer': 'headless ANGLE SwiftShader (real WebGL raster)', 'viewport_px': [900, 900], 'tone_mapping': 'ACESFilmic, exposure 1.0, sRGB output',
                'lights': 'hemisphere #fff0d8/#657084 x2 + three directional lights (key casts a 2048 PCF-soft shadow)', 'note': 'render.info triangles include the shadow-map pass'},
}
review = {
    'work_order': 'WO111', 'asset_id': 'toon-clubhouse-kit', 'version': 'v001', 'created_utc': now, 'reviewer': 'authoring subagent self-review (coordinator and Tom review still open)',
    'status': STATUS, 'glb_sha256': glb,
    'evidence': ['concept-vs-export.png', 'kit-beauty.png', 'sheets/*-reference-sheet.png', 'sheets/kit-contact-sheet.png', 'stills/*-{front,side,back,threequarter,beauty}.png', 'preview/ (Cycles iteration looks)'],
    'concept_resolution': [
        'Sizes follow the theme-kit registry boxes on origin/main, not the concept labels: every prop stays inside its box (Khronos accessor bounds, a Three.js all-vertex pass and the SceneAssets adapter at 0/90/180/270 deg and scale 1/1.25 against decorWorldBounds).',
        'Tower: 1.2 m registry depth makes it a shallow facade; the body is an elliptic section (depth ratio 0.208) and the roof 0.275, both with rounder bent normals so the front shades like a round tower. Its side view is intentionally thin. The concept bushes that poke past the walls are tucked inside the 4.4 m width.',
        'Tower roof: one droopy teal cone tilted 10 deg (right side up, as drawn) with a counter-lean so the apex sits just left of centre; a leaning ochre chimney with a cream cap tops out at 6.36 m (registry 6.5 m).',
        'Curly slide: the chute half-spirals about 200 deg around one fat teal post (back, left, front) and runs out onto a cream landing at the front-right, rather than the concept S that crosses in front of the post twice; the 2.4 m square footprint and the right-hand stair decide it. Four teal-cushioned steps rise to a start deck; the stepped stair side shows as in the concept; the left panel carries the ochre knob.',
        'Gadget stand: the registry width (1.2 m) caps it, so the waist-high bench is 1.02 m tall (registry allows 1.3 m); the wrench rests in a truly recessed dark slot.',
        'Rounded hedges and dance marker follow the concept closely; the marker is a bun-shaped capsule with a 2.5-wave mustard squiggle and two goofy footprints. Its reference sheet shows the three-quarter view 35 deg from above because its level views are thin strips.',
        'Sheet subtitle reads "Blender reference sheet from the Astra concept draft" instead of "no generated concept": this kit has an Astra concept draft.',
        'Front orientation follows the registry comment (+Z toward the player at rotation 0). The WO097 casino kit exports face -Z; flag if the renderer expects that instead.'],
    'author_corrections': [
        'Tower first pass was 5,786 triangles; trimmed to 4,772 by lowering roof/body/porch/frame resolution while the roof was re-profiled fuller.',
        'Tower body read flat and blotchy: bent normals added, body occlusion reach cut to 0.35 m at 0.55 strength, and small decals (stones, knob, leaf marks) no longer cast occlusion.',
        'Slide: post fattened to 0.20 m radius, chute widened to 0.71 m, legs thickened; the right-hand stair wall was removed so the stepped stair side reads as in the concept.',
        'Stand: the drawer front and tabletop rendered black because inset cap rings larger than the corner radius folded; cap rings now scale toward the centroid. The slot was rebuilt as a true recess; a self-intersecting grip band (capsule shorter than its width) was replaced by a rounded rectangle.',
        'Marker: the first squiggle folded (bend radius 3.8 cm < half-width 5.2 cm) and decals smeared occlusion over the top; now 2.5 waves at 0.055 m amplitude with a 0.045 m half-width, and decals receive but never cast occlusion.',
        'A dark sliver on the marker top was a zero-area tessellated cap triangle; convex caps now fan from their centroid, and all five meshes have zero zero-area triangles.',
        'Hedge footprint was 3.4 cm off centre; the mounds were recentred.'],
    'open_items': ['Coordinator review of this kit and exact-version review by Tom.', 'Catalog intake (docs/assets media, review page, inventory, thumbnails, counts) and registry wiring (glb url + sha256; optionally tighter bounds) are coordinator-owned.',
                   'No physical-device check: stills come from headless Chromium with SwiftShader.'],
}
props = []
for i in IDS:
    t = T['props'][i]; v = vmap[i]
    props.append({'id': i, 'glb': f'docs/assets/media/toon-clubhouse-kit/v001/{i}.glb', 'artifact': str(ROOT / f'{i}.glb'), 'sha256': glb[i], 'bytes': v['bytes'],
                  'triangles': v['triangles'], 'materials': len(v['materials']), 'primitives': v['primitives'],
                  'bbox': {'min': [t['exact_bounds_gltf']['min'][k] for k in 'xyz'], 'max': [t['exact_bounds_gltf']['max'][k] for k in 'xyz']},
                  'bbox_mm': t['tight_bounds_mm'], 'symmetric_box_suggestion': t['symmetric_registry_suggestion'], 'size_m': t['size_m'],
                  'registry_bounds': t['registry_bounds'], 'registry_fill': t['registry_fill'], 'inside_registry_box': t['checks']['tight_box_inside_registry_box'],
                  'adapter_inside_decorWorldBounds': t['checks']['adapter_every_placement_inside_decorWorldBounds']})
delivery = {
    'assetId': 'toon-clubhouse-kit', 'version': 'v001', 'role': 'props', 'world': 'A', 'chapter': 1, 'theme': 'clubhouse', 'status': STATUS,
    'source': 'Codex Astra concept draft (concept-draft.png) + Blender reference sheets of the exact export meshes',
    'axes': 'glTF metres, +Y up, front toward +Z (registry rotation 0), origin at the floor centre',
    'props': props, 'heightM': max(p['size_m']['height_y'] for p in props), 'clips': [], 'attackContactS': None,
    'validation': {'khronos': 'Khronos glTF Validator ' + V['validator']['version'] + ': 0 errors, 0 warnings, 0 infos, 0 hints on all five', 'three': f"three r{T['three_revision']} GLTFLoader + SceneAssets.attachInstances: all checks pass",
                   'browser': f"Chromium {B['browser']} WebGL: no page, HTTP or GL errors"},
    'sceneLease': {'claimed_utc': L['claimed_utc'], 'released_utc': None}, 'prMerged': None,
}
for name, rec in (('provenance.json', provenance), ('tool-settings.json', tool), ('visual-review.json', review), ('delivery.json', delivery)):
    (ROOT / name).write_text(json.dumps(rec, indent=2) + '\n')
print(json.dumps({p['id']: {'sha256': p['sha256'][:12], 'bbox': p['bbox'], 'tris': p['triangles']} for p in props}, indent=1))
