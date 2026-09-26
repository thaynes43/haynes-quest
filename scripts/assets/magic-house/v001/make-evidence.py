"""WO111 magic-house: exact-byte provenance, tool settings, bounds, factual author review and the delivery record."""
from pathlib import Path
import json, hashlib, datetime
ROOT = Path('/home/dev/artifacts/haynes-quest/family-eras/magic-house/v001')
SOURCE = Path(__file__).resolve().parent
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
digest = sha(ROOT / 'magic-house.glb')
construction = json.loads((ROOT / 'construction.json').read_text())
three = json.loads((ROOT / 'three-inspection.json').read_text())
browser = json.loads((ROOT / 'final-preview/browser-inspection.json').read_text())
validation = json.loads((ROOT / 'validation.json').read_text())
attachments = json.loads((ROOT / 'attachment-inspection.json').read_text())
for report in [three, browser, validation, attachments]:
    assert report.get('glb_sha256', report.get('sha256')) == digest
    assert all(report['checks'].values())
assert construction['files']['magic-house.glb']['sha256'] == digest
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
common = {'work_order': 'WO111', 'asset_id': 'magic-house', 'version': 'v001', 'created_utc': now, 'glb_sha256': digest, 'candidate_status': "Awaiting Tom's review · used in the family release"}
attack = next(c for c in construction['clips'] if c['name'] == 'attack'); defeat = next(c for c in construction['clips'] if c['name'] == 'defeat')
r3 = lambda xs: [round(x, 3) for x in xs]
rest = three['rest_bounds_y_up']; anim = three['all_animation_bounds_y_up']
provenance = {**common,
    'authoring_agent': 'Claude Opus 5.5 (claude-opus-5-5, xhigh) Blender author under the PLAN-019 coordinator; Tom ruled on Sept 26 that Claude Opus 5.5 does the WO111 Blender work',
    'authoring_tool': 'Blender MCP execute_blender_code on the second isolated authoring service (blender-authoring-2), driven by a small streamable-HTTP JSON-RPC client (source/transfer.py). Its MCP Host allowlist only names instance 1, so the client sends Host: localhost:8000 to instance 2\'s own service address (thaynes43/haynes-ops#3209).',
    'blender_version': construction['blender_version'],
    'source_reference': {'kind': 'Blender reference sheet, no generated concept', 'file': 'reference-sheet.png', 'sha256': sha(ROOT / 'reference-sheet.png'),
                         'notes': 'reference-notes.md', 'notes_sha256': sha(ROOT / 'reference-notes.md'),
                         'blockout_master': 'magic-house-blockout.blend', 'blockout_sha256': sha(ROOT / 'magic-house-blockout.blend'),
                         'coordinator_review': 'Approved Sept 26 (SHEET-REVIEWS.md): keep the shutter eyes, the door mouth with doormat tongue, the hopping ridge tiles and the legs; the attack is a shimmy/hop that throws tiles; defeat is a sheepish slump with the shutters closing.',
                         'generator': 'None. The sheet is a Cycles render of a procedural Blender blockout; no image-generation model was used for this asset.'},
    'source_scripts': {p.name: sha(p) for p in sorted(SOURCE.iterdir()) if p.suffix in ['.py', '.mjs', '.json', '.sh'] and p.is_file()},
    'original_work': ['Final topology, UVs, weights, the 32-bone rig and all five clips are new; the blockout supplied measured coordinates, colours and parody hooks only.',
                      'Original deterministic 1024 palette atlas generated in Blender Python from the sheet colours: 32 flat swatches plus painted barrel-tile rows with empty timber slots, shutter louvres, door planks with a coral flower and panel line, and doormat stripes.',
                      'Mesh, UV, transfer and validation utilities adapted from the WO111 rival-mayor / gadget-helper / honk-bus and Rat Casino authoring scripts.'],
    'excluded_inputs': ['No family photos, names, birthdays or likenesses.', 'No copied franchise names, models, faces, logos, architecture, symbols, lettering, recordings or textures.'],
    'rights_note': 'Original authored study. No exclusive-rights or franchise-endorsement claim.',
    'scope': 'Technical candidate delivery. The coordinator owns catalog publication and runtime integration; the owner exact-version and physical-device review remain open.'}
settings = {**common,
    'blender': {'version': construction['blender_version'], 'instance': 'blender-authoring-2', 'units': 'METRIC', 'unit_scale': 1, 'authoring_axes': '+Z up / +Y forward (the house faces +Y; its right = +X)',
                'frames_per_second': 60, 'animation_mode': 'NLA_TRACKS', 'interpolation': 'LINEAR keys on every frame',
                'skin': 'One skin; rigid parts plus two-weight smoothstep blends on the stumps (leg to body) and along the three-bone doormat tongue',
                'root': 'Identity, fixed floor-centred root; no root animation; the body, roof, legs, dancing tiles, pupils and butterflies translate',
                'bind_pose': 'The approved sheet pose (tiles hovering, doors open 140 degrees, sly/cheeky lids)'},
    'export': {'format': 'GLB', 'axes': '+Y up / -Z forward', 'selection_only': True, 'materials': 2, 'material_notes': 'Matte (roughness 0.86) plus a warm candle material whose emissive texture is the same atlas at factor 0.25; KHR_materials_specular is used, not required',
               'texture': {'file': 'pigment.png', 'width': 1024, 'height': 1024, 'embedded': True, 'bytes': (ROOT / 'pigment.png').stat().st_size}, 'no_external_resources': True, 'no_required_extensions': True, 'compression': 'None; no Draco, Meshopt or KTX2 requirement'},
    'preview': {'source': 'Exact delivered GLB via Three.js GLTFLoader', 'three_revision': three['three_revision'], 'browser': browser['browser'], 'renderer': browser['renderer'], 'viewport_px': [800, 900],
                'orthographic_camera': {'left': -1.6, 'right': 1.6, 'top': 1.8, 'bottom': -1.8, 'target': [0, 1.55, 0], 'pixels_per_metre': 250,
                                        'views': {'front': [0, 1.55, -10], 'side': [10, 1.55, 0], 'back': [0, 1.55, 10], 'threequarter': [7.071, 1.55, -7.071], 'beauty': [5.2, 4.6, -8.6], 'wide': [7.5, 3.2, -5.5]}},
                'lighting': 'Warm hemisphere plus three directional lights; ACES tone mapping exposure 1.0', 'scales': [1, .35], 'no_physical_device_claim': True},
    'checks': {'khronos_zero_errors_warnings': True, 'exact_three_adapter_all_checks': True, 'chromium_all_clips_normal_small': True, 'source_attachment_checks': True}}
visual = {**common,
    'author_review': 'Exact-export front, side, back, three-quarter and beauty stills compared with the reference sheet at the same angles and metric scale (sheet-vs-export.png); five-clip normal/small motion sheet; attack front/side/wide windup-contact-recovery and the 35% gameplay-scale strip; held defeat front/side/three-quarter/beauty; close-ups of the face, candle niche, roof, feet and tongue.',
    'coordinator_review': 'Pending PLAN-019 coordinator intake. Not Tom approval.', 'owner_review': 'Pending exact-version decision',
    'sheet_matching': ['Every part keeps the blockout\'s measured coordinates: 2.898 m to the top of the hopping ridge tile, 2.80 m solid, the same eaves, balcony, tongue and legs; silhouettes overlay the sheet views at matching scale.',
                       'The roof is two corrugated sheets (13 columns x 7 rows) with the tile rows, crest light, channel shadow and row-end lines painted; the five popped tiles leave flattened timber slots exactly where the sheet shows them, plus the chimney pass-through.',
                       'Sly/cheeky expression kept: the house\'s left lid lowered with its inner edge down, its right lid raised with its inner edge up, pupils glancing to its right.',
                       'Colours are the sheet hex values (atlas level 4 is the exact hex); the preview renders them lighter and less saturated than the Cycles Standard-view sheet because of its ACES tone mapping and three-light rig, and the sheet also carries Freestyle ink outlines.',
                       'Parody hooks intact: living casita, shutter eyes, grinning door mouth with a striped doormat tongue, dancing roof tiles, candle niche, butterflies, balcony, bougainvillea and stump legs.'],
    'acting': {'idle': 'Tiles bob in a ripple, the lids blink out of step, the house sways on its stumps, the candle flickers, butterflies flutter.',
               'move': 'Waddle-hop: feet lift 0.10 m in turn and swing, the body bobs and rolls toward the planted foot, the doors flap, the tongue swings, tiles bounce with lag.',
               'attack': 'Shimmy (0.08-0.58 s), crouch and lean back with the six tiles raised 0.40-0.46 m and spun, lids flung up, doors and shutters wide; held warning 0.60-1.05 s. Hop (feet 0.10 m off the floor at 1.15 s) and throw: the tiles arc over the eaves and land flat in a fan 1.05-1.90 m in front at contact 1.25 s while the house lands and the doormat tongue slaps 1.29 m forward; the tiles hop and slide, then fly back over the roof to their slots by 1.90 s.',
               'hit': 'Shutters slam shut and spring open, the doors slam, the roof pops 0.06 m like a pot lid, tiles jump, jelly wobble.',
               'defeat': 'Surprise pop, then the magic drains: the tiles drop into their empty slots with one rebound, the candle shrinks to a 28% ember, the lids close to a sheepish squint and the side shutters swing half shut, the doors pout, the house slumps 0.075 m and leans on splayed stumps, the roof tips forward like a floppy hat, the tongue flops out and the butterflies settle; exactly static from 1.80 s.'},
    'author_corrections': ['The 44,958-triangle blockout became 12,122 triangles: tile rows, louvres, door flowers and doormat stripes moved into the atlas; flowers became low-poly clumps.',
                           'The sky tile touched the chimney hat in the blockout; it now hovers 0.22 m clear, so its bob, jump and spin never pass through the chimney. Its empty slot is unchanged.',
                           'The doormat curl radius grew from 0.07 to 0.08 m so the mat clears the bevelled step edge by 1 cm (the audit found rest contact).',
                           'The blockout candle flame lathe had its (z, r) pairs swapped into a flat 0.25 m disc; the model uses the intended 0.125 m teardrop flame. The glow halo moved 4 mm forward out of the niche back.',
                           'Emissive strength lowered to 0.25 after the first preview showed the flame and halo washing out to white under ACES.',
                           'The first straight tile-throw arcs clipped the eaves and ridge caps; the throw and recall now follow quadratic Bezier paths over the roof, two landing spots were swapped and the recall is staggered so no two tiles meet.',
                           'Closing lids keep their slant and stretch until the lowest corner rests at 1.265 m, with the pupils lifting 6 cm behind them; an untilt rotation swung the lid corners into the side shutters and was dropped. Side-shutter closing is limited to 1.0 rad (hit) and 1.15 rad (defeat) to clear the lids.',
                           'The defeat roof tips about a pivot just behind the front gable: the gable rises at most 2.4 cm into the 7 cm deck (the first droop reached 6.2 cm).',
                           'Keys moved from 30 to 60 fps after the held-warning end and the 1.25 s contact fell between 30 fps keys.',
                           'Roof painting darkened one level with dark row-end lines after the sheet comparison.'],
    'deviations_from_sheet_notes': ['The attack is the coordinator\'s shimmy/hop tile throw; the notes\' tongue sweep survives as a secondary tongue slap at contact.',
                                    'Defeat follows the coordinator (sheepish slump with the shutters closing). Of the notes\' ideas the tiles drop into their slots, the candle becomes an ember and the tongue flops out; the roof tips forward like a floppy hat instead of tiles sliding over the eyes.',
                                    'No jaw bone: the honey doors act as the lips (they slam in hit and pout in defeat), which avoided the lower lip passing through the floor slab.',
                                    'Both butterflies are kept (four wing bones), well inside the budget.'],
    'dimensions_width_height_depth_m': three['dimensions_m'], 'rest_bounds_y_up': rest, 'animated_bounds_y_up': anim, 'stored_safe_culling_bounds': three['exported_safe_bounds_y_up'],
    'contact_seconds': attack['contact_time_s'], 'attack_duration_seconds': attack['duration_s'], 'held_warning_seconds': attack['held_warning_s'], 'defeat_held_from_seconds': defeat['held_final_pose_from_s'],
    'defeat_held': three['defeat_held'], 'hit_slam': three['hit_slam'], 'no_floor_penetration': three['checks']['no_floor_penetration'],
    'limitations': ['Headless software Chromium is not physical Safari or hardware performance acceptance.',
                    'The attachment audit tests listed part pairs every frame on the source scene; it is not a universal triangle-collision proof. Intended contacts (hinges inside their frames, the tongue root inside the mouth, stump tops inside the slab, the chimney through the roof, dropped tiles resting in their slots) are not tested.',
                    'In the game the windup phase scrubs the attack clip from 0 to the 1.25 s contact, so the shimmy, raise, hold and throw play at the simulation windup speed. The thrown tiles are skinned geometry that returns to the roof; any damage area in front of the house is the coordinator\'s gameplay decision.',
                    'Owner final-art review and runtime integration are separate from this authoring handoff.']}
bounds = {**common, 'method': three['method'], 'rest_bounds_y_up': rest, 'dimensions_width_height_depth_m': three['dimensions_m'], 'height_m': three['height_m'],
          'height_solid_m': 2.80, 'sole_clearance_m': three['sole_clearance_m'], 'legs_footprint_y_up': three['legs_footprint_y_up'], 'wall_band_y_up': three['wall_band_y_up'],
          'all_animation_bounds_y_up': anim, 'safe_culling_envelope_y_up': three['exported_safe_bounds_y_up'],
          'note': 'glTF axes: +Y up, the house faces -Z; its right (balcony) is +X. Root at the floor origin under the floor slab centre. The house is wider than tall-boss norms: 2.51 m wide (balcony pots to eave tiles) x 1.98 m deep (back eave to tongue tip). Animated bounds include the thrown tiles (up to 2.10 m in front and 3.80 m high at the top of the throw arc).'}
delivery = {'assetId': 'magic-house', 'version': 'v001', 'role': 'boss', 'world': 'B', 'chapter': 2,
            'glb': 'docs/assets/media/magic-house/v001/magic-house.glb (not yet published; durable copy at %s/magic-house.glb)' % ROOT, 'sha256': digest,
            'heightM': round(three['height_m'], 3), 'bounds': {'rest': {'min': r3(rest['min']), 'max': r3(rest['max'])}, 'animated': {'min': r3(anim['min']), 'max': r3(anim['max'])}, 'safeCulling': three['exported_safe_bounds_y_up']},
            'attackContactS': attack['contact_time_s'], 'clips': [c['name'] for c in construction['clips']], 'prMerged': None,
            'triangles': validation['triangles'], 'bytes': validation['bytes'], 'materials': len(validation['materials']), 'joints': len(validation['joints']),
            'source': 'Blender reference sheet, no generated concept', 'status': "Awaiting Tom's review · used in the family release"}
for name, record in [('provenance.json', provenance), ('tool-settings.json', settings), ('visual-review.json', visual), ('bounds.json', bounds), ('delivery-record.json', delivery)]:
    (ROOT / name).write_text(json.dumps(record, indent=2, ensure_ascii=False) + '\n')
print(json.dumps({'glb_sha256': digest, 'reports': ['provenance.json', 'tool-settings.json', 'visual-review.json', 'bounds.json', 'delivery-record.json'], 'all_technical_checks': True}))
