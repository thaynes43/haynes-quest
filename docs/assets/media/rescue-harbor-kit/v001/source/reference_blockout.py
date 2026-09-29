"""WO111 rescue-harbor-kit v001: painted flat-colour BLOCKOUT of the four World A chapter 2 harbor props.

Reference-sheet stage only: bevelled primitives, lathes, sweeps, a lofted hull and outline slabs. No final topology,
no atlas, no GLB. Blender +Z up, each prop's visible FRONT faces -Y (glTF +Z, the theme-kit registry's "+Z toward the
player at rotation 0"), origin at the floor centre of its footprint. Viewer's right = +X. All dimensions in metres.

The prop ids and bounding boxes are the harbor entries of src/shared/theme-kits.ts on origin/main (box(halfX, height,
halfZ)); every part stays inside its box so the decor already placed in World A chapter 2 (scripts/levels/family/a2.ts,
every harbor prop stood on the water plane y = -1.4) stays valid:
  lookout-tower-facade  box(1.8, 7, 1.8)     rescue HQ at spawn (scale 1.5) and the far lookout beyond the crown (scale 3)
  pier-bollard          box(0.3, 0.8, 0.3)   dock pilings at scale 1.1, pier and market pilings at scale 2
  rescue-buoy-stand     box(0.6, 1.8, 0.25)  six posts at the dock and beach corners, scale 1.6, turned +-90 deg; the A2
                                             foothold test needs their tops >= 1.4 m above the dock, so the stand stays
                                             >= 1.775 m tall even if the registry is tightened (built to 1.798 m)
  small-boat            box(1.2, 1.1, 2.6)   twelve moored boats at scale 0.8, any heading; its length runs along Z
Each prop is its own collection under the master collection, all floor-centred at the world origin.
Adapted from the playroom-kit v001 blockout (same session lineage, same helpers and conventions).
"""
import bpy, bmesh, math, json, hashlib, datetime
from mathutils import Vector, Matrix
from pathlib import Path

ROOT = Path('/workspace/haynes-quest/family-eras/rescue-harbor-kit/v001')
MASTER = 'Rescue harbor kit blockout (master)'
REGISTRY = {  # origin/main src/shared/theme-kits.ts: box(halfX, height, halfZ), glTF metres (halfZ = Blender half-depth in Y)
    'lookout-tower-facade': (1.8, 7.0, 1.8), 'pier-bollard': (0.3, 0.8, 0.3),
    'rescue-buoy-stand': (0.6, 1.8, 0.25), 'small-boat': (1.2, 1.1, 2.6),
}
PROPS = list(REGISTRY)

PAL = {
    'cream': '#f2efe6', 'red': '#d64533', 'yellow': '#f7c948', 'coral': '#f08a5d',
    'driftwood': '#d9c3a0', 'wood': '#a8835b', 'wetwood': '#6e5238', 'rope': '#dcc18c',
    'aqua': '#8fd6e6', 'sea': '#2f7fb8', 'navy': '#2e4a62', 'stone': '#8c979f',
}
# finish -> (roughness, specular): painted wood and metal read satin, weathered timber and rope matte, iron a little
# sheen; 'gloss' is window glass, 'lamp' the beacon glass (a touch of emission).
FINISH = {'paint': (0.55, 0.32), 'wood': (0.88, 0.12), 'rope': (0.95, 0.06), 'iron': (0.42, 0.45), 'stone': (0.92, 0.08)}

def lin(h):
    h = h.lstrip('#'); out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)

MATS = {}
def mat(key, finish='paint'):
    tag = (key, finish)
    if tag in MATS: return MATS[tag]
    m = bpy.data.materials.new(f'RH {finish} {key} {PAL[key]}'); m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = lin(PAL[key])
    if finish in ('gloss', 'lamp'):
        bs.inputs['Roughness'].default_value = 0.18; bs.inputs['Specular IOR Level'].default_value = 0.6
        bs.inputs['Emission Color'].default_value = lin(PAL[key])
        bs.inputs['Emission Strength'].default_value = 0.2 if finish == 'gloss' else 0.9
    else:
        r, s = FINISH[finish]
        bs.inputs['Roughness'].default_value = r; bs.inputs['Specular IOR Level'].default_value = s
    m.diffuse_color = lin(PAL[key]); m['palette_hex'] = PAL[key]; m['finish'] = finish
    MATS[tag] = m; return m

PARTS = []
CUR = {'prop': None}
def link(name, data, key, finish='paint', smooth=True):
    coll = bpy.data.collections['RH ' + CUR['prop']]
    ob = bpy.data.objects.new(CUR['prop'] + ' | ' + name, data); coll.objects.link(ob)
    data.materials.append(mat(key, finish))
    if smooth and hasattr(data, 'polygons'):
        for p in data.polygons: p.use_smooth = True
    ob['blockout_part'] = name; ob['kit_prop'] = CUR['prop']; PARTS.append(ob); return ob

def no_ink(ob):
    ob['sheet_no_ink'] = True; return ob

def bevel(ob, w, seg=3, angle=30):
    md = ob.modifiers.new('Soft painted edge', 'BEVEL'); md.width = w; md.segments = seg; md.limit_method = 'ANGLE'
    md.angle_limit = math.radians(angle); md.harden_normals = False
    return ob

def wnormals(ob):
    wn = ob.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL'); wn.keep_sharp = True; return ob

def rbox(name, center, size, key, rotz=0.0, bev=0.02, seg=3, finish='paint'):
    me = bpy.data.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bm.to_mesh(me); bm.free()
    for v in me.vertices: v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    ob = link(name, me, key, finish); ob.location = center; ob.rotation_euler = (0, 0, rotz)
    if bev: bevel(ob, bev, seg)
    return wnormals(ob)

def frame(y_axis, z_hint, origin=(0, 0, 0)):
    """World matrix whose local +Y is y_axis and local +Z is as close to z_hint as possible."""
    Y = Vector(y_axis).normalized(); Z = Vector(z_hint); Z = (Z - Z.dot(Y) * Y).normalized(); X = Y.cross(Z)
    M = Matrix((X, Y, Z)).transposed().to_4x4(); M.translation = Vector(origin); return M

def beam(name, a, b, w, d, key, normal=(0, -1, 0), bev=0.015, finish='wood'):
    """Square-section timber from a to b: width w in the face plane, depth d along the (orthogonalised) face normal."""
    a = Vector(a); b = Vector(b); L = (b - a).length; Z = (b - a).normalized()
    Y = Vector(normal); Y = (Y - Y.dot(Z) * Z).normalized(); X = Y.cross(Z)
    me = bpy.data.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bm.to_mesh(me); bm.free()
    for v in me.vertices: v.co = Vector((v.co.x * w, v.co.y * d, v.co.z * L))
    ob = link(name, me, key, finish)
    M = Matrix((X, Y, Z)).transposed().to_4x4(); M.translation = (a + b) / 2; ob.matrix_world = M
    if bev: bevel(ob, bev, 2)
    return wnormals(ob)

def cyl(name, loc, r1, r2, depth, key, rot=(0, 0, 0), seg=48, bev=0.006, finish='paint'):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r1, radius2=r2, depth=depth)
    bm.to_mesh(me); bm.free()
    ob = link(name, me, key, finish); ob.location = loc; ob.rotation_euler = rot
    if bev: bevel(ob, bev, 3)
    return wnormals(ob)

def along(ob, a, b):
    a = Vector(a); b = Vector(b); ob.location = (a + b) / 2
    ob.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler(); return ob

def rod(name, a, b, r1, r2, key, seg=40, bev=0.004, finish='paint'):
    return along(cyl(name, (0, 0, 0), r1, r2, (Vector(b) - Vector(a)).length, key, seg=seg, bev=bev, finish=finish), a, b)

def ellipsoid(name, loc, s, key, rot=(0, 0, 0), seg=40, rings=20, finish='paint'):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0); bm.to_mesh(me); bm.free()
    ob = link(name, me, key, finish); ob.location = loc; ob.scale = s; ob.rotation_euler = rot; return ob

def half_ellipsoid(name, loc, s, key, seg=48, rings=24, finish='paint'):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-5], context='VERTS')
    bmesh.ops.contextual_create(bm, geom=[e for e in bm.edges if e.is_boundary])
    bm.to_mesh(me); bm.free()
    ob = link(name, me, key, finish); ob.location = loc; ob.scale = s; return ob

def lathe(name, prof, key, loc=(0, 0, 0), seg=40, finish='paint'):
    """Surface of revolution about local Z from a profile [(r, z)] listed bottom to top; r = 0 ends become poles."""
    bm = bmesh.new(); rings = []
    for r, z in prof:
        if r < 1e-6: rings.append([bm.verts.new((0, 0, z))])
        else: rings.append([bm.verts.new((r * math.cos(math.tau * k / seg), r * math.sin(math.tau * k / seg), z)) for k in range(seg)])
    for A, B in zip(rings, rings[1:]):
        for k in range(seg):
            if len(A) == 1 and len(B) == 1: continue
            if len(A) == 1: bm.faces.new((A[0], B[k], B[(k + 1) % seg]))
            elif len(B) == 1: bm.faces.new((A[k], A[(k + 1) % seg], B[0]))
            else: bm.faces.new((A[k], A[(k + 1) % seg], B[(k + 1) % seg], B[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = link(name, me, key, finish); ob.location = loc; return ob

def slab(name, pts, y0, y1, key, M=None, bev=0.0, seg=3, finish='paint'):
    """Closed prism: 2-D outline pts[(x, z)] (any winding, may be concave) extruded along local Y from y0 to y1."""
    bm = bmesh.new()
    fr = [bm.verts.new((x, y0, z)) for x, z in pts]; bk = [bm.verts.new((x, y1, z)) for x, z in pts]
    n = len(pts)
    bm.faces.new(fr); bm.faces.new(list(reversed(bk)))
    for i in range(n):
        j = (i + 1) % n; bm.faces.new((fr[i], fr[j], bk[j], bk[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = link(name, me, key, finish, smooth=False)
    if M is not None: ob.matrix_world = M
    if bev: bevel(ob, bev, seg)
    for p in me.polygons: p.use_smooth = True
    return wnormals(ob)

def shape_on(name, pts, thick, key, normal, center, up=(0, 0, 1), bev=0.006, finish='paint'):
    """Raised decal: outline pts[(u, v)] (u right, v up as seen facing the surface) standing proud along normal."""
    n = Vector(normal).normalized()
    M = frame(-n, up, Vector(center))                    # local -Y points out of the surface, local Z up
    return slab(name, list(pts), -thick, 0.0, key, M=M, bev=bev, seg=2, finish=finish)

def cyl_decal(name, pts, radius, zc, key, theta_c=0.0, proud=0.012, embed=0.01, finish='paint'):
    """Decal wrapped exactly round a vertical cylinder about the local origin: outline pts[(u, v)], u along the
    circumference (arc length), v up; theta 0 faces -Y (the prop front)."""
    bm = bmesh.new(); n = len(pts)
    def P(u, v, rr):
        th = theta_c + u / radius
        return (rr * math.sin(th), -rr * math.cos(th), zc + v)
    fr = [bm.verts.new(P(u, v, radius + proud)) for u, v in pts]; bk = [bm.verts.new(P(u, v, radius - embed)) for u, v in pts]
    bm.faces.new(fr); bm.faces.new(list(reversed(bk)))
    for i in range(n):
        j = (i + 1) % n; bm.faces.new((fr[i], fr[j], bk[j], bk[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    return link(name, me, key, finish, smooth=False)

def wavy_band(name, R0, R1, z0, ztop, key, n=96, finish='paint'):
    """Closed collar between radii R0 < R1 round a vertical axis, from z0 up to a wavy top edge ztop(theta)."""
    bm = bmesh.new(); OB, OT, IB, IT = [], [], [], []
    for i in range(n):
        th = math.tau * i / n; cx, cy = math.sin(th), -math.cos(th); zt = ztop(th)
        OB.append(bm.verts.new((R1 * cx, R1 * cy, z0))); OT.append(bm.verts.new((R1 * cx, R1 * cy, zt)))
        IB.append(bm.verts.new((R0 * cx, R0 * cy, z0))); IT.append(bm.verts.new((R0 * cx, R0 * cy, zt)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((OB[i], OB[j], OT[j], OT[i])); bm.faces.new((IB[j], IB[i], IT[i], IT[j]))
        bm.faces.new((OT[i], OT[j], IT[j], IT[i])); bm.faces.new((IB[i], IB[j], OB[j], OB[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for e in bm.edges:
        if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > math.radians(45): e.smooth = False
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    return link(name, me, key, finish)

def catmull(pts, per=6):
    """Dense Catmull-Rom polyline through pts (end points repeated), for ropes that should hang smoothly."""
    P = [Vector(p) for p in pts]; P = [P[0]] + P + [P[-1]]; out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(per):
            t = k / per
            out.append(tuple(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)))
    out.append(tuple(P[-2])); return out

def sweep(name, pts, r, key, n=20, closed=False, finish='paint'):
    """Round tube along a dense polyline with capped ends (or closed into a ring)."""
    P = [Vector(p) for p in pts]; m = len(P); verts = []; faces = []
    Nprev = None
    for i in range(m):
        a = P[(i - 1) % m] if (closed or i > 0) else P[i]; b = P[(i + 1) % m] if (closed or i < m - 1) else P[i]
        T = (b - a).normalized()
        if Nprev is None:
            Nh = Vector((0, 0, 1)) if abs(T.z) < 0.9 else Vector((1, 0, 0)); N = (Nh - Nh.dot(T) * T).normalized()
        else:
            N = (Nprev - Nprev.dot(T) * T).normalized()
        B = T.cross(N); Nprev = N
        for j in range(n):
            ang = math.tau * j / n; verts.append(tuple(P[i] + r * (math.cos(ang) * N + math.sin(ang) * B)))
    rng = m if closed else m - 1
    for i in range(rng):
        i2 = (i + 1) % m
        for j in range(n): faces.append((i * n + j, i * n + (j + 1) % n, i2 * n + (j + 1) % n, i2 * n + j))
    if not closed:
        faces.append(tuple(range(n - 1, -1, -1))); faces.append(tuple((m - 1) * n + j for j in range(n)))
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    return link(name, me, key, finish)

# --- 2-D outline helpers (counter-clockwise, x right, z up) -----------------------------------------------------------
def arc(cx, cz, rx, rz, a0, a1, n):
    return [(cx + rx * math.cos(a0 + (a1 - a0) * i / n), cz + rz * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]

def rrect(x0, x1, z0, z1, r, n=8):
    return (arc(x1 - r, z0 + r, r, r, -math.pi / 2, 0, n) + arc(x1 - r, z1 - r, r, r, 0, math.pi / 2, n)
            + arc(x0 + r, z1 - r, r, r, math.pi / 2, math.pi, n) + arc(x0 + r, z0 + r, r, r, math.pi, 1.5 * math.pi, n))

def soften(pts, f, n):
    """Round each corner of a polygon with a quadratic Bezier between points f of the way along its edges."""
    out = []; m = len(pts)
    for i in range(m):
        p0 = Vector(pts[i - 1]); p1 = Vector(pts[i]); p2 = Vector(pts[(i + 1) % m])
        a = p1 + (p0 - p1) * f; b = p1 + (p2 - p1) * f
        for s in range(n + 1):
            t = s / n; q = (1 - t) ** 2 * a + 2 * (1 - t) * t * p1 + t * t * b; out.append((q.x, q.y))
    return out

def star(r_out, r_in, k=5, round_n=3, f=0.28):
    pts = []
    for i in range(2 * k):
        a = math.pi / 2 + math.pi * i / k; r = r_out if i % 2 == 0 else r_in
        pts.append((r * math.cos(a), r * math.sin(a)))
    return soften(pts, f, round_n)

def circle(r, n=40, rz=None):
    rz = r if rz is None else rz
    return [(r * math.cos(math.tau * i / n), rz * math.sin(math.tau * i / n)) for i in range(n)]

def bone(w, h, n=180):
    """Cartoon dog-bone outline, w wide and h tall: a bar with two round knobs at each end (radial SDF trace)."""
    kr = h * 0.30; kx = w / 2 - kr; kz = h / 2 - kr; bh = h * 0.21
    def inside(x, z):
        if abs(x) <= kx and abs(z) <= bh: return True
        return any((x - sx * kx) ** 2 + (z - sz * kz) ** 2 <= kr * kr for sx in (-1, 1) for sz in (-1, 1))
    pts = []
    for i in range(n):
        a = math.tau * i / n; c, s = math.cos(a), math.sin(a); lo, hi = 0.0, w
        for _ in range(40):
            mid = (lo + hi) / 2
            if inside(c * mid, s * mid): lo = mid
            else: hi = mid
        pts.append((c * lo, s * lo))
    return pts

def paw(scale=1.0):
    """Paw print as (outline, centre) pairs: the main pad and four toe beans, about 0.28 x 0.24 at scale 1."""
    s = scale
    pad = [(x * s, z * s) for x, z in soften([(-0.095, -0.075), (0.095, -0.075), (0.065, 0.035), (-0.065, 0.035)], 0.4, 6)]
    toes = [((x * s, z * s), [(u * s, v * s) for u, v in circle(0.03, 24, 0.04)]) for x, z in
            ((-0.108, 0.07), (-0.04, 0.118), (0.04, 0.118), (0.108, 0.07))]
    return [(pad, (0.0, 0.0))] + [(pts, c) for c, pts in toes]

def ring_segments(name, c, u, v, R, r, cols, nseg=8, per=10, finish='paint'):
    """Life ring: a torus of nseg swept arcs alternating through cols, lying in the plane spanned by u and v."""
    c = Vector(c); u = Vector(u).normalized(); v = Vector(v).normalized(); obs = []
    for k in range(nseg):
        a0 = math.tau * k / nseg + math.pi / nseg; a1 = a0 + math.tau / nseg
        pts = [c + R * (math.cos(a0 + (a1 - a0) * i / per) * u + math.sin(a0 + (a1 - a0) * i / per) * v) for i in range(per + 1)]
        obs.append(sweep(f'{name} segment {k + 1} ({cols[k % len(cols)]})', pts, r, cols[k % len(cols)], n=18, finish=finish))
    return obs

def grab_line(name, c, u, v, R, r, rope_r=0.013, swag=None):
    """The rope grab line round a life ring's outside: clipped round the tube at the four cream bands (0, 90, 180 and
    270 deg) and swagged outward between the clips."""
    c = Vector(c); u = Vector(u).normalized(); v = Vector(v).normalized(); pts = []; swag = 0.16 * R if swag is None else swag
    for i in range(128):
        a = math.tau * i / 128; rho = R + r * 0.95 + swag * abs(math.sin(2 * a)) ** 0.8
        pts.append(c + rho * (math.cos(a) * u + math.sin(a) * v))
    obs = [sweep(name, pts, rope_r, 'rope', n=10, closed=True, finish='rope')]
    nrm = u.cross(v)
    for k in range(4):
        a = k * math.pi / 2; D = math.cos(a) * u + math.sin(a) * v; cc = c + R * D
        obs.append(sweep(f'{name} clip {k + 1}', [cc + (r + 0.011) * (math.cos(t) * D + math.sin(t) * nrm) for t in [math.tau * i / 20 for i in range(20)]],
                         rope_r * 0.95, 'rope', n=8, closed=True, finish='rope'))
    return obs

def clear_scene():
    if bpy.context.object and bpy.context.object.mode != 'OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    for coll in list(bpy.data.collections): bpy.data.collections.remove(coll)
    for blocks in (bpy.data.meshes, bpy.data.curves, bpy.data.metaballs, bpy.data.armatures, bpy.data.materials, bpy.data.actions,
                   bpy.data.cameras, bpy.data.lights, bpy.data.images, bpy.data.linestyles, bpy.data.worlds, bpy.data.textures):
        for b in list(blocks): blocks.remove(b)
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)

def begin(prop):
    CUR['prop'] = prop
    c = bpy.data.collections.new('RH ' + prop); bpy.data.collections[MASTER].children.link(c)

# =====================================================================================================================
# 1. lookout-tower-facade: a rescue lookout on a splayed timber trestle, red cabin, yellow hip roof and a beacon
# =====================================================================================================================
FOOT = 1.45; TOPL = 1.12; ZF = 0.28; ZD = 3.25          # leg centres: 1.45 m out at the footings, 1.12 m under the deck
DECK = 3.45; CAB = 1.10; EAVE = 5.45; APEX = 6.30

def leg_d(z):
    return FOOT - (FOOT - TOPL) * (z - ZF) / (ZD - ZF)

def build_tower():
    begin('lookout-tower-facade')
    for sx in (-1, 1):
        for sy in (-1, 1):
            tag = ('left' if sx < 0 else 'right') + (' front' if sy < 0 else ' back')
            rbox(f'Stone footing {tag}', (sx * FOOT, sy * FOOT, ZF / 2), (0.6, 0.6, ZF), 'stone', bev=0.05, finish='stone')
            beam(f'Timber leg {tag}', (sx * FOOT, sy * FOOT, ZF - 0.03), (sx * TOPL, sy * TOPL, ZD + 0.02), 0.24, 0.24, 'wood',
                 normal=(sx, sy, 0), bev=0.02)
    # X-bracing and a girt on every side, fixed to the outer faces of the leaning legs
    sides = {'front': ((1, 0), (0, -1)), 'back': ((-1, 0), (0, 1)), 'left': ((0, -1), (-1, 0)), 'right': ((0, 1), (1, 0))}
    for side, ((ax, ay), (nx, ny)) in sides.items():
        def at(sgn, z, off):
            d = leg_d(z); return (sgn * ax * d + nx * (d + off), sgn * ay * d + ny * (d + off), z)
        for tier, (z0, z1) in enumerate(((0.50, 1.72), (1.88, 3.10))):
            beam(f'Brace {side} {tier + 1}a', at(-1, z0, 0.14), at(1, z1, 0.14), 0.09, 0.05, 'driftwood', normal=(nx, ny, 0), bev=0.01)
            beam(f'Brace {side} {tier + 1}b', at(1, z0, 0.19), at(-1, z1, 0.19), 0.09, 0.05, 'driftwood', normal=(nx, ny, 0), bev=0.01)
        beam(f'Girt {side}', at(-1.12, 1.80, 0.15), at(1.12, 1.80, 0.15), 0.10, 0.06, 'wood', normal=(nx, ny, 0), bev=0.01)
    # rescue ladder up the front: yellow rails that rise past the deck as grab handles, weathered rungs
    lean = (1.74 - 1.44) / 4.2
    for side, x in (('left', -0.30), ('right', 0.30)):
        rod(f'Ladder rail {side}', (x, -1.74, 0.005), (x, -1.44, 4.20), 0.04, 0.04, 'yellow', seg=20, bev=0.006)
        ellipsoid(f'Ladder rail cap {side}', (x, -1.44, 4.22), (0.05, 0.05, 0.05), 'red', seg=20, rings=10)
    for k in range(11):
        z = 0.30 + 0.30 * k; y = -1.74 + lean * z
        rod(f'Ladder rung {k + 1:02d}', (-0.30, y, z), (0.30, y, z), 0.03, 0.03, 'wood', seg=16, bev=0.0, finish='wood')
    # deck: red fascia frame under a driftwood plank top
    rbox('Deck fascia', (0, 0, 3.32), (3.04, 3.04, 0.14), 'red', bev=0.02)
    rbox('Deck planks', (0, 0, 3.42), (2.94, 2.94, 0.06), 'driftwood', bev=0.012, finish='wood')
    # yellow balcony railing, open at the ladder
    posts = [(-1.42, -1.42), (-0.42, -1.42), (0.42, -1.42), (1.42, -1.42), (1.42, 0.0), (1.42, 1.42), (0.0, 1.42), (-1.42, 1.42), (-1.42, 0.0)]
    for k, (x, y) in enumerate(posts):
        rbox(f'Rail post {k + 1}', (x, y, (DECK + 4.36) / 2), (0.08, 0.08, 4.36 - DECK), 'yellow', bev=0.012)
    runs = [((-1.42, -1.42), (-0.42, -1.42)), ((0.42, -1.42), (1.42, -1.42)), ((1.42, -1.42), (1.42, 1.42)),
            ((1.42, 1.42), (-1.42, 1.42)), ((-1.42, 1.42), (-1.42, -1.42))]
    for k, ((x0, y0), (x1, y1)) in enumerate(runs):
        for z, tag in ((4.33, 'top'), (3.90, 'mid')):
            rod(f'Rail {tag} {k + 1}', (x0, y0, z), (x1, y1, z), 0.035, 0.035, 'yellow', seg=16, bev=0.0)
    # life ring hung on the front rail, and a telescope on a tripod at the front-right corner
    c = (-0.92, -1.525, 3.975)
    ring_segments('Balcony life ring', c, (1, 0, 0), (0, 0, 1), 0.25, 0.064, ['red', 'cream'])
    grab_line('Balcony life ring grab line', c, (1, 0, 0), (0, 0, 1), 0.25, 0.064)
    sweep('Life ring hanging loop', [(-0.92 + 0.05 * math.cos(a), -1.46 + 0.06 * math.sin(a), 4.29 + 0.03 * math.sin(a)) for a in
                                     [math.tau * i / 24 for i in range(24)]], 0.012, 'rope', n=8, closed=True, finish='rope')
    tx, ty = 0.98, -0.98
    for k, a in enumerate((90, 210, 330)):
        a = math.radians(a)
        rod(f'Tripod leg {k + 1}', (tx + 0.26 * math.cos(a), ty + 0.26 * math.sin(a), DECK), (tx, ty, 4.46), 0.018, 0.014, 'navy', seg=10, bev=0.0, finish='iron')
    rod('Telescope tube', (0.80, -0.76, 4.48), (1.20, -1.26, 4.62), 0.045, 0.07, 'navy', seg=28, bev=0.004, finish='iron')
    rod('Telescope eyepiece band', (0.78, -0.735, 4.475), (0.84, -0.81, 4.495), 0.052, 0.052, 'yellow', seg=28, bev=0.003)
    rod('Telescope lens band', (1.16, -1.21, 4.606), (1.22, -1.285, 4.626), 0.078, 0.078, 'yellow', seg=28, bev=0.003)
    no_ink(rod('Telescope lens', (1.215, -1.28, 4.624), (1.225, -1.292, 4.628), 0.058, 0.058, 'aqua', seg=28, bev=0.0, finish='gloss'))
    # red cabin with a wraparound window band, an arched doghouse door and a blank bone sign
    rbox('Cabin walls', (0, 0, (DECK + EAVE) / 2), (2 * CAB, 2 * CAB, EAVE - DECK), 'red', bev=0.03)
    WZ0, WZ1 = 4.22, 5.04; wz = (WZ0 + WZ1) / 2
    for side, (nx, ny) in (('left', (-1, 0)), ('right', (1, 0)), ('back', (0, 1))):
        n = Vector((nx, ny, 0)); t = Vector((-ny, nx, 0))
        fsize = (0.04, 1.90, WZ1 - WZ0) if nx else (1.90, 0.04, WZ1 - WZ0)
        rbox(f'Window frame {side}', tuple(n * (CAB + 0.015) + Vector((0, 0, wz))), fsize, 'cream', bev=0.01)
        for k, o in enumerate((-0.6, 0.0, 0.6)):
            psize = (0.03, 0.54, 0.64) if nx else (0.54, 0.03, 0.64)
            rbox(f'Window pane {side} {k + 1}', tuple(n * (CAB + 0.035) + t * o + Vector((0, 0, wz))), psize, 'aqua', bev=0.006, finish='gloss')
    for side, x in (('left', -0.75), ('right', 0.75)):
        rbox(f'Window frame front {side}', (x, -CAB - 0.015, wz), (0.62, 0.04, WZ1 - WZ0), 'cream', bev=0.01)
        rbox(f'Window pane front {side}', (x, -CAB - 0.035, wz), (0.50, 0.03, 0.64), 'aqua', bev=0.006, finish='gloss')
    DR = 0.36; DZ = 4.62
    door = [(-DR, DECK + 0.005), (DR, DECK + 0.005)] + arc(0, DZ, DR, DR, 0, math.pi, 24)
    slab('Doghouse-arch door', door, -CAB - 0.04, -CAB + 0.01, 'yellow', bev=0.008)
    frame_pts = [(x, -CAB - 0.035, z) for x, z in [(-DR - 0.02, DECK + 0.02)] + arc(0, DZ, DR + 0.02, DR + 0.02, math.pi, 0, 28) + [(DR + 0.02, DECK + 0.02)]]
    sweep('Door frame', frame_pts, 0.035, 'cream', n=14)
    rod('Door porthole rim', (0, -CAB - 0.03, 4.52), (0, -CAB - 0.075, 4.52), 0.13, 0.13, 'cream', seg=40, bev=0.008)
    no_ink(rod('Door porthole pane', (0, -CAB - 0.07, 4.52), (0, -CAB - 0.082, 4.52), 0.092, 0.092, 'aqua', seg=40, bev=0.0, finish='gloss'))
    ellipsoid('Door knob', (0.25, -CAB - 0.065, 4.05), (0.035, 0.035, 0.035), 'navy', seg=16, rings=8, finish='iron')
    bz = 5.21
    slab('Bone sign', bone(0.92, 0.30), -0.03, 0.0, 'cream', M=Matrix.Translation((0, -CAB - 0.012, bz)), bev=0.008)
    for k, (pts, (px, pz)) in enumerate(paw(0.45)):
        no_ink(slab(f'Bone sign paw {k + 1}', pts, -0.008, 0.0, 'red', M=Matrix.Translation((px, -CAB - 0.042, bz + pz - 0.018))))
    # yellow hip roof with a red fascia and red hip ribs
    rbox('Roof fascia', (0, 0, EAVE), (2.96, 2.96, 0.12), 'red', bev=0.02)
    E = 1.47; z0 = EAVE + 0.06
    me = bpy.data.meshes.new('Hip roof')
    me.from_pydata([(-E, -E, z0), (E, -E, z0), (E, E, z0), (-E, E, z0), (0, 0, APEX)], [], [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4), (3, 2, 1, 0)])
    me.update(); roof = link('Hip roof', me, 'yellow', smooth=False); bevel(roof, 0.03, 2)
    for k, (sx, sy) in enumerate(((-1, -1), (1, -1), (1, 1), (-1, 1))):
        sweep(f'Hip rib {k + 1}', [(sx * E * (1 - f), sy * E * (1 - f), z0 + 0.02 + (APEX - z0) * f) for f in [i / 12 for i in range(13)]], 0.045, 'red', n=12)
    # rotating beacon with loudhailer horns on a navy drum
    cyl('Beacon drum', (0, 0, 6.29), 0.20, 0.20, 0.22, 'navy', seg=40, bev=0.012, finish='iron')
    cyl('Beacon glass', (0, 0, 6.53), 0.16, 0.16, 0.26, 'yellow', seg=40, bev=0.006, finish='lamp')
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        rbox(f'Beacon bar {k + 1}', (0.165 * math.cos(a), 0.165 * math.sin(a), 6.53), (0.03, 0.03, 0.26), 'cream', bev=0.006)
    half_ellipsoid('Beacon cap', (0, 0, 6.66), (0.20, 0.20, 0.13), 'red')
    ellipsoid('Beacon finial', (0, 0, 6.835), (0.05, 0.05, 0.05), 'cream', seg=20, rings=10)
    for side, s in (('left', -1), ('right', 1)):
        rod(f'Loudhailer horn {side}', (s * 0.17, 0, 6.29), (s * 0.54, 0, 6.34), 0.035, 0.12, 'red', seg=32, bev=0.004)
        no_ink(rod(f'Loudhailer mouth {side}', (s * 0.535, 0, 6.339), (s * 0.545, 0, 6.341), 0.10, 0.10, 'navy', seg=32, bev=0.0))

# =====================================================================================================================
# 2. pier-bollard: a weathered timber piling capped with a navy cast-iron mooring bollard and its rope
# =====================================================================================================================
PILE_R = 0.245

def build_bollard():
    begin('pier-bollard')
    cyl('Timber piling', (0, 0, 0.275), PILE_R, PILE_R, 0.55, 'wood', seg=48, bev=0.02, finish='wood')
    wavy_band('Wet tide band', PILE_R - 0.006, PILE_R + 0.006, 0.0, lambda th: 0.13 + 0.018 * math.sin(7 * th), 'wetwood', n=112, finish='wood')
    for k, (th, z, rr) in enumerate(((-0.55, 0.17, 0.022), (-0.42, 0.20, 0.016), (-0.66, 0.215, 0.015), (-0.30, 0.165, 0.018),
                                     (0.95, 0.18, 0.02), (1.08, 0.205, 0.014))):
        ellipsoid(f'Barnacle {k + 1}', (math.sin(th) * (PILE_R + 0.002), -math.cos(th) * (PILE_R + 0.002), z), (rr, rr * 0.55, rr * 0.9), 'cream',
                  rot=(0, 0, th), seg=16, rings=8)
    for k, z in enumerate((0.47,)):
        sweep(f'Iron strap {k + 1}', [(math.cos(a) * (PILE_R + 0.006), math.sin(a) * (PILE_R + 0.006), z) for a in
                                      [math.tau * i / 48 for i in range(48)]], 0.013, 'navy', n=10, closed=True, finish='iron')
    for k, (th, z0, z1) in enumerate(((0.55, 0.16, 0.40), (-0.35, 0.27, 0.52), (2.4, 0.18, 0.42), (-2.0, 0.26, 0.5))):
        no_ink(cyl_decal(f'Timber crack {k + 1}', rrect(-0.006, 0.006, 0, z1 - z0, 0.005, 2), PILE_R, z0, 'wetwood', theta_c=th, proud=0.003, embed=0.004))
    no_ink(cyl_decal('Starfish', [(u, v) for u, v in star(0.08, 0.034, round_n=3, f=0.32)], PILE_R + 0.001, 0.335, 'coral', theta_c=-0.28, proud=0.016))
    cyl('Bollard base plate', (0, 0, 0.565), 0.285, 0.276, 0.04, 'navy', seg=48, bev=0.008, finish='iron')
    lathe('Bollard body', [(0.0, 0.58), (0.19, 0.58), (0.169, 0.605), (0.147, 0.64), (0.15, 0.675), (0.175, 0.70), (0.0, 0.70)], 'navy', finish='iron')
    lathe('Bollard cap (safety yellow)', [(0.0, 0.695), (0.214, 0.695), (0.23, 0.713), (0.23, 0.745), (0.214, 0.768), (0.138, 0.783), (0.0, 0.787)], 'yellow')
    loop = [(0.172 * math.cos(a), 0.172 * math.sin(a), 0.648 + 0.018 * math.sin(a + 0.8)) for a in [math.tau * i / 48 for i in range(48)]]
    sweep('Mooring rope loop', loop, 0.021, 'rope', n=12, closed=True, finish='rope')
    polar = [(0.176, -0.95, 0.655), (0.23, -0.80, 0.64), (0.285, -0.68, 0.612), (0.306, -0.62, 0.575), (0.298, -0.60, 0.53),
             (0.272, -0.58, 0.47), (0.268, -0.56, 0.40), (0.268, -0.55, 0.33), (0.267, -0.54, 0.285)]
    tail = catmull([(r * math.cos(a), r * math.sin(a), z) for r, a, z in polar], per=6)   # hugs the plate edge and the piling
    sweep('Mooring rope tail', tail, 0.021, 'rope', n=12, finish='rope')
    ellipsoid('Rope end whipping', (tail[-1][0], tail[-1][1], 0.272), (0.026, 0.026, 0.022), 'rope', seg=16, rings=8, finish='rope')

# =====================================================================================================================
# 3. rescue-buoy-stand: two weathered posts, a yellow header, a navy backboard and a red-and-cream life ring
# =====================================================================================================================
def build_buoy():
    begin('rescue-buoy-stand')
    PY = 0.04
    for side, x in (('left', -0.46), ('right', 0.46)):
        rbox(f'Post {side}', (x, PY, 0.83), (0.12, 0.12, 1.66), 'wood', bev=0.02, finish='wood')   # tall enough: see a2 foothold note
        rbox(f'Post wet foot {side}', (x, PY, 0.08), (0.13, 0.13, 0.16), 'wetwood', bev=0.015, finish='wood')
        ellipsoid(f'Post cap ball {side}', (x, PY, 1.718), (0.08, 0.08, 0.08), 'red', seg=24, rings=12)
        for k, (dx, z0, z1) in enumerate(((-0.025, 0.25, 0.70), (0.02, 0.85, 1.20))):
            no_ink(rbox(f'Post grain {side} {k + 1}', (x + dx, PY - 0.061, (z0 + z1) / 2), (0.008, 0.004, z1 - z0), 'wetwood', bev=0))
    rbox('Lower rail', (0, PY, 0.42), (0.86, 0.08, 0.08), 'wood', bev=0.012, finish='wood')
    rbox('Navy backboard', (0, 0.06, 0.95), (0.84, 0.035, 0.84), 'navy', bev=0.012)
    rbox('Header board', (0, -0.05, 1.47), (1.14, 0.06, 0.26), 'yellow', bev=0.015)
    rbox('Header top trim', (0, -0.05, 1.615), (1.16, 0.075, 0.04), 'red', bev=0.01)
    wave = [(x, 1.362) for x in (0.55, -0.55)] + [(-0.55 + 1.10 * i / 64, 1.40 + 0.016 * math.sin(math.tau * 4.5 * i / 64)) for i in range(65)]
    no_ink(slab('Header wave strip', wave, -0.086, -0.078, 'sea'))
    slab('Header bone', bone(0.38, 0.13), -0.012, 0.0, 'cream', M=Matrix.Translation((0, -0.08, 1.49)), bev=0.004)
    # the life ring hangs from a peg through its hole
    rod('Ring peg', (0, 0.05, 1.187), (0, -0.19, 1.19), 0.02, 0.02, 'navy', seg=16, bev=0.003, finish='iron')
    ellipsoid('Ring peg knob', (0, -0.195, 1.19), (0.028, 0.02, 0.028), 'navy', seg=16, rings=8, finish='iron')
    c = (0, -0.13, 0.95)
    ring_segments('Life ring', c, (1, 0, 0), (0, 0, 1), 0.285, 0.072, ['red', 'cream'])
    grab_line('Life ring grab line', c, (1, 0, 0), (0, 0, 1), 0.285, 0.072, rope_r=0.014, swag=0.045)
    # coiled throw line on a hook on the right post
    rod('Coil hook', (0.46, -0.02, 1.08), (0.46, -0.10, 1.10), 0.014, 0.014, 'navy', seg=12, bev=0.0, finish='iron')
    for k in range(3):
        cz = 0.95 - 0.012 * k; cy = -0.075 - 0.018 * k
        sweep(f'Throw line coil {k + 1}', [(0.46 + (0.085 - 0.006 * k) * math.sin(a), cy, cz - 0.13 * math.cos(a) + 0.0) for a in
                                          [math.tau * i / 40 for i in range(40)]], 0.016, 'rope', n=10, closed=True, finish='rope')

# =====================================================================================================================
# 4. small-boat: a chunky clinker-style rescue rowboat with a yellow fender collar, oars and an outboard
# =====================================================================================================================
YB, YS = -2.38, 2.24          # stem foot and transom (Blender y; the bow faces -Y, the player)
RAKE = 0.10                   # the stem rakes forward toward the sheer
N_ST, N_SEC = 84, 14          # stations along the length, section points per side
ZF_FLOOR = 0.36; RIM = 0.08; WL0, WL1 = 0.15, 0.235   # floorboards, rim width, cream waterline stripe band

def smooth01(x):
    x = max(0.0, min(1.0, x)); return x * x * (3 - 2 * x)

def hull_b(t):
    if t < 0.55: return 0.03 + 0.99 * math.sin(0.5 * math.pi * t / 0.55) ** 0.85
    return 1.02 - 0.24 * ((t - 0.55) / 0.45) ** 2

def hull_s(t):
    return 0.74 + (0.21 * (1 - t / 0.6) ** 2 if t < 0.6 else 0.04 * ((t - 0.6) / 0.4) ** 2)

def hull_k(t):
    if t < 0.42: return 0.36 * (1 - t / 0.42) ** 2.2
    if t > 0.86: return 0.07 * ((t - 0.86) / 0.14) ** 2
    return 0.0

def hull_floor(t, s):
    if t < 0.12: return s
    if t < 0.22: return s + (ZF_FLOOR - s) * smooth01((t - 0.12) / 0.10)
    if t < 0.86: return ZF_FLOOR
    if t < 0.93: return ZF_FLOOR + (s - ZF_FLOOR) * smooth01((t - 0.86) / 0.07)
    return s

def hull_y(t, z, k, s):
    y = YB + (YS - YB) * t
    if t < 0.15: y -= RAKE * (1 - t / 0.15) ** 2 * max(0.0, min(1.0, (z - k) / max(s - k, 1e-6)))
    return y

def hull_point(t, ph, side=1):
    b, s, k = hull_b(t), hull_s(t), hull_k(t)
    z = k + (s - k) * (1 - math.cos(ph))
    return Vector((side * b * math.sin(ph), hull_y(t, z, k, s), z))

def hull_normal(t, ph, side=1):
    e = 1e-4
    dt = hull_point(min(t + e, 1), ph, side) - hull_point(max(t - e, 0), ph, side)
    dp = hull_point(t, ph + e, side) - hull_point(t, ph - e, side)
    n = dt.cross(dp).normalized()
    return n if n.x * side > 0 else -n

def section(t):
    b, s, k = hull_b(t), hull_s(t), hull_k(t); fz = hull_floor(t, s); bi = max(b - RIM, 0.004)
    ph = [0.5 * math.pi * i / N_SEC for i in range(N_SEC + 1)]
    o = lambda p, sd: (sd * b * math.sin(p), k + (s - k) * (1 - math.cos(p)))
    q = lambda p, sd: (sd * bi * math.sin(p), fz + (s - fz) * (1 - math.cos(p)))
    loop = [o(p, 1) for p in reversed(ph)] + [o(p, -1) for p in ph[1:]]            # outer: right sheer -> keel -> left sheer
    loop += [q(p, -1) for p in reversed(ph)] + [q(p, 1) for p in ph[1:]]           # inner: left sheer -> floor -> right sheer
    return [(x, hull_y(t, z, k, s), z) for x, z in loop], k, s

def build_hull():
    bm = bmesh.new(); tag = bm.faces.layers.int.new('hull_part'); rows = []
    for j in range(N_ST):
        t = j / (N_ST - 1); pts, _, _ = section(t); rows.append([bm.verts.new(p) for p in pts])
    M = len(rows[0]); n2 = 2 * N_SEC
    def part(i):
        if i < n2: return 0                 # outer skin
        if i == n2 or i == M - 1: return 1  # rim (gunwale top)
        return 2                            # inner skin and floor
    for j in range(N_ST - 1):
        for i in range(M):
            f = bm.faces.new((rows[j][i], rows[j][(i + 1) % M], rows[j + 1][(i + 1) % M], rows[j + 1][i])); f[tag] = part(i)
    f = bm.faces.new(list(reversed(rows[0]))); f[tag] = 3
    f = bm.faces.new(rows[-1]); f[tag] = 3
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for z in (WL0, WL1):
        geo = [f for f in bm.faces if f[tag] in (0, 3)]
        es = {e for f in geo for e in f.edges}; vs = {v for f in geo for v in f.verts}
        bmesh.ops.bisect_plane(bm, geom=list(vs) + list(es) + geo, dist=1e-6, plane_co=(0, 0, z), plane_no=(0, 0, 1))
    me = bpy.data.meshes.new('Hull'); keys = ['red', 'navy', 'cream', 'yellow', 'driftwood']
    order = []                                  # bm.to_mesh keeps the bm.faces iteration order
    for f in bm.faces:
        p = f[tag]; zc = f.calc_center_median().z
        if p in (0, 3): key = 'navy' if zc < WL0 else ('cream' if zc < WL1 else 'red')
        elif p == 1: key = 'yellow'
        elif f.normal.z > 0.9 and zc > 0.6: key = 'cream'      # foredeck and aft motor deck at the sheer
        else: key = 'driftwood'
        order.append(keys.index(key))
    for e in bm.edges:                           # sharp rim, transom and stem edges; smooth round-bilge skin
        if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > math.radians(38): e.smooth = False
    bm.to_mesh(me); bm.free()
    idx = dict(enumerate(order))
    ob = link('Hull (red topsides, cream waterline, navy bottom, driftwood inside)', me, 'red', smooth=True)
    for k in keys[1:]: me.materials.append(mat(k, 'wood' if k == 'driftwood' else 'paint'))
    for p in me.polygons: p.material_index = idx[p.index]
    return wnormals(ob)

def inner_half_width(t, z):
    b, s = hull_b(t), hull_s(t); fz = hull_floor(t, s); bi = max(b - RIM, 0.004)
    c = 1 - (z - fz) / max(s - fz, 1e-6); c = max(-1.0, min(1.0, c))
    return bi * math.sin(math.acos(c))

def t_of(y):
    return (y - YB) / (YS - YB)

def build_boat():
    begin('small-boat')
    build_hull()
    # yellow fender collar along the sheer, round the transom and the stem
    right = [hull_point(t, 0.5 * math.pi, 1) + Vector((0.035, 0, -0.005)) for t in [i / 60 for i in range(61)]]
    left = [hull_point(t, 0.5 * math.pi, -1) + Vector((-0.035, 0, -0.005)) for t in [i / 60 for i in range(61)]]
    sy = right[-1].y + 0.03
    stern = [Vector((right[-1].x * (1 - 2 * f), sy, right[-1].z)) for f in [i / 10 for i in range(1, 10)]]
    bow = [Vector((0, right[0].y - 0.03, right[0].z))]
    sweep('Fender collar', [tuple(p) for p in right[1:] + stern + list(reversed(left))[:-1] + bow], 0.07, 'yellow', n=18, closed=True)
    # thwarts (bench seats), floorboard seams and a pair of shipped oars
    for k, y in enumerate((-0.95, 0.15, 1.30)):
        hw = inner_half_width(t_of(y), 0.555) + 0.01
        rbox(f'Thwart {k + 1}', (0, y, 0.555), (2 * hw, 0.30, 0.05), 'wood', bev=0.01, finish='wood')
    for k, x in enumerate((-0.45, -0.15, 0.15, 0.45)):
        tmid = 0.5; bi = hull_b(tmid) - RIM; s = hull_s(tmid)
        ph = math.asin(min(1.0, abs(x) / bi)); z = ZF_FLOOR + (s - ZF_FLOOR) * (1 - math.cos(ph)) + 0.003
        no_ink(rbox(f'Floorboard seam {k + 1}', (x, 0.2, z), (0.018, 3.0, 0.004), 'wetwood', bev=0))
    for side, x in (('left', -0.30), ('right', 0.30)):
        rod(f'Oar shaft {side}', (x, 1.55, 0.635), (x * 0.9, -0.80, 0.635), 0.027, 0.027, 'driftwood', seg=16, bev=0.0, finish='wood')
        slab(f'Oar blade {side}', rrect(-0.075, 0.075, -0.52, 0.0, 0.05, 4), -0.012, 0.012, 'red',
             M=Matrix(((1, 0, 0, x * 0.9), (0, 0, 1, -0.78), (0, -1, 0, 0.635), (0, 0, 0, 1))))   # local z -> +Y, flat
        ph = 0.5 * math.pi; p = hull_point(t_of(0.15), ph, 1 if x > 0 else -1)
        rod(f'Oarlock {side}', (p.x + (0.035 if x > 0 else -0.035), 0.15, p.z + 0.05), (p.x + (0.035 if x > 0 else -0.035), 0.15, p.z + 0.12), 0.022, 0.022, 'navy', seg=12, bev=0.0, finish='iron')
    # rescue life rings strapped to both flanks, facing out along the hull normal
    for side, sd in (('port (-X)', -1), ('starboard (+X)', 1)):
        t = t_of(0.55); ph = 1.197; n = hull_normal(t, ph, sd); p = hull_point(t, ph, sd)
        u = Vector((0, 1, 0)); u = (u - u.dot(n) * n).normalized(); v = n.cross(u) if sd > 0 else u.cross(n)
        if v.z < 0: v = -v
        c = p + n * 0.05
        ring_segments(f'Flank life ring {side}', c, u, v, 0.16, 0.045, ['red', 'cream'], per=8)
    # cream paw prints on both bows (no lettering)
    for side, sd in (('port', -1), ('starboard', 1)):
        t = 0.30; ph = 1.2; n = hull_normal(t, ph, sd); p = hull_point(t, ph, sd)
        up = Vector((0, 0, 1)); up = (up - up.dot(n) * n).normalized(); right = (-n).cross(up).normalized()
        for k, (pts, (px, pz)) in enumerate(paw(1.0)):
            ctr = p + right * px + up * pz - n * 0.012
            no_ink(shape_on(f'Bow paw {side} {k + 1}', pts, 0.024, 'cream', n, ctr, up=tuple(up), bev=0.003))
    # outboard motor on the transom: navy leg, yellow cowl with a red band, red tiller
    rbox('Motor clamp bracket', (0, YS + 0.05, 0.74), (0.22, 0.14, 0.16), 'navy', bev=0.02, finish='iron')
    rbox('Motor leg', (0, YS + 0.18, 0.47), (0.10, 0.14, 0.62), 'navy', bev=0.02, finish='iron')
    ellipsoid('Motor lower unit', (0, YS + 0.18, 0.14), (0.07, 0.16, 0.07), 'navy', seg=24, rings=12, finish='iron')
    for k in range(3):
        a = math.tau * k / 3 + 0.3
        ellipsoid(f'Propeller blade {k + 1}', (0.055 * math.cos(a), YS + 0.335, 0.14 + 0.055 * math.sin(a)), (0.05, 0.012, 0.028), 'yellow',
                  rot=(0, -a, 0), seg=16, rings=8)
    rbox('Motor cowl', (0, YS + 0.14, 0.93), (0.34, 0.38, 0.30), 'yellow', bev=0.1, seg=4)
    rbox('Motor cowl band', (0, YS + 0.14, 0.90), (0.35, 0.39, 0.06), 'red', bev=0.025, seg=3)
    rod('Motor tiller', (0, YS + 0.02, 0.93), (0, YS - 0.42, 0.87), 0.025, 0.025, 'red', seg=16, bev=0.0)
    rod('Motor tiller grip', (0, YS - 0.30, 0.875), (0, YS - 0.45, 0.868), 0.035, 0.035, 'navy', seg=16, bev=0.006, finish='iron')
    # bow: a mooring eye on the stem and a coiled line on the foredeck
    p0 = hull_point(0.0, 1.0, 1)
    sweep('Stem mooring eye', [(0.0, p0.y - 0.035 + 0.035 * math.cos(a), 0.80 + 0.045 * math.sin(a)) for a in [math.tau * i / 20 for i in range(20)]],
          0.013, 'navy', n=8, closed=True, finish='iron')
    t = t_of(-2.0); zc = hull_s(t) + 0.02
    for k in range(2):
        sweep(f'Foredeck line coil {k + 1}', [(0.13 * math.cos(a) - 0.0, -2.0 + 0.1 * math.sin(a), zc + 0.03 * k) for a in [math.tau * i / 36 for i in range(36)]],
              0.021, 'rope', n=10, closed=True, finish='rope')

def measure(objs):
    dg = bpy.context.evaluated_depsgraph_get(); lo = [1e9] * 3; hi = [-1e9] * 3; tris = 0; per = {}
    for ob in objs:
        if ob.type not in ('MESH', 'CURVE'): continue
        ev = ob.evaluated_get(dg); me = ev.to_mesh(); top = -1e9
        for vtx in me.vertices:
            w = ev.matrix_world @ vtx.co; top = max(top, w.z)
            for k in range(3): lo[k] = min(lo[k], w[k]); hi[k] = max(hi[k], w[k])
        me.calc_loop_triangles(); tris += len(me.loop_triangles); ev.to_mesh_clear(); per[ob.get('blockout_part', ob.name)] = round(top, 4)
    return {'min': [round(x, 4) for x in lo], 'max': [round(x, 4) for x in hi], 'size': [round(hi[k] - lo[k], 4) for k in range(3)],
            'blockout_triangles': tris}, per

def build():
    clear_scene()
    coll = bpy.data.collections.new(MASTER); bpy.context.scene.collection.children.link(coll)
    sc = bpy.context.scene; sc.unit_settings.system = 'METRIC'; sc.unit_settings.scale_length = 1.0
    build_tower(); build_bollard(); build_buoy(); build_boat()
    for ob in PARTS: ob['work_order'] = 'WO111'; ob['asset_id'] = 'rescue-harbor-kit'

if __name__ == '__main__':
    sc = bpy.context.scene
    assert sc.get('asset_id') == 'rescue-harbor-kit' and sc.get('scene_lease') == 'active'
    t0 = datetime.datetime.now(datetime.timezone.utc)
    build(); bpy.context.view_layer.update()
    props = {}
    for p in PROPS:
        m, per = measure(list(bpy.data.collections['RH ' + p].objects))
        hx, hh, hz = REGISTRY[p]
        m['registry_box_blender'] = {'min': [-hx, -hz, 0.0], 'max': [hx, hz, hh]}
        m['inside_registry_box'] = (m['min'][0] >= -hx - 1e-4 and m['max'][0] <= hx + 1e-4 and m['min'][1] >= -hz - 1e-4 and m['max'][1] <= hz + 1e-4
                                    and m['min'][2] >= -1e-4 and m['max'][2] <= hh + 1e-4)
        m['gltf_bounds_y_up'] = {'min': [m['min'][0], m['min'][2], -m['max'][1]], 'max': [m['max'][0], m['max'][2], -m['min'][1]]}
        m['parts'] = len(bpy.data.collections['RH ' + p].objects); m['part_tops_m'] = per
        props[p] = m
    sc['blockout_bounds_m'] = json.dumps({p: {k: props[p][k] for k in ('min', 'max', 'size')} for p in PROPS})
    sc['orientation'] = 'Blender +Z up, prop front toward -Y; glTF +Y up, front toward +Z (theme-kit rotation 0); floor-centred origin per prop'
    path = ROOT / 'rescue-harbor-kit-blockout.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(path), compress=True)
    rec = {'saved': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'props': props,
           'materials': sorted(x.name for x in bpy.data.materials), 'parts': len(PARTS),
           'build_seconds': round((datetime.datetime.now(datetime.timezone.utc) - t0).total_seconds(), 1),
           'utc': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    (ROOT / 'blockout-measurements.json').write_text(json.dumps(rec, indent=2) + '\n')
    print(json.dumps({p: {k: props[p][k] for k in ('min', 'max', 'size', 'blockout_triangles', 'inside_registry_box', 'parts')} for p in PROPS}, indent=1))
