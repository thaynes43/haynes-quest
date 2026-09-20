import { describe, expect, it } from "vitest";

import { resolveAuthoredLevelDocument } from "../../src/shared/authored-level";
import {
  LEVEL_EDITOR_CHAPTER_IDS,
  LEVEL_EDITOR_LEVEL_MAX_BYTES,
  LEVEL_EDITOR_PROJECT_SCHEMA_VERSION,
  LEVEL_EDITOR_PROJECT_MAX_BYTES,
  LEVEL_EDITOR_TEMPLATE_ROUTE_IDS,
  applyLevelEditorCommand,
  applyLevelEditorCommands,
  canonicalLevelEditorProjectJson,
  createLevelEditorProject,
  parseLevelEditorProject,
  parseLevelEditorProjectJson,
  rebaseLevelEditorProject,
  resolveLevelEditorProject,
  serializeLevelEditorProject,
} from "../../src/shared/editor-project";
import bestiesPlayground from "../../src/shared/levels/besties-playground-v2.json";
import gardenPlayground from "../../src/shared/levels/garden-playground-v2.json";

type EditorProject = ReturnType<typeof createLevelEditorProject>;
type Position = Readonly<{ x: number; y: number; z: number }>;
type Arena = Readonly<{
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}>;
type MutableLargeProject = {
  chapters: Array<{
    level: {
      pieces: Array<Record<string, unknown>>;
      connections: Array<Record<string, unknown>>;
      mainPath: string[];
      branches: string[][];
    };
  }>;
};

function project(): EditorProject {
  return createLevelEditorProject({
    projectId: "editor-project-test",
    name: "Test adventure",
  });
}

function chapter(source: EditorProject, chapterId: "chapter-1" | "chapter-2") {
  const found = source.chapters.find((entry) => entry.chapterId === chapterId);
  if (!found) throw new Error(`Missing ${chapterId}`);
  return found;
}

function applied(result: ReturnType<typeof applyLevelEditorCommands>) {
  expect(result.ok, JSON.stringify(result.issues, null, 2)).toBe(true);
  if (!result.ok) throw new Error("Expected the editor command to apply");
  return result;
}

function shifted(position: Position, delta: Position): Position {
  return {
    x: position.x + delta.x,
    y: position.y + delta.y,
    z: position.z + delta.z,
  };
}

function shiftedArena(arena: Arena, delta: Position): Arena {
  return {
    minX: arena.minX + delta.x,
    maxX: arena.maxX + delta.x,
    minZ: arena.minZ + delta.z,
    maxZ: arena.maxZ + delta.z,
  };
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function paddedId(prefix: string): string {
  return `${prefix}${"x".repeat(80 - prefix.length)}`;
}

describe("shared level editor projects", () => {
  it("creates frozen two-chapter templates with exact authored v2 parity", () => {
    expect(LEVEL_EDITOR_PROJECT_SCHEMA_VERSION).toBe("level-editor-project-v1");
    expect(LEVEL_EDITOR_CHAPTER_IDS).toEqual(["chapter-1", "chapter-2"]);
    expect(LEVEL_EDITOR_TEMPLATE_ROUTE_IDS).toEqual([
      "garden-playground-v2",
      "besties-playground-v2",
    ]);

    const template = project();
    expect(template.chapters.map(({ chapterId, templateRouteId }) => ({
      chapterId,
      templateRouteId,
    }))).toEqual([
      { chapterId: "chapter-1", templateRouteId: "garden-playground-v2" },
      { chapterId: "chapter-2", templateRouteId: "besties-playground-v2" },
    ]);
    expect(chapter(template, "chapter-1").level).toEqual(gardenPlayground);
    expect(chapter(template, "chapter-2").level).toEqual(bestiesPlayground);

    const resolved = resolveLevelEditorProject(template);
    const expectedGarden = resolveAuthoredLevelDocument(gardenPlayground);
    const expectedBesties = resolveAuthoredLevelDocument(bestiesPlayground);
    expect(resolved.levels["garden-playground-v2"]).toEqual(expectedGarden);
    expect(resolved.levels["besties-playground-v2"]).toEqual(expectedBesties);
    expect(Object.isFrozen(template)).toBe(true);
    expect(Object.isFrozen(template.chapters[0].level.pieces)).toBe(true);
    expect(Object.isFrozen(resolved.levels)).toBe(true);
  });

  it("round-trips frozen projects through deterministic readable and canonical JSON", () => {
    const template = project();
    const readable = serializeLevelEditorProject(template);
    const canonical = canonicalLevelEditorProjectJson(template);
    const parsedFromText = parseLevelEditorProjectJson(readable);
    const parsedFromValue = parseLevelEditorProject(JSON.parse(readable));

    expect(readable.endsWith("\n")).toBe(true);
    expect(readable).toContain("\n  \"schemaVersion\"");
    expect(canonical).not.toContain("\n");
    expect(parsedFromText).toEqual(template);
    expect(parsedFromValue).toEqual(template);
    expect(serializeLevelEditorProject(parsedFromText)).toBe(readable);
    expect(canonicalLevelEditorProjectJson(parsedFromText)).toBe(canonical);
    expect(Object.isFrozen(parsedFromText)).toBe(true);
    expect(Object.isFrozen(parsedFromText.chapters[0].level.anchors)).toBe(true);
    expect(() => {
      (parsedFromText as unknown as { name: string }).name = "mutated";
    }).toThrow(TypeError);
  });

  it("keeps near-limit readable exports within the same bounds used for reimport", () => {
    const raw = JSON.parse(
      serializeLevelEditorProject(project()),
    ) as MutableLargeProject;
    const levelTarget = LEVEL_EDITOR_LEVEL_MAX_BYTES - 2_048;

    raw.chapters.forEach((entry, chapterIndex) => {
      const { level } = entry;
      const withinTarget = () =>
        utf8Length(JSON.stringify(level, null, 2)) <= levelTarget;

      while (level.pieces.length < 168) {
        const index = level.pieces.length;
        level.pieces.push({
          type: "platform",
          id: paddedId(`p${chapterIndex}${index.toString(36)}`),
          center: { x: 20, y: -0.3, z: 20 },
          size: { x: 2, y: 0.6, z: 2 },
        });
        if (!withinTarget()) {
          level.pieces.pop();
          break;
        }
      }

      while (level.connections.length < 192) {
        const index = level.connections.length;
        level.connections.push({
          from: paddedId(`f${chapterIndex}${index.toString(36)}`),
          to: paddedId(`t${chapterIndex}${index.toString(36)}`),
          mode: "jump",
          safeMissPlatformId: paddedId(`s${chapterIndex}${index.toString(36)}`),
        });
        if (!withinTarget()) {
          level.connections.pop();
          break;
        }
      }

      const previousMainPath = level.mainPath;
      level.mainPath = Array.from({ length: 96 }, (_, index) =>
        paddedId(`m${chapterIndex}${index.toString(36)}`),
      );
      if (!withinTarget()) level.mainPath = previousMainPath;

      while (level.branches.length < 12) {
        const branchIndex = level.branches.length;
        level.branches.push(
          Array.from({ length: 48 }, (_, index) =>
            paddedId(
              `b${chapterIndex}${branchIndex.toString(36)}${index.toString(36)}`,
            ),
          ),
        );
        if (!withinTarget()) {
          level.branches.pop();
          break;
        }
      }

      expect(utf8Length(JSON.stringify(level, null, 2))).toBeGreaterThan(
        LEVEL_EDITOR_LEVEL_MAX_BYTES * 0.9,
      );
    });

    const parsed = parseLevelEditorProject(raw);
    const readable = serializeLevelEditorProject(parsed);
    expect(utf8Length(readable)).toBeLessThanOrEqual(
      LEVEL_EDITOR_PROJECT_MAX_BYTES,
    );
    expect(utf8Length(readable)).toBeGreaterThan(
      LEVEL_EDITOR_LEVEL_MAX_BYTES * 1.8,
    );
    expect(parseLevelEditorProjectJson(readable)).toEqual(parsed);
  });

  it("keeps semantically invalid edits but rejects structurally invalid batches atomically", () => {
    const template = project();
    const firstConnection = chapter(template, "chapter-1").level.connections[0];
    if (!firstConnection) throw new Error("Garden template has no connections");

    const semantic = applied(
      applyLevelEditorCommands(template, {
        expectedRevision: 0,
        commands: [
          {
            type: "connection.remove",
            chapterId: "chapter-1",
            match: {
              from: firstConnection.from,
              to: firstConnection.to,
              mode: firstConnection.mode,
            },
          },
        ],
      }),
    );
    expect(semantic.project.revision).toBe(1);
    expect(semantic.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "semantic",
          code: "graph.missing-connection",
        }),
      ]),
    );

    const structural = applyLevelEditorCommands(template, {
      expectedRevision: 0,
      commands: [
        { type: "project.rename", name: "Must roll back" },
        {
          type: "piece.add",
          chapterId: "chapter-1",
          piece: { type: "platform", id: "incomplete" },
        },
      ],
    } as Parameters<typeof applyLevelEditorCommands>[1]);
    expect(structural.ok).toBe(false);
    expect(structural.project).toEqual(template);
    expect(structural.project.revision).toBe(0);
    expect(structural.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "command", commandIndex: 1 }),
      ]),
    );
  });

  it("includes editor-only gameplay guards in prefixed semantic issues", () => {
    const template = project();
    const bestiesCourt = chapter(template, "chapter-2").level.pieces.find(
      (piece) => piece.id === "besties-court",
    );
    if (bestiesCourt?.type !== "platform")
      throw new Error("Besties court fixture is missing");

    const narrowed = applied(
      applyLevelEditorCommand(template, {
        type: "piece.update",
        chapterId: "chapter-2",
        pieceId: bestiesCourt.id,
        piece: {
          ...bestiesCourt,
          size: { ...bestiesCourt.size, x: 13.19 },
        },
      }),
    );
    expect(narrowed.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "semantic",
          code: "besties.support-footprint",
          path: '$.chapters[1].level.anchors.encounters["boss"].position',
        }),
      ]),
    );
  });

  it("resolves an added optional v2 platform without topology edits", () => {
    const template = project();
    const original = chapter(template, "chapter-1").level;
    const added = applied(
      applyLevelEditorCommand(template, {
        type: "piece.add",
        chapterId: "chapter-1",
        piece: {
          type: "platform",
          id: "optional-platform",
          center: { x: 24, y: 0.3, z: -10 },
          size: { x: 4, y: 0.6, z: 4 },
        },
      }),
    );
    const updated = chapter(added.project, "chapter-1").level;

    expect(added.issues).toEqual([]);
    expect(updated.connections).toEqual(original.connections);
    expect(updated.mainPath).toEqual(original.mainPath);
    expect(updated.branches).toEqual(original.branches);

    const preview = resolveLevelEditorProject(added.project);
    expect(
      preview.levels["garden-playground-v2"].course.platforms.some(
        ({ id }) => id === "optional-platform",
      ),
    ).toBe(true);
  });

  it("carries supported checkpoints, anchors and encounter arenas with platform edits", () => {
    const template = project();
    const before = chapter(template, "chapter-1").level;
    const picnic = before.pieces.find((piece) => piece.id === "picnic");
    const checkpoint = before.pieces.find((piece) => piece.id === "picnic-safe");
    if (picnic?.type !== "platform" || checkpoint?.type !== "checkpoint")
      throw new Error("Garden picnic fixtures are missing");

    const delta = { x: 0.25, y: 0, z: 0.25 } as const;
    const moved = applied(
      applyLevelEditorCommands(template, {
        expectedRevision: 0,
        commands: [
          {
            type: "piece.move",
            chapterId: "chapter-1",
            pieceId: "picnic",
            position: shifted(picnic.center, delta),
          },
        ],
      }),
    );
    const after = chapter(moved.project, "chapter-1").level;
    const movedCheckpoint = after.pieces.find(
      (piece) => piece.id === "picnic-safe",
    );
    if (movedCheckpoint?.type !== "checkpoint")
      throw new Error("Moved picnic checkpoint is missing");
    expect(movedCheckpoint).toMatchObject({
      position: shifted(checkpoint.position, delta),
      platformId: "picnic",
    });
    expect(after.anchors.pickups["guard-tool"].position).toEqual(
      shifted(before.anchors.pickups["guard-tool"].position, delta),
    );
    expect(after.anchors.memories["minor-one"].position).toEqual(
      shifted(before.anchors.memories["minor-one"].position, delta),
    );
    expect(after.anchors.encounters["ordinary-1"].position).toEqual(
      shifted(before.anchors.encounters["ordinary-1"].position, delta),
    );
    expect(after.anchors.encounters["ordinary-1"].arena).toEqual(
      shiftedArena(before.anchors.encounters["ordinary-1"].arena, delta),
    );
    expect(after.anchors.spawn).toEqual(before.anchors.spawn);

    const movedPicnic = after.pieces.find((piece) => piece.id === "picnic");
    if (movedPicnic?.type !== "platform")
      throw new Error("Moved picnic platform is missing");
    const withoutCarry = applied(
      applyLevelEditorCommand(moved.project, {
        type: "piece.move",
        chapterId: "chapter-1",
        pieceId: "picnic",
        position: shifted(movedPicnic.center, { x: 0.1, y: 0, z: 0.1 }),
        carryAttached: false,
      }),
    );
    const withoutCarryLevel = chapter(
      withoutCarry.project,
      "chapter-1",
    ).level;
    expect(
      withoutCarryLevel.pieces.find((piece) => piece.id === "picnic-safe"),
    ).toMatchObject({ position: movedCheckpoint.position });
    expect(withoutCarryLevel.anchors.memories["minor-one"]).toEqual(
      after.anchors.memories["minor-one"],
    );

    const encounterBefore = after.anchors.encounters["ordinary-1"];
    const anchorDelta = { x: 0.1, y: 0, z: 0.1 } as const;
    const anchorMoved = applyLevelEditorCommand(moved.project, {
      type: "anchor.move",
      chapterId: "chapter-1",
      slot: "encounter.ordinary-1",
      position: shifted(encounterBefore.position, anchorDelta),
      carryArena: true,
    });
    const anchored = applied(anchorMoved);
    expect(
      chapter(anchored.project, "chapter-1").level.anchors.encounters[
        "ordinary-1"
      ],
    ).toMatchObject({
      position: shifted(encounterBefore.position, anchorDelta),
      arena: shiftedArena(encounterBefore.arena, anchorDelta),
    });
  });

  it("preserves piece order through add, update, duplicate and targeted removal", () => {
    const template = project();
    const originalIds = chapter(template, "chapter-1").level.pieces.map(
      ({ id }) => id,
    );
    const added = applied(
      applyLevelEditorCommand(template, {
        type: "piece.add",
        chapterId: "chapter-1",
        piece: {
          type: "platform",
          id: "editor-pad",
          center: { x: 20, y: -0.3, z: 20 },
          size: { x: 4, y: 0.6, z: 4 },
        },
      }),
    );
    expect(chapter(added.project, "chapter-1").level.pieces.map(({ id }) => id))
      .toEqual([...originalIds, "editor-pad"]);
    expect(added.project.revision).toBe(1);

    const addedPiece = chapter(added.project, "chapter-1").level.pieces.at(-1);
    if (addedPiece?.type !== "platform")
      throw new Error("Added editor platform is missing");
    const updated = applied(
      applyLevelEditorCommand(added.project, {
        type: "piece.update",
        chapterId: "chapter-1",
        pieceId: "editor-pad",
        piece: { ...addedPiece, size: { x: 6, y: 0.6, z: 5 } },
      }),
    );
    const updatedPieces = chapter(updated.project, "chapter-1").level.pieces;
    expect(updatedPieces.map(({ id }) => id)).toEqual([
      ...originalIds,
      "editor-pad",
    ]);
    expect(updatedPieces.at(-1)).toMatchObject({
      id: "editor-pad",
      size: { x: 6, y: 0.6, z: 5 },
    });

    const duplicatedByDefault = applied(
      applyLevelEditorCommand(updated.project, {
        type: "piece.duplicate",
        chapterId: "chapter-1",
        pieceId: "editor-pad",
        newPieceId: "editor-pad-default-copy",
      }),
    );
    expect(
      chapter(duplicatedByDefault.project, "chapter-1").level.pieces.at(-1),
    ).toMatchObject({
      id: "editor-pad-default-copy",
      center: { x: 21, y: -0.3, z: 21 },
    });

    const duplicatedWithOffset = applied(
      applyLevelEditorCommand(duplicatedByDefault.project, {
        type: "piece.duplicate",
        chapterId: "chapter-1",
        pieceId: "editor-pad",
        newPieceId: "editor-pad-offset-copy",
        offset: { x: -2, y: 0.5, z: 3 },
      }),
    );
    expect(
      chapter(duplicatedWithOffset.project, "chapter-1").level.pieces.at(-1),
    ).toMatchObject({
      id: "editor-pad-offset-copy",
      center: { x: 18, y: 0.2, z: 23 },
    });

    const removed = applied(
      applyLevelEditorCommand(duplicatedWithOffset.project, {
        type: "piece.remove",
        chapterId: "chapter-1",
        pieceId: "editor-pad-default-copy",
      }),
    );
    expect(chapter(removed.project, "chapter-1").level.pieces.map(({ id }) => id))
      .toEqual([...originalIds, "editor-pad", "editor-pad-offset-copy"]);
    expect(removed.project.revision).toBe(5);
  });

  it("renames platform and checkpoint references without changing their meaning", () => {
    const renamed = applied(
      applyLevelEditorCommands(project(), {
        expectedRevision: 0,
        commands: [
          {
            type: "piece.rename",
            chapterId: "chapter-1",
            pieceId: "picnic",
            newPieceId: "picnic-remix",
          },
          {
            type: "piece.rename",
            chapterId: "chapter-1",
            pieceId: "picnic-safe",
            newPieceId: "picnic-remix-safe",
          },
        ],
      }),
    );
    const level = chapter(renamed.project, "chapter-1").level;

    expect(level.pieces.some((piece) => piece.id === "picnic-remix")).toBe(true);
    expect(level.pieces).toContainEqual(
      expect.objectContaining({
        id: "picnic-remix-safe",
        platformId: "picnic-remix",
      }),
    );
    expect(level.connections.some(
      ({ from, to }) => from === "picnic-remix" || to === "picnic-remix",
    )).toBe(true);
    expect(level.connections.some(
      ({ from, to }) => from === "picnic" || to === "picnic",
    )).toBe(false);
    expect(level.mainPath).toContain("picnic-remix");
    expect(level.mainPath).not.toContain("picnic");
    expect(level.anchors.pickups["guard-tool"].platformId).toBe("picnic-remix");
    expect(level.anchors.memories["minor-one"].platformId).toBe("picnic-remix");
    expect(level.anchors.encounters["ordinary-1"]).toMatchObject({
      platformId: "picnic-remix",
      checkpointId: "picnic-remix-safe",
    });
    expect(renamed.issues).toEqual([]);
  });

  it("applies connection, main-path and branch commands as one graph transaction", () => {
    const template = project();
    const original = chapter(template, "chapter-1").level;
    const edited = applied(
      applyLevelEditorCommands(template, {
        expectedRevision: 0,
        commands: [
          {
            type: "connection.add",
            chapterId: "chapter-1",
            connection: {
              from: "welcome",
              to: "garden-hop-2",
              mode: "jump",
            },
          },
          {
            type: "connection.update",
            chapterId: "chapter-1",
            match: { from: "welcome", to: "garden-hop-2", mode: "jump" },
            connection: {
              from: "welcome",
              to: "garden-hop-2",
              mode: "walk",
            },
          },
          {
            type: "connection.remove",
            chapterId: "chapter-1",
            match: { from: "welcome", to: "garden-hop-2", mode: "walk" },
          },
          {
            type: "main-path.set",
            chapterId: "chapter-1",
            platformIds: [...original.mainPath],
          },
          {
            type: "branch.add",
            chapterId: "chapter-1",
            platformIds: ["welcome", "garden-hop-1", "garden-hop-2"],
            index: 0,
          },
          {
            type: "branch.update",
            chapterId: "chapter-1",
            index: 0,
            platformIds: ["welcome", "garden-hop-1", "garden-hop-2"],
          },
          { type: "branch.remove", chapterId: "chapter-1", index: 0 },
        ],
      }),
    );
    const finalLevel = chapter(edited.project, "chapter-1").level;
    expect(finalLevel.connections).toEqual(original.connections);
    expect(finalLevel.mainPath).toEqual(original.mainPath);
    expect(finalLevel.branches).toEqual(original.branches);
    expect(edited.project.revision).toBe(1);
    expect(edited.issues).toEqual([]);
  });

  it("repairs duplicate connections by index without retargeting stale rows", () => {
    const template = project();
    const original = chapter(template, "chapter-1").level;
    const connection = original.connections[0];
    if (!connection) throw new Error("Garden template has no connections");
    const duplicateIndex = original.connections.length;
    const match = {
      index: duplicateIndex,
      from: connection.from,
      to: connection.to,
      mode: connection.mode,
    } as const;

    const duplicated = applied(
      applyLevelEditorCommand(template, {
        type: "connection.add",
        chapterId: "chapter-1",
        connection,
      }),
    );
    expect(duplicated.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ source: "semantic" })]),
    );

    const ambiguous = applyLevelEditorCommand(duplicated.project, {
      type: "connection.remove",
      chapterId: "chapter-1",
      match: {
        from: connection.from,
        to: connection.to,
        mode: connection.mode,
      },
    });
    expect(ambiguous).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: "connection.ambiguous" })],
    });
    expect(ambiguous.project).toEqual(duplicated.project);
    expect(ambiguous.project.revision).toBe(duplicated.project.revision);

    const replacement = { ...connection, mode: "walk" as const };
    const updated = applied(
      applyLevelEditorCommand(duplicated.project, {
        type: "connection.update",
        chapterId: "chapter-1",
        match,
        connection: replacement,
      }),
    );
    const updatedConnections = chapter(updated.project, "chapter-1").level
      .connections;
    expect(updatedConnections.slice(0, duplicateIndex)).toEqual(
      original.connections,
    );
    expect(updatedConnections[duplicateIndex]).toEqual(replacement);

    const stale = applyLevelEditorCommand(updated.project, {
      type: "connection.remove",
      chapterId: "chapter-1",
      match,
    });
    expect(stale).toMatchObject({
      ok: false,
      issues: [
        expect.objectContaining({
          path: "$.commands[0].match.index",
          code: "connection.stale",
        }),
      ],
    });
    expect(stale.project).toEqual(updated.project);
    expect(stale.project.revision).toBe(updated.project.revision);

    const repaired = applied(
      applyLevelEditorCommand(updated.project, {
        type: "connection.remove",
        chapterId: "chapter-1",
        match: { ...match, mode: replacement.mode },
      }),
    );
    expect(chapter(repaired.project, "chapter-1").level.connections).toEqual(
      original.connections,
    );
    expect(repaired.issues).toEqual([]);
  });

  it("rejects revision conflicts and oversized batches without partial changes", () => {
    const template = project();
    const conflict = applyLevelEditorCommands(template, {
      expectedRevision: 7,
      commands: [{ type: "project.rename", name: "Stale edit" }],
    });
    expect(conflict.ok).toBe(false);
    expect(conflict.project).toEqual(template);
    expect(conflict.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "command", code: "revision.conflict" }),
      ]),
    );

    const oversized = applyLevelEditorCommands(template, {
      expectedRevision: 0,
      commands: Array.from({ length: 257 }, (_, index) => ({
        type: "project.rename" as const,
        name: `Edit ${index}`,
      })),
    });
    expect(oversized.ok).toBe(false);
    expect(oversized.project).toEqual(template);
    expect(oversized.project.revision).toBe(0);
    expect(oversized.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ source: "command" })]),
    );
  });

  it("rebases immutable snapshots without changing their authored content", () => {
    const edited = applied(
      applyLevelEditorCommands(project(), {
        expectedRevision: 0,
        commands: [
          { type: "project.rename", name: "Rebased adventure" },
          {
            type: "chapter.rename",
            chapterId: "chapter-2",
            name: "Besties remix",
          },
        ],
      }),
    ).project;
    const rebased = rebaseLevelEditorProject(edited, 41);

    expect(rebased).toEqual({ ...edited, revision: 41 });
    expect(edited.revision).toBe(1);
    expect(Object.isFrozen(rebased)).toBe(true);
    expect(Object.isFrozen(rebased.chapters[1].level.pieces)).toBe(true);
  });

});
