import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ATTACK_COOLDOWN_MS,
  ENEMY_HIT_COOLDOWN_MS,
  GUARD_ACTIVE_MS,
  GUARD_COOLDOWN_MS,
  boundedRemainingMs,
  createAdventurePlan,
  createInitialAdventureState,
  reduceAdventureAction,
} from '../../src/shared/adventure.js';
import type { GameplayAction, GameplayActionRequest, SaveView } from '../../src/shared/contracts.js';
import { createApp } from '../../src/server/app.js';
import { InMemoryQuestStore } from '../../src/server/db/memory-store.js';

const ORIGIN = 'https://quest.test';
const SECRET = 'fixture-session-secret-that-is-at-least-32-characters';
const T0 = Date.parse('2026-09-11T12:00:00.000Z');
const TWO_HOURS_MS = 2 * 60 * 60 * 1_000;

class TestClock {
  private value = T0;
  now = (): Date => new Date(this.value);
  advance(milliseconds: number): void {
    this.value += milliseconds;
  }
}

type App = ReturnType<typeof createApp>;

function createFixtureApp(clock: TestClock): App {
  return createApp({
    store: new InMemoryQuestStore(),
    fixtureMode: true,
    sessionSecret: SECRET,
    appOrigin: ORIGIN,
    clientDir: '/tmp/quest-client-not-present',
    studioDir: '/tmp/quest-studio-not-present',
    now: clock.now,
  });
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

async function startJourney(app: App): Promise<{ cookie: string; save: SaveView }> {
  const session = await app.request('/api/session');
  const cookie = session.headers.get('set-cookie')!.split(';', 1)[0]!;
  const preview = await (
    await app.request('/api/setup/preview', mutation(cookie, { name: 'Demo Adventurer', birthDate: '2020-01-01' }))
  ).json();
  const created = await app.request(
    '/api/saves',
    mutation(cookie, { previewId: preview.previewId, selectedIds: preview.selectedIds }),
  );
  expect(created.status).toBe(201);
  return { cookie, save: await created.json() as SaveView };
}

async function readSave(app: App, cookie: string, saveId: string): Promise<SaveView> {
  const response = await app.request(`/api/saves/${saveId}`, { headers: { cookie } });
  expect(response.status).toBe(200);
  return response.json() as Promise<SaveView>;
}

async function requestAction(app: App, cookie: string, saveId: string, request: GameplayActionRequest): Promise<Response> {
  return app.request(`/api/saves/${saveId}/actions`, mutation(cookie, request));
}

async function applyAction(app: App, cookie: string, save: SaveView, action: GameplayAction): Promise<SaveView> {
  const response = await requestAction(app, cookie, save.id, {
    actionId: randomUUID(),
    expectedRevision: save.revision,
    action,
  });
  expect(response.status, await errorCode(response)).toBe(200);
  return response.json() as Promise<SaveView>;
}

async function rejectedAction(app: App, cookie: string, save: SaveView, action: GameplayAction): Promise<string> {
  const response = await requestAction(app, cookie, save.id, {
    actionId: randomUUID(),
    expectedRevision: save.revision,
    action,
  });
  return errorCode(response);
}

async function errorCode(response: Response): Promise<string> {
  if (response.ok) return '';
  const body = await response.clone().json() as { error?: { code?: string } };
  return body.error?.code ?? 'unknown error';
}

async function collectEverything(app: App, cookie: string, save: SaveView): Promise<SaveView> {
  let current = save;
  for (const pickup of current.adventure!.activeLevel!.pickups) {
    current = await applyAction(app, cookie, current, {
      type: 'collect-equipment', levelId: current.adventure!.currentLevelId!, pickupId: pickup.pickupId,
    });
  }
  return current;
}

describe('application clock authority', () => {
  it('renders cooldowns on the read path from the same injected clock as the action route', async () => {
    const clock = new TestClock();
    const app = createFixtureApp(clock);
    const { cookie, save: created } = await startJourney(app);
    const level = created.adventure!.activeLevel!;
    const attack: GameplayAction = { type: 'attack', levelId: level.id, encounterId: level.encounters[0]!.id };
    let save = await collectEverything(app, cookie, created);

    save = await applyAction(app, cookie, save, attack);
    expect(save.adventure!.attackCooldownRemainingMs).toBe(ATTACK_COOLDOWN_MS);
    expect((await readSave(app, cookie, save.id)).adventure!.attackCooldownRemainingMs).toBe(ATTACK_COOLDOWN_MS);

    clock.advance(250);
    expect((await readSave(app, cookie, save.id)).adventure!.attackCooldownRemainingMs).toBe(ATTACK_COOLDOWN_MS - 250);
    expect(await rejectedAction(app, cookie, save, attack)).toBe('ATTACK_COOLDOWN');

    clock.advance(ATTACK_COOLDOWN_MS - 250);
    expect((await readSave(app, cookie, save.id)).adventure!.attackCooldownRemainingMs).toBe(0);
    save = await applyAction(app, cookie, save, attack);
    expect(save.adventure!.attackCooldownRemainingMs).toBe(ATTACK_COOLDOWN_MS);
  });

  it('treats a backward wall-clock step as expired cooldowns instead of locking the save', async () => {
    const clock = new TestClock();
    const app = createFixtureApp(clock);
    const { cookie, save: created } = await startJourney(app);
    const level = created.adventure!.activeLevel!;
    const enemy = level.encounters[0]!;
    const attack: GameplayAction = { type: 'attack', levelId: level.id, encounterId: enemy.id };
    const takeHit: GameplayAction = { type: 'take-hit', levelId: level.id, encounterId: enemy.id };
    const guard: GameplayAction = { type: 'guard', levelId: level.id };
    let save = await collectEverything(app, cookie, created);

    save = await applyAction(app, cookie, save, attack);
    save = await applyAction(app, cookie, save, guard);
    save = await applyAction(app, cookie, save, takeHit);
    expect(save.adventure!.playerHp).toBe(10);
    expect(save.adventure).toMatchObject({
      attackCooldownRemainingMs: ATTACK_COOLDOWN_MS,
      guardActiveRemainingMs: GUARD_ACTIVE_MS,
      guardCooldownRemainingMs: GUARD_COOLDOWN_MS,
    });

    clock.advance(-TWO_HOURS_MS);
    expect((await readSave(app, cookie, save.id)).adventure).toMatchObject({
      attackCooldownRemainingMs: 0,
      guardActiveRemainingMs: 0,
      guardCooldownRemainingMs: 0,
    });
    save = await applyAction(app, cookie, save, takeHit);
    expect(save.adventure!.playerHp).toBe(10 - enemy.attackDamage);
    save = await applyAction(app, cookie, save, attack);
    save = await applyAction(app, cookie, save, guard);
    expect(save.adventure).toMatchObject({
      attackCooldownRemainingMs: ATTACK_COOLDOWN_MS,
      guardActiveRemainingMs: GUARD_ACTIVE_MS,
      guardCooldownRemainingMs: GUARD_COOLDOWN_MS,
    });
  });
});

describe('bounded remaining time', () => {
  it('expires past deadlines and any interval longer than the action could grant', () => {
    expect(boundedRemainingMs(T0 + ATTACK_COOLDOWN_MS, T0, ATTACK_COOLDOWN_MS)).toBe(ATTACK_COOLDOWN_MS);
    expect(boundedRemainingMs(T0 + ATTACK_COOLDOWN_MS, T0 + 1, ATTACK_COOLDOWN_MS)).toBe(ATTACK_COOLDOWN_MS - 1);
    expect(boundedRemainingMs(T0 + ATTACK_COOLDOWN_MS, T0 + ATTACK_COOLDOWN_MS, ATTACK_COOLDOWN_MS)).toBe(0);
    expect(boundedRemainingMs(T0 + ATTACK_COOLDOWN_MS, T0 + TWO_HOURS_MS, ATTACK_COOLDOWN_MS)).toBe(0);
    expect(boundedRemainingMs(T0 + ATTACK_COOLDOWN_MS, T0 - 1, ATTACK_COOLDOWN_MS)).toBe(0);
    expect(boundedRemainingMs(T0 + ATTACK_COOLDOWN_MS, T0 - TWO_HOURS_MS, ATTACK_COOLDOWN_MS)).toBe(0);
    expect(boundedRemainingMs(0, T0, ATTACK_COOLDOWN_MS)).toBe(0);
  });

  it('rejects each action just before its deadline, accepts it at the deadline, and clears it on skew', () => {
    const plan = createAdventurePlan('2020-01-01', [{ id: 'zero', date: '2020-07-01', ageYears: 0 }]);
    const level = plan.levels[0]!;
    const enemy = level.encounters[0]!;
    const guardTool = level.pickups.find((pickup) => pickup.kind === 'guard-tool')!;
    const attack: GameplayAction = { type: 'attack', levelId: level.id, encounterId: enemy.id };
    const takeHit: GameplayAction = { type: 'take-hit', levelId: level.id, encounterId: enemy.id };
    const guard: GameplayAction = { type: 'guard', levelId: level.id };
    let state = createInitialAdventureState(plan);
    for (const pickup of level.pickups) {
      state = reduceAdventureAction(plan, state, {
        type: 'collect-equipment', levelId: level.id, pickupId: pickup.pickupId,
      }, T0);
    }

    const attacked = reduceAdventureAction(plan, state, attack, T0);
    expect(() => reduceAdventureAction(plan, attacked, attack, T0 + ATTACK_COOLDOWN_MS - 1)).toThrow('ATTACK_COOLDOWN');
    expect(reduceAdventureAction(plan, attacked, attack, T0 + ATTACK_COOLDOWN_MS).attackReadyAtMs)
      .toBe(T0 + ATTACK_COOLDOWN_MS * 2);
    expect(reduceAdventureAction(plan, attacked, attack, T0 - 1).attackReadyAtMs).toBe(T0 - 1 + ATTACK_COOLDOWN_MS);

    const guarded = reduceAdventureAction(plan, attacked, guard, T0);
    expect(() => reduceAdventureAction(plan, guarded, guard, T0 + GUARD_COOLDOWN_MS - 1)).toThrow('GUARD_COOLDOWN');
    expect(reduceAdventureAction(plan, guarded, guard, T0 + GUARD_COOLDOWN_MS).guardReadyAtMs)
      .toBe(T0 + GUARD_COOLDOWN_MS * 2);
    expect(reduceAdventureAction(plan, guarded, guard, T0 - 1).guardReadyAtMs).toBe(T0 - 1 + GUARD_COOLDOWN_MS);

    const fullDamage = enemy.attackDamage;
    const reducedDamage = Math.max(0, enemy.attackDamage - guardTool.guardReduction);
    expect(reduceAdventureAction(plan, guarded, takeHit, T0 + GUARD_ACTIVE_MS - 1).playerHp)
      .toBe(guarded.maxPlayerHp - reducedDamage);
    expect(reduceAdventureAction(plan, guarded, takeHit, T0 + GUARD_ACTIVE_MS).playerHp)
      .toBe(guarded.maxPlayerHp - fullDamage);
    expect(reduceAdventureAction(plan, guarded, takeHit, T0 - 1).playerHp)
      .toBe(guarded.maxPlayerHp - fullDamage);

    const hit = reduceAdventureAction(plan, guarded, takeHit, T0 + GUARD_ACTIVE_MS);
    const hitAt = T0 + GUARD_ACTIVE_MS;
    expect(() => reduceAdventureAction(plan, hit, takeHit, hitAt + ENEMY_HIT_COOLDOWN_MS - 1)).toThrow('ENEMY_HIT_COOLDOWN');
    expect(reduceAdventureAction(plan, hit, takeHit, hitAt + ENEMY_HIT_COOLDOWN_MS).playerHp)
      .toBe(hit.playerHp - fullDamage);
    // A backward step past both deadlines: the hit cooldown and the guard window are both skew-expired.
    expect(reduceAdventureAction(plan, hit, takeHit, T0 - 1).playerHp).toBe(hit.playerHp - fullDamage);
  });
});
