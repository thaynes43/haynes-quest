"""WO104 five baked delayed mechanical spare-rat clips with level feet and attached tail.

Analytic limb targets are baked to ordinary bone transforms; no runtime IK,
root motion, disappearing scale or exported constraints are required.
"""
import bpy, json, math, hashlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler

ROOT=Path('/workspace/haynes-quest/rat-casino-cast/golden-after-hours-rat/v001')
assert bpy.context.scene.get('work_order')=='WO104' and bpy.context.scene.get('scene_lease')=='active'
data=json.loads((ROOT/'source/rig-rest.json').read_text())
REST=data['rest'];factor=data['factor'];low=data['ground'];FPS=60
arm=bpy.data.objects['Golden_After_Hours_Rat_Rig'];skin=bpy.data.objects['Golden_After_Hours_Rat_Skin']
CLIPS=[('idle',3.2,True),('move',1.6,True),('attack',2.0,False),('hit',.7,False),('defeat',2.4,False)]

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
 hips_shift=Vector((0,0,-.025));body_rot=Vector((-.018,0,0));head_rot=Vector((-.035,.014,.020))
 hands={s:Vector(REST['hand_'+s][0]) for s in ('R','L')}
 feet={s:Vector(REST['foot_'+s][0])+Vector((0,0,.002)) for s in ('R','L')}
 hand_rot={s:Vector((0,0,0)) for s in ('R','L')}
 face_rot=Vector((0,0,0));ear_lag=0;jaw_open=0;tail_sway=0;tail_sag=0
 if clip=='idle':
  hips_shift.z+=.003*(1-co);body_rot.y=.007*sw;body_rot.z=.005*sw
  motor=pulse(t,.43,.12)-pulse(t,.66,.09)
  head_rot+=Vector((.008*sw,-.010*sw,.018*sw+.025*motor));ear_lag=.045*pulse(t,.52,.12);face_rot.x=.007*pulse(t,.53,.14)
  tail_sway=.036*sw;tail_sag=.015*(1-co)
  for label,sign in [('R',-1),('L',1)]:hands[label]+=Vector((sign*.004*sw,.004*(1-co),.006*sw))
 elif clip=='move':
  hips_shift.z=-.045+.006*(1-math.cos(tau*2));body_rot.y=.019*sw;body_rot.z=.018*sw
  head_rot+=Vector((.012*math.sin(tau*2),-.015*sw,.030*sw));ear_lag=.053*math.sin(tau-.6);face_rot.x=.008*math.sin(tau*2-.6);tail_sway=.075*sw
  for label,sign in [('R',-1),('L',1)]:
   phase=tau+(0 if sign<0 else math.pi);step=math.sin(phase)
   feet[label]+=Vector((0,math.cos(phase)*.041,max(0,step)*.045))
   hands[label]+=Vector((sign*.006*sw,-sign*.033*co,.005*(1-co)))
 elif clip=='attack':
  sec=t*2;lift=smooth(sec/.82);lag=smooth((sec-.26)/.56);snap=smooth((sec-1.10)/.15);recover=smooth((sec-1.43)/.57)
  body_rot.x+=.058*lift-.16*snap+.102*recover;head_rot+=Vector((.045*lag-.087*snap+.042*recover,0,-.035*lag*(1-recover)))
  ear_lag=.11*lag-.16*smooth((sec-1.19)/.14)+.05*recover;face_rot.x=.018*lag-.025*smooth((sec-1.21)/.14)+.007*recover
  jaw_open=.033*lag*(1-recover);tail_sway=.060*lift*(1-recover);hips_shift.z-=.012*snap*(1-recover)
  hands['L']=keyed(sec,[(0,REST['hand_L'][0]),(.82,(.550,.062,1.096)),(1.10,(.550,.062,1.096)),(1.25,(.401,.398,1.015)),(1.43,(.401,.398,1.015)),(2,REST['hand_L'][0])])
  hand_rot['L']=Vector((-.06*lift+.06*recover,-.28*lift+.28*recover,-.04*lift+.04*recover))
  hands['R']+=Vector((-.025*lift*(1-recover),.025*snap*(1-recover),.023*lift*(1-recover)))
 elif clip=='hit':
  recoil=pulse(t,.26,.40);hips_shift+=Vector((0,-.014*recoil,-.017*recoil));body_rot.x+=.075*recoil
  head_rot+=Vector((.14*recoil,.03*recoil,-.10*recoil));ear_lag=-.16*pulse(t,.36,.44);face_rot.x=.024*pulse(t,.38,.43);tail_sway=-.07*recoil;jaw_open=.035*recoil
  for label,sign in [('R',-1),('L',1)]:hands[label]+=Vector((sign*.028*recoil,-.028*recoil,.051*recoil))
 elif clip=='defeat':
  startle=pulse(t,.14,.17);settle=smooth((t-.24)/.49)
  hips_shift+=Vector((0,-.012*settle,-.084*settle));body_rot+=Vector((-.24*settle+.06*startle,.02*settle,.028*settle))
  head_rot+=Vector((-.32*settle+.10*startle,.065*settle,-.15*settle));ear_lag=.20*settle;face_rot.x=-.016*settle;jaw_open=.10*settle;tail_sway=.07*settle;tail_sag=.023*settle
  for label,sign in [('R',-1),('L',1)]:
   hands[label]=lerp(hands[label],(sign*.386,.187,.557),settle)+Vector((0,0,.045*startle))
   hand_rot[label]=Vector((-.08*settle,sign*.065*settle,0))
 matrices={}
 def put(name,matrix):
  pb=arm.pose.bones[name];rest=pb.bone.matrix_local
  prefix=matrices[pb.parent.name]@pb.parent.bone.matrix_local.inverted()@rest if pb.parent else rest
  pb.matrix_basis=prefix.inverted()@matrix;matrices[name]=matrix
 def inherited(name,rot=(0,0,0),offset=(0,0,0)):
  pb=arm.pose.bones[name];parent=pb.parent;base=matrices[parent.name]@parent.bone.matrix_local.inverted()@pb.bone.matrix_local
  put(name,Matrix.Translation(base.translation+Vector(offset)*factor)@Euler(rot).to_matrix().to_4x4()@base.to_3x3().to_4x4())
 def orient(name,head,tail):
  pb=arm.pose.bones[name];direction=(pb.bone.tail_local-pb.bone.head_local).normalized();q=direction.rotation_difference((tail-head).normalized())
  put(name,Matrix.Translation(head)@q.to_matrix().to_4x4()@pb.bone.matrix_local.to_3x3().to_4x4())
 put('root',arm.data.bones['root'].matrix_local.copy())
 hips=arm.data.bones['hips'].matrix_local.copy();hips.translation+=hips_shift*factor;put('hips',hips)
 inherited('chest',body_rot);inherited('neck');inherited('head',head_rot);inherited('faceplate',face_rot);inherited('jaw',(jaw_open,0,0));inherited('tail_base',(tail_sag,0,tail_sway));inherited('tail_mid',(0,tail_sway*.4,tail_sway*.25));inherited('tail_tip',(0,tail_sway*.7,tail_sway*.35))
 for label,sign in [('R',-1),('L',1)]:inherited('ear_'+label,(0,sign*ear_lag*(1 if label=='L' else .35),0))
 for label,sign in [('R',-1),('L',1)]:
  inherited('clavicle_'+label);cb=arm.data.bones['clavicle_'+label];shoulder=matrices['clavicle_'+label]@Vector((0,cb.length,0))
  a=arm.data.bones['upper_arm_'+label];b=arm.data.bones['forearm_'+label]
  elbow,wrist=solve_two(shoulder,scaled(hands[label]),a.length,b.length,(sign,.04,-.60))
  orient('upper_arm_'+label,shoulder,elbow);orient('forearm_'+label,elbow,wrist)
  put('hand_'+label,Matrix.Translation(wrist)@Euler(hand_rot[label]).to_matrix().to_4x4()@arm.data.bones['hand_'+label].matrix_local.to_3x3().to_4x4())
  if label=='L':inherited('replacement_paw')
  a=arm.data.bones['thigh_'+label];b=arm.data.bones['shin_'+label];hip=matrices['hips']@arm.data.bones['hips'].matrix_local.inverted()@a.head_local
  knee,ankle=solve_two(hip,scaled(feet[label]),a.length,b.length,(0,1,.18));orient('thigh_'+label,hip,knee);orient('shin_'+label,knee,ankle)
  foot=arm.data.bones['foot_'+label].matrix_local.copy();foot.translation=ankle;put('foot_'+label,foot)
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
 old=bpy.data.texts.get('WO104 '+name)
 if old:bpy.data.texts.remove(old)
 block=bpy.data.texts.new('WO104 '+name);block.write((ROOT/'source'/name).read_text())
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'golden-after-hours-rat.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'golden-after-hours-rat.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_def_bones=False,export_armature_object_remove=True,export_all_influences=False,export_influence_nb=4,export_apply=False,export_texcoords=True,export_normals=True,export_tangents=False,export_materials='EXPORT',export_vertex_color='NONE',export_image_format='AUTO',export_all_vertex_colors=False,export_cameras=False,export_lights=False,export_extras=True,export_force_sampling=True,export_frame_range=False,export_frame_step=1,export_optimize_animation_size=True,export_current_frame=False,export_rest_position_armature=True,export_anim_slide_to_zero=True,export_draco_mesh_compression_enable=False)
record=json.loads((ROOT/'construction.json').read_text());record['clips']=records;record['bone_count']=len(arm.data.bones)
if bounds_path.exists():record['bounds_evidence']=bounds_record
record['export_bake_fps']=FPS
record['contact_bake_note']='60 Hz baking places the 1.25 s replacement-paw contact exactly on frame 75.'
record['rig']='One skin with padded shell islands, named lagging faceplate/jaw and ear pivots, a rigid replacement paw and continuous weighted tail. Analytic two-bone limb targets bake to local transforms with level feet. No locomotion track or runtime IK.'
record['bounds_blender']={k:[fn(v.co[i] for v in skin.data.vertices) for i in range(3)] for k,fn in [('min',min),('max',max)]}
record['files']={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [ROOT/'golden-after-hours-rat.blend',ROOT/'golden-after-hours-rat.glb',ROOT/'pigment.png']}
record['lead_review_corrections']=['Seated the ear piping against its padded disk after true-side inspection.','Added a narrow dark faceplate perimeter gasket and one discreet side closure latch; the panel remains closed and integrated.','Dulled the mustard cloth, added broad diffuse faded scuffs and a few restrained repaired patches on the vest and limbs.']
(ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'clips':records,'files':record['files']}))
