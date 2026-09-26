"""WO111 original nursery honk bus, constructed only through Blender MCP.

The chosen concept supplies proportions and material direction. Shapes, painted
atlas, rig and acting are original. Blender +Y forward becomes glTF -Z forward.
"""
import bpy, math, json, hashlib, importlib.util, struct, zlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler
import numpy as np

ROOT=Path('/workspace/haynes-quest/family-eras/honk-bus/v001')
sc=bpy.context.scene
assert sc.get('work_order')=='WO111' and sc.get('scene_lease')=='active' and sc.get('asset_id')=='honk-bus'
spec=importlib.util.spec_from_file_location('wo111_bus_common',ROOT/'source/common.py')
C=importlib.util.module_from_spec(spec);spec.loader.exec_module(C);C.BASE=ROOT.parent

def atlas():
 colors=['eeb446','d0922f','f4c963','3d7378','27545f','4d8386','8f5c24','b67b28','553344','735064','f4e0b6','c9b489','302329','e0b65c','ce7433','86504d']
 rng=np.random.default_rng(11102);yy,xx=np.mgrid[0:256,0:256]
 indices=np.zeros((1024,1024),dtype=np.uint8);palette=[]
 for i,h in enumerate(colors):
  rgb=np.array([int(h[j:j+2],16)/255 for j in (0,2,4)])
  field=.012*np.sin(xx*.034+yy*.014)+.007*np.cos(xx*.068-yy*.037)
  field+=rng.integers(-1,2,(256,256))*.002
  levels=np.clip(np.round((field+.04)/.0055),0,15).astype(np.uint8)
  for level in range(16):palette.extend(np.round(np.clip(rgb+(-.04+level*.0055),.01,.98)*255).astype(np.uint8).tolist())
  row=3-i//4;col=i%4;indices[row*256:(row+1)*256,col*256:(col+1)*256]=i*16+levels
 def chunk(name,data):return struct.pack('>I',len(data))+name+data+struct.pack('>I',zlib.crc32(name+data)&0xffffffff)
 raw=b''.join(b'\x00'+row.tobytes() for row in indices[::-1])
 png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1024,1024,8,3,0,0,0))+chunk(b'PLTE',bytes(palette))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
 (ROOT/'pigment.png').write_bytes(png)

atlas();C.setup('v001',2.3,1.25,2.0,[('Matte painted toy and plum rubber',.86,0),('Soft satin eyes amber lamps and hubs',.54,0)])
sc['work_order']='WO111';sc['scene_owner']='/root/honk_bus_blender';sc['scene_lease']='active'
sc['asset_id']='honk-bus';sc['asset_version']='v001'
sc['candidate_status']="WO111 honk-bus v001 · Awaiting Tom's review · used in the family release"
sc['authoring_model']='gpt-6-astra max';sc['source_concept_sha256']=hashlib.sha256((ROOT/'concept.png').read_bytes()).hexdigest()
sc['orientation']='Blender +Z up/+Y forward; glTF +Y up/-Z forward; stationary identity floor root'
REST={'root':((0,0,0),(0,0,.10),None),'body':((0,0,.74),(0,0,1.12),'root'),
      'visor':((0,1.00,1.624),(0,1.12,1.624),'body'),
      'horn_lift':((0,-.035,1.950),(0,.20,1.950),'body'),
      'horn':((0,-.035,1.950),(0,.20,1.950),'horn_lift')}
ell=C.ellipsoid;box=C.box;line=C.curve

# One rounded cabin, with a broad roof and generous body volume.
box('Continuous honey yellow rounded bus body',(0,-.04,1.064),(1.52,2.14,1.424),0,bevel=.235,segments=6)
box('Teal lower wrap stripe',(0,-.047,.616),(1.548,2.15,.235),3,bevel=.078,segments=5)
box('Warm ochre underbody sill',(0,-.09,.413),(1.335,1.97,.142),1,bevel=.055,segments=3)
box('Plum chassis below the body',(0,-.03,.385),(1.38,1.94,.12),8,bevel=.04,segments=2)

# Window panels are solid opaque toy paint, no transparency or fake passengers.
for side in [-1,1]:
 for j,y in enumerate([-.785,-.35,.085,.520]):
  # Rounded panels stand a few millimetres proud of the body flat side.
  box('Opaque teal side window '+str(side)+' '+str(j),(side*.758,y,1.350),(.048,.335,.458),5,bevel=.078,segments=5)
 # A narrow rear molding and long upper roof seam describe an actual vehicle.
 box('Teal toy step '+str(side),(side*.805,.345,.47),(.17,.39,.070),4,bevel=.02,segments=2)
 box('Lower access panel '+str(side),(side*.781,-.075,.89),(.024,.30,.27),0,bevel=.035,segments=3)
 line('Molded side door seam '+str(side),[(side*.790,.688,.85),(side*.790,.688,1.56)],.006,1,n=5,steps=1)

# Front eye panels, forward projecting rounded hood and amber cheek lamps.
for side in [-1,1]:
 box('Teal windshield surround '+str(side),(side*.345,1.006,1.367),(.655,.095,.572),4,bevel=.094,segments=5)
 ell('Huge cream windshield eye '+str(side),(side*.333,1.074,1.364),(.269,.088,.237),10,'body',1,n=42,r=24)
 ell('Dark friendly pupil '+str(side),(side*.292,1.153,1.342),(.093,.032,.127),12,'body',1,n=28,r=18)
 ell('Warm eye catchlight '+str(side),(side*.292-.025,1.181,1.393),(.030,.009,.037),10,'body',1,n=18,r=12)
 REST['lid_'+str(side)]=((side*.335,1.082,1.531),(side*.335,1.182,1.531),'body')
 # Low angled lids give comic bluster. The original rounded visor is continuous.
 outline=[(side*.051,1.458),(side*.625,1.575),(side*.617,1.646),(side*.067,1.612)]
 C.prism('Broad painted grumpy upper eyelid '+str(side),outline,1.171,.060,3,'lid_'+str(side),bevel=.026)
 line('Short rounded mirror arm '+str(side),[(side*.733,.870,1.215),(side*.831,.962,1.221),(side*.88,.969,1.249)],.035,7,'body',n=10,steps=3)
 ell('Chunky yellow side mirror '+str(side),(side*.877,.996,1.269),(.108,.090,.152),0,'body',n=26,r=18)
ell('Rounded honey hood',(0,1.105,.974),(.699,.330,.272),0,'body',n=50,r=26)
for side in [-1,1]:
 ell('Ochre headlamp rim '+str(side),(side*.664,1.237,.973),(.162,.093,.173),1,'body',n=30,r=20)
 ell('Amber cheek headlight '+str(side),(side*.664,1.304,.973),(.123,.048,.132),14,'body',1,n=30,r=20)
 ell('Headlight warm glint '+str(side),(side*.685-.025,1.346,1.021),(.025,.009,.033),13,'body',1,n=14,r=8)

# Smile is a custom crescent surface following the rounded front, with broad
# ivory teeth and shallow painted grooves instead of sharp individual fangs.
def smile(name,width,top,bottom,y,depth,tile,bn='body'):
 n=32;rr=[]
 for frac in [0,1]:
  row=[]
  for i in range(n+1):
   x=-width+2*width*i/n;q=1-(x/width)**2;z=(top[0]-top[1]*q)*(1-frac)+(bottom[0]-bottom[1]*q)*frac
   row.append((x,y-.09*(x/width)**2,z))
  rr.append(row)
 verts=rr[0]+rr[1]+[(x,yy-depth,z) for row in rr for x,yy,z in row]
 faces=[];N=n+1
 for i in range(n):faces.extend([(i,i+1,N+i+1,N+i),(2*N+i,3*N+i,3*N+i+1,2*N+i+1),(i,2*N+i,2*N+i+1,i+1),(N+i,N+i+1,3*N+i+1,3*N+i)])
 faces.extend([(0,N,3*N,2*N),(n,2*N+n,3*N+n,N+n)])
 return C.mesh(name,verts,faces,tile,bn)
smile('Inset warm smile shadow',.655,(.855,.088),(.842,.395),1.381,.065,6)
smile('One huge creamy toothy grin',.614,(.839,.092),(.825,.325),1.403,.044,10)
for x in [-.42,-.22,0,.22,.42]:
 q=1-(x/.614)**2;top=.839-.092*q-.013;bottom=.825-.325*q+.015
 line('Soft ochre tooth division '+str(x),[(x,1.411-.09*(x/.614)**2,top),(x*.985,1.413-.09*(x/.614)**2,(top+bottom)/2),(x*.97,1.411-.09*(x/.614)**2,bottom)],[.004,.005,.003],11,'body',n=5,steps=2)
bumper=[]
for i in range(29):
 x=-.662+1.324*i/28;q=1-(x/.662)**2;bumper.append((x,1.383-.090*(x/.662)**2,.821-.410*q))
C.tube('Oversized cream smile bumper',bumper,.083,10,'body',n=14)
box('Lower teal chin behind bumper',(0,1.193,.469),(1.30,.185,.242),3,bevel=.085,segments=5)
box('Broad teal sun visor',(0,1.098,1.657),(1.43,.294,.153),3,'visor',bevel=.081,segments=5,rot=(-.10,0,0))
for side in [-1,1]:ell('Visor plum fastener '+str(side),(side*.603,1.247,1.685),(.036,.016,.027),8,'visor',1,n=16,r=10)

# Clear rear distinction: one rear window, door seam, red toy lamps and bumper.
box('Opaque rear teal window',(0,-1.104,1.363),(1.17,.066,.405),5,bevel=.096,segments=5)
box('Rear honey door',(0,-1.123,.922),(.65,.024,.40),0,bevel=.05,segments=3)
line('Rear center molded door seam',[(0,-1.147,.736),(0,-1.147,1.080)],.006,1,'body',n=5,steps=2)
box('Soft teal rear bumper',(0,-1.184,.504),(1.48,.13,.192),3,bevel=.057,segments=5)
for side in [-1,1]:
 ell('Rear lamp ochre surround '+str(side),(side*.570,-1.126,.928),(.118,.053,.132),1,'body',n=22,r=14)
 ell('Muted red rear lamp '+str(side),(side*.570,-1.172,.928),(.088,.029,.096),15,'body',1,n=22,r=14)

# Four grounded wheels share fixed axle centers. The moving body overlaps broad
# axles through visible suspension clearance, without unattached floating tires.
for side in [-1,1]:
 for label,y in [('front',.753),('rear',-.754)]:
  x=side*.929;z=.370;bn='wheel_'+label+('_L' if side<0 else '_R')
  REST[bn]=((x,y,z),(x+side*.20,y,z),'root')
  profile=[(-.156,.248),(-.171,.306),(-.14,.360),(-.085,.370),(.085,.370),(.14,.360),(.171,.306),(.156,.248)]
  rings=[[(x+ax,y+radius*math.sin(math.tau*i/28),z+radius*math.cos(math.tau*i/28)) for i in range(28)] for ax,radius in profile]
  C.rings('Plum rubber tire '+bn,rings,8,bn,caps=True)
  for j in range(12):
   a=math.tau*j/12;yc=y+.368*math.sin(a);zc=z+.368*math.cos(a)
   verts=[(x+xx,y+r*math.sin(a+da),z+r*math.cos(a+da)) for xx in [-.128,.128] for r in [.363,.382] for da in [-.095,0,.095]]
   faces=[]
   for k in range(2):faces.extend([(k,k+1,k+4,k+3),(6+k,9+k,10+k,7+k),(k,6+k,7+k,k+1),(3+k,4+k,10+k,9+k)])
   faces.extend([(0,3,9,6),(2,8,11,5)])
   C.mesh('Rounded tire tread '+bn+' '+str(j),verts,faces,9,bn)
  # Two concentric chamfered ochre disks, axis along X.
  for name,prof,tile in [('hub surround',[(.137,.206),(.169,.216),(.187,.190)],7),('ochre hub',[(.177,.164),(.204,.169),(.221,.125)],0)]:
   rr=[[(x+side*d,y+r*math.sin(math.tau*i/28),z+r*math.cos(math.tau*i/28)) for i in range(28)] for d,r in prof]
   C.rings(name+' '+bn,rr,tile,bn,1,caps=True)
  # Strong inset radial dimple makes actual wheel rotation readable at phone size.
  for j in range(4):
   a=math.tau*j/4;box('Soft hub dimple '+bn+' '+str(j),(x+side*.222,y+.114*math.sin(a),z+.114*math.cos(a)),(.008,.024,.024),1,bn,bevel=0,mat=1)
  C.tube('Stout axle attachment '+bn,[(side*.55,y,z),(x,y,z)],.072,8,'root',n=14)
  def suspension_weights(p):
   t=max(0,min(1,(p.z-.370)/.210));return {'root':1-t,'body':t}
  C.tube('Continuous suspension strut '+bn,[(side*.59,y,.370),(side*.59,y,.580)],.044,8,'root',n=8,weights=suspension_weights)
  # Arched fender band with deliberate suspension clearance around radius .37.
  rr=[]
  start,end=(.90,math.pi-.27) if label=='front' else (.27,math.pi-.90)
  for xx in [side*.695,side*.831]:
   for radius in [.468,.547]:rr.append([(xx,y+radius*math.cos(start+(end-start)*i/24),z+radius*math.sin(start+(end-start)*i/24)) for i in range(25)])
  verts=[p for row in rr for p in row];faces=[]
  for a,b in [(0,1),(1,3),(3,2),(2,0)]:
   for i in range(24):faces.append((a*25+i,a*25+i+1,b*25+i+1,b*25+i))
  faces.extend([(0,25,75,50),(24,74,99,49)])
  C.mesh('Teal rounded wheel arch '+bn,verts,faces,3,'body')

# One enormous, credible roof trumpet. Hollow bell and inner shadow are actual
# geometry; the neck joins a plum squeeze bulb and a rounded roof pedestal.
box('Horn pedestal fixed roof shoe',(0,-.035,1.775),(.255,.235,.070),7,'body',bevel=.037,segments=5)
ell('Horn spherical hinge',(0,-.035,1.950),(.088,.088,.077),7,'horn',n=24,r=16)
def mounting_weights(p):
 t=max(0,min(1,(p.z-1.802)/.153));return {'body':1-t,'horn_lift':t}
C.tube('Continuous extending trumpet support',[(0,-.035,1.802),(0,-.035,1.8785),(0,-.035,1.955)],.053,1,'body',n=16,weights=mounting_weights)
C.tube('Pivoted trumpet upper neck',[(0,-.035,1.950),(0,-.035,2.095)],.053,1,'horn',n=16)
ell('Single plum squeeze bulb',(0,-.326,2.115),(.216,.259,.215),8,'horn',n=40,r=24)
profile=[(-.106,.071),(-.030,.071),(.075,.078),(.218,.106),(.372,.158),(.523,.247),(.575,.298)]
def hornrings(profile):return [[(r*math.cos(math.tau*i/28),y,2.123+.145*y+r*math.sin(math.tau*i/28)) for i in range(28)] for y,r in profile]
C.rings('Continuous flared honey trumpet',hornrings(profile),0,'horn',caps=False)
inner=[(y,r-.025) for y,r in profile]
C.rings('Warm hollow trumpet interior',hornrings(inner),6,'horn',caps=False)
C.rings('Trumpet bell rolled broad rim',hornrings([(.568,.285),(.583,.311),(.602,.311),(.612,.289),(.598,.273)]),2,'horn',caps=False)
C.rings('Shadow at deep horn throat',hornrings([(-.105,.046),(-.109,.0001)]),12,'horn',caps=True)
C.rings('Ochre bulb attachment collar',hornrings([(-.168,.080),(-.159,.095),(-.121,.095),(-.103,.077)]),7,'horn',caps=True)

# Normalize actual authored extrema to 2.30m and recenter its footprint.
pts=[v.co for ob in C.PARTS for v in ob.data.vertices];lo=min(p.z for p in pts);hi=max(p.z for p in pts);factor=2.3/(hi-lo)
cy=(min(p.y for p in pts)+max(p.y for p in pts))/2
sources=bpy.data.collections.new('EDITABLE original honk bus parts - excluded from export');sc.collection.children.link(sources)
inventory=[];copies=[]
for ob in C.PARTS:
 for v in ob.data.vertices:v.co=Vector((v.co.x*factor,(v.co.y-cy)*factor,(v.co.z-lo)*factor))
 ob.data.calc_loop_triangles();inventory.append({'name':ob.name,'triangles':len(ob.data.loop_triangles),'bone_groups':[g.name for g in ob.vertex_groups],'atlas_tile':ob.get('atlas_tile')})
 cp=ob.copy();cp.data=ob.data.copy();sc.collection.objects.link(cp);copies.append(cp)
 for col in list(ob.users_collection):col.objects.unlink(ob)
 sources.objects.link(ob)
sources.hide_render=True;sources.hide_viewport=True
bpy.ops.object.select_all(action='DESELECT')
for ob in copies:ob.select_set(True)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();skin=bpy.context.object;skin.name='Honk_Bus_Skin'
for tag in ['source_part','rigid_weight','atlas_tile']:
 if tag in skin:del skin[tag]
skin.data.calc_loop_triangles();assert len(skin.data.loop_triangles)<=15000,len(skin.data.loop_triangles)
data=bpy.data.armatures.new('Original honk bus suspension and horn skeleton');arm=bpy.data.objects.new('Honk_Bus_Rig',data);sc.collection.objects.link(arm)
skin.select_set(False);arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
def scaled(p):p=Vector(p);return Vector((p.x*factor,(p.y-cy)*factor,(p.z-lo)*factor))
for name,(head,tail,parent) in REST.items():
 b=data.edit_bones.new(name);b.head=scaled(head);b.tail=scaled(tail)
 if name=='root':b.head=(0,0,0);b.tail=(0,0,.10*factor)
 if parent:b.parent=data.edit_bones[parent]
 b.use_deform=True
bpy.ops.object.mode_set(mode='OBJECT');mod=skin.modifiers.new('Attached rigid toy skin','ARMATURE');mod.object=arm;skin.parent=arm
arm['asset_id']='honk-bus';arm['version']='v001';arm['forward']='Blender +Y / glTF -Z';arm['neutral_total_height_m']=2.3;arm['attack_contact_fraction']=.625
record={'asset_id':'honk-bus','version':'v001','work_order':'WO111','authoring_model':'gpt-6-astra max','blender_version':bpy.app.version_string,'source_concept_sha256':sc['source_concept_sha256'],'height_m':2.3,'construction_scale_factor':factor,'construction_ground_shift':lo,'construction_forward_center':cy,'triangles':len(skin.data.loop_triangles),'vertices':len(skin.data.vertices),'material_count':len(skin.data.materials),'bone_count':len(data.bones),'texture':{'file':'pigment.png','width':1024,'height':1024,'origin':'Original deterministic soft painted pigment; no external textures.'},'parts':inventory,'notes':['Original chunky nursery bus; no franchise face, logo, lettering, passengers or borrowed media.','Opaque painted windows and eyes. One hollow roof trumpet with plum bulb and credible hinge mount.','Four wheels fixed at the floor; body suspension and horn carry the in-place acting.','Actual extrema normalized to 2.3m; X and forward bounds centered at identity floor root.']}
(ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n');(ROOT/'source/rig-rest.json').write_text(json.dumps({'rest':REST,'factor':factor,'ground':lo,'forward_center':cy},indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'honk-bus-construction.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(ROOT/'honk-bus-checkpoint.glb'),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_yup=True,export_apply=False,export_armature_object_remove=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=True)
print(json.dumps({k:record[k] for k in ['triangles','vertices','height_m','material_count','bone_count']}))
