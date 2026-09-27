"""WO111 lab-robot: exact-byte provenance, tool settings, bounds and factual author review handoff.
Adapted from the radio-host-showman v001 make-evidence.py. Run after the final fetch, inspect-three, preview and compare."""
from pathlib import Path
import json, hashlib, datetime
ROOT = Path('/home/dev/artifacts/haynes-quest/family-eras/lab-robot/v001')
SOURCE = Path(__file__).resolve().parent
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
digest = sha(ROOT / 'lab-robot.glb')
construction = json.loads((ROOT / 'construction.json').read_text())
three = json.loads((ROOT / 'three-inspection.json').read_text())
browser = json.loads((ROOT / 'final-preview/browser-inspection.json').read_text())
validation = json.loads((ROOT / 'validation.json').read_text())
attachments = json.loads((ROOT / 'attachment-inspection.json').read_text())
for report in [three, browser, validation, attachments]:
    assert report.get('glb_sha256', report.get('sha256')) == digest
    assert all(report['checks'].values())
assert construction['files']['lab-robot.glb']['sha256'] == digest
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
common = {'work_order': 'WO111', 'asset_id': 'lab-robot', 'version': 'v001', 'created_utc': now, 'glb_sha256': digest, 'candidate_status': "Awaiting Tom's review · used in the family release"}
attack = next(c for c in construction['clips'] if c['name'] == 'attack')
defeat = next(c for c in construction['clips'] if c['name'] == 'defeat')
contact = next(b for b in three['attack_beats'] if abs(b['time_s'] - 1.25) < 1e-9)
provenance = {**common,
    'authoring_agent': 'Claude Opus 5.5 (claude-opus-5-5, xhigh) Blender author under the PLAN-019 coordinator; Tom ruled on Sept 26 that Claude Opus 5.5 does the WO111 Blender work',
    'authoring_tool': 'Blender MCP execute_blender_code on the primary authoring service (blender-authoring, instance 1), driven by a small streamable-HTTP JSON-RPC client (source/mclient.py, source/author_run.py); instance 2 was not touched',
    'blender_version': construction['blender_version'],
    'source_reference': {'kind': 'Blender reference sheet, no generated concept', 'file': 'reference-sheet.png', 'sha256': sha(ROOT / 'reference-sheet.png'), 'notes': 'reference-notes.md', 'notes_sha256': sha(ROOT / 'reference-notes.md'),
        'blockout_master': 'lab-robot-blockout.blend', 'blockout_sha256': sha(ROOT / 'lab-robot-blockout.blend'),
        'coordinator_review': 'Approved Sept 26 (SHEET-REVIEWS.md): a tin-toy lab robot with a big lens eye, a warning light, slinky pincer arms, a self-destruct button and a yanked-out power cord; tank treads. Hero City is spooky level 1 (DESIGN-027), so the lens eye may glow red in dim light. Attack: the warning light spins, then a pincer lunge. Defeat: sparks, the dome pops and it slumps smoking, held.',
        'generator': 'None. The sheet is a Cycles render of a procedural Blender blockout; no image-generation model was used for this asset.'},
    'source_scripts': {p.name: sha(p) for p in sorted(SOURCE.iterdir()) if p.suffix in ['.py', '.mjs', '.json', '.sh'] and p.is_file()},
    'original_work': ['Final topology, UVs, weights, the %d-joint rig and all five clips are new; the approved blockout supplied measured proportions, colours, parody hooks and the sheet-pose coordinates (the slinky arm centrelines, both claw frames, the eyelid tilt, the glance and the cord path) only.' % construction['bone_count'],
        'Original 1024 painted atlas generated with numpy in Blender Python (paint.py): the speaker-grille smile, the camera-aperture iris, the riveted panel and hatch, the seam rivets, the striped kick plate, the hazard ring, the slotted hubcaps, the two gauge dials, the warning light hot spot, the head interior and the button shine, plus flat sheet-colour and glow tiles. No external texture.',
        'Mesh, UV, transfer, validation and evidence utilities adapted from the WO111 radio-host-showman / demon-band-idol / putty-grunt scripts.'],
    'excluded_inputs': ['No family photos, names, birthdays or likenesses.', 'No copied franchise names, models, faces, logos, lettering, recordings or textures; no lettering anywhere on the robot. No teeth, blades, lasers or weapons; the pincers keep ball tips; no gore.'],
    'rights_note': 'Original authored study. No exclusive-rights or franchise-endorsement claim.',
    'scope': 'Technical candidate delivery. The coordinator owns catalog publication and runtime integration; the owner exact-version and physical-device review remain open.'}
settings = {**common,
    'blender': {'version': construction['blender_version'], 'instance': 'blender-authoring (instance 1, primary)', 'units': 'METRIC', 'unit_scale': 1, 'authoring_axes': '+Z up / +Y forward (character right = +X)',
        'frames_per_second': 30, 'animation_mode': 'NLA_TRACKS', 'animation_keys': 'Every frame, linear, exported without keyframe optimisation',
        'skin': 'One skin; rigid tin parts 100%% to one bone each; tent-weighted slinky arms and cord (two influences along each chain); the neck bellows blend body to head (at most %d influences used)' % three['max_skin_influences'],
        'root': 'Identity, fixed floor-centred root; no root animation; the chassis carries the rocking and the slump with its pivots on the tread arcs and the left tread edge',
        'stretch': 'Slinky arms, the cord, the neck pop and the suspension bob are child translations along each parent bone\'s own axis (checked off-axis < 1e-4 m in Three.js and Blender); no bone basis carries shear (max %.1e)' % construction['max_bone_shear'],
        'bind_pose': 'Both slinky arms straight in the same relaxed A-shape, claws half open, eyelid level, iris centred, the cord on its sheet path (rest controls reproduce it, max matrix error %.1e)' % construction['rest_reproduction_max_error'],
        'sheet_pose': 'Idle at 0 s reproduces the blockout sheet pose (claw wrists and arm joints within %.1e m, claw frames, eyelid tilt and glance likewise)' % max(construction['sheet_pose_reproduction'].values())},
    'export': {'format': 'GLB', 'axes': '+Y up / -Z forward', 'selection_only': True, 'materials': 2,
        'glow_material': 'Principled BSDF with the atlas linked to both Base Color and Emission Color, Emission Strength 1.0 (glTF emissiveTexture = the same image, emissiveFactor [1,1,1]; no KHR_materials_emissive_strength)',
        'texture': {'file': 'pigment.png', 'width': 1024, 'height': 1024, 'embedded': True}, 'no_external_resources': True, 'no_required_extensions': True, 'compression': 'None; no Draco, Meshopt or KTX2 requirement'},
    'preview': {'source': 'Exact delivered GLB via Three.js GLTFLoader', 'three_revision': three['three_revision'], 'browser': browser['browser'], 'renderer': browser['renderer'], 'viewport_px': [800, 900],
        'orthographic_camera': {'half_height_m': 0.8, 'px_per_m': 562.5, 'target': [0, 0.65, 0], 'views': {'front': [0, .65, -8], 'side': [8, .65, 0], 'back': [0, .65, 8], 'threequarter': [5.657, .65, -5.657], 'beauty': [4.2, 2.6, -7.2]}},
        'stills_pose': 'Main stills: idle at 0 s (the sheet pose); rest-*.png: the bind pose; dark-*.png: a dim rooftop-night rig (hemisphere 0.12, key lights at 5%) to show the emissive warning light, red eye core, target glare and sparks',
        'lighting': 'Warm hemisphere plus three directional lights; ACES tone mapping exposure 1.0', 'scales': [1, .35], 'no_physical_device_claim': True},
    'checks': {'khronos_zero_errors_warnings': True, 'exact_three_adapter_all_checks': True, 'chromium_all_clips_normal_small': True, 'source_attachment_checks': True}}
visual = {**common,
    'author_review': 'Exact-export front, side, back and three-quarter stills (idle at 0 s = the sheet pose) compared with the reference sheet at the same angles and metric scale (sheet-vs-export.png); rest-pose stills; dim-room glow stills; five-clip normal/small motion sheet; attack front/side tell-windup-contact-recovery and the 35% gameplay-scale strip; held defeat front/side/three-quarter/beauty; close-ups of the face, the chest panel, the back hatch, the treads, the popped lid and the lunge path.',
    'coordinator_review': 'Pending PLAN-019 coordinator intake. Not Tom approval.', 'owner_review': 'Pending exact-version decision',
    'sheet_matching': ['Silhouette kept from the approved blockout at its measured coordinates: the caged amber warning light on a brass base, the pale tin dome head with plum trim, ten brass seam rivets and brass ear discs with steel bolts, the one big camera-lens eye (steel barrel, brass bezel, domed pale-blue glass, blue iris, plum pupil, two cream glints) under the tilted plum eyelid, the plum speaker-grille smile with three brass bars, the plum rubber neck bellows, the tapered teal tin body with the pale riveted control panel, red/blue/amber indicator lights, two brass gauge dials, the candy-red self-destruct button in its brass-and-plum hazard ring and the striped kick plate, four plum louvers per side, the riveted back hatch with its handle and the brass cord grommet, brass shoulder sockets, steel slinky arms and round brass pincer claws with ball tips, the steel swivel waist with its brass ring on the plum crossbar, the plum rubber tank treads with lugs, teal housing plates, steel road wheels and brass hubcaps, and the yanked-out power cord curling up beside the right tread with its brass two-prong plug.',
        'Idle at 0 s reproduces the sheet pose: the raised right claw open in its V, the left claw reaching forward, the eyelid raised 11 deg on its left and the lens glancing low toward its right; both claw wrists within 2.4e-7 m of the blockout in the exact GLB.',
        'Colours are the sheet hex values (atlas). The preview renders colours slightly deeper than the Cycles Standard-view sheet because of its ACES tone mapping; the glowing parts are painted darker than the sheet so lit colour plus emission lands near the sheet amber.',
        'Spooky level 1 per the coordinator note (DESIGN-027): a red core glows in the pupil, so the lens stares red in the dark; during the attack a red target glare opens over the iris; the defeat throws glowing sparks, pops the dome lid and smokes. No teeth, lasers, blades or gore; the pincers keep their ball tips.'],
    'author_corrections': ['Painted regions on boxes (panel and hatch rivets, kick-plate stripes) were first UV-mapped from box-local coordinates and came out blank; boxes are now placed before their UVs.',
        'The small lens glint sat behind the iris shell\'s glass margin; both glints now sit 3.6 mm above the iris shell at its deepest.',
        'Emission washed the amber warning light and the red eye toward pale yellow and salmon in lit rooms; the glow colours are painted darker so lit colour plus emission lands near the sheet amber and a clear red.',
        'The popped dome\'s underside first rendered dark: its base disc shared the hemisphere\'s smooth rim normals and the seam ring\'s bottom cap covered it. The underside is now a flat disc with its own vertices and the seam ring a washer.',
        'Linear joint blending collapsed the slinky chain through the shoulder mid-swing (a segment shrank to 9% of its rest length); arm poses now blend each joint by direction and distance about the shoulder.',
        'The first lunge ran along the body\'s front corner and the spring forward swept the pincer across the lens; the lunge now bows out from the shoulder and the wind-up cocks the pincer forward-up beside the shoulder.',
        'Tread lug corners dipped 0.3 mm below the floor while the chassis rocked on the tread arcs; the lug faces now sit inside the rolling radius.',
        'The defeat tail flop first aimed the curl by minimal rotation and pushed cord vertices 2.4 cm below the floor; the curl now turns rigidly about the floor run\'s own axis.',
        'The held defeat and the attack snap first fell between 30 fps frames, so the hold drifted and the jaws were only half shut at 1.25 s; the hold now starts on frame 57 and the snap completes at 1.22 s.',
        'In the slump both hanging arms passed through the body sides and the drooping head sank into the body top; the hanging arms now bow outward and the head stays 7 cm up on its spring.',
        'The first sparks were small at play distance; they are now 40% larger and spread 12% further.'],
    'deviations_from_sheet_notes': ['The sheet notes describe a kid-safe robot with no smoke, sparks or scary eye; the coordinator\'s Sept 26 model notes (Hero City spooky level 1, DESIGN-027) supersede them: the red eye core and target glare, the sparks, the popped dome and the smoke. No gore.',
        'Warning light spin: the notes suggested a reflector fin inside the glass or a scale pulse. The amber glass is opaque (two materials only), so the spin reads through a painted hot spot on the glowing amber dome and the rotating cage wires; the flashes are scale pulses. The beep-beep cue belongs to the audio lane (DESIGN-008).',
        'The cord binds on its sheet path instead of lying straight back, so the bind pose and idle 0 s share it; its curl wags about the floor base and its floor run stays world-fixed.',
        'Eye acting: the iris shell scales for focus and turns about the glass\'s centre of curvature for glances; its depth profile is shaped for scales down to 0.55 (the "dot"), so at full size it sits up to about 6 mm proud of the glass at its rim. The blink is a camera-shutter half blink (the lid scales down about its top edge to just below the pupil); a full blink would leave the bezel.',
        'When the dome lid pops, the lens stays with the head band (it straddles the band and dome seam), so the face stays readable in the held defeat.',
        'Attack follows the coordinator note "the warning light spins, then a pincer lunge": the tell (0-0.45 s: three flashes, spin, eyelid up, iris narrows, red glare opens), the rock back with the right slinky squashed short and two snips (0.45-1.0 s), then the rock forward as the right arm springs %.0f%% past its rest length and snaps shut %.2f m in front at %.2f m high at the %.2f s contact; boing back, proud head bob, settled by 2.0 s.' % ((contact['arm_R_length_m'] / 0.36 - 1) * 100, -contact['claw_R_tip'][2], contact['claw_R_tip'][1], attack['contact_time_s']),
        'Defeat follows the coordinator note "sparks, the dome pops and it slumps smoking, held": the left claw bonks the self-destruct button at 0.28 s, sparks crackle, the head sproings up on the bellows while the light spins, the dome lid pops open at 0.92 s with smoke rising, then it slumps %.1f deg onto its left tread with the head drooping, arms limp, the eyelid half shut and the iris circling; held from %.2f s, still smoking.' % (abs(three['defeat_held']['roll_deg']), defeat['held_final_pose_from_s']),
        'Rig (%d joints): root, chassis, eight road wheels, waist, body, button, sparks, neck, head, dome lid, warning light, two smoke bones, eyelid tilt and shutter, pupil and glare, five-bone slinky chains with a claw and two jaws per arm, and a five-bone cord chain with the plug.' % construction['bone_count'],
        'Height: %.4f m to the warning-light cage (blockout 1.2925 m), inside the WO111 ordinary band of 0.8-1.4 m.' % three['height_m']],
    'dimensions_width_height_depth_m': three['dimensions_m'], 'sheet_pose_dimensions_m': three['sheet_pose']['idle0_dimensions_m'], 'rest_bounds_y_up': three['rest_bounds_y_up'], 'animated_bounds_y_up': three['all_animation_bounds_y_up'], 'stored_safe_culling_bounds': three['exported_safe_bounds_y_up'],
    'contact_seconds': attack['contact_time_s'], 'contact_claw_tip_y_up': contact['claw_R_tip'], 'contact_right_arm_length_m': contact['arm_R_length_m'], 'rest_arm_length_m': 0.36, 'attack_duration_seconds': attack['duration_s'], 'defeat_held_from_seconds': defeat['held_final_pose_from_s'],
    'defeat_held': three['defeat_held'], 'no_floor_penetration': three['checks']['no_floor_penetration'],
    'limitations': ['Headless software Chromium is not physical Safari or hardware performance acceptance.',
        'The attachment audit tests listed part pairs every frame on the source scene; it is not a universal triangle-collision proof. Intended contacts (the arm roots in the sockets, the cord root in the grommet, the cuffs over the tube ends, the bellows in the body top and trim, the waist in the crossbar, the lens barrel through the dome, the seam ring over the band) are not tested.',
        'In the game the windup phase scrubs the attack clip from 0 to the 1.25 s contact, so the tell and the wind-up play at the simulation windup speed.',
        'Runtime culling: the lunge reaches %.2f m in front and the rising smoke %.2f m high; three.js computes a skinned bounding sphere once, so the coordinator should apply the stored safe envelope (skin extras model_space_bounds_y_up), as filed in haynes-quest issue #103.' % (-three['all_animation_bounds_y_up']['min'][2], three['all_animation_bounds_y_up']['max'][1]),
        'The glow material uses the atlas as emission at factor 1, so the warning light and the red eye core always glow (they cannot dim in idle); the scare-scene blackouts dim scenery practicals, not characters.',
        'The painted face cannot change expression beyond the eyelid shutter, the iris and the red glare.', 'Owner final-art review and runtime integration are separate from this authoring handoff.']}
bounds = {**common, 'method': three['method'], 'rest_bounds_y_up': three['rest_bounds_y_up'], 'dimensions_width_height_depth_m': three['dimensions_m'], 'height_m': three['height_m'],
    'sheet_pose_bounds_y_up': three['sheet_pose']['idle0_bounds_y_up'], 'sheet_pose_dimensions_m': three['sheet_pose']['idle0_dimensions_m'], 'sole_clearance_m': three['sole_clearance_m'],
    'body_footprint_y_up': three['body_footprint_y_up'], 'all_animation_bounds_y_up': three['all_animation_bounds_y_up'], 'safe_culling_envelope_y_up': three['exported_safe_bounds_y_up'],
    'note': 'glTF axes: +Y up, character faces -Z; its right (the raised claw) is +X. Root at the floor origin under the body centre. The rest width is set by the two A-pose arms; the sheet pose spans the reaching left claw to the raised right claw, and its depth runs from the curled plug tail (+Z, behind) to the reaching claw.'}
for name, record in [('provenance.json', provenance), ('tool-settings.json', settings), ('visual-review.json', visual), ('bounds.json', bounds)]:
    (ROOT / name).write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps({'glb_sha256': digest, 'reports': ['provenance.json', 'tool-settings.json', 'visual-review.json', 'bounds.json'], 'all_technical_checks': True}))
