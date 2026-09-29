"""WO111 web-slinger-helper v001: claim the exclusive scene lease on Blender instance 1 (model stage).

Runs inside Blender via author_run.py (after /readyz is checked locally). Refuses if a lease is active, an author job
is running or the predecessor scene has unsaved edits. Keeps a recovery copy of the released predecessor scene
(model-claim-checkpoint.blend; the sheet stage's claim-checkpoint.blend is left alone), keeps a remote copy of the
sheet-stage lease records under sheet-stage/, fingerprints every earlier family-era .blend/.glb so the release can
prove none changed, and verifies the approved sheet inputs by SHA-256 before stamping the lease.
Adapted from the WO111 demon-band-idol claim.py / claim_model.py precedents."""
import bpy,json,hashlib,datetime,shutil
from pathlib import Path
ROOT=Path('/workspace/haynes-quest/family-eras/web-slinger-helper/v001');ERAS=ROOT.parent.parent
OWNER='gpt-6-astra max / WO111 web-slinger-helper / hq-web-slinger-helper 2026-09-29'
APPROVED={'reference-sheet.png':'54b756f6b8f2753990a1de0d348cc4f0692e470520030dea3ecc4fb44b3c8deb',
 'web-slinger-helper-blockout.blend':'68b4e49d2b9ab8d2d26740ffd61b2c45abdb20cbef0ac772dcd9c06ed23bc505',
 'reference-notes.md':'0ea718598806c763613b69af8d2a2265b5c044b7f4e6607ce030d1cc6c8531ed'}
sc=bpy.context.scene
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
props={k:str(sc[k]) for k in ('work_order','scene_owner','scene_lease','asset_id','asset_version','authoring_model','candidate_status') if k in sc.keys()}
jobs={j:bpy.app.is_job_running(j) for j in ['RENDER','RENDER_PREVIEW','OBJECT_BAKE','COMPOSITE']}
assert not any(jobs.values()),jobs
assert props.get('scene_lease') in (None,'released') and props.get('scene_owner') in (None,'none'),('scene held',props)
assert not bpy.data.is_dirty,'predecessor scene has unsaved edits'
inputs={n:sha(ROOT/n) for n in APPROVED}
assert inputs==APPROVED,('approved sheet inputs changed',inputs)
(ROOT/'sheet-stage').mkdir(exist_ok=True)
for n in ('scene-lease.json','scene-release.json','live-scene-release.blend'):
 if not (ROOT/'sheet-stage'/n).exists():shutil.copy2(ROOT/n,ROOT/'sheet-stage'/n)
pred=bpy.data.filepath
prior={}
for p in sorted(ERAS.glob('*/v*/*')):
 if p.suffix in ('.blend','.glb') and 'web-slinger-helper' not in p.parts:prior[str(p.relative_to(ERAS))]={'path':str(p),'sha256':sha(p)}
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'model-claim-checkpoint.blend'),copy=True,compress=True)
for k in list(sc.keys()):
 if not k.startswith('blendermcp_') and k!='cycles':del sc[k]
sc['work_order']='WO111';sc['scene_owner']=OWNER;sc['scene_lease']='active'
sc['asset_id']='web-slinger-helper';sc['asset_version']='v001';sc['authoring_model']='gpt-6-astra max'
sc['candidate_status']='WO111 web-slinger-helper v001 · full model in progress (Blender reference sheet, no generated concept)'
lease={'work_order':'WO111','asset_id':'web-slinger-helper','version':'v001',
 'task':'full model from the approved Blender reference sheet (refine, UV, rig, five friendly clips, export, evidence)',
 'blender_instance':'blender-authoring (instance 1, primary)','scene_owner':OWNER,'scene_lease':'active','status':'active','claimed_utc':now,
 'predecessor':{'scene_file':pred,'scene_file_sha256':sha(pred) if pred else None,'dirty':False,'props_before':props},
 'approved_inputs_sha256':inputs,'claim_checkpoint':str(ROOT/'model-claim-checkpoint.blend'),'claim_checkpoint_sha256':sha(ROOT/'model-claim-checkpoint.blend'),
 'sheet_stage_records':'sheet-stage/ (copies of the sheet lease, release and live scene)',
 'previous_model_stage':'model-stage-0926-preserved/ (all unfinished model/source files preserved before this claim)',
 'jobs_at_claim':jobs,'prior_files':prior}
(ROOT/'scene-lease.json').write_text(json.dumps(lease,indent=2)+'\n')
print(json.dumps({k:lease[k] for k in ('claimed_utc','scene_owner','scene_lease','predecessor','claim_checkpoint_sha256','approved_inputs_sha256')}|{'prior_files':len(prior)},indent=1))
