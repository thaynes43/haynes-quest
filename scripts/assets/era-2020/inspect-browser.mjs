/** Exact candidate WebGL intake with measured Three renderer statistics.
 * node inspect-browser.mjs <repo-root> <installed-node-modules>
 * Uses local Chromium/SwiftShader; it is not physical-device performance evidence.
 */
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const repo=path.resolve(process.argv[2]||'.');
const modules=path.resolve(process.argv[3]||'node_modules');
const {chromium}=await import(pathToFileURL(path.join(modules,'playwright/index.mjs')).href);
const html=`<!doctype html><html><head><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/three/build/three.module.js"}}</script></head><body style="margin:0"><canvas></canvas><script type="module">
import * as THREE from 'three';import {GLTFLoader} from '/three/examples/jsm/loaders/GLTFLoader.js';
const canvas=document.querySelector('canvas');const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.setSize(600,700);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
window.intake=async(name,height,scale)=>{const gltf=await new GLTFLoader().loadAsync('/media/'+name+'/v001/'+name+'.glb');const scene=new THREE.Scene();scene.background=new THREE.Color(0xe8dfcd);scene.add(gltf.scene);scene.add(new THREE.HemisphereLight(0xffefd9,0x5c6876,2.0));const key=new THREE.DirectionalLight(0xffe5bc,3.0);key.position.set(-3,5,-5);scene.add(key);const fill=new THREE.DirectionalLight(0xbcdcff,1.0);fill.position.set(3,2,-1);scene.add(fill);const camera=new THREE.OrthographicCamera(-scale*600/700/2,scale*600/700/2,scale/2,-scale/2,.01,40);camera.position.set(2.8,2.4,-5);camera.lookAt(0,height*.5,0);const mixer=new THREE.AnimationMixer(gltf.scene);const meshes=[];gltf.scene.traverse(o=>{if(o.isMesh)meshes.push(o)});renderer.info.reset();renderer.render(scene,camera);const rest={calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries};const clips=[];for(const clip of gltf.animations){mixer.stopAllAction();const a=mixer.clipAction(clip);a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;a.play();mixer.setTime(clip.duration*.6);renderer.info.reset();renderer.render(scene,camera);clips.push({name:clip.name,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});}mixer.stopAllAction();renderer.render(scene,camera);const gl=renderer.getContext();const debug=gl.getExtension('WEBGL_debug_renderer_info');window.disposeIntake=()=>{mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);scene.remove(gltf.scene);const skeletons=new Set();gltf.scene.traverse(o=>{if(o.isSkinnedMesh)skeletons.add(o.skeleton)});for(const skeleton of skeletons)skeleton.dispose();gltf.scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}}});};return {three_revision:THREE.REVISION,mesh_primitives:meshes.length,rest,clips,webgl_error:gl.getError(),gpu:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'not exposed'};};window.ready=true;
</script></body></html>`;
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/'){res.setHeader('content-type','text/html');res.end(html);return;}
  let base,relative;
  if(url.pathname.startsWith('/three/')){base=path.join(modules,'three');relative=url.pathname.slice(7);}
  else if(url.pathname.startsWith('/media/')){base=path.join(repo,'docs/assets/media');relative=url.pathname.slice(7);}
  else{res.writeHead(404);res.end();return;}
  const target=path.resolve(base,relative);if(!target.startsWith(path.resolve(base)+path.sep)){res.writeHead(403);res.end();return;}
  res.setHeader('content-type',target.endsWith('.js')?'text/javascript':target.endsWith('.glb')?'model/gltf-binary':'application/octet-stream');res.end(await readFile(target));
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage({viewport:{width:600,height:700}});const errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:'+port)&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))external.push(r.url());});
 await page.goto('http://127.0.0.1:'+port);await page.waitForFunction(()=>window.ready);
 for(const [name,height,scale] of [['blockling',.85,1.12],['signal-moth',.90,1.68],['buffer-baron',1.85,2.5]]){
  const folder=path.join(repo,'docs/assets/media',name,'v001');const bytes=await readFile(path.join(folder,name+'.glb'));
  const record=await page.evaluate(([n,h,s])=>window.intake(n,h,s),[name,height,scale]);
  await page.screenshot({path:path.join(folder,'browser-beauty.png')});
  record.asset_id=name;record.glb_sha256=createHash('sha256').update(bytes).digest('hex');record.browser=browser.version();record.page_errors=errors.slice();record.external_requests=external.slice();
  record.checks={six_color_pass_draw_calls:record.rest.calls===6,matching_clip_draw_counts:record.clips.every(c=>c.calls===6&&c.triangles===record.rest.triangles),no_webgl_error:record.webgl_error===0,no_page_errors:errors.length===0,no_external_requests:external.length===0};
  record.limitations='Chromium software WebGL rasterization and counts only; no physical Safari, gameplay admission, load/performance target or owner approval claim.';
  await writeFile(path.join(folder,'browser-inspection.json'),JSON.stringify(record,null,2)+'\n');
  const failures=Object.entries(record.checks).filter(([,v])=>!v).map(([k])=>k);console.log(JSON.stringify({name,rest:record.rest,failures}));if(failures.length)throw Error(name+': '+failures.join(','));
  await page.evaluate(()=>window.disposeIntake());
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
