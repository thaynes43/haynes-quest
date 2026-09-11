"""Prepare an exact artifact manifest after final renders, validation and inspection.
Runs on the authoring service. Editable masters stay on its durable PVC.
"""
import hashlib
import base64
import json
from pathlib import Path
import struct

ROOT=Path('/workspace/haynes-quest/clearing-kit/v001')
BASE='http://blender-authoring.dev.svc.cluster.local:8000/artifacts/haynes-quest/clearing-kit/v001/'
NAMES=['memory-keepsake','ground-tile','path-tile','low-step','clearing-tree','clearing-stone','arrival-landmark']


def hash_file(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def artifact(file,destination=None):
    relative=str(file.relative_to(ROOT))
    record={'artifact_id':'haynes-quest/clearing-kit/v001/'+relative,'file':relative,'url':BASE+relative,'sha256':hash_file(file),'bytes':file.stat().st_size,'repository_path':destination}
    if file.suffix=='.png':
        header=file.read_bytes()[:24]
        assert header[:8]==b'\x89PNG\r\n\x1a\n',str(file)
        record['width'],record['height']=struct.unpack('>II',header[16:24])
    return record


def delivery():
    rendered=json.loads((ROOT/'render-complete.json').read_text())
    assert rendered['all_complete'] and rendered['view_revision']==2
    provenance=json.loads((ROOT/'source-concepts.json').read_text())
    all_files=[]; assets={}; catalogs={}
    common=['beauty.png','front.png','side.png','back.png','top.png','scale.png','turntable.png','validation.json','reimport.json','three-inspection.json','construction.json']
    for name in NAMES:
        catalog='clearing-path-kit' if name in ('ground-tile','path-tile','low-step') else name
        folder=ROOT/name
        construction=json.loads((folder/'construction.json').read_text())
        validation=json.loads((folder/'validation.json').read_text())
        imported=json.loads((folder/'reimport.json').read_text())
        three=json.loads((folder/'three-inspection.json').read_text())
        sha=hash_file(folder/(name+'.glb'))
        assert all(v for v in validation['checks'].values()),name
        assert all(v for v in three['checks'].values()),name
        assert sha==construction['glb']['sha256']==validation['sha256']==imported['glb_sha256']==three['glb_sha256'],name
        assert hash_file(folder/(name+'.blend'))==construction['master']['sha256'],name
        files=[]
        for filename in [name+'.glb',*common,*(['reuse.png'] if name in ('clearing-tree','clearing-stone') else [])]:
            destname=(name+'-'+filename) if catalog=='clearing-path-kit' and not filename.endswith('.glb') else filename
            dest=f'docs/assets/media/{catalog}/v001/{destname}'
            files.append(artifact(folder/filename,dest))
        files.append(artifact(folder/(name+'.blend')))
        all_files+=files
        assets[name]={'catalog_id':catalog,'candidate_status':'unapproved','coordinator_review':'pending','tom_review':'pending','glb_sha256':sha,'triangles':validation['triangles'],'material_count':len(validation['materials']),'draw_primitives':validation['draw_primitives'],'dimensions_gltf_m':validation['bounds_gltf']['dimensions'],'files':files}
        catalogs.setdefault(catalog,[]).append(name)
    for filename in ['tile-joins.png','tile-joins.json','kit-beauty.png']:
        all_files.append(artifact(ROOT/filename,'docs/assets/media/clearing-path-kit/v001/'+filename))
    all_files.append(artifact(ROOT/'clearing-kit-review.blend'))
    all_files.append(artifact(ROOT/'live-scene-release.blend'))
    # The artifact service serves JSON/media, not raw .py/.mjs/.txt. Package the
    # owned source bytes in a JSON artifact with independently checked hashes.
    source_names=['build.py','render.py','validate.mjs','inspect-three.mjs','delivery.py','collect.py']
    sources={name:{'base64':base64.b64encode((ROOT/name).read_bytes()).decode(),'sha256':hash_file(ROOT/name),'bytes':(ROOT/name).stat().st_size} for name in source_names}
    (ROOT/'source-bundle.json').write_text(json.dumps({'schema_version':1,'encoding':'base64','files':sources},indent=2)+'\n')
    bundle=artifact(ROOT/'source-bundle.json','scripts/assets/blender/clearing-kit-v001/source-bundle.json')
    bundle['source_files']=[{'file':name,'sha256':sources[name]['sha256'],'bytes':sources[name]['bytes'],'repository_path':'scripts/assets/blender/clearing-kit-v001/'+name} for name in source_names]
    all_files.append(bundle)
    for filename in ['source-concepts.json','build-inventory.json','inspection-history.json']:
        all_files.append(artifact(ROOT/filename,'scripts/assets/blender/clearing-kit-v001/'+filename))
    manifest={'schema_version':1,'work_order':'WO-010','author':'native gpt-6-astra, max','blender_version':'4.5.13 LTS','artifact_root':str(ROOT),'source_provenance':provenance,'candidate_status':'unapproved','coordinator_review':'pending','tom_review':'pending','all_views_from':'exact delivered GLBs re-imported into Blender','turntables':'six-angle compact PNG contact sheets; left to right, top row then bottom row; 0, 60, 120, 180, 240, 300 degrees','runtime_limitations':['No physical-device/Safari/WebGL performance or gameplay integration claimed','Static authoring candidates; no Tom exact-version approval','No external textures; broad vertex-color materials simplify illustrated concepts','PhotoSurface reserved UV produces one expected Khronos UNUSED_OBJECT info'],'assets':assets,'files':all_files}
    for catalog,names in catalogs.items():
        cm={'schema_version':1,'catalog_id':catalog,'version':'v001','candidate_status':'unapproved','coordinator_review':'pending','tom_review':'pending','source_concepts':provenance,'assets':{n:assets[n] for n in names},'shared_kit_files':[f for f in all_files if f['file'] in ['tile-joins.png','tile-joins.json','kit-beauty.png']] if catalog=='clearing-path-kit' else []}
        out=ROOT/(catalog+'-manifest.json');out.write_text(json.dumps(cm,indent=2)+'\n')
        manifest['files'].append(artifact(out,f'docs/assets/media/{catalog}/v001/manifest.json'))
    (ROOT/'delivery-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({'assets':len(assets),'artifact_streams':len(manifest['files']),'glb_total_bytes':sum(a['files'][0]['bytes'] for a in assets.values()),'delivery_manifest_sha256':hash_file(ROOT/'delivery-manifest.json')}))


if __name__=='__main__': delivery()
