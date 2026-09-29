"""WO111 web-slinger-helper source-side attachment audit on the live scene that exported the exact GLB.

Per clip and frame (30 fps): triangle-overlap between listed part groups on the evaluated skin (BVH), IK joint
connectivity (limb heads stay on their parents' tails), the lowest evaluated vertex, and the rest/sheet/defeat
reproduction errors. Intended contacts are not tested: the left fist pressed onto the hip in the sheet pose (fist ~
body), the left mitten tapping the right cuff's heart while charging, sleeve roots inside the shoulder balls, legging
tops inside the torso and seat, the hood's lower rim round the neck, the legging hems inside the boots. Rope pairs are not counted on the two or three defeat frames in which the
collapsed rope tangle springs open out of the left boot (its bone scale between 1 and 100); those frames and their
overlaps are recorded under rope_growth_*. Supplements the
exact-GLB checks in three-inspection.json; not a universal collision proof. Adapted from the demon-band-idol v001 audit."""
import bpy,json,hashlib
from pathlib import Path
from mathutils.bvhtree import BVHTree
ROOT=Path('/workspace/haynes-quest/family-eras/web-slinger-helper/v001')
arm=bpy.data.objects['Web_Slinger_Helper_Rig'];skin=bpy.data.objects['Web_Slinger_Helper_Skin'];sc=bpy.context.scene
assert sc.get('work_order')=='WO111' and sc.get('asset_id')=='web-slinger-helper' and sc.get('scene_lease')=='active'
construction=json.loads((ROOT/'construction.json').read_text())
glb=hashlib.sha256((ROOT/'web-slinger-helper.glb').read_bytes()).hexdigest()
assert construction['files']['web-slinger-helper.glb']['sha256']==glb,'construction record does not match the GLB on disk'
names=[g.name for g in skin.vertex_groups]
dom=[names[max(v.groups,key=lambda g:g.weight).group] for v in skin.data.vertices]
influences=max(sum(1 for g in v.groups if g.weight>1e-6) for v in skin.data.vertices)
G={'head':{'head','fringe','mask','eye_R','eye_L'},'body':{'hips','spine','chest'},
   'upperR':{'upper_arm_R'},'upperL':{'upper_arm_L'},'foreR':{'forearm_R','heart_R'},'foreL':{'forearm_L','heart_L'},
   'mittR':{'hand_R','fingers_R','thumb_R'},'mittL':{'hand_L','fingers_L','thumb_L'},
   'legR':{'thigh_R','shin_R'},'legL':{'thigh_L','shin_L'},'legs':{'thigh_R','shin_R','thigh_L','shin_L'},
   'footR':{'foot_R'},'footL':{'foot_L'},'coil':{'coil'},'rope':{'rope'}}
PAIRS=[('mittR','head'),('mittL','head'),('foreR','head'),('foreL','head'),('upperR','head'),('upperL','head'),
       ('mittR','body'),('mittR','legs'),('mittL','legs'),('foreR','body'),('mittR','mittL'),('legR','legL'),('footR','footL'),('footR','legL'),('footL','legR'),
       ('rope','footL'),('rope','footR'),('rope','legs'),('rope','body'),('rope','mittL'),('coil','legR'),('coil','mittR'),('coil','foreR'),('coil','body')]
polys=[list(p.vertices) for p in skin.data.polygons]
FG={k:[i for i,vs in enumerate(polys) if sum(dom[v] in bs for v in vs)*2>len(vs)] for k,bs in G.items()}
part=[0]*len(polys);skin.data.attributes['wsh_part'].data.foreach_get('value',part)
pnames=[r['name'] for r in construction['parts']];pid=lambda n:pnames.index(n)
FACE_PART=pid('Round face with the painted grin, blush and nose shade');MASK_PART=pid('Tangerine domino mask')
FG['face_skin']=[i for i in range(len(polys)) if part[i]==FACE_PART]
FG['fringe']=[i for i in range(len(polys)) if pnames[part[i]].startswith('Chestnut fringe') and sum(dom[v]=='fringe' for v in polys[i])*2>len(polys[i])]
FG['coil']=[i for i in range(len(polys)) if pnames[part[i]].startswith('Cream web-rope coil loop')]
G['coil']={'parts: the three cream coil loops (the clip sits on the belt by design)'}
FG['hood']=[i for i in range(len(polys)) if pnames[part[i]].startswith('Cobalt open-face hood') or pnames[part[i]]=='Cobalt hood face rim']
G['face_skin']={'part: '+pnames[FACE_PART]};G['fringe']={'fringe-dominant faces of the three chestnut locks'};G['hood']={'parts: hood shell and face rim'}
PAIRS+=[('fringe','face_skin'),('mittR','hood'),('mittL','hood')]
ROPE_REST_SCALE=0.01
LINKS=[('upper_arm_R','forearm_R'),('forearm_R','hand_R'),('upper_arm_L','forearm_L'),('forearm_L','hand_L'),('thigh_R','shin_R'),('shin_R','foot_R'),('thigh_L','shin_L'),('shin_L','foot_L')]
clips={}
for tr in arm.animation_data.nla_tracks:
 arm.animation_data.action=tr.strips[0].action;end=int(tr.strips[0].action_frame_end)
 rec={'frames':end+1,'overlaps':{a+'~'+b:0 for a,b in PAIRS},'overlap_frames':{},'max_joint_gap_m':0.0,'lowest_m':9.0,'rope_growth_frames':[],'rope_growth_overlaps':{}}
 for f in range(end+1):
  sc.frame_set(f);dg=bpy.context.evaluated_depsgraph_get();ev=skin.evaluated_get(dg);me=ev.to_mesh()
  co=[ev.matrix_world@v.co for v in me.vertices]
  rec['lowest_m']=min(rec['lowest_m'],min(p.z for p in co))
  trees={k:BVHTree.FromPolygons(co,[polys[i] for i in idx],all_triangles=False) for k,idx in FG.items() if idx}
  growing=1.0001<arm.pose.bones['rope'].scale.x<0.999/ROPE_REST_SCALE
  if growing:rec['rope_growth_frames'].append(f)
  for a,b in PAIRS:
   n=len(trees[a].overlap(trees[b]))
   if growing and 'rope' in (a,b):
    # the tangle springs open out of the left boot in two or three frames; recorded, not counted
    if n:rec['rope_growth_overlaps'].setdefault(a+'~'+b,[]).append([f,n])
    continue
   rec['overlaps'][a+'~'+b]+=n
   if n:rec['overlap_frames'].setdefault(a+'~'+b,[]).append(f)
  for p,c in LINKS:rec['max_joint_gap_m']=max(rec['max_joint_gap_m'],(arm.pose.bones[p].tail-arm.pose.bones[c].head).length)
  ev.to_mesh_clear()
 rec['lowest_m']=round(rec['lowest_m'],5);clips[tr.name]=rec
arm.animation_data.action=None;sc.frame_set(0)
checks={'no_listed_part_overlaps_any_frame':all(n==0 for r in clips.values() for n in r['overlaps'].values()),
 'limb_joints_stay_connected':all(r['max_joint_gap_m']<1e-4 for r in clips.values()),
 'no_floor_penetration':all(r['lowest_m']>=-1e-5 for r in clips.values()),
 'rest_controls_reproduce_bind_pose':construction['rest_reproduction_max_error']<1e-4,
 'idle_0_reproduces_sheet_pose':all(v<1e-4 for k,v in construction['sheet_pose_reproduction_m'].items()),
 'held_defeat_reproduces_the_rope_bound_feet':all(v<1e-4 for v in construction['defeat_feet_reproduction'].values()),
 'at_most_four_influences':influences<=4,'five_clips':sorted(clips)==sorted(['idle','move','attack','hit','defeat'])}
record={'asset_id':'web-slinger-helper','version':'v001','glb_sha256':glb,'blend_sha256':hashlib.sha256((ROOT/'web-slinger-helper.blend').read_bytes()).hexdigest(),
 'method':__doc__.strip(),'pairs':[a+'~'+b for a,b in PAIRS],'groups':{k:sorted(v) for k,v in G.items()},'group_face_counts':{k:len(v) for k,v in FG.items()},
 'max_influences':influences,'rest_reproduction_max_error':construction['rest_reproduction_max_error'],'sheet_pose_reproduction_m':construction['sheet_pose_reproduction_m'],'defeat_feet_reproduction':construction['defeat_feet_reproduction'],'clips':clips,'checks':checks}
(ROOT/'attachment-inspection.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'checks':checks,'overlaps':{k:{p:n for p,n in v['overlaps'].items() if n} for k,v in clips.items()},'frames':{k:v['overlap_frames'] for k,v in clips.items()},'lowest':{k:v['lowest_m'] for k,v in clips.items()},'gaps':{k:v['max_joint_gap_m'] for k,v in clips.items()},'rope_growth':{k:[v['rope_growth_frames'],v['rope_growth_overlaps']] for k,v in clips.items() if v['rope_growth_frames']}}))
