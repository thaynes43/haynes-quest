/** Action minions B v001: exact-GLB Chromium stills, action stills, motion contact sheet, gameplay-scale attack strip
 * and realtime playback of all five clips. node preview.mjs <asset-id> <glb> <outdir>   (run from the repo root)
 * Adapted from the WO111 web-slinger-helper / demon-band-idol preview.mjs. Views: front (character faces viewer),
 * side (faces viewer's right), back, three-quarter (front-right 45 deg), elevated beauty. Real WebGL raster via
 * headless Chromium (ANGLE SwiftShader); no physical-device claim. */
import {createServer} from 'node:http';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const [id, glb, outArg] = process.argv.slice(2);
const repo = process.cwd(), file = path.resolve(glb), out = path.resolve(outArg);
const cfg = JSON.parse(await readFile(new URL('./assets.json', import.meta.url), 'utf8'))[id];
await mkdir(out, {recursive: true});
const W = 720, H = 810;
const html = `<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><style>body{margin:0;background:#efe6d4}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/three/build/three.module.js"}}</script><script type="module">
import * as T from 'three';import {GLTFLoader} from '/three/examples/jsm/loaders/GLTFLoader.js';
const r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(${W},${H});r.outputColorSpace=T.SRGBColorSpace;r.setClearColor(0xf3ecdf);r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.15;document.body.append(r.domElement);
const s=new T.Scene();s.add(new T.HemisphereLight(0xfff4e0,0x6d6a78,1.5));for(const [xyz,c,i] of [[[-3,4,-4],0xffedce,2.1],[[3,3,-1],0xd2e0ff,0.9],[[1,4,3],0xffdcaa,1.3]]){const l=new T.DirectionalLight(c,i);l.position.set(...xyz);s.add(l)}
const floor=new T.Mesh(new T.CircleGeometry(30,48),new T.MeshStandardMaterial({color:0xe6dcc6,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.004;s.add(floor);
const g=await new GLTFLoader().loadAsync('/asset.glb');s.add(g.scene);const m=new T.AnimationMixer(g.scene);
const bb=new T.Box3().setFromObject(g.scene,true),size=bb.getSize(new T.Vector3());const cy=size.y*.5,half=Math.max(size.y*.5,Math.max(size.x,size.z)*.5*${H / W})*1.14;let env;g.scene.traverse(o=>{if(o.userData?.model_space_bounds_y_up)env=o.userData.model_space_bounds_y_up});const eb=new T.Box3(new T.Vector3(...env.min),new T.Vector3(...env.max)),ec=eb.getCenter(new T.Vector3()),es=eb.getSize(new T.Vector3());const ehalf=Math.max(es.y*.5,Math.max(es.x,es.z)*.5*${H / W})*1.04;const meshes=[];g.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o)});const poseBox=()=>{const b=new T.Box3(),v=new T.Vector3();g.scene.updateMatrixWorld(true);for(const k of meshes){k.skeleton.update();for(let i=0;i<k.geometry.attributes.position.count;i+=3)b.expandByPoint(k.getVertexPosition(i,v).applyMatrix4(k.matrixWorld))}return b};
const c=new T.OrthographicCamera(-half*${W / H},half*${W / H},half,-half,.01,60);
const views={front:[0,cy,-9],side:[9,cy,0],back:[0,cy,9],threequarter:[6.36,cy,-6.36],beauty:[4.2,cy+3.0,-7.4]};
window.draw=(view='beauty',clip='idle',fraction=0,scale=1,fit=false)=>{m.stopAllAction();const a=m.clipAction(g.animations.find(a=>a.name===clip));a.setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();m.setTime(a.getClip().duration*fraction);g.scene.updateMatrixWorld(true);let tgt=new T.Vector3(0,cy,0),z=1;if(fit==='pose'){const pb=poseBox(),ps=pb.getSize(new T.Vector3());tgt=pb.getCenter(new T.Vector3());z=half/(Math.max(ps.y*.5,Math.max(ps.x,ps.z)*.5*${H / W})*1.12)}else if(fit){tgt=new T.Vector3(ec.x,ec.y,ec.z);z=half/ehalf}const v=new T.Vector3(...views[view]).sub(new T.Vector3(0,cy,0));c.position.copy(tgt).add(v);c.lookAt(tgt);c.zoom=scale*z;c.updateProjectionMatrix();r.render(s,c);return {clips:g.animations.map(a=>({name:a.name,duration:a.duration})),calls:r.info.render.calls,triangles:r.info.render.triangles,glError:r.getContext().getError()}};
window.playClip=async(clip,scale=1)=>{window.draw('beauty',clip,0,scale);const a=m.existingAction(g.animations.find(a=>a.name===clip));const duration=a.getClip().duration,start=performance.now();let previous=start,frames=0;while((performance.now()-start)/1000<duration){await new Promise(requestAnimationFrame);const now=performance.now();m.update(Math.min(.1,(now-previous)/1000));previous=now;r.render(s,c);frames++}return {elapsed_s:(performance.now()-start)/1000,frames,glError:r.getContext().getError(),scale}};
window.ready=true;window.draw();</script>`;
const server = createServer(async (req, res) => { try { if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); return res.end(html); }
  const f = req.url === '/asset.glb' ? file : path.join(repo, 'node_modules', req.url.slice(1)); res.setHeader('Content-Type', req.url === '/asset.glb' ? 'model/gltf-binary' : 'text/javascript'); res.end(await readFile(f)); } catch (e) { res.writeHead(404); res.end(String(e)); } });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = 'http://127.0.0.1:' + server.address().port; let browser; const errors = [], warnings = [], requests = [], httpErrors = [];
const tag = (f) => String(f).replace('.', 'p');
const label = (text, w) => Buffer.from(`<svg width="${w}" height="34"><rect width="${w}" height="34" fill="#2a2630"/><text x="10" y="23" fill="#efe6d4" font-size="15" font-family="sans-serif">${text.replace(/&/g, '&amp;')}</text></svg>`);
const png = (p) => sharp(p).png({compressionLevel: 9, palette: true, quality: 92, effort: 8});
try {
  browser = await chromium.launch({headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  const page = await browser.newPage({viewport: {width: W, height: H}});
  page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); if (msg.type() === 'warning') warnings.push(msg.text()); });
  page.on('request', (r) => requests.push(r.url())); page.on('response', (r) => { if (r.status() >= 400) httpErrors.push({url: r.url(), status: r.status()}); });
  await page.goto(origin, {waitUntil: 'networkidle'}); await page.waitForFunction(() => window.ready, null, {timeout: 120000});
  const shot = async (name) => { const raw = await page.screenshot(); await png(raw).toFile(path.join(out, name)); return raw; };
  for (const view of ['front', 'side', 'back', 'threequarter', 'beauty']) { await page.evaluate((v) => window.draw(v), view); await shot(view + '.png'); }
  const report = await page.evaluate(() => window.draw()); report.clips = {};
  const composites = []; let row = 0; const cw = 300, ch = Math.round(300 * H / W);
  for (const clip of ['idle', 'move', 'attack', 'hit', 'defeat']) {
    const frames = [];
    for (const [col, [fraction, text]] of cfg.beats[clip].entries()) {
      const result = await page.evaluate(({clip, fraction}) => window.draw('beauty', clip, fraction, 1, true), {clip, fraction});
      const raw = await page.screenshot(); frames.push({fraction, text, ...result, raster_sha256: createHash('sha256').update(raw).digest('hex')});
      composites.push({input: await sharp(raw).resize(cw, ch).png().toBuffer(), left: col * cw, top: row * (ch + 34) + 34});
      composites.push({input: label(`${clip} · ${(fraction * result.clips.find((c) => c.name === clip).duration).toFixed(2)} s · ${text}`, cw), left: col * cw, top: row * (ch + 34)});
    }
    const small = [];
    for (const [fraction] of cfg.beats[clip]) { await page.evaluate(({clip, fraction}) => window.draw('beauty', clip, fraction, .35), {clip, fraction}); small.push(createHash('sha256').update(await page.screenshot()).digest('hex')); }
    const playback = []; for (const scale of [1, .35]) playback.push(await page.evaluate(({clip, scale}) => window.playClip(clip, scale), {clip, scale}));
    report.clips[clip] = {duration_s: frames[0].clips.find((c) => c.name === clip).duration, frames, distinct_rasters: new Set(frames.map((f) => f.raster_sha256)).size, small_distinct_rasters: new Set(small).size, realtime_playback: playback};
    row++;
  }
  await png(await sharp({create: {width: cw * 4, height: (ch + 34) * 5, channels: 3, background: '#2a2630'}}).composite(composites).png().toBuffer()).toFile(path.join(out, 'motion-contact-sheet.png'));
  // action stills (the attack telegraph and contact, the hit and the held defeat) from the front-right
  const actions = [['action-windup', 'attack', .45], ['action-contact', 'attack', .625], ['action-hit', 'hit', .2], ['action-defeat', 'defeat', 1]];
  for (const [name, clip, fraction] of actions) { await page.evaluate(({clip, fraction}) => window.draw('threequarter', clip, fraction, 1, 'pose'), {clip, fraction}); await shot(name + '.png'); }
  const strip = [];
  for (const [col, [fraction, text]] of cfg.beats.attack.entries()) {
    await page.evaluate(({fraction}) => window.draw('beauty', 'attack', fraction, .35, true), {fraction}); const raw = await page.screenshot();
    strip.push({input: await sharp(raw).extract({left: Math.round(W * .25), top: Math.round(H * .25), width: Math.round(W * .5), height: Math.round(H * .5)}).png().toBuffer(), left: col * Math.round(W * .5), top: 34});
    strip.push({input: label(`35% gameplay scale · ${(fraction * 2).toFixed(2)} s · ${text}`, Math.round(W * .5)), left: col * Math.round(W * .5), top: 0});
  }
  await png(await sharp({create: {width: Math.round(W * .5) * 4, height: Math.round(H * .5) + 34, channels: 3, background: '#2a2630'}}).composite(strip).png().toBuffer()).toFile(path.join(out, 'attack-gameplay-scale.png'));
  report.errors = errors; report.warnings = warnings; report.httpErrors = httpErrors; report.browser = browser.version();
  report.glb_sha256 = createHash('sha256').update(await readFile(file)).digest('hex');
  report.renderer = 'Chromium headless ANGLE SwiftShader, real WebGL raster, ACESFilmic exposure 1.15 like src/game/scene.ts; no physical device claim';
  report.checks = {five_clips: Object.keys(report.clips).length === 5, every_clip_changes_raster: Object.values(report.clips).every((c) => c.distinct_rasters > 1),
    every_clip_changes_raster_at_35_percent: Object.values(report.clips).every((c) => c.small_distinct_rasters > 1),
    realtime_playback_all_clips_both_scales: Object.values(report.clips).every((c) => c.realtime_playback.every((p) => p.frames >= 4 && p.elapsed_s >= c.duration_s && p.glError === 0)),
    zero_console_errors: errors.length === 0, zero_http_errors: httpErrors.length === 0, zero_webgl_errors: report.glError === 0,
    no_external_requests: requests.every((u) => u.startsWith(origin + '/') || u.startsWith('blob:') || u.startsWith('data:')),
    character_draw_calls_2: report.calls === 3};
  await writeFile(path.join(out, 'browser-inspection.json'), JSON.stringify(report, null, 2) + '\n');
  const failures = Object.entries(report.checks).filter(([, v]) => !v).map(([k]) => k);
  console.log(JSON.stringify({id, calls: report.calls, triangles: report.triangles, failures, distinct: Object.fromEntries(Object.entries(report.clips).map(([n, c]) => [n, c.distinct_rasters]))}));
  if (failures.length) process.exitCode = 1;
} finally { await browser?.close(); await new Promise((r) => server.close(r)); }
