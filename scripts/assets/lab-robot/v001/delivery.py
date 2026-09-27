"""WO111 lab-robot: supported MCP/HTTP transfer between Blender instance 1 and the durable artifact directory.

  fetch   copy the exact masters and remote reports down (after the final animate/validate/attachment runs)
  stage   copy model sources locally, push the locally produced reports and stills up, assert every report
          names the same GLB and passes, before the scene release
  finish  after release_model.py: fetch the release files and write the SHA-256 manifest with a
          remote/local byte match for every mirrored file
The sheet-stage files (reference sheet, blockout, sheet scripts, previews) stay where the sheet notes name them;
the sheet's own lease, release, manifest, live scene and claim checkpoint were copied to sheet-stage/ before the
model stage replaced the top-level lease records. Adapted from the radio-host-showman v001 delivery.py."""
from pathlib import Path
from urllib.request import urlopen
from urllib.error import HTTPError
import hashlib,json,shutil,sys,datetime
sys.dont_write_bytecode=True
from mclient import MCP,REMOTE,ARTIFACTS,upload
LOCAL=Path('/home/dev/artifacts/haynes-quest/family-eras/lab-robot/v001')
SOURCE=Path(__file__).resolve().parent
sha=lambda data:hashlib.sha256(data).hexdigest()
MASTERS=['lab-robot.blend','lab-robot.glb','pigment.png','construction.json','validation.json','attachment-inspection.json','lab-robot-construction.blend','lab-robot-checkpoint.glb','model-claim-checkpoint.blend']
STILLS=['front.png','side.png','back.png','threequarter.png','beauty.png','rest-front.png','rest-side.png','rest-back.png','rest-threequarter.png','rest-beauty.png','dark-front.png','dark-beauty.png','dark-attack-contact.png','dark-defeat-sparks.png','dark-defeat-held.png','motion-contact-sheet.png','attack-strip.png','attack-gameplay-scale.png','browser-inspection.json']
REPORTS=['three-inspection.json','visual-review.json','provenance.json','tool-settings.json','bounds.json','sheet-vs-export.png']
INPUTS=['reference-sheet.png','lab-robot-blockout.blend','lab-robot-reference-sheet.blend','blockout-measurements.json','part-measurements.json','sheet-render.json','lab-robot-reference-sheet-checkpoint.blend','claim-checkpoint.blend']
REPORT_CHECKS=['validation.json','three-inspection.json','browser-inspection.json','attachment-inspection.json']
SRC_EXT=('.py','.mjs','.json','.sh')
TEXT_EXT=('.py','.mjs','.md','.txt','.sh')

def fetch(relative):
 p=LOCAL/relative;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(urlopen(ARTIFACTS+relative,timeout=300).read());return p

def check_reports():
 expected=sha((LOCAL/'lab-robot.glb').read_bytes())
 for name in REPORT_CHECKS:
  r=json.loads((LOCAL/name).read_text());assert r.get('sha256',r.get('glb_sha256'))==expected,(name,'wrong GLB');assert all(r['checks'].values()),(name,{k:v for k,v in r['checks'].items() if not v})
 return expected

def model_sources():return [p for p in sorted(SOURCE.iterdir()) if p.suffix in SRC_EXT and p.is_file()]

mode=sys.argv[1]
if mode=='fetch':
 assert (LOCAL/'sheet-stage/scene-release.json').exists(),'sheet-stage records must be preserved first'
 for name in MASTERS+['source/rig-rest.json']:fetch(name)
 print(json.dumps({'fetched':MASTERS,'glb_sha256':sha((LOCAL/'lab-robot.glb').read_bytes())}))
elif mode=='stage':
 client=MCP();client.guard()
 sheet_scripts={p.name for p in (LOCAL/'sheet-stage/source').iterdir()}
 for p in model_sources():
  assert p.name not in sheet_scripts,('model script would overwrite a sheet script',p.name)
  shutil.copy2(p,LOCAL/'source'/p.name);upload(client,p,'source/'+p.name)
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
 mirrored=MASTERS+STILLS+REPORTS+INPUTS+['scene-lease.json','scene-release.json','live-scene-release.blend','source/rig-rest.json','reference-notes.md']
 mirrored+=['source/'+p.name for p in model_sources()]
 mirrored+=['final-preview/'+p.name for p in sorted((LOCAL/'final-preview').iterdir()) if p.suffix in ('.png','.json')]
 mirrored+=['sheet-stage/'+n for n in ('scene-lease.json','scene-release.json','live-scene-release.blend','claim-checkpoint.blend','sheet-render.json')]
 mirrored+=['preview/'+p.name for p in sorted((LOCAL/'preview').iterdir())]
 mirrored+=['source/'+n for n in sorted(p.name for p in (LOCAL/'sheet-stage/source').iterdir()) if n not in ('run.py','transfer.py','upload_notes.py','collect.py','fetchprev.py')]
 local_only=['sheet-stage/sha256-manifest.json']+['sheet-stage/source/'+p.name for p in sorted((LOCAL/'sheet-stage/source').iterdir())]
 local_only+=['source/'+p.name for p in sorted((LOCAL/'source').iterdir()) if 'source/'+p.name not in mirrored]
 files=[];seen=set()
 for name in mirrored:
  if name in seen:continue
  seen.add(name);data=(LOCAL/name).read_bytes()
  if Path(name).suffix in TEXT_EXT:
   client.execute('import hashlib\nfrom pathlib import Path\nassert hashlib.sha256(Path('+repr(REMOTE+'/'+name)+').read_bytes()).hexdigest()=='+repr(sha(data)))
   how='MCP SHA-256 (the artifact route does not serve text sources)'
  else:
   assert sha(data)==sha(urlopen(ARTIFACTS+name,timeout=300).read()),name;how='HTTP byte round trip'
  files.append({'path':name,'bytes':len(data),'sha256':sha(data),'remote_local_match':True,'verified_by':how})
 for name in local_only:
  if name in seen:continue
  seen.add(name);data=(LOCAL/name).read_bytes()
  files.append({'path':name,'bytes':len(data),'sha256':sha(data),'remote_local_match':'not mirrored: local-only helper or sheet-stage record kept unchanged'})
 record={'work_order':'WO111','asset_id':'lab-robot','version':'v001','status':'model-delivered','source':'Blender reference sheet, no generated concept',
  'created_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'local_root':str(LOCAL),'remote_root':REMOTE,'blender_instance':'blender-authoring (instance 1, primary)',
  'scene_lease':'released','scene_released_utc':release['released_utc'],'candidate_status':"Awaiting Tom's review · used in the family release",'glb_sha256':expected,'files':files,
  'all_mirrored_remote_local_hashes_match':True,'verification_method':'MCP SHA-256 for source/text extensions; HTTP byte round trip for media, JSON and masters.',
  'excluded':['remote *.blend1 files are Blender automatic backups and are not copied.','remote author-preview/ (paint_test.py atlas preview) and the local scratch renders are author helpers, not evidence.',
   'sheet-stage/ holds the reference-sheet stage lease, release, manifest, live scene and scripts; sheet-stage/sha256-manifest.json and the sheet-stage local helpers (run.py, transfer.py, upload_notes.py, collect.py, fetchprev.py) were never on the remote.'],
  'manifest_self_hash':'Excluded to avoid recursive hashing.'}
 (LOCAL/'sha256-manifest.json').write_text(json.dumps(record,indent=2)+'\n');upload(client,LOCAL/'sha256-manifest.json','sha256-manifest.json')
 print(json.dumps({'stage':'complete','files':len(files),'manifest_sha256':sha((LOCAL/'sha256-manifest.json').read_bytes()),'scene_lease':'released','glb_sha256':expected,'master_sha256':sha((LOCAL/'lab-robot.blend').read_bytes())}))
else:raise SystemExit('Use fetch, stage or finish')
