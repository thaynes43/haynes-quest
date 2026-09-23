"""WO097. Original Rat Casino static prop construction; Blender 4.5 LTS.

Run through the exclusive Blender authoring scene. All public-safe deliverables
are written under OUT. No external asset, texture, font or decoder is used.
Blender +Y is the visible front, exported as glTF -Z. Units are meters.
"""
import bpy
import bmesh
import math
import json
import hashlib
import random
from pathlib import Path
from mathutils import Vector
from mathutils.geometry import tessellate_polygon

OUT = Path('/workspace/haynes-quest/rat-casino-kit/v001')
OUT.mkdir(parents=True, exist_ok=True)
random.seed(97)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for collection in list(bpy.data.collections):
    if collection.users == 0 or collection.name != 'Collection':
        bpy.data.collections.remove(collection)
for material in list(bpy.data.materials):
    bpy.data.materials.remove(material)
for store in (bpy.data.meshes,bpy.data.curves,bpy.data.cameras,bpy.data.lights):
    for block in list(store):
        if block.users==0:store.remove(block)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1.0
scene['work_order'] = 'WO097'
scene['scene_owner'] = 'rat_casino_blender'
scene['scene_lease'] = 'exclusive active authoring; see scene-release.json'

def linear_channel(c):
    c = c / 255
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4

def rgba(code):
    return tuple(linear_channel(int(code[i:i+2], 16)) for i in (0,2,4)) + (1,)

COLORS = {key: rgba(value) for key, value in {
    'wood':'30222C', 'plum':'572239', 'velvet':'733445', 'deep':'231821',
    'brass':'AC7D48', 'lightbrass':'CC9A5C', 'darkbrass':'755331',
    'teal':'49736E', 'red':'954350', 'cream':'BEA986', 'slotplum':'42162B',
    'amber':'FFD28C', 'black':'201F2A', 'warmwood':'4A2A36',
}.items()}

def material(name, roughness, metallic=0, emission=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    shader = nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    attr = nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'Tint'
    mat.node_tree.links.new(attr.outputs['Color'], shader.inputs['Base Color'])
    if emission:
        mat.node_tree.links.new(attr.outputs['Color'], shader.inputs['Emission Color'])
        shader.inputs['Emission Strength'].default_value = emission
    return mat

MATS = {
    'matte':material('Casino_matte_wood_and_velvet', .81),
    'brass':material('Casino_aged_brass', .46, .68),
    'bulb':material('Casino_warm_amber_bulbs', .33, .04, .8),
}
ACTIVE = None

def collection(name):
    global ACTIVE
    ACTIVE = bpy.data.collections.new(name)
    scene.collection.children.link(ACTIVE)
    return ACTIVE

def finish(obj, name, color, kind='matte', smooth=False, vary=0):
    obj.name = name
    for coll in list(obj.users_collection):
        coll.objects.unlink(obj)
    ACTIVE.objects.link(obj)
    obj.data.materials.clear()
    obj.data.materials.append(MATS[kind])
    attr = obj.data.color_attributes.new(name='Tint',type='FLOAT_COLOR',domain='CORNER')
    base = COLORS[color] if isinstance(color,str) else color
    for poly in obj.data.polygons:
        tint = 1 + random.uniform(-vary,vary)
        poly.use_smooth = smooth
        for loop in poly.loop_indices:
            attr.data[loop].color = tuple(min(1,c*tint) for c in base[:3])+(1,)
    obj['component'] = name
    return obj

def mesh(name, verts, faces, color, kind='matte', smooth=False, vary=0):
    data = bpy.data.meshes.new(name+'_mesh')
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name,data)
    ACTIVE.objects.link(obj)
    return finish(obj,name,color,kind,smooth,vary)

def box(name, loc, size, color, kind='matte', bevel=.02, segments=1):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod = obj.modifiers.new('Rounded crafted edge','BEVEL')
        mod.width = bevel
        mod.segments = segments
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(obj,name,color,kind,vary=.018)

def cylinder(name, loc, radius, depth, color, kind='matte', vertices=32, axis='Z'):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc)
    obj=bpy.context.object
    if axis=='Y': obj.rotation_euler.x=math.pi/2
    elif axis=='X': obj.rotation_euler.y=math.pi/2
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    return finish(obj,name,color,kind)

def sphere(name, loc, radius, color='amber', kind='bulb'):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=radius,location=loc)
    return finish(bpy.context.object,name,color,kind,smooth=True)

def extrude_xz(name, points, y, depth, color, kind='matte'):
    n=len(points)
    verts=[(x,y-depth/2,z) for x,z in points]+[(x,y+depth/2,z) for x,z in points]
    points3=[Vector((x,0,z)) for x,z in points]
    triangles=tessellate_polygon([points3])
    lookup={tuple(v):i for i,v in enumerate(points3)}
    faces=[]
    for tri in triangles:
        ids=[v if isinstance(v,int) else lookup[tuple(v)] for v in tri]
        faces.append(tuple(reversed(ids)))
        faces.append(tuple(i+n for i in ids))
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    obj=mesh(name,verts,faces,color,kind)
    # Consistent manifold outward normals, including concave glyph outlines.
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active=obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.select_set(False)
    return obj

def oval(name, center, rx, rz, depth, color, kind='matte', n=40):
    x,y,z=center
    points=[(x+rx*math.cos(i*math.tau/n),z+rz*math.sin(i*math.tau/n)) for i in range(n)]
    return extrude_xz(name,points,y,depth,color,kind)

def oval_ring(name, center, rx, rz, width, depth, color='brass', n=40):
    x,y,z=center
    verts=[]
    for yy,xx,zz in ((y-depth/2,rx,rz),(y+depth/2,rx,rz),
                     (y+depth/2,rx-width,rz-width),(y-depth/2,rx-width,rz-width)):
        verts += [(x+xx*math.cos(i*math.tau/n),yy,z+zz*math.sin(i*math.tau/n)) for i in range(n)]
    faces=[]
    for ring in range(4):
        for i in range(n):
            faces.append((ring*n+i,ring*n+(i+1)%n,((ring+1)%4)*n+(i+1)%n,((ring+1)%4)*n+i))
    return mesh(name,verts,faces,color,'brass')

def tube(name, points, radius, color, kind='brass', sides=6):
    verts=[]
    for i,p in enumerate(points):
        p=Vector(p)
        tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(i-1,0)])
        tangent.normalize()
        seed=Vector((0,0,1)) if abs(tangent.z)<.9 else Vector((0,1,0))
        a=tangent.cross(seed).normalized()
        b=tangent.cross(a).normalized()
        verts += [tuple(p+radius*(math.cos(j*math.tau/sides)*a+math.sin(j*math.tau/sides)*b)) for j in range(sides)]
    faces=[tuple(reversed(range(sides))),tuple((len(points)-1)*sides+j for j in range(sides))]
    for ring in range(len(points)-1):
        for j in range(sides):
            faces.append((ring*sides+j,ring*sides+(j+1)%sides,(ring+1)*sides+(j+1)%sides,(ring+1)*sides+j))
    return mesh(name,verts,faces,color,kind,smooth=True)

def torus(name, loc, radius, tube_radius, color, kind='matte', major=48, minor=6):
    bpy.ops.mesh.primitive_torus_add(major_segments=major,minor_segments=minor,
        location=loc,major_radius=radius,minor_radius=tube_radius)
    return finish(bpy.context.object,name,color,kind,smooth=True)

def star(name, center, outer, inner, color='brass', points=5, depth=.02):
    x,y,z=center
    polygon=[]
    for i in range(points*2):
        angle=math.pi/2+i*math.pi/points
        r=outer if i%2==0 else inner
        polygon.append((x+r*math.cos(angle),z+r*math.sin(angle)))
    return extrude_xz(name,polygon,y,depth,color,'brass')

def drape(name, sign):
    nx,nz=12,6
    verts=[]
    for back in (0,1):
        for k in range(nz+1):
            t=k/nz
            z=.27+2.38*t
            center=2.25+.055*math.sin(math.pi*t)
            width=.24+.10*abs(t-.5)*2
            for j in range(nx+1):
                u=j/nx
                x=sign*(center+width*(u-.5))
                y=.51+.025*math.cos(u*math.tau*3)+.012*math.sin(t*math.pi)-back*.025
                verts.append((x,y,z))
    layer=(nx+1)*(nz+1)
    faces=[]
    for k in range(nz):
        for j in range(nx):
            a=k*(nx+1)+j
            faces.append((a,a+1,a+nx+2,a+nx+1))
            faces.append((a+layer,a+nx+1+layer,a+nx+2+layer,a+1+layer))
    boundary=list(range(nx+1))+[k*(nx+1)+nx for k in range(1,nz+1)]+list(range(nz*(nx+1)+nx-1,nz*(nx+1)-1,-1))+[k*(nx+1) for k in range(nz-1,0,-1)]
    faces += [(boundary[i],boundary[(i+1)%len(boundary)],boundary[(i+1)%len(boundary)]+layer,boundary[i]+layer) for i in range(len(boundary))]
    return mesh(name,verts,faces,'plum',smooth=True)

def swag(name,x1,x2):
    n=12
    verts=[]
    for i in range(n+1):
        t=i/n
        x=x1+(x2-x1)*t
        bottom=2.64+.16*(2*t-1)**2
        verts += [(x,.245,2.87),(x,.28+.02*math.sin(t*math.tau*3),bottom)]
    faces=[(i*2,i*2+1,i*2+3,i*2+2) for i in range(n)]
    obj=mesh(name,verts,faces,'velvet',smooth=True)
    mod=obj.modifiers.new('Cloth thickness','SOLIDIFY');mod.thickness=.035
    bpy.context.view_layer.objects.active=obj;obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name);obj.select_set(False)
    # Gold piping defines the lower edge without hanging into the passage.
    tube(name+'_brass_piping',[(x1+(x2-x1)*i/n,.313,2.64+.16*(2*i/n-1)**2) for i in range(n+1)],.014,'brass',sides=4)

# Entrance marquee: the passage remains empty through x +/-2.05, z 0..2.60.
collection('marquee-arch')
for sign in (-1,1):
    tag='left' if sign<0 else 'right'
    x=sign*2.55
    box(tag+'_aged_wood_column',(x,0,1.48),(.70,.64,2.63),'wood',bevel=.035)
    box(tag+'_stepped_plinth',(x,0,.12),(.94,.94,.24),'darkbrass','brass',.025)
    box(tag+'_plinth_upper',(x,0,.28),(.84,.82,.12),'brass','brass',.02)
    box(tag+'_capital',(x,0,2.69),(.89,.85,.16),'brass','brass',.02)
    for off in (-.23,.23):
        box(tag+'_front_fluting_'+str(off),(x+off,.36,1.47),(.085,.08,2.20),'brass','brass',.012)
    box(tag+'_inset_banner',(x,.354,1.56),(.30,.035,1.38),'deep',bevel=.008)
    # An invented narrow diamond crest, with abstract little ear discs.
    extrude_xz(tag+'_banner_kite',[(x,1.83),(x+.10,1.58),(x,1.43),(x-.10,1.58)],.39,.017,'lightbrass','brass')
    for ear in (-1,1): oval(tag+'_banner_ear_'+str(ear),(x+ear*.082,.39,1.82),.052,.057,.015,'lightbrass','brass',12)
    for z in (.60,.98,2.22):
        cylinder(tag+'_bulb_socket_'+str(z),(x,.402,z),.071,.035,'darkbrass','brass',12,'Y')
        sphere(tag+'_amber_bulb_'+str(z),(x,.442,z),.044)
    drape(tag+'_gathered_velvet',sign)
    tube(tag+'_drape_tie',[(sign*2.18,.545,1.17),(sign*2.30,.577,1.12),(sign*2.44,.545,1.19)],.021,'lightbrass',sides=6)
    # Deco fan stays above the lintel and within the column silhouette.
    for i,(dx,h) in enumerate(((-.21,.26),(0,.42),(.21,.26))):
        xx=x+dx
        extrude_xz(tag+'_capital_fan_'+str(i),[(xx-.065,2.73),(xx-.035,2.73+h),(xx+.03,2.73+h+.04),(xx+.065,2.73)],.04,.15,'brass','brass')
box('rear_lintel',(0,-.03,2.785),(5.10,.48,.28),'wood',bevel=.035)
box('lintel_brass_lower',(0,.19,2.655),(4.48,.08,.04),'brass','brass',.008)
swag('left_short_header_drape',-2.32,-.55)
swag('right_short_header_drape',.55,2.32)
for sign in (-1,1):
    oval('crown_ear_back_'+str(sign),(sign*.93,.08,3.285),.395,.34,.20,'plum',n=28)
    oval_ring('crown_ear_rim_'+str(sign),(sign*.93,.20,3.285),.41,.355,.055,.07,n=24)
    for j in range(3):
        tube('whisker_'+str(sign)+'_'+str(j),[(sign*1.52,.13,3.03+(j-1)*.12),(sign*1.84,.13,3.07+(j-1)*.17),(sign*2.11,.13,3.08+(j-1)*.21)],.019,'brass',sides=5)
        sphere('whisker_tip_'+str(sign)+'_'+str(j),(sign*2.11,.13,3.08+(j-1)*.21),.024,'brass','brass')
oval('blank_oval_plaque',(0,.29,3.04),1.55,.365,.19,'warmwood',n=40)
oval_ring('marquee_main_brass_bezel',(0,.405,3.04),1.66,.43,.095,.075,n=48)
oval_ring('marquee_inner_fine_lip',(0,.45,3.04),1.565,.372,.020,.025,'lightbrass',40)
for i in range(26):
    angle=i*math.tau/26
    sphere('marquee_amber_bulb_%02d'%i,(1.611*math.cos(angle),.474,3.04+.394*math.sin(angle)),.038)
for i,(x,h) in enumerate(((-.20,.25),(0,.40),(.20,.25))):
    extrude_xz('crown_deco_blade_'+str(i),[(x-.06,3.25),(x-.035,3.25+h),(x,3.29+h),(x+.035,3.25+h),(x+.06,3.25)],.09,.14,'lightbrass','brass')
star('crown_small_diamond',(0,.24,3.39),.098,.045,points=4,depth=.05)

# Roulette dais: a stable broad top, with a shallow horizontal star mechanism.
collection('roulette-dais')
cylinder('low_round_plinth',(0,0,.08),1.69,.16,'darkbrass','brass',48)
cylinder('velvet_drum',(0,0,.245),1.66,.25,'plum',vertices=48)
cylinder('upper_brass_lip',(0,0,.365),1.705,.09,'brass','brass',64)
cylinder('flat_top_substrate',(0,0,.401),1.585,.026,'deep',vertices=48)
segments=16
for i in range(segments):
    a0=i*math.tau/segments+.005
    a1=(i+1)*math.tau/segments-.005
    angles=[a0+(a1-a0)*j/4 for j in range(5)]
    verts=[(.30*math.cos(a),.30*math.sin(a),.418) for a in angles]
    verts += [(1.53*math.cos(a),1.53*math.sin(a),.418) for a in angles]
    faces=[(j,j+5,j+6,j+1) for j in range(4)]
    mesh('broad_colored_wedge_%02d'%i,verts,faces,['red','teal','wood','red'][i%4])
torus('rounded_velvet_bumper',(0,0,.425),1.645,.100,'plum',major=64,minor=8)
torus('top_inlaid_brass_circle',(0,0,.423),1.527,.014,'brass','brass',major=48,minor=4)
for i in range(16):
    a=i*math.tau/16
    normal=Vector((math.sin(a),math.cos(a),0))
    pos=normal*1.679+Vector((0,0,.255))
    socket=cylinder('rim_bulb_socket_%02d'%i,pos,.069,.027,'darkbrass','brass',12,'Y')
    socket.rotation_euler.z=-a
    sphere('rim_amber_bulb_%02d'%i,pos+normal*.036,.043)
    for sign in (-1,1):
        aa=a+sign*.13
        p=(1.671*math.sin(aa),1.671*math.cos(aa),.25)
        trim=box('rim_panel_rail_%02d_%s'%(i,sign),p,(.021,.026,.185),'brass','brass',0)
        trim.rotation_euler.z=-aa
    # Raised inverted diamond provides sparse, readable art-deco decoration.
    a2=a+math.pi/16
    center=(1.675*math.sin(a2),1.675*math.cos(a2),.23)
    crest=star('rim_diamond_%02d'%i,(0,0,0),.077,.025,points=4,depth=.018)
    crest.location=center;crest.rotation_euler.z=-a2
cylinder('star_mechanism_foot',(0,0,.442),.31,.07,'brass','brass',24)
cylinder('star_mechanism_dark_inset',(0,0,.484),.257,.024,'deep',vertices=24)
torus('horizontal_astrolabe_ring',(0,0,.502),.365,.018,'brass','brass',major=40,minor=5)
star_obj=star('shallow_horizontal_star',(0,0,0),.281,.106,'lightbrass',points=8,depth=.04)
star_obj.rotation_euler.x=math.pi/2;star_obj.location.z=.517
sphere('star_pivot',(0,0,.525),.037,'lightbrass','brass')

# Slot cabinet: built from an original side profile, with sculpted reel symbols.
collection('slot-cabinet')
profile=[(-.385,.11),(.397,.11),(.397,.60),(.340,.70),(.126,1.52),(.061,1.70),(-.29,1.70),(-.385,1.53)]
verts=[(x,y,z) for x in (-.419,.419) for y,z in profile]
n=len(profile)
faces=[tuple(reversed(range(n))),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
mesh('sculpted_wood_cabinet',verts,faces,'wood')
box('low_brass_base',(0,.006,.08),(.92,.872,.16),'darkbrass','brass',.025)
for x in (-.31,.31):
    for y in (-.25,.28):box('stub_foot_'+str(x)+'_'+str(y),(x,y,.036),(.13,.16,.072),'wood',bevel=.012)
box('front_lower_velvet_panel',(0,.41,.387),(.724,.038,.43),'slotplum',bevel=.014)
for x in (-.386,.386):
    box('front_corner_brass_'+str(x),(x,.424,.403),(.064,.072,.44),'brass','brass',.015)
    tube('sloped_reel_side_'+str(x),[(x,.442,.619),(x,.352,.751),(x,.153,1.515),(x,.082,1.675)],.037,'brass',sides=8)
    box('rear_upright_trim_'+str(x),(x,-.355,.86),(.043,.061,1.45),'brass','brass',.008)
for sign in (-1,1):
    x=sign*.424
    # Contrasting inset side panel and a single deco kite, no tiny ornament noise.
    points=[(-.301,.24),(.27,.24),(.271,.56),(.22,.65),(.047,1.34),(-.04,1.56),(-.30,1.56)]
    side=mesh('side_velvet_inset_'+str(sign),[(x,y,z) for y,z in points],[tuple(range(len(points)))],'slotplum')
    # Side rays are narrow wooden/brass strips and remain robust at phone scale.
    for k in range(3):
        tube('side_fan_'+str(sign)+'_'+str(k),[(x+sign*.01,-.025,.49),(x+sign*.01,-.17+k*.16,.88),(x+sign*.01,-.17+k*.16,1.19)],.012,'darkbrass',sides=4)
box('reel_header_brass',(0,.168,1.523),(.77,.115,.11),'brass','brass',.024)
box('reel_header_wood',(0,.127,1.624),(.80,.20,.145),'warmwood',bevel=.030)
for x in (-.274,.274):
    sphere('header_amber_bulb_'+str(x),(x,.245,1.628),.040)
box('sloped_console_lip',(0,.435,.664),(.78,.22,.09),'brass','brass',.015)
box('dark_console_insert',(0,.469,.713),(.61,.118,.024),'deep',bevel=.006)
for x,color in ((-.22,'red'),(.22,'teal')):
    cylinder('invented_console_button_'+str(x),(x,.481,.73),.046,.019,color,vertices=16)

def reel_y(z): return .43-(z-.65)*.31
for index,x in enumerate((-.231,0,.231)):
    zmin,zmax=.807,1.434
    verts=[]
    for i in range(13):
        t=i/12;z=zmin+(zmax-zmin)*t
        y=reel_y(z)+.021*math.sin(t*math.pi)
        verts += [(x-.098,y,z),(x+.098,y,z)]
    mesh('cream_curved_reel_'+str(index),verts,[(2*i+2,2*i+3,2*i+1,2*i) for i in range(12)],'cream',smooth=True)
    for side in (-1,1):
        tube('reel_separator_'+str(index)+'_'+str(side),[(x+side*.105,reel_y(zmin)+.013,zmin),(x+side*.105,reel_y(zmax)+.013,zmax)],.012,'darkbrass',sides=4)
    # Partial repeat marks above and below reinforce three independent reels.
    for z in (.866,1.375):
        star('small_reel_mark_'+str(index)+'_'+str(z),(x,reel_y(z)+.027,z),.029,.012,'darkbrass',points=4,depth=.008)
glyph_y=reel_y(1.12)+.051
moon=[(.040,.092),(-.004,.088),(-.054,.056),(-.075,.008),(-.064,-.044),(-.033,-.082),(.014,-.096),(.059,-.083),(.081,-.053),(.035,-.061),(-.006,-.044),(-.025,-.012),(-.018,.028),(.007,.062)]
extrude_xz('reel_moon',[(x-.231,z+1.12) for x,z in moon],glyph_y,.012,'red')
star('reel_star',(0,glyph_y,1.12),.093,.042,'lightbrass',points=5,depth=.013)
bat=[(-1,.25),(-.88,.79),(-.58,.46),(-.27,.34),(-.16,.73),(-.08,.48),(.08,.48),(.16,.73),(.27,.34),(.58,.46),(.88,.79),(1,.25),(.71,.10),(.49,-.15),(.25,-.06),(.10,-.60),(0,-.85),(-.10,-.60),(-.25,-.06),(-.49,-.15),(-.71,.10)]
extrude_xz('reel_bat',[(.231+x*.086,1.118+z*.081) for x,z in bat],glyph_y,.012,'black')
for z in (.775,1.461):
    tube('reel_cross_beam_'+str(z),[(-.344,reel_y(z)+.018,z),(.344,reel_y(z)+.018,z)],.025,'brass',sides=6)
for sign in (-1,1):
    oval('slot_ear_inset_'+str(sign),(sign*.197,.027,1.946),.150,.177,.111,'slotplum',n=24)
    oval_ring('slot_ear_brass_'+str(sign),(sign*.197,.098,1.946),.163,.188,.027,.052,n=24)
    for i in range(3):
        tube('slot_whisker_'+str(sign)+'_'+str(i),[(sign*.195,.154,1.797+(i-1)*.025),(sign*.333,.149,1.801+(i-1)*.060),(sign*.434,.147,1.80+(i-1)*.091)],.010,'brass',sides=4)
oval('slot_round_marquee',(0,.091,1.828),.234,.236,.133,'wood',n=32)
oval_ring('slot_round_bezel',(0,.179,1.828),.250,.251,.041,.042,n=32)
for i in range(10):
    a=i*math.tau/10
    sphere('slot_round_amber_bulb_%02d'%i,(.232*math.cos(a),.218,1.828+.232*math.sin(a)),.022)
extrude_xz('marquee_moon',[(x*1.18,z*1.18+1.828) for x,z in moon],.194,.018,'amber','bulb')
star('slot_lower_kite',(0,.244,1.57),.105,.048,'brass',points=4,depth=.035)
for i in (-2,-1,0,1,2):
    tube('chest_deco_fan_'+str(i),[(0,.438,.231),(i*.070,.438,.402),(i*.091,.438,.544)],.012,'brass',sides=4)
star('chest_diamond',(0,.462,.47),.070,.030,'brass',points=4,depth=.018)
# The payout-like tray remains an abstract empty recess with no coins or labels.
box('tray_dark_recess',(0,.456,.206),(.38,.055,.16),'deep',bevel=.010)
box('tray_lower_lip',(0,.551,.140),(.45,.24,.045),'brass','brass',.013)
for x in (-.209,.209):
    extrude_xz('tray_cheek_'+str(x),[(x-.016,.144),(x-.016,.267),(x+.016,.267),(x+.016,.144)],.529,.22,'brass','brass')
lever_x=.506
cylinder('lever_pivot',(lever_x,.032,.815),.074,.084,'brass','brass',20,'X')
tube('robust_lever',[(lever_x,.032,.815),(lever_x,.067,1.088),(lever_x,.031,1.397)],.025,'brass',sides=8)
sphere('plum_lever_knob',(lever_x,.031,1.42),.075,'plum','matte')

ASSETS=('marquee-arch','roulette-dais','slot-cabinet')

def bounds(objects):
    vertices=[obj.matrix_world@v.co for obj in objects if obj.type=='MESH' for v in obj.data.vertices]
    lo=[min(v[i] for v in vertices) for i in range(3)]
    hi=[max(v[i] for v in vertices) for i in range(3)]
    return {'min':lo,'max':hi,'size':[hi[i]-lo[i] for i in range(3)]}

report={'workOrder':'WO097','blenderVersion':bpy.app.version_string,
        'units':'meters','authoringUp':'+Z','authoringForward':'+Y',
        'exportUp':'+Y','exportForward':'-Z','origin':'floor-centered bounds',
        'props':{}}
for name in ASSETS:
    coll=bpy.data.collections[name]
    for obj in coll.objects:
        bm=bmesh.new();bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        bm.to_mesh(obj.data);bm.free()
    bpy.context.view_layer.update()
    before=bounds(coll.objects)
    shift=Vector((-(before['min'][0]+before['max'][0])/2,
                  -(before['min'][1]+before['max'][1])/2,-before['min'][2]))
    for obj in coll.objects:obj.location+=shift
    bpy.context.view_layer.update()
    after=bounds(coll.objects)
    triangles=0
    for obj in coll.objects:
        obj.data.calc_loop_triangles();triangles+=len(obj.data.loop_triangles)
    report['props'][name]={
        'authoringBoundsZUp':after,'sourceObjects':len(coll.objects),'triangles':triangles,
        'materials':sorted(set(m.name for obj in coll.objects for m in obj.data.materials)),
        'floorCenterShift':list(shift),'static':True,'textures':0,
    }
    if name=='marquee-arch':
        # Conservative triangle AABB test of the requested empty walkway box.
        overlaps=[]
        for obj in coll.objects:
            for triangle in obj.data.loop_triangles:
                vs=[obj.matrix_world@obj.data.vertices[i].co for i in triangle.vertices]
                if min(v.x for v in vs)<2.05 and max(v.x for v in vs)>-2.05 and min(v.z for v in vs)<2.60 and max(v.z for v in vs)>0.001:
                    overlaps.append(obj.name);break
        report['props'][name]['walkway']={'clearWidthMeters':4.10,'clearHeightMeters':2.60,
            'depth':'full asset depth','triangleAabbOverlapCount':len(overlaps),'overlaps':overlaps}
        assert not overlaps, ('Walkway obstructed',overlaps)
    bpy.ops.object.select_all(action='DESELECT')
    copies=[]
    for obj in list(coll.objects):
        duplicate=obj.copy();duplicate.data=obj.data.copy()
        scene.collection.objects.link(duplicate)
        duplicate.select_set(True);copies.append(duplicate)
    bpy.context.view_layer.objects.active=copies[0]
    bpy.ops.object.join()
    joined=bpy.context.object
    joined.name=name
    joined.data.name=name+'_export_mesh'
    scene.cursor.location=(0,0,0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    joined['asset_id']='rat-casino-'+name
    joined['version']='v001'
    joined['review_status']='studio candidate; owner review pending'
    joined['front']='glTF -Z'
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',
        use_selection=True,export_yup=True,export_apply=True,export_texcoords=False,
        export_normals=True,export_materials='EXPORT',export_vertex_color='MATERIAL',
        export_all_vertex_colors=False,
        export_animations=False,export_cameras=False,export_lights=False,
        export_extras=True,export_keep_originals=False)
    glb=OUT/(name+'.glb')
    report['props'][name]['bytes']=glb.stat().st_size
    report['props'][name]['sha256']=hashlib.sha256(glb.read_bytes()).hexdigest()
    bpy.data.objects.remove(joined,do_unlink=True)
    assert triangles<=5000,(name,triangles)
    assert len(report['props'][name]['materials'])<=4
    assert glb.stat().st_size<=1572864
assert report['props']['roulette-dais']['authoringBoundsZUp']['size'][2]<=.6
(OUT/'construction-measurements.json').write_text(json.dumps(report,indent=2)+'\n')

# Review-only stage, excluded from every GLB.
collection('review-stage')
floor_mat=bpy.data.materials.new('Review_backdrop_charcoal')
floor_mat.use_nodes=True
shader=floor_mat.node_tree.nodes.get('Principled BSDF')
shader.inputs['Base Color'].default_value=(.033,.027,.042,1)
shader.inputs['Roughness'].default_value=.92
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.016))
floor=bpy.context.object;floor.name='Review_only_ground'
for coll in list(floor.users_collection):coll.objects.unlink(floor)
ACTIVE.objects.link(floor);floor.data.materials.append(floor_mat)
world=bpy.data.worlds.new('Casino_review_world')
scene.world=world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(.13,.16,.22,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.28
def area(name,location,power,color,size,target=(0,0,1.2)):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);ACTIVE.objects.link(obj);obj.location=location
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
area('Review_warm_key',(-4,6,8),1000,(1,.78,.54),6)
area('Review_cool_fill',(5,2,5),650,(.57,.72,1),5)
area('Review_rear_rim',(1,-4,7),1200,(1,.60,.30),5)
data=bpy.data.cameras.new('Review_camera');camera=bpy.data.objects.new('Review_camera',data)
ACTIVE.objects.link(camera);scene.camera=camera;data.type='ORTHO';data.lens=55
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=32
scene.cycles.use_denoising=True
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGB'
scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
scene.view_settings.exposure=0
for name in ASSETS:
    bpy.data.collections[name].hide_render=name!='marquee-arch'
    bpy.data.collections[name].hide_viewport=name!='marquee-arch'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'rat-casino-kit.blend'))
print(json.dumps(report,indent=2))
