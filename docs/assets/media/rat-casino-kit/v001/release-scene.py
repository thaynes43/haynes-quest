"""WO097 final source checkpoint, exact artifact manifest and scene release."""
import bpy
import json
import hashlib
from pathlib import Path
from datetime import datetime, timezone
from mathutils import Vector

OUT=Path('/workspace/haynes-quest/rat-casino-kit/v001')
NAMES=('marquee-arch','roulette-dais','slot-cabinet')
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
measurements=json.loads((OUT/'construction-measurements.json').read_text())
validation=json.loads((OUT/'glb-measurements.json').read_text())
browser=json.loads((OUT/'browser-report.json').read_text())
for record in validation['assets']:
    assert all(record['checks'].values()),record['asset']
    assert record['sha256']==digest(OUT/record['file'])
for record in browser['inspected']:
    assert all(record['checks'].values()),record['asset']
    assert record['sha256']==digest(OUT/(record['asset']+'.glb'))
assert not any(browser[k] for k in ('pageErrors','failedRequests','consoleErrors','externalRequests'))
assert digest(OUT/'concept.png')=='eb10826504b05d8e2cfaee9f7881a994640c29a9f22401a00c32bce56fe4fee4'
prior=Path('/workspace/haynes-quest/skyline-toybox-kit/v001/skyline-toybox-kit.blend')
assert digest(prior)=='dcfcac4a9360529edd6d818827db7b0f3bd9d75534c0b49a5ac5b245358ae1f3'

bpy.context.view_layer.update()
for name in NAMES:
    coll=bpy.data.collections[name]
    vertices=[ob.matrix_world@v.co for ob in coll.objects for v in ob.data.vertices]
    expected=measurements['props'][name]['authoringBoundsZUp']
    for axis in range(3):
        assert abs(min(v[axis] for v in vertices)-expected['min'][axis])<.00001
        assert abs(max(v[axis] for v in vertices)-expected['max'][axis])<.00001
    coll.hide_render=name!='marquee-arch'
    coll.hide_viewport=name!='marquee-arch'
scene=bpy.context.scene
scene.camera.location=(7,12,6.2)
scene.camera.rotation_euler=(Vector((0,0,1.82))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.camera.data.ortho_scale=6.95
scene.render.resolution_x=1000;scene.render.resolution_y=1000
scene.render.filepath=str(OUT/'marquee-arch-beauty.png')
scene['scene_lease']='released'
scene['scene_owner']='none'
scene['source_collections']='Three origin-centered prop collections; unhide individually or use render-kit.py.'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'rat-casino-kit.blend'),compress=True)
released=datetime.now(timezone.utc).isoformat()
master={'file':'rat-casino-kit.blend','artifactPath':'haynes-quest/rat-casino-kit/v001/rat-casino-kit.blend',
        'bytes':(OUT/'rat-casino-kit.blend').stat().st_size,'sha256':digest(OUT/'rat-casino-kit.blend')}
release={'workOrder':'WO097','asset':'rat-casino-kit','version':'v001','released':True,
         'releasedAt':released,'sceneOwner':None,'savedMaster':master,
         'outstandingAuthoringJobs':[],'priorToyboxMasterUnchanged':True,
         'runtimePromotion':False,'ownerReview':'pending exact-version review'}
(OUT/'scene-release.json').write_text(json.dumps(release,indent=2)+'\n')
intake={'workOrder':'WO097','asset':'rat-casino-kit','version':'v001',
        'authoringModel':'gpt-6-astra','authoringEffort':'max','blenderVersion':bpy.app.version_string,
        'conceptSha256':digest(OUT/'concept.png'),'master':master,
        'props':measurements['props'],'khronosZeroErrorsAndWarnings':True,
        'browserAllThreePassed':True,'browserReport':'browser-report.json',
        'assembly':'assembly.png','scaleReferenceMeters':1.2,
        'deviations':[{'element':'roulette central mechanism','result':'shallow horizontal inset star and ring',
                       'reason':'entire dais must remain at or below 0.6 meters; lead accepted this adjustment'}],
        'limitations':['Desktop Chromium software WebGL review; physical Safari and gameplay performance remain untested.',
                       'Studio candidate only; exact owner review remains pending.'],
        'sceneReleased':True}
(OUT/'catalog-intake.json').write_text(json.dumps(intake,indent=2)+'\n')
files=['rat-casino-kit.blend','build-kit.py','render-kit.py','release-scene.py','validate-glbs.mjs',
       'browser-intake.mjs','concept.png','prompt.txt','source.json','construction-measurements.json',
       'glb-measurements.json','browser-report.json','render-settings.json','assembly.png',
       'scene-release.json','catalog-intake.json']
for name in NAMES:
    files += [name+suffix for suffix in ('.glb','-beauty.png','-side.png','-browser.png','-validator.json')]
records=[{'file':name,'artifactPath':'haynes-quest/rat-casino-kit/v001/'+name,
          'bytes':(OUT/name).stat().st_size,'sha256':digest(OUT/name)} for name in files]
manifest={'asset':'rat-casino-kit','version':'v001','workOrder':'WO097','blenderVersion':bpy.app.version_string,
          'sceneSaved':True,'sceneReleased':True,'finalRendersComplete':True,'files':records}
(OUT/'remote-artifacts.json').write_text(json.dumps(manifest,indent=2)+'\n')
files.append('remote-artifacts.json')
(OUT/'checksums.sha256').write_text(''.join(digest(OUT/name)+'  '+name+'\n' for name in files))
print(json.dumps(release,indent=2))
print('Artifact manifest entries:',len(records))
