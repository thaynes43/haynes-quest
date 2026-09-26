"""Author helper (not evidence): sweep the held-defeat halo counter-tilt and count halo overlaps with the head and body."""
import bpy,json,importlib.util,math
from pathlib import Path
from mathutils import Euler
from mathutils.bvhtree import BVHTree
ROOT=Path('/workspace/haynes-quest/family-eras/radio-host-showman/v001')
spec=importlib.util.spec_from_file_location('wo111_rhs_anim',ROOT/'source/animate.py');A=importlib.util.module_from_spec(spec);spec.loader.exec_module(A)
skin=A.skin;arm=A.arm;arm.animation_data.action=None
names=[g.name for g in skin.vertex_groups];dom=[names[max(v.groups,key=lambda g:g.weight).group] for v in skin.data.vertices]
polys=[list(p.vertices) for p in skin.data.polygons]
grp=lambda bs:[i for i,vs in enumerate(polys) if sum(dom[v] in bs for v in vs)*2>len(vs)]
H=grp({'halo'});HEAD=grp({'head','eye_R','eye_L','tuft_R_1','tuft_R_2','tuft_L_1','tuft_L_2'});BODY=grp({'hips','spine','chest'})
out={}
for tilt in [-0.9,-0.75,-0.6,-0.45,-0.3,-0.15,0.0,0.15,0.3]:
 for sc_ in [1.0,0.85]:
  c=A.evaluate('defeat',1.0);c['halo_rot']=Euler((tilt,0,.25)).to_matrix();c['halo_scale']=sc_
  A.PREV.clear();A.apply(A.build_pose(c));bpy.context.view_layer.update()
  dg=bpy.context.evaluated_depsgraph_get();ev=skin.evaluated_get(dg);me=ev.to_mesh();co=[ev.matrix_world@v.co for v in me.vertices]
  t=lambda idx:BVHTree.FromPolygons(co,[polys[i] for i in idx],all_triangles=False)
  th=t(H);out['%+.2f x%.2f'%(tilt,sc_)]=(len(th.overlap(t(HEAD))),len(th.overlap(t(BODY))))
  ev.to_mesh_clear()
for pb in arm.pose.bones:pb.matrix_basis.identity()
print(json.dumps(out))
