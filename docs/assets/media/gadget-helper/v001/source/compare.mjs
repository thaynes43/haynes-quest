/** WO111 author review: concept views beside the exact-export stills at matching angles. */
import sharp from 'sharp';
const [concept,dir,out]=process.argv.slice(2);
const crops={beauty:{left:0,top:60,width:1010,height:900},front:{left:1000,top:0,width:536,height:345},side:{left:1000,top:340,width:536,height:345},back:{left:1000,top:680,width:536,height:344}};
const w=420,h=420,tiles=[];let col=0;
for(const view of ['front','side','back','beauty']){
 tiles.push({input:await sharp(concept).extract(crops[view]).resize(w,h,{fit:'contain',background:'#eddac0'}).png().toBuffer(),left:col*w,top:0});
 tiles.push({input:await sharp(`${dir}/${view}.png`).resize(w,h,{fit:'contain',background:'#e4ddcf'}).png().toBuffer(),left:col*w,top:h});col++;
}
await sharp({create:{width:4*w,height:2*h,channels:4,background:'#fff'}}).composite(tiles).png().toFile(out);
