// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authoredRoute } from "../../src/game/authored-layout";
import { checkpointForSave, createLevelLayout } from "../../src/game/level";
import type { SceneFrame } from "../../src/game/types";
import type { SaveView } from "../../src/shared/contracts";
import { makeAuthoredSave } from "./authored-fixtures";

const runtimeState = vi.hoisted(() => ({
  spawnOverrides: [] as Array<{ x: number; y: number; z: number }>,
  fixedPlayerY: null as number | null,
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
    stepObby(...args: Parameters<typeof actual.stepObby>) {
      const result = actual.stepObby(...args);
      if (runtimeState.fixedPlayerY !== null) {
        const state = args[0];
        state.position.y = runtimeState.fixedPlayerY;
        state.velocityY = 0;
        state.grounded = true;
      }
      return result;
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
    runtimeState.fixedPlayerY = null;
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

  const equippedBestiesSave = (
    options: Parameters<typeof makeAuthoredSave>[0] = {},
  ): SaveView => {
    const save = makeAuthoredSave({
      routeId: "besties-playground-v1",
      defeatedOrdinaryCount: 4,
      ...options,
    });
    const adventure = save.adventure!;
    const collected = adventure.activeLevel!.pickups.map((pickup) => ({
      ...pickup,
      collected: true,
    }));
    adventure.activeLevel!.pickups = collected;
    adventure.inventory = collected;
    adventure.equippedId = collected.find(
      (pickup) => pickup.kind === "attack-tool",
    )!.id;
    return save;
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
    archivedLocation.setInput("attack", true);
    archivedLocation.setInput("attack", false);
    advance();
    expect(onAction).not.toHaveBeenCalled();
    expect(archivedLocation.inspect().status.attackFeedback).toMatchObject({
      outcome: "no-target",
    });
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

  it("keeps Besties inactive until every ordinary encounter is defeated", () => {
    const save = equippedBestiesSave({ defeatedOrdinaryCount: 3 });
    const boss = authoredRoute("besties-playground-v1")!.anchors.encounters
      .boss;
    const onAction = vi.fn(async () => save);
    runtimeState.spawnOverrides.push({ ...boss.position });
    const game = createGame({
      container: document.createElement("div"),
      save,
      onAction,
      onRefresh: async () => save,
    });
    warmRuntime();

    expect(game.inspect().status).toMatchObject({
      bestiesPhase: "inactive",
      nearEncounterId: null,
      attackReady: false,
      guardReady: false,
    });
    game.setInput("attack", true);
    game.setInput("attack", false);
    advance();
    expect(onAction).not.toHaveBeenCalled();
    expect(game.inspect().status.attackFeedback).toMatchObject({
      outcome: "no-target",
    });
    game.dispose();
  });

  it("retains independent primary and Secondary cooldowns during the Besties routine", () => {
    const save = equippedBestiesSave();
    save.adventure!.attackCooldownRemainingMs = 400;
    save.adventure!.secondaryCooldownRemainingMs = 1_000;
    const boss = authoredRoute("besties-playground-v1")!.anchors.encounters
      .boss;
    const onAction = vi.fn(async () => save);
    runtimeState.spawnOverrides.push({ ...boss.position });
    const game = createGame({
      container: document.createElement("div"),
      save,
      onAction,
      onRefresh: async () => save,
    });
    warmRuntime();

    expect(game.inspect().status).toMatchObject({
      bestiesPhase: "pink-warning",
      attackReady: false,
      guardReady: false,
    });
    game.setInput("attack", true);
    game.setInput("attack", false);
    advance();
    expect(game.inspect().status.attackFeedback).toMatchObject({
      outcome: "cooldown",
    });
    game.setInput("guard", true);
    game.setInput("guard", false);
    advance();
    expect(game.inspect().status.attackFeedback).toMatchObject({
      outcome: "cooldown",
      kind: "secondary",
    });
    expect(onAction).not.toHaveBeenCalled();
    game.dispose();
  });

  it("starts the Besties routine when the wand can target an actor at the court entrance", () => {
    const save = makeAuthoredSave({
      routeId: "besties-playground-v1",
      defeatedOrdinaryCount: 4,
    });
    const adventure = save.adventure!;
    const wand = {
      ...adventure.activeLevel!.pickups.find(
        (item) => item.kind === "attack-tool",
      )!,
      collected: true,
    };
    adventure.inventory = [wand];
    adventure.equippedId = wand.id;
    const boss = authoredRoute("besties-playground-v1")!.anchors.encounters
      .boss;
    runtimeState.spawnOverrides.push({
      x: boss.position.x + 1.25,
      y: 0,
      z: boss.position.z + 4.1,
    });
    const game = createGame({
      container: document.createElement("div"),
      save,
      onAction: async () => save,
      onRefresh: async () => save,
    });
    warmRuntime();
    expect(game.inspect().status.nearEncounterId).toBe(
      adventure.activeLevel!.bossId,
    );
    expect(game.inspect().status.bestiesPhase).toBe("pink-warning");
    game.dispose();
  });

  it("uses the same inclusive actor-relative height boundary for targeting and activation", () => {
    const save = equippedBestiesSave();
    const boss = authoredRoute("besties-playground-v1")!.anchors.encounters
      .boss;

    runtimeState.fixedPlayerY = boss.position.y + 1;
    runtimeState.spawnOverrides.push({
      x: boss.position.x + 1.25,
      y: runtimeState.fixedPlayerY,
      z: boss.position.z + 4.1,
    });
    const boundary = createGame({
      container: document.createElement("div"),
      save,
      onAction: async () => save,
      onRefresh: async () => save,
    });
    warmRuntime();
    expect(boundary.inspect().status).toMatchObject({
      nearEncounterId: save.adventure!.activeLevel!.bossId,
      bestiesPhase: "pink-warning",
      attackReady: true,
    });
    boundary.dispose();

    runtimeState.fixedPlayerY = boss.position.y + 1.001;
    runtimeState.spawnOverrides.push({
      x: boss.position.x + 1.25,
      y: runtimeState.fixedPlayerY,
      z: boss.position.z + 4.1,
    });
    const outside = createGame({
      container: document.createElement("div"),
      save,
      onAction: async () => save,
      onRefresh: async () => save,
    });
    warmRuntime();
    expect(outside.inspect().status).toMatchObject({
      nearEncounterId: null,
      bestiesPhase: "inactive",
      attackReady: false,
    });
    outside.dispose();
  });

  it("starts a second Besties runtime with fresh routine and encounter state", async () => {
    const boss = authoredRoute("besties-playground-v1")!.anchors.encounters
      .boss;
    const first = equippedBestiesSave({ saveId: "first-besties-run" });
    runtimeState.spawnOverrides.push({ ...boss.position });
    const firstGame = createGame({
      container: document.createElement("div"),
      save: first,
      onAction: async () => first,
      onRefresh: async () => first,
    });
    warmRuntime();
    for (let frame = 0; frame < 30; frame += 1) advance();
    expect(firstGame.inspect().status.bestiesPhase).toBe("pink-trick");
    firstGame.dispose();

    const second = equippedBestiesSave({ saveId: "second-besties-run" });
    const bossId = second.adventure!.activeLevel!.bossId;
    const damaged = structuredClone(second);
    damaged.revision = 1;
    damaged.adventure!.activeLevel!.encounters.find(
      (encounter) => encounter.id === bossId,
    )!.hp -= 3;
    const onAction = vi.fn(async () => damaged);
    runtimeState.spawnOverrides.push({ ...boss.position });
    const secondGame = createGame({
      container: document.createElement("div"),
      save: second,
      onAction,
      onRefresh: async () => second,
    });
    warmRuntime();

    expect(secondGame.inspect().status).toMatchObject({
      bestiesPhase: "pink-warning",
      nearEncounterId: bossId,
      attackReady: true,
    });
    expect(
      runtimeState.instances[1]!.frames.at(-1)!.besties?.phaseProgress,
    ).toBeLessThan(0.1);
    secondGame.setInput("attack", true);
    secondGame.setInput("attack", false);
    advance();
    await vi.waitFor(() =>
      expect(
        secondGame.inspect().enemies.find((enemy) => enemy.id === bossId)?.hp,
      ).toBe(5),
    );
    expect(onAction).toHaveBeenCalledOnce();
    secondGame.dispose();
  });

  it("restarts Besties after a death retry while preserving defeated ordinary encounters", async () => {
    const boss = authoredRoute("besties-playground-v1")!.anchors.encounters
      .boss;
    const initial = equippedBestiesSave();
    const bossId = initial.adventure!.activeLevel!.bossId;
    const fallen = equippedBestiesSave({ phase: "fallen", revision: 1 });
    fallen.adventure!.playerHp = 0;
    fallen.adventure!.activeLevel!.encounters.find(
      (encounter) => encounter.id === bossId,
    )!.hp = 5;
    const retried = equippedBestiesSave({ revision: 2 });
    const damaged = structuredClone(retried);
    damaged.revision = 3;
    damaged.adventure!.activeLevel!.encounters.find(
      (encounter) => encounter.id === bossId,
    )!.hp = 5;
    const onAction = vi.fn(async () => damaged);

    runtimeState.spawnOverrides.push({ ...boss.position });
    const game = createGame({
      container: document.createElement("div"),
      save: initial,
      onAction,
      onRefresh: async () => retried,
    });
    warmRuntime();
    for (let frame = 0; frame < 30; frame += 1) advance();
    expect(game.inspect().status.bestiesPhase).toBe("pink-trick");

    game.updateSave(fallen);
    runtimeState.spawnOverrides.push({ ...boss.position });
    game.updateSave(retried);
    warmRuntime();

    expect(game.inspect().status).toMatchObject({
      phase: "exploring",
      playerHp: 10,
      bestiesPhase: "pink-warning",
      nearEncounterId: bossId,
      attackReady: true,
    });
    expect(
      game.inspect().enemies.filter((enemy) => enemy.id !== bossId),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ phase: "defeated", hp: 0 }),
      ]),
    );
    expect(
      game.inspect().enemies.find((enemy) => enemy.id === bossId),
    ).toMatchObject({ hp: 8, phase: "idle" });

    game.setInput("attack", true);
    game.setInput("attack", false);
    advance();
    await vi.waitFor(() =>
      expect(
        game.inspect().enemies.find((enemy) => enemy.id === bossId)?.hp,
      ).toBe(5),
    );
    expect(onAction).toHaveBeenCalledOnce();
    game.dispose();
  });
});
