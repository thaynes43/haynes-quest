"""WO111 playroom-kit v001: one parchment kit reference sheet from the painted blockout (run after build_blockout.py).

Adapted from the lab-robot v001 sheet script (itself from radio-host-showman / putty-grunt / demon-band-idol /
bin-chicken / mischief-kitten / rival-mayor) for a kit: four props in columns, a FRONT row above a THREE-QUARTER row
(turned 40 deg), every figure a linked-data copy of the master at one orthographic scale. Each row has its own metre
ruler (10 cm ticks, labels every 50 cm) and faint 50 cm guides. The theme-kit registry box of each prop is drawn as a
dashed rectangle behind the front view and as a dashed 3-D cuboid round the three-quarter view. Parchment #f5ebdc
(Standard view transform so it renders exactly), plum-ink Freestyle outlines on the figures only, a palette row and
the title line "Blender reference sheet, no generated concept". SHEET_PERCENT (module global): 100 -> 2048x1024.
"""
import bpy, math, json, hashlib, datetime
from mathutils import Vector, Matrix
from pathlib import Path

ROOT = Path('/workspace/haynes-quest/family-eras/playroom-kit/v001')
MASTER = 'Playroom kit blockout (master)'
DECALS = 'Reference sheet (painted details, no ink)'
SHEET = 'Reference sheet (figures)'
DRESS = 'Reference sheet (parchment, guides, labels)'
PERCENT = globals().get('SHEET_PERCENT', 100)
SAMPLES = globals().get('SHEET_SAMPLES', 48)
OUT = globals().get('SHEET_OUT', 'reference-sheet.png')
Q_ANGLE = math.radians(40)
PROPS = ['stacking-block-tower', 'toy-bus-garage', 'crib-rail-fence', 'giant-plush-ball']
REGISTRY = {'stacking-block-tower': (0.7, 2.4, 0.7), 'toy-bus-garage': (2.0, 2.2, 1.6),
            'crib-rail-fence': (1.6, 0.9, 0.12), 'giant-plush-ball': (0.9, 1.8, 0.9)}
PALETTE = [('cream', '#fdf6ec'), ('pink', '#f4a7b9'), ('rose', '#e8829f'), ('sky', '#a7d8f4'), ('blue', '#6fb1e3'),
           ('butter', '#fbe3a1'), ('honey', '#f2c65c'), ('lilac', '#b9a7f4'), ('mint', '#a7e0c8'), ('night', '#5a4a7c')]
TITLE = 'PLAYROOM KIT  ·  playroom-kit v001'
SUBTITLE = 'Blender reference sheet, no generated concept'
SUBTITLE2 = ('WO111 World B ch.1 playroom theme  ·  four static props, front and three-quarter (turned 40°) at one orthographic scale  ·  '
             'dashed: theme-kit registry boxes  ·  painted blockout, not final topology')
FOOTER = ("Original soft nursery-toy props for a toddler sing-along playroom: foam stacking blocks, the Honk Bus's toy garage, a crib rail "
          "with a bead slide and a plush ball. No copied characters, logos, lettering or toy-brand designs.")

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

def bar(c, name, a, b, t, m):
    """Thin square-section bar from a to b (3-D dashes of the registry cuboids)."""
    a = Vector(a); b = Vector(b); me = bpy.data.meshes.new(name); L = (b - a).length; h = t / 2
    v = [(-h, -h, 0), (h, -h, 0), (h, h, 0), (-h, h, 0), (-h, -h, L), (h, -h, L), (h, h, L), (-h, h, L)]
    me.from_pydata(v, [], [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]); me.update()
    ob = put(c, name, me); me.materials.append(m); ob.location = a
    ob.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler(); return ob

def text(c, name, body, x, z, size, m, align='CENTER', y=3.0, rot_y=0.0):
    cu = bpy.data.curves.new(name, 'FONT'); cu.body = body; cu.size = size; cu.align_x = align; cu.align_y = 'BOTTOM'
    ob = put(c, name, cu); ob.location = (x, y, z); ob.rotation_euler = (math.pi / 2, rot_y, 0); cu.materials.append(m); return ob

def fit(ob, max_w):
    for _ in range(12):
        bpy.context.view_layer.update()
        if ob.dimensions.x <= max_w: break
        ob.data.size *= max(0.8, max_w / ob.dimensions.x * 0.995)
    return ob

def prop_objects(prop):
    return [o for o in bpy.data.collections['PK ' + prop].objects]

def extents(prop, angle):
    dg = bpy.context.evaluated_depsgraph_get(); rot = Matrix.Rotation(angle, 4, 'Z'); xs = []; zs = []
    for ob in prop_objects(prop):
        if ob.type not in ('MESH', 'CURVE'): continue
        ev = ob.evaluated_get(dg); me = ev.to_mesh(); mw = rot @ ev.matrix_world
        for v in me.vertices:
            w = mw @ v.co; xs.append(w.x); zs.append(w.z)
        ev.to_mesh_clear()
    return min(xs), max(xs), max(zs)

def place(figs, decals, prop, label, cx, gz, ang):
    root = put(figs, f'View root {label} {prop}', None); root.location = (cx, 0, gz); root.rotation_euler = (0, 0, ang)
    for ob in prop_objects(prop):
        cp = ob.copy(); cp.name = ob.name + f' | {label}'; cp.parent = root; cp.matrix_parent_inverse = Matrix.Identity(4)
        (decals if ob.get('sheet_no_ink') else figs).objects.link(cp)
    return root

def dashed_h(dress, name, x0, x1, z, t, y, m, dash, period):
    k = 0; x = x0
    while x < x1 - 1e-6:
        plane(dress, f'{name} {k}', x, min(x + dash, x1), z - t / 2, z + t / 2, y, m); x += period; k += 1

def dashed_v(dress, name, x, z0, z1, t, y, m, dash, period):
    k = 0; z = z0
    while z < z1 - 1e-6:
        plane(dress, f'{name} {k}', x - t / 2, x + t / 2, z, min(z + dash, z1), y, m); z += period; k += 1

def dashed_3d(dress, name, a, b, t, m, dash, period):
    a = Vector(a); b = Vector(b); L = (b - a).length; d = (b - a) / L; s = 0.0; k = 0
    while s < L - 1e-6:
        bar(dress, f'{name} {k}', a + d * s, a + d * min(s + dash, L), t, m); s += period; k += 1

def fmt3(size):
    return ' × '.join(f'{v:.2f}' for v in size) + ' m'

def main():
    sc = bpy.context.scene
    assert sc.get('asset_id') == 'playroom-kit' and sc.get('scene_lease') == 'active'
    blk = json.loads(sc['blockout_bounds_m'])
    figs = coll(SHEET); dress = coll(DRESS); decals = coll(DECALS)
    bpy.data.collections[MASTER].hide_render = True

    # --- horizontal layout: ruler zone, four columns, right margin ------------------------------------------------------
    cols = []
    for p in PROPS:
        hx, hh, hz = REGISTRY[p]
        f0, f1, ftop = extents(p, 0.0); q0, q1, qtop = extents(p, Q_ANGLE)
        qbox = 2 * (hx * math.cos(Q_ANGLE) + hz * math.sin(Q_ANGLE))
        cols.append(dict(prop=p, front=(f0, f1), q=(q0, q1), width=max(f1 - f0, q1 - q0, 2 * hx, qbox), top=max(ftop, qtop)))
    Z_LO = -0.72; G1 = 3.12; ROW_TOP = 2.5
    H = (G1 + ROW_TOP + 0.10 - Z_LO) / (1 - 0.19)          # header takes 0.95 * H / 5
    W = 2 * H; HS = H / 5.0
    RZ = 1.05; RIGHT = 0.30
    gap = (W - RZ - RIGHT - sum(c['width'] for c in cols)) / 3
    assert gap > 0.25, gap
    left = 0.0; ruler_x = left + RZ - 0.26; x = left + RZ
    for c in cols:
        c['cx'] = x + c['width'] / 2; x += c['width'] + gap
    right = left + W; top = Z_LO + H; cx_cam = (left + right) / 2; cz = Z_LO + H / 2

    ink = emission('Sheet ink #342c46', '#342c46'); faint = emission('Sheet guide #d9c9ae', '#d9c9ae')
    parchment = emission('Sheet parchment #f5ebdc', '#f5ebdc'); base = emission('Sheet baseline #8f7f6c', '#8f7f6c')
    boxm = emission('Sheet registry box #c9953f', '#c9953f')
    plane(dress, 'Parchment backdrop', left - 1, right + 1, Z_LO - 1, top + 1, 6.0, parchment)

    fig_x1 = cols[-1]['cx'] + cols[-1]['width'] / 2 + 0.05
    for row, (label, gz, ang) in enumerate((('FRONT', G1, 0.0), ('THREE-QUARTER', 0.0, Q_ANGLE))):
        # ground line, 50 cm guides, ruler with 10 cm ticks, rotated row title
        plane(dress, f'Ground line {label}', ruler_x + 0.006, fig_x1, gz - 0.008, gz, 5.0, base)
        for gzz in (0.5, 1.0, 1.5, 2.0):
            dashed_h(dress, f'Guide {label} {gzz}', ruler_x + 0.08, fig_x1, gz + gzz, 0.005, 5.3, faint, 0.05, 0.09)
        plane(dress, f'Ruler bar {label}', ruler_x - 0.007, ruler_x + 0.007, gz, gz + ROW_TOP, 5.0, ink)
        for i in range(int(ROW_TOP * 10 + 1e-6) + 1):
            tz = i * 0.1; major = i % 5 == 0; w = 0.07 if major else 0.035
            plane(dress, f'Tick {label} {tz:.1f}', ruler_x, ruler_x + w, gz + tz - 0.0045, gz + tz + 0.0045, 5.0, ink)
            if major:
                text(dress, f'Tick label {label} {tz:.1f}', f'{tz:.1f} m', ruler_x - 0.05, gz + tz - 0.045, 0.115, ink, align='RIGHT')
        plane(dress, f'Ruler cap {label}', ruler_x - 0.05, ruler_x + 0.08, gz + ROW_TOP - 0.005, gz + ROW_TOP + 0.005, 5.0, ink)
        t = text(dress, f'Row title {label}', label, left + 0.2, gz + ROW_TOP / 2, 0.15, ink, rot_y=-math.pi / 2)
        t.data.align_y = 'CENTER'
        for c in cols:
            p = c['prop']; hx, hh, hz = REGISTRY[p]
            fx = c['cx']                                        # both views centred on the floor origin, like their boxes
            place(figs, decals, p, label, fx, gz, ang)
            if ang == 0.0:
                # dashed registry rectangle behind the front view
                for zz in (gz, gz + hh):
                    dashed_h(dress, f'Box {p} h {zz:.2f}', fx - hx, fx + hx, zz, 0.014, 5.2, boxm, 0.08, 0.14)
                for xx in (fx - hx, fx + hx):
                    dashed_v(dress, f'Box {p} v {xx:.2f}', xx, gz, gz + hh, 0.014, 5.2, boxm, 0.08, 0.14)
                size = blk[p]['size']
                text(dress, f'Label {p} front', p, c['cx'], gz - 0.27, 0.16, ink)
                text(dress, f'Size {p} blockout', 'blockout ' + fmt3((size[0], size[2], size[1])) + '  (w × h × d)', c['cx'], gz - 0.43, 0.11, ink)
                text(dress, f'Size {p} registry', 'registry box ' + fmt3((2 * hx, hh, 2 * hz)), c['cx'], gz - 0.585, 0.11, ink)
            else:
                # dashed outline of the registry box turned with the prop (at eye level its silhouette is a rectangle)
                qhw = hx * math.cos(ang) + hz * math.sin(ang)
                for zz in (gz, gz + hh):
                    dashed_h(dress, f'Box {p} q h {zz:.2f}', fx - qhw, fx + qhw, zz, 0.014, 5.2, boxm, 0.08, 0.14)
                for xx in (fx - qhw, fx + qhw):
                    dashed_v(dress, f'Box {p} q v {xx:.2f}', xx, gz, gz + hh, 0.014, 5.2, boxm, 0.08, 0.14)
                text(dress, f'Label {p} three-quarter', p, c['cx'], gz - 0.27, 0.15, ink)
                c['q_origin_x'] = fx
            if ang == 0.0: c['front_origin_x'] = fx

    # --- header: title, subtitles, palette -----------------------------------------------------------------------------
    title = text(dress, 'Title', TITLE, left + 0.10 * HS, top - 0.46 * HS, 0.235 * HS, ink, align='LEFT')
    text(dress, 'Subtitle', SUBTITLE, left + 0.10 * HS, top - 0.69 * HS, 0.12 * HS, ink, align='LEFT')
    sw = 0.28 * HS; sg = 0.06 * HS; px = right - 0.10 * HS - len(PALETTE) * (sw + sg) + sg; bd = 0.008 * HS
    fit(title, px - left - 0.40 * HS)
    fit(text(dress, 'Subtitle 2', SUBTITLE2, left + 0.10 * HS, top - 0.86 * HS, 0.085 * HS, ink, align='LEFT'), px - left - 0.30 * HS)
    for i, (nm, hx) in enumerate(PALETTE):
        xa = px + i * (sw + sg)
        plane(dress, f'Swatch border {nm}', xa - bd, xa + sw + bd, top - 0.52 * HS - bd, top - 0.26 * HS + bd, 5.1, ink)
        plane(dress, f'Swatch {nm}', xa, xa + sw, top - 0.52 * HS, top - 0.26 * HS, 5.0, emission(f'Swatch {nm} {hx}', hx))
        text(dress, f'Swatch label {nm}', nm, xa + sw / 2, top - 0.66 * HS, 0.08 * HS, ink)
        text(dress, f'Swatch hex {nm}', hx, xa + sw / 2, top - 0.77 * HS, 0.072 * HS, ink)
    fit(text(dress, 'Footer', FOOTER, cx_cam, Z_LO + 0.07 * HS, 0.085 * HS, ink), 0.94 * W)

    # --- camera, light, world, render ----------------------------------------------------------------------------------
    cam_data = bpy.data.cameras.new('Sheet ortho camera'); cam_data.type = 'ORTHO'; cam_data.ortho_scale = W
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
    r.use_freestyle = True; r.line_thickness_mode = 'ABSOLUTE'; r.line_thickness = 1.0
    vl = bpy.context.view_layer; vl.use_freestyle = True; fs = vl.freestyle_settings; fs.crease_angle = math.radians(128)
    for ls in list(fs.linesets): fs.linesets.remove(ls)
    ls = fs.linesets.new('Figure ink'); ls.select_by_visibility = True; ls.visibility = 'VISIBLE'
    ls.select_by_edge_types = True; ls.select_silhouette = True; ls.select_border = True; ls.select_crease = True
    ls.select_by_collection = True; ls.collection = figs
    style = bpy.data.linestyles.get('Plum ink line') or bpy.data.linestyles.new('Plum ink line')
    style.color = lin('#342c46')[:3]; style.thickness = 1.6 * PERCENT / 100
    ls.linestyle = style
    out = ROOT / OUT; r.filepath = str(out)
    t0 = datetime.datetime.now(datetime.timezone.utc)
    bpy.ops.render.render(write_still=True)
    secs = (datetime.datetime.now(datetime.timezone.utc) - t0).total_seconds()
    rec = {'image': str(out), 'sha256': hashlib.sha256(out.read_bytes()).hexdigest(), 'render_seconds': round(secs, 1),
           'resolution': [r.resolution_x * PERCENT // 100, r.resolution_y * PERCENT // 100], 'samples': SAMPLES,
           'ortho_width_m': round(W, 3), 'sheet_height_m': round(H, 3), 'pixels_per_metre_at_100': round(2048 / W, 1),
           'three_quarter_turn_deg': round(math.degrees(Q_ANGLE), 1), 'row_ground_z_m': {'FRONT': G1, 'THREE-QUARTER': 0.0},
           'columns': [{'prop': c['prop'], 'center_x_m': round(c['cx'], 3), 'width_m': round(c['width'], 3),
                        'front_origin_x_m': round(c['front_origin_x'], 3), 'three_quarter_origin_x_m': round(c['q_origin_x'], 3)} for c in cols],
           'gap_m': round(gap, 3), 'blockout_sizes_m_w_h_d': {p: [blk[p]['size'][0], blk[p]['size'][2], blk[p]['size'][1]] for p in PROPS},
           'registry_sizes_m_w_h_d': {p: [2 * REGISTRY[p][0], REGISTRY[p][1], 2 * REGISTRY[p][2]] for p in PROPS}}
    if OUT == 'reference-sheet.png':
        (ROOT / 'sheet-render.json').write_text(json.dumps(rec) + '\n')
    print(json.dumps(rec)); return rec

if __name__ == '__main__':
    main()
