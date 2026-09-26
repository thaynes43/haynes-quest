"""WO111 toon-clubhouse-kit: quick Cycles look renders of the joined export meshes (iteration only, preview/)."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
ROOT = Path('/workspace/haynes-quest/family-eras/toon-clubhouse-kit/v001')
VIEWS = globals().get('VIEWS', [('3q', 32, 16), ('back', 200, 14)])
PROPS = globals().get('PROPS', ['clubhouse-tower-facade', 'curly-slide', 'gadget-toolbox-stand', 'rounded-hedge', 'stage-marker'])
RES = globals().get('RES', 560); SAMPLES = globals().get('SAMPLES', 20)
sc = bpy.context.scene
assert sc.get('scene_lease') == 'active' and sc.get('asset_id') == 'toon-clubhouse-kit'
def lin(h):
    h = h.lstrip('#'); return tuple(((int(h[i:i+2], 16)/255)/12.92 if int(h[i:i+2], 16)/255 <= 0.04045 else (((int(h[i:i+2], 16)/255)+0.055)/1.055)**2.4) for i in (0, 2, 4))
for c in bpy.data.collections:
    if c.name.startswith('LOOK'): 
        for o in list(c.objects): bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.collections.remove(c)
look = bpy.data.collections.new('LOOK | preview rig'); sc.collection.children.link(look)
cam = bpy.data.objects.new('Look camera', bpy.data.cameras.new('Look camera')); look.objects.link(cam); sc.camera = cam
cam.data.lens = 60
for name, e, ang, col, rot in (('Look key', 3.0, 10, (1.0, 0.95, 0.86), (0.45, -0.8, 0.9)), ('Look fill', 0.7, 35, (0.8, 0.87, 1.0), (-0.7, -0.3, 0.4))):
    l = bpy.data.objects.new(name, bpy.data.lights.new(name, 'SUN')); look.objects.link(l)
    l.data.energy = e; l.data.angle = math.radians(ang); l.data.color = col
    l.rotation_euler = (-Vector(rot)).normalized().to_track_quat('-Z', 'Y').to_euler() if False else Vector(rot).normalized().to_track_quat('Z', 'Y').to_euler()
floor = bpy.data.meshes.new('Look floor'); floor.from_pydata([(-40, -40, 0), (40, -40, 0), (40, 40, 0), (-40, 40, 0)], [], [(0, 1, 2, 3)])
fo = bpy.data.objects.new('Look floor', floor); look.objects.link(fo)
fm = bpy.data.materials.new('Look floor paper'); fm.use_nodes = True; fm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = lin('#e9dcc4') + (1,)
fm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1.0; floor.materials.append(fm)
w = bpy.data.worlds.get('Look world') or bpy.data.worlds.new('Look world'); w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = lin('#f5ebdc') + (1,); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8; sc.world = w
r = sc.render; r.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
r.resolution_x = RES; r.resolution_y = RES; r.resolution_percentage = 100; r.film_transparent = False; r.use_freestyle = False
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
exp = [o for o in bpy.data.objects if o.name in PROPS or o.name in ['clubhouse-tower-facade', 'curly-slide', 'gadget-toolbox-stand', 'rounded-hedge', 'stage-marker']]
out = []
for P in PROPS:
    for o in exp: o.hide_render = (o.name != P)
    ob = bpy.data.objects[P]
    pts = [ob.matrix_world @ v.co for v in ob.data.vertices]
    lo = Vector([min(p[k] for p in pts) for k in range(3)]); hi = Vector([max(p[k] for p in pts) for k in range(3)])
    c = (lo + hi) / 2; rad = (hi - lo).length / 2
    for tag, az, el in VIEWS:
        a = math.radians(az); e = math.radians(el)
        d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
        dist = rad / math.tan(math.radians(17)) * 1.08
        cam.location = c + d * dist; cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        path = ROOT / 'preview' / f'{P}-{tag}.png'; r.filepath = str(path)
        bpy.ops.render.render(write_still=True); out.append(str(path))
for o in exp: o.hide_render = False
for o in list(look.objects): bpy.data.objects.remove(o, do_unlink=True)
bpy.data.collections.remove(look)
print(json.dumps(out))
