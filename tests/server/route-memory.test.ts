import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ROUTE_ATTACK_COOLDOWN_MS,
  SECONDARY_ATTACK_COOLDOWN_MS,
  createAdventurePlan,
  createInitialAdventureState,
  createRouteMemoryPlan,
  memoryIdsForLevel,
  memoryIsReleased,
  reduceAdventureAction,
  toAdventureView,
  type AdventureMemory,
  type AdventurePlanV3,
  type AdventureState,
} from '../../src/shared/adventure.js';
import type { GameplayAction, GameplayActionRequest } from '../../src/shared/contracts.js';
import { createInitialFriendlyState } from '../../src/shared/friendly.js';
import { parseStoredAdventure } from '../../src/server/adventure-schema.js';
import {
  FIXTURE_SUBJECT,
  ROUTE_MEMORY_RULE_VERSIONS,
  applyGameplayActionToSave,
  toSaveView,
  type FrozenMemory,
  type SaveRecord,
} from '../../src/server/domain.js';
import { FixturePhotoSource } from '../../src/server/photos/fixture.js';

const MEMORIES: AdventureMemory[] = [
  { id: 'memory-age-0', date: '2020-07-01', ageYears: 0 },
  { id: 'memory-age-2', date: '2022-01-01', ageYears: 2 },
  { id: 'memory-age-4', date: '2024-01-01', ageYears: 4 },
  { id: 'memory-age-5', date: '2025-01-01', ageYears: 5 },
  { id: 'memory-age-6', date: '2026-01-01', ageYears: 6 },
  { id: 'memory-age-7', date: '2027-01-01', ageYears: 7 },
];

function routePlan(): AdventurePlanV3 {
  return createRouteMemoryPlan('2020-01-01', MEMORIES);
}

function apply(
  plan: AdventurePlanV3,
  state: AdventureState,
  action: GameplayAction,
  nowMs: number,
): AdventureState {
  return reduceAdventureAction(plan, state, action, nowMs);
}

function collect(
  plan: AdventurePlanV3,
  state: AdventureState,
  kind: 'attack-tool' | 'guard-tool',
): AdventureState {
  const level = plan.levels[state.activeLevelIndex]!;
  return apply(plan, state, {
    type: 'collect-equipment',
    levelId: level.id,
    pickupId: level.pickups.find((pickup) => pickup.kind === kind)!.pickupId,
  }, 0);
}

function defeatLevelEncounters(
  plan: AdventurePlanV3,
  state: AdventureState,
): AdventureState {
  const level = plan.levels[state.activeLevelIndex]!;
  let next = state;
  let nowMs = 0;
  for (const encounter of level.encounters) {
    while (!next.encounters[encounter.id]!.defeated) {
      next = apply(plan, next, {
        type: 'attack',
        levelId: level.id,
        encounterId: encounter.id,
      }, nowMs);
      nowMs += ROUTE_ATTACK_COOLDOWN_MS;
    }
  }
  return next;
}

function saveRecord(plan = routePlan()): SaveRecord {
  const now = new Date('2026-09-12T00:00:00.000Z');
  const memories: FrozenMemory[] = MEMORIES.map((memory) => ({
    ...memory,
    label: memory.id,
    source: { kind: 'fixture', key: memory.id },
  }));
  return {
    id: '30000000-0000-4000-8000-000000000003',
    ownerId: '10000000-0000-4000-8000-000000000001',
    previewId: '40000000-0000-4000-8000-000000000004',
    title: 'Route memory fixture',
    subject: FIXTURE_SUBJECT,
    birthDate: '2020-01-01',
    memories,
    recoveredIds: [],
    ageYears: 0,
    abilities: ['move', 'interact', 'jump'],
    appearanceStage: 'infant',
    completed: false,
    saveFormat: 'era-combat-v2',
    adventurePlan: plan,
    adventureState: createInitialAdventureState(plan),
    friendlyState: createInitialFriendlyState(plan),
    revision: 0,
    createdAt: now,
    updatedAt: now,
    versions: ROUTE_MEMORY_RULE_VERSIONS,
  };
}

describe('route-memory plan v3', () => {
  it('offers six deterministic fictional photos only in route-memory fixture mode', async () => {
    const subject = { option: FIXTURE_SUBJECT, sourceId: FIXTURE_SUBJECT.id };
    const request = { name: FIXTURE_SUBJECT.label, birthDate: '2020-01-01' };
    const legacy = await new FixturePhotoSource().discover(subject, request);
    const route = await new FixturePhotoSource(true).discover(subject, request);
    expect(legacy.memories.map(({ ageYears }) => ageYears)).toEqual([0, 4, 7]);
    expect(route.memories.map(({ ageYears }) => ageYears)).toEqual([0, 2, 4, 5, 6, 7]);
    expect(route.memories.map(({ id }) => id)).toEqual([
      'demo-memory-2020-07',
      'demo-memory-2022-01',
      'demo-memory-2024-01',
      'demo-memory-2025-01',
      'demo-memory-2026-01',
      'demo-memory-2027-01',
    ]);
    expect(route.scanned).toBe(6);
  });

  it('freezes two three-photo chapters with explicit roles and baseline jump', () => {
    const plan = routePlan();
    expect(plan.levels.map((level) => ({
      startAgeYears: level.startAgeYears,
      targetAgeYears: level.targetAgeYears,
      minorMemoryIds: level.minorMemoryIds,
      majorMemoryId: level.majorMemoryId,
      routeId: level.routeId,
    }))).toEqual([
      {
        startAgeYears: 0,
        targetAgeYears: 4,
        minorMemoryIds: ['memory-age-0', 'memory-age-2'],
        majorMemoryId: 'memory-age-4',
        routeId: 'gentle-jump-v1',
      },
      {
        startAgeYears: 4,
        targetAgeYears: 7,
        minorMemoryIds: ['memory-age-5', 'memory-age-6'],
        majorMemoryId: 'memory-age-7',
        routeId: 'gentle-jump-v1',
      },
    ]);
    expect(createInitialAdventureState(plan).abilities).toEqual(['move', 'interact', 'jump']);
    expect(() => createRouteMemoryPlan('2020-01-01', MEMORIES.slice(0, 5)))
      .toThrow('requires exactly 6 memories');
    expect(() => parseStoredAdventure({
      ...structuredClone(plan),
      levels: plan.levels.map((level) => ({ ...level, memoryIds: memoryIdsForLevel(level) })),
    }, createInitialAdventureState(plan))).toThrow('Save unavailable');
  });

  it('recovers route minors without aging and makes the post-boss major the atomic age gate', () => {
    const plan = routePlan();
    const first = plan.levels[0]!;
    let state = createInitialAdventureState(plan);
    expect(memoryIsReleased(plan, state, first.minorMemoryIds[0])).toBe(true);
    expect(memoryIsReleased(plan, state, first.majorMemoryId)).toBe(false);
    expect(() => apply(plan, state, {
      type: 'recover-memory', levelId: first.id, memoryId: first.majorMemoryId,
    }, 0)).toThrow('ACTION_NOT_AVAILABLE');

    state = apply(plan, state, {
      type: 'recover-memory', levelId: first.id, memoryId: first.minorMemoryIds[0],
    }, 0);
    expect(state).toMatchObject({ ageYears: 0, phase: 'exploring' });
    expect(state.consumedMemoryIds).toEqual([]);
    state = collect(plan, state, 'attack-tool');
    state = defeatLevelEncounters(plan, state);
    expect(state).toMatchObject({ ageYears: 0, phase: 'memory-released' });
    expect(memoryIsReleased(plan, state, first.majorMemoryId)).toBe(true);
    expect(() => apply(plan, state, {
      type: 'recover-memory', levelId: first.id, memoryId: first.majorMemoryId,
    }, 10_000)).toThrow('MEMORY_BUNDLE_INCOMPLETE');
    expect(() => apply(plan, state, {
      type: 'consume-memory-bundle', levelId: first.id,
    }, 10_000)).toThrow('ACTION_NOT_AVAILABLE');

    state = apply(plan, state, {
      type: 'recover-memory', levelId: first.id, memoryId: first.minorMemoryIds[1],
    }, 10_000);
    state = apply(plan, state, {
      type: 'recover-memory', levelId: first.id, memoryId: first.majorMemoryId,
    }, 10_000);
    expect(state).toMatchObject({
      activeLevelIndex: 1,
      ageYears: 4,
      phase: 'exploring',
      completedLevelIds: [first.id],
    });
    expect(state.consumedMemoryIds).toEqual(memoryIdsForLevel(first));
    const view = toAdventureView(plan, state, 10_000);
    expect(view.activeLevel).toMatchObject({
      memoryIds: ['memory-age-5', 'memory-age-6', 'memory-age-7'],
      minorMemoryIds: ['memory-age-5', 'memory-age-6'],
      majorMemoryId: 'memory-age-7',
    });
    state = collect(plan, state, 'guard-tool');
    const secondLevel = plan.levels[1]!;
    state = apply(plan, state, {
      type: 'secondary-attack', levelId: secondLevel.id, encounterId: secondLevel.encounters[0]!.id,
    }, 10_000);
    expect(state.encounters[secondLevel.encounters[0]!.id]!.hp)
      .toBe(secondLevel.encounters[0]!.maxHp - 3);
  });

  it('preserves recovered minors across a fall and retry', () => {
    const plan = routePlan();
    const level = plan.levels[0]!;
    let state = createInitialAdventureState(plan);
    state = apply(plan, state, {
      type: 'recover-memory', levelId: level.id, memoryId: level.minorMemoryIds[0],
    }, 0);
    const enemy = level.encounters[0]!;
    let nowMs = 0;
    while (state.phase !== 'fallen') {
      state = apply(plan, state, {
        type: 'take-hit', levelId: level.id, encounterId: enemy.id,
      }, nowMs);
      nowMs += 900;
    }
    state = apply(plan, state, { type: 'retry-level', levelId: level.id }, nowMs);
    expect(state.phase).toBe('exploring');
    expect(state.revealedMemoryIds).toEqual([level.minorMemoryIds[0]]);
    expect(state.encounters[enemy.id]).toMatchObject({ hp: enemy.maxHp, defeated: false });
  });

  it('uses the guard tool as a separately cooled v3 secondary attack', () => {
    const plan = routePlan();
    const level = plan.levels[0]!;
    const [firstEnemy, secondEnemy] = level.encounters;
    let state = createInitialAdventureState(plan);
    expect(() => apply(plan, state, {
      type: 'secondary-attack', levelId: level.id, encounterId: firstEnemy!.id,
    }, 0)).toThrow('GUARD_TOOL_REQUIRED');
    state = collect(plan, state, 'guard-tool');
    state = apply(plan, state, {
      type: 'secondary-attack', levelId: level.id, encounterId: firstEnemy!.id,
    }, 0);
    expect(state.encounters[firstEnemy!.id]!.hp).toBe(firstEnemy!.maxHp - 2);
    expect(() => apply(plan, state, {
      type: 'secondary-attack', levelId: level.id, encounterId: secondEnemy!.id,
    }, SECONDARY_ATTACK_COOLDOWN_MS - 1)).toThrow('SECONDARY_ATTACK_COOLDOWN');
    state = apply(plan, state, {
      type: 'secondary-attack', levelId: level.id, encounterId: secondEnemy!.id,
    }, SECONDARY_ATTACK_COOLDOWN_MS);
    expect(state.encounters[secondEnemy!.id]!.hp).toBe(secondEnemy!.maxHp - 2);
    expect(toAdventureView(plan, state, SECONDARY_ATTACK_COOLDOWN_MS))
      .toMatchObject({ secondaryCooldownRemainingMs: SECONDARY_ATTACK_COOLDOWN_MS });
    state = collect(plan, state, 'attack-tool');
    state = apply(plan, state, {
      type: 'attack', levelId: level.id, encounterId: secondEnemy!.id,
    }, SECONDARY_ATTACK_COOLDOWN_MS);
    expect(() => apply(plan, state, {
      type: 'attack', levelId: level.id, encounterId: secondEnemy!.id,
    }, SECONDARY_ATTACK_COOLDOWN_MS + ROUTE_ATTACK_COOLDOWN_MS - 1))
      .toThrow('ATTACK_COOLDOWN');
    expect(() => apply(plan, state, { type: 'guard', levelId: level.id }, 2_000))
      .toThrow('ACTION_NOT_AVAILABLE');
  });

  it('replays a route-minor receipt without collecting it twice', () => {
    const save = saveRecord();
    const level = save.adventurePlan!.levels[0]!;
    const request: GameplayActionRequest = {
      actionId: randomUUID(),
      expectedRevision: save.revision,
      action: {
        type: 'recover-memory',
        levelId: level.id,
        memoryId: 'minorMemoryIds' in level ? level.minorMemoryIds[0] : 'unreachable',
      },
    };
    const first = applyGameplayActionToSave(save, request, new Date('2026-09-12T00:00:01.000Z'));
    const replay = applyGameplayActionToSave(first.save, request, new Date('2026-09-12T00:00:02.000Z'));
    expect(first).toMatchObject({ replay: false, save: { revision: 1 } });
    expect(replay).toMatchObject({ replay: true, save: { revision: 1 } });
    expect(replay.save.recoveredIds).toEqual(first.save.recoveredIds);
    expect(toSaveView(first.save, new Date('2026-09-12T00:00:02.000Z')).memories.slice(0, 3))
      .toMatchObject([
        { id: 'memory-age-0', role: 'minor', state: 'revealed' },
        { id: 'memory-age-2', role: 'minor', state: 'released' },
        { id: 'memory-age-4', role: 'major', state: 'locked' },
      ]);
  });

  it('continues to validate archived v2 plans with their original age-zero route and abilities', () => {
    const plan = createAdventurePlan('2020-01-01', [
      { id: 'zero', date: '2020-07-01', ageYears: 0 },
      { id: 'four', date: '2024-01-01', ageYears: 4 },
      { id: 'seven', date: '2027-01-01', ageYears: 7 },
    ]);
    const state = createInitialAdventureState(plan);
    expect(plan.version).toBe('era-level-plan-v2');
    expect(plan.levels[0]).toMatchObject({
      routeId: 'gentle-intro-v1',
      memoryIds: ['zero', 'four'],
    });
    expect(state.abilities).toEqual(['move', 'interact']);
    expect(parseStoredAdventure(structuredClone(plan), structuredClone(state))).toEqual({ plan, state });
    const guardPickup = plan.levels[0]!.pickups.find((pickup) => pickup.kind === 'guard-tool')!;
    const withGuard = reduceAdventureAction(plan, state, {
      type: 'collect-equipment', levelId: plan.levels[0]!.id, pickupId: guardPickup.pickupId,
    }, 0);
    expect(() => reduceAdventureAction(plan, withGuard, {
      type: 'secondary-attack',
      levelId: plan.levels[0]!.id,
      encounterId: plan.levels[0]!.encounters[0]!.id,
    }, 0)).toThrow('ACTION_NOT_AVAILABLE');
  });
});
