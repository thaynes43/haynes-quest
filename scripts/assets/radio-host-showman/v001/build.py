"""WO111 radio-host-showman v001: final budgeted model from the approved Blender reference sheet.

Source authority: reference-sheet.png and radio-host-showman-blockout.blend (coordinator approved
Sept 26, "Blender reference sheet, no generated concept"), plus the revised model notes after Tom's
Sept 26 ruling (DESIGN-027: genuinely scary is welcome where the era fits, no gore). The blockout's
measured coordinates supply the silhouette, colours and parody hooks: slicked auburn hair with two
asymmetric wispy tufts, a big round head, a big black bow tie on a white collar, the red/cream
candy-stripe jacket with the black shawl collar, brass buttons, pocket square and back half-belt,
long black trousers with a red side stripe, cream-and-black spectator shoes, white showman gloves
(fist round the cane, open waving palm) and the tall black cane topped by the old-time silver
broadcast mic in a brass yoke with its on-air bulb.

Pushed creepier at the model stage (revised notes): a too-wide grin of sharp teeth (painted), hollow
shadowed sockets, red irises that glow in the dark (separate iris shells on the glow material), the
on-air bulb glowing, a faint jagged static halo behind the head, and a radio-static burst that pops
open round the mic at the attack contact. Topology, atlas, UVs, weights, rig and clips are new.

Blender +Z up / +Y forward (glTF +Y up / -Z forward), floor-centred root, right = +X.
Bind pose: see rig.py; the sheet pose is recreated at idle 0 s.
"""
import bpy, math, json, hashlib, importlib.util
from pathlib import Path
from mathutils import Vector, Matrix, Euler

ROOT=Path('/workspace/haynes-quest/family-eras/radio-host-showman/v001')
sc=bpy.context.scene
assert sc.get('work_order')=='WO111' and sc.get('scene_lease')=='active' and sc.get('asset_id')=='radio-host-showman'
def load(name):
 spec=importlib.util.spec_from_file_location('wo111_rhs_'+name,ROOT/('source/%s.py'%name));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
C=load('common');P=load('paint');RG=load('rig')
T=P.T
SKIN,SKINLO,HAIR,HAIRTIP,INK,RED,CREAM,WHITE,SILVER,GRILLE,BRASS,BRASS_HI,MOUTH,TONGUE,CHEEK,INK_HI=(T[k] for k in P.TILES[:16])
GLOW_RED,HALO_RED,STATIC_PALE,BURST_RED,BULB_T,HALO_PALE=(T[k] for k in ('glow_red','halo_red','static_pale','burst_red','bulb','halo_pale'))
V=RG.V;HR=RG.HR;MATTE=0;GLOW=1

atlas=P.paint_atlas(str(ROOT/'pigment.png'))
keep={k:sc[k] for k in sc.keys() if k.startswith('blendermcp_') or k in ('work_order','scene_owner','scene_lease','asset_id','asset_version','authoring_model')}
C.setup(ROOT,[('Matte painted skin, hair and cloth',.78,False),('Glowing eyes, on-air bulb and radio static',.45,True)],ROOT/'pigment.png','radio-host-showman original painted 1024 atlas')
for key in list(sc.keys()):
 if key not in keep and key!='cycles':del sc[key]
C.JACKET_EY[0]=P.JACKET_EY;C.MIC_LEN[0]=0.16*RG.MS
C.EYE_C[C.EYE_R]=(RG.IRIS['R'].x,RG.IRIS['R'].z);C.EYE_C[C.EYE_L]=(RG.IRIS['L'].x,RG.IRIS['L'].z)
sc['candidate_status']="WO111 radio-host-showman v001 · Awaiting Tom's review · used in the family release"
sc['source_reference']='Blender reference sheet, no generated concept'
sc['source_sheet_sha256']=hashlib.sha256((ROOT/'reference-sheet.png').read_bytes()).hexdigest()
sc['source_blockout_sha256']=hashlib.sha256((ROOT/'radio-host-showman-blockout.blend').read_bytes()).hexdigest()
sc['orientation']='Blender +Z up/+Y forward; glTF +Y up/-Z forward; stationary identity floor root; character right = +X'

def indexed(verts,faces,tiles):
 """face_tile closure: the tile of the authored face whose source centroid is nearest (C.mesh computes the same centroid)."""
 table=[(sum((Vector(verts[i]) for i in f),Vector())/len(f),t) for f,t in zip(faces,tiles)]
 def pick(c,n):
  best=min(table,key=lambda e:(e[0]-c).length_squared);assert (best[0]-c).length<1e-5,('face centroid not found',tuple(c))
  return best[1]
 return pick
def qrot(d):return Vector(d).to_track_quat('Z','Y').to_euler()

# ================= weights =================
def torso_w(p):
 a=C.smooth((p.z-0.97)/0.14);b=C.smooth((p.z-1.19)/0.12)
 return {'hips':1-a,'spine':a*(1-b),'chest':a*b}
def neck_w(p):
 n1=C.smooth((p.z-1.43)/0.03);n2=C.smooth((p.z-1.48)/0.03)
 return {'chest':1-n1,'neck':n1*(1-n2),'head':n1*n2}
def along_w(root,length,names,edges,soft=0.12):
 """Blend by distance from a root point: names[i] owns u in [edges[i], edges[i+1])."""
 def f(p):
  u=(p-root).length/length;w={}
  for k,name in enumerate(names):
   a=C.smooth((u-edges[k])/soft+.5) if k>0 else 1.0
   b=1-C.smooth((u-edges[k+1])/soft+.5) if k<len(names)-1 else 1.0
   w[name]=w.get(name,0)+max(0.0,a*b)
  return w
 return f

# ================= head group (head-local blockout coordinates, placed by HR) =================
HEAD_TS=[0.006,0.016,0.03,0.05,0.075,0.10,0.13,0.16,0.19,0.22,0.25,0.28,0.31,0.335,0.355,0.37]
def lathe_poles(name,cxy,z0,ts,rfun,n,ey,tile,bn,mat=0,face_tile=None,transform=None,weights=None,tmax=None):
 verts=[V(cxy[0],cxy[1],z0)]
 for t in ts:
  r=rfun(t);verts+=[V(cxy[0]+r*math.cos(math.tau*i/n),cxy[1]+r*ey*math.sin(math.tau*i/n),z0+t) for i in range(n)]
 verts.append(V(cxy[0],cxy[1],z0+tmax));faces=[(0,1+(i+1)%n,1+i) for i in range(n)]
 for j in range(len(ts)-1):
  for i in range(n):faces.append((1+j*n+i,1+j*n+(i+1)%n,1+(j+1)*n+(i+1)%n,1+(j+1)*n+i))
 top=len(verts)-1;base=1+(len(ts)-1)*n;faces+=[(base+i,base+(i+1)%n,top) for i in range(n)]
 return C.mesh(name,verts,faces,tile,bn,mat,True,weights,face_tile,transform)
face_region=lambda c,n:C.FACE if n.y>0.0 else None
lathe_poles('Showman head with painted grin, teeth and eyes',(0,RG.HEAD_Y0),RG.HEAD_Z0,HEAD_TS,lambda t:C.interp(RG.HP,t),40,RG.HEAD_EY,SKIN,'head',face_tile=face_region,transform=HR,tmax=0.38)
C.ellipsoid('Button nose',(0,RG.head_y(0,1.668)+0.002,1.668),(0.019,0.014,0.015),SKINLO,'head',n=10,r=6,transform=HR)
for s,sx in (('R',1),('L',-1)):
 C.ellipsoid('Ear '+s,(0.155*sx,-0.004,1.705),(0.026,0.04,0.052),SKIN,'head',n=12,r=6,transform=HR)

# glowing iris shells: lens-shaped discs on the analytic head surface over the painted eye whites
for s in 'RL':
 cx,cz=RG.IRIS[s].x,RG.IRIS[s].z;n=14;verts=[];faces=[]
 rings=[(0.55,0.0033),(0.88,0.0029),(1.0,0.0022),(1.12,-0.0009)]
 verts.append(V(cx,RG.head_y(cx,cz)+0.0035,cz))
 for f,off in rings:
  for i in range(n):
   a=math.tau*i/n;x=cx+f*C.EYE_RX*math.cos(a);z=cz+f*C.EYE_RZ*math.sin(a);verts.append(V(x,RG.head_y(x,z)+off,z))
 faces=[(0,1+(i+1)%n,1+i) for i in range(n)]
 for j in range(len(rings)-1):
  for i in range(n):faces.append((1+j*n+i,1+j*n+(i+1)%n,1+(j+1)*n+(i+1)%n,1+(j+1)*n+i))
 C.mesh('Glowing red iris '+s,verts,faces,GLOW_RED,'eye_'+s,GLOW,True,None,lambda c,nn,k=('E_'+s):k,HR)

# slicked hair cap grown from the analytic head (the blockout's hairline with sideburn tabs and front lift)
HEAD_C=V(0,0.006,1.70)
th_max=lambda phi:math.radians(78.5-40*math.cos(phi)+6.5*math.cos(2*phi)+32*math.exp(-((abs(phi)-1.30)/0.13)**2))
NP=48;PH=[math.tau*i/NP-math.pi for i in range(NP)];SROWS=[0.0,0.1,0.22,0.36,0.5,0.64,0.78,0.9]
def cap_pt(phi,s_,off=None):
 th=th_max(phi)*(1-s_);d=V(math.sin(th)*math.sin(phi),math.sin(th)*math.cos(phi),math.cos(th))
 h=RG.head_hit(HEAD_C,d)
 if off is None:off=0.004+0.015*min(1.0,s_*4)+0.012*max(0.0,math.cos(phi))*math.sin(math.pi*min(1.0,s_*1.3))
 return h+d*off
verts=[cap_pt(phi,0.0,-0.004) for phi in PH]
for s_ in SROWS:verts+=[cap_pt(phi,s_) for phi in PH]
top=RG.head_hit(HEAD_C,V(0,0,1))+V(0,0,0.019);verts.append(top);pole=len(verts)-1;faces=[]
rowsN=len(SROWS)+1
for j in range(rowsN-1):
 for i in range(NP):a=j*NP+i;b=j*NP+(i+1)%NP;faces.append((a,b,b+NP,a+NP))
for i in range(NP):faces.append(((rowsN-1)*NP+i,(rowsN-1)*NP+(i+1)%NP,pole))
C.mesh('Slicked auburn hair cap',verts,faces,HAIR,'head',transform=HR)

# two asymmetric wispy tufts (three strands each) on two-bone chains
for s,sx in (('R',1),('L',-1)):
 main=RG.tuft_pts(s,RG.TUFT_STRANDS[0][1]);root=HR@main[0];L=((HR@main[3])-root).length
 w=along_w(root,L,['head','tuft_%s_1'%s,'tuft_%s_2'%s],[0,0.18,0.62,9],soft=0.14)
 for nm,rel,rr in RG.TUFT_STRANDS:
  pts=RG.tuft_pts(s,rel);k=RG.TUFT_K[s]
  _,path,_=C.sweep('Hair tuft %s %s wisp'%(s,nm),[tuple(p) for p in pts],[r*k for r in rr],HAIR,n=6,per=2 if len(pts)>3 else 3,flat=0.5,up=(0,1,0),bn='head',weights=w,transform=HR)
  C.ellipsoid('Hair tuft %s %s tip'%(s,nm),tuple(path[-1]),(rr[-1]*k,)*3,HAIR,'tuft_%s_2'%s,n=6,r=3,transform=HR)

# faint jagged static halo behind the head: ten broken zigzag arcs in the head's back plane
halo_parts=0
for k in range(10):
 a0=math.radians(36*k+4);pts=[]
 for j in range(5):
  a=a0+math.radians(28)*j/4;r=RG.HALO_R+(0.011 if j%2 else -0.011)
  pts.append(HR@(RG.HALO_C+V(r*math.cos(a),0,r*math.sin(a))))
 cent=[];nor=[];bi=[]
 for j,p in enumerate(pts):
  t=(pts[min(j+1,4)]-pts[max(j-1,0)]).normalized();Nb=V(0,-1,0);bi.append(t.cross(Nb).normalized());nor.append(Nb);cent.append(p)
 C.ribbon('Static halo arc %d'%k,cent,nor,bi,0.0034,0.0035,HALO_PALE if k in (1,5,8) else HALO_RED,'halo',GLOW,closed=False);halo_parts+=1   # faint: thin, dim red with three pale arcs

# ================= neck, collar, bow tie =================
C.lathe_rows('Neck with white shirt-collar band',[(1.45,0.05),(1.47,0.05),(1.49,0.05),(1.505,0.05),(1.53,0.05),(1.56,0.05)],SKIN,'neck',n=12,axis_xy=(0,0.006),weights=neck_w,face_tile=lambda c,n:WHITE if c.z<1.505 and abs(n.z)<0.9 else None)   # the sheet's white collar shows under the chin
C.frustum('White shirt collar',(0,0.004,1.465),0.074,0.066,0.04,WHITE,'chest',n=16,scale=(1,0.9,1),caps=False)   # open ring, top at 1.485 m: the blockout's 1.523 m rim sat inside the jaw and the head could not nod or turn
for sx in (1,-1):
 C.prism('Shirt collar point %+d'%sx,[(0.0,0.0),(0.048*sx,0.004),(0.016*sx,-0.042)],0.01,WHITE,'chest',M=C.frame((0.18*sx,1,-0.25),(0,0,1),(0.006*sx,0.066,1.474)))
ring=[(0.083*math.cos(math.radians(55-290*k/14)),0.066*math.sin(math.radians(55-290*k/14))-0.004,1.457+0.008*math.cos(math.radians(55-290*k/14))**2) for k in range(15)]
C.sweep('Black shawl collar band',ring,[0.017]*4,INK,n=6,per=2,bn='chest')   # seated 1.1 cm lower than the blockout so the head can nod back
TP=P.TP
def torso_r(z):return C.interp(TP,z-0.80)
def torso_front(x,z):return V(x,0.70*math.sqrt(max(torso_r(z)**2-x*x,0.0)),z)
def torso_back(x,z):p=torso_front(x,z);return V(p.x,-p.y,p.z)
def torso_normal(p):return V(p.x/max(torso_r(p.z),1e-4)**2,p.y/(0.70*max(torso_r(p.z),1e-4))**2,0).normalized()
KNOT=torso_front(0,1.452)+V(0,0.02,0)
wing=lambda sx:[((0.06+0.052*math.cos(math.tau*k/20))*sx,(0.017+0.031*(1+math.cos(math.tau*k/20))/2)*math.sin(math.tau*k/20)) for k in range(20)]
for sx in (1,-1):
 C.prism('Black bow tie wing %+d'%sx,wing(sx),0.034,INK,'bowtie',M=C.frame((0.12*sx,1,0),(0,0,1),KNOT))
C.box('Black bow tie knot',tuple(KNOT+V(0,0.012,0)),(0.036,0.04,0.044),INK,'bowtie',bevel=0.01,segments=1)

# ================= candy-stripe jacket, seat, buttons, pocket square =================
TORSO_T=[0.0,0.02,0.06,0.10,0.14,0.20,0.26,0.32,0.38,0.44,0.50,0.55,0.59,0.62,0.645,0.665,0.68,0.69]
def jacket_tiles(c,n):
 if abs(n.z)>0.95:return INK
 return C.JACKET
C.lathe_rows('Candy-stripe jacket with painted lapels, shirt and cutaway',[(0.80+t,torso_r(0.80+t)) for t in TORSO_T],CREAM,'chest',n=40,ey=0.70,weights=torso_w,face_tile=jacket_tiles)
# raised black shawl-lapel shells over the painted lapels (the sheet notes: "keep the lapels ... as low, simple shells")
for sx,inner,outer in P.lapel_polys():
 cent=[];nor=[];bi=[];wid=[]
 for a,b in zip(inner,outer):
  pa=torso_front(*a);pb=torso_front(*b);mid=(pa+pb)/2;n=torso_normal(mid)
  cent.append(mid+n*0.0012);nor.append(n);d=pb-pa;d=(d-n*d.dot(n));wid.append(d.length/2);bi.append(d.normalized())
 def lapel_tile(c,n,sx=sx):
  if n.dot(torso_normal(c))>0.6:return C.JACKET                 # top face: the painted lapel and brass piping
  return BRASS_HI if n.x*sx>0.3 else INK                          # outer wall continues the piping as a thin brass rim
 C.ribbon('Black shawl lapel shell %+d'%sx,cent,nor,bi,wid,0.006,INK,'chest',closed=False,weights=torso_w,face_tile=lapel_tile)
C.ellipsoid('Black trouser seat',(0,-0.01,0.868),(0.152,0.1,0.082),INK,'hips',n=16,r=8)
for k,z in enumerate((1.078,1.004)):
 p=torso_front(0,z);C.ellipsoid('Brass jacket button %d'%k,tuple(p+V(0,0.005,0)),(0.018,0.009,0.018),BRASS_HI,'hips' if z<1.03 else 'spine',n=10,r=5,weights=torso_w)
for sx in (1,-1):
 p=torso_back(0.075*sx,1.0);C.ellipsoid('Brass half-belt button %+d'%sx,tuple(p+V(0,-0.012,0)),(0.014,0.007,0.014),BRASS_HI,'hips',n=10,r=5,weights=torso_w)
p=torso_front(-0.126,1.272);nr=torso_normal(p)
puff=[(-0.034,0.0),(0.034,0.0),(0.033,0.016),(0.022,0.036),(0.01,0.022),(-0.004,0.031),(-0.02,0.028),(-0.032,0.014)]
C.prism('Honey pocket square',puff,0.01,BRASS,'chest',M=C.frame(nr,(0,0,1),p+nr*0.006+V(0,0,0.004)),weights=torso_w)

# ================= arms: striped sleeves, black cuffs, white gloves =================
def sleeve(s,sx):
 S,E,W=RG.ARM[s];S0=V(0.10*sx,0,1.39)
 ctrl=[S0,S,S.lerp(E,.5),E,E.lerp(W,.5),W];path=C.catmull_pad(ctrl,3);acc=C.arclength(path);Ltot=acc[-1]
 iS=min(range(len(path)),key=lambda k:(path[k]-S).length);iE=min(range(len(path)),key=lambda k:(path[k]-E).length);sS=acc[iS];sE=acc[iE]
 def w(p):
  i=min(range(len(path)),key=lambda k:(path[k]-p).length);s_=acc[i]
  if s_<sS+0.02:t=C.smooth((s_-(sS-0.03))/0.06);return {'chest':1-t,'upper_arm_'+s:t}
  t=C.smooth((s_-(sE-0.05))/0.10);return {'upper_arm_'+s:1-t,'forearm_'+s:t}
 n=8;rr,us=C.sweep_rings(path,[0.064,0.060,0.056,0.052,0.049],n,1.0,(0,1,0))
 verts=[q for r in rr for q in r];faces=[];tiles=[]
 for j in range(len(rr)-1):
  um=(us[j]+us[j+1])/2
  for i in range(n):
   faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i));tiles.append(INK if um>0.9 else (RED if i%2==0 else CREAM))
 C.mesh('Candy-stripe sleeve '+s,verts,faces,RED,'upper_arm_'+s,MATTE,True,w,indexed(verts,faces,tiles))
 fd=(W-E).normalized()
 C.frustum('White glove cuff '+s,tuple(W+fd*0.0175),0.047,0.06,0.045,WHITE,'hand_'+s,n=12,rot=qrot(fd))
sleeve('R',1);sleeve('L',-1)
G=RG.GRIP
C.ellipsoid('White glove fist round the cane',tuple(G),(0.05,0.047,0.058),WHITE,'hand_R',n=14,r=8,rot=(0.25,-0.2,0))
C.ellipsoid('White glove thumb (cane grip)',tuple(G+V(-0.02,0.028,0.03)),(0.017,0.019,0.026),WHITE,'hand_R',n=8,r=5,rot=(0.5,0.3,0))
# open waving glove, authored at the blockout's sheet coordinates and mapped into the rest pose
ML=RG.HAND_MAP['L'];wr=RG.BLK_WRIST['L'];fdw=(wr-RG.BLK_WAVE_PREV).normalized()
PM=C.frame((0.08,1,0),fdw,wr+fdw*0.07);X=PM.col[0].xyz;Z=PM.col[2].xyz;Yn=PM.col[1].xyz;Hc=PM.translation.copy()
C.ellipsoid('White glove waving palm',(0,0,0),(0.047,0.023,0.05),WHITE,'hand_L',n=12,r=7,transform=ML@PM)
for k,(ox,ang,ln) in enumerate(((-0.031,-24,0.064),(-0.011,-8,0.074),(0.01,7,0.072),(0.029,21,0.06))):
 fdir=(Z*math.cos(math.radians(ang))+X*math.sin(math.radians(ang))).normalized();base=Hc+X*ox+Z*0.032
 _,fp,_=C.sweep('Waving glove finger %d'%k,[tuple(base),tuple(base+fdir*ln*0.55+Yn*0.004),tuple(base+fdir*ln)],[0.0145,0.0135,0.0125],WHITE,n=6,per=2,bn='hand_L',transform=ML)
 C.ellipsoid('Waving glove fingertip %d'%k,tuple(fp[-1]),(0.0126,)*3,WHITE,'hand_L',n=6,r=4,transform=ML)
tdir=(X*0.78+Z*0.5+Yn*0.25).normalized();tb=Hc+X*0.036-Z*0.012
_,tp,_=C.sweep('Waving glove thumb',[tuple(tb),tuple(tb+tdir*0.03),tuple(tb+tdir*0.052)],[0.016,0.015,0.013],WHITE,n=6,per=2,bn='hand_L',transform=ML)
C.ellipsoid('Waving glove thumb tip',tuple(tp[-1]),(0.013,)*3,WHITE,'hand_L',n=6,r=4,transform=ML)
for k in range(3):
 o=Hc-Yn*0.0215+X*(0.014*(k-1))+Z*0.004
 C.frustum('Glove back stitch %d'%k,tuple(o),0.0032,0.0032,0.045,INK,'hand_L',n=4,rot=qrot(Z),transform=ML)

# ================= mic cane =================
d=RG.CANE_D;P0=RG.CANE_P0;P1=RG.CANE_P1;MS=RG.MS
C.frustum('Black mic cane shaft',tuple((P0+d*0.04+P1)/2),0.0155,0.0145,(P1-P0).length-0.04,INK,'cane',n=8,rot=qrot(d))
C.frustum('Brass cane ferrule',tuple(P0+d*0.025),0.016,0.019,0.05,BRASS_HI,'cane',n=8,rot=qrot(d))
C.frustum('Brass cane collar',tuple(P1+d*0.005),0.022,0.02,0.03,BRASS_HI,'cane',n=10,rot=qrot(d))
MF=C.frame((0,1,0),d,P1);MX=MF.col[0].xyz
prof=[(0.0,0.004),(0.006,0.026),(0.02,0.043),(0.04,0.05),(0.08,0.05),(0.12,0.05),(0.14,0.043),(0.154,0.026),(0.16,0.004)]
C.lathe_rows('Silver broadcast mic capsule with grille bands',[(z*MS,r*MS) for z,r in prof],SILVER,'cane',n=16,ey=0.72,face_tile=lambda c,n:C.MIC,transform=C.frame((0,1,0),d,RG.MIC_C-d*0.08*MS))
yoke=[P1+(MX*0.064+d*0.118)*MS,P1+(MX*0.068+d*0.06)*MS,P1+(MX*0.045+d*0.022)*MS,P1+d*0.014*MS,P1+(-MX*0.045+d*0.022)*MS,P1+(-MX*0.068+d*0.06)*MS,P1+(-MX*0.064+d*0.118)*MS]
C.sweep('Brass mic yoke',[tuple(v) for v in yoke],[0.0085*MS]*4,BRASS,n=6,per=2,bn='cane')
for sx in (1,-1):
 C.ellipsoid('Brass yoke knob %+d'%sx,tuple(P1+(MX*0.064*sx+d*0.118)*MS),(0.015*MS,)*3,BRASS_HI,'cane',n=8,r=4)
C.ellipsoid('Glowing red on-air bulb',tuple(RG.BULB),(0.017*MS,0.017*MS,0.019*MS),BULB_T,'cane',GLOW,n=10,r=6)
# radio-static burst: eight jagged bolts and three sparks radiating round the capsule in the plane across the
# cane axis (so it opens as a starburst facing whoever the mic is swung at), bound collapsed (x0.04 about the
# capsule centre, hidden inside the capsule) and popped open by the burst bone's scale at the attack contact
BM=Matrix.Translation(RG.MIC_C)@Matrix.Scale(RG.BURST_REST_SCALE,4)@Matrix.Translation(-RG.MIC_C)
FWD=MF.col[1].xyz;K=RG.BURST_REST_SCALE
for k in range(8):
 a=math.tau*k/8+0.2;radial=(MX*math.cos(a)+FWD*math.sin(a)).normalized();side=radial.cross(d).normalized()
 pts=[RG.MIC_C+radial*(0.10+0.062*j)+side*(0.03*(1 if (j+k)%2 else -1) if 0<j<4 else 0)+d*(0.025*math.sin(j*1.7+k)) for j in range(5)]
 cent=[BM@p for p in pts];nor=[d]*5;bi=[]
 for j in range(5):
  t=(pts[min(j+1,4)]-pts[max(j-1,0)]).normalized();bi.append(t.cross(d).normalized())
 C.ribbon('Static burst bolt %d'%k,cent,nor,bi,[0.015*K*(1.2-0.17*j) for j in range(5)],0.008*K,BURST_RED if k%2==0 else STATIC_PALE,'burst',GLOW,closed=False)
for k in range(3):
 a=math.radians(60+120*k);c=RG.MIC_C+(MX*math.cos(a)+FWD*math.sin(a))*0.25
 for q in range(2):
  ax=(MX*math.cos(a+q*math.pi/2+0.4)+FWD*math.sin(a+q*math.pi/2+0.4)).normalized()
  C.box('Static burst spark %d %d'%(k,q),(0,0,0),(0.012,0.012,0.09),STATIC_PALE,'burst',bevel=0,mat=GLOW,transform=BM@Matrix.Translation(c)@C.frame(d,ax,(0,0,0)))

# ================= legs, side stripes, spectator shoes =================
for s,sx in (('R',1),('L',-1)):
 H,Kn,A=RG.LEG[s];top=H+V(0,0,0.03)
 def axis(z,H=H,Kn=Kn,A=A,top=top):
  if z>=H.z:return top.lerp(H,(top.z-z)/(top.z-H.z))
  if z>=Kn.z:return H.lerp(Kn,(H.z-z)/(H.z-Kn.z))
  return Kn.lerp(A,(Kn.z-z)/(Kn.z-A.z))
 zs=[0.95,0.90,0.84,0.76,0.68,0.60,0.555,0.515,0.475,0.40,0.32,0.25,0.19,0.15,0.12,0.093]
 rad=lambda z:C.interp([(0.093,0.061),(0.11,0.060),(0.33,0.055),(0.62,0.061),(0.95,0.068)],z)
 n=12;rr=[]
 for z in zs:
  c=axis(z);r=rad(z);rr.append([V(c.x+r*math.cos(math.tau*i/n),c.y+r*math.sin(math.tau*i/n),z) for i in range(n)])
 def leg_w(p,s=s):
  z=p.z;w={}
  t=C.smooth((z-0.84)/0.10);w['hips']=0.6*t;th=1-0.6*t
  k=C.smooth((0.56-z)/0.09);an=C.smooth((0.165-z)/0.05)
  w['thigh_'+s]=th*(1-k);w['shin_'+s]=th*k*(1-an);w['foot_'+s]=th*k*an
  return w
 C.rings('Black trouser leg '+s,rr,INK,'thigh_'+s,weights=leg_w)
 szs=[0.93,0.86,0.78,0.70,0.62,0.56,0.515,0.47,0.40,0.32,0.25,0.19,0.15,0.118]
 out=V(sx,0,0)
 C.ribbon('Red trouser side stripe '+s,[axis(z)+out*(rad(z)-0.0015) for z in szs],[out]*len(szs),[V(0,1,0)]*len(szs),0.0085,0.0038,RED,'thigh_'+s,closed=False,weights=leg_w)
 loc,yaw=RG.FOOT[s];F=Matrix.Translation(loc)@Matrix.Rotation(yaw,4,'Z')
 C.box('Spectator shoe sole '+s,(0,0.032,0.012),(0.106,0.30,0.024),INK,'foot_'+s,bevel=0.008,segments=1,transform=F)
 C.box('Spectator shoe cream upper '+s,(0,0.018,0.058),(0.096,0.25,0.072),CREAM,'foot_'+s,bevel=0.026,segments=2,transform=F)
 C.ellipsoid('Spectator shoe black toe cap '+s,(0,0.112,0.046),(0.053,0.072,0.042),INK,'foot_'+s,n=12,r=6,transform=F)
 C.box('Spectator shoe black heel '+s,(0,-0.086,0.058),(0.099,0.075,0.076),INK,'foot_'+s,bevel=0.02,segments=1,transform=F)
 for k in range(3):
  C.box('Spectator shoe lace %s %d'%(s,k),(0,0.05-0.026*k,0.094+0.006*k),(0.046,0.008,0.007),INK,'foot_'+s,bevel=0,rot=(math.radians(-20),0,0),transform=F)

# ================= join one skin, build the rig =================
for ob in C.PARTS:
 if ob.name.endswith('.001'):ob.name=ob.name[:-4]
sources=bpy.data.collections.new('EDITABLE original radio host showman parts - excluded from export');sc.collection.children.link(sources)
inventory=[];copies=[]
for pi,ob in enumerate(C.PARTS):
 at=ob.data.attributes.new('rhs_part','INT','FACE');at.data.foreach_set('value',[pi]*len(ob.data.polygons))
for ob in C.PARTS:
 ob.data.calc_loop_triangles();inventory.append({'name':ob.name,'triangles':len(ob.data.loop_triangles),'bone_groups':[g.name for g in ob.vertex_groups],'atlas_tile':ob.get('atlas_tile'),'material':ob.data.materials[0].name})
 cp=ob.copy();cp.data=ob.data.copy();sc.collection.objects.link(cp);copies.append(cp)
 for col in list(ob.users_collection):col.objects.unlink(ob)
 sources.objects.link(ob)
sources.hide_render=True;sources.hide_viewport=True
bpy.ops.object.select_all(action='DESELECT')
for ob in copies:ob.select_set(True)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();skin=bpy.context.object;skin.name='Radio_Host_Showman_Skin'
for tag in ['source_part','rigid_weight','atlas_tile']:
 if tag in skin:del skin[tag]
skin.data.calc_loop_triangles();tris=len(skin.data.loop_triangles)
REST=RG.rest_bones(KNOT)
data=bpy.data.armatures.new('Original radio host showman rig');arm=bpy.data.objects.new('Radio_Host_Showman_Rig',data);sc.collection.objects.link(arm)
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
arm['asset_id']='radio-host-showman';arm['version']='v001';arm['forward']='Blender +Y / glTF -Z';arm['neutral_total_height_m']=round(hi[2],4);arm['attack_contact_fraction']=.625
mats={}
for poly in skin.data.polygons:mats[poly.material_index]=mats.get(poly.material_index,0)+1
record={'asset_id':'radio-host-showman','version':'v001','work_order':'WO111','authoring_model':'claude-opus-5-5 xhigh (Claude Code subagent; Tom ruled Sept 26 that Claude Opus 5.5 does the WO111 Blender work)','blender_version':bpy.app.version_string,
 'source_reference':'Blender reference sheet, no generated concept','source_sheet_sha256':sc['source_sheet_sha256'],'source_blockout_sha256':sc['source_blockout_sha256'],
 'rest_bounds_blender_z_up':{'min':lo,'max':hi},'height_m':hi[2],'triangles':tris,'vertices':len(skin.data.vertices),'material_count':len(skin.data.materials),'materials':[m.name for m in skin.data.materials],'faces_per_material':mats,'bone_count':len(data.bones),
 'texture':{'file':'pigment.png','width':1024,'height':1024,'origin':'Original painted atlas generated with numpy in Blender Python (paint.py): face, jacket, iris and mic-band regions plus flat sheet-colour and glow tiles; no external textures. The glow material uses the same atlas as its emission texture.','layout':atlas},
 'glow_parts':[r['name'] for r in inventory if r['material'].startswith('Glowing')],
 'parts':inventory}
(ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n')
rest_json={k:[list(map(float,h)),list(map(float,t)),p] for k,(h,t,p) in REST.items()}
(ROOT/'source/rig-rest.json').write_text(json.dumps({'rest':rest_json},indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'radio-host-showman-construction.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(ROOT/'radio-host-showman-checkpoint.glb'),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_yup=True,export_apply=False,export_armature_object_remove=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=True)
big=sorted(inventory,key=lambda r:-r['triangles'])
print(json.dumps({'triangles':tris,'vertices':len(skin.data.vertices),'height_m':hi[2],'bounds':[lo,hi],'bones':len(data.bones),'faces_per_material':mats,'largest':[(r['name'],r['triangles']) for r in big[:22]]}))
