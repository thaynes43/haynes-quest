"""WO027 final exact-byte inventory, video probes and source bundle.

Runs in the authoring service after all owned render processes have ended.
This script reads/writes only the version directory and uses no Blender API.
"""
from pathlib import Path
from datetime import datetime, timezone
import base64, hashlib, json, subprocess

ROOT=Path('/workspace/haynes-quest/parody/mister-hiss/v001')
BASE='http://blender-authoring.dev.svc.cluster.local:8000/artifacts/haynes-quest/parody/mister-hiss/v001/'
CLIPS=['idle','move','attack','hit','defeat']

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def read(name):return json.loads((ROOT/name).read_text())
def write(name,data):(ROOT/name).write_text(json.dumps(data,indent=2)+'\n')

def main():
    glb=ROOT/'mister-hiss.glb';sha=digest(glb)
    construction=read('construction.json');validation=read('validation.json')
    inspection=read('export-inspection.json');completion=read('render-complete.json')
    three=read('three-inspection.json');browser=read('browser-inspection.json')
    survival=read('construction-survival.json');jobs=read('render-process-completion.json')
    assert sha==validation['sha256']==inspection['glb_sha256']==completion['sha256']==three['glb_sha256']==browser['glb_sha256']==survival['glb_sha256']
    for record in [validation,three,browser,survival]:assert all(record['checks'].values()),record['checks']
    assert completion['stills'] and completion['video'] and jobs['all_owned_jobs_exited_and_reaped']
    assert construction['files']['mister-hiss.blend']['sha256']==digest(ROOT/'mister-hiss.blend')
    clips={c['name']:{**c,'playback':'repeat' if c['loop'] else 'once'} for c in construction['clips']}
    clips['defeat'].update({'end_behavior':'Wobbles and sits down intact; terminal pose holds.','remove_only_after_duration_s':2.0,'embedded_fade':False})
    runtime={'asset_id':'mister-hiss','version':'v001','glb':'mister-hiss.glb','glb_sha256':sha,
        'runtime_scale':1,'units':'meters','up':'+Y','forward':'-Z','origin':[0,0,0],
        'ground_to_top_m':1,'rest_ground_y_m':0,'root_motion':'No caller scene translation; root joint fixed.',
        'attack_contact_time_s':.9,'attack_contact_fraction':.6,'clips':clips,
        'triangles':validation['triangles'],'materials':len(validation['materials']),'draw_primitives':validation['draw_primitives'],
        'joints':validation['joints'],'texture':'One original embedded 1024px JPEG atlas; no external decoder or resources.'}
    write('runtime.json',runtime)
    names=['mister-hiss.blend','mister-hiss-export-review.blend','live-scene-release.blend',
        'mister-hiss.glb','pigment.png','front.png','side.png','back.png','beauty.png',
        'motion-grid.png','animations.mp4','turntable.mp4',*[c+'.mp4' for c in CLIPS],
        'browser-beauty.png','browser-attack.png','quick.png','checkpoint-front.png','checkpoint-back.png','checkpoint-complete.json',
        'construction.json','construction-survival.json','validation.json','export-inspection.json',
        'three-inspection.json','browser-inspection.json','render-complete.json','runtime.json',
        'lead-checkpoint-review.json','render-process-completion.json','scene-lease.json']
    files=[];videos={}
    for name in names:
        p=ROOT/name;assert p.is_file() and not p.is_symlink() and p.stat().st_size>0,name
        files.append({'local_name':name,'remote_relative_path':name,'artifact_url':BASE+name,
            'role':'editable_master' if name.endswith('.blend') else 'candidate_or_evidence',
            'bytes':p.stat().st_size,'sha256':digest(p),
            'source_glb_sha256':read('lead-checkpoint-review.json')['selected_checkpoint_sha256'] if name in ['quick.png','checkpoint-front.png','checkpoint-back.png','checkpoint-complete.json'] else sha})
        if name.endswith('.mp4'):
            probe=json.loads(subprocess.run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(p)],capture_output=True,text=True,check=True).stdout)
            video=next(s for s in probe['streams'] if s['codec_type']=='video')
            assert video['codec_name']=='h264' and video['pix_fmt']=='yuv420p'
            duration=float(probe['format']['duration'])
            if p.stem in CLIPS:assert abs(duration-clips[p.stem]['duration_s'])<.045
            subprocess.run(['ffmpeg','-v','error','-i',str(p),'-f','null','-'],capture_output=True,text=True,check=True)
            videos[name]={'codec':video['codec_name'],'pixel_format':video['pix_fmt'],'width':video['width'],'height':video['height'],
                'fps':video['r_frame_rate'],'frames':int(video['nb_frames']),'duration_s':duration,
                'audio':any(s['codec_type']=='audio' for s in probe['streams']),'full_decode_passed':True}
    source_files=[]
    for p in sorted(ROOT.iterdir()):
        if p.suffix in ('.py','.mjs'):
            source_files.append({'file':p.name,'repository_path':'scripts/assets/parody-mister-hiss/'+p.name,
                'bytes':p.stat().st_size,'sha256':digest(p),'base64':base64.b64encode(p.read_bytes()).decode()})
    bundle={'work_order':'WO-027','files':source_files};write('source-bundle.json',bundle)
    manifest={'asset_id':'mister-hiss','version':'v001','work_order':'WO-027','status':'candidate; exact owner approval pending',
        'glb_sha256':sha,'remote_directory':str(ROOT),
        'authoring':{'model':'gpt-6-astra','reasoning_effort':'max','blender':construction['blender'],
            'method':'Original cuboid paper/toy meshes, attached shallow fringe, original deterministic atlas, rigid skinning and authored clips.'},
        'source_concept':{'repository_path':'docs/assets/media/mister-hiss/v001/concept.png','bytes':2262270,
            'sha256':'6042bcae573864a7b86af00fe91f45a4f30acd1788d9fcf12ccd6799f93208cd',
            'reference':'Minecraft Creeper; recognizable paper/confetti parody. Exact lead concept inspected before construction; no private inputs.'},
        'review':{'lead_checkpoint':read('lead-checkpoint-review.json'),'owner_approval':'pending','gameplay_promotion':False},
        'runtime':runtime,'construction':construction,
        'validation':{'khronos_issues':validation['validator']['issues'],'resource_and_budget_checks':validation['checks'],
            'three_revision':three['three_revision'],'three_checks':three['checks'],'browser':browser['browser'],
            'browser_checks':browser['checks'],'construction_checks':survival['checks'],'hat_contact':survival['hat_contact'],
            'video_streams':videos},
        'editable_master':{'remote_path':str(ROOT/'mister-hiss.blend'),'artifact_url':BASE+'mister-hiss.blend','sha256':digest(ROOT/'mister-hiss.blend')},
        'files':files,'sources':[ {k:v for k,v in f.items() if k!='base64'} for f in source_files],
        'source_bundle':{'file':'source-bundle.json','artifact_url':BASE+'source-bundle.json','bytes':(ROOT/'source-bundle.json').stat().st_size,'sha256':digest(ROOT/'source-bundle.json')},
        'retained_iterations':[
            {'path':str(ROOT/'iterations/initial-uv-check'),'reason':'Actual GLB render detected default primitive UV layer; corrected before lead selection. Earlier exported sources and three images retained.'},
            {'path':str(ROOT/'iterations/selected-before-fastening-tabs'),'glb_sha256':read('lead-checkpoint-review.json')['selected_checkpoint_sha256'],'reason':'Lead-selected shape retained; two hidden glued fastening tabs subsequently added to physically connect sash and torso. All final named views/videos use the new exact GLB.'}],
        'limitations':['No physical iPhone/iPad Safari, device GPU performance, integrated gameplay or owner approval claim.','Confetti is six small opaque skinned paper bits; no runtime particle system or sound is embedded.']}
    write('manifest.json',manifest)
    delivery={'work_order':'WO-027','created_utc':datetime.now(timezone.utc).isoformat(),'asset':manifest,
        'manifest':{'file':'manifest.json','bytes':(ROOT/'manifest.json').stat().st_size,'sha256':digest(ROOT/'manifest.json')}}
    write('delivery-manifest.json',delivery)
    print(json.dumps({'glb_sha256':sha,'files':len(files),'source_files':len(source_files),'video_streams':videos,'manifest_sha256':digest(ROOT/'manifest.json')}))

if __name__=='__main__':main()
