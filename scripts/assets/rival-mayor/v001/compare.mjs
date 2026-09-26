/** WO111 rival-mayor: reference-sheet views beside exact-export stills at matching angles and one metric scale.
 * node compare.mjs <reference-sheet.png> <stills-dir> <out.png>
 * Sheet: 2048x1024, floor at y=891 px, 278 px/m. Stills: preview.mjs 800x900 ortho, 333.3 px/m, camera at 1.24 m. */
import sharp from 'sharp';
const [sheet,dir,out]=process.argv.slice(2);
const centres={front:568,side:962,back:1357,threequarter:1771};
const W=460,H=740,top=180;          // sheet crop: 1.655 m x 2.66 m, from 2.558 m down to -0.104 m
const rw=Math.round(W/278*333.3),rh=Math.round(H/278*333.3),ry=Math.round(450-(2.558-1.24)*333.3),rx=Math.round(400-rw/2);
const tiles=[];let col=0;const label=(t,w)=>Buffer.from(`<svg width="${w}" height="34"><rect width="${w}" height="34" fill="#211f25"/><text x="10" y="23" fill="#e3dccb" font-size="16" font-family="sans-serif">${t}</text></svg>`);
for(const view of ['front','side','back','threequarter']){
 tiles.push({input:label('sheet · '+view,W),left:col*W,top:0});
 tiles.push({input:await sharp(sheet).extract({left:centres[view]-W/2,top,width:W,height:H}).png().toBuffer(),left:col*W,top:34});
 tiles.push({input:label('exact GLB · '+view,W),left:col*W,top:34+H});
 tiles.push({input:await sharp(`${dir}/${view}.png`).extract({left:rx,top:ry,width:rw,height:rh}).resize(W,H).png().toBuffer(),left:col*W,top:68+H});col++;
}
await sharp({create:{width:4*W,height:2*H+68,channels:4,background:'#fff'}}).composite(tiles).png().toFile(out);
console.log(JSON.stringify({out,crop_sheet:{W,H,top},crop_still:{rx,ry,rw,rh}}));
