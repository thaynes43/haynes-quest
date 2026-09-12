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

function friendlyRoutedSave(options: EraSaveOptions = {}): SaveView {
  const save = routedSave(options);
  const activeLevel = save.adventure?.activeLevel;
  if (!save.adventure || !activeLevel)
    throw new Error("Friendly fixture requires an active era level");
  const assetIds =
    activeLevel.index === 0
      ? (["blockling", "signal-moth", "buffer-baron"] as const)
      : (["loop-dancer", "prism-mimic", "trendweaver"] as const);
  return {
    ...save,
    adventure: {
      ...save.adventure,
      activeLevel: {
        ...activeLevel,
        friendlies: assetIds.map((assetId) => ({
          id: `${activeLevel.id}-friendly-${assetId}`,
          assetId,
          assetVersion: "v001",
          maxHp: 4,
          hp: 4,
          defeated: false,
          boonClaimed: false,
          penaltyActive: false,
        })),
      },
    },
  };
}

function asRouteMemorySave(
  save: SaveView,
  revealedMinorCount = 0,
): SaveView {
  const adventure = save.adventure;
  const activeLevel = adventure?.activeLevel;
  if (!adventure || !activeLevel)
    throw new Error("Route-memory fixture requires an active era level");
  const levelIndex = activeLevel.index;
  const memoryAges = [0, 2, 4, 5, 6, 7];
  const activeMemoryIds =
    levelIndex === 0
      ? (["route-memory-1", "route-memory-2", "route-memory-3"] as const)
      : (["route-memory-4", "route-memory-5", "route-memory-6"] as const);
  const activeStart = levelIndex * 3;
  const memories = memoryAges.map((ageYears, index) => {
    const activeOffset = index - activeStart;
    const role = index % 3 === 2 ? ("major" as const) : ("minor" as const);
    const state =
      index < activeStart
        ? ("consumed" as const)
        : activeOffset < 0 || activeOffset > 2
          ? ("locked" as const)
          : activeOffset < revealedMinorCount
            ? ("revealed" as const)
            : role === "minor"
              ? ("released" as const)
              : adventure.phase === "memory-released"
                ? ("released" as const)
                : ("locked" as const);
    return {
      id: `route-memory-${index + 1}`,
      date: `${2020 + ageYears}-01-01`,
      ageYears,
      label: `Route memory ${index + 1}`,
      role,
      state,
      ...(state === "locked"
        ? {}
        : { mediaUrl: `/fixture/route-memory-${index + 1}.svg` }),
    };
  });
  return {
    ...save,
    memories,
    recoveredIds: memories
      .filter((memory) =>
        memory.state === "revealed" || memory.state === "consumed",
      )
      .map((memory) => memory.id),
    abilities: ["move", "interact", "jump"],
    adventure: {
      ...adventure,
      planVersion: "era-level-plan-v3",
      activeLevel: {
        ...activeLevel,
        routeId: "gentle-jump-v1",
        memoryIds: [...activeMemoryIds],
        minorMemoryIds: [activeMemoryIds[0], activeMemoryIds[1]],
        majorMemoryId: activeMemoryIds[2],
      },
      consumedMemoryIds: memories
        .filter((memory) => memory.state === "consumed")
        .map((memory) => memory.id),
      secondaryCooldownRemainingMs: 0,
    },
    versions: {
      ...save.versions,
      journey: "era-level-plan-v3",
      progression: "route-major-recovery-v3",
    },
  };
}

function routeMemoryRoutedSave(
  options: EraSaveOptions = {},
  revealedMinorCount = 0,
): SaveView {
  return asRouteMemorySave(routedSave(options), revealedMinorCount);
}

function friendlyRouteMemorySave(
  options: EraSaveOptions = {},
  revealedMinorCount = 0,
): SaveView {
  return asRouteMemorySave(friendlyRoutedSave(options), revealedMinorCount);
}

function bestiesRoutedSave(): SaveView {
  const levelId = "level-2-2024";
  const save = routedSave({
    levelIndex: 1,
    collectedKinds: ["attack-tool"],
    defeatedIds: [`${levelId}-ordinary-a`, `${levelId}-ordinary-b`],
  });
  const activeLevel = save.adventure?.activeLevel;
  if (!save.adventure || !activeLevel)
    throw new Error("Besties fixture requires an active era level");
  return {
    ...save,
    adventure: {
      ...save.adventure,
      catalogVersion: "parody-catalog-v3",
      activeLevel: {
        ...activeLevel,
        periodId: "besties-obby-v1",
        encounters: activeLevel.encounters.map((encounter) =>
          encounter.id === activeLevel.bossId
            ? {
                ...encounter,
                content: {
                  catalogEntryId: "bickering-besties",
                  catalogEntryVersion: "v001",
                  assetId: "bickering-besties",
                  assetVersion: "v001",
                },
              }
            : encounter,
        ),
      },
    },
    versions: { ...save.versions, catalog: "parody-catalog-v3" },
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

  it("keeps movement and actions available while reporting stale artwork", () => {
    sceneState.reloadRequired = true;
    const save = routedSave({ levelIndex: 1, collectedKinds: ["guard-tool"] });
    const onAction = vi.fn(async (_request: GameplayActionRequest) => save);
    const game = createGame({
      container: document.createElement("div"),
      save,
      onAction,
      onRefresh: async () => save,
    });
    game.setInput("moveY", 1);
    warmRuntime();
    expect(game.inspect().status.position.z).toBeCloseTo(0.845, 9);
    expect(game.inspect().status.mediaReloadRequired).toBe(true);
    expect(game.performAction({ type: "guard", levelId: "level-2-2024" })).toBe(
      true,
    );
    expect(onAction).toHaveBeenCalledOnce();
    expect(onAction.mock.calls[0]?.[0]).toMatchObject({
      action: { type: "guard", levelId: "level-2-2024" },
    });
    game.dispose();
  });

  it("keeps route movement faithful at 60 fps and 10 fps with v3-only speed tuning", () => {
    const travel = (save: SaveView, frameMs: number, frameCount: number): number => {
      nextFrame = undefined;
      now = 1_000;
      const game = createGame({
        container: document.createElement("div"),
        save,
        onAction: async () => save,
        onRefresh: async () => save,
      });
      const startZ = game.inspect().status.position.z;
      game.setInput("moveY", 1);
      advance(0);
      for (let frame = 0; frame < frameCount; frame += 1) advance(frameMs);
      const distance = startZ - game.inspect().status.position.z;
      game.dispose();
      return distance;
    };
    const legacy = routedSave({
      levelIndex: 1,
      collectedKinds: ["attack-tool", "guard-tool"],
    });
    const routeMemory = routeMemoryRoutedSave({
      levelIndex: 1,
      collectedKinds: ["attack-tool", "guard-tool"],
    });
    const sixtyFpsDistance = travel(routeMemory, 1_000 / 60, 24);
    const tenFpsDistance = travel(routeMemory, 100, 4);

    expect(sixtyFpsDistance).toBeCloseTo(1.6, 6);
    expect(tenFpsDistance).toBeCloseTo(sixtyFpsDistance, 6);
    expect(travel(legacy, 100, 4)).toBeCloseTo(1.24, 6);
  });

  it("lands the v3 route's second jump before the runway hazard at 4 m/s", () => {
    const initial = routeMemoryRoutedSave({
      collectedKinds: ["attack-tool", "guard-tool"],
    });
    const clearedFirstEncounter = routeMemoryRoutedSave({
      revision: 1,
      collectedKinds: ["attack-tool", "guard-tool"],
      defeatedIds: ["level-1-2020-ordinary-a"],
    });
    const game = createGame({
      container: document.createElement("div"),
      save: initial,
      onAction: async () => clearedFirstEncounter,
      onRefresh: async () => initial,
    });
    game.updateSave(clearedFirstEncounter);
    advance(0);
    game.setInput("moveY", 1);
    let firstJumped = false;
    let secondJumped = false;
    for (
      let frame = 0;
      frame < 120 && game.inspect().obby?.checkpointId !== "second-clearing";
      frame += 1
    ) {
      const status = game.inspect().status;
      if (!firstJumped && status.grounded && status.position.z <= -2.7) {
        game.setInput("jump", true);
        game.setInput("jump", false);
        firstJumped = true;
      } else if (
        firstJumped &&
        !secondJumped &&
        status.grounded &&
        status.position.z <= -8.7
      ) {
        game.setInput("jump", true);
        game.setInput("jump", false);
        secondJumped = true;
      }
      advance();
    }
    game.clearInput();

    expect({ firstJumped, secondJumped }).toEqual({
      firstJumped: true,
      secondJumped: true,
    });
    expect(game.inspect().obby).toMatchObject({
      checkpointId: "second-clearing",
      recoveries: 0,
    });
    expect(game.inspect().status.position.z).toBeGreaterThan(-13.3);
    game.dispose();
  });

  it("reports confirmed jumps once and keeps their sequence across route rebuilds", () => {
    const initial = routeMemoryRoutedSave({
      levelIndex: 1,
      collectedKinds: ["attack-tool", "guard-tool"],
    });
    const game = createGame({
      container: document.createElement("div"),
      save: initial,
      onAction: async () => initial,
      onRefresh: async () => initial,
    });
    advance(0);
    expect(game.inspect().status.jumpSequence).toBe(0);
    game.setInput("jump", true);
    game.setInput("jump", false);
    advance();
    expect(game.inspect().status.jumpSequence).toBe(1);
    advance();
    expect(game.inspect().status.jumpSequence).toBe(1);

    game.updateSave(routeMemoryRoutedSave({ revision: 1 }));
    advance(0);
    game.setInput("jump", true);
    game.setInput("jump", false);
    advance();
    expect(game.inspect().status.jumpSequence).toBe(2);
    game.dispose();
  });

  it("automatically collects a contacted v3 pickup and shows the interaction beat", () => {
    const initial = routeMemoryRoutedSave();
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
    game.setInput("moveY", 1);
    advance(0);
    advance();
    advance();

    expect(onAction).toHaveBeenCalledOnce();
    expect(onAction.mock.calls[0]?.[0]).toMatchObject({
      action: {
        type: "collect-equipment",
        levelId: "level-1-2020",
        pickupId: "level-1-2020-pickup-attack-tool",
      },
    });
    expect(game.inspect().status.interactionSequence).toBe(1);
    expect(sceneState.instances.at(-1)?.frames.at(-1)?.interacting).toBe(true);
    game.dispose();
  });

  it.each([
    {
      label: "minor during exploration",
      save: () =>
        routeMemoryRoutedSave({
          defeatedIds: ["level-1-2020-ordinary-a"],
          collectedKinds: ["attack-tool", "guard-tool"],
        }),
      memoryId: "route-memory-2",
    },
    {
      label: "major after the boss and both minors",
      save: () =>
        routeMemoryRoutedSave(
          {
            phase: "memory-released",
            defeatedIds: [
              "level-1-2020-ordinary-a",
              "level-1-2020-ordinary-b",
              "level-1-2020-boss",
            ],
            collectedKinds: ["attack-tool", "guard-tool"],
          },
          2,
        ),
      memoryId: "route-memory-3",
    },
  ])("automatically recovers a contacted $label", ({ save: makeSave, memoryId }) => {
    const initial = makeSave();
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
    game.setInput("moveY", 1);
    advance(0);
    advance();

    expect(onAction).toHaveBeenCalledOnce();
    expect(onAction.mock.calls[0]?.[0]).toMatchObject({
      action: { type: "recover-memory", memoryId },
    });
    expect(game.inspect().status.canConsume).toBe(false);
    game.dispose();
  });

  it("gives an accepted memory contact the frame without turning queued combat into feedback", async () => {
    const initial = routeMemoryRoutedSave(
      {
        defeatedIds: ["level-1-2020-ordinary-a"],
        collectedKinds: ["attack-tool", "guard-tool"],
      },
      1,
    );
    const recovered = routeMemoryRoutedSave(
      {
        revision: 1,
        defeatedIds: ["level-1-2020-ordinary-a"],
        collectedKinds: ["attack-tool", "guard-tool"],
      },
      2,
    );
    const onAction = vi.fn((request: GameplayActionRequest) =>
      request.action.type === "recover-memory"
        ? Promise.resolve(recovered)
        : new Promise<SaveView>(() => undefined),
    );
    const game = createGame({
      container: document.createElement("div"),
      save: initial,
      onAction,
      onRefresh: async () => initial,
    });
    game.setInput("moveY", 1);
    advance(0);
    game.setInput("attack", true);
    game.setInput("attack", false);
    game.setInput("guard", true);
    game.setInput("guard", false);

    advance();

    expect(onAction).toHaveBeenCalledOnce();
    expect(onAction.mock.calls[0]?.[0]).toMatchObject({
      action: { type: "recover-memory", memoryId: "route-memory-2" },
    });
    expect(game.inspect().status.attackFeedback).toBeNull();
    expect(sceneState.instances.at(-1)?.frames.at(-1)).toMatchObject({
      attacking: false,
      secondaryAttacking: false,
    });

    await vi.waitFor(() =>
      expect(game.inspect().status.requestBusy).toBe(false),
    );
    expect(game.inspect().status.nearMemoryId).toBeNull();

    game.setInput("moveX", 1);
    game.setInput("moveY", 1);
    for (let frame = 0; frame < 13; frame += 1) advance();
    game.clearInput();
    expect(game.inspect().status.nearEncounterId).toBe(
      "level-1-2020-ordinary-b",
    );

    game.setInput("attack", true);
    game.setInput("attack", false);
    advance();

    expect(game.inspect().status.attackFeedback).toEqual({
      sequence: 1,
      outcome: "accepted",
    });

    expect(onAction.mock.calls.map(([request]) => request.action.type)).toEqual([
      "recover-memory",
      "attack",
    ]);
    game.dispose();
  });

  it("keeps a memory collectible when its contacted recovery request fails", async () => {
    const initial = routeMemoryRoutedSave(
      {
        defeatedIds: ["level-1-2020-ordinary-a"],
        collectedKinds: ["attack-tool", "guard-tool"],
      },
      1,
    );
    const onAction = vi.fn(async () => {
      throw Object.assign(new Error("Action unavailable"), {
        code: "ACTION_NOT_AVAILABLE",
      });
    });
    const game = createGame({
      container: document.createElement("div"),
      save: initial,
      onAction,
      onRefresh: async () => initial,
    });
    game.setInput("moveY", 1);
    advance(0);
    game.setInput("attack", true);
    game.setInput("attack", false);

    advance();

    expect(onAction).toHaveBeenCalledOnce();
    expect(game.inspect().status.attackFeedback).toBeNull();
    await vi.waitFor(() =>
      expect(game.inspect().status.requestState).toBe("error"),
    );
    expect(
      game
        .inspect()
        .level.memoryPositions.find(
          (memory) => memory.id === "route-memory-2",
        ),
    ).toMatchObject({ state: "released" });
    expect(game.inspect().status.nearMemoryId).toBe("route-memory-2");

    game.setInput("attack", true);
    game.setInput("attack", false);
    advance();

    expect(onAction).toHaveBeenCalledOnce();
    expect(game.inspect().status.attackFeedback).toEqual({
      sequence: 1,
      outcome: "no-target",
    });
    game.dispose();
  });

  it("maps the v3 guard input to a close-range secondary attack", () => {
    const initial = routeMemoryRoutedSave(
      {
        levelIndex: 1,
        defeatedIds: ["level-2-2024-ordinary-a"],
        collectedKinds: ["attack-tool", "guard-tool"],
      },
      2,
    );
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
    advance(0);
    game.setInput("moveX", 1);
    game.setInput("moveY", 1);
    advance(200);
    advance(100);
    advance(200);
    game.setInput("moveX", 0);
    game.setInput("moveY", 0);
    expect(game.inspect().status.nearEncounterId).toBe(
      "level-2-2024-ordinary-b",
    );
    expect(game.inspect().status.guardReady).toBe(true);
    game.setInput("guard", true);
    game.setInput("guard", false);
    advance();

    expect(onAction).toHaveBeenCalledOnce();
    expect(onAction.mock.calls[0]?.[0]).toMatchObject({
      action: {
        type: "secondary-attack",
        levelId: "level-2-2024",
        encounterId: "level-2-2024-ordinary-b",
      },
    });
    expect(game.inspect().status.attackFeedback).toEqual({
      sequence: 1,
      outcome: "accepted",
      kind: "secondary",
    });
    expect(sceneState.instances.at(-1)?.frames.at(-1)).toMatchObject({
      secondaryAttacking: true,
      attackSequence: 1,
    });
    game.dispose();
  });

  it("waits for friendly re-entry before automatically amending a v3 attack", async () => {
    const initial = friendlyRouteMemorySave({
      collectedKinds: ["attack-tool", "guard-tool"],
      playerHp: 10,
    });
    const activeLevel = initial.adventure?.activeLevel;
    const friendlyId = activeLevel?.friendlies?.[0]?.id;
    if (!initial.adventure || !activeLevel || !friendlyId)
      throw new Error("Friendly route-memory fixture is incomplete");
    const penalized: SaveView = {
      ...initial,
      revision: 1,
      adventure: {
        ...initial.adventure,
        activeLevel: {
          ...activeLevel,
          friendlies: activeLevel.friendlies?.map((friendly) =>
            friendly.id === friendlyId
              ? { ...friendly, penaltyActive: true, hp: friendly.hp - 1 }
              : friendly,
          ),
        },
      },
    };
    const onAction = vi.fn((request: GameplayActionRequest) =>
      request.action.type === "attack-friendly"
        ? Promise.resolve(penalized)
        : new Promise<SaveView>(() => undefined),
    );
    const game = createGame({
      container: document.createElement("div"),
      save: initial,
      onAction,
      onRefresh: async () => initial,
    });
    advance(0);
    game.setInput("moveX", 1);
    for (
      let frame = 0;
      frame < 30 && game.inspect().status.nearFriendlyId !== friendlyId;
      frame += 1
    )
      advance();
    game.clearInput();
    expect(game.inspect().status.nearFriendlyId).toBe(friendlyId);
    expect(onAction).not.toHaveBeenCalled();

    expect(
      game.performAction({
        type: "attack-friendly",
        levelId: activeLevel.id,
        friendlyId,
      }),
    ).toBe(true);
    await vi.waitFor(() => expect(game.inspect().status.requestBusy).toBe(false));
    advance(0);
    advance();
    advance();
    expect(onAction.mock.calls.map(([request]) => request.action.type)).toEqual([
      "attack-friendly",
    ]);

    game.setInput("moveX", -1);
    for (
      let frame = 0;
      frame < 30 && game.inspect().status.nearFriendlyId === friendlyId;
      frame += 1
    )
      advance();
    expect(game.inspect().status.nearFriendlyId).toBeNull();
    game.setInput("moveX", 1);
    for (let frame = 0; frame < 30 && onAction.mock.calls.length < 2; frame += 1)
      advance();

    expect(onAction.mock.calls.map(([request]) => request.action.type)).toEqual([
      "attack-friendly",
      "interact-friendly",
    ]);
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
      game.setInput("moveY", 1);
      game.setInput("jump", true);
      game.setInput("jump", false);
      advance();
      if (cancellation === "pause") {
        game.setPaused(true);
        game.setPaused(false);
      } else if (cancellation === "clear") game.clearInput();
      else window.dispatchEvent(new Event(cancellation));
      expect(game.inspect().input.moveY).toBe(0);
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
      defeatedIds: ["level-2-2024-ordinary-a", "level-2-2024-ordinary-b"],
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

  it.each(["interact-friendly", "attack-friendly"] as const)(
    "requires friendly range but permits confirmed %s while a modal pauses play",
    (type) => {
      const initial = friendlyRoutedSave({
        playerHp: 8,
        collectedKinds: ["attack-tool"],
      });
      const levelId = initial.adventure!.currentLevelId!;
      const friendlyId = initial.adventure!.activeLevel!.friendlies![0]!.id;
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

      expect(game.inspect().status.nearFriendlyId).toBeNull();
      game.setPaused(true);
      expect(game.performAction({ type, levelId, friendlyId })).toBe(false);
      expect(onAction).not.toHaveBeenCalled();

      game.setPaused(false);
      game.setInput("moveX", 1);
      for (
        let frame = 0;
        frame < 40 && game.inspect().status.nearFriendlyId !== friendlyId;
        frame += 1
      )
        advance();
      game.clearInput();
      expect(game.inspect().status.nearFriendlyId).toBe(friendlyId);

      game.setPaused(true);
      expect(game.performAction({ type, levelId, friendlyId })).toBe(true);
      expect(onAction).toHaveBeenCalledOnce();
      expect(onAction.mock.calls[0]?.[0]).toMatchObject({
        action: { type, levelId, friendlyId },
      });
      game.dispose();
    },
  );

  it("keeps a nearby friendly outside ordinary attack targeting", () => {
    const initial = friendlyRoutedSave({
      collectedKinds: ["attack-tool"],
    });
    const friendlyId = initial.adventure!.activeLevel!.friendlies![0]!.id;
    const onAction = vi.fn(async () => initial);
    const game = createGame({
      container: document.createElement("div"),
      save: initial,
      onAction,
      onRefresh: async () => initial,
    });
    warmRuntime();
    game.setInput("moveX", 1);
    for (
      let frame = 0;
      frame < 40 && game.inspect().status.nearFriendlyId !== friendlyId;
      frame += 1
    )
      advance();
    game.clearInput();

    expect(game.inspect().status).toMatchObject({
      nearFriendlyId: friendlyId,
      nearEncounterId: null,
      attackReady: false,
    });
    game.setInput("attack", true);
    game.setInput("attack", false);
    advance();
    expect(onAction).not.toHaveBeenCalled();
    expect(game.inspect().status.attackFeedback).toEqual({
      sequence: 1,
      outcome: "no-target",
    });
    game.dispose();
  });

  it("blocks the Besties during their routine and accepts a hit while they are dizzy", () => {
    const initial = bestiesRoutedSave();
    const bossId = initial.adventure!.activeLevel!.bossId;
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
    game.setInput("moveY", -1);
    for (let frame = 0; frame < 3; frame += 1) advance();
    game.clearInput();

    expect(game.inspect().status).toMatchObject({
      bestiesPhase: "pink-warning",
      nearEncounterId: bossId,
      attackReady: false,
    });
    game.setInput("attack", true);
    game.setInput("attack", false);
    advance();
    expect(onAction).not.toHaveBeenCalled();
    expect(game.inspect().status.attackFeedback).toEqual({
      sequence: 1,
      outcome: "guarded",
    });

    for (
      let frame = 0;
      frame < 200 && game.inspect().status.bestiesPhase !== "dizzy";
      frame += 1
    )
      advance();
    expect(game.inspect().status).toMatchObject({
      bestiesPhase: "dizzy",
      nearEncounterId: bossId,
      attackReady: true,
    });

    game.setInput("attack", true);
    game.setInput("attack", false);
    advance();
    expect(onAction).toHaveBeenCalledOnce();
    expect(onAction.mock.calls[0]?.[0]).toMatchObject({
      action: {
        type: "attack",
        levelId: "level-2-2024",
        encounterId: bossId,
      },
    });
    expect(game.inspect().status.attackFeedback).toEqual({
      sequence: 2,
      outcome: "accepted",
    });
    game.dispose();
  });

  it("keeps the composite Besties boss out of generic collision and contact", () => {
    const initial = bestiesRoutedSave();
    const bossId = initial.adventure!.activeLevel!.bossId;
    const onAction = vi.fn(async () => initial);
    const game = createGame({
      container: document.createElement("div"),
      save: initial,
      onAction,
      onRefresh: async () => initial,
    });
    warmRuntime();
    game.setInput("moveY", 1);
    for (let frame = 0; frame < 19; frame += 1) advance();
    game.clearInput();

    expect(game.inspect().status).toMatchObject({
      position: { x: 0, y: 0 },
      bestiesPhase: "pink-warning",
    });
    expect(game.inspect().status.position.z).toBeCloseTo(-21.945, 9);
    expect(
      game.inspect().enemies.find((enemy) => enemy.id === bossId),
    ).toMatchObject({
      position: { x: 0, y: 0, z: -22 },
      phase: "idle",
    });
    expect(onAction).not.toHaveBeenCalled();
    game.dispose();
  });

  it("freezes the Besties routine while a modal pauses play", () => {
    const initial = bestiesRoutedSave();
    const game = createGame({
      container: document.createElement("div"),
      save: initial,
      onAction: async () => initial,
      onRefresh: async () => initial,
    });
    warmRuntime();
    for (let frame = 0; frame < 5; frame += 1) advance();
    const beforePause = sceneState.instances[0]?.frames.at(-1)?.besties;
    expect(beforePause).toMatchObject({
      phase: "pink-warning",
      vulnerable: false,
    });

    game.setPaused(true);
    advance(10_000);
    advance(10_000);
    expect(sceneState.instances[0]?.frames.at(-1)?.besties).toEqual(
      beforePause,
    );
    game.setPaused(false);
    advance(10_000);
    expect(sceneState.instances[0]?.frames.at(-1)?.besties).toEqual(
      beforePause,
    );
    advance();
    expect(
      sceneState.instances[0]?.frames.at(-1)?.besties?.phaseProgress,
    ).toBeGreaterThan(beforePause?.phaseProgress ?? Number.POSITIVE_INFINITY);
    game.dispose();
  });

  it("restarts a Besties trick with a full warning after an actual fall", () => {
    const initial = bestiesRoutedSave();
    const onAction = vi.fn(async () => initial);
    const game = createGame({
      container: document.createElement("div"),
      save: initial,
      onAction,
      onRefresh: async () => initial,
    });
    warmRuntime();
    game.setInput("moveX", 1);

    let sawPinkTrick = false;
    for (
      let frame = 0;
      frame < 100 && game.inspect().obby?.recoveries === 0;
      frame += 1
    ) {
      advance();
      sawPinkTrick ||= game.inspect().status.bestiesPhase === "pink-trick";
    }

    expect(sawPinkTrick).toBe(true);
    expect(game.inspect()).toMatchObject({
      status: {
        position: { x: 0, y: 0, z: -19 },
        bestiesPhase: "pink-warning",
      },
      obby: {
        checkpointId: "boss-landing",
        recoveryRemaining: 0.8,
        recoveries: 1,
      },
    });
    const restarted = sceneState.instances[0]?.frames.at(-1)?.besties;
    expect(restarted).toMatchObject({
      phase: "pink-warning",
      phaseProgress: 0,
      hazards: [{ damaging: false }],
    });
    expect(onAction).not.toHaveBeenCalled();

    while ((game.inspect().obby?.recoveryRemaining ?? 0) > 0) {
      expect(sceneState.instances[0]?.frames.at(-1)?.besties).toEqual(
        restarted,
      );
      advance();
    }
    expect(sceneState.instances[0]?.frames.at(-1)?.besties).toMatchObject({
      phase: "pink-warning",
      phaseProgress: 0.05 / 1.2,
    });
    expect(onAction).not.toHaveBeenCalled();

    for (let frame = 0; frame < 22; frame += 1) advance();
    expect(game.inspect().status.bestiesPhase).toBe("pink-warning");
    expect(onAction).not.toHaveBeenCalled();
    advance();
    expect(game.inspect().status.bestiesPhase).toBe("pink-trick");
    expect(onAction).not.toHaveBeenCalled();
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

  it("keeps a held v3 movement stick active after a local gap recovery", () => {
    const initial = routeMemoryRoutedSave({
      collectedKinds: ["attack-tool", "guard-tool"],
    });
    const onAction = vi.fn(async (_request: GameplayActionRequest) => initial);
    const game = createGame({
      container: document.createElement("div"),
      save: initial,
      onAction,
      onRefresh: async () => initial,
    });
    game.setInput("moveY", 1);
    warmRuntime();

    let leftWelcomeIsland = false;
    for (
      let frame = 0;
      frame < 100 && game.inspect().obby?.recoveries === 0;
      frame += 1
    ) {
      advance();
      leftWelcomeIsland ||= !game.inspect().status.grounded;
    }

    expect(leftWelcomeIsland).toBe(true);
    expect(game.inspect()).toMatchObject({
      status: { position: { x: 0, y: 0, z: 1 } },
      input: { moveY: 1 },
      obby: {
        checkpointId: "start",
        recoveryRemaining: 0.8,
        recoveries: 1,
      },
    });
    const respawnZ = game.inspect().status.position.z;
    advance();
    expect(game.inspect().obby?.recoveries).toBe(1);
    expect(game.inspect().input.moveY).toBe(1);
    expect(game.inspect().status.position.z).toBeLessThan(respawnZ);
    expect(onAction).not.toHaveBeenCalled();
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
