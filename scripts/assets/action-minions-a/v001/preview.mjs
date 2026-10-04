/** Action minions A v001: exact-GLB Chromium evidence for one candidate.
 *   node scripts/assets/action-minions-a/v001/preview.mjs <asset-id> <glb> <outdir>     (run from the repo root)
 * Writes front/side/back/threequarter/beauty stills (idle at 0 s = the concept pose), the held defeat and attack
 * contact views, a 5 x 4 motion contact sheet, the attack strip at full and 35 % gameplay scale, real-time playback
 * of every clip at both scales, and a compressed review video (deterministic 30 fps frames, VP8 WebM).
 * Headless Chromium with ANGLE SwiftShader: real WebGL raster, no physical-device claim.
 * Adapted from the WO111 mischief-kitten v001 preview. */
import {createServer} from 'node:http';
import {readFile, writeFile, mkdir, rm, readdir, stat} from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {homedir} from 'node:os';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import sharp from 'sharp';
import {ASSETS} from './assets.mjs';
const repo = process.cwd(), id = process.argv[2], file = path.resolve(process.argv[3]), out = path.resolve(process.argv[4]);
const A = ASSETS[id], PV = A.preview; await mkdir(out, {recursive: true});
const sha = b => createHash('sha256').update(b).digest('hex');
const html = `<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><style>body{margin:0;background:#e9e0cf;overflow:hidden}#label{position:absolute;left:14px;top:10px;font:600 17px sans-serif;color:#3a3530}</style><div id="label"></div><script type="importmap">{"imports":{"three":"/three/build/three.module.js"}}</script><script type="module">
import * as T from 'three';import {GLTFLoader} from '/three/examples/jsm/loaders/GLTFLoader.js';
const r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setPixelRatio(1);r.setSize(innerWidth,innerHeight);r.outputColorSpace=T.SRGBColorSpace;r.setClearColor(0xe9e0cf);r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.05;document.body.append(r.domElement);
const s=new T.Scene();s.add(new T.HemisphereLight(0xfff3e0,0x6f7480,2.1));for(const [xyz,c,i] of [[[-3,4,-4],0xffe6c4,2.6],[[3,3,-1],0xd0deff,1.2],[[1,4,3],0xffd7a0,1.6]]){const l=new T.DirectionalLight(c,i);l.position.set(...xyz);s.add(l)}
const floor=new T.Mesh(new T.CircleGeometry(4,64),new T.MeshStandardMaterial({color:0xd8cfbd,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.002;s.add(floor);
const g=await new GLTFLoader().loadAsync('/asset.glb');s.add(g.scene);const m=new T.AnimationMixer(g.scene);
const PV=${JSON.stringify(PV)};const aspect=innerWidth/innerHeight;const c=new T.OrthographicCamera(-PV.half*aspect,PV.half*aspect,PV.half,-PV.half,.01,40);
const C0=new T.Vector3(...PV.center);const views=Object.fromEntries(Object.entries({front:[0,0,-8],side:[8,0,0],back:[0,0,8],threequarter:[5.657,0,-5.657],beauty:PV.beauty,left:[-8,0,0]}).map(([k,v])=>[k,new T.Vector3(...v).add(C0).toArray()]));
const probes=${JSON.stringify(A.probes)};
window.draw=(view='beauty',clip=null,fraction=0,scale=1,label='')=>{document.getElementById('label').textContent=label;m.stopAllAction();if(clip){const a=m.clipAction(g.animations.find(a=>a.name===clip));a.setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();m.setTime(a.getClip().duration*fraction)}g.scene.updateMatrixWorld(true);c.position.set(...views[view]);c.lookAt(C0);c.zoom=scale*(view==='beauty'?(PV.beautyZoom??.95):1);c.updateProjectionMatrix();r.render(s,c);
 return {clips:g.animations.map(a=>({name:a.name,duration:a.duration})),calls:r.info.render.calls,triangles:r.info.render.triangles,glError:r.getContext().getError(),webgl:r.getContext().getParameter(r.getContext().VERSION),pose:Object.fromEntries(probes.map(n=>[n,g.scene.getObjectByName(n).getWorldPosition(new T.Vector3()).toArray().map(x=>+x.toFixed(4))]))}};
window.playClip=async(clip,scale=1)=>{window.draw('beauty',clip,0,scale);const duration=g.animations.find(a=>a.name===clip).duration,start=performance.now();let prev=start,frames=0;const seen=new Set();while((performance.now()-start)/1000<duration){await new Promise(requestAnimationFrame);const now=performance.now();m.update(Math.min(.1,(now-prev)/1000));prev=now;g.scene.updateMatrixWorld(true);r.render(s,c);frames++;seen.add(g.scene.getObjectByName(probes[0]).getWorldPosition(new T.Vector3()).toArray().map(x=>x.toFixed(3)).join())}return {elapsed_s:(performance.now()-start)/1000,frames,distinct_probe_positions:seen.size,glError:r.getContext().getError(),scale}};
window.drawAz=(az,el=8,clip='idle',fraction=0,zoom=1)=>{m.stopAllAction();const a=m.clipAction(g.animations.find(a=>a.name===clip));a.setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();m.setTime(a.getClip().duration*fraction);g.scene.updateMatrixWorld(true);const r0=8,az0=az*Math.PI/180,el0=el*Math.PI/180;c.position.set(C0.x+r0*Math.cos(el0)*Math.sin(az0),C0.y+r0*Math.sin(el0),C0.z-r0*Math.cos(el0)*Math.cos(az0));c.lookAt(C0);c.zoom=zoom;c.updateProjectionMatrix();r.render(s,c);return r.info.render.calls};
window.ready=true;</script>`;
const server = createServer(async (req, res) => { try { if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); return res.end(html); }
  const f = req.url === '/asset.glb' ? file : path.join(repo, 'node_modules', req.url.slice(1)); res.setHeader('Content-Type', req.url === '/asset.glb' ? 'model/gltf-binary' : 'text/javascript'); res.end(await readFile(f)); } catch (e) { res.writeHead(404); res.end(String(e)); } });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const origin = 'http://127.0.0.1:' + server.address().port;
const errors = [], warnings = [], requests = [], httpErrors = []; let browser;
const png = async (buffer, dest, width) => { let im = sharp(buffer); if (width) im = im.resize(width); await im.png({palette: true, quality: 92, effort: 8}).toFile(dest); return dest; };
const tag = f => String(f).replace('.', 'p');
try {
  browser = await chromium.launch({headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  const page = await browser.newPage({viewport: {width: 800, height: 900}});
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning') warnings.push(m.text()); });
  page.on('request', r => requests.push(r.url())); page.on('requestfailed', r => errors.push(r.url() + ': ' + r.failure()?.errorText)); page.on('response', r => { if (r.status() >= 400) httpErrors.push({url: r.url(), status: r.status()}); });
  await page.goto(origin, {waitUntil: 'networkidle'}); await page.waitForFunction(() => window.ready, null, {timeout: 120000});
  const report = {stills: {}, clips: {}};
  for (const view of ['front', 'side', 'back', 'threequarter', 'beauty']) { const r = await page.evaluate(v => window.draw(v, 'idle', 0), view); const b = await page.screenshot(); await png(b, path.join(out, view + '.png')); report.stills[view] = {...r, raster_sha256: sha(b)}; }
  for (const [name, view, clip, f] of [['defeat-held', 'beauty', 'defeat', 1], ['defeat-held-front', 'front', 'defeat', 1], ['attack-contact-side', 'side', 'attack', .625], ['attack-contact-front', 'front', 'attack', .625], ['attack-windup-side', 'side', 'attack', .45]]) {
    await page.evaluate(([v, c, f, z]) => window.draw(v, c, f, z), [view, clip, f, PV.motionZoom ?? .8]); await png(await page.screenshot(), path.join(out, name + '.png'), 560);
  }
  if (process.argv[5] && PV.compare) {  // concept row above the exact export at matching azimuths
    const concept = await sharp(process.argv[5]).resize(1200).png().toBuffer(), meta = await sharp(concept).metadata(), tiles = [];
    for (const [i, az] of PV.compare.entries()) { await page.evaluate(([a, z]) => window.drawAz(a, 8, 'idle', 0, z), [az, PV.compareZoom ?? 1]); tiles.push({input: await sharp(await page.screenshot()).resize(400, 450).png().toBuffer(), left: i * 400, top: meta.height + 36}); }
    const label = t => Buffer.from('<svg width="1200" height="36"><rect width="1200" height="36" fill="#2b2622"/><text x="12" y="24" fill="#efe6d4" font-size="16" font-family="sans-serif">' + t + '</text></svg>');
    await png(await sharp({create: {width: 1200, height: meta.height + 36 + 450 + 36, channels: 3, background: '#e9e0cf'}}).composite([{input: concept, left: 0, top: 0}, {input: label('Above: coordinator concept (image-generated construction reference). Below: exact v001 GLB, idle at 0 s, matching views'), left: 0, top: meta.height}, ...tiles, {input: label('Exact export · azimuths ' + PV.compare.join('°, ') + '° · orthographic · same lighting as the stills'), left: 0, top: meta.height + 36 + 450}]).png().toBuffer(), path.join(out, 'concept-vs-export.png'));
  }
  const composites = []; let row = 0;
  for (const clip of ['idle', 'move', 'attack', 'hit', 'defeat']) {
    const frames = [], small = [];
    for (const [col, [fraction, label]] of PV.beats[clip].entries()) {
      const r = await page.evaluate(([c, f, z]) => window.draw('beauty', c, f, z), [clip, fraction, PV.motionZoom ?? .8]); const b = await page.screenshot();
      frames.push({fraction, label, ...r, raster_sha256: sha(b)});
      composites.push({input: await sharp(b).resize(320, 360).png().toBuffer(), left: col * 320, top: row * 396 + 36});
      const dur = r.clips.find(x => x.name === clip).duration;
      composites.push({input: Buffer.from('<svg width="320" height="36"><rect width="320" height="36" fill="#2b2622"/><text x="10" y="24" fill="#efe6d4" font-size="15" font-family="sans-serif">' + clip + ' · ' + (fraction * dur).toFixed(2) + ' s · ' + label + '</text></svg>'), left: col * 320, top: row * 396});
      const rs = await page.evaluate(([c, f]) => window.draw('beauty', c, f, .35), [clip, fraction]); const bs = await page.screenshot();
      if (clip === 'attack') await writeFile(path.join(out, '.attack-small-' + col + '.png'), bs);
      small.push({fraction, calls: rs.calls, glError: rs.glError, raster_sha256: sha(bs)});
    }
    const playback = []; for (const scale of [1, .35]) playback.push(await page.evaluate(([c, s]) => window.playClip(c, s), [clip, scale]));
    report.clips[clip] = {duration_s: frames[0].clips.find(x => x.name === clip).duration, frames, distinct_rasters: new Set(frames.map(f => f.raster_sha256)).size, small_frames: small, small_distinct_rasters: new Set(small.map(f => f.raster_sha256)).size, realtime_playback: playback}; row++;
  }
  const sheet = await sharp({create: {width: 1280, height: 1980, channels: 3, background: '#2b2622'}}).composite(composites).png().toBuffer();
  await png(sheet, path.join(out, 'motion-contact-sheet.png'));
  await png(await sharp(sheet).extract({left: 0, top: 792, width: 1280, height: 396}).png().toBuffer(), path.join(out, 'attack-strip.png'));
  const smallAttack = [];
  for (const [col, [fraction, label]] of PV.beats.attack.entries()) {
    const b = await readFile(path.join(out, '.attack-small-' + col + '.png')); await rm(path.join(out, '.attack-small-' + col + '.png'));
    smallAttack.push({input: await sharp(b).extract({left: 200, top: 250, width: 400, height: 420}).png().toBuffer(), left: col * 400, top: 36});
    smallAttack.push({input: Buffer.from('<svg width="400" height="36"><rect width="400" height="36" fill="#2b2622"/><text x="10" y="24" fill="#efe6d4" font-size="15" font-family="sans-serif">35% gameplay scale · ' + (fraction * 2).toFixed(2) + ' s · ' + label + '</text></svg>'), left: col * 400, top: 0});
  }
  await png(await sharp({create: {width: 1600, height: 456, channels: 3, background: '#2b2622'}}).composite(smallAttack).png().toBuffer(), path.join(out, 'attack-gameplay-scale.png'));
  // review video: deterministic 30 fps frames of every clip, encoded VP8
  const vpage = await browser.newPage({viewport: {width: 640, height: 720}}); vpage.on('pageerror', e => errors.push(e.message));
  await vpage.goto(origin, {waitUntil: 'networkidle'}); await vpage.waitForFunction(() => window.ready, null, {timeout: 120000});
  const fdir = path.join(out, '.frames'); await rm(fdir, {recursive: true, force: true}); await mkdir(fdir); let n = 0;
  for (const [clip, loops, label] of [['idle', 1, 'idle'], ['move', 3, 'move (chasing)'], ['attack', 1, 'attack · contact at 1.25 s'], ['hit', 1, 'hit'], ['defeat', 1, 'defeat · held pose']]) {
    const dur = A.durations[clip], count = Math.round(dur * 30);
    for (let L = 0; L < loops; L++) for (let i = 0; i < count; i++) { await vpage.evaluate(([c, f, z, l]) => window.draw('beauty', c, f, z, l), [clip, i / count, PV.motionZoom ?? .8, id + ' · ' + label]); await writeFile(path.join(fdir, String(n++).padStart(4, '0') + '.jpg'), await vpage.screenshot({type: 'jpeg', quality: 88})); }
    if (clip === 'defeat') for (let i = 0; i < 24; i++) { await writeFile(path.join(fdir, String(n++).padStart(4, '0') + '.jpg'), await vpage.screenshot({type: 'jpeg', quality: 88})); }
  }
  const ffmpeg = path.join(homedir(), '.cache/ms-playwright/ffmpeg-1011/ffmpeg-linux'), video = path.join(out, 'review.webm');
  const jpegs = []; for (const f of (await readdir(fdir)).sort()) jpegs.push(await readFile(path.join(fdir, f)));
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', '30', '-i', 'pipe:0', '-c:v', 'libvpx', '-b:v', '450k', '-crf', '12', '-qmin', '4', '-qmax', '42', '-pix_fmt', 'yuv420p', '-auto-alt-ref', '0', video], {input: Buffer.concat(jpegs), maxBuffer: 1 << 28});
  await rm(fdir, {recursive: true, force: true});
  const vbytes = (await stat(video)).size;
  report.video = {file: 'review.webm', frames: n, fps: 30, codec: 'VP8 (libvpx via the Playwright ffmpeg build)', bytes: vbytes, sha256: sha(await readFile(video)), method: 'Deterministic frames from the exact GLB at 30 fps (mixer time set per frame), not a screen capture'};
  report.errors = errors; report.warnings = warnings; report.httpErrors = httpErrors; report.requests = [...new Set(requests)]; report.browser = browser.version();
  report.glb_sha256 = sha(await readFile(file)); report.renderer = 'Chromium headless, ANGLE SwiftShader WebGL; no physical-device claim';
  report.checks = {five_clips: Object.keys(report.clips).length === 5, every_clip_changes_raster: Object.values(report.clips).every(c => c.distinct_rasters > 1),
    every_clip_changes_raster_at_35_percent: Object.values(report.clips).every(c => c.small_distinct_rasters > 1),
    realtime_playback_all_clips_both_scales: Object.values(report.clips).every(c => c.realtime_playback.length === 2 && c.realtime_playback.every(p => p.frames >= 4 && p.elapsed_s >= c.duration_s && p.glError === 0 && p.distinct_probe_positions > 1)),
    zero_console_errors: errors.length === 0, zero_http_errors: httpErrors.length === 0, zero_webgl_errors: Object.values(report.stills).every(s => s.glError === 0) && Object.values(report.clips).every(c => c.frames.every(f => f.glError === 0)),
    no_external_requests: requests.every(u => u.startsWith(origin + '/') || u.startsWith('blob:' + origin + '/') || u.startsWith('data:')),
    two_character_draws: report.stills.beauty.calls === 3, review_video_under_2_mib: vbytes > 20000 && vbytes < 2 * 1048576};
  await writeFile(path.join(out, 'browser-inspection.json'), JSON.stringify(report, null, 2) + '\n');
  const failures = Object.entries(report.checks).filter(([, v]) => !v).map(([k]) => k);
  console.log(JSON.stringify({asset: id, glb_sha256: report.glb_sha256, browser: report.browser, failures, video_bytes: vbytes, clips: Object.fromEntries(Object.entries(report.clips).map(([k, c]) => [k, c.distinct_rasters]))}));
  if (failures.length) process.exitCode = 1;
} finally { await browser?.close(); await new Promise(r => server.close(r)); }
