/**
 * Chapter B2 of World B, "The Magic House" (PLAN-019): the generator's
 * level document validates inside a World B project, passes the World B
 * family lints, and plays with only the moves a two-year-old has.
 *
 * B2 starts at age 2, so the avatar is the infant model for the whole
 * chapter (DESIGN-025 D-02) with jump and high jump; the child model is
 * exercised as well because it is cheap and guards the wider collider.
 */
import { describe, expect, it } from "vitest";
import {
  isAuthoredSurfacePiece,
  resolveAuthoredLevelDocument,
  validateAuthoredLevelDocument,
  type AuthoredConnection,
  type AuthoredLevelDocument,
} from "../../src/shared/authored-level";
import { validateGrowthRequirements } from "../../src/shared/authored-level-growth";
import { abilitiesForAge } from "../../src/shared/abilities";
import {
  applyLevelEditorCommands,
  createWorldEditorProject,
  validateLevelEditorProject,
  type LevelEditorCommand,
  type LevelEditorProjectV2,
} from "../../src/shared/editor-project";
import {
  bossRetryRoute,
  lintFamilyChapter,
} from "../../src/shared/family-world-lint";
import { placeableThemeKitProps, themeKitProp } from "../../src/shared/theme-kits";
import {
  chapterCommands,
  worldShellCommands,
  type WorldShellChapter,
} from "../../scripts/levels/lib/growth-kit";
import {
  B2_BRANCHES,
  B2_CAST,
  B2_MAIN_PATH,
  B2_ROUTE_ID,
  B2_SHELL_CHAPTER,
  buildB2Level,
  WORLD_B_FICTIONAL_BIRTH_DATE,
} from "../../scripts/levels/family/b2";
import { fixtureCandidate } from "../family-world-fixtures";
import { STAGES } from "../game/authored-traversal-lib";
import {
  missGrowthPractice,
  runGrowthRoute,
  traverseGrowthEdge,
} from "../game/growth-traversal-lib";
import {
  bounceWalkOn,
  liftWalkIn,
  R2_STICKS,
  runGrowthRouteWithWaits,
} from "../game/family-kid-lib";

const level = buildB2Level();
const document: AuthoredLevelDocument = level;
const resolved = resolveAuthoredLevelDocument(document);
/** Only the moves unlocked at the chapter's start age. */
const START_ABILITIES = abilitiesForAge(B2_SHELL_CHAPTER.recoveredAge.fromYears);

const surfaces = new Map(
  document.pieces.filter(isAuthoredSurfacePiece).map((piece) => [piece.id, piece]),
);

function topOf(id: string): number {
  const surface = surfaces.get(id);
  if (!surface) throw new Error(`Surface ${id} is missing`);
  return Math.round((surface.center.y + surface.size.y / 2) * 1000) / 1000;
}

function connection(from: string, to: string): AuthoredConnection {
  const found = document.connections.find((entry) => entry.from === from && entry.to === to);
  if (!found) throw new Error(`Connection ${from}->${to} is missing`);
  return found;
}

const mainEdges = B2_MAIN_PATH.slice(1).map((to, index) => connection(B2_MAIN_PATH[index]!, to));
const branchEdges = B2_BRANCHES.flatMap((branch) =>
  branch.slice(1).map((to, index) => connection(branch[index]!, to)),
);

/**
 * The project validator requires a world's first chapter to start on the
 * fictional birth date (`date.birth-start`), so B2 (ages 2 -> 4) cannot be a
 * world's only chapter. A synthetic stand-in for B1 (the garden template,
 * ages 0 -> 2, placeholder cast) precedes it; B2 keeps its own WORLD-SPEC
 * dates, ages, level and cast.
 */
const STAND_IN_B1: WorldShellChapter = {
  chapterId: "stand-in-b1",
  routeId: "stand-in-b1-route",
  name: "Stand-in Playroom",
  subtitle: "A synthetic first chapter",
  description: "A synthetic stand-in so B2 can be validated in its World B position.",
  theme: "playroom",
  representedDateRange: { startDate: WORLD_B_FICTIONAL_BIRTH_DATE, endDate: "2022-06-01" },
  recoveredAge: { fromYears: 0, toYears: 2 },
  previewMemories: [
    { slotId: "minor-one", date: "2021-01-15", label: "Summer picnic" },
    { slotId: "minor-two", date: "2021-10-15", label: "First steps" },
    { slotId: "major", date: "2022-06-01", label: "Turning 2!" },
  ],
};

function worldCommands(): LevelEditorCommand[] {
  const standIn = chapterCommands(STAND_IN_B1.chapterId);
  const b2 = chapterCommands(B2_SHELL_CHAPTER.chapterId);
  const candidate = (candidateId: string) => ({ source: "candidate" as const, candidateId });
  const eligibility = { startDate: "2018-01-01", endDate: "2026-12-31" };
  return [
    ...worldShellCommands({
      fictionalBirthDate: WORLD_B_FICTIONAL_BIRTH_DATE,
      chapters: [STAND_IN_B1, B2_SHELL_CHAPTER],
    }),
    standIn.addCandidate("ordinary-1", fixtureCandidate("stand-in-a", "Stand-in A", "sing-along-playroom-v1", "ordinary-a", eligibility)),
    standIn.addCandidate("ordinary-2", fixtureCandidate("stand-in-b", "Stand-in B", "sing-along-playroom-v1", "ordinary-b", eligibility)),
    standIn.assign("ordinary-3", candidate("stand-in-a")),
    standIn.assign("ordinary-4", candidate("stand-in-b")),
    standIn.addCandidate("boss", fixtureCandidate("stand-in-boss", "Stand-in Boss", "sing-along-playroom-v1", "boss", eligibility)),
    b2.replaceLevel(buildB2Level()),
    // R11: one ordinary identity, so all four ordinary slots share its kind.
    b2.addCandidate("ordinary-1", B2_CAST.ordinary),
    b2.assign("ordinary-2", candidate(B2_CAST.ordinary.id)),
    b2.assign("ordinary-3", candidate(B2_CAST.ordinary.id)),
    b2.assign("ordinary-4", candidate(B2_CAST.ordinary.id)),
    b2.addCandidate("boss", B2_CAST.boss),
  ];
}

describe("B2 generator and validation", () => {
  it("is deterministic and uses the chapter's route id and casita theme", () => {
    expect(JSON.stringify(buildB2Level())).toBe(JSON.stringify(level));
    expect(level.schemaVersion).toBe("authored-level-v4");
    expect(level.id).toBe(B2_ROUTE_ID);
    expect(level.theme).toBe("casita");
    expect(level.mainPath).toEqual(B2_MAIN_PATH);
    expect(level.branches).toEqual(B2_BRANCHES);
  });

  it("validates with zero issues as B2 inside a World B project", () => {
    expect(validateAuthoredLevelDocument(document)).toEqual([]);
    expect(
      validateGrowthRequirements(document, { startAgeYears: 2, previousStartAgeYears: 0 }),
    ).toEqual([]);
    const base = createWorldEditorProject({
      projectId: "family-b2-check",
      catalogVersion: "parody-catalog-v7",
    });
    const result = applyLevelEditorCommands(base, { expectedRevision: 0, commands: worldCommands() });
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
    expect(validateLevelEditorProject(result.project)).toEqual([]);
    const chapter = (result.project as LevelEditorProjectV2).chapters[1]!;
    expect(chapter.chapterId).toBe(B2_SHELL_CHAPTER.chapterId);
    expect(chapter.representedDateRange).toEqual({ startDate: "2022-06-01", endDate: "2024-06-01" });
    expect(chapter.recoveredAge).toEqual({ fromYears: 2, toYears: 4 });
    expect(chapter.level).toEqual(level);
    for (const slot of ["ordinary-1", "ordinary-2", "ordinary-3", "ordinary-4"] as const) {
      expect(chapter.level.anchors.encounters[slot].kind).toBe("ordinary-a");
      expect(chapter.encounterSlots[slot]).toEqual({ source: "candidate", candidateId: "bin-chicken" });
    }
    expect(chapter.encounterSlots.boss).toEqual({ source: "candidate", candidateId: "magic-house" });
  });

  it("needs its practice catch floor before the first required high jump", () => {
    const connections = document.connections.map((entry): AuthoredConnection => {
      if (entry.safeMissPlatformId === undefined) return entry;
      const { safeMissPlatformId: _catchFloor, ...rest } = entry;
      return rest;
    });
    const codes = validateGrowthRequirements(
      { ...document, connections },
      { startAgeYears: 2, previousStartAgeYears: 0 },
    ).map((entry) => entry.code);
    expect(codes).toEqual(["requires.practice-missing"]);
  });

  it("places at most 200 decor props from the casita kit and the shared kit only (R12)", () => {
    const allowed = new Set(placeableThemeKitProps("casita").map((prop) => prop.id));
    const decor = level.decor ?? [];
    expect(decor.length).toBeGreaterThan(0);
    expect(decor.length).toBeLessThanOrEqual(200);
    for (const entry of decor) expect(allowed.has(entry.kitPropId), entry.id).toBe(true);
    // The era kit leads: most placements are casita props.
    const casita = decor.filter((entry) => themeKitProp(entry.kitPropId)?.theme === "casita");
    expect(casita.length).toBeGreaterThanOrEqual(30);
  });
});

describe("B2 family lints (World B preset)", () => {
  it("reports no findings at all, so no warning needs a justification", () => {
    // Pad gaps 0.35 m with grounded landings (R2), no required +z step (R3),
    // every strike envelope at least 1 m inside its deck and off every strip
    // (R4), minor-two on the staircase landing (R5), the chapter ending on
    // the overlook (R1), and a 2.5 s-dwell lift with 0.05 m landings and a
    // boarding checkpoint (R6).
    expect(lintFamilyChapter(document, { world: "b" })).toEqual([]);
  });

  it("returns an HP defeat to the staircase landing, about 16 m and no lift from the boss (R5)", () => {
    const route = bossRetryRoute(document);
    expect(route).toBeDefined();
    expect(route!.lifts).toBe(0);
    expect(route!.meters).toBeLessThanOrEqual(25);
    expect(route!.meters).toBeGreaterThan(10);
  });

  it("keeps optional branch steps away from the camera too (R3)", () => {
    for (const edge of branchEdges) {
      const from = surfaces.get(edge.from)!;
      const to = surfaces.get(edge.to)!;
      const deltaZ = to.center.z - from.center.z;
      const degrees = (Math.atan2(deltaZ, Math.abs(to.center.x - from.center.x)) * 180) / Math.PI;
      expect(degrees, `${edge.from}->${edge.to}`).toBeLessThanOrEqual(30);
    }
  });
});

describe("B2 required route with only the start-age moves", () => {
  it("is played through by the patient scripted kid with no recovery in at least 70 s (R10)", () => {
    for (const stage of STAGES) {
      const run = runGrowthRouteWithWaits(resolved, B2_MAIN_PATH, stage, START_ABILITIES);
      expect(run.failedAt, stage).toBeNull();
      expect(run.recoveries, stage).toBe(0);
      expect(run.completed).toHaveLength(B2_MAIN_PATH.length - 1);
      expect(run.bounces).toEqual(expect.arrayContaining(["petal-pad", "bloom-pad"]));
      expect(run.seconds, stage).toBeGreaterThanOrEqual(70);
      expect(run.maxFeetY, stage).toBeGreaterThanOrEqual(topOf("sky-courtyard"));
    }
  });

  it("crosses every required edge in isolation from three takeoff offsets", () => {
    for (const stage of STAGES)
      for (const edge of mainEdges)
        for (const lateral of [0, -0.4, 0.4]) {
          const result = traverseGrowthEdge(resolved, edge, stage, START_ABILITIES, lateral);
          expect(result.reached, `${stage} ${edge.from}->${edge.to} lateral ${lateral}`).toBe(true);
        }
  });

  it("lets every required bounce succeed from a walk-on at analog stick 0.4-1.0 (R2)", () => {
    const pads = mainEdges.filter((edge) => edge.mode === "bounce");
    expect(pads.map((edge) => edge.from)).toEqual(["petal-pad", "bloom-pad"]);
    for (const edge of pads) {
      const deck = B2_MAIN_PATH[B2_MAIN_PATH.indexOf(edge.from) - 1]!;
      for (const stage of STAGES)
        for (const stick of R2_STICKS)
          for (const lateral of [0, -0.5, 0.5]) {
            const result = bounceWalkOn(resolved, deck, edge.from, edge.to, { stick, stage, lateral });
            expect(result.reached, `${stage} ${edge.from} stick ${stick} lateral ${lateral}`).toBe(true);
            expect(result.startedOnSource).toBe(true);
          }
    }
  });

  it("carries a child who walks at the lift at any moment of its cycle (R6)", () => {
    const lifts = B2_MAIN_PATH.filter((id) => surfaces.get(id)?.type === "lift");
    expect(lifts).toEqual(["garden-lift"]);
    for (const liftId of lifts) {
      const index = B2_MAIN_PATH.indexOf(liftId);
      const from = B2_MAIN_PATH[index - 1]!;
      const to = B2_MAIN_PATH[index + 1]!;
      for (const stage of STAGES)
        for (const stick of [0.4, 0.7, 1]) {
          // The 0.9 m car hangs lower than the infant avatar at its top stop,
          // so the open shaft is never at walking height: every arrival rides.
          const result = liftWalkIn(resolved, liftId, from, to, { phases: 24, stage, stick });
          expect(result, `${stage} stick ${stick}`).toEqual({ ok: 24, fell: 0, other: 0 });
        }
    }
  });
});

describe("B2 practice strip and optional route", () => {
  it("catches a deliberate miss of each practice high jump on the clover lawn", () => {
    const practice = document.connections.filter((edge) => edge.safeMissPlatformId !== undefined);
    expect(practice.map((edge) => `${edge.from}->${edge.to}`)).toEqual(["pot-1->pot-2", "pot-2->pot-3"]);
    for (const edge of practice)
      for (const stage of STAGES) {
        const result = missGrowthPractice(resolved, edge, stage, START_ABILITIES);
        expect(result.startedOnSource).toBe(true);
        expect(result.recovered).toBe(false);
        expect(result.reached, `${stage} ${edge.from}->${edge.to}`).toBe(true);
        expect(result.supportId).toBe("clover-lawn");
      }
  });

  it("hops back from the clover lawn onto the first pot to retry", () => {
    const retries = document.connections.filter((edge) => edge.from === "clover-lawn");
    expect(retries).toEqual([{ from: "clover-lawn", to: "pot-1", mode: "jump" }]);
    for (const stage of STAGES)
      for (const lateral of [0, -0.4, 0.4]) {
        const result = traverseGrowthEdge(resolved, retries[0]!, stage, START_ABILITIES, lateral);
        expect(result.reached, `${stage} lateral ${lateral}`).toBe(true);
      }
  });

  it("crosses every branch edge with its declared high jump, and the golden perch needs it", () => {
    expect(branchEdges.map((edge) => edge.requires)).toEqual(["high-jump", "high-jump", "high-jump", "high-jump"]);
    for (const stage of STAGES) {
      for (const edge of branchEdges)
        for (const lateral of [0, -0.3, 0.3]) {
          const result = traverseGrowthEdge(resolved, edge, stage, START_ABILITIES, lateral);
          expect(result.reached, `${stage} ${edge.from}->${edge.to} lateral ${lateral}`).toBe(true);
        }
      for (const branch of B2_BRANCHES) {
        const run = runGrowthRoute(resolved, branch, stage, START_ABILITIES);
        expect(run.failedAt, stage).toBeNull();
        expect(run.recoveries, stage).toBe(0);
      }
      // The 1.6 m gap up to the perch is beyond a plain jump: the golden
      // candle really asks for the new move.
      const jumpOnly = traverseGrowthEdge(resolved, connection("arch-step-2", "golden-perch"), stage, abilitiesForAge(0));
      expect(jumpOnly.reached, stage).toBe(false);
    }
  });
});

describe("B2 climb profile (blueprint as amended by R8 and R9)", () => {
  const tops = B2_MAIN_PATH.map((id) => {
    const surface = surfaces.get(id)!;
    // A lift offers its top stop to the deck that follows it.
    return surface.type === "lift" ? topOf(id) + surface.travel.distance : topOf(id);
  });

  it("climbs from the garden path to a sky courtyard about 9 m up", () => {
    expect(tops[0]).toBe(0);
    const peak = Math.max(...tops);
    expect(peak).toBe(8.9);
    expect(tops.at(-1)).toBe(peak);
    expect(topOf("sky-courtyard")).toBe(peak);
    // R8: B1 stays at or below 7 m and B3 reaches at least 10 m; B2 sits between.
    expect(peak).toBeGreaterThan(7);
    expect(peak).toBeLessThan(10);
    expect(Math.abs(peak - 9)).toBeLessThanOrEqual(0.5);
    // Standing levels the required route reaches: 0, 1.5, 2.7, 4.2, 6.5, 6.8, 8.0, 8.9 plus tile steps.
    const decks = B2_MAIN_PATH.filter((id) => surfaces.get(id)?.type === "platform").map(topOf);
    expect(new Set(decks).size).toBeGreaterThanOrEqual(8);
    // The only descent is the 0.3 m hop off the second planter; no drop is needed (R7).
    const descents = tops.slice(1).map((top, index) => tops[index]! - top).filter((drop) => drop > 0);
    expect(descents.map((drop) => Math.round(drop * 1000) / 1000)).toEqual([0.3]);
  });

  it("asks for high jump on exactly two required edges, both over the catch floor", () => {
    const highJumps = mainEdges.filter((edge) => edge.requires === "high-jump");
    expect(highJumps).toHaveLength(2);
    for (const edge of highJumps) expect(edge.safeMissPlatformId).toBe("clover-lawn");
    expect(mainEdges.some((edge) => edge.requires !== undefined && edge.requires !== "high-jump")).toBe(false);
  });

  it("reaches the boss up the dancing-tile staircase, not by lift (R9)", () => {
    const boss = B2_MAIN_PATH.indexOf(document.anchors.encounters.boss.platformId);
    const approach = B2_MAIN_PATH.slice(B2_MAIN_PATH.indexOf("chimney-garden") + 1, boss);
    expect(approach).toEqual([
      "dance-tile-1",
      "dance-tile-2",
      "dance-tile-3",
      "tile-rest",
      "dance-tile-4",
      "dance-tile-5",
    ]);
    expect(approach.filter((id) => surfaces.get(id)!.type === "moving-platform")).toHaveLength(5);
    expect(approach.some((id) => surfaces.get(id)!.type === "lift")).toBe(false);
    // Each tile steps up 0.3 m: chimney 6.8 -> courtyard 8.9.
    const stair = ["chimney-garden", ...approach, "sky-courtyard"].map(topOf);
    for (let index = 1; index < stair.length; index += 1)
      expect(Math.round((stair[index]! - stair[index - 1]!) * 1000) / 1000).toBe(0.3);
  });

  it("keeps each spinning sweeper on its own deck, so there is no twin-spinner lane (R9)", () => {
    const sweepers = document.pieces.filter((piece) => piece.type === "sweeper");
    expect(sweepers.map((piece) => piece.id)).toEqual(["sprinkler", "weathervane"]);
    const decks = sweepers.map((sweeper) =>
      [...surfaces.values()].find(
        (surface) =>
          surface.type === "platform" &&
          Math.abs(sweeper.center.x - surface.center.x) < surface.size.x / 2 &&
          Math.abs(sweeper.center.z - surface.center.z) < surface.size.z / 2,
      )?.id,
    );
    expect(decks).toEqual(["sprinkler-alley", "roof-walk"]);
  });
});
