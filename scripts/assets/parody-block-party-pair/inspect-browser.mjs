/** WO-028 isolated real Chromium/WebGL intake; no shared browser or live scene.
 * node browser-intake.mjs <repo> <dependency-node-modules>
 */
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const repo=path.resolve(process.argv[2]||'.');
const modules=path.resolve(process.argv[3]||path.join(repo,'node_modules'));
const threeRoot=path.join(modules,'three');
const {chromium}=await import(pathToFileURL(path.join(modules,'playwright/index.mjs')).href);
const names=process.argv.slice(4);if(!names.length)names.push('peel-patrol','drama-dragon');
const html=`<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><style>html,body{margin:0;width:100%;height:100%;background:#ded2bc}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/three/build/three.module.js"}}</script></head><body><script type="module">
import * as THREE from '/three/build/three.module.js';
import {GLTFLoader} from '/three/examples/jsm/loaders/GLTFLoader.js';
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(700,700);renderer.setPixelRatio(1);renderer.setClearColor(0xded2bc);renderer.outputColorSpace=THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const world=new THREE.Scene();world.add(new THREE.HemisphereLight(0xfff0d7,0x706c5e,2.2));
const key=new THREE.DirectionalLight(0xffe1b0,3.0);key.position.set(-3,5,-4);world.add(key);
const fill=new THREE.DirectionalLight(0xc3d8ff,1.2);fill.position.set(3,2,2);world.add(fill);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshStandardMaterial({color:0xcac1ad,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.004;world.add(floor);
const camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,50);
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
let current,mixer;
window.loadAsset=async(name,height)=>{
 if(current){mixer.stopAllAction();mixer.uncacheRoot(current);world.remove(current);const textures=new Set(),skeletons=new Set();current.traverse(o=>{if(o.isSkinnedMesh)skeletons.add(o.skeleton);if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){if(m.map)textures.add(m.map);m.dispose();}}});for(const t of textures)t.dispose();for(const skeleton of skeletons)skeleton.dispose();}
 const bytes=await (await fetch('/assets/'+name+'.glb')).arrayBuffer();
 const gltf=await new GLTFLoader().parseAsync(bytes,'');current=gltf.scene;world.add(current);mixer=new THREE.AnimationMixer(current);
 const bounds=new THREE.Box3().setFromObject(current,true),size=bounds.getSize(new THREE.Vector3());
 const half=Math.max(height*1.3,size.x*1.45,size.z*1.45)/2;camera.left=-half;camera.right=half;camera.top=half;camera.bottom=-half;
 camera.position.set(name==='drama-dragon'?5.2:2.0,name==='drama-dragon'?2.7:height*.95,name==='drama-dragon'?-4.1:-4.5);camera.lookAt(0,height*.50,name==='drama-dragon'?.25:0);camera.updateProjectionMatrix();
 const meshes=[];current.traverse(o=>{if(o.isMesh)meshes.push(o)});
 const images=new Set(meshes.flatMap(o=>(Array.isArray(o.material)?o.material:[o.material]).map(m=>m.map?.image).filter(Boolean)));
 renderer.render(world,camera);
 const gl=renderer.getContext();const info={asset_id:name,glb_sha256:await digest(bytes),gltf_clips:gltf.animations.map(c=>c.name),skinned_primitives:meshes.filter(m=>m.isSkinnedMesh).length,embedded_images:[...images].map(i=>({width:i.width,height:i.height})),render:{calls_including_one_ground:renderer.info.render.calls,triangles_including_one_ground:renderer.info.render.triangles,textures:renderer.info.memory.textures},gl_error:gl.getError(),webgl_version:gl.getParameter(gl.VERSION),three_revision:THREE.REVISION,clips:{}};
 for(const clip of gltf.animations){
  mixer.stopAllAction();const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  const hashes=[];
  for(const fraction of [0,.24,.50,.80]){mixer.setTime(clip.duration*fraction);current.updateMatrixWorld(true);renderer.render(world,camera);hashes.push(await digest(new TextEncoder().encode(renderer.domElement.toDataURL('image/png'))));}
  info.clips[clip.name]={duration_s:clip.duration,raster_sha256:hashes,distinct_rasters:new Set(hashes).size,gl_error:gl.getError()};
 }
 window.showClip=(name,fraction)=>{mixer.stopAllAction();const clip=gltf.animations.find(c=>c.name===name);const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();mixer.setTime(clip.duration*fraction);current.updateMatrixWorld(true);renderer.render(world,camera);};
 mixer.stopAllAction();renderer.render(world,camera);return info;
};
window.ready=true;
</script></body></html>`;
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');let file;
  if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
  if(url.pathname.startsWith('/three/')){file=path.resolve(threeRoot,url.pathname.slice(7));if(!file.startsWith(threeRoot+path.sep))throw Error('Invalid vendor path');res.setHeader('Content-Type','text/javascript');}
  else{const name=url.pathname.match(/^\/assets\/([a-z-]+)\.glb$/)?.[1];if(!names.includes(name)){res.writeHead(404);res.end();return;}file=path.join(repo,'docs/assets/media',name,'v001',name+'.glb');res.setHeader('Content-Type','model/gltf-binary');}
  res.end(await readFile(file));
 }catch(error){res.writeHead(500);res.end(String(error));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:700,height:700}});const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));page.on('request',r=>requests.push(r.url()));
 await page.goto(origin,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.ready,{timeout:30000});
 for(const name of names){
  const folder=path.join(repo,'docs/assets/media',name,'v001');const construction=JSON.parse(await readFile(path.join(folder,'construction.json')));
  const report=await page.evaluate(async({name,height})=>window.loadAsset(name,height),{name,height:construction.spec.height});
  const bytes=await readFile(path.join(folder,name+'.glb'));const expected=createHash('sha256').update(bytes).digest('hex');
  report.browser=browser.version();report.renderer='Chromium headless with ANGLE SwiftShader (software WebGL)';report.errors=[...errors];report.requests=[...requests];
  report.checks={exact_glb_hash:report.glb_sha256===expected,expected_skinned_draw_primitives:report.skinned_primitives===construction.material_count,one_embedded_1024_image:report.embedded_images.length===1&&report.embedded_images[0].width===1024&&report.embedded_images[0].height===1024,expected_color_draws:report.render.calls_including_one_ground===construction.material_count+1,expected_triangle_count:report.render.triangles_including_one_ground===construction.triangles+2,five_expected_clips:Object.keys(report.clips).sort().join()===['idle','move','attack','hit','defeat'].sort().join(),every_clip_changes_actual_raster:Object.values(report.clips).every(c=>c.distinct_rasters>1),webgl_error_free:report.gl_error===0&&Object.values(report.clips).every(c=>c.gl_error===0),browser_error_free:errors.length===0,no_external_requests:requests.every(u=>u.startsWith(origin+'/')||u.startsWith('blob:'+origin+'/')||u.startsWith('data:'))};
  report.limitations='Isolated exact-GLB software WebGL intake; not integrated gameplay, physical Safari, GPU performance or owner approval.';
  await page.screenshot({path:path.join(folder,'browser-beauty.png')});
  await page.evaluate(fraction=>window.showClip('attack',fraction),.72);await page.screenshot({path:path.join(folder,'browser-attack.png')});
  await writeFile(path.join(folder,'browser-inspection.json'),JSON.stringify(report,null,2)+'\n');
  const failures=Object.entries(report.checks).filter(([,v])=>!v).map(([k])=>k);console.log(JSON.stringify({name,browser:report.browser,failures,draws:report.render,clips:Object.fromEntries(Object.entries(report.clips).map(([n,c])=>[n,{duration:c.duration_s,distinct_rasters:c.distinct_rasters}]))}));
  if(failures.length)process.exitCode=1;
 }
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
