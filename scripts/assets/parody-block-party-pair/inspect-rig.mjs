/** Actual GLTFLoader + AnimationMixer geometry sampling. CPU, not device FPS. */
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const media=path.resolve(process.argv[2]||'docs/assets/media');
const three=path.resolve(process.argv[3]||'node_modules/three');
const THREE=await import(pathToFileURL(path.join(three,'build/three.module.js')).href);
const {GLTFLoader}=await import(pathToFileURL(path.join(three,'examples/jsm/loaders/GLTFLoader.js')).href);
const {clone}=await import(pathToFileURL(path.join(three,'examples/jsm/utils/SkeletonUtils.js')).href);
// Node supplies object URLs/fetch. Decode embedded image pixels with the app's
// pinned Sharp runtime; this is a CPU ImageBitmap shim, not WebGL raster proof.
const sharpPath=path.resolve(process.env.QUEST_SHARP_ROOT||path.join(three,'..','sharp'));
const sharpPackage=JSON.parse(await readFile(path.join(sharpPath,'package.json')));
const {default:sharp}=await import(pathToFileURL(path.join(sharpPath,sharpPackage.module||sharpPackage.main)).href);
globalThis.self=globalThis;
const decodedImages=[];
globalThis.createImageBitmap=async(blob)=>{
 const bytes=Buffer.from(await blob.arrayBuffer());
 const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 decodedImages.push({encoded_bytes:bytes.length,width:info.width,height:info.height,decoded_bytes:data.length});
 return {width:info.width,height:info.height,data,close(){}};
};

const names=process.argv.slice(4);if(!names.length)names.push('peel-patrol','drama-dragon');
let failed=false;
for(const name of names){
 const folder=path.join(media,name,'v001'),bytes=await readFile(path.join(folder,name+'.glb'));
 const construction=JSON.parse(await readFile(path.join(folder,'construction.json')));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const scene=gltf.scene,mixer=new THREE.AnimationMixer(scene);scene.updateMatrixWorld(true);
 const meshes=[],bones={};scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);if(o.isBone)bones[o.name]=o;});
 const inverseRest=Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,b.matrixWorld.clone().invert()]));
 const footVertices=[];
 for(const mesh of meshes){
  const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
  for(let i=0;i<indices.count;i++)for(let j=0;j<4;j++)if(weights.getComponent(i,j)>.999){const n=mesh.skeleton.bones[indices.getComponent(i,j)].name;if(n.startsWith('foot_'))footVertices.push({mesh,index:i,bone:n});}
 }
 const convert=p=>new THREE.Vector3(p[0],p[2],-p[1]);
 const transformed=(bone,p)=>convert(p).applyMatrix4(inverseRest[bone]).applyMatrix4(bones[bone].matrixWorld);
 const records={};let maxSeam=0,minFoot=Infinity;const contact={};
 for(const clip of gltf.animations){
  mixer.stopAllAction();const action=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  const samples=[];const times=[...Array.from({length:41},(_,i)=>clip.duration*i/40),...(clip.name==='attack'?[construction.spec.attack_contact_s]:[])];
  for(const t of [...new Set(times)].sort((a,b)=>a-b)){
   mixer.setTime(t);scene.updateMatrixWorld(true);for(const m of meshes)m.skeleton.update();
   const mins={};for(const {mesh,index,bone} of footVertices){const y=mesh.getVertexPosition(index,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).y;mins[bone]=Math.min(mins[bone]??Infinity,y);minFoot=Math.min(minFoot,y);}
   let seam=0;for(const entry of Object.values(construction.rig_limb_contract)){
    const [a,b,c]=entry.rest_points,[upper,lower,foot]=entry.joints;
    seam=Math.max(seam,transformed(upper,b).distanceTo(transformed(lower,b)),transformed(lower,c).distanceTo(transformed(foot,c)));
   }
   maxSeam=Math.max(maxSeam,seam);samples.push({time_s:t,foot_min_y:mins,joint_seam_m:seam});
   if(clip.name==='attack'&&Math.abs(t-construction.spec.attack_contact_s)<1e-6)Object.assign(contact,{time_s:t,foot_min_y:mins,grounded_feet:Object.values(mins).filter(y=>Math.abs(y)<.002).length});
  }
  records[clip.name]={samples,minimum_foot_y:Math.min(...samples.flatMap(s=>Object.values(s.foot_min_y))),max_joint_seam_m:Math.max(...samples.map(s=>s.joint_seam_m))};
 }
 const expected=name==='peel-patrol'?2:4;
 const checks={all_expected_feet_weighted:new Set(footVertices.map(v=>v.bone)).size===expected,
  every_articulated_joint_stays_connected:maxSeam<.0002,boots_do_not_penetrate_floor:minFoot>=-.002,
  attack_has_grounded_contact:contact.grounded_feet>=(name==='drama-dragon'?4:1),
  idle_feet_stay_grounded:records.idle.samples.every(s=>Object.values(s.foot_min_y).every(y=>Math.abs(y)<.002)),
  move_retains_stance_support:records.move.samples.every(s=>Object.values(s.foot_min_y).some(y=>Math.abs(y)<.003))};
 const report={asset_id:name,glb_sha256:createHash('sha256').update(bytes).digest('hex'),method:'Actual Three skin vertices grouped by exported foot joints; transformed anatomical seam points across all clips and exact contact time.',three_revision:THREE.REVISION,
  feet:expected,max_joint_seam_m:maxSeam,minimum_foot_y_m:minFoot,attack_contact:contact,animations:records,checks};
 await writeFile(path.join(folder,'rig-ground-inspection.json'),JSON.stringify(report,null,2)+'\n');
 const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);failed||=failures.length>0;console.log(JSON.stringify({name,failures,maxSeam,minFoot,contact}));
}
process.exitCode=failed?1:0;
