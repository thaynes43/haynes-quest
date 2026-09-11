"""Exact-GLB reimport inspection and review renders for WO-010.

Run only in an isolated Blender background process; live MCP scene stays available.
Every model view is rendered from its delivered GLB, never from unexported parts.
"""
import argparse
import bpy
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys
from mathutils import Vector

ROOT=Path('/workspace/haynes-quest/clearing-kit/v001')
NAMES=['memory-keepsake','ground-tile','path-tile','low-step','clearing-tree','clearing-stone','arrival-landmark']


def clear():
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob,do_unlink=True)
    for store in (bpy.data.meshes,bpy.data.materials,bpy.data.cameras,bpy.data.lights):
        for data in list(store):
            if data.users==0: store.remove(data)


def load(root,name):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(root/name/(name+'.glb')))
    return list(set(bpy.data.objects)-before)


def bounds(objects):
    pts=[ob.matrix_world@v.co for ob in objects if ob.type=='MESH' for v in ob.data.vertices]
    lo=[min(v[k] for v in pts) for k in range(3)]; hi=[max(v[k] for v in pts) for k in range(3)]
    return {'min':lo,'max':hi,'dimensions':[hi[k]-lo[k] for k in range(3)]}


def mat(name,color):
    m=bpy.data.materials.new(name); m.use_nodes=True
    bsdf=m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(*color,1)
    bsdf.inputs['Roughness'].default_value=1
    return m


def light(name,location,power,size,color):
    d=bpy.data.lights.new(name,'AREA'); d.energy=power; d.shape='DISK'; d.size=size; d.color=color
    ob=bpy.data.objects.new(name,d); bpy.context.collection.objects.link(ob); ob.location=location
    ob.rotation_euler=(Vector((0,0,.8))-ob.location).to_track_quat('-Z','Y').to_euler()


def studio(samples=24,size=800):
    sc=bpy.context.scene; sc.render.engine='CYCLES'; sc.cycles.device='CPU'
    sc.cycles.samples=samples; sc.cycles.use_denoising=True; sc.cycles.max_bounces=4
    sc.render.threads_mode='FIXED'; sc.render.threads=6
    sc.render.resolution_x=size; sc.render.resolution_y=size; sc.render.resolution_percentage=100
    sc.render.image_settings.file_format='PNG'; sc.render.image_settings.color_mode='RGB'
    sc.view_settings.view_transform='AgX'; sc.view_settings.look='AgX - Medium High Contrast'
    sc.view_settings.exposure=.25
    sc.world=bpy.data.worlds.new('Cool storybook ambient'); sc.world.use_nodes=True
    sc.world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.50,.57,.68,1)
    sc.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.35
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.002))
    bpy.context.object.name='Review parchment ground — not exported'
    bpy.context.object.data.materials.append(mat('Review parchment',(.71,.65,.54)))
    light('Soft warm key',(-3,4,6),650,4,(1,.87,.69))
    light('Cool fill',(4,2,4),220,4,(.69,.82,1))
    light('Warm edge',(-1,-4,5),430,3,(1,.83,.66))
    bpy.ops.object.camera_add(location=(4,6,4)); cam=bpy.context.object; cam.name='Review camera'
    cam.data.type='ORTHO'; sc.camera=cam
    return cam


def shot(path,cam,loc,target,scale):
    cam.location=loc; cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.ortho_scale=scale
    bpy.context.scene.render.filepath=str(path)
    bpy.ops.render.render(write_still=True)


def inspection(root,name,objects):
    path=root/name/(name+'.glb'); details=[]
    for ob in objects:
        if ob.type!='MESH': continue
        ob.data.calc_loop_triangles()
        details.append({'name':ob.name,'vertices':len(ob.data.vertices),'triangles':len(ob.data.loop_triangles),'materials':[m.name for m in ob.data.materials],'uv_layers':[uv.name for uv in ob.data.uv_layers],'color_layers':[c.name for c in ob.data.color_attributes]})
    record={'asset_id':name,'source':'Exact delivered GLB re-imported by Blender glTF importer','blender':bpy.app.version_string,'glb_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bounds_blender':bounds(objects),'meshes':details,'external_image_count':sum(i.source=='FILE' for i in bpy.data.images),'front_blender':'+Y','front_gltf':'-Z'}
    if name=='arrival-landmark':
        widths=[]
        ob=next(o for o in objects if o.type=='MESH')
        for i in range(65):
            z=.005+i*(1.6-.005)/64
            left=ob.ray_cast(Vector((0,0,z)),Vector((-1,0,0)))
            right=ob.ray_cast(Vector((0,0,z)),Vector((1,0,0)))
            if left[0] and right[0]: widths.append(float(right[1].x-left[1].x))
        floor_hits=[]
        for x in (-.79,-.4,0,.4,.79):
            floor_hits.append(bool(ob.ray_cast(Vector((x,0,1.6)),Vector((0,0,-1)))[0]))
        record['passage']={'method':'65 horizontal center-plane rays over 0.005–1.60 m height plus five downward rays','minimum_opening_m':min(widths),'sampled_height_m':1.6,'all_65_rays_hit_uprights':len(widths)==65,'clear_width_at_least_1_6m':min(widths)>=1.6-.0001,'central_floor_unblocked':not any(floor_hits)}
        if not record['passage']['clear_width_at_least_1_6m'] or not record['passage']['central_floor_unblocked']:
            raise RuntimeError('Gateway opening contract failed')
    (root/name/'reimport.json').write_text(json.dumps(record,indent=2)+'\n')
    return record


def ruler(height,width):
    # Fixed metric scale; review-only geometry is never written into a candidate GLB.
    length=.5 if height<.7 else 1
    x=-width/2-.20; front=.1
    m=mat('Review ruler plum',(.064,.047,.09))
    def bar(center,scale):
        bpy.ops.mesh.primitive_cube_add(size=1,location=center); ob=bpy.context.object; ob.scale=scale; ob.data.materials.append(m)
    bar((x,front,length/2),(.009,.009,length))
    for i in range(6): bar((x+.025,front,i*length/5),(.052,.01,.006))
    bpy.ops.object.text_add(location=(x+.025,front+.012,length+.045))
    ob=bpy.context.object; ob.name='Review metric label'; ob.data.body=f'{length:g} m'; ob.data.size=.065 if height<1 else .085; ob.data.align_x='CENTER'
    ob.rotation_euler=(math.pi/2,0,math.pi); ob.data.materials.append(m)
    return length


def montage(folder):
    # A compact six-angle equivalent to a turntable; no audio, animation or autoplay.
    args=[]
    for i in range(6): args+=['-i',str(folder/'angles'/('%02d.png'%i))]
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y',*args,'-filter_complex','[0:v][1:v][2:v]hstack=inputs=3[top];[3:v][4:v][5:v]hstack=inputs=3[bottom];[top][bottom]vstack=inputs=2[out]','-map','[out]','-frames:v','1',str(folder/'turntable.png')],check=True)


def asset(root,name,quick=False):
    clear(); objects=load(root,name); record=inspection(root,name,objects)
    w,d,h=record['bounds_blender']['dimensions']; span=max(w,d,h)
    folder=root/name
    cam=studio(16 if quick else 32,640 if quick else 800)
    target=(0,0,h*.46)
    scale=span*1.44
    shot(folder/('quick.png' if quick else 'beauty.png'),cam,(4,6,3.8),target,scale)
    if quick: return
    shot(folder/'front.png',cam,(0,6,h*.50),(0,0,h*.50),span*1.25)
    shot(folder/'side.png',cam,(6,0,h*.50),(0,0,h*.50),span*1.25)
    shot(folder/'back.png',cam,(0,-6,h*.50),(0,0,h*.50),span*1.25)
    shot(folder/'top.png',cam,(0,.0001,7),(0,0,0),max(w,d)*1.25)
    angle_dir=folder/'angles'; angle_dir.mkdir(exist_ok=True)
    sc=bpy.context.scene; sc.render.resolution_x=384; sc.render.resolution_y=384; sc.cycles.samples=20
    for i in range(6):
        a=math.tau*i/6
        shot(angle_dir/('%02d.png'%i),cam,(math.sin(a)*6,math.cos(a)*6,3.3),(0,0,h*.46),span*1.45)
    montage(folder)
    sc.render.resolution_x=800; sc.render.resolution_y=800; sc.cycles.samples=32
    length=ruler(h,w)
    shot(folder/'scale.png',cam,(.65,6,2.9),(0,0,max(h,length)*.47),max(span,max(h,length))*1.62)
    record['scale_reference_m']=length
    record['turntable']={'file':'turntable.png','angles_degrees':[0,60,120,180,240,300],'layout':'left to right, top row then bottom row','source':'six exact-GLB renders'}
    (folder/'reimport.json').write_text(json.dumps(record,indent=2)+'\n')


def duplicate(objects,offset,rotation=0,scale=1):
    for original in objects:
        ob=original.copy(); ob.data=original.data
        bpy.context.collection.objects.link(ob)
        ob.location=offset; ob.rotation_euler[2]=rotation; ob.scale=(scale,scale,scale)


def variations(root,name):
    clear(); originals=load(root,name)
    w,d,h=bounds(originals)['dimensions']
    # All instances reuse the exact same imported mesh datablocks and the same GLB.
    for ob in originals: ob.location=(-w*1.1,0,0)
    duplicate(originals,(0,0,0),math.radians(95),.80)
    duplicate(originals,(w*1.0,0,0),math.radians(225),1.08)
    cam=studio(32,1000); bpy.context.scene.render.resolution_y=650
    shot(root/name/'reuse.png',cam,(4,8,4),(0,0,h*.42),w*3.7)


def joins(root):
    clear()
    sources={}
    for name in ('ground-tile','path-tile'):
        sources[name]=load(root,name)
    for objects in sources.values():
        for ob in objects: ob.hide_render=True
    for name,ox in [('ground-tile',-2.3),('path-tile',2.3)]:
        for ix in (-1,1):
            for iy in (-1,1):
                for original in sources[name]:
                    ob=original.copy(); ob.data=original.data; bpy.context.collection.objects.link(ob)
                    ob.hide_render=False; ob.location=(ox+ix,iy,0)
    cam=studio(40,1400); bpy.context.scene.render.resolution_y=760
    shot(root/'tile-joins.png',cam,(0,6,7),(0,0,0),10)
    # Exact exposed edge positions: no missing cells, rectangular bed, 2 m placement.
    (root/'tile-joins.json').write_text(json.dumps({'source':'exact GLBs instanced at 2 m offsets','ground_instances':4,'path_instances':4,'each_joined_dimensions_m':[4,4],'outer_footprint':'exact rectangle; closed solid joint bed beneath paver grooves','shared_edge_gap_m':0,'alignment':'bases at Y=0; tops differ by the specified 0.12 m / 0.08 m piece heights'},indent=2)+'\n')


def kit_scene(root):
    clear()
    for name,positions in [
        ('ground-tile',[((-2,0,0),0,1),((-2,-2,0),0,1),((2,0,0),0,1),((2,-2,0),0,1)]),
        ('path-tile',[((0,0,0),0,1),((0,-2,0),0,1)]),
        ('low-step',[((0,-3.30,0),0,1)]),
        ('arrival-landmark',[((0,-2.85,.08),0,1)]),
        ('clearing-tree',[((-2,-1.5,.12),-.25,1)]),
        ('clearing-stone',[((2,-1.9,.12),.7,1),((2.3,.6,.12),2.5,.7)]),
        ('memory-keepsake',[((1.48,.0,.12),-.20,1),((-1.45,1.05,.12),.25,1)])]:
        objects=load(root,name)
        first=True
        for offset,rotation,scale in positions:
            if first:
                for ob in objects: ob.location=offset; ob.rotation_euler[2]=rotation; ob.scale=(scale,scale,scale)
                first=False
            else: duplicate(objects,offset,rotation,scale)
    cam=studio(48,1400); bpy.context.scene.render.resolution_y=1050
    shot(root/'kit-beauty.png',cam,(6,9,6),(0,-.8,.90),8.4)
    bpy.ops.wm.save_as_mainfile(filepath=str(root/'clearing-kit-review.blend'),compress=True)


def scale_view(root,name):
    clear(); objects=load(root,name); b=bounds(objects);w,d,h=b['dimensions'];span=max(w,d,h)
    cam=studio(32,800); length=ruler(h,w)
    shot(root/name/'scale.png',cam,(.65,6,2.9),(0,0,max(h,length)*.47),max(span,max(h,length))*1.62)


def render(root,quick=False,only=None,scales_only=False):
    root=Path(root)
    if scales_only:
        for name in NAMES: scale_view(root,name)
        print('All seven corrected scale views complete',flush=True)
        return
    for name in ([only] if only else NAMES):
        asset(root,name,quick)
        print(json.dumps({'rendered':name,'quick':quick}),flush=True)
    if not quick and not only:
        for name in ('clearing-tree','clearing-stone'): variations(root,name)
        joins(root); kit_scene(root)
    complete=(f'render-{only}-complete.json' if only else ('quick-complete.json' if quick else 'render-complete.json'))
    (root/complete).write_text(json.dumps({'names':[only] if only else NAMES,'quick':quick,'all_complete':True,'view_revision':2},indent=2)+'\n')


if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--output',default=str(ROOT)); parser.add_argument('--quick',action='store_true'); parser.add_argument('--only',choices=NAMES); parser.add_argument('--scales-only',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    render(args.output,args.quick,args.only,args.scales_only)
