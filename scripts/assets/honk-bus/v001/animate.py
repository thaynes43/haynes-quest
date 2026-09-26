"""WO111 grounded toy suspension, wheel turns and readable held honk warning."""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler
ROOT=Path('/workspace/haynes-quest/family-eras/honk-bus/v001')
data=json.loads((ROOT/'source/rig-rest.json').read_text());factor=data['factor'];REST=data['rest'];FPS=60
arm=bpy.data.objects['Honk_Bus_Rig'];skin=bpy.data.objects['Honk_Bus_Skin']
CLIPS=[('idle',2.4,True),('move',1.2,True),('attack',2.0,False),('hit',.7,False),('defeat',2.4,False)]
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
def pulse(t,c,w):return smooth(1-abs(t-c)/w)
def scalar(t,keys):
 for (a,x),(b,y) in zip(keys,keys[1:]):
  if t<=b:return x+(y-x)*smooth((t-a)/(b-a))
 return keys[-1][1]

def evaluate(clip,t):
 phase=math.tau*t;sin=math.sin(phase);cos=math.cos(phase)
 body=Vector((0,0,0));rot=Vector((0,0,0));horn=Vector((0,0,0));visor=0;lids=0;wheel=0;steer=0;hornLift=0;lidDrop=0
 if clip=='idle':
  body.z=.021*(1-cos);rot.x=.010*(1-cos);rot.z=.010*sin
  horn.x=.045*sin;visor=.025*(1-cos);lids=.015*sin;wheel=.022*sin
 elif clip=='move':
  wheel=-math.tau*t
  body.z=.017*(1-math.cos(phase*2));rot.x=.013*math.sin(phase*2);rot.z=.018*sin
  horn.x=.045*math.sin(phase*2);horn.z=.015*sin;visor=.03*math.sin(phase*2);steer=.018*sin
 elif clip=='attack':
  wind=scalar(t,[(0,0),(.28,1),(.54,1),(.625,0),(.84,0),(1,0)])
  strike=scalar(t,[(0,0),(.54,0),(.625,1),(.70,.45),(.88,0),(1,0)])
  body.y=-.040*wind+.085*strike;body.z=.075*wind+.021*strike
  rot.x=.145*wind-.080*strike
  horn.x=.270*wind-.140*strike
  visor=.105*wind-.045*strike;lids=.055*wind;wheel=.045*wind-.065*strike
 elif clip=='hit':
  shock=pulse(t,.24,.30);shake=math.sin(t*math.tau*2)*pulse(t,.48,.43)
  body.y=-.024*shock;body.z=.024*shock;rot.x=.07*shock;rot.y=.055*shake;rot.z=-.025*shock
  horn.x=.17*shock;horn.y=.035*shake;horn.z=.06*shake;visor=.15*shock;lids=-.065*shock
 elif clip=='defeat':
  surprise=pulse(t,.15,.18);settle=smooth((t-.24)/.45)
  body.z=.029*surprise-.043*settle;rot.x=.055*surprise-.030*settle;rot.z=-.035*settle
  horn.x=.12*surprise-.50*settle;horn.z=-.045*settle;hornLift=.225*settle
  visor=.11*surprise-.035*settle;lids=.36*settle;lidDrop=-.07*settle
 matrices={}
 def put(name,matrix):
  pb=arm.pose.bones[name];rest=pb.bone.matrix_local
  prefix=matrices[pb.parent.name]@pb.parent.bone.matrix_local.inverted()@rest if pb.parent else rest
  pb.matrix_basis=prefix.inverted()@matrix;matrices[name]=matrix
 def inherited(name,rotation=(0,0,0),shift=(0,0,0)):
  pb=arm.pose.bones[name];base=matrices[pb.parent.name]@pb.parent.bone.matrix_local.inverted()@pb.bone.matrix_local
  # Rotate in parent-rest world axes at the attached local pivot.
  parent_basis=matrices[pb.parent.name].to_3x3()@pb.parent.bone.matrix_local.to_3x3().inverted()
  r=parent_basis@Euler(rotation).to_matrix()@parent_basis.inverted()
  put(name,Matrix.Translation(base.translation+Vector(shift)*factor)@r.to_4x4()@base.to_3x3().to_4x4())
 put('root',arm.data.bones['root'].matrix_local.copy())
 inherited('body',rot,body);inherited('visor',(visor,0,0));inherited('horn_lift',shift=(0,0,hornLift));inherited('horn',horn)
 for side in [-1,1]:inherited('lid_'+str(side),(0,side*lids,0),(0,0,lidDrop))
 for name in REST:
  if name.startswith('wheel_'):inherited(name,(wheel,0,steer if 'front' in name else 0))

scene=bpy.context.scene;scene.render.fps=FPS;scene.frame_start=0;scene.frame_end=144
assert scene.get('work_order')=='WO111' and scene.get('scene_lease')=='active' and scene.get('asset_id')=='honk-bus'
scene['asset_id']='honk-bus';scene['asset_version']='v001'
scene['candidate_status']="WO111 honk-bus v001 · Awaiting Tom's review · used in the family release"
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
 records.append({'name':name,'duration_s':duration,'loop':loop,'clamp_when_finished':not loop,'contact_time_s':1.25 if name=='attack' else None,'contact_fraction':.625 if name=='attack' else None,'held_warning_s':[.60,1.05] if name=='attack' else None,'held_final_pose_from_s':1.656 if name=='defeat' else None})
arm.animation_data.action=None
for pb in arm.pose.bones:pb.matrix_basis=Matrix.Identity(4)
scene.frame_set(0);bpy.context.view_layer.update()
arm['attack_contact_seconds']=1.25;arm['attack_contact_fraction']=.625
bp=ROOT/'source/bounds.json'
if bp.exists():
 br=json.loads(bp.read_text());skin['model_space_bounds_y_up']=br['safe_culling_envelope'];skin['bounds_method']=br['method']
for name in ('build.py','common.py','animate.py'):
 old=bpy.data.texts.get('WO111 honk bus '+name)
 if old:bpy.data.texts.remove(old)
 block=bpy.data.texts.new('WO111 honk bus '+name);block.write((ROOT/'source'/name).read_text())
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'honk-bus.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'honk-bus.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_def_bones=False,export_armature_object_remove=True,export_all_influences=False,export_influence_nb=4,export_apply=False,export_texcoords=True,export_normals=True,export_tangents=False,export_materials='EXPORT',export_vertex_color='NONE',export_image_format='AUTO',export_all_vertex_colors=False,export_cameras=False,export_lights=False,export_extras=True)
record=json.loads((ROOT/'construction.json').read_text());record['clips']=records;record['files']={name:{'bytes':(ROOT/name).stat().st_size,'sha256':hashlib.sha256((ROOT/name).read_bytes()).hexdigest()} for name in ['honk-bus.blend','honk-bus.glb','pigment.png']}
record['lead_corrections']=['Removed thin roof-side rods whose ends projected at visor/corners.','Teal fenders have thick body-seated sections and terminate within the body side / lower stripe.','Wheel treads follow constant-radius arcs to keep rotating tires above the floor.','The continuous horn support extends only for defeat, allowing a 0.50 rad sheepish downward bell tilt without roof penetration.','Defeat eyelids lower 0.07 construction metres and rotate 0.36 rad into a sheepish expression; other clip acting is unchanged.']
(ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({'clips':records,'files':record['files']}))
