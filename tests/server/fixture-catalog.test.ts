import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { fixtureSvg } from '../../src/server/media.js';
import { FixturePhotoSource } from '../../src/server/photos/fixture.js';

it('publishes the exact six playable fixture pictures in the review catalog', async () => {
  const source = new FixturePhotoSource(true);
  const resolution = await source.resolveName('Demo Adventurer');
  if (resolution.kind !== 'exact') throw new Error('Fixture subject unavailable');
  const discovery = await source.discover(resolution.subjects[0]!, {
    name: 'Demo Adventurer', birthDate: '2020-01-01',
  });
  const manifest = JSON.parse(await readFile('docs/assets/media/fixture-memories/v001/manifest.json', 'utf8'));
  const pictures = manifest.files.filter((file: {role: string}) => file.role === 'fixture-picture');
  expect(pictures.map((file: {fixture_key: string}) => file.fixture_key)).toEqual(discovery.memories.map(memory => memory.id));
  expect(pictures).toHaveLength(6);
  const inventory = JSON.parse(await readFile('scripts/assets/catalog-inventory.json', 'utf8'));
  const entry = inventory.assets.find((asset: {id: string}) => asset.id === 'fixture-route-memories');
  expect(entry).toBeDefined();
  for (const file of pictures) {
    const bytes = await readFile(file.path);
    expect(bytes.toString()).toBe(fixtureSvg(file.fixture_key));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256);
    expect(entry.checksums[file.path]).toBe(file.sha256);
  }
  expect(new Set(pictures.map((file: {sha256: string}) => file.sha256)).size).toBe(6);
});
