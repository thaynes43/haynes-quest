"""Action minions A v001: shared Blender helpers for the three ordinary-enemy candidates.

Mesh helpers (rigid parts, lathes, tubes, extruded plates, ribbons) are adapted from the WO111
mischief-kitten / lab-robot v001 common.py (per-face atlas tiles, bisected paint bands, weighted
normals). New here:

* an 8 x 8 tile atlas (128 px tiles) painted procedurally with numpy as soft "clay" pigment,
  one 1024 x 1024 image shared by both materials (matte clay and glossy toy);
* tent weights along joint chains (hose arms, springs, tails) so moving the joints bends and
  stretches the part smoothly;
* a world-delta pose framework: an animation computes, per bone, the world transform D that maps
  rest geometry to posed geometry (exactly the skinning matrix). The baker converts D into Blender
  pose-bone bases (asserting no shear), keys them at 60 fps and stores one muted NLA track per clip;
* a GLB export that writes only identity extras on the glTF scene (lease properties are not exported).

All authored coordinates are Blender +Z up / +Y forward, character right = +X. The glTF exporter
maps them to +Y up / -Z forward. No startup reset or add-on changes are used.
"""
import bpy, bmesh, math, json, hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix, Euler, Quaternion

PARTS = []; MATS = []; ROOT = None; TILES = {}
GRID = 8
TILE_INSET = .14; TILE_SPAN = .72
MATTE = 0; GLOSS = 1
PACK = Path('/workspace/haynes-quest/action-worlds/minions-a/v001')

def V(*a): return Vector(a)

# ------------------------------------------------------------------ scene and atlas
def clear_scene():
    if bpy.context.object and bpy.context.object.mode != 'OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    for blocks in (bpy.data.meshes, bpy.data.armatures, bpy.data.materials, bpy.data.actions, bpy.data.images, bpy.data.textures,
                   bpy.data.curves, bpy.data.cameras, bpy.data.lights, bpy.data.node_groups, bpy.data.texts):
        for block in list(blocks): blocks.remove(block)
    for col in list(bpy.data.collections): bpy.data.collections.remove(col)
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)

def hexrgb(h):
    h = h.lstrip('#'); return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]

def paint_atlas(path, palette, seed=7):
    """palette: list of (name, hex, mottling, gradient). Tile i holds palette[i]; tiles are soft clay colour
    fields (low-frequency mottling plus a gentle top-to-bottom shade), never text, logos or photos."""
    assert len(palette) <= GRID * GRID
    size = 1024; t = size // GRID; rng = np.random.default_rng(seed)
    img = np.zeros((size, size, 4), np.float32); img[..., 3] = 1
    yy, xx = np.mgrid[0:t, 0:t] / t
    for i, (name, hx, mottle, grad) in enumerate(palette):
        base = np.array(hexrgb(hx), np.float32)
        noise = np.zeros((t, t), np.float32)
        for k, amp in ((2, .6), (5, .3), (11, .12)):
            ph = rng.uniform(0, math.tau, 4)
            noise += amp * np.sin(math.tau * k * xx + ph[0]) * np.sin(math.tau * (k + 1) * yy + ph[1])
        shade = 1 + mottle * noise + grad * (yy - .5)
        tile = np.clip(base[None, None, :] * shade[..., None], 0, 1)
        r, c = i // GRID, i % GRID
        y0 = size - (r + 1) * t  # Blender images start at the bottom row
        img[y0:y0 + t, c * t:(c + 1) * t, :3] = tile
        TILES[name] = i
    image = bpy.data.images.new('atlas', size, size, alpha=False)
    image.pixels.foreach_set(img.ravel())
    image.filepath_raw = str(path); image.file_format = 'PNG'; image.save()
    bpy.data.images.remove(image)
    return path

def setup(asset_root, palette, atlas_name, seed=7):
    global ROOT
    ROOT = Path(asset_root); ROOT.mkdir(parents=True, exist_ok=True)
    clear_scene(); PARTS.clear(); MATS.clear(); TILES.clear()
    sc = bpy.context.scene; sc.unit_settings.system = 'METRIC'; sc.unit_settings.scale_length = 1
    paint_atlas(ROOT / 'pigment.png', palette, seed)
    image = bpy.data.images.load(str(ROOT / 'pigment.png'), check_existing=False); image.name = atlas_name; image.pack()
    for label, rough in (('Matte painted clay', .62), ('Glossy toy accents', .26)):
        mat = bpy.data.materials.new(label); mat.use_nodes = True; bs = mat.node_tree.nodes.get('Principled BSDF')
        bs.inputs['Roughness'].default_value = rough; bs.inputs['Metallic'].default_value = 0; bs.inputs['Specular IOR Level'].default_value = .35 if rough < .5 else .28
        tex = mat.node_tree.nodes.new('ShaderNodeTexImage'); tex.image = image; tex.extension = 'EXTEND'
        mat.node_tree.links.new(tex.outputs['Color'], bs.inputs['Base Color']); MATS.append(mat)

def T(name):
    return TILES[name] if isinstance(name, str) else name

def tile_uv(t, u, v):
    return ((t % GRID + TILE_INSET + TILE_SPAN * u) / GRID, (GRID - 1 - t // GRID + TILE_INSET + TILE_SPAN * v) / GRID)

# ------------------------------------------------------------------ parts
def uv_project(ob, tile, face_tile=None):
    for layer in list(ob.data.uv_layers): ob.data.uv_layers.remove(layer)
    uv = ob.data.uv_layers.new(name='Painted atlas UV'); uv.active_render = True
    pts = [v.co for v in ob.data.vertices]; lo = [min(p[k] for p in pts) for k in range(3)]; span = [max(1e-4, max(p[k] for p in pts) - lo[k]) for k in range(3)]
    for p in ob.data.polygons:
        t = T(tile)
        if face_tile:
            chosen = face_tile(p.center, p.normal)
            if chosen is not None: t = T(chosen)
        k = max(range(3), key=lambda k: abs(p.normal[k])); axes = [a for a in range(3) if a != k]
        for li in p.loop_indices:
            v = ob.data.vertices[ob.data.loops[li].vertex_index].co
            uv.data[li].uv = tile_uv(t, (v[axes[0]] - lo[axes[0]]) / span[axes[0]], (v[axes[1]] - lo[axes[1]]) / span[axes[1]])

def finish(ob, name, tile, bn, mat=MATTE, smooth=True, weights=None, face_tile=None):
    ob.name = name
    for p in ob.data.polygons: p.use_smooth = smooth
    uv_project(ob, tile, face_tile); ob.data.materials.append(MATS[mat]); groups = set()
    for v in ob.data.vertices:
        w = weights(v.co) if weights else {bn: 1.0}
        w = {b: x for b, x in w.items() if x > 1e-4}
        w = dict(sorted(w.items(), key=lambda kv: -kv[1])[:4])
        total = sum(w.values()); assert total > 0, (name, v.co)
        for b, value in w.items():
            if b not in groups: ob.vertex_groups.new(name=b); groups.add(b)
            ob.vertex_groups[b].add([v.index], value / total, 'REPLACE')
    ob['source_part'] = name; ob['rigid_bone'] = bn if not weights else 'weighted'; ob['atlas_tile'] = T(tile)
    PARTS.append(ob); ob.select_set(False); return ob

def cut(data, planes):
    if not planes: return
    bm = bmesh.new(); bm.from_mesh(data)
    for co, no in planes:
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=Vector(co), plane_no=Vector(no).normalized(), dist=1e-6)
    bm.to_mesh(data); bm.free(); data.update()

def mesh(name, verts, faces, tile, bn='body', mat=MATTE, smooth=True, weights=None, face_tile=None, planes=None, transform=None):
    if transform is not None: verts = [tuple(transform @ Vector(v)) for v in verts]
    data = bpy.data.meshes.new(name); data.from_pydata(verts, [], faces); data.update()
    bm = bmesh.new(); bm.from_mesh(data); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(data); bm.free()
    cut(data, planes)
    ob = bpy.data.objects.new(name, data); bpy.context.collection.objects.link(ob)
    return finish(ob, name, tile, bn, mat, smooth, weights, face_tile)

def weighted_normals(ob):
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    mod = ob.modifiers.new('Weighted face normals', 'WEIGHTED_NORMAL'); mod.keep_sharp = True; bpy.ops.object.modifier_apply(modifier=mod.name)
    ob.select_set(False)

def box(name, c, s, tile, bn='body', bevel=.01, segments=2, mat=MATTE, rot=(0, 0, 0), weights=None, transform=None, face_tile=None, planes=None, subdiv=0):
    """Bevelled box; s is the full size. subdiv adds loop cuts so a bent weight map can deform it."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0), rotation=(0, 0, 0)); ob = bpy.context.object; ob.scale = s
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if subdiv:
        bm = bmesh.new(); bm.from_mesh(ob.data)
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=subdiv, use_grid_fill=True); bm.to_mesh(ob.data); bm.free()
    if planes: cut(ob.data, [(Vector(co) - Vector(c), no) for co, no in planes])
    if bevel:
        mod = ob.modifiers.new('Soft toy edge', 'BEVEL'); mod.width = bevel; mod.segments = segments; mod.limit_method = 'ANGLE'; mod.angle_limit = math.radians(50)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    tr = Matrix.Translation(c) @ Euler(rot).to_matrix().to_4x4()
    if transform is not None: tr = transform @ tr
    for v in ob.data.vertices: v.co = tr @ v.co
    finish(ob, name, tile, bn, mat, True, weights, face_tile)
    if bevel: weighted_normals(ob)
    return ob

def rings(name, rr, tile, bn='body', mat=MATTE, caps=True, smooth=True, weights=None, face_tile=None, planes=None, closed=True, transform=None):
    n = len(rr[0]); verts = [p for r in rr for p in r]; faces = []
    m = n if closed else n - 1
    for j in range(len(rr) - 1):
        for i in range(m): faces.append((j * n + i, j * n + (i + 1) % n, (j + 1) * n + (i + 1) % n, (j + 1) * n + i))
    if caps is True: caps = (True, True)
    if caps:
        if caps[0]: faces.append(tuple(range(n - 1, -1, -1)))
        if caps[1]: faces.append(tuple((len(rr) - 1) * n + i for i in range(n)))
    return mesh(name, verts, faces, tile, bn, mat, smooth, weights, face_tile, planes, transform)

def ellipsoid(name, c, s, tile, bn='body', mat=MATTE, n=24, r=12, rot=(0, 0, 0), weights=None, transform=None, face_tile=None, planes=None):
    n = max(6, round(n / 2) * 2); r = max(4, round(r))
    tr = Matrix.Translation(c) @ Euler(rot).to_matrix().to_4x4()
    if transform is not None: tr = transform @ tr
    verts = [tuple(tr @ V(0, 0, -s[2]))]
    for j in range(1, r):
        a = -math.pi / 2 + math.pi * j / r; ca = math.cos(a)
        verts += [tuple(tr @ V(s[0] * ca * math.cos(math.tau * i / n), s[1] * ca * math.sin(math.tau * i / n), s[2] * math.sin(a))) for i in range(n)]
    verts.append(tuple(tr @ V(0, 0, s[2])))
    faces = [(0, 1 + (i + 1) % n, 1 + i) for i in range(n)]
    for j in range(r - 2):
        for i in range(n): faces.append((1 + j * n + i, 1 + j * n + (i + 1) % n, 1 + (j + 1) * n + (i + 1) % n, 1 + (j + 1) * n + i))
    top = len(verts) - 1; base = 1 + (r - 2) * n
    faces += [(base + i, base + (i + 1) % n, top) for i in range(n)]
    return mesh(name, verts, faces, tile, bn, mat, True, weights, face_tile, planes)

def lathe(name, c, profile, tile, bn='body', mat=MATTE, n=32, axis='z', caps=True, weights=None, face_tile=None, ey=1.0, transform=None, planes=None, smooth=True):
    """Surface of revolution; profile is (distance along axis, radius); ey scales the second radial axis."""
    rr = []
    for d, radius in profile:
        row = []
        for i in range(n):
            a = math.tau * i / n; u = radius * math.cos(a); v = radius * ey * math.sin(a)
            if axis == 'z': p = (c[0] + u, c[1] + v, c[2] + d)
            elif axis == 'x': p = (c[0] + d, c[1] + u, c[2] + v)
            else: p = (c[0] + u, c[1] + d, c[2] + v)
            row.append(p)
        rr.append(row)
    return rings(name, rr, tile, bn, mat, caps, smooth, weights, face_tile, planes, True, transform)

def frames(pts, hint=(0, 1, 0)):
    """Parallel-transport tangent frames (tangent, u, v) along a polyline."""
    out = []; h = Vector(hint)
    t0 = (pts[1] - pts[0]).normalized(); u = t0.cross(h)
    if u.length < 1e-6: u = t0.cross(Vector((1, 0, 0)))
    u.normalize()
    for i, p in enumerate(pts):
        tangent = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        u = (u - tangent * u.dot(tangent))
        if u.length < 1e-8: u = tangent.cross(h)
        u.normalize(); v = u.cross(tangent).normalized(); out.append((tangent, u, v))
    return out

def tube(name, points, radii, tile, bn='body', mat=MATTE, n=10, weights=None, hint=(0, 1, 0), caps=True, squash=1.0, face_tile=None, transform=None):
    pts = [Vector(p) for p in points]; rr = []
    for i, (p, (t, u, v)) in enumerate(zip(pts, frames(pts, hint))):
        radius = radii[i] if isinstance(radii, (tuple, list)) else radii
        rr.append([p + radius * (math.cos(math.tau * j / n) * u + squash * math.sin(math.tau * j / n) * v) for j in range(n)])
    return rings(name, rr, tile, bn, mat, caps, True, weights, face_tile, None, True, transform)

def plate(name, outline, depth, tile, bn='body', mat=MATTE, bevel=.012, segments=2, transform=None, face_tile=None, weights=None):
    """Extruded rounded plate from an (x, z) outline centred on y=0 (front face at +depth/2); optional placement matrix."""
    n = len(outline); verts = [(x, yy, z) for yy in (-depth / 2, depth / 2) for x, z in outline]; faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
    faces.extend((i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n))
    data = bpy.data.meshes.new(name); data.from_pydata(verts, [], faces); data.update()
    bm = bmesh.new(); bm.from_mesh(data); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4], quad_method='BEAUTY', ngon_method='BEAUTY'); bm.to_mesh(data); bm.free()
    ob = bpy.data.objects.new(name, data); bpy.context.collection.objects.link(ob)
    if bevel:
        bpy.context.view_layer.objects.active = ob; ob.select_set(True)
        mod = ob.modifiers.new('Rounded outline', 'BEVEL'); mod.width = bevel; mod.segments = segments; mod.limit_method = 'ANGLE'; mod.angle_limit = .9
        bpy.ops.object.modifier_apply(modifier=mod.name); ob.select_set(False)
    if transform is not None:
        for v in ob.data.vertices: v.co = transform @ v.co
    finish(ob, name, tile, bn, mat, True, weights, face_tile)
    weighted_normals(ob)
    return ob

def bezier(p0, p1, p2, p3, n):
    out = []
    for i in range(n + 1):
        t = i / n; a = 1 - t
        out.append(a ** 3 * p0 + 3 * a * a * t * p1 + 3 * a * t * t * p2 + t ** 3 * p3)
    return out

def arclength(pts):
    s = [0.0]
    for a, b in zip(pts, pts[1:]): s.append(s[-1] + (b - a).length)
    return s

def resample(path, fractions):
    acc = arclength(path); total = acc[-1]; out = []; j = 0
    for f in fractions:
        s = f * total
        while j < len(path) - 2 and acc[j + 1] < s: j += 1
        k = min(j, len(path) - 2); u = (s - acc[k]) / max(1e-12, acc[k + 1] - acc[k])
        out.append(path[k].lerp(path[k + 1], max(0.0, min(1.0, u))))
    return out

def smooth(t): t = max(0, min(1, t)); return t * t * (3 - 2 * t)
def bell(t, c, w): return smooth(1 - abs(t - c) / w)

def chain_weights(joints, names, falloff_end=None):
    """Tent weights along a joint polyline: a point projected to arc-length s between joints k and k+1 gets
    (1-f) on names[k] and f on names[k+1]; beyond the ends it is rigid to the end bones."""
    J = [Vector(j) for j in joints]; acc = arclength(J)
    def w(p):
        p = Vector(p); best = None
        for k in range(len(J) - 1):
            a, b = J[k], J[k + 1]; d = b - a; L2 = max(1e-12, d.length_squared)
            u = max(0.0, min(1.0, (p - a).dot(d) / L2)); dist = (p - (a + d * u)).length
            if best is None or dist < best[0] - 1e-9: best = (dist, k, u)
        _, k, u = best
        s = smooth(u) if falloff_end is None else u
        out = {names[k]: 1 - s}; out[names[k + 1]] = out.get(names[k + 1], 0) + s
        return out
    return w

# ------------------------------------------------------------------ skin and rig
def join_skin(skin_name, parts_collection_name):
    sc = bpy.context.scene
    for pi, ob in enumerate(PARTS):
        at = ob.data.attributes.new('mn_part', 'INT', 'POINT'); at.data.foreach_set('value', [pi] * len(ob.data.vertices))
    sources = bpy.data.collections.new(parts_collection_name); sc.collection.children.link(sources)
    inventory = []; copies = []
    for ob in PARTS:
        ob.data.calc_loop_triangles()
        inventory.append({'name': ob.name, 'triangles': len(ob.data.loop_triangles), 'bones': sorted(g.name for g in ob.vertex_groups), 'atlas_tile': ob.get('atlas_tile'), 'material': ob.data.materials[0].name})
        cp = ob.copy(); cp.data = ob.data.copy(); sc.collection.objects.link(cp); copies.append(cp)
        for col in list(ob.users_collection): col.objects.unlink(ob)
        sources.objects.link(ob)
    sources.hide_render = True; sources.hide_viewport = True
    bpy.ops.object.select_all(action='DESELECT')
    for ob in copies: ob.select_set(True)
    bpy.context.view_layer.objects.active = copies[0]; bpy.ops.object.join(); skin = bpy.context.object; skin.name = skin_name; skin.data.name = skin_name + ' mesh'
    for tag in ['source_part', 'rigid_bone', 'atlas_tile']:
        if tag in skin: del skin[tag]
    # sort material slots so the matte material is primitive 0
    return skin, inventory

def build_rig(rig_name, rest, skin):
    """rest: name -> (head, tail, parent, roll_vector_or_None, deform)."""
    sc = bpy.context.scene
    data = bpy.data.armatures.new(rig_name + ' armature'); arm = bpy.data.objects.new(rig_name, data); sc.collection.objects.link(arm)
    bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='EDIT')
    for name, (h, t, parent, roll, deform) in rest.items():
        b = data.edit_bones.new(name); b.head = h; b.tail = t
        if roll is not None: b.align_roll(Vector(roll))
        if parent: b.parent = data.edit_bones[parent]; b.use_connect = False
        b.use_deform = deform
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'
    mod = skin.modifiers.new('Skinned to rig', 'ARMATURE'); mod.object = arm; skin.parent = arm
    missing = sorted({g.name for g in skin.vertex_groups} - set(rest)); assert not missing, missing
    nondeform = sorted({g.name for g in skin.vertex_groups} & {n for n, r in rest.items() if not r[4]}); assert not nondeform, nondeform
    return arm

def tris_of(ob):
    ob.data.calc_loop_triangles(); return len(ob.data.loop_triangles)

# ------------------------------------------------------------------ pose framework
def rot_about(p, q):
    """World transform rotating by quaternion/euler/matrix q about point p."""
    if isinstance(q, Euler): q = q.to_quaternion()
    R = q.to_matrix().to_4x4() if isinstance(q, Quaternion) else q.to_4x4() if len(q) == 3 else q
    return Matrix.Translation(p) @ R @ Matrix.Translation(-Vector(p))

def scale_about(p, frame3, s):
    """Scale by s=(sx,sy,sz) along the columns of the 3x3 frame, about point p."""
    F = frame3.to_4x4(); S = Matrix.Diagonal((s[0], s[1], s[2], 1))
    return Matrix.Translation(p) @ F @ S @ F.inverted() @ Matrix.Translation(-Vector(p))

def frame_to(rest_head, rest_frame3, new_head, new_frame3):
    """Rigid world delta taking a rest point/frame to a new point/frame."""
    R = (new_frame3 @ rest_frame3.inverted()).to_4x4()
    return Matrix.Translation(new_head) @ R @ Matrix.Translation(-Vector(rest_head))

def look_frame(tangent, up_hint):
    """Orthonormal 3x3 whose columns are (side, tangent, normal) with Y along the tangent (Blender bone convention)."""
    y = Vector(tangent).normalized(); x = y.cross(Vector(up_hint))
    if x.length < 1e-6: x = y.cross(Vector((1, 0, 0)))
    x.normalize(); z = x.cross(y).normalized()
    return Matrix((x, y, z)).transposed()

class Rig:
    def __init__(self, arm):
        self.arm = arm; bones = arm.data.bones
        self.REST = {b.name: b.matrix_local.copy() for b in bones}
        self.PARENT = {b.name: (b.parent.name if b.parent else None) for b in bones}
        depth = lambda n: 0 if self.PARENT[n] is None else 1 + depth(self.PARENT[n])
        self.ORDER = sorted(self.REST, key=depth)
    def head(self, n): return self.REST[n].translation.copy()
    def frame(self, n): return self.REST[n].to_3x3().normalized()
    def complete(self, D):
        """Fill unposed bones with their parent's delta (rigid follow)."""
        out = {}
        for n in self.ORDER:
            out[n] = D[n] if n in D else (out[self.PARENT[n]] if self.PARENT[n] else Matrix.Identity(4))
        return out
    def bases(self, D):
        D = self.complete(D); P = {n: D[n] @ self.REST[n] for n in self.ORDER}; out = {}; worst = 0.0
        for n in self.ORDER:
            p = self.PARENT[n]
            B = (self.REST[n].inverted() @ P[n]) if p is None else ((self.REST[p].inverted() @ self.REST[n]).inverted() @ (P[p].inverted() @ P[n]))
            loc, rot, sca = B.decompose()
            R = Matrix.Translation(loc) @ rot.to_matrix().to_4x4() @ Matrix.Diagonal((sca[0], sca[1], sca[2], 1))
            worst = max(worst, max(abs(R[i][j] - B[i][j]) for i in range(4) for j in range(4)))
            out[n] = (loc, rot, sca)
        return out, worst, D

def bake(rig, clips, evaluate, fps=60, scaled=(), report=None):
    """clips: [(name, seconds, loop)]; evaluate(name, t_seconds) -> {bone: world delta}. One muted NLA track per clip."""
    arm = rig.arm; sc = bpy.context.scene; sc.render.fps = fps; sc.render.fps_base = 1
    arm.animation_data_clear(); arm.animation_data_create()
    for action in list(bpy.data.actions): bpy.data.actions.remove(action)
    records = []; worst_all = 0.0
    for name, duration, loop in clips:
        action = bpy.data.actions.new(name); arm.animation_data.action = action; end = round(duration * fps); prev = {}
        for frame in range(end + 1):
            B, worst, _ = rig.bases(evaluate(name, frame / fps)); worst_all = max(worst_all, worst)
            for pb in arm.pose.bones:
                if pb.name == 'root': continue
                loc, rot, sca = B[pb.name]
                if pb.name in prev: rot.make_compatible(prev[pb.name])
                prev[pb.name] = rot.copy()
                pb.location = loc; pb.rotation_quaternion = rot; pb.scale = sca if pb.name in scaled else Vector((1, 1, 1))
                if pb.name not in scaled: assert (Vector(sca) - Vector((1, 1, 1))).length < 1e-4, ('unexpected scale', name, frame, pb.name, tuple(sca))
                pb.keyframe_insert('location', frame=frame, group=pb.name); pb.keyframe_insert('rotation_quaternion', frame=frame, group=pb.name)
                if pb.name in scaled: pb.keyframe_insert('scale', frame=frame, group=pb.name)
        for fc in action.fcurves:
            for k in fc.keyframe_points: k.interpolation = 'LINEAR'
        track = arm.animation_data.nla_tracks.new(); track.name = name; strip = track.strips.new(name, 0, action)
        strip.action_frame_start = 0; strip.action_frame_end = end; track.mute = True
        rec = {'name': name, 'duration_s': duration, 'loop': loop, 'frames': end + 1, 'fps': fps}
        if report: rec.update(report.get(name, {}))
        records.append(rec)
    assert worst_all < 1e-5, ('a bone basis carries shear', worst_all)
    arm.animation_data.action = None
    for pb in arm.pose.bones: pb.matrix_basis = Matrix.Identity(4)
    sc.frame_set(0); bpy.context.view_layer.update()
    return records, worst_all

def set_pose(rig, D):
    B, worst, _ = rig.bases(D)
    for pb in rig.arm.pose.bones:
        loc, rot, sca = B[pb.name]; pb.location = loc; pb.rotation_quaternion = rot; pb.scale = sca
    bpy.context.view_layer.update(); return worst

def posed_points(skin):
    dg = bpy.context.evaluated_depsgraph_get(); ev = skin.evaluated_get(dg); me = ev.to_mesh()
    pts = [skin.matrix_world @ v.co for v in me.vertices]; ev.to_mesh_clear(); return pts

# ------------------------------------------------------------------ export
IDENTITY_KEYS = ('asset_id', 'asset_version', 'pack', 'candidate_status', 'source_reference', 'source_concept_sha256', 'orientation', 'role', 'authoring_model', 'design')

def export_glb(path, skin, arm, identity):
    """Export the selected skin + rig. Only identity keys reach the glTF scene extras; lease keys are restored after."""
    sc = bpy.context.scene; saved = {k: sc[k] for k in list(sc.keys()) if not k.startswith(('cycles', 'blendermcp'))}
    try:
        for k in list(saved): del sc[k]
        for k, v in identity.items():
            assert k in IDENTITY_KEYS, k; sc[k] = v
        bpy.ops.object.select_all(action='DESELECT'); skin.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
        bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, export_yup=True, export_animations=True, export_animation_mode='NLA_TRACKS',
                                  export_optimize_animation_size=False, export_skins=True, export_def_bones=False, export_armature_object_remove=True, export_all_influences=False,
                                  export_influence_nb=4, export_apply=False, export_texcoords=True, export_normals=True, export_tangents=False, export_materials='EXPORT',
                                  export_vertex_color='NONE', export_image_format='AUTO', export_cameras=False, export_lights=False, export_extras=True)
    finally:
        for k in list(sc.keys()):
            if not k.startswith(('cycles', 'blendermcp')): del sc[k]
        for k, v in saved.items(): sc[k] = v
    return path

def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def guard(asset_id):
    sc = bpy.context.scene
    assert sc.get('work_order') == 'action-worlds/minions-a' and sc.get('scene_lease') == 'active' and str(sc.get('scene_owner', '')).startswith('claude-opus-5-5'), 'lease not held'
    sc['current_asset'] = asset_id
