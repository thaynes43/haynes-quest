/** WO111 demon-band-idol: exact GLTFLoader, all-vertex bounds at 60 Hz, and the actual game adapter.
 * node_modules/.bin/tsx scripts/assets/demon-band-idol/v001/inspect-three.mjs <artifact-dir> [--write-bounds]
 * Adapted from the rival-mayor v001 inspect-three.mjs. */
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
const root=path.resolve(process.argv[2]),bytes=await readFile(path.join(root,'demon-band-idol.glb'));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const construction=JSON.parse(await readFile(path.join(root,'construction.json'),'utf8'));
const scene=gltf.scene,meshes=[],bones=[];scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);if(o.isBone)bones.push(o)});
const B=n=>scene.getObjectByName(n);
const pack=b=>({min:b.min.toArray(),max:b.max.toArray()});
const wp=o=>o.getWorldPosition(new T.Vector3());
const gl=([x,y,z])=>new T.Vector3(x,z,-y);   // Blender (x, y, z) -> glTF (x, z, -y)
scene.updateMatrixWorld(true);
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
const boxOf=pts=>new T.Box3().setFromPoints(pts);
const restQ=Object.fromEntries(['hips','chest'].map(n=>[n,B(n).getWorldQuaternion(new T.Quaternion())]));
const dq=n=>B(n).getWorldQuaternion(new T.Quaternion()).multiply(restQ[n].clone().invert());
const rest=points(),mixer=new T.AnimationMixer(scene),union=rest.box.clone(),animations={},bindings=[];
const restBonePositions=Object.fromEntries(bones.map(b=>[b.name,b.position.clone()]));
// Rotation/scale-only joints keep their local pivot; the hips carry the bounce, lunge, spin and bow by design.
const translating=['root','hips'];
const attachments=Object.fromEntries(bones.filter(b=>!translating.includes(b.name)).map(b=>[b.name,0]));
let rootFixed=true,maxInfluences=0,maxWeightError=0;
for(const mesh of meshes){const w=mesh.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++){
 const values=[w.getX(i),w.getY(i),w.getZ(i),w.getW(i)];maxInfluences=Math.max(maxInfluences,values.filter(x=>x>1e-6).length);maxWeightError=Math.max(maxWeightError,Math.abs(values.reduce((a,b)=>a+b,0)-1));
}}
const HOLD_FROM=construction.clips.find(c=>c.name==='defeat').held_final_pose_from_s;
const burstExtent=()=>{const g=points().groups.burst;return g.length?boxOf(g).getSize(new T.Vector3()).length():0};
for(const clip of gltf.animations){
 for(const track of clip.tracks){
  const binding=new T.PropertyBinding(scene,track.name);binding.bind();const probe=new Float64Array(track.getValueSize()).fill(NaN);binding.getValue(probe,0);
  bindings.push({clip:clip.name,track:track.name,node:binding.node?.name,resolves:probe.some(Number.isFinite),targets_scene_root:binding.node===scene});
 }
 mixer.stopAllAction();const action=mixer.clipAction(clip).setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const total=Math.ceil(clip.duration*60),bounds=new T.Box3();let first,last,hold,heldDifference=0,maxDisplacement=0,floorCause={y:Infinity},maxBurst=0,maxTop=-Infinity;
 for(let i=0;i<=total;i++){
  const time=clip.duration*i/total;mixer.setTime(time);const sample=points();bounds.union(sample.box);if(sample.minimum.y<floorCause.y)floorCause={...sample.minimum,time_s:time};
  maxTop=Math.max(maxTop,sample.box.max.y);maxBurst=Math.max(maxBurst,boxOf(sample.groups.burst).getSize(new T.Vector3()).length());
  if(i===0)first=sample.positions;if(i===total)last=sample.positions;
  for(let j=0;j<sample.positions.length;j++)maxDisplacement=Math.max(maxDisplacement,sample.positions[j].distanceTo(first[j]));
  if(clip.name==='defeat'&&time>=HOLD_FROM+1e-6){if(!hold)hold=sample.positions;else for(let j=0;j<hold.length;j++)heldDifference=Math.max(heldDifference,hold[j].distanceTo(sample.positions[j]));}
  for(const b of bones)if(attachments[b.name]!==undefined)attachments[b.name]=Math.max(attachments[b.name],b.position.distanceTo(restBonePositions[b.name]));
  rootFixed&&=scene.position.length()<1e-8&&scene.quaternion.angleTo(new T.Quaternion())<1e-8&&scene.scale.distanceTo(new T.Vector3(1,1,1))<1e-8;
 }
 let seam=0;for(let j=0;j<first.length;j++)seam=Math.max(seam,first[j].distanceTo(last[j]));
 animations[clip.name]={duration_s:clip.duration,samples:total+1,all_vertices_per_sample:rest.positions.length,max_temporal_vertex_displacement_m:maxDisplacement,bounds_y_up:pack(bounds),top_m:maxTop,loop_seam_max_m:seam,floor_minimum:floorCause,max_burst_extent_m:maxBurst,held_defeat_difference_m:clip.name==='defeat'?heldDifference:null};union.union(bounds);
}
const play=(name,t)=>{mixer.stopAllAction();const a=mixer.clipAction(gltf.animations.find(c=>c.name===name)).setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();mixer.setTime(t);scene.updateMatrixWorld(true)};
// Idle 0 s must be the approved sheet pose: the blockout mic grille, fist and feet positions.
const MIC_A=[0.227,0.168,0.83],MIC_B=[0.22,0.184,0.955];const md=new T.Vector3(...MIC_B).sub(new T.Vector3(...MIC_A)).normalize();
const MIC_G=new T.Vector3(...MIC_B).addScaledVector(md,0.034);
play('idle',0);
const sheet={grille:wp(B('burst')).toArray(),grille_expected_blender:MIC_G.toArray(),grille_error_m:wp(B('burst')).distanceTo(gl(MIC_G.toArray())),
 mic_fist_error_m:wp(B('mic')).distanceTo(gl([0.226,0.17,0.885])),idle0_top_m:points().box.max.y};
// Attack beats sampled directly from the clip (the burst bone sits at the grille centre).
const beats=[];
for(const t of [0,.30,.55,.72,.90,1.10,1.18,1.25,1.35,1.60,2]){
 play('attack',t);const fwd=new T.Vector3(0,0,-1).applyQuaternion(dq('hips'));
 beats.push({time_s:t,grille:wp(B('burst')).toArray(),burst_scale:B('burst').scale.x,hand_L:wp(B('hand_L')).toArray(),head:wp(B('head')).toArray(),hips_facing_deg:Math.atan2(-fwd.x,-fwd.z)*180/Math.PI,burst_extent_m:burstExtent()});
}
const at=t=>beats.find(s=>Math.abs(s.time_s-t)<1e-9);
play('attack',1.25);const directContactGrille=wp(B('burst'));
// Held defeat: the chest's up axis pitched forward into the bow, the hips lowered.
play('defeat',gltf.animations.find(c=>c.name==='defeat').duration);
const chestUp=new T.Vector3(0,1,0).applyQuaternion(dq('chest'));
const defeatHeld={chest_pitch_forward_deg:Math.acos(Math.max(-1,Math.min(1,chestUp.y)))*180/Math.PI,chest_up_axis:chestUp.toArray(),hips_height_m:wp(B('hips')).y,head_height_m:wp(B('head')).y,grille:wp(B('burst')).toArray()};
play('hit',.2);const hitHead=wp(B('head')).toArray();
mixer.stopAllAction();scene.updateMatrixWorld(true);
const firstClone=clone(scene),secondClone=clone(scene),frozenSource=bones.map(b=>b.matrix.toArray()),q2=secondClone.getObjectByName('head').quaternion.clone();
const adapter=new EnemyAnimation(firstClone,gltf.animations,.625);
const frame={id:'wo111-demon-band-idol-inspection',position:{x:0,y:0,z:0},facing:0,phase:'idle',windupProgress:0,hp:100,maxHp:100};
const phases=[];
for(const phase of ['idle','chasing','windup','strike','cooldown']){
 frame.phase=phase;for(let i=0;i<20;i++){frame.windupProgress=Math.min(1,i/15);adapter.update(frame,.05)}
 firstClone.updateMatrixWorld(true);phases.push({phase,visible:firstClone.visible,hips:wp(firstClone.getObjectByName('hips')).toArray(),grille:wp(firstClone.getObjectByName('burst')).toArray(),burst_scale:firstClone.getObjectByName('burst').scale.x});
}
frame.hp=70;frame.phase='idle';adapter.update(frame,.1);firstClone.updateMatrixWorld(true);const hitHeadAdapter=wp(firstClone.getObjectByName('head')).toArray();
for(let i=0;i<20;i++)adapter.update(frame,.05);frame.phase='defeated';let state;const defeatStates=[];
for(let i=0;i<70;i++){state=adapter.update(frame,.05);if([0,35,49,55,69].includes(i))defeatStates.push({time_s:(i+1)*.05,...state})}
scene.updateMatrixWorld(true);secondClone.updateMatrixWorld(true);firstClone.updateMatrixWorld(true);
const cloneIndependent=bones.every((b,i)=>b.matrix.toArray().every((x,j)=>Math.abs(x-frozenSource[i][j])<1e-10))&&secondClone.getObjectByName('head').quaternion.toArray().every((x,i)=>Math.abs(x-q2.toArray()[i])<1e-10);
const storedBounds=B('Demon_Band_Idol_Skin')?.userData.model_space_bounds_y_up;
const rootBoneTracks=gltf.animations.flatMap(c=>c.tracks.filter(t=>t.name.startsWith('root.')).map(t=>({clip:c.name,name:t.name,constant:Array.from(t.values).every((v,i,a)=>Math.abs(v-a[i%t.getValueSize()])<1e-7)})));
const restA=at(0),contact=at(1.25);
const body=new T.Box3().setFromPoints([...rest.groups.hips,...rest.groups.spine,...rest.groups.chest]);
const atWindup=phases.find(p=>p.phase==='windup');
const spinFacings=[.55,.72,.90].map(t=>at(t).hips_facing_deg);
const checks={exported_bounds_cover_all_poses:!!storedBounds&&union.min.toArray().every((v,i)=>v>=storedBounds.min[i])&&union.max.toArray().every((v,i)=>v<=storedBounds.max[i]),
 all_five_clips:gltf.animations.map(c=>c.name).sort().join()===['idle','move','attack','hit','defeat'].sort().join(),all_tracks_resolve_below_scene_root:bindings.every(b=>b.resolves&&!b.targets_scene_root),all_clips_move_actual_vertices:Object.values(animations).every(a=>a.max_temporal_vertex_displacement_m>.001),idle_move_seams:['idle','move'].every(n=>animations[n].loop_seam_max_m<.00001),held_defeat:animations.defeat.held_defeat_difference_m<.00001,
 no_floor_penetration:Object.values(animations).every(a=>a.bounds_y_up.min[1]>=-.00001),attached_joint_pivots:Object.values(attachments).every(d=>d<.00001),at_most_four_influences:maxInfluences<=4,normalized_weights:maxWeightError<.00001,identity_root_no_motion:rootFixed,no_root_bone_motion:rootBoneTracks.every(t=>t.constant),
 ordinary_height_0_8_to_1_4_m:rest.box.max.y>=.8&&rest.box.max.y<=1.4&&Math.abs(rest.box.max.y-construction.height_m)<.001,standing_on_floor:rest.box.min.y>=0&&rest.box.min.y<.01,floor_centred_body:Math.abs(body.max.x+body.min.x)<.03&&Math.abs(body.max.z+body.min.z)<.03,
 one_1024_embedded_atlas:images.length===1&&images[0].width===1024&&images[0].height===1024,two_draw_primitives:meshes.length===2,actual_adapter_constructed:true,actual_adapter_defeat_vanish:state.visible===false&&state.vanish===1,adapter_root_identity:firstClone.position.length()<1e-8&&firstClone.scale.distanceTo(new T.Vector3(1,1,1))<1e-8,independent_skeleton_clone:cloneIndependent,
 attack_contact_1_25:Math.abs(animations.attack.duration_s*.625-1.25)<1e-9,actual_adapter_contact_pose:new T.Vector3(...atWindup.grille).distanceTo(directContactGrille)<1e-5,
 idle_0_is_the_sheet_pose:sheet.grille_error_m<.001&&sheet.mic_fist_error_m<.001,
 burst_closed_inside_grille_at_rest_and_idle:restA.burst_scale<1.001&&restA.burst_extent_m<.035&&['idle','move','hit','defeat'].every(n=>animations[n].max_burst_extent_m<.035),
 sparkle_burst_open_at_contact:contact.burst_scale>20&&contact.burst_extent_m>.3,
 full_spin_in_place_0_4_to_1_04_s:Math.abs(Math.abs(spinFacings[1])-180)<45&&spinFacings.some(f=>Math.abs(f)>45&&Math.abs(f)<135),
 mic_thrust_at_player_at_contact:contact.grille[2]<restA.grille[2]-.25,free_hand_up_at_contact:contact.hand_L[1]>contact.head[1],
 dramatic_bow_held:defeatHeld.chest_pitch_forward_deg>55&&defeatHeld.head_height_m<.95};
adapter.dispose();
const boundsRecord={method:'All exact exported skin vertices, rest and every clip at 60 Hz; conservative 0.005 m padding per axis.',safe_culling_envelope:{min:union.min.toArray().map(n=>Math.floor((n-.005)*1000)/1000),max:union.max.toArray().map(n=>Math.ceil((n+.005)*1000)/1000)}};
if(process.argv.includes('--write-bounds'))await writeFile(path.join(path.dirname(new URL(import.meta.url).pathname),'bounds.json'),JSON.stringify(boundsRecord,null,2)+'\n');
const record={asset_id:'demon-band-idol',version:'v001',glb_sha256:createHash('sha256').update(bytes).digest('hex'),three_revision:T.REVISION,method:'Exact GLTFLoader; all exported skin vertices at 60 Hz; SkeletonUtils clone; actual src/game/enemy-animation.ts. Rotation/scale-only joints are checked as fixed local pivots; the hips bounce/lunge/spin/bow are the intentional translations. No physical-device or universal triangle-collision proof (the Blender attachment audit covers listed part pairs).',
 rest_bounds_y_up:pack(rest.box),all_animation_bounds_y_up:pack(union),dimensions_m:rest.box.getSize(new T.Vector3()).toArray(),height_m:rest.box.max.y,sole_clearance_m:rest.box.min.y,body_footprint_y_up:pack(body),exported_safe_bounds_y_up:storedBounds,animations,images,root_bone_tracks:rootBoneTracks,tracks:bindings,attachment_pivot_max_drift_m:attachments,max_skin_influences:maxInfluences,max_weight_sum_error:maxWeightError,
 sheet_pose:sheet,attack_beats:beats,defeat_held:defeatHeld,hit_head_0_2_s:hitHead,adapter:{phases,direct_contact_grille:directContactGrille.toArray(),hit_head:hitHeadAdapter,defeat_states:defeatStates},checks};
await writeFile(path.join(root,'three-inspection.json'),JSON.stringify(record,null,2)+'\n');
const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);console.log(JSON.stringify({failures,rest:record.rest_bounds_y_up,animated:record.all_animation_bounds_y_up,floor:Object.fromEntries(Object.entries(animations).map(([k,a])=>[k,[+a.bounds_y_up.min[1].toFixed(4),a.floor_minimum.bone]])),sheet,spinFacings,contact,defeatHeld,maxInfluences}));process.exitCode=failures.length?1:0;
