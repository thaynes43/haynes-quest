/** WO111 putty-grunt: reference-sheet views beside exact-export stills at matching angles and one metric scale.
 * node compare.mjs <reference-sheet.png> <stills-dir> <out.png> [suffix]
 * Sheet (sheet.py / sheet-render.json): 2048 x 1024 orthographic, 6.231 m wide from x = -0.5721 m (328.68 px/m),
 * floor at pixel row 809; view roots at x = 0.950 / 2.144 / 3.439 / 4.704 m (front, side, back, three-quarter).
 * Stills (preview.mjs): 900 x 900 orthographic, half-height 0.85 m (529.4 px/m), the root at column 450 and the
 * floor at row 847 in every view. Each crop is the same metric window around the root, from 1.55 m down to -0.08 m.
 * The model stills show the sheet guard (idle 0 s). Adapted from the inator-monster compare. */
import sharp from 'sharp';
const [sheet,dir,out,suffix='']=process.argv.slice(2);
const PX=2048/6.231,sx=x=>Math.round((x+0.5721)*PX),sy=z=>Math.round(809-z*PX);
const views={front:{root:0.950,l:-0.56,r:0.56},side:{root:2.144,l:-0.46,r:0.52},back:{root:3.439,l:-0.56,r:0.56},threequarter:{root:4.704,l:-0.46,r:0.56}};
const ZT=1.55,ZB=-0.08,SP=900/1.7,label=(t,w)=>Buffer.from(`<svg width="${w}" height="34"><rect width="${w}" height="34" fill="#211f25"/><text x="8" y="23" fill="#e3dccb" font-size="15" font-family="sans-serif">${t}</text></svg>`);
const tiles=[];let x0=0;const H=Math.round((ZT-ZB)*PX);
for(const [view,v] of Object.entries(views)){
 const W=Math.round((v.r-v.l)*PX);
 tiles.push({input:label('sheet · '+view,W),left:x0,top:0});
 tiles.push({input:await sharp(sheet).extract({left:sx(v.root+v.l),top:sy(ZT),width:W,height:H}).png().toBuffer(),left:x0,top:34});
 const L=Math.round(450+v.l*SP),Tp=Math.round(450-(ZT-0.75)*SP),SW=Math.round((v.r-v.l)*SP),SH=Math.round((ZT-ZB)*SP);
 tiles.push({input:label('exact GLB · '+view+suffix,W),left:x0,top:34+H});
 tiles.push({input:await sharp(`${dir}/${view}.png`).extract({left:L,top:Tp,width:SW,height:SH}).resize(W,H).png().toBuffer(),left:x0,top:68+H});x0+=W;
}
await sharp({create:{width:x0,height:2*H+68,channels:4,background:'#fff'}}).composite(tiles).png().toFile(out);
console.log(JSON.stringify({out,px_per_m_sheet:PX,px_per_m_still:SP}));
