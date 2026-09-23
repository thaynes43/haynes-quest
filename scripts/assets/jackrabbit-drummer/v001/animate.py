"""WO101 five baked old-motor clips with level feet and snare-contact targets.

Analytic limb targets are baked to ordinary bone transforms; no runtime IK,
root motion, disappearing scale or exported constraints are required.
"""
import bpy, json, math, hashlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler

ROOT=Path('/workspace/haynes-quest/rat-casino-cast/jackrabbit-drummer/v001')
assert bpy.context.scene.get('work_order')=='WO101' and bpy.context.scene.get('scene_lease')=='active'
data=json.loads((ROOT/'source/rig-rest.json').read_text())
REST=data['rest'];factor=data['factor'];low=data['ground'];FPS=60
arm=bpy.data.objects['Jackrabbit_Drummer_Rig'];skin=bpy.data.objects['Jackrabbit_Drummer_Skin']
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
 hips_shift=Vector((0,0,-.022));body_rot=Vector((0,0,0));head_rot=Vector((0,0,0));jaw=-.012
 hands={s:Vector(REST['hand_'+s][0]) for s in ('R','L')}
 feet={s:Vector(REST['foot_'+s][0])+Vector((0,0,.002)) for s in ('R','L')}
 directions={s:(Vector(REST['prop_stick_'+s][1])-Vector(REST['hand_'+s][0])).normalized() for s in ('R','L')}
 settle=0;ear_motion=.0;windup=0;strike=0
 if clip=='idle':
  hips_shift.z+=.003*(1-co);body_rot.y=.006*sw;body_rot.z=.004*sw
  delay=pulse(t,.38,.12)-pulse(t,.64,.14);head_rot=Vector((.009*sw,-.014*sw,.020*sw+.017*delay));ear_motion=.013*delay
  for label,sign in [('R',-1),('L',1)]:hands[label]+=Vector((sign*.003*sw,.004*(1-co),.006*sw))
  jaw=-.012-.005*sw
 elif clip=='move':
  hips_shift.z=-.042+.006*(1-math.cos(tau*2));body_rot.y=.018*sw;body_rot.z=.012*sw
  head_rot=Vector((.012*math.sin(tau*2),-.016*sw,.023*sw));ear_motion=.025*sw
  for label,sign in [('R',-1),('L',1)]:
   phase=tau+(0 if sign<0 else math.pi);step=math.sin(phase)
   feet[label]+=Vector((0,math.cos(phase)*.043,max(0,step)*.045))
   hands[label]+=Vector((sign*.006*sw,-sign*.014*co,.005+.008*sw))
 elif clip=='attack':
  seconds=t*2
  windup=smooth(seconds/.90);strike=smooth((seconds-1.08)/.17)
  recovery=smooth((seconds-1.40)/.60)
  body_rot.x=.028*windup-.07*strike+.042*recovery
  head_rot=Vector((.07*windup-.145*strike+.075*recovery,.009*windup,0));hips_shift.z-=.012*strike*(1-recovery)
  ear_motion=.025*windup-.045*strike+.020*recovery;jaw=-.012-.04*strike*(1-recovery)
  for label,sign in [('R',-1),('L',1)]:
   hands[label]=keyed(seconds,[(0,REST['hand_'+label][0]),(.90,(sign*.47,.105,1.435)),(1.08,(sign*.47,.105,1.435)),(1.25,(sign*.37,.33,1.09)),(1.34,(sign*.37,.33,1.09)),(1.48,(sign*.40,.31,1.15)),(2,REST['hand_'+label][0])])
   directions[label]=keyed(seconds,[(0,directions[label]),(.90,(sign*.025,.24,.97)),(1.08,(sign*.025,.24,.97)),(1.25,(-sign*.78,.50,-.34)),(1.34,(-sign*.78,.50,-.34)),(1.48,(-sign*.53,.40,.70)),(2,directions[label])]).normalized()
 elif clip=='hit':
  recoil=pulse(t,.25,.40);hips_shift+=Vector((0,-.017*recoil,-.018*recoil));body_rot.x=.09*recoil
  head_rot=Vector((.13*recoil,.025*recoil,-.06*recoil));ear_motion=-.07*recoil;jaw=-.09*recoil
  for label,sign in [('R',-1),('L',1)]:hands[label]+=Vector((sign*.045*recoil,-.04*recoil,.07*recoil))
 elif clip=='defeat':
  startle=pulse(t,.15,.18);settle=smooth((t-.24)/.49)
  hips_shift+=Vector((0,-.025*settle,-.102*settle));body_rot=Vector((-.20*settle+.065*startle,.023*settle,.035*settle))
  head_rot=Vector((-.40*settle+.09*startle,.05*settle,-.13*settle));ear_motion=-.19*settle;jaw=-.08*settle-.025*startle
  for label,sign in [('R',-1),('L',1)]:
   hands[label]=lerp(hands[label],(sign*.39,.385,.80),settle)+Vector((0,0,.06*startle))
   directions[label]=directions[label].lerp(Vector((-sign*.18,.73,-.66)),settle).normalized()
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
 for label,sign in [('R',-1),('L',1)]:
  inherited('ear_base_'+label,(ear_motion*.30,sign*ear_motion*.24,0));inherited('ear_tip_'+label,(ear_motion*.65,sign*ear_motion*.55,0))
 inherited('prop_harness');inherited('prop_snare')
 drum_transform=matrices['prop_snare']@arm.data.bones['prop_snare'].matrix_local.inverted()
 for label,sign in [('R',-1),('L',1)]:
  # At 1.25 s each rounded bead sits on the drum head at its own hit point.
  if clip=='attack':
   seconds=t*2;contact_blend=smooth((seconds-1.08)/.17)*(1-smooth((seconds-1.34)/.14))
   tip=drum_transform@scaled((sign*.11,data['snare_center'][1],data['snare_head_surface']+.015))
   stick_length=(Vector(REST['prop_stick_'+label][1])-Vector(REST['hand_'+label][0])).length*factor
   target_wrist=tip-directions[label]*stick_length
   hands[label]=hands[label].lerp(Vector((target_wrist.x/factor,target_wrist.y/factor,target_wrist.z/factor+low)),contact_blend)
  inherited('clavicle_'+label);cb=arm.data.bones['clavicle_'+label];shoulder=matrices['clavicle_'+label]@Vector((0,cb.length,0))
  a=arm.data.bones['upper_arm_'+label];b=arm.data.bones['forearm_'+label]
  elbow,wrist=solve_two(shoulder,scaled(hands[label]),a.length,b.length,(sign,.04,-.65));orient('upper_arm_'+label,shoulder,elbow);orient('forearm_'+label,elbow,wrist)
  original=(Vector(REST['prop_stick_'+label][1])-Vector(REST['hand_'+label][0])).normalized();q=original.rotation_difference(directions[label])
  put('hand_'+label,Matrix.Translation(wrist)@q.to_matrix().to_4x4()@arm.data.bones['hand_'+label].matrix_local.to_3x3().to_4x4())
  inherited('prop_stick_'+label)
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
 old=bpy.data.texts.get('WO101 '+name)
 if old:bpy.data.texts.remove(old)
 block=bpy.data.texts.new('WO101 '+name);block.write((ROOT/'source'/name).read_text())
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'jackrabbit-drummer.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'jackrabbit-drummer.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_def_bones=False,export_armature_object_remove=True,export_all_influences=False,export_influence_nb=4,export_apply=False,export_texcoords=True,export_normals=True,export_tangents=False,export_materials='EXPORT',export_vertex_color='NONE',export_image_format='AUTO',export_all_vertex_colors=False,export_cameras=False,export_lights=False,export_extras=True,export_force_sampling=True,export_frame_range=False,export_frame_step=1,export_optimize_animation_size=True,export_current_frame=False,export_rest_position_armature=True,export_anim_slide_to_zero=True,export_draco_mesh_compression_enable=False)
record=json.loads((ROOT/'construction.json').read_text());record['clips']=records;record['bone_count']=len(arm.data.bones)
if bounds_path.exists():record['bounds_evidence']=bounds_record
record['export_bake_fps']=FPS
record['contact_bake_note']='60 Hz baking places the 1.25 s snare contact exactly on frame 75.'
record['rig']='One skin with rigid padded shell islands, one influence per vertex. Analytic two-bone limb targets bake to local transforms, level feet and a chest harness and hand-parented drumsticks. No locomotion track or runtime IK.'
record['bounds_blender']={k:[fn(v.co[i] for v in skin.data.vertices) for i in range(3)] for k,fn in [('min',min),('max',max)]}
record['files']={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [ROOT/'jackrabbit-drummer.blend',ROOT/'jackrabbit-drummer.glb',ROOT/'pigment.png']}
record['lead_review_corrections']=['Made one ear mostly upright with a soft fold and the other sharply bent for small-scale silhouette.','Closed padded ear bends.','Conformed continuous crossed rear straps and connected waist belt to the body.','Curved burgundy snare diamonds onto the cylinder.']
(ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'clips':records,'files':record['files']}))
