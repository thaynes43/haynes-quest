"""WO051 original Besties geometry, constructed from the approved joint concept.

Coordinates are metres, Blender Z-up and +Y forward. The runtime GLB is Y-up,
-Z forward. The named construction parts remain editable in every master.
"""
import math
import common as C
from common import Vector

SKIN,CLOTH,HAIR,EYE,RUBBER=0,1,2,3,4
SIDES={'R':1,'L':-1}

def blend(a,b,t):
    t=max(0,min(1,t));return {a:1-t,b:t}

def torso_weights(p):return blend('hips','spine',(p.z-.64)/.14)
def hair_weights(p):return blend('spine','head',(p.z-.79)/.30)

def arm_weights(side,p):
    shoulder=Vector((side*.235,0,.925));elbow=Vector((side*.322,0,.744));wrist=Vector((side*.370,0,.567))
    label='R' if side==1 else 'L'
    if p.z>.905:return blend('clavicle_'+label,'upper_arm_'+label,(.95-p.z)/.055)
    return blend('upper_arm_'+label,'forearm_'+label,(.784-p.z)/.080)

def leg_weights(label,p):
    if p.z>.535:return blend('thigh_'+label,'hips',(p.z-.535)/.068)
    return blend('shin_'+label,'thigh_'+label,(p.z-.315)/.080)

def super_ring(x,y,z,rx,ry,n=16,power=3.2):
    def sp(v):return math.copysign(abs(v)**(2/power),v)
    return [(x+rx*sp(math.cos(i*math.tau/n)),y+ry*sp(math.sin(i*math.tau/n)),z) for i in range(n)]

def symbol(name,x,y,z,r,tile,shape='star',bone='spine'):
    if shape=='star':
        poly=[(x+math.sin(i*math.pi/5)*r*(1 if i%2==0 else .46),z+math.cos(i*math.pi/5)*r*(1 if i%2==0 else .46)) for i in range(10)]
    else:
        poly=[]
        for i in range(20):
            a=math.tau*i/20;poly.append((x+r*math.sin(a)**3,z+r*(13*math.cos(a)-5*math.cos(2*a)-2*math.cos(3*a)-math.cos(4*a))/17))
    return C.prism(name,poly,y,.014,tile,bone,CLOTH,bevel=.005)

def strand(name,points,widths,tile=6,thickness=.52):
    """Broad elliptical lock with a sculpted ridge; no strand/curve runtime."""
    points=[Vector(p) for p in points];centres=[];width=[]
    for i in range(len(points)-1):
        a,b,c,d=points[max(i-1,0)],points[i],points[i+1],points[min(i+2,len(points)-1)]
        for j in range(2 if name.startswith('Back hair') else 3):
            t=j/(2 if name.startswith('Back hair') else 3);centres.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
            width.append(widths[i]*(1-t)+widths[i+1]*t)
    centres.append(points[-1]);width.append(widths[-1]);rings=[]
    for i,p in enumerate(centres):
        tangent=(centres[min(i+1,len(centres)-1)]-centres[max(i-1,0)]).normalized()
        u=tangent.cross(Vector((0,1,0))).normalized();v=tangent.cross(u).normalized()
        rings.append([p+width[i]*(u*math.cos(a)*(1+.055*math.cos(3*a))+v*math.sin(a)*thickness) for a in [j*math.tau/10 for j in range(10)]])
    return C.rings(name,rings,tile,'head',HAIR,weights=hair_weights)

def hair(pink):
    # Scalp shell stops above the forehead, continues lower behind the ears.
    rings=[];n=32
    for row in range(9):
        ring=[]
        for i in range(n):
            phi=i*math.tau/n;front=(math.sin(phi)+1)/2
            theta=(row/8)*(2.34-1.40*front**2)
            st=max(.0002,math.sin(theta))
            ring.append((.251*st*math.cos(phi),-.025+.195*st*math.sin(phi),1.158+.232*math.cos(theta)))
        rings.append(ring)
    C.rings('Parted sculpted crown',rings,6,'head',HAIR,weights=hair_weights)
    # Broad overlapping locks make one readable long-haired mass from the back.
    for i,x in enumerate([-.231,-.177,-.119,-.059,0,.062,.124,.181,.232]):
        y=-.098-.105*(1-abs(x)/.27);phase=(i%3-1)*.017
        top=1.31-.07*abs(x)/.25
        points=[(x*.57,-.11,top),(x*.85,y,1.16),(x+phase,y-.025,1.025),(x-phase,y-.013,.91),(x+phase*1.3,y+.012,.795),(x*.94+phase,y+.043,.744+(i%3)*.022)]
        strand('Back hair lock %02d'%i,points,[.063,.064,.065,.066,.052,.009],7 if pink and i%3==1 else 6)
    # Sweeping front part and two long temple locks on either side.
    for s in [-1,1]:
        strand('Swept fringe '+str(s),[(s*.010,.072,1.373),(s*.085,.143,1.345),(s*.160,.169,1.251),(s*.216,.142,1.163),(s*.242,.079,1.090)], [.046,.066,.065,.055,.018],6)
        strand('Face framing wave '+str(s),[(s*.221,.087,1.190),(s*.258,.109,1.083),(s*.238,.153,.987),(s*.261,.145,.877),(s*.215,.174,.838)], [.044,.047,.039,.032,.008],6)
        strand('Outer flowing wave '+str(s),[(s*.224,-.016,1.227),(s*.283,-.025,1.102),(s*.284,-.025,.992),(s*.323,-.014,.900),(s*.282,.006,.811),(s*.302,.017,.782)], [.051,.047,.045,.044,.031,.006])
    if not pink:
        # The purple accent is a single broad readable ribbon, with a rear echo.
        strand('Purple front streak', [(-.053,.164,1.356),(-.124,.206,1.291),(-.187,.196,1.191),(-.229,.142,1.109),(-.238,.130,1.037)], [.017,.020,.019,.015,.005],8,.26)
        strand('Purple rear streak',[(-.066,-.183,1.326),(-.096,-.233,1.163),(-.102,-.239,1.015),(-.092,-.236,.891),(-.112,-.202,.771)],[.019,.019,.018,.018,.005],8,.25)
    else:
        # A soft asymmetric cloth bow. Triangular folded loops retain the concept.
        C.prism('Bow left broad folded loop',[(.169,1.302),(.245,1.386),(.349,1.367),(.315,1.245),(.229,1.252)],.024,.055,8,'head',CLOTH,.023)
        C.prism('Bow upper broad folded loop',[(.169,1.302),(.099,1.383),(.135,1.453),(.200,1.405),(.223,1.345)],.019,.058,8,'head',CLOTH,.022)
        C.box('Bow soft centre knot',(.187,.058,1.332),(.073,.071,.085),8,'head',.021,3,CLOTH,rot=(0,-.48,0))
        C.curve('Bow folded seam A',[(.211,.059,1.33),(.252,.061,1.346),(.297,.061,1.349)],[.003,.005,.001],5,'head',CLOTH,n=5,steps=3)
        C.curve('Bow folded seam B',[(.171,.059,1.355),(.153,.061,1.397),(.149,.060,1.424)],[.002,.005,.001],5,'head',CLOTH,n=5,steps=3)

def face(pink):
    C.box('Rounded expressive head',(0,0,1.113),(.409,.294,.364),0,'head',.098,5,SKIN)
    for s in [-1,1]:
        C.ellipsoid('Ear '+str(s),(s*.205,-.002,1.082),(.042,.039,.066),0,'head',SKIN,n=12,r=6)
        C.ellipsoid('Inner ear '+str(s),(s*.222,.018,1.084),(.016,.017,.032),1,'head',SKIN,n=8,r=4)
        C.ellipsoid('Rosy cheek '+str(s),(s*.113,.145,1.062),(.029,.005,.014),14,'head',SKIN,n=12,r=6)
    C.ellipsoid('Small button nose',(0,.157,1.083),(.024,.022,.026),0,'head',SKIN,n=14,r=7)
    if pink:
        C.ellipsoid('Bright eye white',(-.073,.154,1.150),(.034,.012,.043),2,'head',EYE,n=14,r=7)
        C.ellipsoid('Warm smiling pupil',(-.066,.165,1.149),(.017,.007,.030),9,'head',EYE,n=12,r=6)
        C.ellipsoid('Eye highlight',(-.061,.172,1.164),(.007,.0025,.010),2,'head',EYE,n=8,r=4)
        C.curve('Playful wink',[(.042,.162,1.142),(.064,.167,1.155),(.083,.166,1.154),(.107,.158,1.139)],.0065,3,'head',EYE,n=7,steps=3)
        for i in range(3):
            x=.080+i*.011;z=1.152-i*.006
            C.curve('Wink lash '+str(i),[(x,.163,z),(x+.014,.163,z+.012)], [.0038,.0012],3,'head',EYE,n=5,steps=1)
        C.curve('Open eye lash',[(-.106,.161,1.171),(-.119,.161,1.183)],[.004,.001],3,'head',EYE,n=5,steps=1)
        C.prism('Open sunny smile',[(-.059,1.049),(-.029,1.039),(.014,1.039),(.057,1.055),(.046,1.010),(.021,.989),(-.006,.984),(-.034,1.004)],.153,.010,10,'head',EYE,.006)
        C.prism('Smile tooth',[(-.049,1.046),(-.025,1.038),(.018,1.039),(.046,1.049),(.038,1.035),(.005,1.028),(-.023,1.029),(-.045,1.035)],.161,.003,2,'head',EYE,.003)
        C.ellipsoid('Smile tongue',(.002,.162,1.003),(.025,.003,.014),11,'head',EYE,n=12,r=6)
        for s in [-1,1]:C.curve('Friendly brow '+str(s),[(s*.037,.150,1.219),(s*.065,.152,1.230),(s*.095,.147,1.221)],[.005,.007,.003],6,'head',HAIR,n=6,steps=3)
    else:
        for s in [-1,1]:
            C.ellipsoid('Skeptical eye white '+str(s),(s*.075,.154,1.139),(.035,.011,.035),2,'head',EYE,n=14,r=7)
            C.ellipsoid('Side eye pupil '+str(s),(s*.075-.008,.165,1.132),(.016,.006,.023),9,'head',EYE,n=12,r=6)
            C.ellipsoid('Eye glint '+str(s),(s*.075-.004,.170,1.143),(.005,.002,.007),2,'head',EYE,n=8,r=4)
            C.box('Heavy upper eyelid '+str(s),(s*.075,.160,1.162),(.086,.013,.032),0,'head',.010,2,SKIN,rot=(0,s*.12,0))
            C.curve('Dry upper eye line '+str(s),[(s*.035,.174,1.151+s*.006),(s*.075,.176,1.148),(s*.112,.163,1.151-s*.006)],.0055,3,'head',EYE,n=6,steps=2)
        C.curve('Raised doubtful brow',[(.029,.153,1.217),(.055,.155,1.226),(.095,.147,1.245)],[.006,.009,.004],3,'head',HAIR,n=6,steps=3)
        C.curve('Low doubtful brow',[(-.028,.153,1.213),(-.061,.154,1.207),(-.107,.143,1.223)],[.006,.009,.004],3,'head',HAIR,n=6,steps=3)
        C.curve('Tiny unimpressed frown',[(-.024,.158,1.029),(-.007,.166,1.039),(.010,.166,1.039),(.026,.158,1.029)],[.0025,.004,.004,.0025],10,'head',EYE,n=6,steps=3)

def shoes(label,s,pink):
    b='foot_'+label;x=s*.128
    C.box('Rubber outsole '+label,(x,.052,.025),(.217,.327,.050),13 if pink else 3,b,.023,3,RUBBER)
    C.box('White midsole '+label,(x,.052,.053),(.220,.329,.038),12,b,.019,3,RUBBER)
    C.box('Sculpted sneaker upper '+label,(x,.043,.119),(.198,.283,.113),4 if pink else 3,b,.039,3,CLOTH)
    C.rings('Sneaker ankle collar '+label,[super_ring(x,-.018,z,rx,ry,n=12) for z,rx,ry in [(.137,.081,.077),(.171,.086,.076),(.215,.086,.073)]],4 if pink else 3,b,CLOTH)
    C.box('Rounded sneaker toe '+label,(x,.151,.102),(.193,.124,.066),2 if pink else 3,b,.027,3,RUBBER)
    C.box('Padded sneaker tongue '+label,(x,.055,.167),(.111,.138,.026),5 if pink else 4,b,.019,2,CLOTH,rot=(.12,0,0))
    for i in range(3):
        y=.016+i*.040;z=.191-i*.007
        C.curve('Contrasting lace '+label+str(i),[(x-.047,y,z-.004),(x,y+.007,z),(x+.047,y,z-.004)],.0057,2 if pink else 8,b,CLOTH,n=6,steps=2)
    C.curve('Shoe outer accent '+label,[(x+s*.099,-.045,.110),(x+s*.103,.014,.091),(x+s*.102,.070,.114),(x+s*.093,.119,.123)],.008,8,b,CLOTH,n=6,steps=3)
    C.box('Heel panel '+label,(x,-.090,.124),(.128,.017,.063),13,b,.006,2,CLOTH)

def clothes(pink):
    torso=C.rings('Tailored jacket body' if pink else 'Soft hoodie body',[super_ring(0,0,z,rx,ry) for z,rx,ry in [(.591,.196,.116),(.626,.217,.128),(.76,.217,.124),(.88,.230,.124),(.949,.191,.101)]],4,'spine',CLOTH,weights=torso_weights)
    C.rings('Ribbed waist band',[super_ring(0,0,z,rx,ry) for z,rx,ry in [(.588,.204,.122),(.607,.210,.128),(.633,.214,.129)]],5 if pink else 4,'hips',CLOTH,weights=torso_weights)
    C.ellipsoid('Visible neck',(0,0,.979),(.082,.069,.083),0,'neck',SKIN,n=14,r=7)
    C.box('Soft trouser seat',(0,-.009,.552),(.403,.237,.194),4,'hips',.055,3,CLOTH)
    for label,s in SIDES.items():
        rings=[]
        for z,rx,ry in [(.605,.098,.105),(.549,.100,.113),(.455,.104,.115),(.397,.101,.113),(.355,.104,.113),(.306,.105,.110),(.242,.104,.109),(.190,.105,.111)]:
            rings.append(super_ring(s*.128,0,z,rx,ry,n=12,power=3.0))
        C.rings('Continuous cargo trouser leg '+label,rings,4,'thigh_'+label,CLOTH,weights=lambda p,l=label:leg_weights(l,p))
        C.rings('Rolled trouser hem '+label,[super_ring(s*.128,0,z,.113,.119,n=12) for z in (.190,.198,.224,.235)],5 if pink else 4,'shin_'+label,CLOTH)
        C.box('Cargo pocket '+label,(s*.220,.017,.416),(.030,.130,.137),5 if pink else 5,'thigh_'+label,.011,2,CLOTH)
        C.box('Cargo pocket flap '+label,(s*.237,.017,.465),(.014,.131,.041),4,'thigh_'+label,.008,2,CLOTH)
        C.ellipsoid('Pocket snap '+label,(s*.246,.020,.461),(.005,.009,.008),8 if pink else 15,'thigh_'+label,CLOTH,n=8,r=4)
        # The sleeve is one tube across shoulder and elbow, with continuous weights.
        pts=[(s*.217,0,.951),(s*.243,0,.907),(s*.285,0,.830),(s*.310,0,.780),(s*.322,0,.744),(s*.334,0,.704),(s*.358,0,.624),(s*.370,0,.566)]
        C.tube('Continuous attached sleeve '+label,pts,[.079,.092,.088,.081,.084,.081,.077,.069],2 if pink else 4,'upper_arm_'+label,CLOTH,n=12,weights=lambda p,side=s:arm_weights(side,p))
        cuffpts=[(s*.357,0,.619),(s*.364,0,.592),(s*.371,0,.564)]
        C.tube('Rib cuff '+label,cuffpts,[.080,.080,.075],5 if pink else 5,'forearm_'+label,CLOTH,n=12)
        if pink:
            C.tube('White cuff stripe '+label,[(s*.361,0,.604),(s*.364,0,.592)],[.081,.081],2,'forearm_'+label,CLOTH,n=12)
        C.ellipsoid('Connected mitt palm '+label,(s*.379,.002,.525),(.054,.042,.064),0,'hand_'+label,SKIN,n=14,r=7,rot=(0,s*-.13,0))
        C.ellipsoid('Rounded thumb '+label,(s*.338,.025,.535),(.028,.028,.036),0,'hand_'+label,SKIN,n=12,r=6,rot=(0,s*.35,0))
        C.contact('Continuous attached sleeve '+label,'Rib cuff '+label,'shared wrist chain and overlapping sleeve')
        C.contact('Rib cuff '+label,'Connected mitt palm '+label,'wrist centres coincide; visible overlap')
        C.contact('Continuous cargo trouser leg '+label,'Sneaker ankle collar '+label,'continuous hip-knee-ankle chain; hem encloses shoe collar')
        C.contact('Sneaker ankle collar '+label,'Sculpted sneaker upper '+label,'shoe collar embedded in sneaker upper')
        shoes(label,s,pink)
    if pink:
        C.box('Cream shirt opening',(0,.125,.789),(.127,.018,.265),2,'spine',.013,3,CLOTH,weights=torso_weights)
        for s in [-1,1]:
            C.box('Varsity front placket '+str(s),(s*.080,.144,.785),(.032,.022,.308),5,'spine',.009,2,CLOTH,weights=torso_weights)
            for z in (.656,.719,.856,.918):C.ellipsoid('Pearl jacket button '+str((s,z)),(s*.080,.160,z),(.009,.005,.010),2,'spine',RUBBER,n=8,r=4,weights=torso_weights)
            C.curve('White jacket pocket slash '+str(s),[(s*.138,.143,.688),(s*.179,.126,.727)],.007,2,'spine',CLOTH,n=6,steps=1,weights=torso_weights)
        C.curve('White collar piping',[(-.13,.090,.947),(-.074,.137,.928),(0,.154,.895),(.074,.137,.928),(.13,.09,.947)],.010,2,'spine',CLOTH,n=8,steps=2)
        for z in (.599,.618):C.tube('Varsity waistband stripe '+str(z),[(-.193,.060,z),(-.176,.112,z),(-.09,.132,z),(0,.136,z),(.09,.132,z),(.176,.112,z),(.193,.060,z)],.006,2,'hips',CLOTH,n=6,weights=torso_weights)
        symbol('White heart patch border',-.147,.143,.857,.042,2,'heart')
        symbol('Pink heart patch',-.147,.154,.857,.032,8,'heart')
    else:
        C.ellipse_loop('Hood padded opening',(0,-.029,.942),.155,.103,.037,4,'spine',CLOTH,n=28,tube_n=8)
        C.curve('Hood front V seam',[(-.158,.077,.948),(-.096,.123,.936),(0,.137,.899),(.096,.123,.936),(.158,.077,.948)],.012,5,'spine',CLOTH,n=8,steps=2)
        C.box('Kangaroo pocket',(0,.127,.692),(.273,.029,.086),4,'spine',.021,3,CLOTH,weights=torso_weights)
        for s in [-1,1]:
            C.curve('Pocket entry seam '+str(s),[(s*.079,.151,.732),(s*.117,.151,.680)],.004,5,'spine',CLOTH,n=5,steps=1,weights=torso_weights)
            C.curve('Hood drawstring '+str(s),[(s*.060,.134,.919),(s*.055,.151,.859),(s*.066,.153,.831)],.005,3,'spine',CLOTH,n=6,steps=3)
            C.box('Drawstring tip '+str(s),(s*.066,.153,.826),(.011,.011,.022),15,'spine',.004,2,CLOTH)
        symbol('Purple star badge',-.130,.145,.862,.042,8)

def construct(name):
    pink=name=='bestie-pink'
    C.setup(name,1.4,1.0,1.6,[('Warm toy skin',.59,0),('Woven clothing and ribbon',.76,0),('Sculpted hair',.40,0),('Expressive face details',.40,0),('Rubber and enamel trim',.66,0)])
    clothes(pink);face(pink);hair(pink)
    return pink
