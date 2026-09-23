"""WO101 original worn indigo jackrabbit; Blender +Z up / +Y forward.

Selected v003 construction inputs are hashes, never projected franchise art.
All mesh islands remain named and editable beside the one exported skin.
"""
import bpy, math, json, hashlib, importlib.util, struct, zlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler
import numpy as np

ROOT=Path('/workspace/haynes-quest/rat-casino-cast/jackrabbit-drummer/v001')
assert bpy.context.scene.get('work_order')=='WO101' and bpy.context.scene.get('scene_lease')=='active'
spec=importlib.util.spec_from_file_location('wo101_common',ROOT/'source/common.py')
C=importlib.util.module_from_spec(spec);spec.loader.exec_module(C);C.BASE=ROOT.parent

def atlas():
 colors=['202127','4a4568','625775','a69887','592c34','776778','36332e','82745e','c5b798','817d59','111415','c6bea0','484153','a58c6e','e1d3ae','805143']
 rng=np.random.default_rng(10101);indices=np.zeros((1024,1024),dtype=np.uint8);palette=[]
 yy,xx=np.mgrid[0:256,0:256]
 for i,h in enumerate(colors):
  rgb=np.array([int(h[j:j+2],16)/255 for j in (0,2,4)]);fabric=i in (1,2,3,4,5,8,12,13)
  field=.016*np.sin(xx*.059+yy*.019)+.009*np.cos(xx*.031-yy*.049)
  field+=rng.integers(-3,4,(256,256))*(.006 if fabric else .003)
  if fabric:
   field+=(xx%3==0)*.018+(yy%4==0)*.011
   for j in range(52):
    cx,cy=rng.uniform(0,256,2);sx,sy=rng.uniform(3,28,2)
    field+=rng.uniform(-.14,.055)*np.exp(-((xx-cx)/sx)**2-((yy-cy)/sy)**2)
   for j in range(95):
    cx,cy=rng.integers(3,247,2);length=int(rng.integers(2,9));field[cy:min(256,cy+length),cx:cx+1]+=.10
  else:
   for j in range(30):
    cx,cy=rng.integers(2,249,2);length=int(rng.integers(2,8));field[cy:cy+2,cx:min(256,cx+length)]+=.05
  levels=np.clip(np.round((field+.12)/.017),0,15).astype(np.uint8)
  for level in range(16):palette.extend(np.round(np.clip(rgb+(-.12+level*.017),.01,.97)*255).astype(np.uint8).tolist())
  row=3-i//4;col=i%4;indices[row*256:(row+1)*256,col*256:(col+1)*256]=i*16+levels
 def chunk(name,data):return struct.pack('>I',len(data))+name+data+struct.pack('>I',zlib.crc32(name+data)&0xffffffff)
 raw=b''.join(b'\x00'+row.tobytes() for row in indices[::-1]);png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1024,1024,8,3,0,0,0))+chunk(b'PLTE',bytes(palette))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
 (ROOT/'pigment.png').write_bytes(png)

atlas();C.setup('v001',1.96,1.25,2,[('Matte patched indigo cloth and old drum',.95,0),('Dull glass molded shell and worn mechanics',.65,.06)])
sc=bpy.context.scene;sc['work_order']='WO101';sc['scene_owner']='/root/jackrabbit_classic_blender';sc['scene_lease']='active';sc['orientation']='Blender +Z up/+Y forward; glTF +Y up/-Z forward; stationary identity floor root'
sc['candidate_status']='Jackrabbit Drummer v001 studio candidate; Tom exact-version review pending';sc['source_concept_sha256']='47fc84778feac83642e94bded8ff5f84647a84b35870f8a932e0cc348b0a38ea';sc['authoring_model']='gpt-6-astra max'
for text in list(bpy.data.texts):bpy.data.texts.remove(text)
for image in list(bpy.data.images):
 if image.users==0 and image.name not in ('Render Result','Viewer Node'):bpy.data.images.remove(image)
C.SPEC.update(asset_id='jackrabbit-drummer',version='v001',source_concept_sha256=sc['source_concept_sha256'])

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
 ob=C.prism(name,[(x-w*.5,z-h*.48),(x+w*.46,z-h*.5),(x+w*.5,z+h*.45),(x-w*.45,z+h*.5)],y,.006,col,bn,0,.002)
 for side in [-1,1]:stitches(name,(x+side*w*.37,y+sign*.005,z-h*.37),(x+side*w*.37,y+sign*.005,z+h*.37),4,bn,width=.014)
 return ob
def strap(name,points,width=.045):
 C.rings(name,[[(x-width/2,y-.005,z),(x+width/2,y-.005,z),(x+width/2,y+.005,z),(x-width/2,y+.005,z)] for x,y,z in points],6,'prop_harness')

REST={'root':((0,0,0),(0,0,.08),None),'hips':((0,0,.68),(0,0,.85),'root'),'chest':((0,0,.85),(0,0,1.225),'hips'),'neck':((0,0,1.225),(0,0,1.285),'chest'),'head':((0,0,1.285),(0,0,1.49),'neck'),'jaw':((0,.13,1.32),(0,.28,1.31),'head')}
for label,s in [('R',-1),('L',1)]:
 shoulder=(s*.307,0,1.205);elbow=(s*.440,.035,.986);wrist=(s*.43,.265,1.02)
 REST['clavicle_'+label]=((s*.14,0,1.20),shoulder,'chest');REST['upper_arm_'+label]=(shoulder,elbow,'clavicle_'+label);REST['forearm_'+label]=(elbow,wrist,'upper_arm_'+label);REST['hand_'+label]=(wrist,(wrist[0],wrist[1]+.08,wrist[2]),'forearm_'+label)
 hip=(s*.145,0,.68);knee=(s*.147,.0,.435);ankle=(s*.15,.02,.16)
 REST['thigh_'+label]=(hip,knee,'hips');REST['shin_'+label]=(knee,ankle,'thigh_'+label);REST['foot_'+label]=(ankle,(s*.15,.20,.16),'shin_'+label)
 REST['prop_stick_'+label]=(wrist,(wrist[0]-s*.19,wrist[1]+.16,wrist[2]+.19),'hand_'+label)
REST['ear_base_L']=((.114,0,1.616),(.15,.01,1.94),'head');REST['ear_tip_L']=((.15,.01,1.94),(.201,.06,1.906),'ear_base_L')
REST['ear_base_R']=((-.116,0,1.616),(-.239,.012,1.788),'head');REST['ear_tip_R']=((-.239,.012,1.788),(-.39,.05,1.594),'ear_base_R')
REST['prop_harness']=((0,0,1.20),(0,0,1.27),'chest');REST['prop_snare']=((0,.482,.84),(0,.482,.97),'prop_harness')

# Broad padded body with a small cream belly panel, never a fitted costume.
ell('Broad slumped purple torso',(0,-.015,.996),(.295,.221,.295),1,n=30,r=18)
ell('Round padded hip shell',(0,-.012,.707),(.246,.18,.136),1,'hips',n=24,r=12)
ell('Faded plain cream belly inset',(0,.187,1.029),(.155,.047,.217),3,n=24,r=14)
for z in [.94,1.035,1.126]:disk('Old plain belly button '+str(z),(0,.233,z),.007,.006,6,mat=1,n=10)
line('Rear center body panel seam',[(0,-.218,1.147),(0,-.236,1.03),(0,-.209,.9),(0,-.17,.807)],.0025,12,n=5)
stitches('Back shell center repair',(0,-.236,.966),(0,-.23,1.075),7,width=.012)
patch('Lower flank stitched cloth patch',(-.22,.102,.837),(.068,.095),2,'chest')
ell('Small shabby rabbit tail',(0,-.209,.735),(.083,.071,.082),3,'hips',n=20,r=10)
for j in range(4):
 a=math.tau*j/4;ell('Tail uneven tuft '+str(j),(.045*math.cos(a),-.24,.735+.045*math.sin(a)),(.039,.026,.039),8,'hips',n=10,r=6)

# Dark repaired joints remain recessed inside broad padded sleeves and legs.
ell('Dark neck coupling',(0,0,1.249),(.076,.064,.057),0,'neck',1,n=18,r=8)
for z in [1.228,1.269]:C.ellipse_loop('Neck bearing '+str(z),(0,0,z),.074,.063,.006,7,'neck',1,n=20,tube_n=6)
for label,s in [('R',-1),('L',1)]:
 shoulder=Vector(REST['upper_arm_'+label][0]);elbow=Vector(REST['forearm_'+label][0]);wrist=Vector(REST['hand_'+label][0])
 ell(label+' shoulder black bearing',shoulder,(.061,.057,.061),0,'upper_arm_'+label,1,n=16,r=8)
 ell(label+' padded shoulder cap',(s*.316,-.001,1.205),(.085,.085,.071),1,'upper_arm_'+label,n=20,r=10)
 center=shoulder.lerp(elbow,.52);ell(label+' chunky upper sleeve',center,(.10,.09,.133),1,'upper_arm_'+label,n=22,r=12,rot=(0,s*.44,0))
 ell(label+' elbow black bearing',elbow,(.052,.054,.045),0,'forearm_'+label,1,n=18,r=8)
 tube(label+' repaired elbow pin',[(elbow.x-s*.028,elbow.y,elbow.z),(elbow.x+s*.054,elbow.y,elbow.z)],.016,7,'forearm_'+label,1,n=10)
 center=elbow.lerp(wrist,.53)
 # Forearm is a padded oval laid along the actual bent arm direction.
 ob=ell(label+' thick padded forearm',(0,0,0),(.079,.078,.113),1,'forearm_'+label,n=22,r=12)
 q=Vector((0,0,1)).rotation_difference((wrist-elbow).normalized())
 for v in ob.data.vertices:v.co=q@v.co+center
 ell(label+' wrist coupling',wrist,(.043,.042,.042),0,'hand_'+label,1,n=16,r=8)
 ell(label+' blocky padded palm',wrist+Vector((0,.036,.008)),(.065,.057,.052),2,'hand_'+label,n=18,r=10)
 for j in range(3):
  xx=wrist.x+(j-1)*.032;zz=wrist.z+.008
  line(label+' curled drumstick finger '+str(j),[(xx,wrist.y+.042,zz+.038),(xx,wrist.y+.087,zz+.036),(xx,wrist.y+.096,zz-.004),(xx,wrist.y+.066,zz-.019)],[.014,.017,.017,.013],1,'hand_'+label,n=8)
 ell(label+' padded gripping thumb',wrist+Vector((-s*.052,.047,.045)),(.023,.032,.027),1,'hand_'+label,n=14,r=8,rot=(0,s*.4,0))
 stitches(label+' sleeve seam',(center.x+s*.07,center.y-.025,center.z-.025),(center.x+s*.072,center.y+.08,center.z+.01),6,'forearm_'+label)
 # Small original sticks are children of the hand bones, with separate prop pivots.
 tip=Vector(REST['prop_stick_'+label][1]);start=wrist-Vector((-s*.19,.16,.19)).normalized()*.064
 tube('DETACHABLE '+label+' old wooden drumstick',[start,wrist,tip], [.010,.010,.007],13,'prop_stick_'+label,1,n=10)
 ell(label+' drumstick worn bead',tip,(.015,.015,.015),7,'prop_stick_'+label,1,n=12,r=7)
 # Raised shaped thighs/shins leave a small black repaired knee gap.
 x=s*.146
 ell(label+' padded upper leg',(x,-.003,.562),(.107,.105,.138),1,'thigh_'+label,n=22,r=12)
 ell(label+' knee motor',(x,.002,.423),(.056,.054,.040),0,'shin_'+label,1,n=18,r=8)
 tube(label+' knee pin',[(x-s*.036,.002,.423),(x+s*.06,.002,.423)],.018,7,'shin_'+label,1,n=10)
 ell(label+' chunky lower leg',(x,.004,.293),(.096,.087,.122),1,'shin_'+label,n=22,r=12)
 ell(label+' ankle repaired coupling',(x,.02,.163),(.057,.055,.028),0,'foot_'+label,1,n=16,r=8)
 ell(label+' broad padded foot',(x,.086,.075),(.126,.157,.074),1,'foot_'+label,n=24,r=12)
 for j in [-1,0,1]:
  ell(label+' blunt toe '+str(j),(x+j*.071,.205,.055),(.048,.069,.051),2,'foot_'+label,n=14,r=8)
  ell(label+' old molded toe tip '+str(j),(x+j*.071,.248,.048),(.021,.022,.024),7,'foot_'+label,1,n=10,r=6)
 stitches(label+' shin repair',(x-.017,.089,.231),(x-.020,.083,.343),7,'shin_'+label,col=13,width=.016)
patch('Old right thigh square cloth repair',(-.148,.092,.561),(.073,.068),12,'thigh_R')

# Original blunt face and tired inexpensive eyes; no makeup or concert smile.
ell('Broad padded rabbit head',(0,-.004,1.455),(.215,.178,.209),1,'head',n=32,r=18)
for s in [-1,1]:
 x=s*.083;z=1.481+(s<0)*.004
 ell('Recessed eye socket '+str(s),(x,.146,z),(.078,.043,.087),12,'head',1,n=22,r=12)
 ell('Cloudy old glass eye '+str(s),(x,.177,z-.006),(.060,.046,.069),11,'head',1,n=24,r=14)
 ell('Muted olive iris '+str(s),(x-s*.004,.218,z-.018),(.027,.009,.030),9,'head',1,n=18,r=8)
 ell('Small tired pupil '+str(s),(x-s*.004,.226,z-.017),(.012,.004,.018),10,'head',1,n=14,r=8)
 ell('Weak eye reflection '+str(s),(x-.008,.230,z-.008),(.0035,.002,.0045),14,'head',1,n=8,r=4)
 rr=[];n=24
 for j in range(7):
  a=j*math.pi/12;r=max(.0002,math.cos(a));rr.append([(x+.073*r*math.cos(math.tau*k/n),.179+.052*r*math.sin(math.tau*k/n),z+.005+.080*math.sin(a)) for k in range(n)])
 C.rings('Heavy plain sleepy eyelid '+str(s),rr,1,'head')
 line('Eyelid fabric lower rim '+str(s),[(x-.067,.197,z+.008),(x-.032,.230,z+.002),(x+.032,.230,z+.002),(x+.067,.197,z+.008)],.004,2,'head',n=5)
 line('Plain padded brow '+str(s),[(x-s*.056,.146,z+.071),(x,.140,z+.100),(x+s*.051,.122,z+.088)],.014,1,'head',n=8)
 # Large blunt paired muzzle cushions below the eyes.
 ell('Blunt cream muzzle pad '+str(s),(s*.067,.184,1.371),(.099,.089,.067),3,'head',n=24,r=12,rot=(0,-s*.13,0))
 for j in range(3):
  disk('Muzzle whisker pit '+str(s)+str(j),(s*(.080+j*.025),.269-j*.015,1.38+(j%2)*.017),.0033,.003,6,'head',1,n=8)
 # A few thick short whiskers remain readable without copying a face asset.
 for j in range(2):line('Stubby bent whisker '+str(s)+str(j),[(s*.118,.24,1.357+j*.034),(s*.173,.26,1.357+j*.047),(s*.224,.238,1.353+j*.055)],.0019,7,'head',1,n=5)
ell('Small dark rabbit mouth',(0,.16,1.316),(.12,.081,.055),10,'head',1,n=24,r=10)
ell('Blunt padded chin',(0,.15,1.288),(.119,.065,.041),2,'jaw',n=22,r=10)
for s in [-1,1]:box('Blunt buck tooth '+str(s),(s*.027,.235,1.312),(.048,.040,.071),14,'jaw',1,bevel=.008,rot=(0,s*.04,0))
ell('Plain black rabbit nose',(0,.256,1.398),(.042,.031,.026),10,'head',1,n=20,r=10)
line('Short nose cleft',[(0,.265,1.383),(0,.273,1.357)],.0025,6,'head',1,n=5)
line('Head stitched center seam',[(0,-.02,1.663),(0,.102,1.614),(0,.164,1.545),(0,.177,1.479),(0,.175,1.417)],.0021,13,'head',n=5)
stitches('Forehead repair',(.004,.155,1.573),(.005,.175,1.503),5,'head',width=.014)
line('Back head shell seam',[(0,-.05,1.653),(0,-.163,1.548),(0,-.182,1.449),(0,-.138,1.318)],.0022,12,'head',n=5)
stitches('Back head repair',(.003,-.183,1.43),(.003,-.17,1.52),5,'head')

# Two broad padded ears with different fold heights and their own hinges.
def ear_segment(name,points,widths,depths,bn):
 pts=[Vector(p) for p in points];rr=[];inner=[]
 for j,p in enumerate(pts):
  tangent=(pts[min(j+1,len(pts)-1)]-pts[max(0,j-1)]).normalized();side=Vector((tangent.z,0,-tangent.x)).normalized();w=widths[j];d=depths[j]
  rr.append([p+side*(w*math.cos(math.tau*k/12))+Vector((0,d*math.sin(math.tau*k/12),0)) for k in range(12)])
  inner.append([p+side*(w*.67*math.cos(math.tau*k/10))+Vector((0,d*.90+.008*math.sin(math.tau*k/10),0)) for k in range(10)])
 C.rings(name,rr,1,bn);C.rings(name+' faded pink-gray inset',inner,5,bn)
 for j in range(1,len(pts)-1):
  p=pts[j];stitches(name+' panel cross stitch '+str(j),(p.x-.025,p.y+depths[j]+.008,p.z-.015),(p.x+.025,p.y+depths[j]+.008,p.z+.015),3,bn,width=.010)
for label,s in [('R',-1),('L',1)]:ell(label+' ear root repaired hinge',REST['ear_base_'+label][0],(.048,.041,.034),0,'ear_base_'+label,1,n=16,r=8)
ear_segment('Taller mostly upright left padded ear',[(.115,0,1.64),(.13,0,1.75),(.143,0,1.86),(.15,.01,1.95)],[.035,.053,.051,.036],[.037,.039,.038,.031],'ear_base_L')
ear_segment('Left soft ear tip fold',[(.15,.01,1.95),(.176,.03,1.953),(.191,.05,1.929),(.201,.064,1.906)],[.036,.036,.028,.016],[.031,.030,.026,.019],'ear_tip_L')
ell('Left continuous cloth fold',(.151,.01,1.943),(.04,.032,.026),1,'ear_tip_L',n=16,r=8)
ell('Left worn ear tip',(.204,.064,1.896),(.023,.022,.024),7,'ear_tip_L',1,n=14,r=8)
ear_segment('Shorter right bent ear', [(-.118,0,1.642),(-.154,.0,1.728),(-.216,.008,1.792),(-.256,.014,1.781)],[.033,.048,.052,.039],[.035,.038,.038,.033],'ear_base_R')
ear_segment('Right hanging ear flap',[(-.256,.014,1.781),(-.319,.03,1.72),(-.360,.046,1.637),(-.379,.054,1.595)],[.039,.054,.044,.020],[.033,.036,.030,.020],'ear_tip_R')
ell('Right cloth bend bridge',(-.252,.014,1.775),(.047,.035,.033),1,'ear_tip_R',n=16,r=8)
ell('Right worn ear tip',(-.382,.054,1.583),(.027,.024,.029),7,'ear_tip_R',1,n=14,r=8)

# A plain faded burgundy bow sits over a mechanically credible drum harness.
C.bow('Plain old burgundy bow tie',(0,.147,1.224),.145,4,'chest')
for s in [-1,1]:
 strap('Harness over shoulder '+str(s),[(s*.19,.277,.936),(s*.177,.218,1.059),(s*.162,.140,1.19),(s*.15,.015,1.278),(s*.15,-.106,1.209),(s*.12,-.206,1.10),(s*.06,-.235,1.05),(0,-.249,.998),(-s*.09,-.226,.93),(-s*.155,-.189,.88)])
 box('Harness plain front buckle '+str(s),(s*.184,.244,1.033),(.045,.016,.060),7,'prop_harness',1,bevel=.004)
 box('Harness buckle dark center '+str(s),(s*.184,.254,1.033),(.027,.006,.041),6,'prop_harness',1,bevel=.002)
 # Hook and lower attachment run forward from strap to drum rear rim.
 tube('Harness rigid snare hook '+str(s),[(s*.19,.277,.936),(s*.196,.301,.911),(s*.20,.326,.946)],.007,7,'prop_harness',1,n=8)
 for z in [1.17,1.115]:disk('Harness front tack '+str(s)+str(z),(s*.167,.182 if z>1.15 else .205,z),.005,.006,7,'prop_harness',1,n=8)
C.ellipse_loop('Continuous harness waist belt',(0,-.015,.91),.286,.218,.013,6,'prop_harness',n=42,tube_n=6)
box('Harness flat rear cross plate',(0,-.247,1.03),(.091,.019,.107),7,'prop_harness',1,bevel=.006)
for x in [-.03,.03]:
 for z in [1.0,1.062]:disk('Rear harness plate rivet '+str(x)+str(z),(x,-.260,z),.006,.006,6,'prop_harness',1,n=8)

# Detachable old snare, wide enough to read at normal mobile distance.
cx,cy,cz=0,.482,.853;radius=.247;top=.978;bottom=.728
C.lathe('DETACHABLE snare faded wooden shell',(cx,cy,cz),[(-.120,radius),(.120,radius)],8,'prop_snare',n=32)
for z in [bottom,top]:
 C.ellipse_loop('Snare dull old rim '+str(z),(0,cy,z),radius+.004,radius+.004,.010,7,'prop_snare',1,n=44,tube_n=8)
 C.ellipse_loop('Snare dark hoop seam '+str(z),(0,cy,z+(.018 if z==bottom else -.018)),radius+.001,radius+.001,.003,6,'prop_snare',1,n=36,tube_n=5)
C.lathe('Snare worn drum head',(0,cy,top-.006),[(0,.237),(.003,.237)],3,'prop_snare',n=32)
for j in range(10):
 a=math.tau*j/10;da=math.tau/10*.43
 # Subdivided curved diamonds follow the actual cylindrical shell.
 verts=[];faces=[]
 for width,z in [(.0001,bottom+.023),(da,cz),(.0001,top-.023)]:
  for k in range(7):
   theta=a-width+2*width*k/6;verts.append(((radius+.003)*math.cos(theta),cy+(radius+.003)*math.sin(theta),z))
 for row in range(2):
  for k in range(6):
   i=row*7+k;faces.append((i,i+1,i+8,i+7))
 C.mesh('Snare faded burgundy diamond '+str(j),verts,faces,4,'prop_snare',smooth=False)
 x,y=(radius+.012)*math.cos(a+math.pi/10),cy+(radius+.012)*math.sin(a+math.pi/10)
 tube('Snare old tension rod '+str(j),[(x,y,bottom+.008),(x,y,top-.008)],.004,7,'prop_snare',1,n=7)
 for z in [bottom+.016,top-.016]:ell('Snare rod nut '+str(j)+str(z),(x,y,z),(.009,.009,.011),7,'prop_snare',1,n=8,r=5)
# Subtle ring marks are authored texture geometry, no decals or extra material.
C.ellipse_loop('Snare faded strike wear',(0,cy,top-.002),.12,.12,.0018,13,'prop_snare',n=30,tube_n=5)

# Normalize to the requested height without changing a predecessor master.
pts=[v.co for ob in C.PARTS for v in ob.data.vertices];low=min(v.z for v in pts);factor=1.96/(max(v.z for v in pts)-low)
sources=bpy.data.collections.new('EDITABLE Jackrabbit source parts - excluded from GLB');sc.collection.children.link(sources);inventory=[];copies=[]
for ob in C.PARTS:
 for v in ob.data.vertices:v.co=Vector((v.co.x*factor,v.co.y*factor,(v.co.z-low)*factor))
 ob.data.calc_loop_triangles();inventory.append({'name':ob.name,'triangles':len(ob.data.loop_triangles),'bone_groups':[g.name for g in ob.vertex_groups],'pigment_tile':ob.get('atlas_tile')})
 cp=ob.copy();cp.data=ob.data.copy();sc.collection.objects.link(cp);copies.append(cp)
 for col in list(ob.users_collection):col.objects.unlink(ob)
 sources.objects.link(ob)
sources.hide_render=True;sources.hide_viewport=True;bpy.ops.object.select_all(action='DESELECT')
for ob in copies:ob.select_set(True)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();skin=bpy.context.object;skin.name='Jackrabbit_Drummer_Skin'
for tag in ['source_part','rigid_weight','atlas_tile']:
 if tag in skin:del skin[tag]
skin.data.calc_loop_triangles();before=len(skin.data.loop_triangles)
if before>14800:
 dec=skin.modifiers.new('Mobile silhouette preserving simplification','DECIMATE');dec.ratio=14700/before;dec.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=dec.name)
data=bpy.data.armatures.new('Jackrabbit segmented old mascot skeleton');arm=bpy.data.objects.new('Jackrabbit_Drummer_Rig',data);sc.collection.objects.link(arm);skin.select_set(False);arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
def scaled(p):p=Vector(p);return Vector((p.x*factor,p.y*factor,(p.z-low)*factor))
for name,(head,tail,parent) in REST.items():
 b=data.edit_bones.new(name);b.head=scaled(head);b.tail=scaled(tail)
 if name=='root':b.head=(0,0,0);b.tail=(0,0,.07*factor)
 if parent:b.parent=data.edit_bones[parent];b.use_connect=(b.head-b.parent.tail).length<.000001
 b.use_deform=name!='root' and not name.startswith('clavicle')
bpy.ops.object.mode_set(mode='OBJECT');mod=skin.modifiers.new('One influence per articulated padded shell','ARMATURE');mod.object=arm;skin.parent=arm
arm['asset_id']='jackrabbit-drummer';arm['candidate']='v001 classic rabbit side performer - studio only';arm['forward']='Blender +Y / glTF -Z';arm['neutral_total_height_m']=1.96;arm['attack_contact_fraction']=.625;arm['source_concept_sha256']=sc['source_concept_sha256']
bpy.context.view_layer.update();skin.data.calc_loop_triangles()
record={'asset_id':'jackrabbit-drummer','version':'v001','work_order':'WO101','authoring_model':'gpt-6-astra max','blender_version':bpy.app.version_string,'source_concept_sha256':sc['source_concept_sha256'],'source_concept_path':'docs/assets/media/rat-casino-ensemble/v003/construction/jackrabbit-drummer.png','source_prompt_sha256':'7f86d65d29bd3389cf2af8e7f5cf7c74300cec15c87597dacbcb5079e4c37340','source_prompt_path':'docs/assets/media/rat-casino-ensemble/v003/construction/jackrabbit-drummer-prompt.txt','ensemble_sha256':'df8b390adf7750a9a91ce63c13d2df5e033cb7e95c2b3975d6ddbac202439a9f','ensemble_path':'docs/assets/media/rat-casino-ensemble/v003/concept.png','spec':C.SPEC,'height_m':1.96,'construction_scale_factor':factor,'construction_ground_shift':low,'triangles_before_export_simplification':before,'triangles':len(skin.data.loop_triangles),'vertices':len(skin.data.vertices),'material_count':len(skin.data.materials),'texture':{'file':'pigment.png','width':1024,'height':1024,'origin':'Original deterministic worn indigo cloth, cream drum skin and dull mechanical pigment; no external texture.'},'bone_count':len(data.bones),'parts':inventory,'notes':['Broad quiet rabbit is shorter than the 2.15 m lead rat.','One tall folded ear and one lower drooped ear with separate pivots.','Plain faded burgundy bow, broad padded body, small tail, heavy muzzle and buck teeth.','Snare and crossed harness inherit chest; each stick inherits its gripping hand.','One skin, one rigid influence per vertex; source pieces remain editable.']}
(ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n');(ROOT/'source/rig-rest.json').write_text(json.dumps({'rest':REST,'factor':factor,'ground':low,'snare_center':(0,cy,cz),'snare_top':top,'snare_head_surface':top-.003,'snare_head_radius':.237},indent=2)+'\n')
for name in ['common.py','build.py']:
 text=bpy.data.texts.new('WO101 '+name);text.write((ROOT/'source'/name).read_text())
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'jackrabbit-drummer-construction.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(ROOT/'jackrabbit-drummer-checkpoint.glb'),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_yup=True,export_apply=False,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=False)
print(json.dumps({k:record[k] for k in ['triangles','triangles_before_export_simplification','vertices','height_m','material_count','bone_count']}))
