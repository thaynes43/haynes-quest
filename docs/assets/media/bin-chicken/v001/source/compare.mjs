/** WO111 bin-chicken: reference-sheet views beside exact-export stills at matching angles and one metric scale.
 * node compare.mjs <reference-sheet.png> <stills-dir> <out.png>
 * Sheet (sheet.py): 2048x1024, 367.4 px/m, floor at y=808.9 px, view centres from sheet-render.json
 * (px_x = (x_m + 0.501) * 367.4). Stills (preview.mjs): 800x900 ortho, 600 px/m, camera at 0.64 m, origin at x=400.
 * Both are cropped to the same 1.24 m x 1.40 m window (x = centre +/- 0.62 m, z = -0.05..1.35 m). */
import sharp from 'sharp';
const [sheet,dir,out]=process.argv.slice(2);
const SPM=1024/2.787, ZTOP=2.2017, LEFT=-0.501;
const centres={front:0.687,side:1.841,back:3.157,threequarter:4.235};
const X0=-0.62, X1=0.62, Z0=-0.05, Z1=1.35;
const W=Math.round((X1-X0)*SPM), H=Math.round((Z1-Z0)*SPM);
const tiles=[];let col=0;const label=(t,w)=>Buffer.from(`<svg width="${w}" height="34"><rect width="${w}" height="34" fill="#211f25"/><text x="10" y="23" fill="#e3dccb" font-size="16" font-family="sans-serif">${t}</text></svg>`);
const crops={};
for(const view of ['front','side','back','threequarter']){
 const sl=Math.round((centres[view]+X0-LEFT)*SPM), st=Math.round((ZTOP-Z1)*SPM);
 const rl=Math.round(400+X0*600), rt=Math.round(450-(Z1-0.64)*600), rw=Math.round((X1-X0)*600), rh=Math.round((Z1-Z0)*600);
 crops[view]={sheet:{left:sl,top:st,width:W,height:H},still:{left:rl,top:rt,width:rw,height:rh}};
 tiles.push({input:label('sheet · '+view,W),left:col*W,top:0});
 tiles.push({input:await sharp(sheet).extract({left:sl,top:st,width:W,height:H}).png().toBuffer(),left:col*W,top:34});
 tiles.push({input:label('exact GLB · '+view+' (idle 0 s)',W),left:col*W,top:34+H});
 tiles.push({input:await sharp(`${dir}/${view}.png`).extract({left:rl,top:rt,width:rw,height:rh}).resize(W,H).png().toBuffer(),left:col*W,top:68+H});col++;
}
await sharp({create:{width:4*W,height:2*H+68,channels:4,background:'#fff'}}).composite(tiles).png().toFile(out);
console.log(JSON.stringify({out,window_m:{x:[X0,X1],z:[Z0,Z1]},crops}));
