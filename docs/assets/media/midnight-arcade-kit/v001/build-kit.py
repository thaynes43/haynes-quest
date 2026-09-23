"""WO095: original midnight arcade kit, editable Blender 4.5 source.

Run in Blender's Python console with exec(compile(open(path).read(), path, 'exec')).
Authoring frame: meters, Z up, front -Y. GLB export: Y up, front +Z.
The scene and exports are review candidates; there are no gameplay bindings.
"""
import bpy
import bmesh
import math
import json
import random
from pathlib import Path
from mathutils import Vector

OUT = Path('/workspace/haynes-quest/midnight-arcade-kit/v001')
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials,
                   bpy.data.cameras, bpy.data.lights):
    for block in list(datablocks):
        if block.users == 0:
            datablocks.remove(block)
for collection in list(bpy.data.collections):
    if collection.name != 'Collection':
        bpy.data.collections.remove(collection)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1.0
random.seed(95)

def linear(v):
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4

def rgb(value):
    return tuple(linear(int(value[k:k+2], 16) / 255) for k in (0, 2, 4))

PALETTE = {
    'wood': rgb('75503b'), 'woodLight': rgb('936748'),
    'woodDark': rgb('48362e'), 'stone': rgb('b7a38a'),
    'stoneLight': rgb('d0bfa2'), 'plum': rgb('57416c'),
    'plumLight': rgb('755489'), 'plumDark': rgb('30263d'),
    'cherry': rgb('b83e56'), 'cherryShade': rgb('91364c'),
    'honey': rgb('d4a255'), 'honeyLight': rgb('f2cb79'),
    'night': rgb('69517f'), 'ink': rgb('272732'),
}

def material(name, roughness, metallic=0.0, emission=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    shader = m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Specular IOR Level'].default_value = .28
    color = m.node_tree.nodes.new('ShaderNodeVertexColor')
    color.layer_name = 'Color'
    m.node_tree.links.new(color.outputs['Color'], shader.inputs['Base Color'])
    if emission:
        m.node_tree.links.new(color.outputs['Color'], shader.inputs['Emission Color'])
        shader.inputs['Emission Strength'].default_value = emission
    return m

MAT = material('Craft_Matte', .84)
TRIM = material('Warm_Satin', .47, .22)
GLOW = material('Honey_Glow', .62, 0.0, .65)
COLLECTIONS = {}
PARTS = {}
ACTIVE = None

def asset(name):
    global ACTIVE
    ACTIVE = name
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    COLLECTIONS[name] = c
    PARTS[name] = []

def finish(obj, name, color, mat=MAT, bevel=0, segments=1, smooth=False):
    obj.name = name
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new('Soft crafted edges', 'BEVEL')
        mod.width = bevel
        mod.segments = segments
        mod.affect = 'EDGES'
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    colors = obj.data.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
    obj.data.color_attributes.active_color = colors
    base = PALETTE[color] if isinstance(color, str) else color
    variation = random.uniform(.96, 1.035)
    for polygon in obj.data.polygons:
        # Broad color planes, no texture dependency or tiny surface noise.
        shade = variation * random.uniform(.985, 1.015)
        for loop in polygon.loop_indices:
            colors.data[loop].color = (*[min(1, x * shade) for x in base], 1)
        polygon.use_smooth = smooth
    if smooth and bevel:
        mod = obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
        mod.weight = 50
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    COLLECTIONS[ACTIVE].objects.link(obj)
    PARTS[ACTIVE].append(obj)
    return obj

def mesh(name, verts, faces, color, mat=MAT, bevel=0, segments=1, smooth=False):
    data = bpy.data.meshes.new(name + '_mesh')
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    return finish(obj, name, color, mat, bevel, segments, smooth)

def box(name, pos, size, color, mat=MAT, bevel=.015, segments=1, rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.dimensions = size
    if rot:
        obj.rotation_euler = rot
    return finish(obj, name, color, mat, bevel, segments, True)

def cylinder(name, pos, radius, depth, color, mat=MAT, vertices=12, bevel=0, rot=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=pos)
    obj = bpy.context.object
    if rot:
        obj.rotation_euler = rot
    return finish(obj, name, color, mat, bevel, 1, True)

def sphere(name, pos, radius, color, mat=MAT, segments=12, rings=6, scale=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=radius, location=pos)
    obj = bpy.context.object
    if scale:
        obj.scale = scale
    return finish(obj, name, color, mat, smooth=True)

def prism_x(name, outline_yz, x0, x1, color, mat=MAT, bevel=0, segments=1):
    n = len(outline_yz)
    verts = [(x,y,z) for x in (x0,x1) for y,z in outline_yz]
    faces = [tuple(reversed(range(n))), tuple(range(n,2*n))]
    faces += [(k,(k+1)%n,(k+1)%n+n,k+n) for k in range(n)]
    return mesh(name, verts, faces, color, mat, bevel, segments, bool(bevel))

def face_emblem(name, points, origin, right, up, normal, depth, color, mat=TRIM):
    o,r,u,n = map(Vector, (origin,right,up,normal))
    verts = [tuple(o + r*x + u*y + n*d) for d in (0,depth) for x,y in points]
    count = len(points)
    faces = [tuple(reversed(range(count))),tuple(range(count,count*2))]
    faces += [(k,(k+1)%count,(k+1)%count+count,k+count) for k in range(count)]
    return mesh(name, verts, faces, color, mat)

def star_points(radius):
    return [(math.sin(k*math.pi/5)*radius*(1 if k%2==0 else .46),
             math.cos(k*math.pi/5)*radius*(1 if k%2==0 else .46)) for k in range(10)]

def star(name, x, y, z, radius, color='honeyLight', mat=TRIM):
    return face_emblem(name, star_points(radius), (x,y,z), (1,0,0),(0,0,1),(0,-1,0),.018,color,mat)

def ellipse_band(name, rx0, rz0, rx1, rz1, center_z, y0, y1, color, mat=MAT, steps=18, bevel=0):
    verts = []
    for y in (y0,y1):
        for rx,rz in ((rx0,rz0),(rx1,rz1)):
            verts += [(rx*math.cos(math.pi*k/steps),y,center_z+rz*math.sin(math.pi*k/steps)) for k in range(steps+1)]
    n=steps+1
    faces=[]
    for k in range(steps):
        faces.extend([(k,k+1,n+k+1,n+k),(2*n+k,3*n+k,3*n+k+1,2*n+k+1),
                      (k,2*n+k,2*n+k+1,k+1),(n+k,n+k+1,3*n+k+1,3*n+k)])
    faces.extend([(0,n,3*n,2*n),(steps,2*n+steps,3*n+steps,n+steps)])
    return mesh(name,verts,faces,color,mat,bevel=bevel,smooth=True)

def profile_ring(name, rings, color, mat=MAT, sides=12):
    verts=[(r*math.cos(2*math.pi*k/sides),r*math.sin(2*math.pi*k/sides),z) for z,r in rings for k in range(sides)]
    faces=[tuple(reversed(range(sides))),tuple(range((len(rings)-1)*sides,len(rings)*sides))]
    for j in range(len(rings)-1):
        for k in range(sides):
            faces.append((j*sides+k,j*sides+(k+1)%sides,(j+1)*sides+(k+1)%sides,(j+1)*sides+k))
    return mesh(name,verts,faces,color,mat,smooth=True)

# Ticket arch: the narrowest foot gap is 4.04 m, with nothing spanning the floor.
asset('ticket-arch')
for sign in (-1,1):
    side='L' if sign<0 else 'R'
    for row,z in enumerate((.09,.28)):
        width=.76 if row==0 else .62
        center=2.40 if row==0 else 2.33
        for j in range(2):
            x=sign*(center + (j-.5)*(width/2+.008))
            box(f'{side}_stone_{row}_{j}',(x,0,z),(width/2-.009,.62-row*.05,.18),'stoneLight' if (row+j)%2 else 'stone',bevel=.027)
    box(f'{side}_timber',(sign*2.30,0,1.095),(.48,.43,1.48),'wood',bevel=.034)
    for j in (-1,1):
        box(f'{side}_wood_join_{j}',(sign*2.30+j*.079,-.218,1.11),(.012,.008,1.38),'woodDark',bevel=0)
    box(f'{side}_capital',(sign*2.30,0,1.82),(.65,.54,.18),'woodLight',bevel=.024)
    box(f'{side}_base_band',(sign*2.30,0,.455),(.56,.49,.13),'woodLight',bevel=.014)
    for j,z in enumerate((.85,1.40)):
        box(f'{side}_ticket_rim_{j}',(sign*2.30,-.252,z),(.275,.07,.41),'honey',bevel=.025)
        box(f'{side}_ticket_{j}',(sign*2.30,-.291,z),(.233,.025,.356),'cherryShade' if j==0 else 'cherry',bevel=.025)
        star(f'{side}_ticket_star_{j}',sign*2.30,-.307,z,.063,'honey')
ellipse_band('Bent timber arch',2.04,1.0,2.56,1.25,1.80,-.215,.215,'wood',bevel=.009)
ellipse_band('Honey inlay arch',2.15,1.052,2.45,1.207,1.80,-.246,-.216,'honey',TRIM)
ellipse_band('Plum lamp bed',2.20,1.075,2.40,1.183,1.80,-.262,-.247,'woodDark')
for k in range(9):
    angle=math.radians(13+k*19.25)
    x,z=2.30*math.cos(angle),1.80+1.13*math.sin(angle)
    cylinder(f'Bulb collar {k}',(x,-.275,z),.078,.024,'woodDark',vertices=8,rot=(math.pi/2,0,0))
    sphere(f'Honey bulb {k}',(x,-.300,z),.060,'honeyLight',GLOW,segments=8,rings=3,scale=(1,.7,1))
cylinder('Star token rim',(0,-.294,3.025),.36,.16,'honey',TRIM,vertices=20,bevel=.018,rot=(math.pi/2,0,0))
cylinder('Star token face',(0,-.383,3.025),.309,.034,'woodDark',vertices=20,rot=(math.pi/2,0,0))
star('Crest star',0,-.41,3.035,.245,'honeyLight',GLOW)
# Two restrained exterior lanterns stay outside the traversal envelope.
for sign in (-1,1):
    side='L' if sign<0 else 'R'
    box(f'{side}_lantern_bracket',(sign*2.71,.045,1.70),(.39,.075,.075),'woodDark',bevel=.01)
    cylinder(f'{side}_lantern_cap',(sign*2.89,.045,1.575),.15,.075,'honey',TRIM,vertices=8)
    sphere(f'{side}_lantern_light',(sign*2.89,.045,1.42),.10,'honeyLight',GLOW,segments=8,rings=4,scale=(1,1,1.32))
    cylinder(f'{side}_lantern_foot',(sign*2.89,.045,1.265),.12,.045,'woodDark',vertices=8)
    for dx in (-.108,.108):
        box(f'{side}_lantern_frame_{dx}',(sign*2.89+dx,.045,1.42),(.024,.032,.30),'honey',TRIM,bevel=0)

# Cabinet: a deliberate sloping screen and projecting control shelf.
asset('arcade-cabinet')
outline=[(-.46,.09),(-.49,.76),(-.30,.93),(-.075,1.45),(-.37,1.55),(-.37,1.71),(-.285,1.79),(.36,1.79),(.46,1.69),(.46,.09)]
for sign in (-1,1):
    a,b=sorted((sign*.45,sign*.37))
    prism_x(('L' if sign<0 else 'R')+'_gold side edge',outline,a,b,'honey',TRIM,bevel=.017,segments=1)
    inner=[(y*.952,(z-.92)*.945+.92) for y,z in outline]
    a,b=sorted((sign*.458,sign*.449))
    prism_x(('L' if sign<0 else 'R')+'_plum side',inner,a,b,'plum',bevel=.012)
box('Wood foot',(0,0,.065),(.90,1,.13),'woodDark',bevel=.025)
box('Lower case',(0,-.015,.416),(.737,.88,.616),'woodDark',bevel=.022)
box('Plum front',(0,-.463,.43),(.70,.036,.45),'plumDark',bevel=.032)
box('Coin escutcheon',(0,-.487,.44),(.135,.018,.17),'honey',TRIM,bevel=.022)
box('Coin slot',(0,-.499,.476),(.071,.006,.013),'ink',bevel=.005)
prism_x('Control deck',[(-.49,.755),(-.49,.815),(-.277,.950),(-.223,.912)],-.375,.375,'cherryShade',bevel=.018)
box('Control apron',(0,-.489,.758),(.74,.062,.102),'plum',bevel=.022)
box('Rear panel',(0,.439,.956),(.735,.044,1.51),'plumDark',bevel=.018)
box('Header backing',(0,.022,1.669),(.76,.76,.229),'woodDark',bevel=.034)
box('Marquee rim',(0,-.382,1.663),(.767,.11,.243),'honey',TRIM,bevel=.031,segments=2)
box('Marquee face',(0,-.444,1.663),(.675,.025,.165),'cherry',bevel=.018,segments=2)
star('Marquee star',0,-.462,1.668,.066,'honeyLight')
for x in (-.22,.22):
    face_emblem('Marquee diamond',[(0,.03),(.021,0),(0,-.03),(-.021,0)],(x,-.465,1.664),(1,0,0),(0,0,1),(0,-1,0),.004,'honeyLight')
screen_up=Vector((0,.225,.52)).normalized()
screen_normal=Vector((0,-screen_up.z,screen_up.y))
screen_origin=Vector((0,-.292,.946))
face_emblem('Screen surround',[(-.37,0),(.37,0),(.37,.570),(-.37,.570)],screen_origin,(1,0,0),screen_up,screen_normal,.021,'woodDark')
face_emblem('Screen glass',[(-.31,.049),(.31,.049),(.31,.520),(-.31,.520)],screen_origin+screen_normal*.025,(1,0,0),screen_up,screen_normal,.003,'night')
for x in (-.337,.337):
    face_emblem('Screen honey edge',[(x-.011,.024),(x+.011,.024),(x+.011,.548),(x-.011,.548)],screen_origin+screen_normal*.027,(1,0,0),screen_up,screen_normal,.005,'honey',TRIM)
def crescent_points(radius, offset, inner_radius, steps=18):
    xx=(radius*radius-inner_radius*inner_radius+offset*offset)/(2*offset)
    yy=math.sqrt(radius*radius-xx*xx)
    a=math.atan2(yy,xx)
    b=math.atan2(yy,xx-offset)
    return ([(radius*math.cos(a+(2*math.pi-2*a)*k/steps),radius*math.sin(a+(2*math.pi-2*a)*k/steps)) for k in range(steps+1)]
            +[(offset+inner_radius*math.cos(-b-(2*math.pi-2*b)*k/steps),inner_radius*math.sin(-b-(2*math.pi-2*b)*k/steps)) for k in range(1,steps)])
face_emblem('Moon on screen',crescent_points(.139,.064,.127,14),screen_origin+Vector((-.065,0,0))+screen_up*.313+screen_normal*.034,(1,0,0),screen_up,screen_normal,.003,'honeyLight',GLOW)
face_emblem('Screen star',star_points(.044),screen_origin+Vector((.174,0,0))+screen_up*.418+screen_normal*.033,(1,0,0),screen_up,screen_normal,.003,'honeyLight',GLOW)
for x,u,r in ((.152,.17,.025),(-.218,.135,.016),(.21,.319,.014)):
    pts=[(r*math.cos(2*math.pi*k/8),r*math.sin(2*math.pi*k/8)) for k in range(8)]
    face_emblem('Screen dot',pts,screen_origin+Vector((x,0,0))+screen_up*u+screen_normal*.033,(1,0,0),screen_up,screen_normal,.002,'honeyLight',GLOW)
# Controls are chunky, self-contained geometry.
cylinder('Stick socket',(-.208,-.364,.918),.064,.017,'ink',vertices=12)
cylinder('Stick',(-.208,-.364,.974),.018,.111,'honey',TRIM,vertices=10)
sphere('Stick cherry',(-.208,-.364,1.054),.067,'cherry',TRIM,segments=12,rings=8)
for x,y,color in ((.056,-.38,'cherry'),(.223,-.333,'honeyLight')):
    z=.824+(y+.49)*.63
    cylinder('Button surround',(x,y,z),.065,.031,'woodDark',vertices=12,bevel=.004)
    cylinder('Button cap',(x,y,z+.024),.051,.031,color,TRIM,vertices=12,bevel=.009)
# Large quiet side ornaments replace the source image's fine painted detail.
for sign in (-1,1):
    n=(sign,0,0)
    face_emblem('Side crescent',crescent_points(.21,.095,.190,14),(sign*.465,.09,.78),(0,1,0),(0,0,1),n,.008,'honey')
    face_emblem('Side star',star_points(.083),(sign*.465,-.075,1.248),(0,1,0),(0,0,1),n,.008,'cherry')
    for z in (.305,1.55):
        pts=[(.034*math.cos(k*math.pi/4),.034*math.sin(k*math.pi/4)) for k in range(8)]
        face_emblem('Side dot',pts,(sign*.465,.16,z),(0,1,0),(0,0,1),n,.006,'cherry')
for z in (.35,.415,.48):
    box('Rear vent',(0,.466,z),(.36,.012,.021),'ink',bevel=.005)

# Squat decorative joystick bollard, 0.85 m wide and 1.05 m tall.
asset('joystick-bollard')
profile_ring('Stone foot',[(0,.392),(.023,.425),(.104,.421),(.131,.39)],'stone',sides=12)
profile_ring('Padded plum body',[(.119,.321),(.17,.342),(.36,.292),(.46,.275),(.478,.252)],'plum',sides=12)
profile_ring('Stone collar',[(.447,.285),(.476,.317),(.538,.303),(.561,.282)],'stoneLight',sides=12)
for angle in (math.radians(225),math.radians(315),math.radians(90)):
    x,y=.316*math.cos(angle),.316*math.sin(angle)
    bar=box('Wood reinforcing stave',(x,y,.298),(.082,.049,.296),'wood',bevel=.018,rot=(0,0,angle-math.pi/2))
    # The body tapers inward; tilt each stave toward its crown.
    bar.rotation_euler.x=math.radians(9)*math.sin(angle)
    bar.rotation_euler.y=-math.radians(9)*math.cos(angle)
cylinder('Stick bezel',(0,0,.583),.168,.049,'honey',TRIM,vertices=16,bevel=.011)
cylinder('Short stick',(0,0,.662),.064,.12,'honey',TRIM,vertices=12)
sphere('Cherry ball',(0,0,.866),.184,'cherry',TRIM,segments=20,rings=12)
star('Bollard star',0,-.309,.301,.097,'honey')

# Export a single mesh per prop with up to three material primitives, keeping
# the many named editable components in their original collections.
metadata={'asset':'midnight-arcade-kit','version':'v001','workOrder':'WO095',
          'blenderVersion':bpy.app.version_string,'units':'meters',
          'authoringFrame':{'up':'+Z','front':'-Y','origin':'floor center'},
          'exportFrame':{'up':'+Y','front':'+Z','origin':'floor center'},
          'approval':'candidate; owner review pending','props':{}}
for name,objects in PARTS.items():
    bpy.ops.object.select_all(action='DESELECT')
    copies=[]
    for obj in objects:
        new=obj.copy();new.data=obj.data.copy()
        scene.collection.objects.link(new)
        new.select_set(True)
        copies.append(new)
    bpy.context.view_layer.objects.active=copies[0]
    bpy.ops.object.join()
    joined=bpy.context.object
    joined.name=name
    scene.cursor.location=(0,0,0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    joined.data.calc_loop_triangles()
    tri_count=len(joined.data.loop_triangles)
    bounds=[joined.matrix_world@Vector(v) for v in joined.bound_box]
    lo=[min(v[k] for v in bounds) for k in range(3)]
    hi=[max(v[k] for v in bounds) for k in range(3)]
    metadata['props'][name]={'triangles':tri_count,'materials':len(joined.data.materials),
                           'blenderBounds':{'min':lo,'max':hi},'namedEditableParts':len(objects)}
    assert tri_count<=3000,(name,tri_count)
    assert len(joined.data.materials)<=3
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',
        use_selection=True,export_yup=True,export_apply=True,export_animations=False,
        export_skins=False,export_morph=False,export_extras=False,export_cameras=False,
        export_lights=False,export_texcoords=False,export_vertex_color='MATERIAL',
        export_all_vertex_colors=False,export_normals=True)
    bpy.data.objects.remove(joined,do_unlink=True)

# A neutral studio, saved with the master, is excluded from every GLB.
asset('Review studio')
box('Studio floor',(0,0,-.095),(200,200,.16),rgb('b7a993'),bevel=0)
floor=PARTS['Review studio'][0]
world=bpy.data.worlds.new('Plum gray studio')
world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(*rgb('b9b5c4'),1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.38
scene.world=world
def area(name,loc,energy,size,color,target=(0,0,1)):
    data=bpy.data.lights.new(name,'AREA')
    data.energy=energy;data.shape='DISK';data.size=size;data.color=color
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj)
    obj.location=loc;obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj
area('Large warm key',(-3.8,-5.5,7),1100,5.0,(1,.86,.68))
area('Soft cool fill',(4,-2,4.5),700,4.0,(.70,.78,1))
area('Warm edge',(-1,4,6),1000,3.5,(1,.80,.55))
cam_data=bpy.data.cameras.new('Review camera')
camera=bpy.data.objects.new('Review camera',cam_data)
scene.collection.objects.link(camera)
scene.camera=camera
cam_data.type='ORTHO';cam_data.lens=50
scene.render.engine='CYCLES'
scene.cycles.device='CPU';scene.cycles.samples=32
scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=8
scene.render.resolution_x=960;scene.render.resolution_y=960
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGBA'
scene.render.film_transparent=False
scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
scene.view_settings.exposure=-.35

def isolate(name):
    for key,c in COLLECTIONS.items():
        c.hide_render=(key not in (name,'Review studio'))

def aim(loc,target,scale):
    camera.location=loc
    camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    cam_data.ortho_scale=scale

isolate('ticket-arch')
aim((7,-12,7),(0,0,1.64),7.2)
metadata['archClearance']={'minimumFootGapMeters':4.041,'postGapMeters':4.12,
                          'capitalGapMeters':3.95,
                          'springHeightMeters':1.80,'innerCrownHeightMeters':2.80,
                          'collisionGeometry':'none; visual candidate only'}
(OUT/'construction-measurements.json').write_text(json.dumps(metadata,indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'midnight-arcade-kit.blend'))
print(json.dumps(metadata))
