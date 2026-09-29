/** Bounded, reproducible A3 camera audit using the ordinary-input lockstep pilot.
 * Adds camera-only views at already-reached route checkpoints. It never changes
 * player state, level transforms, camera internals or scene assets. The temporary
 * harness stays beside its original so imports resolve, and is removed on exit.
 */
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
const repo=process.cwd();
const original=path.join(repo,'tests/e2e/family-world-lockstep.ts');
const temporary=path.join(repo,'tests/e2e/.rooftop-city-camera.generated.ts');
let text=await readFile(original,'utf8');
text=text.replace('const VIEWPORT = { width: 1280, height: 760 };','let VIEWPORT = { width: 1280, height: 760 };');
const needle = `      mark("screenshot", { file });
    };
    await shot("01-spawn");`;
const replacement = `      mark("screenshot", { file });
      if (["01-spawn","02-first-ordinary-fight","02-mid-climb","03-boss-arena"].includes(name)) {
        const player={...game!.live.position};
        const all=(document.decor??[]).filter(d=>["water-tower","rooftop-ac-unit","crane-hook","billboard-frame"].includes(d.kitPropId));
        const nearest=(id:string,n:number)=>all.filter(d=>d.kitPropId===id).sort((a,b)=>planar(a.position,player)-planar(b.position,player)).slice(0,n);
        const targets=name==="01-spawn"?nearest("water-tower",1):name==="02-first-ordinary-fight"?[...nearest("billboard-frame",1),...nearest("rooftop-ac-unit",1)]:name==="02-mid-climb"?[...nearest("crane-hook",1),...nearest("billboard-frame",1)]:nearest("water-tower",1);
        let dragged=0;
        const desktop={...VIEWPORT};
        try {
          for(const target of targets) {
            const yaw=Math.atan2(-(target.position.x-player.x),-(target.position.z-player.z));
            const px=Math.round(-yaw/CAMERA_YAW_PER_PIXEL);
            if(Math.abs(px-dragged)>=8){await game!.dragCamera(px-dragged);dragged=px;}
            for(let k=0;k<12;k++)await game!.step(FINE_MS);
            for(const vp of [{name:'desktop',width:1280,height:760},{name:'phone',width:390,height:844}]){
              VIEWPORT={width:vp.width,height:vp.height};
              await page!.setViewportSize(VIEWPORT);
              for(let k=0;k<8;k++)await game!.step(FINE_MS);
              const extra=shotDirectory+'/'+chapter.chapterId+'-'+name+'-'+target.id+'-'+vp.name+'.png';
              await game!.screenshot(extra);report.screenshots.push(extra);
              mark('rooftop-camera',{file:extra,viewport:vp.name,target:target.id,kitPropId:target.kitPropId,placement:target,player:game!.live.position,grounded:game!.live.grounded,supportId:game!.live.supportId,dragPixels:px});
            }
          }
        } finally {
          VIEWPORT=desktop;await page!.setViewportSize(VIEWPORT);
          if(Math.abs(dragged)>=8)await game!.dragCamera(-dragged);
          for(let k=0;k<12;k++)await game!.step(FINE_MS);
        }
      }
    };
    await shot("01-spawn");`;
if(!text.includes(needle))throw new Error('camera hook drifted; inspect harness before patching');
text=text.replace(needle,replacement);
// Match the existing family-world harness: skip only GPU draw/clear calls
// between inspection captures. Simulation, input and scene updates are unchanged.
text=text.replace('    await page.clock.install();', `    await page.addInitScript({content: \`(() => {
      globalThis.__questSkipDraw=false;
      for(const type of [globalThis.WebGL2RenderingContext,globalThis.WebGLRenderingContext]){
        if(!type)continue;
        for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced','drawRangeElements','clear']){
          const original=type.prototype[name];if(typeof original!=='function')continue;
          type.prototype[name]=function(...args){if(globalThis.__questSkipDraw)return;return original.apply(this,args);};
        }
      }
    })();\`});
    await page.clock.install();`);
text=text.replace('    await game.pause();', '    await game.pause();\n    await page.evaluate("globalThis.__questSkipDraw=true");');
text=text.replace('  async screenshot(path: string): Promise<void> {', '  async screenshot(path: string): Promise<void> {\n    await this.page.evaluate("globalThis.__questSkipDraw=false");');
text=text.replace('    await metrics(playScale);','    await metrics(playScale);\n    await this.page.evaluate("globalThis.__questSkipDraw=true");');
// The server uses real cooldown time. A faster page clock must not turn a
// legal simulated strike into an intentionally rejected early HTTP request.
text=text.replace('  async press(key: string): Promise<void> {', `  private lastRealStrike = 0;
  async press(key: string): Promise<void> {
    if(key==='f'||key==='Shift'){
      const remaining=this.lastRealStrike+1100-Date.now();
      if(remaining>0)await new Promise(resolveWait=>setTimeout(resolveWait,remaining));
      this.lastRealStrike=Date.now();
    }`);
text=text.replace('if (response.status() >= 400) report.responseErrors.push(\`\${response.status()} \${path}\`);',
 `if (response.status() >= 400) {
    const body=await response.json().catch(()=>null);
    report.responseErrors.push(JSON.stringify({status:response.status(),path,body}));
  }`);
await writeFile(temporary,text);
try {
 const result=await new Promise((resolve,reject)=>{
  const child=spawn(path.join(repo,'node_modules/.bin/tsx'),[temporary],{cwd:repo,stdio:'inherit',env:{...process.env,
   QUEST_E2E_PROJECT:'src/shared/levels/family-world-a-v5.json',QUEST_E2E_CHAPTERS:'family-a3',QUEST_E2E_UNTIL:'complete',QUEST_E2E_RUN_LABEL:'rooftop-city-v001',
   QUEST_E2E_SHOTS:'docs/assets/media/rooftop-city-kit/v001/a3-camera'}});
  child.on('error',reject);child.on('close',resolve);
 });
 process.exitCode=result??1;
} finally {await unlink(temporary).catch(()=>{});}
