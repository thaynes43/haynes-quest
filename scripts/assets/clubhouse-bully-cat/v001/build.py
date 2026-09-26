"""WO111 original blustery clubhouse cat; soft 3D translation of selected sheet.

Only utility topology/UV helpers are inherited from WO099. All proportions,
surfaces, costume and anatomy below are newly authored. Blender +Y front/+Z up.
"""
import bpy, math, json, hashlib, importlib.util, struct, zlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler
import numpy as np

ROOT=Path('/workspace/haynes-quest/family-eras/clubhouse-bully-cat/v001')
sc=bpy.context.scene
assert sc.get('work_order')=='WO111' and sc.get('scene_lease')=='active'
spec=importlib.util.spec_from_file_location('wo111_cat_common',ROOT/'source/common.py')
C=importlib.util.module_from_spec(spec);spec.loader.exec_module(C);C.BASE=ROOT.parent

def atlas():
 colors=['343647','535669','f2dbad','315f69','427580','c99137','e2b454','6d3b55','432a3c','231e28','fae6b9','eee8d3','211d25','b57e48','805437','846078']
 rng=np.random.default_rng(11101);yy,xx=np.mgrid[0:256,0:256]
 indices=np.zeros((1024,1024),dtype=np.uint8);palette=[]
 for i,h in enumerate(colors):
  rgb=np.array([int(h[j:j+2],16)/255 for j in (0,2,4)])
  field=.013*np.sin(xx*.025+yy*.018)+.009*np.cos(xx*.059-yy*.039)
  field+=rng.integers(-1,2,(256,256))*.002
  if i in (13,14):field+=.019*np.sin(xx*.21+3*np.sin(yy*.015))
  levels=np.clip(np.round((field+.042)/.006),0,15).astype(np.uint8)
  for level in range(16):palette.extend(np.round(np.clip(rgb+(-.042+level*.006),.01,.98)*255).astype(np.uint8).tolist())
  row=3-i//4;col=i%4;indices[row*256:(row+1)*256,col*256:(col+1)*256]=i*16+levels
 def chunk(name,data):return struct.pack('>I',len(data))+name+data+struct.pack('>I',zlib.crc32(name+data)&0xffffffff)
 raw=b''.join(b'\x00'+row.tobytes() for row in indices[::-1])
 png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1024,1024,8,3,0,0,0))+chunk(b'PLTE',bytes(palette))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
 (ROOT/'pigment.png').write_bytes(png)

atlas();C.setup('v001',2.5,1.25,2.0,[('Soft painted fur cloth and wood',.86,0),('Satin eyes nose and buttons',.48,0)])
sc['work_order']='WO111';sc['scene_owner']='/root/clubhouse_cat_blender';sc['scene_lease']='active'
sc['asset_id']='clubhouse-bully-cat';sc['asset_version']='v001'
sc['candidate_status']="WO111 clubhouse-bully-cat v001 · Awaiting Tom's review · used in the family release"
sc['authoring_model']='gpt-6-astra max'
sc['source_concept_sha256']=hashlib.sha256((ROOT/'concept.png').read_bytes()).hexdigest()
sc['orientation']='Blender +Z up/+Y forward; glTF +Y up/-Z forward; stationary identity floor root'
REST={'root':((0,0,0),(0,0,.08),None),'hips':((0,0,.88),(0,0,1.10),'root'),'chest':((0,0,1.10),(0,0,1.57),'hips'),'neck':((0,0,1.57),(0,0,1.72),'chest'),'head':((0,0,1.72),(0,0,2.14),'neck'),'jaw':((0,.23,1.83),(0,.55,1.79),'head')}
ell=C.ellipsoid;line=C.curve;tube=C.tube

def bodyweight(p):
 t=C.smooth((p.z-.99)/.42)
 return {'hips':1-t,'chest':t}

def bodyfront(x,z,offset=0):
 # Main padded body has a pear profile with a broad cream front.
 q=(z-1.095)/.625;rx=.65*math.sqrt(max(.01,1-q*q))
 return -.015+.405*math.sqrt(max(.008,1-q*q-(x/.65)**2))+offset

ell('One softly rounded cat body',(0,-.015,1.095),(.65,.405,.625),0,'hips',n=44,r=28,weights=bodyweight)
# Continuous curved belly patch. Boundary is deliberately tucked beneath jacket.
rr=[]
for j in range(15):
 lat=-1.48+j*2.68/14;cs=math.cos(lat)
 rr.append([(.65*cs*math.sin(-1.03+i*2.06/24),-.015+.414*cs*math.cos(-1.03+i*2.06/24),1.095+.63*math.sin(lat)) for i in range(25)])
verts=[p for row in rr for p in row];faces=[]
for j in range(14):
 for i in range(24):faces.append((j*25+i,j*25+i+1,(j+1)*25+i+1,(j+1)*25+i))
C.mesh('Broad fitted cream belly',verts,faces,2,'hips',weights=bodyweight)
# Teal short jacket wraps continuously around sides/back, with open curved fronts.
# The opening widens at bottom to expose the broad belly and closes at two buttons.
zs=[1.11,1.22,1.34,1.48,1.60,1.68]
rxs=[.663,.666,.637,.586,.496,.383];rys=[.420,.421,.397,.355,.298,.222]
opens=[.42,.23,.10,.13,.33,.58]
rr=[]
for z,rx,ry,op in zip(zs,rxs,rys,opens):
 rr.append([(rx*math.sin(op+(math.tau-2*op)*i/40),-.02+ry*math.cos(op+(math.tau-2*op)*i/40),z) for i in range(41)])
verts=[p for row in rr for p in row];faces=[]
for j in range(5):
 for i in range(40):faces.append((j*41+i,j*41+i+1,(j+1)*41+i+1,(j+1)*41+i))
coat=C.mesh('Continuous curved open short teal jacket',verts,faces,3,'chest',weights=bodyweight)
# Hem and lapel edges are sewn curves, with no thin floating slabs.
for side in [-1,1]:
 edge=[(side*rx*math.sin(op),-.02+ry*math.cos(op)+.004,z) for z,rx,ry,op in zip(zs,rxs,rys,opens)]
 line('Soft teal front facing '+str(side),edge,.013,4,'chest',n=8,steps=3,weights=bodyweight)
 # Small cream shirt triangle in the collar; original uncluttered costume.
 C.prism('Ochre folded collar '+str(side),[(side*.15,1.69),(side*.34,1.71),(side*.46,1.60),(side*.34,1.62),(side*.31,1.53)],.232,.055,5,'chest',bevel=.016)
hem=[]
for i in range(45):
 a=opens[0]+(math.tau-2*opens[0])*i/44;hem.append((rxs[0]*math.sin(a),-.02+rys[0]*math.cos(a),zs[0]))
tube('Rounded short jacket hem',hem,.013,4,'chest',n=8,weights=bodyweight)
def coatfront(x,z):
 for j in range(len(zs)-1):
  if z<=zs[j+1]:
   t=(z-zs[j])/(zs[j+1]-zs[j]);rx=rxs[j]*(1-t)+rxs[j+1]*t;ry=rys[j]*(1-t)+rys[j+1]*t
   return -.02+ry*math.sqrt(max(.05,1-(x/rx)**2))
 return .20
panelrows=[(1.21,-.004,.136),(1.30,-.135,.183),(1.40,-.147,.185),(1.51,-.13,.168),(1.60,-.058,.127)]
rr=[]
for z,a,b in panelrows:
 rr.append([(a+(b-a)*i/6,coatfront(a+(b-a)*i/6,z)+.018,z) for i in range(7)])
verts=[p for row in rr for p in row];faces=[]
for j in range(4):
 for i in range(6):faces.append((j*7+i,j*7+i+1,(j+1)*7+i+1,(j+1)*7+i))
C.mesh('Curved overlapping teal button panel',verts,faces,3,'chest',weights=bodyweight)
line('Soft overlap edge',[(b,coatfront(b,z)+.022,z) for z,a,b in panelrows],.007,4,'chest',n=5,steps=2,weights=bodyweight)
for i,(x,z) in enumerate([(.029,1.365),(.037,1.514)]):
 y=coatfront(x,z)+.043
 ell('Ochre jacket button '+str(i),(x,y,z),(.058,.020,.054),6,'chest',1,n=22,r=10)
 line('Button sewn inset '+str(i),[(x-.018,y+.019,z),(x+.018,y+.019,z)],.0045,13,'chest',n=5,steps=1)

# Huge soft round head; cream cheeks and lower face dominate at phone scale.
ell('Indigo cat head',(0,.003,1.993),(.525,.366,.445),0,'head',n=46,r=28)
ell('Cream lower face and cheeks',(0,.234,1.914),(.46,.242,.335),2,'head',n=42,r=26)
ell('Dark open smiling mouth',(0,.456,1.818),(.253,.072,.118),9,'head',n=28,r=14)
ell('Soft cream chin',(0,.414,1.733),(.295,.093,.119),2,'jaw',n=30,r=14)
ell('Rounded pink tongue',(0,.515,1.773),(.102,.025,.042),15,'jaw',n=20,r=8)
for s in [-1,1]:
 ell('Huge cream muzzle lobe '+str(s),(s*.146,.485,1.991),(.232,.165,.148),10,'head',n=32,r=18)
 ell('Small comic canine '+str(s),(s*.17,.522,1.846),(.026,.021,.042),11,'head',n=14,r=8)
 # Smile corners taper into cheeks; no fur strands.
 line('Cheek smile dimple '+str(s),[(s*.255,.462,1.956),(s*.300,.430,1.937),(s*.322,.408,1.963)],[.006,.008,.002],13,'head',n=7,steps=3)
 # Whiskers are broad, sparse stylized ribbons, not realistic hair.
 for j in range(2):
  line('Graphic whisker '+str(s)+' '+str(j),[(s*.385,.309,2.003-j*.067),(s*.522,.276,2.034-j*.074),(s*.613,.22,2.037-j*.094)],[.006,.005,.0015],1,'head',n=5,steps=3)
 # Soft pointed ears integrated into skull, with inset muted plum surfaces.
 outline=[(s*.322,2.185),(s*.522,2.210),(s*.489,2.457),(s*.449,2.485),(s*.347,2.367)]
 C.prism('Small pointed cat ear '+str(s),outline,-.003,.113,0,'head',bevel=.033)
 inner=[(s*.369,2.241),(s*.474,2.245),(s*.465,2.423),(s*.439,2.402)]
 C.prism('Soft plum inner ear '+str(s),inner,.064,.013,15,'head',bevel=.017)
 # Clear white eye and inset pupil. Heavy brows give bluster, not horror.
 ell('Warm white eye '+str(s),(s*.176,.337,2.180),(.133,.086,.132),11,'head',1,n=30,r=16,rot=(0,s*.16,0))
 ell('Dark eye pupil '+str(s),(s*.145,.416,2.157),(.048,.028,.065),12,'head',1,n=22,r=12)
 ell('Tiny eye glint '+str(s),(s*.132-.010,.442,2.181),(.014,.008,.018),11,'head',1,n=10,r=6)
 line('Thick blustery eyebrow '+str(s),[(s*.068,.393,2.229),(s*.142,.370,2.301),(s*.234,.301,2.322),(s*.295,.249,2.278)],[.032,.053,.052,.011],12,'head',n=12,steps=4)
# Rounded triangular plum nose, softer than a cut gemstone.
nose=C.prism('Big plum triangular nose',[(-.111,2.077),(-.092,2.119),(.077,2.115),(.119,2.076),(.024,1.995),(-.020,1.997)],.631,.099,7,'head',1,bevel=.035)
ell('Soft nose highlight',(-.035,.690,2.081),(.033,.007,.012),15,'head',1,n=12,r=6)
line('Short muzzle center crease',[(0,.625,2.014),(0,.636,1.965)],.006,13,'head',n=6,steps=2)

# Slouched captain's cap: ochre soft dome, teal band and broad curved peak.
C.lathe('Teal cap band',(0,-.016,2.357),[(0,.288),(.049,.307),(.097,.282)],3,'head',n=36,ellipse=(1,.80))
cap=ell('Lopsided soft ochre captain cap',(.022,-.036,2.511),(.352,.267,.170),5,'head',n=36,r=20,rot=(0,-.19,-.08))
# The peak is a flattened soft ellipsoid that projects in front of the band.
ell('Ochre cap peak',(0,.236,2.368),(.285,.169,.032),5,'head',n=30,r=10,rot=(.06,0,0))
# Crown stays uninterrupted; a seam would cost geometry without silhouette value.

# Rubber-hose arms use smoothly blended weights over continuous sleeves.
for label,s in [('R',1),('L',-1)]:
 shoulder=Vector((s*.489,-.010,1.592));elbow=Vector((s*.701,.016,1.331));wrist=Vector((s*.823,.080,1.072))
 REST['clavicle_'+label]=((0,0,1.596),tuple(shoulder),'chest')
 REST['upper_arm_'+label]=(tuple(shoulder),tuple(elbow),'clavicle_'+label)
 REST['forearm_'+label]=(tuple(elbow),tuple(wrist),'upper_arm_'+label)
 REST['hand_'+label]=(tuple(wrist),tuple(wrist+Vector((s*.016,.02,-.13))),'forearm_'+label)
 def sleeveweight(p,s=s,label=label):
  d=(1.592-p.z)/(.520);t=C.smooth((d-.36)/.29)
  return {'upper_arm_'+label:1-t,'forearm_'+label:t}
 line(label+' continuous rounded teal sleeve',[Vector((s*.290,-.010,1.588)),shoulder,shoulder.lerp(elbow,.48),elbow,elbow.lerp(wrist,.55),wrist],[.156,.211,.198,.185,.169,.148],3,'upper_arm_'+label,n=24,steps=3,weights=sleeveweight)
 a=elbow.lerp(wrist,.64);b=wrist+Vector((0,0,-.018))
 line(label+' deep ochre turned cuff',[a,a.lerp(b,.16),a.lerp(b,.84),b],[.189,.205,.197,.176],5,'forearm_'+label,n=24,steps=2)
 ell(label+' cuff button',(s*.902,.181,1.153),(.045,.024,.045),6,'forearm_'+label,1,n=16,r=8)
 palm=wrist+Vector((s*.012,.025,-.102))
 ell(label+' soft paw palm',palm,(.146,.111,.153),0,'hand_'+label,n=28,r=16)
 for j in range(3):
  x=palm.x-.081+j*.074
  ell(label+' mitten finger '+str(j),(x,.128,.879+(.014 if j!=1 else 0)),(.059,.079,.061),0,'hand_'+label,n=22,r=12)
 ell(label+' curled thumb',(palm.x-s*.124,.156,.974),(.065,.075,.092),0,'hand_'+label,n=18,r=10,rot=(.12,s*.35,0))


# Anatomical LEFT theatrical peg; RIGHT broad plum boot, per the actual sheet.
for label,s in [('R',1),('L',-1)]:
 hip=Vector((s*.300,-.018,.824));knee=Vector((s*.363,.017,.453));ankle=Vector((s*.381,.020,.082))
 REST['thigh_'+label]=(tuple(hip),tuple(knee),'hips');REST['shin_'+label]=(tuple(knee),tuple(ankle),'thigh_'+label);REST['foot_'+label]=(tuple(ankle),tuple(ankle+Vector((0,.16,0))),'shin_'+label)
 line(label+' short furry thigh',[hip,hip.lerp(knee,.40),knee],[.262,.260,.185],0,'thigh_'+label,n=28,steps=4)
 if label=='R':
  line('R soft ankle',[knee,knee.lerp(ankle,.40),knee.lerp(ankle,.70)],[.125,.10,.075],0,'shin_R',n=20,steps=3)
  C.lathe('Right plum boot shaft',(ankle.x,.004,.152),[(0,.159),(.05,.171),(.16,.174),(.20,.193),(.235,.182)],7,'foot_R',n=28,ellipse=(1,.91))
  C.lathe('Right turned boot top',(ankle.x,.004,.33),[(0,.194),(.027,.197),(.057,.182)],8,'foot_R',n=28,ellipse=(1,.91))
  C.box('Right flat boot sole',(ankle.x,.140,.026),(.365,.520,.052),8,'foot_R',bevel=.029,segments=3)
  ell('Right oversized plum boot toe',(ankle.x,.207,.120),(.187,.266,.121),7,'foot_R',n=32,r=14)
  line('Right boot curved toe seam',[(ankle.x-.154,.243,.171),(ankle.x,.323,.226),(ankle.x+.152,.243,.171)],.004,8,'foot_R',n=6,steps=4)
 else:
  C.lathe('Left ochre theatrical peg cuff',(knee.x,knee.y,.415),[(0,.151),(.015,.160),(.072,.16),(.089,.151)],13,'shin_L',n=26)
  C.lathe('Left wooden peg stem',(ankle.x,ankle.y,.071),[(0,.065),(.10,.067),(.27,.090),(.365,.108)],13,'shin_L',n=22)
  C.lathe('Left wooden peg round foot',(ankle.x,ankle.y,0),[(0,.102),(.015,.110),(.053,.106),(.085,.078)],13,'foot_L',n=24)
  # Wood grain is painted in the atlas; no thin decorative geometry.


# One thick, smoothly curled tail with three maintainable deformation spans.
tailpts=[(0,-.336,.946),(.204,-.514,.987),(.507,-.588,1.214),(.661,-.595,1.504),(.650,-.599,1.763),(.492,-.598,1.886),(.353,-.588,1.804)]
REST['tail_1']=(tailpts[0],tailpts[2],'hips');REST['tail_2']=(tailpts[2],tailpts[4],'tail_1');REST['tail_3']=(tailpts[4],tailpts[6],'tail_2')
def tailweight(p):
 if p.z<1.25:
  t=C.smooth((p.z-1.10)/.29);return {'tail_1':1-t,'tail_2':t}
 t=C.smooth((p.z-1.58)/.23);return {'tail_2':1-t,'tail_3':t}
line('Continuous stout curled cat tail',tailpts,[.125,.143,.153,.147,.140,.131,.072],0,'tail_1',n=20,steps=5,weights=tailweight)
ell('Soft rounded tail tip',tailpts[-1],(.079,.079,.079),0,'tail_3',n=20,r=12)

# Exact size and a floor-centered identity rig; no triangle padding or decimation.
pts=[v.co for ob in C.PARTS for v in ob.data.vertices];low=min(p.z for p in pts);factor=2.5/(max(p.z for p in pts)-low)
sources=bpy.data.collections.new('EDITABLE original clubhouse cat parts - excluded from export');sc.collection.children.link(sources)
inventory=[];copies=[]
for ob in C.PARTS:
 for v in ob.data.vertices:v.co=Vector((v.co.x*factor,v.co.y*factor,(v.co.z-low)*factor))
 ob.data.calc_loop_triangles();inventory.append({'name':ob.name,'triangles':len(ob.data.loop_triangles),'bone_groups':[g.name for g in ob.vertex_groups],'atlas_tile':ob.get('atlas_tile')})
 cp=ob.copy();cp.data=ob.data.copy();sc.collection.objects.link(cp);copies.append(cp)
 for col in list(ob.users_collection):col.objects.unlink(ob)
 sources.objects.link(ob)
sources.hide_render=True;sources.hide_viewport=True
bpy.ops.object.select_all(action='DESELECT')
for ob in copies:ob.select_set(True)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();skin=bpy.context.object;skin.name='Clubhouse_Bully_Cat_Skin'
for tag in ['source_part','rigid_weight','atlas_tile']:
 if tag in skin:del skin[tag]
skin.data.calc_loop_triangles();assert len(skin.data.loop_triangles)<=15000,len(skin.data.loop_triangles)
data=bpy.data.armatures.new('Original soft clubhouse cat skeleton');arm=bpy.data.objects.new('Clubhouse_Bully_Cat_Rig',data);sc.collection.objects.link(arm)
skin.select_set(False);arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
def scaled(p):p=Vector(p);return Vector((p.x*factor,p.y*factor,(p.z-low)*factor))
for name,(head,tail,parent) in REST.items():
 b=data.edit_bones.new(name);b.head=scaled(head);b.tail=scaled(tail)
 if name=='root':b.head=(0,0,0);b.tail=(0,0,.08*factor)
 if parent:b.parent=data.edit_bones[parent];b.use_connect=(b.head-b.parent.tail).length<1e-6
 b.use_deform=name!='root' and not name.startswith('clavicle')
bpy.ops.object.mode_set(mode='OBJECT')
mod=skin.modifiers.new('Soft cloth and tail blend skin','ARMATURE');mod.object=arm;skin.parent=arm
arm['asset_id']='clubhouse-bully-cat';arm['version']='v001';arm['forward']='Blender +Y / glTF -Z';arm['neutral_total_height_m']=2.5;arm['attack_contact_fraction']=.625
record={'asset_id':'clubhouse-bully-cat','version':'v001','work_order':'WO111','authoring_model':'gpt-6-astra max','blender_version':bpy.app.version_string,'source_concept_sha256':sc['source_concept_sha256'],'height_m':2.5,'construction_scale_factor':factor,'construction_ground_shift':low,'triangles':len(skin.data.loop_triangles),'vertices':len(skin.data.vertices),'material_count':len(skin.data.materials),'bone_count':len(data.bones),'texture':{'file':'pigment.png','width':1024,'height':1024,'origin':'Original deterministic soft painted pigment; no external textures.'},'parts':inventory,'notes':['Original cat anatomy and soft tailored costume. Only technical mesh/UV helpers reused.','Anatomical left peg and right boot resolve the selected turnaround side consistently.','No triangle padding. Continuous torso, sleeves and tail blend across bones.','The peg is a theatrical cartoon design; no injury detail.','Neutral A pose, forward -Z GLB, floor origin and unit scale.']}
(ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n');(ROOT/'source/rig-rest.json').write_text(json.dumps({'rest':REST,'factor':factor,'ground':low},indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'clubhouse-bully-cat-construction.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(ROOT/'clubhouse-bully-cat-checkpoint.glb'),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_yup=True,export_apply=False,export_armature_object_remove=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=True)
print(json.dumps({k:record[k] for k in ['triangles','vertices','height_m','material_count','bone_count']}))
