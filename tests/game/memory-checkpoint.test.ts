// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authoredRoute } from "../../src/game/authored-layout";
import {
  checkpointForSave,
  createLevelLayout,
  memoryCheckpointForSave,
} from "../../src/game/level";
import type { SceneFrame } from "../../src/game/types";
import type { SaveView } from "../../src/shared/contracts";
import { makeArchivedRoutedSave, makeAuthoredSave } from "./authored-fixtures";

const runtimeState = vi.hoisted(() => ({
  controllers: [] as Array<{
    position: { x: number; y: number; z: number };
    velocityY: number;
    grounded: boolean;
    supportId: string | null;
    supportAnchor: { x: number; y: number; z: number } | null;
    checkpointId: string | null;
    checkpoint: { x: number; y: number; z: number };
    settled: boolean;
  }>,
}));

vi.mock("../../src/game/obby", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/game/obby")>();
  return {
    ...actual,
    createObbyState(position: { x: number; y: number; z: number }) {
      const state = actual.createObbyState(position);
      runtimeState.controllers.push(state);
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
    render(
      _position: unknown,
      _facing: number,
      _elapsed: number,
      _frame?: SceneFrame,
    ): void {}
    getMediaState() {
      return { loading: 0, failed: 0, reloadRequired: false };
    }
    dispose(): void {
      this.canvas.remove();
    }
  },
}));

import { createGame } from "../../src/game/createGame";

function withRecoveredMinors(
  count: 0 | 1 | 2,
  options: Parameters<typeof makeAuthoredSave>[0] = {},
): SaveView {
  const save = structuredClone(makeAuthoredSave(options));
  const active = save.adventure?.activeLevel;
  if (!active?.minorMemoryIds)
    throw new Error("Authored checkpoint fixture needs route memories");
  const recoveredMinorIds = active.minorMemoryIds.slice(0, count);
  const consumedIds = save.memories
    .filter((memory) => memory.state === "consumed")
    .map((memory) => memory.id);
  save.recoveredIds = [...consumedIds, ...recoveredMinorIds];
  for (const memory of save.memories) {
    const minorIndex = active.minorMemoryIds.indexOf(memory.id);
    if (minorIndex >= 0) {
      memory.state = minorIndex < count ? "revealed" : "released";
    }
  }
  return save;
}

describe("authored memory checkpoints", () => {
  let nextFrame: FrameRequestCallback | undefined;
  let now: number;

  beforeEach(() => {
    runtimeState.controllers.length = 0;
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

  it.each([
    {
      routeId: "garden-playground-v1" as const,
      checkpointIds: ["picnic-safe", "grove-safe"],
    },
    {
      routeId: "besties-playground-v1" as const,
      checkpointIds: ["party-picnic-safe", "party-grove-safe"],
    },
  ])(
    "uses chapter start, then each safe $routeId memory checkpoint",
    ({ routeId, checkpointIds }) => {
      const empty = withRecoveredMinors(0, { routeId });
      const first = withRecoveredMinors(1, { routeId });
      const second = withRecoveredMinors(2, { routeId });
      const emptyLevel = createLevelLayout(empty);
      const firstLevel = createLevelLayout(first);
      const secondLevel = createLevelLayout(second);

      expect(memoryCheckpointForSave(empty, emptyLevel)).toBeNull();
      expect(checkpointForSave(empty, emptyLevel)).toEqual(
        emptyLevel.checkpoint,
      );
      expect(memoryCheckpointForSave(first, firstLevel)?.id).toBe(
        checkpointIds[0],
      );
      expect(memoryCheckpointForSave(second, secondLevel)?.id).toBe(
        checkpointIds[1],
      );
      expect(checkpointForSave(second, secondLevel)).toEqual(
        memoryCheckpointForSave(second, secondLevel)?.position,
      );
      expect(checkpointForSave(second, secondLevel)).not.toEqual(
        secondLevel.authored?.anchors.memories["minor-two"].position,
      );
    },
  );

  it("uses frozen minor order and ignores recovered memories from prior chapters", () => {
    const garden = withRecoveredMinors(2);
    const active = garden.adventure!.activeLevel!;
    garden.recoveredIds = [
      active.minorMemoryIds![1]!,
      active.minorMemoryIds![0]!,
    ];
    expect(memoryCheckpointForSave(garden, createLevelLayout(garden))?.id).toBe(
      "grove-safe",
    );

    const besties = withRecoveredMinors(0, {
      routeId: "besties-playground-v1",
    });
    expect(besties.recoveredIds).not.toHaveLength(0);
    expect(
      memoryCheckpointForSave(besties, createLevelLayout(besties)),
    ).toBeNull();
    expect(checkpointForSave(besties, createLevelLayout(besties))).toEqual(
      authoredRoute("besties-playground-v1")!.anchors.spawn.position,
    );
  });

  it("uses the reward safe point after the boss and preserves archived routes", () => {
    const released = withRecoveredMinors(2, {
      phase: "memory-released",
      defeatedOrdinaryCount: 4,
      bossDefeated: true,
    });
    expect(checkpointForSave(released, createLevelLayout(released))).toEqual(
      authoredRoute("garden-playground-v1")!.anchors.rewardRespawn.position,
    );

    const archived = makeArchivedRoutedSave();
    expect(
      memoryCheckpointForSave(archived, createLevelLayout(archived)),
    ).toBeNull();
    expect(checkpointForSave(archived, createLevelLayout(archived))).toEqual({
      x: 0,
      y: 0,
      z: 1,
    });
  });

  it("falls back to chapter start when a memory platform has no unique checkpoint", () => {
    const save = withRecoveredMinors(1);
    const level = createLevelLayout(save);
    const selected = memoryCheckpointForSave(save, level)!;
    const ambiguous = {
      ...level,
      course: {
        ...level.course!,
        checkpoints: [
          ...level.course!.checkpoints,
          {
            ...level.course!.checkpoints.find(
              (checkpoint) => checkpoint.id === selected.id,
            )!,
            id: "duplicate-memory-safe",
          },
        ],
      },
    };

    expect(memoryCheckpointForSave(save, ambiguous)).toBeNull();
    expect(checkpointForSave(save, ambiguous)).toEqual(level.checkpoint);
  });

  it("promotes an accepted minor without moving the player and keeps it for a local fall", () => {
    const initial = withRecoveredMinors(0);
    const progressed = withRecoveredMinors(1, { revision: 1 });
    const onAction = vi.fn(async () => progressed);
    const game = createGame({
      container: document.createElement("div"),
      save: initial,
      onAction,
      onRefresh: async () => initial,
    });
    advance();
    advance();

    const controller = runtimeState.controllers.at(-1)!;
    Object.assign(controller.position, { x: 1.25, y: 0.7, z: -10 });
    controller.velocityY = 2.25;
    game.updateSave(progressed);

    expect(controller.position).toEqual({ x: 1.25, y: 0.7, z: -10 });
    expect(controller.velocityY).toBe(2.25);
    expect(controller.checkpointId).toBe("picnic-safe");
    expect(controller.checkpoint).toEqual({ x: 0, y: 0, z: -16.8 });
    expect(game.inspect().checkpoint).toEqual(controller.checkpoint);

    Object.assign(controller.position, { x: 0, y: -3, z: -18 });
    controller.velocityY = -2;
    controller.grounded = false;
    controller.supportId = null;
    controller.supportAnchor = null;
    controller.settled = true;
    advance();
    advance();

    expect(game.inspect()).toMatchObject({
      status: { position: { x: 0, y: 0, z: -16.8 } },
      checkpoint: { x: 0, y: 0, z: -16.8 },
      obby: { checkpointId: "picnic-safe", recoveries: 1 },
    });
    expect(onAction).not.toHaveBeenCalled();
    game.dispose();
  });

  it("overrides an older visited checkpoint when HP retry rebuilds the level", () => {
    const initial = withRecoveredMinors(0);
    const progressed = withRecoveredMinors(1, {
      revision: 1,
      defeatedOrdinaryCount: 1,
    });
    const fallen = withRecoveredMinors(1, {
      revision: 2,
      phase: "fallen",
      defeatedOrdinaryCount: 1,
    });
    const retried = withRecoveredMinors(1, {
      revision: 3,
      defeatedOrdinaryCount: 1,
    });
    const game = createGame({
      container: document.createElement("div"),
      save: initial,
      onAction: async () => retried,
      onRefresh: async () => initial,
    });
    advance();
    advance();
    game.updateSave(progressed);

    const controller = runtimeState.controllers.at(-1)!;
    Object.assign(controller.position, { x: 0, y: 0, z: 1 });
    controller.velocityY = 0;
    controller.grounded = true;
    controller.supportId = "welcome";
    controller.supportAnchor = null;
    advance();
    advance();
    expect(game.inspect()).toMatchObject({
      checkpoint: { x: 0, y: 0, z: 1 },
      obby: { checkpointId: "garden-start" },
    });

    game.updateSave(fallen);
    game.updateSave(retried);

    expect(game.inspect()).toMatchObject({
      status: { position: { x: 0, y: 0, z: -16.8 }, phase: "exploring" },
      checkpoint: { x: 0, y: 0, z: -16.8 },
      obby: {
        checkpointId: "picnic-safe",
        recoveries: 0,
        timeSeconds: 0,
      },
      level: {
        encounterPositions: expect.arrayContaining([
          expect.objectContaining({
            id: "level-authored-fixture-encounter-1",
            hp: 0,
            localPhase: "defeated",
          }),
        ]),
      },
    });
    game.dispose();
  });
});
