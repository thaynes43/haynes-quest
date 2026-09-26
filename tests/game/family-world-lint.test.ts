import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AUTHORED_LEVEL_LIMITS,
  type AuthoredAnchor,
  type AuthoredArena,
  type AuthoredConnection,
  type AuthoredEncounterAnchor,
  type AuthoredLevelDocument,
  type AuthoredLevelPiece,
} from "../../src/shared/authored-level";
import { enemyAttackRange } from "../../src/game/combat";
import {
  FAMILY_WORLD_LINT_PRESETS,
  bossRetryRoute,
  lintBossRetryDistance,
  lintCameraHeadings,
  lintChapterEnding,
  lintFamilyChapter,
  lintLifts,
  lintPadGaps,
  lintStrikeEnvelopes,
} from "../../src/shared/family-world-lint";
import {
  bounce,
  bouncePad,
  drop,
  jump,
  lift,
  platform,
  ride,
  walk,
} from "../../scripts/levels/lib/growth-kit";

/**
 * A bare document for one rule at a time. The lints read geometry, paths and
 * anchors; the defaults park every anchor and fight on a remote plaza that no
 * connection touches, so only the pieces a test adds are in play.
 */
const PLAZA = platform("plaza", { x: 150, z: 0, sizeX: 60, sizeZ: 60, top: 0 });

function at(platformId: string, x: number, z: number, y = 0): AuthoredAnchor {
  return { platformId, position: { x, y, z } };
}

function fight(
  kind: AuthoredEncounterAnchor["kind"],
  x: number,
  z: number,
  platformId = "plaza",
  y = 0,
): AuthoredEncounterAnchor {
  return {
    ...at(platformId, x, z, y),
    kind,
    arena: { minX: x - 1, maxX: x + 1, minZ: z - 1, maxZ: z + 1 },
    checkpointId: "plaza-safe",
  };
}

function level(
  pieces: readonly AuthoredLevelPiece[],
  connections: readonly AuthoredConnection[],
  mainPath: readonly string[],
  anchors: Partial<{
    memories: Partial<AuthoredLevelDocument["anchors"]["memories"]>;
    encounters: Partial<AuthoredLevelDocument["anchors"]["encounters"]>;
    finish: AuthoredAnchor;
    rewardRespawn: AuthoredAnchor;
  }> = {},
): AuthoredLevelDocument {
  const plaza = (x: number, z: number) => at("plaza", x, z);
  return {
    schemaVersion: "authored-level-v4",
    id: "lint-fixture",
    theme: "clubhouse",
    pieces: [PLAZA, ...pieces],
    connections,
    mainPath,
    branches: [],
    anchors: {
      spawn: plaza(130, 0),
      finish: anchors.finish ?? plaza(170, 20),
      rewardRespawn: anchors.rewardRespawn ?? plaza(170, 18),
      pickups: { "attack-tool": plaza(132, 0), "guard-tool": plaza(134, 0) },
      memories: {
        "minor-one": plaza(136, 0),
        "minor-two": plaza(138, 0),
        major: plaza(170, 16),
        ...anchors.memories,
      },
      encounters: {
        "ordinary-1": fight("ordinary-a", 130, -20),
        "ordinary-2": fight("ordinary-b", 140, -20),
        "ordinary-3": fight("ordinary-a", 150, -20),
        "ordinary-4": fight("ordinary-b", 160, -20),
        boss: fight("boss", 150, 20),
        ...anchors.encounters,
      },
      friendlies: {
        "friendly-1": plaza(130, 10),
        "friendly-2": plaza(135, 10),
        "friendly-3": plaza(140, 10),
      },
    },
  };
}

const codes = (findings: readonly { code: string }[]) => findings.map((entry) => entry.code);

describe("family lint presets", () => {
  it("encode the coordinator rulings and the combat reach", () => {
    expect(FAMILY_WORLD_LINT_PRESETS.a).toEqual({
      maxPadGap: 0.35,
      maxCameraHeadingDegrees: 30,
      strikeDeckMargin: 0.5,
      maxBossRetryDistance: 25,
      minLiftDwell: 1.5,
      maxLiftLandingGap: 0.15,
      maxLiftLandingOffset: 0.15,
    });
    expect(FAMILY_WORLD_LINT_PRESETS.b).toMatchObject({ strikeDeckMargin: 1, minLiftDwell: 2 });
    // Strike envelopes use the same reach as the runtime enemies.
    expect(AUTHORED_LEVEL_LIMITS.ordinaryAttackReach).toBe(enemyAttackRange("ordinary"));
    expect(AUTHORED_LEVEL_LIMITS.bossAttackReach).toBe(enemyAttackRange("boss"));
  });
});

describe("(a) bounce pad gaps", () => {
  const rig = (landingGap: number, approachGap: number) =>
    level(
      [
        platform("deck", { x: 0, z: 0, sizeX: 4, sizeZ: 4, top: 0 }),
        bouncePad("pad", { x: 0, z: -2.8 - approachGap, sizeX: 1.6, sizeZ: 1.6, top: 0, strength: "big" }),
        platform("balcony", { x: 0, z: -5.6 - approachGap - landingGap, sizeX: 4, sizeZ: 4, top: 2 }),
      ],
      [walk("deck", "pad"), bounce("pad", "balcony")],
      ["deck", "pad", "balcony"],
    );

  it("accepts flush and 0.35 m gaps", () => {
    expect(lintPadGaps(rig(0.35, 0))).toEqual([]);
    expect(lintPadGaps(rig(0, 0.35))).toEqual([]);
  });

  it("reports a wide landing or approach gap with the measurement", () => {
    const findings = lintPadGaps(rig(0.6, 0.5));
    expect(findings).toEqual([
      expect.objectContaining({
        code: "family.pad-gap.approach",
        subject: "deck->pad",
        measured: 0.5,
        limit: 0.35,
        path: "$.connections[0]",
      }),
      expect.objectContaining({ code: "family.pad-gap.landing", subject: "pad->balcony", measured: 0.6 }),
    ]);
    expect(lintPadGaps(rig(0.6, 0.5), { maxPadGap: 0.7 })).toEqual([]);
  });
});

describe("(b) camera headings", () => {
  it("flags required steps toward the camera beyond 30 degrees off lateral", () => {
    const pieces = [
      platform("a", { x: 0, z: 0, sizeX: 3, sizeZ: 3, top: 0 }),
      platform("b", { x: 5, z: 2, sizeX: 3, sizeZ: 3, top: 0 }), // 21.8° toward camera
      platform("c", { x: 6, z: 6, sizeX: 3, sizeZ: 3, top: 0 }), // 76° toward camera
      platform("d", { x: 6, z: -4, sizeX: 3, sizeZ: 3, top: 0 }), // away from camera
      platform("e", { x: 0, z: -4, sizeX: 3, sizeZ: 3, top: 0 }), // lateral
    ];
    const document = level(
      pieces,
      [jump("a", "b"), jump("b", "c"), jump("c", "d"), jump("d", "e")],
      ["a", "b", "c", "d", "e"],
    );
    const findings = lintCameraHeadings(document);
    expect(findings).toEqual([
      expect.objectContaining({
        code: "family.camera-heading",
        subject: "b->c",
        path: "$.connections[1]",
        measured: 75.964,
        limit: 30,
      }),
    ]);
    expect(lintCameraHeadings(document, { maxCameraHeadingDegrees: 80 })).toEqual([]);
  });

  it("ignores a vertical lift ride with no horizontal heading", () => {
    const document = level(
      [
        platform("a", { x: 0, z: 0, sizeX: 3, sizeZ: 3, top: 0 }),
        lift("up", { x: 0, z: 0.3, sizeX: 2, sizeZ: 2, bottomTop: 0, distance: 3, period: 8, dwell: 2 }),
      ],
      [ride("a", "up")],
      ["a", "up"],
    );
    expect(lintCameraHeadings(document)).toEqual([]);
  });
});

describe("(c) strike envelopes", () => {
  const arenaAt = (minX: number, maxX: number): AuthoredArena => ({ minX, maxX, minZ: -1, maxZ: 1 });
  const rig = (arena: AuthoredArena, otherTop = 0) =>
    level(
      [
        platform("deck", { x: 0, z: 0, sizeX: 12, sizeZ: 12, top: 0 }),
        platform("exit", { x: 7.5, z: 0, sizeX: 2, sizeZ: 3, top: otherTop }),
      ],
      [otherTop === 0 ? walk("deck", "exit") : drop("exit", "deck")],
      ["deck", "exit"],
      {
        encounters: {
          "ordinary-1": {
            platformId: "deck",
            position: { x: (arena.minX + arena.maxX) / 2, y: 0, z: 0 },
            kind: "ordinary-a",
            arena,
            checkpointId: "deck-safe",
          },
        },
      },
    );

  it("accepts a fight well inside its deck and clear of every strip", () => {
    expect(lintStrikeEnvelopes(rig(arenaAt(1, 2)))).toEqual([]);
  });

  it("reports an envelope over an exit strip, and one too close to the edge", () => {
    // Envelope x 1.65–5.15: 0.85 m inside the deck, over the 1.05 m exit strip.
    const document = rig(arenaAt(3, 3.8));
    expect(codes(lintStrikeEnvelopes(document))).toEqual(["family.strike-envelope.exit-strip"]);
    expect(lintStrikeEnvelopes(document, FAMILY_WORLD_LINT_PRESETS.b)).toEqual([
      expect.objectContaining({ code: "family.strike-envelope.deck-edge", measured: 0.85, limit: 1 }),
      expect.objectContaining({ code: "family.strike-envelope.exit-strip", subject: "ordinary-1" }),
    ]);
    // An overhanging envelope measures negative.
    expect(lintStrikeEnvelopes(rig(arenaAt(4.2, 5.2)))[0]).toMatchObject({ measured: -0.55 });
  });

  it("ignores strips far above or below the fight", () => {
    const high = level(
      [
        platform("deck", { x: 0, z: 0, sizeX: 12, sizeZ: 12, top: 0 }),
        platform("sky-a", { x: 3, z: 0, sizeX: 3, sizeZ: 3, top: 5 }),
        platform("sky-b", { x: 6.5, z: 0, sizeX: 3, sizeZ: 3, top: 5 }),
      ],
      [jump("sky-a", "sky-b")],
      ["deck"],
      {
        encounters: {
          "ordinary-1": {
            platformId: "deck",
            position: { x: 3.4, y: 0, z: 0 },
            kind: "ordinary-a",
            arena: arenaAt(3, 3.8),
            checkpointId: "deck-safe",
          },
        },
      },
    );
    expect(lintStrikeEnvelopes(high)).toEqual([]);
  });
});

describe("(d) boss retry distance", () => {
  const rig = (bossZ: number, liftMiddle = false) =>
    level(
      [
        platform("memory-deck", { x: 0, z: 0, sizeX: 4, sizeZ: 4, top: 0 }),
        liftMiddle
          ? lift("middle", { x: 0, z: bossZ / 2, sizeX: 2, sizeZ: 2, bottomTop: 0, distance: 2, period: 8, dwell: 2 })
          : platform("middle", { x: 0, z: bossZ / 2, sizeX: 4, sizeZ: 4, top: 0 }),
        platform("boss-deck", { x: 0, z: bossZ, sizeX: 10, sizeZ: 10, top: liftMiddle ? 2 : 0 }),
      ],
      [],
      ["memory-deck", "middle", "boss-deck"],
      {
        memories: { "minor-two": at("memory-deck", 0, 0) },
        encounters: {
          boss: {
            ...fight("boss", 0, bossZ - 2, "boss-deck", liftMiddle ? 2 : 0),
            arena: { minX: -2, maxX: 2, minZ: bossZ - 3, maxZ: bossZ + 1 },
          },
        },
      },
    );

  it("measures the main-path route from minor-two to the boss arena", () => {
    expect(bossRetryRoute(rig(-20))).toEqual({ meters: 19, lifts: 0 });
    expect(lintBossRetryDistance(rig(-20))).toEqual([]);
    const far = lintBossRetryDistance(rig(-40));
    expect(far).toEqual([
      expect.objectContaining({ code: "family.boss-retry-distance", measured: 39, limit: 25 }),
    ]);
    expect(lintBossRetryDistance(rig(-40), { maxBossRetryDistance: 40 })).toEqual([]);
    expect(bossRetryRoute(rig(-20, true))?.lifts).toBe(1);
  });
});

describe("(e) the major memory ends the chapter", () => {
  const pieces = [
    platform("boss-deck", { x: 0, z: 0, sizeX: 8, sizeZ: 8, top: 0 }),
    platform("final", { x: 0, z: -7, sizeX: 5, sizeZ: 5, top: 0 }),
    platform("after", { x: 0, z: -12, sizeX: 4, sizeZ: 4, top: -1 }),
  ];
  const onFinal = {
    memories: { major: at("final", 0, -7) },
    rewardRespawn: at("final", 1, -7),
    finish: at("final", -1, -7),
  };

  it("accepts the memory, respawn and finish together on the final platform", () => {
    const document = level(pieces, [walk("boss-deck", "final")], ["boss-deck", "final"], onFinal);
    expect(lintChapterEnding(document)).toEqual([]);
  });

  it("reports misplaced anchors and anything reachable after the final platform", () => {
    const document = level(
      pieces,
      [walk("boss-deck", "final"), drop("final", "after")],
      ["boss-deck", "final"],
      { ...onFinal, memories: { major: at("boss-deck", 0, 0) } },
    );
    expect(lintChapterEnding(document)).toEqual([
      expect.objectContaining({ code: "family.chapter-ending.anchor", subject: "memory.major" }),
      expect.objectContaining({ code: "family.chapter-ending.content-after", subject: "final->after" }),
    ]);
  });
});

describe("(f) lifts", () => {
  const rig = (options: { dwell?: number; gap?: number; bottomTop?: number; topLanding?: number }) =>
    level(
      [
        platform("lower", { x: 0, z: 0, sizeX: 4, sizeZ: 4, top: options.bottomTop ?? 0 }),
        lift("car", {
          x: 0,
          z: -3.5 - (options.gap ?? 0),
          sizeX: 3,
          sizeZ: 3,
          bottomTop: 0,
          distance: 4,
          period: 8,
          ...(options.dwell === undefined ? {} : { dwell: options.dwell }),
        }),
        platform("upper", { x: 0, z: -7 - (options.gap ?? 0) * 2, sizeX: 4, sizeZ: 4, top: options.topLanding ?? 4 }),
      ],
      [ride("lower", "car"), ride("car", "upper")],
      ["lower", "car", "upper"],
    );

  it("accepts a dwelling lift with flush landings", () => {
    expect(lintLifts(rig({ dwell: 2 }))).toEqual([]);
    expect(lintLifts(rig({ dwell: 2 }), FAMILY_WORLD_LINT_PRESETS.b)).toEqual([]);
  });

  it("reports a short dwell for each world's minimum", () => {
    expect(codes(lintLifts(rig({})))).toEqual(["family.lift.dwell"]);
    expect(lintLifts(rig({ dwell: 1.5 }))).toEqual([]);
    expect(lintLifts(rig({ dwell: 1.5 }), FAMILY_WORLD_LINT_PRESETS.b)).toEqual([
      expect.objectContaining({ code: "family.lift.dwell", measured: 1.5, limit: 2, path: "$.pieces[2].travel.dwell" }),
    ]);
  });

  it("reports wide or uneven landings, and warns when a walker must hop", () => {
    expect(codes(lintLifts(rig({ dwell: 2, gap: 0.3 })))).toEqual([
      "family.lift.landing-gap",
      "family.lift.landing-gap",
    ]);
    // The bottom landing 0.1 m below the stop: within tolerance, but boarding
    // is a step up.
    expect(lintLifts(rig({ dwell: 2, bottomTop: -0.1 }))).toEqual([
      expect.objectContaining({ code: "family.lift.step-up", severity: "warning", measured: 0.1 }),
    ]);
    // The top landing 0.1 m below the top stop is an easy step down.
    expect(lintLifts(rig({ dwell: 2, topLanding: 3.9 }))).toEqual([]);
    expect(codes(lintLifts(rig({ dwell: 2, topLanding: 3.7 })))).toEqual(["family.lift.landing-offset"]);
  });
});

describe("lintFamilyChapter", () => {
  it("runs every rule over a real v4 level with world presets and overrides", () => {
    const demo = JSON.parse(
      readFileSync(
        new URL("../../scripts/levels/examples/vertical-v4-demo.project.json", import.meta.url),
        "utf8",
      ),
    );
    const document: AuthoredLevelDocument = demo.chapters[1].level;
    const findings = lintFamilyChapter(document);
    // The demo predates the rulings: a 0.4 m pad landing, a dwell-less lift.
    expect(findings).toContainEqual(
      expect.objectContaining({ code: "family.pad-gap.landing", subject: "spring-pad->sky-balcony", measured: 0.4 }),
    );
    expect(findings).toContainEqual(
      expect.objectContaining({ code: "family.lift.dwell", subject: "sky-lift", limit: 1.5 }),
    );
    expect(lintFamilyChapter(document, { world: "b" })).toContainEqual(
      expect.objectContaining({ code: "family.lift.dwell", limit: 2 }),
    );
    expect(
      lintFamilyChapter(document, { maxPadGap: 0.5 }).some((entry) => entry.rule === "pad-gap"),
    ).toBe(false);
    expect(Object.isFrozen(findings)).toBe(true);
  });
});
