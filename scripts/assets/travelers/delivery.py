"""Assemble exact remote traveler delivery evidence after renders complete.

Run with Python on the authoring service. This changes no Blender scene data.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess

BASE='http://blender-authoring.dev.svc.cluster.local:8000/artifacts/haynes-quest/travelers/v001/'
DEVIATIONS=[
    'Broad vertex-painted color washes replace the concept\'s fine woven/painterly texture; no image textures or UV maps are exported.',
    'The hood is a more regular rounded triangular shell than the asymmetric cloth folds in the guide; some side-profile faceting remains at close inspection. Its opening is a real concave lining with no facial features.',
    'Embroidery is reduced to five hood leaf loops and sparse hem/cuff stitches. The crown seam was omitted after it protruded in a close-up.',
    'Hands are simple rounded mittens. The satchel is a compact rounded box with a simplified flap and round clasp.',
    'The back mantle is shorter and smoother than the reference; upper corners are tucked toward the shoulders, with a small scarf corner still visible in the three-quarter view.',
    'The shared 16-joint naming is compatible by contract, but each age has its own rest proportions and authored clips; arbitrary cross-age retargeting is not claimed.',
]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def deliver(root):
    root=Path(root)
    complete=json.loads((root/'render-complete.json').read_text())
    assert complete['stills'] and complete['video'], 'Final render pass has not completed'
    construction={r['stage']:r for r in json.loads((root/'construction.json').read_text())}
    output={'work_order':'WO-007','asset_version':'v001','created_utc':datetime.now(timezone.utc).isoformat(),'stages':{}}
    for stage in ('infant','child'):
        record=construction[stage]
        validation=json.loads((root/('validation-'+stage+'.json')).read_text())
        inspection=json.loads((root/('export-inspection-'+stage+'.json')).read_text())
        engine=json.loads((root/('three-inspection-'+stage+'.json')).read_text())
        assert all(validation['checks'].values()),'GLB contract validation failed'
        glb=root/('traveler-'+stage+'.glb')
        assert validation['sha256']==digest(glb),'Validation does not describe the current GLB'
        assert engine['sha256']==digest(glb) and all(engine['checks'].values()),'Engine evidence mismatch/failure'
        assert complete['completed_unix']>=glb.stat().st_mtime,'Render completion predates candidate'
        expected=['idle','move','interact']+(['jump'] if stage=='child' else [])
        paths=[('traveler-'+stage+'.blend',None),('traveler-'+stage+'.glb','traveler-'+stage+'.glb')]
        paths += [(stage+'/'+name,name) for name in ['front.png','side.png','back.png','beauty.png','motion-grid.png','animations.mp4']+[clip+'.mp4' for clip in expected]]
        paths += [('age-comparison.png','age-comparison.png'),('validation-'+stage+'.json','validation.json'),('export-inspection-'+stage+'.json','export-inspection.json'),('three-inspection-'+stage+'.json','three-inspection.json')]
        files=[]
        videos={}
        for relative,local_name in paths:
            path=root/relative
            assert path.is_file(),relative
            assert path.stat().st_mtime>=glb.stat().st_mtime or relative.endswith(('.blend','.glb')),relative
            files.append({'remote_relative_path':relative,'artifact_url':BASE+relative,'local_name':local_name,'bytes':path.stat().st_size,'sha256':digest(path)})
            if path.suffix=='.mp4':
                result=subprocess.run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)],capture_output=True,text=True,check=True)
                probe=json.loads(result.stdout)
                stream=probe['streams'][0]
                assert stream['codec_name']=='h264' and stream['pix_fmt']=='yuv420p',relative
                assert not any(s['codec_type']=='audio' for s in probe['streams']),relative
                videos[path.name]={'codec':stream['codec_name'],'pixel_format':stream['pix_fmt'],'width':stream['width'],'height':stream['height'],'duration_s':float(probe['format']['duration']),'frame_rate':stream['r_frame_rate'],'audio':False}
                duration=sum(inspection['actions'][c]['duration_s'] for c in expected) if path.name=='animations.mp4' else inspection['actions'][path.stem]['duration_s']
                assert abs(float(probe['format']['duration'])-duration)<.1,relative
        item={
            'asset_id':'traveler-'+stage,'version':'v001','status':'candidate; owner review pending',
            'authoring':{'model':'gpt-6-astra','reasoning_effort':'max','work_order':'WO-007','blender_version':record['blender'],'method':'Original procedural mesh, vertex painting, armature and pose animation through native Blender MCP; no image generation by this agent.'},
            'review':{'creator_inspected':True,'coordinator_intake':'pending lead review','owner_approval':'pending','gameplay_promotion':False,'physical_safari_validation':False},
            'reference_set':'storybook-v001','reference_sha256':record['reference_sha256'],
            'source_provenance':'Coordinator-selected fictional reference images were visually inspected. No third-party meshes, textures, facial likeness or family data were imported.',
            'construction':{k:v for k,v in record.items() if k not in ('files','reference_sha256','stage')},
            'runtime':{'appearance_contract':'synthetic-traveler-v1','stage':stage,'required_clips':expected,'gltf_up':'+Y','gltf_forward':'-Z','unit':'meter','origin':'feet at ground','wearer_right_hip_axis':'+X','root_translation':'fixed; controller/collider movement is external','jump_local_visual_lift_m':.17 if stage=='child' else None,'materials':8,'textures':0,'external_decoders':False,'external_resources':False},
            'validation':{'khronos_version':validation['validator']['validatorVersion'],'errors':validation['validator']['issues']['numErrors'],'warnings':validation['validator']['issues']['numWarnings'],'checks':validation['checks'],'export_inspection':inspection,'three_js_inspection':engine,'video_streams':videos},
            'previews':{'stills_source':'Exact reimported GLB in an isolated Blender background renderer','lighting':'Cycles CPU, warm broad key, cool fill, parchment ground; 40 samples and denoising','turnaround':'Orthographic front, wearer-right side and back','beauty':'Three-quarter orthographic','motion_grid':'Rows idle, move, interact'+(', jump' if stage=='child' else '')+'; four evenly spaced poses per row','videos':'24 source samples per clip at original GLB duration, H.264/yuv420p at 24 fps; no audio','age_comparison':'Both exact exported stages at their physical sizes on shared ground'},
            'deviations_from_reference':DEVIATIONS,
            'limitations':['First-pass studio candidate, not approved for gameplay.','No actual iPad/iPhone Safari or production performance measurement.','Motion bounds are sampled at 17 positions per clip; small interpolated sole penetration remains (see exact bounds).','Cloth and satchel are skinned geometry with no cloth simulation.'],
            'scripts':[{'repository_path':'scripts/assets/travelers/'+name,'remote_pvc_path':str(root/name),'sha256':digest(root/name)} for name in ('build.py','render.py','validate.mjs','inspect-three.mjs','delivery.py')],
            'editable_master_storage':str(root/('traveler-'+stage+'.blend')),
            'previous_iterations':str(root/'iterations')+'/{shape-a,shape-b,shape-c}',
            'files':files,
        }
        output['stages'][stage]=item
    path=root/'delivery-manifest.json'
    path.write_text(json.dumps(output,indent=2)+'\n')
    print(json.dumps({'manifest':str(path),'sha256':digest(path),'stages':list(output['stages'])}))
    return output


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',default='/workspace/haynes-quest/travelers/v001')
    args=parser.parse_args()
    deliver(args.output)
