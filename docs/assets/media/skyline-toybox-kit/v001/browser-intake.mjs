// Inspect the exact GLBs in the bundled Three.js-based model-viewer.
// Run from this checkout: node docs/assets/media/skyline-toybox-kit/v001/browser-intake.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const directory=path.dirname(fileURLToPath(import.meta.url));
const vendor=path.resolve(directory,'../../../../javascripts/vendor/model-viewer-4.3.1.min.mjs');
const names=['block-tower','safety-rail','windup-lantern'];
const construction=JSON.parse(await fs.readFile(path.join(directory,'construction-measurements.json')));
const server=http.createServer(async(request,response)=>{
  const url=new URL(request.url,'http://127.0.0.1');
  try{
    if(url.pathname==='/'){
      const name=names.includes(url.searchParams.get('asset'))?url.searchParams.get('asset'):names[0];
      response.setHeader('Content-Type','text/html');
      response.end(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;background:#e8e1d2}model-viewer{width:100%;height:100%}</style><script type="module" src="/model-viewer.mjs"></script></head><body><model-viewer src="/${name}.glb" alt="WO096 technical model check" camera-controls interaction-prompt="none" environment-image="neutral" exposure="1" shadow-intensity=".8" camera-orbit="32deg 74deg auto"></model-viewer></body></html>`);
    }else if(url.pathname==='/model-viewer.mjs'){
      response.setHeader('Content-Type','text/javascript');response.end(await fs.readFile(vendor));
    }else if(names.some(name=>url.pathname==='/'+name+'.glb')){
      response.setHeader('Content-Type','model/gltf-binary');response.end(await fs.readFile(path.join(directory,path.basename(url.pathname))));
    }else if(url.pathname==='/favicon.ico'){response.writeHead(204);response.end();}
    else{response.writeHead(404);response.end();}
  }catch(error){response.writeHead(500);response.end(String(error));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1000,height:850},deviceScaleFactor:1});
  const errors=[],failedRequests=[],consoleErrors=[],requests=[],inspected=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  page.on('request',r=>requests.push(r.url()));
  for(const name of names){
    await page.goto(origin+'/?asset='+name);
    await page.waitForFunction(()=>document.querySelector('model-viewer')?.loaded===true,{timeout:30000});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.screenshot({path:path.join(directory,name+'-browser.png')});
    const record=await page.evaluate(async name=>{
      const model=document.querySelector('model-viewer');
      const bytes=await(await fetch('/'+name+'.glb')).arrayBuffer();
      const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
      return {asset:name,loaded:model.loaded,dimensions:model.getDimensions(),center:model.getBoundingBoxCenter(),
        availableAnimations:model.availableAnimations,materials:model.model.materials.map(m=>m.name),sha256,
        screenshot:name+'-browser.png',cameraOrbit:model.getCameraOrbit().toString()};
    },name);
    const expected=construction.props[name].authoringBoundsZUp.size;
    const localHash=createHash('sha256').update(await fs.readFile(path.join(directory,name+'.glb'))).digest('hex');
    const near=(a,b)=>Math.abs(a-b)<.0001;
    record.checks={loaded:record.loaded,exactGlbHash:record.sha256===localHash,
      yUpDimensions:near(record.dimensions.x,expected[0])&&near(record.dimensions.y,expected[2])&&near(record.dimensions.z,expected[1]),
      floorCentered:near(record.center.x,0)&&near(record.center.z,0)&&near(record.center.y-record.dimensions.y/2,0),
      static:record.availableAnimations.length===0,materialCount:record.materials.length===construction.props[name].materials.length};
    inspected.push(record);
    if(Object.values(record.checks).some(value=>!value))process.exitCode=1;
  }
  const report={workOrder:'WO096',browser:browser.version(),viewer:'model-viewer 4.3.1 (bundled, Three.js-based)',
    renderer:'Chromium headless / software WebGL (SwiftShader)',viewportPixels:[1000,850],
    tested:'Exact exported static GLBs with verified hashes, Y-up dimensions, origins and visible materials',
    limitation:'Isolated desktop browser rendering; not physical Safari, gameplay performance or owner approval.',
    inspected,pageErrors:errors,failedRequests,consoleErrors,
    externalRequests:requests.filter(url=>!url.startsWith(origin+'/')&&!url.startsWith('blob:'+origin+'/')&&!url.startsWith('data:'))};
  await fs.writeFile(path.join(directory,'browser-report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  if(errors.length||failedRequests.length||consoleErrors.length||report.externalRequests.length)process.exitCode=1;
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
