import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ENEMY_HIT_COOLDOWN_MS,
  PRIMARY_COMBO_WINDOW_MS,
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
import { createInitialFriendlyState, friendlyDefinitionsForLevel, reduceFriendlyAction } from '../../src/shared/friendly.js';
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

function archivedRoutePlan(): AdventurePlanV3 {
  return createRouteMemoryPlan('2020-01-01', MEMORIES, 'parody-catalog-v3');
}

function archivedPlaygroundPlan(): AdventurePlanV3 {
  return createRouteMemoryPlan('2020-01-01', MEMORIES, 'parody-catalog-v4');
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
  it('chains only accepted primary enemy hits, adds one on the third, and then starts over', () => {
    const plan = routePlan();
    const level = plan.levels[0]!;
    const [firstEnemy, nextEnemy] = level.encounters;
    const attack = (state: AdventureState, encounterId: string, nowMs: number) =>
      apply(plan, state, { type: 'attack', levelId: level.id, encounterId }, nowMs);
    const first = attack(createInitialAdventureState(plan), firstEnemy!.id, 0);
    expect(first.encounters[firstEnemy!.id]!.hp).toBe(firstEnemy!.maxHp - 1);
    expect(toAdventureView(plan, first, 0)).toMatchObject({
      attackComboStep: 1,
      attackComboRemainingMs: PRIMARY_COMBO_WINDOW_MS,
      attackCooldownRemainingMs: ROUTE_ATTACK_COOLDOWN_MS,
    });
    expect(() => attack(first, firstEnemy!.id, ROUTE_ATTACK_COOLDOWN_MS - 1))
      .toThrow('ATTACK_COOLDOWN');
    const second = attack(first, firstEnemy!.id, ROUTE_ATTACK_COOLDOWN_MS);
    expect(second.encounters[firstEnemy!.id]!.hp).toBe(firstEnemy!.maxHp - 2);
    expect(toAdventureView(plan, second, ROUTE_ATTACK_COOLDOWN_MS).attackComboStep).toBe(2);
    const third = attack(second, firstEnemy!.id, ROUTE_ATTACK_COOLDOWN_MS * 2);
    expect(third.encounters[firstEnemy!.id]!.hp).toBe(firstEnemy!.maxHp - 4);
    expect(toAdventureView(plan, third, ROUTE_ATTACK_COOLDOWN_MS * 2).attackComboStep).toBe(3);
    const restarted = attack(third, nextEnemy!.id, ROUTE_ATTACK_COOLDOWN_MS * 3);
    expect(restarted.encounters[nextEnemy!.id]!.hp).toBe(nextEnemy!.maxHp - 1);
    expect(restarted.attackCombo?.step).toBe(1);
  });

  it('expires on the server clock while keeping the attack tool a larger upgrade', () => {
    const plan = routePlan();
    const level = plan.levels[0]!;
    const [firstEnemy, nextEnemy] = level.encounters;
    const attack = (state: AdventureState, encounterId: string, nowMs: number) =>
      apply(plan, state, { type: 'attack', levelId: level.id, encounterId }, nowMs);
    const first = attack(createInitialAdventureState(plan), firstEnemy!.id, 0);
    const childPaced = attack(first, firstEnemy!.id, 1_431);
    expect(childPaced.attackCombo?.step).toBe(2);
    const atBoundary = attack(first, firstEnemy!.id, PRIMARY_COMBO_WINDOW_MS);
    expect(atBoundary.attackCombo?.step).toBe(2);
    expect(toAdventureView(plan, first, PRIMARY_COMBO_WINDOW_MS + 1).attackComboStep)
      .toBeUndefined();
    const expired = attack(first, firstEnemy!.id, PRIMARY_COMBO_WINDOW_MS + 1);
    expect(expired.attackCombo?.step).toBe(1);

    const tool = level.pickups.find((pickup) => pickup.kind === 'attack-tool')!;
    const equipped = collect(plan, createInitialAdventureState(plan), 'attack-tool');
    const toolOne = attack(equipped, firstEnemy!.id, 0);
    const toolTwo = attack(toolOne, firstEnemy!.id, ROUTE_ATTACK_COOLDOWN_MS);
    const toolFinish = attack(toolTwo, nextEnemy!.id, ROUTE_ATTACK_COOLDOWN_MS * 2);
    expect(toolFinish.encounters[nextEnemy!.id]!.hp).toBe(nextEnemy!.maxHp - tool.damage - 1);
  });

  it('resets the chain on a secondary, a friendly strike, a fall and retry', () => {
    const plan = routePlan();
    const level = plan.levels[0]!;
    const enemy = level.encounters[0]!;
    const attack = (state: AdventureState, nowMs: number) =>
      apply(plan, state, { type: 'attack', levelId: level.id, encounterId: enemy.id }, nowMs);
    const first = attack(createInitialAdventureState(plan), 0);
    const guarded = collect(plan, first, 'guard-tool');
    const secondary = apply(plan, guarded, {
      type: 'secondary-attack', levelId: level.id, encounterId: enemy.id,
    }, ROUTE_ATTACK_COOLDOWN_MS);
    expect(secondary.attackCombo).toBeUndefined();
    expect(attack(secondary, ROUTE_ATTACK_COOLDOWN_MS * 2).attackCombo?.step).toBe(1);

    const equipped = collect(plan, createInitialAdventureState(plan), 'attack-tool');
    const toolHit = attack(equipped, 0);
    const friendlyId = friendlyDefinitionsForLevel(level.id, level.index)[0]!.id;
    const friendlyHit = reduceFriendlyAction(plan, toolHit, createInitialFriendlyState(plan), {
      type: 'attack-friendly', levelId: level.id, friendlyId,
    }, ROUTE_ATTACK_COOLDOWN_MS);
    expect(friendlyHit.adventureState.attackCombo).toBeUndefined();
    expect(attack(friendlyHit.adventureState, ROUTE_ATTACK_COOLDOWN_MS * 2).attackCombo?.step).toBe(1);

    const nearDeath = { ...first, playerHp: enemy.attackDamage };
    const fallen = apply(plan, nearDeath, {
      type: 'take-hit', levelId: level.id, encounterId: enemy.id,
    }, ENEMY_HIT_COOLDOWN_MS);
    expect(fallen.phase).toBe('fallen');
    expect(fallen.attackCombo).toBeUndefined();
    const retried = apply(plan, fallen, { type: 'retry-level', levelId: level.id },
      ENEMY_HIT_COOLDOWN_MS + 1);
    expect(retried.attackCombo).toBeUndefined();
    expect(attack(retried, ENEMY_HIT_COOLDOWN_MS + 1).attackCombo?.step).toBe(1);
  });

  it('loads a pre-combo save and replays a third-hit receipt without extra damage', () => {
    const initial = saveRecord();
    const plan = initial.adventurePlan!;
    const level = plan.levels[0]!;
    const enemy = level.encounters[0]!;
    expect(parseStoredAdventure(plan, initial.adventureState!).state.attackCombo).toBeUndefined();
    let save = initial;
    const startMs = Date.parse('2026-09-12T00:00:01.000Z');
    let thirdRequest: GameplayActionRequest | null = null;
    for (let hit = 0; hit < 3; hit += 1) {
      const request: GameplayActionRequest = {
        actionId: randomUUID(),
        expectedRevision: save.revision,
        action: { type: 'attack', levelId: level.id, encounterId: enemy.id },
      };
      if (hit === 2) thirdRequest = request;
      save = applyGameplayActionToSave(save, request,
        new Date(startMs + hit * ROUTE_ATTACK_COOLDOWN_MS)).save;
      expect(parseStoredAdventure(plan, structuredClone(save.adventureState!)).state.attackCombo?.step)
        .toBe((hit + 1) as 1 | 2 | 3);
    }
    const replay = applyGameplayActionToSave(save, thirdRequest!, new Date(startMs + 2_000));
    expect(replay.replay).toBe(true);
    expect(replay.save.revision).toBe(3);
    expect(replay.save.adventureState!.encounters[enemy.id]!.hp).toBe(enemy.maxHp - 4);
    expect(toSaveView(save, new Date(startMs + 2 * ROUTE_ATTACK_COOLDOWN_MS + PRIMARY_COMBO_WINDOW_MS + 1))
      .adventure!.attackComboStep)
      .toBeUndefined();
  });

  it('allows a one-damage basic attack, then upgrades damage from the frozen pickup', () => {
    const plan = routePlan();
    const level = plan.levels[0]!;
    const enemy = level.encounters[0]!;
    const initial = createInitialAdventureState(plan);
    expect(initial.equippedId).toBeNull();

    const barehanded = apply(plan, initial, {
      type: 'attack', levelId: level.id, encounterId: enemy.id,
    }, 0);
    expect(barehanded.encounters[enemy.id]).toMatchObject({ hp: enemy.maxHp - 1, defeated: false });
    expect(toAdventureView(plan, barehanded, 0).attackCooldownRemainingMs)
      .toBe(ROUTE_ATTACK_COOLDOWN_MS);
    expect(() => apply(plan, barehanded, {
      type: 'attack', levelId: level.id, encounterId: enemy.id,
    }, ROUTE_ATTACK_COOLDOWN_MS - 1)).toThrow('ATTACK_COOLDOWN');

    const upgraded = collect(plan, barehanded, 'attack-tool');
    const tool = level.pickups.find((pickup) => pickup.kind === 'attack-tool')!;
    const struck = apply(plan, upgraded, {
      type: 'attack', levelId: level.id, encounterId: enemy.id,
    }, ROUTE_ATTACK_COOLDOWN_MS);
    expect(struck.encounters[enemy.id]!.hp).toBe(enemy.maxHp - 1 - tool.damage);

    const forged = { ...initial, equippedId: 'missing-attack-tool' };
    expect(() => apply(plan, forged, {
      type: 'attack', levelId: level.id, encounterId: enemy.id,
    }, 0)).toThrow('ATTACK_TOOL_REQUIRED');
    const withGuard = collect(plan, initial, 'guard-tool');
    const guard = level.pickups.find((pickup) => pickup.kind === 'guard-tool')!;
    expect(() => apply(plan, { ...withGuard, equippedId: guard.id }, {
      type: 'attack', levelId: level.id, encounterId: enemy.id,
    }, 0)).toThrow('ATTACK_TOOL_REQUIRED');
    expect(() => reduceFriendlyAction(plan, withGuard, createInitialFriendlyState(plan), {
      type: 'attack-friendly', levelId: level.id,
      friendlyId: friendlyDefinitionsForLevel(level.id, level.index)[0]!.id,
    }, 0)).toThrow('ATTACK_TOOL_REQUIRED');
  });

  it('persists a basic attack as an authoritative save action', () => {
    const save = saveRecord();
    const level = save.adventurePlan!.levels[0]!;
    const enemy = level.encounters[0]!;
    const result = applyGameplayActionToSave(save, {
      actionId: randomUUID(),
      expectedRevision: save.revision,
      action: { type: 'attack', levelId: level.id, encounterId: enemy.id },
    }, new Date('2026-09-12T00:00:01.000Z'));
    expect(result.save.adventureState!.encounters[enemy.id]!.hp).toBe(enemy.maxHp - 1);
    expect(toSaveView(result.save, new Date('2026-09-12T00:00:01.000Z'))
      .adventure!.activeLevel!.encounters.find((entry) => entry.id === enemy.id)?.hp)
      .toBe(enemy.maxHp - 1);
  });

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

  it('freezes two three-photo chapters on five-slot authored playground routes', () => {
    const plan = routePlan();
    expect(plan.catalogVersion).toBe('parody-catalog-v5');
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
        routeId: 'garden-playground-v2',
      },
      {
        startAgeYears: 4,
        targetAgeYears: 7,
        minorMemoryIds: ['memory-age-5', 'memory-age-6'],
        majorMemoryId: 'memory-age-7',
        routeId: 'besties-playground-v2',
      },
    ]);
    expect(plan.levels.map((level) => level.encounters.map((encounter) => ({
      id: encounter.id,
      kind: encounter.kind,
      role: encounter.role,
      contentId: encounter.content.catalogEntryId,
    })))).toEqual([
      [
        { id: 'level-1-2020-encounter-1', kind: 'ordinary-a', role: 'ordinary', contentId: 'mister-hiss' },
        { id: 'level-1-2020-encounter-2', kind: 'ordinary-b', role: 'ordinary', contentId: 'peel-patrol' },
        { id: 'level-1-2020-encounter-3', kind: 'ordinary-a', role: 'ordinary', contentId: 'mister-hiss' },
        { id: 'level-1-2020-encounter-4', kind: 'ordinary-b', role: 'ordinary', contentId: 'peel-patrol' },
        { id: 'level-1-2020-boss', kind: 'boss', role: 'boss', contentId: 'drama-dragon' },
      ],
      [
        { id: 'level-2-2024-encounter-1', kind: 'ordinary-a', role: 'ordinary', contentId: 'sir-flush-a-lot-besties' },
        { id: 'level-2-2024-encounter-2', kind: 'ordinary-b', role: 'ordinary', contentId: 'peel-patrol-besties' },
        { id: 'level-2-2024-encounter-3', kind: 'ordinary-a', role: 'ordinary', contentId: 'sir-flush-a-lot-besties' },
        { id: 'level-2-2024-encounter-4', kind: 'ordinary-b', role: 'ordinary', contentId: 'peel-patrol-besties' },
        { id: 'level-2-2024-boss', kind: 'boss', role: 'boss', contentId: 'bickering-besties' },
      ],
    ]);
    expect(createInitialAdventureState(plan).abilities).toEqual(['move', 'interact', 'jump']);
    expect(() => createRouteMemoryPlan('2020-01-01', MEMORIES.slice(0, 5)))
      .toThrow('requires exactly 6 memories');
    expect(() => parseStoredAdventure({
      ...structuredClone(plan),
      levels: plan.levels.map((level) => ({ ...level, memoryIds: memoryIdsForLevel(level) })),
    }, createInitialAdventureState(plan))).toThrow('Save unavailable');
  });

  it('allows a v2 playground boss attack with ordinary encounters remaining while v1 stays gated', () => {
    const legacyPlan = createRouteMemoryPlan('2020-01-01', MEMORIES, 'parody-catalog-v4');
    const legacyLevel = legacyPlan.levels[0]!;
    const boss = legacyLevel.encounters.find((encounter) => encounter.role === 'boss')!;
    let state = collect(legacyPlan, createInitialAdventureState(legacyPlan), 'attack-tool');

    expect(toAdventureView(legacyPlan, state, 0).activeLevel!.encounters.find(
      (encounter) => encounter.id === boss.id,
    )).toMatchObject({ available: false, defeated: false, hp: boss.maxHp });
    expect(() => apply(legacyPlan, state, {
      type: 'attack', levelId: legacyLevel.id, encounterId: boss.id,
    }, 0)).toThrow('ENCOUNTER_NOT_ACTIVE');

    const v2Plan = routePlan();
    expect(toAdventureView(v2Plan, state, 0).activeLevel!.encounters.find(
      (encounter) => encounter.id === boss.id,
    )).toMatchObject({ available: true, defeated: false, hp: boss.maxHp });

    state = apply(v2Plan, state, {
      type: 'attack', levelId: legacyLevel.id, encounterId: boss.id,
    }, 0);
    expect(state.encounters[boss.id]).toMatchObject({
      hp: boss.maxHp - legacyLevel.pickups.find(
        (equipment) => equipment.kind === 'attack-tool',
      )!.damage,
      defeated: false,
    });
  });

  it('gives only newly created v3 Besties plans forgiving contact damage', () => {
    const plan = routePlan();
    const firstBoss = plan.levels[0]!.encounters.find((encounter) => encounter.role === 'boss')!;
    const besties = plan.levels[1]!.encounters.find((encounter) => encounter.role === 'boss')!;
    expect(firstBoss.content.catalogEntryId).not.toBe('bickering-besties');
    expect(firstBoss.attackDamage).toBe(3);
    expect(besties.content.catalogEntryId).toBe('bickering-besties');
    expect(besties.attackDamage).toBe(2);

    const v2 = createAdventurePlan('2020-01-01', MEMORIES);
    const v2Besties = v2.levels[1]!.encounters.find((encounter) => encounter.role === 'boss')!;
    expect(v2Besties.content.catalogEntryId).toBe('bickering-besties');
    expect(v2Besties.attackDamage).toBe(4);

    const frozenV3 = archivedRoutePlan();
    frozenV3.levels[1]!.encounters.find((encounter) => encounter.role === 'boss')!.attackDamage = 4;
    expect(parseStoredAdventure(frozenV3, createInitialAdventureState(frozenV3)).plan.levels[1]!
      .encounters.find((encounter) => encounter.role === 'boss')!.attackDamage).toBe(4);
  });

  it('isolates archived v4/v1 playgrounds from v5/v2 and rejects cross-version tampering', () => {
    const archived = archivedRoutePlan();
    expect(archived.levels.map((level) => ({
      routeId: level.routeId,
      ids: level.encounters.map((encounter) => encounter.id),
    }))).toEqual([
      {
        routeId: 'gentle-jump-v1',
        ids: ['level-1-2020-encounter-1', 'level-1-2020-encounter-2', 'level-1-2020-boss'],
      },
      {
        routeId: 'gentle-jump-v1',
        ids: ['level-2-2024-encounter-1', 'level-2-2024-encounter-2', 'level-2-2024-boss'],
      },
    ]);
    expect(parseStoredAdventure(archived, createInitialAdventureState(archived)).plan)
      .toEqual(archived);

    const v4 = archivedPlaygroundPlan();
    expect(v4.levels.map((level) => level.routeId)).toEqual([
      'garden-playground-v1',
      'besties-playground-v1',
    ]);
    expect(parseStoredAdventure(v4, createInitialAdventureState(v4)).plan).toEqual(v4);

    const fresh = routePlan();
    expect(fresh.levels.map((level) => level.routeId)).toEqual([
      'garden-playground-v2',
      'besties-playground-v2',
    ]);
    expect(parseStoredAdventure(fresh, createInitialAdventureState(fresh)).plan).toEqual(fresh);
    const invalidPlans: unknown[] = [];
    const v5WithV1Route = structuredClone(fresh);
    v5WithV1Route.levels[0]!.routeId = 'garden-playground-v1';
    invalidPlans.push(v5WithV1Route);
    const v4WithV2Route = structuredClone(v4);
    v4WithV2Route.levels[0]!.routeId = 'garden-playground-v2';
    invalidPlans.push(v4WithV2Route);
    invalidPlans.push({ ...structuredClone(v4), catalogVersion: 'parody-catalog-v5' });
    invalidPlans.push({ ...structuredClone(fresh), catalogVersion: 'parody-catalog-v3' });
    const changedRoster = structuredClone(fresh);
    changedRoster.levels[0]!.encounters[2]!.content = structuredClone(
      changedRoster.levels[0]!.encounters[1]!.content,
    );
    invalidPlans.push(changedRoster);
    const changedOrdinal = structuredClone(fresh);
    changedOrdinal.levels[0]!.encounters[2]!.id = 'level-1-2020-encounter-9';
    invalidPlans.push(changedOrdinal);
    const unknownRoute = structuredClone(fresh) as unknown as Record<string, unknown>;
    ((unknownRoute.levels as Array<Record<string, unknown>>)[0]!).routeId = 'unknown-route-v1';
    invalidPlans.push(unknownRoute);
    invalidPlans.push({ ...structuredClone(fresh), version: 'era-level-plan-v4' });

    for (const invalidPlan of invalidPlans) {
      expect(() => parseStoredAdventure(
        invalidPlan,
        createInitialAdventureState(invalidPlan as AdventurePlanV3),
      )).toThrow('Save unavailable');
    }
  });

  it('keeps four forgiving Besties contacts and resets the unbeaten boss after death', () => {
    const plan = routePlan();
    const firstLevel = plan.levels[0]!;
    let state = createInitialAdventureState(plan);
    state = collect(plan, state, 'attack-tool');
    for (const memoryId of firstLevel.minorMemoryIds) {
      state = apply(plan, state, {
        type: 'recover-memory', levelId: firstLevel.id, memoryId,
      }, 0);
    }
    state = defeatLevelEncounters(plan, state);
    state = apply(plan, state, {
      type: 'recover-memory', levelId: firstLevel.id, memoryId: firstLevel.majorMemoryId,
    }, 10_000);

    const bestiesLevel = plan.levels[1]!;
    const besties = bestiesLevel.encounters.find((encounter) => encounter.role === 'boss')!;
    let attackAtMs = 0;
    for (const encounter of bestiesLevel.encounters.filter(
      (candidate) => candidate.role === 'ordinary',
    )) {
      while (!state.encounters[encounter.id]!.defeated) {
        state = apply(plan, state, {
          type: 'attack', levelId: bestiesLevel.id, encounterId: encounter.id,
        }, attackAtMs);
        attackAtMs += ROUTE_ATTACK_COOLDOWN_MS;
      }
    }

    expect(besties.attackDamage).toBe(2);
    expect(toAdventureView(plan, state, attackAtMs).activeLevel!.encounters.find(
      (encounter) => encounter.id === besties.id,
    )!.available).toBe(true);
    let hitAtMs = 100_000;
    for (const expectedHp of [8, 6, 4, 2]) {
      state = apply(plan, state, {
        type: 'take-hit', levelId: bestiesLevel.id, encounterId: besties.id,
      }, hitAtMs);
      hitAtMs += ENEMY_HIT_COOLDOWN_MS;
      expect(state).toMatchObject({ playerHp: expectedHp, phase: 'exploring' });
    }
    state = apply(plan, state, {
      type: 'take-hit', levelId: bestiesLevel.id, encounterId: besties.id,
    }, hitAtMs);
    expect(state).toMatchObject({ playerHp: 0, phase: 'fallen' });

    state = apply(plan, state, {
      type: 'retry-level', levelId: bestiesLevel.id,
    }, hitAtMs + ENEMY_HIT_COOLDOWN_MS);
    expect(state).toMatchObject({ playerHp: 10, phase: 'exploring' });
    for (const ordinary of bestiesLevel.encounters.filter(
      (encounter) => encounter.role === 'ordinary',
    )) {
      expect(state.encounters[ordinary.id]).toMatchObject({ hp: 0, defeated: true });
    }
    expect(state.encounters[besties.id]).toMatchObject({
      hp: besties.maxHp,
      defeated: false,
      nextReportedHitAtMs: 0,
    });

    state = apply(plan, state, {
      type: 'attack', levelId: bestiesLevel.id, encounterId: besties.id,
    }, hitAtMs + ENEMY_HIT_COOLDOWN_MS);
    expect(state.encounters[besties.id]!.hp).toBe(besties.maxHp - 2);
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

  it('retries a boss loss without reviving defeated route encounters', () => {
    const plan = routePlan();
    const level = plan.levels[0]!;
    const ordinary = level.encounters.filter((encounter) => encounter.role === 'ordinary');
    const boss = level.encounters.find((encounter) => encounter.role === 'boss')!;
    let state = createInitialAdventureState(plan);
    state = collect(plan, state, 'attack-tool');
    state = collect(plan, state, 'guard-tool');
    for (const memoryId of level.minorMemoryIds) {
      state = apply(plan, state, {
        type: 'recover-memory', levelId: level.id, memoryId,
      }, 0);
    }

    let nowMs = 0;
    for (const encounter of ordinary) {
      while (!state.encounters[encounter.id]!.defeated) {
        state = apply(plan, state, {
          type: 'attack', levelId: level.id, encounterId: encounter.id,
        }, nowMs);
        nowMs += ROUTE_ATTACK_COOLDOWN_MS;
      }
    }
    state = apply(plan, state, {
      type: 'attack', levelId: level.id, encounterId: boss.id,
    }, nowMs);
    expect(state.encounters[boss.id]!.hp).toBeLessThan(boss.maxHp);

    while (state.phase !== 'fallen') {
      state = apply(plan, state, {
        type: 'take-hit', levelId: level.id, encounterId: boss.id,
      }, nowMs);
      nowMs += 900;
    }
    state = apply(plan, state, { type: 'retry-level', levelId: level.id }, nowMs);

    expect(state.revealedMemoryIds).toEqual(level.minorMemoryIds);
    expect(state.collectedPickupIds).toEqual(level.pickups.map((pickup) => pickup.pickupId));
    expect(state.inventoryIds).toEqual(level.pickups.map((pickup) => pickup.id));
    for (const encounter of ordinary) {
      expect(state.encounters[encounter.id]).toMatchObject({ hp: 0, defeated: true });
    }
    expect(state.encounters[boss.id]).toMatchObject({ hp: boss.maxHp, defeated: false });
    expect(toAdventureView(plan, state, nowMs).activeLevel!.encounters.find(
      (encounter) => encounter.id === boss.id,
    )).toMatchObject({ available: true, defeated: false, hp: boss.maxHp });

    while (!state.encounters[boss.id]!.defeated) {
      state = apply(plan, state, {
        type: 'attack', levelId: level.id, encounterId: boss.id,
      }, nowMs);
      nowMs += ROUTE_ATTACK_COOLDOWN_MS;
    }
    state = apply(plan, state, {
      type: 'recover-memory', levelId: level.id, memoryId: level.majorMemoryId,
    }, nowMs);
    expect(state).toMatchObject({ activeLevelIndex: 1, ageYears: 4, phase: 'exploring' });
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
      .toMatchObject({ secondaryCooldownRemainingMs: SECONDARY_ATTACK_COOLDOWN_MS, guardCooldownRemainingMs: 0 });
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

  it('shares the v3 primary cooldown between friendly harm and enemy attacks', () => {
    const plan = routePlan();
    const level = plan.levels[0]!;
    const friend = friendlyDefinitionsForLevel(level.id, level.index)[0]!;
    const initial = collect(plan, createInitialAdventureState(plan), 'attack-tool');
    const result = reduceFriendlyAction(plan, initial, createInitialFriendlyState(plan), {
      type: 'attack-friendly', levelId: level.id, friendlyId: friend.id,
    }, 0);
    expect(toAdventureView(plan, result.adventureState, 0).attackCooldownRemainingMs)
      .toBe(ROUTE_ATTACK_COOLDOWN_MS);
    for (const nowMs of [0, 199, 200, ROUTE_ATTACK_COOLDOWN_MS - 1]) {
      expect(() => apply(plan, result.adventureState, {
        type: 'attack', levelId: level.id, encounterId: level.encounters[0]!.id,
      }, nowMs)).toThrow('ATTACK_COOLDOWN');
    }
    expect(() => apply(plan, result.adventureState, {
      type: 'attack', levelId: level.id, encounterId: level.encounters[0]!.id,
    }, ROUTE_ATTACK_COOLDOWN_MS)).not.toThrow();
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
