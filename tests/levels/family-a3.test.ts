/**
 * World A, chapter three ("Hero City", PLAN-019): the generated level must be
 * valid, kind to a small child, and play the way its generator claims.
 *
 * (a) Real validators: the document alone, its growth rules with and without
 *     the previous chapter, and the chapter inside a World A shell with the
 *     WORLD-SPEC fictional birth date and its own dates, ages and cast.
 * (b) The World A family lints (R1–R6).
 * (c) The patient scripted kid crosses the whole required route with only
 *     the moves unlocked at age 5, with no recovery, in at least 70 s (R10).
 * (d) Every bounce works from a walk at analog stick 0.4–1.0 (R2), and the
 *     opening elevator either carries or safely drops a child who walks at it.
 * (e) Every required and branch edge crosses with its move; every practice
 *     or catch-net miss lands on its catch floor; each required double jump
 *     really needs the double jump.
 * (f) The required route climbs and peaks exactly as claimed (15 m, below
 *     A4's 16 m finale).
 *
 * Everything here is synthetic: a fictional birth date and invented
 * preview-memory captions.
 */
import { describe, expect, it } from "vitest";
import {
  abilitiesForAge,
  GROWTH_MOVE_IDS,
  type AbilitySet,
  type RequirableGrowthMove,
} from "../../src/shared/abilities";
import {
  AUTHORED_LEVEL_LIMITS,
  AUTHORED_LEVEL_V4_LIMITS,
  authoredSurfaceTopRange,
  isAuthoredSurfacePiece,
  resolveAuthoredLevelDocument,
  validateAuthoredLevelDocument,
  type AuthoredConnection,
  type AuthoredSurfacePiece,
} from "../../src/shared/authored-level";
import { validateGrowthRequirements } from "../../src/shared/authored-level-growth";
import {
  applyLevelEditorCommands,
  createWorldEditorProject,
  LEVEL_EDITOR_LEVEL_MAX_BYTES,
  LEVEL_EDITOR_PROJECT_MAX_BYTES,
  serializeLevelEditorProject,
  validateLevelEditorProject,
  type LevelEditorCommand,
  type LevelEditorProjectV2,
} from "../../src/shared/editor-project";
import {
  bossRetryRoute,
  FAMILY_WORLD_LINT_PRESETS,
  lintCameraHeadings,
  lintFamilyChapter,
} from "../../src/shared/family-world-lint";
import { placeableThemeKitProps, themeKitProp } from "../../src/shared/theme-kits";
import { planCasinoCollectibles } from "../../src/game/casino-tokens";
import {
  FAMILY_A3_AGES,
  FAMILY_A3_CAST,
  FAMILY_A3_CLAIMS,
  FAMILY_A3_DECOR_LIMIT,
  FAMILY_A3_ROUTE_ID,
  FAMILY_A3_THEME,
  familyA3CastCommands,
  familyA3Level,
} from "../../scripts/levels/family/a3";
import {
  chapterCommands,
  worldShellCommands,
  type WorldShellChapter,
} from "../../scripts/levels/lib/growth-kit";
import { STAGES } from "../game/authored-traversal-lib";
import { missGrowthPractice, traverseGrowthEdge } from "../game/growth-traversal-lib";
import {
  bounceWalkOn,
  liftWalkIn,
  R2_STICKS,
  runGrowthRouteWithWaits,
} from "../game/family-kid-lib";
import { fixtureCandidate } from "../family-world-fixtures";

// WORLD-SPEC World A: fictional birth date and this chapter's band (5 → 9).
const BIRTH = "2015-01-15";
const A3_CHAPTER: WorldShellChapter = {
  chapterId: "family-a3",
  routeId: FAMILY_A3_ROUTE_ID,
  name: "Hero City",
  subtitle: "Rooftops above the city",
  description: "Leap between rooftops, bounce off the vents and stop the monster-inator.",
  theme: FAMILY_A3_THEME,
  representedDateRange: { startDate: "2020-01-15", endDate: "2024-01-15" },
  recoveredAge: { ...FAMILY_A3_AGES },
  previewMemories: [
    { slotId: "minor-one", date: "2021-06-12", label: "Rooftop picnic" },
    { slotId: "minor-two", date: "2022-10-08", label: "City lights" },
    { slotId: "major", date: "2024-01-15", label: "Turning 9!" },
  ],
};

/** Stand-ins for chapters one and two (their levels stay the shell's template). */
const EARLIER_CHAPTERS: readonly WorldShellChapter[] = [
  {
    chapterId: "family-a1",
    routeId: "family-a1-stand-in",
    name: "The Toon Clubhouse",
    subtitle: "Gadgets on the loose",
    description: "A stand-in first chapter so chapter three starts at age 5.",
    theme: "clubhouse",
    representedDateRange: { startDate: BIRTH, endDate: "2017-01-15" },
    recoveredAge: { fromYears: 0, toYears: 2 },
    previewMemories: [
      { slotId: "minor-one", date: "2015-09-01", label: "Summer picnic" },
      { slotId: "minor-two", date: "2016-05-01", label: "A sunny afternoon" },
      { slotId: "major", date: "2017-01-15", label: "Turning 2!" },
    ],
  },
  {
    chapterId: "family-a2",
    routeId: "family-a2-stand-in",
    name: "Harbor Rescue",
    subtitle: "Boats, rooftops and a lookout",
    description: "A stand-in second chapter whose start age makes the double jump new in chapter three.",
    theme: "harbor",
    representedDateRange: { startDate: "2017-01-15", endDate: "2020-01-15" },
    recoveredAge: { fromYears: 2, toYears: 5 },
    previewMemories: [
      { slotId: "minor-one", date: "2018-02-01", label: "A day at the docks" },
      { slotId: "minor-two", date: "2019-03-01", label: "A brave rescue" },
      { slotId: "major", date: "2020-01-15", label: "Turning 5!" },
    ],
  },
];

function stubCast(chapterId: string, period: "toon-clubhouse-v1" | "rescue-harbor-v1"): LevelEditorCommand[] {
  const chapter = chapterCommands(chapterId);
  const window = { startDate: "2006-05-05", endDate: "2026-12-31" };
  const a = fixtureCandidate(`${chapterId}-grunt-a`, "Stand-in Grunt", period, "ordinary-a", window);
  const b = fixtureCandidate(`${chapterId}-grunt-b`, "Stand-in Robot", period, "ordinary-b", window);
  const boss = fixtureCandidate(`${chapterId}-boss`, "Stand-in Boss", period, "boss", window);
  return [
    chapter.addCandidate("ordinary-1", a),
    chapter.addCandidate("ordinary-2", b),
    chapter.assign("ordinary-3", { source: "candidate", candidateId: a.id }),
    chapter.assign("ordinary-4", { source: "candidate", candidateId: b.id }),
    chapter.addCandidate("boss", boss),
  ];
}

function applyWorld(chapters: readonly WorldShellChapter[], extra: readonly LevelEditorCommand[]) {
  return applyLevelEditorCommands(
    createWorldEditorProject({ projectId: "family-a3-check", catalogVersion: "parody-catalog-v7" }),
    {
      expectedRevision: 0,
      commands: [
        ...worldShellCommands({ name: "World A check", fictionalBirthDate: BIRTH, chapters }),
        chapterCommands(A3_CHAPTER.chapterId).replaceLevel(familyA3Level()),
        ...familyA3CastCommands(A3_CHAPTER.chapterId),
        ...extra,
      ],
    },
  );
}

const document = familyA3Level();
const level = resolveAuthoredLevelDocument(document);
const startAbilities = abilitiesForAge(FAMILY_A3_AGES.fromYears);
const mainPath = level.graph.mainPath;
const surfaces = new Map(
  document.pieces.filter(isAuthoredSurfacePiece).map((piece) => [piece.id, piece as AuthoredSurfacePiece]),
);

function step(path: readonly string[], connection: AuthoredConnection): boolean {
  const index = path.indexOf(connection.from);
  return index >= 0 && path[index + 1] === connection.to;
}
const mainEdges = level.graph.connections.filter((connection) => step(mainPath, connection));
const branchEdges = level.graph.connections.filter((connection) =>
  level.graph.branches.some((branch) => step(branch, connection)),
);
const label = (edge: AuthoredConnection) => `${edge.from}->${edge.to}`;

/** The smallest ladder prefix that includes `move`: a branch's declared move and nothing later. */
function abilitiesThrough(move: RequirableGrowthMove): AbilitySet {
  return GROWTH_MOVE_IDS.slice(0, GROWTH_MOVE_IDS.indexOf(move) + 1);
}

describe("family A3 generator", () => {
  it("is pure and deterministic, with the chapter's id, theme and schema", () => {
    expect(familyA3Level()).toEqual(document);
    expect(familyA3Level()).not.toBe(document);
    expect(document.schemaVersion).toBe("authored-level-v4");
    expect(document.id).toBe("family-a3-rooftop");
    expect(document.theme).toBe("rooftop");
    expect(startAbilities).toEqual(["jump", "high-jump", "double-jump"]);
    expect(Buffer.byteLength(JSON.stringify(document))).toBeLessThan(LEVEL_EDITOR_LEVEL_MAX_BYTES / 2);
  });

  it("defines every anchor, with R11's two ordinary identities and a bonus robot", () => {
    const encounters = document.anchors.encounters;
    expect(
      Object.fromEntries(Object.entries(encounters).map(([slot, anchor]) => [slot, anchor!.kind])),
    ).toEqual({
      "ordinary-1": "ordinary-a",
      "ordinary-2": "ordinary-b",
      "ordinary-3": "ordinary-a",
      "ordinary-4": "ordinary-b",
      boss: "boss",
      "bonus-1": "ordinary-b",
    });
    expect(Object.keys(document.anchors.friendlies).sort()).toEqual(["friendly-1", "friendly-2", "friendly-3"]);
    expect(Object.keys(document.anchors.memories).sort()).toEqual(["major", "minor-one", "minor-two"]);
    expect(document.anchors.spawn.platformId).toBe(mainPath[0]);
    expect(FAMILY_A3_CAST.puttyGrunt.kind).toBe("ordinary-a");
    expect(FAMILY_A3_CAST.labRobot.kind).toBe("ordinary-b");
    expect(FAMILY_A3_CAST.inatorMonster.kind).toBe("boss");
  });

  it("opens with an elevator, uses one lift and never reaches the boss by lift (R9)", () => {
    expect(mainPath.slice(0, 3)).toEqual(["launch-deck", "freight-elevator", "elevator-roof"]);
    expect(surfaces.get("freight-elevator")!.type).toBe("lift");
    expect(document.pieces.filter((piece) => piece.type === "lift")).toHaveLength(1);
    const boss = mainPath.indexOf(document.anchors.encounters.boss.platformId);
    expect(surfaces.get(mainPath[boss - 1]!)!.type).not.toBe("lift");
    // The mover pair and one sweeper of each kind: no twin-spinner lane.
    const sweepers = document.pieces.filter((piece) => piece.type === "sweeper");
    expect(sweepers.map((piece) => piece.id)).toEqual(["neon-fan", "pipe-roller", "crane-hook"]);
  });

  it("places golden tickets on the three branch perches (R10)", () => {
    const plan = planCasinoCollectibles({ authored: document, course: level.course });
    expect(plan?.tickets.map((ticket) => ticket.platformId)).toEqual([
      "crane-jib",
      "billboard-top",
      "tank-top",
    ]);
  });

  it("dresses the rooftops only from the rooftop and shared kits (R12)", () => {
    const decor = document.decor ?? [];
    const allowed = new Set(placeableThemeKitProps("rooftop").map((prop) => prop.id));
    expect(decor.length).toBeGreaterThan(100);
    expect(decor.length).toBeLessThanOrEqual(FAMILY_A3_DECOR_LIMIT);
    expect(decor.length).toBeLessThanOrEqual(AUTHORED_LEVEL_V4_LIMITS.maxDecor);
    for (const entry of decor) {
      expect(allowed.has(entry.kitPropId), entry.kitPropId).toBe(true);
      expect(themeKitProp(entry.kitPropId)!.fallback.shape, entry.id).not.toBe("arch");
    }
    // The era kit leads: every rooftop prop is used.
    const used = new Set(decor.map((entry) => entry.kitPropId));
    for (const id of ["water-tower", "rooftop-ac-unit", "crane-hook", "billboard-frame"])
      expect(used.has(id), id).toBe(true);
  });
});

describe("(a) real validators", () => {
  it("accepts the document and its growth rules, with or without chapter two", () => {
    expect(validateAuthoredLevelDocument(document)).toEqual([]);
    expect(validateGrowthRequirements(document, { startAgeYears: 5 })).toEqual([]);
    expect(validateGrowthRequirements(document, { startAgeYears: 5, previousStartAgeYears: 2 })).toEqual([]);
  });

  it("validates with zero issues as chapter three of a World A shell", () => {
    const result = applyWorld(
      [...EARLIER_CHAPTERS, A3_CHAPTER],
      [...stubCast("family-a1", "toon-clubhouse-v1"), ...stubCast("family-a2", "rescue-harbor-v1")],
    );
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
    const project = result.project as LevelEditorProjectV2;
    expect(validateLevelEditorProject(project)).toEqual([]);
    const chapter = project.chapters.find((entry) => entry.chapterId === "family-a3")!;
    expect(chapter.level).toEqual(document);
    expect(chapter.encounterSlots).toEqual({
      "ordinary-1": { source: "candidate", candidateId: "putty-grunt" },
      "ordinary-2": { source: "candidate", candidateId: "lab-robot" },
      "ordinary-3": { source: "candidate", candidateId: "putty-grunt" },
      "ordinary-4": { source: "candidate", candidateId: "lab-robot" },
      boss: { source: "candidate", candidateId: "inator-monster" },
      "bonus-1": { source: "candidate", candidateId: "lab-robot" },
    });
    expect(Buffer.byteLength(serializeLevelEditorProject(project))).toBeLessThan(LEVEL_EDITOR_PROJECT_MAX_BYTES);
  });

  it("alone in a one-chapter world, breaks only the rule that a world starts at birth", () => {
    // A world's first chapter must start on the fictional birth date, so a
    // chapter that starts at age 5 cannot stand alone; everything else holds.
    const result = applyWorld([A3_CHAPTER], []);
    expect(validateLevelEditorProject(result.project).map((entry) => `${entry.code} ${entry.path}`)).toEqual([
      "date.birth-start $.chapters[0].representedDateRange.startDate",
    ]);
  });
});

describe("(b) World A family lints", () => {
  it("reports nothing at all under preset a", () => {
    // No warnings either: the elevator's boarding deck holds cp-launch.
    expect(lintFamilyChapter(document, { world: "a" })).toEqual([]);
  });

  it("keeps every optional branch off the camera heading too (R3)", () => {
    for (const branch of document.branches)
      expect(lintCameraHeadings({ ...document, mainPath: branch }), branch.join(">")).toEqual([]);
  });

  it("returns an HP defeat to minor two about 21 m from the boss, with no lift (R5)", () => {
    const route = bossRetryRoute(document)!;
    expect(route.lifts).toBe(0);
    expect(route.meters).toBeLessThanOrEqual(FAMILY_WORLD_LINT_PRESETS.a.maxBossRetryDistance);
    expect(route.meters).toBeGreaterThan(15);
    // Minor one is on the fight-3 deck, before fights 3 and 4.
    const minorOne = mainPath.indexOf(document.anchors.memories["minor-one"].platformId);
    expect(minorOne).toBe(mainPath.indexOf(document.anchors.encounters["ordinary-3"].platformId));
    expect(minorOne).toBeLessThan(mainPath.indexOf(document.anchors.encounters["ordinary-4"].platformId));
  });
});

describe.each(STAGES)("%s avatar, age-5 moves only", (stage) => {
  it("(c) crosses the whole required route with no recovery in at least 70 s (R10)", () => {
    const run = runGrowthRouteWithWaits(level, mainPath, stage, startAbilities);
    expect(run.failedAt).toBeNull();
    expect(run.recoveries).toBe(0);
    expect(run.completed).toHaveLength(mainPath.length - 1);
    expect(run.bounces).toEqual(["ac-vent-pad"]);
    expect(run.seconds).toBeGreaterThanOrEqual(70);
    expect(run.maxFeetY).toBeGreaterThanOrEqual(FAMILY_A3_CLAIMS.peak);
  });

  it.each(level.graph.branches.map((branch, index) => [index, branch] as const))(
    "crosses branch %i in one uninterrupted run",
    (_index, branch) => {
      const run = runGrowthRouteWithWaits(level, branch, stage, startAbilities);
      expect(run.failedAt).toBeNull();
      expect(run.recoveries).toBe(0);
    },
  );

  it("(d) bounces onto every landing from a walk at stick 0.4–1.0 (R2)", () => {
    for (const [deck, pad, landing] of [
      ["vent-ledge", "ac-vent-pad", "billboard-balcony"],
      ["putty-plaza", "tank-pad", "tank-catwalk"],
    ] as const)
      for (const stick of R2_STICKS)
        for (const lateral of [0, -0.6, 0.6]) {
          const result = bounceWalkOn(level, deck, pad, landing, { stick, stage, lateral });
          expect(result.startedOnSource).toBe(true);
          expect(result.reached, `${pad} at stick ${stick}, lateral ${lateral}`).toBe(true);
        }
  });

  it("(d) lets a child who walks at the elevator ride it or fall back to the start deck (R6)", () => {
    const result = liftWalkIn(level, "freight-elevator", "launch-deck", "elevator-roof", { phases: 12, stage });
    expect(result.other).toBe(0);
    expect(result.ok).toBeGreaterThan(0);
    expect(result.ok + result.fell).toBe(12);
    // A fall into the open shaft is a short retry: the deck holds cp-launch.
    expect(document.pieces.some((piece) => piece.type === "checkpoint" && piece.platformId === "launch-deck")).toBe(
      true,
    );
  });

  it.each(mainEdges.map((edge) => [label(edge), edge] as const))(
    "(e) crosses required edge %s",
    (_label, edge) => {
      const result = traverseGrowthEdge(level, edge, stage, startAbilities);
      expect(result.startedOnSource).toBe(true);
      expect(result.recovered).toBe(false);
      expect(result.reached).toBe(true);
    },
  );

  it.each(branchEdges.map((edge) => [label(edge), edge] as const))(
    "(e) crosses branch edge %s with its declared move",
    (_label, edge) => {
      const abilities = edge.requires ? abilitiesThrough(edge.requires) : startAbilities;
      const result = traverseGrowthEdge(level, edge, stage, abilities);
      expect(result.startedOnSource).toBe(true);
      expect(result.reached).toBe(true);
    },
  );

  it.each(
    level.graph.connections
      .filter((edge) => edge.safeMissPlatformId)
      .map((edge) => [label(edge), edge] as const),
  )("(e) misses %s onto its catch floor", (_label, edge) => {
    const result = missGrowthPractice(level, edge, stage, startAbilities);
    expect(result.startedOnSource).toBe(true);
    expect(result.airborne).toBe(true);
    expect(result.recovered).toBe(false);
    expect(result.reached).toBe(true);
  });

  it("(e) needs the double jump for every required double jump", () => {
    const doubleJumps = mainEdges.filter((edge) => edge.requires === "double-jump");
    expect(doubleJumps.map(label)).toEqual([
      "fire-escape-1->fire-escape-2",
      "fire-escape-2->pigeon-roof",
      "tower-porch->tower-ledge-1",
      "tower-ledge-1->tower-ledge-2",
      "tower-ledge-2->tower-top",
    ]);
    for (const edge of doubleJumps)
      expect(traverseGrowthEdge(level, edge, stage, abilitiesForAge(2)).reached, label(edge)).toBe(false);
  });
});

describe("(e) practice stretches and catch floors", () => {
  it("practises the new moves over the mattress, then reuses the double jump over the climb net", () => {
    const caught = level.graph.connections.filter((edge) => edge.safeMissPlatformId);
    expect(caught.map((edge) => `${label(edge)}@${edge.safeMissPlatformId}`)).toEqual([
      "elevator-roof->fire-escape-1@rooftop-mattress",
      "fire-escape-1->fire-escape-2@rooftop-mattress",
      "fire-escape-2->pigeon-roof@rooftop-mattress",
      "tower-porch->tower-ledge-1@climb-net",
      "tower-ledge-1->tower-ledge-2@climb-net",
      "tower-ledge-2->tower-top@climb-net",
    ]);
    // The first required use of each move is in the opening practice stretch.
    for (const move of ["high-jump", "double-jump"] as const) {
      const first = mainEdges.find((edge) => edge.requires === move)!;
      expect(first.safeMissPlatformId).toBe("rooftop-mattress");
    }
    // Descents use drop, never a growth move (R7).
    for (const edge of level.graph.connections) {
      const from = surfaces.get(edge.from)!;
      const to = surfaces.get(edge.to)!;
      const descent = authoredSurfaceTopRange(from).min - authoredSurfaceTopRange(to).max;
      if (edge.mode === "jump" && edge.requires !== undefined)
        expect(descent, label(edge)).toBeLessThanOrEqual(AUTHORED_LEVEL_LIMITS.maxConnectionRise);
    }
    expect(level.graph.connections.filter((edge) => edge.mode === "drop").map(label)).toEqual([
      "crane-jib->satellite-roof",
      "billboard-top->billboard-walkway",
      "billboard-walkway->roller-catwalk",
      "tank-top->tank-ladder",
    ]);
  });
});

describe("(f) the required climb", () => {
  const mm = (value: number) => Math.round(value * 1000) / 1000;
  const tops = mainPath.map((id) => {
    const range = authoredSurfaceTopRange(surfaces.get(id)!);
    return { min: mm(range.min), max: mm(range.max) };
  });

  it("climbs through the claimed standing heights without ever descending", () => {
    for (let index = 1; index < tops.length; index += 1)
      expect(tops[index]!.min, mainPath[index]).toBeGreaterThanOrEqual(tops[index - 1]!.max - 1e-9);
    const heights = [...new Set(tops.flatMap((range) => [range.min, range.max]))].sort((a, b) => a - b);
    expect(heights).toEqual([...FAMILY_A3_CLAIMS.requiredLevels]);
  });

  it("peaks at 15 m on the boss tower, a 15 m climb below A4's 16 m finale (R8)", () => {
    const peak = Math.max(...tops.map((range) => range.max));
    expect(peak).toBe(FAMILY_A3_CLAIMS.peak);
    expect(peak - tops[0]!.min).toBe(FAMILY_A3_CLAIMS.climb);
    expect(FAMILY_A3_CLAIMS.climb).toBeLessThan(16);
    expect(mm(authoredSurfaceTopRange(surfaces.get(document.anchors.encounters.boss.platformId)!).max)).toBe(peak);
    // Nothing in the chapter stands higher than the tower (branches included).
    const everything = [...surfaces.values()].map((surface) => mm(authoredSurfaceTopRange(surface).max));
    expect(Math.max(...everything)).toBe(peak);
  });
});
