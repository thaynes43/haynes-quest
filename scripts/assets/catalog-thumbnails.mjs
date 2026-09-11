import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Small derivatives of existing review art; originals remain unchanged.
const root = fileURLToPath(new URL('../../', import.meta.url));
const inventory = JSON.parse(await fs.readFile(path.join(root, 'scripts/assets/catalog-inventory.json'), 'utf8'));
const output = path.join(root, 'docs/assets/media/catalog-thumbnails/v001');
await fs.mkdir(output, { recursive: true });
const sources = new Set();
for (const asset of inventory.assets) {
  const primary = asset.model_images[0] ?? asset.concept_images[0] ?? asset.thumbnail;
  if (!primary) throw new Error(`No thumbnail source for ${asset.id}`);
  sources.add(primary);
  if (asset.models.length && asset.concept_images.length) sources.add(asset.concept_images[0]);
}
const manifest = { version: 'v001', recipe: 'sharp: contain within 640x480, no enlargement, WebP quality 80; original composition preserved', files: [] };
for (const source of [...sources].sort()) {
  if (!source.startsWith('docs/assets/media/') || source.split('/').includes('..')) {
    throw new Error(`Thumbnail source outside asset media: ${source}`);
  }
  const original = await fs.readFile(path.join(root, source));
  const name = `${createHash('sha256').update(source).digest('hex').slice(0, 16)}.webp`;
  const bytes = await sharp(original)
    .resize({ width: 640, height: 480, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  await fs.writeFile(path.join(output, name), bytes);
  manifest.files.push({
    source,
    source_sha256: createHash('sha256').update(original).digest('hex'),
    path: `docs/assets/media/catalog-thumbnails/v001/${name}`,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}
await fs.writeFile(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Prepared ${manifest.files.length} thumbnails, ${manifest.files.reduce((n, file) => n + file.bytes, 0)} bytes`);
