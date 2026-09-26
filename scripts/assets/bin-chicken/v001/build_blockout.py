"""WO111 bin-chicken v001: painted flat-colour BLOCKOUT for a Blender reference sheet.

Reference-sheet stage only: primitive/curve/lathe forms, no final topology, no rig, no atlas, no GLB.
Blender +Z up, character faces +Y (exports later as glTF +Y up / -Z forward), floor-centred at the origin.
Character right = +X. All dimensions in metres.

Design: World B chapter 2 ordinary (ages 2-4 era parody, serves variants a and b). A cheeky, goofy
Australian white ibis, the "bin chicken" of the era's backyard-suburb cartoons, about 1.2 m to the top of
its hat. Round grubby-white body on long knobbly stilt legs with big three-toed feet; bare plum-black neck in
a gentle S and a bald black head with big googly eyes (right eye wide with a raised brow, left eye half-lidded)
glancing sideways; a long down-curved graphite beak holding one stolen hot chip crosswise; a pink gape grin and
pink nape bands. It wears a floppy banana peel as a hat. Its black wing-tip "fingers" meet behind its back to
hide a striped paper cone of stolen chips above lacy black tail plumes, while it tiptoes forward on its left
foot ("who, me?"). A few beige bin-grime smudges on the white feathers.
"""
import bpy, bmesh, math, json, hashlib, datetime
from mathutils import Vector, Matrix
from pathlib import Path

ROOT = Path('/workspace/haynes-quest/family-eras/bin-chicken/v001')
MASTER = 'Bin chicken blockout (master)'

PAL = {
    'white': '#f1f0ea', 'grime': '#c9bca6', 'ink': '#2e2a38', 'beak': '#4c4657', 'leg': '#7d6c7a',
    'pink': '#e3998d', 'eye': '#fbf8f2', 'iris': '#a8683e', 'peel': '#f2c94c', 'peelin': '#f7e7b4',
    'brown': '#7a5634', 'paper': '#f6f0e2', 'stripe': '#5d8fbf', 'chip': '#e7b451',
}

def lin(h):
    h = h.lstrip('#'); out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)

MATS = {}
def mat(key):
    if key in MATS: return MATS[key]
    m = bpy.data.materials.new('BC ' + key + ' ' + PAL[key]); m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = lin(PAL[key]); bs.inputs['Roughness'].default_value = 0.92
    bs.inputs['Specular IOR Level'].default_value = 0.12
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

def cyl(name, loc, r1, r2, depth, key, rot=(0, 0, 0), parent=None, seg=32, scale=(1, 1, 1), bev=0.004):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r1, radius2=r2, depth=depth)
    bm.to_mesh(me); bm.free()
    ob = link(name, me, mat(key), parent); ob.location = loc; ob.rotation_euler = rot; ob.scale = scale
    if bev: bevel(ob, bev)
    return ob

def box(name, loc, s, key, rot=(0, 0, 0), parent=None, bev=0.012):
    me = bpy.data.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bm.to_mesh(me); bm.free()
    for v in me.vertices: v.co = Vector((v.co.x * s[0], v.co.y * s[1], v.co.z * s[2]))
    ob = link(name, me, mat(key), parent, smooth=False); ob.location = loc; ob.rotation_euler = rot
    if bev: bevel(ob, bev, 3)
    for p in me.polygons: p.use_smooth = True
    wn = ob.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL'); wn.keep_sharp = True
    return ob

def interp(profile, z):
    if z <= profile[0][0]: return profile[0][1]
    for (z0, r0), (z1, r1) in zip(profile, profile[1:]):
        if z0 <= z <= z1: return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return profile[-1][1]

def smooth_profile(profile, step=0.008):
    t0, t1 = profile[0][0], profile[-1][0]; n = max(8, int((t1 - t0) / step))
    ts = [t0 + (t1 - t0) * i / n for i in range(n + 1)]; rs = [interp(profile, t) for t in ts]
    for _ in range(2):
        rs = [rs[0]] + [(rs[i - 1] + 2 * rs[i] + rs[i + 1]) / 4 for i in range(1, len(rs) - 1)] + [rs[-1]]
    return list(zip(ts, rs))

def lathe(name, profile, mats, a=(0, 0, 0), b=None, ey=1.0, n=48, parent=None, band=None, dense=True):
    """Surface of revolution along local Z from a (towards b if given). Local Y (the ey-scaled axis) is kept as
    close to world +Z as possible. band(t_frac, angle_frac) -> material index per face."""
    prof = smooth_profile(profile) if dense else profile
    L = prof[-1][0] - prof[0][0]
    verts = []; faces = []; idx = []
    for z, r in prof:
        for i in range(n):
            ang = math.tau * i / n; verts.append((r * math.cos(ang), r * ey * math.sin(ang), z))
    rings = len(prof)
    for j in range(rings - 1):
        tm = ((prof[j][0] + prof[j + 1][0]) / 2 - prof[0][0]) / L
        for i in range(n):
            faces.append((j * n + i, j * n + (i + 1) % n, (j + 1) * n + (i + 1) % n, (j + 1) * n + i))
            idx.append(band(tm, (i + 0.5) / n) if band else 0)
    faces.append(tuple(range(n - 1, -1, -1))); idx.append(idx[0] if idx else 0)
    faces.append(tuple((rings - 1) * n + i for i in range(n))); idx.append(idx[-1] if idx else 0)
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    for p, k in zip(me.polygons, idx): p.material_index = k
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    ob = link(name, me, list(mats) if isinstance(mats, (list, tuple)) else [mats], parent)
    ob.location = a
    if b is not None:
        d = Vector(b) - Vector(a); ob.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    return ob

def catmull(pts, per=10):
    P = [Vector(p) for p in pts]; P = [P[0] + (P[0] - P[1])] + P + [P[-1] + (P[-1] - P[-2])]; out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for s in range(per):
            t = s / per
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-2]); return out

def sweep(name, pts, radii, mats, band=None, n=24, per=12, parent=None, flat=1.0, up=(0, 0, 1)):
    """Tube along a Catmull-Rom path with rotation-minimising frames; band(u) -> material index per ring.
    flat scales the cross-section along the frame axis nearest `up` (1 = round)."""
    path = catmull(pts, per); m = len(path)
    lens = [0.0]
    for i in range(1, m): lens.append(lens[-1] + (path[i] - path[i - 1]).length)
    total = lens[-1]; verts = []; faces = []; idx = []
    T = (path[1] - path[0]).normalized(); U = Vector(up)
    N = (U - U.dot(T) * T)
    if N.length < 1e-3: N = T.cross(Vector((1, 0, 0)))
    N.normalize()
    for i in range(m):
        if i > 0:
            T = (path[min(i + 1, m - 1)] - path[i - 1]).normalized(); N = (N - N.dot(T) * T).normalized()
        B = T.cross(N); u = lens[i] / total
        k = u * (len(radii) - 1); k0 = min(int(k), len(radii) - 2); r = radii[k0] + (radii[k0 + 1] - radii[k0]) * (k - k0)
        for j in range(n):
            ang = math.tau * j / n; verts.append(tuple(path[i] + r * (flat * math.cos(ang) * N + math.sin(ang) * B)))
    for i in range(m - 1):
        um = (lens[i] + lens[i + 1]) / 2 / total
        for j in range(n):
            faces.append((i * n + j, i * n + (j + 1) % n, (i + 1) * n + (j + 1) % n, (i + 1) * n + j)); idx.append(band(um) if band else 0)
    faces.append(tuple(range(n - 1, -1, -1))); idx.append(idx[0])
    faces.append(tuple((m - 1) * n + j for j in range(n))); idx.append(idx[-1])
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    for p, k in zip(me.polygons, idx): p.material_index = k
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    ob = link(name, me, [mat(k) for k in mats], parent); return ob, path

def tube(name, pts, radii, key, parent=None, res=4, bres=6):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 1.0; cu.bevel_resolution = bres
    cu.use_fill_caps = True; cu.resolution_u = res
    sp = cu.splines.new('NURBS'); sp.points.add(len(pts) - 1); sp.order_u = min(4, len(pts)); sp.use_endpoint_u = True
    rr = radii if isinstance(radii, (list, tuple)) else [radii] * len(pts)
    for p, (x, y, z), r in zip(sp.points, pts, rr): p.co = (x, y, z, 1.0); p.radius = r
    ob = link(name, cu, mat(key), parent); return ob

def cone_between(name, a, b, r1, key, seg=12):
    a = Vector(a); b = Vector(b); d = b - a
    ob = cyl(name, (a + b) / 2, r1, 0.0, d.length, key, seg=seg, bev=0)
    ob.rotation_euler = d.to_track_quat('Z', 'Y').to_euler(); return ob

def ribbon(name, pts, widths, center, mats, thick=0.007, cup=0.2, per=8, parent=None, tip_from=None):
    """Cupped strip along a path (a banana-peel petal); outer face mats[0], inner shell mats[1]."""
    path = catmull(pts, per); m = len(path); C = Vector(center)
    lens = [0.0]
    for i in range(1, m): lens.append(lens[-1] + (path[i] - path[i - 1]).length)
    total = lens[-1]; verts = []; S_prev = None
    for i, p in enumerate(path):
        T = (path[min(i + 1, m - 1)] - path[max(i - 1, 0)]).normalized(); out = (p - C).normalized()
        S = T.cross(out)
        S = S_prev if (S.length < 1e-4 and S_prev is not None) else S.normalized()
        if S_prev is not None and S.dot(S_prev) < 0: S = -S
        S_prev = S; out = (out - out.dot(T) * T).normalized(); u = lens[i] / total; w = interp(widths, u)
        verts += [tuple(p - S * w / 2), tuple(p + out * cup * w), tuple(p + S * w / 2)]
    faces = []; idx = []
    for i in range(m - 1):
        a = 3 * i; b = 3 * (i + 1); tipband = 2 if (tip_from is not None and (lens[i] + lens[i + 1]) / 2 / total > tip_from) else 0
        faces += [(a, a + 1, b + 1, b), (a + 1, a + 2, b + 2, b + 1)]; idx += [tipband, tipband]
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    for poly, k in zip(me.polygons, idx): poly.material_index = k
    score = sum(p.normal.dot(Vector(p.center) - C) for p in me.polygons)
    if score < 0:
        bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.reverse_faces(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    ob = link(name, me, [mat(k) for k in mats], parent)
    so = ob.modifiers.new('Peel thickness', 'SOLIDIFY'); so.thickness = thick; so.offset = -1.0
    so.material_offset = 1; so.material_offset_rim = 0; so.use_even_offset = False
    ss = ob.modifiers.new('Soft peel', 'SUBSURF'); ss.levels = 1; ss.render_levels = 1
    return ob, path

def clear_scene():
    if bpy.context.object and bpy.context.object.mode != 'OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    for coll in list(bpy.data.collections): bpy.data.collections.remove(coll)
    for blocks in (bpy.data.meshes, bpy.data.curves, bpy.data.armatures, bpy.data.materials, bpy.data.actions,
                   bpy.data.cameras, bpy.data.lights, bpy.data.images, bpy.data.linestyles, bpy.data.worlds):
        for b in list(blocks): blocks.remove(b)
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)

# --- Key dimensions ---------------------------------------------------------------------------------
TAIL_END = Vector((0.0, -0.27, 0.535)); CHEST = Vector((0.0, 0.235, 0.665))   # body axis, chest up ~14 deg
BODY = [(0.0, 0.03), (0.03, 0.085), (0.08, 0.135), (0.16, 0.176), (0.26, 0.192), (0.35, 0.188), (0.42, 0.165),
        (0.47, 0.125), (0.50, 0.075), (0.515, 0.02)]
BODY_EY = 1.06
HC = Vector((0.0, 0.175, 1.075)); HR = Vector((0.118, 0.13, 0.108))            # bald head ellipsoid
PIVOT = Vector((0.0, 0.165, 1.0))                                               # head turn pivot at the neck top
HEAD_YAW = math.radians(-17); HEAD_ROLL = math.radians(7)                        # turned and tilted to its right

def head_pt(x, z, off=0.0):
    """Point on the head's front surface at (x, z) pushed out by off along the normal; returns (point, normal)."""
    q = max(0.0, 1 - (x / HR.x) ** 2 - ((z - HC.z) / HR.z) ** 2); y = HC.y + HR.y * math.sqrt(q)
    n = Vector((x / HR.x ** 2, (y - HC.y) / HR.y ** 2, (z - HC.z) / HR.z ** 2)).normalized()
    return Vector((x, y, z)) + n * off, n

def sph(theta, phi, s=1.0):
    return HC + Vector((HR.x * math.sin(theta) * math.sin(phi) * s, HR.y * math.sin(theta) * math.cos(phi) * s, HR.z * math.cos(theta) * s))

def surface_on(target, origin, direction, off=0.002, evaluated=False):
    """Ray-cast one object (world space) and return (hit point pushed out, normal). evaluated=True includes modifiers."""
    if evaluated: bpy.context.view_layer.update()
    mw = target.matrix_world; inv = mw.inverted()
    o = inv @ Vector(origin); d = (inv.to_3x3() @ Vector(direction)).normalized()
    if evaluated:
        hit, loc, nrm, _ = target.ray_cast(o, d, depsgraph=bpy.context.evaluated_depsgraph_get())
    else:
        hit, loc, nrm, _ = target.ray_cast(o, d)
    assert hit, (target.name, origin)
    nw = (inv.transposed().to_3x3() @ nrm).normalized(); pw = mw @ loc
    return pw + nw * off, nw

def build():
    clear_scene()
    coll = bpy.data.collections.new(MASTER); bpy.context.scene.collection.children.link(coll)
    sc = bpy.context.scene; sc.unit_settings.system = 'METRIC'; sc.unit_settings.scale_length = 1.0

    # --- Body: grubby-white egg, chest up; bin-grime smudges ray-cast onto it -------------------------
    body = lathe('Grubby white egg body', BODY, ['white'], a=TAIL_END, b=CHEST, ey=BODY_EY, n=64)
    bpy.context.view_layer.update()
    for k, (org, dirn, s, spin) in enumerate((
            ((-0.40, 0.9, 0.62), (0.45, -1, -0.05), (0.034, 0.024, 0.006), 0.4),     # chest, its left
            ((0.30, 0.7, 0.30), (-0.23, -0.58, 0.17), (0.026, 0.018, 0.006), -0.6),  # lower belly, its right
            ((0.12, -1.0, 0.95), (-0.07, 0.88, -0.21), (0.03, 0.022, 0.006), 1.1))):  # back, near the loot
        p, n = surface_on(body, org, dirn)
        q = n.to_track_quat('Z', 'Y') @ Matrix.Rotation(spin, 4, 'Z').to_quaternion()
        fr = empty(f'Grime smudge frame {k}', tuple(p)); fr.rotation_euler = q.to_euler()
        ellipsoid(f'Bin-grime smudge {k}', (0, 0, 0), s, 'grime', parent=fr, seg=20, rings=10)
        ellipsoid(f'Bin-grime smudge {k} lobe', (s[0] * 0.8, s[1] * 0.5, 0), (s[0] * 0.55, s[1] * 0.6, s[2]), 'grime', parent=fr, seg=16, rings=8)
        ellipsoid(f'Bin-grime crumb {k}', (-s[0] * 1.5, -s[1] * 0.9, 0), (0.007, 0.007, 0.004), 'grime', parent=fr, seg=10, rings=6)

    # --- Lacy black plume drapes hanging from where the crossed wing tips meet over the tail -------------
    for k, (xo, reach, curl) in enumerate(((-0.04, 0.9, -0.03), (0.0, 1.0, 0.02), (0.042, 0.84, 0.03))):
        pts = [(xo * 0.4, -0.29, 0.575), (xo, -0.345, 0.53), (xo * 1.25, -0.375, 0.465 + 0.05 * (1 - reach)),
               (xo * 1.35, -0.385, 0.40 + 0.07 * (1 - reach)), (xo * 1.35 + curl, -0.365, 0.36 + 0.08 * (1 - reach))]
        sweep(f'Lacy black plume drape {k}', pts, [0.018, 0.03, 0.036, 0.03, 0.037, 0.029, 0.033, 0.02, 0.009], ['ink'],
              n=24, per=12, flat=0.3, up=(0, -1, 0))
    # --- Legs: feathered white thighs, bare mauve stilts with knobbly backward "knees", big feet ----------
    for side, sx in (('right', 1), ('left', -1)):
        ellipsoid(f'Feathered thigh {side}', (0.08 * sx, 0.0, 0.43), (0.062, 0.076, 0.085), 'white', rot=(0.2, 0, 0))
    def leg(side, sx, hip, knee, ball, toe_dirs, toe_z, back_dir, back_z):
        tube(f'Bare stilt shin {side}', [hip, knee], [0.021, 0.019], 'leg', bres=4)
        ellipsoid(f'Knobbly knee {side}', knee, (0.029, 0.03, 0.03), 'leg', seg=20, rings=10)
        tube(f'Bare stilt shank {side}', [knee, ball], [0.019, 0.018], 'leg', bres=4)
        ellipsoid(f'Foot ball {side}', ball, (0.03, 0.034, 0.026), 'leg', seg=20, rings=10)
        for k, (d, L) in enumerate(toe_dirs):
            a = math.radians(d); dv = Vector((math.sin(a), math.cos(a), 0))
            b = Vector(ball); tip = b + dv * L; tip.z = toe_z; mid = b + dv * L * 0.5; mid.z = (b.z + toe_z) / 2 + 0.004
            tube(f'Big toe {side} {k}', [tuple(b), tuple(mid), tuple(tip)], [0.02, 0.016, 0.011], 'leg', bres=4)
            ellipsoid(f'Toe tip pad {side} {k}', tuple(tip), (0.013, 0.015, 0.011), 'leg', seg=12, rings=6)
        b = Vector(ball); bd = Vector(back_dir).normalized(); tip = b + bd * 0.065; tip.z = back_z
        tube(f'Back toe {side}', [tuple(b), tuple(tip)], [0.016, 0.01], 'leg', bres=4)
    leg('right', 1, (0.08, 0.0, 0.37), (0.082, -0.04, 0.205), (0.085, 0.03, 0.026),
        [(-26, 0.13), (3, 0.155), (32, 0.125)], 0.012, (0.1, -1, 0), 0.012)
    # left foot mid tiptoe: heel lifted, toes pointed down to the floor
    leg('left', -1, (-0.08, -0.005, 0.37), (-0.084, -0.085, 0.215), (-0.088, -0.07, 0.07),
        [(-30, 0.125), (-2, 0.145), (26, 0.12)], 0.012, (-0.1, -1, -0.3), 0.04)

    # --- Wings folded along the sides, black primaries; wing-tip "fingers" clasp the loot behind -------
    wing_band = lambda t, a: 1 if t < 0.15 else 0
    for side, sx in (('right', 1), ('left', -1)):
        lathe(f'Folded white wing {side}', [(0.0, 0.004), (0.06, 0.022), (0.15, 0.036), (0.26, 0.043), (0.33, 0.038), (0.36, 0.022), (0.372, 0.0)],
              ['white', 'ink'], a=(0.142 * sx, -0.215, 0.585), b=(0.176 * sx, 0.13, 0.665), ey=2.55, n=48, band=wing_band)
        for k, z0 in enumerate((0.625, 0.665)):
            yend = -0.352 if sx > 0 else -0.336
            sweep(f'Black wing-tip feather {side} {k}', [(0.135 * sx, -0.19, z0), (0.105 * sx, -0.285, z0 - 0.025), (-0.05 * sx, yend, z0 - 0.075 - 0.01 * k)],
                  [0.026, 0.032, 0.03, 0.016], ['ink'], n=20, per=10, flat=0.42, up=(1, 0, 0))

    # --- The loot: a striped paper cone of stolen hot chips, held behind its back ----------------------
    stripes = lambda t, a: 0 if t > 0.9 else (1 if (a * 9) % 1.0 < 0.5 else 0)
    ca = Vector((0.0, -0.365, 0.565)); cb = Vector((-0.058, -0.35, 0.735))
    lathe('Striped paper chip cone', [(0.0, 0.006), (0.02, 0.012), (0.15, 0.058), (0.17, 0.064), (0.168, 0.052), (0.14, 0.0)],
          ['paper', 'stripe'], a=tuple(ca), b=tuple(cb), n=48, band=stripes, dense=False)
    axis = (cb - ca).normalized()
    for k, (dx, dy, tilt_x, tilt_y, L) in enumerate(((-0.03, 0.0, -0.35, 0.05, 0.10), (-0.01, 0.022, -0.1, 0.25, 0.115),
                                                   (0.012, -0.015, 0.15, -0.2, 0.11), (0.03, 0.01, 0.4, 0.1, 0.095),
                                                   (0.0, -0.03, 0.05, -0.4, 0.09), (0.018, 0.028, 0.25, 0.35, 0.1))):
        base = cb + Vector((dx, dy, -0.03))
        d = (axis + Vector((tilt_x, tilt_y, 0)) * 0.9).normalized()
        box(f'Stolen loot chip {k}', tuple(base + d * L / 2), (0.017, 0.017, L), 'chip',
            rot=d.to_track_quat('Z', 'Y').to_euler(), bev=0.004)

    # --- Scruffy white feather ruff where the bare neck starts ----------------------------------------
    ellipsoid('White lower neck', (0.0, 0.18, 0.705), (0.09, 0.085, 0.07), 'white')
    rc = Vector((0.0, 0.185, 0.742))
    for k in range(16):
        ang = math.tau * k / 16 + 0.2; o = Vector((math.cos(ang), math.sin(ang), 0))
        L = 0.05 + 0.02 * ((k * 7) % 3) / 2
        a = rc + Vector((o.x * 0.058, o.y * 0.052, -0.012 - 0.008 * (k % 2))); d = (o * 0.95 + Vector((0, 0, 0.42 + 0.14 * (k % 2)))).normalized()
        ellipsoid(f'Scruffy ruff feather {k}', tuple(a + d * L * 0.45), (0.03, 0.01, L * 0.55), 'white',
                  rot=d.to_track_quat('Z', 'X').to_euler(), seg=16, rings=8)
    for k, (dx, dz) in enumerate(((-0.02, 0.0), (0.016, 0.012))):
        a = Vector((dx, 0.228, 0.75 + dz)); d = Vector((dx * 1.5, 0.03, 0.07)).normalized()
        ellipsoid(f'Ruff cowlick {k}', tuple(a + d * 0.03), (0.018, 0.01, 0.04), 'white', rot=d.to_track_quat('Z', 'X').to_euler(), seg=16, rings=8)

    # --- Bare plum-black neck in a gentle S --------------------------------------------------------------
    sweep('Bare black S neck', [(0.0, 0.18, 0.70), (0.0, 0.215, 0.79), (0.0, 0.21, 0.88), (0.0, 0.168, 0.95), (0.0, 0.163, 1.0), (0.0, 0.168, 1.035)],
          [0.052, 0.046, 0.041, 0.04, 0.045, 0.05], ['ink'], n=28, per=10)

    head_parts_start = len(PARTS)
    # --- Big bald black head ----------------------------------------------------------------------------
    ellipsoid('Bald ink head', tuple(HC), tuple(HR), 'ink', seg=48, rings=24)

    # --- Long down-curved graphite beak with a stolen hot chip crosswise near the tip -------------------
    _, bpath = sweep('Long curved beak', [(0.0, 0.245, 1.055), (0.0, 0.33, 1.05), (0.0, 0.42, 1.022), (0.0, 0.50, 0.968),
                                          (0.0, 0.555, 0.90), (0.0, 0.582, 0.835)],
                     [0.04, 0.034, 0.025, 0.017, 0.011, 0.0078], ['beak'], n=24, per=12, flat=0.9, up=(0, 0, 1))
    ellipsoid('Beak tip', tuple(bpath[-1]), (0.008, 0.008, 0.008), 'beak', seg=12, rings=6)
    for sx in (1, -1):
        tube(f'Nostril slit {sx:+d}', [(0.029 * sx, 0.335, 1.07), (0.025 * sx, 0.37, 1.06)], 0.0035, 'ink', bres=2)
    tipc = bpath[int(len(bpath) * 0.86)]
    box('Stolen hot chip in beak', (tipc.x + 0.012, tipc.y + 0.002, tipc.z - 0.004), (0.13, 0.018, 0.018), 'chip',
        rot=(0.0, 0.22, 0.12), bev=0.004)

    # --- Pink gape grin (lopsided, curling up on its right) -------------------------------------------
    for name, pts in (('Pink gape grin right', [(0.032, 1.04), (0.056, 1.03), (0.078, 1.036), (0.094, 1.054), (0.1, 1.07)]),
                      ('Pink gape grin left', [(-0.032, 1.04), (-0.056, 1.032), (-0.078, 1.035)])):
        tube(name, [tuple(head_pt(x, z, 0.002)[0]) for x, z in pts], [0.005, 0.006, 0.006, 0.0055, 0.004][:len(pts)], 'pink', bres=3)

    # --- Big googly eyes: right wide with a raised brow, left half-lidded; pupils glancing to its right ----
    for sx, big in ((1, 1.08), (-1, 1.0)):
        p, n = head_pt(0.061 * sx, 1.12)
        nf = (n * 0.45 + Vector((0, 1, 0)) * 0.55).normalized()
        fr = empty(f'Eye frame {sx:+d}', tuple(p - n * 0.016)); fr.rotation_euler = nf.to_track_quat('Y', 'Z').to_euler()
        ellipsoid(f'Googly eye white {sx:+d}', (0, 0, 0), (0.058 * big, 0.04 * big, 0.068 * big), 'eye', parent=fr)
        ellipsoid(f'Amber iris {sx:+d}', (0.02, 0.026 * big, -0.007), (0.033, 0.018, 0.04), 'iris', parent=fr, seg=24, rings=12)
        ellipsoid(f'Big ink pupil {sx:+d}', (0.025, 0.035 * big, -0.008), (0.022, 0.014, 0.028), 'ink', parent=fr, seg=24, rings=12)
        ellipsoid(f'Eye highlight big {sx:+d}', (0.012, 0.045 * big, 0.015), (0.011, 0.008, 0.012), 'eye', parent=fr, seg=12, rings=6)
        ellipsoid(f'Eye highlight small {sx:+d}', (0.036, 0.042 * big, -0.024), (0.006, 0.005, 0.006), 'eye', parent=fr, seg=10, rings=6)
        if sx < 0:
            lid = empty('Lid frame left (cheeky half-lid)', (0, 0, 0), (0, -0.32, 0), parent=fr)
            ellipsoid('Cheeky half-lid left', (0, 0.002, 0.04), (0.062, 0.0435, 0.034), 'ink', parent=lid)
        else:
            tube('Raised brow right', [(-0.044, 0.022, 0.072), (-0.005, 0.03, 0.095), (0.04, 0.025, 0.086)], [0.008, 0.011, 0.006], 'ink', parent=fr, bres=4)

    # --- Floppy banana-peel hat: three long flaps drooping over the sides and back, face left clear -----
    top = sph(0.0, 0.0, 1.0)
    ellipsoid('Banana peel cap', tuple(top + Vector((0, 0, 0.006))), (0.04, 0.04, 0.028), 'peel', seg=24, rings=12)
    cyl('Banana peel stem', tuple(top + Vector((0.003, -0.004, 0.042))), 0.014, 0.01, 0.045, 'peel', rot=(0.2, 0.1, 0), seg=12, bev=0.002)
    ellipsoid('Banana peel stem tip', tuple(top + Vector((0.007, -0.01, 0.066))), (0.012, 0.012, 0.008), 'brown', seg=12, rings=6)
    for k, (phi, th_end, curl) in enumerate(((98, 1.78, 0.03), (172, 1.62, 0.028), (252, 1.9, 0.034), (134, 1.2, 0.02))):
        ph = math.radians(phi); h = Vector((math.sin(ph), math.cos(ph), 0))
        pts = [tuple(top + Vector((0, 0, 0.014)) + h * 0.004)] + [tuple(sph(t * th_end, ph, 1.07)) for t in (0.22, 0.45, 0.68, 0.86, 1.0)]
        P = Vector(pts[-1]); pts += [tuple(P + h * curl * 0.6 + Vector((0, 0, -0.018))), tuple(P + h * curl * 1.3 + Vector((0, 0, -0.022)))]
        flap, pp = ribbon(f'Banana peel flap {k}', pts, [(0.0, 0.032), (0.25, 0.088), (0.6, 0.078), (0.88, 0.046), (1.0, 0.02)],
                       HC, ['peel', 'peelin', 'brown', 'brown'], thick=0.006, tip_from=0.9)
        for j, u in enumerate((0.4, 0.62)):
            i = int(u * (len(pp) - 1)); q = pp[i]; out = (q - HC).normalized(); T = (pp[i + 1] - pp[i - 1]).normalized()
            hp, hn = surface_on(flap, q + out * 0.08 + T.cross(out).normalized() * 0.008 * (1 if j else -1), -out, off=0.0006, evaluated=True)
            fr = empty(f'Banana speckle frame {k} {j}', tuple(hp))
            fr.rotation_euler = hn.to_track_quat('Z', 'Y').to_euler()
            ellipsoid(f'Banana speckle {k} {j}', (0, 0, 0), (0.007, 0.0055, 0.0025), 'brown', parent=fr, seg=12, rings=6)
    # --- Turn and tilt the whole head group on the neck top pivot ---------------------------------------
    piv = empty('Head turn pivot', tuple(PIVOT))
    bpy.context.view_layer.update()
    inv = piv.matrix_world.inverted()
    for ob in PARTS[head_parts_start:]:
        if ob.parent is None:
            ob.parent = piv; ob.matrix_parent_inverse = inv
    for ob in list(bpy.data.collections[MASTER].objects):
        if ob.type == 'EMPTY' and ob.parent is None and ob.name.startswith(('Eye frame', 'Banana speckle frame')):
            ob.parent = piv; ob.matrix_parent_inverse = inv
    piv.rotation_euler = (0.0, HEAD_ROLL, HEAD_YAW)

    for ob in PARTS: ob['work_order'] = 'WO111'; ob['asset_id'] = 'bin-chicken'

def measure(objs=None):
    dg = bpy.context.evaluated_depsgraph_get(); lo = [1e9] * 3; hi = [-1e9] * 3; tris = 0; per = {}
    for ob in (objs or [o for o in bpy.data.collections[MASTER].objects]):
        if ob.type not in ('MESH', 'CURVE'): continue
        ev = ob.evaluated_get(dg); me = ev.to_mesh(); top = -1e9
        for vtx in me.vertices:
            w = ev.matrix_world @ vtx.co; top = max(top, w.z)
            for k in range(3): lo[k] = min(lo[k], w[k]); hi[k] = max(hi[k], w[k])
        me.calc_loop_triangles(); tris += len(me.loop_triangles); ev.to_mesh_clear(); per[ob.name] = top
    return {'min': [round(x, 4) for x in lo], 'max': [round(x, 4) for x in hi],
            'size': [round(hi[k] - lo[k], 4) for k in range(3)], 'blockout_triangles': tris}, per

TOP_KEYS = ('Banana peel stem tip', 'Banana peel flap', 'Bald ink head', 'Googly eye white', 'Striped paper chip cone',
            'Stolen loot chip', 'Grubby white egg body', 'Long curved beak')

if __name__ == '__main__':
    sc = bpy.context.scene
    assert sc.get('asset_id') == 'bin-chicken' and sc.get('scene_lease') == 'active'
    build(); bpy.context.view_layer.update()
    m, per = measure()
    tops = {k.strip(): round(max(v for n, v in per.items() if n.startswith(k)), 4) for k in TOP_KEYS}
    lows = {}
    dg = bpy.context.evaluated_depsgraph_get()
    beak = bpy.data.objects['Long curved beak'].evaluated_get(dg); me = beak.to_mesh()
    tip = max((beak.matrix_world @ v.co for v in me.vertices), key=lambda w: w.y); beak.to_mesh_clear()
    sc['blockout_bounds_m'] = json.dumps(m); sc['blockout_tops_m'] = json.dumps(tops)
    path = ROOT / 'bin-chicken-blockout.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(path), compress=True)
    rec = {'saved': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bounds_blender_zup': m, 'feature_tops_m': tops,
           'beak_forward_tip_m': [round(tip.x, 4), round(tip.y, 4), round(tip.z, 4)],
           'parts': len(PARTS), 'materials': sorted(x.name for x in bpy.data.materials),
           'utc': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    (ROOT / 'blockout-measurements.json').write_text(json.dumps(rec, indent=2) + '\n')
    print(json.dumps(rec))
