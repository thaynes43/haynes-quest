"""WO-016 exact-byte artifact inventory. Run after authoring and renders finish.

Uses only regular files in the assigned remote directory; no Blender scene API.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess

ASSETS=('loop-dancer','prism-mimic','trendweaver')
CLIPS=('idle','move','attack','hit','defeat')
BASE='http://blender-authoring.dev.svc.cluster.local:8000/artifacts/haynes-quest/era-2024/v001/'
ROOT='/workspace/haynes-quest/era-2024/v001'
DEFEAT={
 'loop-dancer':'Slumps into a folded puppet collapse; final pose is held.',
 'prism-mimic':'Rolls onto its side with legs folded and the tail settled; final pose is held.',
 'trendweaver':'Tilts and descends with arms and bobbins drooping; final pose is held.',
}

def digest(path):
 return hashlib.sha256(path.read_bytes()).hexdigest()

def inventory(root,names):
 root=Path(root)
 sources=json.loads((root/'source-concepts.json').read_text())
 bundle={'work_order':'WO-016','version':'v001','created_utc':datetime.now(timezone.utc).isoformat(),'assets':{}}
 for name in names:
  folder=root/name
  construction=json.loads((folder/'construction.json').read_text())
  validation=json.loads((folder/'validation.json').read_text())
  inspection=json.loads((folder/'export-inspection.json').read_text())
  completion=json.loads((folder/'render-complete.json').read_text())
  current=digest(folder/(name+'.glb'))
  assert current==validation['sha256']==inspection['glb_sha256']==completion['sha256']
  assert all(validation['checks'].values()),'Failed exact GLB contract'
  assert completion['stills'] and completion['video'],'Incomplete review package'
  exported={clip:inspection['actions'][clip]['duration_s'] for clip in CLIPS}
  authored={entry['name']:entry for entry in construction['clips']}
  assert all(abs(exported[clip]-authored[clip]['duration_s'])<1e-4 for clip in CLIPS)
  clips={clip:{'duration_s':exported[clip],'loop':clip in ('idle','move'),'playback':'repeat' if clip in ('idle','move') else 'once','clamp_when_finished':clip=='defeat'} for clip in CLIPS}
  impact=authored['attack']['impact_time_s']
  clips['attack'].update({'contact_time_s':impact,'contact_fraction':impact/exported['attack'],'timing_source':'Authored strike/pulse peak; root maps gameplay windup, strike and cooldown onto this timeline.'})
  clips['defeat'].update({'end_behavior':DEFEAT[name],'fade_embedded':False,'root_motion_embedded':False,'remove_after_clip':'Gameplay controller decision; clip holds the terminal pose.'})
  paths=[name+'.blend',name+'.glb','pigment.png','front.png','side.png','back.png','beauty.png','motion-grid.png','animations.mp4','turntable.mp4',*[clip+'.mp4' for clip in CLIPS],'construction.json','validation.json','export-inspection.json','render-complete.json']
  files=[];videos={}
  for filename in paths:
   path=folder/filename
   assert path.is_file() and not path.is_symlink(),filename
   files.append({'remote_relative_path':name+'/'+filename,'artifact_url':BASE+name+'/'+filename,'local_name':filename,'role':'editable_master' if filename.endswith('.blend') else 'candidate_or_evidence','bytes':path.stat().st_size,'sha256':digest(path)})
   if filename.endswith('.mp4'):
    probe=json.loads(subprocess.run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)],capture_output=True,text=True,check=True).stdout)
    stream=next(s for s in probe['streams'] if s['codec_type']=='video')
    assert stream['codec_name']=='h264' and stream['pix_fmt']=='yuv420p'
    assert not any(s['codec_type']=='audio' for s in probe['streams'])
    videos[filename]={'codec':stream['codec_name'],'pixel_format':stream['pix_fmt'],'width':stream['width'],'height':stream['height'],'duration_s':float(probe['format']['duration']),'audio':False}
    if path.stem in CLIPS:assert abs(videos[filename]['duration_s']-exported[path.stem])<.09
  manifest={
   'asset_id':name,'version':'v001','status':'candidate; owner review pending','glb_sha256':current,
   'work_order':'WO-016','authoring':{'model':'gpt-6-astra','reasoning_effort':'max','blender':construction['blender'],'source_method':'Original scripted rounded meshes, relief, procedural pigment bake, rigid-part and ribbon skinning.'},
   'review':{'creator_inspection':'required before handoff','coordinator_selection':'pending','owner_approval':'pending','gameplay_promotion':False},
   'concept':sources['concepts'][name],
   'runtime':{'unit':'meter','gltf_up':'+Y','gltf_forward':'-Z','origin':'Ground-centered root at [0, 0, 0]','root_translation':'Fixed; translation belongs to the gameplay controller','rest_height_m':construction['spec']['height'],'rest_underside_clearance_m':construction['spec']['floor'],'hover_offset_embedded':name=='trendweaver','clips':clips,'textures':'One embedded original 1024 × 1024 pigment atlas; no external URI or decoder','materials':len(validation['materials']),'draw_primitives':validation['draw_primitives']},
   'construction':construction,'validation':{'khronos_errors':validation['validator']['issues']['numErrors'],'khronos_warnings':validation['validator']['issues']['numWarnings'],'checks':validation['checks'],'video_streams':videos},
   'editable_master':{'remote_path':str(folder/(name+'.blend')),'artifact_url':BASE+name+'/'+name+'.blend','sha256':digest(folder/(name+'.blend'))},
   'limitations':['Software review renders and CPU geometry checks do not establish physical-device Safari performance.','Cloth motion is authored skinning without cloth simulation.','Faceted colored panels are stylized opaque PBR surfaces.'],
   'files':files,
   'sources':[{'repository_path':'scripts/assets/era-2024/'+script.name,'remote_path':str(script),'sha256':digest(script)} for script in sorted(root.glob('*')) if script.suffix in ('.py','.mjs')],
  }
  (folder/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
  bundle['assets'][name]=manifest
 (root/'delivery-manifest.json').write_text(json.dumps(bundle,indent=2)+'\n')
 print(json.dumps({'assets':list(bundle['assets']),'manifest':str(root/'delivery-manifest.json'),'sha256':digest(root/'delivery-manifest.json')}))

if __name__=='__main__':
 parser=argparse.ArgumentParser()
 parser.add_argument('--output',default=ROOT)
 parser.add_argument('--names',nargs='+',choices=ASSETS,default=list(ASSETS))
 args=parser.parse_args();inventory(args.output,args.names)
