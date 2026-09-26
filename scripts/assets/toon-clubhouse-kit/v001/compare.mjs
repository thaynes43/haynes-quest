/** WO111 toon-clubhouse-kit v001: kit beauty strip and concept-vs-export comparison from the exact-GLB stills.
 * node compare.mjs <artifact-dir>   (run from a haynes-quest worktree root so sharp resolves)
 * Concept crops are pixel boxes in concept-draft.png (1536 x 1024) around each study. */
import sharp from 'sharp';
import path from 'node:path';
const root = path.resolve(process.argv[2]);
const IDS = ['clubhouse-tower-facade', 'curly-slide', 'gadget-toolbox-stand', 'rounded-hedge', 'stage-marker'];
const LABEL = {'clubhouse-tower-facade': 'CLUBHOUSE TOWER FACADE', 'curly-slide': 'CURLY SLIDE', 'gadget-toolbox-stand': 'GADGET TOOLBOX STAND', 'rounded-hedge': 'ROUNDED HEDGES', 'stage-marker': 'DANCE STAGE MARKER'};
const CROP = {'clubhouse-tower-facade': [110, 0, 560, 580], 'curly-slide': [880, 50, 560, 560], 'gadget-toolbox-stand': [45, 655, 400, 270],
  'rounded-hedge': [500, 655, 500, 250], 'stage-marker': [1035, 735, 460, 170]};
const label = (t, w, h = 40, size = 20) => Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#f5ebdc"/><text x="${w / 2}" y="${h * 0.66}" text-anchor="middle" fill="#342c46" font-size="${size}" font-family="sans-serif">${t}</text></svg>`);
const T = 520;
// kit beauty strip
const tiles = [];
for (const [i, id] of IDS.entries()) {
  tiles.push({input: await sharp(path.join(root, 'stills', id + '-beauty.png')).resize(T, T).toBuffer(), left: i * T, top: 0});
  tiles.push({input: label(LABEL[id], T), left: i * T, top: T});
}
tiles.push({input: label("toon-clubhouse-kit v001 · exact GLBs in three.js (headless Chromium) · Awaiting Tom's review · used in the family release", 5 * T, 44, 22), left: 0, top: T + 40});
await sharp({create: {width: 5 * T, height: T + 84, channels: 3, background: '#f5ebdc'}}).composite(tiles).png().toFile(path.join(root, 'kit-beauty.png'));
// concept vs export: one row per prop
const rows = [];
let y = 0;
for (const id of IDS) {
  const [l, t, w, h] = CROP[id];
  const concept = await sharp(path.join(root, 'concept-draft.png')).extract({left: l, top: t, width: w, height: h}).resize({width: T, height: T, fit: 'contain', background: '#f5ebdc'}).toBuffer();
  rows.push({input: label(LABEL[id] + ' · concept draft', T, 36, 18), left: 0, top: y}, {input: label('exact GLB · beauty', T, 36, 18), left: T, top: y},
    {input: label('exact GLB · three-quarter (sheet view)', T, 36, 18), left: 2 * T, top: y});
  rows.push({input: concept, left: 0, top: y + 36});
  rows.push({input: await sharp(path.join(root, 'stills', id + '-beauty.png')).resize(T, T).toBuffer(), left: T, top: y + 36});
  rows.push({input: await sharp(path.join(root, 'stills', id + '-threequarter.png')).resize(T, T).toBuffer(), left: 2 * T, top: y + 36});
  y += T + 36;
}
await sharp({create: {width: 3 * T, height: y, channels: 3, background: '#f5ebdc'}}).composite(rows).png().toFile(path.join(root, 'concept-vs-export.png'));
console.log(JSON.stringify({kit_beauty: 'kit-beauty.png', concept_vs_export: 'concept-vs-export.png'}));
