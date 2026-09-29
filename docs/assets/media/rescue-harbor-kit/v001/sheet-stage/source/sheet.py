"""WO111 rescue-harbor-kit v001: one parchment kit reference sheet from the painted blockout (run after build_blockout.py).

Adapted from the playroom-kit v001 sheet script (itself from the lab-robot / radio-host-showman / putty-grunt lineage).
The harbor kit spans a 7 m tower and a 0.8 m bollard, so at one orthographic scale the sheet is laid out in two blocks:
  left  - the lookout tower, front and three-quarter (turned 40 deg), on one ground line with a 0-7 m ruler;
  right - the pier bollard, rescue buoy stand and small boat in a FRONT row above a THREE-QUARTER row (each row with its
          own 0-2 m ruler), plus the small boat seen from directly above (the in-game chase camera sees moored boats
          from overhead), and a placement legend from scripts/levels/family/a2.ts.
Every figure is a linked-data copy of the master at the same orthographic scale. Registry boxes are dashed. Parchment
#f5ebdc (Standard view transform so it renders exactly), plum-ink Freestyle outlines on the figures only, a palette row
and the title line "Blender reference sheet, no generated concept". SHEET_PERCENT (module global): 100 -> 2048x1024.
"""
import bpy, math, json, hashlib, datetime
from mathutils import Vector, Matrix
from pathlib import Path

ROOT = Path('/workspace/haynes-quest/family-eras/rescue-harbor-kit/v001')
MASTER = 'Rescue harbor kit blockout (master)'
DECALS = 'Reference sheet (painted details, no ink)'
SHEET = 'Reference sheet (figures)'
DRESS = 'Reference sheet (parchment, guides, labels)'
PERCENT = globals().get('SHEET_PERCENT', 100)
SAMPLES = globals().get('SHEET_SAMPLES', 48)
OUT = globals().get('SHEET_OUT', 'reference-sheet.png')
Q_ANGLE = math.radians(40)
TOWER = 'lookout-tower-facade'
SMALL = ['pier-bollard', 'rescue-buoy-stand', 'small-boat']
PROPS = [TOWER] + SMALL
REGISTRY = {'lookout-tower-facade': (1.8, 7.0, 1.8), 'pier-bollard': (0.3, 0.8, 0.3),
            'rescue-buoy-stand': (0.6, 1.8, 0.25), 'small-boat': (1.2, 1.1, 2.6)}
PALETTE = [('cream', '#f2efe6'), ('red', '#d64533'), ('yellow', '#f7c948'), ('coral', '#f08a5d'), ('driftwood', '#d9c3a0'),
           ('wood', '#a8835b'), ('wet wood', '#6e5238'), ('rope', '#dcc18c'), ('aqua', '#8fd6e6'), ('sea', '#2f7fb8'),
           ('navy', '#2e4a62'), ('stone', '#8c979f')]
TITLE = 'RESCUE HARBOR KIT  ·  rescue-harbor-kit v001'
SUBTITLE = 'Blender reference sheet, no generated concept'
SUBTITLE2 = ('WO111 World A ch.2 harbor theme  ·  four static props, front and three-quarter (turned 40°) at one orthographic scale, '
             'plus the boat from above  ·  dashed: theme-kit registry boxes  ·  painted blockout, not final topology')
FOOTER = ('Original seaside rescue-town props for a rescue-pup harbor: a timber lookout with a doghouse-arch door and a blank bone sign, '
          'a piling with an iron mooring bollard, a life-ring stand and a rescue rowboat. No copied characters, logos, lettering or show designs.')
LEGEND = [
    'World A ch.2 placements (a2.ts); every origin sits on the water plane:',
    'pier-bollard  ×1.1 dock pilings, ×2 pier and market pilings',
    'rescue-buoy-stand  ×1.6, turned ±90° at the dock and beach corners',
    'small-boat  ×0.8, twelve moored boats at any heading',
    'lookout-tower-facade  ×1.5 rescue HQ at spawn, ×3 far lookout',
    'front = glTF +Z, toward the player at rotation 0 (Blender −Y)',
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
    return [o for o in bpy.data.collections['RH ' + prop].objects]

def place(figs, decals, prop, label, M):
    root = put(figs, f'View root {label} {prop}', None); root.matrix_world = M
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

def dashed_rect(dress, name, x0, x1, z0, z1, m):
    for zz in (z0, z1): dashed_h(dress, f'{name} h {zz:.2f}', x0, x1, zz, 0.016, 5.2, m, 0.09, 0.16)
    for xx in (x0, x1): dashed_v(dress, f'{name} v {xx:.2f}', xx, z0, z1, 0.016, 5.2, m, 0.09, 0.16)

def fmt3(size):
    return ' × '.join(f'{v:.2f}' for v in size) + ' m'

def qwidth(p):
    hx, _, hz = REGISTRY[p]; return 2 * (hx * math.cos(Q_ANGLE) + hz * math.sin(Q_ANGLE))

def ruler(dress, name, x, gz, top, ink, label_every, tick_t):
    plane(dress, f'Ruler bar {name}', x - 0.008, x + 0.008, gz, gz + top, 5.0, ink)
    for i in range(int(round(top * 10)) + 1):
        tz = i * 0.1; major = i % 5 == 0; w = 0.085 if major else 0.042
        plane(dress, f'Tick {name} {tz:.1f}', x, x + w, gz + tz - 0.0055, gz + tz + 0.0055, 5.0, ink)
        if abs(tz / label_every - round(tz / label_every)) < 1e-6:
            text(dress, f'Tick label {name} {tz:.1f}', f'{tz:.1f} m', x - 0.06, gz + tz - 0.055, tick_t, ink, align='RIGHT')
    plane(dress, f'Ruler cap {name}', x - 0.06, x + 0.095, gz + top - 0.006, gz + top + 0.006, 5.0, ink)

def main():
    sc = bpy.context.scene
    assert sc.get('asset_id') == 'rescue-harbor-kit' and sc.get('scene_lease') == 'active'
    blk = json.loads(sc['blockout_bounds_m'])
    figs = coll(SHEET); dress = coll(DRESS); decals = coll(DECALS)
    bpy.data.collections[MASTER].hide_render = True

    # --- horizontal layout ------------------------------------------------------------------------------------------------
    LABEL = 0.22; SIZE_T = 0.15; TICK_T = 0.16
    RZ_L = 1.25; TF_W = 3.9; TQ_W = qwidth(TOWER); GAP_T = 0.35; GAP_AB = 0.45; RZ_R = 1.1; GAP_R = 0.25; RIGHT = 0.25
    col_w = {'pier-bollard': 2.1, 'rescue-buoy-stand': 2.1, 'small-boat': max(qwidth('small-boat'), 2 * REGISTRY['small-boat'][2]) + 0.02}
    W = RZ_L + TF_W + GAP_T + TQ_W + GAP_AB + RZ_R + sum(col_w.values()) + 2 * GAP_R + RIGHT
    H = W / 2; HS = H / 5; Z_LO = -1.35; top = Z_LO + H; header_bottom = top - 0.19 * H
    G1 = 5.55; PLAN_ZC = 3.25; SMALL_TOP = 2.0; TOWER_TOP = 7.0
    assert G1 + SMALL_TOP + 0.08 < header_bottom, (G1, header_bottom)
    left = 0.0; right = left + W
    ruler_l = left + RZ_L - 0.32
    x = left + RZ_L; tf_cx = x + TF_W / 2; x += TF_W + GAP_T; tq_cx = x + TQ_W / 2; x += TQ_W + GAP_AB
    block_b = x; ruler_r = x + RZ_R - 0.32; x += RZ_R; cx = {}
    for p in SMALL:
        cx[p] = x + col_w[p] / 2; x += col_w[p] + GAP_R
    fig_x1 = cx['small-boat'] + col_w['small-boat'] / 2 + 0.05
    cx_cam = (left + right) / 2; cz = Z_LO + H / 2

    ink = emission('Sheet ink #342c46', '#342c46'); faint = emission('Sheet guide #d9c9ae', '#d9c9ae')
    parchment = emission('Sheet parchment #f5ebdc', '#f5ebdc'); base = emission('Sheet baseline #8f7f6c', '#8f7f6c')
    boxm = emission('Sheet registry box #c9953f', '#c9953f')
    plane(dress, 'Parchment backdrop', left - 1, right + 1, Z_LO - 1, top + 1, 6.0, parchment)

    # --- ground lines, guides and rulers -------------------------------------------------------------------------------
    plane(dress, 'Ground line shared', ruler_l + 0.008, fig_x1, -0.009, 0.0, 5.0, base)
    plane(dress, 'Ground line small FRONT', ruler_r + 0.008, fig_x1, G1 - 0.009, G1, 5.0, base)
    for gz in [0.5 * i for i in range(1, 15)]:
        dashed_h(dress, f'Guide tower {gz}', ruler_l + 0.1, block_b - 0.15, gz, 0.006, 5.3, faint, 0.06, 0.11)
    for gz in (0.5, 1.0, 1.5, 2.0):
        dashed_h(dress, f'Guide small 3q {gz}', ruler_r + 0.1, fig_x1, gz, 0.006, 5.3, faint, 0.06, 0.11)
        dashed_h(dress, f'Guide small front {gz}', ruler_r + 0.1, fig_x1, G1 + gz, 0.006, 5.3, faint, 0.06, 0.11)
    ruler(dress, 'tower', ruler_l, 0.0, TOWER_TOP, ink, 1.0, TICK_T)
    ruler(dress, 'small 3q', ruler_r, 0.0, SMALL_TOP, ink, 0.5, TICK_T)
    ruler(dress, 'small front', ruler_r, G1, SMALL_TOP, ink, 0.5, TICK_T)
    for label, gz in (('FRONT', G1), ('THREE-QUARTER', 0.0)):
        t = text(dress, f'Row title {label}', label, block_b + 0.12, gz + SMALL_TOP / 2, 0.19, ink, rot_y=-math.pi / 2)
        t.data.align_y = 'CENTER'

    # --- figures, registry boxes and labels ----------------------------------------------------------------------------
    roots = {}
    def upright(p, label, fx, gz, ang):
        roots[(label, p)] = place(figs, decals, p, label, Matrix.Translation((fx, 0, gz)) @ Matrix.Rotation(ang, 4, 'Z'))
    hx, hh, hz = REGISTRY[TOWER]
    upright(TOWER, 'FRONT', tf_cx, 0.0, 0.0); upright(TOWER, 'THREE-QUARTER', tq_cx, 0.0, Q_ANGLE)
    dashed_rect(dress, f'Box {TOWER} front', tf_cx - hx, tf_cx + hx, 0.0, hh, boxm)
    q = qwidth(TOWER) / 2; dashed_rect(dress, f'Box {TOWER} q', tq_cx - q, tq_cx + q, 0.0, hh, boxm)
    size = blk[TOWER]['size']
    text(dress, f'Label {TOWER} front', TOWER, tf_cx, -0.30, LABEL, ink)
    fit(text(dress, f'Size {TOWER} blockout', 'front  ·  blockout ' + fmt3((size[0], size[2], size[1])), tf_cx, -0.53, SIZE_T, ink), TF_W)
    fit(text(dress, f'Size {TOWER} registry', 'registry box ' + fmt3((2 * hx, hh, 2 * hz)) + '  (w × h × d)', tf_cx, -0.74, SIZE_T, ink), TF_W)
    text(dress, f'Label {TOWER} three-quarter', TOWER, tq_cx, -0.30, LABEL, ink)
    text(dress, f'Caption {TOWER} three-quarter', 'three-quarter, turned 40°', tq_cx, -0.53, SIZE_T, ink)
    for p in SMALL:
        hx, hh, hz = REGISTRY[p]; size = blk[p]['size']; w = col_w[p] - 0.1
        upright(p, 'FRONT', cx[p], G1, 0.0); upright(p, 'THREE-QUARTER', cx[p], 0.0, Q_ANGLE)
        dashed_rect(dress, f'Box {p} front', cx[p] - hx, cx[p] + hx, G1, G1 + hh, boxm)
        q = qwidth(p) / 2; dashed_rect(dress, f'Box {p} q', cx[p] - q, cx[p] + q, 0.0, hh, boxm)
        fit(text(dress, f'Label {p} front', p, cx[p], G1 - 0.30, LABEL, ink), w)
        fit(text(dress, f'Size {p} blockout', 'blockout ' + fmt3((size[0], size[2], size[1])), cx[p], G1 - 0.53, SIZE_T, ink), w)
        fit(text(dress, f'Size {p} registry', 'registry ' + fmt3((2 * hx, hh, 2 * hz)), cx[p], G1 - 0.74, SIZE_T, ink), w)
        fit(text(dress, f'Label {p} three-quarter', p, cx[p], -0.30, LABEL, ink), w)
    # the small boat from directly above: its top faces the camera, bow to the right
    bx = cx['small-boat']
    Mplan = Matrix.Translation((bx, 0, PLAN_ZC)) @ Matrix.Rotation(math.pi / 2, 4, 'X') @ Matrix.Rotation(math.pi / 2, 4, 'Z')
    roots[('PLAN', 'small-boat')] = place(figs, decals, 'small-boat', 'PLAN', Mplan)
    hx, hh, hz = REGISTRY['small-boat']
    dashed_rect(dress, 'Box small-boat plan', bx - hz, bx + hz, PLAN_ZC - hx, PLAN_ZC + hx, boxm)
    text(dress, 'Label small-boat plan', 'small-boat  ·  from above, bow to the right', bx, PLAN_ZC - hx - 0.34, SIZE_T * 1.2, ink)
    # placement legend in the bollard and buoy-stand columns
    lx = cx['pier-bollard'] - col_w['pier-bollard'] / 2 + 0.05; lw = col_w['pier-bollard'] + GAP_R + col_w['rescue-buoy-stand'] - 0.1
    for i, line in enumerate(LEGEND):
        fit(text(dress, f'Legend {i}', line, lx, 4.25 - 0.30 * i, SIZE_T * (1.05 if i == 0 else 1.0), ink, align='LEFT'), lw)

    # --- header: title, subtitles, palette -----------------------------------------------------------------------------
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
        text(dress, f'Swatch hex {nm}', hx, xa + sw / 2, top - 0.77 * HS, 0.066 * HS, ink)
    fit(text(dress, 'Footer', FOOTER, cx_cam, Z_LO + 0.07 * HS, 0.08 * HS, ink), 0.95 * W)

    # --- camera, light, world, render ----------------------------------------------------------------------------------
    cam_data = bpy.data.cameras.new('Sheet ortho camera'); cam_data.type = 'ORTHO'; cam_data.ortho_scale = W
    cam_data.clip_start = 0.1; cam_data.clip_end = 60
    cam = put(dress, 'Sheet ortho camera', cam_data); cam.location = (cx_cam, -20, cz); cam.rotation_euler = (math.pi / 2, 0, 0)
    sc.camera = cam
    sun_d = bpy.data.lights.new('Warm seaside key', 'SUN'); sun_d.energy = 2.3; sun_d.angle = math.radians(12); sun_d.color = (1.0, 0.95, 0.86)
    sun = put(dress, 'Warm seaside key', sun_d)
    sun.rotation_euler = Vector((0.45, 0.8, -0.55)).normalized().to_track_quat('-Z', 'Y').to_euler()
    fill_d = bpy.data.lights.new('Cool sea fill', 'SUN'); fill_d.energy = 0.5; fill_d.angle = math.radians(30); fill_d.color = (0.80, 0.88, 1.0)
    fill = put(dress, 'Cool sea fill', fill_d)
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
           'three_quarter_turn_deg': round(math.degrees(Q_ANGLE), 1),
           'layout': {'tower_ground_z_m': 0.0, 'small_front_ground_z_m': G1, 'small_three_quarter_ground_z_m': 0.0,
                      'boat_plan_centre_z_m': PLAN_ZC, 'tower_front_x_m': round(tf_cx, 3), 'tower_three_quarter_x_m': round(tq_cx, 3),
                      'small_column_x_m': {p: round(cx[p], 3) for p in SMALL}, 'small_column_width_m': {p: round(col_w[p], 3) for p in SMALL}},
           'view_roots': sorted(f'{a} {b}' for a, b in roots),
           'blockout_sizes_m_w_h_d': {p: [blk[p]['size'][0], blk[p]['size'][2], blk[p]['size'][1]] for p in PROPS},
           'registry_sizes_m_w_h_d': {p: [2 * REGISTRY[p][0], REGISTRY[p][1], 2 * REGISTRY[p][2]] for p in PROPS}}
    if OUT == 'reference-sheet.png':
        (ROOT / 'sheet-render.json').write_text(json.dumps(rec) + '\n')
    print(json.dumps(rec)); return rec

if __name__ == '__main__':
    main()
