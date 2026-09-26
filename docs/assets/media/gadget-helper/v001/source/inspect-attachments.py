"""WO111 gadget-helper source-geometry clearance and attachment audit.

Supplements the exact-GLB all-vertex checks. Uses the same authored part
vertices and baked source actions as the exported GLB, sampled at 60 Hz:
- accordion hose, wrist and wrench stay outside the toolbox shell (body, lid,
  skirt superellipse volumes) in the body's own posed frame;
- the stabiliser paddle fin stays outside the shell;
- the handle strap and grip stay above the lid shell;
- the wrench never touches the handle or its hinge bosses;
- the hose ends stay seated in the shoulder collar and wrist drum;
- the pupils stay inside their cream eye ovals.
Not a universal triangle-collision proof.
"""
import bpy,json,math,hashlib
import numpy as np
from pathlib import Path
ROOT=Path('/workspace/haynes-quest/family-eras/gadget-helper/v001')
arm=bpy.data.objects['Gadget_Helper_Rig'];scene=bpy.context.scene
parts={o.name:o for o in bpy.data.collections['EDITABLE original gadget helper parts - excluded from export'].objects}
bone_names=[b.name for b in arm.data.bones];bix={n:i for i,n in enumerate(bone_names)}
rest_inv=[np.array(b.matrix_local.inverted()) for b in arm.data.bones]

def load(ob,select=None):
 co=np.array([v.co[:] for v in ob.data.vertices]);W=np.zeros((len(co),len(bone_names)))
 for v in ob.data.vertices:
  for g in v.groups:W[v.index,bix[ob.vertex_groups[g.group].name]]=g.weight
 keep=np.ones(len(co),bool) if select is None else select(co)
 return co[keep],W[keep]
def group(names,select=None):
 cs,ws=[],[]
 for n in names:c,w=load(parts[n],select);cs.append(c);ws.append(w)
 return np.vstack(cs),np.vstack(ws)
def posed(co,W,mats):
 h=np.hstack([co,np.ones((len(co),1))]);out=np.zeros((len(co),3))
 for i,M in enumerate(mats):
  if not W[:,i].any():continue
  out+=W[:,i:i+1]*(h@M.T)[:,:3]
 return out
def to_frame(p,M):
 inv=np.linalg.inv(M);h=np.hstack([p,np.ones((len(p),1))]);return (h@inv.T)[:,:3]

def interp(profile,z):
 zs=np.array([a for a,_ in profile]);ss=np.array([b for _,b in profile]);return np.interp(z,zs,ss,left=0,right=0),(z>=zs[0])&(z<=zs[-1])
SHELLS=[('body',.42,.21,3.3,[(.262,.955),(.272,.975),(.29,.99),(.40,1.0),(.56,1.0),(.66,.99),(.69,.982),(.708,.965)]),
        ('skirt',.44,.25,3.2,[(.162,.84),(.176,.95),(.20,1.0),(.228,1.012),(.256,.99),(.29,.93)])]
LID=('lid',.44,.232,3.3,[(.672,.985),(.684,1.03),(.738,1.03),(.752,1.0),(.835,.99),(.868,.955),(.888,.88),(.896,.72)])
def shell_margin(p,shells):
 """Positive: outside every shell (metres, approximate radial distance)."""
 best=np.full(len(p),np.inf)
 for _,a,b,e,profile in shells:
  s,inz=interp(profile,p[:,2]);s=np.maximum(s,1e-6)
  f=(np.abs(p[:,0]/(a*s))**e+np.abs(p[:,1]/(b*s))**e)**(1/e)
  m=np.where(inz,(f-1)*np.minimum(a,b)*s,np.inf)
  # Above/below the shell counts as outside by the vertical gap.
  best=np.minimum(best,m)
 return best

LID_TOP=[(0,.896),(.72,.896),(.88,.888),(.955,.868),(.99,.835),(1.0,.752),(1.03,.738)]
def lid_top_margin(p):
 """Height above the lid's rounded top for points over the lid footprint (metres)."""
 f=(np.abs(p[:,0]/.44)**3.3+np.abs(p[:,1]/.232)**3.3)**(1/3.3)
 top=np.interp(f,[a for a,_ in LID_TOP],[b for _,b in LID_TOP])
 return np.where(f<=1.03,p[:,2]-top,np.inf)

hose_names=['Dark flexible accordion hose']
wrench_names=[n for n in parts if n.startswith(('Orange wrist pivot drum','Wrist rivet','Grey wrench shaft','Grey open wrench head','Rounded cream mitten jaw tip','Wrench head rivet'))]
handle_names=['Ochre folding strap handle','Ribbed charcoal plum grip']
boss_names=[n for n in parts if n.startswith(('Handle hinge boss','Hinge rivet'))]
paddle_names=['Teal stabiliser paddle fin']
hose_co,hose_W=group(hose_names,lambda c:c[:,0]<-.49)
hose_all_co,hose_all_W=group(hose_names)
wr_co,wr_W=group(wrench_names)
hd_co,hd_W=group(handle_names,lambda c:c[:,2]>.95)
hd_all_co,hd_all_W=group(handle_names)
bs_co,bs_W=group(boss_names)
pd_co,pd_W=group(paddle_names)
# Hose end rings: first/last 14 vertices of the swept tube (rings are 12 wide; take extreme path ends).
hose_ob=parts['Dark flexible accordion hose'];hco,hW=load(hose_ob);n=12
start_idx=np.arange(0,n);end_idx=np.arange(len(hco)-n,len(hco))
pupil_names=[n for n in parts if n.startswith('Ink pupil')]
eye_centres={1:np.array([.128,.545]),-1:np.array([-.128,.545])}

results={};fps=scene.render.fps
for clip in ['idle','move','attack','hit','defeat']:
 action=bpy.data.actions[clip];arm.animation_data.action=action;end=round(action.frame_range[1])
 r={'samples':end+1,'min_arm_shell_margin_m':np.inf,'min_wrench_shell_margin_m':np.inf,'min_paddle_shell_margin_m':np.inf,'min_handle_lid_margin_m':np.inf,'min_wrench_handle_distance_m':np.inf,'max_hose_start_offset_m':0,'max_hose_end_offset_m':0,'max_pupil_eye_ratio':0,'worst':{}}
 for frame in range(end+1):
  scene.frame_set(frame);bpy.context.view_layer.update()
  mats=[np.array(arm.pose.bones[nm].matrix)@rest_inv[i] for i,nm in enumerate(bone_names)]
  body=mats[bix['body']];lid=mats[bix['lid']]
  def margin(co,W,shells,frameM):
   return shell_margin(to_frame(posed(co,W,mats),frameM),shells)
  m=margin(hose_co,hose_W,SHELLS+[LID],body).min()
  if m<r['min_arm_shell_margin_m']:r['min_arm_shell_margin_m']=float(m);r['worst']['arm']={'frame':frame,'time_s':frame/fps}
  m=margin(wr_co,wr_W,SHELLS+[LID],body).min()
  if m<r['min_wrench_shell_margin_m']:r['min_wrench_shell_margin_m']=float(m);r['worst']['wrench']={'frame':frame,'time_s':frame/fps}
  m=margin(pd_co,pd_W,SHELLS+[LID],body).min()
  if m<r['min_paddle_shell_margin_m']:r['min_paddle_shell_margin_m']=float(m);r['worst']['paddle']={'frame':frame,'time_s':frame/fps}
  m=lid_top_margin(to_frame(posed(hd_co,hd_W,mats),lid)).min()
  if m<r['min_handle_lid_margin_m']:r['min_handle_lid_margin_m']=float(m);r['worst']['handle']={'frame':frame,'time_s':frame/fps}
  wp=posed(wr_co,wr_W,mats);hp=np.vstack([posed(hd_all_co[::3],hd_all_W[::3],mats),posed(bs_co,bs_W,mats)])
  d=np.sqrt(((wp[:,None,:]-hp[None,:,:])**2).sum(-1)).min()
  if d<r['min_wrench_handle_distance_m']:r['min_wrench_handle_distance_m']=float(d);r['worst']['wrench_handle']={'frame':frame,'time_s':frame/fps}
  hp_all=posed(hco,hW,mats)
  # Start ring centre must stay on the collar axis inside the collar; end ring centre at the wrist drum.
  start_local=to_frame(hp_all[start_idx].mean(0,keepdims=True),body)[0]
  collar_axis_offset=math.hypot(start_local[1],start_local[2]-.50)
  wrist=(mats[bix['wrench']]@np.array([-.675,0,.68,1]))[:3]
  end_offset=float(np.linalg.norm(hp_all[end_idx].mean(0)-wrist))
  r['max_hose_start_offset_m']=max(r['max_hose_start_offset_m'],collar_axis_offset);r['max_hose_end_offset_m']=max(r['max_hose_end_offset_m'],end_offset)
  for pn in pupil_names:
   side=int(pn.split()[-1]);c,w=load(parts[pn]);pc=to_frame(posed(c,w,mats),body).mean(0)
   dx,dz=pc[0]-eye_centres[side][0],pc[2]-eye_centres[side][1]
   r['max_pupil_eye_ratio']=max(r['max_pupil_eye_ratio'],math.hypot(dx/(.072-.033),dz/(.100-.049)))
 results[clip]={k:(float(v) if isinstance(v,(float,np.floating)) else v) for k,v in r.items()}
arm.animation_data.action=None
for pb in arm.pose.bones:pb.matrix_basis.identity()
scene.frame_set(0);bpy.context.view_layer.update()
tol=-.004
checks={'arm_hose_clear_of_toolbox_shell':all(r['min_arm_shell_margin_m']>=tol for r in results.values()),
 'wrench_clear_of_toolbox_shell':all(r['min_wrench_shell_margin_m']>=tol for r in results.values()),
 'paddle_clear_of_toolbox_shell':all(r['min_paddle_shell_margin_m']>=tol for r in results.values()),
 'handle_above_lid':all(0<=r['min_handle_lid_margin_m']<1 for r in results.values()),
 'wrench_clear_of_handle':all(r['min_wrench_handle_distance_m']>=.005 for r in results.values()),
 'hose_seated_in_collar':all(r['max_hose_start_offset_m']<.03 for r in results.values()),
 'hose_seated_in_wrist_drum':all(r['max_hose_end_offset_m']<.03 for r in results.values()),
 'pupils_inside_eyes':all(r['max_pupil_eye_ratio']<=1.0 for r in results.values())}
glb=ROOT/'gadget-helper.glb'
record={'asset_id':'gadget-helper','version':'v001','glb_sha256':hashlib.sha256(glb.read_bytes()).hexdigest(),'method':__doc__.strip(),'tolerance_m':tol,'clips':results,'checks':checks}
(ROOT/'attachment-inspection.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'checks':checks,'clips':{k:{kk:(round(vv,4) if isinstance(vv,float) else vv) for kk,vv in v.items()} for k,v in results.items()}}))
