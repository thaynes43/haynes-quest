/**
 * World A, chapter 1 (The Toon Clubhouse): the generated authored-level-v4
 * document from `scripts/levels/family/a1.ts`, proven against the real
 * validators, the family-world lints and the kid-model auto-pilot with only
 * the moves a chapter that starts at age 0 unlocks (jump). The world here is
 * a synthetic one-chapter project on the fictional World A birth date; no
 * real names, dates or photos are involved.
 */
import { describe, expect, it } from "vitest";
import {
  authoredSurfaceBounds,
  resolveAuthoredLevelDocument,
  validateAuthoredLevelDocument,
  type AuthoredConnection,
  type AuthoredSurfacePiece,
} from "../../src/shared/authored-level";
import { validateGrowthRequirements } from "../../src/shared/authored-level-growth";
import { abilitiesForAge } from "../../src/shared/abilities";
import {
  applyLevelEditorCommands,
  createWorldEditorProject,
  validateLevelEditorProject,
  type LevelEditorChapterV2,
  type LevelEditorProjectV2,
} from "../../src/shared/editor-project";
import {
  bossRetryRoute,
  lintFamilyChapter,
} from "../../src/shared/family-world-lint";
import { decorWorldBounds, placeableThemeKitProps, themeKitProp } from "../../src/shared/theme-kits";
import { planCasinoCollectibles } from "../../src/game/casino-tokens";
import { chapterCommands, worldShellCommands } from "../../scripts/levels/lib/growth-kit";
import {
  FAMILY_A1_CAST,
  FAMILY_A1_CLAIMS,
  FAMILY_A1_ROUTE_ID,
  FAMILY_WORLD_A_FICTIONAL_BIRTH_DATE,
  familyA1Level,
  familyA1ShellChapter,
} from "../../scripts/levels/family/a1";
import {
  edgeEntry,
  FRAME_SECONDS,
  sampledPlatform,
  STAGES,
  type AppearanceStage,
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

const CHAPTER_ID = "family-a1";
const START_AGE = 0;
const ABILITIES = abilitiesForAge(START_AGE);
/** Start age 0 is under 4, so the avatar is the infant model; the child model is cheap to check too. */
const START_STAGE: AppearanceStage = START_AGE < 4 ? "infant" : "child";

const document = familyA1Level();
const level = resolveAuthoredLevelDocument(document);

function surface(id: string): AuthoredSurfacePiece {
  const piece = document.pieces.find((candidate) => candidate.id === id);
  if (!piece || piece.type === "checkpoint" || piece.type === "sweeper")
    throw new Error(`A1 surface ${id} is missing`);
  return piece;
}

function top(id: string): number {
  const piece = surface(id);
  return Math.round((piece.center.y + piece.size.y / 2) * 1000) / 1000;
}

function connection(from: string, to: string): AuthoredConnection {
  const found = document.connections.find((entry) => entry.from === from && entry.to === to);
  if (!found) throw new Error(`A1 connection ${from}->${to} is missing`);
  return found;
}

/** Main-path steps as connections, in route order. */
const requiredSteps = document.mainPath
  .slice(0, -1)
  .map((from, index) => connection(from, document.mainPath[index + 1]!));

/** Every step of every branch, in branch order. */
const branchSteps = document.branches.flatMap((branch) =>
  branch.slice(0, -1).map((from, index) => connection(from, branch[index + 1]!)),
);

function oneChapterWorld(): LevelEditorProjectV2 {
  const chapter = chapterCommands(CHAPTER_ID);
  const candidate = (candidateId: string) => ({ source: "candidate" as const, candidateId });
  const base = createWorldEditorProject({
    projectId: "family-a1-check",
    catalogVersion: "parody-catalog-v7",
  });
  const result = applyLevelEditorCommands(base, {
    expectedRevision: 0,
    commands: [
      ...worldShellCommands({
        name: "Clubhouse to Casino",
        fictionalBirthDate: FAMILY_WORLD_A_FICTIONAL_BIRTH_DATE,
        chapters: [familyA1ShellChapter(CHAPTER_ID)],
      }),
      chapter.replaceLevel(document),
      // R11: one ordinary identity in all four ordinary slots.
      chapter.addCandidate("ordinary-1", FAMILY_A1_CAST.ordinary),
      chapter.assign("ordinary-2", candidate(FAMILY_A1_CAST.ordinary.id)),
      chapter.assign("ordinary-3", candidate(FAMILY_A1_CAST.ordinary.id)),
      chapter.assign("ordinary-4", candidate(FAMILY_A1_CAST.ordinary.id)),
      chapter.addCandidate("boss", FAMILY_A1_CAST.boss),
    ],
  });
  if (!result.ok)
    throw new Error(
      `A1 world failed: ${result.issues.map((entry) => `${entry.path}: ${entry.message}`).join("; ")}`,
    );
  return result.project as LevelEditorProjectV2;
}

describe("A1 generator", () => {
  it("is pure and deterministic", () => {
    expect(JSON.stringify(familyA1Level())).toBe(JSON.stringify(document));
    expect(document.id).toBe(FAMILY_A1_ROUTE_ID);
    expect(document.id).toBe("family-a1-clubhouse");
    expect(document.theme).toBe("clubhouse");
    expect(document.schemaVersion).toBe("authored-level-v4");
  });

  it("(a) validates with zero issues inside a one-chapter v4 world", () => {
    expect(validateAuthoredLevelDocument(document)).toEqual([]);
    expect(validateGrowthRequirements(document, { startAgeYears: START_AGE })).toEqual([]);
    const project = oneChapterWorld();
    expect(validateLevelEditorProject(project)).toEqual([]);
    const chapter = project.chapters[0] as LevelEditorChapterV2;
    expect(project.chapters).toHaveLength(1);
    expect(project.fictionalBirthDate).toBe("2015-01-15");
    expect(chapter.recoveredAge).toEqual({ fromYears: 0, toYears: 2 });
    expect(chapter.representedDateRange).toEqual({ startDate: "2015-01-15", endDate: "2017-01-15" });
    expect(chapter.level).toEqual(document);
  });

  it("(b) passes every World A family lint with no errors and no warnings", () => {
    const findings = lintFamilyChapter(document, { world: "a" });
    expect(findings.filter((entry) => entry.severity === "error")).toEqual([]);
    // No warnings either: both lift landings are flush and level with their
    // stops, and each boarding landing holds a checkpoint.
    expect(findings).toEqual([]);
    // R5: an HP defeat at the boss returns to minor-two on the balcony.
    expect(bossRetryRoute(document)).toEqual({ meters: expect.any(Number), lifts: 0 });
    expect(bossRetryRoute(document)!.meters).toBeLessThanOrEqual(25);
  });

  it("keeps the chapter's rulings: cast kinds, decor kits, tickets and branch headings", () => {
    // R11: every ordinary anchor uses the one ordinary identity's kind.
    for (const slot of ["ordinary-1", "ordinary-2", "ordinary-3", "ordinary-4"] as const)
      expect(document.anchors.encounters[slot].kind).toBe(FAMILY_A1_CAST.ordinary.kind);
    // R12: only clubhouse-kit and shared props, at most 200.
    const placeable = new Set(placeableThemeKitProps("clubhouse").map((prop) => prop.id));
    expect(document.decor!.length).toBeGreaterThan(0);
    expect(document.decor!.length).toBeLessThanOrEqual(200);
    for (const entry of document.decor!) expect(placeable.has(entry.kitPropId), entry.id).toBe(true);
    // Props never clip each other or sink into a deck's solid block (the
    // validator already keeps them out of every walkable volume).
    const footprints = document.decor!.map((entry) => {
      const bounds = decorWorldBounds(themeKitProp(entry.kitPropId)!.bounds, entry);
      return { id: entry.id, minX: bounds.min.x, maxX: bounds.max.x, minZ: bounds.min.z, maxZ: bounds.max.z };
    });
    const solids = document.pieces.flatMap((piece) =>
      piece.type === "checkpoint" || piece.type === "sweeper" ? [] : [{ id: piece.id, ...authoredSurfaceBounds(piece) }],
    );
    const clips = (
      first: { minX: number; maxX: number; minZ: number; maxZ: number },
      second: { minX: number; maxX: number; minZ: number; maxZ: number },
    ) =>
      Math.min(first.maxX, second.maxX) - Math.max(first.minX, second.minX) > 1e-6 &&
      Math.min(first.maxZ, second.maxZ) - Math.max(first.minZ, second.minZ) > 1e-6;
    for (const [index, prop] of footprints.entries()) {
      for (const other of footprints.slice(index + 1))
        expect(clips(prop, other), `${prop.id} clips ${other.id}`).toBe(false);
      for (const solid of solids) expect(clips(prop, solid), `${prop.id} inside ${solid.id}`).toBe(false);
    }
    // R10: each optional branch holds a golden ticket, numbered in route order.
    const plan = planCasinoCollectibles({ authored: level.document, course: level.course });
    expect(plan?.tickets.map((ticket) => ticket.platformId)).toEqual([
      "b3-stump",
      "b1-golden-perch",
      "b2-hedge-3",
    ]);
    // R3: optional branches avoid the camera too (at most 30° toward +z).
    for (const step of branchSteps) {
      const from = surface(step.from);
      const to = surface(step.to);
      const deltaZ = to.center.z - from.center.z;
      const degrees =
        (Math.atan2(Math.max(0, deltaZ), Math.abs(to.center.x - from.center.x)) * 180) / Math.PI;
      expect(degrees, `${step.from}->${step.to}`).toBeLessThanOrEqual(30);
    }
    // R7: the treetop descent is a drop; no connection spends a growth move.
    expect(connection("b1-golden-perch", "gear-island").mode).toBe("drop");
    expect(document.connections.filter((entry) => entry.requires !== undefined)).toEqual([]);
  });
});

describe("A1 kid model (jump only)", () => {
  it(
    "(c) runs the whole required route with no recoveries in at least 70 s",
    () => {
      for (const stage of [START_STAGE, ...STAGES.filter((entry) => entry !== START_STAGE)]) {
        const run = runGrowthRouteWithWaits(level, document.mainPath, stage, ABILITIES);
        expect(run.failedAt, stage).toBeNull();
        expect(run.recoveries, stage).toBe(0);
        expect(run.completed, stage).toHaveLength(document.mainPath.length - 1);
        // R10: required-route traversal of at least 70 s (measured about 80 s).
        expect(run.seconds, stage).toBeGreaterThanOrEqual(70);
        expect(run.bounces, stage).toEqual([
          "hill-pad",
          "tower-pad",
          "slide-pad-1",
          "slide-pad-2",
          "slide-pad-3",
        ]);
        expect(run.maxFeetY, stage).toBeGreaterThanOrEqual(FAMILY_A1_CLAIMS.peak);
      }
    },
    60_000,
  );

  it("(d) lands every required bounce at every R2 stick without pressing Jump", () => {
    const required = requiredSteps.filter((step) => step.mode === "bounce");
    expect(required.map((step) => step.from)).toEqual([
      "hill-pad",
      "tower-pad",
      "slide-pad-1",
      "slide-pad-2",
      "slide-pad-3",
    ]);
    for (const step of required) {
      const deck = document.mainPath[document.mainPath.indexOf(step.from) - 1]!;
      for (const stage of STAGES)
        for (const stick of R2_STICKS)
          for (const lateral of [-0.6, 0, 0.6]) {
            const result = bounceWalkOn(level, deck, step.from, step.to, { stick, stage, lateral });
            expect(result.reached, `${step.from} ${stage}@${stick} lateral ${lateral}`).toBe(true);
            expect(result.bounces).toBeGreaterThan(0);
          }
    }
  });

  it("(d) rides every required lift from a walk-in, and a fall into the open shaft retries on the boarding landing", () => {
    const lifts = requiredSteps.filter(
      (step) => step.mode === "ride" && surface(step.to).type === "lift",
    );
    expect(lifts.map((step) => step.to)).toEqual(["cliff-lift", "tower-lift"]);
    const phases = 24;
    for (const boarding of lifts) {
      const liftId = boarding.to;
      const exit = requiredSteps.find((step) => step.from === liftId)!;
      const checkpoint = document.pieces.find(
        (piece) => piece.type === "checkpoint" && piece.platformId === boarding.from,
      );
      expect(checkpoint, `${boarding.from} holds a checkpoint`).toBeDefined();
      for (const stage of STAGES) {
        const result = liftWalkIn(level, liftId, boarding.from, exit.to, { phases, stage });
        // Every arrival either rides through or falls into the shaft; none is stuck.
        expect(result.other, `${liftId} ${stage}`).toBe(0);
        expect(result.ok + result.fell).toBe(phases);
        // The 2 s dwell lets a fair share of blind walk-ins board (measured 7–8 of 24).
        expect(result.ok, `${liftId} ${stage}`).toBeGreaterThanOrEqual(phases / 4);

        // A walk-in while the lift waits at its top stop falls into the shaft
        // and recovers at the boarding landing's checkpoint: a short retry.
        const lift = level.course.platforms.find((platform) => platform.id === liftId)!;
        const startTime = motionCycleSeconds(lift) / 2;
        const simulation = createGrowthSimulation(
          level,
          stage,
          ABILITIES,
          edgeEntry(level.course, boarding, startTime, 1.5, 0),
          startTime,
        );
        let recovered = false;
        for (let frame = 0; frame < 240 && !recovered; frame += 1) {
          const target = sampledPlatform(level.course, liftId, simulation.timeSeconds + FRAME_SECONDS).center;
          const deltaX = target.x - simulation.state.position.x;
          const deltaZ = target.z - simulation.state.position.z;
          const distance = Math.hypot(deltaX, deltaZ) || 1;
          recovered = growthStep(simulation, {
            move: { moveX: deltaX / distance, moveY: -deltaZ / distance },
          }).recovered;
        }
        expect(recovered, `${liftId} ${stage} falls while the lift is away`).toBe(true);
        expect(simulation.state.checkpointId).toBe(checkpoint!.id);
      }
    }
  });

  it("traverses every required step from an isolated entry with jump only", () => {
    for (const step of requiredSteps)
      for (const stage of STAGES)
        expect(
          traverseGrowthEdge(level, step, stage, ABILITIES).reached,
          `${step.from}->${step.to} ${stage}`,
        ).toBe(true);
  });

  it("(e) crosses every branch edge with its declared move, and every practice miss lands on its catch floor", () => {
    expect(branchSteps.map((step) => step.mode)).toEqual([
      "walk",
      "bounce",
      "jump",
      "jump",
      "jump",
      "jump",
      "jump",
      "walk",
      "bounce",
      "jump",
      "ride",
      "ride",
      "drop",
      "jump",
      "jump",
      "jump",
      "jump",
    ]);
    for (const step of branchSteps)
      for (const stage of STAGES) {
        const styles = step.mode === "drop" ? (["hop", "step"] as const) : ([undefined] as const);
        for (const dropStyle of styles)
          expect(
            traverseGrowthEdge(level, step, stage, ABILITIES, 0, dropStyle ? { dropStyle } : {}).reached,
            `${step.from}->${step.to} ${stage} ${dropStyle ?? ""}`,
          ).toBe(true);
      }
    // The sandbox hops are the chapter's practice strip over the sandpit.
    const practice = document.connections.filter((entry) => entry.safeMissPlatformId !== undefined);
    expect(practice.map((entry) => `${entry.from}->${entry.to}`)).toEqual([
      "meadow-start->hop-1",
      "hop-1->hop-2",
      "hop-2->hop-3",
      "hop-3->hop-4",
      "hop-4->hop-5",
    ]);
    for (const entry of practice)
      for (const stage of STAGES) {
        const miss = missGrowthPractice(level, entry, stage, ABILITIES);
        expect(miss.reached, `${entry.from}->${entry.to} ${stage}`).toBe(true);
        expect(miss.supportId).toBe("sandpit");
      }
    // The retry route climbs back out of the sandpit.
    for (const stage of STAGES)
      expect(traverseGrowthEdge(level, connection("sandpit", "meadow-start"), stage, ABILITIES).reached).toBe(true);
  });

  it("(f) climbs and peaks as the amended blueprint claims", () => {
    const tops = document.mainPath.map(top);
    // The peak is the tower top, where the boss waits.
    expect(Math.max(...tops)).toBe(FAMILY_A1_CLAIMS.peak);
    expect(top(document.anchors.encounters.boss.platformId)).toBe(FAMILY_A1_CLAIMS.peak);
    // The route reaches each claimed tier in order, from the meadow up.
    const firstReach = FAMILY_A1_CLAIMS.levels.map((tier) =>
      tops.findIndex((height) => height >= tier - 1e-9),
    );
    expect(firstReach.every((index) => index >= 0)).toBe(true);
    for (let index = 1; index < firstReach.length; index += 1)
      expect(firstReach[index]!).toBeGreaterThan(firstReach[index - 1]!);
    expect(tops[0]).toBe(0);
    expect(tops.at(-1)).toBe(FAMILY_A1_CLAIMS.finishTop);
    // D-07: at least 4 m overall and at least three distinct levels.
    expect(Math.max(...tops) - tops[0]!).toBeGreaterThanOrEqual(4);
    expect(new Set(FAMILY_A1_CLAIMS.levels).size).toBeGreaterThanOrEqual(3);
    // The big vertical moments.
    const { climbs } = FAMILY_A1_CLAIMS;
    expect(top("hill-terrace") - top("hill-pad")).toBeCloseTo(climbs.hillBoing, 6);
    expect(top("porch-lawn") - top("gear-garden")).toBeCloseTo(climbs.cliffLift, 6);
    expect(top("tower-balcony") - top("clubhouse-porch")).toBeCloseTo(climbs.towerLift, 6);
    expect(top("tower-top") - top("tower-pad")).toBeCloseTo(climbs.towerBoing, 6);
    expect(top("tower-top") - top("party-lawn")).toBeCloseTo(climbs.slideDescent, 6);
    // R1: the boing slide descends to the final platform, which holds the
    // major memory, the reward respawn and the finish; nothing leaves it.
    const final = document.mainPath.at(-1)!;
    expect(final).toBe("party-lawn");
    expect(document.anchors.memories.major.platformId).toBe(final);
    expect(document.anchors.rewardRespawn.platformId).toBe(final);
    expect(document.anchors.finish.platformId).toBe(final);
    expect(document.connections.filter((entry) => entry.from === final)).toEqual([]);
    // Up to the boss the required route only climbs, walks level or hops
    // down a plain-jump step; the only big descent is the boing slide after it.
    const bossIndex = document.mainPath.indexOf("tower-top");
    for (const step of requiredSteps.slice(0, bossIndex))
      expect(top(step.from) - top(step.to), `${step.from}->${step.to}`).toBeLessThanOrEqual(0.35 + 1e-9);
  });
});
