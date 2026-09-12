// @vitest-environment jsdom
/**
 * WO074 runtime probes against the real Hono app (ephemeral fixture mode) with
 * the real reducer, enemy and Besties simulations; only the Three.js scene is
 * mocked so the SceneFrame stream handed to the renderer can be inspected.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SaveView } from "../../../src/shared/contracts";
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

import {
  installBrowserClock,
  makeHarness,
  mountRuntime,
  moveTo,
  ordinariesDefeated,
  playUntil,
  startChapter,
  stepToward,
  type Harness,
  type Runtime,
} from "./runtime-lib";

function bossHp(frame: SceneFrame, bossId: string): number {
  return frame.enemies.find((enemy) => enemy.id === bossId)?.hp ?? Number.NaN;
}

/**
 * A child who reads the warnings: steps 2.4 m deeper than Pink's aimed bar
 * and 3.1 m sideways from Black's aimed lane, then waits for the dizzy window.
 */
async function dodgeUntilDizzy(
  runtime: Runtime,
  frames: () => SceneFrame[],
  maxFrames = 900,
): Promise<string[]> {
  const trace: string[] = [];
  for (let frame = 0; frame < maxFrames; frame += 1) {
    const status = runtime.game.inspect().status;
    if (frame % 15 === 0)
      trace.push(
        `${runtime.actions.length}a t+${frame} ${status.bestiesPhase} hp=${status.playerHp} x=${status.position.x.toFixed(2)} z=${status.position.z.toFixed(2)} ${status.phase}`,
      );
    if (status.bestiesPhase === "dizzy") {
      runtime.game.setInput("moveX", 0);
      runtime.game.setInput("moveY", 0);
      return trace;
    }
    if (status.phase === "fallen") {
      runtime.game.performAction({
        type: "retry-level",
        levelId: status.activeLevelId!,
      });
      await runtime.advance(16);
      continue;
    }
    const hazard = frames().at(-1)?.besties?.hazards[0];
    const position = status.position;
    let moving = false;
    if (
      hazard?.kind === "foam-bar" &&
      Math.abs(position.z - hazard.center.z) < 1.95
    ) {
      stepToward(runtime, {
        x: position.x,
        z: Math.max(-26.4, hazard.center.z - 2.4),
      });
      moving = true;
    } else if (
      hazard?.kind === "floor-lane" &&
      Math.abs(position.x - hazard.center.x) < 2.85
    ) {
      stepToward(runtime, {
        x: hazard.center.x <= 0 ? hazard.center.x + 3.1 : hazard.center.x - 3.1,
        z: position.z,
      });
      moving = true;
    }
    if (!moving) {
      runtime.game.setInput("moveX", 0);
      runtime.game.setInput("moveY", 0);
    }
    await runtime.advance(16);
  }
  throw new Error(`Besties never reached dizzy\n${trace.join("\n")}`);
}

describe("WO074 runtime probes (717cfe6)", () => {
  const frameHook: { next?: FrameRequestCallback } = {};
  let harness: Harness;

  beforeEach(async () => {
    sceneState.instances.length = 0;
    frameHook.next = undefined;
    harness = await makeHarness();
    installBrowserClock(harness, frameHook);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("animates the hit on the actor nearest the ACCEPTED attack, not the actor nearest a later rejected press", async () => {
    const start = await startChapter(harness, 2);
    const level = start.adventure!.activeLevel!;
    const bossId = level.bossId;
    const runtime = mountRuntime(harness, start, frameHook);
    await runtime.advance();
    await runtime.advance();
    // Stage 1: the scripted child clears both ordinary guests as usual.
    const guestsDone = await playUntil(runtime, (save) =>
      ordinariesDefeated(save),
    );
    expect(guestsDone.reason).toBe("done");
    // Stage 2: walk onto the boss island with the attack buttons untouched.
    const inArena = await playUntil(
      runtime,
      (_save, status) => status.position.z <= -20 && status.grounded,
      { holdZ: -20, autoAttack: false },
    );
    expect(inArena.reason).toBe("done");
    const frames = () => sceneState.instances[0]!.frames;
    const hpBeforeRoutine = runtime.game.inspect().status.playerHp;
    const dodgeTrace = await dodgeUntilDizzy(runtime, frames);
    console.log(
      `WO074 dodging child reached dizzy with hp ${runtime.game.inspect().status.playerHp} (was ${hpBeforeRoutine}); take-hits so far ${runtime.actions.filter((action) => action.type === "take-hit").length}\n${dodgeTrace.slice(-8).join("\n")}`,
    );

    // Stand beside Pink (world anchor x +1.25, z -22) and land one accepted hit
    // whose response is still travelling back from the server.
    expect(await moveTo(runtime, { x: 1.15, z: -20.9 })).toBe(true);
    expect(runtime.game.inspect().status.bestiesPhase).toBe("dizzy");
    expect(runtime.game.inspect().status.attackReady).toBe(true);
    runtime.hold();
    const requestsBefore = runtime.actions.length;
    runtime.game.setInput("attack", true);
    runtime.game.setInput("attack", false);
    await runtime.advance(16);
    expect(runtime.actions.length).toBe(requestsBefore + 1);
    expect(runtime.actions.at(-1)!.type).toBe("attack");
    expect(runtime.game.inspect().status.attackFeedback?.outcome).toBe(
      "accepted",
    );
    expect(frames().at(-1)!.bestiesHitActorId).toBe("bestie-pink");

    // Cross to Black while the accepted request is in flight and press again.
    expect(await moveTo(runtime, { x: -1.15, z: -20.9 })).toBe(true);
    expect(runtime.game.inspect().status.requestBusy).toBe(true);
    expect(runtime.game.inspect().status.bestiesPhase).toBe("dizzy");
    runtime.game.setInput("attack", true);
    runtime.game.setInput("attack", false);
    await runtime.advance(16);
    expect(runtime.game.inspect().status.attackFeedback?.outcome).toBe("busy");
    expect(runtime.actions.length).toBe(requestsBefore + 1);
    const overwritten = frames().at(-1)!.bestiesHitActorId;

    runtime.release();
    await runtime.advance(16);
    await runtime.advance(16);
    const stream = frames();
    const dropIndex = stream.findIndex(
      (frame, index) =>
        index > 0 && bossHp(frame, bossId) < bossHp(stream[index - 1]!, bossId),
    );
    expect(dropIndex).toBeGreaterThan(0);
    const recipient = stream[dropIndex]!.bestiesHitActorId;
    console.log(
      `WO074 struck-actor attribution: accepted attack was aimed at bestie-pink; after the rejected (busy) press bestiesHitActorId=${overwritten}; on the HP-drop frame the renderer received bestiesHitActorId=${recipient}`,
    );
    expect(recipient).toBe("bestie-pink");
    runtime.game.dispose();
  }, 120_000);

  it("keeps the pair defeated after victory and lands aimed hits on a player holding the middle path", async () => {
    const start = await startChapter(harness, 2);
    const level = start.adventure!.activeLevel!;
    const bossId = level.bossId;
    const runtime = mountRuntime(harness, start, frameHook);
    await runtime.advance();
    await runtime.advance();
    const won = await playUntil(
      runtime,
      (save) => save.adventure?.phase === "memory-released",
      { holdZ: -20 },
    );
    expect(won.reason).toBe("done");
    const hits = runtime.actions.filter((action) => action.type === "take-hit");
    const acceptedSequences = new Set(
      runtime.statuses
        .filter((status) => status.attackFeedback?.outcome === "accepted")
        .map((status) => status.attackFeedback!.sequence),
    ).size;
    const bossHits = hits.filter((hit) => hit.z <= -18);
    console.log(
      `WO074 middle-path kid: ${hits.length} take-hit requests (${bossHits.length} on the boss island), player hp ${runtime.latest().adventure?.playerHp}/${runtime.latest().adventure?.maxPlayerHp}, phases seen ${[...new Set(runtime.statuses.map((status) => status.bestiesPhase))].join(",")}, accepted attacks ${acceptedSequences}`,
    );
    expect(hits.length).toBeGreaterThanOrEqual(1);
    const framesAtWin = sceneState.instances[0]!.frames.length;
    for (let frame = 0; frame < 60; frame += 1) await runtime.advance(50);
    // The frame rendered in the same tick as the winning response still shows the
    // pre-victory routine; every later frame must be the defeat.
    const after = sceneState.instances[0]!.frames.slice(framesAtWin + 2);
    expect(after.length).toBeGreaterThanOrEqual(55);
    const bestiesPhases = after.map(
      (frame, index) => `${index}:${frame.besties?.phase ?? "none"}`,
    );
    const enemyPhases = after.map(
      (frame) =>
        frame.enemies.find((enemy) => enemy.id === bossId)?.phase ?? "none",
    );
    console.log(
      `WO074 post-victory renderer stream: besties phases ${[...new Set(after.map((frame) => frame.besties?.phase ?? "none"))].join(",")} (first change at ${bestiesPhases.find((entry) => !entry.endsWith(":defeated")) ?? "never"}); boss enemy phases ${[...new Set(enemyPhases)].join(",")}; adventure phase ${runtime.latest().adventure?.phase}; boss defeated flag ${runtime.latest().adventure?.activeLevel?.encounters.find((enemy) => enemy.id === bossId)?.defeated}`,
    );
    expect(after.every((frame) => frame.besties?.phase === "defeated")).toBe(
      true,
    );
    expect(
      after.every(
        (frame) =>
          frame.enemies.find((enemy) => enemy.id === bossId)?.phase ===
          "defeated",
      ),
    ).toBe(true);
    expect(runtime.errors).toEqual([]);
    runtime.game.dispose();
  }, 120_000);

  it("drops an Attack press silently on the frame a contact pickup is accepted (documents the swallow)", async () => {
    const start = await startChapter(harness, 2);
    const runtime = mountRuntime(harness, start, frameHook);
    await runtime.advance();
    await runtime.advance();
    const pickups = runtime.game.inspect().level.pickupPositions;
    expect(pickups.length).toBeGreaterThan(0);
    const target = [...pickups].sort((a, b) => b.z - a.z)[0]!;
    const trace: Array<{ frame: number; sequence: number; actions: number }> =
      [];
    let collectedAt: number | null = null;
    for (let frame = 0; frame < 900 && collectedAt === null; frame += 1) {
      runtime.game.setInput("attack", true);
      runtime.game.setInput("attack", false);
      const remaining = stepToward(runtime, { x: target.x, z: target.z });
      await runtime.advance(16);
      const status = runtime.game.inspect().status;
      trace.push({
        frame,
        sequence: status.attackFeedback?.sequence ?? 0,
        actions: runtime.actions.length,
      });
      if (runtime.actions.some((action) => action.type === "collect-equipment"))
        collectedAt = frame;
      if (remaining < 0.05 && frame > 200) break;
    }
    expect(collectedAt).not.toBeNull();
    const at = trace[collectedAt!]!;
    const before = trace[collectedAt! - 1]!;
    const beforeThat = trace[collectedAt! - 2]!;
    console.log(
      `WO074 swallow: collect-equipment dispatched on frame ${collectedAt}; attack feedback sequence ${beforeThat.sequence}→${before.sequence}→${at.sequence} across the surrounding frames`,
    );
    // Every other mashed frame produced a "no-target" notice; the contact frame produced none.
    expect(before.sequence).toBeGreaterThan(beforeThat.sequence);
    expect(at.sequence).toBe(before.sequence);
    runtime.game.dispose();
  }, 120_000);
  it("records what happens to a child who stands still on the middle path (hit cost, knockout, retry)", async () => {
    const start = await startChapter(harness, 2);
    const level = start.adventure!.activeLevel!;
    const bossId = level.bossId;
    const runtime = mountRuntime(harness, start, frameHook);
    await runtime.advance();
    await runtime.advance();
    const guestsDone = await playUntil(runtime, (save) =>
      ordinariesDefeated(save),
    );
    expect(guestsDone.reason).toBe("done");
    const inArena = await playUntil(
      runtime,
      (_save, status) => status.position.z <= -20 && status.grounded,
      { holdZ: -20, autoAttack: false },
    );
    expect(inArena.reason).toBe("done");
    const startedAt = harness.clock.now;
    const timeline: string[] = [];
    let retries = 0;
    let lastPhase = "";
    let lastHp = -1;
    for (let frame = 0; frame < 1_500; frame += 1) {
      const status = runtime.game.inspect().status;
      const save = runtime.latest();
      const boss = save.adventure?.activeLevel?.encounters.find(
        (enemy) => enemy.id === bossId,
      );
      const phase = `${status.bestiesPhase}/${status.phase}`;
      if (phase !== lastPhase || status.playerHp !== lastHp) {
        timeline.push(
          `t=${((harness.clock.now - startedAt) / 1000).toFixed(2)}s ${phase} hp=${status.playerHp}/${status.maxPlayerHp} boss=${boss?.hp}/${boss?.maxHp} hits=${runtime.actions.filter((action) => action.type === "take-hit").length} retries=${retries} z=${status.position.z.toFixed(2)}`,
        );
        lastPhase = phase;
        lastHp = status.playerHp;
      }
      if (status.phase === "fallen") {
        runtime.game.performAction({
          type: "retry-level",
          levelId: status.activeLevelId!,
        });
        retries += 1;
        if (retries >= 2) break;
      }
      await runtime.advance(16);
    }
    console.log(
      `WO074 stationary middle-path child (no attacks):\n${timeline.join("\n")}`,
    );
    const hits = runtime.actions.filter(
      (action) => action.type === "take-hit",
    ).length;
    expect(hits).toBeGreaterThanOrEqual(2);
    expect(runtime.errors).toEqual([]);
    runtime.game.dispose();
  }, 120_000);
});
