"""WO111 casita-kit v001: one parchment kit reference sheet from the painted blockout (run after build_blockout.py).

Adapted from the playroom-kit v001 sheet script (itself from lab-robot / radio-host-showman / putty-grunt) for a kit
whose tallest prop (the 3.2 m arch) and widest prop (the 4.8 m wall) share a sheet: every figure is a linked-data copy
of the master at ONE orthographic scale, laid out in two rows.
  Row A: casita-terrace-wall front + three-quarter (turned 40 deg), butterfly-arch front + three-quarter.
  Row B: flower-planter front + three-quarter + from above (front at the bottom), patterned-door front + three-quarter
         + side, casita-terrace-wall side (front to the right), and a World B ch.2 placement-notes block.
Each row has its own metre ruler (10 cm ticks, labels every 50 cm) and faint 50 cm guides. The theme-kit registry box of
each prop is drawn dashed behind every view (turned with the prop). Parchment #f5ebdc (Standard view transform so it
renders exactly), plum-ink Freestyle outlines on the figures only, a palette row and the title line
"Blender reference sheet, no generated concept". SHEET_PERCENT (module global): 100 -> 2048x1024.
"""
import bpy, math, json, hashlib, datetime
from mathutils import Vector, Matrix
from pathlib import Path

ROOT = Path('/workspace/haynes-quest/family-eras/casita-kit/v001')
MASTER = 'Casita kit blockout (master)'
DECALS = 'Reference sheet (painted details, no ink)'
SHEET = 'Reference sheet (figures)'
DRESS = 'Reference sheet (parchment, guides, labels)'
PERCENT = globals().get('SHEET_PERCENT', 100)
SAMPLES = globals().get('SHEET_SAMPLES', 48)
OUT = globals().get('SHEET_OUT', 'reference-sheet.png')
Q = math.radians(40)
PROPS = ['casita-terrace-wall', 'flower-planter', 'patterned-door', 'butterfly-arch']
REGISTRY = {'casita-terrace-wall': (2.4, 2.0, 0.35), 'flower-planter': (0.6, 0.9, 0.6),
            'patterned-door': (0.8, 2.4, 0.2), 'butterfly-arch': (1.8, 3.2, 0.3)}
PALETTE = [('cream', '#f5e6c8'), ('stucco', '#f1c28c'), ('terracotta', '#d9825b'), ('clay', '#c4643f'), ('tile', '#a94a32'),
           ('teal', '#2e8b73'), ('blue', '#4e8ab8'), ('gold', '#f2c14e'), ('marigold', '#f2a93b'), ('leaf', '#3f9b4f'),
           ('bloom', '#e8487a'), ('plum', '#3a2842')]
TITLE = 'CASITA KIT  ·  casita-kit v001'
SUBTITLE = 'Blender reference sheet, no generated concept'
SUBTITLE2 = ('WO111 World B ch.2 casita theme  ·  four static props at one orthographic scale: front and three-quarter (turned 40°), '
             'plus the planter from above and two side views  ·  dashed: theme-kit registry boxes  ·  painted blockout, not final topology')
FOOTER = ('Original magic-casita garden props: a stucco terrace wall with candle niches, a talavera flower planter, a folk-painted double door '
          'and a candle-and-butterfly vine arch. No copied characters, portraits, logos, lettering or film designs.')
CAPTION = {'front': 'front', 'q': 'three-quarter, 40°', 'top': 'from above', 'side': 'side'}
# (prop, view, row, group)
FIGS = [('casita-terrace-wall', 'front', 'A', 0), ('casita-terrace-wall', 'q', 'A', 0),
        ('butterfly-arch', 'front', 'A', 1), ('butterfly-arch', 'q', 'A', 1),
        ('flower-planter', 'front', 'B', 0), ('flower-planter', 'q', 'B', 0), ('flower-planter', 'top', 'B', 0),
        ('patterned-door', 'front', 'B', 1), ('patterned-door', 'q', 'B', 1), ('patterned-door', 'side', 'B', 1),
        ('casita-terrace-wall', 'side', 'B', 2)]
NOTES = [
    'World B ch.2 placements (scripts/levels/family/b2.ts); every origin sits on the ground plane, 1.4 m below the path:',
    'flower-planter   ×2: sixteen beds along the garden path; ×1.5: four at the veranda and balcony.',
    '      At ×2 its top 0.4 m clears the path deck, so the flowers seen from above carry it.',
    'casita-terrace-wall   ×1.1–1.6: nine walls along block faces, below the deck tops, set in pairs',
    '      almost end to end (0.04–0.94 m apart; the veranda door stands in the widest gap).',
    'patterned-door   ×1.2–1.4: four doors on camera-facing block faces, 0.05 m off the face.',
    'butterfly-arch   ×1.4 at the gate, ×1.8 on the golden route (turned 90°), ×3.4 behind the finish.',
    '      Backdrop only: arches never straddle a lane.',
    'Side views show the prop\'s left side with its front to the right; from above, the front is at the bottom.',
    'Front = glTF +Z, toward the player at rotation 0 (Blender −Y); origin at the floor centre.',
]

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
    return [o for o in bpy.data.collections['CK ' + prop].objects]

def view_matrix(view):
    if view == 'q': return Matrix.Rotation(Q, 4, 'Z')
    if view == 'side': return Matrix.Rotation(math.pi / 2, 4, 'Z')
    if view == 'top': return Matrix.Rotation(math.pi / 2, 4, 'X')
    return Matrix.Identity(4)

def extents(prop, view):
    dg = bpy.context.evaluated_depsgraph_get(); rot = view_matrix(view); xs = []; zs = []
    for ob in prop_objects(prop):
        if ob.type not in ('MESH', 'CURVE'): continue
        ev = ob.evaluated_get(dg); me = ev.to_mesh(); mw = rot @ ev.matrix_world
        for v in me.vertices:
            w = mw @ v.co; xs.append(w.x); zs.append(w.z)
        ev.to_mesh_clear()
    return min(xs), max(xs), min(zs), max(zs)

def box_half_width(prop, view):
    hx, hh, hz = REGISTRY[prop]
    return {'front': hx, 'top': hx, 'side': hz, 'q': hx * math.cos(Q) + hz * math.sin(Q)}[view]

def place(figs, decals, prop, view, cx, cz):
    root = put(figs, f'View root {view} {prop}', None); root.location = (cx, 0, cz)
    root.rotation_euler = view_matrix(view).to_euler()
    for ob in prop_objects(prop):
        cp = ob.copy(); cp.name = ob.name + f' | {view}'; cp.parent = root; cp.matrix_parent_inverse = Matrix.Identity(4)
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

def dashed_rect(dress, name, x0, x1, z0, z1, m):
    for zz in (z0, z1): dashed_h(dress, f'{name} h {zz:.2f}', x0, x1, zz, 0.014, 5.2, m, 0.08, 0.14)
    for xx in (x0, x1): dashed_v(dress, f'{name} v {xx:.2f}', xx, z0, z1, 0.014, 5.2, m, 0.08, 0.14)

def fmt3(size):
    return ' × '.join(f'{v:.2f}' for v in size) + ' m'

def main():
    sc = bpy.context.scene
    assert sc.get('asset_id') == 'casita-kit' and sc.get('scene_lease') == 'active'
    blk = json.loads(sc['blockout_bounds_m'])
    figs = coll(SHEET); dress = coll(DRESS); decals = coll(DECALS)
    bpy.data.collections[MASTER].hide_render = True

    # --- figure widths ---------------------------------------------------------------------------------------------------
    F = []
    for prop, view, row, grp in FIGS:
        x0, x1, z0, z1 = extents(prop, view); bw = box_half_width(prop, view)
        F.append(dict(prop=prop, view=view, row=row, grp=grp, x0=x0, x1=x1, top=z1, width=max(x1 - x0, 2 * bw, 2 * max(-x0, x1))))
    GA = 3.25; TOP_A = 3.5; TOP_B = 2.5; Z_LO = -0.92
    H = (GA + TOP_A + 0.12 - Z_LO) / (1 - 0.19); W = 2 * H; HS = H / 5.0
    RZ = 1.05; RIGHT = 0.30; GI = 0.30
    left = 0.0; right = left + W; top = Z_LO + H; ruler_x = left + RZ - 0.26
    rowA = [f for f in F if f['row'] == 'A']
    gb = (W - RZ - RIGHT - sum(f['width'] for f in rowA) - GI * (len(rowA) - 2)) / 1
    assert gb > 0.4, gb
    x = left + RZ
    for i, f in enumerate(rowA):
        f['cx'] = x + f['width'] / 2; x += f['width'] + (GI if i + 1 < len(rowA) and rowA[i + 1]['grp'] == f['grp'] else gb)
    rowB = [f for f in F if f['row'] == 'B']; GB_B = 0.55
    x = left + RZ
    for i, f in enumerate(rowB):
        f['cx'] = x + f['width'] / 2; x += f['width'] + (GI if i + 1 < len(rowB) and rowB[i + 1]['grp'] == f['grp'] else GB_B)
    notes_x0 = x + 0.1; notes_w = right - RIGHT - notes_x0
    assert notes_w > 5.5, notes_w
    cx_cam = (left + right) / 2; cz = Z_LO + H / 2

    ink = emission('Sheet ink #342c46', '#342c46'); faint = emission('Sheet guide #d9c9ae', '#d9c9ae')
    parchment = emission('Sheet parchment #f5ebdc', '#f5ebdc'); base = emission('Sheet baseline #8f7f6c', '#8f7f6c')
    boxm = emission('Sheet registry box #c9953f', '#c9953f')
    plane(dress, 'Parchment backdrop', left - 1, right + 1, Z_LO - 1, top + 1, 6.0, parchment)

    for row, gz, rtop, figs_row in (('A', GA, TOP_A, rowA), ('B', 0.0, TOP_B, rowB)):
        fig_x1 = figs_row[-1]['cx'] + figs_row[-1]['width'] / 2 + 0.05
        plane(dress, f'Ground line {row}', ruler_x + 0.006, fig_x1, gz - 0.008, gz, 5.0, base)
        k = 0.5
        while k < rtop - 1e-6:
            dashed_h(dress, f'Guide {row} {k}', ruler_x + 0.08, fig_x1, gz + k, 0.005, 5.3, faint, 0.05, 0.09); k += 0.5
        plane(dress, f'Ruler bar {row}', ruler_x - 0.007, ruler_x + 0.007, gz, gz + rtop, 5.0, ink)
        for i in range(int(rtop * 10 + 1e-6) + 1):
            tz = i * 0.1; major = i % 5 == 0; w = 0.07 if major else 0.035
            plane(dress, f'Tick {row} {tz:.1f}', ruler_x, ruler_x + w, gz + tz - 0.0045, gz + tz + 0.0045, 5.0, ink)
            if major:
                text(dress, f'Tick label {row} {tz:.1f}', f'{tz:.1f} m', ruler_x - 0.05, gz + tz - 0.045, 0.115, ink, align='RIGHT')
        plane(dress, f'Ruler cap {row}', ruler_x - 0.05, ruler_x + 0.08, gz + rtop - 0.005, gz + rtop + 0.005, 5.0, ink)
        for f in figs_row:
            p = f['prop']; v = f['view']; hx, hh, hz = REGISTRY[p]; bw = box_half_width(p, v)
            if v == 'top':
                oz = gz + hz + 0.22
                place(figs, decals, p, v, f['cx'], oz)
                dashed_rect(dress, f'Box {p} {v}', f['cx'] - hx, f['cx'] + hx, oz - hz, oz + hz, boxm)
                f['origin'] = (f['cx'], oz)
            else:
                place(figs, decals, p, v, f['cx'], gz)
                dashed_rect(dress, f'Box {p} {v}', f['cx'] - bw, f['cx'] + bw, gz, gz + hh, boxm)
                f['origin'] = (f['cx'], gz)
            fit(text(dress, f'Caption {p} {v}', CAPTION[v], f['cx'], gz - 0.19, 0.095, ink), f['width'] + GI * 0.8)
        # group labels: prop id, then blockout and registry sizes (w x h x d)
        for g in sorted({f['grp'] for f in figs_row}):
            gf = [f for f in figs_row if f['grp'] == g]; p = gf[0]['prop']
            gx0 = gf[0]['cx'] - gf[0]['width'] / 2; gx1 = gf[-1]['cx'] + gf[-1]['width'] / 2; gcx = (gx0 + gx1) / 2
            hx, hh, hz = REGISTRY[p]; size = blk[p]['size']
            span = gx1 - gx0 + (0.3 if len(gf) > 1 else 0.9)
            fit(text(dress, f'Label {row} {p}', p, gcx, gz - 0.40, 0.155, ink), span)
            line = 'blockout ' + fmt3((size[0], size[2], size[1])) + '   ·   registry box ' + fmt3((2 * hx, hh, 2 * hz)) + '   (w × h × d)'
            if gf[0]['view'] == 'side':
                line = 'depth ' + f'{size[1]:.2f}' + ' of ' + f'{2 * hz:.2f} m'
            fit(text(dress, f'Sizes {row} {p}', line, gcx, gz - 0.56, 0.10, ink), span)

    # --- placement notes (row B, right) ----------------------------------------------------------------------------------
    nz = TOP_B - 0.05
    for i, ln in enumerate(NOTES):
        t = text(dress, f'Note {i}', ln, notes_x0, nz - 0.25 * i, 0.105, ink, align='LEFT'); fit(t, notes_w)

    # --- header: title, subtitles, palette -------------------------------------------------------------------------------
    title = text(dress, 'Title', TITLE, left + 0.10 * HS, top - 0.46 * HS, 0.235 * HS, ink, align='LEFT')
    text(dress, 'Subtitle', SUBTITLE, left + 0.10 * HS, top - 0.69 * HS, 0.12 * HS, ink, align='LEFT')
    sw = 0.26 * HS; sg = 0.05 * HS; px = right - 0.10 * HS - len(PALETTE) * (sw + sg) + sg; bd = 0.008 * HS
    fit(title, px - left - 0.40 * HS)
    fit(text(dress, 'Subtitle 2', SUBTITLE2, left + 0.10 * HS, top - 0.86 * HS, 0.085 * HS, ink, align='LEFT'), px - left - 0.30 * HS)
    for i, (nm, hx) in enumerate(PALETTE):
        xa = px + i * (sw + sg)
        plane(dress, f'Swatch border {nm}', xa - bd, xa + sw + bd, top - 0.52 * HS - bd, top - 0.26 * HS + bd, 5.1, ink)
        plane(dress, f'Swatch {nm}', xa, xa + sw, top - 0.52 * HS, top - 0.26 * HS, 5.0, emission(f'Swatch {nm} {hx}', hx))
        fit(text(dress, f'Swatch label {nm}', nm, xa + sw / 2, top - 0.66 * HS, 0.08 * HS, ink), sw + sg * 0.8)
        text(dress, f'Swatch hex {nm}', hx, xa + sw / 2, top - 0.77 * HS, 0.07 * HS, ink)
    fit(text(dress, 'Footer', FOOTER, cx_cam, Z_LO + 0.07 * HS, 0.085 * HS, ink), 0.94 * W)

    # --- camera, light, world, render ------------------------------------------------------------------------------------
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
    style.color = lin('#342c46')[:3]; style.thickness = 1.5 * PERCENT / 100
    ls.linestyle = style
    out = ROOT / OUT; r.filepath = str(out)
    t0 = datetime.datetime.now(datetime.timezone.utc)
    bpy.ops.render.render(write_still=True)
    secs = (datetime.datetime.now(datetime.timezone.utc) - t0).total_seconds()
    rec = {'image': str(out), 'sha256': hashlib.sha256(out.read_bytes()).hexdigest(), 'render_seconds': round(secs, 1),
           'resolution': [r.resolution_x * PERCENT // 100, r.resolution_y * PERCENT // 100], 'samples': SAMPLES,
           'ortho_width_m': round(W, 3), 'sheet_height_m': round(H, 3), 'pixels_per_metre_at_100': round(2048 / W, 1),
           'three_quarter_turn_deg': round(math.degrees(Q), 1), 'row_ground_z_m': {'A': GA, 'B': 0.0},
           'figures': [{'prop': f['prop'], 'view': f['view'], 'row': f['row'], 'center_x_m': round(f['cx'], 3), 'width_m': round(f['width'], 3),
                        'origin_m': [round(f['origin'][0], 3), round(f['origin'][1], 3)]} for f in F],
           'row_a_group_gap_m': round(gb, 3), 'notes_block_width_m': round(notes_w, 3),
           'blockout_sizes_m_w_h_d': {p: [blk[p]['size'][0], blk[p]['size'][2], blk[p]['size'][1]] for p in PROPS},
           'registry_sizes_m_w_h_d': {p: [2 * REGISTRY[p][0], REGISTRY[p][1], 2 * REGISTRY[p][2]] for p in PROPS}}
    if OUT == 'reference-sheet.png':
        (ROOT / 'sheet-render.json').write_text(json.dumps(rec) + '\n')
    print(json.dumps(rec)); return rec

if __name__ == '__main__':
    main()
