/** Focused desktop/phone audit of the shipped cards and four model-viewer controls. */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const base = process.argv[2];
const out = path.resolve(process.argv[3]);
const ids = ['stacking-block-tower','toy-bus-garage','crib-rail-fence','giant-plush-ball'];
await mkdir(out,{recursive:true});
const report = { browser: '', physicalDevice: false, results: [], errors: [] };
const browser = await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  report.browser=browser.version();
  for (const [name,width,height] of [['desktop',1440,1000],['phone',390,844]]) {
    const context=await browser.newContext({viewport:{width,height},hasTouch:name==='phone'});
    const page=await context.newPage();
    page.on('pageerror',e=>report.errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
    page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
    await page.goto(base+'/assets/catalog.html',{waitUntil:'networkidle'});
    for(const id of ids){
      const card=page.locator(`[data-asset-id="${id}"]`);await card.scrollIntoViewIfNeeded();
      await card.locator('img').first().evaluate(img=>img.decode());
      assert.match(await card.innerText(),/Awaiting Tom's review/);
      await card.screenshot({path:path.join(out,`${name}-${id}-card.png`)});
    }
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'catalog overflow');
    await page.goto(base+'/assets/reviews/playroom-kit/v001.html',{waitUntil:'networkidle'});
    assert.equal(await page.locator('model-viewer').count(),4);
    for(const id of ids){
      const selector=`model-viewer[src$="/${id}.glb"]`;
      const viewer=page.locator(selector);await viewer.scrollIntoViewIfNeeded();
      await page.waitForFunction(s=>document.querySelector(s)?.loaded,selector,{timeout:30000});
      const state=await viewer.evaluate(v=>({loaded:v.loaded,animations:v.availableAnimations,src:v.getAttribute('src')}));
      assert.deepEqual(state.animations,[]);
      const box=await viewer.boundingBox();assert(box&&box.width>100&&box.height>100);
      await viewer.screenshot({path:path.join(out,`${name}-${id}-viewer.png`)});
      const before=await viewer.evaluate(v=>v.getCameraOrbit().theta);
      await page.mouse.move(box.x+box.width*.6,box.y+box.height*.5);await page.mouse.down();
      await page.mouse.move(box.x+box.width*.3,box.y+box.height*.5,{steps:10});await page.mouse.up();
      await page.waitForFunction(([s,a])=>Math.abs(document.querySelector(s).getCameraOrbit().theta-a)>.05,[selector,before]);
      report.results.push({viewport:name,id,loaded:state.loaded,static:true,orbitControl:true,viewerWidth:box.width});
    }
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'review overflow');
    await context.close();
  }
  assert.deepEqual(report.errors,[]);
  report.outcome='passed';
} catch(e) {report.outcome='failed';report.failure=String(e);throw e;}
finally {await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({outcome:report.outcome,viewers:report.results.length,errors:report.errors.length}));
