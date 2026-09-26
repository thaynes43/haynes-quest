"""WO111 putty-grunt source-side attachment audit on the live scene that exported the exact GLB.

Per clip and frame (30 fps): triangle overlap between listed part groups on the evaluated skin (BVH; a face belongs
to a group when most of its vertices are dominated by the group's bones), joint connectivity (the IK legs and the
FK arms and antenna keep each head on its parent's tail, including the stretching forearms), the lowest evaluated
vertex, the eye and antenna socket counter-scale (the eyes and antenna must not squash with the head or the
melting body except for the intended blink and squeeze) and the basis TRS error. The clay body is one continuous
skin, so neighbouring regions of it are never tested against each other; the fists touching each other at the
attack contact are the intended double-fist hit and are not tested. In the defeat the melt (from 0.55 s) presses
the clay into one puddle by design, so part overlaps are only tested before it; floor contact and connectivity are
tested on every frame. Supplements the exact-GLB checks; not a universal collision proof. Adapted from the
inator-monster and mischief-kitten audits."""
import bpy, json, hashlib
from mathutils import Matrix
from pathlib import Path
from mathutils.bvhtree import BVHTree
ROOT = Path('/workspace/haynes-quest/family-eras/putty-grunt/v001')
arm = bpy.data.objects['Putty_Grunt_Rig']; skin = bpy.data.objects['Putty_Grunt_Skin']; sc = bpy.context.scene
assert sc.get('work_order') == 'WO111' and sc.get('asset_id') == 'putty-grunt' and sc.get('scene_lease') == 'active'
construction = json.loads((ROOT / 'construction.json').read_text())
glb = hashlib.sha256((ROOT / 'putty-grunt.glb').read_bytes()).hexdigest()
assert construction['files']['putty-grunt.glb']['sha256'] == glb, 'construction record does not match the GLB on disk'
names = [g.name for g in skin.vertex_groups]
dom = [names[max(v.groups, key=lambda g: g.weight).group] for v in skin.data.vertices]
influences = max(sum(1 for g in v.groups if g.weight > 1e-6) for v in skin.data.vertices)
G = {'legR': {'thigh_R', 'shin_R', 'foot_R'}, 'legL': {'thigh_L', 'shin_L', 'foot_L'},
     'fistR': {'fist_R'}, 'fistL': {'fist_L'}, 'armR': {'upper_arm_R', 'forearm_R', 'fist_R'}, 'armL': {'upper_arm_L', 'forearm_L', 'fist_L'},
     'head': {'head', 'tongue'}, 'eyes': {'eye_R', 'eye_L'}, 'antenna': {'antenna_1', 'antenna_2'}}
PAIRS = [('legR', 'legL'), ('fistR', 'head'), ('fistL', 'head'), ('fistR', 'eyes'), ('fistL', 'eyes'), ('armR', 'antenna'), ('armL', 'antenna'),
         ('fistR', 'legR'), ('fistR', 'legL'), ('fistL', 'legR'), ('fistL', 'legL')]
polys = [list(p.vertices) for p in skin.data.polygons]
def members(bs): return [i for i, vs in enumerate(polys) if sum(dom[v] in bs for v in vs) * 2 > len(vs)]
FG = {k: members(bs) for k, bs in G.items()}
LINKS = [('thigh_R', 'shin_R'), ('shin_R', 'foot_R'), ('thigh_L', 'shin_L'), ('shin_L', 'foot_L'),
         ('upper_arm_R', 'forearm_R'), ('forearm_R', 'fist_R'), ('upper_arm_L', 'forearm_L'), ('forearm_L', 'fist_L'),
         ('shoulder_R', 'upper_arm_R'), ('shoulder_L', 'upper_arm_L'), ('antenna_1', 'antenna_2')]
MELT_FROM_S = 0.55
def axis_ratio(pb):
    M = (arm.matrix_world @ pb.matrix).to_3x3(); L = [M.col[i].length for i in range(3)]; return max(L) / min(L)
clips = {}
for tr in arm.animation_data.nla_tracks:
    arm.animation_data.action = tr.strips[0].action; end = int(tr.strips[0].action_frame_end)
    rec = {'frames': end + 1, 'overlaps': {a + '~' + b: 0 for a, b in PAIRS}, 'overlap_frames': {}, 'overlap_tested_frames': 0, 'max_joint_gap_m': 0.0, 'lowest_m': 9.0,
           'max_antenna_socket_axis_ratio': 0.0, 'max_eye_axis_ratio': 0.0, 'last_frame_eye_axis_ratio': None}
    for f in range(end + 1):
        sc.frame_set(f); dg = bpy.context.evaluated_depsgraph_get(); ev = skin.evaluated_get(dg); me = ev.to_mesh()
        co = [ev.matrix_world @ v.co for v in me.vertices]
        rec['lowest_m'] = min(rec['lowest_m'], min(p.z for p in co))
        if not (tr.name == 'defeat' and f / 30 >= MELT_FROM_S):
            rec['overlap_tested_frames'] += 1
            trees = {k: BVHTree.FromPolygons(co, [polys[i] for i in idx], all_triangles=False) for k, idx in FG.items()}
            for a, b in PAIRS:
                n = len(trees[a].overlap(trees[b])); rec['overlaps'][a + '~' + b] += n
                if n: rec['overlap_frames'].setdefault(a + '~' + b, []).append(f)
        for p, c in LINKS: rec['max_joint_gap_m'] = max(rec['max_joint_gap_m'], (arm.pose.bones[p].tail - arm.pose.bones[c].head).length)
        rec['max_antenna_socket_axis_ratio'] = max(rec['max_antenna_socket_axis_ratio'], axis_ratio(arm.pose.bones['antenna_root']))
        # the eyes blink (idle), squint (attack), squeeze (hit, defeat jolt) and pop 8 % wider in the puddle on purpose;
        # the move clip has none of these, and the held puddle must show the eyes at exactly that popped shape
        er = max(axis_ratio(arm.pose.bones['eye_R']), axis_ratio(arm.pose.bones['eye_L'])); rec['max_eye_axis_ratio'] = max(rec['max_eye_axis_ratio'], er)
        if f == end: rec['last_frame_eye_axis_ratio'] = er
        ev.to_mesh_clear()
    rec['lowest_m'] = round(rec['lowest_m'], 5); clips[tr.name] = rec
arm.animation_data.action = None
for pb in arm.pose.bones: pb.matrix_basis = Matrix.Identity(4)
sc.frame_set(0)
checks = {'no_listed_part_overlaps_any_tested_frame': all(n == 0 for r in clips.values() for n in r['overlaps'].values()),
          'limb_and_antenna_joints_stay_connected': all(r['max_joint_gap_m'] < 1e-4 for r in clips.values()),
          'no_floor_penetration': all(r['lowest_m'] >= -1e-5 for r in clips.values()),
          'antenna_socket_keeps_shape': all(r['max_antenna_socket_axis_ratio'] < 1.02 for r in clips.values()),
          'eyes_keep_shape_while_moving': clips['move']['max_eye_axis_ratio'] < 1.02,
          'eyes_round_and_popped_in_the_held_puddle': abs(clips['defeat']['last_frame_eye_axis_ratio'] - 1.08) < 0.02,
          'basis_matrices_are_exact_trs': construction['basis_trs_max_error'] < 1e-4,
          'at_most_four_influences': influences <= 4, 'five_clips': sorted(clips) == sorted(['idle', 'move', 'attack', 'hit', 'defeat'])}
record = {'asset_id': 'putty-grunt', 'version': 'v001', 'glb_sha256': glb, 'blend_sha256': hashlib.sha256((ROOT / 'putty-grunt.blend').read_bytes()).hexdigest(),
          'method': __doc__.strip(), 'pairs': [a + '~' + b for a, b in PAIRS], 'groups': {k: sorted(v) for k, v in G.items()}, 'group_face_counts': {k: len(v) for k, v in FG.items()},
          'defeat_overlap_tests_until_s': MELT_FROM_S, 'max_influences': influences, 'basis_trs_max_error': construction['basis_trs_max_error'], 'clips': clips, 'checks': checks}
(ROOT / 'attachment-inspection.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps({'checks': checks, 'lowest': {k: v['lowest_m'] for k, v in clips.items()}, 'gaps': {k: v['max_joint_gap_m'] for k, v in clips.items()},
                  'eye': {k: [v['max_eye_axis_ratio'], v['last_frame_eye_axis_ratio']] for k, v in clips.items()}, 'ant': {k: v['max_antenna_socket_axis_ratio'] for k, v in clips.items()},
                  'overlaps': {k: v['overlap_frames'] for k, v in clips.items()}, 'faces': record['group_face_counts']}))
