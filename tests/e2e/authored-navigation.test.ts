import { describe, expect, it } from "vitest";

// @ts-expect-error The browser helper is executable JavaScript by design.
import * as navigation from "./authored-navigation.mjs";
// @ts-expect-error The CDP helper is executable JavaScript by design.
import * as browserDriver from "./authored-browser-driver.mjs";

const {
  authoredDocumentFromInspection,
  buildTraversalPlan,
  findPlatformPath,
  landingPoint,
  platformGateway,
  summarizeAuthoredCourse,
} = navigation;
const { chooseFallDirection, nearbyHazard } = browserDriver;

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
      ...ids.filter((id) => id !== "ferry").map((id, index) =>
        platform(id, 30 + index * 4, -45 - index * 3),
      ),
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
          (role) => [role, { ...anchor(role === "boss" ? "finish" : "landing"), kind: "mister-hiss", arena: { halfExtents: { x: 1, z: 1 } }, checkpointId: "retry" }],
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

  it("rejects a future authored schema instead of silently using it", () => {
    const document = documentFixture();
    document.schemaVersion = "authored-level-v2";

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
          { id: "current", center: { x: 0, y: -0.25, z: 0 }, size: { x: 6, y: 0.5, z: 6 } },
          { id: "next", center: { x: 0, y: -0.25, z: -5 }, size: { x: 6, y: 0.5, z: 3 } },
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
});
