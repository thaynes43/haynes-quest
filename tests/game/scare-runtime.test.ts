// @vitest-environment jsdom
/**
 * DESIGN-027 at runtime: `createGame` schedules blackouts only on safe
 * footing, changes sleeping animatronics only while the camera cannot see
 * them, turns a lethal level 2 attack into a lunge with a cooldown, and
 * reports the scare sounds. The parent switch turns all of it off.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authoredRoute,
  type AuthoredLevelResolver,
} from "../../src/game/authored-layout";
import type { ObbyPlatform } from "../../src/game/obby";
import type { GameFeedbackEvent, SceneFrame } from "../../src/game/types";
import { AUTHORED_LEVEL_SCHEMA_VERSION_V4 } from "../../src/shared/authored-level";
import type { GameplayActionRequest, SaveView } from "../../src/shared/contracts";
import { makeAuthoredSave } from "./authored-fixtures";

const runtimeState = vi.hoisted(() => ({
  spawnOverrides: [] as Array<{ x: number; y: number; z: number }>,
  inView: true,
  frames: [] as unknown[],
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
    constructor(container: HTMLElement) {
      container.append(this.canvas);
    }
    adjustCamera(): void {}
    rebuildRoute(): void {}
    updateProgress(): void {}
    getMediaState() {
      return { loading: 0, failed: 0, reloadRequired: false };
    }
    setCollectibles(): void {}
    collectItem(): void {}
    bouncePad(): void {}
    expectHit(): void {}
    anticipateHit(): void {}
    celebrate(): void {}
    isInView(): boolean {
      return runtimeState.inView;
    }
    render(_position: unknown, _facing: number, _elapsed: number, frame?: unknown): void {
      runtimeState.frames.push(frame);
    }
    dispose(): void {
      this.canvas.remove();
    }
  },
}));

import { createGame } from "../../src/game/createGame";

const ROUTE = "garden-playground-v2";
const garden = authoredRoute(ROUTE)!;

/** A test rig beside the garden course (x ≤ 12): a still deck and a lift. */
const deck: ObbyPlatform = {
  id: "scare-deck",
  center: { x: 40, y: -0.5, z: 0 },
  size: { x: 10, y: 1, z: 10 },
};
const lift: ObbyPlatform = {
  id: "scare-lift",
  center: { x: 60, y: 0.75, z: 0 },
  size: { x: 3, y: 0.5, z: 3 },
  motion: { axis: "y", distance: 1, period: 6, phase: (3 * Math.PI) / 2, dwell: 1 },
};

function resolverFor(scare: 0 | 1 | 2 | undefined): AuthoredLevelResolver {
  const route = {
    ...garden,
    document: {
      ...garden.document,
      schemaVersion: AUTHORED_LEVEL_SCHEMA_VERSION_V4,
      theme: "casino",
      ...(scare === undefined ? {} : { scare }),
    },
    course: {
      ...garden.course,
      platforms: [...garden.course.platforms, deck, lift],
    },
  } as unknown as NonNullable<ReturnType<AuthoredLevelResolver>>;
  return (routeId) => (routeId === ROUTE ? route : authoredRoute(routeId));
}

const RADIO_CANDIDATE = {
  catalogEntryId: "editor-candidate-radio-host-showman",
  catalogEntryVersion: "draft-v1",
  assetId: "neutral-enemy-placeholder",
  assetVersion: "v001",
  displayName: "The Radio Showman",
  placeholder: "neutral-candidate-v1",
} as const;

function equippedSave(): SaveView {
  const save = makeAuthoredSave({ routeId: ROUTE });
  const adventure = save.adventure!;
  const collected = adventure.activeLevel!.pickups.map((pickup) => ({
    ...pickup,
    collected: true,
  }));
  adventure.activeLevel!.pickups = collected;
  adventure.inventory = collected;
  adventure.equippedId = collected.find((pickup) => pickup.kind === "attack-tool")!.id;
  return save;
}

/** The server's answer to a lethal hit: 0 HP and the fallen phase. */
function fallen(save: SaveView, revision: number): SaveView {
  const next = structuredClone(save);
  next.revision = revision;
  next.adventure!.playerHp = 0;
  next.adventure!.phase = "fallen";
  return next;
}

/** The server's answer to retry-level: back to exploring at full HP. */
function recovered(save: SaveView, revision: number): SaveView {
  const next = structuredClone(save);
  next.revision = revision;
  next.adventure!.playerHp = next.adventure!.maxPlayerHp;
  next.adventure!.phase = "exploring";
  return next;
}

const ofType = <T extends GameFeedbackEvent["type"]>(
  feedback: GameFeedbackEvent[],
  type: T,
) => feedback.filter((event): event is Extract<GameFeedbackEvent, { type: T }> => event.type === type);

describe("scary moments at runtime", () => {
  let nextFrame: FrameRequestCallback | undefined;
  let now: number;
  let reducedMotion: boolean;

  beforeEach(() => {
    runtimeState.spawnOverrides.length = 0;
    runtimeState.frames.length = 0;
    runtimeState.inView = true;
    nextFrame = undefined;
    now = 1_000;
    reducedMotion = false;
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
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => ({
        matches: query.includes("reduced-motion") && reducedMotion,
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const advance = (milliseconds = 1000 / 60): void => {
    now += milliseconds;
    const callback = nextFrame;
    if (!callback) throw new Error("Runtime did not request an animation frame");
    callback(now);
  };
  const flush = async (): Promise<void> => {
    for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();
  };

  function start(options: {
    scare: 0 | 1 | 2 | undefined;
    spawn: { x: number; y: number; z: number };
    scaryMoments?: boolean;
    save?: SaveView;
    onAction?: (request: GameplayActionRequest, save: SaveView) => SaveView;
  }) {
    runtimeState.spawnOverrides.push(options.spawn);
    const save = options.save ?? equippedSave();
    const feedback: GameFeedbackEvent[] = [];
    const game = createGame({
      container: document.createElement("div"),
      save,
      authoredLevelResolver: resolverFor(options.scare),
      onAction: async (request) => options.onAction?.(request, save) ?? save,
      onRefresh: async () => save,
      onFeedback: (event) => feedback.push(event),
      ...(options.scaryMoments === undefined ? {} : { scaryMoments: options.scaryMoments }),
    });
    advance();
    advance();
    return { game, save, feedback };
  }

  const lastFrame = () => runtimeState.frames.at(-1) as SceneFrame | undefined;

  describe("blackouts", () => {
    it("black out a level 2 chapter only on safe footing, and bring the lights back", () => {
      const { game, feedback } = start({ scare: 2, spawn: { x: 40, y: 0, z: 0 } });
      let groundedBefore = true;
      let lastLaunchFrame = Number.NEGATIVE_INFINITY;
      let blackoutFrames = 0;
      let wasDark = false;
      for (let frame = 0; frame < 60 * 240; frame += 1) {
        // Hop now and then; sometimes in quick bursts.
        const hop = frame % 600 === 300 || frame % 600 === 390 || frame % 1300 === 700;
        game.setInput("jump", hop);
        advance();
        const inspection = game.inspect();
        const state = inspection.obby!.state;
        if (groundedBefore && !state.grounded) lastLaunchFrame = frame;
        groundedBefore = state.grounded;
        const lighting = inspection.scare!.lighting;
        const dark = lighting.blackoutElapsed !== null;
        if (dark && !wasDark) {
          blackoutFrames += 1;
          expect(state.grounded).toBe(true);
          expect(state.supportId).toBe("scare-deck");
          expect((frame - lastLaunchFrame) / 60).toBeGreaterThanOrEqual(2);
        }
        wasDark = dark;
      }
      const scare = game.inspect().scare!;
      expect(scare.level).toBe(2);
      expect(blackoutFrames).toBeGreaterThanOrEqual(3);
      expect(scare.blackouts).toBe(blackoutFrames);
      expect(ofType(feedback, "blackout-return").length).toBeGreaterThanOrEqual(blackoutFrames - 1);
      expect(ofType(feedback, "ambient-laugh").length).toBeGreaterThan(0);
      expect(lastFrame()?.scare?.level).toBe(2);
      game.dispose();
    });

    it("never black out while the player rides a lift", () => {
      const { game } = start({ scare: 2, spawn: { x: 60, y: 0, z: 0 } });
      for (let frame = 0; frame < 60 * 150; frame += 1) {
        advance();
        expect(game.inspect().obby!.state.supportId).toBe("scare-lift");
      }
      expect(game.inspect().scare!.blackouts).toBe(0);
      expect(game.inspect().scare!.flickers).toBeGreaterThan(0);
      game.dispose();
    });

    it("flicker but never black out at level 1", () => {
      const { game, feedback } = start({ scare: 1, spawn: { x: 40, y: 0, z: 0 } });
      for (let frame = 0; frame < 60 * 150; frame += 1) advance();
      const scare = game.inspect().scare!;
      expect(scare.level).toBe(1);
      expect(scare.blackouts).toBe(0);
      expect(scare.flickers).toBeGreaterThan(10);
      expect(ofType(feedback, "ambient-laugh")).toEqual([]);
      expect(ofType(feedback, "blackout-return")).toEqual([]);
      game.dispose();
    });

    it("hold the scare clock while the world is paused", () => {
      const { game } = start({ scare: 2, spawn: { x: 40, y: 0, z: 0 } });
      game.setPaused(true);
      for (let frame = 0; frame < 60 * 120; frame += 1) advance();
      expect(game.inspect().scare!).toMatchObject({ blackouts: 0, flickers: 0 });
      game.dispose();
    });
  });

  describe("watchers", () => {
    const farFromEnemies = { x: 40, y: 0, z: 0 };

    it("hold still and keep their facing while the camera can see them", () => {
      runtimeState.inView = true;
      const { game, save } = start({ scare: 1, spawn: farFromEnemies });
      const ordinary = new Set(
        save.adventure!.activeLevel!.encounters
          .filter((encounter) => encounter.role === "ordinary")
          .map((encounter) => encounter.id),
      );
      const sleeping = () =>
        game
          .inspect()
          .enemies.filter((enemy) => ordinary.has(enemy.id))
          .map((enemy) => [enemy.id, enemy.position, enemy.facing, enemy.pose]);
      const before = sleeping();
      expect(before).toHaveLength(4);
      game.setInput("moveX", -1);
      for (let frame = 0; frame < 60 * 20; frame += 1) advance();
      expect(sleeping()).toEqual(before);
      expect(game.inspect().scare!.watcherMoves).toBe(0);
      game.dispose();
    });

    it("change unseen within 1.5 m and their arena, and creak once when seen again", () => {
      runtimeState.inView = false;
      const { game, feedback } = start({ scare: 1, spawn: farFromEnemies });
      const spawns = new Map(game.inspect().enemies.map((enemy) => [enemy.id, { ...enemy }]));
      for (let frame = 0; frame < 60 * 8; frame += 1) advance();
      const moved = game.inspect().scare!.watcherMoves;
      // Four sleeping ordinaries; the boss never watches.
      expect(moved).toBe(4);
      for (const enemy of game.inspect().enemies) {
        const spawn = spawns.get(enemy.id)!;
        expect(
          Math.hypot(enemy.position.x - spawn.position.x, enemy.position.z - spawn.position.z),
        ).toBeLessThanOrEqual(1.5 + 1e-9);
        expect(enemy.position.y).toBe(spawn.position.y);
      }
      expect(game.inspect().enemies.filter((enemy) => enemy.pose !== undefined)).toHaveLength(5);
      expect(ofType(feedback, "watcher-creak")).toEqual([]);
      runtimeState.inView = true;
      advance();
      const creaks = ofType(feedback, "watcher-creak").map((event) => event.encounterId).sort();
      expect(creaks).toHaveLength(4);
      advance();
      expect(ofType(feedback, "watcher-creak")).toHaveLength(4);
      // Inspection counts the creaks for lockstep harnesses.
      expect(game.inspect().scare).toMatchObject({ watcherCreaks: 4 });
      expect([...game.inspect().scare!.lastWatcherCreakIds].sort()).toEqual(creaks);
      game.dispose();
    });

    it("stay inside their authored arenas", () => {
      runtimeState.inView = false;
      const { game } = start({ scare: 2, spawn: farFromEnemies });
      const encounters = game.inspect().level.encounterPositions;
      for (let spell = 0; spell < 12; spell += 1) {
        for (let frame = 0; frame < 60 * 4; frame += 1) advance();
        runtimeState.inView = true;
        advance();
        runtimeState.inView = false;
      }
      const slots = ["ordinary-1", "ordinary-2", "ordinary-3", "ordinary-4"] as const;
      for (const [index, slot] of slots.entries()) {
        const arena = garden.anchors.encounters[slot].arena;
        const enemy = game.inspect().enemies.find((entry) => entry.id === encounters[index]!.id)!;
        expect(enemy.position.x).toBeGreaterThanOrEqual(arena.minX);
        expect(enemy.position.x).toBeLessThanOrEqual(arena.maxX);
        expect(enemy.position.z).toBeGreaterThanOrEqual(arena.minZ);
        expect(enemy.position.z).toBeLessThanOrEqual(arena.maxZ);
      }
      expect(game.inspect().scare!.watcherMoves).toBeGreaterThan(12);
      game.dispose();
    });

    it("never change with the switch off or at level 0", () => {
      runtimeState.inView = false;
      for (const options of [
        { scare: 2 as const, scaryMoments: false },
        { scare: 0 as const },
        { scare: undefined },
      ]) {
        const { game, feedback } = start({ ...options, spawn: farFromEnemies });
        for (let frame = 0; frame < 60 * 8; frame += 1) advance();
        expect(game.inspect().scare).toBeUndefined();
        expect(game.inspect().enemies.every((enemy) => enemy.pose === undefined)).toBe(true);
        expect(feedback).toEqual([]);
        expect(lastFrame()?.scare).toBeUndefined();
        game.dispose();
      }
    });
  });

  describe("jump scares", () => {
    const beside = () => {
      const anchor = garden.anchors.encounters["ordinary-1"].position;
      return { x: anchor.x, y: anchor.y, z: anchor.z + 1.1 };
    };

    /** Plays until the enemy's strike lands and the server's lethal answer arrives. */
    async function untilLethalReply(game: ReturnType<typeof createGame>, answered: () => boolean) {
      for (let frame = 0; frame < 60 * 6 && !answered(); frame += 1) {
        advance();
        await flush();
      }
      advance();
    }

    it("lunge for 0.9 s when an attack takes the player to 0 HP at level 2", async () => {
      let revision = 0;
      let answered = 0;
      const { game, save, feedback } = start({
        scare: 2,
        spawn: beside(),
        onAction: (request, base) => {
          if (request.action.type !== "take-hit") return base;
          answered += 1;
          revision = base.revision + 1;
          return fallen(base, revision);
        },
      });
      const attacker = save.adventure!.activeLevel!.encounters[0]!.id;
      await untilLethalReply(game, () => answered > 0);
      expect(ofType(feedback, "jump-scare")).toEqual([
        { type: "jump-scare", encounterId: attacker, durationMs: 900 },
      ]);
      expect(ofType(feedback, "hurt")).toHaveLength(1);
      const lunge = game.inspect().scare!.lunge!;
      expect(lunge).toMatchObject({ encounterId: attacker, reducedMotion: false });
      expect(lastFrame()?.scare?.lunge?.encounterId).toBe(attacker);
      advance(450);
      expect(lastFrame()?.scare?.lunge?.progress).toBeGreaterThan(0.4);
      advance(500);
      expect(game.inspect().scare!.lunge).toBeNull();
      expect(lastFrame()?.scare?.lunge).toBeNull();
      expect(game.inspect().scare!.jumpScares).toBe(1);
      game.dispose();
    });

    it("wait 60 s before the next one, then scare again", async () => {
      let revision = 0;
      let answered = 0;
      const { game, save, feedback } = start({
        scare: 2,
        spawn: beside(),
        onAction: (request, base) => {
          if (request.action.type !== "take-hit") return base;
          answered += 1;
          revision = Math.max(revision, base.revision) + 1;
          return fallen({ ...base, revision }, revision);
        },
      });
      await untilLethalReply(game, () => answered === 1);
      expect(ofType(feedback, "jump-scare")).toHaveLength(1);
      // The checkpoint return, then a second lethal hit ten seconds later.
      revision += 1;
      runtimeState.spawnOverrides.push(beside());
      game.updateSave(recovered(save, revision));
      advance(10_000);
      await untilLethalReply(game, () => answered === 2);
      expect(answered).toBe(2);
      expect(ofType(feedback, "hurt")).toHaveLength(2);
      expect(ofType(feedback, "jump-scare")).toHaveLength(1);
      // A minute after the first, the next lethal hit lunges again.
      revision += 1;
      runtimeState.spawnOverrides.push(beside());
      game.updateSave(recovered(save, revision));
      advance(55_000);
      await untilLethalReply(game, () => answered === 3);
      expect(answered).toBe(3);
      expect(ofType(feedback, "jump-scare")).toHaveLength(2);
      game.dispose();
    });

    it("cut for 0.5 s without motion when the player prefers reduced motion", async () => {
      reducedMotion = true;
      let answered = 0;
      const { game, feedback } = start({
        scare: 2,
        spawn: beside(),
        onAction: (request, base) => {
          if (request.action.type !== "take-hit") return base;
          answered += 1;
          return fallen(base, base.revision + 1);
        },
      });
      await untilLethalReply(game, () => answered > 0);
      expect(ofType(feedback, "jump-scare")[0]?.durationMs).toBe(500);
      expect(game.inspect().scare!.lunge?.reducedMotion).toBe(true);
      advance(520);
      expect(game.inspect().scare!.lunge).toBeNull();
      game.dispose();
    });

    it("never scare at level 1, at level 0 or with the switch off", async () => {
      for (const options of [
        { scare: 1 as const },
        { scare: 0 as const },
        { scare: 2 as const, scaryMoments: false },
      ]) {
        let answered = 0;
        const { game, feedback } = start({
          ...options,
          spawn: beside(),
          onAction: (request, base) => {
            if (request.action.type !== "take-hit") return base;
            answered += 1;
            return fallen(base, base.revision + 1);
          },
        });
        await untilLethalReply(game, () => answered > 0);
        expect(answered).toBe(1);
        expect(ofType(feedback, "hurt")).toHaveLength(1);
        expect(ofType(feedback, "jump-scare")).toEqual([]);
        game.dispose();
      }
    });

    it("never scare for a hit that leaves the player standing", async () => {
      let answered = 0;
      const { game, feedback } = start({
        scare: 2,
        spawn: beside(),
        onAction: (request, base) => {
          if (request.action.type !== "take-hit") return base;
          answered += 1;
          const next = structuredClone(base);
          next.revision += 1;
          next.adventure!.playerHp -= 1;
          return next;
        },
      });
      await untilLethalReply(game, () => answered > 0);
      expect(ofType(feedback, "hurt")).toHaveLength(1);
      expect(ofType(feedback, "jump-scare")).toEqual([]);
      game.dispose();
    });
  });

  describe("scare sounds", () => {
    it("crackle when the radio showman winds up, at level 1 or 2 only", () => {
      const anchor = garden.anchors.encounters["ordinary-1"].position;
      for (const [scare, expected] of [[1, 1], [2, 1], [0, 0]] as const) {
        const save = equippedSave();
        save.adventure!.activeLevel!.encounters[0]!.content = { ...RADIO_CANDIDATE };
        const { game, feedback } = start({
          scare,
          save,
          spawn: { x: anchor.x, y: anchor.y, z: anchor.z + 1.1 },
        });
        for (let frame = 0; frame < 90; frame += 1) advance();
        expect(ofType(feedback, "radio-static")).toEqual(
          expected
            ? [{ type: "radio-static", encounterId: save.adventure!.activeLevel!.encounters[0]!.id }]
            : [],
        );
        game.dispose();
      }
    });

    it("play the creepy ambience while a scary world is active", () => {
      const { game, feedback } = start({ scare: 1, spawn: { x: 40, y: 0, z: 0 } });
      expect(ofType(feedback, "scare-ambient-loop")).toEqual([
        { type: "scare-ambient-loop", active: true },
      ]);
      game.setPaused(true);
      advance();
      game.setPaused(false);
      advance();
      advance();
      expect(ofType(feedback, "scare-ambient-loop").map((event) => event.active)).toEqual([
        true,
        false,
        true,
      ]);
      game.dispose();
    });
  });
});
