"""WO111 magic-house source-side attachment audit on the live scene that exported the exact GLB.

Per clip and frame (60 fps, the export rate): triangle overlap (BVH) between listed part groups of the evaluated
skin, the lowest evaluated vertex, and per-part attachment of the rigid hinged parts. Parts are identified by the
'mh_part' vertex attribute written before the join (not exported). Intended contacts are not tested: door and
shutter hinge edges inside their terracotta frames, the tongue root inside the mouth, stump tops inside the floor
slab, the chimney stack through the roof, and the dropped tiles resting in their slots in the held defeat.
Supplements the exact-GLB checks in three-inspection.json; not a universal collision proof."""
import bpy, json, hashlib
from pathlib import Path
from mathutils.bvhtree import BVHTree

ROOT = Path('/workspace/haynes-quest/family-eras/magic-house/v001')
OWNER = 'claude-opus-5-5 magic-house model subagent (session_016rSS1uA4XaroamTk1brNXn) on blender-authoring-2'
arm = bpy.data.objects['Magic_House_Rig']; skin = bpy.data.objects['Magic_House_Skin']; sc = bpy.context.scene
assert sc.get('work_order') == 'WO111' and sc.get('asset_id') == 'magic-house' and sc.get('scene_lease') == 'active' and sc.get('scene_owner') == OWNER
construction = json.loads((ROOT / 'construction.json').read_text())
glb = hashlib.sha256((ROOT / 'magic-house.glb').read_bytes()).hexdigest()
assert construction['files']['magic-house.glb']['sha256'] == glb, 'construction record does not match the GLB on disk'
parts = [p['name'] for p in construction['parts']]
pid = [0] * len(skin.data.vertices); skin.data.attributes['mh_part'].data.foreach_get('value', pid)
influences = max(sum(1 for g in v.groups if g.weight > 1e-6) for v in skin.data.vertices)
def has(*keys): return {i for i, n in enumerate(parts) if any(k in n for k in keys)}
TILE = {('tile_%d' % k): has('Dancing roof tile %d ' % k) for k in range(1, 6)}; TILE['ridge_tile'] = has('Hopping ridge cap tile')
ALL_TILES = set().union(*TILE.values())
ROOF = has('Timber roof deck', 'roof sheet', 'Ridge cap tiles', 'chimney', 'Chimney')
BUTTER = has('Butterfly')
G = dict(TILE)
G.update({'tiles': ALL_TILES, 'roof': ROOF, 'gable': has('front-to-back gable'),
          'house': set(range(len(parts))) - ALL_TILES - ROOF - BUTTER,
          'tongue': has('doormat tongue'), 'step_slab': has('step lip', 'floor slab'), 'slab': has('floor slab'),
          'feet': has('Round teal clog', 'Honey ankle band'), 'foot_R': has('clog R', 'band R'), 'foot_L': has('clog L', 'band L'),
          'legs': has('Timber stump leg', 'Round teal clog', 'Honey ankle band'),
          'doors': has('Honey door leaf', 'Door knob '), 'lids': has('shutter eyelid'), 'shutters': has('Blue side shutter'),
          'cheeks': has('flower-box cheek', 'Cheek flower', 'Cheek leaves'), 'pupils': has('pupil', 'Pupil'),
          'butterflies': BUTTER, 'roof_and_house': (set(range(len(parts))) - ALL_TILES - BUTTER)})
assert all(G[k] for k in G), [k for k in G if not G[k]]
PAIRS = [('tiles', 'house'), ('tongue', 'step_slab'), ('tongue', 'legs'), ('doors', 'tongue'), ('lids', 'shutters'), ('lids', 'cheeks'),
         ('shutters', 'cheeks'), ('shutters', 'pupils'), ('feet', 'slab'), ('foot_R', 'foot_L'), ('butterflies', 'roof_and_house')]
# The roof deck rests on the gable's top edges (touching at rest, so BVH overlap is meaningless there). Instead measure
# how far any gable vertex rises above the posed deck's underside; it must stay well below the 0.07 m deck thickness.
from mathutils import Vector
import math
RIDGE = Vector((0.0, 0.0, 2.52)); TH = math.atan2(0.72, 0.90)
SLOPES = [(Vector((sx * math.sin(TH), 0, math.cos(TH))), Vector((sx * math.cos(TH), 0, -math.sin(TH)))) for sx in (1, -1)]
TILE_NAMES = list(TILE)
PAIRS += [(t, 'roof') for t in TILE_NAMES] + [(a, b) for i, a in enumerate(TILE_NAMES) for b in TILE_NAMES[i + 1:]]
DEFEAT_INTENDED = {(t, 'roof') for t in TILE_NAMES}  # dropped tiles resting in their slots; reported, not required
polys = [list(p.vertices) for p in skin.data.polygons]
FG = {k: [i for i, vs in enumerate(polys) if pid[vs[0]] in ids] for k, ids in G.items()}
gable_v = sorted({v for i in FG['gable'] for v in polys[i]})
def gable_penetration(co):
    roof_pb = arm.pose.bones['roof']; undo = roof_pb.bone.matrix_local @ roof_pb.matrix.inverted()
    worst = -1.0
    for vi in gable_v:
        p = undo @ co[vi]
        for n, d in SLOPES:
            s_ = (p - RIDGE).dot(d)
            if -0.035 <= s_ <= 1.47 and abs(p.y) <= 0.86: worst = max(worst, (p - RIDGE).dot(n))
    return worst
held_from = next(c for c in construction['clips'] if c['name'] == 'defeat')['held_final_pose_from_s']
clips = {}
for tr in arm.animation_data.nla_tracks:
    arm.animation_data.action = tr.strips[0].action; end = int(tr.strips[0].action_frame_end)
    rec = {'frames': end + 1, 'overlaps': {a + '~' + b: 0 for a, b in PAIRS}, 'first_overlap_s': {}, 'lowest_m': 9.0, 'max_gable_rise_above_deck_underside_m': -1.0}
    for f in range(end + 1):
        sc.frame_set(f); dg = bpy.context.evaluated_depsgraph_get(); ev = skin.evaluated_get(dg); me = ev.to_mesh()
        co = [ev.matrix_world @ v.co for v in me.vertices]
        rec['lowest_m'] = min(rec['lowest_m'], min(p.z for p in co))
        rec['max_gable_rise_above_deck_underside_m'] = max(rec['max_gable_rise_above_deck_underside_m'], round(gable_penetration(co), 5))
        trees = {k: BVHTree.FromPolygons(co, [polys[i] for i in idx], all_triangles=False) for k, idx in FG.items()}
        for a, b in PAIRS:
            n = len(trees[a].overlap(trees[b])); key = a + '~' + b; rec['overlaps'][key] += n
            if n and key not in rec['first_overlap_s']: rec['first_overlap_s'][key] = round(f / sc.render.fps, 4)
        ev.to_mesh_clear()
    rec['lowest_m'] = round(rec['lowest_m'], 5); clips[tr.name] = rec
arm.animation_data.action = None; sc.frame_set(0)
def required(clip, key):
    a, b = key.split('~'); return not (clip == 'defeat' and (a, b) in DEFEAT_INTENDED)
checks = {'no_listed_part_overlaps_any_frame': all(n == 0 for c, r in clips.items() for k, n in r['overlaps'].items() if required(c, k)),
          'no_floor_penetration': all(r['lowest_m'] >= -1e-5 for r in clips.values()),
          'gable_stays_under_roof_deck': all(r['max_gable_rise_above_deck_underside_m'] < 0.035 for r in clips.values()),
          'at_most_four_influences': influences <= 4, 'five_clips': sorted(clips) == sorted(['idle', 'move', 'attack', 'hit', 'defeat'])}
record = {'asset_id': 'magic-house', 'version': 'v001', 'glb_sha256': glb, 'blend_sha256': hashlib.sha256((ROOT / 'magic-house.blend').read_bytes()).hexdigest(),
          'method': __doc__.strip(), 'sample_rate_fps': sc.render.fps, 'pairs': [a + '~' + b for a, b in PAIRS], 'defeat_intended_contacts_reported_not_required': sorted(a + '~' + b for a, b in DEFEAT_INTENDED),
          'groups': {k: sorted(parts[i] for i in v) for k, v in G.items() if k not in ('house', 'roof_and_house')}, 'group_face_counts': {k: len(v) for k, v in FG.items()},
          'max_influences': influences, 'clips': clips, 'checks': checks}
(ROOT / 'attachment-inspection.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps({'checks': checks, 'lowest': {k: v['lowest_m'] for k, v in clips.items()}, 'gable_rise': {k: v['max_gable_rise_above_deck_underside_m'] for k, v in clips.items()},
                  'overlaps': {c: {k: (n, r['first_overlap_s'].get(k)) for k, n in r['overlaps'].items() if n} for c, r in clips.items()}}))
