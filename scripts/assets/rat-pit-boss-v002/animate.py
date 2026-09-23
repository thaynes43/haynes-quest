"""WO099 deterministic baked mechanical rig, floor targets and exact enemy clips."""
import bpy, json, math, hashlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler

ROOT=Path('/workspace/haynes-quest/rat-casino-cast/rat-pit-boss/v002')
data=json.loads((ROOT/'source/rig-rest.json').read_text())
REST=data['rest'];factor=data['factor'];low=data['ground'];FPS=30
arm=bpy.data.objects['Rat_Pit_Boss_Rig'];skin=bpy.data.objects['Rat_Pit_Boss_Skin']
CLIPS=[('idle',2.4,True),('move',1.2,True),('attack',2.0,False),('hit',.7,False),('defeat',2.4,False)]

def smooth(t):
 t=max(0,min(1,t));return t*t*(3-2*t)
def pulse(t,c,w):return smooth(1-abs(t-c)/w)
def lerp(a,b,t):return Vector(a).lerp(Vector(b),t)
def scaled(p):p=Vector(p);return Vector((p.x*factor,p.y*factor,(p.z-low)*factor))
def keyed(t,keys):
 for (a,x),(b,y) in zip(keys,keys[1:]):
  if t<=b:return lerp(x,y,smooth((t-a)/(b-a)))
 return Vector(keys[-1][1])
def solve_two(a,target,l1,l2,pole):
 delta=target-a;distance=min(max(delta.length,.00001),l1+l2-.000001)
 direction=delta.normalized();target=a+direction*distance
 side=Vector(pole)-direction*direction.dot(Vector(pole))
 if side.length<.0001:side=Vector((0,1,0))-direction*direction.y
 side.normalize();along=(l1*l1-l2*l2+distance*distance)/(2*distance)
 return a+direction*along+side*math.sqrt(max(0,l1*l1-along*along)),target

def evaluate(clip,t):
 tau=math.tau*t;sw=math.sin(tau);co=math.cos(tau)
 hips_shift=Vector((0,0,-.026));body_rot=Vector((0,0,0));head_rot=Vector((0,0,0))
 hands={'R':Vector(REST['hand_R'][0]),'L':Vector(REST['hand_L'][0])}
 feet={s:Vector(REST['foot_'+s][0])+Vector((0,0,.0015)) for s in ('L','R')}
 hand_angle=0;tail_sway=0;jaw=-.012;settle=0
 if clip=='idle':
  hips_shift.z+=.004*(1-co);body_rot.y=.012*sw;body_rot.z=.009*sw
  head_rot=Vector((.015*sw,-.025*sw,.034*sw));jaw=-.035*(.5+.5*sw)
  hands['L']+=Vector((.008*sw,.012*(1-co),.021*sw));tail_sway=.035*sw
 elif clip=='move':
  hips_shift.z=-.046+.007*(1-math.cos(tau*2));body_rot.y=.028*sw
  head_rot=Vector((.01*math.sin(tau*2),-.027*sw,.022*sw));tail_sway=.075*sw
  for label,sgn in [('R',-1),('L',1)]:
   phase=tau+(0 if sgn<0 else math.pi);step=math.sin(phase)
   feet[label]+=Vector((0,math.cos(phase)*.06,max(0,step)*.054))
  hands['R']+=Vector((.005*sw,.03*co,.012+.011*(1-co)))
  hands['L']+=Vector((.01*sw,-.050*co,.010+.010*sw));hand_angle=.06*sw
 elif clip=='attack':
  rest=REST['hand_L'][0];wind=(.59,-.006,1.72);contact=(.345,.442,1.28)
  hands['L']=keyed(t,[(0,rest),(.42,wind),(.54,wind),(.625,contact),(.69,contact),(.86,(.49,.17,1.025)),(1,rest)])
  windup=pulse(t,.43,.43);strike=pulse(t,.625,.24)
  hips_shift.z-=.022*strike;body_rot.x=.10*windup-.12*strike
  body_rot.z=.045*windup-.065*strike;head_rot.x=.10*windup-.07*strike;head_rot.z=-.05*windup
  hands['R'].z+=.022*strike;hand_angle=-.32*windup-1.05*strike
  jaw=-.06*windup-.07*strike;tail_sway=-.05*strike
 elif clip=='hit':
  recoil=pulse(t,.26,.42);hips_shift+=Vector((0,-.027*recoil,-.031*recoil))
  body_rot.x=.13*recoil;head_rot=Vector((.18*recoil,.045*recoil,-.045*recoil))
  hands['L']+=Vector((.026*recoil,-.05*recoil,.13*recoil))
  hands['R'].z+=.04*recoil;jaw=-.14*recoil;tail_sway=.085*recoil
 elif clip=='defeat':
  startle=pulse(t,.18,.20);settle=smooth((t-.25)/.48)
  hips_shift+=Vector((0,-.035*settle,-.135*settle))
  body_rot=Vector((-.18*settle+.10*startle,0,.045*settle))
  head_rot=Vector((-.30*settle+.15*startle,.11*settle,-.09*settle))
  hands['L']=lerp(hands['L'],(.505,.155,.67),settle)+Vector((0,0,.15*startle))
  hands['R']=lerp(hands['R'],(-.505,.13,.72),settle)+Vector((0,0,.04*startle));hand_angle=-.28*settle
  jaw=-.105*settle-.09*startle;tail_sway=-.08*settle
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
  pb=arm.pose.bones[name];direction=(pb.bone.tail_local-pb.bone.head_local).normalized()
  q=direction.rotation_difference((tail-head).normalized())
  put(name,Matrix.Translation(head)@q.to_matrix().to_4x4()@pb.bone.matrix_local.to_3x3().to_4x4())
 put('root',arm.data.bones['root'].matrix_local.copy())
 hips=arm.data.bones['hips'].matrix_local.copy();hips.translation+=hips_shift*factor;put('hips',hips)
 inherited('chest',body_rot);inherited('neck');inherited('head',head_rot);inherited('jaw',(jaw,0,0))
 for label,s in [('R',-1),('L',1)]:
  inherited('clavicle_'+label);cb=arm.data.bones['clavicle_'+label]
  shoulder=matrices['clavicle_'+label]@Vector((0,cb.length,0))
  a=arm.data.bones['upper_arm_'+label];b=arm.data.bones['forearm_'+label]
  elbow,wrist=solve_two(shoulder,scaled(hands[label]),a.length,b.length,(s,.15,-.8))
  orient('upper_arm_'+label,shoulder,elbow);orient('forearm_'+label,elbow,wrist)
  hand=arm.data.bones['hand_'+label].matrix_local.copy();hand.translation=wrist
  if label=='L':hand=Matrix.Translation(wrist)@Euler((hand_angle,0,0)).to_matrix().to_4x4()@hand.to_3x3().to_4x4()
  put('hand_'+label,hand)
  a=arm.data.bones['thigh_'+label];b=arm.data.bones['shin_'+label]
  hip=matrices['hips']@arm.data.bones['hips'].matrix_local.inverted()@a.head_local
  knee,ankle=solve_two(hip,scaled(feet[label]),a.length,b.length,(0,1,.25))
  orient('thigh_'+label,hip,knee);orient('shin_'+label,knee,ankle)
  foot=arm.data.bones['foot_'+label].matrix_local.copy();foot.translation=ankle;put('foot_'+label,foot)
 inherited('prop_die')
 for j in range(1,4):inherited('tail_'+str(j),(-.10*settle,tail_sway*.3,tail_sway*(.4+j*.15)))

scene=bpy.context.scene;scene.render.fps=FPS;scene.frame_start=0;scene.frame_end=72
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
 track=arm.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,0,action)
 strip.action_frame_start=0;strip.action_frame_end=end;track.mute=True
 records.append({'name':name,'duration_s':duration,'loop':loop,'clamp_when_finished':not loop,'contact_time_s':1.25 if name=='attack' else None,'contact_fraction':.625 if name=='attack' else None,'held_final_pose_from_s':1.766667 if name=='defeat' else None})
arm.animation_data.action=None
for pb in arm.pose.bones:pb.matrix_basis=Matrix.Identity(4)
scene.frame_set(0);bpy.context.view_layer.update()
arm['attack_contact_seconds']=1.25;arm['attack_contact_fraction']=.625
bounds_path=ROOT/'source/bounds.json'
if bounds_path.exists():
 bounds_record=json.loads(bounds_path.read_text())
 skin['model_space_bounds_y_up']=bounds_record['safe_culling_envelope']
 skin['bounds_method']=bounds_record['method']
for name in ('build.py','common.py','animate.py'):
 old=bpy.data.texts.get('WO099 '+name)
 if old:bpy.data.texts.remove(old)
 block=bpy.data.texts.new('WO099 '+name);block.write((ROOT/'source'/name).read_text())
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'rat-pit-boss.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'rat-pit-boss.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_def_bones=False,export_armature_object_remove=True,export_all_influences=False,export_influence_nb=4,export_apply=False,export_texcoords=True,export_normals=True,export_tangents=False,export_materials='EXPORT',export_vertex_color='NONE',export_image_format='AUTO',export_all_vertex_colors=False,export_cameras=False,export_lights=False,export_extras=True,export_force_sampling=True,export_frame_range=False,export_frame_step=1,export_optimize_animation_size=True,export_current_frame=False,export_rest_position_armature=True,export_anim_slide_to_zero=True,export_draco_mesh_compression_enable=False)
record=json.loads((ROOT/'construction.json').read_text());record['clips']=records;record['bone_count']=len(arm.data.bones)
if bounds_path.exists():record['bounds_evidence']=bounds_record
record['rig']='One skin with rigid padded shell islands, one influence per vertex. Analytic two-bone limb targets bake to local transforms; level feet and a hand-attached dice child bone. Root remains stationary; no runtime constraints.'
record['bounds_blender']={k:[fn(v.co[i] for v in skin.data.vertices) for i in range(3)] for k,fn in [('min',min),('max',max)]}
record['files']={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [ROOT/'rat-pit-boss.blend',ROOT/'rat-pit-boss.glb',ROOT/'pigment.png']}
record['checkpoint_corrections']=['Lead inspected early exact-GLB views and selected the broad silhouette.','Muted shell to dusty gray-brown, increased repaired seams and dulled joints.','Tessellated shirt and vest facings follow the padded belly without floating.','Reduced exposed shoulder bearings, padded the pelvis and lowered the eyelids.','Lead motion review requested a more readable attack silhouette: free hand rises above the shoulder during the warning, followed by a restrained mechanical lean and forward strike.']
(ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'clips':records,'files':record['files']}))
