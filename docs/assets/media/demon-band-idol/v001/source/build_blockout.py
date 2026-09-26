"""WO111 demon-band-idol v001: painted flat-colour BLOCKOUT for a Blender reference sheet.

Reference-sheet stage only: primitive/curve/lathe forms, no final topology, no rig, no atlas, no GLB.
Blender +Z up, character faces +Y (exports later as glTF +Y up / -Z forward), floor-centred at the origin.
Character right = +X. All dimensions in metres.

Design: World B chapter 3 ordinary (ages 4-6, the concert-stage chapter beside the Bickering Besties boss), serving
variants a and b. An original, clean and sparkly demon boy-band idol parody of the era's animated K-pop demon-band
craze, about 1.43 m to the tips of its horns. A cute lavender imp in a teal-and-gold stage jacket: side-swept swoopy
midnight hair with hot-pink tips, two little gold candy horns, pointy ears with one star earring, a big confident
wink and an open grin with star-shaped blush. A hot-pink sash crosses the jacket from its right shoulder to a bow at
its left hip, with a gold star brooch; gold epaulettes carry gold and pink sparkle stars and fringe. It holds a
silver stage microphone up beside its chin in its right hand, its left fist planted on its hip, weight on its right
leg, in chunky white high-tops. A short swallowtail on the jacket and a little spade-tipped tail finish the back.
"""
import bpy, bmesh, math, json, hashlib, datetime
from mathutils import Vector, Matrix
from pathlib import Path

ROOT = Path('/workspace/haynes-quest/family-eras/demon-band-idol/v001')
MASTER = 'Demon band idol blockout (master)'

PAL = {
    'skin': '#c9b6f0', 'skinlo': '#ad97e0', 'hair': '#2c2a5a', 'pink': '#ec4f93', 'blush': '#ff8fc0',
    'gold': '#f4c75b', 'jacket': '#1f7a86', 'trouser': '#2a2446', 'white': '#f7f3fb', 'silver': '#cfd3e6',
    'mouth': '#4a2548', 'eye': '#fbf8ff', 'iris': '#c2479a', 'ink': '#2c2a5a',
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
    m = bpy.data.materials.new('DBI ' + key + ' ' + PAL[key]); m.use_nodes = True
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
    """Surface of revolution along local Z from a (towards b if given); band(t_frac, angle_frac) -> material index."""
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

def star_pts(r_out, r_in, n=5, rot=0.0, cx=0.0, cz=0.0):
    out = []
    for k in range(2 * n):
        a = math.pi / 2 + rot + math.pi * k / n; r = r_out if k % 2 == 0 else r_in
        out.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return out

def sparkle_pts(r, e=3.0, samples=48, cx=0.0, cz=0.0):
    """Four-point sparkle (soft astroid) outline."""
    out = []
    for k in range(samples):
        t = math.tau * k / samples; c = math.cos(t); s = math.sin(t)
        out.append((cx + r * math.copysign(abs(c) ** e, c), cz + r * math.copysign(abs(s) ** e, s)))
    return out

def ellipse_pts(rx, rz, cx=0.0, cz=0.0, n=28, rot=0.0):
    out = []
    for k in range(n):
        t = math.tau * k / n; x = rx * math.cos(t); z = rz * math.sin(t)
        out.append((cx + x * math.cos(rot) - z * math.sin(rot), cz + x * math.sin(rot) + z * math.cos(rot)))
    return out

def sparkle(name, center, r, key, spin=0.0, thick=0.006):
    """Two crossed sparkle plates so the sparkle reads from the front, side and back."""
    c = Vector(center)
    prism(name + ' plate A', sparkle_pts(r), thick, key, M=frame((math.sin(spin), math.cos(spin), 0), (0, 0, 1), c))
    prism(name + ' plate B', sparkle_pts(r * 0.9), thick, key, M=frame((math.cos(spin), -math.sin(spin), 0), (0, 0, 1), c))

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

def decal(name, targets, D, center, pts, off, thick, key, parent=None):
    """Paint-like raised decal: 2-D outline pts[(a, b)] around `center`, projected along direction D onto targets.
    a runs along world X (projected off D), b along world Z. Top face sits off+thick above the surface."""
    bpy.context.view_layer.update()
    D = Vector(D).normalized(); R = Vector((1, 0, 0)); R = (R - R.dot(D) * D).normalized()
    U = Vector((0, 0, 1)); U = (U - U.dot(D) * D - U.dot(R) * R).normalized(); C = Vector(center)
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
    D = Vector(D).normalized(); R = Vector((1, 0, 0)); R = (R - R.dot(D) * D).normalized()
    U = Vector((0, 0, 1)); U = (U - U.dot(D) * D - U.dot(R) * R).normalized(); C = Vector(center); out = []
    for a, b in pts:
        h = ray_hit(targets, C - D * 0.35 + R * a + U * b, D); assert h is not None, (name, a, b)
        out.append(tuple(h[0] + h[1] * off))
    return tube(name, out, radius, key, bres=3)

def clear_scene():
    if bpy.context.object and bpy.context.object.mode != 'OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    for coll in list(bpy.data.collections): bpy.data.collections.remove(coll)
    for blocks in (bpy.data.meshes, bpy.data.curves, bpy.data.armatures, bpy.data.materials, bpy.data.actions,
                   bpy.data.cameras, bpy.data.lights, bpy.data.images, bpy.data.linestyles, bpy.data.worlds):
        for b in list(blocks): blocks.remove(b)
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)

# --- Key dimensions ---------------------------------------------------------------------------------
HEAD_A = Vector((0.0, 0.012, 0.975)); HEAD_B = Vector((0.0, 0.012, 1.255))   # chin to crown
HEAD = [(0.0, 0.0), (0.012, 0.042), (0.035, 0.078), (0.07, 0.108), (0.11, 0.126), (0.15, 0.131), (0.19, 0.127),
        (0.23, 0.108), (0.26, 0.072), (0.28, 0.0)]
HEAD_EY = 0.94
PIVOT = Vector((0.0, 0.0, 0.975))                                              # head/neck pivot
HEAD_ROLL = math.radians(6.0); HEAD_YAW = math.radians(-5.0)                  # tilted toward the mic, turned a touch to its right
HEAD_SCALE = 1.08                                                               # big cute idol head, scaled about the neck pivot
HEAD_DROP = 0.012                                                               # sits the head a little lower on the neck
TORSO_A = Vector((0.0, 0.0, 0.600)); TORSO_B = Vector((0.0, 0.0, 0.935))
TORSO = [(0.0, 0.100), (0.03, 0.104), (0.08, 0.107), (0.14, 0.118), (0.20, 0.133), (0.25, 0.141), (0.29, 0.134),
         (0.315, 0.108), (0.335, 0.055)]
TORSO_EY = 0.72
SHOULDER_R = Vector((0.150, 0.0, 0.870)); SHOULDER_L = Vector((-0.150, 0.0, 0.870))

def build():
    clear_scene()
    coll = bpy.data.collections.new(MASTER); bpy.context.scene.collection.children.link(coll)
    sc = bpy.context.scene; sc.unit_settings.system = 'METRIC'; sc.unit_settings.scale_length = 1.0
    FRONT = (0, -1, 0); BACK = (0, 1, 0)

    # --- Chunky white high-tops with hot-pink soles and laces ------------------------------------------
    for side, sx, loc, yaw in (('right', 1, (0.088, 0.022, 0.0), -8), ('left', -1, (-0.122, 0.040, 0.0), 22)):
        f = empty(f'Sneaker frame {side}', loc, (0, 0, math.radians(yaw)))
        box(f'Sneaker sole {side}', (0, 0.028, 0.016), (0.104, 0.214, 0.032), 'pink', parent=f, bev=0.012)
        box(f'Sneaker upper {side}', (0, 0.018, 0.064), (0.092, 0.176, 0.078), 'white', parent=f, bev=0.03)
        ellipsoid(f'Sneaker toe cap {side}', (0, 0.092, 0.05), (0.047, 0.05, 0.036), 'white', parent=f, seg=24, rings=12)
        cyl(f'Sneaker high-top collar {side}', (0, -0.012, 0.118), 0.052, 0.049, 0.07, 'white', parent=f, bev=0.006)
        cyl(f'Sneaker collar rim {side}', (0, -0.012, 0.155), 0.052, 0.052, 0.012, 'pink', parent=f, bev=0.003)
        for k in range(3):
            box(f'Sneaker lace {side} {k}', (0, 0.07 - 0.03 * k, 0.098 + 0.012 * k), (0.05, 0.009, 0.008), 'pink', parent=f,
                rot=(math.radians(-28), 0, 0), bev=0.002)
        ellipsoid(f'Sneaker star patch {side}', (0.047 * sx, 0.0, 0.066), (0.004, 0.022, 0.022), 'gold', parent=f, seg=16, rings=8)

    # --- Slim midnight stage trousers with a gold glitter side stripe; weight on the right leg ---------
    legs = {'right': [(0.068, 0.0, 0.585), (0.074, 0.012, 0.44), (0.08, 0.018, 0.30), (0.086, 0.012, 0.18), (0.088, 0.01, 0.105)],
            'left': [(-0.068, 0.0, 0.58), (-0.086, 0.022, 0.44), (-0.104, 0.042, 0.30), (-0.116, 0.036, 0.18), (-0.12, 0.034, 0.105)]}
    leg_r = [0.054, 0.05, 0.045, 0.043, 0.047]
    for side, pts in legs.items():
        sweep(f'Stage trouser leg {side}', pts, leg_r, ['trouser'], n=28, per=10)
        sx = 1 if side == 'right' else -1
        stripe = [(x + sx * (r * 0.93), y, z) for (x, y, z), r in zip(pts, leg_r)]
        tube(f'Gold glitter stripe {side}', stripe[:-1] + [(stripe[-1][0], stripe[-1][1], 0.13)], 0.009, 'gold', bres=3)
    ellipsoid('Stage trouser seat', (0.0, -0.004, 0.556), (0.112, 0.08, 0.075), 'trouser')

    # --- Cropped teal stage jacket with a gold hem; short gold-edged swallowtail at the back -----------
    torso = lathe('Teal stage jacket body', TORSO, ['jacket', 'gold'], a=tuple(TORSO_A), b=tuple(TORSO_B), ey=TORSO_EY, n=64,
                  band=lambda t, a: 1 if t < 0.05 else 0)
    for side, sx in (('right', 1), ('left', -1)):
        sweep(f'Swallowtail flap {side}', [(0.058 * sx, -0.072, 0.64), (0.068 * sx, -0.092, 0.57), (0.078 * sx, -0.102, 0.50), (0.085 * sx, -0.106, 0.445)],
              [0.036, 0.035, 0.025, 0.008], ['jacket', 'gold'], band=lambda u: 1 if u > 0.8 else 0, n=24, per=10, flat=0.28, up=(0, -1, 0))
    # white shirt V and gold lapel piping, projected onto the jacket front
    bpy.context.view_layer.update()
    decal('White shirt V', [torso], FRONT, (0, 0.2, 0.89), [(-0.044, 0.034), (0.044, 0.034), (0.0, -0.05)], 0.0, 0.004, 'white')
    for sx in (1, -1):
        surf_line(f'Gold lapel piping {sx:+d}', [torso], FRONT, (0, 0.2, 0.89), [(0.046 * sx, 0.03), (0.026 * sx, -0.006), (0.0, -0.056)], 0.006, 0.0065, 'gold')
    for k, z in enumerate((0.75, 0.70, 0.65)):          # clear of the sash on its right side
        h = ray_hit([torso], (0.062, 0.6, z), FRONT)
        ellipsoid(f'Gold jacket button {k}', tuple(h[0] + h[1] * 0.004), (0.011, 0.006, 0.011), 'gold', seg=16, rings=8)

    # --- Neck, gold stand-up collar -------------------------------------------------------------------
    cyl('Lavender neck', (0.0, 0.004, 0.955), 0.041, 0.039, 0.10, 'skin', bev=0)
    cyl('Gold stand-up collar', (0.0, 0.0, 0.93), 0.06, 0.054, 0.03, 'gold', scale=(1, 0.86, 1), bev=0.004)

    # --- Hot-pink sash from the right shoulder to a bow at the left hip, with a gold star brooch -------
    bpy.context.view_layer.update()
    C = Vector((0.0, 0.0, 0.765)); e1 = Vector((0.6, 0.0, 0.8)); e2 = Vector((0.0, 1.0, 0.0))
    pelvis = bpy.data.objects['Stage trouser seat']; pts = []; nrms = []
    for i in range(96):
        th = math.tau * i / 96; d = (math.cos(th) * e1 + math.sin(th) * e2).normalized()
        h = ray_hit([torso, pelvis], C + d * 0.6, -d); assert h is not None, ('sash', i)
        pts.append(h[0]); nrms.append(h[1])
    for _ in range(3):
        pts = [(pts[i - 1] + 2 * pts[i] + pts[(i + 1) % 96]) / 4 for i in range(96)]
        nrms = [(nrms[i - 1] + 2 * nrms[i] + nrms[(i + 1) % 96]).normalized() for i in range(96)]
    verts = []; W = 0.068
    for i in range(96):
        t = (pts[(i + 1) % 96] - pts[i - 1]).normalized(); b = t.cross(nrms[i]).normalized(); p = pts[i] + nrms[i] * 0.006
        verts += [tuple(p - b * W / 2), tuple(p + b * W / 2)]
    faces = [(2 * i, 2 * i + 1, 2 * ((i + 1) % 96) + 1, 2 * ((i + 1) % 96)) for i in range(96)]   # outward normals
    me = bpy.data.meshes.new('Hot-pink idol sash'); me.from_pydata(verts, [], faces); me.update()
    sash = link('Hot-pink idol sash', me, mat('pink'))
    so = sash.modifiers.new('Sash thickness', 'SOLIDIFY'); so.thickness = 0.01; so.offset = 1.0
    front_i = max(range(96), key=lambda i: pts[i].y - abs(pts[i].x) * 2.0 - abs(pts[i].z - 0.79) * 1.5)
    bp, bn = pts[front_i], nrms[front_i]
    prism('Gold star brooch', star_pts(0.036, 0.016), 0.012, 'gold', M=frame(bn, (0, 0, 1), bp + bn * 0.018), bev=0.002)
    prism('Pink brooch heart', star_pts(0.013, 0.007), 0.006, 'pink', M=frame(bn, (0, 0, 1), bp + bn * 0.026))
    hip_i = min(range(96), key=lambda i: (pts[i] - Vector((-0.10, 0.07, 0.62))).length)
    kp, kn = pts[hip_i], nrms[hip_i]; K = kp + kn * 0.02
    ellipsoid('Sash bow knot', tuple(K), (0.024, 0.02, 0.022), 'pink', seg=20, rings=10)
    for sx in (1, -1):
        box(f'Sash bow loop {sx:+d}', tuple(K + Vector((sx * 0.03, 0.002, 0.004))), (0.04, 0.012, 0.03), 'pink',
            rot=(0, math.radians(sx * 20), 0), bev=0.008)
    for k, (dx, ln) in enumerate(((-0.018, 0.13), (0.02, 0.105))):
        a = K + Vector((dx * 0.5, 0.004, -0.01))
        sweep(f'Sash bow tail {k}', [tuple(a), tuple(a + Vector((dx, 0.012, -ln * 0.5))), tuple(a + Vector((dx * 1.7, 0.01, -ln)))],
              [0.03, 0.032, 0.03], ['pink', 'gold'], band=lambda u: 1 if u > 0.86 else 0, n=20, per=10, flat=0.25, up=(0, 1, 0))

    # --- Gold epaulettes with fringe and sparkle stars ---------------------------------------------------
    for side, sx in (('right', 1), ('left', -1)):
        E = Vector((0.152 * sx, 0.0, 0.905))
        ellipsoid(f'Gold epaulette {side}', tuple(E), (0.07, 0.064, 0.026), 'gold', rot=(0, math.radians(-16 * sx), 0))
        for k in range(9):
            a = math.radians(-80 + 160 * k / 8); o = Vector((math.cos(a) * sx * 0.062, math.sin(a) * 0.058, 0))
            base = E + o + Vector((0.012 * sx, 0, -0.012 - 0.02 * abs(math.cos(a))))
            cyl(f'Epaulette fringe {side} {k}', tuple(base + Vector((0, 0, -0.018))), 0.0065, 0.0055, 0.036, 'gold', seg=10, bev=0)
        sparkle(f'Shoulder sparkle {side} big', E + Vector((0.004 * sx, 0.0, 0.07)), 0.05, 'gold', spin=math.radians(8 * sx))
        sparkle(f'Shoulder sparkle {side} pink', E + Vector((0.06 * sx, 0.012, 0.045)), 0.03, 'pink', spin=math.radians(-12 * sx))
        sparkle(f'Shoulder sparkle {side} small', E + Vector((-0.045 * sx, -0.01, 0.052)), 0.022, 'white', spin=math.radians(20 * sx))

    # --- Arms: teal sleeves with gold cuffs; right hand holds the mic up, left fist on the hip ------------
    arms = {'right': [tuple(SHOULDER_R), (0.23, 0.02, 0.81), (0.283, 0.05, 0.745), (0.262, 0.10, 0.80), (0.23, 0.152, 0.862)],
            'left': [tuple(SHOULDER_L), (-0.235, -0.012, 0.80), (-0.298, -0.02, 0.72), (-0.235, -0.008, 0.66), (-0.158, 0.004, 0.625)]}
    for side, pts in arms.items():
        sweep(f'Teal sleeve {side}', pts, [0.044, 0.041, 0.039, 0.036, 0.034], ['jacket'], n=24, per=10)
        a = Vector(pts[-2]); b = Vector(pts[-1]); d = (b - a).normalized(); c = b - d * 0.012
        cyl(f'Gold cuff {side}', tuple(c), 0.041, 0.041, 0.022, 'gold', rot=d.to_track_quat('Z', 'Y').to_euler(), bev=0.004)
    # right fist around the mic handle
    ellipsoid('Mic fist right', (0.226, 0.17, 0.885), (0.034, 0.034, 0.04), 'skin', rot=(0.3, 0, 0))
    ellipsoid('Mic thumb right', (0.206, 0.192, 0.905), (0.012, 0.014, 0.02), 'skin', rot=(0.5, 0.4, 0))
    # left fist planted on the hip
    ellipsoid('Hip fist left', (-0.14, 0.006, 0.622), (0.03, 0.04, 0.036), 'skin', rot=(0, math.radians(-25), 0))
    ellipsoid('Hip thumb left', (-0.134, 0.042, 0.64), (0.011, 0.016, 0.012), 'skin')

    # --- Silver stage microphone with a gold ring and a pink star charm -------------------------------
    ma = Vector((0.227, 0.168, 0.83)); mb = Vector((0.22, 0.184, 0.955)); md = (mb - ma)
    cyl('Mic handle', tuple((ma + mb) / 2), 0.016, 0.022, md.length, 'trouser', rot=md.to_track_quat('Z', 'Y').to_euler(), seg=24, bev=0.003)
    cyl('Mic gold ring', tuple(mb), 0.026, 0.026, 0.014, 'gold', rot=md.to_track_quat('Z', 'Y').to_euler(), seg=24, bev=0.003)
    G = mb + md.normalized() * 0.034
    ellipsoid('Mic silver grille', tuple(G), (0.035, 0.035, 0.035), 'silver', seg=32, rings=16)
    tube('Mic charm cord', [(0.227, 0.168, 0.83), (0.234, 0.172, 0.80), (0.239, 0.17, 0.775)], 0.0025, 'pink', bres=2)
    prism('Mic star charm', star_pts(0.017, 0.008), 0.006, 'pink', M=frame((0, 1, 0), (0, 0, 1), (0.239, 0.17, 0.762)))

    # --- Little spade-tipped demon tail, curling up on its right --------------------------------------
    _, tp = sweep('Little demon tail', [(0.0, -0.07, 0.605), (0.04, -0.15, 0.53), (0.10, -0.215, 0.50), (0.148, -0.25, 0.545), (0.162, -0.255, 0.615)],
                  [0.019, 0.016, 0.014, 0.012, 0.011], ['skin'], n=20, per=10)
    t_end = (tp[-1] - tp[-4]).normalized()
    heart = []
    for k in range(40):
        t = math.tau * k / 40; x = 16 * math.sin(t) ** 3; y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        heart.append((x * 0.0021, -y * 0.0021 + 0.012))           # flipped: the point leads, like a spade
    Mt = Matrix.Identity(4); Zt = t_end; Yt = Vector((1, 0, 0)); Yt = (Yt - Yt.dot(Zt) * Zt).normalized(); Xt = Yt.cross(Zt)
    Mt = Matrix((Xt, Yt, Zt)).transposed().to_4x4(); Mt.translation = tp[-1] + t_end * 0.012
    prism('Spade tail tip', heart, 0.02, 'pink', M=Mt, bev=0.004)

    head_parts_start = len(PARTS)
    # --- Head: lavender, gently pointed chin --------------------------------------------------------------
    head = lathe('Lavender idol head', HEAD, ['skin'], a=tuple(HEAD_A), b=tuple(HEAD_B), ey=HEAD_EY, n=64)
    bpy.context.view_layer.update()
    HC = Vector((0.0, 0.012, 1.115))

    # --- Face: big open left eye, winking right eye, confident brows, open grin, star blush -------------
    E_L = (-0.052, 1.098); E_R = (0.052, 1.098)
    decal('Eye white left', [head], FRONT, (E_L[0], 0.2, E_L[1]), ellipse_pts(0.03, 0.038), 0.0, 0.003, 'eye')
    decal('Magenta iris left', [head], FRONT, (E_L[0] + 0.002, 0.2, E_L[1] - 0.004), ellipse_pts(0.02, 0.028), 0.003, 0.002, 'iris')
    decal('Ink pupil left', [head], FRONT, (E_L[0] + 0.003, 0.2, E_L[1] - 0.006), ellipse_pts(0.011, 0.016), 0.005, 0.0015, 'ink')
    decal('Sparkle eye highlight left', [head], FRONT, (E_L[0] - 0.006, 0.2, E_L[1] + 0.008), sparkle_pts(0.011, e=2.0), 0.0065, 0.0015, 'eye')
    decal('Eye highlight dot left', [head], FRONT, (E_L[0] + 0.01, 0.2, E_L[1] - 0.016), ellipse_pts(0.0042, 0.0042, n=12), 0.0065, 0.0015, 'eye')
    lash = [(E_L[0] + 0.03 * math.cos(a), E_L[1] + 0.038 * math.sin(a) + 0.001) for a in [math.radians(d) for d in (-5, 25, 55, 90, 125, 160, 185)]]
    surf_line('Upper lash line left', [head], FRONT, (0, 0.2, 0), lash, 0.004, [0.0035, 0.005, 0.006, 0.006, 0.006, 0.0055, 0.0045], 'ink')
    surf_line('Lash flick left', [head], FRONT, (0, 0.2, 0), [(E_L[0] - 0.027, E_L[1] + 0.008), (E_L[0] - 0.036, E_L[1] + 0.016), (E_L[0] - 0.041, E_L[1] + 0.025)], 0.004, [0.005, 0.0035, 0.002], 'ink')
    surf_line('Happy wink arc right', [head], FRONT, (0, 0.2, 0),
              [(E_R[0] - 0.027, E_R[1] - 0.008), (E_R[0] - 0.013, E_R[1] + 0.007), (E_R[0], E_R[1] + 0.012), (E_R[0] + 0.014, E_R[1] + 0.007), (E_R[0] + 0.027, E_R[1] - 0.008)],
              0.004, [0.004, 0.0058, 0.0062, 0.0058, 0.004], 'ink')
    for k, (dx, dz) in enumerate(((0.009, 0.01), (0.012, -0.001))):
        surf_line(f'Wink lash {k}', [head], FRONT, (0, 0.2, 0), [(E_R[0] + 0.025, E_R[1] - 0.005 + dz * 0.3), (E_R[0] + 0.025 + dx, E_R[1] + dz)], 0.004, [0.0035, 0.002], 'ink')
    surf_line('Confident brow left', [head], FRONT, (0, 0.2, 0), [(-0.08, 1.146), (-0.062, 1.16), (-0.04, 1.163), (-0.025, 1.155)], 0.004, [0.004, 0.0065, 0.006, 0.004], 'hair')
    surf_line('Relaxed brow right', [head], FRONT, (0, 0.2, 0), [(0.028, 1.145), (0.048, 1.152), (0.07, 1.148), (0.082, 1.14)], 0.004, [0.004, 0.006, 0.0055, 0.0035], 'hair')
    ang = math.radians(9); mouth = []
    for k in range(25):
        t = math.pi + math.pi * k / 24; mouth.append((0.026 * math.cos(t), 0.019 * math.sin(t)))
    mouth += [(0.012, 0.0), (-0.012, 0.0)]
    rot = lambda pts: [(x * math.cos(ang) - z * math.sin(ang), x * math.sin(ang) + z * math.cos(ang)) for x, z in pts]
    MC = (0.012, 0.2, 1.035)
    decal('Open grin', [head], FRONT, MC, rot(mouth), 0.0, 0.003, 'mouth')
    decal('Grin tongue', [head], FRONT, MC, rot(ellipse_pts(0.014, 0.0075, cx=0.004, cz=-0.011)), 0.003, 0.0015, 'blush')
    decal('Grin top teeth', [head], FRONT, MC, rot([(-0.023, -0.001), (0.023, -0.001), (0.021, -0.006), (-0.021, -0.006)]), 0.003, 0.0015, 'white')
    for sx in (1, -1):
        decal(f'Star blush {sx:+d}', [head], (-0.45 * sx, -0.89, 0), (0.084 * sx, 0.1, 1.058), star_pts(0.021, 0.0095, rot=math.radians(-8 * sx)), 0.0, 0.002, 'blush')
    hn = ray_hit([head], (0.0, 0.5, 1.07), FRONT)
    ellipsoid('Button nose', tuple(hn[0] + hn[1] * 0.002), (0.009, 0.007, 0.007), 'skinlo', seg=16, rings=8)

    # --- Pointed ears; a gold star earring on the left ------------------------------------------------
    for side, sx in (('right', 1), ('left', -1)):
        d = Vector((0.86 * sx, -0.22, 0.46)).normalized(); base = Vector((0.112 * sx, -0.004, 1.098))
        cyl(f'Pointed ear {side}', tuple(base + d * 0.04), 0.032, 0.004, 0.092, 'skin', rot=d.to_track_quat('Z', 'Y').to_euler(), seg=24, scale=(0.55, 1, 1), bev=0)
        cyl(f'Pointed ear inner {side}', tuple(base + d * 0.036 + Vector((0, 0.009, 0))), 0.02, 0.003, 0.062, 'blush', rot=d.to_track_quat('Z', 'Y').to_euler(), seg=20, scale=(0.36, 1, 1), bev=0)
        ellipsoid(f'Ear tip {side}', tuple(base + d * 0.085), (0.005, 0.005, 0.005), 'skin', seg=10, rings=6)
    tube('Earring hoop left', [(-0.13, 0.004, 1.078), (-0.136, 0.008, 1.066), (-0.134, 0.006, 1.056)], 0.0025, 'gold', bres=2)
    prism('Gold star earring', star_pts(0.017, 0.0075), 0.006, 'gold', M=frame((0, 1, 0), (0, 0, 1), (-0.134, 0.006, 1.04)), bev=0.001)

    # --- Hair: midnight cap with hot-pink tips; swoopy side-swept fringe; nape flicks -----------------
    # The cap is a (phi, s) grid from the hairline up to the crown, so its edge follows the hairline exactly.
    hline = lambda phi: -0.05 + 0.5 * math.cos(phi) - 0.05 * math.cos(2 * phi)
    NP, NS = 160, 40; verts = []; faces = []
    for j in range(NS):
        s_ = j / NS
        for i in range(NP):
            phi = math.tau * i / NP - math.pi; th = math.acos(max(-1.0, min(1.0, hline(phi)))) * (1 - s_)
            verts.append((math.sin(th) * math.sin(phi), math.sin(th) * math.cos(phi), math.cos(th)))
    verts.append((0.0, 0.0, 1.0)); pole = len(verts) - 1
    for j in range(NS - 1):
        for i in range(NP):
            a = j * NP + i; b = j * NP + (i + 1) % NP
            faces.append((a, b, b + NP, a + NP))
    for i in range(NP):
        faces.append(((NS - 1) * NP + i, (NS - 1) * NP + (i + 1) % NP, pole))
    me = bpy.data.meshes.new('Midnight hair cap'); me.from_pydata(verts, [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    cap = link('Midnight hair cap', me, mat('hair')); cap.location = (0.0, 0.002, 1.118); cap.scale = (0.141, 0.135, 0.15)
    so = cap.modifiers.new('Hair thickness', 'SOLIDIFY'); so.thickness = -0.1; so.offset = -1.0
    tip = lambda u: 1 if u > 0.8 else 0
    strands = [
        ('Fringe swoop main', [(-0.075, -0.01, 1.262), (-0.03, 0.07, 1.265), (0.03, 0.12, 1.228), (0.085, 0.128, 1.178), (0.12, 0.1, 1.142), (0.137, 0.062, 1.13), (0.143, 0.024, 1.138)],
         [0.03, 0.046, 0.05, 0.045, 0.034, 0.024, 0.014], True),
        ('Fringe swoop crest', [(-0.065, -0.045, 1.27), (-0.012, 0.035, 1.297), (0.05, 0.1, 1.267), (0.11, 0.118, 1.22), (0.142, 0.08, 1.19), (0.152, 0.04, 1.192)],
         [0.03, 0.042, 0.043, 0.036, 0.024, 0.013], True),
        ('Short fringe left', [(-0.045, 0.07, 1.252), (-0.074, 0.106, 1.205), (-0.094, 0.104, 1.172)], [0.024, 0.02, 0.009], False),
    ]
    for name, pts, rr, dyed in strands:
        sweep(name, pts, rr, ['hair', 'pink'], band=tip if dyed else None, n=24, per=12, flat=0.42, up=(0, 0.3, 1))
    for side, sx in (('right', 1), ('left', -1)):
        sweep(f'Sideburn tuft {side}', [(0.116 * sx, 0.035, 1.18), (0.13 * sx, 0.055, 1.13), (0.128 * sx, 0.066, 1.098)], [0.028, 0.022, 0.01],
              ['hair'], n=20, per=10, flat=0.4, up=(sx, 0, 0))
    for k, x in enumerate((-0.058, 0.0, 0.058)):          # broad, overlapping nape points (plain midnight)
        sweep(f'Nape point {k}', [(x, -0.098, 1.15), (x * 1.08, -0.13, 1.09), (x * 1.18, -0.14, 1.035)], [0.046, 0.033, 0.013],
              ['hair'], n=20, per=10, flat=0.35, up=(0, -1, 0))
    for k, x in enumerate((-0.05, 0.05)):                  # broad swept-back layers hugging the crown
        sweep(f'Back swoop layer {k}', [(x * 0.4, 0.02, 1.286), (x, -0.07, 1.262), (x * 1.3, -0.128, 1.195), (x * 1.4, -0.145, 1.13)],
              [0.05, 0.056, 0.046, 0.02], ['hair'], n=24, per=10, flat=0.3, up=(0, -0.4, 1))

    # --- Two little gold candy horns rising through the hair: short, chubby, blunt round tips ------------
    for side, sx in (('right', 1), ('left', -1)):
        _, hp = sweep(f'Gold candy horn {side}', [(0.056 * sx, -0.01, 1.225), (0.078 * sx, -0.01, 1.278), (0.088 * sx, 0.0, 1.318), (0.08 * sx, 0.014, 1.348), (0.066 * sx, 0.024, 1.362)],
                      [0.036, 0.032, 0.025, 0.019, 0.0135], ['gold'], n=24, per=12)
        ellipsoid(f'Horn tip {side}', tuple(hp[-1]), (0.0138, 0.0138, 0.0138), 'gold', seg=16, rings=8)

    # --- Tilt and turn the whole head group on the neck pivot -------------------------------------------
    piv = empty('Head tilt pivot', tuple(PIVOT))
    bpy.context.view_layer.update()
    inv = piv.matrix_world.inverted()
    for ob in PARTS[head_parts_start:]:
        if ob.parent is None:
            ob.parent = piv; ob.matrix_parent_inverse = inv
    piv.rotation_euler = (0.0, HEAD_ROLL, HEAD_YAW); piv.scale = (HEAD_SCALE,) * 3; piv.location.z -= HEAD_DROP

    for ob in PARTS: ob['work_order'] = 'WO111'; ob['asset_id'] = 'demon-band-idol'

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

TOP_KEYS = ('Gold candy horn', 'Horn tip', 'Fringe swoop crest', 'Midnight hair cap', 'Lavender idol head', 'Shoulder sparkle',
            'Gold epaulette', 'Mic silver grille', 'Pointed ear', 'Little demon tail', 'Spade tail tip')

if __name__ == '__main__':
    sc = bpy.context.scene
    assert sc.get('asset_id') == 'demon-band-idol' and sc.get('scene_lease') == 'active'
    build(); bpy.context.view_layer.update()
    m, per = measure()
    tops = {k.strip(): round(max(v for n, v in per.items() if n.startswith(k)), 4) for k in TOP_KEYS}
    sc['blockout_bounds_m'] = json.dumps(m); sc['blockout_tops_m'] = json.dumps(tops)
    sc['orientation'] = 'Blender +Z up/+Y forward; glTF +Y up/-Z forward; floor-centred origin; character right = +X'
    path = ROOT / 'demon-band-idol-blockout.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(path), compress=True)
    rec = {'saved': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bounds_blender_zup': m, 'feature_tops_m': tops,
           'parts': len(PARTS), 'materials': sorted(x.name for x in bpy.data.materials),
           'utc': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    (ROOT / 'blockout-measurements.json').write_text(json.dumps(rec, indent=2) + '\n')
    print(json.dumps(rec))
