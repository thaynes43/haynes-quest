"""WO111 playroom-kit v001: painted flat-colour BLOCKOUT of the four World B chapter 1 playroom props.

Reference-sheet stage only: bevelled primitives, lathes, sweeps and outline slabs. No final topology, no atlas, no GLB.
Blender +Z up, each prop's visible FRONT faces -Y (glTF +Z, the theme-kit registry's "+Z toward the player at
rotation 0"), origin at the floor centre of its footprint. Viewer's right = +X. All dimensions in metres.

The prop ids and bounding boxes are the playroom entries of src/shared/theme-kits.ts on origin/main (box(halfX,
height, halfZ)); every part stays inside its box so the decor already placed in World B chapter 1
(scripts/levels/family/b1.ts) stays valid:
  stacking-block-tower  box(0.7, 2.4, 0.7)   stacked 2.4 m apart as landmarks and stilts, so its top and bottom are flat
  toy-bus-garage        box(2.0, 2.2, 1.6)   placed at scale 1.9 beside the nap rug as the Honk Bus's garage
  crib-rail-fence       box(1.6, 0.9, 0.12)  hung on deck sides in runs 3.2 m apart, so it tiles end to end
  giant-plush-ball      box(0.9, 1.8, 0.9)   scattered at scale 1.6-3 and hung at 0.45-0.8 as a crib mobile
Each prop is its own collection under the master collection, all floor-centred at the world origin.
"""
import bpy, bmesh, math, json, hashlib, datetime
from mathutils import Vector, Matrix
from pathlib import Path

ROOT = Path('/workspace/haynes-quest/family-eras/playroom-kit/v001')
MASTER = 'Playroom kit blockout (master)'
REGISTRY = {  # origin/main src/shared/theme-kits.ts: box(halfX, height, halfZ), glTF metres (halfZ = Blender half-depth in Y)
    'stacking-block-tower': (0.7, 2.4, 0.7), 'toy-bus-garage': (2.0, 2.2, 1.6),
    'crib-rail-fence': (1.6, 0.9, 0.12), 'giant-plush-ball': (0.9, 1.8, 0.9),
}
PROPS = list(REGISTRY)

PAL = {
    'cream': '#fdf6ec', 'pink': '#f4a7b9', 'rose': '#e8829f', 'sky': '#a7d8f4', 'blue': '#6fb1e3',
    'butter': '#fbe3a1', 'honey': '#f2c65c', 'lilac': '#b9a7f4', 'mint': '#a7e0c8', 'night': '#5a4a7c',
}
# Soft foam and painted toy wood read matte; the plush ball gets a fabric sheen; lamps and window panes are glossy.
LOOK = {
    'night': dict(rough=0.9, spec=0.1),
}

def lin(h):
    h = h.lstrip('#'); out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)

MATS = {}
def mat(key, finish='foam'):
    """finish: 'foam' (matte soft vinyl foam / painted toy wood), 'plush' (fabric), 'gloss' (lamp or pane)."""
    tag = (key, finish)
    if tag in MATS: return MATS[tag]
    m = bpy.data.materials.new(f'PK {finish} {key} {PAL[key]}'); m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF'); lk = LOOK.get(key, {})
    bs.inputs['Base Color'].default_value = lin(PAL[key])
    if finish == 'plush':
        bs.inputs['Roughness'].default_value = 0.95; bs.inputs['Specular IOR Level'].default_value = 0.08
        bs.inputs['Sheen Weight'].default_value = 0.6; bs.inputs['Sheen Tint'].default_value = (1.0, 1.0, 1.0, 1.0)
    elif finish == 'gloss':
        bs.inputs['Roughness'].default_value = 0.22; bs.inputs['Specular IOR Level'].default_value = 0.55
        bs.inputs['Emission Color'].default_value = lin(PAL[key]); bs.inputs['Emission Strength'].default_value = 0.25
    else:
        bs.inputs['Roughness'].default_value = lk.get('rough', 0.72); bs.inputs['Specular IOR Level'].default_value = lk.get('spec', 0.22)
    m.diffuse_color = lin(PAL[key]); m['palette_hex'] = PAL[key]; m['finish'] = finish
    MATS[tag] = m; return m

PARTS = []
CUR = {'prop': None}
def link(name, data, key, finish='foam', smooth=True):
    coll = bpy.data.collections['PK ' + CUR['prop']]
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

def rbox(name, center, size, key, rotz=0.0, bev=0.02, seg=3, finish='foam'):
    me = bpy.data.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bm.to_mesh(me); bm.free()
    for v in me.vertices: v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    ob = link(name, me, key, finish); ob.location = center; ob.rotation_euler = (0, 0, rotz)
    if bev: bevel(ob, bev, seg)
    return wnormals(ob)

def cyl(name, loc, r1, r2, depth, key, rot=(0, 0, 0), seg=48, bev=0.006, finish='foam'):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r1, radius2=r2, depth=depth)
    bm.to_mesh(me); bm.free()
    ob = link(name, me, key, finish); ob.location = loc; ob.rotation_euler = rot
    if bev: bevel(ob, bev, 3)
    return wnormals(ob)

def along(ob, a, b):
    a = Vector(a); b = Vector(b); ob.location = (a + b) / 2
    ob.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler(); return ob

def rod(name, a, b, r1, r2, key, seg=40, bev=0.004, finish='foam'):
    return along(cyl(name, (0, 0, 0), r1, r2, (Vector(b) - Vector(a)).length, key, seg=seg, bev=bev, finish=finish), a, b)

def ellipsoid(name, loc, s, key, rot=(0, 0, 0), seg=40, rings=20, finish='foam'):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0); bm.to_mesh(me); bm.free()
    ob = link(name, me, key, finish); ob.location = loc; ob.scale = s; ob.rotation_euler = rot; return ob

def half_ellipsoid(name, loc, s, key, seg=48, rings=24):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-5], context='VERTS')
    bmesh.ops.contextual_create(bm, geom=[e for e in bm.edges if e.is_boundary])
    bm.to_mesh(me); bm.free()
    ob = link(name, me, key); ob.location = loc; ob.scale = s; return ob

def frame(y_axis, z_hint, origin=(0, 0, 0)):
    """World matrix whose local +Y is y_axis and local +Z is as close to z_hint as possible."""
    Y = Vector(y_axis).normalized(); Z = Vector(z_hint); Z = (Z - Z.dot(Y) * Y).normalized(); X = Y.cross(Z)
    M = Matrix((X, Y, Z)).transposed().to_4x4(); M.translation = Vector(origin); return M

def slab(name, pts, y0, y1, key, M=None, bev=0.0, seg=3, finish='foam', smooth=False):
    """Closed prism: 2-D outline pts[(x, z)] (any winding, may be concave) extruded along local Y from y0 to y1.
    The two caps stay n-gons (Blender's polyfill handles concave outlines)."""
    bm = bmesh.new()
    fr = [bm.verts.new((x, y0, z)) for x, z in pts]; bk = [bm.verts.new((x, y1, z)) for x, z in pts]
    n = len(pts)
    bm.faces.new(fr); bm.faces.new(list(reversed(bk)))
    for i in range(n):
        j = (i + 1) % n; bm.faces.new((fr[i], fr[j], bk[j], bk[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = link(name, me, key, finish, smooth=False)
    if smooth:
        for p in me.polygons: p.use_smooth = True
    if M is not None: ob.matrix_world = M
    if bev: bevel(ob, bev, seg)
    for p in me.polygons: p.use_smooth = True
    return wnormals(ob)

def shape_on(name, pts, thick, key, normal, center, up=(0, 0, 1), bev=0.008, finish='foam'):
    """Raised appliqué: outline pts[(u, v)] (u right, v up as seen facing the surface) standing proud along normal."""
    n = Vector(normal).normalized()
    M = frame(-n, up, Vector(center))                    # local -Y points out of the surface, local Z up
    return slab(name, list(pts), -thick, 0.0, key, M=M, bev=bev, seg=2, finish=finish)

def sweep(name, pts, r, key, n=20, closed=False, finish='foam'):
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

def star(r_out, r_in, k=5, round_n=3):
    pts = []
    for i in range(2 * k):
        a = math.pi / 2 + math.pi * i / k; r = r_out if i % 2 == 0 else r_in
        pts.append((r * math.cos(a), r * math.sin(a)))
    return soften(pts, 0.28, round_n)

def soften(pts, f, n):
    """Round each corner of a polygon with a quadratic Bezier between points f of the way along its edges."""
    out = []; m = len(pts)
    for i in range(m):
        p0 = Vector(pts[i - 1]); p1 = Vector(pts[i]); p2 = Vector(pts[(i + 1) % m])
        a = p1 + (p0 - p1) * f; b = p1 + (p2 - p1) * f
        for s in range(n + 1):
            t = s / n; q = (1 - t) ** 2 * a + 2 * (1 - t) * t * p1 + t * t * b; out.append((q.x, q.y))
    return out

def heart(w, n=40):
    pts = []
    for i in range(n):
        t = math.tau * i / n
        x = 16 * math.sin(t) ** 3; y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((x, y))
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; s = w / (max(xs) - min(xs)); cy = (max(ys) + min(ys)) / 2
    return [(x * s, (y - cy) * s) for x, y in reversed(pts)]

def circle(r, n=40):
    return [(r * math.cos(math.tau * i / n), r * math.sin(math.tau * i / n)) for i in range(n)]

def triangle(side):
    h = side * math.sqrt(3) / 2
    return soften([(-side / 2, -h / 3), (side / 2, -h / 3), (0, 2 * h / 3)], 0.22, 5)

SHAPES = {'star': lambda: star(0.25, 0.115), 'heart': lambda: heart(0.44), 'circle': lambda: circle(0.19), 'triangle': lambda: triangle(0.46)}

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
    c = bpy.data.collections.new('PK ' + prop); bpy.data.collections[MASTER].children.link(c)

# =====================================================================================================================
# 1. stacking-block-tower: three chunky soft foam blocks, 0.8 m each, stacked with a playful wobble
# =====================================================================================================================
BLOCK_H = 0.8
BLOCKS = [  # (z0, side, rot deg, x/y offset, body colour, faces front / +X / back / -X as (shape, colour))
    (0.0, 1.24, 7.0, (0.0, 0.0), 'pink', [('star', 'honey'), ('circle', 'sky'), ('triangle', 'mint'), ('heart', 'blue')]),
    (0.8, 1.16, -9.0, (0.03, -0.01), 'sky', [('heart', 'rose'), ('triangle', 'pink'), ('star', 'cream'), ('circle', 'honey')]),
    (1.6, 1.20, 4.0, (-0.03, 0.01), 'mint', [('triangle', 'lilac'), ('heart', 'honey'), ('circle', 'blue'), ('star', 'rose')]),
]

def build_tower():
    begin('stacking-block-tower')
    for i, (z0, s, rot, (ox, oy), body, faces) in enumerate(BLOCKS):
        th = math.radians(rot); R = Matrix.Rotation(th, 3, 'Z'); c = Vector((ox, oy, z0 + BLOCK_H / 2))
        rbox(f'Foam block {i + 1} ({body})', c, (s, s, BLOCK_H), body, rotz=th, bev=0.1, seg=5)
        for (shape, col), n in zip(faces, [(0, -1, 0), (1, 0, 0), (0, 1, 0), (-1, 0, 0)]):
            nw = R @ Vector(n); centre = c + nw * (s / 2 - 0.004)
            side = {(0, -1, 0): 'front', (1, 0, 0): '+X', (0, 1, 0): 'back', (-1, 0, 0): '-X'}[n]
            shape_on(f'Raised {shape} block {i + 1} {side}', SHAPES[shape](), 0.034, col, nw, centre, bev=0.01)

# =====================================================================================================================
# 2. toy-bus-garage: a chunky toddler-playset garage for the Honk Bus, with a traffic-light tower and a honk horn
# =====================================================================================================================
GX0, GX1 = -1.90, 0.76            # garage body walls (x); the traffic-light tower stands to the +X side
GCX = (GX0 + GX1) / 2; GHW = (GX1 - GX0) / 2
GY0, GY1 = -0.95, 1.45            # front and back faces of the body
WALL = 0.14; TRAY = 0.08; WALL_TOP = 1.62
ROOF_A_IN = GHW; ROOF_B_IN = 0.48; ROOF_A_OUT = GHW + 0.08; ROOF_B_OUT = 0.56   # elliptic barrel roof -> shell top 2.18
DOOR_W = 1.50; DOOR_H = 1.35; DOOR_R = 0.32
DX0, DX1 = GCX - DOOR_W / 2, GCX + DOOR_W / 2; DZ1 = TRAY + DOOR_H
TOWER = Vector((1.42, -0.30)); TOWER_R = 0.42

def gable_outline(notch):
    """Counter-clockwise wall outline: bottom edge, (door notch carved up from the floor), right side, elliptic gable, left side."""
    pts = [(GX0, TRAY)]
    if notch:
        pts += [(DX0, TRAY)]
        pts += arc(DX0 + DOOR_R, DZ1 - DOOR_R, DOOR_R, DOOR_R, math.pi, math.pi / 2, 8)      # up the left jamb, round the corner
        pts += arc(DX1 - DOOR_R, DZ1 - DOOR_R, DOOR_R, DOOR_R, math.pi / 2, 0, 8)            # across the head, round the corner
        pts += [(DX1, TRAY)]
    pts += [(GX1, TRAY)] + arc(GCX, WALL_TOP, ROOF_A_IN, ROOF_B_IN, 0, math.pi, 32)
    return pts

def build_garage():
    begin('toy-bus-garage')
    # toy base tray (mint) with rounded corners, horizontal: local x->X, local z->Y, extrusion local y->-Z
    M_FLOOR = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))
    slab('Toy base tray', rrect(-1.98, 1.98, -1.58, 1.58, 0.30, 10), -TRAY, 0.0, 'mint', M=M_FLOOR, bev=0.025)
    # blue toy road running in through the door, with cream dashes
    slab('Toy road', rrect(DX0 + 0.05, DX1 - 0.05, -1.50, 1.25, 0.06, 4), -(TRAY + 0.014), -TRAY + 0.001, 'blue', M=M_FLOOR, bev=0.004)
    for k, y in enumerate((-1.36, -1.08, 0.2, 0.75)):
        slab(f'Road dash {k + 1}', rrect(GCX - 0.05, GCX + 0.05, y - 0.1, y + 0.1, 0.04, 4), -(TRAY + 0.019), -(TRAY + 0.010), 'cream', M=M_FLOOR)
        no_ink(PARTS[-1])
    # walls: notched front with the arched gable, plain back gable, two side walls (hollow shell)
    slab('Front wall with door', gable_outline(True), GY0, GY0 + WALL, 'butter', bev=0.03)
    slab('Back wall', gable_outline(False), GY1 - WALL, GY1, 'butter', bev=0.03)
    rbox('Left wall', (GX0 + WALL / 2, (GY0 + GY1) / 2, (TRAY + WALL_TOP) / 2), (WALL, GY1 - GY0, WALL_TOP - TRAY), 'butter', bev=0.03)
    rbox('Right wall', (GX1 - WALL / 2, (GY0 + GY1) / 2, (TRAY + WALL_TOP) / 2), (WALL, GY1 - GY0, WALL_TOP - TRAY), 'butter', bev=0.03)
    # dark interior liner (open at the front) so the doorway reads as a deep garage
    xa, xb, ya, yb, za, zb = GX0 + WALL + 0.005, GX1 - WALL - 0.005, GY0 + WALL - 0.002, GY1 - WALL - 0.005, TRAY + 0.004, WALL_TOP - 0.005
    v = [(xa, ya, za), (xb, ya, za), (xb, yb, za), (xa, yb, za), (xa, ya, zb), (xb, ya, zb), (xb, yb, zb), (xa, yb, zb)]
    me = bpy.data.meshes.new('Interior liner'); me.from_pydata(v, [], [(0, 1, 2, 3), (3, 2, 6, 7), (0, 3, 7, 4), (1, 5, 6, 2), (4, 7, 6, 5)]); me.update()
    no_ink(link('Interior liner (night)', me, 'night', smooth=False))
    # half-raised roll-up door: striped slats behind the lintel
    for k, (z, col) in enumerate(((DZ1 - 0.07, 'blue'), (DZ1 - 0.19, 'cream'), (DZ1 - 0.31, 'blue'))):
        rbox(f'Roll-up door slat {k + 1} ({col})', (GCX, GY0 + WALL + 0.035, z), (DOOR_W + 0.1, 0.05, 0.115), col, bev=0.02)
    # elliptic barrel roof shell (lilac) with pink piping ribs
    outer = arc(GCX, WALL_TOP, ROOF_A_OUT, ROOF_B_OUT, 0, math.pi, 40)
    inner = arc(GCX, WALL_TOP, ROOF_A_IN, ROOF_B_IN, math.pi, 0, 40)
    slab('Barrel roof', outer + inner, GY0 - 0.07, GY1 + 0.07, 'lilac', bev=0.02)
    mid = arc(GCX, WALL_TOP, (ROOF_A_OUT + ROOF_A_IN) / 2, (ROOF_B_OUT + ROOF_B_IN) / 2, 0.02, math.pi - 0.02, 48)
    for k, (y, r) in enumerate(((GY0 - 0.07, 0.045), (GY0 + (GY1 - GY0) / 3, 0.055), (GY0 + 2 * (GY1 - GY0) / 3, 0.055), (GY1 + 0.07, 0.045))):
        sweep(f'Roof piping rib {k + 1}', [(x, y, z) for x, z in mid], r, 'pink', n=16)
    # pink door-frame piping and rounded corner posts
    path = [(DX0, GY0 - 0.01, TRAY)] + [(x, GY0 - 0.01, z) for x, z in arc(DX0 + DOOR_R, DZ1 - DOOR_R, DOOR_R, DOOR_R, math.pi, math.pi / 2, 10)]
    path += [(x, GY0 - 0.01, z) for x, z in arc(DX1 - DOOR_R, DZ1 - DOOR_R, DOOR_R, DOOR_R, math.pi / 2, 0, 10)] + [(DX1, GY0 - 0.01, TRAY)]
    sweep('Door frame piping', path, 0.06, 'pink', n=18)
    for side, x in (('left', GX0 + 0.02), ('right', GX1 - 0.02)):
        rod(f'Corner post {side}', (x, GY0 + 0.02, TRAY), (x, GY0 + 0.02, WALL_TOP - 0.02), 0.085, 0.085, 'pink', seg=32, bev=0.02)
        ellipsoid(f'Corner post ball {side}', (x, GY0 + 0.02, WALL_TOP), (0.1, 0.1, 0.1), 'pink', seg=24, rings=12)
    # gable badge: a round blue sign with a cream bus pictogram (no lettering)
    bz = 1.81
    rod('Badge rim', (GCX, GY0 + 0.01, bz), (GCX, GY0 - 0.03, bz), 0.26, 0.26, 'cream', seg=56, bev=0.01)
    rod('Badge disc', (GCX, GY0 - 0.02, bz), (GCX, GY0 - 0.05, bz), 0.215, 0.215, 'blue', seg=56, bev=0.006)
    bus = [(GCX + x, bz + z) for x, z in rrect(-0.15, 0.15, -0.06, 0.09, 0.045, 5)]
    slab('Badge bus pictogram', [(x - GCX, z - bz) for x, z in bus], -0.012, 0.0, 'cream', M=Matrix.Translation((GCX, GY0 - 0.05, bz)), bev=0.003)
    for k, x in enumerate((-0.085, 0.0, 0.085)):
        no_ink(slab(f'Pictogram window {k + 1}', rrect(x - 0.032, x + 0.032, 0.005, 0.06, 0.012, 3), -0.018, -0.011, 'blue',
                    M=Matrix.Translation((GCX, GY0 - 0.05, bz))))
    for k, x in enumerate((-0.085, 0.085)):
        rod(f'Pictogram wheel {k + 1}', (GCX + x, GY0 - 0.055, bz - 0.065), (GCX + x, GY0 - 0.075, bz - 0.065), 0.036, 0.036, 'night', seg=24, bev=0.003)
    # portholes on the -X side wall
    for k, y in enumerate((-0.25, 0.65)):
        rod(f'Side porthole frame {k + 1}', (GX0 + 0.01, y, 0.98), (GX0 - 0.045, y, 0.98), 0.2, 0.2, 'cream', seg=48, bev=0.012)
        rod(f'Side porthole pane {k + 1}', (GX0 - 0.03, y, 0.98), (GX0 - 0.052, y, 0.98), 0.145, 0.145, 'sky', seg=48, bev=0.004, finish='gloss')
    # traffic-light tower (mint) with a rose dome, a cream band and a brass honk horn on top
    tx, ty = TOWER
    cyl('Tower drum', (tx, ty, (TRAY + 1.50) / 2), TOWER_R, TOWER_R, 1.50 - TRAY, 'mint', seg=56, bev=0.03)
    cyl('Tower band', (tx, ty, 1.54), TOWER_R + 0.03, TOWER_R + 0.03, 0.08, 'cream', seg=56, bev=0.02)
    half_ellipsoid('Tower dome', (tx, ty, 1.58), (TOWER_R + 0.02, TOWER_R + 0.02, 0.32), 'rose')
    ellipsoid('Honk horn bulb', (tx, ty + 0.02, 1.97), (0.085, 0.085, 0.1), 'rose', seg=28, rings=14)
    rod('Honk horn neck', (tx, ty - 0.04, 1.985), (tx, ty - 0.30, 1.99), 0.026, 0.03, 'honey', seg=20, bev=0.003)
    rod('Honk horn bell', (tx, ty - 0.29, 1.99), (tx, ty - 0.46, 1.99), 0.03, 0.105, 'honey', seg=40, bev=0.004)
    rbox('Traffic light housing', (tx, ty - TOWER_R - 0.06, 1.02), (0.27, 0.13, 0.68), 'cream', bev=0.06, seg=4)
    for k, (z, col) in enumerate(((1.24, 'rose'), (1.02, 'honey'), (0.80, 'mint'))):
        rod(f'Traffic lamp {k + 1} ({col})', (tx, ty - TOWER_R - 0.12, z), (tx, ty - TOWER_R - 0.155, z), 0.075, 0.07, col, seg=40, bev=0.01, finish='gloss')
        no_ink(PARTS[-1])

# =====================================================================================================================
# 3. crib-rail-fence: one 3.2 m tileable crib-rail panel with a soft teether rail and a bead-slide toy
# =====================================================================================================================
def build_fence():
    begin('crib-rail-fence')
    for side, x in (('left', -1.54), ('right', 1.54)):
        rbox(f'End post {side}', (x, 0, 0.38), (0.12, 0.17, 0.76), 'sky', bev=0.035)
        no_ink(shape_on(f'Post heart {side}', heart(0.075), 0.012, 'rose', (0, -1, 0), (x, -0.085, 0.47), bev=0.003))
    rbox('Soft teether top rail', (0, 0, 0.83), (3.2, 0.17, 0.14), 'mint', bev=0.06, seg=5)
    rbox('Bottom rail', (0, 0, 0.11), (3.04, 0.11, 0.10), 'cream', bev=0.03)   # ends buried in the posts
    xs = [-1.48 + 2.96 * k / 15 for k in range(1, 15)]
    for k, x in enumerate(xs):
        if abs(x) < 0.4: continue
        rod(f'Spindle {k + 1:02d}', (x, 0, 0.14), (x, 0, 0.78), 0.028, 0.028, 'cream', seg=24, bev=0.012)
    edge = xs[4]; edge = abs(edge)
    beads = ['pink', 'honey', 'mint', 'sky', 'rose']
    for row, (z, pos) in enumerate(((0.56, (-0.39, -0.26, -0.13, 0.25, 0.38)), (0.36, (-0.38, -0.25, 0.12, 0.25, 0.38)))):
        rod(f'Bead rod {row + 1}', (-edge, 0, z), (edge, 0, z), 0.017, 0.017, 'lilac', seg=20, bev=0.0)
        for k, (x, col) in enumerate(zip(pos, beads if row == 0 else list(reversed(beads)))):
            ellipsoid(f'Bead {row + 1}.{k + 1} ({col})', (x, 0, z), (0.06, 0.075, 0.075), col, seg=28, rings=14)

# =====================================================================================================================
# 4. giant-plush-ball: an eight-panel puffy plush ball with cream piping, button caps, a star, a heart and a tag loop
# =====================================================================================================================
BALL_R = 0.835; BALL_SQUASH = 0.975; BALL_PUFF = 0.05; GORES = 8
GORE_W = math.tau / GORES; PHI0 = -math.pi / 2 - GORE_W / 2   # panel 1 is centred on the front (-Y)
GORE_COLS = ['pink', 'sky', 'butter', 'mint'] * 2
BALL_LIFT = 0.0225   # the cream button cap and seam piping at the bottom pole just touch the floor
BALL_CZ = BALL_R * BALL_SQUASH + BALL_LIFT

def ball_point(theta, phi, puff=True):
    """theta from the top pole (0) to the bottom (pi); phi azimuth. Panels bulge between the seams."""
    u = ((phi - PHI0) / GORE_W) % 1.0
    r = BALL_R * (1 + (BALL_PUFF * math.sin(math.pi * u) ** 0.6 * math.sin(theta) ** 0.7 if puff else 0.0))
    return Vector((r * math.sin(theta) * math.cos(phi), r * math.sin(theta) * math.sin(phi), BALL_CZ + r * math.cos(theta) * BALL_SQUASH))

def build_ball():
    begin('giant-plush-ball')
    # gore 0 is centred on the front (-Y, phi = -90 deg), so the star panel faces the player
    rings = 40; cols = 14; w = GORE_W; phi0 = PHI0
    for g in range(GORES):
        verts = []; faces = []
        for i in range(rings + 1):
            th = 0.02 + (math.pi - 0.04) * i / rings
            for j in range(cols + 1):
                verts.append(tuple(ball_point(th, phi0 + w * (g + j / cols))))
        for i in range(rings):
            for j in range(cols):
                a = i * (cols + 1) + j; faces.append((a, a + 1, a + cols + 2, a + cols + 1))
        me = bpy.data.meshes.new(f'Plush panel {g + 1}'); me.from_pydata(verts, [], faces); me.update()
        bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        # make sure normals point outward
        bm.faces.ensure_lookup_table(); f0 = bm.faces[len(bm.faces) // 2]
        if f0.normal.dot(f0.calc_center_median() - Vector((0, 0, BALL_CZ))) < 0: bmesh.ops.reverse_faces(bm, faces=bm.faces)
        bm.to_mesh(me); bm.free()
        link(f'Plush panel {g + 1} ({GORE_COLS[g]})', me, GORE_COLS[g], finish='plush')
    for g in range(GORES):
        ph = phi0 + w * g
        sweep(f'Seam piping {g + 1}', [tuple(ball_point(0.02 + (math.pi - 0.04) * i / 60, ph, puff=False)) for i in range(61)], 0.022, 'cream', n=12, finish='plush')
    top_z = BALL_CZ + BALL_R * BALL_SQUASH
    ellipsoid('Top button cap', (0, 0, top_z - 0.012), (0.11, 0.11, 0.035), 'cream', seg=32, rings=12, finish='plush')
    ellipsoid('Bottom button cap', (0, 0, BALL_LIFT + 0.009), (0.11, 0.11, 0.03), 'cream', seg=32, rings=12, finish='plush')
    loop = [(0.08 * math.cos(a), 0.0, top_z + 0.004 + 0.047 * (1 + math.sin(a))) for a in [math.pi * 2 * i / 48 for i in range(48)]]
    # a wide lilac ribbon loop across the top (it reads from the front; the crib mobile hangs balls by it)
    sweep('Ribbon tag loop', loop, 0.016, 'lilac', n=12, closed=True)
    # appliques: a honey star on the front panel, a rose heart on the panel turned toward -X
    ball_decal('Star applique', star(0.21, 0.095), 'honey', -math.pi / 2, math.pi / 2 - 0.05)
    ball_decal('Heart applique', heart(0.34), 'rose', -math.pi / 2 - 2 * w, math.pi / 2 - 0.05)

def ball_decal(name, pts, col, phi_c, theta_c, proud=0.018, embed=0.012):
    """Stitched felt appliqué that follows the puffy panel: outline rings (100%, 55%) and a centre, each projected
    onto the ball surface, then offset proud (front) and embedded (back) along the surface direction."""
    d = Vector((math.sin(theta_c) * math.cos(phi_c), math.sin(theta_c) * math.sin(phi_c), math.cos(theta_c)))
    eu = Vector((-math.sin(phi_c), math.cos(phi_c), 0.0)); ev = d.cross(eu)
    def surf(u, v, off):
        q = (d * BALL_R + eu * u + ev * v).normalized()
        th = math.acos(max(-1.0, min(1.0, q.z))); ph = math.atan2(q.y, q.x)
        return ball_point(th, ph) + q * off
    rings = [[(0.0, 0.0)], [(u * 0.55, v * 0.55) for u, v in pts], list(pts)]
    bm = bmesh.new(); F = []; B = []
    for ring in rings:
        F.append([bm.verts.new(surf(u, v, proud)) for u, v in ring]); B.append([bm.verts.new(surf(u, v, -embed)) for u, v in ring])
    n = len(pts)
    for L in (F, B):
        for i in range(n): bm.faces.new((L[0][0], L[1][i], L[1][(i + 1) % n]))
        for i in range(n): bm.faces.new((L[1][i], L[2][i], L[2][(i + 1) % n], L[1][(i + 1) % n]))
    for i in range(n): bm.faces.new((F[2][i], B[2][i], B[2][(i + 1) % n], F[2][(i + 1) % n]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    return link(name, me, col, finish='plush')

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
    build_tower(); build_garage(); build_fence(); build_ball()
    for ob in PARTS: ob['work_order'] = 'WO111'; ob['asset_id'] = 'playroom-kit'

if __name__ == '__main__':
    sc = bpy.context.scene
    assert sc.get('asset_id') == 'playroom-kit' and sc.get('scene_lease') == 'active'
    t0 = datetime.datetime.now(datetime.timezone.utc)
    build(); bpy.context.view_layer.update()
    props = {}
    for p in PROPS:
        m, per = measure(list(bpy.data.collections['PK ' + p].objects))
        hx, hh, hz = REGISTRY[p]
        m['registry_box_blender'] = {'min': [-hx, -hz, 0.0], 'max': [hx, hz, hh]}
        m['inside_registry_box'] = (m['min'][0] >= -hx - 1e-4 and m['max'][0] <= hx + 1e-4 and m['min'][1] >= -hz - 1e-4 and m['max'][1] <= hz + 1e-4
                                    and m['min'][2] >= -1e-4 and m['max'][2] <= hh + 1e-4)
        m['gltf_bounds_y_up'] = {'min': [m['min'][0], m['min'][2], -m['max'][1]], 'max': [m['max'][0], m['max'][2], -m['min'][1]]}
        m['parts'] = len(bpy.data.collections['PK ' + p].objects); m['part_tops_m'] = per
        props[p] = m
    sc['blockout_bounds_m'] = json.dumps({p: {k: props[p][k] for k in ('min', 'max', 'size')} for p in PROPS})
    sc['orientation'] = 'Blender +Z up, prop front toward -Y; glTF +Y up, front toward +Z (theme-kit rotation 0); floor-centred origin per prop'
    path = ROOT / 'playroom-kit-blockout.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(path), compress=True)
    rec = {'saved': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'props': props,
           'materials': sorted(x.name for x in bpy.data.materials), 'parts': len(PARTS),
           'build_seconds': round((datetime.datetime.now(datetime.timezone.utc) - t0).total_seconds(), 1),
           'utc': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    (ROOT / 'blockout-measurements.json').write_text(json.dumps(rec, indent=2) + '\n')
    print(json.dumps({p: {k: props[p][k] for k in ('min', 'max', 'size', 'blockout_triangles', 'inside_registry_box', 'parts')} for p in PROPS}, indent=1))
