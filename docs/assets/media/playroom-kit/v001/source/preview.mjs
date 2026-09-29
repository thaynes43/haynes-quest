/** WO111 playroom-kit v001: exact-GLB Chromium viewer check and matched stills.
 * Copy into a haynes-quest worktree at scripts/assets/playroom-kit/v001/ and run from the repo root:
 *   node scripts/assets/playroom-kit/v001/preview.mjs <artifact-dir> <out-dir>
 * Real WebGL raster in headless Chromium (ANGLE SwiftShader) through three.js GLTFLoader, one page per prop.
 * Matched views (orthographic, one scale per prop, level camera) follow the reference sheets: front (+Z), side (front
 * toward the viewer's right), back, three-quarter (front-left camera, as the sheet's +45 deg turn); plus an elevated
 * perspective beauty from the front-right matching the concept draft's three-quarter. No physical-device claim. */
import {createServer} from 'node:http';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const repo = process.cwd(), root = path.resolve(process.argv[2]), out = path.resolve(process.argv[3]);
await mkdir(out, {recursive: true});
const IDS = ['stacking-block-tower', 'toy-bus-garage', 'crib-rail-fence', 'giant-plush-ball'];
const BEAUTY = {'stacking-block-tower': [-28, 18], 'toy-bus-garage': [-32, 18], 'crib-rail-fence': [-18, 14], 'giant-plush-ball': [-32, 14]};
const html = `<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><style>body{margin:0;background:#efe4cf}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js"}}</script><script type="module">
import * as T from 'three';import {GLTFLoader} from '/three/examples/jsm/loaders/GLTFLoader.js';
const S=900;const r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(S,S);r.outputColorSpace=T.SRGBColorSpace;r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.0;
r.shadowMap.enabled=true;r.shadowMap.type=T.PCFSoftShadowMap;document.body.append(r.domElement);
const s=new T.Scene();s.background=new T.Color(0xefe4cf);s.add(new T.HemisphereLight(0xfff0d8,0x657084,2));
const lights=[];for(const [xyz,c,i] of [[[-3,4,4],0xffe2b8,3],[[3,3,1],0xc7d9ff,1.4],[[1,4,-3],0xffd195,2]]){const l=new T.DirectionalLight(c,i);l.position.set(...xyz);s.add(l);lights.push(l)}
const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:0xe2d5bd,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-0.002;floor.receiveShadow=true;s.add(floor);
const id=new URLSearchParams(location.search).get('id');const g=await new GLTFLoader().loadAsync('/kit/'+id+'.glb');
g.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});s.add(g.scene);
const box=new T.Box3().setFromObject(g.scene,true),size=box.getSize(new T.Vector3()),c=box.getCenter(new T.Vector3());
const key=lights[0];key.castShadow=true;const R=Math.max(size.x,size.y,size.z);key.position.copy(c).add(new T.Vector3(-0.45,0.8,0.55).normalize().multiplyScalar(R*3));key.target.position.copy(c);s.add(key.target);
Object.assign(key.shadow.camera,{left:-R,right:R,top:R,bottom:-R,near:0.01,far:R*8});key.shadow.mapSize.set(2048,2048);key.shadow.bias=-0.0004;key.shadow.radius=4;key.shadow.camera.updateProjectionMatrix();
const half=Math.max(size.y,Math.hypot(size.x,size.z))*0.56;
const ortho=new T.OrthographicCamera(-half,half,half,-half,0.01,400);const persp=new T.PerspectiveCamera(30,1,0.05,400);
const views={front:[0,0,1],side:[-1,0,0],back:[0,0,-1],threequarter:[-Math.SQRT1_2,0,Math.SQRT1_2]};
window.draw=(view,az=30,el=16)=>{let cam;
 if(view==='beauty'){cam=persp;const a=az*Math.PI/180,e=el*Math.PI/180,d=size.length()*0.5*1.04/Math.sin(15*Math.PI/180);cam.position.set(c.x+Math.sin(a)*Math.cos(e)*d,c.y+Math.sin(e)*d,c.z+Math.cos(a)*Math.cos(e)*d);cam.lookAt(c)}
 else{cam=ortho;const v=views[view];cam.position.set(c.x+v[0]*R*4,c.y,c.z+v[2]*R*4);cam.lookAt(c.x,c.y,c.z)}
 cam.updateProjectionMatrix();r.render(s,cam);const gl=r.getContext();
 return {view,calls:r.info.render.calls,triangles:r.info.render.triangles,glError:gl.getError(),webgl:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER),ortho_half_extent_m:half,
  bounds:{min:box.min.toArray(),max:box.max.toArray()},materials:[...new Set((()=>{const m=[];g.scene.traverse(o=>{if(o.isMesh)m.push(o.material)});return m})())].map(m=>({name:m.name,vertexColors:m.vertexColors}))}};
window.ready=true;</script>`;
const server = createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') { res.setHeader('Content-Type', 'text/html'); return res.end(html); }
    if (u.pathname.startsWith('/kit/')) { res.setHeader('Content-Type', 'model/gltf-binary'); return res.end(await readFile(path.join(root, path.basename(u.pathname)))); }
    res.setHeader('Content-Type', 'text/javascript'); res.end(await readFile(path.join(repo, 'node_modules', u.pathname.slice(1))));
  } catch (e) { res.writeHead(404); res.end(String(e)); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = 'http://127.0.0.1:' + server.address().port;
const report = {tool: 'Chromium headless (Playwright) + three.js GLTFLoader, real WebGL raster via ANGLE SwiftShader; no physical-device claim', props: {}};
let browser;
try {
  browser = await chromium.launch({headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  report.browser = browser.version();
  for (const id of IDS) {
    const page = await browser.newPage({viewport: {width: 900, height: 900}});
    const errors = [], warnings = [], httpErrors = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning') warnings.push(m.text()); });
    page.on('requestfailed', r => errors.push(r.url() + ': ' + r.failure()?.errorText)); page.on('response', r => { if (r.status() >= 400) httpErrors.push({url: r.url(), status: r.status()}); });
    await page.goto(origin + '/?id=' + id, {waitUntil: 'networkidle'}); await page.waitForFunction(() => window.ready, null, {timeout: 180000});
    const shots = {};
    for (const view of ['front', 'side', 'back', 'threequarter']) { shots[view] = await page.evaluate(v => window.draw(v), view); await page.screenshot({path: path.join(out, `${id}-${view}.png`)}); }
    const [az, el] = BEAUTY[id];
    shots.beauty = await page.evaluate(([a, e]) => window.draw('beauty', a, e), [az, el]); shots.beauty.azimuth_deg = az; shots.beauty.elevation_deg = el;
    await page.screenshot({path: path.join(out, `${id}-beauty.png`)});
    const glb = await readFile(path.join(root, id + '.glb'));
    report.props[id] = {glb_sha256: createHash('sha256').update(glb).digest('hex'), shots, errors, warnings, httpErrors,
      checks: {no_page_errors: errors.length === 0, no_http_errors: httpErrors.length === 0, no_gl_errors: Object.values(shots).every(x => x.glError === 0),
        drew_triangles: Object.values(shots).every(x => x.triangles > 0), vertex_colours_enabled: shots.front.materials.every(m => m.vertexColors)}};
    console.log(JSON.stringify({id, calls: shots.beauty.calls, triangles: shots.front.triangles, errors: errors.length, checks: report.props[id].checks}));
    await page.close();
  }
} finally { await browser?.close(); server.close(); }
report.all_checks_pass = Object.values(report.props).every(p => Object.values(p.checks).every(Boolean));
await writeFile(path.join(out, 'browser-inspection.json'), JSON.stringify(report, null, 2) + '\n');
process.exitCode = report.all_checks_pass ? 0 : 1;
