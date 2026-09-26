"""Author helper (not evidence): held-defeat overlap probe for the head snap (neck/head extension) and the halo tilt."""
import bpy,json,importlib.util,math
from pathlib import Path
from mathutils import Euler,Vector
from mathutils.bvhtree import BVHTree
ROOT=Path('/workspace/haynes-quest/family-eras/radio-host-showman/v001')
spec=importlib.util.spec_from_file_location('wo111_rhs_anim',ROOT/'source/animate.py');A=importlib.util.module_from_spec(spec);spec.loader.exec_module(A)
skin=A.skin;arm=A.arm;arm.animation_data.action=None
names=[g.name for g in skin.vertex_groups];dom=[names[max(v.groups,key=lambda g:g.weight).group] for v in skin.data.vertices]
polys=[list(p.vertices) for p in skin.data.polygons]
cons=json.loads((ROOT/'construction.json').read_text());pn=[r['name'] for r in cons['parts']]
part=[0]*len(polys);skin.data.attributes['rhs_part'].data.foreach_get('value',part)
grp=lambda bs:[i for i,vs in enumerate(polys) if sum(dom[v] in bs for v in vs)*2>len(vs)]
G={'halo':grp({'halo'}),'tips':grp({'tuft_R_2','tuft_L_2'}),'head':grp({'head','eye_R','eye_L'}),'body':grp({'hips','spine','chest'}),
 'face':[i for i in range(len(polys)) if part[i]==pn.index('Showman head with painted grin, teeth and eyes')],
 'collar':[i for i in range(len(polys)) if part[i] in (pn.index('White shirt collar'),pn.index('Black shawl collar band'))]}
def run(c):
 A.PREV.clear();A.apply(A.build_pose(c));bpy.context.view_layer.update()
 dg=bpy.context.evaluated_depsgraph_get();ev=skin.evaluated_get(dg);me=ev.to_mesh();co=[ev.matrix_world@v.co for v in me.vertices]
 t={k:BVHTree.FromPolygons(co,[polys[i] for i in idx],all_triangles=False) for k,idx in G.items()}
 r={p:len(t[p.split('~')[0]].overlap(t[p.split('~')[1]])) for p in ('halo~tips','halo~head','halo~body','face~collar')}
 hq=(arm.matrix_world@arm.pose.bones['head'].matrix).to_quaternion();fwd=hq@Vector((0,1,0));r['face_pitch_deg']=round(math.degrees(math.asin(max(-1,min(1,fwd.z)))),1)
 ev.to_mesh_clear();return r
out={'as_baked':run(A.evaluate('defeat',1.0))}
for hx in (0.55,0.70,0.86):
 for nx in (-0.10,0.0,0.10,0.24):
  c=A.evaluate('defeat',1.0);c['head_rot']=A.mul(A.E(hx,.20,.30),A.HR0);c['neck_rot']=A.E(-.10+nx,0,0)
  out['head%.2f neck%+.2f'%(hx,nx)]=run(c)
for pb in arm.pose.bones:pb.matrix_basis.identity()
print(json.dumps(out))
