import { describe, expect, it } from "vitest";

import {
  LEVEL_EDITOR_PREPARED_ENEMIES,
  LEVEL_EDITOR_PROJECT_SCHEMA_VERSION_V2,
  LevelEditorProjectValidationError,
  applyLevelEditorCommand,
  applyLevelEditorCommands,
  canonicalLevelEditorProjectJson,
  createLevelEditorProject,
  createWorldEditorProject,
  isLevelEditorProjectV2,
  migrateLevelEditorProjectToV2,
  parseLevelEditorProjectJson,
  resolveLevelEditorProject,
  serializeLevelEditorProject,
  validateLevelEditorProject,
  type LevelEditorEnemyCandidate,
  type LevelEditorProjectV2,
} from "../../src/shared/editor-project";
import bestiesTemplate from "../../src/shared/levels/besties-playground-v2.json";
import gardenTemplate from "../../src/shared/levels/garden-playground-v2.json";

function project(): LevelEditorProjectV2 {
  return createWorldEditorProject({
    projectId: "world-project-test",
    name: "World project test",
  });
}

function expectApplied(
  result: ReturnType<typeof applyLevelEditorCommand>,
): LevelEditorProjectV2 {
  expect(result.ok, JSON.stringify(result.issues, null, 2)).toBe(true);
  if (!result.ok || !isLevelEditorProjectV2(result.project))
    throw new Error("Expected a v2 editor command result");
  return result.project;
}

function ordinaryCandidate(
  overrides: Partial<LevelEditorEnemyCandidate> = {},
): LevelEditorEnemyCandidate {
  return {
    id: "party-cloud",
    name: "Party Cloud",
    periodId: "block-party-v1",
    recognizableReference: "A cheerful arcade storm cloud",
    visualJoke: "It rains tiny party hats",
    obstacleOrAttack: "A slow rolling confetti puff",
    eligibility: { startDate: "2020-01-01", endDate: "2023-12-31" },
    role: "ordinary",
    kind: "ordinary-a",
    behaviorPreset: "ordinary-a",
    ...overrides,
  };
}

describe("complete-world editor project contract", () => {
  it("creates, freezes and deterministically round-trips a valid v2 project", () => {
    const original = project();

    expect(original.schemaVersion).toBe(LEVEL_EDITOR_PROJECT_SCHEMA_VERSION_V2);
    expect(original.chapters).toHaveLength(2);
    expect(original.chapters.map((chapter) => chapter.routeId)).toEqual([
      "chapter-1-route",
      "chapter-2-route",
    ]);
    expect(original.chapters.every((chapter) => chapter.level.id === chapter.routeId))
      .toBe(true);
    expect(validateLevelEditorProject(original)).toEqual([]);

    const serialized = serializeLevelEditorProject(original);
    const parsed = parseLevelEditorProjectJson(serialized);
    expect(isLevelEditorProjectV2(parsed)).toBe(true);
    expect(parsed).toEqual(original);
    expect(canonicalLevelEditorProjectJson(parsed)).toBe(
      canonicalLevelEditorProjectJson(original),
    );
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.chapters)).toBe(true);
  });

  it("resolves project-local routes without changing either published template", () => {
    const originalGarden = JSON.stringify(gardenTemplate);
    const originalBesties = JSON.stringify(bestiesTemplate);
    const resolved = resolveLevelEditorProject(project());

    expect(Object.keys(resolved.levels)).toEqual([
      "chapter-1-route",
      "chapter-2-route",
    ]);
    expect(resolved.levels["chapter-1-route"]?.document.id).toBe(
      "chapter-1-route",
    );
    expect(resolved.levels["chapter-2-route"]?.document.id).toBe(
      "chapter-2-route",
    );
    expect(resolved.levels["chapter-1-route"]?.course.platforms).toEqual(
      resolveLevelEditorProject(
        migrateLevelEditorProjectToV2(
          createLevelEditorProject({ projectId: "migration-parity" }),
        ),
      ).levels["chapter-1-route"]?.course.platforms,
    );
    expect(JSON.stringify(gardenTemplate)).toBe(originalGarden);
    expect(JSON.stringify(bestiesTemplate)).toBe(originalBesties);
  });

  it("migrates v1 with exact layouts, revision and safe local route identities", () => {
    const legacy = createLevelEditorProject({
      projectId: "legacy-import",
      name: "Legacy import",
    });
    const revisedLegacy = { ...legacy, revision: 17 };
    const migrated = migrateLevelEditorProjectToV2(revisedLegacy);

    expect(migrated.revision).toBe(17);
    expect(migrated.name).toBe(legacy.name);
    expect(migrated.chapters.map((chapter) => chapter.sourceTemplateId)).toEqual([
      "garden-playground-v2",
      "besties-playground-v2",
    ]);
    for (const [index, chapter] of migrated.chapters.entries()) {
      const { schemaVersion: _newSchema, id: _newId, ...newLayout } = chapter.level;
      const {
        schemaVersion: _legacySchema,
        id: _legacyId,
        ...legacyLayout
      } = legacy.chapters[index]!.level;
      expect(newLayout).toEqual(legacyLayout);
      expect(chapter.routeId).not.toBe(legacy.chapters[index]!.level.id);
      expect(chapter.level.id).toBe(chapter.routeId);
    }
    expect(validateLevelEditorProject(migrated)).toEqual([]);
  });

  it("adds, duplicates, reorders and removes bounded independent chapters", () => {
    const original = project();
    const addedResult = applyLevelEditorCommand(original, {
      type: "chapter.add",
      newChapterId: "chapter-3",
      newRouteId: "midnight-arcade-route",
      sourceTemplateId: "garden-playground-v2",
      name: "Midnight Arcade",
    });
    const added = expectApplied(addedResult);

    expect(added.chapters.map((chapter) => chapter.chapterId)).toEqual([
      "chapter-1",
      "chapter-2",
      "chapter-3",
    ]);
    expect(added.chapters[2]).toMatchObject({
      routeId: "midnight-arcade-route",
      representedDateRange: { startDate: "2027-01-01", endDate: "2028-01-01" },
      recoveredAge: { fromYears: 7, toYears: 8 },
    });
    expect(added.chapters[2]?.level.id).toBe("midnight-arcade-route");
    expect(addedResult.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "encounter.date-eligibility" }),
      ]),
    );

    const duplicated = expectApplied(
      applyLevelEditorCommand(added, {
        type: "chapter.duplicate",
        chapterId: "chapter-3",
        newChapterId: "chapter-4",
        newRouteId: "midnight-arcade-remix",
      }),
    );
    expect(duplicated.chapters[3]?.level.id).toBe("midnight-arcade-remix");
    expect(duplicated.chapters[3]?.level).not.toBe(duplicated.chapters[2]?.level);

    const reordered = expectApplied(
      applyLevelEditorCommand(duplicated, {
        type: "chapter.reorder",
        chapterId: "chapter-4",
        index: 0,
      }),
    );
    expect(reordered.chapters[0]?.chapterId).toBe("chapter-4");

    const removed = expectApplied(
      applyLevelEditorCommand(reordered, {
        type: "chapter.remove",
        chapterId: "chapter-3",
      }),
    );
    expect(removed.chapters.some((chapter) => chapter.chapterId === "chapter-3"))
      .toBe(false);
  });

  it("keeps a multi-command chapter identity failure fully atomic", () => {
    const before = project();
    const result = applyLevelEditorCommands(before, {
      expectedRevision: before.revision,
      commands: [
        {
          type: "chapter.add",
          newChapterId: "chapter-3",
          newRouteId: "new-route",
          sourceTemplateId: "garden-playground-v2",
        },
        {
          type: "chapter.add",
          newChapterId: "chapter-4",
          newRouteId: "new-route",
          sourceTemplateId: "besties-playground-v2",
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.project).toEqual(before);
    expect(result.project.revision).toBe(before.revision);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "route.duplicate-id", commandIndex: 1 }),
      ]),
    );
  });

  it("reports duplicate imported chapter and route ids before resolution", () => {
    const source = project();
    const duplicate = {
      ...source,
      chapters: [
        source.chapters[0]!,
        {
          ...source.chapters[1]!,
          chapterId: source.chapters[0]!.chapterId,
          routeId: source.chapters[0]!.routeId,
          level: {
            ...source.chapters[1]!.level,
            id: source.chapters[0]!.routeId,
          },
        },
      ],
    };

    const issues = validateLevelEditorProject(duplicate);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "chapter.duplicate-id" }),
        expect.objectContaining({ code: "route.duplicate-id" }),
      ]),
    );
    expect(() => resolveLevelEditorProject(duplicate)).toThrow(
      LevelEditorProjectValidationError,
    );
  });

  it("adds and assigns a bounded candidate, rejecting incompatible candidates atomically", () => {
    const before = project();
    const addedResult = applyLevelEditorCommand(before, {
      type: "enemy.add",
      chapterId: "chapter-1",
      slot: "ordinary-1",
      candidate: ordinaryCandidate(),
    });
    const added = expectApplied(addedResult);

    expect(added.enemyCandidates).toEqual([ordinaryCandidate()]);
    expect(added.chapters[0]?.encounterSlots["ordinary-1"]).toEqual({
      source: "candidate",
      candidateId: "party-cloud",
    });
    expect(validateLevelEditorProject(added)).toEqual([]);

    const incompatible = applyLevelEditorCommand(before, {
      type: "enemy.add",
      chapterId: "chapter-1",
      slot: "ordinary-1",
      candidate: ordinaryCandidate({
        id: "wrong-boss",
        role: "boss",
        kind: "boss",
        behaviorPreset: "boss",
      }),
    });
    expect(incompatible.ok).toBe(false);
    expect(incompatible.project).toEqual(before);
    expect(isLevelEditorProjectV2(incompatible.project)).toBe(true);
    if (isLevelEditorProjectV2(incompatible.project))
      expect(incompatible.project.enemyCandidates).toEqual([]);
  });

  it("rejects paused catalog art, URLs and published route reuse", () => {
    expect(LEVEL_EDITOR_PREPARED_ENEMIES.some((entry) => entry.id === "nap-captain"))
      .toBe(false);
    const before = project();
    const paused = applyLevelEditorCommand(before, {
      type: "encounter.assign",
      chapterId: "chapter-2",
      slot: "ordinary-2",
      encounter: {
        source: "catalog",
        catalogEntryId: "nap-captain",
        catalogEntryVersion: "v001",
      },
    });
    expect(paused.ok).toBe(false);
    expect(paused.project).toEqual(before);

    const reusedPausedId = applyLevelEditorCommand(before, {
      type: "enemy.add",
      chapterId: "chapter-1",
      slot: "ordinary-1",
      candidate: ordinaryCandidate({ id: "nap-captain" }),
    });
    expect(reusedPausedId.ok).toBe(false);
    expect(reusedPausedId.project).toEqual(before);

    const urlCandidate = applyLevelEditorCommand(before, {
      type: "enemy.add",
      chapterId: "chapter-1",
      slot: "ordinary-1",
      candidate: ordinaryCandidate({
        id: "remote-model",
        visualJoke: "Load https://example.invalid/model.glb",
      }),
    });
    expect(urlCandidate.ok).toBe(false);
    expect(urlCandidate.project).toEqual(before);

    const publishedRoute = applyLevelEditorCommand(before, {
      type: "chapter.add",
      newChapterId: "chapter-3",
      newRouteId: "garden-playground-v2",
      sourceTemplateId: "garden-playground-v2",
    });
    expect(publishedRoute.ok).toBe(false);
    expect(publishedRoute.project).toEqual(before);
  });

  it("pins every prepared encounter to an exact catalog and artwork version", () => {
    expect(
      LEVEL_EDITOR_PREPARED_ENEMIES.map(
        (entry) => `${entry.id}@${entry.version}:${entry.assetId}@${entry.assetVersion}`,
      ).sort(),
    ).toEqual([
      "mister-hiss@v001:mister-hiss@v001",
      "peel-patrol@v001:peel-patrol@v001",
      "drama-dragon@v001:drama-dragon@v001",
      "sir-flush-a-lot-encore@v001:sir-flush-a-lot@v001",
      "peel-patrol-encore@v001:peel-patrol@v001",
      "drama-dragon-encore@v001:drama-dragon@v001",
      "sir-flush-a-lot-besties@v001:sir-flush-a-lot@v001",
      "peel-patrol-besties@v001:peel-patrol@v001",
      "bickering-besties@v001:bickering-besties@v001",
    ].sort());
  });
});
