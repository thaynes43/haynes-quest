/** WO098 exact GLB Chromium stills and later motion sampling; no shared browser. */
import {createServer} from 'node:http';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
const repo=process.cwd(), file=path.resolve(process.argv[2]), out=path.resolve(process.argv[3]);
await mkdir(out,{recursive:true});
const html=`<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><style>body{margin:0;background:#282731}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/three/build/three.module.js"}}</script><script type="module">
import * as T from 'three';import {GLTFLoader} from '/three/examples/jsm/loaders/GLTFLoader.js';
const r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(800,900);r.outputColorSpace=T.SRGBColorSpace;r.setClearColor(0x282731);r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.0;document.body.append(r.domElement);
const s=new T.Scene();s.add(new T.HemisphereLight(0xfff0d8,0x657084,2));for(const [xyz,c,i] of [[[-3,4,-4],0xffe2b8,3],[[3,3,-1],0xc7d9ff,1.4],[[1,4,3],0xffd195,2]]){const l=new T.DirectionalLight(c,i);l.position.set(...xyz);s.add(l)}
const floor=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:0x33313c,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.006;s.add(floor);
const c=new T.OrthographicCamera(-1.244,1.244,1.4,-1.4,.01,30);const g=await new GLTFLoader().loadAsync('/asset.glb');s.add(g.scene);const m=new T.AnimationMixer(g.scene);
window.draw=(view='beauty',clip=null,fraction=0)=>{m.stopAllAction();if(clip){const a=m.clipAction(g.animations.find(a=>a.name===clip));a.setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();m.setTime(a.getClip().duration*fraction)}g.scene.updateMatrixWorld(true);const v={front:[0,1.08,-6],side:[6,1.08,0],back:[0,1.08,6],beauty:[3.1,2.15,-6]}[view];c.position.set(...v);c.lookAt(0,1.08,0);c.updateProjectionMatrix();r.render(s,c);return {clips:g.animations.map(a=>({name:a.name,duration:a.duration})),calls:r.info.render.calls,triangles:r.info.render.triangles,glError:r.getContext().getError()}};
window.ready=true;window.draw();</script>`;
const server=createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end(html)}const f=req.url==='/asset.glb'?file:path.join(repo,'node_modules',req.url.slice(1));res.setHeader('Content-Type',req.url==='/asset.glb'?'model/gltf-binary':'text/javascript');res.end(await readFile(f))}catch(e){res.writeHead(404);res.end(String(e))}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[];
try{browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:800,height:900}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.ready);for(const view of ['front','side','back','beauty']){await page.evaluate(view=>window.draw(view),view);await page.screenshot({path:path.join(out,view+'.png')})}const report=await page.evaluate(()=>window.draw());report.errors=errors;report.browser=browser.version();await writeFile(path.join(out,'preview-browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}finally{await browser?.close();await new Promise(r=>server.close(r));}
