// @vitest-environment jsdom
/**
 * DESIGN-027 validation: scare level 0 is byte-identical to the behavior before
 * scary moments existed. A scripted run on a family-style (authored-level-v4)
 * garden chapter records the player, every enemy and every presentation event
 * frame by frame, and hashes the lot. The expected hash was recorded from the
 * runtime on main before DESIGN-027 (73bb0fd). A chapter without `scare`, with
 * `scare: 0`, and a scary chapter with the parent switch off must all match it.
 */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authoredRoute,
  type AuthoredLevelResolver,
} from "../../src/game/authored-layout";
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

function resolverWith(extra: Record<string, unknown>): AuthoredLevelResolver {
  const route = {
    ...garden,
    document: {
      ...garden.document,
      schemaVersion: AUTHORED_LEVEL_SCHEMA_VERSION_V4,
      theme: "clubhouse",
      ...extra,
    },
  } as unknown as NonNullable<ReturnType<AuthoredLevelResolver>>;
  return (routeId) => (routeId === ROUTE ? route : authoredRoute(routeId));
}

function equippedSave(): SaveView {
  const save = makeAuthoredSave({ routeId: ROUTE });
  const adventure = save.adventure!;
  const collected = adventure.activeLevel!.pickups.map((pickup) => ({
    ...pickup,
    collected: true,
  }));
  adventure.activeLevel!.pickups = collected;
  adventure.inventory = collected;
  adventure.equippedId = collected.find((pickup) => pickup.kind === "attack-tool")!.id;
  return save;
}

const round = (value: number) => Math.round(value * 1e6) / 1e6;

describe("scare level 0 keeps the runtime byte-identical", () => {
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

  /** Scripted play beside ordinary-1: wait, walk, jump, strafe, wait. */
  function fingerprint(extra: Record<string, unknown>, options: Record<string, unknown> = {}): string {
    // Every run starts on the same clock: frame deltas are differences of
    // absolute times, so a later start rounds them differently.
    now = 1_000;
    const anchor = garden.anchors.encounters["ordinary-1"].position;
    runtimeState.spawnOverrides.push({ x: anchor.x, y: anchor.y, z: anchor.z + 3.2 });
    const save = equippedSave();
    const feedback: GameFeedbackEvent[] = [];
    const game = createGame({
      container: document.createElement("div"),
      save,
      authoredLevelResolver: resolverWith(extra),
      onAction: async () => save,
      onRefresh: async () => save,
      onFeedback: (event) => feedback.push(event),
      ...options,
    });
    const frames: unknown[] = [];
    for (let frame = 0; frame < 480; frame += 1) {
      if (frame === 90) game.setInput("moveY", 1);
      if (frame === 150) game.setInput("jump", true);
      if (frame === 152) game.setInput("jump", false);
      if (frame === 160) {
        game.setInput("moveY", 0);
        game.setInput("moveX", 0.6);
      }
      if (frame === 300) game.setInput("moveX", 0);
      advance();
      const inspection = game.inspect();
      const state = inspection.obby!.state;
      frames.push([
        [state.position.x, state.position.y, state.position.z, state.velocityY, state.facing].map(round),
        state.grounded,
        state.supportId,
        inspection.enemies.map((enemy) => [
          enemy.id,
          [enemy.position.x, enemy.position.y, enemy.position.z, enemy.facing, enemy.windupProgress].map(round),
          enemy.phase,
          enemy.hp,
        ]),
        inspection.status.jumpSequence,
        inspection.status.requestState,
      ]);
    }
    game.dispose();
    return createHash("sha256")
      .update(JSON.stringify({ frames, feedback }))
      .digest("hex");
  }

  /** Recorded on main at 73bb0fd, before DESIGN-027. */
  const EXPECTED = "6c62cd4de8dba327ad0c1d9eb7a7ce37d55e63e4df133bc83004f3e1ab7e1e4d";

  it("matches the pre-DESIGN-027 runtime without a scare level", () => {
    const actual = fingerprint({});
    if (process.env.PRINT_RUNTIME_FINGERPRINTS) console.log(`RUNTIME ${actual}`);
    expect(actual).toBe(EXPECTED);
  });

  it("matches it with an explicit scare: 0, and with the switch off or on", () => {
    expect(fingerprint({ scare: 0 })).toBe(EXPECTED);
    expect(fingerprint({ scare: 0 }, { scaryMoments: false })).toBe(EXPECTED);
    expect(fingerprint({}, { scaryMoments: true })).toBe(EXPECTED);
  });

  it("matches it for a scary chapter when the parent switch is off", () => {
    expect(fingerprint({ scare: 1 }, { scaryMoments: false })).toBe(EXPECTED);
    expect(fingerprint({ scare: 2 }, { scaryMoments: false })).toBe(EXPECTED);
  });

  it("differs once a scary chapter plays with the switch on (sleeping enemies stop tracking)", () => {
    expect(fingerprint({ scare: 1 })).not.toBe(EXPECTED);
    expect(fingerprint({ scare: 2 })).not.toBe(EXPECTED);
  });
});
