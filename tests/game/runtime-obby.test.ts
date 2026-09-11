// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createObbyCourse } from "../../src/game/obby-layout";
import { sampleObby } from "../../src/game/obby";
import type {
  EncounterKind,
  GameplayActionRequest,
  SaveView,
} from "../../src/shared/contracts";
import type { SceneFrame } from "../../src/game/types";
import { makeEraSave, type EraSaveOptions } from "./fixtures";

const sceneState = vi.hoisted(() => ({
  reloadRequired: false,
  instances: [] as Array<{
    rebuilds: string[];
    updates: number[];
    frames: SceneFrame[];
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
    };

    constructor(container: HTMLElement) {
      container.append(this.canvas);
      sceneState.instances.push(this.state);
    }

    adjustCamera(): void {}

    rebuildRoute(level: { id: string | null }): void {
      this.state.rebuilds.push(level.id ?? "complete");
    }

    updateProgress(save: SaveView): void {
      this.state.updates.push(save.revision);
    }

    getMediaState() {
      return {
        loading: 0,
        failed: Number(sceneState.reloadRequired),
        reloadRequired: sceneState.reloadRequired,
      };
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

const parodyContent: Record<
  0 | 1,
  Record<EncounterKind, { entryId: string; assetId: string }>
> = {
  0: {
    "ordinary-a": { entryId: "mister-hiss", assetId: "mister-hiss" },
    "ordinary-b": { entryId: "peel-patrol", assetId: "peel-patrol" },
    boss: { entryId: "drama-dragon", assetId: "drama-dragon" },
  },
  1: {
    "ordinary-a": {
      entryId: "sir-flush-a-lot-encore",
      assetId: "sir-flush-a-lot",
    },
    "ordinary-b": {
      entryId: "peel-patrol-encore",
      assetId: "peel-patrol",
    },
    boss: {
      entryId: "drama-dragon-encore",
      assetId: "drama-dragon",
    },
  },
};

function routedSave(options: EraSaveOptions = {}): SaveView {
  const save = makeEraSave(options);
  const levelIndex = (options.levelIndex ?? 0) as 0 | 1;
  const activeLevel = save.adventure?.activeLevel;
  if (!save.adventure || !activeLevel)
    throw new Error("Routed fixture requires an active era level");
  const routeId = levelIndex === 0 ? "gentle-intro-v1" : "gentle-jump-v1";
  const periodId = levelIndex === 0 ? "block-party-v1" : "remix-runway-v2";
  return {
    ...save,
    adventure: {
      ...save.adventure,
      planVersion: "era-level-plan-v2",
      catalogVersion: "parody-catalog-v2",
      activeLevel: {
        ...activeLevel,
        routeId,
        periodId,
        encounters: activeLevel.encounters.map((encounter) => {
          const content = parodyContent[levelIndex][encounter.kind];
          return {
            ...encounter,
            content: {
              catalogEntryId: content.entryId,
              catalogEntryVersion: "v001",
              assetId: content.assetId,
              assetVersion: "v001",
            },
          };
        }),
      },
    },
    versions: { ...save.versions, catalog: "parody-catalog-v2" },
  };
}

describe("obby game runtime", () => {
  let nextFrame: FrameRequestCallback | undefined;
  let now: number;

  beforeEach(() => {
    sceneState.instances.length = 0;
    sceneState.reloadRequired = false;
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
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
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

  it("holds movement and actions when the scene needs newer frozen artwork", () => {
    sceneState.reloadRequired = true;
    const save = routedSave({ levelIndex: 1, collectedKinds: ["guard-tool"] });
    const onAction = vi.fn(async () => save);
    const game = createGame({
      container: document.createElement("div"),
      save,
      onAction,
      onRefresh: async () => save,
    });
    game.setInput("moveY", 1);
    warmRuntime();
    expect(game.inspect().status).toMatchObject({
      position: { x: 0, y: 0, z: 1 },
      mediaReloadRequired: true,
    });
    expect(game.performAction({ type: "guard", levelId: "level-2-2024" })).toBe(
      false,
    );
    expect(onAction).not.toHaveBeenCalled();
    game.dispose();
  });

  it("retains a quick jump tap across the zero-time frame after a save update", () => {
    const game = createGame({
      container: document.createElement("div"),
      save: routedSave({ levelIndex: 1 }),
      onAction: async () => routedSave({ levelIndex: 1, revision: 1 }),
      onRefresh: async () => routedSave({ levelIndex: 1 }),
    });
    warmRuntime();
    game.updateSave(routedSave({ levelIndex: 1, revision: 1 }));
    game.setInput("jump", true);
    game.setInput("jump", false);
    advance();
    expect(game.inspect().status.position.y).toBe(0);
    advance();
    expect(game.inspect().status.position.y).toBeGreaterThan(0.1);
    game.dispose();
  });

  it("keeps the safe reward checkpoint when walking back across a course marker after victory", () => {
    const reward = routedSave({
      levelIndex: 1,
      phase: "memory-released",
      defeatedIds: [
        "level-2-2024-ordinary-a",
        "level-2-2024-ordinary-b",
        "level-2-2024-boss",
      ],
    });
    const game = createGame({
      container: document.createElement("div"),
      save: reward,
      onAction: async () => reward,
      onRefresh: async () => reward,
    });
    warmRuntime();
    game.setInput("moveY", -1);
    for (let frame = 0; frame < 29; frame++) advance();
    game.clearInput();
    expect(game.inspect().status.position.z).toBeCloseTo(-19.005, 5);
    expect(game.inspect().checkpoint).toEqual({ x: 0, y: 0, z: -23.5 });
    game.dispose();
  });

  it.each(["pause", "blur", "clear"])(
    "discards a deferred jump on %s instead of jumping when play resumes",
    (cancellation) => {
      const game = createGame({
        container: document.createElement("div"),
        save: routedSave({ levelIndex: 1 }),
        onAction: async () => routedSave({ levelIndex: 1 }),
        onRefresh: async () => routedSave({ levelIndex: 1 }),
      });
      game.setInput("jump", true);
      game.setInput("jump", false);
      advance();
      if (cancellation === "pause") {
        game.setPaused(true);
        game.setPaused(false);
      } else if (cancellation === "clear") game.clearInput();
      else window.dispatchEvent(new Event(cancellation));
      advance();
      advance();
      expect(game.inspect().status.position.y).toBe(0);
      game.dispose();
    },
  );

  it("cancels a touch action without cancelling held movement", () => {
    const game = createGame({
      container: document.createElement("div"),
      save: routedSave({ levelIndex: 1 }),
      onAction: async () => routedSave({ levelIndex: 1, revision: 1 }),
      onRefresh: async () => routedSave({ levelIndex: 1 }),
    });
    game.setInput("moveY", 1);
    game.setInput("attack", true);
    game.cancelInput("attack");
    advance();
    advance();
    expect(game.inspect().status.position.z).toBeLessThan(1);
    expect(game.inspect().status.attackFeedback).toBeNull();
    game.dispose();
  });

  it("casts the Prism wand at the routed boss while the joystick stays held", () => {
    const initial = routedSave({
      levelIndex: 1,
      collectedKinds: ["attack-tool"],
      defeatedIds: [
        "level-2-2024-ordinary-a",
        "level-2-2024-ordinary-b",
      ],
    });
    const onAction = vi.fn(
      (_request: GameplayActionRequest) =>
        new Promise<SaveView>(() => undefined),
    );
    const game = createGame({
      container: document.createElement("div"),
      save: initial,
      onAction,
      onRefresh: async () => initial,
    });
    warmRuntime();
    game.setInput("moveX", 0.4);
    game.setInput("attack", true);
    game.setInput("attack", false);
    advance();

    expect(game.inspect().status.position.x).toBeGreaterThan(0);
    expect(onAction).toHaveBeenCalledOnce();
    expect(onAction.mock.calls[0]?.[0]).toMatchObject({
      action: {
        type: "attack",
        levelId: "level-2-2024",
        encounterId: "level-2-2024-boss",
      },
    });
    expect(game.inspect().status.attackFeedback).toEqual({
      sequence: 1,
      outcome: "accepted",
    });
    expect(sceneState.instances[0]?.frames.at(-1)).toMatchObject({
      attacking: true,
      attackTargetId: "level-2-2024-boss",
    });
    expect(game.inspect().input.moveX).toBe(0.4);
    game.dispose();
  });

  it("reports an empty attack tap without dispatching a command", () => {
    const initial = routedSave({
      levelIndex: 1,
      collectedKinds: ["attack-tool"],
    });
    const onAction = vi.fn(async () => initial);
    const game = createGame({
      container: document.createElement("div"),
      save: initial,
      onAction,
      onRefresh: async () => initial,
    });
    game.setInput("attack", true);
    game.setInput("attack", false);
    warmRuntime();

    expect(onAction).not.toHaveBeenCalled();
    expect(game.inspect().status.attackFeedback).toEqual({
      sequence: 1,
      outcome: "no-target",
    });
    game.dispose();
  });

  it("steps and renders the frozen v2 route from the genuine sampled course", () => {
    const game = createGame({
      container: document.createElement("div"),
      save: routedSave(),
      onAction: async () => routedSave({ revision: 1 }),
      onRefresh: async () => routedSave(),
    });

    expect(game.inspect().obby).toMatchObject({
      routeId: "gentle-intro-v1",
      platforms: [{ id: "intro-ground" }],
      hazards: [{ id: "first-soft-sweeper" }, { id: "second-soft-sweeper" }],
    });
    warmRuntime();
    game.setInput("moveY", 1);
    advance();
    game.setInput("moveY", 0);

    const inspection = game.inspect();
    expect(inspection.status.position.y).toBe(0);
    expect(inspection.status.position.z).toBeCloseTo(0.845, 9);
    expect(inspection.obby).toMatchObject({
      supportId: "intro-ground",
      recoveryRemaining: 0,
      recoveries: 0,
    });
    expect(inspection.obby).toMatchObject(
      sampleObby(createObbyCourse("gentle-intro-v1"), 0.1),
    );
    expect(sceneState.instances[0]?.frames.at(-1)?.obby).toEqual(
      sampleObby(createObbyCourse("gentle-intro-v1"), 0.1),
    );
    game.dispose();
  });

  it("recovers from a visible hazard locally and protects against enemy contact", () => {
    const initial = routedSave({
      revision: 7,
      playerHp: 6,
      collectedKinds: ["attack-tool", "guard-tool"],
      defeatedIds: ["level-1-2020-ordinary-b"],
    });
    const onAction = vi.fn(async (_request: GameplayActionRequest) => initial);
    const game = createGame({
      container: document.createElement("div"),
      save: initial,
      onAction,
      onRefresh: async () => initial,
    });
    warmRuntime();

    game.setInput("moveY", 1);
    for (
      let frame = 0;
      frame < 100 && game.inspect().obby?.recoveries === 0;
      frame += 1
    )
      advance();

    const recovered = game.inspect();
    const protectedEnemies = recovered.enemies;
    expect(recovered).toMatchObject({
      status: {
        position: { x: 0, y: 0, z: 1 },
        playerHp: 6,
        guardReady: true,
      },
      checkpoint: { x: 0, y: 0, z: 1 },
      obby: {
        checkpointId: "start",
        recoveryRemaining: 0.8,
        recoveries: 1,
      },
    });
    expect(
      recovered.enemies.find((enemy) => enemy.id.endsWith("ordinary-b")),
    ).toMatchObject({ hp: 0, phase: "defeated" });
    expect(recovered.level.pickupPositions).toHaveLength(2);
    expect(
      recovered.level.pickupPositions.every((pickup) => pickup.collected),
    ).toBe(true);
    expect(
      recovered.enemies.find((enemy) => enemy.id.endsWith("ordinary-a"))?.phase,
    ).toBe("idle");
    expect(onAction).not.toHaveBeenCalled();

    for (let frame = 0; frame < 15; frame += 1) advance();
    expect(game.inspect().obby?.recoveryRemaining).toBeCloseTo(0.05, 6);
    expect(game.inspect().enemies).toEqual(protectedEnemies);
    expect(onAction).not.toHaveBeenCalled();

    advance();
    expect(game.inspect().obby?.recoveryRemaining).toBeCloseTo(0, 9);
    expect(game.inspect().enemies).toEqual(protectedEnemies);
    expect(onAction).not.toHaveBeenCalled();
    advance();
    expect(game.inspect().obby?.recoveryRemaining).toBe(0);
    expect(
      game.inspect().enemies.find((enemy) => enemy.id.endsWith("ordinary-a"))
        ?.phase,
    ).toBe("idle");
    expect(game.performAction({ type: "guard", levelId: "level-1-2020" })).toBe(
      true,
    );
    expect(onAction.mock.calls[0]?.[0]).toMatchObject({
      expectedRevision: 7,
      action: { type: "guard" },
    });
    expect(onAction.mock.calls.map(([request]) => request.action.type)).toEqual(
      ["guard"],
    );
    game.dispose();
  });

  it("recovers a gap fall without changing authoritative progress", () => {
    const initial = routedSave({
      levelIndex: 1,
      revision: 12,
      playerHp: 5,
      collectedKinds: ["attack-tool", "guard-tool"],
      defeatedIds: ["level-2-2024-ordinary-a"],
    });
    const onAction = vi.fn(async (_request: GameplayActionRequest) => initial);
    const game = createGame({
      container: document.createElement("div"),
      save: initial,
      onAction,
      onRefresh: async () => initial,
    });
    warmRuntime();
    expect(game.inspect()).toMatchObject({
      status: { position: { x: 0, y: 0, z: -10.6 } },
      obby: {
        checkpointId: "second-clearing",
        supportId: "second-clearing-island",
      },
    });

    game.setInput("moveX", -1);
    for (
      let frame = 0;
      frame < 100 && game.inspect().obby?.recoveries === 0;
      frame += 1
    )
      advance();

    expect(game.inspect()).toMatchObject({
      status: {
        position: { x: 0, y: 0, z: -10.6 },
        playerHp: 5,
        guardReady: true,
      },
      checkpoint: { x: 0, y: 0, z: -10.6 },
      obby: {
        checkpointId: "second-clearing",
        recoveryRemaining: 0.8,
        recoveries: 1,
      },
    });
    expect(
      game.inspect().enemies.find((enemy) => enemy.id.endsWith("ordinary-a")),
    ).toMatchObject({ hp: 0, phase: "defeated" });
    expect(game.inspect().level.pickupPositions).toHaveLength(2);
    expect(
      game.inspect().level.pickupPositions.every((pickup) => pickup.collected),
    ).toBe(true);
    expect(onAction).not.toHaveBeenCalled();
    expect(game.performAction({ type: "guard", levelId: "level-2-2024" })).toBe(
      true,
    );
    expect(onAction.mock.calls[0]?.[0]).toMatchObject({
      expectedRevision: 12,
      action: { type: "guard" },
    });
    expect(onAction.mock.calls.map(([request]) => request.action.type)).toEqual(
      ["guard"],
    );
    game.dispose();
  });

  it("retains a later local checkpoint across a same-level inventory update", () => {
    const initial = routedSave({ levelIndex: 1, revision: 20 });
    const updated = routedSave({
      levelIndex: 1,
      revision: 21,
      collectedKinds: ["attack-tool", "guard-tool"],
    });
    const game = createGame({
      container: document.createElement("div"),
      save: initial,
      onAction: async () => updated,
      onRefresh: async () => initial,
    });
    warmRuntime();
    game.setInput("moveY", 1);

    let jumped = false;
    let releasedJump = false;
    for (
      let frame = 0;
      frame < 100 && game.inspect().obby?.checkpointId !== "first-clearing";
      frame += 1
    ) {
      if (!jumped && game.inspect().status.position.z <= -2.8) {
        game.setInput("jump", true);
        jumped = true;
      }
      advance();
      if (jumped && !releasedJump) {
        game.setInput("jump", false);
        releasedJump = true;
      }
    }
    game.setInput("moveY", 0);

    expect(game.inspect()).toMatchObject({
      checkpoint: { x: 0, y: 0, z: -4.8 },
      obby: { checkpointId: "first-clearing", recoveries: 0 },
    });
    const positionBeforeUpdate = game.inspect().status.position;
    game.updateSave(updated);
    expect(game.inspect()).toMatchObject({
      status: { position: positionBeforeUpdate, guardReady: true },
      checkpoint: { x: 0, y: 0, z: -4.8 },
      obby: { checkpointId: "first-clearing", recoveries: 0 },
    });
    expect(
      game.inspect().level.pickupPositions.every((pickup) => pickup.collected),
    ).toBe(true);
    expect(sceneState.instances[0]?.rebuilds).toEqual([]);
    expect(sceneState.instances[0]?.updates).toContain(21);
    game.dispose();
  });

  it("freezes sampled platforms and hazards through modal and visibility pauses", () => {
    const game = createGame({
      container: document.createElement("div"),
      save: routedSave({ levelIndex: 1 }),
      onAction: async () => routedSave({ levelIndex: 1, revision: 1 }),
      onRefresh: async () => routedSave({ levelIndex: 1 }),
    });
    warmRuntime();
    const beforeModal = game.inspect().obby;
    expect(beforeModal).toMatchObject(
      sampleObby(createObbyCourse("gentle-jump-v1"), 0.05),
    );

    game.setPaused(true);
    advance(10_000);
    expect(game.inspect().obby).toEqual(beforeModal);
    game.setPaused(false);
    advance(10_000);
    expect(game.inspect().obby).toEqual(beforeModal);
    advance();
    const afterModal = game.inspect().obby;
    expect(afterModal).toMatchObject(
      sampleObby(createObbyCourse("gentle-jump-v1"), 0.1),
    );

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    advance(10_000);
    expect(game.inspect().obby).toEqual(afterModal);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    advance(10_000);
    expect(game.inspect().obby).toEqual(afterModal);
    advance();
    const afterVisibility = game.inspect().obby;
    const expectedAfterVisibility = sampleObby(
      createObbyCourse("gentle-jump-v1"),
      0.15,
    );
    expect(afterVisibility?.timeSeconds).toBeCloseTo(0.15, 9);
    expect(
      afterVisibility?.platforms.find(
        (platform) => platform.id === "ferry-platform",
      )?.center.z,
    ).toBeCloseTo(
      expectedAfterVisibility.platforms.find(
        (platform) => platform.id === "ferry-platform",
      )?.center.z ?? Number.NaN,
      9,
    );
    expect(afterVisibility?.hazards[0]?.center.x).toBeCloseTo(
      expectedAfterVisibility.hazards[0]?.center.x ?? Number.NaN,
      9,
    );
    expect(sceneState.instances[0]?.frames.at(-1)?.obby).toEqual(
      afterVisibility && {
        timeSeconds: afterVisibility.timeSeconds,
        platforms: afterVisibility.platforms,
        hazards: afterVisibility.hazards,
      },
    );
    game.dispose();
  });

  it("resets support and the course clock when the authoritative level changes", () => {
    const later = routedSave({
      levelIndex: 1,
      revision: 30,
      defeatedIds: ["level-2-2024-ordinary-a"],
    });
    const earlier = routedSave({ revision: 31 });
    const game = createGame({
      container: document.createElement("div"),
      save: later,
      onAction: async () => earlier,
      onRefresh: async () => later,
    });
    warmRuntime();
    expect(game.inspect().obby).toMatchObject({
      routeId: "gentle-jump-v1",
      supportId: "second-clearing-island",
    });
    expect(game.inspect().obby).toMatchObject(
      sampleObby(createObbyCourse("gentle-jump-v1"), 0.05),
    );

    game.updateSave(earlier);
    expect(game.inspect()).toMatchObject({
      status: { position: { x: 0, y: 0, z: 1 } },
      checkpoint: { x: 0, y: 0, z: 1 },
      obby: {
        routeId: "gentle-intro-v1",
        checkpointId: null,
        supportId: null,
        recoveries: 0,
      },
    });
    expect(game.inspect().obby).toMatchObject(
      sampleObby(createObbyCourse("gentle-intro-v1"), 0),
    );
    expect(sceneState.instances[0]?.rebuilds).toEqual(["level-1-2020"]);

    advance();
    expect(game.inspect().obby?.supportId).toBeNull();
    advance();
    expect(game.inspect().obby).toMatchObject({
      supportId: "intro-ground",
      recoveryRemaining: 0,
    });
    expect(game.inspect().obby).toMatchObject(
      sampleObby(createObbyCourse("gentle-intro-v1"), 0.05),
    );
    game.dispose();
  });
});
