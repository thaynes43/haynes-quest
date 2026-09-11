"""WO-027 views and motion rendered from exact re-imported GLBs.
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
    sc.view_settings.exposure=.2
    sc.world=bpy.data.worlds.new('Cool soft ambient')
    sc.world.use_nodes=True
    sc.world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.76,.70,.61,1)
    sc.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.65
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
    expected=['idle','move','attack','hit','defeat']
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
    """Every authored 24fps sample, played at the actual GLB duration."""
    folder=Path(folder)
    for clip,duration in clips:
        frames=folder/('frames-'+clip)
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate','24','-i',str(frames/'%03d.png'),'-c:v','libx264','-preset','medium','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',str(folder/(clip+'.mp4'))],check=True)
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(folder/(clip+'.mp4')),'-vf','fps=%s,scale=240:280,tile=4x1'%(4/duration),'-frames:v','1',str(folder/('strip-'+clip+'.png'))],check=True)
    concat=folder/'concat.txt'
    concat.write_text(''.join("file '%s.mp4'\n"%clip for clip,_ in clips))
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(concat),'-c','copy','-movflags','+faststart',str(folder/'animations.mp4')],check=True)
    inputs=[]
    for clip,_ in clips:
        inputs+=['-i',str(folder/('strip-'+clip+'.png'))]
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y',*inputs,'-filter_complex','vstack=inputs=%d'%len(clips),'-frames:v','1',str(folder/'motion-grid.png')],check=True)


def render(output,name,quick=False,stills=False,video=False):
    root=Path(output);folder=root
    clear();arm=load(folder/(name+'.glb'))
    inspection=inspect(arm,name)
    inspection['glb_sha256']=hashlib.sha256((folder/(name+'.glb')).read_bytes()).hexdigest()
    (folder/'export-inspection.json').write_text(json.dumps(inspection,indent=2)+'\n')
    h=1.0
    scale=1.22
    target=(0,0,h*.50)
    cam=studio(h,width=900 if not quick else 700,height_px=1000 if not quick else 800,samples=32 if not quick else 10)
    if quick or stills:
        shot(folder/('quick.png' if quick else 'beauty.png'),cam,(2.8,5,2.4),target,scale)
    if quick:
        shot(folder/'checkpoint-front.png',cam,(0,5,h*.50),target,scale*.94)
        shot(folder/'checkpoint-back.png',cam,(0,-5,h*.50),target,scale*.94)
        (folder/'checkpoint-complete.json').write_text(json.dumps({'sha256':inspection['glb_sha256'],'completed_unix':time.time()}))
        return
    if stills:
        shot(folder/'front.png',cam,(0,5,h*.50),target,scale*.94)
        shot(folder/'side.png',cam,(5,0,h*.50),target,scale*.94)
        shot(folder/'back.png',cam,(0,-5,h*.50),target,scale*.94)
    if video:
        sc=bpy.context.scene;sc.render.resolution_x=480;sc.render.resolution_y=560;sc.cycles.samples=8
        cam.location=(2.8,5,2.4);cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale*1.12
        expected=['idle','move','attack','hit','defeat']
        for clip in expected:
            frames=folder/('frames-'+clip);frames.mkdir(exist_ok=True)
            action=next(a for a in bpy.data.actions if a.name==clip or a.name.startswith(clip+'_'))
            start,end=action.frame_range
            for i in range(round(end-start)):
                set_pose(arm,clip,start+i)
                sc.render.filepath=str(frames/('%03d.png'%i));bpy.ops.render.render(write_still=True)
        encode_previews(folder,[(clip,inspection['actions'][clip]['duration_s']) for clip in expected])
        set_pose(arm)
        turns=folder/'frames-turntable';turns.mkdir(exist_ok=True)
        for i in range(48):
            angle=math.tau*i/48
            shot(turns/('%03d.png'%i),cam,(5*math.sin(angle),5*math.cos(angle),2.4),target,scale*1.12)
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate','16','-i',str(turns/'%03d.png'),'-vf','fps=24','-c:v','libx264','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',str(folder/'turntable.mp4')],check=True)
    set_pose(arm)
    cam.location=(2.8,5,2.4);cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale
    bpy.context.scene['exact_glb_sha256']=inspection['glb_sha256']
    bpy.ops.wm.save_as_mainfile(filepath=str(folder/'mister-hiss-export-review.blend'))
    (folder/'render-complete.json').write_text(json.dumps({'asset_id':name,'source':'exact reimported GLB','sha256':inspection['glb_sha256'],'stills':stills,'video':video,'completed_unix':time.time()},indent=2)+'\n')

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',default='/workspace/haynes-quest/parody/mister-hiss/v001')
    parser.add_argument('--name',required=True)
    parser.add_argument('--quick',action='store_true')
    parser.add_argument('--stills',action='store_true')
    parser.add_argument('--video',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    render(args.output,args.name,args.quick,args.stills,args.video)
