// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authoredRoute } from "../../src/game/authored-layout";
import { checkpointForSave, createLevelLayout } from "../../src/game/level";
import type { SceneFrame } from "../../src/game/types";
import type { SaveView } from "../../src/shared/contracts";
import { makeAuthoredSave } from "./authored-fixtures";

const runtimeState = vi.hoisted(() => ({
  spawnOverrides: [] as Array<{ x: number; y: number; z: number }>,
  instances: [] as Array<{
    rebuilds: Array<{ id: string | null; routeId?: string }>;
    updates: number[];
    frames: SceneFrame[];
  }>,
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
    private readonly state = {
      rebuilds: [] as Array<{ id: string | null; routeId?: string }>,
      updates: [] as number[],
      frames: [] as SceneFrame[],
    };

    constructor(container: HTMLElement) {
      container.append(this.canvas);
      runtimeState.instances.push(this.state);
    }

    adjustCamera(): void {}

    rebuildRoute(level: { id: string | null; routeId?: string }): void {
      this.state.rebuilds.push({ id: level.id, routeId: level.routeId });
    }

    updateProgress(save: SaveView): void {
      this.state.updates.push(save.revision);
    }

    getMediaState() {
      return { loading: 0, failed: 0, reloadRequired: false };
    }

    render(
      _position: unknown,
      _facing: number,
      _elapsed: number,
      frame?: SceneFrame,
    ): void {
      if (frame) this.state.frames.push(frame);
    }

    dispose(): void {
      this.canvas.remove();
    }
  },
}));

import { createGame } from "../../src/game/createGame";

describe("authored level runtime", () => {
  let nextFrame: FrameRequestCallback | undefined;
  let now: number;

  beforeEach(() => {
    runtimeState.spawnOverrides.length = 0;
    runtimeState.instances.length = 0;
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

  const advance = (milliseconds = 50): void => {
    now += milliseconds;
    const callback = nextFrame;
    if (!callback)
      throw new Error("Runtime did not request an animation frame");
    callback(now);
  };

  const warmRuntime = (): void => {
    advance();
    advance();
  };

  it("rebuilds when only the authoritative route identity changes", () => {
    const initial = makeAuthoredSave({
      routeId: "garden-playground-v1",
      levelId: "same-level",
    });
    const next = makeAuthoredSave({
      routeId: "besties-playground-v1",
      levelId: "same-level",
      revision: 1,
    });
    const game = createGame({
      container: document.createElement("div"),
      save: initial,
      onAction: async () => next,
      onRefresh: async () => initial,
    });
    warmRuntime();
    game.setInput("moveX", 1);
    advance();
    game.setInput("moveX", 0);
    expect(game.inspect().status.position.x).not.toBe(0);

    game.updateSave(next);

    expect(game.inspect()).toMatchObject({
      status: { position: { x: 0, y: 0, z: 1 } },
      level: { id: "same-level", authored: { id: "besties-playground-v1" } },
      obby: {
        routeId: "besties-playground-v1",
        timeSeconds: 0,
        checkpointId: null,
        supportId: null,
      },
    });
    expect(runtimeState.instances[0]?.rebuilds).toEqual([
      { id: "same-level", routeId: "besties-playground-v1" },
    ]);
    game.dispose();
  });

  it("keeps the visited checkpoint through same-level fallen and retry saves", () => {
    const initial = makeAuthoredSave();
    const progressed = makeAuthoredSave({
      revision: 1,
      defeatedOrdinaryCount: 4,
    });
    const fallen = makeAuthoredSave({
      revision: 2,
      phase: "fallen",
      defeatedOrdinaryCount: 4,
    });
    const retried = makeAuthoredSave({
      revision: 3,
      defeatedOrdinaryCount: 4,
    });
    const inferredFromDefeats = checkpointForSave(
      progressed,
      createLevelLayout(progressed),
    );
    const visited = authoredRoute(
      "garden-playground-v1",
    )!.course.checkpoints.find(
      (checkpoint) => checkpoint.id === "garden-start",
    )!;
    expect(inferredFromDefeats).not.toEqual(visited.position);

    const game = createGame({
      container: document.createElement("div"),
      save: initial,
      onAction: async () => retried,
      onRefresh: async () => initial,
    });
    warmRuntime();
    expect(game.inspect().obby?.checkpointId).toBe("garden-start");

    game.updateSave(progressed);
    game.updateSave(fallen);
    game.updateSave(retried);

    expect(game.inspect()).toMatchObject({
      status: { position: visited.position, phase: "exploring" },
      checkpoint: visited.position,
      obby: {
        routeId: "garden-playground-v1",
        checkpointId: null,
        recoveries: 0,
      },
    });
    expect(game.inspect().status.position).not.toEqual(inferredFromDefeats);
    warmRuntime();
    expect(game.inspect().obby?.checkpointId).toBe("garden-start");
    expect(runtimeState.instances[0]?.rebuilds).toEqual([
      {
        id: "level-authored-fixture",
        routeId: "garden-playground-v1",
      },
    ]);
    game.dispose();
  });

  it("activates relocated Besties only near the authored boss arena", () => {
    const save = makeAuthoredSave({
      routeId: "besties-playground-v1",
      defeatedOrdinaryCount: 4,
    });
    const boss = authoredRoute("besties-playground-v1")!.anchors.encounters
      .boss;
    const onAction = vi.fn(async () => save);

    runtimeState.spawnOverrides.push({ x: 0, y: 0, z: -22 });
    const archivedLocation = createGame({
      container: document.createElement("div"),
      save,
      onAction,
      onRefresh: async () => save,
    });
    warmRuntime();
    expect(archivedLocation.inspect()).toMatchObject({
      status: { position: { z: -22 }, bestiesPhase: "inactive" },
      obby: { supportId: "party-picnic" },
      enemies: expect.arrayContaining([
        expect.objectContaining({
          id: "level-authored-fixture-boss",
          position: boss.position,
        }),
      ]),
    });
    expect(runtimeState.instances[0]?.frames.at(-1)?.besties?.phase).toBe(
      "inactive",
    );
    archivedLocation.dispose();

    runtimeState.spawnOverrides.push({ ...boss.position });
    const authoredLocation = createGame({
      container: document.createElement("div"),
      save,
      onAction,
      onRefresh: async () => save,
    });
    warmRuntime();
    expect(authoredLocation.inspect()).toMatchObject({
      status: {
        position: boss.position,
        bestiesPhase: "pink-warning",
      },
      obby: { supportId: boss.platformId },
    });
    expect(runtimeState.instances[1]?.frames.at(-1)?.besties).toMatchObject({
      arenaOrigin: boss.position,
      phase: "pink-warning",
      hazards: [{ center: { z: boss.position.z }, damaging: false }],
    });
    expect(onAction).not.toHaveBeenCalled();
    authoredLocation.dispose();
  });
});
