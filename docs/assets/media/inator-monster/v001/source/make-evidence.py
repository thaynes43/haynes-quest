"""WO111 inator-monster: exact-byte provenance, tool settings, bounds and factual author review handoff.
Adapted from the rival-mayor v001 evidence script."""
from pathlib import Path
import json,hashlib,datetime
ROOT=Path('/home/dev/artifacts/haynes-quest/family-eras/inator-monster/v001')
SOURCE=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
digest=sha(ROOT/'inator-monster.glb')
construction=json.loads((ROOT/'construction.json').read_text())
three=json.loads((ROOT/'three-inspection.json').read_text())
browser=json.loads((ROOT/'final-preview/browser-inspection.json').read_text())
validation=json.loads((ROOT/'validation.json').read_text())
attachments=json.loads((ROOT/'attachment-inspection.json').read_text())
for report in [three,browser,validation,attachments]:
 assert report.get('glb_sha256',report.get('sha256'))==digest
 assert all(report['checks'].values())
assert construction['files']['inator-monster.glb']['sha256']==digest
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
common={'work_order':'WO111','asset_id':'inator-monster','version':'v001','created_utc':now,'glb_sha256':digest,'candidate_status':"Awaiting Tom's review · used in the family release"}
attack=next(c for c in construction['clips'] if c['name']=='attack')
defeat=next(c for c in construction['clips'] if c['name']=='defeat')
provenance={**common,
 'authoring_agent':'Claude Opus 5.5 (claude-opus-5-5, xhigh) Blender author under the PLAN-019 coordinator; Tom ruled on Sept 26 that Claude Opus 5.5 does the WO111 Blender work',
 'authoring_tool':'Blender MCP execute_blender_code on the second isolated authoring service (blender-authoring-2), driven by a small streamable-HTTP JSON-RPC client (source/transfer.py)',
 'blender_version':construction['blender_version'],
 'source_reference':{'kind':'Blender reference sheet, no generated concept','file':'reference-sheet.png','sha256':sha(ROOT/'reference-sheet.png'),'notes':'reference-notes.md','notes_sha256':sha(ROOT/'reference-notes.md'),
  'blockout_master':'inator-monster-blockout.blend','blockout_sha256':sha(ROOT/'inator-monster-blockout.blend'),
  'coordinator_review':'Approved Sept 26 (SHEET-REVIEWS.md): excellent read; keep the googly-eyed rubber-suit monster with the costume zipper, toy back plates and the scientist in the bubble cockpit with the zig-zag -inator antenna; keep the pilot visible from the chase camera (above and behind); attack: stomp and roar while the scientist jabs the remote; defeat: slumps and the cockpit dome pops open, held.',
  'generator':'None. The sheet is a Cycles render of a procedural Blender blockout; no image-generation model was used for this asset.'},
 'source_scripts':{p.name:sha(p) for p in sorted(SOURCE.iterdir()) if p.suffix in ['.py','.mjs','.json','.sh'] and p.is_file()},
 'original_work':['Final topology, UVs, weights, the 41-bone rig (monster and pilot in one skin) and all five clips are new; the blockout supplied measured proportions, colours and parody hooks only.',
  'Original deterministic 1024 indexed-palette atlas generated in Blender Python from the sheet colours, with a tRNS chunk: only the 2 x 2 glass block is translucent (rim-rising tint and a painted window glint). The pocket pens and the remote grille are painted tiles; the zipper teeth are alternating face tiles; the belly scutes are bisected bands. No external texture.',
  'Mesh, UV, transfer and validation utilities adapted from the WO111 rival-mayor, mischief-kitten, gadget-helper / honk-bus and Rat Casino authoring scripts.'],
 'excluded_inputs':['No family photos, names, birthdays or likenesses.','No copied franchise names, models, faces, logos, costumes, lettering, catchphrases, jingles, recordings or textures. The -inator is a generic chunky remote with a red button, two dials, a grille and a zig-zag antenna; no lettering anywhere on the model.'],
 'rights_note':'Original authored study. No exclusive-rights or franchise-endorsement claim.',
 'scope':'Technical candidate delivery. The coordinator owns catalog publication and runtime integration; the owner exact-version and physical-device review remain open.'}
settings={**common,
 'blender':{'version':construction['blender_version'],'instance':'blender-authoring-2','units':'METRIC','unit_scale':1,'authoring_axes':'+Z up / +Y forward (character right = +X)','frames_per_second':30,'animation_mode':'NLA_TRACKS',
  'skin':'One skin for the monster and the pilot; rigid toy parts plus smoothstep blends along the spine (hips/spine_1/2/3), the legs, the tiny arms, the tail chain, the pilot coat, sleeves and antenna, and the straps (cockpit to torso)',
  'root':'Identity, fixed floor-centred root; no root animation; the hips translate for the waddle, stomp, rear-back and the seated defeat',
  'bind_pose':'The approved sheet pose (head tilt, mismatched pupils, the pilot raising the remote and pointing); the controls at rest reproduce it (max matrix error %.1e)'%construction['rest_reproduction_max_error'],
  'guards':'Legs are two-bone IK with world ankle targets and an analytic foot floor guard; a tail floor guard pitches the tail root up just enough that the floor-resting tail never sinks (max pitch per clip in construction.json floor_guards). Soles and the tail contact are clamped to a 6 mm contact plane so keyframe interpolation stays above the floor.'},
 'export':{'format':'GLB','axes':'+Y up / -Z forward','selection_only':True,'materials':{'0':'opaque painted atlas (doubleSided)','1':'alpha BLEND bubble glass on the same atlas (single-sided; three.js GLTFLoader sets depthWrite false so the pilot shows through)'},'texture':{'file':'pigment.png','width':1024,'height':1024,'embedded':True,'images':1},'no_external_resources':True,'no_required_extensions':True,'compression':'None; no Draco, Meshopt or KTX2 requirement'},
 'preview':{'source':'Exact delivered GLB via Three.js GLTFLoader','three_revision':three['three_revision'],'browser':browser['browser'],'renderer':browser['renderer'],'viewport_px':[900,900],
  'orthographic_camera':{'half_height_m':1.8,'px_per_m':250,'targets':{'front':[0,1.62,0],'side':[0,1.62,0.33],'back':[0,1.62,0],'threequarter':[0,1.62,0.2],'beauty':[0,1.5,0.2]},'views':{'front':[0,1.6,-12],'side':[12,1.6,0],'back':[0,1.6,12],'threequarter':[8.485,1.6,-8.485],'beauty':[6.2,4.4,-10.8]}},
  'gameplay_camera':'Perspective 48 deg, 7.9 m out and 2.62 m high at azimuths 0/45/90/180/-90 deg, looking at 1.75 m (the game follow camera trails the player; the boss usually faces the player)',
  'lighting':'Warm hemisphere plus three directional lights; ACES tone mapping exposure 1.0','scales':[1,.35],'no_physical_device_claim':True},
 'checks':{'khronos_zero_errors_warnings':True,'exact_three_adapter_all_checks':True,'chromium_all_clips_normal_small':True,'source_attachment_checks':True}}
vis=three['pilot_visibility_rest'];front=three['attack_front_pilot_visibility']
visual={**common,
 'author_review':'Exact-export front, side, back, three-quarter and beauty stills compared with the reference sheet at the same angles and metric scale (sheet-vs-export.png); five-clip normal/small motion sheet; attack front/side mash-rear-contact-recovery and 35% gameplay-scale strip; held defeat front/side/three-quarter/beauty; gameplay-camera views at five azimuths.',
 'coordinator_review':'Pending PLAN-019 coordinator intake. Not Tom approval.','owner_review':'Pending exact-version decision',
 'sheet_matching':['Silhouette kept from the approved blockout at its measured coordinates: 3.217 m to the antenna ball, 2.82 m to the dome top, 2.49 m to the googly eyes, the forward-leaning pear torso, stumpy baggy legs, the tail swept to its left and resting on the floor, 8 + 6 staggered toy plates, the strapped-on violet tub with three signal lights a side, and the scientist raising the remote under the brass port while pointing forward.',
  'Colours are the sheet hex values (atlas palette); the preview renders them darker and more saturated than the Cycles Standard-view sheet because of its ACES tone mapping and three-light rig. The belly scute bands keep the sheet #d9b466, lighter than the sheet ink outlines make them look.',
  'Parody hooks kept: glued-on googly eyes with mismatched pupils, the costume zipper with interlocking teeth, slider and a dangling pull tab, baggy ankle wrinkles, toy-coloured plates, the ear-to-ear gormless grin with two buck teeth and a pink tongue, and the evil scientist in the bubble cockpit with the zig-zag -inator antenna.',
  'The sheet glint is a camera-fixed specular highlight; the model paints one fixed window glint on the dome upper front-left (azimuth 150 deg, elevation 38 deg), placed where it never covers the pilot from the front, three-quarter or chase views, so it does not appear in every sheet angle.'],
 'pilot_visibility':{'method':'Raycasts against the skinned opaque primitive to six pilot-head sample points from 7.9 m out and 2.62 m high','rest_fraction_by_azimuth_deg':vis,'front_camera_through_attack':front,'defeat_held':three['defeat_held']['pilot_visibility']},
 'author_corrections':['First build: the glint arc became a full ring and sat over the pilot from front-left angles; moved to azimuth 150 / elevation 38, enlarged and limited to a crescent; the glass alpha was lowered (top 0.06, rim 0.38) because the dome read milky.',
  'The blockout port ring was 8 mm off the antenna rod; recentred on the rod crossing so the antenna stays inside the port while the dome is closed (worst %.1f mm of %.0f mm allowed across all closed-dome frames).'%(three['antenna_port']['worst']['offset']*1000,three['antenna_port']['allowed_offset_m']*1000),
  'Head segments raised (cranium 28 x 14, snout 32 x 16, jaw 28 x 12) after close-ups showed facets against the smooth sheet forms; paid for by dropping the eight 2 cm rim rivets and trimming the tail, dome, belly, rim and torso ring counts (14,575 triangles total).',
  'The pull tab first hung straight down and sank into the bulging back; it now lies along the back so the costume gag reads from behind at rest and flips up on the hit.',
  'Attack rear-back first tilted the head up far enough to hide the pilot from the front camera; head/neck tilt reduced (the roar stays in the jaw); the pilot now stays at least partly visible from the front through the whole attack.',
  'Baked-keyframe interpolation dipped rolled feet up to 1.3 mm below the floor; soles and tail contact moved to a 6 mm plane and the foot guard keeps a smooth 4 mm margin for moving or rolled feet.',
  'The hit head-bonk first pushed the frizz through the glass and the flailing pointing finger touched it; bonk reduced to 2 cm (frizz just reaches the glass) and the flail softened.'],
 'deviations_from_sheet_notes':['Bind pose is the sheet pose rather than a relaxed rest: the sheet silhouette (head tilt, raised remote, pointing arm) is what the approved views show and what the rest stills must match; blended weights and IK let every clip leave it.',
  'The eight small rim rivets are omitted (sub-2 cm details) to fund smoother head forms; the tub keeps its brass rim and signal lights.',
  'The back of the monster head tucks against the outside of the tub below the cockpit floor, as in the approved blockout; the audit checks every frame that no head vertex enters the cockpit above the floor.'],
 'dimensions_width_height_depth_m':three['dimensions_m'],'rest_bounds_y_up':three['rest_bounds_y_up'],'animated_bounds_y_up':three['all_animation_bounds_y_up'],'stored_safe_culling_bounds':three['exported_safe_bounds_y_up'],
 'contact_seconds':attack['contact_time_s'],'attack_duration_seconds':attack['duration_s'],'defeat_held_from_seconds':defeat['held_final_pose_from_s'],
 'defeat_held':three['defeat_held'],'no_floor_penetration':three['checks']['no_floor_penetration'],
 'limitations':['Headless software Chromium is not physical Safari or hardware performance acceptance.','The attachment audit tests listed part pairs every frame on the source scene; it is not a universal triangle-collision proof. Intended contacts (leg tops and tail root inside the torso, soles and tail on the floor, the pilot coat inside the tub, the antenna through the port, the hand on the rim in the attack recovery, the head against the tub below the floor) are not tested as overlaps.',
  'In the game the windup phase scrubs the attack clip from 0 to the 1.25 s contact, so the mash-rear-stomp plays at the simulation windup speed.','Transparent sorting: the glass is a separate alpha-blended primitive drawn after opaque geometry; with the runtime casting shadows from every mesh, the dome also casts a shadow.','Owner final-art review and runtime integration are separate from this authoring handoff.']}
bounds={**common,'method':three['method'],'rest_bounds_y_up':three['rest_bounds_y_up'],'dimensions_width_height_depth_m':three['dimensions_m'],'height_m':three['height_m'],
 'feature_heights_m':{'antenna_ball_top':round(three['height_m'],4),'dome_top':2.82,'googly_eyes_top':2.489,'monster_mass_top':2.49},
 'sole_clearance_m':three['sole_clearance_m'],'body_footprint_y_up':three['body_footprint_y_up'],'all_animation_bounds_y_up':three['all_animation_bounds_y_up'],'safe_culling_envelope_y_up':three['exported_safe_bounds_y_up'],'defeat_held_hips_height_m':three['defeat_held']['hips_height_m'],
 'note':'glTF axes: +Y up, character faces -Z; its right hand is +X and the tail sweeps to -X, +Z (behind). Root at the floor origin under the body. The monster mass tops out at 2.49 m; only the glass dome (2.82 m) and the thin antenna (3.217 m) rise above it, if gameplay needs a smaller collision height.'}
for name,record in [('provenance.json',provenance),('tool-settings.json',settings),('visual-review.json',visual),('bounds.json',bounds)]:
 (ROOT/name).write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'glb_sha256':digest,'reports':['provenance.json','tool-settings.json','visual-review.json','bounds.json'],'all_technical_checks':True}))
