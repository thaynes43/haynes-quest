"""WO111 gadget-helper hover acting: bob and handle twitch, balancing move,
held wrench warning with a forward chop at 1.25 s, recoil hit and a sputtering
defeat that lands on the skirt. Baked every frame into five NLA clips.

The arm is posed by aiming the wrist and wrench in the body's rest frame and
solving the two accordion segments, so every clip keeps the hose attached.
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler, Quaternion
ROOT=Path('/workspace/haynes-quest/family-eras/gadget-helper/v001')
REST={k:(Vector(v[0]),Vector(v[1]),v[2]) for k,v in json.loads((ROOT/'source/rig-rest.json').read_text())['rest'].items()}
FPS=60
arm=bpy.data.objects['Gadget_Helper_Rig'];skin=bpy.data.objects['Gadget_Helper_Skin']
CLIPS=[('idle',2.4,True),('move',1.2,True),('attack',2.0,False),('hit',.7,False),('defeat',2.4,False)]
CONTACT=.625;WARN=(.30,.525);DEFEAT_HOLD=.70;DROP=.144

def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
def bell(t,c,w):return smooth(1-abs(t-c)/w)
def scalar(t,keys):
 if t<=keys[0][0]:return keys[0][1]
 for (a,x),(b,y) in zip(keys,keys[1:]):
  if t<=b:return x+(y-x)*smooth((t-a)/(b-a))
 return keys[-1][1]
def vec(t,keys):
 if t<=keys[0][0]:return Vector(keys[0][1])
 for (a,x),(b,y) in zip(keys,keys[1:]):
  if t<=b:return Vector(x).lerp(Vector(y),smooth((t-a)/(b-a)))
 return Vector(keys[-1][1])
def unit(v):return Vector(v).normalized()

S=REST['arm_1'][0];E0=REST['arm_1'][1];W0=REST['arm_2'][1];H0=REST['wrench'][1]
L1=(E0-S).length;L2=(W0-E0).length;DIR0=(H0-W0).normalized()
# Rest bend plane: the elbow sits below/outside the shoulder-wrist line.
_line=(W0-S).normalized();POLE0=((E0-S)-_line*(E0-S).dot(_line)).normalized()

def solve_elbow(w,pole):
 delta=w-S;dist=min(max(delta.length,1e-5),L1+L2-1e-6);d=delta.normalized()
 side=Vector(pole)-d*d.dot(Vector(pole))
 if side.length<1e-4:side=POLE0-d*d.dot(POLE0)
 side.normalize();along=(L1*L1-L2*L2+dist*dist)/(2*dist)
 return S+d*along+side*math.sqrt(max(0,L1*L1-along*along)),S+d*dist

def evaluate(clip,t):
 tau=math.tau*t;sn=math.sin(tau);cs=math.cos(tau)
 p={'body_shift':Vector(),'body_rot':Vector(),'lid':Vector(),'handle':Vector(),'paddle':Vector(),'thrusters':Vector(),'pupils':Vector(),
    'wrist':W0.copy(),'dir':DIR0.copy(),'pole':POLE0.copy()}
 if clip=='idle':
  p['body_shift'].z=.024*sn
  p['body_rot']=Vector((.022*cs,.030*math.sin(tau+.7),.018*sn))
  twitch=bell(t,.52,.09)-.45*bell(t,.64,.07)
  p['handle'].x=.34*twitch
  p['paddle']=Vector((.10*math.sin(tau+1.2),-.14*math.sin(tau+.4),0))
  p['thrusters'].z=.004*math.sin(2*tau)
  p['pupils']=Vector((.006*math.sin(tau-.5),0,.003*cs))
  p['wrist']=W0+Vector((-.012*sn,.014*math.sin(tau+1.1),.016*math.sin(tau+.3)))
  p['dir']=Matrix.Rotation(.12*math.sin(tau+.6),3,'Y')@DIR0
 elif clip=='move':
  p['body_shift']=Vector((0,.012*math.sin(2*tau),.020*math.sin(2*tau+.5)))
  p['body_rot']=Vector((-.10+.025*math.sin(2*tau),.055*sn,.035*sn))
  p['handle'].x=.20+.10*math.sin(2*tau+1.0)
  p['paddle']=Vector((.18*cs,-.36*sn,0))
  p['thrusters'].z=.006*math.sin(2*tau+2)
  p['pupils']=Vector((.004,0,-.004))
  p['wrist']=W0+Vector((-.010*cs,-.050*sn,.022*math.sin(2*tau)))
  p['dir']=Matrix.Rotation(.16*math.sin(tau+.9),3,'Y')@Matrix.Rotation(-.18*sn,3,'X')@DIR0
 elif clip=='attack':
  wind=scalar(t,[(0,0),(WARN[0],1),(WARN[1],1),(CONTACT,0),(1,0)])
  strike=scalar(t,[(0,0),(WARN[1],0),(CONTACT,1),(.66,1),(.90,0),(1,0)])
  p['body_shift']=Vector((0,-.030*wind+.060*strike,.100*wind-.020*strike))
  p['body_rot']=Vector((.050*wind-.140*strike,-.040*wind-.060*strike,.100*wind-.180*strike))
  p['handle'].x=.30*wind-.36*strike+.10*bell(t,.74,.10)
  p['paddle']=Vector((0,-.32*wind+.30*strike,0))
  p['lid'].x=.05*bell(t,CONTACT+.02,.06)
  p['pupils']=Vector((-.007*strike,0,-.006*wind-.004*strike))
  Ww=(-.60,-.06,.80);Wm=(-.64,.12,.70);Wc=(-.48,.31,.49)
  Dw=unit((-.35,-.40,.85));Dm=unit((-.30,.60,.74));Dc=unit((.10,.85,-.45))
  p['wrist']=vec(t,[(0,W0),(WARN[0],Ww),(WARN[1],Ww),(.575,Wm),(CONTACT,Wc),(.66,Wc),(1,W0)])
  p['dir']=unit(vec(t,[(0,DIR0),(WARN[0],Dw),(WARN[1],Dw),(.575,Dm),(CONTACT,Dc),(.66,Dc),(1,DIR0)]))
  p['pole']=unit(vec(t,[(0,POLE0),(WARN[0],(-.9,-.1,-.4)),(WARN[1],(-.9,-.1,-.4)),(CONTACT,(-.9,0,-.45)),(.66,(-.9,0,-.45)),(1,POLE0)]))
 elif clip=='hit':
  shock=bell(t,.22,.22);shake=math.sin(math.tau*2.5*t)*(1-t)**2
  p['body_shift']=Vector((0,-.070*shock,.030*shock))
  p['body_rot']=Vector((.16*shock,.10*shake,-.06*shock))
  p['lid'].x=.12*bell(t,.25,.20)
  p['handle'].x=.50*bell(t,.30,.30)-.20*bell(t,.62,.20)
  p['paddle']=Vector((.12*shake,-.30*shake,0))
  p['pupils']=Vector((0,0,.009*shock))
  p['wrist']=W0+Vector((-.05,-.06,.08))*shock
  p['dir']=Matrix.Rotation(-.25*shock,3,'X')@Matrix.Rotation(-.20*shake,3,'Y')@DIR0
 elif clip=='defeat':
  surprise=bell(t,.10,.10);sputter=math.sin(math.tau*6*t)*bell(t,.28,.14);settle=smooth((t-.20)/(DEFEAT_HOLD-.20))
  p['body_shift']=Vector((0,-.02*settle,.05*surprise+.012*sputter-DROP*settle))
  p['body_rot']=Vector((.05*surprise-.07*settle,.05*sputter,.10*settle))
  p['thrusters'].z=.065*smooth((t-.15)/.40)
  p['lid']=Vector((.18*surprise+.07*settle,-.04*settle,0))
  p['handle'].x=.45*surprise-.95*settle
  p['paddle']=Vector((0,.50*settle-.25*surprise,0))
  p['pupils']=Vector((.008*settle,0,.010*surprise-.011*settle))
  Wd=(-.70,.05,.55);Dd=unit((-.55,.20,-.81))
  lift=W0+Vector((-.03,0,.10))
  p['wrist']=vec(t,[(0,W0),(.10,lift),(.20,lift),(DEFEAT_HOLD,Wd),(1,Wd)])
  p['dir']=unit(vec(t,[(0,DIR0),(.10,unit((-.2,-.1,.97))),(.20,unit((-.2,-.1,.97))),(DEFEAT_HOLD,Dd),(1,Dd)]))
  p['pole']=unit(vec(t,[(0,POLE0),(DEFEAT_HOLD,(-.3,0,-.95)),(1,(-.3,0,-.95))]))
 return p

def local(pivot,rot=Vector(),shift=Vector()):
 R=rot if isinstance(rot,Matrix) else Euler(rot).to_matrix()
 return Matrix.Translation(pivot+shift)@R.to_4x4()@Matrix.Translation(-pivot)

def rotation_between(a,b):return a.normalized().rotation_difference(b.normalized()).to_matrix()

def pose_matrices(p):
 """Rest-space local transform for each bone about its own rest pivot."""
 L={}
 L['body']=local(REST['body'][0],p['body_rot'],p['body_shift'])
 L['thrusters']=local(REST['thrusters'][0],shift=p['thrusters'])
 L['lid']=local(REST['lid'][0],p['lid'])
 L['handle']=local(REST['handle'][0],p['handle'])
 L['pupils']=local(REST['pupils'][0],shift=p['pupils'])
 L['paddle']=local(REST['paddle'][0],p['paddle'])
 E,W=solve_elbow(p['wrist'],p['pole'])
 R1=rotation_between(E0-S,E-S)
 R2=rotation_between(W0-E0,R1.inverted()@(W-E))
 R3=rotation_between(DIR0,(R1@R2).inverted()@p['dir'])
 L['arm_1']=local(S,R1);L['arm_2']=local(E0,R2);L['wrench']=local(W0,R3)
 return L,{'elbow':E,'wrist':W}

ORDER=['body','thrusters','lid','handle','pupils','paddle','arm_1','arm_2','wrench']
PREV={}
def apply(p):
 L,_=pose_matrices(p)
 for name in ORDER:
  pb=arm.pose.bones[name];rest=pb.bone.matrix_local
  basis=rest.inverted()@L[name]@rest
  loc,quat,_=basis.decompose()
  if name in PREV and PREV[name].dot(quat)<0:quat.negate()
  PREV[name]=quat.copy()
  pb.rotation_mode='QUATERNION';pb.location=loc;pb.rotation_quaternion=quat;pb.scale=(1,1,1)

if __name__=='__main__':
 scene=bpy.context.scene;scene.render.fps=FPS;scene.frame_start=0;scene.frame_end=144
 assert scene.get('work_order')=='WO111' and scene.get('scene_lease')=='active' and scene.get('asset_id')=='gadget-helper'
 scene['asset_id']='gadget-helper';scene['asset_version']='v001'
 scene['candidate_status']="WO111 gadget-helper v001 · Awaiting Tom's review · used in the family release"
 arm.animation_data_clear();arm.animation_data_create()
 for action in list(bpy.data.actions):bpy.data.actions.remove(action)
 records=[]
 for name,duration,loop in CLIPS:
  action=bpy.data.actions.new(name);arm.animation_data.action=action;end=round(duration*FPS);PREV.clear()
  for frame in range(end+1):
   scene.frame_set(frame);apply(evaluate(name,frame/end))
   for pb in arm.pose.bones:
    if pb.name=='root':continue
    for field in ('location','rotation_quaternion','scale'):pb.keyframe_insert(data_path=field,frame=frame,group=pb.name)
  for fc in action.fcurves:
   for k in fc.keyframe_points:k.interpolation='LINEAR'
  track=arm.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,0,action);strip.action_frame_start=0;strip.action_frame_end=end;track.mute=True
  records.append({'name':name,'duration_s':duration,'loop':loop,'clamp_when_finished':not loop,'contact_time_s':CONTACT*duration if name=='attack' else None,'contact_fraction':CONTACT if name=='attack' else None,
   'held_warning_s':[WARN[0]*duration,WARN[1]*duration] if name=='attack' else None,'held_final_pose_from_s':round(DEFEAT_HOLD*duration,4) if name=='defeat' else None})
 arm.animation_data.action=None
 for pb in arm.pose.bones:pb.matrix_basis=Matrix.Identity(4)
 scene.frame_set(0);bpy.context.view_layer.update()
 arm['attack_contact_seconds']=1.25;arm['attack_contact_fraction']=CONTACT
 bp=ROOT/'source/bounds.json'
 if bp.exists():
  br=json.loads(bp.read_text());skin['model_space_bounds_y_up']=br['safe_culling_envelope'];skin['bounds_method']=br['method']
 for name in ('build.py','common.py','animate.py'):
  old=bpy.data.texts.get('WO111 gadget helper '+name)
  if old:bpy.data.texts.remove(old)
  block=bpy.data.texts.new('WO111 gadget helper '+name);block.write((ROOT/'source'/name).read_text())
 bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'gadget-helper.blend'),compress=True)
 bpy.ops.export_scene.gltf(filepath=str(ROOT/'gadget-helper.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_def_bones=False,export_armature_object_remove=True,export_all_influences=False,export_influence_nb=4,export_apply=False,export_texcoords=True,export_normals=True,export_tangents=False,export_materials='EXPORT',export_vertex_color='NONE',export_image_format='AUTO',export_all_vertex_colors=False,export_cameras=False,export_lights=False,export_extras=True)
 record=json.loads((ROOT/'construction.json').read_text());record['clips']=records;record['files']={name:{'bytes':(ROOT/name).stat().st_size,'sha256':hashlib.sha256((ROOT/name).read_bytes()).hexdigest()} for name in ['gadget-helper.blend','gadget-helper.glb','pigment.png']}
 (ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({'clips':records,'files':record['files']}))
