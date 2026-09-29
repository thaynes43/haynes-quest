/** WO111 web-slinger-helper: reference-sheet views beside exact-export stills at matching angles and one metric scale.
 * node compare.mjs <reference-sheet.png> <stills-dir> <out.png>   (adapted from the demon-band-idol v001 compare.mjs)
 * Sheet (sheet-render.json / sheet.py): 2048 x 1024, ortho width 5.295 m -> 386.78 px/m; the camera's left edge sits
 * at x = -0.5006 m (ruler at 0, left margin 0.26 U + half the spread slack); the floor (z = 0) at 21% of the frame
 * height from the bottom -> row 808.96; the figure origins at the view centre_x_m values. Stills (preview.mjs):
 * 800 x 900 ortho 1.44 m wide -> 555.6 px/m, camera target 0.60 m at row 450, origin at column 400. The export stills
 * show idle at 0 s, which the animation asserts is the sheet pose. */
import sharp from 'sharp';
const [sheet,dir,out]=process.argv.slice(2);
const SPX=2048/5.295,FLOOR=1024*(1-0.21),LEFT=-0.5006;
const centres={front:0.861,side:1.874,back:2.914,threequarter:4.068};
const TOP_M=1.30,BOT_M=-0.06,HALF_W_M=0.52;
const W=Math.round(2*HALF_W_M*SPX),H=Math.round((TOP_M-BOT_M)*SPX),top=Math.round(FLOOR-TOP_M*SPX);
const PX=800/1.44,rw=Math.round(2*HALF_W_M*PX),rh=Math.round((TOP_M-BOT_M)*PX),ry=Math.round(450-(TOP_M-0.60)*PX),rx=Math.round(400-rw/2);
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
