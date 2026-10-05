/** Kit concept rows beside each prop's exact-GLB front and side stills. node compare-kit.mjs <concept.png> <stills-dir> <out.png> */
import sharp from 'sharp';
import path from 'node:path';
const [concept, dir, out] = process.argv.slice(2);
const rows = [['storybook-canopy-tree', 0, 412], ['storybook-cypress', 412, 488], ['storybook-flowering-shrub', 900, 387]];
const meta = await sharp(concept).metadata(), H = 300;
const label = (t, w) => Buffer.from(`<svg width="${w}" height="30"><rect width="${w}" height="30" fill="#2a2630"/><text x="10" y="21" fill="#efe6d4" font-size="15" font-family="sans-serif">${t}</text></svg>`);
const parts = []; let y = 0, width = 0;
for (const [id, top, height] of rows) {
  const crop = await sharp(concept).extract({left: 0, top, width: meta.width, height}).resize({height: H}).png().toBuffer();
  const cw = (await sharp(crop).metadata()).width;
  const stills = await Promise.all(['front', 'side'].map((v) => sharp(path.join(dir, `${id}-${v}.png`)).resize({height: H}).png().toBuffer()));
  const sw = (await sharp(stills[0]).metadata()).width;
  parts.push({input: label(`${id} · concept row`, cw), left: 0, top: y}, {input: crop, left: 0, top: y + 30},
    {input: label('exact v001 GLB · front', sw), left: cw, top: y}, {input: stills[0], left: cw, top: y + 30},
    {input: label('side', sw), left: cw + sw, top: y}, {input: stills[1], left: cw + sw, top: y + 30});
  y += H + 30; width = Math.max(width, cw + 2 * sw);
}
await sharp({create: {width, height: y, channels: 3, background: '#f3ecdf'}}).composite(parts).png({compressionLevel: 9, palette: true, quality: 92}).toFile(out);
console.log(out);
