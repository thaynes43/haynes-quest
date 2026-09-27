/** WO111 lab-robot: exact GLTFLoader, all-vertex bounds at 60 Hz, and the actual game adapter.
 * node_modules/.bin/tsx scripts/assets/lab-robot/v001/inspect-three.mjs <artifact-dir> [--write-bounds]
 * Adapted from the radio-host-showman v001 inspect-three.mjs. Slinky stretch is child translation along each
 * parent's own axis, so stretch bones are checked for direction-preserving local translation instead of fixed pivots. */
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
const root=path.resolve(process.argv[2]),bytes=await readFile(path.join(root,'lab-robot.glb'));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const construction=JSON.parse(await readFile(path.join(root,'construction.json'),'utf8'));
const RIG=JSON.parse(await readFile(path.join(root,'source/rig-rest.json'),'utf8')).rest;
const scene=gltf.scene,meshes=[],bones=[];scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);if(o.isBone)bones.push(o)});
const B=n=>scene.getObjectByName(n);
const pack=b=>({min:b.min.toArray(),max:b.max.toArray()});
const wp=o=>o.getWorldPosition(new T.Vector3());
const gl=([x,y,z])=>new T.Vector3(x,z,-y);   // Blender (x, y, z) -> glTF (x, z, -y)
scene.updateMatrixWorld(true);
const skel=meshes[0].skeleton,boneIndex=Object.fromEntries(skel.bones.map((b,i)=>[b.name,i]));
// a rest-space point (glTF coordinates) carried by one bone's current skinning transform
const carried=(name,p)=>{const i=boneIndex[name];return p.clone().applyMatrix4(skel.boneInverses[i]).applyMatrix4(skel.bones[i].matrixWorld)};
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
const rest=points(),mixer=new T.AnimationMixer(scene),union=rest.box.clone(),animations={},bindings=[];
const restBonePositions=Object.fromEntries(bones.map(b=>[b.name,b.position.clone()]));
const restLocalQ=Object.fromEntries(bones.map(b=>[b.name,b.quaternion.clone()]));
// The chassis carries the rocking and the slump (like hips); stretch bones slide along their rest local direction only.
const free=['root','chassis'];
const stretch=['waist','head',...['R','L'].flatMap(s=>[2,3,4,5].map(i=>`arm_${s}_${i}`).concat([`claw_${s}`])),'cord_2','cord_3','cord_4','cord_5','plug'];
const attachments=Object.fromEntries(bones.filter(b=>!free.includes(b.name)&&!stretch.includes(b.name)).map(b=>[b.name,0]));
const stretchDrift=Object.fromEntries(stretch.map(n=>[n,{off_axis_m:0,max_ratio:1,min_ratio:1,max_extra_m:0}]));
let rootFixed=true,maxInfluences=0,maxWeightError=0;
for(const mesh of meshes){const w=mesh.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++){
 const values=[w.getX(i),w.getY(i),w.getZ(i),w.getW(i)];maxInfluences=Math.max(maxInfluences,values.filter(x=>x>1e-6).length);maxWeightError=Math.max(maxWeightError,Math.abs(values.reduce((a,b)=>a+b,0)-1));
}}
const HOLD_FROM=construction.clips.find(c=>c.name==='defeat').held_final_pose_from_s;
const reach=(name,center)=>{const g=points().groups[name];return g.length?Math.max(...g.map(p=>p.distanceTo(center))):0};
const FX={sparks:gl([0,0.10,0.55]),smoke_a:null,smoke_b:null,glare:null};
const maxScale={};
for(const clip of gltf.animations){
 for(const track of clip.tracks){
  const binding=new T.PropertyBinding(scene,track.name);binding.bind();const probe=new Float64Array(track.getValueSize()).fill(NaN);binding.getValue(probe,0);
  bindings.push({clip:clip.name,track:track.name,node:binding.node?.name,resolves:probe.some(Number.isFinite),targets_scene_root:binding.node===scene});
 }
 mixer.stopAllAction();const action=mixer.clipAction(clip).setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const total=Math.ceil(clip.duration*60),bounds=new T.Box3();let first,last,hold,heldDifference=0,maxDisplacement=0,floorCause={y:Infinity},maxTop=-Infinity;
 const scl={sparks:1,smoke_a:1,smoke_b:1,glare:1,pupil_min:9,pupil_max:0,button_min:9};const fxReach={sparks:0,smoke:0};
 for(let i=0;i<=total;i++){
  const time=clip.duration*i/total;mixer.setTime(time);const sample=points();bounds.union(sample.box);if(sample.minimum.y<floorCause.y)floorCause={...sample.minimum,time_s:time};
  maxTop=Math.max(maxTop,sample.box.max.y);
  for(const n of ['sparks','smoke_a','smoke_b','glare'])scl[n]=Math.max(scl[n],B(n).scale.x);
  scl.pupil_min=Math.min(scl.pupil_min,B('pupil').scale.x);scl.pupil_max=Math.max(scl.pupil_max,B('pupil').scale.x);scl.button_min=Math.min(scl.button_min,B('button').scale.y);
  {const c=wp(B('sparks'));fxReach.sparks=Math.max(fxReach.sparks,...sample.groups.sparks.map(p=>p.distanceTo(c)));
   const k=wp(B('smoke_a'));fxReach.smoke=Math.max(fxReach.smoke,...sample.groups.smoke_a.map(p=>p.distanceTo(k)),...sample.groups.smoke_b.map(p=>p.distanceTo(k)))}
  if(i===0)first=sample.positions;if(i===total)last=sample.positions;
  for(let j=0;j<sample.positions.length;j++)maxDisplacement=Math.max(maxDisplacement,sample.positions[j].distanceTo(first[j]));
  if(clip.name==='defeat'&&time>=HOLD_FROM+1e-6){if(!hold)hold=sample.positions;else for(let j=0;j<hold.length;j++)heldDifference=Math.max(heldDifference,hold[j].distanceTo(sample.positions[j]));}
  for(const b of bones){
   if(attachments[b.name]!==undefined)attachments[b.name]=Math.max(attachments[b.name],b.position.distanceTo(restBonePositions[b.name]));
   else if(stretchDrift[b.name]){const r=restBonePositions[b.name],p=b.position,rl=r.length(),along=p.dot(r)/rl,off=p.clone().sub(r.clone().multiplyScalar(along/rl)).length(),d=stretchDrift[b.name];
    d.off_axis_m=Math.max(d.off_axis_m,off);d.max_ratio=Math.max(d.max_ratio,along/rl);d.min_ratio=Math.min(d.min_ratio,along/rl);d.max_extra_m=Math.max(d.max_extra_m,along-rl)}
  }
  rootFixed&&=scene.position.length()<1e-8&&scene.quaternion.angleTo(new T.Quaternion())<1e-8&&scene.scale.distanceTo(new T.Vector3(1,1,1))<1e-8;
 }
 let seam=0;for(let j=0;j<first.length;j++)seam=Math.max(seam,first[j].distanceTo(last[j]));
 maxScale[clip.name]=scl;
 animations[clip.name]={duration_s:clip.duration,samples:total+1,all_vertices_per_sample:rest.positions.length,max_temporal_vertex_displacement_m:maxDisplacement,bounds_y_up:pack(bounds),top_m:maxTop,loop_seam_max_m:seam,floor_minimum:floorCause,scales:scl,fx_reach_m:fxReach,held_defeat_difference_m:clip.name==='defeat'?heldDifference:null};
 union.union(bounds);
}
const play=(name,t)=>{mixer.stopAllAction();const a=mixer.clipAction(gltf.animations.find(c=>c.name===name)).setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();mixer.setTime(t);scene.updateMatrixWorld(true);skel.update()};
// Idle 0 s must be the approved sheet pose: both claw wrists at the blockout's.
const sheetT=construction.sheet_targets;
play('idle',0);
const sheet={claw_R:wp(B('claw_R')).toArray(),claw_R_expected:gl(sheetT.claw_R).toArray(),claw_R_error_m:wp(B('claw_R')).distanceTo(gl(sheetT.claw_R)),
 claw_L_error_m:wp(B('claw_L')).distanceTo(gl(sheetT.claw_L)),idle0_top_m:points().box.max.y,idle0_bounds_y_up:pack(points().box),idle0_dimensions_m:points().box.getSize(new T.Vector3()).toArray()};
// jaw tips: the rest jaw tails carried by each jaw bone
const tip=(s,t)=>carried(`jaw_${s}_${t}`,gl(RIG[`jaw_${s}_${t}`][1]));
const jawGap=s=>tip(s,'a').distanceTo(tip(s,'b'));
const clawTip=s=>tip(s,'a').add(tip(s,'b')).multiplyScalar(.5);
const restGap={R:jawGap('R'),L:jawGap('L')};
const beats=[];
for(const t of [0,.30,.60,.90,1.00,1.12,1.18,1.25,1.40,1.60,1.85,2]){
 play('attack',t);const ct=clawTip('R');
 const chain=['arm_R_1','arm_R_2','arm_R_3','arm_R_4','arm_R_5','claw_R'].map(n=>wp(B(n)));let armLen=0;for(let k=1;k<chain.length;k++)armLen+=chain[k].distanceTo(chain[k-1]);
 beats.push({time_s:t,arm_R_length_m:armLen,claw_R_tip:ct.toArray(),jaw_R_gap_m:jawGap('R'),glare_scale:B('glare').scale.x,pupil_scale:B('pupil').scale.x,beacon_quat:B('beacon').quaternion.toArray(),chassis:wp(B('chassis')).toArray(),head:wp(B('head')).toArray()});
}
const at=t=>beats.find(s=>Math.abs(s.time_s-t)<1e-9);
play('attack',1.25);const directContactTip=clawTip('R');
// beacon turns in the attack (accumulated yaw of the beacon about its own axis)
let spin=0;{let prev=null;for(let i=0;i<=120;i++){play('attack',2*i/120);const q=B('beacon').quaternion.clone();if(prev){spin+=2*Math.acos(Math.min(1,Math.abs(prev.dot(q))))}prev=q}}
// held defeat
const defeatDur=gltf.animations.find(c=>c.name==='defeat').duration;
play('defeat',0.30);const bonk={button_scale_y:B('button').scale.y,claw_L_tip:clawTip('L').toArray(),button:wp(B('button')).toArray(),tip_to_button_m:clawTip('L').distanceTo(wp(B('button')))};
play('defeat',0.62);const sparksMid={scale:B('sparks').scale.x,head_pop_m:wp(B('head')).y-gl(RIG.head[0]).y};
play('defeat',defeatDur);
const chassisQ=B('chassis').getWorldQuaternion(new T.Quaternion()),chassisUp=new T.Vector3(0,1,0).applyQuaternion(chassisQ);
// the lid angle relative to the head (its parent): the drooping head must not hide or fake the pop
const restDomeLocal=(()=>{mixer.stopAllAction();for(const b of bones){b.position.copy(restBonePositions[b.name])}scene.updateMatrixWorld(true);return restLocalQ.dome.clone()})();
play('defeat',defeatDur);
const domeQ=B('dome').quaternion.clone().multiply(restDomeLocal.clone().invert());
const defeatHeld={roll_deg:Math.atan2(chassisUp.x,chassisUp.y)*180/Math.PI,dome_open_deg:2*Math.acos(Math.min(1,Math.abs(domeQ.w)))*180/Math.PI,smoke_scale:[B('smoke_a').scale.x,B('smoke_b').scale.x],sparks_scale:B('sparks').scale.x,
 eyelid_scale_z:B('eyelid').scale.z,pupil_scale:B('pupil').scale.x,head_height_m:wp(B('head')).y,top_m:points().box.max.y,lowest_m:points().minimum.y};
play('hit',.2);const hitPupil=B('pupil').scale.x;
mixer.stopAllAction();scene.updateMatrixWorld(true);
const firstClone=clone(scene),secondClone=clone(scene),frozenSource=bones.map(b=>b.matrix.toArray()),q2=secondClone.getObjectByName('head').quaternion.clone();
const adapter=new EnemyAnimation(firstClone,gltf.animations,.625);
const frame={id:'wo111-lab-robot-inspection',position:{x:0,y:0,z:0},facing:0,phase:'idle',windupProgress:0,hp:100,maxHp:100};
const phases=[];const cskel=[];firstClone.traverse(o=>{if(o.isSkinnedMesh)cskel.push(o.skeleton)});
const ctip=()=>{firstClone.updateMatrixWorld(true);const sk=cskel[0],i=sk.bones.findIndex(b=>b.name==='jaw_R_a'),j=sk.bones.findIndex(b=>b.name==='jaw_R_b');
 const a=gl(RIG.jaw_R_a[1]).applyMatrix4(sk.boneInverses[i]).applyMatrix4(sk.bones[i].matrixWorld),b=gl(RIG.jaw_R_b[1]).applyMatrix4(sk.boneInverses[j]).applyMatrix4(sk.bones[j].matrixWorld);return a.add(b).multiplyScalar(.5)};
for(const phase of ['idle','chasing','windup','strike','cooldown']){
 frame.phase=phase;for(let i=0;i<20;i++){frame.windupProgress=Math.min(1,i/15);adapter.update(frame,.05)}
 firstClone.updateMatrixWorld(true);phases.push({phase,visible:firstClone.visible,chassis:wp(firstClone.getObjectByName('chassis')).toArray(),claw_R_tip:ctip().toArray(),glare_scale:firstClone.getObjectByName('glare').scale.x});
}
frame.hp=70;frame.phase='idle';adapter.update(frame,.1);firstClone.updateMatrixWorld(true);const hitPupilAdapter=firstClone.getObjectByName('pupil').scale.x;
for(let i=0;i<20;i++)adapter.update(frame,.05);frame.phase='defeated';let state;const defeatStates=[];
for(let i=0;i<70;i++){state=adapter.update(frame,.05);if([0,35,49,55,69].includes(i))defeatStates.push({time_s:(i+1)*.05,...state})}
scene.updateMatrixWorld(true);secondClone.updateMatrixWorld(true);firstClone.updateMatrixWorld(true);
const cloneIndependent=bones.every((b,i)=>b.matrix.toArray().every((x,j)=>Math.abs(x-frozenSource[i][j])<1e-10))&&secondClone.getObjectByName('head').quaternion.toArray().every((x,i)=>Math.abs(x-q2.toArray()[i])<1e-10);
const storedBounds=B('Lab_Robot_Skin')?.userData.model_space_bounds_y_up;
const rootBoneTracks=gltf.animations.flatMap(c=>c.tracks.filter(t=>t.name.startsWith('root.')).map(t=>({clip:c.name,name:t.name,constant:Array.from(t.values).every((v,i,a)=>Math.abs(v-a[i%t.getValueSize()])<1e-7)})));
const restA=at(0),contact=at(1.25),windup=at(.90);
const body=new T.Box3().setFromPoints([...rest.groups.body,...rest.groups.chassis]);
const atWindup=phases.find(p=>p.phase==='windup');
const mats=[];meshes.forEach(m=>{const mm=m.material;mats.push({name:mm.name,emissive:mm.emissive.toArray(),emissiveMap:!!mm.emissiveMap,sameAtlas:mm.emissiveMap?mm.emissiveMap.image===mm.map.image:null})});
const glowMat=mats.find(m=>m.emissiveMap);
const hidden=n=>['idle','move','hit'].every(c=>maxScale[c][n]<1.001);
const checks={exported_bounds_cover_all_poses:!!storedBounds&&union.min.toArray().every((v,i)=>v>=storedBounds.min[i])&&union.max.toArray().every((v,i)=>v<=storedBounds.max[i]),
 all_five_clips:gltf.animations.map(c=>c.name).sort().join()===['idle','move','attack','hit','defeat'].sort().join(),all_tracks_resolve_below_scene_root:bindings.every(b=>b.resolves&&!b.targets_scene_root),all_clips_move_actual_vertices:Object.values(animations).every(a=>a.max_temporal_vertex_displacement_m>.001),idle_move_seams:['idle','move'].every(n=>animations[n].loop_seam_max_m<.00001),held_defeat:animations.defeat.held_defeat_difference_m<.00001,
 no_floor_penetration:Object.values(animations).every(a=>a.bounds_y_up.min[1]>=-.00001),attached_joint_pivots:Object.values(attachments).every(d=>d<.00001),stretch_only_along_parent_axis:Object.values(stretchDrift).every(d=>d.off_axis_m<.0001&&d.min_ratio>.3&&d.max_extra_m<.25),
 at_most_four_influences:maxInfluences<=4,normalized_weights:maxWeightError<.00001,identity_root_no_motion:rootFixed,no_root_bone_motion:rootBoneTracks.every(t=>t.constant),
 robot_height_1_2_to_1_4_m:rest.box.max.y>=1.2&&rest.box.max.y<=1.4&&Math.abs(rest.box.max.y-construction.height_m)<.001,standing_on_floor:rest.box.min.y>=-1e-6&&rest.box.min.y<.01,floor_centred_body:Math.abs(body.max.x+body.min.x)<.03&&Math.abs(body.max.z+body.min.z)<.03,
 one_1024_embedded_atlas:images.length===1&&images[0].width===1024&&images[0].height===1024,two_draw_primitives:meshes.length===2,glow_material_emits_from_the_atlas:!!glowMat&&glowMat.sameAtlas===true&&glowMat.emissive.every(v=>Math.abs(v-1)<1e-6),
 actual_adapter_constructed:true,actual_adapter_defeat_vanish:state.visible===false&&state.vanish===1,adapter_root_identity:firstClone.position.length()<1e-8&&firstClone.scale.distanceTo(new T.Vector3(1,1,1))<1e-8,independent_skeleton_clone:cloneIndependent,
 attack_contact_1_25:Math.abs(animations.attack.duration_s*.625-1.25)<1e-9,actual_adapter_contact_pose:new T.Vector3(...atWindup.claw_R_tip).distanceTo(directContactTip)<1e-5,
 idle_0_is_the_sheet_pose:sheet.claw_R_error_m<.001&&sheet.claw_L_error_m<.001,
 effects_hidden_outside_their_clips:hidden('sparks')&&hidden('smoke_a')&&hidden('smoke_b')&&hidden('glare')&&maxScale.attack.sparks<1.001&&maxScale.attack.smoke_a<1.001,
 red_glare_opens_for_the_attack:restA.glare_scale<1.001&&contact.glare_scale>20&&at(2).glare_scale<1.001,
 warning_light_spins_in_the_attack:spin>2*Math.PI*2.5,
 pincer_lunges_forward_at_contact:contact.claw_R_tip[2]<-0.6&&contact.claw_R_tip[1]>0.45&&contact.claw_R_tip[1]<0.95&&contact.claw_R_tip[2]<windup.claw_R_tip[2]-0.4,
 pincer_snapped_shut_at_contact:contact.jaw_R_gap_m<restGap.R-0.004,
 iris_shrinks_in_hit:maxScale.hit.pupil_min<0.6,
 defeat_bonks_the_button_and_sparks:bonk.button_scale_y<0.6&&bonk.tip_to_button_m<0.12&&maxScale.defeat.sparks>20&&defeatHeld.sparks_scale<1.001,
 defeat_dome_pops_and_smokes_held:defeatHeld.dome_open_deg>55&&defeatHeld.smoke_scale.every(s=>s>20)&&Math.abs(defeatHeld.roll_deg)>8&&animations.defeat.held_defeat_difference_m<.00001};
adapter.dispose();
const boundsRecord={method:'All exact exported skin vertices, rest and every clip at 60 Hz; conservative 0.005 m padding per axis.',safe_culling_envelope:{min:union.min.toArray().map(n=>Math.floor((n-.005)*1000)/1000),max:union.max.toArray().map(n=>Math.ceil((n+.005)*1000)/1000)}};
if(process.argv.includes('--write-bounds'))await writeFile(path.join(path.dirname(new URL(import.meta.url).pathname),'bounds.json'),JSON.stringify(boundsRecord,null,2)+'\n');
const record={asset_id:'lab-robot',version:'v001',glb_sha256:createHash('sha256').update(bytes).digest('hex'),three_revision:T.REVISION,method:'Exact GLTFLoader; all exported skin vertices at 60 Hz; SkeletonUtils clone; actual src/game/enemy-animation.ts. Rotation/scale-only joints are checked as fixed local pivots; the chassis rocking/slump and the slinky/cord/neck/suspension stretch (child translation along the parent axis) are the intentional translations. No physical-device or universal triangle-collision proof (the Blender attachment audit covers listed part pairs).',
 rest_bounds_y_up:pack(rest.box),all_animation_bounds_y_up:pack(union),dimensions_m:rest.box.getSize(new T.Vector3()).toArray(),height_m:rest.box.max.y,sole_clearance_m:rest.box.min.y,body_footprint_y_up:pack(body),exported_safe_bounds_y_up:storedBounds,animations,images,materials:mats,root_bone_tracks:rootBoneTracks,tracks:bindings,attachment_pivot_max_drift_m:attachments,stretch_bones:stretchDrift,max_skin_influences:maxInfluences,max_weight_sum_error:maxWeightError,
 sheet_pose:sheet,rest_jaw_gap_m:restGap,attack_beats:beats,attack_beacon_turns:spin/(2*Math.PI),defeat_bonk:bonk,defeat_mid:sparksMid,defeat_held:defeatHeld,hit_pupil_0_2_s:hitPupil,adapter:{phases,direct_contact_tip:directContactTip.toArray(),hit_pupil:hitPupilAdapter,defeat_states:defeatStates},checks};
await writeFile(path.join(root,'three-inspection.json'),JSON.stringify(record,null,2)+'\n');
const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);console.log(JSON.stringify({failures,rest:record.rest_bounds_y_up,animated:record.all_animation_bounds_y_up,floor:Object.fromEntries(Object.entries(animations).map(([k,a])=>[k,[+a.bounds_y_up.min[1].toFixed(4),a.floor_minimum.bone,+a.floor_minimum.time_s.toFixed(3)]])),seams:[animations.idle.loop_seam_max_m,animations.move.loop_seam_max_m],sheet,contact:{tip:contact.claw_R_tip,gap:contact.jaw_R_gap_m,restGap:restGap.R,glare:contact.glare_scale},windupTip:windup.claw_R_tip,spinTurns:spin/(2*Math.PI),bonk,sparksMid,defeatHeld,stretch:Object.fromEntries(Object.entries(stretchDrift).map(([k,d])=>[k,[+d.off_axis_m.toExponential(1),+d.min_ratio.toFixed(2),+d.max_ratio.toFixed(2)]])),maxInfluences,attachments:Object.entries(attachments).filter(([,d])=>d>1e-5)}));process.exitCode=failures.length?1:0;
