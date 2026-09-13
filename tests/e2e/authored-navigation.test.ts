import { describe, expect, it } from "vitest";

// @ts-expect-error The browser helper is executable JavaScript by design.
import * as navigation from "./authored-navigation.mjs";
// @ts-expect-error The CDP helper is executable JavaScript by design.
import * as browserDriver from "./authored-browser-driver.mjs";
// @ts-expect-error The executable layout helper also exports pure assertions.
import * as controlLayout from "./landscape-controls.mjs";

const {
  authoredDocumentFromInspection,
  buildTraversalPlan,
  findPlatformPath,
  landingPoint,
  platformGateway,
  safeMissRetryEdge,
  summarizeAuthoredCourse,
} = navigation;
const { chooseFallDirection, createAuthoredRouteDriver, nearbyHazard } =
  browserDriver;
const { assertControlBounds } = controlLayout;

type Edge = { from: string; to: string; mode: string };

const platform = (id: string, x: number, z: number) => ({
  type: "platform",
  id,
  center: { x, y: -0.25, z },
  size: { x: 4, y: 0.5, z: 4 },
});

function documentFixture() {
  const ids = ["spawn", "turn", "dock", "ferry", "landing", "finish", "side"];
  const anchor = (platformId: string) => ({
    position: { x: 31, y: 0, z: -47 },
    platformId,
  });
  return {
    schemaVersion: "authored-level-v1",
    id: "garden-playground-v1",
    theme: "garden",
    pieces: [
      ...ids
        .filter((id) => id !== "ferry")
        .map((id, index) => platform(id, 30 + index * 4, -45 - index * 3)),
      {
        type: "moving-platform",
        id: "ferry",
        center: { x: 42, y: -0.25, z: -54 },
        size: { x: 4, y: 0.5, z: 4 },
        motion: { axis: "x", distance: 3, period: 8 },
      },
      {
        type: "sweeper",
        id: "padded-sweeper",
        center: { x: 34, y: 0.4, z: -48 },
        halfLength: 2,
        radius: 0.2,
        rotation: { period: 6 },
      },
      {
        type: "checkpoint",
        id: "retry",
        position: { x: 38, y: 0, z: -51 },
        platformId: "dock",
        activation: { type: "platform" },
      },
    ],
    connections: [
      { from: "spawn", to: "turn", mode: "walk" },
      { from: "turn", to: "dock", mode: "jump" },
      { from: "dock", to: "ferry", mode: "ride" },
      { from: "ferry", to: "landing", mode: "ride" },
      { from: "landing", to: "finish", mode: "walk" },
      { from: "turn", to: "side", mode: "walk" },
      { from: "side", to: "landing", mode: "jump" },
    ],
    mainPath: ["spawn", "turn", "dock", "ferry", "landing", "finish"],
    branches: [["turn", "side", "landing"]],
    anchors: {
      spawn: anchor("spawn"),
      finish: anchor("finish"),
      rewardRespawn: anchor("finish"),
      pickups: {
        "attack-tool": anchor("spawn"),
        "guard-tool": anchor("turn"),
      },
      memories: {
        "minor-one": anchor("turn"),
        "minor-two": anchor("landing"),
        major: anchor("finish"),
      },
      encounters: Object.fromEntries(
        ["ordinary-1", "ordinary-2", "ordinary-3", "ordinary-4", "boss"].map(
          (role) => [
            role,
            {
              ...anchor(role === "boss" ? "finish" : "landing"),
              kind: "mister-hiss",
              arena: { halfExtents: { x: 1, z: 1 } },
              checkpointId: "retry",
            },
          ],
        ),
      ),
      friendlies: {
        "friendly-1": anchor("side"),
        "friendly-2": anchor("landing"),
        "friendly-3": anchor("finish"),
      },
    },
  };
}

function documentV2Fixture() {
  const document = documentFixture();
  document.schemaVersion = "authored-level-v2";
  document.pieces.push(platform("practice-catch", 34, -49));
  const practice = document.connections.find(
    ({ from, to }: Edge) => from === "turn" && to === "dock",
  )!;
  Object.assign(practice, { safeMissPlatformId: "practice-catch" });
  document.connections.push({
    from: "practice-catch",
    to: "spawn",
    mode: "walk",
  });
  return document;
}

function driverInspection(
  document: ReturnType<typeof documentFixture>,
  supportId: string,
  recoveries: number,
) {
  const centers = {
    spawn: { x: 0, y: 0, z: 0 },
    turn: { x: 4, y: 0, z: 0 },
    checkpoint: { x: 0, y: 0, z: 0 },
  };
  return {
    status: {
      position: centers[supportId as keyof typeof centers] ?? centers.spawn,
      grounded: true,
      jumpSequence: 0,
    },
    input: { moveX: 0, moveY: 0 },
    level: { authored: document },
    obby: {
      routeId: document.id,
      supportId,
      recoveries,
      checkpointId: "checkpoint",
      platforms: [
        { id: "spawn", center: centers.spawn, size: { x: 3, y: 0.5, z: 3 } },
        { id: "turn", center: centers.turn, size: { x: 3, y: 0.5, z: 3 } },
      ],
      hazards: [],
    },
  };
}

function queuedRouteDriver(samples: ReturnType<typeof driverInspection>[]) {
  const remaining = [...samples];
  let pulses = 0;
  const page = {
    isClosed: () => false,
    evaluate: async (_callback: unknown) => {
      const sample = remaining.shift();
      if (!sample) throw new Error("inspection queue exhausted");
      return sample;
    },
  };
  const controls = {
    release: async () => undefined,
    jumpToward: async () => undefined,
    pulseToward: async () => {
      pulses += 1;
    },
  };
  return {
    driver: createAuthoredRouteDriver({
      page,
      controls,
      screenshot: async () => undefined,
      mark: () => undefined,
      maxRecoveries: 10,
    }),
    remaining,
    pulses: () => pulses,
  };
}

describe("authored browser navigation", () => {
  it("derives a transformed main route without coordinate or id bands", () => {
    const document = documentFixture();
    const plan = buildTraversalPlan(document);

    expect(plan.platformIds).toEqual([
      "spawn",
      "turn",
      "dock",
      "ferry",
      "landing",
      "finish",
    ]);
    expect(
      plan.edges.map(({ from, to, mode }: Edge) => ({ from, to, mode })),
    ).toEqual(document.connections.slice(0, 5));
    expect(summarizeAuthoredCourse(document)).toEqual({
      id: "garden-playground-v1",
      schemaVersion: "authored-level-v1",
      platforms: 6,
      movingPlatforms: 1,
      sweepers: 1,
      checkpoints: 1,
      mainPathPlatforms: 6,
      branches: 1,
      connections: 7,
      safeMissConnections: 0,
      safeMissPlatforms: 0,
    });
  });

  it("visits a selected branch and rejoins the declared main path", () => {
    const plan = buildTraversalPlan(documentFixture(), { branchIndex: 0 });

    expect(plan.platformIds).toEqual([
      "spawn",
      "turn",
      "side",
      "landing",
      "finish",
    ]);
    expect(plan.branchPlatformIds).toEqual(["turn", "side", "landing"]);
    expect(plan.edges.map((edge: Edge) => edge.mode)).toEqual([
      "walk",
      "walk",
      "jump",
      "walk",
    ]);
  });

  it("finds directed content-anchor routes from live support state", () => {
    const path = findPlatformPath(documentFixture(), "spawn", "finish");
    expect(path.map(({ from, to }: Edge) => `${from}->${to}`)).toEqual([
      "spawn->turn",
      "turn->side",
      "side->landing",
      "landing->finish",
    ]);
  });

  it("reads the public inspection object and rejects broken authored edges", () => {
    const document = documentFixture();
    expect(
      authoredDocumentFromInspection({ level: { authored: document } }),
    ).toBe(document);

    const broken = documentFixture();
    broken.connections = broken.connections.filter(
      ({ from, to }: Edge) => from !== "turn" || to !== "dock",
    );
    expect(() => buildTraversalPlan(broken)).toThrow(
      "authored.mainPath has no connection turn -> dock",
    );
  });

  it("targets an inset landing point on live sampled platform geometry", () => {
    expect(
      landingPoint(
        { center: { x: 10, y: 1, z: -8 }, size: { x: 4, y: 0.5, z: 6 } },
        { x: 2, y: 0, z: -20 },
      ),
    ).toEqual({ x: 8.45, y: 1.25, z: -10.55 });
  });

  it("aligns a jump through the shared corridor of offset platforms", () => {
    const gateway = platformGateway(
      { center: { x: -1, y: -0.3, z: -6.2 }, size: { x: 4.4, y: 0.6, z: 3 } },
      { center: { x: 1, y: -0.3, z: -10 }, size: { x: 4.4, y: 0.6, z: 3 } },
    );

    expect(gateway).toEqual({
      from: { x: 0, y: 0, z: -7.38 },
      to: { x: 0, y: 0, z: -8.82 },
    });
  });

  it("approaches the outer face of an overlapping raised platform", () => {
    const gateway = platformGateway(
      { center: { x: 7, y: -0.3, z: -72.8 }, size: { x: 4, y: 0.6, z: 6 } },
      { center: { x: 0, y: 0, z: -76.8 }, size: { x: 12, y: 0.6, z: 10 } },
    );

    expect(gateway.from.x).toBeCloseTo(6.32);
    expect(gateway.to.x).toBeCloseTo(5.68);
    expect(gateway.from.y).toBeCloseTo(0);
    expect(gateway.to.y).toBeCloseTo(0.3);
  });

  it("accepts v2 safe misses with a declared retry edge", () => {
    const document = documentV2Fixture();
    const plan = buildTraversalPlan(document);
    const edge = plan.edges.find(
      ({ from, to }: Edge) => from === "turn" && to === "dock",
    );

    expect(edge.safeMissPlatformId).toBe("practice-catch");
    expect(safeMissRetryEdge(document, edge)).toMatchObject({
      from: "practice-catch",
      to: "spawn",
      mode: "walk",
    });
    expect(summarizeAuthoredCourse(document)).toMatchObject({
      schemaVersion: "authored-level-v2",
      safeMissConnections: 1,
      safeMissPlatforms: 1,
    });
  });

  it("rejects an unsafe or unreturnable v2 catch", () => {
    const movingCatch = documentV2Fixture();
    const catchPiece = movingCatch.pieces.find(
      (piece) => piece.id === "practice-catch",
    )!;
    catchPiece.type = "moving-platform";
    expect(() => buildTraversalPlan(movingCatch)).toThrow(
      "connection safe miss practice-catch is not a static platform",
    );

    const noRetry = documentV2Fixture();
    noRetry.connections = noRetry.connections.filter(
      ({ from }: Edge) => from !== "practice-catch",
    );
    expect(() => buildTraversalPlan(noRetry)).toThrow(
      "safe miss practice-catch has no declared retry edge back toward the practice start",
    );

    const forwardOnly = documentV2Fixture();
    forwardOnly.connections = forwardOnly.connections.map((connection) =>
      connection.from === "practice-catch"
        ? { ...connection, to: "landing" }
        : connection,
    );
    expect(() => buildTraversalPlan(forwardOnly)).toThrow(
      "safe miss practice-catch has no declared retry edge back toward the practice start",
    );
  });

  it("rejects a future authored schema instead of silently using it", () => {
    const document = documentFixture();
    document.schemaVersion = "authored-level-v3";

    expect(() => buildTraversalPlan(document)).toThrow(
      "unsupported authored level schema",
    );
  });

  it("selects an actual fall direction clear of neighboring platforms", () => {
    const direction = chooseFallDirection({
      status: { position: { x: 0, y: 0, z: 0 } },
      obby: {
        supportId: "current",
        platforms: [
          {
            id: "current",
            center: { x: 0, y: -0.25, z: 0 },
            size: { x: 6, y: 0.5, z: 6 },
          },
          {
            id: "next",
            center: { x: 0, y: -0.25, z: -5 },
            size: { x: 6, y: 0.5, z: 3 },
          },
        ],
      },
    });

    expect(direction.dz).not.toBe(-1);
    expect(direction.clearance).toBeGreaterThan(0);
  });

  it("uses sampled capsule endpoints to detect a sweeper near the player", () => {
    const hazard = nearbyHazard(
      {
        obby: {
          hazards: [
            {
              id: "rotated-sweeper",
              start: { x: 2, y: 0.2, z: 1 },
              end: { x: 2, y: 0.2, z: 5 },
              center: { x: 2, y: 0.2, z: 3 },
              radius: 0.2,
              angle: Math.PI / 2,
            },
          ],
        },
      },
      { x: 1.2, y: 0, z: 3 },
      0.7,
    );

    expect(hazard?.id).toBe("rotated-sweeper");
  });

  it("checks corner placement, relative action size, and control separation", () => {
    const boxes = {
      header: { x: 0, y: 0, width: 390, height: 60 },
      joystick: { x: 12, y: 660, width: 172, height: 172 },
      jump: { x: 282, y: 736, width: 96, height: 96 },
      attack: { x: 218, y: 642, width: 80, height: 80 },
      secondary: { x: 320, y: 620, width: 58, height: 58 },
    };
    expect(() =>
      assertControlBounds({ width: 390, height: 844 }, boxes, [170, 184]),
    ).not.toThrow();

    expect(() =>
      assertControlBounds(
        { width: 390, height: 844 },
        { ...boxes, jump: { ...boxes.jump, x: 80, y: 520 } },
        [170, 184],
      ),
    ).toThrow("Jump is not in the lower-right thumb region");
    expect(() =>
      assertControlBounds(
        { width: 390, height: 844 },
        { ...boxes, attack: { ...boxes.attack, x: 170 } },
        [170, 184],
      ),
    ).toThrow();
  });

  it("gives a successfully crossed edge a fresh bounded budget after checkpoint recovery", async () => {
    const document = documentFixture();
    const at = (supportId: string, recoveries: number) =>
      driverInspection(document, supportId, recoveries);
    const queued = queuedRouteDriver([
      at("spawn", 0),
      at("spawn", 0),
      at("spawn", 0),
      at("spawn", 0),
      at("spawn", 1),
      at("spawn", 1),
      at("spawn", 1),
      at("spawn", 1),
      at("spawn", 2),
      at("spawn", 2),
      at("spawn", 2),
      at("spawn", 2),
      at("turn", 2),
      at("spawn", 3),
      at("spawn", 3),
      at("spawn", 3),
      at("spawn", 3),
      at("turn", 3),
    ]);
    const edge = { from: "spawn", to: "turn", mode: "walk" };

    expect(
      (await queued.driver.crossEdge(edge, "first-crossing")).obby.supportId,
    ).toBe("turn");
    expect(
      (await queued.driver.crossEdge(edge, "revisit-after-recovery")).obby
        .supportId,
    ).toBe("turn");
    expect(queued.driver.evidence.edgeEvidence).toHaveLength(2);
    expect(queued.pulses()).toBe(4);
    expect(queued.remaining).toHaveLength(0);
  });

  it("retains and honestly reports the three-attempt bound for an unresolved edge", async () => {
    const document = documentFixture();
    const at = (supportId: string, recoveries: number) =>
      driverInspection(document, supportId, recoveries);
    const queued = queuedRouteDriver([
      at("spawn", 0),
      at("spawn", 0),
      at("spawn", 0),
      at("spawn", 0),
      at("checkpoint", 1),
      at("spawn", 1),
      at("spawn", 1),
      at("spawn", 1),
      at("spawn", 1),
      at("checkpoint", 2),
      at("spawn", 2),
      at("spawn", 2),
      at("spawn", 2),
      at("spawn", 2),
      at("checkpoint", 3),
      at("spawn", 3),
    ]);
    const edge = { from: "spawn", to: "turn", mode: "walk" };

    expect(
      (await queued.driver.crossEdge(edge, "unresolved-crossing")).obby
        .supportId,
    ).toBe("checkpoint");
    expect(
      (await queued.driver.crossEdge(edge, "unresolved-crossing")).obby
        .supportId,
    ).toBe("checkpoint");
    expect(
      (await queued.driver.crossEdge(edge, "unresolved-crossing")).obby
        .supportId,
    ).toBe("checkpoint");
    await expect(
      queued.driver.crossEdge(edge, "unresolved-crossing"),
    ).rejects.toThrow(
      "unresolved-crossing: walk edge exhausted its 3-attempt budget without a landing observation",
    );
    expect(queued.pulses()).toBe(3);
    expect(queued.remaining).toHaveLength(0);
  });
});
