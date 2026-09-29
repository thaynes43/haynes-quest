/** Matching Blender-reference / exact GLB views, from actual Chromium captures. */
import sharp from 'sharp';
import path from 'node:path';
const root=path.resolve(process.argv[2]);
const ids=['water-tower','rooftop-ac-unit','crane-hook','billboard-frame'];
const names=['Water tower','Rooftop AC unit','Crane hook','Billboard frame'];
const bg='#efe4cf';
const label=(text,w)=>Buffer.from(`<svg width="${w}" height="45"><rect width="100%" height="100%" fill="${bg}"/><text x="${w/2}" y="30" text-anchor="middle" font-family="sans-serif" font-size="21" fill="#2f3a50">${text}</text></svg>`);
const tile=(file,w,h)=>sharp(path.join(root,file)).resize(w,h,{fit:'contain',background:bg}).flatten({background:bg}).png().toBuffer();
const beauty=[{input:label('Rooftop City v001 · exact GLBs · Awaiting Tom’s review',2000),left:0,top:0}];
const contact=[],comparison=[];
for(let i=0;i<4;i++){
 beauty.push({input:await tile(`stills/${ids[i]}-beauty.png`,500,500),left:i*500,top:45});
 beauty.push({input:label(names[i],500),left:i*500,top:545});
 contact.push({input:label(names[i]+' · static model inspection',1800),left:0,top:i*405});
 for(let j=0;j<5;j++)contact.push({input:await tile(`stills/${ids[i]}-${['front','side','back','threequarter','beauty'][j]}.png`,360,360),left:j*360,top:i*405+45});
 for(let j=0;j<3;j++){
  comparison.push({input:label(j===0?names[i]+' · approved Blender sheet':j===1?'Exact GLB · front':'Exact GLB · three-quarter',470),left:j*470,top:i*475});
  comparison.push({input:await tile(j===0?`reference-${ids[i]}-front.png`:`stills/${ids[i]}-${j===1?'front':'threequarter'}.png`,470,430),left:j*470,top:i*475+45});
 }
}
await sharp({create:{width:2000,height:590,channels:3,background:bg}}).composite(beauty).png().toFile(path.join(root,'kit-beauty.png'));
await sharp({create:{width:1800,height:1620,channels:3,background:bg}}).composite(contact).png().toFile(path.join(root,'static-contact-sheet.png'));
await sharp({create:{width:1410,height:1900,channels:3,background:bg}}).composite(comparison).png().toFile(path.join(root,'sheet-vs-export.png'));
