/** WO111 mischief-kitten: reference-sheet views beside exact-export stills at matching angles and one metric scale.
 * node compare.mjs <reference-sheet.png> <stills-dir> <out.png>
 * Sheet (sheet.py): 2048x1024 orthographic, 4.433 m wide from x=-0.26 m (462.0 px/m), floor at y=797.6 px;
 * view roots at x = 0.666 / 1.611 / 2.478 / 3.646 m. Stills (preview.mjs): 800x900 ortho, 645.16 px/m,
 * camera centre at 0.44 m, idle clip at 0 s (the sheet's tiptoe pose). Crop: 1.24 m wide around each root,
 * from 1.00 m down to -0.05 m. */
import sharp from 'sharp';
const [sheet,dir,out]=process.argv.slice(2);
const PX=2048/4.433,PAD=64,sx=x=>Math.round((x+0.26)*PX)+PAD,sy=z=>Math.round((1.7265-z)*PX);
const roots={front:0.666,side:1.611,back:2.478,threequarter:3.646};
const W=Math.round(1.24*PX),H=Math.round(1.05*PX),top=sy(1.0);
const SP=645.16,ry=Math.round(450-(1.0-0.44)*SP),rh=Math.round(1.05*SP);
const padded=await sharp(sheet).extend({left:PAD,right:PAD,top:0,bottom:0,background:'#f5ebdc'}).png().toBuffer();
const tiles=[];let col=0;const label=(t,w)=>Buffer.from(`<svg width="${w}" height="34"><rect width="${w}" height="34" fill="#211f25"/><text x="10" y="23" fill="#e3dccb" font-size="16" font-family="sans-serif">${t}</text></svg>`);
for(const view of Object.keys(roots)){
 tiles.push({input:label('sheet · '+view,W),left:col*W,top:0});
 tiles.push({input:await sharp(padded).extract({left:sx(roots[view])-Math.round(W/2),top,width:W,height:H}).png().toBuffer(),left:col*W,top:34});
 tiles.push({input:label('exact GLB · '+view+' · idle 0 s',W),left:col*W,top:34+H});
 tiles.push({input:await sharp(`${dir}/${view}.png`).extract({left:0,top:ry,width:800,height:rh}).resize(W,H).png().toBuffer(),left:col*W,top:68+H});col++;
}
await sharp({create:{width:4*W,height:2*H+68,channels:4,background:'#fff'}}).composite(tiles).png().toFile(out);
console.log(JSON.stringify({out,crop_sheet:{W,H,top,px_per_m:PX},crop_still:{ry,rh,px_per_m:SP}}));
