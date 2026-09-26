/** WO111 review helper: tile PNGs into one sheet. node grid.mjs <out> <cols> <png...> */
import sharp from 'sharp';
const [out,colsArg,...files]=process.argv.slice(2);const cols=+colsArg,w=400,h=450,rows=Math.ceil(files.length/cols);
const tiles=[];for(const [i,f] of files.entries())tiles.push({input:await sharp(f).resize(w,h,{fit:'contain',background:'#ffffff'}).png().toBuffer(),left:(i%cols)*w,top:Math.floor(i/cols)*h});
await sharp({create:{width:cols*w,height:rows*h,channels:4,background:'#fff'}}).composite(tiles).png().toFile(out);
