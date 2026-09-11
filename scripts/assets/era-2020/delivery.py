"""Finalize checked WO-014 artifacts on the authoring PVC, after all renders."""
from pathlib import Path
import hashlib,json,subprocess,sys,datetime,base64

ROOT=Path(sys.argv[1] if len(sys.argv)>1 else '/workspace/haynes-quest/era-2020/v001')
NAMES=['blockling','signal-moth','buffer-baron']
CLIPS=['idle','move','attack','hit','defeat']

def digest(path):
 data=path.read_bytes();return {'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}

def deliver():
 sources=json.loads((ROOT/'source-concepts.json').read_text());records={}
 for name in NAMES:
  folder=ROOT/name;construction=json.loads((folder/'construction.json').read_text());exact=digest(folder/(name+'.glb'))
  assert construction['files'][name+'.glb']==exact
  for report,key in [('validation.json','sha256'),('three-inspection.json','glb_sha256'),('browser-inspection.json','glb_sha256'),('export-inspection.json','glb_sha256'),('render-complete.json','sha256')]:
   data=json.loads((folder/report).read_text());assert data[key]==exact['sha256'],(name,report,'wrong hash')
   if 'checks' in data:assert all(data['checks'].values()),(name,report,data['checks'])
  completion=json.loads((folder/'render-complete.json').read_text());assert completion['stills'] and completion['video']
  runtime={'asset_id':name,'version':'v001','glb':name+'.glb','glb_sha256':exact['sha256'],'runtime_scale':1.0,'units':'meters','up':'+Y','forward':'-Z','root_origin':'ground; fixed local translation','ground_to_top_m':construction['spec']['height'],'lowest_rest_geometry_y_m':construction['spec']['floor'],'wingspan_m':construction['spec']['width'],'clip_playback':[],'attack':{},'defeat_end':'Collapsed/drooping pose; play once and clamp the last frame until removal. Do not reset to bind pose.','lifecycle':'Stop actions, uncache mixer root and dispose resources when the owning encounter is removed; controller movement stays external.'}
  for clip in construction['clips']:
   runtime['clip_playback'].append({**clip,'playback':'repeat' if clip['loop'] else 'once','clamp_when_finished':not clip['loop']})
   if clip['name']=='attack':runtime['attack']={'duration_s':clip['duration_s'],'contact_time_s':clip['impact_time_s'],'contact_fraction':clip['impact_time_s']/clip['duration_s'],'windup_to_contact_s':clip['impact_time_s'],'follow_through_s':clip['duration_s']-clip['impact_time_s']}
  (folder/'runtime.json').write_text(json.dumps(runtime,indent=2)+'\n')
  files=[name+'.glb',name+'.blend','pigment.png','construction-source.py','construction.json','validation.json','three-inspection.json','browser-inspection.json','export-inspection.json','render-complete.json','runtime.json','beauty.png','front.png','side.png','back.png','browser-beauty.png','motion-grid.png','animations.mp4','turntable.mp4']+[c+'.mp4' for c in CLIPS]
  videos={}
  for file in [f for f in files if f.endswith('.mp4')]:
   info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(folder/file)],text=True))
   stream=next(s for s in info['streams'] if s['codec_type']=='video');duration=float(info['format']['duration'])
   assert stream['codec_name']=='h264' and stream['pix_fmt']=='yuv420p'
   expected=3.0 if file=='turntable.mp4' else (sum(c['duration_s'] for c in construction['clips']) if file=='animations.mp4' else next(c['duration_s'] for c in construction['clips'] if c['name']+'.mp4'==file))
   assert abs(duration-expected)<.05,(name,file,duration,expected)
   videos[file]={'duration_s':duration,'expected_s':expected,'codec':stream['codec_name'],'pixel_format':stream['pix_fmt'],'width':stream['width'],'height':stream['height']}
  manifest={'asset_id':name,'version':'v001','approval':'candidate; owner approval pending','remote_directory':str(folder),'source_concept':sources[name],'construction':construction,'runtime':runtime,'videos':videos,'files':{f:digest(folder/f) for f in files}}
  (folder/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');manifest['files']['manifest.json']=digest(folder/'manifest.json')
  records[name]=manifest
 common=['build.py','render.py','validate.mjs','inspect-three.mjs','inspect-browser.mjs','delivery.py','collect.py','source-concepts.json','scene-lease.json','render-process-completion.json']
 # The artifact endpoint serves media/JSON, so source travels as a checked JSON
 # bundle; do not assume that a source-code suffix is directly downloadable.
 source_paths=[p for p in common if p.endswith(('.py','.mjs'))]+[n+'/construction-source.py' for n in NAMES]
 bundle={'files':{p:{**digest(ROOT/p),'base64':base64.b64encode((ROOT/p).read_bytes()).decode()} for p in source_paths}}
 (ROOT/'source-bundle.json').write_text(json.dumps(bundle,indent=2)+'\n');common.append('source-bundle.json')
 delivery={'work_order':'WO-014','generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(ROOT),'assets':records,'scripts':{f:digest(ROOT/f) for f in common}}
 (ROOT/'delivery-manifest.json').write_text(json.dumps(delivery,indent=2)+'\n')
 print(json.dumps({'assets':{n:{'files':len(r['files']),'glb':r['files'][n+'.glb']} for n,r in records.items()},'delivery_manifest':digest(ROOT/'delivery-manifest.json')}))

if __name__=='__main__':deliver()
