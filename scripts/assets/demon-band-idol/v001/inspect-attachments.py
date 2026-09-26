"""WO111 demon-band-idol source-side attachment audit on the live scene that exported the exact GLB.

Per clip and frame (30 fps): triangle-overlap between listed part groups on the evaluated skin (BVH),
IK joint connectivity (limb heads stay on their parents' tails), the lowest evaluated vertex, and the
rest reproduction error. Intended contacts are not tested: the right fist round the mic handle, the left
fist on the hip, sleeve roots inside the jacket and epaulettes, trouser tops inside the seat, strands on
the hair cap, the tail root in the seat. Supplements the exact-GLB checks in three-inspection.json; not a
universal collision proof. Adapted from the rival-mayor v001 audit."""
import bpy,json,hashlib
from pathlib import Path
from mathutils.bvhtree import BVHTree
ROOT=Path('/workspace/haynes-quest/family-eras/demon-band-idol/v001')
arm=bpy.data.objects['Demon_Band_Idol_Rig'];skin=bpy.data.objects['Demon_Band_Idol_Skin'];sc=bpy.context.scene
assert sc.get('work_order')=='WO111' and sc.get('asset_id')=='demon-band-idol' and sc.get('scene_lease')=='active'
construction=json.loads((ROOT/'construction.json').read_text())
glb=hashlib.sha256((ROOT/'demon-band-idol.glb').read_bytes()).hexdigest()
assert construction['files']['demon-band-idol.glb']['sha256']==glb,'construction record does not match the GLB on disk'
names=[g.name for g in skin.vertex_groups]
dom=[names[max(v.groups,key=lambda g:g.weight).group] for v in skin.data.vertices]
influences=max(sum(1 for g in v.groups if g.weight>1e-6) for v in skin.data.vertices)
G={'mic':{'mic'},'burst':{'burst'},'charm':{'charm'},'head':{'head','ear_R','ear_L','earring','fringe_1','fringe_2'},'body':{'hips','spine','chest'},
   'armR':{'forearm_R','hand_R'},'armL':{'forearm_L','hand_L'},'upperR':{'upper_arm_R'},'upperL':{'upper_arm_L'},
   'legR':{'thigh_R','shin_R','foot_R'},'legL':{'thigh_L','shin_L','foot_L'},'legs':{'thigh_R','shin_R','foot_R','thigh_L','shin_L','foot_L'},
   'shins':{'shin_R','foot_R','shin_L','foot_L'},'tail':{'tail_2','tail_3','tail_4'},'sparkles':{'sparkle_R','sparkle_L'},'bow':{'bow_1','bow_2'}}
PAIRS=[('mic','head'),('mic','body'),('mic','legs'),('burst','head'),('burst','body'),('burst','armL'),('charm','body'),('armR','head'),('armL','head'),
       ('armL','legL'),('sparkles','head'),('tail','legs'),('tail','body'),('legR','legL'),('bow','shins')]
polys=[list(p.vertices) for p in skin.data.polygons]
FG={k:[i for i,vs in enumerate(polys) if sum(dom[v] in bs for v in vs)*2>len(vs)] for k,bs in G.items()}
# part-based groups from the per-face 'dbi_part' index written by build.py (construction.json 'parts' order)
part=[0]*len(polys);skin.data.attributes['dbi_part'].data.foreach_get('value',part)
pnames=[r['name'] for r in construction['parts']];pid=lambda n:pnames.index(n)
FACE_PART=pid('Lavender idol head with painted wink face')
FG['face_skin']=[i for i in range(len(polys)) if part[i]==FACE_PART]
FG['fringe']=[i for i in range(len(polys)) if pnames[part[i]].startswith('Fringe swoop') and sum(dom[v] in ('fringe_1','fringe_2') for v in polys[i])*2>len(polys[i])]
G['face_skin']={'part: '+pnames[FACE_PART]};G['fringe']={'fringe_1/fringe_2-dominant faces of the two fringe swoop strands'}
PAIRS.append(('fringe','face_skin'));PAIRS.append(('sparkles','face_skin'))
LINKS=[('upper_arm_R','forearm_R'),('forearm_R','hand_R'),('upper_arm_L','forearm_L'),('forearm_L','hand_L'),('thigh_R','shin_R'),('shin_R','foot_R'),('thigh_L','shin_L'),('shin_L','foot_L')]
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
 'idle_0_reproduces_sheet_pose':all(v<1e-4 for v in construction['sheet_pose_reproduction_m'].values()),
 'at_most_four_influences':influences<=4,'five_clips':sorted(clips)==sorted(['idle','move','attack','hit','defeat'])}
record={'asset_id':'demon-band-idol','version':'v001','glb_sha256':glb,'blend_sha256':hashlib.sha256((ROOT/'demon-band-idol.blend').read_bytes()).hexdigest(),
 'method':__doc__.strip(),'pairs':[a+'~'+b for a,b in PAIRS],'groups':{k:sorted(v) for k,v in G.items()},'group_face_counts':{k:len(v) for k,v in FG.items()},
 'max_influences':influences,'rest_reproduction_max_error':construction['rest_reproduction_max_error'],'sheet_pose_reproduction_m':construction['sheet_pose_reproduction_m'],'clips':clips,'checks':checks}
(ROOT/'attachment-inspection.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'checks':checks,'overlaps':{k:{p:n for p,n in v['overlaps'].items() if n} for k,v in clips.items()},'frames':{k:v['overlap_frames'] for k,v in clips.items()},'lowest':{k:v['lowest_m'] for k,v in clips.items()},'gaps':{k:v['max_joint_gap_m'] for k,v in clips.items()}}))
