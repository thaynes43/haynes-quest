"""WO096 reproducible source renders, separate from exported browser evidence.

Use SHOTS=['block-tower-beauty'] before exec() for a bounded render subset.
The assembly arranges the three props at native scale beside a 1.2 m proxy.
"""
import bpy
import math
import json
from mathutils import Vector
from pathlib import Path

OUT=Path('/workspace/haynes-quest/skyline-toybox-kit/v001')
scene=bpy.context.scene
camera=scene.camera
assets=('block-tower','safety-rail','windup-lantern')
config={
    'block-tower-beauty':('block-tower',(4,-7,3.6),(0,0,1.17),3.20),
    'block-tower-side':('block-tower',(7,0,3.05),(0,0,1.18),3.10),
    'safety-rail-beauty':('safety-rail',(3.5,-6.5,3),(0,0,.38),2.92),
    'safety-rail-side':('safety-rail',(6,0,1.15),(0,0,.38),1.60),
    'windup-lantern-beauty':('windup-lantern',(3.6,-5.5,2.8),(0,0,.397),1.14),
    'windup-lantern-side':('windup-lantern',(5,0,1.8),(0,0,.397),1.10),
    'assembly':('assembly',(7,-11,6.8),(0,-.08,1.02),6.35),
}

for shot in globals().get('SHOTS',list(config)):
    subject,location,target,scale=config[shot]
    for name in assets:
        bpy.data.collections[name].hide_render=subject not in (name,'assembly')
    camera.location=location
    camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale=scale
    originals={}
    proxies=[]
    if subject=='assembly':
        offsets={'block-tower':(-1.48,.48,0),'safety-rail':(1.05,.65,0),'windup-lantern':(1.39,-.71,0)}
        for name,offset in offsets.items():
            for obj in bpy.data.collections[name].objects:
                originals[obj]=obj.location.copy()
                obj.location+=Vector(offset)
        # Technical reference only; these neutral shapes are never asset exports.
        bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.17,depth=.92,location=(-.12,-.47,.46))
        body=bpy.context.object
        body.name='Scale reference body'
        proxies.append(body)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=10,radius=.17,location=(-.12,-.47,1.03))
        head=bpy.context.object
        head.name='Scale reference top (1.20m total)'
        proxies.append(head)
        mat=bpy.data.materials.get('Scale_reference_plum') or bpy.data.materials.new('Scale_reference_plum')
        mat.use_nodes=True
        shader=mat.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value=(.07,.048,.095,1)
        shader.inputs['Roughness'].default_value=.95
        for obj in proxies:
            obj.data.materials.append(mat)
            for p in obj.data.polygons:
                p.use_smooth=True
        bevel=body.modifiers.new('Soft reference edge','BEVEL')
        bevel.width=.07
        bevel.segments=3
    scene.render.resolution_x=1200 if subject=='assembly' else 960
    scene.render.resolution_y=900 if subject=='assembly' else 960
    scene.render.filepath=str(OUT/(shot+'.png'))
    scene.cycles.samples=32
    bpy.ops.render.render(write_still=True)
    for obj,location in originals.items():
        obj.location=location
    for obj in proxies:
        bpy.data.objects.remove(obj,do_unlink=True)
    print('Saved '+shot+'.png')

(OUT/'render-settings.json').write_text(json.dumps({
    'blenderVersion':bpy.app.version_string,'engine':'Cycles','device':'CPU',
    'samples':32,'denoised':True,'viewTransform':'AgX','look':'Medium High Contrast',
    'exposure':-.20,'isolatedStillsPixels':[960,960],'assemblyPixels':[1200,900],
    'scaleProxy':{'shape':'neutral cylinder and sphere','heightMeters':1.2,'diameterMeters':.34},
    'note':'Source renders; assembly offsets and scale proxy are not in the GLB files.'
},indent=2)+'\n')
