// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  GameplayActionRequest,
  SaveView,
} from "../../src/shared/contracts";
import type { SceneFrame } from "../../src/game/types";
import { makeEraSave } from "./fixtures";

const sceneState = vi.hoisted(() => ({
  instances: [] as Array<{
    rebuilds: string[];
    updates: number[];
    frames: SceneFrame[];
    retries: number;
  }>,
}));

vi.mock("../../src/game/scene", () => ({
  GardenScene: class {
    readonly canvas = document.createElement("canvas");
    cameraYaw = 0;
    private readonly state = {
      rebuilds: [] as string[],
      updates: [] as number[],
      frames: [] as SceneFrame[],
      retries: 0,
    };

    constructor(container: HTMLElement) {
      container.append(this.canvas);
      sceneState.instances.push(this.state);
    }

    adjustCamera(): void {}

    rebuildRoute(level: { id: string | null }, _save: SaveView): void {
      this.state.rebuilds.push(level.id ?? "complete");
    }

    updateProgress(save: SaveView): void {
      this.state.updates.push(save.revision);
    }

    render(
      _position: unknown,
      _facing: number,
      _elapsed: number,
      frame?: SceneFrame,
    ): void {
      if (frame) this.state.frames.push(frame);
    }

    getMediaState(): { loading: number; failed: number } {
      return { loading: 1, failed: 2 };
    }

    retryMedia(): void {
      this.state.retries += 1;
    }

    dispose(): void {
      this.canvas.remove();
    }
  },
}));

import { createGame } from "../../src/game/createGame";

describe("era game runtime", () => {
  let nextFrame: FrameRequestCallback | undefined;

  beforeEach(() => {
    sceneState.instances.length = 0;
    nextFrame = undefined;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      nextFrame = callback;
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  it("allows paused victory-card actions and resets on the authoritative next level", async () => {
    const released = makeEraSave({
      revision: 1,
      phase: "memory-released",
      defeatedIds: [
        "level-1-2020-ordinary-a",
        "level-1-2020-ordinary-b",
        "level-1-2020-boss",
      ],
    });
    const oneRevealed = makeEraSave({
      revision: 2,
      phase: "memory-released",
      revealedCount: 1,
      defeatedIds: [
        "level-1-2020-ordinary-a",
        "level-1-2020-ordinary-b",
        "level-1-2020-boss",
      ],
    });
    const allRevealed = makeEraSave({
      revision: 3,
      phase: "memory-released",
      revealedCount: 2,
      defeatedIds: [
        "level-1-2020-ordinary-a",
        "level-1-2020-ordinary-b",
        "level-1-2020-boss",
      ],
    });
    const nextLevel = makeEraSave({ levelIndex: 1, revision: 4 });
    const responses = [oneRevealed, allRevealed, nextLevel];
    const onAction = vi.fn(async (_request: GameplayActionRequest) =>
      responses.shift()!,
    );
    const game = createGame({
      container: document.createElement("div"),
      save: released,
      onAction,
      onRefresh: async () => released,
    });

    game.setPaused(true);
    expect(
      game.performAction({
        type: "recover-memory",
        levelId: "level-1-2020",
        memoryId: "memory-1",
      }),
    ).toBe(true);
    await vi.waitFor(() =>
      expect(game.inspect().status.requestBusy).toBe(false),
    );
    expect(game.inspect().status.ageYears).toBe(0);
    expect(
      game.performAction({
        type: "recover-memory",
        levelId: "level-1-2020",
        memoryId: "memory-2",
      }),
    ).toBe(true);
    await vi.waitFor(() => expect(game.inspect().status.canConsume).toBe(true));
    expect(game.inspect().status.ageYears).toBe(0);

    expect(
      game.performAction({
        type: "consume-memory-bundle",
        levelId: "level-1-2020",
      }),
    ).toBe(true);
    await vi.waitFor(() =>
      expect(game.inspect().status.activeLevelId).toBe("level-2-2024"),
    );
    expect(game.inspect()).toMatchObject({
      status: {
        ageYears: 4,
        eraYear: 2024,
        phase: "exploring",
        position: { x: 0, y: 0, z: 1 },
      },
      checkpoint: { x: 0, y: 0, z: 1 },
      level: { id: "level-2-2024" },
    });
    expect(game.inspect().enemies.map((enemy) => enemy.position.z)).toEqual([
      -8, -13, -21,
    ]);
    expect(onAction.mock.calls.map(([request]) => request.action.type)).toEqual(
      ["recover-memory", "recover-memory", "consume-memory-bundle"],
    );
    expect(sceneState.instances[0]?.rebuilds).toEqual(["level-2-2024"]);
    game.dispose();
  });

  it("forwards media state and retry, then ignores both after disposal", () => {
    const game = createGame({
      container: document.createElement("div"),
      save: makeEraSave(),
      onAction: async () => makeEraSave({ revision: 1 }),
      onRefresh: async () => makeEraSave(),
    });
    expect(game.inspect().status).toMatchObject({
      mediaLoading: 1,
      mediaFailed: 2,
    });
    game.retryMedia();
    expect(sceneState.instances[0]?.retries).toBe(1);
    game.dispose();
    game.retryMedia();
    expect(sceneState.instances[0]?.retries).toBe(1);
  });

  it("restores the player checkpoint and enemy spawns after an authoritative retry", async () => {
    const initial = makeEraSave();
    const fallen = makeEraSave({ phase: "fallen", playerHp: 0, revision: 1 });
    const retried = makeEraSave({ phase: "exploring", revision: 2 });
    const onAction = vi.fn(async (_request: GameplayActionRequest) => retried);
    const game = createGame({
      container: document.createElement("div"),
      save: initial,
      onAction,
      onRefresh: async () => fallen,
    });
    let now = performance.now();
    game.setInput("moveY", 1);
    for (let index = 0; index < 75; index += 1) {
      now += 16;
      nextFrame?.(now);
    }
    game.setInput("moveY", 0);
    const moved = game.inspect();
    expect(moved.status.position.z).toBeLessThan(-2);
    expect(
      moved.enemies.find((enemy) => enemy.id.endsWith("ordinary-a"))?.phase,
    ).not.toBe("idle");

    game.updateSave(fallen);
    game.setPaused(true);
    expect(
      game.performAction({ type: "retry-level", levelId: "level-1-2020" }),
    ).toBe(true);
    await vi.waitFor(() =>
      expect(game.inspect().status.phase).toBe("exploring"),
    );
    expect(game.inspect().status.position).toEqual({ x: 0, y: 0, z: 1 });
    expect(game.inspect().enemies).toMatchObject([
      { position: { x: -2, y: 0, z: -8 }, phase: "idle" },
      { position: { x: 2, y: 0, z: -13 }, phase: "idle" },
      { position: { x: 0, y: 0, z: -21 }, phase: "idle" },
    ]);
    expect(onAction.mock.calls[0]?.[0].action.type).toBe("retry-level");
    game.dispose();
  });

  it("does not advance enemy AI while paused or hidden", () => {
    const game = createGame({
      container: document.createElement("div"),
      save: makeEraSave(),
      onAction: async () => makeEraSave({ revision: 1 }),
      onRefresh: async () => makeEraSave(),
    });
    let now = performance.now();
    game.setInput("moveY", 1);
    for (let index = 0; index < 75; index += 1) {
      now += 16;
      nextFrame?.(now);
    }
    game.setInput("moveY", 0);
    const before = game.inspect().enemies;
    expect(
      before.find((enemy) => enemy.id.endsWith("ordinary-a"))?.phase,
    ).not.toBe("idle");
    game.setPaused(true);
    now += 10_000;
    nextFrame?.(now);
    expect(game.inspect().enemies).toEqual(before);
    game.setPaused(false);
    now += 10_000;
    nextFrame?.(now);
    expect(game.inspect().enemies).toEqual(before);
    now += 16;
    nextFrame?.(now);
    const afterResume = game.inspect().enemies;
    expect(afterResume).not.toEqual(before);

    now += 5_000;
    nextFrame?.(now);
    expect(game.inspect().enemies).toEqual(afterResume);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    now += 5_000;
    nextFrame?.(now);
    expect(game.inspect().enemies).toEqual(afterResume);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    game.dispose();
  });
});
