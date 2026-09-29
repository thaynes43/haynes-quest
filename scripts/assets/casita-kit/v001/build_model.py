"""WO111 Casita kit v001: production topology derived from the approved sheet.

Preserves its authored silhouette, palette, feature locations and registry boxes.
Resolution is reduced at primitive construction, never by destructive whole-prop
decimation. Four simple vertex-colour PBR finishes replace the sheet materials.
The master retains individual parts alongside the four joined export meshes.
"""
import bpy, bmesh, math, json, hashlib, datetime, zlib
from pathlib import Path
from mathutils import Vector, Matrix, noise
from mathutils.bvhtree import BVHTree

ROOT = Path('/workspace/haynes-quest/family-eras/casita-kit/v001')
OWNER = 'gpt-6-astra/casita-kit-props'
sc = bpy.context.scene
assert sc.get('scene_owner') == OWNER and sc.get('scene_lease') == 'active'
# Preserve the reference source; production replaces sampling and paint geometry.
src = (ROOT / 'source/reference_blockout.py').read_text()
src = src.replace(', 0.2, 3)', ', 0.2, 1)').replace(', 0.3, 3)', ', 0.3, 1)')
src = src.replace('u_segments=12, v_segments=8', 'u_segments=6, v_segments=3')
src = src.replace('u_segments=10, v_segments=6', 'u_segments=6, v_segments=3')
src = src.replace('u_segments=8, v_segments=5', 'u_segments=4, v_segments=3')
geo = {'__name__': 'reference_geometry'}
exec(compile(src, str(ROOT / 'source/reference_blockout.py'), 'exec'), geo)

def cap_function(name, caps):
    import inspect
    original = geo[name]; signature = inspect.signature(original)
    def wrapped(*args, **kwargs):
        call = signature.bind(*args, **kwargs); call.apply_defaults()
        for key, maximum in caps.items(): call.arguments[key] = min(call.arguments[key], maximum)
        return original(*call.args, **call.kwargs)
    geo[name] = wrapped

for name, caps in [('bevel', {'seg':1}),('cyl',{'seg':10}),('rod',{'seg':6}),
    ('ellipsoid',{'seg':8,'rings':4}),('half_ellipsoid',{'seg':16,'rings':6}),
    ('lathe',{'seg':24}),('arc',{'n':12}),('rrect',{'n':1}),
    ('circle',{'n':6}),('arch_outline',{'n':12}),('arch_ring',{'n':12}),
    ('balls',{'seg':6,'rings':3}),('cones',{'seg':8})]: cap_function(name,caps)

_bevel=geo['bevel']; _sweep=geo['sweep']; _bougain=geo['bougainvillea']; _balls=geo['balls']
def production_bevel(ob,w,seg=3,angle=30):
    name=ob.get('blockout_part','')
    keep=('Stucco body','End pilaster','Post shaft','Post cap','Clay step','Stucco surround','Door leaf')
    return _bevel(ob,w,1,angle) if name.startswith(keep) else ob

def production_sweep(name,pts,r,key,n=16,closed=False,finish='matte'):
    points=list(pts); cap=32 if name=='Twisting tendril' else 20
    if name=='Glow trim':
        # Keep straight jamb endpoints and the full rounded head.
        points=[points[0],points[34]]+points[35:66:3]+[points[65],points[66],points[-1]]
    elif len(points)>cap:
        count=cap if closed else cap-1
        points=[points[round(i*(len(points)-1)/count)] for i in range(cap)]
    return _sweep(name,points,r,key,n=min(n,4 if name=='Twisting tendril' else 6),closed=closed,finish=finish)

def production_leaves(name,items,key='leaf',ink=False):
    # Closed pointed leaves: six vertices/eight faces retain thickness from above.
    bm=bmesh.new()
    if name.startswith('Foot bush leaves'):items=items[::2]
    for c,d,up,L,w,t in items:
        F=geo['frame'](d,up,c)
        pts=[(0,-L/2,0),(-w/2,0,0),(0,L/2,0),(w/2,0,0),(0,0,t/2),(0,0,-t/2)]
        vs=[bm.verts.new(F @ Vector(p)) for p in pts]
        for i in range(4):
            bm.faces.new((vs[i],vs[(i+1)%4],vs[4]))
            bm.faces.new((vs[(i+1)%4],vs[i],vs[5]))
    return geo['finish_bm'](name,bm,key,smooth=True)

def production_decals(name,items,thick,key,finish='glaze',ink=False):
    # Painted tile motifs are front faces, not hidden six-sided solids.
    if not items:return None
    bm=bmesh.new()
    for pts,n,c,up in items:
        F=geo['frame'](-Vector(n),up,Vector(c)); normal=Vector(n).normalized()
        vs=[bm.verts.new(F @ Vector((u,-thick,v))) for u,v in pts]
        face=bm.faces.new(vs);face.normal_update()
        if face.normal.dot(normal)<0:face.normal_flip()
    return geo['finish_bm'](name,bm,key,finish,smooth=False)

def production_bougainvillea(tag,path,rng,lean=(0,-1,0),leaf_len=0.075,bloom_r=0.036,per=(4,3),stem_r=0.016,y_min=None,z_max=None,bloom='bloom'):
    return _bougain(tag,path,rng,lean=lean,leaf_len=leaf_len,bloom_r=bloom_r,per=(2,1),stem_r=stem_r,y_min=y_min,z_max=z_max,bloom=bloom)

def production_balls(name,items,key,seg=10,rings=6,finish='matte',ink=False):
    if name!='Marigold pompoms':
        if not any(t in name.lower() for t in ['bloom','center','centre']):
            return _balls(name,items,key,seg=seg,rings=rings,finish=finish,ink=ink)
        bm=bmesh.new()
        for c,s in items:
            c=Vector(c)
            vs=[bm.verts.new(c+Vector(p)) for p in [(s[0],0,0),(0,s[1],0),(-s[0],0,0),(0,-s[1],0),(0,0,s[2]),(0,0,-s[2])]]
            for j in range(4):
                bm.faces.new((vs[j],vs[(j+1)%4],vs[4]));bm.faces.new((vs[(j+1)%4],vs[j],vs[5]))
        return geo['finish_bm'](name,bm,key,finish,smooth=True)
    # Coordinator refinement: six distinct orange petals and a darker center.
    # Low domed petals face the chase camera from above; the head envelope stays
    # within the original orange bloom radius and below the fixed 0.90 m cap.
    bm=bmesh.new(); centers=[]
    for c,s in items:
        c=Vector(c); normal=Vector((c.x*1.6,c.y*1.6,1)).normalized()
        F=geo['frame'](normal,(0,1,0),c)
        for k in range(6):
            a=math.tau*k/6; radial=Vector((math.cos(a),0,math.sin(a)))
            tangent=Vector((-math.sin(a),0,math.cos(a)))
            p=c+F.to_3x3() @ (radial*s[0]*0.55)
            direction=F.to_3x3() @ radial; across=F.to_3x3() @ tangent
            vs=[bm.verts.new(p+direction*x+across*y+normal*z) for x,y,z in
                [(-s[0]*.42,0,0),(0,-s[0]*.28,0),(s[0]*.42,0,0),(0,s[0]*.28,0),(0,0,s[2]*.28),(0,0,-s[2]*.09)]]
            for j in range(4):
                bm.faces.new((vs[j],vs[(j+1)%4],vs[4]));bm.faces.new((vs[(j+1)%4],vs[j],vs[5]))
        centers.append((tuple(c+normal*s[2]*.18),(s[0]*.28,s[0]*.28,s[2]*.24)))
    ob=geo['finish_bm']('Orange six-petal marigolds',bm,'marigold',smooth=True)
    production_balls('Marigold warm centers',centers,'clay',seg=6,rings=3)
    return ob

def production_butterfly(tag,centre,span,wing='gold',edge='plum',facing=(0,-1,0),up=(0,0,1),dihedral=0.0,t=0.01,spots='cream'):
    hs=span/2;F=geo['frame'](-Vector(facing),up,Vector(centre));bm_e=bmesh.new();bm_w=bmesh.new();bm_s=bmesh.new()
    large=span>=0.5
    fore=geo['FOREWING'] if large else [(0.04,.02),(.2,.34),(.52,.58),(.98,.66),(.9,.4),(.74,.14),(.4,0)]
    hind=geo['HINDWING'] if large else [(.04,-.02),(.44,-.02),(.7,-.16),(.64,-.42),(.4,-.56),(.18,-.5),(.05,-.24)]
    for sign in (1,-1):
        M=F @ Matrix.Rotation(sign*dihedral,4,'Z')
        for points,factor in [(fore,.74),(hind,.7)]:
            geo['add_prism'](bm_e,[(sign*u*hs,v*hs) for u,v in points],-t,0,M)
            face=bm_w.faces.new([bm_w.verts.new(M @ Vector((sign*u*hs,-t*1.01,v*hs))) for u,v in geo['inset'](points,factor)])
            face.normal_update()
            if face.normal.dot(M.to_3x3() @ Vector((0,-1,0)))<0:face.normal_flip()
        for cu,cv,rr in geo['BORDER_DOTS']:
            pts=geo['circle'](rr*hs,4,sign*cu*hs,cv*hs)
            face=bm_s.faces.new([bm_s.verts.new(M @ Vector((u,-t*1.02,v))) for u,v in pts]);face.normal_update()
            if face.normal.dot(M.to_3x3() @ Vector((0,-1,0)))<0:face.normal_flip()
    geo['finish_bm'](tag+' wing edges',bm_e,edge,smooth=False)
    geo['finish_bm'](tag+' wings',bm_w,wing,smooth=False)
    geo['finish_bm'](tag+' wing spots',bm_s,spots,smooth=False)
    U=Vector(up).normalized();normal=Vector(facing).normalized();C=Vector(centre)+normal*t*1.2
    geo['rod'](tag+' body',C-U*.21*hs,C+U*.31*hs,.065*hs,.05*hs,'plum',seg=6)
    head=C+U*.38*hs;X=U.cross(-normal).normalized()
    production_balls(tag+' head bloom',[(tuple(head),(.085*hs,)*3)],'plum')
    for sign in (1,-1):
        tip=head+U*.24*hs+X*sign*.16*hs
        geo['rod'](tag+' antenna '+str(sign),head,tip,.014*hs,.01*hs,'plum',seg=4)

geo.update(bevel=production_bevel,sweep=production_sweep,leaves=production_leaves,
           decals=production_decals,bougainvillea=production_bougainvillea,balls=production_balls,butterfly=production_butterfly)
geo['build']()
bpy.context.view_layer.update()

MATS = {}
for key, rough in [('matte',0.83), ('satin',0.5), ('gloss',0.26), ('lamp',0.36)]:
    mat=bpy.data.materials.new('Casita '+key);mat.use_nodes=True
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
    return {'matte':'matte','glaze':'satin','gloss':'gloss','flame':'lamp'}[finish]

export_coll = bpy.data.collections.new('Casita kit exact export meshes')
sc.collection.children.link(export_coll)
parts_by_id = {}; reports = {}
golden = math.pi * (3 - math.sqrt(5))
RAYS = [(math.sqrt((i + 0.5) / 24) * math.cos(i * golden), math.sqrt((i + 0.5) / 24) * math.sin(i * golden), math.sqrt(1 - (i + 0.5) / 24)) for i in range(24)]

for prop in geo['PROPS']:
    editable = bpy.data.collections['CK ' + prop]
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
        reach=0.14
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
    # All budgets are asserted together after recording per-part costs.
    parts_by_id[prop] = ob

(ROOT/'topology-budget.json').write_text(json.dumps(reports,indent=2)+'\n')
assert all(r['triangles']<=5000 for r in reports.values()), {p:r['triangles'] for p,r in reports.items()}

sc['work_order']='WO111'; sc['asset_id']='casita-kit'; sc['asset_version']='v001'
sc['source_reference']='Coordinator-approved Blender reference sheet e27e71967202f35f738c3df6ff1cc8b99cbe8fedf0584e448b82462ea86c5d07, Sept 29; no generated concept'
sc['candidate_status']="WO111 casita-kit v001 · Awaiting Tom's review · used in the family release"
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
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'casita-kit.blend'),compress=True)
(ROOT/'construction.json').write_text(json.dumps({'asset_id':'casita-kit','version':'v001','work_order':'WO111',
    'authoring_model':'gpt-6-astra max','approved_sheet_preserved':True,'owner_review':'pending',
    'method':'Parametric production topology from approved blockout; 24-ray mild baked contact shading and vertex colours; opaque nonmetallic PBR',
    'props':reports},indent=2)+'\n')
print(json.dumps({p:{k:v for k,v in r.items() if k!='parts'} for p,r in reports.items()}))
