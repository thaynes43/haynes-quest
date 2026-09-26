"""WO111 inator-monster source-side attachment audit on the live scene that exported the exact GLB.

Per clip and frame (30 fps): triangle overlap between listed part groups on the evaluated skin (BVH), joint
connectivity (IK legs, the tail chain and the FK arms/antenna keep each head on its parent's tail), the lowest
evaluated vertex, and the rest reproduction error. Intended contacts are not tested: the leg tops and the tail
root inside the torso, the soles and the tail on the floor, the pilot's coat inside the tub, the antenna rod
through the brass port (three-inspection.json checks it against the port), the pilot's hand on the rim in
the attack recovery, and the back of the monster's head tucked against the outside of the tub below the cockpit
floor (the approved blockout's design contact). Instead, every frame checks that no head vertex rises above the
cockpit floor inside the rim, in the posed cockpit frame, and that the pilot's head stays inside the glass. Supplements the exact-GLB checks; not a universal collision proof. Adapted from mischief-kitten."""
import bpy,json,hashlib
from mathutils import Matrix
from pathlib import Path
from mathutils.bvhtree import BVHTree
ROOT=Path('/workspace/haynes-quest/family-eras/inator-monster/v001')
arm=bpy.data.objects['Inator_Monster_Rig'];skin=bpy.data.objects['Inator_Monster_Skin'];sc=bpy.context.scene
assert sc.get('work_order')=='WO111' and sc.get('asset_id')=='inator-monster' and sc.get('scene_lease')=='active'
construction=json.loads((ROOT/'construction.json').read_text())
glb=hashlib.sha256((ROOT/'inator-monster.glb').read_bytes()).hexdigest()
assert construction['files']['inator-monster.glb']['sha256']==glb,'construction record does not match the GLB on disk'
names=[g.name for g in skin.vertex_groups]
dom=[names[max(v.groups,key=lambda g:g.weight).group] for v in skin.data.vertices]
influences=max(sum(1 for g in v.groups if g.weight>1e-6) for v in skin.data.vertices)
glass=[p.material_index==[i for i,m in enumerate(skin.data.materials) if 'glass' in m.name.lower()][0] for p in skin.data.polygons]
G={'tail_far':{'tail_2','tail_3','tail_4','tail_5'},'legR':{'thigh_R','shin_R','foot_R'},'legL':{'thigh_L','shin_L','foot_L'},'feet':{'foot_R','foot_L'},
   'head':{'head','jaw','tongue','pupil_R','pupil_L'},'cockpit':{'cockpit'},'dome_glass':{'dome'},
   'pilot_upper':{'pilot_head','pilot_upper_R','pilot_lower_R','pilot_upper_L','pilot_lower_L','pilot_hand_L'},'arm_lower':{'arm_lower_R','arm_lower_L'},'tab':{'zipper_tab'}}
PAIRS=[('tail_far','legR'),('tail_far','legL'),('legR','legL'),('feet','tail_far'),('head','dome_glass'),('pilot_upper','dome_glass'),('arm_lower','head')]
polys=[list(p.vertices) for p in skin.data.polygons]
HEADV=[i for i,b in enumerate(dom) if b in G['head']];PILOTV=[i for i,b in enumerate(dom) if b=='pilot_head']
CK_REST=arm.data.bones['cockpit'].matrix_local.copy();DOME_REST=arm.data.bones['dome'].matrix_local.copy()
from mathutils import Vector
CKC=Vector((0,-0.12,2.34))
def members(k,bs):
 idx=[i for i,vs in enumerate(polys) if sum(dom[v] in bs for v in vs)*2>len(vs)]
 if k=='dome_glass':idx=[i for i in idx if glass[i]]   # the glass shell only, not the brass port ring
 return idx
FG={k:members(k,bs) for k,bs in G.items()}
LINKS=[('thigh_R','shin_R'),('shin_R','foot_R'),('thigh_L','shin_L'),('shin_L','foot_L'),('arm_upper_R','arm_lower_R'),('arm_upper_L','arm_lower_L'),
       ('pilot_upper_R','pilot_lower_R'),('pilot_lower_R','remote'),('remote','antenna_1'),('antenna_1','antenna_2'),('antenna_2','antenna_3'),
       ('pilot_upper_L','pilot_lower_L'),('pilot_lower_L','pilot_hand_L')]+[('tail_%d'%i,'tail_%d'%(i+1)) for i in range(1,5)]
clips={}
for tr in arm.animation_data.nla_tracks:
 arm.animation_data.action=tr.strips[0].action;end=int(tr.strips[0].action_frame_end)
 rec={'frames':end+1,'overlaps':{a+'~'+b:0 for a,b in PAIRS},'overlap_frames':{},'max_joint_gap_m':0.0,'lowest_m':9.0,'head_verts_in_cockpit':0,'max_pilot_head_radius_in_dome_m':0.0}
 for f in range(end+1):
  sc.frame_set(f);dg=bpy.context.evaluated_depsgraph_get();ev=skin.evaluated_get(dg);me=ev.to_mesh()
  co=[ev.matrix_world@v.co for v in me.vertices]
  rec['lowest_m']=min(rec['lowest_m'],min(p.z for p in co))
  trees={k:BVHTree.FromPolygons(co,[polys[i] for i in idx],all_triangles=False) for k,idx in FG.items()}
  for a,b in PAIRS:
   n=len(trees[a].overlap(trees[b]));rec['overlaps'][a+'~'+b]+=n
   if n:rec['overlap_frames'].setdefault(a+'~'+b,[]).append(f)
  ck=CK_REST@(arm.matrix_world@arm.pose.bones['cockpit'].matrix).inverted()
  for i in HEADV:
   q=ck@co[i]-CKC
   if q.z>0 and (q.x*q.x+q.y*q.y)**.5<0.455:rec['head_verts_in_cockpit']+=1
  if arm.pose.bones['dome'].matrix_basis.to_quaternion().angle<0.06:
   dm=DOME_REST@(arm.matrix_world@arm.pose.bones['dome'].matrix).inverted()
   rec['max_pilot_head_radius_in_dome_m']=max(rec['max_pilot_head_radius_in_dome_m'],max((dm@co[i]-CKC).length for i in PILOTV))
  for p,c in LINKS:rec['max_joint_gap_m']=max(rec['max_joint_gap_m'],(arm.pose.bones[p].tail-arm.pose.bones[c].head).length)
  ev.to_mesh_clear()
 rec['lowest_m']=round(rec['lowest_m'],5);clips[tr.name]=rec
arm.animation_data.action=None
for pb in arm.pose.bones:pb.matrix_basis=Matrix.Identity(4)
sc.frame_set(0)
checks={'no_listed_part_overlaps_any_frame':all(n==0 for r in clips.values() for n in r['overlaps'].values()),
 'limb_tail_and_antenna_joints_stay_connected':all(r['max_joint_gap_m']<1e-4 for r in clips.values()),
 'no_floor_penetration':all(r['lowest_m']>=-1e-5 for r in clips.values()),
 'head_never_enters_the_cockpit':all(r['head_verts_in_cockpit']==0 for r in clips.values()),
 'pilot_head_inside_the_closed_glass':all(r['max_pilot_head_radius_in_dome_m']<0.48 for r in clips.values()),
 'rest_controls_reproduce_bind_pose':construction['rest_reproduction_max_error']<1e-4,
 'at_most_four_influences':influences<=4,'five_clips':sorted(clips)==sorted(['idle','move','attack','hit','defeat'])}
record={'asset_id':'inator-monster','version':'v001','glb_sha256':glb,'blend_sha256':hashlib.sha256((ROOT/'inator-monster.blend').read_bytes()).hexdigest(),
 'method':__doc__.strip(),'pairs':[a+'~'+b for a,b in PAIRS],'groups':{k:sorted(v) for k,v in G.items()},'group_face_counts':{k:len(v) for k,v in FG.items()},
 'max_influences':influences,'rest_reproduction_max_error':construction['rest_reproduction_max_error'],'clips':clips,'checks':checks}
(ROOT/'attachment-inspection.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'checks':checks,'lowest':{k:v['lowest_m'] for k,v in clips.items()},'gaps':{k:v['max_joint_gap_m'] for k,v in clips.items()},'pilot_r':{k:v['max_pilot_head_radius_in_dome_m'] for k,v in clips.items()},'overlaps':{k:{a:b for a,b in v['overlap_frames'].items()} for k,v in clips.items()},'faces':record['group_face_counts']}))
