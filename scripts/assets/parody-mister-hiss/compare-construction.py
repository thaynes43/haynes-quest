"""Verify every named editable source vertex survives GLB export with its bone."""
import bpy, json, hashlib
from pathlib import Path
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree

ROOT=Path('/workspace/haynes-quest/parody/mister-hiss/v001')
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'mister-hiss.blend'))
source=[]
for ob in bpy.data.collections['Editable named construction | excluded from export'].objects:
    source.append({'name':ob.name,'bone':ob['rigid_weight'],'vertices':[ob.matrix_world@v.co for v in ob.data.vertices]})
head=next(p for p in source if p['name']=='Head | broad cuboid core')['vertices']
hat=next(p for p in source if p['name']=='Hat | rolled plum brim')['vertices']
head_top=max(p.z for p in head)
inside_hat=[p for p in hat if abs(p.x)<max(v.x for v in head)-.015 and abs(p.y)<max(v.y for v in head)-.015]
hat_contact={'head_core_top_m':head_top,'brim_lowest_inside_head_xy_m':min(p.z for p in inside_hat),
    'physical_overlap_m':head_top-min(p.z for p in inside_hat),
    'hat_parent_joint':bpy.data.objects['mister-hiss_rig'].data.bones['hat'].parent.name}
def bvh(name):
    ob=bpy.data.objects[name]
    return BVHTree.FromPolygons([ob.matrix_world@v.co for v in ob.data.vertices],[list(p.vertices) for p in ob.data.polygons])
body=bvh('Torso | tall narrow armless paper core');belt=bvh('Sash | continuous diagonal plum wrap front sides back')
sash_contacts=[]
for suffix in ['L','R']:
    name='Sash | concealed glued fastening tab '+suffix;tab=bvh(name)
    sash_contacts.append({'name':name,'torso_surface_intersections':len(tab.overlap(body)),'sash_surface_intersections':len(tab.overlap(belt))})
sash_canister_intersections=len(belt.overlap(bvh('Popper | strapped printed plum canister')))
for ob in list(bpy.data.objects):bpy.data.objects.remove(ob,do_unlink=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'mister-hiss.glb'))
by_bone={};weights=[]
for ob in bpy.context.scene.objects:
    # The importer also creates a 42-vertex armature display shape; it is not
    # runtime character geometry and deliberately carries no skin weights.
    if ob.type!='MESH' or not any(m.type=='ARMATURE' for m in ob.modifiers):continue
    for v in ob.data.vertices:
        influences=[(ob.vertex_groups[g.group].name,g.weight) for g in v.groups if g.weight>0]
        weights.append(influences)
        for bn,weight in influences:by_bone.setdefault(bn,[]).append(ob.matrix_world@v.co)
trees={}
for name,points in by_bone.items():
    tree=KDTree(len(points))
    for i,point in enumerate(points):tree.insert(point,i)
    tree.balance();trees[name]=tree
parts=[]
for part in source:
    errors=[trees[part['bone']].find(point)[2] for point in part['vertices']]
    parts.append({'name':part['name'],'bone':part['bone'],'vertices':len(errors),'maximum_export_distance_m':max(errors)})
record={'asset_id':'mister-hiss','glb_sha256':hashlib.sha256((ROOT/'mister-hiss.glb').read_bytes()).hexdigest(),
    'method':'Every original named construction vertex matched to actual re-imported GLB coordinates within the same exported rigid bone weight.',
    'named_source_parts':len(parts),'exported_vertices':len(weights),'parts':parts,'hat_contact':hat_contact,
    'sash_fastening_tabs':sash_contacts,'sash_canister_surface_intersections':sash_canister_intersections,
    'checks':{'all_source_parts_survive':len(parts)==359 and all(p['maximum_export_distance_m']<.000001 for p in parts),
        'one_full_weight_per_exported_vertex':all(len(w)==1 and abs(w[0][1]-1)<1e-7 for w in weights),
        'exactly_four_distinct_foot_cores':len([p for p in parts if p['name'].startswith('Foot | ') and 'green cuboid' in p['name']])==4,
        'continuous_sash_and_strapped_canister_on_body':all(next(p for p in parts if p['name']==n)['bone']=='body' for n in ['Sash | continuous diagonal plum wrap front sides back','Popper | strapped printed plum canister']),
        'hat_crown_parented_to_hat_joint':next(p for p in parts if p['name']=='Hat | plum cone with original party print')['bone']=='hat',
        'hat_brim_physically_intersects_head':hat_contact['physical_overlap_m']>.001 and hat_contact['hat_parent_joint']=='head',
        'sash_tabs_physically_connect_to_body':all(c['torso_surface_intersections']>0 and c['sash_surface_intersections']>0 for c in sash_contacts),
        'canister_physically_connects_to_sash':sash_canister_intersections>0}}
(ROOT/'construction-survival.json').write_text(json.dumps(record,indent=2)+'\n')
assert all(record['checks'].values()),record['checks']
print(json.dumps({k:v for k,v in record.items() if k!='parts'}))
