"""WO100 original classic Rat Casino hen; authored +Z up and +Y forward.

Versioned deterministic source; no downloaded model or reference-image texture.
General mesh helpers retain the earlier cast's coordinate/skin conventions.
"""
import bpy, math, json, hashlib, importlib.util, struct, zlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler
import numpy as np

ROOT=Path('/workspace/haynes-quest/rat-casino-cast/chick-flia/v001')
assert bpy.context.scene.get('work_order')=='WO100'
assert bpy.context.scene.get('scene_lease')=='active'
spec=importlib.util.spec_from_file_location('wo100_common',ROOT/'source/common.py')
C=importlib.util.module_from_spec(spec);spec.loader.exec_module(C);C.BASE=ROOT.parent

def atlas():
 colors=['26251f','bdae94','a69578','652c30','81433f','2b2a27','ad792f','7c6245','cab279','76694f','151611','727c63','d3c9ac','938267','dbd1ad','a44a32']
 rng=np.random.default_rng(10001);indices=np.zeros((1024,1024),dtype=np.uint8);palette=[]
 yy,xx=np.mgrid[0:256,0:256]
 for i,h in enumerate(colors):
  rgb=np.array([int(h[j:j+2],16)/255 for j in (0,2,4)])
  fabric=i in (1,2,3,4,8,9,12,13)
  field=.012*np.sin(xx*.065+yy*.013)+.011*np.cos(xx*.019-yy*.052)
  field+=rng.integers(-3,4,(256,256))*(.006 if fabric else .003)
  if fabric:
   field+=(xx%3==0)*.014+(yy%4==0)*.009
   for j in range(40):
    cx,cy=rng.uniform(0,256,2);sx,sy=rng.uniform(3,35,2)
    field+=rng.uniform(-.17,.035)*np.exp(-((xx-cx)/sx)**2-((yy-cy)/sy)**2)
   for j in range(75):
    cx,cy=rng.integers(3,247,2);length=int(rng.integers(2,11))
    field[cy:min(256,cy+length),cx:cx+1]-=.09
  else:
   for j in range(32):
    cx,cy=rng.integers(2,249,2);length=int(rng.integers(2,8))
    field[cy:cy+2,cx:min(256,cx+length)]+=.055
  levels=np.clip(np.round((field+.12)/.017),0,15).astype(np.uint8)
  for level in range(16):palette.extend(np.round(np.clip(rgb+(-.12+level*.017),.01,.97)*255).astype(np.uint8).tolist())
  row=3-i//4;col=i%4;indices[row*256:(row+1)*256,col*256:(col+1)*256]=i*16+levels
 def chunk(name,data):return struct.pack('>I',len(data))+name+data+struct.pack('>I',zlib.crc32(name+data)&0xffffffff)
 raw=b''.join(b'\x00'+row.tobytes() for row in indices[::-1])
 png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1024,1024,8,3,0,0,0))+chunk(b'PLTE',bytes(palette))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
 (ROOT/'pigment.png').write_bytes(png)

atlas();C.setup('v001',1.72,1.25,2.0,[('Matte worn cream cloth and old apron',.94,0),('Dull molded beak feet and mechanics',.66,.06)])
sc=bpy.context.scene;sc['work_order']='WO100';sc['scene_owner']='/root/chick_flia_classic';sc['scene_lease']='active'
sc['orientation']='Blender +Z up/+Y forward; glTF +Y up/-Z forward; stationary identity floor root'
sc['candidate_status']='Chick-flia v001 studio candidate; Tom exact-version review pending'
sc['source_concept_sha256']='ee84ce15ce47820db78bbf075c58f1be15caa88f1586b369c5f388d627e80936'
sc['authoring_model']='gpt-6-astra max'
for text in list(bpy.data.texts):bpy.data.texts.remove(text)
for image in list(bpy.data.images):
 if image.users==0 and image.name not in ('Render Result','Viewer Node'):bpy.data.images.remove(image)
C.SPEC.update(asset_id='chick-flia',version='v001',source_concept_sha256=sc['source_concept_sha256'])

def ell(name,p,s,col,bn='chest',mat=0,n=18,r=9,rot=(0,0,0)):
 return C.ellipsoid(name,p,s,col,bn,mat,n,r,rot)
def tube(name,points,radius,col,bn='chest',mat=0,n=10):return C.tube(name,points,radius,col,bn,mat,n)
def line(name,points,radius,col,bn='chest',mat=0,n=6):return C.curve(name,points,radius,col,bn,mat,n,steps=3)
def box(name,p,s,col,bn='chest',mat=0,bevel=.005,rot=(0,0,0)):
 return C.box(name,p,s,col,bn,bevel,2,mat,rot)
def disk(name,c,rad,depth,col,bn='chest',mat=0,n=12):
 return tube(name,[(c[0],c[1]-depth/2,c[2]),(c[0],c[1]+depth/2,c[2])],rad,col,bn,mat,n)
def zshape(name,rows,col,bn='chest',mat=0,n=20):
 return C.rings(name,[[(x+rx*math.cos(math.tau*i/n),y+ry*math.sin(math.tau*i/n),z) for i in range(n)] for z,x,y,rx,ry in rows],col,bn,mat)
def stitches(name,a,b,count,bn='chest',col=13,width=.011):
 a,b=Vector(a),Vector(b);d=(b-a).normalized();side=Vector((1,0,0)) if abs(d.x)<.8 else Vector((0,0,1))
 for j in range(count):
  p=a.lerp(b,(j+.5)/count);tube(name+' stitch '+str(j),[p-side*width/2,p+side*width/2],.00165,col,bn,n=5)
def patch(name,c,s,col,bn,back=False):
 x,y,z=c;w,h=s;sign=-1 if back else 1
 ob=C.prism(name,[(x-w*.5,z-h*.48),(x+w*.46,z-h*.5),(x+w*.5,z+h*.45),(x-w*.45,z+h*.5)],y,.006,col,bn,0,.002)
 for side in [-1,1]:stitches(name,(x+side*w*.37,y+sign*.005,z-h*.37),(x+side*w*.37,y+sign*.005,z+h*.37),4,bn,width=.013)
 return ob

REST={'root':((0,0,0),(0,0,.08),None),'hips':((0,0,.64),(0,0,.79),'root'),'chest':((0,0,.79),(0,0,1.133),'hips'),'neck':((0,0,1.133),(0,0,1.203),'chest'),'head':((0,0,1.203),(0,0,1.46),'neck'),'jaw':((0,.172,1.244),(0,.255,1.241),'head')}
for label,s in [('R',-1),('L',1)]:
 shoulder=(s*.29,0,1.072);elbow=(s*.400,.008,.867);wrist=(s*.442,.107,.735) if s>0 else (s*.445,.033,.684)
 REST['clavicle_'+label]=((s*.11,0,1.08),shoulder,'chest')
 REST['upper_wing_'+label]=(shoulder,elbow,'clavicle_'+label)
 REST['lower_wing_'+label]=(elbow,wrist,'upper_wing_'+label)
 REST['hand_'+label]=(wrist,(wrist[0],wrist[1],wrist[2]-.075),'lower_wing_'+label)
 hip=(s*.128,0,.64);knee=(s*.13,.005,.424);ankle=(s*.133,.027,.151)
 REST['thigh_'+label]=(hip,knee,'hips');REST['shin_'+label]=(knee,ankle,'thigh_'+label)
 REST['foot_'+label]=(ankle,(s*.133,.20,.151),'shin_'+label)
REST['prop_microphone']=((.451,.146,.746),(.451,.146,.92),'hand_L')

# A broad compact padded belly, with scallops confined to the lower shell.
ell('Squat padded cream belly',(0,-.003,.883),(.299,.226,.319),1,n=30,r=18)
ell('Padded lower hip shell',(0,-.012,.650),(.241,.177,.142),2,'hips',n=24,r=12)
for j in range(7):
 a=-1.20+j*2.40/6;x=.25*math.sin(a);y=.16*math.cos(a)
 ell('Soft lower belly scallop '+str(j),(x,y,.624),(.048,.031,.051),1,'hips',n=12,r=6,rot=(0,-a*.13,0))
for j in [-1,0,1]:
 ell('Small rear tail feather '+str(j),(j*.047,-.211,.76-abs(j)*.006),(.052,.035,.123),2,'hips',n=14,r=8,rot=(.10,j*.22,0))

# Apron is a curved shallow shell following the belly rather than a dress.
def belly_y(x,z):return -.003+.226*math.sqrt(max(.018,1-(x/.299)**2-((z-.883)/.319)**2))
apron_rows=[(.788,.04),(.798,.11),(.823,.174),(.856,.202),(.90,.22),(.941,.228),(.987,.226),(1.03,.214),(1.072,.198),(1.106,.178),(1.13,.163)]
verts=[];faces=[];cols=12;rows=len(apron_rows);stride=rows*(cols+1)
for depth in [-.004,.004]:
 for z,w in apron_rows:
  for j in range(cols+1):
   x=-w+2*w*j/cols;verts.append((x,belly_y(x,z)+.012+depth,z))
for layer in range(2):
 for k in range(rows-1):
  for j in range(cols):
   a=layer*stride+k*(cols+1)+j;faces.append((a,a+1,a+cols+2,a+cols+1))
outline=list(range(cols+1))+[k*(cols+1)+cols for k in range(1,rows)]+list(range((rows-1)*(cols+1)+cols-1,(rows-1)*(cols+1)-1,-1))+[k*(cols+1) for k in range(rows-2,0,-1)]
for k,a in enumerate(outline):
 b=outline[(k+1)%len(outline)];faces.append((a,b,b+stride,a+stride))
C.mesh('Faded short casino apron',verts,faces,3,'chest')
for sign in [-1,1]:
 points=[(sign*w,belly_y(sign*w,z)+.018,z) for z,w in apron_rows]
 line('Apron worn perimeter '+str(sign),points,.004,4,n=5)
 # Wide flat shoulder strap, including over the padded shoulder and down the back.
 points=[(sign*.162,belly_y(sign*.162,1.12)+.018,1.12),(sign*.157,.045,1.193),(sign*.154,-.075,1.176),(sign*.152,-.149,1.095),(sign*.171,-.215,.954)]
 rr=[]
 for x,y,z in points:rr.append([(x-.022,y-.006,z),(x+.022,y-.006,z),(x+.022,y+.006,z),(x-.022,y+.006,z)])
 C.rings('Plain apron shoulder strap '+str(sign),rr,3)
 disk('Dull old strap tack '+str(sign),(sign*.16,belly_y(sign*.16,1.103)+.027,1.103),.008,.006,8,n=8)
 # Mechanical neck under a modest cloth feather collar.
ell('Recessed black neck motor',(0,0,1.18),(.067,.063,.072),0,'neck',1,n=20,r=8)
for z in [1.147,1.186]:C.ellipse_loop('Neck bearing '+str(z),(0,0,z),.067,.063,.009,7,'neck',1,n=20,tube_n=6)
for j in range(7):
 a=-1.3+j*2.6/6
 ell('Modest collar feather '+str(j),(.096*math.sin(a),.099*math.cos(a),1.137),(.032,.017,.034),12,n=12,r=6,rot=(0,-a*.18,0))
# Cloth waistband and simple rear ties.
C.ellipse_loop('Old apron waistband',(0,-.003,.941),.298,.231,.016,3,n=36,tube_n=6)
C.bow('Small apron rear knot',(0,-.244,.952),.09,3,'chest',back=True)
for s in [-1,1]:
 C.prism('Short loose apron tie '+str(s),[(s*.012,.952),(s*.036,.941),(s*.068,.855),(s*.035,.867)],-.251,.007,3,'chest',0,.002)
# Original club token patch sewn to the apron, not branded lettering.
for x,z,r in [(0,1.043,.025),(-.022,1.014,.025),(.022,1.014,.025)]:
 ob=C.prism('Flat sewn club patch lobe '+str(x),[(x+r*math.cos(math.tau*k/16),z+r*math.sin(math.tau*k/16)) for k in range(16)],0,.002,8,'chest')
 for v in ob.data.vertices:v.co.y=belly_y(v.co.x,v.co.z)+.020+v.co.y
C.prism('Club patch stem',[(-.009,1.008),(.009,1.008),(.007,.989),(.019,.98),(-.019,.98),(-.007,.989)],belly_y(0,.997)+.024,.004,8,'chest')
stitches('Apron top stitch',(-.142,belly_y(-.142,1.116)+.022,1.116),(.142,belly_y(.142,1.116)+.022,1.116),15,col=9)
for x in [-.11,.10]:
 line('Apron cloth crease '+str(x),[(x,belly_y(x,.906)+.021,.906),(x*.9,belly_y(x*.9,.862)+.020,.862),(x*.6,belly_y(x*.6,.825)+.019,.825)],.0018,4,n=5)
patch('Rear belly cloth repair',(.135,-.205,.838),(.092,.091),12,'hips',True)

# Plain heavy face plates, low glass eyes, and an old ochre beak.
ell('Cream padded hen head',(0,-.003,1.381),(.209,.165,.226),1,'head',n=32,r=18)
for s in [-1,1]:
 ell('Soft cheek plate '+str(s),(s*.140,.091,1.294),(.08,.085,.098),12,'head',n=20,r=10)
 for j in range(3):
  ell('Cheek feather edge '+str(s)+str(j),(s*(.124+j*.020),.139-j*.01,1.253+j*.027),(.036,.022,.051),1,'head',n=12,r=6,rot=(0,-s*.55,0))
 x=s*.079;z=1.445+(s<0)*.004
 ell('Recessed eye mechanism '+str(s),(x,.156,z),(.078,.035,.085),9,'head',1,n=22,r=12)
 ell('Cloudy old glass eye '+str(s),(x,.176,z-.008),(.061,.047,.072),14,'head',1,n=24,r=12)
 ell('Muted green iris '+str(s),(x-s*.003,.218,z-.021),(.027,.009,.029),11,'head',1,n=18,r=8)
 ell('Small glass pupil '+str(s),(x-s*.003,.226,z-.019),(.013,.0045,.017),10,'head',1,n=16,r=8)
 ell('Weak eye reflection '+str(s),(x-s*.003-.005,.230,z-.01),(.004,.002,.005),12,'head',1,n=8,r=4)
 # Upper half of padded eyelid; a smooth rim only, with no lashes or makeup.
 rings=[];n=24
 for j in range(7):
  a=j*math.pi/12;rr=max(.0002,math.cos(a))
  rings.append([(x+.074*rr*math.cos(math.tau*k/n),.18+.053*rr*math.sin(math.tau*k/n),z+.006+.083*math.sin(a)) for k in range(n)])
 C.rings('Plain thick upper eyelid '+str(s),rings,1,'head')
 line('Lid lower fabric rim '+str(s),[(x-.068,.2,z+.009),(x-.034,.231,z+.004),(x+.034,.231,z+.004),(x+.068,.20,z+.009)],.004,2,'head',n=5)
 # Raised padded brow lies close to the shell and stays cream.
 line('Worn plain brow pad '+str(s),[(x-s*.055,.146,z+.074),(x,.143,z+.097),(x+s*.052,.124,z+.089)],.012,1,'head',n=8)

ell('Small dark mouth opening',(0,.219,1.245),(.081,.079,.047),10,'head',1,n=22,r=10)
beak_rows=[]
for y,w,h,z in [(.164,.061,.062,1.313),(.216,.084,.066,1.307),(.272,.078,.042,1.289),(.322,.058,.024,1.277),(.342,.028,.012,1.277),(.344,.001,.001,1.277)]:
 beak_rows.append([(w*math.cos(math.tau*j/20),y,z+h*math.sin(math.tau*j/20)) for j in range(20)])
C.rings('Modest molded upper beak',beak_rows,6,'head',1)
ell('Rounded separate lower beak',(0,.243,1.213),(.073,.08,.023),6,'jaw',1,n=22,r=8)
for s in [-1,1]:ell('Beak nostril '+str(s),(s*.030,.239,1.351),(.006,.003,.012),7,'head',1,n=10,r=6,rot=(.0,s*.25,0))
line('Head repaired center seam',[(0,.011,1.604),(0,.107,1.573),(0,.158,1.516),(0,.172,1.453),(0,.167,1.384)],.0021,13,'head',n=5)
stitches('Forehead repair',(.004,.156,1.521),(.003,.174,1.45),5,'head',col=13,width=.011)
line('Back head stitched seam',[(0,-.048,1.6),(0,-.151,1.516),(0,-.173,1.4),(0,-.139,1.276)],.0022,13,'head',n=5)
stitches('Back head repair',(.008,-.173,1.395),(.006,-.148,1.50),5,'head',col=9,width=.012)

# Short chipped red comb: three soft arches, deliberately irregular and quiet.
for j,(x,y,z,h,lean) in enumerate([(-.037,-.013,1.591,.127,-.038),(0,.013,1.603,.158,.036),(.035,.017,1.593,.11,.065)]):
 line('Old red comb lobe '+str(j),[(x,y,z),(x+lean*.32,y+.008,z+h*.58),(x+lean,y+.025,z+h),(x+lean+.03,y+.047,z+h-.012)],[.027,.033,.035,.025],15,'head',1,n=12)
for x,y,z in [(.039,.069,1.735),(-.053,.03,1.678),(.086,.066,1.675)]:
 ell('Small comb paint chip '+str(z),(x,y,z),(.007,.002,.012),13,'head',1,n=8,r=4,rot=(0,.4,0))

# Heavy articulated wing shells, with shallow layered feather panels.
for label,s in [('R',-1),('L',1)]:
 shoulder=Vector(REST['upper_wing_'+label][0]);elbow=Vector(REST['lower_wing_'+label][0]);wrist=Vector(REST['hand_'+label][0])
 ell(label+' recessed shoulder motor',shoulder,(.048,.05,.05),0,'upper_wing_'+label,1,n=18,r=8)
 ell(label+' cream shoulder shell cap',(s*.287,-.001,1.08),(.081,.079,.075),1,'upper_wing_'+label,n=20,r=10)
 center=shoulder.lerp(elbow,.49)
 ell(label+' padded upper wing',center,(.104,.092,.136),1,'upper_wing_'+label,n=22,r=12,rot=(0,s*.46,0))
 ell(label+' elbow bearing',elbow,(.05,.053,.045),0,'lower_wing_'+label,1,n=16,r=8)
 tube(label+' elbow dull pin',[(elbow.x-s*.032,elbow.y,elbow.z),(elbow.x+s*.056,elbow.y,elbow.z)],.016,7,'lower_wing_'+label,1,n=10)
 center=elbow.lerp(wrist,.54)
 ell(label+' padded lower wing',center,(.086,.075,.126),2,'lower_wing_'+label,n=20,r=10,rot=(-.30 if s>0 else -.08,s*.14,0))
 for j in range(3):
  p=center+Vector((s*(j-1)*.043,.058,.015-j*.008))
  ell(label+' lower wing long feather '+str(j),p,(.035,.031,.145-abs(j-1)*.025),1,'lower_wing_'+label,n=14,r=9,rot=(-.26 if s>0 else -.07,s*.12,0))
 for j in range(3):
  p=shoulder.lerp(elbow,.53)+Vector((s*(j-1)*.043,.068,.025))
  ell(label+' upper wing layered feather '+str(j),p,(.034,.030,.082),12,'upper_wing_'+label,n=14,r=8,rot=(0,s*.4,0))
 ell(label+' compact wing palm',wrist+Vector((0,.026,-.012)),(.071,.055,.057),1,'hand_'+label,n=18,r=9)
 if s<0:
  for j in range(3):ell('Resting right wing digit '+str(j),wrist+Vector(((j-1)*.034,.048,-.048)),(.025,.026,.060),1,'hand_R',n=12,r=6)
 else:
  for j in range(3):
   zz=.716+j*.026
   line('Wing grip around microphone '+str(j),[(.402,.137,zz),(.418,.165,zz),(.448,.175,zz),(.474,.163,zz)],[.014,.016,.016,.013],1,'hand_L',n=8)
  ell('Rear thumb on microphone',(.477,.116,.752),(.023,.025,.041),1,'hand_L',n=14,r=6)
 stitches(label+' old wing repair',(center.x-s*.018,center.y+.08,center.z-.038),(center.x-s*.02,center.y+.076,center.z+.045),4,'lower_wing_'+label,col=13,width=.013)

# Thick cream thighs, small old joints, ochre shin shells, three broad toes.
for label,s in [('R',-1),('L',1)]:
 x=s*.13
 ell(label+' padded cream thigh',(x,0,.539),(.108,.102,.143),1,'thigh_'+label,n=22,r=12)
 for j in [-1,0,1]:ell(label+' thigh soft scallop '+str(j),(x+j*.038,.064,.440),(.034,.035,.05),12,'thigh_'+label,n=12,r=6)
 ell(label+' dark knee joint',(x,.005,.414),(.050,.048,.031),0,'shin_'+label,1,n=16,r=8)
 zshape(label+' stout ochre lower leg',[(.171,x,.019,.057,.057),(.222,x,.018,.064,.06),(.288,x,.012,.06,.055),(.352,x,.010,.068,.064),(.396,x,.008,.066,.060)],6,'shin_'+label,1,n=16)
 for z,rad in [(.202,.061),(.271,.060),(.344,.067),(.386,.067)]:
  C.ellipse_loop(label+' shin shell seam '+str(z),(x,.012,z),rad,rad*.93,.004,7,'shin_'+label,1,n=20,tube_n=5)
 ell(label+' cream knee shell collar',(x,.008,.401),(.07,.063,.031),2,'shin_'+label,n=16,r=8)
 ell(label+' ankle dark coupling',(x,.024,.151),(.054,.053,.023),0,'foot_'+label,1,n=16,r=6)
 ell(label+' rounded heel',(x,.012,.080),(.085,.112,.07),6,'foot_'+label,1,n=20,r=10)
 for j in [-1,0,1]:
  toe=[(x+j*.042,.065,.079),(x+j*.061,.124,.065),(x+j*.080,.197-.014*abs(j),.048),(x+j*.081,.239-.022*abs(j),.037)]
  line(label+' heavy three-toed foot '+str(j),toe,[.042,.041,.034,.020],6,'foot_'+label,1,n=12)
  ell(label+' rounded toe end '+str(j),toe[-1],(.022,.024,.022),6,'foot_'+label,1,n=12,r=6)
  for k in [.32,.60]:
   p=Vector(toe[0]).lerp(Vector(toe[-1]),k)
   line(label+' toe segment '+str(j)+str(k),[(p.x-.027,p.y,p.z+.021),(p.x,p.y+.002,p.z+.038),(p.x+.027,p.y,p.z+.021)],.0025,7,'foot_'+label,1,n=5)
patch('Old right thigh fabric patch',(-.13,.09,.574),(.075,.065),2,'thigh_R')

# Detachable prop is rigidly attached to hand_L, with understated old grille.
mx,my=.451,.146
tube('DETACHABLE microphone dark handle',[(mx,my,.677),(mx,my,.874)],.018,5,'prop_microphone',1,n=12)
for z in [.686,.833,.869]:C.ellipse_loop('Microphone handle collar '+str(z),(mx,my,z),.02,.02,.004,7,'prop_microphone',1,n=16,tube_n=5)
ell('Microphone old capsule body',(mx,my,.925),(.053,.037,.077),7,'prop_microphone',1,n=24,r=14)
ell('Microphone recessed grille',(mx,my+.03,.927),(.041,.010,.059),0,'prop_microphone',1,n=20,r=12)
for j in range(6):
 z=.882+j*.017;w=.043*math.sqrt(max(.2,1-((z-.925)/.077)**2))
 box('Microphone horizontal grille rib '+str(j),(mx,my+.041,z),(w*2,.01,.006),13,'prop_microphone',1,bevel=.003)
box('Microphone center grille rib',(mx,my+.047,.925),(.006,.004,.098),7,'prop_microphone',1,bevel=.002)

# Floor-centered identity rig and a maintainable editable named-part collection.
pts=[v.co for ob in C.PARTS for v in ob.data.vertices];low=min(v.z for v in pts);factor=1.72/(max(v.z for v in pts)-low)
sources=bpy.data.collections.new('EDITABLE Chick-flia source parts - excluded from GLB');sc.collection.children.link(sources)
inventory=[];copies=[]
for ob in C.PARTS:
 for v in ob.data.vertices:v.co=Vector((v.co.x*factor,v.co.y*factor,(v.co.z-low)*factor))
 ob.data.calc_loop_triangles();inventory.append({'name':ob.name,'triangles':len(ob.data.loop_triangles),'bone_groups':[g.name for g in ob.vertex_groups],'pigment_tile':ob.get('atlas_tile')})
 cp=ob.copy();cp.data=ob.data.copy();sc.collection.objects.link(cp);copies.append(cp)
 for col in list(ob.users_collection):col.objects.unlink(ob)
 sources.objects.link(ob)
sources.hide_render=True;sources.hide_viewport=True
bpy.ops.object.select_all(action='DESELECT')
for ob in copies:ob.select_set(True)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();skin=bpy.context.object;skin.name='Chick_Flia_Skin'
for tag in ['source_part','rigid_weight','atlas_tile']:
 if tag in skin:del skin[tag]
skin.data.calc_loop_triangles()
if len(skin.data.loop_triangles)>14800:
 dec=skin.modifiers.new('Mobile silhouette preserving simplification','DECIMATE');dec.ratio=14700/len(skin.data.loop_triangles);dec.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=dec.name)
data=bpy.data.armatures.new('Chick-flia segmented old mascot skeleton');arm=bpy.data.objects.new('Chick_Flia_Rig',data);sc.collection.objects.link(arm)
skin.select_set(False);arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
def scaled(p):
 p=Vector(p);return Vector((p.x*factor,p.y*factor,(p.z-low)*factor))
for name,(head,tail,parent) in REST.items():
 b=data.edit_bones.new(name);b.head=scaled(head);b.tail=scaled(tail)
 if name=='root':b.head=(0,0,0);b.tail=(0,0,.07*factor)
 if parent:b.parent=data.edit_bones[parent];b.use_connect=(b.head-b.parent.tail).length<.000001
 b.use_deform=name!='root' and not name.startswith('clavicle')
bpy.ops.object.mode_set(mode='OBJECT')
mod=skin.modifiers.new('One influence per articulated padded shell','ARMATURE');mod.object=arm;skin.parent=arm
arm['asset_id']='chick-flia';arm['candidate']='v001 classic hen side performer - studio only';arm['forward']='Blender +Y / glTF -Z';arm['neutral_total_height_m']=1.72;arm['attack_contact_fraction']=.625;arm['source_concept_sha256']=sc['source_concept_sha256']
bpy.context.view_layer.update();skin.data.calc_loop_triangles()
record={'asset_id':'chick-flia','version':'v001','work_order':'WO100','authoring_model':'gpt-6-astra max','blender_version':bpy.app.version_string,'source_concept_sha256':sc['source_concept_sha256'],'ensemble_sha256':'df8b390adf7750a9a91ce63c13d2df5e033cb7e95c2b3975d6ddbac202439a9f','spec':C.SPEC,'height_m':1.72,'construction_scale_factor':factor,'construction_ground_shift':low,'triangles':len(skin.data.loop_triangles),'vertices':len(skin.data.vertices),'material_count':len(skin.data.materials),'texture':{'file':'pigment.png','width':1024,'height':1024,'origin':'Original deterministic cream cloth and worn molded pigment; no external texture.'},'bone_count':len(data.bones),'parts':inventory,'notes':['Small supporting hen at 80% of the 2.15 m lead rat height.','Broad padded belly and wing shells, cream tired eyelid plates, plain burgundy short apron.','No eye makeup, lashes, glamour dress, jewelry, filigree or concert rest pose.','Prop microphone has its own child bone fixed to a real wing grip.','One rigid influence per vertex; source pieces remain editable.']}
(ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n')
(ROOT/'source/rig-rest.json').write_text(json.dumps({'rest':REST,'factor':factor,'ground':low},indent=2)+'\n')
for name in ['common.py','build.py']:
 text=bpy.data.texts.new('WO100 '+name);text.write((ROOT/'source'/name).read_text())
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'chick-flia-construction.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(ROOT/'chick-flia-checkpoint.glb'),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_yup=True,export_apply=False,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=False)
print(json.dumps({k:record[k] for k in ['triangles','vertices','height_m','material_count','bone_count']}))
