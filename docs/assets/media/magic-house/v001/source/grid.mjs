/** WO111 magic-house review helper: tile stills into one sheet. node grid.mjs <dir> <out.png> [views...] */
import sharp from 'sharp';
const [dir,out,...views]=process.argv.slice(2);
const names=views.length?views:['front','side','back','threequarter'];
const cols=Math.min(4,names.length),rows=Math.ceil(names.length/cols),w=500,h=563;
const tiles=[];
for(const [i,v] of names.entries()){const src=v.includes('/')?v:dir+'/'+v+'.png';tiles.push({input:await sharp(src).resize(w,h,{fit:'contain',background:'#ffffff'}).png().toBuffer(),left:(i%cols)*w,top:Math.floor(i/cols)*h})}
await sharp({create:{width:cols*w,height:rows*h,channels:4,background:'#fff'}}).composite(tiles).png().toFile(out);
