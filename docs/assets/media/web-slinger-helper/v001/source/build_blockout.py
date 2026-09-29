"""WO111 web-slinger-helper v001: painted flat-colour BLOCKOUT for a Blender reference sheet.

Reference-sheet stage only: bevelled primitives, lathes, sweeps and surface decals. No final topology, no rig, no
atlas, no GLB. Blender +Z up, character faces +Y (exports later as glTF +Y up / -Z forward), floor-centred at the
origin. Character right = +X. All dimensions in metres.

Design: World A chapter 3 FRIENDLY helper (ages 5-9, the rooftop Hero City chapter; DESIGN-013 friendly rules: heals
the player, never an enemy). An original masked kid hero of the era's web-slinging cartoons, about 1.19 m to the top
of the hood. A cobalt hooded suit leaves the round face open; a tangerine domino mask with upturned wings frames two
big friendly eyes, a chestnut fringe spills out under the hood and a big open grin sits over pink cheeks. The cream
web pattern is our own: on the hood it radiates from the crown, and on the chest it radiates from a tilted sunny
star emblem, a star sitting where a spider would. Sunny mitten gloves and boots, a tangerine belt with a coiled
cream web rope on the right hip, and chunky tangerine web-shooter cuffs with a pink heart button (the healer's cue).
Pose: right hand raised in a big wave, left fist on the hip, head tilted toward the wave.
"""
import bpy, bmesh, math, json, hashlib, datetime
from mathutils import Vector, Matrix
from pathlib import Path

ROOT = Path('/workspace/haynes-quest/family-eras/web-slinger-helper/v001')
MASTER = 'Web-slinger helper blockout (master)'

PAL = {
    'suit': '#3b7dd8', 'cream': '#fbf6ea', 'sun': '#f7c64a', 'tang': '#f28c3a', 'skin': '#f0c7a0', 'hair': '#7a4a30',
    'heart': '#e8566f', 'sole': '#4a3f63', 'ink': '#342c46', 'iris': '#7b5234', 'tongue': '#ef8f98', 'blush': '#f4a79d',
}
LOOK = {
    'suit': dict(rough=0.62, spec=0.26), 'tang': dict(rough=0.55, spec=0.3), 'sun': dict(rough=0.6, spec=0.26),
    'cream': dict(rough=0.4, spec=0.35), 'iris': dict(rough=0.22, spec=0.55), 'ink': dict(rough=0.3, spec=0.45),
    'heart': dict(rough=0.3, spec=0.45, glow=0.18), 'hair': dict(rough=0.7, spec=0.2),
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
    m = bpy.data.materials.new('WSH ' + key + ' ' + PAL[key]); m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF'); lk = LOOK.get(key, {})
    bs.inputs['Base Color'].default_value = lin(PAL[key]); bs.inputs['Roughness'].default_value = lk.get('rough', 0.85)
    bs.inputs['Specular IOR Level'].default_value = lk.get('spec', 0.16)
    if lk.get('glow'):
        bs.inputs['Emission Color'].default_value = lin(PAL[key]); bs.inputs['Emission Strength'].default_value = lk['glow']
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

def no_ink(ob):
    ob['sheet_no_ink'] = True; return ob

EMPTIES = []
def empty(name, loc=(0, 0, 0), rot=(0, 0, 0), parent=None):
    ob = bpy.data.objects.new(name, None); bpy.data.collections[MASTER].objects.link(ob)
    ob.location = loc; ob.rotation_euler = rot; ob.empty_display_size = 0.04
    if parent is not None: ob.parent = parent
    EMPTIES.append(ob); return ob

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

def along(ob, a, b):
    a = Vector(a); b = Vector(b); ob.location = (a + b) / 2
    ob.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler(); return ob

def rod(name, a, b, r1, r2, key, seg=40, bev=0.004):
    return along(cyl(name, (0, 0, 0), r1, r2, (Vector(b) - Vector(a)).length, key, seg=seg, bev=bev), a, b)

def interp(profile, z):
    if z <= profile[0][0]: return profile[0][1]
    for (z0, r0), (z1, r1) in zip(profile, profile[1:]):
        if z0 <= z <= z1: return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return profile[-1][1]

def smooth_profile(profile, step=0.004):
    t0, t1 = profile[0][0], profile[-1][0]; n = max(8, int((t1 - t0) / step))
    ts = [t0 + (t1 - t0) * i / n for i in range(n + 1)]; rs = [interp(profile, t) for t in ts]
    for _ in range(3):
        rs = [rs[0]] + [(rs[i - 1] + 2 * rs[i] + rs[i + 1]) / 4 for i in range(1, len(rs) - 1)] + [rs[-1]]
    return list(zip(ts, rs))

def lathe(name, prof, key, ey=1.0, n=64, loc=(0, 0, 0)):
    """Closed surface of revolution around world Z; prof [(z, r)] (already dense); Y radius scaled by ey."""
    verts = []; faces = []
    for z, r in prof:
        for i in range(n):
            ang = math.tau * i / n; verts.append((r * math.cos(ang), ey * r * math.sin(ang), z))
    rings = len(prof)
    for j in range(rings - 1):
        for i in range(n):
            faces.append((j * n + i, j * n + (i + 1) % n, (j + 1) * n + (i + 1) % n, (j + 1) * n + i))
    faces.append(tuple(range(n - 1, -1, -1))); faces.append(tuple((rings - 1) * n + i for i in range(n)))
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    ob = link(name, me, mat(key)); ob.location = loc; return ob

def catmull(pts, per=10):
    P = [Vector(p) for p in pts]; P = [P[0] + (P[0] - P[1])] + P + [P[-1] + (P[-1] - P[-2])]; out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for s in range(per):
            t = s / per
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-2]); return out

def rmf(path, up=(0, 0, 1)):
    m = len(path); T = (path[1] - path[0]).normalized(); U = Vector(up); N = U - U.dot(T) * T
    if N.length < 1e-3: N = T.cross(Vector((1, 0, 0)))
    N.normalize(); out = []
    for i in range(m):
        if i > 0:
            T = (path[min(i + 1, m - 1)] - path[i - 1]).normalized(); N = (N - N.dot(T) * T).normalized()
        out.append((T, N, T.cross(N)))
    return out

def sweep(name, pts, radii, key, n=20, per=12, up=(0, 0, 1), cap=True):
    """Round tube along a Catmull-Rom path (per=1 keeps a dense input polyline as-is)."""
    path = catmull(pts, per); m = len(path)
    lens = [0.0]
    for i in range(1, m): lens.append(lens[-1] + (path[i] - path[i - 1]).length)
    total = lens[-1]; verts = []; faces = []
    for i, (T, N, B) in enumerate(rmf(path, up)):
        u = lens[i] / total; k = u * (len(radii) - 1); k0 = min(int(k), len(radii) - 2)
        r = radii[k0] + (radii[k0 + 1] - radii[k0]) * (k - k0)
        for j in range(n):
            ang = math.tau * j / n; verts.append(tuple(path[i] + r * (math.cos(ang) * N + math.sin(ang) * B)))
    for i in range(m - 1):
        for j in range(n):
            faces.append((i * n + j, i * n + (j + 1) % n, (i + 1) * n + (j + 1) % n, (i + 1) * n + j))
    if cap:
        faces.append(tuple(range(n - 1, -1, -1))); faces.append(tuple((m - 1) * n + j for j in range(n)))
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    return link(name, me, mat(key)), path

def ring(name, center, axis, R, r, key, n=14, seg=56):
    """Closed torus-like tube: circle of radius R around `axis` through `center`."""
    A = Vector(axis).normalized(); X = A.orthogonal().normalized(); Y = A.cross(X); C = Vector(center)
    pts = [C + R * (math.cos(math.tau * i / seg) * X + math.sin(math.tau * i / seg) * Y) for i in range(seg)]
    pts.append(pts[0])
    ob, _ = sweep(name, pts, [r, r], key, n=n, per=1, cap=False); return ob

def frame(y_axis, z_hint, origin=(0, 0, 0)):
    """World matrix whose local +Y is y_axis and local +Z is as close to z_hint as possible."""
    Y = Vector(y_axis).normalized(); Z = Vector(z_hint); Z = (Z - Z.dot(Y) * Y).normalized(); X = Y.cross(Z)
    M = Matrix((X, Y, Z)).transposed().to_4x4(); M.translation = Vector(origin); return M

def prism(name, pts, thick, key, M=None, bev=0.0):
    """Flat 2-D shape pts[(x, z)] extruded along local Y (thickness centred), fan-triangulated from its centroid."""
    n = len(pts); cx = sum(p[0] for p in pts) / n; cz = sum(p[1] for p in pts) / n; h = thick / 2
    verts = [(cx, -h, cz), (cx, h, cz)] + [(x, -h, z) for x, z in pts] + [(x, h, z) for x, z in pts]
    faces = []
    for i in range(n):
        j = (i + 1) % n
        faces += [(0, 2 + j, 2 + i), (1, 2 + n + i, 2 + n + j), (2 + i, 2 + j, 2 + n + j, 2 + n + i)]
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    ob = link(name, me, mat(key), smooth=False)
    if M is not None: ob.matrix_world = M
    if bev: bevel(ob, bev, 2)
    return ob

def chaikin(pts, it=2, closed=True):
    P = [tuple(p) for p in pts]
    for _ in range(it):
        Q = []; m = len(P)
        for i in range(m if closed else m - 1):
            a = P[i]; b = P[(i + 1) % m]
            Q += [(0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]), (0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1])]
        P = Q
    return P

def decal(name, outline, mapfn, off, thick, key, rings=6, ink=True, parent=None):
    """A thin painted shape laid on a surface: a star-convex 2-D outline [(u, v)], mapped point-by-point by
    mapfn(u, v) -> (point, normal), with a centre fan and concentric rings so the curved surface is followed."""
    n = len(outline); cu = sum(p[0] for p in outline) / n; cv = sum(p[1] for p in outline) / n
    p0, n0 = mapfn(cu, cv); verts = [tuple(p0 + n0 * off)]
    for k in range(1, rings + 1):
        f = k / rings
        for (u, v) in outline:
            p, nn = mapfn(cu + (u - cu) * f, cv + (v - cv) * f); verts.append(tuple(p + nn * off))
    faces = [(0, 1 + i, 1 + (i + 1) % n) for i in range(n)]
    for k in range(rings - 1):
        a = 1 + k * n; b = 1 + (k + 1) * n
        faces += [(a + i, b + i, b + (i + 1) % n, a + (i + 1) % n) for i in range(n)]
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    if sum(poly.normal.dot(n0) for poly in me.polygons) < 0:
        bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.reverse_faces(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    ob = link(name, me, mat(key), parent)
    so = ob.modifiers.new('Decal thickness', 'SOLIDIFY'); so.thickness = thick; so.offset = -1.0; so.use_even_offset = True
    if not ink: no_ink(ob)
    return ob

def band_decal(name, xs, top, bot, mapfn, off, thick, key, rows=4, ink=True):
    """A thin painted strip between two curves z = top(x) and z = bot(x) over the samples xs, laid on a surface."""
    verts = []
    for x in xs:
        for r in range(rows + 1):
            f = r / rows; p, nn = mapfn(x, top(x) + (bot(x) - top(x)) * f); verts.append(tuple(p + nn * off))
    m = rows + 1
    faces = [(i * m + r, i * m + r + 1, (i + 1) * m + r + 1, (i + 1) * m + r) for i in range(len(xs) - 1) for r in range(rows)]
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    _, n0 = mapfn(xs[len(xs) // 2], (top(xs[len(xs) // 2]) + bot(xs[len(xs) // 2])) / 2)
    if sum(poly.normal.dot(n0) for poly in me.polygons) < 0:
        bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.reverse_faces(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    ob = link(name, me, mat(key))
    so = ob.modifiers.new('Decal thickness', 'SOLIDIFY'); so.thickness = thick; so.offset = -1.0; so.use_even_offset = True
    if not ink: no_ink(ob)
    return ob

def clear_scene():
    if bpy.context.object and bpy.context.object.mode != 'OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    for coll in list(bpy.data.collections): bpy.data.collections.remove(coll)
    for blocks in (bpy.data.meshes, bpy.data.curves, bpy.data.metaballs, bpy.data.armatures, bpy.data.materials, bpy.data.actions,
                   bpy.data.cameras, bpy.data.lights, bpy.data.images, bpy.data.linestyles, bpy.data.worlds, bpy.data.textures):
        for b in list(blocks): blocks.remove(b)
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)

# --- Key dimensions (Blender Z up, facing +Y, character right = +X) --------------------------------------------------
HC = Vector((0.0, 0.0, 0.99)); HR = Vector((0.185, 0.178, 0.195))       # cobalt hood ellipsoid
HOLE_AX = 0.128; HOLE_AZ = 0.138; HOLE_ZC = 0.960                          # open-face hole (front projection)
FC = Vector((0.0, 0.028, 0.972)); FR = Vector((0.155, 0.155, 0.162))      # face ellipsoid inside the hood
PIVOT = Vector((0.0, 0.0, 0.815)); HEAD_ROLL = math.radians(6.0)          # head tilts toward the waving hand
TORSO_EY = 0.74
TORSO_PROF = [(0.395, 0.03), (0.405, 0.075), (0.425, 0.115), (0.46, 0.14), (0.52, 0.150), (0.60, 0.148), (0.67, 0.150),
              (0.72, 0.152), (0.75, 0.142), (0.775, 0.118), (0.795, 0.08), (0.808, 0.03)]
TP = smooth_profile(TORSO_PROF)
STAR_Z = 0.655; STAR_TILT = math.radians(10)
BELT = (0.452, 0.492)
SHOULDER_Z = 0.742; SHOULDER_X = 0.16

def torso_r(z): return interp(TP, z)

def torso_pt(a, z):
    r = torso_r(z); x = r * math.cos(a); y = TORSO_EY * r * math.sin(a)
    dr = (torso_r(z + 0.002) - torso_r(z - 0.002)) / 0.004
    n = Vector((x / r ** 2, y / (TORSO_EY ** 2 * r ** 2), -dr / r)).normalized()
    return Vector((x, y, z)), n

# Arc length of the unit torso ellipse (cos a, ey sin a) measured from the front (a = pi/2) toward +X.
_ARC = [(0.0, 0.0)]
for _i in range(1, 1600):
    _t = math.pi * _i / 1599
    _ARC.append((_t, _ARC[-1][1] + math.sqrt(math.cos(_t) ** 2 + (TORSO_EY * math.sin(_t)) ** 2) * math.pi / 1599))

def _arc_to_angle(s):
    lo, hi = 0, len(_ARC) - 1
    if s >= _ARC[-1][1]: return _ARC[-1][0]
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if _ARC[mid][1] < s: lo = mid
        else: hi = mid
    (t0, s0), (t1, s1) = _ARC[lo], _ARC[hi]
    return t0 + (t1 - t0) * (s - s0) / max(1e-12, s1 - s0)

QUARTER = _ARC[800][1]          # unit-ellipse arc from the front to the side (a = 0)

def torso_map(front=True):
    """(u, v) -> torso surface: u is arc length toward the character's right (+X), v is height z."""
    def f(u, v):
        t = _arc_to_angle(abs(u) / torso_r(v)) * (1 if u >= 0 else -1)
        a = (math.pi / 2 - t) if front else (-math.pi / 2 + t)
        return torso_pt(a, v)
    return f

def face_pt(x, z):
    q = max(1e-6, 1 - ((x - FC.x) / FR.x) ** 2 - ((z - FC.z) / FR.z) ** 2); y = FC.y + FR.y * math.sqrt(q)
    n = Vector(((x - FC.x) / FR.x ** 2, (y - FC.y) / FR.y ** 2, (z - FC.z) / FR.z ** 2)).normalized()
    return Vector((x, y, z)), n

def hood_pt(theta, phi, s=1.0):
    """Hood ellipsoid by polar angle from the crown (theta) and azimuth from the front (phi, toward +X)."""
    return HC + Vector((HR.x * math.sin(theta) * math.sin(phi) * s, HR.y * math.sin(theta) * math.cos(phi) * s, HR.z * math.cos(theta) * s))

def hole_top(x):
    return HOLE_ZC + HOLE_AZ * math.sqrt(max(0.0, 1 - (x / HOLE_AX) ** 2))

def in_hole(p, grow=1.0):
    return p.y > HC.y and (p.x / (HOLE_AX * grow)) ** 2 + ((p.z - HOLE_ZC) / (HOLE_AZ * grow)) ** 2 < 1

def split_runs(points, keep):
    runs = []; cur = []
    for p in points:
        if keep(p): cur.append(p)
        else:
            if len(cur) >= 3: runs.append(cur)
            cur = []
    if len(cur) >= 3: runs.append(cur)
    return runs

def star_outline(cu, cv, R, r, tilt, it=2):
    pts = []
    for k in range(10):
        ang = math.pi / 2 + tilt + math.pi * k / 5; rad = R if k % 2 == 0 else r
        pts.append((cu + rad * math.cos(ang), cv + rad * math.sin(ang)))
    return chaikin(pts, it)

def heart_outline(w, n=40):
    pts = []
    for i in range(n):
        t = math.tau * i / n
        x = 16 * math.sin(t) ** 3; z = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((x * w / 32, (z + 2) * w / 32))
    return pts

def build_hood():
    """Cobalt hood: the hood ellipsoid minus an exact elliptical face opening. Rows run from the opening's rim to
    the back pole along great circles of the normalised ellipsoid, so the opening edge is clean."""
    NPSI = 112; NT = 44
    back = Vector((0.0, -1.0, 0.0)); boundary = []
    for i in range(NPSI):
        psi = -math.pi / 2 + math.tau * i / NPSI                     # start at the chin (the rim seam hides there)
        x = HOLE_AX * math.cos(psi); z = HOLE_ZC + HOLE_AZ * math.sin(psi)
        q = max(0.0, 1 - (x / HR.x) ** 2 - ((z - HC.z) / HR.z) ** 2)
        boundary.append(Vector((x, HC.y + HR.y * math.sqrt(q), z)))
    verts = []
    for ti in range(NT):
        t = ti / NT
        for b in boundary:
            u0 = Vector(((b.x - HC.x) / HR.x, (b.y - HC.y) / HR.y, (b.z - HC.z) / HR.z)).normalized()
            om = u0.angle(back); u = (math.sin((1 - t) * om) * u0 + math.sin(t * om) * back) / math.sin(om)
            verts.append(tuple(HC + Vector((u.x * HR.x, u.y * HR.y, u.z * HR.z))))
    pole = len(verts); verts.append(tuple(HC + Vector((0.0, -HR.y, 0.0))))
    faces = []
    for ti in range(NT - 1):
        a = ti * NPSI; b = (ti + 1) * NPSI
        faces += [(a + i, a + (i + 1) % NPSI, b + (i + 1) % NPSI, b + i) for i in range(NPSI)]
    a = (NT - 1) * NPSI
    faces += [(a + i, a + (i + 1) % NPSI, pole) for i in range(NPSI)]
    me = bpy.data.meshes.new('Cobalt hood (open face)'); me.from_pydata(verts, [], faces); me.update()
    if sum(p.normal.dot(Vector(p.center) - HC) for p in me.polygons) < 0:
        bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.reverse_faces(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    hood = link('Cobalt hood (open face)', me, mat('suit'))
    so = hood.modifiers.new('Hood cloth thickness', 'SOLIDIFY'); so.thickness = 0.012; so.offset = -1.0; so.use_even_offset = True
    rim_pts = boundary + [boundary[0]]
    ring_ob, _ = sweep('Hood face rim', rim_pts, [0.0135, 0.0135], 'suit', n=16, per=1, cap=False)
    return hood

def build():
    clear_scene()
    coll = bpy.data.collections.new(MASTER); bpy.context.scene.collection.children.link(coll)
    sc = bpy.context.scene; sc.unit_settings.system = 'METRIC'; sc.unit_settings.scale_length = 1.0

    # --- Torso: cobalt kid body with a slight tummy; tangerine belt; star emblems front and back --------------------
    lathe('Cobalt torso', TP, 'suit', ey=TORSO_EY, n=72)
    rb = lambda z, d: (z, torso_r(z) + d)
    belt_prof = smooth_profile([rb(BELT[0], 0.004), rb(BELT[0] + 0.006, 0.011), rb(BELT[1] - 0.006, 0.011), rb(BELT[1], 0.004)], step=0.002)
    lathe('Tangerine belt', belt_prof, 'tang', ey=TORSO_EY, n=72)
    fmap = torso_map(True); bmap = torso_map(False)
    p, n = fmap(0.0, 0.472)
    along(cyl('Belt buckle', (0, 0, 0), 0.024, 0.024, 0.012, 'sun', bev=0.003), p + n * 0.006, p + n * 0.018)
    decal('Chest star emblem', star_outline(0.0, STAR_Z, 0.075, 0.037, STAR_TILT), fmap, 0.007, 0.006, 'sun', rings=6)
    decal('Back star emblem', star_outline(0.0, STAR_Z + 0.01, 0.052, 0.026, -STAR_TILT), bmap, 0.007, 0.006, 'sun', rings=6)

    # --- Cream web yoke on the torso: rays out of each star, sagging scallop arcs between them --------------------
    def region(uv): return BELT[1] + 0.012 < uv[1] < 0.782 and abs(uv[0]) < 0.9 * QUARTER * torso_r(uv[1])
    for tag, mp, cv, R, rr, tilt, reach in (('Chest', fmap, STAR_Z, 0.075, 0.037, STAR_TILT, 0.205), ('Back', bmap, STAR_Z + 0.01, 0.052, 0.026, -STAR_TILT, 0.18)):
        angs = [math.pi / 2 + tilt + math.pi * k / 5 for k in range(10)]
        for k, al in enumerate(angs):
            d0 = (R * 0.8) if k % 2 == 0 else (rr * 1.05)
            steps = int((reach - d0) / 0.005) + 1
            uv = [(math.cos(al) * d, cv + math.sin(al) * d) for d in [d0 + (reach - d0) * i / (steps - 1) for i in range(steps)]]
            for j, run in enumerate(split_runs(uv, region)[:1]):
                pts = [mp(u, v) for u, v in run]
                no_ink(sweep(f'{tag} web ray {k}', [p + nn * 0.0035 for p, nn in pts], [0.0042, 0.0042], 'cream', n=8, per=1)[0])
                if len(run) == len(uv):                          # dew drop where a ray ends on open suit
                    p, nn = pts[-1]
                    no_ink(ellipsoid(f'{tag} web dew drop {k}', tuple(p + nn * 0.004), (0.0085, 0.0085, 0.0085), 'cream', seg=14, rings=8))
        for dk, dist in enumerate((0.115, 0.17) if tag == 'Chest' else (0.095, 0.145)):
            for k in range(10):
                a0 = angs[k]; a1 = angs[(k + 1) % 10] + (math.tau if k == 9 else 0.0)
                uv = []
                for i in range(15):
                    f = i / 14; al = a0 + (a1 - a0) * f; d = dist * (1 - 0.13 * math.sin(math.pi * f))
                    uv.append((math.cos(al) * d, cv + math.sin(al) * d))
                for j, run in enumerate(split_runs(uv, region)):
                    pts = [mp(u, v) for u, v in run]
                    no_ink(sweep(f'{tag} web arc {dk} {k} {j}', [p + nn * 0.0035 for p, nn in pts], [0.0038, 0.0038], 'cream', n=8, per=1)[0])

    # --- Web-rope coil on the right hip, clipped to the belt ---------------------------------------------------------
    clip_p, clip_n = torso_pt(-0.16, 0.472)
    along(cyl('Web coil belt clip', (0, 0, 0), 0.016, 0.016, 0.026, 'tang', seg=24, bev=0.003), clip_p + clip_n * 0.004, clip_p + clip_n * 0.03)
    A = Vector((1.0, 0.62, 0.0)).normalized(); cc = clip_p + clip_n * 0.028 + Vector((0.0, 0.0, -0.046))
    for k in range(3):
        ring(f'Web rope coil loop {k}', cc + A * (0.016 * k - 0.016) + Vector((0, 0, 0.003 * k)), A + Vector((0, 0, 0.06 * (k - 1))), 0.044 - 0.002 * k, 0.0085, 'cream')

    # --- Legs: cobalt leggings, sunny boots with rolled cuffs, plum soles; left toe turned out -------------------------
    for side, sx, yaw in (('right', 1, math.radians(-8)), ('left', -1, math.radians(15))):
        hip = Vector((0.084 * sx, 0.0, 0.47)); knee = Vector((0.096 * sx, 0.012, 0.285)); ankle = Vector((0.104 * sx, 0.0, 0.16))
        sweep(f'Cobalt legging {side}', [hip, knee, ankle + Vector((0, 0, -0.02))], [0.071, 0.062, 0.055], 'suit', n=28, per=10)
        rod(f'Boot shaft {side}', (ankle.x, ankle.y, 0.035), (ankle.x, ankle.y, 0.172), 0.058, 0.061, 'sun', bev=0.006)
        ring(f'Boot rolled cuff {side}', (ankle.x, ankle.y, 0.172), (0, 0, 1), 0.061, 0.015, 'sun')
        fwd = Vector((math.sin(-yaw), math.cos(-yaw), 0.0))
        ellipsoid(f'Boot foot {side}', tuple(Vector((ankle.x, ankle.y, 0.052)) + fwd * 0.036), (0.06, 0.098, 0.052), 'sun', rot=(0, 0, yaw))
        ellipsoid(f'Boot sole {side}', tuple(Vector((ankle.x, ankle.y, 0.02)) + fwd * 0.036), (0.064, 0.104, 0.02), 'sole', rot=(0, 0, yaw))

    # --- Arms: cobalt sleeves; sunny glove flares; tangerine web-shooter cuffs with heart buttons -----------------
    def web_shooter(side, W, T, button_dir):
        T = Vector(T).normalized(); bd = Vector(button_dir); bd = (bd - bd.dot(T) * T).normalized()
        along(cyl(f'Glove flare {side}', (0, 0, 0), 0.052, 0.036, 0.09, 'sun', seg=36, bev=0.004), W - T * 0.095, W - T * 0.005)
        rod(f'Web-shooter cuff {side}', W - T * 0.068, W - T * 0.022, 0.056, 0.054, 'tang', seg=40, bev=0.006)
        q = (bd * 0.35 + T.cross(bd) * 0.94).normalized()
        rod(f'Web nozzle {side}', W - T * 0.045 + q * 0.05, W - T * 0.045 + q * 0.064, 0.0095, 0.0075, 'cream', seg=16, bev=0.0)
        hc = W - T * 0.045 + bd * 0.058
        prism(f'Heart button {side}', heart_outline(0.044), 0.009, 'heart', M=frame(bd, (0, 0, 1), hc), bev=0.0018)

    # right arm: raised in a big wave, palm forward
    S = Vector((SHOULDER_X, 0.0, SHOULDER_Z)); E = Vector((0.296, 0.012, 0.862)); W = Vector((0.327, 0.024, 1.0))
    ellipsoid('Shoulder ball right', tuple(S), (0.058, 0.056, 0.058), 'suit')
    sweep('Cobalt sleeve right', [S, S.lerp(E, 0.55) + Vector((0.012, 0, -0.01)), E, E.lerp(W, 0.5), W - (W - E).normalized() * 0.06],
          [0.048, 0.046, 0.043, 0.041, 0.04], 'suit', n=24, per=8)
    T = (W - E).normalized(); palm = Vector((0.55, 1.0, 0.0))
    web_shooter('right', W, T, palm)
    Mh = frame(palm, T + Vector((0.08, 0, 0)), W + T * 0.058)
    hand = ellipsoid('Waving mitten right', (0, 0, 0), (0.048, 0.03, 0.066), 'sun'); hand.matrix_world = Mh @ Matrix.Diagonal((0.048, 0.03, 0.066, 1.0))
    X = Mh.to_3x3() @ Vector((1, 0, 0)); tdir = (-X * 0.75 + T * 0.66).normalized()
    thumb_c = W + T * 0.03 - X * 0.042 + tdir * 0.022
    ellipsoid('Mitten thumb right', tuple(thumb_c), (0.017, 0.017, 0.032), 'sun', rot=tdir.to_track_quat('Z', 'Y').to_euler())
    for k, fx in enumerate((-0.0155, 0.0, 0.0155)):        # painted finger grooves on the palm (sheet only)
        pts = []
        for i in range(7):
            z = 0.062 - 0.03 * i / 6; q = max(0.0, 1 - (fx / 0.048) ** 2 - (z / 0.066) ** 2)
            pts.append(Mh @ Vector((fx, 0.03 * math.sqrt(q) + 0.0012, z)))
        no_ink(sweep(f'Mitten finger groove right {k}', pts, [0.0012, 0.0022, 0.0022, 0.0012], 'ink', n=8, per=1)[0])

    # left arm: fist on the hip
    S = Vector((-SHOULDER_X, 0.0, SHOULDER_Z)); E = Vector((-0.292, -0.03, 0.625)); W = Vector((-0.2, 0.008, 0.545))
    ellipsoid('Shoulder ball left', tuple(S), (0.058, 0.056, 0.058), 'suit')
    sweep('Cobalt sleeve left', [S, S.lerp(E, 0.5) + Vector((-0.014, 0, 0)), E, E.lerp(W, 0.5), W - (W - E).normalized() * 0.06],
          [0.048, 0.046, 0.043, 0.041, 0.04], 'suit', n=24, per=8)
    T = (W - E).normalized()
    web_shooter('left', W, T, Vector((-0.75, 0.66, 0.1)))
    fc = W + T * 0.04
    ellipsoid('Hip fist left', tuple(fc), (0.047, 0.044, 0.043), 'sun', rot=T.to_track_quat('Z', 'Y').to_euler())
    ellipsoid('Fist thumb left', tuple(fc + Vector((0.004, 0.034, 0.02))), (0.016, 0.022, 0.015), 'sun', rot=(0.3, 0, 0.2))

    # --- Neck (suit turtleneck), mostly under the hood --------------------------------------------------------------
    rod('Cobalt neck', (0, -0.005, 0.765), (0, -0.005, 0.85), 0.056, 0.056, 'suit', bev=0.0)

    head_start = len(PARTS); head_empty_start = len(EMPTIES)
    # --- Head: open-face cobalt hood, round face -----------------------------------------------------------------------
    build_hood()
    ellipsoid('Round face', tuple(FC), tuple(FR), 'skin', seg=64, rings=32)
    fmask = lambda u, v: face_pt(u, v)

    # tangerine domino mask with upturned wings; its top arches over each eye like raised happy brows
    half_top = [(0.0, 1.046), (0.02, 1.054), (0.04, 1.07), (0.062, 1.076), (0.085, 1.066), (0.105, 1.06), (0.122, 1.062)]
    half_bot = [(0.124, 1.03), (0.114, 0.99), (0.096, 0.95), (0.066, 0.932), (0.04, 0.935), (0.02, 0.95), (0.0, 0.966)]
    right = half_top + half_bot
    outline = right + [(-x, z) for x, z in reversed(right[1:-1])]
    decal('Tangerine domino mask', chaikin(outline, 2), fmask, 0.006, 0.005, 'tang', rings=8)

    # big friendly eyes on the mask
    for sx, side in ((1, 'right'), (-1, 'left')):
        p, n = face_pt(0.052 * sx, 1.0)
        nf = (n * 0.55 + Vector((0, 1, 0)) * 0.45).normalized()
        fr = empty(f'Eye frame {side}', tuple(p + n * 0.004)); fr.rotation_euler = nf.to_track_quat('Y', 'Z').to_euler()
        ellipsoid(f'Eye white {side}', (0, 0, 0), (0.038, 0.02, 0.046), 'cream', parent=fr)
        ellipsoid(f'Iris {side}', (-0.002 * sx, 0.014, 0.004), (0.025, 0.011, 0.029), 'iris', parent=fr, seg=24, rings=12)
        ellipsoid(f'Pupil {side}', (-0.002 * sx, 0.02, 0.005), (0.015, 0.008, 0.018), 'ink', parent=fr, seg=24, rings=12)
        no_ink(ellipsoid(f'Eye glint big {side}', (0.009, 0.026, 0.016), (0.0075, 0.004, 0.0085), 'cream', parent=fr, seg=12, rings=6))
        no_ink(ellipsoid(f'Eye glint small {side}', (-0.008, 0.025, -0.006), (0.0038, 0.003, 0.0042), 'cream', parent=fr, seg=10, rings=6))

    # button nose, big open grin with top teeth and tongue, pink cheeks
    p, n = face_pt(0.0, 0.942)
    ellipsoid('Button nose', tuple(p + n * 0.004), (0.019, 0.014, 0.015), 'skin', rot=n.to_track_quat('Y', 'Z').to_euler(), seg=24, rings=12)
    MW = 0.06
    zu = lambda x: 0.912 - 0.011 * (1 - (x / MW) ** 2)
    zl = lambda x: 0.910 - 0.054 * max(0.0, 1 - (x / MW) ** 2) ** 0.7
    xs = [MW * math.sin(math.pi / 2 * (2 * i / 30 - 1)) for i in range(31)]
    mouth = [(x, zu(x)) for x in xs] + [(x, zl(x)) for x in reversed(xs[1:-1])]
    decal('Grin mouth', mouth, fmask, 0.0016, 0.0012, 'ink', rings=5)
    tw = 0.043; txs = [tw * math.sin(math.pi / 2 * (2 * i / 24 - 1)) for i in range(25)]
    no_ink(band_decal('Grin top teeth', txs, lambda x: zu(x) - 0.0025, lambda x: zu(x) - 0.0025 - 0.0105 * math.sqrt(max(0.0, 1 - (x / tw) ** 2)) ** 0.6,
                      fmask, 0.0028, 0.0012, 'cream', rows=3))
    tongue = [(0.027 * math.cos(math.tau * i / 28), 0.873 + 0.013 * math.sin(math.tau * i / 28)) for i in range(28)]
    no_ink(decal('Grin tongue', tongue, fmask, 0.0028, 0.0012, 'tongue', rings=3))
    for sx, side in ((1, 'right'), (-1, 'left')):
        blush = [(0.088 * sx + 0.021 * math.cos(math.tau * i / 24), 0.914 + 0.012 * math.sin(math.tau * i / 24)) for i in range(24)]
        no_ink(decal(f'Cheek blush {side}', blush, fmask, 0.0014, 0.001, 'blush', rings=3))

    # chestnut fringe spilling out under the hood rim, sweeping toward its right
    for k, (x0, L, curl) in enumerate(((-0.085, 0.055, 0.004), (-0.045, 0.06, 0.006), (-0.005, 0.05, 0.004))):
        z0 = hole_top(x0) + 0.012
        uv = [(x0, z0), (x0 + 0.35 * L, z0 - 0.012), (x0 + 0.7 * L, z0 - 0.024), (x0 + L, z0 - 0.032), (x0 + L + 0.008, z0 - 0.03 + curl)]
        pts = []
        for u, v in uv:
            pp, nn = face_pt(u, v); pts.append(pp + nn * 0.011)
        sweep(f'Hair fringe lock {k}', pts, [0.018, 0.019, 0.015, 0.008, 0.0028], 'hair', n=16, per=10)

    # cream web on the hood, radiating from the crown (meridians plus sagging rings), clear of the face opening
    keep = lambda p: not in_hole(p, 1.17)
    NM = 8; TH_END = 1.3
    phis = [math.radians(22.5 + 45 * k) for k in range(NM)]
    for k, ph in enumerate(phis):
        line = [hood_pt(0.03 + (TH_END - 0.03) * i / 50, ph, 1.012) for i in range(51)]
        runs = split_runs(line, keep)
        for j, run in enumerate(runs):
            no_ink(sweep(f'Hood web meridian {k} {j}', run, [0.0042, 0.0042], 'cream', n=8, per=1)[0])
        if runs and len(runs[0]) == len(line):                  # dew drop at the tip of each full strand
            no_ink(ellipsoid(f'Hood web dew drop {k}', tuple(hood_pt(TH_END + 0.02, ph, 1.02)), (0.0095, 0.0095, 0.0095), 'cream', seg=14, rings=8))
    for rk, th in enumerate((0.52, 1.0)):
        for k in range(NM):
            a0 = phis[k]; a1 = phis[(k + 1) % NM] + (math.tau if k == NM - 1 else 0.0)
            line = [hood_pt(th * (1 - 0.1 * math.sin(math.pi * i / 16)), a0 + (a1 - a0) * i / 16, 1.012) for i in range(17)]
            for j, run in enumerate(split_runs(line, keep)):
                no_ink(sweep(f'Hood web ring {rk} {k} {j}', run, [0.0038, 0.0038], 'cream', n=8, per=1)[0])
    no_ink(ellipsoid('Crown web knot', tuple(hood_pt(0.0, 0.0, 1.012)), (0.009, 0.009, 0.006), 'cream', seg=12, rings=6))

    # --- Tilt the whole head group on the neck pivot -------------------------------------------------------------
    piv = empty('Head tilt pivot', tuple(PIVOT))
    bpy.context.view_layer.update(); inv = piv.matrix_world.inverted()
    for ob in PARTS[head_start:] + EMPTIES[head_empty_start:-1]:
        if ob.parent is None:
            ob.parent = piv; ob.matrix_parent_inverse = inv
    piv.rotation_euler = (0.0, HEAD_ROLL, 0.0)
    for ob in PARTS: ob['work_order'] = 'WO111'; ob['asset_id'] = 'web-slinger-helper'

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

TOP_KEYS = ('Cobalt hood', 'Hood web', 'Waving mitten right', 'Mitten thumb right', 'Round face', 'Tangerine domino mask', 'Eye white',
            'Chest star emblem', 'Cobalt torso', 'Tangerine belt', 'Hip fist left', 'Web rope coil loop', 'Boot rolled cuff')

if __name__ == '__main__':
    sc = bpy.context.scene
    assert sc.get('asset_id') == 'web-slinger-helper' and sc.get('scene_lease') == 'active'
    t0 = datetime.datetime.now(datetime.timezone.utc)
    build(); bpy.context.view_layer.update()
    m, per = measure()
    tops = {k.strip(): round(max(v for n, v in per.items() if n.startswith(k)), 4) for k in TOP_KEYS}
    sc['blockout_bounds_m'] = json.dumps(m); sc['blockout_tops_m'] = json.dumps(tops)
    sc['orientation'] = 'Blender +Z up/+Y forward; glTF +Y up/-Z forward; floor-centred origin; character right = +X'
    path = ROOT / 'web-slinger-helper-blockout.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(path), compress=True)
    rec = {'saved': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bounds_blender_zup': m, 'feature_tops_m': tops,
           'parts': len(PARTS), 'materials': sorted(x.name for x in bpy.data.materials),
           'build_seconds': round((datetime.datetime.now(datetime.timezone.utc) - t0).total_seconds(), 1),
           'utc': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    (ROOT / 'blockout-measurements.json').write_text(json.dumps(rec, indent=2) + '\n')
    print(json.dumps(rec))
