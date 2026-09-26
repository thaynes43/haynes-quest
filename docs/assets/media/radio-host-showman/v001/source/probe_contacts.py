"""Author helper (not evidence): list where the held-defeat face/collar and halo/tuft overlaps happen (part names, world centres)."""
import bpy,json,importlib.util
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path('/workspace/haynes-quest/family-eras/radio-host-showman/v001')
spec=importlib.util.spec_from_file_location('wo111_rhs_anim',ROOT/'source/animate.py');A=importlib.util.module_from_spec(spec);spec.loader.exec_module(A)
skin=A.skin;arm=A.arm;arm.animation_data.action=None
names=[g.name for g in skin.vertex_groups];dom=[names[max(v.groups,key=lambda g:g.weight).group] for v in skin.data.vertices]
polys=[list(p.vertices) for p in skin.data.polygons]
cons=json.loads((ROOT/'construction.json').read_text());pn=[r['name'] for r in cons['parts']]
part=[0]*len(polys);skin.data.attributes['rhs_part'].data.foreach_get('value',part)
grp=lambda bs:[i for i,vs in enumerate(polys) if sum(dom[v] in bs for v in vs)*2>len(vs)]
face=[i for i in range(len(polys)) if part[i]==pn.index('Showman head with painted grin, teeth and eyes')]
collar=[i for i in range(len(polys)) if part[i] in (pn.index('White shirt collar'),pn.index('Black shawl collar band'))]
halo=grp({'halo'});tips=grp({'tuft_R_2','tuft_L_2'})
c=A.evaluate('defeat',1.0);A.PREV.clear();A.apply(A.build_pose(c));bpy.context.view_layer.update()
dg=bpy.context.evaluated_depsgraph_get();ev=skin.evaluated_get(dg);me=ev.to_mesh();co=[ev.matrix_world@v.co for v in me.vertices]
out={}
for label,a,b in (('face~collar',face,collar),('halo~tips',halo,tips)):
 ta=BVHTree.FromPolygons(co,[polys[i] for i in a],all_triangles=False);tb=BVHTree.FromPolygons(co,[polys[i] for i in b],all_triangles=False)
 pairs=ta.overlap(tb);rows={}
 for i,j in pairs:
  pa=pn[part[a[i]]];pb=pn[part[b[j]]];ca=sum((co[v] for v in polys[a[i]]),Vector())/len(polys[a[i]])
  rows.setdefault(pa+' | '+pb,[]).append([round(x,3) for x in ca])
 out[label]={k:(len(v),v[:3]) for k,v in rows.items()}
# the same pose in the head's own frame: where is the collar relative to the head pivot
hb=arm.pose.bones['head'];out['head_pivot_world']=[round(x,3) for x in arm.matrix_world@hb.head]
ev.to_mesh_clear()
for pb in arm.pose.bones:pb.matrix_basis.identity()
print(json.dumps(out))
