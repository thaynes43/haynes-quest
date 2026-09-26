"""WO111 bin-chicken v001: orthographic reference sheet from the painted blockout.

Adapted from the mischief-kitten / rival-mayor / magic-house sheet scripts. Four linked-data copies of the master
blockout (front, side, back, three-quarter) at identical scale, one orthographic camera, parchment backdrop
(#f5ebdc, Standard view transform so it renders exactly), a metre height marker with 5 cm ticks, horizontal scale
guides, labels, a palette row and plum-ink Freestyle outlines. Unlike the kitten sheet, the frame is sized from the
figure height (the ibis is tall and narrow) and the dressing scales with it by U. Run after build_blockout.py.
SHEET_PERCENT (module global) sets render size: 100 -> 2048x1024.
"""
import bpy, math, json, hashlib, datetime
from mathutils import Vector, Matrix
from pathlib import Path

ROOT = Path('/workspace/haynes-quest/family-eras/bin-chicken/v001')
MASTER = 'Bin chicken blockout (master)'
SHEET = 'Reference sheet (figures)'
DRESS = 'Reference sheet (parchment, guides, labels)'
PERCENT = globals().get('SHEET_PERCENT', 100)
SAMPLES = globals().get('SHEET_SAMPLES', 48)
OUT = globals().get('SHEET_OUT', 'reference-sheet.png')
FIG_FRACTION = 0.45   # figure height as a share of the sheet height

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

def fit(ob, max_w):
    """Shrink a text object's font until its width fits max_w (the long header/footer lines)."""
    for _ in range(12):
        bpy.context.view_layer.update()
        if ob.dimensions.x <= max_w: break
        ob.data.size *= max(0.8, max_w / ob.dimensions.x * 0.995)
    return ob

def master_points(angle):
    dg = bpy.context.evaluated_depsgraph_get(); rot = Matrix.Rotation(angle, 4, 'Z'); xs = []
    for ob in bpy.data.collections[MASTER].objects:
        if ob.type not in ('MESH', 'CURVE'): continue
        ev = ob.evaluated_get(dg); me = ev.to_mesh(); mw = rot @ ev.matrix_world
        xs += [(mw @ v.co).x for v in me.vertices]; ev.to_mesh_clear()
    return min(xs), max(xs)

def copy_master(c, root):
    mapping = {}
    for ob in list(bpy.data.collections[MASTER].objects):
        cp = ob.copy(); cp.name = ob.name + ' | ' + root.name; c.objects.link(cp); mapping[ob] = cp
    for ob, cp in mapping.items():
        mw = ob.matrix_parent_inverse.copy()
        cp.parent = mapping[ob.parent] if ob.parent else root
        cp.matrix_parent_inverse = mw if ob.parent else Matrix.Identity(4)
    return mapping

def main():
    sc = bpy.context.scene
    assert sc.get('asset_id') == 'bin-chicken' and sc.get('scene_lease') == 'active'
    height = json.loads(sc['blockout_bounds_m'])['max'][2]
    tops = json.loads(sc['blockout_tops_m'])
    figs = coll(SHEET); dress = coll(DRESS)
    bpy.data.collections[MASTER].hide_render = True

    views = [('FRONT', math.pi), ('SIDE', -math.pi / 2), ('BACK', 0.0), ('THREE-QUARTER', -3 * math.pi / 4)]
    ext = [(label, ang) + master_points(ang) for label, ang in views]
    widths = [hi - lo for _, _, lo, hi in ext]
    # Frame from the figure height; spread any horizontal slack into the gaps (then the outer margins).
    H = height / FIG_FRACTION
    for _ in range(3):
        U = H / 2.216                                    # the kitten sheet's frame height is the dressing reference
        fixed = 0.26 * U + 0.24 * U + 0.10 * U; min_gap = 0.14 * U
        H = max(H, (fixed + sum(widths) + 3 * min_gap) / 2)
    U = H / 2.216; W = 2 * H
    gap = (W - 0.60 * U - sum(widths)) / 3; extra = 0.0
    if gap > 0.42 * U:
        extra = 3 * (gap - 0.42 * U) / 2; gap = 0.42 * U
    ruler_x = 0.0; left = ruler_x - 0.26 * U - extra * 0.5; x = 0.24 * U + extra * 0.5; placed = []
    for (label, ang, lo, hi) in ext:
        cx = x - lo
        root = put(figs, 'View root ' + label, None); root.location = (cx, 0, 0); root.rotation_euler = (0, 0, ang)
        copy_master(figs, root); placed.append((label, cx, cx + lo, cx + hi)); x = cx + hi + gap
    right = left + W
    width = W; height_m = H
    HS = height_m / 3.75
    cx_cam = (left + right) / 2
    z_lo = -0.21 * H; cz = z_lo + height_m / 2

    ink = emission('Sheet ink #342c46', '#342c46'); faint = emission('Sheet guide #d9c9ae', '#d9c9ae')
    parchment = emission('Sheet parchment #f5ebdc', '#f5ebdc'); base = emission('Sheet baseline #8f7f6c', '#8f7f6c')
    x0 = cx_cam - width / 2 - 0.5; x1 = cx_cam + width / 2 + 0.5
    plane(dress, 'Parchment backdrop', x0, x1, z_lo - 1, z_lo + height_m + 1, 6.0, parchment)
    fig_x0 = placed[0][2] - 0.08 * U; fig_x1 = placed[-1][3] + 0.06 * U
    plane(dress, 'Ground line', ruler_x + 0.006 * U, fig_x1, -0.006 * U, 0.0, 5.0, base)
    dash, period = 0.04 * U, 0.07 * U
    for gz in [0.25 * i for i in range(1, int(height / 0.25) + 1) if 0.25 * i < height - 0.04]:
        for k in range(int((fig_x1 - fig_x0) / period)):
            xa = fig_x0 + k * period
            plane(dress, f'Guide {gz} dash {k}', xa, xa + dash, gz - 0.0018 * U, gz + 0.0018 * U, 5.2, faint)
    for k in range(int((fig_x1 - fig_x0) / period)):
        xa = fig_x0 + k * period
        plane(dress, f'Guide top dash {k}', xa, xa + dash, height - 0.0022 * U, height + 0.0022 * U, 5.2, ink if k % 2 == 0 else faint)
    # Height marker: bar, 5 cm ticks, labels every 25 cm
    plane(dress, 'Height marker bar', ruler_x - 0.005 * U, ruler_x + 0.005 * U, 0.0, height, 5.0, ink)
    for i in range(int(height * 20 + 1e-6) + 1):
        tz = i * 0.05; major = i % 5 == 0
        w = (0.04 if major else 0.02) * U
        plane(dress, f'Tick {tz:.2f}', ruler_x, ruler_x + w, tz - 0.0022 * U, tz + 0.0022 * U, 5.0, ink)
        if major:
            text(dress, f'Tick label {tz:.2f}', f'{tz:.2f} m', ruler_x - 0.025 * U, tz - 0.02 * U, 0.05 * U, ink, align='RIGHT')
    plane(dress, 'Height marker cap', ruler_x - 0.03 * U, ruler_x + 0.05 * U, height - 0.0026 * U, height + 0.0026 * U, 5.0, ink)
    marks = {'top of banana-peel stem': tops['Banana peel stem tip'], 'top of head': tops['Bald ink head'],
             'top of body': tops['Grubby white egg body']}
    text(dress, 'Height label', '  ·  '.join(f'{v:.2f} m {k}' for k, v in sorted(marks.items(), key=lambda kv: -kv[1])),
         ruler_x + 0.06 * U, height + 0.016 * U, 0.048 * U, ink, align='LEFT')
    for label, cx, lo, hi in placed:
        text(dress, 'Label ' + label, label, (lo + hi) / 2, -0.145 * U, 0.068 * U, ink)
    # Header: title + palette (swatches carry a thin ink border so the whites read on parchment)
    top = z_lo + height_m
    text(dress, 'Title', 'BIN CHICKEN  ·  bin-chicken v001', left + 0.10 * HS, top - 0.46 * HS, 0.235 * HS, ink, align='LEFT')
    text(dress, 'Subtitle', 'Blender reference sheet, no generated concept', left + 0.10 * HS, top - 0.69 * HS, 0.12 * HS, ink, align='LEFT')
    pal = [('feathers', '#f1f0ea'), ('bare skin', '#2e2a38'), ('beak', '#4c4657'), ('legs', '#7d6c7a'), ('gape grin', '#e3998d'),
           ('peel', '#f2c94c'), ('chips', '#e7b451'), ('chip paper', '#5d8fbf')]
    sw = 0.28 * HS; sg = 0.06 * HS; px = right - 0.10 * HS - len(pal) * (sw + sg) + sg; bd = 0.008 * HS
    fit(text(dress, 'Subtitle 2', 'WO111 World B ch.2 ordinary (bin-raiding ibis, serves a and b)  ·  orthographic views at one scale  ·  painted blockout, not final topology',
             left + 0.10 * HS, top - 0.86 * HS, 0.09 * HS, ink, align='LEFT'), px - left - 0.30 * HS)
    for i, (nm, hx) in enumerate(pal):
        xa = px + i * (sw + sg)
        plane(dress, f'Swatch border {nm}', xa - bd, xa + sw + bd, top - 0.52 * HS - bd, top - 0.26 * HS + bd, 5.1, ink)
        plane(dress, f'Swatch {nm}', xa, xa + sw, top - 0.52 * HS, top - 0.26 * HS, 5.0, emission(f'Swatch {nm} {hx}', hx))
        text(dress, f'Swatch label {nm}', nm, xa + sw / 2, top - 0.66 * HS, 0.08 * HS, ink)
        text(dress, f'Swatch hex {nm}', hx, xa + sw / 2, top - 0.77 * HS, 0.072 * HS, ink)
    fit(text(dress, 'Footer', "Original parody hooks: the Aussie 'bin chicken' (white ibis) of the era's backyard-suburb cartoons, a banana-peel hat, a stolen hot chip and loot hidden behind its back. No copied names, logos, faces or costumes.",
             cx_cam, z_lo + 0.10 * HS, 0.09 * HS, ink), 0.94 * W)

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
    style = bpy.data.linestyles.get('Plum ink line') or bpy.data.linestyles.new('Plum ink line')
    style.color = lin('#342c46')[:3]; style.thickness = 1.7 * PERCENT / 100
    ls.linestyle = style
    out = ROOT / OUT; r.filepath = str(out)
    t0 = datetime.datetime.now(datetime.timezone.utc)
    bpy.ops.render.render(write_still=True)
    secs = (datetime.datetime.now(datetime.timezone.utc) - t0).total_seconds()
    rec = {'image': str(out), 'sha256': hashlib.sha256(out.read_bytes()).hexdigest(), 'render_seconds': round(secs, 1),
           'resolution': [r.resolution_x * PERCENT // 100, r.resolution_y * PERCENT // 100], 'samples': SAMPLES,
           'ortho_width_m': round(width, 3), 'sheet_height_m': round(height_m, 3), 'height_marker_m': round(height, 4), 'feature_tops_m': tops,
           'views': [{'label': l, 'center_x_m': round(c, 3), 'x_extent_m': [round(a, 3), round(b, 3)]} for l, c, a, b in placed]}
    if OUT == 'reference-sheet.png':
        (ROOT / 'sheet-render.json').write_text(json.dumps(rec) + '\n')
    print(json.dumps(rec)); return rec

if __name__ == '__main__':
    main()
