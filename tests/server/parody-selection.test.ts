import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createAdventurePlan,
  createInitialAdventureState,
  toAdventureView,
  type AdventurePlanV1,
} from '../../src/shared/adventure.js';
import {
  PARODY_CANDIDATES,
  PARODY_CATALOG_VERSION,
  type ParodyCatalogEntry,
} from '../../src/shared/parody-catalog.js';
import {
  ParodyCatalogUnavailableError,
  selectParodyLevel,
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
const EXPECTED_2024 = ['sir-flush-a-lot', 'nap-captain', 'one-star-diva'];

describe('frozen dated parody selection', () => {
  it('uses inclusive curated boundaries and rejects uncovered past and future dates', () => {
    for (const date of ['2020-01-01', '2023-12-31']) {
      expect(ids(selectParodyLevel(date, ['move', 'interact']))).toEqual(EXPECTED_2020);
    }
    for (const date of ['2024-01-01', '2026-12-31']) {
      expect(ids(selectParodyLevel(date, ['move', 'interact', 'jump']))).toEqual(EXPECTED_2024);
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
    expect(() => selectParodyLevel('2020-06-30', ['move', 'interact'], catalog))
      .toThrow(ParodyCatalogUnavailableError);
    expect(ids(selectParodyLevel('2020-07-01', ['move', 'interact'], catalog)))
      .toEqual(EXPECTED_2020);
  });

  it('selects by represented date at the same age and freezes the matching route', () => {
    const early = selectParodyLevel('2023-06-01', ['move', 'interact']);
    const later = selectParodyLevel('2024-06-01', ['move', 'interact']);
    expect({ periodId: early.periodId, ids: ids(early), routeId: early.routeId }).toEqual({
      periodId: 'block-party-v1',
      ids: EXPECTED_2020,
      routeId: 'gentle-intro-v1',
    });
    expect({ periodId: later.periodId, ids: ids(later), routeId: later.routeId }).toEqual({
      periodId: 'remix-runway-v1',
      ids: EXPECTED_2024,
      routeId: 'gentle-intro-v1',
    });
    expect(selectParodyLevel('2024-06-01', ['move', 'interact', 'jump']).routeId)
      .toBe('gentle-jump-v1');
  });

  it('requires complete kind, role and starting-ability coverage', () => {
    const missingBoss = PARODY_CANDIDATES.filter((entry) => entry.id !== 'drama-dragon');
    expect(() => selectParodyLevel('2020-01-01', ['move', 'interact'], missingBoss))
      .toThrow(ParodyCatalogUnavailableError);

    const jumpBoss = PARODY_CANDIDATES.map((entry): ParodyCatalogEntry =>
      entry.id === 'drama-dragon' ? { ...entry, requiredAbilities: ['move', 'jump'] } : entry,
    );
    expect(() => selectParodyLevel('2020-01-01', ['move', 'interact'], jumpBoss))
      .toThrow(ParodyCatalogUnavailableError);
    expect(ids(selectParodyLevel('2020-01-01', ['move', 'interact', 'jump'], jumpBoss)))
      .toEqual(EXPECTED_2020);
  });

  it('is stable under catalog reorder and freezes the two fixture level identities', () => {
    const forward = selectParodyLevel('2024-01-01', ['move', 'interact', 'jump']);
    const reversed = selectParodyLevel(
      '2024-01-01',
      ['move', 'interact', 'jump'],
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
          periodId: 'remix-runway-v1',
          routeId: 'gentle-jump-v1',
        },
      ],
    });
    expect(plan.levels.map((level) => level.encounters.map((encounter) => ({
      entry: `${encounter.content.catalogEntryId}@${encounter.content.catalogEntryVersion}`,
      asset: `${encounter.content.assetId}@${encounter.content.assetVersion}`,
    })))).toEqual([
      EXPECTED_2020.map((id) => ({ entry: `${id}@v001`, asset: `${id}@v001` })),
      EXPECTED_2024.map((id) => ({ entry: `${id}@v001`, asset: `${id}@v001` })),
    ]);
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
