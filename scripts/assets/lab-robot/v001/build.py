"""WO111 lab-robot v001: final budgeted model from the approved Blender reference sheet.

Source authority: reference-sheet.png and lab-robot-blockout.blend (coordinator approved Sept 26,
"Blender reference sheet, no generated concept") plus the coordinator's model notes in SHEET-REVIEWS.md
(Hero City is spooky level 1 under DESIGN-027: the lens eye may glow red in dim light; attack: the warning
light spins, then a pincer lunge; defeat: sparks, the dome pops and it slumps smoking, held). The blockout's
measured coordinates supply the silhouette, colours and parody hooks: the caged amber warning light, the pale
tin dome head with plum trim, seam rivets and brass ear bolts, the one big camera-lens eye with its steel
barrel, brass bezel, tilted plum eyelid and glints, the speaker-grille smile, the plum rubber neck bellows,
the tapered teal tin body with the pale control panel, three indicator lights, two gauge dials, the candy-red
self-destruct button in its hazard ring and the striped kick plate, side louvers, the back hatch and cord
grommet, the slinky-spring arms with round brass pincer claws, the swivel waist on the plum crossbar, the
plum rubber tank treads with lugs, teal housing plates, road wheels and brass hubcaps, and the yanked-out
power cord curling up like a tail with its two-prong plug. Topology, atlas, UVs, weights, rig and clips are new.

Spooky level 1 additions: a red glowing core in the pupil (so the lens stares red in the dark) and a red
target glare that opens over the iris when it locks on; sparks and smoke puffs for the defeat. The painted
tin, brass and glass keep the sheet colours; only the warning light, the eye core, the glare and the sparks
use the glow material.

Blender +Z up / +Y forward (glTF +Y up / -Z forward), floor-centred root, right = +X.
Bind pose: see rig.py; the sheet pose is recreated at idle 0 s.
"""
import bpy, math, json, hashlib, importlib.util
from pathlib import Path
from mathutils import Vector, Matrix, Euler

ROOT = Path('/workspace/haynes-quest/family-eras/lab-robot/v001')
sc = bpy.context.scene
assert sc.get('work_order') == 'WO111' and sc.get('scene_lease') == 'active' and sc.get('asset_id') == 'lab-robot'
def load(name):
    spec = importlib.util.spec_from_file_location('wo111_lr_' + name, ROOT / ('source/%s.py' % name)); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
C = load('common'); P = load('paint'); RG = load('rig')
T = P.T
V = RG.V; MATTE = 0; GLOW = 1
E = RG.EYE_C

atlas = P.paint_atlas(str(ROOT / 'pigment.png'))
keep = {k: sc[k] for k in sc.keys() if k.startswith('blendermcp_') or k in ('work_order', 'scene_owner', 'scene_lease', 'asset_id', 'asset_version', 'authoring_model')}
C.setup(ROOT, [('Matte painted tin, brass, rubber and glass', .55, False), ('Glowing warning light, red eye and sparks', .40, True)],
        ROOT / 'pigment.png', 'lab-robot original painted 1024 atlas', P.RECT)
for key in list(sc.keys()):
    if key not in keep and key != 'cycles': del sc[key]
for k, v in keep.items(): sc[k] = v
sc['candidate_status'] = "WO111 lab-robot v001 · Awaiting Tom's review · used in the family release"
sc['source_reference'] = 'Blender reference sheet, no generated concept'
sc['source_sheet_sha256'] = hashlib.sha256((ROOT / 'reference-sheet.png').read_bytes()).hexdigest()
sc['source_blockout_sha256'] = hashlib.sha256((ROOT / 'lab-robot-blockout.blend').read_bytes()).hexdigest()
sc['orientation'] = 'Blender +Z up/+Y forward; glTF +Y up/-Z forward; stationary identity floor root; character right = +X'

def indexed(verts, faces, tiles):
    """face_tile closure: the tile of the authored face whose source centroid is nearest."""
    table = [(sum((Vector(verts[i]) for i in f), Vector()) / len(f), t) for f, t in zip(faces, tiles)]
    def pick(c, n):
        best = min(table, key=lambda e: (e[0] - c).length_squared); assert (best[0] - c).length < 1e-5, ('face centroid not found', tuple(c))
        return best[1]
    return pick
def collapse(pivot, k):
    pivot = Vector(pivot); return Matrix.Translation(pivot) @ Matrix.Scale(k, 4) @ Matrix.Translation(-pivot)

# ================= weights =================
def bellows_w(p):
    t = C.smooth((p.z - 0.786) / 0.052); return {'body': 1 - t, 'head': t}
def arm_w(s):
    J, W, d, S = RG.REST_ARM[s]; L = RG.REST_ARM_LEN; J0 = J[0]
    names = ['arm_%s_%d' % (s, i + 1) for i in range(RG.N_ARM)] + ['claw_' + s]
    def f(p):
        u = max(0.0, min(float(RG.N_ARM), (p - J0).dot(d) / L * RG.N_ARM)); i = min(int(u), RG.N_ARM - 1); fr = u - i
        return {names[i]: 1 - fr, names[i + 1]: fr}
    return f
CPATH = RG.CORD_PATH; CACC = RG.arclength(CPATH); CTOT = CACC[-1]; CJS = [f * CTOT for f in RG.CORD_FR]
CNAMES = ['cord_%d' % (i + 1) for i in range(5)] + ['plug']
def cord_arc(p):
    best = (1e9, 0.0)
    for i in range(len(CPATH) - 1):
        a = CPATH[i]; b = CPATH[i + 1]; d = b - a; t = max(0.0, min(1.0, (p - a).dot(d) / max(d.length_squared, 1e-12)))
        dist = (a + d * t - p).length
        if dist < best[0]: best = (dist, CACC[i] + t * d.length)
    return best[1]
def cord_w(p):
    s = cord_arc(p)
    for j in range(5):
        if s < CJS[j + 1] or j == 4:
            fr = max(0.0, min(1.0, (s - CJS[j]) / (CJS[j + 1] - CJS[j]))); return {CNAMES[j]: 1 - fr, CNAMES[j + 1]: fr}

# ================= head =================
HB = 'head'
C.rod('Plum head bottom trim', (0, 0, 0.831), (0, 0, 0.853), 0.213, 0.213, T['plum'], HB, n=40)
SX, SZ, SW, SH = P.SMILE_SRC
C.lathe_rows('Pale tin head band with the painted speaker-grille smile', [(0.835, RG.HEAD_R), (RG.BAND_Z1, RG.HEAD_R)], T['silver'], HB, n=40, caps=False,
             face_tile=lambda c, n: ('planar', 'S', SX, SZ, SW, SH, False) if n.y > 0.87 else None)
# the interior under the dome lid (seen when it pops open in the defeat)
ring = [V(RG.HEAD_R * 0.995 * math.cos(math.tau * i / 40), RG.HEAD_R * 0.995 * math.sin(math.tau * i / 40), 0.970) for i in range(40)]
C.mesh('Dark works inside the head (cogs and spring)', ring, [tuple(range(40))], T['interior'], HB, face_tile=lambda c, n: ('polarZ', 'N', 0, 0, P.INTERIOR_R), orient=(0, 0, 1))
for s, sx in (('R', 1), ('L', -1)):
    C.rod('Brass ear disc ' + s, (sx * (RG.HEAD_R - 0.01), 0, 0.915), (sx * (RG.HEAD_R + 0.022), 0, 0.915), 0.048, 0.044, T['brass'], HB, n=20)
    C.rod('Steel ear bolt ' + s, (sx * (RG.HEAD_R + 0.02), 0, 0.915), (sx * (RG.HEAD_R + 0.05), 0, 0.915), 0.018, 0.014, T['steel'], HB, n=12)
# the one big camera-lens eye
C.rod('Steel lens barrel', (0, 0.10, E.z), (0, 0.20, E.z), 0.098, 0.098, T['steel'], HB, n=32, caps=False)
C.rod('Brass lens bezel', (0, 0.20, E.z), (0, RG.LENS_Y, E.z), 0.108, 0.108, T['brass'], HB, n=32, caps=(False, True))
C.dome_cap('Pale blue domed lens glass', (0, RG.LENS_Y, E.z), RG.GLASS_R, RG.GLASS_DEPTH, RG.GLASS_R, T['glass'], HB, axis='Y', rings_n=5, n=32)
def eye_disc(name, radii, depth, tile, bn, mat=MATTE, face_tile=None, n=32, xz=None):
    """A shell over the lens: rings of radius r at depth(r) (a centre vertex when radii[0] == 0)."""
    verts = []; faces = []; cx, cz = (0.0, E.z) if xz is None else xz
    rings_ = [r for r in radii if r > 0]; centre = radii[0] == 0
    if centre: verts.append(V(cx, depth(0.0), cz))
    for r in rings_:
        verts += [V(cx + r * math.cos(math.tau * i / n), depth(r), cz + r * math.sin(math.tau * i / n)) for i in range(n)]
    o = 1 if centre else 0
    if centre: faces += [(0, o + (i + 1) % n, o + i) for i in range(n)]
    for j in range(len(rings_) - 1):
        for i in range(n): faces.append((o + j * n + i, o + (j + 1) * n + i, o + (j + 1) * n + (i + 1) % n, o + j * n + (i + 1) % n))
    return C.mesh(name, verts, faces, tile, bn, mat, True, None, face_tile, None, orient=(0, 1, 0))
iris_depth = lambda r: RG.glass_y(RG.IRIS_MIN_SCALE * r) + 0.0012
eye_disc('Blue camera iris with aperture blades and plum pupil', [0, 0.012, 0.024, 0.036, 0.046, 0.056, P.IRIS_R], iris_depth, T['iris'], 'pupil',
         face_tile=lambda c, n: ('polarY', 'I', 0.0, E.z, P.IRIS_R, False))
eye_disc('Glowing red pupil core', [0, 0.0085, 0.014], lambda r: iris_depth(0) + 0.001, T['glow_red'], 'pupil', GLOW, n=12)
GLARE_K = 0.04
gl = eye_disc('Glowing red target glare (opens over the iris)', [0.034, 0.046, 0.058], lambda r: iris_depth(r) + 0.002, T['glare_red'], 'glare', GLOW)
for v in gl.data.vertices:                                      # bind collapsed about the eye axis; the glare bone opens it x25
    v.co.x *= GLARE_K; v.co.z = E.z + (v.co.z - E.z) * GLARE_K
for nm, (gx, gz), (rx, rz), rot in (('big', (-0.03, E.z + 0.026), (0.017, 0.012), math.radians(30)), ('small', (-0.052, E.z + 0.002), (0.0075, 0.0075), 0.0)):
    # in front of the iris shell and the glare at their largest depth, so dilation and glances pass under the glints
    C.ellipsoid('Cream lens glint ' + nm, (gx, iris_depth(math.hypot(gx, gz - E.z)) + 0.0036, gz), (rx, 0.0012, rz), T['cream'], HB, n=10, r=4, rot=(0, rot, 0))
lid = [(RG.LID_R * math.cos(math.radians(30 + 120 * i / 20)), E.z + RG.LID_R * math.sin(math.radians(30 + 120 * i / 20))) for i in range(21)]
C.prism('Plum lens eyelid shutter', lid, RG.LID_THICK, T['plum'], 'eyelid', M=Matrix.Translation((0, RG.LID_Y, 0)))
# neck bellows (body to head blend: it stretches for the pop-up and bends for the wobble)
bell = [(0.0, 0.112)] + [(0.01 * i, 0.128 if i % 2 else 0.108) for i in range(1, 7)] + [(0.066, 0.112)]
C.lathe_rows('Plum rubber neck bellows', [(RG.BODY_Z1 - 0.012 + z, r) for z, r in bell], T['rubber'], 'head', n=24, caps=False, weights=bellows_w)

# ================= dome lid, seam ring and warning light =================
DB = 'dome'
C.dome_cap('Pale tin dome lid', (0, 0, RG.BAND_Z1), RG.HEAD_R, RG.HEAD_R, RG.HEAD_R, T['silver'], DB, axis='Z', rings_n=10, n=40)
# flat underside with its own vertices (a shared smooth rim would shade it dark when the lid pops open)
ring = [V(RG.HEAD_R * math.cos(math.tau * i / 40), RG.HEAD_R * math.sin(math.tau * i / 40), RG.BAND_Z1 + 0.0015) for i in range(40)]
C.mesh('Pale tin dome lid underside', ring, [tuple(range(40))], T['silver_shade'], DB, smooth=False, orient=(0, 0, -1))
# a washer (not a capped disc), so the pale lid underside shows when the lid pops open
seam = [[V(r_ * math.cos(math.tau * i / 40), r_ * math.sin(math.tau * i / 40), z_) for i in range(40)]
        for r_, z_ in ((RG.HEAD_R - 0.005, P.SEAM_Z[0]), (RG.HEAD_R + 0.007, P.SEAM_Z[0]), (RG.HEAD_R + 0.007, P.SEAM_Z[1]), (RG.HEAD_R - 0.005, P.SEAM_Z[1]))]
C.rings('Plum seam ring with brass rivets', seam + [seam[0]], T['plum'], DB, caps=False, smooth=False,
        face_tile=lambda c, n: ('cyl', 'R', P.SEAM_Z[0], P.SEAM_Z[1]) if abs(n.z) < 0.5 and (c.x * n.x + c.y * n.y) > 0 else None)
BZ0 = RG.BEACON_Z
C.rod('Brass warning light base', (0, 0, BZ0), (0, 0, BZ0 + 0.038), 0.064, 0.058, T['brass'], DB, n=24)
amber_rows = [(BZ0 + 0.034, 0.0474), (BZ0 + 0.058, 0.0474), (BZ0 + 0.062, 0.048)] + [(BZ0 + 0.062 + 0.048 * math.sin(math.radians(a)), 0.048 * math.cos(math.radians(a))) for a in (22, 44, 64, 80, 88)]
C.lathe_rows('Glowing amber warning light with a rotating hot spot', amber_rows, T['amber_glow'], 'beacon', GLOW, n=24, caps=(False, True),
             face_tile=lambda c, n: ('beacon', 'A', P.BEACON_ZS[0], P.BEACON_ZS[1]))
CAGE = [(0.058, 0.034), (0.058, 0.064), (0.052, 0.094), (0.032, 0.113), (0.0, 0.12)]
CAGE = CAGE + [(-r, z) for r, z in reversed(CAGE[:-1])]
for i, ang in enumerate((0.0, math.pi / 2)):
    d = V(math.cos(ang), math.sin(ang), 0); up = V(-math.sin(ang), math.cos(ang), 0)
    C.sweep('Steel warning light cage wire %d' % i, [tuple(d * r + V(0, 0, BZ0 + z)) for r, z in CAGE], [0.0045, 0.0045], T['steel'], n=6, per=3, up=tuple(up), bn='beacon')

# ================= body =================
BB = 'body'; FY = RG.FRONT_Y; PF = RG.PF; BZ = RG.BZ
C.box('Teal tin body', (0, 0, (RG.BODY_Z0 + RG.BODY_Z1) / 2), (RG.BODY_W, RG.BODY_D, RG.BODY_Z1 - RG.BODY_Z0), T['tin'], BB, bevel=0.05, segments=3, taper=RG.BODY_TAPER)
C.box('Pale tin control panel', (0, FY + 0.004, 0.54), (0.34, 0.016, 0.28), T['silver'], BB, bevel=0.006, segments=1,
      face_tile=lambda c, n: ('planar', 'P', 0.0, 0.54, 0.17, 0.14, False) if n.y > 0.9 else None)
wash = []
for r_, y_ in ((0.052, PF + 0.012), (0.078, PF + 0.012), (0.078, PF - 0.004), (0.052, PF - 0.004)):
    wash.append([V(r_ * math.cos(math.tau * i / 32), y_, BZ + r_ * math.sin(math.tau * i / 32)) for i in range(32)])
C.rings('Brass and plum hazard ring', wash + [wash[0]], T['plum'], BB, caps=False, smooth=False,
        face_tile=lambda c, n: ('polarY', 'Z', 0.0, BZ, P.HAZ_R, False) if n.y > 0.9 else None)
C.rod('Candy-red self-destruct button', (0, PF, BZ), (0, PF + 0.034, BZ), 0.05, 0.05, T['tomato'], 'button', n=28, caps=False)
C.dome_cap('Candy-red self-destruct button cap with its shine', (0, PF + 0.034, BZ), 0.05, 0.016, 0.05, T['tomato'], 'button', axis='Y', rings_n=4, n=28,
           face_tile=lambda c, n: ('polarY', 'BT', 0.0, BZ, P.BTN_R, False))
for dx, key in ((-0.125, 'DL'), (0.125, 'DR')):
    C.rod('Brass gauge dial %s' % key, (dx, PF - 0.002, BZ), (dx, PF + 0.012, BZ), P.DIAL_R, P.DIAL_R, T['brass'], BB, n=20,
          face_tile=lambda c, n, dx=dx, key=key: ('polarY', key, dx, BZ, P.DIAL_R, False) if n.y > 0.9 else None)
for dx, key, tag in ((-0.06, 'amber_matte', 'amber'), (0.0, 'glass', 'blue'), (0.06, 'tomato', 'red')):
    C.ellipsoid('Indicator light %s' % tag, (dx, PF, 0.635), (0.018, 0.011, 0.018), T[key], BB, n=12, r=6)
C.box('Brass hazard kick plate', (0, FY + 0.003, P.KICK[1]), (0.40, 0.012, 0.048), T['brass'], BB, bevel=0.004, segments=1,
      face_tile=lambda c, n: ('planar', 'K', P.KICK[0], P.KICK[1], P.KICK[2], P.KICK[3], False) if n.y > 0.9 else None)
for s, sx in (('R', 1), ('L', -1)):
    for i, lz in enumerate((0.47, 0.51, 0.55, 0.59)):
        C.box('Plum side louver %s %d' % (s, i), (sx * (RG.body_half_x(lz) + 0.002), -0.01, lz), (0.012, 0.18, 0.016), T['plum'], BB, bevel=0)
    C.ellipsoid('Brass shoulder socket ' + s, tuple(RG.SOCKET[s]), (0.054, 0.054, 0.054), T['brass'], BB, n=16, r=8)
BY = -FY - 0.004
C.box('Pale tin back hatch', (0, BY, 0.585), (0.28, 0.014, 0.24), T['silver'], BB, bevel=0.006, segments=1,
      face_tile=lambda c, n: ('planar', 'P', 0.0, 0.585, 0.14, 0.12, True) if n.y < -0.9 else None)
C.box('Plum hatch handle', (0, BY - 0.012, 0.585), (0.09, 0.014, 0.018), T['plum'], BB, bevel=0.004, segments=1)
C.rod('Brass cord grommet', (0, -FY + 0.01, 0.38), (0, -FY - 0.022, 0.38), 0.034, 0.03, T['brass'], BB, n=16)

# ================= waist and chassis =================
C.rod('Steel swivel waist', (0, 0, 0.150), (0, 0, RG.BODY_Z0 + 0.01), 0.105, 0.115, T['steel'], 'waist', n=28, caps=False)
C.rod('Brass waist ring', (0, 0, 0.255), (0, 0, 0.272), 0.122, 0.122, T['brass'], 'waist', n=28)
C.box('Plum chassis crossbar', (0, 0, 0.165), (2 * (RG.TREAD_X - RG.TREAD_W / 2) + 0.03, 0.22, 0.055), T['plum'], 'chassis', bevel=0.01, segments=1)

# ================= tank treads =================
def stadium(x, per_arc=14, n_straight=8):
    rm = RG.TREAD_R - RG.TREAD_T / 2; L = RG.TREAD_Y1 - RG.TREAD_Y0; zc = RG.TREAD_ZC; pts = []
    for i in range(n_straight): pts.append((V(0, RG.TREAD_Y0 + L * i / n_straight, zc + rm), V(0, 0, 1)))
    for i in range(per_arc):
        a = math.pi / 2 - math.pi * i / per_arc; nrm = V(0, math.cos(a), math.sin(a)); pts.append((V(0, RG.TREAD_Y1, zc) + nrm * rm, nrm))
    for i in range(n_straight): pts.append((V(0, RG.TREAD_Y1 - L * i / n_straight, zc - rm), V(0, 0, -1)))
    for i in range(per_arc):
        a = -math.pi / 2 - math.pi * i / per_arc; nrm = V(0, math.cos(a), math.sin(a)); pts.append((V(0, RG.TREAD_Y0, zc) + nrm * rm, nrm))
    return pts
for s, sx in (('R', 1), ('L', -1)):
    x = RG.TREAD_X * sx; pts = stadium(x); m = len(pts); t = RG.TREAD_T; w = RG.TREAD_W
    verts = []; faces = []
    for p, nrm in pts:
        o = p + nrm * t / 2; q = p - nrm * t / 2
        verts += [V(x - w / 2, o.y, o.z), V(x + w / 2, o.y, o.z), V(x + w / 2, q.y, q.z), V(x - w / 2, q.y, q.z)]
    for i in range(m):
        a = 4 * i; b = 4 * ((i + 1) % m)
        faces += [(a, a + 1, b + 1, b), (a + 1, a + 2, b + 2, b + 1), (a + 2, a + 3, b + 3, b + 2), (a + 3, a, b, b + 3)]
    C.mesh('Plum rubber tank tread belt ' + s, verts, faces, T['rubber'], 'chassis', smooth=False)
    outer = [(V(x, p.y, p.z) + nrm * t / 2, nrm) for p, nrm in pts]
    lens = [0.0]
    for i in range(1, m + 1): lens.append(lens[-1] + (outer[i % m][0] - outer[i - 1][0]).length)
    count = int(lens[-1] / 0.042); k = 0
    for c in range(count):
        sd = lens[-1] * c / count
        while lens[k + 1] < sd: k += 1
        p, nrm = outer[k]; q, _ = outer[(k + 1) % m]; tang = (q - p).normalized(); p = p.lerp(q, (sd - lens[k]) / max(1e-9, lens[k + 1] - lens[k]))
        M = C.frame(tang, nrm, p + nrm * (0.00968 - 0.006))          # outer face at 0.10468 m from the arc centre: its corners stay inside the rolling radius
        C.box('Tread lug %s %02d' % (s, c), (0, 0, 0), (RG.TREAD_W + 0.004, 0.016, RG.LUG_H + 0.002), T['rubber_hi'], 'chassis', bevel=0, transform=M)
    hp = []
    rr_ = RG.TREAD_R - RG.TREAD_T - 0.012
    for i in range(12):
        a = math.pi / 2 - math.pi * i / 11; hp.append((-(RG.TREAD_Y1 + rr_ * math.cos(a)), RG.TREAD_ZC + rr_ * math.sin(a)))
    for i in range(12):
        a = -math.pi / 2 - math.pi * i / 11; hp.append((-(RG.TREAD_Y0 + rr_ * math.cos(a)), RG.TREAD_ZC + rr_ * math.sin(a)))
    C.prism('Teal tread housing plate ' + s, hp, RG.TREAD_W - 0.03, T['tin'], 'chassis', M=C.frame((1, 0, 0), (0, 0, 1), (x, 0, 0)))
    for i, (yw, rw, tag) in enumerate(RG.WHEELS):
        zw = RG.wheel_z(rw); bn = 'wheel_%s_%d' % (s, i); xo = x + sx * (w / 2 + 0.002)
        C.rod('Steel road wheel %s %s' % (s, tag), (x + sx * 0.04, yw, zw), (xo, yw, zw), rw, rw, T['steel'], bn, n=16)
        C.rod('Brass hubcap %s %s' % (s, tag), (xo, yw, zw), (xo + sx * 0.012, yw, zw), rw * 0.72, rw * 0.62, T['brass'], bn, n=16,
              face_tile=lambda c, n, yw=yw, zw=zw, rw=rw, sx=sx: ('polarX', 'H', yw, zw, rw * 0.62) if n.x * sx > 0.9 else None)
        C.rod('Steel hub bolt %s %s' % (s, tag), (xo + sx * 0.01, yw, zw), (xo + sx * 0.022, yw, zw), rw * 0.22, rw * 0.18, T['steel'], bn, n=8)

# ================= slinky arms and pincer claws =================
for s in 'RL':
    J, W, d, S = RG.REST_ARM[s]; L = RG.REST_ARM_LEN; NP = 13; pitch = L / NP
    rows = [(-0.02, 0.034, 'v')]
    for k in range(NP + 1):
        rows.append((k * pitch, 0.036, 'v'))
        if k < NP: rows += [(k * pitch + 0.3 * pitch, 0.0465, 'r'), (k * pitch + 0.7 * pitch, 0.0465, 'r')]
    rows.append((L + 0.012, 0.034, 'v'))
    a1 = d.orthogonal().normalized(); a2 = d.cross(a1).normalized(); n = 10
    verts = [J[0] + d * sa + (a1 * math.cos(math.tau * i / n) + a2 * math.sin(math.tau * i / n)) * r for sa, r, _ in rows for i in range(n)]
    faces = [(j * n + i, j * n + (i + 1) % n, (j + 1) * n + (i + 1) % n, (j + 1) * n + i) for j in range(len(rows) - 1) for i in range(n)]
    # ridge tops keep the steel; faces running into a valley carry the painted groove shade
    tiles = [T['steel'] if (rows[j][2] == 'r' and rows[j + 1][2] == 'r') else T['steel_dark'] for j in range(len(rows) - 1) for i in range(n)]
    C.mesh('Steel slinky spring arm ' + s, verts, faces, T['steel'], 'arm_%s_1' % s, MATTE, True, arm_w(s), indexed(verts, faces, tiles))
    J0, Ws, Ts, Ss, _ = RG.SHEET_ARM[s]; M = RG.CLAW_MAP[s]; Tn = Ts.normalized()
    C.rod('Steel wrist cuff ' + s, M @ (Ws - Tn * 0.01), M @ (Ws + Tn * 0.05), 0.046, 0.046, T['steel'], 'claw_' + s, n=14)
    C.rod('Brass claw palm ' + s, M @ (Ws + Tn * 0.045), M @ (Ws + Tn * 0.085), 0.05, 0.043, T['brass'], 'claw_' + s, n=14)
    up = Tn.cross((Ss - Ss.dot(Tn) * Tn).normalized())
    for k, tag in ((1, 'a'), (-1, 'b')):
        base, mid, tip = RG.jaw_points(Ws, Ts, Ss, k, RG.SHEET_SPREAD[s]); bn = 'jaw_%s_%s' % (s, tag)
        C.sweep('Brass pincer jaw %s %s' % (s, tag), [tuple(base), tuple(mid), tuple(tip)], [0.024, 0.022, 0.015], T['brass'], n=8, per=4, up=tuple(up), bn=bn, transform=M)
        C.ellipsoid('Brass pincer ball tip %s %s' % (s, tag), tuple(tip + Tn * 0.004), (0.017, 0.017, 0.017), T['brass'], bn, n=8, r=5, transform=M)

# ================= the yanked-out power cord and plug =================
C.sweep('Yanked-out rubber power cord', None, [RG.CORD_R, RG.CORD_R], T['rubber'], n=8, path=list(RG.CORD_PATH), up=(1, 0, 0), bn='cord_1', weights=cord_w)
Pp = RG.CORD_PATH[-1]; Tp = RG.PLUG_T; Mp = C.frame(Tp, (0, -1, 0), Pp + Tp * 0.03)
C.box('Brass two-prong plug', Mp.translation, (0.05, 0.065, 0.036), T['brass'], 'plug', bevel=0.006, segments=1, rot=Mp.to_euler())
for k in (-1, 1):
    Q = Pp + Tp * 0.08 + Mp.col[0].xyz * k * 0.012
    C.box('Steel plug prong %+d' % k, Q, (0.008, 0.036, 0.013), T['steel'], 'plug', bevel=0, rot=Mp.to_euler())

# ================= defeat effects: sparks and smoke (bound collapsed, opened by bone scale) =================
SPARK_PIVOT = V(0, 0.10, 0.55); BS = collapse(SPARK_PIVOT, 0.04)
SPARKS = [((0.26, 0.30, 0.72), 0.085, 'spark_yellow'), ((-0.28, 0.28, 0.66), 0.078, 'spark_white'), ((0.36, 0.12, 0.50), 0.07, 'spark_orange'),
          ((-0.36, 0.10, 0.46), 0.084, 'spark_yellow'), ((0.14, 0.36, 0.40), 0.064, 'spark_white'), ((-0.12, 0.34, 0.30), 0.07, 'spark_orange'),
          ((0.30, -0.10, 0.82), 0.064, 'spark_white'), ((-0.26, -0.12, 0.84), 0.07, 'spark_yellow')]
for i, (pos, r, key) in enumerate(SPARKS):
    pos = V(*pos); out = (pos - SPARK_PIVOT).normalized()
    star = []
    for k in range(8):
        a = math.pi / 2 + math.tau * k / 8 + 0.3 * i; rr_ = r if k % 2 == 0 else r * 0.32
        star.append((rr_ * math.cos(a), rr_ * math.sin(a)))
    C.prism('Glowing defeat spark %d' % i, star, 0.006, T[key], 'sparks', GLOW, M=BS @ C.frame(out, (0, 0, 1), SPARK_PIVOT + (pos - SPARK_PIVOT) * 1.12))
SMOKE_PIVOT = V(0, 0, 0.93); BK = collapse(SMOKE_PIVOT, 0.04)
SMOKE = [('smoke_a', (0.03, 0.0, 1.09), (0.065, 0.06, 0.055), 'smoke_light'), ('smoke_a', (-0.05, 0.02, 1.19), (0.08, 0.07, 0.065), 'smoke_mid'),
         ('smoke_b', (0.06, -0.02, 1.31), (0.09, 0.08, 0.075), 'smoke_light'), ('smoke_b', (-0.03, 0.0, 1.43), (0.075, 0.07, 0.065), 'smoke_mid')]
for i, (bn, pos, sz, key) in enumerate(SMOKE):
    C.ellipsoid('Grey defeat smoke puff %d' % i, pos, sz, T[key], bn, n=12, r=7, transform=BK)

# ================= join one skin, build the rig =================
for ob in C.PARTS:
    if ob.name.endswith('.001'): ob.name = ob.name[:-4]
sources = bpy.data.collections.new('EDITABLE original lab robot parts - excluded from export'); sc.collection.children.link(sources)
inventory = []; copies = []
for pi, ob in enumerate(C.PARTS):
    at = ob.data.attributes.new('lr_part', 'INT', 'FACE'); at.data.foreach_set('value', [pi] * len(ob.data.polygons))
for ob in C.PARTS:
    ob.data.calc_loop_triangles(); inventory.append({'name': ob.name, 'triangles': len(ob.data.loop_triangles), 'bone_groups': [g.name for g in ob.vertex_groups], 'atlas_tile': ob.get('atlas_tile'), 'material': ob.data.materials[0].name})
    cp = ob.copy(); cp.data = ob.data.copy(); sc.collection.objects.link(cp); copies.append(cp)
    for col in list(ob.users_collection): col.objects.unlink(ob)
    sources.objects.link(ob)
sources.hide_render = True; sources.hide_viewport = True
bpy.ops.object.select_all(action='DESELECT')
for ob in copies: ob.select_set(True)
bpy.context.view_layer.objects.active = copies[0]; bpy.ops.object.join(); skin = bpy.context.object; skin.name = 'Lab_Robot_Skin'
for tag in ['source_part', 'rigid_weight', 'atlas_tile']:
    if tag in skin: del skin[tag]
skin.data.calc_loop_triangles(); tris = len(skin.data.loop_triangles)
REST = RG.rest_bones()
data = bpy.data.armatures.new('Original lab robot rig'); arm = bpy.data.objects.new('Lab_Robot_Rig', data); sc.collection.objects.link(arm)
skin.select_set(False); arm.select_set(True); bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='EDIT')
for name, (h, t, parent, roll, deform) in REST.items():
    b = data.edit_bones.new(name); b.head = h; b.tail = t
    if roll is not None: b.align_roll(roll)
    if parent: b.parent = data.edit_bones[parent]; b.use_connect = False
    b.use_deform = deform
bpy.ops.object.mode_set(mode='OBJECT'); mod = skin.modifiers.new('Attached painted skin', 'ARMATURE'); mod.object = arm; skin.parent = arm
missing = sorted({g.name for g in skin.vertex_groups} - set(REST))
assert not missing, missing
nondeform = sorted({g.name for g in skin.vertex_groups} & {n for n, r in REST.items() if not r[4]})
assert not nondeform, ('weights on non-deforming bones', nondeform)
pts = [v.co for v in skin.data.vertices]
lo = [min(p[k] for p in pts) for k in range(3)]; hi = [max(p[k] for p in pts) for k in range(3)]
arm['asset_id'] = 'lab-robot'; arm['version'] = 'v001'; arm['forward'] = 'Blender +Y / glTF -Z'; arm['neutral_total_height_m'] = round(hi[2], 4); arm['attack_contact_fraction'] = .625
mats = {}
for poly in skin.data.polygons: mats[poly.material_index] = mats.get(poly.material_index, 0) + 1
record = {'asset_id': 'lab-robot', 'version': 'v001', 'work_order': 'WO111',
          'authoring_model': 'claude-opus-5-5 xhigh (Claude Code subagent; Tom ruled Sept 26 that Claude Opus 5.5 does the WO111 Blender work)', 'blender_version': bpy.app.version_string,
          'source_reference': 'Blender reference sheet, no generated concept', 'source_sheet_sha256': sc['source_sheet_sha256'], 'source_blockout_sha256': sc['source_blockout_sha256'],
          'rest_bounds_blender_z_up': {'min': lo, 'max': hi}, 'height_m': hi[2], 'triangles': tris, 'vertices': len(skin.data.vertices), 'material_count': len(skin.data.materials),
          'materials': [m.name for m in skin.data.materials], 'faces_per_material': mats, 'bone_count': len(data.bones),
          'texture': {'file': 'pigment.png', 'width': 1024, 'height': 1024, 'origin': 'Original painted atlas generated with numpy in Blender Python (paint.py): the smile, iris, panel, seam-rivet, kick-plate, hazard-ring, hubcap, dial, warning-light, head-interior and button regions plus flat sheet-colour and glow tiles; no external textures. The glow material uses the same atlas as its emission texture.', 'layout': atlas},
          'glow_parts': [r['name'] for r in inventory if r['material'].startswith('Glowing')],
          'parts': inventory}
(ROOT / 'construction.json').write_text(json.dumps(record, indent=2) + '\n')
rest_json = {k: [list(map(float, h)), list(map(float, t)), p] for k, (h, t, p, r, dfm) in REST.items()}
(ROOT / 'source/rig-rest.json').write_text(json.dumps({'rest': rest_json}, indent=2) + '\n')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'lab-robot-construction.blend'), compress=True)
bpy.ops.object.select_all(action='DESELECT'); skin.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=str(ROOT / 'lab-robot-checkpoint.glb'), export_format='GLB', use_selection=True, export_animations=False, export_skins=True, export_yup=True, export_apply=False,
                          export_armature_object_remove=True, export_texcoords=True, export_normals=True, export_materials='EXPORT', export_cameras=False, export_lights=False, export_extras=True)
big = sorted(inventory, key=lambda r: -r['triangles'])
print(json.dumps({'triangles': tris, 'vertices': len(skin.data.vertices), 'height_m': hi[2], 'bounds': [lo, hi], 'bones': len(data.bones), 'faces_per_material': mats,
                  'largest': [(r['name'], r['triangles']) for r in big[:24]]}))
