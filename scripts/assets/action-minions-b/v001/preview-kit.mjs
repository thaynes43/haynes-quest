/** Storybook planting kit v001: exact-GLB Chromium stills (front/side/back/three-quarter per prop), a lineup with the
 * Broccoli Bouncer v001 enemy for scale, and a planted-group view. node preview-kit.mjs <kit-dir> <scale-ref.glb> <outdir>
 * Real WebGL raster via headless Chromium (ANGLE SwiftShader), ACES 1.15 like the game; no physical-device claim. */
import {createServer} from 'node:http';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const [kitDir, refGlb, outArg] = process.argv.slice(2);
const repo = process.cwd(), out = path.resolve(outArg); await mkdir(out, {recursive: true});
const props = ['storybook-canopy-tree', 'storybook-cypress', 'storybook-flowering-shrub'];
const W = 720, H = 810;
const html = `<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><style>body{margin:0}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/three/build/three.module.js"}}</script><script type="module">
import * as T from 'three';import {GLTFLoader} from '/three/examples/jsm/loaders/GLTFLoader.js';
const r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(${W},${H});r.outputColorSpace=T.SRGBColorSpace;r.setClearColor(0xf3ecdf);r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.15;document.body.append(r.domElement);
const s=new T.Scene();s.add(new T.HemisphereLight(0xfff4e0,0x6d6a78,1.5));for(const [xyz,c,i] of [[[-3,4,4],0xffedce,2.1],[[3,3,1],0xd2e0ff,.9],[[1,4,-3],0xffdcaa,1.3]]){const l=new T.DirectionalLight(c,i);l.position.set(...xyz);s.add(l)}
const floor=new T.Mesh(new T.CircleGeometry(60,48),new T.MeshStandardMaterial({color:0xe6dcc6,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.004;s.add(floor);
const L=new GLTFLoader();const models={};for(const id of ${JSON.stringify(props)})models[id]=(await L.loadAsync('/'+id+'.glb')).scene;const ref=await L.loadAsync('/ref.glb');
const root=new T.Group();s.add(root);const cam=new T.OrthographicCamera(-1,1,1,-1,.01,200);
function frame(view,box,pad=1.1){const c=box.getCenter(new T.Vector3()),sz=box.getSize(new T.Vector3());const half=Math.max(sz.y*.5,Math.max(sz.x,sz.z)*.5*${H / W})*pad;cam.left=-half*${W / H};cam.right=half*${W / H};cam.top=half;cam.bottom=-half;cam.updateProjectionMatrix();
 const dirs={front:[0,0,1],side:[1,0,0],back:[0,0,-1],threequarter:[.7071,0,.7071],beauty:[.55,.42,.72]};const d=new T.Vector3(...dirs[view]).normalize();cam.position.copy(c).addScaledVector(d,40);cam.lookAt(c)}
window.prop=(id,view)=>{root.clear();root.add(models[id]);root.updateMatrixWorld(true);frame(view,new T.Box3().setFromObject(root,true));r.render(s,cam);return {calls:r.info.render.calls,triangles:r.info.render.triangles,glError:r.getContext().getError()}};
window.lineup=()=>{root.clear();const xs={'storybook-canopy-tree':0,'storybook-cypress':2.9,'storybook-flowering-shrub':4.4};for(const [id,x] of Object.entries(xs)){const m=models[id].clone();m.position.x=x;root.add(m)}
 ref.scene.position.set(5.6,0,0);ref.scene.rotation.y=-.5;root.add(ref.scene);const mx=new T.AnimationMixer(ref.scene);mx.clipAction(ref.animations.find(a=>a.name==='idle')).play();mx.setTime(0);root.updateMatrixWorld(true);
 frame('front',new T.Box3().setFromObject(root,true),1.06);r.render(s,cam);return {calls:r.info.render.calls,triangles:r.info.render.triangles,glError:r.getContext().getError()}};
window.garden=()=>{root.clear();const place=[['storybook-canopy-tree',-2.2,-2.6,0.4,1],['storybook-cypress',1.6,-3.2,1.2,1],['storybook-cypress',2.6,-2.4,2.5,.85],['storybook-canopy-tree',4.6,-3.6,2.2,.9],
 ['storybook-flowering-shrub',-.6,-.8,0,1],['storybook-flowering-shrub',.5,-1.3,1.4,.85],['storybook-flowering-shrub',3.2,-.6,2.9,1.1],['storybook-flowering-shrub',-3.4,-.4,.7,.9]];
 for(const [id,x,z,ry,sc] of place){const m=models[id].clone();m.position.set(x,0,z);m.rotation.y=ry;m.scale.setScalar(sc);root.add(m)}
 const path=new T.Mesh(new T.BoxGeometry(14,.12,1.6),new T.MeshStandardMaterial({color:0xcdbb95,roughness:1}));path.position.set(1,.06,1);root.add(path);
 root.updateMatrixWorld(true);frame('beauty',new T.Box3().setFromObject(root,true),.92);r.render(s,cam);return {calls:r.info.render.calls,triangles:r.info.render.triangles,glError:r.getContext().getError()}};
window.ready=true;</script>`;
const server = createServer(async (req, res) => { try { if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); return res.end(html); }
  const name = req.url.slice(1); let f;
  if (name === 'ref.glb') f = path.resolve(refGlb); else if (props.includes(name.replace('.glb', ''))) f = path.join(path.resolve(kitDir), name); else f = path.join(repo, 'node_modules', name);
  res.setHeader('Content-Type', name.endsWith('.glb') ? 'model/gltf-binary' : 'text/javascript'); res.end(await readFile(f)); } catch (e) { res.writeHead(404); res.end(String(e)); } });
await new Promise((r) => server.listen(0, '127.0.0.1', r)); const origin = 'http://127.0.0.1:' + server.address().port;
let browser; const errors = [], httpErrors = [], requests = [];
const png = (b) => sharp(b).png({compressionLevel: 9, palette: true, quality: 92, effort: 8});
try {
  browser = await chromium.launch({headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  const page = await browser.newPage({viewport: {width: W, height: H}});
  page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', (r) => requests.push(r.url())); page.on('response', (r) => { if (r.status() >= 400) httpErrors.push({url: r.url(), status: r.status()}); });
  await page.goto(origin, {waitUntil: 'networkidle'}); await page.waitForFunction(() => window.ready, null, {timeout: 120000});
  const report = {props: {}};
  await mkdir(path.join(out, 'stills'), {recursive: true});
  for (const id of props) { report.props[id] = {};
    for (const view of ['front', 'side', 'back', 'threequarter', 'beauty']) {
      const r = await page.evaluate(({id, view}) => window.prop(id, view), {id, view}); const raw = await page.screenshot();
      await png(raw).toFile(path.join(out, 'stills', `${id}-${view}.png`)); report.props[id][view] = {...r, raster_sha256: createHash('sha256').update(raw).digest('hex')};
    } }
  report.lineup = await page.evaluate(() => window.lineup()); await page.setViewportSize({width: W, height: H});
  await png(await page.screenshot()).toFile(path.join(out, 'kit-lineup.png'));
  report.garden = await page.evaluate(() => window.garden()); await png(await page.screenshot()).toFile(path.join(out, 'kit-garden.png'));
  report.errors = errors; report.httpErrors = httpErrors; report.browser = browser.version();
  report.renderer = 'Chromium headless ANGLE SwiftShader, real WebGL raster, ACESFilmic exposure 1.15 like src/game/scene.ts; no physical device claim';
  report.glb_sha256 = Object.fromEntries(await Promise.all(props.map(async (id) => [id, createHash('sha256').update(await readFile(path.join(kitDir, id + '.glb'))).digest('hex')])));
  report.checks = {one_draw_call_per_prop: props.every((id) => report.props[id].front.calls === 2), zero_console_errors: errors.length === 0, zero_http_errors: httpErrors.length === 0,
    zero_webgl_errors: props.every((id) => Object.values(report.props[id]).every((v) => v.glError === 0)) && report.lineup.glError === 0 && report.garden.glError === 0,
    no_external_requests: requests.every((u) => u.startsWith(origin + '/') || u.startsWith('blob:') || u.startsWith('data:'))};
  await writeFile(path.join(out, 'browser-inspection.json'), JSON.stringify(report, null, 2) + '\n');
  const failures = Object.entries(report.checks).filter(([, v]) => !v).map(([k]) => k); console.log(JSON.stringify({failures, lineup: report.lineup, garden: report.garden}));
  if (failures.length) process.exitCode = 1;
} finally { await browser?.close(); await new Promise((r) => server.close(r)); }
