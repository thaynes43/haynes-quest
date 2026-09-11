"""WO032 exact source/artifact inventory; run only after all owned jobs finish."""
from pathlib import Path
from datetime import datetime,timezone
import base64,hashlib,json,subprocess

ROOT=Path('/workspace/haynes-quest/parody/remix-trio/v001')
BASE='http://blender-authoring.dev.svc.cluster.local:8000/artifacts/haynes-quest/parody/remix-trio/v001/'
NAMES=['sir-flush-a-lot','nap-captain','one-star-diva'];CLIPS=['idle','move','attack','hit','defeat']
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text())
def write(p,data):p.write_text(json.dumps(data,indent=2)+'\n')

def main():
 lease=read(ROOT/'scene-lease.json');jobs=read(ROOT/'render-process-completion.json')
 assert jobs['all_owned_jobs_exited_and_reaped'];assert lease['status'].startswith('released')
 sources=[]
 for p in sorted(ROOT.iterdir()):
  if p.suffix in ['.py','.mjs']:
   sources.append({'file':p.name,'repository_path':'scripts/assets/parody-remix-trio/'+p.name,'bytes':p.stat().st_size,'sha256':digest(p),'base64':base64.b64encode(p.read_bytes()).decode()})
 write(ROOT/'source-bundle.json',{'work_order':'WO-032','files':sources})
 references=read(ROOT/'concept-references.json');assets=[]
 for name in NAMES:
  folder=ROOT/name;glb=folder/(name+'.glb');sha=digest(glb)
  construction=read(folder/'construction.json');validation=read(folder/'validation.json');inspection=read(folder/'export-inspection.json')
  completion=read(folder/'render-complete.json');three=read(folder/'three-inspection.json');browser=read(folder/'browser-inspection.json');survival=read(folder/'construction-survival.json');lead=read(folder/'lead-checkpoint-review.json')
  assert sha==validation['sha256']==inspection['glb_sha256']==completion['sha256']==three['glb_sha256']==browser['glb_sha256']==survival['glb_sha256']
  for r in [validation,three,browser,survival]:assert all(r['checks'].values()),(name,r['checks'])
  assert completion['stills'] and completion['video']
  assert digest(folder/(name+'.blend'))==construction['files'][name+'.blend']['sha256']
  clips={c['name']:{**c,'playback':'repeat' if c['loop'] else 'once'} for c in construction['clips']};attack=clips['attack']
  clips['defeat'].update({'end_behavior':{'sir-flush-a-lot':'Ducks one head into bowl; lid rests partly closed without cutting crown.','nap-captain':'Sits and yawns with the same left-hand pillow.','one-star-diva':'Sits and pouts with the same right-hand voting paddle.'}[name],'remove_only_after_duration_s':clips['defeat']['duration_s'],'embedded_fade':False})
  runtime={'asset_id':name,'version':'v001','glb':name+'.glb','glb_sha256':sha,'runtime_scale':1,'units':'meters','up':'+Y','forward':'-Z','origin':[0,0,0],'ground_to_top_m':construction['spec']['height'],'rest_ground_y_m':0,'root_motion':'Caller attachment root and root joint remain fixed; body joint has authored steps/squash/lift.','attack_contact_time_s':attack['contact_time_s'],'attack_contact_fraction':attack['contact_fraction'],'clips':clips,'triangles':validation['triangles'],'materials':len(validation['materials']),'draw_primitives':validation['draw_primitives'],'joints':validation['joints'],'texture':'One original useful 1024px embedded atlas; no external image/decoder/resources.'}
  write(folder/'runtime.json',runtime)
  names=[name+'.blend',name+'-export-review.blend','live-scene-release.blend',name+'.glb','pigment.png','atlas-provenance.json','front.png','side.png','back.png','beauty.png','motion-grid.png','animations.mp4','turntable.mp4',*[c+'.mp4' for c in CLIPS],'browser-beauty.png','browser-attack.png','quick.png','checkpoint-front.png','checkpoint-back.png','checkpoint-complete.json','construction.json','construction-survival.json','validation.json','export-inspection.json','three-inspection.json','browser-inspection.json','render-complete.json','runtime.json','lead-checkpoint-review.json']
  files=[];videos={}
  for file in names:
   p=folder/file;assert p.is_file() and p.stat().st_size>0 and not p.is_symlink(),p
   files.append({'local_name':file,'remote_relative_path':name+'/'+file,'artifact_url':BASE+name+'/'+file,'role':'editable_master' if file.endswith('.blend') else 'candidate_or_evidence','bytes':p.stat().st_size,'sha256':digest(p),'source_glb_sha256':lead['selected_checkpoint_sha256'] if file in ['quick.png','checkpoint-front.png','checkpoint-back.png','checkpoint-complete.json'] else sha})
   if file.endswith('.mp4'):
    probe=json.loads(subprocess.run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(p)],capture_output=True,text=True,check=True).stdout);video=next(s for s in probe['streams'] if s['codec_type']=='video');duration=float(probe['format']['duration'])
    assert video['codec_name']=='h264' and video['pix_fmt']=='yuv420p'
    if p.stem in CLIPS:assert abs(duration-clips[p.stem]['duration_s'])<.035
    subprocess.run(['ffmpeg','-v','error','-i',str(p),'-f','null','-'],capture_output=True,text=True,check=True)
    videos[file]={'codec':video['codec_name'],'pixel_format':video['pix_fmt'],'width':video['width'],'height':video['height'],'fps':video['r_frame_rate'],'frames':int(video['nb_frames']),'duration_s':duration,'audio':any(s['codec_type']=='audio' for s in probe['streams']),'full_decode_passed':True}
  manifest={'asset_id':name,'version':'v001','work_order':'WO-032','status':'candidate; exact owner approval pending','glb_sha256':sha,'remote_directory':str(folder),'authoring':{'model':'gpt-6-astra','reasoning_effort':'max','blender':construction['blender'],'method':'Original softly beveled authored shapes and tactile atlas; weighted continuous shoulders/tail/legs where needed, fixed root, explicit attachments and five clips.'},'source_concept':references[name],'review':{'lead_checkpoint':lead,'owner_approval':'pending','gameplay_promotion':False},'runtime':runtime,'construction':construction,'validation':{'khronos_issues':validation['validator']['issues'],'resource_and_budget_checks':validation['checks'],'three_revision':three['three_revision'],'three_checks':three['checks'],'browser':browser['browser'],'browser_checks':browser['checks'],'construction_checks':survival['checks'],'special_attachment_checks':survival['special'],'video_streams':videos},'editable_master':{'remote_path':str(folder/(name+'.blend')),'artifact_url':BASE+name+'/'+name+'.blend','sha256':digest(folder/(name+'.blend'))},'files':files,'sources':[{k:v for k,v in f.items() if k!='base64'} for f in sources],'source_bundle':{'file':'source-bundle.json','artifact_url':BASE+'source-bundle.json','bytes':(ROOT/'source-bundle.json').stat().st_size,'sha256':digest(ROOT/'source-bundle.json')},'retained_iterations':[str(p.relative_to(ROOT)) for p in sorted((folder/'iterations').glob('*'))] if (folder/'iterations').exists() else [],'lease':lease,'process_completion':jobs,'limitations':['No physical iPhone/iPad Safari, child playtest, device GPU performance, integrated gameplay, owner approval or deployment claim.','All visible effects and carried accessories are present in the GLB; no external particle service, generated image or downloaded model/texture is needed.']}
  write(folder/'manifest.json',manifest);assets.append({'asset':manifest,'manifest':{'relative_path':name+'/manifest.json','bytes':(folder/'manifest.json').stat().st_size,'sha256':digest(folder/'manifest.json')}})
 globals=[]
 for file in ['scene-lease.json','render-process-completion.json','source-bundle.json','concept-references.json']:
  p=ROOT/file;globals.append({'file':file,'bytes':p.stat().st_size,'sha256':digest(p),'artifact_url':BASE+file})
 write(ROOT/'delivery-manifest.json',{'work_order':'WO-032','created_utc':datetime.now(timezone.utc).isoformat(),'assets':assets,'global_files':globals})
 print(json.dumps({'assets':[{'name':a['asset']['asset_id'],'sha256':a['asset']['glb_sha256'],'artifact_files':len(a['asset']['files'])} for a in assets],'source_files':len(sources),'delivery_sha256':digest(ROOT/'delivery-manifest.json')}))
if __name__=='__main__':main()
