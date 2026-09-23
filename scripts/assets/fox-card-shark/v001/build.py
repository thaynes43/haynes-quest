"""WO102 original worn russet fox dealer; Blender +Z up / +Y forward.

The selected v003 turnaround supplies direction. Geometry, tactile atlas and
rig are original procedural authoring, with separate editable source pieces.
"""
import bpy, math, json, hashlib, importlib.util, struct, zlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler
import numpy as np
ROOT=Path('/workspace/haynes-quest/rat-casino-cast/fox-card-shark/v001')
assert bpy.context.scene.get('work_order')=='WO102' and bpy.context.scene.get('scene_lease')=='active'
spec=importlib.util.spec_from_file_location('wo102_common',ROOT/'source/common.py')
C=importlib.util.module_from_spec(spec);spec.loader.exec_module(C);C.BASE=ROOT.parent

def atlas():
 colors=['20211e','88482d','a45d38','b8a080','283d30','65553e','272920','8c7c59','b8aa86','6f7757','11140f','bfb18c','583721','bf9b6b','d8c59b','7e3330']
 rng=np.random.default_rng(10201);indices=np.zeros((1024,1024),dtype=np.uint8);palette=[]
 yy,xx=np.mgrid[0:256,0:256]
 for i,h in enumerate(colors):
  rgb=np.array([int(h[j:j+2],16)/255 for j in (0,2,4)]);fabric=i in (1,2,3,4,5,8,12,13)
  field=.013*np.sin(xx*.059+yy*.019)+.009*np.cos(xx*.031-yy*.049)
  field+=rng.integers(-3,4,(256,256))*(.006 if fabric else .003)
  if fabric:
   field+=(xx%3==0)*.014+(yy%4==0)*.011
   for j in range(60):
    cx,cy=rng.uniform(0,256,2);sx,sy=rng.uniform(3,25,2)
    field+=rng.uniform(-.14,.035)*np.exp(-((xx-cx)/sx)**2-((yy-cy)/sy)**2)
   for j in range(80):
    cx,cy=rng.integers(3,247,2);length=int(rng.integers(2,8));field[cy:min(256,cy+length),cx:cx+1]+=.10
  else:
   for j in range(24):
    cx,cy=rng.integers(2,249,2);length=int(rng.integers(2,8));field[cy:cy+1,cx:min(256,cx+length)]+=.045
  levels=np.clip(np.round((field+.12)/.017),0,15).astype(np.uint8)
  for level in range(16):palette.extend(np.round(np.clip(rgb+(-.12+level*.017),.01,.97)*255).astype(np.uint8).tolist())
  row=3-i//4;col=i%4;indices[row*256:(row+1)*256,col*256:(col+1)*256]=i*16+levels
 def chunk(name,data):return struct.pack('>I',len(data))+name+data+struct.pack('>I',zlib.crc32(name+data)&0xffffffff)
 raw=b''.join(b'\x00'+row.tobytes() for row in indices[::-1]);png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1024,1024,8,3,0,0,0))+chunk(b'PLTE',bytes(palette))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
 (ROOT/'pigment.png').write_bytes(png)
atlas();C.setup('v001',1.80,1.25,2,[('Matte russet fabric, faded green vest and worn cards',.96,0),('Dull old glass, nose and mechanical joints',.59,.04)])
sc=bpy.context.scene;sc['work_order']='WO102';sc['scene_owner']='/root/fox_classic_blender';sc['scene_lease']='active';sc['orientation']='Blender +Z up/+Y forward; glTF +Y up/-Z forward; stationary identity floor root'
sc['candidate_status']='Fox Card Shark v001 studio candidate; Tom exact-version review pending';sc['source_concept_sha256']='37a5e7f947693331eba472eb8d6e391837bfa82075e8df266345cd7bf05f46e2';sc['authoring_model']='gpt-6-astra max'
for t in list(bpy.data.texts):bpy.data.texts.remove(t)
for im in list(bpy.data.images):
 if im.users==0 and im.name not in ('Render Result','Viewer Node'):bpy.data.images.remove(im)
C.SPEC.update(asset_id='fox-card-shark',version='v001',source_concept_sha256=sc['source_concept_sha256'])

def ell(name,p,s,col,bn='chest',mat=0,n=20,r=10,rot=(0,0,0)):return C.ellipsoid(name,p,s,col,bn,mat,n,r,rot)
def tube(name,points,radius,col,bn='chest',mat=0,n=10):return C.tube(name,points,radius,col,bn,mat,n)
def line(name,points,radius,col,bn='chest',mat=0,n=6):return C.curve(name,points,radius,col,bn,mat,n,steps=3)
def box(name,p,s,col,bn='chest',mat=0,bevel=.005,rot=(0,0,0)):return C.box(name,p,s,col,bn,bevel,2,mat,rot)
def disk(name,c,rad,depth,col,bn='chest',mat=0,n=12):return tube(name,[(c[0],c[1]-depth/2,c[2]),(c[0],c[1]+depth/2,c[2])],rad,col,bn,mat,n)
def stitches(name,a,b,count,bn='chest',col=13,width=.011):
 a,b=Vector(a),Vector(b);d=(b-a).normalized();side=Vector((1,0,0)) if abs(d.x)<.8 else Vector((0,0,1))
 for j in range(count):
  p=a.lerp(b,(j+.5)/count);tube(name+' stitch '+str(j),[p-side*width/2,p+side*width/2],.00165,col,bn,n=5)
def patch(name,c,s,col,bn,back=False):
 x,y,z=c;w,h=s;sign=-1 if back else 1
 C.prism(name,[(x-w*.5,z-h*.48),(x+w*.46,z-h*.5),(x+w*.5,z+h*.45),(x-w*.45,z+h*.5)],y,.006,col,bn,0,.002)
 for side in [-1,1]:stitches(name,(x+side*w*.37,y+sign*.005,z-h*.37),(x+side*w*.37,y+sign*.005,z+h*.37),4,bn,width=.014)

def spade(name,x,y,z,size,col,bn='chest'):
 points=[(0,1),(-.8,.20),(-.9,-.15),(-.65,-.44),(-.26,-.42),(-.12,-.22),(-.25,-.72),(.25,-.72),(.12,-.22),(.26,-.42),(.65,-.44),(.9,-.15),(.8,.20)]
 return C.prism(name,[(x+a*size,z+b*size) for a,b in points],y,.0015,col,bn,0,0)

REST={'root':((0,0,0),(0,0,.08),None),'hips':((0,0,.67),(0,0,.83),'root'),'chest':((0,0,.83),(0,0,1.20),'hips'),'neck':((0,0,1.20),(0,0,1.285),'chest'),'head':((0,0,1.285),(0,0,1.475),'neck'),'jaw':((0,.17,1.30),(0,.36,1.28),'head')}
for label,s in [('R',-1),('L',1)]:
 shoulder=(s*.284,0,1.166);elbow=(s*.37,.020,.945);wrist=(s*.40,.275,.905) if s>0 else (s*.42,.075,.715)
 REST['clavicle_'+label]=((s*.13,0,1.17),shoulder,'chest');REST['upper_arm_'+label]=(shoulder,elbow,'clavicle_'+label);REST['forearm_'+label]=(elbow,wrist,'upper_arm_'+label);REST['hand_'+label]=(wrist,(wrist[0],wrist[1]+.07,wrist[2]),'forearm_'+label)
 hip=(s*.145,0,.67);knee=(s*.155,.015,.405);ankle=(s*.162,.02,.125)
 REST['thigh_'+label]=(hip,knee,'hips');REST['shin_'+label]=(knee,ankle,'thigh_'+label);REST['foot_'+label]=(ankle,(s*.162,.20,.125),'shin_'+label)
 REST['ear_'+label]=((s*.15,-.007,1.60),(s*.315,.003,1.82),'head')
REST['tail_base']=((0,-.15,.716),(-.075,-.405,.49),'hips')
REST['tail_tip']=((-.075,-.405,.49),(-.16,-.485,.195),'tail_base')
REST['prop_cards']=((.40,.275,.905),(.40,.275,1.15),'hand_L')

# Padded weight and sag; simple dark gaps at joints, no ornamented armor.
ell('Sturdy slightly hunched russet torso',(0,-.024,.998),(.279,.206,.283),1,n=28,r=16)
ell('Brown repaired round hip shell',(0,-.025,.700),(.239,.177,.128),12,'hips',n=24,r=12)
ell('Faded cream torso shirt panel',(0,.158,1.005),(.116,.047,.237),3,n=24,r=14)
line('Shirt worn center seam',[(0,.189,.8),(0,.213,1.005),(0,.168,1.20)],.002,12,n=5)
for z,y in [(.89,.202),(1.015,.212),(1.125,.201)]:disk('Faded shirt button '+str(z),(0,y,z),.007,.006,6,mat=1,n=10)
ell('Neck old black coupling',(0,-.018,1.246),(.069,.060,.063),0,'neck',1,n=18,r=8)
for z in [1.215,1.277]:C.ellipse_loop('Neck old bearing '+str(z),(0,-.018,z),.069,.060,.005,7,'neck',1,n=18,tube_n=6)
for label,s in [('R',-1),('L',1)]:
 shoulder=Vector(REST['upper_arm_'+label][0]);elbow=Vector(REST['forearm_'+label][0]);wrist=Vector(REST['hand_'+label][0]);up=(elbow-shoulder).normalized();lowarm=(wrist-elbow).normalized()
 ell(label+' shoulder exposed bearing',shoulder,(.064,.064,.064),0,'upper_arm_'+label,1,n=16,r=8)
 tube(label+' padded upper arm',[shoulder+up*.032,shoulder.lerp(elbow,.48),elbow-up*.038],[.076,.092,.073],1,'upper_arm_'+label,n=18)
 ell(label+' elbow dark coupling',elbow,(.057,.054,.053),0,'forearm_'+label,1,n=16,r=8)
 disk(label+' worn elbow pivot',(elbow.x,elbow.y+.05,elbow.z),.025,.013,7,'forearm_'+label,1,n=12)
 tube(label+' broad patched forearm',[elbow+lowarm*.039,elbow.lerp(wrist,.48),wrist-lowarm*.035],[.073,.083,.056],1,'forearm_'+label,n=18)
 ell(label+' wrist dark coupling',wrist,(.044,.044,.037),0,'hand_'+label,1,n=14,r=8)
 if s<0:
  ell('Free padded hand',(wrist.x,wrist.y+.025,wrist.z-.066),(.069,.054,.078),5,'hand_R',n=18,r=10)
  for j in range(3):
   x=wrist.x+(j-1)*.037;ell('Free hand finger '+str(j),(x,wrist.y+.045,wrist.z-.133),(.021,.026,.043),5,'hand_R',n=12,r=8)
   box('Free hand finger seam '+str(j),(x,wrist.y+.071,wrist.z-.133),(.029,.003,.004),6,'hand_R',1,bevel=.001)
  ell('Free glove thumb',(wrist.x+.060,wrist.y+.047,wrist.z-.058),(.027,.028,.044),5,'hand_R',n=12,r=8,rot=(0,-.3,0))
 else:
  ell('Card gripping palm',(wrist.x,wrist.y+.035,wrist.z),(.069,.052,.067),5,'hand_L',n=18,r=10)
  for j in range(3):
   ell('Card gripping curled finger '+str(j),(wrist.x+.013+(j-1)*.033,wrist.y+.081,wrist.z+.014),(.020,.023,.029),5,'hand_L',n=12,r=8)
  ell('Card gripping thumb',(wrist.x-.049,wrist.y+.061,wrist.z+.047),(.025,.027,.038),5,'hand_L',n=12,r=8,rot=(0,-.65,0))
  disk('Old glove knuckle tack',(wrist.x+.052,wrist.y+.071,wrist.z-.027),.008,.004,7,'hand_L',1,n=10)
 line(label+' upper arm repaired front seam',[shoulder+up*.048+Vector((0,.073,0)),elbow-up*.062+Vector((0,.070,0))],.0022,12,'upper_arm_'+label,n=5)
 stitches(label+' shoulder panel repair',shoulder+up*.075+Vector((0,.082,0)),elbow-up*.065+Vector((0,.078,0)),5,'upper_arm_'+label,width=.011)
 hip=Vector(REST['thigh_'+label][0]);knee=Vector(REST['shin_'+label][0]);ankle=Vector(REST['foot_'+label][0])
 ell(label+' hip dark joint',hip,(.070,.07,.065),0,'thigh_'+label,1,n=16,r=8)
 tube(label+' thick padded thigh',[hip+Vector((0,0,-.028)),hip.lerp(knee,.5),knee+Vector((0,0,.044))],[.098,.107,.075],1,'thigh_'+label,n=20)
 ell(label+' knee black bearing',knee,(.064,.057,.056),0,'shin_'+label,1,n=16,r=8)
 disk(label+' knee worn pivot',(knee.x,knee.y+.055,knee.z),.028,.009,7,'shin_'+label,1,n=12)
 tube(label+' sturdy lower leg',[knee+Vector((0,0,-.045)),knee.lerp(ankle,.5),ankle+Vector((0,0,.031))],[.077,.090,.064],1,'shin_'+label,n=18)
 ell(label+' ankle bearing',ankle,(.049,.047,.039),0,'foot_'+label,1,n=14,r=8)
 ell(label+' broad padded foot',(s*.162,.083,.072),(.113,.158,.072),5,'foot_'+label,n=24,r=10)
 for j in range(3):
  x=s*.162+(j-1)*.067;ell(label+' foot padded toe '+str(j),(x,.193,.055),(.041,.065,.052),5,'foot_'+label,n=14,r=8)
  ell(label+' blunt worn toe claw '+str(j),(x,.246,.048),(.014,.023,.024),7,'foot_'+label,1,n=12,r=8)
 line(label+' shin repaired seam',[(s*.193,.083,.32),(s*.195,.095,.25),(s*.19,.082,.18)],.0021,12,'shin_'+label,n=5)
 stitches(label+' lower leg stitches',(s*.195,.093,.22),(s*.192,.095,.30),5,'shin_'+label,width=.013)
patch('One faded thigh patch',(-.16,.103,.553),(.076,.10),2,'thigh_R')

# Continuous dark-green old vest, with front opening and broad back.
def vest_y(x,z,front=True):
 rz=max(.15,1-((z-.998)/.314)**2);ry=.212*math.sqrt(max(.05,rz-(x/.306)**2))
 return -.024+(ry if front else -ry)
# Wrap the sides and back using rings from right front to left front.
rr=[]
for z,rx,ry in [(.792,.232,.165),(.84,.277,.205),(.99,.288,.217),(1.13,.251,.195),(1.22,.189,.130)]:
 rr.append([(rx*math.cos(a),-.024+ry*math.sin(a),z) for a in np.linspace(.51,math.pi*2+math.pi-.51,35)])
# The wrapped region avoids the central opening at +Y.
rr=[]
for z,rx,ry in [(.798,.232,.165),(.85,.272,.207),(.995,.288,.217),(1.13,.257,.197),(1.22,.190,.129)]:
 rr.append([(rx*math.cos(a),-.024+ry*math.sin(a),z) for a in np.linspace(math.pi-.56,math.tau+.56,31)])
verts=[p for row in rr for p in row];faces=[]
for j in range(4):
 for i in range(30):a=j*31+i;faces.append((a,a+1,a+32,a+31))
C.mesh('Plain green vest continuous sides and broad back',verts,faces,4,smooth=True)
# Front panels follow the padded body and end in a mild worn hem.
for s in [-1,1]:
 rows=[]
 for z,outer,inner in [(.786,.207,.047),(.84,.242,.012),(.985,.263,.018),(1.102,.228,.069),(1.218,.159,.101)]:
  rows.append([(s*(inner+(outer-inner)*u),vest_y(inner+(outer-inner)*u,z)+.043,z) for u in np.linspace(0,1,7)])
 faces=[]
 for j in range(4):
  for i in range(6):a=j*7+i;faces.append((a,a+1,a+8,a+7))
 C.mesh('Worn green front vest panel '+str(s),[p for row in rows for p in row],faces,4,smooth=True)
 edge=[row[0] for row in rows];line('Simple folded vest edge '+str(s),edge,.005,4,n=5)
 # Broad, simple folded lapel with no tails or filigree.
 poly=[(s*.100,1.220),(s*.160,1.204),(s*.120,1.080),(s*.065,1.043)]
 C.mesh('Flat old dealer lapel '+str(s),[(x,vest_y(x,z)+.048,z) for x,z in poly],[(0,1,2,3)],4,smooth=False)
for z in [.848,.928,1.008]:disk('Dull green vest button '+str(z),(.022,vest_y(.022,z)+.050,z),.010,.007,7,mat=1,n=10)
line('Vest back middle seam',[(0,-.156,1.216),(0,-.223,1.13),(0,-.245,.995),(0,-.231,.85),(0,-.193,.798)],.0025,6,n=5)
box('Small old vest rear adjustment strap',(0,-.241,.881),(.138,.015,.037),4,bevel=.005)
for x in [-.052,.052]:disk('Rear adjustment tack '+str(x),(x,-.250,.881),.008,.008,7,mat=1,n=10)
# Original faded token patch, one simple spade on the upper left panel.
spade('Faded original spade token patch',.153,vest_y(.153,1.092)+.052,1.092,.036,8)

# Long blunt fox head, tired glass eyes, separate mechanical lower jaw.
ell('Russet fox broad main head',(0,-.005,1.442),(.232,.179,.235),1,'head',n=32,r=18)
for s in [-1,1]:
 ell('Side cheek padded russet lobe '+str(s),(s*.19,.046,1.387),(.095,.105,.122),1,'head',n=20,r=10)
 # Small broad tufts change the outline without fur cards or transparency.
 for j in range(3):
  z=1.40-j*.052
  C.prism('Shabby cheek silhouette tuft '+str(s)+str(j),[(s*.197,z+.043),(s*(.287-j*.008),z-.015),(s*.198,z-.027)],.014,.088,1,'head',0,.009)
 ell('Dark tired eye socket '+str(s),(s*.105,.149,1.485),(.080,.049,.089),12,'head',n=24,r=12)
 ell('Dull old ivory glass eye '+str(s),(s*.106,.183,1.481),(.058,.041,.064),11,'head',1,n=24,r=12)
 ell('Muted olive iris '+str(s),(s*.102,.220,1.473),(.028,.009,.032),9,'head',1,n=20,r=10)
 ell('Small still pupil '+str(s),(s*.100,.227,1.474),(.012,.006,.021),10,'head',1,n=14,r=8)
 ell('Faint eye pin highlight '+str(s),(s*.105-.006,.232,1.484),(.004,.0018,.004),14,'head',1,n=8,r=5)
 # A true upper cap occludes the upper eye and makes the tired expression.
 pts=[];rows=6;n=18
 for j in range(rows):
  a=.045+(.5*math.pi-.045)*j/(rows-1)
  pts.append([(s*.105+.066*math.cos(a)*math.cos(math.tau*k/n),.184+.045*math.cos(a)*math.sin(math.tau*k/n),1.486+.075*math.sin(a)) for k in range(n)])
 C.rings('Heavy half-lowered russet eyelid '+str(s),pts,1,'head',caps=True)
 line('Tired lower eyelid seam '+str(s),[(s*.165,.201,1.471),(s*.148,.209,1.439),(s*.106,.210,1.426),(s*.064,.209,1.440),(s*.047,.201,1.471)],.003,12,'head',n=5)
 line('Uneven old brow '+str(s),[(s*.163,.143,1.570),(s*.117,.175,1.593),(s*.062,.156,1.582)],.009,12,'head',n=6)
 # Swept cream cheek and elongated muzzle taper toward a broad nose.
 ell('Cream swept cheek pad '+str(s),(s*.132,.144,1.343),(.111,.112,.071),3,'head',n=24,r=12,rot=(0,s*.15,-s*.25))
 ell('Long blunt cream muzzle '+str(s),(s*.060,.282,1.345),(.091,.181,.083),3,'head',n=26,r=14,rot=(.17,0,s*.15))
 for j in range(3):disk('Whisker pit '+str(s)+str(j),(s*(.036+j*.028),.445-j*.014,1.355+(j%2)*.012),.003,.003,12,'head',1,n=8)
 line('Original sly mouth seam '+str(s),[(s*.020,.445,1.292),(s*.075,.364,1.278),(s*.15,.249,1.295),(s*.186,.176,1.320)],.0031,12,'head',n=5)
 for j in range(2):line('Short bent fox whisker '+str(s)+str(j),[(s*.142,.25,1.327+j*.023),(s*.201,.274,1.319+j*.028),(s*.245,.277,1.306+j*.035)],.0017,7,'head',n=5)
ell('Dark narrow mechanical mouth',(0,.252,1.275),(.13,.140,.030),10,'head',1,n=24,r=8)
ell('Blunt separate cream lower jaw',(0,.254,1.255),(.118,.137,.033),3,'jaw',n=24,r=10)
for s in [-1,1]:box('One small blunt fox tooth '+str(s),(s*.094,.322,1.273),(.016,.022,.027),14,'jaw',bevel=.004,rot=(0,s*.05,0))
ell('Broad soft black fox nose',(0,.447,1.356),(.056,.041,.042),10,'head',1,n=24,r=12)
line('Repaired head center seam',[(0,-.018,1.676),(0,.109,1.621),(0,.158,1.558),(0,.172,1.492)],.0021,12,'head',n=5)
stitches('Forehead old stitching',(.002,.142,1.58),(.003,.169,1.516),5,'head',width=.015)
line('Rear head repaired seam',[(0,-.06,1.665),(0,-.162,1.560),(0,-.181,1.45),(0,-.147,1.329)],.0023,12,'head',n=5)
stitches('Back of head repair',(0,-.179,1.44),(0,-.176,1.54),6,'head',width=.015)
patch('Old russet cheek repair',(-.182,.127,1.393),(.046,.054),2,'head')
for j in range(3):
 C.prism('Shabby crown tuft '+str(j),[(-.04+j*.03,1.642),(-.029+j*.025,1.711-j*.009),(.005+j*.03,1.65)],-.008,.037,1,'head',0,.004)

# Broad pointed padded ears, asymmetric angles and recessed muted lining.
for label,s in [('R',-1),('L',1)]:
 bn='ear_'+label;x=s*.15
 ell(label+' ear sewn base',(x,-.008,1.623),(.064,.055,.060),1,bn,n=16,r=8)
 poly=[(s*.116,1.638),(s*.177,1.605),(s*.277,1.679),(s*(.339 if s<0 else .333),1.827 if s<0 else 1.807),(s*.212,1.769)]
 C.prism(label+' broad pointed russet ear',poly,-.005,.076,1,bn,0,.013)
 inner=[(s*.156,1.649),(s*.185,1.634),(s*.258,1.697),(s*.307,1.783),(s*.222,1.746)]
 C.prism(label+' recessed worn ear lining',inner,.039,.012,5,bn,0,.007)
 line(label+' ear plain stitched rim',[(s*.144,.050,1.657),(s*.218,.048,1.760),(s*.321,.025,1.807)],.0023,12,bn,n=5)
 stitches(label+' ear repair',(s*.182,.050,1.653),(s*.255,.052,1.729),5,bn,width=.012)

# Shabby heavy tail has a structural root and flexible padded seam.
ell('Tail mechanical sewn base',REST['tail_base'][0],(.066,.062,.067),0,'tail_base',1,n=16,r=8)
tail_points=[(0,-.175,.704),(-.015,-.26,.655),(-.050,-.36,.55),(-.085,-.42,.44),(-.122,-.47,.325),(-.154,-.485,.237),(-.171,-.482,.173)]
tail_radii=[.056,.077,.104,.122,.114,.081,.018]
def tail_weights(p):
 t=max(0,min(1,(.57-p.z)/.16));return {'tail_base':1-t,'tail_tip':t}
C.curve('Heavy shabby russet tail',tail_points[:4]+[(-.111,-.464,.361)],tail_radii[:4]+[.115],1,'tail_base',n=18,steps=4,weights=tail_weights)
C.curve('Dull cream patched tail tip',[(-.111,-.464,.361),(-.138,-.481,.29),(-.159,-.49,.217),(-.173,-.482,.17)],[.115,.102,.067,.015],3,'tail_tip',n=18,steps=3)
line('Tail short upper sewn repair',[(-.071,-.352,.62),(-.090,-.440,.54),(-.103,-.499,.47)],.0020,12,'tail_base',n=5)
patch('Tail old russet repair',(-.097,-.536,.441),(.052,.069),2,'tail_tip',back=True)

# One bounded four-card fan. Every piece follows a hand-parented prop pivot.
card_pivot=Vector(REST['prop_cards'][0]);card_records=[]
for j,ang in enumerate([-.30,-.10,.11,.32]):
 # Fanned in X/Z around the heel; each card is outside the torso silhouette.
 rot=Euler((0,ang,0)).to_matrix();c=card_pivot+rot@Vector((0,.052+j*.004,.145))
 ob=box('DETACHABLE worn card '+str(j),c,(.091,.007,.210),8,'prop_cards',bevel=.006,rot=(0,ang,0))
 # Suit silhouettes are constructed in the same local plane and transformed with the card.
 def suit_point(x,z):return card_pivot+rot@Vector((x,.058+j*.004,z))
 center=suit_point(0,.177);col=15 if j in (1,3) else 6
 if j==0:
  ob=spade('Card original spade mark',0,0,0,.018,col,'prop_cards')
 elif j==1:
  poly=[(0,-.019),(-.021,.004),(-.018,.017),(-.009,.020),(0,.011),(.009,.020),(.018,.017),(.021,.004)]
  ob=C.prism('Card worn heart mark',poly,0,.0015,col,'prop_cards')
 elif j==2:
  # One original suit-like three-lobed token glyph.
  poly=[(-.005,-.020),(-.003,-.006),(-.016,-.010),(-.023,.001),(-.016,.012),(-.010,.012),(-.012,.021),(0,.029),(.012,.021),(.010,.012),(.016,.012),(.023,.001),(.016,-.010),(.003,-.006),(.005,-.020)]
  ob=C.prism('Card club token mark',poly,0,.0015,col,'prop_cards')
 else:ob=C.prism('Card red diamond mark',[(0,.028),(-.019,0),(0,-.028),(.019,0)],0,.0015,col,'prop_cards')
 for v in ob.data.vertices:v.co=rot@v.co+center
 C.uv_project(ob,col)
 # Tiny corner dash remains within the card face, never a logo.
 for x,z in [(-.028,.224),(.028,.067)]:
  p=suit_point(x,z);box('Card faded corner mark '+str(j)+str(z),p,(.009,.0015,.014),col,'prop_cards',bevel=.001,rot=(0,ang,0))
 card_records.append({'index':j,'angle_radians':ang,'center':tuple(c)})

# One runtime skin; keep all named original mesh islands as editable source.
pts=[v.co for ob in C.PARTS for v in ob.data.vertices];ground=min(v.z for v in pts);factor=1.80/(max(v.z for v in pts)-ground)
sources=bpy.data.collections.new('EDITABLE Fox source parts - excluded from GLB');sc.collection.children.link(sources);inventory=[];copies=[]
for ob in C.PARTS:
 for v in ob.data.vertices:v.co=Vector((v.co.x*factor,v.co.y*factor,(v.co.z-ground)*factor))
 ob.data.calc_loop_triangles();inventory.append({'name':ob.name,'triangles':len(ob.data.loop_triangles),'bone_groups':[g.name for g in ob.vertex_groups],'pigment_tile':ob.get('atlas_tile')})
 cp=ob.copy();cp.data=ob.data.copy();sc.collection.objects.link(cp);copies.append(cp)
 for col in list(ob.users_collection):col.objects.unlink(ob)
 sources.objects.link(ob)
sources.hide_render=True;sources.hide_viewport=True;bpy.ops.object.select_all(action='DESELECT')
for ob in copies:ob.select_set(True)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();skin=bpy.context.object;skin.name='Fox_Card_Shark_Skin'
for tag in ['source_part','rigid_weight','atlas_tile']:
 if tag in skin:del skin[tag]
skin.data.calc_loop_triangles();before=len(skin.data.loop_triangles)
if before>14800:
 dec=skin.modifiers.new('Mobile silhouette preserving simplification','DECIMATE');dec.ratio=14700/before;dec.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=dec.name)
data=bpy.data.armatures.new('Fox old padded mascot skeleton');arm=bpy.data.objects.new('Fox_Card_Shark_Rig',data);sc.collection.objects.link(arm);skin.select_set(False);arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
def scaled(p):p=Vector(p);return Vector((p.x*factor,p.y*factor,(p.z-ground)*factor))
for name,(head,tail,parent) in REST.items():
 b=data.edit_bones.new(name);b.head=scaled(head);b.tail=scaled(tail)
 if name=='root':b.head=(0,0,0);b.tail=(0,0,.07*factor)
 if parent:b.parent=data.edit_bones[parent];b.use_connect=(b.head-b.parent.tail).length<.000001
 b.use_deform=name!='root' and not name.startswith('clavicle')
bpy.ops.object.mode_set(mode='OBJECT');mod=skin.modifiers.new('Articulated padded shells and flexible tail','ARMATURE');mod.object=arm;skin.parent=arm
arm['asset_id']='fox-card-shark';arm['candidate']='v001 classic fox side performer - studio only';arm['forward']='Blender +Y / glTF -Z';arm['neutral_total_height_m']=1.80;arm['attack_contact_fraction']=.625;arm['source_concept_sha256']=sc['source_concept_sha256']
bpy.context.view_layer.update();skin.data.calc_loop_triangles()
record={'asset_id':'fox-card-shark','version':'v001','work_order':'WO102','authoring_model':'gpt-6-astra max','blender_version':bpy.app.version_string,'source_concept_sha256':sc['source_concept_sha256'],'source_concept_path':'docs/assets/media/rat-casino-ensemble/v003/construction/fox-card-shark.png','source_prompt_sha256':'e0d78ac2b93585bd3c8534f7889891a86f7a7bedb9e214ba6879d57561ed549b','source_prompt_path':'docs/assets/media/rat-casino-ensemble/v003/construction/fox-card-shark-prompt.txt','ensemble_sha256':'df8b390adf7750a9a91ce63c13d2df5e033cb7e95c2b3975d6ddbac202439a9f','ensemble_path':'docs/assets/media/rat-casino-ensemble/v003/concept.png','spec':C.SPEC,'height_m':1.80,'construction_scale_factor':factor,'construction_ground_shift':ground,'triangles_before_export_simplification':before,'triangles':len(skin.data.loop_triangles),'vertices':len(skin.data.vertices),'material_count':len(skin.data.materials),'texture':{'file':'pigment.png','width':1024,'height':1024,'origin':'Original deterministic worn russet fabric, green cloth, aged cards and dull joint pigment; no external texture.'},'bone_count':len(data.bones),'parts':inventory,'notes':['Sturdy quiet russet fox is shorter than the 2.15 m lead rat.','Long blunt muzzle, matte padded shell and heavy repaired tail.','Plain green dealer vest with one faded original spade token patch.','Small four-card fan inherits gripping hand. No pirate motif.','One skin, at most two influences on authored tail; source pieces remain editable.']}
(ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n');(ROOT/'source/rig-rest.json').write_text(json.dumps({'rest':REST,'factor':factor,'ground':ground,'card_pivot':list(card_pivot),'cards':card_records},indent=2)+'\n')
for name in ['common.py','build.py']:
 block=bpy.data.texts.new('WO102 '+name);block.write((ROOT/'source'/name).read_text())
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'fox-card-shark-construction.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(ROOT/'fox-card-shark-checkpoint.glb'),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_yup=True,export_apply=False,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=False)
print(json.dumps({k:record[k] for k in ['triangles','triangles_before_export_simplification','vertices','height_m','material_count','bone_count']}))
