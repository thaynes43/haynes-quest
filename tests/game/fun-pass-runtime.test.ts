// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authoredRoute,
  type AuthoredLevelResolver,
} from "../../src/game/authored-layout";
import {
  planCasinoCollectibles,
  type CollectiblePlacement,
  type CollectiblePlan,
} from "../../src/game/casino-tokens";
import type {
  GameFeedbackEvent,
  PositionSnapshot,
  SceneFrame,
} from "../../src/game/types";
import type {
  GameplayActionRequest,
  SaveView,
} from "../../src/shared/contracts";
import { PRIMARY_COMBO_WINDOW_MS } from "../../src/shared/adventure";
import { makeAuthoredSave } from "./authored-fixtures";

const runtimeState = vi.hoisted(() => ({
  spawnOverrides: [] as Array<{ x: number; y: number; z: number }>,
  instances: [] as Array<{
    frames: SceneFrame[];
    collectibles: Array<{ plan: CollectiblePlan | null; collected: string[] }>;
    collectedItems: string[];
    expected: string[];
    anticipated: Array<{ id: string; at: PositionSnapshot }>;
    celebrated: Array<{ id: string; boss: boolean }>;
    comboFinishes: string[];
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
      frames: [] as SceneFrame[],
      collectibles: [] as Array<{
        plan: CollectiblePlan | null;
        collected: string[];
      }>,
      collectedItems: [] as string[],
      expected: [] as string[],
      anticipated: [] as Array<{ id: string; at: PositionSnapshot }>,
      celebrated: [] as Array<{ id: string; boss: boolean }>,
      comboFinishes: [] as string[],
    };
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
    setCollectibles(
      plan: CollectiblePlan | null,
      collected = new Set<string>(),
    ): void {
      this.state.collectibles.push({ plan, collected: [...collected] });
    }
    collectItem(item: CollectiblePlacement): void {
      this.state.collectedItems.push(item.id);
    }
    expectHit(id: string): void {
      this.state.expected.push(id);
    }
    anticipateHit(id: string, at: PositionSnapshot): void {
      this.state.anticipated.push({ id, at });
    }
    celebrate(id: string, boss: boolean): void {
      this.state.celebrated.push({ id, boss });
    }
    finishCombo(id: string): void {
      this.state.comboFinishes.push(id);
    }
    render(_p: unknown, _f: number, _e: number, frame?: SceneFrame): void {
      if (frame) this.state.frames.push(frame);
    }
    dispose(): void {
      this.canvas.remove();
    }
  },
}));

import { createGame } from "../../src/game/createGame";

const ROUTE = "garden-playground-v2";
const garden = authoredRoute(ROUTE)!;
/** The same geometry dressed as a casino, so collectibles are planned for it. */
const casinoRoute = {
  ...garden,
  document: { ...garden.document, theme: "casino" as const },
};
const casinoResolver: AuthoredLevelResolver = (routeId) =>
  routeId === ROUTE ? casinoRoute : authoredRoute(routeId);
const casinoPlan = planCasinoCollectibles({
  authored: casinoRoute.document,
  course: casinoRoute.course,
})!;

function equippedSave(cooldownMs = 0): SaveView {
  const save = makeAuthoredSave({ routeId: ROUTE });
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
  adventure.attackCooldownRemainingMs = cooldownMs;
  return save;
}

describe("fun pass runtime", () => {
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
    Reflect.deleteProperty(window, "matchMedia");
  });

  const advance = (milliseconds = 50): void => {
    now += milliseconds;
    const callback = nextFrame;
    if (!callback)
      throw new Error("Runtime did not request an animation frame");
    callback(now);
  };
  const scene = () => runtimeState.instances.at(-1)!;
  const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };

  /** Starts an equipped game beside the first ordinary enemy. */
  function besideFirstEnemy(options: {
    cooldownMs?: number;
    comboStep?: 1 | 2 | 3;
    onAction: (request: GameplayActionRequest) => Promise<SaveView>;
    feedback: GameFeedbackEvent[];
  }) {
    const save = equippedSave(options.cooldownMs);
    if (options.comboStep) {
      save.adventure!.attackComboStep = options.comboStep;
      save.adventure!.attackComboRemainingMs = PRIMARY_COMBO_WINDOW_MS;
    }
    const anchor = garden.anchors.encounters["ordinary-1"].position;
    runtimeState.spawnOverrides.push({
      x: anchor.x,
      y: anchor.y,
      z: anchor.z + 1.1,
    });
    const game = createGame({
      container: document.createElement("div"),
      save,
      onAction: options.onAction,
      onRefresh: async () => save,
      onFeedback: (event) => options.feedback.push(event),
    });
    advance();
    advance();
    const targetId = game.inspect().status.nearEncounterId;
    if (!targetId)
      throw new Error("No enemy is in reach of the spawn override");
    return { game, save, targetId };
  }

  it("plays contact before the server replies and never replays it", async () => {
    let reply!: (save: SaveView) => void;
    const onAction = vi.fn(
      (_request: GameplayActionRequest) =>
        new Promise<SaveView>((resolve) => {
          reply = resolve;
        }),
    );
    const feedback: GameFeedbackEvent[] = [];
    const { game, save, targetId } = besideFirstEnemy({ onAction, feedback });

    game.setInput("attack", true);
    game.setInput("attack", false);
    advance();
    expect(onAction).toHaveBeenCalledOnce();
    expect(scene().expected).toEqual([targetId]);
    expect(feedback.filter((event) => event.type === "hit")).toHaveLength(0);

    advance(100);
    expect(scene().anticipated.map((entry) => entry.id)).toEqual([targetId]);
    expect(feedback).toContainEqual({
      type: "hit",
      encounterId: targetId,
      kind: "primary",
    });
    const contactFrame = scene().frames.at(-1)!;
    expect(contactFrame.visualDeltaSeconds!).toBeLessThan(
      contactFrame.deltaSeconds,
    );
    const shake = contactFrame.cameraShake!;
    expect(Math.hypot(shake.x, shake.y, shake.z)).toBeGreaterThan(0);

    const damaged = structuredClone(save);
    damaged.revision += 1;
    damaged.adventure!.activeLevel!.encounters.find(
      (enemy) => enemy.id === targetId,
    )!.hp -= 1;
    reply(damaged);
    await flush();
    advance();
    advance();
    expect(feedback.filter((event) => event.type === "hit")).toHaveLength(1);
    expect(scene().anticipated).toHaveLength(1);

    const defeated = structuredClone(damaged);
    defeated.revision += 1;
    const enemy = defeated.adventure!.activeLevel!.encounters.find(
      (entry) => entry.id === targetId,
    )!;
    enemy.hp = 0;
    enemy.defeated = true;
    game.updateSave(defeated);
    expect(scene().celebrated).toEqual([{ id: targetId, boss: false }]);
    expect(feedback).toContainEqual({
      type: "defeat",
      encounterId: targetId,
      boss: false,
    });
    game.dispose();
  });

  it("uses the third strike pose immediately but only finishes after server damage confirms it", async () => {
    let reply!: (save: SaveView) => void;
    const onAction = vi.fn(
      (_request: GameplayActionRequest) =>
        new Promise<SaveView>((resolve) => {
          reply = resolve;
        }),
    );
    const feedback: GameFeedbackEvent[] = [];
    const { game, save, targetId } = besideFirstEnemy({
      comboStep: 2, onAction, feedback,
    });
    game.setInput("attack", true);
    game.setInput("attack", false);
    advance();
    expect((scene().frames.at(-1) as SceneFrame & { attackComboStep?: number }).attackComboStep)
      .toBe(3);
    advance(100);
    expect(scene().comboFinishes).toEqual([]);
    expect(feedback.filter((event) => event.type === "hit")).toHaveLength(1);

    const damaged = structuredClone(save);
    damaged.revision += 1;
    damaged.adventure!.activeLevel!.encounters.find(
      (enemy) => enemy.id === targetId,
    )!.hp -= 1;
    damaged.adventure!.attackComboStep = 3;
    damaged.adventure!.attackComboRemainingMs = PRIMARY_COMBO_WINDOW_MS;
    reply(damaged);
    await flush();
    expect(scene().comboFinishes).toEqual([targetId]);
    expect(feedback.filter((event) => event.type === "hit")).toHaveLength(1);
    advance();
    expect((scene().frames.at(-1) as SceneFrame & { attackComboStep?: number }).attackComboStep)
      .toBe(3);
    game.dispose();
  });

  it("repeats a held primary at the route cooldown and confirms a three-hit combo", async () => {
    let authoritative!: SaveView;
    let step = 0;
    const onAction = vi.fn(async (request: GameplayActionRequest) => {
      if (request.action.type !== "attack") throw new Error("Expected a primary attack");
      const next = structuredClone(authoritative);
      next.revision += 1;
      step = step === 3 ? 1 : step + 1;
      next.adventure!.attackCooldownRemainingMs = 400;
      next.adventure!.attackComboStep = step as 1 | 2 | 3;
      next.adventure!.attackComboRemainingMs = PRIMARY_COMBO_WINDOW_MS;
      const encounterId = request.action.encounterId;
      const target = next.adventure!.activeLevel!.encounters.find(
        (enemy) => enemy.id === encounterId,
      )!;
      target.hp = Math.max(0, target.hp - (step === 3 ? 2 : 1));
      target.defeated = target.hp === 0;
      authoritative = next;
      return next;
    });
    const { game, save, targetId } = besideFirstEnemy({ onAction, feedback: [] });
    authoritative = save;
    game.setInput("attack", true);
    advance();
    await flush();
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(scene().frames.at(-1)?.attackComboStep).toBe(1);
    advance(399);
    await flush();
    expect(onAction).toHaveBeenCalledTimes(1);
    advance(1);
    await flush();
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(scene().frames.at(-1)?.attackComboStep).toBe(2);
    advance(399);
    await flush();
    expect(onAction).toHaveBeenCalledTimes(2);
    advance(1);
    await flush();
    expect(onAction).toHaveBeenCalledTimes(3);
    expect(scene().frames.at(-1)?.attackComboStep).toBe(3);
    expect(scene().comboFinishes).toEqual([targetId]);
    game.setInput("attack", false);
    advance(800);
    expect(onAction).toHaveBeenCalledTimes(3);
    game.dispose();
  });

  it("waits for the server-reported cooldown after a delayed reply before repeating", async () => {
    let releaseFirst!: () => void;
    const firstReplyGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    let authoritative!: SaveView;
    let lastServerHitAt = Number.NEGATIVE_INFINITY;
    let serverStep = 0;
    const onAction = vi.fn(async (request: GameplayActionRequest) => {
      if (request.action.type !== "attack") throw new Error("Expected a primary attack");
      const sentAt = now;
      serverStep = sentAt - lastServerHitAt <= PRIMARY_COMBO_WINDOW_MS
        ? (serverStep === 3 ? 1 : serverStep + 1)
        : 1;
      lastServerHitAt = sentAt;
      const next = structuredClone(authoritative);
      next.revision += 1;
      next.adventure!.attackCooldownRemainingMs = 400;
      next.adventure!.attackComboStep = serverStep as 1 | 2 | 3;
      next.adventure!.attackComboRemainingMs = PRIMARY_COMBO_WINDOW_MS;
      const encounterId = request.action.encounterId;
      const enemy = next.adventure!.activeLevel!.encounters.find(
        (entry) => entry.id === encounterId,
      )!;
      enemy.hp = Math.max(0, enemy.hp - (serverStep === 3 ? 2 : 1));
      enemy.defeated = enemy.hp === 0;
      authoritative = next;
      if (next.revision === 1) await firstReplyGate;
      return next;
    });
    const { game, save, targetId } = besideFirstEnemy({ onAction, feedback: [] });
    authoritative = save;
    game.setInput("attack", true);
    advance();
    expect(onAction).toHaveBeenCalledTimes(1);
    // The first response takes a second. The next held request must still
    // wait the full 400 ms reported by the server, then chain within 2 s.
    advance(1_000);
    expect(onAction).toHaveBeenCalledTimes(1);
    releaseFirst();
    await flush();
    advance(399);
    expect(onAction).toHaveBeenCalledTimes(1);
    advance(1);
    await flush();
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(serverStep).toBe(2);
    advance(399);
    expect(onAction).toHaveBeenCalledTimes(2);
    advance(1);
    await flush();
    expect(onAction).toHaveBeenCalledTimes(3);
    expect(serverStep).toBe(3);
    expect(scene().comboFinishes).toEqual([targetId]);
    game.dispose();
  });

  it("never repeats a held attack while its request is busy or after pause and blur", async () => {
    let reply!: (save: SaveView) => void;
    const onAction = vi.fn((_request: GameplayActionRequest) =>
      new Promise<SaveView>((resolve) => { reply = resolve; }));
    const { game, save } = besideFirstEnemy({ onAction, feedback: [] });
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyF" }));
    advance();
    expect(onAction).toHaveBeenCalledTimes(1);
    advance(800);
    expect(onAction).toHaveBeenCalledTimes(1);
    const damaged = structuredClone(save);
    damaged.revision += 1;
    damaged.adventure!.attackComboStep = 1;
    damaged.adventure!.attackComboRemainingMs = PRIMARY_COMBO_WINDOW_MS;
    damaged.adventure!.activeLevel!.encounters[0]!.hp -= 1;
    reply(damaged);
    await flush();
    game.setPaused(true);
    game.setPaused(false);
    advance(800);
    expect(onAction).toHaveBeenCalledTimes(1);
    // OS key repeats cannot restore a key cleared by pause or focus loss.
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyF", repeat: true }));
    advance(800);
    expect(onAction).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyF" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyF" }));
    advance();
    expect(onAction).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new Event("blur"));
    reply(structuredClone(damaged));
    await flush();
    advance(800);
    expect(onAction).toHaveBeenCalledTimes(2);
    game.dispose();
  });

  it("paces held misses locally without sending damage requests", () => {
    const save = equippedSave();
    for (const enemy of save.adventure!.activeLevel!.encounters) {
      enemy.hp = 0;
      enemy.defeated = true;
      enemy.available = false;
    }
    const onAction = vi.fn(async () => save);
    const game = createGame({
      container: document.createElement("div"), save, onAction,
      onRefresh: async () => save,
    });
    advance();
    game.setInput("attack", true);
    advance();
    const first = game.inspect().status.attackFeedback?.sequence ?? 0;
    expect(game.inspect().status.attackFeedback?.outcome).toBe("no-target");
    for (let frame = 0; frame < 20; frame++) advance(50);
    const attempts = (game.inspect().status.attackFeedback?.sequence ?? 0) - first;
    expect(attempts).toBeGreaterThanOrEqual(2);
    expect(attempts).toBeLessThanOrEqual(3);
    expect(onAction).not.toHaveBeenCalled();
    game.clearInput();
    advance(800);
    expect(game.inspect().status.attackFeedback?.sequence).toBe(first + attempts);
    game.dispose();
  });

  it("drops a held attack across a level reset", async () => {
    const onAction = vi.fn(async (_request: GameplayActionRequest) => {
      const next = equippedSave();
      next.revision = 1;
      return next;
    });
    const { game } = besideFirstEnemy({ onAction, feedback: [] });
    game.setInput("attack", true);
    advance();
    await flush();
    expect(onAction).toHaveBeenCalledTimes(1);
    game.updateSave(makeAuthoredSave({
      routeId: ROUTE, levelId: "new-route-level", revision: 2,
    }));
    expect(game.inspect().input.attack).toBe(false);
    advance(800);
    expect(onAction).toHaveBeenCalledTimes(1);
    game.dispose();
  });

  it("does not retry a rejected request just because Attack remains held", async () => {
    const onAction = vi.fn(async (_request: GameplayActionRequest): Promise<SaveView> => {
      throw { code: "ATTACK_COOLDOWN" };
    });
    const { game } = besideFirstEnemy({ onAction, feedback: [] });
    game.setInput("attack", true);
    advance();
    await flush();
    expect(game.inspect().status.requestState).toBe("error");
    advance(800);
    expect(onAction).toHaveBeenCalledTimes(1);
    game.dispose();
  });

  it("keeps the camera still and animation running under reduced motion", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => ({ matches: query.includes("reduce") }),
    });
    const feedback: GameFeedbackEvent[] = [];
    const { game } = besideFirstEnemy({
      onAction: () => new Promise<SaveView>(() => undefined),
      feedback,
    });
    game.setInput("attack", true);
    game.setInput("attack", false);
    advance();
    advance(100);
    expect(feedback.some((event) => event.type === "hit")).toBe(true);
    for (const frame of scene().frames) {
      expect(frame.visualDeltaSeconds).toBe(frame.deltaSeconds);
      expect(frame.cameraShake).toEqual({ x: 0, y: 0, z: 0 });
    }
    game.dispose();
  });

  it("sends a press from the last moment of cooldown once the tool is ready", () => {
    const onAction = vi.fn(async (_request: GameplayActionRequest) =>
      equippedSave(),
    );
    const { game, targetId } = besideFirstEnemy({
      cooldownMs: 300,
      onAction,
      feedback: [],
    });
    // Two warm-up frames spent 100 ms; 200 ms of cooldown remain.
    game.setInput("attack", true);
    game.setInput("attack", false);
    advance();
    expect(game.inspect().status.attackFeedback).toMatchObject({
      outcome: "cooldown",
    });
    expect(onAction).not.toHaveBeenCalled();
    advance(200);
    expect(onAction).toHaveBeenCalledOnce();
    expect(onAction.mock.calls[0]![0].action).toMatchObject({
      type: "attack",
      encounterId: targetId,
    });
    game.dispose();
  });

  it("refuses a press made long before the tool is ready, as before", () => {
    const onAction = vi.fn(async (_request: GameplayActionRequest) =>
      equippedSave(),
    );
    const { game } = besideFirstEnemy({
      cooldownMs: 700,
      onAction,
      feedback: [],
    });
    game.setInput("attack", true);
    game.setInput("attack", false);
    advance();
    expect(game.inspect().status.attackFeedback).toMatchObject({
      outcome: "cooldown",
    });
    for (let frame = 0; frame < 16; frame++) advance();
    expect(onAction).not.toHaveBeenCalled();
    game.dispose();
  });

  it("leaves the gentle garden chapter without tokens", () => {
    const save = makeAuthoredSave({ routeId: ROUTE });
    const game = createGame({
      container: document.createElement("div"),
      save,
      onAction: async () => save,
      onRefresh: async () => save,
    });
    advance();
    expect(scene().collectibles.at(-1)?.plan).toBeNull();
    expect(game.inspect().status.collectibles).toBeNull();
    expect(game.inspect().collectibles).toBeNull();
    game.dispose();
  });

  it("collects a touched token once, reports it at once and keeps it through a retry", () => {
    const token = casinoPlan.tokens.find((item) => item.role === "trail")!;
    runtimeState.spawnOverrides.push({
      x: token.position.x,
      y: token.position.y - 0.55,
      z: token.position.z,
    });
    const save = makeAuthoredSave({ routeId: ROUTE });
    const feedback: GameFeedbackEvent[] = [];
    const game = createGame({
      container: document.createElement("div"),
      save,
      authoredLevelResolver: casinoResolver,
      onAction: async () => save,
      onRefresh: async () => save,
      onFeedback: (event) => feedback.push(event),
    });
    expect(scene().collectibles[0]?.plan).toEqual(casinoPlan);
    advance();
    advance();
    advance();
    expect(scene().collectedItems).toEqual([token.id]);
    expect(feedback.filter((event) => event.type === "token")).toEqual([
      { type: "token", streak: 0 },
    ]);
    expect(game.inspect().status.collectibles).toEqual({
      tokens: 1,
      tokenTotal: casinoPlan.tokens.length,
      tickets: 0,
      ticketTotal: casinoPlan.tickets.length,
    });
    expect(
      game.inspect().collectibles!.items.find((item) => item.id === token.id)
        ?.collected,
    ).toBe(true);

    const fallen = structuredClone(save);
    fallen.revision += 1;
    fallen.adventure!.phase = "fallen";
    fallen.adventure!.playerHp = 0;
    game.updateSave(fallen);
    const retried = structuredClone(save);
    retried.revision += 2;
    game.updateSave(retried);
    expect(scene().collectibles.at(-1)).toEqual({
      plan: casinoPlan,
      collected: [token.id],
    });
    expect(game.inspect().status.collectibles?.tokens).toBe(1);

    const nextChapter = makeAuthoredSave({
      routeId: "besties-playground-v2",
      levelId: "next-level",
    });
    nextChapter.id = save.id;
    nextChapter.revision = retried.revision + 1;
    game.updateSave(nextChapter);
    expect(scene().collectibles.at(-1)?.plan).toBeNull();
    expect(game.inspect().status.collectibles).toBeNull();
    game.dispose();
  });
});
