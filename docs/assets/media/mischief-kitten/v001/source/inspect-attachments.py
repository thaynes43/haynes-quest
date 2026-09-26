"""WO111 mischief-kitten source-side attachment audit on the live scene that exported the exact GLB.

Per clip and frame (30 fps): triangle-overlap between listed part groups on the evaluated skin (BVH),
IK joint connectivity (limb heads stay on their parents' tails), the lowest evaluated vertex, and the
rest reproduction error. Intended contacts are not tested: leg roots inside the body and haunches, paws
on the floor, the collar around the head, the pack and straps on the back, the hat on the head.
Supplements the exact-GLB checks in three-inspection.json; not a universal collision proof."""
import bpy,json,hashlib
from pathlib import Path
from mathutils.bvhtree import BVHTree
ROOT=Path('/workspace/haynes-quest/family-eras/mischief-kitten/v001')
arm=bpy.data.objects['Mischief_Kitten_Rig'];skin=bpy.data.objects['Mischief_Kitten_Skin'];sc=bpy.context.scene
assert sc.get('work_order')=='WO111' and sc.get('asset_id')=='mischief-kitten' and sc.get('scene_lease')=='active'
construction=json.loads((ROOT/'construction.json').read_text())
glb=hashlib.sha256((ROOT/'mischief-kitten.glb').read_bytes()).hexdigest()
assert construction['files']['mischief-kitten.glb']['sha256']==glb,'construction record does not match the GLB on disk'
names=[g.name for g in skin.vertex_groups]
dom=[names[max(v.groups,key=lambda g:g.weight).group] for v in skin.data.vertices]
influences=max(sum(1 for g in v.groups if g.weight>1e-6) for v in skin.data.vertices)
T=['tail_%d'%i for i in range(1,7)]
G={'tail':set(T),'tail_tip':{'tail_4','tail_5','tail_6'},'head':{'head','ear_R','ear_L','tongue'},'hat':{'hat'},'pack':{'pack','antenna_1','antenna_2','propeller'},
   'bell':{'bell'},'frontR':{'front_upper_R','front_lower_R','front_paw_R'},'frontL':{'front_upper_L','front_lower_L','front_paw_L'},
   'hindR':{'hind_thigh_R','hind_shin_R','hind_paw_R'},'hindL':{'hind_thigh_L','hind_shin_L','hind_paw_L'},'pawsF':{'front_paw_R','front_paw_L'},'body':{'hips','chest'}}
PAIRS=[('tail_tip','head'),('tail_tip','hat'),('tail_tip','pack'),('tail','hindR'),('tail','hindL'),('pack','head'),('pack','hat'),('hat','head_ears'),
       ('frontR','frontL'),('hindR','hindL'),('frontR','hindR'),('frontL','hindL'),('pawsF','head'),('frontR','bell'),('frontL','bell'),('bell','head')]
G['head_ears']={'ear_R','ear_L'}
polys=[list(p.vertices) for p in skin.data.polygons]
FG={k:[i for i,vs in enumerate(polys) if sum(dom[v] in bs for v in vs)*2>len(vs)] for k,bs in G.items()}
LINKS=[('front_upper_R','front_lower_R'),('front_lower_R','front_paw_R'),('front_upper_L','front_lower_L'),('front_lower_L','front_paw_L'),
       ('hind_thigh_R','hind_shin_R'),('hind_shin_R','hind_paw_R'),('hind_thigh_L','hind_shin_L'),('hind_shin_L','hind_paw_L')]+[(T[i],T[i+1]) for i in range(5)]
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
  # tails of a chain follow their heads: IK limbs and the tail chain are unconnected bones, so check explicitly
  for p,c in LINKS:
   gap=(arm.pose.bones[p].tail-arm.pose.bones[c].head).length if p.startswith('tail') else (arm.pose.bones[p].tail-arm.pose.bones[c].head).length
   rec['max_joint_gap_m']=max(rec['max_joint_gap_m'],gap)
  ev.to_mesh_clear()
 rec['lowest_m']=round(rec['lowest_m'],5);clips[tr.name]=rec
arm.animation_data.action=None;sc.frame_set(0)
checks={'no_listed_part_overlaps_any_frame':all(n==0 for r in clips.values() for n in r['overlaps'].values()),
 'limb_and_tail_joints_stay_connected':all(r['max_joint_gap_m']<1e-4 for r in clips.values()),
 'no_floor_penetration':all(r['lowest_m']>=-1e-5 for r in clips.values()),
 'rest_controls_reproduce_bind_pose':construction['rest_reproduction_max_error']<1e-4,
 'at_most_four_influences':influences<=4,'five_clips':sorted(clips)==sorted(['idle','move','attack','hit','defeat'])}
record={'asset_id':'mischief-kitten','version':'v001','glb_sha256':glb,'blend_sha256':hashlib.sha256((ROOT/'mischief-kitten.blend').read_bytes()).hexdigest(),
 'method':__doc__.strip(),'pairs':[a+'~'+b for a,b in PAIRS],'groups':{k:sorted(v) for k,v in G.items()},'group_face_counts':{k:len(v) for k,v in FG.items()},
 'max_influences':influences,'rest_reproduction_max_error':construction['rest_reproduction_max_error'],'clips':clips,'checks':checks}
(ROOT/'attachment-inspection.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'checks':checks,'lowest':{k:v['lowest_m'] for k,v in clips.items()},'gaps':{k:v['max_joint_gap_m'] for k,v in clips.items()},'overlaps':{k:{a:b for a,b in v['overlap_frames'].items()} for k,v in clips.items()}}))
