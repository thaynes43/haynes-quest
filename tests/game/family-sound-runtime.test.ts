// @vitest-environment jsdom
/**
 * DESIGN-008 family world cues at runtime: `createGame` reports the moments
 * that play them on a family world level (growth moves), and an older route
 * reports exactly what it did before.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authoredRoute,
  type AuthoredLevelResolver,
} from "../../src/game/authored-layout";
import { planCasinoCollectibles } from "../../src/game/casino-tokens";
import type { ObbyPlatform } from "../../src/game/obby";
import type { GameFeedbackEvent } from "../../src/game/types";
import { AUTHORED_LEVEL_SCHEMA_VERSION_V4 } from "../../src/shared/authored-level";
import type { SaveView } from "../../src/shared/contracts";
import { makeAuthoredSave } from "./authored-fixtures";

const runtimeState = vi.hoisted(() => ({
  spawnOverrides: [] as Array<{ x: number; y: number; z: number }>,
}));

vi.mock("../../src/game/obby", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/game/obby")>();
  return {
    ...actual,
    createObbyState(position: { x: number; y: number; z: number }) {
      const state = actual.createObbyState(position);
      const override = runtimeState.spawnOverrides.shift();
      if (override) {
        Object.assign(state.position, override);
        Object.assign(state.checkpoint, override);
        Object.assign(state.origin, override);
      }
      return state;
    },
  };
});

vi.mock("../../src/game/scene", () => ({
  GardenScene: class {
    readonly canvas = document.createElement("canvas");
    cameraYaw = 0;
    constructor(container: HTMLElement) {
      container.append(this.canvas);
    }
    adjustCamera(): void {}
    rebuildRoute(): void {}
    updateProgress(): void {}
    getMediaState() {
      return { loading: 0, failed: 0, reloadRequired: false };
    }
    setCollectibles(): void {}
    collectItem(): void {}
    bouncePad(): void {}
    expectHit(): void {}
    anticipateHit(): void {}
    celebrate(): void {}
    render(): void {}
    dispose(): void {
      this.canvas.remove();
    }
  },
}));

import { createGame } from "../../src/game/createGame";

const ROUTE = "garden-playground-v2";
const garden = authoredRoute(ROUTE)!;

/** A test rig well beside the garden course (x ≤ 12): a deck, a crumble and a lift. */
const deck: ObbyPlatform = {
  id: "sound-deck",
  center: { x: 40, y: -0.5, z: 0 },
  size: { x: 8, y: 1, z: 8 },
};
const crumble: ObbyPlatform = {
  id: "sound-crumble",
  center: { x: 50, y: -0.25, z: 0 },
  size: { x: 2, y: 0.5, z: 2 },
  crumble: { shakeSeconds: 0.8, downSeconds: 3 },
};
// Phase 3π/2 starts at the bottom stop (top surface y = 0), at the start of its dwell.
const lift: ObbyPlatform = {
  id: "sound-lift",
  center: { x: 60, y: 0.75, z: 0 },
  size: { x: 2, y: 0.5, z: 2 },
  motion: { axis: "y", distance: 1, period: 4, phase: (3 * Math.PI) / 2, dwell: 1 },
};

/** The garden geometry as a family world chapter: v4, an era theme and the rig. */
const familyRoute = {
  ...garden,
  document: {
    ...garden.document,
    schemaVersion: AUTHORED_LEVEL_SCHEMA_VERSION_V4,
    theme: "clubhouse",
  },
  course: {
    ...garden.course,
    platforms: [...garden.course.platforms, deck, crumble, lift],
  },
} as unknown as NonNullable<ReturnType<AuthoredLevelResolver>>;
const familyResolver: AuthoredLevelResolver = (routeId) =>
  routeId === ROUTE ? familyRoute : authoredRoute(routeId);
const familyPlan = planCasinoCollectibles({
  authored: familyRoute.document,
  course: familyRoute.course,
})!;

const HONK_BUS = {
  catalogEntryId: "honk-bus",
  catalogEntryVersion: "v001",
  assetId: "honk-bus",
  assetVersion: "v001",
} as const;

/** An equipped save; a family save also freezes every growth move, as a family plan does. */
function equippedSave(family: boolean): SaveView {
  const save = makeAuthoredSave({ routeId: ROUTE });
  const adventure = save.adventure!;
  const collected = adventure.activeLevel!.pickups.map((pickup) => ({
    ...pickup,
    collected: true,
  }));
  adventure.activeLevel!.pickups = collected;
  adventure.inventory = collected;
  adventure.equippedId = collected.find((pickup) => pickup.kind === "attack-tool")!.id;
  if (family) {
    adventure.activeLevel!.growthMoves = ["move", "interact", "jump", "high-jump", "double-jump", "glide"];
    adventure.activeLevel!.encounters[0]!.content = { ...HONK_BUS };
  }
  return save;
}

describe("family world sound events at runtime", () => {
  let nextFrame: FrameRequestCallback | undefined;
  let now: number;

  beforeEach(() => {
    runtimeState.spawnOverrides.length = 0;
    nextFrame = undefined;
    now = 1_000;
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    vi.spyOn(window.performance, "now").mockImplementation(() => now);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      nextFrame = callback;
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const advance = (milliseconds = 1000 / 60): void => {
    now += milliseconds;
    const callback = nextFrame;
    if (!callback) throw new Error("Runtime did not request an animation frame");
    callback(now);
  };

  function start(options: {
    family: boolean;
    spawn: { x: number; y: number; z: number };
    feedback: GameFeedbackEvent[];
  }) {
    runtimeState.spawnOverrides.push(options.spawn);
    const save = equippedSave(options.family);
    const game = createGame({
      container: document.createElement("div"),
      save,
      ...(options.family ? { authoredLevelResolver: familyResolver } : {}),
      onAction: async () => save,
      onRefresh: async () => save,
      onFeedback: (event) => options.feedback.push(event),
    });
    advance();
    advance();
    return { game, save };
  }

  const ofType = <T extends GameFeedbackEvent["type"]>(
    feedback: GameFeedbackEvent[],
    type: T,
  ) => feedback.filter((event): event is Extract<GameFeedbackEvent, { type: T }> => event.type === type);

  it("reports the double jump and the glide, and counts the launch apart from plain jumps", () => {
    const feedback: GameFeedbackEvent[] = [];
    const { game } = start({ family: true, spawn: { x: 40, y: 0, z: 0 }, feedback });
    expect(game.inspect().status.launchJumpSequence).toBe(0);

    game.setInput("jump", true);
    game.setInput("jump", false);
    advance();
    expect(game.inspect().status.jumpSequence).toBe(1);
    for (let frame = 0; frame < 120 && game.inspect().obby!.state.velocityY >= 0; frame += 1) advance();
    expect(ofType(feedback, "double-jump")).toHaveLength(0);

    // Falling: the second press is the double jump, and holding it glides.
    game.setInput("jump", true);
    advance();
    expect(ofType(feedback, "double-jump")).toHaveLength(1);
    expect(game.inspect().status).toMatchObject({ jumpSequence: 2, launchJumpSequence: 1 });
    for (let frame = 0; frame < 120 && ofType(feedback, "glide").length === 0; frame += 1) advance();
    expect(ofType(feedback, "glide")).toEqual([{ type: "glide", active: true }]);
    expect(game.inspect().obby!.state.grounded).toBe(false);

    game.setInput("jump", false);
    advance();
    expect(ofType(feedback, "glide")).toEqual([
      { type: "glide", active: true },
      { type: "glide", active: false },
    ]);
    for (let frame = 0; frame < 180 && !game.inspect().obby!.state.grounded; frame += 1) advance();
    expect(game.inspect().obby!.state.grounded).toBe(true);
    expect(ofType(feedback, "double-jump")).toHaveLength(1);
    expect(ofType(feedback, "glide")).toHaveLength(2);
    game.dispose();
  });

  it("ends the glide sound when the world pauses mid-glide", () => {
    const feedback: GameFeedbackEvent[] = [];
    const { game } = start({ family: true, spawn: { x: 40, y: 0, z: 0 }, feedback });
    game.setInput("jump", true);
    for (let frame = 0; frame < 240 && ofType(feedback, "glide").length === 0; frame += 1) advance();
    expect(ofType(feedback, "glide")).toEqual([{ type: "glide", active: true }]);
    game.setPaused(true);
    advance();
    expect(ofType(feedback, "glide")).toEqual([
      { type: "glide", active: true },
      { type: "glide", active: false },
    ]);
    game.dispose();
  });

  it("reports a crumble's first touch and a ridden lift's stop", () => {
    const crumbleFeedback: GameFeedbackEvent[] = [];
    const crumbling = start({ family: true, spawn: { x: 50, y: 0, z: 0 }, feedback: crumbleFeedback });
    for (let frame = 0; frame < 20; frame += 1) advance();
    expect(ofType(crumbleFeedback, "crumble")).toEqual([{ type: "crumble", platformId: "sound-crumble" }]);
    crumbling.game.dispose();

    const liftFeedback: GameFeedbackEvent[] = [];
    const riding = start({ family: true, spawn: { x: 60, y: 0, z: 0 }, feedback: liftFeedback });
    for (let frame = 0; frame < 3.4 * 60; frame += 1) advance();
    expect(riding.game.inspect().obby!.supportId).toBe("sound-lift");
    expect(ofType(liftFeedback, "lift-stop")).toEqual([{ type: "lift-stop", platformId: "sound-lift" }]);
    riding.game.dispose();
  });

  it("reports a family enemy's wind-up with its model and flags its defeat", () => {
    const anchor = garden.anchors.encounters["ordinary-1"].position;
    const feedback: GameFeedbackEvent[] = [];
    const { game, save } = start({
      family: true,
      spawn: { x: anchor.x, y: anchor.y, z: anchor.z + 1.1 },
      feedback,
    });
    const busId = save.adventure!.activeLevel!.encounters[0]!.id;
    for (let frame = 0; frame < 120 && ofType(feedback, "windup").length === 0; frame += 1) advance();
    expect(ofType(feedback, "windup")).toEqual([{ type: "windup", encounterId: busId, assetId: "honk-bus" }]);

    const defeated = structuredClone(save);
    defeated.revision += 1;
    const bus = defeated.adventure!.activeLevel!.encounters[0]!;
    bus.hp = 0;
    bus.defeated = true;
    game.updateSave(defeated);
    expect(ofType(feedback, "defeat")).toEqual([
      { type: "defeat", encounterId: busId, boss: false, familyWorld: true },
    ]);
    game.dispose();
  });

  it("reports the era theme with a family world golden collectible", () => {
    const ticket = familyPlan.tickets[0]!;
    const feedback: GameFeedbackEvent[] = [];
    const { game } = start({
      family: true,
      spawn: { x: ticket.position.x, y: ticket.position.y - 0.55, z: ticket.position.z },
      feedback,
    });
    advance();
    expect(ofType(feedback, "ticket")).toEqual([{ type: "ticket", theme: "clubhouse" }]);
    game.dispose();
  });

  it("keeps an older route's reports unchanged", () => {
    const anchor = garden.anchors.encounters["ordinary-1"].position;
    const feedback: GameFeedbackEvent[] = [];
    const { game, save } = start({
      family: false,
      spawn: { x: anchor.x, y: anchor.y, z: anchor.z + 1.1 },
      feedback,
    });
    for (let frame = 0; frame < 120; frame += 1) advance();
    expect(game.inspect().enemies.some((enemy) => enemy.phase !== "idle")).toBe(true);
    game.setInput("jump", true);
    for (let frame = 0; frame < 60; frame += 1) advance();
    game.setInput("jump", false);
    const defeated = structuredClone(save);
    defeated.revision += 1;
    const enemy = defeated.adventure!.activeLevel!.encounters[0]!;
    enemy.hp = 0;
    enemy.defeated = true;
    game.updateSave(defeated);

    expect(game.inspect().status.launchJumpSequence).toBeUndefined();
    expect(feedback.map((event) => event.type)).not.toContain("windup");
    expect(feedback.map((event) => event.type)).not.toContain("glide");
    expect(ofType(feedback, "defeat")).toEqual([
      { type: "defeat", encounterId: enemy.id, boss: false },
    ]);
    game.dispose();
  });
});
