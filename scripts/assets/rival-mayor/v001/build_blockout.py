"""WO111 rival-mayor v001: painted flat-colour BLOCKOUT for a Blender reference sheet.

Reference-sheet stage only: primitive/curve forms, no final topology, no rig, no atlas, no GLB.
Blender +Z up, character faces +Y (exports later as glTF +Y up / -Z forward), floor-centred at the origin.
Character right = +X. All dimensions in metres.

Design: World A chapter 2 boss (ages 2-5 era parody). A scheming, mustached rival-town mayor:
very tall jaunty stovepipe hat with a kitten badge, egg head with a long rosy nose, huge curly
handlebar mustache wider than the head, smug half-lidded side-eye, pear-shaped aubergine tailcoat
over a honey waistcoat, raspberry sash with a kitten rosette, skinny pinstripe trousers, cream spats,
long pointed shoes, left fist on hip, right hand holding a teal remote-control contraption with a
big button, dials, crank and a spring antenna topped by a tiny propeller.
"""
import bpy, bmesh, math, json, hashlib, datetime
from mathutils import Vector, Matrix, Euler
from pathlib import Path

ROOT = Path('/workspace/haynes-quest/family-eras/rival-mayor/v001')
MASTER = 'Rival mayor blockout (master)'

PAL = {
    'hat': '#2f2740', 'ink': '#342c46', 'coat': '#5b3b6a', 'coat_dark': '#47304f', 'vest': '#dca953',
    'sash': '#b54a5a', 'teal': '#3f7f7a', 'cream': '#f3e6cf', 'skin': '#efc9a4', 'nose': '#e39a88',
    'stache': '#2b2238', 'stripe_dark': '#3a2e4d', 'stripe_light': '#8a7c96', 'white': '#fbf6ec',
    'brass': '#c9923e', 'leaf': '#557363',
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
    m = bpy.data.materials.new('RM ' + key + ' ' + PAL[key]); m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = lin(PAL[key]); bs.inputs['Roughness'].default_value = 0.92
    bs.inputs['Specular IOR Level'].default_value = 0.12
    m.diffuse_color = lin(PAL[key]); m['palette_hex'] = PAL[key]
    MATS[key] = m; return m

def stripe_mat():
    """Pinstripe trousers: radial stripes around each leg's local Z axis (flat painted, no image)."""
    if 'stripes' in MATS: return MATS['stripes']
    m = bpy.data.materials.new('RM pinstripe trousers ' + PAL['stripe_dark'] + '/' + PAL['stripe_light']); m.use_nodes = True
    nt = m.node_tree; bs = nt.nodes.get('Principled BSDF')
    bs.inputs['Roughness'].default_value = 0.92; bs.inputs['Specular IOR Level'].default_value = 0.12
    tc = nt.nodes.new('ShaderNodeTexCoord'); gr = nt.nodes.new('ShaderNodeTexGradient'); gr.gradient_type = 'RADIAL'
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = 12
    fr = nt.nodes.new('ShaderNodeMath'); fr.operation = 'FRACT'
    ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.interpolation = 'CONSTANT'
    ramp.color_ramp.elements[0].position = 0.0; ramp.color_ramp.elements[0].color = lin(PAL['stripe_dark'])
    ramp.color_ramp.elements[1].position = 0.78; ramp.color_ramp.elements[1].color = lin(PAL['stripe_light'])
    nt.links.new(tc.outputs['Object'], gr.inputs['Vector']); nt.links.new(gr.outputs['Fac'], mul.inputs[0])
    nt.links.new(mul.outputs[0], fr.inputs[0]); nt.links.new(fr.outputs[0], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], bs.inputs['Base Color'])
    m.diffuse_color = lin(PAL['stripe_dark']); m['palette_hex'] = PAL['stripe_dark'] + '/' + PAL['stripe_light']
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

def ellipsoid(name, loc, s, key, rot=(0, 0, 0), parent=None, seg=32, rings=16):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0); bm.to_mesh(me); bm.free()
    ob = link(name, me, mat(key) if isinstance(key, str) else key, parent)
    ob.location = loc; ob.scale = s; ob.rotation_euler = rot; return ob

def cyl(name, loc, r1, r2, depth, key, rot=(0, 0, 0), parent=None, seg=32, scale=(1, 1, 1), bev=0.006):
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

def lathe(name, profile, key, loc=(0, 0, 0), ey=1.0, n=40, parent=None, cap_bottom=True, cap_top=True, rot=(0, 0, 0)):
    """profile: list of (z, r) in local coordinates; ellipse scale ey on local Y."""
    cap_bottom = cap_bottom and profile[0][1] > 1e-6; cap_top = cap_top and profile[-1][1] > 1e-6
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

def tube(name, pts, radii, key, parent=None, res=4, bres=6):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 1.0; cu.bevel_resolution = bres
    cu.use_fill_caps = True; cu.resolution_u = res
    sp = cu.splines.new('NURBS'); sp.points.add(len(pts) - 1); sp.order_u = min(4, len(pts)); sp.use_endpoint_u = True
    rr = radii if isinstance(radii, (list, tuple)) else [radii] * len(pts)
    for p, (x, y, z), r in zip(sp.points, pts, rr): p.co = (x, y, z, 1.0); p.radius = r
    ob = link(name, cu, mat(key), parent); return ob

def prism(name, outline_xz, depth, key, loc, rot=(0, 0, 0), parent=None, bev=0.01):
    n = len(outline_xz)
    verts = [(x, y, z) for y in (-depth / 2, depth / 2) for x, z in outline_xz]
    faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))] + [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    ob = link(name, me, mat(key), parent, smooth=False); ob.location = loc; ob.rotation_euler = rot
    if bev: bevel(ob, bev, 2)
    return ob

def along(ob, a, b):
    """Orient an object whose local Z is its axis from point a toward b, centred between them."""
    a = Vector(a); b = Vector(b); ob.location = (a + b) / 2
    ob.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler(); return ob

def interp(profile, z):
    if z <= profile[0][0]: return profile[0][1] if z >= profile[0][0] - 1e-9 else 0.0
    for (z0, r0), (z1, r1) in zip(profile, profile[1:]):
        if z0 <= z <= z1: return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return 0.0

HEAD = [(1.50, 0.0), (1.515, 0.075), (1.55, 0.132), (1.62, 0.172), (1.71, 0.190), (1.80, 0.190),
        (1.88, 0.178), (1.94, 0.150), (1.985, 0.090), (2.00, 0.0)]
HEAD_EY = 1.05; HEAD_Y = 0.01
def head_y(x, z, off=0.0):
    r = interp(HEAD, z); return HEAD_Y + HEAD_EY * math.sqrt(max(0.0, r * r - x * x)) + off

COAT = [(0.64, 0.300), (0.70, 0.335), (0.82, 0.365), (0.95, 0.372), (1.08, 0.360), (1.20, 0.330),
        (1.30, 0.290), (1.38, 0.245), (1.44, 0.190), (1.48, 0.120), (1.50, 0.050)]
COAT_EY = 0.90

def clear_scene():
    if bpy.context.object and bpy.context.object.mode != 'OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    for coll in list(bpy.data.collections): bpy.data.collections.remove(coll)
    for blocks in (bpy.data.meshes, bpy.data.curves, bpy.data.armatures, bpy.data.materials, bpy.data.actions,
                   bpy.data.cameras, bpy.data.lights, bpy.data.images, bpy.data.linestyles):
        for b in list(blocks): blocks.remove(b)
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)

def build():
    clear_scene()
    coll = bpy.data.collections.new(MASTER); bpy.context.scene.collection.children.link(coll)
    sc = bpy.context.scene; sc.unit_settings.system = 'METRIC'; sc.unit_settings.scale_length = 1.0

    # --- Shoes, spats, pinstripe legs -------------------------------------------------------
    for side, sx in (('right', 1), ('left', -1)):
        x = 0.135 * sx
        ellipsoid(f'Long pointed shoe {side}', (x, 0.075, 0.064), (0.082, 0.19, 0.064), 'ink')
        toe = cyl(f'Upturned shoe toe {side}', (0, 0, 0), 0.05, 0.012, 0.10, 'ink', bev=0)
        along(toe, (x, 0.20, 0.058), (x, 0.30, 0.10))
        box(f'Brass shoe buckle {side}', (x, 0.155, 0.115), (0.062, 0.02, 0.036), 'brass', rot=(0.5, 0, 0), bev=0.006)
        cyl(f'Cream spat {side}', (x, 0.01, 0.15), 0.078, 0.066, 0.13, 'cream')
        lathe(f'Pinstripe trouser leg {side}', [(0.0, 0.056), (0.20, 0.060), (0.42, 0.068), (0.62, 0.080)],
              stripe_mat(), loc=(x, 0.0, 0.12), n=32)

    # --- Pear-shaped tailcoat, waistcoat, buttons, tails ---------------------------------------
    lathe('Aubergine pear tailcoat body', COAT, 'coat', ey=COAT_EY, n=48)
    ellipsoid('Honey waistcoat front', (0, 0.20, 1.10), (0.165, 0.15, 0.38), 'vest')
    for z in (0.96, 1.08, 1.20, 1.32):
        vy = 0.20 + 0.15 * math.sqrt(max(0, 1 - ((z - 1.10) / 0.38) ** 2))
        ellipsoid(f'Plum waistcoat button {z:.2f}', (0, vy + 0.004, z), (0.022, 0.012, 0.022), 'ink', seg=16, rings=8)
    for side, sx in (('right', 1), ('left', -1)):
        lv = []; lf = []; K = 14
        for k in range(K + 1):
            t = k / K; z = 1.47 - 0.47 * t; xc = (0.085 + 0.10 * t) * sx; hw = 0.052 * (1 - t) + 0.012 * t
            r = interp(COAT, z); yc = COAT_EY * math.sqrt(max(0.0, r * r - xc * xc))
            N = Vector((xc / r ** 2, yc / (COAT_EY * r) ** 2, 0)).normalized(); w = N.cross(Vector((0, 0, 1))).normalized()
            base = Vector((xc, yc, z)) + N * 0.012
            lv += [tuple(base + w * hw), tuple(base - w * hw)]
        for k in range(K): lf.append((2 * k, 2 * k + 2, 2 * k + 3, 2 * k + 1))
        me = bpy.data.meshes.new(f'Dark coat lapel {side}'); me.from_pydata(lv, [], lf); me.update()
        lap = link(f'Dark coat lapel {side}', me, mat('hat'))
        so = lap.modifiers.new('Lapel thickness', 'SOLIDIFY'); so.thickness = 0.016; so.offset = 0
        tail = prism(f'Swallow coat tail {side}', [(-0.085, 0.0), (0.085, 0.0), (0.07, -0.30), (0.0, -0.42), (-0.07, -0.30)],
                     0.06, 'coat', (0.10 * sx, -0.25, 0.70), rot=(0.34, 0.06 * sx, 0), bev=0.014)
        ellipsoid(f'Padded shoulder {side}', (0.205 * sx, 0.0, 1.405), (0.115, 0.105, 0.085), 'coat')
        ellipsoid(f'Brass coat-back button {side}', (0.075 * sx, -0.30, 0.76), (0.02, 0.012, 0.02), 'brass', seg=16, rings=8)

    # --- Raspberry sash (flat ribbon laid on the coat along a tilted plane) with kitten rosette ---
    a = math.radians(48); c = Vector((0, 0, 1.075)); u = Vector((math.cos(a), 0, math.sin(a))); v = Vector((0, 1, 0))
    nrm = u.cross(v).normalized()
    def on_coat(t):
        d = math.cos(t) * u + math.sin(t) * v; lo, hi = 0.0, 0.9
        for _ in range(40):
            mid = (lo + hi) / 2; p = c + mid * d; r = interp(COAT, p.z)
            inside = r > 1e-4 and (p.x / r) ** 2 + (p.y / (COAT_EY * r)) ** 2 < 1
            lo, hi = (mid, hi) if inside else (lo, mid)
        p = c + lo * d; r = max(interp(COAT, p.z), 1e-3)
        N = Vector((p.x / r ** 2, p.y / (COAT_EY * r) ** 2, 0.0)).normalized(); return p, N
    verts = []; faces = []; S = 96
    for i in range(S):
        t = math.tau * i / S; p, N = on_coat(t); w = (nrm - nrm.dot(N) * N).normalized()
        base = p + N * (0.014 + 0.028 * max(0.0, math.sin(t)) ** 2); verts += [tuple(base + w * 0.052), tuple(base - w * 0.052)]
    for i in range(S):
        j = (i + 1) % S; faces.append((2 * i, 2 * j, 2 * j + 1, 2 * i + 1))
    me = bpy.data.meshes.new('Raspberry mayoral sash'); me.from_pydata(verts, [], faces); me.update()
    sash = link('Raspberry mayoral sash', me, mat('sash'))
    so = sash.modifiers.new('Ribbon thickness', 'SOLIDIFY'); so.thickness = 0.014; so.offset = 0
    tr = math.pi / 2 + 0.62; p, N = on_coat(tr)
    ros = empty('Kitten rosette frame', tuple(p + N * (0.024 + 0.028 * math.sin(tr) ** 2)), N.to_track_quat('Z', 'Y').to_euler())
    cyl('Pleated raspberry rosette', (0, 0, 0.0), 0.088, 0.088, 0.022, 'sash', parent=ros, seg=14, bev=0.004)
    cyl('Honey rosette disc', (0, 0, 0.014), 0.064, 0.060, 0.02, 'vest', parent=ros, seg=32, bev=0.004)
    ellipsoid('Cream kitten face on rosette', (0, 0, 0.03), (0.036, 0.032, 0.012), 'cream', parent=ros, seg=24, rings=10)
    for sx in (1, -1):
        cyl(f'Kitten rosette ear {sx:+d}', (0.023 * sx, 0.03, 0.03), 0.014, 0.0, 0.03, 'cream', parent=ros,
            rot=(-math.pi / 2, 0, -0.35 * sx), seg=3, bev=0)
        box(f'Rosette ribbon tail {sx:+d}', (0.03 * sx, -0.115, 0.004), (0.036, 0.10, 0.008), 'sash', rot=(0, 0, 0.18 * sx),
            parent=ros, bev=0.003)

    # --- Neck, collar, bow tie ----------------------------------------------------------------
    cyl('Neck', (0, 0.01, 1.50), 0.066, 0.066, 0.12, 'skin', bev=0)
    cyl('Cream high shirt collar', (0, 0.012, 1.495), 0.122, 0.098, 0.10, 'cream')
    for sx in (1, -1):
        prism(f'Collar point {sx:+d}', [(0.0, 0.0), (0.05 * sx, 0.0), (0.012 * sx, -0.06)], 0.012, 'cream',
              (0.012 * sx, 0.118, 1.49), rot=(-0.2, 0, 0), bev=0.003)
        ellipsoid(f'Teal bow tie wing {sx:+d}', (0.052 * sx, 0.128, 1.462), (0.052, 0.024, 0.034), 'teal', rot=(0, 0.35 * sx, 0))
    ellipsoid('Teal bow tie knot', (0, 0.14, 1.462), (0.024, 0.02, 0.026), 'teal')

    # --- Head: egg face, long rosy nose, smug side-eye, brows, smirk, huge curly mustache --------
    lathe('Egg-shaped head', HEAD, 'skin', loc=(0, HEAD_Y, 0), ey=HEAD_EY, n=48)
    for sx in (1, -1):
        ellipsoid(f'Ear {sx:+d}', (0.188 * sx, 0.0, 1.765), (0.032, 0.05, 0.068), 'skin')
        ex = 0.078 * sx; ez = 1.83; ey_ = head_y(abs(ex), ez) - 0.018
        ellipsoid(f'Eye white {sx:+d}', (ex, ey_, ez), (0.05, 0.034, 0.062), 'white')
        ellipsoid(f'Side-glancing pupil {sx:+d}', (ex + 0.019, ey_ + 0.03, ez - 0.012), (0.021, 0.012, 0.024), 'ink', seg=16, rings=8)
        ellipsoid(f'Smug heavy eyelid {sx:+d}', (ex, ey_ + 0.004, 1.872), (0.056, 0.038, 0.036), 'skin', rot=(0, -0.25 * sx, 0))
    rb = [(0.03, 1.905), (0.08, 1.935), (0.135, 1.915)]
    tube('Raised skeptical brow right', [(x, head_y(x, z, 0.012), z) for x, z in rb], [0.017, 0.019, 0.012], 'stache')
    lb = [(-0.03, 1.895), (-0.08, 1.905), (-0.135, 1.93)]
    tube('Scheming slanted brow left', [(x, head_y(abs(x), z, 0.012), z) for x, z in lb], [0.017, 0.019, 0.012], 'stache')
    nb = head_y(0, 1.765) - 0.03
    tube('Long nose', [(0, nb, 1.768), (0, nb + 0.08, 1.752), (0, nb + 0.15, 1.728)], [0.058, 0.046, 0.036], 'skin')
    ellipsoid('Rosy nose tip', (0, nb + 0.17, 1.722), (0.046, 0.044, 0.042), 'nose')
    mz = [(-0.065, 1.595), (0.0, 1.584), (0.06, 1.592), (0.098, 1.614)]
    tube('Smug smirk', [(x, head_y(abs(x), z, 0.004), z) for x, z in mz], 0.012, 'stache')
    for sx in (1, -1):
        ellipsoid(f'Plum side hair tuft {sx:+d}', (0.158 * sx, -0.075, 1.875), (0.034, 0.075, 0.05), 'stache', rot=(0, 0.3 * sx, 0))
    ellipsoid('Plum back hair tuft', (0.0, -0.162, 1.885), (0.125, 0.035, 0.05), 'stache')
    ellipsoid('Little chin', (0, head_y(0, 1.545) - 0.03, 1.545), (0.07, 0.04, 0.045), 'skin')
    for sx in (1, -1):
        pts = [(0.0, 0.325, 1.672), (0.07, 0.305, 1.662), (0.15, 0.255, 1.655), (0.24, 0.20, 1.672), (0.31, 0.165, 1.715),
               (0.345, 0.15, 1.775), (0.322, 0.148, 1.818), (0.282, 0.148, 1.802), (0.286, 0.15, 1.766)]
        tube(f'Curly handlebar mustache {"right" if sx > 0 else "left"}', [(x * sx, y, z) for x, y, z in pts],
             [0.046, 0.05, 0.045, 0.036, 0.027, 0.021, 0.017, 0.014, 0.011], 'stache', res=6)

    # --- Tall jaunty stovepipe hat with kitten badge ------------------------------------------
    hat = empty('Hat tilt frame', (0.0, -0.005, 1.955), (-0.05, 0.11, 0.0))
    cyl('Hat brim', (0, 0, 0), 0.285, 0.285, 0.028, 'hat', parent=hat, seg=48, scale=(1, 1.06, 1), bev=0.01)
    lathe('Tall stovepipe crown', [(0.0, 0.166), (0.16, 0.168), (0.33, 0.178), (0.47, 0.196), (0.50, 0.190), (0.505, 0.12), (0.508, 0.0)],
          'hat', parent=hat, ey=1.05, n=48)
    lathe('Honey hat band', [(0.014, 0.171), (0.088, 0.1725)], 'vest', parent=hat, ey=1.05, n=48)
    by = 0.1725 * 1.05
    ellipsoid('Cream kitten hat badge', (0, by + 0.004, 0.052), (0.044, 0.014, 0.036), 'cream', parent=hat, seg=24, rings=10)
    for sx in (1, -1):
        cyl(f'Kitten hat badge ear {sx:+d}', (0.026 * sx, by + 0.004, 0.09), 0.015, 0.0, 0.03, 'cream', parent=hat,
            rot=(0, 0.35 * sx, 0), seg=3, bev=0)

    # --- Arms: left fist on hip; right hand holding the remote contraption --------------------
    rs = [(0.23, 0.0, 1.40), (0.36, 0.012, 1.27), (0.45, 0.045, 1.13), (0.505, 0.095, 1.02), (0.545, 0.14, 0.955)]
    tube('Right coat sleeve', rs, [0.078, 0.074, 0.068, 0.064, 0.06], 'coat')
    along(cyl('Right shirt cuff', (0, 0, 0), 0.064, 0.064, 0.045, 'cream'), (0.535, 0.128, 0.97), (0.56, 0.155, 0.935))
    ellipsoid('Right cream glove gripping remote', (0.595, 0.18, 0.895), (0.08, 0.062, 0.064), 'cream')
    ls = [(-0.23, 0.0, 1.40), (-0.38, -0.018, 1.28), (-0.54, -0.03, 1.15), (-0.48, 0.005, 1.04), (-0.41, 0.035, 0.97)]
    tube('Left coat sleeve (fist on hip)', ls, [0.078, 0.074, 0.068, 0.064, 0.06], 'coat')
    along(cyl('Left shirt cuff', (0, 0, 0), 0.064, 0.064, 0.045, 'cream'), (-0.425, 0.03, 0.985), (-0.395, 0.04, 0.955))
    ellipsoid('Left cream glove fist on hip', (-0.385, 0.05, 0.93), (0.062, 0.058, 0.056), 'cream')

    rem = empty('Remote contraption frame', (0.60, 0.18, 0.99), (0.12, 0.0, 0.0)); rem.scale = (1.32, 1.32, 1.32)
    box('Teal remote-control box', (0, 0, 0), (0.125, 0.068, 0.205), 'teal', parent=rem, bev=0.016)
    cyl('Big raspberry button', (0, 0.034, 0.055), 0.03, 0.028, 0.024, 'sash', parent=rem, rot=(-math.pi / 2, 0, 0), bev=0.005)
    for sx in (1, -1):
        cyl(f'Honey dial {sx:+d}', (0.032 * sx, 0.034, 0.0), 0.016, 0.016, 0.016, 'vest', parent=rem, rot=(-math.pi / 2, 0, 0), bev=0.003)
    ellipsoid('Glove thumb on button', (-0.018, 0.05, 0.012), (0.02, 0.018, 0.034), 'cream', parent=rem, rot=(0, 0.3, 0))
    cyl('Brass crank arm', (0.078, 0.0, -0.02), 0.009, 0.009, 0.05, 'brass', parent=rem, rot=(0, math.pi / 2, 0), bev=0)
    cyl('Brass crank handle', (0.103, 0.022, -0.02), 0.012, 0.012, 0.045, 'brass', parent=rem, rot=(-math.pi / 2, 0, 0), bev=0.003)
    coil = []
    for i in range(121):
        t = i / 120; ang = t * math.tau * 9
        coil.append((0.03 + 0.017 * math.cos(ang) + 0.02 * t, 0.017 * math.sin(ang), 0.10 + 0.20 * t))
    cu = bpy.data.curves.new('Spring antenna', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.0055; cu.bevel_resolution = 3
    cu.use_fill_caps = True; sp = cu.splines.new('POLY'); sp.points.add(len(coil) - 1)
    for pt, co in zip(sp.points, coil): pt.co = (*co, 1.0)
    link('Spring antenna', cu, mat('brass'), rem)
    ellipsoid('Honey antenna ball', (0.05, 0.0, 0.335), (0.036, 0.036, 0.036), 'vest', parent=rem)
    cyl('Propeller spindle', (0.05, 0.0, 0.38), 0.006, 0.006, 0.05, 'ink', parent=rem, bev=0)
    ellipsoid('Tiny cream propeller blade A', (0.05, 0.0, 0.402), (0.075, 0.016, 0.006), 'cream', parent=rem, rot=(0, 0.12, 0.35))
    ellipsoid('Tiny cream propeller blade B', (0.05, 0.0, 0.402), (0.075, 0.016, 0.006), 'cream', parent=rem, rot=(0, -0.12, 0.35 + math.pi / 2))

    for ob in PARTS: ob['work_order'] = 'WO111'; ob['asset_id'] = 'rival-mayor'

def measure(objs=None):
    dg = bpy.context.evaluated_depsgraph_get(); lo = [1e9] * 3; hi = [-1e9] * 3; tris = 0
    for ob in (objs or [o for o in bpy.data.collections[MASTER].objects]):
        if ob.type not in ('MESH', 'CURVE'): continue
        ev = ob.evaluated_get(dg); me = ev.to_mesh()
        for vtx in me.vertices:
            w = ev.matrix_world @ vtx.co
            for k in range(3): lo[k] = min(lo[k], w[k]); hi[k] = max(hi[k], w[k])
        me.calc_loop_triangles(); tris += len(me.loop_triangles); ev.to_mesh_clear()
    return {'min': [round(x, 4) for x in lo], 'max': [round(x, 4) for x in hi],
            'size': [round(hi[k] - lo[k], 4) for k in range(3)], 'blockout_triangles': tris}

if __name__ == '__main__':
    sc = bpy.context.scene
    assert sc.get('asset_id') == 'rival-mayor' and sc.get('scene_lease') == 'active'
    build(); bpy.context.view_layer.update()
    m = measure()
    sc['blockout_bounds_m'] = json.dumps(m)
    path = ROOT / 'rival-mayor-blockout.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(path), compress=True)
    rec = {'saved': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bounds_blender_zup': m,
           'parts': len(PARTS), 'materials': sorted(x.name for x in bpy.data.materials),
           'utc': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    (ROOT / 'blockout-measurements.json').write_text(json.dumps(rec, indent=2) + '\n')
    print(json.dumps(rec))
