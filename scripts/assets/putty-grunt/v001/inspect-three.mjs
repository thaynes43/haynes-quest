/** WO111 putty-grunt: exact GLTFLoader, all-vertex bounds at 60 Hz, Blender-vs-three.js skinning fidelity (the
 * non-uniform squash and stretch scales), acting checks and the actual game adapter (src/game/enemy-animation.ts).
 * node_modules/.bin/tsx inspect-three.mjs <artifact-dir> [--write-bounds]   (adapted from the inator-monster inspection) */
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import sharp from 'sharp';
import {EnemyAnimation,enemyClipNames} from '../../../../src/game/enemy-animation.ts';
globalThis.self=globalThis;
const images=[];
globalThis.createImageBitmap=async blob=>{
 const bytes=Buffer.from(await blob.arrayBuffer()),{data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 images.push({width:info.width,height:info.height,encoded_bytes:bytes.length,decoded_bytes:data.length});return {width:info.width,height:info.height,data,close(){}};
};
const root=path.resolve(process.argv[2]),bytes=await readFile(path.join(root,'putty-grunt.glb'));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const construction=JSON.parse(await readFile(path.join(root,'construction.json'),'utf8'));
const fidelity=JSON.parse(await readFile(path.join(root,'source/fidelity-samples.json'),'utf8'));
const scene=gltf.scene,meshes=[],bones=[];scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);if(o.isBone)bones.push(o)});
const B=n=>scene.getObjectByName(n);
const pack=b=>({min:b.min.toArray(),max:b.max.toArray()});
const wp=o=>o.getWorldPosition(new T.Vector3());
const gl=([x,y,z])=>new T.Vector3(x,z,-y);   // Blender Z-up point -> glTF Y-up
const colLen=(o,i)=>new T.Vector3().setFromMatrixColumn(o.matrixWorld,i).length();
function points(){
 scene.updateMatrixWorld(true);
 let minimum={y:Infinity};const positions=[],groups=Object.fromEntries(bones.map(b=>[b.name,[]]));
 for(const mesh of meshes){
  mesh.skeleton.update();const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
  for(let i=0;i<mesh.geometry.attributes.position.count;i++){
   const p=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld);positions.push(p);
   let best=0;for(let j=1;j<4;j++)if(weights.getComponent(i,j)>weights.getComponent(i,best))best=j;
   const name=mesh.skeleton.bones[indices.getComponent(i,best)].name;
   if(p.y<minimum.y)minimum={y:p.y,bone:name,vertex:i,mesh:mesh.name,position:p.toArray()};
   groups[name].push(p);
  }
 }
 return {positions,groups,minimum,box:new T.Box3().setFromPoints(positions)};
}
const restLocal=bones.map(b=>[b,b.position.clone(),b.quaternion.clone(),b.scale.clone()]);
const resetRest=()=>{for(const [b,p,q,s] of restLocal){b.position.copy(p);b.quaternion.copy(q);b.scale.copy(s)}scene.updateMatrixWorld(true)};
const rest=points(),mixer=new T.AnimationMixer(scene),union=rest.box.clone(),animations={},bindings=[];
// rest-position hash of every exported vertex (UV/normal seams duplicate a vertex; all copies share its skinning)
const key=p=>[p.x,p.y,p.z].map(v=>Math.round(v*1e4)).join(',');
const restIndex=new Map();rest.positions.forEach((p,i)=>{if(!restIndex.has(key(p)))restIndex.set(key(p),i)});
let rootFixed=true,maxInfluences=0,maxWeightError=0;
for(const mesh of meshes){const w=mesh.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++){
 const values=[w.getX(i),w.getY(i),w.getZ(i),w.getW(i)];maxInfluences=Math.max(maxInfluences,values.filter(x=>x>1e-6).length);maxWeightError=Math.max(maxWeightError,Math.abs(values.reduce((a,b)=>a+b,0)-1));
}}
const HOLD_FROM=construction.clips.find(c=>c.name==='defeat').held_final_pose_from_s;
const play=(name,time)=>{mixer.stopAllAction();const a=mixer.clipAction(gltf.animations.find(c=>c.name===name)).setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();mixer.setTime(time);scene.updateMatrixWorld(true)};
for(const clip of gltf.animations){
 for(const track of clip.tracks){
  const binding=new T.PropertyBinding(scene,track.name);binding.bind();const probe=new Float64Array(track.getValueSize()).fill(NaN);binding.getValue(probe,0);
  bindings.push({clip:clip.name,track:track.name,node:binding.node?.name,resolves:probe.some(Number.isFinite),targets_scene_root:binding.node===scene});
 }
 mixer.stopAllAction();const action=mixer.clipAction(clip).setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const total=Math.ceil(clip.duration*60),bounds=new T.Box3();let first,last,hold,heldDifference=0,maxDisplacement=0,floorCause={y:Infinity};
 for(let i=0;i<=total;i++){
  const time=clip.duration*i/total;mixer.setTime(time);const sample=points();bounds.union(sample.box);if(sample.minimum.y<floorCause.y)floorCause={...sample.minimum,time_s:time};
  if(i===0)first=sample.positions;if(i===total)last=sample.positions;
  for(let j=0;j<sample.positions.length;j++)maxDisplacement=Math.max(maxDisplacement,sample.positions[j].distanceTo(first[j]));
  if(clip.name==='defeat'&&time>=HOLD_FROM+1e-6){if(!hold)hold=sample.positions;else for(let j=0;j<hold.length;j++)heldDifference=Math.max(heldDifference,hold[j].distanceTo(sample.positions[j]));}
  rootFixed&&=scene.position.length()<1e-8&&scene.quaternion.angleTo(new T.Quaternion())<1e-8&&scene.scale.distanceTo(new T.Vector3(1,1,1))<1e-8;
 }
 let seam=0;for(let j=0;j<first.length;j++)seam=Math.max(seam,first[j].distanceTo(last[j]));
 animations[clip.name]={duration_s:clip.duration,samples:total+1,all_vertices_per_sample:rest.positions.length,max_temporal_vertex_displacement_m:maxDisplacement,bounds_y_up:pack(bounds),loop_seam_max_m:seam,floor_minimum:floorCause,held_defeat_difference_m:clip.name==='defeat'?heldDifference:null};union.union(bounds);
}
// ---- Blender-evaluated skin vs three.js skin at the sampled frames (every 9th vertex, all five clips)
const fid={};let fidWorst=0,fidMissing=0,fidCount=0;
for(const [clip,frames] of Object.entries(fidelity.clips)){
 let worst=0;
 for(const f of frames){
  play(clip,f.time_s);const p=points();
  f.rest.forEach((r,k)=>{const q=gl(r);let i=restIndex.get(key(q));
   if(i===undefined){let bd=Infinity;rest.positions.forEach((v,j)=>{const d=v.distanceToSquared(q);if(d<bd){bd=d;i=j}});if(Math.sqrt(bd)>2e-4){fidMissing++;return}}   // float32 rounding at a grid edge
   fidCount++;worst=Math.max(worst,p.positions[i].distanceTo(gl(f.posed[k])))});
 }
 fid[clip]={frames:frames.map(f=>f.frame),max_error_m:worst};fidWorst=Math.max(fidWorst,worst);
}
// ---- acting probes
const angleBetween=(a,b)=>a.angleTo(b);
play('idle',0);const guardBox=points().box;const guard={bounds_y_up:pack(guardBox),dimensions_m:guardBox.getSize(new T.Vector3()).toArray(),fist_R:wp(B('fist_R')).toArray(),fist_L:wp(B('fist_L')).toArray(),head_up:new T.Vector3(0,1,0).applyQuaternion(B('head').getWorldQuaternion(new T.Quaternion())).toArray()};
const headTilt=Math.atan2(guard.head_up[0],guard.head_up[1]);
const shoulderToFist=s=>wp(B('fist_'+s)).distanceTo(wp(B('upper_arm_'+s)));
resetRest();const restReach={R:shoulderToFist('R'),L:shoulderToFist('L')};const restHeadTop=rest.box.max.y;
const beats=[];
for(const t of [0,0.3,0.55,0.9,1.14,1.2,1.25,1.3,1.4,1.6,1.75,2]){
 play('attack',t);beats.push({time_s:t,fist_R:wp(B('fist_R')).toArray(),fist_L:wp(B('fist_L')).toArray(),reach_R:shoulderToFist('R'),reach_L:shoulderToFist('L'),
  fist_R_squash:colLen(B('fist_R'),1)/colLen(B('fist_R'),0),hips:wp(B('hips')).toArray(),head:wp(B('head')).toArray()});
}
const at=t=>beats.find(s=>Math.abs(s.time_s-t)<1e-9);
play('attack',1.25);const directContactFist=wp(B('fist_R'));
// hit: belly dent, eyes squeeze, body widens
let belly=1,eyeSq=1,width=0;for(let i=0;i<=42;i++){play('hit',0.7*i/42);belly=Math.min(belly,colLen(B('belly'),1)/colLen(B('belly'),0));eyeSq=Math.min(eyeSq,colLen(B('eye_R'),1)/colLen(B('eye_R'),0));const p=points();width=Math.max(width,p.box.max.x-p.box.min.x)}
play('idle',0);const guardWidth=points().box.getSize(new T.Vector3()).x;
// move: feet alternate and lift
let liftR=0,liftL=0;resetRest();const footRest={R:wp(B('foot_R')).y,L:wp(B('foot_L')).y};
for(let i=0;i<=48;i++){play('move',0.8*i/48);liftR=Math.max(liftR,wp(B('foot_R')).y-footRest.R);liftL=Math.max(liftL,wp(B('foot_L')).y-footRest.L)}
// defeat held: puddle height, eyes stick up and stay round, antenna above the puddle
play('defeat',gltf.animations.find(c=>c.name==='defeat').duration);
const held=points(),bodyBones=['hips','spine','chest','belly','thigh_R','thigh_L','shin_R','shin_L','foot_R','foot_L','upper_arm_R','upper_arm_L','forearm_R','forearm_L','fist_R','fist_L','shoulder_R','shoulder_L'];
const bodyTop=Math.max(...bodyBones.flatMap(n=>held.groups[n].map(v=>v.y)));
const eyeTop=Math.max(...held.groups.eye_R.map(v=>v.y),...held.groups.eye_L.map(v=>v.y));
const antTop=Math.max(...held.groups.antenna_2.map(v=>v.y));
const headTop=Math.max(...held.groups.head.map(v=>v.y));
const eyeRound=s=>{const e=B('eye_'+s),a=[0,1,2].map(i=>colLen(e,i));return Math.max(...a)/Math.min(...a)};
const beltTop=Math.max(...held.groups.belt.map(v=>v.y));
const puddle={height_all_m:held.box.max.y,body_top_m:bodyTop,head_top_m:headTop,eye_top_m:eyeTop,antenna_top_m:antTop,belt_top_m:beltTop,footprint_m:held.box.getSize(new T.Vector3()).toArray(),eye_axis_ratio:{R:eyeRound('R'),L:eyeRound('L')}};
resetRest();const restEyeRatio={R:eyeRound('R'),L:eyeRound('L')};
mixer.stopAllAction();scene.updateMatrixWorld(true);
// actual adapter
const firstClone=clone(scene),secondClone=clone(scene),frozenSource=bones.map(b=>b.matrix.toArray()),head2=secondClone.getObjectByName('head').quaternion.clone();
const adapter=new EnemyAnimation(firstClone,gltf.animations,.625);
const frame={id:'wo111-putty-grunt-inspection',position:{x:0,y:0,z:0},facing:0,phase:'idle',windupProgress:0,hp:100,maxHp:100};
const phases=[];
for(const phase of ['idle','chasing','windup','strike','cooldown']){
 frame.phase=phase;for(let i=0;i<20;i++){frame.windupProgress=Math.min(1,i/15);adapter.update(frame,.05)}
 firstClone.updateMatrixWorld(true);phases.push({phase,visible:firstClone.visible,hips:wp(firstClone.getObjectByName('hips')).toArray(),fist_R:wp(firstClone.getObjectByName('fist_R')).toArray()});
}
frame.hp=70;frame.phase='idle';adapter.update(frame,.1);firstClone.updateMatrixWorld(true);const hitBelly=colLen(firstClone.getObjectByName('belly'),1);
for(let i=0;i<20;i++)adapter.update(frame,.05);frame.phase='defeated';let state;const defeatStates=[];
for(let i=0;i<60;i++){state=adapter.update(frame,.05);if([0,20,40,47,53,59].includes(i))defeatStates.push({time_s:(i+1)*.05,...state})}
scene.updateMatrixWorld(true);secondClone.updateMatrixWorld(true);firstClone.updateMatrixWorld(true);
const cloneIndependent=bones.every((b,i)=>b.matrix.toArray().every((x,j)=>Math.abs(x-frozenSource[i][j])<1e-10))&&secondClone.getObjectByName('head').quaternion.toArray().every((x,i)=>Math.abs(x-head2.toArray()[i])<1e-10);
const storedBounds=B('Putty_Grunt_Skin')?.userData.model_space_bounds_y_up;
const rootBoneTracks=gltf.animations.flatMap(c=>c.tracks.filter(t=>t.name.startsWith('root.')).map(t=>({clip:c.name,name:t.name,constant:Array.from(t.values).every((v,i,a)=>Math.abs(v-a[i%t.getValueSize()])<1e-7)})));
const body=new T.Box3().setFromPoints([...rest.groups.hips,...rest.groups.spine,...rest.groups.chest]);
const atWindup=phases.find(p=>p.phase==='windup');
const over=at(0.55),contact=at(1.25);
const checks={exported_bounds_cover_all_poses:!!storedBounds&&union.min.toArray().every((v,i)=>v>=storedBounds.min[i])&&union.max.toArray().every((v,i)=>v<=storedBounds.max[i]),
 all_five_clips:gltf.animations.map(c=>c.name).sort().join()===[...enemyClipNames].sort().join(),all_tracks_resolve_below_scene_root:bindings.every(b=>b.resolves&&!b.targets_scene_root),all_clips_move_actual_vertices:Object.values(animations).every(a=>a.max_temporal_vertex_displacement_m>.001),
 idle_move_seams:['idle','move'].every(n=>animations[n].loop_seam_max_m<.00001),held_defeat:animations.defeat.held_defeat_difference_m<.00001,
 no_floor_penetration:Object.values(animations).every(a=>a.bounds_y_up.min[1]>=-.00001),at_most_four_influences:maxInfluences<=4,normalized_weights:maxWeightError<.00001,identity_root_no_motion:rootFixed,no_root_bone_motion:rootBoneTracks.every(t=>t.constant),
 blender_three_skinning_match:fidWorst<2e-4&&fidMissing===0&&fidCount>2000,
 ordinary_height_1_3_to_1_45_m:rest.box.max.y>=1.3&&rest.box.max.y<=1.45&&Math.abs(rest.box.max.y-construction.height_m)<.001,standing_on_floor:rest.box.min.y>=0&&rest.box.min.y<.01,floor_centred_body:Math.abs(body.max.x+body.min.x)<.05&&Math.abs(body.max.z+body.min.z)<.08,
 one_1024_embedded_atlas:images.length===1&&images[0].width===1024&&images[0].height===1024,two_opaque_draw_primitives:meshes.length===2&&meshes.every(m=>!m.material.transparent),actual_adapter_constructed:true,actual_adapter_defeat_vanish:state.visible===false&&state.vanish===1,adapter_root_identity:firstClone.position.length()<1e-8&&firstClone.scale.distanceTo(new T.Vector3(1,1,1))<1e-8,independent_skeleton_clone:cloneIndependent,
 attack_contact_1_25:Math.abs(animations.attack.duration_s*.625-1.25)<1e-9,actual_adapter_contact_pose:new T.Vector3(...atWindup.fist_R).distanceTo(directContactFist)<1e-5,
 guard_right_fist_raised_in_front:guard.fist_R[1]>0.7&&guard.fist_R[1]<0.95&&guard.fist_R[2]< -0.1,guard_left_fist_low_and_out:guard.fist_L[1]<0.62&&guard.fist_L[0]< -0.25,guard_head_tilt_to_its_right_about_8_deg:Math.abs(headTilt*180/Math.PI-8)<1.5,
 fists_overhead_in_windup:over.fist_R[1]>restHeadTop-0.15&&over.fist_L[1]>restHeadTop-0.15,
 fists_together_in_front_at_contact:contact.fist_R[2]< -0.35&&contact.fist_L[2]< -0.35&&new T.Vector3(...contact.fist_R).distanceTo(new T.Vector3(...contact.fist_L))<0.3&&contact.fist_R[1]>0.3&&contact.fist_R[1]<0.9,
 clay_arms_stretched_at_contact:contact.reach_R>restReach.R*1.12&&contact.reach_L>restReach.L*1.12,fists_squash_at_contact:contact.fist_R_squash<0.85,
 hit_belly_dent:belly<0.5,hit_eyes_squeeze:eyeSq<0.4,hit_body_squashes_wider:width>guardWidth*1.08,move_feet_lift:liftR>0.07&&liftL>0.07,
 defeat_flat_puddle:bodyTop<0.42,defeat_eyes_stick_up:eyeTop>bodyTop+0.02,defeat_eyes_stay_round:Math.abs(puddle.eye_axis_ratio.R/restEyeRatio.R-1)<0.1&&Math.abs(puddle.eye_axis_ratio.L/restEyeRatio.L-1)<0.1,defeat_antenna_above_puddle:antTop>bodyTop,defeat_belt_ring_visible:beltTop>bodyTop-0.12};
adapter.dispose();
const boundsRecord={method:'All exact exported skin vertices, rest and every clip at 60 Hz; conservative 0.005 m padding per axis.',safe_culling_envelope:{min:union.min.toArray().map(n=>Math.floor((n-.005)*1000)/1000),max:union.max.toArray().map(n=>Math.ceil((n+.005)*1000)/1000)}};
if(process.argv.includes('--write-bounds'))await writeFile(path.join(path.dirname(new URL(import.meta.url).pathname),'bounds.json'),JSON.stringify(boundsRecord,null,2)+'\n');
const record={asset_id:'putty-grunt',version:'v001',glb_sha256:createHash('sha256').update(bytes).digest('hex'),three_revision:T.REVISION,method:'Exact GLTFLoader; all exported skin vertices at 60 Hz; Blender-evaluated skin compared vertex by vertex with three.js skinning at 5 frames per clip (every 9th vertex, matched by rest position); SkeletonUtils clone; actual src/game/enemy-animation.ts. No physical-device or universal triangle-collision proof.',
 rest_bounds_y_up:pack(rest.box),all_animation_bounds_y_up:pack(union),dimensions_m:rest.box.getSize(new T.Vector3()).toArray(),height_m:rest.box.max.y,sole_clearance_m:rest.box.min.y,body_footprint_y_up:pack(body),exported_safe_bounds_y_up:storedBounds,animations,images,root_bone_tracks:rootBoneTracks,tracks:bindings,max_skin_influences:maxInfluences,max_weight_sum_error:maxWeightError,
 skinning_fidelity:{by_clip:fid,max_error_m:fidWorst,vertices_compared:fidCount,unmatched:fidMissing},guard:{...guard,head_tilt_deg:headTilt*180/Math.PI},rest_reach_m:restReach,attack_beats:beats,
 hit:{min_belly_depth_ratio:belly,min_eye_height_ratio:eyeSq,max_width_m:width,guard_width_m:guardWidth},move:{max_foot_lift_m:{R:liftR,L:liftL}},defeat_held:puddle,rest_eye_axis_ratio:restEyeRatio,
 adapter:{phases,direct_contact_fist_R:directContactFist.toArray(),hit_belly_scale:hitBelly,defeat_states:defeatStates},checks};
await writeFile(path.join(root,'three-inspection.json'),JSON.stringify(record,null,2)+'\n');
const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
console.log(JSON.stringify({failures,rest:record.rest_bounds_y_up,animated:record.all_animation_bounds_y_up,fidelity:record.skinning_fidelity,floor:Object.fromEntries(Object.entries(animations).map(([k,a])=>[k,[+a.bounds_y_up.min[1].toFixed(4),a.floor_minimum.bone,+a.floor_minimum.time_s.toFixed(3)]])),guard:record.guard,over:{R:over.fist_R,L:over.fist_L},contact:{R:contact.fist_R,L:contact.fist_L,reach:[contact.reach_R,contact.reach_L],restReach,squash:contact.fist_R_squash},hit:record.hit,move:record.move,puddle,restEyeRatio,seams:Object.fromEntries(['idle','move'].map(n=>[n,animations[n].loop_seam_max_m])),held:animations.defeat.held_defeat_difference_m}));process.exitCode=failures.length?1:0;
