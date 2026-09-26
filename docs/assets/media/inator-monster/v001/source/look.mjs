/** WO111 inator-monster author review helper: exact-GLB renders at named cameras/poses (not delivery evidence).
 * node look.mjs <glb> <outdir> '<json {name:{view|pos,target,half,clip,time}}>'   (run from the repo root)
 * Named views match the sheet angles: front, side (character faces viewer's right), back, threequarter, beauty,
 * plus chase (above and behind, the gameplay follow camera). Adapted from the mischief-kitten look.mjs. */
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
const repo=process.cwd(), file=path.resolve(process.argv[2]), out=path.resolve(process.argv[3]), shots=JSON.parse(process.argv[4]);
await mkdir(out,{recursive:true});
const html=`<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><style>body{margin:0;background:#f5ebdc}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/three/build/three.module.js"}}</script><script type="module">
import * as T from 'three';import {GLTFLoader} from '/three/examples/jsm/loaders/GLTFLoader.js';
const r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(900,900);r.outputColorSpace=T.SRGBColorSpace;r.setClearColor(0xf5ebdc);r.toneMapping=T.ACESFilmicToneMapping;document.body.append(r.domElement);
const s=new T.Scene();s.add(new T.HemisphereLight(0xfff0d8,0x657084,2));for(const [xyz,c,i] of [[[-3,4,-4],0xffe2b8,3],[[3,3,-1],0xc7d9ff,1.4],[[1,4,3],0xffd195,2]]){const l=new T.DirectionalLight(c,i);l.position.set(...xyz);s.add(l)}
const floor=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:0xe6dcc8,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.004;s.add(floor);
const c=new T.OrthographicCamera(-1,1,1,-1,.01,60);const g=await new GLTFLoader().loadAsync('/asset.glb');s.add(g.scene);const m=new T.AnimationMixer(g.scene);
const V={front:[0,1.6,-12],side:[12,1.6,0],back:[0,1.6,12],threequarter:[8.485,1.6,-8.485],beauty:[6.2,4.4,-10.8],leftside:[-12,1.6,0],chase:[0,5.6,9.5]};
const TG={front:[0,1.62,0],side:[0,1.62,0.33],back:[0,1.62,0],threequarter:[0,1.62,0.2],beauty:[0,1.5,0.2],leftside:[0,1.62,0.33],chase:[0,1.9,0.2]};
window.shot=({view,pos,target,half,clip,time,persp})=>{m.stopAllAction();if(clip){const a=m.clipAction(g.animations.find(a=>a.name===clip));a.setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();m.setTime(time)}g.scene.updateMatrixWorld(true);half=half||1.8;
 let cam=c;if(persp){cam=new T.PerspectiveCamera(persp,1,.05,80)}else{c.left=-half;c.right=half;c.top=half;c.bottom=-half}
 cam.position.set(...(pos||V[view]));cam.lookAt(...(target||TG[view]||[0,1.6,0]));cam.updateProjectionMatrix();r.render(s,cam);return {calls:r.info.render.calls,triangles:r.info.render.triangles,err:r.getContext().getError()}};window.ready=true;</script>`;
const server=createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end(html)}const f=req.url==='/asset.glb'?file:path.join(repo,'node_modules',req.url.slice(1));res.setHeader('Content-Type',req.url==='/asset.glb'?'model/gltf-binary':'text/javascript');res.end(await readFile(f))}catch(e){res.writeHead(404);res.end(String(e))}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const page=await browser.newPage({viewport:{width:900,height:900}});page.on('pageerror',e=>console.error(e.message));page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.error(m.type(),m.text())});
await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.ready,null,{timeout:120000});
for(const [name,shot] of Object.entries(shots)){const r=await page.evaluate(s=>window.shot(s),shot);await page.screenshot({path:path.join(out,name+'.png')});console.log(name,JSON.stringify(r))}
}finally{await browser.close();server.close()}
