/**
 * `family-world-a@v3` and `family-world-b@v3` (PLAN-019 cast integration): the
 * v2 levels with the landed family-era models cast from parody-catalog-v10.
 * v1 and v2 stay registered with their published fingerprints; v3 is offered
 * to exactly the children v2 is, rebases onto the same chapters, publishes a
 * plan that freezes each model's catalog identity, and **Update world**
 * (DESIGN-024 D-11) moves a child from v2 to v3 carrying every photo and
 * caption. Every child, birthday and photo here is synthetic.
 */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { addDays } from '../../../src/shared/family-plan.js';
import { validateFamilyWorldPlan } from '../../../src/server/family/plan.js';
import { rebaseWorldForChild } from '../../../src/server/family/rebase.js';
import { FamilyTemplateRegistry } from '../../../src/server/family/templates.js';
import { familyHarness, HARNESS_TODAY } from './harness.js';
import { TEST_CHILD_B, TEST_CHILD_C, syntheticLibrary } from './fake-immich.js';

const registry = new FamilyTemplateRegistry();
const ACTOR = '30000000-0000-4000-8000-000000000001';

/** Fingerprints the published journeys froze; these versions never change. */
const FROZEN_FINGERPRINTS: Record<string, string> = {
  'family-world-a@v1': 'b0bf1dc783d077b69765604cc6e933b779404c84686d076504cb52b844d53008',
  'family-world-a@v2': 'ceb086efa885920168b5227e52de24b805ebabdc47d1894f1d92a0b14500a3c5',
  'family-world-b@v1': '57bf3173a9951cf9987d503a47406a268f00b7eb970f038cfd7ac7394f730a69',
  'family-world-b@v2': 'aa8c85a2fc59c4d6cbc0c626f66403fc8cfd4d5b6f29c36d1daeb66e4ef48d27',
};

const catalog = (id: string) => ({ catalogEntryId: id, catalogEntryVersion: 'v001', assetId: id, assetVersion: 'v001' });

/** Per world: the synthetic child, the v10 identities per chapter and the photo count. */
const WORLDS = {
  'family-world-a': {
    child: TEST_CHILD_C,
    memories: 12,
    // Birthdays around World A's window: first A3 start on 2018-12-14 and
    // an eleventh birthday by the household date.
    edges: ['2013-12-13', '2013-12-14', '2015-09-25', '2015-09-26'],
    sweep: ['2013-06-01', '2016-03-01'] as const,
    cast: [
      ['gadget-helper', 'gadget-helper', 'gadget-helper', 'gadget-helper', 'clubhouse-bully-cat'],
      ['mischief-kitten', 'mischief-kitten', 'mischief-kitten', 'mischief-kitten', 'rival-mayor', 'mischief-kitten'],
    ],
  },
  'family-world-b': {
    child: TEST_CHILD_B,
    memories: 9,
    // The Besties' parent lock opens on 2018-07-31; a sixth birthday by the
    // household date.
    edges: ['2018-07-30', '2018-07-31', '2020-09-25', '2020-09-26'],
    sweep: ['2017-09-01', '2021-01-01'] as const,
    cast: [
      ['yes-yes-veggie', 'yes-yes-veggie', 'yes-yes-veggie', 'yes-yes-veggie', 'honk-bus'],
      ['bin-chicken', 'bin-chicken', 'bin-chicken', 'bin-chicken', 'magic-house'],
    ],
  },
} as const;

type WorldId = keyof typeof WORLDS;

function birthdays(world: WorldId): string[] {
  const { sweep, edges } = WORLDS[world];
  const out: string[] = [...edges];
  for (let date: string = sweep[0]; date < sweep[1]; date = addDays(date, 23)) out.push(date);
  return out;
}

describe.each(Object.keys(WORLDS) as WorldId[])('%s@v3', (world) => {
  const spec = WORLDS[world];
  const v2 = registry.require(world, 'v2');
  const v3 = registry.require(world, 'v3');

  it('is registered beside the frozen v1 and v2, whose fingerprints are unchanged', () => {
    // v4 adds the DESIGN-027 scare levels (family-worlds-v4.test.ts).
    expect(registry.list().filter((entry) => entry.id === world).map((entry) => entry.version)).toEqual(['v1', 'v2', 'v3', 'v4']);
    for (const version of ['v1', 'v2']) expect(registry.require(world, version).fingerprint).toBe(FROZEN_FINGERPRINTS[`${world}@${version}`]);
    expect(v3.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.values(FROZEN_FINGERPRINTS)).not.toContain(v3.fingerprint);
    expect(v3.project.catalogVersion).toBe('parody-catalog-v10');
    expect(v3.project.name).toBe(v2.project.name);
    // Same chapter ids and age bands, so Update world keeps every chapter (D-11).
    expect(v3.project.chapters.map((chapter) => chapter.chapterId)).toEqual(v2.project.chapters.map((chapter) => chapter.chapterId));
    expect(v3.ageBands).toEqual(v2.ageBands);
  });

  it('is offered to exactly the children v2 is offered to', () => {
    const pair = new FamilyTemplateRegistry([
      { id: world, version: 'v2', project: v2.project },
      { id: world, version: 'v3', project: v3.project },
    ]);
    let offered = 0;
    for (const birthDate of birthdays(world)) {
      const versions = pair.offeredFor(birthDate, HARNESS_TODAY).map((entry) => entry.version);
      expect(versions.includes('v3'), birthDate).toBe(versions.includes('v2'));
      if (versions.includes('v3')) offered += 1;
    }
    expect(offered).toBeGreaterThan(10);
    const [before, first, last, after] = spec.edges;
    expect(pair.offeredFor(before, HARNESS_TODAY)).toEqual([]);
    expect(pair.offeredFor(first, HARNESS_TODAY).map((entry) => entry.version)).toEqual(['v2', 'v3']);
    expect(pair.offeredFor(last, HARNESS_TODAY).map((entry) => entry.version)).toEqual(['v2', 'v3']);
    expect(pair.offeredFor(after, HARNESS_TODAY)).toEqual([]);
    expect(registry.offeredFor(spec.child.birthDate, HARNESS_TODAY).map((entry) => `${entry.id}@${entry.version}`))
      .toContain(`${world}@v3`);
  });

  it('rebases onto the synthetic birthday exactly as v2 does', () => {
    const rebased = (project: typeof v2.project) =>
      rebaseWorldForChild(project, spec.child.birthDate, HARNESS_TODAY).chapters.map((chapter) =>
        [chapter.chapterId, chapter.startAge, chapter.recoveredAge, chapter.startDate, chapter.targetDate]);
    expect(rebased(v3.project)).toEqual(rebased(v2.project));
  });

  it('moves a child from v2 to v3 with Update world, carrying every photo, and publishes the v10 cast', async () => {
    const harness = familyHarness({
      people: world === 'family-world-a'
        ? [{ id: TEST_CHILD_C.personId, name: TEST_CHILD_C.name, birthDate: TEST_CHILD_C.birthDate }]
        : [],
      assets: syntheticLibrary(spec.child),
    });
    const [person] = await harness.service.lookupPeople(spec.child.name);
    const child = await harness.service.createChild({
      immichName: spec.child.name,
      personChoiceId: person!.id,
      displayName: 'Synthetic Child',
      birthDate: spec.child.birthDate,
      templateId: world,
      templateVersion: 'v2',
    }, ACTOR);
    const picked = await harness.service.autoPick(child.id, ACTOR);
    expect(picked).toMatchObject({ publishable: true, templateVersion: 'v2' });
    const first = await harness.service.publish(child.id, picked.revision, randomUUID(), ACTOR);
    const firstPublication = (await harness.familyStore.getPublication(first.publicationId))!;
    expect(firstPublication.plan.catalogVersion).toBe(v2.project.catalogVersion);

    const result = await harness.service.upgradeTemplate(child.id, {
      templateId: world,
      templateVersion: 'v3',
      expectedRevision: picked.revision,
    }, ACTOR);
    expect(result).toMatchObject({ carried: spec.memories, total: spec.memories, needsPhoto: 0 });
    expect(result.draft).toMatchObject({ templateVersion: 'v3', publishable: true });
    await harness.service.publish(child.id, result.draft.revision, randomUUID(), ACTOR);
    const latest = (await harness.familyStore.latestPublication(child.id))!;
    expect(latest.plan.template).toEqual({ id: world, version: 'v3', fingerprint: v3.fingerprint });
    expect(latest.plan.catalogVersion).toBe('parody-catalog-v10');
    // The same photos and captions, and no upstream id in the plan.
    expect(latest.memories).toEqual(firstPublication.memories);
    expect(validateFamilyWorldPlan(latest.plan, { birthDate: latest.birthDate, memories: latest.memories })).toEqual([]);
    const serialized = JSON.stringify(latest.plan);
    expect(serialized).not.toContain(spec.child.personId);
    for (const asset of harness.assets) expect(serialized).not.toContain(asset.id);

    // Chapters one and two freeze the v10 identities; their stats and every
    // other chapter are exactly v2's.
    spec.cast.forEach((ids, index) => {
      const level = latest.plan.levels[index]!;
      expect(level.encounters.map((encounter) => encounter.content)).toEqual(ids.map(catalog));
      const before = firstPublication.plan.levels[index]!;
      expect(level.encounters.map(({ content: _content, ...rest }) => rest))
        .toEqual(before.encounters.map(({ content: _content, ...rest }) => rest));
    });
    for (const index of latest.plan.levels.keys()) {
      if (index < spec.cast.length) continue;
      expect(latest.plan.levels[index]!.encounters).toEqual(firstPublication.plan.levels[index]!.encounters);
    }
    expect(latest.plan.levels.map((level) => level.authoredLevel)).toEqual(
      firstPublication.plan.levels.map((level) => level.authoredLevel),
    );
  });
});
