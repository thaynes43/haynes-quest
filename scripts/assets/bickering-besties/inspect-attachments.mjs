/** WO051 actual exported joints and sole vertices, all clips and exact contact. */
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import sharp from 'sharp';
globalThis.self=globalThis;
globalThis.createImageBitmap=async blob=>{const {data,info}=await sharp(Buffer.from(await blob.arrayBuffer())).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data,width:info.width,height:info.height,close(){}}};
const root=path.resolve(process.argv[2]||'docs/assets/media');
let failed=false;
for(const name of ['bestie-pink','bestie-black']){
 const folder=path.join(root,name,'v001'),bytes=await readFile(path.join(folder,name+'.glb'));
 const construction=JSON.parse(await readFile(path.join(folder,'construction.json')));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const scene=gltf.scene,mixer=new THREE.AnimationMixer(scene),meshes=[],bones={};
 scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);if(o.isBone)bones[o.name]=o});scene.updateMatrixWorld(true);
 const inverse=Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,b.matrixWorld.clone().invert()]));
 const cv=p=>new THREE.Vector3(p[0],p[2],-p[1]);
 const transformed=(bone,p)=>cv(p).applyMatrix4(inverse[bone]).applyMatrix4(bones[bone].matrixWorld);
 const soles=[];let maxWeightError=0,unweighted=0;
 for(const mesh of meshes){
  const idx=mesh.geometry.attributes.skinIndex,w=mesh.geometry.attributes.skinWeight;
  for(let i=0;i<w.count;i++){
   const total=[0,1,2,3].reduce((sum,c)=>sum+w.getComponent(i,c),0);maxWeightError=Math.max(maxWeightError,Math.abs(1-total));if(total<=0)unweighted++;
   for(let c=0;c<4;c++)if(w.getComponent(i,c)>.999){const bone=mesh.skeleton.bones[idx.getComponent(i,c)].name;if(bone.startsWith('foot_'))soles.push({mesh,index:i,bone})}
  }
 }
 const records={};let maxSeam=0,minimumSole=Infinity,maximumSole=0;const highFive={};
 for(const clip of gltf.animations){
  mixer.stopAllAction();const action=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  const times=[...Array.from({length:61},(_,i)=>clip.duration*i/60),...(clip.name==='attack'||clip.name==='high-five'?[1]:[])];const samples=[];
  for(const time of [...new Set(times)].sort((a,b)=>a-b)){
   mixer.setTime(time);scene.updateMatrixWorld(true);meshes.forEach(m=>m.skeleton.update());
   const floors={};for(const {mesh,index,bone} of soles){const y=mesh.getVertexPosition(index,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).y;floors[bone]=Math.min(floors[bone]??Infinity,y)}
   let seam=0;const joints={};
   for(const [child,rest] of Object.entries(construction.rig_anatomy_rest_blender))if(rest.parent&&child!=='hips'){
    const distance=transformed(child,rest.head).distanceTo(transformed(rest.parent,rest.head));joints[child]=distance;seam=Math.max(seam,distance);
   }
   maxSeam=Math.max(maxSeam,seam);minimumSole=Math.min(minimumSole,...Object.values(floors));maximumSole=Math.max(maximumSole,...Object.values(floors));
   samples.push({time_s:time,sole_y_m:floors,maximum_joint_seam_m:seam});
   if(clip.name==='high-five'&&Math.abs(time-1)<1e-6){
    const hand=name==='bestie-pink'?'hand_R':'hand_L';highFive.hand=hand;highFive.time_s=1;highFive.wrist_y_up=transformed(hand,construction.rig_anatomy_rest_blender[hand].head).toArray();highFive.tip_y_up=transformed(hand,construction.rig_anatomy_rest_blender[hand].tail).toArray();
   }
  }
  records[clip.name]={samples,maximum_joint_seam_m:Math.max(...samples.map(s=>s.maximum_joint_seam_m)),minimum_sole_y_m:Math.min(...samples.flatMap(s=>Object.values(s.sole_y_m)))};
 }
 const checks={single_connected_root:!bones.root.parent?.isBone&&Object.values(bones).every(b=>b===bones.root||b.parent?.isBone),all_vertices_weighted:unweighted===0,normalized_weights:maxWeightError<.00001,both_feet_have_rigid_skin:new Set(soles.map(s=>s.bone)).size===2,all_anatomical_joints_remain_attached:maxSeam<.00002,soles_never_below_floor:minimumSole>=-.0002,
  standing_clips_keep_both_soles_planted:['idle','attack','hit','cheer','high-five','dizzy'].every(c=>records[c].samples.every(s=>Object.values(s.sole_y_m).every(y=>Math.abs(y)<.0003))),
  move_always_has_stance_foot:records.move.samples.every(s=>Object.values(s.sole_y_m).some(y=>Math.abs(y)<.0003)),defeat_ends_with_both_feet_on_floor:Object.values(records.defeat.samples.at(-1).sole_y_m).every(y=>Math.abs(y)<.0003)};
 const report={asset_id:name,glb_sha256:createHash('sha256').update(bytes).digest('hex'),three_revision:THREE.REVISION,method:'Actual GLTFLoader/AnimationMixer bones and fully skinned shoe vertices; 61 samples per clip plus exact 1.0 second contact. Every non-body root joint compares its rest attachment point transformed by both adjacent bones.',max_joint_seam_m:maxSeam,min_sole_y_m:minimumSole,max_sole_y_m:maximumSole,weight_sum_max_error:maxWeightError,unweighted_vertices:unweighted,high_five:highFive,animations:records,checks,limitations:'Checks anatomical centre attachment and sole surfaces. Artistic self-occlusion and cloth compression are also judged in the reimported views/reel; no physical Safari or frame-time claim.'};
 await writeFile(path.join(folder,'attachment-foot-inspection.json'),JSON.stringify(report,null,2)+'\n');
 const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);failed||=failures.length>0;console.log(JSON.stringify({name,failures,maxSeam,minimumSole,maximumSole,maxWeightError,highFive}));
}
process.exitCode=failed?1:0;
