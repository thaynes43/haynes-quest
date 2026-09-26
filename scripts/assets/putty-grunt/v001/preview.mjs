/** WO111 putty-grunt: exact-GLB Chromium stills, gameplay-camera views, motion contact sheet, attack strips and
 * realtime playback.   node preview.mjs <glb> <outdir> [--early]   (run from the repo root)
 * Sheet-matched orthographic views (900 x 900, half-height 0.85 m = 529.4 px/m, camera target 0.75 m above the root
 * on the root axis, so the root sits at column 450 in every view): front, side (character faces viewer's right),
 * back, three-quarter (front-right, 45 deg) and an elevated beauty view. The main stills show the sheet guard,
 * recreated at idle 0 s (the bind pose is the rig-friendly A-pose; bind-*.png show it). gameplay-*.png use the game's
 * 48 deg perspective follow camera about 7.9 m out and 2.62 m high, looking at 0.9 m. No shared browser; no
 * physical-device claim. Adapted from the inator-monster, mischief-kitten and rival-mayor previews. */
import {createServer} from 'node:http';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const repo=process.cwd(), file=path.resolve(process.argv[2]), out=path.resolve(process.argv[3]);
await mkdir(out,{recursive:true});
const html=`<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><style>body{margin:0;background:#d5d5c5}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/three/build/three.module.js"}}</script><script type="module">
import * as T from 'three';import {GLTFLoader} from '/three/examples/jsm/loaders/GLTFLoader.js';
const r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(900,900);r.outputColorSpace=T.SRGBColorSpace;r.setClearColor(0xd5d5c5);r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.0;document.body.append(r.domElement);
const s=new T.Scene();s.add(new T.HemisphereLight(0xfff0d8,0x657084,2));for(const [xyz,c,i] of [[[-3,4,-4],0xffe2b8,3],[[3,3,-1],0xc7d9ff,1.4],[[1,4,3],0xffd195,2]]){const l=new T.DirectionalLight(c,i);l.position.set(...xyz);s.add(l)}
const floor=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:0xc7c8b7,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.004;s.add(floor);
const H=.85,oc=new T.OrthographicCamera(-H,H,H,-H,.01,60),pc=new T.PerspectiveCamera(48,1,.08,100);const g=await new GLTFLoader().loadAsync('/asset.glb');s.add(g.scene);const m=new T.AnimationMixer(g.scene);
const views={front:[0,.75,-8],side:[8,.75,0],back:[0,.75,8],threequarter:[5.657,.75,-5.657],beauty:[4.2,2.9,-7.2]};
const targets={front:[0,.75,0],side:[0,.75,0],back:[0,.75,0],threequarter:[0,.75,0],beauty:[0,.65,0]};
const game=az=>{const a=az*Math.PI/180;return [-Math.sin(a)*7.9,2.62,-Math.cos(a)*7.9]};
const probe=()=>['fist_R','fist_L','head','hips','foot_R','antenna_2'].map(n=>[n,g.scene.getObjectByName(n).getWorldPosition(new T.Vector3()).toArray()]);
let cam=oc;
const aim=(view,scale)=>{if(view.startsWith('game')){cam=pc;cam.position.set(...game(+view.slice(4)));cam.lookAt(0,.9,0)}else{cam=oc;cam.position.set(...views[view]);cam.lookAt(...targets[view]);oc.zoom=scale}cam.updateProjectionMatrix()};
window.draw=(view='beauty',clip='idle',fraction=0,scale=1)=>{m.stopAllAction();const a=m.clipAction(g.animations.find(a=>a.name===clip));a.setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();m.setTime(a.getClip().duration*fraction);g.scene.updateMatrixWorld(true);
 aim(view,scale);r.render(s,cam);return {clips:g.animations.map(a=>({name:a.name,duration:a.duration})),calls:r.info.render.calls,triangles:r.info.render.triangles,glError:r.getContext().getError(),webglVersion:r.getContext().getParameter(r.getContext().VERSION),pose:Object.fromEntries(probe())}};
window.restLocal=[];g.scene.traverse(o=>{if(o.isBone)window.restLocal.push([o,o.position.clone(),o.quaternion.clone(),o.scale.clone()])});
window.drawRest=(view)=>{m.stopAllAction();for(const [o,p,q,sc] of window.restLocal){o.position.copy(p);o.quaternion.copy(q);o.scale.copy(sc)}g.scene.updateMatrixWorld(true);aim(view,1);r.render(s,cam);return {calls:r.info.render.calls,glError:r.getContext().getError()}};
window.playClip=async(clip,scale=1)=>{window.draw('beauty',clip,0,scale);const duration=g.animations.find(a=>a.name===clip).duration,start=performance.now(),poses=[];let previous=start;while((performance.now()-start)/1000<duration){await new Promise(requestAnimationFrame);const now=performance.now();m.update(Math.min(.1,(now-previous)/1000));previous=now;g.scene.updateMatrixWorld(true);r.render(s,cam);poses.push({time_s:(now-start)/1000,fist_R:g.scene.getObjectByName('fist_R').getWorldPosition(new T.Vector3()).toArray()})}return {elapsed_s:(performance.now()-start)/1000,frames:poses.length,poses,glError:r.getContext().getError(),scale}};window.ready=true;window.draw('beauty','idle',0);</script>`;
const server=createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end(html)}const f=req.url==='/asset.glb'?file:path.join(repo,'node_modules',req.url.slice(1));res.setHeader('Content-Type',req.url==='/asset.glb'?'model/gltf-binary':'text/javascript');res.end(await readFile(f))}catch(e){res.writeHead(404);res.end(String(e))}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[],requests=[],httpErrors=[],warnings=[];
const origin='http://127.0.0.1:'+server.address().port;
const BEATS={idle:[[0,'sheet guard'],[.30,'hi-yah feint'],[.50,'bounce squash'],[.83,'slow blink']],move:[[0,'right foot lands'],[.25,'waddle, arms pump'],[.5,'left foot lands'],[.75,'waddle, arms pump']],
 attack:[[.275,'fists up, leaning back'],[.45,'teeters onto its toes'],[.625,'contact 1.25 s, fists squash'],[.80,'windmills, nearly falls']],hit:[[0,'guard'],[.10,'squashed, belly dent'],[.40,'wobbles back'],[1,'settled']],defeat:[[.12,'teeters backwards'],[.35,'melting'],[.55,'puddle, antenna wiggles'],[1,'held: flopped clay puddle']]};
const tag=f=>String(f).replace('.','p');
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:900,height:900}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text())});
 page.on('request',r=>requests.push(r.url()));page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));page.on('response',r=>{if(r.status()>=400)httpErrors.push({url:r.url(),status:r.status()})});
 await page.goto(origin,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.ready,null,{timeout:120000});
 for(const view of ['front','side','back','threequarter','beauty']){await page.evaluate(view=>window.draw(view,'idle',0),view);await page.screenshot({path:path.join(out,view+'.png')});await page.evaluate(view=>window.drawRest(view),view);await page.screenshot({path:path.join(out,'bind-'+view+'.png')})}
 const gameViews=[];for(const az of [0,45,90,180,-90]){const v='game'+az;await page.evaluate(v=>window.draw(v,'idle',0),v);const png=await page.screenshot({path:path.join(out,'gameplay-'+String(az).replace('-','m')+'.png')});gameViews.push({azimuth_deg:az,raster_sha256:createHash('sha256').update(png).digest('hex')})}
 const report=await page.evaluate(()=>window.draw('beauty','idle',0));report.clips={};report.gameplay_views=gameViews;
 if(process.argv.includes('--early')){
  report.errors=errors;report.glb_sha256=createHash('sha256').update(await readFile(file)).digest('hex');await writeFile(path.join(out,'preview-browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({calls:report.calls,errors}));
 }else{
 const composites=[];let row=0;
 for(const clip of ['idle','move','attack','hit','defeat']){
  const frames=[];
  for(const [col,[fraction,label]] of BEATS[clip].entries()){
   const result=await page.evaluate(({clip,fraction})=>window.draw('beauty',clip,fraction),{clip,fraction});
   const png=await page.screenshot({path:path.join(out,clip+'-'+tag(fraction)+'.png')});
   frames.push({fraction,label,...result,raster_sha256:createHash('sha256').update(png).digest('hex')});
   composites.push({input:await sharp(png).resize(360,360).png().toBuffer(),left:col*360,top:row*396+36});
   composites.push({input:Buffer.from('<svg width="360" height="36"><rect width="360" height="36" fill="#211f25"/><text x="10" y="24" fill="#e3dccb" font-size="15" font-family="sans-serif">'+clip+' · '+(fraction*frames[0].clips.find(c=>c.name===clip).duration).toFixed(2)+' s · '+label+'</text></svg>'),left:col*360,top:row*396});
  }
  const smallFrames=[];
  for(const [fraction] of BEATS[clip]){
   const result=await page.evaluate(({clip,fraction})=>window.draw('beauty',clip,fraction,.35),{clip,fraction});
   const png=await page.screenshot({path:path.join(out,clip+'-small-'+tag(fraction)+'.png')});
   smallFrames.push({fraction,...result,raster_sha256:createHash('sha256').update(png).digest('hex')});
  }
  const playback=[];
  for(const scale of [1,.35])playback.push(await page.evaluate(({clip,scale})=>window.playClip(clip,scale),{clip,scale}));
  report.clips[clip]={duration_s:frames[0].clips.find(c=>c.name===clip).duration,frames,distinct_rasters:new Set(frames.map(f=>f.raster_sha256)).size,small_frames:smallFrames,small_distinct_rasters:new Set(smallFrames.map(f=>f.raster_sha256)).size,actual_realtime_playback:playback};row++;
 }
 await sharp({create:{width:1440,height:1980,channels:4,background:'#211f25'}}).composite(composites).png().toFile(path.join(out,'motion-contact-sheet.png'));
 await sharp(path.join(out,'motion-contact-sheet.png')).extract({left:0,top:792,width:1440,height:396}).png().toFile(path.join(out,'attack-strip.png'));
 const smallAttack=[];
 for(const [col,[fraction,label]] of BEATS.attack.entries()){
  const png=await readFile(path.join(out,'attack-small-'+tag(fraction)+'.png'));
  smallAttack.push({input:await sharp(png).extract({left:225,top:250,width:450,height:420}).png().toBuffer(),left:col*450,top:36});
  smallAttack.push({input:Buffer.from('<svg width="450" height="36"><rect width="450" height="36" fill="#211f25"/><text x="10" y="24" fill="#e3dccb" font-size="15" font-family="sans-serif">35% gameplay scale · '+(fraction*2).toFixed(2)+' s · '+label+'</text></svg>'),left:col*450,top:0});
 }
 await sharp({create:{width:1800,height:456,channels:4,background:'#211f25'}}).composite(smallAttack).png().toFile(path.join(out,'attack-gameplay-scale.png'));
 for(const view of ['front','side'])for(const [label,fraction] of [['overhead',.275],['teeter',.45],['contact',.625],['recovery',.80]]){
  await page.evaluate(({view,fraction})=>window.draw(view,'attack',fraction,.8),{view,fraction});await page.screenshot({path:path.join(out,'attack-'+view+'-'+label+'.png')});
 }
 for(const view of ['front','side','threequarter','beauty','game0']){await page.evaluate(view=>window.draw(view,'defeat',1),view);await page.screenshot({path:path.join(out,'defeat-'+view.replace('game0','gameplay')+'-held.png')});}
 report.errors=errors;report.warnings=warnings;report.httpErrors=httpErrors;report.requests=requests;report.browser=browser.version();
 report.glb_sha256=createHash('sha256').update(await readFile(file)).digest('hex');
 report.renderer='Chromium headless ANGLE SwiftShader, real WebGL raster; no physical device claim';
 report.checks={five_clips:Object.keys(report.clips).length===5,every_clip_changes_raster:Object.values(report.clips).every(c=>c.distinct_rasters>1),every_small_clip_changes_raster:Object.values(report.clips).every(c=>c.small_distinct_rasters>1),actual_playback_all_clips_both_scales:Object.values(report.clips).every(c=>c.actual_realtime_playback.length===2&&c.actual_realtime_playback.every(p=>p.frames>=4&&p.elapsed_s>=c.duration_s&&p.glError===0)),zero_console_errors:errors.length===0,zero_http_errors:httpErrors.length===0,zero_webgl_errors:report.glError===0&&Object.values(report.clips).every(c=>c.frames.every(f=>f.glError===0)),no_external_requests:requests.every(u=>u.startsWith(origin+'/')||u.startsWith('blob:'+origin+'/')||u.startsWith('data:')),floor_plus_two_opaque_draws:report.calls===3,gameplay_views_rendered:gameViews.length===5};
 await writeFile(path.join(out,'browser-inspection.json'),JSON.stringify(report,null,2)+'\n');
 const failures=Object.entries(report.checks).filter(([,v])=>!v).map(([k])=>k);console.log(JSON.stringify({glb_sha256:report.glb_sha256,browser:report.browser,failures,warnings:warnings.length,clips:Object.fromEntries(Object.entries(report.clips).map(([n,c])=>[n,{duration:c.duration_s,distinct:c.distinct_rasters}]))}));if(failures.length)process.exitCode=1;
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
