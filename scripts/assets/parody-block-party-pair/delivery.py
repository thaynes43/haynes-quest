"""WO028 exact-byte final inventory after all owned processes have completed."""
from pathlib import Path
from datetime import datetime, timezone
import base64, hashlib, json, subprocess

ROOT=Path('/workspace/haynes-quest/parody/block-party-pair/v001')
BASE='http://blender-authoring.dev.svc.cluster.local:8000/artifacts/haynes-quest/parody/block-party-pair/v001/'
NAMES=['peel-patrol','drama-dragon'];CLIPS=['idle','move','attack','hit','defeat']

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path):return json.loads(path.read_text())
def write(path,data):path.write_text(json.dumps(data,indent=2)+'\n')

def main():
    lease=read(ROOT/'scene-lease.json');jobs=read(ROOT/'render-process-completion.json')
    assert lease['state']=='released' and jobs['all_owned_jobs_exited_and_reaped']
    source_files=[]
    for p in sorted(ROOT.iterdir()):
        if p.suffix in ['.py','.mjs'] or p.name=='contract.json':
            source_files.append({'file':p.name,'repository_path':'scripts/assets/parody-block-party-pair/'+p.name,
                                 'bytes':p.stat().st_size,'sha256':digest(p),'base64':base64.b64encode(p.read_bytes()).decode()})
    write(ROOT/'source-bundle.json',{'work_order':'WO-028','files':source_files})
    manifests={}
    for name in NAMES:
        folder=ROOT/name;glb=folder/(name+'.glb');sha=digest(glb)
        source=folder/'source-build.py'
        write(folder/'source-build.json',{'file':source.name,'bytes':source.stat().st_size,'sha256':digest(source),'base64':base64.b64encode(source.read_bytes()).decode()})
        construction=read(folder/'construction.json');validation=read(folder/'validation.json')
        inspection=read(folder/'export-inspection.json');completion=read(folder/'render-complete.json')
        three=read(folder/'three-inspection.json');browser=read(folder/'browser-inspection.json');survival=read(folder/'construction-survival.json');rig=read(folder/'rig-ground-inspection.json')
        assert sha==validation['sha256']==inspection['glb_sha256']==completion['sha256']==three['glb_sha256']==browser['glb_sha256']==survival['glb_sha256']==rig['glb_sha256']
        for record in [validation,three,browser,survival,rig]:assert all(record['checks'].values()),record['checks']
        assert completion['stills'] and completion['video']
        assert construction['files'][name+'.blend']['sha256']==digest(folder/(name+'.blend'))
        spec=construction['spec'];clips={c['name']:{**c,'playback':'repeat' if c['loop'] else 'once'} for c in construction['clips']}
        clips['defeat'].update({'end_behavior':'Seated intact; terminal pose holds.','remove_only_after_duration_s':clips['defeat']['duration_s'],'embedded_fade':False})
        runtime={'asset_id':name,'version':'v001','glb':name+'.glb','glb_sha256':sha,'runtime_scale':1,'units':'meters','up':'+Y','forward':'-Z',
                 'origin':[0,0,0],'ground_to_top_m':spec['height_m'],'rest_ground_y_m':0,'root_motion':'Caller-controlled scene root and root joint remain fixed; articulated in-place clips.',
                 'attack_contact_time_s':spec['attack_contact_s'],'attack_contact_fraction':spec['attack_contact_fraction'],'clips':clips,
                 'triangles':validation['triangles'],'materials':len(validation['materials']),'draw_primitives':validation['draw_primitives'],'joints':validation['joints'],
                 'rest_bounds_y_up':three['rest_bounds_y_up'],'texture':'One original embedded 1024px JPEG atlas; no external decoder, images or network resources.'}
        if name=='drama-dragon':runtime.update({'rest_wingspan_m':2.6,'rest_nose_to_tail_m':3.0,'ordinary_idle_wings':'Folded from the dimensioned authored rest; measured animated bounds remain in three-inspection.json.'})
        write(folder/'runtime.json',runtime)
        files=[];videos={}
        required=[name+'.blend',name+'-export-review.blend',name+'.glb','pigment.png','atlas-source.json','source-build.json',
                  'front.png','side.png','back.png','beauty.png','motion-grid.png','animations.mp4','turntable.mp4',*[c+'.mp4' for c in CLIPS],
                  'browser-beauty.png','browser-attack.png','quick.png','checkpoint-front.png','checkpoint-back.png','checkpoint-complete.json',
                  'construction.json','construction-survival.json','validation.json','export-inspection.json','three-inspection.json','browser-inspection.json',
                  'rig-ground-inspection.json','pose-attack.png','pose-defeat.png','render-complete.json','runtime.json','lead-checkpoint-review.json']
        for filename in required:
            p=folder/filename;assert p.is_file() and p.stat().st_size>0 and not p.is_symlink(),filename
            files.append({'local_name':filename,'remote_relative_path':name+'/'+filename,'artifact_url':BASE+name+'/'+filename,
                          'role':'editable_master' if filename.endswith('.blend') else 'candidate_or_evidence','bytes':p.stat().st_size,'sha256':digest(p)})
            if filename.endswith('.mp4'):
                probe=json.loads(subprocess.run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(p)],capture_output=True,text=True,check=True).stdout)
                v=next(s for s in probe['streams'] if s['codec_type']=='video');duration=float(probe['format']['duration'])
                assert v['codec_name']=='h264' and v['pix_fmt']=='yuv420p'
                assert v['r_frame_rate']=='20/1',(filename,v['r_frame_rate'])
                if p.stem in CLIPS:assert abs(duration-clips[p.stem]['duration_s'])<.01,(filename,duration)
                if p.stem=='animations':assert abs(duration-sum(c['duration_s'] for c in clips.values()))<.01
                if p.stem=='turntable':assert abs(duration-3)<.01
                videos[filename]={'codec':v['codec_name'],'pixel_format':v['pix_fmt'],'width':v['width'],'height':v['height'],
                                  'fps':v['r_frame_rate'],'frames':int(v['nb_frames']),'duration_s':duration,'audio':any(s['codec_type']=='audio' for s in probe['streams'])}
        manifest={'asset_id':name,'version':'v001','work_order':'WO-028','status':'candidate; exact owner approval pending','glb_sha256':sha,
                  'remote_directory':str(folder),'authoring':{'model':'gpt-6-astra','reasoning_effort':'max','blender':construction['blender'],
                  'method':'Original authored silhouette, softly beveled tactile forms, original embedded pigment atlas, deliberate skin and joint weights, five 40fps clips.'},
                  'source_concept':{'repository_path':'docs/assets/media/'+name+'/v001/concept.png','sha256':spec['concept_sha256'],'private_inputs':False,
                                    'reference':'Fortnite Peely, goofy banana safety marshal' if name=='peel-patrol' else 'Minecraft Ender Dragon, pompous theatrical tantrum'},
                  'review':{'lead_checkpoint':read(folder/'lead-checkpoint-review.json'),'owner_approval':'pending','gameplay_promotion':False},
                  'runtime':runtime,'construction':construction,'validation':{'khronos_issues':validation['validator']['issues'],
                  'resource_and_budget_checks':validation['checks'],'three_revision':three['three_revision'],'three_checks':three['checks'],
                  'browser':browser['browser'],'browser_checks':browser['checks'],'construction_checks':survival['checks'],'rig_ground_checks':rig['checks'],'video_streams':videos},
                  'editable_master':{'remote_path':str(folder/(name+'.blend')),'artifact_url':BASE+name+'/'+name+'.blend','sha256':digest(folder/(name+'.blend'))},
                  'files':files,'sources':[{k:v for k,v in f.items() if k!='base64'} for f in source_files],
                  'source_bundle':{'file':'source-bundle.json','artifact_url':BASE+'source-bundle.json','bytes':(ROOT/'source-bundle.json').stat().st_size,'sha256':digest(ROOT/'source-bundle.json')},
                  'limitations':['No physical iPhone/iPad Safari, hardware GPU frame-time, integrated gameplay or owner approval claim.','Videos are 20fps samples of authored 40fps clips at the exact runtime duration.','Attack locomotion belongs to the caller; the visible lunge/stomp is articulated in place.']}
        write(folder/'manifest.json',manifest)
        manifests[name]={'manifest':manifest,'file':name+'/manifest.json','bytes':(folder/'manifest.json').stat().st_size,'sha256':digest(folder/'manifest.json')}
    shared=[]
    for n in ['live-scene-release.blend','scene-lease.json','render-process-completion.json','source-bundle.json']:
        p=ROOT/n;shared.append({'file':n,'bytes':p.stat().st_size,'sha256':digest(p)})
    delivery={'work_order':'WO-028','created_utc':datetime.now(timezone.utc).isoformat(),'assets':manifests,'shared_files':shared,'scene_lease':lease,'processes':jobs}
    write(ROOT/'delivery-manifest.json',delivery)
    write(ROOT/'delivery-checksum.json',{'file':'delivery-manifest.json','bytes':(ROOT/'delivery-manifest.json').stat().st_size,'sha256':digest(ROOT/'delivery-manifest.json')})
    print(json.dumps({n:{'glb_sha256':v['manifest']['glb_sha256'],'files':len(v['manifest']['files'])} for n,v in manifests.items()}))

if __name__=='__main__':main()
