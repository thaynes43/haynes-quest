"""Actual reimported pair-surface checks at the intended missed-high-five pose."""
from pathlib import Path
import bpy,json,hashlib,sys
from mathutils.bvhtree import BVHTree
sys.path.insert(0,str(Path(__file__).resolve().parent))
import render as R
ROOT=Path(__file__).resolve().parent

def surface(arm,hand_only=False):
    points=[];faces=[];deps=bpy.context.evaluated_depsgraph_get()
    hand='hand_R' if arm['asset_id']=='bestie-pink' else 'hand_L'
    for ob in bpy.context.scene.objects:
        if ob.type!='MESH' or not any(m.type=='ARMATURE' and m.object==arm for m in ob.modifiers):continue
        allowed=set()
        for vertex in ob.data.vertices:
            if not hand_only or any(ob.vertex_groups[g.group].name==hand and g.weight>.999 for g in vertex.groups):allowed.add(vertex.index)
        evaluated=ob.evaluated_get(deps);mesh=evaluated.to_mesh();offset=len(points)
        points.extend(evaluated.matrix_world@v.co for v in mesh.vertices)
        faces.extend(tuple(offset+i for i in p.vertices) for p in mesh.polygons if all(i in allowed for i in p.vertices))
        evaluated.to_mesh_clear()
    return points,faces,BVHTree.FromPolygons(points,faces,all_triangles=False,epsilon=.000001)

def main():
    R.clear();bpy.context.scene.render.fps=30;arms=[]
    for name,x in [('bestie-pink',-.45),('bestie-black',.45)]:
        arm=R.load(ROOT/name/(name+'.glb'));arm.location.x=x;arm['asset_id']=name;arms.append(arm)
    samples=[]
    for time in [.85,1.0,1.15]:
        for arm in arms:R.set_pose(arm,'high-five',time*30)
        a,b=[surface(arm,True) for arm in arms];all_a,all_b=[surface(arm) for arm in arms]
        indices=set(i for face in a[1] for i in face);distance=min(b[2].find_nearest(a[0][i])[3] for i in indices)
        samples.append({'time_s':time,'hand_surface_intersections':len(a[2].overlap(b[2])),'closest_hand_vertex_to_other_surface_m':distance,'whole_pair_surface_intersections':len(all_a[2].overlap(all_b[2]))})
    report={'work_order':'WO051','source':'exact reimported GLBs','glb_sha256':{name:hashlib.sha256((ROOT/name/(name+'.glb')).read_bytes()).hexdigest() for name in ['bestie-pink','bestie-black']},'centre_spacing_m':.9,'no_added_depth_offset':True,'samples':samples,'checks':{'both_hands_visibly_miss':all(s['hand_surface_intersections']==0 and s['closest_hand_vertex_to_other_surface_m']>.005 for s in samples),'no_pair_surface_intersections':all(s['whole_pair_surface_intersections']==0 for s in samples)}}
    (ROOT/'pair-inspection.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));assert all(report['checks'].values())

if __name__=='__main__':main()
