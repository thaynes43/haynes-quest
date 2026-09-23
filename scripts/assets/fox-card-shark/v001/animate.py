"""WO102 five baked old-motor clips with level feet and card-presentation targets.

Analytic limb targets are baked to ordinary bone transforms; no runtime IK,
root motion, disappearing scale or exported constraints are required.
"""
import bpy, json, math, hashlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler

ROOT=Path('/workspace/haynes-quest/rat-casino-cast/fox-card-shark/v001')
assert bpy.context.scene.get('work_order')=='WO102' and bpy.context.scene.get('scene_lease')=='active'
data=json.loads((ROOT/'source/rig-rest.json').read_text())
REST=data['rest'];factor=data['factor'];low=data['ground'];FPS=60
arm=bpy.data.objects['Fox_Card_Shark_Rig'];skin=bpy.data.objects['Fox_Card_Shark_Skin']
CLIPS=[('idle',2.8,True),('move',1.4,True),('attack',2.0,False),('hit',.7,False),('defeat',2.4,False)]

def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
def pulse(t,c,w):return smooth(1-abs(t-c)/w)
def lerp(a,b,t):return Vector(a).lerp(Vector(b),t)
def scaled(p):p=Vector(p);return Vector((p.x*factor,p.y*factor,(p.z-low)*factor))
def keyed(t,keys):
 for (a,x),(b,y) in zip(keys,keys[1:]):
  if t<=b:return lerp(x,y,smooth((t-a)/(b-a)))
 return Vector(keys[-1][1])
def solve_two(a,target,l1,l2,pole):
 delta=target-a;distance=min(max(delta.length,.00001),l1+l2-.000001);direction=delta.normalized();target=a+direction*distance
 side=Vector(pole)-direction*direction.dot(Vector(pole))
 if side.length<.0001:side=Vector((0,1,0))-direction*direction.y
 side.normalize();along=(l1*l1-l2*l2+distance*distance)/(2*distance)
 return a+direction*along+side*math.sqrt(max(0,l1*l1-along*along)),target

def evaluate(clip,t):
 tau=math.tau*t;sw=math.sin(tau);co=math.cos(tau)
 hips_shift=Vector((0,0,-.024));body_rot=Vector((0,0,0));head_rot=Vector((0,0,0));jaw=-.008
 hands={s:Vector(REST['hand_'+s][0]) for s in ('R','L')}
 feet={s:Vector(REST['foot_'+s][0])+Vector((0,0,.002)) for s in ('R','L')}
 hand_rot={s:Vector((0,0,0)) for s in ('R','L')}
 ear_motion=0;tail_base=Vector((0,0,0));tail_tip=Vector((0,0,0));settle=0
 if clip=='idle':
  hips_shift.z+=.003*(1-co);body_rot.y=.005*sw;body_rot.z=.005*sw
  delay=pulse(t,.40,.12)-pulse(t,.66,.13)
  head_rot=Vector((.009*sw,-.009*sw,.025*sw+.018*delay));ear_motion=.019*delay
  hands['L']+=Vector((.004*sw,.003*(1-co),.007*sw));hands['R']+=Vector((-.004*sw,.004*sw,.004*sw))
  hand_rot['L'].y=.014*sw;tail_base.x=.006*(1-co);tail_tip.z=.014*sw
 elif clip=='move':
  hips_shift.z=-.043+.006*(1-math.cos(tau*2));body_rot.y=.018*sw;body_rot.z=.018*sw
  head_rot=Vector((.01*math.sin(tau*2),-.015*sw,.024*sw));ear_motion=.026*sw
  for label,sign in [('R',-1),('L',1)]:
   phase=tau+(0 if sign<0 else math.pi);step=math.sin(phase)
   feet[label]+=Vector((0,math.cos(phase)*.042,max(0,step)*.042))
   hands[label]+=Vector((sign*.008*sw,-sign*.028*co,.007*(1-co)))
  hands['L']+=Vector((.030,.010,-.025))
  hand_rot['L'].y=.015*sw;tail_base.z=.045*sw;tail_base.x=-.016*(1-co);tail_tip.x=.023*sw
 elif clip=='attack':
  sec=t*2;windup=smooth(sec/.85);strike=smooth((sec-1.08)/.17);recovery=smooth((sec-1.43)/.57)
  body_rot=Vector((.030*windup-.082*strike+.052*recovery,0,-.045*windup+.065*strike-.020*recovery))
  head_rot=Vector((.040*windup-.095*strike+.055*recovery,.020*windup*(1-recovery),.024*windup*(1-recovery)))
  ear_motion=.025*windup-.054*strike+.029*recovery;jaw=-.008-.030*strike*(1-recovery)
  hips_shift.z-=.012*strike*(1-recovery)
  hands['L']=keyed(sec,[(0,REST['hand_L'][0]),(.85,(.492,.145,1.25)),(1.08,(.492,.145,1.25)),(1.25,(.59,.34,1.08)),(1.35,(.59,.34,1.08)),(1.52,(.44,.35,1.00)),(2,REST['hand_L'][0])])
  hand_rot['L']=keyed(sec,[(0,(0,0,0)),(.85,(-.07,-.22,.09)),(1.08,(-.07,-.22,.09)),(1.25,(-.35,.08,-.05)),(1.35,(-.35,.08,-.05)),(1.52,(-.20,.18,-.06)),(2,(0,0,0))])
  hands['R']=keyed(sec,[(0,REST['hand_R'][0]),(.85,(-.43,-.15,1.005)),(1.08,(-.43,-.15,1.005)),(1.25,(-.43,.18,.93)),(1.43,(-.43,.18,.93)),(2,REST['hand_R'][0])])
  hand_rot['R'].x=.20*windup-.27*strike+.07*recovery
  tail_base=Vector((-.035*windup,.05*windup*(1-recovery),-.04*windup*(1-recovery)))
 elif clip=='hit':
  recoil=pulse(t,.25,.40);hips_shift+=Vector((0,-.018*recoil,-.018*recoil));body_rot.x=.085*recoil
  head_rot=Vector((.135*recoil,.026*recoil,-.065*recoil));ear_motion=-.085*recoil;jaw=-.055*recoil
  for label,sign in [('R',-1),('L',1)]:hands[label]+=Vector((sign*.046*recoil,-.025*recoil,.055*recoil))
  hand_rot['L'].y=-.11*recoil;tail_base.x=-.11*recoil
 elif clip=='defeat':
  startle=pulse(t,.15,.18);settle=smooth((t-.24)/.49)
  hips_shift+=Vector((0,-.023*settle,-.092*settle));body_rot=Vector((-.21*settle+.063*startle,.020*settle,.030*settle))
  head_rot=Vector((-.35*settle+.085*startle,.045*settle,-.14*settle));ear_motion=-.15*settle;jaw=-.045*settle-.026*startle
  hands['L']=lerp(hands['L'],(.435,.23,.64),settle)+Vector((0,0,.055*startle))
  hands['R']=lerp(hands['R'],(-.415,.09,.59),settle)+Vector((0,0,.05*startle))
  hand_rot['L']=Vector((-.12*settle,1.62*settle,-.08*settle));hand_rot['R'].y=.05*settle
  tail_base=Vector((-.22*settle,.17*settle,-.10*settle));tail_tip=Vector((-.48*settle,.12*settle,-.06*settle))
 matrices={}
 def put(name,matrix):
  pb=arm.pose.bones[name];rest=pb.bone.matrix_local
  prefix=matrices[pb.parent.name]@pb.parent.bone.matrix_local.inverted()@rest if pb.parent else rest
  pb.matrix_basis=prefix.inverted()@matrix;matrices[name]=matrix
 def inherited(name,rot=(0,0,0)):
  pb=arm.pose.bones[name];parent=pb.parent;base=matrices[parent.name]@parent.bone.matrix_local.inverted()@pb.bone.matrix_local
  put(name,Matrix.Translation(base.translation)@Euler(rot).to_matrix().to_4x4()@base.to_3x3().to_4x4())
 def orient(name,head,tail):
  pb=arm.pose.bones[name];direction=(pb.bone.tail_local-pb.bone.head_local).normalized();q=direction.rotation_difference((tail-head).normalized())
  put(name,Matrix.Translation(head)@q.to_matrix().to_4x4()@pb.bone.matrix_local.to_3x3().to_4x4())
 put('root',arm.data.bones['root'].matrix_local.copy())
 hips=arm.data.bones['hips'].matrix_local.copy();hips.translation+=hips_shift*factor;put('hips',hips)
 inherited('chest',body_rot);inherited('neck');inherited('head',head_rot);inherited('jaw',(jaw,0,0))
 for label,sign in [('R',-1),('L',1)]:inherited('ear_'+label,(ear_motion*.25,sign*ear_motion,.005*ear_motion))
 inherited('tail_base',tail_base);inherited('tail_tip',tail_tip)
 for label,sign in [('R',-1),('L',1)]:
  inherited('clavicle_'+label);cb=arm.data.bones['clavicle_'+label];shoulder=matrices['clavicle_'+label]@Vector((0,cb.length,0))
  a=arm.data.bones['upper_arm_'+label];b=arm.data.bones['forearm_'+label]
  elbow,wrist=solve_two(shoulder,scaled(hands[label]),a.length,b.length,(sign,.04,-.65))
  orient('upper_arm_'+label,shoulder,elbow);orient('forearm_'+label,elbow,wrist)
  put('hand_'+label,Matrix.Translation(wrist)@Euler(hand_rot[label]).to_matrix().to_4x4()@arm.data.bones['hand_'+label].matrix_local.to_3x3().to_4x4())
  a=arm.data.bones['thigh_'+label];b=arm.data.bones['shin_'+label];hip=matrices['hips']@arm.data.bones['hips'].matrix_local.inverted()@a.head_local
  knee,ankle=solve_two(hip,scaled(feet[label]),a.length,b.length,(0,1,.18));orient('thigh_'+label,hip,knee);orient('shin_'+label,knee,ankle)
  foot=arm.data.bones['foot_'+label].matrix_local.copy();foot.translation=ankle;put('foot_'+label,foot)
 inherited('prop_cards')

scene=bpy.context.scene;scene.render.fps=FPS;scene.frame_start=0;scene.frame_end=84
arm.animation_data_clear();arm.animation_data_create()
for action in list(bpy.data.actions):bpy.data.actions.remove(action)
for pb in arm.pose.bones:pb.rotation_mode='QUATERNION'
records=[]
for name,duration,loop in CLIPS:
 action=bpy.data.actions.new(name);arm.animation_data.action=action;end=round(duration*FPS)
 for frame in range(end+1):
  scene.frame_set(frame);evaluate(name,frame/end)
  for pb in arm.pose.bones:
   if pb.name=='root':continue
   for field in ('location','rotation_quaternion'):pb.keyframe_insert(data_path=field,frame=frame,group=pb.name)
 for fc in action.fcurves:
  for k in fc.keyframe_points:k.interpolation='LINEAR'
 track=arm.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,0,action);strip.action_frame_start=0;strip.action_frame_end=end;track.mute=True
 records.append({'name':name,'duration_s':duration,'loop':loop,'clamp_when_finished':not loop,'contact_time_s':1.25 if name=='attack' else None,'contact_fraction':.625 if name=='attack' else None,'held_final_pose_from_s':1.766667 if name=='defeat' else None})
arm.animation_data.action=None
for pb in arm.pose.bones:pb.matrix_basis=Matrix.Identity(4)
scene.frame_set(0);bpy.context.view_layer.update()
arm['attack_contact_seconds']=1.25;arm['attack_contact_fraction']=.625
bounds_path=ROOT/'source/bounds.json'
if bounds_path.exists():
 bounds_record=json.loads(bounds_path.read_text());skin['model_space_bounds_y_up']=bounds_record['safe_culling_envelope'];skin['bounds_method']=bounds_record['method']
for name in ('build.py','common.py','animate.py'):
 old=bpy.data.texts.get('WO102 '+name)
 if old:bpy.data.texts.remove(old)
 block=bpy.data.texts.new('WO102 '+name);block.write((ROOT/'source'/name).read_text())
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'fox-card-shark.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'fox-card-shark.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_def_bones=False,export_armature_object_remove=True,export_all_influences=False,export_influence_nb=4,export_apply=False,export_texcoords=True,export_normals=True,export_tangents=False,export_materials='EXPORT',export_vertex_color='NONE',export_image_format='AUTO',export_all_vertex_colors=False,export_cameras=False,export_lights=False,export_extras=True,export_force_sampling=True,export_frame_range=False,export_frame_step=1,export_optimize_animation_size=True,export_current_frame=False,export_rest_position_armature=True,export_anim_slide_to_zero=True,export_draco_mesh_compression_enable=False)
record=json.loads((ROOT/'construction.json').read_text());record['clips']=records;record['bone_count']=len(arm.data.bones)
if bounds_path.exists():record['bounds_evidence']=bounds_record
record['export_bake_fps']=FPS
record['contact_bake_note']='60 Hz baking places the 1.25 s card snap exactly on frame 75.'
record['rig']='One skin with rigid padded shell islands and two-weight flexible tail. Analytic two-bone limb targets bake to local transforms with level feet and hand-parented card fan. No locomotion track or runtime IK.'
record['bounds_blender']={k:[fn(v.co[i] for v in skin.data.vertices) for i in range(3)] for k,fn in [('min',min),('max',max)]}
record['files']={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [ROOT/'fox-card-shark.blend',ROOT/'fox-card-shark.glb',ROOT/'pigment.png']}
record['lead_review_corrections']=['Closed lower vest/shirt overlap.','Replaced overlapping tail-tip shells with continuous abutting padded sections.','Moved the contact fan farther outside the body silhouette while retaining forward extension after lead gameplay-scale review.']
(ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'clips':records,'files':record['files']}))
