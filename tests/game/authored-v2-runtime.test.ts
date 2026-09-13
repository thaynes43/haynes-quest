// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authoredRoute } from "../../src/game/authored-layout";
import {
  createLevelLayout,
  memoryCheckpointForSave,
} from "../../src/game/level";
import type { ObbyState } from "../../src/game/obby";
import type { SceneFrame } from "../../src/game/types";
import type {
  GameplayActionRequest,
  SaveView,
} from "../../src/shared/contracts";
import { makeAuthoredSave, type AuthoredRouteId } from "./authored-fixtures";

const runtimeState = vi.hoisted(() => ({
  spawnOverrides: [] as Array<{ x: number; y: number; z: number }>,
  controllers: [] as ObbyState[],
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

const v2Routes = [
  "garden-playground-v2",
  "besties-playground-v2",
] as const satisfies readonly AuthoredRouteId[];

function withRecoveredMinors(
  count: 0 | 1 | 2,
  options: Parameters<typeof makeAuthoredSave>[0],
): SaveView {
  const save = structuredClone(makeAuthoredSave(options));
  const active = save.adventure?.activeLevel;
  if (!active?.minorMemoryIds)
    throw new Error("Authored v2 fixture needs route memories");
  const recoveredMinorIds = active.minorMemoryIds.slice(0, count);
  const priorChapterIds = save.memories
    .filter((memory) => memory.state === "consumed")
    .map((memory) => memory.id);
  save.recoveredIds = [...priorChapterIds, ...recoveredMinorIds];
  for (const memory of save.memories) {
    const index = active.minorMemoryIds.indexOf(memory.id);
    if (index >= 0) memory.state = index < count ? "revealed" : "released";
  }
  return save;
}

function equippedSave(
  routeId: (typeof v2Routes)[number],
  options: Parameters<typeof makeAuthoredSave>[0] = {},
): SaveView {
  const save = structuredClone(
    makeAuthoredSave({ routeId, defeatedOrdinaryCount: 3, ...options }),
  );
  const adventure = save.adventure!;
  const inventory = adventure.activeLevel!.pickups.map((pickup) => ({
    ...pickup,
    collected: true,
  }));
  adventure.activeLevel!.pickups = inventory;
  adventure.inventory = inventory;
  adventure.equippedId = inventory.find(
    (pickup) => pickup.kind === "attack-tool",
  )!.id;
  return save;
}

function bossSaveAfter(
  current: SaveView,
  request: GameplayActionRequest,
): SaveView {
  const next = structuredClone(current);
  next.revision += 1;
  const active = next.adventure!.activeLevel!;
  const boss = active.encounters.find(
    (encounter) => encounter.id === active.bossId,
  )!;
  const damage =
    request.action.type === "attack"
      ? active.pickups.find(
          (pickup) => pickup.id === next.adventure!.equippedId,
        )!.damage
      : active.pickups.find((pickup) => pickup.kind === "guard-tool")!.tier + 1;
  boss.hp = Math.max(0, boss.hp - damage);
  return next;
}

describe("registered authored v2 runtime", () => {
  let nextFrame: FrameRequestCallback | undefined;
  let now: number;

  beforeEach(() => {
    runtimeState.spawnOverrides.length = 0;
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

  const warmRuntime = (): void => {
    advance();
    advance();
  };

  it("keeps v1 fixture defaults while binding all four immutable routes to their catalog", () => {
    const defaultSave = makeAuthoredSave();
    expect(defaultSave.adventure).toMatchObject({
      catalogVersion: "parody-catalog-v4",
      activeLevel: { routeId: "garden-playground-v1" },
    });
    expect(defaultSave.versions.catalog).toBe("parody-catalog-v4");

    for (const routeId of [
      "garden-playground-v1",
      "besties-playground-v1",
      ...v2Routes,
    ] as const) {
      const save = makeAuthoredSave({ routeId, defeatedOrdinaryCount: 3 });
      const expectedCatalog = routeId.endsWith("-v2")
        ? "parody-catalog-v5"
        : "parody-catalog-v4";
      expect(authoredRoute(routeId)?.document.id).toBe(routeId);
      expect(createLevelLayout(save).authored?.id).toBe(routeId);
      expect(save.adventure).toMatchObject({
        catalogVersion: expectedCatalog,
        activeLevel: {
          routeId,
          encounters: expect.arrayContaining([
            expect.objectContaining({
              role: "boss",
              available: routeId.endsWith("-v2"),
            }),
          ]),
        },
      });
      expect(save.versions.catalog).toBe(expectedCatalog);
    }
  });

  it.each(v2Routes)(
    "selects both document-backed memory checkpoints and retries at the latest on %s",
    (routeId) => {
      const route = authoredRoute(routeId)!;
      for (const [count, slot] of [
        [1, "minor-one"],
        [2, "minor-two"],
      ] as const) {
        const save = withRecoveredMinors(count, { routeId });
        const level = createLevelLayout(save);
        const selected = memoryCheckpointForSave(save, level)!;
        const anchor = route.anchors.memories[slot];
        const matchingCheckpoints = route.course.checkpoints.filter(
          (checkpoint) => checkpoint.triggerPlatformId === anchor.platformId,
        );
        expect(matchingCheckpoints).toHaveLength(1);
        expect(selected).toEqual({
          id: matchingCheckpoints[0]!.id,
          position: matchingCheckpoints[0]!.position,
        });
        expect(selected.position.y).toBe(anchor.position.y);
      }

      const initial = withRecoveredMinors(2, { routeId });
      const fallen = withRecoveredMinors(2, {
        routeId,
        revision: 1,
        phase: "fallen",
      });
      fallen.adventure!.playerHp = 0;
      const retried = withRecoveredMinors(2, { routeId, revision: 2 });
      const expected = memoryCheckpointForSave(
        retried,
        createLevelLayout(retried),
      )!;
      const game = createGame({
        container: document.createElement("div"),
        save: initial,
        onAction: async () => retried,
        onRefresh: async () => retried,
      });
      warmRuntime();
      const controller = runtimeState.controllers.at(-1)!;
      Object.assign(controller.position, { x: 4, y: 1.2, z: -12 });

      game.updateSave(fallen);
      game.updateSave(retried);

      expect(game.inspect()).toMatchObject({
        status: { position: expected.position, phase: "exploring" },
        checkpoint: expected.position,
        level: { authored: { id: routeId } },
        obby: { routeId, checkpointId: expected.id },
      });
      game.dispose();
    },
  );

  it.each(v2Routes)(
    "engages and accepts both attacks against the %s boss with one ordinary left",
    async (routeId) => {
      let authoritative = equippedSave(routeId);
      const active = authoritative.adventure!.activeLevel!;
      const bossId = active.bossId;
      const bossAnchor = authoredRoute(routeId)!.anchors.encounters.boss;
      const onAction = vi.fn(async (request: GameplayActionRequest) => {
        authoritative = bossSaveAfter(authoritative, request);
        return authoritative;
      });
      const game = createGame({
        container: document.createElement("div"),
        save: authoritative,
        onAction,
        onRefresh: async () => authoritative,
      });
      warmRuntime();

      expect(game.inspect()).toMatchObject({
        status: { bossEngaged: false },
        level: { authored: { id: routeId } },
      });
      const controller = runtimeState.controllers.at(-1)!;
      Object.assign(controller.position, bossAnchor.position);
      Object.assign(controller.checkpoint, bossAnchor.position);
      controller.velocityY = 0;
      controller.grounded = true;
      controller.recoveryRemaining = 0;
      advance();

      expect(game.inspect().status).toMatchObject({
        bossEngaged: true,
        nearEncounterId: bossId,
        attackReady: true,
        guardReady: true,
      });
      expect(
        authoritative.adventure!.activeLevel!.encounters.filter(
          (encounter) => encounter.role === "ordinary" && !encounter.defeated,
        ),
      ).toHaveLength(1);

      game.setInput("attack", true);
      game.setInput("attack", false);
      advance();
      await vi.waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
      game.setInput("guard", true);
      game.setInput("guard", false);
      advance();
      await vi.waitFor(() => expect(onAction).toHaveBeenCalledTimes(2));
      expect(
        onAction.mock.calls.map(([request]) => request.action.type),
      ).toEqual(["attack", "secondary-attack"]);
      expect(
        onAction.mock.calls.map(([request]) =>
          "encounterId" in request.action
            ? request.action.encounterId
            : undefined,
        ),
      ).toEqual([bossId, bossId]);

      const defeated = structuredClone(authoritative);
      defeated.revision += 1;
      defeated.adventure!.phase = "memory-released";
      const boss = defeated.adventure!.activeLevel!.encounters.find(
        (encounter) => encounter.id === bossId,
      )!;
      boss.hp = 0;
      boss.defeated = true;
      boss.available = false;
      game.updateSave(defeated);
      warmRuntime();
      expect(game.inspect().status.bossEngaged).toBe(false);
      game.dispose();
    },
  );

  it("starts a second v2 Besties runtime fresh and attackable after death retry", async () => {
    const routeId = "besties-playground-v2" as const;
    const bossAnchor = authoredRoute(routeId)!.anchors.encounters.boss;
    const first = equippedSave(routeId, { saveId: "first-v2-besties" });
    runtimeState.spawnOverrides.push({ ...bossAnchor.position });
    const firstGame = createGame({
      container: document.createElement("div"),
      save: first,
      onAction: async () => first,
      onRefresh: async () => first,
    });
    warmRuntime();
    for (let frame = 0; frame < 30; frame += 1) advance();
    expect(firstGame.inspect().status).toMatchObject({
      bestiesPhase: "pink-trick",
      bossEngaged: true,
    });
    firstGame.dispose();

    const second = equippedSave(routeId, { saveId: "second-v2-besties" });
    const bossId = second.adventure!.activeLevel!.bossId;
    const damaged = equippedSave(routeId, {
      saveId: "second-v2-besties",
      revision: 3,
    });
    damaged.adventure!.activeLevel!.encounters.find(
      (encounter) => encounter.id === bossId,
    )!.hp = 5;
    const onAction = vi.fn(async (_request: GameplayActionRequest) => damaged);
    runtimeState.spawnOverrides.push({ ...bossAnchor.position });
    const secondGame = createGame({
      container: document.createElement("div"),
      save: second,
      onAction,
      onRefresh: async () => second,
    });
    warmRuntime();
    expect(secondGame.inspect().status).toMatchObject({
      bestiesPhase: "pink-warning",
      bossEngaged: true,
      nearEncounterId: bossId,
      attackReady: true,
    });
    expect(secondGame.inspect().level.authored?.id).toBe(routeId);

    const fallen = equippedSave(routeId, {
      saveId: "second-v2-besties",
      revision: 1,
      phase: "fallen",
    });
    fallen.adventure!.playerHp = 0;
    fallen.adventure!.activeLevel!.encounters.find(
      (encounter) => encounter.id === bossId,
    )!.hp = 5;
    const retried = equippedSave(routeId, {
      saveId: "second-v2-besties",
      revision: 2,
    });
    secondGame.updateSave(fallen);
    runtimeState.spawnOverrides.push({ ...bossAnchor.position });
    secondGame.updateSave(retried);
    warmRuntime();

    expect(secondGame.inspect().status).toMatchObject({
      phase: "exploring",
      playerHp: 10,
      bestiesPhase: "pink-warning",
      bossEngaged: true,
      nearEncounterId: bossId,
      attackReady: true,
    });
    const ordinaries = secondGame
      .inspect()
      .enemies.filter((enemy) => enemy.id !== bossId);
    expect(
      ordinaries.filter((enemy) => enemy.phase === "defeated"),
    ).toHaveLength(3);
    expect(ordinaries.filter((enemy) => enemy.phase === "idle")).toEqual([
      expect.objectContaining({ hp: 4 }),
    ]);
    expect(
      secondGame.inspect().enemies.find((enemy) => enemy.id === bossId),
    ).toMatchObject({ hp: 8, phase: "idle" });

    secondGame.setInput("attack", true);
    secondGame.setInput("attack", false);
    advance();
    await vi.waitFor(() =>
      expect(
        secondGame.inspect().enemies.find((enemy) => enemy.id === bossId)?.hp,
      ).toBe(5),
    );
    expect(onAction).toHaveBeenCalledOnce();
    expect(onAction.mock.calls[0]![0].action).toMatchObject({
      type: "attack",
      encounterId: bossId,
    });
    secondGame.dispose();
  });
});
