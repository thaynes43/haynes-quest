/**
 * DESIGN-027 D-01/D-08: a chapter's scare level is authored-level-v4 content.
 * It validates only on v4 documents, the shared editor command sets it (0
 * removes it, so an unscary document keeps its exact bytes), and it freezes
 * into family-world-plan-v1 chapters and editor playtest snapshots, from
 * which the client's resolvers read it back. Every child here is synthetic.
 */
import { describe, expect, it } from 'vitest';
import {
  AUTHORED_LEVEL_SCHEMA_VERSION_V4,
  authoredScareLevel,
  validateAuthoredLevelDocument,
} from '../../../src/shared/authored-level.js';
import {
  FAMILY_ABILITY_LADDER,
  FAMILY_MEMORY_SLOTS,
  type FamilyMemorySlot,
} from '../../../src/shared/family-plan.js';
import {
  applyLevelEditorCommands,
  canonicalLevelEditorProjectJson,
  createWorldEditorProject,
  levelEditorCommandSchema,
  type LevelEditorCommand,
  type LevelEditorProjectV2,
} from '../../../src/shared/editor-project.js';
import { prepareEditorPreview } from '../../../src/server/editor-preview.js';
import {
  buildFamilyWorldPlan,
  familyGeometryFingerprint,
  validateFamilyWorldPlan,
  type FamilySlotSelection,
} from '../../../src/server/family/plan.js';
import { rebaseWorldForChild } from '../../../src/server/family/rebase.js';
import { FamilyTemplateRegistry } from '../../../src/server/family/templates.js';
import { resolveFamilyWorld } from '../../../src/client/family/family-world.js';
import { resolveEditorPlaytestResponse } from '../../../src/client/rat-casino-project.js';
import type { SaveView } from '../../../src/shared/contracts.js';
import { TEST_CHILD_B } from './fake-immich.js';

const TODAY = '2026-09-25';
const registry = new FamilyTemplateRegistry();
const template = registry.require('rat-casino-world', 'v2');
const baseWorld = rebaseWorldForChild(template.project, TEST_CHILD_B.birthDate, TODAY);

const DATES: Record<string, Record<FamilyMemorySlot, string>> = {
  'chapter-1': { 'minor-one': '2021-06-01', 'minor-two': '2022-10-31', major: '2024-02-29' },
  'chapter-2': { 'minor-one': '2024-06-30', 'minor-two': '2024-10-31', major: '2025-03-02' },
  'rat-casino': { 'minor-one': '2025-06-15', 'minor-two': '2025-12-25', major: '2026-02-28' },
};

function selections(): FamilySlotSelection[] {
  let index = 0;
  return baseWorld.chapters.flatMap((chapter) => FAMILY_MEMORY_SLOTS.map((slot) => {
    index += 1;
    return {
      chapterId: chapter.chapterId,
      slot,
      assetId: `10000000-0000-4000-9000-${String(index).padStart(12, '0')}`,
      personId: TEST_CHILD_B.personId,
      localDate: DATES[chapter.chapterId]![slot],
      caption: slot === 'major' ? `Turning ${chapter.recoveredAge}!` : `Synthetic memory ${index}`,
      opaque: `asset-${String(index).padStart(32, '0')}`,
    };
  }));
}

function applied(project: LevelEditorProjectV2, commands: LevelEditorCommand[]): LevelEditorProjectV2 {
  const result = applyLevelEditorCommands(project, { expectedRevision: project.revision, commands });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.project as LevelEditorProjectV2;
}

/** The template world with its second chapter upgraded to v4 at `scare`. */
function worldWith(scare: 0 | 1 | 2 | null) {
  const commands: LevelEditorCommand[] = [
    { type: 'chapter.level.upgrade', chapterId: 'chapter-2', schemaVersion: AUTHORED_LEVEL_SCHEMA_VERSION_V4 },
    ...(scare === null ? [] : [{ type: 'chapter.scare.set' as const, chapterId: 'chapter-2', scare }]),
  ];
  return { ...baseWorld, project: applied(baseWorld.project, commands) };
}

function build(world: ReturnType<typeof worldWith>) {
  return buildFamilyWorldPlan({ template, world, selections: selections(), ladder: FAMILY_ABILITY_LADDER });
}

describe('the v4 scare field', () => {
  const v4 = worldWith(null).project.chapters[1]!.level;
  const v3 = baseWorld.project.chapters[1]!.level;

  it('accepts 0, 1 and 2 on authored-level-v4 documents only', () => {
    for (const scare of [0, 1, 2]) expect(validateAuthoredLevelDocument({ ...v4, scare })).toEqual([]);
    for (const scare of [3, -1, 1.5, '2', null, true])
      expect(validateAuthoredLevelDocument({ ...v4, scare }).length, String(scare)).toBeGreaterThan(0);
    expect(v3.schemaVersion).not.toBe(AUTHORED_LEVEL_SCHEMA_VERSION_V4);
    expect(validateAuthoredLevelDocument({ ...v3, scare: 1 }).length).toBeGreaterThan(0);
    expect(authoredScareLevel(v4)).toBe(0);
  });
});

describe('chapter.scare.set', () => {
  it('sets 1 or 2 and removes the field for 0, restoring the exact project bytes', () => {
    const plain = worldWith(null).project;
    const spooky = applied(plain, [{ type: 'chapter.scare.set', chapterId: 'chapter-2', scare: 1 }]);
    expect(spooky.chapters[1]!.level.scare).toBe(1);
    const scary = applied(spooky, [{ type: 'chapter.scare.set', chapterId: 'chapter-2', scare: 2 }]);
    expect(scary.chapters[1]!.level.scare).toBe(2);
    const cleared = applied(scary, [{ type: 'chapter.scare.set', chapterId: 'chapter-2', scare: 0 }]);
    expect('scare' in cleared.chapters[1]!.level).toBe(false);
    const withoutRevision = (project: LevelEditorProjectV2) =>
      canonicalLevelEditorProjectJson({ ...project, revision: 0 });
    expect(withoutRevision(cleared)).toBe(withoutRevision(plain));
  });

  it('asks for the v4 upgrade first and rejects unknown levels', () => {
    const result = applyLevelEditorCommands(baseWorld.project, {
      expectedRevision: baseWorld.project.revision,
      commands: [{ type: 'chapter.scare.set', chapterId: 'chapter-2', scare: 2 }],
    });
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(['level.version']);
    expect(levelEditorCommandSchema.safeParse({ type: 'chapter.scare.set', chapterId: 'chapter-2', scare: 3 }).success).toBe(false);
    expect(levelEditorCommandSchema.safeParse({ type: 'chapter.scare.set', chapterId: 'chapter-2', scare: 1 }).success).toBe(true);
  });

  it('works on a fresh editor world as well as a family template', () => {
    const world = createWorldEditorProject({ projectId: 'scare-editor' });
    const result = applyLevelEditorCommands(world, {
      expectedRevision: world.revision,
      commands: [
        { type: 'chapter.level.upgrade', chapterId: 'chapter-1', schemaVersion: AUTHORED_LEVEL_SCHEMA_VERSION_V4 },
        { type: 'chapter.scare.set', chapterId: 'chapter-1', scare: 2 },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.project.chapters[0]!.level.scare).toBe(2);
  });
});

describe('freezing the scare level', () => {
  it('freezes a scary chapter into family-world-plan-v1 and the family world view', () => {
    const { plan, memories } = build(worldWith(2));
    const chapter = plan.levels[1]!;
    expect(chapter.authoredLevel.scare).toBe(2);
    expect(plan.levels.map((level) => authoredScareLevel(level.authoredLevel))).toEqual([0, 2, 0]);
    expect(validateFamilyWorldPlan(plan, { birthDate: baseWorld.birthDate, memories })).toEqual([]);
    // The client resolves the frozen chapter, scare level included.
    const view = {
      saveId: 'synthetic',
      templateId: plan.template.id,
      templateVersion: plan.template.version,
      chapters: plan.levels.map((level) => ({
        routeId: level.routeId,
        chapterId: level.chapterId,
        name: level.chapterName,
        subtitle: level.chapterSubtitle,
        description: level.chapterDescription,
        level: structuredClone(level.authoredLevel),
      })),
    };
    const resolved = resolveFamilyWorld(view);
    expect(resolved.resolver(chapter.routeId)!.document.scare).toBe(2);
    expect(authoredScareLevel(resolved.resolver(plan.levels[0]!.routeId)!.document)).toBe(0);
  });

  it('leaves an unscary plan without the field and with its geometry fingerprint unchanged', () => {
    const plain = build(worldWith(null)).plan;
    const zero = build(worldWith(0)).plan;
    const scary = build(worldWith(2)).plan;
    expect(plain.levels.every((level) => !('scare' in level.authoredLevel))).toBe(true);
    expect(zero.projectFingerprint).toBe(plain.projectFingerprint);
    expect(JSON.stringify(zero)).toBe(JSON.stringify(plain));
    expect(scary.projectFingerprint).not.toBe(plain.projectFingerprint);
    expect(scary.projectFingerprint).toBe(familyGeometryFingerprint(scary.levels));
  });

  it('rejects a frozen plan whose scare level was edited afterwards', () => {
    const { plan, memories } = build(worldWith(1));
    const edited = structuredClone(plan) as unknown as { levels: Array<{ authoredLevel: { scare?: number } }> };
    edited.levels[1]!.authoredLevel.scare = 2;
    expect(validateFamilyWorldPlan(edited as unknown as typeof plan, { birthDate: baseWorld.birthDate, memories }))
      .toContain('plan.geometry-fingerprint');
  });

  it('carries the scare level through an editor playtest snapshot', () => {
    // The editor plays the checked-in template on its fictional dates.
    const upgrade: LevelEditorCommand = {
      type: 'chapter.level.upgrade',
      chapterId: 'chapter-2',
      schemaVersion: AUTHORED_LEVEL_SCHEMA_VERSION_V4,
    };
    const source = template.project as LevelEditorProjectV2;
    const project = applied(source, [upgrade, { type: 'chapter.scare.set', chapterId: 'chapter-2', scare: 2 }]);
    const outcome = prepareEditorPreview(project);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.body));
    const snapshot = outcome.bundle.project as LevelEditorProjectV2;
    expect(snapshot.chapters[1]!.level.scare).toBe(2);
    const plainOutcome = prepareEditorPreview(applied(source, [upgrade]));
    if (!plainOutcome.ok) throw new Error('preview refused');
    expect(outcome.bundle.fingerprint).not.toBe(plainOutcome.bundle.fingerprint);
    const playtest = resolveEditorPlaytestResponse({
      save: {} as SaveView,
      project: snapshot,
      fingerprint: outcome.bundle.fingerprint,
    });
    expect(playtest.resolver(snapshot.chapters[1]!.routeId)!.document.scare).toBe(2);
    expect(authoredScareLevel(playtest.resolver(snapshot.chapters[0]!.routeId)!.document)).toBe(0);
  });
});
