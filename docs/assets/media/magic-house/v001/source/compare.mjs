/** WO111 magic-house: reference-sheet views beside exact-export stills at matching angles and one metric scale.
 * node compare.mjs <reference-sheet.png> <stills-dir> <out.png>
 * Sheet: 2048x1024, floor at y=775.5 px, 163 px/m (ruler ticks 0.5/1.5/2.5 m at 694/531/368 px); view roots at
 * x = 402 (front), 804 (side), 1244 (back), 1753 (three-quarter), measured from the clogs and zocalo band.
 * Stills: preview.mjs 800x900 orthographic, 250 px/m, root at x=400, floor at y=837.5 px. */
import sharp from 'sharp';
const [sheet,dir,out]=process.argv.slice(2);
const roots={front:402,side:804,back:1244,threequarter:1753};
const SPM=163, FLOOR=775.5, PPM=250, SFLOOR=837.5, SX=400;
const WM=2.9, TOP=3.05, BOT=-0.10;                    // crop: 2.9 m wide, from 3.05 m down to -0.10 m
const W=Math.round(WM*SPM), H=Math.round((TOP-BOT)*SPM), top=Math.round(FLOOR-TOP*SPM);
const rw=Math.round(WM*PPM), rh=Math.round((TOP-BOT)*PPM), ry=Math.round(SFLOOR-TOP*PPM), rx=Math.round(SX-rw/2);
const tiles=[];let col=0;const label=(t,w)=>Buffer.from(`<svg width="${w}" height="34"><rect width="${w}" height="34" fill="#211f25"/><text x="10" y="23" fill="#e3dccb" font-size="16" font-family="sans-serif">${t}</text></svg>`);
for(const view of ['front','side','back','threequarter']){
 tiles.push({input:label('reference sheet · '+view,W),left:col*W,top:0});
 tiles.push({input:await sharp(sheet).extract({left:Math.round(roots[view]-W/2),top,width:W,height:H}).png().toBuffer(),left:col*W,top:34});
 tiles.push({input:label('exact GLB · '+view,W),left:col*W,top:34+H});
 tiles.push({input:await sharp(`${dir}/${view}.png`).extract({left:rx,top:ry,width:rw,height:rh}).resize(W,H).png().toBuffer(),left:col*W,top:68+H});col++;
}
await sharp({create:{width:4*W,height:2*H+68,channels:4,background:'#fff'}}).composite(tiles).png().toFile(out);
console.log(JSON.stringify({out,crop_sheet:{W,H,top},crop_still:{rx,ry,rw,rh}}));
