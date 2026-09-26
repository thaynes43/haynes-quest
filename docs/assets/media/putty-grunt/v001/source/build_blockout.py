"""WO111 putty-grunt v001: painted flat-colour BLOCKOUT for a Blender reference sheet.

Reference-sheet stage only: metaball clay masses baked to plain meshes, plus sweeps and primitives. No final
topology, no rig, no atlas, no GLB. Blender +Z up, character faces +Y (exports later as glTF +Y up / -Z forward),
floor-centred at the origin. Character right = +X. All dimensions in metres.

Design: World A chapter 3 ordinary-a (ages 5-9, the rooftop hero-city chapter under the inator-monster boss). An
original, goofy clay "putty" foot-soldier parody of the lumpy clay grunts that the era's morphing-hero shows send in
by the dozen, about 1.40 m to the ball of its antenna. One lumpy grey-lavender clay mass: a big neckless head with two
blank round cream eyes of different sizes, a nub nose and a lopsided dopey grin with its pink tongue poking out; a
little pinched clay antenna with a ball on top that leans with its tilted head; a pot-bellied torso wearing a rolled
clay-coil belt with a round honey buckle; short stumpy legs on flat squashed pancake feet; noodly arms ending in
oversized clumsy mitten fists. It stands in a wobbly "hi-yah!" guard: right fist raised in front of its chin, left
fist low and out, knees bent. Thumbprint dents are pressed all over the clay, as if the villain sculpted it in a
hurry; the biggest one sits in the middle of the chest where a hero-show grunt would carry an emblem.
"""
import bpy, bmesh, math, json, hashlib, datetime
from mathutils import Vector, Matrix, Quaternion, Euler
from pathlib import Path

ROOT = Path('/workspace/haynes-quest/family-eras/putty-grunt/v001')
MASTER = 'Putty grunt blockout (master)'

PAL = {
    'clay': '#a39db6', 'dent': '#9690ab', 'ridge': '#6d6687', 'coil': '#5e5775', 'honey': '#dca953',
    'honeydk': '#b98a35', 'eye': '#fbf6ea', 'mouth': '#3b3049', 'tongue': '#e8909f',
}
MB_T = 0.6          # metaball threshold
MB_RES = globals().get('MB_RES', 0.0085)

def lin(h):
    h = h.lstrip('#'); out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)

MATS = {}
def mat(key):
    if key in MATS: return MATS[key]
    m = bpy.data.materials.new('PG ' + key + ' ' + PAL[key]); m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = lin(PAL[key]); bs.inputs['Roughness'].default_value = 0.82
    bs.inputs['Specular IOR Level'].default_value = 0.18
    m.diffuse_color = lin(PAL[key]); m['palette_hex'] = PAL[key]
    MATS[key] = m; return m

PARTS = []
def link(name, data, mats, parent=None, smooth=True):
    ob = bpy.data.objects.new(name, data); bpy.data.collections[MASTER].objects.link(ob)
    for m in (mats if isinstance(mats, (list, tuple)) else [mats]):
        if m is not None: data.materials.append(m if not isinstance(m, str) else mat(m))
    if smooth and hasattr(data, 'polygons'):
        for p in data.polygons: p.use_smooth = True
    if parent is not None: ob.parent = parent
    ob['blockout_part'] = name; PARTS.append(ob); return ob

def empty(name, loc=(0, 0, 0), rot=(0, 0, 0), parent=None):
    ob = bpy.data.objects.new(name, None); bpy.data.collections[MASTER].objects.link(ob)
    ob.location = loc; ob.rotation_euler = rot; ob.empty_display_size = 0.05
    if parent is not None: ob.parent = parent
    return ob

def bevel(ob, w, seg=2):
    md = ob.modifiers.new('Soft painted edge', 'BEVEL'); md.width = w; md.segments = seg; md.limit_method = 'ANGLE'
    return ob

def ellipsoid(name, loc, s, key, rot=(0, 0, 0), parent=None, seg=32, rings=16):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0); bm.to_mesh(me); bm.free()
    ob = link(name, me, mat(key), parent)
    ob.location = loc; ob.scale = s; ob.rotation_euler = rot; return ob

def cyl(name, loc, r1, r2, depth, key, rot=(0, 0, 0), parent=None, seg=40, bev=0.004):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r1, radius2=r2, depth=depth)
    bm.to_mesh(me); bm.free()
    ob = link(name, me, mat(key), parent); ob.location = loc; ob.rotation_euler = rot
    if bev: bevel(ob, bev, 3)
    return ob

def catmull(pts, per=10):
    P = [Vector(p) for p in pts]; P = [P[0] + (P[0] - P[1])] + P + [P[-1] + (P[-1] - P[-2])]; out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for s in range(per):
            t = s / per
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-2]); return out

def orient_out(me, ref_pts_normals=None):
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()

def sweep(name, pts, radii, key, n=24, per=12, up=(0, 0, 1)):
    """Round tube along a Catmull-Rom path with rotation-minimising frames and capped ends."""
    path = catmull(pts, per); m = len(path)
    lens = [0.0]
    for i in range(1, m): lens.append(lens[-1] + (path[i] - path[i - 1]).length)
    total = lens[-1]; verts = []; faces = []
    T = (path[1] - path[0]).normalized(); U = Vector(up); N = (U - U.dot(T) * T)
    if N.length < 1e-3: N = T.cross(Vector((1, 0, 0)))
    N.normalize()
    for i in range(m):
        if i > 0:
            T = (path[min(i + 1, m - 1)] - path[i - 1]).normalized(); N = (N - N.dot(T) * T).normalized()
        B = T.cross(N); u = lens[i] / total
        k = u * (len(radii) - 1); k0 = min(int(k), len(radii) - 2); r = radii[k0] + (radii[k0 + 1] - radii[k0]) * (k - k0)
        for j in range(n):
            ang = math.tau * j / n; verts.append(tuple(path[i] + r * (math.cos(ang) * N + math.sin(ang) * B)))
    for i in range(m - 1):
        for j in range(n):
            faces.append((i * n + j, i * n + (j + 1) % n, (i + 1) * n + (j + 1) % n, (i + 1) * n + j))
    faces.append(tuple(range(n - 1, -1, -1))); faces.append(tuple((m - 1) * n + j for j in range(n)))
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update(); orient_out(me)
    return link(name, me, mat(key)), path

def loop_tube(name, path, radius_fn, key, n=20):
    """Closed round tube (the rolled clay-coil belt); frames keep world +Z so the seam cannot twist."""
    m = len(path); verts = []; faces = []
    for i in range(m):
        T = (path[(i + 1) % m] - path[i - 1]).normalized(); N = Vector((0, 0, 1)); N = (N - N.dot(T) * T).normalized(); B = T.cross(N)
        r = radius_fn(i / m)
        for j in range(n):
            a = math.tau * j / n; verts.append(tuple(path[i] + r * (math.cos(a) * N + math.sin(a) * B)))
    for i in range(m):
        i2 = (i + 1) % m
        for j in range(n):
            faces.append((i * n + j, i * n + (j + 1) % n, i2 * n + (j + 1) % n, i2 * n + j))
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update(); orient_out(me)
    return link(name, me, mat(key))

# --- Metaball clay: a lone element's visible radius is K(s) x its influence radius --------------------------------
def K(s): return math.sqrt(1 - (MB_T / s) ** (1 / 3))

def mball(name):
    mb = bpy.data.metaballs.new(name); mb.resolution = MB_RES; mb.render_resolution = MB_RES; mb.threshold = MB_T
    mb.update_method = 'UPDATE_ALWAYS'
    ob = bpy.data.objects.new(name, mb); bpy.data.collections[MASTER].objects.link(ob); return ob

def mb_ball(ob, c, r, s=2.0):
    e = ob.data.elements.new(type='BALL'); e.co = Vector(c); e.radius = r / K(s); e.stiffness = s; return e

def mb_ellip(ob, c, radii, rot=(0, 0, 0), s=2.0):
    e = ob.data.elements.new(type='ELLIPSOID'); e.co = Vector(c); e.radius = 1.0 / K(s); e.stiffness = s
    e.size_x, e.size_y, e.size_z = radii; e.rotation = Euler(rot).to_quaternion(); return e

def mb_capsule(ob, a, b, r, s=2.0):
    a = Vector(a); b = Vector(b); d = b - a
    e = ob.data.elements.new(type='CAPSULE'); e.co = (a + b) / 2; e.radius = r / K(s); e.stiffness = s
    e.size_x = d.length / 2; e.rotation = d.to_track_quat('X', 'Z'); return e

def bake(ob, name, key):
    """Evaluate a metaball family into a plain smooth mesh object at the origin and drop the metaball."""
    bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg)); me.name = name
    mb = ob.data; bpy.data.objects.remove(ob, do_unlink=True); bpy.data.metaballs.remove(mb)
    assert len(me.vertices) > 100, (name, len(me.vertices))
    # Voxel-remesh the metaball tessellation into a clean closed surface (no slivers or folds for the ink to catch),
    # then relax it lightly.
    tmp = bpy.data.objects.new('remesh tmp', me); bpy.data.collections[MASTER].objects.link(tmp)
    rm = tmp.modifiers.new('Clean clay surface', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = MB_RES * 0.9; rm.adaptivity = 0.0
    bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
    clean = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg)); bpy.data.objects.remove(tmp, do_unlink=True); bpy.data.meshes.remove(me)
    me = clean; me.name = name
    bm = bmesh.new(); bm.from_mesh(me)
    for _ in range(2): bmesh.ops.smooth_vert(bm, verts=bm.verts, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free(); me.update()
    return link(name, me, mat(key))

def surface_on(target, origin, direction, off=0.0, evaluated=False):
    """Ray-cast one object (world space) and return (hit point pushed out, normal). evaluated=True includes modifiers."""
    if evaluated: bpy.context.view_layer.update()
    mw = target.matrix_world; inv = mw.inverted()
    o = inv @ Vector(origin); d = (inv.to_3x3() @ Vector(direction)).normalized()
    if evaluated:
        hit, loc, nrm, _ = target.ray_cast(o, d, depsgraph=bpy.context.evaluated_depsgraph_get())
    else:
        hit, loc, nrm, _ = target.ray_cast(o, d)
    assert hit, (target.name, tuple(origin))
    nw = (inv.transposed().to_3x3() @ nrm).normalized(); pw = mw @ loc
    return pw + nw * off, nw

def dent(ob, p, n, rx, ry, spin, depth, rim=0.3):
    """Press a thumb dimple into mesh `ob` (identity transform) at surface point p, normal n, with a pushed-up rim."""
    R = (n.to_track_quat('Z', 'Y') @ Quaternion((0, 0, 1), spin)).to_matrix(); Rt = R.transposed()
    for v in ob.data.vertices:
        l = Rt @ (v.co - p)
        if abs(l.z) > 0.6 * max(rx, ry): continue
        u = math.sqrt((l.x / rx) ** 2 + (l.y / ry) ** 2)
        if u >= 1.35: continue
        w = -depth * (1 - u * u) ** 2 if u < 1 else depth * rim * math.sin(math.pi * (u - 1) / 0.35)
        v.co += n * w
    ob.data.update()

def grid_decal(name, target, P2, nu, nv, closed, proj, key, off, ink=True):
    """Painted patch projected onto target's evaluated surface. P2(u, v) -> 2D point; proj(pt) -> (point, normal)."""
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
    ob = link(name, me, mat(key))
    if not ink: ob['sheet_no_ink'] = True
    return ob

def tangent_proj(target, p, n, spin):
    R = (n.to_track_quat('Z', 'Y') @ Quaternion((0, 0, 1), spin)).to_matrix()
    dg = bpy.context.evaluated_depsgraph_get(); inv = target.matrix_world.inverted(); mw = target.matrix_world
    def proj(pt):
        o = p + R @ Vector((pt[0], pt[1], 0)) + n * 0.05
        hit, loc, nrm, _ = target.ray_cast(inv @ o, (inv.to_3x3() @ -n).normalized(), distance=0.1, depsgraph=dg)
        if not hit: return o - n * 0.05, n
        return mw @ loc, (inv.transposed().to_3x3() @ nrm).normalized()
    return proj

def planar_proj(target, direction):
    d = Vector(direction).normalized(); dg = bpy.context.evaluated_depsgraph_get(); inv = target.matrix_world.inverted(); mw = target.matrix_world
    def proj(pt3):
        o = Vector(pt3) - d * 0.5
        hit, loc, nrm, _ = target.ray_cast(inv @ o, (inv.to_3x3() @ d).normalized(), depsgraph=dg)
        assert hit, (target.name, pt3)
        return mw @ loc, (inv.transposed().to_3x3() @ nrm).normalized()
    return proj

def clear_scene():
    if bpy.context.object and bpy.context.object.mode != 'OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    for coll in list(bpy.data.collections): bpy.data.collections.remove(coll)
    for blocks in (bpy.data.meshes, bpy.data.curves, bpy.data.metaballs, bpy.data.armatures, bpy.data.materials, bpy.data.actions,
                   bpy.data.cameras, bpy.data.lights, bpy.data.images, bpy.data.linestyles, bpy.data.worlds, bpy.data.textures):
        for b in list(blocks): blocks.remove(b)
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)

# --- Key positions (Blender Z up, facing +Y, character right = +X) ------------------------------------------------
HEAD_C = Vector((0.016, 0.004, 1.095)); HEAD_R = (0.168, 0.152, 0.172); HEAD_ROLL = math.radians(8)   # tilted to its right
R_SH = Vector((0.212, -0.012, 0.852)); R_EL = Vector((0.345, 0.06, 0.675)); R_FIST = Vector((0.292, 0.232, 0.848))    # guard, raised
L_SH = Vector((-0.212, -0.012, 0.852)); L_EL = Vector((-0.33, 0.0, 0.655)); L_FIST = Vector((-0.332, 0.14, 0.492))    # low and out
HIP = 0.47

def fist(ob, c, fwd, palm, r=0.066, thumb_side=1):
    """Oversized clumsy mitten fist: a big lump, a knuckle row facing fwd, and a thumb wrapped over the curled fingers."""
    F = Vector(fwd).normalized(); D = (Vector(palm) - Vector(palm).dot(F) * F).normalized(); S = F.cross(D)
    c = Vector(c)
    mb_ellip(ob, c, (r * 1.06, r, r * 0.96), rot=Matrix((S, F, D)).transposed().to_euler())
    for k, t in enumerate((-1.5, -0.5, 0.5, 1.5)):
        mb_ball(ob, c + F * r * 0.62 - D * r * 0.18 + S * t * r * 0.36 + F * r * 0.04 * (1 - abs(t) / 1.5), r * 0.34, s=1.6)
    a = c + S * thumb_side * r * 0.85 - F * r * 0.1 - D * r * 0.2
    b = c + F * r * 0.55 + D * r * 0.62 + S * thumb_side * r * 0.25
    mb_capsule(ob, a, b, r * 0.3, s=1.8)
    return c - F * r * 0.7   # wrist point

def build():
    clear_scene()
    coll = bpy.data.collections.new(MASTER); bpy.context.scene.collection.children.link(coll)
    sc = bpy.context.scene; sc.unit_settings.system = 'METRIC'; sc.unit_settings.scale_length = 1.0

    # --- One lumpy clay mass: pot-belly torso, shoulders, a short neck pinch and the big neckless head --------------
    body = mball('Clay body mass')
    mb_ellip(body, (0.0, 0.0, 0.565), (0.185, 0.15, 0.15))                    # hips and belly
    mb_ball(body, (0.022, 0.062, 0.585), 0.118, s=1.7)                          # pot belly, a little off-centre
    mb_ellip(body, (0.0, -0.008, 0.76), (0.178, 0.132, 0.135))                  # chest
    for sx in (1, -1): mb_ball(body, (0.182 * sx, -0.012, 0.842), 0.074, s=1.8)  # shoulder lumps
    mb_ellip(body, tuple(HEAD_C), HEAD_R, rot=(0.0, HEAD_ROLL, 0.0))          # big head
    mb_ball(body, (HEAD_C.x + 0.004, 0.158, 1.068), 0.028, s=2.2)               # nub nose
    for c, r, s in (((-0.052, -0.035, 1.205), 0.07, 1.5),                        # lumpy cranium
                    ((0.088, 0.045, 1.012), 0.062, 1.35), ((-0.078, 0.05, 1.008), 0.058, 1.35),  # chubby jowls
                    ((0.06, -0.105, 0.725), 0.085, 1.4), ((-0.07, -0.098, 0.6), 0.08, 1.4),     # back lumps
                    ((-0.13, 0.05, 0.69), 0.07, 1.35), ((0.14, 0.02, 0.53), 0.075, 1.35),      # side lumps
                    ((0.0, -0.02, 0.92), 0.09, 1.6)):                                             # neck pinch
        mb_ball(body, c, r, s=s)
    for sx in (1, -1): mb_ball(body, (0.108 * sx, 0.0, 0.475), 0.092, s=1.7)    # hip lumps where the legs join

    # --- Noodly arms with oversized mitten fists (a separate clay roll each, pressed onto the shoulders) ------------
    arm_r = mball('Clay arm right (guard)')
    mb_ball(arm_r, R_SH, 0.062); mb_capsule(arm_r, R_SH, R_EL, 0.05); mb_ball(arm_r, R_EL, 0.052, s=1.8)
    w = fist(arm_r, R_FIST, (-0.18, 0.42, 0.89), (-1.0, -0.2, -0.25), thumb_side=-1)
    mb_capsule(arm_r, R_EL, w, 0.046)
    arm_l = mball('Clay arm left (low)')
    mb_ball(arm_l, L_SH, 0.062); mb_capsule(arm_l, L_SH, L_EL, 0.05); mb_ball(arm_l, L_EL, 0.052, s=1.8)
    w = fist(arm_l, L_FIST, (0.05, 0.62, -0.78), (1.0, -0.2, 0.0), thumb_side=-1)
    mb_capsule(arm_l, L_EL, w, 0.046)

    # --- Short stumpy legs on flat squashed pancake feet, knees bent --------------------------------------------------
    legs = []
    for side, sx in (('right', 1), ('left', -1)):
        lg = mball(f'Clay leg {side}')
        hip = Vector((0.108 * sx, 0.0, HIP)); knee = Vector((0.158 * sx, 0.055, 0.252)); ankle = Vector((0.18 * sx, 0.0, 0.085))
        mb_capsule(lg, hip, knee, 0.07); mb_ball(lg, knee, 0.068, s=1.8); mb_capsule(lg, knee, ankle, 0.06)
        yaw = math.radians(-15 * sx); fc = Vector((0.188 * sx, 0.044, 0.042))
        fwd = Vector((math.sin(-yaw), math.cos(yaw), 0)); side_v = Vector((fwd.y, -fwd.x, 0))
        mb_ellip(lg, fc, (0.096, 0.14, 0.05), rot=(0, 0, yaw))
        for t in (-1, 0, 1):
            mb_ball(lg, fc + fwd * 0.124 + side_v * t * 0.05 + Vector((0, 0, -0.004)), 0.036 if t else 0.039, s=1.7)
        legs.append(lg)

    body = bake(body, 'Clay body mass', 'clay')
    arm_r = bake(arm_r, 'Clay arm right (guard)', 'clay'); arm_l = bake(arm_l, 'Clay arm left (low)', 'clay')
    legs = [bake(lg, n, 'clay') for lg, n in zip(legs, ('Clay leg right', 'Clay leg left'))]
    for lg in legs:                                  # squash the pancake soles flat on the floor
        for v in lg.data.vertices:
            if v.co.z < 0.0: v.co.z = 0.0
        lg.data.update()

    # --- Thumbprint dents pressed into the clay (geometry dimple now; painted whorl after the clay texture) ---------
    prints = []
    def press(tag, target, org, dirn, r, spin=0.0, depth=0.006, rings=4):
        p, n = surface_on(target, org, dirn); dent(target, p, n, r, r * 0.78, spin, depth); prints.append((tag, target, p, n, r, spin, rings))
    press('chest emblem', body, (-0.012, 1.0, 0.765), (0, -1, 0), 0.072, spin=0.12, depth=0.009, rings=6)
    press('forehead', body, (0.035, 0.8, 1.385), (0.0, -1.0, -0.25), 0.042, spin=-0.5, depth=0.006)
    press('cheek', body, (1.0, 0.5, 1.02), (-0.9, -0.5, 0.0), 0.034, spin=0.9, depth=0.005, rings=3)
    press('belly', body, (0.35, 1.0, 0.54), (-0.3, -1, 0.0), 0.045, spin=0.7)
    press('back of head', body, (0.02, -1.0, 1.13), (0, 1, 0), 0.055, spin=0.3)
    press('shoulder blade', body, (-0.1, -1.0, 0.8), (0.05, 1, -0.05), 0.058, spin=-0.4)
    press('lower back', body, (0.08, -1.0, 0.56), (0, 1, 0), 0.05, spin=1.0)
    press('upper arm', arm_l, (-1.0, 0.0, 0.76), (1, 0, 0), 0.032, spin=1.4, depth=0.005, rings=3)
    press('guard forearm', arm_r, (1.0, 0.1, 0.8), (-1, 0.1, 0.0), 0.03, spin=0.2, depth=0.005, rings=3)
    press('thigh', legs[0], (0.4, 1.0, 0.37), (-0.25, -1, 0.0), 0.034, spin=0.6, depth=0.005, rings=3)
    press('calf', legs[1], (-0.19, -1.0, 0.18), (0, 1, 0), 0.03, spin=-0.8, depth=0.005, rings=3)

    # --- Hand-worked clay irregularity (local-coordinate noise so every sheet copy matches) --------------------------
    tex = bpy.data.textures.new('Clay hand-worked noise', 'CLOUDS'); tex.noise_scale = 0.07; tex.noise_depth = 1
    for ob in [body, arm_r, arm_l] + legs:
        md = ob.modifiers.new('Clay irregularity', 'DISPLACE'); md.texture = tex; md.strength = 0.018; md.mid_level = 0.5
        md.texture_coords = 'LOCAL'; md.direction = 'NORMAL'
        if ob in legs:   # keep the squashed soles exactly flat on the floor
            vg = ob.vertex_groups.new(name='Clay noise weight'); md.vertex_group = vg.name
            for v in ob.data.vertices: vg.add([v.index], min(1.0, max(0.0, (v.co.z - 0.004) / 0.03)), 'REPLACE')
    bpy.context.view_layer.update()

    for tag, target, p, n, r, spin, rings in prints:
        proj = tangent_proj(target, p, n, spin); rx, ry = r * 0.98, r * 0.76
        grid_decal(f'Thumbprint dent {tag}', target, lambda u, v: (rx * v * math.cos(math.tau * u), ry * v * math.sin(math.tau * u)),
                   40, 5, True, proj, 'dent', 0.0008, ink=False)
        # one continuous whorl ridge spiralling out from an elongated core, drifting a little off-centre (a fingerprint loop)
        turns = rings + 0.6; wd = min(0.0052, r * 0.085); f0 = 0.12
        def whorl(u, v, turns=turns, wd=wd, rx=rx, ry=ry, r=r):
            th = u * turns * math.tau; f = f0 + (0.93 - f0) * u; cy = r * 0.14 * (1 - f)
            return ((rx * f * 0.8 + (v - 0.5) * wd) * math.cos(th), cy + (ry * f + (v - 0.5) * wd) * math.sin(th))
        grid_decal(f'Thumbprint whorl ridge {tag}', target, whorl, int(turns * 56), 1, False, proj, 'ridge', 0.0015, ink=False)

    # --- Rolled clay-coil belt (dips under the pot belly) and a round honey buckle -----------------------------------
    path = []
    for k in range(96):
        th = math.tau * k / 96; d = Vector((math.cos(th), math.sin(th), 0)); z = 0.508 - 0.03 * math.sin(th)
        h, nn = surface_on(body, d * 1.0 + Vector((0, 0, z)), -d, evaluated=True); path.append(h + nn * 0.011)
    for _ in range(3):
        path = [(path[i - 1] + 2 * path[i] + path[(i + 1) % len(path)]) / 4 for i in range(len(path))]
    loop_tube('Clay-coil belt', path, lambda u: 0.024 * (1 + 0.1 * math.sin(u * math.tau * 5) + 0.06 * math.sin(u * math.tau * 11 + 1)), 'coil')
    front = path[24]; fn = Vector((front.x, front.y, 0)).normalized() * 0.9 + Vector((0, 0, -0.1)); fn.normalize()
    q = fn.to_track_quat('Z', 'Y')
    cyl('Round honey buckle', tuple(front + fn * 0.014), 0.05, 0.047, 0.024, 'honey', rot=q.to_euler(), bev=0.006)
    cyl('Buckle pressed centre', tuple(front + fn * 0.027), 0.024, 0.021, 0.006, 'honeydk', rot=q.to_euler(), bev=0.002)

    # --- Face: two blank round eyes (different sizes), a raised brow lump, lopsided grin and a poking-out tongue ------
    face = planar_proj(body, (0, -1, 0))
    for side, sx, rr in (('right', 1, 1.1), ('left', -1, 0.94)):
        p, n = face((HEAD_C.x + 0.064 * sx + 0.005, 0.0, 1.134 - 0.009 * sx))
        nf = (n * 0.5 + Vector((0, 1, 0)) * 0.5).normalized()
        fr = empty(f'Eye frame {side}', tuple(p - nf * 0.016)); fr.rotation_euler = nf.to_track_quat('Y', 'Z').to_euler()
        ellipsoid(f'Blank round eye {side}', (0, 0, 0), (0.047 * rr, 0.034 * rr, 0.05 * rr), 'eye', parent=fr, seg=40, rings=20)
    # worm-of-clay brows pressed onto the forehead: its left one arched high ("huh?"), its right one flat and low
    for side, pts2 in (('left', [(-0.098, 1.192), (-0.075, 1.214), (-0.048, 1.222), (-0.022, 1.211)]),
                       ('right', [(0.058, 1.19), (0.086, 1.196), (0.114, 1.19), (0.132, 1.178)])):
        pts = []
        for x, z in pts2:
            h, nn = face((HEAD_C.x + x, 0.0, z)); pts.append(h + nn * 0.004)
        _, bp = sweep(f'Clay worm brow {side}', pts, [0.0075, 0.0115, 0.011, 0.0068], 'clay', n=16, per=8)
        for e, rr in ((bp[0], 0.0075), (bp[-1], 0.0068)):
            ellipsoid(f'Clay worm brow {side} rounded end', tuple(e), (rr, rr, rr), 'clay', seg=16, rings=8)
    def grin(u, v):
        x = -0.066 + 0.128 * u; top = 1.0 + 0.02 * (u - 0.5) + 0.028 * (2 * u - 1) ** 2 * (1.25 if u > 0.5 else 0.85)
        depth = 0.004 + 0.03 * math.sin(math.pi * u) ** 0.8
        return (HEAD_C.x + x + 0.01, 0.0, top - depth * v)
    grid_decal('Lopsided dopey grin', body, grin, 32, 4, False, lambda pt: face(pt), 'mouth', 0.0012)
    tx, tz = HEAD_C.x + 0.031, 0.972              # tongue root on the lower lip, just right of centre
    grid_decal('Tongue inside the grin', body, lambda u, v: (tx + 0.017 * v * math.cos(math.tau * u), 0.0, tz + 0.006 + 0.011 * v * math.sin(math.tau * u)),
               32, 3, True, lambda pt: face(pt), 'tongue', 0.0018)
    p, n = face((tx, 0.0, tz))
    fr = empty('Tongue frame', tuple(p)); fr.rotation_euler = (n.to_track_quat('Y', 'Z') @ Quaternion((0, 1, 0), math.radians(10))
                                                           @ Quaternion((1, 0, 0), math.radians(24))).to_euler()
    ellipsoid('Poking-out pink tongue', (0.0, 0.005, -0.009), (0.021, 0.0095, 0.028), 'tongue', parent=fr, seg=28, rings=14)

    # --- Pinched clay antenna with a ball on top, leaning with the head tilt --------------------------------------------
    top, tn = surface_on(body, (HEAD_C.x + 0.03, 0.0, 2.0), (0, 0, -1), evaluated=True)
    base = top - Vector((0, 0, 0.012))
    pts = [base, base + Vector((0.006, 0.0, 0.034)), base + Vector((0.018, -0.004, 0.072)), base + Vector((0.036, -0.01, 0.1))]
    _, apath = sweep('Pinched antenna stalk', pts, [0.022, 0.014, 0.011, 0.012], 'clay', n=20, per=10)
    tip = apath[-1] + (apath[-1] - apath[-3]).normalized() * 0.022
    ellipsoid('Antenna clay ball', tuple(tip), (0.03, 0.029, 0.028), 'clay', seg=32, rings=16)
    ellipsoid('Antenna ball pinch', tuple(tip + Vector((-0.012, 0.0, 0.018))), (0.012, 0.011, 0.01), 'clay', seg=16, rings=8)

    for ob in PARTS: ob['work_order'] = 'WO111'; ob['asset_id'] = 'putty-grunt'

def measure(objs=None):
    dg = bpy.context.evaluated_depsgraph_get(); lo = [1e9] * 3; hi = [-1e9] * 3; tris = 0; per = {}
    for ob in (objs or [o for o in bpy.data.collections[MASTER].objects]):
        if ob.type not in ('MESH', 'CURVE', 'META'): continue
        ev = ob.evaluated_get(dg); me = ev.to_mesh(); top = -1e9
        for vtx in me.vertices:
            w = ev.matrix_world @ vtx.co; top = max(top, w.z)
            for k in range(3): lo[k] = min(lo[k], w[k]); hi[k] = max(hi[k], w[k])
        me.calc_loop_triangles(); tris += len(me.loop_triangles); ev.to_mesh_clear(); per[ob.name] = top
    return {'min': [round(x, 4) for x in lo], 'max': [round(x, 4) for x in hi],
            'size': [round(hi[k] - lo[k], 4) for k in range(3)], 'blockout_triangles': tris}, per

TOP_KEYS = ('Antenna clay ball', 'Pinched antenna stalk', 'Clay body mass', 'Blank round eye', 'Clay arm right (guard)',
            'Clay arm left (low)', 'Round honey buckle', 'Clay-coil belt', 'Clay leg')

if __name__ == '__main__':
    sc = bpy.context.scene
    assert sc.get('asset_id') == 'putty-grunt' and sc.get('scene_lease') == 'active'
    t0 = datetime.datetime.now(datetime.timezone.utc)
    build(); bpy.context.view_layer.update()
    m, per = measure()
    tops = {k.strip(): round(max(v for n, v in per.items() if n.startswith(k)), 4) for k in TOP_KEYS}
    sc['blockout_bounds_m'] = json.dumps(m); sc['blockout_tops_m'] = json.dumps(tops)
    sc['orientation'] = 'Blender +Z up/+Y forward; glTF +Y up/-Z forward; floor-centred origin; character right = +X'
    path = ROOT / 'putty-grunt-blockout.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(path), compress=True)
    rec = {'saved': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bounds_blender_zup': m, 'feature_tops_m': tops,
           'metaball_resolution_m': MB_RES, 'parts': len(PARTS), 'materials': sorted(x.name for x in bpy.data.materials),
           'build_seconds': round((datetime.datetime.now(datetime.timezone.utc) - t0).total_seconds(), 1),
           'utc': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    (ROOT / 'blockout-measurements.json').write_text(json.dumps(rec, indent=2) + '\n')
    print(json.dumps(rec))
