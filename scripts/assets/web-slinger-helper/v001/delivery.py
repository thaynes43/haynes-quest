"""WO111 web-slinger-helper: supported MCP/HTTP transfer between Blender instance 1 and the durable artifact directory.

  fetch   copy the exact masters and remote reports down (after the final animate/validate/attachment runs)
  stage   copy sources locally, push the locally produced reports and stills up, assert every report names the same
          GLB and passes, before the scene release
  finish  after release_model.py: fetch the release files and write the SHA-256 manifest with a remote/local byte
          match for every mirrored file
The sheet-stage inputs (reference sheet, notes, blockout, sheet scene, previews, measurements) stay where the sheet
notes name them; the sheet's own lease, release, manifest, live scene, claim checkpoint and scripts were copied to
sheet-stage/ before the model stage replaced the top-level lease records. Adapted from the demon-band-idol v001
delivery.py (instance 2 there; instance 1 here)."""
from pathlib import Path
from urllib.request import urlopen
import hashlib,json,shutil,sys,datetime
sys.dont_write_bytecode=True
from transfer import MCP,REMOTE,ARTIFACTS,upload
LOCAL=Path('/home/dev/artifacts/haynes-quest/family-eras/web-slinger-helper/v001')
SOURCE=Path(__file__).resolve().parent
sha=lambda data:hashlib.sha256(data).hexdigest()
MASTERS=['web-slinger-helper.blend','web-slinger-helper.glb','pigment.png','construction.json','validation.json','attachment-inspection.json','web-slinger-helper-construction.blend','web-slinger-helper-checkpoint.glb','model-claim-checkpoint.blend']
STILLS=['front.png','side.png','back.png','threequarter.png','beauty.png','rest-front.png','rest-side.png','rest-back.png','rest-threequarter.png','rest-beauty.png','motion-contact-sheet.png','attack-strip.png','attack-gameplay-scale.png','browser-inspection.json']
REPORTS=['three-inspection.json','visual-review.json','provenance.json','tool-settings.json','bounds.json','sheet-vs-export.png']
INPUTS=['reference-sheet.png','reference-notes.md','web-slinger-helper-blockout.blend','web-slinger-helper-reference-sheet.blend','blockout-measurements.json','part-measurements.json','sheet-render.json','web-slinger-helper-reference-sheet-checkpoint.blend','claim-checkpoint.blend']
REPORT_CHECKS=['validation.json','three-inspection.json','browser-inspection.json','attachment-inspection.json']
SRC_EXT=('.py','.mjs','.json','.sh')
SHEET_SCRIPTS=['build_blockout.py','sheet.py','crops.py','final_render.py','iterate_preview.py','measure_parts.py','claim.py','release.py']

def fetch(relative):
 p=LOCAL/relative;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(urlopen(ARTIFACTS+relative,timeout=300).read());return p

def check_reports():
 expected=sha((LOCAL/'web-slinger-helper.glb').read_bytes())
 for name in REPORT_CHECKS:
  r=json.loads((LOCAL/name).read_text());assert r.get('sha256',r.get('glb_sha256'))==expected,(name,'wrong GLB');assert all(r['checks'].values()),(name,{k:v for k,v in r['checks'].items() if not v})
 return expected

def model_sources():return [p for p in sorted(SOURCE.iterdir()) if p.suffix in SRC_EXT and p.is_file()]

mode=sys.argv[1]
if mode=='fetch':
 assert (LOCAL/'sheet-stage/scene-release.json').exists(),'sheet-stage records must be preserved first'
 for name in MASTERS+['source/rig-rest.json']:fetch(name)
 print(json.dumps({'fetched':MASTERS,'glb_sha256':sha((LOCAL/'web-slinger-helper.glb').read_bytes())}))
elif mode=='stage':
 client=MCP();client.guard()
 sheet_copy={p.name:p for p in (LOCAL/'sheet-stage/source').iterdir()}
 for p in model_sources():
  dst=LOCAL/'source'/p.name
  if dst.exists() and p.name in sheet_copy and dst.read_bytes()==sheet_copy[p.name].read_bytes() and dst.read_bytes()!=p.read_bytes():
   print('replacing sheet-stage script (byte copy kept in sheet-stage/source/):',p.name)
  shutil.copy2(p,dst);upload(client,p,'source/'+p.name)
 for name in STILLS:shutil.copy2(LOCAL/'final-preview'/name,LOCAL/name);upload(client,LOCAL/name,name)
 for p in sorted((LOCAL/'final-preview').iterdir()):
  if p.suffix in ('.png','.json'):upload(client,p,'final-preview/'+p.name)
 for name in REPORTS:upload(client,LOCAL/name,name)
 expected=check_reports()
 print(json.dumps({'stage':'ready-for-release','glb_sha256':expected,'all_checks':True}))
elif mode=='finish':
 client=MCP()
 for name in ['scene-lease.json','scene-release.json','live-scene-release.blend']:fetch(name)
 release=json.loads((LOCAL/'scene-release.json').read_text());assert release['scene_lease']=='released' and release['blender_instance'].startswith('blender-authoring (instance 1') and not release['prior_family_era_files_changed']
 expected=check_reports();assert release['glb_sha256']==expected
 mirrored=MASTERS+STILLS+REPORTS+INPUTS+['scene-lease.json','scene-release.json','live-scene-release.blend','source/rig-rest.json']
 mirrored+=['source/'+p.name for p in model_sources()]
 mirrored+=['final-preview/'+p.name for p in sorted((LOCAL/'final-preview').iterdir()) if p.suffix in ('.png','.json')]
 mirrored+=['source/'+n for n in SHEET_SCRIPTS]+['preview/'+p.name for p in sorted((LOCAL/'preview').iterdir())]
 mirrored+=['sheet-stage/'+n for n in ('scene-lease.json','scene-release.json','live-scene-release.blend')]
 local_only=['sheet-stage/'+p.name for p in sorted((LOCAL/'sheet-stage').iterdir()) if p.is_file()]+['sheet-stage/source/'+p.name for p in sorted((LOCAL/'sheet-stage/source').iterdir())]
 local_only+=['source/'+p.name for p in sorted((LOCAL/'source').iterdir()) if 'source/'+p.name not in mirrored]
 files=[];seen=set()
 for name in mirrored:
  if name in seen:continue
  seen.add(name);data=(LOCAL/name).read_bytes()
  if Path(name).suffix in ('.py','.mjs','.md','.txt','.sh'):
   client.execute('import hashlib\nfrom pathlib import Path\nassert hashlib.sha256(Path('+repr(REMOTE+'/'+name)+').read_bytes()).hexdigest()=='+repr(sha(data)))
  else:assert sha(data)==sha(urlopen(ARTIFACTS+name,timeout=300).read()),name
  files.append({'path':name,'bytes':len(data),'sha256':sha(data),'remote_local_match':True})
 for name in local_only:
  if name in seen:continue
  seen.add(name);data=(LOCAL/name).read_bytes()
  files.append({'path':name,'bytes':len(data),'sha256':sha(data),'remote_local_match':'not mirrored: a local record (sheet-stage copy or local-only helper)'})
 record={'work_order':'WO111','asset_id':'web-slinger-helper','version':'v001','status':'model-delivered','source':'Blender reference sheet, no generated concept',
  'role':'friendly helper (DESIGN-013)','created_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'local_root':str(LOCAL),'remote_root':REMOTE,'blender_instance':'blender-authoring (instance 1, primary)',
  'scene_lease':'released','scene_released_utc':release['released_utc'],'candidate_status':"Awaiting Tom's review · used in the family release",'glb_sha256':expected,'files':files,
  'all_mirrored_remote_local_hashes_match':True,'verification_method':'MCP SHA-256 for source/text extensions; HTTP byte round trip for media, JSON and masters.',
  'excluded':['Remote *.blend1 files are Blender automatic backups and are not copied.','sheet-stage/ holds byte copies of the reference-sheet stage lease, release, manifest, live scene, claim checkpoint and scripts, made before the model stage replaced the top-level records.'],
  'manifest_self_hash':'Excluded to avoid recursive hashing.'}
 (LOCAL/'sha256-manifest.json').write_text(json.dumps(record,indent=2)+'\n');upload(client,LOCAL/'sha256-manifest.json','sha256-manifest.json')
 print(json.dumps({'stage':'complete','files':len(files),'manifest_sha256':sha((LOCAL/'sha256-manifest.json').read_bytes()),'scene_lease':'released','glb_sha256':expected,'master_sha256':sha((LOCAL/'web-slinger-helper.blend').read_bytes())}))
else:raise SystemExit('Use fetch, stage or finish')
