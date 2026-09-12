import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ORIGIN, makeEphemeralApp, mutation, startPlaytest, startSession } from './helpers.js';

describe('WO068 probe: ownership, CSRF and unauthenticated surface', () => {
  it('keeps another session out of the chapter-two save', async () => {
    const { app } = makeEphemeralApp();
    const owner = await startSession(app);
    const chapter = await startPlaytest(app, owner.cookie, 2);
    expect(chapter.status).toBe(201);
    const intruder = await startSession(app);
    const memoryId = chapter.body.memories[0].id;

    const read = await app.request(`/api/saves/${chapter.body.id}`, { headers: { cookie: intruder.cookie } });
    const media = await app.request(`/api/saves/${chapter.body.id}/media/${memoryId}`, {
      headers: { cookie: intruder.cookie },
    });
    const action = await app.request(
      `/api/saves/${chapter.body.id}/actions`,
      mutation(intruder.cookie, {
        actionId: randomUUID(),
        expectedRevision: chapter.body.revision,
        action: { type: 'attack', levelId: chapter.body.adventure.currentLevelId, encounterId: 'x' },
      }),
    );
    expect([read.status, media.status, action.status]).toEqual([404, 404, 404]);
  });

  it('rejects a missing/wrong origin and a missing CSRF header on the playtest start', async () => {
    const { app } = makeEphemeralApp();
    const { cookie } = await startSession(app);
    const noOrigin = await app.request('/api/playtest/start', {
      method: 'POST',
      body: JSON.stringify({ chapter: 1 }),
      headers: { cookie, 'content-type': 'application/json', 'x-quest-request': '1' },
    });
    const badOrigin = await app.request('/api/playtest/start', {
      method: 'POST',
      body: JSON.stringify({ chapter: 1 }),
      headers: { cookie, origin: 'https://evil.test', 'content-type': 'application/json', 'x-quest-request': '1' },
    });
    const noCsrf = await app.request('/api/playtest/start', {
      method: 'POST',
      body: JSON.stringify({ chapter: 1 }),
      headers: { cookie, origin: ORIGIN, 'content-type': 'application/json' },
    });
    const noSession = await app.request('/api/playtest/start', mutation('', { chapter: 1 }));
    expect([noOrigin.status, badOrigin.status, noCsrf.status, noSession.status]).toEqual([403, 403, 403, 401]);
  });

  it('serves fixture media without any session and without the per-owner limiter', async () => {
    const { app } = makeEphemeralApp();
    const responses: number[] = [];
    for (let index = 0; index < 400; index += 1) {
      const response = await app.request('/api/fixture-media/demo-memory-2020-07');
      responses.push(response.status);
    }
    console.log('OBSERVED anonymous fixture-media statuses', [...new Set(responses)].join(','));
    expect(new Set(responses)).toEqual(new Set([200]));
  });

  it('marks every /api error response no-store', async () => {
    const { app } = makeEphemeralApp();
    const unauthorized = await app.request('/api/saves');
    const notFound = await app.request('/api/saves/nope', {
      headers: { cookie: (await startSession(app)).cookie },
    });
    console.log(
      'OBSERVED error cache-control',
      unauthorized.status, unauthorized.headers.get('cache-control'),
      notFound.status, notFound.headers.get('cache-control'),
    );
    expect([unauthorized.headers.get('cache-control'), notFound.headers.get('cache-control')])
      .toEqual(['no-store', 'no-store']);
  });
});
