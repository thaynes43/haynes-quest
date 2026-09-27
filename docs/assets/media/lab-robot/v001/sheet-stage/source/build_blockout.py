"""WO111 lab-robot v001: painted flat-colour BLOCKOUT for a Blender reference sheet.

Reference-sheet stage only: bevelled primitives, lathes and sweeps. No final topology, no rig, no atlas, no GLB.
Blender +Z up, character faces +Y (exports later as glTF +Y up / -Z forward), floor-centred at the origin.
Character right = +X. All dimensions in metres.

Design: World A chapter 3 ordinary-b (ages 5-9, the rooftop Hero City chapter under the inator-monster boss). The
evil scientist's runaway lab robot, an original parody crossed with a vintage wind-up tin toy, about 1.28 m to the top
of its warning light. A boxy teal tin body on a swivel waist rides two plum rubber tank treads. A pale tin dome head
carries one big camera-lens eye with a tilted plum eyelid (a cheeky "uh-oh" look) above a little speaker-grille smile,
and a caged amber warning light on top that flashes and beeps before it moves. Stretchy slinky-spring arms end in
round brass pincer claws: the right one raised and snapping, the left one reaching forward. On its chest a big
tomato-red self-destruct button sits in a hazard-striped ring (every evil scientist builds one in). Behind it trails
the lab power cord it yanked out of the wall to run away, curling up like a tail with the plug on the end.
"""
import bpy, bmesh, math, json, hashlib, datetime
from mathutils import Vector, Matrix
from pathlib import Path

ROOT = Path('/workspace/haynes-quest/family-eras/lab-robot/v001')
MASTER = 'Lab robot blockout (master)'

PAL = {
    'tin': '#5f9ea3', 'silver': '#dde2d9', 'steel': '#8e98a2', 'brass': '#dca953', 'plum': '#4a3f63',
    'rubber': '#3a3446', 'amber': '#f39a3d', 'tomato': '#e0544b', 'glass': '#9fd6e3', 'iris': '#5a9cb4',
    'pupil': '#2e2840', 'cream': '#fbf6ea',
}
# Per-key surface tweaks: tin reads as softly painted metal, the lens as glass, the warning light as switched on.
LOOK = {
    'tin': dict(rough=0.55, spec=0.32), 'silver': dict(rough=0.5, spec=0.34), 'steel': dict(rough=0.5, spec=0.34),
    'brass': dict(rough=0.5, spec=0.34), 'glass': dict(rough=0.18, spec=0.6), 'iris': dict(rough=0.2, spec=0.55),
    'pupil': dict(rough=0.2, spec=0.55), 'amber': dict(rough=0.25, spec=0.5, glow=0.55), 'tomato': dict(rough=0.35, spec=0.45),
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
    m = bpy.data.materials.new('LR ' + key + ' ' + PAL[key]); m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF'); lk = LOOK.get(key, {})
    bs.inputs['Base Color'].default_value = lin(PAL[key]); bs.inputs['Roughness'].default_value = lk.get('rough', 0.82)
    bs.inputs['Specular IOR Level'].default_value = lk.get('spec', 0.18)
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
    """Orient an object whose local Z is its axis from point a toward b, centred between them."""
    a = Vector(a); b = Vector(b); ob.location = (a + b) / 2
    ob.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler(); return ob

def rod(name, a, b, r1, r2, key, seg=40, bev=0.004):
    return along(cyl(name, (0, 0, 0), r1, r2, (Vector(b) - Vector(a)).length, key, seg=seg, bev=bev), a, b)

def box(name, loc, s, key, rot=(0, 0, 0), parent=None, bev=0.012, seg=3, taper=None):
    """Bevelled box; taper=(bottom_x_scale, top_x_scale) widens a tin body toward the top."""
    me = bpy.data.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bm.to_mesh(me); bm.free()
    for v in me.vertices:
        k = 1.0 if taper is None else (taper[1] if v.co.z > 0 else taper[0])
        v.co = Vector((v.co.x * s[0] * k, v.co.y * s[1], v.co.z * s[2]))
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

def lathe(name, profile, key, a=(0, 0, 0), b=None, n=48, step=None):
    """Closed surface of revolution along local Z from a (towards b if given); profile [(z, r)] with r > 0."""
    prof = profile
    if step:
        t0, t1 = profile[0][0], profile[-1][0]; m = max(8, int((t1 - t0) / step))
        prof = [(t0 + (t1 - t0) * i / m, interp(profile, t0 + (t1 - t0) * i / m)) for i in range(m + 1)]
    verts = []; faces = []
    for z, r in prof:
        for i in range(n):
            ang = math.tau * i / n; verts.append((r * math.cos(ang), r * math.sin(ang), z))
    rings = len(prof)
    for j in range(rings - 1):
        for i in range(n):
            faces.append((j * n + i, j * n + (i + 1) % n, (j + 1) * n + (i + 1) % n, (j + 1) * n + i))
    faces.append(tuple(range(n - 1, -1, -1))); faces.append(tuple((rings - 1) * n + i for i in range(n)))
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    ob = link(name, me, mat(key)); ob.location = a
    if b is not None: ob.rotation_euler = (Vector(b) - Vector(a)).to_track_quat('Z', 'Y').to_euler()
    return ob

def catmull(pts, per=10):
    P = [Vector(p) for p in pts]; P = [P[0] + (P[0] - P[1])] + P + [P[-1] + (P[-1] - P[-2])]; out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for s in range(per):
            t = s / per
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-2]); return out

def rmf(path, up=(0, 0, 1)):
    """Rotation-minimising frames (T, N, B) along a polyline."""
    m = len(path); T = (path[1] - path[0]).normalized(); U = Vector(up); N = U - U.dot(T) * T
    if N.length < 1e-3: N = T.cross(Vector((1, 0, 0)))
    N.normalize(); out = []
    for i in range(m):
        if i > 0:
            T = (path[min(i + 1, m - 1)] - path[i - 1]).normalized(); N = (N - N.dot(T) * T).normalized()
        out.append((T, N, T.cross(N)))
    return out

def sweep(name, pts, radii, key, n=20, per=12, up=(0, 0, 1)):
    """Round tube along a Catmull-Rom path (per=1 keeps a dense input polyline as-is) with capped ends."""
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
    faces.append(tuple(range(n - 1, -1, -1))); faces.append(tuple((m - 1) * n + j for j in range(n)))
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    return link(name, me, mat(key)), path

def coil(name, pts, coil_r, wire_r, pitch, key, per_turn=22):
    """Slinky spring: a helix wound around a Catmull-Rom centreline, swept as a thin wire."""
    path = catmull(pts, 40); lens = [0.0]
    for i in range(1, len(path)): lens.append(lens[-1] + (path[i] - path[i - 1]).length)
    total = lens[-1]; ds = pitch / per_turn; samples = []; s = 0.0; j = 0
    while s <= total:
        while j < len(path) - 2 and lens[j + 1] < s: j += 1
        f = (s - lens[j]) / max(1e-9, lens[j + 1] - lens[j]); samples.append(path[j].lerp(path[j + 1], f)); s += ds
    frames = rmf(samples); helix = []
    for i, (p, (T, N, B)) in enumerate(zip(samples, frames)):
        th = math.tau * i / per_turn; helix.append(tuple(p + coil_r * (math.cos(th) * N + math.sin(th) * B)))
    ob, _ = sweep(name, helix, [wire_r, wire_r], key, n=10, per=1)
    return ob, samples, frames

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

def ray_hit(targets, origin, direction):
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

def surf_strip(name, targets, D, center, inner, outer, off, thick, key, rows=3):
    """A ribbon laid on a surface between two projected 2-D polylines [(x, z)], with real thickness."""
    bpy.context.view_layer.update()
    D = Vector(D).normalized(); R = Vector((1, 0, 0)); U = Vector((0, 0, 1)); C = Vector(center); verts = []
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

def stadium_band(name, x, y0, y1, zc, R, t, w, key, per_arc=24):
    """Closed tank-tread belt: a stadium loop in the YZ plane (end-wheel centres y0, y1 at height zc, outer radius R),
    rectangular section t thick radially and w wide along X. Returns the object and outer-surface samples."""
    rm = R - t / 2; pts = []
    L = y1 - y0; n_straight = max(4, int(L / 0.02))
    for i in range(n_straight):                                             # top run, back to front
        pts.append((Vector((0, y0 + L * i / n_straight, zc + rm)), Vector((0, 0, 1))))
    for i in range(per_arc):                                                # front wheel, over the top and down
        a = math.pi / 2 - math.pi * i / per_arc; nrm = Vector((0, math.cos(a), math.sin(a)))
        pts.append((Vector((0, y1, zc)) + nrm * rm, nrm))
    for i in range(n_straight):                                             # bottom run, front to back
        pts.append((Vector((0, y1 - L * i / n_straight, zc - rm)), Vector((0, 0, -1))))
    for i in range(per_arc):                                                # back wheel, under and up
        a = -math.pi / 2 - math.pi * i / per_arc; nrm = Vector((0, math.cos(a), math.sin(a)))
        pts.append((Vector((0, y0, zc)) + nrm * rm, nrm))
    verts = []; faces = []; m = len(pts)
    for p, nrm in pts:
        o = p + nrm * t / 2; q = p - nrm * t / 2
        verts += [(x - w / 2, o.y, o.z), (x + w / 2, o.y, o.z), (x + w / 2, q.y, q.z), (x - w / 2, q.y, q.z)]
    for i in range(m):
        a = 4 * i; b = 4 * ((i + 1) % m)
        faces += [(a, a + 1, b + 1, b), (a + 1, a + 2, b + 2, b + 1), (a + 2, a + 3, b + 3, b + 2), (a + 3, a, b, b + 3)]
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    ob = link(name, me, mat(key), smooth=False); bevel(ob, 0.004, 2)
    outer = [(Vector((x, p.y, p.z)) + nrm * t / 2, nrm) for p, nrm in pts]
    return ob, outer, m

def clear_scene():
    if bpy.context.object and bpy.context.object.mode != 'OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    for coll in list(bpy.data.collections): bpy.data.collections.remove(coll)
    for blocks in (bpy.data.meshes, bpy.data.curves, bpy.data.metaballs, bpy.data.armatures, bpy.data.materials, bpy.data.actions,
                   bpy.data.cameras, bpy.data.lights, bpy.data.images, bpy.data.linestyles, bpy.data.worlds, bpy.data.textures):
        for b in list(blocks): blocks.remove(b)
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)

# --- Key dimensions (Blender Z up, facing +Y, character right = +X) --------------------------------------------------
TREAD_X = 0.178; TREAD_W = 0.13; TREAD_R = 0.095; TREAD_T = 0.024; LUG_H = 0.010
TREAD_Y0 = -0.15; TREAD_Y1 = 0.15; TREAD_ZC = TREAD_R + LUG_H                      # lugs touch the floor
BODY_Z0 = 0.29; BODY_Z1 = 0.79; BODY_W = 0.50; BODY_D = 0.38; BODY_TAPER = (0.95, 1.03)
FRONT_Y = BODY_D / 2
HEAD_R = 0.205; BAND_Z0 = 0.835; BAND_Z1 = 0.975                                      # head band, then the dome
EYE_C = Vector((0.0, 0.0, 1.02)); EYE_TILT = math.radians(-11)                       # eyelid raised on its left
BEACON_Z = BAND_Z1 + HEAD_R - 0.012
SHOULDER_Z = 0.705

def body_half_x(z):
    t = min(1.0, max(0.0, (z - BODY_Z0) / (BODY_Z1 - BODY_Z0)))
    return BODY_W / 2 * (BODY_TAPER[0] + (BODY_TAPER[1] - BODY_TAPER[0]) * t)

def claw(side, wrist, T, S, jaw_len=0.13, spread=0.05):
    """Round brass pincer: steel cuff, a brass palm knuckle and two curved jaws with ball tips, opening along S."""
    T = Vector(T).normalized(); S = Vector(S); S = (S - S.dot(T) * T).normalized(); W = Vector(wrist)
    rod(f'Wrist cuff {side}', W - T * 0.01, W + T * 0.05, 0.046, 0.046, 'steel')
    rod(f'Claw palm {side}', W + T * 0.045, W + T * 0.085, 0.05, 0.043, 'brass')
    for k, tag in ((1, 'upper'), (-1, 'lower')):
        base = W + T * 0.075 + S * k * 0.02
        mid = W + T * (0.075 + jaw_len * 0.5) + S * k * spread
        tip = W + T * (0.075 + jaw_len) + S * k * spread * 0.35
        sweep(f'Pincer jaw {side} {tag}', [base, mid, tip], [0.024, 0.022, 0.015], 'brass', n=18, per=10)
        ellipsoid(f'Pincer tip {side} {tag}', tuple(tip + T * 0.004), (0.017, 0.017, 0.017), 'brass', seg=18, rings=10)
    return W + T * (0.075 + jaw_len)

def build():
    clear_scene()
    coll = bpy.data.collections.new(MASTER); bpy.context.scene.collection.children.link(coll)
    sc = bpy.context.scene; sc.unit_settings.system = 'METRIC'; sc.unit_settings.scale_length = 1.0

    # --- Tank treads: plum rubber belts with floor lugs, road wheels with brass hubcaps, a teal housing plate --------
    for side, sx in (('right', 1), ('left', -1)):
        x = TREAD_X * sx
        belt, outer, m = stadium_band(f'Rubber tank tread {side}', x, TREAD_Y0, TREAD_Y1, TREAD_ZC, TREAD_R, TREAD_T, TREAD_W, 'rubber')
        lens = [0.0]
        for i in range(1, m + 1): lens.append(lens[-1] + (outer[i % m][0] - outer[i - 1][0]).length)
        count = int(lens[-1] / 0.042); k = 0
        for c in range(count):
            s = lens[-1] * c / count
            while lens[k + 1] < s: k += 1
            p, nrm = outer[k]; q, _ = outer[(k + 1) % m]; tang = (q - p).normalized()
            M = frame(tang, nrm, p + nrm * (LUG_H - 0.006))
            no_ink(box(f'Tread lug {side} {c:02d}', M.translation, (TREAD_W + 0.004, 0.016, LUG_H + 0.002), 'rubber', rot=M.to_euler(), bev=0.002, seg=1))
        # teal housing plate that fills the loop between the wheels
        hp = []
        for i in range(24):
            a = math.pi / 2 - math.pi * i / 23; hp.append((-(TREAD_Y1 + (TREAD_R - TREAD_T - 0.012) * math.cos(a)), TREAD_ZC + (TREAD_R - TREAD_T - 0.012) * math.sin(a)))
        for i in range(24):
            a = -math.pi / 2 - math.pi * i / 23; hp.append((-(TREAD_Y0 + (TREAD_R - TREAD_T - 0.012) * math.cos(a)), TREAD_ZC + (TREAD_R - TREAD_T - 0.012) * math.sin(a)))
        prism(f'Tread housing plate {side}', hp, TREAD_W - 0.03, 'tin', M=frame((1, 0, 0), (0, 0, 1), (x, 0, 0)), bev=0.003)
        for yw, rw, tag in ((TREAD_Y1, 0.066, 'front'), (TREAD_Y0, 0.066, 'back'), (0.05, 0.044, 'mid front'), (-0.05, 0.044, 'mid back')):
            zw = TREAD_ZC if rw > 0.05 else LUG_H + TREAD_T + rw + 0.004
            rod(f'Road wheel {side} {tag}', (x - sx * (TREAD_W / 2 - 0.012), yw, zw), (x + sx * (TREAD_W / 2 + 0.002), yw, zw), rw, rw, 'steel', seg=32)
            xo = x + sx * (TREAD_W / 2 + 0.002)
            rod(f'Brass hubcap {side} {tag}', (xo, yw, zw), (xo + sx * 0.012, yw, zw), rw * 0.72, rw * 0.62, 'brass', seg=32)
            rod(f'Hub bolt {side} {tag}', (xo + sx * 0.01, yw, zw), (xo + sx * 0.022, yw, zw), rw * 0.22, rw * 0.18, 'steel', seg=16, bev=0.002)

    # --- Chassis crossbar and swivel waist ------------------------------------------------------------------------
    box('Chassis crossbar', (0, 0, 0.165), (2 * (TREAD_X - TREAD_W / 2) + 0.03, 0.22, 0.055), 'plum', bev=0.01)
    rod('Swivel waist', (0, 0, 0.185), (0, 0, BODY_Z0 + 0.01), 0.105, 0.115, 'steel', seg=48, bev=0.006)
    rod('Waist brass ring', (0, 0, 0.255), (0, 0, 0.272), 0.122, 0.122, 'brass', seg=48, bev=0.004)

    # --- Boxy tin body --------------------------------------------------------------------------------------------
    zc = (BODY_Z0 + BODY_Z1) / 2
    box('Tin body box', (0, 0, zc), (BODY_W, BODY_D, BODY_Z1 - BODY_Z0), 'tin', bev=0.05, seg=4, taper=BODY_TAPER)
    # chest control panel, rivets, dials, indicator lights and the big self-destruct button
    PZ = 0.54; PH = 0.28; PW = 0.34; py = FRONT_Y + 0.004
    box('Chest control panel', (0, py, PZ), (PW, 0.016, PH), 'silver', bev=0.006)
    pf = py + 0.008
    for rx in (-1, 1):
        for rz in (-1, 1):
            no_ink(ellipsoid(f'Panel rivet {rx:+d}{rz:+d}', (rx * (PW / 2 - 0.02), pf, PZ + rz * (PH / 2 - 0.02)), (0.011, 0.006, 0.011), 'brass', seg=16, rings=8))
    BZ = 0.515
    for i in range(16):                                                     # hazard ring: alternating brass/plum wedges
        a0 = math.tau * i / 16 + math.pi / 16; a1 = math.tau * (i + 1) / 16 + math.pi / 16; ring = []
        for k in range(5): a = a0 + (a1 - a0) * k / 4; ring.append((0.078 * math.cos(a), BZ + 0.078 * math.sin(a)))
        for k in range(5): a = a1 - (a1 - a0) * k / 4; ring.append((0.052 * math.cos(a), BZ + 0.052 * math.sin(a)))
        wedge = prism(f'Hazard ring wedge {i:02d}', ring, 0.012, 'brass' if i % 2 == 0 else 'plum', M=Matrix.Translation((0, pf + 0.006, 0)))
        no_ink(wedge)
    rod('Self-destruct button', (0, pf, BZ), (0, pf + 0.034, BZ), 0.05, 0.05, 'tomato', seg=48, bev=0.006)
    ellipsoid('Self-destruct button cap', (0, pf + 0.034, BZ), (0.05, 0.016, 0.05), 'tomato', seg=40, rings=16)
    no_ink(ellipsoid('Button shine', (-0.018, pf + 0.049, BZ + 0.02), (0.014, 0.004, 0.009), 'cream', seg=16, rings=8))
    for dx in (-0.125, 0.125):
        tag = 'right' if dx > 0 else 'left'
        rod(f'Gauge dial rim {tag}', (dx, pf - 0.002, BZ), (dx, pf + 0.012, BZ), 0.034, 0.034, 'brass', seg=32, bev=0.003)
        ellipsoid(f'Gauge dial face {tag}', (dx, pf + 0.012, BZ), (0.027, 0.004, 0.027), 'cream', seg=24, rings=10)
        ang = math.radians(35 if dx > 0 else -50)
        box(f'Gauge needle {tag}', (dx + 0.011 * math.sin(ang), pf + 0.017, BZ + 0.011 * math.cos(ang)), (0.005, 0.004, 0.024), 'plum', rot=(0, ang, 0), bev=0.0)
    for dx, key, tag in ((-0.06, 'amber', 'amber'), (0.0, 'glass', 'blue'), (0.06, 'tomato', 'red')):
        ellipsoid(f'Indicator light {tag}', (dx, pf, 0.635), (0.018, 0.011, 0.018), key, seg=20, rings=10)
    # hazard-striped kick plate along the bottom front
    HZ = 0.361; hy = FRONT_Y + 0.003
    box('Hazard kick plate', (0, hy, HZ), (0.40, 0.012, 0.048), 'brass', bev=0.004)
    for i in range(8):
        x0 = -0.19 + i * 0.048
        no_ink(prism(f'Hazard stripe {i}', [(x0, HZ - 0.02), (x0 + 0.02, HZ - 0.02), (x0 + 0.042, HZ + 0.02), (x0 + 0.022, HZ + 0.02)],
                     0.006, 'plum', M=Matrix.Translation((0, hy + 0.007, 0))))
    # side louvers
    for side, sx in (('right', 1), ('left', -1)):
        for i, lz in enumerate((0.47, 0.51, 0.55, 0.59)):
            box(f'Side louver {side} {i}', (sx * (body_half_x(lz) + 0.002), -0.01, lz), (0.012, 0.18, 0.016), 'plum', bev=0.004)
    # back hatch, rivets and the cord grommet
    by = -FRONT_Y - 0.004
    box('Back hatch', (0, by, 0.585), (0.28, 0.014, 0.24), 'silver', bev=0.006)
    for rx in (-1, 1):
        for rz in (-1, 1):
            no_ink(ellipsoid(f'Hatch rivet {rx:+d}{rz:+d}', (rx * 0.12, by - 0.007, 0.585 + rz * 0.1), (0.011, 0.006, 0.011), 'brass', seg=16, rings=8))
    box('Hatch handle', (0, by - 0.012, 0.585), (0.09, 0.014, 0.018), 'plum', bev=0.005)
    rod('Cord grommet', (0, -FRONT_Y + 0.01, 0.38), (0, -FRONT_Y - 0.022, 0.38), 0.034, 0.03, 'brass', seg=32)

    # --- Shoulders, slinky arms and pincer claws ------------------------------------------------------------------
    for side, sx in (('right', 1), ('left', -1)):
        ellipsoid(f'Shoulder socket {side}', (sx * 0.262, 0.0, SHOULDER_Z), (0.054, 0.054, 0.054), 'brass', seg=32, rings=16)
    r_pts = [(0.27, 0.0, SHOULDER_Z), (0.34, 0.005, 0.745), (0.40, 0.0, 0.83), (0.42, -0.01, 0.92), (0.41, -0.015, 0.985)]
    _, rs, rf = coil('Slinky arm right (raised)', r_pts, 0.038, 0.0095, 0.021, 'steel')
    T = rf[-1][0]; claw('right', rs[-1], T, (1, 0, 0), spread=0.055)
    l_pts = [(-0.27, 0.0, SHOULDER_Z - 0.005), (-0.34, 0.04, 0.64), (-0.38, 0.11, 0.56), (-0.37, 0.19, 0.50), (-0.35, 0.26, 0.47)]
    _, ls, lf = coil('Slinky arm left (reaching)', l_pts, 0.038, 0.0095, 0.021, 'steel')
    T = lf[-1][0]; claw('left', ls[-1], T, (-0.6, 0, 1), spread=0.05)

    # --- Neck bellows and the dome head ---------------------------------------------------------------------------
    bell = [(0.0, 0.112)]
    for i in range(1, 7): bell.append((0.01 * i, 0.128 if i % 2 else 0.108))
    bell.append((0.066, 0.112))
    lathe('Neck bellows', bell, 'rubber', a=(0, 0, BODY_Z1 - 0.012), n=48, step=0.0025)
    rod('Head bottom trim', (0, 0, BAND_Z0 - 0.004), (0, 0, BAND_Z0 + 0.018), HEAD_R + 0.008, HEAD_R + 0.008, 'plum', seg=64)
    band = rod('Tin head band', (0, 0, BAND_Z0), (0, 0, BAND_Z1), HEAD_R, HEAD_R, 'silver', seg=64, bev=0.003)
    rod('Head seam ring', (0, 0, BAND_Z1 - 0.009), (0, 0, BAND_Z1 + 0.009), HEAD_R + 0.007, HEAD_R + 0.007, 'plum', seg=64)
    me = bpy.data.meshes.new('Tin dome head'); bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=64, v_segments=32, radius=HEAD_R)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-5], context='VERTS'); bm.to_mesh(me); bm.free()
    dome = link('Tin dome head', me, mat('silver')); dome.location = (0, 0, BAND_Z1)
    for i in range(10):                                                     # seam-ring rivets
        a = math.tau * (i + 0.5) / 10
        no_ink(ellipsoid(f'Seam rivet {i}', ((HEAD_R + 0.014) * math.cos(a), (HEAD_R + 0.014) * math.sin(a), BAND_Z1), (0.008, 0.008, 0.008), 'brass', seg=12, rings=6))
    # ear discs with bolt nubs
    for side, sx in (('right', 1), ('left', -1)):
        rod(f'Ear disc {side}', (sx * (HEAD_R - 0.01), 0, 0.915), (sx * (HEAD_R + 0.022), 0, 0.915), 0.048, 0.044, 'brass', seg=32)
        rod(f'Ear bolt {side}', (sx * (HEAD_R + 0.02), 0, 0.915), (sx * (HEAD_R + 0.05), 0, 0.915), 0.018, 0.014, 'steel', seg=20, bev=0.003)
    # the one big lens eye: steel barrel, brass bezel, domed glass, iris, pupil, glints and a tilted plum eyelid
    E = EYE_C
    rod('Lens barrel', (0, 0.08, E.z), (0, 0.212, E.z), 0.098, 0.098, 'steel', seg=64)
    rod('Lens brass bezel', (0, 0.2, E.z), (0, 0.236, E.z), 0.108, 0.108, 'brass', seg=64, bev=0.005)
    ellipsoid('Lens glass', (0, 0.236, E.z), (0.086, 0.03, 0.086), 'glass', seg=48, rings=24)
    ellipsoid('Lens iris ring', (0.004, 0.239, E.z - 0.008), (0.056, 0.03, 0.056), 'iris', seg=40, rings=20)
    ellipsoid('Lens pupil', (0.006, 0.243, E.z - 0.01), (0.036, 0.03, 0.036), 'pupil', seg=40, rings=20)
    no_ink(ellipsoid('Lens glint big', (-0.03, 0.272, E.z + 0.026), (0.017, 0.006, 0.012), 'cream', rot=(0, math.radians(30), 0), seg=16, rings=8))
    no_ink(ellipsoid('Lens glint small', (-0.052, 0.268, E.z + 0.002), (0.0075, 0.004, 0.0075), 'cream', seg=12, rings=6))
    lid = []
    for i in range(21):
        a = math.radians(30 + 120 * i / 20); lid.append((0.104 * math.cos(a), 0.104 * math.sin(a)))
    ca, sa = math.cos(EYE_TILT), math.sin(EYE_TILT)
    lid = [(x * ca - z * sa, E.z + x * sa + z * ca) for x, z in lid]
    prism('Tilted plum eyelid', lid, 0.035, 'plum', M=Matrix.Translation((0, 0.2535, 0)), bev=0.006)
    # speaker-grille smile on the head band
    bpy.context.view_layer.update()
    MW = 0.08; xs = [-MW + 2 * MW * i / 14 for i in range(15)]
    upper = [(x, 0.884 + 0.014 * (x / MW) ** 2) for x in xs]; lower = [(x, 0.857 + 0.037 * (x / MW) ** 2) for x in xs]
    surf_strip('Speaker-grille smile', [band], (0, -1, 0), (0, 0.4, 0), lower, upper, 0.002, 0.006, 'plum')
    for i, gx in enumerate((-0.036, 0.0, 0.036)):
        zl = 0.857 + 0.037 * (gx / MW) ** 2 + 0.005; zu = 0.884 + 0.014 * (gx / MW) ** 2 - 0.005
        yy = math.sqrt(HEAD_R ** 2 - gx ** 2) + 0.006
        no_ink(rod(f'Grille bar {i}', (gx, yy, zl), (gx, yy, zu), 0.0045, 0.0045, 'brass', seg=10, bev=0.0))
    # caged amber warning light on top
    rod('Warning light brass base', (0, 0, BEACON_Z), (0, 0, BEACON_Z + 0.038), 0.064, 0.058, 'brass', seg=48)
    rod('Warning beacon amber glass', (0, 0, BEACON_Z + 0.034), (0, 0, BEACON_Z + 0.058), 0.0474, 0.0474, 'amber', seg=48, bev=0.0)
    ellipsoid('Warning beacon amber dome', (0, 0, BEACON_Z + 0.062), (0.048, 0.048, 0.048), 'amber', seg=40, rings=20)
    CAGE = [(0.058, 0.034), (0.058, 0.064), (0.052, 0.094), (0.032, 0.113), (0.0, 0.12)]
    CAGE = CAGE + [(-r, z) for r, z in reversed(CAGE[:-1])]
    for i, ang in enumerate((0.0, math.pi / 2)):
        d = Vector((math.cos(ang), math.sin(ang), 0))
        arc = [tuple(d * r + Vector((0, 0, BEACON_Z + z))) for r, z in CAGE]
        sweep(f'Beacon cage wire {i}', arc, [0.0045, 0.0045], 'steel', n=8, per=6)

    # --- The yanked-out lab power cord, curling up like a tail with its plug ---------------------------------------
    cord_pts = [(0.0, -FRONT_Y - 0.02, 0.38), (0.035, -0.255, 0.345), (0.1, -0.295, 0.255), (0.16, -0.325, 0.13), (0.22, -0.365, 0.035),
                (0.275, -0.435, 0.018), (0.3, -0.515, 0.03), (0.305, -0.58, 0.1), (0.305, -0.6, 0.185), (0.305, -0.585, 0.245)]
    _, cpath = sweep('Unplugged power cord', cord_pts, [0.017, 0.016, 0.016], 'rubber', n=16, per=10)
    T = (cpath[-1] - cpath[-4]).normalized(); P = cpath[-1]
    M = frame(T, (0, -1, 0), P + T * 0.03)
    box('Power plug body', M.translation, (0.05, 0.065, 0.036), 'brass', rot=M.to_euler(), bev=0.008)
    for k in (-1, 1):
        Q = P + T * 0.08 + (M.to_3x3() @ Vector((1, 0, 0))) * k * 0.012
        box(f'Plug prong {"right" if k > 0 else "left"}', Q, (0.008, 0.036, 0.013), 'steel', rot=M.to_euler(), bev=0.002, seg=1)

    for ob in PARTS: ob['work_order'] = 'WO111'; ob['asset_id'] = 'lab-robot'

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

TOP_KEYS = ('Beacon cage wire', 'Warning beacon amber dome', 'Tin dome head', 'Lens brass bezel', 'Pincer tip right', 'Slinky arm right',
            'Tin body box', 'Chest control panel', 'Self-destruct button', 'Rubber tank tread', 'Unplugged power cord', 'Power plug body')

if __name__ == '__main__':
    sc = bpy.context.scene
    assert sc.get('asset_id') == 'lab-robot' and sc.get('scene_lease') == 'active'
    t0 = datetime.datetime.now(datetime.timezone.utc)
    build(); bpy.context.view_layer.update()
    m, per = measure()
    tops = {k.strip(): round(max(v for n, v in per.items() if n.startswith(k)), 4) for k in TOP_KEYS}
    sc['blockout_bounds_m'] = json.dumps(m); sc['blockout_tops_m'] = json.dumps(tops)
    sc['orientation'] = 'Blender +Z up/+Y forward; glTF +Y up/-Z forward; floor-centred origin; character right = +X'
    path = ROOT / 'lab-robot-blockout.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(path), compress=True)
    rec = {'saved': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bounds_blender_zup': m, 'feature_tops_m': tops,
           'parts': len(PARTS), 'materials': sorted(x.name for x in bpy.data.materials),
           'build_seconds': round((datetime.datetime.now(datetime.timezone.utc) - t0).total_seconds(), 1),
           'utc': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    (ROOT / 'blockout-measurements.json').write_text(json.dumps(rec, indent=2) + '\n')
    print(json.dumps(rec))
