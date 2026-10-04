"""Write the coordinator's catalog intake for action minions B v001 (inventory-shaped entries plus runtime data).
The coordinator owns catalog.md, catalog-inventory.json, parody-catalog.ts and scene manifests; nothing here edits them."""
import hashlib, json
from pathlib import Path
REPO = Path(__file__).resolve().parents[4]
M = 'docs/assets/media'
sha = lambda p: hashlib.sha256((REPO / p).read_bytes()).hexdigest()
def files(d): return {str(p.relative_to(REPO)): sha(p.relative_to(REPO)) for p in sorted((REPO / d).rglob('*')) if p.is_file() and '/source/' not in str(p)}
ENEMIES = {
    'broccoli-bouncer': dict(title='Broccoli Bouncer', cast='Nursery vegetable cast', related='yes-yes-veggie', period='sing-along-playroom-v1',
        description='A chunky broccoli with a floret crown, a sly cream face, leaf hands and orange high-top sneakers. It bounces after the player and slaps with both leaves.',
        clips={'idle': 'springy bob, sly brow waggle, blink (2.0 s loop)', 'move': 'hopping run (0.8 s loop)',
               'attack': 'notice 0.25 s, crouch and tremble to 1.08 s, leaf slap at 1.25 s, hop home (2.0 s)', 'hit': 'squashed recoil, eyes squeezed (0.6 s)',
               'defeat': 'dizzy spin, wilt, topples onto its back with feet up; held from 1.8 s (2.4 s)'}),
    'bin-chicken-flower-thief': dict(title='Bin Chicken Flower Thief', cast='Magical garden cast', related='bin-chicken', period='magic-house-v1',
        description='A gangly white ibis with a curved dark beak, black crest and wing tips, big orange eyes and coral legs, carrying a teal satchel of stolen raspberry flowers. It struts, rears back and jabs with its beak while flinging a flower.',
        clips={'idle': 'breathing, suspicious looks, blink, swaying satchel (3.0 s loop)', 'move': 'high-stepping strut with head bob (0.9 s loop)',
               'attack': 'crest up 0.3 s, rears back with wings flared to 1.12 s, beak jab and flower fling at 1.25 s (2.0 s)', 'hit': 'feathers puff, eyes squeezed (0.7 s)',
               'defeat': 'dizzy wobble, plops down to sit with flowers spilled; held from 1.8 s (2.4 s)'}),
    'demon-idol-drummer': dict(title='Demon Idol Drummer', cast='Big Stage cast', related='demon-band-idol', period='besties-obby-v1',
        description='A cheeky toy-demon idol with swept magenta hair, small plum horns, a teal jacket over a star shirt, plum baggy pants, white boots and a raspberry snare. He drums while waiting, then slams the drum and sends out a golden beat ring.',
        clips={'idle': 'alternating stick taps on the drumhead, head bob, smug brow (2.0 s loop)', 'move': 'swaggering jog with taps (0.8 s loop)',
               'attack': 'sneer 0.25 s, sticks overhead and tremble to 1.12 s, drum slam at 1.25 s, beat rings peak 1.42 s and 1.75 s (2.0 s)', 'hit': 'head snaps back, sticks flail (0.7 s)',
               'defeat': 'dizzy spin, sits with the drum in his lap; held from 1.8 s (2.4 s)'}),
}
assets = []
for aid, e in ENEMIES.items():
    d = f'{M}/{aid}/v001'; con = json.loads((REPO / d / 'construction.json').read_text()); three = json.loads((REPO / d / 'three-inspection.json').read_text())
    assets.append({'id': aid, 'title': e['title'], 'category': 'family-eras', 'review': f'docs/assets/reviews/{aid}/v001.md',
        'concept_images': [f'{d}/concept.png', f'{d}/concept-vs-model.png'],
        'model_images': [f'{d}/{v}.png' for v in ('beauty', 'front', 'side', 'back', 'threequarter', 'action-windup', 'action-contact', 'action-hit', 'action-defeat', 'motion-contact-sheet', 'attack-gameplay-scale')],
        'models': [f'{d}/{aid}.glb'], 'audio': [], 'thumbnail': None, 'version': 'v001',
        'state': 'completed model candidate from the coordinator-generated October 4 construction reference; awaiting Tom\'s exact-version review; technically checked for the family release under PRD-004 Q-03',
        'gameplay_use': 'private-candidate', 'checksums': files(d),
        'intake': {'description': e['description'], 'cast': e['cast'], 'related_era_identity': e['related'], 'suggested_period_id': e['period'], 'suggested_role': 'ordinary',
                   'design': 'DESIGN-029', 'glb_sha256': con['files'][aid + '.glb']['sha256'], 'master_sha256': con['files'][aid + '.blend']['sha256'],
                   'parody_motion': {'contactFraction': 0.625, 'height': three['height_m']}, 'runtime_url': f'/studio/assets/media/{aid}/v001/{aid}.glb',
                   'clips': {n: {'duration_s': c['duration_s'], 'loop': c['loop'], 'notes': e['clips'][n]} for n, c in ((c['name'], c) for c in con['clips'])},
                   'triangles': con['triangles'], 'materials': 2, 'joints': con['bones'], 'facing': 'glTF -Z, like every enemy GLB',
                   'culling_envelope_y_up': three['exported_envelope']}})
kd = f'{M}/storybook-planting-kit/v001'; kcon = json.loads((REPO / kd / 'construction.json').read_text())
KIT = {'storybook-canopy-tree': ('Storybook canopy tree', 'A broad canopy tree about 4 m tall: crooked faceted ochre trunk with root flares and three layered green-and-lime leaf crowns.', 'garden beds, safe-pad backdrops, casino/stage potted accents at reduced scale'),
       'storybook-cypress': ('Storybook cypress', 'A slim deep-teal cypress about 3 m tall with an S-curved trunk and a drooping, tapered crown.', 'tall vertical accents behind route pads and along garden edges'),
       'storybook-flowering-shrub': ('Storybook flowering shrub', 'A low 0.8 m flowering shrub of broad leaves with raspberry and cream five-petal flowers.', 'near-route beds and planters; keep outside movement corridors and landing areas')}
for pid, (title, desc, use) in KIT.items():
    assets.append({'id': pid, 'title': title, 'category': 'world-and-keepsakes', 'review': f'docs/assets/reviews/storybook-planting-kit/v001.md#{pid}',
        'concept_images': [f'{kd}/concept.png', f'{kd}/concept-vs-model.png'],
        'model_images': [f'{kd}/stills/{pid}-{v}.png' for v in ('beauty', 'front', 'side', 'back', 'threequarter')] + [f'{kd}/kit-lineup.png', f'{kd}/kit-garden.png'],
        'models': [f'{kd}/{pid}.glb'], 'audio': [], 'thumbnail': None, 'version': 'v001',
        'state': 'completed static model candidate from the coordinator-generated October 4 planting construction reference; awaiting Tom\'s exact-version review; technically checked for the family release under PRD-004 Q-03',
        'gameplay_use': 'private-candidate', 'checksums': {k: v for k, v in files(kd).items() if ('/stills/' not in k or pid in k)},
        'intake': {'kit_id': 'storybook-planting-kit', 'description': desc, 'suggested_use': use, 'design': 'DESIGN-029', 'glb_sha256': kcon['files'][pid + '.glb']['sha256'],
                   'kit_master_sha256': kcon['files']['storybook-planting-kit.blend']['sha256'], 'triangles': kcon['props'][pid]['triangles'], 'draw_calls': 1,
                   'shared_material': kcon['material'], 'planning_box_half_x_height_half_z_m': kcon['planning_boxes_half_x_height_half_z'][pid],
                   'runtime_url': f'/studio/assets/media/storybook-planting-kit/v001/{pid}.glb', 'orientation': 'glTF +Y up, identity root, base centred on the ground origin, no soil disc'}})
out = {'work_order': '20261004-opus-action-minions-b', 'pack': 'action-minions-b', 'version': 'v001', 'schema': 'catalog-inventory.json asset entries plus an intake block per asset',
       'note': 'Coordinator-owned integration: catalog.md cards, catalog-inventory.json entries/counts, parody-catalog.ts registration, scene-catalog parodyMotion and theme placement. Suggested periods are proposals only.',
       'assets': assets}
(Path(__file__).parent / 'catalog-intake.json').write_text(json.dumps(out, indent=2) + '\n')
print(json.dumps({'entries': len(assets), 'ids': [a['id'] for a in assets]}))
