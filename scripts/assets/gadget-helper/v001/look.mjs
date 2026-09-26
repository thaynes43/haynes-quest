/** WO111 author review helper: exact-GLB close-up renders at arbitrary cameras/poses (not delivery evidence). */
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
const repo=process.cwd(), file=path.resolve(process.argv[2]), out=path.resolve(process.argv[3]), shots=JSON.parse(process.argv[4]);
await mkdir(out,{recursive:true});
const html=`<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><style>body{margin:0;background:#d5d5c5}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/three/build/three.module.js"}}</script><script type="module">
import * as T from 'three';import {GLTFLoader} from '/three/examples/jsm/loaders/GLTFLoader.js';
const r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(800,800);r.outputColorSpace=T.SRGBColorSpace;r.setClearColor(0xd5d5c5);r.toneMapping=T.ACESFilmicToneMapping;document.body.append(r.domElement);
const s=new T.Scene();s.add(new T.HemisphereLight(0xfff0d8,0x657084,2));for(const [xyz,c,i] of [[[-3,4,-4],0xffe2b8,3],[[3,3,-1],0xc7d9ff,1.4],[[1,4,3],0xffd195,2]]){const l=new T.DirectionalLight(c,i);l.position.set(...xyz);s.add(l)}
const floor=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:0xc7c8b7,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.006;s.add(floor);
const c=new T.OrthographicCamera(-1,1,1,-1,.01,30);const g=await new GLTFLoader().loadAsync('/asset.glb');s.add(g.scene);const m=new T.AnimationMixer(g.scene);
window.shot=({pos,target,half,clip,time})=>{m.stopAllAction();if(clip){const a=m.clipAction(g.animations.find(a=>a.name===clip));a.setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();m.setTime(time)}g.scene.updateMatrixWorld(true);c.left=-half;c.right=half;c.top=half;c.bottom=-half;c.position.set(...pos);c.lookAt(...target);c.updateProjectionMatrix();r.render(s,c);return true};window.ready=true;</script>`;
const server=createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end(html)}const f=req.url==='/asset.glb'?file:path.join(repo,'node_modules',req.url.slice(1));res.setHeader('Content-Type',req.url==='/asset.glb'?'model/gltf-binary':'text/javascript');res.end(await readFile(f))}catch(e){res.writeHead(404);res.end(String(e))}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const page=await browser.newPage({viewport:{width:800,height:800}});page.on('pageerror',e=>console.error(e.message));
await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.ready);
for(const [name,shot] of Object.entries(shots)){await page.evaluate(s=>window.shot(s),shot);await page.screenshot({path:path.join(out,name+'.png')})}
}finally{await browser.close();server.close()}
