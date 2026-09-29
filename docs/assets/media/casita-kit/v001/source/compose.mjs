/** Exact-GLB review sheets from the Chromium captures; no generated concept. */
import sharp from 'sharp';
import path from 'node:path';
const root = path.resolve(process.argv[2]);
const ids = ['casita-terrace-wall', 'flower-planter', 'patterned-door', 'butterfly-arch'];
const titles = ['Terrace wall', 'Flower planter', 'Patterned door', 'Butterfly arch'];
const views = ['front', 'side', 'back', 'threequarter', 'beauty'];
const bg = '#efe4cf';
const label = (text, width, height=42) => Buffer.from(`<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="${bg}"/><text x="${width/2}" y="28" text-anchor="middle" font-family="sans-serif" font-size="21" fill="#423652">${text}</text></svg>`);
const square = async (file,size) => sharp(path.join(root,file)).resize(size,size).toBuffer();
const tiles=[];
for (let i=0;i<4;i++) {
  tiles.push({input:await square(`stills/${ids[i]}-beauty.png`,500),left:i*500,top:42});
  tiles.push({input:label(titles[i],500),left:i*500,top:542});
}
tiles.push({input:label('Casita kit v001 · exact GLBs · Awaiting Tom’s review',2000),left:0,top:0});
await sharp({create:{width:2000,height:584,channels:3,background:bg}}).composite(tiles).png().toFile(path.join(root,'kit-beauty.png'));
const grid=[];
for(let i=0;i<4;i++) {
  grid.push({input:label(titles[i]+' · static model, five inspection views',1800),left:0,top:i*402});
  for(let j=0;j<5;j++) grid.push({input:await square(`stills/${ids[i]}-${views[j]}.png`,360),left:j*360,top:i*402+42});
}
await sharp({create:{width:1800,height:1608,channels:3,background:bg}}).composite(grid).png().toFile(path.join(root,'static-contact-sheet.png'));
const comparison=[];
const crops=[[112,364,513,218],[110,815,127,110],[670,669,173,256],[1268,235,382,347]];
for(let i=0;i<4;i++) {
  const [left,top,width,height]=crops[i];
  const ref=await sharp(path.join(root,'reference-sheet.png')).extract({left,top,width,height}).resize(470,430,{fit:'contain',background:bg}).toBuffer();
  comparison.push({input:label(titles[i]+' · approved sheet',470),left:0,top:i*472});
  comparison.push({input:label('Exact GLB · front',470),left:470,top:i*472});
  comparison.push({input:label('Exact GLB · three-quarter',470),left:940,top:i*472});
  comparison.push({input:ref,left:0,top:i*472+42});
  for(let j=0;j<2;j++) comparison.push({input:await sharp(path.join(root,`stills/${ids[i]}-${j?'threequarter':'front'}.png`)).resize(470,430,{fit:'contain',background:bg}).toBuffer(),left:(j+1)*470,top:i*472+42});
}
await sharp({create:{width:1410,height:1888,channels:3,background:bg}}).composite(comparison).png().toFile(path.join(root,'sheet-vs-export.png'));
console.log('Composed kit beauty, static contact sheet and approved-sheet comparison.');
