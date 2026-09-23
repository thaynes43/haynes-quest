"""Reproducible WO095 stills from the saved editable source.

Usage in Blender: set SHOTS to a list of names before exec(), or omit it to
render all seven stills. Asset transforms are restored after the assembly.
"""
import bpy
import json
from mathutils import Vector
from pathlib import Path

OUT = Path('/workspace/haynes-quest/midnight-arcade-kit/v001')
scene = bpy.context.scene
camera = scene.camera
assets = ('ticket-arch','arcade-cabinet','joystick-bollard')
config = {
    'ticket-arch-beauty': ('ticket-arch',(7,-12,7),(0,0,1.64),7.2),
    'ticket-arch-side': ('ticket-arch',(12,-1.6,5.8),(0,0,1.60),6.0),
    'arcade-cabinet-beauty': ('arcade-cabinet',(3.7,-6,3.2),(0,0,.89),2.45),
    'arcade-cabinet-side': ('arcade-cabinet',(5,0,2.55),(0,0,.9),2.36),
    'joystick-bollard-beauty': ('joystick-bollard',(2.3,-4,2.1),(0,0,.50),1.47),
    'joystick-bollard-side': ('joystick-bollard',(4,0,1.95),(0,0,.51),1.47),
    'assembly': ('assembly',(8,-13,8),(0,-.25,1.50),8.4),
}
shots = globals().get('SHOTS', list(config))
for shot in shots:
    subject,loc,target,scale = config[shot]
    for key in assets:
        bpy.data.collections[key].hide_render = subject not in (key,'assembly')
    camera.location=loc
    camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale=scale
    originals={}
    proxy=None
    if subject=='assembly':
        for key,offset in {'arcade-cabinet':(1.05,-1.40,0),'joystick-bollard':(-1.85,-1.45,0)}.items():
            for obj in bpy.data.collections[key].objects:
                originals[obj]=obj.location.copy()
                obj.location += Vector(offset)
        # A 1.2 m tall, 0.42 m diameter cylinder communicates child scale.
        bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.21,depth=1.2,location=(-.35,-.60,.60))
        proxy=bpy.context.object
        proxy.name='Traveler scale proxy 1.20m'
        material=bpy.data.materials.get('Scale reference') or bpy.data.materials.new('Scale reference')
        material.use_nodes=True
        shader=material.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value=(.105,.168,.139,1)
        shader.inputs['Roughness'].default_value=.9
        proxy.data.materials.append(material)
        modifier=proxy.modifiers.new('Round proxy edge','BEVEL');modifier.width=.08;modifier.segments=3
        for polygon in proxy.data.polygons:
            polygon.use_smooth=True
    scene.render.resolution_x=1200 if subject=='assembly' else 960
    scene.render.resolution_y=900 if subject=='assembly' else 960
    scene.render.filepath=str(OUT/(shot+'.png'))
    scene.cycles.samples=32
    scene.view_settings.exposure=-.35
    bpy.ops.render.render(write_still=True)
    for obj,location in originals.items():
        obj.location=location
    if proxy:
        bpy.data.objects.remove(proxy,do_unlink=True)
    print('Saved '+shot+'.png')
(OUT/'render-settings.json').write_text(json.dumps({
    'blenderVersion':bpy.app.version_string,'engine':'Cycles','device':'CPU',
    'samples':32,'denoised':True,'viewTransform':'AgX','look':'Medium High Contrast',
    'exposure':-.35,'isolatedStillsPixels':[960,960],'assemblyPixels':[1200,900],
    'scaleProxy':{'shape':'cylinder','heightMeters':1.2,'diameterMeters':.42},
    'note':'Blender source renders, separate from exported-GLB browser inspection.'
},indent=2)+'\n')
