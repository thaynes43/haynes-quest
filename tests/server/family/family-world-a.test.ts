/**
 * World A, "Clubhouse to Casino" (family-world-a@v1), as a family template:
 * the registry offers it to a synthetic eleven-year-old, the rebase validates,
 * and a published family-world-plan-v1 starts and plays its first chapter as
 * a household save in the in-memory stores. Every child, date and photo here
 * is synthetic.
 */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { GameplayAction, SaveView } from '../../../src/shared/contracts.js';
import type {
  AdminDraftResponse,
  FamilyPlayResponse,
  PersonChoice,
} from '../../../src/shared/family-api.js';
import { validateFamilyWorldPlan } from '../../../src/server/family/plan.js';
import { rebaseWorldForChild } from '../../../src/server/family/rebase.js';
import { FamilyTemplateRegistry } from '../../../src/server/family/templates.js';
import { familyHarness, HARNESS_TODAY, type FamilyHarness } from './harness.js';
import {
  TEST_CHILD_A,
  TEST_CHILD_B,
  TEST_CHILD_C,
  syntheticLibrary,
} from './fake-immich.js';

const registry = new FamilyTemplateRegistry();
const CHAPTER_NAMES = [
  'The Toon Clubhouse',
  'Harbor Rescue',
  'Hero City',
  'Rat Casino After Hours',
];
const ROUTE_IDS = [
  'family-a1-clubhouse',
  'family-a2-harbor',
  'family-a3-rooftop',
  'family-a4-casino',
];

async function json<T>(response: Response | Promise<Response>, status: number): Promise<T> {
  const resolved = await response;
  const text = await resolved.text();
  if (resolved.status !== status) throw new Error(`Expected ${status}, got ${resolved.status}: ${text}`);
  return JSON.parse(text) as T;
}

function worldAHarness(): FamilyHarness {
  return familyHarness({
    people: [{ id: TEST_CHILD_C.personId, name: TEST_CHILD_C.name, birthDate: TEST_CHILD_C.birthDate }],
    assets: syntheticLibrary(TEST_CHILD_C),
  });
}

/** Admin creates Test Child C on World A, auto-picks and publishes. */
async function publishChildC(harness: FamilyHarness) {
  const { people } = await json<{ people: PersonChoice[] }>(
    harness.request(`/api/admin/immich/people?name=${encodeURIComponent(TEST_CHILD_C.name)}`), 200);
  expect(people).toEqual([expect.objectContaining({ label: TEST_CHILD_C.name, birthDate: TEST_CHILD_C.birthDate })]);
  const child = await json<{ id: string }>(harness.request('/api/admin/children', {
    body: {
      immichName: TEST_CHILD_C.name,
      personChoiceId: people[0]!.id,
      displayName: 'Test Child C',
      birthDate: TEST_CHILD_C.birthDate,
      templateId: 'family-world-a',
      templateVersion: 'v1',
    },
  }), 201);
  await json(harness.request(`/api/admin/children/${child.id}/draft`, {
    method: 'PUT',
    body: { op: 'auto-pick', expectedRevision: null },
  }), 202);
  await harness.jobs.settled(child.id);
  const { draft } = await json<AdminDraftResponse>(harness.request(`/api/admin/children/${child.id}/draft`), 200);
  expect(draft).toMatchObject({ publishable: true });
  const publication = await json<{ publicationId: string; revision: number; chapterCount: number; memoryCount: number }>(
    harness.request(`/api/admin/children/${child.id}/publish`, {
      body: { expectedRevision: draft!.revision, requestId: randomUUID() },
    }), 201);
  return { childId: child.id, publication };
}

describe('family-world-a@v1 template (World A)', () => {
  it('is registered under its WORLD-SPEC name with four age bands ending at 11', () => {
    const template = registry.require('family-world-a', 'v1');
    expect(template.project.name).toBe('Clubhouse to Casino');
    expect(template.project.catalogVersion).toBe('parody-catalog-v8');
    expect(template.project.fictionalBirthDate).toBe('2015-01-15');
    expect(template.project.chapters.map((chapter) => chapter.name)).toEqual(CHAPTER_NAMES);
    expect(template.ageBands.map((band) => [band.startAge, band.recoveredAge])).toEqual([
      [0, 2], [2, 5], [5, 9], [9, 11],
    ]);
    expect(template.finalAge).toBe(11);
    expect(template.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is offered to a synthetic eleven-year-old and rebases onto that birthday', () => {
    const offered = registry.offeredFor(TEST_CHILD_C.birthDate, HARNESS_TODAY).map((entry) => `${entry.id}@${entry.version}`);
    expect(offered).toContain('family-world-a@v1');
    // Younger children cannot recover age 11 yet.
    for (const younger of [TEST_CHILD_A, TEST_CHILD_B])
      expect(registry.offeredFor(younger.birthDate, HARNESS_TODAY).map((entry) => entry.id)).not.toContain('family-world-a');

    const world = rebaseWorldForChild(registry.require('family-world-a', 'v1').project, TEST_CHILD_C.birthDate, HARNESS_TODAY);
    expect(world.chapters.map((chapter) => [chapter.chapterId, chapter.startDate, chapter.targetDate, chapter.recoveredAge])).toEqual([
      ['family-a1', '2015-03-10', '2017-03-10', 2],
      ['family-a2', '2017-03-10', '2020-03-10', 5],
      ['family-a3', '2020-03-10', '2024-03-10', 9],
      ['family-a4', '2024-03-10', '2026-03-10', 11],
    ]);
  });

  it('publishes a valid family-world-plan-v1 and plays the first chapter in the memory stores', async () => {
    const harness = worldAHarness();
    const { templates } = await json<{ templates: Array<{ id: string; version: string; name: string; chapterCount: number }> }>(
      harness.request(`/api/admin/templates?birthDate=${TEST_CHILD_C.birthDate}`), 200);
    expect(templates).toContainEqual({ id: 'family-world-a', version: 'v1', name: 'Clubhouse to Casino', chapterCount: 4 });

    const { childId, publication } = await publishChildC(harness);
    expect(publication).toMatchObject({ revision: 1, chapterCount: 4, memoryCount: 12 });
    const stored = (await harness.familyStore.getPublication(publication.publicationId))!;
    expect(validateFamilyWorldPlan(stored.plan, { birthDate: stored.birthDate, memories: stored.memories })).toEqual([]);
    expect(stored.plan).toMatchObject({
      catalogVersion: 'parody-catalog-v8',
      template: { id: 'family-world-a', version: 'v1' },
    });
    const levels = stored.plan.levels;
    expect(levels.map((level) => level.routeId)).toEqual(ROUTE_IDS);
    // The landed Blender boss is frozen by catalog identity; the gadget helper
    // stays a neutral candidate in all four ordinary slots.
    const clubhouse = levels[0]!;
    expect(clubhouse.encounters.at(-1)!.content).toEqual({
      catalogEntryId: 'clubhouse-bully-cat',
      catalogEntryVersion: 'v001',
      assetId: 'clubhouse-bully-cat',
      assetVersion: 'v001',
    });
    expect(clubhouse.encounters.slice(0, 4).map((encounter) => [encounter.kind, encounter.content.placeholder])).toEqual(
      Array.from({ length: 4 }, () => ['ordinary-a', 'neutral-candidate-v1']),
    );
    // The casino keeps its catalog cast; the Radio Showman is the optional fight.
    const casino = levels[3]!;
    expect(casino.encounters.map((encounter) => [encounter.content.catalogEntryId, encounter.content.placeholder ?? null])).toEqual([
      ['chick-flia', null],
      ['jackrabbit-drummer', null],
      ['fox-card-shark', null],
      ['moth-projectionist', null],
      ['rat-pit-boss', null],
      ['editor-candidate-radio-host-showman', 'neutral-candidate-v1'],
    ]);

    // Start the household run and play chapter one through the action route.
    const started = await json<FamilyPlayResponse>(harness.request(`/api/children/${childId}/play`, { as: 'member', body: {} }), 201);
    expect(started.save).toMatchObject({
      ageYears: 0,
      abilities: ['move', 'interact', 'jump'],
      versions: { journey: 'family-world-plan-v1' },
      adventure: { planVersion: 'family-world-plan-v1', activeLevelIndex: 0 },
    });
    expect(started.world).toMatchObject({ templateId: 'family-world-a', templateVersion: 'v1' });
    expect(started.world.chapters.map((chapter) => chapter.name)).toEqual(CHAPTER_NAMES);
    expect(started.world.chapters.map((chapter) => chapter.level.theme)).toEqual(['clubhouse', 'harbor', 'rooftop', 'casino']);

    let save = started.save;
    const level = save.adventure!.activeLevel!;
    expect(level.id).toBe('family-a1-clubhouse');
    const act = async (action: GameplayAction) => {
      harness.clock.time += 1_000;
      save = await json<SaveView>(harness.request(`/api/saves/${save.id}/actions`, {
        as: 'member',
        body: { actionId: randomUUID(), expectedRevision: save.revision, action },
      }), 200);
    };
    for (const pickup of level.pickups) await act({ type: 'collect-equipment', levelId: level.id, pickupId: pickup.pickupId });
    for (const memoryId of level.minorMemoryIds!) await act({ type: 'recover-memory', levelId: level.id, memoryId });
    const boss = () => save.adventure!.activeLevel!.encounters.find((encounter) => encounter.id === level.bossId)!;
    while (!boss().defeated) await act({ type: 'attack', levelId: level.id, encounterId: level.bossId });
    await act({ type: 'recover-memory', levelId: level.id, memoryId: level.majorMemoryId! });
    // Recovering "Turning 2!" unlocks the high jump for Harbor Rescue.
    expect(save).toMatchObject({
      ageYears: 2,
      abilities: ['move', 'interact', 'jump', 'high-jump'],
      adventure: { activeLevelIndex: 1 },
    });
    expect(save.adventure!.activeLevel!.id).toBe('family-a2-harbor');
    const persisted = await harness.questStore.getHouseholdSave(save.id);
    expect(persisted).toMatchObject({ id: save.id, ageYears: 2, publicationId: publication.publicationId });
    // No upstream person or asset id reaches the plan or the save.
    const serialized = JSON.stringify([stored.plan, save, started.world]);
    expect(serialized).not.toContain(TEST_CHILD_C.personId);
    for (const asset of harness.assets) expect(serialized).not.toContain(asset.id);
  });
});
