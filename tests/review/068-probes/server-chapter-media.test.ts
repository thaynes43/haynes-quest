import { describe, expect, it } from 'vitest';
import { makeEphemeralApp, startPlaytest, startSession } from './helpers.js';

describe('WO068 probe: v3 media gating over HTTP', () => {
  it('opens minors, locks the major until victory and locks the next chapter', async () => {
    const { app } = makeEphemeralApp();
    const { cookie } = await startSession(app);
    const { body: save } = await startPlaytest(app, cookie, 1);
    const level = save.adventure.activeLevel;
    const nextChapterMemory = save.memories.find(
      (memory: { id: string }) => ![...level.minorMemoryIds, level.majorMemoryId].includes(memory.id),
    )!;
    const get = async (memoryId: string) =>
      app.request(`/api/saves/${save.id}/media/${memoryId}`, { headers: { cookie } });

    const minor = await get(level.minorMemoryIds[0]);
    const major = await get(level.majorMemoryId);
    const later = await get(nextChapterMemory.id);
    const unknown = await get('not-a-memory');
    console.log('OBSERVED media statuses', minor.status, major.status, later.status, unknown.status);
    expect([
      minor.status,
      minor.headers.get('cache-control'),
      major.status,
      (await major.json()).error.code,
      later.status,
      (await later.json()).error.code,
      unknown.status,
    ]).toEqual([200, 'no-store', 409, 'MEDIA_LOCKED', 409, 'MEDIA_LOCKED', 404]);
  });
});

describe('WO068 probe: chapter-two preparation', () => {
  it('does not return a save stamped in the future', async () => {
    const clock = new Date();
    const { app } = makeEphemeralApp(undefined, () => clock);
    const { cookie } = await startSession(app);
    const { body: save } = await startPlaytest(app, cookie, 2);
    const driftMs = new Date(save.updatedAt).valueOf() - clock.valueOf();
    console.log('OBSERVED chapter-2 updatedAt drift ms', driftMs, save.updatedAt);
    expect(driftMs).toBeLessThanOrEqual(0);
  });

  it('lands in chapter two with the documented state', async () => {
    const { app } = makeEphemeralApp();
    const { cookie } = await startSession(app);
    const { status, body: save } = await startPlaytest(app, cookie, 2);
    expect(status).toBe(201);
    console.log('OBSERVED chapter-2 body', JSON.stringify(save).slice(0, 120));
    const level = save.adventure.activeLevel;
    expect({
      phase: save.adventure.phase,
      activeLevelIndex: save.adventure.activeLevelIndex,
      ageYears: save.ageYears,
      abilities: save.abilities,
      appearance: save.appearance.stage,
      consumed: save.memories.filter((m: { state: string }) => m.state === 'consumed').length,
      friendlies: level.friendlies.map((f: { hp: number; defeated: boolean; boonClaimed: boolean }) =>
        `${f.hp}/${f.defeated}/${f.boonClaimed}`),
      playerHp: save.adventure.playerHp,
      encountersDefeated: level.encounters.filter((e: { defeated: boolean }) => e.defeated).length,
      inventory: save.adventure.inventory.length,
    }).toEqual({
      phase: 'exploring',
      activeLevelIndex: 1,
      ageYears: 4,
      abilities: ['move', 'interact', 'jump'],
      appearance: 'child',
      consumed: 3,
      friendlies: ['4/false/false', '4/false/false', '4/false/false'],
      playerHp: 10,
      encountersDefeated: 0,
      inventory: 1,
    });
  });

  it('accepts an immediate attack in chapter two despite the future timestamp', async () => {
    const clock = new Date();
    const { app } = makeEphemeralApp(undefined, () => clock);
    const { cookie } = await startSession(app);
    const started = await startPlaytest(app, cookie, 2);
    console.log('OBSERVED frozen-clock start', started.status, JSON.stringify(started.body).slice(0, 120));
    const save = started.body;
    const level = save.adventure.activeLevel;
    const attackPickup = level.pickups.find((p: { kind: string }) => p.kind === 'attack-tool');
    const { randomUUID } = await import('node:crypto');
    const { mutation } = await import('./helpers.js');
    const collected = await app.request(`/api/saves/${save.id}/actions`, mutation(cookie, {
      actionId: randomUUID(),
      expectedRevision: save.revision,
      action: { type: 'collect-equipment', levelId: level.id, pickupId: attackPickup.pickupId },
    }));
    const collectedBody = await collected.json();
    const attacked = await app.request(`/api/saves/${save.id}/actions`, mutation(cookie, {
      actionId: randomUUID(),
      expectedRevision: collectedBody.revision,
      action: { type: 'attack', levelId: level.id, encounterId: level.encounters[0].id },
    }));
    const attackedBody = await attacked.json();
    console.log('OBSERVED chapter-2 first attack', collected.status, attacked.status, JSON.stringify(attackedBody).slice(0, 160));
    expect([collected.status, attacked.status]).toEqual([200, 200]);
  });
});
