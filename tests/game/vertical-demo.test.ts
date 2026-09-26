import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  abilitiesForAge,
  GROWTH_MOVE_IDS,
  type AbilitySet,
  type RequirableGrowthMove,
} from "../../src/shared/abilities";
import {
  applyLevelEditorCommands,
  createWorldEditorProject,
  resolveLevelEditorProject,
  serializeLevelEditorProject,
  type LevelEditorChapterV2,
} from "../../src/shared/editor-project";
import {
  validateAuthoredLevelDocument,
  type ResolvedAuthoredLevel,
} from "../../src/shared/authored-level";
import { STAGES } from "./authored-traversal-lib";
import {
  missGrowthPractice,
  runGrowthRoute,
  traverseGrowthEdge,
} from "./growth-traversal-lib";

const projectSource = readFileSync(
  new URL("../../scripts/levels/examples/vertical-v4-demo.project.json", import.meta.url),
  "utf8",
);
const commands = JSON.parse(
  readFileSync(
    new URL("../../scripts/levels/examples/vertical-v4-demo.commands.json", import.meta.url),
    "utf8",
  ),
);
const resolved = resolveLevelEditorProject(JSON.parse(projectSource));
const chapter = resolved.project.chapters.find(
  (entry) => entry.chapterId === "chapter-2",
) as LevelEditorChapterV2;
const level = resolved.levels[chapter.routeId] as ResolvedAuthoredLevel;
const startAbilities = abilitiesForAge(chapter.recoveredAge.fromYears);

/** The smallest ladder prefix that includes `move`: a branch's declared move and nothing later. */
function abilitiesThrough(move: RequirableGrowthMove): AbilitySet {
  return GROWTH_MOVE_IDS.slice(0, GROWTH_MOVE_IDS.indexOf(move) + 1);
}

const mainPath = level.graph.mainPath;
const mainEdges = level.graph.connections.filter((connection) => {
  const index = mainPath.indexOf(connection.from);
  return index >= 0 && mainPath[index + 1] === connection.to;
});
const branchEdges = level.graph.connections.filter((connection) =>
  level.graph.branches.some((branch) => {
    const index = branch.indexOf(connection.from);
    return index >= 0 && branch[index + 1] === connection.to;
  }),
);

describe("vertical-v4 demo world (DESIGN-025, WO107)", () => {
  it("replays its generated editor commands byte-identically", () => {
    const rebuilt = applyLevelEditorCommands(
      createWorldEditorProject({ projectId: "vertical-v4-demo" }),
      commands,
    );
    expect(rebuilt.ok).toBe(true);
    expect(rebuilt.issues).toEqual([]);
    expect(serializeLevelEditorProject(rebuilt.project)).toBe(projectSource);
  });

  it("opts only the growth chapter into authored-level-v4 and uses every new piece", () => {
    expect(resolved.project.chapters.map((entry) => entry.level.schemaVersion)).toEqual([
      "authored-level-v3",
      "authored-level-v4",
    ]);
    const types = new Set(level.document.pieces.map((piece) => piece.type));
    expect(types.has("lift")).toBe(true);
    expect(types.has("bounce-pad")).toBe(true);
    expect(types.has("crumble")).toBe(true);
    expect(level.document.decor?.length).toBeGreaterThanOrEqual(4);
    // Crumbling platforms stay on optional branches.
    for (const piece of level.document.pieces)
      if (piece.type === "crumble") expect(mainPath).not.toContain(piece.id);
    const required = new Set(mainEdges.map((edge) => edge.requires ?? edge.mode));
    expect(required).toEqual(
      new Set(["high-jump", "double-jump", "walk", "bounce", "ride", "jump"]),
    );
    expect(startAbilities).toEqual(["jump", "high-jump", "double-jump"]);
  });

  describe.each(STAGES)("%s avatar", (stage) => {
    it.each(mainEdges.map((edge) => [`${edge.from}->${edge.to}`, edge] as const))(
      "crosses required edge %s with start-age moves only",
      (_label, edge) => {
        const result = traverseGrowthEdge(level, edge, stage, startAbilities);
        expect(result.startedOnSource).toBe(true);
        expect(result.recovered).toBe(false);
        expect(result.reached).toBe(true);
      },
    );

    it.each(branchEdges.map((edge) => [`${edge.from}->${edge.to}`, edge] as const))(
      "crosses branch edge %s with its declared move",
      (_label, edge) => {
        const abilities = edge.requires ? abilitiesThrough(edge.requires) : startAbilities;
        const result = traverseGrowthEdge(level, edge, stage, abilities);
        expect(result.startedOnSource).toBe(true);
        expect(result.reached).toBe(true);
      },
    );

    it.each(
      mainEdges
        .filter((edge) => edge.safeMissPlatformId)
        .map((edge) => [`${edge.from}->${edge.to}`, edge] as const),
    )("misses practice jump %s onto its catch floor", (_label, edge) => {
      const result = missGrowthPractice(level, edge, stage, startAbilities);
      expect(result.startedOnSource).toBe(true);
      expect(result.airborne).toBe(true);
      expect(result.recovered).toBe(false);
      expect(result.reached).toBe(true);
    });
  });

  it("needs each declared move", () => {
    // The high jump is physically within a plain jump's apex; the validator's
    // forgiving 0.35 m plain-jump limit is what makes it a growth move.
    const withoutRequires = {
      ...level.document,
      connections: level.document.connections.map(({ requires: _requires, ...rest }) => rest),
    };
    expect(
      validateAuthoredLevelDocument(withoutRequires)
        .filter((entry) => entry.code === "connection.rise")
        .map((entry) => entry.path),
    ).toEqual(
      level.document.connections.flatMap((connection, index) =>
        connection.requires ? [`$.connections[${index}]`] : [],
      ),
    );
    // The double jump is physically out of reach with the high jump alone.
    const doubleJump = mainEdges.find((edge) => edge.requires === "double-jump")!;
    expect(traverseGrowthEdge(level, doubleJump, "child", abilitiesForAge(2)).reached).toBe(false);
    expect(traverseGrowthEdge(level, doubleJump, "child", abilitiesForAge(4)).reached).toBe(true);
  });

  it("climbs the whole vertical section in one uninterrupted run", () => {
    const section = mainPath.slice(0, mainPath.indexOf("party-picnic") + 1);
    const run = runGrowthRoute(level, section, "child", startAbilities);
    expect(run.failedAt).toBeNull();
    expect(run.recoveries).toBe(0);
    expect(run.bounces).toContain("spring-pad");
    expect(run.completed).toHaveLength(section.length - 1);
    // The climb reaches the 4 m sky balcony before the lift carries it down.
    expect(run.maxFeetY).toBeGreaterThanOrEqual(4 - 1e-6);
  });
});
