/** WO111 inator-monster: exact GLTFLoader, all-vertex bounds at 60 Hz, gameplay-camera pilot visibility, the
 * antenna-in-port constraint and the actual game adapter (src/game/enemy-animation.ts).
 * node_modules/.bin/tsx inspect-three.mjs <artifact-dir> [--write-bounds]   (adapted from the rival-mayor inspection) */
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
const root=path.resolve(process.argv[2]),bytes=await readFile(path.join(root,'inator-monster.glb'));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const construction=JSON.parse(await readFile(path.join(root,'construction.json'),'utf8'));
const rig=JSON.parse(await readFile(path.join(root,'source/rig-rest.json'),'utf8'));
const scene=gltf.scene,meshes=[],bones=[];scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);if(o.isBone)bones.push(o)});
const B=n=>scene.getObjectByName(n);
const pack=b=>({min:b.min.toArray(),max:b.max.toArray()});
const wp=o=>o.getWorldPosition(new T.Vector3());
const gl=([x,y,z])=>new T.Vector3(x,z,-y);   // Blender rest point -> glTF
scene.updateMatrixWorld(true);
const opaque=meshes.find(m=>!m.material.transparent),glass=meshes.find(m=>m.material.transparent);
const carried=(bone,blender)=>{const local=gl(blender).applyMatrix4(B(bone).matrixWorld.clone().invert());return ()=>local.clone().applyMatrix4(B(bone).matrixWorld)};
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
// ---- the antenna rod must cross the (closed) dome inside the brass port ring
const D=rig.dome,domeCentre=carried('dome',D.centre),portCentre=carried('dome',D.port_centre);
function portOffset(){
 scene.updateMatrixWorld(true);const a=wp(B('antenna_1')),b=B('antenna_2').getWorldPosition(new T.Vector3()),c=domeCentre(),dir=b.clone().sub(a),R=D.radius;
 // solve |a + s dir - c| = R for s in [0,1] (outgoing crossing)
 const f=a.clone().sub(c),A=dir.dot(dir),Bq=2*f.dot(dir),C=f.dot(f)-R*R,disc=Bq*Bq-4*A*C;if(disc<0)return {crosses:false,offset:Infinity};
 const s=(-Bq+Math.sqrt(disc))/(2*A);const hit=a.clone().add(dir.multiplyScalar(s));return {crosses:s>=0&&s<=1,offset:hit.distanceTo(portCentre()),s};
}
const restQ=Object.fromEntries(bones.map(b=>[b.name,b.quaternion.clone()]));
const relAngle=n=>restQ[n].angleTo(B(n).quaternion);   // local rotation away from the bind pose
const domeAngle=()=>relAngle('dome');
// ---- gameplay cameras (the follow camera trails the player at about 2.6 m; the boss usually faces the player)
const rayc=new T.Raycaster();rayc.firstHitOnly=false;
const pilotBones=new Set(['pilot_head','pilot_spine','pilot_root','pilot_upper_R','pilot_lower_R','pilot_upper_L','pilot_lower_L','pilot_hand_L']);
const headSamples=[[0,0,0.10],[0,0.06,0.02],[0,0.10,0.10],[-0.10,0,0.04],[0.08,0,0.04],[0,-0.09,0.06]].map(o=>carried('pilot_head',[-0.075+o[0],-0.12+0.03+o[1],2.34+0.315-0.05+o[2]]));
function dominantBone(mesh,face){const si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;let best=null,bw=-1;for(const v of [face.a,face.b,face.c])for(let j=0;j<4;j++){const w=sw.getComponent(v,j);if(w>bw){bw=w;best=mesh.skeleton.bones[si.getComponent(v,j)].name}}return best}
function pilotVisibility(){
 scene.updateMatrixWorld(true);opaque.skeleton.update();const out={};
 for(const az of [0,45,-45,90,-90,180]){
  const r=7.9,a=az*Math.PI/180,cam=new T.Vector3(-Math.sin(a)*r,2.62,-Math.cos(a)*r);let seen=0;
  for(const sample of headSamples){
   const target=sample(),dir=target.clone().sub(cam),dist=dir.length();dir.normalize();rayc.set(cam,dir);rayc.far=dist+0.02;
   const hits=rayc.intersectObject(opaque,false);const first=hits[0];
   if(!first||first.distance>=dist-0.13||pilotBones.has(dominantBone(opaque,first.face)))seen++;
  }
  out[az]=seen/headSamples.length;
 }
 return out;
}
const restLocal=bones.map(b=>[b,b.position.clone(),b.quaternion.clone(),b.scale.clone()]);
const resetRest=()=>{for(const [b,p,q,s] of restLocal){b.position.copy(p);b.quaternion.copy(q);b.scale.copy(s)}scene.updateMatrixWorld(true)};
const rest=points(),mixer=new T.AnimationMixer(scene),union=rest.box.clone(),animations={},bindings=[];
const restBonePositions=Object.fromEntries(bones.map(b=>[b.name,b.position.clone()]));
const restVis=pilotVisibility();
// Rotation-only joints keep their local pivot. hips (bob, rear, sit), tongue (sticks out), cockpit, pilot_root and
// pilot_head (jostle and head bonk) translate by design.
const translating=['root','hips','tongue','cockpit','pilot_root','pilot_head'];
const attachments=Object.fromEntries(bones.filter(b=>!translating.includes(b.name)).map(b=>[b.name,0]));
let rootFixed=true,maxInfluences=0,maxWeightError=0;
for(const mesh of meshes){const w=mesh.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++){
 const values=[w.getX(i),w.getY(i),w.getZ(i),w.getW(i)];maxInfluences=Math.max(maxInfluences,values.filter(x=>x>1e-6).length);maxWeightError=Math.max(maxWeightError,Math.abs(values.reduce((a,b)=>a+b,0)-1));
}}
const HOLD_FROM=construction.clips.find(c=>c.name==='defeat').held_final_pose_from_s;
let portWorst={offset:0},portFrames=0;const portByClip={};
for(const clip of gltf.animations){
 for(const track of clip.tracks){
  const binding=new T.PropertyBinding(scene,track.name);binding.bind();const probe=new Float64Array(track.getValueSize()).fill(NaN);binding.getValue(probe,0);
  bindings.push({clip:clip.name,track:track.name,node:binding.node?.name,resolves:probe.some(Number.isFinite),targets_scene_root:binding.node===scene});
 }
 mixer.stopAllAction();const action=mixer.clipAction(clip).setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const total=Math.ceil(clip.duration*60),bounds=new T.Box3();let first,last,hold,heldDifference=0,maxDisplacement=0,floorCause={y:Infinity},domeMax=0;
 for(let i=0;i<=total;i++){
  const time=clip.duration*i/total;mixer.setTime(time);const sample=points();bounds.union(sample.box);if(sample.minimum.y<floorCause.y)floorCause={...sample.minimum,time_s:time};
  if(i===0)first=sample.positions;if(i===total)last=sample.positions;
  for(let j=0;j<sample.positions.length;j++)maxDisplacement=Math.max(maxDisplacement,sample.positions[j].distanceTo(first[j]));
  if(clip.name==='defeat'&&time>=HOLD_FROM+1e-6){if(!hold)hold=sample.positions;else for(let j=0;j<hold.length;j++)heldDifference=Math.max(heldDifference,hold[j].distanceTo(sample.positions[j]));}
  const da=domeAngle();domeMax=Math.max(domeMax,da);
  if(da<0.06){const po=portOffset();portFrames++;portByClip[clip.name]=Math.max(portByClip[clip.name]??0,po.offset);if(!po.crosses||po.offset>portWorst.offset)portWorst={...po,clip:clip.name,time_s:time}}
  for(const b of bones)if(attachments[b.name]!==undefined)attachments[b.name]=Math.max(attachments[b.name],b.position.distanceTo(restBonePositions[b.name]));
  rootFixed&&=scene.position.length()<1e-8&&scene.quaternion.angleTo(new T.Quaternion())<1e-8&&scene.scale.distanceTo(new T.Vector3(1,1,1))<1e-8;
 }
 let seam=0;for(let j=0;j<first.length;j++)seam=Math.max(seam,first[j].distanceTo(last[j]));
 animations[clip.name]={duration_s:clip.duration,samples:total+1,all_vertices_per_sample:rest.positions.length,max_temporal_vertex_displacement_m:maxDisplacement,bounds_y_up:pack(bounds),loop_seam_max_m:seam,floor_minimum:floorCause,max_dome_open_rad:domeMax,held_defeat_difference_m:clip.name==='defeat'?heldDifference:null};union.union(bounds);
}
const play=(name,time)=>{mixer.stopAllAction();const a=mixer.clipAction(gltf.animations.find(c=>c.name===name)).setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();mixer.setTime(time);scene.updateMatrixWorld(true)};
const angleIn=child=>relAngle(child);
// Attack beats sampled directly from the clip.
const footLow=()=>{const p=points();return Math.min(...p.groups.foot_R.map(v=>v.y))};
const remoteInCockpit=()=>B('cockpit').worldToLocal(wp(B('remote'))).y;
mixer.stopAllAction();resetRest();const restFootLow=footLow(),restRemote=remoteInCockpit();
const beats=[];
for(const t of [0,0.3,0.55,0.8,0.98,1.05,1.15,1.25,1.35,1.5,2]){
 play('attack',t);const p=points();
 beats.push({time_s:t,foot_R:wp(B('foot_R')).toArray(),foot_R_low_y:Math.min(...p.groups.foot_R.map(v=>v.y)),head:wp(B('head')).toArray(),jaw_open_rad:angleIn('jaw'),remote:wp(B('remote')).toArray(),remote_rise_in_cockpit_m:remoteInCockpit()-restRemote,pupil_R_rad:angleIn('pupil_R'),hips:wp(B('hips')).toArray(),pilot_vis:t===1.25?pilotVisibility():undefined});
}
const at=t=>beats.find(s=>Math.abs(s.time_s-t)<1e-9);
const frontSweep=[];for(const t of [0,0.3,0.6,0.8,1.0,1.1,1.25,1.4,1.6,2.0]){play('attack',t);frontSweep.push({time_s:t,front_visibility:pilotVisibility()[0]})}
play('attack',1.25);const directContactFoot=wp(B('foot_R'));
// hit: tab flip, pilot head bonk, pupils rattle
// the bonk is measured in the cockpit bone's frame (its local Y is up), since the whole body recoils
const headInCockpit=()=>B('cockpit').worldToLocal(wp(B('pilot_head'))).y;
mixer.stopAllAction();resetRest();const pilotHeadRest=headInCockpit();
let tabLift=0,bonk=0,rattle=0;for(let i=0;i<=42;i++){play('hit',0.7*i/42);bonk=Math.max(bonk,headInCockpit()-pilotHeadRest);tabLift=Math.max(tabLift,angleIn('zipper_tab'));rattle=Math.max(rattle,angleIn('pupil_R'))}
// defeat held pose
play('defeat',gltf.animations.find(c=>c.name==='defeat').duration);
// crossed: each pupil sits on the inner side of its eye, toward the other eye (projected into the eye plane)
const crossed=(s,o)=>{const p=points(),g=p.groups['pupil_'+s],c=g.reduce((a,v)=>a.add(v),new T.Vector3()).multiplyScalar(1/g.length),e=wp(B('pupil_'+s)),n=B('pupil_'+s).localToWorld(new T.Vector3(0,1,0)).sub(e).normalize();
 const off=c.clone().sub(e),to=wp(B('pupil_'+o)).sub(e);off.sub(n.clone().multiplyScalar(off.dot(n)));to.sub(n.clone().multiplyScalar(to.dot(n)));return off.normalize().dot(to.normalize())};
const pupR=crossed('R','L'),pupL=crossed('L','R');
const defeatHeld={hips_height_m:wp(B('hips')).y,dome_open_rad:domeAngle(),antenna_ball_minus_remote_m:wp(B('antenna_3')).y-wp(B('remote')).y,pupil_R_toward_other_eye_cos:pupR,pupil_L_toward_other_eye_cos:pupL,pilot_visibility:pilotVisibility()};
mixer.stopAllAction();resetRest();const restAntennaRise=wp(B('antenna_3')).y-wp(B('remote')).y;
mixer.stopAllAction();scene.updateMatrixWorld(true);
// actual adapter
const firstClone=clone(scene),secondClone=clone(scene),frozenSource=bones.map(b=>b.matrix.toArray()),dome2=secondClone.getObjectByName('dome').quaternion.clone();
const adapter=new EnemyAnimation(firstClone,gltf.animations,.625);
const frame={id:'wo111-inator-monster-inspection',position:{x:0,y:0,z:0},facing:0,phase:'idle',windupProgress:0,hp:100,maxHp:100};
const phases=[];
for(const phase of ['idle','chasing','windup','strike','cooldown']){
 frame.phase=phase;for(let i=0;i<20;i++){frame.windupProgress=Math.min(1,i/15);adapter.update(frame,.05)}
 firstClone.updateMatrixWorld(true);phases.push({phase,visible:firstClone.visible,hips:wp(firstClone.getObjectByName('hips')).toArray(),foot_R:wp(firstClone.getObjectByName('foot_R')).toArray()});
}
frame.hp=70;frame.phase='idle';adapter.update(frame,.1);firstClone.updateMatrixWorld(true);const hitTab=wp(firstClone.getObjectByName('zipper_tab')).toArray();
for(let i=0;i<20;i++)adapter.update(frame,.05);frame.phase='defeated';let state;const defeatStates=[];
for(let i=0;i<60;i++){state=adapter.update(frame,.05);if([0,35,47,53,59].includes(i))defeatStates.push({time_s:(i+1)*.05,...state})}
scene.updateMatrixWorld(true);secondClone.updateMatrixWorld(true);firstClone.updateMatrixWorld(true);
const cloneIndependent=bones.every((b,i)=>b.matrix.toArray().every((x,j)=>Math.abs(x-frozenSource[i][j])<1e-10))&&secondClone.getObjectByName('dome').quaternion.toArray().every((x,i)=>Math.abs(x-dome2.toArray()[i])<1e-10);
const storedBounds=B('Inator_Monster_Skin')?.userData.model_space_bounds_y_up;
const rootBoneTracks=gltf.animations.flatMap(c=>c.tracks.filter(t=>t.name.startsWith('root.')).map(t=>({clip:c.name,name:t.name,constant:Array.from(t.values).every((v,i,a)=>Math.abs(v-a[i%t.getValueSize()])<1e-7)})));
const body=new T.Box3().setFromPoints([...rest.groups.hips,...rest.groups.spine_1,...rest.groups.spine_2]);
const atWindup=phases.find(p=>p.phase==='windup');
const lifted=at(0.98),contact=at(1.25);
const checks={exported_bounds_cover_all_poses:!!storedBounds&&union.min.toArray().every((v,i)=>v>=storedBounds.min[i])&&union.max.toArray().every((v,i)=>v<=storedBounds.max[i]),
 all_five_clips:gltf.animations.map(c=>c.name).sort().join()===[...enemyClipNames].sort().join(),all_tracks_resolve_below_scene_root:bindings.every(b=>b.resolves&&!b.targets_scene_root),all_clips_move_actual_vertices:Object.values(animations).every(a=>a.max_temporal_vertex_displacement_m>.001),idle_move_seams:['idle','move'].every(n=>animations[n].loop_seam_max_m<.00001),held_defeat:animations.defeat.held_defeat_difference_m<.00001,
 no_floor_penetration:Object.values(animations).every(a=>a.bounds_y_up.min[1]>=-.00001),attached_joint_pivots:Object.values(attachments).every(d=>d<.00001),at_most_four_influences:maxInfluences<=4,normalized_weights:maxWeightError<.00001,identity_root_no_motion:rootFixed,no_root_bone_motion:rootBoneTracks.every(t=>t.constant),
 boss_height_3_0_to_3_4_m_to_antenna_tip:rest.box.max.y>=3.0&&rest.box.max.y<=3.4&&Math.abs(rest.box.max.y-construction.height_m)<.001,standing_on_floor:rest.box.min.y>=0&&rest.box.min.y<.01,floor_centred_body:Math.abs(body.max.x+body.min.x)<.05&&Math.abs(body.max.z+body.min.z)<.12,
 one_1024_embedded_atlas:images.length===1&&images[0].width===1024&&images[0].height===1024,two_draw_primitives_opaque_and_glass:meshes.length===2&&!!opaque&&!!glass&&glass.material.depthWrite===false,actual_adapter_constructed:true,actual_adapter_defeat_vanish:state.visible===false&&state.vanish===1,adapter_root_identity:firstClone.position.length()<1e-8&&firstClone.scale.distanceTo(new T.Vector3(1,1,1))<1e-8,independent_skeleton_clone:cloneIndependent,
 attack_contact_1_25:Math.abs(animations.attack.duration_s*.625-1.25)<1e-9,actual_adapter_contact_pose:new T.Vector3(...atWindup.foot_R).distanceTo(directContactFoot)<1e-5,
 right_foot_raised_before_stomp:lifted.foot_R_low_y>restFootLow+.15,right_foot_on_floor_at_contact:Math.abs(contact.foot_R_low_y-restFootLow)<.01,roar_jaw_open_at_contact:contact.jaw_open_rad>.25,remote_jabbed_at_contact:contact.remote_rise_in_cockpit_m>.02,
 antenna_in_port_while_dome_closed:portWorst.offset<=D.port_hole_radius-D.antenna_radius&&portFrames>0,
 pilot_head_visible_from_all_gameplay_camera_angles_at_rest:Object.values(restVis).every(v=>v>0),pilot_head_visible_at_contact:Object.values(contact.pilot_vis).every(v=>v>0),pilot_head_visible_from_front_throughout_attack:frontSweep.every(f=>f.front_visibility>0),
 hit_tab_flips_up:tabLift>1.5,hit_pilot_head_bonk:bonk>.015,hit_pupils_rattle:rattle>.6,
 defeat_seated:defeatHeld.hips_height_m<.55,defeat_dome_popped_open_held:defeatHeld.dome_open_rad>1.5,defeat_antenna_drooped:defeatHeld.antenna_ball_minus_remote_m<restAntennaRise-.15,defeat_pupils_crossed:pupR>.6&&pupL>.6};
adapter.dispose();
const boundsRecord={method:'All exact exported skin vertices, rest and every clip at 60 Hz; conservative 0.005 m padding per axis.',safe_culling_envelope:{min:union.min.toArray().map(n=>Math.floor((n-.005)*1000)/1000),max:union.max.toArray().map(n=>Math.ceil((n+.005)*1000)/1000)}};
if(process.argv.includes('--write-bounds'))await writeFile(path.join(path.dirname(new URL(import.meta.url).pathname),'bounds.json'),JSON.stringify(boundsRecord,null,2)+'\n');
const record={asset_id:'inator-monster',version:'v001',glb_sha256:createHash('sha256').update(bytes).digest('hex'),three_revision:T.REVISION,method:'Exact GLTFLoader; all exported skin vertices at 60 Hz; SkeletonUtils clone; actual src/game/enemy-animation.ts; raycasts against the skinned opaque primitive from six gameplay camera azimuths (7.9 m out, 2.62 m high); antenna rod crossing tested against the posed brass port on every closed-dome frame. Rotation-only joints are checked as fixed local pivots; the hips, tongue, cockpit, pilot root and pilot head are the intentional translations. No physical-device or universal triangle-collision proof.',
 rest_bounds_y_up:pack(rest.box),all_animation_bounds_y_up:pack(union),dimensions_m:rest.box.getSize(new T.Vector3()).toArray(),height_m:rest.box.max.y,sole_clearance_m:rest.box.min.y,body_footprint_y_up:pack(body),exported_safe_bounds_y_up:storedBounds,animations,images,root_bone_tracks:rootBoneTracks,tracks:bindings,attachment_pivot_max_drift_m:attachments,max_skin_influences:maxInfluences,max_weight_sum_error:maxWeightError,
 attack_beats:beats,attack_front_pilot_visibility:frontSweep,rest_foot_low_y:restFootLow,antenna_port:{worst:portWorst,by_clip_max_offset_m:portByClip,closed_dome_frames:portFrames,allowed_offset_m:D.port_hole_radius-D.antenna_radius},pilot_visibility_rest:restVis,
 hit:{tab_flip_rad:tabLift,pilot_head_bonk_m:bonk,pupil_rattle_rad:rattle},defeat_held:defeatHeld,adapter:{phases,direct_contact_foot:directContactFoot.toArray(),hit_tab:hitTab,defeat_states:defeatStates},checks};
await writeFile(path.join(root,'three-inspection.json'),JSON.stringify(record,null,2)+'\n');
const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);console.log(JSON.stringify({failures,rest:record.rest_bounds_y_up,animated:record.all_animation_bounds_y_up,floor:Object.fromEntries(Object.entries(animations).map(([k,a])=>[k,[+a.bounds_y_up.min[1].toFixed(4),a.floor_minimum.bone,+a.floor_minimum.time_s.toFixed(3)]])),port:portWorst,portByClip,vis:restVis,frontSweep:frontSweep.map(f=>f.front_visibility),contactVis:contact.pilot_vis,lifted:lifted.foot_R_low_y,contactFoot:contact.foot_R_low_y,restFootLow,jaw:contact.jaw_open_rad,hit:record.hit,defeatHeld,pivots:Object.fromEntries(Object.entries(attachments).filter(([,d])=>d>1e-5)),seams:Object.fromEntries(['idle','move'].map(n=>[n,animations[n].loop_seam_max_m])),held:animations.defeat.held_defeat_difference_m}));process.exitCode=failures.length?1:0;
