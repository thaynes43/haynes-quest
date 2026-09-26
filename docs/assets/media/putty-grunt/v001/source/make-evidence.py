"""WO111 putty-grunt: exact-byte provenance, tool settings, bounds and factual author review handoff.
Adapted from the inator-monster and rival-mayor v001 evidence scripts."""
from pathlib import Path
import json, hashlib, datetime
ROOT = Path('/home/dev/artifacts/haynes-quest/family-eras/putty-grunt/v001')
SOURCE = Path(__file__).resolve().parent
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
digest = sha(ROOT / 'putty-grunt.glb')
construction = json.loads((ROOT / 'construction.json').read_text())
three = json.loads((ROOT / 'three-inspection.json').read_text())
browser = json.loads((ROOT / 'final-preview/browser-inspection.json').read_text())
validation = json.loads((ROOT / 'validation.json').read_text())
attachments = json.loads((ROOT / 'attachment-inspection.json').read_text())
for report in [three, browser, validation, attachments]:
    assert report.get('glb_sha256', report.get('sha256')) == digest
    assert all(report['checks'].values())
assert construction['files']['putty-grunt.glb']['sha256'] == digest
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
common = {'work_order': 'WO111', 'asset_id': 'putty-grunt', 'version': 'v001', 'created_utc': now, 'glb_sha256': digest,
          'candidate_status': "Awaiting Tom's review · used in the family release"}
clip = {c['name']: c for c in construction['clips']}
eyes = json.loads((ROOT / 'source/rig-rest.json').read_text())['layout']['eyes']
g = three['guard']; held = three['defeat_held']; contact = next(b for b in three['attack_beats'] if abs(b['time_s'] - 1.25) < 1e-9)
provenance = {**common,
    'authoring_agent': 'Claude Opus 5.5 (claude-opus-5-5, xhigh) Blender author under the PLAN-019 coordinator; Tom ruled on Sept 26 that Claude Opus 5.5 does the WO111 Blender work. Two sessions of the same task: the first built the clay, bake and rig pipeline to a geometry checkpoint and stopped at its plan usage limit without releasing the lease; the second continued under the same lease (scene-lease.json "continuations"), finished the rig, the five clips, the export and the evidence, and released the scene.',
    'authoring_tool': 'Blender MCP execute_blender_code on the second isolated authoring service (blender-authoring-2), driven by a small streamable-HTTP JSON-RPC client (source/transfer.py); instance 1 was not used',
    'blender_version': construction['blender_version'],
    'source_reference': {'kind': 'Blender reference sheet, no generated concept', 'file': 'reference-sheet.png', 'sha256': sha(ROOT / 'reference-sheet.png'), 'notes': 'reference-notes.md', 'notes_sha256': sha(ROOT / 'reference-notes.md'),
        'blockout_master': 'putty-grunt-blockout.blend', 'blockout_sha256': sha(ROOT / 'putty-grunt-blockout.blend'),
        'coordinator_review': 'Approved Sept 26 (SHEET-REVIEWS.md): goofy lavender clay grunt with thumbprint dents, a clay-coil belt, blank round eyes, a pinched antenna and mitten fists. For play-distance read, make the eyes slightly larger and the belt buckle a warmer gold. Attack: clumsy double-fist swing; defeat: melts into a flopped clay puddle with the antenna still wiggling, held.',
        'generator': 'None. The sheet is a Cycles render of a procedural Blender blockout; no image-generation model was used for this asset.'},
    'source_scripts': {p.name: sha(p) for p in sorted(SOURCE.iterdir()) if p.suffix in ['.py', '.mjs', '.json', '.sh'] and p.is_file()},
    'original_work': ['The blockout supplied the metaball clay recipe, measured coordinates, colours and parody hooks; the final clay surface, topology, UVs, baked atlas, bone-heat weights, the 27-bone rig and all five clips are new.',
        'Original 1024 RGB atlas baked in Blender (Cycles CPU) from this procedural clay: emission colour from the 99k-triangle high-resolution clay and its painted decals (thumbprint patches and whorl ridges, the lopsided grin, the tongue patch) at 2048 px, box-filtered to 1024, times soft occlusion baked from the low-poly character; the eyes, tongue tip, belt coil and warm-gold buckle use flat painted tiles of the same atlas. No external texture.',
        'Mesh, UV, transfer and validation utilities adapted from the WO111 inator-monster, mischief-kitten, rival-mayor, gadget-helper / honk-bus and Rat Casino authoring scripts and the putty-grunt sheet scripts.'],
    'excluded_inputs': ['No family photos, names, birthdays or likenesses.', 'No copied franchise names, models, faces, logos, costumes, lettering, catchphrases, jingles, recordings or textures. The chest carries a thumbprint instead of any emblem; no lettering anywhere on the model.'],
    'rights_note': 'Original authored study. No exclusive-rights or franchise-endorsement claim.',
    'scope': 'Technical candidate delivery. The coordinator owns catalog publication and runtime integration; the owner exact-version and physical-device review remain open.'}
settings = {**common,
    'blender': {'version': construction['blender_version'], 'instance': 'blender-authoring-2', 'units': 'METRIC', 'unit_scale': 1, 'authoring_axes': '+Z up / +Y forward (character right = +X)', 'frames_per_second': 30, 'animation_mode': 'NLA_TRACKS',
        'clay': 'One metaball clay family (the blockout recipe) voxel-remeshed at %.4f m, thumbprint dimples pressed, a low-frequency CLOUDS Displace applied (soles kept flat); low-poly skin = uniform voxel start shrink-wrapped back onto the clay, then a protected collapse (fists, toes, face) to %d triangles, high-resolution shading normals transferred' % (construction['metaball_resolution_m'] * 0.9, construction['body_triangles']),
        'skin': 'Bone-heat (automatic) weights on the continuous clay body for the 18 body bones (0 fallback vertices), a soft pot-belly squash region (%d vertices), rigid weights on the eyes, brows, tongue, antenna, belt and buckle; limited to 4 influences and normalised' % construction['belly_weighted_vertices'],
        'rig': 'root, hips, spine, belly, chest, head, antenna_root, antenna_1, antenna_2, eye_R, eye_L, tongue, belt, shoulder/upper_arm/forearm/fist x2, thigh/shin/foot x2 (27 joints). The legs hang from the root.',
        'root': 'Identity, fixed floor-centred root; no root animation; the hips translate for the bounce, waddle, lunge, recoil and the melt',
        'bind_pose': 'Rig-friendly A-pose rest (head straight, arms relaxed, the sheet bow-legged stance) as the sheet notes suggest; the sheet guard is recreated at idle 0 s and every clip except move starts from it',
        'squash_and_stretch': 'Bone scale, exported as glTF scale channels. Every basis is exactly T x R x S (max matrix error %.1e). Counter-scaled sockets keep the eyes, the antenna and the fists (under the stretching arms) in shape; the belt keeps its coil thickness in the puddle. Blender-evaluated skin matches three.js skinning to %.1e m at 5 frames per clip.' % (construction['basis_trs_max_error'], three['skinning_fidelity']['max_error_m']),
        'guards': 'Legs are two-bone world IK with an analytic toe or heel pivot; a numeric floor guard skins the exact mesh every frame (linear blend skinning, as three.js does) and lifts the whole pose above a 2.5 mm contact plane when needed (lifts per clip in construction.json floor_guard, all at most 1.6 mm).'},
    'export': {'format': 'GLB', 'axes': '+Y up / -Z forward', 'selection_only': True, 'materials': {'0': 'Matte hand-worked clay (opaque, baked atlas region)', '1': 'Satin blank eyes, tongue and warm-gold buckle (opaque, flat atlas tiles)'},
        'texture': {'file': 'pigment.png', 'width': 1024, 'height': 1024, 'embedded': True, 'images': 1, 'bytes': construction['texture']['bytes']}, 'no_external_resources': True, 'no_required_extensions': True, 'compression': 'None; no Draco, Meshopt or KTX2 requirement'},
    'preview': {'source': 'Exact delivered GLB via Three.js GLTFLoader', 'three_revision': three['three_revision'], 'browser': browser['browser'], 'renderer': browser['renderer'], 'viewport_px': [900, 900],
        'orthographic_camera': {'half_height_m': 0.85, 'px_per_m': 529.4, 'targets': {'front': [0, 0.75, 0], 'side': [0, 0.75, 0], 'back': [0, 0.75, 0], 'threequarter': [0, 0.75, 0], 'beauty': [0, 0.65, 0]}, 'views': {'front': [0, 0.75, -8], 'side': [8, 0.75, 0], 'back': [0, 0.75, 8], 'threequarter': [5.657, 0.75, -5.657], 'beauty': [4.2, 2.9, -7.2]}},
        'gameplay_camera': 'Perspective 48 deg, 7.9 m out and 2.62 m high at azimuths 0/45/90/180/-90 deg, looking at 0.9 m', 'lighting': 'Warm hemisphere plus three directional lights; ACES tone mapping exposure 1.0', 'scales': [1, .35], 'no_physical_device_claim': True},
    'checks': {'khronos_zero_errors_warnings': True, 'exact_three_adapter_all_checks': True, 'chromium_all_clips_normal_small': True, 'source_attachment_checks': True}}
visual = {**common,
    'author_review': 'Exact-export front, side, back, three-quarter and beauty stills of the sheet guard (idle 0 s) compared with the reference sheet at the same angles and metric scale (sheet-vs-export.png); bind-pose stills; five-clip normal/small motion sheet; attack front/side overhead-teeter-contact-recovery and 35% gameplay-scale strip; held defeat front/side/three-quarter/beauty/gameplay; gameplay-camera views at five azimuths.',
    'coordinator_review': 'Pending PLAN-019 coordinator intake. Not Tom approval.', 'owner_review': 'Pending exact-version decision',
    'sheet_matching': ['Silhouette kept from the approved blockout at its measured coordinates: the big neckless lumpy-bean head, pot belly, noodly arms with oversized mitten fists, stumpy bow-legged legs on pancake feet with three toe bumps, and the guard (right fist raised in front of the chest, left fist low and out, head tilted 8 deg to its right, antenna leaning with it). Guard bounds %.3f m wide x %.3f m tall x %.3f m deep (sheet 0.80 x 1.40 x 0.52).' % tuple(g['dimensions_m']),
        'Coordinator notes applied: the blank eyes are 12%% larger than the sheet (right %.3f x %.3f m, left %.3f x %.3f m, the right still 17%% bigger); the buckle is a warmer gold (#e9a23a rim, #b97a22 pressed centre, replacing the sheet #dca953 / #b98a35).' % (2 * eyes['R']['size'][0], 2 * eyes['R']['size'][2], 2 * eyes['L']['size'][0], 2 * eyes['L']['size'][2]),
        'Colours are the sheet hex values (atlas); the preview renders them slightly bluer in shadow than the flat Cycles sheet because of its ACES tone mapping and three-light rig. The antenna ball sits at %.3f m in the guard (the stalk is 10%% shorter than the blockout so the bind-pose ball stays inside 1.40 m).' % g['bounds_y_up']['max'][1],
        'Parody hooks kept: the villain\'s clay foot-soldier premise, the thumbprint where a chest emblem would go, thumbprint dents with whorl ridges all over, the rolled clay-coil belt, blank mismatched eyes under a raised "huh?" brow, the tongue-out dopey grin, the pinched antenna and the clumsy mitten fists. No lettering or emblem.'],
    'acting': {'idle': 'Wobbly double bounce in the guard with a clay squash on each dip, two quick "hi-yah" feints of the right fist, the antenna a beat behind, one slow blink (2.0 s loop).',
        'move': 'Bouncy bow-legged waddle-jog: pancake feet squash on each landing, arms pump, the body rocks, the antenna flops (0.8 s loop); feet lift %.3f / %.3f m.' % (three['move']['max_foot_lift_m']['R'], three['move']['max_foot_lift_m']['L']),
        'attack': 'Clumsy double-fist swing (2.0 s): heaves both fists over its head leaning back on its heels (0.55 s), teeters onto its toes, swings both fists down in front; contact 1.25 s with the fists together %.2f m in front at %.2f m height, the clay arms %.0f%% longer and the mitten fists squashed; elastic snap back, windmills its left arm, nearly falls, settles into the guard.' % (-contact['fist_R'][2], contact['fist_R'][1], 100 * (contact['reach_R'] / three['rest_reach_m']['R'] - 1)),
        'hit': 'Poked-clay squash (0.7 s): the body widens and thins, a big belly dent (belly depth down to %.0f%%), eyes squeezed shut, antenna springs, then it wobbles back into the guard.' % (100 * three['hit']['min_belly_depth_ratio']),
        'defeat': 'Jolts, teeters back with its arms flying up, then melts into a flopped clay puddle (2.4 s, held from 2.0 s): body top %.3f m, head blob %.3f m, the round blank eyes up to %.3f m, the belt ring on the rim and the antenna sticking up to %.3f m after wiggling.' % (held['body_top_m'], held['head_top_m'], held['eye_top_m'], held['antenna_top_m'])},
    'author_corrections': ['First session (geometry): an adaptive collapse straight from the 99k-triangle clay spent the budget on the hand-worked lumps and left the head and belly with 6 cm silhouette facets; replaced by a uniform voxel start shrink-wrapped back onto the clay and a protected collapse. The face became one front-planar UV island so the painted grin never straddles a seam; the mitten fists were enlarged 7% and small thumbprints got fewer, wider whorl turns so they survive the atlas at play distance.',
        'Legs moved under the root so the hips squash never rescales them and the leg IK stays exact in world space.',
        'The first buckle (an open ring with a recessed plug) read as a donut with a slot in exact-GLB close-ups; rebuilt as a solid warm-gold disc with a raised rim and a darker pressed centre.',
        'Contact first landed the fists about 0.2 m above the floor at the knees; the swing now ends nearly level in front of the lean, at about hip height.',
        'The first puddle spread the arms beyond 1.6 m; flopping them lower then pushed the fists through the floor and the floor guard lifted the whole puddle 10.7 cm. The arms now lie level and closer, and every clip lifts at most 1.6 mm.',
        'The jog fists clipped the thighs (13 right and 11 left of 25 move frames, then 3); the swing now arcs wider on the back stroke (0 overlapping frames).',
        'Arm stretch at contact first measured 53% (the forearm inherits the upper-arm scale); reduced to about 25% to match the notes\' "about 30% longer" clumsy bonk.',
        'Eyes never rotate under a flattened parent (a counter-scaled rotated eye shears); the puddle eyes stay round and pop 8% wider instead. The antenna droop was reduced so it still sticks up out of the puddle.'],
    'deviations_from_sheet_notes': ['The notes suggested a single overhead right-fist bonk; the coordinator review and brief ask for a clumsy double-fist swing, which the attack performs (with the notes\' elastic snap-back, near fall and windmilling left arm).',
        'In the defeat the model melts forward-down into a puddle rather than tipping fully onto its back, so the eyes face the player\'s follow camera (the grunt usually faces the player); the brows, grin and tongue stay readable on the head blob.'],
    'dimensions_width_height_depth_m': three['dimensions_m'], 'rest_bounds_y_up': three['rest_bounds_y_up'], 'guard_bounds_y_up': g['bounds_y_up'], 'animated_bounds_y_up': three['all_animation_bounds_y_up'], 'stored_safe_culling_bounds': three['exported_safe_bounds_y_up'],
    'contact_seconds': clip['attack']['contact_time_s'], 'attack_duration_seconds': clip['attack']['duration_s'], 'defeat_held_from_seconds': clip['defeat']['held_final_pose_from_s'],
    'defeat_held': held, 'no_floor_penetration': three['checks']['no_floor_penetration'],
    'limitations': ['Headless software Chromium is not physical Safari or hardware performance acceptance.', 'The attachment audit tests listed part pairs on the source scene; it is not a universal triangle-collision proof. The continuous clay body is never tested against itself; the fists touching at the attack contact are intended; the melt merges the clay by design, so defeat overlaps are tested only before it.',
        'In the game the windup phase scrubs the attack clip from 0 to the 1.25 s contact, so the raise, teeter and swing play at the simulation windup speed.', 'Non-uniform bone scale is exported as glTF scale channels; any runtime that ignores node scale would lose the squash, stretch and melt.',
        'Owner final-art review and runtime integration are separate from this authoring handoff.']}
bounds = {**common, 'method': three['method'], 'rest_bounds_y_up': three['rest_bounds_y_up'], 'dimensions_width_height_depth_m': three['dimensions_m'], 'height_m': three['height_m'],
    'guard_bounds_y_up': g['bounds_y_up'], 'guard_dimensions_width_height_depth_m': g['dimensions_m'],
    'feature_heights_m': {'antenna_ball_top_bind': round(three['height_m'], 4), 'antenna_ball_top_guard': round(g['bounds_y_up']['max'][1], 4), 'head_crown_blockout': 1.292},
    'sole_clearance_m': three['sole_clearance_m'], 'body_footprint_y_up': three['body_footprint_y_up'], 'all_animation_bounds_y_up': three['all_animation_bounds_y_up'], 'safe_culling_envelope_y_up': three['exported_safe_bounds_y_up'],
    'defeat_held': held,
    'note': 'glTF axes: +Y up, character faces -Z; its right hand is +X. Root at the floor origin under the body. The bind pose is an A-pose (arms out to 0.59 m); the guard every clip starts from is 0.80 m wide. The held defeat puddle is %.2f m wide x %.2f m deep and at most %.3f m tall (antenna).' % (held['footprint_m'][0], held['footprint_m'][2], held['height_all_m'])}
for name, record in [('provenance.json', provenance), ('tool-settings.json', settings), ('visual-review.json', visual), ('bounds.json', bounds)]:
    (ROOT / name).write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps({'glb_sha256': digest, 'reports': ['provenance.json', 'tool-settings.json', 'visual-review.json', 'bounds.json'], 'all_technical_checks': True}))
