"""Exact source-to-export geometry, anatomy and attachment evidence for WO028.

Run in a separate Blender process while the lease is held. Every named source
vertex must survive with the same skin influences. BVH intersections establish
real construction overlap at the major attachment seams; visual review remains
separate from those measurements.
"""
import argparse, bpy, hashlib, json, sys
from pathlib import Path
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree

def main(base,name):
    folder=Path(base)/name;master=folder/(name+'.blend');glb=folder/(name+'.glb')
    bpy.ops.wm.open_mainfile(filepath=str(master));bpy.context.scene.render.fps=40
    collection=bpy.data.collections['Editable named parts | excluded from export']
    source=[]
    for ob in collection.objects:
        vertices=[]
        for v in ob.data.vertices:
            influences={ob.vertex_groups[g.group].name:float(g.weight) for g in v.groups if g.weight>.0000001}
            vertices.append((ob.matrix_world@v.co,influences))
        source.append({'name':ob.name,'vertices':vertices})
    def bvh(n):
        ob=bpy.data.objects[n]
        return BVHTree.FromPolygons([ob.matrix_world@v.co for v in ob.data.vertices],[list(p.vertices) for p in ob.data.polygons])
    if name=='peel-patrol':
        pairs=[
            ('cap contacts banana','Cap | fitted lower band','Banana | continuous tall curved yellow skin'),
            ('stem contacts banana','Banana | brown blunt stem','Banana | continuous tall curved yellow skin'),
            ('whistle pieces are one attached prop','Whistle | single brass barrel','Whistle | attached mouthpiece'),
            ('belt contacts banana','Belt | continuous dark belt','Banana | continuous tall curved yellow skin'),
            ('peel contacts belt loop','Peel | single attached left belt trailing strip','Peel attachment | brass secured loop (0.13, -0.016, 0.358)'),
        ]
        for label,side in [('L',1),('R',-1)]:
            pairs += [
                ('upper flap '+label+' joins banana','Banana | attached upper peel flap '+label,'Banana | continuous tall curved yellow skin'),
                ('vest fastening '+label+' reaches body','Vest | concealed shoulder fastening '+str(side),'Banana | continuous tall curved yellow skin'),
                ('vest fastening '+label+' reaches cloth','Vest | concealed shoulder fastening '+str(side),'Vest | continuous navy back and side panels'),
                ('whistle cord '+label+' reaches barrel','Whistle cord | secured '+label,'Whistle | single brass barrel'),
            ]
    else:
        pairs=[
            ('cardboard crown attached to head','Crown | connected cardboard lower band','Head | oversized square black head'),
            ('three crown points attached to band','Crown | exactly three cardboard points','Crown | connected cardboard lower band'),
            ('ruff collar attached to neck','Ruff | continuous plum inner collar','Neck | connected voxel segment 1'),
            ('ruff back clasp attached to pleat','Ruff | secure back brass clasp','Ruff | broad cloth pleat 06'),
            ('tail base attached to body','Tail | single chain segment 00','Torso | angular black voxel chest'),
        ]
        for label in ['L','R']:
            pairs += [('wing '+label+' joins body','Wing | '+label+' angular opaque membrane','Torso | angular black voxel chest'),
                      ('horn '+label+' joins head','Horn | attached lower '+label,'Head | oversized square black head')]
        for j in range(7):pairs.append(('tail joint %02d'%j,'Tail | single chain segment %02d'%j,'Tail | single chain segment %02d'%(j+1)))
    contacts=[]
    for label,a,b in pairs:
        ba,bb=bvh(a),bvh(b)
        contacts.append({'attachment':label,'parts':[a,b],'intersecting_face_pairs':len(ba.overlap(bb))})
    # Read neutral rest coordinates from the actual delivered export.
    for ob in list(bpy.data.objects):bpy.data.objects.remove(ob,do_unlink=True)
    for action in list(bpy.data.actions):bpy.data.actions.remove(action)
    bpy.ops.import_scene.gltf(filepath=str(glb))
    for arm in [o for o in bpy.data.objects if o.type=='ARMATURE']:
        arm.animation_data.action=None;arm.animation_data.use_nla=False
        for pb in arm.pose.bones:
            pb.location=(0,0,0);pb.rotation_mode='QUATERNION';pb.rotation_quaternion=(1,0,0,0);pb.scale=(1,1,1)
    bpy.context.scene.frame_set(0);bpy.context.view_layer.update()
    grouped={};exported=[]
    for ob in bpy.context.scene.objects:
        if ob.type!='MESH' or not any(m.type=='ARMATURE' for m in ob.modifiers):continue
        for v in ob.data.vertices:
            influences={ob.vertex_groups[g.group].name:float(g.weight) for g in v.groups if g.weight>.0000001}
            entry=(ob.matrix_world@v.co,influences);exported.append(entry)
            grouped.setdefault(tuple(sorted(influences)),[]).append(entry)
    trees={}
    for signature,entries in grouped.items():
        tree=KDTree(len(entries))
        for i,(point,_) in enumerate(entries):tree.insert(point,i)
        tree.balance();trees[signature]=tree
    parts=[]
    for part in source:
        distance=0;weight_error=0;missing=0
        for point,influences in part['vertices']:
            sig=tuple(sorted(influences))
            if sig not in trees:missing+=1;continue
            _,index,delta=trees[sig].find(point);distance=max(distance,delta)
            other=grouped[sig][index][1]
            weight_error=max(weight_error,max(abs(w-other[n]) for n,w in influences.items()))
        parts.append({'name':part['name'],'vertices':len(part['vertices']),'max_export_distance_m':distance,'max_weight_error':weight_error,'missing_influence_sets':missing})
    names=[p['name'] for p in parts]
    checks={
        'every_named_source_vertex_survives':all(p['max_export_distance_m']<.000002 and p['missing_influence_sets']==0 for p in parts),
        'all_source_weights_survive':all(p['max_weight_error']<.00001 for p in parts),
        'normalized_skin_weights':all(abs(sum(w.values())-1)<.00001 for _,w in exported),
        'one_to_four_influences':all(1<=len(w)<=4 for _,w in exported),
        'major_attachment_seams_physically_intersect':all(c['intersecting_face_pairs']>0 for c in contacts),
    }
    if name=='peel-patrol':
        checks.update({
            'exactly_two_upper_arms':sum(n.startswith('Arm | upper ') for n in names)==2,
            'exactly_two_boots':sum(n.startswith('Boot | sole ') for n in names)==2,
            'exactly_one_whistle_barrel':sum(n=='Whistle | single brass barrel' for n in names)==1,
            'exactly_one_left_trailing_peel':sum(n=='Peel | single attached left belt trailing strip' for n in names)==1,
            'four_fingers_per_hand':all(sum(n.startswith('Hand | '+s+' finger ') or n=='Hand | '+s+' thumb' for n in names)==4 for s in ['L','R']),
        })
    else:
        checks.update({
            'exactly_four_distinct_feet':sum(n.startswith('Foot | ') and n.endswith('broad dark foot') for n in names)==4,
            'exactly_two_wing_membranes':sum(n.startswith('Wing | ') and n.endswith('angular opaque membrane') for n in names)==2,
            'one_tail_with_eight_segments':sum(n.startswith('Tail | single chain segment ') for n in names)==8,
            'one_three_point_crown_and_back_clasp':sum(n=='Crown | exactly three cardboard points' for n in names)==1 and sum(n=='Ruff | secure back brass clasp' for n in names)==1,
        })
    record={'asset_id':name,'glb_sha256':hashlib.sha256(glb.read_bytes()).hexdigest(),'master_sha256':hashlib.sha256(master.read_bytes()).hexdigest(),
            'method':'Every source vertex matched to reimported GLB coordinates with equal joint influences; BVH surface intersections at authored seams.',
            'named_source_parts':len(parts),'exported_vertices':len(exported),'parts':parts,'attachment_contacts':contacts,'checks':checks}
    (folder/'construction-survival.json').write_text(json.dumps(record,indent=2)+'\n')
    print(json.dumps({k:v for k,v in record.items() if k not in ['parts']}));assert all(checks.values()),checks

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--base',default='/workspace/haynes-quest/parody/block-party-pair/v001');p.add_argument('--name',required=True)
    args=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []);main(args.base,args.name)
