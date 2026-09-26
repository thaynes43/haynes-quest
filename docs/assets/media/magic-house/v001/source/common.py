"""WO111 magic-house v001: mesh, painted-atlas UV and skin helpers.

Adapted from the WO099/WO111 honk-bus and gadget-helper helpers (rigid parts plus blended weights,
per-part atlas cells). New here: painted atlas REGIONS (roof tile rows, shutter louvres, door leaf,
doormat stripes) addressed by physical coordinates, so detail lives in the texture, not the mesh.

All authored coordinates are Blender +Z up / +Y forward (the house faces +Y; its right is +X).
The glTF exporter maps these to +Y up / -Z forward. No startup reset or addon changes are used.
"""
import bpy, bmesh, math
from mathutils import Vector, Matrix, Euler

PARTS = []; MATS = []

# ---- Atlas layout (UV space, v up). Swatches: top half, 8 x 4 cells of 128 px.
SW_COLS, SW_ROWS, SW_INSET = 8, 4, .20
REGIONS = {  # name: (u0, v0, u1, v1)
    'roof_L': (0 / 1024, 256 / 1024, 512 / 1024, 512 / 1024),
    'roof_R': (0 / 1024, 0 / 1024, 512 / 1024, 256 / 1024),
    'louvre': (512 / 1024, 256 / 1024, 768 / 1024, 512 / 1024),
    'door': (768 / 1024, 256 / 1024, 1024 / 1024, 512 / 1024),
    'mat': (512 / 1024, 0 / 1024, 768 / 1024, 256 / 1024),
}

def cell_rect(c):
    col, row = c % SW_COLS, c // SW_COLS
    u0 = col / SW_COLS; v1 = 1 - row * (.5 / SW_ROWS); v0 = v1 - .5 / SW_ROWS
    return u0, v0, u0 + 1 / SW_COLS, v1

def region_uv(name, a, b):
    """a, b in [0, 1] inside the named painted region."""
    u0, v0, u1, v1 = REGIONS[name]
    return (u0 + (u1 - u0) * min(1, max(0, a)), v0 + (v1 - v0) * min(1, max(0, b)))

def setup(image_path, materials):
    if bpy.context.object and bpy.context.object.mode != 'OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    for blocks in (bpy.data.meshes, bpy.data.armatures, bpy.data.materials, bpy.data.actions, bpy.data.collections, bpy.data.images,
                   bpy.data.textures, bpy.data.curves, bpy.data.cameras, bpy.data.lights, bpy.data.node_groups, bpy.data.texts, bpy.data.linestyles):
        for block in list(blocks): blocks.remove(block)
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
    PARTS.clear(); MATS.clear()
    sc = bpy.context.scene; sc.unit_settings.system = 'METRIC'; sc.unit_settings.scale_length = 1
    image = bpy.data.images.load(str(image_path), check_existing=False); image.name = 'magic-house original painted 1024 atlas'; image.pack()
    for label, rough, emissive in materials:
        mat = bpy.data.materials.new(label); mat.use_nodes = True; bs = mat.node_tree.nodes.get('Principled BSDF')
        bs.inputs['Roughness'].default_value = rough; bs.inputs['Metallic'].default_value = 0; bs.inputs['Specular IOR Level'].default_value = .30
        tex = mat.node_tree.nodes.new('ShaderNodeTexImage'); tex.image = image; tex.extension = 'EXTEND'
        mat.node_tree.links.new(tex.outputs['Color'], bs.inputs['Base Color'])
        if emissive:
            mat.node_tree.links.new(tex.outputs['Color'], bs.inputs['Emission Color']); bs.inputs['Emission Strength'].default_value = emissive
        MATS.append(mat)

def uv_cell(ob, cell):
    """Per-face dominant-axis planar projection into the centre of one swatch cell."""
    for layer in list(ob.data.uv_layers): ob.data.uv_layers.remove(layer)
    uv = ob.data.uv_layers.new(name='Original painted atlas UV'); uv.active_render = True
    u0, v0, u1, v1 = cell_rect(cell); du, dv = (u1 - u0), (v1 - v0)
    pts = [v.co for v in ob.data.vertices]; lo = [min(p[k] for p in pts) for k in range(3)]; span = [max(1e-4, max(p[k] for p in pts) - lo[k]) for k in range(3)]
    for p in ob.data.polygons:
        k = max(range(3), key=lambda k: abs(p.normal[k])); axes = [a for a in range(3) if a != k]
        for li in p.loop_indices:
            v = ob.data.vertices[ob.data.loops[li].vertex_index].co
            a = (v[axes[0]] - lo[axes[0]]) / span[axes[0]]; b = (v[axes[1]] - lo[axes[1]]) / span[axes[1]]
            uv.data[li].uv = (u0 + du * (SW_INSET + (1 - 2 * SW_INSET) * a), v0 + dv * (SW_INSET + (1 - 2 * SW_INSET) * b))

def uv_fn(ob, fn):
    """fn(vertex_co, polygon) -> atlas (u, v). Used for the painted regions."""
    for layer in list(ob.data.uv_layers): ob.data.uv_layers.remove(layer)
    uv = ob.data.uv_layers.new(name='Original painted atlas UV'); uv.active_render = True
    for p in ob.data.polygons:
        for li in p.loop_indices:
            uv.data[li].uv = fn(ob.data.vertices[ob.data.loops[li].vertex_index].co, p)

def finish(ob, name, cell, bone, mat=0, smooth=True, weights=None, uv=None, face_cell=None):
    ob.name = name
    for p in ob.data.polygons: p.use_smooth = smooth
    if uv: uv_fn(ob, uv)
    else:
        uv_cell(ob, cell)
        if face_cell:  # per-face override of the swatch cell (e.g. zocalo band on the wall loft)
            layer = ob.data.uv_layers.active; u0, v0, u1, v1 = cell_rect(cell)
            for p in ob.data.polygons:
                c = face_cell(p.center, p.normal)
                if c is None or c == cell: continue
                a0, b0, a1, b1 = cell_rect(c)
                for li in p.loop_indices:
                    x, y = layer.data[li].uv; layer.data[li].uv = (a0 + (x - u0) / (u1 - u0) * (a1 - a0), b0 + (y - v0) / (v1 - v0) * (b1 - b0))
    ob.data.materials.append(MATS[mat]); groups = set()
    for v in ob.data.vertices:
        w = weights(v.co) if weights else {bone: 1.0}
        w = {b: x for b, x in w.items() if x > 1e-4}; total = sum(w.values()); assert total > 0, name
        for b, value in w.items():
            if b not in groups: ob.vertex_groups.new(name=b); groups.add(b)
            ob.vertex_groups[b].add([v.index], value / total, 'REPLACE')
    ob['source_part'] = name; ob['rigid_bone'] = bone if not weights else 'weighted'; ob['atlas_cell'] = cell if not uv else 'painted region'
    PARTS.append(ob); ob.select_set(False); return ob

def cleanup(data, merge=1e-6):
    bm = bmesh.new(); bm.from_mesh(data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=merge)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(data); bm.free(); data.update()

def mesh(name, verts, faces, cell, bone='body', mat=0, smooth=True, weights=None, uv=None, face_cell=None, merge=1e-6, recalc=True):
    data = bpy.data.meshes.new(name); data.from_pydata([tuple(v) for v in verts], [], faces); data.update()
    if recalc: cleanup(data, merge)
    ob = bpy.data.objects.new(name, data); bpy.context.collection.objects.link(ob)
    return finish(ob, name, cell, bone, mat, smooth, weights, uv, face_cell)

def soften(ob, width, segments=1, angle=.52, reproject=None):
    """Rounded toy edges on a flat-sided solid, then weighted authored normals."""
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    mod = ob.modifiers.new('Soft toy edge', 'BEVEL'); mod.width = width; mod.segments = segments; mod.limit_method = 'ANGLE'; mod.angle_limit = angle
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod = ob.modifiers.new('Weighted authored face normals', 'WEIGHTED_NORMAL'); mod.keep_sharp = True; bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in ob.data.polygons: p.use_smooth = True
    if reproject: reproject(ob)
    ob.select_set(False); return ob

def box(name, c, s, cell, bone='body', bevel=.008, mat=0, rot=(0, 0, 0), frame=None, weights=None):
    hx, hy, hz = s[0] / 2, s[1] / 2, s[2] / 2
    verts = [(x, y, z) for x in (-hx, hx) for y in (-hy, hy) for z in (-hz, hz)]
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    tr = (frame or Matrix.Identity(4)) @ Matrix.Translation(c) @ Euler(rot).to_matrix().to_4x4()
    ob = mesh(name, [tr @ Vector(v) for v in verts], faces, cell, bone, mat, False, weights)
    if bevel: soften(ob, bevel, 2, reproject=lambda o: uv_cell(o, cell))
    return ob

def rings(name, rr, cell, bone='body', mat=0, caps=True, smooth=True, weights=None, closed=True, uv=None, face_cell=None):
    n = len(rr[0]); verts = [p for r in rr for p in r]; faces = []; m = n if closed else n - 1
    for j in range(len(rr) - 1):
        for i in range(m): faces.append((j * n + i, j * n + (i + 1) % n, (j + 1) * n + (i + 1) % n, (j + 1) * n + i))
    if caps: faces.extend([tuple(range(n - 1, -1, -1)), tuple((len(rr) - 1) * n + i for i in range(n))])
    return mesh(name, verts, faces, cell, bone, mat, smooth, weights, uv, face_cell)

def ellipsoid(name, c, s, cell, bone='body', mat=0, n=12, r=6, rot=(0, 0, 0), frame=None, weights=None):
    tr = (frame or Matrix.Identity(4)) @ Matrix.Translation(c) @ Euler(rot).to_matrix().to_4x4(); verts = [tr @ Vector((0, 0, -s[2]))]
    for j in range(1, r):
        a = -math.pi / 2 + math.pi * j / r
        verts += [tr @ Vector((s[0] * math.cos(a) * math.cos(math.tau * i / n), s[1] * math.cos(a) * math.sin(math.tau * i / n), s[2] * math.sin(a))) for i in range(n)]
    verts.append(tr @ Vector((0, 0, s[2]))); top = len(verts) - 1; faces = []
    for i in range(n): faces.append((0, 1 + (i + 1) % n, 1 + i))
    for j in range(r - 2):
        for i in range(n): faces.append((1 + j * n + i, 1 + j * n + (i + 1) % n, 1 + (j + 1) * n + (i + 1) % n, 1 + (j + 1) * n + i))
    base = 1 + (r - 2) * n
    for i in range(n): faces.append((base + i, base + (i + 1) % n, top))
    return mesh(name, verts, faces, cell, bone, mat, True, weights)

def cylinder(name, c, r0, r1, depth, cell, bone='body', mat=0, n=12, rot=(0, 0, 0), frame=None, ey=1.0, weights=None, bevel=0):
    tr = (frame or Matrix.Identity(4)) @ Matrix.Translation(c) @ Euler(rot).to_matrix().to_4x4()
    rr = [[tr @ Vector((r * math.cos(math.tau * i / n), r * ey * math.sin(math.tau * i / n), z)) for i in range(n)] for z, r in ((-depth / 2, r0), (depth / 2, r1))]
    ob = rings(name, rr, cell, bone, mat, True, False, weights)
    if bevel: soften(ob, bevel, 1, reproject=lambda o: uv_cell(o, cell))
    return ob

def lathe(name, profile, cell, bone='body', mat=0, n=12, frame=None, weights=None):
    """profile: (z, r) pairs; zero radii collapse to a point."""
    tr = frame or Matrix.Identity(4); rr = [[tr @ Vector((r * math.cos(math.tau * i / n), r * math.sin(math.tau * i / n), z)) for i in range(n)] for z, r in profile]
    ob = rings(name, rr, cell, bone, mat, profile[0][1] > 1e-6 and profile[-1][1] > 1e-6, True, weights)
    return ob

def tube(name, points, radius, cell, bone='body', mat=0, n=6, closed_path=False, weights=None, caps=True):
    pts = [Vector(p) for p in points]; rr = []; count = len(pts)
    for i, p in enumerate(pts):
        if closed_path: tangent = (pts[(i + 1) % count] - pts[(i - 1) % count]).normalized()
        else: tangent = (pts[min(i + 1, count - 1)] - pts[max(i - 1, 0)]).normalized()
        hint = Vector((0, 1, 0)) if abs(tangent.y) < .9 else Vector((1, 0, 0))
        u = tangent.cross(hint).normalized(); v = tangent.cross(u).normalized(); rad = radius[i] if isinstance(radius, (list, tuple)) else radius
        rr.append([p + rad * (math.cos(math.tau * j / n) * u + math.sin(math.tau * j / n) * v) for j in range(n)])
    if closed_path:
        nv = n; verts = [p for r in rr for p in r]; faces = []
        for j in range(count):
            a, b = j, (j + 1) % count
            for i in range(nv): faces.append((a * nv + i, a * nv + (i + 1) % nv, b * nv + (i + 1) % nv, b * nv + i))
        return mesh(name, verts, faces, cell, bone, mat, True, weights)
    return rings(name, rr, cell, bone, mat, caps, True, weights)

def catmull(points, steps):
    p = [Vector(x) for x in points]; out = []
    for i in range(len(p) - 1):
        a, b, c, d = p[max(0, i - 1)], p[i], p[i + 1], p[min(i + 2, len(p) - 1)]
        for j in range(steps):
            t = j / steps; out.append(.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t))
    out.append(p[-1]); return out

def panel(name, outline, O, H, V, D, depth, cell, bone='body', mat=0, bevel=0., weights=None, uv=None, smooth=False):
    """Extrude a 2D outline (h, v) in the frame O + h*H + v*V, thickness along D (centred)."""
    O = Vector(O); H = Vector(H).normalized(); V = Vector(V).normalized(); D = Vector(D).normalized(); n = len(outline)
    verts = [O + H * h + V * v + D * t for t in (-depth / 2, depth / 2) for h, v in outline]
    faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))] + [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    ob = mesh(name, verts, faces, cell, bone, mat, smooth, weights, uv)
    if bevel: soften(ob, bevel, 1, reproject=(lambda o: uv_fn(o, uv)) if uv else (lambda o: uv_cell(o, cell)))
    else:
        bpy.context.view_layer.objects.active = ob; ob.select_set(True)
        mod = ob.modifiers.new('Weighted authored face normals', 'WEIGHTED_NORMAL'); mod.keep_sharp = True; bpy.ops.object.modifier_apply(modifier=mod.name)
        for p in ob.data.polygons: p.use_smooth = True
        ob.select_set(False)
    return ob

def smooth(t): t = max(0., min(1., t)); return t * t * (3 - 2 * t)
