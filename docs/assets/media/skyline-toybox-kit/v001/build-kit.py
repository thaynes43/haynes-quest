"""WO096: Skyline Toybox review kit, authored in Blender 4.5.

Original static scenery constructed from the driving Astra's selected concept.
Run with exec(compile(open(path).read(), path, 'exec')) in Blender.
Meters, authoring Z up/front -Y; GLB Y up/front +Z. All origins: floor center.
The three prop collections are editable parts; exports are merged per material.
No gameplay colliders, scripts, animation, friendly/enemy identifiers or promotion.
"""
import bpy
import bmesh
import math
import json
import random
from pathlib import Path
from mathutils import Vector

OUT = Path('/workspace/haynes-quest/skyline-toybox-kit/v001')
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for blocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials,
               bpy.data.cameras, bpy.data.lights):
    for item in list(blocks):
        if item.users == 0:
            blocks.remove(item)
for collection in list(bpy.data.collections):
    if collection.name != 'Collection':
        bpy.data.collections.remove(collection)
for block in list(bpy.data.texts):
    bpy.data.texts.remove(block)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
random.seed(96)


def linear(v):
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4


def rgb(hexcolor):
    return tuple(linear(int(hexcolor[k:k+2], 16) / 255) for k in (0, 2, 4))


PALETTE = {name: rgb(value) for name, value in {
    'peach': 'd9aa8e', 'peachLight': 'e4bfa1', 'peachShade': 'ba8a73',
    'wood': 'c69d75', 'woodLight': 'dfbb8b', 'woodShade': '967255',
    'blue': '6d7cb0', 'blueLight': '8898bf', 'blueShade': '56658e',
    'teal': '8ca6a0', 'tealLight': 'a5bbb2', 'tealShade': '648781',
    'honey': 'dca953', 'honeyLight': 'ffe0a0', 'glow': 'ffd07a',
    'plum': '4e4560', 'parchment': 'f5ebdc',
}.items()}


def material(name, roughness, metallic=0, emission=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Specular IOR Level'].default_value = .23
    color = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    color.layer_name = 'Color'
    mat.node_tree.links.new(color.outputs['Color'], shader.inputs['Base Color'])
    if emission:
        # glTF cannot source emission from COLOR_0. Keep the same constant honey
        # emission in Blender and the browser; vertex color still shades the base.
        shader.inputs['Emission Color'].default_value = (*PALETTE['glow'], 1)
        shader.inputs['Emission Strength'].default_value = emission
    return mat


MAT = material('Toybox_matte_painted_wood', .84)
TRIM = material('Toybox_satin_honey_key', .50, .15)
GLOW = material('Toybox_honey_light', .67, emission=.85)
COLLECTIONS = {}
PARTS = {}
ACTIVE = None


def asset(name):
    global ACTIVE
    ACTIVE = name
    col = bpy.data.collections.new(name)
    scene.collection.children.link(col)
    COLLECTIONS[name] = col
    PARTS[name] = []


def finish(obj, name, color, mat=MAT, bevel=0, segments=2, smooth=True):
    obj.name = name
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new('Soft handmade edges', 'BEVEL')
        mod.width = bevel
        mod.segments = segments
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
    base = PALETTE[color]
    # Low frequency variation supports readable crafted surfaces without textures.
    offset = random.uniform(-1, 1)
    for polygon in obj.data.polygons:
        polygon.use_smooth = smooth
        for loop_index in polygon.loop_indices:
            co = obj.data.vertices[obj.data.loops[loop_index].vertex_index].co
            broad = math.sin(co.x * 4.7 + co.z * 2.3 + offset) * .018
            colors.data[loop_index].color = (*[min(1, c * (1 + broad)) for c in base], 1)
    if smooth:
        mod = obj.modifiers.new('Stable corner normals', 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
        mod.weight = 50
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for col in list(obj.users_collection):
        col.objects.unlink(obj)
    COLLECTIONS[ACTIVE].objects.link(obj)
    PARTS[ACTIVE].append(obj)
    return obj


def mesh(name, verts, faces, color, mat=MAT, bevel=0, segments=2, smooth=True):
    data = bpy.data.meshes.new(name + '_mesh')
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    return finish(obj, name, color, mat, bevel, segments, smooth)


def box(name, pos, size, color, mat=MAT, bevel=.025, segments=2, rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.dimensions = size
    if rot:
        obj.rotation_euler = rot
    return finish(obj, name, color, mat, bevel, segments)


def cylinder(name, pos, radius, depth, color, mat=MAT, vertices=12, bevel=.008, rot=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=pos)
    obj = bpy.context.object
    if rot:
        obj.rotation_euler = rot
    return finish(obj, name, color, mat, bevel, 1)


def profile(name, rings, color, sides=16):
    verts = [(r*math.cos(2*math.pi*k/sides), r*math.sin(2*math.pi*k/sides), z)
             for z, r in rings for k in range(sides)]
    faces = [tuple(reversed(range(sides))), tuple(range((len(rings)-1)*sides, len(rings)*sides))]
    for j in range(len(rings)-1):
        for k in range(sides):
            faces.append((j*sides+k, j*sides+(k+1)%sides,
                          (j+1)*sides+(k+1)%sides, (j+1)*sides+k))
    return mesh(name, verts, faces, color)


def extrude_xz(name, points, y0, y1, color, mat=MAT, bevel=0, segments=2):
    n = len(points)
    verts = [(x, y, z) for y in (y0, y1) for x, z in points]
    faces = [tuple(reversed(range(n))), tuple(range(n, 2*n))]
    faces += [(k, (k+1)%n, (k+1)%n+n, k+n) for k in range(n)]
    return mesh(name, verts, faces, color, mat, bevel, segments)


def ring(name, pos, outer, inner, depth, color, mat=MAT, sides=16, rot=None):
    verts = [(r*math.cos(k*math.tau/sides), r*math.sin(k*math.tau/sides), z)
             for z in (-depth/2, depth/2) for r in (outer, inner) for k in range(sides)]
    faces = []
    for k in range(sides):
        q = (k+1)%sides
        faces += [(k,q,sides+q,sides+k), (2*sides+k,3*sides+k,3*sides+q,2*sides+q),
                  (k,2*sides+k,2*sides+q,q), (sides+k,sides+q,3*sides+q,3*sides+k)]
    obj = mesh(name, verts, faces, color, mat, bevel=.006, segments=1)
    obj.location = pos
    if rot:
        obj.rotation_euler = rot
    return obj


def diamond(name, x, y, z, radius, color, mat=MAT):
    p = [(x,z+radius), (x+radius*.27,z+radius*.24), (x+radius*.76,z),
         (x+radius*.27,z-radius*.24), (x,z-radius), (x-radius*.27,z-radius*.24),
         (x-radius*.76,z), (x-radius*.27,z+radius*.24)]
    return extrude_xz(name, p, y-.008, y+.008, color, mat, bevel=.003, segments=1)


# Three module tower: arch block, soft middle block, four-sided roof block.
asset('block-tower')
spring, radius = .42, .50
inner_arc = [(radius*math.cos(math.pi*k/12), spring+radius*math.sin(math.pi*k/12))
             for k in range(13)]
outline = [(-.85,0),(-.85,1.28),(.85,1.28),(.85,0),(.50,0)] + inner_arc + [(-.50,0)]
base = extrude_xz('Module_01_peach_arch', outline, -.45, .45, 'peach', bevel=.052, segments=3)
base['module'] = '01 / broad rounded arch'
# Shallow crafted join marks are visible detail, not holes or moving joints.
for sign in (-1,1):
    box(f'Arch_foot_wear_{sign}', (sign*.686,-.453,.125), (.196,.013,.015), 'peachLight', bevel=.005, segments=1)
    cylinder(f'Arch_join_peg_{sign}', (sign*.675,-.456,1.06), .032,.012,'wood',vertices=10,bevel=.002,rot=(math.pi/2,0,0))
middle = box('Module_02_soft_teal_block', (0,0,1.61), (.98,.80,.66), 'teal', bevel=.067, segments=3)
middle['module'] = '02 / soft painted block'
box('Middle_front_inset', (0,-.402,1.61), (.73,.013,.42), 'tealLight', bevel=.055, segments=2)
diamond('Middle_inlaid_kite', 0,-.421,1.61,.135,'tealShade')
roof = mesh('Module_03_muted_blue_roof', [(-.57,-.45,1.94),(.57,-.45,1.94),(.57,.45,1.94),(-.57,.45,1.94),(0,0,2.40)],
            [(3,2,1,0),(0,1,4),(1,2,4),(2,3,4),(3,0,4)], 'blue', bevel=.030, segments=3)
roof['module'] = '03 / rounded roof block'

# Repeatable 2.4 meter cushioned edge segment. Its collision remains unspecified.
asset('safety-rail')
for x in (-1.02,1.02):
    side = 'L' if x<0 else 'R'
    box(side+'_wood_foot', (x,0,.075), (.36,.38,.15), 'peach', bevel=.034, segments=2)
    post = profile(side+'_padded_blue_post', [(0.14,.122),(.18,.140),(.52,.140),(.565,.121)],'blue')
    post.location.x = x
    collar = profile(side+'_soft_cap', [(.55,.13),(.571,.17),(.69,.17),(.735,.128),(.75,.06)],'blueLight')
    collar.location.x = x
    cylinder(side+'_wood_endgrain', (x,0,.752),.050,.008,'woodShade',vertices=12,bevel=.003)
    cylinder(side+'_join_peg', (x,-.145,.37),.031,.015,'blueShade',vertices=10,bevel=.003,rot=(math.pi/2,0,0))
box('Warm_wood_handrail', (0,0,.62), (2.13,.135,.12), 'woodLight', bevel=.044, segments=3)
box('Lower_wood_crossbar', (0,.025,.295), (2.08,.080,.065), 'wood', bevel=.025, segments=2)
# A restrained continuous inlaid stripe reads as wood craft at close distance.
box('Handrail_inlaid_edge', (0,-.064,.619), (1.76,.013,.013), 'wood', bevel=.005, segments=1)

# Faceless wind-up lantern. The honey window and winding key identify its role.
asset('windup-lantern')
box('Peach_wood_foot', (0,0,.065), (.49,.37,.13), 'peach', bevel=.052, segments=3)
box('Rounded_blue_case', (0,0,.341), (.50,.35,.52), 'blue', bevel=.115, segments=4)
box('Rear_wood_service_panel', (0,.170,.343), (.303,.024,.325), 'wood', bevel=.055, segments=2)
# Front window uses a rounded arch silhouette and an opaque honey light surface.
def window_outline(width, bottom, spring, height, steps=12):
    return [(-width/2,bottom),(width/2,bottom),(width/2,spring)] + [
        (width/2*math.cos(math.pi*k/steps), spring+height*math.sin(math.pi*k/steps))
        for k in range(1,steps+1)]
extrude_xz('Peach_window_surround',window_outline(.414,.129,.390,.150),-.196,-.170,'peach',bevel=.022,segments=2)
extrude_xz('Honey_lit_window',window_outline(.323,.169,.393,.111),-.216,-.198,'glow',GLOW,bevel=.016,segments=2)
diamond('Single_window_glint',0,-.231,.322,.099,'honeyLight',GLOW)
for x in (-.196,.196):
    cylinder('Window_peg_'+str(x),(x,-.199,.235),.016,.012,'woodShade',vertices=8,bevel=.002,rot=(math.pi/2,0,0))
cap = profile('Peach_domed_top',[(.576,.16),(.609,.20),(.645,.19),(.680,.12),(.691,.06)],'peach',sides=16)
cap.scale.y = .75
cylinder('Handle_mount',(0,0,.689),.048,.052,'wood',vertices=12,bevel=.010)
ring('Small_carry_loop',(0,0,.748),.066,.036,.028,'woodLight',sides=16,rot=(math.pi/2,0,0))
# The shaft is X-aligned; bow holes lie in the YZ plane, as on a real winding key.
cylinder('Key_socket',(.251,0,.40),.063,.035,'blueShade',vertices=12,bevel=.006,rot=(0,math.pi/2,0))
cylinder('Honey_key_shaft',(.316,0,.40),.029,.135,'honey',TRIM,vertices=10,bevel=.004,rot=(0,math.pi/2,0))
box('Honey_key_neck',(.386,0,.445),(.046,.044,.118),'honey',TRIM,bevel=.012,segments=2)
box('Honey_key_bow_bridge',(.386,0,.427),(.042,.202,.044),'honey',TRIM,bevel=.010,segments=2)
for y in (-.100,.100):
    ring('Windup_key_bow_'+str(y),(.386,y,.505),.090,.048,.044,'honey',TRIM,sides=14,rot=(0,math.pi/2,0))

# Master retains every construction part. Export copies are merged per prop.
def measurements(objects):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    pts=[]
    triangles=0
    mats=set()
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        evaluated.data.calc_loop_triangles()
        triangles += len(evaluated.data.loop_triangles)
        pts.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
        mats.update(m.name for m in obj.data.materials if m)
    lo=[min(p[i] for p in pts) for i in range(3)]
    hi=[max(p[i] for p in pts) for i in range(3)]
    return {'triangles':triangles,'materials':sorted(mats),'sourceMeshParts':len(objects),
            'authoringBoundsZUp':{'min':lo,'max':hi,'size':[hi[i]-lo[i] for i in range(3)]}}


bpy.context.view_layer.update()
# Center the entire exported footprint, including the lantern's projecting key.
for objects in PARTS.values():
    bounds = measurements(objects)['authoringBoundsZUp']
    lo, hi = bounds['min'], bounds['max']
    offset = Vector(((lo[0]+hi[0])/2, (lo[1]+hi[1])/2, lo[2]))
    for obj in objects:
        obj.location -= offset
bpy.context.view_layer.update()
report = {'workOrder':'WO096','assetKit':'skyline-toybox-kit','version':'v001',
          'blenderVersion':bpy.app.version_string,'authoringFrame':'Meters, Z up, front -Y',
          'exportFrame':'Meters, Y up, front +Z; origins at floor center',
          'geometry':'Static opaque mesh scenery; vertex colors and embedded geometry; no external resources',
          'ownerApproval':'pending','gameplayUse':'none','props':{}}
for name, objects in PARTS.items():
    report['props'][name] = measurements(objects)
    assert report['props'][name]['triangles'] <= 3000, (name, report['props'][name])
    assert len(report['props'][name]['materials']) <= 3
    bpy.ops.object.select_all(action='DESELECT')
    duplicates=[]
    for source in objects:
        obj=source.copy()
        obj.data=source.data.copy()
        scene.collection.objects.link(obj)
        obj.select_set(True)
        duplicates.append(obj)
    bpy.context.view_layer.objects.active=duplicates[0]
    bpy.ops.object.join()
    export_obj=bpy.context.object
    export_obj.name=name
    scene.cursor.location=(0,0,0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    # Strip default UVs: this deliberately untextured kit exports COLOR_0 only.
    for uv in list(export_obj.data.uv_layers):
        export_obj.data.uv_layers.remove(uv)
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',
        use_selection=True,export_yup=True,export_animations=False,export_cameras=False,
        export_lights=False,export_materials='EXPORT',export_extras=False)
    bpy.data.objects.remove(export_obj,do_unlink=True)
(OUT/'construction-measurements.json').write_text(json.dumps(report,indent=2)+'\n')

# Review studio is deliberately excluded from every GLB.
studio=bpy.data.collections.new('Review studio (never exported)')
scene.collection.children.link(studio)
def studio_link(obj):
    for col in list(obj.users_collection):
        col.objects.unlink(obj)
    studio.objects.link(obj)

bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.008))
ground=bpy.context.object
ground.name='Warm parchment studio ground'
floor=bpy.data.materials.new('Studio_parchment')
floor.use_nodes=True
floor.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*rgb('e8e1d2'),1)
floor.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=1
ground.data.materials.append(floor)
studio_link(ground)
bpy.ops.object.camera_add(location=(4,-6,3.7))
camera=bpy.context.object
camera.name='Review_camera'
camera.data.type='ORTHO'
camera.data.ortho_scale=3.4
camera.rotation_euler=(Vector((0,0,1.1))-camera.location).to_track_quat('-Z','Y').to_euler()
scene.camera=camera
studio_link(camera)
for name,location,energy,size,color in [
        ('Warm key',(-3.5,-4.5,7),850,5,(1,.89,.75)),
        ('Cool soft fill',(4,-1,4),500,4,(.78,.88,1)),
        ('Warm rim',(-1,4,5),700,3.5,(1,.93,.79))]:
    bpy.ops.object.light_add(type='AREA',location=location)
    lamp=bpy.context.object
    lamp.name=name
    lamp.data.energy=energy
    lamp.data.shape='DISK'
    lamp.data.size=size
    lamp.data.color=color
    lamp.rotation_euler=(Vector((0,0,.8))-lamp.location).to_track_quat('-Z','Y').to_euler()
    studio_link(lamp)
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.65,.72,.85,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.27
scene.render.engine='CYCLES'
scene.cycles.device='CPU'
scene.cycles.samples=32
scene.cycles.use_denoising=True
scene.render.image_settings.file_format='PNG'
scene.render.resolution_percentage=100
scene.render.resolution_x=960
scene.render.resolution_y=960
scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
scene.view_settings.exposure=-.20
for name,col in COLLECTIONS.items():
    col.hide_render=name!='block-tower'
for filename in ('build-kit.py','render-kit.py','validate-glbs.mjs'):
    if (OUT/filename).exists():
        textblock=bpy.data.texts.get(filename) or bpy.data.texts.new(filename)
        textblock.clear()
        textblock.write((OUT/filename).read_text())
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'skyline-toybox-kit.blend'))
print(json.dumps(report,indent=2))
