"""WO103 durable artifact intake, supported MCP transfer, hashes and release.

stage copies audited local stills/reports to the authoring PVC and verifies every
final deliverable; finish fetches the saved release and writes the exact manifest.
Only the work order's v001 artifact paths and source directory are used.
"""
from pathlib import Path
from urllib.request import urlopen
import base64,hashlib,json,shutil,sys,datetime
sys.dont_write_bytecode=True
from transfer import MCP,REMOTE
LOCAL=Path('/home/dev/artifacts/haynes-quest/rat-casino-cast/moth-projectionist/v001')
SOURCE=Path(__file__).resolve().parent
BASE='http://blender-authoring.dev.svc.cluster.local:8000/artifacts/haynes-quest/rat-casino-cast/moth-projectionist/v001/'
sha=lambda data:hashlib.sha256(data).hexdigest()
client=MCP()

def upload(relative):
 p=LOCAL/relative;data=p.read_bytes();target=REMOTE+'/'+relative
 client.execute('from pathlib import Path\np=Path('+repr(target)+');p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b"")')
 for offset in range(0,len(data),96000):
  encoded=base64.b64encode(data[offset:offset+96000]).decode()
  client.execute('import base64\nfrom pathlib import Path\nwith Path('+repr(target)+').open("ab") as f:f.write(base64.b64decode('+repr(encoded)+'))')
 client.execute('import hashlib\nfrom pathlib import Path\nassert hashlib.sha256(Path('+repr(target)+').read_bytes()).hexdigest()=='+repr(sha(data)))

def fetch(relative):
 p=LOCAL/relative;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(urlopen(BASE+relative,timeout=40).read())

if sys.argv[1]=='stage':
 for p in sorted(SOURCE.iterdir()):
  if p.suffix in ('.py','.mjs','.json'):
   target=LOCAL/'source'/p.name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target);upload('source/'+p.name)
 for name in ['front.png','side.png','back.png','beauty.png','detail.png','hinge.png','motion-contact-sheet.png','attack-strip.png','attack-gameplay-scale.png','browser-inspection.json']:
  shutil.copy2(LOCAL/'final-preview'/name,LOCAL/name);upload(name)
 for p in sorted((LOCAL/'final-preview').iterdir()):
  if p.suffix=='.png':upload('final-preview/'+p.name)
 for name in ['three-inspection.json','visual-review.json','provenance.json','source-prompt.txt','tool-settings.json']:upload(name)
 if (LOCAL/'metadata-correction.json').exists():upload('metadata-correction.json')
 for name in ['moth-projectionist.blend','moth-projectionist.glb','pigment.png','construction.json','validation.json','source/rig-rest.json']:fetch(name)
 reports=[json.loads((LOCAL/name).read_text()) for name in ['validation.json','three-inspection.json','browser-inspection.json']]
 expected=sha((LOCAL/'moth-projectionist.glb').read_bytes())
 assert all(r.get('sha256',r.get('glb_sha256'))==expected and all(r['checks'].values()) for r in reports)
 print(json.dumps({'stage':'ready-for-release','glb_sha256':expected,'all_checks':True}))
elif sys.argv[1]=='finish':
 shutil.copy2(SOURCE/'delivery.py',LOCAL/'source/delivery.py');upload('source/delivery.py')
 for name in ['scene-lease.json','scene-release.json','live-scene-release.blend']:fetch(name)
 assert json.loads((LOCAL/'scene-release.json').read_text())['scene_lease']=='released'
 names=['moth-projectionist.blend','moth-projectionist.glb','pigment.png','construction.json','validation.json','three-inspection.json','browser-inspection.json','visual-review.json','provenance.json','source-prompt.txt','tool-settings.json','scene-lease.json','scene-release.json','live-scene-release.blend','front.png','side.png','back.png','beauty.png','detail.png','hinge.png','motion-contact-sheet.png','attack-strip.png','attack-gameplay-scale.png']
 if (LOCAL/'metadata-correction.json').exists():names.append('metadata-correction.json')
 names += ['source/'+p.name for p in sorted((LOCAL/'source').iterdir()) if p.is_file()]
 names += ['final-preview/'+p.name for p in sorted((LOCAL/'final-preview').iterdir()) if p.suffix=='.png']
 files=[]
 for name in names:
  data=(LOCAL/name).read_bytes()
  if Path(name).suffix in ('.py','.mjs','.txt'):
   client.execute('import hashlib\nfrom pathlib import Path\nassert hashlib.sha256(Path('+repr(REMOTE+'/'+name)+').read_bytes()).hexdigest()=='+repr(sha(data)))
  else:
   remote=urlopen(BASE+name,timeout=40).read();assert sha(data)==sha(remote),name
  files.append({'path':name,'bytes':len(data),'sha256':sha(data),'remote_local_match':True})
 record={'work_order':'WO103','asset_id':'moth-projectionist','version':'v001','created_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'local_root':str(LOCAL),'remote_root':REMOTE,'scene_lease':'released','candidate_status':'Validated studio candidate; exact owner review pending; no gameplay mapping','files':files,'all_remote_local_hashes_match':True,'verification_method':'MCP SHA-256 for source/script/text extensions (artifact HTTP route does not serve them); HTTP byte roundtrip for media, JSON and masters.','excluded_checkpoints':['early-preview/','revised-preview/','revised-attack-preview/','moth-projectionist-checkpoint.glb','moth-projectionist-construction.blend'],'manifest_self_hash':'Excluded to avoid recursive hashing.'}
 if (LOCAL/'metadata-correction.json').exists():
  record['correction_work_order']='WO105';record['excluded_checkpoints']+=['pre-WO105-metadata-correction/','corrected-preview/']
 (LOCAL/'sha256-manifest.json').write_text(json.dumps(record,indent=2)+'\n');upload('sha256-manifest.json')
 print(json.dumps({'stage':'complete','files':len(files),'manifest_sha256':sha((LOCAL/'sha256-manifest.json').read_bytes()),'scene_lease':'released','glb_sha256':sha((LOCAL/'moth-projectionist.glb').read_bytes())}))
else:raise SystemExit('Use stage or finish')
