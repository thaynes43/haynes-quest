/** WO111 rival-mayor: exact GLTFLoader, all-vertex bounds at 60 Hz, and the actual game adapter.
 * node_modules/.bin/tsx inspect-three.mjs <artifact-dir> [--write-bounds]   (run from scripts/assets/rival-mayor/v001) */
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
const root=path.resolve(process.argv[2]),bytes=await readFile(path.join(root,'rival-mayor.glb'));
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
const eyeCentre=carried('head',[0,0.19,1.83]);
const hatInHead=()=>wp(B('hat')).applyMatrix4(B('head').matrixWorld.clone().invert());
const hatRestInHead=hatInHead();
const eyeRestInHead=eyeCentre().applyMatrix4(B('head').matrixWorld.clone().invert());
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
// Rotation-only joints keep their local pivot. hips (body bob/sit), hat (pop/slide) and button (press) translate by design.
const translating=['root','hips','hat','button'];
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
 const total=Math.ceil(clip.duration*60),bounds=new T.Box3();let first,last,hold,heldDifference=0,maxDisplacement=0,floorCause={y:Infinity},hatLift=0,hatDrop=0;
 for(let i=0;i<=total;i++){
  const time=clip.duration*i/total;mixer.setTime(time);const sample=points();bounds.union(sample.box);if(sample.minimum.y<floorCause.y)floorCause={...sample.minimum,time_s:time};
  if(i===0)first=sample.positions;if(i===total)last=sample.positions;
  for(let j=0;j<sample.positions.length;j++)maxDisplacement=Math.max(maxDisplacement,sample.positions[j].distanceTo(first[j]));
  if(clip.name==='defeat'&&time>=HOLD_FROM+1e-6){if(!hold)hold=sample.positions;else for(let j=0;j<hold.length;j++)heldDifference=Math.max(heldDifference,hold[j].distanceTo(sample.positions[j]));}
  const h=hatInHead();hatLift=Math.max(hatLift,h.y-hatRestInHead.y);hatDrop=Math.max(hatDrop,hatRestInHead.y-h.y);
  for(const b of bones)if(attachments[b.name]!==undefined)attachments[b.name]=Math.max(attachments[b.name],b.position.distanceTo(restBonePositions[b.name]));
  rootFixed&&=scene.position.length()<1e-8&&scene.quaternion.angleTo(new T.Quaternion())<1e-8&&scene.scale.distanceTo(new T.Vector3(1,1,1))<1e-8;
 }
 let seam=0;for(let j=0;j<first.length;j++)seam=Math.max(seam,first[j].distanceTo(last[j]));
 animations[clip.name]={duration_s:clip.duration,samples:total+1,all_vertices_per_sample:rest.positions.length,max_temporal_vertex_displacement_m:maxDisplacement,bounds_y_up:pack(bounds),loop_seam_max_m:seam,floor_minimum:floorCause,max_hat_lift_in_head_m:hatLift,max_hat_drop_in_head_m:hatDrop,held_defeat_difference_m:clip.name==='defeat'?heldDifference:null};union.union(bounds);
}
// Attack beats sampled directly from the clip.
const attack=gltf.animations.find(c=>c.name==='attack');mixer.stopAllAction();const aa=mixer.clipAction(attack).setLoop(T.LoopOnce,1);aa.clampWhenFinished=true;aa.play();
const contact=[];
for(const t of [0,.40,.84,.95,1.05,1.10,1.18,1.25,1.35,1.44,2]){
 mixer.setTime(t);scene.updateMatrixWorld(true);
 contact.push({time_s:t,button:wp(B('button')).toArray(),remote:wp(B('remote')).toArray(),propeller:wp(B('propeller')).toArray(),head:wp(B('head')).toArray(),
  button_local:B('button').position.toArray(),button_rest_local:restBonePositions.button.toArray()});
}
const at=t=>contact.find(s=>Math.abs(s.time_s-t)<1e-9);
const directContactButton=new T.Vector3(...at(1.25).button);
mixer.stopAllAction();scene.updateMatrixWorld(true);
// Defeat held pose: hat brim centre relative to the eyes (head frame) and its scale.
const dclip=gltf.animations.find(c=>c.name==='defeat');const da=mixer.clipAction(dclip).setLoop(T.LoopOnce,1);da.clampWhenFinished=true;da.play();mixer.setTime(dclip.duration);scene.updateMatrixWorld(true);
const hatHeld=hatInHead(),hatScaleHeld=B('hat').scale.toArray();
const defeatHeld={hat_brim_centre_minus_eye_centre_head_m:hatHeld.y-eyeRestInHead.y,hat_drop_along_head_m:hatRestInHead.y-hatHeld.y,hat_scale:hatScaleHeld,hips_height_m:wp(B('hips')).y};
mixer.stopAllAction();scene.updateMatrixWorld(true);
const firstClone=clone(scene),secondClone=clone(scene),frozenSource=bones.map(b=>b.matrix.toArray()),hat2=secondClone.getObjectByName('hat').quaternion.clone();
const adapter=new EnemyAnimation(firstClone,gltf.animations,.625);
const frame={id:'wo111-rival-mayor-inspection',position:{x:0,y:0,z:0},facing:0,phase:'idle',windupProgress:0,hp:100,maxHp:100};
const phases=[];
for(const phase of ['idle','chasing','windup','strike','cooldown']){
 frame.phase=phase;for(let i=0;i<20;i++){frame.windupProgress=Math.min(1,i/15);adapter.update(frame,.05)}
 firstClone.updateMatrixWorld(true);phases.push({phase,visible:firstClone.visible,hips:wp(firstClone.getObjectByName('hips')).toArray(),button:wp(firstClone.getObjectByName('button')).toArray()});
}
frame.hp=70;frame.phase='idle';adapter.update(frame,.1);firstClone.updateMatrixWorld(true);const hitHat=wp(firstClone.getObjectByName('hat')).toArray();
for(let i=0;i<20;i++)adapter.update(frame,.05);frame.phase='defeated';let state;const defeatStates=[];
for(let i=0;i<60;i++){state=adapter.update(frame,.05);if([0,33,47,53,59].includes(i))defeatStates.push({time_s:(i+1)*.05,...state})}
scene.updateMatrixWorld(true);secondClone.updateMatrixWorld(true);firstClone.updateMatrixWorld(true);
const cloneIndependent=bones.every((b,i)=>b.matrix.toArray().every((x,j)=>Math.abs(x-frozenSource[i][j])<1e-10))&&secondClone.getObjectByName('hat').quaternion.toArray().every((x,i)=>Math.abs(x-hat2.toArray()[i])<1e-10);
const storedBounds=B('Rival_Mayor_Skin')?.userData.model_space_bounds_y_up;
const rootBoneTracks=gltf.animations.flatMap(c=>c.tracks.filter(t=>t.name.startsWith('root.')).map(t=>({clip:c.name,name:t.name,constant:Array.from(t.values).every((v,i,a)=>Math.abs(v-a[i%t.getValueSize()])<1e-7)})));
const restC=at(0),raised=at(.95),strike=at(1.25);
// The raised hold carries a small gleeful shake (about 1.2 cm at the wrist); held means within 5 cm.
const heldRaised=[.84,.95,1.05,1.10].every(t=>new T.Vector3(...at(t).button).distanceTo(new T.Vector3(...raised.button))<.05);
const pressDepth=new T.Vector3(...strike.button_local).distanceTo(new T.Vector3(...strike.button_rest_local));
const body=new T.Box3().setFromPoints(rest.groups.hips);
const atWindup=phases.find(p=>p.phase==='windup');
const checks={exported_bounds_cover_all_poses:!!storedBounds&&union.min.toArray().every((v,i)=>v>=storedBounds.min[i])&&union.max.toArray().every((v,i)=>v<=storedBounds.max[i]),
 all_five_clips:gltf.animations.map(c=>c.name).sort().join()===['idle','move','attack','hit','defeat'].sort().join(),all_tracks_resolve_below_scene_root:bindings.every(b=>b.resolves&&!b.targets_scene_root),all_clips_move_actual_vertices:Object.values(animations).every(a=>a.max_temporal_vertex_displacement_m>.001),idle_move_seams:['idle','move'].every(n=>animations[n].loop_seam_max_m<.00001),held_defeat:animations.defeat.held_defeat_difference_m<.00001,
 no_floor_penetration:Object.values(animations).every(a=>a.bounds_y_up.min[1]>=-.00001),attached_joint_pivots:Object.values(attachments).every(d=>d<.00001),at_most_four_influences:maxInfluences<=4,normalized_weights:maxWeightError<.00001,identity_root_no_motion:rootFixed,no_root_bone_motion:rootBoneTracks.every(t=>t.constant),
 boss_height_2_to_3_m:rest.box.max.y>=2&&rest.box.max.y<=3&&Math.abs(rest.box.max.y-construction.height_m)<.001,standing_on_floor:rest.box.min.y>=0&&rest.box.min.y<.01,floor_centred_body:Math.abs(body.max.x+body.min.x)<.03&&Math.abs(body.max.z+body.min.z)<.03,
 one_1024_embedded_atlas:images.length===1&&images[0].width===1024&&images[0].height===1024,two_draw_primitives:meshes.length===2,actual_adapter_constructed:true,actual_adapter_defeat_vanish:state.visible===false&&state.vanish===1,adapter_root_identity:firstClone.position.length()<1e-8&&firstClone.scale.distanceTo(new T.Vector3(1,1,1))<1e-8,independent_skeleton_clone:cloneIndependent,
 attack_contact_1_25:Math.abs(animations.attack.duration_s*.625-1.25)<1e-9,actual_adapter_contact_pose:new T.Vector3(...atWindup.button).distanceTo(directContactButton)<1e-5,
 remote_raised_above_head_and_held_0_84_to_1_10:raised.button[1]>raised.head[1]&&raised.propeller[1]>2.2&&heldRaised,
 remote_thrust_forward_at_contact:strike.button[2]<restC.button[2]-.25&&strike.button[1]>restC.button[1]+.10,button_pressed_at_contact:pressDepth>.009,
 hat_pops_on_hit:animations.hit.max_hat_lift_in_head_m>.12,hat_over_eyes_in_held_defeat:defeatHeld.hat_drop_along_head_m>.10&&defeatHeld.hat_brim_centre_minus_eye_centre_head_m<.03&&hatScaleHeld[0]>1.15,
 seated_defeat:defeatHeld.hips_height_m<.35};
adapter.dispose();
const boundsRecord={method:'All exact exported skin vertices, rest and every clip at 60 Hz; conservative 0.005 m padding per axis.',safe_culling_envelope:{min:union.min.toArray().map(n=>Math.floor((n-.005)*1000)/1000),max:union.max.toArray().map(n=>Math.ceil((n+.005)*1000)/1000)}};
if(process.argv.includes('--write-bounds'))await writeFile(path.join(path.dirname(new URL(import.meta.url).pathname),'bounds.json'),JSON.stringify(boundsRecord,null,2)+'\n');
const record={asset_id:'rival-mayor',version:'v001',glb_sha256:createHash('sha256').update(bytes).digest('hex'),three_revision:T.REVISION,method:'Exact GLTFLoader; all exported skin vertices at 60 Hz; SkeletonUtils clone; actual src/game/enemy-animation.ts. Rotation-only joints are checked as fixed local pivots; the hips bob/sit, hat pop/slide and button press are the intentional translations. No physical-device or universal triangle-collision proof (the Blender attachment audit covers listed part pairs).',
 rest_bounds_y_up:pack(rest.box),all_animation_bounds_y_up:pack(union),dimensions_m:rest.box.getSize(new T.Vector3()).toArray(),height_m:rest.box.max.y,sole_clearance_m:rest.box.min.y,body_footprint_y_up:pack(body),exported_safe_bounds_y_up:storedBounds,animations,images,root_bone_tracks:rootBoneTracks,tracks:bindings,attachment_pivot_max_drift_m:attachments,max_skin_influences:maxInfluences,max_weight_sum_error:maxWeightError,
 attack_beats:contact,button_press_depth_at_contact_m:pressDepth,defeat_held:defeatHeld,adapter:{phases,direct_contact_button:directContactButton.toArray(),hit_hat:hitHat,defeat_states:defeatStates},checks};
await writeFile(path.join(root,'three-inspection.json'),JSON.stringify(record,null,2)+'\n');
const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);console.log(JSON.stringify({failures,rest:record.rest_bounds_y_up,animated:record.all_animation_bounds_y_up,floor:Object.fromEntries(Object.entries(animations).map(([k,a])=>[k,[+a.bounds_y_up.min[1].toFixed(4),a.floor_minimum.bone]])),press:pressDepth,defeatHeld,raised:raised.button,strike:strike.button,rest:restC.button,maxInfluences}));process.exitCode=failures.length?1:0;
