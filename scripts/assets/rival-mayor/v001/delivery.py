"""WO111 rival-mayor: supported MCP/HTTP transfer between Blender instance 2 and the durable artifact directory.

  fetch   copy the exact masters and remote reports down (after the final animate/validate/attachment runs)
  stage   copy sources locally, push the locally produced reports and stills up, assert every report
          names the same GLB and passes, before the scene release
  finish  after release_model.py: fetch the release files and write the SHA-256 manifest with a
          remote/local byte match for every mirrored file
The sheet-stage files (reference sheet, blockout, sheet scripts, the sheet's own lease/release/manifest)
are kept; the sheet's top-level lease records move to sheet-stage/ before the model's replace them."""
from pathlib import Path
from urllib.request import urlopen
import hashlib,json,shutil,sys,datetime
sys.dont_write_bytecode=True
from transfer import MCP,REMOTE,ARTIFACTS,upload
LOCAL=Path('/home/dev/artifacts/haynes-quest/family-eras/rival-mayor/v001')
SOURCE=Path(__file__).resolve().parent
sha=lambda data:hashlib.sha256(data).hexdigest()
MASTERS=['rival-mayor.blend','rival-mayor.glb','pigment.png','construction.json','validation.json','attachment-inspection.json','rival-mayor-construction.blend','rival-mayor-checkpoint.glb']
STILLS=['front.png','side.png','back.png','threequarter.png','beauty.png','motion-contact-sheet.png','attack-strip.png','attack-gameplay-scale.png','browser-inspection.json']
REPORTS=['three-inspection.json','visual-review.json','provenance.json','tool-settings.json','bounds.json','sheet-vs-export.png']
INPUTS=['reference-sheet.png','reference-notes.md','rival-mayor-blockout.blend','rival-mayor-reference-sheet.blend','blockout-measurements.json']
SHEET_RECORDS=['scene-lease.json','scene-release.json','sha256-manifest.json','live-scene-release.blend']
REPORT_CHECKS=['validation.json','three-inspection.json','browser-inspection.json','attachment-inspection.json']

def fetch(relative):
 p=LOCAL/relative;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(urlopen(ARTIFACTS+relative,timeout=120).read());return p

def preserve_sheet_records():
 dest=LOCAL/'sheet-stage'
 if dest.exists():return
 dest.mkdir()
 for name in SHEET_RECORDS:
  if (LOCAL/name).exists():shutil.copy2(LOCAL/name,dest/name)
 (dest/'README.md').write_text('Records of the reference-sheet stage (blender-authoring instance 1, Sept 26 02:14-02:28 UTC), kept when the\nfull-model stage on instance 2 wrote its own scene-lease.json, scene-release.json, live-scene-release.blend and\nsha256-manifest.json at the top level. The sheet inputs and scripts stay where the sheet notes name them.\n')

def check_reports():
 expected=sha((LOCAL/'rival-mayor.glb').read_bytes())
 for name in REPORT_CHECKS:
  r=json.loads((LOCAL/name).read_text());assert r.get('sha256',r.get('glb_sha256'))==expected,(name,'wrong GLB');assert all(r['checks'].values()),(name,{k:v for k,v in r['checks'].items() if not v})
 return expected

mode=sys.argv[1]
if mode=='fetch':
 preserve_sheet_records()
 for name in MASTERS+['source/rig-rest.json']:fetch(name)
 print(json.dumps({'fetched':MASTERS,'glb_sha256':sha((LOCAL/'rival-mayor.glb').read_bytes())}))
elif mode=='stage':
 client=MCP()
 client.execute("import bpy; sc=bpy.context.scene; assert sc.get('work_order')=='WO111' and sc.get('asset_id')=='rival-mayor' and sc.get('scene_lease')=='active'")
 for p in sorted(SOURCE.iterdir()):
  if p.suffix in ('.py','.mjs','.json') and p.is_file():
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
 release=json.loads((LOCAL/'scene-release.json').read_text());assert release['scene_lease']=='released' and release['blender_instance']=='blender-authoring-2'
 expected=check_reports();assert release['glb_sha256']==expected
 mirrored=MASTERS+STILLS+REPORTS+INPUTS+['scene-lease.json','scene-release.json','live-scene-release.blend','source/rig-rest.json']
 mirrored+=['source/'+p.name for p in sorted(SOURCE.iterdir()) if p.suffix in ('.py','.mjs','.json') and p.is_file()]
 mirrored+=['final-preview/'+p.name for p in sorted((LOCAL/'final-preview').iterdir()) if p.suffix in ('.png','.json')]
 local_only=['sheet-stage/'+p.name for p in sorted((LOCAL/'sheet-stage').iterdir())]+['preview/'+p.name for p in sorted((LOCAL/'preview').iterdir())]+['pre-takeover-live-scene.blend']
 mirrored+=['source/build_blockout.py','source/sheet.py']
 local_only+=['source/'+n for n in ('release.py','run.py','sheet_preview.py')]
 files=[];seen=set()
 for name in mirrored:
  if name in seen:continue
  seen.add(name);data=(LOCAL/name).read_bytes()
  remote='sheet-source/'+name.split('/',1)[1] if name in ('source/build_blockout.py','source/sheet.py') else name
  if Path(name).suffix in ('.py','.mjs','.md','.txt'):
   client.execute('import hashlib\nfrom pathlib import Path\nassert hashlib.sha256(Path('+repr(REMOTE+'/'+remote)+').read_bytes()).hexdigest()=='+repr(sha(data)))
  else:assert sha(data)==sha(urlopen(ARTIFACTS+remote,timeout=120).read()),name
  files.append({'path':name,'bytes':len(data),'sha256':sha(data),'remote_local_match':True})
 for name in local_only:
  if name in seen:continue
  seen.add(name);data=(LOCAL/name).read_bytes()
  files.append({'path':name,'bytes':len(data),'sha256':sha(data),'remote_local_match':'not mirrored: reference-sheet stage record from instance 1, kept unchanged'})
 record={'work_order':'WO111','asset_id':'rival-mayor','version':'v001','status':'model-delivered','source':'Blender reference sheet, no generated concept',
  'created_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'local_root':str(LOCAL),'remote_root':REMOTE,'blender_instance':'blender-authoring-2',
  'scene_lease':'released','candidate_status':"Awaiting Tom's review · used in the family release",'glb_sha256':expected,'files':files,
  'all_mirrored_remote_local_hashes_match':True,'verification_method':'MCP SHA-256 for source/text extensions; HTTP byte round trip for media, JSON and masters.',
  'excluded':['sheet-stage/ holds the reference-sheet stage lease, release and manifest (instance 1); they are listed but not mirrored on instance 2.'],'manifest_self_hash':'Excluded to avoid recursive hashing.'}
 (LOCAL/'sha256-manifest.json').write_text(json.dumps(record,indent=2)+'\n');upload(client,LOCAL/'sha256-manifest.json','sha256-manifest.json')
 print(json.dumps({'stage':'complete','files':len(files),'manifest_sha256':sha((LOCAL/'sha256-manifest.json').read_bytes()),'scene_lease':'released','glb_sha256':expected,'master_sha256':sha((LOCAL/'rival-mayor.blend').read_bytes())}))
else:raise SystemExit('Use fetch, stage or finish')
