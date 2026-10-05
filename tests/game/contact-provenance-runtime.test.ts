// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameplayActionRequest, SaveView } from "../../src/shared/contracts";
import { makeEraSave } from "./fixtures";

const contact = vi.hoisted(() => ({
  enabled: false,
  emitted: false,
  pattern: "bolt" as "bolt" | "charge",
}));

vi.mock("../../src/game/scene", () => ({
  GardenScene: class {
    readonly canvas = document.createElement("canvas");
    cameraYaw = 0;
    constructor(container: HTMLElement) { container.append(this.canvas); }
    adjustCamera(): void {}
    rebuildRoute(): void {}
    updateProgress(): void {}
    render(): void {}
    getMediaState(): { loading: number; failed: number } {
      return { loading: 0, failed: 0 };
    }
    dispose(): void { this.canvas.remove(); }
  },
}));

vi.mock("../../src/game/combat", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/game/combat")>();
  return {
    ...original,
    EnemySimulation: class extends original.EnemySimulation {
      override step(options: { active: boolean }, save: SaveView): string[] {
        if (!contact.enabled || !options.active) return super.step({
          player: { x: 0, y: 0, z: 1 }, deltaSeconds: 0, active: false,
        }, save);
        if (contact.emitted) return [];
        contact.emitted = true;
        return [this.frames()[0]!.id];
      }

      override frames(): ReturnType<typeof original.EnemySimulation.prototype.frames> {
        return super.frames().map((enemy, index) => index === 0 ? {
          ...enemy,
          position: { x: 4, y: 0, z: 1 },
          phase: "cooldown",
          attackPattern: contact.pattern,
        } : enemy);
      }
    },
  };
});

import { createGame } from "../../src/game/createGame";

describe("simulation contact provenance", () => {
  let nextFrame: FrameRequestCallback | undefined;
  let now: number;

  beforeEach(() => {
    contact.enabled = false;
    contact.emitted = false;
    contact.pattern = "bolt";
    now = performance.now();
    nextFrame = undefined;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      nextFrame = callback;
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  function advance(frames = 1): void {
    for (let index = 0; index < frames; index += 1) {
      now += 16;
      nextFrame?.(now);
    }
  }

  for (const pattern of ["bolt", "charge"] as const) {
    it(`accepts one distant ${pattern} contact after the simulation has entered cooldown`, async () => {
      contact.pattern = pattern;
      const initial = makeEraSave();
      const onAction = vi.fn(async (_request: GameplayActionRequest) =>
        makeEraSave({ revision: 1, playerHp: 9 }));
      const game = createGame({
        container: document.createElement("div"), save: initial, onAction,
        onRefresh: async () => initial,
      });
      const enemy = game.inspect().enemies[0]!;
      expect(enemy).toMatchObject({ phase: "cooldown", attackPattern: pattern });
      expect(enemy.position.x).toBe(4);
      expect(game.performAction({ type: "take-hit", levelId: "level-1-2020", encounterId: enemy.id })).toBe(false);

      contact.enabled = true;
      advance(3);
      await vi.waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
      expect(onAction.mock.calls[0]![0].action).toEqual({
        type: "take-hit", levelId: "level-1-2020", encounterId: enemy.id,
      });
      advance(20);
      expect(onAction).toHaveBeenCalledTimes(1);
      expect(game.performAction({ type: "take-hit", levelId: "level-1-2020", encounterId: enemy.id })).toBe(false);
      game.dispose();
    });
  }

  it("discards a queued contact after pause instead of replaying it", async () => {
    let resolveGuard!: (save: SaveView) => void;
    const guardResponse = new Promise<SaveView>((resolve) => { resolveGuard = resolve; });
    const initial = makeEraSave({ collectedKinds: ["guard-tool"] });
    const onAction = vi.fn((request: GameplayActionRequest) => request.action.type === "guard"
      ? guardResponse : Promise.resolve(makeEraSave({ revision: 2, playerHp: 9 })));
    const game = createGame({
      container: document.createElement("div"), save: initial, onAction,
      onRefresh: async () => initial,
    });
    expect(game.performAction({ type: "guard", levelId: "level-1-2020" })).toBe(true);
    contact.enabled = true;
    advance(3);
    expect(contact.emitted).toBe(true);
    expect(onAction).toHaveBeenCalledTimes(1);
    game.setPaused(true);
    resolveGuard(makeEraSave({ revision: 1, collectedKinds: ["guard-tool"] }));
    await vi.waitFor(() => expect(game.inspect().status.requestBusy).toBe(false));
    game.setPaused(false);
    advance(5);
    expect(onAction).toHaveBeenCalledTimes(1);
    game.dispose();
  });

  it("expires a contact while another action is in flight", async () => {
    let resolveGuard!: (save: SaveView) => void;
    const guardResponse = new Promise<SaveView>((resolve) => { resolveGuard = resolve; });
    const initial = makeEraSave({ collectedKinds: ["guard-tool"] });
    const onAction = vi.fn((request: GameplayActionRequest) => request.action.type === "guard"
      ? guardResponse : Promise.resolve(makeEraSave({ revision: 2, playerHp: 9 })));
    const game = createGame({
      container: document.createElement("div"), save: initial, onAction,
      onRefresh: async () => initial,
    });
    expect(game.performAction({ type: "guard", levelId: "level-1-2020" })).toBe(true);
    contact.enabled = true;
    advance(3);
    expect(contact.emitted).toBe(true);
    advance(75);
    resolveGuard(makeEraSave({ revision: 1, collectedKinds: ["guard-tool"] }));
    await vi.waitFor(() => expect(game.inspect().status.requestBusy).toBe(false));
    advance(2);
    expect(onAction).toHaveBeenCalledTimes(1);
    game.dispose();
  });
});
