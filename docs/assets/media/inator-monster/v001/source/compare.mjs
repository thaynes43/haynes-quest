/** WO111 inator-monster: reference-sheet views beside exact-export stills at matching angles and one metric scale.
 * node compare.mjs <reference-sheet.png> <stills-dir> <out.png> [suffix]
 * Sheet (sheet.py / sheet-render.json): 2048x1024 orthographic, 12.372 m wide from x = -0.7258 m (165.54 px/m),
 * floor at pixel row 809; view roots at x = 1.380 / 4.984 / 7.936 / 10.375 m.
 * Stills (preview.mjs / look.mjs): 900x900 ortho, half-height 1.8 m (250 px/m), camera target at 1.62 m height;
 * the target's screen offset from the root is 0 (front), -0.33 (side), 0 (back) and -0.1414 m (three-quarter).
 * Each crop is the same metric window around the root, from 3.35 m down to -0.10 m. Adapted from mischief-kitten. */
import sharp from 'sharp';
const [sheet,dir,out,suffix='']=process.argv.slice(2);
const PX=2048/12.372,sx=x=>Math.round((x+0.7258)*PX),sy=z=>Math.round(809-z*PX);
const views={front:{root:1.380,l:-1.02,r:1.12,sc:0},side:{root:4.984,l:-2.02,r:1.40,sc:-0.33},back:{root:7.936,l:-1.12,r:1.02,sc:0},threequarter:{root:10.375,l:-1.08,r:1.08,sc:-0.1414}};
const ZT=3.35,ZB=-0.10,SP=250,label=(t,w)=>Buffer.from(`<svg width="${w}" height="34"><rect width="${w}" height="34" fill="#211f25"/><text x="10" y="23" fill="#e3dccb" font-size="16" font-family="sans-serif">${t}</text></svg>`);
const tiles=[];let x0=0;const H=Math.round((ZT-ZB)*PX);
for(const [view,v] of Object.entries(views)){
 const W=Math.round((v.r-v.l)*PX);
 tiles.push({input:label('sheet · '+view,W),left:x0,top:0});
 tiles.push({input:await sharp(sheet).extract({left:sx(v.root+v.l),top:sy(ZT),width:W,height:H}).png().toBuffer(),left:x0,top:34});
 const L=Math.round(450+(v.l-v.sc)*SP),T=Math.round(450-(ZT-1.62)*SP),SW=Math.round((v.r-v.l)*SP),SH=Math.round((ZT-ZB)*SP);
 tiles.push({input:label('exact GLB · '+view+suffix,W),left:x0,top:34+H});
 tiles.push({input:await sharp(`${dir}/${view}.png`).extract({left:Math.max(0,L),top:Math.max(0,T),width:Math.min(SW,900-Math.max(0,L)),height:Math.min(SH,900-Math.max(0,T))}).resize(W,H).png().toBuffer(),left:x0,top:68+H});x0+=W;
}
await sharp({create:{width:x0,height:2*H+68,channels:4,background:'#fff'}}).composite(tiles).png().toFile(out);
console.log(JSON.stringify({out,px_per_m_sheet:PX,px_per_m_still:SP}));
