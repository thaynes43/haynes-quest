"""WO111 toon-clubhouse-kit v001: orthographic Blender reference sheets of the exact export meshes.

Adapted from the WO111 bin-chicken / rival-mayor sheet.py (parchment #f5ebdc under the Standard view transform, one
orthographic camera, metre height marker with 5 cm ticks, 25 cm guides, a palette row with hex codes, a title,
subtitle and a parody-hooks footer, plum-ink Freestyle outlines). Differences for static props:
  * figures are linked copies of each prop's joined export mesh (exactly what the GLB holds), not blockout parts;
  * props face -Y, so FRONT = 0, SIDE = +90 deg (front to the viewer's right), BACK = 180, THREE-QUARTER = +45 deg;
  * a dashed honey rectangle shows the theme-kit registry box for that view (the envelope decor must stay inside);
  * KIT mode lays all five props side by side at ONE shared scale (the kit contact sheet).
Globals: SHEETS (list of sheet keys, default all), SHEET_PERCENT (100 -> 2048x1024; kit 2560x1280), SHEET_SAMPLES.
"""
import bpy, math, json, hashlib, datetime
from mathutils import Vector, Matrix
from pathlib import Path

ROOT = Path('/workspace/haynes-quest/family-eras/toon-clubhouse-kit/v001')
PERCENT = globals().get('SHEET_PERCENT', 100)
SAMPLES = globals().get('SHEET_SAMPLES', 48)
OUTDIR = globals().get('SHEET_OUTDIR', 'sheets')
FIG_FRACTION = 0.45
SUB = 'Blender reference sheet from the Astra concept draft · exact export mesh'
REG = {'clubhouse-tower-facade': (2.2, 6.5, 0.6), 'curly-slide': (1.2, 3.2, 1.2), 'gadget-toolbox-stand': (0.6, 1.3, 0.45),
       'rounded-hedge': (1.1, 1.2, 0.6), 'stage-marker': (0.9, 0.35, 0.9)}
C = json.loads((ROOT / 'construction.json').read_text())
PAL = C['palette_srgb']
PROPS = {
    'clubhouse-tower-facade': {
        'title': 'CLUBHOUSE TOWER FACADE', 'role': 'shallow facade for room edges',
        'pal': [('walls', 'cream'), ('trim', 'light'), ('stones', 'stone'), ('roof', 'teal'), ('door', 'deepteal'), ('glass', 'glass'), ('chimney', 'ochre'), ('porch', 'plum'), ('bushes', 'moss'), ('leaves', 'leaf')],
        'marks': [('top of chimney cap', 6.36), ('roof apex', 6.32)],
        'hooks': 'Original parody hooks: a droopy one-cone storybook tower with a leaning chimney, round cross window, arched plank door and a broad plum porch. No mouse ears, paired lobes, face, clock, logo, text or copied clubhouse layout.'},
    'curly-slide': {
        'title': 'CURLY SLIDE', 'role': 'freestanding playground decor',
        'pal': [('stairs', 'cream'), ('rings', 'light'), ('post', 'teal'), ('chute', 'ochre')],
        'marks': [('top of ball finial', 3.19), ('chute start', 2.10)],
        'hooks': 'Original parody hooks: a chunky toy-box playground slide whose broad ochre chute half-spirals around one fat teal post into a cream landing, with a rounded cream stair. No brand shapes, text, characters or thin ladders.'},
    'gadget-toolbox-stand': {
        'title': 'GADGET TOOLBOX STAND', 'role': 'waist-high workbench decor',
        'pal': [('body', 'cream'), ('wrench', 'light'), ('top', 'teal'), ('drawer', 'ochre'), ('feet', 'plum'), ('slot', 'slot')],
        'marks': [('top of wrench grip', 1.016), ('tabletop', 1.0)],
        'hooks': "Original parody hooks: the gadget helper's workbench: a teal-topped cream bench on broad plum feet, a big-knob ochre drawer and one blunt wrench resting in a recessed slot. No face, character, labels or lettering."},
    'rounded-hedge': {
        'title': 'ROUNDED HEDGES', 'role': 'planted cluster decor',
        'pal': [('mounds', 'moss'), ('leaves', 'leaf'), ('bed rim', 'teal'), ('soil', 'soil')],
        'marks': [('top of centre mound', 1.146), ('bed rim', 0.10)],
        'hooks': 'Original parody hooks: three puffy clubhouse-garden hedge mounds and a little front puff on a teal-rimmed soil bed, with a few big painted leaf marks. No pot, flowers, topiary character or logo shapes.'},
    'stage-marker': {
        'title': 'DANCE STAGE MARKER', 'role': 'low snack-shaped dance dais',
        'pal': [('rim', 'teal'), ('top', 'cream'), ('mustard', 'ochre'), ('feet', 'plum')],
        'marks': [('rim top', 0.262), ('dance top', 0.232)],
        'hooks': 'Original parody hooks: a hot-dog-dance stage marker: a bun-shaped capsule dais with a mustard squiggle and two goofy dance footprints. No sign, text, character, song reference or logo.'},
}
VIEWS = [('FRONT', 0.0, 0.0), ('SIDE', math.pi / 2, 0.0), ('BACK', math.pi, 0.0), ('THREE-QUARTER', math.pi / 4, 0.0)]


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
    for _ in range(12):
        bpy.context.view_layer.update()
        if ob.dimensions.x <= max_w: break
        ob.data.size *= max(0.8, max_w / ob.dimensions.x * 0.995)
    return ob


def rot(angle, elev):
    return Matrix.Rotation(elev, 4, 'X') @ Matrix.Rotation(angle, 4, 'Z')


def extent(prop, angle, elev):
    ob = bpy.data.objects[prop]; R = rot(angle, elev)
    pts = [R @ v.co for v in ob.data.vertices]
    return min(p.x for p in pts), max(p.x for p in pts), min(p.z for p in pts), max(p.z for p in pts)


def dashed_rect(c, tag, x0, x1, z1, U, m):
    dash, period = 0.035 * U, 0.06 * U; th = 0.0022 * U
    for k in range(int((x1 - x0) / period) + 1):
        xa = x0 + k * period; plane(c, f'{tag} top {k}', xa, min(xa + dash, x1), z1 - th, z1 + th, 5.3, m)
    for side, x in (('l', x0), ('r', x1)):
        for k in range(int(z1 / period) + 1):
            za = k * period; plane(c, f'{tag} {side} {k}', x - th, x + th, za, min(za + dash, z1), 5.3, m)


def render_sheet(key, figures, title, sub2, pal, marks, hooks, out_name, res=(2048, 1024), fig_fraction=FIG_FRACTION):
    """figures: list of (label, prop_id, angle, elev)."""
    sc = bpy.context.scene
    figs = coll('SHEET figures | ' + key); dress = coll('SHEET dressing | ' + key)
    for o in bpy.data.objects:
        if o.name in REG: o.hide_render = True
    for cname in list(bpy.data.collections.keys()):
        if cname.startswith('SHEET') and not cname.endswith('| ' + key): bpy.data.collections[cname].hide_render = True
    figs.hide_render = False; dress.hide_render = False
    ext = []
    for label, prop, ang, elev in figures:
        lo, hi, zlo, zhi = extent(prop, ang, elev)
        hx, h, hz = REG[prop]
        e = abs(hx * math.cos(ang)) + abs(hz * math.sin(ang)) if elev == 0 else None
        ext.append((label, prop, ang, elev, lo, hi, zlo, zhi, e, h))
    height = max(x[7] - x[6] for x in ext if x[3] == 0.0)
    widths = [max(hi - lo, (2 * e) if e else 0) for (_, _, _, _, lo, hi, _, _, e, _) in ext]
    aspect = res[0] / res[1]
    H = height / fig_fraction; fw = list(widths)
    for _ in range(6):
        U = H / 2.216
        widths = [max(w, len(x[0]) * 0.068 * 0.60 * U + 0.06 * U) for w, x in zip(fw, ext)]
        fixed = 0.26 * U + 0.24 * U + 0.10 * U; min_gap = 0.14 * U
        H = max(H, (fixed + sum(widths) + (len(widths) - 1) * min_gap) / aspect)
    U = H / 2.216; W = aspect * H
    widths = [max(w, len(x[0]) * 0.068 * 0.60 * U + 0.06 * U) for w, x in zip(fw, ext)]
    gap = (W - 0.60 * U - sum(widths)) / max(1, len(widths) - 1); extra = 0.0
    if gap > 0.42 * U:
        extra = (len(widths) - 1) * (gap - 0.42 * U) / 2; gap = 0.42 * U
    ruler_x = 0.0; left = ruler_x - 0.26 * U - extra * 0.5; x = 0.24 * U + extra * 0.5; placed = []
    for (label, prop, ang, elev, lo, hi, zlo, zhi, e, h), wd, w0 in zip(ext, widths, fw):
        span_lo = min(lo, -e) if e else lo
        cx = x - span_lo + (wd - w0) / 2
        cp = bpy.data.objects[prop].copy(); cp.name = f'{prop} | {label} | {key}'; figs.objects.link(cp)
        cp.matrix_world = Matrix.Translation((cx, 0, -zlo)) @ rot(ang, elev); cp.hide_render = False
        placed.append((label, prop, cx, cx + lo, cx + hi, e, h, elev)); x = x + wd + gap
    right = left + W
    cx_cam = (left + right) / 2; z_lo = -0.21 * H
    HS = H / 3.75
    ink = emission('Sheet ink #342c46', '#342c46'); faint = emission('Sheet guide #d9c9ae', '#d9c9ae')
    parchment = emission('Sheet parchment #f5ebdc', '#f5ebdc'); base = emission('Sheet baseline #8f7f6c', '#8f7f6c')
    honey = emission('Sheet registry dash #c9953f', '#c9953f')
    plane(dress, 'Parchment backdrop', cx_cam - W / 2 - 0.5, cx_cam + W / 2 + 0.5, z_lo - 1, z_lo + H + 1, 6.0, parchment)
    fig_x0 = min(p[3] for p in placed) - 0.08 * U; fig_x1 = max(max(p[4], p[2] + (p[5] or 0)) for p in placed) + 0.06 * U
    plane(dress, 'Ground line', ruler_x + 0.006 * U, fig_x1, -0.006 * U, 0.0, 5.0, base)
    dash, period = 0.04 * U, 0.07 * U
    step = next((c for c in (0.05, 0.1, 0.25, 0.5, 1.0) if c >= 0.075 * U and height / c <= 16), 1.0)
    for gz in [step * i for i in range(1, int(height / step) + 1) if step * i < height - 0.02 * height]:
        for k in range(int((fig_x1 - fig_x0) / period)):
            xa = fig_x0 + k * period
            plane(dress, f'Guide {gz} dash {k}', xa, xa + dash, gz - 0.0018 * U, gz + 0.0018 * U, 5.2, faint)
    for k in range(int((fig_x1 - fig_x0) / period)):
        xa = fig_x0 + k * period
        plane(dress, f'Guide top dash {k}', xa, xa + dash, height - 0.0022 * U, height + 0.0022 * U, 5.2, ink if k % 2 == 0 else faint)
    # Height marker: bar, ticks and labels (5 cm ticks up to 2 m tall figures, 10 cm above; labels every guide step)
    plane(dress, 'Height marker bar', ruler_x - 0.005 * U, ruler_x + 0.005 * U, 0.0, height, 5.0, ink)
    tick = step / 5; major_every = 5
    for i in range(int(height / tick + 1e-6) + 1):
        tz = i * tick; major = i % major_every == 0
        w = (0.04 if major else 0.02) * U
        plane(dress, f'Tick {tz:.2f}', ruler_x, ruler_x + w, tz - 0.0022 * U, tz + 0.0022 * U, 5.0, ink)
        if major:
            text(dress, f'Tick label {tz:.2f}', f'{tz:.2f} m', ruler_x - 0.025 * U, tz - 0.02 * U, 0.05 * U, ink, align='RIGHT')
    plane(dress, 'Height marker cap', ruler_x - 0.03 * U, ruler_x + 0.05 * U, height - 0.0026 * U, height + 0.0026 * U, 5.0, ink)
    text(dress, 'Height label', '  ·  '.join(f'{v:.2f} m {k}' for k, v in marks), ruler_x + 0.06 * U, height + 0.016 * U, 0.048 * U, ink, align='LEFT')
    for label, prop, cx, lo, hi, e, h, elev in placed:
        text(dress, 'Label ' + label, label, (min(lo, cx - (e or 0)) + max(hi, cx + (e or 0))) / 2, -0.145 * U, 0.068 * U, ink)
        if e: dashed_rect(dress, f'Registry {label}', cx - e, cx + e, h, U, honey)
    top = z_lo + H
    fit(text(dress, 'Title', title, left + 0.10 * HS, top - 0.46 * HS, 0.235 * HS, ink, align='LEFT'), W * 0.5)
    text(dress, 'Subtitle', SUB, left + 0.10 * HS, top - 0.69 * HS, 0.12 * HS, ink, align='LEFT')
    sw = 0.28 * HS; sg = 0.06 * HS; bd = 0.008 * HS
    px = right - 0.10 * HS - len(pal) * (sw + sg) + sg
    fit(text(dress, 'Subtitle 2', sub2, left + 0.10 * HS, top - 0.86 * HS, 0.09 * HS, ink, align='LEFT'), px - left - 0.30 * HS)
    for i, (nm, hx_) in enumerate(pal):
        xa = px + i * (sw + sg)
        plane(dress, f'Swatch border {nm}', xa - bd, xa + sw + bd, top - 0.52 * HS - bd, top - 0.26 * HS + bd, 5.1, ink)
        plane(dress, f'Swatch {nm}', xa, xa + sw, top - 0.52 * HS, top - 0.26 * HS, 5.0, emission(f'Swatch {nm} {hx_}', hx_))
        fit(text(dress, f'Swatch label {nm}', nm, xa + sw / 2, top - 0.66 * HS, 0.08 * HS, ink), sw + sg * 0.9)
        text(dress, f'Swatch hex {nm}', hx_, xa + sw / 2, top - 0.77 * HS, 0.072 * HS, ink)
    fit(text(dress, 'Footer', hooks, cx_cam, z_lo + 0.10 * HS, 0.09 * HS, ink), 0.94 * W)
    cam_data = bpy.data.cameras.new('Sheet ortho camera ' + key); cam_data.type = 'ORTHO'; cam_data.ortho_scale = W
    cam_data.clip_start = 0.1; cam_data.clip_end = 80
    cam = put(dress, 'Sheet ortho camera ' + key, cam_data); cam.location = (cx_cam, -30, z_lo + H / 2); cam.rotation_euler = (math.pi / 2, 0, 0)
    sc.camera = cam
    sun_d = bpy.data.lights.new('Warm storybook key ' + key, 'SUN'); sun_d.energy = 2.2; sun_d.angle = math.radians(12); sun_d.color = (1.0, 0.95, 0.86)
    sun = put(dress, 'Warm storybook key ' + key, sun_d); sun.rotation_euler = Vector((0.45, 0.8, -0.55)).normalized().to_track_quat('-Z', 'Y').to_euler()
    fill_d = bpy.data.lights.new('Cool soft fill ' + key, 'SUN'); fill_d.energy = 0.45; fill_d.angle = math.radians(30); fill_d.color = (0.82, 0.88, 1.0)
    fill = put(dress, 'Cool soft fill ' + key, fill_d); fill.rotation_euler = Vector((-0.6, 0.6, 0.1)).normalized().to_track_quat('-Z', 'Y').to_euler()
    world = bpy.data.worlds.get('Sheet ambient') or bpy.data.worlds.new('Sheet ambient'); world.use_nodes = True
    bg = world.node_tree.nodes.get('Background'); bg.inputs['Color'].default_value = lin('#fff4e4'); bg.inputs['Strength'].default_value = 0.55
    sc.world = world
    r = sc.render; r.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 4; sc.cycles.diffuse_bounces = 3; sc.cycles.glossy_bounces = 1; sc.cycles.transparent_max_bounces = 2
    r.threads_mode = 'AUTO'; r.resolution_x = res[0]; r.resolution_y = res[1]; r.resolution_percentage = PERCENT
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
    style.color = lin('#342c46')[:3]; style.thickness = 1.7 * PERCENT / 100
    ls.linestyle = style
    out = ROOT / OUTDIR / out_name; out.parent.mkdir(parents=True, exist_ok=True); r.filepath = str(out)
    t0 = datetime.datetime.now(datetime.timezone.utc)
    bpy.ops.render.render(write_still=True)
    secs = (datetime.datetime.now(datetime.timezone.utc) - t0).total_seconds()
    r.use_freestyle = False
    px_per_m = res[0] * PERCENT / 100 / W
    rec = {'image': str(out), 'sha256': hashlib.sha256(out.read_bytes()).hexdigest(), 'render_seconds': round(secs, 1),
           'resolution': [res[0] * PERCENT // 100, res[1] * PERCENT // 100], 'samples': SAMPLES, 'ortho_width_m': round(W, 4),
           'sheet_height_m': round(H, 4), 'px_per_m': round(px_per_m, 3), 'floor_px_y': round((z_lo + H - 0.0) / H * res[1] * PERCENT / 100, 2),
           'camera_left_m': round(cx_cam - W / 2, 4), 'height_marker_m': round(height, 4),
           'views': [{'label': l, 'prop': p, 'center_x_m': round(c, 4), 'x_extent_m': [round(a, 4), round(b, 4)], 'registry_half_width_m': e,
                      'elevation_deg': round(math.degrees(ev), 1)} for l, p, c, a, b, e, h, ev in placed]}
    print(json.dumps({'sheet': out_name, 'seconds': rec['render_seconds'], 'W': rec['ortho_width_m']}))
    return rec


def main():
    sc = bpy.context.scene
    assert sc.get('asset_id') == 'toon-clubhouse-kit' and sc.get('scene_lease') == 'active'
    for c in bpy.data.collections:
        if 'EDITABLE' in c.name: c.hide_render = True
    wanted = globals().get('SHEETS', list(PROPS) + ['kit'])
    records = {}
    rpath = ROOT / OUTDIR / 'sheet-render.json'
    if rpath.exists(): records = json.loads(rpath.read_text())
    for key in wanted:
        if key == 'kit':
            short = {'clubhouse-tower-facade': 'TOWER FACADE', 'curly-slide': 'CURLY SLIDE', 'gadget-toolbox-stand': 'GADGET STAND', 'rounded-hedge': 'HEDGES', 'stage-marker': 'DANCE MARKER'}
            figs = [(short[p], p, math.pi / 4, 0.0) for p in PROPS]
            tri = sum(C['props'][p]['triangles'] for p in PROPS)
            pal = [(nm, PAL[k]) for nm, k in [('cream', 'cream'), ('trim', 'light'), ('teal', 'teal'), ('deep teal', 'deepteal'), ('ochre', 'ochre'), ('plum', 'plum'),
                                               ('moss', 'moss'), ('leaf', 'leaf'), ('soil', 'soil')]]
            records[key] = render_sheet(key, figs, 'TOON CLUBHOUSE KIT  ·  toon-clubhouse-kit v001',
                                        f'WO111 World A ch.1 clubhouse theme  ·  five static props, THREE-QUARTER at one shared ortho scale  ·  {tri:,} tris  ·  dashed: registry boxes',
                                        pal, [('clubhouse tower facade', C['props']['clubhouse-tower-facade']['size_m']['height_y'])],
                                        'Kit contact sheet. Original parody props for a first-chapter cartoon clubhouse: no mouse ears, franchise characters, copied logos, text or famous clubhouse layout. Awaiting Tom\'s review · used in the family release.',
                                        'kit-contact-sheet.png', res=(2560, 1280), fig_fraction=0.52)
            continue
        d = PROPS[key]; m = C['props'][key]; hx, h, hz = REG[key]
        views = VIEWS if key != 'stage-marker' else VIEWS[:3] + [('THREE-QUARTER (35 deg above)', math.pi / 4, math.radians(35))]
        figs = [(label, key, a, e) for label, a, e in views]
        s = m['size_m']
        sub2 = (f"WO111 World A ch.1 clubhouse kit  ·  {s['width_x']:.2f} × {s['height_y']:.2f} × {s['depth_z']:.2f} m in its "
                f"{2 * hx:.2f} × {h:.2f} × {2 * hz:.2f} m registry box (dashed)  ·  one ortho scale  ·  {m['triangles']:,} tris")
        pal = [(nm, PAL[k]) for nm, k in d['pal']]
        records[key] = render_sheet(key, figs, f"{d['title']}  ·  {key} v001", sub2, pal, d['marks'], d['hooks'], f'{key}-reference-sheet.png')
    rpath.write_text(json.dumps(records, indent=1) + '\n')
    print(json.dumps({k: v['sha256'][:12] for k, v in records.items()}))


if __name__ == '__main__':
    main()
