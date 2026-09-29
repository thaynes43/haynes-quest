"""Rooftop City v001 original painted construction design, shared by sheet and master.

Reference-stage geometry is editable component geometry. Production joining, normals,
vertex colors and exact GLB export happen only after coordinator sheet approval.
"""
from common import *

BOXES={'water-tower':(1.4,5,1.4),'rooftop-ac-unit':(.9,1.1,.7),
       'crane-hook':(.5,1.6,.5),'billboard-frame':(2.5,4,.25)}

def water_tower():
    begin('water-tower')
    # Open trestle, leg bottoms aligned to the floor. No broad lower plinth.
    for x in (-.86,.86):
        for y in (-.86,.86):
            box('Splayed steel shoe',(x,y,.07),(.36,.36,.14),'ink',.02)
            beam('Timber leg',(x,y,.12),(x*.84,y*.84,2.32),.19,'wood3',bevel=.016)
    for y in (-.83,.83):
        beam('Lower front tie',(-.82,y,.72),(.82,y,.72),.11,'steel')
        beam('Open diagonal brace',(-.81,y,.78),(.71,y*.86,2.1),.10,'steel',bevel=.008)
    for x in (-.8,.8):
        beam('Side diagonal brace',(x,-.80,.74),(x*.86,.71,2.10),.10,'steel',bevel=.008)
    box('Tank bearer',(0,0,2.27),(2.3,2.3,.19),'steel',.025)
    cyl('Closed wooden tank',(0,0,3.31),1.065,1.90,'wood',32,r2=1.135)
    # Alternating broad staves imply timber without thin dark line noise.
    for i in range(24):
        th=math.tau*i/24;half=math.pi/24-.004
        v=[(r*math.sin(a),r*math.cos(a),z) for r,z in [(1.07,2.36),(1.115,2.36),(1.185,4.26),(1.14,4.26)] for a in (th-half,th+half)]
        mesh('Coopered stave %02d'%i,v,[(0,1,3,2),(2,3,5,4),(4,5,7,6),(6,7,1,0),(0,2,4,6),(1,7,5,3)],['wood','wood2','wood','wood3'][i%4])
    for z,rr in [(2.44,1.117),(3.34,1.145),(4.18,1.185)]:
        # Flat metal hoops are a cylindrical side wall with narrow raised edge.
        ring('Tank hoop',(0,0,z),rr,.047,'steel',32,4)
    cyl('Roof eave',(0,0,4.32),1.30,.12,'ink',32)
    cyl('Shallow conical roof',(0,0,4.565),1.28,.43,'steel',32,r2=.12)
    cyl('Roof cap',(0,0,4.835),.15,.12,'honey',16,r2=.055)
    # Ladder sits on the rear; paired rail silhouette stays inside the box.
    for x in (-.27,.27):rod('Rear ladder rail',(x,1.24,.25),(x,1.24,4.26),.035,'ink')
    for z in [0.42+i*.31 for i in range(13)]:rod('Rear ladder rung',(-.28,1.24,z),(.28,1.24,z),.024,'light')
    # Small original service plaque, no borrowed logo or lettering.
    box('Tank service plaque',(0,-1.18,3.35),(.5,.07,.34),'honey',.055,2)
    box('Service stripe',(0,-1.224,3.35),(.24,.013,.065),'cream',.006)

def ac_unit():
    begin('rooftop-ac-unit')
    for x in (-.59,.59):box('Foot skid',(x,0,.065),(.17,1.25,.13),'ink',.025)
    box('AC housing',(0,0,.51),(1.72,1.24,.80),'light',.055,2)
    box('Blue service cap',(0,0,.96),(1.78,1.32,.14),'steel',.035,2)
    box('Front recessed fan grille',(0,-.631,.52),(1.54,.026,.59),'ink',.022)
    for x in (-.405,.405):
        ring('Fan rim',(x,-.655,.54),.245,.025,'steel',28,4,(math.pi/2,0,0))
        for angle in [i*math.tau/5 for i in range(5)]:
            pts=[(-.045,.055),(.04,.06),(.14,.16),(.045,.215),(-.045,.12)]
            transformed=[(x+u*math.cos(angle)-v*math.sin(angle),.54+u*math.sin(angle)+v*math.cos(angle)) for u,v in pts]
            slab('Five-blade fan',transformed,.028,'light',y=-.66)
        cyl('Fan hub',(x,-.69,.54),.064,.05,'steel',16,rotation=(math.pi/2,0,0))
        # Grille spokes are thick enough to read without moire.
        for angle in (0,math.pi/2):
            rod('Fan guard',(x-.233*math.cos(angle),-.719,.54-.233*math.sin(angle)),
                (x+.233*math.cos(angle),-.719,.54+.233*math.sin(angle)),.016,'ink',8)
    for y in (-.39,-.20,-.01,.18,.37):
        box('Side vent dark recess',(.866,y,.51),(.015,.095,.41),'ink',.01)
    box('Service door',(-.867,0,.51),(.018,.68,.45),'steel',.016)
    box('Small caution plaque',(0,-.651,.19),(.25,.023,.085),'honey',.014)

def crane_hook():
    begin('crane-hook')
    # A freestanding export of hanging tackle. The A3 crane wall mounts it.
    ring('Top shackle',(0,0,1.434),.115,.044,'ink',24,6,(math.pi/2,0,0))
    box('Pulley core',(0,0,1.06),(.44,.42,.43),'ink',.055,2)
    for y in (-.255,.255):
        slab('Ochre pulley cheek',[(-.33,.86),(.33,.86),(.38,1.22),(.24,1.34),(-.24,1.34),(-.38,1.22)],.07,'honey',y,.022)
    cyl('Pulley axle',(0,-.315,1.10),.085,.048,'steel',16,rotation=(math.pi/2,0,0))
    for x in (-.20,.20):
        # Hazard slashes are wholly inset into the cheek silhouette.
        slab('Inset safety slash',[(x-.055,.90),(x+.012,.90),(x+.105,1.24),(x+.04,1.24)],.007,'black',-.295)
    cyl('Swivel stem',(0,0,.73),.09,.24,'steel',16)
    # J hook is modelled, with its open throat toward +X. Bottom touches zero.
    points=[(0,0,.69),(0,0,.56),(-.135,0,.40),(-.175,0,.26),(-.12,0,.15),(.02,0,.12),(.19,0,.19),(.245,0,.31),(.23,0,.40)]
    radii=[.09,.095,.11,.115,.12,.12,.105,.075,.035]
    sweep('Rounded forged J hook',points,radii,'steel',10)
    rod('Safety latch',(.003,-.003,.53),(.231,-.003,.385),.025,'light',8)

def billboard():
    begin('billboard-frame')
    # An empty original frame, not an opaque advertising panel. Sightlines
    # remain open behind the avatar and across the published combat arenas.
    for x in (-1.67,1.67):
        box('Billboard foot',(x,0,.075),(.60,.48,.15),'ink',.018)
        beam('Vertical support',(x,0,.14),(x,0,3.74),.17,'steel',depth=.20)
        beam('Support knee',(x,0,.90),(x+(-.48 if x>0 else .48),0,1.48),.115,'steel')
    for x in (-2.36,2.36):box('Outer side rail',(x,0,2.64),(.16,.25,2.64),'ink',.022)
    for z in (1.34,3.91):box('Outer horizontal rail',(0,0,z),(4.88,.25,.16),'ink',.022)
    # Painted lip is narrow, does not fill the centre, and reads from front.
    for x in (-2.35,2.35):box('Faded mauve edge',(x,-.143,2.65),(.055,.028,2.45),'mauve',.008)
    for z in (1.34,3.90):box('Faded mauve edge',(0,-.143,z),(4.73,.028,.052),'mauve',.008)
    # Five broad amber practical lights; no emission and no transparent pixels.
    for x in (-1.85,-.93,0,.93,1.85):
        box('Lamp bracket',(x,-.17,3.72),(.18,.08,.22),'steel',.018)
        box('Warm glass lamp',(x,-.217,3.72),(.12,.035,.12),'cream',.02,2)
    for x in (-2.34,2.34):
        for z in (1.37,3.88):cyl('Corner bolt',(x,-.155,z),.052,.024,'honey',12,rotation=(math.pi/2,0,0))

BUILDERS={'water-tower':water_tower,'rooftop-ac-unit':ac_unit,'crane-hook':crane_hook,'billboard-frame':billboard}
