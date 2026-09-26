/**
 * Family-world foundations: lift dwell, the `drop` connection and bounce
 * practice (DESIGN-025). Each is opt-in for authored-level-v4 documents; a
 * zero or absent dwell keeps the lift motion byte-identical.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AUTHORED_LEVEL_V4_LIMITS,
  resolveAuthoredLevelDocument,
  validateAuthoredLevelDocument,
  type AuthoredConnection,
  type AuthoredLevelDocument,
  type AuthoredLevelPiece,
} from "../../src/shared/authored-level";
import { abilitiesForAge } from "../../src/shared/abilities";
import { sampleObby, type ObbyCourse } from "../../src/game/obby";
import {
  bounce,
  bouncePad,
  drop,
  jump,
  lift,
  liftCycleSeconds,
  platform,
  ride,
  walk,
} from "../../scripts/levels/lib/growth-kit";
import { STAGES, traverseEdge } from "./authored-traversal-lib";
import {
  liftTimeAtTop,
  missGrowthPractice,
  motionCycleSeconds,
  runGrowthRoute,
  traverseGrowthEdge,
} from "./growth-traversal-lib";

const demo = JSON.parse(
  readFileSync(
    new URL("../../scripts/levels/examples/vertical-v4-demo.project.json", import.meta.url),
    "utf8",
  ),
);
const base: AuthoredLevelDocument = demo.chapters[1].level;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** The demo level plus a separate test rig well beside the course (x ≥ 30). */
function withRig(
  pieces: readonly AuthoredLevelPiece[],
  connections: readonly AuthoredConnection[],
): AuthoredLevelDocument {
  const document = clone(base);
  return {
    ...document,
    pieces: [...document.pieces, ...pieces],
    connections: [...document.connections, ...connections],
  };
}

function codes(document: unknown): string[] {
  return validateAuthoredLevelDocument(document).map((entry) => entry.code);
}

function liftTop(course: ObbyCourse, id: string, time: number): number {
  const sampled = sampleObby(course, time).platforms.find((entry) => entry.id === id)!;
  return sampled.center.y + sampled.size.y / 2;
}

const connection = (document: AuthoredLevelDocument, from: string, to: string) =>
  document.connections.find((entry) => entry.from === from && entry.to === to)!;

describe("lift dwell", () => {
  const dock = platform("dwell-dock", { x: 40, z: 0, sizeX: 4, sizeZ: 4, top: 0 });
  const roof = platform("dwell-roof", { x: 40, z: -8, sizeX: 4, sizeZ: 4, top: 4 });
  const pieceFor = (dwell?: number) =>
    lift("dwell-lift", {
      x: 40,
      z: -4,
      sizeX: 3,
      sizeZ: 3,
      bottomTop: 0,
      distance: 4,
      period: 8,
      thickness: 0.4,
      ...(dwell === undefined ? {} : { dwell }),
    });
  const rig = (dwell?: number) =>
    withRig(
      [dock, pieceFor(dwell), roof],
      [ride("dwell-dock", "dwell-lift"), ride("dwell-lift", "dwell-roof")],
    );

  it("emits no dwell field for zero or absent dwell, so the course is byte-identical", () => {
    expect(pieceFor().travel).toEqual({ distance: 4, period: 8 });
    expect(pieceFor(0).travel).toEqual({ distance: 4, period: 8 });
    const plain = resolveAuthoredLevelDocument(rig()).course;
    const zero = resolveAuthoredLevelDocument(
      withRig(
        [dock, { ...pieceFor(), travel: { distance: 4, period: 8, dwell: 0 } }, roof],
        [ride("dwell-dock", "dwell-lift"), ride("dwell-lift", "dwell-roof")],
      ),
    ).course;
    expect(JSON.stringify(zero)).toBe(JSON.stringify(plain));
    const motion = plain.platforms.find((entry) => entry.id === "dwell-lift")!.motion!;
    expect(motion).toEqual({ axis: "y", distance: 2, period: 8, phase: -Math.PI / 2 });
    // The existing demo lift is untouched.
    expect(
      resolveAuthoredLevelDocument(base).course.platforms.find((entry) => entry.id === "sky-lift")!
        .motion,
    ).toEqual({ axis: "y", distance: 2, period: 8, phase: -Math.PI / 2 });
  });

  it("pauses at the bottom, rises for half the period, pauses at the top and descends", () => {
    const document = rig(2);
    expect(validateAuthoredLevelDocument(document)).toEqual([]);
    const course = resolveAuthoredLevelDocument(document).course;
    const courseLift = course.platforms.find((entry) => entry.id === "dwell-lift")!;
    expect(courseLift.motion).toEqual({
      axis: "y",
      distance: 2,
      period: 8,
      phase: -Math.PI / 2,
      dwell: 2,
    });
    expect(motionCycleSeconds(courseLift)).toBe(12);
    expect(liftCycleSeconds(pieceFor(2))).toBe(12);
    const top = (time: number) => liftTop(course, "dwell-lift", time);
    // Bottom dwell 0–2 s, rise 2–6 s, top dwell 6–8 s, descend 8–12 s.
    for (const time of [0, 0.5, 1.99]) expect(top(time)).toBeCloseTo(0, 9);
    expect(top(4)).toBeCloseTo(2, 9);
    for (const time of [6, 7, 7.99]) expect(top(time)).toBeCloseTo(4, 9);
    expect(top(10)).toBeCloseTo(2, 9);
    expect(top(12)).toBeCloseTo(0, 9);
    expect(top(12.5)).toBeCloseTo(0, 9);
    // The travel keeps the undelayed sine profile, shifted by the dwell.
    const plain = resolveAuthoredLevelDocument(rig()).course;
    for (const offset of [0.25, 1, 2.5, 3.75])
      expect(top(2 + offset)).toBeCloseTo(liftTop(plain, "dwell-lift", offset), 9);
    // Continuous: no step larger than the travel speed allows at 60 Hz.
    let previous = top(0);
    for (let time = 1 / 60; time <= 24; time += 1 / 60) {
      const next = top(time);
      expect(Math.abs(next - previous)).toBeLessThan(((2 * Math.PI * 2) / 8) * (1 / 60) + 1e-9);
      previous = next;
    }
  });

  it("keeps a lift phase meaning the same point of the travel", () => {
    // Phase π starts the lift at its top stop, at the start of that pause.
    const document = withRig(
      [dock, { ...pieceFor(1.5), travel: { distance: 4, period: 8, phase: Math.PI, dwell: 1.5 } }, roof],
      [ride("dwell-dock", "dwell-lift"), ride("dwell-lift", "dwell-roof")],
    );
    const course = resolveAuthoredLevelDocument(document).course;
    expect(liftTop(course, "dwell-lift", 0)).toBeCloseTo(4, 9);
    expect(liftTop(course, "dwell-lift", 1.49)).toBeCloseTo(4, 9);
    expect(liftTop(course, "dwell-lift", 1.5 + 2)).toBeCloseTo(2, 9);
  });

  it("validates dwell as 0–3 seconds, v4 only", () => {
    expect(AUTHORED_LEVEL_V4_LIMITS.maxLiftDwell).toBe(3);
    expect(codes(rig(3))).toEqual([]);
    expect(codes(rig(3.5))).toContain("schema.too_big");
    expect(codes(withRig(
      [dock, { ...pieceFor(), travel: { distance: 4, period: 8, dwell: -1 } }, roof],
      [ride("dwell-dock", "dwell-lift"), ride("dwell-lift", "dwell-roof")],
    ))).toContain("schema.too_small");
  });

  it("finds the start of each stop's pause and carries a rider on and off", () => {
    const level = resolveAuthoredLevelDocument(rig(2));
    expect(liftTimeAtTop(level.course, "dwell-lift", 4, 0)).toBeCloseTo(6, 1);
    // From mid-rise, the next bottom pause starts once the descent ends.
    expect(liftTimeAtTop(level.course, "dwell-lift", 0, 3)).toBeCloseTo(12, 1);
    for (const stage of STAGES) {
      const run = runGrowthRoute(
        level,
        ["dwell-dock", "dwell-lift", "dwell-roof"],
        stage,
        abilitiesForAge(0),
      );
      expect(run.failedAt, stage).toBeNull();
      expect(run.recoveries).toBe(0);
      expect(run.maxFeetY).toBeGreaterThan(3.9);
    }
    for (const edge of [
      connection(level.document, "dwell-dock", "dwell-lift"),
      connection(level.document, "dwell-lift", "dwell-roof"),
    ])
      for (const stage of STAGES)
        expect(
          traverseGrowthEdge(level, edge, stage, abilitiesForAge(0)).reached,
          `${edge.from}->${edge.to} ${stage}`,
        ).toBe(true);
  });
});

describe("drop connections", () => {
  const deckTop = (descent: number) => platform("drop-top", { x: 40, z: -20, sizeX: 4, sizeZ: 4, top: descent });
  const deckBottom = (gap: number) =>
    platform("drop-bottom", { x: 40, z: -24 - gap, sizeX: 4, sizeZ: 4, top: 0 });
  const rig = (descent: number, gap: number, connections = [drop("drop-top", "drop-bottom")]) =>
    withRig([deckTop(descent), deckBottom(gap)], connections);

  it("accepts descents of 0.36–3 m across gaps up to 1.4 m, at any age", () => {
    expect(AUTHORED_LEVEL_V4_LIMITS.drop).toEqual({ minDescent: 0.36, maxDescent: 3, maxGap: 1.4 });
    for (const [descent, gap] of [
      [0.36, 0],
      [0.36, 1.4],
      [3, 0],
      [3, 1.4],
      [1.5, 0.7],
    ] as const)
      expect(codes(rig(descent, gap)), `${descent}/${gap}`).toEqual([]);
  });

  it("rejects short, deep, wide, upward, moving and ability-gated drops", () => {
    expect(codes(rig(0.3, 0))).toEqual(["connection.rise"]);
    expect(codes(rig(3.2, 0))).toEqual(["connection.rise"]);
    expect(codes(rig(1, 1.5))).toEqual(["connection.gap"]);
    expect(codes(rig(1, 0, [drop("drop-bottom", "drop-top")]))).toEqual(["connection.rise"]);
    expect(
      codes(rig(1, 0, [{ ...drop("drop-top", "drop-bottom"), requires: "double-jump" }])),
    ).toEqual(["requires.mode"]);
    const ferry = withRig(
      [
        deckTop(1),
        {
          type: "moving-platform",
          id: "drop-ferry",
          center: { x: 40, y: -0.3, z: -24 },
          size: { x: 4, y: 0.6, z: 4 },
          motion: { axis: "x", distance: 1, period: 6 },
        },
      ],
      [drop("drop-top", "drop-ferry")],
    );
    expect(codes(ferry)).toContain("connection.mode");
    // Drops keep a jump's take-off and landing strips.
    const narrow = withRig(
      [deckTop(1), platform("drop-bottom", { x: 40, z: -22.5, sizeX: 4, sizeZ: 0.9, top: 0 })],
      [drop("drop-top", "drop-bottom")],
    );
    expect(codes(narrow)).toEqual(["connection.gateway-clearance"]);
  });

  it("rejects a landing under the takeoff deck, and crosses one that reaches back under it", () => {
    // The reviewer's stacked pair: a zero gap, but the landing lies wholly
    // under the deck, so a player who leaves the edge has overshot it.
    const high = platform("drop-top", { x: 40, z: -20, sizeX: 6, sizeZ: 6, top: 2.5, thickness: 0.4 });
    const stacked = platform("drop-bottom", { x: 40, z: -20.5, sizeX: 2, sizeZ: 2, top: 0 });
    expect(codes(withRig([high, stacked], [drop("drop-top", "drop-bottom")]))).toEqual([
      "connection.landing-under-source",
    ]);
    // Glides had the same hole.
    expect(
      codes(withRig([high, stacked], [jump("drop-top", "drop-bottom", { requires: "glide" })])),
    ).toEqual(["connection.landing-under-source"]);
    // A landing may reach back under the deck while 1.05 m (the avatar inset
    // plus a 0.75 m landing strip) lies beyond the takeoff edge at z=-23.
    const under = (farEdge: number) =>
      platform("drop-bottom", { x: 40, z: (farEdge - 21) / 2, sizeX: 4, sizeZ: -21 - farEdge, top: 0 });
    expect(codes(withRig([high, under(-24)], [drop("drop-top", "drop-bottom")]))).toEqual([
      "connection.landing-under-source",
    ]);
    for (const farEdge of [-24.05, -24.5]) {
      const document = withRig([high, under(farEdge)], [drop("drop-top", "drop-bottom")]);
      expect(codes(document)).toEqual([]);
      const level = resolveAuthoredLevelDocument(document);
      const edge = connection(level.document, "drop-top", "drop-bottom");
      for (const stage of STAGES) {
        const label = `far edge ${farEdge}, ${stage}`;
        expect(traverseEdge(level, edge, stage).reached, label).toBe(true);
        expect(traverseEdge(level, edge, stage, 0, { dropStyle: "step" }).reached, label).toBe(true);
        expect(traverseGrowthEdge(level, edge, stage, abilitiesForAge(0)).reached, label).toBe(true);
      }
    }
  });

  it("never appears in v1–v3 documents", () => {
    const document = rig(1, 0);
    expect(codes({ ...document, schemaVersion: "authored-level-v3" }).some((code) => code.startsWith("schema."))).toBe(true);
  });

  it("is crossed by the auto-pilot at every corner of the envelope, hopping or stepping", () => {
    for (const [descent, gap] of [
      [0.36, 0],
      [0.36, 1.4],
      [3, 0],
      [3, 1.4],
    ] as const) {
      const level = resolveAuthoredLevelDocument(rig(descent, gap));
      const edge = connection(level.document, "drop-top", "drop-bottom");
      for (const stage of STAGES) {
        const label = `${descent}m down, ${gap}m gap, ${stage}`;
        expect(traverseEdge(level, edge, stage).reached, label).toBe(true);
        expect(traverseGrowthEdge(level, edge, stage, abilitiesForAge(0)).reached, label).toBe(true);
      }
    }
    // A cautious child can simply walk off a short gap.
    for (const [descent, gap] of [
      [3, 0],
      [1, 0.3],
    ] as const) {
      const level = resolveAuthoredLevelDocument(rig(descent, gap));
      const edge = connection(level.document, "drop-top", "drop-bottom");
      for (const stage of STAGES) {
        const result = traverseEdge(level, edge, stage, 0, { dropStyle: "step" });
        expect(result.reached, `${descent}/${gap} ${stage}`).toBe(true);
        expect(result.airborne).toBe(true);
      }
    }
  });
});

describe("bounce practice", () => {
  // A small pad over a catch floor 0.6 m below it: a missed bounce lands on
  // the floor, and the retry climbs to the approach deck that leads onto the
  // pad (the catch floor sits too far below the pad to hop straight back).
  const pieces: AuthoredLevelPiece[] = [
    platform("bp-catch", { x: 46, z: -34, sizeX: 8, sizeZ: 6, top: 0 }),
    platform("bp-deck", { x: 46, z: -29, sizeX: 4, sizeZ: 2, top: 0.3 }),
    bouncePad("bp-pad", { x: 46, z: -30.8, sizeX: 1.6, sizeZ: 1.6, top: 0.6, strength: "small" }),
    platform("bp-ledge", { x: 46, z: -33.45, sizeX: 4, sizeZ: 3, top: 1.6 }),
    platform("bp-side-a", { x: 56, z: -30, sizeX: 2, sizeZ: 2, top: 0 }),
    platform("bp-side-b", { x: 58, z: -30, sizeX: 2, sizeZ: 2, top: 0 }),
  ];
  const connections: AuthoredConnection[] = [
    jump("bp-deck", "bp-pad"),
    bounce("bp-pad", "bp-ledge", { safeMissPlatformId: "bp-catch" }),
    jump("bp-catch", "bp-deck"),
  ];

  it("lets a v4 bounce declare a catch floor, and keeps every other rule", () => {
    const document = withRig(pieces, connections);
    expect(validateAuthoredLevelDocument(document)).toEqual([]);
    // Without the approach deck's connection onto the pad there is no retry.
    expect(
      codes(withRig(pieces, connections.filter((entry) => entry.from !== "bp-deck"))),
    ).toContain("safe-miss.retry-route");
    const issues = validateAuthoredLevelDocument(
      withRig(pieces, [
        ...connections,
        { ...walk("bp-side-a", "bp-side-b"), safeMissPlatformId: "bp-catch" },
      ]),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "safe-miss.mode",
        message: "A safe miss platform may only be declared for a jump or bounce connection",
      }),
    );
  });

  it("keeps the published message for v1–v3 documents", () => {
    const garden = JSON.parse(
      readFileSync(new URL("../../src/shared/levels/garden-playground-v2.json", import.meta.url), "utf8"),
    ) as AuthoredLevelDocument;
    const walkEdge = garden.connections.findIndex((entry) => entry.mode === "walk");
    const edited = clone(garden) as unknown as { connections: Array<Record<string, unknown>> };
    edited.connections[walkEdge]!.safeMissPlatformId = garden.mainPath[0];
    expect(
      validateAuthoredLevelDocument(edited).find((entry) => entry.code === "safe-miss.mode")?.message,
    ).toBe("A safe miss platform may only be declared for a jump connection");
  });

  it("misses a practice bounce onto its catch floor", () => {
    const level = resolveAuthoredLevelDocument(withRig(pieces, connections));
    const edge = connection(level.document, "bp-pad", "bp-ledge");
    for (const stage of STAGES) {
      expect(traverseGrowthEdge(level, edge, stage, abilitiesForAge(0)).reached, stage).toBe(true);
      const miss = missGrowthPractice(level, edge, stage, abilitiesForAge(0));
      expect(miss.startedOnSource, stage).toBe(true);
      expect(miss.reached, stage).toBe(true);
      expect(miss.supportId).toBe("bp-catch");
    }
  });
});
