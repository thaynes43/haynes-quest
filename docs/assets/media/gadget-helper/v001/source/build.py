"""WO111 original runaway floating toolbox helper, built only through Blender MCP.

The selected Astra concept supplies proportions, colours and part attachment:
a teal rounded toolbox, ochre lid and strap handle with a plum grip, cream
oval eyes, a wavy mouth, an orange clasp, broad diagonal cream stripes, a
plum hover skirt with three orange-rimmed nozzles, a dark accordion arm with
a blunt oversized wrench on the anatomical LEFT and a teal stabiliser paddle
on the RIGHT. Shapes, painted atlas, rig and acting are original.
Blender +Y forward becomes glTF -Z forward; anatomical left is Blender -X.
"""
import bpy, math, json, hashlib, importlib.util, struct, zlib
from pathlib import Path
from mathutils import Vector, Matrix, Euler
import numpy as np

ROOT=Path('/workspace/haynes-quest/family-eras/gadget-helper/v001')
sc=bpy.context.scene
assert sc.get('work_order')=='WO111' and sc.get('scene_lease')=='active' and sc.get('asset_id')=='gadget-helper'
spec=importlib.util.spec_from_file_location('wo111_gadget_common',ROOT/'source/common.py')
C=importlib.util.module_from_spec(spec);spec.loader.exec_module(C);C.BASE=ROOT.parent

# 0 teal body, 1 deep teal, 2 ochre lid, 3 deep ochre, 4 charcoal-plum grip,
# 5 plum skirt, 6 orange, 7 cream paint, 8 warm cream jaw, 9 ink, 10 wrench
# grey, 11 hose, 12 rivet silver, 13 nozzle throat, 14 catchlight, 15 deep orange
COLORS=['3b8784','2c6866','e3a53c','c58a31','45414a','6e4d5e','d9763a','efdcb6','e8d0a6','2e2729','8f8a84','413b42','b9b0a3','2a2124','fff6e6','b35e2d']
def atlas():
 rng=np.random.default_rng(11103);yy,xx=np.mgrid[0:256,0:256]
 indices=np.zeros((1024,1024),dtype=np.uint8);palette=[]
 for i,h in enumerate(COLORS):
  rgb=np.array([int(h[j:j+2],16)/255 for j in (0,2,4)])
  field=.013*np.sin(xx*.031+yy*.017+i)+.008*np.cos(xx*.071-yy*.039+2*i)
  field+=rng.integers(-1,2,(256,256))*.002
  levels=np.clip(np.round((field+.04)/.0055),0,15).astype(np.uint8)
  for level in range(16):palette.extend(np.round(np.clip(rgb+(-.04+level*.0055),.01,.98)*255).astype(np.uint8).tolist())
  row=3-i//4;col=i%4;indices[row*256:(row+1)*256,col*256:(col+1)*256]=i*16+levels
 def chunk(name,data):return struct.pack('>I',len(data))+name+data+struct.pack('>I',zlib.crc32(name+data)&0xffffffff)
 raw=b''.join(b'\x00'+row.tobytes() for row in indices[::-1])
 png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1024,1024,8,3,0,0,0))+chunk(b'PLTE',bytes(palette))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
 (ROOT/'pigment.png').write_bytes(png)

atlas();C.setup('v001',[('Matte painted toy tin and plum rubber',.82),('Satin eyes, wrench and rivets',.46)])
# Drop any custom scene properties left by the previous author before claiming identity.
for key in list(sc.keys()):
 if not (key.startswith('blendermcp_') or key in ('cycles','work_order','scene_owner','scene_lease','asset_id','asset_version','authoring_model')):del sc[key]
sc['work_order']='WO111';sc['scene_lease']='active';sc['asset_id']='gadget-helper';sc['asset_version']='v001'
sc['candidate_status']="WO111 gadget-helper v001 · Awaiting Tom's review · used in the family release"
sc['authoring_model']='claude-opus-5-5 xhigh'
sc['source_concept_sha256']=hashlib.sha256((ROOT/'concept.png').read_bytes()).hexdigest()
sc['orientation']='Blender +Z up/+Y forward; glTF +Y up/-Z forward; stationary identity floor root; body hovers 0.12 m above the floor at rest'

E=3.3
BODY=dict(a=.42,b=.21,profile=[(.262,.955),(.272,.975),(.29,.99),(.40,1.0),(.56,1.0),(.66,.99),(.69,.982),(.708,.965)])
def body_scale(z):
 pr=BODY['profile']
 for (z0,s0),(z1,s1) in zip(pr,pr[1:]):
  if z0<=z<=z1:return s0+(s1-s0)*(z-z0)/(z1-z0)
 return pr[-1][1]
def front_y(x,z):return C.superloft_surface_y(BODY['a'],BODY['b'],E,x,body_scale(z))

REST={'root':((0,0,0),(0,0,.10),None),
      'body':((0,0,.45),(0,0,.75),'root'),
      'thrusters':((0,0,.18),(0,0,.08),'body'),
      'lid':((0,-.235,.70),(0,-.235,.80),'body'),
      'handle':((0,0,.93),(0,0,1.05),'lid'),
      'pupils':((0,.235,.53),(0,.30,.53),'body'),
      'paddle':((.47,0,.47),(.62,0,.47),'body'),
      'arm_1':((-.44,0,.50),(-.61,0,.505),'body'),
      'arm_2':((-.61,0,.505),(-.675,0,.68),'arm_1'),
      'wrench':((-.675,0,.68),(-.77,0,.89),'arm_2')}

# ---- Painted bands: real bisected edges, cream tile only on the intended side.
def band(center,normal,half):
 n=Vector((normal[0],0,normal[1])).normalized();c=Vector((center[0],0,center[1]))
 return n,c,half,[(c+n*half,n),(c-n*half,n)]
FRONT_BAND=band((-.26,.40),(.57,.82),.05)
BACK_BAND=band((.26,.40),(-.57,.82),.05)
def in_band(b,p):n,c,half,_=b;return abs(n.dot(Vector((p.x,0,p.z))-c))<half
def body_tiles(center,normal):
 if normal.y>.2 and in_band(FRONT_BAND,center):return 7
 if normal.y<-.2 and in_band(BACK_BAND,center):return 7
 return None

# ---- Teal toolbox body, ochre lid with a deeper lower band, plum hover skirt.
C.superloft('Rounded teal toolbox body',(0,0),BODY['a'],BODY['b'],E,BODY['profile'],0,'body',n=44,face_tile=body_tiles,planes=FRONT_BAND[3]+BACK_BAND[3])
lidprofile=[(.672,.985),(.684,1.03),(.738,1.03),(.752,1.0),(.835,.99),(.868,.955),(.888,.88),(.896,.72)]
C.superloft('Ochre toolbox lid with rolled lower band',(0,0),.44,.232,E,lidprofile,2,'lid',n=44,face_tile=lambda c,n:3 if c.z<.745 else None)
skirt=[(.162,.84),(.176,.95),(.20,1.0),(.228,1.012),(.256,.99),(.29,.93)]
C.superloft('Soft plum hover skirt',(0,0),.44,.25,3.2,skirt,5,'body',n=40)

# Orange clasp as the chin, bridging body and skirt.
C.box('Orange clasp plate',(0,.232,.318),(.17,.075,.17),6,'body',bevel=.024,segments=3)
C.box('Raised orange clasp tongue',(0,.270,.29),(.095,.03,.095),15,'body',bevel=.013,segments=2)
C.box('Clasp hinge pin',(0,.25,.40),(.14,.032,.028),6,'body',bevel=.011,segments=2)

# Face: big cream oval eyes, ink pupils glancing toward the wrench, a wavy mouth.
for side in (-1,1):
 ex=side*.128;ez=.545;ey=front_y(ex,ez)-.004
 C.ellipsoid('Cream oval eye '+str(side),(ex,ey,ez),(.072,.036,.100),7,'body',1,n=24,r=12)
 dx,dz=-.017,-.014;q=max(0,1-(dx/.072)**2-(dz/.100)**2)
 py=ey+.036*math.sqrt(q)-.004
 C.ellipsoid('Ink pupil '+str(side),(ex+dx,py,ez+dz),(.033,.014,.049),9,'pupils',1,n=16,r=8)
 C.ellipsoid('Pupil catchlight '+str(side),(ex+dx+.011,py+.011,ez+dz+.019),(.009,.004,.011),14,'pupils',1,n=10,r=5)
mouth=[(-.058+.116*i/12,.438+.0085*math.sin(math.pi*3*i/12)) for i in range(13)]
C.tube('Wavy little mouth',C.catmull([(x,front_y(x,z)+.003,z) for x,z in mouth],2),.0085,9,'body',n=7)

# Rounded rivets follow the shell normal.
def rivet(name,x,z,side,bn='body',surface=None):
 if side in (1,-1):
  y=(surface or front_y)(x,z)
  nx=abs(x)**3/.42**4;ny=abs(y)**3/.21**4;ang=math.atan2(nx,ny)*math.copysign(1,x)
  C.ellipsoid(name,(x,side*(y+.001),z),(.019,.011,.019),12,bn,1,n=10,r=4,rot=(0,0,-ang*side))
 else:
  C.ellipsoid(name,(x,0,z),(.011,.019,.019),12,bn,1,n=10,r=4)
for side in (1,-1):
 for x in (-.30,.30):
  for z in (.34,.645):rivet('Body rivet %s %.2f %.2f'%(side,x,z),x,z,side)
def side_x(y,z):
 s=body_scale(z);A=BODY['a']*s;B=BODY['b']*s;return A*max(0,1-abs(y/B)**E)**(1/E)
for side in (-1,1):
 for y in (-.075,.075):
  C.ellipsoid('Side rivet %d %.2f'%(side,y),(side*(side_x(y,.64)+.001),y,.64),(.011,.019,.019),12,'body',1,n=10,r=4)
for side in (1,-1):
 for x in (-.31,0,.31):
  y=C.superloft_surface_y(.44,.232,E,x,1.03)
  C.ellipsoid('Lid band rivet %d %.2f'%(side,x),(x,side*(y+.001),.711),(.017,.010,.017),12,'lid',1,n=10,r=4)

# ---- Hinged strap handle with a ribbed dark grip.
hx=.325;hz=.925;top=1.05;rr=.075
path=[(-hx,0,hz-.02),(-hx,0,hz+.03),(-hx,0,top-rr)]
for i in range(1,7):a=math.pi-math.pi/2*i/6;path.append((-hx+rr+rr*math.cos(a),0,top-rr+rr*math.sin(a)))
path+=[(-.1,0,top),(.1,0,top)]
for i in range(0,6):a=math.pi/2-math.pi/2*i/6;path.append((hx-rr+rr*math.cos(a),0,top-rr+rr*math.sin(a)))
path+=[(hx,0,top-rr),(hx,0,hz+.03),(hx,0,hz-.02)]
C.sweep('Ochre folding strap handle',path,.042,.050,3.0,3,'handle',n=14)
grip=[]
for i in range(31):
 x=-.205+.41*i/30;rib=.5+.5*math.cos(math.tau*5*i/30)
 grip.append((x,.058+.012*rib))
grip=[(-.215,.036),(-.212,.058)]+grip+[(.212,.058),(.215,.036)]
C.lathe('Ribbed charcoal plum grip',(0,0,top),grip,4,'handle',n=14,axis='x')
for side in (-1,1):
 C.lathe('Handle hinge boss '+str(side),(side*.372,0,.93),[(-.028,.052),(-.024,.059),(.024,.059),(.028,.052)],4,'lid',n=20,axis='x')
 C.ellipsoid('Hinge rivet '+str(side),(side*.401,0,.93),(.011,.024,.024),12,'lid',1,n=10,r=4)
 C.box('Handle foot bracket '+str(side),(side*.34,0,.894),(.11,.118,.05),3,'lid',bevel=.016,segments=2)

# ---- Hover nozzles with orange rims and dark throats (retract on defeat).
for x in (-.225,0,.225):
 C.lathe('Dark nozzle can %.3f'%x,(x,0,0),[(.112,.070),(.118,.073),(.198,.069),(.21,.060)],4,'thrusters',n=22)
 C.lathe('Orange nozzle rim %.3f'%x,(x,0,0),[(.120,.052),(.106,.053),(.1,.062),(.1,.072),(.104,.079),(.113,.081),(.122,.077)],6,'thrusters',n=22,caps=False)
 C.lathe('Nozzle throat %.3f'%x,(x,0,0),[(.114,.0001),(.114,.053)],13,'thrusters',n=22,caps=False)

# ---- Stabiliser paddle on the anatomical RIGHT (+X), swept back 25 degrees.
C.box('Grey paddle bracket',(.447,0,.47),(.075,.085,.105),10,'paddle',bevel=.018,segments=2)
C.lathe('Orange paddle pivot',(.47,0,.47),[(-.05,.032),(-.045,.038),(.045,.038),(.05,.032)],6,'paddle',n=16,axis='y')
fin=[(0,.07),(.03,.115),(.085,.13),(.14,.112),(.175,.06),(.172,-.02),(.14,-.10),(.095,-.155),(.055,-.17),(.025,-.13),(.008,-.05),(0,0)]
fin=[(p.x,p.z) for p in C.catmull([(u,0,v) for u,v in fin+[fin[0]]],3)][:-1]
sweepback=math.radians(-25)
FIN=Matrix.Translation((.478,0,.47))@Matrix.Rotation(sweepback,4,'Z')
FIN_INV=FIN.inverted()
fin_n=Vector((-.33,0,.944)).normalized();fin_c=Vector((.10,0,-.035))
def fin_tiles(center,normal):
 p=FIN_INV@center;return 7 if abs(fin_n.dot(Vector((p.x,0,p.z))-fin_c))<.026 else None
C.plate('Teal stabiliser paddle fin',fin,0,.042,0,'paddle',bevel=.014,segments=2,transform=FIN,face_tile=fin_tiles,planes=[(fin_c+fin_n*.026,fin_n),(fin_c-fin_n*.026,fin_n)])
C.ellipsoid('Paddle rivet front',(.47,.052,.47),(.016,.008,.016),12,'paddle',1,n=10,r=4)

# ---- Accordion arm on the anatomical LEFT (-X), ending in a blunt wrench.
C.lathe('Orange shoulder collar',(-.40,0,.50),[(.02,.076),(0,.090),(-.05,.090),(-.07,.082),(-.07,.076)],6,'body',n=22,axis='x',caps=True)
hose=C.catmull([(-.43,0,.50),(-.50,0,.50),(-.57,0,.515),(-.625,0,.556),(-.66,0,.615),(-.675,0,.68)],10)
hs,hlen=C.arclength(hose)
ribs=8
radii=[(.057+.015*(.5+.5*math.cos(math.tau*ribs*s)))*(1-.32*C.smooth((s-.88)/.12)) for s in hs]
def hose_weights(p):
 # Nearest path parameter, then a smooth body→arm_1→arm_2→wrench chain.
 i=min(range(len(hose)),key=lambda k:(hose[k]-Vector(p)).length);s=hs[i]
 if s<.12:t=C.smooth(s/.12);return {'body':1-t,'arm_1':t}
 if s<.38:return {'arm_1':1}
 if s<.60:t=C.smooth((s-.38)/.22);return {'arm_1':1-t,'arm_2':t}
 if s<.84:return {'arm_2':1}
 t=C.smooth((s-.84)/.16);return {'arm_2':1-t,'wrench':t}
C.tube('Dark flexible accordion hose',hose,radii,11,'arm_1',n=12,weights=hose_weights)
W=Vector((-.675,0,.68));H=Vector((-.77,0,.89));d=(H-W).normalized()
C.lathe('Orange wrist pivot drum',tuple(W),[(-.046,.058),(-.042,.068),(.042,.068),(.046,.058)],6,'wrench',n=20,axis='y')
for s in (-1,1):C.ellipsoid('Wrist rivet '+str(s),(W.x,s*.047,W.z),(.02,.008,.02),12,'wrench',1,n=10,r=4)
# Rounded wrench shaft (flat bar) and the open C head, both in the XZ plane.
ang=math.atan2(d.z,d.x)
shaft=[(0,-.042),(.15,-.049),(.15,.049),(0,.042)]
SH=Matrix.Translation(W+d*.035)@Matrix.Rotation(-ang,4,'Y')
C.plate('Grey wrench shaft',shaft,0,.052,10,'wrench',mat=1,bevel=.016,segments=2,transform=SH)
Rout=.145;Rin=.058;open_dir=ang;half=math.radians(40);N=26
head=[]
for i in range(N+1):
 a=open_dir+half+(math.tau-2*half)*i/N;head.append((Rout*math.cos(a),Rout*math.sin(a)))
for i in range(N,-1,-1):
 a=open_dir+half+(math.tau-2*half)*i/N;head.append((Rin*math.cos(a),Rin*math.sin(a)))
HC=W+d*.265
cream_span=half+math.radians(30)
def jaw_tiles(center,normal):
 a=math.atan2(center.z-HC.z,center.x-HC.x);delta=abs((a-open_dir+math.pi)%math.tau-math.pi)
 return 8 if delta<cream_span else None
jaw_planes=[((0,0,0),(-math.sin(open_dir+s*cream_span),0,math.cos(open_dir+s*cream_span))) for s in (-1,1)]
C.plate('Grey open wrench head with cream jaw ends',head,0,.060,10,'wrench',mat=1,bevel=.018,segments=2,transform=Matrix.Translation(HC),face_tile=jaw_tiles,planes=jaw_planes)
for s in (-1,1):
 a=open_dir+s*(half+math.radians(12));rm=(Rout+Rin)/2
 c=HC+Vector((rm*math.cos(a),0,rm*math.sin(a)))
 C.ellipsoid('Rounded cream mitten jaw tip '+str(s),tuple(c),(.056,.046,.064),8,'wrench',1,n=14,r=8,rot=(0,-a,0))
for s in (-1,1):C.ellipsoid('Wrench head rivet '+str(s),(HC.x+.088*math.cos(open_dir+math.pi),s*.031,HC.z+.088*math.sin(open_dir+math.pi)),(.014,.007,.014),12,'wrench',1,n=10,r=4)

# ---- Join a copy of every part into one skin; keep the editable parts hidden.
sources=bpy.data.collections.new('EDITABLE original gadget helper parts - excluded from export');sc.collection.children.link(sources)
inventory=[];copies=[]
for ob in C.PARTS:
 ob.data.calc_loop_triangles();inventory.append({'name':ob.name,'triangles':len(ob.data.loop_triangles),'bone_groups':[g.name for g in ob.vertex_groups],'atlas_tile':ob.get('atlas_tile')})
 cp=ob.copy();cp.data=ob.data.copy();sc.collection.objects.link(cp);copies.append(cp)
 for col in list(ob.users_collection):col.objects.unlink(ob)
 sources.objects.link(ob)
sources.hide_render=True;sources.hide_viewport=True
bpy.ops.object.select_all(action='DESELECT')
for ob in copies:ob.select_set(True)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();skin=bpy.context.object;skin.name='Gadget_Helper_Skin'
for tag in ['source_part','rigid_weight','atlas_tile']:
 if tag in skin:del skin[tag]
skin.data.calc_loop_triangles();tris=len(skin.data.loop_triangles);assert tris<=15000,tris
data=bpy.data.armatures.new('Original gadget helper hover rig');arm=bpy.data.objects.new('Gadget_Helper_Rig',data);sc.collection.objects.link(arm)
skin.select_set(False);arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
for name,(head_,tail_,parent) in REST.items():
 b=data.edit_bones.new(name);b.head=head_;b.tail=tail_
 if parent:b.parent=data.edit_bones[parent]
 b.use_deform=True
bpy.ops.object.mode_set(mode='OBJECT');mod=skin.modifiers.new('Attached toy skin','ARMATURE');mod.object=arm;skin.parent=arm
pts=[v.co for v in skin.data.vertices]
lo=[min(p[k] for p in pts) for k in range(3)];hi=[max(p[k] for p in pts) for k in range(3)]
arm['asset_id']='gadget-helper';arm['version']='v001';arm['forward']='Blender +Y / glTF -Z';arm['neutral_total_height_m']=round(hi[2],4);arm['hover_gap_m']=round(lo[2],4);arm['attack_contact_fraction']=.625
record={'asset_id':'gadget-helper','version':'v001','work_order':'WO111','authoring_model':'claude-opus-5-5 xhigh (Claude Code subagent; Tom ruled Sept 26 that Opus 5.5 continues WO111 Blender work)','blender_version':bpy.app.version_string,'source_concept_sha256':sc['source_concept_sha256'],
 'rest_bounds_blender_z_up':{'min':lo,'max':hi},'height_m':hi[2],'hover_gap_m':lo[2],'triangles':tris,'vertices':len(skin.data.vertices),'material_count':len(skin.data.materials),'bone_count':len(data.bones),
 'texture':{'file':'pigment.png','width':1024,'height':1024,'origin':'Original deterministic soft painted palette atlas generated in Blender Python; no external textures.','palette':COLORS},
 'parts':inventory,
 'concept_resolution':['Front and back concept views are attachment authority: accordion wrench arm on anatomical LEFT (Blender -X, viewer right in front view), stabiliser paddle on anatomical RIGHT (+X).','The middle concept view is a construction study, not a true side; the box depth is resolved at 0.42 m body / 0.49 m skirt, following the brief.','Body hovers at rest: the lowest nozzle rim is 0.12 m above the floor; root stays at the floor origin.','Diagonal cream stripes are bisected paint bands: front band rises from behind the clasp to the wrench-side corner, back band to the paddle side, as in the concept front/back views.'],
 'notes':['Original toolbox gadget; no mouse ears, TV face, franchise logo, lettering or borrowed media.','Blunt wrench with rounded cream jaw tips; no blades, sparks or threatening face.','Every part is skinned to one rig; nozzles retract into the skirt only for the defeat landing.']}
(ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n');(ROOT/'source/rig-rest.json').write_text(json.dumps({'rest':REST},indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'gadget-helper-construction.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(ROOT/'gadget-helper-checkpoint.glb'),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_yup=True,export_apply=False,export_armature_object_remove=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=True)
print(json.dumps({k:record[k] for k in ['triangles','vertices','height_m','hover_gap_m','material_count','bone_count','rest_bounds_blender_z_up']}))
