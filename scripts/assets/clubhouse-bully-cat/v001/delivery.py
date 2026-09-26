"""WO111 supported MCP/HTTP transfer, exact final reports, masters and manifests."""
from pathlib import Path
from urllib.request import urlopen
import base64,hashlib,json,shutil,sys,datetime
sys.dont_write_bytecode=True
from transfer import MCP,REMOTE
LOCAL=Path('/home/dev/artifacts/haynes-quest/family-eras/clubhouse-bully-cat/v001')
SOURCE=Path(__file__).resolve().parent
BASE='http://blender-authoring.dev.svc.cluster.local:8000/artifacts/haynes-quest/family-eras/clubhouse-bully-cat/v001/'
sha=lambda data:hashlib.sha256(data).hexdigest()
client=MCP()

def upload(relative):
 data=(LOCAL/relative).read_bytes();target=REMOTE+'/'+relative
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
 for name in ['front.png','side.png','back.png','beauty.png','motion-contact-sheet.png','attack-strip.png','attack-gameplay-scale.png','browser-inspection.json']:
  shutil.copy2(LOCAL/'final-preview'/name,LOCAL/name);upload(name)
 for p in sorted((LOCAL/'final-preview').iterdir()):
  if p.suffix=='.png':upload('final-preview/'+p.name)
 for name in ['three-inspection.json','visual-review.json','prompt.txt','source.json']:upload(name)
 for name in ['clubhouse-bully-cat.blend','clubhouse-bully-cat.glb','pigment.png','construction.json','validation.json','source/rig-rest.json']:fetch(name)
 reports=[json.loads((LOCAL/name).read_text()) for name in ['validation.json','three-inspection.json','browser-inspection.json']]
 expected=sha((LOCAL/'clubhouse-bully-cat.glb').read_bytes())
 assert all(r.get('sha256',r.get('glb_sha256'))==expected and all(r['checks'].values()) for r in reports)
 print(json.dumps({'stage':'ready-for-release','glb_sha256':expected,'all_checks':True}))
elif sys.argv[1]=='finish':
 for name in ['scene-lease.json','scene-release.json','live-scene-release.blend']:fetch(name)
 assert json.loads((LOCAL/'scene-release.json').read_text())['scene_lease']=='released'
 names=['clubhouse-bully-cat.blend','clubhouse-bully-cat.glb','pigment.png','concept.png','prompt.txt','source.json','construction.json','validation.json','three-inspection.json','browser-inspection.json','visual-review.json','scene-lease.json','scene-release.json','live-scene-release.blend','front.png','side.png','back.png','beauty.png','motion-contact-sheet.png','attack-strip.png','attack-gameplay-scale.png']
 names+=['source/'+p.name for p in sorted((LOCAL/'source').iterdir()) if p.is_file()]
 names+=['final-preview/'+p.name for p in sorted((LOCAL/'final-preview').iterdir()) if p.suffix=='.png']
 files=[]
 for name in names:
  data=(LOCAL/name).read_bytes()
  if Path(name).suffix in ('.py','.mjs','.txt'):
   client.execute('import hashlib\nfrom pathlib import Path\nassert hashlib.sha256(Path('+repr(REMOTE+'/'+name)+').read_bytes()).hexdigest()=='+repr(sha(data)))
  else:assert sha(data)==sha(urlopen(BASE+name,timeout=40).read()),name
  files.append({'path':name,'bytes':len(data),'sha256':sha(data),'remote_local_match':True})
 record={'work_order':'WO111','asset_id':'clubhouse-bully-cat','version':'v001','created_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'local_root':str(LOCAL),'remote_root':REMOTE,'scene_lease':'released','candidate_status':"Awaiting Tom's review · used in the family release",'files':files,'all_remote_local_hashes_match':True,'verification_method':'MCP SHA-256 for source/text extensions; HTTP byte roundtrip for media, JSON and masters.','excluded_checkpoints':['early-preview/','motion-preview/','shoulder-preview/','clubhouse-bully-cat-checkpoint.glb','clubhouse-bully-cat-construction.blend','pre-final-bounds-run.json','bounds-run.json'],'manifest_self_hash':'Excluded to avoid recursive hashing.'}
 (LOCAL/'sha256-manifest.json').write_text(json.dumps(record,indent=2)+'\n');upload('sha256-manifest.json')
 print(json.dumps({'stage':'complete','files':len(files),'manifest_sha256':sha((LOCAL/'sha256-manifest.json').read_bytes()),'scene_lease':'released','glb_sha256':sha((LOCAL/'clubhouse-bully-cat.glb').read_bytes()),'master_sha256':sha((LOCAL/'clubhouse-bully-cat.blend').read_bytes())}))
else:raise SystemExit('Use stage or finish')
