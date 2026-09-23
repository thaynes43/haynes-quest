/** WO099 exact GLTFLoader + actual EnemyAnimation + complete skinned bounds.
 * Run with pnpm exec tsx scripts/assets/rat-pit-boss-v002/inspect-three.mjs <artifact-dir>
 */
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import sharp from 'sharp';
import {EnemyAnimation} from '../../../src/game/enemy-animation.ts';
globalThis.self=globalThis;
const images=[];
globalThis.createImageBitmap=async blob=>{
 const bytes=Buffer.from(await blob.arrayBuffer()),{data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 images.push({width:info.width,height:info.height,encoded_bytes:bytes.length,decoded_bytes:data.length});return {width:info.width,height:info.height,data,close(){}};
};
const root=path.resolve(process.argv[2]),bytes=await readFile(path.join(root,'rat-pit-boss.glb'));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const scene=gltf.scene,meshes=[];scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o)});
const pack=b=>({min:b.min.toArray(),max:b.max.toArray()});
function points(){
 scene.updateMatrixWorld(true);
 const positions=[],groups={feet:[],tail:[],die:[],chest:[]};
 for(const mesh of meshes){
  mesh.skeleton.update();const indices=mesh.geometry.attributes.skinIndex;
  for(let i=0;i<mesh.geometry.attributes.position.count;i++){
   const p=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld);positions.push(p);
   const bone=mesh.skeleton.bones[indices.getX(i)].name;
   if(bone.startsWith('foot_'))groups.feet.push(p);
   if(bone.startsWith('tail_'))groups.tail.push(p);
   if(bone==='prop_die')groups.die.push(p);
   if(bone==='chest')groups.chest.push(p);
  }
 }
 return {positions,groups,box:new T.Box3().setFromPoints(positions)};
}
const rest=points(),mixer=new T.AnimationMixer(scene),union=rest.box.clone(),animations={},bindings=[];
let maxDieDrift=0,rootFixed=true,skinWeightsRigid=true,dieSuitIntersections=0;
for(const mesh of meshes){const w=mesh.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++)skinWeightsRigid&&=[w.getX(i),w.getY(i),w.getZ(i),w.getW(i)].filter(x=>x>1e-6).length===1;}
const die=scene.getObjectByName('prop_die'),dieRest=die.matrix.clone();
for(const clip of gltf.animations){
 for(const track of clip.tracks){
  const binding=new T.PropertyBinding(scene,track.name);binding.bind();const probe=new Float64Array(track.getValueSize()).fill(NaN);binding.getValue(probe,0);
  bindings.push({clip:clip.name,track:track.name,node:binding.node?.name,resolves:probe.some(Number.isFinite),targets_scene_root:binding.node===scene});
 }
 mixer.stopAllAction();const action=mixer.clipAction(clip).setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const total=Math.ceil(clip.duration*60),bounds=new T.Box3();let first,last,hold,heldDifference=0,maxDisplacement=0,feetMin=Infinity,tailMin=Infinity,dieMin=Infinity;
 for(let i=0;i<=total;i++){
  const time=clip.duration*i/total;mixer.setTime(time);const sample=points();bounds.union(sample.box);
  for(let j=0;j<sample.positions.length;j++)maxDisplacement=Math.max(maxDisplacement,sample.positions[j].distanceTo(rest.positions[j]));
  if(i===0)first=sample.positions;if(i===total)last=sample.positions;
  if(clip.name==='defeat'&&time>=1.8){if(!hold)hold=sample.positions;else for(let j=0;j<hold.length;j++)heldDifference=Math.max(heldDifference,hold[j].distanceTo(sample.positions[j]));}
  for(const p of sample.groups.feet)feetMin=Math.min(feetMin,p.y);
  for(const p of sample.groups.tail)tailMin=Math.min(tailMin,p.y);
  for(const p of sample.groups.die)dieMin=Math.min(dieMin,p.y);
  const chestBox=new T.Box3().setFromPoints(sample.groups.chest);
  dieSuitIntersections+=sample.groups.die.filter(p=>chestBox.containsPoint(p)).length;
  scene.updateMatrixWorld(true);maxDieDrift=Math.max(maxDieDrift,...die.matrix.elements.map((x,j)=>Math.abs(x-dieRest.elements[j])));
  rootFixed&&=scene.position.length()<1e-8&&scene.quaternion.angleTo(new T.Quaternion())<1e-8&&scene.scale.distanceTo(new T.Vector3(1,1,1))<1e-8;
 }
 let seam=0;for(let j=0;j<first.length;j++)seam=Math.max(seam,first[j].distanceTo(last[j]));
 animations[clip.name]={duration_s:clip.duration,samples:total+1,all_vertices_per_sample:rest.positions.length,max_vertex_displacement_m:maxDisplacement,bounds_y_up:pack(bounds),loop_seam_max_m:seam,feet_min_y_m:feetMin,tail_min_y_m:tailMin,die_min_y_m:dieMin,held_defeat_difference_m:clip.name==='defeat'?heldDifference:null};union.union(bounds);
}
mixer.stopAllAction();scene.updateMatrixWorld(true);
const firstClone=clone(scene),secondClone=clone(scene),bones=[];scene.traverse(o=>{if(o.isBone)bones.push(o)});
const frozenSource=bones.map(b=>b.matrix.toArray()),head2=secondClone.getObjectByName('head').quaternion.clone();
const adapter=new EnemyAnimation(firstClone,gltf.animations,.625);
const frame={id:'wo099-inspection',position:{x:0,y:0,z:0},facing:0,phase:'idle',windupProgress:0,hp:100,maxHp:100};
const phases=[];
for(const phase of ['idle','chasing','windup','strike','cooldown']){
 frame.phase=phase;
 for(let i=0;i<20;i++){frame.windupProgress=Math.min(1,i/15);adapter.update(frame,.05)}
 firstClone.updateMatrixWorld(true);phases.push({phase,visible:firstClone.visible,head:firstClone.getObjectByName('head').getWorldPosition(new T.Vector3()).toArray(),hand:firstClone.getObjectByName('hand_L').getWorldPosition(new T.Vector3()).toArray()});
}
frame.hp=70;frame.phase='idle';adapter.update(frame,.1);const hitHand=firstClone.getObjectByName('hand_L').getWorldPosition(new T.Vector3()).toArray();
for(let i=0;i<20;i++)adapter.update(frame,.05);
frame.phase='defeated';let state;const defeatStates=[];
for(let i=0;i<58;i++){state=adapter.update(frame,.05);if([0,36,47,53,57].includes(i))defeatStates.push({time_s:(i+1)*.05,...state});}
scene.updateMatrixWorld(true);secondClone.updateMatrixWorld(true);firstClone.updateMatrixWorld(true);
const cloneIndependent=bones.every((b,i)=>b.matrix.toArray().every((x,j)=>Math.abs(x-frozenSource[i][j])<1e-10))&&secondClone.getObjectByName('head').quaternion.angleTo(head2)<1e-10;
const storedBounds=scene.getObjectByName('Rat_Pit_Boss_Skin').userData.model_space_bounds_y_up;
const checks={exported_bounds_cover_all_poses:!!storedBounds&&union.min.toArray().every((v,i)=>v>=storedBounds.min[i])&&union.max.toArray().every((v,i)=>v<=storedBounds.max[i]),all_five_clips:gltf.animations.map(c=>c.name).sort().join()===['idle','move','attack','hit','defeat'].sort().join(),all_tracks_resolve_below_scene_root:bindings.every(b=>b.resolves&&!b.targets_scene_root),
 all_clips_move_actual_vertices:Object.values(animations).every(a=>a.max_vertex_displacement_m>.001),idle_move_seams:['idle','move'].every(n=>animations[n].loop_seam_max_m<.00001),held_defeat:animations.defeat.held_defeat_difference_m<.00001,
 no_floor_penetration:Object.values(animations).every(a=>a.bounds_y_up.min[1]>=-.00001),die_clear_of_suit:dieSuitIntersections===0,die_attachment_fixed:maxDieDrift<.00001,all_rigid_single_weight:skinWeightsRigid,
 identity_root_no_motion:rootFixed,correct_height:Math.abs(rest.box.max.y-2.15)<.00001,floor_centered_rest:Math.abs(rest.box.min.y)<.00001&&Math.abs(rest.box.max.x+rest.box.min.x)<.15,
 one_1024_embedded_atlas:images.length===1&&images[0].width===1024&&images[0].height===1024,two_draw_primitives:meshes.length===2,
 actual_adapter_constructed:true,actual_adapter_defeat_vanish:state.visible===false&&state.vanish===1,adapter_root_identity:firstClone.position.length()<1e-8&&firstClone.scale.distanceTo(new T.Vector3(1,1,1))<1e-8,independent_skeleton_clone:cloneIndependent,
 attack_contact_1_25:Math.abs(animations.attack.duration_s*.625-1.25)<1e-9};
adapter.dispose();
const record={asset_id:'rat-pit-boss',version:'v002',glb_sha256:createHash('sha256').update(bytes).digest('hex'),three_revision:T.REVISION,method:'Exact GLTFLoader, all exported skin vertices at 60 Hz, SkeletonUtils clone and actual src/game/enemy-animation.ts',rest_bounds_y_up:pack(rest.box),all_animation_bounds_y_up:pack(union),dimensions_m:rest.box.getSize(new T.Vector3()).toArray(),exported_safe_bounds_y_up:storedBounds,animations,images,tracks:bindings,die_max_local_matrix_drift:maxDieDrift,die_vertices_inside_chest_bounds:dieSuitIntersections,adapter:{phases,hit_hand:hitHand,defeat_states:defeatStates},checks};
await writeFile(path.join(root,'three-inspection.json'),JSON.stringify(record,null,2)+'\n');
const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);console.log(JSON.stringify({failures,rest:record.rest_bounds_y_up,animated:record.all_animation_bounds_y_up,animations,die_max_drift:maxDieDrift,die_suit_intersections:dieSuitIntersections}));process.exitCode=failures.length?1:0;
