import { describe, expect, it } from "vitest";

import {
  AuthoredLevelValidationError,
  resolveAuthoredLevelDocument,
  validateAuthoredLevelDocument,
  type AuthoredLevelDocument,
  type AuthoredLevelIssue,
  type AuthoredLevelPiece,
} from "../../src/shared/authored-level";
import bestiesPlayground from "../../src/shared/levels/besties-playground-v1.json";
import gardenPlayground from "../../src/shared/levels/garden-playground-v1.json";

const ground = (
  id: string,
  z: number,
  overrides: Partial<Extract<AuthoredLevelPiece, { type: "platform" }>> = {},
): Extract<AuthoredLevelPiece, { type: "platform" }> => ({
  type: "platform",
  id,
  center: { x: 0, y: -0.3, z },
  size: { x: 8, y: 0.6, z: 4 },
  ...overrides,
});

function validDocument(): AuthoredLevelDocument {
  const pieces: AuthoredLevelPiece[] = [
    ground("p0", 0),
    ground("p1", -5),
    {
      type: "moving-platform",
      id: "p2",
      center: { x: 0, y: -0.3, z: -10 },
      size: { x: 8, y: 0.6, z: 4 },
      motion: { axis: "x", distance: 0.2, period: 6, phase: 0.4 },
    },
    ground("p3", -15),
    ground("p4", -20),
    ground("p5", -25),
    ground("p6", -30),
    ground("p7", -35),
    ground("p8", -40, { size: { x: 12, y: 0.6, z: 4 } }),
    ground("p9", -45),
    ground("b1", -17.5, { center: { x: 6, y: -0.3, z: -17.5 }, size: { x: 4, y: 0.6, z: 4 } }),
    ground("b2", -22.5, { center: { x: 6, y: -0.3, z: -22.5 }, size: { x: 4, y: 0.6, z: 4 } }),
    {
      type: "sweeper",
      id: "far-sweeper",
      center: { x: 20, y: 0.3, z: 0 },
      halfLength: 1,
      radius: 0.2,
      motion: { axis: "z", distance: 0.5, period: 4 },
      rotation: { period: 5, phase: 0.2 },
    },
    {
      type: "checkpoint",
      id: "cp-minor-one",
      position: { x: 0, y: 0, z: -6 },
      platformId: "p1",
      activation: { type: "radius", radius: 0.5 },
    },
    {
      type: "checkpoint",
      id: "cp-minor-two",
      position: { x: 0, y: 0, z: -15 },
      platformId: "p3",
      activation: { type: "radius", radius: 0.5 },
    },
    {
      type: "checkpoint",
      id: "cp0",
      position: { x: 0, y: 0, z: 1 },
      platformId: "p0",
      activation: { type: "platform" },
    },
  ];

  const lineConnections = Array.from({ length: 9 }, (_, index) => ({
    from: `p${index}`,
    to: `p${index + 1}`,
    mode: index === 1 || index === 2 ? "ride" as const : "jump" as const,
  }));

  const encounter = (
    platformId: string,
    z: number,
    kind: "ordinary-a" | "ordinary-b" | "boss",
  ) => ({
    platformId,
    position: { x: 0, y: 0, z },
    kind,
    checkpointId: "cp0",
    arena: {
      minX: kind === "boss" ? -4 : -3,
      maxX: kind === "boss" ? 4 : 3,
      minZ: z - 1.5,
      maxZ: z + 1.5,
    },
  });

  return {
    schemaVersion: "authored-level-v1",
    id: "garden-playground-v1",
    theme: "garden",
    pieces,
    connections: [
      ...lineConnections,
      { from: "p3", to: "b1", mode: "jump" },
      { from: "b1", to: "b2", mode: "jump" },
      { from: "b2", to: "p5", mode: "jump" },
    ],
    mainPath: Array.from({ length: 10 }, (_, index) => `p${index}`),
    branches: [["p3", "b1", "b2", "p5"]],
    anchors: {
      spawn: { platformId: "p0", position: { x: 0, y: 0, z: 1 } },
      finish: { platformId: "p9", position: { x: 0, y: 0, z: -45 } },
      rewardRespawn: { platformId: "p9", position: { x: 1, y: 0, z: -45 } },
      pickups: {
        "attack-tool": { platformId: "p1", position: { x: -1, y: 0, z: -5 } },
        "guard-tool": { platformId: "p1", position: { x: 1, y: 0, z: -5 } },
      },
      memories: {
        "minor-one": { platformId: "p1", position: { x: 0, y: 0, z: -6 } },
        "minor-two": { platformId: "p3", position: { x: 0, y: 0, z: -15 } },
        major: { platformId: "p9", position: { x: -1, y: 0, z: -45 } },
      },
      encounters: {
        "ordinary-1": encounter("p4", -20, "ordinary-a"),
        "ordinary-2": encounter("p5", -25, "ordinary-b"),
        "ordinary-3": encounter("p6", -30, "ordinary-a"),
        "ordinary-4": encounter("p7", -35, "ordinary-b"),
        boss: encounter("p8", -40, "boss"),
      },
      friendlies: {
        "friendly-1": { platformId: "p0", position: { x: -2, y: 0, z: 0 } },
        "friendly-2": { platformId: "b1", position: { x: 6, y: 0, z: -17.5 } },
        "friendly-3": { platformId: "b2", position: { x: 6, y: 0, z: -22.5 } },
      },
    },
  };
}

function clone(): AuthoredLevelDocument {
  return structuredClone(validDocument());
}

function issuesFor(document: unknown): readonly AuthoredLevelIssue[] {
  return validateAuthoredLevelDocument(document);
}

function gatewayIssuesFor(document: unknown): readonly AuthoredLevelIssue[] {
  return issuesFor(document).filter(
    (entry) => entry.code === "connection.gateway-clearance",
  );
}

function expectIssue(
  document: unknown,
  code: string,
  path?: string,
): void {
  expect(issuesFor(document)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code, ...(path ? { path } : {}) }),
    ]),
  );
}

describe("authored level documents", () => {
  it("resolves a strict document to immutable shared course, graph and anchor data", () => {
    const source = clone();
    const resolved = resolveAuthoredLevelDocument(source);

    expect(resolved.course.platforms).toHaveLength(12);
    expect(resolved.course.platforms[2]).toEqual({
      id: "p2",
      center: { x: 0, y: -0.3, z: -10 },
      size: { x: 8, y: 0.6, z: 4 },
      motion: { axis: "x", distance: 0.2, period: 6, phase: 0.4 },
    });
    expect(resolved.course.hazards).toEqual([
      {
        id: "far-sweeper",
        center: { x: 20, y: 0.3, z: 0 },
        halfLength: 1,
        radius: 0.2,
        motion: { axis: "z", distance: 0.5, period: 4 },
        rotation: { period: 5, phase: 0.2 },
      },
    ]);
    expect(resolved.course.checkpoints).toEqual([
      {
        id: "cp-minor-one",
        position: { x: 0, y: 0, z: -6 },
        triggerRadius: 0.5,
      },
      {
        id: "cp-minor-two",
        position: { x: 0, y: 0, z: -15 },
        triggerRadius: 0.5,
      },
      {
        id: "cp0",
        position: { x: 0, y: 0, z: 1 },
        triggerRadius: 1,
        triggerPlatformId: "p0",
      },
    ]);
    expect(resolved.graph.branches).toEqual([["p3", "b1", "b2", "p5"]]);
    expect(resolved.anchors).toBe(resolved.document.anchors);

    (source.pieces[0] as { center: { x: number } }).center.x = 99;
    expect(resolved.course.platforms[0]?.center.x).toBe(0);
    expect(() => {
      (resolved.document as { theme: string }).theme = "party";
    }).toThrow(TypeError);
    expect(Object.isFrozen(resolved.graph.branches[0])).toBe(true);
  });

  it("rejects unknown fields and non-finite or non-positive numeric geometry", () => {
    const unknown = clone() as AuthoredLevelDocument & { surprise?: boolean };
    unknown.surprise = true;
    expectIssue(unknown, "schema.unrecognized_keys", "$");

    const zeroWidth = clone();
    (zeroWidth.pieces[0] as { size: { x: number } }).size.x = 0;
    expectIssue(zeroWidth, "schema.too_small", "$.pieces[0].size.x");

    const infiniteMotion = clone();
    (infiniteMotion.pieces[2] as { motion: { distance: number } }).motion.distance = Infinity;
    expectIssue(infiniteMotion, "schema.invalid_type", "$.pieces[2].motion.distance");
  });

  it("reports stable identity and globally duplicate piece ids", () => {
    const wrongTheme = clone();
    (wrongTheme as { theme: string }).theme = "party";
    expectIssue(wrongTheme, "identity.theme", "$.theme");

    const duplicate = clone();
    (duplicate.pieces.at(-1) as { id: string }).id = "p0";
    expectIssue(duplicate, "id.duplicate", `$.pieces[${duplicate.pieces.length - 1}].id`);
  });

  it("requires every path edge and branch endpoint to reference the declared graph", () => {
    const missingReference = clone();
    (missingReference.connections[0] as { from: string }).from = "missing";
    expectIssue(missingReference, "reference.platform", "$.connections[0].from");
    expectIssue(missingReference, "graph.missing-connection", "$.mainPath[1]");

    const badRejoin = clone();
    (badRejoin.branches as string[][])[0] = ["p3", "b1", "b2"];
    expectIssue(badRejoin, "branch.rejoin", "$.branches[0][2]");

    const orphan = clone();
    (orphan.pieces as AuthoredLevelPiece[]).push(ground("orphan", 10));
    expectIssue(orphan, "graph.unused-platform", `$.pieces[${orphan.pieces.length - 1}].id`);
  });

  it("bounds the worst gap over moving-platform travel and the connected rise", () => {
    const unsafeMotion = clone();
    const moving = unsafeMotion.pieces[2] as Extract<
      AuthoredLevelPiece,
      { type: "moving-platform" }
    >;
    (moving.motion as { axis: string; distance: number }).axis = "z";
    (moving.motion as { distance: number }).distance = 1;
    expectIssue(unsafeMotion, "connection.gap", "$.connections[1]");
    expectIssue(unsafeMotion, "connection.gap", "$.connections[2]");

    const unsafeRise = clone();
    (unsafeRise.pieces[2] as { center: { y: number } }).center.y = 0.2;
    expectIssue(unsafeRise, "connection.rise", "$.connections[1]");
  });

  it("accepts hazard-free gateway strips in both shipped playgrounds", () => {
    expect(gatewayIssuesFor(gardenPlayground)).toEqual([]);
    expect(gatewayIssuesFor(bestiesPlayground)).toEqual([]);
    expect(issuesFor(gardenPlayground)).toEqual([]);
    expect(issuesFor(bestiesPlayground)).toEqual([]);
  });

  it("rejects a stationary wall across a required landing strip", () => {
    const blocked = structuredClone(
      gardenPlayground,
    ) as unknown as AuthoredLevelDocument;
    (blocked.pieces as AuthoredLevelPiece[]).push({
      type: "sweeper",
      id: "landing-wall",
      center: { x: 3, y: 0.22, z: -25.6 },
      halfLength: 3,
      radius: 0.4,
    });

    expect(gatewayIssuesFor(blocked)).toContainEqual({
      path: "$.connections[4]",
      code: "connection.gateway-clearance",
      message:
        'No common avatar-width x center lane keeps 0.75m source-exit and destination-entry strips clear of standing-height sweepers for "picnic" to "winding-east"',
    });
  });

  it("requires one lane that stays clear at both ends of a connection", () => {
    const divided = clone();
    (divided.pieces as AuthoredLevelPiece[]).push(
      {
        type: "sweeper",
        id: "left-exit-blocker",
        center: { x: -2, y: 0.22, z: -1.3 },
        halfLength: 1.7,
        radius: 0.05,
      },
      {
        type: "sweeper",
        id: "right-entry-blocker",
        center: { x: 2, y: 0.22, z: -3.8 },
        halfLength: 1.7,
        radius: 0.05,
      },
    );

    expectIssue(divided, "connection.gateway-clearance", "$.connections[0]");
  });

  it("uses full platform and hazard motion envelopes for gateway lanes", () => {
    const movingSupport = clone();
    const moving = movingSupport.pieces.find((piece) => piece.id === "p2") as Extract<
      AuthoredLevelPiece,
      { type: "moving-platform" }
    >;
    (moving.size as { x: number }).x = 0.9;
    expectIssue(
      movingSupport,
      "connection.gateway-clearance",
      "$.connections[1]",
    );

    const movingHazard = clone();
    (movingHazard.pieces as AuthoredLevelPiece[]).push({
      type: "sweeper",
      id: "moving-landing-wall",
      center: { x: 8, y: 0.22, z: -3.6 },
      halfLength: 0.1,
      radius: 0.1,
      motion: { axis: "x", distance: 12, period: 12 },
    });
    expectIssue(
      movingHazard,
      "connection.gateway-clearance",
      "$.connections[0]",
    );

    const movingEntry = clone();
    const approaching = movingEntry.pieces.find(
      (piece) => piece.id === "p2",
    ) as Extract<AuthoredLevelPiece, { type: "moving-platform" }>;
    (approaching.motion as { axis: "x" | "z" }).axis = "z";
    (movingEntry.pieces as AuthoredLevelPiece[]).push({
      type: "sweeper",
      id: "motion-edge-wall",
      center: { x: 0, y: 0.22, z: -9.55 },
      halfLength: 5,
      radius: 0.05,
    });
    expectIssue(
      movingEntry,
      "connection.gateway-clearance",
      "$.connections[1]",
    );
  });

  it("allows a broad alternate lane around a centered landing hazard", () => {
    const alternateLane = clone();
    (alternateLane.pieces as AuthoredLevelPiece[]).push({
      type: "sweeper",
      id: "center-landing-blocker",
      center: { x: 0, y: 0.22, z: -3.6 },
      halfLength: 0.5,
      radius: 0.1,
    });

    expect(gatewayIssuesFor(alternateLane)).toEqual([]);
  });

  it("ignores gateway hazards entirely below the feet or above the child", () => {
    const verticallyClear = clone();
    (verticallyClear.pieces as AuthoredLevelPiece[]).push(
      {
        type: "sweeper",
        id: "below-landing-wall",
        center: { x: 0, y: -0.4, z: -3.6 },
        halfLength: 5,
        radius: 0.4,
      },
      {
        type: "sweeper",
        id: "above-landing-wall",
        center: { x: 0, y: 1.62, z: -3.6 },
        halfLength: 5,
        radius: 0.4,
      },
    );

    expect(gatewayIssuesFor(verticallyClear)).toEqual([]);
  });

  it("keeps gameplay anchors and checkpoints on clear static ground", () => {
    const movingAnchor = clone();
    const friendly = movingAnchor.anchors.friendlies["friendly-2"] as {
      platformId: string;
      position: { x: number; y: number; z: number };
    };
    friendly.platformId = "p2";
    friendly.position = { x: 0, y: 0, z: -10 };
    expectIssue(
      movingAnchor,
      "reference.static-platform",
      '$.anchors.friendlies["friendly-2"].platformId',
    );

    const raisedCheckpoint = clone();
    (raisedCheckpoint.pieces.at(-1) as { position: { y: number } }).position.y = 0.1;
    expectIssue(
      raisedCheckpoint,
      "checkpoint.ground-height",
      `$.pieces[${raisedCheckpoint.pieces.length - 1}].position.y`,
    );

    const blockedSpawn = clone();
    const overhead = blockedSpawn.pieces.find((piece) => piece.id === "b1") as {
      center: { x: number; y: number; z: number };
      size: { x: number; y: number; z: number };
    };
    overhead.center = { x: 0, y: 0.8, z: 1 };
    overhead.size = { x: 2, y: 0.2, z: 2 };
    expectIssue(blockedSpawn, "clearance.blocked", "$.anchors.spawn.position");
  });

  it("allows broad landing activation while keeping its recovery point safe", () => {
    const broadCheckpoint = clone();
    const fightPlatform = broadCheckpoint.pieces.find((piece) => piece.id === "p4") as {
      size: { x: number; y: number; z: number };
    };
    fightPlatform.size.x = 12;
    (broadCheckpoint.pieces as AuthoredLevelPiece[]).push({
      type: "checkpoint",
      id: "fight-landing",
      platformId: "p4",
      position: { x: 5.5, y: 0, z: -20 },
      activation: { type: "platform" },
    });

    expect(issuesFor(broadCheckpoint)).toEqual([]);
  });

  it("rejects a recovery point in the attack strike band outside an arena", () => {
    const unsafeRecovery = clone();
    (unsafeRecovery.pieces as AuthoredLevelPiece[]).push({
      type: "checkpoint",
      id: "strike-band",
      platformId: "p4",
      position: { x: 3.5, y: 0, z: -20 },
      activation: { type: "radius", radius: 0.1 },
    });

    expectIssue(
      unsafeRecovery,
      "clearance.encounter",
      `$.pieces[${unsafeRecovery.pieces.length - 1}].activation`,
    );
  });

  it("rejects a protected content anchor just outside an arena but within attack reach", () => {
    const unsafeContent = clone();
    const friendly = unsafeContent.anchors.friendlies["friendly-2"] as {
      platformId: string;
      position: { x: number; y: number; z: number };
    };
    friendly.platformId = "p4";
    friendly.position = { x: 3.5, y: 0, z: -20 };
    expect(friendly.position.x).toBeGreaterThan(
      unsafeContent.anchors.encounters["ordinary-1"].arena.maxX,
    );

    expectIssue(
      unsafeContent,
      "clearance.encounter",
      '$.anchors.friendlies["friendly-2"].position',
    );
  });

  it("rejects unsafe checkpoint activation, hazard recovery and missing retry refs", () => {
    const oversizedActivation = clone();
    (oversizedActivation.pieces.at(-1) as { activation: unknown }).activation = {
      type: "radius",
      radius: 4,
    };
    expectIssue(
      oversizedActivation,
      "checkpoint.outside-support",
      `$.pieces[${oversizedActivation.pieces.length - 1}].activation`,
    );

    const hazardRecovery = clone();
    const hazard = hazardRecovery.pieces.find((piece) => piece.id === "far-sweeper") as {
      center: { x: number; y: number; z: number };
    };
    hazard.center = { x: 0, y: 0.3, z: 1 };
    expectIssue(
      hazardRecovery,
      "clearance.hazard",
      `$.pieces[${hazardRecovery.pieces.length - 1}].activation`,
    );

    const missingRetry = clone();
    (missingRetry.anchors.encounters["ordinary-2"] as { checkpointId: string }).checkpointId = "missing";
    expectIssue(
      missingRetry,
      "reference.checkpoint",
      '$.anchors.encounters["ordinary-2"].checkpointId',
    );
  });

  it("requires arenas to fit their support and progression anchors to bracket the boss", () => {
    const arenaOutside = clone();
    (arenaOutside.anchors.encounters["ordinary-1"].arena as { maxX: number }).maxX = 5;
    expectIssue(
      arenaOutside,
      "arena.outside-support",
      '$.anchors.encounters["ordinary-1"].arena',
    );

    const lateEquipment = clone();
    (lateEquipment.anchors.pickups["attack-tool"] as { platformId: string }).platformId = "p5";
    (lateEquipment.anchors.pickups["attack-tool"] as { position: { x: number; y: number; z: number } }).position = {
      x: -1,
      y: 0,
      z: -25,
    };
    expectIssue(
      lateEquipment,
      "ordering.pickup",
      '$.anchors.pickups["attack-tool"].platformId',
    );

    const bossPlatformReward = clone();
    (bossPlatformReward.anchors.memories.major as { platformId: string }).platformId = "p8";
    (bossPlatformReward.anchors.memories.major as { position: { x: number; y: number; z: number } }).position = {
      x: 5,
      y: 0,
      z: -40,
    };
    expectIssue(
      bossPlatformReward,
      "ordering.reward",
      "$.anchors.memories.major.platformId",
    );
  });

  it("rejects pairwise overlap between sequential encounter arenas", () => {
    const overlapping = clone();
    const second = overlapping.anchors.encounters["ordinary-2"] as {
      platformId: string;
      position: { x: number; y: number; z: number };
      arena: { minX: number; maxX: number; minZ: number; maxZ: number };
    };
    second.platformId = "p4";
    second.position = { x: 0, y: 0, z: -20 };
    second.arena = { minX: -2, maxX: 2, minZ: -21, maxZ: -19 };

    expect(issuesFor(overlapping)).toContainEqual({
      path: '$.anchors.encounters["ordinary-2"].arena',
      code: "arena.overlap",
      message:
        'Encounter arena overlaps $.anchors.encounters["ordinary-1"].arena',
    });
  });

  it("accepts generic v3 route ids and registered themes without weakening legacy ids", () => {
    const local = {
      ...clone(),
      schemaVersion: "authored-level-v3",
      id: "midnight-arcade-route",
      theme: "arcade",
    };
    expect(issuesFor(local)).toEqual([]);
    expect(resolveAuthoredLevelDocument(local).document).toMatchObject({
      schemaVersion: "authored-level-v3",
      id: "midnight-arcade-route",
      theme: "arcade",
    });

    expect(
      issuesFor({ ...local, id: "skyline-toybox-route", theme: "toybox" }),
    ).toEqual([]);
    expect(issuesFor({ ...local, id: "garden-playground-v2" })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "$.id", code: "schema.custom" }),
      ]),
    );

    const wrongLegacyTheme = { ...clone(), theme: "party" };
    expectIssue(wrongLegacyTheme, "identity.theme", "$.theme");
    expect(issuesFor(gardenPlayground)).toEqual([]);
    expect(issuesFor(bestiesPlayground)).toEqual([]);
  });

  it("throws a typed error carrying the exact validation issues", () => {
    const invalid = clone();
    (invalid.mainPath as string[])[0] = "missing";

    expect(() => resolveAuthoredLevelDocument(invalid)).toThrow(
      AuthoredLevelValidationError,
    );
    try {
      resolveAuthoredLevelDocument(invalid);
      throw new Error("expected resolver to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(AuthoredLevelValidationError);
      expect((error as AuthoredLevelValidationError).issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "$.mainPath[0]", code: "reference.platform" }),
        ]),
      );
    }
  });
});
