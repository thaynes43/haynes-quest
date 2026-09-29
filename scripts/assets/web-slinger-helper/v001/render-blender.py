"""WO111 helper source-scene visual check while the shared browser is reserved.

The exact GLB WebGL stills remain the primary candidate evidence. This quick
Cycles image checks the painted source and idle pose independently.
"""
import bpy, math
from pathlib import Path
from mathutils import Vector

ROOT=Path('/workspace/haynes-quest/family-eras/web-slinger-helper/v001')
sc=bpy.context.scene
assert sc.get('asset_id')=='web-slinger-helper' and sc.get('scene_lease')=='active'
arm=bpy.data.objects['Web_Slinger_Helper_Rig']
arm.animation_data.action=next(t.strips[0].action for t in arm.animation_data.nla_tracks if t.name=='idle')
sc.frame_set(0)
for ob in list(bpy.data.objects):
 if ob.name.startswith('Author preview '):bpy.data.objects.remove(ob,do_unlink=True)
world=bpy.data.worlds.new('Author preview world');world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(0.20,0.23,0.30,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.55
sc.world=world
def area(name,loc,power,size):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size
 o=bpy.data.objects.new('Author preview '+name,d);sc.collection.objects.link(o)
 o.location=loc;o.rotation_euler=(Vector((0,0,.6))-o.location).to_track_quat('-Z','Y').to_euler()
area('key',(-3,4,5),450,4)
area('fill',(3,2,3),220,3)
area('rim',(1,-3,4),380,3)
d=bpy.data.cameras.new('Author preview camera');cam=bpy.data.objects.new('Author preview camera',d)
sc.collection.objects.link(cam);cam.location=(2.3,5,1.2)
cam.rotation_euler=(Vector((0,0,.60))-cam.location).to_track_quat('-Z','Y').to_euler()
d.type='ORTHO';d.ortho_scale=1.55;sc.camera=cam
sc.render.engine='CYCLES';sc.cycles.device='CPU';sc.cycles.samples=32;sc.cycles.use_denoising=True
sc.render.resolution_x=640;sc.render.resolution_y=800;sc.render.resolution_percentage=100
sc.render.image_settings.file_format='PNG';sc.render.film_transparent=True
sc.view_settings.view_transform='Standard';sc.view_settings.look='Medium High Contrast'
sc.render.filepath=str(ROOT/'blender-idle-preview.png')
bpy.ops.render.render(write_still=True)
arm.animation_data.action=None;sc.frame_set(0)
print('Saved '+str(ROOT/'blender-idle-preview.png'))
