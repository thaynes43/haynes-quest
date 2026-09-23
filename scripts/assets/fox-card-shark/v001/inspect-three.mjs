/** WO102 exact GLTFLoader, actual EnemyAnimation, attachment and contact audit.
 * pnpm exec tsx scripts/assets/fox-card-shark/v001/inspect-three.mjs <artifact-dir>
 */
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
const root=path.resolve(process.argv[2]),bytes=await readFile(path.join(root,'fox-card-shark.glb'));
const rig=JSON.parse(await readFile(path.join(root,'source/rig-rest.json'),'utf8'));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const scene=gltf.scene,meshes=[];scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o)});
scene.updateMatrixWorld(true);
const pack=b=>({min:b.min.toArray(),max:b.max.toArray()});
const toExport=p=>new T.Vector3(p[0]*rig.factor,(p[2]-rig.ground)*rig.factor,-p[1]*rig.factor);
const props=['prop_cards'];
const propInitial=Object.fromEntries(props.map(n=>[n,{local:scene.getObjectByName(n).matrix.clone(),worldInverse:scene.getObjectByName(n).matrixWorld.clone().invert()}]));
function authoredWorld(bone,p){return toExport(p).applyMatrix4(propInitial[bone].worldInverse).applyMatrix4(scene.getObjectByName(bone).matrixWorld);}
const categories=meshes.map(mesh=>{
 const indices=mesh.geometry.attributes.skinIndex;
 return Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>mesh.skeleton.bones[indices.getX(i)].name);
});
function points(){
 scene.updateMatrixWorld(true);const positions=[],groups={feet:[],cards:[],tail:[],ears:[],head:[],chest:[]};
 for(const [mi,mesh] of meshes.entries()){
  mesh.skeleton.update();
  for(let i=0;i<mesh.geometry.attributes.position.count;i++){
   const p=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld);positions.push(p);const bone=categories[mi][i];
   if(bone.startsWith('foot_'))groups.feet.push(p);if(bone==='prop_cards')groups.cards.push(p);if(bone.startsWith('tail_'))groups.tail.push(p);if(['chest','hips','neck'].includes(bone))groups.chest.push(p);
   if(bone.startsWith('ear_'))groups.ears.push(p);if(bone==='head'||bone==='jaw')groups.head.push(p);
  }
 }
 return {positions,groups,box:new T.Box3().setFromPoints(positions)};
}
const rest=points(),mixer=new T.AnimationMixer(scene),union=rest.box.clone(),animations={},bindings=[];
let rootFixed=true,maxInfluences=0,tailBaseDrift=0;
const boxDistance=(a,b)=>Math.hypot(...['x','y','z'].map(k=>Math.max(0,a.min[k]-b.max[k],b.min[k]-a.max[k])));
const tailBone=scene.getObjectByName('tail_base');const tailRestLocal=tailBone.position.clone();
const propDrift=Object.fromEntries(props.map(n=>[n,0]));
for(const mesh of meshes){const w=mesh.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++)maxInfluences=Math.max(maxInfluences,[w.getX(i),w.getY(i),w.getZ(i),w.getW(i)].filter(x=>x>1e-6).length);}
for(const clip of gltf.animations){
 for(const track of clip.tracks){
  const binding=new T.PropertyBinding(scene,track.name);binding.bind();const probe=new Float64Array(track.getValueSize()).fill(NaN);binding.getValue(probe,0);
  bindings.push({clip:clip.name,track:track.name,node:binding.node?.name,resolves:probe.some(Number.isFinite),targets_scene_root:binding.node===scene});
 }
 mixer.stopAllAction();const action=mixer.clipAction(clip).setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const total=Math.ceil(clip.duration*60),bounds=new T.Box3();let first,last,hold,heldDifference=0,maxDisplacement=0,maxTemporalDisplacement=0,feetMin=Infinity,cardsMin=Infinity,tailMin=Infinity,earMin=Infinity,cardChestClearance=Infinity,cardHeadClearance=Infinity;
 for(let i=0;i<=total;i++){
  const time=clip.duration*i/total;mixer.setTime(time);const sample=points();bounds.union(sample.box);
  for(let j=0;j<sample.positions.length;j++)maxDisplacement=Math.max(maxDisplacement,sample.positions[j].distanceTo(rest.positions[j]));
  if(i===0)first=sample.positions;if(i===total)last=sample.positions;
  for(let j=0;j<sample.positions.length;j++)maxTemporalDisplacement=Math.max(maxTemporalDisplacement,sample.positions[j].distanceTo(first[j]));
  if(clip.name==='defeat'&&time>=1.8){if(!hold)hold=sample.positions;else for(let j=0;j<hold.length;j++)heldDifference=Math.max(heldDifference,hold[j].distanceTo(sample.positions[j]));}
  for(const p of sample.groups.feet)feetMin=Math.min(feetMin,p.y);
  for(const p of sample.groups.cards)cardsMin=Math.min(cardsMin,p.y);
  for(const p of sample.groups.tail)tailMin=Math.min(tailMin,p.y);
  for(const p of sample.groups.ears)earMin=Math.min(earMin,p.y);
  const cb=new T.Box3().setFromPoints(sample.groups.cards),body=new T.Box3().setFromPoints(sample.groups.chest),head=new T.Box3().setFromPoints(sample.groups.head);
  cardChestClearance=Math.min(cardChestClearance,boxDistance(cb,body));cardHeadClearance=Math.min(cardHeadClearance,boxDistance(cb,head));
  tailBaseDrift=Math.max(tailBaseDrift,tailBone.position.distanceTo(tailRestLocal));
  for(const name of props)propDrift[name]=Math.max(propDrift[name],...scene.getObjectByName(name).matrix.elements.map((x,j)=>Math.abs(x-propInitial[name].local.elements[j])));
  rootFixed&&=scene.position.length()<1e-8&&scene.quaternion.angleTo(new T.Quaternion())<1e-8&&scene.scale.distanceTo(new T.Vector3(1,1,1))<1e-8;
 }
 let seam=0;for(let j=0;j<first.length;j++)seam=Math.max(seam,first[j].distanceTo(last[j]));
 animations[clip.name]={duration_s:clip.duration,samples:total+1,all_vertices_per_sample:rest.positions.length,max_vertex_displacement_m:maxDisplacement,max_temporal_vertex_displacement_m:maxTemporalDisplacement,bounds_y_up:pack(bounds),loop_seam_max_m:seam,feet_min_y_m:feetMin,cards_min_y_m:cardsMin,tail_min_y_m:tailMin,ear_min_y_m:earMin,card_chest_aabb_clearance_lower_bound_m:cardChestClearance,card_head_aabb_clearance_lower_bound_m:cardHeadClearance,held_defeat_difference_m:clip.name==='defeat'?heldDifference:null};union.union(bounds);
}
mixer.stopAllAction();const attack=gltf.animations.find(c=>c.name==='attack');const contactAction=mixer.clipAction(attack).reset().setLoop(T.LoopOnce,1);contactAction.clampWhenFinished=true;contactAction.play();
const contact={time_s:1.25,duration_s:attack.duration,fraction:.625,warning_hold_start_s:.85,warning_hold_end_s:1.08,samples:[]};
for(const time of [0,.60,.85,1.08,1.20,1.25,1.35,1.52,2]){
 mixer.stopAllAction();contactAction.reset().play();mixer.setTime(time);const sample=points();
 contact.samples.push({time_s:time,hand_L:scene.getObjectByName('hand_L').getWorldPosition(new T.Vector3()).toArray(),cards_bounds_y_up:pack(new T.Box3().setFromPoints(sample.groups.cards)),body_bounds_y_up:pack(new T.Box3().setFromPoints(sample.groups.chest))});
}
mixer.stopAllAction();contactAction.reset().play();mixer.setTime(1.25);scene.updateMatrixWorld(true);
const directContactHand=scene.getObjectByName('hand_L').getWorldPosition(new T.Vector3());
mixer.stopAllAction();scene.updateMatrixWorld(true);
const firstClone=clone(scene),secondClone=clone(scene),bones=[];scene.traverse(o=>{if(o.isBone)bones.push(o)});
const frozenSource=bones.map(b=>b.matrix.toArray()),head2=secondClone.getObjectByName('head').quaternion.clone();
const adapter=new EnemyAnimation(firstClone,gltf.animations,.625);
const frame={id:'wo102-inspection',position:{x:0,y:0,z:0},facing:0,phase:'idle',windupProgress:0,hp:100,maxHp:100},phases=[];
for(const phase of ['idle','chasing','windup','strike','cooldown']){
 frame.phase=phase;for(let i=0;i<20;i++){frame.windupProgress=Math.min(1,i/15);adapter.update(frame,.05)}
 firstClone.updateMatrixWorld(true);phases.push({phase,visible:firstClone.visible,head:firstClone.getObjectByName('head').getWorldPosition(new T.Vector3()).toArray(),hand:firstClone.getObjectByName('hand_L').getWorldPosition(new T.Vector3()).toArray()});
}
frame.hp=70;frame.phase='idle';adapter.update(frame,.1);firstClone.updateMatrixWorld(true);const hitHand=firstClone.getObjectByName('hand_L').getWorldPosition(new T.Vector3()).toArray();
for(let i=0;i<20;i++)adapter.update(frame,.05);frame.phase='defeated';let state;const defeatStates=[];
for(let i=0;i<58;i++){state=adapter.update(frame,.05);if([0,36,47,53,57].includes(i))defeatStates.push({time_s:(i+1)*.05,...state});}
scene.updateMatrixWorld(true);secondClone.updateMatrixWorld(true);firstClone.updateMatrixWorld(true);
const cloneIndependent=bones.every((b,i)=>b.matrix.toArray().every((x,j)=>Math.abs(x-frozenSource[i][j])<1e-10))&&secondClone.getObjectByName('head').quaternion.angleTo(head2)<1e-10;
const storedBounds=scene.getObjectByName('Fox_Card_Shark_Skin').userData.model_space_bounds_y_up;
const rootBoneTracks=gltf.animations.flatMap(c=>c.tracks.filter(t=>t.name.startsWith('root.')).map(t=>({clip:c.name,name:t.name,constant:Array.from(t.values).every((v,i,a)=>Math.abs(v-a[i%t.getValueSize()])<1e-7)})));
const checks={exported_bounds_cover_all_poses:!!storedBounds&&union.min.toArray().every((v,i)=>v>=storedBounds.min[i])&&union.max.toArray().every((v,i)=>v<=storedBounds.max[i]),
 all_five_clips:gltf.animations.map(c=>c.name).sort().join()===['idle','move','attack','hit','defeat'].sort().join(),all_tracks_resolve_below_scene_root:bindings.every(b=>b.resolves&&!b.targets_scene_root),
 all_clips_move_actual_vertices:Object.values(animations).every(a=>a.max_temporal_vertex_displacement_m>.001),idle_move_seams:['idle','move'].every(n=>animations[n].loop_seam_max_m<.00001),held_defeat:animations.defeat.held_defeat_difference_m<.00001,
 no_floor_penetration:Object.values(animations).every(a=>a.bounds_y_up.min[1]>=-.00001),card_fan_attachment_fixed:Object.values(propDrift).every(d=>d<.00001),tail_base_attachment_fixed:tailBaseDrift<.00001,cards_clear_of_body:Object.values(animations).every(a=>a.card_chest_aabb_clearance_lower_bound_m>.001&&a.card_head_aabb_clearance_lower_bound_m>.001),
 at_most_four_influences:maxInfluences<=4,identity_root_no_motion:rootFixed,no_root_bone_motion:rootBoneTracks.every(t=>t.constant),correct_height:Math.abs(rest.box.max.y-1.80)<.00001,floor_centered_rest:Math.abs(rest.box.min.y)<.00001&&Math.abs(rest.box.max.x+rest.box.min.x)<.15,
 one_1024_embedded_atlas:images.length===1&&images[0].width===1024&&images[0].height===1024,two_draw_primitives:meshes.length===2,actual_adapter_constructed:true,actual_adapter_defeat_vanish:state.visible===false&&state.vanish===1,
 adapter_root_identity:firstClone.position.length()<1e-8&&firstClone.scale.distanceTo(new T.Vector3(1,1,1))<1e-8,independent_skeleton_clone:cloneIndependent,
 attack_contact_1_25:Math.abs(animations.attack.duration_s*.625-1.25)<1e-9,actual_adapter_contact_pose:new T.Vector3(...phases.find(p=>p.phase==='windup').hand).distanceTo(directContactHand)<1e-5};
adapter.dispose();
const record={asset_id:'fox-card-shark',version:'v001',glb_sha256:createHash('sha256').update(bytes).digest('hex'),three_revision:T.REVISION,method:'Exact GLTFLoader; all exported skin vertices at 60 Hz; SkeletonUtils clone; real src/game/enemy-animation.ts; exact skin bounds and conservative card/body AABB surface clearance at every frame. The card snap is a pose timing; no physical projectile or target is claimed.',rest_bounds_y_up:pack(rest.box),all_animation_bounds_y_up:pack(union),dimensions_m:rest.box.getSize(new T.Vector3()).toArray(),exported_safe_bounds_y_up:storedBounds,
 animations,images,root_bone_tracks:rootBoneTracks,tracks:bindings,prop_max_local_matrix_drift:propDrift,max_skin_influences:maxInfluences,tail_base_local_position_drift_m:tailBaseDrift,contact,
 adapter:{phases,direct_contact_hand:directContactHand.toArray(),hit_hand:hitHand,defeat_states:defeatStates},checks};
await writeFile(path.join(root,'three-inspection.json'),JSON.stringify(record,null,2)+'\n');
const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);console.log(JSON.stringify({failures,rest:record.rest_bounds_y_up,animated:record.all_animation_bounds_y_up,animations,prop_drift:propDrift,max_skin_influences:maxInfluences,tail_base_drift:tailBaseDrift,contact}));process.exitCode=failures.length?1:0;
