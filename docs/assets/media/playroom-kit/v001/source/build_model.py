"""WO111 Playroom kit v001: production topology derived from the approved sheet.

Preserves its authored silhouette, palette, feature locations and registry boxes.
Resolution is reduced at primitive construction, never by destructive whole-prop
decimation. Three simple vertex-colour PBR finishes replace the sheet materials.
The master retains individual parts alongside the four joined export meshes.
"""
import bpy, bmesh, math, json, hashlib, datetime, zlib
from pathlib import Path
from mathutils import Vector, Matrix, noise
from mathutils.bvhtree import BVHTree

ROOT = Path('/workspace/haynes-quest/family-eras/playroom-kit/v001')
OWNER = 'gpt-6-astra/playroom-kit-props'
sc = bpy.context.scene
assert sc.get('scene_owner') == OWNER and sc.get('scene_lease') == 'active'
src = (ROOT / 'source/reference_blockout.py').read_text()
# The sewn gores and seam curves are parametrically regenerated at game resolution.
src = src.replace('rings = 40; cols = 14;', 'rings = 18; cols = 6;')
src = src.replace('* i / 60, ph, puff=False)) for i in range(61)', '* i / 18, ph, puff=False)) for i in range(19)')
src = src.replace('* i / 48 for i in range(48)', '* i / 16 for i in range(16)')
geo = {'__name__': 'reference_geometry'}
exec(compile(src, str(ROOT / 'source/reference_blockout.py'), 'exec'), geo)

def clamp_function(name, caps):
    import inspect
    original = geo[name]; signature = inspect.signature(original)
    def wrapped(*args, **kwargs):
        call = signature.bind(*args, **kwargs); call.apply_defaults()
        for key, maximum in caps.items(): call.arguments[key] = min(call.arguments[key], maximum)
        return original(*call.args, **call.kwargs)
    geo[name] = wrapped

original_soften = geo['soften']
for name, caps in [
    ('bevel', {'seg': 2}), ('cyl', {'seg': 16}),
    ('ellipsoid', {'seg': 12, 'rings': 8}), ('half_ellipsoid', {'seg': 20, 'rings': 10}),
    ('sweep', {'n': 6}), ('arc', {'n': 16}), ('rrect', {'n': 3}),
    ('heart', {'n': 20}), ('circle', {'n': 20}), ('soften', {'n': 1}),
]: clamp_function(name, caps)
# A midpoint on each rounded triangle corner preserves the recognisable triangle
# silhouette; a single chamfer would read like a hexagon from the chase camera.
def production_triangle(side):
    h = side * math.sqrt(3) / 2
    return original_soften([(-side/2,-h/3),(side/2,-h/3),(0,2*h/3)],0.22,2)
geo['triangle']=production_triangle
# The garage's tiny lenses, badge plates and horn use a single clean radial rim.
# Its broad silhouette keeps sixteen-sided cylinders and the curved barrel roof.
_bevel = geo['bevel']; _cyl = geo['cyl']
def production_bevel(ob, w, seg=3, angle=30):
    return _bevel(ob, w, min(seg, 1) if geo['CUR']['prop'] == 'toy-bus-garage' else seg, angle)
def production_cyl(name, loc, r1, r2, depth, key, rot=(0,0,0), seg=48, bev=0.006, finish='foam'):
    if geo['CUR']['prop'] == 'toy-bus-garage' and max(r1,r2) <= 0.26: bev=0
    return _cyl(name,loc,r1,r2,depth,key,rot,seg,bev,finish)
geo['bevel']=production_bevel; geo['cyl']=production_cyl
geo['build']()
bpy.context.view_layer.update()

MATS = {}
for key, rough in [('foam', 0.76), ('plush', 0.97), ('gloss', 0.36)]:
    mat = bpy.data.materials.new('Playroom ' + key); mat.use_nodes = True
    bs = mat.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (1, 1, 1, 1)
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = 0
    col = mat.node_tree.nodes.new('ShaderNodeVertexColor'); col.layer_name = 'Col'
    mat.node_tree.links.new(col.outputs['Color'], bs.inputs['Base Color'])
    MATS[key] = mat

export_coll = bpy.data.collections.new('Playroom kit exact export meshes')
sc.collection.children.link(export_coll)
parts_by_id = {}; reports = {}
golden = math.pi * (3 - math.sqrt(5))
RAYS = [(math.sqrt((i + 0.5) / 24) * math.cos(i * golden), math.sqrt((i + 0.5) / 24) * math.sin(i * golden), math.sqrt(1 - (i + 0.5) / 24)) for i in range(24)]

for prop in geo['PROPS']:
    editable = bpy.data.collections['PK ' + prop]
    dg = bpy.context.evaluated_depsgraph_get()
    parts = []
    for ob in list(editable.objects):
        old = ob.data.materials[0]
        spec = {'name': ob.get('blockout_part', ob.name), 'hex': old['palette_hex'], 'finish': old['finish']}
        # Evaluate bevels and weighted normals once, then bake all transforms.
        me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
        me.transform(ob.matrix_world)
        cp = bpy.data.objects.new(spec['name'], me); export_coll.objects.link(cp)
        me.materials.clear(); me.materials.append(MATS[spec['finish']])
        parts.append((cp, spec))
    points = [v.co for cp, _ in parts for v in cp.data.vertices]
    lo = Vector([min(v[k] for v in points) for k in range(3)])
    hi = Vector([max(v[k] for v in points) for k in range(3)])
    offset = Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))
    for cp, _ in parts: cp.data.transform(Matrix.Translation(offset))
    # Mild baked contact shading: deterministic cosine hemisphere rays, never black.
    verts = []; faces = []
    for cp, _ in parts:
        start = len(verts); verts.extend(tuple(v.co) for v in cp.data.vertices)
        faces.extend(tuple(start + i for i in p.vertices) for p in cp.data.polygons)
    start = len(verts); verts.extend([(-30,-30,0),(30,-30,0),(30,30,0),(-30,30,0)]); faces.append(tuple(start+i for i in range(4)))
    bvh = BVHTree.FromPolygons(verts, faces)
    per_part = []
    for cp, spec in parts:
        me = cp.data; attr = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
        h = spec['hex'].lstrip('#'); rgb = Vector([int(h[k:k+2],16)/255 for k in (0,2,4)])
        seed = zlib.crc32(spec['name'].encode()) % 1024
        reach = 0.18 if prop != 'toy-bus-garage' else 0.24
        for v in me.vertices:
            n = v.normal.normalized(); t = n.orthogonal().normalized(); bit = n.cross(t)
            origin = v.co + n * 0.0025; occ = 0
            for dx,dy,dz in RAYS:
                hit = bvh.ray_cast(origin, t*dx+bit*dy+n*dz, reach)
                if hit[0] is not None: occ += 1-(hit[3]/reach)**2
            shade = 1-0.22*occ/len(RAYS)
            grain = 1+0.015*noise.noise(v.co*7+Vector((seed,seed*.7,seed*.3)))
            color = [min(1,max(0,c*shade*grain)) for c in rgb]
            attr.data[v.index].color_srgb = (*color,1)
        me.color_attributes.active_color = attr; me.color_attributes.render_color_index = 0
        me.calc_loop_triangles()
        per_part.append({**spec, 'triangles': len(me.loop_triangles)})
    # Preserve the evaluated, coloured parts as the editable production master.
    production = bpy.data.collections.new(prop + ' production parts (editable)'); sc.collection.children.link(production)
    for cp, _ in parts:
        saved = cp.copy(); saved.data = cp.data.copy(); production.objects.link(saved)
    production.hide_viewport = True; production.hide_render = True
    editable.hide_viewport = True; editable.hide_render = True
    bpy.ops.object.select_all(action='DESELECT')
    for cp, _ in parts: cp.select_set(True)
    bpy.context.view_layer.objects.active = parts[0][0]; bpy.ops.object.join()
    ob = bpy.context.object; ob.name = prop; ob.data.name = prop + ' exact export mesh'
    for key in list(ob.keys()): del ob[key]
    ob.data.calc_loop_triangles()
    p = [v.co for v in ob.data.vertices]
    lo = [min(v[k] for v in p) for k in range(3)]; hi = [max(v[k] for v in p) for k in range(3)]
    reports[prop] = {'triangles':len(ob.data.loop_triangles),'materials':len(ob.data.materials),'parts':per_part,
        'bbox':{'min':[lo[0],lo[2],-hi[1]],'max':[hi[0],hi[2],-lo[1]]},'centering_offset_blender':list(offset)}
    assert reports[prop]['triangles'] <= 5000, (prop,reports[prop]['triangles'])
    parts_by_id[prop] = ob

sc['work_order']='WO111'; sc['asset_id']='playroom-kit'; sc['asset_version']='v001'
sc['source_reference']='Coordinator-approved Blender reference sheet, Sept 29; no generated concept'
sc['candidate_status']="WO111 playroom-kit v001 · Awaiting Tom's review · used in the family release"
sc['orientation']='glTF +Y up, front +Z, identity floor-centred prop roots'
for stale in ['source_sheet_sha256','source_blockout_sha256','role']: sc.pop(stale,None)
for prop,ob in parts_by_id.items():
    stash={k:sc[k] for k in list(sc.keys()) if not k.startswith('cycles')}
    try:
        for k in stash: del sc[k]
        for k in ['work_order','asset_id','asset_version','source_reference','candidate_status','orientation']: sc[k]=stash[k]
        sc['prop_id']=prop
        bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active=ob
        bpy.ops.export_scene.gltf(filepath=str(ROOT/(prop+'.glb')),export_format='GLB',use_selection=True,export_yup=True,
            export_apply=False,export_animations=False,export_skins=False,export_morph=False,export_texcoords=False,
            export_normals=True,export_tangents=False,export_materials='EXPORT',export_vertex_color='ACTIVE',
            export_all_vertex_colors=False,export_cameras=False,export_lights=False,export_extras=True)
    finally:
        for k in list(sc.keys()):
            if not k.startswith('cycles'): del sc[k]
        for k,v in stash.items(): sc[k]=v
    f=ROOT/(prop+'.glb'); reports[prop].update(bytes=f.stat().st_size,sha256=hashlib.sha256(f.read_bytes()).hexdigest())

# Keep exact export meshes at identity; toggle the per-prop collections when opening the master.
for prop,ob in parts_by_id.items(): ob.select_set(False)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'playroom-kit.blend'),compress=True)
(ROOT/'construction.json').write_text(json.dumps({'asset_id':'playroom-kit','version':'v001','work_order':'WO111',
    'authoring_model':'gpt-6-astra max','approved_sheet_preserved':True,'owner_review':'pending',
    'method':'Parametric production topology from approved blockout; 24-ray mild baked contact shading and vertex colours; opaque nonmetallic PBR',
    'props':reports},indent=2)+'\n')
print(json.dumps({p:{k:v for k,v in r.items() if k!='parts'} for p,r in reports.items()}))
