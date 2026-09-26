"""WO111 rival-mayor v001: orthographic reference sheet from the painted blockout.

Four linked-data copies of the master blockout (front, side, back, three-quarter) at identical scale,
one orthographic camera, parchment backdrop (#f5ebdc, Standard view transform so it renders exactly),
a metre height marker, horizontal scale guides, labels, a palette row and plum-ink Freestyle outlines.
Run after build_blockout.py.  SHEET_PERCENT (module global) sets render size: 100 -> 2048x1024.
"""
import bpy, math, json, hashlib, datetime
from mathutils import Vector, Matrix
from pathlib import Path

ROOT = Path('/workspace/haynes-quest/family-eras/rival-mayor/v001')
MASTER = 'Rival mayor blockout (master)'
SHEET = 'Reference sheet (figures)'
DRESS = 'Reference sheet (parchment, guides, labels)'
PERCENT = globals().get('SHEET_PERCENT', 100)
SAMPLES = globals().get('SHEET_SAMPLES', 48)
OUT = globals().get('SHEET_OUT', 'reference-sheet.png')

def lin(h):
    h = h.lstrip('#'); out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)

def emission(name, hexcol, strength=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = lin(hexcol); em.inputs['Strength'].default_value = strength
    nt.links.new(em.outputs[0], out.inputs['Surface']); m.diffuse_color = lin(hexcol); return m

def coll(name):
    c = bpy.data.collections.get(name)
    if c:
        for ob in list(c.objects): bpy.data.objects.remove(ob, do_unlink=True)
    else:
        c = bpy.data.collections.new(name); bpy.context.scene.collection.children.link(c)
    return c

def put(c, name, data):
    ob = bpy.data.objects.new(name, data); c.objects.link(ob); return ob

def plane(c, name, x0, x1, z0, z1, y, m):
    me = bpy.data.meshes.new(name)
    me.from_pydata([(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)], [], [(0, 1, 2, 3)]); me.update()
    ob = put(c, name, me); me.materials.append(m); return ob

def text(c, name, body, x, z, size, m, align='CENTER', y=3.0):
    cu = bpy.data.curves.new(name, 'FONT'); cu.body = body; cu.size = size; cu.align_x = align; cu.align_y = 'BOTTOM'
    ob = put(c, name, cu); ob.location = (x, y, z); ob.rotation_euler = (math.pi / 2, 0, 0); cu.materials.append(m); return ob

def master_points(angle):
    dg = bpy.context.evaluated_depsgraph_get(); rot = Matrix.Rotation(angle, 4, 'Z'); xs = []
    for ob in bpy.data.collections[MASTER].objects:
        if ob.type not in ('MESH', 'CURVE'): continue
        ev = ob.evaluated_get(dg); me = ev.to_mesh(); mw = rot @ ev.matrix_world
        xs += [(mw @ v.co).x for v in me.vertices]; ev.to_mesh_clear()
    return min(xs), max(xs)

def copy_master(c, root):
    mapping = {}
    src = list(bpy.data.collections[MASTER].objects)
    for ob in src:
        cp = ob.copy(); cp.name = ob.name + ' | ' + root.name; c.objects.link(cp); mapping[ob] = cp
    for ob, cp in mapping.items():
        mw = ob.matrix_parent_inverse.copy()
        cp.parent = mapping[ob.parent] if ob.parent else root
        cp.matrix_parent_inverse = mw if ob.parent else Matrix.Identity(4)
    return mapping

def main():
    sc = bpy.context.scene
    assert sc.get('asset_id') == 'rival-mayor' and sc.get('scene_lease') == 'active'
    height = max((json.loads(sc['blockout_bounds_m'])['max'][2]), 0.1)
    figs = coll(SHEET); dress = coll(DRESS)
    bpy.data.collections[MASTER].hide_render = True

    views = [('FRONT', math.pi), ('SIDE', -math.pi / 2), ('BACK', 0.0), ('THREE-QUARTER', -3 * math.pi / 4)]
    gap = 0.42; ruler_x = -0.0; x = 0.55; placed = []
    for label, ang in views:
        lo, hi = master_points(ang); cx = x - lo
        root = put(figs, 'View root ' + label, None); root.location = (cx, 0, 0); root.rotation_euler = (0, 0, ang)
        copy_master(figs, root); placed.append((label, cx, cx + lo, cx + hi)); x = cx + hi + gap
    left = ruler_x - 0.62; right = placed[-1][3] + 0.32
    z_lo = -0.48; z_hi = height + 0.82
    width = max(right - left, 2.0 * (z_hi - z_lo)); height_m = width / 2.0
    cx_cam = (left + right) / 2; cz = (z_lo + z_hi) / 2; z_lo = cz - height_m / 2

    ink = emission('Sheet ink #342c46', '#342c46'); faint = emission('Sheet guide #d9c9ae', '#d9c9ae')
    parchment = emission('Sheet parchment #f5ebdc', '#f5ebdc'); base = emission('Sheet baseline #8f7f6c', '#8f7f6c')
    x0 = cx_cam - width / 2 - 0.5; x1 = cx_cam + width / 2 + 0.5
    plane(dress, 'Parchment backdrop', x0, x1, z_lo - 1, z_lo + height_m + 1, 6.0, parchment)
    fig_x0 = placed[0][2] - 0.15; fig_x1 = placed[-1][3] + 0.15
    plane(dress, 'Ground line', ruler_x + 0.012, fig_x1, -0.012, 0.0, 5.0, base)
    for gz in (0.5, 1.0, 1.5, 2.0):
        for k in range(int((fig_x1 - fig_x0) / 0.16)):
            xa = fig_x0 + k * 0.16
            plane(dress, f'Guide {gz} dash {k}', xa, xa + 0.09, gz - 0.004, gz + 0.004, 5.2, faint)
    for k in range(int((fig_x1 - fig_x0) / 0.16)):
        xa = fig_x0 + k * 0.16
        plane(dress, f'Guide top dash {k}', xa, xa + 0.09, height - 0.005, height + 0.005, 5.2, ink if k % 2 == 0 else faint)
    # Height marker
    plane(dress, 'Height marker bar', ruler_x - 0.012, ruler_x + 0.012, 0.0, height, 5.0, ink)
    for tz in [i * 0.1 for i in range(int(height * 10) + 1)]:
        major = abs(tz * 2 - round(tz * 2)) < 1e-6
        w = 0.09 if major else 0.045
        plane(dress, f'Tick {tz:.1f}', ruler_x, ruler_x + w, tz - 0.005, tz + 0.005, 5.0, ink)
        if major:
            text(dress, f'Tick label {tz:.1f}', f'{tz:.1f} m', ruler_x - 0.05, tz - 0.035, 0.085, ink, align='RIGHT')
    plane(dress, 'Height marker cap', ruler_x - 0.07, ruler_x + 0.12, height - 0.006, height + 0.006, 5.0, ink)
    text(dress, 'Height label', f'{height:.2f} m top of hat', ruler_x + 0.15, height + 0.035, 0.085, ink, align='LEFT')
    for label, cx, lo, hi in placed:
        text(dress, 'Label ' + label, label, cx + (lo + hi) / 2 - cx, -0.30, 0.12, ink)
    # Header: title + palette
    top = z_lo + height_m
    text(dress, 'Title', 'RIVAL MAYOR  ·  rival-mayor v001', left + 0.08, top - 0.32, 0.17, ink, align='LEFT')
    text(dress, 'Subtitle', 'Blender reference sheet, no generated concept', left + 0.08, top - 0.46, 0.08, ink, align='LEFT')
    text(dress, 'Subtitle 2', 'WO111 World A ch.2 boss  ·  orthographic views at one scale  ·  painted blockout, not final topology',
         left + 0.08, top - 0.57, 0.06, ink, align='LEFT')
    pal = [('coat', '#5b3b6a'), ('hat', '#2f2740'), ('sash', '#b54a5a'), ('waistcoat', '#dca953'), ('remote', '#3f7f7a'),
           ('gloves', '#f3e6cf'), ('skin', '#efc9a4'), ('mustache', '#2b2238'), ('stripes', '#8a7c96')]
    sw = 0.26; px = fig_x1 - len(pal) * (sw + 0.06)
    for i, (nm, hx) in enumerate(pal):
        xa = px + i * (sw + 0.06)
        plane(dress, f'Swatch {nm}', xa, xa + sw, top - 0.36, top - 0.18, 5.0, emission(f'Swatch {nm} {hx}', hx))
        text(dress, f'Swatch label {nm}', nm, xa + sw / 2, top - 0.455, 0.055, ink)
        text(dress, f'Swatch hex {nm}', hx, xa + sw / 2, top - 0.53, 0.05, ink)
    text(dress, 'Footer', 'Original parody hooks: tall hat, curly mustache, sash, remote contraption, kitten crew badges. No copied names, logos, faces or costumes.',
         cx_cam, z_lo + 0.06, 0.06, ink)

    # Camera, light, world, render
    cam_data = bpy.data.cameras.new('Sheet ortho camera'); cam_data.type = 'ORTHO'; cam_data.ortho_scale = width
    cam_data.clip_start = 0.1; cam_data.clip_end = 60
    cam = put(dress, 'Sheet ortho camera', cam_data); cam.location = (cx_cam, -20, cz); cam.rotation_euler = (math.pi / 2, 0, 0)
    sc.camera = cam
    sun_d = bpy.data.lights.new('Warm storybook key', 'SUN'); sun_d.energy = 2.2; sun_d.angle = math.radians(12); sun_d.color = (1.0, 0.95, 0.86)
    sun = put(dress, 'Warm storybook key', sun_d)
    sun.rotation_euler = Vector((0.45, 0.8, -0.55)).normalized().to_track_quat('-Z', 'Y').to_euler()
    fill_d = bpy.data.lights.new('Cool soft fill', 'SUN'); fill_d.energy = 0.45; fill_d.angle = math.radians(30); fill_d.color = (0.82, 0.88, 1.0)
    fill = put(dress, 'Cool soft fill', fill_d)
    fill.rotation_euler = Vector((-0.6, 0.6, 0.1)).normalized().to_track_quat('-Z', 'Y').to_euler()
    world = bpy.data.worlds.get('Sheet ambient') or bpy.data.worlds.new('Sheet ambient'); world.use_nodes = True
    bg = world.node_tree.nodes.get('Background'); bg.inputs['Color'].default_value = lin('#fff4e4'); bg.inputs['Strength'].default_value = 0.55
    sc.world = world
    r = sc.render; r.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 4; sc.cycles.diffuse_bounces = 3; sc.cycles.glossy_bounces = 1; sc.cycles.transparent_max_bounces = 2
    r.threads_mode = 'AUTO'; r.resolution_x = 2048; r.resolution_y = 1024; r.resolution_percentage = PERCENT
    r.image_settings.file_format = 'PNG'; r.image_settings.color_mode = 'RGB'; r.image_settings.color_depth = '8'
    r.film_transparent = False; sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
    sc.view_settings.exposure = 0.0; sc.view_settings.gamma = 1.0
    # Freestyle plum-ink outline on the figures only
    r.use_freestyle = True; r.line_thickness_mode = 'ABSOLUTE'; r.line_thickness = 1.0
    vl = bpy.context.view_layer; vl.use_freestyle = True; fs = vl.freestyle_settings; fs.crease_angle = math.radians(128)
    for ls in list(fs.linesets): fs.linesets.remove(ls)
    ls = fs.linesets.new('Figure ink'); ls.select_by_visibility = True; ls.visibility = 'VISIBLE'
    ls.select_by_edge_types = True; ls.select_silhouette = True; ls.select_border = True; ls.select_crease = True
    ls.select_by_collection = True; ls.collection = figs
    style = bpy.data.linestyles.new('Plum ink line'); style.color = lin('#342c46')[:3]; style.thickness = 2.2 * PERCENT / 100
    ls.linestyle = style
    out = ROOT / OUT; r.filepath = str(out)
    t0 = datetime.datetime.now(datetime.timezone.utc)
    bpy.ops.render.render(write_still=True)
    secs = (datetime.datetime.now(datetime.timezone.utc) - t0).total_seconds()
    rec = {'image': str(out), 'sha256': hashlib.sha256(out.read_bytes()).hexdigest(), 'render_seconds': round(secs, 1),
           'resolution': [r.resolution_x * PERCENT // 100, r.resolution_y * PERCENT // 100], 'samples': SAMPLES,
           'ortho_width_m': round(width, 3), 'height_marker_m': round(height, 4),
           'views': [{'label': l, 'center_x_m': round(c, 3), 'x_extent_m': [round(a, 3), round(b, 3)]} for l, c, a, b in placed]}
    print(json.dumps(rec)); return rec

if __name__ == '__main__':
    main()
