"""gadget-hammer-hopper v001: build the original runaway-toolbox minion from the coordinator concept (row 1).

A teal toolbox with an ochre lid and carry handle, a naughty cartoon face on the front (big cream eyes
with side-eye pupils, thick slanted brows, a lopsided grin with two buck teeth), corrugated hose arms
from round sockets, a soft giant rubber mallet in the right fist, a teal left fist, and ONE coiled spring
leg ending in a chunky ochre work boot. Every part is modelled geometry on one painted 8 x 8 colour atlas;
no image is pasted on the model. Runs inside Blender instance 1 (exec'd by run.py).
"""
import bpy, json, math, importlib.util, sys
from pathlib import Path
from mathutils import Vector, Matrix, Euler, Quaternion
SRC = Path('/workspace/haynes-quest/action-worlds/minions-a/v001/source')
def load(name):
    spec = importlib.util.spec_from_file_location('mna_' + name, SRC / (name + '.py')); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
C = load('common'); RG = load('hopper_rig')
V = C.V; MATTE, GLOSS = C.MATTE, C.GLOSS
ASSET = 'gadget-hammer-hopper'; ROOT = C.PACK / ASSET
C.guard(ASSET)

PALETTE = [  # name, sRGB hex, mottling, top-to-bottom shade
    ('teal', '#2E847F', .035, .10), ('teal_dark', '#205F5B', .05, .06), ('ochre', '#E3A43C', .05, .10), ('ochre_dark', '#A86F25', .05, .04),
    ('hose', '#404347', .05, .08), ('metal', '#9A9DA1', .04, .12), ('cream', '#F3E6C6', .02, .06), ('pupil', '#1A1615', .0, .0),
    ('highlight', '#FFFFFF', .0, .0), ('brow', '#2B292D', .03, .0), ('mouth', '#5C1B22', .03, .0), ('tongue', '#CC5560', .03, .04),
    ('teeth', '#F6EDD6', .01, .04), ('rubber', '#E4682F', .05, .08), ('mallet', '#38393E', .05, .08), ('boot', '#DA9C36', .06, .10),
    ('sole', '#2C2725', .04, .0), ('lace', '#DCCB9F', .03, .0), ('interior', '#18211F', .04, .0), ('spring', '#46484C', .04, .06),
    ('wrench', '#A9AEB3', .03, .10), ('scuff', '#277670', .07, .06)]
C.setup(ROOT, PALETTE, 'gadget hammer hopper painted clay atlas')
sc = bpy.context.scene

def M(origin, frame3): return Matrix.Translation(origin) @ frame3.to_4x4()

# ================= toolbox body =================
def body_tile(c, n):
    if n.z > .95 and c.z > RG.BOX_Z1 - .004: return 'interior'      # seen only when the lid flips open
    if n.z < -.95: return 'teal_dark'
    if n.y < -.95 and abs(c.x) < .007: return 'teal_dark'             # back panel seam
    if n.y < -.95 and (c.x - .2) ** 2 + (c.z - .62) ** 2 < .004: return 'scuff'
    if abs(n.x) > .95 and (c.y + .08) ** 2 + (c.z - .6) ** 2 < .003: return 'scuff'
    return None
C.box('toolbox body', RG.BOX_C, (RG.BOX_W, RG.BOX_D, RG.BOX_Z1 - RG.BOX_Z0), 'teal', 'body', bevel=.045, segments=3,
      planes=[(V(-.007, 0, 0), V(1, 0, 0)), (V(.007, 0, 0), V(1, 0, 0))], face_tile=body_tile)
C.box('ochre lid', V(0, 0, (RG.LID_Z0 + RG.LID_Z1) / 2), (RG.LID_W, RG.LID_D, RG.LID_Z1 - RG.LID_Z0), 'ochre', 'lid', bevel=.05, segments=3,
      face_tile=lambda c, n: 'ochre_dark' if n.z < -.95 else None)
# carry handle: rounded arch on two mounts
hp = []
for a, b, c, d in [((-.17, 0, 1.17), (-.17, 0, 1.24), (-.165, 0, RG.HANDLE_Z), (-.10, 0, RG.HANDLE_Z)),
                   ((-.10, 0, RG.HANDLE_Z), (-.03, 0, RG.HANDLE_Z), (.03, 0, RG.HANDLE_Z), (.10, 0, RG.HANDLE_Z)),
                   ((.10, 0, RG.HANDLE_Z), (.165, 0, RG.HANDLE_Z), (.17, 0, 1.24), (.17, 0, 1.17))]:
    seg = C.bezier(V(*a), V(*b), V(*c), V(*d), 10); hp += seg if not hp else seg[1:]
C.tube('carry handle', hp, .03, 'hose', 'handle', n=8, hint=(0, 1, 0), squash=.8)
for x in (-.17, .17):
    C.box('handle mount %+.2f' % x, V(x, 0, RG.LID_Z1 + .012), (.085, .075, .035), 'hose', 'handle', bevel=.012, segments=2)
# latches: two on the back seam, one on each side
for x in (-.21, .21):
    C.box('back latch %+.2f' % x, V(x, -RG.LID_D / 2 - .004, RG.LID_Z0), (.095, .022, .125), 'metal', 'body', bevel=.008, mat=GLOSS)
    C.ellipsoid('back latch rivet %+.2f' % x, V(x, -RG.LID_D / 2 - .016, RG.LID_Z0 - .025), (.013, .007, .013), 'hose', 'body', n=10, r=5)
for x in (-1, 1):
    C.box('side latch %+d' % x, V(x * (RG.LID_W / 2 + .004), .02, RG.LID_Z0), (.022, .095, .125), 'metal', 'body', bevel=.008, mat=GLOSS)
    C.ellipsoid('side latch rivet %+d' % x, V(x * (RG.LID_W / 2 + .016), .02, RG.LID_Z0 - .025), (.007, .013, .013), 'hose', 'body', n=10, r=5)
for x in (-.32, .32):
    for y in (-.18, .18):
        C.lathe('box foot %+.2f %+.2f' % (x, y), V(x, y, RG.BOX_Z0 - .028), [(0, .03), (.012, .042), (.03, .044), (.034, .0)], 'hose', 'body', n=14, caps=(True, False))
# shoulder sockets
for s in (-1, 1):
    C.lathe('shoulder socket %+d' % s, V(s * (RG.BOX_W / 2 - .01), 0, RG.SHOULDER_Z), [(0, .074), (s * .02, .08), (s * .038, .074), (s * .046, .058), (s * .048, 0)],
            'hose', 'body', n=22, axis='x', caps=(True, False))

# ================= face =================
for s, (c, r) in (('R', RG.EYE_R), ('L', RG.EYE_L)):
    C.ellipsoid('eye white ' + s, c, r, 'cream', 'eye_' + s, mat=GLOSS, n=22, r=11)
    pc = c + V(0, r.y * .78, 0) + RG.PUPIL_LOOK
    C.ellipsoid('pupil ' + s, pc, (.054, .019, .062), 'pupil', 'pupil_' + s, mat=GLOSS, n=18, r=8)
    C.ellipsoid('eye glint ' + s, pc + V(.016, .015, .022), (.014, .006, .014), 'highlight', 'pupil_' + s, mat=GLOSS, n=10, r=5)
def brow_outline(flip):
    pts = []
    for i in range(8):
        u = i / 7; x = -.102 + .204 * u; z = -.022 + .042 * u + .012 * math.sin(math.pi * u); h = .031 - .009 * u
        pts.append((x, z + h))
    for i in range(7, -1, -1):
        u = i / 7; x = -.102 + .204 * u; z = -.022 + .042 * u + .012 * math.sin(math.pi * u); h = .031 - .009 * u
        pts.append((x, z - h))
    if flip: pts = [(-x, z) for x, z in reversed(pts)]
    return pts
# inner (towards the nose) ends sit lower: a naughty V
C.plate('brow R', brow_outline(False), .03, 'brow', 'brow_R', bevel=.009, transform=Matrix.Translation(V(.176, RG.FRONT_Y + .012, .968)))
C.plate('brow L', brow_outline(True), .03, 'brow', 'brow_L', bevel=.009, transform=Matrix.Translation(V(-.18, RG.FRONT_Y + .012, .984)))
mouth = [(.17, -.012), (.11, -.026), (.03, -.032), (-.06, -.028), (-.14, -.010), (-.205, .022), (-.212, .004), (-.19, -.035), (-.15, -.072),
         (-.09, -.108), (-.015, -.126), (.06, -.114), (.12, -.08), (.16, -.042), (.178, -.022)]
mouth = [(x * 1.32 - .004, z * 1.08) for x, z in mouth]
C.plate('grin', mouth, .016, 'mouth', 'mouth', bevel=.006, transform=Matrix.Translation(RG.MOUTH_TOP + V(0, .0, 0)))
tongue = [(-.026 + .115 * math.cos(math.tau * i / 16), -.097 + .03 * math.sin(math.tau * i / 16) - (.012 if math.sin(math.tau * i / 16) < 0 else 0)) for i in range(16)]
C.plate('tongue', tongue, .012, 'tongue', 'mouth', bevel=.005, transform=Matrix.Translation(RG.MOUTH_TOP + V(0, .006, 0)))
for x in (-.028, .022):
    C.box('buck tooth %+.3f' % x, RG.MOUTH_TOP + V(x, .013, -.062), (.046, .014, .062), 'teeth', 'body', bevel=.009, segments=2, mat=GLOSS)

# ================= hose arms =================
def ribbed(path, rib=.034, r0=.0435, amp=.0075, per_rib=4):
    acc = RG.arclen(path); total = acc[-1]; n = max(8, round(total / rib * per_rib)); out = []; radii = []
    for i in range(n + 1):
        s = total * i / n; p, _ = RG.at_fraction(path, i / n); out.append(p)
        end = min(1, s / .02, (total - s) / .02)
        radii.append(r0 + amp * math.cos(math.tau * s / rib) * end)
    return out, radii
def hose_weights(path, names):
    samples = [RG.at_fraction(path, i / 200)[0] for i in range(201)]; jf = [i / (len(names) - 1) for i in range(len(names))]
    def w(p):
        p = Vector(p); k = min(range(len(samples)), key=lambda i: (samples[i] - p).length_squared); f = k / 200
        for j in range(len(jf) - 1):
            if f <= jf[j + 1] + 1e-9:
                u = C.smooth((f - jf[j]) / (jf[j + 1] - jf[j])); return {names[j]: 1 - u, names[j + 1]: u}
        return {names[-1]: 1.0}
    return w
for s, path in (('R', RG.REST_HOSE_R), ('L', RG.REST_HOSE_L)):
    pts, radii = ribbed(path)
    C.tube('hose arm ' + s, pts, radii, 'hose', None, n=9, weights=hose_weights(path, RG.hose_joint_names(s)), hint=(0, 1, 0), caps=False)

# ================= fists and mallet =================
def fist(side, MX):
    t = 'teal'; bn = 'hand_' + side
    C.box('fist palm ' + side, V(0, 0, 0), (.13, .135, .115), t, bn, bevel=.035, segments=3, transform=MX @ Matrix.Translation(V(-.012, -.004, -.012)))
    for i, y in enumerate((-.043, -.001, .041)):
        C.ellipsoid('fist finger %s%d' % (side, i), V(.004, y, .052), (.064, .022, .036), t, bn, n=14, r=7, transform=MX)
    C.ellipsoid('fist thumb ' + side, V(.062, .052, .02), (.03, .046, .03), t, bn, n=14, r=8, rot=(math.radians(25), 0, 0), transform=MX)
    C.lathe('fist cuff ' + side, V(0, 0, 0), [(-.098, .046), (-.088, .062), (-.064, .064), (-.058, .052)], 'teal_dark', bn, n=18, axis='y', caps=False,
            transform=MX @ Matrix.Translation(V(-.01, 0, -.01)))
FR = RG.hand_frame_R(); FL = RG.hand_frame_L()
SF = Matrix.Diagonal((RG.FIST_S, RG.FIST_S, RG.FIST_S, 1))
fist('R', M(RG.HAND_R, FR) @ SF); fist('L', M(RG.HAND_L, FL) @ SF)
MM = M(RG.HAND_R, FR); MMi = MM.inverted()
C.lathe('mallet handle', V(0, 0, 0), [(-.095, 0), (-.095, .02), (-.085, .026), (RG.HEAD_OFF - .05, .025), (RG.HEAD_OFF, .025)], 'mallet', 'mallet', n=12, axis='y', caps=False, transform=MM)
prof = [(-.255, 0), (-.255, .08), (-.251, .104), (-.243, .116), (-.232, .121), (-.19, .121), (-.181, .116), (-.18, .106), (-.1, .106), (0, .108), (.1, .106),
        (.18, .106), (.181, .116), (.19, .121), (.232, .121), (.243, .116), (.251, .104), (.255, .08), (.255, 0)]
C.lathe('giant rubber mallet head', V(0, RG.HEAD_OFF, 0), prof, 'mallet', 'mallet', n=22, axis='x', caps=False, transform=MM,
        face_tile=lambda c, n: 'rubber' if abs((MMi @ c).x) > .1805 else None)

# ================= spring leg and boot =================
sj = [p for p, t in RG.joints_on(RG.REST_SPRING, RG.N_SPRING)]
spring_w = C.chain_weights(sj, RG.spring_names())
fr = C.frames(RG.REST_SPRING); turns = 4; coil = []
for i in range(int(turns * 20) + 1):
    f = i / (turns * 20); p, _ = RG.at_fraction(RG.REST_SPRING, .03 + .94 * f)
    k = min(len(fr) - 1, round(f * (len(fr) - 1))); _, u, v = fr[k]; a = math.tau * turns * f
    coil.append(p + .07 * (math.cos(a) * u + math.sin(a) * v))
C.tube('coil spring', coil, .0145, 'spring', None, n=7, weights=spring_w, caps=True)
C.lathe('spring top cap', V(0, 0, RG.BOX_Z0 - .045), [(0, .0), (0, .074), (.006, .084), (.03, .084), (.04, .064), (.045, 0)], 'hose', 'body', n=20, caps=False)
C.lathe('spring boot cap', V(0, -.01, .262), [(0, 0), (0, .074), (.006, .084), (.028, .084), (.036, .064), (.04, 0)], 'hose', 'boot', n=20, caps=False)
def sole_outline():
    pts = []
    for i in range(28):
        a = math.tau * i / 28; c, s = math.cos(a), math.sin(a)
        x = .124 * math.copysign(abs(c) ** .8, c); y = .218 * math.copysign(abs(s) ** .8, s)
        x *= 1.05 if y > 0 else .92
        pts.append((x, -(y + .05)))
    return pts
C.plate('boot sole', sole_outline(), .062, 'sole', 'boot', bevel=.016, segments=2, transform=Matrix.Translation(V(0, 0, .031)) @ Matrix.Rotation(math.radians(90), 4, 'X'))
C.ellipsoid('boot toe', V(0, .135, .098), (.125, .142, .078), 'boot', 'boot', n=18, r=9)
C.ellipsoid('boot vamp', V(0, .05, .126), (.117, .11, .09), 'boot', 'boot', n=18, r=9)
C.lathe('boot shaft', V(0, -.04, .055), [(0, .108), (.06, .111), (.12, .106), (.17, .102), (.19, .102)], 'boot', 'boot', n=22, ey=1.08, caps=(True, False))
C.lathe('boot collar', V(0, -.04, .24), [(-.01, .09), (-.006, .108), (.006, .119), (.022, .117), (.034, .1), (.036, .075)], 'ochre_dark', 'boot', n=22, ey=1.08, caps=(False, True))
for i, z in enumerate((.128, .164, .2)):
    for sgn in (-1, 1):
        C.box('boot lace %d%+d' % (i, sgn), V(0, .073 - .007 * i, z), (.098, .013, .015), 'lace', 'boot', bevel=.004, segments=1, rot=(0, math.radians(sgn * 24), 0))
for i, (x, y) in enumerate([(-.118, .17), (.118, .17), (-.124, .07), (.124, .07), (-.118, -.04), (.118, -.04), (-.105, -.13), (.105, -.13), (0, .272), (0, -.17)]):
    sx, sy = (.03, .05) if abs(x) > .01 else (.07, .026)
    C.box('sole lug %d' % i, V(x * 1.04, y + .005, .026), (sx, sy, .05), 'sole', 'boot', bevel=.008, segments=1)
C.lathe('boot welt', V(0, -.04, .058), [(0, .109), (.008, .116), (.02, .116), (.026, .109)], 'ochre_dark', 'boot', n=22, ey=1.08, caps=False)
C.ellipsoid('boot heel tab', V(0, -.162, .19), (.04, .02, .056), 'ochre_dark', 'boot', n=12, r=6)

# ================= hidden prop: the wrench that pops out in defeat =================
WM = Matrix.Translation(V(.10, -.02, .65))
C.box('wrench shaft', V(0, 0, .12), (.052, .026, .24), 'wrench', 'wrench', bevel=.009, segments=2, mat=GLOSS, transform=WM)
jaw = [(.062 * math.cos(a), .24 + .055 + .062 * math.sin(a)) for a in [math.radians(d) for d in range(-55, 236, 26)]]
jaw += [(.024 * math.cos(math.radians(d)), .24 + .055 + .03 + .024 * math.sin(math.radians(d))) for d in range(235, -56, -58)]
C.plate('wrench jaw', [(x, z) for x, z in jaw], .026, 'wrench', 'wrench', bevel=.006, mat=GLOSS, transform=WM)
C.lathe('wrench ring', V(0, 0, -.012), [(-.016, 0), (-.016, .03), (-.008, .044), (.008, .044), (.016, .03), (.016, 0)], 'wrench', 'wrench', n=16, axis='y', mat=GLOSS, transform=WM, caps=False)

# ================= one skin, rig, records =================
skin, inventory = C.join_skin('Gadget_Hammer_Hopper_Skin', 'EDITABLE gadget hammer hopper parts - excluded from export')
REST = RG.rest_bones()
arm = C.build_rig('Gadget_Hammer_Hopper_Rig', REST, skin)
tris = C.tris_of(skin)
pts = [v.co for v in skin.data.vertices]; lo = [min(p[k] for p in pts) for k in range(3)]; hi = [max(p[k] for p in pts) for k in range(3)]
arm['asset_id'] = ASSET; arm['asset_version'] = 'v001'; arm['forward'] = 'Blender +Y / glTF -Z'; arm['attack_contact_fraction'] = .625
mats = {}
for poly in skin.data.polygons: mats[skin.data.materials[poly.material_index].name] = mats.get(skin.data.materials[poly.material_index].name, 0) + 1
influences = max(sum(1 for g in v.groups if g.weight > 1e-6) for v in skin.data.vertices)
record = {'asset_id': ASSET, 'version': 'v001', 'work_order': 'action-worlds/minions-a', 'blender_version': bpy.app.version_string,
          'rest_bounds_blender_z_up': {'min': lo, 'max': hi}, 'height_m': hi[2], 'width_m': hi[0] - lo[0], 'depth_m': hi[1] - lo[1],
          'triangles': tris, 'vertices': len(skin.data.vertices), 'materials': [m.name for m in skin.data.materials], 'faces_per_material': mats,
          'bone_count': len(arm.data.bones), 'bones': list(REST), 'max_influences_blender': influences,
          'texture': {'file': 'pigment.png', 'width': 1024, 'height': 1024, 'grid': '8 x 8 tiles of 128 px; UVs use the centre 72% of each tile',
                      'origin': 'Original clay-pigment colour atlas generated with numpy in Blender Python (common.paint_atlas); no external textures, photos, text or logos.',
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
                  'influences': influences, 'largest': [(r['name'], r['triangles']) for r in big[:14]]}))
