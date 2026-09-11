import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createAdventurePlan,
  createInitialAdventureState,
  type AdventurePlan,
} from '../../src/shared/adventure.js';
import type { GameplayAction, GameplayActionRequest } from '../../src/shared/contracts.js';
import {
  FRIENDLY_CATALOG_V1,
  createInitialFriendlyState,
  friendlyDefinitionsForLevel,
} from '../../src/shared/friendly.js';
import { PARODY_CATALOGS } from '../../src/shared/parody-catalog.js';
import { InMemoryQuestStore } from '../../src/server/db/memory-store.js';
import {
  RULE_VERSIONS,
  toSaveView,
  type SaveRecord,
} from '../../src/server/domain.js';
import { gameplayActionRequestSchema } from '../../src/server/validation.js';

const OWNER_ID = '10000000-0000-4000-8000-000000000001';
const STRANGER_ID = '20000000-0000-4000-8000-000000000002';
const SAVE_ID = '30000000-0000-4000-8000-000000000003';

function fixturePlan(): AdventurePlan {
  return createAdventurePlan('2020-01-01', [
    { id: 'zero', date: '2020-07-01', ageYears: 0 },
    { id: 'four', date: '2024-01-01', ageYears: 4 },
    { id: 'seven', date: '2027-01-01', ageYears: 7 },
  ]);
}

function eraSave(
  plan = fixturePlan(),
  friendlyState: SaveRecord['friendlyState'] = null,
): SaveRecord {
  const now = new Date('2026-09-11T00:00:00.000Z');
  return {
    id: SAVE_ID,
    ownerId: OWNER_ID,
    previewId: '40000000-0000-4000-8000-000000000004',
    title: 'Friendly fixture',
    subject: { id: 'demo-adventurer-v1', label: 'Demo Adventurer' },
    birthDate: '2020-01-01',
    memories: [
      { id: 'zero', date: '2020-07-01', ageYears: 0 },
      { id: 'four', date: '2024-01-01', ageYears: 4 },
      { id: 'seven', date: '2027-01-01', ageYears: 7 },
    ].map((memory) => ({
      ...memory,
      label: memory.id,
      source: { kind: 'fixture' as const, key: memory.id },
    })),
    recoveredIds: [],
    ageYears: 0,
    abilities: ['move', 'interact'],
    appearanceStage: 'infant',
    completed: false,
    saveFormat: 'era-combat-v2',
    adventurePlan: plan,
    adventureState: createInitialAdventureState(plan),
    friendlyState,
    revision: 0,
    createdAt: now,
    updatedAt: now,
    versions: RULE_VERSIONS,
  };
}

async function apply(
  store: InMemoryQuestStore,
  save: SaveRecord,
  action: GameplayAction,
  nowMs = Date.parse('2026-09-11T12:00:00.000Z'),
  actionId = randomUUID(),
): Promise<SaveRecord> {
  return store.applyGameplayAction(OWNER_ID, save.id, {
    actionId,
    expectedRevision: save.revision,
    action,
  }, new Date(nowMs));
}

describe('friendly save sidecar', () => {
  it('keeps all six identities outside the archived parody catalogs and assigns three per chapter', () => {
    expect(FRIENDLY_CATALOG_V1.map((entry) => entry.id)).toEqual([
      'blockling',
      'signal-moth',
      'buffer-baron',
      'loop-dancer',
      'prism-mimic',
      'trendweaver',
    ]);
    const parodyIds = Object.values(PARODY_CATALOGS).flat().map((entry) => entry.id);
    expect(FRIENDLY_CATALOG_V1.every((entry) => !parodyIds.includes(entry.id))).toBe(true);

    const plan = fixturePlan();
    expect(friendlyDefinitionsForLevel(plan.levels[0]!.id, 0).map((entry) => entry.assetId)).toEqual([
      'blockling',
      'signal-moth',
      'buffer-baron',
    ]);
    expect(friendlyDefinitionsForLevel(plan.levels[1]!.id, 1).map((entry) => entry.assetId)).toEqual([
      'loop-dancer',
      'prism-mimic',
      'trendweaver',
    ]);
    const trustedShape = {
      actionId: randomUUID(),
      expectedRevision: 0,
      action: {
        type: 'attack-friendly',
        levelId: plan.levels[0]!.id,
        friendlyId: friendlyDefinitionsForLevel(plan.levels[0]!.id, 0)[0]!.id,
      },
    };
    expect(gameplayActionRequestSchema.safeParse(trustedShape).success).toBe(true);
    expect(gameplayActionRequestSchema.safeParse({
      ...trustedShape,
      action: { ...trustedShape.action, assetId: 'forged', damage: 999 },
    }).success).toBe(false);
  });

  it('shows defaults for an old null sidecar and persists them on the first successful action', async () => {
    const save = eraSave();
    const store = new InMemoryQuestStore([save]);
    const storedBefore = await store.getSave(OWNER_ID, SAVE_ID);
    expect(storedBefore!.friendlyState).toBeNull();

    const view = toSaveView(storedBefore!, new Date());
    expect(view.adventure!.activeLevel!.friendlies).toHaveLength(3);
    expect(view.adventure!.activeLevel!.friendlies!.every((friendly) =>
      friendly.hp === 4 && !friendly.defeated && !friendly.boonClaimed && !friendly.penaltyActive
    )).toBe(true);
    expect((await store.getSave(OWNER_ID, SAVE_ID))!.friendlyState).toBeNull();

    const level = save.adventurePlan!.levels[0]!;
    const fullHealth = await store.applyGameplayAction(OWNER_ID, SAVE_ID, {
      actionId: randomUUID(),
      expectedRevision: 0,
      action: {
        type: 'interact-friendly',
        levelId: level.id,
        friendlyId: view.adventure!.activeLevel!.friendlies![0]!.id,
      },
    }, new Date()).catch((error) => error);
    expect(fullHealth).toMatchObject({ code: 'FRIENDLY_HELP_NOT_NEEDED' });
    expect((await store.getSave(OWNER_ID, SAVE_ID))!).toMatchObject({
      revision: 0,
      friendlyState: null,
    });

    const acted = await apply(store, save, {
      type: 'take-hit',
      levelId: level.id,
      encounterId: level.encounters[0]!.id,
    });
    expect(acted.revision).toBe(1);
    expect(acted.friendlyState).toEqual(createInitialFriendlyState(save.adventurePlan!));
  });

  it('grants each healing boon once and replays without applying it twice', async () => {
    const initial = eraSave();
    const store = new InMemoryQuestStore([initial]);
    const level = initial.adventurePlan!.levels[0]!;
    const friendlyId = friendlyDefinitionsForLevel(level.id, level.index)[0]!.id;
    let save = await apply(store, initial, {
      type: 'take-hit', levelId: level.id, encounterId: level.encounters[0]!.id,
    });
    expect(save.adventureState!.playerHp).toBe(8);

    const actionId = randomUUID();
    const request: GameplayActionRequest = {
      actionId,
      expectedRevision: save.revision,
      action: { type: 'interact-friendly', levelId: level.id, friendlyId },
    };
    const healed = await store.applyGameplayAction(OWNER_ID, SAVE_ID, request, new Date());
    const replayed = await store.applyGameplayAction(OWNER_ID, SAVE_ID, request, new Date());
    expect(replayed).toEqual(healed);
    expect(healed.adventureState!.playerHp).toBe(10);
    expect(healed.friendlyState!.friendlies[friendlyId]!.boonClaimed).toBe(true);

    save = await apply(store, healed, {
      type: 'take-hit', levelId: level.id, encounterId: level.encounters[1]!.id,
    });
    const secondGreeting = await apply(store, save, {
      type: 'interact-friendly', levelId: level.id, friendlyId,
    }).catch((error) => error);
    expect(secondGreeting).toMatchObject({ code: 'FRIENDLY_BOON_ALREADY_CLAIMED' });
    expect((await store.getSave(OWNER_ID, SAVE_ID))!.adventureState!.playerHp).toBe(8);
  });

  it('uses weapon damage and cooldown, penalizes first harm, and repairs without resetting the boon', async () => {
    const initial = eraSave();
    const store = new InMemoryQuestStore([initial]);
    const level = initial.adventurePlan!.levels[0]!;
    const attackTool = level.pickups.find((pickup) => pickup.kind === 'attack-tool')!;
    const friendlyId = friendlyDefinitionsForLevel(level.id, level.index)[0]!.id;
    const startMs = Date.parse('2026-09-11T12:00:00.000Z');
    let save = await apply(store, initial, {
      type: 'collect-equipment', levelId: level.id, pickupId: attackTool.pickupId,
    }, startMs);

    const attackId = randomUUID();
    const firstAttack: GameplayActionRequest = {
      actionId: attackId,
      expectedRevision: save.revision,
      action: { type: 'attack-friendly', levelId: level.id, friendlyId },
    };
    const harmed = await store.applyGameplayAction(OWNER_ID, SAVE_ID, firstAttack, new Date(startMs));
    const replayed = await store.applyGameplayAction(OWNER_ID, SAVE_ID, firstAttack, new Date(startMs));
    expect(replayed).toEqual(harmed);
    expect(harmed.adventureState!.playerHp).toBe(8);
    expect(harmed.friendlyState!.friendlies[friendlyId]).toEqual({
      hp: 2,
      defeated: false,
      boonClaimed: false,
      penaltyActive: true,
    });
    const cooldown = await apply(store, harmed, {
      type: 'attack-friendly', levelId: level.id, friendlyId,
    }, startMs).catch((error) => error);
    expect(cooldown).toMatchObject({ code: 'ATTACK_COOLDOWN' });

    save = await apply(store, harmed, {
      type: 'attack-friendly', levelId: level.id, friendlyId,
    }, startMs + 600);
    expect(save.adventureState!.playerHp).toBe(8);
    expect(save.friendlyState!.friendlies[friendlyId]).toMatchObject({
      hp: 0,
      defeated: true,
      penaltyActive: true,
    });

    save = await apply(store, save, {
      type: 'interact-friendly', levelId: level.id, friendlyId,
    }, startMs + 600);
    expect(save.adventureState!.playerHp).toBe(8);
    expect(save.friendlyState!.friendlies[friendlyId]).toEqual({
      hp: 4,
      defeated: false,
      boonClaimed: false,
      penaltyActive: false,
    });
    save = await apply(store, save, {
      type: 'interact-friendly', levelId: level.id, friendlyId,
    }, startMs + 600);
    expect(save.adventureState!.playerHp).toBe(10);
    expect(save.friendlyState!.friendlies[friendlyId]!.boonClaimed).toBe(true);

    await expect(store.applyGameplayAction(STRANGER_ID, SAVE_ID, {
      actionId: randomUUID(),
      expectedRevision: save.revision,
      action: { type: 'attack-friendly', levelId: level.id, friendlyId },
    }, new Date(startMs + 1_200))).rejects.toMatchObject({ code: 'SAVE_NOT_FOUND' });
  });

  it('floors the harm penalty at one health and rejects malformed sidecars', async () => {
    const lowHealth = eraSave();
    lowHealth.adventureState!.playerHp = 1;
    const store = new InMemoryQuestStore([lowHealth]);
    const level = lowHealth.adventurePlan!.levels[0]!;
    const attackTool = level.pickups.find((pickup) => pickup.kind === 'attack-tool')!;
    const friendlyId = friendlyDefinitionsForLevel(level.id, level.index)[0]!.id;
    let save = await apply(store, lowHealth, {
      type: 'collect-equipment', levelId: level.id, pickupId: attackTool.pickupId,
    });
    save = await apply(store, save, {
      type: 'attack-friendly', levelId: level.id, friendlyId,
    });
    expect(save.adventureState).toMatchObject({ playerHp: 1, phase: 'exploring' });

    const malformed = eraSave(fixturePlan(), createInitialFriendlyState(fixturePlan()));
    delete malformed.friendlyState!.friendlies[
      Object.keys(malformed.friendlyState!.friendlies)[0]!
    ];
    expect(() => new InMemoryQuestStore([malformed])).toThrow(expect.objectContaining({
      code: 'SAVE_DATA_INVALID',
    }));
  });

  it('preserves friendly harm through retry and never makes it a chapter gate', async () => {
    const initial = eraSave();
    const store = new InMemoryQuestStore([initial]);
    const level = initial.adventurePlan!.levels[0]!;
    const attackTool = level.pickups.find((pickup) => pickup.kind === 'attack-tool')!;
    const friendlyId = friendlyDefinitionsForLevel(level.id, level.index)[0]!.id;
    let nowMs = Date.parse('2026-09-11T12:00:00.000Z');
    let save = await apply(store, initial, {
      type: 'collect-equipment', levelId: level.id, pickupId: attackTool.pickupId,
    }, nowMs);
    save = await apply(store, save, {
      type: 'attack-friendly', levelId: level.id, friendlyId,
    }, nowMs);

    while (save.adventureState!.phase !== 'fallen') {
      nowMs += 900;
      save = await apply(store, save, {
        type: 'take-hit', levelId: level.id, encounterId: level.encounters[0]!.id,
      }, nowMs);
    }
    save = await apply(store, save, { type: 'retry-level', levelId: level.id }, nowMs);
    expect(save.adventureState!.playerHp).toBe(10);
    expect(save.friendlyState!.friendlies[friendlyId]).toMatchObject({
      hp: 2,
      defeated: false,
      penaltyActive: true,
    });

    for (const encounter of level.encounters) {
      while (!save.adventureState!.encounters[encounter.id]!.defeated) {
        nowMs += 600;
        save = await apply(store, save, {
          type: 'attack', levelId: level.id, encounterId: encounter.id,
        }, nowMs);
      }
    }
    expect(save.adventureState!.phase).toBe('memory-released');
    for (const memoryId of level.memoryIds) {
      save = await apply(store, save, {
        type: 'recover-memory', levelId: level.id, memoryId,
      }, nowMs);
    }
    save = await apply(store, save, {
      type: 'consume-memory-bundle', levelId: level.id,
    }, nowMs);
    expect(save.adventureState).toMatchObject({
      activeLevelIndex: 1,
      phase: 'exploring',
      completedLevelIds: [level.id],
    });
    expect(save.friendlyState!.friendlies[friendlyId]!.penaltyActive).toBe(true);
    expect(toSaveView(save, new Date(nowMs)).adventure!.activeLevel!.friendlies!
      .map((friendly) => friendly.assetId)).toEqual([
      'loop-dancer',
      'prism-mimic',
      'trendweaver',
    ]);
  });
});
