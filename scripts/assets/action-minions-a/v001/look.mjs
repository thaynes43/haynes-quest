/** Action minions A: quick exact-GLB Chromium stills for authoring iteration (not evidence).
 * node look.mjs <glb> <outdir> [clip fraction ...]   run from the repo root (serves node_modules/three).
 * Writes front/side/back/threequarter/beauty (+ clip@fraction beauty frames) and a 3x2 grid. */
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import sharp from 'sharp';
const repo=process.cwd(),file=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]);await mkdir(out,{recursive:true});
const extra=process.argv.slice(4);const shots=[];for(let i=0;i<extra.length;i+=2)shots.push([extra[i],+extra[i+1]]);
const html=`<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><style>body{margin:0;background:#e9e0cf}</style><script type="importmap">{"imports":{"three":"/three/build/three.module.js"}}</script><script type="module">
import * as T from 'three';import {GLTFLoader} from '/three/examples/jsm/loaders/GLTFLoader.js';
const r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(700,760);r.outputColorSpace=T.SRGBColorSpace;r.setClearColor(0xe9e0cf);r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.05;document.body.append(r.domElement);
const s=new T.Scene();s.add(new T.HemisphereLight(0xfff3e0,0x6f7480,2.1));for(const [xyz,c,i] of [[[-3,4,-4],0xffe6c4,2.6],[[3,3,-1],0xd0deff,1.2],[[1,4,3],0xffd7a0,1.6]]){const l=new T.DirectionalLight(c,i);l.position.set(...xyz);s.add(l)}
const floor=new T.Mesh(new T.CircleGeometry(3,48),new T.MeshStandardMaterial({color:0xd8cfbd,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.002;s.add(floor);
const g=await new GLTFLoader().loadAsync('/asset.glb');s.add(g.scene);const m=new T.AnimationMixer(g.scene);
const box=new T.Box3().setFromObject(g.scene);const H=Math.max(1.2,box.max.y);const c=new T.OrthographicCamera(-H*.62,H*.62,H*.67,-H*.67,.01,40);
const views={front:[0,H*.5,-8],side:[8,H*.5,0],back:[0,H*.5,8],threequarter:[5.657,H*.5,-5.657],beauty:[4.6,3.4,-6.6],left:[-8,H*.5,0],top:[0.01,9,-0.5]};
window.draw=(view='beauty',clip=null,fraction=0,zoom=1)=>{m.stopAllAction();if(clip){const a=m.clipAction(g.animations.find(a=>a.name===clip));a.setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();m.setTime(a.getClip().duration*fraction)}g.scene.updateMatrixWorld(true);c.position.set(...views[view]);c.lookAt(0,H*.5,0);c.zoom=zoom*(view==='beauty'?.95:1);c.updateProjectionMatrix();r.render(s,c);return {calls:r.info.render.calls,tris:r.info.render.triangles}};window.ready=true;</script>`;
const server=createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end(html)}const f=req.url==='/asset.glb'?file:path.join(repo,'node_modules',req.url.slice(1));res.setHeader('Content-Type',req.url==='/asset.glb'?'model/gltf-binary':'text/javascript');res.end(await readFile(f))}catch(e){res.writeHead(404);res.end(String(e))}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[];
try{browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:700,height:760}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.ready,null,{timeout:120000});
 const names=[];for(const v of ['front','side','back','threequarter','beauty','left']){await page.evaluate(v=>window.draw(v),v);await page.screenshot({path:path.join(out,v+'.png')});names.push(v)}
 for(const [spec,f] of shots){const [clip,view='beauty']=spec.split('@');const n=clip+'-'+view+'-'+String(f).replace('.','p');await page.evaluate(([c,f,v])=>window.draw(v,c,f),[clip,f,view]);await page.screenshot({path:path.join(out,n+'.png')});names.push(n)}
 const tiles=await Promise.all(names.map(async n=>sharp(path.join(out,n+'.png')).resize(350,380).png().toBuffer()));
 const cols=Math.min(4,names.length),rows=Math.ceil(names.length/cols);
 await sharp({create:{width:cols*350,height:rows*380,channels:3,background:'#e9e0cf'}}).composite(tiles.map((input,i)=>({input,left:(i%cols)*350,top:Math.floor(i/cols)*380}))).png().toFile(path.join(out,'grid.png'));
 console.log(JSON.stringify({errors,names}));
}finally{await browser?.close();server.close()}
