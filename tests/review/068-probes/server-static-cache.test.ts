import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../src/server/app.js';
import { InMemoryQuestStore } from '../../../src/server/db/memory-store.js';
import { ORIGIN, SECRET } from './helpers.js';

async function staticApp() {
  const root = await mkdtemp(join(tmpdir(), 'wo068-static-'));
  const clientDir = join(root, 'client');
  const studioDir = join(root, 'studio');
  await mkdir(join(clientDir, 'assets'), { recursive: true });
  await mkdir(join(studioDir, 'assets', 'media', 'bestie-pink', 'v001'), { recursive: true });
  await writeFile(join(clientDir, 'index.html'), '<!doctype html><title>quest</title>');
  await writeFile(join(clientDir, 'assets', 'index-Bx3kQ9a1.js'), 'export const hashed = 1;');
  // A plausible unhashed art/asset name shipped beside the bundles.
  await writeFile(join(clientDir, 'assets', 'memory-keepsake.glb'), 'glTF-not-hashed');
  await writeFile(join(clientDir, 'assets', 'logo.png'), 'png');
  await writeFile(
    join(studioDir, 'assets', 'media', 'bestie-pink', 'v001', 'bestie-pink.glb'),
    'glTF-studio',
  );
  const store = InMemoryQuestStore.ephemeral();
  return createApp({
    store,
    fixtureMode: true,
    ephemeralPlaytest: true,
    sessionSecret: SECRET,
    appOrigin: ORIGIN,
    clientDir,
    studioDir,
  });
}

describe('WO068 probe: static cache policy', () => {
  it('marks only content-hashed bundles immutable', async () => {
    const app = await staticApp();
    const shell = await app.request('/');
    const hashed = await app.request('/assets/index-Bx3kQ9a1.js');
    const unhashed = await app.request('/assets/memory-keepsake.glb');
    const plain = await app.request('/assets/logo.png');
    console.log('OBSERVED client cache-control', JSON.stringify({
      shell: [shell.status, shell.headers.get('cache-control')],
      hashed: [hashed.status, hashed.headers.get('cache-control')],
      unhashed: [unhashed.status, unhashed.headers.get('cache-control')],
      plain: [plain.status, plain.headers.get('cache-control')],
    }));
    expect({
      shell: shell.headers.get('cache-control'),
      hashed: hashed.headers.get('cache-control'),
      unhashed: unhashed.headers.get('cache-control'),
      plain: plain.headers.get('cache-control'),
    }).toEqual({
      shell: 'no-store',
      hashed: 'public, max-age=31536000, immutable',
      unhashed: 'no-cache',
      plain: 'no-cache',
    });
  });

  it('gives studio artwork a cache policy or a validator', async () => {
    const app = await staticApp();
    const model = await app.request('/studio/assets/media/bestie-pink/v001/bestie-pink.glb');
    const headers = Object.fromEntries([...model.headers.entries()]);
    console.log('OBSERVED studio model headers', model.status, JSON.stringify(headers));
    // WO063 claims "Studio media keeps its existing revalidation behavior".
    expect({
      status: model.status,
      cacheControl: headers['cache-control'] ?? null,
      etag: headers.etag ?? null,
      lastModified: headers['last-modified'] ?? null,
    }).toEqual({ status: 200, cacheControl: 'no-cache', etag: null, lastModified: null });
  });
});
