"""WO098 original Rat Pit Boss. Blender +Z up / +Y forward; no borrowed inputs.
Construction script, rig and exact five clips. Requires adjacent common.py.
"""
import bpy, math, json, hashlib, sys
from pathlib import Path
from mathutils import Vector, Matrix, Euler
import numpy as np

ROOT=Path('/workspace/haynes-quest/rat-casino-cast/rat-pit-boss/v001')
ROOT.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(ROOT/'source'))
import common as C
C.BASE=ROOT.parent

def atlas():
    colors=['25272b','716b5e','b5a28a','501322','74273d','171a20','bd914b','796044','e6d6b1','7c4b4e','17131a','a9be9b','edb954','53524b','fff0ce','865b50']
    rng=np.random.default_rng(9801);pix=np.zeros((1024,1024,4),dtype=np.float32);pix[:,:,3]=1
    yy,xx=np.mgrid[0:256,0:256]
    for i,h in enumerate(colors):
        rgb=np.array([int(h[j:j+2],16)/255 for j in (0,2,4)])
        cloud=.018*np.sin(xx*.031+yy*.019)+.013*np.cos(xx*.067-yy*.033)
        grain=rng.normal(0,.009,(256,256))
        if i in (3,4):grain+=.009*np.sin(xx*math.pi)*np.sin(yy*1.8)
        scratch=(rng.random((256,256))>.997).astype(float)*.10
        edge=.016*np.maximum(0,np.sin(xx*.12+yy*.45))**16
        tile=np.clip(rgb[None,None,:]+(cloud+grain+scratch+edge)[:,:,None],.005,1)
        row=3-i//4;col=i%4;pix[row*256:(row+1)*256,col*256:(col+1)*256,:3]=tile
    im=bpy.data.images.new('Rat Casino original painted pigment atlas',width=1024,height=1024)
    im.pixels.foreach_set(pix.ravel());im.filepath_raw=str(ROOT/'pigment.png');im.file_format='PNG';im.save();bpy.data.images.remove(im)

atlas();C.setup('v001',2.15,1.25,2.0,[('Aged mascot metal',.48,.43),('Worn stage cloth and painted insets',.76,.035)])
C.SPEC.update(asset_id='rat-pit-boss',version='v001',source_concept_sha256='3f0b6894d8136cdd40b61701ac1b32378e2e182dce842ae4a191641e266897d6')

def ell(name,p,s,col,bn='chest',mat=0,n=16,r=8,rot=(0,0,0)):
    return C.ellipsoid(name,p,s,col,bn,mat,n,r,rot)
def tube(name,points,radius,col,bn='chest',mat=0,n=10):
    return C.tube(name,points,radius,col,bn,mat,n)
def line(name,points,radius,col,bn='chest',mat=0,n=6):
    return C.curve(name,points,radius,col,bn,mat,n,steps=2)
def box(name,p,s,col,bn='chest',mat=0,bevel=.007,rot=(0,0,0)):
    return C.box(name,p,s,col,bn,bevel,2,mat,rot)
def rings(name,rows,col,bn='chest',mat=0):
    return C.rings(name,rows,col,bn,mat)
def zshape(name,rows,col,bn='chest',mat=0,n=20):
    return rings(name,[[(x+rx*math.cos(math.tau*i/n),y+ry*math.sin(math.tau*i/n),z) for i in range(n)] for z,x,y,rx,ry in rows],col,bn,mat)
def disk(name,c,rad,depth,col,bn='chest',n=16):
    return tube(name,[(c[0],c[1]-depth/2,c[2]),(c[0],c[1]+depth/2,c[2])],rad,col,bn,n=n)
def bolt(name,c,rad=.010,bn='chest'):
    disk(name,c,rad,.006,6,bn,8)
    box(name+' screw slot',(c[0],c[1]+.004,c[2]),(rad*1.05,.0015,rad*.18),7,bn,bevel=0)

# Broad mechanical pelvis, fitted torso and long burgundy stage coat.
ell('Pewter segmented hip shell',(0,-.01,.86),(.195,.12,.155),0,'hips',n=20,r=8)
zshape('Tapered red dealer coat',[(.86,0,-.02,.17,.13),(1.00,0,-.015,.19,.132),(1.17,0,-.02,.235,.145),(1.30,0,-.028,.262,.13),(1.37,0,-.025,.18,.112)],3,'chest',1)
C.prism('Ivory shirt bib',[(-.135,1.355),(.135,1.355),(.055,1.105),(-.042,1.105)],.126,.020,8,'chest',1,.003)
for s in [-1,1]:
    C.prism(('Left' if s>0 else 'Right')+' pointed jacket lapel',[(s*.055,1.13),(s*.19,1.29),(s*.155,1.36),(s*.22,1.27),(s*.122,1.08)],.158,.028,4,'chest',1,.007)
    line('Lapel brass edge '+str(s),[(s*.145,.178,1.35),(s*.195,.180,1.28),(s*.10,.182,1.145)],.004,6,n=5)
    C.prism('Split swallow coat tail '+str(s),[(s*.035,.95),(s*.178,1.02),(s*.23,.66),(s*.14,.715),(s*.09,.65)],-.12,.045,3,'chest',1,.009)
    line('Rear coat piping '+str(s),[(s*.15,-.146,1.12),(s*.175,-.159,.91),(s*.20,-.15,.695)],.004,4,mat=1,n=5)
    box('Angled jacket welt pocket '+str(s),(s*.133,.139,1.115),(.095,.025,.020),4,mat=1,rot=(0,s*.08,s*.04))
for z in [1.115,1.024,.936]:
    for s in [-1,1]:bolt('Double-breasted brass button '+str(s)+' '+str(z),(s*.055,.150,z),.014)
for z in [1.30,1.25,1.205]:disk('Shirt button '+str(z),(0,.143,z),.0065,.007,7)
C.bow('Black theatrical bow tie',(0,.17,1.352),.13,5,'chest',1)
for s in [-1,1]:
    C.prism('Stiff ivory collar '+str(s),[(s*.03,1.32),(s*.12,1.39),(s*.062,1.415),(0,1.37)],.145,.019,8,'chest',1,.003)
line('Pocket watch chain',[(.085,.176,1.033),(.115,.183,.953),(.172,.165,.963),(.184,.153,1.072)],.006,6,n=7)
disk('Pocket watch gold case',(.167,.15,1.075),.027,.013,6)
disk('Pocket watch dark face',(.167,.16,1.075),.019,.004,5)
line('Watch hand',[(.167,.164,1.075),(.174,.164,1.09)],.0025,8,n=4)
zshape('Exposed brass neck spindle',[(1.345,0,0,.059,.055),(1.47,0,0,.061,.054)],7,'neck',n=14)
for z in [1.39,1.425]:C.ellipse_loop('Neck bearing '+str(z),(0,0,z),.068,.061,.009,6,'neck',n=16,tube_n=6)

# Long rodent face, offset expressive eyes, separate jaw and plate seams.
ell('Tapered rat head plate',(0,.008,1.591),(.167,.112,.183),1,'head',n=24,r=12)
ell('Long upper rat muzzle',(0,.175,1.548),(.098,.190,.083),2,'head',n=24,r=10)
ell('Right angular whisker pad',(-.071,.17,1.537),(.08,.088,.066),2,'head',n=16,r=7)
ell('Left angular whisker pad',(.071,.17,1.537),(.08,.088,.066),2,'head',n=16,r=7)
ell('Dark open smile cavity',(0,.169,1.468),(.112,.128,.050),10,'head',1,n=20,r=7)
ell('Lower articulated rat jaw',(0,.18,1.443),(.099,.137,.043),1,'jaw',n=20,r=8)
ell('Satin black heart-shaped nose',(0,.347,1.568),(.059,.042,.040),5,'head',n=20,r=8)
ell('Nose center upper lobe',(0,.36,1.59),(.038,.021,.015),0,'head',n=12,r=6)
for s in [-1,1]:
    ell('Inset nostril '+str(s),(s*.026,.382,1.575),(.012,.006,.008),10,'head',n=10,r=5)
    disk('Jaw exposed hinge '+str(s),(s*.133,.077,1.47),.028,.020,7,'jaw',12)
    bolt('Jaw hinge bolt '+str(s),(s*.133,.089,1.47),.013,'jaw')
    for j in range(3):
        x=s*(.034+j*.025);y=.286-j*.035
        box('Upper comic ivory tooth '+str(s)+' '+str(j),(x,y,1.484),(.020,.023,.036-j*.002),8,'head',1,.004,rot=(0,s*.12,0))
    box('Large front rat incisor '+str(s),(s*.017,.307,1.496),(.027,.027,.048),8,'head',1,.006)
    for j in range(3):ell('Whisker socket '+str(s)+' '+str(j),(s*(.078+j*.014),.217-j*.014,1.565-j*.017),(.009,.005,.008),7,'head',n=8,r=4)
    # Asymmetrical, angular brass whiskers; 3 per side, conspicuous at mobile scale.
    for j in range(3):
        line('Brass whisker '+str(s)+' '+str(j),[(s*.088,.222,1.55-j*.016),(s*(.175+.015*j),.269,1.575-j*.046),(s*(.285+.012*j+(s>0)*.02),.275,1.61-j*.076)], [.0038,.0030,.0013],6,'head',n=5)
    line('Face plate temple seam '+str(s),[(s*.109,.078,1.746),(s*.138,.094,1.686),(s*.136,.11,1.59)],.0037,10,'head',1,n=5)
    bolt('Cheek service screw '+str(s),(s*.134,.137,1.55),.008,'head')
line('Central face plate seam',[(0,.082,1.765),(0,.11,1.71),(0,.112,1.655),(0,.198,1.615)],.0031,7,'head',n=5)

# Round dished ears, solid rim and visible mechanical spokes at the back.
for s in [-1,1]:
    c=(s*.196,-.012,1.718)
    ell('Round rat ear shell '+str(s),c,(.119,.038,.132),1,'head',n=22,r=10,rot=(0,s*-.18,0))
    ell('Recessed copper ear bowl '+str(s),(c[0],c[1]+.034,c[2]),(.093,.009,.105),9,'head',1,n=20,r=8)
    C.ellipse_loop('Brass rolled ear rim '+str(s),(c[0],.014,c[2]),.116,.129,.0065,6,'head',normal='y',n=26,tube_n=6)
    ell('Inner ear lower fold '+str(s),(c[0]-s*.020,.04,c[2]-.041),(.041,.014,.052),7,'head',n=14,r=7)
    for j in [-1,0,1]:line('Rear ear service rib '+str(s)+' '+str(j),[(c[0],-.053,c[2]-.073),(c[0]+j*.051,-.05,c[2]+.057)],.006,0,'head',n=5)
    bolt('Ear rim fastener '+str(s),(c[0]+s*.092,.02,c[2]),.009,'head')

# One wary green eye and one brass-rimmed amber eye.
for s in [-1,1]:
    x=s*.081;z=1.66+(s>0)*.008
    ell('Eye dark mechanical socket '+str(s),(x,.097,z),(.069,.040,.063),0,'head',n=18,r=8)
    ell('Ivory eye '+str(s),(x,.129,z),(.051,.031,.048),8,'head',1,n=20,r=10)
    ell('Expressive iris '+str(s),(x-s*.004,.158,z-.003),(.026,.009,.029),12 if s>0 else 11,'head',1,n=16,r=8)
    ell('Vertical black pupil '+str(s),(x-s*.004,.167,z-.003),(.012,.004,.023),10,'head',1,n=14,r=6)
    ell('Eye catchlight '+str(s),(x-.010,.172,z+.013),(.008,.003,.009),14,'head',1,n=8,r=4)
    line('Heavy theatrical brow '+str(s),[(x-s*.053,.119,z+.037),(x-s*.01,.138,z+.065),(x+s*.05,.099,z+.05 if s<0 else z+.079)], [.012,.018,.010],0,'head',n=7)
    if s<0:
        line('Wary lowered upper eyelid',[(x-.046,.15,z+.022),(x,.157,z+.028),(x+.04,.15,z+.017)],.009,1,'head',n=7)
    else:
        C.ellipse_loop('Right brass optical bezel',(x,.119,z),.063,.061,.007,6,'head',normal='y',n=24,tube_n=6)

# Tall slightly flared black hat, contrasting red band and original crescent.
C.lathe('Broad oval top-hat brim',(0,-.018,1.803),[(0,.212),(.012,.215),(.024,.188)],5,'head',0,n=28,ellipse=(1,.73))
C.lathe('Flared tall black top hat',(0,-.024,1.824),[(0,.140),(.027,.142),(.25,.167),(.286,.176),(.296,.170)],5,'head',0,n=28,ellipse=(1,.79))
C.lathe('Worn burgundy hat ribbon',(0,-.024,1.827),[(0,.144),(.047,.149)],3,'head',1,n=28,ellipse=(1,.80))
C.ellipse_loop('Top brass hat edge',(0,-.024,2.115),.172,.135,.0045,6,'head',n=30,tube_n=5)
line('Hat crescent emblem',[(-.006,.111,2.035),(-.041,.107,2.017),(-.051,.104,1.983),(-.03,.109,1.96),(-.003,.113,1.958)],.008,6,'head',n=6)
for x,z in [(-.085,2.05),(.072,1.998),(.117,2.073)]:
    line('Fine hat scratch '+str(x),[(x,.100,z),(x+.006,.105,z-.024),(x+.02,.108,z-.030)],.0019,7,'head',n=4)
for s in [-1,1]:bolt('Hat ribbon rivet '+str(s),(s*.11,.078,1.853),.006,'head')

# Segmented mechanical limbs. Shoulder/elbow/wrist spheres overlap sockets.
REST={
 'root':((0,0,0),(0,0,.075),None),
 'hips':((0,0,.855),(0,0,1.02),'root'),
 'chest':((0,0,1.02),(0,0,1.35),'hips'),
 'neck':((0,0,1.35),(0,0,1.46),'chest'),
 'head':((0,0,1.46),(0,0,1.73),'neck'),
 'jaw':((0,.07,1.463),(0,.25,1.455),'head'),
}
for label,s in [('R',-1),('L',1)]:
    shoulder=Vector((s*.261,-.012,1.305));elbow=Vector((s*.394,.014,1.077));wrist=Vector((-.515,.173,1.08) if s<0 else (.511,.148,1.216))
    handtail=wrist+Vector((-.025,.02,-.085) if s<0 else (.01,.015,.12))
    REST['clavicle_'+label]=((0,0,1.30),tuple(shoulder),'chest')
    REST['upper_arm_'+label]=(tuple(shoulder),tuple(elbow),'clavicle_'+label)
    REST['forearm_'+label]=(tuple(elbow),tuple(wrist),'upper_arm_'+label)
    REST['hand_'+label]=(tuple(wrist),tuple(handtail),'forearm_'+label)
    ell(label+' dark shoulder bearing',shoulder,(.092,.084,.092),0,'upper_arm_'+label,n=16,r=8)
    tube(label+' exposed brass upper spindle',[shoulder.lerp(elbow,.12),shoulder.lerp(elbow,.87)],[.048,.040],7,'upper_arm_'+label,n=12)
    tube(label+' tapered upper arm shell',[shoulder.lerp(elbow,.17),shoulder.lerp(elbow,.28),shoulder.lerp(elbow,.76),shoulder.lerp(elbow,.87)],[.081,.083,.066,.054],1,'upper_arm_'+label,n=16)
    for f in [.24,.73]:tube(label+' upper shell band '+str(f),[shoulder.lerp(elbow,f-.014),shoulder.lerp(elbow,f+.014)],.083 if f<.5 else .068,0,'upper_arm_'+label,n=16)
    ell(label+' exposed elbow ball',elbow,(.06,.06,.06),7,'forearm_'+label,n=16,r=8)
    bolt(label+' elbow bearing center',(elbow.x,elbow.y+.060,elbow.z),.027,'forearm_'+label)
    tube(label+' tapering forearm shell',[elbow.lerp(wrist,.16),elbow.lerp(wrist,.28),elbow.lerp(wrist,.84)],[.052,.065,.048],1,'forearm_'+label,n=16)
    tube(label+' ivory dealer cuff',[elbow.lerp(wrist,.73),elbow.lerp(wrist,.88)],[.069,.063],8,'forearm_'+label,1,n=16)
    bolt(label+' cufflink',(elbow.lerp(wrist,.80).x,elbow.lerp(wrist,.80).y+.06,elbow.lerp(wrist,.80).z),.015,'forearm_'+label)
    ell(label+' hand wrist bearing',wrist,(.041,.038,.037),7,'hand_'+label,n=12,r=6)
    if s<0:
        ell('Cane hand palm',(-.541,.189,1.061),(.061,.044,.045),1,'hand_R',n=16,r=7)
        for j in range(4):
            x=-.586+j*.026
            line('Cane hand articulated finger '+str(j),[(x,.213,1.072),(x,.247,1.053),(x,.242,1.018)], [.011,.013,.010],1,'hand_R',n=7)
            ell('Cane knuckle '+str(j),(x,.229,1.059),(.013,.014,.014),7,'hand_R',n=10,r=5)
        line('Cane hand thumb',[(-.501,.195,1.057),(-.501,.228,1.029),(-.522,.237,1.018)],.016,1,'hand_R',n=8)
    else:
        ell('Open showman palm',(.52,.16,1.266),(.061,.028,.064),1,'hand_L',n=16,r=8)
        disk('Open palm central service cap',(.52,.191,1.268),.032,.006,0,'hand_L',12)
        for j in range(4):
            x=.476+j*.030;length=[.074,.096,.103,.078][j];splay=(j-1.5)*.017
            line('Welcome finger '+str(j),[(x,.159,1.30),(x+splay*.5,.170,1.34),(x+splay,.196,1.30+length)], [.012,.013,.008],1,'hand_L',n=7)
            ell('Welcome finger joint '+str(j),(x+splay*.5,.170,1.34),(.014,.014,.014),7,'hand_L',n=10,r=5)
        line('Open curled thumb',[(.477,.17,1.258),(.447,.19,1.293),(.448,.209,1.322)], [.019,.016,.010],1,'hand_L',n=8)
    hip=Vector((s*.112,-.015,.87));knee=Vector((s*.181,.024,.486));ankle=Vector((s*.22,.005,.137))
    REST['thigh_'+label]=(tuple(hip),tuple(knee),'hips');REST['shin_'+label]=(tuple(knee),tuple(ankle),'thigh_'+label)
    REST['foot_'+label]=(tuple(ankle),(s*.22,.185,.104),'shin_'+label)
    ell(label+' brass hip ball',hip,(.080,.074,.077),7,'thigh_'+label,n=14,r=7)
    tube(label+' long tapered thigh armor',[hip.lerp(knee,.14),hip.lerp(knee,.30),hip.lerp(knee,.88)],[.084,.090,.069],1,'thigh_'+label,n=16)
    line(label+' thigh longitudinal seam',[hip.lerp(knee,.28)+Vector((0,.09,0)),hip.lerp(knee,.81)+Vector((0,.072,0))],.004,0,'thigh_'+label,n=5)
    ell(label+' exposed knee sphere',knee,(.072,.069,.071),7,'shin_'+label,n=16,r=8)
    bolt(label+' round knee cap',(knee.x,knee.y+.065,knee.z),.040,'shin_'+label)
    tube(label+' shin spindle',[knee,ankle],.035,7,'shin_'+label,n=12)
    tube(label+' plated flared shin',[knee.lerp(ankle,.19),knee.lerp(ankle,.41),knee.lerp(ankle,.88)],[.058,.065,.055],1,'shin_'+label,n=16)
    line(label+' shin armor seam',[knee.lerp(ankle,.25)+Vector((0,.058,0)),knee.lerp(ankle,.82)+Vector((0,.058,0))],.0034,0,'shin_'+label,n=5)
    ell(label+' ankle bearing',ankle,(.056,.057,.043),7,'foot_'+label,n=12,r=6)
    box(label+' broad grounded boot sole',(s*.22,.071,.032),(.226,.295,.056),5,'foot_'+label,1,.018)
    ell(label+' articulated boot armor',(s*.22,.055,.092),(.113,.135,.071),0,'foot_'+label,n=18,r=8)
    for j in [-1,0,1]:
        ell(label+' rat toe '+str(j),(s*.22+j*.070,.18,.064),(.044,.076,.045),1,'foot_'+label,n=12,r=6)
        ell(label+' ivory toe cap '+str(j),(s*.22+j*.071,.231,.061),(.022,.03,.026),2,'foot_'+label,n=10,r=5)

# Dice cane stays fully attached to the R hand and clears the floor in all clips.
tube('Black dice-cane shaft',[(-.56,.188,.018),(-.56,.188,.940)],.014,5,'hand_R',n=12)
tube('Brass cane ferrule',[(-.56,.188,.018),(-.56,.188,.09)],.020,6,'hand_R',n=12)
tube('Gold cane head collar',[(-.56,.188,.914),(-.56,.188,.963)],[.030,.030],6,'hand_R',n=14)
box('Ivory die cane handle',(-.56,.188,1.003),(.096,.096,.096),8,'hand_R',1,.010)
for dx,dz in [(-.023,-.023),(.023,-.023),(0,0),(-.023,.023),(.023,.023)]:
    disk('Front die pip '+str(dx)+' '+str(dz),(-.56+dx,.238,1.003+dz),.0075,.002,10,'hand_R',10)
for dz in [-.025,0,.025]:ell('Side die pip '+str(dz),(-.609,.188,1.003+dz),(.002,.0075,.0075),10,'hand_R',1,n=10,r=5)

# Original counterweight tail: swept behind the jacket, not a second silhouette.
tailpts=[(0,-.117,.872),(.075,-.232,.83),(.252,-.288,.738),(.435,-.31,.681),(.565,-.32,.720),(.611,-.31,.852),(.556,-.282,.92)]
REST['tail_1']=(tailpts[0],tailpts[2],'hips');REST['tail_2']=(tailpts[2],tailpts[4],'tail_1');REST['tail_3']=(tailpts[4],tailpts[6],'tail_2')
for j in range(3):
    a=j*2;line('Segmented tail curve '+str(j),tailpts[a:a+3],[.032-j*.006,.028-j*.006,.026-j*.007],15,'tail_'+str(j+1),n=10)
    for k in [0,1]:
        p=Vector(tailpts[a+k]);q=Vector(tailpts[a+k+1]);d=(q-p).normalized();p=p.lerp(q,.46)
        tube('Tail brass band '+str(j)+' '+str(k),[p-d*.009,p+d*.009],.031-j*.007,7,'tail_'+str(j+1),n=10)

# Lower the complete hat onto the head plate after the first actual-GLB audit.
# The earlier generated blueprint left the brim hovering above the skull.
for ob in C.PARTS:
    if 'hat' in ob.name.lower():
        for v in ob.data.vertices:v.co.z-=.042
# A rear service seam adds readable plate construction to the otherwise plain back.
line('Rear head service seam',[(0,-.10,1.48),(0,-.107,1.60),(0,-.072,1.715)],.0037,0,'head',n=5)
# Editable named parts and one two-primitive runtime skin.
pts=[v.co for ob in C.PARTS for v in ob.data.vertices];lo=min(v.z for v in pts);factor=2.15/(max(v.z for v in pts)-lo)
sources=bpy.data.collections.new('EDITABLE named authored parts — excluded from GLB');bpy.context.scene.collection.children.link(sources)
inventory=[];copies=[]
for ob in C.PARTS:
    for v in ob.data.vertices:v.co=Vector((v.co.x*factor,v.co.y*factor,(v.co.z-lo)*factor))
    ob.data.calc_loop_triangles();inventory.append({'name':ob.name,'vertices':len(ob.data.vertices),'triangles':len(ob.data.loop_triangles),'bone_groups':[g.name for g in ob.vertex_groups],'pigment_tile':ob.get('atlas_tile')})
    cp=ob.copy();cp.data=ob.data.copy();bpy.context.collection.objects.link(cp);copies.append(cp)
    bpy.context.view_layer.objects.active=cp
    dec=cp.modifiers.new('Mobile runtime simplification; editable source retained','DECIMATE');dec.ratio=.80;dec.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=dec.name)
    for col in list(ob.users_collection):col.objects.unlink(ob)
    sources.objects.link(ob)
sources.hide_render=True;sources.hide_viewport=True
bpy.ops.object.select_all(action='DESELECT')
for ob in copies:ob.select_set(True)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();skin=bpy.context.object;skin.name='Rat_Pit_Boss_Skin'
data=bpy.data.armatures.new('Rat Pit Boss maintainable segmented skeleton');arm=bpy.data.objects.new('Rat_Pit_Boss_Rig',data);bpy.context.collection.objects.link(arm)
skin.select_set(False);arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
def scaled(p):p=Vector(p);return Vector((p.x*factor,p.y*factor,(p.z-lo)*factor))
for name,(head,tail,parent) in REST.items():
    b=data.edit_bones.new(name);b.head=scaled(head);b.tail=scaled(tail)
    if name=='root':b.head=(0,0,0);b.tail=(0,0,.075*factor)
    if parent:b.parent=data.edit_bones[parent];b.use_connect=(b.head-b.parent.tail).length<.000001
    b.use_deform=name!='root' and not name.startswith('clavicle')
bpy.ops.object.mode_set(mode='OBJECT')
mod=skin.modifiers.new('Rigid segmented mechanical skin','ARMATURE');mod.object=arm;skin.parent=arm
arm['asset_id']='rat-pit-boss';arm['candidate']='v001 studio-only, exact owner-art review pending';arm['forward']='Blender +Y / glTF -Z';arm['neutral_total_height_m']=2.15
arm['source_concept_sha256']=C.SPEC['source_concept_sha256'];arm['attack_contact_fraction']=.625
bpy.context.view_layer.update()
skin.data.calc_loop_triangles();triangles=len(skin.data.loop_triangles)
record={'asset_id':'rat-pit-boss','version':'v001','authoring_model':'gpt-6-astra max','blender_version':bpy.app.version_string,'source_concept_sha256':C.SPEC['source_concept_sha256'],'spec':C.SPEC,'height_m':2.15,'construction_scale_factor':factor,'construction_ground_shift':lo,'triangles':triangles,'vertices':len(skin.data.vertices),'material_count':len(skin.data.materials),'texture':{'file':'pigment.png','width':1024,'height':1024,'origin':'Original deterministic procedural pigment, no external art or downloaded textures.'},'bone_count':len(data.bones),'parts':inventory,'notes':['One articulated skin; hard plate islands have one joint influence.','Root stays stationary; IK is baked into simple exported bone tracks.','Tail back anatomy and mechanical ear backs are original construction decisions from v002 front-three-quarter reference.']}
(ROOT/'construction.json').write_text(json.dumps(record,indent=2)+'\n')
(ROOT/'source'/'rig-rest.json').write_text(json.dumps({'rest':REST,'factor':factor,'ground':lo},indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'rat-pit-boss-construction.blend'))
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(ROOT/'rat-pit-boss-checkpoint.glb'),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_yup=True,export_apply=False,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=False)
print(json.dumps({'checkpoint':'rat-pit-boss-construction.blend','triangles':triangles,'height_m':2.15,'materials':len(skin.data.materials),'parts':len(inventory),'glb_bytes':(ROOT/'rat-pit-boss-checkpoint.glb').stat().st_size}))
