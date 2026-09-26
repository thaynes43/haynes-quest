"""WO111 toon-clubhouse-kit v001: five original static props for World A chapter 1 ('clubhouse' theme).

Follows the Codex Astra concept draft (concept-draft.png: tower, curly slide, gadget stand, rounded hedges, dance
marker) at the sizes of the theme-kit registry boxes in src/shared/theme-kits.ts on origin/main, which every prop
must stay inside so placed decor keeps out of movement lanes. Blender +Z up, front toward -Y (glTF +Z), origin at
the floor centre. One GLB per registry id, one mesh each, <= 3 materials, vertex colour only.
Run through run.py after claim.py (instance 1). Globals: EXPORT (default True).
"""
import bpy, math, json, hashlib, datetime
from pathlib import Path
from mathutils import Vector, Matrix
import kit_common as K

ROOT = Path('/workspace/haynes-quest/family-eras/toon-clubhouse-kit/v001')
OWNER = 'claude-opus-5-5/toon-clubhouse-kit-props'
EXPORT = globals().get('EXPORT', True)
sc = bpy.context.scene
assert sc.get('work_order') == 'WO111' and sc.get('asset_id') == 'toon-clubhouse-kit' and sc.get('scene_lease') == 'active' and sc.get('scene_owner') == OWNER

PAL = {  # sRGB; teal / ochre / plum / cream follow the chapter's cat captain and gadget helper
    'cream': '#f1e4c4', 'light': '#f7eedb', 'stone': '#e4d3ae', 'teal': '#3b8784', 'deepteal': '#2c6866',
    'glass': '#285e60', 'ochre': '#e3a53c', 'plum': '#76506a', 'moss': '#639436', 'leaf': '#bec94f',
    'soil': '#5e4332', 'slot': '#4b3a42',
}
REGISTRY = {  # origin/main src/shared/theme-kits.ts box(halfX, height, halfZ) in glTF metres
    'clubhouse-tower-facade': (2.2, 6.5, 0.6), 'curly-slide': (1.2, 3.2, 1.2), 'gadget-toolbox-stand': (0.6, 1.3, 0.45),
    'rounded-hedge': (1.1, 1.2, 0.6), 'stage-marker': (0.9, 0.35, 0.9),
}
M_YZ_X = Matrix(((0, 0, 1, 0), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))    # local (u, v, w) -> world (w, u, v)
M_XZ_Y = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))    # local (u, v, w) -> world (u, w, v)
M_XZ_NY = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))  # local (u, v, w) -> world (u, -w, v)
NOTES = {}


def mk(P, name, vf, color, **kw):
    return K.make(P, name, vf[0], vf[1], PAL[color], **kw)


# ============================================================== 1. clubhouse tower facade
def tower():
    P = 'clubhouse-tower-facade'; K.collection(P)
    CB, KB = 0.225, 0.208                      # body: elliptic section centred 0.225 m back, 0.208 depth ratio
    TILT = math.radians(10.0); PIV = 4.19; tanT = math.tan(TILT)

    def rb(z):
        z = min(max(z, 0.0), 4.6); return 1.80 - 0.095 * z + 0.05 * math.sin(math.pi * z / 4.6)

    def surf(x, z):
        r = rb(z); return CB - KB * math.sqrt(max(r * r - x * x, 1e-6))

    prof = [(rb(0) - 0.07, 0.0), (rb(0) - 0.015, 0.035), (rb(0.12), 0.12)] + [(rb(z), z) for z in (0.45, 0.95, 1.5, 2.05, 2.6, 3.15, 3.65)] + [(rb(4.0), 4.0)]
    top = lambda x, y, z: (PIV + x * tanT + 0.22) if z >= 3.99 else z   # body top follows the tilted roof, hidden inside it
    body = mk(P, 'Cream tapered tower body', K.lathe(prof, n=32, k=KB, center=(0, CB), zfun=top), 'cream', pig=1.2, ao=0.55, aod=0.35)
    K.bend_normals(body, lambda z: (0.0, CB), KB, 0.62)

    # Droopy teal cone roof: elliptic (k 0.275) so the brim stays inside the 1.2 m registry depth, tilted 10 deg
    # (right side up, as in the concept) with a counter-lean that parks the apex just left of centre.
    rprof = [(0.0, 0.0), (1.9, 0.0), (2.08, 0.04), (2.165, 0.13), (2.15, 0.23), (2.06, 0.31), (1.88, 0.40), (1.62, 0.56),
             (1.34, 0.78), (1.08, 1.04), (0.84, 1.32), (0.62, 1.60), (0.42, 1.84), (0.23, 2.02), (0.0, 2.12)]
    X = Matrix.Translation((0, 0, PIV)) @ Matrix.Rotation(-TILT, 4, 'Y')
    rlean = lambda h: (0.22 * (max(h, 0) / 2.12) ** 1.6, 0.0)
    roof = mk(P, 'Teal droopy cone roof', K.lathe(rprof, n=30, k=0.275, lean=rlean, xform=X), 'teal', pig=1.2)
    K.bend_normals(roof, rlean, 0.275, 0.7, frame=X)

    CX, CY = -1.12, 0.02
    mk(P, 'Ochre leaning chimney', K.lathe([(0.40, 4.05), (0.40, 4.7), (0.385, 5.35), (0.37, 5.97)], n=18, k=0.75, center=(CX, CY),
                                          lean=lambda z: (-0.12 * (z - 4.05) / 1.92, 0.0)), 'ochre')
    mk(P, 'Cream chimney cap', K.slab(K.ellipse(0.47, 0.355, 14, CX - 0.12, CY), K.round_profile(5.93, 6.36, 0.05, 0.08, 2, top_scales=(0.45,))), 'light')

    # Broad two-step plum porch (D-shaped, backs hidden in the body).
    mk(P, 'Plum lower porch step', K.slab(K.d_shape(1.42, 0.60, 0.15, n=16, max_len=0.5), K.round_profile(0.0, 0.36, 0.0, 0.07, 3)), 'plum')
    mk(P, 'Plum upper porch step', K.slab(K.d_shape(1.18, 0.40, 0.15, n=16, max_len=0.5), K.round_profile(0.30, 0.72, 0.0, 0.07, 3)), 'plum')

    # Recessed arched teal door: deep-teal backing, four planks, cream half-round arch frame, ochre knob.
    DX, Z0, ZS = 0.08, 0.72, 1.72

    def arch(hw, zb, n_arc=14, n_side=3):
        pts = [Vector((DX - hw, zb)), Vector((DX + hw, zb))]
        pts += [Vector((DX + hw, zb + (ZS - zb) * i / n_side)) for i in range(1, n_side + 1)]
        pts += [Vector((DX + hw * math.cos(math.pi * i / n_arc), ZS + hw * math.sin(math.pi * i / n_arc))) for i in range(1, n_arc)]
        pts += [Vector((DX - hw, zb + (ZS - zb) * i / n_side)) for i in range(n_side, 0, -1)]
        return pts
    mk(P, 'Deep teal door backing', K.surface_plate(arch(0.62, Z0), surf, 0.02, 0.04, rings=(1.0, 0.66, 0.33), center=(DX, 1.45)), 'deepteal', ao=0.8)
    pw = (1.14 - 3 * 0.035) / 4
    for i in range(4):
        x0 = DX - 0.57 + i * (pw + 0.035); x1 = x0 + pw
        zt = lambda x: ZS + math.sqrt(max(0.57 ** 2 - (x - DX) ** 2, 0.0)) - 0.02
        out = [Vector((x0, Z0 + 0.02)), Vector((x1, Z0 + 0.02))] + [Vector((x1, Z0 + 0.02 + (zt(x1) - Z0 - 0.02) * j / 3)) for j in (1, 2, 3)]
        out += [Vector((x1 + (x0 - x1) * j / 5, zt(x1 + (x0 - x1) * j / 5))) for j in range(1, 5)]
        out += [Vector((x0, Z0 + 0.02 + (zt(x0) - Z0 - 0.02) * j / 3)) for j in (3, 2, 1)]
        mk(P, f'Teal door plank {i + 1}', K.surface_plate(out, surf, 0.048, 0.0, rings=(1.0, 0.5)), 'teal', sharp=40)
    fr = 0.78; zb = Z0 - 0.06
    path = [(DX - fr, zb + (ZS - zb) * i / 3) for i in range(4)]
    path += [(DX + fr * math.cos(math.pi - math.pi * i / 13), ZS + fr * math.sin(math.pi - math.pi * i / 13)) for i in range(1, 13)]
    path += [(DX + fr, zb + (ZS - zb) * i / 3) for i in range(3, -1, -1)]
    sec = [(-0.16, -0.04), (-0.16, 0.0), (-0.12, 0.066), (0.0, 0.095), (0.12, 0.066), (0.16, 0.0), (0.16, -0.04)]
    mk(P, 'Cream half-round door arch frame', K.surface_sweep(path, sec, surf), 'light')
    mk(P, 'Ochre door knob', K.surface_pillow(DX + 0.36, 1.26, 0.095, 0.095, 0.075, lambda x, z: surf(x, z) - 0.045, n=12, exp=2.0), 'ochre', mat='satin', ao=0.5, occ=False)

    # Round ochre-framed window with a cross, tucked under the raised right side of the brim.
    WX, WZ = 0.80, 3.42
    mk(P, 'Deep teal window glass', K.surface_plate(K.ellipse(0.43, 0.43, 20, WX, WZ), surf, 0.02, 0.04, rings=(1.0, 0.55), center=(WX, WZ)), 'glass', mat='satin', ao=0.8)
    ring = [(WX + 0.47 * math.cos(math.tau * i / 22), WZ + 0.47 * math.sin(math.tau * i / 22)) for i in range(22)]
    mk(P, 'Ochre round window frame', K.surface_sweep(ring, [(-0.065, -0.03), (-0.065, 0.0), (-0.04, 0.055), (0.0, 0.07), (0.04, 0.055), (0.065, 0.0)], surf, closed_path=True), 'ochre')
    msec = [(-0.032, -0.03), (-0.032, 0.0), (-0.02, 0.045), (0.0, 0.056), (0.02, 0.045), (0.032, 0.0), (0.032, -0.03)]
    mk(P, 'Ochre window mullion horizontal', K.surface_sweep([(WX - 0.46 + 0.92 * i / 5, WZ) for i in range(6)], msec, surf), 'ochre')
    mk(P, 'Ochre window mullion vertical', K.surface_sweep([(WX, WZ - 0.46 + 0.92 * i / 5) for i in range(6)], msec, surf), 'ochre')

    for i, (x, z) in enumerate([(-1.02, 3.2), (-1.26, 1.95), (1.36, 1.72)]):
        mk(P, f'Cream wall stone {i + 1}', K.surface_pillow(x, z, 0.19, 0.17, 0.045, surf, n=10, exp=3.2), 'stone', ao=0.7, occ=False)

    bushes = [('left big', (-1.68, -0.02, 0.54), (0.48, 0.50, 0.56), 3.1), ('left small', (-1.40, -0.33, 0.26), (0.28, 0.24, 0.27), 4.7),
              ('right tall', (1.72, -0.04, 0.62), (0.42, 0.48, 0.64), 5.9), ('right small', (1.30, -0.33, 0.25), (0.27, 0.24, 0.26), 7.3)]
    B = {}
    for name, c, r, seed in bushes:
        mk(P, f'Moss bush {name}', K.blob(c, r, n=12, rings=8, amp=0.06, freq=2.6, seed=seed, zmin=0.0), 'moss', mat='foliage', pig=2.2, freq=3.2)
        B[name] = (c, r, seed)
    leaf = K.lens(0.085, 0.04, 8)
    for i, (name, d, spin) in enumerate([('left big', (-0.2, -0.9, 0.35), 0.6), ('left big', (0.35, -0.8, 0.1), -0.4),
                                        ('right tall', (0.1, -0.9, 0.4), -0.5), ('right tall', (-0.4, -0.8, -0.05), 0.7)]):
        c, r, seed = B[name]
        mk(P, f'Lime leaf mark {i + 1}', K.blob_decal(c, r, 0.06, 2.6, seed, d, leaf, spin), 'leaf', mat='foliage', ao=0.5, pig=0.6, occ=False)
    NOTES[P] = {'surface': 'elliptic body 0.208 depth ratio centred y=0.225; relief parts are projected onto it', 'roof_tilt_deg': 10.0}
    return P, 0.8


# ============================================================== 2. curly slide
def slide():
    P = 'curly-slide'; K.collection(P)
    PX, PY = -0.08, 0.08
    mk(P, 'Teal support post', K.lathe([(0.20, 0.0), (0.20, 2.70)], n=20, center=(PX, PY)), 'teal')
    mk(P, 'Cream post foot', K.slab(K.ellipse(0.30, 0.30, 20, PX, PY), K.round_profile(0.0, 0.10, 0.0, 0.035, 2)), 'cream')
    for z in (1.18, 2.14):
        mk(P, f'Cream post ring {z}', K.slab(K.ellipse(0.25, 0.25, 20, PX, PY), K.round_profile(z - 0.06, z + 0.06, 0.035, 0.035, 2)), 'light')
    mk(P, 'Cream finial collar', K.slab(K.ellipse(0.265, 0.265, 20, PX, PY), K.round_profile(2.62, 2.80, 0.045, 0.045, 2)), 'light')
    mk(P, 'Ochre ball finial', K.blob((PX, PY, 2.95), (0.24, 0.24, 0.24), n=18, rings=11, amp=0.0), 'ochre', mat='satin')

    R = 0.76; A0, A1 = 68.0, 270.0; Z0, Z1 = 2.10, 0.74
    cz = lambda a: Z0 - (Z0 - Z1) * max(0.0, (a - A0) / (A1 - A0)) ** 1.3
    helix = [(PX + R * math.cos(math.radians(a)), PY + R * math.sin(math.radians(a)), cz(a)) for a in [A0 + (A1 - A0) * i / 28 for i in range(29)]]
    arc_len = R * math.radians(A1 - A0); end_slope = (Z0 - Z1) * 1.3 / arc_len
    p0 = Vector(helix[-1]); p1 = Vector((0.58, -0.82, 0.32))
    b0 = p0.xy; b1 = p0.xy + Vector((0.30, 0.0)); b3 = p1.xy; b2 = b3 - Vector((1.0, -0.2)).normalized() * 0.25
    run_len = 0.72; m0 = -end_slope * run_len
    runout = []
    for j in range(1, 8):
        u = j / 7
        xy = (1 - u) ** 3 * b0 + 3 * (1 - u) ** 2 * u * b1 + 3 * (1 - u) * u * u * b2 + u ** 3 * b3
        h00, h10, h01 = 2 * u ** 3 - 3 * u ** 2 + 1, u ** 3 - 2 * u ** 2 + u, -2 * u ** 3 + 3 * u ** 2
        runout.append((xy.x, xy.y, p0.z * h00 + m0 * h10 + p1.z * h01))
    path = helix + runout
    nh = len(helix)
    bank = lambda t: math.radians(9.0) * min(1.0, max(0.0, (len(path) - 1 - t * (len(path) - 1)) / (len(path) - nh)))
    sec = [(-0.26, 0.18), (-0.26, 0.07), (-0.19, 0.0), (0.19, 0.0), (0.26, 0.07), (0.26, 0.18), (0.30, 0.22), (0.355, 0.19),
           (0.355, -0.03), (0.28, -0.085), (-0.28, -0.085), (-0.355, -0.03), (-0.355, 0.19), (-0.30, 0.22)]
    mk(P, 'Ochre curly chute', K.sweep(path, sec, bank=bank), 'ochre', mat='satin', sharp=52)

    YF = [-0.28, 0.02, 0.32, 0.62, 0.90]; ZT = [0.40, 0.80, 1.20, 1.60, 2.00]; YB = 1.16
    stair = [Vector((YF[0], 0.0)), Vector((YB, 0.0)), Vector((YB, ZT[-1]))]
    for k in range(4, 0, -1): stair += [Vector((YF[k], ZT[k])), Vector((YF[k], ZT[k - 1]))]
    stair.append(Vector((YF[0], ZT[0])))
    mk(P, 'Cream stair block', K.slab(stair, K.round_profile(0.48, 1.17, 0.035, 0.035, 2), xform=M_YZ_X), 'cream')
    for k in range(5):
        y1 = (YF[k + 1] if k < 4 else YB) - 0.03; y0 = YF[k] + 0.02
        mk(P, f'Teal step cushion {k + 1}', K.slab(K.rrect(0.60, y1 - y0, 0.06, 3, cx=0.83, cy=(y0 + y1) / 2), K.round_profile(ZT[k] - 0.02, ZT[k] + 0.065, 0.0, 0.03, 2)), 'teal')
    left_top = [(0.82, 2.07), (0.66, 2.1), (0.44, 1.87), (0.20, 1.53), (-0.04, 1.15), (-0.22, 0.81), (-0.33, 0.56), (-0.36, 0.40)]
    lp = [Vector((-0.36, 0.0)), Vector((0.82, 0.0))] + [Vector(p) for p in left_top]
    mk(P, 'Cream left stair panel', K.slab(lp, K.round_profile(0.36, 0.48, 0.03, 0.03, 2), xform=M_YZ_X), 'cream')
    mk(P, 'Ochre panel knob', K.blob((0.345, 0.40, 0.98), (0.045, 0.11, 0.11), n=12, rings=7, amp=0.0), 'ochre', mat='satin', ao=0.5)
    mk(P, 'Cream start deck', K.slab(K.rrect(0.56, 0.62, 0.12, 3, cx=0.22, cy=0.83), K.round_profile(1.88, 2.0, 0.02, 0.03, 2)), 'cream')
    mk(P, 'Cream flared landing', K.slab(K.rrect(0.82, 0.72, 0.22, 4, cx=0.57, cy=-0.82), K.round_profile(0.0, 0.26, 0.0, 0.06, 3, top_scales=(0.6,))), 'cream')
    for name, a in (('back-left', 160.0), ('front-left', 232.0)):
        x = PX + (R + 0.03) * math.cos(math.radians(a)); y = PY + (R + 0.03) * math.sin(math.radians(a)); zt = cz(a) - 0.07
        mk(P, f'Teal chute leg {name}', K.lathe([(0.09, 0.0), (0.09, zt)], n=12, center=(x, y)), 'teal')
        mk(P, f'Cream leg foot {name}', K.slab(K.ellipse(0.15, 0.15, 12, x, y), K.round_profile(0.0, 0.07, 0.0, 0.025, 2)), 'cream')
    for a in (120.0, 205.0):
        c, s = math.cos(math.radians(a)), math.sin(math.radians(a)); z = cz(a) - 0.04
        mk(P, f'Teal chute bracket {int(a)}', K.tube([(PX + 0.12 * c, PY + 0.12 * s, z), (PX + 0.48 * c, PY + 0.48 * s, z)], 0.05, n=10), 'teal')
    NOTES[P] = {'chute': f'half-spiral {A1 - A0:.0f} deg around the post at R {R} m, floor {Z0} -> {Z1} m, then a {run_len} m runout to 0.32 m on the landing',
                'bank_deg': 9.0}
    return P, 0.5


# ============================================================== 3. gadget toolbox stand
def stand():
    P = 'gadget-toolbox-stand'; K.collection(P)
    foot = [Vector(p) for p in ((0.18, 0.0), (0.585, 0.0), (0.545, 0.2), (0.47, 0.385), (0.245, 0.385), (0.205, 0.2))]
    for side, pts in (('right', foot), ('left', [Vector((-p.x, p.y)) for p in reversed(foot)])):
        mk(P, f'Plum broad foot {side}', K.slab(pts, K.round_profile(-0.36, 0.36, 0.045, 0.045, 3), xform=M_XZ_Y), 'plum')
    mk(P, 'Cream bench body', K.slab(K.rrect(1.0, 0.6, 0.08, 4, max_len=0.25), K.round_profile(0.34, 0.87, 0.04, 0.04, 2)), 'cream')
    # Thick teal tabletop with a truly recessed wrench slot: one closed loft from the rounded outer rim over the top,
    # down the rounded inner lip to the slot floor (outer and inner outlines share corresponding points).
    outer = K.rrect(1.19, 0.84, 0.16, 5); inner = K.rrect(0.94, 0.32, 0.10, 5, cy=0.03)
    No = K.outline_normals(outer); Ni = K.outline_normals(inner)
    def ring(pts, nn, d, z): return [Vector((p.x + q.x * d, p.y + q.y * d, z)) for p, q in zip(pts, nn)]
    rings = [ring(outer, No, d, z) for d, z in K.round_profile(0.85, 1.0, 0.05, 0.06, 3)]
    o_top = ring(outer, No, -0.06, 1.0); i_top = ring(inner, Ni, 0.035, 1.0)
    rings.append([a.lerp(b, 0.5) for a, b in zip(o_top, i_top)])
    rings += [i_top, ring(inner, Ni, 0.012, 0.993), ring(inner, Ni, 0.0, 0.975), ring(inner, Ni, 0.0, 0.93)]
    ci = sum(inner, Vector((0, 0))) / len(inner)
    rings.append([Vector((ci.x + (p.x - ci.x) * 0.55, ci.y + (p.y - ci.y) * 0.55, 0.93)) for p in inner])
    mk(P, 'Teal rounded tabletop with recessed slot', K.loft(rings, True, True, True), 'teal')
    mk(P, 'Dark wrench slot floor', K.slab(K.rrect(0.935, 0.315, 0.095, 5, cy=0.03), K.round_profile(0.928, 0.95, 0.0, 0.0, 1, top_scales=(0.6,))), 'slot', ao=0.7)
    WY = 0.03; hx = -0.32; HR = 0.10
    head = [Vector((hx + HR * math.cos(math.radians(210 + 300 * i / 14)), WY + HR * math.sin(math.radians(210 + 300 * i / 14)))) for i in range(15)]
    head += [Vector((hx - 0.015, WY + 0.036)), Vector((hx - 0.015, WY - 0.036))]
    mk(P, 'Cream open wrench head', K.slab(head, K.round_profile(0.95, 1.0, 0.0, 0.014, 2)), 'light')
    handle = [p + Vector((0.05, WY)) for p in K.capsule(0.60, 0.085, 6)]
    mk(P, 'Teal wrench handle', K.slab(handle, K.round_profile(0.95, 1.008, 0.0, 0.03, 3)), 'teal')
    band = K.rrect(0.075, 0.108, 0.032, 3, cx=0.22, cy=WY)
    mk(P, 'Ochre wrench grip band', K.slab(band, K.round_profile(0.948, 1.016, 0.0, 0.022, 2)), 'ochre', mat='satin')
    mk(P, 'Ochre drawer front', K.slab(K.rrect(0.72, 0.27, 0.05, 3, cy=0.60), K.round_profile(0.285, 0.345, 0.0, 0.02, 2, top_scales=(0.7,)), xform=M_XZ_NY), 'ochre')
    mk(P, 'Ochre drawer knob', K.blob((0.0, -0.385, 0.60), (0.07, 0.055, 0.07), n=14, rings=8, amp=0.0), 'ochre', mat='satin', ao=0.5)
    NOTES[P] = {'height_note': 'waist-high bench at the registry width: 1.19 m wide, so about 1.02 m tall keeps the concept proportions (the registry allows 1.3 m)'}
    return P, 0.28


# ============================================================== 4. rounded hedge
def hedge():
    P = 'rounded-hedge'; K.collection(P)
    mk(P, 'Teal bed rim', K.slab(K.capsule(2.16, 0.92, 10, max_len=0.25), K.round_profile(0.0, 0.10, 0.0, 0.035, 2)), 'teal')
    mk(P, 'Dark soil bed', K.slab(K.capsule(2.0, 0.78, 10, max_len=0.2), K.round_profile(0.05, 0.125, 0.0, 0.025, 2, top_scales=(0.8, 0.5))), 'soil', pig=2.6, freq=7.0)
    mounds = [('centre', (0.02, 0.026, 0.56), (0.56, 0.48, 0.58), 11.0), ('left', (-0.62, -0.014, 0.42), (0.44, 0.40, 0.44), 12.5),
              ('right', (0.68, 0.026, 0.36), (0.38, 0.36, 0.38), 13.7), ('small front', (-0.16, -0.334, 0.20), (0.19, 0.17, 0.18), 15.1)]
    Mo = {}
    for name, c, r, seed in mounds:
        mk(P, f'Moss hedge mound {name}', K.blob(c, r, n=20, rings=12, amp=0.06, freq=2.4, seed=seed, zmin=0.1), 'moss', mat='foliage', pig=2.2, freq=3.0)
        Mo[name] = (c, r, seed)
    big = K.lens(0.095, 0.042, 8); small = K.lens(0.07, 0.032, 8)
    leaves = [('centre', (-0.35, -0.8, 0.45), 0.5), ('centre', (0.3, -0.85, 0.35), -0.6), ('centre', (0.05, -0.6, 0.8), 1.1),
              ('centre', (-0.62, -0.55, 0.12), -0.3), ('centre', (0.6, -0.7, -0.02), 0.4), ('centre', (0.25, 0.85, 0.4), 0.3), ('centre', (-0.4, 0.8, 0.2), -0.7),
              ('left', (-0.3, -0.85, 0.3), 0.8), ('left', (0.2, -0.8, 0.55), -0.2), ('left', (-0.75, -0.4, 0.35), 0.1), ('left', (-0.2, 0.85, 0.4), 0.6),
              ('right', (0.2, -0.85, 0.3), -0.8), ('right', (-0.3, -0.8, 0.55), 0.3), ('right', (0.7, -0.45, 0.2), -0.1), ('right', (0.3, 0.85, 0.3), -0.5),
              ('small front', (0.1, -0.8, 0.5), 0.4)]
    for i, (name, d, spin) in enumerate(leaves):
        c, r, seed = Mo[name]
        mk(P, f'Lime leaf mark {i + 1}', K.blob_decal(c, r, 0.06, 2.4, seed, d, small if name == 'small front' else big, spin), 'leaf', mat='foliage', ao=0.5, pig=0.6, occ=False)
    NOTES[P] = {'mounds': [m[0] for m in mounds], 'leaf_marks': len(leaves)}
    return P, 0.4


# ============================================================== 5. stage marker (dance dais)
def marker():
    P = 'stage-marker'; K.collection(P)
    out = K.capsule(1.78, 0.90, 16, max_len=0.18)
    rim = [(-0.11, 0.02), (-0.11, 0.2), (-0.10, 0.235), (-0.075, 0.258), (-0.04, 0.262), (-0.012, 0.247), (0.0, 0.215), (0.0, 0.03),
           (-0.012, 0.004), (-0.035, 0.0), (-0.09, 0.0), (-0.105, 0.006)]
    mk(P, 'Teal thick capsule rim', K.ring_sweep(out, rim), 'teal')
    mk(P, 'Cream dance top', K.slab(K.capsule(1.58, 0.70, 16, max_len=0.16), [(0.012, 0.01), (0.012, 0.232), ('S', 0.82, 0.232), ('S', 0.55, 0.232), ('S', 0.3, 0.232)]), 'cream')
    # 2.5 gentle waves: amplitude 0.055 m over a 0.344 m wavelength keeps the tightest bend radius (0.055 m) above the
    # stroke half-width (0.045 m), so the swept section never folds over itself.
    pts = [(-0.66 + 0.86 * i / 48, 0.055 * math.sin(math.tau * 2.5 * i / 48 + 0.4) - 0.015, 0.232) for i in range(49)]
    taper = lambda t: min(1.0, 0.3 + 0.7 * math.sqrt(max(0.0, t / 0.05)), 0.3 + 0.7 * math.sqrt(max(0.0, (1 - t) / 0.05)))
    mk(P, 'Ochre mustard squiggle', K.sweep(pts, [(-0.045, -0.008), (-0.045, 0.004), (-0.031, 0.015), (0.0, 0.02), (0.031, 0.015), (0.045, 0.004), (0.045, -0.008)], scale=taper), 'ochre', mat='satin', ao=0.4, occ=False)
    for i, (fx, fy) in enumerate(((0.40, -0.03), (0.585, 0.03))):
        rot = Matrix.Rotation(0.38, 2)
        sole = [rot @ (p + Vector((0.0, 0.07))) + Vector((fx, fy)) for p in K.ellipse(0.064, 0.118, 14)]
        heel = [rot @ (p + Vector((0.0, -0.115))) + Vector((fx, fy)) for p in K.ellipse(0.048, 0.048, 12)]
        mk(P, f'Plum footprint sole {i + 1}', K.slab(sole, K.round_profile(0.226, 0.245, 0.0, 0.007, 1)), 'plum', ao=0.4, occ=False)
        mk(P, f'Plum footprint heel {i + 1}', K.slab(heel, K.round_profile(0.226, 0.245, 0.0, 0.007, 1)), 'plum', ao=0.4, occ=False)
    NOTES[P] = {'hot_dog_read': 'capsule bun-shaped dais with a mustard squiggle and two goofy dance footprints; no text, logo or character'}
    return P, 0.14


# ============================================================== assemble, paint, join, measure, export
K.reset_scene()
for key in list(sc.keys()):
    if not (key.startswith('blendermcp_') or key.startswith('cycles') or key in ('work_order', 'scene_owner', 'scene_lease', 'asset_id', 'asset_version', 'authoring_model', 'candidate_status')):
        del sc[key]
built = [tower(), slide(), stand(), hedge(), marker()]
paint_stats = {P: K.paint(P, dist) for P, dist in built}
export_coll = bpy.data.collections.new('EXPORT | one joined mesh per prop'); sc.collection.children.link(export_coll)
concept = ROOT / 'inputs' / 'concept-draft.png'
concept_sha = hashlib.sha256(concept.read_bytes()).hexdigest() if concept.exists() else 'missing'
records = {}
for P, _ in built:
    ob = K.join_prop(P, export_coll)
    ob['prop_id'] = P; ob['theme'] = 'clubhouse'
    m = K.measure(ob)
    hx, h, hz = REGISTRY[P]
    fits = {'x': m['gltf_min'][0] >= -hx - 1e-6 and m['gltf_max'][0] <= hx + 1e-6, 'y': m['gltf_min'][1] >= -1e-6 and m['gltf_max'][1] <= h + 1e-6,
            'z': m['gltf_min'][2] >= -hz - 1e-6 and m['gltf_max'][2] <= hz + 1e-6}
    m['registry_box_gltf'] = {'min': [-hx, 0.0, -hz], 'max': [hx, h, hz]}
    m['inside_registry_box'] = fits
    m['registry_fill'] = {'width': round((m['gltf_max'][0] - m['gltf_min'][0]) / (2 * hx), 3), 'height': round(m['gltf_max'][1] / h, 3),
                          'depth': round((m['gltf_max'][2] - m['gltf_min'][2]) / (2 * hz), 3)}
    m['parts'] = [{'name': p['ob'].name, 'color': p['color'], 'material': K.MAT_SPECS[p['mat']][0], 'occlusion_strength': p['ao'],
                   'triangles': (p['ob'].data.calc_loop_triangles() or len(p['ob'].data.loop_triangles))} for p in K.PARTS if p['prop'] == P]
    m['occlusion'] = paint_stats[P]; m['notes'] = NOTES.get(P, {})
    records[P] = m
for c in K.COLLS.values(): c.hide_render = True
sc['candidate_status'] = "WO111 toon-clubhouse-kit v001 · Awaiting Tom's review · used in the family release"
if EXPORT:
    for P, _ in built:
        ob = bpy.data.objects[P]
        extras = {'work_order': 'WO111', 'asset_id': 'toon-clubhouse-kit', 'asset_version': 'v001', 'prop_id': P, 'theme': 'clubhouse',
                  'candidate_status': "WO111 toon-clubhouse-kit v001 · Awaiting Tom's review · used in the family release",
                  'orientation': 'glTF +Y up; visible front toward +Z (theme-kit registry rotation 0); origin at the floor centre',
                  'source_concept_sha256': concept_sha}
        K.export_glb(ob, ROOT / f'{P}.glb', extras)
        data = (ROOT / f'{P}.glb').read_bytes()
        records[P]['glb'] = {'file': f'{P}.glb', 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'toon-clubhouse-kit.blend'), compress=True)
record = {'work_order': 'WO111', 'asset_id': 'toon-clubhouse-kit', 'version': 'v001', 'blender_version': bpy.app.version_string,
          'built_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'authoring_model': 'claude-opus-5-5 xhigh',
          'source_concept': {'file': 'inputs/concept-draft.png', 'sha256': concept_sha, 'author': 'Codex GPT-6 Astra (WO111 driving lead), draft'},
          'axes': 'Blender +Z up, front -Y; glTF +Y up, front +Z; floor-centred origin', 'palette_srgb': PAL, 'materials': {k: {'name': v[0], 'roughness': v[1]} for k, v in K.MAT_SPECS.items()},
          'props': records}
(ROOT / 'construction.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps({P: {'tris': r['triangles'], 'size': r['size_m'], 'fits': r['inside_registry_box'], 'fill': r['registry_fill'], 'bytes': r.get('glb', {}).get('bytes'),
                      'mats': len(r['materials'])} for P, r in records.items()}, indent=1))
