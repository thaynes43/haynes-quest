// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authoredRoute } from "../../../src/game/authored-layout";
import type { SceneFrame } from "../../../src/game/types";
import type { SaveView } from "../../../src/shared/contracts";
import { makeAuthoredSave } from "../../game/authored-fixtures";

const runtimeState = vi.hoisted(() => ({
  spawnOverrides: [] as Array<{ x: number; y: number; z: number }>,
  instances: [] as Array<{ frames: SceneFrame[] }>,
}));

vi.mock("../../../src/game/obby", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/game/obby")>();
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

vi.mock("../../../src/game/scene", () => ({
  GardenScene: class {
    readonly canvas = document.createElement("canvas");
    cameraYaw = 0;
    private readonly state = { frames: [] as SceneFrame[] };
    constructor(container: HTMLElement) {
      container.append(this.canvas);
      runtimeState.instances.push(this.state);
    }
    adjustCamera(): void {}
    rebuildRoute(): void {}
    updateProgress(): void {}
    getMediaState() {
      return { loading: 0, failed: 0, reloadRequired: false };
    }
    render(_p: unknown, _f: number, _e: number, frame?: SceneFrame): void {
      if (frame) this.state.frames.push(frame);
    }
    dispose(): void {
      this.canvas.remove();
    }
  },
}));

import { createGame } from "../../../src/game/createGame";

describe("WO083 probe: defeat recovery vs visited checkpoint", () => {
  let nextFrame: FrameRequestCallback | undefined;
  let now = 1000;

  beforeEach(() => {
    runtimeState.spawnOverrides.length = 0;
    runtimeState.instances.length = 0;
    nextFrame = undefined;
    now = 1000;
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    vi.spyOn(window.performance, "now").mockImplementation(() => now);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      nextFrame = cb;
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  const advance = (ms = 50): void => {
    now += ms;
    const cb = nextFrame;
    if (!cb) throw new Error("no frame requested");
    cb(now);
  };

  it("sends a player who reached dragon-safe back to the minor-one checkpoint", () => {
    const route = authoredRoute("garden-playground-v1")!;
    const dragon = route.course.checkpoints.find((c) => c.id === "dragon-safe")!;
    const picnic = route.course.checkpoints.find((c) => c.id === "picnic-safe")!;
    const initial = makeAuthoredSave({ routeId: "garden-playground-v1" });
    console.log("recoveredIds:", initial.recoveredIds);
    console.log(
      "minorMemoryIds:",
      initial.adventure!.activeLevel!.minorMemoryIds,
    );
    const fallen = makeAuthoredSave({
      routeId: "garden-playground-v1",
      revision: 1,
      phase: "fallen",
    });
    const retried = makeAuthoredSave({
      routeId: "garden-playground-v1",
      revision: 2,
    });
    // Start the session standing on the far dragon clearing platform.
    runtimeState.spawnOverrides.push({ ...dragon.position });
    const game = createGame({
      container: document.createElement("div"),
      save: initial,
      onAction: async () => retried,
      onRefresh: async () => initial,
    });
    advance();
    advance();
    advance();
    console.log("armed checkpoint:", game.inspect().obby?.checkpointId);
    console.log("position:", game.inspect().status.position);
    expect(game.inspect().obby?.checkpointId).toBe("dragon-safe");

    game.updateSave(fallen);
    game.updateSave(retried);
    console.log("after retry position:", game.inspect().status.position);
    console.log("after retry checkpoint:", game.inspect().obby?.checkpointId);
    console.log("picnic-safe:", picnic.position, "dragon-safe:", dragon.position);
    expect(game.inspect().status.position).toEqual(picnic.position);
    expect(game.inspect().obby?.checkpointId).toBe("picnic-safe");
    game.dispose();
  });
});
