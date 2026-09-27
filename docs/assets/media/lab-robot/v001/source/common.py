"""WO111 lab-robot mesh, atlas-UV and skin helpers.

Adapted from the WO111 radio-host-showman v001 helpers (rigid parts plus blended weights, flat atlas
tiles, parts authored in a source frame and placed by a matrix), with painted regions for this robot:

* ('cyl', key, z0, z1)            cylindrical (angle from the back, height) map, seam at the back (-Y)
* ('planar', key, cx, cz, hw, hh, flip)   front/back face map (x, z) -> face fractions
* ('polarY', key, cx, cz, R, flip)        disc facing +/-Y (iris, dials, hazard ring, button cap)
* ('polarX', key, cy, cz, R)              disc facing +/-X (hubcaps)
* ('polarZ', key, cx, cy, R)              disc facing +Z (the head interior under the dome lid)
* ('beacon', key, z0, z1)                 angle x height around the beacon axis (the glow hot spot)
Everything else uses 128 px flat colour tiles (tiles 0-15 the top-right quadrant, 16-31 the bottom-right).

Two materials share the one atlas: 0 matte painted, 1 glow (the atlas also drives emission, so the
amber warning light, the red eye core, the red target glare and the defeat sparks glow in dim rooms).
All authored coordinates are Blender +Z up / +Y forward, character right = +X.
The glTF exporter maps them to +Y up / -Z forward.
"""
import bpy, bmesh, math
from pathlib import Path
from mathutils import Vector, Matrix, Euler

PARTS = []; MATS = []; ROOT = None
ATLAS = 1024
RECT = {}          # region key -> (x0, y0, w, h) px, set from paint.RECT by build.py

def setup(root, materials, atlas_path, atlas_name, rects):
    """materials: [(label, roughness, emissive)]. One packed atlas image drives colour (and emission)."""
    global ROOT
    ROOT = Path(root); RECT.clear(); RECT.update(rects)
    if bpy.context.object and bpy.context.object.mode != 'OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    for coll in list(bpy.data.collections): bpy.data.collections.remove(coll)
    for blocks in (bpy.data.meshes, bpy.data.armatures, bpy.data.materials, bpy.data.actions, bpy.data.images, bpy.data.textures, bpy.data.curves,
                   bpy.data.cameras, bpy.data.lights, bpy.data.node_groups, bpy.data.texts, bpy.data.linestyles, bpy.data.worlds):
        for block in list(blocks): blocks.remove(block)
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
    PARTS.clear(); MATS.clear()
    sc = bpy.context.scene; sc.unit_settings.system = 'METRIC'; sc.unit_settings.scale_length = 1
    image = bpy.data.images.load(str(atlas_path), check_existing=False); image.name = atlas_name; image.pack()
    for label, rough, emissive in materials:
        mat = bpy.data.materials.new(label); mat.use_nodes = True; bs = mat.node_tree.nodes.get('Principled BSDF')
        bs.inputs['Roughness'].default_value = rough; bs.inputs['Metallic'].default_value = 0; bs.inputs['Specular IOR Level'].default_value = .32
        tex = mat.node_tree.nodes.new('ShaderNodeTexImage'); tex.image = image; tex.extension = 'EXTEND'; tex.interpolation = 'Linear'
        mat.node_tree.links.new(tex.outputs['Color'], bs.inputs['Base Color'])
        if emissive:
            mat.node_tree.links.new(tex.outputs['Color'], bs.inputs['Emission Color']); bs.inputs['Emission Strength'].default_value = 1.0
        MATS.append(mat)

def tile_origin(t):
    assert 0 <= t < 32, t
    q = t % 16; x = 512 + (q % 4) * 128; y = (q // 4) * 128 + (512 if t >= 16 else 0); return x, y

def tile_uv(t, u, v):
    x, y = tile_origin(t)
    # the centre 50% of each tile: mip levels never bleed a neighbouring colour into a part
    return ((x + 32 + 64 * u) / ATLAS, 1 - (y + 32 + 64 * (1 - v)) / ATLAS)

def clamp(a, lo=0.004, hi=0.996): return max(lo, min(hi, a))

def rect_uv(key, fx, fy):
    x0, y0, w, h = RECT[key]; return ((x0 + clamp(fx) * w) / ATLAS, 1 - (y0 + clamp(fy) * h) / ATLAS)

def region_uvs(kind, pts):
    t = kind[0]; key = kind[1]
    if t == 'cyl':
        z0, z1 = kind[2], kind[3]; pad = 4 / 512
        ph = [math.atan2(p.x, -p.y) % math.tau for p in pts]
        if max(ph) - min(ph) > math.pi: ph = [a + math.tau if a < math.pi else a for a in ph]
        return [rect_uv(key, pad + (1 - 2 * pad) * min(a, math.tau) / math.tau, (z1 - p.z) / (z1 - z0)) for a, p in zip(ph, pts)]
    if t == 'planar':
        cx, cz, hw, hh, flip = kind[2:7]; sgn = -1 if flip else 1
        return [rect_uv(key, .5 + sgn * (p.x - cx) / (2 * hw), .5 - (p.z - cz) / (2 * hh)) for p in pts]
    if t == 'polarY':
        cx, cz, R, flip = kind[2:6]; sgn = -1 if flip else 1
        return [rect_uv(key, .5 + sgn * (p.x - cx) / (2 * R), .5 - (p.z - cz) / (2 * R)) for p in pts]
    if t == 'polarX':
        cy, cz, R = kind[2:5]
        return [rect_uv(key, .5 + (p.y - cy) / (2 * R), .5 - (p.z - cz) / (2 * R)) for p in pts]
    if t == 'polarZ':
        cx, cy, R = kind[2:5]
        return [rect_uv(key, .5 + (p.x - cx) / (2 * R), .5 - (p.y - cy) / (2 * R)) for p in pts]
    if t == 'beacon':
        z0, z1 = kind[2], kind[3]
        ph = [math.atan2(p.x, -p.y) % math.tau for p in pts]
        if max(ph) - min(ph) > math.pi: ph = [a + math.tau if a < math.pi else a for a in ph]
        return [rect_uv(key, min(a, math.tau) / math.tau, (z1 - p.z) / (z1 - z0)) for a, p in zip(ph, pts)]
    raise KeyError(kind)

def assign_uv(me, tile, face_tile=None, src=None):
    """Flat tiles use a tiny per-face planar spread inside the tile centre; region faces use region_uvs of src."""
    for layer in list(me.uv_layers): me.uv_layers.remove(layer)
    uv = me.uv_layers.new(name='Original painted atlas UV'); uv.active_render = True
    co = src if src is not None else [v.co.copy() for v in me.vertices]
    lo = [min(p[k] for p in co) for k in range(3)]; span = [max(1e-4, max(p[k] for p in co) - lo[k]) for k in range(3)]
    for p in me.polygons:
        c = sum((co[i] for i in p.vertices), Vector()) / len(p.vertices)
        n = Vector((0, 0, 0))
        vs = [co[i] for i in p.vertices]
        for i in range(len(vs)): n += vs[i].cross(vs[(i + 1) % len(vs)])
        n = n.normalized() if n.length > 1e-12 else Vector((0, 0, 1))
        t = tile
        if face_tile:
            chosen = face_tile(c, n)
            if chosen is not None: t = chosen
        if isinstance(t, tuple):
            uvs = region_uvs(t, [co[me.loops[li].vertex_index] for li in p.loop_indices])
            for li, q in zip(p.loop_indices, uvs): uv.data[li].uv = q
            continue
        k = max(range(3), key=lambda k: abs(n[k])); axes = [a for a in range(3) if a != k]
        for li in p.loop_indices:
            q = co[me.loops[li].vertex_index]
            uv.data[li].uv = tile_uv(t, (q[axes[0]] - lo[axes[0]]) / span[axes[0]], (q[axes[1]] - lo[axes[1]]) / span[axes[1]])

def finish(ob, name, tile, bn, mat=0, smooth=True, weights=None, face_tile=None, src=None):
    ob.name = name
    for p in ob.data.polygons: p.use_smooth = smooth
    assign_uv(ob.data, tile, face_tile, src); ob.data.materials.append(MATS[mat]); groupnames = set()
    for v in ob.data.vertices:
        w = weights(v.co) if weights else {bn: 1.0}
        w = {b: x for b, x in w.items() if x > 1e-4}
        w = dict(sorted(w.items(), key=lambda kv: -kv[1])[:4])     # contract: one skin, <= 4 per vertex
        total = sum(w.values()); assert total > 0, (name, v.co)
        for b, value in w.items():
            if b not in groupnames:
                ob.vertex_groups.new(name=b); groupnames.add(b)
            ob.vertex_groups[b].add([v.index], value / total, 'REPLACE')
    ob['source_part'] = name; ob['rigid_weight'] = bn if not weights else 'weighted'; ob['atlas_tile'] = str(tile)
    PARTS.append(ob); ob.select_set(False); return ob

def mesh(name, verts, faces, tile, bn='body', mat=0, smooth=True, weights=None, face_tile=None, transform=None, merge=True, orient=None):
    """verts/faces in a source frame; UVs are computed from the source frame, then `transform` places the part.
    orient: for open shells, a direction (or callable(centre) -> direction) every face normal must face."""
    data = bpy.data.meshes.new(name); data.from_pydata([tuple(v) for v in verts], [], faces); data.update()
    bm = bmesh.new(); bm.from_mesh(data)
    if merge: bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    if orient is None: bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    else:
        for f in bm.faces:
            f.normal_update(); d = orient(f.calc_center_median()) if callable(orient) else Vector(orient)
            if f.normal.dot(d) < 0: f.normal_flip()
    bm.to_mesh(data); bm.free()
    src = [v.co.copy() for v in data.vertices]
    if transform is not None:
        for v in data.vertices: v.co = transform @ v.co
        if transform.determinant() < 0: data.flip_normals()
    ob = bpy.data.objects.new(name, data); bpy.context.collection.objects.link(ob)
    return finish(ob, name, tile, bn, mat, smooth, weights, face_tile, src)

def weighted_normals(ob):
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    mod = ob.modifiers.new('Weighted authored face normals', 'WEIGHTED_NORMAL'); mod.keep_sharp = True; bpy.ops.object.modifier_apply(modifier=mod.name)
    ob.select_set(False)

def box(name, c, s, tile, bn='body', bevel=.008, segments=2, mat=0, rot=(0, 0, 0), weights=None, transform=None, face_tile=None, taper=None, smooth=None):
    """Bevelled box; taper=(bottom_x_scale, top_x_scale) widens it toward the top (the blockout tin body)."""
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        k = 1.0 if taper is None else (taper[1] if v.co.z > 0 else taper[0])
        v.co = Vector((v.co.x * s[0] * k, v.co.y * s[1], v.co.z * s[2]))
    if bevel:
        bmesh.ops.bevel(bm, geom=bm.verts[:] + bm.edges[:], offset=bevel, segments=segments, affect='EDGES', profile=.5)
    tr = Matrix.Translation(c) @ Euler(rot).to_matrix().to_4x4()
    if transform is not None: tr = transform @ tr
    # placed before UVs, so painted regions and face_tile see world coordinates
    verts = [tr @ v.co for v in bm.verts]; faces = [[v.index for v in f.verts] for f in bm.faces]; bm.free()
    if tr.determinant() < 0: faces = [f[::-1] for f in faces]
    ob = mesh(name, verts, faces, tile, bn, mat, bool(bevel) if smooth is None else smooth, weights, face_tile, None, merge=False)
    if bevel: weighted_normals(ob)
    return ob

def rings(name, rr, tile, bn='body', mat=0, caps=True, smooth=True, weights=None, face_tile=None, closed=True, transform=None):
    n = len(rr[0]); verts = [p for r in rr for p in r]; faces = []
    m = n if closed else n - 1
    for j in range(len(rr) - 1):
        for i in range(m): faces.append((j * n + i, j * n + (i + 1) % n, (j + 1) * n + (i + 1) % n, (j + 1) * n + i))
    if caps is True: caps = (True, True)
    if caps:
        if caps[0]: faces.append(tuple(range(n - 1, -1, -1)))
        if caps[1]: faces.append(tuple((len(rr) - 1) * n + i for i in range(n)))
    return mesh(name, verts, faces, tile, bn, mat, smooth, weights, face_tile, transform)

def ellipsoid(name, c, s, tile, bn='body', mat=0, n=16, r=8, rot=(0, 0, 0), weights=None, transform=None, face_tile=None, zmin=None):
    """UV ellipsoid; zmin (-1..1, local) cuts it into a front cap (used for domes and shells)."""
    n = max(6, round(n / 2) * 2); r = max(3, round(r))
    tr = Matrix.Translation(c) @ Euler(rot).to_matrix().to_4x4()
    if transform is not None: tr = transform @ tr
    verts = [Vector((0, 0, -s[2]))]
    for j in range(1, r):
        a = -math.pi / 2 + math.pi * j / r; ca = math.cos(a)
        verts += [Vector((s[0] * ca * math.cos(math.tau * i / n), s[1] * ca * math.sin(math.tau * i / n), s[2] * math.sin(a))) for i in range(n)]
    verts.append(Vector((0, 0, s[2])))
    faces = [(0, 1 + (i + 1) % n, 1 + i) for i in range(n)]
    for j in range(r - 2):
        for i in range(n): faces.append((1 + j * n + i, 1 + j * n + (i + 1) % n, 1 + (j + 1) * n + (i + 1) % n, 1 + (j + 1) * n + i))
    top = len(verts) - 1; base = 1 + (r - 2) * n
    faces += [(base + i, base + (i + 1) % n, top) for i in range(n)]
    return mesh(name, verts, faces, tile, bn, mat, True, weights, face_tile, tr)

def dome_cap(name, c, rx, ry, rz, tile, bn, axis='Z', rings_n=6, n=24, mat=0, face_tile=None, weights=None, profile=None, closed_base=False):
    """Half-ellipsoid cap on the +axis side (axis 'Z' up or 'Y' forward) with a pole; optional closed base disc.
    profile(t) -> (radial fraction, height fraction) for t in 0..1 (base->pole), default a quarter circle."""
    prof = profile or (lambda t: (math.cos(t * math.pi / 2), math.sin(t * math.pi / 2)))
    verts = []; faces = []
    for j in range(rings_n):
        rf, hf = prof(j / rings_n)
        for i in range(n):
            a = math.tau * i / n
            if axis == 'Z': verts.append(Vector((c[0] + rx * rf * math.cos(a), c[1] + ry * rf * math.sin(a), c[2] + rz * hf)))
            else: verts.append(Vector((c[0] + rx * rf * math.cos(a), c[1] + ry * hf, c[2] + rz * rf * math.sin(a))))
    rf, hf = prof(1.0)
    verts.append(Vector((c[0], c[1], c[2] + rz)) if axis == 'Z' else Vector((c[0], c[1] + ry, c[2])))
    pole = len(verts) - 1
    for j in range(rings_n - 1):
        for i in range(n): faces.append((j * n + i, j * n + (i + 1) % n, (j + 1) * n + (i + 1) % n, (j + 1) * n + i))
    top = (rings_n - 1) * n
    faces += [(top + i, top + (i + 1) % n, pole) for i in range(n)]
    if closed_base: faces.append(tuple(range(n - 1, -1, -1)))
    centre = Vector(c)
    return mesh(name, verts, faces, tile, bn, mat, True, weights, face_tile, orient=None if closed_base else (lambda cc: cc - centre))

def frustum(name, c, r1, r2, depth, tile, bn='body', mat=0, n=12, rot=(0, 0, 0), scale=(1, 1, 1), weights=None, transform=None, face_tile=None, caps=True):
    """Blender create_cone equivalent: centred at c, axis local +Z, radius1 at -depth/2, radius2 at +depth/2."""
    tr = Matrix.Translation(c) @ Euler(rot).to_matrix().to_4x4() @ Matrix.Diagonal((scale[0], scale[1], scale[2], 1))
    if transform is not None: tr = transform @ tr
    rr = [[Vector((r * math.cos(math.tau * i / n), r * math.sin(math.tau * i / n), z)) for i in range(n)] for z, r in ((-depth / 2, r1), (depth / 2, r2))]
    if face_tile is not None:
        base = face_tile
        def face_tile(c_, n_, M=tr, base=base): return base(M @ c_, (M.to_3x3() @ n_).normalized())
        return rings_world(name, rr, tile, bn, mat, caps, weights, face_tile, tr)
    return rings(name, rr, tile, bn, mat, caps, True, weights, None, True, tr)

def rings_world(name, rr, tile, bn, mat, caps, weights, face_tile, tr):
    """rings() whose UVs are computed from the placed (world) coordinates, so world-space regions line up."""
    world = [[tr @ p for p in r] for r in rr]
    def ft(c, n, base=face_tile): return base(c, n)
    return rings(name, world, tile, bn, mat, caps, True, weights, ft, True, None)

def rod(name, a, b, r1, r2, tile, bn='body', mat=0, n=12, weights=None, face_tile=None, caps=True):
    """Cylinder/frustum from point a to point b (UVs from world coordinates)."""
    a = Vector(a); b = Vector(b); d = b - a
    q = d.to_track_quat('Z', 'Y'); tr = Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4()
    rr = [[tr @ Vector((r * math.cos(math.tau * i / n), r * math.sin(math.tau * i / n), z)) for i in range(n)] for z, r in ((-d.length / 2, r1), (d.length / 2, r2))]
    return rings(name, rr, tile, bn, mat, caps, True, weights, face_tile, True, None)

def lathe_rows(name, rows, tile, bn='body', mat=0, n=24, ey=1.0, caps=True, weights=None, face_tile=None, transform=None, axis_xy=(0, 0), phase=0.0):
    """Vertical surface of revolution from explicit (z, radius) rows; ey scales the local y radius."""
    rr = [[Vector((axis_xy[0] + r * math.cos(math.tau * (i + phase) / n), axis_xy[1] + r * ey * math.sin(math.tau * (i + phase) / n), z)) for i in range(n)] for z, r in rows]
    return rings(name, rr, tile, bn, mat, caps, True, weights, face_tile, True, transform)

def catmull_pad(pts, per):
    P = [Vector(p) for p in pts]; P = [P[0] + (P[0] - P[1])] + P + [P[-1] + (P[-1] - P[-2])]; out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for s in range(per):
            t = s / per
            out.append(.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-2]); return out

def arclength(pts):
    s = [0.0]
    for a, b in zip(pts, pts[1:]): s.append(s[-1] + (b - a).length)
    return s

def sweep_rings(path, radii, n, flat=1.0, up=(0, 0, 1), phase=0.0):
    """Rotation-minimising frames from `up`; `flat` scales the cross-section along N. radii: callable(u) or list."""
    m = len(path); lens = arclength(path); total = lens[-1]; rr = []; us = []
    T = (path[1] - path[0]).normalized(); U = Vector(up); N = U - U.dot(T) * T
    if N.length < 1e-3: N = T.cross(Vector((1, 0, 0)))
    N.normalize()
    for i in range(m):
        if i > 0:
            T = (path[min(i + 1, m - 1)] - path[i - 1]).normalized(); N = (N - N.dot(T) * T).normalized()
        B = T.cross(N); u = lens[i] / total
        if callable(radii): r = radii(u)
        else:
            k = u * (len(radii) - 1); k0 = min(int(k), len(radii) - 2); r = radii[k0] + (radii[k0 + 1] - radii[k0]) * (k - k0)
        rr.append([path[i] + r * (flat * math.cos(math.tau * (j + phase) / n) * N + math.sin(math.tau * (j + phase) / n) * B) for j in range(n)]); us.append(u)
    return rr, us

def sweep(name, pts, radii, tile, n=8, per=3, flat=1.0, up=(0, 0, 1), bn='body', mat=0, weights=None, transform=None, caps=True, path=None, phase=0.0, face_tile=None):
    path = path or catmull_pad(pts, per)
    rr, us = sweep_rings(path, radii, n, flat, up, phase)
    ob = rings(name, rr, tile, bn, mat, caps, True, weights, face_tile, True, transform)
    return ob, path, us

def prism(name, pts, thick, tile, bn='body', mat=0, M=None, weights=None, face_tile=None, smooth=False):
    """Flat 2-D outline pts[(x, z)] extruded along local Y (thickness centred), fan-triangulated from its centroid."""
    n = len(pts); cx = sum(p[0] for p in pts) / n; cz = sum(p[1] for p in pts) / n; h = thick / 2
    verts = [Vector((cx, -h, cz)), Vector((cx, h, cz))] + [Vector((x, -h, z)) for x, z in pts] + [Vector((x, h, z)) for x, z in pts]
    faces = []
    for i in range(n):
        j = (i + 1) % n; faces += [(0, 2 + j, 2 + i), (1, 2 + n + i, 2 + n + j), (2 + i, 2 + j, 2 + n + j, 2 + n + i)]
    ob = mesh(name, verts, faces, tile, bn, mat, smooth, weights, face_tile, M)
    weighted_normals(ob); return ob

def frame(y_axis, z_hint, origin=(0, 0, 0)):
    """World matrix whose local +Y is y_axis and local +Z is as close to z_hint as possible."""
    Y = Vector(y_axis).normalized(); Z = Vector(z_hint); Z = (Z - Z.dot(Y) * Y).normalized(); X = Y.cross(Z)
    M = Matrix((X, Y, Z)).transposed().to_4x4(); M.translation = Vector(origin); return M

def smooth(t): t = max(0, min(1, t)); return t * t * (3 - 2 * t)
def interp(profile, z):
    if z <= profile[0][0]: return profile[0][1]
    for (z0, r0), (z1, r1) in zip(profile, profile[1:]):
        if z0 <= z <= z1: return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return profile[-1][1]
