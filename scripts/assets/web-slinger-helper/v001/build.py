"""WO111 web-slinger-helper v001: final budgeted friendly model from the approved Blender reference sheet.

Source authority: reference-sheet.png and web-slinger-helper-blockout.blend (coordinator approved Sept 26,
"Blender reference sheet, no generated concept"). The blockout's measured coordinates supply the silhouette, colours
and parody hooks: the open-face cobalt hood with its rolled rim and cream dew-drop web, the round face with the
tangerine domino mask, big friendly eyes, button nose, open grin and pink cheeks, the chestnut fringe, the cobalt kid
suit with the sunny star emblems inside cream webs, the tangerine belt with a sunny buckle and the cream web-rope
coil on a tangerine clip, sunny mitten gloves with flared cuffs and chunky tangerine web-shooter cuffs with pink heart
buttons and cream nozzles, cobalt leggings and sunny rain boots with rolled cuffs and plum soles. Topology, atlas,
UVs, weights, rig and clips are new. Webs, grin, blush, iris/pupil/glints and finger grooves are painted into the
atlas (paint.py) at the blockout's projected positions, as the sheet notes suggested; the silhouette parts stay
geometry. The defeat's rope tangle is extra geometry bound collapsed inside the left boot.

Blender +Z up / +Y forward (glTF +Y up / -Z forward), floor-centred root, right = +X.
Bind pose: neutral (see rig.py); the sheet pose is recreated at idle 0 s.
"""
import bpy, math, json, hashlib, importlib.util
from pathlib import Path
from mathutils import Vector, Matrix, Euler

ROOT=Path('/workspace/haynes-quest/family-eras/web-slinger-helper/v001')
sc=bpy.context.scene
assert sc.get('work_order')=='WO111' and sc.get('scene_lease')=='active' and sc.get('asset_id')=='web-slinger-helper'
def load(name):
 spec=importlib.util.spec_from_file_location('wo111_wsh_'+name,ROOT/('source/%s.py'%name));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
C=load('common');P=load('paint');RG=load('rig')
T=P.T;SUIT,CREAM,SUN,TANG,SKIN,HAIR,HEART,SOLE,SUIT_D,SUN_D,TANG_D=(T[k] for k in P.TILES)
V=RG.V

atlas=P.paint_atlas(str(ROOT/'pigment.png'))
keep={k:sc[k] for k in sc.keys() if k.startswith('blendermcp_') or k in ('work_order','scene_owner','scene_lease','asset_id','asset_version','authoring_model')}
C.setup(ROOT,[('Matte painted suit, skin, gloves and boots',.62,0.0),('Glowing heart buttons',.30,0.35)],ROOT/'pigment.png','web-slinger-helper original painted 1024 atlas',P.TILE_RECTS)
for key in list(sc.keys()):
 if key not in keep and key!='cycles':del sc[key]
sc['candidate_status']="WO111 web-slinger-helper v001 · Awaiting Tom's review · used in the family release"
sc['source_reference']='Blender reference sheet, no generated concept'
sc['source_sheet_sha256']=hashlib.sha256((ROOT/'reference-sheet.png').read_bytes()).hexdigest()
sc['source_blockout_sha256']=hashlib.sha256((ROOT/'web-slinger-helper-blockout.blend').read_bytes()).hexdigest()
sc['orientation']='Blender +Z up/+Y forward; glTF +Y up/-Z forward; stationary identity floor root; character right = +X'
sc['role']='friendly helper (DESIGN-013): heals the player; never an enemy'

# the face ellipsoid is authored round the origin and placed by a pure translation to FC
C.REGIONS['FACE']=lambda p,c:P.face_px(p.x+RG.FC.x,p.z+RG.FC.z)
C.REGIONS['HOOD']=lambda p,c:P.hood_px(p)
C.REGIONS['TF']=lambda p,c:P.torso_px(p,True)
C.REGIONS['TB']=lambda p,c:P.torso_px(p,False)
C.REGIONS['EYE']=lambda p,c:P.eye_px(p.x,p.z)
# the mitten ellipsoid is authored round its own centre, MITTEN_C along the hand axis from the wrist
C.REGIONS['MITT']=lambda p,c:P.mitt_px(p.x,p.z+RG.MITTEN_C)
smooth=C.smooth

# ================= weights =================
def torso_w(p):
 a=smooth((p.z-0.50)/0.09);b=smooth((p.z-0.64)/0.08)
 return {'hips':1-a,'spine':a*(1-b),'chest':a*b}
def neck_w(p):
 n1=smooth((p.z-0.77)/0.025);n2=smooth((p.z-0.80)/0.025)
 return {'chest':1-n1,'neck':n1*(1-n2),'head':n1*n2}
def path_w(path,us,names,edges,width=0.12):
 def f(p):
  i=min(range(len(path)),key=lambda k:(path[k]-p).length);u=us[i];w={}
  for k,name in enumerate(names):
   lo=edges[k];hi=edges[k+1]
   a=smooth((u-lo)/width+.5) if k>0 else 1.0
   b=1-smooth((u-hi)/width+.5) if k<len(names)-1 else 1.0
   w[name]=w.get(name,0)+max(0.0,a*b)
  return w
 return f

# ================= head =================
# Cobalt hood: the blockout construction (rows from the opening's exact rim to the back pole along great circles).
NPSI=48;NT=15;back=V(0.0,-1.0,0.0);boundary=[]
HC,HR=RG.HC,RG.HRAD
for i in range(NPSI):
 psi=-math.pi/2+math.tau*i/NPSI;x=RG.HOLE_AX*math.cos(psi);z=RG.HOLE_ZC+RG.HOLE_AZ*math.sin(psi)
 q=max(0.0,1-(x/HR.x)**2-((z-HC.z)/HR.z)**2);boundary.append(V(x,HC.y+HR.y*math.sqrt(q),z))
verts=[]
for ti in range(NT):
 t=(ti/NT)**1.0
 for b in boundary:
  u0=V((b.x-HC.x)/HR.x,(b.y-HC.y)/HR.y,(b.z-HC.z)/HR.z).normalized()
  om=u0.angle(back);u=(math.sin((1-t)*om)*u0+math.sin(t*om)*back)/math.sin(om)
  verts.append(HC+V(u.x*HR.x,u.y*HR.y,u.z*HR.z))
pole=len(verts);verts.append(HC+V(0.0,-HR.y,0.0));faces=[]
for ti in range(NT-1):
 a=ti*NPSI;b=(ti+1)*NPSI;faces+=[(a+i,a+(i+1)%NPSI,b+(i+1)%NPSI,b+i) for i in range(NPSI)]
a=(NT-1)*NPSI;faces+=[(a+i,a+(i+1)%NPSI,pole) for i in range(NPSI)]
hood=C.mesh('Cobalt open-face hood with the painted dew-drop web',verts,faces,'HOOD','head')
C.oriented(hood,HC)
# rolled rim round the face opening
rim=[boundary[i] for i in range(0,NPSI,1)]
C.tube('Cobalt hood face rim',rim,[0.0135,0.0135],SUIT,n=8,bn='head',closed_loop=True)
# round face
C.ellipsoid('Round face with the painted grin, blush and nose shade',tuple(RG.FC),tuple(RG.FR),SKIN,'head',n=28,r=14,face_tile=lambda c,n:'FACE' if n.y>0.2 else None)
# tangerine domino mask: a thin shell on the face, its wings under the rim, its top arching over each eye
C.conformal_decal('Tangerine domino mask',C.chaikin(P.mask_outline(0),1),RG.face_pt,0.0062,-0.001,TANG,TANG_D,'mask',rings_n=4)
# big friendly eyes standing out from the mask (iris, pupil and glints painted in the shared eye projection)
eyes={}
for s,sx in (('R',1),('L',-1)):
 p,n=RG.face_pt(0.052*sx,1.0);nf=(n*0.55+V(0,1,0)*0.45).normalized();M=RG.frame(nf,(0,0,1),p+n*0.004)
 C.ellipsoid('Big friendly eye '+s,(0,0,0),(0.038,0.02,0.046),CREAM,'eye_'+s,n=18,r=10,M=M,face_tile=lambda c,nn:'EYE' if nn.y>0.0 else None)
 eyes[s]=(M.translation.copy(),(M.to_3x3()@V(0,0,1)).normalized())
# button nose
p,n=RG.face_pt(0.0,0.942)
C.ellipsoid('Button nose',(0,0,0),(0.019,0.014,0.015),SKIN,'head',n=10,r=6,M=RG.frame(n,(0,0,1),p+n*0.004))
# chestnut fringe: three locks spilling out under the rim toward its right
roots=[];tips=[]
for k,(x0,L,curl) in enumerate(((-0.085,0.055,0.004),(-0.045,0.06,0.006),(-0.005,0.05,0.004))):
 z0=RG.hole_top(x0)+0.012
 uv=[(x0,z0),(x0+0.35*L,z0-0.012),(x0+0.7*L,z0-0.024),(x0+L,z0-0.032),(x0+L+0.008,z0-0.03+curl)]
 pts=[]
 for u,v in uv:
  pp,nn=RG.face_pt(u,v);pts.append(pp+nn*0.011)
 path=C.catmull_pad(pts,4);_,us=C.sweep_rings(path,[0.018,0.019,0.015,0.008,0.0028],7)
 _,n0=RG.face_pt(uv[0][0],uv[0][1])
 # flattened along the face normal (the blockout's round locks sank 8 mm into the forehead)
 C.tube('Chestnut fringe lock %d'%k,path,[0.018,0.019,0.015,0.008,0.0028],HAIR,n=7,flat=0.55,up=tuple(n0),bn='head',weights=path_w(path,us,['head','fringe'],[0,0.22,1],0.2))
 roots.append(pts[0]);tips.append(pts[-2])
fr_root=sum(roots,V(0,0,0))/3;fr_tip=sum(tips,V(0,0,0))/3
# the six strand-tip dew drops as small bumps (they help the silhouette) plus the crown knot
NM=8;TH_END=1.3;phis=[math.radians(22.5+45*k) for k in range(NM)];drop_count=0
for k,ph in enumerate(phis):
 line=[RG.hood_pt(0.03+(TH_END-0.03)*i/50,ph,1.012) for i in range(51)]
 if not any(RG.in_hole(q,1.17) for q in line):
  C.ellipsoid('Hood web dew drop %d'%k,tuple(RG.hood_pt(TH_END+0.02,ph,1.02)),(0.0095,0.0095,0.0095),CREAM,'head',n=8,r=5);drop_count+=1
C.ellipsoid('Crown web knot',tuple(RG.hood_pt(0.0,0.0,1.012)),(0.0095,0.0095,0.0065),CREAM,'head',n=8,r=5)
C.oriented(C.frustum('Cobalt neck',(0,-0.005,0.762),(0,-0.005,0.85),0.056,0.056,SUIT,n=14,caps=False,weights=neck_w),V(0,-0.005,0.806))

# ================= torso =================
ROWS=[0.395,0.402,0.412,0.425,0.44,0.458,0.478,0.50,0.53,0.565,0.60,0.635,0.67,0.70,0.725,0.748,0.768,0.785,0.797,0.805,0.808]
N_T=32
rr=[[V(RG.torso_r(z)*math.cos(math.tau*(i+.5)/N_T),RG.TORSO_EY*RG.torso_r(z)*math.sin(math.tau*(i+.5)/N_T),z) for i in range(N_T)] for z in ROWS]
def torso_tiles(c,n):
 if c.z<0.495:return None
 return 'TF' if c.y>0 else 'TB'
C.rings('Cobalt torso with the painted chest and back webs',rr,SUIT,weights=torso_w,face_tile=torso_tiles,poles=((0,0,0.392),(0,0,0.811)))
bp=RG.smooth_profile([(RG.BELT[0],RG.torso_r(RG.BELT[0])+0.004),(RG.BELT[0]+0.006,RG.torso_r(RG.BELT[0]+0.006)+0.011),(RG.BELT[1]-0.006,RG.torso_r(RG.BELT[1]-0.006)+0.011),(RG.BELT[1],RG.torso_r(RG.BELT[1])+0.004)],step=0.002)
brows=[bp[int(round(k*(len(bp)-1)/6))] for k in range(7)]
rr=[[V(r*math.cos(math.tau*(i+.5)/N_T),RG.TORSO_EY*r*math.sin(math.tau*(i+.5)/N_T),z) for i in range(N_T)] for z,r in brows]
C.oriented(C.rings('Tangerine belt',rr,TANG,'hips',caps=False),V(0,0,0.472))
fmap=RG.torso_map(True);bmap=RG.torso_map(False)
p,n=fmap(0.0,0.472)
C.frustum('Sunny belt buckle',p+n*0.004,p+n*0.017,0.024,0.024,SUN,'hips',n=16,bevel=0.003)
C.conformal_decal('Sunny chest star emblem',C.star_outline(0.0,RG.STAR_Z,0.075,0.037,RG.STAR_TILT,2),fmap,0.007,-0.002,SUN,SUN_D,rings_n=3,weights=torso_w)
C.conformal_decal('Sunny back star emblem',C.star_outline(0.0,RG.STAR_Z+0.01,0.052,0.026,-RG.STAR_TILT,2),bmap,0.007,-0.002,SUN,SUN_D,rings_n=3,weights=torso_w)
C.ellipsoid('Cobalt seat',(0,-0.004,0.44),(0.128,0.094,0.07),SUIT,'hips',n=16,r=8)
# web-rope coil on its tangerine clip at the right hip
C.frustum('Tangerine coil clip',RG.CLIP_P+RG.CLIP_N*0.004,RG.CLIP_P+RG.CLIP_N*0.062,0.016,0.016,TANG,'coil',n=12)
for k in range(3):
 Ax=RG.COIL_A+V(0,0,0.06*(k-1));Ax.normalize();X=Ax.orthogonal().normalized();Y=Ax.cross(X)
 c=RG.COIL_C+RG.COIL_A*(0.016*k-0.016)+V(0,0,0.003*k);R=0.044-0.002*k
 C.tube('Cream web-rope coil loop %d'%k,[c+R*(math.cos(math.tau*i/16)*X+math.sin(math.tau*i/16)*Y) for i in range(16)],[0.0085,0.0085],CREAM,n=6,bn='coil',closed_loop=True)

# ================= arms =================
hearts={}
for s,sx in (('R',1),('L',-1)):
 S,E,W=RG.ARM[s];fd=(W-E).normalized()
 C.ellipsoid('Cobalt shoulder '+s,tuple(S),(0.058,0.056,0.058),SUIT,'upper_arm_'+s,n=16,r=8)
 ctrl=[S,S.lerp(E,.5),E,E.lerp(W,.5),W-fd*0.06]
 path=C.catmull_pad(ctrl,4);acc=C.arclength(path)
 iE=min(range(len(path)),key=lambda k:(path[k]-E).length);sE=acc[iE]
 def arm_w(p,path=path,acc=acc,sE=sE,s=s):
  i=min(range(len(path)),key=lambda k:(path[k]-p).length);t=smooth((acc[i]-(sE-0.045))/0.09)
  return {'upper_arm_'+s:1-t,'forearm_'+s:t}
 rr,_=C.sweep_rings(path,[0.048,0.046,0.043,0.041,0.040],10,1.0,(0,1,0))
 C.rings('Cobalt sleeve '+s,rr,SUIT,weights=arm_w,poles=(path[0]-(path[1]-path[0]).normalized()*0.02,path[-1]+fd*0.02))
 # glove flare, web-shooter cuff, nozzle and heart button at the blockout's sheet coordinates, carried to rest
 FM=RG.FORE_MAP[s];Ss,Es,Ws=RG.SHEET_CHAIN[s];Ts=RG.SHEET_T[s]
 bd=RG.BUTTON_DIR[s]-RG.BUTTON_DIR[s].dot(Ts)*Ts;bd.normalize()
 C.frustum('Sunny glove flare '+s,Ws-Ts*0.095,Ws-Ts*0.005,0.052,0.036,SUN,'forearm_'+s,n=14,transform=FM)
 C.frustum('Tangerine web-shooter cuff '+s,Ws-Ts*0.068,Ws-Ts*0.022,0.056,0.054,TANG,'forearm_'+s,n=16,bevel=0.006,transform=FM)
 q=(bd*0.35+Ts.cross(bd)*0.94).normalized()
 C.frustum('Cream web nozzle '+s,Ws-Ts*0.045+q*0.05,Ws-Ts*0.045+q*0.064,0.0095,0.0075,CREAM,'forearm_'+s,n=8,transform=FM)
 hc=Ws-Ts*0.045+bd*0.058
 C.prism('Pink heart button '+s,C.heart_outline(0.044,24),0.009,HEART,'heart_'+s,1,M=FM@RG.frame(bd,(0,0,1),hc))
 hearts[s]=(FM@hc,(FM.to_3x3()@bd).normalized())
 # sunny mitten with a painted palm, the thumb on its own bone, fingers on a knuckle bone
 HM=RG.hand_matrix(s);HI=HM.inverted()
 def mitt_w(p,HI=HI,s=s):
  z=(HI@p).z;t=smooth((z-0.050)/0.034);return {'hand_'+s:1-t,'fingers_'+s:t}
 C.ellipsoid('Sunny mitten '+s,(0,0,RG.MITTEN_C),RG.MITTEN_S,SUN,'hand_'+s,n=16,r=10,transform=HM,weights=mitt_w,face_tile=lambda c,nn:'MITT' if nn.y>0.35 else None)
 C.ellipsoid('Sunny mitten thumb '+s,tuple(RG.THUMB_C),RG.THUMB_S,SUN,'thumb_'+s,n=10,r=6,rot=RG.THUMB_DIR.to_track_quat('Z','Y').to_matrix(),transform=HM)

# ================= legs and boots =================
L_=RG.SOLE_LIFT
for s,sx in (('R',1),('L',-1)):
 H,K,A=RG.LEG[s]
 path=C.catmull_pad([H,K,A+V(0,0,0.045)],6)
 def leg_w(p,s=s):
  z=p.z;w={}
  t=smooth((z-0.40)/0.07);w['hips']=0.55*t;th=1-0.55*t
  k=smooth((0.31-z)/0.05);an=smooth((0.195-z)/0.03)
  w['thigh_'+s]=th*(1-k);w['shin_'+s]=th*k*(1-an);w['foot_'+s]=th*k*an
  return w
 rr,_=C.sweep_rings(path,[0.071,0.062,0.055],12,1.0,(0,1,0))
 C.rings('Cobalt legging '+s,rr,SUIT,weights=leg_w,poles=(H+V(0,0,0.03),A+V(0,0,0.03)))
 C.oriented(C.frustum('Sunny boot shaft '+s,(A.x,A.y,0.035+L_),(A.x,A.y,0.172+L_),0.058,0.061,SUN,'foot_'+s,n=16,caps=False),V(A.x,A.y,0.10))
 X=V(1,0,0);Y=V(0,1,0);c=V(A.x,A.y,0.172+L_)
 C.tube('Sunny rolled boot cuff '+s,[c+0.061*(math.cos(math.tau*i/18)*X+math.sin(math.tau*i/18)*Y) for i in range(18)],[0.015,0.015],SUN,n=6,bn='foot_'+s,closed_loop=True)
 C.ellipsoid('Sunny boot foot '+s,(A.x,A.y+RG.FOOT_FWD,0.052+L_),(0.06,0.098,0.052),SUN,'foot_'+s,n=16,r=8)
 C.ellipsoid('Plum boot sole '+s,(A.x,A.y+RG.FOOT_FWD,0.02+L_),(0.064,0.104,0.02),SOLE,'foot_'+s,n=16,r=6)

# ================= defeat rope tangle (both ankles), bound collapsed inside the left boot =================
def final_world(s,local):
 """Rest-space point on foot s -> world point in the held defeat pose."""
 A=RG.LEG[s][2];return RG.DEFEAT_ANKLE[s]+RG.defeat_foot_rot(s)@(Vector(local)-A)
def to_left_rest(P_):
 A=RG.LEG['L'][2];return A+RG.defeat_foot_rot('L').inverted()@(Vector(P_)-RG.DEFEAT_ANKLE['L'])
axL=RG.defeat_foot_rot('L')@V(0,0,1);axR=RG.defeat_foot_rot('R')@V(0,0,1);ax=(axL+axR).normalized()
tangle=[]
cL=final_world('L',RG.LEG['L'][2]+V(0,0,0.038));cR=final_world('R',RG.LEG['R'][2]+V(0,0,0.038))
print(json.dumps({'defeat_ankles':{k:list(v) for k,v in RG.DEFEAT_ANKLE.items()}}))
mid=(cL+cR)/2;ex=(cR-cL);ex=(ex-ex.dot(ax)*ax).normalized();ey=ax.cross(ex)
TURNS=1.7;NS=72
half=(cR-cL).length/2;RR=0.061+0.022                # a racetrack round both parallel shafts, 2.2 cm clear of each
perim=2*math.pi*RR+4*half
def stadium(u):
 d=(u%1.0)*perim
 if d<math.pi*RR:a=-math.pi/2+d/RR;return V(half+RR*math.cos(a),RR*math.sin(a),0),V(math.cos(a),math.sin(a),0)
 d-=math.pi*RR
 if d<2*half:return V(half-d,RR,0),V(0,1,0)
 d-=2*half
 if d<math.pi*RR:a=math.pi/2+d/RR;return V(-half+RR*math.cos(a),RR*math.sin(a),0),V(math.cos(a),math.sin(a),0)
 d-=math.pi*RR;return V(-half+d,-RR,0),V(0,-1,0)
for i in range(NS):
 f=i/(NS-1);u=TURNS*f+0.07
 # rest heights 0.120-0.146 m: above the boot feet, below the rolled cuffs
 h=-0.013+0.026*f
 q,nrm=stadium(u);q=q+nrm*(0.002*math.sin(math.tau*3.3*u))
 tangle.append(mid+ex*q.x+ey*q.y+ax*h)
loop_min_z=min(q.z for q in tangle)-0.0085
end=tangle[-1]
# the loose end drops forward between the boots and trails out on the floor in front of him
tailc=[end,V(end.x*0.6,end.y+0.045,end.z-0.06),V(0.0,end.y+0.10,max(0.09,end.z-0.17)),V(-0.01,end.y+0.16,0.03),V(-0.03,end.y+0.22,0.013),V(-0.08,end.y+0.28,0.012)]
tail=C.catmull_pad(tailc,5)[1:]
for q in tail:q.z=max(q.z,0.0105)
tangle+=tail
rest_pts=[RG.ROPE_HEAD+(to_left_rest(q)-RG.ROPE_HEAD)*RG.ROPE_REST_SCALE for q in tangle]
C.tube('Cream web-rope tangle (defeat; bound collapsed in the left boot)',rest_pts,[0.0085*RG.ROPE_REST_SCALE]*2,CREAM,n=6,bn='rope')
tangle_world_min_z=min(q.z for q in tangle)-0.0085

# ================= join one skin, build the rig =================
for ob in C.PARTS:
 if ob.name.endswith('.001'):ob.name=ob.name[:-4]
sources=bpy.data.collections.new('EDITABLE original web-slinger helper parts - excluded from export');sc.collection.children.link(sources)
inventory=[];copies=[]
for pi,ob in enumerate(C.PARTS):
 at=ob.data.attributes.new('wsh_part','INT','FACE');at.data.foreach_set('value',[pi]*len(ob.data.polygons))
for ob in C.PARTS:
 ob.data.calc_loop_triangles();inventory.append({'name':ob.name,'triangles':len(ob.data.loop_triangles),'bone_groups':[g.name for g in ob.vertex_groups],'atlas_tile':ob.get('atlas_tile')})
 cp=ob.copy();cp.data=ob.data.copy();sc.collection.objects.link(cp);copies.append(cp)
 for col in list(ob.users_collection):col.objects.unlink(ob)
 sources.objects.link(ob)
sources.hide_render=True;sources.hide_viewport=True
bpy.ops.object.select_all(action='DESELECT')
for ob in copies:ob.select_set(True)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();skin=bpy.context.object;skin.name='Web_Slinger_Helper_Skin'
for tag in ['source_part','rigid_weight','atlas_tile']:
 if tag in skin:del skin[tag]
skin.data.calc_loop_triangles();tris=len(skin.data.loop_triangles)
REST=RG.rest_bones(fr_root,fr_tip,eyes,hearts)
data=bpy.data.armatures.new('Original web-slinger helper rig');arm=bpy.data.objects.new('Web_Slinger_Helper_Rig',data);sc.collection.objects.link(arm)
skin.select_set(False);arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
order=[]
def add(name):
 if name in order:return
 par=REST[name][2]
 if par:add(par)
 order.append(name)
for name in REST:add(name)
for name in order:
 h,t,parent=REST[name];b=data.edit_bones.new(name);b.head=h;b.tail=t
 if parent:b.parent=data.edit_bones[parent];b.use_connect=False
 b.use_deform=name!='root'
bpy.ops.object.mode_set(mode='OBJECT');mod=skin.modifiers.new('Attached painted skin','ARMATURE');mod.object=arm;skin.parent=arm
missing=sorted({g.name for g in skin.vertex_groups}-set(REST))
assert not missing,missing
pts=[v.co for v in skin.data.vertices]
lo=[min(p[k] for p in pts) for k in range(3)];hi=[max(p[k] for p in pts) for k in range(3)]
arm['asset_id']='web-slinger-helper';arm['version']='v001';arm['forward']='Blender +Y / glTF -Z';arm['neutral_total_height_m']=round(hi[2],4);arm['attack_contact_fraction']=.625
record={'asset_id':'web-slinger-helper','version':'v001','work_order':'WO111','role':'friendly helper (DESIGN-013)',
 'authoring_model':'claude-opus-5-5 xhigh (Claude Code subagent; Tom ruled Sept 26 that Claude Opus 5.5 does the WO111 Blender work)','blender_version':bpy.app.version_string,
 'source_reference':'Blender reference sheet, no generated concept','source_sheet_sha256':sc['source_sheet_sha256'],'source_blockout_sha256':sc['source_blockout_sha256'],
 'rest_bounds_blender_z_up':{'min':lo,'max':hi},'height_m':hi[2],'triangles':tris,'vertices':len(skin.data.vertices),'material_count':len(skin.data.materials),'bone_count':len(data.bones),
 'hood_dew_drops':drop_count,'rope_tangle_world_min_z':tangle_world_min_z,
 'texture':{'file':'pigment.png','width':1024,'height':1024,'origin':'Original painted atlas generated with numpy in Blender Python (paint.py): face, hood, torso, eye and palm regions painted in the blockout projections plus flat sheet-colour tiles; no external textures.','layout':atlas},
 'parts':inventory}
(ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n')
rest_json={k:[list(map(float,h)),list(map(float,t)),p] for k,(h,t,p) in REST.items()}
(ROOT/'source/rig-rest.json').write_text(json.dumps({'rest':rest_json},indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'web-slinger-helper-construction.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(ROOT/'web-slinger-helper-checkpoint.glb'),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_yup=True,export_apply=False,export_armature_object_remove=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=True)
big=sorted(inventory,key=lambda r:-r['triangles'])
print(json.dumps({'triangles':tris,'vertices':len(skin.data.vertices),'height_m':hi[2],'bounds':[lo,hi],'bones':len(data.bones),'drops':drop_count,'tangle_min_z':tangle_world_min_z,'loop_min_z':loop_min_z,'loop_end':list(tangle[NS-1]),'paint':{k:atlas[k] for k in ('hood','torso_front_web','torso_back_web')},'largest':[(r['name'],r['triangles']) for r in big[:40]]}))
