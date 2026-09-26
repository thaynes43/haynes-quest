"""WO111 bin-chicken: exact-byte provenance, tool settings, bounds and factual author review handoff.
Adapted from the rival-mayor v001 make-evidence.py."""
from pathlib import Path
import json,hashlib,datetime
ROOT=Path('/home/dev/artifacts/haynes-quest/family-eras/bin-chicken/v001')
SOURCE=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
digest=sha(ROOT/'bin-chicken.glb')
construction=json.loads((ROOT/'construction.json').read_text())
three=json.loads((ROOT/'three-inspection.json').read_text())
browser=json.loads((ROOT/'final-preview/browser-inspection.json').read_text())
validation=json.loads((ROOT/'validation.json').read_text())
attachments=json.loads((ROOT/'attachment-inspection.json').read_text())
for report in [three,browser,validation,attachments]:
 assert report.get('glb_sha256',report.get('sha256'))==digest
 assert all(report['checks'].values())
assert construction['files']['bin-chicken.glb']['sha256']==digest
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
common={'work_order':'WO111','asset_id':'bin-chicken','version':'v001','created_utc':now,'glb_sha256':digest,'candidate_status':"Awaiting Tom's review · used in the family release"}
attack=next(c for c in construction['clips'] if c['name']=='attack')
defeat=next(c for c in construction['clips'] if c['name']=='defeat')
beats={round(b['time_s'],2):b for b in three['attack_beats']}
jab=beats[0.0]['beak_tip'][2]-beats[1.25]['beak_tip'][2]
provenance={**common,
 'authoring_agent':'Claude Opus 5.5 (claude-opus-5-5, xhigh) Blender author under the PLAN-019 coordinator; Tom ruled on Sept 26 that Claude Opus 5.5 does the WO111 Blender work',
 'authoring_tool':'Blender MCP execute_blender_code on the second isolated authoring service (blender-authoring-2), driven by a small streamable-HTTP JSON-RPC client (source/transfer.py)',
 'blender_version':construction['blender_version'],
 'source_reference':{'kind':'Blender reference sheet, no generated concept','file':'reference-sheet.png','sha256':sha(ROOT/'reference-sheet.png'),'notes':'reference-notes.md','notes_sha256':sha(ROOT/'reference-notes.md'),
  'blockout_master':'bin-chicken-blockout.blend','blockout_sha256':sha(ROOT/'bin-chicken-blockout.blend'),
  'coordinator_review':'Approved Sept 26 (SHEET-REVIEWS.md): keep the banana-peel hat, stolen hot chip, chip-paper loot on the back and the long curved beak; the thin legs must stay readable (a slightly thicker leg read is fine); beak-peck attack; defeat drops the chip.',
  'generator':'None. The sheet is a Cycles render of a procedural Blender blockout; no image-generation model was used for this asset.'},
 'source_scripts':{p.name:sha(p) for p in sorted(SOURCE.iterdir()) if p.suffix in ['.py','.mjs','.json'] and p.is_file()},
 'original_work':['Final topology, UVs, weights, the 29-bone rig and all five clips are new; the blockout supplied measured proportions, colours and parody hooks only.',
  'Original deterministic 1024 palette atlas generated in Blender Python from the sheet colours; cone stripes are real face columns and the grime smudges, peel speckles, nostrils and grin are small modelled decals, no external texture.',
  'Mesh, UV, transfer, IK-bake and validation utilities adapted from the WO111 rival-mayor / gadget-helper / honk-bus and Rat Casino authoring scripts.'],
 'excluded_inputs':['No family photos, names, birthdays or likenesses.','No copied franchise names, models, faces, logos, costumes, lettering, recordings or textures; the chip cone has no lettering or brand.'],
 'rights_note':'Original authored study of a real-world bird (the Australian white ibis, nicknamed "bin chicken"). No exclusive-rights or franchise-endorsement claim.',
 'scope':'Technical candidate delivery. The coordinator owns catalog publication and runtime integration; the owner exact-version and physical-device review remain open.'}
settings={**common,
 'blender':{'version':construction['blender_version'],'instance':'blender-authoring-2','units':'METRIC','unit_scale':1,'authoring_axes':'+Z up / +Y forward (character right = +X)','frames_per_second':30,'animation_mode':'NLA_TRACKS',
  'skin':'One skin; rigid parts plus smoothstep blends along the body (hips/chest), the four neck joints, the knees and ankles, the wing roots/tips, the peel flaps and the plume roots',
  'root':'Identity, fixed floor-centred root; no root animation; the hips translate for the bob, lunge and belly flop',
  'bind_pose':'Neutral (head straight, both feet flat). The sheet design pose (head turned 17 deg right, tilted 7 deg, left foot on tiptoe) is the idle clip at 0 s. IK controls at rest reproduce the bind pose (max matrix error %.1e)'%construction['rest_reproduction_max_error']},
 'export':{'format':'GLB','axes':'+Y up / -Z forward','selection_only':True,'materials':2,'texture':{'file':'pigment.png','width':1024,'height':1024,'embedded':True},'no_external_resources':True,'no_required_extensions':True,'compression':'None; no Draco, Meshopt or KTX2 requirement',
  'scene_extras':'Asset identity only; the live scene-lease/session keys are stripped for the export and restored afterwards'},
 'preview':{'source':'Exact delivered GLB via Three.js GLTFLoader','three_revision':three['three_revision'],'browser':browser['browser'],'renderer':browser['renderer'],'viewport_px':[800,900],
  'orthographic_camera':{'half_height_m':0.75,'target_height_m':0.64,'views':{'front':[0,0.64,-8],'side':[8,0.64,0],'back':[0,0.64,8],'threequarter':[5.657,0.64,-5.657],'beauty':[4.1,2.9,-7.4]},'beauty_target_height_m':0.52},
  'stills_pose':'idle clip at 0 s (the sheet design pose); rest-*.png show the bind pose','lighting':'Warm hemisphere plus three directional lights; ACES tone mapping exposure 1.0','scales':[1,.35],'no_physical_device_claim':True},
 'checks':{'khronos_zero_errors_warnings':True,'exact_three_adapter_all_checks':True,'chromium_all_clips_normal_small':True,'source_attachment_checks':True}}
visual={**common,
 'author_review':'Exact-export front, side, back, three-quarter and beauty stills (sheet pose = idle 0 s) compared with the reference sheet at the same angles and metric scale (sheet-vs-export.png); five-clip normal/small motion sheet; attack front/side windup-contact-recovery and the 35% gameplay-scale strip; held defeat front/side/three-quarter/beauty; close-ups of the face, feet, loot and defeat head.',
 'coordinator_review':'Pending PLAN-019 coordinator intake. Not Tom approval.','owner_review':'Pending exact-version decision',
 'sheet_matching':['Silhouette kept from the approved blockout at its measured coordinates: banana-peel stem tip at 1.257 m in the bind pose (sheet 1.254 m), big bald plum-black head with googly eyes bulging above the head line, long down-curved beak with the hot chip crosswise near the tip, black S-neck in a scruffy white ruff, grubby egg body with four beige grime smudges, folded wings with black ends, black wing tips crossing behind the back over the blue-and-white striped paper cone of chips, three lacy black plume drapes, knobbly mauve stilt legs and big three-toed feet.',
  'The idle clip at 0 s reproduces the sheet pose: head turned 17 deg to its right and tilted 7 deg, pupils glancing right, left foot on tiptoe; the beak tip lands at (0.103, 0.575, 0.835) m against the blockout\'s (0.103, 0.576, 0.839) m.',
  'Legs thickened from the blockout\'s 0.04 m to 0.044-0.05 m and the knee knobs to 0.07 m, per the coordinator note, so they read at 35% scale.',
  'Colours are the sheet hex values exactly (atlas palette); the preview renders the whites a little cooler and greyer than the Cycles Standard-view sheet because of its ACES tone mapping and three-light rig.',
  'Parody hooks kept: the "bin chicken" bird itself, the banana peel worn as a hat, the stolen hot chip in the beak and the cone of chips "hidden" behind its back, and the "who, me?" sideways glance with a raised brow and a half-lid.'],
 'author_corrections':['First defeat bake left the belly 3.4 mm below the floor; the flopped hips were raised 6 mm.',
  'First held defeat propped the head 0.43 m up with the beak pointing at the floor, which did not read as a flop; the neck now drapes down in -20/-45/-50/-25 deg segments and the head lies on its left cheek with the beak along the floor.',
  'When the head rolled onto its cheek the left peel flap dipped up to 3 cm below the floor; the peel now slides forward and rolls toward the upper side earlier (0.67-1.2 s) and the flap wobble was damped.',
  'The spilled chip bundle first sat 1.9 cm below the floor; raised. The dropped beak chip first landed under the beak; it now lands at the front right, 0.30 m from the beak tip.',
  'The hit clip first started with the peel flaps displaced (phase offsets); an envelope makes it start exactly at the idle 0 s pose.',
  'The first beak jab pointed steeply down (tip 0.42 m high, 0.20 m ahead); more head counter-pitch and body lean make it a forward jab %.3f m ahead of the sheet-pose tip at about 0.49 m height.'%jab,
  'The hit check first measured the chip jump in world space, where the recoil lowers the cone; it is now measured inside the cone and the jump raised to 0.11 m.'],
 'deviations_from_sheet_notes':['Bind pose is neutral as the notes suggest; the sheet pose is recreated in idle, so the matched stills show idle at 0 s and rest-*.png show the bind pose.',
  'Each leg uses leg, shank and foot bones; the feathered thigh rides rigidly on the hips and the toes are rigid on the foot (no separate thigh or toe bone). The rig has 29 joints.',
  'The loot cone rides on its own bone under the hips rather than a wing-tip bone, so wing flares in hit and defeat do not throw it; the cone chips have their own bone for the hit jump and the defeat spill.',
  'Hit: no feather-puff scale (all joints stay unscaled); the wings flare, the plumes flick, the peel pops 0.11 m off the head and the chips jump out of the cone.',
  'Defeat: the peel slides forward and rolls toward the upper side of the rolled head, partly over the brow; the eyes stay visible with drooping lids.'],
 'dimensions_width_height_depth_m':three['dimensions_m'],'rest_bounds_y_up':three['rest_bounds_y_up'],'animated_bounds_y_up':three['all_animation_bounds_y_up'],'stored_safe_culling_bounds':three['exported_safe_bounds_y_up'],
 'contact_seconds':attack['contact_time_s'],'attack_duration_seconds':attack['duration_s'],'rear_back_hold_seconds':attack['rear_back_hold_s'],'defeat_chip_release_seconds':defeat['chip_release_s'],'defeat_chip_lands_seconds':defeat['chip_lands_s'],'defeat_held_from_seconds':defeat['held_final_pose_from_s'],
 'beak_jab_forward_of_sheet_pose_m':jab,'defeat_held':three['defeat_held'],'no_floor_penetration':three['checks']['no_floor_penetration'],
 'limitations':['Headless software Chromium is not physical Safari or hardware performance acceptance.',
  'The attachment audit tests listed part pairs every frame on the source scene; it is not a universal triangle-collision proof. Intended contacts (neck in the ruff, wing shells on the body, wing tips over the cone, thighs over the leg tops, belly/neck/head/chips on the floor in the defeat) are not tested.',
  'In the game the windup phase scrubs the attack clip from 0 to the 1.25 s contact, so the crouch, rear-back and lunge play at the simulation windup speed.',
  'Runtime culling: three.js computes a skinned bounding sphere once at the first rendered pose and the game does not yet apply the exported safe envelope; the eyes-and-beak primitive leaves its idle sphere by up to 0.89 m in the defeat (three-inspection.json stale_skinned_culling_spheres_note). Filed as haynes-quest issue #103 for runtime integration.',
  'Owner final-art review and runtime integration are separate from this authoring handoff.']}
bounds={**common,'method':three['method'],'rest_bounds_y_up':three['rest_bounds_y_up'],'dimensions_width_height_depth_m':three['dimensions_m'],'height_m':three['height_m'],'sole_clearance_m':three['sole_clearance_m'],'body_footprint_y_up':three['body_footprint_y_up'],'all_animation_bounds_y_up':three['all_animation_bounds_y_up'],'safe_culling_envelope_y_up':three['exported_safe_bounds_y_up'],'defeat_held_hips_height_m':three['defeat_held']['hips_height_m'],'note':'glTF axes: +Y up, character faces -Z; its right side is +X. Root at the floor origin between the feet, 1.8 cm in front of the egg body centre.'}
for name,record in [('provenance.json',provenance),('tool-settings.json',settings),('visual-review.json',visual),('bounds.json',bounds)]:
 (ROOT/name).write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'glb_sha256':digest,'reports':['provenance.json','tool-settings.json','visual-review.json','bounds.json'],'all_technical_checks':True,'jab_m':jab}))
