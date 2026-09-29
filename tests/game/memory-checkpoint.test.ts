// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authoredRoute } from "../../src/game/authored-layout";
import { resolveAuthoredLevelDocument } from "../../src/shared/authored-level";
import familyWorldAV5 from "../../src/shared/levels/family-world-a-v5.json";
import {
  checkpointForSave,
  createLevelLayout,
  memoryCheckpointForSave,
  missingMemoryCheckpointForSave,
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
import { bossIsActive } from "../../src/game/combat";

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

const familyA1 = resolveAuthoredLevelDocument(familyWorldAV5.chapters[0]!.level);
const familyA1Resolver = (routeId: string | undefined) =>
  routeId === familyA1.document.id ? familyA1 : null;

/** Exercise the shipped A1 geometry with an isolated, synthetic route save. */
function familyA1Save(
  count: 0 | 1 | 2,
  options: Parameters<typeof makeAuthoredSave>[0] = {},
): SaveView {
  const save = withRecoveredMinors(count, options);
  const active = save.adventure!.activeLevel!;
  const slots = familyA1.document.anchors.encounters;
  save.adventure!.activeLevel = {
    ...active,
    routeId: familyA1.document.id,
    encounters: active.encounters.map((encounter, index) => ({
      ...encounter,
      kind: encounter.role === "boss"
        ? slots.boss.kind
        : slots[`ordinary-${index + 1}` as keyof typeof slots]!.kind,
    })),
  };
  return save;
}

function gatedFamilyA1Save(ordinaryWins: number, revision = 0): SaveView {
  const save = familyA1Save(0, {
    defeatedOrdinaryCount: ordinaryWins,
    revision,
  });
  const adventure = save.adventure!;
  adventure.planVersion = "family-world-plan-v1";
  const active = adventure.activeLevel!;
  active.bossGate = "independent";
  active.bossPrerequisiteDefeats = 2;
  active.encounters.find((enemy) => enemy.id === active.bossId)!.available = ordinaryWins >= 2;
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

    const missing = withRecoveredMinors(1, {
      phase: "memory-released",
      defeatedOrdinaryCount: 4,
      bossDefeated: true,
    });
    expect(missingMemoryCheckpointForSave(missing, createLevelLayout(missing))?.id).toBe(
      "grove-safe",
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

  it("returns a post-boss family A1 reload to the missing balcony memory", () => {
    const released = familyA1Save(1, {
      phase: "memory-released",
      defeatedOrdinaryCount: 4,
      bossDefeated: true,
    });
    const level = createLevelLayout(released, familyA1Resolver);
    const safe = missingMemoryCheckpointForSave(released, level);
    expect(familyA1.document.mainPath.at(-1)).toBe("party-lawn");
    expect(familyA1.document.connections.some((edge) => edge.from === "party-lawn")).toBe(false);
    expect(safe).toEqual({
      id: "cp-balcony",
      position: { x: -31.2, y: 12.4, z: -141 },
    });
    expect(checkpointForSave(released, level)).toEqual(safe?.position);
    const reloaded = createGame({
      container: document.createElement("div"),
      save: released,
      authoredLevelResolver: familyA1Resolver,
      onAction: async () => released,
      onRefresh: async () => released,
    });
    expect(reloaded.inspect()).toMatchObject({
      status: { position: safe!.position, phase: "memory-released" },
      obby: { checkpointId: "cp-balcony" },
    });
    reloaded.dispose();

    const complete = familyA1Save(2, {
      phase: "memory-released",
      defeatedOrdinaryCount: 4,
      bossDefeated: true,
    });
    const completeLevel = createLevelLayout(complete, familyA1Resolver);
    expect(missingMemoryCheckpointForSave(complete, completeLevel)).toBeNull();
    expect(checkpointForSave(complete, completeLevel)).toEqual(
      familyA1.document.anchors.rewardRespawn.position,
    );

    const firstMissing = familyA1Save(2, {
      phase: "memory-released",
      defeatedOrdinaryCount: 4,
      bossDefeated: true,
    });
    const firstId = firstMissing.adventure!.activeLevel!.minorMemoryIds![0];
    firstMissing.recoveredIds = firstMissing.recoveredIds.filter((id) => id !== firstId);
    firstMissing.memories.find((memory) => memory.id === firstId)!.state = "released";
    expect(missingMemoryCheckpointForSave(
      firstMissing,
      createLevelLayout(firstMissing, familyA1Resolver),
    )?.id).toBe("cp-gear");
  });

  it("escapes A1's one-way party lawn when its new boss gate still needs two wins", () => {
    const save = gatedFamilyA1Save(0);
    const active = save.adventure!.activeLevel!;
    const firstMinorId = active.minorMemoryIds![0];
    save.adventure!.playerHp = Math.max(1, save.adventure!.maxPlayerHp - 2);
    save.adventure!.inventory = [{ ...active.pickups[1]!, collected: true }];
    active.pickups[1]!.collected = true;
    save.recoveredIds.push(firstMinorId);
    save.memories.find((memory) => memory.id === firstMinorId)!.state = "revealed";
    const progressBeforeReturn = structuredClone(save);
    const onAction = vi.fn(async () => save);
    const game = createGame({
      container: document.createElement("div"),
      save,
      authoredLevelResolver: familyA1Resolver,
      onAction,
      onRefresh: async () => save,
    });
    const controller = runtimeState.controllers.at(-1)!;
    const boss = familyA1.document.anchors.encounters.boss;
    const lawn = familyA1.document.anchors.memories.major.position;
    const spawn = familyA1.document.anchors.spawn.position;
    expect(familyA1.document.connections.some((edge) => edge.from === "party-lawn")).toBe(false);
    Object.assign(controller.position, boss.position);
    controller.grounded = true;
    expect(game.inspect().status.nearLockedBossId).toBe(save.adventure!.activeLevel!.bossId);
    controller.grounded = false;
    expect(game.inspect().status.nearLockedBossId).toBeNull();
    controller.grounded = true;
    controller.position.y += 1;
    expect(game.inspect().status.nearLockedBossId).toBeNull();
    Object.assign(controller.position, {
      x: boss.arena.minX,
      y: boss.position.y,
      z: boss.arena.minZ,
    });
    expect(game.inspect().status.nearLockedBossId).toBe(save.adventure!.activeLevel!.bossId);
    Object.assign(controller.position, lawn);
    expect(game.inspect().status.nearLockedBossId).toBeNull();

    game.setInput("moveY", 1);
    expect(game.returnToChapterStart()).toBe(true);
    expect(game.inspect()).toMatchObject({
      status: {
        position: spawn,
        nearLockedBossId: null,
        playerHp: progressBeforeReturn.adventure!.playerHp,
      },
      input: { moveY: 0 },
      checkpoint: spawn,
      obby: { checkpointId: null },
    });
    expect(save).toEqual(progressBeforeReturn);
    expect(onAction).not.toHaveBeenCalled();

    const oneWin = structuredClone(save);
    oneWin.revision = 1;
    const ordinary = oneWin.adventure!.activeLevel!.encounters.filter(
      (enemy) => enemy.role === "ordinary",
    );
    ordinary[0]!.hp = 0;
    ordinary[0]!.defeated = true;
    ordinary[0]!.available = false;
    game.updateSave(oneWin);
    expect(bossIsActive(oneWin)).toBe(false);
    expect(game.returnToChapterStart()).toBe(true);
    const twoWins = structuredClone(oneWin);
    twoWins.revision = 2;
    const nextOrdinary = twoWins.adventure!.activeLevel!.encounters.find(
      (enemy) => enemy.role === "ordinary" && !enemy.defeated,
    )!;
    nextOrdinary.hp = 0;
    nextOrdinary.defeated = true;
    nextOrdinary.available = false;
    twoWins.adventure!.activeLevel!.encounters.find(
      (enemy) => enemy.role === "boss",
    )!.available = true;
    game.updateSave(twoWins);
    expect(bossIsActive(twoWins)).toBe(true);
    expect(game.returnToChapterStart()).toBe(false);
    Object.assign(runtimeState.controllers.at(-1)!.position, boss.position);
    expect(game.inspect().status.nearLockedBossId).toBeNull();
    expect(onAction).not.toHaveBeenCalled();
    game.dispose();
  });

  it("limits the chapter-start escape to active new family gates", async () => {
    const save = gatedFamilyA1Save(0);
    let reply: ((next: SaveView) => void) | undefined;
    const game = createGame({
      container: document.createElement("div"),
      save,
      authoredLevelResolver: familyA1Resolver,
      onAction: () => new Promise<SaveView>((resolve) => { reply = resolve; }),
      onRefresh: async () => save,
    });
    game.setPaused(true);
    expect(game.returnToChapterStart()).toBe(false);
    game.setPaused(false);
    const active = save.adventure!.activeLevel!;
    Object.assign(runtimeState.controllers.at(-1)!.position,
      familyA1.document.anchors.memories["minor-one"].position);
    expect(game.performAction({
      type: "recover-memory", levelId: active.id, memoryId: active.minorMemoryIds![0],
    })).toBe(true);
    expect(game.returnToChapterStart()).toBe(false);
    reply!(gatedFamilyA1Save(1, 1));
    await vi.waitFor(() => expect(game.inspect().status.requestBusy).toBe(false));
    game.dispose();
    expect(game.returnToChapterStart()).toBe(false);

    for (const invalid of [
      familyA1Save(0),
      (() => { const old = gatedFamilyA1Save(0); delete old.adventure!.activeLevel!.bossPrerequisiteDefeats; return old; })(),
      (() => { const released = gatedFamilyA1Save(0); released.adventure!.phase = "memory-released"; return released; })(),
      (() => { const wrongLevel = gatedFamilyA1Save(0); wrongLevel.adventure!.currentLevelId = "another-level"; return wrongLevel; })(),
    ]) {
      const older = createGame({
        container: document.createElement("div"),
        save: invalid,
        authoredLevelResolver: familyA1Resolver,
        onAction: async () => invalid,
        onRefresh: async () => invalid,
      });
      expect(older.returnToChapterStart()).toBe(false);
      expect(older.inspect().status.nearLockedBossId).toBeNull();
      older.dispose();
    }
  });

  it("keeps the A1 boss victory in place but returns a fall or explicit action to the missing memory", () => {
    const exploring = familyA1Save(1);
    const released = familyA1Save(1, {
      revision: 1,
      phase: "memory-released",
      defeatedOrdinaryCount: 4,
      bossDefeated: true,
    });
    const onAction = vi.fn(async () => released);
    const game = createGame({
      container: document.createElement("div"),
      save: exploring,
      authoredLevelResolver: familyA1Resolver,
      onAction,
      onRefresh: async () => exploring,
    });
    const controller = runtimeState.controllers.at(-1)!;
    const major = familyA1.document.anchors.memories.major.position;
    Object.assign(controller.position, major);
    controller.grounded = true;
    game.updateSave(released);
    game.setPaused(true);
    expect(game.returnToMissingMemory()).toBe(false);
    game.setPaused(false);
    expect(game.returnToMajorMemory()).toBe(false);
    expect(game.inspect()).toMatchObject({
      status: {
        position: major,
        nearLockedMajorMemoryId: released.adventure!.activeLevel!.majorMemoryId,
      },
      checkpoint: { x: -31.2, y: 12.4, z: -141 },
    });
    expect(game.inspect().obby?.checkpointId).toBe("cp-balcony");

    game.setInput("moveY", 1);
    expect(game.returnToMissingMemory()).toBe(true);
    expect(game.inspect()).toMatchObject({
      status: { position: { x: -31.2, y: 12.4, z: -141 } },
      input: { moveY: 0 },
      obby: { checkpointId: "cp-balcony" },
    });
    expect(onAction).not.toHaveBeenCalled();

    const returned = runtimeState.controllers.at(-1)!;
    Object.assign(returned.position, { x: -31.2, y: -3, z: -141 });
    returned.velocityY = -2;
    returned.grounded = false;
    returned.supportId = null;
    returned.supportAnchor = null;
    advance();
    advance();
    expect(game.inspect()).toMatchObject({
      status: { position: { x: -31.2, y: 12.4, z: -141 } },
      obby: { checkpointId: "cp-balcony", recoveries: 1 },
    });
    game.dispose();
  });

  it("switches the post-boss checkpoint back to the reward after the missing minor is recovered", () => {
    const released = familyA1Save(1, {
      phase: "memory-released",
      defeatedOrdinaryCount: 4,
      bossDefeated: true,
    });
    const recovered = familyA1Save(2, {
      revision: 1,
      phase: "memory-released",
      defeatedOrdinaryCount: 4,
      bossDefeated: true,
    });
    const game = createGame({
      container: document.createElement("div"),
      save: released,
      authoredLevelResolver: familyA1Resolver,
      onAction: async () => recovered,
      onRefresh: async () => released,
    });
    game.updateSave(recovered);
    expect(game.inspect().checkpoint).toEqual(
      familyA1.document.anchors.rewardRespawn.position,
    );
    expect(game.inspect().obby?.checkpointId).toBeNull();
    expect(game.returnToMissingMemory()).toBe(false);
    game.setInput("moveX", 1);
    expect(game.returnToMajorMemory()).toBe(true);
    expect(game.inspect()).toMatchObject({
      status: { position: familyA1.document.anchors.rewardRespawn.position },
      input: { moveX: 0 },
      checkpoint: familyA1.document.anchors.rewardRespawn.position,
    });
    game.dispose();
  });

  it("accepts the missing A1 photo by contact and refuses a return while its save is pending", async () => {
    const released = familyA1Save(1, {
      phase: "memory-released",
      defeatedOrdinaryCount: 4,
      bossDefeated: true,
    });
    const recovered = familyA1Save(2, {
      revision: 1,
      phase: "memory-released",
      defeatedOrdinaryCount: 4,
      bossDefeated: true,
    });
    let reply: ((save: SaveView) => void) | undefined;
    const onAction = vi.fn(() => new Promise<SaveView>((resolve) => {
      reply = resolve;
    }));
    const game = createGame({
      container: document.createElement("div"),
      save: released,
      authoredLevelResolver: familyA1Resolver,
      onAction,
      onRefresh: async () => released,
    });
    const controller = runtimeState.controllers.at(-1)!;
    Object.assign(controller.position, familyA1.document.anchors.memories["minor-two"].position);
    controller.grounded = true;
    const minorId = released.adventure!.activeLevel!.minorMemoryIds![1];
    expect(game.performAction({
      type: "recover-memory",
      levelId: released.adventure!.currentLevelId!,
      memoryId: minorId,
    })).toBe(true);
    expect(onAction).toHaveBeenCalledOnce();
    expect(game.returnToMissingMemory()).toBe(false);
    expect(game.returnToMajorMemory()).toBe(false);
    reply!(recovered);
    await vi.waitFor(() => expect(game.inspect().status.requestBusy).toBe(false));
    expect(game.inspect().checkpoint).toEqual(
      familyA1.document.anchors.rewardRespawn.position,
    );
    expect(game.returnToMajorMemory()).toBe(true);
    expect(onAction).toHaveBeenCalledOnce();
    game.dispose();
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
