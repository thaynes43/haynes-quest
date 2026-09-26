"""WO111 yes-yes-veggie acting: stubborn "no-no" head shake, bouncy
alternating-foot waddle, crouched hands-up warning with a belly-bump shove at
1.25 s, startled recoil and a planted, squashed-down sulk that holds. Baked
every frame at 60 Hz into five NLA clips under a stationary root.

Arms are posed from upper-arm, forearm and leaf-frame directions given in an
"outward" convention (x = away from the body) and mirrored per side, so both
leaf mittens stay attached and symmetric. Every bone transform is a rest-space
delta about a chosen pivot, composed down the hierarchy.
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler
ROOT=Path('/workspace/haynes-quest/family-eras/yes-yes-veggie/v001')
REST={k:(Vector(v[0]),Vector(v[1]),v[2]) for k,v in json.loads((ROOT/'source/rig-rest.json').read_text())['rest'].items()}
LEAVES=json.loads((ROOT/'construction.json').read_text())['leaves']
FPS=60
arm=bpy.data.objects['Yes_Yes_Veggie_Rig'];skin=bpy.data.objects['Yes_Yes_Veggie_Skin']
CLIPS=[('idle',2.4,True),('move',1.0,True),('attack',2.0,False),('hit',.7,False),('defeat',2.4,False)]
CONTACT=.625;WARN=(.30,.525);DEFEAT_HOLD=.70

def smooth(t):t=max(0.0,min(1.0,t));return t*t*(3-2*t)
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
def Rx(a):return Matrix.Rotation(a,3,'X')
def Ry(a):return Matrix.Rotation(a,3,'Y')
def Rz(a):return Matrix.Rotation(a,3,'Z')

# ---- Arm rest frames (actual Blender coordinates) and the outward convention.
SUF={-1:'L',1:'R'}
ARM={}
for side in (-1,1):
 s=SUF[side];S=REST['arm_'+s][0];E0=REST['arm_'+s][1];W0=REST['fore_'+s][1]
 lf=LEAVES['hand_'+s];WAX0=Vector(lf['w_axis']).normalized();NAX0=Vector(lf['n_axis']).normalized()
 ARM[side]=(S,E0,W0,WAX0,NAX0)
def out(side,v):return Vector((side*v[0],v[1],v[2]))
def inward(side,v):return Vector((side*v[0],v[1],v[2]))  # mirror is its own inverse
_S,_E,_W,_WA,_NA=ARM[1]
REST_ARM={'d1':unit(_E-_S),'d2':unit(_W-_E),'wax':_WA.copy(),'nax':_NA.copy()}  # right arm = outward convention
def arm_rest():return {k:v.copy() for k,v in REST_ARM.items()}
def arm_rot(R,base=None):
 b=base or REST_ARM;return {k:(R@v) for k,v in b.items()}
def arm_mix(t,keys):
 """keys: [(t, pose)] with pose dicts of outward directions; smooth lerp per direction."""
 return {k:unit(vec(t,[(a,p[k]) for a,p in keys])) for k in ('d1','d2','wax','nax')}

def frame(a,n):
 a=a.normalized();n=(n-a*n.dot(a)).normalized();return Matrix((a,n,a.cross(n))).transposed()
def rotation_between(a,b):return a.normalized().rotation_difference(b.normalized()).to_matrix()
def local(pivot,R=None,shift=Vector()):
 R=R if R is not None else Matrix.Identity(3)
 if not isinstance(R,Matrix):R=Euler(R).to_matrix()
 return Matrix.Translation(Vector(pivot)+Vector(shift))@R.to_4x4()@Matrix.Translation(-Vector(pivot))
def arm_deltas(side,pose):
 S,E0,W0,WAX0,NAX0=ARM[side]
 d1=out(side,pose['d1']);d2=out(side,pose['d2']);wax=out(side,pose['wax']);nax=out(side,pose['nax'])
 R1=rotation_between(E0-S,d1);R2=rotation_between(W0-E0,R1.inverted()@d2)
 R3=(R1@R2).inverted()@frame(wax,nax)@frame(WAX0,NAX0).transposed()
 return local(S,R1),local(E0,R2),local(W0,R3)

# Key arm poses (outward convention).
WARN_ARM={'d1':unit((.92,.30,.25)),'d2':unit((.40,.35,.85)),'wax':unit((.15,.55,.82)),'nax':unit((.20,1.0,0))}
STRIKE_ARM={'d1':unit((.62,.76,.15)),'d2':unit((.40,.91,.10)),'wax':unit((.30,.72,.62)),'nax':unit((0,.60,-.80))}
SWING_ARM={'d1':unit((.80,.55,.25)),'d2':unit((.45,.70,.55)),'wax':unit((.28,.62,.73)),'nax':unit((.10,.90,-.45))}
DEFEAT_ARM={'d1':unit((.70,.35,-.62)),'d2':unit((.55,.50,-.67)),'wax':unit((.40,.50,-.77)),'nax':unit((.75,.15,.64))}

def evaluate(clip,t):
 tau=math.tau*t;sn=math.sin(tau);cs=math.cos(tau)
 p={'hips_shift':Vector(),'hips_rot':Vector(),'body_shift':Vector(),'body_rot':Vector(),'crown_rot':Vector(),
    'leg_L_shift':Vector(),'leg_L_rot':Vector(),'leg_R_shift':Vector(),'leg_R_rot':Vector(),
    'pupils':Vector(),'brow_L':Vector(),'brow_R':Vector(),'brow_L_z':0.0,'brow_R_z':0.0,
    'arm_L':arm_rest(),'arm_R':arm_rest()}
 if clip=='idle':
  # Two stubborn "no-no" shakes per loop, with the crown lagging behind.
  env=.55+.45*math.cos(tau)
  yaw=.21*math.sin(2*tau)*env
  p['hips_shift'].z=-.004+.004*math.cos(2*tau)
  p['body_rot']=Vector((-.02+.012*math.sin(2*tau+.4),.025*sn,yaw))
  p['crown_rot']=Vector((.025*math.sin(2*tau+1.2),.04*math.sin(tau+.9),-.55*yaw*math.cos(.3)+.05*math.sin(2*tau-.9)))
  p['pupils']=Vector((.0035*math.sin(2*tau+.6),0,.002*cs))
  furrow=.06+.05*math.sin(2*tau)
  p['brow_L']=Vector((0,furrow,0));p['brow_R']=Vector((0,-furrow,0))
  for side,key in ((-1,'arm_L'),(1,'arm_R')):
   swing=-.10*math.sin(2*tau-.8)*side*env
   p[key]=arm_rot(Rx(swing)@Ry(-.10-.04*math.sin(2*tau)))
 elif clip=='move':
  # Bouncy in-place waddle: one lifted foot per half cycle, body rises on each step.
  liftL=max(0.0,sn)**1.3;liftR=max(0.0,-sn)**1.3
  p['leg_L_shift']=Vector((-.006*liftL,.018*math.sin(tau-.5)*liftL,.046*liftL))
  p['leg_R_shift']=Vector((.006*liftR,.018*math.sin(tau+math.pi-.5)*liftR,.046*liftR))
  p['leg_L_rot']=Vector((.22*liftL,0,0));p['leg_R_rot']=Vector((.22*liftR,0,0))
  bounce=abs(sn)
  p['hips_shift']=Vector((.016*sn,0,-.016+.040*bounce))
  p['hips_rot']=Vector((0,.10*sn,.05*sn))
  p['body_rot']=Vector((-.07+.03*math.cos(2*tau),-.05*sn,-.03*sn))
  p['crown_rot']=Vector((.05*math.cos(2*tau-1.0),-.07*math.sin(tau-.6),.03*math.sin(tau-.6)))
  p['pupils']=Vector((0,0,-.002))
  p['brow_L']=Vector((0,.10,0));p['brow_R']=Vector((0,-.10,0))
  for side,key in ((-1,'arm_L'),(1,'arm_R')):
   p[key]=arm_rot(Rx(.34*sn*side)@Ry(-.14))
 elif clip=='attack':
  wind=scalar(t,[(0,0),(WARN[0],1),(WARN[1],1),(CONTACT,0),(1,0)])
  strike=scalar(t,[(0,0),(WARN[1],0),(CONTACT,1),(.66,1),(.88,0),(1,0)])
  flop=bell(t,.74,.12)
  p['hips_shift']=Vector((0,-.030*wind+.100*strike,-.045*wind-.012*strike))
  p['hips_rot']=Vector((.06*wind+.08*strike,0,0))
  p['body_rot']=Vector((.08*wind-.15*strike-.06*flop,0,0))
  p['crown_rot']=Vector((.06*wind+.10*strike-.16*flop,0,0))
  p['pupils']=Vector((0,0,-.004*wind-.003*strike))
  angry=.16*wind+.10*strike
  p['brow_L']=Vector((0,angry+.05,0));p['brow_R']=Vector((0,-angry-.05,0))
  p['brow_L_z']=p['brow_R_z']=-.004*wind
  a=arm_mix(t,[(0,REST_ARM),(WARN[0],WARN_ARM),(WARN[1],WARN_ARM),(.575,SWING_ARM),(CONTACT,STRIKE_ARM),(.66,STRIKE_ARM),(1,REST_ARM)])
  p['arm_L']=a;p['arm_R']={k:v.copy() for k,v in a.items()}
 elif clip=='hit':
  shock=bell(t,.22,.22);shake=math.sin(math.tau*2.5*t)*(1-t)**2
  p['hips_shift']=Vector((0,-.050*shock,.012*shock))
  p['hips_rot']=Vector((.06*shock,.03*shake,0))
  p['body_rot']=Vector((.20*shock,.06*shake,.05*shake))
  p['crown_rot']=Vector((.16*bell(t,.30,.26)-.08*bell(t,.62,.22),.08*shake,0))
  p['pupils']=Vector((0,0,.006*shock))
  p['brow_L_z']=p['brow_R_z']=.009*shock
  p['brow_L']=Vector((0,-.10*shock,0));p['brow_R']=Vector((0,.10*shock,0))
  for side,key in ((-1,'arm_L'),(1,'arm_R')):
   p[key]=arm_rot(Rx(-.20*shock+.10*shake*side)@Ry(-.95*shock))
 elif clip=='defeat':
  surprise=bell(t,.10,.10);settle=smooth((t-.18)/(DEFEAT_HOLD-.18))
  wob=math.sin(math.tau*3*t)*bell(t,.42,.18)
  p['hips_shift']=Vector((0,-.020*settle,.030*surprise-.085*settle))
  p['hips_rot']=Vector((-.04*settle,.05*settle,0))
  p['body_rot']=Vector((.12*surprise-.20*settle,-.09*settle+.05*wob,.05*settle))
  p['crown_rot']=Vector((.10*surprise-.20*settle,.14*settle-.04*wob,0))
  p['leg_L_rot']=Vector((0,0,.30*settle));p['leg_R_rot']=Vector((0,0,-.30*settle))
  p['pupils']=Vector((-.004*settle,0,.006*surprise-.007*settle))
  p['brow_L']=Vector((0,-.12*settle-.08*surprise,0));p['brow_R']=Vector((0,.12*settle+.08*surprise,0))
  p['brow_L_z']=p['brow_R_z']=.008*surprise-.002*settle
  up=arm_rot(Ry(-.80))
  a=arm_mix(t,[(0,REST_ARM),(.10,up),(.20,up),(DEFEAT_HOLD,DEFEAT_ARM),(1,DEFEAT_ARM)])
  p['arm_L']=a;p['arm_R']={k:v.copy() for k,v in a.items()}
 return p

FOOT={-1:Vector((-.12,.012,0)),1:Vector((.12,.012,0))}
def pose_matrices(p):
 """Rest-space delta per bone, relative to its parent's delta."""
 L={}
 L['hips']=local(REST['hips'][0],Euler(p['hips_rot']).to_matrix(),p['hips_shift'])
 L['body']=local(REST['body'][0],Euler(p['body_rot']).to_matrix(),p['body_shift'])
 L['crown']=local(REST['crown'][0],Euler(p['crown_rot']).to_matrix())
 L['pupils']=local(REST['pupils'][0],shift=p['pupils'])
 for s in ('L','R'):
  L['brow_'+s]=local(REST['brow_'+s][0],Euler(p['brow_'+s]).to_matrix(),Vector((0,0,p['brow_%s_z'%s])))
 for side,s in ((-1,'L'),(1,'R')):
  L['leg_'+s]=local(FOOT[side],Euler(p['leg_%s_rot'%s]).to_matrix(),p['leg_%s_shift'%s])
  a,f,h=arm_deltas(side,p['arm_'+s]);L['arm_'+s]=a;L['fore_'+s]=f;L['hand_'+s]=h
 return L

ORDER=['hips','body','crown','pupils','brow_L','brow_R','leg_L','leg_R','arm_L','fore_L','hand_L','arm_R','fore_R','hand_R']
PREV={}
def apply(p):
 L=pose_matrices(p)
 for name in ORDER:
  pb=arm.pose.bones[name];rest=pb.bone.matrix_local
  basis=rest.inverted()@L[name]@rest
  loc,quat,_=basis.decompose()
  if name in PREV and PREV[name].dot(quat)<0:quat.negate()
  PREV[name]=quat.copy()
  pb.rotation_mode='QUATERNION';pb.location=loc;pb.rotation_quaternion=quat;pb.scale=(1,1,1)

if __name__=='__main__':
 scene=bpy.context.scene;scene.render.fps=FPS;scene.frame_start=0;scene.frame_end=144
 assert scene.get('work_order')=='WO111' and scene.get('scene_lease')=='active' and scene.get('asset_id')=='yes-yes-veggie'
 scene['asset_id']='yes-yes-veggie';scene['asset_version']='v001'
 scene['candidate_status']="WO111 yes-yes-veggie v001 · Awaiting Tom's review · used in the family release"
 arm.animation_data_clear();arm.animation_data_create()
 for action in list(bpy.data.actions):bpy.data.actions.remove(action)
 records=[]
 for name,duration,loop in CLIPS:
  action=bpy.data.actions.new(name);arm.animation_data.action=action;end=round(duration*FPS);PREV.clear()
  for frame_i in range(end+1):
   scene.frame_set(frame_i);apply(evaluate(name,frame_i/end))
   for pb in arm.pose.bones:
    if pb.name=='root':continue
    for field in ('location','rotation_quaternion','scale'):pb.keyframe_insert(data_path=field,frame=frame_i,group=pb.name)
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
  old=bpy.data.texts.get('WO111 yes-yes veggie '+name)
  if old:bpy.data.texts.remove(old)
  block=bpy.data.texts.new('WO111 yes-yes veggie '+name);block.write((ROOT/'source'/name).read_text())
 bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'yes-yes-veggie.blend'),compress=True)
 bpy.ops.export_scene.gltf(filepath=str(ROOT/'yes-yes-veggie.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_def_bones=False,export_armature_object_remove=True,export_all_influences=False,export_influence_nb=4,export_apply=False,export_texcoords=True,export_normals=True,export_tangents=False,export_materials='EXPORT',export_vertex_color='ACTIVE',export_all_vertex_colors=False,export_image_format='AUTO',export_cameras=False,export_lights=False,export_extras=True)
 record=json.loads((ROOT/'construction.json').read_text());record['clips']=records;record['files']={name:{'bytes':(ROOT/name).stat().st_size,'sha256':hashlib.sha256((ROOT/name).read_bytes()).hexdigest()} for name in ['yes-yes-veggie.blend','yes-yes-veggie.glb','pigment.png']}
 (ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({'clips':records,'files':record['files']}))
