import { describe, expect, it } from "vitest";

import {
  AUTHORED_LEVEL_LIMITS,
  resolveAuthoredLevelDocument,
  validateAuthoredLevelDocument,
  type AuthoredLevelDocument,
  type AuthoredLevelPiece,
  type AuthoredPlatformPiece,
  type AuthoredPosition,
} from "../../src/shared/authored-level";
import {
  createObbyState,
  OBBY_TUNING,
  stepObby,
  type ObbyCourse,
  type ObbyState,
} from "../../src/game/obby";
import gardenPlayground from "../../src/shared/levels/garden-playground-v1.json";

type MutablePosition = { x: number; y: number; z: number };
type MutableConnection = {
  from: string;
  to: string;
  mode: "walk" | "jump" | "ride";
  safeMissPlatformId?: string;
};

function gardenDocument(): AuthoredLevelDocument {
  return structuredClone(gardenPlayground) as unknown as AuthoredLevelDocument;
}

function v2Document(): AuthoredLevelDocument {
  const document = gardenDocument();
  Object.assign(document, {
    schemaVersion: "authored-level-v2",
    id: "garden-playground-v2",
  });
  return document;
}

function mutablePosition(position: AuthoredPosition): MutablePosition {
  return position as MutablePosition;
}

function staticPlatform(
  document: AuthoredLevelDocument,
  id: string,
): AuthoredPlatformPiece {
  const platform = document.pieces.find(
    (piece): piece is AuthoredPlatformPiece =>
      piece.type === "platform" && piece.id === id,
  );
  if (!platform) throw new Error(`Missing fixture platform ${id}`);
  return platform;
}

function raisePicnic(document: AuthoredLevelDocument): void {
  mutablePosition(staticPlatform(document, "picnic").center).y = 0;
  const anchors = [
    document.anchors.pickups["guard-tool"],
    document.anchors.memories["minor-one"],
    document.anchors.encounters["ordinary-1"],
  ];
  for (const anchor of anchors) mutablePosition(anchor.position).y = 0.3;
  const checkpoint = document.pieces.find(
    (piece) => piece.type === "checkpoint" && piece.id === "picnic-safe",
  );
  if (!checkpoint || checkpoint.type !== "checkpoint")
    throw new Error("Missing picnic checkpoint fixture");
  mutablePosition(checkpoint.position).y = 0.3;
}

function safePracticeDocument(): AuthoredLevelDocument {
  const document = v2Document();
  mutablePosition(staticPlatform(document, "garden-hop-1").center).y = 0;
  const connection = document.connections[0] as MutableConnection;
  connection.safeMissPlatformId = "practice-catch";
  (document.pieces as AuthoredLevelPiece[]).push({
    type: "platform",
    id: "practice-catch",
    center: { x: -1, y: -0.3, z: -4.35 },
    size: { x: 1.2, y: 0.6, z: 1.3 },
  });
  (document.connections as MutableConnection[]).push({
    from: "practice-catch",
    to: "welcome",
    mode: "walk",
  });
  return document;
}

function issueCodes(document: unknown): string[] {
  return validateAuthoredLevelDocument(document).map((issue) => issue.code);
}

describe("authored-level-v2 height contract", () => {
  it("preserves v1 ground-only anchors while accepting supported v2 world Y", () => {
    const legacy = gardenDocument();
    raisePicnic(legacy);
    expect(issueCodes(legacy)).toEqual(
      expect.arrayContaining([
        "checkpoint.ground-height",
        "anchor.ground-height",
      ]),
    );

    const elevated = v2Document();
    raisePicnic(elevated);
    const resolved = resolveAuthoredLevelDocument(elevated);

    expect(
      resolved.course.platforms.find(({ id }) => id === "picnic")?.center.y,
    ).toBe(0);
    expect(
      resolved.course.checkpoints.find(({ id }) => id === "picnic-safe")
        ?.position.y,
    ).toBe(0.3);
    expect(resolved.anchors.memories["minor-one"].position.y).toBe(0.3);
    expect(resolved.anchors.encounters["ordinary-1"].position.y).toBe(0.3);
  });

  it("keeps schema versions paired with immutable route ids and v1 fields", () => {
    const mismatched = v2Document();
    Object.assign(mismatched, { id: "garden-playground-v1" });
    expect(validateAuthoredLevelDocument(mismatched)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "$.id", code: "schema.invalid_value" }),
      ]),
    );

    const legacyWithCatch = gardenDocument();
    (legacyWithCatch.connections[0] as MutableConnection).safeMissPlatformId =
      "welcome";
    expect(validateAuthoredLevelDocument(legacyWithCatch)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "$.connections[0]",
          code: "schema.unrecognized_keys",
        }),
      ]),
    );
  });

  it("accepts a static catch covering the expanded gateway with a safe retry route", () => {
    const document = safePracticeDocument();
    const resolved = resolveAuthoredLevelDocument(document);

    expect(resolved.graph.connections[0]).toEqual({
      from: "welcome",
      to: "garden-hop-1",
      mode: "jump",
      safeMissPlatformId: "practice-catch",
    });
    expect(
      resolved.course.platforms.some(({ id }) => id === "practice-catch"),
    ).toBe(true);
  });

  it.each([
    [
      "missing catch",
      "reference.static-platform",
      (document: AuthoredLevelDocument) => {
        (document.connections[0] as MutableConnection).safeMissPlatformId =
          "missing";
      },
    ],
    [
      "partial catch",
      "safe-miss.partial",
      (document: AuthoredLevelDocument) => {
        mutablePosition(staticPlatform(document, "practice-catch").size).x =
          0.4;
      },
    ],
    [
      "catch at fall threshold",
      "safe-miss.fall-threshold",
      (document: AuthoredLevelDocument) => {
        const catchPlatform = staticPlatform(document, "practice-catch");
        mutablePosition(catchPlatform.center).y = -2.3;
      },
    ],
    [
      "catch above lower endpoint",
      "safe-miss.height",
      (document: AuthoredLevelDocument) => {
        const catchPlatform = staticPlatform(document, "practice-catch");
        mutablePosition(catchPlatform.center).y = -0.1;
      },
    ],
    [
      "hazardous catch",
      "safe-miss.hazard",
      (document: AuthoredLevelDocument) => {
        (document.pieces as AuthoredLevelPiece[]).push({
          type: "sweeper",
          id: "practice-hazard",
          center: { x: -1, y: 0.3, z: -4.35 },
          halfLength: 0.2,
          radius: 0.2,
        });
      },
    ],
    [
      "catch in a strike envelope",
      "safe-miss.encounter",
      (document: AuthoredLevelDocument) => {
        const catchPlatform = staticPlatform(document, "practice-catch");
        mutablePosition(catchPlatform.center).z = -12.5;
        mutablePosition(catchPlatform.size).x = 12;
        mutablePosition(catchPlatform.size).z = 17;
      },
    ],
    [
      "missing retry route",
      "safe-miss.retry-route",
      (document: AuthoredLevelDocument) => {
        (document.connections as MutableConnection[]).pop();
      },
    ],
    [
      "retry routed later",
      "safe-miss.retry-route",
      (document: AuthoredLevelDocument) => {
        (document.connections.at(-1) as MutableConnection).to = "garden-reward";
      },
    ],
  ] as const)("rejects a %s", (_name, code, mutate) => {
    const document = safePracticeDocument();
    mutate(document);
    expect(issueCodes(document)).toContain(code);
  });

  it("exempts only referenced safe supports from authored paths", () => {
    const document = safePracticeDocument();
    delete (document.connections[0] as MutableConnection).safeMissPlatformId;
    expect(validateAuthoredLevelDocument(document)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: expect.stringMatching(/^\$\.pieces\[\d+\]\.id$/),
          code: "graph.unused-platform",
        }),
      ]),
    );
  });

  it("requires exactly one checkpoint on each minor-memory platform", () => {
    for (const document of [gardenDocument(), v2Document()]) {
      const withoutMinorCheckpoint = document.pieces.filter(
        (piece) => piece.id !== "picnic-safe",
      );
      Object.assign(document, { pieces: withoutMinorCheckpoint });
      expect(validateAuthoredLevelDocument(document)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: '$.anchors.memories["minor-one"].platformId',
            code: "checkpoint.minor-platform-count",
          }),
        ]),
      );
    }

    for (const document of [gardenDocument(), v2Document()]) {
      (document.pieces as AuthoredLevelPiece[]).push({
        type: "checkpoint",
        id: "picnic-safe-extra",
        position: { x: 0, y: 0, z: -16.8 },
        platformId: "picnic",
        activation: { type: "radius", radius: 0.5 },
      });
      expect(issueCodes(document)).toContain("checkpoint.minor-platform-count");
    }
  });

  it("keeps the authored catch floor threshold aligned with physics", () => {
    expect(OBBY_TUNING.fallThresholdY).toBe(
      // The schema boundary is deliberately duplicated to keep shared data
      // independent from the game runtime; this assertion prevents drift.
      AUTHORED_LEVEL_LIMITS.fallThresholdY,
    );
  });
});

describe("safe height practice physics", () => {
  const input = { moveX: 0, moveY: 1 };
  const options = {
    cameraYaw: 0,
    canJump: true,
    radius: 0.25,
    height: 0.9,
  } as const;

  function tick(
    state: ObbyState,
    course: ObbyCourse,
    frame: number,
    jumpPressed = false,
  ) {
    return stepObby(state, input, course, {
      ...options,
      deltaSeconds: 1 / 60,
      timeSeconds: frame / 60,
      jumpPressed,
    });
  }

  it("keeps a missed step on the catch floor and lets the same player retry upward", () => {
    const course = resolveAuthoredLevelDocument(safePracticeDocument()).course;
    const state = createObbyState({ x: -1, y: 0, z: -3.5 });
    let recoveries = 0;

    for (let frame = 1; frame <= 60; frame += 1) {
      if (tick(state, course, frame).recovered) recoveries += 1;
    }
    expect(state).toMatchObject({
      grounded: true,
      position: { y: 0 },
      supportId: "practice-catch",
    });
    expect(recoveries).toBe(0);

    for (let frame = 61; frame <= 150; frame += 1) {
      if (tick(state, course, frame, frame === 61).recovered) recoveries += 1;
      if (state.grounded && state.supportId === "garden-hop-1") break;
    }
    expect(state).toMatchObject({
      grounded: true,
      position: { y: 0.3 },
      supportId: "garden-hop-1",
    });
    expect(recoveries).toBe(0);
  });
});
