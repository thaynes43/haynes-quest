"""WO111 mischief-kitten v001: painted flat-colour BLOCKOUT for a Blender reference sheet.

Reference-sheet stage only: primitive/curve/lathe forms, no final topology, no rig, no atlas, no GLB.
Blender +Z up, character faces +Y (exports later as glTF +Y up / -Z forward), floor-centred at the origin.
Character right = +X. All dimensions in metres.

Design: World A chapter 2 ordinary (ages 2-5 era parody), one of the rival mayor's mischievous kitten crew.
A small, bouncy, chibi four-legged kitten about 0.9 m to the ear tips: oversized round head, huge honey eyes
glancing sideways, sly tilted lids and a raised brow tuft copied from the boss, cream whisker pads with a
lopsided grin and a tongue-out "blep", big cocked ears, lilac-grey tabby fur with plum-lilac stripes, cream
socks, bib, belly and tail tip. It wears a knock-off rescue-crew kit in the mayor's colours: a tiny tilted
plum stovepipe hat with a honey band, a raspberry collar with a honey bell, and a teal gadget pack with a big
raspberry button and a short brass spring antenna with a propeller. Pose: sneaky tiptoe with the right forepaw
raised (pink toe beans showing), hind end bunched for a pounce, question-mark tail swung up on its right side.
"""
import bpy, bmesh, math, json, hashlib, datetime
from mathutils import Vector, Matrix
from pathlib import Path

ROOT = Path('/workspace/haynes-quest/family-eras/mischief-kitten/v001')
MASTER = 'Mischief kitten blockout (master)'

PAL = {
    'fur': '#9a8cae', 'stripe': '#6b5a84', 'cream': '#f3e6cf', 'pink': '#e39a88', 'tongue': '#d9677a',
    'hat': '#2f2740', 'honey': '#dca953', 'collar': '#b54a5a', 'teal': '#3f7f7a', 'brass': '#c9923e',
    'white': '#fbf6ec', 'ink': '#342c46', 'crease': '#cdb89a',
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
    m = bpy.data.materials.new('MK ' + key + ' ' + PAL[key]); m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = lin(PAL[key]); bs.inputs['Roughness'].default_value = 0.92
    bs.inputs['Specular IOR Level'].default_value = 0.12
    m.diffuse_color = lin(PAL[key]); m['palette_hex'] = PAL[key]
    MATS[key] = m; return m

PARTS = []
def link(name, data, mats, parent=None, smooth=True):
    ob = bpy.data.objects.new(name, data); bpy.data.collections[MASTER].objects.link(ob)
    for m in (mats if isinstance(mats, (list, tuple)) else [mats]):
        if m is not None: data.materials.append(m)
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
    """Dense, lightly smoothed (t, r) samples so painted bands have crisp ring edges."""
    t0, t1 = profile[0][0], profile[-1][0]; n = max(8, int((t1 - t0) / step))
    ts = [t0 + (t1 - t0) * i / n for i in range(n + 1)]; rs = [interp(profile, t) for t in ts]
    for _ in range(2):
        rs = [rs[0]] + [(rs[i - 1] + 2 * rs[i] + rs[i + 1]) / 4 for i in range(1, len(rs) - 1)] + [rs[-1]]
    return list(zip(ts, rs))

def lathe(name, profile, mats, a=(0, 0, 0), b=None, ey=1.0, n=48, parent=None, band=None, dense=True):
    """Surface of revolution. profile: (t, r) along the local Z axis from point a (towards b if given, else +Z).
    Local Y (the ey-scaled axis) is kept as close to world +Z as possible when b is given.
    band(t_frac, sin_angle) -> material index per face (for painted stripes / belly)."""
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
            idx.append(band(tm, math.sin(math.tau * (i + 0.5) / n)) if band else 0)
    faces.append(tuple(range(n - 1, -1, -1))); idx.append(idx[0] if idx else 0)
    faces.append(tuple((rings - 1) * n + i for i in range(n))); idx.append(idx[-1] if idx else 0)
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    for p, k in zip(me.polygons, idx): p.material_index = k
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    mm = [mat(k) if isinstance(k, str) else k for k in (mats if isinstance(mats, (list, tuple)) else [mats])]
    ob = link(name, me, mm, parent)
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

def sweep(name, pts, radii, mats, band=None, n=24, per=12, parent=None):
    """Tube along a Catmull-Rom path with rotation-minimising frames; band(u) -> material index per ring."""
    path = catmull(pts, per); m = len(path)
    lens = [0.0]
    for i in range(1, m): lens.append(lens[-1] + (path[i] - path[i - 1]).length)
    total = lens[-1]; verts = []; faces = []; idx = []
    T = (path[1] - path[0]).normalized(); N = T.cross(Vector((1, 0, 0)))
    if N.length < 1e-3: N = T.cross(Vector((0, 0, 1)))
    N.normalize()
    for i in range(m):
        if i > 0:
            T = (path[min(i + 1, m - 1)] - path[i - 1]).normalized(); N = (N - N.dot(T) * T).normalized()
        B = T.cross(N); u = lens[i] / total
        k = u * (len(radii) - 1); k0 = min(int(k), len(radii) - 2); r = radii[k0] + (radii[k0 + 1] - radii[k0]) * (k - k0)
        for j in range(n):
            ang = math.tau * j / n; verts.append(tuple(path[i] + r * (math.cos(ang) * N + math.sin(ang) * B)))
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

def ring(name, parent, rx, ry, radius, key, n=64):
    """Closed round-section ring (collar, straps) in the parent's local XY plane."""
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = radius; cu.bevel_resolution = 4
    sp = cu.splines.new('POLY'); sp.points.add(n - 1); sp.use_cyclic_u = True
    for i, pt in enumerate(sp.points):
        a = math.tau * i / n; pt.co = (rx * math.cos(a), ry * math.sin(a), 0.0, 1.0)
    ob = link(name, cu, mat(key), parent); ob.scale = (1, 1, 1)
    return ob

def along(ob, a, b):
    a = Vector(a); b = Vector(b); ob.location = (a + b) / 2
    ob.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler(); return ob

# --- Head: a wide round bun, deeper at the cheeks; front surface helpers --------------------------
HEAD = [(0.395, 0.02), (0.405, 0.10), (0.425, 0.160), (0.46, 0.205), (0.52, 0.232), (0.585, 0.238), (0.65, 0.228),
        (0.705, 0.203), (0.75, 0.160), (0.782, 0.100), (0.798, 0.035), (0.80, 0.0)]
HEAD_EY = 0.82; HEAD_Y = 0.20
def head_y(x, z, off=0.0):
    r = interp(HEAD, z); return HEAD_Y + HEAD_EY * math.sqrt(max(0.0, r * r - x * x)) + off
def head_x(y, z, sx=1, off=0.0):
    r = interp(HEAD, z); d = (y - HEAD_Y) / HEAD_EY; return sx * (math.sqrt(max(0.0, r * r - d * d)) + off)
def head_frame(name, x, z, inset=0.0):
    """Empty on the head front surface with local +Y along the outward surface normal."""
    r = max(interp(HEAD, z), 1e-3); y = head_y(x, z)
    nx = x / r ** 2; ny = (y - HEAD_Y) / (HEAD_EY * r) ** 2
    rz = -math.atan2(nx, ny)
    return empty(name, (x, y - inset, z), (0, 0, rz))

# --- Body: tilted bean from rump to chest (front higher = perky, hind end bunched) ---------------
RUMP = Vector((0.0, -0.30, 0.265)); CHEST = Vector((0.0, 0.16, 0.345))
BODY = [(0.0, 0.03), (0.02, 0.09), (0.06, 0.135), (0.12, 0.158), (0.22, 0.163), (0.32, 0.158), (0.40, 0.143),
        (0.45, 0.108), (0.47, 0.06), (0.478, 0.02)]
BODY_EY = 1.04

def tabby_head_mat():
    """Painted tabby for the head lathe (object coords: origin at head centre depth, Z = height): three crown stripes
    running front to back that continue down the back of the head. Starts above the brows so the face stays clear."""
    m = bpy.data.materials.new('MK tabby head ' + PAL['fur'] + '/' + PAL['stripe']); m.use_nodes = True
    nt = m.node_tree; bs = nt.nodes.get('Principled BSDF')
    bs.inputs['Roughness'].default_value = 0.92; bs.inputs['Specular IOR Level'].default_value = 0.12
    N = nt.nodes.new; L_ = nt.links.new
    def math_(op, a, b=None):
        n = N('ShaderNodeMath'); n.operation = op
        for k, v in enumerate((a, b)):
            if v is None: continue
            if isinstance(v, (int, float)): n.inputs[k].default_value = v
            else: L_(v, n.inputs[k])
        return n.outputs[0]
    tc = N('ShaderNodeTexCoord'); sep = N('ShaderNodeSeparateXYZ'); L_(tc.outputs['Object'], sep.inputs[0])
    ax = math_('ABSOLUTE', sep.outputs['X'])
    back = math_('MINIMUM', math_('MAXIMUM', math_('DIVIDE', sep.outputs['Y'], -0.19), 0.0), 1.0)
    zlim = math_('SUBTRACT', 0.768, math_('MULTIPLY', back, 0.20))
    d1 = ax; d2 = math_('ABSOLUTE', math_('SUBTRACT', ax, 0.064))
    s1 = math_('MULTIPLY', math_('LESS_THAN', d1, 0.012), math_('GREATER_THAN', sep.outputs['Z'], math_('ADD', zlim, math_('MULTIPLY', d1, 2.5))))
    s2 = math_('MULTIPLY', math_('LESS_THAN', d2, 0.011), math_('GREATER_THAN', sep.outputs['Z'], math_('ADD', zlim, math_('MULTIPLY', d2, 2.5))))
    stripe = math_('MAXIMUM', s1, s2)  # pointed tips where each stripe starts
    mix = N('ShaderNodeMix'); mix.data_type = 'RGBA'; L_(stripe, mix.inputs['Factor'])
    mix.inputs['A'].default_value = lin(PAL['fur']); mix.inputs['B'].default_value = lin(PAL['stripe'])
    L_(mix.outputs['Result'], bs.inputs['Base Color'])
    m.diffuse_color = lin(PAL['fur']); m['palette_hex'] = PAL['fur'] + '/' + PAL['stripe']
    return m

def paw_grooves(name, c, s, dxs=(-0.021, 0.021)):
    """Two soft toe grooves over the top-front of a mitten paw ellipsoid (centre c, semi-axes s)."""
    for k, dx in enumerate(dxs):
        xn = dx / s[0]; q = math.sqrt(max(0.0, 1 - xn * xn)); pts = []
        for e in (0.2, 0.45, 0.75):
            pts.append((c[0] + dx, c[1] + math.cos(e) * q * s[1] * 0.985, c[2] + math.sin(e) * q * s[2] * 0.985))
        tube(f'{name} toe groove {k}', pts, [0.0035, 0.0045, 0.003], 'crease', bres=3)

def surface_front(x, z, off=0.003):
    """Front-most blockout surface point at (x, z), found by ray-casting toward -Y; pushed out along its normal."""
    bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
    hit, loc, nrm, _, ob, _ = bpy.context.scene.ray_cast(dg, Vector((x, 2.0, z)), Vector((0, -1, 0)))
    assert hit, (x, z)
    return tuple(loc + nrm * off)

def tabby_body_mat(length, radius):
    """Painted tabby for the body lathe (object coords: Z along the body, Y up): tapered slanted back stripes
    that thin towards the flanks, a cream belly, fur elsewhere. Flat colour, no image texture."""
    m = bpy.data.materials.new('MK tabby body ' + PAL['fur'] + '/' + PAL['stripe'] + '/' + PAL['cream']); m.use_nodes = True
    nt = m.node_tree; bs = nt.nodes.get('Principled BSDF')
    bs.inputs['Roughness'].default_value = 0.92; bs.inputs['Specular IOR Level'].default_value = 0.12
    N = nt.nodes.new; L_ = nt.links.new
    def math_(op, a, b=None):
        n = N('ShaderNodeMath'); n.operation = op
        for k, v in enumerate((a, b)):
            if v is None: continue
            if isinstance(v, (int, float)): n.inputs[k].default_value = v
            else: L_(v, n.inputs[k])
        return n.outputs[0]
    tc = N('ShaderNodeTexCoord'); sep = N('ShaderNodeSeparateXYZ'); L_(tc.outputs['Object'], sep.inputs[0])
    t = math_('DIVIDE', sep.outputs['Z'], length)
    yn = math_('MINIMUM', math_('MAXIMUM', math_('DIVIDE', sep.outputs['Y'], radius * BODY_EY), -1.0), 1.0)
    f = math_('SUBTRACT', t, math_('MULTIPLY', math_('SUBTRACT', 1.0, yn), 0.05))
    wave = math_('COSINE', math_('MULTIPLY', math_('SUBTRACT', f, 0.20), math.tau / 0.16))
    th = math_('ADD', 0.30, math_('MULTIPLY', math_('SUBTRACT', 1.0, yn), 0.44))
    stripe = math_('MULTIPLY', math_('GREATER_THAN', wave, th), math_('MULTIPLY', math_('GREATER_THAN', f, 0.13), math_('LESS_THAN', f, 0.73)))
    stripe = math_('MULTIPLY', stripe, math_('GREATER_THAN', yn, -0.25))
    belly = math_('LESS_THAN', yn, -0.70)
    mix1 = N('ShaderNodeMix'); mix1.data_type = 'RGBA'; L_(stripe, mix1.inputs['Factor'])
    mix1.inputs['A'].default_value = lin(PAL['fur']); mix1.inputs['B'].default_value = lin(PAL['stripe'])
    mix2 = N('ShaderNodeMix'); mix2.data_type = 'RGBA'; L_(belly, mix2.inputs['Factor'])
    L_(mix1.outputs['Result'], mix2.inputs['A']); mix2.inputs['B'].default_value = lin(PAL['cream'])
    L_(mix2.outputs['Result'], bs.inputs['Base Color'])
    m.diffuse_color = lin(PAL['fur']); m['palette_hex'] = PAL['fur'] + '/' + PAL['stripe'] + '/' + PAL['cream']
    return m

def body_band(t, s):
    """Painted tabby: slanted back stripes (index 1), cream belly (index 2), fur elsewhere (0)."""
    if s < -0.72: return 2
    for c in (0.20, 0.36, 0.52, 0.67):
        if s > -0.25 and abs(t - (c + 0.05 * (1 - s))) < 0.035 * (0.55 + 0.45 * s): return 1
    return 0

def tail_band(u):
    if u > 0.86: return 2
    for c in (0.30, 0.45, 0.60, 0.74):
        if abs(u - c) < 0.032: return 1
    return 0

def clear_scene():
    if bpy.context.object and bpy.context.object.mode != 'OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    for coll in list(bpy.data.collections): bpy.data.collections.remove(coll)
    for blocks in (bpy.data.meshes, bpy.data.curves, bpy.data.armatures, bpy.data.materials, bpy.data.actions,
                   bpy.data.cameras, bpy.data.lights, bpy.data.images, bpy.data.linestyles, bpy.data.worlds):
        for b in list(blocks): blocks.remove(b)
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)

def build():
    clear_scene()
    coll = bpy.data.collections.new(MASTER); bpy.context.scene.collection.children.link(coll)
    sc = bpy.context.scene; sc.unit_settings.system = 'METRIC'; sc.unit_settings.scale_length = 1.0

    # --- Torso (tabby back stripes and cream belly painted per face), chest bib -----------------
    lathe('Lilac tabby bean body', BODY, [tabby_body_mat(BODY[-1][0], 0.163)], a=RUMP, b=CHEST, ey=BODY_EY, n=64)
    ellipsoid('Cream chest bib', (0.0, 0.245, 0.35), (0.118, 0.075, 0.125), 'cream')

    # --- Hind legs: bunched haunches for the pounce, cream sock paws ------------------------------
    for side, sx in (('right', 1), ('left', -1)):
        ellipsoid(f'Bunched haunch {side}', (0.118 * sx, -0.185, 0.245), (0.078, 0.135, 0.118), 'fur', rot=(0.25, 0, 0))
        hm = Matrix.Translation((0.118 * sx, -0.185, 0.245)) @ Matrix.Rotation(0.25, 4, 'X') @ Matrix.Diagonal((0.078, 0.135, 0.118, 1.0))
        for k, (a0, a1) in enumerate(((-0.35, 0.55), (-0.62, 0.2))):
            pts = []
            for i in range(4):
                el = a0 + (a1 - a0) * i / 3; az = -0.35 - 0.55 * k + 0.12 * i
                v = Vector((math.cos(el) * math.cos(az) * sx, math.cos(el) * math.sin(az), math.sin(el))) * 1.0
                pts.append(tuple(hm @ v))
            tube(f'Haunch tabby stripe {side} {k}', pts, [0.005, 0.009, 0.009, 0.004], 'stripe')
        lathe(f'Hind leg {side}', [(0.0, 0.052), (0.06, 0.05), (0.12, 0.046)], 'fur',
              a=(0.12 * sx, -0.19, 0.20), b=(0.122 * sx, -0.14, 0.075), n=24, dense=False)
        ellipsoid(f'Cream hind sock paw {side}', (0.122 * sx, -0.125, 0.046), (0.066, 0.088, 0.046), 'cream')
        paw_grooves(f'Hind paw {side}', (0.122 * sx, -0.125, 0.046), (0.066, 0.088, 0.046))

    # --- Front legs: left planted, right raised mid-sneak with pink toe beans ---------------------
    lathe('Front leg left (planted)', [(0.0, 0.05), (0.14, 0.046), (0.24, 0.044)], 'fur',
          a=(-0.10, 0.14, 0.33), b=(-0.106, 0.16, 0.08), n=24, dense=False)
    cyl('Cream front sock left', (-0.106, 0.16, 0.105), 0.047, 0.05, 0.07, 'cream', bev=0.006)
    ellipsoid('Cream front paw left', (-0.106, 0.185, 0.046), (0.064, 0.08, 0.046), 'cream')
    paw_grooves('Front paw left', (-0.106, 0.185, 0.046), (0.064, 0.08, 0.046))
    tube('Front leg right (raised)', [(0.10, 0.13, 0.33), (0.108, 0.19, 0.265), (0.114, 0.24, 0.23)], [0.05, 0.046, 0.045], 'fur')
    paw = empty('Raised paw frame', (0.116, 0.275, 0.215), (1.05, 0.0, -0.1))
    ellipsoid('Cream raised sock', (0, -0.045, 0.012), (0.05, 0.05, 0.045), 'cream', parent=paw)
    ellipsoid('Cream raised paw', (0, 0, 0), (0.062, 0.074, 0.05), 'cream', parent=paw)
    ellipsoid('Pink main paw pad', (0, -0.006, -0.046), (0.03, 0.024, 0.012), 'pink', parent=paw, seg=16, rings=8)
    for k, (dx, dy) in enumerate(((-0.032, 0.03), (-0.011, 0.047), (0.011, 0.047), (0.032, 0.03))):
        ellipsoid(f'Pink toe bean {k}', (dx, dy, -0.036), (0.012, 0.012, 0.01), 'pink', parent=paw, seg=12, rings=6)

    # --- Question-mark tail swung up on the kitten's right, cream tip, painted rings -------------
    tail_pts = [(0.0, -0.30, 0.30), (0.07, -0.40, 0.34), (0.20, -0.46, 0.42), (0.33, -0.45, 0.55), (0.385, -0.40, 0.69),
                (0.36, -0.34, 0.80), (0.29, -0.30, 0.835), (0.245, -0.285, 0.785)]
    _, path = sweep('Question-mark tail', tail_pts, [0.05, 0.046, 0.042, 0.04, 0.04, 0.041, 0.043], ['fur', 'stripe', 'cream'], band=tail_band)
    ellipsoid('Fluffy cream tail tip', tuple(path[-1]), (0.05, 0.05, 0.05), 'cream')

    # --- Raspberry collar with honey bell ---------------------------------------------------------
    col = empty('Collar frame', (0.0, 0.19, 0.40), (-0.25, 0.0, 0.0))
    ring('Raspberry collar', col, 0.132, 0.152, 0.021, 'collar')
    bell = empty('Bell frame', (0.0, 0.352, 0.325), (0.2, 0.0, 0.0))
    ellipsoid('Honey collar bell', (0, 0, 0), (0.037, 0.035, 0.037), 'honey', parent=bell)
    ring('Brass bell equator band', bell, 0.037, 0.035, 0.0045, 'brass')
    box('Bell bottom slot', (0, 0.0, -0.032), (0.04, 0.008, 0.012), 'ink', parent=bell, bev=0.002)
    cyl('Bell loop', (0, -0.004, 0.038), 0.012, 0.012, 0.012, 'brass', rot=(math.pi / 2, 0, 0), parent=bell, seg=16, bev=0)

    # --- Teal gadget pack (knock-off crew kit) with straps, button, dial and spring antenna ------
    pack = empty('Gadget pack frame', (0.0, -0.05, 0.505), (-0.17, 0.0, 0.0))
    box('Teal gadget pack', (0, 0, 0), (0.2, 0.17, 0.105), 'teal', parent=pack, bev=0.028)
    cyl('Big raspberry mischief button', (0.035, 0.04, 0.06), 0.032, 0.03, 0.026, 'collar', parent=pack, bev=0.006)
    cyl('Honey dial', (-0.055, 0.045, 0.058), 0.018, 0.018, 0.016, 'honey', parent=pack, bev=0.003)
    cyl('Brass pack rivet L', (-0.105, 0.0, 0.0), 0.014, 0.014, 0.012, 'brass', rot=(0, math.pi / 2, 0), parent=pack, bev=0)
    cyl('Brass pack rivet R', (0.105, 0.0, 0.0), 0.014, 0.014, 0.012, 'brass', rot=(0, math.pi / 2, 0), parent=pack, bev=0)
    coil = []
    for i in range(97):
        t = i / 96; ang = t * math.tau * 6
        coil.append((-0.03 + 0.013 * math.cos(ang), -0.055 - 0.04 * t + 0.013 * math.sin(ang), 0.05 + 0.13 * t))
    cu = bpy.data.curves.new('Brass spring antenna', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.0045; cu.bevel_resolution = 3
    cu.use_fill_caps = True; sp = cu.splines.new('POLY'); sp.points.add(len(coil) - 1)
    for pt, co in zip(sp.points, coil): pt.co = (*co, 1.0)
    link('Brass spring antenna', cu, mat('brass'), pack)
    ellipsoid('Honey antenna ball', (-0.03, -0.095, 0.2), (0.026, 0.026, 0.026), 'honey', parent=pack)
    cyl('Propeller spindle', (-0.03, -0.095, 0.232), 0.004, 0.004, 0.03, 'ink', parent=pack, bev=0)
    ellipsoid('Tiny cream propeller blade A', (-0.03, -0.095, 0.246), (0.055, 0.012, 0.005), 'cream', parent=pack, rot=(0, 0.12, 0.5))
    ellipsoid('Tiny cream propeller blade B', (-0.03, -0.095, 0.246), (0.055, 0.012, 0.005), 'cream', parent=pack, rot=(0, -0.12, 0.5 + math.pi / 2))
    axis = (CHEST - RUMP).normalized()
    for k, yy in enumerate((0.05, -0.135)):
        t = (yy - RUMP.y) / (CHEST.y - RUMP.y); c = RUMP + (CHEST - RUMP) * t
        r = interp(BODY, (c - RUMP).length) + 0.004
        strap = empty(f'Pack strap frame {k}', tuple(c), axis.to_track_quat('Z', 'Y').to_euler())
        ring(f'Teal pack strap {k}', strap, r, r * BODY_EY, 0.0085, 'teal')

    # --- Head, stripes, ears, face ----------------------------------------------------------------
    lathe('Big round kitten head', HEAD, [tabby_head_mat()], a=(0, HEAD_Y, 0), ey=HEAD_EY, n=64)
    for side, sx, tip in (('right', 1, (0.228, 0.145, 0.915)), ('left', -1, (-0.268, 0.14, 0.885))):
        base = Vector((0.145 * sx, 0.18, 0.70)); tipv = Vector(tip)
        ear = empty(f'Ear frame {side}', tuple(base)); ear.rotation_euler = (tipv - base).to_track_quat('Z', 'Y').to_euler()
        L = (tipv - base).length
        lathe(f'Big ear {side}', [(0.0, 0.104), (L * 0.45, 0.074), (L * 0.8, 0.036), (L * 0.93, 0.018), (L, 0.004)], 'fur',
              a=(0, 0, 0), ey=0.52, n=36, parent=ear)
        lathe(f'Pink inner ear {side}', [(0.02, 0.072), (L * 0.45, 0.05), (L * 0.78, 0.022), (L * 0.88, 0.006)], 'pink',
              a=(0, 0.024, 0), ey=0.36, n=36, parent=ear)
        for k, (dx, a_) in enumerate(((-0.018, 0.25), (0.012, -0.2))):
            cyl(f'Cream ear tuft {side} {k}', (dx * sx, 0.035, 0.05), 0.014, 0.0, 0.07, 'cream', parent=ear,
                rot=(0.15, a_ * sx, 0), seg=8, bev=0)
    # forehead tabby stripes (painted strips half-sunk in the surface)
    for sx in (1, -1):
        for k, (y0, z0) in enumerate(((0.26, 0.605), (0.235, 0.565))):
            pts = [(head_x(y, z0 + 0.01 * i, sx, -0.004), y, z0 + 0.01 * i) for i, y in enumerate((y0, y0 - 0.045, y0 - 0.09))]
            tube(f'Cheek tabby stripe {sx:+d} {k}', pts, [0.012, 0.011, 0.006], 'stripe')
        for k, (z, a_) in enumerate(((0.47, -0.35), (0.515, -0.1), (0.56, 0.2))):
            y = 0.24
            cyl(f'Cheek fluff tuft {sx:+d} {k}', (head_x(y, z, sx, -0.01), y, z), 0.032, 0.0, 0.075, 'fur',
                rot=(0, sx * (math.pi / 2 + a_), 0), seg=12, bev=0)

    # eyes: big honey irises glancing to the kitten's right, highlights, sly tilted lids
    for sx in (1, -1):
        ex = 0.095 * sx; ez = 0.60
        fr = head_frame(f'Eye frame {sx:+d}', ex, ez, inset=0.02)
        ellipsoid(f'Eye white {sx:+d}', (0, 0, 0), (0.054, 0.032, 0.066), 'white', parent=fr)
        ellipsoid(f'Honey iris {sx:+d}', (0.014, 0.018, -0.004), (0.037, 0.02, 0.046), 'honey', parent=fr, seg=24, rings=12)
        ellipsoid(f'Big plum pupil {sx:+d}', (0.018, 0.028, -0.004), (0.023, 0.014, 0.032), 'ink', parent=fr, seg=24, rings=12)
        ellipsoid(f'Eye highlight big {sx:+d}', (0.004, 0.038, 0.018), (0.011, 0.008, 0.012), 'white', parent=fr, seg=12, rings=6)
        ellipsoid(f'Eye highlight small {sx:+d}', (0.03, 0.036, -0.022), (0.006, 0.005, 0.006), 'white', parent=fr, seg=10, rings=6)
        if sx < 0:
            lid = empty('Lid frame left (sly squint)', (0, 0, 0), (0, 0.30, 0), parent=fr)
            ellipsoid('Sly squint lid left', (0, 0.0015, 0.056), (0.06, 0.0345, 0.028), 'fur', parent=lid)
    rb = [(0.05, 0.705), (0.095, 0.735), (0.14, 0.722)]
    tube('Raised mischief brow tuft right', [(x, head_y(x, z, 0.002), z) for x, z in rb], [0.009, 0.012, 0.006], 'stripe')
    lb = [(-0.05, 0.676), (-0.095, 0.688), (-0.138, 0.703)]
    tube('Scheming slanted brow tuft left', [(x, head_y(abs(x), z, 0.002), z) for x, z in lb], [0.009, 0.012, 0.006], 'stripe')

    # muzzle: cream whisker pads, pink nose, lopsided grin, tongue blep, chin, whiskers
    ellipsoid('Cream muzzle patch', (0.0, head_y(0, 0.51) - 0.05, 0.505), (0.12, 0.07, 0.078), 'cream')
    for sx in (1, -1):
        ellipsoid(f'Cream whisker pad {sx:+d}', (0.04 * sx, head_y(0.04, 0.505) - 0.006, 0.505), (0.05, 0.036, 0.04), 'cream')
    ellipsoid('Pink kitten nose', (0.0, head_y(0, 0.54) + 0.018, 0.54), (0.026, 0.016, 0.017), 'pink', seg=16, rings=8)
    ellipsoid('Little cream chin', (0.0, head_y(0, 0.44) - 0.03, 0.445), (0.06, 0.04, 0.035), 'cream')
    tube('Philtrum', [surface_front(0.0, z) for z in (0.524, 0.505, 0.487)], [0.004, 0.0045, 0.0045], 'ink', bres=3)
    smirk = [(-0.07, 0.484), (-0.04, 0.472), (-0.014, 0.475), (0.0, 0.484), (0.014, 0.475), (0.046, 0.471),
             (0.074, 0.483), (0.092, 0.503), (0.097, 0.52)]
    tube('Lopsided smirk', [surface_front(x, z) for x, z in smirk], [0.0035, 0.0045, 0.005, 0.005, 0.005, 0.005, 0.0048, 0.0042, 0.0028], 'ink', bres=3)
    tng = empty('Tongue frame', (-0.018, head_y(0.018, 0.466) + 0.018, 0.458), (0.35, 0.0, 0.12))
    ellipsoid('Tongue blep', (0, 0, 0), (0.019, 0.012, 0.022), 'tongue', parent=tng, seg=16, rings=8)
    for sx in (1, -1):
        for k, (z1, dz) in enumerate(((0.52, 0.025), (0.505, 0.0), (0.49, -0.028))):
            y0 = head_y(0.07, z1) - 0.005
            tube(f'Whisker {sx:+d} {k}', [(0.07 * sx, y0, z1), (0.19 * sx, y0 - 0.03, z1 + dz * 0.6), (0.3 * sx, y0 - 0.075, z1 + dz)],
                 [0.004, 0.0035, 0.002], 'ink', bres=2)

    # --- Tiny tilted plum stovepipe hat (the mayor's crew mark) ----------------------------------
    hat = empty('Hat tilt frame', (-0.03, 0.185, 0.782), (-0.06, -0.26, 0.0))
    cyl('Mini hat brim', (0, 0, 0), 0.088, 0.088, 0.014, 'hat', parent=hat, seg=40, scale=(1, 1.05, 1), bev=0.005)
    lathe('Mini stovepipe crown', [(0.0, 0.056), (0.06, 0.057), (0.11, 0.063), (0.125, 0.061), (0.128, 0.04), (0.13, 0.0)],
          'hat', a=(0, 0, 0), ey=1.05, n=40, parent=hat, dense=False)
    lathe('Mini honey hat band', [(0.008, 0.059), (0.036, 0.0595)], 'honey', a=(0, 0, 0), ey=1.05, n=40, parent=hat, dense=False)

    for ob in PARTS: ob['work_order'] = 'WO111'; ob['asset_id'] = 'mischief-kitten'

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

if __name__ == '__main__':
    sc = bpy.context.scene
    assert sc.get('asset_id') == 'mischief-kitten' and sc.get('scene_lease') == 'active'
    build(); bpy.context.view_layer.update()
    m, per = measure()
    tops = {k: round(max(v for n, v in per.items() if n.startswith(k)), 4) for k in ('Big ear right', 'Big ear left', 'Mini stovepipe crown', 'Fluffy cream tail tip', 'Question-mark tail', 'Big round kitten head', 'Honey antenna ball', 'Tiny cream propeller')}
    sc['blockout_bounds_m'] = json.dumps(m); sc['blockout_tops_m'] = json.dumps(tops)
    path = ROOT / 'mischief-kitten-blockout.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(path), compress=True)
    rec = {'saved': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bounds_blender_zup': m, 'feature_tops_m': tops,
           'parts': len(PARTS), 'materials': sorted(x.name for x in bpy.data.materials),
           'utc': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    (ROOT / 'blockout-measurements.json').write_text(json.dumps(rec, indent=2) + '\n')
    print(json.dumps(rec))
