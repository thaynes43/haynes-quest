"""WO111 demon-band-idol v001: final budgeted model from the approved Blender reference sheet.

Source authority: reference-sheet.png and demon-band-idol-blockout.blend (coordinator approved
Sept 26, "Blender reference sheet, no generated concept"). The blockout's measured coordinates
supply the silhouette, colours and parody hooks: gold candy horns through swoopy midnight idol
hair with a hot-pink dip-dyed fringe, a big lavender head with a wink, an open grin and star
blush, pointy ears with a star earring, gold epaulettes with fringe and sparkle stars, a teal
idol jacket with a gold collar, hem and buttons, a hot-pink sash with a star brooch and a bow
at the left hip, a silver stage mic with a star charm, slim midnight trousers with gold side
stripes, chunky white high-tops with pink soles and a heart-spade tail. Topology, atlas, UVs,
weights, rig and clips are new. Small face and jacket details are painted into the atlas
(paint.py) at the blockout's projected positions, as the sheet notes suggested.

Blender +Z up / +Y forward (glTF +Y up / -Z forward), floor-centred root, right = +X.
Bind pose: neutral (see rig.py); the sheet pose is recreated in idle.
"""
import bpy, math, json, hashlib, importlib.util
from pathlib import Path
from mathutils import Vector, Matrix, Euler

ROOT=Path('/workspace/haynes-quest/family-eras/demon-band-idol/v001')
sc=bpy.context.scene
assert sc.get('work_order')=='WO111' and sc.get('scene_lease')=='active' and sc.get('asset_id')=='demon-band-idol'
def load(name):
 spec=importlib.util.spec_from_file_location('wo111_dbi_'+name,ROOT/('source/%s.py'%name));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
C=load('common');P=load('paint');RG=load('rig')
T=P.T;SKIN,SKINLO,HAIR,PINK,BLUSH,GOLD,JACKET,TROUSER,WHITE,SILVER=(T[k] for k in ('skin','skinlo','hair','pink','blush','gold','jacket','trouser','white','silver'))
GOLD_D,PINK_D=T['gold_d'],T['pink_d']
V=RG.V;HR=RG.HR

atlas=P.paint_atlas(str(ROOT/'pigment.png'))
keep={k:sc[k] for k in sc.keys() if k.startswith('blendermcp_') or k in ('work_order','scene_owner','scene_lease','asset_id','asset_version','authoring_model')}
C.setup(ROOT,[('Matte painted skin, hair and cloth',.82),('Satin gold, sparkles and stage mic',.38)],ROOT/'pigment.png','demon-band-idol original painted 1024 atlas')
for key in list(sc.keys()):
 if key not in keep and key!='cycles':del sc[key]
sc['candidate_status']="WO111 demon-band-idol v001 · Awaiting Tom's review · used in the family release"
sc['source_reference']='Blender reference sheet, no generated concept'
sc['source_sheet_sha256']=hashlib.sha256((ROOT/'reference-sheet.png').read_bytes()).hexdigest()
sc['source_blockout_sha256']=hashlib.sha256((ROOT/'demon-band-idol-blockout.blend').read_bytes()).hexdigest()
sc['orientation']='Blender +Z up/+Y forward; glTF +Y up/-Z forward; stationary identity floor root; character right = +X'

# ---- the approved blockout, appended read-only for exact sampling (sash, bow, brooch), removed at the end
with bpy.data.libraries.load(str(ROOT/'demon-band-idol-blockout.blend'),link=False) as (src,dst):
 dst.collections=[n for n in src.collections if n.startswith('Demon band idol blockout')]
BLK=dst.collections[0];sc.collection.children.link(BLK)
bpy.data.objects['Head tilt pivot'].rotation_euler=(0,0,0);bpy.context.view_layer.update()
def blk(name):return bpy.data.objects[name]

# ================= weights =================
def torso_w(p):
 a=C.smooth((p.z-0.63)/0.10);b=C.smooth((p.z-0.77)/0.08)
 return {'hips':1-a,'spine':a*(1-b),'chest':a*b}
def neck_w(p):
 n1=C.smooth((p.z-0.915)/0.03);n2=C.smooth((p.z-0.95)/0.03)
 return {'chest':1-n1,'neck':n1*(1-n2),'head':n1*n2}
def chain_w(path,us,names,edges,root=None):
 """Blend along a strand: names[i] owns u in [edges[i], edges[i+1]); smooth 0.12 transitions."""
 def f(p):
  i=min(range(len(path)),key=lambda k:(path[k]-p).length);u=us[i];w={}
  for k,name in enumerate(names):
   lo=edges[k];hi=edges[k+1]
   a=C.smooth((u-lo)/0.12+.5) if k>0 else 1.0
   b=1-C.smooth((u-hi)/0.12+.5) if k<len(names)-1 else 1.0
   w[name]=w.get(name,0)+max(0.0,a*b)
  return w
 return f

# ================= head group (head-local blockout coordinates, placed by HR) =================
HEAD=[(0.0,0.0),(0.012,0.042),(0.035,0.078),(0.07,0.108),(0.11,0.126),(0.15,0.131),(0.19,0.127),(0.23,0.108),(0.26,0.072),(0.28,0.0)]
HP=C.smooth_profile(HEAD)
def head_r(t):return C.interp(HP,t)
def lathe_poles(name,cxy,z0,ts,rfun,n,ey,tile,bn,mat=0,face_tile=None,transform=None,weights=None,tmin=0.0,tmax=None):
 verts=[V(cxy[0],cxy[1],z0+tmin)]
 for t in ts:
  r=rfun(t);verts+=[V(cxy[0]+r*math.cos(math.tau*i/n),cxy[1]+r*ey*math.sin(math.tau*i/n),z0+t) for i in range(n)]
 verts.append(V(cxy[0],cxy[1],z0+tmax));faces=[(0,1+(i+1)%n,1+i) for i in range(n)]
 for j in range(len(ts)-1):
  for i in range(n):faces.append((1+j*n+i,1+j*n+(i+1)%n,1+(j+1)*n+(i+1)%n,1+(j+1)*n+i))
 top=len(verts)-1;base=1+(len(ts)-1)*n;faces+=[(base+i,base+(i+1)%n,top) for i in range(n)]
 return C.mesh(name,verts,faces,tile,bn,mat,True,weights,face_tile,transform)
HEAD_TS=[0.006,0.016,0.03,0.048,0.07,0.095,0.12,0.145,0.17,0.195,0.218,0.238,0.255,0.268,0.276]
def face_region(c,n):return C.FACE if n.y>0.15 else None
lathe_poles('Lavender idol head with painted wink face',(0,0.012),0.975,HEAD_TS,head_r,32,0.94,SKIN,'head',face_tile=face_region,transform=HR,tmax=0.28)

# Midnight hair cap: a (phi, s) grid from the hairline to the crown (the blockout's construction), 0.1 inward shell.
hline=lambda phi:-0.05+0.5*math.cos(phi)-0.05*math.cos(2*phi)
NP,NS=40,8;outer=[]
for j in range(NS):
 s_=j/NS
 for i in range(NP):
  phi=math.tau*i/NP-math.pi;th=math.acos(max(-1.0,min(1.0,hline(phi))))*(1-s_)
  outer.append(V(math.sin(th)*math.sin(phi),math.sin(th)*math.cos(phi),math.cos(th)))
outer.append(V(0,0,1));nv=len(outer);verts=outer+[p*0.9 for p in outer];faces=[]
for j in range(NS-1):
 for i in range(NP):
  a=j*NP+i;b=j*NP+(i+1)%NP;faces.append((a,b,b+NP,a+NP));faces.append((nv+a,nv+a+NP,nv+b+NP,nv+b))
for i in range(NP):
 a=(NS-1)*NP+i;b=(NS-1)*NP+(i+1)%NP;faces.append((a,b,nv-1));faces.append((nv+a,nv+nv-1,nv+b))
 faces.append((i,nv+i,nv+(i+1)%NP,(i+1)%NP))
CAP_M=HR@Matrix.Translation((0,0.002,1.118))@Matrix.Diagonal((0.141,0.135,0.15,1))
C.mesh('Midnight idol hair cap',verts,faces,HAIR,'head',transform=CAP_M)

tip=lambda u:PINK if u>0.8 else None
fr_path=None
for name,pts,rr,dyed,chain in [
  ('Fringe swoop main with pink dip-dye',RG.FRINGE_MAIN,[0.03,0.046,0.05,0.045,0.034,0.024,0.014],True,True),
  ('Fringe swoop crest with pink dip-dye',[(-0.065,-0.045,1.27),(-0.012,0.035,1.297),(0.05,0.1,1.267),(0.11,0.118,1.22),(0.142,0.08,1.19),(0.152,0.04,1.192)],[0.03,0.042,0.043,0.036,0.024,0.013],True,True),
  ('Short fringe left',[(-0.045,0.07,1.252),(-0.074,0.106,1.205),(-0.094,0.104,1.172)],[0.024,0.02,0.009],False,False)]:
 path=C.catmull_pad(pts,3);rest_path=[HR@p for p in path];_,us=C.sweep_rings(path,rr,8,0.42,(0,0.3,1))
 w=chain_w(rest_path,us,['head','fringe_1','fringe_2'],[0,0.34,0.66,1]) if chain else None
 C.sweep(name,pts,rr,HAIR,band=tip if dyed else None,n=8,per=3,flat=0.42,up=(0,0.3,1),bn='head',weights=w,transform=HR)
for side,sx in (('right',1),('left',-1)):
 C.sweep('Sideburn tuft '+side,[(0.116*sx,0.035,1.18),(0.13*sx,0.055,1.13),(0.128*sx,0.066,1.098)],[0.028,0.022,0.01],HAIR,n=8,per=3,flat=0.4,up=(sx,0,0),bn='head',transform=HR)
for k,x in enumerate((-0.058,0.0,0.058)):
 C.sweep('Nape point %d'%k,[(x,-0.098,1.15),(x*1.08,-0.13,1.09),(x*1.18,-0.14,1.035)],[0.046,0.033,0.013],HAIR,n=8,per=3,flat=0.35,up=(0,-1,0),bn='head',transform=HR)
for k,x in enumerate((-0.05,0.05)):
 C.sweep('Back swoop layer %d'%k,[(x*0.4,0.02,1.286),(x,-0.07,1.262),(x*1.3,-0.128,1.195),(x*1.4,-0.145,1.13)],[0.05,0.056,0.046,0.02],HAIR,n=8,per=3,flat=0.3,up=(0,-0.4,1),bn='head',transform=HR)
for side,sx in (('right',1),('left',-1)):
 _,hp,_=C.sweep('Gold candy horn '+side,[(0.056*sx,-0.01,1.225),(0.078*sx,-0.01,1.278),(0.088*sx,0.0,1.318),(0.08*sx,0.014,1.348),(0.066*sx,0.024,1.362)],[0.036,0.032,0.025,0.019,0.0135],GOLD,n=10,per=3,bn='head',mat=1,transform=HR)
 C.ellipsoid('Blunt horn tip '+side,tuple(hp[-1]),(0.0138,0.0138,0.0138),GOLD,'head',1,n=10,r=5,transform=HR)
# pointed ears (slightly fuller than the blockout for play-distance read), pink insides, star earring
for s,side in (('R','right'),('L','left')):
 d=RG.EAR_DIR[s];base=RG.EAR_BASE[s];q=d.to_track_quat('Z','Y').to_euler()
 C.frustum('Pointed ear '+side,tuple(base+d*0.04),0.032,0.0,0.092,SKIN,'ear_'+s,n=10,rot=q,scale=(0.62,1,1),transform=HR)
 C.frustum('Pink inner ear '+side,tuple(base+d*0.036+V(0,0.011,0)),0.02,0.0,0.062,BLUSH,'ear_'+s,n=8,rot=q,scale=(0.42,1,1),transform=HR)
 C.ellipsoid('Round ear tip '+side,tuple(base+d*0.083),(0.0055,0.0055,0.0055),SKIN,'ear_'+s,n=6,r=4,transform=HR)
hoop=C.bspline([(-0.13,0.004,1.078),(-0.136,0.008,1.066),(-0.134,0.006,1.051)],6)
rr,_=C.sweep_rings(hoop,[0.0032,0.0032],5)
C.rings('Gold earring hoop',rr,GOLD,'earring',1,transform=HR)
C.prism('Gold star earring',C.star_pts(0.018,0.008),0.008,GOLD,'earring',1,M=HR@C.frame((0,1,0),(0,0,1),(-0.134,0.006,1.04)))

# ================= neck, collar, jacket, seat =================
C.frustum('Lavender neck',(0,0.004,0.955),0.041,0.039,0.10,SKIN,'neck',n=12,weights=neck_w)
C.frustum('Gold stand-up collar',(0,0,0.93),0.06,0.054,0.03,GOLD,'chest',1,n=16,scale=(1,0.86,1))
TORSO=[(0.0,0.100),(0.03,0.104),(0.08,0.107),(0.14,0.118),(0.20,0.133),(0.25,0.141),(0.29,0.134),(0.315,0.108),(0.335,0.055)]
TP=C.smooth_profile(TORSO)
TORSO_T=[0.0,0.017,0.04,0.08,0.12,0.16,0.20,0.235,0.265,0.29,0.31,0.325,0.335]
def jacket_tiles(c,n):
 if c.z<0.617:return GOLD
 return C.JACKET if n.y>0.30 else None
C.lathe_rows('Teal idol jacket with painted shirt V, piping and buttons',[(0.6+t,C.interp(TP,t)) for t in TORSO_T],JACKET,'chest',n=24,ey=0.72,weights=torso_w,face_tile=jacket_tiles)
C.ellipsoid('Midnight trouser seat',(0,-0.004,0.556),(0.112,0.08,0.075),TROUSER,'hips',n=16,r=8)

# swallowtail flaps with gold tips
gtip=lambda u:GOLD if u>0.8 else None
for s in 'RL':
 pts=RG.SWALLOW[s];path=C.catmull_pad(pts,3);_,us=C.sweep_rings(path,[0.036,0.035,0.025,0.008],8,0.28,(0,-1,0))
 C.sweep('Swallowtail flap '+s,pts,[0.036,0.035,0.025,0.008],JACKET,band=gtip,n=8,per=3,flat=0.28,up=(0,-1,0),weights=chain_w(path,us,['hips','coat_'+s],[0,0.18,1]))

# ================= sash, brooch, bow (sampled from the blockout) =================
sm=blk('Hot-pink idol sash');mw=sm.matrix_world;bv=[mw@v.co for v in sm.data.vertices]
NSASH=48;step=len(bv)//2//NSASH;cent=[];bi=[];nor=[]
SC=V(0,0,0.765)
for i in range(NSASH):
 k=i*step;a=bv[2*k];b=bv[2*k+1];cent.append((a+b)/2);bi.append((b-a)/2)
for i in range(NSASH):
 t=(cent[(i+1)%NSASH]-cent[i-1]).normalized();N=t.cross(bi[i].normalized())
 if N.dot(cent[i]-SC)<0:N=-N
 nor.append(N.normalized())
C.ribbon('Hot-pink idol sash',cent,nor,[b.normalized() for b in bi],[b.length for b in bi],0.010,PINK,weights=torso_w)
for name,pts,th,tile in (('Gold star brooch',C.star_pts(0.036,0.016),0.012,GOLD),('Pink brooch star',C.star_pts(0.013,0.007),0.006,PINK)):
 src=blk(name if name!='Pink brooch star' else 'Pink brooch heart');C.prism(name,pts,th,tile,mat=1 if tile==GOLD else 0,M=src.matrix_world.copy(),weights=torso_w)
K=blk('Sash bow knot').matrix_world.translation.copy()
C.ellipsoid('Sash bow knot',tuple(K),(0.024,0.02,0.022),PINK,'hips',n=10,r=6)
for sx in (1,-1):
 C.box('Sash bow loop %+d'%sx,tuple(K+V(sx*0.03,0.002,0.004)),(0.04,0.012,0.03),PINK,'hips',bevel=0.007,segments=1,rot=(0,math.radians(sx*20),0))
pink_gold=lambda u:GOLD if u>0.86 else None
bow_paths=[]
for k,(dx,ln) in enumerate(((-0.018,0.13),(0.02,0.105))):
 a=K+V(dx*0.5,0.004,-0.01);pts=[tuple(a),tuple(a+V(dx,0.012,-ln*0.5)),tuple(a+V(dx*1.7,0.01,-ln))]
 path=C.catmull_pad(pts,4);_,us=C.sweep_rings(path,[0.03,0.032,0.03],8,0.25,(0,1,0))
 C.sweep('Sash bow tail %d'%k,pts,[0.03,0.032,0.03],PINK,band=pink_gold,n=8,per=4,flat=0.25,up=(0,1,0),weights=chain_w(path,us,['hips','bow_%d'%(k+1)],[0,0.15,1]))
 bow_paths.append((V(*pts[0]),V(*pts[-1])))

# ================= epaulettes, fringe, sparkles =================
for s,sx in (('R',1),('L',-1)):
 E=RG.EPAULETTE[s]
 C.ellipsoid('Gold epaulette '+s,tuple(E),(0.07,0.064,0.026),GOLD,'chest',1,n=16,r=6,rot=(0,math.radians(-16*sx),0))
 rr=[]
 for k in range(13):
  # hung from just under the epaulette rim (the blockout fringe left a visible gap at play distance)
  a=math.radians(-80+160*k/12);o=V(math.cos(a)*sx*0.058,math.sin(a)*0.054,0);top=E+o+V(0.006*sx,0,0.004-0.016*abs(math.cos(a)))
  out=V(math.cos(a)*sx,math.sin(a),0).normalized()*0.0045;bot=top+V(0,0,-0.036)
  rr.append([top+out,bot+out,bot-out,top-out])
 stripes=lambda c,n,E=E,sx=sx:GOLD_D if int(((math.degrees(math.atan2(c.y-E.y,(c.x-E.x)*sx))+80)/(160/12)))%2 else GOLD
 C.rings('Gold epaulette fringe '+s,rr,GOLD,'chest',1,face_tile=stripes,closed=True)
 for tag,off,r,tile,spin in (('big',V(0.004*sx,0.0,0.07),0.05,GOLD,8*sx),('pink',V(0.06*sx,0.012,0.045),0.03,PINK,-12*sx),('white',V(-0.045*sx,-0.01,0.052),0.022,WHITE,20*sx)):
  c=E+off;sp=math.radians(spin)
  C.prism('Shoulder sparkle %s %s A'%(s,tag),C.sparkle_pts(r),0.006,tile,'sparkle_'+s,1,M=C.frame((math.sin(sp),math.cos(sp),0),(0,0,1),c))
  C.prism('Shoulder sparkle %s %s B'%(s,tag),C.sparkle_pts(r*0.9),0.006,tile,'sparkle_'+s,1,M=C.frame((math.cos(sp),-math.sin(sp),0),(0,0,1),c))

# ================= arms, fists, mic =================
def arm_parts(s,sx):
 S,E,W=RG.ARM[s];fd=(W-E).normalized();S0=V(0.10*sx,0,0.885)
 ctrl=[S0,S,S.lerp(E,.5),E,E.lerp(W,.5),W]
 path=C.catmull_pad(ctrl,3);acc=C.arclength(path)
 iS=min(range(len(path)),key=lambda k:(path[k]-S).length);iE=min(range(len(path)),key=lambda k:(path[k]-E).length)
 sS=acc[iS];sE=acc[iE]
 def w(p):
  i=min(range(len(path)),key=lambda k:(path[k]-p).length);s_=acc[i]
  if s_<sS+0.02:t=C.smooth((s_-(sS-0.03))/0.06);return {'chest':1-t,'upper_arm_'+s:t}
  t=C.smooth((s_-(sE-0.05))/0.10);return {'upper_arm_'+s:1-t,'forearm_'+s:t}
 rr,_=C.sweep_rings(path,[0.044,0.041,0.039,0.036,0.034],10,1.0,(0,1,0))
 C.rings('Teal sleeve '+s,rr,JACKET,'upper_arm_'+s,weights=w)
 c=W-fd*0.006
 C.frustum('Gold cuff '+s,tuple(c),0.041,0.041,0.022,GOLD,'forearm_'+s,1,n=12,rot=fd.to_track_quat('Z','Y').to_euler())
arm_parts('R',1);arm_parts('L',-1)
MR=RG.HAND_MAP['R'];ML=RG.HAND_MAP['L']
C.ellipsoid('Right fist around the mic',(0.226,0.17,0.885),(0.034,0.034,0.04),SKIN,'hand_R',n=14,r=8,rot=(0.3,0,0),transform=MR)
C.ellipsoid('Right thumb',(0.206,0.192,0.905),(0.012,0.014,0.02),SKIN,'hand_R',n=8,r=5,rot=(0.5,0.4,0),transform=MR)
C.ellipsoid('Left fist on the hip',(-0.14,0.006,0.622),(0.03,0.04,0.036),SKIN,'hand_L',n=14,r=8,rot=(0,math.radians(-25),0),transform=ML)
C.ellipsoid('Left thumb',(-0.134,0.042,0.64),(0.011,0.016,0.012),SKIN,'hand_L',n=8,r=5,transform=ML)
md=RG.MIC_B-RG.MIC_A;mq=md.to_track_quat('Z','Y').to_euler()
C.frustum('Midnight mic handle',tuple((RG.MIC_A+RG.MIC_B)/2),0.016,0.022,md.length,TROUSER,'mic',1,n=12,rot=mq,transform=MR)
C.frustum('Gold mic ring',tuple(RG.MIC_B),0.026,0.026,0.014,GOLD,'mic',1,n=14,rot=mq,transform=MR)
C.ellipsoid('Silver mic grille',tuple(RG.MIC_G),(0.035,0.035,0.035),SILVER,'mic',1,n=14,r=8,rot=mq,transform=MR)
cord=C.bspline([tuple(RG.MIC_A),(0.234,0.172,0.80),(0.239,0.17,0.775)],6)
rr,_=C.sweep_rings(cord,[0.0035,0.0035],5)
C.rings('Pink charm cord',rr,PINK,'charm',transform=MR)
C.prism('Pink star mic charm',C.star_pts(0.019,0.009),0.008,PINK,'charm',M=MR@C.frame((0,1,0),(0,0,1),tuple(RG.CHARM_END)))
# sparkle burst: a ring of six crossed sparkles round the grille plus one big star in front, bound collapsed
# (x0.04 about the grille centre) and popped open by the burst bone's scale at the attack contact.
BURST_M=MR@Matrix.Translation(RG.MIC_G)@Matrix.Scale(RG.BURST_REST_SCALE,4)@Matrix.Translation(-RG.MIC_G)
ax=RG.MIC_DIR;ref=V(1,0,0);u1=(ref-ax*ax.dot(ref)).normalized();u2=ax.cross(u1)
for k in range(6):
 a=math.tau*k/6+0.3;radial=u1*math.cos(a)+u2*math.sin(a);c=RG.MIC_G+ax*0.03+radial*0.20
 r=(0.075,0.058,0.066)[k%3];tile=(GOLD,PINK,WHITE)[k%3]
 C.prism('Burst sparkle %d A'%k,C.sparkle_pts(r),0.006,tile,'burst',1,M=BURST_M@C.frame(ax,radial,c))
 C.prism('Burst sparkle %d B'%k,C.sparkle_pts(r*0.85),0.006,tile,'burst',1,M=BURST_M@C.frame(ax.cross(radial),radial,c))
C.prism('Burst big star',C.star_pts(0.095,0.044),0.010,GOLD,'burst',1,M=BURST_M@C.frame(ax,u1,RG.MIC_G+ax*0.10))

# ================= legs and sneakers =================
for s,sx in (('R',1),('L',-1)):
 H,Kn,A=RG.LEG[s];top=H+V(0,0,0.025)
 def axis(z,H=H,Kn=Kn,A=A,top=top):
  if z>=H.z:return top.lerp(H,(top.z-z)/(top.z-H.z))
  if z>=Kn.z:return H.lerp(Kn,(H.z-z)/(H.z-Kn.z))
  return Kn.lerp(A,(Kn.z-z)/(Kn.z-A.z))
 zs=[0.60,0.56,0.52,0.48,0.44,0.40,0.37,0.345,0.32,0.29,0.25,0.21,0.17,0.135,0.105]
 def rad(z):
  # the hem tucks 8 mm inside the high-top collar (the blockout flare poked through it once the shin bent)
  u=(0.585-z)/0.48;return C.interp([(0,0.054),(0.25,0.05),(0.5,0.045),(0.75,0.043),(0.86,0.041),(1.0,0.040)],max(0,min(1,u)))
 n=14;rr=[]
 for z in zs:
  c=axis(z);r=rad(z);rr.append([V(c.x+r*math.cos(math.tau*(i+.5)/n),c.y+r*math.sin(math.tau*(i+.5)/n),z) for i in range(n)])
 def stripe(c,nn,axis=axis,sx=sx):
  a=axis(c.z);d=c-a
  return GOLD if d.x*sx>0 and abs(d.y)<0.006 and abs(nn.z)<0.8 else None
 def leg_w(p,s=s):
  z=p.z;w={}
  t=C.smooth((z-0.50)/0.10);w['hips']=0.55*t;th=1-0.55*t
  k=C.smooth((0.375-z)/0.075);an=C.smooth((0.205-z)/0.045)
  w['thigh_'+s]=th*(1-k);w['shin_'+s]=th*k*(1-an);w['foot_'+s]=th*k*an
  return w
 C.rings('Midnight stage trouser leg '+s,rr,TROUSER,'thigh_'+s,face_tile=stripe,weights=leg_w)
 F=Matrix.Translation(RG.REST_FOOT[s][0])
 C.box('Hot-pink sneaker sole '+s,(0,0.028,0.016),(0.104,0.214,0.032),PINK,'foot_'+s,bevel=0.010,segments=1,transform=F)
 C.box('White high-top upper '+s,(0,0.018,0.064),(0.092,0.176,0.078),WHITE,'foot_'+s,bevel=0.026,segments=2,transform=F)
 C.ellipsoid('White sneaker toe cap '+s,(0,0.092,0.05),(0.047,0.05,0.036),WHITE,'foot_'+s,n=12,r=6,transform=F)
 C.frustum('White high-top collar '+s,(0,-0.012,0.118),0.052,0.049,0.07,WHITE,'foot_'+s,n=12,transform=F)
 C.frustum('Hot-pink collar rim '+s,(0,-0.012,0.155),0.0535,0.0535,0.012,PINK,'foot_'+s,n=12,transform=F)
 for k in range(3):
  C.box('Pink lace %s %d'%(s,k),(0,0.07-0.03*k,0.098+0.012*k),(0.05,0.009,0.008),PINK,'foot_'+s,bevel=0,rot=(math.radians(-28),0,0),transform=F)
 C.ellipsoid('Gold sneaker patch '+s,(0.047*sx,0.0,0.066),(0.0045,0.022,0.022),GOLD,'foot_'+s,1,n=8,r=4,transform=F)

# ================= heart-spade tail =================
tp=C.catmull_pad(RG.TAIL_PTS,4);tacc=C.arclength(tp);TL=tacc[-1]
def tail_w(p):
 i=min(range(len(tp)),key=lambda k:(tp[k]-p).length);u=tacc[i]/TL;w={}
 names=['hips','tail_1','tail_2','tail_3','tail_4'];edges=[-1,0.05,0.25,0.5,0.75,2]
 for k,name in enumerate(names):
  a=C.smooth((u-edges[k])/0.10+.5) if k>0 else 1.0
  b=1-C.smooth((u-edges[k+1])/0.10+.5) if k<len(names)-1 else 1.0
  w[name]=max(0.0,a*b)
 return w
rr,_=C.sweep_rings(tp,RG.TAIL_R,8)
C.rings('Lavender demon tail',rr,SKIN,'tail_1',weights=tail_w)
t_end=(tp[-1]-tp[-4]).normalized();heart=[]
for k in range(28):
 t=math.tau*k/28;x=16*math.sin(t)**3;y=13*math.cos(t)-5*math.cos(2*t)-2*math.cos(3*t)-math.cos(4*t)
 heart.append((x*0.0021*1.12,(-y*0.0021+0.012)*1.12))
Zt=t_end;Yt=V(1,0,0);Yt=(Yt-Yt.dot(Zt)*Zt).normalized();Xt=Yt.cross(Zt)
Mt=Matrix((Xt,Yt,Zt)).transposed().to_4x4();Mt.translation=tp[-1]+t_end*0.012
C.prism('Hot-pink heart spade tip',heart,0.022,PINK,'tail_4',M=Mt)

# ================= remove the blockout reference, join one skin, build the rig =================
for ob in list(BLK.all_objects):bpy.data.objects.remove(ob,do_unlink=True)
bpy.data.collections.remove(BLK)
for block in (bpy.data.meshes,bpy.data.curves,bpy.data.materials):
 for b in list(block):
  if b.users==0:block.remove(b)
for ob in C.PARTS:
 if ob.name.endswith('.001'):ob.name=ob.name[:-4]
sources=bpy.data.collections.new('EDITABLE original demon band idol parts - excluded from export');sc.collection.children.link(sources)
inventory=[];copies=[]
for pi,ob in enumerate(C.PARTS):
 at=ob.data.attributes.new('dbi_part','INT','FACE');at.data.foreach_set('value',[pi]*len(ob.data.polygons))
for ob in C.PARTS:
 ob.data.calc_loop_triangles();inventory.append({'name':ob.name,'triangles':len(ob.data.loop_triangles),'bone_groups':[g.name for g in ob.vertex_groups],'atlas_tile':ob.get('atlas_tile')})
 cp=ob.copy();cp.data=ob.data.copy();sc.collection.objects.link(cp);copies.append(cp)
 for col in list(ob.users_collection):col.objects.unlink(ob)
 sources.objects.link(ob)
sources.hide_render=True;sources.hide_viewport=True
bpy.ops.object.select_all(action='DESELECT')
for ob in copies:ob.select_set(True)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();skin=bpy.context.object;skin.name='Demon_Band_Idol_Skin'
for tag in ['source_part','rigid_weight','atlas_tile']:
 if tag in skin:del skin[tag]
skin.data.calc_loop_triangles();tris=len(skin.data.loop_triangles)
REST,tail_acc=RG.rest_bones(tp,bow_paths)
data=bpy.data.armatures.new('Original demon band idol rig');arm=bpy.data.objects.new('Demon_Band_Idol_Rig',data);sc.collection.objects.link(arm)
skin.select_set(False);arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
for name,(h,t,parent) in REST.items():
 b=data.edit_bones.new(name);b.head=h;b.tail=t
 if parent:b.parent=data.edit_bones[parent];b.use_connect=False
 b.use_deform=name!='root'
bpy.ops.object.mode_set(mode='OBJECT');mod=skin.modifiers.new('Attached painted skin','ARMATURE');mod.object=arm;skin.parent=arm
missing=sorted({g.name for g in skin.vertex_groups}-set(REST))
assert not missing,missing
pts=[v.co for v in skin.data.vertices]
lo=[min(p[k] for p in pts) for k in range(3)];hi=[max(p[k] for p in pts) for k in range(3)]
arm['asset_id']='demon-band-idol';arm['version']='v001';arm['forward']='Blender +Y / glTF -Z';arm['neutral_total_height_m']=round(hi[2],4);arm['attack_contact_fraction']=.625
record={'asset_id':'demon-band-idol','version':'v001','work_order':'WO111','authoring_model':'claude-opus-5-5 xhigh (Claude Code subagent; Tom ruled Sept 26 that Claude Opus 5.5 does the WO111 Blender work)','blender_version':bpy.app.version_string,
 'source_reference':'Blender reference sheet, no generated concept','source_sheet_sha256':sc['source_sheet_sha256'],'source_blockout_sha256':sc['source_blockout_sha256'],
 'rest_bounds_blender_z_up':{'min':lo,'max':hi},'height_m':hi[2],'triangles':tris,'vertices':len(skin.data.vertices),'material_count':len(skin.data.materials),'bone_count':len(data.bones),
 'texture':{'file':'pigment.png','width':1024,'height':1024,'origin':'Original painted atlas generated with numpy in Blender Python (paint.py): face and jacket-front decals at the blockout projected positions plus flat sheet-colour tiles; no external textures.','layout':atlas},
 'parts':inventory}
(ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n')
rest_json={k:[list(map(float,h)),list(map(float,t)),p] for k,(h,t,p) in REST.items()}
(ROOT/'source/rig-rest.json').write_text(json.dumps({'rest':rest_json},indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'demon-band-idol-construction.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(ROOT/'demon-band-idol-checkpoint.glb'),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_yup=True,export_apply=False,export_armature_object_remove=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=True)
big=sorted(inventory,key=lambda r:-r['triangles'])
print(json.dumps({'triangles':tris,'vertices':len(skin.data.vertices),'height_m':hi[2],'bounds':[lo,hi],'bones':len(data.bones),'largest':[(r['name'],r['triangles']) for r in big[:25]]}))
