"""WO111 lab-robot source-side attachment audit on the live scene that exported the exact GLB.

Per clip and frame (30 fps): triangle overlap between listed part groups on the evaluated skin (BVH), chain
connectivity (every stretch joint stays on its parent's axis: the head of each chain bone lies on the line of
its parent bone), the lowest evaluated vertex, and the rest reproduction error. Groups are built from the
per-face 'lr_part' index written by build.py. Intended contacts are not tested: the arm roots inside the
shoulder sockets (arm tube faces within 4 cm of the shoulder), the cord root inside the grommet, the claw
cuffs over the tube ends, the neck bellows in the body top and head trim, the waist in the crossbar, the
lens barrel through the dome, the seam ring over the band top, and the collapsed sparks and smoke (they
sit inside the body and head until the defeat opens them). Supplements the exact-GLB checks in
three-inspection.json; not a universal collision proof. Adapted from the radio-host-showman v001 audit."""
import bpy, json, hashlib, importlib.util
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT = Path('/workspace/haynes-quest/family-eras/lab-robot/v001')
spec = importlib.util.spec_from_file_location('wo111_lr_rig', ROOT / 'source/rig.py'); RG = importlib.util.module_from_spec(spec); spec.loader.exec_module(RG)
arm = bpy.data.objects['Lab_Robot_Rig']; skin = bpy.data.objects['Lab_Robot_Skin']; sc = bpy.context.scene
assert sc.get('work_order') == 'WO111' and sc.get('asset_id') == 'lab-robot' and sc.get('scene_lease') == 'active'
construction = json.loads((ROOT / 'construction.json').read_text())
glb = hashlib.sha256((ROOT / 'lab-robot.glb').read_bytes()).hexdigest()
assert construction['files']['lab-robot.glb']['sha256'] == glb, 'construction record does not match the GLB on disk'
me = skin.data
influences = max(sum(1 for g in v.groups if g.weight > 1e-6) for v in me.vertices)
polys = [list(p.vertices) for p in me.polygons]
part = [0] * len(polys); me.attributes['lr_part'].data.foreach_get('value', part)
pnames = [r['name'] for r in construction['parts']]
rest_co = [v.co.copy() for v in me.vertices]
def faces_of(pred):
    return [i for i in range(len(polys)) if pred(pnames[part[i]], i)]
def centroid(i): return sum((rest_co[v] for v in polys[i]), Vector()) / len(polys[i])
def arm_s(i, s):
    J, W, d, S = RG.REST_ARM[s]; return (centroid(i) - J[0]).dot(d)
HEAD_RIGID = ('Plum head bottom trim', 'Pale tin head band', 'Brass ear disc', 'Steel ear bolt', 'Brass lens bezel', 'Pale blue domed lens glass', 'Blue camera iris',
              'Glowing red pupil core', 'Cream lens glint', 'Plum lens eyelid')
BODY = ('Teal tin body', 'Pale tin control panel', 'Brass and plum hazard ring', 'Candy-red self-destruct button', 'Brass gauge dial', 'Indicator light', 'Brass hazard kick plate',
        'Plum side louver', 'Pale tin back hatch', 'Plum hatch handle', 'Brass cord grommet')
DOME = ('Pale tin dome lid', 'Brass warning light base', 'Glowing amber warning light', 'Steel warning light cage wire')
CHASSIS = ('Plum chassis crossbar', 'Plum rubber tank tread belt', 'Tread lug', 'Teal tread housing plate', 'Steel road wheel', 'Brass hubcap', 'Steel hub bolt')
CORD_START = RG.CORD_J[0]
FG = {'head': faces_of(lambda n, i: n.startswith(HEAD_RIGID)),
      'body': faces_of(lambda n, i: n.startswith(BODY)),
      'dome': faces_of(lambda n, i: n.startswith(DOME)),
      'chassis': faces_of(lambda n, i: n.startswith(CHASSIS)),
      'waist': faces_of(lambda n, i: n.startswith(('Steel swivel waist', 'Brass waist ring'))),
      'cord': faces_of(lambda n, i: (n.startswith('Yanked-out rubber power cord') and (centroid(i) - CORD_START).length > 0.06) or n.startswith(('Brass two-prong plug', 'Steel plug prong')))}
for s in 'RL':
    FG['arm' + s] = faces_of(lambda n, i, s=s: n == 'Steel slinky spring arm ' + s and arm_s(i, s) > 0.04)
    FG['claw' + s] = faces_of(lambda n, i, s=s: n.startswith(('Brass claw palm ' + s, 'Brass pincer jaw ' + s, 'Brass pincer ball tip ' + s)))
    FG['socket' + s] = faces_of(lambda n, i, s=s: n == 'Brass shoulder socket ' + s)
PAIRS = [('armR', 'body'), ('armL', 'body'), ('clawR', 'body'), ('clawL', 'body'), ('armR', 'head'), ('armL', 'head'), ('clawR', 'head'), ('clawL', 'head'),
         ('armR', 'dome'), ('clawR', 'dome'), ('armL', 'dome'), ('clawL', 'dome'), ('armR', 'chassis'), ('armL', 'chassis'), ('clawR', 'chassis'), ('clawL', 'chassis'),
         ('armR', 'armL'), ('clawR', 'clawL'), ('armR', 'clawL'), ('armL', 'clawR'), ('cord', 'chassis'), ('cord', 'armR'), ('cord', 'clawR'), ('cord', 'armL'), ('cord', 'clawL'),
         ('cord', 'body'), ('head', 'body'), ('dome', 'body'), ('head', 'chassis'), ('armR', 'socketL'), ('armL', 'socketR'), ('clawR', 'socketR'), ('clawL', 'socketL')]
CHAINS = [('arm_%s_%d' % (s, i), 'arm_%s_%d' % (s, i + 1)) for s in 'RL' for i in range(1, RG.N_ARM)] + [('arm_%s_%d' % (s, RG.N_ARM), 'claw_' + s) for s in 'RL']
CHAINS += [('cord_%d' % i, 'cord_%d' % (i + 1)) for i in range(1, 5)] + [('cord_5', 'plug'), ('neck', 'head'), ('chassis', 'waist')]
clips = {}
for tr in arm.animation_data.nla_tracks:
    arm.animation_data.action = tr.strips[0].action; end = int(tr.strips[0].action_frame_end)
    rec = {'frames': end + 1, 'overlaps': {a + '~' + b: 0 for a, b in PAIRS}, 'overlap_frames': {}, 'max_chain_off_axis_m': 0.0, 'lowest_m': 9.0}
    for f in range(end + 1):
        sc.frame_set(f); dg = bpy.context.evaluated_depsgraph_get(); ev = skin.evaluated_get(dg); m = ev.to_mesh()
        co = [ev.matrix_world @ v.co for v in m.vertices]
        rec['lowest_m'] = min(rec['lowest_m'], min(p.z for p in co))
        trees = {k: BVHTree.FromPolygons(co, [polys[i] for i in idx], all_triangles=False) for k, idx in FG.items()}
        for a, b in PAIRS:
            n = len(trees[a].overlap(trees[b])); rec['overlaps'][a + '~' + b] += n
            if n: rec['overlap_frames'].setdefault(a + '~' + b, []).append(f)
        for p, c in CHAINS:
            pb = arm.pose.bones[p]; cb = arm.pose.bones[c]; a0 = pb.head; d = (pb.tail - pb.head).normalized(); h = cb.head - a0
            rec['max_chain_off_axis_m'] = max(rec['max_chain_off_axis_m'], (h - d * h.dot(d)).length)
        ev.to_mesh_clear()
    rec['lowest_m'] = round(rec['lowest_m'], 5); clips[tr.name] = rec
arm.animation_data.action = None; sc.frame_set(0)
checks = {'no_listed_part_overlaps_any_frame': all(n == 0 for r in clips.values() for n in r['overlaps'].values()),
          'chain_joints_stay_on_parent_axis': all(r['max_chain_off_axis_m'] < 1e-4 for r in clips.values()),
          'no_floor_penetration': all(r['lowest_m'] >= -1e-5 for r in clips.values()),
          'rest_controls_reproduce_bind_pose': construction['rest_reproduction_max_error'] < 1e-4,
          'idle_0_reproduces_sheet_pose': all(v < 2e-4 for v in construction['sheet_pose_reproduction'].values()),
          'at_most_four_influences': influences <= 4, 'five_clips': sorted(clips) == sorted(['idle', 'move', 'attack', 'hit', 'defeat'])}
record = {'asset_id': 'lab-robot', 'version': 'v001', 'glb_sha256': glb, 'blend_sha256': hashlib.sha256((ROOT / 'lab-robot.blend').read_bytes()).hexdigest(),
          'method': __doc__.strip(), 'pairs': [a + '~' + b for a, b in PAIRS], 'group_face_counts': {k: len(v) for k, v in FG.items()},
          'max_influences': influences, 'rest_reproduction_max_error': construction['rest_reproduction_max_error'], 'sheet_pose_reproduction': construction['sheet_pose_reproduction'], 'clips': clips, 'checks': checks}
(ROOT / 'attachment-inspection.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps({'checks': checks, 'overlaps': {k: {p: n for p, n in v['overlaps'].items() if n} for k, v in clips.items()}, 'frames': {k: v['overlap_frames'] for k, v in clips.items()},
                  'lowest': {k: v['lowest_m'] for k, v in clips.items()}, 'off_axis': {k: v['max_chain_off_axis_m'] for k, v in clips.items()}, 'groups': record['group_face_counts']}))
