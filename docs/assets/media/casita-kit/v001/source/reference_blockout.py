"""WO111 casita-kit v001: painted flat-colour BLOCKOUT of the four World B chapter 2 casita props.

Reference-sheet stage only: bevelled primitives, lathes, sweeps and outline slabs. No final topology, no atlas, no GLB.
Blender +Z up, each prop's visible FRONT faces -Y (glTF +Z, the theme-kit registry's "+Z toward the player at
rotation 0"), origin at the floor centre of its footprint. Viewer's right = +X. All dimensions in metres.

The prop ids and bounding boxes are the casita entries of src/shared/theme-kits.ts on origin/main (box(halfX, height,
halfZ)); every part stays inside its box so the decor already placed in World B chapter 2
(scripts/levels/family/b2.ts) stays valid:
  casita-terrace-wall  box(2.4, 2.0, 0.35)  9 walls at x1.1-1.6 along block faces, below the deck tops, set end to end
  flower-planter       box(0.6, 0.9, 0.6)   20 flower beds at x1.5-2 on the ground beside the decks
  patterned-door       box(0.8, 2.4, 0.2)   4 doors at x1.2-1.4 on camera-facing block faces, standing on the ground
  butterfly-arch       box(1.8, 3.2, 0.3)   3 arches at x1.4, x1.8 and x3.4, backdrop only (never over a lane)
Each prop is its own collection under the master collection, all floor-centred at the world origin.
Adapted from the playroom-kit v001 build_blockout.py helpers.
"""
import bpy, bmesh, math, json, hashlib, datetime, random
from mathutils import Vector, Matrix
from pathlib import Path

ROOT = Path('/workspace/haynes-quest/family-eras/casita-kit/v001')
MASTER = 'Casita kit blockout (master)'
REGISTRY = {  # origin/main src/shared/theme-kits.ts: box(halfX, height, halfZ), glTF metres (halfZ = Blender half-depth in Y)
    'casita-terrace-wall': (2.4, 2.0, 0.35), 'flower-planter': (0.6, 0.9, 0.6),
    'patterned-door': (0.8, 2.4, 0.2), 'butterfly-arch': (1.8, 3.2, 0.3),
}
PROPS = list(REGISTRY)

PAL = {
    'cream': '#f5e6c8', 'stucco': '#f1c28c', 'terracotta': '#d9825b', 'clay': '#c4643f', 'tile': '#a94a32',
    'teal': '#2e8b73', 'blue': '#4e8ab8', 'gold': '#f2c14e', 'marigold': '#f2a93b', 'leaf': '#3f9b4f',
    'bloom': '#e8487a', 'plum': '#3a2842',
}

def lin(h):
    h = h.lstrip('#'); out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)

MATS = {}
def mat(key, finish='matte'):
    """finish: 'matte' (stucco, clay, painted wood, leaves), 'glaze' (talavera tiles), 'gloss' (gold trim), 'flame' (candle flame)."""
    tag = (key, finish)
    if tag in MATS: return MATS[tag]
    m = bpy.data.materials.new(f'CK {finish} {key} {PAL[key]}'); m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = lin(PAL[key])
    if finish == 'glaze':
        bs.inputs['Roughness'].default_value = 0.34; bs.inputs['Specular IOR Level'].default_value = 0.5
    elif finish == 'gloss':
        bs.inputs['Roughness'].default_value = 0.28; bs.inputs['Specular IOR Level'].default_value = 0.6
        bs.inputs['Emission Color'].default_value = lin(PAL[key]); bs.inputs['Emission Strength'].default_value = 0.18
    elif finish == 'flame':
        bs.inputs['Roughness'].default_value = 0.5
        bs.inputs['Emission Color'].default_value = lin(PAL[key]); bs.inputs['Emission Strength'].default_value = 1.4
    else:
        bs.inputs['Roughness'].default_value = 0.78; bs.inputs['Specular IOR Level'].default_value = 0.2
    m.diffuse_color = lin(PAL[key]); m['palette_hex'] = PAL[key]; m['finish'] = finish
    MATS[tag] = m; return m

PARTS = []
CUR = {'prop': None}
def link(name, data, key, finish='matte', smooth=True):
    coll = bpy.data.collections['CK ' + CUR['prop']]
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

def rbox(name, center, size, key, rotz=0.0, bev=0.02, seg=3, finish='matte'):
    me = bpy.data.meshes.new(name); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bm.to_mesh(me); bm.free()
    for v in me.vertices: v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    ob = link(name, me, key, finish); ob.location = center; ob.rotation_euler = (0, 0, rotz)
    if bev: bevel(ob, bev, seg)
    return wnormals(ob)

def box_span(name, x0, x1, y0, y1, z0, z1, key, bev=0.015, seg=3, finish='matte'):
    return rbox(name, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), (x1 - x0, y1 - y0, z1 - z0), key, bev=bev, seg=seg, finish=finish)

def cyl(name, loc, r1, r2, depth, key, rot=(0, 0, 0), seg=40, bev=0.006, finish='matte'):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r1, radius2=r2, depth=depth)
    bm.to_mesh(me); bm.free()
    ob = link(name, me, key, finish); ob.location = loc; ob.rotation_euler = rot
    if bev: bevel(ob, bev, 3)
    return wnormals(ob)

def along(ob, a, b):
    a = Vector(a); b = Vector(b); ob.location = (a + b) / 2
    ob.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler(); return ob

def rod(name, a, b, r1, r2, key, seg=16, bev=0.0, finish='matte'):
    return along(cyl(name, (0, 0, 0), r1, r2, (Vector(b) - Vector(a)).length, key, seg=seg, bev=bev, finish=finish), a, b)

def ellipsoid(name, loc, s, key, rot=(0, 0, 0), seg=32, rings=16, finish='matte'):
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

def dedupe(pts, eps=1e-6):
    out = []
    for p in pts:
        if not out or (abs(p[0] - out[-1][0]) > eps or abs(p[1] - out[-1][1]) > eps): out.append(p)
    if len(out) > 2 and abs(out[0][0] - out[-1][0]) <= eps and abs(out[0][1] - out[-1][1]) <= eps: out.pop()
    return out

def add_prism(bm, pts, y0, y1, M=None):
    pts = dedupe(pts); M = M or Matrix.Identity(4)
    fr = [bm.verts.new(M @ Vector((x, y0, z))) for x, z in pts]; bk = [bm.verts.new(M @ Vector((x, y1, z))) for x, z in pts]
    n = len(pts); bm.faces.new(fr); bm.faces.new(list(reversed(bk)))
    for i in range(n):
        j = (i + 1) % n; bm.faces.new((fr[i], fr[j], bk[j], bk[i]))

def finish_bm(name, bm, key, finish='matte', smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    return link(name, me, key, finish, smooth=smooth)

def slab(name, pts, y0, y1, key, M=None, bev=0.0, seg=3, finish='matte'):
    """Closed prism: 2-D outline pts[(x, z)] (any winding, may be concave) extruded along local Y from y0 to y1."""
    bm = bmesh.new(); add_prism(bm, pts, y0, y1, M)
    ob = finish_bm(name, bm, key, finish)
    if bev: bevel(ob, bev, seg)
    return wnormals(ob)

def decals(name, items, thick, key, finish='glaze', ink=False):
    """Many raised flat shapes in one mesh. items: (pts[(u, v)], surface normal, centre ON the surface, up).
    Each stands proud of its surface along the normal by `thick` (u right, v up as seen facing the surface)."""
    if not items: return None
    bm = bmesh.new()
    for pts, n, c, up in items:
        add_prism(bm, list(pts), -thick, 0.0, frame(-Vector(n), up, Vector(c)))
    ob = finish_bm(name, bm, key, finish, smooth=False)
    return ob if ink else no_ink(ob)

def balls(name, items, key, seg=10, rings=6, finish='matte', ink=False):
    """Many small ellipsoids in one mesh. items: (centre, (rx, ry, rz))."""
    bm = bmesh.new()
    for c, s in items:
        M = Matrix.Translation(Vector(c)) @ Matrix.Diagonal((s[0], s[1], s[2], 1.0))
        bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0, matrix=M)
    ob = finish_bm(name, bm, key, finish)
    return ob if ink else no_ink(ob)

def leaves(name, items, key='leaf', ink=False):
    """Flattened ellipsoid leaves in one mesh. items: (centre, direction along the leaf, up hint, length, width, thickness)."""
    bm = bmesh.new()
    for c, d, up, L, w, t in items:
        M = frame(d, up, c) @ Matrix.Diagonal((w / 2, L / 2, t / 2, 1.0))
        bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=5, radius=1.0, matrix=M)
    ob = finish_bm(name, bm, key)
    return ob if ink else no_ink(ob)

def cones(name, items, key, seg=16, finish='matte', ink=True):
    """Many cylinders in one mesh. items: (a, b, r) as end points and radius."""
    bm = bmesh.new()
    for a, b, r in items:
        a = Vector(a); b = Vector(b); L = (b - a).length
        M = Matrix.Translation((a + b) / 2) @ (b - a).to_track_quat('Z', 'Y').to_matrix().to_4x4()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r, depth=L, matrix=M)
    ob = finish_bm(name, bm, key, finish)
    return ob if ink else no_ink(ob)

def lathe(name, prof, key, seg=48, finish='matte', closed=False):
    """Revolve a profile [(r, z)] about Z. r == 0 points close a pole; closed=True joins the last ring to the first."""
    bm = bmesh.new(); rings = []
    for r, z in prof:
        if r < 1e-6: rings.append([bm.verts.new((0, 0, z))])
        else: rings.append([bm.verts.new((r * math.cos(math.tau * i / seg), r * math.sin(math.tau * i / seg), z)) for i in range(seg)])
    pairs = list(zip(rings, rings[1:])) + ([(rings[-1], rings[0])] if closed else [])
    for a, b in pairs:
        if len(a) == 1 and len(b) == 1: continue
        if len(a) == 1:
            for i in range(seg): bm.faces.new((a[0], b[i], b[(i + 1) % seg]))
        elif len(b) == 1:
            for i in range(seg): bm.faces.new((a[i], a[(i + 1) % seg], b[0]))
        else:
            for i in range(seg): bm.faces.new((a[i], a[(i + 1) % seg], b[(i + 1) % seg], b[i]))
    return finish_bm(name, bm, key, finish)

def sweep(name, pts, r, key, n=16, closed=False, finish='matte'):
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

# --- 2-D outline helpers (x right, z up) ------------------------------------------------------------------------------
def arc(cx, cz, rx, rz, a0, a1, n):
    return [(cx + rx * math.cos(a0 + (a1 - a0) * i / n), cz + rz * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]

def rrect(x0, x1, z0, z1, r, n=6):
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

def circle(r, n=24, cx=0.0, cz=0.0):
    return [(cx + r * math.cos(math.tau * i / n), cz + r * math.sin(math.tau * i / n)) for i in range(n)]

def diamond(w, h):
    return soften([(0, h / 2), (-w / 2, 0), (0, -h / 2), (w / 2, 0)], 0.18, 3)

def arch_outline(x0, x1, z0, spring, rz, n=24):
    """A solid round-headed opening: straight jambs from z0 up to the spring line, then a half-ellipse head."""
    cx = (x0 + x1) / 2; rx = (x1 - x0) / 2
    return [(x0, z0), (x1, z0)] + arc(cx, spring, rx, rz, 0, math.pi, n)

def arch_ring(out_x, in_x, z0, spring, out_rz, in_rz, n=24):
    """Inverted-U surround (outer half-width out_x, inner in_x) with elliptic heads, as one concave outline."""
    return ([(-out_x, z0)] + arc(0, spring, out_x, out_rz, math.pi, 0, n) + [(out_x, z0), (in_x, z0)]
            + arc(0, spring, in_x, in_rz, 0, math.pi, n) + [(-in_x, z0)])

# --- talavera tiles --------------------------------------------------------------------------------------------------
class Tiles:
    """Collects glazed tiles (square base + motif) and emits them as a few merged meshes per colour."""
    def __init__(self, tag):
        self.tag = tag; self.base = {}; self.motif = {}
    def add(self, centre, size, pattern, n=(0, -1, 0), up=(0, 0, 1), base_t=0.012):
        n = Vector(n).normalized(); c = Vector(centre); s = size / 2
        sq = rrect(-s, s, -s, s, s * 0.14, 3)
        top = c + n * base_t
        if pattern == 'A':          # cream tile, blue diamond, gold centre
            self.base.setdefault('cream', []).append((sq, n, c, up))
            self.motif.setdefault('blue', []).append((diamond(size * 0.62, size * 0.62), n, top, up))
            self.motif.setdefault('gold', []).append((circle(size * 0.1, 12), n, top + n * 0.004, up))
        else:                       # blue tile, four cream petals, gold centre
            self.base.setdefault('blue', []).append((sq, n, c, up))
            for dx, dz in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
                self.motif.setdefault('cream', []).append((circle(size * 0.13, 12, dx * size * 0.2, dz * size * 0.2), n, top, up))
            self.motif.setdefault('gold', []).append((circle(size * 0.1, 12), n, top + n * 0.004, up))
    def emit(self):
        for k, items in self.base.items(): decals(f'{self.tag} tiles {k}', items, 0.012, k, ink=True)
        for k, items in self.motif.items(): decals(f'{self.tag} tile motifs {k}', items, 0.004, k)

# --- butterflies -----------------------------------------------------------------------------------------------------
FOREWING = soften([(0.04, 0.02), (0.20, 0.34), (0.52, 0.58), (0.98, 0.66), (0.90, 0.40), (0.74, 0.14), (0.40, 0.0)], 0.2, 3)
HINDWING = soften([(0.04, -0.02), (0.44, -0.02), (0.70, -0.16), (0.64, -0.42), (0.40, -0.56), (0.18, -0.50), (0.05, -0.24)], 0.3, 3)
BORDER_DOTS = [(0.90, 0.60, 0.035), (0.87, 0.47, 0.03), (0.80, 0.33, 0.028), (0.64, -0.24, 0.03), (0.54, -0.42, 0.03)]

def inset(pts, f):
    cx = sum(p[0] for p in pts) / len(pts); cz = sum(p[1] for p in pts) / len(pts)
    return [(cx + (x - cx) * f, cz + (z - cz) * f) for x, z in pts]

def butterfly(tag, centre, span, wing='gold', edge='plum', facing=(0, -1, 0), up=(0, 0, 1), dihedral=0.0, t=0.01, spots='cream'):
    """An original storybook butterfly: plum-edged wings (upper and lower lobes), cream spots and a plum body.
    Wings rotate back from the viewer by `dihedral` about the body axis. Returns nothing (parts are linked)."""
    hs = span / 2; F = frame(-Vector(facing), up, Vector(centre))
    bm_e = bmesh.new(); bm_w = bmesh.new(); bm_s = bmesh.new()
    for s in (1, -1):
        M = F @ Matrix.Rotation(s * dihedral, 4, 'Z')
        for wing_pts, f in ((FOREWING, 0.74), (HINDWING, 0.7)):
            add_prism(bm_e, [(s * u * hs, v * hs) for u, v in wing_pts], -t, 0.0, M)
            add_prism(bm_w, [(s * u * hs, v * hs) for u, v in inset(wing_pts, f)], -1.8 * t, -t, M)
        for cu, cv, rr in BORDER_DOTS:
            add_prism(bm_s, circle(rr * hs, 10, s * cu * hs, cv * hs), -1.6 * t, -t, M)
    finish_bm(f'{tag} wing edges', bm_e, edge, smooth=False)
    no_ink(finish_bm(f'{tag} wings', bm_w, wing, smooth=False))
    no_ink(finish_bm(f'{tag} wing spots', bm_s, spots, smooth=False))
    fwd = -Vector(facing).normalized(); U = Vector(up).normalized(); C = Vector(centre)
    body_c = C - fwd * 1.2 * t
    M = frame(U, -fwd, body_c) @ Matrix.Diagonal((0.075 * hs, 0.33 * hs, 0.075 * hs, 1.0))
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=1.0, matrix=M)
    head = body_c + U * 0.38 * hs
    bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=0.085 * hs, matrix=Matrix.Translation(head))
    X = U.cross(fwd).normalized()
    for sx in (1, -1):
        tip = head + U * 0.24 * hs + X * sx * 0.16 * hs
        a = head; b = tip; L = (b - a).length
        Mr = Matrix.Translation((a + b) / 2) @ (b - a).to_track_quat('Z', 'Y').to_matrix().to_4x4()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=6, radius1=0.014 * hs, radius2=0.014 * hs, depth=L, matrix=Mr)
        bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=5, radius=0.035 * hs, matrix=Matrix.Translation(tip))
    finish_bm(f'{tag} body', bm, 'plum')

def candle(tag, base, r, h, flame=1.0):
    """Cream wax candle with a gold flame (flame height scales with r)."""
    x, y, z = base
    cyl(f'{tag} wax', (x, y, z + h / 2), r, r * 0.96, h, 'cream', seg=20, bev=0.004)
    rod(f'{tag} wick', (x, y, z + h), (x, y, z + h + 0.02), 0.005, 0.005, 'plum', seg=6)
    ellipsoid(f'{tag} flame', (x, y, z + h + 0.02 + r * 1.05 * flame), (r * 0.6 * flame, r * 0.6 * flame, r * 1.15 * flame), 'gold',
              seg=16, rings=10, finish='flame')

def niche(tag, cx, face_y, z0, half_w, spring, frame_w, sill_depth, candles):
    """A candle niche on a vertical front face at y = face_y: plum arch backing, cream surround, cream sill, candles."""
    slab(f'{tag} niche backing', arch_outline(cx - half_w, cx + half_w, z0, spring, half_w), face_y - 0.006, face_y + 0.004, 'plum')
    pts = [(x + cx, z) for x, z in arch_ring(half_w + frame_w, half_w, z0, spring, half_w + frame_w, half_w, 20)]
    slab(f'{tag} niche surround', pts, face_y - 0.03, face_y + 0.004, 'cream', bev=0.006)
    box_span(f'{tag} niche sill', cx - half_w - frame_w - 0.03, cx + half_w + frame_w + 0.03, face_y - sill_depth, face_y + 0.01,
             z0 - 0.06, z0, 'cream', bev=0.01)
    for i, (dx, r, h) in enumerate(candles):
        candle(f'{tag} candle {i + 1}', (cx + dx, face_y - sill_depth / 2, z0), r, h)

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
    c = bpy.data.collections.new('CK ' + prop); bpy.data.collections[MASTER].children.link(c)

def bougainvillea(tag, path, rng, lean=(0, -1, 0), leaf_len=0.075, bloom_r=0.036, per=(4, 3), stem_r=0.016, y_min=None, z_max=None, bloom='bloom'):
    """A magenta bougainvillea sprig: a stem along `path`, leaf clusters and paper-bract blooms around each point."""
    sweep(f'{tag} stem', path, stem_r, 'leaf', n=8)
    L = []; B = []
    for p in path:
        p = Vector(p)
        for _ in range(per[0]):
            d = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1) * 0.5 + lean[1] * 0.3, rng.uniform(-1, 1))).normalized()
            c = p + d * leaf_len * 0.6
            if y_min is not None: c.y = max(c.y, y_min + leaf_len * 0.5)
            if z_max is not None: c.z = min(c.z, z_max - leaf_len * 0.5)
            L.append((tuple(c), tuple(d), (0, -1, 0.3), leaf_len, leaf_len * 0.55, 0.018))
        for _ in range(per[1]):
            o = Vector((rng.uniform(-1, 1), rng.uniform(-0.6, 0.2), rng.uniform(-1, 1))).normalized() * rng.uniform(0.025, 0.075)
            c = p + o
            rr = bloom_r * rng.uniform(0.8, 1.15)
            if y_min is not None: c.y = max(c.y, y_min + rr)
            if z_max is not None: c.z = min(c.z, z_max - rr)
            B.append((tuple(c), (rr, rr * 0.9, rr)))
    leaves(f'{tag} leaves', L); balls(f'{tag} blooms', B, bloom, seg=8, rings=5)

# =====================================================================================================================
# 1. casita-terrace-wall: a stucco garden terrace wall with a clay-tile coping, a talavera band, candle niches, a
#    butterfly relief and a bougainvillea cascade. Tiles end to end: its end pilasters are flush with x = +/-2.40.
# =====================================================================================================================
W_HX = 2.40; W_FRONT = -0.20; W_BACK = 0.30; PIL_IN = 2.06

def build_wall():
    begin('casita-terrace-wall')
    box_span('Zocalo base band', -2.15, 2.15, -0.24, W_BACK, 0.0, 0.42, 'teal', bev=0.02)
    box_span('Zocalo cream moulding', -2.15, 2.15, -0.25, -0.18, 0.405, 0.455, 'cream', bev=0.012)
    box_span('Stucco body', -2.15, 2.15, W_FRONT, W_BACK, 0.42, 1.72, 'terracotta', bev=0.012)
    for s, side in ((1, 'right'), (-1, 'left')):
        lo, hi = sorted((s * PIL_IN, s * W_HX))
        box_span(f'End pilaster {side}', lo, hi, -0.30, 0.32, 0.44, 1.82, 'stucco', bev=0.018)
        lo2, hi2 = sorted((s * 2.04, s * W_HX))
        box_span(f'End pilaster base {side}', lo2, hi2, -0.32, 0.33, 0.0, 0.46, 'teal', bev=0.018)
        lo3, hi3 = sorted((s * 2.02, s * W_HX))
        box_span(f'End pilaster cap {side}', lo3, hi3, -0.33, 0.34, 1.82, 1.90, 'cream', bev=0.014)
        box_span(f'Finial plinth {side}', s * 2.23 - 0.10, s * 2.23 + 0.10, -0.11, 0.11, 1.90, 1.94, 'cream', bev=0.01)
        ellipsoid(f'Finial ball {side}', (s * 2.23, 0.0, 1.92), (0.08, 0.08, 0.08), 'clay', seg=24, rings=12)
    box_span('Coping cap', -PIL_IN, PIL_IN, -0.27, 0.32, 1.72, 1.795, 'cream', bev=0.012)
    xs = [-1.96 + i * 0.196 for i in range(21)]
    cones('Barrel coping tiles (red)', [((x, -0.245, 1.79), (x, 0.31, 1.79), 0.075) for i, x in enumerate(xs) if i % 2 == 0], 'tile')
    cones('Barrel coping tiles (clay)', [((x, -0.245, 1.79), (x, 0.31, 1.79), 0.075) for i, x in enumerate(xs) if i % 2 == 1], 'clay')
    # talavera band under the coping, framed by two thin blue lines
    tiles = Tiles('Talavera band')
    for i, x in enumerate(xs):
        tiles.add((x, W_FRONT, 1.55), 0.17, 'A' if i % 2 == 0 else 'B')
    tiles.emit()
    for z in (1.445, 1.655):
        box_span(f'Band line z{z:.2f}', -PIL_IN, PIL_IN, W_FRONT - 0.012, W_FRONT + 0.01, z - 0.01, z + 0.01, 'blue', bev=0.0, finish='glaze')
    # two candle niches and the centre butterfly relief
    for s, side in ((-1, 'left'), (1, 'right')):
        niche(f'Niche {side}', s * 1.05, W_FRONT, 0.66, 0.20, 1.02, 0.08, 0.10,
              [(0.0, 0.052, 0.24), (-0.11, 0.038, 0.14), (0.11, 0.038, 0.17)])
    butterfly('Wall butterfly relief', (0.0, W_FRONT - 0.004, 0.98), 0.50, wing='gold', t=0.01)
    # bougainvillea: along the coping from the left pilaster, then cascading down the front face
    rng = random.Random(11)
    top = [(-2.0 + 0.075 * i, 0.04 - 0.03 * i, 1.895) for i in range(12)]
    bougainvillea('Bougainvillea over the coping', top, rng, leaf_len=0.085, bloom_r=0.036, per=(6, 4), z_max=1.99, y_min=-0.345)
    for k, (x0, n, sway) in enumerate(((-1.92, 11, 0.04), (-1.66, 14, 0.06), (-1.40, 8, 0.05))):
        strand = [(x0 + 0.018 * i + sway * math.sin(i * 0.8 + k), -0.27, 1.84 - 0.062 * i) for i in range(n)]
        bougainvillea(f'Bougainvillea strand {k + 1}', strand, rng, leaf_len=0.09, bloom_r=0.037, per=(6, 4), y_min=-0.345)

# =====================================================================================================================
# 2. flower-planter: a round terracotta pot with a talavera band, overflowing with marigolds and pink blooms
# =====================================================================================================================
POT = [(0.0, 0.0), (0.40, 0.0), (0.425, 0.015), (0.425, 0.06), (0.405, 0.08), (0.47, 0.17), (0.532, 0.24), (0.55, 0.27),
       (0.55, 0.41), (0.537, 0.455), (0.515, 0.495), (0.51, 0.505), (0.555, 0.515), (0.585, 0.54), (0.59, 0.57), (0.578, 0.60),
       (0.55, 0.612), (0.50, 0.61), (0.485, 0.59), (0.475, 0.55), (0.0, 0.55)]
OUTER = POT[4:12]
BAND_Z0, BAND_Z1 = 0.272, 0.408

def pot_r(z):
    for (r0, z0), (r1, z1) in zip(OUTER, OUTER[1:]):
        if z0 <= z <= z1: return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    raise ValueError(z)

def build_planter():
    begin('flower-planter')
    lathe('Terracotta pot', POT, 'clay', seg=48)
    zs = [BAND_Z0 + (BAND_Z1 - BAND_Z0) * i / 6 for i in range(7)]
    band = [(pot_r(z) + 0.007, z) for z in zs] + [(pot_r(z) - 0.03, z) for z in reversed(zs)]
    lathe('Talavera band', band, 'cream', seg=48, finish='glaze', closed=True)
    for z in (BAND_Z0, BAND_Z1):
        R = pot_r(z) + 0.009
        sweep(f'Band ring z{z:.2f}', [(R * math.cos(math.tau * i / 48), R * math.sin(math.tau * i / 48), z) for i in range(48)], 0.008,
              'blue', n=8, closed=True, finish='glaze')
    di = []; dots = []
    for i in range(8):
        th = -math.pi / 2 + i * math.tau / 8; n = Vector((math.cos(th), math.sin(th), 0))
        di.append((diamond(0.085, 0.11), n, n * (0.55 + 0.006) + Vector((0, 0, 0.34)), (0, 0, 1)))
        th2 = th + math.tau / 16; n2 = Vector((math.cos(th2), math.sin(th2), 0))
        dots.append((circle(0.022, 12), n2, n2 * (0.55 + 0.006) + Vector((0, 0, 0.34)), (0, 0, 1)))
    decals('Band diamonds', di, 0.004, 'blue'); decals('Band dots', dots, 0.004, 'gold')
    # foliage mound with lumps
    half_ellipsoid('Foliage mound', (0, 0, 0.53), (0.50, 0.50, 0.21), 'leaf')
    lumps = [((0.36 * math.cos(a), 0.36 * math.sin(a), 0.62), (0.13, 0.13, 0.1)) for a in [i * math.tau / 9 + 0.2 for i in range(9)]]
    balls('Foliage lumps', lumps, 'leaf', seg=14, rings=8, ink=True)
    rng = random.Random(5)
    rim = []
    for i in range(12):
        th = i * math.tau / 12 + rng.uniform(-0.1, 0.1); d = Vector((math.cos(th) * 0.78, math.sin(th) * 0.78, -0.62))
        c = Vector((math.cos(th) * 0.52, math.sin(th) * 0.52, 0.60))
        rim.append((tuple(c), tuple(d), (0, 0, 1), 0.14, 0.075, 0.02))
    leaves('Leaves over the rim', rim, ink=True)
    def mound_z(rho): return 0.53 + 0.21 * math.sqrt(max(0.0, 1 - (rho / 0.5) ** 2))
    mari = []; pink = []; centres = []
    # a golden-angle spiral of 24 flower heads, marigolds and pink blooms alternating
    spots = [(0.44 * math.sqrt((i + 0.5) / 24), 0.9 + i * 2.39996, 'm' if i % 2 == 0 else 'p') for i in range(24)]
    for rho, a, kind in spots:
        p = (rho * math.cos(a), rho * math.sin(a), max(mound_z(rho), 0.72 if rho > 0.3 else 0.0) + 0.02)
        if kind == 'm': mari.append((p, (0.064, 0.064, 0.054)))
        else: pink.append((p, 0.07))
    stems = [(0.20, 0.6, 'p'), (0.26, 2.4, 'm'), (0.12, 3.9, 'p'), (0.24, 5.4, 'm')]
    rods = []
    for rho, a, kind in stems:
        base = (rho * math.cos(a), rho * math.sin(a), mound_z(rho) - 0.02); head = (base[0] * 1.08, base[1] * 1.08, 0.838)
        rods.append((base, head, 0.009))
        if kind == 'm': mari.append((head, (0.062, 0.062, 0.055)))
        else: pink.append(((head[0], head[1], head[2] + 0.02), 0.066))
    cones('Tall flower stems', rods, 'leaf', seg=6)
    balls('Marigold pompoms', mari, 'marigold', seg=14, rings=8, ink=True)
    petals = []
    for c, r in pink:
        c = Vector(c); nrm = Vector((c.x * 1.6, c.y * 1.6, 1.0)).normalized()
        F = frame(nrm, (0, 0, 1) if abs(nrm.z) < 0.99 else (0, 1, 0), c)
        for k in range(5):
            a = math.tau * k / 5; d = (F.to_3x3() @ Vector((math.cos(a), 0, math.sin(a)))).normalized()
            petals.append((tuple(c + d * r * 0.5), tuple(d), tuple(nrm), r * 0.62, r * 0.5, r * 0.16))
        centres.append((tuple(c + nrm * r * 0.08), (r * 0.26, r * 0.26, r * 0.26)))
    leaves('Pink bloom petals', petals, key='bloom', ink=True)
    balls('Bloom centres', centres, 'gold', seg=10, rings=6)
    butterfly('Planter butterfly', (0.14, -0.30, 0.83), 0.20, wing='gold', facing=(0.35, -1, 0.25), dihedral=math.radians(35), t=0.006)

# =====================================================================================================================
# 3. patterned-door: an arched casita double door, teal with cream folk-pattern panels, a gold glow trim and a golden
#    transom sunburst with a butterfly, in a stucco surround bordered with talavera tiles, on a clay step
# =====================================================================================================================
D_OUT, D_IN, D_SPRING, D_OUT_RZ, D_IN_RZ = 0.80, 0.56, 1.80, 0.60, 0.44
D_FRONT = -0.14

def build_door():
    begin('patterned-door')
    box_span('Clay step', -0.66, 0.66, -0.20, 0.16, 0.0, 0.10, 'clay', bev=0.014)
    slab('Stucco surround', arch_ring(D_OUT, D_IN, 0.0, D_SPRING, D_OUT_RZ, D_IN_RZ, 28), D_FRONT, 0.20, 'stucco', bev=0.012)
    LX = 0.555; LRZ = 0.435
    slab('Opening backing', arch_outline(-D_IN - 0.01, D_IN + 0.01, 0.10, D_SPRING, D_IN_RZ + 0.01), 0.155, 0.19, 'plum')
    for s, side in ((-1, 'left'), (1, 'right')):
        head = arc(0, D_SPRING, LX, LRZ, math.pi / 2, math.pi, 16)
        head[0] = (-0.006, head[0][1])
        pts = [(-LX, 0.10), (-0.006, 0.10)] + head
        pts = [(s * -x, z) for x, z in pts] if s > 0 else pts
        slab(f'Door leaf {side}', pts, -0.08, 0.16, 'teal', bev=0.006)
        x0, x1 = sorted((s * 0.09, s * 0.47))
        slab(f'Lower panel {side}', rrect(x0, x1, 0.24, 0.78, 0.04), -0.10, -0.08, 'cream', bev=0.004)
        slab(f'Upper panel {side}', rrect(x0, x1, 0.92, 1.70, 0.04), -0.10, -0.08, 'cream', bev=0.004)
        cx = s * 0.28; n = (0, -1, 0); up = (0, 0, 1)
        petals = [(circle(0.05, 14, cx + 0.085 * math.cos(a), 0.51 + 0.085 * math.sin(a)), n, (0, -0.10, 0), up)
                  for a in [math.pi / 2 + k * math.tau / 6 for k in range(6)]]
        decals(f'Rosette petals {side}', [(p, n, c, up) for p, n, c, up in petals], 0.005, 'bloom')
        decals(f'Rosette centre {side}', [(circle(0.04, 16, cx, 0.51), n, (0, -0.105, 0), up)], 0.005, 'gold')
        decals(f'Lattice diamonds {side}', [(diamond(0.15, 0.21), n, (cx, -0.10, z), up) for z in (1.08, 1.31, 1.54)], 0.005, 'blue')
        decals(f'Lattice dots {side}', [(circle(0.022, 12), n, (cx + dx, -0.10, z), up)
                                        for z, dx in ((1.195, 0), (1.425, 0), (1.08, 0.12), (1.08, -0.12), (1.31, 0.12), (1.31, -0.12),
                                                      (1.54, 0.12), (1.54, -0.12))], 0.005, 'gold')
        # ring pull on each leaf beside the seam
        px = s * 0.075
        decals(f'Pull plate {side}', [(circle(0.034, 16), n, (px, -0.08, 1.06), up)], 0.008, 'gold', finish='gloss', ink=True)
        sweep(f'Ring pull {side}', [(px + 0.042 * math.sin(math.tau * i / 24), -0.095, 1.018 + 0.042 * math.cos(math.tau * i / 24))
                                   for i in range(24)], 0.009, 'gold', n=8, closed=True, finish='gloss')
    box_span('Gold seam astragal', -0.016, 0.016, -0.095, -0.075, 0.12, D_SPRING + 0.05, 'gold', bev=0.004, finish='gloss')
    rays = []
    for k in range(7):
        a = math.radians(12 + k * 26); c, sn = math.cos(a), math.sin(a); tx, tz = -sn, c
        r0, r1, w0, w1 = 0.07, 0.36, 0.012, 0.036
        pts = [(r0 * c - w0 * tx, D_SPRING + 0.03 + r0 * sn - w0 * tz), (r1 * c - w1 * tx, D_SPRING + 0.03 + r1 * sn - w1 * tz),
               (r1 * c + w1 * tx, D_SPRING + 0.03 + r1 * sn + w1 * tz), (r0 * c + w0 * tx, D_SPRING + 0.03 + r0 * sn + w0 * tz)]
        rays.append((pts, (0, -1, 0), (0, -0.08, 0), (0, 0, 1)))
    decals('Transom sunburst rays', rays, 0.012, 'gold', finish='gloss', ink=True)
    butterfly('Transom butterfly', (0.0, -0.096, 1.99), 0.30, wing='marigold', t=0.008)
    # glowing gold trim round the opening
    trim = [(-D_IN, D_FRONT - 0.004, 0.10 + 0.05 * i) for i in range(35)] + \
           [(D_IN * math.cos(math.pi - math.pi * i / 32), D_FRONT - 0.004, D_SPRING + D_IN_RZ * math.sin(math.pi - math.pi * i / 32)) for i in range(1, 32)] + \
           [(D_IN, D_FRONT - 0.004, D_SPRING - 0.05 * i) for i in range(35)]
    sweep('Glow trim', trim, 0.021, 'gold', n=10, finish='gloss')
    tiles = Tiles('Door surround')
    for s in (-1, 1):
        for i in range(11):
            tiles.add((s * 0.68, D_FRONT, 0.22 + 0.15 * i), 0.13, 'A' if (i + (s > 0)) % 2 == 0 else 'B')
    RMX, RMZ = (D_OUT + D_IN) / 2, (D_OUT_RZ + D_IN_RZ) / 2
    for k, deg in enumerate((28, 59, 90, 121, 152)):
        t = math.radians(deg); cx, cz = RMX * math.cos(t), D_SPRING + RMZ * math.sin(t)
        nx, nz = math.cos(t) / RMX, math.sin(t) / RMZ; ln = math.hypot(nx, nz)
        tiles.add((cx, D_FRONT, cz), 0.11, 'B' if deg == 90 else 'A', up=(nx / ln, 0, nz / ln))
    tiles.emit()

# =====================================================================================================================
# 4. butterfly-arch: two tiled stucco posts with candle niches and cap candles, a leafy flowering vine arch, and a
#    golden butterfly at the crown with smaller butterflies round it (backdrop only)
# =====================================================================================================================
A_PX = 1.44; A_PW = 0.48; A_CAP = 2.16; V_X = 1.30; V_RZ = 0.84

def build_arch():
    begin('butterfly-arch')
    tiles = Tiles('Arch posts')
    for s, side in ((-1, 'left'), (1, 'right')):
        cx = s * A_PX
        box_span(f'Post base {side}', cx - 0.27, cx + 0.27, -0.27, 0.27, 0.0, 0.40, 'teal', bev=0.018)
        box_span(f'Post shaft {side}', cx - A_PW / 2, cx + A_PW / 2, -0.24, 0.24, 0.40, 1.98, 'stucco', bev=0.014)
        box_span(f'Post capital band {side}', cx - 0.26, cx + 0.26, -0.26, 0.26, 1.98, 2.06, 'clay', bev=0.01)
        box_span(f'Post cap {side}', cx - 0.29, cx + 0.29, -0.29, 0.29, 2.06, A_CAP, 'cream', bev=0.014)
        for face_y, n in ((-0.24, (0, -1, 0)), (0.24, (0, 1, 0))):
            for j, z in enumerate((0.60, 0.77, 0.94)):
                for i, dx in enumerate((-0.085, 0.085)):
                    tiles.add((cx + dx, face_y, z), 0.15, 'A' if (i + j) % 2 == 0 else 'B', n=n)
        niche(f'Post niche {side}', cx, -0.24, 1.18, 0.12, 1.52, 0.06, 0.05, [(0.0, 0.032, 0.18)])
        ccx = s * 1.58
        cyl(f'Cap candle dish {side}', (ccx, 0.0, A_CAP + 0.015), 0.085, 0.085, 0.03, 'gold', seg=24, finish='gloss')
        candle(f'Cap candle {side}', (ccx, 0.0, A_CAP + 0.03), 0.06, 0.22)
    tiles.emit()
    rng = random.Random(23)
    for s, side, bloom in ((-1, 'left', 'bloom'), (1, 'right', 'marigold')):
        c0 = Vector((s * 1.04, -0.12, 0.14)); L = []; B = []
        for k in range(22):
            d = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.4, 1))).normalized()
            c = c0 + Vector((d.x * 0.10, d.y * 0.08, d.z * 0.09))
            L.append((tuple(c), tuple(d), (0, -1, 0.3), 0.11, 0.06, 0.02))
        for k in range(6):
            a = math.tau * k / 6 + 0.3
            B.append(((c0.x + 0.08 * math.cos(a), -0.19, 0.2 + 0.05 * math.sin(a)), (0.045, 0.04, 0.045)))
        leaves(f'Foot bush leaves {side}', L, ink=True); balls(f'Foot bush blooms {side}', B, bloom, seg=12, rings=7, ink=True)
    # the vine arch
    N = 48
    main = [(V_X * math.cos(math.pi * i / N), 0.0, A_CAP + V_RZ * math.sin(math.pi * i / N)) for i in range(N + 1)]
    sweep('Vine arch', main, 0.08, 'leaf', n=14)
    helix = []
    for i in range(241):
        t = math.pi * i / 240; p = Vector((V_X * math.cos(t), 0.0, A_CAP + V_RZ * math.sin(t)))
        nrm = Vector((math.cos(t) / V_X, 0, math.sin(t) / V_RZ)).normalized(); ph = 11 * t * 2
        helix.append(tuple(p + nrm * 0.085 * math.sin(ph) + Vector((0, 0.085 * math.cos(ph), 0))))
    sweep('Twisting tendril', helix, 0.026, 'leaf', n=8)
    L = []; mari = []; pink = []
    for i in range(30):
        t = math.pi * (i + 0.5) / 30; p = Vector((V_X * math.cos(t), 0.0, A_CAP + V_RZ * math.sin(t)))
        nrm = Vector((math.cos(t) / V_X, 0, math.sin(t) / V_RZ)).normalized(); tan = Vector((-math.sin(t) * V_X, 0, math.cos(t) * V_RZ)).normalized()
        for side in (-1, 1):
            d = (nrm * 0.6 + Vector((0, side * 0.8, 0)) + tan * rng.uniform(-0.5, 0.5)).normalized()
            L.append((tuple(p + d * 0.1), tuple(d), tuple(nrm), 0.17, 0.085, 0.02))
        if i % 3 == 0 and not 13 <= i <= 16:
            c = p + nrm * 0.08 + Vector((0, -0.08, 0))
            (mari if i % 2 == 0 else pink).append((tuple(c), (0.058, 0.05, 0.058)))
        elif i % 3 == 1 and not 13 <= i <= 16:
            for k in range(3):
                c = p + nrm * rng.uniform(0.04, 0.1) + Vector((rng.uniform(-0.05, 0.05), rng.uniform(-0.1, -0.04), rng.uniform(-0.04, 0.04)))
                pink.append((tuple(c), (0.04, 0.036, 0.04)))
    leaves('Vine leaves', L, ink=True)
    balls('Vine marigolds', mari, 'marigold', seg=12, rings=7, ink=True)
    balls('Vine blooms', pink, 'bloom', seg=10, rings=6, ink=True)
    # bougainvillea climbing the left post
    climb = [(-A_PX - 0.21 + 0.03 * math.sin(i * 1.3), -0.225, 0.44 + 0.105 * i) for i in range(16)]
    bougainvillea('Bougainvillea on the left post', climb, rng, leaf_len=0.075, bloom_r=0.034, y_min=-0.295)
    # butterflies: the golden crown butterfly and four smaller ones
    butterfly('Crown butterfly', (0.0, -0.21, 2.898), 0.90, wing='gold', dihedral=math.radians(22), t=0.014)
    butterfly('Small butterfly left', (-0.95, -0.12, 2.99), 0.30, wing='marigold', facing=(0.3, -1, 0), up=(-0.25, 0, 1),
              dihedral=math.radians(30), t=0.008)
    butterfly('Small butterfly right', (0.80, -0.10, 3.04), 0.26, wing='gold', facing=(-0.3, -1, 0), up=(0.3, 0, 1),
              dihedral=math.radians(34), t=0.008)
    butterfly('Small butterfly pink', (1.06, -0.17, 2.60), 0.22, wing='bloom', facing=(-0.2, -1, 0.1), up=(0.4, 0, 1),
              dihedral=math.radians(28), t=0.007)
    butterfly('Small butterfly blue', (-1.33, -0.17, 2.74), 0.24, wing='blue', facing=(0.2, -1, 0.1), up=(-0.35, 0, 1),
              dihedral=math.radians(28), t=0.007)

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
    build_wall(); build_planter(); build_door(); build_arch()
    for ob in PARTS: ob['work_order'] = 'WO111'; ob['asset_id'] = 'casita-kit'

if __name__ == '__main__':
    sc = bpy.context.scene
    assert sc.get('asset_id') == 'casita-kit' and sc.get('scene_lease') == 'active'
    t0 = datetime.datetime.now(datetime.timezone.utc)
    build(); bpy.context.view_layer.update()
    props = {}
    for p in PROPS:
        m, per = measure(list(bpy.data.collections['CK ' + p].objects))
        hx, hh, hz = REGISTRY[p]
        m['registry_box_blender'] = {'min': [-hx, -hz, 0.0], 'max': [hx, hz, hh]}
        m['inside_registry_box'] = (m['min'][0] >= -hx - 1e-4 and m['max'][0] <= hx + 1e-4 and m['min'][1] >= -hz - 1e-4 and m['max'][1] <= hz + 1e-4
                                    and m['min'][2] >= -1e-4 and m['max'][2] <= hh + 1e-4)
        m['gltf_bounds_y_up'] = {'min': [m['min'][0], m['min'][2], -m['max'][1]], 'max': [m['max'][0], m['max'][2], -m['min'][1]]}
        m['parts'] = len(bpy.data.collections['CK ' + p].objects); m['part_tops_m'] = per
        props[p] = m
    sc['blockout_bounds_m'] = json.dumps({p: {k: props[p][k] for k in ('min', 'max', 'size')} for p in PROPS})
    sc['orientation'] = 'Blender +Z up, prop front toward -Y; glTF +Y up, front toward +Z (theme-kit rotation 0); floor-centred origin per prop'
    path = ROOT / 'casita-kit-blockout.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(path), compress=True)
    rec = {'saved': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'props': props,
           'materials': sorted(x.name for x in bpy.data.materials), 'parts': len(PARTS),
           'build_seconds': round((datetime.datetime.now(datetime.timezone.utc) - t0).total_seconds(), 1),
           'utc': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    (ROOT / 'blockout-measurements.json').write_text(json.dumps(rec, indent=2) + '\n')
    print(json.dumps({p: {k: props[p][k] for k in ('min', 'max', 'size', 'blockout_triangles', 'inside_registry_box', 'parts')} for p in PROPS}, indent=1))
