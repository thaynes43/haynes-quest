"""storybook-planting-kit v001: three static reusable vegetation props from the coordinator's construction sheet.

storybook-canopy-tree (~4 m): crooked faceted ochre trunk with root flares and two limbs carrying three layered
leaf crowns, green with lime tops. storybook-cypress (~3 m): S-curved trunk under a deep-teal, drooping, tapered
crown. storybook-flowering-shrub (~0.8 m): broad-leaf dome over brown stems with raspberry and cream five-petal
flowers. One shared vertex-coloured material, one mesh node per prop at the ground origin, no soil disc or base.
argv: stage=geo | stage=full [replace=draft]
"""
import bpy, sys, math, json, random
from pathlib import Path
from mathutils import Vector, Matrix
sys.path.insert(0, '/workspace/haynes-quest/action-worlds/minions-b/v001/source')
import common as C
from common import ellipsoid, tube, leaf, lathe, TRS

KIT = 'storybook-planting-kit'
ARGS = dict(a.split('=', 1) for a in sys.argv[1:] if '=' in a)
OUT = C.REMOTE / KIT
PALETTE = {
    'bark': '#b97a34', 'bark_dark': '#9a6128', 'bark_lite': '#cc9145',
    'leaf_dark': '#2f7449', 'leaf': '#3f8b4e', 'leaf_mid': '#5a9f45', 'lime': '#a9c544', 'lime_lite': '#c3d653', 'core': '#285f3c',
    'teal': '#2b6e67', 'teal_dark': '#215a55', 'teal_lite': '#3a8478', 'teal_core': '#1c4c48',
    'shrub_dark': '#47883e', 'shrub': '#5fa046', 'shrub_lite': '#93c052', 'shrub_core': '#2e622c', 'stem': '#8c5a2e',
    'raspberry': '#d23a6e', 'raspberry_lite': '#e65c8b', 'cream': '#f6ecd4', 'cream_shade': '#eadbb8', 'gold': '#e7b23a',
}
PROPS = {  # planning boxes (half x, height, half z) for validation
    'storybook-canopy-tree': (1.95, 4.4, 1.95), 'storybook-cypress': (.85, 3.2, .85), 'storybook-flowering-shrub': (.7, .9, .7)}

def crown(name, c, R, flat, rings, colors, rnd, leaf_len=.6, leaf_w=.58, core=('leaf_dark', .84)):
    """A layered dome of broad leaves laid like shingles: each leaf starts up-slope on the dome surface and points down it."""
    c = Vector(c)
    ellipsoid(name + ' core', c, (R * core[1], R * core[1], R * core[1] * flat), core[0], 'none', seg=12, rings=8)
    for i, (theta, n) in enumerate(rings):
        th = math.radians(theta)
        for k in range(n):
            ph = math.tau * (k + .5 * (i % 2)) / n + rnd.uniform(-.18, .18)
            rad = Vector((math.sin(th) * math.cos(ph), math.sin(th) * math.sin(ph), math.cos(th)))
            nrm = Vector((rad.x, rad.y, rad.z / flat)).normalized()
            surf = c + Vector((rad.x * R * .8, rad.y * R * .8, rad.z * R * .8 * flat))
            tan = Vector((math.cos(th) * math.cos(ph), math.cos(th) * math.sin(ph), -math.sin(th) * flat))
            if tan.length < 1e-3 or th < .2: tan = Vector((math.cos(ph), math.sin(ph), -.05))   # top rosette lies over the crown
            tan.normalize()
            L = R * leaf_len * rnd.uniform(.88, 1.12)
            d = (tan * .85 + nrm * .32).normalized(); w = nrm.cross(d).normalized()
            leaf('%s leaf %d.%d' % (name, i, k), surf - tan * L * .3, d, w, L, L * leaf_w, L * .12, colors[min(i, len(colors) - 1)], 'none',
                 curl=.22, droop=.35, n=4, seg=4, fullness=.95, tip=.14)

def flower(name, c, normal, r, col, rnd):
    n = Vector(normal).normalized(); u = n.cross(Vector((0, 0, 1)) if abs(n.z) < .95 else Vector((1, 0, 0))).normalized(); v = n.cross(u)
    lite = col + '_lite' if col == 'raspberry' else 'cream_shade'
    for k in range(5):
        a = math.tau * k / 5 + rnd.uniform(-.1, .1); d = u * math.cos(a) + v * math.sin(a)
        ellipsoid('%s petal %d' % (name, k), Vector(c) + d * r * .55 + n * r * .05, (r * .5, r * .36, r * .12), col if k % 2 else lite, 'none',
                  seg=6, rings=4, rot=(0, 0, 0), fn=None)
        ob = C.PARTS[-1]
        ob.data.transform(Matrix.Translation(-(Vector(c) + d * r * .55 + n * r * .05)))
        ob.data.transform(Matrix((d, n.cross(d), n)).transposed().to_4x4())
        ob.data.transform(Matrix.Translation(Vector(c) + d * r * .55 + n * r * .05))
    ellipsoid(name + ' centre', Vector(c) + n * r * .14, (r * .28, r * .28, r * .22), 'gold', 'none', seg=6, rings=4)

def ground_clamp(parts):
    for ob in parts:
        for v in ob.data.vertices:
            if v.co.z < 0: v.co.z = 0.0

def canopy_tree(rnd):
    trunk = [(0, 0, 0), (.24, .02, .55), (-.13, .04, 1.2), (.12, 0, 1.85), (0, -.04, 2.7)]
    tube('trunk', trunk, [.38, .28, .22, .17, .12], 'bark', 'none', seg=8, n=14, smooth=False)
    for k in range(6):
        a = math.tau * k / 6 + .3; L = .56 + .08 * (k % 3 == 0)  # opposite roots match, so the planting base stays centred
        tube('root %d' % k, [(math.cos(a) * .12, math.sin(a) * .12, .5), (math.cos(a) * .32, math.sin(a) * .32, .16), (math.cos(a) * L, math.sin(a) * L, .02)],
             [.15, .11, .04], 'bark_dark' if k % 2 else 'bark', 'none', seg=6, n=7, smooth=False)
    tube('limb left', [(-.03, .04, 1.25), (-.5, .02, 1.6), (-.92, -.02, 2.06)], [.16, .12, .08], 'bark', 'none', seg=7, n=9, smooth=False)
    tube('limb right', [(.08, 0, 1.1), (.55, .05, 1.38), (.92, .02, 1.84)], [.15, .11, .07], 'bark_lite', 'none', seg=7, n=9, smooth=False)
    tube('limb back', [(.05, -.02, 1.65), (.1, -.42, 2.0), (.05, -.6, 2.35)], [.1, .08, .05], 'bark_dark', 'none', seg=6, n=7, smooth=False)
    cols = ['lime_lite', 'lime_lite', 'lime', 'leaf_mid', 'leaf']
    crown('crown top', (0, 0, 3.15), 1.2, .7, [(8, 3), (32, 6), (56, 9), (80, 10), (104, 10)], cols, rnd)
    crown('crown left', (-.95, 0, 2.3), .9, .72, [(8, 3), (36, 5), (64, 7), (92, 8)], cols, rnd)
    crown('crown right', (.95, .02, 2.1), .86, .72, [(8, 3), (36, 5), (64, 7), (92, 8)], cols, rnd)

def cypress(rnd):
    path = [(0, 0, 0), (.14, 0, .45), (-.04, 0, 1.05), (.06, 0, 1.9), (.02, 0, 2.7)]
    tube('trunk', path, [.15, .11, .085, .06, .03], 'bark', 'none', seg=7, n=12, smooth=False)
    for k in range(4):
        a = math.tau * k / 4 + .6
        tube('root %d' % k, [(math.cos(a) * .05, math.sin(a) * .05, .26), (math.cos(a) * .2, math.sin(a) * .2, .07), (math.cos(a) * .32, math.sin(a) * .32, .01)],
             [.07, .05, .02], 'bark_dark', 'none', seg=5, n=6, smooth=False)
    def lean(z): return -.09 * math.sin(math.pi * min(1, max(0, (z - 1.0) / 1.4))) + .05 * max(0, (z - 2.2) / .8)
    def prof(z):   # slim flame: widest about 1.6 m, tapering to the tip
        u = min(1, max(0, (z - 1.0) / 2.05)); return max(.04, .38 * math.sin(math.pi * u ** .75) * (1 - .25 * u))
    zs = [1.2 + .25 * i for i in range(8)]
    lathe('crown core', [(0, 1.05)] + [(prof(z) * .55, z) for z in zs] + [(0, 3.0)], 'teal_core', 'none', seg=9)
    C.PARTS[-1].data.transform(Matrix.Identity(4))
    for v in C.PARTS[-1].data.vertices: v.co.x += lean(v.co.z)
    for i, z in enumerate(zs):
        n = max(4, int(round(prof(z) / .38 * 8)))
        for k in range(n):
            ph = math.tau * (k + .5 * (i % 2)) / n + rnd.uniform(-.15, .15)
            rad = Vector((math.cos(ph), math.sin(ph), 0))
            L = (.42 + .7 * prof(z)) * rnd.uniform(.9, 1.1)
            base = Vector((lean(z), 0, 0)) + rad * prof(z) * .6 + Vector((0, 0, z + L * .25))
            d = (rad * .2 + Vector((0, 0, -1))).normalized(); w = rad.cross(d).normalized()
            col = ('teal_lite', 'teal', 'teal_dark')[(i + k) % 3]
            leaf('scale %d.%d' % (i, k), base, d, w, L, L * .38, L * .1, col, 'none', curl=.25, droop=-.4, n=4, seg=4, fullness=.9, tip=.22)
    tube('tip', [(lean(2.75), 0, 2.72), (lean(2.88) + .01, 0, 2.95), (lean(3.0) + .02, 0, 3.08)], [.07, .04, 0], 'teal', 'none', seg=7, n=7)

def shrub(rnd):
    for k in range(6):
        a = math.tau * k / 6 + .2; r = .22 + .06 * (k % 2)
        tube('stem %d' % k, [(math.cos(a) * .02, math.sin(a) * .02, 0), (math.cos(a) * r * .55, math.sin(a) * r * .55, .2), (math.cos(a) * r, math.sin(a) * r, .38)],
             [.035, .025, .015], 'stem', 'none', seg=5, n=6, smooth=False)
    cols = ['shrub_lite', 'shrub', 'shrub_lite', 'shrub_dark', 'shrub', 'shrub_dark']
    c = Vector((0, 0, .4))
    ellipsoid('dome core', c, (.38, .38, .3), 'shrub_core', 'none', seg=12, rings=8)
    N = 58
    for k in range(N):   # Fibonacci spread over the dome; leaves lie along it, tips fanning up and out, faces outward
        zf = 1 - 1.55 * (k + .5) / N; rr = math.sqrt(max(0, 1 - zf * zf)); ph = k * 2.39996
        rad = Vector((rr * math.cos(ph), rr * math.sin(ph), zf))
        surf = c + Vector((rad.x * .38, rad.y * .38, rad.z * .3))
        upt = Vector((0, 0, 1)) - rad * rad.z
        upt = upt.normalized() if upt.length > .15 else Vector((math.cos(ph), math.sin(ph), 0))
        tilt = .65 if zf > -.2 else -.35          # the lowest skirt of leaves droops to hide the underside
        d = (rad * .7 + upt * tilt + Vector((rnd.uniform(-.2, .2), rnd.uniform(-.2, .2), 0))).normalized()
        w = rad.cross(d); w = w.normalized() if w.length > .2 else Vector((math.cos(ph + 1.57), math.sin(ph + 1.57), 0))
        L = .3 * rnd.uniform(.86, 1.14)
        leaf('leaf %02d' % k, surf - d * L * .25, d, w, L, L * .68, L * .12, cols[(k * 5) % len(cols)], 'none', curl=.28, droop=-.3, n=4, seg=4, fullness=.95, tip=.14)
    spots = [(10, 40, 'raspberry'), (30, 110, 'cream'), (35, 220, 'raspberry'), (40, 330, 'cream'), (55, 20, 'cream'), (58, 160, 'raspberry'),
             (56, 270, 'raspberry'), (72, 80, 'raspberry'), (74, 200, 'cream'), (70, 300, 'raspberry'), (22, 175, 'cream'), (78, 135, 'cream'),
             (82, 250, 'cream'), (84, 350, 'raspberry')]
    for k, (theta, phi, col) in enumerate(spots):
        th, ph = math.radians(theta), math.radians(phi)
        rad = Vector((math.sin(th) * math.cos(ph), math.sin(th) * math.sin(ph), math.cos(th)))
        p = c + Vector((rad.x * .6, rad.y * .6, rad.z * .42))
        flower('flower %d' % k, p, rad + Vector((0, 0, .25)), .118 * rnd.uniform(.9, 1.1), col, rnd)

def join_static(prop, parts, mat):
    for ob in parts:
        ob.data.materials.clear(); ob.data.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in parts: ob.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active; ob.name = prop; ob.data.name = prop + ' mesh'
    for k in ('part_bone', 'part_color', 'part_gloss'):
        if k in ob: del ob[k]
    ob.location = (0, 0, 0); ob.rotation_euler = (0, 0, 0); ob.scale = (1, 1, 1)
    return ob

if __name__ == '__main__':
    C.lease_ok()
    C.reset('Storybook planting kit v001', PALETTE)
    mat = bpy.data.materials.new('Storybook planting kit matte'); mat.use_nodes = True
    nt = mat.node_tree; bs = nt.nodes['Principled BSDF']; vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
    nt.links.new(vc.outputs['Color'], bs.inputs['Base Color']); bs.inputs['Roughness'].default_value = .78; bs.inputs['Metallic'].default_value = 0
    objs = {}; report = {}
    for prop, fn, seed in (('storybook-canopy-tree', canopy_tree, 11), ('storybook-cypress', cypress, 23), ('storybook-flowering-shrub', shrub, 37)):
        coll = bpy.data.collections.new('Kit ' + prop); bpy.context.scene.collection.children.link(coll); C.COLL = coll
        start = len(C.PARTS); fn(random.Random(seed)); parts = C.PARTS[start:]
        if prop == 'storybook-flowering-shrub':
            for ob in parts: ob.data.transform(Matrix.Scale(.88, 4))   # settle at about 0.8 m like the brief
        ground_clamp(parts)
        ob = join_static(prop, parts, mat); objs[prop] = ob
        ob['kit_id'] = KIT; ob['prop_id'] = prop
        lo = [min(v.co[i] for v in ob.data.vertices) for i in range(3)]; hi = [max(v.co[i] for v in ob.data.vertices) for i in range(3)]
        report[prop] = {'triangles': sum(len(p.vertices) - 2 for p in ob.data.polygons), 'vertices': len(ob.data.vertices), 'parts': len(parts),
                        'bounds_blender_z_up': {'min': lo, 'max': hi}}
    if ARGS.get('stage', 'geo') == 'full':
        OUT.mkdir(parents=True, exist_ok=True)
        master = OUT / (KIT + '.blend')
        if master.exists() and ARGS.get('replace') == 'draft': master.unlink()
        for prop in PROPS:
            g = OUT / (prop + '.glb')
            if g.exists() and ARGS.get('replace') == 'draft': g.unlink()
            assert not g.exists(), ('refusing to overwrite', str(g))
        C.store_sources('storybook-planting-kit v001 ', ['common.py', 'kit.py'])
        sc = bpy.context.scene
        removed = {k: sc[k] for k in list(sc.keys()) if k in C.SCENE_IDENTITY or k.startswith('blendermcp_')}
        for prop, ob in objs.items():
            for k in removed: del sc[k]
            extras = {'asset_id': KIT, 'asset_version': 'v001', 'work_order': '20261004-opus-action-minions-b', 'prop_id': prop,
                      'candidate_status': KIT + ' v001 · awaiting owner review', 'orientation': 'glTF +Y up; base centred on the ground origin'}
            for k, v in extras.items(): sc[k] = v
            try:
                bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
                bpy.ops.export_scene.gltf(filepath=str(OUT / (prop + '.glb')), export_format='GLB', use_selection=True, export_yup=True,
                    export_animations=False, export_skins=False, export_morph=False, export_apply=False, export_texcoords=False, export_normals=True,
                    export_tangents=False, export_materials='EXPORT', export_vertex_color='MATERIAL', export_all_vertex_colors=False,
                    export_cameras=False, export_lights=False, export_extras=True, export_attributes=False)
            finally:
                for k in extras: del sc[k]
                for k, v in removed.items(): sc[k] = v
        # master: each prop in its own collection at the origin; only the canopy tree is visible when opened
        vl = bpy.context.view_layer
        for prop in PROPS:
            lc = vl.layer_collection.children['Kit ' + prop]; lc.hide_viewport = prop != 'storybook-canopy-tree'
        C.save_master(master, KIT, KIT + ' v001 editable kit master; awaiting owner review')
        for prop in PROPS: vl.layer_collection.children['Kit ' + prop].hide_viewport = False
        rec = {'kit_id': KIT, 'version': 'v001', 'props': report, 'material': mat.name, 'blender_version': bpy.app.version_string, 'created_utc': C.now(),
               'files': {n: {'bytes': (OUT / n).stat().st_size, 'sha256': C.sha(OUT / n)} for n in [KIT + '.blend'] + [p + '.glb' for p in PROPS]},
               'planning_boxes_half_x_height_half_z': PROPS}
        (OUT / 'construction.json').write_text(json.dumps(rec, indent=2) + '\n')
    print(json.dumps(report))
