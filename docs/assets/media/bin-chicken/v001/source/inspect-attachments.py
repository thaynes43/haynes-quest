"""WO111 bin-chicken source-side attachment audit on the live scene that exported the exact GLB.

Per clip and frame (30 fps): triangle-overlap between listed part groups on the evaluated skin (BVH),
IK joint connectivity (limb heads stay on their parents' tails), the lowest evaluated vertex, and the
rest reproduction error. Intended contacts are not tested: the neck inside the ruff, the wing shells
lying on the body and the black wing tips crossing over the cone, the feathered thighs over the leg
tops, and the belly, neck, head, dropped chip and spilled chips resting on the floor in the defeat.
Supplements the exact-GLB checks in three-inspection.json; not a universal collision proof.
Adapted from the rival-mayor v001 audit."""
import bpy,json,hashlib
from pathlib import Path
from mathutils.bvhtree import BVHTree
ROOT=Path('/workspace/haynes-quest/family-eras/bin-chicken/v001')
arm=bpy.data.objects['Bin_Chicken_Rig'];skin=bpy.data.objects['Bin_Chicken_Skin'];sc=bpy.context.scene
assert sc.get('work_order')=='WO111' and sc.get('asset_id')=='bin-chicken' and sc.get('scene_lease')=='active'
construction=json.loads((ROOT/'construction.json').read_text())
glb=hashlib.sha256((ROOT/'bin-chicken.glb').read_bytes()).hexdigest()
assert construction['files']['bin-chicken.glb']['sha256']==glb,'construction record does not match the GLB on disk'
names=[g.name for g in skin.vertex_groups]
dom=[names[max(v.groups,key=lambda g:g.weight).group] for v in skin.data.vertices]
influences=max(sum(1 for g in v.groups if g.weight>1e-6) for v in skin.data.vertices)
G={'beak':{'beak','beak_chip'},'head':{'head','lid_L','brow_R','peel','flap_R','flap_B','flap_L'},'body':{'hips','chest'},
   'neck':{'neck_1','neck_2','neck_3','neck_4'},'legs':{'leg_R','leg_L','shank_R','shank_L','foot_R','foot_L'},
   'legR':{'leg_R','shank_R','foot_R'},'legL':{'leg_L','shank_L','foot_L'},'tail':{'tail'},
   'wings':{'wing_R','wing_tip_R','wing_L','wing_tip_L'},'loot':{'loot','loot_chips'}}
PAIRS=[('beak','body'),('beak','legs'),('beak','wings'),('head','body'),('head','legs'),('neck','legs'),('legR','legL'),('tail','legs'),('wings','legs'),('loot','legs')]
polys=[list(p.vertices) for p in skin.data.polygons]
FG={k:[i for i,vs in enumerate(polys) if sum(dom[v] in bs for v in vs)*2>len(vs)] for k,bs in G.items()}
LINKS=[('leg_R','shank_R'),('shank_R','foot_R'),('leg_L','shank_L'),('shank_L','foot_L')]
clips={}
for tr in arm.animation_data.nla_tracks:
 arm.animation_data.action=tr.strips[0].action;end=int(tr.strips[0].action_frame_end)
 rec={'frames':end+1,'overlaps':{a+'~'+b:0 for a,b in PAIRS},'overlap_frames':{},'max_joint_gap_m':0.0,'lowest_m':9.0}
 for f in range(end+1):
  sc.frame_set(f);dg=bpy.context.evaluated_depsgraph_get();ev=skin.evaluated_get(dg);me=ev.to_mesh()
  co=[ev.matrix_world@v.co for v in me.vertices]
  rec['lowest_m']=min(rec['lowest_m'],min(p.z for p in co))
  trees={k:BVHTree.FromPolygons(co,[polys[i] for i in idx],all_triangles=False) for k,idx in FG.items()}
  for a,b in PAIRS:
   n=len(trees[a].overlap(trees[b]));rec['overlaps'][a+'~'+b]+=n
   if n:rec['overlap_frames'].setdefault(a+'~'+b,[]).append(f)
  for p,c in LINKS:rec['max_joint_gap_m']=max(rec['max_joint_gap_m'],(arm.pose.bones[p].tail-arm.pose.bones[c].head).length)
  ev.to_mesh_clear()
 rec['lowest_m']=round(rec['lowest_m'],5);clips[tr.name]=rec
arm.animation_data.action=None;sc.frame_set(0)
checks={'no_listed_part_overlaps_any_frame':all(n==0 for r in clips.values() for n in r['overlaps'].values()),
 'limb_joints_stay_connected':all(r['max_joint_gap_m']<1e-4 for r in clips.values()),
 'no_floor_penetration':all(r['lowest_m']>=-1e-5 for r in clips.values()),
 'rest_controls_reproduce_bind_pose':construction['rest_reproduction_max_error']<1e-4,
 'at_most_four_influences':influences<=4,'five_clips':sorted(clips)==sorted(['idle','move','attack','hit','defeat'])}
record={'asset_id':'bin-chicken','version':'v001','glb_sha256':glb,'blend_sha256':hashlib.sha256((ROOT/'bin-chicken.blend').read_bytes()).hexdigest(),
 'method':__doc__.strip(),'pairs':[a+'~'+b for a,b in PAIRS],'groups':{k:sorted(v) for k,v in G.items()},'group_face_counts':{k:len(v) for k,v in FG.items()},
 'max_influences':influences,'rest_reproduction_max_error':construction['rest_reproduction_max_error'],'clips':clips,'checks':checks}
(ROOT/'attachment-inspection.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'checks':checks,'overlaps':{k:{p:n for p,n in v['overlaps'].items() if n} for k,v in clips.items()},'frames':{k:v['overlap_frames'] for k,v in clips.items()},'lowest':{k:v['lowest_m'] for k,v in clips.items()},'gaps':{k:v['max_joint_gap_m'] for k,v in clips.items()}}))
