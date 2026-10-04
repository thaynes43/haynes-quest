"""mischief-kitten-skater v001: build the original lilac skater kitten from the coordinator concept (row 2).

A lilac tabby kitten with darker purple stripes, a cream chest and muzzle, big amber eyes with a dark
lash line and naughty arched brows, a smirking open mouth with two tiny fangs, tall ears with pink insides
and white tufts, a plum mini stovepipe with a raspberry band tilted toward its left ear, a raspberry collar
with a gold bell, an arched striped tail, and teal roller skates (cream wheels, dark raspberry plates and
toe stops) on all four feet. Modelled geometry on one painted 8 x 8 atlas; runs inside Blender instance 1.
"""
import bpy, json, math, importlib.util
from pathlib import Path
from mathutils import Vector, Matrix, Euler, Quaternion
SRC = Path('/workspace/haynes-quest/action-worlds/minions-a/v001/source')
def load(name):
    spec = importlib.util.spec_from_file_location('mna_' + name, SRC / (name + '.py')); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
C = load('common'); KR = load('kitten_rig')
V = C.V; MATTE, GLOSS = C.MATTE, C.GLOSS
ASSET = 'mischief-kitten-skater'; ROOT = C.PACK / ASSET
C.guard(ASSET)
PALETTE = [
    ('lilac', '#B89CD4', .03, .10), ('stripe', '#8A6AAE', .03, .06), ('cream', '#F3EAF0', .02, .05), ('ear_pink', '#EE9CB2', .03, .06),
    ('nose', '#E7889E', .02, .05), ('sclera', '#F8ECC6', .01, .05), ('iris', '#E5961F', .02, .18), ('pupil', '#181316', .0, .0),
    ('highlight', '#FFFFFF', .0, .0), ('lash', '#2A1D2D', .02, .0), ('mouth', '#5B1E34', .02, .0), ('tongue', '#EC7C95', .02, .05),
    ('fang', '#FFFDF8', .0, .0), ('hat', '#4A2349', .03, .08), ('hat_band', '#C93A6B', .02, .05), ('collar', '#C81F5E', .03, .06),
    ('bell', '#E2A630', .02, .2), ('bell_dark', '#6E4310', .02, .0), ('skate', '#2C7F80', .03, .10), ('skate_dark', '#1E5E5F', .03, .05),
    ('wheel', '#EEE3C7', .02, .06), ('hub', '#5E2A3B', .02, .0), ('plate', '#6C2638', .03, .04), ('lace', '#F2E8D3', .01, .0),
    ('whisker', '#2B2231', .0, .0), ('lilac_shade', '#A589C2', .03, .06)]
C.setup(ROOT, PALETTE, 'mischief kitten skater painted clay atlas', seed=11)
def M(origin, rot=(0, 0, 0)): return Matrix.Translation(origin) @ Euler(rot).to_matrix().to_4x4()

# ================= torso, chest, neck =================
SN = V(0, .94, .34).normalized(); BANDS = [-.29 + .047 * k for k in range(9)]
def torso_tile(c, n):
    if n.z < -.42 or (c.y > .13 and n.y > .45 and c.z < .5): return 'cream'
    if n.z > -.25 and c.y < .1:
        d = c.dot(SN)
        for k in range(len(BANDS) - 1):
            if BANDS[k] <= d < BANDS[k + 1]: return 'stripe' if k % 2 == 1 else None
    return None
def torso_w(p):
    s = C.smooth((p.y + .14) / .26); return {'hips': 1 - s, 'chest': s}
C.ellipsoid('striped torso', KR.TORSO_C, KR.TORSO_R, 'lilac', None, n=22, r=12, weights=torso_w, face_tile=torso_tile, planes=[(SN * d, SN) for d in BANDS])
C.ellipsoid('cream chest fluff', V(0, .17, .41), (.128, .09, .125), 'cream', 'chest', n=16, r=9)
C.lathe('neck', V(0, .15, .44), [(0, .115), (.07, .118), (.14, .12)], 'lilac', 'neck', n=16, caps=False)
# ================= head =================
HSTRIPES = [-.075, -.048, -.016, .016, .048, .075]
def head_tile(c, n):
    rel = c - KR.HEAD_C
    if rel.y > .09 and rel.z < -.07 and abs(rel.x) < .17: return 'cream'           # lower face around the muzzle
    if rel.y < -.07 and rel.z > -.06 and abs(rel.x) < .2:                             # back-of-head stripes
        k = int((rel.z + .06) // .04)
        return 'stripe' if k % 2 == 1 and k < 7 else None
    if rel.z > .1 and rel.y < .17:                                                    # forehead / crown stripes
        for k in range(len(HSTRIPES) - 1):
            if HSTRIPES[k] <= c.x < HSTRIPES[k + 1] and k % 2 == 0 and rel.y > -.12: return 'stripe'
    return None
C.ellipsoid('head', KR.HEAD_C, KR.HEAD_R, 'lilac', 'head', n=28, r=14, face_tile=head_tile, planes=[(V(x, 0, 0), V(1, 0, 0)) for x in HSTRIPES] + [(V(0, 0, KR.HEAD_C.z - .06 + .04 * k), V(0, 0, 1)) for k in range(1, 8)])
for s in (-1, 1):
    C.ellipsoid('cheek fluff %+d' % s, V(s * .2, .29, .69), (.115, .1, .088), 'lilac', 'head', n=16, r=8,
                face_tile=lambda c, n: 'cream' if (n.z < -.35 and n.y > .2) else None)
    for k in range(3):
        C.ellipsoid('cheek tuft %+d%d' % (s, k), V(s * (.3 + .01 * k), .26 - .035 * k, .7 - .028 * k), (.042, .03, .022), 'lilac', 'head', n=10, r=5, rot=(0, s * math.radians(35 + 12 * k), 0))
C.ellipsoid('muzzle', V(0, .395, .705), (.126, .08, .078), 'cream', 'head', n=16, r=9)
C.ellipsoid('chin', V(0, .37, .635), (.075, .058, .048), 'cream', 'head', n=12, r=6)
C.ellipsoid('nose', V(0, .47, .745), (.028, .016, .018), 'nose', 'head', n=12, r=6, mat=GLOSS)
mouth = [(-.042, .0), (-.02, -.006), (0, -.004), (.02, -.006), (.045, .01), (.044, -.012), (.03, -.034), (.008, -.048), (-.016, -.046), (-.034, -.03)]
C.plate('open smirk', mouth, .02, 'mouth', 'jaw', bevel=.004, transform=Matrix.Translation(KR.MOUTH_TOP + V(0, -.008, 0)))
tongue = [(-.004 + .026 * math.cos(math.tau * i / 12), -.032 + .011 * math.sin(math.tau * i / 12)) for i in range(12)]
C.plate('tongue', tongue, .012, 'tongue', 'jaw', bevel=.003, transform=Matrix.Translation(KR.MOUTH_TOP + V(0, -.002, 0)))
for x in (-.026, .026):
    C.lathe('fang %+.3f' % x, KR.MOUTH_TOP + V(x, .004, -.004), [(0, .0075), (-.016, .0)], 'fang', 'head', n=8, caps=(True, False), mat=GLOSS)
for s in (-1, 1):
    for k in range(3):
        a = V(s * .1, .44, .718 - .013 * k); d = V(s * 1, .12 - .1 * k, .18 - .17 * k).normalized()
        pts = [a + d * .19 * i / 5 + V(0, -.012 * (i / 5) ** 2, -.01 * (i / 5) ** 2) for i in range(6)]
        C.tube('whisker %+d%d' % (s, k), pts, [.0042, .0038, .0034, .003, .0026, .002], 'whisker', 'head', n=4, caps=True)
# eyes: cream-yellow sclera, amber iris, black pupil, glint; dark lash line with an outer flick; arched brows
for s in 'RL':
    c, r = KR.EYE[s]; sg = 1 if s == 'R' else -1
    EM = KR.eye_matrix(s)
    C.ellipsoid('eye ' + s, c, r, 'sclera', 'eye_' + s, mat=GLOSS, n=18, r=9, transform=EM)
    lc = V(KR.PUPIL_LOOK.x, 0, KR.PUPIL_LOOK.z); ip, inn = KR.eye_surface(s, lc.x, lc.z)
    C.ellipsoid('iris ' + s, ip - inn * .013, (.068, .017, .076), 'iris', 'pupil_' + s, mat=GLOSS, n=14, r=7, transform=EM)
    C.ellipsoid('pupil ' + s, ip - inn * .002 + V(0, 0, -.003), (.036, .011, .053), 'pupil', 'pupil_' + s, mat=GLOSS, n=12, r=6, transform=EM)
    C.ellipsoid('glint ' + s, ip + inn * .005 + V(.017, 0, .024), (.014, .005, .015), 'highlight', 'pupil_' + s, mat=GLOSS, n=8, r=4, transform=EM)
    lash = []
    for i in range(13):
        a = math.radians(200 - 160 * i / 12) if s == 'R' else math.radians(-20 + 160 * i / 12)
        p, nn = KR.eye_surface(s, r.x * .98 * math.cos(a), r.z * .98 * math.sin(a), .004); lash.append(EM @ p)
    C.tube('lash line ' + s, lash, [.006 + .006 * math.sin(math.pi * i / 12) for i in range(13)], 'lash', 'eye_' + s, n=6)
    tip = lash[-1] if s == 'R' else lash[0]; d = V(sg * .9, -.1, .45).normalized()
    C.tube('lash flick ' + s, [tip, tip + d * .022, tip + d * .04 + V(0, 0, .008)], [.007, .005, .0015], 'lash', 'eye_' + s, n=5)
    brow = []
    for i in range(9):
        u = i / 8; x = sg * (.06 + .145 * u); z = .96 + .034 * math.sin(math.pi * (u * .85 + .1)) + (.018 * u if s == 'L' else -.002 * u)
        p, _ = KR.head_surface(x, z, .006); brow.append(p)
    C.tube('brow ' + s, brow, [.006, .009, .011, .012, .012, .011, .009, .007, .005], 'lash', 'brow_' + s, n=6)
# ears: lilac outer shell, pink inner, white tufts
for s in 'RL':
    base, ax = KR.EARS[s]; sg = 1 if s == 'R' else -1
    Y = Vector(ax).normalized(); Z = (V(sg * .3, 1, .1) - Y * V(sg * .3, 1, .1).dot(Y)).normalized(); X = Y.cross(Z)
    def ring(t, hw, ht, off=0.0):
        cc = base + Y * KR.EAR_H * t + Z * off
        return [cc + X * hw * math.cos(math.tau * j / 10) + Z * ht * math.sin(math.tau * j / 10) * (0.55 if math.sin(math.tau * j / 10) > 0 else 1) for j in range(10)]
    rr = [ring(t, .118 * (1 - t) ** .85 + .006, .038 * (1 - t) + .004) for t in (0, .15, .32, .5, .68, .84, .95)] + [ring(1, .002, .002)]
    C.rings('ear outer ' + s, rr, 'lilac', 'ear_' + s, caps=(True, True))
    ri = [ring(t, (.088 * (1 - t) ** .9 + .004), .008, .023 + .013 * (1 - t)) for t in (.06, .2, .38, .56, .72, .86)] + [ring(.93, .002, .002, .03)]
    C.rings('ear inner ' + s, ri, 'ear_pink', 'ear_' + s, caps=(True, True))
    for k, dx in enumerate((-.03, .022)):
        C.ellipsoid('ear tuft %s%d' % (s, k), base + Y * (.05 + .02 * k) + Z * .045 + X * dx, (.016, .012, .042), 'cream', 'ear_' + s, n=10, r=5,
                    rot=Quaternion(V(0, 0, 1).cross(Y).normalized() if V(0, 0, 1).cross(Y).length > 1e-6 else V(1, 0, 0), V(0, 0, 1).angle(Y)).to_euler())
# hat: plum mini stovepipe with a raspberry band
HM = M(KR.HAT_BASE, KR.HAT_TILT)
C.lathe('hat brim', V(0, 0, 0), [(-.004, 0), (-.004, .098), (.002, .106), (.01, .104), (.012, .07), (.012, 0)], 'hat', 'hat', n=20, caps=False, transform=HM)
C.lathe('hat crown', V(0, 0, 0), [(.008, .068), (.12, .073), (.128, .071), (.132, .06), (.133, 0)], 'hat', 'hat', n=20, caps=(True, False), transform=HM)
C.lathe('hat band', V(0, 0, 0), [(.012, .0705), (.014, .0745), (.046, .0755), (.048, .0715)], 'hat_band', 'hat', n=20, caps=False, transform=HM)
# collar and bell
CM = M(V(0, .15, .545), (math.radians(-30), 0, 0))
tor = [[(Matrix.Rotation(math.tau * i / 20, 3, 'Z') @ V(.13 + .024 * math.cos(math.tau * j / 6), 0, .024 * math.sin(math.tau * j / 6))) for j in range(6)] for i in range(20)]
tor = [[CM @ p for p in ring] for ring in tor]
verts = [p for ring in tor for p in ring]; faces = [(i * 6 + j, i * 6 + (j + 1) % 6, ((i + 1) % 20) * 6 + (j + 1) % 6, ((i + 1) % 20) * 6 + j) for i in range(20) for j in range(6)]
C.mesh('collar', verts, faces, 'collar', 'neck')
C.ellipsoid('bell', KR.BELL_RING + V(0, .018, -.05), (.048, .046, .046), 'bell', 'bell', n=14, r=8, mat=GLOSS, face_tile=lambda c, n: 'bell_dark' if (abs(c.x) < .006 and c.z < KR.BELL_RING.z - .05) or (c.z < KR.BELL_RING.z - .078) else None,
            planes=[(V(-.006, 0, 0), V(1, 0, 0)), (V(.006, 0, 0), V(1, 0, 0))])
C.lathe('bell loop', KR.BELL_RING + V(0, .012, -.008), [(-.004, .012), (.004, .014), (.012, .008), (.012, 0)], 'bell', 'bell', n=10, caps=(True, False), mat=GLOSS)
# ================= tail =================
tl = KR.TAIL_PATH; acc = KR.arclen(tl); L = acc[-1]; NB = 9
cuts = sorted(set([round(L * k / NB, 5) for k in range(NB + 1)] + [round(L * (k + .5) / NB, 5) for k in range(NB)] + [L * .985, L * .995]))
pts = [KR.at_fraction(tl, s / L)[0] for s in cuts]
rad = [(.054 - .014 * (s / L)) * (math.sqrt(max(0, 1 - ((s / L - .955) / .045) ** 2)) if s / L > .955 else 1) + .002 for s in cuts]
def tail_w(p):
    p = Vector(p); best = min(range(len(KR.TAIL_PATH)), key=lambda i: (KR.TAIL_PATH[i] - p).length_squared); f = acc[best] / L * KR.N_TAIL
    k = min(KR.N_TAIL - 1, int(f)); u = C.smooth(f - k)
    if k + 1 >= KR.N_TAIL: return {'tail_%d' % (KR.N_TAIL - 1): 1.0}
    return {'tail_%d' % k: 1 - u, 'tail_%d' % (k + 1): u}
def tail_tile(c, n):
    best = min(range(len(KR.TAIL_PATH)), key=lambda i: (KR.TAIL_PATH[i] - c).length_squared); return 'stripe' if int(acc[best] / L * NB) % 2 == 1 else None
C.tube('striped tail', pts, rad, 'lilac', None, n=11, weights=tail_w, face_tile=tail_tile, hint=(1, 0, 0))
# ================= legs and skates =================
for name, (S, K, A) in KR.LEGS.items():
    hind = name[0] == 'H'; r0, r1, r2 = (.075, .062, .055) if hind else (.069, .058, .052)
    top = S + V(0, 0, .04); low = A - V(0, 0, .04)
    path = KR.catmull([top, S, K, A, low], 3); ac = KR.arclen(path); Lp = ac[-1]
    iK = min(range(len(path)), key=lambda i: (path[i] - K).length); aK = ac[iK]
    radii = [r0 + (r1 - r0) * C.smooth(a / aK) if a < aK else r1 + (r2 - r1) * C.smooth((a - aK) / max(1e-6, Lp - aK)) for a in ac]
    lw = C.chain_weights([S, K, A], ['leg_%s_up' % name, 'leg_%s_lo' % name, 'skate_' + name])
    C.tube('leg ' + name, path, radii, 'lilac', None, n=10, weights=lw, hint=(1, 0, 0), face_tile=lambda c, n, K=K: 'stripe' if abs(c.z - K.z - .01) < .014 else None)
    sk = 'skate_' + name; ax = A.x; ay = A.y
    C.box('skate foot ' + name, V(ax, ay + .03, .158), (.132, .245, .092), 'skate', sk, bevel=.046, segments=3, mat=GLOSS,
          face_tile=lambda c, n: 'skate_dark' if n.z < -.9 else None)
    C.ellipsoid('skate toe ' + name, V(ax, ay + .118, .15), (.064, .046, .046), 'skate', sk, n=10, r=5, mat=GLOSS)
    C.lathe('skate ankle ' + name, V(ax, ay - .025, .17), [(0, .062), (.04, .066), (.062, .066)], 'skate', sk, n=16, ey=1.12, caps=False, mat=GLOSS)
    C.lathe('skate cuff ' + name, V(ax, ay - .025, .226), [(0, .058), (.005, .07), (.018, .075), (.03, .068), (.033, .05)], 'skate_dark', sk, n=16, ey=1.12, caps=False, mat=GLOSS)
    for k, z in enumerate((.19, .212)):
        for sgn in (-1, 1):
            C.box('skate lace %s%d%+d' % (name, k, sgn), V(ax, ay + .075 - .03 * k, z), (.074, .012, .012), 'lace', sk, bevel=.003, segments=1, rot=(math.radians(-30), math.radians(sgn * 26), 0))
    C.box('skate plate ' + name, V(ax, ay + .03, .103), (.096, .25, .016), 'plate', sk, bevel=.006, segments=1)
    for tag, dy in zip('fb', KR.AXLE_DY):
        bn = 'axle_%s_%s' % (name, tag); acn = V(ax, ay + dy, KR.WHEEL_R)
        C.box('truck %s%s' % (name, tag), acn + V(0, 0, .022), (.07, .03, .036), 'plate', bn, bevel=.006, segments=1)
        for sx in (-1, 1):
            w = KR.WHEEL_W; R = KR.WHEEL_R
            prof = [(-w / 2, 0), (-w / 2, .028), (-w / 2 + .006, R), (w / 2 - .006, R), (w / 2, .028), (w / 2, 0)]
            C.lathe('wheel %s%s%+d' % (name, tag, sx), acn + V(sx * KR.WHEEL_DX, 0, 0), prof, 'wheel', bn, n=10, axis='x', caps=False,
                    face_tile=lambda c, n, o=acn + V(sx * KR.WHEEL_DX, 0, 0): 'hub' if abs(n.x) > .8 and ((c - o).length < .03) else None)

# ================= one skin, rig, records =================
skin, inventory = C.join_skin('Mischief_Kitten_Skater_Skin', 'EDITABLE mischief kitten skater parts - excluded from export')
REST = KR.rest_bones()
arm = C.build_rig('Mischief_Kitten_Skater_Rig', REST, skin)
tris = C.tris_of(skin)
pts = [v.co for v in skin.data.vertices]; lo = [min(p[k] for p in pts) for k in range(3)]; hi = [max(p[k] for p in pts) for k in range(3)]
arm['asset_id'] = ASSET; arm['asset_version'] = 'v001'; arm['forward'] = 'Blender +Y / glTF -Z'; arm['attack_contact_fraction'] = .625
mats = {}
for poly in skin.data.polygons: n = skin.data.materials[poly.material_index].name; mats[n] = mats.get(n, 0) + 1
influences = max(sum(1 for g in v.groups if g.weight > 1e-6) for v in skin.data.vertices)
record = {'asset_id': ASSET, 'version': 'v001', 'work_order': 'action-worlds/minions-a', 'blender_version': bpy.app.version_string,
          'rest_bounds_blender_z_up': {'min': lo, 'max': hi}, 'height_m': hi[2], 'width_m': hi[0] - lo[0], 'depth_m': hi[1] - lo[1],
          'triangles': tris, 'vertices': len(skin.data.vertices), 'materials': [m.name for m in skin.data.materials], 'faces_per_material': mats,
          'bone_count': len(arm.data.bones), 'bones': list(REST), 'max_influences_blender': influences,
          'texture': {'file': 'pigment.png', 'width': 1024, 'height': 1024, 'grid': '8 x 8 tiles of 128 px; UVs use the centre 72% of each tile',
                      'origin': 'Original clay-pigment colour atlas generated with numpy in Blender Python (common.paint_atlas); stripes, cream fur and hubs are bisected geometry bands on flat tiles; no external textures, photos, text or logos.',
                      'tiles': {name: i for i, (name, *_ ) in enumerate(PALETTE)}},
          'parts': inventory}
(ROOT / 'construction.json').write_text(json.dumps(record, indent=2) + '\n')
(ROOT / 'rig-rest.json').write_text(json.dumps({k: [list(map(float, h)), list(map(float, t)), p] for k, (h, t, p, r, d) in REST.items()}, indent=1) + '\n')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / (ASSET + '-construction.blend')), copy=True, compress=True)
bpy.ops.object.select_all(action='DESELECT'); skin.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=str(ROOT / (ASSET + '-checkpoint.glb')), export_format='GLB', use_selection=True, export_animations=False, export_skins=True, export_yup=True,
                          export_apply=False, export_armature_object_remove=True, export_texcoords=True, export_normals=True, export_materials='EXPORT', export_cameras=False, export_lights=False, export_extras=False)
big = sorted(inventory, key=lambda r: -r['triangles'])
print(json.dumps({'triangles': tris, 'vertices': len(skin.data.vertices), 'height': hi[2], 'bounds': [lo, hi], 'bones': len(arm.data.bones), 'mats': mats,
                  'influences': influences, 'largest': [(r['name'], r['triangles']) for r in big[:16]]}))
