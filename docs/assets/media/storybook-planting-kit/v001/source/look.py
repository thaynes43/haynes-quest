"""Quick Cycles review renders of the open scene, optionally posed at clip/time.

argv: views=front,side,back,threequarter clip=<name> t=<seconds> out=<prefix> res=<px> samples=<n> target=<collection>
Temporary camera/lights are created under 'LOOK' and removed afterwards, so masters stay clean.
Character front is +Y: 'front' looks from +Y, 'side' from +X (faces viewer's right), 'back' from -Y.
"""
import bpy, sys, math, json
from pathlib import Path
from mathutils import Vector
sys.path.insert(0, '/workspace/haynes-quest/action-worlds/minions-b/v001/source')
import common as C

args = dict(a.split('=', 1) for a in sys.argv[1:] if '=' in a)
views = args.get('views', 'front,side,back,threequarter').split(',')
clip = args.get('clip'); t = float(args.get('t', '0'))
out = args.get('out', 'look'); res = int(args.get('res', '480')); samples = int(args.get('samples', '12'))
outdir = C.REMOTE / args.get('dir', 'look'); outdir.mkdir(parents=True, exist_ok=True)
sc = bpy.context.scene
arm = next((o for o in sc.objects if o.type == 'ARMATURE'), None)
if arm and arm.animation_data:
    arm.animation_data.action = None
    for pb in arm.pose.bones: pb.matrix_basis.identity()
    if clip:
        arm.animation_data.action = bpy.data.actions[clip]
sc.frame_set(round(t * C.FPS) if clip else 0)
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
only = args.get('only'); hidden = []
if only:
    for o in sc.objects:
        if o.type == 'MESH' and o.name != only and not o.hide_render: o.hide_render = True; hidden.append(o)
meshes = [o for o in sc.objects if o.type == 'MESH' and not o.hide_render and not o.name.startswith('LOOK')]
lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
for o in meshes:
    ev = o.evaluated_get(dg); me = ev.to_mesh()
    for v in me.vertices:
        p = o.matrix_world @ v.co; lo = Vector(map(min, lo, p)); hi = Vector(map(max, hi, p))
    ev.to_mesh_clear()
fix = args.get('frame')
if fix:
    lo = Vector([float(x) for x in fix.split(',')[:3]]); hi = Vector([float(x) for x in fix.split(',')[3:]])
ctr = (lo + hi) / 2; size = hi - lo
coll = bpy.data.collections.new('LOOK'); sc.collection.children.link(coll)
def light(name, kind, loc, energy, size=2.0, color=(1, 1, 1)):
    d = bpy.data.lights.new(name, kind); d.energy = energy; d.color = color
    if kind == 'AREA': d.size = size
    o = bpy.data.objects.new(name, d); coll.objects.link(o); o.location = loc
    o.rotation_euler = (Vector((ctr.x, ctr.y, ctr.z)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); return o
light('LOOK key', 'AREA', (-2.2, 3.2, 3.2), float(args.get('key', '420')), 2.5, (1, .96, .9))
light('LOOK fill', 'AREA', (3.0, 2.0, 1.4), float(args.get('fill', '140')), 3.0, (.9, .95, 1))
light('LOOK rim', 'AREA', (0.5, -3.2, 2.8), float(args.get('rim', '260')), 2.0, (1, .97, .92))
floor = None
if args.get('floor', '1') == '1':
    me = bpy.data.meshes.new('LOOK floor'); s = 6
    me.from_pydata([(-s, -s, 0), (s, -s, 0), (s, s, 0), (-s, s, 0)], [], [(0, 1, 2, 3)])
    floor = bpy.data.objects.new('LOOK floor', me); coll.objects.link(floor)
    fm = bpy.data.materials.new('LOOK floor'); fm.use_nodes = True
    fm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = C.lin('#efe6d4')
    fm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1
    me.materials.append(fm); floor.location.z = -0.002
world = sc.world or bpy.data.worlds.new('LOOK world'); sc.world = world; world.use_nodes = True
bg = world.node_tree.nodes.get('Background'); bg.inputs['Color'].default_value = C.lin('#f6efe2'); bg.inputs['Strength'].default_value = float(args.get('world', '.55'))
cam_d = bpy.data.cameras.new('LOOK cam'); cam_d.type = 'ORTHO'
cam = bpy.data.objects.new('LOOK cam', cam_d); coll.objects.link(cam); sc.camera = cam
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = samples; sc.cycles.use_denoising = True
sc.render.resolution_x = res; sc.render.resolution_y = int(res * float(args.get('aspect', '1.125'))); sc.render.resolution_percentage = 100
sc.render.film_transparent = False; sc.view_settings.view_transform = args.get('vt', 'Khronos PBR Neutral'); sc.view_settings.look = 'None'
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGB'; sc.render.image_settings.compression = 90
dirs = {'front': (0, 1, 0), 'side': (1, 0, 0), 'back': (0, -1, 0), 'left': (-1, 0, 0), 'threequarter': (.7071, .7071, 0),
        'beauty': (.62, .78, .38), 'top': (0, .05, 1)}
written = []
for v in views:
    d = Vector(dirs[v]).normalized(); cam.location = ctr + d * 8
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    asp = float(args.get('aspect', '1.125'))
    cam_d.ortho_scale = max(size.z, max(size.x, size.y) * asp) * float(args.get('pad', '1.12'))
    cam_d.clip_start = .1; cam_d.clip_end = 30
    p = outdir / ('%s-%s.png' % (out, v)); sc.render.filepath = str(p); bpy.ops.render.render(write_still=True); written.append(str(p.relative_to(C.REMOTE)))
for o in list(coll.objects):
    data = o.data; bpy.data.objects.remove(o, do_unlink=True)
    if isinstance(data, bpy.types.Light): bpy.data.lights.remove(data)
    elif isinstance(data, bpy.types.Camera): bpy.data.cameras.remove(data)
    elif isinstance(data, bpy.types.Mesh): bpy.data.meshes.remove(data)
bpy.data.collections.remove(coll)
for m in [m for m in bpy.data.materials if m.name.startswith('LOOK')]: bpy.data.materials.remove(m)
if arm and arm.animation_data:
    arm.animation_data.action = None
    for pb in arm.pose.bones: pb.matrix_basis.identity()
sc.frame_set(0)
for o in hidden: o.hide_render = False
print(json.dumps({'written': written, 'bounds': [list(lo), list(hi)]}))
