/** WO104 exact exported skin, attachments, contact and actual EnemyAnimation. */
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
const root=path.resolve(process.argv[2]),bytes=await readFile(path.join(root,'golden-after-hours-rat.glb'));
const rig=JSON.parse(await readFile(path.join(root,'source/rig-rest.json'),'utf8'));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const scene=gltf.scene,meshes=[];scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o)});scene.updateMatrixWorld(true);
const pack=b=>({min:b.min.toArray(),max:b.max.toArray()}),box=ps=>new T.Box3().setFromPoints(ps);
const categories=meshes.map(mesh=>Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getX(i)].name));
const distalTail=meshes.map(mesh=>Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>mesh.geometry.attributes.position.getZ(i)>.255*rig.factor));
const parts=['faceplate','jaw','ear_R','ear_L','replacement_paw','tail_base','tail_mid','tail_tip'];
const restPivots=Object.fromEntries(parts.map(n=>[n,scene.getObjectByName(n).position.clone()]));
const pivotDrift=Object.fromEntries(parts.map(n=>[n,0]));
const pawLocal=scene.getObjectByName('replacement_paw').matrix.clone();let pawDrift=0;
const hipsRest=scene.getObjectByName('hips').matrixWorld.clone();
function points(){
 scene.updateMatrixWorld(true);const positions=[],bodyGroups={},tailGroups={},groups={feet:[],paw:[],tail:[],distal_tail:[],ears:[],faceplate:[],head:[],body:[],torso:[]};
 for(const [mi,mesh] of meshes.entries()){
  mesh.skeleton.update();
  for(let i=0;i<mesh.geometry.attributes.position.count;i++){
   const p=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld);positions.push(p);const bone=categories[mi][i];
   if(bone.startsWith('foot_'))groups.feet.push(p);
   if(bone==='replacement_paw')groups.paw.push(p);
   if(bone.startsWith('tail_')){groups.tail.push(p);if(distalTail[mi][i]){groups.distal_tail.push(p);(tailGroups[bone]??=[]).push(p)}}else {groups.body.push(p);(bodyGroups[bone]??=[]).push(p)}
   if(bone.startsWith('ear_'))groups.ears.push(p);
   if(['faceplate','jaw'].includes(bone))groups.faceplate.push(p);
   if(bone==='head')groups.head.push(p);
   if(['chest','hips','neck'].includes(bone))groups.torso.push(p);
  }
 }
 return {positions,groups,bodyGroups,tailGroups,box:box(positions)};
}
const rest=points(),mixer=new T.AnimationMixer(scene),union=rest.box.clone(),animations={},bindings=[];
let rootFixed=true,maxInfluences=0;
const boxDistance=(a,b)=>Math.hypot(...['x','y','z'].map(k=>Math.max(0,a.min[k]-b.max[k],b.min[k]-a.max[k])));
for(const mesh of meshes){const w=mesh.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++)maxInfluences=Math.max(maxInfluences,[w.getX(i),w.getY(i),w.getZ(i),w.getW(i)].filter(x=>x>1e-6).length)}
for(const clip of gltf.animations){
 for(const track of clip.tracks){const binding=new T.PropertyBinding(scene,track.name);binding.bind();const probe=new Float64Array(track.getValueSize()).fill(NaN);binding.getValue(probe,0);bindings.push({clip:clip.name,track:track.name,node:binding.node?.name,resolves:probe.some(Number.isFinite),targets_scene_root:binding.node===scene})}
 mixer.stopAllAction();const action=mixer.clipAction(clip).setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const total=Math.ceil(clip.duration*60),bounds=new T.Box3(),tailBounds=new T.Box3(),pawBounds=new T.Box3();
 let first,last,hold,heldDifference=0,maxDisplacement=0,maxTemporalDisplacement=0,feetMin=Infinity,tailMin=Infinity,pawChestClearance=Infinity,distalTailBodyGap=Infinity,faceHeadMaxGap=0;
 for(let i=0;i<=total;i++){
  const time=clip.duration*i/total;mixer.setTime(time);const sample=points();bounds.union(sample.box);tailBounds.union(box(sample.groups.tail));pawBounds.union(box(sample.groups.paw));
  for(let j=0;j<sample.positions.length;j++)maxDisplacement=Math.max(maxDisplacement,sample.positions[j].distanceTo(rest.positions[j]));
  if(i===0)first=sample.positions;if(i===total)last=sample.positions;
  for(let j=0;j<sample.positions.length;j++)maxTemporalDisplacement=Math.max(maxTemporalDisplacement,sample.positions[j].distanceTo(first[j]));
  if(clip.name==='defeat'&&time>=1.8){if(!hold)hold=sample.positions;else for(let j=0;j<hold.length;j++)heldDifference=Math.max(heldDifference,hold[j].distanceTo(sample.positions[j]))}
  for(const p of sample.groups.feet)feetMin=Math.min(feetMin,p.y);for(const p of sample.groups.tail)tailMin=Math.min(tailMin,p.y);
  pawChestClearance=Math.min(pawChestClearance,boxDistance(box(sample.groups.paw),box(sample.groups.torso)));
  faceHeadMaxGap=Math.max(faceHeadMaxGap,boxDistance(box(sample.groups.faceplate),box(sample.groups.head)));
  // Per-bone conservative bounds preserve height and lateral separation;
  // a single whole-body depth box falsely joins the high head to low feet.
  // Exclude only the first attached tail segment where cuff overlap is intended.
  const bodyBoxes=Object.values(sample.bodyGroups).map(box);
  const tailBoxes=Object.values(sample.tailGroups).map(box);
  distalTailBodyGap=Math.min(distalTailBodyGap,...tailBoxes.flatMap(t=>bodyBoxes.map(b=>boxDistance(t,b))));
  for(const n of parts)pivotDrift[n]=Math.max(pivotDrift[n],scene.getObjectByName(n).position.distanceTo(restPivots[n]));
  pawDrift=Math.max(pawDrift,...scene.getObjectByName('replacement_paw').matrix.elements.map((x,j)=>Math.abs(x-pawLocal.elements[j])));
  rootFixed&&=scene.position.length()<1e-8&&scene.quaternion.angleTo(new T.Quaternion())<1e-8&&scene.scale.distanceTo(new T.Vector3(1,1,1))<1e-8;
 }
 let seam=0;for(let j=0;j<first.length;j++)seam=Math.max(seam,first[j].distanceTo(last[j]));
 animations[clip.name]={duration_s:clip.duration,samples:total+1,all_vertices_per_sample:rest.positions.length,max_vertex_displacement_m:maxDisplacement,max_temporal_vertex_displacement_m:maxTemporalDisplacement,bounds_y_up:pack(bounds),tail_bounds_y_up:pack(tailBounds),replacement_paw_bounds_y_up:pack(pawBounds),loop_seam_max_m:seam,feet_min_y_m:feetMin,tail_min_y_m:tailMin,paw_chest_aabb_clearance_lower_bound_m:pawChestClearance,distal_tail_body_aabb_clearance_lower_bound_m:distalTailBodyGap,faceplate_head_max_aabb_gap_m:faceHeadMaxGap,held_defeat_difference_m:clip.name==='defeat'?heldDifference:null};union.union(bounds);
}
function sampleAttack(time){
 mixer.stopAllAction();const a=mixer.clipAction(gltf.animations.find(c=>c.name==='attack')).reset().setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();mixer.setTime(time);const p=points();
 return {time_s:time,hand_L:scene.getObjectByName('hand_L').getWorldPosition(new T.Vector3()).toArray(),paw_bounds_y_up:pack(box(p.groups.paw)),torso_bounds_y_up:pack(box(p.groups.torso)),faceplate_local_rotation:scene.getObjectByName('faceplate').quaternion.toArray(),repaired_ear_local_rotation:scene.getObjectByName('ear_L').quaternion.toArray()};
}
const contact={time_s:1.25,duration_s:2,fraction:.625,warning_hold_start_s:.82,warning_hold_end_s:1.10,samples:[0,.20,.60,.82,1.10,1.20,1.25,1.43,1.7,2].map(sampleAttack)};
sampleAttack(1.25);const directContactHand=scene.getObjectByName('hand_L').getWorldPosition(new T.Vector3());
mixer.stopAllAction();scene.updateMatrixWorld(true);const firstClone=clone(scene),secondClone=clone(scene),bones=[];scene.traverse(o=>{if(o.isBone)bones.push(o)});
const frozenSource=bones.map(b=>b.matrix.toArray()),head2=secondClone.getObjectByName('head').quaternion.clone();
const adapter=new EnemyAnimation(firstClone,gltf.animations,.625);
const frame={id:'wo104-inspection',position:{x:0,y:0,z:0},facing:0,phase:'idle',windupProgress:0,hp:100,maxHp:100},phases=[];
for(const phase of ['idle','chasing','windup','strike','cooldown']){
 frame.phase=phase;for(let i=0;i<20;i++){frame.windupProgress=Math.min(1,i/15);adapter.update(frame,.05)}
 firstClone.updateMatrixWorld(true);phases.push({phase,visible:firstClone.visible,head:firstClone.getObjectByName('head').getWorldPosition(new T.Vector3()).toArray(),hand:firstClone.getObjectByName('hand_L').getWorldPosition(new T.Vector3()).toArray()});
}
frame.hp=70;frame.phase='idle';adapter.update(frame,.1);firstClone.updateMatrixWorld(true);const hitHand=firstClone.getObjectByName('hand_L').getWorldPosition(new T.Vector3()).toArray();
for(let i=0;i<20;i++)adapter.update(frame,.05);frame.phase='defeated';let state;const defeatStates=[];
for(let i=0;i<58;i++){state=adapter.update(frame,.05);if([0,36,47,53,57].includes(i))defeatStates.push({time_s:(i+1)*.05,...state})}
scene.updateMatrixWorld(true);secondClone.updateMatrixWorld(true);firstClone.updateMatrixWorld(true);
const cloneIndependent=bones.every((b,i)=>b.matrix.toArray().every((x,j)=>Math.abs(x-frozenSource[i][j])<1e-10))&&secondClone.getObjectByName('head').quaternion.angleTo(head2)<1e-10;
const storedBounds=scene.getObjectByName('Golden_After_Hours_Rat_Skin').userData.model_space_bounds_y_up;
const rootBoneTracks=gltf.animations.flatMap(c=>c.tracks.filter(t=>t.name.startsWith('root.')).map(t=>({clip:c.name,name:t.name,constant:Array.from(t.values).every((v,i,a)=>Math.abs(v-a[i%t.getValueSize()])<1e-7)})));
const initial=contact.samples[0],warning=contact.samples.find(s=>s.time_s===.82),strike=contact.samples.find(s=>s.time_s===1.25),early=contact.samples.find(s=>s.time_s===.20);
const checks={exported_bounds_cover_all_poses:!!storedBounds&&union.min.toArray().every((v,i)=>v>=storedBounds.min[i])&&union.max.toArray().every((v,i)=>v<=storedBounds.max[i]),all_five_clips:gltf.animations.map(c=>c.name).sort().join()===['idle','move','attack','hit','defeat'].sort().join(),all_tracks_resolve_below_scene_root:bindings.every(b=>b.resolves&&!b.targets_scene_root),all_clips_move_actual_vertices:Object.values(animations).every(a=>a.max_temporal_vertex_displacement_m>.001),idle_move_seams:['idle','move'].every(n=>animations[n].loop_seam_max_m<.00001),held_defeat:animations.defeat.held_defeat_difference_m<.00001,no_floor_penetration:Object.values(animations).every(a=>a.bounds_y_up.min[1]>=-.00001),faceplate_paw_ear_tail_pivots_attached:Object.values(pivotDrift).every(d=>d<.00001),replacement_paw_rigidly_attached:pawDrift<.00001,pale_paw_clear_of_torso:Object.values(animations).every(a=>a.paw_chest_aabb_clearance_lower_bound_m>.001),distal_tail_clears_body:Object.values(animations).every(a=>a.distal_tail_body_aabb_clearance_lower_bound_m>.001),faceplate_remains_over_head:Object.values(animations).every(a=>a.faceplate_head_max_aabb_gap_m<.00001),at_most_four_influences:maxInfluences<=4,identity_root_no_motion:rootFixed,no_root_bone_motion:rootBoneTracks.every(t=>t.constant),correct_height:Math.abs(rest.box.max.y-1.70)<.001,floor_centered_rest:Math.abs(rest.box.min.y)<.00001&&Math.abs(rest.box.max.x+rest.box.min.x)<.10,one_1024_embedded_atlas:images.length===1&&images[0].width===1024&&images[0].height===1024,two_draw_primitives:meshes.length===2,actual_adapter_constructed:true,actual_adapter_defeat_vanish:state.visible===false&&state.vanish===1,adapter_root_identity:firstClone.position.length()<1e-8&&firstClone.scale.distanceTo(new T.Vector3(1,1,1))<1e-8,independent_skeleton_clone:cloneIndependent,attack_contact_1_25:Math.abs(animations.attack.duration_s*.625-1.25)<1e-9,actual_adapter_contact_pose:new T.Vector3(...phases.find(p=>p.phase==='windup').hand).distanceTo(directContactHand)<1e-5,warning_paw_outside_torso:warning.paw_bounds_y_up.min[0]>warning.torso_bounds_y_up.max[0]+.025,warning_paw_lifts:warning.paw_bounds_y_up.max[1]>initial.paw_bounds_y_up.max[1]+.30,paw_shove_at_contact:strike.hand_L[2]<warning.hand_L[2]-.20,faceplate_and_ear_delayed:new T.Quaternion(...early.faceplate_local_rotation).angleTo(new T.Quaternion(...initial.faceplate_local_rotation))<1e-6&&new T.Quaternion(...early.repaired_ear_local_rotation).angleTo(new T.Quaternion(...initial.repaired_ear_local_rotation))<1e-6};
adapter.dispose();
const boundsRecord={method:'Every exact exported skinned vertex in rest and all clips at 60 Hz; 0.005 m conservative padding.',safe_culling_envelope:{min:union.min.toArray().map(n=>Math.floor((n-.005)*1000)/1000),max:union.max.toArray().map(n=>Math.ceil((n+.005)*1000)/1000)}};
if(process.argv.includes('--write-bounds'))await writeFile(path.join(path.dirname(new URL(import.meta.url).pathname),'bounds.json'),JSON.stringify(boundsRecord,null,2)+'\n');
const record={asset_id:'golden-after-hours-rat',version:'v001',glb_sha256:createHash('sha256').update(bytes).digest('hex'),three_revision:T.REVISION,method:'Exact GLTFLoader and all exported skinned vertices at 60 Hz; SkeletonUtils independent clone; actual src/game/enemy-animation.ts. Tail clearance is the minimum conservative AABB distance across separately bounded body bones and distal tail bones, excluding only the attached base collar segment. A whole-body depth box was overly conservative because it combined upper body depth with low tail height. Faceplate attachment combines fixed local pivot and overlapping head/faceplate bounds; replacement paw uses invariant local matrix. No physical device or target-damage claim.',rest_bounds_y_up:pack(rest.box),all_animation_bounds_y_up:pack(union),dimensions_m:rest.box.getSize(new T.Vector3()).toArray(),exported_safe_bounds_y_up:storedBounds,animations,images,root_bone_tracks:rootBoneTracks,tracks:bindings,attachment_max_local_pivot_drift_m:pivotDrift,paw_max_local_matrix_drift:pawDrift,max_skin_influences:maxInfluences,contact,adapter:{phases,direct_contact_hand:directContactHand.toArray(),hit_hand:hitHand,defeat_states:defeatStates},checks};
await writeFile(path.join(root,'three-inspection.json'),JSON.stringify(record,null,2)+'\n');
const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);console.log(JSON.stringify({failures,rest:record.rest_bounds_y_up,animated:record.all_animation_bounds_y_up,animations,attachment_drift:pivotDrift,paw_drift:pawDrift,max_skin_influences:maxInfluences,contact}));process.exitCode=failures.length?1:0;
