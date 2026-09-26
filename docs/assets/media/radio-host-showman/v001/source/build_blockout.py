"""WO111 radio-host-showman v001: painted flat-colour BLOCKOUT for a Blender reference sheet.

Reference-sheet stage only: primitive/curve/lathe forms, no final topology, no rig, no atlas, no GLB.
Blender +Z up, character faces +Y (exports later as glTF +Y up / -Z forward), floor-centred at the origin.
Character right = +X. All dimensions in metres. Helpers adapted from the demon-band-idol v001 blockout.

Design: World A chapter 4 (ages 9-11, the Rat Casino after-hours chapter) optional BONUS encounter. An original,
clean parody of the era's dapper vintage radio-host showman: a tall, lanky, friendly master of ceremonies about
2.0 m to the tips of his hair tufts. Slicked auburn hair with two small curled tufts on top, a huge permanent
showman grin with a smooth tooth band, big friendly eyes and high arched brows, rosy cheeks. Red-and-cream
candy-stripe jacket with a black shawl collar, a big black bow tie on a white shirt, a honey pocket square and a
tiny cathedral-radio lapel pin, slim black trousers with a red side stripe, cream-and-black spectator shoes and
white showman gloves. Right hand plants a tall black cane topped by an old-time silver broadcast microphone in a
brass yoke with a little red on-air bulb; left hand is raised in an open-palm "welcome, folks!" wave.
Never demonic: no horns, antlers, sharp teeth, red eyes or shadows; the tufts are soft hair curls.
"""
import bpy, bmesh, math, json, hashlib, datetime
from mathutils import Vector, Matrix
from pathlib import Path

ROOT = Path('/workspace/haynes-quest/family-eras/radio-host-showman/v001')
MASTER = 'Radio host showman blockout (master)'

PAL = {
    'red': '#c0463e', 'cream': '#f3e6cf', 'ink': '#2a2230', 'hair': '#6f2f32', 'hairtip': '#3a2230',
    'skin': '#efc9a4', 'skinlo': '#e0a98a', 'white': '#fbf6ec', 'silver': '#c9ccd6', 'grille': '#7d8196',
    'brass': '#dca953', 'mouth': '#4a2537', 'tongue': '#e8909f', 'cheek': '#e89a8f', 'pupil': '#342c46',
    'bulb': '#d9463d',
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
    m = bpy.data.materials.new('RHS ' + key + ' ' + PAL[key]); m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = lin(PAL[key]); bs.inputs['Roughness'].default_value = 0.9
    bs.inputs['Specular IOR Level'].default_value = 0.14
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

def along(ob, a, b):
    """Orient an object whose local Z is its axis from point a toward b, centred between them."""
    a = Vector(a); b = Vector(b); ob.location = (a + b) / 2
    ob.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler(); return ob

def box(name, loc, s, key, rot=(0, 0, 0), parent=None, bev=0.012, seg=3):
    me = bpy.data.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bm.to_mesh(me); bm.free()
    for v in me.vertices: v.co = Vector((v.co.x * s[0], v.co.y * s[1], v.co.z * s[2]))
    ob = link(name, me, mat(key), parent, smooth=False); ob.location = loc; ob.rotation_euler = rot
    if bev: bevel(ob, bev, seg)
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

def lathe(name, profile, mats, a=(0, 0, 0), b=None, ey=1.0, n=48, parent=None, band=None, dense=True, step=0.008):
    """Surface of revolution along local Z from a (towards b if given).
    band(t_frac, face_index, n) -> material index; face i spans angles [i, i+1] * 360/n measured from local +X."""
    prof = smooth_profile(profile, step) if dense else profile
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
            idx.append(band(tm, i, n) if band else 0)
    faces.append(tuple(range(n - 1, -1, -1))); idx.append(idx[0] if idx else 0)
    faces.append(tuple((rings - 1) * n + i for i in range(n))); idx.append(idx[-1] if idx else 0)
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    for p, k in zip(me.polygons, idx): p.material_index = k
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
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
    """Tube along a Catmull-Rom path with rotation-minimising frames; band(u, j, n) -> material index per face
    (u along the path, j around it). flat scales the cross-section along the frame axis nearest `up` (1 = round)."""
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
            faces.append((i * n + j, i * n + (j + 1) % n, (i + 1) * n + (j + 1) % n, (i + 1) * n + j)); idx.append(band(um, j, n) if band else 0)
    faces.append(tuple(range(n - 1, -1, -1))); idx.append(idx[0])
    faces.append(tuple((m - 1) * n + j for j in range(n))); idx.append(idx[-1])
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    for p, k in zip(me.polygons, idx): p.material_index = k
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    ob = link(name, me, [mat(k) for k in mats], parent); return ob, path

def tube(name, pts, radii, key, parent=None, res=4, bres=6, cyclic=False):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 1.0; cu.bevel_resolution = bres
    cu.use_fill_caps = True; cu.resolution_u = res
    sp = cu.splines.new('NURBS'); sp.points.add(len(pts) - 1); sp.order_u = min(4, len(pts)); sp.use_endpoint_u = not cyclic
    sp.use_cyclic_u = cyclic
    rr = radii if isinstance(radii, (list, tuple)) else [radii] * len(pts)
    for p, (x, y, z), r in zip(sp.points, pts, rr): p.co = (x, y, z, 1.0); p.radius = r
    ob = link(name, cu, mat(key), parent); return ob

def frame(y_axis, z_hint, origin=(0, 0, 0)):
    """World matrix whose local +Y is y_axis and local +Z is as close to z_hint as possible."""
    Y = Vector(y_axis).normalized(); Z = Vector(z_hint); Z = (Z - Z.dot(Y) * Y).normalized(); X = Y.cross(Z)
    M = Matrix((X, Y, Z)).transposed().to_4x4(); M.translation = Vector(origin); return M

def prism(name, pts, thick, key, M=None, parent=None, bev=0.0):
    """Flat 2-D shape pts[(x, z)] extruded along local Y (thickness centred), fan-triangulated from its centroid."""
    n = len(pts); cx = sum(p[0] for p in pts) / n; cz = sum(p[1] for p in pts) / n; h = thick / 2
    verts = [(cx, -h, cz), (cx, h, cz)] + [(x, -h, z) for x, z in pts] + [(x, h, z) for x, z in pts]
    faces = []
    for i in range(n):
        j = (i + 1) % n
        faces += [(0, 2 + j, 2 + i), (1, 2 + n + i, 2 + n + j), (2 + i, 2 + j, 2 + n + j, 2 + n + i)]
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    ob = link(name, me, mat(key), parent, smooth=False)
    if M is not None: ob.matrix_world = M
    if bev: bevel(ob, bev, 2)
    return ob

def ellipse_pts(rx, rz, cx=0.0, cz=0.0, n=28, rot=0.0):
    out = []
    for k in range(n):
        t = math.tau * k / n; x = rx * math.cos(t); z = rz * math.sin(t)
        out.append((cx + x * math.cos(rot) - z * math.sin(rot), cz + x * math.sin(rot) + z * math.cos(rot)))
    return out

def ray_hit(targets, origin, direction):
    """Nearest hit on any of the target objects (world space). Returns (point, normal) or None."""
    best = None; o_w = Vector(origin); d_w = Vector(direction).normalized()
    dg = bpy.context.evaluated_depsgraph_get()
    for t in targets:
        mw = t.matrix_world; inv = mw.inverted()
        o = inv @ o_w; d = (inv.to_3x3() @ d_w).normalized()
        hit, loc, nrm, _ = t.evaluated_get(dg).ray_cast(o, d) if t.modifiers else t.ray_cast(o, d)
        if not hit: continue
        pw = mw @ loc; dist = (pw - o_w).length
        if best is None or dist < best[0]:
            best = (dist, pw, (inv.transposed().to_3x3() @ nrm).normalized())
    return None if best is None else (best[1], best[2])

def _proj_axes(D):
    D = Vector(D).normalized(); R = Vector((1, 0, 0)); R = (R - R.dot(D) * D).normalized()
    U = Vector((0, 0, 1)); U = (U - U.dot(D) * D - U.dot(R) * R).normalized(); return D, R, U

def decal(name, targets, D, center, pts, off, thick, key, parent=None):
    """Paint-like raised decal: 2-D outline pts[(a, b)] around `center`, projected along direction D onto targets.
    a runs along world X (projected off D), b along world Z. Top face sits off+thick above the surface."""
    bpy.context.view_layer.update()
    D, R, U = _proj_axes(D); C = Vector(center)
    n = len(pts); ca = sum(p[0] for p in pts) / n; cb = sum(p[1] for p in pts) / n
    ring = [(ca, cb)] + list(pts); top = []; bot = []
    for a, b in ring:
        h = ray_hit(targets, C - D * 0.35 + R * a + U * b, D)
        assert h is not None, (name, a, b)
        p, nr = h; top.append(tuple(p + nr * (off + thick))); bot.append(tuple(p + nr * (off - 0.003)))
    verts = top + bot; m = n + 1; faces = []
    for i in range(1, n + 1):
        j = 1 + (i % n)
        faces += [(0, i, j), (m, m + j, m + i), (i, m + i, m + j, j)]
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    return link(name, me, mat(key), parent, smooth=False)

def surf_line(name, targets, D, center, pts, off, radius, key):
    """A painted line (tube) laid on the surface: pts[(a, b)] projected like decal()."""
    bpy.context.view_layer.update()
    D, R, U = _proj_axes(D); C = Vector(center); out = []
    for a, b in pts:
        h = ray_hit(targets, C - D * 0.35 + R * a + U * b, D); assert h is not None, (name, a, b)
        out.append(tuple(h[0] + h[1] * off))
    return tube(name, out, radius, key, bres=3)

def surf_strip(name, targets, D, center, inner, outer, off, thick, key, rows=4):
    """A ribbon laid on the surface between two projected 2-D polylines (same length), with real thickness.
    Each inner/outer pair is split into `rows` projected steps so wide strips follow the curvature (no chord dips)."""
    bpy.context.view_layer.update()
    D, R, U = _proj_axes(D); C = Vector(center); verts = []
    for (a0, b0), (a1, b1) in zip(inner, outer):
        for r in range(rows + 1):
            f = r / rows; a = a0 + (a1 - a0) * f; b = b0 + (b1 - b0) * f
            h = ray_hit(targets, C - D * 0.35 + R * a + U * b, D); assert h is not None, (name, a, b)
            verts.append(tuple(h[0] + h[1] * off))
    m = rows + 1
    faces = [(i * m + r, i * m + r + 1, (i + 1) * m + r + 1, (i + 1) * m + r) for i in range(len(inner) - 1) for r in range(rows)]
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    ob = link(name, me, mat(key))
    so = ob.modifiers.new('Strip thickness', 'SOLIDIFY'); so.thickness = thick; so.offset = 0.0
    return ob

def clear_scene():
    if bpy.context.object and bpy.context.object.mode != 'OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    for coll in list(bpy.data.collections): bpy.data.collections.remove(coll)
    for blocks in (bpy.data.meshes, bpy.data.curves, bpy.data.armatures, bpy.data.materials, bpy.data.actions,
                   bpy.data.cameras, bpy.data.lights, bpy.data.images, bpy.data.linestyles, bpy.data.worlds):
        for b in list(blocks): blocks.remove(b)
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)

# --- Key dimensions ---------------------------------------------------------------------------------
HEAD_A = Vector((0.0, 0.012, 1.500)); HEAD_B = Vector((0.0, 0.012, 1.880))   # chin to crown
HEAD = [(0.0, 0.0), (0.012, 0.05), (0.035, 0.095), (0.07, 0.13), (0.12, 0.153), (0.18, 0.161), (0.24, 0.158),
        (0.29, 0.142), (0.33, 0.112), (0.36, 0.07), (0.38, 0.0)]
HEAD_EY = 0.90
HEAD_C = Vector((0.0, 0.006, 1.700))                                            # hair-cap ray centre
PIVOT = Vector((0.0, 0.0, 1.49))                                                # head/neck pivot
HEAD_ROLL = math.radians(4.0)                                                   # a showman's tilt toward the mic
HEAD_SCALE = 1.08                                                               # a slightly bigger cartoon head, scaled about the neck pivot
MS = 1.35                                                                       # microphone scale: the key prop must read at play distance
TORSO_A = Vector((0.0, 0.0, 0.800)); TORSO_B = Vector((0.0, 0.0, 1.490))
TORSO = [(0.0, 0.172), (0.05, 0.166), (0.14, 0.150), (0.20, 0.148), (0.30, 0.160), (0.42, 0.182), (0.52, 0.19),
         (0.58, 0.188), (0.62, 0.17), (0.655, 0.125), (0.675, 0.08), (0.69, 0.05)]
TORSO_EY = 0.70
STRIPES = lambda i: ((i + 2) // 4) % 2        # 4-face candy stripes, mirror-symmetric about the YZ plane (n = 96)
FRONT = (0, -1, 0); BACK = (0, 1, 0)           # projection directions: rays travel from the front (+Y) or back (-Y)
CANE_P0 = Vector((0.530, 0.190, 0.0014)); CANE_P1 = Vector((0.455, 0.130, 1.400))   # cane tip on the floor, shaft top

def build():
    clear_scene()
    coll = bpy.data.collections.new(MASTER); bpy.context.scene.collection.children.link(coll)
    sc = bpy.context.scene; sc.unit_settings.system = 'METRIC'; sc.unit_settings.scale_length = 1.0

    # --- Cream-and-black spectator shoes, toes turned out -------------------------------------------------
    for side, sx in (('right', 1), ('left', -1)):
        f = empty(f'Spectator shoe frame {side}', (0.112 * sx, 0.035, 0.0), (0, 0, math.radians(-12 * sx)))
        box(f'Spectator shoe sole {side}', (0, 0.032, 0.012), (0.106, 0.30, 0.024), 'ink', parent=f, bev=0.01)
        box(f'Spectator shoe cream upper {side}', (0, 0.018, 0.058), (0.096, 0.25, 0.072), 'cream', parent=f, bev=0.03)
        ellipsoid(f'Spectator shoe black toe cap {side}', (0, 0.112, 0.046), (0.053, 0.072, 0.042), 'ink', parent=f, seg=28, rings=14)
        box(f'Spectator shoe black heel {side}', (0, -0.086, 0.058), (0.099, 0.075, 0.076), 'ink', parent=f, bev=0.022)
        for k in range(3):
            box(f'Spectator shoe lace {side} {k}', (0, 0.05 - 0.026 * k, 0.094 + 0.006 * k), (0.046, 0.008, 0.007), 'ink', parent=f,
                rot=(math.radians(-20), 0, 0), bev=0.002)

    # --- Slim black trousers with a red showman side stripe -------------------------------------------------
    for side, sx in (('right', 1), ('left', -1)):
        pts = [(0.085 * sx, 0.0, 0.93), (0.092 * sx, 0.01, 0.62), (0.101 * sx, 0.02, 0.33), (0.108 * sx, 0.026, 0.11)]
        rr = [0.068, 0.061, 0.055, 0.060]
        sweep(f'Black trouser leg {side}', pts, rr, ['ink'], n=28, per=10)
        stripe = [(x + sx * r * 0.965, y, z) for (x, y, z), r in zip(pts, rr)]
        tube(f'Red trouser side stripe {side}', stripe[:-1] + [(stripe[-1][0], stripe[-1][1], 0.125)], 0.0085, 'red', bres=3)
        cyl(f'Trouser cuff {side}', (0.108 * sx, 0.026, 0.118), 0.062, 0.061, 0.03, 'ink', bev=0.004)
    ellipsoid('Black trouser seat', (0.0, -0.01, 0.868), (0.152, 0.1, 0.082), 'ink')

    # --- Red-and-cream candy-stripe jacket with a black shawl collar ---------------------------------------
    torso = lathe('Candy-stripe jacket body', TORSO, ['red', 'cream'], a=tuple(TORSO_A), ey=TORSO_EY, n=96,
                  band=lambda t, i, n: STRIPES(i))
    bpy.context.view_layer.update()
    decal('White shirt front', [torso], FRONT, (0, 0.3, 0), [(-0.072, 1.47), (0.072, 1.47), (0.0, 1.125)], 0.0, 0.004, 'white')
    K = 18
    for side, sx in (('right', 1), ('left', -1)):
        inner = []; outer = []
        for k in range(K + 1):
            t = 0.06 + 0.94 * k / K
            ix = 0.072 * (1 - t) * sx; iz = 1.47 - 0.345 * t
            w = 0.032 + 0.024 * math.sin(math.pi * min(1.0, t * 1.05))
            inner.append((ix, iz)); outer.append((ix + sx * w * 0.975, iz - w * 0.22))
        surf_strip(f'Black shawl lapel {side}', [torso], FRONT, (0, 0.3, 0), inner, outer, 0.007, 0.011, 'ink')
    ring = []
    for k in range(15):                                      # collar band behind the neck, front ends meet the lapels
        a = math.radians(55 - 290 * k / 14)
        ring.append((0.083 * math.cos(a), 0.066 * math.sin(a) - 0.004, 1.468 + 0.01 * math.cos(a) ** 2))
    tube('Black shawl collar band', ring, 0.019, 'ink', bres=4)
    for k, z in enumerate((1.078, 1.004)):
        h = ray_hit([torso], (0.0, 0.6, z), FRONT)
        ellipsoid(f'Brass jacket button {k}', tuple(h[0] + h[1] * 0.006), (0.018, 0.009, 0.018), 'brass', seg=20, rings=10)
    cut = [(0.085 * (1 - k / 10) ** 0.7, 0.806 + 0.149 * k / 10) for k in range(11)]          # rounded morning-coat cutaway
    decal('Jacket cutaway opening', [torso], FRONT, (0, 0.3, 0), [(-x, z) for x, z in cut[::-1]] + cut[1:], 0.0, 0.004, 'ink')
    # honey pocket square on his left chest, with a black pocket welt
    h = ray_hit([torso], (-0.126, 0.6, 1.272), FRONT); p, nr = h
    box('Black pocket welt', (0, 0, 0), (0.078, 0.008, 0.012), 'ink', bev=0.003).matrix_world = frame(nr, (0, 0, 1), p + nr * 0.004)
    puff = [(-0.034, 0.0), (0.034, 0.0), (0.033, 0.016), (0.022, 0.036), (0.01, 0.022), (-0.004, 0.031), (-0.02, 0.028), (-0.032, 0.014)]   # soft two-peak fold
    prism('Honey pocket square', puff, 0.01, 'brass', M=frame(nr, (0, 0, 1), p + nr * 0.008 + Vector((0, 0, 0.004))), bev=0.002)
    # tiny cathedral-radio lapel pin on his right lapel
    h = ray_hit([torso], (0.067, 0.6, 1.335), FRONT); p, nr = h
    arch = [(-0.017, -0.02), (0.017, -0.02)] + [(0.017 * math.cos(math.radians(a)), 0.017 * math.sin(math.radians(a))) for a in range(0, 181, 20)]
    prism('Cathedral-radio lapel pin', arch, 0.008, 'brass', M=frame(nr, (0, 0, 1), p + nr * 0.024), bev=0.0015)
    ellipsoid('Lapel pin speaker', tuple(p + nr * 0.029 + Vector((0, 0, 0.002))), (0.008, 0.003, 0.008), 'ink', seg=12, rings=6)
    # back: vintage half-belt with two brass buttons and a centre vent
    h = ray_hit([torso], (0.0, -0.6, 1.0), BACK); p, nr = h
    box('Black back half-belt', (0, 0, 0), (0.19, 0.012, 0.036), 'ink', bev=0.005).matrix_world = frame(nr, (0, 0, 1), p + nr * 0.006)
    for sx in (1, -1):
        hb = ray_hit([torso], (0.075 * sx, -0.6, 1.0), BACK)
        ellipsoid(f'Brass half-belt button {sx:+d}', tuple(hb[0] + hb[1] * 0.016), (0.014, 0.007, 0.014), 'brass', seg=16, rings=8)
    surf_line('Jacket back vent', [torso], BACK, (0, -0.3, 0), [(0.0, 0.81), (0.0, 0.88), (0.0, 0.965)], 0.003, 0.0045, 'ink')

    # --- Neck, white shirt collar, big black bow tie -------------------------------------------------------
    cyl('Neck', (0.0, 0.006, 1.505), 0.05, 0.05, 0.11, 'skin', bev=0)
    cyl('White shirt collar', (0.0, 0.004, 1.492), 0.074, 0.068, 0.062, 'white', scale=(1, 0.9, 1), bev=0.004)
    for sx in (1, -1):
        prism(f'Shirt collar point {sx:+d}', [(0.0, 0.0), (0.048 * sx, 0.004), (0.016 * sx, -0.042)], 0.01, 'white',
              M=frame((0.18 * sx, 1, -0.25), (0, 0, 1), (0.006 * sx, 0.066, 1.482)), bev=0.002)
    B = ray_hit([torso], (0.0, 0.6, 1.452), FRONT)[0] + Vector((0.0, 0.02, 0.0))
    for sx in (1, -1):
        wing = []
        for k in range(36):
            t = math.tau * k / 36; x = 0.06 + 0.052 * math.cos(t)
            z = (0.017 + 0.031 * (1 + math.cos(t)) / 2) * math.sin(t)
            wing.append((x * sx, z))
        prism(f'Black bow tie wing {"right" if sx > 0 else "left"}', wing, 0.036, 'ink',
              M=frame((0.12 * sx, 1, 0), (0, 0, 1), B), bev=0.008)
    box('Black bow tie knot', tuple(B + Vector((0, 0.012, 0))), (0.036, 0.04, 0.044), 'ink', bev=0.012)

    # --- Arms: striped sleeves with black cuffs and white showman gloves -----------------------------------
    sleeve_band = lambda u, j, n: 2 if u > 0.9 else ((j + 2) // 4) % 2
    arms = {'right': [(0.17, 0.0, 1.40), (0.27, 0.02, 1.31), (0.345, 0.045, 1.20), (0.40, 0.09, 1.11), (0.445, 0.125, 1.068)],
            'left': [(-0.17, 0.0, 1.40), (-0.28, 0.012, 1.315), (-0.38, 0.032, 1.25), (-0.465, 0.07, 1.315), (-0.503, 0.095, 1.412)]}
    for side, pts in arms.items():
        sweep(f'Candy-stripe sleeve {side}', pts, [0.064, 0.059, 0.055, 0.051, 0.049], ['red', 'cream', 'ink'], band=sleeve_band, n=32, per=10)
        a = Vector(pts[-2]); b = Vector(pts[-1]); d = (b - a).normalized()
        along(cyl(f'White glove cuff {side}', (0, 0, 0), 0.047, 0.06, 0.05, 'white', bev=0.004), b - d * 0.005, b + d * 0.04)
    # right glove: fist around the cane
    d = (CANE_P1 - CANE_P0).normalized(); G = CANE_P0 + d * (1.03 / d.z)
    ellipsoid('White glove fist right (cane grip)', tuple(G), (0.05, 0.047, 0.058), 'white', rot=(0.25, -0.2, 0))
    ellipsoid('White glove thumb right', tuple(G + Vector((-0.02, 0.028, 0.03))), (0.017, 0.019, 0.026), 'white', rot=(0.5, 0.3, 0))
    # left glove: open palm raised in a welcome wave, palm to the audience
    wr = Vector(arms['left'][-1]); fd = (wr - Vector(arms['left'][-2])).normalized()
    PM = frame((0.08, 1, 0), fd, wr + fd * 0.07)
    X = PM.col[0].xyz; Z = PM.col[2].xyz; Yn = PM.col[1].xyz; Hc = PM.translation.copy()
    palm = ellipsoid('White glove waving palm left', (0, 0, 0), (1, 1, 1), 'white'); palm.matrix_world = PM @ Matrix.Diagonal((0.047, 0.023, 0.05, 1))
    for k, (ox, ang, ln) in enumerate(((-0.031, -24, 0.064), (-0.011, -8, 0.074), (0.01, 7, 0.072), (0.029, 21, 0.06))):
        fdir = (Z * math.cos(math.radians(ang)) + X * math.sin(math.radians(ang))).normalized()
        base = Hc + X * ox + Z * 0.032
        _, fp = sweep(f'Waving glove finger left {k}', [tuple(base), tuple(base + fdir * ln * 0.55 + Yn * 0.004), tuple(base + fdir * ln)],
                      [0.0145, 0.0135, 0.0125], ['white'], n=16, per=6)
        ellipsoid(f'Waving glove fingertip left {k}', tuple(fp[-1]), (0.0126, 0.0126, 0.0126), 'white', seg=12, rings=8)
    tdir = (X * 0.78 + Z * 0.5 + Yn * 0.25).normalized(); tb = Hc + X * 0.036 - Z * 0.012
    _, tp = sweep('Waving glove thumb left', [tuple(tb), tuple(tb + tdir * 0.03), tuple(tb + tdir * 0.052)], [0.016, 0.015, 0.013], ['white'], n=16, per=6)
    ellipsoid('Waving glove thumb tip left', tuple(tp[-1]), (0.013, 0.013, 0.013), 'white', seg=12, rings=8)
    for k in range(3):                                        # classic three stitched lines on the back of the glove
        o = Hc - Yn * 0.021 + X * (0.014 * (k - 1)) + Z * 0.004
        along(cyl(f'Glove back stitch {k}', (0, 0, 0), 0.0032, 0.0032, 0.045, 'ink', seg=8, bev=0), o - Z * 0.022, o + Z * 0.022)

    # --- Tall black mic cane with an old-time silver broadcast microphone ----------------------------------
    along(cyl('Black mic cane shaft', (0, 0, 0), 0.0155, 0.0145, (CANE_P1 - CANE_P0).length - 0.04, 'ink', seg=20, bev=0), CANE_P0 + d * 0.04, CANE_P1)
    along(cyl('Brass cane ferrule', (0, 0, 0), 0.016, 0.019, 0.05, 'brass', seg=20, bev=0.003), CANE_P0, CANE_P0 + d * 0.05)
    along(cyl('Brass cane collar', (0, 0, 0), 0.022, 0.02, 0.03, 'brass', seg=20, bev=0.003), CANE_P1 - d * 0.01, CANE_P1 + d * 0.02)
    MF = frame((0, 1, 0), d, CANE_P1); MX = MF.col[0].xyz
    Mc = CANE_P1 + d * 0.118 * MS
    mic_band = lambda t, i, n: 1 if (0.27 < t < 0.73 and int((t - 0.27) / 0.046) % 2 == 1) else 0
    capsule = lathe('Silver mic capsule', [(z * MS, r * MS) for z, r in [(0.0, 0.004), (0.006, 0.026), (0.02, 0.043), (0.04, 0.05), (0.12, 0.05),
                                                                          (0.14, 0.043), (0.154, 0.026), (0.16, 0.004)]],
                    ['silver', 'grille'], ey=0.72, n=48, band=mic_band, step=0.004)
    capsule.matrix_world = frame((0, 1, 0), d, Mc - d * 0.08 * MS)       # wide face to the audience, narrow in depth
    yoke = [CANE_P1 + (MX * 0.064 + d * 0.118) * MS, CANE_P1 + (MX * 0.068 + d * 0.06) * MS, CANE_P1 + (MX * 0.045 + d * 0.022) * MS, CANE_P1 + d * 0.014 * MS,
            CANE_P1 + (-MX * 0.045 + d * 0.022) * MS, CANE_P1 + (-MX * 0.068 + d * 0.06) * MS, CANE_P1 + (-MX * 0.064 + d * 0.118) * MS]
    tube('Brass mic yoke', [tuple(v) for v in yoke], 0.0085 * MS, 'brass', bres=3)
    for sx in (1, -1):
        ellipsoid(f'Brass yoke knob {sx:+d}', tuple(CANE_P1 + (MX * 0.064 * sx + d * 0.118) * MS), (0.015 * MS,) * 3, 'brass', seg=16, rings=8)
    ellipsoid('Red on-air bulb', tuple(Mc + d * 0.089 * MS), (0.017 * MS, 0.017 * MS, 0.019 * MS), 'bulb', seg=20, rings=10)

    head_parts_start = len(PARTS)
    # --- Head ------------------------------------------------------------------------------------------------
    head = lathe('Showman head', HEAD, ['skin'], a=tuple(HEAD_A), ey=HEAD_EY, n=64)
    bpy.context.view_layer.update()
    C0 = (0, 0.3, 0)                                                          # absolute (x, z) projection centre

    # Face: big friendly eyes, high arched brows, button nose, rosy cheeks, huge showman grin
    for sx in (1, -1):
        ex, ez = 0.057 * sx, 1.738
        decal(f'Eye white {sx:+d}', [head], FRONT, C0, ellipse_pts(0.034, 0.045, ex, ez), 0.0, 0.003, 'white')
        decal(f'Friendly pupil {sx:+d}', [head], FRONT, C0, ellipse_pts(0.02, 0.028, ex - 0.003 * sx, ez - 0.007), 0.003, 0.002, 'pupil')
        decal(f'Eye highlight {sx:+d}', [head], FRONT, C0, ellipse_pts(0.0072, 0.0072, ex - 0.009 * sx, ez + 0.002, n=12), 0.005, 0.0015, 'white')
        decal(f'Eye highlight dot {sx:+d}', [head], FRONT, C0, ellipse_pts(0.0035, 0.0035, ex + 0.004 * sx, ez - 0.02, n=10), 0.005, 0.0015, 'white')
        lid = [(ex + 0.036 * math.cos(math.radians(a)), ez + 0.047 * math.sin(math.radians(a))) for a in (8, 40, 70, 90, 110, 140, 172)]
        surf_line(f'Upper lid line {sx:+d}', [head], FRONT, C0, lid, 0.004, [0.003, 0.0045, 0.005, 0.005, 0.005, 0.0045, 0.003], 'pupil')
        brow = [(0.022 * sx, 1.797), (0.042 * sx, 1.815), (0.064 * sx, 1.821), (0.088 * sx, 1.806)]
        surf_line(f'High arched brow {sx:+d}', [head], FRONT, C0, brow, 0.004, [0.004, 0.0068, 0.0065, 0.0038], 'hairtip')
        decal(f'Rosy cheek {sx:+d}', [head], FRONT, C0, ellipse_pts(0.022, 0.014, 0.094 * sx, 1.679), 0.0, 0.002, 'cheek')
        surf_line(f'Grin dimple {sx:+d}', [head], FRONT, C0, [(0.112 * sx, 1.657), (0.127 * sx, 1.642), (0.123 * sx, 1.622)], 0.004,
                  [0.0028, 0.0042, 0.0026], 'mouth')
    hn = ray_hit([head], (0.0, 0.6, 1.668), FRONT)
    ellipsoid('Button nose', tuple(hn[0] + hn[1] * 0.004), (0.019, 0.014, 0.015), 'skinlo', seg=20, rings=10)
    GW = 0.118; MZ = 1.595                                                   # a huge grin, corners lifted toward the cheeks
    upper = lambda x: MZ + 0.010 + 0.036 * (x / GW) ** 2
    lower = lambda x: MZ + 0.046 - 0.093 * max(0.0, 1 - (x / GW) ** 2) ** 0.8
    xs = [GW * (-1 + 2 * k / 36) for k in range(37)]
    surf_strip('Huge showman grin', [head], FRONT, C0, [(x, upper(x)) for x in xs], [(x, lower(x)) for x in xs], 0.0015, 0.003, 'mouth')
    tx = [0.094 * (-1 + 2 * k / 24) for k in range(25)]
    surf_strip('Smooth tooth band', [head], FRONT, C0, [(x, upper(x) - 0.004) for x in tx],
               [(x, max(upper(x) - 0.027, lower(x) + 0.006)) for x in tx], 0.004, 0.0015, 'white')
    decal('Grin tongue', [head], FRONT, C0, ellipse_pts(0.038, 0.011, 0.0, MZ - 0.033), 0.003, 0.0015, 'tongue')
    for sx in (1, -1):
        ellipsoid(f'Ear {sx:+d}', (0.155 * sx, -0.004, 1.705), (0.026, 0.04, 0.052), 'skin', seg=24, rings=12)

    # Slicked hair cap, grown out of the head surface so its hairline follows the forehead, temples and nape
    th_max = lambda phi: math.radians(78.5 - 40 * math.cos(phi) + 6.5 * math.cos(2 * phi) + 32 * math.exp(-((abs(phi) - 1.30) / 0.13) ** 2))   # + sideburn tabs
    NP, NS = 128, 34; verts = []; faces = []
    for j in range(NS):
        s_ = j / NS
        for i in range(NP):
            phi = math.tau * i / NP - math.pi; th = th_max(phi) * (1 - s_)
            dvec = Vector((math.sin(th) * math.sin(phi), math.sin(th) * math.cos(phi), math.cos(th)))
            h = ray_hit([head], HEAD_C + dvec * 0.6, -dvec); assert h is not None, ('hair cap', i, j)
            off = 0.004 + 0.015 * min(1.0, s_ * 4) + 0.012 * max(0.0, math.cos(phi)) * math.sin(math.pi * min(1.0, s_ * 1.3))
            verts.append(tuple(h[0] + dvec * off))
    h = ray_hit([head], HEAD_C + Vector((0, 0, 0.6)), Vector((0, 0, -1))); verts.append(tuple(h[0] + Vector((0, 0, 0.019)))); pole = len(verts) - 1
    for j in range(NS - 1):
        for i in range(NP):
            a = j * NP + i; b = j * NP + (i + 1) % NP
            faces.append((a, a + NP, b + NP, b))
    for i in range(NP):
        faces.append(((NS - 1) * NP + i, pole, (NS - 1) * NP + (i + 1) % NP))
    me = bpy.data.meshes.new('Slicked hair cap'); me.from_pydata(verts, [], faces); me.update()
    cap = link('Slicked hair cap', me, mat('hair'))
    top_poly = me.polygons[len(me.polygons) - 1]
    if top_poly.normal.z < 0:                                                  # make the normals face outward
        bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.reverse_faces(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    so = cap.modifiers.new('Hair thickness', 'SOLIDIFY'); so.thickness = 0.012; so.offset = -1.0
    # two small tufts of hair: little bunches of soft tapered wisps springing up at the crown and flicking out and back.
    # Several strands per tuft keep them reading as hair (never horns or ears); the left tuft is a touch smaller.
    for side, sx, k_ in (('right', 1, 1.0), ('left', -1, 0.86)):
        R = Vector((0.04 * sx, -0.045 - 0.01 * (sx < 0), 1.866))
        strands = [
            ('main', [(0, 0, 0), (0.012, -0.012, 0.05), (0.035, -0.035, 0.085), (0.062, -0.056, 0.094)], [0.021, 0.018, 0.012, 0.005]),
            ('back', [(-0.01, -0.008, 0.0), (0.0, -0.03, 0.046), (0.01, -0.066, 0.066), (0.022, -0.094, 0.062)], [0.019, 0.016, 0.01, 0.0045]),
            ('flick', [(0.018, 0.006, -0.004), (0.04, 0.002, 0.03), (0.068, -0.012, 0.046)], [0.015, 0.011, 0.004]),
        ]
        for nm, rel, rr in strands:
            pts = [tuple(R + Vector((x * sx, y, z)) * k_) for x, y, z in rel]
            _, tp = sweep(f'Hair tuft {side} {nm} wisp', pts, [r * k_ for r in rr], ['hair'], n=20, per=10, flat=0.5, up=(0, 1, 0))
            ellipsoid(f'Hair tuft {side} {nm} wisp tip', tuple(tp[-1]), (rr[-1] * k_,) * 3, 'hair', seg=10, rings=6)

    # --- Tilt the whole head group on the neck pivot ----------------------------------------------------------
    piv = empty('Head tilt pivot', tuple(PIVOT))
    bpy.context.view_layer.update()
    inv = piv.matrix_world.inverted()
    for ob in PARTS[head_parts_start:]:
        if ob.parent is None:
            ob.parent = piv; ob.matrix_parent_inverse = inv
    piv.rotation_euler = (0.0, HEAD_ROLL, 0.0); piv.scale = (HEAD_SCALE,) * 3

    for ob in PARTS: ob['work_order'] = 'WO111'; ob['asset_id'] = 'radio-host-showman'

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

TOP_KEYS = ('Hair tuft', 'Slicked hair cap', 'Showman head', 'Red on-air bulb', 'Silver mic capsule',
            'White glove waving palm', 'Waving glove finger', 'Candy-stripe jacket body', 'Black bow tie wing', 'Black mic cane shaft')

if __name__ == '__main__':
    sc = bpy.context.scene
    assert sc.get('asset_id') == 'radio-host-showman' and sc.get('scene_lease') == 'active'
    build(); bpy.context.view_layer.update()
    m, per = measure()
    tops = {k.strip(): round(max(v for n, v in per.items() if n.startswith(k)), 4) for k in TOP_KEYS}
    sc['blockout_bounds_m'] = json.dumps(m); sc['blockout_tops_m'] = json.dumps(tops)
    sc['orientation'] = 'Blender +Z up/+Y forward; glTF +Y up/-Z forward; floor-centred origin; character right = +X'
    path = ROOT / 'radio-host-showman-blockout.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(path), compress=True)
    rec = {'saved': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bounds_blender_zup': m, 'feature_tops_m': tops,
           'parts': len(PARTS), 'materials': sorted(x.name for x in bpy.data.materials),
           'utc': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    (ROOT / 'blockout-measurements.json').write_text(json.dumps(rec, indent=2) + '\n')
    print(json.dumps(rec))
