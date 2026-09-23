"""WO104 original compact worn spare rat, independent of the lead-rat geometry.

All geometry is constructed here from original padded forms. +Z up / +Y forward.
The selected v003 golden spare-rat sheet supplies visual construction direction.
"""
import bpy, math, json, hashlib, importlib.util, struct, zlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler
import numpy as np
ROOT=Path('/workspace/haynes-quest/rat-casino-cast/golden-after-hours-rat/v001')
assert bpy.context.scene.get('work_order')=='WO104' and bpy.context.scene.get('scene_lease')=='active'
spec=importlib.util.spec_from_file_location('wo104_common',ROOT/'source/common.py')
C=importlib.util.module_from_spec(spec);spec.loader.exec_module(C);C.BASE=ROOT.parent

def atlas():
 colors=['282821','987943','ad915b','c9baa0','826936','72563e','4d4535','80714c','a59a78','40382b','131b18','acb7a2','6b532e','c0a974','e6dbc2','876447']
 rng=np.random.default_rng(10401);indices=np.zeros((1024,1024),dtype=np.uint8);palette=[];yy,xx=np.mgrid[0:256,0:256]
 for i,h in enumerate(colors):
  rgb=np.array([int(h[j:j+2],16)/255 for j in (0,2,4)]);fabric=i in (1,2,3,4,5,8,12,13)
  field=.013*np.sin(xx*.061+yy*.032)+.01*np.cos(xx*.027-yy*.043)
  field+=rng.integers(-3,4,(256,256))*(.006 if fabric else .002)
  if fabric:
   field+=(xx%3==0)*.012+(yy%4==0)*.010
   for j in range(80):
    cx,cy=rng.uniform(0,256,2);sx,sy=rng.uniform(2,13,2)
    field+=rng.uniform(-.055,.030)*np.exp(-((xx-cx)/sx)**2-((yy-cy)/sy)**2)
   # A few diffuse faded contact scuffs, deliberately broad enough to read
   # on the old spare shell without high-frequency grime or painted holes.
   for j in range(11):
    cx,cy=rng.uniform(0,256,2);sx,sy=rng.uniform(12,38,2)
    field+=rng.uniform(-.10,.09)*np.exp(-((xx-cx)/sx)**2-((yy-cy)/sy)**2)
   for j in range(70):
    cx,cy=rng.integers(3,247,2);length=int(rng.integers(2,8));field[cy:min(256,cy+length),cx:cx+1]+=.085
  else:
   for j in range(20):
    cx,cy=rng.integers(2,249,2);length=int(rng.integers(2,8));field[cy:cy+1,cx:min(256,cx+length)]+=.045
  levels=np.clip(np.round((field+.12)/.017),0,15).astype(np.uint8)
  for level in range(16):palette.extend(np.round(np.clip(rgb+(-.12+level*.017),.01,.97)*255).astype(np.uint8).tolist())
  row=3-i//4;col=i%4;indices[row*256:(row+1)*256,col*256:(col+1)*256]=i*16+levels
 def chunk(name,data):return struct.pack('>I',len(data))+name+data+struct.pack('>I',zlib.crc32(name+data)&0xffffffff)
 raw=b''.join(b'\x00'+row.tobytes() for row in indices[::-1]);png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1024,1024,8,3,0,0,0))+chunk(b'PLTE',bytes(palette))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
 (ROOT/'pigment.png').write_bytes(png)
atlas();C.setup('v001',1.70,1.25,2,[('Dusty mustard felt and pale replacement cloth',.98,0),('Dull old joints and inexpensive glass',.58,.025)])
sc=bpy.context.scene;sc['work_order']='WO104';sc['scene_owner']='/root/golden_classic_blender';sc['scene_lease']='active'
sc['candidate_status']='WO104 v001 studio candidate; lead art refinement accepted; Tom exact-version art and gameplay/device gates pending'
sc['source_concept_sha256']='7ceb9648bbc6cc6b24139d86a8f4d63e7c878b6e8a4d81fad5f6d90e2dad7782';sc['authoring_model']='gpt-6-astra max';sc['orientation']='Blender +Z up/+Y forward; glTF +Y up/-Z forward; stationary identity floor root'
for t in list(bpy.data.texts):bpy.data.texts.remove(t)
for im in list(bpy.data.images):
 if im.users==0 and im.name not in ('Render Result','Viewer Node'):bpy.data.images.remove(im)
C.SPEC.update(asset_id='golden-after-hours-rat',version='v001',source_concept_sha256=sc['source_concept_sha256'])
def ell(name,p,s,col,bn='chest',mat=0,n=20,r=10,rot=(0,0,0)):return C.ellipsoid(name,p,s,col,bn,mat,n,r,rot)
def tube(name,p,r,col,bn='chest',mat=0,n=10,weights=None):return C.tube(name,p,r,col,bn,mat,n,weights)
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
 for sign in [-1,1]:stitches(name,(x+sign*w*.37,y+side*.004,z-h*.34),(x+sign*w*.37,y+side*.004,z+h*.34),4,bn,width=.013)

REST={'root':((0,0,0),(0,0,.08),None),'hips':((0,0,.663),(0,0,.788),'root'),'chest':((0,0,.788),(0,0,1.102),'hips'),'neck':((0,0,1.102),(0,0,1.171),'chest'),'head':((0,0,1.171),(0,0,1.425),'neck'),'faceplate':((0,.12,1.375),(0,.205,1.375),'head'),'jaw':((0,.14,1.263),(0,.272,1.252),'faceplate'),'tail_base':((0,-.16,.664),(.01,-.274,.510),'hips'),'tail_mid':((.01,-.274,.510),(.15,-.350,.308),'tail_base'),'tail_tip':((.15,-.350,.308),(.42,-.300,.225),'tail_mid')}
for label,s in [('R',-1),('L',1)]:
 shoulder=(s*.274,0,1.073);elbow=(s*.366,.012,.869);wrist=(s*.400,.031,.663)
 REST['clavicle_'+label]=((s*.13,0,1.092),shoulder,'chest');REST['upper_arm_'+label]=(shoulder,elbow,'clavicle_'+label);REST['forearm_'+label]=(elbow,wrist,'upper_arm_'+label);REST['hand_'+label]=(wrist,(s*.414,.075,.585),'forearm_'+label)
 if label=='L':REST['replacement_paw']=((s*.400,.031,.663),(s*.414,.075,.585),'hand_L')
 hip=(s*.139,0,.663);knee=(s*.155,.015,.397);ankle=(s*.173,.030,.124)
 REST['thigh_'+label]=(hip,knee,'hips');REST['shin_'+label]=(knee,ankle,'thigh_'+label);REST['foot_'+label]=(ankle,(s*.173,.20,.124),'shin_'+label)
 REST['ear_'+label]=((s*.166,-.01,1.532),(s*.245,-.018,1.643),'head')

# Small rounded padded body with an exposed soft belly below a short waistcoat.
ell('Compact mustard spare shell torso',(0,-.014,.916),(.255,.183,.276),1,n=28,r=16)
ell('Round loose belly and hip shell',(0,-.013,.675),(.237,.177,.148),1,'hips',n=26,r=14)
line('Belly sewn seam',[(0,.165,.657),(0,.163,.706),(0,.138,.765)],.003,12,'hips')
stitches('Old belly repair',(0,.165,.641),(0,.166,.702),4,'hips',width=.020)
ell('Short visible neck coupling',(0,-.004,1.15),(.081,.067,.043),0,'neck',1,n=16,r=8)
for label,s in [('R',-1),('L',1)]:
 shoulder=Vector(REST['upper_arm_'+label][0]);elbow=Vector(REST['forearm_'+label][0]);wrist=Vector(REST['hand_'+label][0]);up=(elbow-shoulder).normalized();low=(wrist-elbow).normalized()
 ell(label+' shoulder socket',shoulder,(.064,.064,.063),0,'upper_arm_'+label,1,n=14,r=8)
 tube(label+' padded upper arm',[shoulder+up*.026,shoulder.lerp(elbow,.48),elbow-up*.028],[.080,.096,.076],1,'upper_arm_'+label,n=20)
 ell(label+' elbow bearing',elbow,(.052,.049,.045),0,'forearm_'+label,1,n=14,r=8)
 disk(label+' elbow old pivot',(elbow.x,elbow.y+.047,elbow.z),.024,.010,7,'forearm_'+label,1,n=12)
 tube(label+' stout forearm',[elbow+low*.027,elbow.lerp(wrist,.48),wrist-low*.024],[.075,.089,.052],1,'forearm_'+label,n=20)
 ell(label+' wrist swivel',wrist,(.043,.040,.034),0,'hand_'+label,1,n=14,r=8)
 paw='replacement_paw' if label=='L' else 'hand_R';tile=3 if label=='L' else 1
 ell(label+' pale replacement paw' if label=='L' else 'Original mustard paw',(s*.414,.065,.599),(.069,.056,.070),tile,paw,n=22,r=12)
 for j in range(3):
  x=s*.414+(j-1)*.040;ell(label+' blunt finger '+str(j),(x,.080,.547),(.025,.030,.041),3 if label=='L' else 2,paw,n=12,r=7)
  box(label+' finger crease '+str(j),(x,.109,.550),(.025,.003,.004),5,paw,bevel=.001)
 ell(label+' thumb',(s*.414-s*.069,.081,.602),(.029,.034,.044),tile,paw,n=14,r=8,rot=(0,s*.29,0))
 stitches(label+' paw sewn line',(s*.414-.045,.115,.606),(s*.414+.045,.115,.606),4,paw,col=5,width=.014)
 stitches(label+' arm repair',shoulder+up*.062+Vector((0,.088,0)),elbow-up*.043+Vector((0,.071,0)),4,'upper_arm_'+label,width=.016)
 hip=Vector(REST['thigh_'+label][0]);knee=Vector(REST['shin_'+label][0]);ankle=Vector(REST['foot_'+label][0])
 ell(label+' covered hip bearing',hip,(.063,.059,.059),0,'thigh_'+label,1,n=14,r=8)
 tube(label+' broad padded thigh',[hip+Vector((0,0,-.035)),hip.lerp(knee,.48),knee+Vector((0,0,.033))],[.104,.108,.078],1,'thigh_'+label,n=22)
 ell(label+' knee bearing',knee,(.062,.054,.047),0,'shin_'+label,1,n=14,r=8)
 disk(label+' old knee pivot',(knee.x,knee.y+.052,knee.z),.026,.010,7,'shin_'+label,1,n=12)
 tube(label+' worn shin shell',[knee+Vector((0,0,-.031)),knee.lerp(ankle,.48),ankle+Vector((0,0,.025))],[.077,.086,.061],1,'shin_'+label,n=20)
 ell(label+' ankle joint',ankle,(.045,.042,.035),0,'foot_'+label,1,n=12,r=8)
 ell(label+' broad soft foot',(s*.173,.099,.064),(.118,.154,.064),1,'foot_'+label,n=26,r=12)
 for j in range(3):
  x=s*.173+(j-1)*.069;ell(label+' rounded toe '+str(j),(x,.203,.047),(.044,.064,.046),2,'foot_'+label,n=14,r=8)
  ell(label+' blunt toe cap '+str(j),(x,.256,.044),(.020,.020,.022),7,'foot_'+label,1,n=12,r=6)
 line(label+' shin side seam',[(s*.182,.085,.327),(s*.183,.104,.255),(s*.183,.087,.177)],.0028,12,'shin_'+label,n=5)
 stitches(label+' shin repair',(s*.184,.103,.216),(s*.184,.099,.287),4,'shin_'+label,width=.019)
patch('Uneven thigh cloth patch',(-.152,.108,.534),(.066,.080),2,'thigh_R')
patch('Old shoulder cloth patch',(.352,.093,.970),(.049,.061),4,'upper_arm_L')
patch('Older forearm faded cloth repair',(-.395,.111,.763),(.053,.072),2,'forearm_R')
patch('Small mismatched lower shin repair',(.192,.105,.251),(.047,.064),4,'shin_L')

# A separate short waistcoat made of faded mustard fabric, wrapping the padded
# torso. Curved bands give it real side/back surfaces without planar clipping.
rows=[(.790,.211,.173),(.849,.254,.197),(.936,.271,.203),(1.026,.249,.193),(1.106,.197,.137)]
back=[]
for z,rx,ry in rows:back.append([(rx*math.cos(math.pi+math.pi*i/24),-.014+ry*math.sin(math.pi+math.pi*i/24),z) for i in range(25)])
C.rings('Short waistcoat curved back and sides',back,4,'chest',caps=False)
for s in [-1,1]:
 grid=[]
 for j,(z,rx,ry) in enumerate(rows):
  inner=[.027,.022,.018,.069,.102][j];outer=rx*.985
  grid.append([(s*(inner+(outer-inner)*i/8),-.009+ry*math.sqrt(max(0,1-((inner+(outer-inner)*i/8)/rx)**2)),z+(.026*(i/8) if j==0 else 0)) for i in range(9)])
 vs=[p for row in grid for p in row];fs=[]
 for j in range(4):
  for i in range(8):a=j*9+i;fs.append((a,a+1,a+10,a+9))
 C.mesh(('Left' if s>0 else 'Right')+' faded waistcoat front',vs,fs,2,'chest')
 line('Plain short vest front edge '+str(s),[row[0] for row in grid],.0043,4,n=6)
 line('Short vest hem '+str(s),grid[0],.0035,4,n=5)
 line('Vest armhole rolled edge '+str(s),[(s*.198,.005,1.103),(s*.239,.038,1.047),(s*.251,.054,1.012)],.008,4,n=6)
 # Plain lapel band follows the V and stays in front of the curved cloth.
 C.prism('Short folded vest lapel '+str(s),[(s*.092,1.105),(s*.122,1.08),(s*.056,.984),(s*.024,.975)],.184,.014,4,'chest',bevel=.002)
patch('Plain faded waistcoat mending',(-.133,.176,.904),(.048,.050),1,'chest')
C.prism('Small pale undershirt triangle',[(-.105,1.104),(.105,1.104),(0,.974)],.182,.015,3,'chest',bevel=.003)
C.bow('Small crooked dark bow tie',(.004,.206,1.090),.108,9,'chest')
for ob in C.PARTS[-3:]:
 pivot=Vector((.004,.206,1.09));rot=Euler((0,.15,0)).to_matrix()
 for v in ob.data.vertices:v.co=pivot+rot@(v.co-pivot)
for z in [.943,.873,.812]:disk('Plain old waistcoat button '+str(z),(0,.208 if z>.84 else .193,z),.013,.010,0,mat=1,n=14)
box('Tiny integrated token badge frame',(.128,.184,1.00),(.040,.017,.067),7,mat=1,bevel=.010)
box('Token badge dark inset',(.128,.195,1.00),(.028,.006,.053),0,mat=1,bevel=.007)
box('Single vertical token slot',(.128,.200,1.002),(.005,.004,.038),10,mat=1,bevel=.001)
for z in [.976,1.027]:disk('Badge small screw '+str(z),(.128,.201,z),.0035,.003,8,mat=1,n=8)
line('Back waistcoat center seam',[(0,-.191,.790),(0,-.217,.928),(0,-.151,1.105)],.003,12)
box('Short back waistcoat adjustment tab',(0,-.211,.858),(.181,.017,.028),2,bevel=.007)
for x in [-.073,.073]:disk('Back tab button '+str(x),(x,-.225,.858),.008,.007,0,mat=1,n=10)

# Plain original rat head: smaller glass eyes and broad continuous pale panel,
# blunt muzzle and restrained incisors, with a visibly repaired round ear.
ell('Round mustard spare rat head',(0,-.017,1.392),(.223,.174,.232),1,'head',n=34,r=20)
ell('Thin dark faceplate perimeter gasket',(0,.106,1.391),(.201,.081,.204),5,'faceplate',n=30,r=18)
ell('Pale removable forehead cheek faceplate',(0,.116,1.391),(.193,.081,.196),3,'faceplate',n=30,r=18)
for label,s in [('R',-1),('L',1)]:
 bn='ear_'+label;cx=s*.244;cz=1.616 if label=='R' else 1.608
 ell(label+' round padded ear',(cx,-.016,cz),(.118,.047,.118 if label=='R' else .110),1,bn,n=26,r=14)
 ell(label+' recessed ear cloth',(cx,.023,cz),(.091,.021,.091 if label=='R' else .082),5,bn,n=24,r=12)
 C.ellipse_loop(label+' old round ear piping',(cx,.012,cz),.102,.101 if label=='R' else .095,.009,4,bn,normal='y',n=36,tube_n=6)
 ell(label+' head ear coupling',(s*.165,-.008,1.539),(.027,.037,.034),0,bn,1,n=12,r=8)
 if label=='L':
  patch('Uneven repaired ear insert',(cx+.025,.042,cz+.008),(.077,.114),2,bn)
  line('Repaired ear crooked seam',[(cx-.025,.046,cz-.080),(cx-.011,.047,cz-.021),(cx+.004,.045,cz+.080)],.003,9,bn,n=5)
  stitches('Visible repaired ear stitches',(cx-.025,.050,cz-.074),(cx+.004,.050,cz+.072),7,bn,col=13,width=.021)
 eyez=1.432+(.003 if s<0 else -.006);eyex=s*.093
 ell(label+' plain recessed eye socket',(eyex,.183,eyez),(.065,.030,.079),5,'faceplate',n=24,r=14)
 ell(label+' modest ivory glass eye',(eyex,.207,eyez-.008),(.046,.025,.054),14,'faceplate',1,n=24,r=12)
 ell(label+' uneven gray green iris',(eyex+s*.003,.230,eyez-.018),(.024 if s<0 else .021,.007,.027),11,'faceplate',1,n=20,r=10)
 ell(label+' small dark pupil',(eyex+s*.003,.237,eyez-.018),(.010,.003,.014),10,'faceplate',1,n=14,r=8)
 ell(label+' soft glass glint',(eyex-.008,.240,eyez-.005),(.004,.001,.004),14,'faceplate',1,n=10,r=6)
 rr=[]
 for j in range(5):
  lower=.015 if s<0 else -.14;a=lower+(math.pi/2-lower)*j/4
  rr.append([(eyex+.052*math.cos(a)*math.cos(math.tau*k/18),.204+.034*math.cos(a)*math.sin(math.tau*k/18),eyez+.061*math.sin(a)) for k in range(18)])
 C.rings(label+' heavy tired eyelid',rr,5,'faceplate',caps=True)
 line(label+' simple dark eyebrow',[(eyex-.048,.160,eyez+.081),(eyex,.182,eyez+.098),(eyex+.048,.161,eyez+.084)],.007,9,'faceplate',n=7)
 ell(label+' pale rounded cheek',(s*.109,.184,1.302),(.094,.075,.071),3,'faceplate',n=24,r=14)
 disk(label+' faceplate side fixing',(s*.162,.204,1.322),.008,.006,7,'faceplate',1,n=10)
 # Three short stiff whiskers per cheek stay distinct in silhouette.
 for j in range(3):
  z=1.319-j*.022
  line(label+' short old whisker '+str(j),[(s*.135,.254,z),(s*.225,.278,z+.006-j*.013),(s*.298,.265,z+.016-j*.028)],.0015,8,'faceplate',n=5)
ell('Blunt pale rat muzzle',(0,.245,1.307),(.113,.136,.071),3,'faceplate',n=30,r=16)
ell('Small soft black rat nose',(0,.368,1.317),(.044,.030,.030),0,'faceplate',1,n=22,r=12)
line('Blunt snout center seam',[(0,.331,1.367),(0,.363,1.350)],.0025,5,'faceplate',n=5)
for s in [-1,1]:
 for x,z in [(s*.044,1.329),(s*.068,1.310),(s*.045,1.293)]:ell('Muzzle small worn whisker dot '+str(x)+str(z),(x,.367-abs(x)*.40,z),(.0033,.002,.0033),5,'faceplate',n=8,r=5)
ell('Small lower jaw shell',(0,.218,1.247),(.099,.104,.030),3,'jaw',n=24,r=12)
ell('Simple narrow mouth gap',(0,.248,1.266),(.086,.083,.015),0,'jaw',1,n=20,r=8)
for x in [-.016,.016]:box('Small square rat incisor '+str(x),(x,.326,1.263),(.025,.014,.040),14,'jaw',bevel=.005,rot=(0,-x*.5,0))
C.ellipse_loop('Narrow removable faceplate gasket seam',(0,.137,1.391),.190,.194,.0034,9,'faceplate',normal='y',n=44,tube_n=6)
# One modest closure latch at the visible side; the panel stays closed.
tube('Discreet faceplate side latch barrel',[(.184,.145,1.330),(.184,.145,1.370)],.0075,7,'faceplate',1,n=12)
for z in [1.336,1.364]:box('Faceplate latch short tab '+str(z),(.181,.152,z),(.024,.009,.010),7,'faceplate',1,bevel=.003)
disk('One faceplate latch fastening',(.177,.160,1.350),.0045,.004,0,'faceplate',1,n=10)
line('Head worn center seam',[(0,-.007,1.622),(0,-.154,1.545),(0,-.191,1.401),(0,-.143,1.257)],.003,12,'head',n=5)
stitches('Back head cloth stitches',(0,-.188,1.366),(0,-.177,1.478),6,'head',width=.022)
patch('Small head side repair',(-.183,.065,1.400),(.030,.051),2,'head')

# Thin segmented tail. Weighted continuous tube carries both visible seams
# and separate named base/mid/tip pivots; its distal path stays behind the body.
tail_points=[(0,-.164,.665),(0,-.239,.596),(.012,-.283,.501),(.060,-.327,.395),(.153,-.356,.305),(.274,-.348,.237),(.379,-.315,.220),(.438,-.263,.236)]
def tail_weights(p):
 z=p.z
 if z>=.54:return {'tail_base':1}
 if z>=.43:
  t=(.54-z)/.11;return {'tail_base':1-t,'tail_mid':t}
 if z>=.34:return {'tail_mid':1}
 if z>=.28:
  t=(.34-z)/.06;return {'tail_mid':1-t,'tail_tip':t}
 return {'tail_tip':1}
tail= C.curve('Thin continuous segmented spare rat tail',tail_points,[.032,.030,.027,.024,.022,.018,.013,.006],15,'tail_base',0,n=12,steps=4,weights=tail_weights)
disk('Tail base padded attachment plate',(0,-.173,.665),.057,.041,0,'hips',1,n=22)
for x in [-.033,.033]:disk('Tail base attachment screw '+str(x),(x,-.199,.665),.006,.007,7,'hips',1,n=10)
for i in range(1,20):
 u=i/20*(len(tail_points)-1);k=min(int(u),len(tail_points)-2);f=u-k;p=Vector(tail_points[k]).lerp(Vector(tail_points[k+1]),f);tangent=(Vector(tail_points[k+1])-Vector(tail_points[k])).normalized()
 hint=Vector((1,0,0));a=tangent.cross(hint).normalized();b=tangent.cross(a).normalized();radius=.032*(1-i/24)+.002
 ring=[p+radius*(math.cos(math.tau*j/12)*a+math.sin(math.tau*j/12)*b) for j in range(13)]
 tube('Tail molded segment seam '+str(i),ring,.0016,5,'tail_base',n=5,weights=tail_weights)

# Preserve named editable islands and a single runtime skin.
pts=[v.co for ob in C.PARTS for v in ob.data.vertices];ground=min(v.z for v in pts);factor=1.70/(max(v.z for v in pts)-ground)
sources=bpy.data.collections.new('EDITABLE Golden spare rat original parts - excluded from GLB');sc.collection.children.link(sources);inventory=[];copies=[]
for ob in C.PARTS:
 for v in ob.data.vertices:v.co=Vector((v.co.x*factor,v.co.y*factor,(v.co.z-ground)*factor))
 ob.data.calc_loop_triangles();inventory.append({'name':ob.name,'triangles':len(ob.data.loop_triangles),'bone_groups':[g.name for g in ob.vertex_groups],'pigment_tile':ob.get('atlas_tile')})
 cp=ob.copy();cp.data=ob.data.copy();sc.collection.objects.link(cp);copies.append(cp)
 for col in list(ob.users_collection):col.objects.unlink(ob)
 sources.objects.link(ob)
sources.hide_render=True;sources.hide_viewport=True;bpy.ops.object.select_all(action='DESELECT')
for ob in copies:ob.select_set(True)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();skin=bpy.context.object;skin.name='Golden_After_Hours_Rat_Skin'
for tag in ['source_part','rigid_weight','atlas_tile']:
 if tag in skin:del skin[tag]
skin.data.calc_loop_triangles();before=len(skin.data.loop_triangles)
if before>14800:
 dec=skin.modifiers.new('Mobile silhouette preserving simplification','DECIMATE');dec.ratio=14700/before;dec.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=dec.name)
data=bpy.data.armatures.new('Original spare rat mechanical skeleton');arm=bpy.data.objects.new('Golden_After_Hours_Rat_Rig',data);sc.collection.objects.link(arm);skin.select_set(False);arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
def scaled(p):p=Vector(p);return Vector((p.x*factor,p.y*factor,(p.z-ground)*factor))
for name,(head,tail,parent) in REST.items():
 b=data.edit_bones.new(name);b.head=scaled(head);b.tail=scaled(tail)
 if name=='root':b.head=(0,0,0);b.tail=(0,0,.07*factor)
 if parent:b.parent=data.edit_bones[parent];b.use_connect=(b.head-b.parent.tail).length<.000001
 b.use_deform=name!='root' and not name.startswith('clavicle')
bpy.ops.object.mode_set(mode='OBJECT');mod=skin.modifiers.new('Padded shell islands, faceplate and attached weighted tail','ARMATURE');mod.object=arm;skin.parent=arm
arm['asset_id']='golden-after-hours-rat';arm['candidate']='v001 classic small spare shell studio candidate';arm['forward']='Blender +Y / glTF -Z';arm['neutral_total_height_m']=1.70;arm['attack_contact_fraction']=.625;arm['source_concept_sha256']=sc['source_concept_sha256']
bpy.context.view_layer.update();skin.data.calc_loop_triangles()
record={'asset_id':'golden-after-hours-rat','version':'v001','work_order':'WO104','authoring_model':'gpt-6-astra max','blender_version':bpy.app.version_string,'source_concept_sha256':sc['source_concept_sha256'],'source_concept_path':'docs/assets/media/rat-casino-ensemble/v003/construction/golden-after-hours-rat.png','source_prompt_sha256':'ccea7a5ea925079a97ba82fc4fc38c9830f5a2699245f44aa32ae31bc63b1e3a','source_prompt_path':'docs/assets/media/rat-casino-ensemble/v003/construction/golden-after-hours-rat-prompt.txt','ensemble_sha256':'df8b390adf7750a9a91ce63c13d2df5e033cb7e95c2b3975d6ddbac202439a9f','ensemble_path':'docs/assets/media/rat-casino-ensemble/v003/concept.png','spec':C.SPEC,'height_m':1.70,'construction_scale_factor':factor,'construction_ground_shift':ground,'triangles_before_export_simplification':before,'triangles':len(skin.data.loop_triangles),'vertices':len(skin.data.vertices),'material_count':len(skin.data.materials),'texture':{'file':'pigment.png','width':1024,'height':1024,'origin':'Original deterministic dusty mustard felt, cream faceplate and paw, muted ear cloth and worn tail pigment; no external texture.'},'bone_count':len(data.bones),'parts':inventory,'notes':['Compact 1.70 m spare shell clearly below the 2.15 m lead rat.','Original independent face and costume geometry; no lead-rat geometry copied.','Cream removable faceplate, pale replacement left paw, repaired left ear, short faded mustard waistcoat and tiny token-slot badge.','Thin continuous weighted tail remains attached through named base/mid/tip pivots.','One runtime skin with mechanically separate padded shell islands.','All geometry and pigment original; no franchise images, meshes, textures, logos or private media.']}
(ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n');(ROOT/'source/rig-rest.json').write_text(json.dumps({'rest':REST,'factor':factor,'ground':ground,'tail_points':tail_points},indent=2)+'\n')
for name in ['common.py','build.py']:
 block=bpy.data.texts.new('WO104 '+name);block.write((ROOT/'source'/name).read_text())
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'golden-after-hours-rat-construction.blend'),compress=True)
print(json.dumps({k:record[k] for k in ['triangles','triangles_before_export_simplification','vertices','height_m','material_count','bone_count']}))
