/**
 * Family World A, chapter A2 "Harbor Rescue" (PLAN-019). The generator's
 * level is checked against:
 *
 * - the real validator inside a world project;
 * - the family lints (preset a);
 * - the patient scripted kid over the required route, with only the moves
 *   of age 2;
 * - the R2 pad sticks and the R6 lift walk-ins;
 * - every branch edge and practice miss;
 * - the climb the chapter claims.
 *
 * The fixtures are synthetic: the fictional World A birth date and parody
 * placeholder candidates. No real names, dates or photos.
 */
import { describe, expect, it } from "vitest";
import {
  AUTHORED_LEVEL_LIMITS,
  authoredSurfaceBounds,
  authoredSurfaceTopRange,
  isAuthoredSurfacePiece,
  resolveAuthoredLevelDocument,
  validateAuthoredLevelDocument,
  type AuthoredConnection,
  type AuthoredLevelDocument,
  type AuthoredSurfacePiece,
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
import { bossRetryRoute, lintFamilyChapter } from "../../src/shared/family-world-lint";
import {
  decorWorldBounds,
  placeableThemeKitProps,
  themeKitProp,
} from "../../src/shared/theme-kits";
import { planCasinoCollectibles } from "../../src/game/casino-tokens";
import {
  chapterCommands,
  worldShellCommands,
  type WorldShellChapter,
} from "../../scripts/levels/lib/growth-kit";
import {
  FAMILY_A2_AGES,
  FAMILY_A2_BRANCHES,
  FAMILY_A2_MAIN_PATH,
  FAMILY_A2_ROUTE_ID,
  FAMILY_A2_THEME,
  familyA2Level,
} from "../../scripts/levels/family/a2";
import { fixtureCandidate, gardenOrdinaryAs } from "../family-world-fixtures";
import {
  edgeEntry,
  sampledPlatform,
  STAGES,
  traverseEdge,
} from "../game/authored-traversal-lib";
import {
  createGrowthSimulation,
  growthStep,
  missGrowthPractice,
  motionCycleSeconds,
  traverseGrowthEdge,
} from "../game/growth-traversal-lib";
import {
  bounceWalkOn,
  liftWalkIn,
  R2_STICKS,
  runGrowthRouteWithWaits,
} from "../game/family-kid-lib";

/** WORLD-SPEC: World A's fictional birth date, used for template validation only. */
const WORLD_A_BIRTH = "2015-01-15";
/** Only the moves unlocked at the chapter's start age. */
const START_MOVES = abilitiesForAge(FAMILY_A2_AGES.fromYears);

const level = familyA2Level() as AuthoredLevelDocument;
const resolved = resolveAuthoredLevelDocument(level);

function surfaceMap(document: AuthoredLevelDocument): Map<string, AuthoredSurfacePiece> {
  return new Map(
    document.pieces.filter(isAuthoredSurfacePiece).map((piece) => [piece.id, piece]),
  );
}
const surfaces = surfaceMap(level);

function connectionFor(from: string, to: string): AuthoredConnection {
  const connection = level.connections.find(
    (candidate) => candidate.from === from && candidate.to === to,
  );
  if (!connection) throw new Error(`No connection ${from}->${to}`);
  return connection;
}

function steps(path: readonly string[]): AuthoredConnection[] {
  return path.slice(0, -1).map((from, index) => connectionFor(from, path[index + 1]!));
}

// ---------------------------------------------------------------------------
// (a) The real validator, inside a world project.
// ---------------------------------------------------------------------------

/**
 * The first chapter of a world must start on the fictional birth date, so A2
 * (ages 2 -> 5) cannot be a world's only chapter. A synthetic A1 stand-in
 * (the garden template at ages 0 -> 2) comes first, which is also how the
 * assembled World A orders them. A2 keeps its own dates, ages, copy and a
 * placeholder cast in the rescue-harbor era.
 */
const A1_STAND_IN: WorldShellChapter = {
  chapterId: "a1-stand-in",
  routeId: "a1-stand-in-route",
  name: "The Toon Clubhouse",
  subtitle: "Gadgets on the loose",
  description:
    "Bounce up the hill, ride the cliff lift and climb the clubhouse tower to face the bully cat.",
  theme: "clubhouse",
  representedDateRange: { startDate: WORLD_A_BIRTH, endDate: "2017-01-15" },
  recoveredAge: { fromYears: 0, toYears: 2 },
  previewMemories: [
    { slotId: "minor-one", date: "2016-01-15", label: "First wobbly steps" },
    { slotId: "minor-two", date: "2016-07-15", label: "Summer picnic" },
    { slotId: "major", date: "2017-01-15", label: "Turning 2!" },
  ],
};

const A2_CHAPTER: WorldShellChapter = {
  chapterId: "a2-harbor",
  routeId: FAMILY_A2_ROUTE_ID,
  name: "Harbor Rescue",
  subtitle: "Boats, rooftops and a lookout",
  description:
    "Ride the boats, hop the town rooftops and climb the lookout to stop the rival mayor.",
  theme: FAMILY_A2_THEME,
  representedDateRange: { startDate: "2017-01-15", endDate: "2020-01-15" },
  recoveredAge: { ...FAMILY_A2_AGES },
  previewMemories: [
    { slotId: "minor-one", date: "2018-01-15", label: "Splashing at the harbor" },
    { slotId: "minor-two", date: "2019-01-15", label: "A brave rescue" },
    { slotId: "major", date: "2020-01-15", label: "Turning 5!" },
  ],
};

const HARBOR_WINDOW = { startDate: "2013-08-12", endDate: "2026-12-31" };
const CAST = {
  gadget: fixtureCandidate("a2-test-gadget", "Runaway Gadget", "toon-clubhouse-v1", "ordinary-a", {
    startDate: "2006-05-05",
    endDate: "2016-11-06",
  }),
  cat: fixtureCandidate("a2-test-bully-cat", "Captain Bully Cat", "toon-clubhouse-v1", "boss", {
    startDate: "2006-05-05",
    endDate: "2016-11-06",
  }),
  kitten: fixtureCandidate("a2-test-mischief-kitten", "Mischief Kitten", "rescue-harbor-v1", "ordinary-a", HARBOR_WINDOW),
  mayor: fixtureCandidate("a2-test-rival-mayor", "Mayor Humdrum", "rescue-harbor-v1", "boss", HARBOR_WINDOW),
};

function buildWorld(): LevelEditorProjectV2 {
  const a1 = chapterCommands(A1_STAND_IN.chapterId);
  const a2 = chapterCommands(A2_CHAPTER.chapterId);
  const candidate = (id: string) => ({ source: "candidate" as const, candidateId: id });
  const commands: LevelEditorCommand[] = [
    ...worldShellCommands({ fictionalBirthDate: WORLD_A_BIRTH, chapters: [A1_STAND_IN, A2_CHAPTER] }),
    a1.setAnchor("encounter.ordinary-2", gardenOrdinaryAs("ordinary-2", "ordinary-a")),
    a1.setAnchor("encounter.ordinary-4", gardenOrdinaryAs("ordinary-4", "ordinary-a")),
    a1.addCandidate("ordinary-1", CAST.gadget),
    a1.assign("ordinary-2", candidate(CAST.gadget.id)),
    a1.assign("ordinary-3", candidate(CAST.gadget.id)),
    a1.assign("ordinary-4", candidate(CAST.gadget.id)),
    a1.addCandidate("boss", CAST.cat),
    a2.replaceLevel(familyA2Level()),
    // R11: one ordinary identity in every ordinary slot and the bonus.
    a2.addCandidate("ordinary-1", CAST.kitten),
    a2.assign("ordinary-2", candidate(CAST.kitten.id)),
    a2.assign("ordinary-3", candidate(CAST.kitten.id)),
    a2.assign("ordinary-4", candidate(CAST.kitten.id)),
    a2.assign("bonus-1", candidate(CAST.kitten.id)),
    a2.addCandidate("boss", CAST.mayor),
  ];
  const result = applyLevelEditorCommands(
    createWorldEditorProject({ projectId: "family-a2-check", catalogVersion: "parody-catalog-v7" }),
    { expectedRevision: 0, commands },
  );
  if (!result.ok)
    throw new Error(result.issues.map((entry) => `${entry.path}: ${entry.message}`).join("; "));
  return result.project as LevelEditorProjectV2;
}

describe("A2 generator and validator", () => {
  it("builds the same plain document on every call", () => {
    expect(JSON.stringify(familyA2Level())).toBe(JSON.stringify(level));
    expect(level).toMatchObject({
      schemaVersion: "authored-level-v4",
      id: FAMILY_A2_ROUTE_ID,
      theme: "harbor",
    });
    expect(level.mainPath).toEqual(FAMILY_A2_MAIN_PATH);
    expect(level.branches).toEqual(FAMILY_A2_BRANCHES);
  });

  it("validates with zero issues on its own and inside World A's order", () => {
    expect(validateAuthoredLevelDocument(level)).toEqual([]);
    const world = buildWorld();
    expect(validateLevelEditorProject(world)).toEqual([]);
    const chapter = world.chapters[1]!;
    expect(chapter.level).toEqual(level);
    expect(chapter.recoveredAge).toEqual({ fromYears: 2, toYears: 5 });
    // High jump is new at age 2 whether A2 follows A1 or opens a world, so
    // the first required high jump is a practice stretch either way.
    for (const previous of [0, undefined])
      expect(
        validateGrowthRequirements(level, {
          startAgeYears: 2,
          ...(previous === undefined ? {} : { previousStartAgeYears: previous }),
        }),
      ).toEqual([]);
  });

  it("anchors every required slot, one ordinary kind, three friendlies and the bonus", () => {
    const encounters = level.anchors.encounters;
    for (const slot of ["ordinary-1", "ordinary-2", "ordinary-3", "ordinary-4"] as const)
      expect(encounters[slot].kind, slot).toBe("ordinary-a");
    expect(encounters.boss).toMatchObject({ kind: "boss", platformId: "lookout-deck" });
    expect(encounters["bonus-1"]).toMatchObject({ kind: "ordinary-a", platformId: "laundry-annex" });
    expect(Object.keys(level.anchors.friendlies).sort()).toEqual(["friendly-1", "friendly-2", "friendly-3"]);
    expect(level.anchors.memories["minor-one"].platformId).toBe("crane-roof");
    expect(level.anchors.memories["minor-two"].platformId).toBe("tower-plaza");
    // R1: the major memory, reward respawn and finish end the chapter together.
    for (const anchor of [level.anchors.memories.major, level.anchors.rewardRespawn, level.anchors.finish])
      expect(anchor.platformId).toBe("beacon-crown");
  });

  it("stays inside the chapter budgets", () => {
    const count = (type: string) => level.pieces.filter((piece) => piece.type === type).length;
    expect({
      platforms: count("platform"),
      movers: count("moving-platform"),
      lifts: count("lift"),
      pads: count("bounce-pad"),
      sweepers: count("sweeper"),
      checkpoints: count("checkpoint"),
      connections: level.connections.length,
      branches: level.branches.length,
      decor: level.decor?.length,
    }).toEqual({
      platforms: 33,
      movers: 6,
      lifts: 1,
      pads: 2,
      sweepers: 3,
      checkpoints: 14,
      connections: 44,
      branches: 3,
      decor: 72,
    });
    const bounds = [...surfaces.values()].map(authoredSurfaceBounds);
    const spanX = Math.max(...bounds.map((b) => b.maxX)) - Math.min(...bounds.map((b) => b.minX));
    const spanZ = Math.max(...bounds.map((b) => b.maxZ)) - Math.min(...bounds.map((b) => b.minZ));
    expect(spanX).toBeLessThan(60);
    expect(spanZ).toBeLessThanOrEqual(AUTHORED_LEVEL_LIMITS.maxSceneSpan);
    expect(spanZ).toBeCloseTo(174.23, 2);
  });
});

// ---------------------------------------------------------------------------
// (b) Family lints, World A preset.
// ---------------------------------------------------------------------------

describe("A2 family lints (World A)", () => {
  it("returns no findings at all", () => {
    // No errors, and no warnings to justify: every lift landing is flush, and
    // the cargo lift's boarding landing holds a checkpoint (market-safe).
    expect(lintFamilyChapter(level, { world: "a" })).toEqual([]);
  });

  it("keeps the boss retry short (R5)", () => {
    const route = bossRetryRoute(level);
    expect(route).toEqual({ meters: expect.any(Number), lifts: 0 });
    expect(route!.meters).toBeLessThanOrEqual(25);
    expect(route!.meters).toBeCloseTo(21.13, 1);
  });

  it("keeps optional branches from heading toward the camera too (R3)", () => {
    for (const branch of level.branches)
      for (const connection of steps(branch)) {
        const from = surfaces.get(connection.from)!;
        const to = surfaces.get(connection.to)!;
        const deltaX = to.center.x - from.center.x;
        const deltaZ = to.center.z - from.center.z;
        if (deltaZ <= 0) continue;
        const degrees = (Math.atan2(deltaZ, Math.abs(deltaX)) * 180) / Math.PI;
        expect(degrees, `${connection.from}->${connection.to}`).toBeLessThanOrEqual(30);
      }
  });
});

// ---------------------------------------------------------------------------
// (c) The patient kid over the whole required route (R10).
// ---------------------------------------------------------------------------

describe("A2 required route with only the moves of age 2", () => {
  it.each(STAGES)("the %s avatar completes it with no recovery in at least 70 s", (stage) => {
    // The chapter starts at age 2, so the infant model applies; the child
    // model is checked too because it is cheap.
    const run = runGrowthRouteWithWaits(resolved, level.mainPath, stage, START_MOVES);
    expect(run.failedAt).toBeNull();
    expect(run.recoveries).toBe(0);
    expect(run.completed).toHaveLength(level.mainPath.length - 1);
    // Measured at 77.1 s, of which 1.5 s is spent waiting for sweepers.
    expect(run.seconds).toBeGreaterThanOrEqual(70);
    expect(run.bounces).toContain("trampoline");
  });

  it("needs the high jump at the climax: jump alone fails every tower stair", () => {
    const climax = steps(["tower-plaza", "tower-step-1", "tower-step-2", "tower-step-3", "lookout-deck"]);
    for (const stage of STAGES)
      for (const connection of climax) {
        expect(connection.requires).toBe("high-jump");
        expect(traverseGrowthEdge(resolved, connection, stage, START_MOVES).reached).toBe(true);
        expect(traverseGrowthEdge(resolved, connection, stage, abilitiesForAge(0)).reached).toBe(false);
      }
  });
});

// ---------------------------------------------------------------------------
// (d) Bounce pads at partial stick (R2) and lift walk-ins (R6).
// ---------------------------------------------------------------------------

describe("A2 pads and lifts", () => {
  const bounces = level.connections.filter((connection) => connection.mode === "bounce");

  it("bounces a walking child onto every landing at stick 0.4-1.0", () => {
    expect(bounces.map((connection) => connection.from)).toEqual(["trampoline", "tower-pad"]);
    for (const connection of bounces) {
      const approach = level.connections.find(
        (candidate) => candidate.to === connection.from && candidate.mode === "walk",
      )!;
      for (const stage of STAGES)
        for (const stick of R2_STICKS) {
          const result = bounceWalkOn(resolved, approach.from, connection.from, connection.to, {
            stick,
            stage,
            abilities: START_MOVES,
          });
          expect(result.reached, `${connection.from} ${stage} at ${stick}`).toBe(true);
          expect(result.bounces).toBeGreaterThan(0);
        }
    }
  });

  it("carries every child who walks at the cargo lift; none falls into the shaft", () => {
    const phases = 12;
    for (const stage of STAGES) {
      // v2's deep car closes the shaft: every blind walk-in rides through
      // (v1's 0.4 m car let 8 of 12 fall in).
      for (const stick of [0.4, 1])
        for (const runUp of [0.6, 1.5, 3])
          expect(
            liftWalkIn(resolved, "cargo-lift", "fish-market", "crane-roof", {
              phases,
              stage,
              stick,
              runUp,
              abilities: START_MOVES,
            }),
            `${stage}@${stick} run-up ${runUp}`,
          ).toEqual({ ok: phases, fell: 0, other: 0 });
      expect(shaftFallCheckpoints("cargo-lift", "fish-market", phases, stage)).toEqual([]);
    }
  }, 120_000);
});

/**
 * Walks at the lift like `liftWalkIn` and reports the checkpoint each shaft
 * fall recovers to: the boarding landing's own, so a fall costs a few steps.
 */
function shaftFallCheckpoints(liftId: string, fromId: string, phases: number, stage: (typeof STAGES)[number]) {
  const course = resolved.course;
  const lift = course.platforms.find((platform) => platform.id === liftId)!;
  const cycle = motionCycleSeconds(lift);
  const recovered: Array<string | null> = [];
  for (let index = 0; index < phases; index += 1) {
    const startTime = (cycle * index) / phases;
    const start = edgeEntry(course, { from: fromId, to: liftId, mode: "ride" }, startTime, 1.5, 0);
    const simulation = createGrowthSimulation(resolved, stage, START_MOVES, start, startTime);
    growthStep(simulation, { move: { moveX: 0, moveY: 0 } });
    for (let frame = 0; frame < 600; frame += 1) {
      const target = sampledPlatform(course, liftId, simulation.timeSeconds).center;
      const deltaX = target.x - simulation.state.position.x;
      const deltaZ = target.z - simulation.state.position.z;
      const distance = Math.hypot(deltaX, deltaZ) || 1;
      growthStep(simulation, { move: { moveX: deltaX / distance, moveY: -deltaZ / distance } });
      if (simulation.recoveries > 0) {
        recovered.push(simulation.state.checkpointId);
        break;
      }
      if (simulation.state.grounded && simulation.state.supportId === liftId) break;
    }
  }
  return recovered;
}

// ---------------------------------------------------------------------------
// (e) Every edge with its declared move; every practice miss.
// ---------------------------------------------------------------------------

describe("A2 edges", () => {
  const laterals = [0, -0.5, 0.5];

  it.each(STAGES)("crosses every required and branch edge (%s)", (stage) => {
    const failures: string[] = [];
    for (const path of [level.mainPath, ...level.branches])
      for (const connection of steps(path))
        for (const lateral of laterals)
          if (!traverseGrowthEdge(resolved, connection, stage, START_MOVES, lateral).reached)
            failures.push(`${connection.from}->${connection.to}@${lateral}`);
    expect(failures).toEqual([]);
  });

  it("declares only moves unlocked at age 2, and descends by drop", () => {
    for (const connection of level.connections)
      if (connection.requires !== undefined) expect(connection.requires).toBe("high-jump");
    // R7: the one descent of more than a plain jump's 0.35 m uses a drop.
    expect(level.connections.filter((connection) => connection.mode === "drop")).toEqual([
      { from: "crows-nest", to: "fish-market", mode: "drop" },
    ]);
  });

  it.each(STAGES)("lands every deliberate practice miss on its catch floor and walks back (%s)", (stage) => {
    const practice = level.connections.filter((connection) => connection.safeMissPlatformId);
    expect(practice.map((connection) => `${connection.from}->${connection.to}`)).toEqual([
      "beach->dune-1",
      "dune-1->dune-2",
      "dune-2->dune-3",
      "tower-plaza->tower-step-1",
      "tower-step-1->tower-step-2",
      "tower-step-2->tower-step-3",
      "tower-step-3->lookout-deck",
    ]);
    for (const connection of practice) {
      const miss = missGrowthPractice(resolved, connection, stage, START_MOVES);
      expect(miss.startedOnSource, `${connection.from}->${connection.to}`).toBe(true);
      expect(miss.reached, `${connection.from}->${connection.to}`).toBe(true);
      expect(miss.supportId).toBe(connection.safeMissPlatformId);
    }
    for (const retry of [connectionFor("sandbar", "beach"), connectionFor("tower-ring", "tower-plaza")])
      expect(traverseEdge(resolved, retry, stage).reached, `${retry.from}->${retry.to}`).toBe(true);
  });

  it("holds a golden bone on each optional branch (R10)", () => {
    const plan = planCasinoCollectibles({ authored: resolved.document, course: resolved.course });
    expect(plan?.tickets.map((ticket) => ticket.platformId)).toEqual([
      "crows-nest",
      "annex-hop",
      "water-tower",
    ]);
  });
});

// ---------------------------------------------------------------------------
// (f) The climb: the blueprint's profile as amended by the rulings.
// ---------------------------------------------------------------------------

describe("A2 climb profile", () => {
  const tops = level.mainPath.map((id) => authoredSurfaceTopRange(surfaces.get(id)!).max);

  it("never descends on the required route and peaks at the beacon crown", () => {
    for (let index = 1; index < tops.length; index += 1)
      expect(tops[index], level.mainPath[index]).toBeGreaterThanOrEqual(tops[index - 1]! - 1e-9);
    expect(tops[0]).toBe(0);
    expect(Math.max(...tops)).toBe(13.4);
    expect(level.mainPath.at(-1)).toBe("beacon-crown");
    // The boss waits on the lookout deck, 12.7 m up.
    expect(authoredSurfaceTopRange(surfaces.get("lookout-deck")!).max).toBe(12.7);
    expect(new Set(tops).size).toBeGreaterThanOrEqual(3);
  });

  it("climbs in the claimed stages: harbor, lift, rooftops, trampoline, tower", () => {
    const top = (id: string) => authoredSurfaceTopRange(surfaces.get(id)!);
    expect(top("sea-wall").max).toBe(1.8);
    expect(top("cargo-lift")).toEqual({ min: 1.8, max: 5.4 });
    expect(top("laundry-roof").max).toBe(6.6);
    expect(top("clock-roof").max - top("trampoline").max).toBeCloseTo(2.4, 6);
    expect(top("tower-plaza").max).toBe(9.9);
    for (const connection of steps(["tower-plaza", "tower-step-1", "tower-step-2", "tower-step-3", "lookout-deck", "beacon-crown"]))
      expect(top(connection.to).max - top(connection.from).max, connection.to).toBeCloseTo(0.7, 6);
  });
});

// ---------------------------------------------------------------------------
// Decor (R12): harbor and shared props only, never a false foothold.
// ---------------------------------------------------------------------------

describe("A2 decor", () => {
  it("uses only harbor-kit and shared props, at most 200", () => {
    const placeable = new Set(placeableThemeKitProps("harbor").map((prop) => prop.id));
    const decor = level.decor ?? [];
    expect(decor.length).toBeLessThanOrEqual(200);
    for (const entry of decor) expect(placeable.has(entry.kitPropId), entry.id).toBe(true);
    // The harbor kit leads (R12: prefer the era kit).
    const harbor = decor.filter((entry) => themeKitProp(entry.kitPropId)?.theme === "harbor");
    expect(harbor.length).toBeGreaterThan(decor.length / 2);
  });

  it("keeps each prop near a deck well below or well above its top", () => {
    // The blueprint's fake-foothold rule: within 2.5 m of a walkable
    // footprint, a prop's top is at least 0.5 m below that surface's lowest
    // top or at least 1.4 m above its highest.
    const problems: string[] = [];
    for (const entry of level.decor ?? []) {
      const box = decorWorldBounds(themeKitProp(entry.kitPropId)!.bounds, entry);
      for (const surface of surfaces.values()) {
        const bounds = authoredSurfaceBounds(surface);
        const distance = Math.hypot(
          Math.max(0, bounds.minX - box.max.x, box.min.x - bounds.maxX),
          Math.max(0, bounds.minZ - box.max.z, box.min.z - bounds.maxZ),
        );
        if (distance >= 2.5) continue;
        const range = authoredSurfaceTopRange(surface);
        if (box.max.y > range.min - 0.5 + 1e-6 && box.max.y < range.max + 1.4 - 1e-6)
          problems.push(`${entry.id} near ${surface.id}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
