"""WO111 inator-monster v001: painted flat-colour BLOCKOUT for a Blender reference sheet.

Reference-sheet stage only: primitive/curve forms, no final topology, no rig, no atlas, no GLB.
Blender +Z up, character faces +Y (exports later as glTF +Y up / -Z forward), floor-centred at the origin.
Character right = +X. All dimensions in metres.

Design: World A chapter 3 boss (ages 5-9, merged hero-team / web-hero / backyard-inventor era parody).
A giant goofy rubber-suit kaiju: chunky pear body leaning forward, stumpy baggy-suit legs with ankle
wrinkles, big round feet with cream toe nubs, tiny T-rex arms with mitten hands, a thick tail swept to
its left with a curled-up tip, a big bean head with an ear-to-ear open grin, two buck teeth and a pink
tongue, two mismatched googly eyes glued on top, two staggered rows of toy-coloured back plates, and a
costume zipper with a dangling pull tab down the spine. Strapped to its shoulders: a violet bubble
cockpit whose glass dome holds a small cartoon evil scientist (wild side-tufts, big goggles, lab coat,
purple gloves) pointing forward and holding up a chunky "-inator" remote whose zig-zag antenna pokes
out through a port in the top of the dome.
"""
import bpy, bmesh, math, json, hashlib, datetime
from mathutils import Vector, Matrix, Euler
from pathlib import Path

ROOT = Path('/workspace/haynes-quest/family-eras/inator-monster/v001')
MASTER = 'Inator monster blockout (master)'
CUTTERS = 'Blockout cutters (hidden, applied)'

PAL = {
    'suit': '#72a95c', 'suit_dark': '#4f7f48', 'belly': '#f0d58c', 'belly_line': '#d9b466',
    'plate_orange': '#f08a3c', 'plate_yellow': '#f4c542', 'plate_pink': '#ef7fa8', 'plate_blue': '#5eaee0',
    'claw': '#f3e6cf', 'eye': '#fbf8f2', 'eye_rim': '#c9d3d8', 'ink': '#2b2238', 'mouth': '#9c3a52',
    'tongue': '#ef8a9a', 'tooth': '#fbf6ec', 'blush': '#f2a08f', 'zip_tape': '#3a3548', 'zip_metal': '#c9ccd3',
    'cockpit': '#6b5b95', 'strap': '#3a3548', 'brass': '#c9923e', 'bulb_red': '#e0524f', 'bulb_green': '#7cc26b',
    'coat': '#eef0ec', 'coat_shadow': '#cfd8d4', 'skin': '#f2cfae', 'nose': '#e8a08c', 'hair': '#dcd6ee',
    'glove': '#7b5ea7', 'lens': '#a9d8ea', 'remote': '#4b4f63', 'button': '#e0524f', 'antenna': '#f4c542',
    'ball': '#ef7fa8', 'teal': '#3f9d9a', 'glass': '#bfe6f0',
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
    m = bpy.data.materials.new('IM ' + key + ' ' + PAL[key]); m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = lin(PAL[key]); bs.inputs['Roughness'].default_value = 0.92
    bs.inputs['Specular IOR Level'].default_value = 0.12
    m.diffuse_color = lin(PAL[key]); m['palette_hex'] = PAL[key]
    MATS[key] = m; return m

def glass_mat():
    """Bubble-cockpit glass: mostly clear, tinted toward the rim, with a painted window glint fixed to the sheet camera (-Y)."""
    if 'glass' in MATS: return MATS['glass']
    m = bpy.data.materials.new('IM bubble glass ' + PAL['glass']); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial'); tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    tint = nt.nodes.new('ShaderNodeBsdfPrincipled'); tint.inputs['Base Color'].default_value = lin(PAL['glass'])
    tint.inputs['Roughness'].default_value = 0.25; tint.inputs['Specular IOR Level'].default_value = 0.3
    lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.45
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['To Min'].default_value = 0.08; mr.inputs['To Max'].default_value = 0.52
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(lw.outputs['Facing'], mr.inputs['Value']); nt.links.new(mr.outputs['Result'], mix.inputs['Fac'])
    nt.links.new(tr.outputs[0], mix.inputs[1]); nt.links.new(tint.outputs[0], mix.inputs[2])
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    def dotn(v):
        d = nt.nodes.new('ShaderNodeVectorMath'); d.operation = 'DOT_PRODUCT'; d.inputs[1].default_value = Vector(v).normalized()
        nt.links.new(geo.outputs['Normal'], d.inputs[0]); return d.outputs['Value']
    def cmp(val, op, t):
        n = nt.nodes.new('ShaderNodeMath'); n.operation = op; nt.links.new(val, n.inputs[0]); n.inputs[1].default_value = t; return n.outputs[0]
    def mul(a, b):
        n = nt.nodes.new('ShaderNodeMath'); n.operation = 'MULTIPLY'; nt.links.new(a, n.inputs[0]); nt.links.new(b, n.inputs[1]); return n.outputs[0]
    def add(a, b):
        n = nt.nodes.new('ShaderNodeMath'); n.operation = 'MAXIMUM'; nt.links.new(a, n.inputs[0]); nt.links.new(b, n.inputs[1]); return n.outputs[0]
    d1 = dotn((-0.45, -0.75, 0.50)); d2 = dotn((-0.85, -0.25, 0.45))
    spot = cmp(d1, 'GREATER_THAN', 0.9955)
    arc = mul(mul(cmp(d1, 'GREATER_THAN', 0.936), cmp(d1, 'LESS_THAN', 0.949)), cmp(d2, 'GREATER_THAN', 0.80))
    glint = add(spot, arc)
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Color'].default_value = lin('#fbfdff'); em.inputs['Strength'].default_value = 1.0
    mix2 = nt.nodes.new('ShaderNodeMixShader'); nt.links.new(glint, mix2.inputs['Fac'])
    nt.links.new(mix.outputs[0], mix2.inputs[1]); nt.links.new(em.outputs[0], mix2.inputs[2]); nt.links.new(mix2.outputs[0], out.inputs['Surface'])
    m.diffuse_color = (*lin(PAL['glass'])[:3], 0.3); m['palette_hex'] = PAL['glass']
    MATS['glass'] = m; return m

PARTS = []
def link(name, data, m, parent=None, smooth=True, dome=False):
    ob = bpy.data.objects.new(name, data); bpy.data.collections[MASTER].objects.link(ob)
    if m is not None:
        data.materials.append(m)
    if smooth and hasattr(data, 'polygons'):
        for p in data.polygons: p.use_smooth = True
    if parent is not None: ob.parent = parent
    ob['blockout_part'] = name; ob['in_dome'] = bool(dome); PARTS.append(ob); return ob

def empty(name, loc=(0, 0, 0), rot=(0, 0, 0), parent=None):
    ob = bpy.data.objects.new(name, None); bpy.data.collections[MASTER].objects.link(ob)
    ob.location = loc; ob.rotation_euler = rot; ob.empty_display_size = 0.1
    if parent is not None: ob.parent = parent
    return ob

def bevel(ob, w, seg=2):
    md = ob.modifiers.new('Soft painted edge', 'BEVEL'); md.width = w; md.segments = seg; md.limit_method = 'ANGLE'
    return ob

def M(key):
    return mat(key) if isinstance(key, str) else key

def ellipsoid(name, loc, s, key, rot=(0, 0, 0), parent=None, seg=32, rings=16, dome=False):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0); bm.to_mesh(me); bm.free()
    ob = link(name, me, M(key), parent, dome=dome)
    ob.location = loc; ob.scale = s; ob.rotation_euler = rot; return ob

def cyl(name, loc, r1, r2, depth, key, rot=(0, 0, 0), parent=None, seg=32, scale=(1, 1, 1), bev=0.006, dome=False):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r1, radius2=r2, depth=depth)
    bm.to_mesh(me); bm.free()
    ob = link(name, me, M(key), parent, dome=dome); ob.location = loc; ob.rotation_euler = rot; ob.scale = scale
    if bev: bevel(ob, bev)
    return ob

def box(name, loc, s, key, rot=(0, 0, 0), parent=None, bev=0.012, dome=False):
    me = bpy.data.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bm.to_mesh(me); bm.free()
    for v in me.vertices: v.co = Vector((v.co.x * s[0], v.co.y * s[1], v.co.z * s[2]))
    ob = link(name, me, M(key), parent, smooth=False, dome=dome); ob.location = loc; ob.rotation_euler = rot
    if bev: bevel(ob, bev, 3)
    for p in me.polygons: p.use_smooth = True
    wn = ob.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL'); wn.keep_sharp = True
    return ob

def lathe(name, profile, key, loc=(0, 0, 0), ey=1.0, n=40, parent=None, cap_bottom=True, cap_top=True, rot=(0, 0, 0), dome=False):
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
    ob = link(name, me, M(key), parent, dome=dome); ob.location = loc; ob.rotation_euler = rot
    return ob

def tube(name, pts, radii, key, parent=None, res=4, bres=6, dome=False, kind='NURBS'):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 1.0; cu.bevel_resolution = bres
    cu.use_fill_caps = True; cu.resolution_u = res
    sp = cu.splines.new(kind); sp.points.add(len(pts) - 1)
    if kind == 'NURBS': sp.order_u = min(4, len(pts)); sp.use_endpoint_u = True
    rr = radii if isinstance(radii, (list, tuple)) else [radii] * len(pts)
    for p, (x, y, z), r in zip(sp.points, pts, rr): p.co = (x, y, z, 1.0); p.radius = r
    ob = link(name, cu, M(key), parent, dome=dome); return ob

def ring(name, loc, R, r, key, rot=(0, 0, 0), parent=None, ey=1.0, dome=False, n=48):
    pts = [(R * math.cos(math.tau * i / n), R * ey * math.sin(math.tau * i / n), 0.0) for i in range(n)]
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = r; cu.bevel_resolution = 4
    sp = cu.splines.new('POLY'); sp.points.add(n - 1); sp.use_cyclic_u = True
    for p, co in zip(sp.points, pts): p.co = (*co, 1.0)
    ob = link(name, cu, M(key), parent, dome=dome); ob.location = loc; ob.rotation_euler = rot; return ob

def prism(name, outline_xz, depth, key, loc=(0, 0, 0), rot=(0, 0, 0), parent=None, bev=0.01, dome=False):
    n = len(outline_xz)
    verts = [(x, y, z) for y in (-depth / 2, depth / 2) for x, z in outline_xz]
    faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))] + [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    ob = link(name, me, M(key), parent, smooth=False, dome=dome); ob.location = loc; ob.rotation_euler = rot
    if bev: bevel(ob, bev, 2)
    return ob

def ribbon(name, centers, normals, sides, half_w, thick, key, parent=None, dome=False):
    """A flat strip through centre points; width along `sides`, lifted along `normals`, solidified."""
    verts = []; faces = []
    for c, s in zip(centers, sides):
        verts += [tuple(c + s * half_w), tuple(c - s * half_w)]
    for k in range(len(centers) - 1): faces.append((2 * k, 2 * k + 2, 2 * k + 3, 2 * k + 1))
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    ob = link(name, me, M(key), parent, dome=dome)
    so = ob.modifiers.new('Strip thickness', 'SOLIDIFY'); so.thickness = thick; so.offset = 0
    return ob

def along(ob, a, b):
    a = Vector(a); b = Vector(b); ob.location = (a + b) / 2
    ob.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler(); return ob

def frame_matrix(T, N):
    """Columns X=T, Y=N x T, Z=N (orthonormalised)."""
    T = T.normalized(); N = (N - N.dot(T) * T).normalized(); B = N.cross(T)
    return Matrix((T, B, N)).transposed()

def interp(profile, z):
    if z <= profile[0][0]: return profile[0][1]
    for (z0, r0), (z1, r1) in zip(profile, profile[1:]):
        if z0 <= z <= z1: return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return 0.0

def catmull(pts, radii, per=10):
    P = [Vector(p) for p in pts]; out = []; rr = []
    for i in range(len(P) - 1):
        p0 = P[max(i - 1, 0)]; p1 = P[i]; p2 = P[i + 1]; p3 = P[min(i + 2, len(P) - 1)]
        for k in range(per):
            t = k / per; t2 = t * t; t3 = t2 * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
            rr.append(radii[i] + (radii[i + 1] - radii[i]) * t)
    out.append(P[-1]); rr.append(radii[-1]); return out, rr

def apply_mods(ob):
    dg = bpy.context.evaluated_depsgraph_get(); ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    old = ob.data; ob.modifiers.clear(); ob.data = me
    if old.users == 0: bpy.data.meshes.remove(old)
    return ob

def plate_outline(w, h, lean=0.18, pinch=0.42, n=18):
    pts = [(0.5 * w, -0.10 * h)]
    for k in range(n + 1):
        th = math.pi * k / n
        u = 0.5 * w * math.cos(th) * (1 - pinch * math.sin(th)); v = h * math.sin(th)
        pts.append((u + lean * w * (v / h) ** 2, v))
    pts.append((-0.5 * w, -0.10 * h))
    out = []
    for p in pts:
        if not out or (Vector(p) - Vector(out[-1])).length > 1e-5: out.append(p)
    return out

# --------------------------------------------------------------------------------------------------------------
TORSO_LOC = Vector((0.0, 0.05, 0.60)); TORSO_ROT = Euler((-0.15, 0.0, 0.0))
TORSO_M = Matrix.Translation(TORSO_LOC) @ TORSO_ROT.to_matrix().to_4x4()
TORSO = [(0.00, 0.30), (0.06, 0.47), (0.18, 0.61), (0.40, 0.70), (0.64, 0.71), (0.88, 0.66), (1.08, 0.58),
         (1.26, 0.48), (1.40, 0.38), (1.50, 0.27), (1.56, 0.12), (1.58, 0.0)]
TORSO_EY = 0.86
def tsurf(x, z, side=1, off=0.0):
    """Torso surface point (frame-local) at local x, z on the front (side=+1) or back (side=-1), lifted by off."""
    r = interp(TORSO, z); y = side * TORSO_EY * math.sqrt(max(0.0, r * r - x * x))
    n = Vector((x / r ** 2, y / (TORSO_EY * r) ** 2, 0.0)).normalized()
    return Vector((x, y, z)) + n * off, n
def tw(v):
    return TORSO_M @ Vector(v)
def tn(v):
    return (TORSO_ROT.to_matrix() @ Vector(v)).normalized()

BELLY_C = Vector((0.0, 0.45, 0.62)); BELLY_S = Vector((0.46, 0.21, 0.56))

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
    cut = bpy.data.collections.new(CUTTERS); bpy.context.scene.collection.children.link(cut); cut.hide_render = True
    sc = bpy.context.scene; sc.unit_settings.system = 'METRIC'; sc.unit_settings.scale_length = 1.0

    # --- Feet, toe nubs, stumpy baggy-suit legs with ankle wrinkles --------------------------------------------------
    for side, sx in (('right', 1), ('left', -1)):
        x = 0.40 * sx
        ellipsoid(f'Big round foot {side}', (x, 0.14, 0.135), (0.235, 0.33, 0.135), 'suit')
        for k, dx in enumerate((-0.12, 0.0, 0.12)):
            ellipsoid(f'Cream toe nub {side} {k}', (x + dx * 1.0, 0.44 - abs(dx) * 0.35, 0.075), (0.062, 0.07, 0.058), 'claw', seg=20, rings=10)
        lathe(f'Stumpy suit leg {side}', [(0.0, 0.205), (0.12, 0.215), (0.20, 0.205), (0.28, 0.235), (0.46, 0.262), (0.66, 0.28), (0.80, 0.27)],
              'suit', loc=(x, 0.06, 0.16), n=36)
        ring(f'Baggy ankle wrinkle {side} low', (x, 0.06, 0.29), 0.212, 0.022, 'suit_dark')
        ring(f'Baggy ankle wrinkle {side} high', (x, 0.06, 0.39), 0.232, 0.02, 'suit_dark')

    # --- Pear torso leaning forward, butter belly with scute lines --------------------------------------------------
    lathe('Pear kaiju torso', TORSO, 'suit', loc=TORSO_LOC, rot=TORSO_ROT, ey=TORSO_EY, n=56)
    belly = ellipsoid('Butter belly patch', tw(BELLY_C), BELLY_S, 'belly', rot=TORSO_ROT, seg=40, rings=20)
    for k, z in enumerate((0.26, 0.42, 0.58, 0.74, 0.90)):
        dz = (z - BELLY_C.z) / BELLY_S.z; half = BELLY_S.x * math.sqrt(max(0.0, 1 - dz * dz)) * 0.80; pts = []
        for i in range(9):
            x = -half + 2 * half * i / 8; q = 1 - (x / BELLY_S.x) ** 2 - dz * dz
            y = BELLY_C.y + BELLY_S.y * math.sqrt(max(0.0, q)) + 0.004
            pts.append(tuple(tw((x, y, z))))
        tube(f'Belly scute line {k}', pts, 0.011, 'belly_line')

    # --- Chest harness belt with brass buckle -----------------------------------------------------------------------
    zb = 1.16; cen = []; nor = []; sid = []; S = 72
    for i in range(S + 1):
        a = math.tau * i / S; r = interp(TORSO, zb); p = Vector((r * math.cos(a), r * TORSO_EY * math.sin(a), zb))
        n = Vector((p.x / r ** 2, p.y / (TORSO_EY * r) ** 2, 0)).normalized()
        cen.append(tw(p + n * 0.012)); nor.append(tn(n)); sid.append(tn(Vector((0, 0, 1))))
    ribbon('Cockpit harness belt', cen, nor, sid, 0.05, 0.022, 'strap')
    p, n = tsurf(0.0, zb, 1, 0.03)
    bk = box('Brass harness buckle', tw(p), (0.13, 0.03, 0.10), 'brass', bev=0.01)
    bk.rotation_euler = (TORSO_ROT.to_matrix() @ frame_matrix(Vector((1, 0, 0)), n) @ Matrix.Rotation(-math.pi / 2, 3, 'X')).to_euler()

    # --- Tiny T-rex arms with mitten hands ---------------------------------------------------------------------------
    for side, sx in (('right', 1), ('left', -1)):
        sh, _ = tsurf(0.40 * sx, 0.98, 1, -0.05)
        el = Vector((0.50 * sx, sh.y + 0.14, 0.86)); ha = Vector((0.40 * sx, sh.y + 0.28, 0.90))
        tube(f'Tiny arm {side}', [tuple(tw(sh)), tuple(tw(el)), tuple(tw(ha))], [0.092, 0.078, 0.068], 'suit')
        ring(f'Suit wrist wrinkle {side}', (0, 0, 0), 0.07, 0.014, 'suit_dark')
        wr = bpy.data.objects[f'Suit wrist wrinkle {side}']; along(wr, tw(el + (ha - el) * 0.62), tw(ha + (ha - el) * 0.3))
        hd = tw(ha + (ha - el).normalized() * 0.06)
        ellipsoid(f'Mitten hand {side}', hd, (0.075, 0.085, 0.07), 'suit', rot=(0.5, 0, 0.3 * sx))
        for k, dx in enumerate((-0.04, 0.0, 0.04)):
            ellipsoid(f'Mitten claw nub {side} {k}', hd + Vector((dx * sx + 0.01 * sx, 0.075, -0.035 + abs(dx) * 0.2)), (0.024, 0.03, 0.022), 'claw', seg=16, rings=8)

    # --- Thick tail swept to its left with a curled-up tip ----------------------------------------------------------
    TAIL = [(0.0, -0.20, 0.95), (-0.02, -0.72, 0.66), (-0.10, -1.14, 0.36), (-0.28, -1.48, 0.17), (-0.52, -1.70, 0.12),
            (-0.74, -1.80, 0.16), (-0.88, -1.84, 0.30), (-0.90, -1.80, 0.44)]
    TAIL_R = [0.36, 0.30, 0.22, 0.16, 0.12, 0.095, 0.075, 0.06]
    tpts, trad = catmull(TAIL, TAIL_R, per=10)
    tube('Thick swept kaiju tail', [tuple(p) for p in tpts], trad, 'suit', res=1, kind='POLY')

    # --- Zipper down the spine with a dangling pull tab -------------------------------------------------------------
    zs = [0.36 + (1.16 - 0.36) * i / 28 for i in range(29)]
    cen = []; nor = []; sid = []
    for z in zs:
        p, n = tsurf(0.0, z, -1, 0.006); cen.append(tw(p)); nor.append(tn(n)); sid.append(tn(Vector((1, 0, 0))))
    ribbon('Costume zipper tape', cen, nor, sid, 0.034, 0.012, 'zip_tape')
    for i, z in enumerate([0.38 + 0.03 * k for k in range(24)]):
        dx = 0.013 if i % 2 else -0.013; p, n = tsurf(dx, z, -1, 0.016)
        tooth = box(f'Zipper tooth {i}', tw(p), (0.024, 0.012, 0.013), 'zip_metal', bev=0.003)
        tooth.rotation_euler = (TORSO_ROT.to_matrix() @ frame_matrix(Vector((1, 0, 0)), n) @ Matrix.Rotation(math.pi / 2, 3, 'X')).to_euler()
    p, n = tsurf(0.0, 1.13, -1, 0.024)
    sl = box('Zipper slider', tw(p), (0.05, 0.03, 0.07), 'zip_metal', bev=0.008)
    sl.rotation_euler = (TORSO_ROT.to_matrix() @ frame_matrix(Vector((1, 0, 0)), n) @ Matrix.Rotation(math.pi / 2, 3, 'X')).to_euler()
    tab_top = tw(p + n * 0.02); tab_dir = (tn(-n) * 0.25 + Vector((0, -0.25, -1))).normalized()
    tab = prism('Dangling zipper pull tab', [(-0.032, 0.0), (0.032, 0.0), (0.05, -0.17), (0.0, -0.21), (-0.05, -0.17)], 0.016, 'zip_metal',
                bev=0.007)
    tab.location = tab_top; tab.rotation_euler = frame_matrix(Vector((1, 0, 0)), -tab_dir).to_euler()

    # --- Two staggered rows of toy-coloured back plates (torso, then tail) ------------------------------------------
    cycle = ['plate_orange', 'plate_yellow', 'plate_pink', 'plate_blue']; k = 0
    for i, (z, h) in enumerate([(1.40, 0.44), (1.28, 0.48), (1.12, 0.44), (0.96, 0.42), (0.80, 0.38), (0.64, 0.33), (0.48, 0.28), (0.32, 0.24)]):
        sx = 1 if i % 2 == 0 else -1; x = 0.12 * sx
        p, n = tsurf(x, z, -1, -0.03)
        z2 = z - 0.02; p2, _ = tsurf(x, z2, -1, -0.03); T = tn(p2 - p)
        N = tn(n); N = (N + Vector((0, 0, 0.55)) + Vector((sx * (0.62 if i < 2 else 0.35), 0, 0))).normalized()
        pl = prism(f'Toy back plate {k:02d} {cycle[k % 4].split("_")[1]}', plate_outline(0.34 * h / 0.42 + 0.06, h), 0.07, cycle[k % 4], bev=0.02)
        pl.location = tw(p); pl.rotation_euler = frame_matrix(T, N).to_euler(); k += 1
    for j, (idx, h) in enumerate([(8, 0.22), (17, 0.19), (26, 0.16), (35, 0.13), (44, 0.10), (52, 0.08)]):
        c = tpts[idx]; T = (tpts[idx + 1] - tpts[idx - 1]).normalized(); up = Vector((0, 0, 1)); N = (up - up.dot(T) * T).normalized()
        B = N.cross(T); sx = 1 if j % 2 == 0 else -1
        N2 = (N + B * 0.42 * sx).normalized(); base = c + N2 * (trad[idx] * 0.78)
        pl = prism(f'Toy back plate {k:02d} {cycle[k % 4].split("_")[1]}', plate_outline(0.30 * h / 0.3 + 0.05, h), 0.06, cycle[k % 4], bev=0.016)
        pl.location = base; pl.rotation_euler = frame_matrix(T, N2).to_euler(); k += 1

    # --- Head: bean cranium, snout with an ear-to-ear open grin, jaw, tongue, buck teeth, googly eyes ---------------
    head = empty('Head tilt frame', (0.0, 0.60, 1.98), (0.10, 0.10, 0.0))
    ellipsoid('Monster cranium', (0, 0.0, 0.10), (0.39, 0.40, 0.30), 'suit', parent=head, seg=40, rings=20)
    snout = ellipsoid('Monster snout', (0, 0.34, 0.02), (0.33, 0.32, 0.21), 'suit', parent=head, seg=48, rings=24)
    jaw = ellipsoid('Monster lower jaw', (0, 0.28, -0.14), (0.30, 0.30, 0.13), 'suit', parent=head, seg=40, rings=20)
    ellipsoid('Butter chin', (0, 0.25, -0.212), (0.25, 0.26, 0.066), 'belly', parent=head, seg=32, rings=12)
    # grin cavity: a flat-topped bowl cut into snout+jaw, baked into the meshes (cutter kept hidden for the record)
    cutter_me = bpy.data.meshes.new('Grin cutter'); bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=1.0)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z > 0.02], context='VERTS')
    bmesh.ops.contextual_create(bm, geom=[e for e in bm.edges if e.is_boundary])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(cutter_me); bm.free()
    cutter = bpy.data.objects.new('Grin cutter (bowl)', cutter_me); cut.objects.link(cutter); cutter.parent = head
    cutter.display_type = 'WIRE'; cutter.hide_render = True
    cutter.location = (0, 0.46, -0.035); cutter.scale = (0.25, 0.26, 0.13); cutter_me.materials.append(mat('mouth'))
    bpy.context.view_layer.update()
    for ob in (snout, jaw):
        md = ob.modifiers.new('Grin cavity', 'BOOLEAN'); md.operation = 'DIFFERENCE'; md.solver = 'EXACT'; md.object = cutter
        md.material_mode = 'TRANSFER'
        bpy.context.view_layer.update(); apply_mods(ob)
    ellipsoid('Pink tongue', (0.07, 0.47, -0.125), (0.10, 0.12, 0.04), 'tongue', parent=head, rot=(0.15, 0.0, -0.35))
    for sx in (1, -1):
        box(f'Buck tooth {sx:+d}', (0.042 * sx, 0.64, -0.055), (0.07, 0.03, 0.075), 'tooth', parent=head, rot=(0.25, 0, 0), bev=0.014)
        ellipsoid(f'Nostril {sx:+d}', (0.085 * sx, 0.60, 0.16), (0.03, 0.02, 0.018), 'ink', parent=head, rot=(0.7, 0, 0), seg=16, rings=8)
        ellipsoid(f'Cheek blush {sx:+d}', (0.235 * sx, 0.40, 0.00), (0.07, 0.05, 0.045), 'blush', parent=head, rot=(0, 0, 0.9 * sx))
    # googly eyes glued high on the cranium, pupils mismatched
    for sx, pupil in ((1, (-0.35, -0.45)), (-1, (0.40, 0.42))):
        d = Vector((0.52 * sx, 0.58, 0.66)).normalized(); c = Vector((0, 0.0, 0.10)); s = Vector((0.39, 0.40, 0.30))
        t = 1 / math.sqrt(sum((d[i] / s[i]) ** 2 for i in range(3))); p = c + d * t
        nrm = Vector((p.x / s.x ** 2, (p.y - c.y) / s.y ** 2, (p.z - c.z) / s.z ** 2)).normalized()
        nrm = (nrm + Vector((0, 0.5, 0))).normalized()
        fr = empty(f'Googly eye frame {sx:+d}', tuple(p + nrm * 0.02), nrm.to_track_quat('Z', 'Y').to_euler(), parent=head)
        ellipsoid(f'Googly eye white {sx:+d}', (0, 0, 0.0), (0.165, 0.165, 0.07), 'eye', parent=fr, seg=40, rings=16)
        ring(f'Googly eye plastic rim {sx:+d}', (0, 0, 0.012), 0.162, 0.012, 'eye_rim', parent=fr)
        ellipsoid(f'Googly pupil {sx:+d}', (pupil[0] * 0.165 * sx, pupil[1] * 0.165, 0.058), (0.072, 0.072, 0.022), 'ink', parent=fr, seg=24, rings=10)

    # --- Bubble cockpit strapped to the shoulders -------------------------------------------------------------------
    ck = empty('Cockpit frame', (0.0, -0.12, 2.34), (0.0, 0.0, 0.0))
    lathe('Violet cockpit tub', [(-0.34, 0.20), (-0.30, 0.33), (-0.18, 0.42), (-0.05, 0.455), (0.0, 0.455)], 'cockpit', parent=ck, n=48)
    ring('Brass cockpit rim', (0, 0, 0.0), 0.458, 0.028, 'brass', parent=ck)
    for k, (da, key) in enumerate(((0.28, 'bulb_red'), (0.0, 'plate_yellow'), (-0.28, 'bulb_green'))):
        for sx, base in ((1, 0.0), (-1, math.pi)):
            a = base + sx * da
            ellipsoid(f'Cockpit light {k} {sx:+d}', (0.445 * math.cos(a), 0.445 * math.sin(a), -0.12), (0.035, 0.035, 0.035), key, parent=ck, seg=16, rings=8)
    for k in range(8):
        a = math.tau * (k + 0.5) / 8
        ellipsoid(f'Brass rivet {k}', (0.448 * math.cos(a), 0.448 * math.sin(a), -0.035), (0.018, 0.018, 0.018), 'brass', parent=ck, seg=12, rings=6)
    R = 0.48; hole = 0.052; prof = []
    for i in range(33):
        a = (math.pi / 2) * i / 32; prof.append((R * math.sin(a), R * math.cos(a)))
    dome = lathe('Bubble cockpit dome', prof, glass_mat(), parent=ck, n=96, cap_bottom=False, cap_top=False)
    PORT_D = Vector((0.40, 0.13, 0.91)).normalized(); PORT = PORT_D * R
    pc_me = bpy.data.meshes.new('Port cutter'); bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=48, radius1=hole, radius2=hole, depth=0.3); bm.to_mesh(pc_me); bm.free()
    pcut = bpy.data.objects.new('Antenna port cutter (cylinder)', pc_me); cut.objects.link(pcut); pcut.parent = ck
    pcut.display_type = 'WIRE'; pcut.hide_render = True; pcut.location = PORT; pcut.rotation_euler = Vector((0, 0, 1)).to_track_quat('Z', 'Y').to_euler()
    bpy.context.view_layer.update()
    md = dome.modifiers.new('Antenna port hole', 'BOOLEAN'); md.operation = 'DIFFERENCE'; md.solver = 'EXACT'; md.object = pcut
    md.use_hole_tolerant = True; bpy.context.view_layer.update(); apply_mods(dome)
    # the hole-tolerant solver also keeps the cutter wall inside the open dome; keep only faces on the sphere
    bm = bmesh.new(); bm.from_mesh(dome.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().length < R - 0.003], context='FACES')
    bm.to_mesh(dome.data); bm.free()
    port_ring = ring('Brass antenna port', tuple(PORT + PORT_D * 0.004), hole + 0.006, 0.013, 'brass', parent=ck)
    port_ring.rotation_euler = Vector((0, 0, 1)).lerp(PORT_D, 0.6).normalized().to_track_quat('Z', 'Y').to_euler()

    # --- The cartoon evil scientist inside the dome (original: wild side tufts, big goggles, lab coat) --------------
    D = dict(parent=ck, dome=True)
    bx = -0.06
    lathe('Scientist lab coat body', [(-0.02, 0.15), (0.08, 0.155), (0.15, 0.14), (0.20, 0.11), (0.235, 0.05), (0.24, 0.0)], 'coat',
          loc=(bx, 0.0, 0.0), ey=0.82, n=32, **D)
    cyl('Mint high collar', (bx, 0.0, 0.225), 0.075, 0.068, 0.05, 'teal', **D)
    for k, key in enumerate(('bulb_red', 'plate_blue', 'plate_yellow')):
        cyl(f'Pocket pen {k}', (bx - 0.055 + 0.016 * k, 0.118, 0.12), 0.007, 0.007, 0.06, key, bev=0, **D)
    box('Lab coat pocket', (bx - 0.04, 0.122, 0.095), (0.07, 0.01, 0.055), 'coat_shadow', bev=0.004, **D)
    hx, hy, hz = -0.075, 0.03, 0.315
    ellipsoid('Scientist round head', (hx, hy, hz), (0.105, 0.10, 0.11), 'skin', **D)
    ellipsoid('Scientist bald crown', (hx, hy - 0.01, hz + 0.04), (0.099, 0.094, 0.082), 'skin', **D)
    for sx in (1, -1):
        ellipsoid(f'Scientist ear {sx:+d}', (hx + 0.103 * sx, hy - 0.005, hz - 0.01), (0.018, 0.026, 0.03), 'skin', seg=16, rings=8, **D)
    ellipsoid('Scientist round nose', (hx + 0.004, hy + 0.107, hz - 0.03), (0.025, 0.022, 0.022), 'nose', seg=16, rings=8, **D)
    ring('Goggle strap', (hx, hy, hz + 0.018), 0.106, 0.011, 'strap', ey=0.96, **D)
    for sx in (1, -1):
        gx = hx + 0.043 * sx; gy = hy + 0.086; gz = hz + 0.02
        fr = empty(f'Goggle frame {sx:+d}', (gx, gy, gz), (-math.pi / 2 + 0.08, 0.0, -sx * 0.30), parent=ck)
        cyl(f'Goggle lens {sx:+d}', (0, 0, 0), 0.040, 0.040, 0.03, 'lens', parent=fr, bev=0.004, dome=True)
        ring(f'Goggle brass rim {sx:+d}', (0, 0, 0.016), 0.041, 0.009, 'brass', parent=fr, dome=True)
        ellipsoid(f'Gleeful pupil {sx:+d}', (0.014, -0.014, 0.017), (0.013, 0.013, 0.005), 'ink', parent=fr, seg=12, rings=6, dome=True)
        # scheming brows: short slanted tufts above the goggles, inner ends low
        tube(f'Scheming brow {sx:+d}', [(hx + 0.018 * sx, hy + 0.098, hz + 0.066), (hx + 0.05 * sx, hy + 0.092, hz + 0.08), (hx + 0.082 * sx, hy + 0.074, hz + 0.092)],
             [0.011, 0.012, 0.009], 'hair', **D)
    gcut = bpy.data.objects.new('Scientist grin cutter (bowl)', cutter_me.copy()); cut.objects.link(gcut); gcut.parent = ck
    gcut.display_type = 'WIRE'; gcut.hide_render = True; gcut.location = (hx, hy + 0.099, hz - 0.047); gcut.scale = (0.052, 0.042, 0.034)
    shead = bpy.data.objects['Scientist round head']; bpy.context.view_layer.update()
    md = shead.modifiers.new('Grin cavity', 'BOOLEAN'); md.operation = 'DIFFERENCE'; md.solver = 'EXACT'; md.object = gcut; md.material_mode = 'TRANSFER'
    bpy.context.view_layer.update(); apply_mods(shead)
    box('Scientist top teeth', (hx, hy + 0.083, hz - 0.054), (0.058, 0.012, 0.013), 'tooth', bev=0.003, **D)
    # wild side-and-back frizz: pointed tufts only below the crown line (no lobes on top of the head)
    frizz = [(0.0, 0.00, 0.085), (-0.35, 0.025, 0.08), (0.35, -0.02, 0.075), (-0.75, -0.01, 0.07), (0.7, 0.03, 0.065)]
    k = 0
    for sx in (1, -1):
        for yaw, dz, ln in frizz:
            d = Vector((sx * math.cos(yaw * 0.9), -abs(math.sin(yaw * 0.9)) * (1 if yaw < 0 else 0.4) + 0.05, dz * 3)).normalized()
            base = Vector((hx, hy - 0.015, hz + 0.01 + dz)) + Vector((d.x, d.y, 0)).normalized() * 0.075
            c = cyl(f'Wild hair spike {k}', (0, 0, 0), 0.03, 0.006, ln, 'hair', bev=0.004, seg=12, **D)
            along(c, tuple(base), tuple(base + d * ln)); k += 1
    for j, (dx, dz) in enumerate(((-0.04, 0.0), (0.04, 0.0), (0.0, -0.035))):
        base = Vector((hx + dx, hy - 0.085, hz + 0.02 + dz)); d = Vector((dx * 4, -1, -0.15)).normalized()
        c = cyl(f'Wild hair spike back {j}', (0, 0, 0), 0.03, 0.006, 0.07, 'hair', bev=0.004, seg=12, **D)
        along(c, tuple(base), tuple(base + d * 0.07))
    # right arm raised up-right holding the -inator remote under the port; left arm pointing forward
    REM_LOC = Vector((PORT.x - 0.005, PORT.y - 0.005, 0.315)); REM_ROT = Euler((0.0, 0.0, 0.30))
    grip = REM_LOC + Vector((0.0, 0.0, -0.07))
    tube('Scientist raised coat sleeve', [(bx + 0.09, 0.0, 0.17), (bx + 0.22, 0.04, 0.19), tuple(grip + Vector((0.0, 0.0, -0.03)))], [0.035, 0.032, 0.03], 'coat', **D)
    ellipsoid('Purple glove holding remote', tuple(grip), (0.034, 0.031, 0.036), 'glove', seg=16, rings=8, **D)
    tube('Scientist pointing coat sleeve', [(bx - 0.09, 0.0, 0.17), (bx - 0.15, 0.12, 0.16), (bx - 0.125, 0.245, 0.205)], [0.035, 0.032, 0.03], 'coat', **D)
    ellipsoid('Purple glove pointing', (bx - 0.12, 0.265, 0.21), (0.033, 0.036, 0.03), 'glove', seg=16, rings=8, **D)
    cyl('Pointing finger', (0, 0, 0), 0.012, 0.011, 0.05, 'glove', bev=0.003, **D)
    along(bpy.data.objects['Pointing finger'], (bx - 0.118, 0.285, 0.215), (bx - 0.113, 0.33, 0.225))
    rem = empty('Inator remote frame', tuple(REM_LOC), tuple(REM_ROT), parent=ck)
    DR = dict(parent=rem, dome=True)
    box('Chunky inator remote', (0, 0, 0), (0.085, 0.055, 0.13), 'remote', bev=0.012, **DR)
    cyl('Big red inator button', (0, 0.03, 0.03), 0.022, 0.02, 0.018, 'button', rot=(-math.pi / 2, 0, 0), bev=0.004, **DR)
    for k, (x, key) in enumerate(((-0.022, 'plate_yellow'), (0.022, 'teal'))):
        cyl(f'Remote dial {k}', (x, 0.03, -0.022), 0.011, 0.011, 0.012, key, rot=(-math.pi / 2, 0, 0), bev=0.002, **DR)
    for k in range(3):
        box(f'Remote grille slot {k}', (0, 0.029, -0.045 - 0.012 * k), (0.05, 0.006, 0.005), 'ink', bev=0.0015, **DR)
    t0 = REM_LOC + Vector((0, 0, 0.06)); up = PORT.z + 0.03
    zig = [tuple(t0), (t0.x, t0.y, up)]
    for j, (a, b) in enumerate(((0.05, 0.08), (-0.045, 0.155), (0.055, 0.23), (-0.035, 0.30), (0.02, 0.345))):
        zig.append((t0.x + a * 0.76, t0.y - a * 0.76, up + b))
    cu = bpy.data.curves.new('Zig-zag antenna', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.012; cu.bevel_resolution = 3; cu.use_fill_caps = True
    sp = cu.splines.new('POLY'); sp.points.add(len(zig) - 1)
    for pt, co in zip(sp.points, zig): pt.co = (*co, 1.0)
    link('Zig-zag antenna', cu, mat('antenna'), ck, dome=True)
    ellipsoid('Pink antenna ball', (zig[-1][0], zig[-1][1], zig[-1][2] + 0.03), (0.036, 0.036, 0.036), 'ball', parent=ck, seg=20, rings=10, dome=True)

    # --- Short straps from the tub down to the chest belt (the cockpit is strapped on) ------------------------------
    TMi = TORSO_M.inverted(); CK = Vector((0.0, -0.12, 2.34))
    def outside(pw, off):
        q = TMi @ pw; r = interp(TORSO, max(0.0, min(q.z, 1.58)))
        if r < 1e-3: return pw
        e = math.sqrt(q.x ** 2 + (q.y / TORSO_EY) ** 2) / r
        if e < 1 + off / r:
            sc_ = (1 + off / r) / max(e, 1e-4); q = Vector((q.x * sc_, q.y * sc_, q.z))
        return TORSO_M @ q
    for j, az in enumerate((20, 160, 238, 302)):
        a = math.radians(az); p1 = CK + Vector((0.31 * math.cos(a), 0.31 * math.sin(a), -0.29))
        r = interp(TORSO, zb); lp = Vector((r * math.cos(a), r * TORSO_EY * math.sin(a), zb)); p2 = tw(lp)
        pts = [p1.lerp(p2, t) for t in (0.0, 0.25, 0.5, 0.75, 1.0)]
        pts = [pts[0]] + [outside(q, 0.018) for q in pts[1:]]
        side = Vector((-math.sin(a), math.cos(a), 0.0))
        ribbon(f'Cockpit strap {j}', pts, [None] * 5, [side] * 5, 0.038, 0.02, 'strap')
    for ob in PARTS: ob['work_order'] = 'WO111'; ob['asset_id'] = 'inator-monster'

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

TOPS = {'Zig-zag antenna tip': ['Pink antenna ball'], 'Bubble cockpit dome': ['Bubble cockpit dome', 'Brass antenna port'],
        'Googly eyes': ['Googly eye white', 'Googly eye plastic rim', 'Googly pupil'], 'Monster cranium': ['Monster cranium'],
        'Back plates': ['Toy back plate'], 'Scientist head': ['Scientist round head', 'Scientist bald crown', 'Wild hair spike', 'Goggle', 'Scheming brow'],
        'Cockpit rim': ['Brass cockpit rim'], 'Pear kaiju torso': ['Pear kaiju torso']}
def tops():
    dg = bpy.context.evaluated_depsgraph_get(); out = {}
    obs = [o for o in bpy.data.collections[MASTER].objects if o.type in ('MESH', 'CURVE')]
    for label, prefixes in TOPS.items():
        hi = -1e9
        for ob in obs:
            if not any(ob.name.startswith(p) for p in prefixes): continue
            ev = ob.evaluated_get(dg); me = ev.to_mesh()
            hi = max([hi] + [(ev.matrix_world @ v.co).z for v in me.vertices]); ev.to_mesh_clear()
        out[label] = round(hi, 4)
    return out

if __name__ == '__main__':
    sc = bpy.context.scene
    assert sc.get('asset_id') == 'inator-monster' and sc.get('scene_lease') == 'active'
    build(); bpy.context.view_layer.update()
    m = measure(); t = tops()
    sc['blockout_bounds_m'] = json.dumps(m); sc['blockout_tops_m'] = json.dumps(t)
    path = ROOT / 'inator-monster-blockout.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(path), compress=True)
    rec = {'saved': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bounds_blender_zup': m, 'feature_tops_m': t,
           'parts': len(PARTS), 'dome_parts': sum(1 for p in PARTS if p['in_dome']), 'materials': sorted(x.name for x in bpy.data.materials),
           'utc': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    (ROOT / 'blockout-measurements.json').write_text(json.dumps(rec, indent=2) + '\n')
    print(json.dumps(rec))
