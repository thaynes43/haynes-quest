"""WO111 putty-grunt v001: final budgeted model from the approved Blender reference sheet.

Source authority: reference-sheet.png and putty-grunt-blockout.blend (coordinator approved Sept 26, "Blender
reference sheet, no generated concept"; SHEET-REVIEWS.md: goofy lavender clay grunt with thumbprint dents, a
clay-coil belt, blank round eyes, a pinched antenna and mitten fists; make the eyes slightly larger and the belt
buckle a warmer gold for play-distance read; clumsy double-fist swing attack; defeat melts into a flopped clay
puddle with the antenna still wiggling, held).

The blockout's metaball clay recipe and measured coordinates are kept for silhouette, colour and parody hooks, but
rebuilt in a rig-friendly bind pose (head straight, both arms relaxed in an A-pose, the sheet's bow-legged stance),
as the sheet notes suggest; the sheet's guard (head tilt, raised right fist, low left fist) is recreated at idle 0 s.

Pipeline (all in this Blender session, no external assets):
  1. one metaball clay family (torso, big neckless head, nub nose, lumps, noodly arms, mitten fists with knuckles
     and thumbs, stumpy legs, pancake feet with toe bumps) voxel-remeshed into a closed high-resolution surface;
     thumbprint dimples pressed in; a low-frequency hand-worked Displace applied (soles kept flat);
  2. painted decals on that surface (thumbprint patches and whorl ridges, the lopsided grin, the tongue patch), as
     in the blockout;
  3. a decimated low-poly clay body (one continuous skin) with the high-resolution normals transferred, unwrapped
     into one 1024 atlas; clay colour and every decal are baked from the high-resolution set (Cycles EMIT,
     selected-to-active), soft occlusion is baked from the low-poly character itself and multiplied in;
  4. small geometry parts that carry the silhouette (blank eyes, worm brows, tongue tip, pinched antenna and ball,
     rolled clay-coil belt, warm-gold buckle) on flat painted tiles of the same atlas;
  5. a 26-bone humanoid rig (hip root, spine, chest, belly squash bone, head, antenna socket and two-bone antenna,
     eye and belt sockets for counter-scaling, tongue, clavicles, arms with fists, legs with pancake feet); bone-heat
     weights on the clay body, rigid weights on the parts, <= 4 influences.

Blender +Z up / +Y forward (glTF +Y up / -Z forward), floor-centred root, character right = +X.
"""
import bpy, bmesh, math, json, hashlib, datetime, struct, zlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler, Quaternion
from mathutils.bvhtree import BVHTree
import numpy as np

ROOT = Path('/workspace/haynes-quest/family-eras/putty-grunt/v001')
OWNER = 'claude-opus-5-5/putty-grunt-model'
sc = bpy.context.scene
assert sc.get('work_order') == 'WO111' and sc.get('asset_id') == 'putty-grunt' and sc.get('scene_lease') == 'active'
assert sc.get('scene_owner') == OWNER
STAGE = globals().get('STAGE', 'full')          # 'geometry' stops after the textured static checkpoint
BODY_TRIS = int(globals().get('BODY_TRIS', 10600))
MB_RES = float(globals().get('MB_RES', 0.0085))
T0 = datetime.datetime.now(datetime.timezone.utc)

# ---- Palette: sheet hex values; the buckle is a warmer gold per the coordinator note (sheet #dca953 / #b98a35) ----
PAL = {'clay': 'a39db6', 'dent': '9690ab', 'ridge': '6d6687', 'coil': '5e5775', 'honey': 'e9a23a', 'honeydk': 'b97a22',
       'eye': 'fbf6ea', 'mouth': '3b3049', 'tongue': 'e8909f', 'sheet_honey': 'dca953', 'sheet_honeydk': 'b98a35'}
def s2l(c): return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def lin(h): return tuple(s2l(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4))
def u8(h): return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float64)

# ---- Scene reset (lease props kept) ----
keep = {k: sc[k] for k in sc.keys() if k.startswith('blendermcp_') or k in ('work_order', 'scene_owner', 'scene_lease', 'asset_id', 'asset_version', 'authoring_model')}
if bpy.context.object and bpy.context.object.mode != 'OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
for coll in list(bpy.data.collections): bpy.data.collections.remove(coll)
for blocks in (bpy.data.meshes, bpy.data.curves, bpy.data.metaballs, bpy.data.armatures, bpy.data.materials, bpy.data.actions,
               bpy.data.cameras, bpy.data.lights, bpy.data.images, bpy.data.linestyles, bpy.data.textures, bpy.data.node_groups,
               bpy.data.texts, bpy.data.worlds):
    for b in list(blocks): blocks.remove(b)
bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
for key in list(sc.keys()):
    if key not in keep and key != 'cycles': del sc[key]
sc.unit_settings.system = 'METRIC'; sc.unit_settings.scale_length = 1.0
HIGH = bpy.data.collections.new('BAKE SOURCE high-resolution clay and painted decals (not exported)'); sc.collection.children.link(HIGH)
LOW = bpy.data.collections.new('Low-poly putty grunt parts'); sc.collection.children.link(LOW)

def V(*a): return Vector(a)
def smoothstep(t): t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)

# ================= Bind-pose layout (blockout coordinates, head straightened) =================
HEAD_C = V(0.016, 0.004, 1.095); HEAD_R = (0.168, 0.152, 0.172); ROLL = math.radians(8)
RY = Matrix.Rotation(-ROLL, 3, 'Y')             # blockout (head tilted 8 deg to its right) -> bind (head straight)
def to_rest(p): return HEAD_C + RY @ (Vector(p) - HEAD_C)
def dir_rest(d): return (RY @ Vector(d)).normalized()
ARM_UP, ARM_FORE, FIST_R = 0.233, 0.205, 0.071     # blockout upper arm and forearm; fist 7% bigger than the blockout's 0.066 so the mitten reads
def arm_layout(sx):
    S = V(0.212 * sx, -0.012, 0.852)
    d1 = V(math.sin(math.radians(40)) * sx, 0.05, -math.cos(math.radians(40))).normalized(); E = S + d1 * ARM_UP
    d2 = V(0.60 * sx, 0.17, -0.78).normalized(); W = E + d2 * ARM_FORE
    return S, E, W, W + d2 * FIST_R * 0.7, d1, d2
ARMS = {s: arm_layout(sx) for s, sx in (('R', 1), ('L', -1))}
HIP_Z = 0.47
def leg_layout(sx):
    hip = V(0.108 * sx, 0.0, HIP_Z); knee = V(0.158 * sx, 0.055, 0.252); ankle = V(0.18 * sx, 0.0, 0.085)
    yaw = math.radians(-15 * sx); fwd = V(math.sin(-yaw), math.cos(yaw), 0); side = V(fwd.y, -fwd.x, 0)
    return hip, knee, ankle, V(0.188 * sx, 0.044, 0.042), yaw, fwd, side
LEGS = {s: leg_layout(sx) for s, sx in (('R', 1), ('L', -1))}
SOLE = 0.003                                     # 3 mm sole clearance (interpolated frames never dip below the floor)

# ================= Metaball clay (the blockout recipe) =================
MB_T = 0.6
def K(s): return math.sqrt(1 - (MB_T / s) ** (1 / 3))
def mball(name):
    mb = bpy.data.metaballs.new(name); mb.resolution = MB_RES; mb.render_resolution = MB_RES; mb.threshold = MB_T
    mb.update_method = 'UPDATE_ALWAYS'; ob = bpy.data.objects.new(name, mb); HIGH.objects.link(ob); return ob
def mb_ball(ob, c, r, s=2.0):
    e = ob.data.elements.new(type='BALL'); e.co = Vector(c); e.radius = r / K(s); e.stiffness = s; return e
def mb_ellip(ob, c, radii, rot=(0, 0, 0), s=2.0):
    e = ob.data.elements.new(type='ELLIPSOID'); e.co = Vector(c); e.radius = 1.0 / K(s); e.stiffness = s
    e.size_x, e.size_y, e.size_z = radii; e.rotation = Euler(rot).to_quaternion(); return e
def mb_capsule(ob, a, b, r, s=2.0):
    a = Vector(a); b = Vector(b); d = b - a
    e = ob.data.elements.new(type='CAPSULE'); e.co = (a + b) / 2; e.radius = r / K(s); e.stiffness = s
    e.size_x = d.length / 2; e.rotation = d.to_track_quat('X', 'Z'); return e
def fist(ob, c, fwd, palm, r=FIST_R, thumb_side=1):
    """Blockout mitten fist: a big lump, a knuckle row facing fwd, a thumb wrapped over the curled fingers."""
    F = Vector(fwd).normalized(); D = (Vector(palm) - Vector(palm).dot(F) * F).normalized(); S = F.cross(D); c = Vector(c)
    mb_ellip(ob, c, (r * 1.06, r, r * 0.96), rot=Matrix((S, F, D)).transposed().to_euler())
    for t in (-1.5, -0.5, 0.5, 1.5):
        mb_ball(ob, c + F * r * 0.64 - D * r * 0.18 + S * t * r * 0.36 + F * r * 0.04 * (1 - abs(t) / 1.5), r * 0.37, s=1.6)
    a = c + S * thumb_side * r * 0.85 - F * r * 0.1 - D * r * 0.2
    b = c + F * r * 0.55 + D * r * 0.62 + S * thumb_side * r * 0.25
    mb_capsule(ob, a, b, r * 0.36, s=1.8)

def build_clay():
    ob = mball('Clay body mass')
    mb_ellip(ob, (0.0, 0.0, 0.565), (0.185, 0.15, 0.15))
    mb_ball(ob, (0.022, 0.062, 0.585), 0.118, s=1.7)                                  # pot belly, a little off-centre
    mb_ellip(ob, (0.0, -0.008, 0.76), (0.178, 0.132, 0.135))                          # chest
    for sx in (1, -1): mb_ball(ob, (0.182 * sx, -0.012, 0.842), 0.074, s=1.8)          # shoulder lumps
    mb_ellip(ob, tuple(HEAD_C), HEAD_R)                                                # big head, straight in the bind pose
    mb_ball(ob, to_rest((HEAD_C.x + 0.004, 0.158, 1.068)), 0.028, s=2.2)              # nub nose
    for c, r, s, head in (((-0.052, -0.035, 1.205), 0.07, 1.5, True),
                          ((0.088, 0.045, 1.012), 0.062, 1.35, True), ((-0.078, 0.05, 1.008), 0.058, 1.35, True),
                          ((0.06, -0.105, 0.725), 0.085, 1.4, False), ((-0.07, -0.098, 0.6), 0.08, 1.4, False),
                          ((-0.13, 0.05, 0.69), 0.07, 1.35, False), ((0.14, 0.02, 0.53), 0.075, 1.35, False),
                          ((0.0, -0.02, 0.92), 0.09, 1.6, False)):
        mb_ball(ob, to_rest(c) if head else c, r, s=s)
    for sx in (1, -1): mb_ball(ob, (0.108 * sx, 0.0, 0.475), 0.092, s=1.7)             # hip lumps where the legs join
    for s, sx in (('R', 1), ('L', -1)):                                                 # noodly arms, A-pose, mitten fists
        S, E, W, C, d1, d2 = ARMS[s]
        mb_ball(ob, S, 0.062); mb_capsule(ob, S, E, 0.05); mb_ball(ob, E, 0.052, s=1.8)
        fist(ob, C, d2, V(-sx, 0, 0), thumb_side=sx)
        mb_capsule(ob, E, W, 0.046)
    for s, sx in (('R', 1), ('L', -1)):                                                 # stumpy legs, pancake feet
        hip, knee, ankle, fc, yaw, fwd, side = LEGS[s]
        mb_capsule(ob, hip, knee, 0.07); mb_ball(ob, knee, 0.068, s=1.8); mb_capsule(ob, knee, ankle, 0.06)
        mb_ellip(ob, fc, (0.096, 0.14, 0.05), rot=(0, 0, yaw))
        for t in (-1, 0, 1):
            mb_ball(ob, fc + fwd * 0.124 + side * t * 0.05 + V(0, 0, -0.004), 0.036 if t else 0.039, s=1.7)
    bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg)); mb = ob.data
    bpy.data.objects.remove(ob, do_unlink=True); bpy.data.metaballs.remove(mb)
    tmp = bpy.data.objects.new('remesh tmp', me); HIGH.objects.link(tmp)
    rm = tmp.modifiers.new('Clean clay surface', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = MB_RES * 0.9; rm.adaptivity = 0.0
    bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
    clean = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg)); bpy.data.objects.remove(tmp, do_unlink=True); bpy.data.meshes.remove(me)
    bm = bmesh.new(); bm.from_mesh(clean)
    for _ in range(2): bmesh.ops.smooth_vert(bm, verts=bm.verts, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(clean); bm.free()
    for v in clean.vertices:
        if v.co.z < SOLE: v.co.z = SOLE                                                 # squashed pancake soles, flat
    clean.update(); clean.name = 'High-resolution clay body'
    body = bpy.data.objects.new('High-resolution clay body', clean); HIGH.objects.link(body)
    return body

def ray(target, origin, direction, dist=10.0):
    hit, loc, nrm, idx = target.ray_cast(Vector(origin), Vector(direction).normalized(), distance=dist)
    assert hit, (target.name, tuple(origin), tuple(direction))
    return loc, nrm.normalized()

def dent(ob, p, n, rx, ry, spin, depth, rim=0.3):
    """Blockout thumb dimple pressed into mesh `ob` at surface point p, normal n, with a pushed-up rim (vectorised)."""
    R = (n.to_track_quat('Z', 'Y') @ Quaternion((0, 0, 1), spin)).to_matrix(); Rt = np.array(R.transposed())
    me = ob.data; co = np.zeros(len(me.vertices) * 3); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    l = (co - np.array(p)) @ Rt.T
    u = np.sqrt((l[:, 0] / rx) ** 2 + (l[:, 1] / ry) ** 2)
    ok = (np.abs(l[:, 2]) <= 0.6 * max(rx, ry)) & (u < 1.35)
    w = np.where(u < 1, -depth * (1 - u * u) ** 2, depth * rim * np.sin(np.pi * (u - 1) / 0.35))
    co[ok] += np.outer(w[ok], np.array(n))
    me.vertices.foreach_set('co', co.ravel()); me.update()

def arm_print(s, seg, t, out_sign):
    S, E, W, C, d1, d2 = ARMS[s]; a, b, d = (S, E, d1) if seg == 'upper' else (E, W, d2)
    sx = 1 if s == 'R' else -1
    n = V(-d.z * sx * out_sign, 0, d.x * sx * out_sign).normalized()
    if n.x * sx < 0: n = -n
    mid = a.lerp(b, t); return mid + n * 0.5, -n

PRINTS = [  # tag, origin, direction, radius, spin, depth, whorl turns (bind-pose coordinates)
    ('chest emblem', V(-0.012, 1.0, 0.765), V(0, -1, 0), 0.072, 0.12, 0.009, 6.6),
    ('forehead', to_rest((0.035, 0.8, 1.385)), dir_rest((0.0, -1.0, -0.25)), 0.042, -0.5, 0.006, 4.0),
    ('cheek', to_rest((1.0, 0.5, 1.02)), dir_rest((-0.9, -0.5, 0.0)), 0.034, 0.9, 0.005, 2.8),
    ('belly', V(0.35, 1.0, 0.54), V(-0.3, -1, 0.0), 0.045, 0.7, 0.006, 3.6),
    ('back of head', to_rest((0.02, -1.0, 1.13)), V(0, 1, 0), 0.055, 0.3, 0.006, 4.2),
    ('shoulder blade', V(-0.1, -1.0, 0.8), V(0.05, 1, -0.05), 0.058, -0.4, 0.006, 4.2),
    ('lower back', V(0.08, -1.0, 0.56), V(0, 1, 0), 0.05, 1.0, 0.006, 3.8),
    ('upper arm', *arm_print('L', 'upper', 0.5, 1), 0.032, 1.4, 0.005, 2.6),
    ('forearm', *arm_print('R', 'fore', 0.45, 1), 0.03, 0.2, 0.005, 2.6),
    ('thigh', V(0.4, 1.0, 0.37), V(-0.25, -1, 0.0), 0.034, 0.6, 0.005, 2.8),
    ('calf', V(-0.19, -1.0, 0.18), V(0, 1, 0), 0.03, -0.8, 0.005, 2.6),
]

def press_and_texture(body):
    prints = []
    for tag, org, dirn, r, spin, depth, turns in PRINTS:
        p, n = ray(body, org, dirn); dent(body, p, n, r, r * 0.78, spin, depth); prints.append((tag, p, n, r, spin, turns))
    tex = bpy.data.textures.new('Clay hand-worked noise', 'CLOUDS'); tex.noise_scale = 0.07; tex.noise_depth = 1
    vg = body.vertex_groups.new(name='Clay noise weight')
    for v in body.data.vertices: vg.add([v.index], min(1.0, max(0.0, (v.co.z - SOLE - 0.004) / 0.03)), 'REPLACE')
    md = body.modifiers.new('Clay irregularity', 'DISPLACE'); md.texture = tex; md.strength = 0.016; md.mid_level = 0.5
    md.texture_coords = 'LOCAL'; md.direction = 'NORMAL'; md.vertex_group = vg.name
    bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(body.evaluated_get(dg)); old = body.data
    body.modifiers.clear(); body.data = me; bpy.data.meshes.remove(old); me.name = 'High-resolution clay body'
    for g in list(body.vertex_groups): body.vertex_groups.remove(g)
    for p in me.polygons: p.use_smooth = True
    # re-project print centres onto the displaced surface
    out = []
    for tag, p, n, r, spin, turns in prints:
        q, nn = ray(body, p + n * 0.05, -n, 0.12); out.append((tag, q, nn, r, spin, turns))
    return out

# ================= Painted decals on the high-resolution surface (bake sources) =================
EMIT = {}
def emit_mat(key):
    if key in EMIT: return EMIT[key]
    m = bpy.data.materials.new('BAKE emit ' + key + ' #' + PAL[key]); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    e = nt.nodes.new('ShaderNodeEmission'); e.inputs['Color'].default_value = (*lin(PAL[key]), 1.0); e.inputs['Strength'].default_value = 1.0
    o = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(e.outputs['Emission'], o.inputs['Surface'])
    EMIT[key] = m; return m

def grid_decal(name, P2, nu, nv, closed, proj, key, off):
    cols = nu if closed else nu + 1; verts = []; nrm = []
    for i in range(cols):
        for j in range(nv + 1):
            h, nn = proj(P2(i / nu, j / nv)); verts.append(tuple(h + nn * off)); nrm.append(nn)
    faces = []
    for i in range(nu):
        i2 = (i + 1) % cols if closed else i + 1
        for j in range(nv):
            faces.append((i * (nv + 1) + j, i2 * (nv + 1) + j, i2 * (nv + 1) + j + 1, i * (nv + 1) + j + 1))
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-6); bm.to_mesh(me); bm.free(); me.update()
    avg = sum(nrm, Vector()).normalized()
    if sum(p.normal.dot(avg) for p in me.polygons) < 0:
        bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.reverse_faces(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); HIGH.objects.link(ob); me.materials.append(emit_mat(key)); return ob

def tangent_proj(target, p, n, spin):
    R = (n.to_track_quat('Z', 'Y') @ Quaternion((0, 0, 1), spin)).to_matrix()
    def proj(pt):
        o = p + R @ V(pt[0], pt[1], 0) + n * 0.05
        hit, loc, nrm, _ = target.ray_cast(o, -n, distance=0.1)
        if not hit: return o - n * 0.05, n
        return loc, nrm.normalized()
    return proj

def face_proj(target):
    """Blockout front planar projection, with blockout (x, z) coordinates carried into the straightened head."""
    def proj(pt3):
        q = to_rest(pt3); o = V(q.x, 0.6, q.z)
        hit, loc, nrm, _ = target.ray_cast(o, V(0, -1, 0))
        assert hit, pt3
        return loc, nrm.normalized()
    return proj

def paint_decals(body, prints):
    for tag, p, n, r, spin, turns in prints:
        proj = tangent_proj(body, p, n, spin); rx, ry = r * 0.98, r * 0.76
        grid_decal(f'Thumbprint dent {tag}', lambda u, v: (rx * v * math.cos(math.tau * u), ry * v * math.sin(math.tau * u)), 40, 5, True, proj, 'dent', 0.0008)
        # one continuous whorl ridge (the blockout's fingerprint loop); small prints get fewer, wider turns so the
        # ridges survive the atlas resolution at play distance
        wd = max(0.0034, min(0.0056, r * 0.085)); f0 = 0.12
        def whorl(u, v, turns=turns, wd=wd, rx=rx, ry=ry, r=r):
            th = u * turns * math.tau; f = f0 + (0.93 - f0) * u; cy = r * 0.14 * (1 - f)
            return ((rx * f * 0.8 + (v - 0.5) * wd) * math.cos(th), cy + (ry * f + (v - 0.5) * wd) * math.sin(th))
        grid_decal(f'Thumbprint whorl ridge {tag}', whorl, int(turns * 56), 1, False, proj, 'ridge', 0.0015)
    face = face_proj(body)
    def grin(u, v):
        x = -0.066 + 0.128 * u; top = 1.0 + 0.02 * (u - 0.5) + 0.028 * (2 * u - 1) ** 2 * (1.25 if u > 0.5 else 0.85)
        depth = 0.004 + 0.03 * math.sin(math.pi * u) ** 0.8
        return (HEAD_C.x + x + 0.01, 0.0, top - depth * v)
    grid_decal('Lopsided dopey grin', grin, 72, 6, False, face, 'mouth', 0.0012)
    tx, tz = HEAD_C.x + 0.031, 0.972
    grid_decal('Tongue inside the grin', lambda u, v: (tx + 0.017 * v * math.cos(math.tau * u), 0.0, tz + 0.006 + 0.011 * v * math.sin(math.tau * u)),
               32, 3, True, face, 'tongue', 0.0018)
    return face

# ================= Atlas layout =================
BODY_SPAN = 960 / 1024; BODY_V0 = 1 - BODY_SPAN          # body islands: 960 px square, top-left
TILE = 64 / 1024                                           # flat painted tiles: 64 px, right-hand column
TILES = {k: (BODY_SPAN, 1 - (i + 1) * TILE) for i, k in enumerate(('clay', 'coil', 'honey', 'honeydk', 'eye', 'tongue', 'mouth'))}
TILE_INSET = 0.16
def island_scale(c, n):
    """Texel-density bias per UV island (applied before packing): the face reads first, soles hardly ever."""
    if n.z < -0.75 and c.z < 0.06: return 0.45
    if c.z > 0.93 and n.y > 0.35 and abs(c.x - HEAD_C.x) < 0.16: return 2.1
    if c.z > 0.93: return 1.35
    if 0.6 < c.z <= 0.93 and n.y > 0.35: return 1.2
    return 1.0

MATS = []
def setup_materials(image):
    for label, rough in (('Matte hand-worked clay', 0.86), ('Satin blank eyes, tongue and warm-gold buckle', 0.42)):
        m = bpy.data.materials.new(label); m.use_nodes = True; bs = m.node_tree.nodes.get('Principled BSDF')
        bs.inputs['Roughness'].default_value = rough; bs.inputs['Metallic'].default_value = 0.0; bs.inputs['Specular IOR Level'].default_value = 0.30
        tex = m.node_tree.nodes.new('ShaderNodeTexImage'); tex.image = image; tex.extension = 'EXTEND'; tex.interpolation = 'Linear'
        m.node_tree.links.new(tex.outputs['Color'], bs.inputs['Base Color']); MATS.append(m)

PARTS = []
def finish_part(ob, tile, mat, bone_weights):
    """Flat painted tile UVs (per-face dominant-axis projection inside the tile) and rigid/explicit bone weights."""
    me = ob.data
    for p in me.polygons: p.use_smooth = True
    for layer in list(me.uv_layers): me.uv_layers.remove(layer)
    uv = me.uv_layers.new(name='Putty grunt atlas UV')
    u0, v0 = TILES[tile]; pts = [v.co for v in me.vertices]
    lo = [min(p[k] for p in pts) for k in range(3)]; span = [max(1e-4, max(p[k] for p in pts) - lo[k]) for k in range(3)]
    for p in me.polygons:
        k = max(range(3), key=lambda k: abs(p.normal[k])); ax = [a for a in range(3) if a != k]
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (u0 + TILE * (TILE_INSET + (1 - 2 * TILE_INSET) * (co[ax[0]] - lo[ax[0]]) / span[ax[0]]),
                              v0 + TILE * (TILE_INSET + (1 - 2 * TILE_INSET) * (co[ax[1]] - lo[ax[1]]) / span[ax[1]]))
    me.materials.append(MATS[mat]); ob['atlas_tile'] = tile; ob['bone_weights'] = json.dumps(bone_weights) if isinstance(bone_weights, dict) else 'function'
    PARTS.append((ob, bone_weights)); return ob

def mesh_ob(name, verts, faces):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free(); ob = bpy.data.objects.new(name, me); LOW.objects.link(ob); return ob

def ellipsoid(name, M, s, n=20, r=10):
    verts = [M @ V(0, 0, -s[2])]
    for j in range(1, r):
        a = -math.pi / 2 + math.pi * j / r; ca = math.cos(a)
        verts += [M @ V(s[0] * ca * math.cos(math.tau * i / n), s[1] * ca * math.sin(math.tau * i / n), s[2] * math.sin(a)) for i in range(n)]
    verts.append(M @ V(0, 0, s[2]))
    faces = [(0, 1 + (i + 1) % n, 1 + i) for i in range(n)]
    for j in range(r - 2):
        for i in range(n): faces.append((1 + j * n + i, 1 + j * n + (i + 1) % n, 1 + (j + 1) * n + (i + 1) % n, 1 + (j + 1) * n + i))
    top = len(verts) - 1; base = 1 + (r - 2) * n
    faces += [(base + i, base + (i + 1) % n, top) for i in range(n)]
    return mesh_ob(name, verts, faces)

def catmull(pts, per=10):
    P = [Vector(p) for p in pts]; P = [P[0] + (P[0] - P[1])] + P + [P[-1] + (P[-1] - P[-2])]; out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for s in range(per):
            t = s / per
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-2]); return out

def tube(name, path, radii, n=8, up=(0, 0, 1), caps=True):
    m = len(path); lens = [0.0]
    for i in range(1, m): lens.append(lens[-1] + (path[i] - path[i - 1]).length)
    total = lens[-1]; verts = []; faces = []
    T = (path[1] - path[0]).normalized(); N = Vector(up) - Vector(up).dot(T) * T
    if N.length < 1e-3: N = T.cross(V(1, 0, 0))
    N.normalize()
    for i in range(m):
        if i > 0: T = (path[min(i + 1, m - 1)] - path[i - 1]).normalized(); N = (N - N.dot(T) * T).normalized()
        B = T.cross(N); u = lens[i] / total
        k = u * (len(radii) - 1); k0 = min(int(k), len(radii) - 2); r = radii[k0] + (radii[k0 + 1] - radii[k0]) * (k - k0)
        verts += [path[i] + r * (math.cos(math.tau * j / n) * N + math.sin(math.tau * j / n) * B) for j in range(n)]
    for i in range(m - 1):
        for j in range(n): faces.append((i * n + j, i * n + (j + 1) % n, (i + 1) * n + (j + 1) % n, (i + 1) * n + j))
    if caps: faces += [tuple(range(n - 1, -1, -1)), tuple((m - 1) * n + j for j in range(n))]
    return mesh_ob(name, verts, faces), lens

def lathe(name, M, profile, n=20, cap_start=True, cap_end=True):
    """Surface of revolution about local +Z; profile (z, r); r == 0 at an end makes a pole, else an optional cap."""
    verts = []; faces = []; rings = []
    for z, r in profile:
        if r <= 0: rings.append([len(verts)]); verts.append(M @ V(0, 0, z))
        else:
            rings.append(list(range(len(verts), len(verts) + n))); verts += [M @ V(r * math.cos(math.tau * i / n), r * math.sin(math.tau * i / n), z) for i in range(n)]
    for a, b in zip(rings, rings[1:]):
        if len(a) == 1: faces += [(a[0], b[(i + 1) % n], b[i]) for i in range(n)]
        elif len(b) == 1: faces += [(a[i], a[(i + 1) % n], b[0]) for i in range(n)]
        else: faces += [(a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]) for i in range(n)]
    if cap_start and len(rings[0]) > 1: faces.append(tuple(reversed(rings[0])))
    if cap_end and len(rings[-1]) > 1: faces.append(tuple(rings[-1]))
    return mesh_ob(name, verts, faces)

# ================= Build =================
t_build = datetime.datetime.now()
HB = build_clay()
PRINT_LIST = press_and_texture(HB)
FACE = paint_decals(HB, PRINT_LIST)
def clay_cavity_mat():
    """Clay colour darkened in the high-resolution creases (knuckles, thumb, toes, dimple rims, lumps) from Cycles
    pointiness, lightly lifted on ridges, so the low-poly skin keeps the hand-worked detail in its atlas."""
    m = bpy.data.materials.new('BAKE emit clay #' + PAL['clay'] + ' with pointiness cavity'); m.use_nodes = True; nt = m.node_tree
    for nd in list(nt.nodes): nt.nodes.remove(nd)
    g = nt.nodes.new('ShaderNodeNewGeometry')
    lo = nt.nodes.new('ShaderNodeMapRange'); lo.clamp = True
    lo.inputs['From Min'].default_value = CAVITY[0]; lo.inputs['From Max'].default_value = 0.5; lo.inputs['To Min'].default_value = CAVITY[1]; lo.inputs['To Max'].default_value = 1.0
    hi = nt.nodes.new('ShaderNodeMapRange'); hi.clamp = True
    hi.inputs['From Min'].default_value = 0.5; hi.inputs['From Max'].default_value = CAVITY[2]; hi.inputs['To Min'].default_value = 1.0; hi.inputs['To Max'].default_value = CAVITY[3]
    nt.links.new(g.outputs['Pointiness'], lo.inputs['Value']); nt.links.new(g.outputs['Pointiness'], hi.inputs['Value'])
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; nt.links.new(lo.outputs['Result'], mul.inputs[0]); nt.links.new(hi.outputs['Result'], mul.inputs[1])
    sc_ = nt.nodes.new('ShaderNodeVectorMath'); sc_.operation = 'SCALE'; sc_.inputs[0].default_value = lin(PAL['clay'])
    nt.links.new(mul.outputs['Value'], sc_.inputs['Scale'])
    e = nt.nodes.new('ShaderNodeEmission'); e.inputs['Strength'].default_value = 1.0; nt.links.new(sc_.outputs['Vector'], e.inputs['Color'])
    o = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(e.outputs['Emission'], o.inputs['Surface'])
    return m
CAVITY = tuple(globals().get('CAVITY', (0.40, 0.72, 0.60, 1.05)))
HB.data.materials.append(clay_cavity_mat())
EMIT['clay'] = HB.data.materials[0]
high_tris = sum(len(p.vertices) - 2 for p in HB.data.polygons)

# ---- low-poly clay body: decimate, keep the high-resolution shading normals ----
LB = bpy.data.objects.new('Low-poly clay body', HB.data.copy()); LOW.objects.link(LB); LB.data.materials.clear()
LB.data.name = 'Low-poly clay body'
# Uniform start (voxel remesh) snapped back onto the true clay surface, then a modest protected collapse: an
# adaptive collapse straight from the 98k surface spent its budget on the hand-worked lumps and left the big
# smooth head and belly with 6 cm facets on the silhouette.
VOXEL_LOW = float(globals().get('VOXEL_LOW', 0.0145))
rm = LB.modifiers.new('Uniform low-poly start', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = VOXEL_LOW; rm.adaptivity = 0.0
sw = LB.modifiers.new('Back onto the clay surface', 'SHRINKWRAP'); sw.target = HB; sw.wrap_method = 'NEAREST_SURFACEPOINT'
bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
me0 = bpy.data.meshes.new_from_object(LB.evaluated_get(dg)); old0 = LB.data; LB.modifiers.clear(); LB.data = me0; bpy.data.meshes.remove(old0)
uniform_tris = sum(len(p.vertices) - 2 for p in me0.polygons)
# protect the silhouette details from the collapse: knuckles and thumbs, the face and nose, the toe bumps
keepg = LB.vertex_groups.new(name='Decimate protection')
FIST_C = [ARMS[s][3] for s in 'RL']; TOES = [LEGS[s][3] + LEGS[s][5] * 0.124 for s in 'RL']
for v in LB.data.vertices:
    w = 0.0
    for c in FIST_C: w = max(w, smoothstep(1 - ((v.co - c).length - 0.08) / 0.04))
    for c in TOES: w = max(w, 0.6 * smoothstep(1 - ((v.co - c).length - 0.06) / 0.03))
    if v.co.z > 0.93 and v.co.y > 0.06 and abs(v.co.x - HEAD_C.x) < 0.15: w = max(w, 0.45)
    keepg.add([v.index], w, 'REPLACE')
md = LB.modifiers.new('Budget decimate', 'DECIMATE'); md.decimate_type = 'COLLAPSE'; md.use_collapse_triangulate = True
md.vertex_group = keepg.name; md.invert_vertex_group = True; md.vertex_group_factor = float(globals().get('KEEP_FACTOR', 3.0))   # inverted: weight 1 is protected
md.ratio = min(1.0, BODY_TRIS / uniform_tris)
bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
me = bpy.data.meshes.new_from_object(LB.evaluated_get(dg)); old = LB.data; LB.modifiers.clear(); LB.data = me; bpy.data.meshes.remove(old)
me.name = 'Low-poly clay body'
for v in me.vertices:
    if v.co.z < SOLE: v.co.z = SOLE
for p in me.polygons: p.use_smooth = True
for g in list(LB.vertex_groups): LB.vertex_groups.remove(g)
bpy.ops.object.select_all(action='DESELECT'); LB.select_set(True); bpy.context.view_layer.objects.active = LB
dt = LB.modifiers.new('High-resolution clay shading normals', 'DATA_TRANSFER'); dt.object = HB; dt.use_loop_data = True
dt.data_types_loops = {'CUSTOM_NORMAL'}; dt.loop_mapping = 'POLYINTERP_NEAREST'
bpy.ops.object.modifier_apply(modifier=dt.name)
body_tris = sum(len(p.vertices) - 2 for p in LB.data.polygons)

# ---- small parts that carry the silhouette ----
setup_materials(None)
face = FACE
EYES = {}
for side, sx, rr in (('R', 1, 1.1), ('L', -1, 0.94)):
    p, n = face((HEAD_C.x + (0.064 + 0.004) * sx + 0.005, 0.0, 1.134 - 0.009 * sx))
    nf = (n * 0.5 + V(0, 1, 0) * 0.5).normalized(); k = 1.12             # eyes 12% larger than the sheet (coordinator note)
    M = Matrix.Translation(p - nf * 0.018) @ nf.to_track_quat('Y', 'Z').to_matrix().to_4x4()
    ob = ellipsoid(f'Blank round eye {side}', M, (0.047 * rr * k, 0.034 * rr * k, 0.05 * rr * k), n=22, r=11)
    EYES[side] = (p - nf * 0.018, nf, (0.047 * rr * k, 0.034 * rr * k, 0.05 * rr * k))
    finish_part(ob, 'eye', 1, {'eye_' + side: 1.0})
for side, pts2, lift in (('L', [(-0.098, 1.192), (-0.075, 1.214), (-0.048, 1.222), (-0.022, 1.211)], 0.010),
                         ('R', [(0.058, 1.19), (0.086, 1.196), (0.114, 1.19), (0.132, 1.178)], 0.017)):
    pts = []
    for x, z in pts2:
        h, nn = face((HEAD_C.x + x, 0.0, z + lift)); pts.append(h + nn * 0.004)
    path = catmull(pts, 5); radii = [0.0075, 0.0115, 0.011, 0.0068]
    ob, _ = tube(f'Clay worm brow {side}', path, radii, n=8, up=(0, 1, 0), caps=False)
    finish_part(ob, 'clay', 0, {'head': 1.0})
    for e, r in ((path[0], radii[0]), (path[-1], radii[-1])):
        finish_part(ellipsoid(f'Clay worm brow {side} rounded end', Matrix.Translation(e), (r, r, r), n=8, r=5), 'clay', 0, {'head': 1.0})
tx, tz = HEAD_C.x + 0.031, 0.972
p, n = face((tx, 0.0, tz))
TONGUE_ROOT = p.copy()
q = n.to_track_quat('Y', 'Z') @ Quaternion((0, 1, 0), math.radians(10)) @ Quaternion((1, 0, 0), math.radians(24))
M = Matrix.Translation(p) @ q.to_matrix().to_4x4() @ Matrix.Translation(V(0.0, 0.005, -0.009))
finish_part(ellipsoid('Poking-out pink tongue', M, (0.021, 0.0095, 0.028), n=16, r=8), 'tongue', 1, {'tongue': 1.0})
TONGUE_TIP = M @ V(0, 0, -0.028)
# pinched antenna: blockout offsets expressed in the straightened head frame
top, tn = ray(HB, V(HEAD_C.x + 0.003, 0.0, 2.0), V(0, 0, -1))
base = top - V(0, 0, 0.012)
apts = [base] + [base + RY @ V(*o) * 0.9 for o in ((0.006, 0.0, 0.034), (0.018, -0.004, 0.072), (0.036, -0.01, 0.1))]   # 10% shorter stalk keeps the ball top inside 1.40 m
apath = catmull(apts, 5)
ANT = {'base': base, 'path': apath}
tip = apath[-1] + (apath[-1] - apath[-3]).normalized() * 0.022
ANT['ball'] = tip
ob, alen = tube('Pinched antenna stalk', apath, [0.022, 0.014, 0.011, 0.012], n=10, up=(0, 1, 0), caps=True)
def ant_w(co, path=apath, lens=alen):
    i = min(range(len(path)), key=lambda k: (path[k] - co).length); f = lens[i] / lens[-1]
    t = smoothstep((f - 0.35) / 0.4); return {'antenna_1': 1 - t, 'antenna_2': t}
finish_part(ob, 'clay', 0, ant_w)
finish_part(ellipsoid('Antenna clay ball', Matrix.Translation(tip), (0.03, 0.029, 0.028), n=16, r=9), 'clay', 0, {'antenna_2': 1.0})
finish_part(ellipsoid('Antenna ball pinch', Matrix.Translation(tip + RY @ V(-0.012, 0.0, 0.018)), (0.012, 0.011, 0.01), n=10, r=6), 'clay', 0, {'antenna_2': 1.0})
# rolled clay-coil belt (dips under the pot belly) and a round warm-gold buckle; rays cast outward from the axis so
# the A-pose fists never intercept them
path = []
for k in range(96):
    th = math.tau * k / 96; d = V(math.cos(th), math.sin(th), 0); z = 0.508 - 0.03 * math.sin(th)
    h, nn = ray(HB, V(0, 0, z), d, 1.0); path.append(h + nn * 0.011)
for _ in range(3): path = [(path[i - 1] + 2 * path[i] + path[(i + 1) % len(path)]) / 4 for i in range(len(path))]
BELT_PATH = path
bp = path[::2]; m = len(bp); n = 10; verts = []; faces = []
for i in range(m):
    T = (bp[(i + 1) % m] - bp[i - 1]).normalized(); N = (V(0, 0, 1) - V(0, 0, 1).dot(T) * T).normalized(); B = T.cross(N); u = i / m
    r = 0.024 * (1 + 0.1 * math.sin(u * math.tau * 5) + 0.06 * math.sin(u * math.tau * 11 + 1))
    verts += [bp[i] + r * (math.cos(math.tau * j / n) * N + math.sin(math.tau * j / n) * B) for j in range(n)]
for i in range(m):
    for j in range(n): faces.append((i * n + j, i * n + (j + 1) % n, ((i + 1) % m) * n + (j + 1) % n, ((i + 1) % m) * n + j))
finish_part(mesh_ob('Rolled clay-coil belt', verts, faces), 'coil', 0, {'belt': 1.0})
front = path[24]; fn = (V(front.x, front.y, 0).normalized() * 0.9 + V(0, 0, -0.1)).normalized()
BM = Matrix.Translation(front + fn * 0.002) @ fn.to_track_quat('Z', 'Y').to_matrix().to_4x4()
# solid warm-gold disc with a raised rim; the darker pressed centre sits 0.5 mm below the rim lip (the first build's
# open ring with a recessed plug read as a donut with a slot in exact-GLB close-ups)
finish_part(lathe('Round warm-gold buckle', BM, [(0.0, 0.0), (0.0, 0.047), (0.004, 0.051), (0.022, 0.051), (0.028, 0.047), (0.031, 0.040),
                                                   (0.031, 0.029), (0.029, 0.0255), (0.029, 0.0)], n=24), 'honey', 1, {'belt': 1.0})
finish_part(lathe('Buckle pressed centre', BM, [(0.0284, 0.0), (0.0284, 0.025), (0.0300, 0.0244), (0.0305, 0.022), (0.0305, 0.0)], n=20), 'honeydk', 1, {'belt': 1.0})
BUCKLE = BM @ V(0, 0, 0.031)

# ================= Atlas: tiles, body unwrap, bake =================
def area_override():
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type == 'VIEW_3D':
                region = next(r for r in area.regions if r.type == 'WINDOW')
                return dict(window=window, screen=window.screen, area=area, region=region)
    raise RuntimeError('no VIEW_3D area')

bpy.ops.object.select_all(action='DESELECT'); LB.select_set(True); bpy.context.view_layer.objects.active = LB
with bpy.context.temp_override(**area_override(), active_object=LB, object=LB, selected_objects=[LB], selected_editable_objects=[LB]):
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(70), margin_method='SCALED', island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    from bpy_extras import bmesh_utils
    bm = bmesh.from_edit_mesh(LB.data); uvk = bm.loops.layers.uv.active; bm.faces.ensure_lookup_table()
    def uv_area(f):
        uv = [l[uvk].uv for l in f.loops]; return sum(abs((uv[k] - uv[0]).cross(uv[k + 1] - uv[0])) / 2 for k in range(1, len(uv) - 1))
    dens = sorted((uv_area(f) / f.calc_area()) ** 0.5 for f in bm.faces if f.calc_area() > 1e-7)[len(bm.faces) // 2]
    # The face (eyes, nose, grin, tongue, forehead print) becomes one front-planar island in the straightened head
    # frame, so the painted grin never straddles a smart-project seam.
    face_faces = [f for f in bm.faces if 0.9 < f.calc_center_median().z < 1.27 and f.normal.y > 0.42 and abs(f.calc_center_median().x - HEAD_C.x) < 0.17]
    for f in face_faces:
        for l in f.loops: l[uvk].uv = Vector((l.vert.co.x, l.vert.co.z)) * dens
    island_scales = []
    for isl in bmesh_utils.bmesh_linked_uv_islands(bm, uvk):
        c3 = sum((f.calc_center_median() for f in isl), Vector()) / len(isl); n3 = sum((f.normal * f.calc_area() for f in isl), Vector()).normalized()
        k = island_scale(c3, n3); island_scales.append(k)
        cu = sum((l[uvk].uv for f in isl for l in f.loops), Vector((0, 0))) / sum(len(f.loops) for f in isl)
        for f in isl:
            for l in f.loops: l[uvk].uv = cu + (l[uvk].uv - cu) * k
    bmesh.update_edit_mesh(LB.data)
    bpy.ops.uv.pack_islands(udim_source='CLOSEST_UDIM', rotate=True, rotate_method='ANY', scale=True, merge_overlap=False, margin_method='SCALED', margin=0.006, shape_method='CONCAVE')
    bpy.ops.object.mode_set(mode='OBJECT')
uvl = LB.data.uv_layers.active; uvl.name = 'Putty grunt atlas UV'
uvs = np.zeros(len(uvl.data) * 2); uvl.data.foreach_get('uv', uvs); uvs = uvs.reshape(-1, 2)
assert uvs.min() >= -1e-6 and uvs.max() <= 1 + 1e-6, (uvs.min(), uvs.max())
uvs[:, 0] = uvs[:, 0] * BODY_SPAN; uvs[:, 1] = BODY_V0 + uvs[:, 1] * BODY_SPAN; uvl.data.foreach_set('uv', uvs.ravel())
body_uv_islands_px = int(BODY_SPAN * 1024)

sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 96; sc.cycles.use_denoising = False
world = bpy.data.worlds.new('Bake world'); sc.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (1, 1, 1, 1); world.light_settings.distance = 0.13
def bake_image(name, size=1024):
    img = bpy.data.images.new(name, size, size, alpha=True, float_buffer=True); img.colorspace_settings.name = 'Linear Rec.709'
    img.generated_color = (0, 0, 0, 0); return img
CS = 2048                                                   # colour is baked at 2x and box-filtered down (anti-aliased decal edges)
IMG_C = bake_image('BAKE clay colour and decals (2048, filtered to the 1024 atlas)', CS); IMG_AO = bake_image('BAKE soft occlusion')
bmat = bpy.data.materials.new('BAKE target'); bmat.use_nodes = True
tnode = bmat.node_tree.nodes.new('ShaderNodeTexImage'); bmat.node_tree.nodes.active = tnode
LB.data.materials.append(bmat)
def bake(kind, img, selected, margin=10, **kw):
    tnode.image = img
    bpy.ops.object.select_all(action='DESELECT')
    for o in selected: o.select_set(True)
    LB.select_set(True); bpy.context.view_layer.objects.active = LB
    bk = sc.render.bake; bk.margin = margin; bk.margin_type = 'EXTEND'; bk.use_clear = True; bk.target = 'IMAGE_TEXTURES'
    bk.use_selected_to_active = bool(selected); bk.cage_extrusion = 0.015; bk.max_ray_distance = 0.045
    t = datetime.datetime.now(); bpy.ops.object.bake(type=kind, use_selected_to_active=bool(selected), **kw)
    return round((datetime.datetime.now() - t).total_seconds(), 1)
high = [o for o in HIGH.objects]
for o in high: o.hide_render = False
bake_s = {'emit': bake('EMIT', IMG_C, high, margin=20)}
for o in high: o.hide_render = True                       # occlusion from the low-poly character itself
bake_s['ao'] = bake('AO', IMG_AO, [])
for o in high: o.hide_render = False
colour = np.zeros(CS * CS * 4, np.float32); IMG_C.pixels.foreach_get(colour); colour = colour.reshape(CS, CS, 4)
cov2 = colour[..., :3].sum(-1, keepdims=True) > 1e-6     # the bake clears to opaque black; every painted colour is brighter
colour = np.where(cov2, colour, np.array([*lin(PAL['clay']), 1.0]))
colour = colour.reshape(1024, 2, 1024, 2, 4).mean(axis=(1, 3)); cov2 = cov2.reshape(1024, 2, 1024, 2, 1).max(axis=(1, 3))
ao = np.zeros(1024 * 1024 * 4, np.float32); IMG_AO.pixels.foreach_get(ao); ao = ao.reshape(1024, 1024, 4)
def l2s(x): x = np.clip(x, 0, 1); return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(x, 1 / 2.4) - 0.055)
AO_STRENGTH = 0.45
atlas = np.zeros((1024, 1024, 3))
clay_lin = np.array(lin(PAL['clay']))
lit = colour[..., :3] * (1 - AO_STRENGTH * (1 - np.clip(ao[..., :1], 0, 1)))
covered = cov2
atlas[:] = clay_lin
atlas = np.where(covered, lit, atlas)
rng = np.random.default_rng(11112)
def fill_tile(key, u0, v0, size=TILE):
    x0 = int(round(u0 * 1024)); y0 = int(round(v0 * 1024)); s = int(round(size * 1024))
    yy, xx = np.mgrid[0:s, 0:s]
    field = 0.010 * np.sin(xx * 0.031 + yy * 0.017) + 0.006 * np.cos(xx * 0.071 - yy * 0.043) + rng.normal(0, 0.002, (s, s))
    base = np.array(lin(PAL[key]))
    atlas[y0:y0 + s, x0:x0 + s] = np.clip(base[None, None, :] * (1 + field[..., None]), 0, 1)
for key, (u0, v0) in TILES.items(): fill_tile(key, u0, v0)
body_mask = np.zeros((1024, 1024), bool); body_mask[int(BODY_V0 * 1024):, :int(BODY_SPAN * 1024)] = True
body_coverage = float(covered[..., 0][body_mask].mean())
srgb = np.round(l2s(atlas) * 255).astype(np.uint8)          # rows bottom-up (Blender image order)

def write_png(path, rgb_top_down):
    """RGB 8-bit PNG with per-row adaptive Sub/Up/Paeth filtering (smaller than unfiltered for the baked gradients)."""
    h, w, _ = rgb_top_down.shape; a = rgb_top_down.astype(np.int16); out = bytearray(); prev = np.zeros_like(a[0])
    for y in range(h):
        row = a[y]; left = np.vstack([np.zeros((1, 3), np.int16), row[:-1]]); upleft = np.vstack([np.zeros((1, 3), np.int16), prev[:-1]])
        pp = left + prev - upleft; pa = np.abs(pp - left); pb = np.abs(pp - prev); pc = np.abs(pp - upleft)
        paeth = np.where((pa <= pb) & (pa <= pc), left, np.where(pb <= pc, prev, upleft))
        cands = [(0, row), (1, row - left), (2, row - prev), (4, row - paeth)]
        best = min(cands, key=lambda c: int(np.abs(((c[1] + 128) % 256) - 128).sum()))
        out.append(best[0]); out += (best[1] % 256).astype(np.uint8).tobytes(); prev = row
    def chunk(name, data): return struct.pack('>I', len(data)) + name + data + struct.pack('>I', zlib.crc32(name + data) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(bytes(out), 9)) + chunk(b'IEND', b'')
    Path(path).write_bytes(png)
write_png(ROOT / 'pigment.png', srgb[::-1])
np.save(ROOT / 'source' / 'bake-ao.npy', np.round(np.clip(ao[..., 0], 0, 1) * 255).astype(np.uint8))

image = bpy.data.images.load(str(ROOT / 'pigment.png'), check_existing=False); image.name = 'putty-grunt original baked clay 1024 atlas'; image.pack()
for m in MATS: next(nd for nd in m.node_tree.nodes if nd.type == 'TEX_IMAGE').image = image
LB.data.materials.clear(); LB.data.materials.append(MATS[0])
bpy.data.materials.remove(bmat)

# ---- scene identity ----
sc['candidate_status'] = "WO111 putty-grunt v001 · Awaiting Tom's review · used in the family release"
sc['source_reference'] = 'Blender reference sheet, no generated concept'
sc['source_sheet_sha256'] = hashlib.sha256((ROOT / 'reference-sheet.png').read_bytes()).hexdigest()
sc['source_blockout_sha256'] = hashlib.sha256((ROOT / 'putty-grunt-blockout.blend').read_bytes()).hexdigest()
sc['orientation'] = 'Blender +Z up/+Y forward; glTF +Y up/-Z forward; stationary identity floor root; character right = +X'

layout = {'head_centre': list(HEAD_C), 'arms': {s: {k: list(v) for k, v in zip(('shoulder', 'elbow', 'wrist', 'fist', 'd1', 'd2'), ARMS[s])} for s in ARMS},
          'legs': {s: {k: (list(v) if isinstance(v, Vector) else v) for k, v in zip(('hip', 'knee', 'ankle', 'foot_centre', 'yaw', 'fwd', 'side'), LEGS[s])} for s in LEGS},
          'eyes': {s: {'centre': list(c), 'forward': list(f), 'size': list(z)} for s, (c, f, z) in EYES.items()},
          'antenna': {'base': list(ANT['base']), 'ball': list(ANT['ball']), 'path': [list(p) for p in ANT['path']]},
          'tongue': {'root': list(TONGUE_ROOT), 'tip': list(TONGUE_TIP)}, 'buckle': list(BUCKLE),
          'belt_front': list(BELT_PATH[24]), 'belt_back': list(BELT_PATH[72]),
          'prints': [{'tag': t, 'centre': list(p), 'normal': list(n), 'radius': r} for t, p, n, r, s_, tu in PRINT_LIST]}
(ROOT / 'source' / 'layout.json').write_text(json.dumps(layout, indent=1) + '\n')

def all_tris(obs): return sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in obs)
part_tris = {o.name: all_tris([o]) for o, _ in PARTS}
summary = {'high_tris': high_tris, 'uniform_start_tris': uniform_tris, 'body_tris': body_tris, 'parts_tris': sum(part_tris.values()), 'total_tris': body_tris + sum(part_tris.values()),
           'bake_seconds': bake_s, 'uv_islands': len(island_scales), 'face_island_faces': len(face_faces), 'biased_islands': sum(1 for k in island_scales if k != 1.0), 'body_atlas_coverage': round(body_coverage, 3), 'pigment_bytes': (ROOT / 'pigment.png').stat().st_size,
           'build_seconds': round((datetime.datetime.now() - t_build).total_seconds(), 1)}

if STAGE == 'geometry':
    # static textured checkpoint for look.mjs review (no rig)
    bpy.ops.object.select_all(action='DESELECT')
    lows = [LB] + [o for o, _ in PARTS]
    for o in lows: o.select_set(True)
    bpy.context.view_layer.objects.active = LB
    bpy.ops.export_scene.gltf(filepath=str(ROOT / 'putty-grunt-static-review.glb'), export_format='GLB', use_selection=True, export_animations=False, export_yup=True,
                              export_apply=False, export_texcoords=True, export_normals=True, export_materials='EXPORT', export_cameras=False, export_lights=False, export_extras=False)
    pts = [o.matrix_world @ v.co for o in lows for v in o.data.vertices]
    summary['bounds'] = [[round(min(p[k] for p in pts), 4) for k in range(3)], [round(max(p[k] for p in pts), 4) for k in range(3)]]
    summary['part_tris'] = part_tris
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'putty-grunt-geometry-checkpoint.blend'), compress=True)
    print(json.dumps(summary))
else:
    # ================= Rig: bind layout =================
    def up(p, h=0.05): return (tuple(p), tuple(Vector(p) + V(0, 0, h)))
    S_R, E_R, W_R, C_R, d1_R, d2_R = ARMS['R']; S_L, E_L, W_L, C_L, d1_L, d2_L = ARMS['L']
    amid = apath[len(apath) // 2]
    REST = {'root': ((0, 0, 0), (0, 0, 0.12), None, False),
            'hips': ((0, 0, 0.50), (0, 0, 0.62), 'root', True),
            'spine': ((0, 0, 0.62), (0, 0, 0.78), 'hips', True),
            'belly': ((0.022, 0.09, 0.60), (0.022, 0.20, 0.60), 'spine', True),
            'chest': ((0, 0, 0.78), (0, 0, 0.93), 'spine', True),
            'head': ((HEAD_C.x, 0, 0.93), (HEAD_C.x, 0, 1.28), 'chest', True),
            'antenna_root': (*up(ANT['base'], 0.03), 'head', True),
            'antenna_1': (tuple(ANT['base']), tuple(amid), 'antenna_root', True),
            'antenna_2': (tuple(amid), tuple(ANT['ball'] + (ANT['ball'] - amid).normalized() * 0.02), 'antenna_1', True),
            'eye_R': (*up(EYES['R'][0]), 'head', True), 'eye_L': (*up(EYES['L'][0]), 'head', True),
            'tongue': (tuple(TONGUE_ROOT), tuple(TONGUE_TIP), 'head', True),
            'belt': ((0, 0, 0.47), (0, 0, 0.55), 'hips', True)}
    for s, sx in (('R', 1), ('L', -1)):
        S, E, W, C, d1, d2 = ARMS[s]; hip, knee, ankle, fc, yaw, fwd, side = LEGS[s]
        REST['shoulder_' + s] = ((0.07 * sx, -0.012, 0.85), tuple(S), 'chest', True)
        REST['upper_arm_' + s] = (tuple(S), tuple(E), 'shoulder_' + s, True)
        REST['forearm_' + s] = (tuple(E), tuple(W), 'upper_arm_' + s, True)
        REST['fist_' + s] = (tuple(W), tuple(W + d2 * 0.13), 'forearm_' + s, True)
        REST['thigh_' + s] = (tuple(hip), tuple(knee), 'root', True)     # legs hang from the root so hips squash never rescales them (world-space leg IK)
        REST['shin_' + s] = (tuple(knee), tuple(ankle), 'thigh_' + s, True)
        REST['foot_' + s] = (tuple(ankle), tuple(V(ankle.x, ankle.y, 0.035) + fwd * 0.17), 'shin_' + s, True)
    HEAT = {n for n in REST if n not in ('root', 'belly', 'antenna_root', 'antenna_1', 'antenna_2', 'eye_R', 'eye_L', 'tongue', 'belt')}
    adata = bpy.data.armatures.new('Original putty grunt rig'); arm = bpy.data.objects.new('Putty_Grunt_Rig', adata); sc.collection.objects.link(arm)
    bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    for name, (h, t, parent, deform) in REST.items():
        b = adata.edit_bones.new(name); b.head = h; b.tail = t; b.roll = 0.0
        if parent: b.parent = adata.edit_bones[parent]; b.use_connect = False
        b.use_deform = name in HEAT            # bone heat only for the clay-body bones
    # clay forearm and fist share one axis frame so the attack stretch counter-scales exactly
    for s in 'RL': adata.edit_bones['fist_' + s].roll = adata.edit_bones['forearm_' + s].roll
    bpy.ops.object.mode_set(mode='OBJECT')
    # ---- bone-heat weights on the clay body ----
    bpy.ops.object.select_all(action='DESELECT'); LB.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    heat_groups = sorted(g.name for g in LB.vertex_groups)
    for b in adata.bones: b.use_deform = b.name != 'root'
    for md in list(LB.modifiers): LB.modifiers.remove(md)
    mw = LB.matrix_world.copy(); LB.parent = None; LB.matrix_world = mw
    me = LB.data; gidx = {g.index: g.name for g in LB.vertex_groups}
    def seg_dist(p, a, b):
        a = Vector(a); b = Vector(b); d = b - a; t = max(0.0, min(1.0, (p - a).dot(d) / d.length_squared)); return (p - (a + d * t)).length
    weights = []
    unweighted = 0
    for v in me.vertices:
        w = {gidx[g.group]: g.weight for g in v.groups if g.weight > 1e-4}
        if not w:
            unweighted += 1; best = min(HEAT, key=lambda n: seg_dist(v.co, REST[n][0], REST[n][1])); w = {best: 1.0}
        weights.append(w)
    # pot-belly squash bone: soft ellipsoidal region at the front of the belly (kept above the belt line)
    BC = V(0.022, 0.10, 0.62); BR = V(0.19, 0.16, 0.14)
    belly_verts = 0
    for v, w in zip(me.vertices, weights):
        d = v.co - BC; q = (d.x / BR.x) ** 2 + (d.y / BR.y) ** 2 + (d.z / BR.z) ** 2
        if v.co.y > 0.0 and q < 1 and not any(k.startswith(('upper_arm', 'forearm', 'fist', 'thigh', 'shin', 'foot', 'head')) and x > 0.3 for k, x in w.items()):
            wb = 0.85 * smoothstep(1 - q) * smoothstep((v.co.y - 0.0) / 0.08) * smoothstep((v.co.z - 0.5) / 0.05)
            if wb > 1e-3:
                for k in w: w[k] *= (1 - wb)
                w['belly'] = wb; belly_verts += 1
    for g in list(LB.vertex_groups): LB.vertex_groups.remove(g)
    def assign(ob, wfun):
        groups = {}
        for v in ob.data.vertices:
            w = wfun(v) if callable(wfun) else dict(wfun)
            w = dict(sorted(((k, x) for k, x in w.items() if x > 1e-4), key=lambda kv: -kv[1])[:4]); tot = sum(w.values())
            assert tot > 0, (ob.name, v.index)
            for k, x in w.items():
                if k not in groups: groups[k] = ob.vertex_groups.new(name=k)
                groups[k].add([v.index], x / tot, 'REPLACE')
    assign(LB, lambda v: weights[v.index])
    for ob, bw in PARTS:
        assign(ob, (lambda v, f=bw: f(v.co)) if callable(bw) else bw)
    # ---- one skin ----
    inventory = [{'name': o.name, 'triangles': all_tris([o]), 'atlas_tile': o.get('atlas_tile', 'baked clay body'), 'bone_groups': sorted(g.name for g in o.vertex_groups)} for o in [LB] + [o for o, _ in PARTS]]
    bpy.ops.object.select_all(action='DESELECT')
    lows = [LB] + [o for o, _ in PARTS]
    for o in lows: o.select_set(True)
    bpy.context.view_layer.objects.active = LB
    bpy.ops.object.join(); skin = bpy.context.object; skin.name = 'Putty_Grunt_Skin'; skin.data.name = 'Putty grunt skin'
    for k in ('atlas_tile', 'bone_weights'):
        if k in skin: del skin[k]
    assert len(skin.data.uv_layers) == 1, [u.name for u in skin.data.uv_layers]
    bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
    mod = skin.modifiers.new('Putty grunt armature', 'ARMATURE'); mod.object = arm; skin.parent = arm
    missing = sorted({g.name for g in skin.vertex_groups} - set(REST)); assert not missing, missing
    maxinf = max(sum(1 for g in v.groups if g.weight > 1e-6) for v in skin.data.vertices)
    tris = all_tris([skin]); pts = [v.co for v in skin.data.vertices]
    lo = [min(p[k] for p in pts) for k in range(3)]; hi = [max(p[k] for p in pts) for k in range(3)]
    arm['asset_id'] = 'putty-grunt'; arm['version'] = 'v001'; arm['forward'] = 'Blender +Y / glTF -Z'; arm['neutral_total_height_m'] = round(hi[2], 4); arm['attack_contact_fraction'] = 0.625
    record = {'asset_id': 'putty-grunt', 'version': 'v001', 'work_order': 'WO111',
              'authoring_model': 'claude-opus-5-5 xhigh (Claude Code subagent; Tom ruled Sept 26 that Claude Opus 5.5 does the WO111 Blender work)',
              'blender_version': bpy.app.version_string, 'blender_instance': 'blender-authoring-2',
              'source_reference': 'Blender reference sheet, no generated concept', 'source_sheet_sha256': sc['source_sheet_sha256'], 'source_blockout_sha256': sc['source_blockout_sha256'],
              'rest_bounds_blender_z_up': {'min': lo, 'max': hi}, 'height_m': hi[2], 'triangles': tris, 'vertices': len(skin.data.vertices),
              'material_count': len(skin.data.materials), 'bone_count': len(adata.bones), 'max_influences': maxinf,
              'high_resolution_bake_source_triangles': high_tris, 'body_triangles': body_tris, 'metaball_resolution_m': MB_RES,
              'bone_heat_groups': heat_groups, 'bone_heat_fallback_vertices': unweighted, 'belly_weighted_vertices': belly_verts,
              'texture': {'file': 'pigment.png', 'width': 1024, 'height': 1024, 'bytes': (ROOT / 'pigment.png').stat().st_size,
                          'origin': 'Original atlas baked in Blender (Cycles CPU) from this procedural clay: EMIT colour from the high-resolution clay and painted decals at 2048 px, box-filtered to 1024, times soft occlusion baked from the low-poly character (strength %.2f, distance %.2f m); flat painted tiles for the parts. No external textures, photos or generated images.' % (AO_STRENGTH, world.light_settings.distance),
                          'palette': PAL, 'layout': {'body_square_px': int(BODY_SPAN * 1024), 'tile_px': int(TILE * 1024), 'tiles': {k: [round(u * 1024), round(v * 1024)] for k, (u, v) in TILES.items()}}},
              'summary': summary, 'parts': inventory}
    (ROOT / 'construction.json').write_text(json.dumps(record, indent=2) + '\n')
    rest_json = {k: [list(map(float, h)), list(map(float, t)), p] for k, (h, t, p, d) in REST.items()}
    (ROOT / 'source' / 'rig-rest.json').write_text(json.dumps({'rest': rest_json, 'layout': layout}, indent=1) + '\n')
    HIGH.hide_render = True; HIGH.hide_viewport = True
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'putty-grunt-construction.blend'), compress=True)
    bpy.ops.object.select_all(action='DESELECT'); skin.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(filepath=str(ROOT / 'putty-grunt-checkpoint.glb'), export_format='GLB', use_selection=True, export_animations=False, export_skins=True, export_yup=True,
                              export_apply=False, export_armature_object_remove=True, export_texcoords=True, export_normals=True, export_materials='EXPORT',
                              export_cameras=False, export_lights=False, export_extras=True)
    print(json.dumps({'triangles': tris, 'vertices': len(skin.data.vertices), 'height_m': hi[2], 'bounds': [lo, hi], 'bones': len(adata.bones), 'max_influences': maxinf,
                      'heat_groups': heat_groups, 'fallback': unweighted, 'belly': belly_verts, 'summary': summary}))
