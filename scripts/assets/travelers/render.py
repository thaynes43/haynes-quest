"""Render and measure the exported GLBs, never an unexported authoring mesh.

Run in an isolated Blender background process on the authoring service:
  blender -b --factory-startup --python render.py -- --output <artifact-dir>
Use --quick for one child beauty still, or --stills / --video separately.
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
        action=next(a for a in bpy.data.actions if a.name==clip or a.name.startswith(clip+'_'))
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
    bpy.ops.import_scene.gltf(filepath=str(path))
    arm=next(ob for ob in set(bpy.data.objects)-before if ob.type=='ARMATURE')
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
    sc.cycles.max_bounces=4
    sc.cycles.diffuse_bounces=3
    sc.cycles.glossy_bounces=2
    sc.render.threads_mode='FIXED'
    sc.render.threads=6
    sc.render.resolution_x=width
    sc.render.resolution_y=height_px
    sc.render.resolution_percentage=100
    sc.render.image_settings.file_format='PNG'
    sc.render.image_settings.color_mode='RGB'
    sc.render.film_transparent=False
    sc.render.fps=24
    sc.view_settings.view_transform='AgX'
    sc.view_settings.look='AgX - Medium High Contrast'
    sc.view_settings.exposure=.2
    sc.world=bpy.data.worlds.new('Cool soft ambient')
    sc.world.use_nodes=True
    sc.world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.50,.56,.66,1)
    sc.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.35
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.002))
    floor=bpy.context.object
    floor.name='Review ground (not exported)'
    floor.data.materials.append(plainmat('Parchment floor',(.71,.65,.54)))
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


def inspect(arm,stage):
    set_pose(arm)
    result={'source':'reimported candidate GLB','blender':bpy.app.version_string,'rest_bounds_blender':bounds(arm),'actions':{}}
    expected=['idle','move','interact']+(['jump'] if stage=='child' else [])
    for clip in expected:
        action=next(a for a in bpy.data.actions if a.name==clip or a.name.startswith(clip+'_'))
        start,end=action.frame_range
        sample_bounds=[]
        for i in range(17):
            f=start+(end-start)*i/16
            set_pose(arm,clip,f)
            sample_bounds.append(bounds(arm))
        result['actions'][clip]={'duration_s':float(end-start)/24,'samples':17,
            'bounds_min':[min(b['min'][k] for b in sample_bounds) for k in range(3)],
            'bounds_max':[max(b['max'][k] for b in sample_bounds) for k in range(3)]}
    set_pose(arm)
    return result


def encode_previews(folder, clips):
    """24 rendered samples per clip, played at each GLB's original duration."""
    folder=Path(folder)
    for clip,duration in clips:
        frames=folder/('frames-'+clip)
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate',str(24/duration),'-i',str(frames/'%03d.png'),'-vf','fps=24','-c:v','libx264','-preset','medium','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',str(folder/(clip+'.mp4'))],check=True)
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(folder/(clip+'.mp4')),'-vf','fps=%s,scale=192:256,tile=4x1'%(4/duration),'-frames:v','1',str(folder/('strip-'+clip+'.png'))],check=True)
    concat=folder/'concat.txt'
    concat.write_text(''.join("file '%s.mp4'\n"%clip for clip,_ in clips))
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(concat),'-c','copy','-movflags','+faststart',str(folder/'animations.mp4')],check=True)
    inputs=[]
    for clip,_ in clips:
        inputs+=['-i',str(folder/('strip-'+clip+'.png'))]
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y',*inputs,'-filter_complex','vstack=inputs=%d'%len(clips),'-frames:v','1',str(folder/'motion-grid.png')],check=True)


def render(output,quick=False,stills=False,video=False):
    root=Path(output)
    stages=['child'] if quick else ['infant','child']
    records={}
    for stage in stages:
        clear()
        arm=load(root/('traveler-'+stage+'.glb'))
        if not quick:
            records[stage]=inspect(arm,stage)
            (root/('export-inspection-'+stage+'.json')).write_text(json.dumps(records[stage],indent=2))
        height=.75 if stage=='infant' else 1.2
        folder=root/stage
        folder.mkdir(exist_ok=True)
        cam=studio(height,width=720 if quick else 800,height_px=850 if quick else 960,samples=24 if quick else 40)
        target=(0,0,height*.5)
        if quick or stills:
            shot(folder/('quick.png' if quick else 'beauty.png'),cam,(2.8,5,2.15),target,height*1.35)
        if quick:
            return
        if stills:
            shot(folder/'front.png',cam,(0,5,height*.5),target,height*1.20)
            shot(folder/'side.png',cam,(5,0,height*.5),target,height*1.20)
            shot(folder/'back.png',cam,(0,-5,height*.5),target,height*1.20)
        if video:
            sc=bpy.context.scene
            sc.render.resolution_x=384
            sc.render.resolution_y=512
            sc.cycles.samples=12
            cam.location=(2.4,5,2.02)
            aim=(0,0,height*.57)
            cam.rotation_euler=(Vector(aim)-cam.location).to_track_quat('-Z','Y').to_euler()
            cam.data.ortho_scale=height*1.48
            expected=['idle','move','interact']+(['jump'] if stage=='child' else [])
            for clip in expected:
                frames=folder/('frames-'+clip)
                frames.mkdir(exist_ok=True)
                action=next(a for a in bpy.data.actions if a.name==clip or a.name.startswith(clip+'_'))
                start,end=action.frame_range
                # 24 distinct samples per clip. Motion comes from actual glTF
                # joints, no video/image-generated deformation.
                for i in range(24):
                    set_pose(arm,clip,start+(end-start)*i/24)
                    sc.render.filepath=str(frames/('%03d.png'%i))
                    bpy.ops.render.render(write_still=True)
            encode_previews(folder,[(clip,records[stage]['actions'][clip]['duration_s']) for clip in expected])
    if stills and not quick:
        clear()
        infant=load(root/'traveler-infant.glb')
        infant.location.x=.41
        child=load(root/'traveler-child.glb')
        child.location.x=-.36
        cam=studio(1.2,width=1200,height_px=900,samples=40)
        shot(root/'age-comparison.png',cam,(0,5,1.35),(0,0,.62),1.9)
    (root/'render-complete.json').write_text(json.dumps({'stages':stages,'stills':stills,'video':video,'completed_unix':time.time()},indent=2))


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',default='/workspace/haynes-quest/travelers/v001')
    parser.add_argument('--quick',action='store_true')
    parser.add_argument('--stills',action='store_true')
    parser.add_argument('--video',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    render(args.output,args.quick,args.stills,args.video)
