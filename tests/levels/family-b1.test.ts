/**
 * World B chapter 1, "The Sing-Along Playroom" (PLAN-019): the generator in
 * `scripts/levels/family/b1.ts` against the real validator, the family-world
 * lints and the kid model. Everything runs on the generated document; the
 * avatar only ever has `abilitiesForAge(0)` (jump), the chapter's start age.
 * No real names, dates or photos: the world shell uses WORLD-SPEC's
 * fictional birth date.
 */
import { describe, expect, it } from "vitest";
import {
  AUTHORED_LEVEL_LIMITS,
  authoredSurfaceTopRange,
  isAuthoredSurfacePiece,
  resolveAuthoredLevelDocument,
  validateAuthoredLevelDocument,
  type AuthoredConnection,
  type AuthoredLevelDocument,
  type AuthoredSurfacePiece,
} from "../../src/shared/authored-level";
import { abilitiesForAge } from "../../src/shared/abilities";
import {
  applyLevelEditorCommands,
  createWorldEditorProject,
  validateLevelEditorProject,
  type LevelEditorProjectV2,
} from "../../src/shared/editor-project";
import {
  bossRetryRoute,
  FAMILY_WORLD_LINT_PRESETS,
  lintFamilyChapter,
} from "../../src/shared/family-world-lint";
import { themeKitPropsFor } from "../../src/shared/theme-kits";
import { planCasinoCollectibles } from "../../src/game/casino-tokens";
import { chapterCommands, worldShellCommands } from "../../scripts/levels/lib/growth-kit";
import {
  FAMILY_B1_BRANCHES,
  FAMILY_B1_CAST,
  FAMILY_B1_HEIGHTS,
  FAMILY_B1_MAIN_PATH,
  FAMILY_B1_ROUTE_ID,
  FAMILY_B1_SHELL_CHAPTER,
  FAMILY_WORLD_B_FICTIONAL_BIRTH_DATE,
  familyB1Level,
} from "../../scripts/levels/family/b1";
import { edgeEntry, STAGES, type AppearanceStage } from "../game/authored-traversal-lib";
import {
  createGrowthSimulation,
  growthStep,
  liftTimeAtTop,
  missGrowthPractice,
  traverseGrowthEdge,
} from "../game/growth-traversal-lib";
import {
  bounceWalkOn,
  liftWalkIn,
  R2_STICKS,
  runGrowthRouteWithWaits,
} from "../game/family-kid-lib";

const level = familyB1Level();
const document = level as unknown as AuthoredLevelDocument;
const resolved = resolveAuthoredLevelDocument(document);
/** The chapter starts at age 0: jump only (DESIGN-025 D-01). */
const START_MOVES = abilitiesForAge(0);

function surfaces(): Map<string, AuthoredSurfacePiece> {
  const map = new Map<string, AuthoredSurfacePiece>();
  for (const piece of document.pieces) if (isAuthoredSurfacePiece(piece)) map.set(piece.id, piece);
  return map;
}

function surface(id: string): AuthoredSurfacePiece {
  const found = surfaces().get(id);
  if (!found) throw new Error(`B1 surface ${id} is missing`);
  return found;
}

/** Standing top, rounded to the millimetre like the generator's geometry. */
function top(id: string): number {
  return Math.round(authoredSurfaceTopRange(surface(id)).max * 1000) / 1000;
}

function edge(from: string, to: string): AuthoredConnection {
  const found = document.connections.find((entry) => entry.from === from && entry.to === to);
  if (!found) throw new Error(`B1 connection ${from}->${to} is missing`);
  return found;
}

function edgesOf(path: readonly string[]): AuthoredConnection[] {
  return path.slice(1).map((id, index) => edge(path[index]!, id));
}

const MAIN_EDGES = edgesOf(FAMILY_B1_MAIN_PATH);
const BRANCH_EDGES = FAMILY_B1_BRANCHES.flatMap((branch) => edgesOf(branch));
const REQUIRED_BOUNCES = MAIN_EDGES.filter((entry) => entry.mode === "bounce");
const REQUIRED_LIFTS = FAMILY_B1_MAIN_PATH.filter((id) => surface(id).type === "lift");

/** The one-chapter World B shell with B1's level and cast, as the assembler builds it. */
function buildB1World(): { project: LevelEditorProjectV2; issues: readonly unknown[] } {
  const chapter = chapterCommands(FAMILY_B1_SHELL_CHAPTER.chapterId);
  const veggie = { source: "candidate" as const, candidateId: FAMILY_B1_CAST.ordinary.id };
  const result = applyLevelEditorCommands(
    createWorldEditorProject({ projectId: "family-b1-check", catalogVersion: "parody-catalog-v7" }),
    {
      expectedRevision: 0,
      commands: [
        ...worldShellCommands({
          name: "Playroom to Big Stage",
          fictionalBirthDate: FAMILY_WORLD_B_FICTIONAL_BIRTH_DATE,
          chapters: [FAMILY_B1_SHELL_CHAPTER],
        }),
        chapter.replaceLevel(familyB1Level()),
        chapter.addCandidate("ordinary-1", FAMILY_B1_CAST.ordinary),
        chapter.assign("ordinary-2", veggie),
        chapter.assign("ordinary-3", veggie),
        chapter.assign("ordinary-4", veggie),
        chapter.addCandidate("boss", FAMILY_B1_CAST.boss),
      ],
    },
  );
  if (!result.ok)
    throw new Error(
      `B1 world commands failed: ${result.issues.map((entry) => `${entry.path}: ${entry.message}`).join("; ")}`,
    );
  return { project: result.project as LevelEditorProjectV2, issues: result.issues };
}

describe("family B1 generator (a, b)", () => {
  it("is a pure function returning the complete authored-level-v4 document", () => {
    expect(JSON.stringify(familyB1Level())).toBe(JSON.stringify(level));
    expect(level.schemaVersion).toBe("authored-level-v4");
    expect(level.id).toBe(FAMILY_B1_ROUTE_ID);
    expect(level.theme).toBe("playroom");
    expect(level.mainPath).toEqual([...FAMILY_B1_MAIN_PATH]);
    expect(level.branches).toEqual(FAMILY_B1_BRANCHES.map((branch) => [...branch]));
    expect(Object.keys(level.anchors.encounters).sort()).toEqual(
      ["boss", "ordinary-1", "ordinary-2", "ordinary-3", "ordinary-4"],
    );
    expect(Object.keys(level.anchors.friendlies).sort()).toEqual(["friendly-1", "friendly-2", "friendly-3"]);
    // R11: one ordinary identity, so all four ordinary anchors share its kind.
    for (const slot of ["ordinary-1", "ordinary-2", "ordinary-3", "ordinary-4"] as const)
      expect(level.anchors.encounters[slot].kind, slot).toBe(FAMILY_B1_CAST.ordinary.kind);
    // Every encounter has an arena and a retry checkpoint that exists.
    const checkpointIds = new Set(document.pieces.filter((piece) => piece.type === "checkpoint").map((piece) => piece.id));
    for (const [slot, encounter] of Object.entries(level.anchors.encounters))
      expect(checkpointIds.has(encounter!.checkpointId), slot).toBe(true);
    expect(validateAuthoredLevelDocument(document)).toEqual([]);
  });

  it("validates with zero issues inside a one-chapter World B shell with its cast", () => {
    const { project, issues } = buildB1World();
    expect(issues).toEqual([]);
    expect(validateLevelEditorProject(project)).toEqual([]);
    expect(project.fictionalBirthDate).toBe("2020-06-01");
    expect(project.chapters).toHaveLength(1);
    const chapter = project.chapters[0]!;
    expect(chapter.routeId).toBe(FAMILY_B1_ROUTE_ID);
    expect(chapter.name).toBe("The Sing-Along Playroom");
    expect(chapter.subtitle).toBe("Block towers and bouncy beds");
    expect(chapter.description).toBe(
      "Climb the playroom towers, bounce on the beds and cheer up the grumpy bus.",
    );
    expect(chapter.recoveredAge).toEqual({ fromYears: 0, toYears: 2 });
    expect(chapter.representedDateRange).toEqual({ startDate: "2020-06-01", endDate: "2022-06-01" });
    expect(chapter.level).toEqual(level);
    expect(chapter.encounterSlots.boss).toEqual({ source: "candidate", candidateId: "honk-bus" });
    for (const slot of ["ordinary-1", "ordinary-2", "ordinary-3", "ordinary-4"] as const)
      expect(chapter.encounterSlots[slot], slot).toEqual({ source: "candidate", candidateId: "yes-yes-veggie" });
  });

  it("passes every World B family lint with no errors and no warnings", () => {
    // No warnings are accepted either: the lift landings are flush, so a
    // walking child boards and leaves without a hop (no `lift.step-up`).
    expect(lintFamilyChapter(document, { world: "b" })).toEqual([]);
    expect(FAMILY_WORLD_LINT_PRESETS.b.strikeDeckMargin).toBe(1);
  });
});

describe("family B1 kid model (c, d, e)", () => {
  it.each(STAGES)(
    "runs the whole required route patiently with only age-0 moves as the %s avatar (R10)",
    (stage: AppearanceStage) => {
      const run = runGrowthRouteWithWaits(resolved, FAMILY_B1_MAIN_PATH, stage, START_MOVES);
      expect(run.failedAt).toBeNull();
      expect(run.completed).toHaveLength(FAMILY_B1_MAIN_PATH.length - 1);
      expect(run.recoveries).toBe(0);
      // R10: at least 60 s of traversal in B1 before any fight (measured 66.7 s).
      expect(run.seconds).toBeGreaterThanOrEqual(60);
      expect(run.seconds).toBeLessThan(90);
      // Both pillow pads launched the child; the practice bed pad too.
      expect(run.bounces).toEqual(
        expect.arrayContaining(["bed-pad", "pillow-pad-1", "pillow-pad-2"]),
      );
    },
    60_000,
  );

  it("crosses every required edge in isolation with jump-only physics", () => {
    for (const connection of MAIN_EDGES)
      for (const stage of STAGES)
        for (const lateral of [0, 0.4, -0.4]) {
          const result = traverseGrowthEdge(resolved, connection, stage, START_MOVES, lateral);
          expect(result.reached, `${connection.from}->${connection.to} ${stage} ${lateral}`).toBe(true);
        }
  }, 60_000);

  it("walks onto every required bounce pad and lands at every R2 stick (R2)", () => {
    expect(REQUIRED_BOUNCES.map((entry) => entry.from)).toEqual(["bed-pad", "pillow-pad-1", "pillow-pad-2"]);
    for (const connection of REQUIRED_BOUNCES) {
      const approach = MAIN_EDGES.find((entry) => entry.to === connection.from)!;
      expect(approach.mode).toBe("walk");
      for (const stage of STAGES)
        for (const lateral of [0, 0.6, -0.6])
          for (const stick of R2_STICKS) {
            const result = bounceWalkOn(resolved, approach.from, connection.from, connection.to, {
              stick,
              stage,
              lateral,
            });
            const label = `${connection.from} ${stage} lateral ${lateral} stick ${stick}`;
            expect(result.startedOnSource, label).toBe(true);
            expect(result.reached, label).toBe(true);
            expect(result.bounces, label).toBeGreaterThan(0);
          }
    }
  }, 60_000);

  it("gives the one required lift walk-in rides at every phase, and every shaft fall a boarding-checkpoint retry (R6)", () => {
    expect(REQUIRED_LIFTS).toEqual(["toy-elevator"]);
    const phases = 24;
    for (const stage of STAGES) {
      const result = liftWalkIn(resolved, "toy-elevator", "train-station", "dresser", { phases, stage });
      // Every arrival either rides through or falls into the open shaft; none
      // gets stuck. Dwell cannot close the shaft (DESIGN-025 D-08 f), so a
      // fall must be a cheap retry: it lands back on the boarding station.
      expect(result.ok + result.fell + result.other).toBe(phases);
      expect(result.other, stage).toBe(0);
      expect(result.ok, stage).toBeGreaterThanOrEqual(phases / 3);
      expect(shaftFallRespawn(stage)).toEqual({ fell: true, checkpointId: "cp-station", supportId: "train-station" });
    }
  });

  it("crosses every branch edge with its declared move", () => {
    for (const connection of BRANCH_EDGES) {
      expect(connection.requires, `${connection.from}->${connection.to}`).toBeUndefined();
      for (const stage of STAGES)
        for (const lateral of [0, 0.4, -0.4]) {
          const result = traverseGrowthEdge(resolved, connection, stage, START_MOVES, lateral);
          expect(result.reached, `${connection.from}->${connection.to} ${stage} ${lateral}`).toBe(true);
        }
    }
  });

  it("drops every deliberate practice miss onto the catch mat and hops back", () => {
    const practice = document.connections.filter((entry) => entry.safeMissPlatformId);
    expect(practice.map((entry) => `${entry.mode}:${entry.from}->${entry.to}`)).toEqual([
      "jump:rug-runner->toy-step-1",
      "jump:toy-step-1->toy-step-2",
      "jump:toy-step-2->toy-step-3",
      "bounce:bed-pad->bounce-block",
    ]);
    for (const connection of practice)
      for (const stage of STAGES) {
        const miss = missGrowthPractice(resolved, connection, stage, START_MOVES);
        const label = `${connection.from}->${connection.to} ${stage}`;
        expect(miss.startedOnSource, label).toBe(true);
        expect(miss.recovered, label).toBe(false);
        expect(miss.reached, label).toBe(true);
        expect(miss.supportId, label).toBe("practice-mat");
      }
    for (const stage of STAGES)
      expect(traverseGrowthEdge(resolved, edge("practice-mat", "rug-runner"), stage, START_MOVES).reached).toBe(true);
  });
});

/**
 * A child walks at the toy elevator while it waits at its top stop, falls
 * into the shaft, and recovers: where does the recovery put them?
 */
function shaftFallRespawn(stage: AppearanceStage) {
  const course = resolved.course;
  const atTop = liftTimeAtTop(course, "toy-elevator", FAMILY_B1_HEIGHTS.liftTop, 0);
  const start = edgeEntry(course, edge("train-station", "toy-elevator"), atTop, 1.5, 0);
  const simulation = createGrowthSimulation(resolved, stage, START_MOVES, start, atTop);
  const lift = course.platforms.find((entry) => entry.id === "toy-elevator")!;
  let fell = false;
  for (let frame = 0; frame < 60 * 6 && !fell; frame += 1) {
    const deltaX = lift.center.x - simulation.state.position.x;
    const deltaZ = lift.center.z - simulation.state.position.z;
    const distance = Math.hypot(deltaX, deltaZ) || 1;
    growthStep(simulation, { move: { moveX: deltaX / distance, moveY: -deltaZ / distance } });
    fell = simulation.recoveries > 0;
  }
  for (let frame = 0; frame < 60; frame += 1) growthStep(simulation, { move: { moveX: 0, moveY: 0 } });
  return {
    fell,
    checkpointId: simulation.state.checkpointId,
    supportId: simulation.state.grounded ? simulation.state.supportId : null,
  };
}

describe("family B1 shape (f)", () => {
  it("climbs from the nap rug to a 6.9 m top shelf, the gentlest World B chapter (R8)", () => {
    const profile = FAMILY_B1_MAIN_PATH.map((id) => top(id));
    expect(profile).toEqual([
      0, 0, 0.3, 0.6, 0.9, 0.9, 1.8, 1.8, 2.1, 2.4, 2.4, 2.7, 2.7, 2.7, 2.7, 2.7, 4.5, 4.5, 4.5, 4.8, 5.1,
      4.8, 4.5, 4.5, 5.7, 5.7, 6.9, 6.9, 6.9,
    ]);
    const peak = Math.max(...profile);
    expect(peak).toBe(FAMILY_B1_HEIGHTS.peak);
    // D-07: the required route climbs at least 4 m through at least three tiers.
    expect(peak - profile[0]!).toBeGreaterThanOrEqual(4);
    expect(new Set(profile).size).toBeGreaterThanOrEqual(3);
    // It peaks at the end: the top shelf, the boss rug and the toy chest.
    expect(FAMILY_B1_MAIN_PATH.slice(-3).map((id) => top(id))).toEqual([6.9, 6.9, 6.9]);
    // R8: nothing anywhere stands above 7 m (lift top stops and branches included).
    for (const piece of surfaces().values())
      expect(top(piece.id), piece.id).toBeLessThanOrEqual(7);
    // R8: every required mover and sweeper stands at or below 3 m.
    const movers = FAMILY_B1_MAIN_PATH.filter((id) => surface(id).type === "moving-platform");
    expect(movers).toEqual(["toy-train"]);
    for (const id of movers) expect(top(id), id).toBeLessThanOrEqual(FAMILY_B1_HEIGHTS.lowZoneTop);
    const sweepers = document.pieces.filter((piece) => piece.type === "sweeper");
    expect(sweepers.map((piece) => piece.id)).toEqual(["crib-mobile", "book-slider"]);
    for (const sweeper of sweepers)
      expect(sweeper.center.y - 0.22, sweeper.id).toBeLessThanOrEqual(FAMILY_B1_HEIGHTS.lowZoneTop);
    // R8: at most one required lift, and it is the toy elevator's 1.8 m ride.
    expect(REQUIRED_LIFTS).toEqual(["toy-elevator"]);
    const stops = authoredSurfaceTopRange(surface("toy-elevator"));
    expect(stops.min).toBeCloseTo(FAMILY_B1_HEIGHTS.liftBottom, 6);
    expect(stops.max).toBeCloseTo(FAMILY_B1_HEIGHTS.liftTop, 6);
  });

  it("reaches the boss by the pillow bounce chain, not by lift (R9)", () => {
    const bossIndex = FAMILY_B1_MAIN_PATH.indexOf("boss-rug");
    const approach = FAMILY_B1_MAIN_PATH.slice(FAMILY_B1_MAIN_PATH.indexOf("toy-piano"), bossIndex + 1);
    expect(edgesOf(approach).map((entry) => entry.mode)).toEqual(["walk", "bounce", "walk", "bounce", "jump"]);
    expect(approach.some((id) => surface(id).type === "lift")).toBe(false);
  });

  it("keeps HP retries short: minor two beside the boss, minor one just before ordinaries 3 and 4 (R5)", () => {
    const route = bossRetryRoute(document)!;
    expect(route.lifts).toBe(0);
    expect(route.meters).toBeLessThanOrEqual(25);
    const index = (id: string) => FAMILY_B1_MAIN_PATH.indexOf(id as (typeof FAMILY_B1_MAIN_PATH)[number]);
    const minorOne = index(level.anchors.memories["minor-one"].platformId);
    const minorTwo = index(level.anchors.memories["minor-two"].platformId);
    expect(index(level.anchors.encounters["ordinary-3"].platformId)).toBe(minorOne + 1);
    expect(index(level.anchors.encounters["ordinary-4"].platformId)).toBe(minorOne + 5);
    expect(index(level.anchors.encounters.boss.platformId)).toBe(minorTwo + 1);
    // No lift between minor one and ordinaries 3 and 4.
    for (const id of FAMILY_B1_MAIN_PATH.slice(minorOne, index("toy-piano") + 1))
      expect(surface(id).type, id).not.toBe("lift");
  });

  it("points every optional route away from the camera and gives each a golden rattle (R3, R10)", () => {
    for (const branch of FAMILY_B1_BRANCHES)
      for (let step = 0; step + 1 < branch.length; step += 1) {
        const from = surface(branch[step]!);
        const to = surface(branch[step + 1]!);
        const deltaX = to.center.x - from.center.x;
        const deltaZ = to.center.z - from.center.z;
        const degrees = deltaZ <= 0 ? 0 : (Math.atan2(deltaZ, Math.abs(deltaX)) * 180) / Math.PI;
        expect(degrees, `${from.id}->${to.id}`).toBeLessThanOrEqual(30);
      }
    const plan = planCasinoCollectibles({ authored: document, course: resolved.course });
    expect(plan?.tickets.map((ticket) => ticket.platformId)).toEqual(["tower-block-3", "pillow-fort"]);
    // The pillow fort is a bounce-pad route: B1's age-0 optional route (R10).
    expect(edgesOf(FAMILY_B1_BRANCHES[1]!).map((entry) => entry.mode)).toEqual(["walk", "bounce", "drop"]);
  });

  it("dresses the playroom only with its own kit, clear of the route (R12)", () => {
    const decor = level.decor ?? [];
    const playroom = new Set(themeKitPropsFor("playroom").map((prop) => prop.id));
    expect(decor.length).toBeGreaterThan(0);
    expect(decor.length).toBeLessThanOrEqual(200);
    for (const entry of decor) {
      expect(playroom.has(entry.kitPropId), entry.id).toBe(true);
      expect(entry.id).toMatch(/^[a-z][a-z0-9-]{0,79}$/);
    }
    // The validator's decor clearance already ran in the zero-issue check.
    expect(validateAuthoredLevelDocument(document).filter((entry) => entry.code.startsWith("decor."))).toEqual([]);
  });

  it("stays inside the shared course budgets", () => {
    const counts = {
      platforms: surfaces().size,
      checkpoints: document.pieces.filter((piece) => piece.type === "checkpoint").length,
      sweepers: document.pieces.filter((piece) => piece.type === "sweeper").length,
      pieces: document.pieces.length,
      connections: document.connections.length,
    };
    expect(counts.platforms).toBeLessThanOrEqual(AUTHORED_LEVEL_LIMITS.maxPlatforms);
    expect(counts.checkpoints).toBeLessThanOrEqual(AUTHORED_LEVEL_LIMITS.maxCheckpoints);
    expect(counts.pieces).toBeLessThanOrEqual(AUTHORED_LEVEL_LIMITS.maxPieces);
    expect(counts.connections).toBeLessThanOrEqual(AUTHORED_LEVEL_LIMITS.maxConnections);
    expect(FAMILY_B1_MAIN_PATH.length).toBeLessThanOrEqual(AUTHORED_LEVEL_LIMITS.maxPathNodes);
  });
});
