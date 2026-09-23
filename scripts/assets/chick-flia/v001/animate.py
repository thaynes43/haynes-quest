"""WO100 five baked old-motor clips with level feet and attached microphone.

Analytic limb targets are baked to ordinary bone transforms; no runtime IK,
root motion, disappearing scale or exported constraints are required.
"""
import bpy, json, math, hashlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler

ROOT=Path('/workspace/haynes-quest/rat-casino-cast/chick-flia/v001')
assert bpy.context.scene.get('work_order')=='WO100' and bpy.context.scene.get('scene_lease')=='active'
data=json.loads((ROOT/'source/rig-rest.json').read_text())
REST=data['rest'];factor=data['factor'];low=data['ground'];FPS=30
arm=bpy.data.objects['Chick_Flia_Rig'];skin=bpy.data.objects['Chick_Flia_Skin']
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
 hips_shift=Vector((0,0,-.022));body_rot=Vector((0,0,0));head_rot=Vector((0,0,0))
 hands={s:Vector(REST['hand_'+s][0]) for s in ('R','L')}
 feet={s:Vector(REST['foot_'+s][0])+Vector((0,0,.002)) for s in ('R','L')}
 hand_angle=0;jaw=-.012;settle=0
 if clip=='idle':
  hips_shift.z+=.003*(1-co);body_rot.y=.007*sw;body_rot.z=.006*sw
  # A short delayed return suggests an old head motor, without a startle.
  hesitation=pulse(t,.40,.11)-pulse(t,.62,.15)
  head_rot=Vector((.011*sw,-.013*sw,.022*sw+.018*hesitation))
  hands['L']+=Vector((.003*sw,.005*(1-co),.007*sw));hand_angle=.022*hesitation;jaw=-.012-.007*sw
 elif clip=='move':
  hips_shift.z=-.041+.006*(1-math.cos(tau*2));body_rot.y=.021*sw
  head_rot=Vector((.012*math.sin(tau*2),-.022*sw,.020*sw))
  for label,sgn in [('R',-1),('L',1)]:
   phase=tau+(0 if sgn<0 else math.pi);step=math.sin(phase)
   feet[label]+=Vector((0,math.cos(phase)*.044,max(0,step)*.045))
  hands['R']+=Vector((.003*sw,.024*co,.009+.008*(1-co)))
  hands['L']+=Vector((.004*sw,-.022*co,.006+.006*sw));hand_angle=.035*sw
 elif clip=='attack':
  rest=REST['hand_L'][0];wind=(.50,.02,1.365);contact=(.455,.26,1.245)
  hands['L']=keyed(t,[(0,rest),(.42,wind),(.54,wind),(.625,contact),(.68,contact),(.86,(.482,.15,.90)),(1,rest)])
  windup=pulse(t,.43,.43);gesture=pulse(t,.625,.23)
  hips_shift.z-=.017*gesture;body_rot.x=.035*windup-.06*gesture;body_rot.z=-.018*windup+.035*gesture
  head_rot=Vector((.055*windup-.065*gesture,.012*gesture,-.055*windup))
  hands['R']+=Vector((-.012*gesture,.013*gesture,.018*gesture))
  hand_angle=.07*windup-.38*gesture;jaw=-.028-.055*gesture
 elif clip=='hit':
  recoil=pulse(t,.26,.42);hips_shift+=Vector((0,-.018*recoil,-.024*recoil))
  body_rot.x=.105*recoil;head_rot=Vector((.13*recoil,.026*recoil,-.032*recoil))
  hands['L']+=Vector((.016*recoil,-.013*recoil,.082*recoil));hands['R'].z+=.028*recoil
  hand_angle=.16*recoil;jaw=-.10*recoil
 elif clip=='defeat':
  startle=pulse(t,.16,.18);settle=smooth((t-.24)/.49)
  hips_shift+=Vector((0,-.025*settle,-.108*settle))
  body_rot=Vector((-.105*settle+.07*startle,.018*settle,.02*settle))
  head_rot=Vector((-.24*settle+.08*startle,.04*settle,-.09*settle))
  hands['L']=lerp(hands['L'],(.455,.14,.54),settle)+Vector((0,0,.07*startle))
  hands['R']=lerp(hands['R'],(-.465,.085,.52),settle)+Vector((0,0,.03*startle))
  hand_angle=-.64*settle;jaw=-.092*settle-.035*startle
 matrices={}
 def put(name,matrix):
  pb=arm.pose.bones[name];rest=pb.bone.matrix_local
  prefix=matrices[pb.parent.name]@pb.parent.bone.matrix_local.inverted()@rest if pb.parent else rest
  pb.matrix_basis=prefix.inverted()@matrix;matrices[name]=matrix
 def inherited(name,rot=(0,0,0)):
  pb=arm.pose.bones[name];parent=pb.parent
  base=matrices[parent.name]@parent.bone.matrix_local.inverted()@pb.bone.matrix_local
  put(name,Matrix.Translation(base.translation)@Euler(rot).to_matrix().to_4x4()@base.to_3x3().to_4x4())
 def orient(name,head,tail):
  pb=arm.pose.bones[name];direction=(pb.bone.tail_local-pb.bone.head_local).normalized();q=direction.rotation_difference((tail-head).normalized())
  put(name,Matrix.Translation(head)@q.to_matrix().to_4x4()@pb.bone.matrix_local.to_3x3().to_4x4())
 put('root',arm.data.bones['root'].matrix_local.copy())
 hips=arm.data.bones['hips'].matrix_local.copy();hips.translation+=hips_shift*factor;put('hips',hips)
 inherited('chest',body_rot);inherited('neck');inherited('head',head_rot);inherited('jaw',(jaw,0,0))
 for label,s in [('R',-1),('L',1)]:
  inherited('clavicle_'+label);cb=arm.data.bones['clavicle_'+label];shoulder=matrices['clavicle_'+label]@Vector((0,cb.length,0))
  a=arm.data.bones['upper_wing_'+label];b=arm.data.bones['lower_wing_'+label]
  elbow,wrist=solve_two(shoulder,scaled(hands[label]),a.length,b.length,(s,.02,-.7))
  orient('upper_wing_'+label,shoulder,elbow);orient('lower_wing_'+label,elbow,wrist)
  hand=arm.data.bones['hand_'+label].matrix_local.copy();hand.translation=wrist
  if label=='L':hand=Matrix.Translation(wrist)@Euler((hand_angle,0,0)).to_matrix().to_4x4()@hand.to_3x3().to_4x4()
  put('hand_'+label,hand)
  a=arm.data.bones['thigh_'+label];b=arm.data.bones['shin_'+label]
  hip=matrices['hips']@arm.data.bones['hips'].matrix_local.inverted()@a.head_local
  knee,ankle=solve_two(hip,scaled(feet[label]),a.length,b.length,(0,1,.18))
  orient('thigh_'+label,hip,knee);orient('shin_'+label,knee,ankle)
  foot=arm.data.bones['foot_'+label].matrix_local.copy();foot.translation=ankle;put('foot_'+label,foot)
 inherited('prop_microphone')

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
 old=bpy.data.texts.get('WO100 '+name)
 if old:bpy.data.texts.remove(old)
 block=bpy.data.texts.new('WO100 '+name);block.write((ROOT/'source'/name).read_text())
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'chick-flia.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'chick-flia.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_def_bones=False,export_armature_object_remove=True,export_all_influences=False,export_influence_nb=4,export_apply=False,export_texcoords=True,export_normals=True,export_tangents=False,export_materials='EXPORT',export_vertex_color='NONE',export_image_format='AUTO',export_all_vertex_colors=False,export_cameras=False,export_lights=False,export_extras=True,export_force_sampling=True,export_frame_range=False,export_frame_step=1,export_optimize_animation_size=True,export_current_frame=False,export_rest_position_armature=True,export_anim_slide_to_zero=True,export_draco_mesh_compression_enable=False)
record=json.loads((ROOT/'construction.json').read_text());record['clips']=records;record['bone_count']=len(arm.data.bones)
if bounds_path.exists():record['bounds_evidence']=bounds_record
record['rig']='One skin with rigid padded shell islands, one influence per vertex. Analytic two-bone limb targets bake to local transforms, level feet and a wing-grip microphone child bone. No locomotion track or runtime IK.'
record['bounds_blender']={k:[fn(v.co[i] for v in skin.data.vertices) for i in range(3)] for k,fn in [('min',min),('max',max)]}
record['files']={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [ROOT/'chick-flia.blend',ROOT/'chick-flia.glb',ROOT/'pigment.png']}
record['lead_review_corrections']=['Enclosed the formerly exposed shoulder gaps with cream padded shell.','Softened the lower torso feather scallops and flattened the club token patch.','Extended cream padding to the knee and widened the ochre lower legs.','Kept tired plain eyelids, a short worn apron and a low attached rest microphone.']
(ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'clips':records,'files':record['files']}))
