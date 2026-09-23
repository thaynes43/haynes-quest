"""WO097 reproducible review-only stills from the saved Rat Casino source.

Set SHOTS to a list for a bounded call. All offsets/proxies are restored after
each render. Solo views face Blender +Y, the exported glTF -Z front.
"""
import bpy
import json
from pathlib import Path
from mathutils import Vector

OUT=Path('/workspace/haynes-quest/rat-casino-kit/v001')
scene=bpy.context.scene
camera=scene.camera
assets=('marquee-arch','roulette-dais','slot-cabinet')
config={
 'marquee-arch-beauty':('marquee-arch',(7,12,6.2),(0,0,1.82),6.95),
 'marquee-arch-side':('marquee-arch',(20,0,2.7),(0,0,1.84),4.45),
 'roulette-dais-beauty':('roulette-dais',(4.8,7,5.8),(0,0,.25),4.12),
 'roulette-dais-side':('roulette-dais',(12,0,2.5),(0,0,.27),4.12),
 'slot-cabinet-beauty':('slot-cabinet',(3.7,7,3.8),(0,0,1.03),2.72),
 'slot-cabinet-side':('slot-cabinet',(7,0,2.10),(0,0,1.03),2.70),
 'assembly':('assembly',(8.2,17,8.0),(0,0,1.43),11.8),
}
settings={
 'workOrder':'WO097','engine':'Cycles','device':'CPU','samples':32,
 'denoised':True,'viewTransform':'AgX','look':'Medium High Contrast','exposure':0,
 'isolatedStillsPixels':[1000,1000],'assemblyPixels':[1500,1000],
 'scaleProxy':{'shape':'neutral cylinder','heightMeters':1.2,'diameterMeters':.38},
 'front':'Blender +Y = glTF -Z',
 'note':'Assembly offsets, stage and neutral scale cylinder are excluded from all GLBs.',
}

for shot in globals().get('SHOTS',list(config)):
 subject,location,target,scale=config[shot]
 for name in assets:
  coll=bpy.data.collections[name]
  coll.hide_render=subject not in (name,'assembly')
  coll.hide_viewport=subject not in (name,'assembly')
 camera.location=location
 camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
 camera.data.ortho_scale=scale
 originals={}
 proxies=[]
 try:
  if subject=='assembly':
   offsets={'marquee-arch':(-2.50,-1.0,0),'roulette-dais':(2.60,.70,0),'slot-cabinet':(4.50,-1.80,0)}
   for name,offset in offsets.items():
    for obj in bpy.data.collections[name].objects:
     originals[obj]=obj.location.copy();obj.location+=Vector(offset)
   bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.19,depth=1.2,location=(.55,1.45,.6))
   proxy=bpy.context.object;proxy.name='Review_only_neutral_1_2m_traveler_cylinder';proxies.append(proxy)
   for coll in list(proxy.users_collection):coll.objects.unlink(proxy)
   bpy.data.collections['review-stage'].objects.link(proxy)
   mat=bpy.data.materials.get('Review_scale_cylinder') or bpy.data.materials.new('Review_scale_cylinder')
   mat.use_nodes=True
   mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.23,.25,.29,1)
   mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.85
   proxy.data.materials.append(mat)
   bevel=proxy.modifiers.new('Soft reference edge','BEVEL');bevel.width=.018;bevel.segments=2
  scene.render.resolution_x=1500 if subject=='assembly' else 1000
  scene.render.resolution_y=1000
  scene.render.resolution_percentage=100
  scene.render.filepath=str(OUT/(shot+'.png'))
  scene.cycles.samples=32
  bpy.ops.render.render(write_still=True)
  print('Saved '+shot+'.png')
 finally:
  for obj,location in originals.items():obj.location=location
  for obj in proxies:bpy.data.objects.remove(obj,do_unlink=True)

(OUT/'render-settings.json').write_text(json.dumps(settings,indent=2)+'\n')
