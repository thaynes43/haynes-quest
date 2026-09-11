"""WO051 views and motion rendered from exact re-imported GLBs.
Run in an isolated Blender process, preserving the live service addon/scene.
Common studio/inspection helpers originate in the repository's WO-007 script.
"""
import argparse
import bpy
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import time
from mathutils import Vector


def clear():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob,do_unlink=True)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)


def set_pose(arm,clip=None,frame=0):
    arm.animation_data_create()
    arm.animation_data.action=None
    arm.animation_data.use_nla=False
    for bone in arm.pose.bones:
        bone.location=(0,0,0)
        bone.rotation_mode='QUATERNION'
        bone.rotation_quaternion=(1,0,0,0)
        bone.scale=(1,1,1)
    if clip:
        mapping=json.loads(arm.get('clip_actions','{}'))
        action=bpy.data.actions[mapping[clip]] if clip in mapping else next(a for a in bpy.data.actions if a.name==clip or a.name.startswith(clip+'_'))
        arm.animation_data.action=action
        if action.slots:
            arm.animation_data.action_slot=action.slots[0]
    bpy.context.scene.frame_set(math.floor(frame),subframe=frame-math.floor(frame))
    bpy.context.view_layer.update()


def bounds(arm):
    deps=bpy.context.evaluated_depsgraph_get()
    points=[]
    for ob in bpy.context.scene.objects:
        if ob.type=='MESH' and any(m.type=='ARMATURE' and m.object==arm for m in ob.modifiers):
            ev=ob.evaluated_get(deps)
            data=ev.to_mesh()
            points.extend(ev.matrix_world@v.co for v in data.vertices)
            ev.to_mesh_clear()
    return {'min':[min(p[k] for p in points) for k in range(3)],'max':[max(p[k] for p in points) for k in range(3)]}


def load(path):
    before=set(bpy.data.objects)
    before_actions=set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=str(path))
    arm=next(ob for ob in set(bpy.data.objects)-before if ob.type=='ARMATURE')
    added=set(bpy.data.actions)-before_actions
    names=['idle','move','attack','hit','defeat','cheer','high-five','dizzy']
    arm['clip_actions']=json.dumps({name:next(a.name for a in added if a.name==name or a.name.startswith(name+'_') or a.name.startswith(name+'.')) for name in names})
    set_pose(arm)
    return arm


def plainmat(name,color,rough=1):
    m=bpy.data.materials.new(name)
    m.use_nodes=True
    bsdf=m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(*color,1)
    bsdf.inputs['Roughness'].default_value=rough
    return m


def camera(location,target,scale):
    bpy.ops.object.camera_add(location=location)
    ob=bpy.context.object
    ob.name='Review camera'
    ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
    ob.data.type='ORTHO'
    ob.data.ortho_scale=scale
    ob.data.lens=50
    bpy.context.scene.camera=ob
    return ob


def light(name,location,target,power,size,color):
    data=bpy.data.lights.new(name,'AREA')
    data.energy=power
    data.shape='DISK'
    data.size=size
    data.color=color
    ob=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(ob)
    ob.location=location
    ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()


def studio(height=1.2,width=800,height_px=900,samples=32):
    sc=bpy.context.scene
    sc.render.engine='CYCLES'
    sc.cycles.device='CPU'
    sc.cycles.samples=samples
    sc.cycles.use_denoising=True
    sc.cycles.max_bounces=3
    sc.cycles.diffuse_bounces=3
    sc.cycles.glossy_bounces=2
    sc.render.threads_mode='FIXED'
    sc.render.threads=3
    sc.render.resolution_x=width
    sc.render.resolution_y=height_px
    sc.render.resolution_percentage=100
    sc.render.image_settings.file_format='PNG'
    sc.render.image_settings.color_mode='RGB'
    sc.render.film_transparent=False
    sc.render.fps=24
    sc.view_settings.view_transform='AgX'
    sc.view_settings.look='AgX - Medium High Contrast'
    sc.view_settings.exposure=-.15
    sc.world=bpy.data.worlds.new('Cool soft ambient')
    sc.world.use_nodes=True
    sc.world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.76,.70,.61,1)
    sc.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.40
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.002))
    floor=bpy.context.object
    floor.name='Review ground (not exported)'
    floor.data.materials.append(plainmat('Parchment floor',(.77,.73,.67)))
    target=(0,0,.6)
    light('Warm broad key',(-3,4,5),target,450,4,(1,.87,.69))
    light('Cool fill',(3,2,3),target,160,3,(.70,.83,1))
    light('Soft edge',(1,-3,4),target,380,3,(1,.83,.66))
    return camera((2.5,5,2.0),(0,0,height*.51),height*1.33)


def shot(path,cam,location,target,scale):
    cam.location=location
    cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.ortho_scale=scale
    bpy.context.scene.render.filepath=str(path)
    bpy.ops.render.render(write_still=True)

def main():
    args=sys.argv[sys.argv.index('--')+1:];name=args[0];mode=args[1] if len(args)>1 else 'quick'
    root=Path(__file__).resolve().parent;folder=root/name
    clear();bpy.context.scene.render.fps=30;arm=load(folder/(name+'.glb'))
    cam=studio(1.4,width=560 if mode=='quick' else 800,height_px=640 if mode=='quick' else 900,samples=8 if mode=='quick' else 20)
    bpy.context.scene.render.fps=30
    h=1.4;target=(0,0,.71);position=(2.2*h,5*h,2.0*h)
    shots=[('quick.png','idle',0,position),('quick-high-five.png','high-five',30,position),('quick-defeat.png','defeat',60,position)] if mode=='quick' else [
        ('beauty.png','idle',0,position),('front.png',None,0,(0,5*h,.71)),('side.png',None,0,(5*h,0,.71)),('back.png',None,0,(0,-5*h,.71))]
    for file,clip,frame,where in shots:
        set_pose(arm,clip,frame);shot(folder/file,cam,where,target,1.80)
    bpy.ops.wm.save_as_mainfile(filepath=str(folder/(name+'-export-review.blend')),compress=True)
    (folder/(mode+'-render-complete.json')).write_text(json.dumps({'asset_id':name,'glb_sha256':hashlib.sha256((folder/(name+'.glb')).read_bytes()).hexdigest(),'source':'exact reimported GLB','mode':mode,'views':[s[0] for s in shots]},indent=2)+'\n')

if __name__=='__main__':main()
