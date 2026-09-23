"""WO103 five baked old-motor clips with level feet, hinged wings and shutters.

Analytic limb targets are baked to ordinary bone transforms; no runtime IK,
root motion, disappearing scale or exported constraints are required.
"""
import bpy, json, math, hashlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler

ROOT=Path('/workspace/haynes-quest/rat-casino-cast/moth-projectionist/v001')
assert bpy.context.scene.get('work_order')=='WO103' and bpy.context.scene.get('scene_lease')=='active'
data=json.loads((ROOT/'source/rig-rest.json').read_text())
REST=data['rest'];factor=data['factor'];low=data['ground'];FPS=60
arm=bpy.data.objects['Moth_Projectionist_Rig'];skin=bpy.data.objects['Moth_Projectionist_Skin']
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
 hand_rot={s:Vector((0,0,0)) for s in ('R','L')}
 antenna=0;wing_open=0;wing_sag=0;shutter_slide=0;settle=0
 if clip=='idle':
  hips_shift.z+=.003*(1-co);body_rot.y=.006*sw;body_rot.z=.004*sw
  motor=pulse(t,.39,.12)-pulse(t,.63,.13)
  head_rot=Vector((.009*sw,-.007*sw,.027*sw+.014*motor));antenna=.024*motor
  wing_open=.013*(1-co);shutter_slide=.0016*motor
  for label,sign in [('R',-1),('L',1)]:hands[label]+=Vector((sign*.004*sw,.003*(1-co),.004*sw))
 elif clip=='move':
  hips_shift.z=-.042+.006*(1-math.cos(tau*2));body_rot.y=.017*sw;body_rot.z=.019*sw
  head_rot=Vector((.01*math.sin(tau*2),-.014*sw,.026*sw));antenna=.048*sw;wing_open=.026*(1-co)
  for label,sign in [('R',-1),('L',1)]:
   phase=tau+(0 if sign<0 else math.pi);step=math.sin(phase)
   feet[label]+=Vector((0,math.cos(phase)*.039,max(0,step)*.040))
   hands[label]+=Vector((sign*.007*sw,-sign*.030*co,.004*(1-co)))
 elif clip=='attack':
  sec=t*2;windup=smooth(sec/.84);snap=smooth((sec-1.10)/.15);recover=smooth((sec-1.45)/.55)
  body_rot.x=.15*windup-.23*snap+.08*recover
  head_rot=Vector((.04*windup-.13*snap+.09*recover,0,.022*windup*(1-recover)))
  hips_shift.z-=.011*snap*(1-recover)
  wing_open=-.67*windup-.03*snap+.70*recover;wing_sag=.01*windup*(1-recover)
  antenna=.046*windup-.067*snap+.021*recover
  # Warning partly closes the real shutter leaves. At 1.25 s their brisk
  # opening exposes the complete pale lens while the torso aims forward.
  shutter_slide=-.034*windup+.093*snap-.059*recover
  for label,sign in [('R',-1),('L',1)]:
   hands[label]=keyed(sec,[(0,REST['hand_'+label][0]),(.84,(sign*.397,.065,.902)),(1.10,(sign*.397,.065,.902)),(1.25,(sign*.363,.216,.811)),(1.45,(sign*.363,.216,.811)),(2,REST['hand_'+label][0])])
   hand_rot[label]=Vector((-.06*windup,sign*(.13*windup-.25*snap+.12*recover),sign*.055*windup*(1-recover)))
 elif clip=='hit':
  recoil=pulse(t,.26,.40);hips_shift+=Vector((0,-.015*recoil,-.018*recoil));body_rot.x=.085*recoil
  head_rot=Vector((.135*recoil,.026*recoil,-.065*recoil));antenna=-.13*recoil;wing_open=.075*recoil;wing_sag=-.045*recoil;shutter_slide=-.022*recoil
  for label,sign in [('R',-1),('L',1)]:hands[label]+=Vector((sign*.043*recoil,-.019*recoil,.056*recoil))
 elif clip=='defeat':
  startle=pulse(t,.15,.18);settle=smooth((t-.24)/.49)
  hips_shift+=Vector((0,-.019*settle,-.075*settle));body_rot=Vector((-.28*settle+.06*startle,.015*settle,.025*settle))
  head_rot=Vector((-.35*settle+.09*startle,.045*settle,-.11*settle));antenna=-.19*settle
  wing_open=.105*settle+.06*startle;wing_sag=.06*settle;shutter_slide=-.049*settle
  for label,sign in [('R',-1),('L',1)]:
   hands[label]=lerp(hands[label],(sign*.343,.155,.49),settle)+Vector((0,0,.042*startle))
   hand_rot[label]=Vector((-.09*settle,sign*.055*settle,0))
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
 inherited('chest',body_rot);inherited('neck');inherited('head',head_rot);inherited('projector')
 for label,sign in [('R',-1),('L',1)]:
  inherited('antenna_'+label,(antenna*.20,sign*antenna,.008*antenna))
  inherited('wing_hinge_'+label,(wing_sag,sign*wing_open,0));inherited('wing_panel_'+label)
  # Offset follows the chest's right axis, so a rigid guide remains attached.
  axis=matrices['projector'].to_3x3()@arm.data.bones['projector'].matrix_local.to_3x3().inverted()@Vector((sign*shutter_slide,0,0))
  inherited('shutter_'+label,offset=axis)
 for label,sign in [('R',-1),('L',1)]:
  inherited('clavicle_'+label);cb=arm.data.bones['clavicle_'+label];shoulder=matrices['clavicle_'+label]@Vector((0,cb.length,0))
  a=arm.data.bones['upper_arm_'+label];b=arm.data.bones['forearm_'+label]
  elbow,wrist=solve_two(shoulder,scaled(hands[label]),a.length,b.length,(sign,.04,-.60))
  orient('upper_arm_'+label,shoulder,elbow);orient('forearm_'+label,elbow,wrist)
  put('hand_'+label,Matrix.Translation(wrist)@Euler(hand_rot[label]).to_matrix().to_4x4()@arm.data.bones['hand_'+label].matrix_local.to_3x3().to_4x4())
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
 old=bpy.data.texts.get('WO103 '+name)
 if old:bpy.data.texts.remove(old)
 block=bpy.data.texts.new('WO103 '+name);block.write((ROOT/'source'/name).read_text())
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'moth-projectionist.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'moth-projectionist.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_def_bones=False,export_armature_object_remove=True,export_all_influences=False,export_influence_nb=4,export_apply=False,export_texcoords=True,export_normals=True,export_tangents=False,export_materials='EXPORT',export_vertex_color='NONE',export_image_format='AUTO',export_all_vertex_colors=False,export_cameras=False,export_lights=False,export_extras=True,export_force_sampling=True,export_frame_range=False,export_frame_step=1,export_optimize_animation_size=True,export_current_frame=False,export_rest_position_armature=True,export_anim_slide_to_zero=True,export_draco_mesh_compression_enable=False)
record=json.loads((ROOT/'construction.json').read_text());record['clips']=records;record['bone_count']=len(arm.data.bones)
if bounds_path.exists():record['bounds_evidence']=bounds_record
record['export_bake_fps']=FPS
record['contact_bake_note']='60 Hz baking places the 1.25 s projector contact exactly on frame 75.'
record['rig']='One skin with rigid padded shell islands, separate named wing hinges and projector shutters. Analytic two-bone limb targets bake to local transforms with level feet. Projector housing local transform stays fixed to the chest. No locomotion track or runtime IK.'
record['bounds_blender']={k:[fn(v.co[i] for v in skin.data.vertices) for i in range(3)] for k,fn in [('min',min),('max',max)]}
record['files']={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [ROOT/'moth-projectionist.blend',ROOT/'moth-projectionist.glb',ROOT/'pigment.png']}
record['lead_review_corrections']=['Softened spotted fabric pigment into subtle felt wear.','Rounded both wing lobe perimeters while preserving separate two-lobed panels.','Lowered asymmetrical pale eyelids and made the plain brow heavier.','Replaced pointed collar beads with a continuous compact worn shag collar.','Reversed wing warning rotation to lift and unfold the lower panels beyond the neutral silhouette at front and three-quarter views.','Moved canvas panels 28 mm farther behind body while extending their rigid hinge spars, to establish positive all-frame conservative clearance.']
(ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'clips':records,'files':record['files']}))
