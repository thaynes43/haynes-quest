/** WO103 exact GLTFLoader, all-vertex skin bounds, wings/shutter and real adapter. */
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import sharp from 'sharp';
import {EnemyAnimation} from '../../../../src/game/enemy-animation.ts';
globalThis.self=globalThis;
const images=[];
globalThis.createImageBitmap=async blob=>{
 const bytes=Buffer.from(await blob.arrayBuffer()),{data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 images.push({width:info.width,height:info.height,encoded_bytes:bytes.length,decoded_bytes:data.length});return {width:info.width,height:info.height,data,close(){}};
};
const root=path.resolve(process.argv[2]),bytes=await readFile(path.join(root,'moth-projectionist.glb'));
const rig=JSON.parse(await readFile(path.join(root,'source/rig-rest.json'),'utf8'));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const scene=gltf.scene,meshes=[];scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o)});scene.updateMatrixWorld(true);
const pack=b=>({min:b.min.toArray(),max:b.max.toArray()}),box=ps=>new T.Box3().setFromPoints(ps);
const toExport=p=>new T.Vector3(p[0]*rig.factor,(p[2]-rig.ground)*rig.factor,-p[1]*rig.factor);
const props=['projector','wing_panel_R','wing_panel_L'];
const propInitial=Object.fromEntries(props.map(n=>[n,{local:scene.getObjectByName(n).matrix.clone(),worldInverse:scene.getObjectByName(n).matrixWorld.clone().invert()}]));
const hingeInitial=Object.fromEntries(['wing_hinge_R','wing_hinge_L'].map(n=>[n,scene.getObjectByName(n).position.clone()]));
function authoredWorld(bone,p){return toExport(p).applyMatrix4(propInitial[bone].worldInverse).applyMatrix4(scene.getObjectByName(bone).matrixWorld);}
const categories=meshes.map(mesh=>Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getX(i)].name));
const distal=meshes.map(mesh=>Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>mesh.geometry.attributes.position.getY(i)>1.53*rig.factor));
function points(){
 scene.updateMatrixWorld(true);const positions=[],groups={feet:[],wings:[],wing_R:[],wing_L:[],antennae:[],distal_antennae:[],head:[],body:[],projector:[],shutters:[]};
 for(const [mi,mesh] of meshes.entries()){
  mesh.skeleton.update();
  for(let i=0;i<mesh.geometry.attributes.position.count;i++){
   const p=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld);positions.push(p);const bone=categories[mi][i];
   if(bone.startsWith('foot_'))groups.feet.push(p);
   if(bone.startsWith('wing_panel_')){groups.wings.push(p);groups['wing_'+bone.at(-1)].push(p)}
   else if(!bone.startsWith('wing_hinge_')&&!bone.startsWith('antenna_'))groups.body.push(p);
   if(bone.startsWith('antenna_')){groups.antennae.push(p);if(distal[mi][i])groups.distal_antennae.push(p)}
   if(bone==='head')groups.head.push(p);if(bone==='projector')groups.projector.push(p);if(bone.startsWith('shutter_'))groups.shutters.push(p);
  }
 }
 return {positions,groups,box:box(positions)};
}
const rest=points(),mixer=new T.AnimationMixer(scene),union=rest.box.clone(),animations={},bindings=[];
let rootFixed=true,maxInfluences=0;const propDrift=Object.fromEntries(props.map(n=>[n,0]));
const hingeDrift=Object.fromEntries(Object.keys(hingeInitial).map(n=>[n,0]));
const boxDistance=(a,b)=>Math.hypot(...['x','y','z'].map(k=>Math.max(0,a.min[k]-b.max[k],b.min[k]-a.max[k])));
const depthGap=(a,b)=>Math.max(a.min.z-b.max.z,b.min.z-a.max.z);
for(const mesh of meshes){const w=mesh.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++)maxInfluences=Math.max(maxInfluences,[w.getX(i),w.getY(i),w.getZ(i),w.getW(i)].filter(x=>x>1e-6).length)}
for(const clip of gltf.animations){
 for(const track of clip.tracks){const binding=new T.PropertyBinding(scene,track.name);binding.bind();const probe=new Float64Array(track.getValueSize()).fill(NaN);binding.getValue(probe,0);bindings.push({clip:clip.name,track:track.name,node:binding.node?.name,resolves:probe.some(Number.isFinite),targets_scene_root:binding.node===scene})}
 mixer.stopAllAction();const action=mixer.clipAction(clip).setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const total=Math.ceil(clip.duration*60),bounds=new T.Box3(),wingBounds=new T.Box3(),antennaBounds=new T.Box3(),projectorBounds=new T.Box3();
 let first,last,hold,heldDifference=0,maxDisplacement=0,maxTemporalDisplacement=0,feetMin=Infinity,wingMin=Infinity,antennaMin=Infinity,distalHeadClearance=Infinity,wingBodyClearance=Infinity,wingSpanMin=Infinity,wingSpanMax=0,wingDepthMin=Infinity,wingDepthMax=0;
 for(let i=0;i<=total;i++){
  const time=clip.duration*i/total;mixer.setTime(time);const sample=points();bounds.union(sample.box);const wb=box(sample.groups.wings);wingBounds.union(wb);antennaBounds.union(box(sample.groups.antennae));projectorBounds.union(box(sample.groups.projector));
  const size=wb.getSize(new T.Vector3());wingSpanMin=Math.min(wingSpanMin,size.x);wingSpanMax=Math.max(wingSpanMax,size.x);wingDepthMin=Math.min(wingDepthMin,size.z);wingDepthMax=Math.max(wingDepthMax,size.z);
  for(let j=0;j<sample.positions.length;j++)maxDisplacement=Math.max(maxDisplacement,sample.positions[j].distanceTo(rest.positions[j]));
  if(i===0)first=sample.positions;if(i===total)last=sample.positions;
  for(let j=0;j<sample.positions.length;j++)maxTemporalDisplacement=Math.max(maxTemporalDisplacement,sample.positions[j].distanceTo(first[j]));
  if(clip.name==='defeat'&&time>=1.8){if(!hold)hold=sample.positions;else for(let j=0;j<hold.length;j++)heldDifference=Math.max(heldDifference,hold[j].distanceTo(sample.positions[j]))}
  for(const p of sample.groups.feet)feetMin=Math.min(feetMin,p.y);for(const p of sample.groups.wings)wingMin=Math.min(wingMin,p.y);for(const p of sample.groups.antennae)antennaMin=Math.min(antennaMin,p.y);
  distalHeadClearance=Math.min(distalHeadClearance,boxDistance(box(sample.groups.distal_antennae),box(sample.groups.head)));
  // Evaluate in chest coordinates: the rotation-invariant separating axis is
  // the gap behind the body. The hinge barrels and bolted backplate are the
  // intended attachment; canvas panels must stay behind body geometry; rigid attachment spars belong to hinge bones.
  const chestInv=scene.getObjectByName('chest').matrixWorld.clone().invert();
  const worldToChest=p=>p.clone().applyMatrix4(chestInv);
  wingBodyClearance=Math.min(wingBodyClearance,depthGap(box(sample.groups.wings.map(worldToChest)),box(sample.groups.body.map(worldToChest))));
  for(const name of props)propDrift[name]=Math.max(propDrift[name],...scene.getObjectByName(name).matrix.elements.map((x,j)=>Math.abs(x-propInitial[name].local.elements[j])));
  for(const name of Object.keys(hingeDrift))hingeDrift[name]=Math.max(hingeDrift[name],scene.getObjectByName(name).position.distanceTo(hingeInitial[name]));
  rootFixed&&=scene.position.length()<1e-8&&scene.quaternion.angleTo(new T.Quaternion())<1e-8&&scene.scale.distanceTo(new T.Vector3(1,1,1))<1e-8;
 }
 let seam=0;for(let j=0;j<first.length;j++)seam=Math.max(seam,first[j].distanceTo(last[j]));
 animations[clip.name]={duration_s:clip.duration,samples:total+1,all_vertices_per_sample:rest.positions.length,max_vertex_displacement_m:maxDisplacement,max_temporal_vertex_displacement_m:maxTemporalDisplacement,bounds_y_up:pack(bounds),wing_bounds_y_up:pack(wingBounds),wing_span_range_m:[wingSpanMin,wingSpanMax],wing_depth_range_m:[wingDepthMin,wingDepthMax],antenna_bounds_y_up:pack(antennaBounds),projector_bounds_y_up:pack(projectorBounds),loop_seam_max_m:seam,feet_min_y_m:feetMin,wing_min_y_m:wingMin,antenna_min_y_m:antennaMin,distal_antenna_head_aabb_clearance_lower_bound_m:distalHeadClearance,wing_body_depth_clearance_lower_bound_m:wingBodyClearance,held_defeat_difference_m:clip.name==='defeat'?heldDifference:null};union.union(bounds);
}
mixer.stopAllAction();const attack=gltf.animations.find(c=>c.name==='attack');const contactAction=mixer.clipAction(attack).reset().setLoop(T.LoopOnce,1);contactAction.clampWhenFinished=true;
const contact={time_s:1.25,duration_s:attack.duration,fraction:.625,warning_hold_start_s:.84,warning_hold_end_s:1.10,samples:[]};
function projectionSample(time){
 const sample=points(),lens=authoredWorld('projector',rig.projector_lens_center),tip=authoredWorld('projector',rig.projector_lens_center.map((n,i)=>n+(i===1?.10:0))),axis=tip.sub(lens).normalize();
 const a=scene.getObjectByName('shutter_L').getWorldPosition(new T.Vector3()),b=scene.getObjectByName('shutter_R').getWorldPosition(new T.Vector3());
 return {time_s:time,lens_center_y_up:lens.toArray(),lens_forward_axis:axis.toArray(),shutter_pivot_distance_m:a.distanceTo(b),wings_bounds_y_up:pack(box(sample.groups.wings)),body_bounds_y_up:pack(box(sample.groups.body)),hand_L:scene.getObjectByName('hand_L').getWorldPosition(new T.Vector3()).toArray()};
}
for(const time of [0,.60,.84,1.10,1.20,1.25,1.45,1.7,2]){mixer.stopAllAction();contactAction.reset().play();mixer.setTime(time);contact.samples.push(projectionSample(time))}
mixer.stopAllAction();contactAction.reset().play();mixer.setTime(1.25);scene.updateMatrixWorld(true);
const directContactHand=scene.getObjectByName('hand_L').getWorldPosition(new T.Vector3()),directContactShutter=scene.getObjectByName('shutter_L').getWorldPosition(new T.Vector3());
mixer.stopAllAction();const da=mixer.clipAction(gltf.animations.find(c=>c.name==='defeat')).reset().setLoop(T.LoopOnce,1);da.clampWhenFinished=true;da.play();mixer.setTime(2.4);const defeatProjection=projectionSample(2.4);
mixer.stopAllAction();scene.updateMatrixWorld(true);const firstClone=clone(scene),secondClone=clone(scene),bones=[];scene.traverse(o=>{if(o.isBone)bones.push(o)});
const frozenSource=bones.map(b=>b.matrix.toArray()),head2=secondClone.getObjectByName('head').quaternion.clone();
const adapter=new EnemyAnimation(firstClone,gltf.animations,.625);
const frame={id:'wo103-inspection',position:{x:0,y:0,z:0},facing:0,phase:'idle',windupProgress:0,hp:100,maxHp:100},phases=[];
for(const phase of ['idle','chasing','windup','strike','cooldown']){
 frame.phase=phase;for(let i=0;i<20;i++){frame.windupProgress=Math.min(1,i/15);adapter.update(frame,.05)}
 firstClone.updateMatrixWorld(true);phases.push({phase,visible:firstClone.visible,head:firstClone.getObjectByName('head').getWorldPosition(new T.Vector3()).toArray(),hand:firstClone.getObjectByName('hand_L').getWorldPosition(new T.Vector3()).toArray(),shutter:firstClone.getObjectByName('shutter_L').getWorldPosition(new T.Vector3()).toArray()});
}
frame.hp=70;frame.phase='idle';adapter.update(frame,.1);firstClone.updateMatrixWorld(true);const hitHand=firstClone.getObjectByName('hand_L').getWorldPosition(new T.Vector3()).toArray();
for(let i=0;i<20;i++)adapter.update(frame,.05);frame.phase='defeated';let state;const defeatStates=[];
for(let i=0;i<58;i++){state=adapter.update(frame,.05);if([0,36,47,53,57].includes(i))defeatStates.push({time_s:(i+1)*.05,...state})}
scene.updateMatrixWorld(true);secondClone.updateMatrixWorld(true);firstClone.updateMatrixWorld(true);
const cloneIndependent=bones.every((b,i)=>b.matrix.toArray().every((x,j)=>Math.abs(x-frozenSource[i][j])<1e-10))&&secondClone.getObjectByName('head').quaternion.angleTo(head2)<1e-10;
const storedBounds=scene.getObjectByName('Moth_Projectionist_Skin').userData.model_space_bounds_y_up;
const rootBoneTracks=gltf.animations.flatMap(c=>c.tracks.filter(t=>t.name.startsWith('root.')).map(t=>({clip:c.name,name:t.name,constant:Array.from(t.values).every((v,i,a)=>Math.abs(v-a[i%t.getValueSize()])<1e-7)})));
const contactPose=contact.samples.find(s=>s.time_s===1.25),warning=contact.samples.find(s=>s.time_s===.84),restProjection=contact.samples[0],atWindup=phases.find(p=>p.phase==='windup');
const checks={exported_bounds_cover_all_poses:!!storedBounds&&union.min.toArray().every((v,i)=>v>=storedBounds.min[i])&&union.max.toArray().every((v,i)=>v<=storedBounds.max[i]),all_five_clips:gltf.animations.map(c=>c.name).sort().join()===['idle','move','attack','hit','defeat'].sort().join(),all_tracks_resolve_below_scene_root:bindings.every(b=>b.resolves&&!b.targets_scene_root),all_clips_move_actual_vertices:Object.values(animations).every(a=>a.max_temporal_vertex_displacement_m>.001),idle_move_seams:['idle','move'].every(n=>animations[n].loop_seam_max_m<.00001),held_defeat:animations.defeat.held_defeat_difference_m<.00001,
 no_floor_penetration:Object.values(animations).every(a=>a.bounds_y_up.min[1]>=-.00001),projector_attachment_fixed:propDrift.projector<.00001,wing_panel_attachment_fixed:props.filter(n=>n.startsWith('wing')).every(n=>propDrift[n]<.00001),wing_hinge_pivots_fixed:Object.values(hingeDrift).every(d=>d<.00001),wings_clear_body:Object.values(animations).every(a=>a.wing_body_depth_clearance_lower_bound_m>.001),distal_antennae_clear_head:Object.values(animations).every(a=>a.distal_antenna_head_aabb_clearance_lower_bound_m>.001),
 at_most_four_influences:maxInfluences<=4,identity_root_no_motion:rootFixed,no_root_bone_motion:rootBoneTracks.every(t=>t.constant),correct_height:rest.box.max.y>=1.60&&rest.box.max.y<=1.70&&Math.abs(rest.box.max.y-1.65)<.001,floor_centered_rest:Math.abs(rest.box.min.y)<.00001&&Math.abs(rest.box.max.x+rest.box.min.x)<.05,one_1024_embedded_atlas:images.length===1&&images[0].width===1024&&images[0].height===1024,two_draw_primitives:meshes.length===2,actual_adapter_constructed:true,actual_adapter_defeat_vanish:state.visible===false&&state.vanish===1,adapter_root_identity:firstClone.position.length()<1e-8&&firstClone.scale.distanceTo(new T.Vector3(1,1,1))<1e-8,independent_skeleton_clone:cloneIndependent,
 attack_contact_1_25:Math.abs(animations.attack.duration_s*.625-1.25)<1e-9,actual_adapter_contact_pose:new T.Vector3(...atWindup.hand).distanceTo(directContactHand)<1e-5&&new T.Vector3(...atWindup.shutter).distanceTo(directContactShutter)<1e-5,physical_shutter_opens_at_contact:contactPose.shutter_pivot_distance_m-warning.shutter_pivot_distance_m>.1,wing_warning_wider_than_rest:warning.wings_bounds_y_up.max[0]-warning.wings_bounds_y_up.min[0]>restProjection.wings_bounds_y_up.max[0]-restProjection.wings_bounds_y_up.min[0]+.12,wing_warning_higher_than_rest:warning.wings_bounds_y_up.max[1]>restProjection.wings_bounds_y_up.max[1]+.08,aimed_forward_at_contact:contactPose.lens_forward_axis[2]<-.98,defeat_projector_down_and_closed:defeatProjection.lens_forward_axis[1]<-.20&&defeatProjection.shutter_pivot_distance_m<.04};
adapter.dispose();
const boundsRecord={method:'All exact exported skin vertices, rest and every clip at 60 Hz; conservative 0.005 m padding per axis.',safe_culling_envelope:{min:union.min.toArray().map(n=>Math.floor((n-.005)*1000)/1000),max:union.max.toArray().map(n=>Math.ceil((n+.005)*1000)/1000)}};
if(process.argv.includes('--write-bounds'))await writeFile(path.join(path.dirname(new URL(import.meta.url).pathname),'bounds.json'),JSON.stringify(boundsRecord,null,2)+'\n');
const record={asset_id:'moth-projectionist',version:'v001',glb_sha256:createHash('sha256').update(bytes).digest('hex'),three_revision:T.REVISION,method:'Exact GLTFLoader; all exported skin vertices at 60 Hz; SkeletonUtils clone; actual src/game/enemy-animation.ts. Wing/body clearance uses a conservative chest-local depth separating axis; intended bolted hinge/spar attachment excluded from panel surface group. Antenna base attachment intentionally touches head; distal feather points are checked separately. Contact measures physical shutter, wing and projector gesture, with no beam or damage claim.',rest_bounds_y_up:pack(rest.box),all_animation_bounds_y_up:pack(union),dimensions_m:rest.box.getSize(new T.Vector3()).toArray(),exported_safe_bounds_y_up:storedBounds,animations,images,root_bone_tracks:rootBoneTracks,tracks:bindings,prop_max_local_matrix_drift:propDrift,hinge_max_local_position_drift_m:hingeDrift,max_skin_influences:maxInfluences,contact,defeat_projection:defeatProjection,adapter:{phases,direct_contact_hand:directContactHand.toArray(),hit_hand:hitHand,defeat_states:defeatStates},checks};
await writeFile(path.join(root,'three-inspection.json'),JSON.stringify(record,null,2)+'\n');
const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);console.log(JSON.stringify({failures,rest:record.rest_bounds_y_up,animated:record.all_animation_bounds_y_up,animations,prop_drift:propDrift,hinge_drift:hingeDrift,max_skin_influences:maxInfluences,contact,defeat_projection:defeatProjection}));process.exitCode=failures.length?1:0;
