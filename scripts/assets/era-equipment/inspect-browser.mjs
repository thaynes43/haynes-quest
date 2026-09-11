/** Actual Three.js/WebGL intake of the delivered equipment, with local resources.
 * node inspect-browser.mjs <media-root> <dependency-root>
 * Writes only owned era-equipment/v001 model folders. Chromium/SwiftShader is
 * functional browser proof; it does not establish physical Safari performance.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const media = path.resolve(process.argv[2] || 'docs/assets/media/era-equipment/v001');
const dependencies = path.resolve(process.argv[3] || 'node_modules');
const { chromium } = await import(pathToFileURL(path.join(dependencies, 'playwright', 'index.mjs')));
const threeVersion = JSON.parse(await readFile(path.join(dependencies, 'three', 'package.json'))).version;
const names = ['spark-mallet', 'acorn-shield', 'prism-wand', 'ribbon-shield'];
const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#dfccb0}canvas{display:block;width:100%;height:100%}</style>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script></head><body>
<script type="module">
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.2;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#dfccb0');
scene.add(new THREE.HemisphereLight('#d8e6ff','#795535',2.25));
for(const [color,power,position] of [['#ffe0ad',3.0,[-2,3,-3]],['#c6deff',1.0,[3,2,-1]],['#ffe8be',1.5,[1,3,3]]]){const light=new THREE.DirectionalLight(color,power);light.position.set(...position);if(power===3){light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-1;light.shadow.camera.right=1;light.shadow.camera.top=1;light.shadow.camera.bottom=-1;light.shadow.bias=-.0001;}scene.add(light);}
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#bca580',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.001;floor.receiveShadow=true;scene.add(floor);
const camera=new THREE.OrthographicCamera(-.5,.5,.5,-.5,.001,20);let current=null;let currentInfo=null;const loader=new GLTFLoader();
function render(){renderer.info.reset();renderer.render(scene,camera);return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries};}
window.loadAsset=async(name)=>{if(current){scene.remove(current);current.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of [].concat(o.material)){m.map?.dispose();m.dispose();}}});}const gltf=await loader.loadAsync('/assets/'+name+'/'+name+'.glb');current=gltf.scene;current.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(current,true);const materials=new Set(),images=[],meshes=[];let triangles=0;current.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;meshes.push(o.name);for(const m of [].concat(o.material)){materials.add(m);if(m.map)images.push({material:m.name,width:m.map.image.width,height:m.map.image.height,colorSpace:m.map.colorSpace});}});const dimensions=b.getSize(new THREE.Vector3()).toArray();currentInfo={asset_id:name,bounds_gltf:{min:b.min.toArray(),max:b.max.toArray(),dimensions},triangles,draw_primitives:meshes.length,material_count:materials.size,images,clips:gltf.animations.map(a=>a.name)};current.position.y=-b.min.y;scene.add(current);current.updateMatrixWorld(true);await renderer.compileAsync(scene,camera);window.setView('beauty');return currentInfo;};
window.setView=(view)=>{const b=new THREE.Box3().setFromObject(current,true);const c=b.getCenter(new THREE.Vector3());const span=Math.max(...b.getSize(new THREE.Vector3()).toArray())*1.3;const aspect=innerWidth/innerHeight;camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;const offset={front:[0,0,-2],side:[2,0,0],back:[0,0,2],beauty:[.85,.63,-1.4],'rear-grip':[.75,.32,1.3]}[view];camera.position.copy(c).add(new THREE.Vector3(...offset));camera.lookAt(c);camera.updateProjectionMatrix();return render();};
window.proof=()=>({renderer:renderer.getContext().getParameter(renderer.getContext().VERSION),...currentInfo,render:render()});window.ready=true;
</script></body></html>`;
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/') { response.setHeader('content-type', 'text/html'); response.end(html); return; }
    if (url.pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
    const prefix = url.pathname.startsWith('/assets/') ? '/assets/' : '/three/';
    const root = prefix === '/assets/' ? media : path.join(dependencies, 'three');
    const file = path.resolve(root, decodeURIComponent(url.pathname.slice(prefix.length)));
    if (!file.startsWith(root + path.sep)) throw new Error('Unsafe path');
    const data = await readFile(file);
    response.setHeader('content-type', file.endsWith('.glb') ? 'model/gltf-binary' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
    response.end(data);
  } catch { response.writeHead(404); response.end(); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 800 }, deviceScaleFactor: 1 });
  const pageErrors = [], consoleErrors = [], failedResponses = [], externalRequests = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('response', (response) => { if (response.status() >= 400) failedResponses.push({url: response.url(), status: response.status()}); });
  page.on('request', (request) => { if (!request.url().startsWith(origin) && !request.url().startsWith('blob:') && !request.url().startsWith('data:')) externalRequests.push(request.url()); });
  await page.goto(origin); await page.waitForFunction(() => window.ready === true);
  const reports = [];
  for (const name of names) {
    const folder = path.join(media, name); await mkdir(folder, { recursive: true });
    const construction = JSON.parse(await readFile(path.join(folder, 'construction.json')));
    const data = await readFile(path.join(folder, name + '.glb'));
    const info = await page.evaluate((name) => window.loadAsset(name), name);
    const shots = [];
    for (const view of ['beauty', 'front', 'side', 'back', ...name.includes('shield') ? ['rear-grip'] : []]) {
      await page.evaluate((view) => window.setView(view), view);
      const file = 'browser-' + view + '.png'; await page.screenshot({ path: path.join(folder, file) }); shots.push(file);
    }
    const proof = await page.evaluate(() => window.proof());
    const checks = {
      exact_height_m: Math.abs(info.bounds_gltf.dimensions[1] - construction.exact_height_m) < .000003,
      source_bounds_match: [...info.bounds_gltf.min, ...info.bounds_gltf.max].every((v, i) => Math.abs(v - [...construction.bounds_gltf.min, ...construction.bounds_gltf.max][i]) < .000003),
      runtime_triangle_budget: info.triangles <= 5000, runtime_primitive_budget: info.draw_primitives <= 5,
      runtime_material_budget: info.material_count <= 5, all_maps_512px: info.images.every((im) => im.width === 512 && im.height === 512),
      no_clips_required: info.clips.length === 0, no_page_errors: pageErrors.length === 0, no_console_errors: consoleErrors.length === 0,
      no_failed_responses: failedResponses.length === 0, no_external_requests: externalRequests.length === 0,
    };
    const report = { schema_version: 1, source: 'Exact delivered GLB loaded and rasterized by Three.js GLTFLoader in headless Chromium', three_version: threeVersion, browser_version: await browser.version(), glb_sha256: createHash('sha256').update(data).digest('hex'), ...proof, screenshots: shots, checks, page_errors: pageErrors, console_errors: consoleErrors, failed_responses: failedResponses, external_requests: externalRequests, limitations: ['Chromium with SwiftShader, not a physical device or Safari measurement.', 'Studio intake only; no gameplay approval or final hand pose is claimed.'] };
    await writeFile(path.join(folder, 'three-inspection.json'), JSON.stringify(report, null, 2) + '\n'); reports.push(report);
    const failures = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key);
    console.log(JSON.stringify({ name, triangles: info.triangles, primitives: info.draw_primitives, failures }));
    if (failures.length) process.exitCode = 1;
  }
  await writeFile(path.join(media, 'browser-intake.json'), JSON.stringify({ date_utc: new Date().toISOString(), assets: reports.map((r) => ({asset_id:r.asset_id,glb_sha256:r.glb_sha256,checks:r.checks})), page_errors: pageErrors, console_errors: consoleErrors, failed_responses: failedResponses, external_requests: externalRequests }, null, 2) + '\n');
} finally { if (browser) await browser.close(); await new Promise((resolve) => server.close(resolve)); }
