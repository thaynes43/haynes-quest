/**
 * WO074 probe harness, derived from the WO068 review harness (remote branch
 * agent/haynes-quest-0911-212453). The real Hono app in ephemeral fixture mode
 * is the action transport, the reducer, enemy and Besties simulations are real,
 * and only the Three.js scene is mocked by the importing test file.
 *
 * Additions for WO074: a response gate that models network latency on an
 * accepted action, an auto-attack switch for the scripted player, and a
 * target-seeking mover so probes can stand beside a specific Besties actor.
 */
import { expect, vi } from "vitest";
import { createApp } from "../../../src/server/app";
import { InMemoryQuestStore } from "../../../src/server/db/memory-store";
import type {
  GameplayActionRequest,
  SaveView,
} from "../../../src/shared/contracts";
import type { GameHandle, GameStatus } from "../../../src/game/types";
import { createGame } from "../../../src/game/createGame";

export const ORIGIN = "https://quest.test";
const SECRET = "fixture-session-secret-that-is-at-least-32-characters";

export interface Harness {
  app: ReturnType<typeof createApp>;
  store: InMemoryQuestStore;
  cookie: string;
  clock: { now: number; epoch: number };
}

export async function makeHarness(): Promise<Harness> {
  const clock = { now: 1_000, epoch: Date.now() };
  const store = InMemoryQuestStore.ephemeral();
  const app = createApp({
    store,
    fixtureMode: true,
    ephemeralPlaytest: true,
    sessionSecret: SECRET,
    appOrigin: ORIGIN,
    clientDir: "/tmp/quest-client-not-present",
    studioDir: "/tmp/quest-studio-not-present",
    now: () => new Date(clock.epoch + clock.now),
  });
  const session = await app.request("/api/session");
  expect(session.status).toBe(200);
  const cookie = session.headers.get("set-cookie")!.split(";", 1)[0]!;
  expect((await session.json()).progressMode).toBe("ephemeral");
  return { app, store, cookie, clock };
}

export function mutation(cookie: string, body: unknown): RequestInit {
  return {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      cookie,
      origin: ORIGIN,
      "content-type": "application/json",
      "x-quest-request": "1",
    },
  };
}

export async function startChapter(
  harness: Harness,
  chapter: 1 | 2,
): Promise<SaveView> {
  const response = await harness.app.request(
    "/api/playtest/start",
    mutation(harness.cookie, { chapter }),
  );
  expect(response.status).toBe(201);
  return response.json();
}

/** Mirrors src/client/api.ts: a non-2xx response becomes an Error whose message is the code. */
export async function apiCall<T>(
  harness: Harness,
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await harness.app.request(
    `/api${path}`,
    body === undefined
      ? { headers: { cookie: harness.cookie } }
      : mutation(harness.cookie, body),
  );
  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as {
      error?: { code?: string };
    } | null;
    throw new Error(result?.error?.code ?? "UNAVAILABLE");
  }
  return response.json() as Promise<T>;
}

export interface Runtime {
  game: GameHandle;
  actions: Array<{ type: string; z: number; ageBefore: number; at: number }>;
  statuses: GameStatus[];
  latest: () => SaveView;
  advance: (ms?: number) => Promise<void>;
  errors: string[];
  /** Hold every action response after the server applied it (network latency). */
  hold: () => void;
  release: () => void;
}

export async function flush(): Promise<void> {
  for (let hop = 0; hop < 4; hop += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

export function installBrowserClock(
  harness: Harness,
  frameHook: { next?: FrameRequestCallback },
): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  vi.spyOn(window.performance, "now").mockImplementation(
    () => harness.clock.now,
  );
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frameHook.next = callback;
    return 1;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
}

export function mountRuntime(
  harness: Harness,
  save: SaveView,
  frameHook: { next?: FrameRequestCallback },
): Runtime {
  let latest = save;
  const actions: Runtime["actions"] = [];
  const statuses: GameStatus[] = [];
  const errors: string[] = [];
  let lastStatus: GameStatus | undefined;
  let gate: { promise: Promise<void>; release: () => void } | null = null;
  const game = createGame({
    container: document.createElement("div"),
    save,
    onAction: async (request: GameplayActionRequest) => {
      actions.push({
        type: request.action.type,
        z: lastStatus?.position.z ?? Number.NaN,
        ageBefore: latest.ageYears,
        at: harness.clock.now,
      });
      const next = await apiCall<SaveView>(
        harness,
        `/saves/${save.id}/actions`,
        request,
      );
      if (gate) await gate.promise;
      if (next.revision > latest.revision) latest = next;
      return next;
    },
    onRefresh: async () => {
      const next = await apiCall<SaveView>(harness, `/saves/${save.id}`);
      if (next.revision > latest.revision) latest = next;
      return next;
    },
    onStatus: (status) => {
      lastStatus = status;
      statuses.push(status);
      if (status.requestErrorCode) errors.push(status.requestErrorCode);
    },
  });
  const advance = async (ms = 50): Promise<void> => {
    harness.clock.now += ms;
    const callback = frameHook.next;
    if (!callback)
      throw new Error("Runtime did not request an animation frame");
    callback(harness.clock.now);
    await flush();
  };
  return {
    game,
    actions,
    statuses,
    latest: () => latest,
    advance,
    errors,
    hold() {
      if (gate) return;
      let release!: () => void;
      const promise = new Promise<void>((resolve) => {
        release = resolve;
      });
      gate = { promise, release };
    },
    release() {
      gate?.release();
      gate = null;
    },
  };
}

export function ordinariesDefeated(save: SaveView): boolean {
  return (
    save.adventure?.activeLevel?.encounters
      .filter((entry) => entry.role === "ordinary")
      .every((entry) => entry.defeated) === true
  );
}

/**
 * The scripted child from WO068: holds forward, jumps at island edges,
 * releases the stick mid-air past the next landing, taps Attack/Bash when the
 * runtime reports them ready (unless autoAttack is false), retries after a
 * fall, and relies on contact pickups. Returns the reason it stopped.
 */
export async function playUntil(
  runtime: Runtime,
  done: (save: SaveView, status: GameStatus) => boolean,
  options: { maxFrames?: number; holdZ?: number; autoAttack?: boolean } = {},
): Promise<{ reason: string; frames: number }> {
  const { game, advance } = runtime;
  const maxFrames = options.maxFrames ?? 6_000;
  const autoAttack = options.autoAttack ?? true;
  let frames = 0;
  let airborneTarget: number | null = null;
  for (; frames < maxFrames; frames += 1) {
    const inspection = game.inspect();
    const status = inspection.status;
    const save = runtime.latest();
    if (done(save, status) || save.completed) {
      // Release the stick: a held forward input would otherwise carry the
      // child straight off the far edge of the boss island.
      game.setInput("moveY", 0);
      game.setInput("moveX", 0);
      return { reason: done(save, status) ? "done" : "completed", frames };
    }
    if (status.phase === "fallen") {
      game.performAction({
        type: "retry-level",
        levelId: status.activeLevelId!,
      });
      await advance();
      continue;
    }
    const obby = inspection.obby;
    if (!obby) throw new Error("Route probe expects an obby course");
    const platforms = [...obby.platforms].sort(
      (left, right) => right.center.z - left.center.z,
    );
    const z = status.position.z;
    const holdZ = options.holdZ;
    const encounters = new Map(
      (save.adventure?.activeLevel?.encounters ?? []).map((entry) => [
        entry.id,
        entry,
      ]),
    );
    const live = inspection.enemies
      .filter((enemy) => {
        const entry = encounters.get(enemy.id);
        return entry && !entry.defeated && entry.available !== false;
      })
      .map((enemy) => ({
        enemy,
        role: encounters.get(enemy.id)!.role,
        distance: Math.hypot(
          enemy.position.x - status.position.x,
          enemy.position.z - status.position.z,
        ),
      }))
      .sort((left, right) => left.distance - right.distance)[0];
    const chasing =
      live !== undefined &&
      live.role === "ordinary" &&
      ["chasing", "windup", "strike", "cooldown"].includes(live.enemy.phase);
    const closingOnBoss =
      live !== undefined &&
      live.role === "boss" &&
      holdZ === undefined &&
      live.distance <= 6;
    const arrived =
      (holdZ !== undefined && z <= holdZ) ||
      chasing ||
      (closingOnBoss && live.distance <= 1.8);
    if (status.grounded) {
      airborneTarget = null;
      const support = platforms.find(
        (platform) => platform.id === obby.supportId,
      );
      if (arrived) {
        game.setInput("moveY", 0);
      } else {
        game.setInput("moveY", 1);
        if (support) {
          const farEdge = support.center.z - support.size.z / 2;
          const next = platforms.find(
            (platform) => platform.center.z + platform.size.z / 2 < farEdge,
          );
          if (next && z - farEdge < 0.3) {
            game.setInput("jump", true);
            game.setInput("jump", false);
            airborneTarget = next.center.z;
          }
        }
      }
    } else if (airborneTarget !== null) {
      game.setInput("moveY", z > airborneTarget ? 1 : 0);
    }
    if (autoAttack) {
      if (status.attackReady) {
        game.setInput("attack", true);
        game.setInput("attack", false);
      } else if (status.guardReady) {
        game.setInput("guard", true);
        game.setInput("guard", false);
      }
    }
    await advance();
  }
  return { reason: "frames-exhausted", frames };
}

let xSign: 1 | -1 | null = null;

/** One frame of stick input toward a target; returns the remaining distance. */
export function stepToward(
  runtime: Runtime,
  target: { x: number; z: number },
): number {
  const { game } = runtime;
  const position = game.inspect().status.position;
  const dx = target.x - position.x;
  const dz = target.z - position.z;
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) {
    game.setInput("moveX", 0);
    game.setInput("moveY", 0);
    return 0;
  }
  const scale = Math.min(1, length / 0.12);
  game.setInput("moveX", (xSign ?? 1) * (dx / length) * scale);
  game.setInput("moveY", (-dz / length) * scale);
  return length;
}

/** Walks the player to a target on the current platform (no jumping). */
export async function moveTo(
  runtime: Runtime,
  target: { x: number; z: number },
  options: { tolerance?: number; maxFrames?: number; frameMs?: number } = {},
): Promise<boolean> {
  const { tolerance = 0.12, maxFrames = 600, frameMs = 16 } = options;
  const { game, advance } = runtime;
  if (xSign === null) {
    const before = game.inspect().status.position.x;
    game.setInput("moveY", 0);
    game.setInput("moveX", 1);
    await advance(frameMs);
    await advance(frameMs);
    const after = game.inspect().status.position.x;
    if (after !== before) xSign = after > before ? 1 : -1;
  }
  for (let frame = 0; frame < maxFrames; frame += 1) {
    const remaining = stepToward(runtime, target);
    if (remaining <= tolerance) {
      game.setInput("moveX", 0);
      game.setInput("moveY", 0);
      return true;
    }
    await advance(frameMs);
  }
  game.setInput("moveX", 0);
  game.setInput("moveY", 0);
  return false;
}
