"""Inspect and render exact WO-017 GLBs in an exclusively owned Blender process.

All comparison images show re-imported delivered bytes. The source masters stay
unchanged. A KD-tree checks every named source part against exported geometry,
including the physical rear strap and grip vertices. No factory reset.
"""
import argparse
import bpy
import hashlib
import json
from pathlib import Path
import sys
from mathutils import Vector
from mathutils.kdtree import KDTree

ROOT = Path('/workspace/haynes-quest/era-equipment/v001')
NAMES = ['spark-mallet', 'acorn-shield', 'prism-wand', 'ribbon-shield']


def clear():
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for obj in list(bpy.data.objects): bpy.data.objects.remove(obj, do_unlink=True)
    for store in [bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.cameras, bpy.data.lights]:
        for item in list(store):
            if item.users == 0: store.remove(item)


def points(objects):
    return [obj.matrix_world @ v.co for obj in objects if obj.type == 'MESH' for v in obj.data.vertices]


def bounds(objects):
    p = points(objects)
    lo = [min(v[k] for v in p) for k in range(3)]; hi = [max(v[k] for v in p) for k in range(3)]
    return {'min': lo, 'max': hi, 'dimensions': [hi[k] - lo[k] for k in range(3)]}


def inspect(folder, name, objects):
    mesh_points = points(objects); kd = KDTree(len(mesh_points))
    for i, point in enumerate(mesh_points): kd.insert(point, i)
    kd.balance()
    original = json.loads((folder / 'source-geometry.json').read_text())
    source_parts = {}
    for part, vertices in original.items():
        error = max(kd.find(Vector(p))[2] for p in vertices)
        source_parts[part] = {'source_vertices_checked': len(vertices), 'max_nearest_export_vertex_error_m': error, 'all_preserved': error < .000003}
    assert all(p['all_preserved'] for p in source_parts.values()), source_parts
    construction = json.loads((folder / 'construction.json').read_text())
    box = bounds(objects)
    dimension_error = max(abs(box['dimensions'][k] - construction['bounds_blender']['dimensions'][k]) for k in range(3))
    assert dimension_error < .000003
    record = {
        'schema_version': 1, 'asset_id': name, 'source': 'Exact delivered GLB re-imported by Blender glTF importer', 'blender_version': bpy.app.version_string,
        'glb_sha256': hashlib.sha256((folder / (name + '.glb')).read_bytes()).hexdigest(), 'bounds_blender': box,
        'source_dimension_error_m': dimension_error, 'all_named_source_parts_preserved': True, 'source_parts': source_parts,
        'mesh_objects': [], 'checks': {'source_geometry_preserved': True, 'source_dimensions_preserved': True, 'height_contract': abs(box['dimensions'][2] - construction['exact_height_m']) < .000003},
    }
    for obj in objects:
        if obj.type != 'MESH': continue
        obj.data.calc_loop_triangles()
        record['mesh_objects'].append({'name': obj.name, 'vertices': len(obj.data.vertices), 'triangles': len(obj.data.loop_triangles), 'materials': [m.name for m in obj.data.materials], 'uv_layers': [uv.name for uv in obj.data.uv_layers]})
    if 'shield' in name:
        required = [p for p in source_parts if 'open rear forearm strap' in p or 'distinct rear hand grip' in p or 'separate rear vertical grip' in p]
        record['rear_attachment_parts'] = required
        record['checks']['separate_forearm_and_hand_geometry'] = len(required) == 2 and all(source_parts[p]['all_preserved'] for p in required)
        assert record['checks']['separate_forearm_and_hand_geometry']
    (folder / 'reimport.json').write_text(json.dumps(record, indent=2) + '\n')
    return record


def studio(samples, size):
    scene = bpy.context.scene; scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = samples
    scene.cycles.use_denoising = True; scene.cycles.max_bounces = 5
    scene.render.threads_mode = 'FIXED'; scene.render.threads = 6
    scene.render.resolution_x = size; scene.render.resolution_y = size; scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGB'
    scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - Medium High Contrast'; scene.view_settings.exposure = .15
    world = bpy.data.worlds.new('WO017 warm paper studio'); world.use_nodes = True; scene.world = world
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.52, .59, .70, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = .40
    material = bpy.data.materials.new('Review ground only'); material.use_nodes = True
    material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.64, .56, .44, 1)
    material.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.001))
    bpy.context.object.name = 'Review-only parchment ground'; bpy.context.object.data.materials.append(material)
    for name, location, energy, color, size in [
        ('Large warm key', (-2, 3, 4), 320, (1, .86, .69), 2.3),
        ('Soft cool fill', (3, 1, 2), 110, (.68, .80, 1), 2.0),
        ('Honey edge', (1, -3, 3), 210, (1, .80, .60), 1.8),
    ]:
        data = bpy.data.lights.new(name, 'AREA'); data.energy = energy; data.shape = 'DISK'; data.size = size; data.color = color
        obj = bpy.data.objects.new(name, data); bpy.context.collection.objects.link(obj); obj.location = location
        obj.rotation_euler = (Vector((0, 0, .25)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.object.camera_add(); camera = bpy.context.object; camera.data.type = 'ORTHO'; scene.camera = camera
    return camera


def shot(folder, label, camera, location, target, scale):
    camera.location = location; camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.ortho_scale = scale; bpy.context.scene.render.filepath = str(folder / (label + '.png'))
    bpy.ops.render.render(write_still=True)


def render(name, root=ROOT, quick=False):
    root = Path(root); folder = root / name; clear()
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=str(folder / (name + '.glb')))
    objects = list(set(bpy.data.objects) - before); bpy.context.view_layer.update()
    report = inspect(folder, name, objects); box = report['bounds_blender']
    # Move the complete imported hierarchy, preserving the exported grip origin.
    roots = [obj for obj in objects if obj.parent not in objects]
    for obj in roots: obj.location.z -= box['min'][2]
    bpy.context.view_layer.update(); box = bounds(objects)
    center = [(box['min'][k] + box['max'][k]) / 2 for k in range(3)]; h = box['dimensions'][2]; span = max(box['dimensions'])
    camera = studio(16 if quick else 32, 640 if quick else 900)
    shot(folder, 'quick' if quick else 'beauty', camera, (center[0] + .85, center[1] + 1.4, center[2] + .63), center, span * 1.28)
    if not quick:
        shot(folder, 'front', camera, (center[0], center[1] + 2, center[2]), center, span * 1.21)
        shot(folder, 'side', camera, (center[0] + 2, center[1], center[2]), center, span * 1.21)
        shot(folder, 'back', camera, (center[0], center[1] - 2, center[2]), center, span * 1.21)
        if 'shield' in name:
            shot(folder, 'rear-grip', camera, (center[0] + .75, center[1] - 1.3, center[2] + .32), center, span * 1.21)
        bpy.ops.wm.save_as_mainfile(filepath=str(folder / (name + '-export-review.blend')), compress=True)
    (folder / ('quick-complete.json' if quick else 'render-complete.json')).write_text(json.dumps({'asset_id': name, 'source_sha256': report['glb_sha256'], 'all_complete': True, 'quick': quick, 'resolution_px': 640 if quick else 900, 'views': ['quick'] if quick else ['beauty', 'front', 'side', 'back'] + (['rear-grip'] if 'shield' in name else [])}, indent=2) + '\n')
    print(json.dumps({'rendered': name, 'quick': quick}), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--only', choices=NAMES); parser.add_argument('--output', default=str(ROOT)); parser.add_argument('--quick', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    for asset in ([args.only] if args.only else NAMES): render(asset, args.output, args.quick)
