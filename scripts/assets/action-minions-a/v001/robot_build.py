"""lab-robot-sentry v001: build the original broad toy robot from the coordinator concept (row 3).

A rounded cream shell (head and torso in one) with teal corner bands, a teal top visor and bottom band,
one big round orange lens in a dark bezel, grey screws and a slatted back vent; a teal-balled antenna;
plum shoulder spheres, plum upper arms and forearms with teal joint discs, and big teal C-shaped pincers;
a dark grey pelvis, stocky plum legs with teal knee caps, and chunky plum boots with teal toe caps and dark
soles. Rigid robot parts on one painted 8 x 8 atlas; runs inside Blender instance 1.
"""
import bpy, json, math, importlib.util
from pathlib import Path
from mathutils import Vector, Matrix, Euler, Quaternion
SRC = Path('/workspace/haynes-quest/action-worlds/minions-a/v001/source')
def load(name):
    spec = importlib.util.spec_from_file_location('mna_' + name, SRC / (name + '.py')); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
C = load('common'); RR = load('robot_rig')
V = C.V; MATTE, GLOSS = C.MATTE, C.GLOSS
ASSET = 'lab-robot-sentry'; ROOT = C.PACK / ASSET
C.guard(ASSET)
PALETTE = [
    ('cream', '#E9E0CD', .03, .10), ('cream_dark', '#BDB29B', .03, .04), ('teal', '#2D8A87', .03, .10), ('teal_dark', '#1E6462', .03, .05),
    ('plum', '#4B2B46', .04, .10), ('plum_dark', '#341E33', .04, .05), ('gray', '#4A4C53', .03, .08), ('gray_dark', '#2D2E34', .03, .03),
    ('screw', '#878B94', .02, .10), ('bezel', '#25252B', .02, .05), ('lens', '#F2861A', .02, .22), ('glint', '#FFFFFF', .0, .0),
    ('sole', '#2A292E', .03, .0), ('vent', '#1E1F24', .02, .0), ('lens_rim', '#C9650F', .02, .05)]
C.setup(ROOT, PALETTE, 'lab robot sentry painted clay atlas', seed=23)

def along(a, b, size, tile, bn, bevel=.03, segments=3, mat=MATTE, hint=(0, 1, 0), face_tile=None):
    """Rounded box from joint a to joint b (size = (width, length, depth) with length along a->b)."""
    F = RR.frame_y(b - a, hint); mid = (a + b) / 2; size = (size[0], (b - a).length + size[1], size[2])
    return C.box('%s %s' % (bn, tile), V(0, 0, 0), size, tile, bn, bevel=bevel, segments=segments, mat=mat, transform=Matrix.Translation(mid) @ F.to_4x4(), face_tile=face_tile)
def disc(name, c, axis, r, depth, tile, bn, mat=MATTE, n=18):
    prof = [(0, 0), (0, r * .86), (depth * .3, r), (depth * .8, r), (depth, r * .82), (depth, 0)]
    return C.lathe(name, c, prof, tile, bn, n=n, axis=axis, caps=False, mat=mat) if axis != '-x' else \
        C.lathe(name, c, [(-d, rr) for d, rr in prof], tile, bn, n=n, axis='x', caps=False, mat=mat)

# ================= shell =================
BAND_A = (60, 75)   # front-corner teal bands, degrees from straight ahead
def shell_tile(c, n):
    z = c.z - RR.SHELL_Z0; phi = abs(math.degrees(math.atan2(c.x, c.y)))
    if z < .06: return 'teal'
    if z > .47 and phi < 58: return 'teal'
    if BAND_A[0] < phi < BAND_A[1] and z < .445: return 'teal'
    if .1 < z < .112: return 'cream_dark'
    return None
planes = [(V(0, 0, RR.SHELL_Z0 + z), V(0, 0, 1)) for z in (.06, .1, .112, .445, .47)]
for a in BAND_A + (58,):
    for sg in (-1, 1):
        r = math.radians(sg * a); planes.append((V(0, 0, 0), V(math.cos(r), -math.sin(r), 0)))
C.lathe('rounded shell', V(0, 0, RR.SHELL_Z0), RR.SHELL_PROFILE, 'cream', 'shell', n=40, ey=RR.SHELL_EY, caps=False, face_tile=shell_tile, planes=planes)
C.lathe('lens housing', RR.EYE_C, [(-.22, 0), (-.22, .172), (-.02, .172)], 'bezel', 'eye', n=28, axis='y', caps=False, mat=GLOSS)
C.ellipsoid('lens socket', RR.EYE_C + V(0, .022, 0), (.124, .012, .124), 'vent', 'eye', n=20, r=6)
C.lathe('lens bezel', RR.EYE_C, [(-.05, .19), (-.02, .198), (.015, .192), (.034, .175), (.038, .14), (.03, .122), (-.01, .118)], 'bezel', 'eye', n=32, axis='y', caps=False, mat=GLOSS)
C.lathe('lens rim', RR.EYE_C, [(-.02, .126), (.012, .126), (.02, .121)], 'lens_rim', 'eye', n=28, axis='y', caps=False, mat=GLOSS)
C.ellipsoid('orange lens', RR.EYE_C + V(0, -.005, 0), (.122, .062, .122), 'lens', 'lens', n=28, r=14, mat=GLOSS)
C.ellipsoid('lens glint', RR.EYE_C + V(-.045, .05, .05), (.028, .008, .02), 'glint', 'lens', n=10, r=5, mat=GLOSS, rot=(0, math.radians(-30), 0))
for x, z, y in ((-.215, .9, .262), (.215, .9, .262), (-.2, 1.12, -.27), (.2, 1.12, -.27)):
    sg = 1 if y > 0 else -1
    C.lathe('screw %+.2f %+.2f' % (x, y), V(x, y - sg * .008, z), [(0, .026), (sg * .012, .028), (sg * .018, .022), (sg * .02, 0)], 'screw', 'shell', n=12, axis='y', caps=(True, False), mat=GLOSS)
C.box('back vent frame', V(0, -RR.FRONT_Y - .006, 1.0), (.27, .03, .18), 'gray', 'shell', bevel=.02, segments=2)
for k in range(3):
    C.box('back vent slat %d' % k, V(0, -RR.FRONT_Y - .02, .955 + .045 * k), (.21, .014, .024), 'vent', 'shell', bevel=.005, segments=1)
# antenna: teal collar, springy stem, teal ball
C.lathe('antenna collar', RR.ANT_BASE + V(0, 0, -.015), [(0, .05), (.02, .052), (.035, .04), (.04, 0)], 'teal', 'shell', n=16, caps=(True, False))
stem = [RR.ANT_BASE.lerp(RR.ANT_TOP, i / 10) for i in range(11)]
C.tube('antenna stem', stem, .013, 'gray_dark', None, n=8, weights=C.chain_weights([RR.ANT_BASE, RR.ANT_MID, RR.ANT_TOP], ['ant_1', 'ant_2', 'ant_2']))
C.ellipsoid('antenna ball', RR.ANT_TOP + V(0, 0, .03), (.05, .05, .05), 'teal', 'ant_2', n=16, r=8, mat=GLOSS)
# ================= arms and pincers =================
for s in 'RL':
    sg = 1 if s == 'R' else -1; ax = 'x' if s == 'R' else '-x'
    C.lathe('shoulder joint ' + s, V(sg * .34, 0, RR.SHOULDER[s].z), [(0, .1), (sg * .07, .1), (sg * .08, .09)], 'gray', 'shoulder_' + s, n=18, axis='x', caps=False)
    C.ellipsoid('shoulder sphere ' + s, RR.SHOULDER[s] + V(sg * .03, 0, .02), (.17, .165, .165), 'plum', 'shoulder_' + s, n=22, r=11)
    disc('shoulder cap ' + s, RR.SHOULDER[s] + V(sg * .19, 0, .02), ax, .06, .02, 'teal', 'shoulder_' + s, n=16)
    along(RR.SHOULDER[s] + (RR.ELBOW[s] - RR.SHOULDER[s]) * .35, RR.ELBOW[s], (.155, .02, .155), 'plum', 'upper_' + s, bevel=.035)
    C.lathe('elbow joint ' + s, RR.ELBOW[s] + V(-sg * .07, 0, 0), [(0, .068), (.14, .068)] if s == 'R' else [(0, .068), (-.14, .068)], 'gray', 'fore_' + s, n=16, axis='x', caps=True)
    disc('elbow disc ' + s, RR.ELBOW[s] + V(sg * .07, 0, 0), ax, .058, .025, 'teal', 'fore_' + s, n=16)
    along(RR.ELBOW[s], RR.WRIST[s], (.15, .02, .15), 'plum', 'fore_' + s, bevel=.035)
    disc('forearm disc ' + s, (RR.ELBOW[s] + RR.WRIST[s]) / 2 + V(sg * .074, 0, 0), ax, .046, .02, 'teal', 'fore_' + s, n=14)
    C.lathe('wrist joint ' + s, RR.WRIST[s] + V(0, 0, .0), [(-.05, .05), (.05, .05)], 'gray', 'claw_' + s, n=14, axis='z', caps=True)
    h = RR.claw_hinge(s); c = RR.CLAW_C[s]
    C.box('pincer palm ' + s, h - RR.CLAW_U[s] * .03, (.11, .12, .11), 'teal_dark', 'claw_' + s, bevel=.03, segments=2)
    u = RR.CLAW_U[s].normalized(); w = V(0, 1, 0).cross(u) if s == 'R' else u.cross(V(0, 1, 0))
    def jaw(a0, a1):
        pts = []
        for i in range(10):
            a = math.radians(a0 + (a1 - a0) * i / 9); pts.append((.188 * (math.cos(a) * u + math.sin(a) * w)))
        for i in range(9, -1, -1):
            a = math.radians(a0 + (a1 - a0) * i / 9); pts.append((.102 * (math.cos(a) * u + math.sin(a) * w)))
        return [(p.x, p.z) for p in pts]
    up_outline = jaw(38, 182); lo_outline = jaw(178, 322)
    C.plate('pincer upper jaw ' + s, up_outline, .11, 'teal', 'jaw_%s_up' % s, bevel=.022, segments=2, transform=Matrix.Translation(c))
    C.plate('pincer lower jaw ' + s, lo_outline, .11, 'teal', 'jaw_%s_lo' % s, bevel=.022, segments=2, transform=Matrix.Translation(c))
# ================= pelvis and legs =================
C.box('pelvis', RR.PELVIS_C, (.52, .38, .18), 'gray', 'pelvis', bevel=.055, segments=3)
for s in 'RL':
    sg = 1 if s == 'R' else -1; ax = 'x' if s == 'R' else '-x'
    C.lathe('hip joint ' + s, V(sg * .11, RR.HIP[s].y, RR.HIP[s].z), [(0, .075), (sg * .13, .075)], 'gray_dark', 'thigh_' + s, n=16, axis='x', caps=True)
    along(RR.HIP[s], RR.KNEE[s], (.19, .05, .19), 'plum', 'thigh_' + s, bevel=.04, hint=(0, 1, 0))
    C.lathe('knee joint ' + s, RR.KNEE[s] + V(-.09, 0, 0), [(0, .08), (.18, .08)], 'gray', 'shin_' + s, n=16, axis='x', caps=True)
    disc('knee cap ' + s, RR.KNEE[s] + V(0, .085, -.03), 'y', .066, .032, 'teal', 'shin_' + s, n=16)
    along(RR.KNEE[s], RR.ANKLE[s] + V(0, 0, .04), (.2, .02, .21), 'plum', 'shin_' + s, bevel=.04, hint=(0, 1, 0))
    disc('ankle disc ' + s, RR.ANKLE[s] + V(sg * .105, 0, .05), ax, .05, .022, 'teal', 'foot_' + s, n=14)
    f = RR.ANKLE[s]
    C.box('boot ' + s, V(f.x, f.y + .065, .105), (.27, .4, .12), 'plum', 'foot_' + s, bevel=.045, segments=3)
    C.box('boot toe cap ' + s, V(f.x, f.y + .19, .125), (.25, .16, .09), 'teal', 'foot_' + s, bevel=.04, segments=3)
    C.box('boot sole ' + s, V(f.x, f.y + .065, .022), (.28, .415, .044), 'sole', 'foot_' + s, bevel=.014, segments=2)
    C.box('boot heel cap ' + s, V(f.x, f.y - .09, .105), (.23, .07, .085), 'plum_dark', 'foot_' + s, bevel=.028, segments=2)

# ================= one skin, rig, records =================
skin, inventory = C.join_skin('Lab_Robot_Sentry_Skin', 'EDITABLE lab robot sentry parts - excluded from export')
REST = RR.rest_bones()
arm = C.build_rig('Lab_Robot_Sentry_Rig', REST, skin)
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
                      'origin': 'Original clay-pigment colour atlas generated with numpy in Blender Python (common.paint_atlas); bands and seams are bisected geometry on flat tiles; no external textures, photos, text or logos.',
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
