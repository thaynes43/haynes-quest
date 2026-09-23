"""WO103 original matte teal moth, one padded skin and physical wing/projector rig.

Coordinates: Blender Z-up / +Y forward. Geometry and texture are authored here;
the selected v003 moth turnaround is the sole character construction input.
"""
import bpy, math, json, hashlib, importlib.util, struct, zlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler
import numpy as np
ROOT=Path('/workspace/haynes-quest/rat-casino-cast/moth-projectionist/v001')
assert bpy.context.scene.get('work_order')=='WO103' and bpy.context.scene.get('scene_lease')=='active'
spec=importlib.util.spec_from_file_location('wo103_common',ROOT/'source/common.py')
C=importlib.util.module_from_spec(spec);spec.loader.exec_module(C);C.BASE=ROOT.parent

def atlas():
 colors=['252824','59736d','7c8980','b3b69a','4b6764','807965','30382f','9a895e','b8b095','806b49','101a18','d6c398','415955','bca477','ede0b2','796452']
 rng=np.random.default_rng(10301);indices=np.zeros((1024,1024),dtype=np.uint8);palette=[]
 yy,xx=np.mgrid[0:256,0:256]
 for i,h in enumerate(colors):
  rgb=np.array([int(h[j:j+2],16)/255 for j in (0,2,4)]);fabric=i in (1,2,3,4,5,8,12,13)
  field=.012*np.sin(xx*.057+yy*.029)+.009*np.cos(xx*.024-yy*.04)
  field+=rng.integers(-3,4,(256,256))*(.005 if fabric else .002)
  if fabric:
   field+=(xx%3==0)*.014+(yy%4==0)*.011
   for j in range(64):
    cx,cy=rng.uniform(0,256,2);sx,sy=rng.uniform(2,12,2)
    field+=rng.uniform(-.045,.025)*np.exp(-((xx-cx)/sx)**2-((yy-cy)/sy)**2)
   for j in range(65):
    cx,cy=rng.integers(3,247,2);length=int(rng.integers(2,8));field[cy:min(256,cy+length),cx:cx+1]+=.10
  else:
   for j in range(22):
    cx,cy=rng.integers(2,249,2);length=int(rng.integers(2,8));field[cy:cy+1,cx:min(256,cx+length)]+=.05
  levels=np.clip(np.round((field+.12)/.017),0,15).astype(np.uint8)
  for level in range(16):palette.extend(np.round(np.clip(rgb+(-.12+level*.017),.01,.97)*255).astype(np.uint8).tolist())
  row=3-i//4;col=i%4;indices[row*256:(row+1)*256,col*256:(col+1)*256]=i*16+levels
 def chunk(name,data):return struct.pack('>I',len(data))+name+data+struct.pack('>I',zlib.crc32(name+data)&0xffffffff)
 raw=b''.join(b'\x00'+row.tobytes() for row in indices[::-1]);png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1024,1024,8,3,0,0,0))+chunk(b'PLTE',bytes(palette))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
 (ROOT/'pigment.png').write_bytes(png)
atlas();C.setup('v001',1.65,1.25,2,[('Matte worn teal felt, faded wings and simple pale face',.98,0),('Old practical glass, shutter and dull bronze joints',.62,.045)])
sc=bpy.context.scene;sc['work_order']='WO103';sc['scene_owner']='/root/moth_classic_blender';sc['scene_lease']='active'
sc['source_concept_sha256']='4af1fe64f067c01445f3facbf4781a4a4e53ee3dd57b4185eae7c2f4675050fb';sc['authoring_model']='gpt-6-astra max';sc['orientation']='Blender +Z up/+Y forward; glTF +Y up/-Z forward; stationary identity floor root'
for t in list(bpy.data.texts):bpy.data.texts.remove(t)
for im in list(bpy.data.images):
 if im.users==0 and im.name not in ('Render Result','Viewer Node'):bpy.data.images.remove(im)
C.SPEC.update(asset_id='moth-projectionist',version='v001',source_concept_sha256=sc['source_concept_sha256'])
def ell(name,p,s,col,bn='chest',mat=0,n=20,r=10,rot=(0,0,0)):return C.ellipsoid(name,p,s,col,bn,mat,n,r,rot)
def tube(name,p,r,col,bn='chest',mat=0,n=10):return C.tube(name,p,r,col,bn,mat,n)
def line(name,p,r,col,bn='chest',mat=0,n=6):return C.curve(name,p,r,col,bn,mat,n,steps=3)
def box(name,p,s,col,bn='chest',mat=0,bevel=.005,rot=(0,0,0)):return C.box(name,p,s,col,bn,bevel,2,mat,rot)
def disk(name,c,rad,depth,col,bn='chest',mat=0,n=16):return tube(name,[(c[0],c[1]-depth/2,c[2]),(c[0],c[1]+depth/2,c[2])],rad,col,bn,mat,n)
def stitches(name,a,b,count,bn='chest',col=13,width=.011):
 a,b=Vector(a),Vector(b);d=(b-a).normalized();side=Vector((1,0,0)) if abs(d.x)<.8 else Vector((0,0,1))
 for j in range(count):
  p=a.lerp(b,(j+.5)/count);tube(name+' stitch '+str(j),[p-side*width/2,p+side*width/2],.0016,col,bn,n=5)
def patch(name,c,s,col,bn,back=False):
 x,y,z=c;w,h=s;side=-1 if back else 1
 C.prism(name,[(x-w*.5,z-h*.48),(x+w*.46,z-h*.5),(x+w*.5,z+h*.45),(x-w*.45,z+h*.5)],y,.004,col,bn,0,.002)
 for sign in [-1,1]:stitches(name,(x+sign*w*.37,y+side*.004,z-h*.34),(x+sign*w*.37,y+side*.004,z+h*.34),4,bn,width=.012)

REST={'root':((0,0,0),(0,0,.08),None),'hips':((0,0,.61),(0,0,.72),'root'),'chest':((0,0,.72),(0,0,1.02),'hips'),'neck':((0,0,1.02),(0,0,1.085),'chest'),'head':((0,0,1.085),(0,0,1.30),'neck'),'projector':((0,.19,.895),(0,.36,.895),'chest')}
for label,s in [('R',-1),('L',1)]:
 shoulder=(s*.25,0,.983);elbow=(s*.328,.012,.795);wrist=(s*.353,.035,.604)
 REST['clavicle_'+label]=((s*.12,0,1.0),shoulder,'chest');REST['upper_arm_'+label]=(shoulder,elbow,'clavicle_'+label);REST['forearm_'+label]=(elbow,wrist,'upper_arm_'+label);REST['hand_'+label]=(wrist,(s*.355,.07,.53),'forearm_'+label)
 hip=(s*.13,0,.61);knee=(s*.144,.012,.365);ankle=(s*.158,.016,.115)
 REST['thigh_'+label]=(hip,knee,'hips');REST['shin_'+label]=(knee,ankle,'thigh_'+label);REST['foot_'+label]=(ankle,(s*.158,.19,.115),'shin_'+label)
 REST['antenna_'+label]=((s*.085,-.017,1.447),(s*.260,-.013,1.645),'head')
 REST['wing_hinge_'+label]=((s*.151,-.263,.90),(s*.151,-.263,1.00),'chest')
 REST['wing_panel_'+label]=((s*.151,-.263,.90),(s*.38,-.32,1.10),'wing_hinge_'+label)
 REST['shutter_'+label]=((s*.053,.373,.895),(s*.053,.385,.95),'projector')

# Compact padded body. The shell overlaps each covered joint without gaps.
ell('Squat moth teal padded torso',(0,-.012,.824),(.239,.189,.246),1,n=28,r=16)
ell('Moth broad hip shell',(0,-.015,.602),(.21,.160,.120),1,'hips',n=24,r=12)
line('Front uneven torso center seam',[(0,.151,.621),(0,.182,.709),(0,.176,.805)],.0026,12)
line('Back original sewn body seam',[(0,-.154,.612),(0,-.197,.759),(0,-.196,.884),(0,-.11,1.047)],.0028,12)
stitches('Back torso repair',(0,-.200,.75),(0,-.19,.85),5,width=.020)
box('Wing hinge support backplate',(0,-.204,.902),(.342,.044,.151),0,mat=1,bevel=.02)
for s in [-1,1]:
 disk('Backplate worn fixing '+str(s),(s*.112,-.232,.958),.011,.008,7,mat=1,n=10)
ell('Old neck coupling',(0,-.015,1.069),(.069,.06,.045),0,'neck',1,n=16,r=8)
for label,s in [('R',-1),('L',1)]:
 shoulder=Vector(REST['upper_arm_'+label][0]);elbow=Vector(REST['forearm_'+label][0]);wrist=Vector(REST['hand_'+label][0]);up=(elbow-shoulder).normalized();low=(wrist-elbow).normalized()
 ell(label+' shoulder socket',shoulder,(.060,.061,.063),0,'upper_arm_'+label,1,n=14,r=8)
 tube(label+' thick padded upper arm',[shoulder+up*.023,shoulder.lerp(elbow,.48),elbow-up*.031],[.074,.088,.066],1,'upper_arm_'+label,n=20)
 ell(label+' elbow bearing',elbow,(.049,.050,.045),0,'forearm_'+label,1,n=14,r=8)
 disk(label+' elbow pivot',(elbow.x,elbow.y+.047,elbow.z),.024,.010,7,'forearm_'+label,1,n=12)
 tube(label+' broad forearm shell',[elbow+low*.030,elbow.lerp(wrist,.46),wrist-low*.026],[.065,.081,.048],1,'forearm_'+label,n=18)
 ell(label+' wrist coupling',wrist,(.04,.04,.035),0,'hand_'+label,1,n=14,r=8)
 ell(label+' padded palm',(wrist.x,.068,.543),(.060,.052,.066),1,'hand_'+label,n=18,r=10)
 for j in range(3):
  x=wrist.x+(j-1)*.035;ell(label+' blunt mitten finger '+str(j),(x,.082,.493),(.022,.03,.04),2,'hand_'+label,n=12,r=6)
  box(label+' finger joint mark '+str(j),(x,.112,.496),(.025,.003,.004),6,'hand_'+label,1,bevel=.001)
 ell(label+' mitten thumb',(wrist.x-s*.058,.081,.551),(.026,.031,.043),2,'hand_'+label,n=12,r=8,rot=(0,s*.25,0))
 stitches(label+' arm sewn repair',shoulder+up*.055+Vector((0,.078,0)),elbow-up*.054+Vector((0,.064,0)),4,'upper_arm_'+label,width=.014)
 hip=Vector(REST['thigh_'+label][0]);knee=Vector(REST['shin_'+label][0]);ankle=Vector(REST['foot_'+label][0])
 ell(label+' hip covered ball',hip,(.06,.06,.057),0,'thigh_'+label,1,n=14,r=8)
 tube(label+' chunky thigh',[hip+Vector((0,0,-.026)),hip.lerp(knee,.46),knee+Vector((0,0,.036))],[.09,.10,.069],1,'thigh_'+label,n=20)
 ell(label+' knee joint',knee,(.06,.053,.047),0,'shin_'+label,1,n=14,r=8)
 disk(label+' knee pivot',(knee.x,knee.y+.05,knee.z),.027,.01,7,'shin_'+label,1,n=12)
 tube(label+' worn lower leg',[knee+Vector((0,0,-.031)),knee.lerp(ankle,.46),ankle+Vector((0,0,.026))],[.07,.084,.058],1,'shin_'+label,n=18)
 ell(label+' ankle socket',ankle,(.042,.041,.034),0,'foot_'+label,1,n=12,r=8)
 ell(label+' broad teal foot',(s*.158,.081,.062),(.107,.141,.062),1,'foot_'+label,n=24,r=10)
 for j in range(3):
  x=s*.158+(j-1)*.064;ell(label+' broad soft toe '+str(j),(x,.179,.048),(.041,.06,.046),2,'foot_'+label,n=14,r=8)
  ell(label+' blunt toe cap '+str(j),(x,.229,.043),(.019,.019,.021),7,'foot_'+label,1,n=12,r=6)
 line(label+' shin old seam',[(s*.164,.076,.30),(s*.165,.096,.238),(s*.165,.078,.16)],.0025,12,'shin_'+label,n=5)
 stitches(label+' lower leg repair',(s*.165,.093,.205),(s*.165,.090,.273),4,'shin_'+label,width=.018)
patch('Asymmetric repaired left forearm',(-.366,.097,.725),(.056,.069),2,'forearm_R')
patch('Single thigh felt patch',(.137,.094,.508),(.063,.077),2,'thigh_L')

# A small rough collar, broad short tufts instead of thin alpha cards.
collar_rows=[]
for rx,ry,z in [(.086,.077,1.106),(.126,.104,1.120),(.158,.129,1.104),(.153,.126,1.077),(.122,.102,1.060),(.085,.077,1.086),(.086,.077,1.106)]:
 row=[]
 for i in range(40):
  a=math.tau*i/40;fringe=(.006*math.sin(a*9)+.004*math.cos(a*13)) if rx>.14 else 0
  row.append(((rx+fringe)*math.cos(a),-.007+(ry+fringe)*math.sin(a),z+fringe*.55))
 collar_rows.append(row)
C.rings('Small continuous worn fuzzy collar',collar_rows,5,'neck',caps=False)
for i in range(20):
 a=math.tau*i/20;line('Collar short stitched fur wisp '+str(i),[(.124*math.cos(a),-.007+.104*math.sin(a),1.113),(.149*math.cos(a+.018),-.007+.122*math.sin(a+.018),1.096),(.150*math.cos(a+.025),-.007+.124*math.sin(a+.025),1.076)],.0019,13,'neck',n=5)
C.bow('Small faded cloth projector tie',(0,.13,1.051),.115,5,'neck')

# Pale molded face over the round teal head; cheap glass has no emissive shader.
ell('Round worn teal head',(0,-.012,1.284),(.223,.168,.203),1,'head',n=32,r=18)
ell('Simple pale moth faceplate',(0,.115,1.290),(.196,.095,.178),3,'head',n=30,r=16)
for s in [-1,1]:
 disk('Side head hinge '+str(s),(s*.213,.002,1.288),.038,.048,7,'head',1,n=14)
 ell('Dark socket behind tired glass '+str(s),(s*.102,.196,1.302),(.083,.037,.091),5,'head',n=24,r=12)
 ell('Cheap amber ivory glass eye '+str(s),(s*.102,.227,1.298),(.069,.028,.075),11,'head',1,n=28,r=14)
 C.ellipse_loop('Simple old eye ring '+str(s),(s*.102,.238,1.299),.072,.078,.0065,7,'head',1,normal='y',n=32,tube_n=6)
 ell('Small still moth pupil '+str(s),(s*.099,.254,1.292),(.017,.004,.025),10,'head',1,n=14,r=8)
 ell('Dull small eye catchlight '+str(s),(s*.099-.005,.258,1.310),(.004,.0015,.004),14,'head',1,n=8,r=5)
 # Thick smooth cap reads as a tired eyelid, with no glamour lashes.
 rr=[]
 for j in range(5):
  lower=(-.075 if s<0 else .085);a=lower+(math.pi/2-lower)*j/4
  rr.append([(s*.102+.073*math.cos(a)*math.cos(math.tau*k/18),.225+.035*math.cos(a)*math.sin(math.tau*k/18),1.302+.081*math.sin(a)) for k in range(18)])
 C.rings('Plain half lowered pale eyelid '+str(s),rr,3,'head',caps=True)
 ell('Plain heavy pale brow '+str(s),(s*.109,.181,1.390),(.069,.018,.016),3,'head',n=16,r=6,rot=(0,(-.08 if s<0 else .06),0))
 line('Short tired brow seam '+str(s),[(s*.166,.175,1.387),(s*.111,.198,1.405),(s*.047,.181,1.391)],.003,5,'head',n=5)
ell('Small rounded dark moth nose',(0,.229,1.181),(.043,.041,.051),0,'head',1,n=22,r=12)
line('Tiny simple mouth seam',[(-.061,.196,1.150),(0,.214,1.130),(.067,.186,1.151)],.005,0,'head',1,n=5)
for x in [-.019,.019]:box('Blunt lower face tooth '+str(x),(x,.212,1.138),(.022,.012,.018),8,'head',bevel=.004)
line('Faceplate old vertical seam',[(0,.016,1.487),(0,.114,1.45),(0,.178,1.386),(0,.207,1.314)],.0024,12,'head',n=5)
stitches('Faceplate repair',(0,.179,1.399),(0,.198,1.351),4,'head',width=.013)
line('Back head vertical repair',[(0,-.017,1.487),(0,-.145,1.41),(0,-.181,1.29),(0,-.123,1.165)],.0026,12,'head',n=5)
stitches('Back head stitching',(0,-.177,1.27),(0,-.155,1.39),6,'head',width=.019)
patch('Single pale side cheek repair',(-.173,.091,1.235),(.036,.053),2,'head')

# Two feathered antennae, each a single articulated stem and blunt barbs.
for label,s in [('R',-1),('L',1)]:
 bn='antenna_'+label
 pts=[(s*.085,-.017,1.447),(s*.112,-.021,1.530),(s*.19,-.026,1.598),(s*.270,-.031,1.633),(s*.318,-.036,1.622)]
 disk(label+' antenna round base',(s*.085,-.018,1.451),.018,.024,7,bn,1,n=12)
 line(label+' feather antenna stem',pts,[.005,.005,.004,.003,.0018],7,bn,1,n=6)
 for j in range(9):
  u=(j+.65)/10;segment=u*3;idx=int(segment);f=segment-idx;p=Vector(pts[idx]).lerp(Vector(pts[idx+1]),f)
  length=.044*(1-.38*u)
  for sign in [-1,1]:
   tip=p+Vector((-s*length*.6,-.002,sign*length));mid=p+Vector((-s*length*.32,0,sign*length*.7))
   tube(label+' feather barb '+str(j)+' '+str(sign),[p,mid,tip],[.0026,.0021,.0007],13,bn,n=5)

# One connected thin two-lobed wing panel per side. Both surfaces are authored,
# with full perimeter bands and faded crescent-like token patches (no alpha).
outline_control=[(.163,.971),(.230,1.115),(.364,1.259),(.492,1.328),(.538,1.321),(.554,1.274),(.519,1.121),(.465,.987),(.387,.884),(.437,.759),(.474,.571),(.446,.408),(.405,.343),(.355,.397),(.300,.554),(.245,.719),(.182,.836)]
# Periodic Catmull-Rom keeps each lobe rounded and preserves the narrow waist.
outline=[]
for i,b in enumerate(outline_control):
 a=np.array(outline_control[i-1]);b=np.array(b);c=np.array(outline_control[(i+1)%len(outline_control)]);d=np.array(outline_control[(i+2)%len(outline_control)])
 for j in range(3):
  t=j/3;outline.append(tuple(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)))
wing_records=[]
for label,s in [('R',-1),('L',1)]:
 bn='wing_panel_'+label;hinge='wing_hinge_'+label
 # All panel points lie behind arms/body; a small backwards sweep gives profile.
 def wy(x):return -.320-.12*(abs(x)-.16)
 poly=[(s*x,z) for x,z in outline];n=len(poly);verts=[(x,wy(x)+side*.010,z) for side in [-1,1] for x,z in poly]
 faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))];faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
 ob=C.mesh(label+' continuous upper and lower moth wing',verts,faces,4,bn,smooth=False)
 # Rounded silhouette is a stitched canvas border over a wire frame.
 for side in [-1,1]:
  border=[(x,wy(x)+side*.012,z) for x,z in poly+[poly[0]]]
  tube(label+' wing bound edge '+str(side),border,.007,5,bn,n=6)
  # Hand drawn branching ribs remain restrained and inside the wing contour.
  for j,(target,branch) in enumerate([((.503,1.289),(.358,1.155)),((.49,1.139),(.338,1.032)),((.443,.995),(.305,.929)),((.44,.568),(.316,.674)),((.407,.394),(.297,.58))]):
   tx,tz=target;mx,mz=branch;root=(s*.193,wy(.193)+side*.014,.919 if j<3 else .844)
   line(label+' wing faded vein '+str(side)+str(j),[root,(s*mx,wy(mx)+side*.014,mz),(s*tx,wy(tx)+side*.014,tz)],.0026,5,bn,n=5)
  # Large faded ring marks are readable at distance and original token shapes.
  for k,(cx,cz,rx,rz) in enumerate([(.365,1.080,.073,.094),(.361,.623,.049,.070)]):
   rr=[]
   for radius in [1,.64]:
    rr.append([(s*(cx+rx*radius*math.cos(math.tau*i/24)),wy(cx+rx*radius*math.cos(math.tau*i/24))+side*.015,cz+rz*radius*math.sin(math.tau*i/24)) for i in range(24)])
   vs=rr[0]+rr[1];fs=[(i,(i+1)%24,(i+1)%24+24,i+24) for i in range(24)]
   C.mesh(label+' wing worn token circle '+str(side)+str(k),vs,fs,8,bn,smooth=False)
 # Two real hinge barrels and a short rigid spar connect the panel to the plate.
 for z in [.875,.932]:
  tube(label+' wing pivot barrel '+str(z),[(s*.149,-.256,z-.020),(s*.149,-.256,z+.020)],.020,7,hinge,1,n=12)
  box(label+' wing hinge bracket '+str(z),(s*.151,-.239,z),(.053,.049,.020),0,mat=1,bevel=.004)
 tube(label+' wing short rigid spar',[(s*.151,-.263,.901),(s*.185,wy(.185),.918)],.013,0,hinge,1,n=8)
 wing_records.append({'label':label,'panel_bone':bn,'hinge_bone':hinge,'pivot':REST[hinge][0],'outer_outline_blender':[(s*x,wy(x),z) for x,z in outline]})

# Practical chest projector. Housing is rigid with the chest; two physical
# bronze shutter leaves slide sideways to expose a warm-white lens at contact.
box('Chest projector cloth mounting pad',(0,.183,.895),(.301,.073,.297),5,bevel=.023)
box('Old chest projector box',(0,.256,.895),(.300,.149,.253),0,'projector',1,bevel=.015)
box('Flat practical projector front plate',(0,.337,.895),(.281,.022,.230),9,'projector',1,bevel=.006)
disk('Projector lens outer barrel',(0,.360,.895),.091,.045,0,'projector',1,n=32)
C.ellipse_loop('Projector dull brass lens rim',(0,.389,.895),.076,.076,.009,7,'projector',1,normal='y',n=40,tube_n=8)
ell('Projector warm white glass lens',(0,.390,.895),(.068,.015,.068),14,'projector',1,n=30,r=14)
C.ellipse_loop('Projector inner glass rim',(0,.404,.895),.047,.047,.0026,8,'projector',1,normal='y',n=28,tube_n=5)
for x in [-.123,.123]:
 for z in [.796,.994]:disk('Projector old corner screw '+str(x)+str(z),(x,.352,z),.009,.008,7,'projector',1,n=10)
for s in [-1,1]:
 # Small unlettered token mark flanks the round lens.
 C.prism('Projector faded token diamond '+str(s),[(s*.115,.919),(s*.126,.895),(s*.115,.871),(s*.104,.895)],.354,.002,8,'projector')
for label,s in [('R',-1),('L',1)]:
 box(label+' physical projector shutter leaf',(s*.067,.414,.895),(.032,.008,.130),9,'shutter_'+label,1,bevel=.004)
 box(label+' shutter leaf dull leading edge',(s*.051,.420,.895),(.004,.003,.118),7,'shutter_'+label,1,bevel=.001)
 box(label+' shutter guide top',(s*.075,.403,.970),(.096,.017,.010),0,'projector',1,bevel=.002)
 box(label+' shutter guide bottom',(s*.075,.403,.820),(.096,.017,.010),0,'projector',1,bevel=.002)
for j in range(4):box('Old projector side vent '+str(j),(.153,.236,.850+j*.025),(.006,.057,.007),6,'projector',1,bevel=.001)

# Preserve editable named original islands and export one maintainable skin.
pts=[v.co for ob in C.PARTS for v in ob.data.vertices];ground=min(v.z for v in pts);factor=1.65/(max(v.z for v in pts)-ground)
sources=bpy.data.collections.new('EDITABLE Moth original source parts - excluded from GLB');sc.collection.children.link(sources);inventory=[];copies=[]
for ob in C.PARTS:
 for v in ob.data.vertices:v.co=Vector((v.co.x*factor,v.co.y*factor,(v.co.z-ground)*factor))
 ob.data.calc_loop_triangles();inventory.append({'name':ob.name,'triangles':len(ob.data.loop_triangles),'bone_groups':[g.name for g in ob.vertex_groups],'pigment_tile':ob.get('atlas_tile')})
 cp=ob.copy();cp.data=ob.data.copy();sc.collection.objects.link(cp);copies.append(cp)
 for col in list(ob.users_collection):col.objects.unlink(ob)
 sources.objects.link(ob)
sources.hide_render=True;sources.hide_viewport=True;bpy.ops.object.select_all(action='DESELECT')
for ob in copies:ob.select_set(True)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();skin=bpy.context.object;skin.name='Moth_Projectionist_Skin'
for tag in ['source_part','rigid_weight','atlas_tile']:
 if tag in skin:del skin[tag]
skin.data.calc_loop_triangles();before=len(skin.data.loop_triangles)
if before>14800:
 dec=skin.modifiers.new('Mobile silhouette preserving simplification','DECIMATE');dec.ratio=14700/before;dec.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=dec.name)
data=bpy.data.armatures.new('Moth hinged projector mascot skeleton');arm=bpy.data.objects.new('Moth_Projectionist_Rig',data);sc.collection.objects.link(arm);skin.select_set(False);arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
def scaled(p):p=Vector(p);return Vector((p.x*factor,p.y*factor,(p.z-ground)*factor))
for name,(head,tail,parent) in REST.items():
 b=data.edit_bones.new(name);b.head=scaled(head);b.tail=scaled(tail)
 if name=='root':b.head=(0,0,0);b.tail=(0,0,.07*factor)
 if parent:b.parent=data.edit_bones[parent];b.use_connect=(b.head-b.parent.tail).length<.000001
 b.use_deform=name!='root' and not name.startswith('clavicle')
bpy.ops.object.mode_set(mode='OBJECT');mod=skin.modifiers.new('Rigid padded shells, real wing hinges and shutter leaves','ARMATURE');mod.object=arm;skin.parent=arm
arm['asset_id']='moth-projectionist';arm['candidate']='v001 classic compact moth studio candidate';arm['forward']='Blender +Y / glTF -Z';arm['neutral_total_height_m']=1.65;arm['attack_contact_fraction']=.625;arm['source_concept_sha256']=sc['source_concept_sha256']
bpy.context.view_layer.update();skin.data.calc_loop_triangles()
record={'asset_id':'moth-projectionist','version':'v001','work_order':'WO103','authoring_model':'gpt-6-astra max','blender_version':bpy.app.version_string,'source_concept_sha256':sc['source_concept_sha256'],'source_concept_path':'docs/assets/media/rat-casino-ensemble/v003/construction/moth-projectionist.png','source_prompt_sha256':'6c36c7d4fa2a426fefda549314fa7bf6a55f6cef7b61500b570d4d4694d3722a','source_prompt_path':'docs/assets/media/rat-casino-ensemble/v003/construction/moth-projectionist-prompt.txt','ensemble_sha256':'df8b390adf7750a9a91ce63c13d2df5e033cb7e95c2b3975d6ddbac202439a9f','ensemble_path':'docs/assets/media/rat-casino-ensemble/v003/concept.png','spec':C.SPEC,'height_m':1.65,'construction_scale_factor':factor,'construction_ground_shift':ground,'triangles_before_export_simplification':before,'triangles':len(skin.data.loop_triangles),'vertices':len(skin.data.vertices),'material_count':len(skin.data.materials),'texture':{'file':'pigment.png','width':1024,'height':1024,'origin':'Original deterministic teal felt, worn wing canvas, pale face and practical dull glass pigment; no external texture.'},'bone_count':len(data.bones),'parts':inventory,'notes':['Compact 1.65 m matte teal moth below the 2.15 m lead rat.','Two separate thin hinged folded wing panels and two feathered antenna pivots.','Rigid practical chest projector with actual sliding shutter leaves, no beam or animated emission.','One runtime skin; rigid padded shell islands retain credible mechanical separations.','All geometry and surface pigment original. No franchise meshes, textures, logos, private media or face/costume copying.']}
(ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n');(ROOT/'source/rig-rest.json').write_text(json.dumps({'rest':REST,'factor':factor,'ground':ground,'wings':wing_records,'projector_lens_center':(0,.39,.895),'projector_axis':(0,1,0)},indent=2)+'\n')
for name in ['common.py','build.py']:
 block=bpy.data.texts.new('WO103 '+name);block.write((ROOT/'source'/name).read_text())
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'moth-projectionist-construction.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(ROOT/'moth-projectionist-checkpoint.glb'),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_yup=True,export_apply=False,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=False)
print(json.dumps({k:record[k] for k in ['triangles','triangles_before_export_simplification','vertices','height_m','material_count','bone_count']}))
