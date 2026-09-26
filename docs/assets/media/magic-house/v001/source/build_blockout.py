"""WO111 magic-house v001: painted flat-colour BLOCKOUT for a Blender reference sheet.

Reference-sheet stage only: primitive/curve forms, no final topology, no rig, no atlas, no GLB.
Blender +Z up, character faces +Y (exports later as glTF +Y up / -Z forward), floor-centred at the origin.
Character right = +X. All dimensions in metres.

Design: World B chapter 2 boss (ages 2-4 era parody). A magical, mischievous living casita on two stubby
timber-stump legs: apricot stucco walls over a teal painted base band (zocalo), a front-facing terracotta
barrel-tile gable roof whose tiles hop and dance out of their rows, two arched windows as eyes with
top-hinged blue shutter lids (one lower = sly), flung-open side shutters as lashes, flower-box cheeks,
an arched double-door mouth flung open with a striped doormat tongue flopping over the front step,
a candle niche glowing in the gable, a jaunty tile-hatted chimney, a side balcony, vigas, a bougainvillea
vine and two little butterflies.
"""
import bpy, bmesh, math, json, hashlib, datetime
from mathutils import Vector, Matrix, Euler
from pathlib import Path

ROOT = Path('/workspace/haynes-quest/family-eras/magic-house/v001')
MASTER = 'Magic house blockout (master)'

PAL = {
    'stucco': '#f1c28c', 'zocalo': '#3f7f7a', 'trim': '#c4643f', 'floor': '#9a4a32',
    'tile_a': '#c2583a', 'tile_b': '#a8472f', 'tile_c': '#cf6c45', 'ridge': '#963f2b',
    'wood': '#7a4a2e', 'honey': '#dca953', 'coral': '#e07a5f', 'sky': '#4e8ab8', 'sky_dark': '#3d6f99',
    'door': '#e3a33f', 'mouth': '#3a2842', 'mat': '#c9506a', 'white': '#fbf6ec', 'ink': '#342c46',
    'magenta': '#d24f86', 'pink': '#ee8fb0', 'yellow': '#f2cf5b', 'leaf': '#557363', 'leaf_light': '#6f9a5e',
    'cream': '#f3e6cf', 'flame': '#ffcf6b', 'glow': '#f6c768',
}
EMIT = {'flame': 2.6, 'glow': 1.1}

def lin(h):
    h = h.lstrip('#'); out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)

MATS = {}
def mat(key):
    if key in MATS: return MATS[key]
    m = bpy.data.materials.new('MH ' + key + ' ' + PAL[key]); m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = lin(PAL[key]); bs.inputs['Roughness'].default_value = 0.92
    bs.inputs['Specular IOR Level'].default_value = 0.12
    if key in EMIT:
        bs.inputs['Emission Color'].default_value = lin(PAL[key]); bs.inputs['Emission Strength'].default_value = EMIT[key]
    m.diffuse_color = lin(PAL[key]); m['palette_hex'] = PAL[key]
    MATS[key] = m; return m

def stripe_mat():
    """Doormat tongue: lengthwise raspberry/honey stripes from object X (flat painted, no image)."""
    if 'stripes' in MATS: return MATS['stripes']
    m = bpy.data.materials.new('MH doormat stripes ' + PAL['mat'] + '/' + PAL['honey']); m.use_nodes = True
    nt = m.node_tree; bs = nt.nodes.get('Principled BSDF')
    bs.inputs['Roughness'].default_value = 0.95; bs.inputs['Specular IOR Level'].default_value = 0.1
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = 11.0
    add = nt.nodes.new('ShaderNodeMath'); add.operation = 'ADD'; add.inputs[1].default_value = 0.35
    fr = nt.nodes.new('ShaderNodeMath'); fr.operation = 'FRACT'
    ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.interpolation = 'CONSTANT'
    ramp.color_ramp.elements[0].position = 0.0; ramp.color_ramp.elements[0].color = lin(PAL['mat'])
    ramp.color_ramp.elements[1].position = 0.72; ramp.color_ramp.elements[1].color = lin(PAL['honey'])
    nt.links.new(tc.outputs['Object'], sep.inputs[0]); nt.links.new(sep.outputs['X'], mul.inputs[0])
    nt.links.new(mul.outputs[0], add.inputs[0]); nt.links.new(add.outputs[0], fr.inputs[0])
    nt.links.new(fr.outputs[0], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], bs.inputs['Base Color'])
    m.diffuse_color = lin(PAL['mat']); m['palette_hex'] = PAL['mat'] + '/' + PAL['honey']
    MATS['stripes'] = m; return m

PARTS = []
def link(name, data, m, parent=None, smooth=True):
    ob = bpy.data.objects.new(name, data); bpy.data.collections[MASTER].objects.link(ob)
    if m is not None:
        data.materials.append(m)
    if smooth and hasattr(data, 'polygons'):
        for p in data.polygons: p.use_smooth = True
    if parent is not None: ob.parent = parent
    ob['blockout_part'] = name; PARTS.append(ob); return ob

def empty(name, loc=(0, 0, 0), rot=(0, 0, 0), parent=None):
    ob = bpy.data.objects.new(name, None); bpy.data.collections[MASTER].objects.link(ob)
    ob.location = loc; ob.rotation_euler = rot; ob.empty_display_size = 0.1
    if parent is not None: ob.parent = parent
    return ob

def bevel(ob, w, seg=2):
    md = ob.modifiers.new('Soft painted edge', 'BEVEL'); md.width = w; md.segments = seg; md.limit_method = 'ANGLE'
    return ob

def ellipsoid(name, loc, s, key, rot=(0, 0, 0), parent=None, seg=24, rings=12):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0); bm.to_mesh(me); bm.free()
    ob = link(name, me, mat(key) if isinstance(key, str) else key, parent)
    ob.location = loc; ob.scale = s; ob.rotation_euler = rot; return ob

def cyl(name, loc, r1, r2, depth, key, rot=(0, 0, 0), parent=None, seg=24, scale=(1, 1, 1), bev=0.006):
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

def mesh_obj(name, verts, faces, key, smooth=True, parent=None):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    return link(name, me, (mat(key) if isinstance(key, str) else key) if key is not None else None, parent, smooth)

def lathe(name, profile, key, loc=(0, 0, 0), ey=1.0, n=32, parent=None, rot=(0, 0, 0)):
    """profile: list of (z, r) in local coordinates; ellipse scale ey on local Y."""
    cap_bottom = profile[0][1] > 1e-6; cap_top = profile[-1][1] > 1e-6
    verts = []; faces = []
    for z, r in profile:
        for i in range(n):
            a = math.tau * i / n; verts.append((r * math.cos(a), r * ey * math.sin(a), z))
    rings = len(profile)
    for j in range(rings - 1):
        for i in range(n):
            faces.append((j * n + i, j * n + (i + 1) % n, (j + 1) * n + (i + 1) % n, (j + 1) * n + i))
    if cap_bottom: faces.append(tuple(range(n - 1, -1, -1)))
    if cap_top: faces.append(tuple((rings - 1) * n + i for i in range(n)))
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    ob = link(name, me, mat(key) if isinstance(key, str) else key, parent); ob.location = loc; ob.rotation_euler = rot
    return ob

def tube(name, pts, radius, key, parent=None, poly=True, bres=3, res=4):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = radius; cu.bevel_resolution = bres
    cu.use_fill_caps = True; cu.resolution_u = res
    sp = cu.splines.new('POLY' if poly else 'NURBS'); sp.points.add(len(pts) - 1)
    if not poly: sp.order_u = min(4, len(pts)); sp.use_endpoint_u = True
    for p, co in zip(sp.points, pts): p.co = (*tuple(co), 1.0)
    return link(name, cu, mat(key), parent)

def panel(name, outline, O, H, V, D, depth, key, parent=None, bev=0.005, smooth=False):
    """Extrude a 2D outline (h, v) in the frame O + h*H + v*V, thickness along D (centred)."""
    O = Vector(O); H = Vector(H).normalized(); V = Vector(V).normalized(); D = Vector(D).normalized(); n = len(outline)
    verts = [O + H * h + V * v + D * t for t in (-depth / 2, depth / 2) for h, v in outline]
    faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))] + [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    ob = mesh_obj(name, verts, faces, key, smooth=smooth, parent=parent)
    if bev: bevel(ob, bev, 2)
    return ob

def slats(prefix, O, H, V, D, depth, h0, h1, v0, v1, n, key='sky_dark'):
    O2 = Vector(O) + Vector(D).normalized() * (depth / 2 + 0.004); pitch = (v1 - v0) / n
    for k in range(n):
        vv = v0 + pitch * (k + 0.5)
        panel(f'{prefix} louvre {k}', [(h0, vv - 0.008), (h1, vv - 0.008), (h1, vv + 0.008), (h0, vv + 0.008)], O2, H, V, D, 0.008, key, bev=0)

def arch(cx, z0, hw, spring, n=16):
    pts = [(cx - hw, z0), (cx + hw, z0)]
    for k in range(n + 1):
        a = math.pi * k / n; pts.append((cx + hw * math.cos(a), spring + hw * math.sin(a)))
    return pts

def arch_path(cx, z0, hw, spring, n=20):
    pts = [(cx + hw, z0), (cx + hw, spring)]
    for k in range(1, n):
        a = math.pi * k / n; pts.append((cx + hw * math.cos(a), spring + hw * math.sin(a)))
    return pts + [(cx - hw, spring), (cx - hw, z0)]

EYE_HW = 0.245; EYE_Z0 = 1.17; EYE_SPRING = 1.505; EYE_TOP = EYE_SPRING + EYE_HW  # 0.49 wide x 0.58 tall arched windows
def lid_half_width(z):
    return EYE_HW if z <= EYE_SPRING else math.sqrt(max(0.0, EYE_HW ** 2 - (z - EYE_SPRING) ** 2))

def lid_outline(z_lid, n=14):
    """Region of the arched eye window above z_lid, as (x offset, z)."""
    if z_lid < EYE_SPRING:
        pts = [(-EYE_HW, z_lid), (EYE_HW, z_lid)]; a0 = 0.0
    else:
        a0 = math.asin((z_lid - EYE_SPRING) / EYE_HW); pts = []
    for k in range(n + 1):
        a = a0 + (math.pi - 2 * a0) * k / n; pts.append((EYE_HW * math.cos(a), EYE_SPRING + EYE_HW * math.sin(a)))
    return pts

# Door mouth: a grin-shaped doorway. Flat segmental arch on top, deep U-shaped lower lip.
MW = 0.36; M_TOP_C, M_TOP_R = 0.282, 0.698; M_BOT_C, M_BOT_R = 0.891, 0.371
def mouth_top(x, grow=0.0):
    return M_TOP_C + math.sqrt(max(0.0, (M_TOP_R + grow) ** 2 - x * x))
def mouth_bot(x, grow=0.0):
    return M_BOT_C - math.sqrt(max(0.0, (M_BOT_R + grow) ** 2 - x * x))
def mouth_outline(grow=0.0, n=16):
    w = MW + grow
    pts = [(w * math.cos(math.pi * k / n), 0) for k in range(n + 1)]
    pts = [(x, mouth_top(x, grow)) for x, _ in pts]
    pts += [(-w * math.cos(math.pi * k / n), 0) for k in range(n + 1)]
    return pts[:n + 1] + [(x, mouth_bot(x, grow)) for x, _ in pts[n + 1:]]

def rot2(pts, pivot, th):
    c, s_ = math.cos(th), math.sin(th); px, pz = pivot
    return [(px + (h - px) * c - (v - pz) * s_, pz + (h - px) * s_ + (v - pz) * c) for h, v in pts]

def rrect(hw, hd, r, n):
    pts = []
    for (sx, sy), a0 in (((1, 1), 0), ((-1, 1), 90), ((-1, -1), 180), ((1, -1), 270)):
        cx, cy = sx * (hw - r), sy * (hd - r)
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n); pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts

def loft(name, levels, key, n=6, parent=None):
    """levels: (z, half-width, half-depth, corner radius) rounded-rectangle sections, capped."""
    ring = 4 * (n + 1); verts = []; faces = []
    for z, hw, hd, r in levels:
        verts += [(x, y, z) for x, y in rrect(hw, hd, r, n)]
    for j in range(len(levels) - 1):
        for i in range(ring):
            faces.append((j * ring + i, j * ring + (i + 1) % ring, (j + 1) * ring + (i + 1) % ring, (j + 1) * ring + i))
    faces.append(tuple(range(ring - 1, -1, -1))); faces.append(tuple((len(levels) - 1) * ring + i for i in range(ring)))
    ob = mesh_obj(name, verts, faces, key, parent=parent)
    ob.data.polygons[-1].use_smooth = False; ob.data.polygons[-2].use_smooth = False
    return ob

def interp(table, z, col):
    if z <= table[0][0]: return table[0][col]
    for a, b in zip(table, table[1:]):
        if a[0] <= z <= b[0]: return a[col] + (b[col] - a[col]) * (z - a[0]) / (b[0] - a[0])
    return table[-1][col]

# Wall body: (z, half-width, half-depth, corner radius); a soft adobe flare at the foot.
WALL = [(0.50, 0.92, 0.690, 0.10), (0.58, 0.94, 0.705, 0.11), (0.80, 0.935, 0.700, 0.11), (1.20, 0.920, 0.690, 0.10),
        (1.55, 0.905, 0.676, 0.10), (1.80, 0.900, 0.670, 0.10)]
ZOC_TOP = 0.80; ZOC_OFF = 0.012
def face_y(z):
    return interp(WALL, z, 2) + (ZOC_OFF if z <= ZOC_TOP else 0.0)
def side_x(z):
    return interp(WALL, z, 1) + (ZOC_OFF if z <= ZOC_TOP else 0.0)

# Roof: front-facing gable, ridge along Y.
RIDGE = Vector((0.0, 0.0, 2.52)); WALL_TOP = 1.80; HALF = 0.90
TH = math.atan2(RIDGE.z - WALL_TOP, HALF); CT, ST = math.cos(TH), math.sin(TH)
SLAB = 0.07; S_END = 1.47; Y_HALF = 0.86
TILE_L = 0.25; TILE_STEP = 0.20; ROWS = 7; COLS = 13; COL0 = -0.80; COL_STEP = 0.1333
def slope(side):
    sx = 1 if side == 'R' else -1
    d = Vector((sx * CT, 0, -ST)); n = Vector((sx * ST, 0, CT)); s_axis = Vector((0, sx, 0))  # right-handed frames
    return d, n, s_axis

def barrel_into(buf, base, a, side, up, L, r0, r1, lift, seg, mi, flat=0.8):
    verts, faces, smooth, mats = buf; start = len(verts); m = seg + 1
    for t in (0.0, 1.0):
        c = base + a * (L * t) + up * (lift * t); r = r0 + (r1 - r0) * t
        for k in range(m):
            ph = math.pi * k / seg; verts.append(c + side * (r * math.cos(ph)) + up * (r * flat * math.sin(ph)))
    for k in range(seg):
        faces.append((start + k, start + k + 1, start + m + k + 1, start + m + k)); smooth.append(True); mats.append(mi)
    for f in ((start + seg, start, start + m, start + m + seg), tuple(range(start, start + m)), tuple(range(start + m, start + 2 * m))):
        faces.append(f); smooth.append(False); mats.append(mi)

def buf_object(name, buf, keys, parent=None):
    verts, faces, smooth, mats = buf
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    for k in keys: me.materials.append(mat(k))
    for p, s, mi in zip(me.polygons, smooth, mats): p.use_smooth = s; p.material_index = mi
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    return link(name, me, None, parent, smooth=False)

def tile_object(name, key, L=TILE_L, r0=0.052, r1=0.062):
    buf = ([], [], [], [])
    barrel_into(buf, Vector((-L / 2, 0, -0.01)), Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)), L, r0, r1, 0.0, 10, 0)
    return buf_object(name, buf, [key])

# Dancing tiles: (slope, row, column, hover above slot, extra local rotation, colour)
DANCERS = [('R', 1, 10, 0.27, (0.55, -0.40, 0.30), 'honey'),
           ('L', 2, 11, 0.30, (-0.60, 0.45, -0.50), 'coral'),
           ('R', 3, 5, 0.24, (0.30, 0.65, 0.90), 'zocalo'),
           ('L', 0, 4, 0.33, (0.90, -0.25, 0.40), 'sky'),
           ('R', 0, 2, 0.30, (-0.45, -0.55, -0.70), 'tile_c')]
HOP_CAP = 6

def clear_scene():
    if bpy.context.object and bpy.context.object.mode != 'OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    for coll in list(bpy.data.collections): bpy.data.collections.remove(coll)
    for blocks in (bpy.data.meshes, bpy.data.curves, bpy.data.armatures, bpy.data.materials, bpy.data.actions,
                   bpy.data.cameras, bpy.data.lights, bpy.data.images, bpy.data.linestyles):
        for b in list(blocks): blocks.remove(b)
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)

def flowers(prefix, pts, parent=None):
    cols = ['magenta', 'pink', 'yellow', 'magenta', 'pink']
    for k, p in enumerate(pts):
        ellipsoid(f'{prefix} flower {k}', p, (0.043, 0.036, 0.040), cols[k % len(cols)], seg=16, rings=8, parent=parent)
        ellipsoid(f'{prefix} leaf {k}', (p[0] + 0.03, p[1] - 0.012, p[2] - 0.03), (0.035, 0.02, 0.018), 'leaf_light',
                  rot=(0, 0.5, 0), seg=12, rings=6, parent=parent)

def butterfly(name, loc, rot, upper='coral', lower='honey'):
    fr = empty(name + ' frame', loc, rot)
    ellipsoid(name + ' body', (0, 0, 0), (0.011, 0.011, 0.042), 'ink', parent=fr, seg=12, rings=8)
    for sx in (1, -1):
        ellipsoid(f'{name} upper wing {sx:+d}', (0.043 * sx, 0, 0.016), (0.046, 0.005, 0.036), upper, rot=(0, 0.35 * sx, 0), parent=fr, seg=16, rings=8)
        ellipsoid(f'{name} lower wing {sx:+d}', (0.032 * sx, 0, -0.020), (0.032, 0.005, 0.026), lower, rot=(0, -0.3 * sx, 0), parent=fr, seg=16, rings=8)
        tube(f'{name} antenna {sx:+d}', [(0.004 * sx, 0, 0.036), (0.016 * sx, 0, 0.062), (0.022 * sx, 0, 0.068)], 0.0025, 'ink', parent=fr, bres=1)
    for ob in fr.children: ob['floating'] = True
    return fr

def build():
    clear_scene()
    coll = bpy.data.collections.new(MASTER); bpy.context.scene.collection.children.link(coll)
    sc = bpy.context.scene; sc.unit_settings.system = 'METRIC'; sc.unit_settings.scale_length = 1.0

    # --- Two stubby timber-stump legs with rounded teal clog feet --------------------------------
    for side, sx in (('right', 1), ('left', -1)):
        cyl(f'Timber stump leg {side}', (0.48 * sx, 0.02, 0.26), 0.128, 0.118, 0.30, 'wood', bev=0.012)
        ellipsoid(f'Teal clog foot {side}', (0.50 * sx, 0.10, 0.085), (0.18, 0.27, 0.085), 'zocalo')
        cyl(f'Honey foot band {side}', (0.48 * sx, 0.02, 0.155), 0.136, 0.134, 0.03, 'honey', bev=0.004)

    # --- Floor slab, walls, painted teal base band (zocalo) -------------------------------------
    loft('Terracotta floor slab', [(0.38, 0.90, 0.66, 0.12), (0.40, 0.98, 0.74, 0.14), (0.50, 0.98, 0.74, 0.14), (0.52, 0.96, 0.72, 0.13)], 'floor')
    loft('Apricot stucco walls', WALL, 'stucco')
    zl = [(z, hw + ZOC_OFF, hd + ZOC_OFF, r + ZOC_OFF) for z, hw, hd, r in WALL if z <= ZOC_TOP]
    loft('Teal zocalo base band', [(0.505,) + zl[0][1:]] + zl[1:], 'zocalo')

    # --- Front gable (stucco) and the barrel-tile roof ---------------------------------------------
    panel('Stucco front-to-back gable', [(-HALF, WALL_TOP), (HALF, WALL_TOP), (0.0, RIDGE.z)], (0, 0, 0), (1, 0, 0), (0, 0, 1), (0, 1, 0),
          2 * WALL[-1][2], 'stucco', bev=0.01)
    for side in ('R', 'L'):
        d, n, s_axis = slope(side); pts = []
        for s in (-0.035, S_END):
            for y in (-Y_HALF, Y_HALF):
                for off in (0.0, SLAB):
                    pts.append(RIDGE + d * s + n * off + Vector((0, y, 0)))
        # corners indexed [s][y][off]
        idx = lambda a, b, c: a * 4 + b * 2 + c
        faces = [(idx(0, 0, 0), idx(1, 0, 0), idx(1, 1, 0), idx(0, 1, 0)), (idx(0, 0, 1), idx(0, 1, 1), idx(1, 1, 1), idx(1, 0, 1)),
                 (idx(0, 0, 0), idx(0, 0, 1), idx(1, 0, 1), idx(1, 0, 0)), (idx(0, 1, 0), idx(1, 1, 0), idx(1, 1, 1), idx(0, 1, 1)),
                 (idx(0, 0, 0), idx(0, 1, 0), idx(0, 1, 1), idx(0, 0, 1)), (idx(1, 0, 0), idx(1, 0, 1), idx(1, 1, 1), idx(1, 1, 0))]
        slab = mesh_obj(f'Timber roof deck {side}', pts, faces, 'wood', smooth=False); bevel(slab, 0.01, 2)
        gaps = {(r, c) for s_, r, c, *_ in DANCERS if s_ == side}
        if side == 'L': gaps |= {(2, 4), (3, 4)}  # chimney stack passes through here
        buf = ([], [], [], [])
        for i in range(ROWS):
            for j in range(COLS):
                if (i, j) in gaps: continue
                y = COL0 + COL_STEP * j; s0 = 0.06 + TILE_STEP * i
                base = RIDGE + d * s0 + n * SLAB + Vector((0, y, 0))
                mi = 1 if (i * 7 + j * 3) % 5 == 0 else (2 if (i * 5 + j * 2) % 7 == 0 else 0)
                barrel_into(buf, base, d, s_axis, n, TILE_L, 0.052, 0.062, 0.014, 8, mi)
        buf_object(f'Terracotta barrel tiles {side}', buf, ['tile_a', 'tile_b', 'tile_c'])
    z_rt = RIDGE.z + SLAB / CT - 0.02; buf = ([], [], [], [])
    for k in range(9):
        if k == HOP_CAP: continue
        barrel_into(buf, Vector((0, -0.86 + 0.19 * k, z_rt)), Vector((0, 1, 0)), Vector((-1, 0, 0)), Vector((0, 0, 1)), 0.24, 0.072, 0.082, 0.01, 10, 0)
    buf_object('Ridge cap tiles', buf, ['ridge'])

    # Dancing tiles: popped out of their rows, hovering and twisting (floating parts)
    for k, (side, i, j, hover, extra, col) in enumerate(DANCERS):
        d, n, s_axis = slope(side)
        base = RIDGE + d * (0.06 + TILE_STEP * i + TILE_L / 2) + n * (SLAB + hover) + Vector((0, COL0 + COL_STEP * j, 0))
        t = tile_object(f'Dancing roof tile {k + 1} ({col})', col)
        basis = Matrix((d, s_axis, n)).transposed().to_4x4()
        t.matrix_world = Matrix.Translation(base) @ basis @ Euler(extra).to_matrix().to_4x4(); t['floating'] = True
    hop = tile_object('Dancing ridge cap (hopping)', 'ridge', L=0.24, r0=0.072, r1=0.082)
    hop.matrix_world = (Matrix.Translation((0.06, -0.86 + 0.19 * HOP_CAP + 0.12, z_rt + 0.25)) @
                        Matrix(((0, -1, 0), (1, 0, 0), (0, 0, 1))).to_4x4() @ Euler((0.35, 0.0, 0.25)).to_matrix().to_4x4())
    hop['floating'] = True

    # Chimney with a little tile hat, leaning jauntily out of the left slope
    ch = empty('Chimney lean frame', (-0.52, -0.28, 1.94), (0.05, -0.08, 0.12))
    box('Stucco chimney stack', (0, 0, 0.36), (0.26, 0.26, 0.72), 'stucco', parent=ch, bev=0.02)
    box('Terracotta chimney cap', (0, 0, 0.745), (0.34, 0.34, 0.05), 'trim', parent=ch, bev=0.012)
    hat = ([], [], [], [])
    barrel_into(hat, Vector((0, -0.19, 0.765)), Vector((0, 1, 0)), Vector((-1, 0, 0)), Vector((0, 0, 1)), 0.38, 0.1, 0.1, 0.0, 10, 0, flat=0.9)
    buf_object('Chimney tile hat', hat, ['ridge'], parent=ch)

    # Vigas (round roof-beam ends) under the side eaves
    for sx, ys in ((1, (-0.45, 0.45)), (-1, (-0.45, 0.0, 0.45))):
        for y in ys:
            c = cyl(f'Viga beam end {sx:+d} {y:+.2f}', (sx * 0.965, y, 1.63), 0.045, 0.045, 0.16, 'wood', rot=(0, math.pi / 2, 0), bev=0.008)

    # --- Candle niche in the gable (the house's glowing heart) --------------------------------------
    gy = WALL[-1][2]
    panel('Plum candle niche', arch(0, 1.96, 0.10, 2.10), (0, gy + 0.004, 0), (1, 0, 0), (0, 0, 1), (0, 1, 0), 0.02, 'mouth', bev=0.003)
    ellipsoid('Honey candle glow', (0, gy + 0.016, 2.095), (0.055, 0.004, 0.068), 'glow', seg=24, rings=12)
    cyl('Cream candle', (0, gy + 0.035, 2.005), 0.028, 0.028, 0.09, 'cream', bev=0.004)
    lathe('Candle flame', [(0.0, 0.0), (0.013, 0.014), (0.021, 0.034), (0.019, 0.058), (0.012, 0.085), (0.005, 0.11), (0.0, 0.125)], 'flame',
          loc=(0, gy + 0.035, 2.052), n=16)
    tube('Niche frame', [(x, gy + 0.018, z) for x, z in arch_path(0, 1.955, 0.122, 2.10)], 0.02, 'trim')
    box('Niche sill', (0, gy + 0.03, 1.945), (0.29, 0.06, 0.03), 'trim', bev=0.008)

    ov = empty('Back gable vent frame', (0, -gy - 0.006, 2.10), (math.pi / 2, 0, 0))
    cyl('Back gable vent ring', (0, 0, 0), 0.105, 0.105, 0.03, 'trim', parent=ov, seg=32, bev=0.006)
    cyl('Back gable vent opening', (0, 0, 0.004), 0.075, 0.075, 0.03, 'mouth', parent=ov, seg=32, bev=0.003)
    for k in range(4):
        box(f'Back gable vent spoke {k}', (0, 0, 0.012), (0.15, 0.018, 0.012), 'trim', rot=(0, 0, math.pi * k / 4), parent=ov, bev=0)

    # --- Face: shutter eyes, flower-box cheeks ----------------------------------------------------
    for side, cx in (('right', 0.47), ('left', -0.47)):
        sx = 1 if cx > 0 else -1
        fy = face_y(1.45)
        panel(f'Eye white window {side}', arch(cx, EYE_Z0, EYE_HW, EYE_SPRING), (0, fy - 0.004, 0), (1, 0, 0), (0, 0, 1), (0, 1, 0), 0.04, 'white', bev=0.006)
        ellipsoid(f'Side-glancing pupil {side}', (cx + 0.055, fy + 0.018, 1.37), (0.092, 0.02, 0.112), 'ink', seg=20, rings=10)
        ellipsoid(f'Pupil sparkle {side}', (cx + 0.025, fy + 0.034, 1.415), (0.027, 0.008, 0.031), 'white', seg=12, rings=6)
        tube(f'Terracotta eye arch {side}', [(x, face_y(z) + 0.012, z) for x, z in arch_path(cx, EYE_Z0 - 0.01, EYE_HW + 0.027, EYE_SPRING)], 0.028, 'trim')
        # top-hinged Bahama shutter lid: the (character) left one sits lower for a sly look
        z_lid = 1.565 if sx > 0 else 1.47; alpha = 0.22; hinge_z = EYE_TOP + 0.03
        O = Vector((cx, fy + 0.05, hinge_z)); V = Vector((0, -math.sin(alpha), math.cos(alpha))); D = Vector((0, math.cos(alpha), math.sin(alpha)))
        tilt = -0.15 if sx < 0 else -0.10  # left: inner edge lowered (sly); right: inner edge raised (cheeky brow)
        pivot = (0.0, z_lid - hinge_z)
        panel(f'Blue shutter eyelid {side}', rot2([(h, z - hinge_z) for h, z in lid_outline(z_lid)], pivot, tilt), O, (1, 0, 0), V, D, 0.026, 'sky', bev=0.005)
        O2 = O + D * 0.017; zz = z_lid + 0.03; k = 0
        while zz < EYE_TOP - 0.035:
            w = lid_half_width(zz) - 0.03
            if w > 0.04:
                panel(f'Eyelid {side} louvre {k}', rot2([(-w, zz - hinge_z - 0.008), (w, zz - hinge_z - 0.008), (w, zz - hinge_z + 0.008), (-w, zz - hinge_z + 0.008)], pivot, tilt),
                      O2, (1, 0, 0), V, D, 0.008, 'sky_dark', bev=0)
            zz += 0.045; k += 1
        # flung-open side shutters (lashes)
        for tag, hs in (('outer', sx), ('inner', -sx)):
            hx = cx + hs * (EYE_HW + 0.03); H = Vector((hs * math.cos(math.radians(35)), math.sin(math.radians(35)), 0)); D2 = Vector((-H.y, H.x, 0)) * hs
            O2 = Vector((hx, face_y(1.45) + 0.012, 0))
            outline = [(0.0, 1.19), (0.15, 1.19), (0.15, 1.655), (0.13, 1.69), (0.075, 1.705), (0.0, 1.69)]
            panel(f'Blue side shutter {tag} {side}', outline, O2, H, (0, 0, 1), D2, 0.024, 'sky', bev=0.005)
            slats(f'Side shutter {tag} {side}', O2, H, (0, 0, 1), D2, 0.024, 0.02, 0.13, 1.22, 1.65, 7)
            slats(f'Side shutter {tag} {side} back', O2, H, (0, 0, 1), -D2, 0.024, 0.02, 0.13, 1.22, 1.65, 7)
        # flower-box cheek under the eye
        box(f'Terracotta flower-box cheek {side}', (cx, face_y(1.12) + 0.045, 1.125), (0.46, 0.09, 0.08), 'trim', bev=0.012)
        flowers(f'Cheek {side}', [(cx + dx, face_y(1.12) + 0.07, 1.19 + 0.012 * ((k + 1) % 2)) for k, dx in enumerate((-0.17, -0.085, 0.0, 0.085, 0.17))])

    # --- Door mouth: arched double door flung open, plum interior, doormat tongue, step lip ------------
    panel('Plum grin door-mouth interior', mouth_outline(), (0, face_y(0.7) - 0.05, 0), (1, 0, 0), (0, 0, 1), (0, 1, 0), 0.11, 'mouth', bev=0.006)
    lip = mouth_outline(grow=0.032, n=22)
    tube('Terracotta door frame and lower lip', [(x, face_y(z) + 0.014, z) for x, z in lip + lip[:1]], 0.034, 'trim')
    for side, hs in (('right', 1), ('left', -1)):
        hinge = Vector((MW * hs, face_y(0.7) + 0.005, 0)); ang = math.radians(40)
        H = Vector((hs * math.cos(ang), math.sin(ang), 0))  # opened ~140 deg: leaf folds back outward-forward from its jamb
        D = Vector((H.y, -H.x, 0)).normalized()
        us = [0.355 * k / 12 for k in range(13)]  # u = distance from hinge; the free edge is the tallest
        outline = [(u, mouth_bot(MW - u) + 0.008) for u in us] + [(u, mouth_top(MW - u) - 0.008) for u in reversed(us)]
        panel(f'Honey door leaf {side}', outline, hinge, H, (0, 0, 1), D, 0.035, 'door', bev=0.006)
        for fs in (1, -1):
            c = hinge + H * 0.20 + D * (fs * 0.02) + Vector((0, 0, 0.765))
            ellipsoid(f'Door flower centre {side} {fs:+d}', tuple(c), (0.026, 0.026, 0.026), 'cream', seg=12, rings=6)
            for p in range(5):
                a = math.tau * p / 5 + 0.3; off = H * (0.045 * math.cos(a)) + Vector((0, 0, 0.045 * math.sin(a)))
                ellipsoid(f'Door flower petal {side} {fs:+d} {p}', tuple(c + off), (0.024, 0.024, 0.024), 'coral', seg=12, rings=6)
            ctr = hinge + H * 0.22 + D * (fs * 0.019) + Vector((0, 0, 0.625))
            panel(f'Door leaf panel line {side} {fs:+d}', [(-0.09, -0.008), (0.09, -0.008), (0.09, 0.008), (-0.09, 0.008)],
                  ctr, H, (0, 0, 1), D, 0.006, 'trim', bev=0)
        ellipsoid(f'Door knob {side}', tuple(hinge + H * 0.32 + D * 0.03 + Vector((0, 0, 0.75))), (0.02, 0.02, 0.02), 'honey', seg=12, rings=6)
    box('Terracotta step lip', (0, 0.84, 0.47), (0.80, 0.22, 0.10), 'trim', bev=0.035)
    path = [(0.0, y, 0.575 - 0.038 * min(1.0, (y - 0.60) / 0.20)) for y in [0.60 + 0.30 * k / 8 for k in range(9)]]
    path += [(0.0, 0.90 + 0.07 * math.cos(math.radians(a)), 0.466 + 0.07 * math.sin(math.radians(a))) for a in (78, 60, 42, 24, 8)]
    path += [(0.0, 0.972 + 0.003 * k, 0.466 - 0.03 * k) for k in range(1, 8)]
    path += [(0.0, 0.993 + 0.012 * k * k, 0.256 - 0.022 * k) for k in range(1, 4)]
    L = [0.0]
    for a, b in zip(path, path[1:]): L.append(L[-1] + (Vector(b) - Vector(a)).length)
    verts = []; faces = []
    for k, (p, s) in enumerate(zip(path, L)):
        w = 0.13 + 0.06 * min(1.0, s / 0.30)
        if s > L[-1] - 0.13: w = 0.19 * math.sqrt(max(0.0, 1 - ((s - (L[-1] - 0.13)) / 0.135) ** 2))
        w = max(w, 0.02)
        verts += [(-w, p[1], p[2]), (w, p[1], p[2])]
        if k: faces.append((2 * k - 2, 2 * k - 1, 2 * k + 1, 2 * k))
    tongue = mesh_obj('Striped doormat tongue', verts, faces, stripe_mat())
    so = tongue.modifiers.new('Mat thickness', 'SOLIDIFY'); so.thickness = 0.022; so.offset = 0.0
    tongue.modifiers.new('Soft mat', 'SUBSURF').levels = 1

    # --- Right-side balcony with blue railing, pots and a little side door --------------------------------
    box('Timber balcony floor', (1.075, 0.0, 1.125), (0.36, 0.68, 0.05), 'wood', bev=0.01)
    for y in (-0.24, 0.24):
        panel(f'Timber balcony corbel {y:+.2f}', [(0.90, 1.10), (1.16, 1.10), (1.10, 1.03), (0.98, 0.93), (0.90, 0.90)],
              (0, y, 0), (1, 0, 0), (0, 0, 1), (0, 1, 0), 0.06, 'wood', bev=0.008)
    box('Blue balcony front rail', (1.225, 0.0, 1.42), (0.05, 0.70, 0.04), 'sky', bev=0.01)
    for y in (-0.33, 0.33):
        box(f'Blue balcony side rail {y:+.2f}', (1.07, y, 1.42), (0.33, 0.05, 0.04), 'sky', bev=0.01)
        for x in (0.935, 1.225):
            cyl(f'Blue balcony post {x:.2f} {y:+.2f}', (x, y, 1.285), 0.024, 0.024, 0.27, 'sky', bev=0.004)
    for k in range(7):
        cyl(f'Blue baluster front {k}', (1.225, -0.24 + 0.08 * k, 1.285), 0.015, 0.015, 0.25, 'sky', seg=12, bev=0)
    for y in (-0.33, 0.33):
        for x in (1.01, 1.08, 1.15):
            cyl(f'Blue baluster side {x:.2f} {y:+.2f}', (x, y, 1.285), 0.015, 0.015, 0.25, 'sky', seg=12, bev=0)
    for y in (-0.17, 0.17):
        cyl(f'Balcony pot {y:+.2f}', (1.225, y, 1.48), 0.05, 0.042, 0.08, 'trim', bev=0.006)
        flowers(f'Balcony pot {y:+.2f}', [(1.215, y - 0.03, 1.535), (1.235, y + 0.03, 1.54), (1.225, y, 1.565)])
    sxw = side_x(1.4)
    panel('Blue balcony side door', arch(0, 1.15, 0.17, 1.44), (sxw + 0.008, 0, 0), (0, 1, 0), (0, 0, 1), (1, 0, 0), 0.03, 'sky', bev=0.005)
    tube('Side door frame', [(sxw + 0.02, h, z) for h, z in arch_path(0, 1.15, 0.195, 1.44)], 0.024, 'trim')
    ellipsoid('Side door knob', (sxw + 0.035, -0.12, 1.33), (0.018, 0.018, 0.018), 'honey', seg=12, rings=6)

    # --- Left side and back: sleepy closed-shutter windows, planters -------------------------------------------
    sxl = side_x(1.35)
    Ol = Vector((-sxl - 0.012, 0.05, 0))
    panel('Closed side shutters left', [(-0.17, 1.15), (0.17, 1.15), (0.17, 1.55), (-0.17, 1.55)], Ol, (0, 1, 0), (0, 0, 1), (-1, 0, 0), 0.026, 'sky')
    slats('Closed side shutters left', Ol, (0, 1, 0), (0, 0, 1), (-1, 0, 0), 0.026, -0.15, 0.15, 1.18, 1.52, 6)
    box('Closed side shutter seam left', (-sxl - 0.03, 0.05, 1.35), (0.012, 0.012, 0.40), 'sky_dark', bev=0)
    tube('Left window frame', [(-sxl - 0.02, 0.05 + h, z) for h, z in [(0.2, 1.13), (0.2, 1.57), (-0.2, 1.57), (-0.2, 1.13)]], 0.024, 'trim')
    box('Left window planter', (-sxl - 0.05, 0.05, 1.10), (0.09, 0.44, 0.07), 'trim', bev=0.01)
    flowers('Left planter', [(-sxl - 0.07, 0.05 + dy, 1.16) for dy in (-0.14, -0.05, 0.05, 0.14)])
    by = face_y(1.35)
    Ob = Vector((0.32, -by - 0.012, 0))
    for hs in (1, -1):
        panel(f'Closed back shutter {hs:+d}', [(0.0, 1.15), (0.155 * hs, 1.15), (0.155 * hs, 1.56), (0.0, 1.56)], Ob, (-1, 0, 0), (0, 0, 1), (0, -1, 0), 0.026, 'sky')
        slats(f'Closed back shutter {hs:+d}', Ob, (-1, 0, 0), (0, 0, 1), (0, -1, 0), 0.026, min(0.015 * hs, 0.14 * hs), max(0.015 * hs, 0.14 * hs), 1.18, 1.53, 6)
    tube('Back window frame', [(0.32 + h, -by - 0.02, z) for h, z in [(0.18, 1.13), (0.18, 1.58), (-0.18, 1.58), (-0.18, 1.13)]], 0.024, 'trim')
    box('Back window planter', (0.32, -by - 0.05, 1.10), (0.42, 0.09, 0.07), 'trim', bev=0.01)
    flowers('Back planter', [(0.32 + dx, -by - 0.07, 1.16) for dx in (-0.14, -0.05, 0.05, 0.14)])

    # --- Bougainvillea vine up the front-left corner --------------------------------------------------
    vp = [(-0.935, 0.655, 0.53), (-0.955, 0.64, 0.80), (-0.915, 0.685, 1.05), (-0.955, 0.645, 1.32), (-0.918, 0.69, 1.55), (-0.95, 0.65, 1.74),
          (-0.99, 0.55, 1.80)]
    tube('Bougainvillea vine', vp, 0.022, 'leaf', poly=False, res=8)
    for k, p in enumerate(vp[1:]):
        for m, (dx, dy, dz) in enumerate(((0.03, 0.03, 0.02), (-0.03, 0.035, -0.03), (0.0, 0.05, 0.05))):
            ellipsoid(f'Bougainvillea bloom {k} {m}', (p[0] + dx, p[1] + dy, p[2] + dz), (0.042, 0.034, 0.038), 'magenta' if (k + m) % 3 else 'pink', seg=14, rings=7)
        ellipsoid(f'Bougainvillea leaf {k}', (p[0] - 0.04, p[1] + 0.01, p[2] - 0.06), (0.04, 0.018, 0.022), 'leaf', rot=(0.3, 0.6, 0.2), seg=12, rings=6)

    # --- Two little butterflies (floating) -----------------------------------------------------------
    butterfly('Butterfly coral', (0.62, 0.98, 2.06), (0.25, 0.0, 0.45))
    butterfly('Butterfly honey', (-0.64, 0.96, 2.30), (-0.2, 0.25, -0.55), upper='honey', lower='coral')

    for ob in PARTS: ob['work_order'] = 'WO111'; ob['asset_id'] = 'magic-house'

def measure(objs=None, solid_only=False):
    dg = bpy.context.evaluated_depsgraph_get(); lo = [1e9] * 3; hi = [-1e9] * 3; tris = 0
    for ob in (objs or [o for o in bpy.data.collections[MASTER].objects]):
        if ob.type not in ('MESH', 'CURVE'): continue
        if solid_only and ob.get('floating'): continue
        ev = ob.evaluated_get(dg); me = ev.to_mesh()
        for vtx in me.vertices:
            w = ev.matrix_world @ vtx.co
            for k in range(3): lo[k] = min(lo[k], w[k]); hi[k] = max(hi[k], w[k])
        me.calc_loop_triangles(); tris += len(me.loop_triangles); ev.to_mesh_clear()
    return {'min': [round(x, 4) for x in lo], 'max': [round(x, 4) for x in hi],
            'size': [round(hi[k] - lo[k], 4) for k in range(3)], 'blockout_triangles': tris}

if __name__ == '__main__':
    sc = bpy.context.scene
    assert sc.get('asset_id') == 'magic-house' and sc.get('scene_lease') == 'active'
    build(); bpy.context.view_layer.update()
    m = measure(); solid = measure(solid_only=True)
    sc['blockout_bounds_m'] = json.dumps(m); sc['blockout_solid_bounds_m'] = json.dumps(solid)
    path = ROOT / 'magic-house-blockout.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(path), compress=True)
    rec = {'saved': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bounds_blender_zup': m,
           'solid_bounds_blender_zup_excluding_dancing_tiles_and_butterflies': solid,
           'parts': len(PARTS), 'materials': sorted(x.name for x in bpy.data.materials),
           'utc': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    (ROOT / 'blockout-measurements.json').write_text(json.dumps(rec, indent=2) + '\n')
    print(json.dumps(rec))
