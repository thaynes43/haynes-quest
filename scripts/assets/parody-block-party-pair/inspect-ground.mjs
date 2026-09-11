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

const name=process.argv[4]||'peel-patrol';
const bytes=await readFile(path.join(media,name,'v001',name+'.glb'));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const scene=gltf.scene,mixer=new THREE.AnimationMixer(scene);const meshes=[];scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o)});
const results={};
for(const clip of gltf.animations){
 mixer.stopAllAction();const action=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
 let low={y:Infinity};
 for(let f=0;f<=80;f++){
  mixer.setTime(clip.duration*f/80);scene.updateMatrixWorld(true);
  for(const m of meshes){m.skeleton.update();
   for(let i=0;i<m.geometry.attributes.position.count;i++){
    const pos=m.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(m.matrixWorld);
    if(pos.y<low.y){const bones=[];for(let k=0;k<4;k++){const w=m.geometry.attributes.skinWeight.getComponent(i,k);if(w>.0001)bones.push([m.skeleton.bones[m.geometry.attributes.skinIndex.getComponent(i,k)].name,w]);}low={y:pos.y,position:pos.toArray(),time:clip.duration*f/80,bones};}
   }
  }
 }
 results[clip.name]=low;
}
console.log(JSON.stringify(results,null,2));
