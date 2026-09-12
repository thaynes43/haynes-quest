// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  GameplayActionRequest,
  SaveView,
} from "../../src/shared/contracts";
import type {
  SceneFrame,
  SceneVisualInspection,
} from "../../src/game/types";
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

    inspectVisuals(): SceneVisualInspection {
      return { memories: [{ id: "rendered-memory", visible: false }] };
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

  afterEach(() => vi.unstubAllGlobals());

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
    expect(game.inspect().visuals).toEqual({
      memories: [{ id: "rendered-memory", visible: false }],
    });
    game.retryMedia();
    expect(sceneState.instances[0]?.retries).toBe(1);
    game.dispose();
    game.retryMedia();
    expect(sceneState.instances[0]?.retries).toBe(1);
  });

  it("surfaces unavailable action ids without stopping the frame loop", () => {
    vi.stubGlobal("crypto", undefined);
    const game = createGame({
      container: document.createElement("div"),
      save: makeEraSave({ collectedKinds: ["guard-tool"] }),
      onAction: async () => makeEraSave({ revision: 1 }),
      onRefresh: async () => makeEraSave(),
    });

    expect(game.performAction({ type: "guard", levelId: "level-1-2020" })).toBe(
      false,
    );
    expect(game.inspect().status).toMatchObject({
      requestState: "error",
      requestError: "guard",
      requestErrorCode: "SECURE_RANDOM_UNAVAILABLE",
    });
    const initialZ = game.inspect().status.position.z;
    game.setInput("moveY", 1);
    let now = performance.now();
    now += 16;
    nextFrame?.(now);
    now += 16;
    nextFrame?.(now);
    expect(game.inspect().status.position.z).toBeLessThan(initialZ);
    game.dispose();
  });

  it("keeps the final era and victory checkpoint after completion", async () => {
    const defeatedIds = [
      "level-2-2024-ordinary-a",
      "level-2-2024-ordinary-b",
      "level-2-2024-boss",
    ];
    const released = makeEraSave({
      levelIndex: 1,
      phase: "memory-released",
      revealedCount: 1,
      defeatedIds,
      collectedKinds: ["attack-tool", "guard-tool"],
      revision: 5,
    });
    const completed = {
      ...makeEraSave({
        levelIndex: 1,
        phase: "complete",
        completed: true,
        defeatedIds,
        collectedKinds: ["attack-tool", "guard-tool"],
        revision: 6,
      }),
      ageYears: 7,
    };
    const game = createGame({
      container: document.createElement("div"),
      save: released,
      onAction: async () => completed,
      onRefresh: async () => released,
    });

    expect(
      game.performAction({
        type: "consume-memory-bundle",
        levelId: "level-2-2024",
      }),
    ).toBe(true);
    await vi.waitFor(() =>
      expect(game.inspect().status.phase).toBe("complete"),
    );
    expect(game.inspect()).toMatchObject({
      status: {
        activeLevelId: null,
        ageYears: 7,
        phase: "complete",
        position: { x: 0, y: 0, z: -23.5 },
      },
      checkpoint: { x: 0, y: 0, z: -23.5 },
      level: { id: "level-2-2024" },
      enemies: [
        { phase: "defeated" },
        { phase: "defeated" },
        { phase: "defeated" },
      ],
    });
    game.updateSave({ ...completed, revision: 7 });
    expect(game.inspect().level.id).toBe("level-2-2024");
    expect(sceneState.instances[0]?.rebuilds).toEqual([]);
    game.dispose();
  });

  it("revives a defeated enemy after a stale action refresh", async () => {
    const defeated = makeEraSave({
      revision: 2,
      defeatedIds: ["level-1-2020-ordinary-a"],
      collectedKinds: ["guard-tool"],
    });
    const refreshed = makeEraSave({
      revision: 3,
      collectedKinds: ["guard-tool"],
    });
    const game = createGame({
      container: document.createElement("div"),
      save: defeated,
      onAction: async () => {
        throw new Error("SAVE_REVISION_STALE");
      },
      onRefresh: async () => refreshed,
    });

    expect(game.performAction({ type: "guard", levelId: "level-1-2020" })).toBe(
      true,
    );
    await vi.waitFor(() =>
      expect(game.inspect().status.requestErrorCode).toBe(
        "SAVE_REVISION_STALE",
      ),
    );
    expect(
      game.inspect().enemies.find((enemy) => enemy.id.endsWith("ordinary-a")),
    ).toMatchObject({
      position: { x: -2, y: 0, z: -8 },
      facing: 0,
      phase: "idle",
      windupProgress: 0,
      hp: 4,
    });
    game.dispose();
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

  it("dispatches one contact after an in-flight guard request settles", async () => {
    let resolveGuard!: (save: SaveView) => void;
    const guardResponse = new Promise<SaveView>((resolve) => {
      resolveGuard = resolve;
    });
    const guarded = makeEraSave({
      revision: 1,
      collectedKinds: ["guard-tool"],
      guardActiveRemainingMs: 800,
    });
    const damaged = makeEraSave({
      revision: 2,
      collectedKinds: ["guard-tool"],
      playerHp: 9,
    });
    const onAction = vi.fn((request: GameplayActionRequest) =>
      request.action.type === "guard"
        ? guardResponse
        : Promise.resolve(damaged),
    );
    const game = createGame({
      container: document.createElement("div"),
      save: makeEraSave({ collectedKinds: ["guard-tool"] }),
      onAction,
      onRefresh: async () => makeEraSave(),
    });
    expect(game.performAction({ type: "guard", levelId: "level-1-2020" })).toBe(
      true,
    );

    let now = performance.now();
    game.setInput("moveX", -0.22);
    game.setInput("moveY", 1);
    for (let index = 0; index < 100; index += 1) {
      now += 16;
      nextFrame?.(now);
    }
    game.setInput("moveX", 0);
    game.setInput("moveY", 0);
    for (let index = 0; index < 360; index += 1) {
      now += 16;
      nextFrame?.(now);
      if (game.inspect().enemies.some((enemy) => enemy.phase === "cooldown")) {
        break;
      }
    }
    expect(onAction.mock.calls.map(([request]) => request.action.type)).toEqual(
      ["guard"],
    );

    resolveGuard(guarded);
    await vi.waitFor(() =>
      expect(game.inspect().status.requestBusy).toBe(false),
    );
    now += 16;
    nextFrame?.(now);
    await vi.waitFor(() => expect(onAction).toHaveBeenCalledTimes(2));
    expect(onAction.mock.calls.map(([request]) => request.action.type)).toEqual(
      ["guard", "take-hit"],
    );
    for (let index = 0; index < 20; index += 1) {
      now += 16;
      nextFrame?.(now);
    }
    expect(onAction).toHaveBeenCalledTimes(2);
    game.dispose();
  });

  it("clears a queued contact when a remote retry revives an enemy", async () => {
    let resolveGuard!: (save: SaveView) => void;
    const guardResponse = new Promise<SaveView>((resolve) => {
      resolveGuard = resolve;
    });
    const initial = makeEraSave({
      revision: 1,
      defeatedIds: ["level-1-2020-ordinary-b"],
      collectedKinds: ["guard-tool"],
    });
    const remotelyRetried = makeEraSave({
      revision: 2,
      collectedKinds: ["guard-tool"],
    });
    const onAction = vi.fn((_request: GameplayActionRequest) => guardResponse);
    const game = createGame({
      container: document.createElement("div"),
      save: initial,
      onAction,
      onRefresh: async () => initial,
    });
    expect(game.performAction({ type: "guard", levelId: "level-1-2020" })).toBe(
      true,
    );

    let now = performance.now();
    game.setInput("moveX", -0.22);
    game.setInput("moveY", 1);
    for (let index = 0; index < 100; index += 1) {
      now += 16;
      nextFrame?.(now);
    }
    game.setInput("moveX", 0);
    game.setInput("moveY", 0);
    for (let index = 0; index < 360; index += 1) {
      now += 16;
      nextFrame?.(now);
      if (game.inspect().enemies.some((enemy) => enemy.phase === "cooldown")) {
        break;
      }
    }
    expect(onAction).toHaveBeenCalledOnce();

    game.updateSave(remotelyRetried);
    expect(game.inspect()).toMatchObject({
      status: { position: { x: 0, y: 0, z: 1 } },
      enemies: [{ phase: "idle" }, { phase: "idle" }, { phase: "idle" }],
    });
    resolveGuard(makeEraSave({ revision: 3 }));
    await guardResponse;
    await Promise.resolve();
    now += 16;
    nextFrame?.(now);
    expect(onAction).toHaveBeenCalledOnce();
    game.dispose();
  });

  it("restarts a strike telegraph after a paused modal closes", () => {
    const onAction = vi.fn(async (_request: GameplayActionRequest) =>
      makeEraSave({ revision: 1, playerHp: 9 }),
    );
    const game = createGame({
      container: document.createElement("div"),
      save: makeEraSave(),
      onAction,
      onRefresh: async () => makeEraSave(),
    });
    let now = performance.now();
    game.setInput("moveX", -0.22);
    game.setInput("moveY", 1);
    for (let index = 0; index < 100; index += 1) {
      now += 16;
      nextFrame?.(now);
    }
    game.setInput("moveX", 0);
    game.setInput("moveY", 0);
    for (let index = 0; index < 360; index += 1) {
      now += 16;
      nextFrame?.(now);
      if (game.inspect().enemies.some((enemy) => enemy.phase === "strike")) {
        break;
      }
    }
    expect(
      game.inspect().enemies.some((enemy) => enemy.phase === "strike"),
    ).toBe(true);

    game.setPaused(true);
    now += 10_000;
    nextFrame?.(now);
    game.setPaused(false);
    expect(
      game.inspect().enemies.find((enemy) => enemy.phase === "windup"),
    ).toMatchObject({ windupProgress: 0 });
    now += 10_000;
    nextFrame?.(now);
    expect(onAction).not.toHaveBeenCalled();
    for (let index = 0; index < 14; index += 1) {
      now += 50;
      nextFrame?.(now);
    }
    expect(onAction).not.toHaveBeenCalled();
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

  it("advances a bounded 200 ms budget through slow visible frames", () => {
    const onAction = vi.fn(async (_request: GameplayActionRequest) =>
      makeEraSave({ revision: 1 }),
    );
    const game = createGame({
      container: document.createElement("div"),
      save: makeEraSave(),
      onAction,
      onRefresh: async () => makeEraSave(),
    });
    let now = performance.now();
    game.setInput("moveY", 1);
    now += 300;
    nextFrame?.(now);
    const beforeSlowStep = game.inspect().status.position.z;
    now += 300;
    nextFrame?.(now);
    const afterSlowStep = game.inspect().status.position.z;
    expect(beforeSlowStep - afterSlowStep).toBeCloseTo(0.62, 3);
    game.dispose();
  });
});
