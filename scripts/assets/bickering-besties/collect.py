"""Collect only WO051 deliverables through the supported /artifacts route.

Files are downloaded to owned directories. The final manifests bind every local
artifact to the exact GLB hashes and assert all required validation records pass.
"""
from pathlib import Path
from urllib.request import urlopen
import argparse,hashlib,json

REPO=Path(__file__).resolve().parents[3];LOCAL=Path(__file__).resolve().parent
BASE='http://blender-authoring.dev.svc.cluster.local:8000/artifacts/haynes-quest/bickering-besties/v001/'
NAMES=['bestie-pink','bestie-black']
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path):return json.loads(path.read_text())
def write(path,data):path.write_text(json.dumps(data,indent=2)+'\n')
def get(relative,target):
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_bytes(urlopen(BASE+relative,timeout=45).read())

def collect(models_only=False):
    for name in NAMES:
        folder=REPO/'docs/assets/media'/name/'v001'
        files=[name+'.blend',name+'.glb','construction.json','construction-survival.json','validation.json','authoring-source.json']
        if not models_only:files += [name+'-export-review.blend','front.png','side.png','back.png','beauty.png','render-complete.json']
        for file in files:get(name+'/'+file,folder/file)
    if not models_only:
        for file in ['joint-pose.png','joint-animations.mp4','joint-motion-grid.png']:
            get('bestie-pink/'+file,REPO/'docs/assets/media/bestie-pink/v001'/file)
        for file in ['evidence-complete.json','processes.json','scene-lease.json','pair-inspection.json','video-inspection.json']:
            get(file,LOCAL/file)
        get('joint-export-review.blend',REPO/'docs/assets/media/bestie-pink/v001/joint-export-review.blend')
    print(json.dumps({'collected_assets':NAMES,'models_only':models_only}))

def manifests():
    sources=[{'path':str(p.relative_to(REPO)),'bytes':p.stat().st_size,'sha256':digest(p)} for p in sorted(LOCAL.iterdir()) if p.suffix in ('.py','.mjs')]
    concept=REPO/'docs/assets/media/bickering-besties/v001/concept.png'
    reference={'path':str(concept.relative_to(REPO)),'sha256':digest(concept),'look_approval':'Tom, September 11, 2026; Use this look for the duo.','final_export_approval':'pending'}
    assert reference['sha256']=='1fb8f525b23c811dd1c3946faca219224bb10800c2517ae87ffdb40beaa0aee1'
    intake=[]
    for name in NAMES:
        folder=REPO/'docs/assets/media'/name/'v001';glb=folder/(name+'.glb');sha=digest(glb)
        c=read(folder/'construction.json');reports={file:read(folder/file) for file in ['validation.json','construction-survival.json','three-inspection.json','attachment-foot-inspection.json','browser-inspection.json']}
        for file,report in reports.items():
            assert report.get('glb_sha256',report.get('sha256'))==sha,(name,file,'hash mismatch')
            assert all(report['checks'].values()),(name,file,report['checks'])
        render=read(folder/'render-complete.json');assert render['glb_sha256']==sha
        assert digest(folder/(name+'.blend'))==c['files'][name+'.blend']['sha256']
        runtime={'asset_id':name,'version':'v001','glb':name+'.glb','glb_sha256':sha,'runtime_scale':1,'units':'meters','up':'+Y','forward':'-Z','origin':[0,0,0],'height_m':1.4,'rest_floor_y_m':0,'root_motion':'stationary; caller owns translation and facing','triangles':c['triangles'],'materials':5,'draw_primitives':5,'joints':c['joints'],'texture':'one original embedded 1024x1024 atlas','clips':c['clips'],'attack_contact_time_s':1.0,'attack_contact_fraction':.625,'high_five':reports['attachment-foot-inspection.json']['high_five'],'defeat_final':'comic sit, last 0.48 seconds held; no fade or hidden removal'}
        write(folder/'runtime.json',runtime)
        files=[{'path':str(p.relative_to(REPO)),'bytes':p.stat().st_size,'sha256':digest(p)} for p in sorted(folder.iterdir()) if p.is_file() and p.name not in ['manifest.json'] and not p.name.startswith('quick')]
        manifest={'asset_id':name,'version':'v001','work_order':'WO051','status':'candidate; exact final model review pending','glb_sha256':sha,'reference':reference,'source_model':'gpt-6-astra','source_effort':'max','blender':c['blender'],'private_inputs':False,'downloaded_meshes_or_textures':False,'editable_master':str((folder/(name+'.blend')).relative_to(REPO)),'runtime':runtime,'validation':{file:report['checks'] for file,report in reports.items()},'khronos_issues':reports['validation.json']['validator']['issues'],'files':files,'sources':sources,'limitations':['Final art approval remains with Tom.','Software Chromium/WebGL and CPU geometry evidence; no physical iPhone/iPad Safari, device GPU performance or integrated gameplay claim.','The joint reel renders 10 samples per second, encoded at 30 fps; native clips keep their exact authored durations.']}
        write(folder/'manifest.json',manifest)
        intake.append({'id':name,'version':'v001','concept_images':[reference['path']],'models':[str(glb.relative_to(REPO))],'model_images':[str((folder/file).relative_to(REPO)) for file in ['beauty.png','front.png','side.png','back.png']],'thumbnail_source':str((folder/'beauty.png').relative_to(REPO)),'editable_master':manifest['editable_master'],'manifest':str((folder/'manifest.json').relative_to(REPO)),'glb_sha256':sha,'glb_bytes':glb.stat().st_size,'triangles':c['triangles'],'opaque_primitives':5,'runtime':runtime,'state':'approved joint look; completed model candidate; exact final model review pending'})
    pair=read(LOCAL/'pair-inspection.json');assert all(pair['checks'].values())
    record={'work_order':'WO051','assets':intake,'shared_reference':reference,'joint_pose':'docs/assets/media/bestie-pink/v001/joint-pose.png','joint_reel':'docs/assets/media/bestie-pink/v001/joint-animations.mp4','joint_motion_grid':'docs/assets/media/bestie-pink/v001/joint-motion-grid.png','joint_editable_review':'docs/assets/media/bestie-pink/v001/joint-export-review.blend','joint_reel_validation':read(LOCAL/'video-inspection.json'),'pair_choreography':{'both_facing_radians':3.141592653589793,'pink_world_side':'+X','black_world_side':'-X','high_five_centres_apart_m':.9,'high_five_contact_s':1.0,'root_depth_offset_m':0,'root_owns':'approach from +/-1.25m, return for shared dizzy recovery, one boss and one reward'},'pair_surface_checks':pair,'sources':sources,'scene_lease':read(LOCAL/'scene-lease.json'),'owned_processes':read(LOCAL/'processes.json')}
    write(LOCAL/'catalog-intake.json',record)
    paths=[p for name in NAMES for p in sorted((REPO/'docs/assets/media'/name/'v001').iterdir()) if p.is_file() and not p.name.startswith('quick')]
    paths += [p for p in sorted(LOCAL.iterdir()) if p.is_file() and p.name not in ['sha256-manifest.json','upload-verification.json']]
    write(LOCAL/'sha256-manifest.json',{'work_order':'WO051','files':[{'path':str(p.relative_to(REPO)),'bytes':p.stat().st_size,'sha256':digest(p)} for p in paths]})
    print(json.dumps({'all_checks_pass':True,'assets':[{'id':a['id'],'sha256':a['glb_sha256']} for a in intake],'files_hashed':len(paths)}))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--models-only',action='store_true');parser.add_argument('--manifests',action='store_true');args=parser.parse_args()
    if args.manifests:manifests()
    else:collect(args.models_only)
