"""WO111 rival-mayor source-side attachment audit on the live scene that exported the exact GLB.

Per clip and frame (30 fps): triangle-overlap between listed part groups on the evaluated skin (BVH),
IK joint connectivity (limb heads stay on their parents' tails), the lowest evaluated vertex, and the
rest reproduction error. Intended contacts are not tested: the fist resting on the hip, sleeve roots
inside the shoulder pads, the hat around the head once it slides down, legs inside the coat when seated.
Supplements the exact-GLB checks in three-inspection.json; not a universal collision proof."""
import bpy,json,hashlib
from pathlib import Path
from mathutils.bvhtree import BVHTree
ROOT=Path('/workspace/haynes-quest/family-eras/rival-mayor/v001')
arm=bpy.data.objects['Rival_Mayor_Rig'];skin=bpy.data.objects['Rival_Mayor_Skin'];sc=bpy.context.scene
assert sc.get('work_order')=='WO111' and sc.get('asset_id')=='rival-mayor' and sc.get('scene_lease')=='active'
construction=json.loads((ROOT/'construction.json').read_text())
glb=hashlib.sha256((ROOT/'rival-mayor.glb').read_bytes()).hexdigest()
assert construction['files']['rival-mayor.glb']['sha256']==glb,'construction record does not match the GLB on disk'
names=[g.name for g in skin.vertex_groups]
dom=[names[max(v.groups,key=lambda g:g.weight).group] for v in skin.data.vertices]
influences=max(sum(1 for g in v.groups if g.weight>1e-6) for v in skin.data.vertices)
G={'tails':{'tail_R','tail_L'},'legs':{'thigh_R','thigh_L','shin_R','shin_L'},'shoes':{'foot_R','foot_L'},
   'remote':{'remote','button','thumb_R','antenna_1','antenna_2','propeller','hand_R'},'body':{'hips','chest'},'head':{'head','neck','mustache_R','mustache_L'},
   'hat':{'hat'},'fistL':{'hand_L'},'armL':{'forearm_L'},'armR':{'forearm_R'},'legR':{'thigh_R','shin_R','foot_R'},'legL':{'thigh_L','shin_L','foot_L'}}
PAIRS=[('tails','legs'),('tails','shoes'),('remote','body'),('remote','head'),('remote','hat'),('remote','legs'),('fistL','head'),('fistL','hat'),('armL','head'),('armR','head'),('armR','body'),('legR','legL')]
polys=[list(p.vertices) for p in skin.data.polygons]
FG={k:[i for i,vs in enumerate(polys) if sum(dom[v] in bs for v in vs)*2>len(vs)] for k,bs in G.items()}
LINKS=[('upper_arm_R','forearm_R'),('forearm_R','hand_R'),('upper_arm_L','forearm_L'),('forearm_L','hand_L'),('thigh_R','shin_R'),('shin_R','foot_R'),('thigh_L','shin_L'),('shin_L','foot_L')]
clips={}
for tr in arm.animation_data.nla_tracks:
 arm.animation_data.action=tr.strips[0].action;end=int(tr.strips[0].action_frame_end)
 rec={'frames':end+1,'overlaps':{a+'~'+b:0 for a,b in PAIRS},'max_joint_gap_m':0.0,'lowest_m':9.0}
 for f in range(end+1):
  sc.frame_set(f);dg=bpy.context.evaluated_depsgraph_get();ev=skin.evaluated_get(dg);me=ev.to_mesh()
  co=[ev.matrix_world@v.co for v in me.vertices]
  rec['lowest_m']=min(rec['lowest_m'],min(p.z for p in co))
  trees={k:BVHTree.FromPolygons(co,[polys[i] for i in idx],all_triangles=False) for k,idx in FG.items()}
  for a,b in PAIRS:rec['overlaps'][a+'~'+b]+=len(trees[a].overlap(trees[b]))
  for p,c in LINKS:rec['max_joint_gap_m']=max(rec['max_joint_gap_m'],(arm.pose.bones[p].tail-arm.pose.bones[c].head).length)
  ev.to_mesh_clear()
 rec['lowest_m']=round(rec['lowest_m'],5);clips[tr.name]=rec
arm.animation_data.action=None;sc.frame_set(0)
checks={'no_listed_part_overlaps_any_frame':all(n==0 for r in clips.values() for n in r['overlaps'].values()),
 'limb_joints_stay_connected':all(r['max_joint_gap_m']<1e-4 for r in clips.values()),
 'no_floor_penetration':all(r['lowest_m']>=-1e-5 for r in clips.values()),
 'rest_controls_reproduce_bind_pose':construction['rest_reproduction_max_error']<1e-4,
 'at_most_four_influences':influences<=4,'five_clips':sorted(clips)==sorted(['idle','move','attack','hit','defeat'])}
record={'asset_id':'rival-mayor','version':'v001','glb_sha256':glb,'blend_sha256':hashlib.sha256((ROOT/'rival-mayor.blend').read_bytes()).hexdigest(),
 'method':__doc__.strip(),'pairs':[a+'~'+b for a,b in PAIRS],'groups':{k:sorted(v) for k,v in G.items()},'group_face_counts':{k:len(v) for k,v in FG.items()},
 'max_influences':influences,'rest_reproduction_max_error':construction['rest_reproduction_max_error'],'clips':clips,'checks':checks}
(ROOT/'attachment-inspection.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'checks':checks,'lowest':{k:v['lowest_m'] for k,v in clips.items()},'gaps':{k:v['max_joint_gap_m'] for k,v in clips.items()}}))
