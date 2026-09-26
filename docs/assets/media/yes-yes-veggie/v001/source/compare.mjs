/** WO111 yes-yes-veggie author review: concept views beside the exact-export stills at matching angles. */
import sharp from 'sharp';
const [concept,dir,out]=process.argv.slice(2);
// Selected concept is 1774x887: hero three-quarter at left, then FRONT, SIDE and BACK construction views.
const crops={beauty:{left:10,top:20,width:650,height:790},front:{left:625,top:195,width:425,height:580},side:{left:1040,top:195,width:340,height:580},back:{left:1365,top:195,width:405,height:580}};
const w=420,h=520,tiles=[];let col=0;
for(const view of ['front','side','back','beauty']){
 tiles.push({input:await sharp(concept).extract(crops[view]).resize(w,h,{fit:'contain',background:'#eddac0'}).png().toBuffer(),left:col*w,top:0});
 tiles.push({input:await sharp(`${dir}/${view}.png`).resize(w,h,{fit:'contain',background:'#e4ddcf'}).png().toBuffer(),left:col*w,top:h});col++;
}
await sharp({create:{width:4*w,height:2*h,channels:4,background:'#fff'}}).composite(tiles).png().toFile(out);
