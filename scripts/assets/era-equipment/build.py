"""WO-017 original rigid equipment, Blender 4.5.13 LTS.

Requires the exclusive scene lease. Never factory-reset or unload the addon.
Master files preserve named editable parts; export duplicates are joined into
one static mesh with at most five material primitives. Authoring +Z up/+Y front
becomes glTF +Y up/-Z front, in meters. Every mesh origin is the physical grip.
"""
import argparse
import bmesh
import bpy
import hashlib
import json
import math
from pathlib import Path
import sys
from mathutils import Vector

ROOT = Path('/workspace/haynes-quest/era-equipment/v001')
PARTS = []
MATS = {}
NAMES = ['spark-mallet', 'acorn-shield', 'prism-wand', 'ribbon-shield']
SPECS = {
    'spark-mallet': {'height': .55, 'grip_raw_blender': [0, 0, .111], 'grip_axis_gltf': [0, 1, 0], 'grip_diameter_m': .045},
    'acorn-shield': {'height': .40, 'grip_raw_blender': [0, -.070, -.083], 'grip_axis_gltf': [1, 0, 0], 'grip_diameter_m': .024},
    'prism-wand': {'height': .65, 'grip_raw_blender': [0, 0, .110], 'grip_axis_gltf': [0, 1, 0], 'grip_diameter_m': .037},
    'ribbon-shield': {'height': .48, 'grip_raw_blender': [.075, -.072, 0], 'grip_axis_gltf': [0, 1, 0], 'grip_diameter_m': .027},
}


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def srgb(v):
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4


def reset():
    global PARTS, MATS
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for collection in list(bpy.data.collections):
        if collection.users == 0:
            bpy.data.collections.remove(collection)
    for store in [bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.images, bpy.data.cameras, bpy.data.lights]:
        for item in list(store):
            if item.users == 0:
                store.remove(item)
    PARTS, MATS = [], {}
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1
    scene['work_order'] = 'WO-017'
    scene['candidate_status'] = 'unapproved'


def palette(root):
    for name, roughness, metallic in [('walnut', .76, 0), ('brass', .43, .66), ('sage', .88, 0), ('plum', .64, 0), ('amber', .27, .04)]:
        material = bpy.data.materials.new(name.title())
        material.use_nodes = True
        nodes, links = material.node_tree.nodes, material.node_tree.links
        bsdf = nodes.get('Principled BSDF')
        bsdf.inputs['Roughness'].default_value = roughness
        bsdf.inputs['Metallic'].default_value = metallic
        bsdf.inputs['Specular IOR Level'].default_value = .36
        if name == 'amber':
            color = tuple(srgb(v) for v in (.99, .61, .17))
            bsdf.inputs['Base Color'].default_value = (*color, 1)
            bsdf.inputs['Emission Color'].default_value = (*color, 1)
            bsdf.inputs['Emission Strength'].default_value = .22
            material.diffuse_color = (*color, 1)
        else:
            image = bpy.data.images.load(str(root / 'textures' / (name + '.png')), check_existing=True)
            image.colorspace_settings.name = 'sRGB'
            image.pack()
            texture = nodes.new('ShaderNodeTexImage')
            texture.image = image
            texture.name = 'Original 512px baked directional pigment'
            texture.interpolation = 'Linear'
            links.new(texture.outputs['Color'], bsdf.inputs['Base Color'])
        MATS[name] = material


def finish_mesh(obj, material, smooth=True):
    obj.data.materials.append(MATS[material])
    bm = bmesh.new(); bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data); bm.free()
    for face in obj.data.polygons:
        face.use_smooth = smooth
    # Stable box projection is readable on shield faces and end grain. Tube
    # builders replace this with continuous longitudinal coordinates below.
    uv = obj.data.uv_layers.new(name='PigmentUV')
    for face in obj.data.polygons:
        axis = max(range(3), key=lambda k: abs(face.normal[k]))
        for loop_index in face.loop_indices:
            p = obj.data.vertices[obj.data.loops[loop_index].vertex_index].co
            coords = (p.x, p.z) if axis == 1 else ((p.y, p.z) if axis == 0 else (p.x, p.y))
            uv.data[loop_index].uv = (coords[0] / .31 + .5, coords[1] / .48 + .5)
    obj['construction_part'] = obj.name
    PARTS.append(obj)
    return obj


def mesh(name, vertices, faces, material, smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces); data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return finish_mesh(obj, material, smooth)


def ringmesh(name, rows, material, smooth=True, caps=True, close_rows=False):
    n = len(rows[0]); vertices = [p for row in rows for p in row]; faces = []
    intervals = len(rows) if close_rows else len(rows) - 1
    for j in range(intervals):
        next_j = (j + 1) % len(rows)
        for i in range(n):
            ni = (i + 1) % n
            faces.append((j * n + i, j * n + ni, next_j * n + ni, next_j * n + i))
    if caps and not close_rows:
        faces.extend([tuple(range(n - 1, -1, -1)), tuple((len(rows) - 1) * n + i for i in range(n))])
    obj = mesh(name, vertices, faces, material, smooth)
    uv = obj.data.uv_layers.active
    for face in obj.data.polygons[:intervals * n]:
        strip = face.index % n
        for li in face.loop_indices:
            vi = obj.data.loops[li].vertex_index
            column, row = vi % n, vi // n
            u = column / n
            if strip == n - 1 and column == 0:
                u = 1
            uv.data[li].uv = (u, row / max(1, len(rows) - 1))
    return obj


def lathe(name, center, profile, material, axis='z', sides=20, smooth=True):
    c = Vector(center); rows = []
    for length, radius in profile:
        row = []
        for i in range(sides):
            a = math.tau * i / sides
            p = {'x': (length, radius * math.cos(a), radius * math.sin(a)), 'y': (radius * math.cos(a), length, radius * math.sin(a)), 'z': (radius * math.cos(a), radius * math.sin(a), length)}[axis]
            row.append(c + Vector(p))
        rows.append(row)
    return ringmesh(name, rows, material, smooth)


def tube(name, points, radii, material, sides=8, elliptic=1):
    points = [Vector(p) for p in points]; rows = []
    for j, p in enumerate(points):
        tangent = (points[min(j + 1, len(points) - 1)] - points[max(0, j - 1)]).normalized()
        axis = Vector((0, 1, 0))
        if abs(tangent.dot(axis)) > .9:
            axis = Vector((1, 0, 0))
        u = tangent.cross(axis).normalized(); v = tangent.cross(u).normalized()
        r = radii[j] if isinstance(radii, list) else radii
        rows.append([p + r * (math.cos(i * math.tau / sides) * u + elliptic * math.sin(i * math.tau / sides) * v) for i in range(sides)])
    return ringmesh(name, rows, material)


def rounded_box(name, center, size, material, bevel=.004):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object; obj.name = name; obj.scale = size
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if bevel:
        mod = obj.modifiers.new('Soft crafted edge', 'BEVEL'); mod.width = bevel; mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.select_set(False)
    return finish_mesh(obj, material)


def rivet(name, center, radius=.008, front=1, axis='y'):
    return lathe(name, center, [(0, radius * .82), (.002 * front, radius), (.006 * front, radius * .73), (.007 * front, radius * .14)], 'brass', axis=axis, sides=10)


def spiral(name, center, radius, material='brass', plane='xz', turns=1.7, thickness=.0013):
    points = []
    for i in range(29):
        t = i / 28; a = math.tau * turns * t; r = radius * (.10 + .85 * t)
        p = (r * math.cos(a), 0, r * math.sin(a)) if plane == 'xz' else (0, r * math.cos(a), r * math.sin(a))
        points.append(Vector(center) + Vector(p))
    return tube(name, points, thickness, material, sides=4)


def wrapped_grip(name, start, end, radius, material, turns=4):
    lathe(name + ' soft grip body', (0, 0, 0), [(start, radius * .83), (start + .006, radius), (end - .006, radius * .96), (end, radius * .82)], material, sides=16)
    points = []
    for i in range(65):
        t = i / 64; a = math.tau * turns * t
        points.append((radius * math.cos(a), radius * math.sin(a), start + .008 + t * (end - start - .016)))
    tube(name + ' broad wrap overlap', points, .0028, material, sides=4)


def mallet():
    lathe('Mallet barrel carved walnut', (0, 0, .435), [(-.164, .076), (-.158, .092), (-.136, .101), (-.075, .112), (0, .115), (.075, .112), (.136, .101), (.158, .092), (.164, .076)], 'walnut', 'x', 24)
    for sign, side in [(-1, 'left'), (1, 'right')]:
        lathe('Mallet ' + side + ' rounded brass hoop', (sign * .139, 0, .435), [(-.015, .096), (-.012, .108), (-.006, .112), (.008, .112), (.014, .104), (.015, .096)], 'brass', 'x', 24)
        # An annular raised walnut lip holds the amber lens below the rim.
        x = sign * .164
        rows = []
        for dx, r in [(0, .075), (.006, .071), (.008, .042), (.001, .038), (-.005, .040)]:
            rows.append([(x + sign * dx, r * math.cos(i * math.tau / 24), .435 + r * math.sin(i * math.tau / 24)) for i in range(24)])
        ringmesh('Mallet ' + side + ' lens socket', rows, 'walnut', caps=False, close_rows=True)
        lathe('Mallet ' + side + ' inset amber lens', (x, 0, .435), [(-.007 * sign, .031), (0, .039), (.004 * sign, .030), (.005 * sign, .008)], 'amber', 'x', 20)
        for k in range(5):
            a = math.tau * (k + .25) / 5
            p = Vector((sign * .141, .111 * math.cos(a), .435 + .111 * math.sin(a)))
            # Low golden square pegs are visible hardware, with no sharp spikes.
            obj = rivet('Mallet ' + side + ' hoop peg ' + str(k), (0, 0, 0), .006)
            q = Vector((0, math.cos(a), math.sin(a))).to_track_quat('Y', 'Z')
            for v in obj.data.vertices:
                v.co = q @ v.co + p
    lathe('Mallet through-handle walnut', (0, 0, 0), [(.025, .019), (.070, .020), (.208, .025), (.304, .029), (.353, .027)], 'walnut', sides=16)
    wrapped_grip('Mallet plum leather', .042, .180, .023, 'plum', 4.1)
    lathe('Mallet rounded brass pommel', (0, 0, 0), [(0, .020), (.004, .031), (.014, .033), (.032, .029), (.039, .022)], 'brass', sides=20)
    lathe('Mallet brass neck ferrule', (0, 0, 0), [(.284, .025), (.289, .036), (.301, .037), (.309, .030)], 'brass', sides=20)


def catmull(points, subdivisions=4):
    result = []
    for i, p1 in enumerate(points):
        p0, p2, p3 = points[(i - 1) % len(points)], points[(i + 1) % len(points)], points[(i + 2) % len(points)]
        for j in range(subdivisions):
            t = j / subdivisions
            result.append(tuple(.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t ** 3) for k in range(2)))
    return result


def front_y(x, z, width, height):
    return .009 + .028 * max(0, 1 - (x / width) ** 2 - (z / height) ** 2)


def shield_body(name, outline, width, height):
    n = len(outline); vertices, faces = [], []
    for side in [0, 1]:
        offset = len(vertices)
        vertices.append((0, front_y(0, 0, width, height) - side * .031, 0))
        for j in range(1, 6):
            r = j / 5
            for x, z in outline:
                xx, zz = x * r, z * r
                # Sparse broad tool facets create tangible, soft wood relief.
                tool = .0010 * math.sin(xx * 83 + .3 * math.sin(zz * 18)) * (1 - r * .35)
                vertices.append((xx, front_y(xx, zz, width, height) - side * .031 + tool, zz))
        for i in range(n):
            faces.append((offset, offset + 1 + i, offset + 1 + (i + 1) % n))
        for j in range(4):
            for i in range(n):
                a, b = offset + 1 + j * n + i, offset + 1 + j * n + (i + 1) % n
                faces.append((a, b, b + n, a + n))
    stride = 1 + 5 * n
    for i in range(n):
        a, b = 1 + 4 * n + i, 1 + 4 * n + (i + 1) % n
        faces.append((a, a + stride, b + stride, b))
    mesh(name + ' convex solid walnut body', vertices, faces, 'walnut')
    rows = []
    for radius, depth in [(1.025, -.018), (1.040, -.010), (1.036, .004), (1.014, .012), (.878, .016), (.861, .009), (.872, -.006), (.900, -.026), (1.020, -.027)]:
        rows.append([(x * radius, front_y(x * radius, z * radius, width, height) + depth, z * radius) for x, z in outline])
    ringmesh(name + ' soft hammered brass rim', rows, 'brass', caps=False, close_rows=True)


def shield_rivets(name, outline, width, height, count=8):
    for k in range(count):
        x, z = outline[int(k * len(outline) / count)]
        x *= .957; z *= .957
        rivet(name + ' front rim rivet ' + str(k), (x, front_y(x, z, width, height) + .014, z), .008)
        if k % 2 == 0:
            rivet(name + ' back rim rivet ' + str(k), (x, front_y(x, z, width, height) - .031, z), .006, front=-1)


def leaf(name, base, tip, width, surface):
    a, b = Vector(base), Vector(tip); direction = (b - a).normalized(); cross = Vector((direction.z, 0, -direction.x)); rows = []
    for j in range(7):
        t = j / 6; center = a.lerp(b, t)
        w = .001 + width * math.sin(math.pi * t) ** .83
        row = []
        for s, raised in [(-1, .001), (0, .008 * math.sin(math.pi * t)), (1, .001), (0, -.002)]:
            p = center + cross * (s * w)
            p.y = surface(p.x, p.z) + .008 + raised
            row.append(p)
        rows.append(row)
    ringmesh(name, rows, 'sage')
    stem = []
    for j in range(5):
        p = a.lerp(b, j / 4); p.y = surface(p.x, p.z) + .017
        stem.append(p)
    tube(name + ' carved midrib', stem, [.002, .0024, .0022, .0016, .0005], 'sage', sides=5)


def arched_strap(name, x0, x1, z, width, back_depth=-.075, material='plum'):
    rows = []
    for i in range(9):
        t = i / 8; x = x0 + (x1 - x0) * t
        y = -.024 + (back_depth + .024) * math.sin(math.pi * t) ** .6
        rows.append([(x, y + dy, z + dz) for dy, dz in [(0, -width / 2), (0, width / 2), (.006, width / 2), (.006, -width / 2)]])
    ringmesh(name + ' open rear forearm strap', rows, material)
    for side, x in [('left', x0), ('right', x1)]:
        rounded_box(name + ' strap ' + side + ' walnut anchor', (x, -.025, z), (.030, .017, width + .020), 'walnut', .004)
        for dz in [-width * .30, width * .30]:
            rivet(name + ' strap ' + side + ' fixing', (x, -.036, z + dz), .005, front=-1)


def acorn():
    outline = catmull([(0, .164), (.116, .113), (.139, .033), (.111, -.098), (0, -.198), (-.111, -.098), (-.139, .033), (-.116, .113)])
    shield_body('Acorn shield', outline, .146, .204)
    shield_rivets('Acorn shield', outline, .146, .204, 8)
    surface = lambda x, z: front_y(x, z, .146, .204)
    leaf('Acorn sprout center leaf', (0, 0, -.056), (0, 0, .087), .035, surface)
    leaf('Acorn sprout left leaf', (-.002, 0, -.054), (-.068, 0, .023), .024, surface)
    leaf('Acorn sprout right leaf', (.002, 0, -.054), (.068, 0, .023), .024, surface)
    tube('Acorn sprout stem', [(0, surface(0, -.081) + .011, -.081), (0, surface(0, -.055) + .016, -.055), (0, surface(0, -.015) + .015, -.015)], [.004, .005, .0028], 'sage', sides=7)
    lathe('Acorn crown cap', (0, -.004, 0), [(.160, .021), (.166, .027), (.181, .023), (.194, .013), (.198, .004)], 'brass', sides=12)
    arched_strap('Acorn shield', -.080, .080, .053, .045, -.080)
    for x in [-.057, .057]:
        rounded_box('Acorn rear hand grip solid mount', (x, -.040, -.083), (.027, .045, .037), 'walnut', .005)
        rivet('Acorn rear hand grip fixing', (x, -.067, -.083), .006, front=-1)
    tube('Acorn distinct rear hand grip', [(-.056, -.062, -.083), (-.043, -.070, -.083), (.043, -.070, -.083), (.056, -.062, -.083)], [.010, .012, .012, .010], 'plum', sides=12)


def ribbon_strip(name, centers, widths, material, thickness=.004):
    rows = []
    for j, center in enumerate(centers):
        p = Vector(center)
        tangent = Vector(centers[min(j + 1, len(centers) - 1)]) - Vector(centers[max(0, j - 1)])
        tangent.y = 0; tangent.normalize(); cross = Vector((tangent.z, 0, -tangent.x))
        row = []
        for side, depth in [(-1, 0), (0, .0025), (1, 0), (1, -thickness), (0, -thickness), (-1, -thickness)]:
            point = p + cross * side * widths[j] / 2; point.y += depth; row.append(point)
        rows.append(row)
    return ringmesh(name, rows, material)


def wand():
    lathe('Wand tapered walnut staff', (0, 0, 0), [(.016, .016), (.100, .016), (.230, .019), (.326, .024), (.360, .026)], 'walnut', sides=16)
    wrapped_grip('Wand sage linen', .038, .180, .019, 'sage', 4.4)
    lathe('Wand brass pommel', (0, 0, 0), [(0, .009), (.004, .022), (.015, .028), (.031, .023), (.040, .015)], 'brass', sides=20)
    lathe('Wand brass cradle collar', (0, 0, 0), [(.316, .025), (.320, .035), (.337, .035), (.345, .028)], 'brass', sides=20)
    for j in range(4):
        a = math.tau * j / 4 + math.pi / 4
        def p(r, z): return (r * math.sin(a), r * math.cos(a), z)
        tube('Wand separate walnut cradle prong ' + str(j + 1), [p(.016, .339), p(.041, .370), p(.068, .414), p(.077, .450), p(.074, .459)], [.018, .022, .022, .017, .005], 'walnut', sides=8, elliptic=.72)
        rivet('Wand prong brass pin ' + str(j + 1), p(.046, .373), .010)
    crystal = lathe('Wand blunt amber and plum prism', (0, 0, 0), [(.344, .018), (.369, .039), (.437, .063), (.485, .069), (.615, .032), (.646, .018), (.650, .011)], 'amber', sides=8, smooth=False)
    crystal.data.materials.append(MATS['plum'])
    for face in crystal.data.polygons:
        # Amber forward panes, plum edge/back facets. Rounded tip has a small cap.
        if face.index % 8 in [0, 3, 4, 7] and len(face.vertices) == 4:
            face.material_index = 1
    lathe('Wand plum ribbon collar knot', (0, 0, 0), [(.295, .024), (.300, .029), (.308, .030), (.316, .024)], 'plum', sides=16)
    for side in [-1, 1]:
        centers = [(side * .018, .018, .309), (side * .036, .023, .287), (side * .052, .017, .257), (side * .065, .007, .223 + .008 * side)]
        ribbon_strip('Wand attached plum ribbon tail ' + str(side), centers, [.014, .024, .029, .027], 'plum')


def ribbon_shield():
    outline = [(.146 * math.sin(math.tau * i / 32), .231 * math.cos(math.tau * i / 32)) for i in range(32)]
    shield_body('Ribbon shield', outline, .152, .240)
    shield_rivets('Ribbon shield', outline, .152, .240, 8)
    for sign, material in [(-1, 'plum'), (1, 'sage')]:
        centers = []
        for j in range(11):
            t = j / 10; x, z = -.103 + .206 * t, sign * (-.161 + .322 * t)
            centers.append((x, front_y(x, z, .152, .240) + .007 + (material == 'sage') * .005, z))
        ribbon_strip('Ribbon shield crossed ' + material + ' inlay', centers, [.034 if j in [0, 10] else .047 for j in range(11)], material, .005)
    lathe('Ribbon shield central brass medallion', (0, 0, 0), [(.044, .050), (.049, .061), (.056, .062), (.063, .054), (.071, .031), (.073, .004)], 'brass', 'y', 24)
    spiral('Ribbon shield medallion carved spiral', (0, .073, 0), .042, thickness=.0015)
    arched_strap('Ribbon shield', -.092, .033, 0, .067, -.078, material='plum')
    for z in [-.063, .063]:
        rounded_box('Ribbon shield rear hand grip walnut anchor', (.075, -.045, z), (.035, .051, .028), 'walnut', .005)
        rivet('Ribbon shield rear hand grip anchor stud', (.075, -.074, z), .006, front=-1)
    lathe('Ribbon shield separate rear vertical grip', (.075, -.072, 0), [(-.063, .010), (-.055, .0135), (.055, .0135), (.063, .010)], 'walnut', sides=12)
    for z in [-.055, .055]:
        lathe('Ribbon shield grip brass ferrule', (.075, -.072, z), [(-.006, .014), (-.004, .017), (.004, .017), (.006, .014)], 'brass', sides=12)


def bounds(objects):
    points = [obj.matrix_world @ v.co for obj in objects if obj.type == 'MESH' for v in obj.data.vertices]
    lo = [min(p[k] for p in points) for k in range(3)]; hi = [max(p[k] for p in points) for k in range(3)]
    return {'min': lo, 'max': hi, 'dimensions': [hi[k] - lo[k] for k in range(3)]}


def merge_export():
    bpy.ops.object.select_all(action='DESELECT')
    copies = []
    for obj in PARTS:
        copy = obj.copy(); copy.data = obj.data.copy(); bpy.context.collection.objects.link(copy); copies.append(copy); copy.select_set(True)
    bpy.context.view_layer.objects.active = copies[0]; bpy.ops.object.join()
    joined = bpy.context.object
    unique = list(dict.fromkeys(joined.data.materials)); before = list(joined.data.materials)
    indices = [unique.index(before[p.material_index]) for p in joined.data.polygons]
    joined.data.materials.clear()
    for material in unique: joined.data.materials.append(material)
    for face, index in zip(joined.data.polygons, indices): face.material_index = index
    return joined


def build(name, root=ROOT):
    root = Path(root); folder = root / name; folder.mkdir(parents=True, exist_ok=True)
    if not (root / 'textures' / 'walnut.png').exists():
        sys.path.insert(0, str(root)); from pigment import generate; generate(root / 'textures')
    reset(); palette(root)
    {'spark-mallet': mallet, 'acorn-shield': acorn, 'prism-wand': wand, 'ribbon-shield': ribbon_shield}[name]()
    bpy.context.view_layer.update()
    original = bounds(PARTS); factor = SPECS[name]['height'] / original['dimensions'][2]
    grip = Vector(SPECS[name]['grip_raw_blender'])
    for obj in PARTS:
        for vertex in obj.data.vertices: vertex.co = (vertex.co - grip) * factor
        obj.data.update()
    source_bounds = bounds(PARTS)
    part_records = []
    for obj in PARTS:
        obj.data.calc_loop_triangles()
        part_records.append({'name': obj.name, 'triangles': len(obj.data.loop_triangles), 'bounds_blender': bounds([obj]), 'material_names': [m.name for m in obj.data.materials]})
    geometry = {obj.name: [[float(c) for c in v.co] for v in obj.data.vertices] for obj in PARTS}
    (folder / 'source-geometry.json').write_text(json.dumps(geometry, separators=(',', ':')))
    for file in ['build.py', 'pigment.py']:
        source = root / file
        if source.exists():
            text = bpy.data.texts.get('WO017_' + file) or bpy.data.texts.new('WO017_' + file)
            text.clear(); text.write(source.read_text())
    bpy.ops.object.select_all(action='DESELECT')
    for obj in PARTS: obj.select_set(True)
    bpy.context.view_layer.objects.active = PARTS[0]
    master = folder / (name + '.blend')
    bpy.ops.wm.save_as_mainfile(filepath=str(master), compress=True)
    joined = merge_export(); joined.name = name + '_grip'
    joined['asset_id'] = name; joined['version'] = 'v001'; joined['attachment_origin'] = 'physical hand grip center'
    joined['front_gltf'] = '-Z'; joined['up_gltf'] = '+Y'; joined['owner_approval'] = 'pending'
    joined.data.calc_loop_triangles(); triangles = len(joined.data.loop_triangles)
    target = folder / (name + '.glb')
    bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB', use_selection=True, export_yup=True, export_animations=False,
        export_skins=False, export_apply=True, export_texcoords=True, export_normals=True, export_tangents=False,
        export_materials='EXPORT', export_vertex_color='NONE', export_cameras=False, export_lights=False,
        export_image_format='JPEG', export_jpeg_quality=90, export_extras=True, export_draco_mesh_compression_enable=False)
    gltf_bounds = {'min': [source_bounds['min'][0], source_bounds['min'][2], -source_bounds['max'][1]], 'max': [source_bounds['max'][0], source_bounds['max'][2], -source_bounds['min'][1]]}
    gltf_bounds['dimensions'] = [gltf_bounds['max'][k] - gltf_bounds['min'][k] for k in range(3)]
    attachment = {
        'origin_gltf_m': [0, 0, 0], 'meaning': 'Physical center of the usable hand grip, not mesh bounding-box center',
        'grip_axis_gltf': SPECS[name]['grip_axis_gltf'], 'grip_diameter_m': SPECS[name]['grip_diameter_m'] * factor,
        'ground_display': {'position_m': [0, -gltf_bounds['min'][1], 0], 'quaternion_xyzw': [0, 0, 0, 1], 'scale': [1, 1, 1], 'meaning': 'Standing orientation with lowest geometry at Y=0; use a display stand for physical balancing.'},
        'left_hand': {'bone': 'hand.L', 'prop_quaternion_xyzw': [0, 0, 0, 1]},
        'right_hand': {'bone': 'hand.R', 'prop_quaternion_xyzw': [0, 0, 1, 0] if name == 'ribbon-shield' else [0, 0, 0, 1]},
        'traveler_socket_report': 'scripts/assets/era-equipment/traveler-sockets.json',
        'hand_guidance': 'Parent the complete prop to a socket under hand.L or hand.R; use the stage-specific mitten-center translation from traveler-sockets.json. Keep meter scale. Arm pose supplies all motion. For the oval Ribbon Shield, a 180-degree rotation around local forward Z swaps the offset grip to the opposite side while preserving the -Z-facing shield. Acorn Shield remains upright in both hands.',
        'rear_geometry': 'Shields face glTF -Z; actual straps and hand grips lie behind the walnut body toward +Z. Grip origin can be behind the front surface.' if 'shield' in name else None,
    }
    record = {'schema_version': 1, 'asset_id': name, 'version': 'v001', 'author': 'native gpt-6-astra, max', 'blender_version': bpy.app.version_string,
        'candidate_status': 'unapproved', 'coordinate_system': {'units': 'meters', 'blender_up': '+Z', 'blender_front': '+Y', 'gltf_up': '+Y', 'gltf_front': '-Z'},
        'bounds_blender': source_bounds, 'bounds_gltf': gltf_bounds, 'exact_height_m': SPECS[name]['height'], 'scale_correction': factor,
        'triangles': triangles, 'material_count': len(joined.data.materials), 'draw_primitives_target': len(joined.data.materials),
        'parts': part_records, 'attachment': attachment, 'files': {p.name: {'bytes': p.stat().st_size, 'sha256': sha(p)} for p in [master, target]},
        'pigment': {'kind': 'Original deterministic color fields rasterized into 512px maps; directional wood grain follows explicit UVs', 'source': 'pigment.py', 'embedded_format': 'JPEG quality 90', 'external_dependencies': False},
        'budgets': {'triangles_max': 5000, 'materials_max': 5, 'glb_bytes_max': 1048576}, 'clips': [],
    }
    (folder / 'construction.json').write_text(json.dumps(record, indent=2) + '\n')
    bpy.data.objects.remove(joined, do_unlink=True)
    print(json.dumps({'asset': name, 'triangles': triangles, 'materials': record['material_count'], 'bytes': target.stat().st_size, 'height_m': gltf_bounds['dimensions'][1], 'sha256': sha(target)}), flush=True)
    return record


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--only', choices=NAMES); parser.add_argument('--output', default=str(ROOT))
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    for asset in ([args.only] if args.only else NAMES): build(asset, args.output)
