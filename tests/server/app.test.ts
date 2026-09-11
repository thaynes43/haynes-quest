import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { InMemoryQuestStore } from '../../src/server/db/memory-store.js';

const ORIGIN = 'https://quest.test';
const SECRET = 'fixture-session-secret-that-is-at-least-32-characters';

function makeApp(store = new InMemoryQuestStore()) {
  return {
    store,
    app: createApp({
      store,
      fixtureMode: true,
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

  it('recovers memories monotonically and idempotently with server-derived progression', async () => {
    const { app } = makeApp();
    const { cookie } = await startSession(app);
    const save = await createJourney(app, cookie);
    expect(save).toMatchObject({ ageYears: 0, abilities: ['move', 'interact'], revision: 0 });

    const outOfOrder = await app.request(
      `/api/saves/${save.id}/recover`,
      mutation(cookie, { memoryId: save.memories[1].id }),
    );
    expect(outOfOrder.status).toBe(409);
    expect((await outOfOrder.json()).error.code).toBe('MEMORY_OUT_OF_ORDER');

    const forged = await app.request(
      `/api/saves/${save.id}/recover`,
      mutation(cookie, { memoryId: save.memories[0].id, ageYears: 99, abilities: ['jump'] }),
    );
    expect(forged.status).toBe(422);

    const [first, duplicate] = await Promise.all([
      app.request(`/api/saves/${save.id}/recover`, mutation(cookie, { memoryId: save.memories[0].id })),
      app.request(`/api/saves/${save.id}/recover`, mutation(cookie, { memoryId: save.memories[0].id })),
    ]);
    const firstView = await first.json();
    const duplicateView = await duplicate.json();
    expect(firstView.revision).toBe(1);
    expect(duplicateView.revision).toBe(1);
    expect(firstView.recoveredIds).toEqual([save.memories[0].id]);

    const second = await app.request(
      `/api/saves/${save.id}/recover`,
      mutation(cookie, { memoryId: save.memories[1].id }),
    );
    expect(await second.json()).toMatchObject({ ageYears: 4, abilities: ['move', 'interact', 'jump'], revision: 2 });
  });

  it('makes save creation and finishing recoverable idempotent operations', async () => {
    const { app } = makeApp();
    const { cookie } = await startSession(app);
    const preview = await (
      await app.request('/api/setup/preview', mutation(cookie, { name: 'Demo Adventurer', birthDate: '2020-01-01' }))
    ).json();
    const command = { previewId: preview.previewId, selectedIds: preview.selectedIds };
    const first = await (await app.request('/api/saves', mutation(cookie, command))).json();
    const retried = await (await app.request('/api/saves', mutation(cookie, command))).json();
    expect(retried.id).toBe(first.id);

    const tooSoon = await app.request(`/api/saves/${first.id}/finish`, mutation(cookie, {}));
    expect(tooSoon.status).toBe(409);
    for (const memory of first.memories) {
      await app.request(`/api/saves/${first.id}/recover`, mutation(cookie, { memoryId: memory.id }));
    }
    const finished = await (await app.request(`/api/saves/${first.id}/finish`, mutation(cookie, {}))).json();
    const finishedAgain = await (await app.request(`/api/saves/${first.id}/finish`, mutation(cookie, {}))).json();
    expect(finished.completed).toBe(true);
    expect(finishedAgain.revision).toBe(finished.revision);
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

    const media = await app.request(`/api/saves/${save.id}/media/${save.memories[0].id}`, {
      headers: { cookie: owner.cookie },
    });
    expect(media.status).toBe(200);
    expect(media.headers.get('cache-control')).toBe('no-store');
    expect(media.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await media.text()).toContain('Synthetic memory');
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
});
