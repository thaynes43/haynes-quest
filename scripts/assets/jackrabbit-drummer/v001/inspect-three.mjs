/** WO101 exact GLTFLoader, actual EnemyAnimation, attachment and contact audit.
 * pnpm exec tsx scripts/assets/jackrabbit-drummer/v001/inspect-three.mjs <artifact-dir>
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
const root=path.resolve(process.argv[2]),bytes=await readFile(path.join(root,'jackrabbit-drummer.glb'));
const rig=JSON.parse(await readFile(path.join(root,'source/rig-rest.json'),'utf8'));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const scene=gltf.scene,meshes=[];scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o)});
scene.updateMatrixWorld(true);
const pack=b=>({min:b.min.toArray(),max:b.max.toArray()});
const toExport=p=>new T.Vector3(p[0]*rig.factor,(p[2]-rig.ground)*rig.factor,-p[1]*rig.factor);
const props=['prop_harness','prop_snare','prop_stick_R','prop_stick_L'];
const propInitial=Object.fromEntries(props.map(n=>[n,{local:scene.getObjectByName(n).matrix.clone(),worldInverse:scene.getObjectByName(n).matrixWorld.clone().invert()}]));
function authoredWorld(bone,p){return toExport(p).applyMatrix4(propInitial[bone].worldInverse).applyMatrix4(scene.getObjectByName(bone).matrixWorld);}
const categories=meshes.map(mesh=>{
 const indices=mesh.geometry.attributes.skinIndex;
 return Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>mesh.skeleton.bones[indices.getX(i)].name);
});
function points(){
 scene.updateMatrixWorld(true);const positions=[],groups={feet:[],snare:[],sticks:[],ears:[],head:[]};
 for(const [mi,mesh] of meshes.entries()){
  mesh.skeleton.update();
  for(let i=0;i<mesh.geometry.attributes.position.count;i++){
   const p=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld);positions.push(p);const bone=categories[mi][i];
   if(bone.startsWith('foot_'))groups.feet.push(p);if(bone==='prop_snare')groups.snare.push(p);if(bone.startsWith('prop_stick_'))groups.sticks.push(p);
   if(bone.startsWith('ear_'))groups.ears.push(p);if(bone==='head'||bone==='jaw')groups.head.push(p);
  }
 }
 return {positions,groups,box:new T.Box3().setFromPoints(positions)};
}
const rest=points(),mixer=new T.AnimationMixer(scene),union=rest.box.clone(),animations={},bindings=[];
let rootFixed=true,skinWeightsRigid=true,stickSnarePenetrations=0,worstSnarePenetration=0;
const propDrift=Object.fromEntries(props.map(n=>[n,0]));
for(const mesh of meshes){const w=mesh.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++)skinWeightsRigid&&=[w.getX(i),w.getY(i),w.getZ(i),w.getW(i)].filter(x=>x>1e-6).length===1;}
for(const clip of gltf.animations){
 for(const track of clip.tracks){
  const binding=new T.PropertyBinding(scene,track.name);binding.bind();const probe=new Float64Array(track.getValueSize()).fill(NaN);binding.getValue(probe,0);
  bindings.push({clip:clip.name,track:track.name,node:binding.node?.name,resolves:probe.some(Number.isFinite),targets_scene_root:binding.node===scene});
 }
 mixer.stopAllAction();const action=mixer.clipAction(clip).setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const total=Math.ceil(clip.duration*60),bounds=new T.Box3();let first,last,hold,heldDifference=0,maxDisplacement=0,maxTemporalDisplacement=0,feetMin=Infinity,snareMin=Infinity,stickMin=Infinity,earMin=Infinity,clipPenetrations=0;
 for(let i=0;i<=total;i++){
  const time=clip.duration*i/total;mixer.setTime(time);const sample=points();bounds.union(sample.box);
  for(let j=0;j<sample.positions.length;j++)maxDisplacement=Math.max(maxDisplacement,sample.positions[j].distanceTo(rest.positions[j]));
  if(i===0)first=sample.positions;if(i===total)last=sample.positions;
  for(let j=0;j<sample.positions.length;j++)maxTemporalDisplacement=Math.max(maxTemporalDisplacement,sample.positions[j].distanceTo(first[j]));
  if(clip.name==='defeat'&&time>=1.8){if(!hold)hold=sample.positions;else for(let j=0;j<hold.length;j++)heldDifference=Math.max(heldDifference,hold[j].distanceTo(sample.positions[j]));}
  for(const p of sample.groups.feet)feetMin=Math.min(feetMin,p.y);
  for(const p of sample.groups.snare)snareMin=Math.min(snareMin,p.y);
  for(const p of sample.groups.sticks)stickMin=Math.min(stickMin,p.y);
  for(const p of sample.groups.ears)earMin=Math.min(earMin,p.y);
  // Cylinder-volume exclusion on every exported stick vertex, in the drum's rest space.
  const snareUnpose=propInitial.prop_snare.worldInverse.clone().invert().multiply(scene.getObjectByName('prop_snare').matrixWorld.clone().invert());
  for(const point of sample.groups.sticks){
   const p=point.clone().applyMatrix4(snareUnpose),x=p.x/rig.factor,y=-p.z/rig.factor,z=p.y/rig.factor+rig.ground;
   const radial=Math.hypot(x,y-rig.snare_center[1]),depth=Math.min(.247-radial,z-.728,rig.snare_head_surface-z);
   if(depth>.00075){stickSnarePenetrations++;clipPenetrations++;worstSnarePenetration=Math.max(worstSnarePenetration,depth*rig.factor);}
  }
  for(const name of props)propDrift[name]=Math.max(propDrift[name],...scene.getObjectByName(name).matrix.elements.map((x,j)=>Math.abs(x-propInitial[name].local.elements[j])));
  rootFixed&&=scene.position.length()<1e-8&&scene.quaternion.angleTo(new T.Quaternion())<1e-8&&scene.scale.distanceTo(new T.Vector3(1,1,1))<1e-8;
 }
 let seam=0;for(let j=0;j<first.length;j++)seam=Math.max(seam,first[j].distanceTo(last[j]));
 animations[clip.name]={duration_s:clip.duration,samples:total+1,all_vertices_per_sample:rest.positions.length,max_vertex_displacement_m:maxDisplacement,max_temporal_vertex_displacement_m:maxTemporalDisplacement,bounds_y_up:pack(bounds),loop_seam_max_m:seam,feet_min_y_m:feetMin,snare_min_y_m:snareMin,sticks_min_y_m:stickMin,ear_min_y_m:earMin,held_defeat_difference_m:clip.name==='defeat'?heldDifference:null,stick_vertices_inside_snare:clipPenetrations};union.union(bounds);
}
mixer.stopAllAction();const attack=gltf.animations.find(c=>c.name==='attack');const contactAction=mixer.clipAction(attack).reset().setLoop(T.LoopOnce,1);contactAction.clampWhenFinished=true;contactAction.play();
const contact={time_s:1.25,duration_s:attack.duration,fraction:.625,beads:{},near_contact_samples:[]};
function contactMeasure(time){
 mixer.stopAllAction();contactAction.reset().play();mixer.setTime(time);scene.updateMatrixWorld(true);
 const plane=authoredWorld('prop_snare',[0,rig.snare_center[1],rig.snare_head_surface]);
 const normal=new T.Vector3(0,1,0).transformDirection(scene.getObjectByName('prop_snare').matrixWorld.clone().multiply(propInitial.prop_snare.worldInverse));
 const beads={};
 for(const label of ['R','L']){
  const p=authoredWorld('prop_stick_'+label,rig.rest['prop_stick_'+label][1]),delta=p.clone().sub(plane),height=delta.dot(normal),radial=delta.clone().addScaledVector(normal,-height).length();
  beads[label]={center_y_up:p.toArray(),signed_center_height_over_head_m:height,surface_clearance_m:height-.015*rig.factor,radial_distance_m:radial,within_drum_head:radial<rig.snare_head_radius*rig.factor-.015*rig.factor};
 }
 return {time_s:time,beads};
}
for(const time of [0,.6,.9,1.08,1.20,1.25,1.30,1.34,1.48,2])contact.near_contact_samples.push(contactMeasure(time));
contact.beads=contactMeasure(1.25).beads;
const directContactHand=scene.getObjectByName('hand_L').getWorldPosition(new T.Vector3());
mixer.stopAllAction();scene.updateMatrixWorld(true);
const firstClone=clone(scene),secondClone=clone(scene),bones=[];scene.traverse(o=>{if(o.isBone)bones.push(o)});
const frozenSource=bones.map(b=>b.matrix.toArray()),head2=secondClone.getObjectByName('head').quaternion.clone();
const adapter=new EnemyAnimation(firstClone,gltf.animations,.625);
const frame={id:'wo101-inspection',position:{x:0,y:0,z:0},facing:0,phase:'idle',windupProgress:0,hp:100,maxHp:100},phases=[];
for(const phase of ['idle','chasing','windup','strike','cooldown']){
 frame.phase=phase;for(let i=0;i<20;i++){frame.windupProgress=Math.min(1,i/15);adapter.update(frame,.05)}
 firstClone.updateMatrixWorld(true);phases.push({phase,visible:firstClone.visible,head:firstClone.getObjectByName('head').getWorldPosition(new T.Vector3()).toArray(),hand:firstClone.getObjectByName('hand_L').getWorldPosition(new T.Vector3()).toArray()});
}
frame.hp=70;frame.phase='idle';adapter.update(frame,.1);firstClone.updateMatrixWorld(true);const hitHand=firstClone.getObjectByName('hand_L').getWorldPosition(new T.Vector3()).toArray();
for(let i=0;i<20;i++)adapter.update(frame,.05);frame.phase='defeated';let state;const defeatStates=[];
for(let i=0;i<58;i++){state=adapter.update(frame,.05);if([0,36,47,53,57].includes(i))defeatStates.push({time_s:(i+1)*.05,...state});}
scene.updateMatrixWorld(true);secondClone.updateMatrixWorld(true);firstClone.updateMatrixWorld(true);
const cloneIndependent=bones.every((b,i)=>b.matrix.toArray().every((x,j)=>Math.abs(x-frozenSource[i][j])<1e-10))&&secondClone.getObjectByName('head').quaternion.angleTo(head2)<1e-10;
const storedBounds=scene.getObjectByName('Jackrabbit_Drummer_Skin').userData.model_space_bounds_y_up;
const rootBoneTracks=gltf.animations.flatMap(c=>c.tracks.filter(t=>t.name.startsWith('root.')).map(t=>({clip:c.name,name:t.name,constant:Array.from(t.values).every((v,i,a)=>Math.abs(v-a[i%t.getValueSize()])<1e-7)})));
const checks={exported_bounds_cover_all_poses:!!storedBounds&&union.min.toArray().every((v,i)=>v>=storedBounds.min[i])&&union.max.toArray().every((v,i)=>v<=storedBounds.max[i]),
 all_five_clips:gltf.animations.map(c=>c.name).sort().join()===['idle','move','attack','hit','defeat'].sort().join(),all_tracks_resolve_below_scene_root:bindings.every(b=>b.resolves&&!b.targets_scene_root),
 all_clips_move_actual_vertices:Object.values(animations).every(a=>a.max_temporal_vertex_displacement_m>.001),idle_move_seams:['idle','move'].every(n=>animations[n].loop_seam_max_m<.00001),held_defeat:animations.defeat.held_defeat_difference_m<.00001,
 no_floor_penetration:Object.values(animations).every(a=>a.bounds_y_up.min[1]>=-.00001),snare_and_stick_attachments_fixed:Object.values(propDrift).every(d=>d<.00001),sticks_clear_of_snare_volume:stickSnarePenetrations===0,
 all_rigid_single_weight:skinWeightsRigid,identity_root_no_motion:rootFixed,no_root_bone_motion:rootBoneTracks.every(t=>t.constant),correct_height:Math.abs(rest.box.max.y-1.96)<.00001,floor_centered_rest:Math.abs(rest.box.min.y)<.00001&&Math.abs(rest.box.max.x+rest.box.min.x)<.15,
 one_1024_embedded_atlas:images.length===1&&images[0].width===1024&&images[0].height===1024,two_draw_primitives:meshes.length===2,actual_adapter_constructed:true,actual_adapter_defeat_vanish:state.visible===false&&state.vanish===1,
 adapter_root_identity:firstClone.position.length()<1e-8&&firstClone.scale.distanceTo(new T.Vector3(1,1,1))<1e-8,independent_skeleton_clone:cloneIndependent,
 attack_contact_1_25:Math.abs(animations.attack.duration_s*.625-1.25)<1e-9,actual_adapter_contact_pose:new T.Vector3(...phases.find(p=>p.phase==='windup').hand).distanceTo(directContactHand)<1e-5,
 both_beads_touch_head_at_contact:Object.values(contact.beads).every(b=>b.within_drum_head&&Math.abs(b.surface_clearance_m)<.003)};
adapter.dispose();
const record={asset_id:'jackrabbit-drummer',version:'v001',glb_sha256:createHash('sha256').update(bytes).digest('hex'),three_revision:T.REVISION,method:'Exact GLTFLoader; all exported skin vertices at 60 Hz; SkeletonUtils clone; real src/game/enemy-animation.ts; explicit transformed stick-bead/drum-head contact and cylinder-volume checks.',rest_bounds_y_up:pack(rest.box),all_animation_bounds_y_up:pack(union),dimensions_m:rest.box.getSize(new T.Vector3()).toArray(),exported_safe_bounds_y_up:storedBounds,
 animations,images,root_bone_tracks:rootBoneTracks,tracks:bindings,prop_max_local_matrix_drift:propDrift,stick_vertices_inside_snare:stickSnarePenetrations,worst_snare_penetration_m:worstSnarePenetration,contact,
 adapter:{phases,direct_contact_hand:directContactHand.toArray(),hit_hand:hitHand,defeat_states:defeatStates},checks};
await writeFile(path.join(root,'three-inspection.json'),JSON.stringify(record,null,2)+'\n');
const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);console.log(JSON.stringify({failures,rest:record.rest_bounds_y_up,animated:record.all_animation_bounds_y_up,animations,prop_drift:propDrift,contact:contact.beads,stick_snare_penetrations:stickSnarePenetrations,worst_snare_penetration_m:worstSnarePenetration}));process.exitCode=failures.length?1:0;
