import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  createAdventurePlan,
  createInitialAdventureState,
  reduceAdventureAction,
  type AdventurePlan,
} from '../../src/shared/adventure.js';
import type { GameplayActionRequest } from '../../src/shared/contracts.js';
import { InMemoryQuestStore } from '../../src/server/db/memory-store.js';
import { RULE_VERSIONS, type SaveRecord } from '../../src/server/domain.js';
import { AppError } from '../../src/server/errors.js';

vi.mock('../../src/shared/adventure.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/shared/adventure.js')>();
  return { ...actual, reduceAdventureAction: vi.fn(actual.reduceAdventureAction) };
});

const OWNER_ID = '10000000-0000-4000-8000-000000000001';
const SAVE_ID = '30000000-0000-4000-8000-000000000003';
const MEMORIES = [{ id: 'zero', date: '2020-07-01', ageYears: 0 }];

function eraSave(plan: AdventurePlan): SaveRecord {
  const now = new Date('2026-09-11T00:00:00.000Z');
  return {
    id: SAVE_ID,
    ownerId: OWNER_ID,
    previewId: '40000000-0000-4000-8000-000000000004',
    title: 'Era fixture',
    subject: { id: 'demo-adventurer-v1', label: 'Demo Adventurer' },
    birthDate: '2020-01-01',
    memories: MEMORIES.map((memory) => ({
      ...memory,
      label: 'Memory 1',
      source: { kind: 'fixture', key: 'demo-memory-2020-07' },
    })),
    recoveredIds: [],
    ageYears: 0,
    abilities: ['move', 'interact'],
    appearanceStage: 'infant',
    completed: false,
    saveFormat: 'era-combat-v2',
    adventurePlan: plan,
    adventureState: createInitialAdventureState(plan),
    revision: 0,
    createdAt: now,
    updatedAt: now,
    versions: RULE_VERSIONS,
  };
}

describe('gameplay action persistence', () => {
  it('fails the action before the store writes an impossible reducer result', async () => {
    const plan = createAdventurePlan('2020-01-01', MEMORIES);
    const level = plan.levels[0]!;
    const store = new InMemoryQuestStore([eraSave(plan)]);
    const request: GameplayActionRequest = {
      actionId: randomUUID(),
      expectedRevision: 0,
      action: { type: 'collect-equipment', levelId: level.id, pickupId: level.pickups[0]!.pickupId },
    };

    vi.mocked(reduceAdventureAction).mockImplementationOnce((_plan, current) => ({
      ...structuredClone(current),
      playerHp: current.maxPlayerHp + 1,
    }));
    const failure = await store.applyGameplayAction(OWNER_ID, SAVE_ID, request, new Date()).catch((error) => error);
    expect(failure).toBeInstanceOf(AppError);
    expect(failure).toMatchObject({ status: 503, code: 'SAVE_DATA_INVALID' });

    const untouched = await store.getSave(OWNER_ID, SAVE_ID);
    expect(untouched).toMatchObject({ revision: 0, adventureState: { actionReceipts: [], playerHp: 10 } });

    const applied = await store.applyGameplayAction(OWNER_ID, SAVE_ID, request, new Date());
    expect(applied.revision).toBe(1);
    expect(applied.adventureState!.inventoryIds).toEqual([level.pickups[0]!.id]);
  });

  it('keeps the frozen plan authoritative over current combat defaults when validating a write', async () => {
    const plan = createAdventurePlan('2020-01-01', MEMORIES);
    const level = plan.levels[0]!;
    const attackTool = level.pickups.find((pickup) => pickup.kind === 'attack-tool')!;
    const enemy = level.encounters[0]!;
    const frozenDamage = attackTool.damage + 3;
    const frozenMaxHp = enemy.maxHp + 5;
    attackTool.damage = frozenDamage;
    enemy.maxHp = frozenMaxHp;
    const store = new InMemoryQuestStore([eraSave(plan)]);

    const collected = await store.applyGameplayAction(OWNER_ID, SAVE_ID, {
      actionId: randomUUID(),
      expectedRevision: 0,
      action: { type: 'collect-equipment', levelId: level.id, pickupId: attackTool.pickupId },
    }, new Date());
    const attacked = await store.applyGameplayAction(OWNER_ID, SAVE_ID, {
      actionId: randomUUID(),
      expectedRevision: collected.revision,
      action: { type: 'attack', levelId: level.id, encounterId: enemy.id },
    }, new Date());
    expect(attacked.adventureState!.encounters[enemy.id]!.hp).toBe(frozenMaxHp - frozenDamage);

    const persisted = await store.getSave(OWNER_ID, SAVE_ID);
    expect(persisted!.revision).toBe(2);
    expect(persisted!.adventurePlan!.levels[0]!.encounters[0]!.maxHp).toBe(frozenMaxHp);
    expect(persisted!.adventureState!.encounters[enemy.id]).toMatchObject({
      hp: frozenMaxHp - frozenDamage,
      defeated: false,
    });
  });
});
