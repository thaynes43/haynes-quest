/** WO111 lab-robot: reference-sheet views beside exact-export stills at matching angles and one metric scale.
 * node compare.mjs <reference-sheet.png> <stills-dir> <out.png>
 * Sheet (sheet-render.json + sheet.py): 2048 x 1024, ortho width 5.744 m -> 356.55 px/m; floor at 0.79 x 1024 = 809 px;
 * sheet left edge at x = -0.26 U = -0.337 m (U = 2.872 / 2.216); view centres FRONT 0.778, SIDE 2.116, BACK 3.308,
 * THREE-QUARTER 4.725 m. Stills (preview.mjs): 800 x 900 ortho, 562.5 px/m, camera target 0.65 m.
 * The export stills show idle at 0 s, which the animation asserts is the sheet pose. Adapted from radio-host-showman v001. */
import sharp from 'sharp';
const [sheet,dir,out]=process.argv.slice(2);
const SPX=2048/5.744,FLOOR=0.79*1024,LEFT=-0.26*(2.872/2.216);
const centres={front:0.778,side:2.116,back:3.308,threequarter:4.725};
const TOP_M=1.40,BOT_M=-0.05,HALF_W_M=0.68;
const W=Math.round(2*HALF_W_M*SPX),H=Math.round((TOP_M-BOT_M)*SPX),top=Math.round(FLOOR-TOP_M*SPX);
const PX=562.5,rw=Math.round(2*HALF_W_M*PX),rh=Math.round((TOP_M-BOT_M)*PX),ry=Math.round(450-(TOP_M-0.65)*PX),rx=Math.round(400-rw/2);
const tiles=[];let col=0;const label=(t,w)=>Buffer.from(`<svg width="${w}" height="34"><rect width="${w}" height="34" fill="#211f25"/><text x="10" y="23" fill="#e3dccb" font-size="15" font-family="sans-serif">${t}</text></svg>`);
for(const view of ['front','side','back','threequarter']){
 const cx=Math.round((centres[view]-LEFT)*SPX);
 tiles.push({input:label('sheet · '+view,W),left:col*W,top:0});
 tiles.push({input:await sharp(sheet).extract({left:cx-Math.round(W/2),top,width:W,height:H}).png().toBuffer(),left:col*W,top:34});
 tiles.push({input:label('exact GLB (idle 0 s) · '+view,W),left:col*W,top:34+H});
 tiles.push({input:await sharp(`${dir}/${view}.png`).extract({left:Math.max(0,rx),top:Math.max(0,ry),width:Math.min(rw,800),height:Math.min(rh,900-Math.max(0,ry))}).resize(W,H).png().toBuffer(),left:col*W,top:68+H});col++;
}
await sharp({create:{width:4*W,height:2*H+68,channels:4,background:'#fff'}}).composite(tiles).png().toFile(out);
console.log(JSON.stringify({out,sheet_px_per_m:SPX,sheet_floor_px:FLOOR,crop_sheet:{W,H,top},crop_still:{rx,ry,rw,rh}}));
