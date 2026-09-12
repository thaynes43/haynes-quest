import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { memoryIdsForLevel, memoryRoleForLevel } from '../../src/shared/adventure.js';
import type { GameplayAction, GameplayActionRequest } from '../../src/shared/contracts.js';
import { friendlyDefinitionsForLevel } from '../../src/shared/friendly.js';
import { PostgresQuestStore } from '../../src/server/db/postgres-store.js';
import {
  FIXTURE_SUBJECT,
  ROUTE_MEMORY_RULE_VERSIONS,
  wholeYearsAt,
  type NewPreviewRecord,
  type SaveRecord,
} from '../../src/server/domain.js';

const testDatabaseUrl = process.env.QUEST_TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)('Postgres quest store', () => {
  beforeAll(async () => {
    const store = PostgresQuestStore.connect(testDatabaseUrl!);
    try {
      await store.migrate();
    } finally {
      await store.close();
    }
  });

  beforeEach(async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl, max: 1 });
    try {
      await pool.query(
        'TRUNCATE quest_saves, quest_setup_previews, quest_fixture_sessions, quest_players RESTART IDENTITY CASCADE',
      );
    } finally {
      await pool.end();
    }
  });

  it('Postgres persists a fixture session and save across store restart', async () => {
    const sessionId = '11111111-1111-4111-8111-111111111111';
    const firstStore = PostgresQuestStore.connect(testDatabaseUrl!);
    expect(await firstStore.ready()).toBe(true);
    const player = await firstStore.createFixtureSession(sessionId, new Date(Date.now() + 60_000));
    const preview = await firstStore.putPreview(previewInput(player.id));
    const created = await firstStore.createSave({
      ownerId: player.id,
      previewId: preview.previewId,
      selectedIds: preview.selectedIds,
    });
    await firstStore.close();

    const restartedStore = PostgresQuestStore.connect(testDatabaseUrl!);
    try {
      expect(await restartedStore.getSession(sessionId, new Date())).toEqual(player);
      const resumed = await restartedStore.getSave(player.id, created.id);
      expect(resumed).toMatchObject({
        id: created.id,
        recoveredIds: [],
        revision: 0,
        saveFormat: 'era-combat-v2',
        adventureState: { phase: 'exploring', ageYears: 0 },
      });
    } finally {
      await restartedStore.close();
    }
  });

  it('Postgres persists a fresh route-memory plan and its progression across restarts', async () => {
    const sessionId = '99999999-9999-4999-8999-999999999999';
    const firstStore = PostgresQuestStore.connect(testDatabaseUrl!);
    const player = await firstStore.createFixtureSession(
      sessionId,
      new Date(Date.now() + 60_000),
    );
    const preview = await firstStore.putPreview(previewInputForDates(player.id, '2020-01-01', [
      '2020-07-01',
      '2022-01-01',
      '2024-01-01',
      '2025-01-01',
      '2026-01-01',
      '2027-01-01',
    ]));
    const created = await firstStore.createSave({
      ownerId: player.id,
      previewId: preview.previewId,
      selectedIds: preview.selectedIds,
      planMode: 'route-memories',
    });
    const plan = created.adventurePlan;
    if (!plan || plan.version !== 'era-level-plan-v3') throw new Error('Expected a v3 plan');
    expect(created).toMatchObject({
      abilities: ['move', 'interact', 'jump'],
      versions: ROUTE_MEMORY_RULE_VERSIONS,
      adventureState: {
        abilities: ['move', 'interact', 'jump'],
        phase: 'exploring',
      },
    });
    expect(plan.catalogVersion).toBe('parody-catalog-v4');
    expect(plan.levels.map((level) => ({
      routeId: level.routeId,
      memories: memoryIdsForLevel(level).map((id) => [id, memoryRoleForLevel(level, id)]),
      encounterIds: level.encounters.map((encounter) => encounter.id),
      encounterRoles: level.encounters.map((encounter) => encounter.role),
    }))).toEqual([
      {
        routeId: 'garden-playground-v1',
        memories: [
          ['memory-0', 'minor'],
          ['memory-1', 'minor'],
          ['memory-2', 'major'],
        ],
        encounterIds: [
          'level-1-2020-encounter-1',
          'level-1-2020-encounter-2',
          'level-1-2020-encounter-3',
          'level-1-2020-encounter-4',
          'level-1-2020-boss',
        ],
        encounterRoles: ['ordinary', 'ordinary', 'ordinary', 'ordinary', 'boss'],
      },
      {
        routeId: 'besties-playground-v1',
        memories: [
          ['memory-3', 'minor'],
          ['memory-4', 'minor'],
          ['memory-5', 'major'],
        ],
        encounterIds: [
          'level-2-2024-encounter-1',
          'level-2-2024-encounter-2',
          'level-2-2024-encounter-3',
          'level-2-2024-encounter-4',
          'level-2-2024-boss',
        ],
        encounterRoles: ['ordinary', 'ordinary', 'ordinary', 'ordinary', 'boss'],
      },
    ]);
    await firstStore.close();

    const restartedStore = PostgresQuestStore.connect(testDatabaseUrl!);
    let resumed = await restartedStore.getSave(player.id, created.id);
    expect(resumed).toMatchObject({
      id: created.id,
      revision: 0,
      abilities: ['move', 'interact', 'jump'],
      versions: ROUTE_MEMORY_RULE_VERSIONS,
      adventurePlan: {
        version: 'era-level-plan-v3',
        catalogVersion: 'parody-catalog-v4',
      },
      adventureState: {
        abilities: ['move', 'interact', 'jump'],
        activeLevelIndex: 0,
        phase: 'exploring',
      },
    });
    if (!resumed?.adventurePlan || resumed.adventurePlan.version !== 'era-level-plan-v3') {
      throw new Error('Expected the persisted v3 plan');
    }
    let nowMs = Date.parse('2026-09-12T12:00:00.000Z');
    const firstLevel = resumed.adventurePlan.levels[0]!;
    for (const memoryId of firstLevel.minorMemoryIds) {
      resumed = await applyStoreAction(restartedStore, player.id, resumed, {
        type: 'recover-memory', levelId: firstLevel.id, memoryId,
      }, nowMs);
    }
    const attackTool = firstLevel.pickups.find((pickup) => pickup.kind === 'attack-tool')!;
    resumed = await applyStoreAction(restartedStore, player.id, resumed, {
      type: 'collect-equipment', levelId: firstLevel.id, pickupId: attackTool.pickupId,
    }, nowMs);
    for (const encounter of firstLevel.encounters) {
      while (!resumed.adventureState!.encounters[encounter.id]!.defeated) {
        nowMs += 600;
        resumed = await applyStoreAction(restartedStore, player.id, resumed, {
          type: 'attack', levelId: firstLevel.id, encounterId: encounter.id,
        }, nowMs);
      }
    }
    expect(resumed).toMatchObject({
      ageYears: 0,
      recoveredIds: ['memory-0', 'memory-1'],
      adventureState: { phase: 'memory-released' },
    });
    resumed = await applyStoreAction(restartedStore, player.id, resumed, {
      type: 'recover-memory', levelId: firstLevel.id, memoryId: firstLevel.majorMemoryId,
    }, nowMs);
    expect(resumed).toMatchObject({
      ageYears: 4,
      abilities: ['move', 'interact', 'jump'],
      recoveredIds: ['memory-0', 'memory-1', 'memory-2'],
      completed: false,
      versions: ROUTE_MEMORY_RULE_VERSIONS,
      adventureState: {
        activeLevelIndex: 1,
        phase: 'exploring',
        completedLevelIds: [firstLevel.id],
        consumedMemoryIds: ['memory-0', 'memory-1', 'memory-2'],
      },
    });
    await restartedStore.close();

    const secondRestart = PostgresQuestStore.connect(testDatabaseUrl!);
    try {
      expect(await secondRestart.getSave(player.id, created.id)).toMatchObject({
        revision: resumed.revision,
        ageYears: 4,
        abilities: ['move', 'interact', 'jump'],
        versions: ROUTE_MEMORY_RULE_VERSIONS,
        adventureState: {
          activeLevelIndex: 1,
          phase: 'exploring',
          completedLevelIds: [firstLevel.id],
        },
      });
    } finally {
      await secondRestart.close();
    }
  });

  it('Postgres leaves no partial save when dated catalog coverage is unavailable', async () => {
    const store = PostgresQuestStore.connect(testDatabaseUrl!);
    try {
      const owner = await store.createFixtureSession(randomUUID(), new Date(Date.now() + 60_000));
      const preview = await store.putPreview(previewInputForDates(owner.id, '2019-01-01', [
        '2019-06-01',
      ]));
      await expect(store.createSave({
        ownerId: owner.id,
        previewId: preview.previewId,
        selectedIds: preview.selectedIds,
      })).rejects.toMatchObject({
        status: 422,
        code: 'ERA_CATALOG_UNAVAILABLE',
        message: 'Adventure catalog unavailable',
      });
      expect(await store.listSaves(owner.id)).toEqual([]);
    } finally {
      await store.close();
    }
  });

  it('Postgres serializes idempotent combat actions and scopes every query by owner', async () => {
    const store = PostgresQuestStore.connect(testDatabaseUrl!);
    try {
      const owner = await store.createFixtureSession(
        '22222222-2222-4222-8222-222222222222',
        new Date(Date.now() + 60_000),
      );
      const stranger = await store.createFixtureSession(
        '33333333-3333-4333-8333-333333333333',
        new Date(Date.now() + 60_000),
      );
      const preview = await store.putPreview(previewInput(owner.id));
      const save = await store.createSave({
        ownerId: owner.id,
        previewId: preview.previewId,
        selectedIds: preview.selectedIds,
      });

      const level = save.adventurePlan!.levels[0]!;
      const attackTool = level.pickups.find((pickup) => pickup.kind === 'attack-tool')!;
      const equipped = await store.applyGameplayAction(owner.id, save.id, {
        actionId: randomUUID(),
        expectedRevision: 0,
        action: { type: 'collect-equipment', levelId: level.id, pickupId: attackTool.pickupId },
      }, new Date());
      const actionId = randomUUID();
      const attack = {
        actionId,
        expectedRevision: equipped.revision,
        action: { type: 'attack' as const, levelId: level.id, encounterId: level.encounters[0]!.id },
      };
      const [first, retried] = await Promise.all([
        store.applyGameplayAction(owner.id, save.id, attack, new Date()),
        store.applyGameplayAction(owner.id, save.id, attack, new Date()),
      ]);
      expect(first.revision).toBe(2);
      expect(retried.revision).toBe(2);
      expect(first.adventureState!.encounters[level.encounters[0]!.id]!.hp).toBe(
        level.encounters[0]!.maxHp - attackTool.damage,
      );
      expect(retried.adventureState!.encounters[level.encounters[0]!.id]!.hp).toBe(
        first.adventureState!.encounters[level.encounters[0]!.id]!.hp,
      );
      expect(await store.getSave(stranger.id, save.id)).toBeNull();
      await expect(store.applyGameplayAction(stranger.id, save.id, {
        actionId: randomUUID(),
        expectedRevision: first.revision,
        action: { type: 'attack', levelId: level.id, encounterId: level.encounters[1]!.id },
      }, new Date()))
        .rejects.toMatchObject({ code: 'SAVE_NOT_FOUND' });
    } finally {
      await store.close();
    }
  });

  it('Postgres atomically persists and replays friendly health and penalty changes', async () => {
    const store = PostgresQuestStore.connect(testDatabaseUrl!);
    try {
      const owner = await store.createFixtureSession(
        '77777777-7777-4777-8777-777777777777',
        new Date(Date.now() + 60_000),
      );
      const stranger = await store.createFixtureSession(
        '88888888-8888-4888-8888-888888888888',
        new Date(Date.now() + 60_000),
      );
      const preview = await store.putPreview(previewInput(owner.id));
      let save = await store.createSave({
        ownerId: owner.id,
        previewId: preview.previewId,
        selectedIds: preview.selectedIds,
      });
      const level = save.adventurePlan!.levels[0]!;
      const attackTool = level.pickups.find((pickup) => pickup.kind === 'attack-tool')!;
      const friendlyId = friendlyDefinitionsForLevel(level.id, level.index)[0]!.id;
      const nowMs = Date.parse('2026-09-11T12:00:00.000Z');
      save = await applyStoreAction(store, owner.id, save, {
        type: 'collect-equipment', levelId: level.id, pickupId: attackTool.pickupId,
      }, nowMs);
      const attack: GameplayActionRequest = {
        actionId: randomUUID(),
        expectedRevision: save.revision,
        action: { type: 'attack-friendly', levelId: level.id, friendlyId },
      };
      const [first, replay] = await Promise.all([
        store.applyGameplayAction(owner.id, save.id, attack, new Date(nowMs)),
        store.applyGameplayAction(owner.id, save.id, attack, new Date(nowMs)),
      ]);
      expect(replay).toEqual(first);
      expect(first.adventureState!.playerHp).toBe(8);
      expect(first.friendlyState!.friendlies[friendlyId]).toEqual({
        hp: 2,
        defeated: false,
        boonClaimed: false,
        penaltyActive: true,
      });
      expect(await store.getSave(owner.id, save.id)).toMatchObject({
        revision: first.revision,
        adventureState: { playerHp: 8 },
        friendlyState: { friendlies: { [friendlyId]: { hp: 2, penaltyActive: true } } },
      });
      await expect(store.applyGameplayAction(stranger.id, save.id, {
        actionId: randomUUID(),
        expectedRevision: first.revision,
        action: { type: 'attack-friendly', levelId: level.id, friendlyId },
      }, new Date(nowMs + 600))).rejects.toMatchObject({ code: 'SAVE_NOT_FOUND' });
    } finally {
      await store.close();
    }
  });

  it('Postgres scopes receipts by save and rejects one of two stale-tab writes', async () => {
    const store = PostgresQuestStore.connect(testDatabaseUrl!);
    try {
      const owner = await store.createFixtureSession(randomUUID(), new Date(Date.now() + 60_000));
      const saves: SaveRecord[] = [];
      for (let index = 0; index < 2; index += 1) {
        const preview = await store.putPreview(previewInput(owner.id));
        saves.push(await store.createSave({
          ownerId: owner.id,
          previewId: preview.previewId,
          selectedIds: preview.selectedIds,
        }));
      }
      const sharedActionId = randomUUID();
      const level = saves[0]!.adventurePlan!.levels[0]!;
      const attackTool = level.pickups.find((pickup) => pickup.kind === 'attack-tool')!;
      const collectRequest: GameplayActionRequest = {
        actionId: sharedActionId,
        expectedRevision: 0,
        action: { type: 'collect-equipment', levelId: level.id, pickupId: attackTool.pickupId },
      };
      const [first, second] = await Promise.all(saves.map((save) =>
        store.applyGameplayAction(owner.id, save.id, collectRequest, new Date()),
      ));
      expect(first.revision).toBe(1);
      expect(second.revision).toBe(1);

      const ordinary = level.encounters.filter((encounter) => encounter.role === 'ordinary');
      const sameRevisionActions = ordinary.map((encounter) => ({
        actionId: randomUUID(),
        expectedRevision: first.revision,
        action: { type: 'attack' as const, levelId: level.id, encounterId: encounter.id },
      }));
      const raced = await Promise.allSettled(sameRevisionActions.map((request) =>
        store.applyGameplayAction(owner.id, first.id, request, new Date(Date.now() + 600)),
      ));
      expect(raced.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const rejected = raced.find((result) => result.status === 'rejected');
      expect(rejected).toMatchObject({ reason: { code: 'SAVE_REVISION_STALE' } });
      expect((await store.getSave(owner.id, first.id))!.revision).toBe(2);
      expect((await store.getSave(owner.id, second.id))!.revision).toBe(1);
    } finally {
      await store.close();
    }
  });

  it('Postgres commits a concurrent consume once and resumes the next frozen level', async () => {
    const store = PostgresQuestStore.connect(testDatabaseUrl!);
    try {
      const owner = await store.createFixtureSession(randomUUID(), new Date(Date.now() + 60_000));
      const preview = await store.putPreview(previewInput(owner.id));
      let save = await store.createSave({
        ownerId: owner.id,
        previewId: preview.previewId,
        selectedIds: preview.selectedIds,
      });
      let nowMs = Date.parse('2026-09-11T12:00:00.000Z');
      const level = save.adventurePlan!.levels[0]!;
      const attackTool = level.pickups.find((pickup) => pickup.kind === 'attack-tool')!;
      save = await applyStoreAction(store, owner.id, save, {
        type: 'collect-equipment', levelId: level.id, pickupId: attackTool.pickupId,
      }, nowMs);
      for (const encounter of level.encounters) {
        while (!save.adventureState!.encounters[encounter.id]!.defeated) {
          nowMs += 600;
          save = await applyStoreAction(store, owner.id, save, {
            type: 'attack', levelId: level.id, encounterId: encounter.id,
          }, nowMs);
        }
      }
      expect(save).toMatchObject({ ageYears: 0, adventureState: { phase: 'memory-released' } });
      for (const memoryId of memoryIdsForLevel(level)) {
        save = await applyStoreAction(store, owner.id, save, {
          type: 'recover-memory', levelId: level.id, memoryId,
        }, nowMs);
      }
      expect(save.ageYears).toBe(0);
      const consumeRequest: GameplayActionRequest = {
        actionId: randomUUID(),
        expectedRevision: save.revision,
        action: { type: 'consume-memory-bundle', levelId: level.id },
      };
      const [first, retry] = await Promise.all([
        store.applyGameplayAction(owner.id, save.id, consumeRequest, new Date(nowMs)),
        store.applyGameplayAction(owner.id, save.id, consumeRequest, new Date(nowMs)),
      ]);
      expect(first.revision).toBe(retry.revision);
      expect(first).toMatchObject({
        ageYears: 4,
        abilities: ['move', 'interact', 'jump'],
        appearanceStage: 'child',
        completed: false,
        adventureState: {
          activeLevelIndex: 1,
          phase: 'exploring',
          completedLevelIds: [level.id],
        },
      });
      const resumed = await store.getSave(owner.id, save.id);
      expect(resumed).toMatchObject({
        revision: first.revision,
        ageYears: 4,
        adventureState: { activeLevelIndex: 1, phase: 'exploring' },
      });
      expect(resumed!.adventurePlan!.levels[1]).toMatchObject({ eraYear: 2024, startAgeYears: 4 });
    } finally {
      await store.close();
    }
  });

  it('Postgres bounds durable receipts and never reapplies a pruned retry', async () => {
    const store = PostgresQuestStore.connect(testDatabaseUrl!);
    try {
      const owner = await store.createFixtureSession(randomUUID(), new Date(Date.now() + 60_000));
      const preview = await store.putPreview(previewInput(owner.id));
      let save = await store.createSave({
        ownerId: owner.id,
        previewId: preview.previewId,
        selectedIds: preview.selectedIds,
      });
      const level = save.adventurePlan!.levels[0]!;
      const guardTool = level.pickups.find((pickup) => pickup.kind === 'guard-tool')!;
      let nowMs = Date.parse('2026-09-11T12:00:00.000Z');
      save = await applyStoreAction(store, owner.id, save, {
        type: 'collect-equipment', levelId: level.id, pickupId: guardTool.pickupId,
      }, nowMs);
      const oldRequest: GameplayActionRequest = {
        actionId: randomUUID(),
        expectedRevision: save.revision,
        action: { type: 'guard', levelId: level.id },
      };
      save = await store.applyGameplayAction(owner.id, save.id, oldRequest, new Date(nowMs));
      for (let index = 0; index < 128; index += 1) {
        nowMs += 1_500;
        save = await applyStoreAction(store, owner.id, save, {
          type: 'guard', levelId: level.id,
        }, nowMs);
      }
      expect(save.adventureState!.actionReceipts).toHaveLength(128);
      expect(save.adventureState!.actionReceipts.some(
        (receipt) => receipt.actionId === oldRequest.actionId,
      )).toBe(false);
      await expect(store.applyGameplayAction(owner.id, save.id, oldRequest, new Date(nowMs)))
        .rejects.toMatchObject({ code: 'SAVE_REVISION_STALE' });
      expect((await store.getSave(owner.id, save.id))!.revision).toBe(save.revision);
    } finally {
      await store.close();
    }
  });

  it('Postgres rejects impossible v2 state and malformed legacy JSON at load', async () => {
    const store = PostgresQuestStore.connect(testDatabaseUrl!);
    const auditPool = new Pool({ connectionString: testDatabaseUrl, max: 1 });
    try {
      const owner = await store.createFixtureSession(randomUUID(), new Date(Date.now() + 60_000));
      const preview = await store.putPreview(previewInput(owner.id));
      const save = await store.createSave({
        ownerId: owner.id,
        previewId: preview.previewId,
        selectedIds: preview.selectedIds,
      });
      const futureEquipment = save.adventurePlan!.levels[1]!.pickups[0]!;
      const futureInventory = structuredClone(save.adventureState!);
      futureInventory.inventoryIds.push(futureEquipment.id);
      futureInventory.collectedPickupIds.push(futureEquipment.pickupId);
      futureInventory.equippedId = futureEquipment.id;
      await auditPool.query(
        'UPDATE quest_saves SET adventure_state = $2::jsonb WHERE id = $1',
        [save.id, JSON.stringify(futureInventory)],
      );
      await expect(store.getSave(owner.id, save.id)).rejects.toMatchObject({ code: 'SAVE_DATA_INVALID' });

      const earlyBossDamage = structuredClone(save.adventureState!);
      const firstLevel = save.adventurePlan!.levels[0]!;
      earlyBossDamage.encounters[firstLevel.bossId]!.hp -= 1;
      await auditPool.query(
        'UPDATE quest_saves SET adventure_state = $2::jsonb WHERE id = $1',
        [save.id, JSON.stringify(earlyBossDamage)],
      );
      await expect(store.getSave(owner.id, save.id)).rejects.toMatchObject({ code: 'SAVE_DATA_INVALID' });

      await auditPool.query(
        `UPDATE quest_saves
         SET save_format = 'legacy-v1', adventure_plan = NULL, adventure_state = NULL,
             friendly_state = NULL
         WHERE id = $1`,
        [save.id],
      );
      expect(await store.getSave(owner.id, save.id)).toMatchObject({ saveFormat: 'legacy-v1' });
      await expect(store.applyGameplayAction(owner.id, save.id, {
        actionId: randomUUID(),
        expectedRevision: 0,
        action: { type: 'retry-level', levelId: 'legacy' },
      }, new Date())).rejects.toMatchObject({ code: 'LEGACY_SAVE_READ_ONLY' });

      await auditPool.query(
        `UPDATE quest_saves SET memories = '[{"id": 42}]'::jsonb WHERE id = $1`,
        [save.id],
      );
      await expect(store.getSave(owner.id, save.id)).rejects.toMatchObject({ code: 'SAVE_DATA_INVALID' });
    } finally {
      await auditPool.end();
      await store.close();
    }
  });

  it('Postgres 0003/0004 migrations preserve an existing v1 row with a null friendly sidecar', async () => {
    const pool = new Pool({ connectionString: testDatabaseUrl, max: 1 });
    const client = await pool.connect();
    const schema = `quest_migration_${randomUUID().replaceAll('-', '')}`;
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      const [migrationOne, migrationTwo, migrationThree, migrationFour] = await Promise.all([
        readFile('migrations/0001_quest_server.sql', 'utf8'),
        readFile('migrations/0002_fixture_expiry_indexes.sql', 'utf8'),
        readFile('migrations/0003_era_combat_saves.sql', 'utf8'),
        readFile('migrations/0004_friendly_state.sql', 'utf8'),
      ]);
      await client.query(migrationOne);
      await client.query(migrationTwo);
      const ownerId = randomUUID();
      const previewId = randomUUID();
      const saveId = randomUUID();
      const preview = previewInput(ownerId);
      await client.query('INSERT INTO quest_players (id, label) VALUES ($1, $2)', [ownerId, 'Legacy']);
      await client.query(
        `INSERT INTO quest_setup_previews (
           id, owner_id, birth_date, subjects, chosen_subject, memories, selected_ids, coverage, expires_at
         ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9)`,
        [
          previewId,
          ownerId,
          preview.birthDate,
          JSON.stringify(preview.subjects),
          JSON.stringify(preview.chosenSubject),
          JSON.stringify(preview.memories),
          JSON.stringify(preview.selectedIds),
          JSON.stringify(preview.coverage),
          preview.expiresAt,
        ],
      );
      await client.query(
        `INSERT INTO quest_saves (
           id, owner_id, preview_id, title, subject, birth_date, memories, recovered_ids,
           age_years, abilities, appearance_stage, completed, revision, versions
         ) VALUES (
           $1, $2, $3, 'Legacy journey', $4::jsonb, $5, $6::jsonb, '[]'::jsonb,
           0, '["move", "interact"]'::jsonb, 'infant', false, 0, $7::jsonb
         )`,
        [
          saveId,
          ownerId,
          previewId,
          JSON.stringify(FIXTURE_SUBJECT),
          preview.birthDate,
          JSON.stringify(preview.memories),
          JSON.stringify({
            journey: 'legacy-v1',
            age: 'birth-date-whole-years-v1',
            progression: 'memory-recovery-v1',
            appearance: 'synthetic-traveler-v1',
          }),
        ],
      );
      await client.query(migrationThree);
      await client.query(migrationFour);
      const migrated = await client.query<{
        adventure_plan: unknown;
        adventure_state: unknown;
        friendly_state: unknown;
        save_format: string;
      }>(
        'SELECT save_format, adventure_plan, adventure_state, friendly_state FROM quest_saves WHERE id = $1',
        [saveId],
      );
      expect(migrated.rows[0]).toEqual({
        save_format: 'legacy-v1',
        adventure_plan: null,
        adventure_state: null,
        friendly_state: null,
      });
    } finally {
      await client.query('SET search_path TO public');
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      client.release();
      await pool.end();
    }
  });

  it('Postgres cleanup preserves saves, referenced previews, and active records', async () => {
    const store = PostgresQuestStore.connect(testDatabaseUrl!);
    const now = new Date(Date.now() + 2 * 60 * 60 * 1_000);
    const expiredAt = new Date(now.valueOf() - 1_000);
    const activeUntil = new Date(now.valueOf() + 60 * 60 * 1_000);
    try {
      const savedPlayer = await store.createFixtureSession(
        '44444444-4444-4444-8444-444444444444',
        expiredAt,
      );
      const unusedPlayer = await store.createFixtureSession(
        '55555555-5555-4555-8555-555555555555',
        expiredAt,
      );
      const activePlayer = await store.createFixtureSession(
        '66666666-6666-4666-8666-666666666666',
        activeUntil,
      );
      const referenced = await store.putPreview(previewInput(savedPlayer.id, expiredAt));
      const unused = await store.putPreview(previewInput(unusedPlayer.id, expiredAt));
      const active = await store.putPreview(previewInput(activePlayer.id, activeUntil));
      const save = await store.createSave({
        ownerId: savedPlayer.id,
        previewId: referenced.previewId,
        selectedIds: referenced.selectedIds,
      });

      const result = await store.maintainFixtureRecords(now);
      expect(result).toEqual({ sessionsDeleted: 2, previewsDeleted: 1 });
      expect(await store.getSession('44444444-4444-4444-8444-444444444444', now)).toBeNull();
      expect(await store.getSession('55555555-5555-4555-8555-555555555555', now)).toBeNull();
      expect(await store.getSession('66666666-6666-4666-8666-666666666666', now)).toEqual(activePlayer);
      expect(await store.getSave(savedPlayer.id, save.id)).toMatchObject({ id: save.id });

      const auditPool = new Pool({ connectionString: testDatabaseUrl, max: 1 });
      try {
        const audit = await auditPool.query<{
          active_preview: boolean;
          referenced_preview: boolean;
          save_present: boolean;
          unused_preview: boolean;
        }>(
          `
            SELECT
              EXISTS (SELECT 1 FROM quest_setup_previews WHERE id = $1) AS referenced_preview,
              EXISTS (SELECT 1 FROM quest_setup_previews WHERE id = $2) AS unused_preview,
              EXISTS (SELECT 1 FROM quest_setup_previews WHERE id = $3) AS active_preview,
              EXISTS (SELECT 1 FROM quest_saves WHERE id = $4) AS save_present
          `,
          [referenced.previewId, unused.previewId, active.previewId, save.id],
        );
        expect(audit.rows[0]).toEqual({
          referenced_preview: true,
          unused_preview: false,
          active_preview: true,
          save_present: true,
        });
        const indexes = await auditPool.query<{ indexname: string }>(
          `
            SELECT indexname
            FROM pg_indexes
            WHERE indexname IN (
              'quest_fixture_sessions_expires_idx',
              'quest_setup_previews_expires_idx'
            )
            ORDER BY indexname
          `,
        );
        expect(indexes.rows.map((row) => row.indexname)).toEqual([
          'quest_fixture_sessions_expires_idx',
          'quest_setup_previews_expires_idx',
        ]);
      } finally {
        await auditPool.end();
      }
    } finally {
      await store.close();
    }
  });
});

async function applyStoreAction(
  store: PostgresQuestStore,
  ownerId: string,
  save: SaveRecord,
  action: GameplayAction,
  nowMs: number,
): Promise<SaveRecord> {
  return store.applyGameplayAction(ownerId, save.id, {
    actionId: randomUUID(),
    expectedRevision: save.revision,
    action,
  }, new Date(nowMs));
}

function previewInput(ownerId: string, expiresAt = new Date(Date.now() + 60_000)): NewPreviewRecord {
  const birthDate = '2020-01-01';
  const memories = [
    { id: 'memory-one', date: '2020-07-01', label: 'Memory 1' },
    { id: 'memory-two', date: '2024-01-01', label: 'Memory 2' },
    { id: 'memory-three', date: '2027-01-01', label: 'Memory 3' },
  ].map(({ id, date, label }) => ({
    id,
    date,
    label,
    ageYears: wholeYearsAt(birthDate, date),
    source: { kind: 'fixture' as const, key: id },
  }));
  return {
    ownerId,
    birthDate,
    subjects: [FIXTURE_SUBJECT],
    chosenSubject: FIXTURE_SUBJECT,
    memories,
    selectedIds: memories.map((memory) => memory.id),
    coverage: { fromDate: memories[0]!.date, toDate: memories.at(-1)!.date, incomplete: false, scanned: 3 },
    expiresAt,
  };
}

function previewInputForDates(
  ownerId: string,
  birthDate: string,
  dates: string[],
): NewPreviewRecord {
  const memories = dates.map((date, index) => ({
    id: `memory-${index}`,
    date,
    label: `Memory ${index}`,
    ageYears: wholeYearsAt(birthDate, date),
    source: { kind: 'fixture' as const, key: `memory-${index}` },
  }));
  return {
    ownerId,
    birthDate,
    subjects: [FIXTURE_SUBJECT],
    chosenSubject: FIXTURE_SUBJECT,
    memories,
    selectedIds: memories.map((memory) => memory.id),
    coverage: {
      fromDate: dates[0] ?? null,
      toDate: dates.at(-1) ?? null,
      incomplete: false,
      scanned: memories.length,
    },
    expiresAt: new Date(Date.now() + 60_000),
  };
}
