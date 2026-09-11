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
const specs={'peel-patrol':[1.15,0,null],'drama-dragon':[1.8,0,2.6]};
let failed=false;
for(const name of names){
 decodedImages.length=0;
 const folder=path.join(media,name,'v001'),bytes=await readFile(path.join(folder,name+'.glb'));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const scene=gltf.scene;scene.updateMatrixWorld(true);const skinned=[];scene.traverse(o=>{if(o.isSkinnedMesh)skinned.push(o);});
 // getVertexPosition performs skinning; sample corresponding actual vertices,
 // not a clip's presence or only its bounding box.
 const geometry=()=>{scene.updateMatrixWorld(true);return skinned.flatMap(m=>{m.skeleton.update();const p=[];for(let i=0;i<m.geometry.attributes.position.count;i+=23)p.push(m.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(m.matrixWorld));return p;});};
 const pack=b=>({min:b.min.toArray(),max:b.max.toArray()});
 const box=()=>new THREE.Box3().setFromObject(scene,true);
 const rest=box(),restVertices=geometry();const rootBone=scene.getObjectByName('root');
 const mixer=new THREE.AnimationMixer(scene),animations={};let rootFixed=true;
 for(const clip of gltf.animations){
  mixer.stopAllAction();const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  const union=new THREE.Box3();let displacement=0;let first,last;
  for(let i=0;i<=48;i++){
   mixer.setTime(clip.duration*i/48);const v=geometry();union.union(box());
   displacement=Math.max(displacement,...v.map((p,k)=>p.distanceTo(restVertices[k])));
   if(i===0)first=v;if(i===48)last=v;
   rootFixed&&=rootBone.position.length()<.00001;
  }
  const seam=Math.max(...first.map((p,i)=>p.distanceTo(last[i])));
  animations[clip.name]={duration_s:clip.duration,samples:49,sampled_vertices:restVertices.length,max_vertex_displacement_m:displacement,bounds:pack(union),loop_seam_max_m:seam};
 }
 mixer.stopAllAction();scene.updateMatrixWorld(true);const before=box();scene.position.set(2,0,-3);scene.updateMatrixWorld(true);const after=box();
 const error=after.min.clone().sub(before.min).sub(new THREE.Vector3(2,0,-3)).length()+after.max.clone().sub(before.max).sub(new THREE.Vector3(2,0,-3)).length();
 const [h,f,w]=specs[name];const checks={embedded_pigment_decoded:decodedImages.length>0&&decodedImages.every(i=>i.width===1024&&i.height===1024&&i.decoded_bytes===4194304),six_or_fewer_draw_primitives:skinned.length<=6,skinned_geometry_loaded:skinned.length>0,
  correct_max_height:Math.abs(rest.max.y-h)<.0001,correct_rest_clearance:Math.abs(rest.min.y-f)<.0001,correct_wingspan:w===null||Math.abs(rest.max.x-rest.min.x-w)<.0001,
  exact_clip_set:Object.keys(animations).sort().join()===['idle','move','attack','hit','defeat'].sort().join(),
  all_clips_move_actual_vertices:Object.values(animations).every(a=>a.max_vertex_displacement_m>.0005),
  idle_move_loop_seams:animations.idle.loop_seam_max_m<.0003&&animations.move.loop_seam_max_m<.0003,
  root_bone_fixed:rootFixed,external_scene_translation_correct:error<.0001,
  bounded_floor_penetration:Object.values(animations).every(a=>a.bounds.min[1]>=-.004),
  finite_geometry:[...rest.min.toArray(),...rest.max.toArray(),...Object.values(animations).flatMap(a=>[a.max_vertex_displacement_m,...a.bounds.min,...a.bounds.max])].every(Number.isFinite)};
 // Match runtime's SkeletonUtils clone and descendant-track binding contract.
 scene.position.set(0,0,0);scene.updateMatrixWorld(true);
 const firstClone=clone(scene),secondClone=clone(scene);
 const sceneBones=[];scene.traverse(o=>{if(o.isBone)sceneBones.push(o)});
 const cloneBones=[];firstClone.traverse(o=>{if(o.isBone)cloneBones.push(o)});
 const bindings=[];
 for(const clip of gltf.animations)for(const track of clip.tracks){
  const binding=new THREE.PropertyBinding(firstClone,track.name);binding.bind();
  const probe=new Float64Array(track.getValueSize()).fill(NaN);binding.getValue(probe,0);
  bindings.push({clip:clip.name,track:track.name,node:binding.node?.name,resolves:probe.some(Number.isFinite),targets_attachment_root:binding.node===firstClone});
 }
 const cloneMixer=new THREE.AnimationMixer(firstClone);
 const frozenSource=sceneBones.map(b=>b.matrix.toArray());
 const secondHead=secondClone.getObjectByName('head').quaternion.clone();
 const attack=gltf.animations.find(c=>c.name==='attack');
 const action=cloneMixer.clipAction(attack).setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();cloneMixer.setTime(attack.duration*.72);
 firstClone.updateMatrixWorld(true);secondClone.updateMatrixWorld(true);scene.updateMatrixWorld(true);
 checks.independent_skeleton_clone=cloneBones.every((b,i)=>b!==sceneBones[i])&&sceneBones.every((b,i)=>b.matrix.toArray().every((v,k)=>Math.abs(v-frozenSource[i][k])<1e-10))&&secondClone.getObjectByName('head').quaternion.angleTo(secondHead)<1e-10;
 checks.all_tracks_bind_below_attachment_root=bindings.every(b=>b.resolves&&!b.targets_attachment_root);
 checks.unit_attachment_root_scale=firstClone.scale.toArray().every(v=>Math.abs(v-1)<1e-7);
 const rootBefore=firstClone.position.clone();cloneMixer.setTime(attack.duration+1);firstClone.updateMatrixWorld(true);
 checks.attack_clamps_after_end=action.paused&&Math.abs(action.time-attack.duration)<1e-7;
 checks.clone_animation_does_not_translate_attachment_root=firstClone.position.distanceTo(rootBefore)<1e-7;
 const contact=name==='peel-patrol'?1.0:1.25;
 checks.exact_contact_timing=Math.abs(attack.duration*.625-contact)<1e-6;
 checks.correct_rest_length=name!=='drama-dragon'||Math.abs(rest.max.z-rest.min.z-3.0)<.0001;
 cloneMixer.stopAllAction();cloneMixer.uncacheRoot(firstClone);
 const record={asset_id:name,tool:'Three GLTFLoader + AnimationMixer + actual sampled skinned vertices + precise bounds',three_revision:THREE.REVISION,
  glb_sha256:createHash('sha256').update(bytes).digest('hex'),rest_bounds_y_up:pack(rest),mesh_primitives:skinned.length,
  draw_call_expectation:{opaque_color_pass:skinned.length,shadow_pass_if_enabled:skinned.length,note:'Per-pass primitive count; actual renderer statistics depend on lights, shadows, instancing and passes.'},
  embedded_image_decode:decodedImages,bones:skinned[0].skeleton.bones.map(b=>b.name),animations,
  clone_track_binding:{method:'SkeletonUtils clone of the complete GLTF scene; every track resolves below caller-controlled attachment root.',tracks:bindings},
  attack_contact:{duration_s:attack.duration,time_s:contact,fraction:.625},checks,limitations:'CPU loader, fully decoded embedded pigment and geometry evidence; no WebGL raster, physical Safari or frame-time claim.'};
 await writeFile(path.join(folder,'three-inspection.json'),JSON.stringify(record,null,2)+'\n');
 const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);failed||=failures.length>0;
 console.log(JSON.stringify({name,failures,primitives:skinned.length,rootFixed,displacements:Object.fromEntries(Object.entries(animations).map(([k,v])=>[k,v.max_vertex_displacement_m]))}));
}
process.exitCode=failed?1:0;
