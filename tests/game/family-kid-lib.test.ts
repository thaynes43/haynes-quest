/**
 * The family kid-model helpers (PLAN-019 R2, R6 and R10 evidence): a
 * partial-stick walk onto a bounce pad, a walk toward a lift at a random
 * moment, and a route run that waits for and walks around sweepers.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  resolveAuthoredLevelDocument,
  validateAuthoredLevelDocument,
  type AuthoredConnection,
  type AuthoredLevelDocument,
  type AuthoredLevelPiece,
  type AuthoredSweeperPiece,
} from "../../src/shared/authored-level";
import { abilitiesForAge } from "../../src/shared/abilities";
import {
  FAMILY_WORLD_LINT_PRESETS,
  lintLifts,
  lintPadGaps,
} from "../../src/shared/family-world-lint";
import {
  bounce,
  bouncePad,
  jump,
  lift,
  platform,
  platformCheckpoint,
  ride,
  walk,
} from "../../scripts/levels/lib/growth-kit";
import { STAGES } from "./authored-traversal-lib";
import { runGrowthRoute } from "./growth-traversal-lib";
import {
  bounceWalkOn,
  liftWalkIn,
  R2_STICKS,
  runGrowthRouteWithWaits,
} from "./family-kid-lib";

const demo = JSON.parse(
  readFileSync(
    new URL("../../scripts/levels/examples/vertical-v4-demo.project.json", import.meta.url),
    "utf8",
  ),
);
const base: AuthoredLevelDocument = demo.chapters[1].level;

/** The demo level plus a separate test rig well beside the course (x ≥ 30). */
function withRig(
  pieces: readonly AuthoredLevelPiece[],
  connections: readonly AuthoredConnection[],
): AuthoredLevelDocument {
  const document = structuredClone(base);
  return {
    ...document,
    pieces: [...document.pieces, ...pieces],
    connections: [...document.connections, ...connections],
  };
}

function valid(document: AuthoredLevelDocument) {
  expect(validateAuthoredLevelDocument(document).map((entry) => entry.code)).toEqual([]);
  return resolveAuthoredLevelDocument(document);
}

describe("bounceWalkOn (R2)", () => {
  // A big pad 0.35 m from a landing 2 m up: the reviewer's A4-like rig.
  const rig = (landingThickness: number) =>
    withRig(
      [
        platform("walk-deck", { x: 40, z: -2, sizeX: 6, sizeZ: 4, top: 0 }),
        bouncePad("walk-pad", { x: 40, z: -5, sizeX: 2.4, sizeZ: 2, top: 0, thickness: 0.4, strength: "big" }),
        platform("walk-landing", { x: 40, z: -8.35, sizeX: 4, sizeZ: 4, top: 2, thickness: landingThickness }),
      ],
      [walk("walk-deck", "walk-pad"), bounce("walk-pad", "walk-landing")],
    );

  it("finds the partial-stick falls under a thin landing that the underhang lint reports", () => {
    const document = rig(0.6);
    const level = valid(document);
    const rigFindings = () => lintPadGaps(document).filter((entry) => entry.subject.startsWith("walk-"));
    expect(rigFindings().map((entry) => entry.code)).toEqual(["family.pad-gap.underhang"]);
    const failures = STAGES.flatMap((stage) =>
      R2_STICKS.filter(
        (stick) => !bounceWalkOn(level, "walk-deck", "walk-pad", "walk-landing", { stick, stage }).reached,
      ).map((stick) => `${stage}@${stick}`),
    );
    expect(failures.length).toBeGreaterThan(0);
    // Only partial sticks fail; a full push clears the slab.
    expect(bounceWalkOn(level, "walk-deck", "walk-pad", "walk-landing", { stick: 1, stage: "child" }).reached).toBe(
      true,
    );
  });

  it("succeeds at every R2 stick once the landing reaches down to the pad", () => {
    const document = rig(2);
    const level = valid(document);
    expect(lintPadGaps(document).filter((entry) => entry.subject.startsWith("walk-"))).toEqual([]);
    for (const stage of STAGES)
      for (const stick of R2_STICKS) {
        const result = bounceWalkOn(level, "walk-deck", "walk-pad", "walk-landing", { stick, stage });
        expect(result.reached, `${stage} at stick ${stick}`).toBe(true);
        expect(result.startedOnSource).toBe(true);
        expect(result.bounces).toBeGreaterThan(0);
      }
  });
});

describe("liftWalkIn (R6)", () => {
  const pieces = (dwell: number): AuthoredLevelPiece[] => [
    platform("shaft-dock", { x: 40, z: 0, sizeX: 4, sizeZ: 4, top: 0 }),
    platformCheckpoint("shaft-dock-safe", "shaft-dock", { x: 40, y: 0, z: 1 }),
    lift("shaft-lift", { x: 40, z: -3.6, sizeX: 3.2, sizeZ: 3.2, bottomTop: 0, distance: 4, period: 8, thickness: 0.4, dwell }),
    platform("shaft-roof", { x: 40, z: -7.2, sizeX: 4, sizeZ: 4, top: 4, thickness: 4.4 }),
  ];
  const connections = [ride("shaft-dock", "shaft-lift"), ride("shaft-lift", "shaft-roof")];

  it("shows that dwell alone leaves the shaft open to a walking child", () => {
    const document = withRig(pieces(2), connections);
    const level = valid(document);
    // Lint-clean for World B: dwell, flush landings and a boarding checkpoint.
    expect(
      lintLifts(document, FAMILY_WORLD_LINT_PRESETS.b).filter((entry) => entry.subject.includes("shaft")),
    ).toEqual([]);
    const result = liftWalkIn(level, "shaft-lift", "shaft-dock", "shaft-roof", { phases: 12, stage: "child" });
    expect(result.ok + result.fell + result.other).toBe(12);
    expect(result.ok).toBeGreaterThan(0);
    expect(result.fell).toBeGreaterThan(0);
  });
});

describe("runGrowthRouteWithWaits (R10)", () => {
  const spinner: AuthoredSweeperPiece = {
    type: "sweeper",
    id: "kid-spinner",
    center: { x: 40, y: 0.5, z: -8 },
    halfLength: 1.6,
    radius: 0.2,
    rotation: { period: 8 },
  };
  const slider: AuthoredSweeperPiece = {
    type: "sweeper",
    id: "kid-slider",
    center: { x: 40, y: 0.5, z: -18 },
    halfLength: 1,
    radius: 0.2,
    motion: { axis: "x", distance: 2, period: 8 },
  };
  const deckPieces: AuthoredLevelPiece[] = [
    platform("kid-start", { x: 40, z: 0, sizeX: 6, sizeZ: 6, top: 0 }),
    platform("kid-spin-deck", { x: 40, z: -8, sizeX: 8, sizeZ: 10, top: 0 }),
    platform("kid-slide-deck", { x: 40, z: -18, sizeX: 7, sizeZ: 8, top: 0 }),
    platform("kid-end", { x: 40, z: -26, sizeX: 6, sizeZ: 6, top: 0 }),
  ];
  const connections = [
    walk("kid-start", "kid-spin-deck"),
    jump("kid-spin-deck", "kid-slide-deck"),
    jump("kid-slide-deck", "kid-end"),
  ];
  const path = ["kid-start", "kid-spin-deck", "kid-slide-deck", "kid-end"];

  it("waits for and walks around sweepers where the plain runner is struck", () => {
    const level = valid(withRig([...deckPieces, spinner, slider], connections));
    for (const stage of STAGES) {
      const plain = runGrowthRoute(level, path, stage, abilitiesForAge(0));
      expect(plain.failedAt, stage).not.toBeNull();
      const patient = runGrowthRouteWithWaits(level, path, stage, abilitiesForAge(0));
      expect(patient.failedAt, stage).toBeNull();
      expect(patient.recoveries).toBe(0);
      expect(patient.completed).toEqual([
        "kid-start->kid-spin-deck",
        "kid-spin-deck->kid-slide-deck",
        "kid-slide-deck->kid-end",
      ]);
      expect(patient.detours).toContain("kid-spin-deck->kid-slide-deck");
      expect(patient.seconds).toBeGreaterThan(plain.seconds);
    }
  });

  it("matches the plain runner exactly on a route without sweepers", () => {
    const level = valid(withRig(deckPieces, connections));
    const plain = runGrowthRoute(level, path, "child", abilitiesForAge(0));
    const patient = runGrowthRouteWithWaits(level, path, "child", abilitiesForAge(0));
    expect(plain.failedAt).toBeNull();
    expect(patient).toEqual({ ...plain, hazardWaitSeconds: 0, detours: [] });
  });
});
