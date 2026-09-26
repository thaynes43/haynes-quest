"""WO111 magic-house v001: final model from the coordinator-approved Blender reference sheet.

Source: "Blender reference sheet, no generated concept" (reference-sheet.png + magic-house-blockout.blend,
approved by the PLAN-019 coordinator on Sept 26). This script refines the ~45k-triangle blockout into a
budgeted, rig-friendly model with the SAME proportions, colours and parody hooks:
  * the ~180 static barrel tiles become two low-relief corrugated roof sheets whose tile rows, shading and
    empty dancing-tile slots are painted into one 1024 atlas; the six dancing tiles stay real geometry;
  * shutter louvres, door flowers/panel lines and the doormat stripes are painted, not modelled;
  * flowers become low-poly clumps; the candle flame and glow use the second (emissive) material.
Blender +Z up, the house faces +Y (exports as glTF +Y up / -Z forward), house right = +X, floor-centred.
"""
import bpy, math, json, hashlib, importlib.util, struct, zlib, datetime
from pathlib import Path
from mathutils import Vector, Matrix, Euler
import numpy as np

ROOT = Path('/workspace/haynes-quest/family-eras/magic-house/v001')
OWNER = 'claude-opus-5-5 magic-house model subagent (session_016rSS1uA4XaroamTk1brNXn) on blender-authoring-2'
sc = bpy.context.scene
assert sc.get('work_order') == 'WO111' and sc.get('scene_lease') == 'active' and sc.get('asset_id') == 'magic-house' and sc.get('scene_owner') == OWNER
spec = importlib.util.spec_from_file_location('wo111_magic_house_common', ROOT / 'source/common.py')
C = importlib.util.module_from_spec(spec); spec.loader.exec_module(C)

# ------------------------------------------------------------------ palette (sheet hexes) + atlas
BASE = ['f1c28c', '3f7f7a', 'c4643f', '9a4a32', 'c2583a', 'a8472f', 'cf6c45', '963f2b', '7a4a2e', 'dca953', 'e07a5f', '4e8ab8',
        '3d6f99', 'e3a33f', '3a2842', 'c9506a', 'fbf6ec', '342c46', 'd24f86', 'ee8fb0', 'f2cf5b', '557363', '6f9a5e', 'f3e6cf',
        'ffcf6b', 'f6c768', '4a2c1c', 'e0823a', '8a3b28', 'd9a878', '2a1d30', '2f625e']
K = {n: i for i, n in enumerate(['stucco', 'zocalo', 'trim', 'floor', 'tile_a', 'tile_b', 'tile_c', 'ridge', 'wood', 'honey', 'coral', 'sky',
                                 'sky_dark', 'door', 'mouth', 'mat', 'white', 'ink', 'magenta', 'pink', 'yellow', 'leaf', 'leaf_light', 'cream',
                                 'flame', 'glow', 'deck_shadow', 'ember', 'tile_under', 'soffit', 'plum_deep', 'teal_dark'])}
LEVELS = [.70, .80, .88, .94, 1.0, 1.05, 1.10, 1.16]  # level 4 is the exact sheet colour

# Roof layout, identical to the blockout.
RIDGE = Vector((0.0, 0.0, 2.52)); WALL_TOP = 1.80; HALF = 0.90
TH = math.atan2(RIDGE.z - WALL_TOP, HALF); CT, ST = math.cos(TH), math.sin(TH)
SLAB = 0.07; S_END = 1.47; Y_HALF = 0.86
TILE_L = 0.25; TILE_STEP = 0.20; ROWS = 7; COLS = 13; COL0 = -0.80; COL_STEP = 0.1333
DANCERS = [('R', 1, 10, 0.27, (0.55, -0.40, 0.30), 'honey'), ('L', 2, 11, 0.30, (-0.60, 0.45, -0.50), 'coral'),
           ('R', 3, 5, 0.24, (0.30, 0.65, 0.90), 'zocalo'), ('L', 0, 4, 0.33, (0.90, -0.25, 0.40), 'sky'),
           ('R', 0, 2, 0.30, (-0.45, -0.55, -0.70), 'tile_c')]
# Author correction: the sky tile hovers 0.22 m clear of the chimney hat it touched in the blockout, so its bob,
# jump and spin never pass through the chimney. Its empty slot and colour are unchanged.
NUDGE = {3: Vector((0.16, 0.14, 0.06))}
HOP_CAP = 6
GAPS = {'R': {(r, c) for s, r, c, *_ in DANCERS if s == 'R'}, 'L': {(r, c) for s, r, c, *_ in DANCERS if s == 'L'} | {(2, 4), (3, 4)}}
Y_EDGE = COL_STEP * 6.5  # 0.8667: outer edge of the outermost tile columns
S0 = -0.035; S_SPAN = S_END - S0

def tile_row_col(s, y):
    j = np.clip(np.round((y - COL0) / COL_STEP), 0, COLS - 1).astype(int)
    f = (y - (COL0 + COL_STEP * j)) / COL_STEP
    i = np.where(s < 0.31, 0, np.clip(np.floor((s - 0.11) / TILE_STEP), 0, ROWS - 1)).astype(int)
    t = (s - (0.06 + TILE_STEP * i)) / TILE_L
    return i, j, f, t

def paint_atlas():
    S = 1024; idx = np.zeros((S, S), dtype=np.uint8)  # [v_px from bottom, u_px]
    # Swatches: soft painterly field, levels 3..5 around the exact colour.
    yy, xx = np.mgrid[0:128, 0:128]
    for c in range(32):
        field = .55 * np.sin(xx * .045 + yy * .028 + c) + .35 * np.cos(xx * .09 - yy * .061 + 2 * c)
        lvl = np.clip(4 + np.round(field * .95), 3, 5).astype(np.uint8)
        col, row = c % 8, c // 8; v1 = S - row * 128
        idx[v1 - 128:v1, col * 128:(col + 1) * 128] = c * 8 + lvl
    # Roof sheets: painted barrel rows with crest light, dark channels, lip shadows and empty slots.
    vv, uu = np.mgrid[0:256, 0:512]
    a = (uu + .5) / 512; b = (vv + .5) / 256
    y = a * 2 * Y_EDGE - Y_EDGE; s = (1 - b) * S_SPAN + S0
    i, j, f, t = tile_row_col(s, y)
    mi = np.where((i * 7 + j * 3) % 5 == 0, 1, np.where((i * 5 + j * 2) % 7 == 0, 2, 0))
    basec = np.choose(mi, [K['tile_a'], K['tile_b'], K['tile_c']])
    r = 0.052 + 0.010 * np.clip(t, 0, 1); x = np.abs(f) * COL_STEP
    hump = np.sqrt(np.clip(1 - (x / r) ** 2, 0, 1))
    lvl = 1 + np.round(3.5 * hump ** .6) + np.round(.9 * (-f / .5) * hump)
    lvl = np.where(x >= r, np.where(x > r + .006, 0, 1), lvl)
    shadow = (i >= 1) & (t < 0.30); lvl = np.where(shadow, lvl - np.round(2.4 * (1 - (t - .2) / .1).clip(0, 1)), lvl)
    lvl = np.where(t > .95, lvl - 2, lvl)  # dark tile-end line, read as the sheet's tile outlines
    for side, region_rows in (('L', (256, 512)), ('R', (0, 256))):
        base_s, lvl_s = basec.copy(), lvl.copy()
        gap = np.zeros_like(base_s, dtype=bool)
        for (gi, gj) in GAPS[side]: gap |= (i == gi) & (j == gj)
        edge = gap & ((np.abs(f) > .40) | (t < .27) | (t > .95))
        base_s = np.where(gap, np.where(edge, K['deck_shadow'], K['wood']), base_s)
        lvl_s = np.where(gap, np.where(edge, 4, 3 + ((uu // 6) % 2)), lvl_s)
        idx[region_rows[0]:region_rows[1], 0:512] = (base_s * 8 + np.clip(lvl_s, 0, 7)).astype(np.uint8)
    # Louvres (shutter lids, side shutters, closed shutters): 0.52 m tall region, slat pitch 32 px.
    vv, uu = np.mgrid[0:256, 0:256]; p = vv % 32
    base_l = np.where(p < 6, K['sky_dark'], K['sky']); lvl_l = np.select([p >= 26, p >= 14, p >= 6, p >= 2], [6, 5, 4, 3], 0)
    stile = (uu < 14) | (uu >= 242) | (vv < 12); inner = ((uu >= 14) & (uu < 17)) | ((uu >= 239) & (uu < 242)) | ((vv >= 12) & (vv < 15))
    base_l = np.where(stile, K['sky'], np.where(inner, K['sky_dark'], base_l)); lvl_l = np.where(stile, 5, np.where(inner, 2, lvl_l))
    idx[256:512, 512:768] = (base_l * 8 + lvl_l).astype(np.uint8)
    # Door leaf: honey planks, a coral five-petal flower with a cream centre and a terracotta panel line.
    um = (uu + .5) / 640; zm = .50 + (vv + .5) / 512
    base_d = np.full(uu.shape, K['door']); lvl_d = np.clip(4 + np.round(.7 * np.sin(uu * .21 + 2.5 * np.sin(vv * .031))), 3, 5)
    seam = (um % .089) < .004; lvl_d = np.where(seam, 1, lvl_d)
    for k in range(5):
        ang = math.tau * k / 5 + .3; d = np.hypot(um - (.20 + .045 * math.cos(ang)), zm - (.765 + .045 * math.sin(ang)))
        base_d = np.where(d < .024, K['coral'], base_d); lvl_d = np.where(d < .024, np.where(d > .019, 2, 4), lvl_d)
    d = np.hypot(um - .20, zm - .765); base_d = np.where(d < .026, K['cream'], base_d); lvl_d = np.where(d < .026, np.where(d > .021, 2, 4), lvl_d)
    line = (np.abs(um - .22) < .09) & (np.abs(zm - .625) < .008); base_d = np.where(line, K['trim'], base_d); lvl_d = np.where(line, 3, lvl_d)
    idx[256:512, 768:1024] = (base_d * 8 + lvl_d).astype(np.uint8)
    # Doormat tongue: lengthwise raspberry/honey stripes (blockout rule: fract(11x+0.35) < 0.72) with a weave.
    xm = (uu + .5) / 256 * .4 - .2; fr = (xm * 11 + .35) % 1.0
    base_m = np.where(fr < .72, K['mat'], K['honey']); edge = (np.abs(fr - .72) < .012) | (fr < .012) | (fr > .988)
    lvl_m = np.where(edge, 3, 4 + ((uu // 4 + vv // 4) % 2))
    idx[0:256, 512:768] = (base_m * 8 + lvl_m).astype(np.uint8)
    idx[0:256, 768:1024] = K['stucco'] * 8 + 4
    palette = []
    for h in BASE:
        rgb = np.array([int(h[k:k + 2], 16) / 255 for k in (0, 2, 4)])
        for m in LEVELS: palette.extend(np.round(np.clip(rgb * m, 0, 1) * 255).astype(np.uint8).tolist())
    def chunk(name, data): return struct.pack('>I', len(data)) + name + data + struct.pack('>I', zlib.crc32(name + data) & 0xffffffff)
    raw = b''.join(b'\x00' + row.tobytes() for row in idx[::-1])
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', S, S, 8, 3, 0, 0, 0)) + chunk(b'PLTE', bytes(palette)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    (ROOT / 'pigment.png').write_bytes(png)

paint_atlas()
C.setup(ROOT / 'pigment.png', [('Matte painted stucco, tile, timber and cloth', .86, False), ('Warm candle flame and glow', .55, 0.25)])
for key in list(sc.keys()):
    if not (key.startswith('blendermcp_') or key in ('cycles', 'work_order', 'scene_owner', 'scene_lease', 'asset_id', 'asset_version', 'authoring_model', 'source_reference')): del sc[key]
sc['work_order'] = 'WO111'; sc['scene_lease'] = 'active'; sc['scene_owner'] = OWNER; sc['asset_id'] = 'magic-house'; sc['asset_version'] = 'v001'
sc['candidate_status'] = "WO111 magic-house v001 · Awaiting Tom's review · used in the family release"
sc['authoring_model'] = 'claude-opus-5-5 xhigh'; sc['source_reference'] = 'Blender reference sheet, no generated concept'
sc['source_sheet_sha256'] = hashlib.sha256((ROOT / 'reference-sheet.png').read_bytes()).hexdigest()
sc['source_blockout_sha256'] = hashlib.sha256((ROOT / 'magic-house-blockout.blend').read_bytes()).hexdigest()
sc['orientation'] = 'Blender +Z up/+Y forward; glTF +Y up/-Z forward; stationary identity floor root; house right = +X'

# ------------------------------------------------------------------ shared blockout geometry
def interp(table, z, col):
    if z <= table[0][0]: return table[0][col]
    for a, b in zip(table, table[1:]):
        if a[0] <= z <= b[0]: return a[col] + (b[col] - a[col]) * (z - a[0]) / (b[0] - a[0])
    return table[-1][col]
WALL = [(0.50, 0.92, 0.690, 0.10), (0.58, 0.94, 0.705, 0.11), (0.80, 0.935, 0.700, 0.11), (1.20, 0.920, 0.690, 0.10),
        (1.55, 0.905, 0.676, 0.10), (1.80, 0.900, 0.670, 0.10)]
ZOC_TOP = 0.80; ZOC_OFF = 0.012
def face_y(z): return interp(WALL, z, 2) + (ZOC_OFF if z <= ZOC_TOP else 0.0)
def side_x(z): return interp(WALL, z, 1) + (ZOC_OFF if z <= ZOC_TOP else 0.0)
def rrect(hw, hd, r, n):
    pts = []
    for (sx, sy), a0 in (((1, 1), 0), ((-1, 1), 90), ((-1, -1), 180), ((1, -1), 270)):
        cx, cy = sx * (hw - r), sy * (hd - r)
        for k in range(n + 1): a = math.radians(a0 + 90 * k / n); pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts
def arch(cx, z0, hw, spring, n=12):
    return [(cx - hw, z0), (cx + hw, z0)] + [(cx + hw * math.cos(math.pi * k / n), spring + hw * math.sin(math.pi * k / n)) for k in range(n + 1)]
def arch_path(cx, z0, hw, spring, n=12):
    return [(cx + hw, z0), (cx + hw, spring)] + [(cx + hw * math.cos(math.pi * k / n), spring + hw * math.sin(math.pi * k / n)) for k in range(1, n)] + [(cx - hw, spring), (cx - hw, z0)]
EYE_HW = 0.245; EYE_Z0 = 1.17; EYE_SPRING = 1.505; EYE_TOP = EYE_SPRING + EYE_HW
def lid_outline(z_lid, n=10):
    if z_lid < EYE_SPRING: pts = [(-EYE_HW, z_lid), (EYE_HW, z_lid)]; a0 = 0.0
    else: a0 = math.asin((z_lid - EYE_SPRING) / EYE_HW); pts = []
    for k in range(n + 1):
        a = a0 + (math.pi - 2 * a0) * k / n; pts.append((EYE_HW * math.cos(a), EYE_SPRING + EYE_HW * math.sin(a)))
    return pts
MW = 0.36; M_TOP_C, M_TOP_R = 0.282, 0.698; M_BOT_C, M_BOT_R = 0.891, 0.371
def mouth_top(x, grow=0.0): return M_TOP_C + math.sqrt(max(0.0, (M_TOP_R + grow) ** 2 - x * x))
def mouth_bot(x, grow=0.0): return M_BOT_C - math.sqrt(max(0.0, (M_BOT_R + grow) ** 2 - x * x))
def mouth_outline(grow=0.0, n=12):
    w = MW + grow
    top = [(w * math.cos(math.pi * k / n), 0) for k in range(n + 1)]; top = [(x, mouth_top(x, grow)) for x, _ in top]
    bot = [(-w * math.cos(math.pi * k / n), 0) for k in range(n + 1)]
    return top + [(x, mouth_bot(x, grow)) for x, _ in bot]
def rot2(pts, pivot, th):
    c, s_ = math.cos(th), math.sin(th); px, pz = pivot
    return [(px + (h - px) * c - (v - pz) * s_, pz + (h - px) * s_ + (v - pz) * c) for h, v in pts]
def slope(side):
    sx = 1 if side == 'R' else -1
    return Vector((sx * CT, 0, -ST)), Vector((sx * ST, 0, CT)), Vector((0, sx, 0))

TILES = {}  # bone -> rest mesh frame, drop slot frame (armature rest space), rest hover height
LIDS = {}
REST = {'root': ((0, 0, 0), (0, 0, .10), None), 'body': ((0, 0, .40), (0, 0, 1.0), 'root'), 'roof': ((0, 0, 1.80), (0, 0, 2.30), 'body')}
def bone(name, head, tail, parent): REST[name] = (tuple(head), tuple(tail), parent)
cell = K

# ------------------------------------------------------------------ legs and floor slab
for side, sx in (('R', 1), ('L', -1)):
    leg = 'leg_' + side; x0 = 0.48 * sx
    bone(leg, (0.49 * sx, 0.06, 0.0), (0.49 * sx, 0.06, 0.20), 'root')
    rr = []
    for z in (0.11, 0.21, 0.31, 0.41):
        r = 0.128 + (0.118 - 0.128) * (z - 0.11) / 0.30
        rr.append([(x0 + r * math.cos(math.tau * i / 12), 0.02 + r * math.sin(math.tau * i / 12), z) for i in range(12)])
    def stump_w(p, leg=leg):
        t = C.smooth((p.z - 0.17) / 0.20); return {leg: 1 - t, 'body': t}
    C.rings('Timber stump leg ' + side, rr, cell['wood'], leg, caps=False, weights=stump_w)
    C.cylinder('Honey ankle band ' + side, (x0, 0.02, 0.155), 0.136, 0.134, 0.03, cell['honey'], leg, n=12)
    C.ellipsoid('Round teal clog ' + side, (0.50 * sx, 0.10, 0.085), (0.18, 0.27, 0.085), cell['zocalo'], leg, n=14, r=7)
levels = [(0.38, 0.90, 0.66, 0.12), (0.40, 0.98, 0.74, 0.14), (0.50, 0.98, 0.74, 0.14), (0.52, 0.96, 0.72, 0.13)]
C.rings('Deep terracotta floor slab', [[(x, y, z) for x, y in rrect(hw, hd, r, 4)] for z, hw, hd, r in levels], cell['floor'], 'body')

# ------------------------------------------------------------------ walls (zocalo band proud by 12 mm) and gable
wl = [(z, hw + ZOC_OFF, hd + ZOC_OFF, r + ZOC_OFF) for z, hw, hd, r in WALL if z <= ZOC_TOP] + [w for w in WALL if w[0] >= ZOC_TOP]
C.rings('Apricot stucco walls over a teal zocalo', [[(x, y, z) for x, y in rrect(hw, hd, r, 6)] for z, hw, hd, r in wl], cell['stucco'], 'body', caps=False,
        face_cell=lambda c, n: cell['zocalo'] if c.z < ZOC_TOP - 1e-4 or (abs(n.z) > .7 and c.z < ZOC_TOP + .01) else None)
C.panel('Stucco front-to-back gable', [(-HALF, WALL_TOP), (HALF, WALL_TOP), (0.0, RIDGE.z)], (0, 0, 0), (1, 0, 0), (0, 0, 1), (0, 1, 0), 2 * WALL[-1][2], cell['stucco'], 'body', bevel=0.01)

# ------------------------------------------------------------------ roof: timber decks, corrugated tile sheets, ridge caps
for side in ('R', 'L'):
    d, n, s_axis = slope(side); pts = []
    for s in (S0, S_END):
        for yv in (-Y_HALF, Y_HALF):
            for off in (0.0, SLAB): pts.append(RIDGE + d * s + n * off + Vector((0, yv, 0)))
    idx = lambda a, b, c: a * 4 + b * 2 + c
    faces = [(idx(0, 0, 0), idx(1, 0, 0), idx(1, 1, 0), idx(0, 1, 0)), (idx(0, 0, 1), idx(0, 1, 1), idx(1, 1, 1), idx(1, 0, 1)),
             (idx(0, 0, 0), idx(0, 0, 1), idx(1, 0, 1), idx(1, 0, 0)), (idx(0, 1, 0), idx(1, 1, 0), idx(1, 1, 1), idx(0, 1, 1)),
             (idx(0, 0, 0), idx(0, 1, 0), idx(0, 1, 1), idx(0, 0, 1)), (idx(1, 0, 0), idx(1, 0, 1), idx(1, 1, 1), idx(1, 1, 0))]
    deck = C.mesh('Timber roof deck ' + side, pts, faces, cell['wood'], 'roof', smooth=False)
    C.soften(deck, 0.01, 1, reproject=lambda o: C.uv_cell(o, cell['wood']))

SEGC = 4
YS = [-Y_EDGE + COL_STEP * k / SEGC for k in range(COLS * SEGC + 1)]
LOOPS = [(S0, 0, 0.0, 0)]
for i in range(ROWS - 1):
    s_end = 0.31 + TILE_STEP * i; LOOPS += [(s_end, i, 1.0, 0), (s_end, i + 1, 0.2, 1)]
LOOPS.append((S_END, ROWS - 1, (S_END - (0.06 + TILE_STEP * (ROWS - 1))) / TILE_L, 0))
def tile_height(row, t, yv, gaps):
    j = int(min(COLS - 1, max(0, round((yv - COL0) / COL_STEP)))); f = (yv - (COL0 + COL_STEP * j)) / COL_STEP
    if (row, j) in gaps and abs(abs(f) - .5) > 1e-6: return 0.003
    t = max(0.0, t); r = 0.052 + 0.010 * t; x = abs(f) * COL_STEP
    return 0.004 + 0.014 * t + (0.8 * r * math.sqrt(1 - (x / r) ** 2) if x < r else 0.0)
for side in ('R', 'L'):
    d, n, s_axis = slope(side); gaps = GAPS[side]; verts = []; faces = []; uvs = {}; region = 'roof_' + side
    N = len(YS)
    for li, (s, row, t, low) in enumerate(LOOPS):
        for yv in YS:
            uvs[len(verts)] = C.region_uv(region, (yv + Y_EDGE) / (2 * Y_EDGE), 1 - (s - S0) / S_SPAN - (0.012 if low else 0))
            verts.append(RIDGE + d * s + n * (SLAB + tile_height(row, t, yv, gaps)) + Vector((0, yv, 0)))
    def orient(face, out):
        a, b, c = (Vector(verts[k]) for k in face[:3])
        return face if (b - a).cross(c - b).dot(out) >= 0 else tuple(reversed(face))
    for li in range(len(LOOPS) - 1):
        lip = abs(LOOPS[li][0] - LOOPS[li + 1][0]) < 1e-9
        for k in range(N - 1):
            f = (li * N + k, li * N + k + 1, (li + 1) * N + k + 1, (li + 1) * N + k)
            faces.append(orient(f, d if lip else n))
    ntop = len(faces); skirt_uv = C.cell_rect(cell['tile_under']); su = ((skirt_uv[0] + skirt_uv[2]) / 2, (skirt_uv[1] + skirt_uv[3]) / 2)
    def deck_vertex(s, yv):
        uvs[len(verts)] = su; verts.append(RIDGE + d * s + n * SLAB + Vector((0, yv, 0))); return len(verts) - 1
    last = (len(LOOPS) - 1) * N; eave = [deck_vertex(S_END, yv) for yv in YS]
    for k in range(N - 1): faces.append(orient((last + k, last + k + 1, eave[k + 1], eave[k]), d))
    for edge_k, sgn in ((0, -1), (N - 1, 1)):
        bottoms = [deck_vertex(LOOPS[li][0], YS[edge_k]) for li in range(len(LOOPS))]
        for li in range(len(LOOPS) - 1):
            if abs(LOOPS[li][0] - LOOPS[li + 1][0]) < 1e-9: continue
            faces.append(orient((li * N + edge_k, (li + 1) * N + edge_k, bottoms[li + 1], bottoms[li]), Vector((0, sgn, 0))))
    ob = C.mesh('Terracotta barrel-tile roof sheet ' + side, verts, faces, cell['tile_a'], 'roof', smooth=True, recalc=False)
    layer = ob.data.uv_layers.active
    for p in ob.data.polygons:
        for li in p.loop_indices: layer.data[li].uv = uvs[ob.data.loops[li].vertex_index]
    ob['atlas_cell'] = 'painted region ' + region
    # Split the lip faces from the tops so tops shade as smooth barrels and lips as crisp tile ends.
    for p in ob.data.polygons: p.use_smooth = p.index < ntop and abs(p.normal.dot(n)) > .5

def barrel_into(verts, faces, base, a, side, up, L, r0, r1, lift, seg, flat=0.8):
    start = len(verts); m = seg + 1
    for t in (0.0, 1.0):
        c = base + a * (L * t) + up * (lift * t); r = r0 + (r1 - r0) * t
        for k in range(m):
            ph = math.pi * k / seg; verts.append(c + side * (r * math.cos(ph)) + up * (r * flat * math.sin(ph)))
    for k in range(seg): faces.append((start + k, start + k + 1, start + m + k + 1, start + m + k))
    faces += [(start + seg, start, start + m, start + m + seg), tuple(range(start, start + m)), tuple(range(start + m, start + 2 * m))]
z_rt = RIDGE.z + SLAB / CT - 0.02; verts = []; faces = []
for k in range(9):
    if k == HOP_CAP: continue
    barrel_into(verts, faces, Vector((0, -0.86 + 0.19 * k, z_rt)), Vector((0, 1, 0)), Vector((-1, 0, 0)), Vector((0, 0, 1)), 0.24, 0.072, 0.082, 0.01, 8)
C.mesh('Ridge cap tiles', verts, faces, cell['ridge'], 'roof')

def tile_part(name, colour, bone_name, matrix, L=TILE_L, r0=0.052, r1=0.062):
    verts = []; faces = []
    barrel_into(verts, faces, Vector((-L / 2, 0, -0.01)), Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)), L, r0, r1, 0.0, 8)
    return C.mesh(name, [matrix @ v for v in verts], faces, cell[colour], bone_name)
for k, (side, i, j, hover, extra, col) in enumerate(DANCERS):
    d, n, s_axis = slope(side)
    base = RIDGE + d * (0.06 + TILE_STEP * i + TILE_L / 2) + n * (SLAB + hover) + Vector((0, COL0 + COL_STEP * j, 0))
    slot_base = base - n * hover; base = base + NUDGE.get(k, Vector())
    mw = Matrix.Translation(base) @ Matrix((d, s_axis, n)).transposed().to_4x4() @ Euler(extra).to_matrix().to_4x4()
    bone('tile_%d' % (k + 1), base, base + n * 0.12, 'roof')
    slot = Matrix.Translation(slot_base + n * 0.012) @ Matrix((d, s_axis, n)).transposed().to_4x4() @ Euler(tuple(.15 * e for e in extra)).to_matrix().to_4x4()
    TILES['tile_%d' % (k + 1)] = {'frame': [list(r) for r in mw], 'slot': [list(r) for r in slot], 'hover_m': hover, 'colour': col, 'slope': side, 'row': i, 'column': j}
    tile_part('Dancing roof tile %d (%s)' % (k + 1, col), col, 'tile_%d' % (k + 1), mw)
hop_c = Vector((0.06, -0.86 + 0.19 * HOP_CAP + 0.12, z_rt + 0.25))
bone('ridge_tile', hop_c, hop_c + Vector((0, 0, 0.12)), 'roof')
MB = Matrix(((0, -1, 0), (1, 0, 0), (0, 0, 1))).to_4x4()
hop_m = Matrix.Translation(hop_c) @ MB @ Euler((0.35, 0.0, 0.25)).to_matrix().to_4x4()
tile_part('Hopping ridge cap tile', 'ridge', 'ridge_tile', hop_m, L=0.24, r0=0.072, r1=0.082)
TILES['ridge_tile'] = {'frame': [list(r) for r in hop_m], 'slot': [list(r) for r in Matrix.Translation((0.0, -0.86 + 0.19 * HOP_CAP + 0.12, z_rt + 0.01)) @ MB @ Euler((0.08, 0.0, 0.30)).to_matrix().to_4x4()],
                       'hover_m': 0.24, 'colour': 'ridge', 'slope': 'ridge', 'row': None, 'column': HOP_CAP}

# Chimney with a little tile hat, leaning out of the house's left slope.
CH = Matrix.Translation((-0.52, -0.28, 1.94)) @ Euler((0.05, -0.08, 0.12)).to_matrix().to_4x4()
bone('chimney', CH @ Vector((0, 0, 0.22)), CH @ Vector((0, 0, 0.60)), 'roof')
C.box('Stucco chimney stack', (0, 0, 0.36), (0.26, 0.26, 0.72), cell['stucco'], 'chimney', bevel=0.02, frame=CH)
C.box('Terracotta chimney cap', (0, 0, 0.745), (0.34, 0.34, 0.05), cell['trim'], 'chimney', bevel=0.012, frame=CH)
verts = []; faces = []
barrel_into(verts, faces, Vector((0, -0.19, 0.765)), Vector((0, 1, 0)), Vector((-1, 0, 0)), Vector((0, 0, 1)), 0.38, 0.1, 0.1, 0.0, 10, flat=0.9)
C.mesh('Chimney tile hat', [CH @ v for v in verts], faces, cell['ridge'], 'chimney')

# Vigas: round roof-beam ends under the side eaves.
for sx, ys in ((1, (-0.45, 0.45)), (-1, (-0.45, 0.0, 0.45))):
    for yv in ys: C.cylinder('Viga beam end %+d %+.2f' % (sx, yv), (sx * 0.965, yv, 1.63), 0.045, 0.045, 0.16, cell['wood'], 'body', n=10, rot=(0, math.pi / 2, 0))

# ------------------------------------------------------------------ candle niche (the glowing heart) and back vent
gy = WALL[-1][2]
C.panel('Plum candle niche', arch(0, 1.96, 0.10, 2.10, 10), (0, gy + 0.004, 0), (1, 0, 0), (0, 0, 1), (0, 1, 0), 0.02, cell['mouth'], 'body')
bone('candle', (0, gy + 0.035, 2.052), (0, gy + 0.035, 2.17), 'body')
# Author corrections: the glow halo sits 4 mm proud of the niche back (it was half buried), and the flame is the
# intended 0.125 m teardrop; the blockout's flame lathe had its (z, r) pairs swapped into a flat 0.25 m disc.
C.ellipsoid('Honey candle glow', (0, gy + 0.024, 2.095), (0.055, 0.004, 0.068), cell['glow'], 'candle', mat=1, n=16, r=4)
C.cylinder('Cream candle', (0, gy + 0.035, 2.005), 0.028, 0.028, 0.09, cell['cream'], 'body', n=10)
C.lathe('Candle flame', [(0.0, 0.0), (0.014, 0.013), (0.034, 0.021), (0.058, 0.019), (0.085, 0.012), (0.11, 0.005), (0.125, 0.0)], cell['flame'], 'candle', mat=1, n=8,
        frame=Matrix.Translation((0, gy + 0.035, 2.052)))
C.tube('Niche frame', [(x, gy + 0.018, z) for x, z in arch_path(0, 1.955, 0.122, 2.10, 10)], 0.02, cell['trim'], 'body', n=5)
C.box('Niche sill', (0, gy + 0.03, 1.945), (0.29, 0.06, 0.03), cell['trim'], 'body', bevel=0.008)
OV = Matrix.Translation((0, -gy - 0.006, 2.10)) @ Euler((math.pi / 2, 0, 0)).to_matrix().to_4x4()
C.cylinder('Back gable vent ring', (0, 0, 0), 0.105, 0.105, 0.03, cell['trim'], 'body', n=16, frame=OV)
C.cylinder('Back gable vent opening', (0, 0, 0.004), 0.075, 0.075, 0.03, cell['mouth'], 'body', n=16, frame=OV)
for k in range(2): C.box('Back gable vent spoke %d' % k, (0, 0, 0.012), (0.15, 0.018, 0.012), cell['trim'], 'body', bevel=0, rot=(0, 0, math.pi / 4 + math.pi * k / 2), frame=OV)

# ------------------------------------------------------------------ face: shutter eyes and flower-box cheeks
LOUVRE_M = 0.52
def flower(name, p, colour, bone_name='body', s=(0.043, 0.036, 0.040)):
    return C.ellipsoid(name, p, s, cell[colour], bone_name, n=6, r=4)
FLOWER_COLS = ['magenta', 'pink', 'yellow', 'magenta', 'pink']
for side, cx in (('R', 0.47), ('L', -0.47)):
    sx = 1 if cx > 0 else -1; fy = face_y(1.45)
    C.panel('Eye white window ' + side, arch(cx, EYE_Z0, EYE_HW, EYE_SPRING, 12), (0, fy - 0.004, 0), (1, 0, 0), (0, 0, 1), (0, 1, 0), 0.04, cell['white'], 'body')
    pc = Vector((cx + 0.055, fy + 0.018, 1.37)); bone('pupil_' + side, pc, pc + Vector((0, 0.10, 0)), 'body')
    C.ellipsoid('Side-glancing pupil ' + side, pc, (0.092, 0.02, 0.112), cell['ink'], 'pupil_' + side, n=14, r=7)
    C.ellipsoid('Pupil sparkle ' + side, (cx + 0.025, fy + 0.034, 1.415), (0.027, 0.008, 0.031), cell['white'], 'pupil_' + side, n=8, r=4)
    C.tube('Terracotta eye arch ' + side, [(x, face_y(z) + 0.012, z) for x, z in arch_path(cx, EYE_Z0 - 0.01, EYE_HW + 0.027, EYE_SPRING, 12)], 0.028, cell['trim'], 'body', n=6)
    # Top-hinged Bahama-shutter lid; the house's left lid sits lower (sly), its right lid higher (cheeky brow).
    z_lid = 1.565 if sx > 0 else 1.47; alpha = 0.22; hinge_z = EYE_TOP + 0.03
    O = Vector((cx, fy + 0.05, hinge_z)); V = Vector((0, -math.sin(alpha), math.cos(alpha))); D = Vector((0, math.cos(alpha), math.sin(alpha)))
    tilt = -0.15 if sx < 0 else -0.10; pivot = (0.0, z_lid - hinge_z)
    bone('lid_' + side, O, O - V * 0.12, 'body')
    # Closing keeps the lid's slant (a sheepish squint), swings it 0.15 rad toward the wall and stretches it along the
    # bone until its lowest corner rests at 1.265 m, just clear of the flower-box blooms.
    v_low = (z_lid - hinge_z) - EYE_HW * abs(math.sin(tilt))  # lowest corner of the tilted lower edge
    LIDS['lid_' + side] = {'close_scale': (hinge_z - 1.265) / (-v_low * math.cos(alpha - 0.15)), 'close_swing': -0.15, 'hinge_z': hinge_z, 'z_lid': z_lid, 'alpha': alpha, 'tilt': tilt}
    def lid_uv(co, p, O=O, V=V, pivot=pivot, tilt=tilt, z_lid=z_lid, hinge_z=hinge_z):
        h, v = (co - O).dot(Vector((1, 0, 0))), (co - O).dot(V)
        (h0, v0), = rot2([(h, v)], pivot, -tilt)
        return C.region_uv('louvre', (h0 + EYE_HW) / (2 * EYE_HW), (v0 - (z_lid - hinge_z)) / LOUVRE_M)
    C.panel('Blue louvred shutter eyelid ' + side, rot2([(h, z - hinge_z) for h, z in lid_outline(z_lid)], pivot, tilt), O, (1, 0, 0), V, D, 0.026, cell['sky'],
            'lid_' + side, bevel=0.005, uv=lid_uv)
    for tag, hs in (('out', sx), ('in', -sx)):
        hx = cx + hs * (EYE_HW + 0.03); H = Vector((hs * math.cos(math.radians(35)), math.sin(math.radians(35)), 0)); D2 = Vector((-H.y, H.x, 0)) * hs
        O2 = Vector((hx, fy + 0.012, 0)); bn = 'shutter_%s_%s' % (side, tag); bone(bn, (hx, fy + 0.012, 1.19), (hx, fy + 0.012, 1.70), 'body')
        def sh_uv(co, p, O2=O2, H=H): return C.region_uv('louvre', (co - O2).dot(H) / 0.15, (co.z - 1.19) / LOUVRE_M)
        C.panel('Blue side shutter %s %s' % (tag, side), [(0.0, 1.19), (0.15, 1.19), (0.15, 1.655), (0.13, 1.69), (0.075, 1.705), (0.0, 1.69)], O2, H, (0, 0, 1), D2, 0.024,
                cell['sky'], bn, bevel=0.005, uv=sh_uv)
    C.box('Terracotta flower-box cheek ' + side, (cx, face_y(1.12) + 0.045, 1.125), (0.46, 0.09, 0.08), cell['trim'], 'body', bevel=0.012)
    C.ellipsoid('Cheek leaves ' + side, (cx, face_y(1.12) + 0.06, 1.172), (0.215, 0.022, 0.022), cell['leaf_light'], 'body', n=8, r=4)
    for k, dx in enumerate((-0.17, -0.085, 0.0, 0.085, 0.17)):
        flower('Cheek flower %s %d' % (side, k), (cx + dx, face_y(1.12) + 0.07, 1.19 + 0.012 * ((k + 1) % 2)), FLOWER_COLS[k])

# ------------------------------------------------------------------ door mouth, honey door lips, doormat tongue, step
C.panel('Plum grin door-mouth interior', mouth_outline(n=12), (0, face_y(0.7) - 0.05, 0), (1, 0, 0), (0, 0, 1), (0, 1, 0), 0.11, cell['mouth'], 'body')
lip = mouth_outline(grow=0.032, n=14)
C.tube('Terracotta door frame and lower lip', [(x, face_y(z) + 0.014, z) for x, z in lip], 0.034, cell['trim'], 'body', n=6, closed_path=True)
for side, hs in (('R', 1), ('L', -1)):
    hinge = Vector((MW * hs, face_y(0.7) + 0.005, 0)); ang = math.radians(40)
    H = Vector((hs * math.cos(ang), math.sin(ang), 0)); D = Vector((H.y, -H.x, 0)).normalized()
    bone('door_' + side, hinge + Vector((0, 0, 0.52)), hinge + Vector((0, 0, 0.98)), 'body')
    us = [0.355 * k / 10 for k in range(11)]
    outline = [(u, mouth_bot(MW - u) + 0.008) for u in us] + [(u, mouth_top(MW - u) - 0.008) for u in reversed(us)]
    def door_uv(co, p, hinge=hinge, H=H): return C.region_uv('door', (co - hinge).dot(H) / 0.40, (co.z - 0.50) / 0.50)
    C.panel('Honey door leaf ' + side, outline, hinge, H, (0, 0, 1), D, 0.035, cell['door'], 'door_' + side, bevel=0.006, uv=door_uv)
    C.ellipsoid('Door knob ' + side, tuple(hinge + H * 0.32 + D * 0.03 + Vector((0, 0, 0.75))), (0.02, 0.02, 0.02), cell['honey'], 'door_' + side, n=8, r=4)
C.box('Terracotta step lip', (0, 0.84, 0.47), (0.80, 0.22, 0.10), cell['trim'], 'body', bevel=0.035)

path = [(0.0, yv, 0.575 - 0.038 * min(1.0, (yv - 0.60) / 0.20)) for yv in [0.60 + 0.30 * k / 8 for k in range(9)]]
# Author correction: the curl radius grows 0.07 -> 0.08 m so the mat clears the bevelled step edge by 1 cm.
path += [(0.0, 0.90 + 0.08 * math.cos(math.radians(a)), 0.466 + 0.08 * math.sin(math.radians(a))) for a in (80, 60, 42, 24, 8)]
path += [(0.0, 0.982 + 0.003 * k, 0.466 - 0.03 * k) for k in range(1, 8)]
path += [(0.0, 1.003 + 0.012 * k * k, 0.256 - 0.022 * k) for k in range(1, 4)]
P = [Vector(p) for p in path]; L = [0.0]
for a, b in zip(P, P[1:]): L.append(L[-1] + (b - a).length)
J1, J2 = 8, 16
bone('tongue_1', P[0], P[J1], 'body'); bone('tongue_2', P[J1], P[J2], 'tongue_1'); bone('tongue_3', P[J2], P[-1], 'tongue_2')
def tongue_w(co):
    k = min(range(len(P)), key=lambda k: (Vector((0, co.y, co.z)) - P[k]).length); s = L[k]
    a = C.smooth((s - (L[J1] - 0.03)) / 0.06); b = C.smooth((s - (L[J2] - 0.03)) / 0.06)
    return {'tongue_1': 1 - a, 'tongue_2': a * (1 - b), 'tongue_3': b}
verts = []; faces = []; SEGW = 4; TH2 = 0.011
for k, (p, s) in enumerate(zip(P, L)):
    w = 0.13 + 0.06 * min(1.0, s / 0.30)
    if s > L[-1] - 0.13: w = 0.19 * math.sqrt(max(0.0, 1 - ((s - (L[-1] - 0.13)) / 0.135) ** 2))
    w = max(w, 0.02); t = (P[min(k + 1, len(P) - 1)] - P[max(k - 1, 0)]).normalized(); nrm = Vector((1, 0, 0)).cross(t).normalized()
    ring = [p + Vector((-w + 2 * w * q / SEGW, 0, 0)) + nrm * TH2 for q in range(SEGW + 1)] + [p + Vector((w - 2 * w * q / SEGW, 0, 0)) - nrm * TH2 for q in range(SEGW + 1)]
    verts += ring
RN = 2 * (SEGW + 1)
for k in range(len(P) - 1):
    for q in range(RN): faces.append((k * RN + q, k * RN + (q + 1) % RN, (k + 1) * RN + (q + 1) % RN, (k + 1) * RN + q))
faces += [tuple(range(RN - 1, -1, -1)), tuple((len(P) - 1) * RN + q for q in range(RN))]
C.mesh('Striped doormat tongue', verts, faces, cell['mat'], 'tongue_1', weights=tongue_w,
       uv=lambda co, p: C.region_uv('mat', (co.x + 0.2) / 0.4, 0.5 + 0.4 * co.z))

# ------------------------------------------------------------------ right-side balcony, side door
C.box('Timber balcony floor', (1.075, 0.0, 1.125), (0.36, 0.68, 0.05), cell['wood'], 'body', bevel=0.01)
for yv in (-0.24, 0.24):
    C.panel('Timber balcony corbel %+.2f' % yv, [(0.90, 1.10), (1.16, 1.10), (1.10, 1.03), (0.98, 0.93), (0.90, 0.90)], (0, yv, 0), (1, 0, 0), (0, 0, 1), (0, 1, 0), 0.06, cell['wood'], 'body')
C.box('Blue balcony front rail', (1.225, 0.0, 1.42), (0.05, 0.70, 0.04), cell['sky'], 'body', bevel=0.008)
for yv in (-0.33, 0.33):
    C.box('Blue balcony side rail %+.2f' % yv, (1.07, yv, 1.42), (0.33, 0.05, 0.04), cell['sky'], 'body', bevel=0.008)
    for x in (0.935, 1.225): C.cylinder('Blue balcony post %.2f %+.2f' % (x, yv), (x, yv, 1.285), 0.024, 0.024, 0.27, cell['sky'], 'body', n=8)
for k in range(7): C.box('Blue baluster front %d' % k, (1.225, -0.24 + 0.08 * k, 1.285), (0.026, 0.026, 0.25), cell['sky'], 'body', bevel=0)
for yv in (-0.33, 0.33):
    for x in (1.01, 1.08, 1.15): C.box('Blue baluster side %.2f %+.2f' % (x, yv), (x, yv, 1.285), (0.026, 0.026, 0.25), cell['sky'], 'body', bevel=0)
for yv in (-0.17, 0.17):
    C.cylinder('Balcony pot %+.2f' % yv, (1.225, yv, 1.48), 0.05, 0.042, 0.08, cell['trim'], 'body', n=8)
    for k, (dx, dy, dz) in enumerate(((-0.01, -0.03, 0.055), (0.01, 0.03, 0.06), (0.0, 0.0, 0.085))):
        flower('Balcony pot flower %+.2f %d' % (yv, k), (1.225 + dx, yv + dy, 1.48 + dz), ['magenta', 'pink', 'yellow'][k])
sxw = side_x(1.4)
C.panel('Blue balcony side door', arch(0, 1.15, 0.17, 1.44, 10), (sxw + 0.008, 0, 0), (0, 1, 0), (0, 0, 1), (1, 0, 0), 0.03, cell['sky'], 'body')
C.tube('Side door frame', [(sxw + 0.02, h, z) for h, z in arch_path(0, 1.15, 0.195, 1.44, 10)], 0.024, cell['trim'], 'body', n=5)
C.ellipsoid('Side door knob', (sxw + 0.035, -0.12, 1.33), (0.018, 0.018, 0.018), cell['honey'], 'body', n=6, r=4)

# ------------------------------------------------------------------ left side and back: sleepy closed shutters and planters
sxl = side_x(1.35); Ol = Vector((-sxl - 0.012, 0.05, 0))
for k, (h0, h1) in enumerate(((-0.17, 0.0), (0.0, 0.17))):
    C.panel('Closed side shutter leaf left %d' % k, [(h0, 1.15), (h1, 1.15), (h1, 1.55), (h0, 1.55)], Ol, (0, 1, 0), (0, 0, 1), (-1, 0, 0), 0.026, cell['sky'], 'body',
            uv=lambda co, p, h0=h0: C.region_uv('louvre', (co.y - 0.05 - h0) / 0.17, (co.z - 1.15) / LOUVRE_M))
C.tube('Left window frame', [(-sxl - 0.02, 0.05 + h, z) for h, z in [(0.2, 1.13), (0.2, 1.57), (-0.2, 1.57), (-0.2, 1.13)]], 0.024, cell['trim'], 'body', n=5, closed_path=True)
C.box('Left window planter', (-sxl - 0.05, 0.05, 1.10), (0.09, 0.44, 0.07), cell['trim'], 'body', bevel=0.01)
for k, dy in enumerate((-0.14, -0.05, 0.05, 0.14)): flower('Left planter flower %d' % k, (-sxl - 0.07, 0.05 + dy, 1.16), FLOWER_COLS[k])
by = face_y(1.35); Ob = Vector((0.32, -by - 0.012, 0))
for hs in (1, -1):
    C.panel('Closed back shutter %+d' % hs, [(0.0, 1.15), (0.155 * hs, 1.15), (0.155 * hs, 1.56), (0.0, 1.56)], Ob, (-1, 0, 0), (0, 0, 1), (0, -1, 0), 0.026, cell['sky'], 'body',
            uv=lambda co, p, hs=hs: C.region_uv('louvre', ((0.32 - co.x) * hs) / 0.155, (co.z - 1.15) / LOUVRE_M))
C.tube('Back window frame', [(0.32 + h, -by - 0.02, z) for h, z in [(0.18, 1.13), (0.18, 1.58), (-0.18, 1.58), (-0.18, 1.13)]], 0.024, cell['trim'], 'body', n=5, closed_path=True)
C.box('Back window planter', (0.32, -by - 0.05, 1.10), (0.42, 0.09, 0.07), cell['trim'], 'body', bevel=0.01)
for k, dx in enumerate((-0.14, -0.05, 0.05, 0.14)): flower('Back planter flower %d' % k, (0.32 + dx, -by - 0.07, 1.16), FLOWER_COLS[k])

# ------------------------------------------------------------------ bougainvillea vine up the front-left corner
vp = [(-0.935, 0.655, 0.53), (-0.955, 0.64, 0.80), (-0.915, 0.685, 1.05), (-0.955, 0.645, 1.32), (-0.918, 0.69, 1.55), (-0.95, 0.65, 1.74), (-0.99, 0.55, 1.80)]
C.tube('Bougainvillea vine', C.catmull(vp, 3), 0.022, cell['leaf'], 'body', n=5)
for k, p in enumerate(vp[1:]):
    for m, (dx, dy, dz) in enumerate(((0.03, 0.03, 0.02), (-0.03, 0.035, -0.03))):
        C.ellipsoid('Bougainvillea bloom %d %d' % (k, m), (p[0] + dx, p[1] + dy, p[2] + dz), (0.046, 0.038, 0.042), cell['magenta' if (k + m) % 3 else 'pink'], 'body', n=6, r=4)
    C.ellipsoid('Bougainvillea leaf %d' % k, (p[0] - 0.04, p[1] + 0.01, p[2] - 0.06), (0.04, 0.018, 0.022), cell['leaf'], 'body', n=6, r=3, rot=(0.3, 0.6, 0.2))

# ------------------------------------------------------------------ two little butterflies by the eaves
for k, (loc, rot, upper, lower) in enumerate((((0.62, 0.98, 2.06), (0.25, 0.0, 0.45), 'coral', 'honey'), ((-0.64, 0.96, 2.30), (-0.2, 0.25, -0.55), 'honey', 'coral'))):
    F = Matrix.Translation(loc) @ Euler(rot).to_matrix().to_4x4(); bb = 'butterfly_%d' % (k + 1)
    bone(bb, F @ Vector((0, 0, -0.03)), F @ Vector((0, 0, 0.05)), 'body')
    C.ellipsoid('Butterfly %d body' % (k + 1), (0, 0, 0), (0.011, 0.011, 0.042), cell['ink'], bb, n=6, r=4, frame=F)
    for sx, tag in ((1, 'R'), (-1, 'L')):
        wb = 'wing_%d_%s' % (k + 1, tag); bone(wb, F @ Vector((0, 0, 0)), F @ Vector((0, 0, 0.05)), bb)
        C.ellipsoid('Butterfly %d upper wing %s' % (k + 1, tag), (0.043 * sx, 0, 0.016), (0.046, 0.006, 0.036), cell[upper], wb, n=8, r=3, rot=(0, 0.35 * sx, 0), frame=F)
        C.ellipsoid('Butterfly %d lower wing %s' % (k + 1, tag), (0.032 * sx, 0, -0.020), (0.032, 0.006, 0.026), cell[lower], wb, n=8, r=3, rot=(0, -0.3 * sx, 0), frame=F)

# ------------------------------------------------------------------ join into one skin, rig, record, checkpoint export
sources = bpy.data.collections.new('EDITABLE original magic house parts - excluded from export'); sc.collection.children.link(sources)
inventory = []; copies = []
for ob in C.PARTS:
    ob.data.calc_loop_triangles()
    inventory.append({'name': ob.name, 'triangles': len(ob.data.loop_triangles), 'bone_groups': [g.name for g in ob.vertex_groups], 'atlas': ob.get('atlas_cell'),
                      'material': ob.data.materials[0].name})
    cp = ob.copy(); cp.data = ob.data.copy(); sc.collection.objects.link(cp); copies.append(cp)
    tag_attr = cp.data.attributes.new('mh_part', 'INT', 'POINT'); tag_attr.data.foreach_set('value', [len(copies) - 1] * len(cp.data.vertices))
    for col in list(ob.users_collection): col.objects.unlink(ob)
    sources.objects.link(ob)
sources.hide_render = True; sources.hide_viewport = True
bpy.ops.object.select_all(action='DESELECT')
for ob in copies: ob.select_set(True)
bpy.context.view_layer.objects.active = copies[0]; bpy.ops.object.join(); skin = bpy.context.object; skin.name = 'Magic_House_Skin'; skin.data.name = 'Magic_House_Skin_Mesh'
for tag in ['source_part', 'rigid_bone', 'atlas_cell']:
    if tag in skin: del skin[tag]
skin.data.calc_loop_triangles(); tris = len(skin.data.loop_triangles); assert tris <= 15000, tris
assert len(skin.data.materials) == 2, [m.name for m in skin.data.materials]
data = bpy.data.armatures.new('Original magic house skeleton'); arm = bpy.data.objects.new('Magic_House_Rig', data); sc.collection.objects.link(arm)
skin.select_set(False); arm.select_set(True); bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='EDIT')
for name, (head, tail, parent) in REST.items():
    b = data.edit_bones.new(name); b.head = head; b.tail = tail; b.roll = 0
    if parent: b.parent = data.edit_bones[parent]
    b.use_deform = True
bpy.ops.object.mode_set(mode='OBJECT')
groups = {g.name for g in skin.vertex_groups}; assert groups <= set(REST), groups - set(REST)
mod = skin.modifiers.new('Attached rigid house skin', 'ARMATURE'); mod.object = arm; skin.parent = arm
arm['asset_id'] = 'magic-house'; arm['version'] = 'v001'; arm['forward'] = 'Blender +Y / glTF -Z'; arm['attack_contact_fraction'] = .625
pts = [v.co for v in skin.data.vertices]; lo = [min(p[k] for p in pts) for k in range(3)]; hi = [max(p[k] for p in pts) for k in range(3)]
record = {'asset_id': 'magic-house', 'version': 'v001', 'work_order': 'WO111', 'authoring_model': 'claude-opus-5-5 xhigh', 'blender_version': bpy.app.version_string,
          'blender_instance': 'blender-authoring-2', 'source_reference': 'Blender reference sheet, no generated concept',
          'source_sheet_sha256': sc['source_sheet_sha256'], 'source_blockout_sha256': sc['source_blockout_sha256'],
          'rest_bounds_blender_zup': {'min': lo, 'max': hi, 'size': [hi[k] - lo[k] for k in range(3)]},
          'height_m': hi[2], 'triangles': tris, 'vertices': len(skin.data.vertices), 'material_count': len(skin.data.materials), 'bone_count': len(data.bones),
          'bones': {k: {'head': list(v[0]), 'tail': list(v[1]), 'parent': v[2]} for k, v in REST.items()},
          'texture': {'file': 'pigment.png', 'width': 1024, 'height': 1024, 'origin': 'Original deterministic painted atlas generated in Blender Python: 32 flat swatches plus painted roof-tile rows, louvres, door leaf and doormat stripes; no external textures.'},
          'parts': inventory, 'part_attribute': 'mh_part (INT per vertex, index into parts; not exported)',
          'notes': ['Proportions, colours, silhouette and parody hooks follow the coordinator-approved reference sheet and blockout (identical coordinates).',
                    'The ~180 static barrel tiles are two corrugated roof sheets (13 columns x 7 rows) with painted rows; empty slots of the six dancing tiles are flattened and painted as timber.',
                    'Louvres, door flowers and panel lines, and doormat stripes are painted atlas regions addressed in physical metres.',
                    'Candle flame and glow use the second (emissive) material; everything else is matte.']}
(ROOT / 'construction.json').write_text(json.dumps(record, indent=2) + '\n')
(ROOT / 'source').mkdir(exist_ok=True); (ROOT / 'source/rig-rest.json').write_text(json.dumps({'rest': REST, 'tiles': TILES, 'lids': LIDS, 'tongue_path': [list(p) for p in P], 'tongue_joints': [J1, J2],
                                                                                 'shutter_close_sign': {'shutter_R_out': 1, 'shutter_R_in': -1, 'shutter_L_out': -1, 'shutter_L_in': 1}, 'door_close_sign': {'door_R': 1, 'door_L': -1}}, indent=2) + '\n')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'magic-house-construction.blend'), compress=True)
bpy.ops.object.select_all(action='DESELECT'); skin.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=str(ROOT / 'magic-house-checkpoint.glb'), export_format='GLB', use_selection=True, export_animations=False, export_skins=True, export_yup=True,
                          export_apply=False, export_armature_object_remove=True, export_texcoords=True, export_normals=True, export_materials='EXPORT', export_cameras=False,
                          export_lights=False, export_extras=True)
print(json.dumps({k: record[k] for k in ['triangles', 'vertices', 'height_m', 'material_count', 'bone_count', 'rest_bounds_blender_zup']}))
top = sorted(inventory, key=lambda r: -r['triangles'])[:14]; print(json.dumps([(r['name'], r['triangles']) for r in top]))
print('png bytes', (ROOT / 'pigment.png').stat().st_size, 'glb bytes', (ROOT / 'magic-house-checkpoint.glb').stat().st_size)
