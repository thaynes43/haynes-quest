// @vitest-environment jsdom
/**
 * WO068 review probe: drives the PLAN007 runtime end to end without a browser.
 *
 * Transport is the real Hono app in ephemeral fixture mode (session cookie,
 * Origin + X-Quest-Request, /api/playtest/start, /api/saves/:id/actions), the
 * reducer, enemy and Besties simulations are real; only the Three.js scene is
 * mocked. A scripted player walks the route, jumps at island edges, attacks
 * when the runtime reports readiness and relies on contact collection.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/server/app";
import { InMemoryQuestStore } from "../../../src/server/db/memory-store";
import type {
  GameplayActionRequest,
  SaveView,
} from "../../../src/shared/contracts";
import type { SceneFrame } from "../../../src/game/types";

const sceneState = vi.hoisted(() => ({
  instances: [] as Array<{
    rebuilds: string[];
    updates: number[];
    frames: SceneFrame[];
  }>,
}));

vi.mock("../../../src/game/scene", () => ({
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

import { createGame } from "../../../src/game/createGame";
import type { GameHandle, GameStatus } from "../../../src/game/types";

const ORIGIN = "https://quest.test";
const SECRET = "fixture-session-secret-that-is-at-least-32-characters";

interface Harness {
  app: ReturnType<typeof createApp>;
  store: InMemoryQuestStore;
  cookie: string;
  clock: { now: number; epoch: number };
}

async function makeHarness(): Promise<Harness> {
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

function mutation(cookie: string, body: unknown): RequestInit {
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

async function startChapter(harness: Harness, chapter: 1 | 2): Promise<SaveView> {
  const response = await harness.app.request(
    "/api/playtest/start",
    mutation(harness.cookie, { chapter }),
  );
  expect(response.status).toBe(201);
  return response.json();
}

/** Mirrors src/client/api.ts: non-2xx becomes an Error whose message is the code. */
async function apiCall<T>(harness: Harness, path: string, body?: unknown): Promise<T> {
  const response = await harness.app.request(
    `/api${path}`,
    body === undefined ? { headers: { cookie: harness.cookie } } : mutation(harness.cookie, body),
  );
  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as
      | { error?: { code?: string } }
      | null;
    throw new Error(result?.error?.code ?? "UNAVAILABLE");
  }
  return response.json() as Promise<T>;
}

interface Runtime {
  game: GameHandle;
  actions: Array<{ type: string; z: number; ageBefore: number }>;
  statuses: GameStatus[];
  latest: () => SaveView;
  advance: (ms?: number) => Promise<void>;
  errors: string[];
}

function summarize(actions: Runtime["actions"]): string {
  const compact: string[] = [];
  for (const action of actions) {
    const last = compact.at(-1);
    const label = `${action.type}@${action.z.toFixed(1)}`;
    if (last?.startsWith(action.type)) {
      const match = /×(\d+)$/.exec(last);
      const count = match ? Number(match[1]) + 1 : 2;
      compact[compact.length - 1] = `${action.type}×${count}`;
    } else compact.push(label);
  }
  return compact.join(", ");
}

async function flush(): Promise<void> {
  for (let hop = 0; hop < 4; hop += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function mountRuntime(
  harness: Harness,
  save: SaveView,
  frameHook: { next?: FrameRequestCallback },
): Runtime {
  let latest = save;
  const actions: Runtime["actions"] = [];
  const statuses: GameStatus[] = [];
  const errors: string[] = [];
  let lastStatus: GameStatus | undefined;
  const game = createGame({
    container: document.createElement("div"),
    save,
    onAction: async (request: GameplayActionRequest) => {
      actions.push({
        type: request.action.type,
        z: lastStatus?.position.z ?? Number.NaN,
        ageBefore: latest.ageYears,
      });
      const next = await apiCall<SaveView>(
        harness,
        `/saves/${save.id}/actions`,
        request,
      );
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
    if (!callback) throw new Error("Runtime did not request an animation frame");
    callback(harness.clock.now);
    await flush();
  };
  return { game, actions, statuses, latest: () => latest, advance, errors };
}

/**
 * The scripted child: holds forward, jumps when the supporting island's far
 * edge is close, releases the stick mid-air once past the next landing's
 * centre, taps Attack/Bash whenever the runtime reports them ready, retries
 * after a fall, and otherwise relies on contact pickups. Returns the reason it
 * stopped.
 */
async function playUntil(
  runtime: Runtime,
  done: (save: SaveView, status: GameStatus) => boolean,
  options: { maxFrames?: number; holdZ?: number } = {},
): Promise<{ reason: string; frames: number }> {
  const { game, advance } = runtime;
  const maxFrames = options.maxFrames ?? 6_000;
  const trace: string[] = [];
  let frames = 0;
  let airborneTarget: number | null = null;
  for (; frames < maxFrames; frames += 1) {
    const inspection = game.inspect();
    const status = inspection.status;
    const save = runtime.latest();
    if (done(save, status)) return { reason: "done", frames };
    if (save.completed) return { reason: "completed", frames };
    if (status.phase === "fallen") {
      game.performAction({ type: "retry-level", levelId: status.activeLevelId! });
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
    // Engage a live enemy that is already after us; walk into a melee boss.
    const encounters = new Map(
      (save.adventure?.activeLevel?.encounters ?? []).map((entry) => [entry.id, entry]),
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
      live !== undefined && live.role === "boss" && holdZ === undefined && live.distance <= 6;
    const arrived =
      (holdZ !== undefined && z <= holdZ) ||
      chasing ||
      (closingOnBoss && live.distance <= 1.8);
    if (frames % 25 === 0) {
      trace.push(
        `f${frames} z=${z.toFixed(2)} y=${status.position.y.toFixed(2)} g=${status.grounded ? 1 : 0} sup=${obby.supportId} ph=${status.phase} hp=${status.playerHp} ` +
          `live=${live ? `${live.enemy.id.split("-").slice(-1)[0]}:${live.enemy.phase}:${live.distance.toFixed(2)}` : "-"} ` +
          `ready=${status.attackReady ? 1 : 0}/${status.guardReady ? 1 : 0} busy=${status.requestBusy ? 1 : 0} acts=${runtime.actions.length}`,
      );
      if (trace.length > 60) trace.shift();
    }
    if (status.grounded) {
      airborneTarget = null;
      const support = platforms.find((platform) => platform.id === obby.supportId);
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
    if (status.attackReady) {
      game.setInput("attack", true);
      game.setInput("attack", false);
    } else if (status.guardReady) {
      game.setInput("guard", true);
      game.setInput("guard", false);
    }
    await advance();
  }
  console.log(
    `playUntil exhausted after ${frames} frames; actions=${runtime.actions
      .map((action) => `${action.type}@${action.z.toFixed(1)}`)
      .join(",")}\n${trace.join("\n")}`,
  );
  return { reason: "frames-exhausted", frames };
}

describe("WO068 runtime route probe (b11f97a)", () => {
  const frameHook: { next?: FrameRequestCallback } = {};
  let harness: Harness;

  beforeEach(async () => {
    sceneState.instances.length = 0;
    frameHook.next = undefined;
    harness = await makeHarness();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    vi.spyOn(window.performance, "now").mockImplementation(() => harness.clock.now);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frameHook.next = callback;
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("plays chapter one from age zero to the major memory through the real API", async () => {
    const start = await startChapter(harness, 1);
    expect(start.ageYears).toBe(0);
    expect(start.abilities).toContain("jump");
    expect(start.adventure?.activeLevel?.routeId).toBe("gentle-jump-v1");
    expect(start.adventure?.activeLevel?.periodId).toBe("block-party-v1");
    const levelOne = start.adventure!.activeLevel!;
    const runtime = mountRuntime(harness, start, frameHook);
    await runtime.advance();
    await runtime.advance();

    // Age zero must jump: a queued tap leaves the ground before any pickup.
    runtime.game.setInput("jump", true);
    runtime.game.setInput("jump", false);
    await runtime.advance();
    await runtime.advance();
    expect(runtime.game.inspect().status.position.y).toBeGreaterThan(0.1);
    expect(runtime.game.inspect().status.jumpSequence).toBe(1);
    for (let frame = 0; frame < 16; frame += 1) await runtime.advance();
    expect(runtime.game.inspect().status.grounded).toBe(true);

    const bossDefeated = await playUntil(
      runtime,
      (save) => save.adventure?.phase === "memory-released",
    );
    expect(bossDefeated.reason).toBe("done");
    const afterBoss = runtime.latest();
    expect(afterBoss.ageYears).toBe(0);
    const minorStates = levelOne.minorMemoryIds!.map(
      (id) => afterBoss.memories.find((memory) => memory.id === id)?.state,
    );
    expect(minorStates).toEqual(["revealed", "revealed"]);
    expect(
      afterBoss.memories.find((memory) => memory.id === levelOne.majorMemoryId)?.state,
    ).toBe("released");
    const types = runtime.actions.map((action) => action.type);
    expect(types.slice(0, 1)).toEqual(["collect-equipment"]);
    const minors = runtime.actions.filter((action) => action.type === "recover-memory");
    expect(minors.length).toBe(2);
    expect(minors.every((action) => action.ageBefore === 0)).toBe(true);
    expect(minors[0]!.z).toBeGreaterThan(-8);
    expect(minors[1]!.z).toBeLessThan(-10);

    const grewUp = await playUntil(runtime, (save) => save.ageYears === 4);
    expect(grewUp.reason).toBe("done");
    const chapterTwo = runtime.latest();
    expect(chapterTwo.adventure?.activeLevelIndex).toBe(1);
    expect(chapterTwo.adventure?.phase).toBe("exploring");
    expect(chapterTwo.appearance.stage).toBe("child");
    expect(chapterTwo.abilities).toEqual(["move", "interact", "jump"]);
    expect(chapterTwo.adventure?.consumedMemoryIds).toEqual(levelOne.memoryIds);
    expect(chapterTwo.adventure?.activeLevel?.periodId).toBe("besties-obby-v1");
    expect(sceneState.instances[0]?.rebuilds).toContain("level-2-2024");
    const status = runtime.game.inspect().status;
    expect(status.position.z).toBeCloseTo(1, 1);
    expect(runtime.errors).toEqual([]);
    console.log(
      `chapter-1 actions (${runtime.actions.length}): ${summarize(runtime.actions)}`,
    );
    runtime.game.dispose();
  }, 120_000);

  it("plays the direct Besties chapter to journey completion at age seven", async () => {
    const start = await startChapter(harness, 2);
    expect(start.ageYears).toBe(4);
    expect(start.adventure?.activeLevelIndex).toBe(1);
    expect(start.adventure?.activeLevel?.periodId).toBe("besties-obby-v1");
    expect(start.adventure?.inventory.map((item) => item.kind)).toEqual(["attack-tool"]);
    const levelTwo = start.adventure!.activeLevel!;
    const runtime = mountRuntime(harness, start, frameHook);
    await runtime.advance();
    await runtime.advance();

    const bossDefeated = await playUntil(
      runtime,
      (save) => save.adventure?.phase === "memory-released",
      { holdZ: -20 },
    );
    expect(bossDefeated.reason).toBe("done");
    expect(runtime.latest().ageYears).toBe(4);
    const secondary = runtime.actions.filter((action) => action.type === "secondary-attack");
    expect(secondary.length).toBeGreaterThan(0);
    const guardedTaps = runtime.statuses.filter(
      (status) => status.attackFeedback?.outcome === "guarded",
    );
    expect(guardedTaps.length).toBe(0);

    const finished = await playUntil(runtime, (save) => save.completed);
    expect(finished.reason).toBe("done");
    const done = runtime.latest();
    expect(done.ageYears).toBe(7);
    expect(done.adventure?.phase).toBe("complete");
    expect(done.recoveredIds).toEqual(expect.arrayContaining(levelTwo.memoryIds));
    expect(runtime.errors).toEqual([]);
    console.log(
      `chapter-2 actions (${runtime.actions.length}): ${summarize(runtime.actions)}`,
    );
    runtime.game.dispose();
  }, 120_000);

  it("refuses Attack and Bash on the Besties outside their dizzy window without a request", async () => {
    const start = await startChapter(harness, 2);
    const level = start.adventure!.activeLevel!;
    const runtime = mountRuntime(harness, start, frameHook);
    await runtime.advance();
    await runtime.advance();
    // Reach the arena with the shield in hand and both ordinary guests beaten.
    const inArena = await playUntil(
      runtime,
      (save, status) =>
        save.adventure?.activeLevel?.encounters
          .filter((entry) => entry.role === "ordinary")
          .every((entry) => entry.defeated) === true &&
        save.adventure.inventory.some((item) => item.kind === "guard-tool") &&
        status.position.z <= -20 &&
        status.grounded,
      { holdZ: -20 },
    );
    expect(inArena.reason).toBe("done");
    const bossId = level.bossId;
    const requestsBefore = runtime.actions.length;
    // Wait until the duo are mid-routine and explicitly not vulnerable.
    for (let frame = 0; frame < 40; frame += 1) {
      const phase = runtime.game.inspect().status.bestiesPhase;
      if (phase && phase !== "inactive" && phase !== "dizzy") break;
      await runtime.advance();
    }
    const phase = runtime.game.inspect().status.bestiesPhase;
    expect(phase).not.toBe("dizzy");
    expect(phase).not.toBe("inactive");
    expect(
      runtime.game.performAction({ type: "attack", levelId: level.id, encounterId: bossId }),
    ).toBe(false);
    expect(runtime.game.inspect().status.attackFeedback).toMatchObject({ outcome: "guarded" });
    expect(
      runtime.game.performAction({
        type: "secondary-attack",
        levelId: level.id,
        encounterId: bossId,
      }),
    ).toBe(false);
    expect(runtime.game.inspect().status.attackFeedback).toMatchObject({
      outcome: "guarded",
      kind: "secondary",
    });
    await runtime.advance();
    expect(runtime.actions.length).toBe(requestsBefore);
    // The server would also refuse a forged Bash during their routine? No: the
    // server has no dizzy notion, so this stays a client-side gate (pre-existing).
    const forged = await harness.app.request(
      `/api/saves/${start.id}/actions`,
      mutation(harness.cookie, {
        actionId: "11111111-1111-4111-8111-111111111111",
        expectedRevision: runtime.latest().revision,
        action: { type: "secondary-attack", levelId: level.id, encounterId: bossId },
      }),
    );
    expect(forged.status).toBe(200);
    runtime.game.dispose();
  }, 120_000);

  it("keeps a mashed Attack button on the 400 ms authoritative cadence with no server rejections", async () => {
    const start = await startChapter(harness, 2);
    const level = start.adventure!.activeLevel!;
    const runtime = mountRuntime(harness, start, frameHook);
    await runtime.advance();
    await runtime.advance();
    const engaged = await playUntil(
      runtime,
      (_save, status) => Boolean(status.nearEncounterId) && status.attackReady,
    );
    expect(engaged.reason).toBe("done");
    const ordinaryId = level.encounters.find((entry) => entry.kind === "ordinary-a")!.id;
    const firstAccepted = runtime.actions.length;
    const startedAt = harness.clock.now;
    let accepted = 0;
    let cooldown = 0;
    let busy = 0;
    let lastSequence = -1;
    for (let frame = 0; frame < 24; frame += 1) {
      runtime.game.setInput("attack", true);
      runtime.game.setInput("attack", false);
      await runtime.advance(50);
      const feedback = runtime.game.inspect().status.attackFeedback;
      if (feedback && feedback.sequence !== lastSequence) {
        lastSequence = feedback.sequence;
        if (feedback.outcome === "accepted") accepted += 1;
        else if (feedback.outcome === "cooldown") cooldown += 1;
        else if (feedback.outcome === "busy") busy += 1;
      }
      if (runtime.latest().adventure?.activeLevel?.encounters.find((entry) => entry.id === ordinaryId)?.defeated)
        break;
    }
    const elapsedMs = harness.clock.now - startedAt;
    const attacks = runtime.actions.slice(firstAccepted).filter((action) => action.type === "attack");
    console.log(
      `mash: ${accepted} accepted, ${cooldown} cooldown, ${busy} busy over ${elapsedMs} ms; ${attacks.length} requests`,
    );
    expect(attacks.length).toBe(accepted);
    expect(accepted).toBeGreaterThanOrEqual(2);
    expect(accepted).toBeLessThanOrEqual(Math.ceil(elapsedMs / 400) + 1);
    expect(runtime.errors).toEqual([]);
    runtime.game.dispose();
  }, 120_000);

  it("does not accumulate background time into catch-up movement", async () => {
    const start = await startChapter(harness, 1);
    const runtime = mountRuntime(harness, start, frameHook);
    await runtime.advance();
    await runtime.advance();
    runtime.game.setInput("moveY", 1);
    await runtime.advance();
    await runtime.advance();
    const beforeHide = runtime.game.inspect().status.position.z;
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await runtime.advance(10_000);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await runtime.advance(400);
    const afterShow = runtime.game.inspect().status.position.z;
    expect(beforeHide - afterShow).toBeLessThan(0.05);
    // The first visible frame already re-armed the clock, so two ordinary
    // 50 ms frames at the 4 m/s route pace move exactly 0.4 m, nothing more.
    runtime.game.setInput("moveY", 1);
    await runtime.advance(50);
    await runtime.advance(50);
    expect(afterShow - runtime.game.inspect().status.position.z).toBeCloseTo(0.4, 1);
    runtime.game.dispose();
  });
});
