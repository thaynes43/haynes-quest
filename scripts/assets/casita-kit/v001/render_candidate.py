"""Render the exact GLBs in temporary Blender scenes before browser inspection."""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector

ROOT=Path('/workspace/haynes-quest/family-eras/casita-kit/v001')
live=bpy.context.scene
assert live.get('scene_owner')=='gpt-6-astra/casita-kit-props' and live.get('scene_lease')=='active'
out=ROOT/'blender-previews';out.mkdir(exist_ok=True)
report={}
for prop in ['casita-terrace-wall','flower-planter','patterned-door','butterfly-arch']:
    temp=bpy.data.scenes.new('Exact candidate '+prop);bpy.context.window.scene=temp
    try:
        bpy.ops.import_scene.gltf(filepath=str(ROOT/(prop+'.glb')))
        bpy.context.view_layer.update()
        points=[ob.matrix_world @ v.co for ob in temp.objects if ob.type=='MESH' for v in ob.data.vertices]
        lo=Vector([min(v[k] for v in points) for k in range(3)]);hi=Vector([max(v[k] for v in points) for k in range(3)])
        center=(lo+hi)/2;size=hi-lo
        world=bpy.data.worlds.new('Parchment ambient');world.use_nodes=True
        world.node_tree.nodes['Background'].inputs['Color'].default_value=(0.75,0.70,0.63,1)
        world.node_tree.nodes['Background'].inputs['Strength'].default_value=.55;temp.world=world
        for label,position,color,power in [('key',(-3,-4,6),(1,.89,.75),700),('fill',(4,-2,4),(.76,.85,1),360),('rim',(1,3,6),(1,.94,.8),500)]:
            data=bpy.data.lights.new(label,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=5
            ob=bpy.data.objects.new(label,data);temp.collection.objects.link(ob)
            ob.location=center+Vector(position);ob.rotation_euler=(center-ob.location).to_track_quat('-Z','Y').to_euler()
        bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.005));floor=bpy.context.object
        mat=bpy.data.materials.new('Parchment floor');mat.diffuse_color=(.75,.69,.57,1);mat.use_nodes=True
        mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.75,.69,.57,1)
        mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=1;floor.data.materials.append(mat)
        data=bpy.data.cameras.new('Candidate camera');data.type='ORTHO';data.ortho_scale=max(size)*1.25
        camera=bpy.data.objects.new('Candidate camera',data);temp.collection.objects.link(camera);temp.camera=camera
        temp.render.engine='CYCLES';temp.cycles.samples=24;temp.cycles.use_denoising=True;temp.cycles.max_bounces=4
        temp.render.resolution_x=900;temp.render.resolution_y=900;temp.render.resolution_percentage=100
        temp.render.image_settings.file_format='PNG';temp.render.image_settings.color_mode='RGB'
        temp.view_settings.view_transform='AgX';temp.view_settings.look='AgX - Medium High Contrast'
        views={'beauty':(-.6,-1,.45)}
        if prop=='flower-planter':views['top']=(0,0,1)
        report[prop]={'glb_sha256':hashlib.sha256((ROOT/(prop+'.glb')).read_bytes()).hexdigest(),'views':{}}
        for view,direction in views.items():
            camera.location=center+Vector(direction).normalized()*12;camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
            temp.render.filepath=str(out/(prop+'-'+view+'.png'));bpy.ops.render.render(write_still=True)
            report[prop]['views'][view]=hashlib.sha256(Path(temp.render.filepath).read_bytes()).hexdigest()
    finally:
        for ob in list(temp.objects):bpy.data.objects.remove(ob,do_unlink=True)
        bpy.context.window.scene=live;bpy.data.scenes.remove(temp)
(out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
