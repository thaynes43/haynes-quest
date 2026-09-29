"""WO111 Rescue Harbor kit v001: production topology derived from the approved sheet.

Preserves its authored silhouette, palette, feature locations and registry boxes.
Resolution is reduced at primitive construction, never by destructive whole-prop
decimation. Four simple vertex-colour PBR finishes replace the sheet materials.
The master retains individual parts alongside the four joined export meshes.
"""
import bpy, bmesh, math, json, hashlib, datetime, zlib
from pathlib import Path
from mathutils import Vector, Matrix, noise
from mathutils.bvhtree import BVHTree

ROOT = Path('/workspace/haynes-quest/family-eras/rescue-harbor-kit/v001')
OWNER = 'gpt-6-astra/rescue-harbor-kit-props'
sc = bpy.context.scene
assert sc.get('scene_owner') == OWNER and sc.get('scene_lease') == 'active'
src = (ROOT / 'source/reference_blockout.py').read_text()
# Production curves retain authored feature positions while reducing their sampling.
src = src.replace('N_ST, N_SEC = 84, 14', 'N_ST, N_SEC = 22, 6')
src = src.replace("for k in range(2):\n        sweep(f'Foredeck", "for k in range(1):\n        sweep(f'Foredeck")
src = src.replace('range(128)', 'range(32)').replace('i / 128', 'i / 32')
src = src.replace('i / 60 for i in range(61)', 'i / 22 for i in range(23)')
src = src.replace('i / 64', 'i / 24').replace('range(65)', 'range(25)')
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

for name, caps in [
    ('bevel', {'seg': 1}), ('cyl', {'seg': 16}), ('rod', {'seg': 10}),
    ('ellipsoid', {'seg': 10, 'rings': 6}), ('half_ellipsoid', {'seg': 16, 'rings': 8}),
    ('lathe', {'seg': 20}), ('arc', {'n': 12}), ('rrect', {'n': 2}),
    ('bone', {'n': 28}), ('circle', {'n': 12}), ('soften', {'n': 1}),
    ('wavy_band', {'n': 32}), ('catmull', {'per': 2}), ('ring_segments', {'per': 3}),
]: clamp_function(name, caps)
# Most timber, posts and thin frames keep square cross-sections. One chamfer on
# the broad silhouettes catches light without spending triangles on unseen edges.
_bevel = geo['bevel']; _sweep = geo['sweep']; _rod = geo['rod']
def production_bevel(ob, w, seg=3, angle=30):
    name = ob.get('blockout_part', '')
    keep = ('Stone footing','Cabin walls','Deck fascia','Roof fascia','Timber piling',
            'Bollard base','Header board','Header top','Post left','Post right','Post wet',
            'Motor cowl','Thwart','Bone sign','Header bone')
    return _bevel(ob, w, 1, angle) if name.startswith(keep) else ob

def production_sweep(name, pts, r, key, n=20, closed=False, finish='paint'):
    # Keep the entire door arch; straight roof ribs need only their endpoints.
    points=list(pts)
    cap = 48 if name=='Fender collar' else 24
    if 'clip' in name: cap=10
    if 'Hip rib' in name: cap=2
    if len(points)>cap:
        idx=[round(i*(len(points)-1)/(cap-1)) for i in range(cap)]
        points=[points[i] for i in idx]
    return _sweep(name, points, r, key, n=min(n,8 if name=='Fender collar' or 'segment' in name else 6), closed=closed, finish=finish)

def production_rod(name,a,b,r1,r2,key,seg=40,bev=0.004,finish='paint'):
    return _rod(name,a,b,r1,r2,key,seg=min(seg,6 if name.startswith(('Ladder','Rail','Tripod')) else 12),bev=0,finish=finish)
_ring=geo['ring_segments']
def production_ring(name,c,u,v,R,r,cols,nseg=8,per=10,finish='paint'):
    return _ring(name,c,u,v,R,r,cols,nseg=nseg,per=2 if geo['CUR']['prop']=='small-boat' else 3,finish=finish)
geo['bevel']=production_bevel; geo['sweep']=production_sweep; geo['rod']=production_rod; geo['ring_segments']=production_ring
geo['build']()
bpy.context.view_layer.update()

MATS = {}
for key, rough in [('matte',0.83), ('satin',0.5), ('gloss',0.26), ('lamp',0.36)]:
    mat=bpy.data.materials.new('Rescue Harbor '+key);mat.use_nodes=True
    bs=mat.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(1,1,1,1)
    bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=0
    col=mat.node_tree.nodes.new('ShaderNodeVertexColor');col.layer_name='Col'
    mat.node_tree.links.new(col.outputs['Color'],bs.inputs['Base Color'])
    if key=='lamp':
        bs.inputs['Emission Color'].default_value=(1.0,0.65,0.16,1)
        bs.inputs['Emission Strength'].default_value=0.18
    MATS[key]=mat

def finish_group(finish):
    return 'matte' if finish in ('wood','rope','stone') else 'satin' if finish in ('paint','iron') else finish

export_coll = bpy.data.collections.new('Rescue Harbor kit exact export meshes')
sc.collection.children.link(export_coll)
parts_by_id = {}; reports = {}
golden = math.pi * (3 - math.sqrt(5))
RAYS = [(math.sqrt((i + 0.5) / 24) * math.cos(i * golden), math.sqrt((i + 0.5) / 24) * math.sin(i * golden), math.sqrt(1 - (i + 0.5) / 24)) for i in range(24)]

for prop in geo['PROPS']:
    editable = bpy.data.collections['RH ' + prop]
    dg = bpy.context.evaluated_depsgraph_get()
    parts = []
    for ob in list(editable.objects):
        specs=[{'hex':m['palette_hex'],'finish':finish_group(m['finish'])} for m in ob.data.materials]
        spec={'name':ob.get('blockout_part',ob.name),'colours':specs}
        # Evaluate geometry once, retaining hull face palette boundaries.
        me=bpy.data.meshes.new_from_object(ob.evaluated_get(dg),preserve_all_data_layers=True,depsgraph=dg)
        me.transform(ob.matrix_world)
        cp=bpy.data.objects.new(spec['name'],me);export_coll.objects.link(cp)
        parts.append((cp,spec))
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
        me=cp.data; attr=me.color_attributes.new('Col','BYTE_COLOR','CORNER')
        seed=zlib.crc32(spec['name'].encode())%1024
        reach=0.22 if prop=='lookout-tower-facade' else 0.12
        shades={}
        for v in me.vertices:
            n=v.normal.normalized();t=n.orthogonal().normalized();bit=n.cross(t)
            origin=v.co+n*0.0025;occ=0
            for dx,dy,dz in RAYS:
                hit=bvh.ray_cast(origin,t*dx+bit*dy+n*dz,reach)
                if hit[0] is not None:occ+=1-(hit[3]/reach)**2
            shades[v.index]=1-0.19*occ/len(RAYS)
        finishes=[]
        for spec_colour in spec['colours']:
            if spec_colour['finish'] not in finishes:finishes.append(spec_colour['finish'])
        for poly in me.polygons:
            col=spec['colours'][poly.material_index]
            h=col['hex'].lstrip('#');rgb=[int(h[k:k+2],16)/255 for k in (0,2,4)]
            for li in poly.loop_indices:
                vi=me.loops[li].vertex_index
                attr.data[li].color_srgb=(*[max(0,min(1,c*shades[vi])) for c in rgb],1)
            poly.material_index=finishes.index(col['finish'])
        me.materials.clear()
        for finish in finishes:me.materials.append(MATS[finish])
        me.color_attributes.active_color=attr;me.color_attributes.render_color_index=0
        me.calc_loop_triangles()
        per_part.append({**spec,'triangles':len(me.loop_triangles)})
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
    assert reports[prop]['triangles'] <= 5000,(prop,reports[prop]['triangles'])
    parts_by_id[prop] = ob

sc['work_order']='WO111'; sc['asset_id']='rescue-harbor-kit'; sc['asset_version']='v001'
sc['source_reference']='Coordinator-approved Blender reference sheet, Sept 29; no generated concept'
sc['candidate_status']="WO111 rescue-harbor-kit v001 · Awaiting Tom's review · used in the family release"
sc['orientation']='glTF +Y up, front +Z, identity floor-centred prop roots'
for stale in ['source_sheet_sha256','source_blockout_sha256','role','blockout_bounds_m']: sc.pop(stale,None)
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
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'rescue-harbor-kit.blend'),compress=True)
(ROOT/'construction.json').write_text(json.dumps({'asset_id':'rescue-harbor-kit','version':'v001','work_order':'WO111',
    'authoring_model':'gpt-6-astra max','approved_sheet_preserved':True,'owner_review':'pending',
    'method':'Parametric production topology from approved blockout; 24-ray mild baked contact shading and vertex colours; opaque nonmetallic PBR',
    'props':reports},indent=2)+'\n')
print(json.dumps({p:{k:v for k,v in r.items() if k!='parts'} for p,r in reports.items()}))
