"""WO111 yes-yes-veggie source-geometry clearance and attachment audit.

Supplements the exact-GLB all-vertex checks. Uses the same authored part
vertices, weights and baked actions as the exported GLB, sampled at 60 Hz:
- leaf mittens and forearm stalks stay outside the posed stalk (trunk, legs,
  feet, branches), the crown florets and the eyes;
- the two leaf mittens never touch each other;
- pupils and catchlights stay inside their cream eye ovals;
- brows stay seated on the face (neither buried nor lifted off);
- no source vertex goes below the floor.
Signed distances use nearest-surface normals on per-frame BVHs of the posed
parts. Not a universal triangle-collision proof.
"""
import bpy,json,math,hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path('/workspace/haynes-quest/family-eras/yes-yes-veggie/v001')
arm=bpy.data.objects['Yes_Yes_Veggie_Rig'];scene=bpy.context.scene
parts={o.name:o for o in bpy.data.collections['EDITABLE original yes-yes veggie parts - excluded from export'].objects}
bone_names=[b.name for b in arm.data.bones];bix={n:i for i,n in enumerate(bone_names)}
rest_inv=[np.array(b.matrix_local.inverted()) for b in arm.data.bones]
CLIPS=[('idle',2.4),('move',1.0),('attack',2.0),('hit',.7),('defeat',2.4)]

def load(ob,select=None):
 co=np.array([v.co[:] for v in ob.data.vertices]);W=np.zeros((len(co),len(bone_names)))
 for v in ob.data.vertices:
  for g in v.groups:W[v.index,bix[ob.vertex_groups[g.group].name]]=g.weight
 keep=np.ones(len(co),bool) if select is None else select(co,W)
 faces=[tuple(p.vertices) for p in ob.data.polygons]
 return co,W,keep,faces
def posed(co,W,mats):
 h=np.hstack([co,np.ones((len(co),1))]);out=np.zeros((len(co),3))
 for i,M in enumerate(mats):
  if not W[:,i].any():continue
  out+=W[:,i:i+1]*(h@M.T)[:,:3]
 return out
def group(names):
 cs,ws,fs=[],[],[];base=0
 for n in names:
  c,w,_,f=load(parts[n]);cs.append(c);ws.append(w);fs.extend(tuple(base+i for i in p) for p in f);base+=len(c)
 return np.vstack(cs),np.vstack(ws),fs
def bvh(co,faces):return BVHTree.FromPolygons([tuple(p) for p in co],faces)
def signed(tree,pts):
 out=np.empty(len(pts))
 for i,p in enumerate(pts):
  loc,n,_,d=tree.find_nearest(Vector(p))
  out[i]=d if (Vector(p)-loc).dot(n)>=0 else -d
 return out

stalk_names=[n for n in parts if n.startswith(('Pale lime broccoli stalk',))]
floret_names=[n for n in parts if 'floret' in n]
eye_names=[n for n in parts if n.startswith('Cream oval eye')]
ST=group(stalk_names);FL=group(floret_names);EY={n:group([n]) for n in eye_names}
LEAF={s:load(parts['Cupped leaf mitten hand_'+s]) for s in ('L','R')}
def fore_select(s):
 return lambda co,W:W[:,bix['fore_'+s]]+W[:,bix['hand_'+s]]>.999
FORE={s:load(parts['Thin stalk arm arm_'+s],fore_select(s)) for s in ('L','R')}
PUPIL={side:group([n for n in parts if n.endswith(' '+str(side)) and n.startswith(('Ink pupil','Pupil catchlight'))]) for side in (-1,1)}
EYE_OF={-1:'Cream oval eye -1',1:'Cream oval eye 1'}
BROW={s:group(['Thick brow brow_'+s]) for s in ('L','R')}
ALL=group(list(parts))
construction=json.loads((ROOT/'construction.json').read_text())
EYES={int(k) if not isinstance(k,int) else k:v for k,v in construction['face']['eyes'].items()}
EYE_R=(.043,.021,.052)

worst={k:{'margin_m':math.inf} for k in ['leaf_vs_stalk','leaf_vs_crown','leaf_vs_eyes','forearm_vs_stalk','forearm_vs_crown','leaf_vs_leaf']}
pupil_worst={'max_ellipse_radius':0.0};brow_range=[math.inf,-math.inf];floor={'z':math.inf}
samples=0
# Rest brow depth range (the sweep is centred 5 mm off the face and partly embedded by design).
_rest=[np.eye(4)]*len(bone_names);_st=bvh(ST[0],ST[2])
brow_rest=[min(float(signed(_st,BROW[s][0]).min()) for s in 'LR'),max(float(signed(_st,BROW[s][0]).max()) for s in 'LR')]
def note(key,margin,clip,t,extra=None):
 if margin<worst[key]['margin_m']:worst[key]={'margin_m':float(margin),'clip':clip,'time_s':round(t,4),**(extra or {})}
for clip,duration in CLIPS:
 action=bpy.data.actions[clip];arm.animation_data.action=action;end=round(duration*60)
 for f in range(end+1):
  scene.frame_set(f);bpy.context.view_layer.update();t=f/60;samples+=1
  mats=[np.array(pb.matrix)@rest_inv[i] for i,pb in enumerate(arm.pose.bones)]
  st=posed(ST[0],ST[1],mats);st_t=bvh(st,ST[2])
  fl=posed(FL[0],FL[1],mats);fl_t=bvh(fl,FL[2])
  eyes_t=[bvh(posed(c,w,mats),fc) for c,w,fc in EY.values()]
  leaves={}
  for s in ('L','R'):
   co,W,keep,faces=LEAF[s];lp=posed(co,W,mats);leaves[s]=(lp,faces)
   d=signed(st_t,lp);i=int(np.argmin(d));note('leaf_vs_stalk',d[i],clip,t,{'side':s,'point':lp[i].tolist()})
   d=signed(fl_t,lp);i=int(np.argmin(d));note('leaf_vs_crown',d[i],clip,t,{'side':s,'point':lp[i].tolist()})
   for et in eyes_t:
    d=signed(et,lp);i=int(np.argmin(d));note('leaf_vs_eyes',d[i],clip,t,{'side':s,'point':lp[i].tolist()})
   co,W,keep,faces=FORE[s];fp=posed(co,W,mats)[keep]
   d=signed(st_t,fp);i=int(np.argmin(d));note('forearm_vs_stalk',d[i],clip,t,{'side':s,'point':fp[i].tolist()})
   d=signed(fl_t,fp);i=int(np.argmin(d));note('forearm_vs_crown',d[i],clip,t,{'side':s,'point':fp[i].tolist()})
  lt=bvh(*leaves['L']);d=min(lt.find_nearest(Vector(q))[3] for q in leaves['R'][0]);note('leaf_vs_leaf',float(d),clip,t)
  # Pupils in the eye's own rest frame: body and pupils bones carry them, so undo the body delta.
  body=mats[bix['body']];inv=np.linalg.inv(body)
  for side in (-1,1):
   pp=posed(PUPIL[side][0],PUPIL[side][1],mats);h=np.hstack([pp,np.ones((len(pp),1))]);local=(h@inv.T)[:,:3]
   c=np.array(EYES[side]['centre']);n=Vector(EYES[side]['normal']);rot=Vector((0,1,0)).rotation_difference(n).to_matrix()
   R=np.array(rot);q=(local-c)@R  # columns: eye x, depth, eye z
   r=np.sqrt((q[:,0]/EYE_R[0])**2+(q[:,2]/EYE_R[2])**2).max()
   if r>pupil_worst['max_ellipse_radius']:pupil_worst={'max_ellipse_radius':float(r),'clip':clip,'time_s':round(t,4),'side':side}
  for s in ('L','R'):
   bp=posed(BROW[s][0],BROW[s][1],mats);d=signed(st_t,bp)
   brow_range[0]=min(brow_range[0],float(d.min()));brow_range[1]=max(brow_range[1],float(d.max()))
  ap=posed(ALL[0],ALL[1],mats);i=int(np.argmin(ap[:,2]))
  if ap[i,2]<floor['z']:floor={'z':float(ap[i,2]),'clip':clip,'time_s':round(t,4),'point':ap[i].tolist()}
arm.animation_data.action=None
for pb in arm.pose.bones:pb.matrix_basis.identity()
scene.frame_set(0)
glb=ROOT/'yes-yes-veggie.glb'
checks={'leaf_clear_of_stalk':worst['leaf_vs_stalk']['margin_m']>.001,'leaf_clear_of_crown':worst['leaf_vs_crown']['margin_m']>.001,'leaf_clear_of_eyes':worst['leaf_vs_eyes']['margin_m']>.001,
 'forearm_clear_of_stalk':worst['forearm_vs_stalk']['margin_m']>.0005,'forearm_clear_of_crown':worst['forearm_vs_crown']['margin_m']>.001,'leaves_never_touch':worst['leaf_vs_leaf']['margin_m']>.01,
 'pupils_inside_eye_ovals':pupil_worst['max_ellipse_radius']<.98,'brows_seated_on_face':brow_range[0]>brow_rest[0]-.002 and brow_range[1]<brow_rest[1]+.004,'no_source_floor_penetration':floor['z']>=-1e-5}
record={'asset_id':'yes-yes-veggie','version':'v001','glb_sha256':hashlib.sha256(glb.read_bytes()).hexdigest(),'method':__doc__.strip(),'samples':samples,'worst':worst,'pupils':pupil_worst,'brow_signed_distance_range_m':brow_range,'brow_rest_signed_distance_range_m':brow_rest,'floor_minimum':floor,'checks':checks}
(ROOT/'attachment-inspection.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'checks':checks,'worst':{k:(round(v['margin_m'],4),v.get('clip'),v.get('time_s')) for k,v in worst.items()},'pupil':pupil_worst,'brow':brow_range,'brow_rest':brow_rest,'floor':floor}))
