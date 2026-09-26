/** WO111 exact GLB Chromium stills and later motion sampling; no shared browser. */
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
const r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(800,900);r.outputColorSpace=T.SRGBColorSpace;r.setClearColor(0xd5d5c5);r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.0;document.body.append(r.domElement);
const s=new T.Scene();s.add(new T.HemisphereLight(0xfff0d8,0x657084,2));for(const [xyz,c,i] of [[[-3,4,-4],0xffe2b8,3],[[3,3,-1],0xc7d9ff,1.4],[[1,4,3],0xffd195,2]]){const l=new T.DirectionalLight(c,i);l.position.set(...xyz);s.add(l)}
const floor=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:0xc7c8b7,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.006;s.add(floor);
const c=new T.OrthographicCamera(-1.48,1.48,1.665,-1.665,.01,30);const g=await new GLTFLoader().loadAsync('/asset.glb');s.add(g.scene);const m=new T.AnimationMixer(g.scene);
window.draw=(view='beauty',clip=null,fraction=0,scale=1)=>{m.stopAllAction();if(clip){const a=m.clipAction(g.animations.find(a=>a.name===clip));a.setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();m.setTime(a.getClip().duration*fraction)}g.scene.updateMatrixWorld(true);const v={front:[0,1.27,-6],side:[6,1.27,0],back:[0,1.27,6],beauty:[3.1,2.01,-6],detail:[4,1.67,-5],hinge:[4,1.67,5]}[view];c.position.set(...v);c.lookAt(0,view==='detail'||view==='hinge'?1.80:1.27,0);c.zoom=scale*(view==='detail'||view==='hinge'?2.25:1);c.updateProjectionMatrix();r.render(s,c);return {clips:g.animations.map(a=>({name:a.name,duration:a.duration})),calls:r.info.render.calls,triangles:r.info.render.triangles,glError:r.getContext().getError(),webglVersion:r.getContext().getParameter(r.getContext().VERSION),pose:g.scene.getObjectByName('hand_L').getWorldPosition(new T.Vector3()).toArray()}};
window.playClip=async(clip,scale=1)=>{window.draw('beauty',clip,0,scale);const duration=g.animations.find(a=>a.name===clip).duration,start=performance.now(),poses=[];let previous=start;while((performance.now()-start)/1000<duration){await new Promise(requestAnimationFrame);const now=performance.now();m.update(Math.min(.1,(now-previous)/1000));previous=now;g.scene.updateMatrixWorld(true);r.render(s,c);poses.push({time_s:(now-start)/1000,hand:g.scene.getObjectByName('hand_L').getWorldPosition(new T.Vector3()).toArray()})}return {elapsed_s:(performance.now()-start)/1000,frames:poses.length,poses,glError:r.getContext().getError(),scale}};window.ready=true;window.draw();</script>`;
const server=createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end(html)}const f=req.url==='/asset.glb'?file:path.join(repo,'node_modules',req.url.slice(1));res.setHeader('Content-Type',req.url==='/asset.glb'?'model/gltf-binary':'text/javascript');res.end(await readFile(f))}catch(e){res.writeHead(404);res.end(String(e))}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[],requests=[],httpErrors=[],warnings=[];
const origin='http://127.0.0.1:'+server.address().port;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:800,height:900}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text())});
 page.on('request',r=>requests.push(r.url()));page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));page.on('response',r=>{if(r.status()>=400)httpErrors.push({url:r.url(),status:r.status()})});
 await page.goto(origin,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.ready);
 for(const view of ['front','side','back','beauty']){await page.evaluate(view=>window.draw(view),view);await page.screenshot({path:path.join(out,view+'.png')})}
 const report=await page.evaluate(()=>window.draw());report.clips={};
 if(process.argv.includes('--early')){
 report.errors=errors;report.warnings=warnings;report.httpErrors=httpErrors;report.requests=requests;report.glb_sha256=createHash('sha256').update(await readFile(file)).digest('hex');await writeFile(path.join(out,'preview-browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));await browser.close();await new Promise(r=>server.close(r));process.exit(0);
}
 const composites=[];
 let row=0;
 for(const clip of ['idle','move','attack','hit','defeat']){
  const frames=[];
  for(const [col,fraction] of [0,.3,.625,1].entries()){
   const result=await page.evaluate(({clip,fraction})=>window.draw('beauty',clip,fraction),{clip,fraction});
   const png=await page.screenshot({path:path.join(out,clip+'-'+String(fraction).replace('.','p')+'.png')});
   frames.push({fraction,...result,raster_sha256:createHash('sha256').update(png).digest('hex')});
   const tile=await sharp(png).resize(320,360).png().toBuffer();composites.push({input:tile,left:col*320,top:row*396+36});
   const label=Buffer.from('<svg width="320" height="36"><rect width="320" height="36" fill="#211f25"/><text x="12" y="24" fill="#e3dccb" font-size="17" font-family="sans-serif">'+clip+' · '+String(fraction*100)+'%</text></svg>');
   composites.push({input:label,left:col*320,top:row*396});
  }
  const smallFrames=[];
  for(const fraction of [0,.3,.625,1]){
   const result=await page.evaluate(({clip,fraction})=>window.draw('beauty',clip,fraction,.35),{clip,fraction});
   const png=await page.screenshot({path:path.join(out,clip+'-small-'+String(fraction).replace('.','p')+'.png')});
   smallFrames.push({fraction,...result,raster_sha256:createHash('sha256').update(png).digest('hex')});
  }
  const playback=[];
  for(const scale of [1,.35])playback.push(await page.evaluate(({clip,scale})=>window.playClip(clip,scale),{clip,scale}));
  report.clips[clip]={duration_s:frames[0].clips.find(c=>c.name===clip).duration,frames,distinct_rasters:new Set(frames.map(f=>f.raster_sha256)).size,small_frames:smallFrames,small_distinct_rasters:new Set(smallFrames.map(f=>f.raster_sha256)).size,actual_realtime_playback:playback};row++;
 }
 await sharp({create:{width:1280,height:1980,channels:4,background:'#211f25'}}).composite(composites).png().toFile(path.join(out,'motion-contact-sheet.png'));
 await sharp(path.join(out,'motion-contact-sheet.png')).extract({left:0,top:792,width:1280,height:396}).png().toFile(path.join(out,'attack-strip.png'));
 const smallAttack=[];
 for(const [col,fraction] of [0,.3,.625,1].entries()){
  const png=await readFile(path.join(out,'attack-small-'+String(fraction).replace('.','p')+'.png'));
  smallAttack.push({input:await sharp(png).extract({left:180,top:250,width:440,height:400}).png().toBuffer(),left:col*440,top:36});
  smallAttack.push({input:Buffer.from('<svg width="440" height="36"><rect width="440" height="36" fill="#211f25"/><text x="12" y="24" fill="#e3dccb" font-size="17" font-family="sans-serif">35% gameplay scale · '+String(fraction*100)+'%</text></svg>'),left:col*440,top:0});
 }
 await sharp({create:{width:1760,height:436,channels:4,background:'#211f25'}}).composite(smallAttack).png().toFile(path.join(out,'attack-gameplay-scale.png'));
 for(const view of ['front','side'])for(const [label,fraction] of [['windup',.42],['contact',.625],['recovery',1]]){
  await page.evaluate(({view,fraction})=>window.draw(view,'attack',fraction),{view,fraction});await page.screenshot({path:path.join(out,'attack-'+view+'-'+label+'.png')});
 }
 await page.evaluate(()=>window.draw('side','defeat',1));await page.screenshot({path:path.join(out,'defeat-side-held.png')});
 report.errors=errors;report.warnings=warnings;report.httpErrors=httpErrors;report.requests=requests;report.browser=browser.version();
 report.glb_sha256=createHash('sha256').update(await readFile(file)).digest('hex');
 report.renderer='Chromium headless ANGLE SwiftShader, real WebGL raster; no physical device claim';
 report.checks={five_clips:Object.keys(report.clips).length===5,every_clip_changes_raster:Object.values(report.clips).every(c=>c.distinct_rasters>1),every_small_clip_changes_raster:Object.values(report.clips).every(c=>c.small_distinct_rasters>1),actual_playback_all_clips_both_scales:Object.values(report.clips).every(c=>c.actual_realtime_playback.length===2&&c.actual_realtime_playback.every(p=>p.frames>=4&&p.elapsed_s>=c.duration_s&&p.glError===0)),zero_console_errors:errors.length===0,zero_http_errors:httpErrors.length===0,zero_webgl_errors:report.glError===0&&Object.values(report.clips).every(c=>c.frames.every(f=>f.glError===0)),no_external_requests:requests.every(u=>u.startsWith(origin+'/')||u.startsWith('blob:'+origin+'/')||u.startsWith('data:')),two_character_draws:report.calls===3};
 await writeFile(path.join(out,'browser-inspection.json'),JSON.stringify(report,null,2)+'\n');
 const failures=Object.entries(report.checks).filter(([,v])=>!v).map(([k])=>k);console.log(JSON.stringify({glb_sha256:report.glb_sha256,browser:report.browser,failures,clips:Object.fromEntries(Object.entries(report.clips).map(([n,c])=>[n,{duration:c.duration_s,distinct:c.distinct_rasters}]))}));if(failures.length)process.exitCode=1;
}finally{await browser?.close();await new Promise(r=>server.close(r));}
