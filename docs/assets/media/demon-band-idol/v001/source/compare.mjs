/** WO111 demon-band-idol: reference-sheet views beside exact-export stills at matching angles and one metric scale.
 * node compare.mjs <reference-sheet.png> <stills-dir> <out.png>
 * Sheet (sheet-render.json): 2048 x 1024, ortho width 6.226 m -> 328.95 px/m; floor at y = 0.79 x 3.113 m x 328.95 = 809 px;
 * view centres at x = (centre_m + 0.6657 m) x 328.95 px. Stills (preview.mjs): 800 x 900 ortho, 444.4 px/m, camera at 0.70 m.
 * The export stills show idle at 0 s, which the animation asserts is the sheet pose. */
import sharp from 'sharp';
const [sheet,dir,out]=process.argv.slice(2);
const SPX=2048/6.226,FLOOR=0.79*3.113*SPX,LEFT=-0.6657;
const centres={front:0.96,side:2.175,back:3.324,threequarter:4.564};
const TOP_M=1.50,BOT_M=-0.08,HALF_W_M=0.67;
const W=Math.round(2*HALF_W_M*SPX),H=Math.round((TOP_M-BOT_M)*SPX),top=Math.round(FLOOR-TOP_M*SPX);
const PX=800/1.8,rw=Math.round(2*HALF_W_M*PX),rh=Math.round((TOP_M-BOT_M)*PX),ry=Math.round(450-(TOP_M-0.70)*PX),rx=Math.round(400-rw/2);
const tiles=[];let col=0;const label=(t,w)=>Buffer.from(`<svg width="${w}" height="34"><rect width="${w}" height="34" fill="#211f25"/><text x="10" y="23" fill="#e3dccb" font-size="16" font-family="sans-serif">${t}</text></svg>`);
for(const view of ['front','side','back','threequarter']){
 const cx=Math.round((centres[view]-LEFT)*SPX);
 tiles.push({input:label('sheet · '+view,W),left:col*W,top:0});
 tiles.push({input:await sharp(sheet).extract({left:cx-Math.round(W/2),top,width:W,height:H}).png().toBuffer(),left:col*W,top:34});
 tiles.push({input:label('exact GLB (idle 0 s) · '+view,W),left:col*W,top:34+H});
 tiles.push({input:await sharp(`${dir}/${view}.png`).extract({left:rx,top:ry,width:rw,height:rh}).resize(W,H).png().toBuffer(),left:col*W,top:68+H});col++;
}
await sharp({create:{width:4*W,height:2*H+68,channels:4,background:'#fff'}}).composite(tiles).png().toFile(out);
console.log(JSON.stringify({out,sheet_px_per_m:SPX,sheet_floor_px:FLOOR,crop_sheet:{W,H,top},crop_still:{rx,ry,rw,rh}}));
