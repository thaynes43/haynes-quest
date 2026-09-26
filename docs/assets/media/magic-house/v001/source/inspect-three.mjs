/** WO111 magic-house: exact GLTFLoader, all-vertex bounds at 60 Hz, and the actual game adapter.
 * node_modules/.bin/tsx inspect-three.mjs <artifact-dir> [--write-bounds]   (run from scripts/assets/magic-house/v001) */
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
const root=path.resolve(process.argv[2]),bytes=await readFile(path.join(root,'magic-house.glb'));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const construction=JSON.parse(await readFile(path.join(root,'construction.json'),'utf8'));
const scene=gltf.scene,meshes=[],bones=[];scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);if(o.isBone)bones.push(o)});
const B=n=>scene.getObjectByName(n);
const pack=b=>({min:b.min.toArray(),max:b.max.toArray()});
const wp=o=>o.getWorldPosition(new T.Vector3());
const TILES=['tile_1','tile_2','tile_3','tile_4','tile_5','ridge_tile'];
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
const rest=points(),mixer=new T.AnimationMixer(scene),union=rest.box.clone(),animations={},bindings=[];
const restBonePositions=Object.fromEntries(bones.map(b=>[b.name,b.position.clone()]));
const restRoofWorldY=wp(B('roof')).y;
const restTileCentres=Object.fromEntries(TILES.map(t=>[t,boxOf(rest.groups[t]).getCenter(new T.Vector3())]));
// Rotation/scale-only joints keep their local pivot. The body, roof, legs, tiles, pupils and butterflies translate by design.
const translating=['root','body','roof','leg_R','leg_L',...TILES,'pupil_R','pupil_L','butterfly_1','butterfly_2'];
const attachments=Object.fromEntries(bones.filter(b=>!translating.includes(b.name)).map(b=>[b.name,0]));
let rootFixed=true,maxInfluences=0,maxWeightError=0;
for(const mesh of meshes){const w=mesh.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++){
 const values=[w.getX(i),w.getY(i),w.getZ(i),w.getW(i)];maxInfluences=Math.max(maxInfluences,values.filter(x=>x>1e-6).length);maxWeightError=Math.max(maxWeightError,Math.abs(values.reduce((a,b)=>a+b,0)-1));
}}
const HOLD_FROM=construction.clips.find(c=>c.name==='defeat').held_final_pose_from_s;
const lidLow={};
for(const clip of gltf.animations){
 for(const track of clip.tracks){
  const binding=new T.PropertyBinding(scene,track.name);binding.bind();const probe=new Float64Array(track.getValueSize()).fill(NaN);binding.getValue(probe,0);
  bindings.push({clip:clip.name,track:track.name,node:binding.node?.name,resolves:probe.some(Number.isFinite),targets_scene_root:binding.node===scene});
 }
 mixer.stopAllAction();const action=mixer.clipAction(clip).setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const total=Math.ceil(clip.duration*60),bounds=new T.Box3();let first,last,hold,heldDifference=0,maxDisplacement=0,floorCause={y:Infinity},minLid=Infinity,minFloorByBone={};
 for(let i=0;i<=total;i++){
  const time=clip.duration*i/total;mixer.setTime(time);const sample=points();bounds.union(sample.box);if(sample.minimum.y<floorCause.y)floorCause={...sample.minimum,time_s:time};
  for(const [name,pts] of Object.entries(sample.groups)){if(!pts.length)continue;const y=Math.min(...pts.map(p=>p.y));if(minFloorByBone[name]===undefined||y<minFloorByBone[name])minFloorByBone[name]=y}
  if(i===0)first=sample.positions;if(i===total)last=sample.positions;
  for(let j=0;j<sample.positions.length;j++)maxDisplacement=Math.max(maxDisplacement,sample.positions[j].distanceTo(first[j]));
  if(clip.name==='defeat'&&time>=HOLD_FROM+1e-6){if(!hold)hold=sample.positions;else for(let j=0;j<hold.length;j++)heldDifference=Math.max(heldDifference,hold[j].distanceTo(sample.positions[j]));}
  minLid=Math.min(minLid,...['lid_R','lid_L'].map(n=>Math.min(...sample.groups[n].map(p=>p.y))));
  for(const b of bones)if(attachments[b.name]!==undefined)attachments[b.name]=Math.max(attachments[b.name],b.position.distanceTo(restBonePositions[b.name]));
  rootFixed&&=scene.position.length()<1e-8&&scene.quaternion.angleTo(new T.Quaternion())<1e-8&&scene.scale.distanceTo(new T.Vector3(1,1,1))<1e-8;
 }
 let seam=0;for(let j=0;j<first.length;j++)seam=Math.max(seam,first[j].distanceTo(last[j]));
 lidLow[clip.name]=minLid;
 animations[clip.name]={duration_s:clip.duration,samples:total+1,all_vertices_per_sample:rest.positions.length,max_temporal_vertex_displacement_m:maxDisplacement,bounds_y_up:pack(bounds),loop_seam_max_m:seam,floor_minimum:floorCause,lowest_lid_vertex_y_m:minLid,lowest_vertex_by_bone_y_m:minFloorByBone,held_defeat_difference_m:clip.name==='defeat'?heldDifference:null};union.union(bounds);
}
// Attack beats sampled directly from the clip.
const attack=gltf.animations.find(c=>c.name==='attack');mixer.stopAllAction();const aa=mixer.clipAction(attack).setLoop(T.LoopOnce,1);aa.clampWhenFinished=true;aa.play();
const beats=[];
for(const t of [0,.30,.60,.84,1.05,1.15,1.25,1.35,1.45,1.70,1.90,2]){
 mixer.setTime(t);const s=points();
 beats.push({time_s:t,tile_centres:Object.fromEntries(TILES.map(n=>[n,boxOf(s.groups[n]).getCenter(new T.Vector3()).toArray()])),tile_lowest_y:Object.fromEntries(TILES.map(n=>[n,Math.min(...s.groups[n].map(p=>p.y))])),
  feet_lowest_y:Math.min(...[...s.groups.leg_R,...s.groups.leg_L].map(p=>p.y)),body:wp(B('body')).toArray(),tile_1_bone:wp(B('tile_1')).toArray(),tongue_tip_forward_m:-Math.min(...s.groups.tongue_3.map(p=>p.z))});
}
const at=t=>beats.find(s=>Math.abs(s.time_s-t)<1e-9);
const directContactTile=new T.Vector3(...at(1.25).tile_1_bone);
mixer.stopAllAction();scene.updateMatrixWorld(true);
// Held defeat pose.
const dclip=gltf.animations.find(c=>c.name==='defeat');const da=mixer.clipAction(dclip).setLoop(T.LoopOnce,1);da.clampWhenFinished=true;da.play();mixer.setTime(dclip.duration);
const held=points();
const defeatHeld={tile_centre_drop_m:Object.fromEntries(TILES.map(n=>[n,restTileCentres[n].y-boxOf(held.groups[n]).getCenter(new T.Vector3()).y])),lowest_lid_vertex_y_m:Math.min(...['lid_R','lid_L'].map(n=>Math.min(...held.groups[n].map(p=>p.y)))),
 candle_scale:B('candle').scale.toArray(),body_drop_m:restBonePositions.body.y-wp(B('body')).y,tongue_lowest_y_m:Math.min(...held.groups.tongue_3.map(p=>p.y))};
mixer.stopAllAction();scene.updateMatrixWorld(true);
// Hit: shutters slam (lowest lid vertex) around 0.1 s.
const hclip=gltf.animations.find(c=>c.name==='hit');const ha=mixer.clipAction(hclip).setLoop(T.LoopOnce,1);ha.clampWhenFinished=true;ha.play();mixer.setTime(0.12);
const hs=points();const hitSlam={lowest_lid_vertex_y_m:Math.min(...['lid_R','lid_L'].map(n=>Math.min(...hs.groups[n].map(p=>p.y)))),roof_lift_m:wp(B('roof')).y-restRoofWorldY};
mixer.stopAllAction();scene.updateMatrixWorld(true);
const firstClone=clone(scene),secondClone=clone(scene),frozenSource=bones.map(b=>b.matrix.toArray()),door2=secondClone.getObjectByName('door_R').quaternion.clone();
const adapter=new EnemyAnimation(firstClone,gltf.animations,construction.clips.find(c=>c.name==='attack').contact_fraction);
const frame={id:'wo111-magic-house-inspection',position:{x:0,y:0,z:0},facing:0,phase:'idle',windupProgress:0,hp:100,maxHp:100};
const phases=[];
for(const phase of ['idle','chasing','windup','strike','cooldown']){
 frame.phase=phase;for(let i=0;i<20;i++){frame.windupProgress=Math.min(1,i/15);adapter.update(frame,.05)}
 firstClone.updateMatrixWorld(true);phases.push({phase,visible:firstClone.visible,body:wp(firstClone.getObjectByName('body')).toArray(),tile_1:wp(firstClone.getObjectByName('tile_1')).toArray()});
}
frame.hp=70;frame.phase='idle';adapter.update(frame,.1);firstClone.updateMatrixWorld(true);const hitRoof=wp(firstClone.getObjectByName('roof')).toArray();
for(let i=0;i<20;i++)adapter.update(frame,.05);frame.phase='defeated';let state;const defeatStates=[];
for(let i=0;i<60;i++){state=adapter.update(frame,.05);if([0,35,47,53,59].includes(i))defeatStates.push({time_s:(i+1)*.05,...state})}
scene.updateMatrixWorld(true);secondClone.updateMatrixWorld(true);firstClone.updateMatrixWorld(true);
const cloneIndependent=bones.every((b,i)=>b.matrix.toArray().every((x,j)=>Math.abs(x-frozenSource[i][j])<1e-10))&&secondClone.getObjectByName('door_R').quaternion.toArray().every((x,i)=>Math.abs(x-door2.toArray()[i])<1e-10);
const storedBounds=B('Magic_House_Skin')?.userData.model_space_bounds_y_up;
const rootBoneTracks=gltf.animations.flatMap(c=>c.tracks.filter(t=>t.name.startsWith('root.')).map(t=>({clip:c.name,name:t.name,constant:Array.from(t.values).every((v,i,a)=>Math.abs(v-a[i%t.getValueSize()])<1e-7)})));
const legs=boxOf([...rest.groups.leg_R,...rest.groups.leg_L]);
const wallBand=boxOf(rest.groups.body.filter(p=>p.y>=.55&&p.y<=.75));
const V=a=>new T.Vector3(...a);
const heldRaised=[.60,.84,1.05].every(t=>TILES.every(n=>V(at(t).tile_centres[n]).distanceTo(V(at(.84).tile_centres[n]))<1e-4));
const raisedHigh=TILES.every(n=>at(.84).tile_centres[n][1]>restTileCentres[n].y+.30);
const thrown=TILES.every(n=>at(1.25).tile_lowest_y[n]>=-1e-5&&at(1.25).tile_lowest_y[n]<.03&&at(1.25).tile_centres[n][2]<-1.0);
const returned=TILES.every(n=>V(at(2).tile_centres[n]).distanceTo(restTileCentres[n])<1e-4);
const atWindup=phases.find(p=>p.phase==='windup');
const checks={exported_bounds_cover_all_poses:!!storedBounds&&union.min.toArray().every((v,i)=>v>=storedBounds.min[i])&&union.max.toArray().every((v,i)=>v<=storedBounds.max[i]),
 all_five_clips:gltf.animations.map(c=>c.name).sort().join()===['idle','move','attack','hit','defeat'].sort().join(),all_tracks_resolve_below_scene_root:bindings.every(b=>b.resolves&&!b.targets_scene_root),all_clips_move_actual_vertices:Object.values(animations).every(a=>a.max_temporal_vertex_displacement_m>.001),idle_move_seams:['idle','move'].every(n=>animations[n].loop_seam_max_m<.00001),held_defeat:animations.defeat.held_defeat_difference_m<.00001,
 no_floor_penetration:Object.values(animations).every(a=>a.bounds_y_up.min[1]>=-.00001),attached_joint_pivots:Object.values(attachments).every(d=>d<.00001),at_most_four_influences:maxInfluences<=4,normalized_weights:maxWeightError<.00001,identity_root_no_motion:rootFixed,no_root_bone_motion:rootBoneTracks.every(t=>t.constant),
 boss_height_2_to_3_m:rest.box.max.y>=2&&rest.box.max.y<=3&&Math.abs(rest.box.max.y-construction.height_m)<.001,standing_on_floor:rest.box.min.y>=0&&rest.box.min.y<.01,legs_symmetric_about_root:Math.abs(legs.max.x+legs.min.x)<.01,wall_band_floor_centred:Math.abs(wallBand.max.x+wallBand.min.x)/2<.04&&Math.abs(wallBand.max.z+wallBand.min.z)/2<.04,
 one_1024_embedded_atlas:images.length===1&&images[0].width===1024&&images[0].height===1024,two_draw_primitives:meshes.length===2,actual_adapter_constructed:true,actual_adapter_defeat_vanish:state.visible===false&&state.vanish===1,adapter_root_identity:firstClone.position.length()<1e-8&&firstClone.scale.distanceTo(new T.Vector3(1,1,1))<1e-8,independent_skeleton_clone:cloneIndependent,
 attack_contact_1_25:Math.abs(animations.attack.duration_s*construction.clips.find(c=>c.name==='attack').contact_fraction-1.25)<1e-9,actual_adapter_contact_pose:V(atWindup.tile_1).distanceTo(directContactTile)<1e-5,
 tiles_raised_high_and_held_0_60_to_1_05:heldRaised&&raisedHigh,house_hops_before_contact:at(1.15).feet_lowest_y>.05,house_lands_at_contact:at(1.25).feet_lowest_y<.005,
 tiles_thrown_to_floor_ahead_at_contact:thrown,tiles_back_in_place_by_2_0:returned,
 hit_shutters_slam:hitSlam.lowest_lid_vertex_y_m<1.30,hit_roof_pops:hitSlam.roof_lift_m>.04,
 defeat_tiles_dropped:TILES.every(n=>defeatHeld.tile_centre_drop_m[n]>.15),defeat_lids_closed:defeatHeld.lowest_lid_vertex_y_m<1.30,defeat_candle_ember:defeatHeld.candle_scale.every(s=>s<.35),defeat_slumped:defeatHeld.body_drop_m>.05};
adapter.dispose();
const boundsRecord={method:'All exact exported skin vertices, rest and every clip at 60 Hz; conservative 0.005 m padding per axis.',safe_culling_envelope:{min:union.min.toArray().map(n=>Math.floor((n-.005)*1000)/1000),max:union.max.toArray().map(n=>Math.ceil((n+.005)*1000)/1000)}};
if(process.argv.includes('--write-bounds'))await writeFile(path.join(path.dirname(new URL(import.meta.url).pathname),'bounds.json'),JSON.stringify(boundsRecord,null,2)+'\n');
const record={asset_id:'magic-house',version:'v001',glb_sha256:createHash('sha256').update(bytes).digest('hex'),three_revision:T.REVISION,method:'Exact GLTFLoader; all exported skin vertices at 60 Hz; SkeletonUtils clone; actual src/game/enemy-animation.ts. Rotation/scale-only joints are checked as fixed local pivots; the body, roof, legs, dancing tiles, pupils and butterflies translate by design. No physical-device or universal triangle-collision proof (the Blender attachment audit covers listed part pairs).',
 rest_bounds_y_up:pack(rest.box),all_animation_bounds_y_up:pack(union),dimensions_m:rest.box.getSize(new T.Vector3()).toArray(),height_m:rest.box.max.y,sole_clearance_m:rest.box.min.y,legs_footprint_y_up:pack(legs),wall_band_y_up:pack(wallBand),exported_safe_bounds_y_up:storedBounds,animations,images,root_bone_tracks:rootBoneTracks,tracks:bindings,attachment_pivot_max_drift_m:attachments,max_skin_influences:maxInfluences,max_weight_sum_error:maxWeightError,
 attack_beats:beats,defeat_held:defeatHeld,hit_slam:hitSlam,adapter:{phases,direct_contact_tile_1:directContactTile.toArray(),hit_roof:hitRoof,defeat_states:defeatStates},checks};
await writeFile(path.join(root,'three-inspection.json'),JSON.stringify(record,null,2)+'\n');
const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
console.log(JSON.stringify({failures,rest:record.rest_bounds_y_up,animated:record.all_animation_bounds_y_up,floor:Object.fromEntries(Object.entries(animations).map(([k,a])=>[k,[+a.bounds_y_up.min[1].toFixed(4),a.floor_minimum.bone,+a.floor_minimum.time_s.toFixed(3)]])),lidLow,defeatHeld,hitSlam,
 contact:{feet:at(1.25).feet_lowest_y,tiles:at(1.25).tile_lowest_y,centres:at(1.25).tile_centres,tongue_forward:at(1.25).tongue_tip_forward_m},hop:at(1.15).feet_lowest_y,wallBand:pack(wallBand),maxInfluences,attachments:Object.fromEntries(Object.entries(attachments).filter(([,d])=>d>1e-6))}));process.exitCode=failures.length?1:0;
