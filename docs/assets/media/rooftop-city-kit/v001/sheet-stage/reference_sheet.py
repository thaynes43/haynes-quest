"""WO142/WO111: reference sheet only. No GLB or production export is made."""
import bpy,sys,json,math,importlib
from pathlib import Path
from mathutils import Vector
ROOT=Path('/workspace/haynes-quest/family-eras/rooftop-city-kit/v001')
sys.path.insert(0,str(ROOT/'source'))
import common
importlib.reload(common)
from common import *
import design
importlib.reload(design)
from design import *

sc=bpy.context.scene
assert sc.get('scene_owner')=='gpt-6-astra/rooftop-city-kit-props' and sc.get('scene_lease')=='active'
for ob in list(bpy.data.objects):bpy.data.objects.remove(ob,do_unlink=True)
for co in list(bpy.data.collections):bpy.data.collections.remove(co)
common.MATS.clear();common.PARTS.clear()
for prop,builder in BUILDERS.items():builder()
bpy.context.view_layer.update()
for p in BOXES:
    objects=[o for o in common.PARTS if o.get('kit_prop')==p]
    b=bounds(objects);lo,hi=b['min'],b['max']
    delta=Vector((-(lo[0]+hi[0])/2,-(lo[1]+hi[1])/2,-lo[2]))
    for ob in objects:ob.location+=delta
bpy.context.view_layer.update()
bb={p:bounds([o for o in common.PARTS if o.get('kit_prop')==p]) for p in BOXES}
for p,(hx,h,hz) in BOXES.items():
    low,high=bb[p]['min'],bb[p]['max']
    assert min(low[2],high[2])>=-1e-5 and high[2]<=h+1e-5,(p,bb[p])
    assert low[0]>=-hx and high[0]<=hx and low[1]>=-hz and high[1]<=hz,(p,bb[p])
(ROOT/'reference-geometry.json').write_text(json.dumps({'stage':'Blender reference sheet only; no GLB','boxes':BOXES,'blender_bounds':bb},indent=2)+'\n')
sc.render.engine='CYCLES';sc.cycles.samples=24;sc.cycles.use_denoising=True
sc.render.resolution_x=760;sc.render.resolution_y=800;sc.render.resolution_percentage=100
sc.render.image_settings.file_format='PNG';sc.render.image_settings.color_mode='RGBA';sc.render.film_transparent=True
if not sc.world:sc.world=bpy.data.worlds.new('Rooftop soft world')
sc.world.use_nodes=True
sc.world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.45,.48,.55,1)
sc.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.45
sc.view_settings.view_transform='AgX'
sc.render.threads_mode='FIXED';sc.render.threads=4
light('Broad warm key',(-5,-7,10),1450,7)
light('Cool fill',(6,-2,6),900,6)
light('Rim',(0,5,8),1500,5)
cam=camera((0,-12,3),(0,0,2),6)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'rooftop-city-kit-reference.blend'),compress=True)
for p in BOXES:
    for ob in common.PARTS:ob.hide_render=ob.get('kit_prop')!=p
    lo,hi=bb[p]['min'],bb[p]['max'];height=hi[2];width=hi[0]-lo[0]
    center=Vector((0,0,height*.49));extent=max(height,width)
    for view in ('front','three-quarter'):
        offset=Vector((0,-12,0)) if view=='front' else Vector((7,-12,5))
        cam.location=center+offset;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
        bpy.context.view_layer.update()
        inv=cam.matrix_world.inverted()
        corners=[inv @ Vector((x,y,z)) for x in (lo[0],hi[0]) for y in (lo[1],hi[1]) for z in (lo[2],hi[2])]
        projected=[max(v[i] for v in corners)-min(v[i] for v in corners) for i in (0,1)]
        cam.data.ortho_scale=max(projected[1],projected[0]*800/760)*1.12
        sc.render.filepath=str(ROOT/f'reference-{p}-{view}.png');bpy.ops.render.render(write_still=True)
for ob in common.PARTS:ob.hide_render=False
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'rooftop-city-kit-reference.blend'),compress=True)
print(json.dumps({'reference_complete':True,'props':bb}))
