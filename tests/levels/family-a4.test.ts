/**
 * World A chapter 4, "Rat Casino After Hours" (PLAN-019): the A4 generator's
 * level is validator-clean inside a World A shell, kind by the family lints
 * (rulings R1–R6), and playable end to end by the scripted child using only
 * the moves unlocked at the chapter's start age of 9. The world uses the
 * World A template's fictional birth date and synthetic captions only.
 */
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  FAMILY_A4_CAST,
  FAMILY_A4_HEIGHTS,
  FAMILY_A4_ROUTE_ID,
  familyA4Level,
} from "../../scripts/levels/family/a4";
import {
  chapterCommands,
  worldShellCommands,
  type WorldShellChapter,
} from "../../scripts/levels/lib/growth-kit";
import {
  abilitiesForAge,
  GROWTH_MOVE_IDS,
  type AbilitySet,
} from "../../src/shared/abilities";
import {
  authoredStrikeEnvelope,
  authoredSurfaceBounds,
  authoredSurfaceGap,
  isAuthoredSurfacePiece,
  resolveAuthoredLevelDocument,
  validateAuthoredLevelDocument,
  type AuthoredConnection,
  type AuthoredLevelDocument,
  type AuthoredSurfacePiece,
} from "../../src/shared/authored-level";
import { validateGrowthRequirements } from "../../src/shared/authored-level-growth";
import {
  applyLevelEditorCommands,
  createWorldEditorProject,
  validateLevelEditorProject,
  type LevelEditorCommand,
} from "../../src/shared/editor-project";
import { bossRetryRoute, lintFamilyChapter } from "../../src/shared/family-world-lint";
import type { ParodyPeriodId } from "../../src/shared/parody-catalog";
import { placeableThemeKitProps } from "../../src/shared/theme-kits";
import { CasinoScene } from "../../src/game/casino-scene";
import { planCasinoCollectibles } from "../../src/game/casino-tokens";
import type { LevelLayout } from "../../src/game/level";
import type { SceneAssets } from "../../src/game/scene-assets";
import { fixtureCandidate } from "../family-world-fixtures";
import { edgeEntry, STAGES, traverseSafeRetry } from "../game/authored-traversal-lib";
import { bounceWalkOn, liftWalkIn, R2_STICKS, runGrowthRouteWithWaits } from "../game/family-kid-lib";
import {
  createGrowthSimulation,
  growthStep,
  missGrowthPractice,
  traverseGrowthEdge,
} from "../game/growth-traversal-lib";

const document = familyA4Level() as AuthoredLevelDocument;
const level = resolveAuthoredLevelDocument(document);
/** The chapter's start age: jump, high jump, double jump and glide. */
const START_AGE = 9;
const AGE_NINE = abilitiesForAge(START_AGE);

const surfaces = new Map<string, AuthoredSurfacePiece>();
for (const piece of document.pieces) if (isAuthoredSurfacePiece(piece)) surfaces.set(piece.id, piece);
const surface = (id: string): AuthoredSurfacePiece => {
  const found = surfaces.get(id);
  if (!found) throw new Error(`Surface ${id} is missing`);
  return found;
};
const top = (id: string) => surface(id).center.y + surface(id).size.y / 2;
const connection = (from: string, to: string): AuthoredConnection => {
  const found = document.connections.find((entry) => entry.from === from && entry.to === to);
  if (!found) throw new Error(`Connection ${from}->${to} is missing`);
  return found;
};
const mainSteps = document.mainPath.slice(1).map((to, index) => connection(document.mainPath[index]!, to));
const branchSteps = document.branches.flatMap((branch) =>
  branch.slice(1).map((to, index) => connection(branch[index]!, to)),
);
const label = (entry: AuthoredConnection) => `${entry.from}->${entry.to}`;

/** The shortest ladder prefix that holds the connection's declared move. */
function declaredMoveOnly(entry: AuthoredConnection): AbilitySet {
  return GROWTH_MOVE_IDS.slice(0, GROWTH_MOVE_IDS.indexOf(entry.requires ?? "jump") + 1);
}

// ---------------------------------------------------------------------------
// (a) The real validators, alone and inside a World A shell.
// ---------------------------------------------------------------------------

/** World A's fictional birth date (WORLD-SPEC; template validation only). */
const WORLD_A_BIRTH_DATE = "2015-01-15";

function placeholder(
  key: string,
  theme: WorldShellChapter["theme"],
  ages: [number, number],
  dates: [string, string, string, string],
): WorldShellChapter {
  return {
    chapterId: `${key}-stand-in`,
    routeId: `${key}-stand-in-route`,
    name: `Stand-in ${key.toUpperCase()}`,
    subtitle: "A garden-template stand-in for a sibling chapter",
    description: "Holds the chapter list, dates and ages in place so A4 validates in position.",
    theme,
    representedDateRange: { startDate: dates[0], endDate: dates[3] },
    recoveredAge: { fromYears: ages[0], toYears: ages[1] },
    previewMemories: [
      { slotId: "minor-one", date: dates[1], label: "A sunny afternoon" },
      { slotId: "minor-two", date: dates[2], label: "A day at the park" },
      { slotId: "major", date: dates[3], label: `Turning ${ages[1]}!` },
    ],
  };
}

const A4_CHAPTER: WorldShellChapter = {
  chapterId: "a4-rat-casino",
  routeId: FAMILY_A4_ROUTE_ID,
  name: "Rat Casino After Hours",
  subtitle: "The mascots are still awake",
  description: "Climb the old casino's stages, outlast the mascots and face the Rat Pit Boss.",
  theme: "casino",
  representedDateRange: { startDate: "2024-01-15", endDate: "2026-01-15" },
  recoveredAge: { fromYears: 9, toYears: 11 },
  previewMemories: [
    { slotId: "minor-one", date: "2024-09-15", label: "A night at the arcade" },
    { slotId: "minor-two", date: "2025-05-15", label: "A backstage tour" },
    { slotId: "major", date: "2026-01-15", label: "Turning 11!" },
  ],
};

function a4Commands(): LevelEditorCommand[] {
  const a4 = chapterCommands(A4_CHAPTER.chapterId);
  return [
    a4.replaceLevel(familyA4Level()),
    ...(["ordinary-1", "ordinary-2", "ordinary-3", "ordinary-4", "boss"] as const).map((slot) =>
      a4.assign(slot, FAMILY_A4_CAST.slots[slot]),
    ),
    a4.addCandidate("bonus-1", FAMILY_A4_CAST.bonus),
  ];
}

function buildWorld(chapters: readonly WorldShellChapter[], extra: readonly LevelEditorCommand[]) {
  const result = applyLevelEditorCommands(
    createWorldEditorProject({ projectId: "family-a4-check", catalogVersion: "parody-catalog-v7" }),
    {
      expectedRevision: 0,
      commands: [...worldShellCommands({ fictionalBirthDate: WORLD_A_BIRTH_DATE, chapters }), ...extra, ...a4Commands()],
    },
  );
  expect(result.ok).toBe(true);
  // The editor reports the whole project's validation with the result.
  expect(result.issues).toEqual(validateLevelEditorProject(result.project));
  return result.project;
}

/** A stand-in chapter's cast: one ordinary-a, one ordinary-b and a boss from its era. */
function standInCast(
  chapter: WorldShellChapter,
  periodId: ParodyPeriodId,
  window: { startDate: string; endDate: string },
): LevelEditorCommand[] {
  const commands = chapterCommands(chapter.chapterId);
  const a = fixtureCandidate(`${chapter.chapterId}-grunt-a`, "Stand-in Grunt", periodId, "ordinary-a", window);
  const b = fixtureCandidate(`${chapter.chapterId}-grunt-b`, "Stand-in Helper", periodId, "ordinary-b", window);
  return [
    commands.addCandidate("ordinary-1", a),
    commands.addCandidate("ordinary-2", b),
    commands.assign("ordinary-3", { source: "candidate", candidateId: a.id }),
    commands.assign("ordinary-4", { source: "candidate", candidateId: b.id }),
    commands.addCandidate("boss", fixtureCandidate(`${chapter.chapterId}-boss`, "Stand-in Boss", periodId, "boss", window)),
  ];
}

describe("A4 validity", () => {
  it("is a pure generator of a v4 casino level with the chapter's route id", () => {
    expect(familyA4Level()).toEqual(familyA4Level());
    expect(JSON.stringify(familyA4Level())).toBe(JSON.stringify(document));
    expect(document).toMatchObject({ schemaVersion: "authored-level-v4", id: "family-a4-casino", theme: "casino" });
  });

  it("passes the level validator and the age-9 growth rules", () => {
    expect(validateAuthoredLevelDocument(document)).toEqual([]);
    // A3 starts at 5, so glide is the only move this chapter unlocks.
    expect(validateGrowthRequirements(document, { startAgeYears: START_AGE, previousStartAgeYears: 5 })).toEqual([]);
    // The first required glide is the practice: without its catch floor the rule fires.
    const unpracticed = {
      ...document,
      connections: document.connections.map((entry) =>
        entry.from === "spotlight-perch" && entry.to === "glide-landing"
          ? { from: entry.from, to: entry.to, mode: entry.mode, requires: entry.requires }
          : entry,
      ),
    };
    expect(
      validateGrowthRequirements(unpracticed, { startAgeYears: START_AGE, previousStartAgeYears: 5 }).map(
        (entry) => entry.code,
      ),
    ).toEqual(["requires.practice-missing"]);
  });

  it("validates with zero issues as World A's fourth chapter, with its cast", () => {
    const a1 = placeholder("a1", "clubhouse", [0, 2], ["2015-01-15", "2015-09-15", "2016-05-15", "2017-01-15"]);
    const a2 = placeholder("a2", "harbor", [2, 5], ["2017-01-15", "2018-01-15", "2019-01-15", "2020-01-15"]);
    const a3 = placeholder("a3", "rooftop", [5, 9], ["2020-01-15", "2021-05-15", "2022-09-15", "2024-01-15"]);
    const project = buildWorld(
      [a1, a2, a3, A4_CHAPTER],
      [
        ...standInCast(a1, "toon-clubhouse-v1", { startDate: "2006-05-05", endDate: "2016-11-06" }),
        ...standInCast(a2, "rescue-harbor-v1", { startDate: "2013-08-12", endDate: "2026-12-31" }),
        ...standInCast(a3, "hero-city-v1", { startDate: "2018-12-14", endDate: "2026-12-31" }),
      ],
    );
    expect(validateLevelEditorProject(project)).toEqual([]);
    const chapter = project.chapters.at(-1)!;
    expect(chapter.level).toEqual(familyA4Level());
  });

  it("alone in a one-chapter world reports only what a first chapter aged 9 must", () => {
    // A one-chapter world cannot start at the birth date, and its first chapter
    // has no earlier start age, so every move above jump counts as new there.
    const project = buildWorld([A4_CHAPTER], []);
    expect(
      validateLevelEditorProject(project).map((entry) => `${entry.code} ${entry.message.split(" is newly")[0]}`),
    ).toEqual([
      "date.birth-start The first represented date range must start on the fictional birth date",
      "requires.practice-missing The first required high-jump",
      "requires.practice-missing The first required double-jump",
    ]);
  });
});

// ---------------------------------------------------------------------------
// (b) Family lints, World A preset.
// ---------------------------------------------------------------------------

describe("A4 family lints", () => {
  it("has no findings with the World A preset", () => {
    // No warnings either: both lift boarding landings hold checkpoints and
    // both lifts are flush with their landings at each stop.
    expect(lintFamilyChapter(document, { world: "a" })).toEqual([]);
  });

  it("keeps the boss retry short and the chapter ending on the major memory (R1, R5)", () => {
    expect(bossRetryRoute(document)).toEqual({ meters: expect.any(Number), lifts: 0 });
    expect(bossRetryRoute(document)!.meters).toBeLessThanOrEqual(25);
    const { memories, rewardRespawn, finish, encounters } = document.anchors;
    expect(document.mainPath.indexOf(memories["minor-two"].platformId)).toBe(
      document.mainPath.indexOf(encounters.boss.platformId) - 1,
    );
    expect(new Set([memories.major.platformId, rewardRespawn.platformId, finish.platformId])).toEqual(
      new Set([document.mainPath.at(-1)]),
    );
    // Minor one waits on the Fox Card Shark's deck, before ordinary three and four.
    expect(memories["minor-one"].platformId).toBe(encounters["ordinary-3"].platformId);
  });

  it("places only casino-kit props, at most 200", () => {
    const allowed = new Set(placeableThemeKitProps("casino").map((prop) => prop.id));
    const decor = document.decor ?? [];
    expect(decor.length).toBeGreaterThan(0);
    expect(decor.length).toBeLessThanOrEqual(200);
    // Shared props are studio-only candidates, so A4 uses the casino kit alone.
    for (const entry of decor) {
      expect(allowed.has(entry.kitPropId), entry.id).toBe(true);
      expect(entry.kitPropId.startsWith("casino-"), entry.id).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// (c) The whole required route at age 9, waiting for lifts and sweepers.
// ---------------------------------------------------------------------------

describe("A4 required route", () => {
  for (const stage of STAGES)
    it(`is completed by the patient scripted child (${stage}) with no recoveries in at least 70 s`, () => {
      const run = runGrowthRouteWithWaits(level, document.mainPath, stage, AGE_NINE);
      expect(run.failedAt).toBeNull();
      expect(run.completed).toHaveLength(document.mainPath.length - 1);
      expect(run.recoveries).toBe(0);
      expect(run.seconds).toBeGreaterThanOrEqual(70);
      // The finale is World A's longest route (R8); keep the margin measured here.
      expect(run.seconds).toBeGreaterThanOrEqual(95);
      expect(run.maxFeetY).toBeGreaterThanOrEqual(FAMILY_A4_HEIGHTS.highBoard);
    });
});

// ---------------------------------------------------------------------------
// (d) R2 bounce pads and R6 lifts, as a child plays them.
// ---------------------------------------------------------------------------

describe("A4 pads and lifts", () => {
  const requiredBounces = mainSteps.filter((entry) => entry.mode === "bounce");
  const optionalBounces = branchSteps.filter((entry) => entry.mode === "bounce");

  it("has the required bounces and lifts the blueprint names", () => {
    expect(requiredBounces.map(label)).toEqual([
      "glide-school-pad->spotlight-perch",
      "balcony-pad->moth-projection-room",
      "rigging-pad->rigging-deck-one",
    ]);
    expect(document.mainPath.filter((id) => surface(id).type === "lift")).toEqual(["service-lift", "marquee-hoist"]);
  });

  for (const entry of [...requiredBounces, ...optionalBounces])
    it(`walks onto ${entry.from} at every R2 stick and lands on ${entry.to}`, () => {
      const deck = document.connections.find((candidate) => candidate.to === entry.from && candidate.mode === "walk")!;
      expect(deck).toBeDefined();
      const failures: string[] = [];
      for (const stage of STAGES)
        for (const stick of R2_STICKS)
          for (const lateral of [-0.6, 0, 0.6]) {
            const result = bounceWalkOn(level, deck.from, entry.from, entry.to, { stick, stage, lateral });
            if (!result.reached || !result.startedOnSource) failures.push(`${stage}@${stick}/${lateral}`);
          }
      expect(failures).toEqual([]);
    });

  for (const liftId of ["service-lift", "marquee-hoist"])
    it(`${liftId} carries a child who walks in, and its boarding landing holds a checkpoint`, () => {
      const index = document.mainPath.indexOf(liftId);
      const from = document.mainPath[index - 1]!;
      const to = document.mainPath[index + 1]!;
      expect(document.pieces.some((piece) => piece.type === "checkpoint" && piece.platformId === from)).toBe(true);
      for (const stage of STAGES) {
        const result = liftWalkIn(level, liftId, from, to, { phases: 12, stage });
        // Dwell does not close the shaft (DESIGN-025 D-08 f): an arrival while
        // the lift is away falls to the boarding checkpoint; nobody is stranded.
        expect(result.ok, stage).toBeGreaterThan(0);
        expect(result.other, stage).toBe(0);
        expect(result.ok + result.fell).toBe(12);
      }
    });
});

// ---------------------------------------------------------------------------
// (e) Every edge with its move, every practice miss onto its catch floor.
// ---------------------------------------------------------------------------

describe("A4 edges", () => {
  it("crosses every required edge with only the age-9 moves", () => {
    const failures = STAGES.flatMap((stage) =>
      mainSteps
        .filter((entry) => !traverseGrowthEdge(level, entry, stage, AGE_NINE).reached)
        .map((entry) => `${stage} ${label(entry)}`),
    );
    expect(failures).toEqual([]);
  });

  it("crosses every branch edge with its declared move", () => {
    expect(branchSteps).toHaveLength(10);
    const failures = STAGES.flatMap((stage) =>
      branchSteps
        .filter((entry) => !traverseGrowthEdge(level, entry, stage, declaredMoveOnly(entry)).reached)
        .map((entry) => `${stage} ${label(entry)}`),
    );
    expect(failures).toEqual([]);
  });

  it("drops every deliberate practice miss onto the padded floor and walks back", () => {
    const practice = document.connections.filter((entry) => entry.safeMissPlatformId);
    expect(practice.map(label)).toEqual([
      "casino-foyer->token-step-one",
      "token-step-one->token-step-two",
      "spotlight-perch->glide-landing",
    ]);
    for (const stage of STAGES) {
      for (const entry of practice) {
        const miss = missGrowthPractice(level, entry, stage, AGE_NINE);
        expect(miss.startedOnSource, `${stage} ${label(entry)}`).toBe(true);
        expect(miss.reached, `${stage} ${label(entry)}`).toBe(true);
        expect(miss.supportId).toBe("casino-padded-floor");
      }
      expect(traverseSafeRetry(level, connection("casino-padded-floor", "casino-foyer"), stage).reached).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// (f) Climb and peak (R8: at least 16 m on the required route).
// ---------------------------------------------------------------------------

describe("A4 climb", () => {
  // Standing tops along the required route; a lift contributes its landings.
  const standing = document.mainPath.filter((id) => surface(id).type !== "lift");
  const tops = standing.map(top);

  it("climbs from the foyer to the 22.3 m high board and peaks there", () => {
    const start = tops[0]!;
    const peak = Math.max(...tops);
    expect(start).toBe(0);
    expect(peak).toBeCloseTo(FAMILY_A4_HEIGHTS.highBoard, 6);
    expect(peak - start).toBeGreaterThanOrEqual(16);
    expect(standing[tops.indexOf(peak)]).toBe("high-board");
    const ascent = tops.slice(1).reduce((sum, value, index) => sum + Math.max(0, value - tops[index]!), 0);
    expect(ascent).toBeCloseTo(25.7, 6);
    // The dive then descends 5.8 m in two glides to the stage and the exit.
    expect(tops.at(-1)).toBeCloseTo(FAMILY_A4_HEIGHTS.stage, 6);
    expect(new Set(tops.map((value) => Math.round(value))).size).toBeGreaterThanOrEqual(12);
  });
});

// ---------------------------------------------------------------------------
// The critique's must-fix items and the chapter's derived content.
// ---------------------------------------------------------------------------

/** A child who holds the stick straight ahead and Jump the whole way. */
function fullGlide(entry: AuthoredConnection, stage: (typeof STAGES)[number], doubleJump: boolean, lateral: number) {
  const from = surface(entry.from);
  const to = surface(entry.to);
  const deltaX = to.center.x - from.center.x;
  const deltaZ = to.center.z - from.center.z;
  const alongX = Math.abs(deltaX) >= Math.abs(deltaZ);
  const move = { moveX: alongX ? Math.sign(deltaX) : 0, moveY: alongX ? 0 : -Math.sign(deltaZ) };
  const simulation = createGrowthSimulation(level, stage, AGE_NINE, edgeEntry(level.course, entry, 0, 0.75, lateral));
  growthStep(simulation, { move: { moveX: 0, moveY: 0 } });
  let airborne = false;
  let second = false;
  for (let frame = 0; frame < 600; frame += 1) {
    const press: boolean = doubleJump && airborne && !second && simulation.state.velocityY <= 0.6;
    second ||= press;
    growthStep(simulation, { move, jumpPressed: frame === 0 || press, jumpHeld: true });
    airborne ||= !simulation.state.grounded;
    if (simulation.recoveries > 0 || (airborne && simulation.state.grounded)) break;
  }
  return simulation;
}

describe("A4 critique fixes", () => {
  it("lands every held glide on a surface, the dive short of the boss's reach", () => {
    const envelope = authoredStrikeEnvelope(document.anchors.encounters.boss);
    const glides = mainSteps.filter((entry) => entry.requires === "glide");
    expect(glides.map(label)).toEqual([
      "spotlight-perch->glide-landing",
      "glide-landing->ticket-counter",
      "spotlight-bar->rigging-deck-five",
      "high-board->spotlight-trapeze",
      "spotlight-trapeze->rat-pit-stage",
    ]);
    for (const entry of glides)
      for (const stage of STAGES)
        for (const doubleJump of [false, true])
          for (const lateral of [-1, 0, 1]) {
            const run = fullGlide(entry, stage, doubleJump, lateral);
            const where = `${stage} ${label(entry)} dj=${doubleJump} lateral=${lateral}`;
            expect(run.recoveries, where).toBe(0);
            expect(run.state.grounded, where).toBe(true);
            if (entry.to === "rat-pit-stage") {
              expect(run.state.supportId, where).toBe("rat-pit-stage");
              expect(run.state.position.z, where).toBeGreaterThan(envelope.maxZ);
            }
          }
  });

  it("widens the balcony pad's landing gap to 0.35 m and keeps every pad gap there (R2)", () => {
    for (const [pad, landing] of [
      ["glide-school-pad", "spotlight-perch"],
      ["balcony-pad", "moth-projection-room"],
      ["rigging-pad", "rigging-deck-one"],
      ["on-air-pad", "on-air-stage"],
    ] as const)
      expect(authoredSurfaceGap(surface(pad), surface(landing))).toBeLessThanOrEqual(0.35 + 1e-9);
  });

  it("sends the natural path through the Glide School: the padded floor no longer meets the counter", () => {
    expect(authoredSurfaceGap(surface("casino-padded-floor"), surface("ticket-counter"))).toBeGreaterThanOrEqual(4);
  });

  it("puts tokens on the glide line and golden tickets on the three golden routes", () => {
    const plan = planCasinoCollectibles({ authored: document, course: level.course })!;
    expect(plan.tickets.map((ticket) => ticket.platformId)).toEqual([
      "chip-stack-four",
      "on-air-stage",
      "tray-skip-stack",
    ]);
    const arcs = new Set(plan.tokens.filter((token) => token.role === "arc").map((token) => `${token.from}->${token.platformId}`));
    expect(arcs.has("spotlight-perch->glide-landing")).toBe(true);
    expect(arcs.has("glide-landing->ticket-counter")).toBe(true);
    expect(arcs.has("spotlight-trapeze->rat-pit-stage")).toBe(true);
    expect(plan.tokens.length).toBeGreaterThan(100);
  });

  it("keeps CasinoScene's roulette dais and Golden cameo outside the boss's reach", () => {
    const layout: LevelLayout = {
      id: document.id,
      routeId: document.id,
      authored: document,
      course: level.course,
      checkpoint: document.anchors.spawn.position,
      finish: document.anchors.finish.position,
      memories: Object.entries(document.anchors.memories).map(([id, anchor], index) => ({
        id,
        index,
        position: anchor.position,
        state: "released" as const,
      })),
      pickups: Object.entries(document.anchors.pickups).map(([kind, anchor]) => ({
        id: kind,
        equipmentId: kind,
        kind: kind as "attack-tool" | "guard-tool",
        position: anchor.position,
        collected: false,
      })),
      encounters: Object.entries(document.anchors.encounters).map(([slot, anchor]) => ({
        id: slot,
        role: slot === "boss" ? ("boss" as const) : ("ordinary" as const),
        kind: anchor.kind,
        position: anchor.position,
        arena: anchor.arena,
      })),
      step: null,
      minX: -60,
      maxX: 20,
      minZ: -160,
      maxZ: 10,
    };
    const assets = { attach: () => undefined, attachInstances: () => undefined } as unknown as SceneAssets;
    const scene = new CasinoScene(layout, assets, () => true, true);
    const envelope = authoredStrikeEnvelope(document.anchors.encounters.boss);
    const dais = scene.root.getObjectByName("casino-roulette-dais")!;
    const cameo = scene.root.getObjectByName("casino-golden-cameo")!;
    expect(dais).toBeInstanceOf(THREE.Object3D);
    expect(cameo).toBeInstanceOf(THREE.Object3D);
    // The dais model is 3.51 m across at scale 1.
    const daisRadius = (3.51 * dais.scale.x) / 2;
    const outside = (x: number, z: number, radius: number) =>
      x + radius < envelope.minX || x - radius > envelope.maxX || z + radius < envelope.minZ || z - radius > envelope.maxZ;
    expect(outside(dais.position.x, dais.position.z, daisRadius)).toBe(true);
    expect(outside(cameo.position.x, cameo.position.z, 0.5)).toBe(true);
    // Both stand on the stage.
    const stage = authoredSurfaceBounds(surface("rat-pit-stage"));
    for (const prop of [dais, cameo]) {
      expect(prop.position.x).toBeGreaterThan(stage.minX);
      expect(prop.position.x).toBeLessThan(stage.maxX);
      expect(prop.position.z).toBeGreaterThan(stage.minZ);
      expect(prop.position.z).toBeLessThan(stage.maxZ);
    }
  });

  it("puts the Radio Showman on the On-Air branch, which rejoins before the boss", () => {
    const bonus = document.anchors.encounters["bonus-1"]!;
    expect(bonus).toMatchObject({ platformId: "on-air-stage", kind: FAMILY_A4_CAST.bonus.kind });
    const branch = document.branches.find((entry) => entry.includes(bonus.platformId))!;
    expect(document.mainPath.indexOf(branch.at(-1)!)).toBeLessThan(
      document.mainPath.indexOf(document.anchors.encounters.boss.platformId),
    );
  });
});
