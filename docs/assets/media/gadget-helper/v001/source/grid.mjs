/** WO111 review helper: tile the exact-export stills (and optionally the concept) into one sheet. */
import sharp from 'sharp';
const [dir,out,...views]=process.argv.slice(2);
const names=views.length?views:['front','side','back','beauty'];
const cols=Math.min(4,names.length),rows=Math.ceil(names.length/cols),w=400,h=450;
const tiles=[];
for(const [i,v] of names.entries()){const src=v.includes('/')?v:dir+'/'+v+'.png';tiles.push({input:await sharp(src).resize(w,h,{fit:'contain',background:'#ffffff'}).png().toBuffer(),left:(i%cols)*w,top:Math.floor(i/cols)*h})}
await sharp({create:{width:cols*w,height:rows*h,channels:4,background:'#fff'}}).composite(tiles).png().toFile(out);
