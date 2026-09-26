import { describe, expect, it } from 'vitest';
import {
  createInitialAdventureState,
  reduceAdventureAction,
  type AdventureState,
  type EditorWorldAdventurePlanV2,
} from '../../../src/shared/adventure.js';
import type { GameplayAction } from '../../../src/shared/contracts.js';
import {
  FAMILY_MEMORY_SLOTS,
  PROVISIONAL_ABILITY_LADDER,
  type FamilyMemorySlot,
  type FamilyWorldAdventurePlanV1,
} from '../../../src/shared/family-plan.js';
import { parseStoredAdventure } from '../../../src/server/adventure-schema.js';
import { prepareEditorPreview } from '../../../src/server/editor-preview.js';
import {
  FAMILY_RULE_VERSIONS,
  FamilyPlanError,
  buildFamilyWorldPlan,
  familyGeometryFingerprint,
  validateFamilyWorldPlan,
  type FamilySlotSelection,
} from '../../../src/server/family/plan.js';
import { rebaseWorldForChild } from '../../../src/server/family/rebase.js';
import { FamilyTemplateRegistry } from '../../../src/server/family/templates.js';
import { TEST_CHILD_B } from './fake-immich.js';

const TODAY = '2026-09-25';
const registry = new FamilyTemplateRegistry();
const template = registry.require('rat-casino-world', 'v2');
const world = rebaseWorldForChild(template.project, TEST_CHILD_B.birthDate, TODAY);

const DATES: Record<string, Record<FamilyMemorySlot, string>> = {
  'chapter-1': { 'minor-one': '2021-06-01', 'minor-two': '2022-10-31', major: '2024-02-29' },
  'chapter-2': { 'minor-one': '2024-06-30', 'minor-two': '2024-10-31', major: '2025-03-02' },
  'rat-casino': { 'minor-one': '2025-06-15', 'minor-two': '2025-12-25', major: '2026-02-28' },
};

function assetId(index: number): string {
  return `10000000-0000-4000-9000-${String(index).padStart(12, '0')}`;
}

function selections(dates = DATES): FamilySlotSelection[] {
  let index = 0;
  return world.chapters.flatMap((chapter) => FAMILY_MEMORY_SLOTS.map((slot) => {
    index += 1;
    return {
      chapterId: chapter.chapterId,
      slot,
      assetId: assetId(index),
      personId: TEST_CHILD_B.personId,
      localDate: dates[chapter.chapterId]![slot],
      caption: slot === 'major' ? `Turning ${chapter.recoveredAge}!` : `Synthetic memory ${index}`,
      opaque: `asset-${String(index).padStart(32, '0')}`,
    };
  }));
}

function build(input: FamilySlotSelection[] = selections()) {
  return buildFamilyWorldPlan({ template, world, selections: input, ladder: PROVISIONAL_ABILITY_LADDER });
}

function mutated(
  plan: FamilyWorldAdventurePlanV1,
  edit: (draft: { levels: Array<Record<string, unknown>> } & Record<string, unknown>) => void,
): FamilyWorldAdventurePlanV1 {
  const copy = structuredClone(plan) as unknown as { levels: Array<Record<string, unknown>> } & Record<string, unknown>;
  edit(copy);
  return copy as unknown as FamilyWorldAdventurePlanV1;
}

function asEditorWorldPlan(plan: FamilyWorldAdventurePlanV1): EditorWorldAdventurePlanV2 {
  return {
    version: 'editor-world-plan-v2',
    catalogVersion: plan.catalogVersion,
    projectFingerprint: plan.projectFingerprint,
    levels: plan.levels.map(({
      chapterId: _c,
      chapterName: _n,
      chapterSubtitle: _s,
      chapterDescription: _d,
      abilities: _a,
      memorySlots: _m,
      authoredLevel: _g,
      ...level
    }) => structuredClone(level)),
  };
}

describe('family-world-plan-v1 builder (DESIGN-024 D-07)', () => {
  it('freezes the rebased chapters, geometry, cast, ladder and memory slots', () => {
    const { plan, memories, versions } = build();
    expect(plan).toMatchObject({
      version: 'family-world-plan-v1',
      catalogVersion: 'parody-catalog-v6',
      ageRule: 'birth-date-whole-years-feb28-v1',
      template: { id: 'rat-casino-world', version: 'v2', fingerprint: template.fingerprint },
    });
    expect(versions).toEqual(FAMILY_RULE_VERSIONS('parody-catalog-v6'));
    expect(plan.projectFingerprint).toBe(familyGeometryFingerprint(plan.levels));
    expect(plan.abilityLadder.grants.map((grant) => grant.fromAge)).toEqual([0, 2, 4]);
    expect(plan.levels.map((level) => ({
      id: level.id,
      startAge: level.startAgeYears,
      targetAge: level.targetAgeYears,
      startDate: level.startDate,
      end: level.representedEndDate,
      abilities: level.abilities,
      optional: level.optionalEncounterIds,
    }))).toEqual([
      {
        id: 'chapter-1-route', startAge: 0, targetAge: 4, startDate: '2020-02-29', end: '2024-02-29',
        abilities: ['move', 'interact', 'jump'], optional: [],
      },
      {
        id: 'chapter-2-route', startAge: 4, targetAge: 5, startDate: '2024-02-29', end: '2025-03-02',
        abilities: ['move', 'interact', 'jump', 'high-jump', 'double-jump'], optional: [],
      },
      {
        id: 'rat-casino-v2', startAge: 5, targetAge: 6, startDate: '2025-02-28', end: '2026-02-28',
        abilities: ['move', 'interact', 'jump', 'high-jump', 'double-jump'],
        optional: ['rat-casino-v2-encounter-bonus-1'],
      },
    ]);
    expect(plan.levels.map((level) => level.authoredLevel))
      .toEqual(template.project.chapters.map((chapter) => chapter.level));
    expect(plan.levels.map((level) => [level.chapterName, level.chapterSubtitle, level.chapterDescription]))
      .toEqual(template.project.chapters.map((chapter) => [chapter.name, chapter.subtitle, chapter.description]));
    expect(plan.levels[1]!.memorySlots[2]).toEqual({
      slot: 'major',
      memoryId: 'chapter-2-route-memory-major',
      date: '2025-03-02',
      ageYears: 5,
      caption: 'Turning 5!',
      source: { kind: 'immich', opaque: `asset-${'6'.padStart(32, '0')}` },
    });
    expect(memories).toHaveLength(9);
    expect(memories[8]).toEqual({
      id: 'rat-casino-v2-memory-major',
      date: '2026-02-28',
      ageYears: 6,
      label: 'Turning 6!',
      source: { kind: 'immich', assetId: assetId(9), personId: TEST_CHILD_B.personId },
    });
    expect(validateFamilyWorldPlan(plan, { birthDate: TEST_CHILD_B.birthDate, memories })).toEqual([]);
  });

  it('keeps upstream ids out of the plan itself', () => {
    const serialized = JSON.stringify(build().plan);
    expect(serialized).not.toContain(TEST_CHILD_B.personId);
    for (let index = 1; index <= 9; index += 1) expect(serialized).not.toContain(assetId(index));
  });

  it('uses the frozen editor-world construction for every level', () => {
    // A non-leap child rebases cleanly through the unmodified editor preview.
    const other = rebaseWorldForChild(template.project, '2020-06-15', TODAY);
    const preview = prepareEditorPreview(other.project);
    if (!preview.ok || !preview.bundle.world) throw new Error('Expected a world preview');
    const dates: Record<string, Record<FamilySlotSelection['slot'], string>> = {
      'chapter-1': { 'minor-one': '2021-06-01', 'minor-two': '2022-10-31', major: '2024-06-15' },
      'chapter-2': { 'minor-one': '2024-10-01', 'minor-two': '2025-02-01', major: '2025-06-20' },
      'rat-casino': { 'minor-one': '2025-10-01', 'minor-two': '2026-02-01', major: '2026-06-15' },
    };
    const built = buildFamilyWorldPlan({
      template,
      world: other,
      ladder: PROVISIONAL_ABILITY_LADDER,
      selections: selections(dates).map((selection) => ({ ...selection })),
    });
    const core = asEditorWorldPlan(built.plan).levels
      .map(({ representedEndDate: _end, optionalEncounterIds: _optional, ...level }) => level);
    const editorCore = preview.bundle.world.plan.levels
      .map(({ representedEndDate: _end, ...level }) => {
        const { optionalEncounterIds: _optional, ...rest } = level as typeof level & { optionalEncounterIds?: unknown };
        return rest;
      });
    expect(core).toEqual(editorCore);
  });

  it('plays a chapter on the existing editor-world runtime and advances age', () => {
    const editorPlan = asEditorWorldPlan(build().plan);
    let state: AdventureState = createInitialAdventureState(editorPlan);
    expect(() => parseStoredAdventure(editorPlan, state, { allowEditorPreviewPlan: true })).not.toThrow();
    const level = editorPlan.levels[0]!;
    let now = 1_000;
    const act = (action: GameplayAction) => {
      state = reduceAdventureAction(editorPlan, state, action, now);
      now += 1_000;
    };
    act({ type: 'collect-equipment', levelId: level.id, pickupId: level.pickups[0]!.pickupId });
    for (const memoryId of level.minorMemoryIds) act({ type: 'recover-memory', levelId: level.id, memoryId });
    while (!state.encounters[level.bossId]!.defeated) {
      act({ type: 'attack', levelId: level.id, encounterId: level.bossId });
    }
    expect(state.phase).toBe('memory-released');
    act({ type: 'recover-memory', levelId: level.id, memoryId: level.majorMemoryId });
    expect(state).toMatchObject({ activeLevelIndex: 1, ageYears: 4, completedLevelIds: [level.id], phase: 'exploring' });
  });
});

describe('family-world-plan-v1 validator', () => {
  const { plan, memories } = build();
  const context = { birthDate: TEST_CHILD_B.birthDate, memories };

  it.each([
    ['a little memory before the chapter', (copy: { levels: Array<Record<string, unknown>> }) => {
      (copy.levels[1]!.memorySlots as Array<Record<string, unknown>>)[0]!.date = '2024-02-01';
    }, 'memory.minor-window'],
    ['a big memory before the birthday', (copy: { levels: Array<Record<string, unknown>> }) => {
      (copy.levels[1]!.memorySlots as Array<Record<string, unknown>>)[2]!.date = '2025-02-27';
    }, 'memory.major-window'],
    ['an invalid caption', (copy: { levels: Array<Record<string, unknown>> }) => {
      (copy.levels[0]!.memorySlots as Array<Record<string, unknown>>)[0]!.caption = '';
    }, 'memory.caption'],
    ['a move granted early', (copy: { levels: Array<Record<string, unknown>> }) => {
      copy.levels[0]!.abilities = ['move', 'interact', 'jump', 'glide'];
    }, 'level.abilities'],
    ['a stronger boss', (copy: { levels: Array<Record<string, unknown>> }) => {
      (copy.levels[0]!.encounters as Array<Record<string, unknown>>)[4]!.maxHp = 99;
    }, 'level.encounters'],
    ['edited geometry', (copy: { levels: Array<Record<string, unknown>> }) => {
      (copy.levels[2]!.authoredLevel as Record<string, unknown>).theme = 'garden';
    }, 'plan.geometry-fingerprint'],
    ['a shifted chapter start', (copy: { levels: Array<Record<string, unknown>> }) => {
      copy.levels[2]!.startDate = '2025-03-01';
    }, 'level.start-date'],
    ['a foreign cast member', (copy: { levels: Array<Record<string, unknown>> }) => {
      const boss = (copy.levels[0]!.encounters as Array<{ content: Record<string, unknown> }>)[4]!;
      boss.content = { ...boss.content, catalogEntryId: 'rat-pit-boss', assetId: 'rat-pit-boss' };
    }, 'level.cast'],
    ['an upstream-looking source', (copy: { levels: Array<Record<string, unknown>> }) => {
      (copy.levels[0]!.memorySlots as Array<Record<string, unknown>>)[1]!.source = { kind: 'immich', opaque: 'x' };
    }, 'memory.source'],
  ])('rejects %s', (_name, edit, code) => {
    const issues = validateFamilyWorldPlan(mutated(plan, edit), context);
    expect(issues).toContain(code);
    for (const issue of issues) expect(issue).toMatch(/^[a-z.-]+$/);
  });

  it('rejects a manifest that disagrees with the plan', () => {
    const relabeled = memories.map((memory, index) => index === 0 ? { ...memory, label: 'Different' } : memory);
    expect(validateFamilyWorldPlan(plan, { ...context, memories: relabeled })).toContain('manifest.slot');
    const duplicate = memories.map((memory, index) => index === 1
      ? { ...memory, source: memories[0]!.source }
      : memory);
    expect(validateFamilyWorldPlan(plan, { ...context, memories: duplicate })).toContain('manifest.duplicate-photo');
    const otherPerson = memories.map((memory, index) => index === 4 && memory.source.kind === 'immich'
      ? { ...memory, source: { ...memory.source, personId: 'someone-else' } }
      : memory);
    expect(validateFamilyWorldPlan(plan, { ...context, memories: otherPerson })).toContain('manifest.person');
  });

  it('re-derives every date against the birthday it was built for', () => {
    expect(validateFamilyWorldPlan(plan, { birthDate: '2020-03-01' })).toContain('level.start-date');
  });

  it('refuses incomplete, invalid or out-of-order selections at build time', () => {
    expect(() => build(selections().slice(1))).toThrow(expect.objectContaining({ code: 'SLOTS_INCOMPLETE' }));
    const badCaption = selections().map((entry, index) => index === 0 ? { ...entry, caption: ' ' } : entry);
    expect(() => build(badCaption)).toThrow(expect.objectContaining({ code: 'PLAN_INVALID' }));
    const outOfOrder = {
      ...DATES,
      'rat-casino': { ...DATES['rat-casino']!, 'minor-one': '2025-03-01' },
    };
    let failure: unknown;
    try {
      build(selections(outOfOrder));
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(FamilyPlanError);
    expect((failure as FamilyPlanError).issues).toContain('memory.minor-window');
  });
});
