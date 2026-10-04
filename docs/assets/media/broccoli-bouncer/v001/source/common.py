"""Action minions B v001: shared original primitives, flat vertex-colour materials, rigid-part skinning,
an all-+Z bone convention and a 60 fps procedural clip baker.

Blender +Z up, character front +Y (glTF -Z, the enemy adapter's facing), character right = +X.
Every surface is modelled geometry coloured by a per-part flat vertex colour; no image textures.
Written fresh for this pack; the transport and export settings follow the WO111 demon-band-idol /
rooftop-city-kit precedents.
"""
import bpy, bmesh, math, json, hashlib, datetime
from pathlib import Path
from mathutils import Vector, Matrix, Euler, Quaternion

REMOTE = Path('/workspace/haynes-quest/action-worlds/minions-b/v001')
FPS = 60
BONE_LEN = 0.06
PARTS = []
PAL = {}
COLL = None
MATS = []

# ---------------------------------------------------------------- colour + scene

def lin(hexs):
    rgb = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb) + (1.0,)

def reset(collection, palette):
    """Empty the open scene (the claim/previous checkpoints are already saved) and start one collection."""
    global COLL
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    for c in list(bpy.data.collections): bpy.data.collections.remove(c)
    for blocks in (bpy.data.meshes, bpy.data.armatures, bpy.data.materials, bpy.data.actions, bpy.data.images,
                   bpy.data.textures, bpy.data.curves, bpy.data.cameras, bpy.data.lights, bpy.data.node_groups,
                   bpy.data.texts, bpy.data.worlds):
        for b in list(blocks): blocks.remove(b)
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
    PARTS.clear(); PAL.clear(); PAL.update(palette); MATS.clear()
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'; sc.unit_settings.scale_length = 1
    sc.render.fps = FPS; sc.render.fps_base = 1
    COLL = bpy.data.collections.new(collection); sc.collection.children.link(COLL)
    return COLL

def materials(asset, matte=.62, gloss=.26):
    """Exactly two shared materials per asset; both read the per-part flat colour attribute 'Col'."""
    for label, rough in (('matte', matte), ('gloss', gloss)):
        m = bpy.data.materials.new('%s %s' % (asset, label)); m.use_nodes = True
        nt = m.node_tree; bs = nt.nodes['Principled BSDF']
        vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'; vc.location = (-300, 200)
        nt.links.new(vc.outputs['Color'], bs.inputs['Base Color'])
        bs.inputs['Roughness'].default_value = rough; bs.inputs['Metallic'].default_value = 0
        m.diffuse_color = (.8, .8, .8, 1)
        MATS.append(m)
    return MATS

# ---------------------------------------------------------------- transforms

def TRS(loc=(0, 0, 0), rot=(0, 0, 0), scale=1.0):
    """rot = degrees about world X, then Y, then Z."""
    s = scale if isinstance(scale, (tuple, list, Vector)) else (scale, scale, scale)
    S = Matrix.Diagonal(Vector((s[0], s[1], s[2], 1)))
    R = Euler([math.radians(a) for a in rot], 'XYZ').to_matrix().to_4x4()
    return Matrix.Translation(Vector(loc)) @ R @ S

def frame_from(direction, up=(0, 0, 1)):
    """Rotation whose local +Y is `direction` and local +X is perpendicular, closest to `up` x direction."""
    d = Vector(direction).normalized(); u = Vector(up)
    x = d.cross(u)
    if x.length < 1e-6: x = d.cross(Vector((1, 0, 0)))
    x.normalize(); z = x.cross(d).normalized()
    return Matrix((x, d, z)).transposed().to_4x4()

# ---------------------------------------------------------------- part registration

def finish(bm, name, color, bone, gloss=False, smooth=True, M=None):
    if M is not None: bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    rgba = lin(PAL[color]) if isinstance(color, str) else tuple(color)
    col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    col.data.foreach_set('color', list(rgba) * len(me.vertices))
    for p in me.polygons: p.use_smooth = smooth
    ob = bpy.data.objects.new(name, me); COLL.objects.link(ob)
    ob['part_bone'] = bone; ob['part_color'] = color if isinstance(color, str) else 'custom'; ob['part_gloss'] = bool(gloss)
    PARTS.append(ob)
    return ob

def deform(bm, fn):
    for v in bm.verts: v.co = Vector(fn(v.co.copy()))

# ---------------------------------------------------------------- primitives (each returns the part object)

def ellipsoid(name, c, r, color, bone, seg=18, rings=12, rot=(0, 0, 0), gloss=False, fn=None, smooth=True):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    rr = r if isinstance(r, (tuple, list)) else (r, r, r)
    for v in bm.verts: v.co = Vector((v.co.x * rr[0], v.co.y * rr[1], v.co.z * rr[2]))
    if fn: deform(bm, fn)
    return finish(bm, name, color, bone, gloss, smooth, TRS(c, rot))

def icoblob(name, c, r, color, bone, subdiv=2, rot=(0, 0, 0), gloss=False, fn=None, smooth=True):
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    rr = r if isinstance(r, (tuple, list)) else (r, r, r)
    for v in bm.verts: v.co = Vector((v.co.x * rr[0], v.co.y * rr[1], v.co.z * rr[2]))
    if fn: deform(bm, fn)
    return finish(bm, name, color, bone, gloss, smooth, TRS(c, rot))

def rbox(name, c, size, color, bone, bevel=.02, seg=3, rot=(0, 0, 0), gloss=False, fn=None, smooth=True):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=seg, profile=.5, affect='EDGES', clamp_overlap=True)
    if fn: deform(bm, fn)
    return finish(bm, name, color, bone, gloss, smooth, TRS(c, rot))

def lathe(name, prof, color, bone, seg=24, M=None, mod=None, gloss=False, smooth=True):
    """prof: [(radius, z), ...] bottom to top; radius 0 makes a pole. mod(theta, z) scales a ring point's radius."""
    bm = bmesh.new(); rings = []
    for r, z in prof:
        if r <= 1e-7:
            rings.append([bm.verts.new((0, 0, z))])
        else:
            ring = []
            for i in range(seg):
                t = math.tau * i / seg; rr = r * (mod(t, z) if mod else 1.0)
                ring.append(bm.verts.new((rr * math.cos(t), rr * math.sin(t), z)))
            rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        if len(a) == 1 and len(b) == 1: continue
        for i in range(seg):
            j = (i + 1) % seg
            if len(a) == 1: bm.faces.new((a[0], b[j], b[i]))
            elif len(b) == 1: bm.faces.new((a[i], a[j], b[0]))
            else: bm.faces.new((a[i], a[j], b[j], b[i]))
    if len(rings[0]) > 1: bm.faces.new(list(reversed(rings[0])))
    if len(rings[-1]) > 1: bm.faces.new(rings[-1])
    return finish(bm, name, color, bone, gloss, smooth, M if M is not None else Matrix.Identity(4))

def _catmull(pts, n):
    P = [Vector(p) for p in pts]
    if len(P) == 2:
        return [P[0].lerp(P[1], i / (n - 1)) for i in range(n)], [i / (n - 1) for i in range(n)]
    ext = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    out, par = [], []
    segs = len(P) - 1
    for i in range(n):
        u = i / (n - 1) * segs; k = min(int(u), segs - 1); t = u - k
        p0, p1, p2, p3 = ext[k], ext[k + 1], ext[k + 2], ext[k + 3]
        out.append(.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
        par.append(u / segs)
    return out, par

def tube(name, pts, radii, color, bone, seg=12, n=None, up=(0, 0, 1), gloss=False, smooth=True, caps=True, twist=0.0):
    """Sweep along a Catmull-Rom path. radii: one value per control point, each a number or (rx, ry);
    rx lies along the frame normal seeded from `up`, ry along the binormal. A zero radius closes to a pole."""
    n = n or max(6, 4 * (len(pts) - 1) + 2)
    P, par = _catmull(pts, n)
    rad = [r if isinstance(r, (tuple, list)) else (r, r) for r in radii]
    def R(u):
        x = u * (len(rad) - 1); k = min(int(x), len(rad) - 2); t = x - k
        t = t * t * (3 - 2 * t)
        return (rad[k][0] * (1 - t) + rad[k + 1][0] * t, rad[k][1] * (1 - t) + rad[k + 1][1] * t)
    T = []
    for i in range(n):
        a = P[max(0, i - 1)]; b = P[min(n - 1, i + 1)]; T.append((b - a).normalized())
    N0 = Vector(up) - T[0] * T[0].dot(Vector(up))
    if N0.length < 1e-6: N0 = Vector((1, 0, 0)) - T[0] * T[0].x
    N = [N0.normalized()]
    for i in range(1, n):
        v = N[-1] - T[i] * T[i].dot(N[-1])
        N.append(v.normalized() if v.length > 1e-8 else N[-1])
    bm = bmesh.new(); rings = []
    for i in range(n):
        rx, ry = R(par[i])
        if rx <= 1e-7 and ry <= 1e-7:
            rings.append([bm.verts.new(P[i])]); continue
        Bn = T[i].cross(N[i]).normalized(); ring = []
        tw = twist * par[i]
        for k in range(seg):
            a = math.tau * k / seg + tw
            ring.append(bm.verts.new(P[i] + N[i] * (rx * math.cos(a)) + Bn * (ry * math.sin(a))))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        if len(a) == 1 and len(b) == 1: continue
        for k in range(seg):
            j = (k + 1) % seg
            if len(a) == 1: bm.faces.new((a[0], b[j], b[k]))
            elif len(b) == 1: bm.faces.new((a[k], a[j], b[0]))
            else: bm.faces.new((a[k], a[j], b[j], b[k]))
    if caps:
        if len(rings[0]) > 1: bm.faces.new(list(reversed(rings[0])))
        if len(rings[-1]) > 1: bm.faces.new(rings[-1])
    return finish(bm, name, color, bone, gloss, smooth)

def torus(name, c, R, r, color, bone, seg=28, rseg=8, rot=(0, 0, 0), gloss=False, smooth=True, ry=None):
    bm = bmesh.new(); rings = []
    ry = r if ry is None else ry
    for i in range(seg):
        a = math.tau * i / seg; ca, sa = math.cos(a), math.sin(a); ring = []
        for k in range(rseg):
            b = math.tau * k / rseg
            rr = R + r * math.cos(b)
            ring.append(bm.verts.new((rr * ca, rr * sa, ry * math.sin(b))))
        rings.append(ring)
    for i in range(seg):
        a, b = rings[i], rings[(i + 1) % seg]
        for k in range(rseg):
            j = (k + 1) % rseg; bm.faces.new((a[k], b[k], b[j], a[j]))
    return finish(bm, name, color, bone, gloss, smooth, TRS(c, rot))

def star(name, c, r_out, r_in, depth, color, bone, rot=(0, 0, 0), gloss=False, points=5):
    """A thick star prism lying in local XZ (facing local +Y before `rot`)."""
    bm = bmesh.new(); front, back = [], []
    for i in range(points * 2):
        a = math.pi / 2 + math.pi * i / points; r = r_out if i % 2 == 0 else r_in
        x, z = r * math.cos(a), r * math.sin(a)
        front.append(bm.verts.new((x, depth / 2, z))); back.append(bm.verts.new((x, -depth / 2, z)))
    cf = bm.verts.new((0, depth / 2 + depth * .35, 0)); cb = bm.verts.new((0, -depth / 2, 0))
    m = len(front)
    for i in range(m):
        j = (i + 1) % m
        bm.faces.new((front[i], front[j], cf)); bm.faces.new((back[j], back[i], cb))
        bm.faces.new((front[j], front[i], back[i], back[j]))
    return finish(bm, name, color, bone, gloss, False, TRS(c, rot))

def leaf(name, base, direction, width_dir, length, width, thick, color, bone, curl=0.0, droop=0.0, n=9, seg=10, gloss=False, tip=.12, fullness=.85):
    """A pointed leaf: a flattened sweep whose half-width follows a smooth leaf outline. `curl` cups it across
    (radians of lift at the rims), `droop` bends the midrib down along the length (radians at the tip)."""
    d = Vector(direction).normalized(); w = Vector(width_dir); w = (w - d * d.dot(w)).normalized(); nrm = d.cross(w)
    pts, radii = [], []
    for i in range(n):
        u = i / (n - 1)
        if abs(droop) > 1e-5:
            radius = length / droop
            p = Vector(base) + d * (radius * math.sin(droop * u)) - nrm * (radius * (1 - math.cos(droop * u)))
        else:
            p = Vector(base) + d * (length * u)
        pts.append(p)
        hw = width * (math.sin(math.pi * min(1.0, u ** fullness)) ** .8) if 0 < u < 1 else 0.0
        if u > 1 - tip: hw *= (1 - u) / tip
        radii.append((max(hw, 0.0), max(thick * (hw / max(width, 1e-6)) ** .6, 0.0) if hw > 0 else 0.0))
    radii[0] = (width * .12, thick * .5)
    ob = tube(name, pts, radii, color, bone, seg=seg, n=n * 2, up=w, gloss=gloss)
    if abs(curl) > 1e-6:
        # cup: lift rim vertices along the normal in proportion to their distance from the midrib
        me = ob.data; ctr = Vector(base)
        for v in me.vertices:
            off = v.co - ctr; across = off.dot(w)
            v.co = v.co + nrm * (curl * across * across / max(width, 1e-6))
    return ob

# ---------------------------------------------------------------- rig

# All bones point +Z in rest with zero roll, so every bone's local frame is X=world X, Y=world Z, Z=world -Y.
BASIS = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))  # columns are local axes in armature space

def armature(name, bones):
    """bones: [(name, head_xyz, parent_or_None), ...] in parent-before-child order."""
    data = bpy.data.armatures.new(name); ob = bpy.data.objects.new(name, data); COLL.objects.link(ob)
    data.display_type = 'STICK'
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for n, h, p in bones:
        eb = data.edit_bones.new(n); eb.head = Vector(h); eb.tail = Vector(h) + Vector((0, 0, BONE_LEN)); eb.roll = 0
        if p: eb.parent = data.edit_bones[p]; eb.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    for b in data.bones:
        err = max(abs(b.matrix_local.to_3x3()[i][j] - BASIS[i][j]) for i in range(3) for j in range(3))
        assert err < 1e-5, ('unexpected bone basis', b.name, err)
    for pb in ob.pose.bones: pb.rotation_mode = 'QUATERNION'
    return ob

def skin(asset, title, arm):
    """Join every registered part into one mesh with two material slots and rigid per-part bone weights."""
    assert len(MATS) == 2
    for ob in PARTS:
        me = ob.data; me.materials.clear(); me.materials.append(MATS[0]); me.materials.append(MATS[1])
        idx = 1 if ob['part_gloss'] else 0
        for p in me.polygons: p.material_index = idx
        bone = ob['part_bone']; assert bone in arm.data.bones, ('part bound to a missing bone', ob.name, bone)
        vg = ob.vertex_groups.new(name=bone); vg.add(list(range(len(me.vertices))), 1.0, 'REPLACE')
        mid = ob.data.attributes.new('part_id', 'INT', 'POINT')
        mid.data.foreach_set('value', [PARTS.index(ob)] * len(me.vertices))
    parts_record = [{'index': i, 'name': ob.name, 'bone': ob['part_bone'], 'colour': ob['part_color'], 'gloss': ob['part_gloss'],
                     'vertices': len(ob.data.vertices), 'triangles': sum(len(p.vertices) - 2 for p in ob.data.polygons)} for i, ob in enumerate(PARTS)]
    bpy.ops.object.select_all(action='DESELECT')
    for ob in PARTS: ob.select_set(True)
    bpy.context.view_layer.objects.active = PARTS[0]
    bpy.ops.object.join()
    sk = bpy.context.view_layer.objects.active; sk.name = title + '_Skin'; sk.data.name = title + '_Skin'
    for k in ('part_bone', 'part_color', 'part_gloss'):
        if k in sk: del sk[k]
    sk.parent = arm; sk.matrix_parent_inverse = Matrix.Identity(4)
    mod = sk.modifiers.new('Armature', 'ARMATURE'); mod.object = arm
    return sk, parts_record

def basis_for(spec):
    """spec: {'r': (deg about world X, Y, Z), 't': (dx, dy, dz), 's': float or (sx, sy, sz)} in the bone's rest frame."""
    r = spec.get('r', (0, 0, 0)); t = spec.get('t', (0, 0, 0)); s = spec.get('s', 1.0)
    Rw = Euler([math.radians(a) for a in r], 'XYZ').to_matrix()
    Rl = BASIS.transposed() @ Rw @ BASIS
    tl = BASIS.transposed() @ Vector(t)
    sw = s if isinstance(s, (tuple, list)) else (s, s, s)
    sl = Vector((sw[0], sw[2], sw[1]))
    return tl, Rl.to_quaternion(), sl

def bake(arm, clips, scaled=()):
    """clips: [(name, duration_s, loop, pose_fn(t) -> {bone: spec})]. One NLA track per clip, sampled every 60 fps frame."""
    sc = bpy.context.scene; sc.render.fps = FPS
    arm.animation_data_clear(); arm.animation_data_create()
    for a in list(bpy.data.actions): bpy.data.actions.remove(a)
    records = []
    for name, duration, loop, fn in clips:
        end = round(duration * FPS); assert abs(end / FPS - duration) < 1e-9, (name, duration)
        action = bpy.data.actions.new(name); arm.animation_data.action = action; prev = {}
        for f in range(end + 1):
            pose = fn(f / FPS)
            for pb in arm.pose.bones:
                if pb.name == 'root': continue
                tl, q, sl = basis_for(pose.get(pb.name, {}))
                if pb.name in prev and prev[pb.name].dot(q) < 0: q.negate()
                prev[pb.name] = q.copy()
                pb.location = tl; pb.rotation_quaternion = q; pb.scale = sl
                pb.keyframe_insert('location', frame=f, group=pb.name)
                pb.keyframe_insert('rotation_quaternion', frame=f, group=pb.name)
                if pb.name in scaled: pb.keyframe_insert('scale', frame=f, group=pb.name)
        for fc in action.fcurves:
            for k in fc.keyframe_points: k.interpolation = 'LINEAR'
        track = arm.animation_data.nla_tracks.new(); track.name = name
        strip = track.strips.new(name, 0, action); strip.action_frame_start = 0; strip.action_frame_end = end; track.mute = True
        records.append({'name': name, 'duration_s': duration, 'loop': loop, 'clamp_when_finished': not loop, 'frames': end + 1, 'fps': FPS})
    arm.animation_data.action = None
    for pb in arm.pose.bones: pb.matrix_basis = Matrix.Identity(4)
    sc.frame_set(0); bpy.context.view_layer.update()
    return records

def sample_bounds(arm, sk, step=2):
    """All evaluated skin vertices for rest + every frame of every clip -> glTF (y-up) min/max and per-clip floor."""
    import numpy as np
    sc = bpy.context.scene; dg = bpy.context.evaluated_depsgraph_get()
    def verts():
        dg.update(); ev = sk.evaluated_get(dg); me = ev.to_mesh()
        a = np.empty(len(me.vertices) * 3, dtype=np.float64); me.vertices.foreach_get('co', a); ev.to_mesh_clear()
        a = a.reshape(-1, 3); M = np.array(sk.matrix_world); a = a @ M[:3, :3].T + M[:3, 3]
        return np.stack([a[:, 0], a[:, 2], -a[:, 1]], axis=1)
    arm.animation_data.action = None
    for t in arm.animation_data.nla_tracks: t.mute = True
    sc.frame_set(0); rest = verts(); lo = rest.min(0); hi = rest.max(0)
    per = {}
    for track in arm.animation_data.nla_tracks:
        action = track.strips[0].action; arm.animation_data.action = action
        end = int(track.strips[0].action_frame_end); clo = np.full(3, np.inf); chi = np.full(3, -np.inf)
        for f in list(range(0, end + 1, step)) + [end]:
            sc.frame_set(f); v = verts(); clo = np.minimum(clo, v.min(0)); chi = np.maximum(chi, v.max(0))
        per[track.name] = {'min': clo.tolist(), 'max': chi.tolist()}; lo = np.minimum(lo, clo); hi = np.maximum(hi, chi)
    arm.animation_data.action = None
    for pb in arm.pose.bones: pb.matrix_basis = Matrix.Identity(4)
    sc.frame_set(0); bpy.context.view_layer.update()
    return {'rest': {'min': rest.min(0).tolist(), 'max': rest.max(0).tolist()}, 'clips': per, 'all': {'min': lo.tolist(), 'max': hi.tolist()},
            'envelope': {'min': [math.floor((x - .005) * 1000) / 1000 for x in lo], 'max': [math.ceil((x + .005) * 1000) / 1000 for x in hi]}}

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def export_glb(arm, sk, path):
    bpy.ops.object.select_all(action='DESELECT'); sk.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, export_yup=True,
        export_animations=True, export_animation_mode='NLA_TRACKS', export_optimize_animation_size=False,
        export_skins=True, export_def_bones=False, export_armature_object_remove=True, export_all_influences=False,
        export_influence_nb=4, export_apply=False, export_texcoords=False, export_normals=True, export_tangents=False,
        export_materials='EXPORT', export_vertex_color='MATERIAL', export_all_vertex_colors=False,
        export_cameras=False, export_lights=False, export_extras=True, export_attributes=False)

def store_sources(prefix, names):
    for name in names:
        old = bpy.data.texts.get(prefix + name)
        if old: bpy.data.texts.remove(old)
        t = bpy.data.texts.new(prefix + name); t.write((REMOTE / 'source' / name).read_text())

def lease_ok():
    sc = bpy.context.scene
    assert sc.get('work_order') == '20261004-opus-action-minions-b' and sc.get('scene_lease') == 'active' \
        and sc.get('scene_owner') == 'claude-opus-5-5/action-minions-b', 'lease not held'

def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

# ---------------------------------------------------------------- easing for clip authoring

def smooth(x):
    x = max(0.0, min(1.0, x)); return x * x * (3 - 2 * x)

def ramp(t, a, b):
    """0 before a, 1 after b, smoothstep between."""
    return smooth((t - a) / (b - a)) if b > a else float(t >= b)

def bump(t, a, m, b):
    """0 -> 1 at m -> 0 at b (smooth)."""
    if t <= a or t >= b: return 0.0
    return smooth((t - a) / (m - a)) if t < m else 1 - smooth((t - m) / (b - m))

def lerp(a, b, x):
    if isinstance(a, (tuple, list)): return tuple(lerp(p, q, x) for p, q in zip(a, b))
    return a + (b - a) * x

def wave(t, period, phase=0.0):
    return math.sin(math.tau * (t / period + phase))

def add(*specs):
    """Sum several pose specs for one bone (rotations and translations add, scales multiply)."""
    out = {'r': [0, 0, 0], 't': [0, 0, 0], 's': [1, 1, 1]}
    for s in specs:
        if not s: continue
        for k in range(3):
            out['r'][k] += s.get('r', (0, 0, 0))[k]; out['t'][k] += s.get('t', (0, 0, 0))[k]
            sc = s.get('s', 1.0); sc = sc if isinstance(sc, (tuple, list)) else (sc, sc, sc); out['s'][k] *= sc[k]
    return {'r': tuple(out['r']), 't': tuple(out['t']), 's': tuple(out['s'])}

def mix(a, b, x):
    """Blend two full poses {bone: spec}; missing bones are identity."""
    out = {}
    for bone in set(a) | set(b):
        sa = add(a.get(bone)); sb = add(b.get(bone))
        out[bone] = {'r': lerp(sa['r'], sb['r'], x), 't': lerp(sa['t'], sb['t'], x), 's': lerp(sa['s'], sb['s'], x)}
    return out

def keyed(keys, t):
    """keys: [(time_s, pose)], smoothstep between neighbours; holds the ends."""
    if t <= keys[0][0]: return keys[0][1]
    for (ta, pa), (tb, pb) in zip(keys, keys[1:]):
        if t <= tb: return mix(pa, pb, smooth((t - ta) / (tb - ta)))
    return keys[-1][1]

def merge(*poses):
    """Additively combine whole poses."""
    out = {}
    for bone in set().union(*[set(p) for p in poses]):
        out[bone] = add(*[p.get(bone) for p in poses])
    return out

SCENE_IDENTITY = ('work_order', 'scene_owner', 'scene_lease', 'asset_id', 'asset_version', 'authoring_model', 'candidate_status')

def export_with_identity(arm, sk, path, extras):
    """Export with only asset identity in the glTF scene extras (no lease or addon metadata), then restore."""
    sc = bpy.context.scene
    removed = {k: sc[k] for k in list(sc.keys()) if k in SCENE_IDENTITY or k.startswith('blendermcp_')}
    for k in removed: del sc[k]
    for k, v in extras.items(): sc[k] = v
    try:
        export_glb(arm, sk, path)
    finally:
        for k in extras:
            if k in sc: del sc[k]
        for k, v in removed.items(): sc[k] = v

def save_master(path, asset, status):
    """Save a separate editable master carrying its own asset identity; the live lease props are untouched."""
    sc = bpy.context.scene; keep = {k: sc[k] for k in ('asset_id', 'candidate_status') if k in sc}
    sc['asset_id'] = asset; sc['candidate_status'] = status; sc['pack_id'] = 'action-minions-b'
    assert not Path(path).exists(), ('refusing to overwrite an existing master', str(path))
    bpy.ops.wm.save_as_mainfile(filepath=str(path), compress=True)
    for k, v in keep.items(): sc[k] = v
