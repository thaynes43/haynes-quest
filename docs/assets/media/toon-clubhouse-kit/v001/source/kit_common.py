"""WO111 toon-clubhouse-kit v001: static prop mesh, vertex-colour and export helpers (Blender 4.5 LTS).

Authoring axes: Blender +Z up, each prop's visible FRONT faces -Y, character-free props centred on the floor
(origin = floor centre, z = 0 is the floor). The glTF exporter's +Y-up conversion maps Blender (x, y, z) to glTF
(x, z, -y), so the front ends up toward glTF +Z: the theme-kit registry's "+Z toward the player at rotation 0".

Colour: one sRGB byte colour attribute ('Col', exported as COLOR_0) multiplies white matte / satin / foliage
materials. Each vertex carries base colour x low-frequency pigment mottling x ray-traced soft occlusion (BVH, 40
cosine rays against the prop and the floor) tinted toward a muted plum-blue shadow. No textures, images, fonts,
external assets or add-on changes. Adapted in spirit from the WO097 Rat Casino kit (vertex-tinted static props)
and the WO111 yes-yes-veggie baked-occlusion pass.
"""
import bpy, bmesh, math, zlib
from mathutils import Vector, Matrix, noise
from mathutils.bvhtree import BVHTree
from mathutils.geometry import tessellate_polygon

PARTS = []
COLLS = {}
MATS = {}
MAT_SPECS = {  # key: (material name, roughness); specular stays at the glTF default so no extension is emitted
    'matte': ('Clubhouse matte clay paint', 0.80),
    'satin': ('Clubhouse satin glaze', 0.50),
    'foliage': ('Clubhouse soft foliage', 0.93),
}
SHADOW_TINT = Vector((0.50, 0.46, 0.64))   # occluded light leans plum-blue, never black


def srgb(h):
    h = h.lstrip('#'); return Vector([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def lin(h):
    return tuple((c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4) for c in srgb(h)) + (1.0,)


def reset_scene():
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    for blocks in (bpy.data.meshes, bpy.data.armatures, bpy.data.materials, bpy.data.actions, bpy.data.collections,
                   bpy.data.images, bpy.data.textures, bpy.data.curves, bpy.data.cameras, bpy.data.lights,
                   bpy.data.node_groups, bpy.data.texts, bpy.data.linestyles, bpy.data.worlds):
        for block in list(blocks): blocks.remove(block)
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
    PARTS.clear(); COLLS.clear(); MATS.clear()
    sc = bpy.context.scene; sc.unit_settings.system = 'METRIC'; sc.unit_settings.scale_length = 1.0
    for key, (name, rough) in MAT_SPECS.items():
        m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; bs = nt.nodes.get('Principled BSDF')
        bs.inputs['Roughness'].default_value = rough; bs.inputs['Metallic'].default_value = 0.0
        bs.inputs['Base Color'].default_value = (1, 1, 1, 1)
        ca = nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name = 'Col'; ca.location = (-300, 200)
        nt.links.new(ca.outputs['Color'], bs.inputs['Base Color'])
        m.diffuse_color = (0.9, 0.9, 0.9, 1)
        MATS[key] = m


def collection(prop):
    c = bpy.data.collections.new(prop + ' | EDITABLE parts (not exported)')
    bpy.context.scene.collection.children.link(c); COLLS[prop] = c; return c


# ---------------------------------------------------------------- mesh core

def make(prop, name, verts, faces, color, mat='matte', ao=1.0, pig=1.0, smooth=True, sharp=None, freq=1.6, aod=None, occ=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces]); me.update()
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); COLLS[prop].objects.link(ob)
    for p in me.polygons: p.use_smooth = smooth
    if sharp is not None: me.set_sharp_from_angle(angle=math.radians(sharp))
    me.materials.append(MATS[mat])
    PARTS.append({'ob': ob, 'prop': prop, 'color': color, 'mat': mat, 'ao': ao, 'pig': pig, 'freq': freq, 'aod': aod, 'occ': occ,
                  'seed': (zlib.crc32(name.encode()) % 997) * 0.37})
    return ob


def loft(rings, closed=True, cap0=True, cap1=True, closed_path=False):
    """Quads between consecutive rings (a ring of one point makes a fan); caps are tessellated polygons."""
    verts = []; faces = []; idx = []
    for r in rings:
        s = len(verts); verts.extend(Vector(p) for p in r); idx.append(list(range(s, s + len(r))))
    pairs = list(zip(idx, idx[1:]))
    if closed_path: pairs.append((idx[-1], idx[0]))
    for a, b in pairs:
        if len(a) == 1 and len(b) == 1: continue
        if len(a) == 1:
            n = len(b); faces += [(a[0], b[i], b[(i + 1) % n]) for i in range(n if closed else n - 1)]
        elif len(b) == 1:
            n = len(a); faces += [(a[i], a[(i + 1) % n], b[0]) for i in range(n if closed else n - 1)]
        else:
            n = len(a); m = n if closed else n - 1
            faces += [(a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]) for i in range(m)]

    def cap(ring):
        if len(ring) < 3: return
        pts = [verts[i] for i in ring]
        nrm = Vector((0, 0, 0))
        for k in range(len(pts)):
            a_, b_ = pts[k], pts[(k + 1) % len(pts)]
            nrm += Vector(((a_.y - b_.y) * (a_.z + b_.z), (a_.z - b_.z) * (a_.x + b_.x), (a_.x - b_.x) * (a_.y + b_.y)))
        turns = [(pts[k] - pts[k - 1]).cross(pts[(k + 1) % len(pts)] - pts[k]).dot(nrm) for k in range(len(pts))]
        if nrm.length > 1e-12 and all(t >= -1e-6 * nrm.length for t in turns):
            # Convex cap: fan from the centroid (no zero-area slivers from collinear outline points).
            c = len(verts); verts.append(sum(pts, Vector((0, 0, 0))) / len(pts))
            faces.extend((ring[k], ring[(k + 1) % len(ring)], c) for k in range(len(ring)))
        else:
            for t in tessellate_polygon([pts]):
                faces.append(tuple(ring[j] for j in t))
    if not closed_path:
        if cap0: cap(idx[0])
        if cap1: cap(idx[-1])
    return verts, faces


# ---------------------------------------------------------------- outlines (CCW, 2D)

def densify(pts, max_len):
    out = []
    n = len(pts)
    for i in range(n):
        a = Vector(pts[i]); b = Vector(pts[(i + 1) % n]); out.append(a)
        k = int((b - a).length / max_len)
        for j in range(1, k + 1): out.append(a.lerp(b, j / (k + 1)))
    return out


def capsule(L, W, n_end=10, max_len=None):
    r = W / 2; cx = L / 2 - r; pts = []
    for i in range(n_end + 1):
        a = -math.pi / 2 + math.pi * i / n_end; pts.append(Vector((cx + r * math.cos(a), r * math.sin(a))))
    for i in range(n_end + 1):
        a = math.pi / 2 + math.pi * i / n_end; pts.append(Vector((-cx + r * math.cos(a), r * math.sin(a))))
    return densify(pts, max_len) if max_len else pts


def rrect(w, d, r, n_corner=4, cx=0.0, cy=0.0, max_len=None):
    pts = []
    for (sx, sy, a0) in ((1, -1, -math.pi / 2), (1, 1, 0.0), (-1, 1, math.pi / 2), (-1, -1, math.pi)):
        ccx = cx + sx * (w / 2 - r); ccy = cy + sy * (d / 2 - r)
        for i in range(n_corner + 1):
            a = a0 + math.pi / 2 * i / n_corner; pts.append(Vector((ccx + r * math.cos(a), ccy + r * math.sin(a))))
    return densify(pts, max_len) if max_len else pts


def ellipse(rx, ry, n=24, cx=0.0, cy=0.0, phase=0.0):
    return [Vector((cx + rx * math.cos(phase + math.tau * i / n), cy + ry * math.sin(phase + math.tau * i / n))) for i in range(n)]


def d_shape(a, b, y_back, n=20, max_len=None):
    """Half-ellipse toward -y (front) closed by a straight back edge at y_back (CCW)."""
    pts = [Vector((a * math.cos(t), b * math.sin(t))) for t in [math.pi + math.pi * i / n for i in range(n + 1)]]
    pts += [Vector((a, y_back)), Vector((-a, y_back))]
    return densify(pts, max_len) if max_len else pts


def outline_normals(pts):
    n = len(pts); out = []
    for i in range(n):
        a = pts[i - 1]; b = pts[i]; c = pts[(i + 1) % n]
        e1 = (b - a).normalized(); e2 = (c - b).normalized()
        n1 = Vector((e1.y, -e1.x)); n2 = Vector((e2.y, -e2.x)); m = n1 + n2
        if m.length < 1e-9: m = n1.copy()
        m.normalize(); out.append(m / max(0.35, m.dot(n1)))
    return out


def round_profile(z0, z1, rb, rt, seg=3, top_scales=(), bottom_scales=()):
    """(d, z) edge profile: d is the outward offset from the outline (negative = inset). Optional flat inner rings
    on the caps are ('S', factor, z) entries: the last offset ring scaled toward its centroid (never folds)."""
    prof = [('S', f, z0) for f in reversed(bottom_scales)]
    if rb > 0:
        prof += [(-rb + rb * math.sin(math.pi / 2 * i / seg), z0 + rb - rb * math.cos(math.pi / 2 * i / seg)) for i in range(seg + 1)]
    else:
        prof.append((0.0, z0))
    if rt > 0:
        prof += [(-rt + rt * math.cos(math.pi / 2 * i / seg), z1 - rt + rt * math.sin(math.pi / 2 * i / seg)) for i in range(seg + 1)]
    else:
        prof.append((0.0, z1))
    prof += [('S', f, z1) for f in top_scales]
    return prof


def slab(outline, profile, xform=None, cap0=True, cap1=True):
    """Solid swept around a 2D outline: each (d, z) profile entry is one ring offset d along the outline normals;
    ('S', f, z) entries scale the nearest offset ring toward its centroid by f (flat cap rings for soft shading)."""
    N = outline_normals(outline); rings = []; offset_rings = {}
    for i, e in enumerate(profile):
        if e[0] != 'S':
            d, z = e; ring = [Vector((p.x + nn.x * d, p.y + nn.y * d)) for p, nn in zip(outline, N)]; offset_rings[i] = ring
            rings.append([Vector((q.x, q.y, z)) for q in ring])
    for i, e in enumerate(profile):
        if e[0] == 'S':
            j = min(offset_rings, key=lambda k: abs(k - i)); base = offset_rings[j]
            c = sum(base, Vector((0, 0))) / len(base)
            rings.insert(i, [Vector((c.x + (q.x - c.x) * e[1], c.y + (q.y - c.y) * e[1], e[2])) for q in base])
    if xform is not None: rings = [[xform @ v for v in r] for r in rings]
    return loft(rings, True, cap0, cap1)


def ring_sweep(outline, section, xform=None):
    """Closed ring solid: the closed (d, z) section is swept once around the closed outline (a rim)."""
    N = outline_normals(outline)
    rings = [[Vector((p.x + nn.x * d, p.y + nn.y * d, z)) for d, z in section] for p, nn in zip(outline, N)]
    if xform is not None: rings = [[xform @ v for v in r] for r in rings]
    return loft(rings, True, False, False, closed_path=True)


# ---------------------------------------------------------------- solids of revolution, sweeps, blobs

def lathe(profile, n=32, k=1.0, center=(0.0, 0.0), zfun=None, lean=None, xform=None, phase=0.0):
    """profile: (r, z) bottom -> top; elliptic section x = r cos t, y = k r sin t about center (+ lean(z) shift)."""
    rings = []
    for r, z in profile:
        dx, dy = lean(z) if lean else (0.0, 0.0)
        cx = center[0] + dx; cy = center[1] + dy
        if r <= 1e-6:
            rings.append([Vector((cx, cy, z))]); continue
        ring = []
        for i in range(n):
            t = phase + math.tau * i / n; x = cx + r * math.cos(t); y = cy + k * r * math.sin(t)
            ring.append(Vector((x, y, zfun(x, y, z) if zfun else z)))
        rings.append(ring)
    if xform is not None: rings = [[xform @ p for p in r] for r in rings]
    return loft(rings, True, profile[0][0] > 1e-6, profile[-1][0] > 1e-6)


def sweep(path, section, up=(0, 0, 1), bank=None, scale=None, caps=True):
    """Closed (u, v) section along a path; L = T x up is the lateral (right-of-travel) axis, U = L x T."""
    pts = [Vector(p) for p in path]; m = len(pts); rings = []; upv = Vector(up)
    for i in range(m):
        T = (pts[min(i + 1, m - 1)] - pts[max(i - 1, 0)]).normalized()
        L = T.cross(upv)
        if L.length < 1e-6: L = T.cross(Vector((0, 1, 0)))
        L.normalize(); U = L.cross(T).normalized()
        if bank:
            b = bank(i / (m - 1)); cb, sb = math.cos(b), math.sin(b); L, U = L * cb + U * sb, U * cb - L * sb
        s = scale(i / (m - 1)) if scale else 1.0
        rings.append([pts[i] + L * (u * s) + U * (v * s) for u, v in section])
    return loft(rings, True, caps, caps)


def tube(path, radius, n=12, caps=True):
    sec = [(radius * math.cos(math.tau * i / n), radius * math.sin(math.tau * i / n)) for i in range(n)]
    return sweep(path, sec, caps=caps)


def blob_radius(d, radii, amp, freq, seed):
    e = 1.0 / math.sqrt((d.x / radii[0]) ** 2 + (d.y / radii[1]) ** 2 + (d.z / radii[2]) ** 2)
    return e * (1 + amp * noise.noise(d * freq + Vector((seed, seed * 0.7, seed * 1.3))))


def blob(center, radii, n=14, rings=9, amp=0.05, freq=2.3, seed=1.0, zmin=None):
    c = Vector(center); rr = []
    for j in range(rings + 1):
        a = -math.pi / 2 + math.pi * j / rings; ca, sa = math.cos(a), math.sin(a)
        if j in (0, rings):
            d = Vector((0, 0, sa)); p = c + d * blob_radius(d, radii, amp, freq, seed)
            if zmin is not None: p.z = max(p.z, zmin)
            rr.append([p]); continue
        ring = []
        for i in range(n):
            t = math.tau * (i + 0.5 * (j % 2)) / n
            d = Vector((ca * math.cos(t), ca * math.sin(t), sa)); p = c + d * blob_radius(d, radii, amp, freq, seed)
            if zmin is not None: p.z = max(p.z, zmin)
            ring.append(p)
        rr.append(ring)
    return loft(rr, True, False, False)


def lens(Lh, Wh, n=8):
    """Pointed leaf outline (half-length Lh along u, half-width Wh along v)."""
    out = []
    for i in range(n):
        t = math.tau * i / n; s = math.sin(t)
        out.append(Vector((Lh * math.cos(t), Wh * s * (0.35 + 0.65 * abs(s)) ** 0.5)))
    return out


def blob_decal(center, radii, amp, freq, seed, direction, outline, spin, lift=0.012, sink=0.03):
    """Leaf mark wrapped onto a blob surface: outline (u, v) in the tangent plane at `direction`."""
    c = Vector(center); d0 = Vector(direction).normalized()
    t1 = d0.cross(Vector((0, 0, 1)))
    if t1.length < 1e-4: t1 = Vector((1, 0, 0))
    t1.normalize(); t2 = d0.cross(t1).normalized()
    cs, sn = math.cos(spin), math.sin(spin); a1 = t1 * cs + t2 * sn; a2 = t2 * cs - t1 * sn
    R0 = blob_radius(d0, radii, amp, freq, seed)
    def place(u, v, w):
        q = c + d0 * R0 + a1 * u + a2 * v; d = (q - c).normalized()
        return c + d * (blob_radius(d, radii, amp, freq, seed) + w)
    rings = [[place(p.x * s, p.y * s, w) for p in outline] for s, w in ((1.0, -sink), (1.0, lift * 0.4), (0.55, lift))]
    rings.append([place(0, 0, lift * 1.05)])
    return loft(rings, True, True, False)


# ---------------------------------------------------------------- reliefs on a facade surface y = surf(x, z)

def surface_plate(outline_xz, surf, w_front, w_back, rings=(1.0, 0.7, 0.4), center=None):
    """Plate hugging a front-facing surface: concentric outline rings pulled toward the centre, each projected
    onto surf(x, z) and offset toward -y by w_front; the back ring sits w_back inside the surface."""
    pts = [Vector(p) for p in outline_xz]
    c = Vector(center) if center else sum(pts, Vector((0, 0))) / len(pts)
    def at(p, w): return Vector((p.x, surf(p.x, p.y) - w, p.y))
    rr = [[at(p, -w_back) for p in pts]]
    for s in rings: rr.append([at(c + (p - c) * s, w_front) for p in pts])
    rr.append([at(c, w_front)])
    return loft(rr, True, True, False)


def surface_sweep(path_xz, section, surf, closed_path=False):
    """Section (u across the path, w out of the surface toward -y) swept along a path lying on surf(x, z)."""
    pts = [Vector(p) for p in path_xz]; m = len(pts); rr = []
    for i in range(m):
        if closed_path: a, b = pts[i - 1], pts[(i + 1) % m]
        else: a, b = pts[max(i - 1, 0)], pts[min(i + 1, m - 1)]
        t = (b - a).normalized(); lat = Vector((-t.y, t.x))
        ring = []
        for u, w in section:
            q = pts[i] + lat * u; ring.append(Vector((q.x, surf(q.x, q.y) - w, q.y)))
        rr.append(ring)
    return loft(rr, True, not closed_path, not closed_path, closed_path=closed_path)


def surface_pillow(cx, cz, su, sv, thick, surf, n=12, exp=3.5, sink=0.03):
    """Rounded superellipse lump on the surface (stones, knobs)."""
    def sup(s):
        out = []
        for i in range(n):
            t = math.tau * i / n; c, s_ = math.cos(t), math.sin(t)
            out.append(Vector((cx + su * s * math.copysign(abs(c) ** (2 / exp), c), cz + sv * s * math.copysign(abs(s_) ** (2 / exp), s_))))
        return out
    def at(p, w): return Vector((p.x, surf(p.x, p.y) - w, p.y))
    rr = [[at(p, -sink) for p in sup(1.0)], [at(p, 0.0) for p in sup(1.0)], [at(p, thick * 0.62) for p in sup(0.86)],
          [at(p, thick * 0.92) for p in sup(0.55)], [at(Vector((cx, cz)), thick)]]
    return loft(rr, True, True, False)


def bend_normals(ob, center_fn, k_true, k_view, frame=None):
    """Stylised shading for a flattened elliptic solid: vertex normals are recomputed as if the section had depth
    ratio k_view (rounder) instead of k_true, keeping the true vertical component. frame maps local -> world."""
    me = ob.data; F = frame if frame is not None else Matrix.Identity(4); Fi = F.inverted(); R = F.to_3x3(); Ri = R.inverted()
    out = []
    for v in me.vertices:
        lc = Fi @ v.co; nt = (Ri @ v.normal).normalized(); cx, cy = center_fn(lc.z)
        dx = lc.x - cx; dy = lc.y - cy; re = math.sqrt(dx * dx + (dy / k_true) ** 2)
        if re < 1e-6 or abs(nt.z) > 0.985:
            out.append(tuple(v.normal)); continue
        ct, st = dx / re, dy / (k_true * re)
        nxy = Vector((k_view * ct, st)).normalized(); h = math.sqrt(max(0.0, 1 - nt.z * nt.z))
        out.append(tuple((R @ Vector((nxy.x * h, nxy.y * h, nt.z))).normalized()))
    me.normals_split_custom_set_from_vertices(out)


# ---------------------------------------------------------------- paint: base x pigment x soft occlusion

def hemisphere(count=40):
    dirs = []; g = math.pi * (3 - math.sqrt(5))
    for i in range(count):
        u = (i + 0.5) / count; r = math.sqrt(u); phi = i * g
        dirs.append((r * math.cos(phi), r * math.sin(phi), math.sqrt(max(0.0, 1 - u))))
    return dirs


DIRS = hemisphere(40)


def paint(prop, dist, strength=0.9, floor=True):
    parts = [p for p in PARTS if p['prop'] == prop]
    V = []; F = []
    for p in parts:
        if not p['occ']: continue   # thin painted decals receive occlusion but never cast it (no smears on flat tops)
        me = p['ob'].data; base = len(V)
        V.extend(tuple(v.co) for v in me.vertices); F.extend(tuple(base + i for i in poly.vertices) for poly in me.polygons)
    if floor:
        b = len(V); V.extend([(-30, -30, 0), (30, -30, 0), (30, 30, 0), (-30, 30, 0)]); F.append((b, b + 1, b + 2, b + 3))
    bvh = BVHTree.FromPolygons(V, F)
    stats = {}
    for p in parts:
        me = p['ob'].data
        attr = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
        base_col = srgb(p['color']); lights = []
        for v in me.vertices:
            n = v.normal.normalized(); t = n.orthogonal().normalized(); b = n.cross(t); o = v.co + n * 0.0025; occ = 0.0
            if p['ao'] > 0:
                reach = p['aod'] or dist
                for dx, dy, dz in DIRS:
                    hit = bvh.ray_cast(o, t * dx + b * dy + n * dz, reach)
                    if hit[0] is not None: occ += 1 - (hit[3] / reach) ** 2
                occ /= len(DIRS)
            light = max(0.30, 1 - strength * p['ao'] * occ ** 0.85); lights.append(light)
            q = v.co * p['freq'] + Vector((p['seed'], p['seed'] * 0.61, p['seed'] * 1.37))
            mot = 1 + p['pig'] * (0.040 * noise.noise(q) + 0.018 * noise.noise(q * 3.3))
            warm = 0.03 * max(n.z, 0.0)
            c = Vector((base_col.x * mot * (1 + warm), base_col.y * mot * (1 + 0.5 * warm), base_col.z * mot * (1 - 0.5 * warm)))
            shade = Vector([light + (1 - light) * SHADOW_TINT[k] for k in range(3)])
            c = Vector([min(1.0, max(0.0, c[k] * shade[k])) for k in range(3)])
            attr.data[v.index].color_srgb = (c.x, c.y, c.z, 1.0)
        me.color_attributes.active_color = attr
        me.color_attributes.render_color_index = me.color_attributes.active_color_index
        stats[p['ob'].name] = {'min_light': round(min(lights), 3), 'mean_light': round(sum(lights) / len(lights), 3)}
    return stats


# ---------------------------------------------------------------- join, measure, export

def join_prop(prop, export_coll):
    parts = [p['ob'] for p in PARTS if p['prop'] == prop]
    copies = []
    for ob in parts:
        cp = ob.copy(); cp.data = ob.data.copy(); export_coll.objects.link(cp); copies.append(cp)
    bpy.ops.object.select_all(action='DESELECT')
    for cp in copies: cp.select_set(True)
    bpy.context.view_layer.objects.active = copies[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active; ob.name = prop; ob.data.name = prop + ' mesh'
    ca = ob.data.color_attributes; assert len(ca) == 1 and ca[0].name == 'Col', [a.name for a in ca]
    ca.active_color = ca[0]; ca.render_color_index = 0
    for key in list(ob.keys()): del ob[key]
    ob.select_set(False)
    return ob


def measure(ob):
    me = ob.data; me.calc_loop_triangles()
    pts = [ob.matrix_world @ v.co for v in me.vertices]
    lo = [min(p[k] for p in pts) for k in range(3)]; hi = [max(p[k] for p in pts) for k in range(3)]
    return {'blender_min': [round(x, 5) for x in lo], 'blender_max': [round(x, 5) for x in hi],
            'gltf_min': [round(lo[0], 5), round(lo[2], 5), round(-hi[1], 5)],
            'gltf_max': [round(hi[0], 5), round(hi[2], 5), round(-lo[1], 5)],
            'size_m': {'width_x': round(hi[0] - lo[0], 4), 'height_y': round(hi[2] - lo[2], 4), 'depth_z': round(hi[1] - lo[1], 4)},
            'triangles': len(me.loop_triangles), 'vertices': len(me.vertices), 'materials': [m.name for m in me.materials]}


def export_glb(ob, path, extras):
    sc = bpy.context.scene
    stash = {k: sc[k] for k in list(sc.keys()) if not k.startswith('cycles')}
    try:
        for k in stash: del sc[k]
        for k, v in extras.items(): sc[k] = v
        bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
        bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, export_yup=True,
                                  export_apply=False, export_animations=False, export_skins=False, export_morph=False,
                                  export_texcoords=False, export_normals=True, export_tangents=False,
                                  export_materials='EXPORT', export_vertex_color='ACTIVE', export_all_vertex_colors=False,
                                  export_cameras=False, export_lights=False, export_extras=True)
    finally:
        for k in list(sc.keys()):
            if not k.startswith('cycles'): del sc[k]
        for k, v in stash.items(): sc[k] = v
        ob.select_set(False)
    assert sc.get('scene_lease') == 'active'
