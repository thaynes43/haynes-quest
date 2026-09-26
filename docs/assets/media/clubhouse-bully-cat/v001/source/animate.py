"""WO111 original soft-cat acting, fixed ground targets and baked five-clip rig."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector,Matrix,Euler
ROOT=Path('/workspace/haynes-quest/family-eras/clubhouse-bully-cat/v001')
data=json.loads((ROOT/'source/rig-rest.json').read_text());REST=data['rest'];factor=data['factor'];low=data['ground'];FPS=30
arm=bpy.data.objects['Clubhouse_Bully_Cat_Rig'];skin=bpy.data.objects['Clubhouse_Bully_Cat_Skin']
CLIPS=[('idle',2.4,True),('move',1.2,True),('attack',2.0,False),('hit',.7,False),('defeat',2.4,False)]

def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
def pulse(t,c,w):return smooth(1-abs(t-c)/w)
def lerp(a,b,t):return Vector(a).lerp(Vector(b),t)
def scaled(p):p=Vector(p);return Vector((p.x*factor,p.y*factor,(p.z-low)*factor))
def keyed(t,keys):
 for (a,x),(b,y) in zip(keys,keys[1:]):
  if t<=b:return lerp(x,y,smooth((t-a)/(b-a)))
 return Vector(keys[-1][1])
def scalar(t,keys):
 for (a,x),(b,y) in zip(keys,keys[1:]):
  if t<=b:return x+(y-x)*smooth((t-a)/(b-a))
 return keys[-1][1]
def solve_two(a,target,l1,l2,pole):
 delta=target-a;distance=min(max(delta.length,.00001),l1+l2-.000001);direction=delta.normalized();target=a+direction*distance
 side=Vector(pole)-direction*direction.dot(Vector(pole))
 if side.length<.0001:side=Vector((0,1,0))-direction*direction.y
 side.normalize();along=(l1*l1-l2*l2+distance*distance)/(2*distance)
 return a+direction*along+side*math.sqrt(max(0,l1*l1-along*along)),target

def evaluate(clip,t):
 tau=math.tau*t;sw=math.sin(tau);co=math.cos(tau)
 hips_shift=Vector((0,0,-.018));body_rot=Vector((0,0,0));head_rot=Vector((0,0,0));puff=0
 hands={s:Vector(REST['hand_'+s][0]) for s in ('L','R')}
 feet={s:Vector(REST['foot_'+s][0])+Vector((0,0,.0015)) for s in ('L','R')}
 hand_rot={'L':Vector((0,0,0)),'R':Vector((0,0,0))};tail_sway=0;jaw=0;settle=0
 if clip=='idle':
  # Slow inhale, broad shoulders, chin up, then a tiny satisfied settle.
  puff=.022*(.5-.5*co);hips_shift.z+=.008*(1-co);body_rot.x=.027*(.5-.5*co);body_rot.z=.018*sw
  head_rot=Vector((.050*(.5-.5*co),-.018*sw,.024*sw));jaw=-.022*(.5-.5*co)
  for label,s in [('R',1),('L',-1)]:hands[label]+=Vector((s*.023*(1-co),0,.031*(.5-.5*co)))
  tail_sway=.048*sw
 elif clip=='move':
  # One stiff peg step and a more buoyant boot step create comic asymmetry.
  hips_shift+=Vector((.026*sw,0,-.035+.020*(1-math.cos(tau*2))));body_rot.y=.055*sw;body_rot.z=.075*sw
  head_rot=Vector((.025*math.sin(tau*2),-.05*sw,-.022*sw));tail_sway=.085*sw
  for label,offset,lift in [('L',0,.059),('R',math.pi,.102)]:
   phase=tau+offset;feet[label]+=Vector((0,.090*math.cos(phase),lift*max(0,math.sin(phase))))
  hands['L']+=Vector((-.012,.064*co,.016*(1-co)));hands['R']+=Vector((.012,-.070*co,.020*(1+co)))
  jaw=-.024*(.5-.5*math.cos(tau*2))
 elif clip=='attack':
  # Left mitten clears the head/body silhouette, holds, then swats forward.
  wind=(-.866,-.060,2.002);contact=(-.426,.648,1.532);rest=REST['hand_L'][0]
  hands['L']=keyed(t,[(0,rest),(.36,wind),(.54,wind),(.625,contact),(.68,contact),(.86,(-.83,.23,1.19)),(1,rest)])
  windup=scalar(t,[(0,0),(.36,1),(.54,1),(.625,0),(1,0)])
  strike=pulse(t,.625,.21);hips_shift.z-=.043*strike
  body_rot=Vector((.10*windup-.12*strike,0,-.04*windup+.09*strike))
  head_rot=Vector((.06*windup-.08*strike,0,.065*windup))
  hands['R']+=Vector((.035*windup,.045*strike,.055*windup))
  hand_rot['L']=Vector((1.22*strike,1.10*windup,-.10*windup))
  jaw=-.10*windup-.03*strike;tail_sway=.07*windup-.10*strike
 elif clip=='hit':
  recoil=pulse(t,.25,.42);hips_shift+=Vector((0,-.047*recoil,-.05*recoil))
  body_rot.x=.14*recoil;head_rot=Vector((.23*recoil,-.05*recoil,.09*recoil))
  for label,s in [('R',1),('L',-1)]:hands[label]+=Vector((s*.07*recoil,-.045*recoil,.22*recoil))
  jaw=-.21*recoil;tail_sway=-.16*recoil
 elif clip=='defeat':
  surprise=pulse(t,.17,.19);settle=smooth((t-.23)/.49)
  hips_shift+=Vector((0,-.032*settle,-.292*settle));body_rot=Vector((.13*settle+.09*surprise,0,-.035*settle))
  head_rot=Vector((.10*settle+.15*surprise,0,.14*settle))
  for label,s in [('R',1),('L',-1)]:
   hands[label]=lerp(hands[label],(s*.704,.262,.625),settle)+Vector((s*.038*surprise,0,.21*surprise))
   hand_rot[label]=Vector((.26*settle,0,-s*.14*settle))
  jaw=-.10*settle-.12*surprise;tail_sway=.17*settle
 matrices={}
 def put(name,matrix):
  pb=arm.pose.bones[name];rest=pb.bone.matrix_local
  prefix=matrices[pb.parent.name]@pb.parent.bone.matrix_local.inverted()@rest if pb.parent else rest
  pb.matrix_basis=prefix.inverted()@matrix;matrices[name]=matrix
 def inherited(name,rot=(0,0,0),scale=1):
  pb=arm.pose.bones[name];base=matrices[pb.parent.name]@pb.parent.bone.matrix_local.inverted()@pb.bone.matrix_local
  put(name,Matrix.Translation(base.translation)@Euler(rot).to_matrix().to_4x4()@base.to_3x3().to_4x4()@Matrix.Diagonal((scale,scale,scale,1)))
 def orient(name,head,tail):
  pb=arm.pose.bones[name];direction=(pb.bone.tail_local-pb.bone.head_local).normalized();q=direction.rotation_difference((tail-head).normalized())
  put(name,Matrix.Translation(head)@q.to_matrix().to_4x4()@pb.bone.matrix_local.to_3x3().to_4x4())
 put('root',arm.data.bones['root'].matrix_local.copy())
 hips=arm.data.bones['hips'].matrix_local.copy();hips.translation+=hips_shift*factor;put('hips',hips)
 inherited('chest',body_rot,1+puff);inherited('neck');inherited('head',head_rot);inherited('jaw',(jaw,0,0))
 for label,s in [('R',1),('L',-1)]:
  inherited('clavicle_'+label);cb=arm.data.bones['clavicle_'+label];shoulder=matrices['clavicle_'+label]@Vector((0,cb.length,0))
  a=arm.data.bones['upper_arm_'+label];b=arm.data.bones['forearm_'+label]
  elbow,wrist=solve_two(shoulder,scaled(hands[label]),a.length,b.length,(s,.10,-.65))
  orient('upper_arm_'+label,shoulder,elbow);orient('forearm_'+label,elbow,wrist)
  hand=arm.data.bones['hand_'+label].matrix_local.copy();hand=Matrix.Translation(wrist)@Euler(hand_rot[label]).to_matrix().to_4x4()@hand.to_3x3().to_4x4();put('hand_'+label,hand)
  a=arm.data.bones['thigh_'+label];b=arm.data.bones['shin_'+label]
  hip=matrices['hips']@arm.data.bones['hips'].matrix_local.inverted()@a.head_local
  knee,ankle=solve_two(hip,scaled(feet[label]),a.length,b.length,(s*.12,1,.20))
  orient('thigh_'+label,hip,knee);orient('shin_'+label,knee,ankle)
  foot=arm.data.bones['foot_'+label].matrix_local.copy();foot.translation=ankle;put('foot_'+label,foot)
 for j in range(1,4):inherited('tail_'+str(j),(-.04*settle,tail_sway*.25,tail_sway*(.4+j*.18)))

scene=bpy.context.scene;scene.render.fps=FPS;scene.frame_start=0;scene.frame_end=72
assert scene.get('work_order')=='WO111' and scene.get('scene_lease')=='active'
scene['asset_id']='clubhouse-bully-cat';scene['asset_version']='v001'
scene['candidate_status']="WO111 clubhouse-bully-cat v001 · Awaiting Tom's review · used in the family release"
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
   for field in ('location','rotation_quaternion','scale'):pb.keyframe_insert(data_path=field,frame=frame,group=pb.name)
 for fc in action.fcurves:
  for k in fc.keyframe_points:k.interpolation='LINEAR'
 track=arm.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,0,action);strip.action_frame_start=0;strip.action_frame_end=end;track.mute=True
 records.append({'name':name,'duration_s':duration,'loop':loop,'clamp_when_finished':not loop,'contact_time_s':1.25 if name=='attack' else None,'contact_fraction':.625 if name=='attack' else None,'held_final_pose_from_s':1.733334 if name=='defeat' else None})
arm.animation_data.action=None
for pb in arm.pose.bones:pb.matrix_basis=Matrix.Identity(4)
scene.frame_set(0);bpy.context.view_layer.update()
arm['attack_contact_seconds']=1.25;arm['attack_contact_fraction']=.625
bp=ROOT/'source/bounds.json'
if bp.exists():
 br=json.loads(bp.read_text());skin['model_space_bounds_y_up']=br['safe_culling_envelope'];skin['bounds_method']=br['method']
for name in ('build.py','common.py','animate.py'):
 old=bpy.data.texts.get('WO111 clubhouse cat '+name)
 if old:bpy.data.texts.remove(old)
 block=bpy.data.texts.new('WO111 clubhouse cat '+name);block.write((ROOT/'source'/name).read_text())
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'clubhouse-bully-cat.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'clubhouse-bully-cat.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_def_bones=False,export_armature_object_remove=True,export_all_influences=False,export_influence_nb=4,export_apply=False,export_texcoords=True,export_normals=True,export_tangents=False,export_materials='EXPORT',export_vertex_color='NONE',export_image_format='AUTO',export_all_vertex_colors=False,export_cameras=False,export_lights=False,export_extras=True)
record=json.loads((ROOT/'construction.json').read_text());record['clips']=records;record['files']={name:{'bytes':(ROOT/name).stat().st_size,'sha256':hashlib.sha256((ROOT/name).read_bytes()).hexdigest()} for name in ['clubhouse-bully-cat.blend','clubhouse-bully-cat.glb','pigment.png']}
record['lead_corrections']=['Confirmed anatomical left peg / right boot in final front view.','Soft rounded shoulder transitions.','Original overlapping short teal button panel.','Short rounded mitten lobes without claws.','Removed unnecessary floating crown seam; wood grain stays in the atlas.']
(ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({'clips':records,'files':record['files']}))
