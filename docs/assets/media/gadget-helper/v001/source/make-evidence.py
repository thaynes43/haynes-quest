"""WO111 gadget-helper exact-byte authoring provenance, bounds and factual review handoff."""
from pathlib import Path
import json,hashlib,datetime
ROOT=Path('/home/dev/artifacts/haynes-quest/family-eras/gadget-helper/v001')
SOURCE=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
digest=sha(ROOT/'gadget-helper.glb')
construction=json.loads((ROOT/'construction.json').read_text())
three=json.loads((ROOT/'three-inspection.json').read_text())
browser=json.loads((ROOT/'final-preview/browser-inspection.json').read_text())
validation=json.loads((ROOT/'validation.json').read_text())
attachments=json.loads((ROOT/'attachment-inspection.json').read_text())
for report in [three,browser,validation,attachments]:
 assert report.get('glb_sha256',report.get('sha256'))==digest
 assert all(report['checks'].values())
assert construction['files']['gadget-helper.glb']['sha256']==digest
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
common={'work_order':'WO111','asset_id':'gadget-helper','version':'v001','created_utc':now,'glb_sha256':digest,'candidate_status':"Awaiting Tom's review · used in the family release"}
contact=next(c for c in construction['clips'] if c['name']=='attack')
defeat=next(c for c in construction['clips'] if c['name']=='defeat')
provenance={**common,
 'authoring_agent':'Claude Opus 5.5 (claude-opus-5-5, xhigh) Blender author under the PLAN-019 coordinator; Tom ruled on Sept 26 that Opus 5.5 continues WO111 Blender work after the Codex usage limit (WO111 update on origin/main)',
 'authoring_tool':'Blender MCP execute_blender_code on the dedicated authoring service','blender_version':construction['blender_version'],
 'source_concept':{'file':'concept.png','sha256':sha(ROOT/'concept.png'),'source_record':'source.json','generator':'OpenAI built-in image_gen tool, driving GPT-6 Astra / max','selection':'Driving Astra selected the original generated concept before the Codex usage limit; no franchise source media. Not a Blender reference sheet.'},
 'source_scripts':{p.name:sha(p) for p in sorted(SOURCE.iterdir()) if p.suffix in ['.py','.mjs','.json']},
 'original_work':['Original toolbox geometry, face, strap handle, hover skirt, nozzles, accordion arm, wrench, paddle and all five clips.','Original deterministic 1024 palette atlas generated in Blender Python; painted stripes are bisected mesh bands, no external texture.','Mesh, UV, transfer and validation utilities adapted from the WO099/WO111 honk-bus and Rat Casino authoring scripts.'],
 'excluded_inputs':['No family photos, names, birthdays or likenesses.','No copied franchise models, faces, logos, costumes, recordings or textures; no mouse ears, TV face or lettering.'],
 'rights_note':'Original generated concept and authored study. Generated media is not automatically relicensed under the repository code license; no exclusive-rights or franchise-endorsement claim.',
 'scope':'Technical candidate delivery. The coordinator owns catalog publication and runtime integration; owner exact-version and physical-device review remain open.'}
settings={**common,
 'blender':{'version':construction['blender_version'],'units':'METRIC','unit_scale':1,'authoring_axes':'+Z up / +Y forward (anatomical left = -X)','frames_per_second':60,'animation_mode':'NLA_TRACKS','skin':'One skin; rigid parts plus two-weight blends along the accordion hose','root':'Identity, fixed floor-centred root; no root animation; body hovers 0.10 m above the floor at rest'},
 'export':{'format':'GLB','axes':'+Y up / -Z forward','selection_only':True,'materials':2,'texture':{'file':'pigment.png','width':1024,'height':1024,'embedded':True},'no_external_resources':True,'no_required_extensions':True,'compression':'None; no Draco, Meshopt or KTX2 requirement'},
 'preview':{'source':'Exact delivered GLB via Three.js GLTFLoader','three_revision':three['three_revision'],'browser':browser['browser'],'renderer':browser['renderer'],'viewport_px':[800,900],'orthographic_camera':{'left':-1.05,'right':1.05,'top':1.18,'bottom':-1.18,'target':[0,.58,0],'beauty_position':[3.1,1.52,-6]},'lighting':'Warm hemisphere plus three directional lights; ACES tone mapping exposure 1.0','scales':[1,.35],'no_physical_device_claim':True},
 'checks':{'khronos_zero_errors_warnings':True,'exact_three_adapter_all_checks':True,'chromium_all_clips_normal_small':True,'source_attachment_checks':True}}
visual={**common,
 'author_review':'Exact-export front, side, back and beauty stills compared with the concept front/back/three-quarter views (concept-vs-export.png); five-clip normal/small motion sheets; attack front/side windup-contact-recovery; held defeat front/side/beauty inspected.',
 'coordinator_review':'Pending PLAN-019 coordinator intake. Not Tom approval.','owner_review':'Pending exact-version decision',
 'concept_matching':['Wrench arm on the anatomical LEFT and paddle on the RIGHT, matching the concept front and back views.','Teal rounded box, ochre lid with a deeper rolled band, ochre strap handle with a ribbed charcoal grip, big cream oval eyes glancing toward the wrench, wavy mouth, orange clasp chin, plum hover skirt, three dark nozzles with thin orange rims.','Front cream stripe rises from behind the clasp to the wrench-side corner; back stripe sits on the paddle side, as in the concept back view.','The concept middle view is a construction study; depth resolved as 0.42 m body / 0.50 m skirt per the brief.'],
 'author_corrections':['First pass was 16,892 triangles; hose, grip, eye, pupil and jaw-tip ring counts were reduced to 14,574.','Nozzles lengthened with thin orange rims so dark cans read as in the concept; hover gap set to 0.10 m.','Eyes and pupils enlarged, mouth changed to a smooth wave, grip and hose cooled toward charcoal, skirt darkened toward plum after the concept comparison.','Box and lid corners rounded (superellipse exponent 3.3) toward the concept pillowy shell.','Wrench head enlarged with cream mitten jaw ends bisected into the head plus bulbous cream caps.','Elbow rest bend deepened so the accordion can extend; windup raised 0.17 m above rest and wound 0.29 m back.','Contact wrist moved outward after the source audit found 2.5 mm hose/body-corner overlap at 1.25 s; final margin +2.9 mm.'],
 'dimensions_width_height_depth_m':three['dimensions_m'],'rest_bounds_y_up':three['rest_bounds_y_up'],'hover_gap_m':three['hover_gap_m'],'animated_bounds_y_up':three['all_animation_bounds_y_up'],'stored_safe_culling_bounds':three['exported_safe_bounds_y_up'],
 'contact_seconds':contact['contact_time_s'],'attack_duration_seconds':contact['duration_s'],'measured_stable_warning_seconds':contact['held_warning_s'],'defeat_held_from_seconds':defeat['held_final_pose_from_s'],
 'no_floor_penetration':three['checks']['no_floor_penetration'],'defeat_lowest_point_m':three['animations']['defeat']['bounds_y_up']['min'][1],
 'limitations':['Headless software Chromium is not physical Safari or hardware performance acceptance.','Attachment audit supplements the exact GLB all-vertex checks; it does not claim universal triangle collision testing.','The windup is primarily upward and backward; the concept rest pose already extends the wrench outward, so the windup keeps a similar lateral reach.','Owner final-art review and runtime integration are separate from this authoring handoff.']}
bounds={**common,'method':three['method'],'rest_bounds_y_up':three['rest_bounds_y_up'],'dimensions_width_height_depth_m':three['dimensions_m'],'hover_gap_m':three['hover_gap_m'],'footprint_y_up':three['footprint_y_up'],'all_animation_bounds_y_up':three['all_animation_bounds_y_up'],'safe_culling_envelope_y_up':three['exported_safe_bounds_y_up'],'defeat_held_lowest_point_m':three['animations']['defeat']['bounds_y_up']['min'][1],'note':'glTF axes: +Y up, character faces -Z; anatomical left is -X (wrench arm). Root at the floor origin under the body centre.'}
for name,record in [('provenance.json',provenance),('tool-settings.json',settings),('visual-review.json',visual),('bounds.json',bounds)]:
 (ROOT/name).write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'glb_sha256':digest,'reports':['provenance.json','tool-settings.json','visual-review.json','bounds.json'],'all_technical_checks':True}))
