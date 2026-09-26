/**
 * Family-world casts end to end (PLAN-019 foundations): era-period project
 * candidates, one ordinary kind in all four slots, a candidate in the Rat
 * Casino bonus slot and candidates beside the catalog Besties boss all freeze
 * into editor-world and family-world plans that the save validator accepts.
 */
import { describe, expect, it } from 'vitest';
import ratCasinoWorldV2 from '../../src/shared/levels/rat-casino-world-v2.json';
import {
  createAdventureStateAtLevel,
  createInitialAdventureState,
  type AdventurePlan,
} from '../../src/shared/adventure.js';
import {
  applyLevelEditorCommand,
  applyLevelEditorCommands,
  createWorldEditorProject,
  parseLevelEditorProject,
  type LevelEditorProject,
} from '../../src/shared/editor-project.js';
import { FAMILY_ABILITY_LADDER, FAMILY_MEMORY_SLOTS } from '../../src/shared/family-plan.js';
import { parseStoredAdventure } from '../../src/server/adventure-schema.js';
import { prepareEditorPreview } from '../../src/server/editor-preview.js';
import { buildFamilyWorldPlan, validateFamilyWorldPlan } from '../../src/server/family/plan.js';
import { rebaseWorldForChild } from '../../src/server/family/rebase.js';
import { FamilyTemplateRegistry } from '../../src/server/family/templates.js';
import { chapterCommands } from '../../scripts/levels/lib/growth-kit.js';
import { buildFamilyFixtureWorld, fixtureCandidate } from '../family-world-fixtures.js';
import { TEST_CHILD_A } from './family/fake-immich.js';

function previewPlan(project: LevelEditorProject) {
  const prepared = prepareEditorPreview(project);
  if (!prepared.ok || !prepared.bundle.world) throw new Error('Expected a world preview');
  return prepared.bundle.world.plan;
}

function expectSaveable(plan: AdventurePlan, level = 0) {
  const state = createAdventureStateAtLevel(plan, level);
  expect(() => parseStoredAdventure(plan, state, { allowEditorPreviewPlan: true })).not.toThrow();
}

describe('family-world casts in frozen plans', () => {
  it('freezes era-period candidates and one ordinary kind per chapter into an editor-world plan', () => {
    const plan = previewPlan(buildFamilyFixtureWorld());
    expect(plan.catalogVersion).toBe('parody-catalog-v7');
    expect(plan.levels.map((level) => level.periodId)).toEqual([
      'toon-clubhouse-v1',
      'rescue-harbor-v1',
      'hero-city-v1',
    ]);
    const first = plan.levels[0]!;
    expect(first.encounters.map((encounter) => [encounter.kind, encounter.maxHp])).toEqual([
      ['ordinary-a', 4],
      ['ordinary-a', 4],
      ['ordinary-a', 4],
      ['ordinary-a', 4],
      ['boss', 8],
    ]);
    expect(first.encounters.every((encounter) => encounter.content.placeholder === 'neutral-candidate-v1')).toBe(true);
    expect(plan.levels[2]!.encounters.map((encounter) => encounter.kind)).toEqual([
      'ordinary-a',
      'ordinary-b',
      'ordinary-a',
      'ordinary-b',
      'boss',
    ]);
    for (const level of [0, 1, 2]) expectSaveable(plan, level);
  });

  it('still rejects an ordinary slot holding a boss', () => {
    const plan = structuredClone(previewPlan(buildFamilyFixtureWorld()));
    plan.levels[0]!.encounters[1]!.kind = 'boss';
    const state = createAdventureStateAtLevel(plan, 0);
    expect(() => parseStoredAdventure(plan, state, { allowEditorPreviewPlan: true })).toThrow('Save unavailable');
  });

  it('freezes a project candidate in the Rat Casino bonus slot', () => {
    const project = parseLevelEditorProject({ ...ratCasinoWorldV2, catalogVersion: 'parody-catalog-v7' });
    const showman = fixtureCandidate('fixture-radio-showman', 'Radio Showman', 'rat-casino-v1', 'ordinary-a', {
      startDate: '2019-10-28',
      endDate: '2026-12-31',
    });
    const result = applyLevelEditorCommand(project, chapterCommands('rat-casino').addCandidate('bonus-1', showman));
    expect(result.issues).toEqual([]);
    const plan = previewPlan(result.project);
    expect(plan.version).toBe('editor-world-plan-v2');
    const bonus = plan.levels[2]!.encounters.at(-1)!;
    expect(bonus).toMatchObject({
      id: 'rat-casino-v2-encounter-bonus-1',
      content: { catalogEntryId: 'editor-candidate-fixture-radio-showman', placeholder: 'neutral-candidate-v1' },
    });
    expectSaveable(plan, 2);
  });

  it('freezes Besties-period candidates beside the catalog Besties boss', () => {
    const project = createWorldEditorProject({ projectId: 'besties-candidates', catalogVersion: 'parody-catalog-v7' });
    const level = project.chapters[1]!.level;
    const besties = chapterCommands('chapter-2');
    const idol = fixtureCandidate('fixture-band-idol', 'Band Idol', 'besties-obby-v1', 'ordinary-b', {
      startDate: '2024-01-01',
      endDate: '2026-12-31',
    });
    const result = applyLevelEditorCommands(project, {
      expectedRevision: 0,
      commands: [
        besties.setAnchor('encounter.ordinary-1', { ...structuredClone(level.anchors.encounters['ordinary-1']), kind: 'ordinary-b' }),
        besties.setAnchor('encounter.ordinary-3', { ...structuredClone(level.anchors.encounters['ordinary-3']), kind: 'ordinary-b' }),
        besties.addCandidate('ordinary-2', idol),
        ...(['ordinary-1', 'ordinary-3', 'ordinary-4'] as const).map((slot) =>
          besties.assign(slot, { source: 'candidate', candidateId: idol.id })),
      ],
    });
    expect(result.issues).toEqual([]);
    const plan = previewPlan(result.project);
    expect(plan.levels[1]!.encounters.map((encounter) => [encounter.kind, encounter.maxHp])).toEqual([
      ['ordinary-b', 7],
      ['ordinary-b', 7],
      ['ordinary-b', 7],
      ['ordinary-b', 7],
      ['boss', 11],
    ]);
    expect(plan.levels[1]!.encounters.at(-1)!.content.assetId).toBe('bickering-besties');
    expectSaveable(plan, 1);
  });

  it('publishes a family-world plan from a template with era candidates and one ordinary kind', () => {
    const registry = new FamilyTemplateRegistry([
      { id: 'family-fixture-world', version: 'v1', project: buildFamilyFixtureWorld() },
    ]);
    const template = registry.require('family-fixture-world', 'v1');
    expect(registry.offeredFor(TEST_CHILD_A.birthDate, '2026-09-25').map((entry) => entry.id)).toEqual([
      'family-fixture-world',
    ]);
    const world = rebaseWorldForChild(template.project, TEST_CHILD_A.birthDate, '2026-09-25');
    const dates: Record<string, Record<(typeof FAMILY_MEMORY_SLOTS)[number], string>> = {
      'a1-clubhouse': { 'minor-one': '2016-06-01', 'minor-two': '2017-06-01', major: '2018-02-28' },
      'a2-harbor': { 'minor-one': '2018-06-01', 'minor-two': '2019-06-01', major: '2021-02-28' },
      'a3-rooftop': { 'minor-one': '2021-06-01', 'minor-two': '2023-06-01', major: '2026-02-28' },
    };
    let index = 0;
    const selections = world.chapters.flatMap((chapter) => FAMILY_MEMORY_SLOTS.map((slot) => {
      index += 1;
      return {
        chapterId: chapter.chapterId,
        slot,
        assetId: `20000000-0000-4000-9000-${String(index).padStart(12, '0')}`,
        personId: TEST_CHILD_A.personId,
        localDate: dates[chapter.chapterId]![slot],
        caption: slot === 'major' ? `Turning ${chapter.recoveredAge}!` : `Synthetic memory ${index}`,
        opaque: `asset-${String(index).padStart(32, '0')}`,
      };
    }));
    const { plan, memories } = buildFamilyWorldPlan({ template, world, selections, ladder: FAMILY_ABILITY_LADDER });
    expect(plan.catalogVersion).toBe('parody-catalog-v7');
    expect(plan.levels[0]!.encounters.slice(0, 4).map((encounter) => encounter.kind)).toEqual([
      'ordinary-a',
      'ordinary-a',
      'ordinary-a',
      'ordinary-a',
    ]);
    expect(plan.levels.map((level) => level.authoredLevel.theme)).toEqual(['clubhouse', 'harbor', 'rooftop']);
    expect(validateFamilyWorldPlan(plan, { birthDate: TEST_CHILD_A.birthDate, memories })).toEqual([]);
    expect(() => parseStoredAdventure(plan, createInitialAdventureState(plan))).not.toThrow();
  });
});
