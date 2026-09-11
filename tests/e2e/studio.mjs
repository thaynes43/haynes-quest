import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
const base = process.env.QUEST_E2E_URL ?? 'http://127.0.0.1:4173';
const inventory = [
  ['storybook-reference', 0, 0], ['traveler-infant', 1, 0], ['traveler-child', 1, 0],
  ['memory-keepsake', 1, 0], ['clearing-path-kit', 3, 0], ['clearing-tree', 1, 0],
  ['clearing-stone', 1, 0], ['arrival-landmark', 1, 0],
  ['memory-collected', 0, 1], ['ability-unlocked', 0, 1], ['movement-landed', 0, 1], ['ui-confirmed', 0, 1],
];
const browser = await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context = await browser.newContext({viewport:{width:1280,height:900}});
const evidence = {date:new Date().toISOString(), base, browser:browser.version(), pages:[], pageErrors:[], externalRequests:[], physicalDevices:'not tested', listeningReview:'not performed'};
const seenMedia = new Map();
await fs.mkdir('test-results/studio', {recursive:true});
try {
  for (const [id, models, audio] of inventory) {
    const page=await context.newPage();
    page.on('pageerror', e=>evidence.pageErrors.push(e.message));
    page.on('request', r=>{if (new URL(r.url()).origin!==new URL(base).origin) evidence.externalRequests.push(r.url());});
    const response=await page.goto(`${base}/studio/assets/reviews/${id}/v001.html`);
    assert.equal(response.status(),200,id);
    assert.equal(await page.locator('model-viewer').count(),models,`${id}: required GLB viewers`);
    assert.equal(await page.locator('audio').count(),audio,`${id}: required audio audition`);
    assert.equal(await page.locator('video[autoplay],audio[autoplay],model-viewer[autoplay]').count(),0);
    const report={id, models:[], audio:[], media:[]};
    for (let index=0; index<models; index++) {
      const viewer=page.locator('model-viewer').nth(index);
      await viewer.scrollIntoViewIfNeeded();
      await viewer.evaluate(v=>new Promise((resolve,reject)=>{
        if(v.loaded) return resolve();
        const timer=setTimeout(()=>reject(new Error('GLB load timeout')),20000);
        v.addEventListener('load',()=>{clearTimeout(timer);resolve();},{once:true});
        v.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('GLB load error'));},{once:true});
      }));
      const model=await viewer.evaluate(v=>({src:v.src,dimensions:v.getDimensions(),clips:v.availableAnimations,paused:v.paused}));
      assert.ok(Object.values(model.dimensions).every(n=>Number.isFinite(n)&&n>0));
      assert.equal(model.paused,true);
      for(const clip of model.clips) {
        await viewer.evaluate((v,name)=>{v.animationName=name;v.currentTime=0;v.play();},clip);
        await page.waitForTimeout(180);
        const running=await viewer.evaluate(v=>({paused:v.paused,time:v.currentTime}));
        assert.equal(running.paused,false);assert.ok(running.time>0);
        await viewer.evaluate(v=>v.pause());
        const paused=await viewer.evaluate(v=>v.currentTime);
        await page.waitForTimeout(100);
        assert.equal(await viewer.evaluate(v=>v.currentTime),paused);
      }
      report.models.push(model);
    }
    const media=await page.locator('main').evaluate(el=>{
      const urls=[];
      for(const node of el.querySelectorAll('img,model-viewer,video,audio,source,a')) {
        const raw=node.getAttribute('src')??node.getAttribute('href');
        if(raw && /\.(glb|png|jpg|jpeg|svg|mp4|wav)(?:$|[?#])/i.test(raw)) urls.push(new URL(raw,location.href).href);
        const poster=node.getAttribute('poster');if(poster) urls.push(new URL(poster,location.href).href);
      }
      return [...new Set(urls)];
    });
    for(const url of media) {
      assert.equal(new URL(url).origin,new URL(base).origin);
      if(!seenMedia.has(url)) {
        const downloaded=await context.request.get(url);
        assert.equal(downloaded.status(),200,`download ${url}`);
        const bytes=await downloaded.body();assert.ok(bytes.length>0);
        const mime=downloaded.headers()['content-type']??'';
        if(url.endsWith('.glb')) assert.match(mime,/model\/gltf-binary|application\/octet-stream/);
        if(url.endsWith('.wav')) assert.match(mime,/audio\/(wav|wave|x-wav)/);
        if(url.endsWith('.mp4')) assert.match(mime,/video\/mp4/);
        seenMedia.set(url,{url,bytes:bytes.length,mime,sha256:createHash('sha256').update(bytes).digest('hex')});
      }
      report.media.push(seenMedia.get(url));
    }
    for(let index=0;index<audio;index++) {
      report.audio.push(await page.locator('audio').nth(index).evaluate(async player=>{
        const url=player.querySelector('source')?.src??player.src;
        const ac=new AudioContext();
        try {const decoded=await ac.decodeAudioData(await(await fetch(url)).arrayBuffer());return{url,duration:decoded.duration,channels:decoded.numberOfChannels,sampleRate:decoded.sampleRate,paused:player.paused};}
        finally {await ac.close();}
      }));
      assert.equal(report.audio[index].paused,true);assert.ok(report.audio[index].duration>0);
    }
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`${id}: portrait overflow`);
    if(models) await page.locator('model-viewer').first().scrollIntoViewIfNeeded();
    else if(audio) await page.locator('audio').first().scrollIntoViewIfNeeded();
    await page.screenshot({path:`test-results/studio/${id}-phone.png`});
    evidence.pages.push(report);
    await page.close();
  }
  assert.equal(evidence.pages.reduce((sum,p)=>sum+p.models.length,0),9);
  assert.equal(evidence.pages.reduce((sum,p)=>sum+p.audio.length,0),4);
  assert.deepEqual(evidence.pageErrors,[]);assert.deepEqual(evidence.externalRequests,[]);
  console.log(JSON.stringify({pages:evidence.pages.length,models:9,audio:4,media:seenMedia.size,pageErrors:0,browser:evidence.browser}));
} finally {
  await fs.writeFile('test-results/studio/evidence.json',JSON.stringify(evidence,null,2));
  await browser.close();
}
