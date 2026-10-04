/** Concept row beside the exact export's front / side / back stills. node compare.mjs <concept.png> <top,height> <stills-dir> <out.png> */
import sharp from 'sharp';
import path from 'node:path';
const [concept, rows, dir, out] = process.argv.slice(2);
const [top, height] = rows.split(',').map(Number);
const meta = await sharp(concept).metadata();
const H = 420, label = (t, w) => Buffer.from(`<svg width="${w}" height="34"><rect width="${w}" height="34" fill="#2a2630"/><text x="10" y="23" fill="#efe6d4" font-size="16" font-family="sans-serif">${t}</text></svg>`);
const crop = await sharp(concept).extract({left: 0, top, width: meta.width, height}).resize({height: H}).png().toBuffer();
const cw = (await sharp(crop).metadata()).width;
const stills = await Promise.all(['front', 'side', 'back'].map((v) => sharp(path.join(dir, v + '.png')).resize({height: H}).png().toBuffer()));
const sw = (await sharp(stills[0]).metadata()).width;
await sharp({create: {width: cw + sw * 3, height: H + 34, channels: 3, background: '#f3ecdf'}}).composite([
  {input: label('Coordinator construction reference (concept.png)', cw), left: 0, top: 0}, {input: crop, left: 0, top: 34},
  ...stills.flatMap((b, i) => [{input: label(['Exact v001 GLB · front', 'side', 'back'][i], sw), left: cw + i * sw, top: 0}, {input: b, left: cw + i * sw, top: 34}]),
]).png({compressionLevel: 9, palette: true, quality: 92}).toFile(out);
console.log(out);
