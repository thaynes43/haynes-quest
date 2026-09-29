"""WO142/WO111 production: preserve the approved reference silhouette, export four exact static props.

The editable master retains component geometry and evaluated vertex-colour parts.
There is no destructive decimation, texture dependency, animation or skinning.
"""
import bpy,json,hashlib,sys,math
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
ROOT=Path('/workspace/haynes-quest/family-eras/rooftop-city-kit/v001')
sys.path.insert(0,str(ROOT/'source'))
import common
from design import BOXES
sc=bpy.context.scene
assert sc.get('scene_owner')=='gpt-6-astra/rooftop-city-kit-props' and sc.get('scene_lease')=='active'
source=json.loads((ROOT/'source.json').read_text())
assert source['sheet_coordinator_review']['decision']=='approved'
assert hashlib.sha256((ROOT/'reference-sheet.png').read_bytes()).hexdigest()==source['reference_sheet_sha256']

mats={}
for key,rough in [('timber',.84),('equipment',.68)]:
    m=bpy.data.materials.new('Rooftop City '+key);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(1,1,1,1)
    bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=0
    vc=m.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Col'
    m.node_tree.links.new(vc.outputs['Color'],bs.inputs['Base Color']);mats[key]=m

exports=bpy.data.collections.new('Rooftop City exact exports');sc.collection.children.link(exports)
reports={};models={}
for prop in BOXES:
    raw=bpy.data.collections['RC '+prop];dg=bpy.context.evaluated_depsgraph_get();parts=[]
    for ob in raw.objects:
        me=bpy.data.meshes.new_from_object(ob.evaluated_get(dg),preserve_all_data_layers=True,depsgraph=dg)
        me.transform(ob.matrix_world)
        cp=bpy.data.objects.new(ob.name,me);exports.objects.link(cp)
        parts.append((cp,ob.get('palette','steel')))
    points=[v.co for ob,_ in parts for v in ob.data.vertices]
    lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)])
    shift=Vector((-(lo.x+hi.x)/2,-(lo.y+hi.y)/2,-lo.z))
    for ob,_ in parts:ob.data.transform(Matrix.Translation(shift))
    # Mild deterministic vertex contact shading; keep darkest creases readable.
    verts=[];faces=[]
    for ob,_ in parts:
        n=len(verts);verts.extend(tuple(v.co) for v in ob.data.vertices)
        faces.extend(tuple(n+i for i in p.vertices) for p in ob.data.polygons)
    bvh=BVHTree.FromPolygons(verts,faces)
    rays=[];golden=math.pi*(3-math.sqrt(5))
    for i in range(12):
        rr=math.sqrt((i+.5)/12);rays.append((rr*math.cos(i*golden),rr*math.sin(i*golden),math.sqrt(1-rr*rr)))
    details=[]
    for ob,key in parts:
        me=ob.data;col=me.color_attributes.new('Col','BYTE_COLOR','CORNER');shades={}
        rgb=common.linear(common.PALETTE[key])[:3]
        for v in me.vertices:
            n=v.normal.normalized();t=n.orthogonal().normalized();bt=n.cross(t)
            hits=0
            for a,b,c in rays:
                if bvh.ray_cast(v.co+n*.003,t*a+bt*b+n*c,.15)[0] is not None:hits+=1
            shades[v.index]=1-.12*hits/len(rays)
        for p in me.polygons:
            for li in p.loop_indices:
                shade=shades[me.loops[li].vertex_index]
                col.data[li].color=tuple(c*shade for c in rgb)+(1,)
            p.material_index=0
        me.materials.clear();me.materials.append(mats['timber' if 'wood' in key else 'equipment'])
        me.color_attributes.active_color=col;me.color_attributes.render_color_index=0
        me.calc_loop_triangles();details.append({'part':ob.name,'palette':key,'triangles':len(me.loop_triangles)})
    editable=bpy.data.collections.new(prop+' evaluated editable parts');sc.collection.children.link(editable)
    for ob,_ in parts:
        cp=ob.copy();cp.data=ob.data.copy();editable.objects.link(cp)
    editable.hide_render=True;editable.hide_viewport=True;raw.hide_render=True;raw.hide_viewport=True
    bpy.ops.object.select_all(action='DESELECT')
    for ob,_ in parts:ob.select_set(True)
    bpy.context.view_layer.objects.active=parts[0][0];bpy.ops.object.join();ob=bpy.context.object
    ob.name=prop;ob.data.name=prop+' exact mesh'
    for k in list(ob.keys()):del ob[k]
    ob.data.calc_loop_triangles();points=[v.co for v in ob.data.vertices]
    low=[min(v[k] for v in points) for k in range(3)];high=[max(v[k] for v in points) for k in range(3)]
    ntri=len(ob.data.loop_triangles);assert ntri<=5000,(prop,ntri)
    reports[prop]={'triangles':ntri,'materials':len(ob.data.materials),'parts':details,
        'bbox':{'min':[low[0],low[2],-high[1]],'max':[high[0],high[2],-low[1]]},'centering_shift':list(shift)}
    models[prop]=ob

metadata={'work_order':'WO111','delivery_work_order':'WO142','asset_id':'rooftop-city-kit','asset_version':'v001',
    'source_reference':'Coordinator-approved Blender reference sheet, September 29, 2026; no generated concept',
    'reference_sheet_sha256':source['reference_sheet_sha256'],
    'candidate_status':"WO111 rooftop-city-kit v001 · Awaiting Tom's review · used in the family release",
    'orientation':'glTF +Y up, front +Z, floor-centred identity roots'}
for k,v in metadata.items():sc[k]=v
for prop,ob in models.items():
    stash={k:sc[k] for k in list(sc.keys()) if not k.startswith('cycles')}
    try:
        for k in stash:del sc[k]
        for k,v in metadata.items():sc[k]=v
        sc['prop_id']=prop
        bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
        bpy.ops.export_scene.gltf(filepath=str(ROOT/(prop+'.glb')),export_format='GLB',use_selection=True,export_yup=True,
            export_apply=False,export_animations=False,export_skins=False,export_morph=False,export_texcoords=False,
            export_normals=True,export_tangents=False,export_materials='EXPORT',export_vertex_color='ACTIVE',
            export_all_vertex_colors=False,export_cameras=False,export_lights=False,export_extras=True)
    finally:
        for k in list(sc.keys()):
            if not k.startswith('cycles'):del sc[k]
        for k,v in stash.items():sc[k]=v
    p=ROOT/(prop+'.glb');reports[prop].update(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'rooftop-city-kit.blend'),compress=True)
(ROOT/'construction.json').write_text(json.dumps({'work_order':'WO111','delivery_work_order':'WO142','asset_id':'rooftop-city-kit','version':'v001',
    'authoring_model':'gpt-6-astra max','sheet_sha256':source['reference_sheet_sha256'],'owner_review':'pending',
    'method':'Approved component geometry preserved; opaque vertex colours with mild 12-ray contact shading; no decimation or external resources',
    'props':reports},indent=2)+'\n')
print(json.dumps({p:{k:v for k,v in r.items() if k!='parts'} for p,r in reports.items()}))
