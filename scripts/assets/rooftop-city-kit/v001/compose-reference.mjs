/** Compose eight Blender views; this is not generated imagery or a production GLB render. */
import sharp from 'sharp';
import path from 'node:path';
const root=path.resolve(process.argv[2]);
const bg='#e8e7df',ink='#2f3a50',muted='#607080';
const W=2200,H=1650;
const svg=(w,h,content)=>Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${content}</svg>`);
const text=(x,y,size,value,fill=ink,weight=400)=>`<text x="${x}" y="${y}" font-family="DejaVu Sans, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${value}</text>`;
const layers=[{input:svg(W,145,text(58,55,34,'ROOFTOP CITY / FOUR-PIECE UTILITY KIT',ink,700)+text(58,92,21,'World A · Hero City A3 · v001 · Blender reference sheet, no generated concept',muted)+text(58,126,18,'Front and three-quarter construction views · panels use independent scales · awaiting coordinator sheet review',muted)),left:0,top:0}];
const items=[
 ['water-tower','01 / WATER TOWER','Planning box 2.8 × 5.0 × 2.8 m','Warm staves, blue steel hoops, open trestle; rear ladder.','Landmark and skyline placements retain all current transforms.'],
 ['rooftop-ac-unit','02 / ROOFTOP AC UNIT','Planning box 1.8 × 1.1 × 1.4 m','Two broad fan faces, quiet blue-grey service panels.','Wall-mounted below deck edges; no bright interaction cue.'],
 ['crane-hook','03 / CRANE HOOK','Planning box 1.0 × 1.6 × 1.0 m','Ochre pulley cheeks, steel J hook and closed safety latch.','Compact tackle attaches to the existing crane scenery.'],
 ['billboard-frame','04 / BILLBOARD FRAME','Planning box 5.0 × 4.0 × 0.5 m','Skeletal navy frame, faded mauve lip, five warm lamps.','Empty centre preserves sightlines across A3 combat lanes.'],
];
for(let i=0;i<items.length;i++){
 const [id,title,dim,note,placement]=items[i];const x=35+(i%2)*1100,y=155+Math.floor(i/2)*690;
 layers.push({input:svg(1060,675,`<rect x="0" y="0" width="1060" height="675" rx="20" fill="#f4f1e8"/>`+text(28,40,25,title,ink,700)+text(28,70,19,dim,muted)+text(165,108,15,'FRONT',muted)+text(665,108,15,'THREE-QUARTER',muted)+text(28,617,19,note)+text(28,649,18,placement,muted)),left:x,top:y});
 for(let j=0;j<2;j++)layers.push({input:await sharp(path.join(root,`reference-${id}-${j?'three-quarter':'front'}.png`)).resize(490,480,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer(),left:x+25+j*515,top:y+116});
}
layers.push({input:svg(W,90,text(58,35,18,'CAMERA / Open tower legs and an empty billboard centre; preserve published placements and planning boxes.',muted)+text(58,64,18,'CANDIDATE / Original scenery. Sheet approval precedes production export. Tom’s exact-version review remains pending.',muted)),left:0,top:1545});
await sharp({create:{width:W,height:H,channels:3,background:bg}}).composite(layers).png().toFile(path.join(root,'reference-sheet.png'));
console.log(path.join(root,'reference-sheet.png'));
