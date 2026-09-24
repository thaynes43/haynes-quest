import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { InMemoryQuestStore } from '../../src/server/db/memory-store.js';
import type { SaveRecord } from '../../src/server/domain.js';

const ORIGIN = 'https://quest.test';
const SECRET = 'fixture-session-secret-that-is-at-least-32-characters';

function makeApp(store = new InMemoryQuestStore(), now?: () => Date) {
  return {
    store,
    app: createApp({
      store,
      fixtureMode: true,
      sessionSecret: SECRET,
      appOrigin: ORIGIN,
      clientDir: '/tmp/quest-client-not-present',
      studioDir: '/tmp/quest-studio-not-present',
      now,
    }),
  };
}

function makeEphemeralApp(store = InMemoryQuestStore.ephemeral()) {
  return {
    store,
    app: createApp({
      store,
      fixtureMode: true,
      ephemeralPlaytest: true,
      sessionSecret: SECRET,
      appOrigin: ORIGIN,
      clientDir: '/tmp/quest-client-not-present',
      studioDir: '/tmp/quest-studio-not-present',
    }),
  };
}

async function startSession(app: ReturnType<typeof makeApp>['app']) {
  const response = await app.request('/api/session');
  expect(response.status).toBe(200);
  const cookie = response.headers.get('set-cookie')!.split(';', 1)[0]!;
  const body = await response.json();
  return { cookie, body };
}

function mutation(cookie: string, body: unknown, extra: Record<string, string> = {}): RequestInit {
  return {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      cookie,
      origin: ORIGIN,
      'content-type': 'application/json',
      'x-quest-request': '1',
      ...extra,
    },
  };
}

async function createJourney(app: ReturnType<typeof makeApp>['app'], cookie: string) {
  const previewResponse = await app.request(
    '/api/setup/preview',
    mutation(cookie, { name: 'Demo Adventurer', birthDate: '2020-01-01' }),
  );
  expect(previewResponse.status).toBe(200);
  const preview = await previewResponse.json();
  const createResponse = await app.request(
    '/api/saves',
    mutation(cookie, { previewId: preview.previewId, selectedIds: preview.selectedIds }),
  );
  expect(createResponse.status).toBe(201);
  return createResponse.json();
}

async function startPlaytest(
  app: ReturnType<typeof makeApp>['app'],
  cookie: string,
  chapter: 1 | 2,
) {
  const response = await app.request('/api/playtest/start', mutation(cookie, { chapter }));
  expect(response.status).toBe(201);
  return response.json();
}

describe('fixture API', () => {
  it('assigns a signed durable identity instead of accepting a client identity', async () => {
    const { app } = makeApp();
    const first = await startSession(app);
    expect(first.body).toMatchObject({ mode: 'fixture', csrfHeader: 'X-Quest-Request' });
    expect(first.body.player.id).toMatch(/^[0-9a-f-]{36}$/);

    const resumed = await app.request('/api/session', { headers: { cookie: first.cookie, 'x-player-id': 'forged' } });
    expect((await resumed.json()).player.id).toBe(first.body.player.id);

    const forged = await app.request('/api/saves', { headers: { cookie: `${first.cookie}x` } });
    expect(forged.status).toBe(401);
  });

  it('renews an old fixture cookie into isolated ephemeral state without touching persisted progress', async () => {
    const persistent = makeApp();
    const oldSession = await startSession(persistent.app);
    const oldSave = await createJourney(persistent.app, oldSession.cookie);

    const ephemeral = makeEphemeralApp();
    const renewedResponse = await ephemeral.app.request('/api/session', {
      headers: { cookie: oldSession.cookie },
    });
    expect(renewedResponse.status).toBe(200);
    expect(renewedResponse.headers.get('set-cookie')).not.toBeNull();
    const renewedCookie = renewedResponse.headers.get('set-cookie')!.split(';', 1)[0]!;
    const renewed = await renewedResponse.json();
    expect(renewed).toMatchObject({
      mode: 'fixture',
      progressMode: 'ephemeral',
      csrfHeader: 'X-Quest-Request',
    });
    expect(renewed.player.id).not.toBe(oldSession.body.player.id);
    expect(await (await ephemeral.app.request('/api/saves', { headers: { cookie: renewedCookie } })).json())
      .toEqual({ saves: [] });

    const activeSave = await startPlaytest(ephemeral.app, renewedCookie, 1);
    expect((await ephemeral.app.request(`/api/saves/${activeSave.id}`, {
      headers: { cookie: renewedCookie },
    })).status).toBe(200);
    const pickup = activeSave.adventure.activeLevel.pickups[0];
    const applied = await ephemeral.app.request(
      `/api/saves/${activeSave.id}/actions`,
      mutation(renewedCookie, {
        actionId: randomUUID(),
        expectedRevision: activeSave.revision,
        action: {
          type: 'collect-equipment',
          levelId: activeSave.adventure.currentLevelId,
          pickupId: pickup.pickupId,
        },
      }),
    );
    expect(applied.status).toBe(200);
    expect(await applied.json()).toMatchObject({ revision: activeSave.revision + 1 });
    const stale = await ephemeral.app.request(
      `/api/saves/${activeSave.id}/actions`,
      mutation(renewedCookie, {
        actionId: randomUUID(),
        expectedRevision: activeSave.revision,
        action: {
          type: 'collect-equipment',
          levelId: activeSave.adventure.currentLevelId,
          pickupId: pickup.pickupId,
        },
      }),
    );
    expect(stale.status).toBe(409);
    expect((await stale.json()).error.code).toBe('SAVE_REVISION_STALE');
    expect(await (await ephemeral.app.request('/api/saves', { headers: { cookie: renewedCookie } })).json())
      .toEqual({ saves: [] });
    expect(await persistent.store.getSave(oldSession.body.player.id, oldSave.id)).toMatchObject({ id: oldSave.id });

    const resumedIdentity = await ephemeral.app.request('/api/session', {
      headers: { cookie: renewedCookie },
    });
    expect(resumedIdentity.headers.get('set-cookie')).toBeNull();
    expect((await resumedIdentity.json()).player).toEqual(renewed.player);
  });

  it('starts distinct fresh routes and repeats a fresh Besties shortcut across sessions', async () => {
    const ephemeral = makeEphemeralApp(InMemoryQuestStore.ephemeral({
      maxSessions: 2,
      maxPreviews: 3,
      maxSaves: 2,
    }));
    const { cookie } = await startSession(ephemeral.app);

    expect((await ephemeral.app.request('/api/playtest/start', mutation('', { chapter: 1 }))).status).toBe(401);

    const rejected = await ephemeral.app.request('/api/playtest/start', {
      method: 'POST',
      body: JSON.stringify({ chapter: 1 }),
      headers: { cookie, 'content-type': 'application/json', 'x-quest-request': '1' },
    });
    expect(rejected.status).toBe(403);
    const invalidChapter = await ephemeral.app.request(
      '/api/playtest/start',
      mutation(cookie, { chapter: 3 }),
    );
    expect(invalidChapter.status).toBe(422);
    const extraField = await ephemeral.app.request(
      '/api/playtest/start',
      mutation(cookie, { chapter: 1, saveId: 'forged' }),
    );
    expect(extraField.status).toBe(422);

    const first = await startPlaytest(ephemeral.app, cookie, 1);
    const second = await startPlaytest(ephemeral.app, cookie, 1);
    expect(second.id).not.toBe(first.id);
    expect(first).toMatchObject({
      ageYears: 0,
      abilities: ['move', 'interact', 'jump'],
      revision: 0,
      adventure: { planVersion: 'era-level-plan-v3', activeLevelIndex: 0 },
    });

    const besties = await startPlaytest(ephemeral.app, cookie, 2);
    expect(besties).toMatchObject({
      ageYears: 4,
      adventure: {
        planVersion: 'era-level-plan-v3',
        activeLevelIndex: 1,
        phase: 'exploring',
      },
    });
    expect(besties.revision).toBeGreaterThan(0);
    const firstBestiesBoss = besties.adventure.activeLevel.encounters.find(
      (encounter: { role: string }) => encounter.role === 'boss',
    );
    expect(firstBestiesBoss).toMatchObject({ hp: 11, maxHp: 11, defeated: false, available: true });

    const repeatedBesties = await startPlaytest(ephemeral.app, cookie, 2);
    expect(repeatedBesties.id).not.toBe(besties.id);
    expect(repeatedBesties).toMatchObject({
      ageYears: 4,
      adventure: { activeLevelIndex: 1, phase: 'exploring' },
    });
    expect(repeatedBesties.adventure.activeLevel.encounters.find(
      (encounter: { role: string }) => encounter.role === 'boss',
    )).toEqual(firstBestiesBoss);
    expect((await ephemeral.app.request(`/api/saves/${first.id}`, {
      headers: { cookie },
    })).status).toBe(404);
    expect(await (await ephemeral.app.request('/api/saves', { headers: { cookie } })).json())
      .toEqual({ saves: [] });

    const other = await startSession(ephemeral.app);
    const otherRun = await startPlaytest(ephemeral.app, other.cookie, 2);
    expect(otherRun).toMatchObject({
      ageYears: 4,
      adventure: { activeLevelIndex: 1, phase: 'exploring' },
    });
    expect(otherRun.adventure.activeLevel.encounters.find(
      (encounter: { role: string }) => encounter.role === 'boss',
    )).toEqual(firstBestiesBoss);
    expect((await ephemeral.app.request(`/api/saves/${second.id}`, {
      headers: { cookie },
    })).status).toBe(404);

    const persistent = makeApp();
    const persistentSession = await startSession(persistent.app);
    expect((await persistent.app.request(
      '/api/playtest/start',
      mutation(persistentSession.cookie, { chapter: 1 }),
    )).status).toBe(404);
  });

  it('rejects stale ephemeral selections before asking the store to create a save', async () => {
    const { app, store } = makeEphemeralApp();
    const { cookie } = await startSession(app);
    const preview = await (
      await app.request(
        '/api/setup/preview',
        mutation(cookie, { name: 'Demo Adventurer', birthDate: '2020-01-01' }),
      )
    ).json();
    expect(preview.selectedIds).toHaveLength(6);
    const createSave = vi.spyOn(store, 'createSave');

    for (const selectedIds of [
      preview.selectedIds.slice(0, 5),
      [...preview.selectedIds, 'unissued-memory'],
    ]) {
      const stale = await app.request(
        '/api/saves',
        mutation(cookie, { previewId: preview.previewId, selectedIds }),
      );
      expect(stale.status).toBe(422);
      expect(await stale.json()).toEqual({
        error: { code: 'INVALID_SELECTION', message: 'Invalid selection' },
      });
    }
    expect(createSave).not.toHaveBeenCalled();

    const current = await app.request(
      '/api/saves',
      mutation(cookie, {
        previewId: preview.previewId,
        selectedIds: preview.selectedIds,
      }),
    );
    expect(current.status).toBe(201);
    expect(createSave).toHaveBeenCalledOnce();
  });

  it('globally caps new fixture identities while established sessions still resume', async () => {
    const { app } = makeApp();
    const establishedResponse = await app.request('/api/session', {
      headers: { 'user-agent': 'fixture-client-established' },
    });
    expect(establishedResponse.status).toBe(200);
    const establishedCookie = establishedResponse.headers.get('set-cookie')!.split(';', 1)[0]!;
    const establishedPlayer = (await establishedResponse.json()).player;

    for (let index = 1; index < 120; index += 1) {
      const response = await app.request('/api/session', {
        headers: { 'user-agent': `rotating-fixture-client-${index}` },
      });
      expect(response.status).toBe(200);
    }

    const capped = await app.request('/api/session', {
      headers: { 'user-agent': 'rotating-fixture-client-over-limit' },
    });
    expect(capped.status).toBe(429);
    expect(await capped.json()).toEqual({
      error: { code: 'RATE_LIMITED', message: 'Too many requests' },
    });

    const resumed = await app.request('/api/session', {
      headers: {
        cookie: establishedCookie,
        'user-agent': 'fixture-client-resuming-after-limit',
      },
    });
    expect(resumed.status).toBe(200);
    expect((await resumed.json()).player).toEqual(establishedPlayer);
    expect(resumed.headers.get('set-cookie')).toBeNull();
  });

  it('bounds public fictional fixture media reads independently by user agent', async () => {
    const { app } = makeEphemeralApp();
    const request = { headers: { 'user-agent': 'fixture-catalog-reader' } };

    for (let index = 0; index < 120; index += 1) {
      const response = await app.request('/api/fixture-media/demo-memory-2020-07', request);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/svg+xml; charset=utf-8');
      expect(response.headers.get('cache-control')).toBe('no-store');
    }

    const capped = await app.request('/api/fixture-media/demo-memory-2020-07', request);
    expect(capped.status).toBe(429);
    expect(await capped.json()).toEqual({
      error: { code: 'RATE_LIMITED', message: 'Too many requests' },
    });
    expect(capped.headers.get('cache-control')).toBe('no-store');

    const separateAgent = await app.request('/api/fixture-media/demo-memory-2020-07', {
      headers: { 'user-agent': 'fixture-catalog-reader-2' },
    });
    expect(separateAgent.status).toBe(200);
  });

  it('requires same-origin JSON and the explicit CSRF header for mutations', async () => {
    const { app } = makeApp();
    const { cookie } = await startSession(app);
    const body = { name: 'Demo Adventurer', birthDate: '2020-01-01' };

    const noOrigin = await app.request('/api/setup/preview', {
      method: 'POST', body: JSON.stringify(body), headers: { cookie, 'content-type': 'application/json', 'x-quest-request': '1' },
    });
    expect(noOrigin.status).toBe(403);
    expect((await noOrigin.json()).error.code).toBe('ORIGIN_REJECTED');

    const noCsrf = await app.request('/api/setup/preview', {
      method: 'POST', body: JSON.stringify(body), headers: { cookie, origin: ORIGIN, 'content-type': 'application/json' },
    });
    expect(noCsrf.status).toBe(403);

    const form = await app.request('/api/setup/preview', {
      method: 'POST', body: 'name=x', headers: { cookie, origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded', 'x-quest-request': '1' },
    });
    expect(form.status).toBe(415);
  });

  it('freezes a bounded chronological manifest and validates selection', async () => {
    const { app } = makeApp();
    const { cookie } = await startSession(app);
    const previewResponse = await app.request(
      '/api/setup/preview',
      mutation(cookie, { name: 'Demo Adventurer', birthDate: '2020-01-01', limit: 2 }),
    );
    const preview = await previewResponse.json();
    expect(preview.candidates.map((memory: { date: string }) => memory.date)).toEqual([
      '2020-07-01', '2024-01-01', '2027-01-01',
    ]);
    expect(preview.selectedIds).toEqual(['demo-memory-2020-07', 'demo-memory-2027-01']);
    expect(preview.coverage).toEqual({ fromDate: '2020-07-01', toDate: '2027-01-01', incomplete: false, scanned: 3 });

    const duplicate = await app.request(
      '/api/saves',
      mutation(cookie, { previewId: preview.previewId, selectedIds: [preview.selectedIds[0], preview.selectedIds[0]] }),
    );
    expect(duplicate.status).toBe(422);

    const unissued = await app.request(
      '/api/saves',
      mutation(cookie, { previewId: preview.previewId, selectedIds: ['unissued-memory'] }),
    );
    expect(unissued.status).toBe(422);
  });

  it('freezes the two-level fixture arc and rejects forged or retired progression commands', async () => {
    const { app } = makeApp();
    const { cookie } = await startSession(app);
    const save = await createJourney(app, cookie);
    expect(save).toMatchObject({
      format: 'era-combat-v2',
      ageYears: 0,
      abilities: ['move', 'interact'],
      revision: 0,
      adventure: {
        phase: 'exploring',
        activeLevel: { eraYear: 2020, startAgeYears: 0, targetAgeYears: 4 },
      },
    });
    expect(save.adventure.activeLevel.memoryIds).toEqual([
      'demo-memory-2020-07',
      'demo-memory-2024-01',
    ]);
    expect(save.memories.map((memory: { state: string }) => memory.state)).toEqual([
      'locked', 'locked', 'locked',
    ]);

    const forged = await app.request(
      `/api/saves/${save.id}/actions`,
      mutation(cookie, {
        actionId: randomUUID(),
        expectedRevision: 0,
        action: { type: 'attack', levelId: save.adventure.currentLevelId, encounterId: 'forged', damage: 999 },
      }),
    );
    expect(forged.status).toBe(422);

    const retired = await app.request(
      `/api/saves/${save.id}/recover`,
      mutation(cookie, { memoryId: save.memories[0].id }),
    );
    expect(retired.status).toBe(409);
    expect((await retired.json()).error.code).toBe('ACTION_ROUTE_RETIRED');
  });

  it('keeps save creation idempotent while the old finish route cannot bypass combat', async () => {
    const { app } = makeApp();
    const { cookie } = await startSession(app);
    const preview = await (
      await app.request('/api/setup/preview', mutation(cookie, { name: 'Demo Adventurer', birthDate: '2020-01-01' }))
    ).json();
    const command = { previewId: preview.previewId, selectedIds: preview.selectedIds };
    const first = await (await app.request('/api/saves', mutation(cookie, command))).json();
    const retried = await (await app.request('/api/saves', mutation(cookie, command))).json();
    expect(retried.id).toBe(first.id);

    const retired = await app.request(`/api/saves/${first.id}/finish`, mutation(cookie, {}));
    expect(retired.status).toBe(409);
    expect((await retired.json()).error.code).toBe('ACTION_ROUTE_RETIRED');
  });

  it('hides saves and media from another fixture identity', async () => {
    const { app } = makeApp();
    const owner = await startSession(app);
    const stranger = await startSession(app);
    const save = await createJourney(app, owner.cookie);

    const hiddenSave = await app.request(`/api/saves/${save.id}`, { headers: { cookie: stranger.cookie } });
    expect(hiddenSave.status).toBe(404);
    const hiddenMedia = await app.request(`/api/saves/${save.id}/media/${save.memories[0].id}`, {
      headers: { cookie: stranger.cookie },
    });
    expect(hiddenMedia.status).toBe(404);
    const hiddenAction = await app.request(
      `/api/saves/${save.id}/actions`,
      mutation(stranger.cookie, {
        actionId: randomUUID(),
        expectedRevision: save.revision,
        action: {
          type: 'collect-equipment',
          levelId: save.adventure.currentLevelId,
          pickupId: save.adventure.activeLevel.pickups[0].pickupId,
        },
      }),
    );
    expect(hiddenAction.status).toBe(404);

    const media = await app.request(`/api/saves/${save.id}/media/${save.memories[0].id}`, {
      headers: { cookie: owner.cookie },
    });
    expect(media.status).toBe(409);
    expect((await media.json()).error.code).toBe('MEDIA_LOCKED');
  });

  it('serves studio WAV files with their audio MIME across full and range responses', async () => {
    const studioDir = await mkdtemp(join(tmpdir(), 'quest-studio-'));
    const wav = Uint8Array.from([
      0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    ]);
    try {
      await mkdir(join(studioDir, 'assets'));
      await writeFile(join(studioDir, 'index.html'), '<!doctype html><title>Studio</title>');
      await writeFile(join(studioDir, 'assets', 'memory-keepsake.glb'), 'fixture glTF');
      await writeFile(join(studioDir, 'cue.wav'), wav);
      const app = createApp({
        store: new InMemoryQuestStore(),
        fixtureMode: true,
        sessionSecret: SECRET,
        appOrigin: ORIGIN,
        clientDir: studioDir,
        studioDir,
      });

      const redirect = await app.request('/studio');
      expect(redirect.status).toBe(308);
      expect(redirect.headers.get('cache-control')).toBe('no-cache');

      const index = await app.request('/studio/');
      expect(index.status).toBe(200);
      expect(index.headers.get('content-type')).toContain('text/html');
      expect(index.headers.get('cache-control')).toBe('no-cache');

      const model = await app.request('/studio/assets/memory-keepsake.glb');
      expect(model.status).toBe(200);
      expect(model.headers.get('content-type')).toBe('model/gltf-binary');
      expect(model.headers.get('cache-control')).toBe('no-cache');

      const full = await app.request('/studio/cue.wav');
      expect(full.status).toBe(200);
      expect(full.headers.get('content-type')).toBe('audio/wav');
      expect(full.headers.get('cache-control')).toBe('no-cache');
      expect(full.headers.get('x-content-type-options')).toBe('nosniff');
      expect(new Uint8Array(await full.arrayBuffer())).toEqual(wav);

      const range = await app.request('/studio/cue.wav', {
        headers: { range: 'bytes=4-7' },
      });
      expect(range.status).toBe(206);
      expect(range.headers.get('content-type')).toBe('audio/wav');
      expect(range.headers.get('cache-control')).toBe('no-cache');
      expect(range.headers.get('accept-ranges')).toBe('bytes');
      expect(range.headers.get('content-range')).toBe(`bytes 4-7/${wav.length}`);
      expect(range.headers.get('content-length')).toBe('4');
      expect(new Uint8Array(await range.arrayBuffer())).toEqual(wav.slice(4, 8));

      const missing = await app.request('/studio/missing.wav');
      expect(missing.status).toBe(404);
      expect(missing.headers.get('cache-control')).toBe('no-cache');
    } finally {
      await rm(studioDir, { recursive: true, force: true });
    }
  });

  it('prevents stale app shells while caching content-hashed client assets immutably', async () => {
    const clientDir = await mkdtemp(join(tmpdir(), 'quest-client-'));
    try {
      await mkdir(join(clientDir, 'assets'));
      await writeFile(join(clientDir, 'index.html'), '<!doctype html><script src="/assets/index-AbCd1234.js"></script>');
      await writeFile(join(clientDir, 'assets', 'index-AbCd1234.js'), 'globalThis.quest = true;');
      await writeFile(join(clientDir, 'assets', 'chapter-Ab_cd-12.css'), '.chapter {}');
      await writeFile(join(clientDir, 'assets', 'runtime.js'), 'globalThis.runtime = true;');
      await writeFile(join(clientDir, 'assets', 'runtime-longfilename.js'), 'globalThis.runtime = true;');
      await writeFile(join(clientDir, 'assets', 'index-AbCd12345.js'), 'globalThis.runtime = true;');
      await writeFile(join(clientDir, 'assets', 'memory-keepsake.glb'), 'fixture glTF');
      const app = createApp({
        store: new InMemoryQuestStore(),
        fixtureMode: true,
        sessionSecret: SECRET,
        appOrigin: ORIGIN,
        clientDir,
        studioDir: '/tmp/quest-studio-not-present',
      });

      const shell = await app.request('/');
      expect(shell.status).toBe(200);
      expect(shell.headers.get('cache-control')).toBe('no-store');

      const hashed = await app.request('/assets/index-AbCd1234.js');
      expect(hashed.status).toBe(200);
      expect(hashed.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');

      const hashedChunk = await app.request('/assets/chapter-Ab_cd-12.css');
      expect(hashedChunk.status).toBe(200);
      expect(hashedChunk.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');

      for (const path of [
        '/assets/runtime.js',
        '/assets/runtime-longfilename.js',
        '/assets/index-AbCd12345.js',
        '/assets/memory-keepsake.glb',
      ]) {
        const unhashed = await app.request(path);
        expect(unhashed.status).toBe(200);
        expect(unhashed.headers.get('cache-control')).toBe('no-cache');
      }
    } finally {
      await rm(clientDir, { recursive: true, force: true });
    }
  });

  it('serves the icons the app shell links and nothing else from the client root', async () => {
    const icons = [
      ['favicon.ico', 'image/x-icon'],
      ['favicon.svg', 'image/svg+xml'],
      ['apple-touch-icon.png', 'image/png'],
    ];
    const shell = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
    const linked = [...shell.matchAll(/<link rel="(?:icon|apple-touch-icon)" href="\/([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(linked.sort()).toEqual(icons.map(([icon]) => icon).sort());

    const clientDir = await mkdtemp(join(tmpdir(), 'quest-client-'));
    try {
      for (const [icon] of icons) {
        await copyFile(new URL(`../../public/${icon}`, import.meta.url), join(clientDir, icon));
      }
      await writeFile(join(clientDir, 'notes.txt'), 'not an icon');
      const app = createApp({
        store: new InMemoryQuestStore(),
        fixtureMode: true,
        sessionSecret: SECRET,
        appOrigin: ORIGIN,
        clientDir,
        studioDir: '/tmp/quest-studio-not-present',
      });

      for (const [icon, type] of icons) {
        const response = await app.request(`/${icon}`);
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain(type);
        expect(response.headers.get('cache-control')).toBe('no-cache');
      }
      expect((await app.request('/notes.txt')).status).toBe(404);
    } finally {
      await rm(clientDir, { recursive: true, force: true });
    }
  });

  it('fails closed when fixture and private adapters are mixed or production has no auth', async () => {
    const store = new InMemoryQuestStore();
    expect(() => createApp({
      store,
      fixtureMode: true,
      sessionSecret: SECRET,
      appOrigin: ORIGIN,
      clientDir: '/tmp/none',
      studioDir: '/tmp/none',
      photoSource: {} as never,
    })).toThrow('private photo source');

    expect(() => createApp({
      store,
      fixtureMode: false,
      ephemeralPlaytest: true,
      sessionSecret: SECRET,
      appOrigin: ORIGIN,
      clientDir: '/tmp/none',
      studioDir: '/tmp/none',
    })).toThrow('requires fixture mode');

    expect(() => createApp({
      store: {} as never,
      fixtureMode: true,
      ephemeralPlaytest: true,
      sessionSecret: SECRET,
      appOrigin: ORIGIN,
      clientDir: '/tmp/none',
      studioDir: '/tmp/none',
    })).toThrow('requires in-memory storage');

    const production = createApp({
      store,
      fixtureMode: false,
      sessionSecret: SECRET,
      appOrigin: ORIGIN,
      clientDir: '/tmp/none',
      studioDir: '/tmp/none',
    });
    expect((await production.request('/api/session')).status).toBe(404);
    expect((await production.request('/api/saves')).status).toBe(401);
  });

  it('returns a safe 503 and records only bounded diagnostics for unexpected failures', async () => {
    const sentinel = 'postgres://private:credential@db/source-person-id?cookie=secret';
    const privateRouteValue = 'private-save-id-from-request-url';
    class FailingStore extends InMemoryQuestStore {
      override async getSave(): Promise<never> {
        throw new TypeError(sentinel);
      }
    }
    const diagnostics: unknown[] = [];
    const store = new FailingStore();
    const app = createApp({
      store,
      fixtureMode: true,
      sessionSecret: SECRET,
      appOrigin: ORIGIN,
      clientDir: '/tmp/quest-client-not-present',
      studioDir: '/tmp/quest-studio-not-present',
      diagnosticSink: (diagnostic) => diagnostics.push(diagnostic),
    });
    const { cookie } = await startSession(app);

    const response = await app.request(`/api/saves/${privateRouteValue}`, { headers: { cookie } });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Service unavailable' },
    });
    expect(diagnostics).toEqual([{
      event: 'api_request_failed',
      errorClass: 'type-error',
      method: 'GET',
      route: '/api/saves/:id',
    }]);
    const serialized = JSON.stringify(diagnostics);
    expect(serialized).not.toContain(sentinel);
    expect(serialized).not.toContain(privateRouteValue);
    expect(serialized).not.toContain(cookie);
  });
  it('records a bounded diagnostic for server-side AppError failures and none for client errors', async () => {
    const diagnostics: unknown[] = [];
    const store = new InMemoryQuestStore();
    const app = createApp({
      store,
      fixtureMode: true,
      sessionSecret: SECRET,
      appOrigin: ORIGIN,
      clientDir: '/tmp/quest-client-not-present',
      studioDir: '/tmp/quest-studio-not-present',
      diagnosticSink: (diagnostic) => diagnostics.push(diagnostic),
    });
    const { cookie } = await startSession(app);
    const save = await createJourney(app, cookie);

    expect((await app.request('/api/saves/missing-save', { headers: { cookie } })).status).toBe(404);
    expect((await app.request(`/api/saves/${save.id}/actions`, mutation(cookie, {}))).status).toBe(422);
    expect(diagnostics).toEqual([]);

    // Corrupt the stored record so the read path's own validation fails closed.
    const records = (store as unknown as { saves: Map<string, SaveRecord> }).saves;
    records.get(save.id)!.adventureState!.playerHp = 999;
    const response = await app.request(`/api/saves/${save.id}`, { headers: { cookie } });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: { code: 'SAVE_DATA_INVALID', message: 'Save unavailable' },
    });
    expect(diagnostics).toEqual([{
      event: 'api_request_failed',
      errorClass: 'app-error',
      method: 'GET',
      route: '/api/saves/:id',
      code: 'SAVE_DATA_INVALID',
      status: 503,
    }]);
    const serialized = JSON.stringify(diagnostics);
    expect(serialized).not.toContain(save.id);
    expect(serialized).not.toContain(cookie);
    expect(serialized).not.toContain('2020');
    expect(serialized).not.toContain('Demo Adventurer');
  });
});
