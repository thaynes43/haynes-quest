"""WO099 original worn Rat Casino mascot. Blender +Z up, +Y front.

Deterministic handcrafted geometry and felt atlas; v003 construction reference.
Previous v001 glamour geometry is deliberately not used. common.py supplies only
general mesh/UV helpers. Named source parts remain editable beside the skin.
"""
import bpy, math, json, hashlib, importlib.util, struct, zlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler
import numpy as np

ROOT=Path('/workspace/haynes-quest/rat-casino-cast/rat-pit-boss/v002')
assert bpy.context.scene.get('work_order')=='WO099'
assert bpy.context.scene.get('scene_lease')=='active'
spec=importlib.util.spec_from_file_location('wo099_common',ROOT/'source/common.py')
C=importlib.util.module_from_spec(spec);spec.loader.exec_module(C);C.BASE=ROOT.parent

def atlas():
 colors=['24231f','625f58','9b907e','531f27','783c3b','211f1c','a18b59','554c3d','c9b78f','785f55','141413','899084','dfd0ab','56534c','d4d1b7','956e5c']
 rng=np.random.default_rng(9902);pix=np.ones((1024,1024,4),dtype=np.float32)
 yy,xx=np.mgrid[0:256,0:256];indices=np.zeros((1024,1024),dtype=np.uint8);palette=[]
 for i,h in enumerate(colors):
  rgb=np.array([int(h[j:j+2],16)/255 for j in (0,2,4)])
  textile=i in (1,2,3,4,5,8,9,13,15)
  cloud=.022*np.sin(xx*.034+yy*.028)+.018*np.cos(xx*.076-yy*.029)
  grain=rng.integers(-4,5,(256,256))*.008 if textile else rng.integers(-1,2,(256,256))*.006
  weave=((xx%3==0)*.025+(yy%4==0)*.019) if textile else 0
  field=cloud+grain+weave
  if textile:
   for j in range(24):
    cx,cy=rng.uniform(0,256,2);sx,sy=rng.uniform(5,37,2)
    field+=rng.uniform(-.11,.055)*np.exp(-((xx-cx)/sx)**2-((yy-cy)/sy)**2)
   for j in range(48):
    cx,cy=rng.integers(4,249,2);length=int(rng.integers(2,13))
    field[cy:min(256,cy+length),cx:cx+1]+=.065
  tile=np.clip(rgb[None,None,:]+field[:,:,None],.01,.98)
  # Bounded color precision keeps the single noisy fabric atlas compact.
  tile=np.round(tile*63)/63
  levels=np.clip(np.round((field+.16)/.02),0,15).astype(np.uint8)
  for level in range(16):
   linear=np.clip(rgb+(-.16+level*.02),.01,.98)
   srgb=linear  # PNG bytes preserve the selected pigment's sRGB values.
   palette.extend(np.round(srgb*255).astype(np.uint8).tolist())
  row=3-i//4;col=i%4;pix[row*256:(row+1)*256,col*256:(col+1)*256,:3]=tile
  indices[row*256:(row+1)*256,col*256:(col+1)*256]=i*16+levels
 def chunk(name,data):
  return struct.pack('>I',len(data))+name+data+struct.pack('>I',zlib.crc32(name+data)&0xffffffff)
 raw=b''.join(b'\x00'+row.tobytes() for row in indices[::-1])
 png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1024,1024,8,3,0,0,0))+chunk(b'PLTE',bytes(palette))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
 (ROOT/'pigment.png').write_bytes(png)

atlas();C.setup('v002',2.15,1.25,2.0,[('Worn matte velour and cheap vest',.93,0),('Dark mechanical joints and glass',.62,.04)])
sc=bpy.context.scene
sc['work_order']='WO099';sc['scene_owner']='native Astra rat_pit_boss_classic';sc['scene_lease']='active'
sc['orientation']='Blender Z-up +Y forward; glTF Y-up -Z forward; identity floor root'
sc['candidate_status']='v002 corrected classic worn mascot; studio only; exact owner art review pending'
sc['source_concept_sha256']='b32b2f702e0912585199399e6f49b21be2080e06770ae04ddc3d93fc428caf3f'
sc['authoring_model']='gpt-6-astra max'
sc['source_collections']='One editable named-part collection plus final runtime skin'
for text in list(bpy.data.texts):
 if text.name.startswith(('WO098','WO099')):bpy.data.texts.remove(text)
for image in list(bpy.data.images):
 if image.users==0 and image.name not in ('Render Result','Viewer Node'):bpy.data.images.remove(image)
C.SPEC.update(asset_id='rat-pit-boss',version='v002',source_concept_sha256=sc['source_concept_sha256'])

def ell(name,p,s,col,bn='chest',mat=0,n=18,r=9,rot=(0,0,0)):
 return C.ellipsoid(name,p,s,col,bn,mat,n,r,rot)
def tube(name,points,radius,col,bn='chest',mat=0,n=10):
 return C.tube(name,points,radius,col,bn,mat,n)
def line(name,points,radius,col,bn='chest',mat=0,n=6):
 return C.curve(name,points,radius,col,bn,mat,n,steps=2)
def box(name,p,s,col,bn='chest',mat=0,bevel=.007,rot=(0,0,0)):
 return C.box(name,p,s,col,bn,bevel,2,mat,rot)
def disk(name,c,rad,depth,col,bn='chest',mat=0,n=12):
 return tube(name,[(c[0],c[1]-depth/2,c[2]),(c[0],c[1]+depth/2,c[2])],rad,col,bn,mat,n)
def zshape(name,rows,col,bn='chest',mat=0,n=24):
 return C.rings(name,[[(x+rx*math.cos(math.tau*i/n),y+ry*math.sin(math.tau*i/n),z) for i in range(n)] for z,x,y,rx,ry in rows],col,bn,mat)
def stitches(name,a,b,count,bn='chest',col=8,width=.014):
 a,b=Vector(a),Vector(b);d=(b-a).normalized();side=Vector((1,0,0)) if abs(d.x)<.8 else Vector((0,0,1))
 for j in range(count):
  p=a.lerp(b,(j+.5)/count);tube(name+' stitch '+str(j),[p-side*width/2,p+side*width/2],.0019,col,bn,n=5)
def patch(name,c,s,col,bn,back=False):
 x,y,z=c;w,h=s;sign=-1 if back else 1
 ob=C.prism(name,[(x-w*.5,z-h*.48),(x+w*.46,z-h*.5),(x+w*.5,z+h*.45),(x-w*.45,z+h*.5)],y,.007,col,bn,0,.002)
 stitches(name+' seam',(x-w*.36,y+sign*.006,z-h*.34),(x-w*.36,y+sign*.006,z+h*.34),4,bn,width=.015)
 stitches(name+' seam',(x+w*.36,y+sign*.006,z-h*.34),(x+w*.36,y+sign*.006,z+h*.34),4,bn,width=.015)
 return ob

# Broad, padded torso and a plain cheap burgundy vest. No coat tails or filigree.
ell('Patched padded hip shell',(0,-.015,.877),(.245,.16,.139),13,'hips',0,n=22,r=10)
ell('Padded felt torso under vest',(0,-.013,1.145),(.325,.23,.325),1,'chest',n=28,r=14)
zshape('Broad worn burgundy vest',[(.89,0,-.014,.245,.17),(.96,0,-.014,.285,.205),(1.12,0,-.012,.338,.243),(1.29,0,-.015,.327,.216),(1.405,0,-.028,.265,.153)],3)
def sewn_strip(name,rows,baseline,tile):
 verts=[];faces=[];cols=6;rr=len(rows);stride=(cols+1)*rr
 for depth in [-.007,.007]:
  for z,left,right in rows:
   for k in range(cols+1):verts.append((left+(right-left)*k/cols,baseline+depth,z))
 for layer in range(2):
  offset=layer*stride
  for j in range(rr-1):
   for k in range(cols):
    a=offset+j*(cols+1)+k;faces.append((a,a+1,a+cols+2,a+cols+1))
 outline=list(range(cols+1))+[j*(cols+1)+cols for j in range(1,rr)]+list(range((rr-1)*(cols+1)+cols-1,(rr-1)*(cols+1)-1,-1))+[j*(cols+1) for j in range(rr-2,0,-1)]
 for j,a in enumerate(outline):
  b=outline[(j+1)%len(outline)];faces.append((a,b,b+stride,a+stride))
 return C.mesh(name,verts,faces,tile,'chest')
sewn_strip('Stained triangular shirt insert',[(z,-(.055+(z-1.16)*.435),.055+(z-1.16)*.435) for z in [1.16,1.19,1.23,1.27,1.31,1.35,1.38,1.405]],.219,8)
for s in [-1,1]:
 sewn_strip('Plain vest facing '+str(s),[(z,s*a,s*b) for z,a,b in [(1.405,.13,.174),(1.37,.143,.208),(1.31,.112,.171),(1.24,.076,.134),(1.167,.046,.094)]],.24,4)
 line('Worn vest arm hole '+str(s),[(s*.273,-.02,1.414),(s*.326,.075,1.355),(s*.329,.11,1.267)],.008,4,n=6)
 line('Lower frayed vest seam '+str(s),[(0,.197,.93),(s*.16,.183,.925),(s*.279,.09,.968)],.004,4,n=5)
for z,y in [(1.13,.234),(1.028,.223),(.952,.191)]:
 disk('Plain dull vest button '+str(z),(0,y+.014,z),.011,.006,6,n=10)
for z in [1.34,1.285,1.23]:disk('Old shirt button '+str(z),(0,.24,z),.006,.004,0,n=8)
C.bow('Small faded burgundy bow tie',(0,.252,1.394),.12,3,'chest')
line('Crooked vest front closure',[(0,.204,.928),(-.009,.244,1.08),(0,.252,1.16)],.0026,13,n=5)
line('Back vest sewn center',[(0,-.186,.96),(0,-.263,1.13),(0,-.23,1.30),(0,-.18,1.398)],.0027,5,n=5)
stitches('Back repairs',(.006,-.267,1.12),(.009,-.23,1.28),7,width=.015)
patch('Crooked rear vest repair',(.18,-.203,1.019),(.105,.084),4,'chest',True)
box('Back vest adjuster strap',(0,-.257,1.113),(.31,.017,.039),4,bevel=.004)
for x in [-.136,.136]:disk('Back strap dull tack '+str(x),(x,-.27,1.113),.009,.008,6)
zshape('Recessed neck motor',[(1.37,0,0,.086,.08),(1.49,0,0,.083,.076)],0,'neck',1,n=16)
for z in [1.418,1.456]:C.ellipse_loop('Dark neck bearing '+str(z),(0,0,z),.086,.078,.008,13,'neck',1,n=20,tube_n=6)

# Rat head: long blunt muzzle, warm gray felt, asymmetric heavy glass eyes.
ell('Broad rat head felt shell',(0,-.006,1.673),(.204,.165,.216),1,'head',n=28,r=16)
ell('Right cheek felt shell',(-.132,.092,1.585),(.085,.106,.116),1,'head',n=20,r=10)
ell('Left cheek felt shell',(.13,.095,1.59),(.085,.105,.117),1,'head',n=20,r=10)
ell('Long blunt upper rat muzzle',(0,.18,1.579),(.139,.218,.092),2,'head',n=28,r=12)
ell('Dark open mouth cavity',(0,.177,1.493),(.145,.16,.064),10,'head',1,n=22,r=8)
ell('Separate padded lower jaw',(0,.174,1.45),(.136,.168,.05),1,'jaw',n=24,r=8)
ell('Worn lower mouth lip',(0,.258,1.463),(.116,.105,.024),2,'jaw',n=22,r=6)
ell('Large satin rat nose',(0,.383,1.6),(.062,.042,.041),5,'head',1,n=22,r=10)
for s in [-1,1]:
 ell('Small nose nostril '+str(s),(s*.028,.411,1.604),(.012,.005,.007),10,'head',1,n=10,r=5)
 # Uneven blunt teeth, two broad front incisors establish the rodent joke.
 box('Broad upper rat incisor '+str(s),(s*.019,.317,1.503),(.031,.027,.043),12,'head',0,.004,rot=(0,s*.06,0))
 for j in range(3):
  box('Side blunt tooth '+str(s)+' '+str(j),(s*(.058+j*.023),.292-j*.036,1.481),(.019,.022,.025-j*.002),8,'head',0,.003)
 for j in range(2):
  box('Lower blunt tooth '+str(s)+' '+str(j),(s*(.056+j*.03),.295-j*.035,1.474),(.018,.024,.024),8,'jaw',0,.003)
 disk('Dark jaw hinge '+str(s),(s*.151,.054,1.488),.025,.028,0,'jaw',1)
 for j in range(3):
  ell('Whisker socket '+str(s)+' '+str(j),(s*(.106+j*.013),.259-j*.027,1.601-j*.018),(.005,.004,.005),7,'head',n=8,r=4)
  line('Crooked worn whisker '+str(s)+' '+str(j),[(s*.11,.278-j*.027,1.585-j*.02),(s*.227,.303-j*.012,1.609-j*.031),(s*(.33+.016*j),.316,1.628-j*.066)],[.0023,.0018,.0009],7,'head',n=5)
 line('Temple sewn seam '+str(s),[(s*.157,.09,1.786),(s*.185,.084,1.681),(s*.195,.094,1.591)],.0029,7,'head',n=5)
 stitches('Cheek repair '+str(s),(s*.171,.146,1.609),(s*.177,.148,1.666),4,'head',width=.015)
line('Off center forehead seam',[(.012,.045,1.878),(.009,.126,1.79),(.012,.156,1.705),(.008,.295,1.642)],.0028,7,'head',n=5)
stitches('Forehead stitches',(.016,.128,1.794),(.016,.159,1.735),4,'head',width=.014)
line('Rear head service seam',[(0,-.113,1.508),(0,-.171,1.665),(0,-.12,1.804)],.003,7,'head',n=5)

for s in [-1,1]:
 x=s*.262;z=1.787+(s>0)*.015
 ell('Round padded rat ear '+str(s),(x,-.015,z),(.135,.046,.143),1,'head',n=24,r=12,rot=(0,s*-.18,0))
 ell('Recessed dusty rose ear '+str(s),(x,.025,z),(.103,.016,.11),9,'head',n=22,r=10)
 C.ellipse_loop('Worn ear cloth rim '+str(s),(x,.022,z),.126,.134,.009,13,'head',normal='y',n=32,tube_n=6)
 ell('Inner ear soft fold '+str(s),(x-s*.025,.042,z-.056),(.043,.014,.042),15,'head',n=14,r=6)
 for j in range(5):
  a=(.20+j*.49)+(s>0)*.07
  p=Vector((x+.13*math.cos(a),.031,z+.139*math.sin(a)))
  tube('Ear rim repair thread '+str(s)+' '+str(j),[p-Vector((.005,0,.003)),p+Vector((.005,0,.003))],.0023,8,'head',n=5)

for s in [-1,1]:
 x=s*.09;z=1.723+(s>0)*.007
 ell('Deep dark eye socket '+str(s),(x,.128,z),(.078,.049,.073),0,'head',1,n=22,r=12)
 ell('Old glass eye '+str(s),(x,.16,z),(.06,.036,.058),14,'head',1,n=24,r=12)
 ell('Faded gray green iris '+str(s),(x-s*.004,.194,z-.013),(.031,.009,.029),11,'head',1,n=20,r=10)
 ell('Round black pupil '+str(s),(x-s*.004,.202,z-.013),(.015,.005,.018),10,'head',1,n=16,r=8)
 ell('Small reflected glass light '+str(s),(x-.009,.207,z-.002),(.0043,.002,.0048),12,'head',1,n=8,r=4)
 # Half dome above the gaze makes a fixed lowered eyelid, not concert eyebrows.
 rr=[]
 for j in range(6):
  a=.05+j*(math.pi/2-.05)/5
  rr.append([(x+.072*math.cos(a)*math.cos(math.tau*k/20),.16+.046*math.cos(a)*math.sin(math.tau*k/20),z-.013+(.004 if s<0 else 0)+.070*math.sin(a)) for k in range(20)])
 C.rings('Heavy fabric upper eyelid '+str(s),rr,13,'head',0)
 line('Heavy lower eyelid rim '+str(s),[(x-.045,.181,z-.033),(x,.192,z-.041),(x+.045,.18,z-.031)],[.007,.01,.008],13,'head',n=7)
 line('Uneven wool brow '+str(s),[(x-s*.067,.12,z+.05),(x-s*.025,.146,z+.08),(x+s*.045,.115,z+.072)],[.018,.021,.016],1,'head',n=7)

# Plain battered hat with an original crescent token mark; no ornamental edging.
C.lathe('Bent soft top hat brim',(0,-.024,1.864),[(0,.205),(.015,.211),(.028,.18)],5,'head',0,n=28,ellipse=(1,.76))
hat=C.lathe('Battered old hat crown',(0,-.024,1.887),[(0,.135),(.04,.139),(.20,.159),(.239,.164),(.25,.154)],5,'head',0,n=28,ellipse=(1,.81))
for v in hat.data.vertices:
 z=v.co.z-1.887;v.co.x-=z*.09;v.co.z+=.004*math.sin(v.co.x*30+v.co.y*15)
C.lathe('Faded burgundy hat band',(0,-.024,1.888),[(0,.139),(.038,.142)],3,'head',0,n=28,ellipse=(1,.82))
line('Faded crescent token mark',[(-.013,.116,2.073),(-.042,.106,2.066),(-.052,.107,2.038),(-.038,.11,2.014),(-.014,.116,2.013)],.008,6,'head',n=6)
for x,z in [(-.094,2.09),(.076,2.048),(.109,2.094),(-.087,1.964)]:
 line('Hat worn repair '+str(x),[(x,.102,z),(x+.007,.109,z-.024),(x+.017,.112,z-.037)],.0019,7,'head',n=5)

REST={'root':((0,0,0),(0,0,.075),None),'hips':((0,0,.88),(0,0,1.04),'root'),'chest':((0,0,1.04),(0,0,1.38),'hips'),'neck':((0,0,1.38),(0,0,1.49),'chest'),'head':((0,0,1.49),(0,0,1.76),'neck'),'jaw':((0,.059,1.493),(0,.27,1.463),'head')}

for label,s in [('R',-1),('L',1)]:
 shoulder=Vector((s*.326,-.012,1.359));elbow=Vector((s*.439,.001,1.128));wrist=Vector((s*.515,.041,.919))
 REST['clavicle_'+label]=((0,0,1.36),tuple(shoulder),'chest')
 REST['upper_arm_'+label]=(tuple(shoulder),tuple(elbow),'clavicle_'+label)
 REST['forearm_'+label]=(tuple(elbow),tuple(wrist),'upper_arm_'+label)
 REST['hand_'+label]=(tuple(wrist),tuple(wrist+Vector((s*.014,.012,-.112))),'forearm_'+label)
 ell(label+' dark shoulder motor',shoulder,(.077,.077,.079),0,'upper_arm_'+label,1)
 tube(label+' padded upper arm',[shoulder.lerp(elbow,.065),shoulder.lerp(elbow,.28),shoulder.lerp(elbow,.67),shoulder.lerp(elbow,.88)],[.096,.105,.096,.079],1,'upper_arm_'+label,n=18)
 ell(label+' recessed elbow bearing',elbow,(.064,.064,.061),0,'forearm_'+label,1,n=16,r=8)
 disk(label+' elbow service pin',(elbow.x,elbow.y+.061,elbow.z),.024,.009,13,'forearm_'+label,1)
 tube(label+' thick velour forearm',[elbow.lerp(wrist,.13),elbow.lerp(wrist,.25),elbow.lerp(wrist,.72),elbow.lerp(wrist,.9)],[.078,.093,.09,.066],1,'forearm_'+label,n=18)
 line(label+' worn forearm split',[elbow.lerp(wrist,.24)+Vector((0,.09,0)),elbow.lerp(wrist,.71)+Vector((0,.089,0))],.0033,7,'forearm_'+label,n=5)
 ell(label+' dark wrist coupling',wrist,(.049,.042,.039),0,'hand_'+label,1,n=14,r=6)
 palm=wrist+Vector((s*.01,.024,-.064))
 ell(label+' broad padded hand',palm,(.074,.052,.073),1,'hand_'+label,n=20,r=10)
 if s>0:
  for j in range(4):
   x=palm.x-.051+j*.032
   line('L stiff curled finger '+str(j),[(x,.074,.832),(x+.005,.087,.788),(x+.005,.119,.794)],[.018,.019,.014],1,'hand_L',n=8)
   ell('L finger joint '+str(j),(x+.005,.089,.807),(.019,.022,.018),13,'hand_L',1,n=10,r=5)
  line('L padded thumb',[(.459,.076,.871),(.448,.128,.833),(.469,.145,.816)],[.025,.023,.017],1,'hand_L',n=8)
 else:
  # Gripping a single detachable die: fingers sit beside/below, not through it.
  for j in range(3):
   x=-.565+j*.031
   line('R folded die gripping finger '+str(j),[(x,.104,.826),(x,.146,.794),(x,.197,.815)],[.018,.019,.013],1,'hand_R',n=8)
  line('R raised gripping thumb',[(-.474,.067,.869),(-.454,.136,.872),(-.481,.175,.893)],[.025,.022,.016],1,'hand_R',n=8)
  line('R outer curved finger',[(-.584,.081,.868),(-.610,.145,.852),(-.592,.184,.853)],[.018,.018,.013],1,'hand_R',n=8)
 hip=Vector((s*.16,-.019,.897));knee=Vector((s*.20,.014,.546));ankle=Vector((s*.215,.012,.162))
 REST['thigh_'+label]=(tuple(hip),tuple(knee),'hips');REST['shin_'+label]=(tuple(knee),tuple(ankle),'thigh_'+label);REST['foot_'+label]=(tuple(ankle),(s*.215,.21,.103),'shin_'+label)
 ell(label+' recessed hip ball',hip,(.091,.091,.087),0,'thigh_'+label,1)
 tube(label+' broad padded thigh',[hip.lerp(knee,.065),hip.lerp(knee,.29),hip.lerp(knee,.69),hip.lerp(knee,.87)],[.106,.127,.122,.096],1,'thigh_'+label,n=20)
 line(label+' thigh sewn split',[hip.lerp(knee,.23)+Vector((0,.123,0)),hip.lerp(knee,.78)+Vector((0,.11,0))],.003,7,'thigh_'+label,n=5)
 ell(label+' dark knee bearing',knee,(.083,.074,.073),0,'shin_'+label,1,n=18,r=8)
 disk(label+' knee service pin',(knee.x,knee.y+.075,knee.z),.035,.011,13,'shin_'+label,1)
 tube(label+' thick padded shin',[knee.lerp(ankle,.14),knee.lerp(ankle,.28),knee.lerp(ankle,.76),knee.lerp(ankle,.92)],[.09,.113,.119,.091],1,'shin_'+label,n=20)
 line(label+' shin sewn split',[knee.lerp(ankle,.23)+Vector((0,.11,0)),knee.lerp(ankle,.84)+Vector((0,.113,0))],.0033,7,'shin_'+label,n=5)
 ell(label+' ankle coupling',ankle,(.069,.067,.048),0,'foot_'+label,1)
 box(label+' flat rubber foot sole',(s*.215,.064,.022),(.295,.365,.044),5,'foot_'+label,bevel=.014)
 ell(label+' broad velour foot',(s*.215,.047,.087),(.148,.17,.079),1,'foot_'+label,n=24,r=10)
 for j in [-1,0,1]:
  ell(label+' oversized rounded rat toe '+str(j),(s*.215+j*.094,.20,.072),(.06,.088,.055),1,'foot_'+label,n=16,r=8)
  ell(label+' dull short rat claw '+str(j),(s*.215+j*.094,.269,.056),(.021,.027,.022),2,'foot_'+label,n=12,r=6)
for label,s in [('R',-1),('L',1)]:
 stitches(label+' shin coarse repair',(s*.212,.128,.26),(s*.206,.125,.439),7,'shin_'+label,col=8,width=.018)
 stitches(label+' upper sleeve repair',(s*.37,.092,1.287),(s*.413,.094,1.191),5,'upper_arm_'+label,col=8,width=.019)
 line(label+' foot sewn toe divide',[(s*.215,.213,.119),(s*.215,.098,.158)],.0027,7,'foot_'+label,n=5)
patch('Left thigh sewn felt repair',(.215,.124,.716),(.109,.112),13,'thigh_L')
patch('Right forearm mismatched repair',(-.478,.095,1.011),(.084,.092),13,'forearm_R')

die=(-.54,.18,.862)
REST['prop_die']=(die,(-.54,.18,.95),'hand_R')
box('DETACHABLE original ivory dice token',die,(.119,.119,.119),8,'prop_die',bevel=.011)
for dx,dz in [(-.03,-.03),(.03,-.03),(0,0),(-.03,.03),(.03,.03)]:
 disk('Die front recessed dark pip '+str(dx)+' '+str(dz),(die[0]+dx,die[1]+.0601,die[2]+dz),.009,.0015,10,'prop_die',1,n=10)
for dy,dz in [(-.027,-.03),(.027,.03),(0,0)]:
 ell('Die side pip '+str(dy),(die[0]-.0601,die[1]+dy,die[2]+dz),(.001,.009,.009),10,'prop_die',1,n=10,r=5)
for dx,dy in [(-.028,-.027),(.028,.027)]:
 ell('Die top pip '+str(dx),(die[0]+dx,die[1]+dy,die[2]+.0601),(.009,.009,.001),10,'prop_die',1,n=10,r=5)

# Hanging segmented tail, clear of the legs and floor, with a bent tip.
tailpts=[(0,-.174,.9),(.05,-.285,.758),(.143,-.333,.558),(.258,-.34,.345),(.39,-.33,.209),(.499,-.318,.173),(.572,-.3,.207)]
REST['tail_1']=(tailpts[0],tailpts[2],'hips');REST['tail_2']=(tailpts[2],tailpts[4],'tail_1');REST['tail_3']=(tailpts[4],tailpts[6],'tail_2')
for j in range(3):
 a=j*2;line('Soft segmented tail '+str(j),tailpts[a:a+3],[.035-j*.008,.032-j*.008,.027-j*.008],15,'tail_'+str(j+1),n=12)
 for k in range(2):
  p=Vector(tailpts[a+k]);q=Vector(tailpts[a+k+1]);d=(q-p).normalized()
  for f in [.27,.66]:
   c=p.lerp(q,f);tube('Dark tail segmentation '+str(j)+str(k)+str(f),[c-d*.003,c+d*.003],.034-j*.008-k*.003,7,'tail_'+str(j+1),n=10)

# Fit sewn front clothing to the curved vest, including the back of each slab.
def vest_front(x,z):
 rows=[(.89,.245,.17),(.96,.285,.205),(1.12,.338,.243),(1.29,.327,.216),(1.405,.265,.153)]
 z=max(rows[0][0],min(rows[-1][0],z))
 for (za,xa,ya),(zb,xb,yb) in zip(rows,rows[1:]):
  if z<=zb:
   t=(z-za)/(zb-za);rx=xa+(xb-xa)*t;ry=ya+(yb-ya)*t
   return -.018+ry*math.sqrt(max(.02,1-(x/rx)**2))
for ob in C.PARTS:
 baseline=None;offset=.012
 if ob.name=='Stained triangular shirt insert':baseline=.219
 elif ob.name.startswith('Plain vest facing'):baseline=.24;offset=.021
 elif ob.name.startswith('Old shirt button'):baseline=.24;offset=.027
 elif ob.name.startswith('Small faded burgundy bow tie'):baseline=.252;offset=.042
 if baseline is not None:
  for v in ob.data.vertices:v.co.y=vest_front(v.co.x,v.co.z)+(v.co.y-baseline)+offset

# Floor-centered identity rig and edit-friendly source collection.
pts=[v.co for ob in C.PARTS for v in ob.data.vertices];lo=min(v.z for v in pts);factor=2.15/(max(v.z for v in pts)-lo)
sources=bpy.data.collections.new('EDITABLE original parts - excluded from export');sc.collection.children.link(sources)
inventory=[];copies=[]
for ob in C.PARTS:
 for v in ob.data.vertices:v.co=Vector((v.co.x*factor,v.co.y*factor,(v.co.z-lo)*factor))
 ob.data.calc_loop_triangles();inventory.append({'name':ob.name,'triangles':len(ob.data.loop_triangles),'bone_groups':[g.name for g in ob.vertex_groups],'pigment_tile':ob.get('atlas_tile')})
 cp=ob.copy();cp.data=ob.data.copy();sc.collection.objects.link(cp);copies.append(cp)
 for col in list(ob.users_collection):col.objects.unlink(ob)
 sources.objects.link(ob)
sources.hide_render=True;sources.hide_viewport=True
bpy.ops.object.select_all(action='DESELECT')
for ob in copies:ob.select_set(True)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();skin=bpy.context.object;skin.name='Rat_Pit_Boss_Skin'
for tag in ['source_part','rigid_weight','atlas_tile']:
 if tag in skin:del skin[tag]
skin.data.calc_loop_triangles()
if len(skin.data.loop_triangles)>14800:
 dec=skin.modifiers.new('Mobile silhouette preserving simplification','DECIMATE');dec.ratio=14700/len(skin.data.loop_triangles);dec.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=dec.name)
data=bpy.data.armatures.new('Rat Pit Boss segmented cloth mascot skeleton');arm=bpy.data.objects.new('Rat_Pit_Boss_Rig',data);sc.collection.objects.link(arm)
skin.select_set(False);arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
def scaled(p):
 p=Vector(p);return Vector((p.x*factor,p.y*factor,(p.z-lo)*factor))
for name,(head,tail,parent) in REST.items():
 b=data.edit_bones.new(name);b.head=scaled(head);b.tail=scaled(tail)
 if name=='root':b.head=(0,0,0);b.tail=(0,0,.075*factor)
 if parent:b.parent=data.edit_bones[parent];b.use_connect=(b.head-b.parent.tail).length<.000001
 b.use_deform=name!='root' and not name.startswith('clavicle')
bpy.ops.object.mode_set(mode='OBJECT')
mod=skin.modifiers.new('One influence per articulated shell part','ARMATURE');mod.object=arm;skin.parent=arm
arm['asset_id']='rat-pit-boss';arm['candidate']='v002 classic worn mascot - studio only';arm['forward']='Blender +Y / glTF -Z';arm['neutral_total_height_m']=2.15
arm['attack_contact_fraction']=.625;arm['source_concept_sha256']=sc['source_concept_sha256']
bpy.context.view_layer.update();skin.data.calc_loop_triangles()
record={'asset_id':'rat-pit-boss','version':'v002','work_order':'WO099','authoring_model':'gpt-6-astra max','blender_version':bpy.app.version_string,'source_concept_sha256':sc['source_concept_sha256'],'ensemble_sha256':'df8b390adf7750a9a91ce63c13d2df5e033cb7e95c2b3975d6ddbac202439a9f','spec':C.SPEC,'height_m':2.15,'construction_scale_factor':factor,'construction_ground_shift':lo,'triangles':len(skin.data.loop_triangles),'vertices':len(skin.data.vertices),'material_count':len(skin.data.materials),'texture':{'file':'pigment.png','width':1024,'height':1024,'origin':'Original deterministic velour pigment, no external textures.'},'bone_count':len(data.bones),'parts':inventory,'notes':['Broad padded body and limbs; plain faded vest; dark joints; heavy glass eyes.','Original v003 silhouette; no geometry from paused v001 reused.','One rigid influence per vertex preserves mechanical shell segmentation.','Die has its own child bone and editable source object; no cane.','Neutral A pose; GLB facing -Z with unit scale and floor origin.']}
(ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n')
(ROOT/'source/rig-rest.json').write_text(json.dumps({'rest':REST,'factor':factor,'ground':lo},indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'rat-pit-boss-construction.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(ROOT/'rat-pit-boss-checkpoint.glb'),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_yup=True,export_apply=False,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=False)
print(json.dumps({k:record[k] for k in ['triangles','vertices','height_m','material_count','bone_count']}))
