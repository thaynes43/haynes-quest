/**
 * Guards for the Besties boss court (PRD002 R-02/R-04, ADR003).
 *
 * The duo's routine is scripted in fixed local coordinates around
 * `BESTIES_ARENA_CENTER` and merely translated to the boss anchor, so the
 * editor's ability to move or resize `besties-court` can strand hazards over
 * empty air without tripping a single published validator check. These tests
 * both pin the footprint against the real simulation and prove the guard
 * accepts the shipped templates unchanged.
 */
import { describe, expect, it } from "vitest";
import {
  BESTIES_ROUTINE_LEVEL_IDS,
  BESTIES_ROUTINE_SUPPORT_FOOTPRINT,
  validateEditorGameplayGuards,
} from "../../src/shared/editor-gameplay-guards";
import {
  AUTHORED_LEVEL_LIMITS,
  AUTHORED_LEVEL_IDS,
  validateAuthoredLevelDocument,
  type AuthoredLevelDocument,
  type AuthoredLevelPiece,
  type AuthoredMovingPlatformPiece,
  type AuthoredPlatformPiece,
  type AuthoredSweeperPiece,
} from "../../src/shared/authored-level";
import {
  BESTIES_ARENA_CENTER,
  BESTIES_PLAYER_RADIUS,
  BestiesSimulation,
  bestiesActorOffset,
  type BestiesFrame,
} from "../../src/game/besties";
import type { PositionSnapshot } from "../../src/game/types";
import { selectRouteMemoryLevel } from "../../src/shared/parody-selection";
import { PARODY_CATALOG_VERSIONS } from "../../src/shared/parody-catalog";
import gardenV1 from "../../src/shared/levels/garden-playground-v1.json";
import gardenV2 from "../../src/shared/levels/garden-playground-v2.json";
import bestiesV1 from "../../src/shared/levels/besties-playground-v1.json";
import bestiesV2 from "../../src/shared/levels/besties-playground-v2.json";

const SHIPPED: Record<string, AuthoredLevelDocument> = {
  "garden-playground-v1": gardenV1 as AuthoredLevelDocument,
  "garden-playground-v2": gardenV2 as AuthoredLevelDocument,
  "besties-playground-v1": bestiesV1 as AuthoredLevelDocument,
  "besties-playground-v2": bestiesV2 as AuthoredLevelDocument,
};

function clone(document: AuthoredLevelDocument): AuthoredLevelDocument {
  return JSON.parse(JSON.stringify(document)) as AuthoredLevelDocument;
}

function codes(issues: readonly { code: string }[]): string[] {
  return issues.map((issue) => issue.code);
}

function bossAnchor(document: AuthoredLevelDocument) {
  return document.anchors.encounters.boss;
}

function pieceById(
  document: AuthoredLevelDocument,
  id: string,
): AuthoredLevelPiece {
  const piece = document.pieces.find((entry) => entry.id === id);
  if (!piece) throw new Error(`Fixture is missing piece ${id}`);
  return piece;
}

function court(document: AuthoredLevelDocument): AuthoredPlatformPiece {
  const piece = pieceById(document, bossAnchor(document).platformId);
  if (piece.type !== "platform") throw new Error("Boss support must be static");
  return piece;
}

/** Mutable view of a cloned document, so fixtures read as small edits. */
type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };

function edit(id: keyof typeof SHIPPED) {
  return clone(SHIPPED[id]!) as Mutable<AuthoredLevelDocument>;
}

describe("Besties routine footprint constant", () => {
  it("contains every hazard frame, swept contact box and actor anchor the real routine emits", () => {
    // Both shipped origins plus the archived no-origin frame, aimed and
    // unaimed, with players parked at and beyond both aim clamps so the
    // `pinkZ` and `blackX` extremes are actually reached. Translating through
    // an authored origin accumulates float error, so compare with the same
    // 1e-6 epsilon the guard itself uses.
    const origins: (PositionSnapshot | undefined)[] = [
      undefined,
      { x: 0, y: 0, z: -112 },
      { x: 0, y: 0.9, z: -125.3 },
    ];
    const playerXs = [-40, -3.75, -1, 0, 1, 3.75, 40];
    const playerZs = [-60, -23.5, -22, -19.5, 0];
    const footprint = BESTIES_ROUTINE_SUPPORT_FOOTPRINT;
    const tolerance = 1e-6;
    let sampledFrames = 0;
    let sampledHazards = 0;

    for (const aimAtPlayer of [false, true]) {
      for (const origin of origins) {
        const base = origin ?? BESTIES_ARENA_CENTER;
        for (const localX of playerXs) {
          for (const localZ of playerZs) {
            const simulation = new BestiesSimulation(origin);
            const player = {
              x: localX + base.x - BESTIES_ARENA_CENTER.x,
              y: 0,
              z: localZ + base.z - BESTIES_ARENA_CENTER.z,
            };
            // Two full 13s cycles cover every phase and both lane sides.
            const steps = 13 * 2 * 60;
            for (let index = 0; index < steps; index += 1) {
              const { frame } = simulation.step({
                player,
                deltaSeconds: 1 / 60,
                active: true,
                defeated: false,
                aimAtPlayer,
              });
              sampledFrames += 1;
              const anchor = frame.arenaOrigin ?? BESTIES_ARENA_CENTER;
              // Re-express in boss-anchor-relative coordinates, which is the
              // frame the footprint constant is written in.
              const relative = (point: PositionSnapshot) => ({
                x: point.x - anchor.x,
                z: point.z - anchor.z,
              });
              const fits = (
                x: number,
                z: number,
                halfX: number,
                halfZ: number,
              ): boolean =>
                x - halfX >= footprint.minX - tolerance &&
                x + halfX <= footprint.maxX + tolerance &&
                z - halfZ >= footprint.minZ - tolerance &&
                z + halfZ <= footprint.maxZ + tolerance;
              for (const hazard of frame.hazards) {
                sampledHazards += 1;
                const centre = relative(hazard.center);
                // The contact test inflates the hazard by the player radius,
                // so the standable band is the inflated box.
                const halfX = hazard.halfExtents.x + BESTIES_PLAYER_RADIUS;
                const halfZ = hazard.halfExtents.z + BESTIES_PLAYER_RADIUS;
                expect({
                  phase: frame.phase,
                  aimAtPlayer,
                  id: hazard.id,
                  fits: fits(centre.x, centre.z, halfX, halfZ),
                }).toMatchObject({ fits: true });
                if (hazard.kind === "foam-bar") {
                  for (const end of [hazard.sweep.from, hazard.sweep.to]) {
                    const point = relative(end);
                    expect({
                      phase: frame.phase,
                      sweepEnd: true,
                      fits: fits(point.x, point.z, halfX, halfZ),
                    }).toMatchObject({ fits: true });
                  }
                }
              }
              for (const actor of frame.actors) {
                const offset = bestiesActorOffset(frame, actor);
                expect({
                  phase: frame.phase,
                  actor: actor.id,
                  fits: fits(offset.x, offset.z, 0, 0),
                }).toMatchObject({ fits: true });
              }
            }
          }
        }
      }
    }

    expect(sampledFrames).toBe(2 * 3 * 7 * 5 * 13 * 2 * 60);
    expect(sampledHazards).toBeGreaterThan(10_000);
  });

  it("is tight: the floor lane and foam bar actually reach all four edges", () => {
    // A footprint far larger than the routine would pass the test above while
    // guarding nothing, so pin the measured extremes too.
    const reached = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
    for (const localX of [-3.75, 3.75]) {
      for (const localZ of [-23.5, -19.5]) {
        const simulation = new BestiesSimulation();
        const player = { x: localX, y: 0, z: localZ };
        for (let index = 0; index < 13 * 60 * 2; index += 1) {
          const { frame }: { frame: BestiesFrame } = simulation.step({
            player,
            deltaSeconds: 1 / 60,
            active: true,
            defeated: false,
            aimAtPlayer: true,
          });
          for (const hazard of frame.hazards) {
            const halfX = hazard.halfExtents.x + BESTIES_PLAYER_RADIUS;
            const halfZ = hazard.halfExtents.z + BESTIES_PLAYER_RADIUS;
            const centreZ = hazard.center.z - BESTIES_ARENA_CENTER.z;
            reached.minX = Math.min(reached.minX, hazard.center.x - halfX);
            reached.maxX = Math.max(reached.maxX, hazard.center.x + halfX);
            reached.minZ = Math.min(reached.minZ, centreZ - halfZ);
            reached.maxZ = Math.max(reached.maxZ, centreZ + halfZ);
          }
        }
      }
    }
    expect(reached.minX).toBeCloseTo(BESTIES_ROUTINE_SUPPORT_FOOTPRINT.minX, 9);
    expect(reached.maxX).toBeCloseTo(BESTIES_ROUTINE_SUPPORT_FOOTPRINT.maxX, 9);
    expect(reached.minZ).toBeCloseTo(BESTIES_ROUTINE_SUPPORT_FOOTPRINT.minZ, 9);
    expect(reached.maxZ).toBeCloseTo(BESTIES_ROUTINE_SUPPORT_FOOTPRINT.maxZ, 9);
  });
});

describe("Besties routine applicability", () => {
  it("names exactly the shipped routes whose boss slot is the duo", () => {
    const hosting = new Set<string>();
    for (const catalogVersion of PARODY_CATALOG_VERSIONS) {
      for (const startDate of ["2020-01-01", "2024-01-01"]) {
        let selection;
        try {
          selection = selectRouteMemoryLevel(
            startDate,
            ["move", "interact", "jump"],
            catalogVersion,
          );
        } catch {
          // Catalog versions before v4 have no route-memory roster at all.
          continue;
        }
        const boss = selection.encounters.find((entry) => entry.role === "boss");
        if (boss?.content.assetId === "bickering-besties") {
          hosting.add(selection.routeId);
        }
      }
    }
    expect(hosting.size).toBeGreaterThan(0);
    expect([...hosting].sort()).toEqual([...BESTIES_ROUTINE_LEVEL_IDS].sort());
  });

  it("skips levels that do not host the duo, and honours the override seam", () => {
    expect(validateEditorGameplayGuards(SHIPPED["garden-playground-v2"]!)).toEqual([]);
    const narrowedGarden = edit("garden-playground-v2");
    (
      court(narrowedGarden as AuthoredLevelDocument) as Mutable<AuthoredPlatformPiece>
    ).size.x = 8;
    // Even a court that could never hold the routine stays clean for a garden
    // level, because the garden boss is not the duo.
    expect(validateEditorGameplayGuards(narrowedGarden as AuthoredLevelDocument)).toEqual(
      [],
    );
    expect(
      codes(
        validateEditorGameplayGuards(narrowedGarden as AuthoredLevelDocument, {
          hostsBestiesRoutine: true,
        }),
      ),
    ).toContain("besties.support-footprint");
    expect(
      validateEditorGameplayGuards(SHIPPED["besties-playground-v2"]!, {
        hostsBestiesRoutine: false,
      }),
    ).toEqual([]);
  });
});

describe("validateEditorGameplayGuards on the shipped templates", () => {
  it("leaves all four published documents unchanged and issue-free", () => {
    for (const id of AUTHORED_LEVEL_IDS) {
      const document = SHIPPED[id]!;
      const before = JSON.stringify(document);
      expect(validateEditorGameplayGuards(document)).toEqual([]);
      // The published validator keeps its own verdict: the guard is additive.
      expect(validateAuthoredLevelDocument(document)).toEqual([]);
      expect(JSON.stringify(document)).toBe(before);
    }
  });

  it("keeps the boss anchor grounded on its court in both Besties templates", () => {
    for (const id of BESTIES_ROUTINE_LEVEL_IDS) {
      const document = SHIPPED[id]!;
      const support = court(document);
      expect(bossAnchor(document).position.y).toBeCloseTo(
        support.center.y + support.size.y / 2,
        9,
      );
    }
  });
});

describe("Besties court edits", () => {
  it("accepts a rigid translation and a height change that carry the court with the anchor", () => {
    for (const [dx, dy, dz] of [
      [0, 0, 0],
      [12, 0, -30],
      [-20, 2.5, 40],
      [0, -1.5, 0],
    ]) {
      const document = edit("besties-playground-v2");
      const boss = document.anchors.encounters.boss;
      const support = court(document as AuthoredLevelDocument);
      const mutableSupport = support as Mutable<AuthoredPlatformPiece>;
      mutableSupport.center.x += dx!;
      mutableSupport.center.y += dy!;
      mutableSupport.center.z += dz!;
      boss.position.x += dx!;
      boss.position.y += dy!;
      boss.position.z += dz!;
      boss.arena.minX += dx!;
      boss.arena.maxX += dx!;
      boss.arena.minZ += dz!;
      boss.arena.maxZ += dz!;
      expect(
        validateEditorGameplayGuards(document as AuthoredLevelDocument),
      ).toEqual([]);
    }
  });

  it("rejects narrowing the court under the routine", () => {
    const document = edit("besties-playground-v2");
    (court(document as AuthoredLevelDocument) as Mutable<AuthoredPlatformPiece>).size.x = 10;
    const issues = validateEditorGameplayGuards(document as AuthoredLevelDocument);
    expect(codes(issues)).toEqual(["besties.support-footprint"]);
    expect(issues[0]!.path).toBe('$.anchors.encounters["boss"].position');
    expect(issues[0]!.message).toContain("besties-court");
  });

  it("rejects offsetting the anchor inside an unchanged court", () => {
    const document = edit("besties-playground-v2");
    document.anchors.encounters.boss.position.x = 1;
    document.anchors.encounters.boss.arena.minX += 1;
    document.anchors.encounters.boss.arena.maxX += 1;
    expect(codes(validateEditorGameplayGuards(document as AuthoredLevelDocument))).toEqual([
      "besties.support-footprint",
    ]);
  });

  it("pins the exact minimum court width the routine needs", () => {
    // 2 * (6.3 footprint + 0.3 edge clearance) = 13.2. One centimetre under
    // fails; the shipped 14 keeps 0.4m of slack per side.
    const exact = edit("besties-playground-v2");
    (court(exact as AuthoredLevelDocument) as Mutable<AuthoredPlatformPiece>).size.x = 13.2;
    expect(validateEditorGameplayGuards(exact as AuthoredLevelDocument)).toEqual([]);

    const tooNarrow = edit("besties-playground-v2");
    (court(tooNarrow as AuthoredLevelDocument) as Mutable<AuthoredPlatformPiece>).size.x = 13.19;
    expect(codes(validateEditorGameplayGuards(tooNarrow as AuthoredLevelDocument))).toEqual([
      "besties.support-footprint",
    ]);

    // Depth is bound by the floor lane reaching 4.8 behind the anchor. The
    // anchor sits on the court centre line, so the binding half-depth is 5.1.
    const shallow = edit("besties-playground-v2");
    (court(shallow as AuthoredLevelDocument) as Mutable<AuthoredPlatformPiece>).size.z = 10.19;
    expect(codes(validateEditorGameplayGuards(shallow as AuthoredLevelDocument))).toEqual([
      "besties.support-footprint",
    ]);
  });

  it("rejects a platform standing proud of the court inside the footprint", () => {
    const document = edit("besties-playground-v2");
    const support = court(document as AuthoredLevelDocument);
    const boss = document.anchors.encounters.boss;
    const raised: AuthoredPlatformPiece = {
      type: "platform",
      id: "besties-court-riser",
      center: { x: boss.position.x + 4, y: support.center.y + 0.5, z: boss.position.z },
      size: { x: 2, y: 0.6, z: 2 },
    };
    document.pieces.push(raised as Mutable<AuthoredLevelPiece>);
    expect(codes(validateEditorGameplayGuards(document as AuthoredLevelDocument))).toEqual([
      "besties.footprint-height",
    ]);
  });

  it("allows a lower platform under the court and one outside the footprint", () => {
    const document = edit("besties-playground-v2");
    const support = court(document as AuthoredLevelDocument);
    const boss = document.anchors.encounters.boss;
    document.pieces.push({
      type: "platform",
      id: "besties-court-underpad",
      center: { x: boss.position.x, y: support.center.y - 2, z: boss.position.z },
      size: { x: 4, y: 0.6, z: 4 },
    } as Mutable<AuthoredLevelPiece>);
    document.pieces.push({
      type: "platform",
      id: "besties-court-balcony",
      // Clear of the 6.3m footprint edge.
      center: { x: boss.position.x + 9, y: support.center.y + 3, z: boss.position.z },
      size: { x: 4, y: 0.6, z: 4 },
    } as Mutable<AuthoredLevelPiece>);
    expect(validateEditorGameplayGuards(document as AuthoredLevelDocument)).toEqual([]);
  });

  it("ignores horizontal overlap wholly below the floor or above actor height", () => {
    const document = edit("besties-playground-v2");
    const support = court(document as AuthoredLevelDocument);
    const boss = document.anchors.encounters.boss;
    const floor = support.center.y + support.size.y / 2;
    const head = floor + AUTHORED_LEVEL_LIMITS.actorHeight;

    document.pieces.push(
      {
        type: "platform",
        id: "static-below-court",
        center: { x: boss.position.x, y: floor - 0.2, z: boss.position.z },
        size: { x: 2, y: 0.4, z: 2 },
      } as Mutable<AuthoredLevelPiece>,
      {
        type: "platform",
        id: "static-above-avatar",
        center: { x: boss.position.x, y: head + 0.2, z: boss.position.z },
        size: { x: 2, y: 0.4, z: 2 },
      } as Mutable<AuthoredLevelPiece>,
      {
        type: "moving-platform",
        id: "moving-below-court",
        center: { x: boss.position.x, y: floor - 0.2, z: boss.position.z },
        size: { x: 2, y: 0.4, z: 2 },
        motion: { axis: "x", distance: 1, period: 6 },
      } as Mutable<AuthoredLevelPiece>,
      {
        type: "moving-platform",
        id: "moving-above-avatar",
        center: { x: boss.position.x, y: head + 0.2, z: boss.position.z },
        size: { x: 2, y: 0.4, z: 2 },
        motion: { axis: "z", distance: 1, period: 6 },
      } as Mutable<AuthoredLevelPiece>,
      {
        type: "sweeper",
        id: "sweeper-below-court",
        center: { x: boss.position.x, y: floor - 0.2, z: boss.position.z },
        halfLength: 1,
        radius: 0.2,
        rotation: { period: 6 },
      } as Mutable<AuthoredLevelPiece>,
      {
        type: "sweeper",
        id: "sweeper-above-avatar",
        center: { x: boss.position.x, y: head + 0.2, z: boss.position.z },
        halfLength: 1,
        radius: 0.2,
        rotation: { period: 6 },
      } as Mutable<AuthoredLevelPiece>,
    );

    expect(validateEditorGameplayGuards(document as AuthoredLevelDocument)).toEqual([]);
  });

  it("rejects each obstacle type as soon as its vertical AABB enters the actor band", () => {
    const template = edit("besties-playground-v2");
    const support = court(template as AuthoredLevelDocument);
    const boss = template.anchors.encounters.boss;
    const floor = support.center.y + support.size.y / 2;
    const head = floor + AUTHORED_LEVEL_LIMITS.actorHeight;
    const penetration = 2e-6;
    const issuesFor = (piece: AuthoredLevelPiece): string[] => {
      const document = edit("besties-playground-v2");
      document.pieces.push(piece as Mutable<AuthoredLevelPiece>);
      return codes(validateEditorGameplayGuards(document as AuthoredLevelDocument));
    };

    expect(
      issuesFor({
        type: "platform",
        id: "static-floor-protrusion",
        center: {
          x: boss.position.x,
          y: floor - 0.2 + penetration,
          z: boss.position.z,
        },
        size: { x: 2, y: 0.4, z: 2 },
      }),
    ).toEqual(["besties.footprint-height"]);
    expect(
      issuesFor({
        type: "moving-platform",
        id: "moving-floor-protrusion",
        center: {
          x: boss.position.x,
          y: floor - 0.2 + penetration,
          z: boss.position.z,
        },
        size: { x: 2, y: 0.4, z: 2 },
        motion: { axis: "x", distance: 1, period: 6 },
      }),
    ).toEqual(["besties.footprint-obstructed"]);
    expect(
      issuesFor({
        type: "sweeper",
        id: "sweeper-floor-protrusion",
        center: {
          x: boss.position.x,
          y: floor - 0.2 + penetration,
          z: boss.position.z,
        },
        halfLength: 1,
        radius: 0.2,
        rotation: { period: 6 },
      }),
    ).toEqual(["besties.footprint-obstructed"]);
    expect(
      issuesFor({
        type: "platform",
        id: "static-head-intrusion",
        center: {
          x: boss.position.x,
          y: head + 0.2 - penetration,
          z: boss.position.z,
        },
        size: { x: 2, y: 0.4, z: 2 },
      }),
    ).toEqual(["besties.footprint-height"]);
  });

  it("rejects a moving platform or sweeper crossing the footprint", () => {
    const boss = SHIPPED["besties-playground-v2"]!.anchors.encounters.boss;

    const withFerry = edit("besties-playground-v2");
    const ferry: AuthoredMovingPlatformPiece = {
      type: "moving-platform",
      id: "besties-court-tram",
      // Parked well clear; only its 9m travel reaches the court.
      center: { x: boss.position.x + 14, y: boss.position.y, z: boss.position.z },
      size: { x: 2, y: 0.4, z: 2 },
      motion: { axis: "x", distance: 9, period: 6 },
    };
    withFerry.pieces.push(ferry as Mutable<AuthoredLevelPiece>);
    expect(codes(validateEditorGameplayGuards(withFerry as AuthoredLevelDocument))).toEqual([
      "besties.footprint-obstructed",
    ]);

    const withSweeper = edit("besties-playground-v2");
    const sweeper: AuthoredSweeperPiece = {
      type: "sweeper",
      id: "besties-court-bar",
      center: { x: boss.position.x + 8, y: boss.position.y + 0.4, z: boss.position.z },
      halfLength: 2.5,
      radius: 0.3,
      rotation: { period: 4 },
    };
    withSweeper.pieces.push(sweeper as Mutable<AuthoredLevelPiece>);
    expect(codes(validateEditorGameplayGuards(withSweeper as AuthoredLevelDocument))).toEqual([
      "besties.footprint-obstructed",
    ]);
  });

  it("returns sorted issues and tolerates a semantically broken draft", () => {
    const document = edit("besties-playground-v2");
    // The editor keeps repairable drafts; a dangling support reference is the
    // published validator's `reference.static-platform`, not ours.
    document.anchors.encounters.boss.platformId = "no-such-platform";
    expect(validateEditorGameplayGuards(document as AuthoredLevelDocument)).toEqual([]);

    const multiple = edit("besties-playground-v2");
    const support = court(multiple as AuthoredLevelDocument);
    (support as Mutable<AuthoredPlatformPiece>).size.x = 10;
    multiple.pieces.push({
      type: "platform",
      id: "besties-court-riser",
      center: {
        x: multiple.anchors.encounters.boss.position.x,
        y: support.center.y + 0.5,
        z: multiple.anchors.encounters.boss.position.z + 3,
      },
      size: { x: 2, y: 0.6, z: 2 },
    } as Mutable<AuthoredLevelPiece>);
    const issues = validateEditorGameplayGuards(multiple as AuthoredLevelDocument);
    expect(codes(issues)).toEqual([
      "besties.footprint-height",
      "besties.support-footprint",
    ]);
    expect(issues.map((issue) => issue.path)).toEqual([
      '$.anchors.encounters["boss"].position',
      '$.anchors.encounters["boss"].position',
    ]);
  });
});
