import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createAdventurePlan } from '../../src/shared/adventure.js';
import type { GameplayAction, GameplayActionRequest, SaveView } from '../../src/shared/contracts.js';
import { createApp } from '../../src/server/app.js';
import { InMemoryQuestStore } from '../../src/server/db/memory-store.js';
import type { SaveRecord } from '../../src/server/domain.js';
import { signToken } from '../../src/server/security.js';

const ORIGIN = 'https://quest.test';
const SECRET = 'fixture-session-secret-that-is-at-least-32-characters';

class TestClock {
  private value = Date.parse('2026-09-11T12:00:00.000Z');
  now = (): Date => new Date(this.value);
  advance(milliseconds: number): void {
    this.value += milliseconds;
  }
}

function createFixtureApp(store = new InMemoryQuestStore(), clock = new TestClock()) {
  return {
    clock,
    app: createApp({
      store,
      fixtureMode: true,
      sessionSecret: SECRET,
      appOrigin: ORIGIN,
      clientDir: '/tmp/quest-client-not-present',
      studioDir: '/tmp/quest-studio-not-present',
      now: clock.now,
    }),
  };
}

async function startJourney(app: ReturnType<typeof createFixtureApp>['app']) {
  const session = await app.request('/api/session');
  const cookie = session.headers.get('set-cookie')!.split(';', 1)[0]!;
  const preview = await (
    await app.request(
      '/api/setup/preview',
      mutation(cookie, { name: 'Demo Adventurer', birthDate: '2020-01-01' }),
    )
  ).json();
  const save = await (
    await app.request(
      '/api/saves',
      mutation(cookie, { previewId: preview.previewId, selectedIds: preview.selectedIds }),
    )
  ).json() as SaveView;
  return { cookie, save };
}

function mutation(cookie: string, body: unknown): RequestInit {
  return {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      cookie,
      origin: ORIGIN,
      'content-type': 'application/json',
      'x-quest-request': '1',
    },
  };
}

async function requestAction(
  app: ReturnType<typeof createFixtureApp>['app'],
  cookie: string,
  saveId: string,
  request: GameplayActionRequest,
): Promise<Response> {
  return app.request(`/api/saves/${saveId}/actions`, mutation(cookie, request));
}

async function applyAction(
  app: ReturnType<typeof createFixtureApp>['app'],
  cookie: string,
  save: SaveView,
  action: GameplayAction,
  actionId = randomUUID(),
): Promise<SaveView> {
  const response = await requestAction(app, cookie, save.id, {
    actionId,
    expectedRevision: save.revision,
    action,
  });
  expect(response.status, await errorCode(response)).toBe(200);
  return response.json() as Promise<SaveView>;
}

async function defeatEncounter(
  app: ReturnType<typeof createFixtureApp>['app'],
  cookie: string,
  clock: TestClock,
  initialSave: SaveView,
  encounterId: string,
): Promise<SaveView> {
  let save = initialSave;
  while (save.adventure!.activeLevel!.encounters.find((encounter) => encounter.id === encounterId)!.hp > 0) {
    save = await applyAction(app, cookie, save, {
      type: 'attack',
      levelId: save.adventure!.currentLevelId!,
      encounterId,
    });
    clock.advance(600);
  }
  return save;
}

async function errorCode(response: Response): Promise<string> {
  if (response.ok) return '';
  const clone = response.clone();
  const body = await clone.json() as { error?: { code?: string } };
  return body.error?.code ?? 'unknown error';
}

describe('era combat adventure', () => {
  it('groups represented memories into threshold bundles without inventing future ages', () => {
    const fixture = createAdventurePlan('2020-01-01', [
      { id: 'zero', date: '2020-07-01', ageYears: 0 },
      { id: 'four', date: '2024-01-01', ageYears: 4 },
      { id: 'seven', date: '2027-01-01', ageYears: 7 },
    ]);
    expect(fixture.levels.map((level) => ({
      eraYear: level.eraYear,
      startAgeYears: level.startAgeYears,
      targetAgeYears: level.targetAgeYears,
      memoryIds: level.memoryIds,
    }))).toEqual([
      { eraYear: 2020, startAgeYears: 0, targetAgeYears: 4, memoryIds: ['zero', 'four'] },
      { eraYear: 2024, startAgeYears: 4, targetAgeYears: 7, memoryIds: ['seven'] },
    ]);

    expect(() => createAdventurePlan('1980-01-01', [
      { id: 'early', date: '1981-01-01', ageYears: 1 },
      { id: 'late', date: '1995-01-01', ageYears: 15 },
    ])).toThrow('Parody catalog has no complete compatible period');
  });

  it('requires equipment and ordinary victories, then releases and consumes memories before growth', async () => {
    const { app, clock } = createFixtureApp();
    const started = await startJourney(app);
    let save = started.save;
    const level = save.adventure!.activeLevel!;
    const [ordinaryOne, ordinaryTwo, boss] = level.encounters;
    const attackPickup = level.pickups.find((pickup) => pickup.kind === 'attack-tool')!;
    expect(level).toMatchObject({
      startDate: '2020-01-01',
      periodId: 'block-party-v1',
      routeId: 'gentle-intro-v1',
    });
    expect(save).toMatchObject({
      versions: { journey: 'era-level-plan-v2', catalog: 'parody-catalog-v5' },
      adventure: {
        planVersion: 'era-level-plan-v2',
        catalogVersion: 'parody-catalog-v5',
      },
    });
    expect(level.encounters.map((encounter) => encounter.content?.catalogEntryId)).toEqual([
      'mister-hiss',
      'peel-patrol',
      'drama-dragon',
    ]);
    expect(level.encounters.map((encounter) => encounter.available)).toEqual([true, true, false]);

    const lockedMedia = await app.request(`/api/saves/${save.id}/media/${save.memories[0]!.id}`, {
      headers: { cookie: started.cookie },
    });
    expect(lockedMedia.status).toBe(409);
    expect(await errorCode(lockedMedia)).toBe('MEDIA_LOCKED');

    const noTool = await requestAction(app, started.cookie, save.id, {
      actionId: randomUUID(),
      expectedRevision: save.revision,
      action: { type: 'attack', levelId: level.id, encounterId: ordinaryOne!.id },
    });
    expect(await errorCode(noTool)).toBe('ATTACK_TOOL_REQUIRED');

    const wrongLevel = await requestAction(app, started.cookie, save.id, {
      actionId: randomUUID(),
      expectedRevision: save.revision,
      action: { type: 'collect-equipment', levelId: 'level-forged', pickupId: attackPickup.pickupId },
    });
    expect(await errorCode(wrongLevel)).toBe('LEVEL_NOT_ACTIVE');

    save = await applyAction(app, started.cookie, save, {
      type: 'collect-equipment', levelId: level.id, pickupId: attackPickup.pickupId,
    });
    expect(save.adventure!.equippedId).toBe(attackPickup.id);

    const earlyBoss = await requestAction(app, started.cookie, save.id, {
      actionId: randomUUID(),
      expectedRevision: save.revision,
      action: { type: 'attack', levelId: level.id, encounterId: boss!.id },
    });
    expect(await errorCode(earlyBoss)).toBe('ENCOUNTER_NOT_ACTIVE');

    save = await applyAction(app, started.cookie, save, {
      type: 'attack', levelId: level.id, encounterId: ordinaryTwo!.id,
    });
    const cooldown = await requestAction(app, started.cookie, save.id, {
      actionId: randomUUID(),
      expectedRevision: save.revision,
      action: { type: 'attack', levelId: level.id, encounterId: ordinaryOne!.id },
    });
    expect(await errorCode(cooldown)).toBe('ATTACK_COOLDOWN');
    clock.advance(600);

    save = await defeatEncounter(app, started.cookie, clock, save, ordinaryOne!.id);
    save = await defeatEncounter(app, started.cookie, clock, save, ordinaryTwo!.id);
    expect(save.adventure!.activeLevel!.encounters.find((encounter) => encounter.id === boss!.id)!.available).toBe(true);
    save = await defeatEncounter(app, started.cookie, clock, save, boss!.id);
    expect(save).toMatchObject({
      ageYears: 0,
      abilities: ['move', 'interact'],
      completed: false,
      adventure: { phase: 'memory-released' },
    });
    expect(save.adventure!.activeLevel!.encounters.map((encounter) => encounter.content?.catalogEntryId))
      .toEqual(['mister-hiss', 'peel-patrol', 'drama-dragon']);
    expect(save.memories.map((memory) => memory.state)).toEqual(['released', 'released', 'locked']);

    const releasedMedia = await app.request(`/api/saves/${save.id}/media/${save.memories[0]!.id}`, {
      headers: { cookie: started.cookie },
    });
    expect(releasedMedia.status).toBe(200);
    const futureMedia = await app.request(`/api/saves/${save.id}/media/${save.memories[2]!.id}`, {
      headers: { cookie: started.cookie },
    });
    expect(await errorCode(futureMedia)).toBe('MEDIA_LOCKED');

    save = await applyAction(app, started.cookie, save, {
      type: 'recover-memory', levelId: level.id, memoryId: level.memoryIds[0]!,
    });
    expect(save.ageYears).toBe(0);
    const incomplete = await requestAction(app, started.cookie, save.id, {
      actionId: randomUUID(),
      expectedRevision: save.revision,
      action: { type: 'consume-memory-bundle', levelId: level.id },
    });
    expect(await errorCode(incomplete)).toBe('MEMORY_BUNDLE_INCOMPLETE');
    save = await applyAction(app, started.cookie, save, {
      type: 'recover-memory', levelId: level.id, memoryId: level.memoryIds[1]!,
    });
    expect(save.ageYears).toBe(0);
    const consumeRequest: GameplayActionRequest = {
      actionId: randomUUID(),
      expectedRevision: save.revision,
      action: { type: 'consume-memory-bundle', levelId: level.id },
    };
    const [consumed, consumedRetry] = await Promise.all([
      requestAction(app, started.cookie, save.id, consumeRequest),
      requestAction(app, started.cookie, save.id, consumeRequest),
    ]);
    expect(consumed.status).toBe(200);
    expect(consumedRetry.status).toBe(200);
    save = await consumed.json() as SaveView;
    const consumedRetryView = await consumedRetry.json() as SaveView;
    expect(consumedRetryView.revision).toBe(save.revision);
    expect(consumedRetryView.ageYears).toBe(4);
    expect(save).toMatchObject({
      ageYears: 4,
      abilities: ['move', 'interact', 'jump'],
      appearance: { stage: 'child' },
      completed: false,
      adventure: {
        phase: 'exploring',
        activeLevel: {
          eraYear: 2024,
          startAgeYears: 4,
          targetAgeYears: 7,
          periodId: 'besties-obby-v1',
          routeId: 'gentle-jump-v1',
        },
      },
    });
    expect(save.adventure!.activeLevel!.encounters.map((encounter) => encounter.content?.catalogEntryId))
      .toEqual(['sir-flush-a-lot-besties', 'peel-patrol-besties', 'bickering-besties']);
    expect(save.memories.map((memory) => memory.state)).toEqual(['consumed', 'consumed', 'locked']);
    expect(save.adventure!.inventory).toContainEqual(expect.objectContaining({ id: attackPickup.id }));

    const secondLevel = save.adventure!.activeLevel!;
    const strongerTool = secondLevel.pickups.find((pickup) => pickup.kind === 'attack-tool')!;
    save = await applyAction(app, started.cookie, save, {
      type: 'collect-equipment', levelId: secondLevel.id, pickupId: strongerTool.pickupId,
    });
    expect(save.adventure!.equippedId).toBe(strongerTool.id);
    for (const encounter of secondLevel.encounters.filter((candidate) => candidate.role === 'ordinary')) {
      save = await defeatEncounter(app, started.cookie, clock, save, encounter.id);
    }
    save = await defeatEncounter(app, started.cookie, clock, save, secondLevel.bossId);
    save = await applyAction(app, started.cookie, save, {
      type: 'recover-memory', levelId: secondLevel.id, memoryId: secondLevel.memoryIds[0]!,
    });
    expect(save.ageYears).toBe(4);
    save = await applyAction(app, started.cookie, save, {
      type: 'consume-memory-bundle', levelId: secondLevel.id,
    });
    expect(save).toMatchObject({
      ageYears: 7,
      completed: true,
      appearance: { stage: 'child' },
      adventure: { phase: 'complete', currentLevelId: null, activeLevel: null },
    });
  });

  it('deduplicates accepted actions and rejects reused IDs and stale concurrent revisions', async () => {
    const { app } = createFixtureApp();
    const { cookie, save } = await startJourney(app);
    const level = save.adventure!.activeLevel!;
    const pickup = level.pickups.find((candidate) => candidate.kind === 'attack-tool')!;
    const request: GameplayActionRequest = {
      actionId: randomUUID(),
      expectedRevision: save.revision,
      action: { type: 'collect-equipment', levelId: level.id, pickupId: pickup.pickupId },
    };
    const first = await requestAction(app, cookie, save.id, request);
    const firstView = await first.json() as SaveView;
    const replay = await requestAction(app, cookie, save.id, request);
    const replayView = await replay.json() as SaveView;
    expect(replayView.revision).toBe(firstView.revision);
    expect(replayView.adventure!.inventory).toHaveLength(1);

    const reused = await requestAction(app, cookie, save.id, {
      ...request,
      action: { type: 'collect-equipment', levelId: level.id, pickupId: level.pickups[1]!.pickupId },
    });
    expect(await errorCode(reused)).toBe('ACTION_ID_REUSED');
    const stale = await requestAction(app, cookie, save.id, {
      actionId: randomUUID(),
      expectedRevision: save.revision,
      action: { type: 'attack', levelId: level.id, encounterId: level.encounters[0]!.id },
    });
    expect(await errorCode(stale)).toBe('SAVE_REVISION_STALE');

    const attackRequest: GameplayActionRequest = {
      actionId: randomUUID(),
      expectedRevision: firstView.revision,
      action: { type: 'attack', levelId: level.id, encounterId: level.encounters[0]!.id },
    };
    const [attack, attackReplay] = await Promise.all([
      requestAction(app, cookie, save.id, attackRequest),
      requestAction(app, cookie, save.id, attackRequest),
    ]);
    const attackView = await attack.json() as SaveView;
    const attackReplayView = await attackReplay.json() as SaveView;
    expect(attackView.revision).toBe(firstView.revision + 1);
    expect(attackReplayView.revision).toBe(attackView.revision);
    expect(attackReplayView.adventure!.activeLevel!.encounters[0]!.hp).toBe(
      attackView.adventure!.activeLevel!.encounters[0]!.hp,
    );
  });

  it('derives guarded damage, persists fallen state, and safely retries the active level', async () => {
    const { app, clock } = createFixtureApp();
    const started = await startJourney(app);
    let save = started.save;
    const level = save.adventure!.activeLevel!;
    for (const pickup of level.pickups) {
      save = await applyAction(app, started.cookie, save, {
        type: 'collect-equipment', levelId: level.id, pickupId: pickup.pickupId,
      });
    }
    const enemy = level.encounters[0]!;
    save = await applyAction(app, started.cookie, save, {
      type: 'take-hit', levelId: level.id, encounterId: enemy.id,
    });
    expect(save.adventure!.playerHp).toBe(8);
    const hitCooldown = await requestAction(app, started.cookie, save.id, {
      actionId: randomUUID(), expectedRevision: save.revision,
      action: { type: 'take-hit', levelId: level.id, encounterId: enemy.id },
    });
    expect(await errorCode(hitCooldown)).toBe('ENEMY_HIT_COOLDOWN');
    save = await applyAction(app, started.cookie, save, {
      type: 'take-hit', levelId: level.id, encounterId: level.encounters[1]!.id,
    });
    expect(save.adventure!.playerHp).toBe(6);

    clock.advance(900);
    save = await applyAction(app, started.cookie, save, { type: 'guard', levelId: level.id });
    save = await applyAction(app, started.cookie, save, {
      type: 'take-hit', levelId: level.id, encounterId: enemy.id,
    });
    expect(save.adventure!.playerHp).toBe(6);
    const guardCooldown = await requestAction(app, started.cookie, save.id, {
      actionId: randomUUID(), expectedRevision: save.revision,
      action: { type: 'guard', levelId: level.id },
    });
    expect(await errorCode(guardCooldown)).toBe('GUARD_COOLDOWN');

    while (save.adventure!.phase !== 'fallen') {
      clock.advance(900);
      save = await applyAction(app, started.cookie, save, {
        type: 'take-hit', levelId: level.id, encounterId: enemy.id,
      });
    }
    expect(save.adventure).toMatchObject({ playerHp: 0, phase: 'fallen' });
    const blocked = await requestAction(app, started.cookie, save.id, {
      actionId: randomUUID(), expectedRevision: save.revision,
      action: { type: 'attack', levelId: level.id, encounterId: enemy.id },
    });
    expect(await errorCode(blocked)).toBe('ACTION_NOT_AVAILABLE');

    const inventoryIds = save.adventure!.inventory.map((item) => item.id);
    const encounterContent = level.encounters.map((encounter) => ({
      ...encounter.content,
    }));
    save = await applyAction(app, started.cookie, save, { type: 'retry-level', levelId: level.id });
    expect(save.adventure).toMatchObject({ playerHp: 10, phase: 'exploring' });
    expect(save.adventure!.inventory.map((item) => item.id)).toEqual(inventoryIds);
    expect(save.adventure!.activeLevel!.encounters.every(
      (encounter) => encounter.hp === encounter.maxHp && !encounter.defeated,
    )).toBe(true);
    expect(save.adventure!.activeLevel!.encounters.map((encounter) => ({
      ...encounter.content,
    }))).toEqual(encounterContent);
    const resumed = await (
      await app.request(`/api/saves/${save.id}`, { headers: { cookie: started.cookie } })
    ).json() as SaveView;
    expect(resumed.adventure).toMatchObject({ playerHp: 10, phase: 'exploring' });
    expect(resumed.adventure!.inventory.map((item) => item.id)).toEqual(inventoryIds);
  });

  it('rejects an unchanged old retry after its bounded receipt has been pruned', async () => {
    const { app, clock } = createFixtureApp();
    const started = await startJourney(app);
    let save = started.save;
    const level = save.adventure!.activeLevel!;
    const guardPickup = level.pickups.find((pickup) => pickup.kind === 'guard-tool')!;
    save = await applyAction(app, started.cookie, save, {
      type: 'collect-equipment', levelId: level.id, pickupId: guardPickup.pickupId,
    });
    const oldRequest: GameplayActionRequest = {
      actionId: randomUUID(),
      expectedRevision: save.revision,
      action: { type: 'guard', levelId: level.id },
    };
    const first = await requestAction(app, started.cookie, save.id, oldRequest);
    expect(first.status).toBe(200);
    save = await first.json() as SaveView;
    for (let index = 0; index < 128; index += 1) {
      clock.advance(1_500);
      save = await applyAction(app, started.cookie, save, { type: 'guard', levelId: level.id });
    }
    const prunedRetry = await requestAction(app, started.cookie, save.id, oldRequest);
    expect(await errorCode(prunedRetry)).toBe('SAVE_REVISION_STALE');
  });

  it('preserves legacy saves as viewable read-only records with owned media', async () => {
    const owner = { id: '10000000-0000-4000-8000-000000000001', label: 'Legacy player' };
    const sessionId = '20000000-0000-4000-8000-000000000002';
    const legacy = legacySave(owner.id);
    const store = new InMemoryQuestStore([legacy], [{
      sessionId,
      player: owner,
      expiresAt: new Date(Date.now() + 60_000),
    }]);
    const { app } = createFixtureApp(store);
    const cookie = `quest_fixture_session=${signToken(sessionId, SECRET)}`;
    const view = await (await app.request(`/api/saves/${legacy.id}`, { headers: { cookie } })).json() as SaveView;
    expect(view).toMatchObject({ format: 'legacy-v1', adventure: null, completed: true });
    expect(view.memories[0]!.mediaUrl).toBeDefined();
    const media = await app.request(`/api/saves/${legacy.id}/media/${legacy.memories[0]!.id}`, {
      headers: { cookie },
    });
    expect(media.status).toBe(200);

    for (const [path, body] of [
      [`/api/saves/${legacy.id}/recover`, { memoryId: legacy.memories[0]!.id }],
      [`/api/saves/${legacy.id}/finish`, {}],
      [`/api/saves/${legacy.id}/actions`, {
        actionId: randomUUID(), expectedRevision: legacy.revision,
        action: { type: 'retry-level', levelId: 'legacy' },
      }],
    ] as const) {
      const response = await app.request(path, mutation(cookie, body));
      expect(await errorCode(response)).toBe('LEGACY_SAVE_READ_ONLY');
    }
  });

  it('uses a separate bounded action request budget', async () => {
    const { app } = createFixtureApp();
    const { cookie, save } = await startJourney(app);
    for (let index = 0; index < 360; index += 1) {
      const response = await app.request(
        `/api/saves/${save.id}/actions`,
        mutation(cookie, {}),
      );
      expect(response.status).toBe(422);
    }
    const limited = await app.request(`/api/saves/${save.id}/actions`, mutation(cookie, {}));
    expect(limited.status).toBe(429);
    expect(await errorCode(limited)).toBe('RATE_LIMITED');
  });
});

function legacySave(ownerId: string): SaveRecord {
  const now = new Date('2026-09-11T00:00:00.000Z');
  return {
    id: '30000000-0000-4000-8000-000000000003',
    ownerId,
    previewId: '40000000-0000-4000-8000-000000000004',
    title: 'Legacy fixture',
    subject: { id: 'demo-adventurer-v1', label: 'Demo Adventurer' },
    birthDate: '2020-01-01',
    memories: [{
      id: 'demo-memory-2020-07',
      date: '2020-07-01',
      ageYears: 0,
      label: 'Memory 1',
      source: { kind: 'fixture', key: 'demo-memory-2020-07' },
    }],
    recoveredIds: ['demo-memory-2020-07'],
    ageYears: 0,
    abilities: ['move', 'interact'],
    appearanceStage: 'infant',
    completed: true,
    saveFormat: 'legacy-v1',
    adventurePlan: null,
    adventureState: null,
    revision: 2,
    createdAt: now,
    updatedAt: now,
    versions: {
      journey: 'garden-path-v1',
      age: 'birth-date-whole-years-v1',
      progression: 'memory-abilities-v1',
      appearance: 'synthetic-traveler-v1',
    },
  };
}
