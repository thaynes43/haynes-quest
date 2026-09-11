"""Exact source survival, weights and sampled physical attachment evidence.

Run in an owned isolated Blender checker after the candidate is exported. Named
source vertices are matched against the actual re-imported GLB, including weights.
Subsequent contact checks use the imported bones and those verified coordinates.
"""
import bpy, json, hashlib, sys, math
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree
sys.path.insert(0,str(Path(__file__).resolve().parent))
from render import set_pose

BASE=Path('/workspace/haynes-quest/parody/remix-trio/v001')

def collider(points,faces):return BVHTree.FromPolygons(points,faces,all_triangles=False,epsilon=.000001)

def connection(a,b):
 aa=collider(a['points'],a['faces']);bb=collider(b['points'],b['faces']);overlap=len(aa.overlap(bb))
 closest=1e8;inside=False
 for source,target in [(a,bb),(b,aa)]:
  for point in source['points']:
   co,normal,index,distance=target.find_nearest(point)
   if co is None:continue
   closest=min(closest,distance)
   if distance>.000001 and (point-co).dot(normal)<-.000001:inside=True
 return {'surface_intersections':overlap,'nearest_surface_distance_m':closest,'embedded_vertex':inside,'connected':overlap>0 or inside or closest<.0002}

def main(name):
 root=BASE/name;construction=json.loads((root/'construction.json').read_text());bpy.ops.wm.open_mainfile(filepath=str(root/(name+'.blend')))
 source=[]
 for ob in bpy.data.collections['Editable named construction | excluded from export'].objects:
  vertices=[]
  for v in ob.data.vertices:
   weights={ob.vertex_groups[g.group].name:float(g.weight) for g in v.groups if g.weight>0}
   vertices.append({'point':ob.matrix_world@v.co,'weights':weights})
  source.append({'name':ob.name,'vertices':vertices,'faces':[list(p.vertices) for p in ob.data.polygons]})
 for ob in list(bpy.data.objects):bpy.data.objects.remove(ob,do_unlink=True)
 for a in list(bpy.data.actions):bpy.data.actions.remove(a)
 bpy.context.scene.render.fps=24;bpy.ops.import_scene.gltf(filepath=str(root/(name+'.glb')))
 arm=next(ob for ob in bpy.context.scene.objects if ob.type=='ARMATURE');set_pose(arm)
 exported=[]
 for ob in bpy.context.scene.objects:
  if ob.type!='MESH' or not any(m.type=='ARMATURE' for m in ob.modifiers):continue
  for v in ob.data.vertices:exported.append({'point':ob.matrix_world@v.co,'weights':{ob.vertex_groups[g.group].name:float(g.weight) for g in v.groups if g.weight>0}})
 tree=KDTree(len(exported))
 for i,v in enumerate(exported):tree.insert(v['point'],i)
 tree.balance();parts=[]
 for ob in source:
  maximum=0;weight_error=0;resolved=[]
  for v in ob['vertices']:
   choices=tree.find_range(v['point'],.00001)
   if not choices:raise AssertionError('Source vertex absent: '+ob['name'])
   def error(item):
    e=exported[item[1]];return max(abs(v['weights'].get(k,0)-e['weights'].get(k,0)) for k in set(v['weights'])|set(e['weights']))
   nearest=min(choices,key=error);maximum=max(maximum,nearest[2]);weight_error=max(weight_error,error(nearest));resolved.append(exported[nearest[1]])
  ob['verified_vertices']=resolved
  parts.append({'name':ob['name'],'vertices':len(resolved),'maximum_export_distance_m':maximum,'maximum_weight_error':weight_error,'joint_names':sorted({k for v in resolved for k in v['weights']})})
 byname={ob['name']:ob for ob in source}
 def posed(name):
  ob=byname[name];points=[]
  for v in ob['verified_vertices']:
   out=Vector((0,0,0))
   for bn,w in v['weights'].items():out+=(arm.pose.bones[bn].matrix@arm.data.bones[bn].matrix_local.inverted()@v['point'])*w
   points.append(arm.matrix_world@out)
  return {'points':points,'faces':ob['faces']}
 contacts=[]
 for pair in construction['required_contacts']:
  set_pose(arm);entry={**pair,'rest':connection(posed(pair['part_a']),posed(pair['part_b'])),'clips':{}}
  for clip in construction['clips']:
   samples=[]
   for fraction in [0,.2,.4,.6,.8,1]:
    set_pose(arm,clip['name'],clip['duration_s']*24*fraction);samples.append({'fraction':fraction,**connection(posed(pair['part_a']),posed(pair['part_b']))})
   entry['clips'][clip['name']]=samples
  contacts.append(entry)
 special={}
 if name=='sir-flush-a-lot':
  set_pose(arm,'defeat',48);lid=posed('Lid | one raised oval ceramic lid');lid_bvh=collider(lid['points'],lid['faces']);collisions=[]
  for part in source:
   if not (part['name'].startswith(('Head |','Hair |','Crown |','Face |','Eye |','Moustache |'))):continue
   partpose=posed(part['name']);n=len(lid_bvh.overlap(collider(partpose['points'],partpose['faces'])))
   if n:collisions.append({'part':part['name'],'surface_intersections':n})
  special['defeat_lid_clears_head_hair_crown']=not collisions;special['defeat_lid_intersections']=collisions
 if name=='nap-captain':
  pillowparts=[p for p in parts if p['name'].startswith('Pillow |')];special['one_pillow_always_owned_by_left_hand']=all(p['joint_names']==['hand_L'] for p in pillowparts)
  set_pose(arm);pillow=posed('Pillow | single yellow quilted cushion');special['neutral_pillow_on_character_left']=sum(p.x for p in pillow['points'])/len(pillow['points'])<0
  set_pose(arm,'attack',.9*24);special['contact_right_paw_meets_same_pillow']=connection(posed('Hand | R rounded plush paw'),posed('Pillow | single yellow quilted cushion'))
 if name=='one-star-diva':
  paddleparts=[p for p in parts if p['name'].startswith('Paddle |')];special['paddle_always_owned_by_right_hand']=all(p['joint_names']==['hand_R'] for p in paddleparts)
  special['exactly_one_star_part']=len([p for p in parts if p['name']=='Paddle | exactly one gold star'])==1
 weights=[v['weights'] for v in exported]
 checks={'every_named_source_part_survives':len(parts)==len(construction['named_source_parts']) and all(p['maximum_export_distance_m']<.00001 for p in parts),'all_exported_weights_match_source':all(p['maximum_weight_error']<.00001 for p in parts),'all_vertices_have_normalized_at_most_four_weights':all(0<len(w)<=4 and abs(sum(w.values())-1)<.00001 for w in weights),'every_required_rest_attachment_connected':all(p['rest']['connected'] for p in contacts),'every_required_attachment_connected_across_all_clips':all(s['connected'] for p in contacts for samples in p['clips'].values() for s in samples)}
 if name=='sir-flush-a-lot':checks['defeat_lid_clears_head_hair_crown']=special['defeat_lid_clears_head_hair_crown']
 if name=='nap-captain':checks.update({k:special[k] for k in ['one_pillow_always_owned_by_left_hand','neutral_pillow_on_character_left']});checks['contact_right_paw_meets_same_pillow']=special['contact_right_paw_meets_same_pillow']['connected']
 if name=='one-star-diva':checks.update({k:special[k] for k in ['paddle_always_owned_by_right_hand','exactly_one_star_part']})
 record={'asset_id':name,'glb_sha256':hashlib.sha256((root/(name+'.glb')).read_bytes()).hexdigest(),'method':'Source vertex/weight matching against actual re-imported GLB; contact surfaces reconstructed with imported bone matrices at six times in each clip.','named_source_parts':len(parts),'exported_vertices':len(exported),'parts':parts,'contacts':contacts,'special':special,'checks':checks}
 (root/'construction-survival.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({'asset_id':name,'checks':checks,'special':special}));assert all(checks.values()),checks

if __name__=='__main__':
 args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
 if len(args)!=1:raise SystemExit('One asset name required')
 main(args[0])
