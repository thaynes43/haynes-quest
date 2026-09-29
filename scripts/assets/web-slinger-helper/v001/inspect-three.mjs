/** WO111 web-slinger-helper: exact GLTFLoader, all-vertex bounds at 60 Hz, and the actual FRIENDLY runtime.
 * node_modules/.bin/tsx scripts/assets/web-slinger-helper/v001/inspect-three.mjs <artifact-dir> [--write-bounds]
 * Adapted from the WO111 demon-band-idol / rival-mayor inspect-three.mjs. A friendly is not driven by
 * src/game/enemy-animation.ts: src/game/friendly-scene.ts loops `idle`, plays `hit` for its 0.6 s hit window,
 * restarts idle at 0 s without a cross-fade, and holds the last frame of `defeat` (jumping straight to it when the
 * friend is already defeated at load). This harness drives the unmodified FriendlyScene through the real
 * SceneAssets.attach loader with the exact candidate bytes. FriendlyScene only attaches ids listed in its private
 * `heights` table and web-slinger-helper is not listed yet (coordinator integration), so the candidate GLB is served
 * at a listed friendly id's URL (blockling v001); no src file is modified. */
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import sharp from 'sharp';
import {FriendlyScene} from '../../../../src/game/friendly-scene.ts';
import {SceneAssets} from '../../../../src/game/scene-assets.ts';
globalThis.self=globalThis;
const images=[];
globalThis.createImageBitmap=async blob=>{
 const bytes=Buffer.from(await blob.arrayBuffer()),{data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 images.push({width:info.width,height:info.height,encoded_bytes:bytes.length,decoded_bytes:data.length});return {width:info.width,height:info.height,data,close(){}};
};
const root=path.resolve(process.argv[2]),bytes=await readFile(path.join(root,'web-slinger-helper.glb'));
const arrayBuffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
const gltf=await new GLTFLoader().parseAsync(arrayBuffer.slice(0),'');
const exportImages=images.slice();
const construction=JSON.parse(await readFile(path.join(root,'construction.json'),'utf8'));
const scene=gltf.scene,meshes=[],bones=[];scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);if(o.isBone)bones.push(o)});
const B=n=>scene.getObjectByName(n);
const pack=b=>({min:b.min.toArray(),max:b.max.toArray()});
const wp=o=>o.getWorldPosition(new T.Vector3());
const gl=([x,y,z])=>new T.Vector3(x,z,-y);   // Blender (x, y, z) -> glTF (x, z, -y)
scene.updateMatrixWorld(true);
function samplePoints(sceneRoot,skinned){
 sceneRoot.updateMatrixWorld(true);
 let minimum={y:Infinity};const positions=[],groups={};
 for(const mesh of skinned){
  mesh.skeleton.update();const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
  for(let i=0;i<mesh.geometry.attributes.position.count;i++){
   const p=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld);positions.push(p);
   let best=0;for(let j=1;j<4;j++)if(weights.getComponent(i,j)>weights.getComponent(i,best))best=j;
   const name=mesh.skeleton.bones[indices.getComponent(i,best)].name;
   if(p.y<minimum.y)minimum={y:p.y,bone:name,vertex:i,mesh:mesh.name,position:p.toArray()};
   (groups[name]??=[]).push(p);
  }
 }
 return {positions,groups,minimum,box:new T.Box3().setFromPoints(positions)};
}
const points=()=>samplePoints(scene,meshes);
const boxOf=pts=>pts&&pts.length?new T.Box3().setFromPoints(pts):new T.Box3();
const extent=pts=>pts&&pts.length?boxOf(pts).getSize(new T.Vector3()).length():0;
const maxDist=(a,b)=>{let d=0;for(let j=0;j<a.length;j++)d=Math.max(d,a[j].distanceTo(b[j]));return d};
const restQ=Object.fromEntries(['hips','chest'].map(n=>[n,B(n).getWorldQuaternion(new T.Quaternion())]));
const dq=n=>B(n).getWorldQuaternion(new T.Quaternion()).multiply(restQ[n].clone().invert());
const rest=points(),mixer=new T.AnimationMixer(scene),union=rest.box.clone(),animations={},bindings=[];
const restBonePositions=Object.fromEntries(bones.map(b=>[b.name,b.position.clone()]));
const restBoneQuats=Object.fromEntries(bones.map(b=>[b.name,b.quaternion.clone()]));
const localTurnDeg=n=>B(n).quaternion.angleTo(restBoneQuats[n])*180/Math.PI;
const translating=['root','hips'];
const attachments=Object.fromEntries(bones.filter(b=>!translating.includes(b.name)).map(b=>[b.name,0]));
let rootFixed=true,maxInfluences=0,maxWeightError=0;
for(const mesh of meshes){const w=mesh.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++){
 const values=[w.getX(i),w.getY(i),w.getZ(i),w.getW(i)];maxInfluences=Math.max(maxInfluences,values.filter(x=>x>1e-6).length);maxWeightError=Math.max(maxWeightError,Math.abs(values.reduce((a,b)=>a+b,0)-1));
}}
const clipOf=n=>gltf.animations.find(c=>c.name===n);
const HOLD_FROM=construction.clips.find(c=>c.name==='defeat').held_final_pose_from_s;
const play=(name,t)=>{mixer.stopAllAction();const a=mixer.clipAction(clipOf(name)).setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();mixer.setTime(t);scene.updateMatrixWorld(true)};
const poseAt=(name,t)=>{play(name,t);return points()};
for(const clip of gltf.animations){
 for(const track of clip.tracks){
  const binding=new T.PropertyBinding(scene,track.name);binding.bind();const probe=new Float64Array(track.getValueSize()).fill(NaN);binding.getValue(probe,0);
  bindings.push({clip:clip.name,track:track.name,node:binding.node?.name,resolves:probe.some(Number.isFinite),targets_scene_root:binding.node===scene});
 }
 mixer.stopAllAction();const action=mixer.clipAction(clip).setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const total=Math.ceil(clip.duration*60),bounds=new T.Box3();let first,last,hold,heldDifference=0,maxDisplacement=0,floorCause={y:Infinity},maxRope=0,maxTop=-Infinity;
 for(let i=0;i<=total;i++){
  const time=clip.duration*i/total;mixer.setTime(time);const sample=points();bounds.union(sample.box);if(sample.minimum.y<floorCause.y)floorCause={...sample.minimum,time_s:time};
  maxTop=Math.max(maxTop,sample.box.max.y);maxRope=Math.max(maxRope,extent(sample.groups.rope));
  if(i===0)first=sample.positions;if(i===total)last=sample.positions;
  maxDisplacement=Math.max(maxDisplacement,maxDist(sample.positions,first));
  if(clip.name==='defeat'&&time>=HOLD_FROM+1e-6){if(!hold)hold=sample.positions;else heldDifference=Math.max(heldDifference,maxDist(hold,sample.positions));}
  for(const b of bones)if(attachments[b.name]!==undefined)attachments[b.name]=Math.max(attachments[b.name],b.position.distanceTo(restBonePositions[b.name]));
  rootFixed&&=scene.position.length()<1e-8&&scene.quaternion.angleTo(new T.Quaternion())<1e-8&&scene.scale.distanceTo(new T.Vector3(1,1,1))<1e-8;
 }
 animations[clip.name]={duration_s:clip.duration,samples:total+1,all_vertices_per_sample:rest.positions.length,max_temporal_vertex_displacement_m:maxDisplacement,bounds_y_up:pack(bounds),top_m:maxTop,loop_seam_max_m:maxDist(first,last),floor_minimum:floorCause,max_rope_tangle_extent_m:maxRope,held_defeat_difference_m:clip.name==='defeat'?heldDifference:null};union.union(bounds);
}
// Idle 0 s is the approved sheet pose: blockout wrists, the sheet-authored heart buttons and the ankles.
const idle0=poseAt('idle',0);
const SW={R:[0.327,0.024,1.0],L:[-0.2,0.008,0.545]};
const sheet={wrist_R_error_m:wp(B('hand_R')).distanceTo(gl(SW.R)),wrist_L_error_m:wp(B('hand_L')).distanceTo(gl(SW.L)),
 heart_R:wp(B('heart_R')).toArray(),heart_L:wp(B('heart_L')).toArray(),idle0_top_m:idle0.box.max.y,idle0_bounds_y_up:pack(idle0.box),idle0_dimensions_m:idle0.box.getSize(new T.Vector3()).toArray()};
// hit / attack / defeat continuity with idle 0 (the runtime switches clips with stop() + reset().play(), no fade)
const hit0=poseAt('hit',0),hitEnd=poseAt('hit',clipOf('hit').duration),attack0=poseAt('attack',0),attackEnd=poseAt('attack',2),defeat0=poseAt('defeat',0);
let idleAmp=0;for(let i=0;i<=180;i++){idleAmp=Math.max(idleAmp,maxDist(poseAt('idle',3*i/180).positions,idle0.positions))}
const continuity={idle_max_deviation_from_idle0_m:idleAmp,hit_start_vs_idle0_m:maxDist(hit0.positions,idle0.positions),hit_end_vs_idle0_m:maxDist(hitEnd.positions,idle0.positions),attack_start_vs_idle0_m:maxDist(attack0.positions,idle0.positions),attack_end_vs_idle0_m:maxDist(attackEnd.positions,idle0.positions),defeat_start_vs_idle0_m:maxDist(defeat0.positions,idle0.positions)};
// Attack beats: point, charge (left mitten at the right cuff heart), toss at 1.25 s, fist pump
const beats=[];
for(const t of [0,.3,.6,.8,.9,1.1,1.25,1.4,1.7,2]){
 play('attack',t);
 beats.push({time_s:t,hand_R:wp(B('hand_R')).toArray(),fingers_R_tip:B('fingers_R').localToWorld(new T.Vector3(0,0.05,0)).toArray(),hand_L:wp(B('hand_L')).toArray(),heart_R:wp(B('heart_R')).toArray(),heart_R_scale:B('heart_R').scale.x,
  left_tip_to_right_heart_m:B('fingers_L').localToWorld(new T.Vector3(0,0.05,0)).distanceTo(wp(B('heart_R'))),chest:wp(B('chest')).toArray(),head:wp(B('head')).toArray(),hips_y:wp(B('hips')).y});
}
const at=t=>beats.find(s=>Math.abs(s.time_s-t)<1e-9);
// Hit: both mittens up by the hood, eyes squeezed, one foot off the floor
play('hit',.15);const hitMid={hand_R:wp(B('hand_R')).toArray(),hand_L:wp(B('hand_L')).toArray(),head:wp(B('head')).toArray(),eye_scale:B('eye_R').scale.y,foot_L:wp(B('foot_L')).toArray()};
play('hit',.2);const hitHop={foot_L_y:wp(B('foot_L')).y,foot_R_y:wp(B('foot_R')).y};
// Held defeat: seated, the rope tangle open round both ankles, the coil shrunk, mask askew
const defeatEnd=poseAt('defeat',clipOf('defeat').duration);
const ropeBox=boxOf(defeatEnd.groups.rope);
const defeatHeld={hips_height_m:wp(B('hips')).y,head_height_m:wp(B('head')).y,top_m:defeatEnd.box.max.y,rope_extent_m:extent(defeatEnd.groups.rope),rope_box_y_up:pack(ropeBox),
 ankles:{L:wp(B('foot_L')).toArray(),R:wp(B('foot_R')).toArray()},rope_scale:B('rope').scale.x,coil_scale:B('coil').scale.x,mask_roll_deg:localTurnDeg('mask'),head_turn_deg:localTurnDeg('head'),eye_scale:B('eye_R').scale.y,hand_R:wp(B('hand_R')).toArray(),hand_L:wp(B('hand_L')).toArray()};
const ankleInside=a=>new T.Box3().copy(ropeBox).expandByScalar(0.02).containsPoint(new T.Vector3(...a));
// Clone independence (the runtime attaches SkeletonUtils clones)
mixer.stopAllAction();scene.updateMatrixWorld(true);
const firstClone=clone(scene),secondClone=clone(scene),frozenSource=bones.map(b=>b.matrix.toArray()),q2=secondClone.getObjectByName('head').quaternion.clone();
const m2=new T.AnimationMixer(firstClone);m2.clipAction(clipOf('attack')).play();m2.setTime(1.25);firstClone.updateMatrixWorld(true);
const cloneIndependent=bones.every((b,i)=>b.matrix.toArray().every((x,j)=>Math.abs(x-frozenSource[i][j])<1e-10))&&secondClone.getObjectByName('head').quaternion.toArray().every((x,i)=>Math.abs(x-q2.toArray()[i])<1e-10);

// ---------------- the actual friendly runtime (src/game/friendly-scene.ts + SceneAssets.attach) ----------------
const RUNTIME_ID='blockling';
const origLoad=T.FileLoader.prototype.load;
const requested=[];
T.FileLoader.prototype.load=function(url,onLoad,onProgress,onError){requested.push(url);setTimeout(()=>{try{onLoad(arrayBuffer.slice(0))}catch(e){onError?.(e)}},0);return undefined};
async function runtimeScene(defeatedAtLoad){
 const assets=new SceneAssets();
 const placement={id:'wsh-friend-1',assetId:RUNTIME_ID,assetVersion:'v001',maxHp:3,hp:defeatedAtLoad?0:3,defeated:defeatedAtLoad,boonClaimed:false,penaltyActive:false,position:{x:0,y:0,z:0}};
 const fs=new FriendlyScene({friendlies:[placement]},assets,()=>true);
 const holder=new T.Scene();holder.add(fs.root);
 for(let i=0;i<400;i++){let n=0;fs.root.traverse(o=>{if(o.isSkinnedMesh)n++});if(n)break;await new Promise(r=>setTimeout(r,5))}
 const skinned=[];fs.root.traverse(o=>{if(o.isSkinnedMesh)skinned.push(o)});
 return {fs,holder,skinned,placement,assets};
}
const camera=new T.PerspectiveCamera();const player={x:0,y:0,z:-3};
const save=(friend)=>({adventure:{activeLevel:{friendlies:[friend]}}});
const rt={};
{
 const {fs,holder,skinned,placement}=await runtimeScene(false);
 rt.attached_skinned_meshes=skinned.length;rt.urls=[...new Set(requested)];
 const step=(seconds,log)=>{const n=Math.round(seconds*60);for(let i=0;i<n;i++){fs.update(1/60,i/60,player,camera);if(log)log(i)}};
 const pts=()=>samplePoints(holder,skinned).positions;
 fs.update(0,0,player,camera);const rt0=pts();
 rt.idle0_vs_clip_idle0_m=maxDist(rt0,idle0.positions);
 // the model turns to face the player (at -Z): its eye-line looks toward -Z
 const model=fs.root.children[0].children[0];rt.model_rotation_y=model.rotation.y;
 step(3.5);const idleLooped=pts();rt.idle_after_3_5_s_vs_clip_idle_0_5_m=maxDist(idleLooped,poseAt('idle',0.5).positions);
 // lose health: hit plays for the 0.6 s window, then idle restarts at 0 s (no fade)
 fs.sync(save({...placement,hp:2}));const hitStart=pts();
 // the idle's own motion is the largest pop the runtime can show when a hit interrupts it (no fade)
 const resident=fs.residents?.get(placement.id);const clips=[];let prev=hitStart,switchJump=null;
 rt.hit_start_pop_vs_idle_at_3_5_s_m=maxDist(hitStart,idleLooped);
 const n=Math.round(0.8*60);
 for(let i=0;i<n;i++){
  const before=resident?.current;fs.update(1/60,0,player,camera);const p=pts();const after=resident?.current;clips.push(after);
  if(before==='hit'&&after==='idle')switchJump=maxDist(p,prev);
  if(i===Math.round(0.3*60))rt.hit_mid_vs_clip_hit_0_3_m=maxDist(p,poseAt('hit',Math.min(0.3+1/60,clipOf('hit').duration)).positions);
  prev=p;
 }
 rt.clip_sequence_after_hp_loss=[...new Set(clips)];rt.hit_frames=clips.filter(c=>c==='hit').length;
 rt.hit_to_idle_switch_frame_jump_m=switchJump;
 rt.after_hit_back_in_idle_vs_clip_idle_m=maxDist(prev,poseAt('idle',(n-rt.hit_frames)/60).positions);
 // defeated: the defeat clip plays once and holds its final frame (Make amends target)
 fs.sync(save({...placement,hp:0,defeated:true}));step(2.4);const held1=pts();step(1.0);const held2=pts();
 rt.defeat_hold_drift_m=maxDist(held1,held2);rt.defeat_hold_vs_clip_end_m=maxDist(held1,defeatEnd.positions);
 rt.model_rotation_y_while_defeated=model.rotation.y;
 // make amends: back to full health, idle resumes from the sheet pose
 fs.sync(save({...placement,hp:3,defeated:false}));fs.update(1/60,0,player,camera);rt.after_amends_vs_idle0_m=maxDist(pts(),poseAt('idle',1/60).positions);
 fs.dispose();
}
{
 const {fs,holder,skinned}=await runtimeScene(true);
 fs.update(1/60,0,player,camera);rt.defeated_at_load_vs_clip_end_m=maxDist(samplePoints(holder,skinned).positions,defeatEnd.positions);fs.dispose();
}
T.FileLoader.prototype.load=origLoad;

const storedBounds=B('Web_Slinger_Helper_Skin')?.userData.model_space_bounds_y_up;
const rootBoneTracks=gltf.animations.flatMap(c=>c.tracks.filter(t=>t.name.startsWith('root.')).map(t=>({clip:c.name,name:t.name,constant:Array.from(t.values).every((v,i,a)=>Math.abs(v-a[i%t.getValueSize()])<1e-7)})));
const body=new T.Box3().setFromPoints([...(rest.groups.hips||[]),...(rest.groups.spine||[]),...(rest.groups.chest||[])]);
const contact=at(1.25),start=at(0);
const hiddenElsewhere=['idle','move','attack','hit'].every(n=>animations[n].max_rope_tangle_extent_m<0.008);
const checks={exported_bounds_cover_all_poses:!!storedBounds&&union.min.toArray().every((v,i)=>v>=storedBounds.min[i])&&union.max.toArray().every((v,i)=>v<=storedBounds.max[i]),
 all_five_clips:gltf.animations.map(c=>c.name).sort().join()===['idle','move','attack','hit','defeat'].sort().join(),all_tracks_resolve_below_scene_root:bindings.every(b=>b.resolves&&!b.targets_scene_root),all_clips_move_actual_vertices:Object.values(animations).every(a=>a.max_temporal_vertex_displacement_m>.001),idle_move_seams:['idle','move'].every(n=>animations[n].loop_seam_max_m<.00001),held_defeat:animations.defeat.held_defeat_difference_m<.00001,
 no_floor_penetration:Object.values(animations).every(a=>a.bounds_y_up.min[1]>=-.00001),attached_joint_pivots:Object.values(attachments).every(d=>d<.00001),at_most_four_influences:maxInfluences<=4,normalized_weights:maxWeightError<.00001,identity_root_no_motion:rootFixed,no_root_bone_motion:rootBoneTracks.every(t=>t.constant),
 small_character_height_0_8_to_1_4_m:rest.box.max.y>=.8&&rest.box.max.y<=1.4&&Math.abs(rest.box.max.y-construction.height_m)<.001,standing_on_floor:rest.box.min.y>=0&&rest.box.min.y<.01,floor_centred_body:Math.abs(body.max.x+body.min.x)<.03&&Math.abs(body.max.z+body.min.z)<.03,
 one_1024_embedded_atlas:exportImages.length===1&&exportImages[0].width===1024&&exportImages[0].height===1024,two_draw_primitives:meshes.length===2,independent_skeleton_clone:cloneIndependent,
 idle_0_is_the_sheet_pose:sheet.wrist_R_error_m<.001&&sheet.wrist_L_error_m<.001,
 hit_fits_runtime_0_6_s_window:clipOf('hit').duration<=0.6+1e-6,
 hit_and_attack_end_on_idle_0:continuity.hit_end_vs_idle0_m<1e-4&&continuity.attack_end_vs_idle0_m<1e-4,
 hit_attack_defeat_start_on_idle_0:continuity.hit_start_vs_idle0_m<1e-4&&continuity.attack_start_vs_idle0_m<1e-4&&continuity.defeat_start_vs_idle0_m<1e-4,
 attack_contact_1_25:Math.abs(clipOf('attack').duration*.625-1.25)<1e-9,
 toss_reaches_forward_at_contact:contact.hand_R[2]<contact.chest[2]-.25,
 charge_taps_the_right_heart:Math.min(at(.8).left_tip_to_right_heart_m,at(.9).left_tip_to_right_heart_m)<.06,
 fist_pump_above_head_height:at(1.7).hand_R[1]>at(1.7).head[1],
 hit_mittens_up_by_the_hood_and_eyes_shut:hitMid.hand_R[1]>0.9&&hitMid.hand_L[1]>0.9&&hitMid.eye_scale<0.3,
 hit_hops_on_one_foot:hitHop.foot_L_y-hitHop.foot_R_y>0.05,
 rope_tangle_hidden_outside_defeat:hiddenElsewhere&&extent(rest.groups.rope)<0.008,
 rope_tangle_binds_both_ankles_when_held:defeatHeld.rope_extent_m>0.3&&ankleInside(defeatHeld.ankles.L)&&ankleInside(defeatHeld.ankles.R),
 seated_defeat_held:defeatHeld.hips_height_m<0.2&&defeatHeld.top_m<0.95,
 friendly_runtime_attached:rt.attached_skinned_meshes===meshes.length,
 friendly_runtime_idle0_is_clip_idle0:rt.idle0_vs_clip_idle0_m<1e-5,
 friendly_runtime_idle_loops:rt.idle_after_3_5_s_vs_clip_idle_0_5_m<1e-4,
 friendly_runtime_hit_then_idle_without_a_pop:rt.hit_frames>=35&&rt.hit_frames<=37&&rt.clip_sequence_after_hp_loss.join()==='hit,idle'&&rt.hit_to_idle_switch_frame_jump_m!==null&&rt.hit_to_idle_switch_frame_jump_m<0.02&&rt.after_hit_back_in_idle_vs_clip_idle_m<1e-3,
 friendly_runtime_defeat_holds:rt.defeat_hold_drift_m<1e-6&&rt.defeat_hold_vs_clip_end_m<1e-4,
 friendly_runtime_defeated_at_load_shows_the_held_pose:rt.defeated_at_load_vs_clip_end_m<1e-4,
 friendly_runtime_faces_player:Math.abs(rt.model_rotation_y)<1e-9};
const boundsRecord={method:'All exact exported skin vertices, rest and every clip at 60 Hz; conservative 0.005 m padding per axis.',safe_culling_envelope:{min:union.min.toArray().map(n=>Math.floor((n-.005)*1000)/1000),max:union.max.toArray().map(n=>Math.ceil((n+.005)*1000)/1000)}};
if(process.argv.includes('--write-bounds'))await writeFile(path.join(path.dirname(new URL(import.meta.url).pathname),'bounds.json'),JSON.stringify(boundsRecord,null,2)+'\n');
const record={asset_id:'web-slinger-helper',version:'v001',role:'friendly helper (DESIGN-013)',glb_sha256:createHash('sha256').update(bytes).digest('hex'),three_revision:T.REVISION,
 method:'Exact GLTFLoader; all exported skin vertices at 60 Hz; SkeletonUtils clone; the unmodified src/game/friendly-scene.ts FriendlyScene driven through the real SceneAssets.attach loader (candidate bytes served at the blockling v001 URL because FriendlyScene has no heights entry for web-slinger-helper yet). Rotation/scale-only joints are checked as fixed local pivots; the hips carry every translation. No physical-device or universal triangle-collision proof (the Blender attachment audit covers listed part pairs).',
 rest_bounds_y_up:pack(rest.box),all_animation_bounds_y_up:pack(union),dimensions_m:rest.box.getSize(new T.Vector3()).toArray(),height_m:rest.box.max.y,sole_clearance_m:rest.box.min.y,body_footprint_y_up:pack(body),exported_safe_bounds_y_up:storedBounds,animations,images,root_bone_tracks:rootBoneTracks,tracks:bindings,attachment_pivot_max_drift_m:attachments,max_skin_influences:maxInfluences,max_weight_sum_error:maxWeightError,
 sheet_pose:sheet,continuity,attack_beats:beats,hit_mid:hitMid,hit_hop:hitHop,defeat_held:defeatHeld,friendly_runtime:rt,integration_note:'src/game/friendly-scene.ts attaches only ids in its heights table; the coordinator must add web-slinger-helper (about 1.19 m) for the model to load in game.',checks};
await writeFile(path.join(root,'three-inspection.json'),JSON.stringify(record,null,2)+'\n');
const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
console.log(JSON.stringify({failures,rest:record.rest_bounds_y_up,animated:record.all_animation_bounds_y_up,floor:Object.fromEntries(Object.entries(animations).map(([k,a])=>[k,[+a.bounds_y_up.min[1].toFixed(4),a.floor_minimum.bone,+a.floor_minimum.time_s.toFixed(3)]])),sheet:{r:sheet.wrist_R_error_m,l:sheet.wrist_L_error_m,top:sheet.idle0_top_m},continuity,contact,charge:[at(.8).left_tip_to_right_heart_m,at(.9).left_tip_to_right_heart_m],hitMid,hitHop,defeatHeld:{hips:defeatHeld.hips_height_m,top:defeatHeld.top_m,rope:defeatHeld.rope_extent_m,ankles:defeatHeld.ankles,box:defeatHeld.rope_box_y_up},rope:Object.fromEntries(Object.entries(animations).map(([k,a])=>[k,a.max_rope_tangle_extent_m])),rt,maxInfluences}));process.exitCode=failures.length?1:0;
