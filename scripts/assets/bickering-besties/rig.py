"""Explicit connected Besties rig and baked, stationary-root pair acting.

Offline two-bone targets produce attached arms and planted soles. Runtime needs
no IK constraints: the final GLB contains ordinary named bone animation tracks.
"""
from pathlib import Path
import bpy, math, json, hashlib
from mathutils import Vector, Matrix, Euler
import common as C

FPS=30
CLIPS=[('idle',2.4,True),('move',1.2,True),('attack',1.6,False),('hit',.6,False),('defeat',2.,False),('cheer',2.,True),('high-five',1.6,False),('dizzy',2.4,True)]
REST={}

def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
def pulse(t,c,w):return smooth(1-abs(t-c)/w)
def lerp(a,b,t):return Vector(a).lerp(Vector(b),t)

def skeleton():
    r={
        'root':((0,0,0),(0,0,.070),None),
        'hips':((0,0,.565),(0,0,.690),'root'),
        'spine':((0,0,.690),(0,0,.920),'hips'),
        'neck':((0,0,.920),(0,0,1.006),'spine'),
        'head':((0,0,1.006),(0,0,1.315),'neck'),
    }
    for label,s in [('R',1),('L',-1)]:
        r.update({
            'clavicle_'+label:((0,0,.920),(s*.235,0,.925),'spine'),
            'upper_arm_'+label:((s*.235,0,.925),(s*.322,0,.744),'clavicle_'+label),
            'forearm_'+label:((s*.322,0,.744),(s*.370,0,.567),'upper_arm_'+label),
            'hand_'+label:((s*.370,0,.567),(s*.383,0,.506),'forearm_'+label),
            'pelvis_'+label:((0,0,.565),(s*.128,0,.565),'hips'),
            'thigh_'+label:((s*.128,0,.565),(s*.128,0,.355),'pelvis_'+label),
            'shin_'+label:((s*.128,0,.355),(s*.128,0,.145),'thigh_'+label),
            'foot_'+label:((s*.128,0,.145),(s*.128,.160,.078),'shin_'+label),
        })
    return r

def build_rig():
    points=[v.co for ob in C.PARTS for v in ob.data.vertices]
    low=min(p.z for p in points);high=max(p.z for p in points);factor=1.4/(high-low)
    sources=bpy.data.collections.new('EDITABLE original named construction — excluded from export')
    bpy.context.scene.collection.children.link(sources);inventory=[];copies=[];ranges={};offset=0
    for ob in C.PARTS:
        for v in ob.data.vertices:v.co=Vector((v.co.x*factor,v.co.y*factor,(v.co.z-low)*factor))
        ob.data.calc_loop_triangles()
        inventory.append({'name':ob.name,'vertices':len(ob.data.vertices),'triangles':len(ob.data.loop_triangles),'groups':[g.name for g in ob.vertex_groups],'atlas_tile':ob['atlas_tile']})
        cp=ob.copy();cp.data=ob.data.copy();bpy.context.collection.objects.link(cp);copies.append(cp)
        ranges[ob.name]=list(range(offset,offset+len(ob.data.vertices)));offset+=len(ob.data.vertices)
        for col in list(ob.users_collection):col.objects.unlink(ob)
        sources.objects.link(ob)
    sources.hide_render=True;sources.hide_viewport=True
    bpy.ops.object.select_all(action='DESELECT')
    for ob in copies:ob.select_set(True)
    bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join()
    skin=bpy.context.object;skin.name=C.SPEC['asset_id']+'_skin'
    data=bpy.data.armatures.new('Explicit connected humanoid skeleton')
    arm=bpy.data.objects.new(C.SPEC['asset_id']+'_rig',data);bpy.context.collection.objects.link(arm)
    skin.select_set(False);arm.select_set(True);bpy.context.view_layer.objects.active=arm
    bpy.ops.object.mode_set(mode='EDIT')
    global REST;REST=skeleton()
    for name,(head,tail,parent) in REST.items():
        b=data.edit_bones.new(name)
        b.head=Vector((head[0]*factor,head[1]*factor,(head[2]-low)*factor))
        b.tail=Vector((tail[0]*factor,tail[1]*factor,(tail[2]-low)*factor))
        if parent:
            b.parent=data.edit_bones[parent]
            b.use_connect=(b.head-b.parent.tail).length<.00001
        b.use_deform=name not in ('root','pelvis_R','pelvis_L')
    bpy.ops.object.mode_set(mode='OBJECT')
    modifier=skin.modifiers.new('Continuous shoulder, elbow, wrist, hip and knee skin','ARMATURE');modifier.object=arm
    skin.parent=arm;arm['asset_id']=C.SPEC['asset_id'];arm['version']='v001';arm['approval']='pending exact final export review'
    arm['forward']='Blender +Y, glTF -Z';arm['height_m']=1.4;arm['pair_hand']='R' if C.SPEC['asset_id']=='bestie-pink' else 'L'
    bpy.context.view_layer.update()
    return arm,skin,inventory,factor,low

def solve_two(a,target,l1,l2,pole):
    delta=target-a;distance=min(max(delta.length,.00001),l1+l2-.000001)
    direction=delta.normalized();target=a+direction*distance
    pole=Vector(pole);side=pole-direction*direction.dot(pole)
    if side.length<.0001:side=Vector((0,1,0))-direction*direction.y
    side.normalize();along=(l1*l1-l2*l2+distance*distance)/(2*distance)
    height=math.sqrt(max(0,l1*l1-along*along))
    return a+direction*along+side*height,target

def evaluate_pose(arm,pink,clip,t,factor,low):
    """Direct bone matrices keep the entire kinematic chain explicit and testable."""
    tau=math.tau*t;sw=math.sin(tau);co=math.cos(tau)
    hip_shift=Vector((0,0,-.010));hip_rot=Vector((0,0,0));spine_rot=Vector((0,0,0));head_rot=Vector((0,0,0))
    hands={};foot_goals={};hand_dirs={};sit=0
    for label,s in [('R',1),('L',-1)]:
        hands[label]=Vector((s*.331,.101,.666)) if pink else Vector((-s*.012,.217+(s<0)*.025,.804-(s<0)*.053))
        foot_goals[label]=Vector((s*.128,0,.145))
        hand_dirs[label]=Vector((s*.18,.12,-1))
        if not pink and clip=='idle':hand_dirs[label]=Vector((-s,0,.20))
    if clip=='idle':
        hip_shift.z+=.003*(1-co);spine_rot.y=.017*sw;head_rot.z=(-.035 if pink else .025)+.025*sw
        head_rot.x=.012*sw
        if pink:hands['L']+=Vector((-.015*sw,.013*sw,.019*sw))
    elif clip=='move':
        hip_shift.z=-.018+.007*(1-math.cos(2*tau));spine_rot.y=.029*sw
        for label,s in [('R',1),('L',-1)]:
            phase=tau+(0 if s==1 else math.pi)
            step=math.sin(phase);lift=max(0,step)*.054
            foot_goals[label]+=Vector((0,math.cos(phase)*.083,lift))
            hands[label]=Vector((s*.336,-math.cos(phase)*.118,.653+.015*step))
        head_rot.z=.018*sw
    elif clip=='attack':
        wind=pulse(t,.29,.29);contact=pulse(t,.625,.29);side=1 if pink else -1;label='R' if pink else 'L'
        hands[label]=lerp(hands[label],(side*.325,.038,1.163),wind)
        hands[label]=lerp(hands[label],(side*.277,.319,.928),contact)
        hand_dirs[label]=lerp((side*.18,0,-1),(0,1,.25),max(wind,contact))
        spine_rot.x=-.07*wind+.075*contact;head_rot.x=-.085*wind+.035*contact
        head_rot.z=side*.06*(wind-contact);hip_shift.z-=.012*contact
        other='L' if pink else 'R';hands[other]=Vector((-side*.314,.13,.713+.065*contact))
    elif clip=='hit':
        recoil=pulse(t,.23,.45);hip_shift.y=-.032*recoil;hip_shift.z-=.025*recoil
        spine_rot.x=-.10*recoil;head_rot.x=-.13*recoil
        for label,s in [('R',1),('L',-1)]:hands[label]=lerp(hands[label],(s*.285,.157,.963),recoil)
    elif clip=='defeat':
        surprise=pulse(t,.19,.22);sit=smooth((t-.22)/.54)
        hip_shift=Vector((0,-.043*sit,-.010-.429*sit));spine_rot.x=.07*sit-.12*surprise
        head_rot.x=.055*sit;head_rot.y=(.08 if pink else -.08)*sit
        for label,s in [('R',1),('L',-1)]:
            foot_goals[label]=Vector((s*(.128+.042*sit),.292*sit,.145))
            hands[label]=lerp(hands[label],(s*.265,.104,.260),sit)
            hands[label]+=Vector((s*.023*surprise,.06*surprise,.14*surprise))
            hand_dirs[label]=lerp((s*.18,0,-1),(s*.12,1,-.5),sit)
    elif clip=='cheer':
        hip_shift.z-=.006*(1-co);spine_rot.y=.055*sw;head_rot.y=-.06*sw
        for label,s in [('R',1),('L',-1)]:
            hands[label]=Vector((s*(.335+.012*sw),.096,1.111+s*.042*sw))
            hand_dirs[label]=Vector((s*.10,0,1))
    elif clip=='high-five':
        side=1 if pink else -1;label='R' if pink else 'L'
        reach=smooth(t/.58)*(1-.40*smooth((t-.68)/.32))
        hands[label]=lerp(hands[label],(side*.396,.049 if pink else .180,1.206 if pink else 1.085),reach)
        hand_dirs[label]=lerp((side*.18,0,-1),(side*.20,0,1),reach)
        spine_rot.y=side*.025*reach;head_rot.y=-side*.07*reach
        head_rot.z=side*.075*smooth((t-.65)/.35);hip_shift.z-=.010*pulse(t,.8,.25)
        other='L' if pink else 'R';hands[other]=Vector((-side*.326,.07,.642))
    elif clip=='dizzy':
        hip_shift.z-=.012*(1-co);spine_rot.y=.07*sw;head_rot.y=-.12*sw;head_rot.z=.10*math.sin(tau*2)
        for label,s in [('R',1),('L',-1)]:
            hands[label]=Vector((s*.350,.118,.745+s*.056*sw));hand_dirs[label]=Vector((s*.5,.25,-.6))
    matrices={}
    def scaled(p):p=Vector(p);return Vector((p.x*factor,p.y*factor,(p.z-low)*factor))
    def put(name,matrix):
        pb=arm.pose.bones[name];rest=pb.bone.matrix_local
        prefix=matrices[pb.parent.name]@pb.parent.bone.matrix_local.inverted()@rest if pb.parent else rest
        pb.matrix_basis=prefix.inverted()@matrix;matrices[name]=matrix
    def inherited(name,rot=(0,0,0)):
        pb=arm.pose.bones[name];parent=pb.parent
        base=matrices[parent.name]@parent.bone.matrix_local.inverted()@pb.bone.matrix_local
        worldrot=Euler(rot).to_matrix().to_4x4()
        put(name,Matrix.Translation(base.translation)@worldrot@base.to_3x3().to_4x4())
    def orient(name,head,tail):
        pb=arm.pose.bones[name];direction=(pb.bone.tail_local-pb.bone.head_local).normalized()
        q=direction.rotation_difference((tail-head).normalized())
        put(name,Matrix.Translation(head)@q.to_matrix().to_4x4()@pb.bone.matrix_local.to_3x3().to_4x4())
    put('root',arm.data.bones['root'].matrix_local.copy())
    hips=arm.data.bones['hips'].matrix_local.copy();hips.translation+=hip_shift*factor
    put('hips',hips@Euler(hip_rot).to_matrix().to_4x4())
    inherited('spine',spine_rot);inherited('neck');inherited('head',head_rot)
    for label,s in [('R',1),('L',-1)]:
        inherited('clavicle_'+label)
        cb=arm.data.bones['clavicle_'+label];shoulder=matrices['clavicle_'+label]@Vector((0,cb.length,0))
        a=arm.data.bones['upper_arm_'+label];b=arm.data.bones['forearm_'+label]
        elbow,wrist=solve_two(shoulder,scaled(hands[label]),a.length,b.length,(s*.75,1,-.35))
        orient('upper_arm_'+label,shoulder,elbow);orient('forearm_'+label,elbow,wrist)
        orient('hand_'+label,wrist,wrist+hand_dirs[label].normalized()*arm.data.bones['hand_'+label].length)
        inherited('pelvis_'+label)
        pb=arm.data.bones['pelvis_'+label];hip=matrices['pelvis_'+label]@Vector((0,pb.length,0))
        a=arm.data.bones['thigh_'+label];b=arm.data.bones['shin_'+label]
        knee,ankle=solve_two(hip,scaled(foot_goals[label]),a.length,b.length,(0,1,.45+sit))
        orient('thigh_'+label,hip,knee);orient('shin_'+label,knee,ankle)
        foot=arm.data.bones['foot_'+label].matrix_local.copy();foot.translation=ankle;put('foot_'+label,foot)
    return matrices

def animate(arm,skin,pink,factor,low):
    scene=bpy.context.scene;scene.render.fps=FPS;arm.animation_data_create();records=[]
    for pb in arm.pose.bones:pb.rotation_mode='QUATERNION'
    for name,duration,loop in CLIPS:
        action=bpy.data.actions.new(name);arm.animation_data.action=action;end=round(duration*FPS)
        for frame in range(end+1):
            scene.frame_set(frame);evaluate_pose(arm,pink,name,frame/end,factor,low)
            for pb in arm.pose.bones:
                for field in ('location','rotation_quaternion','scale'):pb.keyframe_insert(data_path=field,frame=frame,group=pb.name)
        for fc in action.fcurves:
            for k in fc.keyframe_points:k.interpolation='LINEAR'
        track=arm.animation_data.nla_tracks.new();track.name=name
        strip=track.strips.new(name,0,action);strip.action_frame_start=0;strip.action_frame_end=end;track.mute=True
        records.append({'name':name,'duration_s':duration,'loop':loop,'clamp_when_finished':not loop,'contact_time_s':1.0 if name=='attack' else None,'contact_fraction':.625 if name=='attack' else None,'paired_hand':('right' if pink else 'left') if name=='high-five' else None})
    arm.animation_data.action=None
    for pb in arm.pose.bones:pb.matrix_basis=Matrix.Identity(4)
    scene.frame_set(0);bpy.context.view_layer.update();return records

def export(arm,skin,inventory,clips,factor,low):
    name=C.SPEC['asset_id'];folder=C.CURRENT
    for text in list(bpy.data.texts):bpy.data.texts.remove(text)
    for filename in ['common.py','model.py','rig.py','build.py','atlas.py']:
        text=bpy.data.texts.new('WO051 '+filename);text.write((C.BASE/filename).read_text())
    bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
    master=folder/(name+'.blend');bpy.ops.wm.save_as_mainfile(filepath=str(master),compress=True)
    glb=folder/(name+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_def_bones=False,export_armature_object_remove=True,export_all_influences=False,export_influence_nb=4,export_apply=False,export_texcoords=True,export_normals=True,export_tangents=False,export_materials='EXPORT',export_vertex_color='NONE',export_image_format='AUTO',export_all_vertex_colors=False,export_cameras=False,export_lights=False,export_extras=True,export_force_sampling=True,export_frame_range=False,export_frame_step=1,export_optimize_animation_size=True,export_current_frame=False,export_rest_position_armature=True,export_anim_slide_to_zero=True,export_draco_mesh_compression_enable=False)
    skin.data.calc_loop_triangles();points=[v.co for v in skin.data.vertices]
    record={'asset_id':name,'version':'v001','work_order':'WO051','authoring_model':'gpt-6-astra','reasoning_effort':'max','blender':bpy.app.version_string,
        'reference':{'path':'docs/assets/media/bickering-besties/v001/concept.png','sha256':'1fb8f525b23c811dd1c3946faca219224bb10800c2517ae87ffdb40beaa0aee1','approval':'Tom approved the look September 11, 2026; final exports await review'},
        'private_inputs':False,'downloaded_meshes_or_textures':False,'triangles':len(skin.data.loop_triangles),'vertices':len(skin.data.vertices),'material_count':len(skin.data.materials),
        'joints':[b.name for b in arm.data.bones],'spec':{'height':1.4,'floor':0,'forward':'glTF -Z','up':'glTF +Y'},'clips':clips,'source_scale_factor':factor,'source_floor':low,
        'bounds_blender':{'min':[min(p[k] for p in points) for k in range(3)],'max':[max(p[k] for p in points) for k in range(3)]},
        'named_source_parts':inventory,'required_contacts':C.CONTACTS,
        'rig_anatomy_rest_blender':{name:{'head':[p[0]*factor,p[1]*factor,(p[2]-low)*factor],'tail':[q[0]*factor,q[1]*factor,(q[2]-low)*factor],'parent':parent} for name,(p,q,parent) in REST.items()},
        'rig':'One connected skeleton. Continuous sleeves and trouser legs use blended shoulder/elbow/hip/knee weights. Explicit two-bone targets are baked; shoes stay level. Caller owns root translation/facing.',
        'files':{p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [master,glb,folder/'pigment.png']}}
    (folder/'construction.json').write_text(json.dumps(record,indent=2)+'\n')
    print(json.dumps({k:record[k] for k in ('asset_id','triangles','vertices','material_count','files')}))
    return record
