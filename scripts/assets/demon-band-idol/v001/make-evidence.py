"""WO111 demon-band-idol: exact-byte provenance, tool settings, bounds and factual author review handoff.
Adapted from the rival-mayor v001 make-evidence.py. Run after the final fetch, inspect-three, preview and compare."""
from pathlib import Path
import json,hashlib,datetime
ROOT=Path('/home/dev/artifacts/haynes-quest/family-eras/demon-band-idol/v001')
SOURCE=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
digest=sha(ROOT/'demon-band-idol.glb')
construction=json.loads((ROOT/'construction.json').read_text())
three=json.loads((ROOT/'three-inspection.json').read_text())
browser=json.loads((ROOT/'final-preview/browser-inspection.json').read_text())
validation=json.loads((ROOT/'validation.json').read_text())
attachments=json.loads((ROOT/'attachment-inspection.json').read_text())
for report in [three,browser,validation,attachments]:
 assert report.get('glb_sha256',report.get('sha256'))==digest
 assert all(report['checks'].values())
assert construction['files']['demon-band-idol.glb']['sha256']==digest
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
common={'work_order':'WO111','asset_id':'demon-band-idol','version':'v001','created_utc':now,'glb_sha256':digest,'candidate_status':"Awaiting Tom's review · used in the family release"}
attack=next(c for c in construction['clips'] if c['name']=='attack')
defeat=next(c for c in construction['clips'] if c['name']=='defeat')
provenance={**common,
 'authoring_agent':'Claude Opus 5.5 (claude-opus-5-5, xhigh) Blender author under the PLAN-019 coordinator; Tom ruled on Sept 26 that Claude Opus 5.5 does the WO111 Blender work',
 'authoring_tool':'Blender MCP execute_blender_code on the second isolated authoring service (blender-authoring-2), driven by a small streamable-HTTP JSON-RPC client (source/transfer.py)',
 'blender_version':construction['blender_version'],
 'source_reference':{'kind':'Blender reference sheet, no generated concept','file':'reference-sheet.png','sha256':sha(ROOT/'reference-sheet.png'),'notes':'reference-notes.md','notes_sha256':sha(ROOT/'reference-notes.md'),
  'blockout_master':'demon-band-idol-blockout.blend','blockout_sha256':sha(ROOT/'demon-band-idol-blockout.blend'),
  'coordinator_review':'Approved Sept 26 (SHEET-REVIEWS.md): cute and kid-safe lavender imp with swoopy horned idol hair, a pink sash, sparkle epaulettes, a stage mic, star blush and a wink; the heart-tipped tail must stay readable. Attack: mic spin with a sparkle burst; defeat: a dramatic dizzy bow, held.',
  'generator':'None. The sheet is a Cycles render of a procedural Blender blockout; no image-generation model was used for this asset.'},
 'source_scripts':{p.name:sha(p) for p in sorted(SOURCE.iterdir()) if p.suffix in ['.py','.mjs','.json','.sh'] and p.is_file()},
 'original_work':['Final topology, UVs, weights, 36-joint rig and all five clips are new; the approved blockout supplied measured proportions, colours, parody hooks and (for the sash, bow knot and brooch) sampled positions only.',
  'Original 1024 painted atlas generated with numpy in Blender Python (paint.py): the wink face, star blush, grin, shirt V, lapel piping and buttons are painted at the blockout decals\' projected positions; flat sheet-colour tiles for everything else. No external texture.',
  'Mesh, UV, transfer, validation and evidence utilities adapted from the WO111 rival-mayor / gadget-helper / honk-bus scripts.'],
 'excluded_inputs':['No family photos, names, birthdays or likenesses.','No copied franchise names, models, faces, logos, costumes, lettering, recordings or textures.'],
 'rights_note':'Original authored study. No exclusive-rights or franchise-endorsement claim.',
 'scope':'Technical candidate delivery. The coordinator owns catalog publication and runtime integration; the owner exact-version and physical-device review remain open.'}
settings={**common,
 'blender':{'version':construction['blender_version'],'instance':'blender-authoring-2','units':'METRIC','unit_scale':1,'authoring_axes':'+Z up / +Y forward (character right = +X)','frames_per_second':30,'animation_mode':'NLA_TRACKS','animation_keys':'Every frame, linear, exported without keyframe optimisation','skin':'One skin; rigid props plus smoothstep blends at the neck, waist, shoulders, elbows, hips, knees, ankles, fringe, tail, bow tails and swallowtails (at most 2 influences used)','root':'Identity, fixed floor-centred root; no root animation; the hips carry the bounce, lunge, spin and bow','bind_pose':'Neutral: head straight, arms in a 50 deg A-pose with a 40 deg elbow bend, feet forward, knees bent 3.5 cm (rest controls reproduce it, max matrix error %.1e)'%construction['rest_reproduction_max_error'],'sheet_pose':'Idle at 0 s reproduces the blockout sheet pose (mic grille, mic fist, wrists and feet within %.1e m)'%max(construction['sheet_pose_reproduction_m'].values())},
 'export':{'format':'GLB','axes':'+Y up / -Z forward','selection_only':True,'materials':2,'texture':{'file':'pigment.png','width':1024,'height':1024,'embedded':True},'no_external_resources':True,'no_required_extensions':True,'compression':'None; no Draco, Meshopt or KTX2 requirement'},
 'preview':{'source':'Exact delivered GLB via Three.js GLTFLoader','three_revision':three['three_revision'],'browser':browser['browser'],'renderer':browser['renderer'],'viewport_px':[800,900],'orthographic_camera':{'left':-0.9,'right':0.9,'top':1.0125,'bottom':-1.0125,'target':[0,0.70,0],'views':{'front':[0,0.70,-8],'side':[8,0.70,0],'back':[0,0.70,8],'threequarter':[5.657,0.70,-5.657],'beauty':[3.6,2.3,-6.6]}},'stills_pose':'Main stills: idle at 0 s (the sheet pose); rest-*.png: the bind pose','lighting':'Warm hemisphere plus three directional lights; ACES tone mapping exposure 1.0','scales':[1,.35],'no_physical_device_claim':True},
 'checks':{'khronos_zero_errors_warnings':True,'exact_three_adapter_all_checks':True,'chromium_all_clips_normal_small':True,'source_attachment_checks':True}}
visual={**common,
 'author_review':'Exact-export front, side, back and three-quarter stills (idle at 0 s = the sheet pose) compared with the reference sheet at the same angles and metric scale (sheet-vs-export.png); rest-pose stills; five-clip normal/small motion sheet; attack front/side windup-spin-contact-recovery and the 35% gameplay-scale strip; held defeat front/side/three-quarter/beauty; close-ups of the face, mic arm, fringe during the hit, sneakers and trouser hems.',
 'coordinator_review':'Pending PLAN-019 coordinator intake. Not Tom approval.','owner_review':'Pending exact-version decision',
 'sheet_matching':['Silhouette kept from the approved blockout at its measured coordinates: gold candy horns (1.401 m in the sheet pose, 1.396 m in the bind pose), swoopy midnight hair with the hot-pink dip-dyed fringe at his right temple, big lavender head tilted 6 deg into the mic and turned 5 deg, pointy ears with pink insides and the gold star earring on his left, gold epaulettes with fringe and three sparkle stars each, teal jacket with the gold collar and hem, hot-pink sash with the gold star brooch and the bow at his left hip, swallowtail flaps with gold tips, slim midnight trousers with gold side stripes, chunky white high-tops with pink soles and rims, and the lavender tail curling up on his right to the heart spade.',
  'Face painted from the blockout decals: big open left eye with a magenta iris, diamond sparkle highlight and lash flick; happy wink arc with two lashes; confident brows; open grin with teeth and tongue; pink star blush projected like the sheet\'s; button nose.',
  'Idle at 0 s reproduces the sheet pose exactly: mic by the chin in his right fist with the star charm, left fist on the hip, head tilt, weight on the right leg, left foot turned out 22 deg (grille within 3e-7 m of the blockout).',
  'Colours are the sheet hex values exactly (atlas); the preview renders them slightly deeper than the Cycles Standard-view sheet because of its ACES tone mapping and three-light rig.',
  'Parody hooks kept and kid-safe: a demon who is also a pop idol, horns in swoopy idol hair, the military-style idol jacket, sash, sparkles and stage mic, the wink and star blush; no fangs, claws, weapons or angry face, blunt horn tips, heart-tipped tail.'],
 'author_corrections':['Epaulette fringe first hung with a visible gap under the pad rim (as in the blockout); it now hangs from just under the rim.',
  'At 35% scale the first sparkle burst read as a few specks: ring radius 0.12 -> 0.20 m, sparkles about 1.65x larger, a 1.15 overshoot and a 0.9 rad spin as it opens. The first thrust also pointed the mic down; the thrust target was raised so the arm reaches out level even as he leans in, and the fist now turns the mic along the arm.',
  'The first held bow flung the mic arm up behind the back and read like a dab; the arm now flings out wide at hip height.',
  'The first hit and idle fringe motion swung the swoop down in the head frame and buried the pink tips in the cheek; fringe motion now only lifts off the head (up/forward, out from the temple) and the attachment audit tests the fringe against the face skin.',
  'The held defeat first still differed by 0.46 mm at 60 Hz because the last settle key sat one frame inside the declared hold; every defeat motion now ends at 1.68 s (hold declared from 1.752 s) and keys are exported without optimisation.',
  'The attack spin first swung the tail into the seat (frames 20-23); it now flings out to his right and up.',
  'The dizzy loll first rolled the head into the shoulder sparkles; the roll was cut to nod-and-turn and the sparkles tilt outward while he wobbles.',
  'The blockout trouser flare poked through the high-top collars once the shins bent; the hem now tucks 8 mm inside the collar and rides the foot below 0.16 m.',
  'Rest knees bend 3.5 cm forward so the sheet\'s splayed left foot is reachable without shifting the hips, which keeps idle 0 s an exact sheet match.'],
 'deviations_from_sheet_notes':['Bind pose is neutral as the notes suggest; the sheet pose is recreated at idle 0 s, so the matched stills show idle 0 s and rest-*.png show the bind pose.',
  'Rig (36 joints): root, hips, spine, chest, neck, head, two fringe bones, both ears, the earring, three-bone arms, mic (child of the right hand) with charm and burst bones, two shoulder-sparkle bones, thigh/shin/foot legs, four tail bones, two bow-tail bones and two swallowtail bones. The chunky sneakers stay rigid on the foot (no toe bone); the torso has hips + two spine bones.',
  'Attack follows the coordinator\'s "mic spin with a sparkle burst": he pulls the mic in and leans back, spins a full turn in place (0.40-1.04 s) while twirling the mic twice, then lunges into a high-note thrust at 1.25 s as a ring of six crossed sparkles and a big gold star pops open round the grille (the burst is model geometry bound collapsed inside the grille and opened by its bone\'s scale; it is closed in every other clip). His free hand flings up in a raised fist; mitten fists cannot make the notes\' heart gesture.',
  'Hit: the fringe flings out off his head instead of flopping over both eyes (a rotation that covers the eyes passes through the face); the painted face has no "ow" mouth.',
  'Defeat follows the coordinator\'s "dramatic dizzy bow, held" rather than the notes\' seated swoon: a dizzy wobble with the mic drooping and the fist falling off the hip, then an over-deep curtain-call bow (chest %.0f deg forward) with the mic flung wide, the other hand on his belly, the right foot slid back, drooping tail and ears and one tilted sparkle; held from 1.752 s.'%three['defeat_held']['chest_pitch_forward_deg'],
  'The idle omits the notes\' blink back into the wink (the face is painted, no morph targets).',
  'Tail 20% thicker, ears 13% fuller and the earring, charm and cord slightly thicker than the blockout, per the notes\' thin-parts advice.'],
 'dimensions_width_height_depth_m':three['dimensions_m'],'rest_bounds_y_up':three['rest_bounds_y_up'],'animated_bounds_y_up':three['all_animation_bounds_y_up'],'stored_safe_culling_bounds':three['exported_safe_bounds_y_up'],
 'sheet_pose_height_m':three['sheet_pose']['idle0_top_m'],'contact_seconds':attack['contact_time_s'],'attack_duration_seconds':attack['duration_s'],'spin_seconds':attack['spin_s'],'burst_open_seconds':attack['burst_open_s'],'defeat_held_from_seconds':defeat['held_final_pose_from_s'],
 'defeat_held':three['defeat_held'],'no_floor_penetration':three['checks']['no_floor_penetration'],
 'limitations':['Headless software Chromium is not physical Safari or hardware performance acceptance.','The attachment audit tests listed part pairs every frame on the source scene; it is not a universal triangle-collision proof. Intended contacts (the right fist round the mic, the left fist on the hip, sleeve roots in the jacket and epaulettes, trouser tops in the seat, strands on the hair cap, the tail root) are not tested.',
  'In the game the windup phase scrubs the attack clip from 0 to the 1.25 s contact, so the lean-back, spin and lunge play at the simulation windup speed; the burst opens from 1.17 s and closes by 1.60 s.',
  'Runtime culling: the open burst spans up to %.2f m (bounding-box diagonal) round the grille and the bow and lunge move the head forward; three.js computes a skinned bounding sphere once, so the coordinator should apply the stored safe envelope (skin extras model_space_bounds_y_up), as filed in haynes-quest issue #103.'%three['animations']['attack']['max_burst_extent_m'],
  'The painted face cannot change expression; the wink and grin hold in every clip.','Owner final-art review and runtime integration are separate from this authoring handoff.']}
bounds={**common,'method':three['method'],'rest_bounds_y_up':three['rest_bounds_y_up'],'dimensions_width_height_depth_m':three['dimensions_m'],'height_m':three['height_m'],'sheet_pose_height_m':three['sheet_pose']['idle0_top_m'],'sole_clearance_m':three['sole_clearance_m'],'body_footprint_y_up':three['body_footprint_y_up'],'all_animation_bounds_y_up':three['all_animation_bounds_y_up'],'safe_culling_envelope_y_up':three['exported_safe_bounds_y_up'],'defeat_held_hips_height_m':three['defeat_held']['hips_height_m'],'note':'glTF axes: +Y up, character faces -Z; his right hand (mic) is +X. Root at the floor origin under the body centre. The bind pose holds the arms out in an A-pose (hence the 0.98 m rest width); the sheet pose is about 0.66 m wide (the blockout measured 0.658 m).'}
for name,record in [('provenance.json',provenance),('tool-settings.json',settings),('visual-review.json',visual),('bounds.json',bounds)]:
 (ROOT/name).write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'glb_sha256':digest,'reports':['provenance.json','tool-settings.json','visual-review.json','bounds.json'],'all_technical_checks':True}))
