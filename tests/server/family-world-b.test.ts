/**
 * World B (`family-world-b@v1`, "Playroom to Big Stage") as a family
 * template: offered to a synthetic younger child, rebased onto that child's
 * birthday, frozen into a family-world-plan-v1 and played from its first
 * chapter start through the in-memory stores. Every child, birthday and photo
 * here is synthetic.
 */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createInitialAdventureState } from '../../src/shared/adventure.js';
import type { GameplayAction, SaveView } from '../../src/shared/contracts.js';
import type { AdminDraftResponse, FamilyPlayResponse, PersonChoice } from '../../src/shared/family-api.js';
import { FAMILY_ABILITY_LADDER, FAMILY_MEMORY_SLOTS } from '../../src/shared/family-plan.js';
import { parseStoredAdventure } from '../../src/server/adventure-schema.js';
import { InMemoryQuestStore } from '../../src/server/db/memory-store.js';
import { toSaveView } from '../../src/server/domain.js';
import { buildFamilyWorldPlan, validateFamilyWorldPlan } from '../../src/server/family/plan.js';
import { familyWorldIssues, rebaseWorldForChild } from '../../src/server/family/rebase.js';
import { familyWorldView, newFamilySave } from '../../src/server/family/saves.js';
import type { ChildRecord, PublicationRecord } from '../../src/server/family/store.js';
import { FamilyTemplateRegistry } from '../../src/server/family/templates.js';
import { familyHarness, type FamilyHarness } from './family/harness.js';
import { TEST_CHILD_B } from './family/fake-immich.js';

const TODAY = '2026-09-25';
/** A synthetic younger child: six on TODAY, so World B's final chapter fits. */
const SYNTHETIC_CHILD = {
  personId: '00000000-0000-4000-8000-0000000000b2',
  birthDate: '2020-07-15',
} as const;

const registry = new FamilyTemplateRegistry();
const offeredIds = (birthDate: string) =>
  registry.offeredFor(birthDate, TODAY).map((template) => `${template.id}@${template.version}`);

/** Minor-memory dates inside each rebased chapter of the synthetic child. */
const MINORS: Record<string, readonly [string, string]> = {
  'family-b1': ['2021-01-10', '2021-09-10'],
  'family-b2': ['2023-01-10', '2023-09-10'],
  'family-b3': ['2025-01-10', '2025-09-10'],
};

function publishSynthetic() {
  const template = registry.require('family-world-b', 'v1');
  const world = rebaseWorldForChild(template.project, SYNTHETIC_CHILD.birthDate, TODAY);
  let index = 0;
  const selections = world.chapters.flatMap((chapter) =>
    FAMILY_MEMORY_SLOTS.map((slot) => {
      index += 1;
      const localDate =
        slot === 'major' ? chapter.targetDate : MINORS[chapter.chapterId]![slot === 'minor-one' ? 0 : 1];
      return {
        chapterId: chapter.chapterId,
        slot,
        assetId: `20000000-0000-4000-9000-${String(index).padStart(12, '0')}`,
        personId: SYNTHETIC_CHILD.personId,
        localDate,
        caption: slot === 'major' ? `Turning ${chapter.recoveredAge}!` : `Synthetic memory ${index}`,
        opaque: `asset-${String(index).padStart(32, '0')}`,
      };
    }),
  );
  return { template, world, ...buildFamilyWorldPlan({ template, world, selections, ladder: FAMILY_ABILITY_LADDER }) };
}

describe('World B as a family template', () => {
  it('is offered only to a child whose age and chapter windows fit', () => {
    expect(offeredIds(SYNTHETIC_CHILD.birthDate)).toContain('family-world-b@v1');
    // Five years old: the 4 -> 6 chapter's big memory is still a year away.
    expect(offeredIds('2020-10-01')).not.toContain('family-world-b@v1');
    // Chapter three would start in 2023, before the Demon Idol and Besties windows open.
    expect(offeredIds('2019-12-31')).not.toContain('family-world-b@v1');
  });

  it('rebases onto the synthetic birthday and validates with the real dates', () => {
    const { world } = publishSynthetic();
    expect(familyWorldIssues(world.project)).toEqual([]);
    expect(world.currentAge).toBe(6);
    expect(
      world.chapters.map((chapter) => [chapter.chapterId, chapter.startAge, chapter.recoveredAge, chapter.startDate, chapter.targetDate]),
    ).toEqual([
      ['family-b1', 0, 2, '2020-07-15', '2022-07-15'],
      ['family-b2', 2, 4, '2022-07-15', '2024-07-15'],
      ['family-b3', 4, 6, '2024-07-15', '2026-07-15'],
    ]);
  });

  it('freezes a valid family-world-plan-v1 with the World B casts', () => {
    const { plan, memories } = publishSynthetic();
    expect(plan).toMatchObject({ version: 'family-world-plan-v1', catalogVersion: 'parody-catalog-v8' });
    expect(validateFamilyWorldPlan(plan, { birthDate: SYNTHETIC_CHILD.birthDate, memories })).toEqual([]);
    expect(() => parseStoredAdventure(plan, createInitialAdventureState(plan))).not.toThrow();
    expect(
      plan.levels.map((level) => [level.authoredLevel.id, level.authoredLevel.theme, level.periodId]),
    ).toEqual([
      ['family-b1-playroom', 'playroom', 'sing-along-playroom-v1'],
      ['family-b2-casita', 'casita', 'magic-house-v1'],
      ['family-b3-stage', 'party', 'besties-obby-v1'],
    ]);
    for (const level of plan.levels) {
      expect(level.encounters.slice(0, 4).map((encounter) => encounter.kind)).toEqual(Array(4).fill('ordinary-a'));
    }
    const bosses = plan.levels.map((level) => level.encounters.at(-1)!.content);
    expect(bosses[0]).toMatchObject({ catalogEntryId: 'honk-bus', assetId: 'honk-bus', assetVersion: 'v001' });
    expect(bosses[1]).toMatchObject({ placeholder: 'neutral-candidate-v1' });
    expect(bosses[2]).toMatchObject({ catalogEntryId: 'bickering-besties', assetId: 'bickering-besties' });
    // Every ordinary is a placeholder candidate until its model lands.
    expect(
      plan.levels.flatMap((level) => level.encounters.slice(0, 4).map((encounter) => encounter.content.placeholder)),
    ).toEqual(Array(12).fill('neutral-candidate-v1'));
  });

  it('starts a household save at the first chapter start in the memory store', async () => {
    const { plan, memories, versions } = publishSynthetic();
    const publication = {
      id: '30000000-0000-4000-8000-0000000000b1',
      childId: '30000000-0000-4000-8000-0000000000b2',
      birthDate: SYNTHETIC_CHILD.birthDate,
      plan,
      memories,
      versions,
    } as unknown as PublicationRecord;
    const child = { id: publication.childId, displayName: 'Synthetic Child' } as unknown as ChildRecord;
    const store = new InMemoryQuestStore();
    const now = new Date(1_000);
    const { save, created } = await store.startFamilySave({
      childId: child.id,
      fresh: false,
      save: newFamilySave({ publication, child, startedBy: '40000000-0000-4000-8000-00000000000a', now }),
    });
    expect(created).toBe(true);
    const view = toSaveView(save, now);
    expect(view).toMatchObject({
      ageYears: 0,
      abilities: ['move', 'interact', 'jump'],
      adventure: { planVersion: 'family-world-plan-v1', activeLevelIndex: 0 },
    });
    expect(view.adventure!.activeLevel!.id).toBe(plan.levels[0]!.id);
    const world = familyWorldView(save);
    expect(world.chapters.map((chapter) => chapter.name)).toEqual([
      'The Sing-Along Playroom',
      'The Magic House',
      "Besties' Big Stage",
    ]);
    expect(world.chapters[0]!.level.id).toBe('family-b1-playroom');
    expect(JSON.stringify(world)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

async function json<T>(response: Response | Promise<Response>, status: number): Promise<T> {
  const resolved = await response;
  const text = await resolved.text();
  if (resolved.status !== status) throw new Error(`Expected ${status}, got ${resolved.status}: ${text}`);
  return JSON.parse(text) as T;
}

/** An administrator sets Test Child B up on World B, auto-picks and publishes. */
async function publishWorldB(harness: FamilyHarness): Promise<string> {
  const { people } = await json<{ people: PersonChoice[] }>(
    harness.request(`/api/admin/immich/people?name=${encodeURIComponent(TEST_CHILD_B.name)}`), 200);
  const child = await json<{ id: string }>(harness.request('/api/admin/children', {
    body: {
      immichName: TEST_CHILD_B.name,
      personChoiceId: people[0]!.id,
      displayName: 'Test Child B',
      birthDate: people[0]!.birthDate,
      templateId: 'family-world-b',
      templateVersion: 'v1',
    },
  }), 201);
  await json(harness.request(`/api/admin/children/${child.id}/draft`, {
    method: 'PUT',
    body: { op: 'auto-pick', expectedRevision: null },
  }), 202);
  await harness.jobs.settled(child.id);
  const { draft } = await json<AdminDraftResponse>(harness.request(`/api/admin/children/${child.id}/draft`), 200);
  expect(draft).toMatchObject({ publishable: true, templateId: 'family-world-b' });
  expect(draft!.chapters.map((chapter) => [chapter.name, chapter.startAge, chapter.recoveredAge])).toEqual([
    ['The Sing-Along Playroom', 0, 2],
    ['The Magic House', 2, 4],
    ["Besties' Big Stage", 4, 6],
  ]);
  await json(harness.request(`/api/admin/children/${child.id}/publish`, {
    body: { expectedRevision: draft!.revision, requestId: randomUUID() },
  }), 201);
  return child.id;
}

describe('World B through the family routes', () => {
  it('publishes for Test Child B and plays the first chapter into the second', async () => {
    const harness = familyHarness();
    const childId = await publishWorldB(harness);
    const started = await json<FamilyPlayResponse>(
      harness.request(`/api/children/${childId}/play`, { as: 'member', body: {} }), 201);
    expect(started.save).toMatchObject({
      ageYears: 0,
      abilities: ['move', 'interact', 'jump'],
      adventure: { planVersion: 'family-world-plan-v1', activeLevelIndex: 0 },
    });
    expect(started.world.chapters.map((chapter) => chapter.level.id)).toEqual([
      'family-b1-playroom',
      'family-b2-casita',
      'family-b3-stage',
    ]);

    let save = started.save;
    const level = save.adventure!.activeLevel!;
    const act = async (action: GameplayAction) => {
      harness.clock.time += 1_000;
      save = await json<SaveView>(harness.request(`/api/saves/${save.id}/actions`, {
        as: 'member',
        body: { actionId: randomUUID(), expectedRevision: save.revision, action },
      }), 200);
    };
    await act({ type: 'collect-equipment', levelId: level.id, pickupId: level.pickups[0]!.pickupId });
    for (const memoryId of level.minorMemoryIds!) await act({ type: 'recover-memory', levelId: level.id, memoryId });
    while (!save.adventure!.activeLevel!.encounters.find((encounter) => encounter.id === level.bossId)!.defeated) {
      await act({ type: 'attack', levelId: level.id, encounterId: level.bossId });
    }
    await act({ type: 'recover-memory', levelId: level.id, memoryId: level.majorMemoryId! });
    expect(save).toMatchObject({
      ageYears: 2,
      abilities: ['move', 'interact', 'jump', 'high-jump'],
      adventure: { activeLevelIndex: 1 },
    });
  });
});
