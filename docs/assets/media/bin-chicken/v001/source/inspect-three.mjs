/** WO111 bin-chicken: exact GLTFLoader, all-vertex bounds at 60 Hz, and the actual game adapter.
 * node_modules/.bin/tsx inspect-three.mjs <artifact-dir> [--write-bounds]   (run from scripts/assets/bin-chicken/v001)
 * Adapted from the rival-mayor v001 inspection. */
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
const root=path.resolve(process.argv[2]),bytes=await readFile(path.join(root,'bin-chicken.glb'));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const construction=JSON.parse(await readFile(path.join(root,'construction.json'),'utf8'));
const scene=gltf.scene,meshes=[],bones=[];scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);if(o.isBone)bones.push(o)});
const B=n=>scene.getObjectByName(n);
const pack=b=>({min:b.min.toArray(),max:b.max.toArray()});
const wp=o=>o.getWorldPosition(new T.Vector3());
scene.updateMatrixWorld(true);
// Blender rest points (x, y, z) -> glTF (x, z, -y), carried rigidly in a bone's frame.
const gl=([x,y,z])=>new T.Vector3(x,z,-y);
const carried=(bone,blender)=>{const local=gl(blender).applyMatrix4(B(bone).matrixWorld.clone().invert());return ()=>local.clone().applyMatrix4(B(bone).matrixWorld)};
const beakTip=carried('beak',[0,0.5905,0.835]);
const inHead=o=>wp(o).applyMatrix4(B('head').matrixWorld.clone().invert());
const peelRestInHead=inHead(B('peel'));
const inLoot=o=>wp(o).applyMatrix4(B('loot').matrixWorld.clone().invert());
const chipsRestInLoot=inLoot(B('loot_chips'));
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
const rest=points(),mixer=new T.AnimationMixer(scene),union=rest.box.clone(),animations={},bindings=[];
const restBonePositions=Object.fromEntries(bones.map(b=>[b.name,b.position.clone()]));
// Rotation-only joints keep their local pivot. hips (bob, lunge, belly flop), peel (pop, slide), beak_chip (flip, drop),
// loot (tip over), loot_chips (jump, spill) and brow_R (raise/lower) translate by design.
const translating=['root','hips','peel','beak_chip','loot','loot_chips','brow_R'];
const attachments=Object.fromEntries(bones.filter(b=>!translating.includes(b.name)).map(b=>[b.name,0]));
let rootFixed=true,maxInfluences=0,maxWeightError=0;
for(const mesh of meshes){const w=mesh.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++){
 const values=[w.getX(i),w.getY(i),w.getZ(i),w.getW(i)];maxInfluences=Math.max(maxInfluences,values.filter(x=>x>1e-6).length);maxWeightError=Math.max(maxWeightError,Math.abs(values.reduce((a,b)=>a+b,0)-1));
}}
const HOLD_FROM=construction.clips.find(c=>c.name==='defeat').held_final_pose_from_s;
for(const clip of gltf.animations){
 for(const track of clip.tracks){
  const binding=new T.PropertyBinding(scene,track.name);binding.bind();const probe=new Float64Array(track.getValueSize()).fill(NaN);binding.getValue(probe,0);
  bindings.push({clip:clip.name,track:track.name,node:binding.node?.name,resolves:probe.some(Number.isFinite),targets_scene_root:binding.node===scene});
 }
 mixer.stopAllAction();const action=mixer.clipAction(clip).setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const total=Math.ceil(clip.duration*60),bounds=new T.Box3();let first,last,hold,heldDifference=0,maxDisplacement=0,floorCause={y:Infinity},peelLift=0,chipsLift=0;
 for(let i=0;i<=total;i++){
  const time=clip.duration*i/total;mixer.setTime(time);const sample=points();bounds.union(sample.box);if(sample.minimum.y<floorCause.y)floorCause={...sample.minimum,time_s:time};
  if(i===0)first=sample.positions;if(i===total)last=sample.positions;
  for(let j=0;j<sample.positions.length;j++)maxDisplacement=Math.max(maxDisplacement,sample.positions[j].distanceTo(first[j]));
  if(clip.name==='defeat'&&time>=HOLD_FROM+1e-6){if(!hold)hold=sample.positions;else for(let j=0;j<hold.length;j++)heldDifference=Math.max(heldDifference,hold[j].distanceTo(sample.positions[j]));}
  peelLift=Math.max(peelLift,inHead(B('peel')).y-peelRestInHead.y);
  chipsLift=Math.max(chipsLift,inLoot(B('loot_chips')).distanceTo(chipsRestInLoot));
  for(const b of bones)if(attachments[b.name]!==undefined)attachments[b.name]=Math.max(attachments[b.name],b.position.distanceTo(restBonePositions[b.name]));
  rootFixed&&=scene.position.length()<1e-8&&scene.quaternion.angleTo(new T.Quaternion())<1e-8&&scene.scale.distanceTo(new T.Vector3(1,1,1))<1e-8;
 }
 let seam=0;for(let j=0;j<first.length;j++)seam=Math.max(seam,first[j].distanceTo(last[j]));
 animations[clip.name]={duration_s:clip.duration,samples:total+1,all_vertices_per_sample:rest.positions.length,max_temporal_vertex_displacement_m:maxDisplacement,bounds_y_up:pack(bounds),loop_seam_max_m:seam,floor_minimum:floorCause,max_peel_lift_in_head_m:peelLift,max_loot_chips_jump_in_cone_m:chipsLift,held_defeat_difference_m:clip.name==='defeat'?heldDifference:null};union.union(bounds);
}
// Culling note (informational, not a pass/fail check): three.js computes a SkinnedMesh bounding sphere once, at the
// pose of its first frustum test, and never refreshes it. Measure how far each primitive's animated vertices leave the
// sphere computed at idle 0 s (the first pose the game renders) versus the exported safe envelope.
const staleCulling={};
{
 mixer.stopAllAction();const ia=mixer.clipAction(gltf.animations.find(c=>c.name==='idle')).setLoop(T.LoopOnce,1);ia.play();mixer.setTime(0);scene.updateMatrixWorld(true);
 const spheres=meshes.map(m=>{m.skeleton.update();m.boundingSphere=null;m.computeBoundingSphere();return m.boundingSphere.clone()});
 for(const [k,m] of meshes.entries())staleCulling[m.material.name||('primitive '+k)]={idle0_sphere_centre:spheres[k].center.toArray(),idle0_sphere_radius:spheres[k].radius,max_outside_m:0,worst:null};
 for(const clip of gltf.animations){
  mixer.stopAllAction();const a=mixer.clipAction(clip).setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();
  for(let i=0;i<=Math.ceil(clip.duration*30);i++){
   const t=Math.min(clip.duration,i/30);mixer.setTime(t);scene.updateMatrixWorld(true);
   for(const [k,m] of meshes.entries()){m.skeleton.update();const rec=staleCulling[m.material.name||('primitive '+k)];const v=new T.Vector3();
    for(let j=0;j<m.geometry.attributes.position.count;j+=3){m.getVertexPosition(j,v);const out=v.distanceTo(spheres[k].center)-spheres[k].radius;if(out>rec.max_outside_m){rec.max_outside_m=out;rec.worst={clip:clip.name,time_s:t}}}}
  }
 }
 for(const m of meshes)m.boundingSphere=null;
 mixer.stopAllAction();scene.updateMatrixWorld(true);
}
// Attack beats sampled directly from the clip.
const attack=gltf.animations.find(c=>c.name==='attack');mixer.stopAllAction();const aa=mixer.clipAction(attack).setLoop(T.LoopOnce,1);aa.clampWhenFinished=true;aa.play();
const beats=[];
for(const t of [0,.40,.90,1.00,1.10,1.18,1.25,1.35,1.40,1.68,2]){
 mixer.setTime(t);scene.updateMatrixWorld(true);
 beats.push({time_s:t,beak_tip:beakTip().toArray(),head:wp(B('head')).toArray(),chip:wp(B('beak_chip')).toArray(),hips:wp(B('hips')).toArray()});
}
const at=t=>beats.find(s=>Math.abs(s.time_s-t)<1e-9);
const directContactTip=new T.Vector3(...at(1.25).beak_tip);
mixer.stopAllAction();scene.updateMatrixWorld(true);
// Defeat held pose: the dropped chip on the floor away from the beak, the body flopped low.
const dclip=gltf.animations.find(c=>c.name==='defeat');const da=mixer.clipAction(dclip).setLoop(T.LoopOnce,1);da.clampWhenFinished=true;da.play();mixer.setTime(dclip.duration);scene.updateMatrixWorld(true);
const defeatHeld={chip:wp(B('beak_chip')).toArray(),chip_to_beak_tip_m:wp(B('beak_chip')).distanceTo(beakTip()),beak_tip:beakTip().toArray(),hips_height_m:wp(B('hips')).y,head:wp(B('head')).toArray(),loot_chips:wp(B('loot_chips')).toArray()};
mixer.stopAllAction();scene.updateMatrixWorld(true);
const firstClone=clone(scene),secondClone=clone(scene),frozenSource=bones.map(b=>b.matrix.toArray()),peel2=secondClone.getObjectByName('peel').quaternion.clone();
const adapter=new EnemyAnimation(firstClone,gltf.animations,.625);
const frame={id:'wo111-bin-chicken-inspection',position:{x:0,y:0,z:0},facing:0,phase:'idle',windupProgress:0,hp:100,maxHp:100};
const cloneTip=()=>{const b=firstClone.getObjectByName('beak');const local=gl([0,0.5905,0.835]).applyMatrix4(B('beak').matrixWorld.clone().invert());return local.applyMatrix4(b.matrixWorld)};
const phases=[];
for(const phase of ['idle','chasing','windup','strike','cooldown']){
 frame.phase=phase;for(let i=0;i<20;i++){frame.windupProgress=Math.min(1,i/15);adapter.update(frame,.05)}
 firstClone.updateMatrixWorld(true);phases.push({phase,visible:firstClone.visible,hips:wp(firstClone.getObjectByName('hips')).toArray(),beak_tip:cloneTip().toArray()});
}
frame.hp=70;frame.phase='idle';adapter.update(frame,.1);firstClone.updateMatrixWorld(true);const hitPeel=wp(firstClone.getObjectByName('peel')).toArray();
for(let i=0;i<20;i++)adapter.update(frame,.05);frame.phase='defeated';let state;const defeatStates=[];
for(let i=0;i<60;i++){state=adapter.update(frame,.05);if([0,35,47,53,59].includes(i))defeatStates.push({time_s:(i+1)*.05,...state})}
scene.updateMatrixWorld(true);secondClone.updateMatrixWorld(true);firstClone.updateMatrixWorld(true);
const cloneIndependent=bones.every((b,i)=>b.matrix.toArray().every((x,j)=>Math.abs(x-frozenSource[i][j])<1e-10))&&secondClone.getObjectByName('peel').quaternion.toArray().every((x,i)=>Math.abs(x-peel2.toArray()[i])<1e-10);
const storedBounds=B('Bin_Chicken_Skin')?.userData.model_space_bounds_y_up;
const rootBoneTracks=gltf.animations.flatMap(c=>c.tracks.filter(t=>t.name.startsWith('root.')).map(t=>({clip:c.name,name:t.name,constant:Array.from(t.values).every((v,i,a)=>Math.abs(v-a[i%t.getValueSize()])<1e-7)})));
const sheet=at(0),reared=at(1.00),strike=at(1.25);
// Body = hips+chest-weighted vertices (the egg plus the plume roots, thighs and ruff); its centre sits within 4 cm of the root.
const body=new T.Box3().setFromPoints([...rest.groups.hips,...rest.groups.chest]);
const atWindup=phases.find(p=>p.phase==='windup');
const checks={exported_bounds_cover_all_poses:!!storedBounds&&union.min.toArray().every((v,i)=>v>=storedBounds.min[i])&&union.max.toArray().every((v,i)=>v<=storedBounds.max[i]),
 all_five_clips:gltf.animations.map(c=>c.name).sort().join()===['idle','move','attack','hit','defeat'].sort().join(),all_tracks_resolve_below_scene_root:bindings.every(b=>b.resolves&&!b.targets_scene_root),all_clips_move_actual_vertices:Object.values(animations).every(a=>a.max_temporal_vertex_displacement_m>.001),idle_move_seams:['idle','move'].every(n=>animations[n].loop_seam_max_m<.00001),held_defeat:animations.defeat.held_defeat_difference_m<.00001,
 no_floor_penetration:Object.values(animations).every(a=>a.bounds_y_up.min[1]>=-.00001),attached_joint_pivots:Object.values(attachments).every(d=>d<.00001),at_most_four_influences:maxInfluences<=4,normalized_weights:maxWeightError<.00001,identity_root_no_motion:rootFixed,no_root_bone_motion:rootBoneTracks.every(t=>t.constant),
 ordinary_height_0_8_to_1_4_m:rest.box.max.y>=.8&&rest.box.max.y<=1.4&&Math.abs(rest.box.max.y-construction.height_m)<.001,standing_on_floor:rest.box.min.y>=0&&rest.box.min.y<.01,floor_centred_body:Math.abs(body.max.x+body.min.x)<.03&&Math.abs(body.max.z+body.min.z)<.08,
 one_1024_embedded_atlas:images.length===1&&images[0].width===1024&&images[0].height===1024,two_draw_primitives:meshes.length===2,actual_adapter_constructed:true,actual_adapter_defeat_vanish:state.visible===false&&state.vanish===1,adapter_root_identity:firstClone.position.length()<1e-8&&firstClone.scale.distanceTo(new T.Vector3(1,1,1))<1e-8,independent_skeleton_clone:cloneIndependent,
 attack_contact_1_25:Math.abs(animations.attack.duration_s*.625-1.25)<1e-9,actual_adapter_contact_pose:new T.Vector3(...atWindup.beak_tip).distanceTo(directContactTip)<1e-5,
 rears_back_before_jab:reared.beak_tip[2]>sheet.beak_tip[2]+.12&&reared.beak_tip[1]>sheet.beak_tip[1]+.12,
 beak_jab_forward_at_contact:strike.beak_tip[2]<sheet.beak_tip[2]-.25,chip_still_in_beak_at_contact:new T.Vector3(...strike.chip).distanceTo(new T.Vector3(...strike.beak_tip))<.08,
 peel_pops_on_hit:animations.hit.max_peel_lift_in_head_m>.08,loot_chips_jump_on_hit:animations.hit.max_loot_chips_jump_in_cone_m>.06,
 defeat_drops_the_chip_to_the_floor:defeatHeld.chip[1]<.03&&defeatHeld.chip_to_beak_tip_m>.15,flopped_defeat:defeatHeld.hips_height_m<.2};
adapter.dispose();
const boundsRecord={method:'All exact exported skin vertices, rest and every clip at 60 Hz; conservative 0.005 m padding per axis.',safe_culling_envelope:{min:union.min.toArray().map(n=>Math.floor((n-.005)*1000)/1000),max:union.max.toArray().map(n=>Math.ceil((n+.005)*1000)/1000)}};
if(process.argv.includes('--write-bounds'))await writeFile(path.join(path.dirname(new URL(import.meta.url).pathname),'bounds.json'),JSON.stringify(boundsRecord,null,2)+'\n');
const record={asset_id:'bin-chicken',version:'v001',glb_sha256:createHash('sha256').update(bytes).digest('hex'),three_revision:T.REVISION,method:'Exact GLTFLoader; all exported skin vertices at 60 Hz; SkeletonUtils clone; actual src/game/enemy-animation.ts. Rotation-only joints are checked as fixed local pivots; the hips bob/lunge/flop, peel pop/slide, chip flip/drop, loot tip, loot-chips jump/spill and brow raise are the intentional translations. No physical-device or universal triangle-collision proof (the Blender attachment audit covers listed part pairs).',
 rest_bounds_y_up:pack(rest.box),all_animation_bounds_y_up:pack(union),dimensions_m:rest.box.getSize(new T.Vector3()).toArray(),height_m:rest.box.max.y,sole_clearance_m:rest.box.min.y,body_footprint_y_up:pack(body),exported_safe_bounds_y_up:storedBounds,animations,images,root_bone_tracks:rootBoneTracks,tracks:bindings,attachment_pivot_max_drift_m:attachments,max_skin_influences:maxInfluences,max_weight_sum_error:maxWeightError,
 stale_skinned_culling_spheres_note:staleCulling,attack_beats:beats,defeat_held:defeatHeld,adapter:{phases,direct_contact_beak_tip:directContactTip.toArray(),hit_peel:hitPeel,defeat_states:defeatStates},checks};
await writeFile(path.join(root,'three-inspection.json'),JSON.stringify(record,null,2)+'\n');
const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);console.log(JSON.stringify({failures,rest:record.rest_bounds_y_up,animated:record.all_animation_bounds_y_up,floor:Object.fromEntries(Object.entries(animations).map(([k,a])=>[k,[+a.bounds_y_up.min[1].toFixed(4),a.floor_minimum.bone]])),sheet:sheet.beak_tip,reared:reared.beak_tip,strike:strike.beak_tip,defeatHeld,maxInfluences,peel:animations.hit.max_peel_lift_in_head_m,chips:animations.hit.max_loot_chips_jump_in_cone_m,body:pack(body),staleCulling}));process.exitCode=failures.length?1:0;
