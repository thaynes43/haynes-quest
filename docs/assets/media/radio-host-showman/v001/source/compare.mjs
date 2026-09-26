/** WO111 radio-host-showman: reference-sheet views beside exact-export stills at matching angles and one metric scale.
 * node compare.mjs <reference-sheet.png> <stills-dir> <out.png>
 * Sheet (sheet-render.json + sheet.py): 2048 x 1024, ortho width 8.863 m -> 231.07 px/m; floor at 0.79 x 1024 = 809 px;
 * sheet left edge at x = -0.909 m (ruler at 0, first view's left edge 0.869 m); view centres FRONT 1.422, SIDE 3.053,
 * BACK 4.742, THREE-QUARTER 6.445 m. Stills (preview.mjs): 800 x 900 ortho, 320 px/m, camera target 1.05 m.
 * The export stills show idle at 0 s, which the animation asserts is the sheet pose. Adapted from demon-band-idol v001. */
import sharp from 'sharp';
const [sheet,dir,out]=process.argv.slice(2);
const SPX=2048/8.863,FLOOR=0.79*1024,LEFT=-0.909;
const centres={front:1.422,side:3.053,back:4.742,threequarter:6.445};
const TOP_M=2.12,BOT_M=-0.06,HALF_W_M=0.78;
const W=Math.round(2*HALF_W_M*SPX),H=Math.round((TOP_M-BOT_M)*SPX),top=Math.round(FLOOR-TOP_M*SPX);
const PX=320,rw=Math.round(2*HALF_W_M*PX),rh=Math.round((TOP_M-BOT_M)*PX),ry=Math.round(450+(1.05-TOP_M)*PX),rx=Math.round(400-rw/2);
const tiles=[];let col=0;const label=(t,w)=>Buffer.from(`<svg width="${w}" height="34"><rect width="${w}" height="34" fill="#211f25"/><text x="10" y="23" fill="#e3dccb" font-size="15" font-family="sans-serif">${t}</text></svg>`);
for(const view of ['front','side','back','threequarter']){
 const cx=Math.round((centres[view]-LEFT)*SPX);
 tiles.push({input:label('sheet · '+view,W),left:col*W,top:0});
 tiles.push({input:await sharp(sheet).extract({left:cx-Math.round(W/2),top,width:W,height:H}).png().toBuffer(),left:col*W,top:34});
 tiles.push({input:label('exact GLB (idle 0 s) · '+view,W),left:col*W,top:34+H});
 tiles.push({input:await sharp(`${dir}/${view}.png`).extract({left:rx,top:ry,width:rw,height:rh}).resize(W,H).png().toBuffer(),left:col*W,top:68+H});col++;
}
await sharp({create:{width:4*W,height:2*H+68,channels:4,background:'#fff'}}).composite(tiles).png().toFile(out);
console.log(JSON.stringify({out,sheet_px_per_m:SPX,sheet_floor_px:FLOOR,crop_sheet:{W,H,top},crop_still:{rx,ry,rw,rh}}));
