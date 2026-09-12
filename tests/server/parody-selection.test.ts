import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createAdventurePlan,
  createInitialAdventureState,
  toAdventureView,
  type AdventurePlanV1,
  type AdventurePlanV2,
} from '../../src/shared/adventure.js';
import {
  PARODY_CANDIDATES,
  PARODY_CATALOGS,
  PARODY_CATALOG_VERSION,
  PARODY_PERIODS,
  type ParodyCatalogEntry,
} from '../../src/shared/parody-catalog.js';
import {
  ParodyCatalogUnavailableError,
  selectParodyLevel,
  selectRouteMemoryLevel,
} from '../../src/shared/parody-selection.js';
import { parseStoredAdventure } from '../../src/server/adventure-schema.js';
import { createApp } from '../../src/server/app.js';
import { InMemoryQuestStore } from '../../src/server/db/memory-store.js';
import {
  FIXTURE_SUBJECT,
  toSaveView,
  validateSaveRecord,
  wholeYearsAt,
  type NewPreviewRecord,
  type SaveRecord,
} from '../../src/server/domain.js';
import { signToken } from '../../src/server/security.js';

const EXPECTED_2020 = ['mister-hiss', 'peel-patrol', 'drama-dragon'];
const EXPECTED_2024_V2 = [
  'sir-flush-a-lot-encore',
  'peel-patrol-encore',
  'drama-dragon-encore',
];
const EXPECTED_2024 = [
  'sir-flush-a-lot-besties',
  'peel-patrol-besties',
  'bickering-besties',
];
const EXPECTED_2024_ASSETS = ['sir-flush-a-lot', 'peel-patrol', 'bickering-besties'];

describe('frozen dated parody selection', () => {
  it('uses inclusive curated boundaries and rejects uncovered past and future dates', () => {
    for (const date of ['2020-01-01', '2023-12-31']) {
      expect(ids(selectParodyLevel(date, ['move', 'interact']))).toEqual(EXPECTED_2020);
    }
    for (const date of ['2024-01-01', '2026-12-31']) {
      expect(ids(selectParodyLevel(date, ['move', 'interact', 'jump']))).toEqual(EXPECTED_2024);
      expect(ids(selectParodyLevel(date, ['move', 'interact']))).toEqual(EXPECTED_2024_V2);
      expect(ids(selectParodyLevel(
        date,
        ['move', 'interact', 'jump'],
        'parody-catalog-v2',
      ))).toEqual(EXPECTED_2024_V2);
      expect(ids(selectParodyLevel(
        date,
        ['move', 'interact', 'jump'],
        'parody-catalog-v1',
      ))).toEqual(['sir-flush-a-lot', 'nap-captain', 'one-star-diva']);
    }
    for (const date of ['2019-12-31', '2027-01-01']) {
      expect(() => selectParodyLevel(date, ['move', 'interact', 'jump']))
        .toThrow(ParodyCatalogUnavailableError);
    }
  });

  it('applies reference availability within an eligibility window without a future fallback', () => {
    const catalog = PARODY_CANDIDATES.map((entry): ParodyCatalogEntry =>
      entry.id === 'drama-dragon'
        ? { ...entry, referenceAvailableBy: '2020-07-01' }
        : entry,
    );
    expect(() => selectParodyLevel(
      '2020-06-30', ['move', 'interact'], PARODY_CATALOG_VERSION, catalog,
    ))
      .toThrow(ParodyCatalogUnavailableError);
    expect(ids(selectParodyLevel(
      '2020-07-01', ['move', 'interact'], PARODY_CATALOG_VERSION, catalog,
    )))
      .toEqual(EXPECTED_2020);
  });

  it('selects by represented date and requires jump for the Besties period', () => {
    const early = selectParodyLevel('2023-06-01', ['move', 'interact']);
    const laterWithoutJump = selectParodyLevel('2024-06-01', ['move', 'interact']);
    const later = selectParodyLevel('2024-06-01', ['move', 'interact', 'jump']);
    expect({ periodId: early.periodId, ids: ids(early), routeId: early.routeId }).toEqual({
      periodId: 'block-party-v1',
      ids: EXPECTED_2020,
      routeId: 'gentle-intro-v1',
    });
    expect({ periodId: later.periodId, ids: ids(later), routeId: later.routeId }).toEqual({
      periodId: 'besties-obby-v1',
      ids: EXPECTED_2024,
      routeId: 'gentle-jump-v1',
    });
    expect({
      periodId: laterWithoutJump.periodId,
      ids: ids(laterWithoutJump),
      routeId: laterWithoutJump.routeId,
    }).toEqual({
      periodId: 'remix-runway-v2',
      ids: EXPECTED_2024_V2,
      routeId: 'gentle-intro-v1',
    });
  });

  it('requires complete kind, role and starting-ability coverage', () => {
    const missingBoss = PARODY_CANDIDATES.filter((entry) => entry.id !== 'drama-dragon');
    expect(() => selectParodyLevel(
      '2020-01-01', ['move', 'interact'], PARODY_CATALOG_VERSION, missingBoss,
    ))
      .toThrow(ParodyCatalogUnavailableError);

    const jumpBoss = PARODY_CANDIDATES.map((entry): ParodyCatalogEntry =>
      entry.id === 'drama-dragon' ? { ...entry, requiredAbilities: ['move', 'jump'] } : entry,
    );
    expect(() => selectParodyLevel(
      '2020-01-01', ['move', 'interact'], PARODY_CATALOG_VERSION, jumpBoss,
    ))
      .toThrow(ParodyCatalogUnavailableError);
    expect(ids(selectParodyLevel(
      '2020-01-01', ['move', 'interact', 'jump'], PARODY_CATALOG_VERSION, jumpBoss,
    )))
      .toEqual(EXPECTED_2020);
  });

  it('gates the five-slot playground roster to fresh v4 route-memory selection', () => {
    const garden = selectRouteMemoryLevel('2020-01-01', ['move', 'interact', 'jump']);
    const besties = selectRouteMemoryLevel('2024-01-01', ['move', 'interact', 'jump']);
    expect({
      periodId: garden.periodId,
      routeId: garden.routeId,
      ids: garden.encounters.map((entry) => entry.content.catalogEntryId),
    }).toEqual({
      periodId: 'block-party-v1',
      routeId: 'garden-playground-v1',
      ids: ['mister-hiss', 'peel-patrol', 'mister-hiss', 'peel-patrol', 'drama-dragon'],
    });
    expect({
      periodId: besties.periodId,
      routeId: besties.routeId,
      ids: besties.encounters.map((entry) => entry.content.catalogEntryId),
    }).toEqual({
      periodId: 'besties-obby-v1',
      routeId: 'besties-playground-v1',
      ids: [
        'sir-flush-a-lot-besties',
        'peel-patrol-besties',
        'sir-flush-a-lot-besties',
        'peel-patrol-besties',
        'bickering-besties',
      ],
    });
    expect(selectParodyLevel('2020-01-01', ['move', 'interact'], 'parody-catalog-v4')
      .encounters).toHaveLength(3);
    expect(() => selectRouteMemoryLevel(
      '2020-01-01', ['move', 'interact', 'jump'], 'parody-catalog-v3',
    )).toThrow(ParodyCatalogUnavailableError);
    expect(() => selectRouteMemoryLevel(
      '2020-01-01',
      ['move', 'interact', 'jump'],
      'parody-catalog-v4',
      PARODY_CATALOGS['parody-catalog-v4'].filter((entry) => entry.id !== 'drama-dragon'),
    )).toThrow(ParodyCatalogUnavailableError);
  });

  it('is stable under catalog reorder and freezes the two fixture level identities', () => {
    const forward = selectParodyLevel('2024-01-01', ['move', 'interact', 'jump']);
    const reversed = selectParodyLevel(
      '2024-01-01',
      ['move', 'interact', 'jump'],
      PARODY_CATALOG_VERSION,
      [...PARODY_CANDIDATES].reverse(),
    );
    expect(reversed).toEqual(forward);

    const plan = fixturePlan();
    expect(plan).toMatchObject({
      version: 'era-level-plan-v2',
      catalogVersion: PARODY_CATALOG_VERSION,
      levels: [
        {
          startDate: '2020-01-01',
          eraYear: 2020,
          startAgeYears: 0,
          targetAgeYears: 4,
          periodId: 'block-party-v1',
          routeId: 'gentle-intro-v1',
        },
        {
          startDate: '2024-01-01',
          eraYear: 2024,
          startAgeYears: 4,
          targetAgeYears: 7,
          periodId: 'besties-obby-v1',
          routeId: 'gentle-jump-v1',
        },
      ],
    });
    expect(plan.levels.map((level) => level.encounters.map((encounter) => ({
      entry: `${encounter.content.catalogEntryId}@${encounter.content.catalogEntryVersion}`,
      asset: `${encounter.content.assetId}@${encounter.content.assetVersion}`,
    })))).toEqual([
      EXPECTED_2020.map((id) => ({ entry: `${id}@v001`, asset: `${id}@v001` })),
      EXPECTED_2024.map((id, index) => ({
        entry: `${id}@v001`,
        asset: `${EXPECTED_2024_ASSETS[index]}@v001`,
      })),
    ]);
  });

  it('archives v3 unchanged and freezes v4 with the same reviewed identities', () => {
    expect(PARODY_CATALOG_VERSION).toBe('parody-catalog-v4');
    expect(Object.isFrozen(PARODY_CANDIDATES)).toBe(true);
    expect(PARODY_CANDIDATES.every(Object.isFrozen)).toBe(true);
    expect(PARODY_CANDIDATES.every((entry) => Object.isFrozen(entry.requiredAbilities)))
      .toBe(true);
    expect(PARODY_CANDIDATES).toEqual(PARODY_CATALOGS['parody-catalog-v3']);
    expect(PARODY_CANDIDATES).not.toBe(PARODY_CATALOGS['parody-catalog-v3']);
    expect(PARODY_PERIODS['besties-obby-v1']).toEqual({
      title: 'Besties Obby',
      subtitle: 'Pink, black and one missed high-five',
      description:
        'Two rivals take turns building obstacle tricks. Their missed high-five leaves them dizzy.',
    });

    const besties = PARODY_CANDIDATES.filter(
      (entry) => entry.periodId === 'besties-obby-v1',
    );
    expect(besties.map((entry) => entry.id)).toEqual(EXPECTED_2024);
    expect(besties.find((entry) => entry.role === 'boss')).toMatchObject({
      id: 'bickering-besties',
      title: 'The Bickering Besties',
      kind: 'boss',
      requiredAbilities: ['move', 'jump'],
      assetId: 'bickering-besties',
      assetVersion: 'v001',
    });

    const secondLevel = fixturePlan().levels[1]!;
    expect(secondLevel.bossId).toBe('level-2-2024-boss');
    expect(secondLevel.encounters.filter((entry) => entry.role === 'boss')).toEqual([
      expect.objectContaining({
        id: secondLevel.bossId,
        maxHp: 11,
        content: expect.objectContaining({
          catalogEntryId: 'bickering-besties',
          assetId: 'bickering-besties',
          assetVersion: 'v001',
        }),
      }),
    ]);
  });

  it('validates a stored v1 catalog plan against its archived identities and gates', () => {
    const plan = archivedCatalogV1Plan();
    const state = createInitialAdventureState(plan);
    expect(parseStoredAdventure(plan, state).plan).toEqual(plan);
    expect(plan.levels[1]!.encounters.map((encounter) => encounter.content.catalogEntryId))
      .toEqual(['sir-flush-a-lot', 'nap-captain', 'one-star-diva']);

    const record = storedCatalogV1Save(plan);
    expect(validateSaveRecord(record).adventurePlan).toEqual(plan);

    const changedIdentity = structuredClone(plan);
    changedIdentity.levels[1]!.encounters[1]!.content.assetId = 'peel-patrol';
    expectInvalid(changedIdentity, state);

    const changedDate = structuredClone(plan);
    changedDate.levels[1]!.startDate = '2027-01-01';
    changedDate.levels[1]!.eraYear = 2027;
    expectInvalid(changedDate, state);

    expectInvalid({ ...structuredClone(plan), catalogVersion: 'parody-catalog-v0' }, state);
  });

  it('keeps the archived v2 catalog and its saved plans unchanged', () => {
    expect(PARODY_CATALOGS['parody-catalog-v2'].map((entry) => ({
      id: entry.id,
      periodId: entry.periodId,
      assetId: entry.assetId,
      assetVersion: entry.assetVersion,
    }))).toEqual([
      { id: 'mister-hiss', periodId: 'block-party-v1', assetId: 'mister-hiss', assetVersion: 'v001' },
      { id: 'peel-patrol', periodId: 'block-party-v1', assetId: 'peel-patrol', assetVersion: 'v001' },
      { id: 'drama-dragon', periodId: 'block-party-v1', assetId: 'drama-dragon', assetVersion: 'v001' },
      { id: 'sir-flush-a-lot-encore', periodId: 'remix-runway-v2', assetId: 'sir-flush-a-lot', assetVersion: 'v001' },
      { id: 'peel-patrol-encore', periodId: 'remix-runway-v2', assetId: 'peel-patrol', assetVersion: 'v001' },
      { id: 'drama-dragon-encore', periodId: 'remix-runway-v2', assetId: 'drama-dragon', assetVersion: 'v001' },
    ]);

    const plan = archivedCatalogV2Plan();
    const state = createInitialAdventureState(plan);
    expect(parseStoredAdventure(plan, state).plan).toEqual(plan);
    expect(plan.levels[1]!.encounters.map((encounter) => encounter.content.catalogEntryId))
      .toEqual(EXPECTED_2024_V2);
    const record = storedCatalogV1Save(plan);
    record.title = 'Stored parody catalog v2 plan';
    record.versions.catalog = 'parody-catalog-v2';
    expect(validateSaveRecord(record).adventurePlan).toEqual(plan);
  });

  it('keeps v1 strict, actionable and generic while requiring every v2 identity', async () => {
    const v2 = fixturePlan();
    const v1 = legacyPlan(v2);
    const v1State = createInitialAdventureState(v1);
    expect(parseStoredAdventure(v1, v1State).plan).toEqual(v1);
    const oldRecord = storedV1Save(v1);
    const oldView = toSaveView(validateSaveRecord(oldRecord), new Date(0));
    expect(oldView.versions).toEqual(oldRecord.versions);
    expect(oldView.adventure).toMatchObject({
      planVersion: 'era-level-plan-v1',
      activeLevel: { eraYear: 2020 },
    });
    expect(oldView.adventure).not.toHaveProperty('catalogVersion');
    expect(oldView.adventure!.activeLevel).not.toHaveProperty('periodId');
    expect(oldView.adventure!.activeLevel!.encounters[0]).not.toHaveProperty('content');
    const store = new InMemoryQuestStore([oldRecord]);
    const acted = await store.applyGameplayAction(oldRecord.ownerId, oldRecord.id, {
      actionId: randomUUID(),
      expectedRevision: 0,
      action: {
        type: 'collect-equipment',
        levelId: v1.levels[0]!.id,
        pickupId: v1.levels[0]!.pickups[0]!.pickupId,
      },
    }, new Date());
    expect(acted).toMatchObject({
      revision: 1,
      versions: oldRecord.versions,
      adventurePlan: { version: 'era-level-plan-v1' },
    });

    expect(parseStoredAdventure(v2, createInitialAdventureState(v2)).plan).toEqual(v2);
    const v2View = toAdventureView(v2, createInitialAdventureState(v2), 0);
    expect(v2View).toMatchObject({
      planVersion: 'era-level-plan-v2',
      catalogVersion: PARODY_CATALOG_VERSION,
      activeLevel: {
        periodId: 'block-party-v1',
        routeId: 'gentle-intro-v1',
      },
    });
    expect(v2View.activeLevel!.encounters[0]).toMatchObject({
      content: {
        catalogEntryId: 'mister-hiss',
        catalogEntryVersion: 'v001',
        assetId: 'mister-hiss',
        assetVersion: 'v001',
      },
    });

    expectInvalid({ ...structuredClone(v1), catalogVersion: PARODY_CATALOG_VERSION }, v1State);
    const v1WithV2LevelField = structuredClone(v1) as unknown as Record<string, unknown>;
    (v1WithV2LevelField.levels as Array<Record<string, unknown>>)[0]!.periodId = 'block-party-v1';
    expectInvalid(v1WithV2LevelField, v1State);

    const v2MissingIdentity = structuredClone(v2) as unknown as Record<string, unknown>;
    delete ((((v2MissingIdentity.levels as Array<Record<string, unknown>>)[0]!.encounters as
      Array<Record<string, unknown>>)[0]!.content as Record<string, unknown>).assetVersion);
    expectInvalid(v2MissingIdentity, createInitialAdventureState(v2));
  });

  it('rejects changed stored identities without rerolling a valid frozen plan', () => {
    const plan = fixturePlan();
    const changed = structuredClone(plan);
    changed.levels[0]!.encounters[0]!.content.assetId = 'replacement-not-selected';
    expectInvalid(changed, createInitialAdventureState(plan));

    const resumed = parseStoredAdventure(plan, createInitialAdventureState(plan));
    expect(resumed.plan.levels[0]!.encounters.map((encounter) =>
      'content' in encounter ? encounter.content.catalogEntryId : null,
    )).toEqual(EXPECTED_2020);
  });

  it('maps missing creation coverage to a bounded API error without a partial save', async () => {
    const store = new InMemoryQuestStore();
    const sessionId = '20000000-0000-4000-8000-000000000002';
    const sessionSecret = 'fixture-session-secret-that-is-at-least-32-characters';
    const origin = 'https://quest.test';
    const player = await store.createFixtureSession(sessionId, new Date(Date.now() + 60_000));
    const input = previewInput(player.id, '2019-01-01', ['2019-06-01']);
    const preview = await store.putPreview(input);
    const app = createApp({
      store,
      fixtureMode: true,
      sessionSecret,
      appOrigin: origin,
      clientDir: '/tmp/quest-client-not-present',
      studioDir: '/tmp/quest-studio-not-present',
    });
    const response = await app.request('/api/saves', {
      method: 'POST',
      body: JSON.stringify({ previewId: preview.previewId, selectedIds: preview.selectedIds }),
      headers: {
        cookie: `quest_fixture_session=${signToken(sessionId, sessionSecret)}`,
        origin,
        'content-type': 'application/json',
        'x-quest-request': '1',
      },
    });
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: { code: 'ERA_CATALOG_UNAVAILABLE', message: 'Adventure catalog unavailable' },
    });
    expect(await store.listSaves(input.ownerId)).toEqual([]);
  });
});

function ids(selection: ReturnType<typeof selectParodyLevel>): string[] {
  return selection.encounters.map((entry) => entry.content.catalogEntryId);
}

function fixturePlan() {
  return createAdventurePlan('2020-01-01', [
    { id: 'zero', date: '2020-07-01', ageYears: 0 },
    { id: 'four', date: '2024-01-01', ageYears: 4 },
    { id: 'seven', date: '2027-01-01', ageYears: 7 },
  ]);
}

function archivedCatalogV1Plan(): AdventurePlanV2 {
  const plan = fixturePlan();
  const archivedEntries = PARODY_CATALOGS['parody-catalog-v1'];
  return {
    ...plan,
    catalogVersion: 'parody-catalog-v1',
    levels: plan.levels.map((level, index) => ({
      ...level,
      periodId: index === 0 ? 'block-party-v1' : 'remix-runway-v1',
      encounters: level.encounters.map((encounter) => {
        const entry = archivedEntries.find((candidate) =>
          candidate.periodId === (index === 0 ? 'block-party-v1' : 'remix-runway-v1') &&
          candidate.kind === encounter.kind &&
          candidate.role === encounter.role,
        );
        if (!entry) throw new Error('Archived fixture entry missing');
        return {
          ...encounter,
          content: {
            catalogEntryId: entry.id,
            catalogEntryVersion: entry.version,
            assetId: entry.assetId,
            assetVersion: entry.assetVersion,
          },
        };
      }),
    })),
  };
}

function archivedCatalogV2Plan(): AdventurePlanV2 {
  const plan = fixturePlan();
  const archivedEntries = PARODY_CATALOGS['parody-catalog-v2'];
  return {
    ...plan,
    catalogVersion: 'parody-catalog-v2',
    levels: plan.levels.map((level, index) => ({
      ...level,
      periodId: index === 0 ? 'block-party-v1' : 'remix-runway-v2',
      encounters: level.encounters.map((encounter) => {
        const entry = archivedEntries.find((candidate) =>
          candidate.periodId === (index === 0 ? 'block-party-v1' : 'remix-runway-v2') &&
          candidate.kind === encounter.kind &&
          candidate.role === encounter.role,
        );
        if (!entry) throw new Error('Archived fixture entry missing');
        return {
          ...encounter,
          content: {
            catalogEntryId: entry.id,
            catalogEntryVersion: entry.version,
            assetId: entry.assetId,
            assetVersion: entry.assetVersion,
          },
        };
      }),
    })),
  };
}

function legacyPlan(v2: ReturnType<typeof fixturePlan>): AdventurePlanV1 {
  return {
    version: 'era-level-plan-v1',
    levels: v2.levels.map(({ periodId: _periodId, routeId: _routeId, encounters, ...level }) => ({
      ...level,
      encounters: encounters.map(({ content: _content, ...encounter }) => encounter),
    })),
  };
}

function storedV1Save(plan: AdventurePlanV1): SaveRecord {
  const now = new Date('2026-09-11T00:00:00.000Z');
  return {
    id: '30000000-0000-4000-8000-000000000003',
    ownerId: '10000000-0000-4000-8000-000000000001',
    previewId: '40000000-0000-4000-8000-000000000004',
    title: 'Stored generic era plan',
    subject: FIXTURE_SUBJECT,
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
    revision: 0,
    createdAt: now,
    updatedAt: now,
    versions: {
      journey: 'era-level-plan-v1',
      age: 'birth-date-whole-years-v1',
      progression: 'boss-memory-consume-v2',
      appearance: 'synthetic-traveler-v1',
      catalog: 'generic-era-catalog-v1',
      combat: 'discrete-combat-v1',
    },
  };
}

function storedCatalogV1Save(plan: AdventurePlanV2): SaveRecord {
  const record = storedV1Save(legacyPlan(fixturePlan()));
  return {
    ...record,
    title: 'Stored parody catalog v1 plan',
    adventurePlan: plan,
    adventureState: createInitialAdventureState(plan),
    versions: {
      ...record.versions,
      journey: 'era-level-plan-v2',
      catalog: 'parody-catalog-v1',
    },
  };
}

function expectInvalid(plan: unknown, state: unknown): void {
  expect(() => parseStoredAdventure(plan, state)).toThrow(expect.objectContaining({
    code: 'SAVE_DATA_INVALID',
  }));
}

function previewInput(ownerId: string, birthDate: string, dates: string[]): NewPreviewRecord {
  const memories = dates.map((date, index) => ({
    id: `memory-${index}`,
    date,
    ageYears: wholeYearsAt(birthDate, date),
    label: `Memory ${index}`,
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
