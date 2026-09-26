/** WO111 gadget-helper: exact GLTFLoader, all-vertex bounds and the actual game adapter. */
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
const root=path.resolve(process.argv[2]),bytes=await readFile(path.join(root,'gadget-helper.glb'));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const construction=JSON.parse(await readFile(path.join(root,'construction.json'),'utf8'));
const scene=gltf.scene,meshes=[],bones=[];scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);if(o.isBone)bones.push(o)});
const pack=b=>({min:b.min.toArray(),max:b.max.toArray()});
scene.updateMatrixWorld(true);
// Wrench head centre in rest (Blender (-0.778, 0, 0.908) → glTF (x, z, -y)), carried in the wrench bone frame.
const headRest=new T.Vector3(-.675-.412*.265,.68+.911*.265,0);
const headLocal=headRest.clone().applyMatrix4(scene.getObjectByName('wrench').matrixWorld.clone().invert());
const headWorld=()=>headLocal.clone().applyMatrix4(scene.getObjectByName('wrench').matrixWorld);
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
// Rotation-only joints must keep their local pivot; body/thrusters/pupils deliberately translate.
const attachments=Object.fromEntries(bones.filter(b=>!['root','body','thrusters','pupils'].includes(b.name)).map(b=>[b.name,0]));
let rootFixed=true,maxInfluences=0,maxWeightError=0;
for(const mesh of meshes){const w=mesh.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++){
 const values=[w.getX(i),w.getY(i),w.getZ(i),w.getW(i)];maxInfluences=Math.max(maxInfluences,values.filter(x=>x>1e-6).length);maxWeightError=Math.max(maxWeightError,Math.abs(values.reduce((a,b)=>a+b,0)-1));
}}
for(const clip of gltf.animations){
 for(const track of clip.tracks){
  const binding=new T.PropertyBinding(scene,track.name);binding.bind();const probe=new Float64Array(track.getValueSize()).fill(NaN);binding.getValue(probe,0);
  bindings.push({clip:clip.name,track:track.name,node:binding.node?.name,resolves:probe.some(Number.isFinite),targets_scene_root:binding.node===scene});
 }
 mixer.stopAllAction();const action=mixer.clipAction(clip).setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const total=Math.ceil(clip.duration*60),bounds=new T.Box3();let first,last,hold,heldDifference=0,maxDisplacement=0,floorCause={y:Infinity},minHeadY=Infinity;
 for(let i=0;i<=total;i++){
  const time=clip.duration*i/total;mixer.setTime(time);const sample=points();bounds.union(sample.box);if(sample.minimum.y<floorCause.y)floorCause={...sample.minimum,time_s:time};
  if(i===0)first=sample.positions;if(i===total)last=sample.positions;
  for(let j=0;j<sample.positions.length;j++)maxDisplacement=Math.max(maxDisplacement,sample.positions[j].distanceTo(first[j]));
  if(clip.name==='defeat'&&time>=1.75){if(!hold)hold=sample.positions;else for(let j=0;j<hold.length;j++)heldDifference=Math.max(heldDifference,hold[j].distanceTo(sample.positions[j]));}
  minHeadY=Math.min(minHeadY,headWorld().y);
  for(const b of bones)if(attachments[b.name]!==undefined)attachments[b.name]=Math.max(attachments[b.name],b.position.distanceTo(restBonePositions[b.name]));
  rootFixed&&=scene.position.length()<1e-8&&scene.quaternion.angleTo(new T.Quaternion())<1e-8&&scene.scale.distanceTo(new T.Vector3(1,1,1))<1e-8;
 }
 let seam=0;for(let j=0;j<first.length;j++)seam=Math.max(seam,first[j].distanceTo(last[j]));
 animations[clip.name]={duration_s:clip.duration,samples:total+1,all_vertices_per_sample:rest.positions.length,max_temporal_vertex_displacement_m:maxDisplacement,bounds_y_up:pack(bounds),loop_seam_max_m:seam,floor_minimum:floorCause,minimum_wrench_head_centre_y_m:minHeadY,held_defeat_difference_m:clip.name==='defeat'?heldDifference:null};union.union(bounds);
}
const attack=gltf.animations.find(c=>c.name==='attack');mixer.stopAllAction();const aa=mixer.clipAction(attack).setLoop(T.LoopOnce,1);aa.clampWhenFinished=true;aa.play();
const contact=[];
for(const t of [0,.60,.72,.84,1.05,1.15,1.25,1.40,2]){
 mixer.setTime(t);const sample=points();
 contact.push({time_s:t,wrench:scene.getObjectByName('wrench').getWorldPosition(new T.Vector3()).toArray(),wrench_head:headWorld().toArray(),wrench_bounds_y_up:pack(new T.Box3().setFromPoints(sample.groups.wrench)),body_bounds_y_up:pack(new T.Box3().setFromPoints(sample.groups.body)),bounds_y_up:pack(sample.box)});
}
const directContactWrench=new T.Vector3(...contact.find(s=>s.time_s===1.25).wrench);
mixer.stopAllAction();scene.updateMatrixWorld(true);
const firstClone=clone(scene),secondClone=clone(scene),frozenSource=bones.map(b=>b.matrix.toArray()),wrench2=secondClone.getObjectByName('wrench').quaternion.clone();
const adapter=new EnemyAnimation(firstClone,gltf.animations,.625);
const frame={id:'wo111-gadget-inspection',position:{x:0,y:0,z:0},facing:0,phase:'idle',windupProgress:0,hp:100,maxHp:100};
const phases=[];
for(const phase of ['idle','chasing','windup','strike','cooldown']){
 frame.phase=phase;for(let i=0;i<20;i++){frame.windupProgress=Math.min(1,i/15);adapter.update(frame,.05)}
 firstClone.updateMatrixWorld(true);phases.push({phase,visible:firstClone.visible,body:firstClone.getObjectByName('body').getWorldPosition(new T.Vector3()).toArray(),wrench:firstClone.getObjectByName('wrench').getWorldPosition(new T.Vector3()).toArray()});
}
frame.hp=70;frame.phase='idle';adapter.update(frame,.1);firstClone.updateMatrixWorld(true);const hitWrench=firstClone.getObjectByName('wrench').getWorldPosition(new T.Vector3()).toArray();
for(let i=0;i<20;i++)adapter.update(frame,.05);frame.phase='defeated';let state;const defeatStates=[];
for(let i=0;i<58;i++){state=adapter.update(frame,.05);if([0,33,47,53,57].includes(i))defeatStates.push({time_s:(i+1)*.05,...state})}
scene.updateMatrixWorld(true);secondClone.updateMatrixWorld(true);firstClone.updateMatrixWorld(true);
const cloneIndependent=bones.every((b,i)=>b.matrix.toArray().every((x,j)=>Math.abs(x-frozenSource[i][j])<1e-10))&&secondClone.getObjectByName('wrench').quaternion.toArray().every((x,i)=>Math.abs(x-wrench2.toArray()[i])<1e-10);
const storedBounds=scene.getObjectByName('Gadget_Helper_Skin').userData.model_space_bounds_y_up;
const rootBoneTracks=gltf.animations.flatMap(c=>c.tracks.filter(t=>t.name.startsWith('root.')).map(t=>({clip:c.name,name:t.name,constant:Array.from(t.values).every((v,i,a)=>Math.abs(v-a[i%t.getValueSize()])<1e-7)})));
const warning=contact.find(s=>s.time_s===.84),strike=contact.find(s=>s.time_s===1.25);
const heldWarning=contact.filter(s=>s.time_s>=.60&&s.time_s<=1.05).every(s=>new T.Vector3(...s.wrench_head).distanceTo(new T.Vector3(...warning.wrench_head))<.00001);
const footprint=new T.Box3().setFromPoints(rest.groups.thrusters);
const atWindup=phases.find(p=>p.phase==='windup');
const checks={exported_bounds_cover_all_poses:!!storedBounds&&union.min.toArray().every((v,i)=>v>=storedBounds.min[i])&&union.max.toArray().every((v,i)=>v<=storedBounds.max[i]),
 all_five_clips:gltf.animations.map(c=>c.name).sort().join()===['idle','move','attack','hit','defeat'].sort().join(),all_tracks_resolve_below_scene_root:bindings.every(b=>b.resolves&&!b.targets_scene_root),all_clips_move_actual_vertices:Object.values(animations).every(a=>a.max_temporal_vertex_displacement_m>.001),idle_move_seams:['idle','move'].every(n=>animations[n].loop_seam_max_m<.00001),held_defeat:animations.defeat.held_defeat_difference_m<.00001,
 no_floor_penetration:Object.values(animations).every(a=>a.bounds_y_up.min[1]>=-.00001),attached_joint_pivots:Object.values(attachments).every(d=>d<.00001),at_most_four_influences:maxInfluences<=4,normalized_weights:maxWeightError<.00001,identity_root_no_motion:rootFixed,no_root_bone_motion:rootBoneTracks.every(t=>t.constant),
 height_0_9_to_1_2_m:rest.box.max.y>=.9&&rest.box.max.y<=1.2&&Math.abs(rest.box.max.y-construction.height_m)<.001,explicit_hover_gap:Math.abs(rest.box.min.y-construction.hover_gap_m)<.001&&rest.box.min.y>.05,floor_centred_footprint:Math.abs(footprint.max.x+footprint.min.x)<.001&&Math.abs(footprint.max.z+footprint.min.z)<.001,
 one_1024_embedded_atlas:images.length===1&&images[0].width===1024&&images[0].height===1024,two_draw_primitives:meshes.length===2,actual_adapter_constructed:true,actual_adapter_defeat_vanish:state.visible===false&&state.vanish===1,adapter_root_identity:firstClone.position.length()<1e-8&&firstClone.scale.distanceTo(new T.Vector3(1,1,1))<1e-8,independent_skeleton_clone:cloneIndependent,
 attack_contact_1_25:Math.abs(animations.attack.duration_s*.625-1.25)<1e-9,actual_adapter_contact_pose:new T.Vector3(...atWindup.wrench).distanceTo(directContactWrench)<1e-5,warning_held_0_60_to_1_05:heldWarning,warning_wrench_raised_and_wound_back:warning.wrench_head[1]>contact[0].wrench_head[1]+.15&&warning.wrench_head[2]>contact[0].wrench_head[2]+.15&&warning.wrench_head[0]<-.65,forward_chop:strike.wrench_head[2]<warning.wrench_head[2]-.35&&strike.wrench_head[1]<warning.wrench_head[1]-.35,
 wrench_head_above_floor:Object.values(animations).every(a=>a.minimum_wrench_head_centre_y_m>.13)};
adapter.dispose();
const boundsRecord={method:'All exact exported skin vertices, rest and every clip at 60 Hz; conservative 0.005 m padding per axis.',safe_culling_envelope:{min:union.min.toArray().map(n=>Math.floor((n-.005)*1000)/1000),max:union.max.toArray().map(n=>Math.ceil((n+.005)*1000)/1000)}};
if(process.argv.includes('--write-bounds'))await writeFile(path.join(path.dirname(new URL(import.meta.url).pathname),'bounds.json'),JSON.stringify(boundsRecord,null,2)+'\n');
const record={asset_id:'gadget-helper',version:'v001',glb_sha256:createHash('sha256').update(bytes).digest('hex'),three_revision:T.REVISION,method:'Exact GLTFLoader; all exported skin vertices at 60 Hz; SkeletonUtils clone; actual src/game/enemy-animation.ts. Rotation-only joints are checked as fixed local pivots; the body hover, nozzle retraction and pupil glances are the intentional translations. The body hovers at rest with an explicit measured gap. No physical-device or universal triangle-collision proof.',rest_bounds_y_up:pack(rest.box),all_animation_bounds_y_up:pack(union),dimensions_m:rest.box.getSize(new T.Vector3()).toArray(),hover_gap_m:rest.box.min.y,footprint_y_up:pack(footprint),exported_safe_bounds_y_up:storedBounds,animations,images,root_bone_tracks:rootBoneTracks,tracks:bindings,attachment_pivot_max_drift_m:attachments,max_skin_influences:maxInfluences,max_weight_sum_error:maxWeightError,contact,adapter:{phases,direct_contact_wrench:directContactWrench.toArray(),hit_wrench:hitWrench,defeat_states:defeatStates},checks};
await writeFile(path.join(root,'three-inspection.json'),JSON.stringify(record,null,2)+'\n');
const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);console.log(JSON.stringify({failures,rest:record.rest_bounds_y_up,animated:record.all_animation_bounds_y_up,floor:Object.fromEntries(Object.entries(animations).map(([k,a])=>[k,[a.bounds_y_up.min[1],a.floor_minimum.bone,a.minimum_wrench_head_centre_y_m]])),attachments,maxInfluences,contact:contact.map(c=>[c.time_s,c.wrench_head.map(v=>+v.toFixed(3))])}));process.exitCode=failures.length?1:0;
