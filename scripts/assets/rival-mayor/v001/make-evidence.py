"""WO111 rival-mayor: exact-byte provenance, tool settings, bounds and factual author review handoff."""
from pathlib import Path
import json,hashlib,datetime
ROOT=Path('/home/dev/artifacts/haynes-quest/family-eras/rival-mayor/v001')
SOURCE=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
digest=sha(ROOT/'rival-mayor.glb')
construction=json.loads((ROOT/'construction.json').read_text())
three=json.loads((ROOT/'three-inspection.json').read_text())
browser=json.loads((ROOT/'final-preview/browser-inspection.json').read_text())
validation=json.loads((ROOT/'validation.json').read_text())
attachments=json.loads((ROOT/'attachment-inspection.json').read_text())
for report in [three,browser,validation,attachments]:
 assert report.get('glb_sha256',report.get('sha256'))==digest
 assert all(report['checks'].values())
assert construction['files']['rival-mayor.glb']['sha256']==digest
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
common={'work_order':'WO111','asset_id':'rival-mayor','version':'v001','created_utc':now,'glb_sha256':digest,'candidate_status':"Awaiting Tom's review · used in the family release"}
attack=next(c for c in construction['clips'] if c['name']=='attack')
defeat=next(c for c in construction['clips'] if c['name']=='defeat')
provenance={**common,
 'authoring_agent':'Claude Opus 5.5 (claude-opus-5-5, xhigh) Blender author under the PLAN-019 coordinator; Tom ruled on Sept 26 that Claude Opus 5.5 does the WO111 Blender work',
 'authoring_tool':'Blender MCP execute_blender_code on the second isolated authoring service (blender-authoring-2), driven by a small streamable-HTTP JSON-RPC client (source/transfer.py)',
 'blender_version':construction['blender_version'],
 'source_reference':{'kind':'Blender reference sheet, no generated concept','file':'reference-sheet.png','sha256':sha(ROOT/'reference-sheet.png'),'notes':'reference-notes.md','notes_sha256':sha(ROOT/'reference-notes.md'),
  'blockout_master':'rival-mayor-blockout.blend','blockout_sha256':sha(ROOT/'rival-mayor-blockout.blend'),
  'coordinator_review':'Approved Sept 26 (SHEET-REVIEWS.md): keep the tall stovepipe hat, curly mustache, red sash with rosette, spring-antenna remote in the right hand and pinstripe legs; the mustache may be 10-15% larger for read at play distance.',
  'generator':'None. The sheet is a Cycles render of a procedural Blender blockout; no image-generation model was used for this asset.'},
 'source_scripts':{p.name:sha(p) for p in sorted(SOURCE.iterdir()) if p.suffix in ['.py','.mjs','.json'] and p.is_file()},
 'original_work':['Final topology, UVs, weights, 28-bone rig and all five clips are new; the blockout supplied measured proportions, colours and parody hooks only.','Original deterministic 1024 palette atlas generated in Blender Python from the sheet colours; pinstripes are real 36-segment face columns, no external texture.','Mesh, UV, transfer and validation utilities adapted from the WO111 gadget-helper / honk-bus and Rat Casino authoring scripts.'],
 'excluded_inputs':['No family photos, names, birthdays or likenesses.','No copied franchise names, models, faces, logos, costumes, lettering, recordings or textures.'],
 'rights_note':'Original authored study. No exclusive-rights or franchise-endorsement claim.',
 'scope':'Technical candidate delivery. The coordinator owns catalog publication and runtime integration; the owner exact-version and physical-device review remain open.'}
settings={**common,
 'blender':{'version':construction['blender_version'],'instance':'blender-authoring-2','units':'METRIC','unit_scale':1,'authoring_axes':'+Z up / +Y forward (character right = +X)','frames_per_second':30,'animation_mode':'NLA_TRACKS','skin':'One skin; rigid props plus two-weight smoothstep blends at the shoulders, elbows, knees, ankles, neck, coat waist and mustache roots','root':'Identity, fixed floor-centred root; no root animation; the hips translate for the bob and the seated defeat','bind_pose':'The approved sheet pose (left fist on hip, remote held out); IK controls at rest reproduce it (max matrix error %.1e)'%construction['rest_reproduction_max_error']},
 'export':{'format':'GLB','axes':'+Y up / -Z forward','selection_only':True,'materials':2,'texture':{'file':'pigment.png','width':1024,'height':1024,'embedded':True},'no_external_resources':True,'no_required_extensions':True,'compression':'None; no Draco, Meshopt or KTX2 requirement'},
 'preview':{'source':'Exact delivered GLB via Three.js GLTFLoader','three_revision':three['three_revision'],'browser':browser['browser'],'renderer':browser['renderer'],'viewport_px':[800,900],'orthographic_camera':{'left':-1.2,'right':1.2,'top':1.35,'bottom':-1.35,'target':[0,1.24,0],'views':{'front':[0,1.24,-8],'side':[8,1.24,0],'back':[0,1.24,8],'threequarter':[5.657,1.24,-5.657],'beauty':[4.1,2.9,-7.4]}},'lighting':'Warm hemisphere plus three directional lights; ACES tone mapping exposure 1.0','scales':[1,.35],'no_physical_device_claim':True},
 'checks':{'khronos_zero_errors_warnings':True,'exact_three_adapter_all_checks':True,'chromium_all_clips_normal_small':True,'source_attachment_checks':True}}
visual={**common,
 'author_review':'Exact-export front, side, back, three-quarter and beauty stills compared with the reference sheet at the same angles and metric scale (sheet-vs-export.png); five-clip normal/small motion sheet; attack front/side windup-contact-recovery and 35% gameplay-scale strip; held defeat front/side/three-quarter/beauty inspected.',
 'coordinator_review':'Pending PLAN-019 coordinator intake. Not Tom approval.','owner_review':'Pending exact-version decision',
 'sheet_matching':['Silhouette kept from the approved blockout at its measured coordinates: tilted stovepipe hat (2.475 m top), egg head, long nose with a rosy tip, pear tailcoat, skinny pinstripe legs, cream spats, long upturned shoes, left fist on the hip, remote held out on the right.','Mustache enlarged 12% about its centre per the coordinator note (about 0.80 m tip to tip).','Colours are the sheet hex values exactly (atlas palette); the preview renders them darker and more saturated than the Cycles Standard-view sheet because of its ACES tone mapping and three-light rig.','Swallow tails hang from the back hem forward-down toward the calves, matching the sheet side view.','Pupils glance toward his remote hand and the eyelids are heavy, as on the sheet; kitten badges on the hat band and the rosette tie him to the mischief-kitten crew.'],
 'author_corrections':['First assembled pass was 17,214 triangles; ring counts on the coat, legs, sleeves, brim, mustache, antenna coil and small ellipsoids were reduced to 14,548 with no silhouette change.','Swallow tails first hung vertically and read as sticks in the side view; tilted 0.30 rad toward the calves after the sheet comparison.','First defeat bake put the coat tails 0.176 m and the heels 0.027 m below the floor; the tail sweep and a heel-safe ankle arc/height fixed it (lowest point now the 4 mm sole clearance).','Idle twirl first overlapped the mustache curl (14 triangle pairs); the glove target moved outward to pinch the tip.','Defeat arm first passed through the belly while flopping into the lap; the wrist now arcs outward and follows the seat bounce (0 overlaps).','Attack thrust lowered and moved outward so the face stays visible at contact; stronger anticipation pull-in; the remote tilts forward less so the antenna silhouette reads at 35% scale.'],
 'deviations_from_sheet_notes':['Bind pose is the sheet pose rather than an A-pose: the sheet silhouette (fist on hip, remote out) is what the approved views show and what the rest stills must match; blended joint weights and IK let every clip leave it.','Four-sided kitten ears on the badges and a 7-turn coil keep the tiny details inside the triangle budget.'],
 'dimensions_width_height_depth_m':three['dimensions_m'],'rest_bounds_y_up':three['rest_bounds_y_up'],'animated_bounds_y_up':three['all_animation_bounds_y_up'],'stored_safe_culling_bounds':three['exported_safe_bounds_y_up'],
 'contact_seconds':attack['contact_time_s'],'attack_duration_seconds':attack['duration_s'],'raised_warning_hold_seconds':attack['raised_warning_hold_s'],'defeat_held_from_seconds':defeat['held_final_pose_from_s'],
 'button_press_depth_at_contact_m':three['button_press_depth_at_contact_m'],'defeat_held':three['defeat_held'],'no_floor_penetration':three['checks']['no_floor_penetration'],
 'limitations':['Headless software Chromium is not physical Safari or hardware performance acceptance.','The attachment audit tests listed part pairs every frame on the source scene; it is not a universal triangle-collision proof. Intended contacts (fist on hip, sleeve roots in the pads, hat around the head once slid down, legs inside the coat when seated) are not tested.','In the game the windup phase scrubs the attack clip from 0 to the 1.25 s contact, so the raise-hold-thrust plays at the simulation windup speed.','Owner final-art review and runtime integration are separate from this authoring handoff.']}
bounds={**common,'method':three['method'],'rest_bounds_y_up':three['rest_bounds_y_up'],'dimensions_width_height_depth_m':three['dimensions_m'],'height_m':three['height_m'],'sole_clearance_m':three['sole_clearance_m'],'body_footprint_y_up':three['body_footprint_y_up'],'all_animation_bounds_y_up':three['all_animation_bounds_y_up'],'safe_culling_envelope_y_up':three['exported_safe_bounds_y_up'],'defeat_held_hips_height_m':three['defeat_held']['hips_height_m'],'note':'glTF axes: +Y up, character faces -Z; his right hand (remote) is +X. Root at the floor origin under the body centre.'}
for name,record in [('provenance.json',provenance),('tool-settings.json',settings),('visual-review.json',visual),('bounds.json',bounds)]:
 (ROOT/name).write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'glb_sha256':digest,'reports':['provenance.json','tool-settings.json','visual-review.json','bounds.json'],'all_technical_checks':True}))
