/**
 * Lockstep Chromium playthrough of a family world template (PLAN-019).
 *
 * For each chapter, the private home's Rat Casino CTA posts a playtest; this
 * script swaps that request for the checked-in family world project and the
 * chapter, so the server validates and freezes the template exactly as it
 * would any editor world (`scope: "chapter"` starts the chapter at its
 * recovered start age with that age's growth moves). Once the chapter is
 * ready the page clock stops and the harness renders one frame at a time.
 *
 * Input is ordinary controls only: the on-screen movement stick, dragged with
 * the mouse (an analog vector, as a finger gives), Space to jump (held to
 * glide, pressed again in the air to double jump), F to attack and Shift for
 * the secondary attack. The harness never teleports the player or edits game
 * state. Before each connection it plans the leg with the kid model's own
 * planner (`planPatientLeg` in `tests/game/family-kid-lib.ts`) from the live
 * game state — waits for sweepers, detours, lift and ferry timing — then
 * executes that plan closed-loop against the live game, re-planning after any
 * fall. It collects both pickups and minor memories, defeats every required
 * ordinary and the boss, and finishes on the major memory. The optional
 * branches and bonus fights are left for players.
 *
 * Lockstep proves route logic, collisions, combat rules and completion under
 * ordinary input on the real client. It is not a frame-time or feel
 * measurement; software WebGL draws a few frames a second.
 *
 * Screenshots: spawn, the first ordinary fight (taken beside the enemy before
 * the first strike), mid-climb, the boss arena (beside the boss) and finish.
 * `QUEST_E2E_UNTIL=first-fight` stops after the first ordinary fight screenshot,
 * before the first strike. `QUEST_E2E_UNTIL=boss-arena` bounds a run to a cast check: each chapter
 * stops once the boss-arena screenshot is taken, and a stop there counts as a
 * pass. `QUEST_E2E_UNTIL=spawn` bounds it to a load check: the chapter stops
 * after its spawn screenshots and `QUEST_E2E_SPAWN_IDLE` seconds standing.
 *
 * Scary moments (DESIGN-027). The harness asserts that each chapter plays at
 * its declared `scare` level (none with `QUEST_E2E_SCARY_MOMENTS=off`, which
 * turns the per-device switch off before the page loads) and records the
 * scare counters and events. On a chapter at level 1 or 2 it also saves
 * `scare-01-dark-room` (at spawn), `scare-02-blackout` (inside the first
 * blackout), `scare-03-watcher-moved` (the first watcher seen again at least
 * 0.3 m from where it spawned) and `scare-04-jump-scare-lunge` (mid-lunge),
 * each with the mean brightness of its central 80%.
 * `QUEST_E2E_JUMP_SCARE=<slot>` forces a jump scare: beside that encounter
 * the player stands still until its attacks knock them out, and at level 2
 * the knockout must become a lunge. `QUEST_E2E_WATCHER_PROBE=1` runs one
 * watcher check on the route: after the first leg that ends on a fixed deck
 * 7 to 18 m from an idle ordinary, it drags the camera (mouse on open canvas)
 * to face that ordinary (`scare-03a-watcher-before`), looks away until it can
 * change, looks back, and saves `scare-03-watcher-moved` once it creaks. The
 * camera then returns exactly to its starting angle, because the stick is
 * camera-relative. `QUEST_E2E_UNTIL=watcher-probe` stops the chapter there.
 *
 *   QUEST_E2E_URL        origin of an ephemeral playtest build (required)
 *   QUEST_E2E_PROJECT    template project (default src/shared/levels/family-world-a-v4.json)
 *   QUEST_E2E_CHAPTERS   comma-separated chapter ids (default: every chapter)
 *   QUEST_E2E_RUN_LABEL  report folder under test-results/family-world (default candidate)
 *   QUEST_E2E_SHOTS      screenshot folder (default the report folder)
 *   QUEST_E2E_SCALE      device scale while playing (default 0.25; screenshots use 1)
 *   QUEST_E2E_VIEWPORT   CSS viewport, e.g. 390x844 for portrait (default 1280x760)
 *   QUEST_E2E_UNTIL      complete (default), first-fight, chase-probe, boss-arena, spawn, watcher-probe or pattern-probe
 *   QUEST_E2E_SPAWN_IDLE seconds of page time to stand at spawn for QUEST_E2E_UNTIL=spawn (default 20)
 *   QUEST_E2E_SCARY_MOMENTS on (default) or off
 *   QUEST_E2E_JUMP_SCARE encounter slot to be knocked out by (default none)
 *   QUEST_E2E_WATCHER_PROBE 1 to run the route watcher check on a scary chapter
 *   QUEST_E2E_FAMILY_CARD synthetic family card label; uses its real published save instead of an editor playtest
 *   QUEST_E2E_FRIENDLY_ASSET exact friendly asset to exercise; requires UNTIL=friendly and FAMILY_CARD
 *   QUEST_E2E_SKIP_DRAW 1 to skip GPU drawing between captures (simulation and input remain unchanged)
 *   QUEST_E2E_EXPECT_DENSE_WORLD 1 to require 12 main-route ordinaries, 4 bonus foes and a four-win boss gate
 *   QUEST_E2E_DEBUG_HEARTBEAT 1 to print support, target, health and nearest foe every 240 stepped frames
 *   QUEST_E2E_DEBUG_WALL_SECONDS optional per-chapter diagnostic wall limit (0 means no limit)
 *   QUEST_E2E_REALTIME_SAMPLE 1 to sample real frame intervals, draw calls and loaded assets at spawn;
 *     with UNTIL=first-fight or chase-probe also sample beside the first ordinary
 *
 *   pnpm build && QUEST_EPHEMERAL_PLAYTEST=true QUEST_FIXTURE_MODE=true \
 *     NODE_ENV=development BETTER_AUTH_SECRET=... QUEST_APP_ORIGIN=http://127.0.0.1:3000 \
 *     node dist/server/index.js
 *   QUEST_E2E_URL=http://127.0.0.1:3000 pnpm exec tsx tests/e2e/family-world-lockstep.ts
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type CDPSession, type Page } from "playwright";
import sharp from "sharp";
import { abilitiesForAge, growthMovesFrom, type AbilitySet } from "../../src/shared/abilities";
import type { FriendlyView } from "../../src/shared/contracts";
import type {
  AuthoredAnchor,
  AuthoredConnection,
  AuthoredEncounterAnchor,
  ResolvedAuthoredLevel,
} from "../../src/shared/authored-level";
import {
  resolveLevelEditorProject,
  type LevelEditorChapterV2,
  type LevelEditorProjectV2,
} from "../../src/shared/editor-project";
import type { ObbyPlatform } from "../../src/game/obby";
import {
  connectionAim,
  edgeEntry,
  FRAME_SECONDS,
  jumpsAcross,
  sampledPlatform,
  type AppearanceStage,
} from "../game/authored-traversal-lib";
import {
  createGrowthSimulation,
  growthStep,
  motionCycleSeconds,
  type RouteLegPlan,
} from "../game/growth-traversal-lib";
import { planPatientLeg } from "../game/family-kid-lib";

const url = process.env.QUEST_E2E_URL;
assert.ok(url, "QUEST_E2E_URL is required; never test a stale implicit server");
const runLabel = process.env.QUEST_E2E_RUN_LABEL ?? "candidate";
const projectPath = resolve(process.env.QUEST_E2E_PROJECT ?? "src/shared/levels/family-world-a-v4.json");
const reportDirectory = resolve(`test-results/family-world-lockstep/${runLabel}`);
const shotDirectory = resolve(process.env.QUEST_E2E_SHOTS ?? reportDirectory);
const playScale = Number(process.env.QUEST_E2E_SCALE ?? 0.25);
assert.ok(playScale >= 0.1 && playScale <= 1, "QUEST_E2E_SCALE must be 0.1 to 1");
const until = process.env.QUEST_E2E_UNTIL ?? "complete";
assert.ok(
  ["complete", "first-fight", "chase-probe", "boss-arena", "spawn", "watcher-probe", "friendly", "pattern-probe", "combo-probe"].includes(until),
  "QUEST_E2E_UNTIL must be complete, first-fight, chase-probe, boss-arena, spawn, watcher-probe or friendly",
);
const familyCard = process.env.QUEST_E2E_FAMILY_CARD ?? "";
const friendlyAsset = process.env.QUEST_E2E_FRIENDLY_ASSET ?? "";
const skipDraw = process.env.QUEST_E2E_SKIP_DRAW === "1";
const debugHeartbeat = process.env.QUEST_E2E_DEBUG_HEARTBEAT === "1";
const debugWallLimitMs = Number(process.env.QUEST_E2E_DEBUG_WALL_SECONDS ?? 0) * 1_000;
assert.ok(Number.isFinite(debugWallLimitMs) && debugWallLimitMs >= 0,
  "QUEST_E2E_DEBUG_WALL_SECONDS must be a nonnegative number");
const expectDenseWorld = process.env.QUEST_E2E_EXPECT_DENSE_WORLD === "1";
const realtimeSample = process.env.QUEST_E2E_REALTIME_SAMPLE === "1";
assert.ok(!realtimeSample || !skipDraw, "real-time sampling requires normal GPU drawing");
assert.ok(until !== "friendly" || (familyCard && friendlyAsset), "friendly checks require a synthetic family card and exact asset");
const spawnIdleSeconds = Number(process.env.QUEST_E2E_SPAWN_IDLE ?? 20);
assert.ok(spawnIdleSeconds >= 0 && spawnIdleSeconds <= 300, "QUEST_E2E_SPAWN_IDLE must be 0 to 300");
const scaryMoments = process.env.QUEST_E2E_SCARY_MOMENTS ?? "on";
assert.ok(scaryMoments === "on" || scaryMoments === "off", "QUEST_E2E_SCARY_MOMENTS must be on or off");
const jumpScareSlot = process.env.QUEST_E2E_JUMP_SCARE ?? "";
const watcherProbe = process.env.QUEST_E2E_WATCHER_PROBE === "1" || until === "watcher-probe";
const patternProbe = until === "pattern-probe";
const comboProbe = until === "combo-probe";
const patternAction = process.env.QUEST_E2E_PATTERN_ACTION ?? "hit";
assert.ok(["hit", "jump", "sidestep", "combo"].includes(patternAction), "invalid pattern action");
/** `Scene.adjustCamera`: a mouse drag turns the camera yaw by -0.006 rad per CSS pixel. */
const CAMERA_YAW_PER_PIXEL = 0.006;

/** Thrown where a bounded run stops on purpose (`QUEST_E2E_UNTIL`). */
class StopAt extends Error {
  constructor(readonly at: string) {
    super(`stopped at ${at}`);
  }
}
await mkdir(reportDirectory, { recursive: true });
await mkdir(shotDirectory, { recursive: true });

const project = JSON.parse(await readFile(projectPath, "utf8")) as LevelEditorProjectV2;
const { levels } = resolveLevelEditorProject(project);
const chapters = project.chapters as readonly LevelEditorChapterV2[];
const requested = (process.env.QUEST_E2E_CHAPTERS ?? "").split(",").filter(Boolean);
const selected = requested.length ? chapters.filter((entry) => requested.includes(entry.chapterId)) : chapters;
assert.equal(selected.length, requested.length || chapters.length, "unknown chapter requested");
assert.ok(!familyCard || selected.length === 1, "a synthetic family checkpoint selects exactly one chapter");

const viewportMatch = /^(\d+)x(\d+)$/.exec(process.env.QUEST_E2E_VIEWPORT ?? "1280x760");
assert.ok(viewportMatch, "QUEST_E2E_VIEWPORT must be WIDTHxHEIGHT");
let VIEWPORT = { width: Number(viewportMatch[1]), height: Number(viewportMatch[2]) };
assert.ok(VIEWPORT.width >= 320 && VIEWPORT.height >= 568, "QUEST_E2E_VIEWPORT is too small for the game");
const FINE_MS = 16;
const CRUISE_MS = 48;
const IDLE_MS = 192;
const ACTIVE_PHASES = new Set(["exploring", "memory-released"]);
/** A pad launches at 7.5 or 9 m/s; the fastest jump is 5.9 m/s. */
const PAD_LAUNCH_SPEED = 6.6;
/** Stick drag radius in CSS pixels, beyond the stick's travel so the vector is full strength. */
const STICK_REACH = 90;

type Point = { x: number; z: number };

/** DESIGN-027 runtime state, flattened from `GameInspection.scare`. */
interface LiveScare {
  level: number;
  flicker: number;
  blackout: number;
  blackoutElapsed: number | null;
  lunge: { encounterId: string; progress: number } | null;
  blackouts: number;
  flickers: number;
  watcherMoves: number;
  watcherCreaks: number;
  lastWatcherCreakIds: string[];
  jumpScares: number;
}

interface LiveEncounter {
  id: string;
  role: string;
  kind: string;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  z: number;
  /** Heading and watcher idle pose from the enemy frames, where the game reports them. */
  facing: number | null;
  pose: number | null;
  /** The local enemy phase (idle, chase, windup …), where the game reports it. */
  phase: string | null;
  attackPattern?: "charge" | "bolt" | "agile";
  windupProgress?: number;
  attackTarget?: { x: number; y: number; z: number };
  projectile?: { x: number; y: number; z: number };
}

interface Live {
  position: { x: number; y: number; z: number };
  grounded: boolean;
  phase: string;
  playerHp: number;
  nearEncounterId: string | null;
  nearFriendlyId: string | null;
  attackReady: boolean;
  guardReady: boolean;
  requestBusy: boolean;
  growthMoves: string[];
  stage: AppearanceStage;
  ageYears: number;
  mediaLoading: number;
  mediaFailed: number;
  routeId: string | null;
  time: number;
  supportId: string | null;
  recoveries: number;
  input: { moveX: number; moveY: number };
  encounters: LiveEncounter[];
  memories: Array<{ id: string; state: string; x: number; y: number; z: number }>;
  pickups: Array<{ id: string; kind: string; collected: boolean; x: number; y: number; z: number }>;
  friendlies: Array<{ id: string; assetId: string; x: number; y: number; z: number }>;
  /** Null on a chapter playing at scare level 0. */
  scare: LiveScare | null;
}

/** The inspection fields this harness reads (src/game/types.ts GameInspection). */
interface PageInspection {
  status: {
    position: Live["position"];
    grounded: boolean;
    phase: string;
    playerHp: number;
    nearEncounterId: string | null;
    nearFriendlyId?: string | null;
    attackReady: boolean;
    guardReady: boolean;
    requestBusy: boolean;
    growthMoves?: string[];
    appearanceStage: AppearanceStage;
    ageYears: number;
    mediaLoading: number;
    mediaFailed: number;
  };
  input: Live["input"];
  enemies?: Array<{ id: string; facing: number; pose?: number; attackPattern?: LiveEncounter["attackPattern"]; windupProgress: number; attackTarget?: LiveEncounter["attackTarget"]; projectile?: LiveEncounter["projectile"] }>;
  level: {
    authored?: { id: string };
    encounterPositions: Array<Omit<LiveEncounter, "facing" | "pose" | "phase"> & { localPhase?: string }>;
    memoryPositions: Live["memories"];
    pickupPositions: Live["pickups"];
    friendlyPositions?: Live["friendlies"];
  };
  obby?: { timeSeconds: number; supportId: string | null; recoveries: number };
  scare?: {
    level: number;
    lighting: { flicker: number; blackout: number; blackoutElapsed: number | null };
    lunge: { encounterId: string; progress: number } | null;
    blackouts: number;
    flickers: number;
    watcherMoves: number;
    watcherCreaks?: number;
    lastWatcherCreakIds?: string[];
    jumpScares: number;
  };
}

/** The parts of a save view the report records. */
interface SaveLike {
  id: string;
  revision: number;
  ageYears: number;
  recoveredIds?: string[];
  adventure?: {
    phase?: string;
    currentLevelId?: string;
    completedLevelIds?: string[];
    playerHp?: number;
    maxPlayerHp?: number;
    attackComboStep?: 1 | 2 | 3;
    activeLevel?: {
      encounters?: Array<{ id: string; role: string; hp?: number; content?: { assetId?: string; placeholder?: string } }>;
      friendlies?: FriendlyView[];
    };
  };
}

/** Runs in the page: finds the game handle behind the canvas and returns a slim inspection. */
function inspectInPage(draw: boolean): Live | null {
  const canvas = document.querySelector("canvas[data-quest-canvas=true]") as HTMLCanvasElement | null;
  if (!canvas) return null;
  if (draw) {
    // Reading one pixel waits until the software renderer has drawn the frame.
    const gl = canvas.getContext("webgl2");
    if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  }
  // React internals: the canvas's fiber leads to the GameScreen ref holding the handle.
  type Hook = { memoizedState?: { current?: { inspect?: () => unknown } }; next?: Hook };
  type Fiber = { memoizedState?: Hook; return?: Fiber | null };
  let element: Element | null = canvas;
  let fiber: Fiber | null = null;
  while (element && !fiber) {
    const key = Object.keys(element).find((name) => name.startsWith("__reactFiber$"));
    fiber = key ? (element as unknown as Record<string, Fiber>)[key] ?? null : null;
    element = element.parentElement;
  }
  // No named helper functions in here: the page receives this function's
  // source, and a transpiler may wrap named functions in helpers the page
  // does not have.
  let inspection: PageInspection | null = null;
  for (let node = fiber; node && !inspection; node = node.return ?? null)
    for (let hook = node.memoizedState; hook && !inspection; hook = hook.next) {
      const candidate = hook.memoizedState?.current;
      if (candidate && typeof candidate.inspect === "function") inspection = candidate.inspect() as PageInspection;
    }
  if (!inspection) return null;
  const { status, level, obby, scare } = inspection;
  const frames = inspection.enemies ?? [];
  return {
    position: status.position,
    grounded: status.grounded,
    phase: status.phase,
    playerHp: status.playerHp,
    nearEncounterId: status.nearEncounterId,
    nearFriendlyId: status.nearFriendlyId ?? null,
    attackReady: status.attackReady,
    guardReady: status.guardReady,
    requestBusy: status.requestBusy,
    growthMoves: status.growthMoves ?? ["jump"],
    stage: status.appearanceStage,
    ageYears: status.ageYears,
    mediaLoading: status.mediaLoading,
    mediaFailed: status.mediaFailed,
    routeId: level.authored?.id ?? null,
    time: obby?.timeSeconds ?? 0,
    supportId: obby?.supportId ?? null,
    recoveries: obby?.recoveries ?? 0,
    input: { moveX: inspection.input.moveX, moveY: inspection.input.moveY },
    encounters: level.encounterPositions.map((entry) => ({
      id: entry.id,
      role: entry.role,
      kind: entry.kind,
      hp: entry.hp,
      maxHp: entry.maxHp,
      x: entry.x,
      y: entry.y,
      z: entry.z,
      facing: frames.find((frame) => frame.id === entry.id)?.facing ?? null,
      pose: frames.find((frame) => frame.id === entry.id)?.pose ?? null,
      phase: entry.localPhase ?? null,
      attackPattern: frames.find((frame) => frame.id === entry.id)?.attackPattern,
      windupProgress: frames.find((frame) => frame.id === entry.id)?.windupProgress,
      attackTarget: frames.find((frame) => frame.id === entry.id)?.attackTarget,
      projectile: frames.find((frame) => frame.id === entry.id)?.projectile,
    })),
    memories: level.memoryPositions.map((entry) => ({
      id: entry.id,
      state: entry.state,
      x: entry.x,
      y: entry.y,
      z: entry.z,
    })),
    pickups: level.pickupPositions.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      collected: entry.collected,
      x: entry.x,
      y: entry.y,
      z: entry.z,
    })),
    friendlies: level.friendlyPositions ?? [],
    scare: scare
      ? {
          level: scare.level,
          flicker: scare.lighting.flicker,
          blackout: scare.lighting.blackout,
          blackoutElapsed: scare.lighting.blackoutElapsed,
          lunge: scare.lunge ? { encounterId: scare.lunge.encounterId, progress: scare.lunge.progress } : null,
          blackouts: scare.blackouts,
          flickers: scare.flickers,
          watcherMoves: scare.watcherMoves,
          watcherCreaks: scare.watcherCreaks ?? 0,
          lastWatcherCreakIds: scare.lastWatcherCreakIds ?? [],
          jumpScares: scare.jumpScares,
        }
      : null,
  };
}

const planar = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

interface FrameStats {
  frames: number;
  fineFrames: number;
  pageMs: number;
  wallMs: number;
}

/** The page, its clock, its stick and keyboard, one rendered frame at a time. */
class LockstepGame {
  live!: Live;
  combatKnockouts = 0;
  debugLeg: string | null = null;
  debugTarget: Point | null = null;
  private readonly startedWall = Date.now();
  /** Vertical speed over the last frame, from the feet position. */
  verticalSpeed = 0;
  readonly stats: FrameStats = { frames: 0, fineFrames: 0, pageMs: 0, wallMs: 0 };
  private stickCenter: Point | null = null;
  private stickTarget: Point | null = null;
  private intended: { moveX: number; moveY: number } = { moveX: 0, moveY: 0 };
  private mismatches = 0;
  private jiggle = 0;
  private readonly held = new Set<string>();
  private lastRealStrike = 0;
  /**
   * Runs after every frame the pilot steps (never inside itself, so a
   * screenshot it takes does not re-enter it).
   */
  onFrame: ((live: Live) => Promise<void>) | null = null;
  private inFrameHook = false;

  constructor(
    readonly page: Page,
    private readonly cdp: CDPSession,
  ) {}

  async read(draw = false): Promise<Live> {
    const live = await this.page.evaluate(inspectInPage, draw);
    assert.ok(live, "game inspection unavailable");
    this.live = live;
    return live;
  }

  /** Stops page time once the chapter is ready. */
  async pause(): Promise<void> {
    for (let attempt = 1; ; attempt += 1) {
      const now = await this.page.evaluate(() => Date.now());
      try {
        await this.page.clock.pauseAt(now + 2_000 * attempt);
        break;
      } catch (error) {
        if (attempt >= 3 || !/past/i.test(String((error as Error)?.message))) throw error;
      }
    }
    await this.step(FINE_MS);
  }

  async step(milliseconds: number): Promise<Live> {
    assert.ok(milliseconds % FINE_MS === 0 && milliseconds >= FINE_MS);
    const started = Date.now();
    const previous = this.live;
    const previousY = previous?.position.y ?? null;
    if (milliseconds === FINE_MS) await this.page.clock.runFor(milliseconds);
    else await this.page.clock.fastForward(milliseconds);
    const live = await this.read(true);
    if (previous && live.time < previous.time - 0.5 && live.recoveries === previous.recoveries)
      this.combatKnockouts += 1;
    this.stats.frames += 1;
    if (milliseconds === FINE_MS) this.stats.fineFrames += 1;
    this.stats.pageMs += milliseconds;
    this.stats.wallMs += Date.now() - started;
    if (debugHeartbeat && this.stats.frames % 240 === 0) {
      const near = [...live.encounters]
        .sort((left, right) => planar(left, live.position) - planar(right, live.position))[0];
      console.log(`[debug] ${JSON.stringify({ frames: this.stats.frames, pageTime: live.time,
        leg: this.debugLeg, target: this.debugTarget, position: live.position,
        supportId: live.supportId, phase: live.phase, hp: live.playerHp,
        recoveries: live.recoveries, input: live.input,
        nearestEnemy: near ? { id: near.id, hp: near.hp, distance: Number(planar(near, live.position).toFixed(2)) } : null })}`);
    }
    if (debugWallLimitMs > 0 && Date.now() - this.startedWall > debugWallLimitMs)
      throw new Error(`diagnostic wall limit reached after ${this.stats.frames} frames on ${this.debugLeg}: ${JSON.stringify({
        target: this.debugTarget, position: live.position, supportId: live.supportId,
        phase: live.phase, hp: live.playerHp, recoveries: live.recoveries, input: live.input,
      })}`);
    this.verticalSpeed = previousY === null ? 0 : (live.position.y - previousY) / (milliseconds / 1_000);
    // A pause or a fall clears held game input; the stick must send it again.
    const active = ACTIVE_PHASES.has(live.phase);
    const wanted = Math.hypot(this.intended.moveX, this.intended.moveY) > 0;
    if (
      active &&
      wanted &&
      (Math.abs(live.input.moveX - this.intended.moveX) > 0.08 ||
        Math.abs(live.input.moveY - this.intended.moveY) > 0.08)
    )
      this.mismatches += 1;
    else this.mismatches = 0;
    if (this.onFrame && !this.inFrameHook) {
      this.inFrameHook = true;
      try {
        await this.onFrame(live);
      } finally {
        this.inFrameHook = false;
      }
    }
    return this.live;
  }

  private async grabStick(): Promise<void> {
    const box = await this.page.getByTestId("joystick").boundingBox();
    assert.ok(box, "movement stick unavailable");
    this.stickCenter = { x: box.x + box.width / 2, z: box.y + box.height / 2 };
    await this.page.mouse.up().catch(() => undefined);
    await this.page.mouse.move(this.stickCenter.x, this.stickCenter.z);
    await this.page.mouse.down();
    this.stickTarget = { ...this.stickCenter };
  }

  /** Drags the on-screen stick: a unit vector (moveY 1 is forward, -z) or zero. */
  async move(moveX: number, moveY: number): Promise<void> {
    if (!this.stickCenter || this.mismatches >= 2) {
      await this.grabStick();
      this.mismatches = 0;
    }
    const magnitude = Math.hypot(moveX, moveY);
    this.intended = magnitude > 0 ? { moveX: moveX / magnitude, moveY: moveY / magnitude } : { moveX: 0, moveY: 0 };
    const center = this.stickCenter!;
    const target =
      magnitude > 0
        ? { x: center.x + this.intended.moveX * STICK_REACH, z: center.z - this.intended.moveY * STICK_REACH }
        : { ...center };
    const resend = this.mismatches === 1;
    if (!resend && this.stickTarget && planar(target, this.stickTarget) < 0.2) return;
    // A re-send moves a hair so the stick reports a fresh pointer position.
    this.jiggle = resend ? (this.jiggle === 0 ? 0.5 : 0) : 0;
    await this.page.mouse.move(target.x + this.jiggle, target.z);
    this.stickTarget = target;
  }

  /** Lets go of the movement stick; the next `move` grabs it again. */
  async releaseStick(): Promise<void> {
    await this.page.mouse.up().catch(() => undefined);
    this.stickCenter = null;
    this.stickTarget = null;
    this.intended = { moveX: 0, moveY: 0 };
  }

  /**
   * Turns the camera by dragging the mouse `dx` CSS pixels across open canvas
   * above the player, then renders a frame. Whole-pixel moves add up exactly,
   * so an equal and opposite drag restores the angle.
   */
  async dragCamera(dx: number): Promise<void> {
    if (dx === 0) return;
    await this.releaseStick();
    const start = { x: Math.round(VIEWPORT.width / 2), y: Math.round(VIEWPORT.height * 0.35) };
    await this.page.mouse.move(start.x, start.y);
    await this.page.mouse.down();
    const steps = Math.max(1, Math.ceil(Math.abs(dx) / 40));
    for (let index = 1; index <= steps; index += 1)
      await this.page.mouse.move(start.x + Math.round((dx * index) / steps), start.y);
    await this.page.mouse.up();
    await this.step(FINE_MS);
  }

  async press(key: string): Promise<void> {
    // The server clock stays real when the page clock advances faster.
    if (skipDraw && (key === "f" || key === "Shift")) {
      const remaining = this.lastRealStrike + 1_100 - Date.now();
      if (remaining > 0) await new Promise((wait) => setTimeout(wait, remaining));
      this.lastRealStrike = Date.now();
    }
    await this.page.keyboard.press(key);
  }

  async hold(key: string, down: boolean): Promise<void> {
    if (down && !this.held.has(key)) {
      await this.page.keyboard.down(key);
      this.held.add(key);
    } else if (!down && this.held.has(key)) {
      await this.page.keyboard.up(key);
      this.held.delete(key);
    }
  }

  /**
   * A full-resolution screenshot: device scale 1 for one frame, then back.
   * It captures through CDP, because `page.screenshot()` re-applies the
   * context's play scale and would return a quarter-size image.
   */
  async screenshot(path: string): Promise<void> {
    if (skipDraw) await this.page.evaluate("globalThis.__questSkipDraw=false");
    const metrics = (scale: number) =>
      this.cdp.send("Emulation.setDeviceMetricsOverride", { ...VIEWPORT, deviceScaleFactor: scale, mobile: false });
    await metrics(1);
    await this.page.evaluate(() => window.dispatchEvent(new Event("resize")));
    let best: Buffer | null = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await this.step(FINE_MS);
      const { data } = await this.cdp.send("Page.captureScreenshot", { format: "png" });
      const image = Buffer.from(data, "base64");
      if (!best || image.length > best.length) best = image;
      if (image.length > 120_000) break;
    }
    await writeFile(path, best!);
    await metrics(playScale);
    await this.page.evaluate(() => window.dispatchEvent(new Event("resize")));
    if (skipDraw) await this.page.evaluate("globalThis.__questSkipDraw=true");
  }
}

interface LegRecord {
  leg: string;
  attempt: number;
  mode: string;
  requires?: string;
  planned: string;
  ok: boolean;
}

interface LoadedModel {
  path: string;
  bytes: number;
  sha256: string;
  durationMs: number;
}

interface RealtimeSample {
  warmupAfterAssetsMs: number;
  durationMs: number;
  frames: number;
  meanFrameMs: number;
  p95FrameMs: number;
  fps: number;
  meanDrawCalls: number;
  p95DrawCalls: number;
  totalDrawCalls: number;
  meanTriangles: number;
  p95Triangles: number;
  totalTriangles: number;
  loadedModels: LoadedModel[];
  renderer: string;
  viewport: { width: number; height: number; deviceScaleFactor: number };
  deviceEvidence: false;
}

interface ChaseProbe {
  slot: string;
  encounterId: string;
  arenaExitMeters: number;
  enemyMovedMeters: number;
  sameFloorSamples: number;
  playerStayedOnDeck: boolean;
  gapRecovery: boolean;
  enemyStayedOnFloor: boolean;
  playerHpAfter: number;
}

/** Measure only while page time flows normally; a paused clock cannot provide frame evidence. */
async function sampleRealtime(
  page: Page,
  loadedModels: LoadedModel[],
  assetsReadyAt: number,
): Promise<RealtimeSample> {
  const remainingWarmup = 3_000 - (Date.now() - assetsReadyAt);
  if (remainingWarmup > 0) await new Promise((wait) => setTimeout(wait, remainingWarmup));
  const warmupAfterAssetsMs = Date.now() - assetsReadyAt;
  const measured = await page.evaluate(`new Promise((resolveSample) => {
    const drawCounter = window;
    const intervals = [];
    const calls = [];
    const triangles = [];
    let lastTime = 0;
    let lastCalls = drawCounter.__questDrawCalls || 0;
    let lastTriangles = drawCounter.__questDrawTriangles || 0;
    const started = performance.now();
    const frame = (time) => {
      if (lastTime > 0) {
        intervals.push(time - lastTime);
        const count = drawCounter.__questDrawCalls || 0;
        calls.push(count - lastCalls);
        lastCalls = count;
        const triangleCount = drawCounter.__questDrawTriangles || 0;
        triangles.push(triangleCount - lastTriangles);
        lastTriangles = triangleCount;
      }
      lastTime = time;
      if (time - started < 5000) {
        requestAnimationFrame(frame);
        return;
      }
      const canvas = document.querySelector('canvas[data-quest-canvas=true]');
      const gl = canvas && (canvas.getContext('webgl2') || canvas.getContext('webgl'));
      const debug = gl && gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable';
      resolveSample({ intervals, calls, triangles, renderer });
    };
    requestAnimationFrame(frame);
  })`) as {
    intervals: number[];
    calls: number[];
    triangles: number[];
    renderer: string;
  };
  assert.ok(measured.intervals.length >= 10, "too few real-time frames for a sample");
  const mean = measured.intervals.reduce((sum, value) => sum + value, 0) / measured.intervals.length;
  const sortedIntervals = [...measured.intervals].sort((a, b) => a - b);
  const sortedCalls = [...measured.calls].sort((a, b) => a - b);
  const sortedTriangles = [...measured.triangles].sort((a, b) => a - b);
  const sumCalls = measured.calls.reduce((sum, value) => sum + value, 0);
  const sumTriangles = measured.triangles.reduce((sum, value) => sum + value, 0);
  const p95 = (values: number[]) => values[Math.min(values.length - 1, Math.floor(values.length * 0.95))]!;
  return {
    warmupAfterAssetsMs,
    durationMs: Number(measured.intervals.reduce((sum, value) => sum + value, 0).toFixed(1)),
    frames: measured.intervals.length,
    meanFrameMs: Number(mean.toFixed(2)),
    p95FrameMs: Number(p95(sortedIntervals).toFixed(2)),
    fps: Number((1_000 / mean).toFixed(1)),
    meanDrawCalls: Number((sumCalls / measured.calls.length).toFixed(1)),
    p95DrawCalls: p95(sortedCalls),
    totalDrawCalls: sumCalls,
    meanTriangles: Math.round(sumTriangles / measured.triangles.length),
    p95Triangles: p95(sortedTriangles),
    totalTriangles: sumTriangles,
    loadedModels,
    renderer: measured.renderer,
    viewport: { ...VIEWPORT, deviceScaleFactor: playScale },
    deviceEvidence: false,
  };
}

/** Pursue on the connected deck, then escape over a side gap using the normal stick. */
async function probeRealtimeChase(
  game: LockstepGame,
  level: ResolvedAuthoredLevel,
  slot: string,
  anchor: AuthoredEncounterAnchor,
  encounterId: string,
): Promise<ChaseProbe> {
  await game.releaseStick();
  // The route may have skipped draws to save software-rendering time; the
  // real-time chase itself must render normally.
  await game.page.evaluate("globalThis.__questSkipDraw=false");
  await game.page.clock.resume();
  const start = await game.read();
  const firstEnemy = start.encounters.find((entry) => entry.id === encounterId);
  assert.ok(firstEnemy && firstEnemy.hp > 0, `${slot}: chase foe is unavailable`);
  assert.equal(start.supportId, anchor.platformId, `${slot}: player is not on the chase deck`);
  const deck = sampledPlatform(level.course, anchor.platformId, start.time);
  const inset = 1.15;
  const minX = deck.center.x - deck.size.x / 2 + inset;
  const maxX = deck.center.x + deck.size.x / 2 - inset;
  const minZ = deck.center.z - deck.size.z / 2 + inset;
  const maxZ = deck.center.z + deck.size.z / 2 - inset;
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const outside = (point: Point) => Math.max(
    anchor.arena.minX - point.x,
    point.x - anchor.arena.maxX,
    anchor.arena.minZ - point.z,
    point.z - anchor.arena.maxZ,
    0,
  );
  const candidates = [
    { x: minX, z: clamp(start.position.z, minZ, maxZ) },
    { x: maxX, z: clamp(start.position.z, minZ, maxZ) },
    { x: clamp(start.position.x, minX, maxX), z: minZ },
    { x: clamp(start.position.x, minX, maxX), z: maxZ },
  ].filter((point) => outside(point) >= 1.6 && planar(point, start.position) >= 1);
  assert.ok(candidates.length > 0, `${slot}: no safe same-floor retreat outside the arena`);
  const retreat = candidates.sort((left, right) =>
    planar(left, start.position) - planar(right, start.position))[0]!;
  const trace: Live[] = [];
  const sleep = (ms: number) => new Promise((wait) => setTimeout(wait, ms));
  const steer = async (target: Point, milliseconds: number, done: (live: Live) => boolean) => {
    const deadline = Date.now() + milliseconds;
    while (Date.now() < deadline) {
      const live = await game.read();
      trace.push(live);
      if (done(live)) break;
      const distance = planar(live.position, target);
      if (distance > 0.15)
        await game.move((target.x - live.position.x) / distance, -(target.z - live.position.z) / distance);
      else await game.move(0, 0);
      await sleep(120);
    }
    await game.releaseStick();
  };
  await steer(retreat, 4_000, (live) => planar(live.position, retreat) < 0.6 || live.supportId !== anchor.platformId);
  await sleep(1_000);
  const chased = await game.read();
  trace.push(chased);
  const foe = chased.encounters.find((entry) => entry.id === encounterId)!;
  const arenaExitMeters = Math.max(...trace.map((live) =>
    outside(live.encounters.find((entry) => entry.id === encounterId)!)));
  const enemyMovedMeters = planar(firstEnemy, foe);
  assert.equal(chased.supportId, anchor.platformId, `${slot}: player did not stay on the connected chase deck`);
  assert.equal(chased.recoveries, start.recoveries, `${slot}: player fell during the same-floor retreat`);
  assert.ok(enemyMovedMeters >= 0.4, `${slot}: enemy did not pursue in real time`);
  assert.ok(arenaExitMeters >= 0.25, `${slot}: enemy remained confined to its spawn arena`);
  const sameFloorSamples = trace.filter((live) =>
    Math.abs(live.encounters.find((entry) => entry.id === encounterId)!.y - anchor.position.y) <= 0.35).length;
  assert.equal(sameFloorSamples, trace.length, `${slot}: enemy changed floors while pursuing`);

  // Step off the deck's side into open space. The checkpoint should recover
  // the player while the ordinary stays on its original walkable floor.
  const leftDistance = chased.position.x - minX;
  const rightDistance = maxX - chased.position.x;
  const side = leftDistance <= rightDistance ? -1 : 1;
  const gap = { x: deck.center.x + side * (deck.size.x / 2 + 6), z: chased.position.z };
  const recoveriesBefore = chased.recoveries;
  await steer(gap, 7_000, (live) => live.recoveries > recoveriesBefore);
  for (let attempt = 0; attempt < 30 && game.live.recoveries === recoveriesBefore; attempt += 1) {
    await sleep(200);
    trace.push(await game.read());
  }
  const gapRecovery = game.live.recoveries > recoveriesBefore;
  assert.ok(gapRecovery, `${slot}: the side-gap escape did not recover at a checkpoint (${JSON.stringify({
    start: chased.position,
    end: game.live.position,
    supportId: game.live.supportId,
    phase: game.live.phase,
    hp: game.live.playerHp,
    recoveries: game.live.recoveries,
    minX: Math.min(...trace.map((live) => live.position.x)),
    maxX: Math.max(...trace.map((live) => live.position.x)),
  })})`);
  const enemyStayedOnFloor = trace.every((live) => {
    const enemy = live.encounters.find((entry) => entry.id === encounterId);
    return enemy && Math.abs(enemy.y - anchor.position.y) <= 0.35;
  });
  assert.ok(enemyStayedOnFloor, `${slot}: enemy crossed the side gap or changed floors`);
  return {
    slot,
    encounterId,
    arenaExitMeters: Number(arenaExitMeters.toFixed(2)),
    enemyMovedMeters: Number(enemyMovedMeters.toFixed(2)),
    sameFloorSamples,
    playerStayedOnDeck: true,
    gapRecovery,
    enemyStayedOnFloor,
    playerHpAfter: game.live.playerHp,
  };
}

interface ChapterReport {
  chapterId: string;
  routeId: string;
  name: string;
  theme: string;
  startAge: number;
  growthMoves: string[];
  appearanceStage: string;
  mediaFailed: number;
  identities: Array<{ id: string; role: string; asset: string | null }>;
  legs: LegRecord[];
  recoveries: number;
  combatKnockouts: number;
  routeBlockers: Array<{ id: string; leg: string | null; action: "attack" | "bash"; time: number }>;
  fights: Array<{ slot: string; encounterId: string; role: string; attacks: number; bashes: number; defeats: number }>;
  pickups: string[];
  memories: Array<{ slot: string; id: string }>;
  completed: boolean;
  /** Set when a bounded run stopped on purpose (`QUEST_E2E_UNTIL`). */
  stoppedAt: string | null;
  completion: Record<string, unknown> | null;
  screenshots: string[];
  frames: FrameStats | null;
  pageErrors: string[];
  consoleErrors: string[];
  responseErrors: string[];
  media: Record<string, number>;
  assetLoads: LoadedModel[];
  frozenProject?: { projectId: string; revision: number; fingerprint: string; schemaVersion: string; theme: string; decorCount: number };
  realtime?: { spawn: RealtimeSample; firstFight?: RealtimeSample };
  portraitLayout?: { viewport: { width: number; height: number }; controls: Record<string, { x: number; y: number; width: number; height: number }>; scrollWidth: number };
  chase?: ChaseProbe;
  friendly?: Record<string, unknown>;
  patternProbe?: {
    target: { slot: string; id: string; pattern: string };
    action: string;
    events: Array<{ time: number; phase: string | null; progress: number | null; target: LiveEncounter["attackTarget"]; projectile: LiveEncounter["projectile"]; playerHp: number; player: Live["position"] }>;
    screenshots: string[];
    actions: Array<{ type: string; encounterId: string | null; playerHp: number | null; encounterHp: number | null; comboStep: number | null }>;
    playerHpAtStart: number;
    playerHpAtEnd: number | null;
    retreat?: { startGap: number; endGap: number; playerTravel: number; enemyTravel: number; startPhase: string | null; endPhase: string | null };
    resolution?: { startHp: number; endHp: number; firstWarning: number; finalPhase: string | null; jumpUsed: boolean; sidestepUsed: boolean };
  };
  comboProbe?: {
    actions: Array<{ type: string; encounterId: string | null; playerHp: number | null; encounterHp: number | null; comboStep: number | null }>;
    confirmed: boolean;
    screenshots: string[];
  };
  drawingBetweenCaptures?: boolean;
  /** DESIGN-027: the declared and live scare levels, counters, events and scare screenshots. */
  scare: {
    declared: number;
    expected: number;
    live: number;
    blackouts: number;
    flickers: number;
    watcherMoves: number;
    watcherCreaks: number;
    jumpScares: number;
    events: Array<{ event: string; time: number } & Record<string, unknown>>;
    closestSpots: Record<string, { distance: number; time: number; position: Live["position"]; grounded: boolean; supportId: string | null }>;
    shots: Record<string, { file: string; luma: number; time: number }>;
  };
  wallSeconds: number;
  failure: string | null;
}

/** Plays one chapter's required route with ordinary controls. */
class ChapterPilot {
  private readonly course: ResolvedAuthoredLevel["course"];
  private readonly platforms: Map<string, ObbyPlatform>;
  private readonly mainIndex: Map<string, number>;
  /** Runs after each leg `reach` completes, standing on its landing. */
  afterLeg: (() => Promise<void>) | null = null;
  onBlockedEncounter: ((encounterId: string) => Promise<void>) | null = null;

  constructor(
    private readonly game: LockstepGame,
    private readonly level: ResolvedAuthoredLevel,
    private readonly chapter: LevelEditorChapterV2,
    private readonly report: ChapterReport,
    private readonly mark: (event: string, details?: Record<string, unknown>) => void,
  ) {
    this.course = level.course;
    this.platforms = new Map(level.course.platforms.map((platform) => [platform.id, platform]));
    this.mainIndex = new Map(chapter.level.mainPath.map((id, index) => [id, index]));
  }

  private get live(): Live {
    return this.game.live;
  }

  private platform(id: string): ObbyPlatform {
    const platform = this.platforms.get(id);
    assert.ok(platform, `course platform ${id} is missing`);
    return platform;
  }

  private top(id: string, time: number): number {
    const platform = sampledPlatform(this.course, id, time);
    return platform.center.y + platform.size.y / 2;
  }

  private isLift(platform: ObbyPlatform): boolean {
    return platform.motion?.axis === "y";
  }

  private abilities(): AbilitySet {
    return growthMovesFrom(this.live.growthMoves);
  }

  /** Stands still for about `seconds` of page time, in long frames while it can. */
  async idle(seconds: number): Promise<void> {
    await this.game.move(0, 0);
    let remaining = seconds;
    while (remaining > 0.008) {
      const frame =
        remaining > 0.3 ? Math.min(IDLE_MS, Math.floor((remaining - 0.1) / 0.016) * FINE_MS) : FINE_MS;
      await this.game.step(frame);
      remaining -= frame / 1_000;
    }
  }

  /**
   * Waits, standing, until `ready(time)` holds for the live course time. The
   * course is deterministic, so the wait is scanned ahead first and crossed
   * in long frames, then finished one frame at a time.
   */
  async standUntil(ready: (time: number) => boolean, maxSeconds: number): Promise<boolean> {
    const start = this.live.time;
    if (ready(start)) return true;
    let due: number | null = null;
    for (let time = start; time <= start + maxSeconds; time += FRAME_SECONDS)
      if (ready(time)) {
        due = time;
        break;
      }
    if (due === null) return false;
    if (due - start > 0.12) await this.idle(due - start - 0.08);
    for (let frame = 0; frame < 60; frame += 1) {
      if (ready(this.live.time)) return true;
      await this.game.move(0, 0);
      await this.game.step(FINE_MS);
    }
    return ready(this.live.time);
  }

  /** Walks on the current support to within `tolerance` of `target`. */
  async walkTo(
    target: Point,
    { tolerance = 0.08, maxSeconds = 14, fine = false, until }: { tolerance?: number; maxSeconds?: number; fine?: boolean; until?: () => boolean } = {},
  ): Promise<boolean> {
    this.game.debugTarget = target;
    const recoveries = this.live.recoveries;
    const deadline = this.live.time + maxSeconds;
    let stalled = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    let noProgressFrames = 0;
    while (this.live.time < deadline && stalled < 600) {
      const distance = planar(this.live.position, target);
      if (distance <= tolerance || until?.()) return true;
      if (this.live.recoveries > recoveries) return false;
      if (distance < bestDistance - 0.1) {
        bestDistance = distance;
        noProgressFrames = 0;
      } else noProgressFrames += 1;
      if (noProgressFrames >= 45) {
        const blocker = this.live.encounters.find((entry) =>
          entry.id === this.live.nearEncounterId && entry.role === "ordinary" && entry.hp > 0 &&
          /-encounter-\d+$/.test(entry.id));
        if (blocker) {
          await this.game.move(0, 0);
          await this.onBlockedEncounter?.(blocker.id);
          const action: "attack" | "bash" | null = this.live.attackReady && !this.live.requestBusy ? "attack"
            : this.live.guardReady && !this.live.requestBusy ? "bash" : null;
          if (action) {
            await this.game.press(action === "attack" ? "f" : "Shift");
            const event = { id: blocker.id, leg: this.game.debugLeg, action, time: this.live.time };
            this.report.routeBlockers.push(event);
            this.mark("route:blocker-hit", event);
          }
          await this.game.step(FINE_MS);
          noProgressFrames = 0;
          continue;
        }
      }
      if (!ACTIVE_PHASES.has(this.live.phase)) {
        await this.game.move(0, 0);
        await this.game.step(CRUISE_MS);
        stalled += 1;
        continue;
      }
      const frame = !fine && distance > 0.6 && this.live.grounded ? CRUISE_MS : FINE_MS;
      await this.game.move((target.x - this.live.position.x) / distance, -(target.z - this.live.position.z) / distance);
      await this.game.step(frame);
    }
    return planar(this.live.position, target) <= tolerance;
  }

  private lateralAim(connection: AuthoredConnection, time: number, aim: Point, lateral: number): Point {
    const from = sampledPlatform(this.course, connection.from, time).center;
    const to = sampledPlatform(this.course, connection.to, time).center;
    const distance = Math.hypot(to.x - from.x, to.z - from.z) || 1;
    const directionX = (to.x - from.x) / distance;
    const directionZ = (to.z - from.z) / distance;
    return { x: aim.x - directionZ * lateral, z: aim.z + directionX * lateral };
  }

  /** Keep a jump takeoff outside a raised destination's solid side wall. */
  private raisedTakeoff(connection: AuthoredConnection, entry: Point): Point {
    if (!jumpsAcross(connection)) return entry;
    const from = sampledPlatform(this.course, connection.from, this.live.time);
    const to = sampledPlatform(this.course, connection.to, this.live.time);
    const fromTop = from.center.y + from.size.y / 2;
    const toTop = to.center.y + to.size.y / 2;
    if (toTop - fromTop <= 0.2) return entry;
    const clearance = 0.4;
    const insideRaisedWall = (point: Point) =>
      point.x >= to.center.x - to.size.x / 2 - clearance &&
      point.x <= to.center.x + to.size.x / 2 + clearance &&
      point.z >= to.center.z - to.size.z / 2 - clearance &&
      point.z <= to.center.z + to.size.z / 2 + clearance;
    if (!insideRaisedWall(entry)) return entry;
    const dx = to.center.x - from.center.x;
    const dz = to.center.z - from.center.z;
    const length = Math.hypot(dx, dz);
    assert.ok(length > 0, `${connection.from}->${connection.to}: coincident jump platforms`);
    for (let step = 1; step <= 80; step += 1) {
      const takeoff = { x: entry.x - dx / length * step * 0.1, z: entry.z - dz / length * step * 0.1 };
      if (insideRaisedWall(takeoff)) continue;
      const sourceMargin = 0.3;
      assert.ok(
        takeoff.x >= from.center.x - from.size.x / 2 + sourceMargin &&
        takeoff.x <= from.center.x + from.size.x / 2 - sourceMargin &&
        takeoff.z >= from.center.z - from.size.z / 2 + sourceMargin &&
        takeoff.z <= from.center.z + from.size.z / 2 - sourceMargin,
        `${connection.from}->${connection.to}: no supported takeoff before raised wall`,
      );
      this.mark("leg:raised-takeoff", { from: connection.from, to: connection.to, entry, takeoff });
      return takeoff;
    }
    throw new Error(`${connection.from}->${connection.to}: raised wall extends beyond takeoff search`);
  }

  /** Crosses one connection from the current state, steering every frame (performConnection). */
  async perform(connection: AuthoredConnection, lateral: number, dropStyle?: RouteLegPlan["dropStyle"]): Promise<boolean> {
    const to = this.platform(connection.to);
    const recoveries = this.live.recoveries;
    const jumps = connection.mode !== "bounce" && jumpsAcross(connection, dropStyle ? { dropStyle } : {});
    const doubleJump = connection.requires === "double-jump";
    const glide = connection.requires === "glide";
    let airborne = !this.live.grounded;
    let secondPressed = false;
    try {
      for (let frame = 0; frame < 300; frame += 1) {
        const time = this.live.time + FINE_MS / 1_000;
        const aim = connectionAim(this.course, connection, time);
        const target = lateral ? this.lateralAim(connection, time, aim, lateral) : aim;
        const distance = planar(this.live.position, target) || 1;
        await this.game.move((target.x - this.live.position.x) / distance, -(target.z - this.live.position.z) / distance);
        const secondPress =
          doubleJump && !secondPressed && airborne && !this.live.grounded && this.game.verticalSpeed <= 0.6;
        if (frame === 0 && jumps) {
          if (glide) await this.game.hold("Space", true);
          else await this.game.press("Space");
        } else if (secondPress) {
          secondPressed = true;
          await this.game.press("Space");
        }
        await this.game.step(FINE_MS);
        airborne ||= !this.live.grounded;
        if (this.live.recoveries > recoveries) return false;
        if (to.bounce) {
          if (!this.live.grounded && this.game.verticalSpeed > PAD_LAUNCH_SPEED) return true;
        } else if (this.live.grounded && this.live.supportId === to.id) return true;
      }
      return false;
    } finally {
      await this.game.hold("Space", false);
    }
  }

  /** One leg with a planned approach, mirroring `runRouteLeg` on the live game. */
  async runLeg(connection: AuthoredConnection, plan: RouteLegPlan): Promise<boolean> {
    const recoveries = this.live.recoveries;
    const from = this.platform(connection.from);
    const to = this.platform(connection.to);
    const lateral = plan.lateral ?? 0;
    if (plan.waitBeforeFrames) {
      await this.idle(plan.waitBeforeFrames * FRAME_SECONDS);
      if (this.live.recoveries > recoveries) return false;
    }
    if (!from.bounce) {
      const inset = connection.mode === "walk" ? 1.2 : 0.75;
      if (this.isLift(from)) {
        const toTop = this.top(to.id, this.live.time);
        await this.standUntil(
          (time) => Math.abs(this.top(from.id, time) - toTop) <= 0.05,
          motionCycleSeconds(from) + 1,
        );
      } else {
        for (const point of plan.waypoints ?? []) if (!(await this.walkTo(point))) return false;
        const entry = this.raisedTakeoff(connection,
          edgeEntry(this.course, connection, this.live.time, inset, lateral));
        if (!(await this.walkTo(entry))) return false;
        if (this.isLift(to)) {
          const fromTop = this.top(from.id, this.live.time);
          const boarded = await this.standUntil(
            (time) => Math.abs(this.top(to.id, time + 0.2) - fromTop) <= 0.05,
            motionCycleSeconds(to) + 1,
          );
          if (!boarded) return false;
        } else if (to.motion) {
          const fromCenter = sampledPlatform(this.course, from.id, this.live.time).center;
          const rest = planar(to.center, fromCenter);
          await this.standUntil((time) => {
            const now = sampledPlatform(this.course, to.id, time).center;
            const next = sampledPlatform(this.course, to.id, time + FRAME_SECONDS).center;
            return planar(next, fromCenter) > planar(now, fromCenter) - 1e-9 && planar(now, fromCenter) <= rest;
          }, 20);
        } else if (plan.waitAtTakeoffFrames) {
          await this.idle(plan.waitAtTakeoffFrames * FRAME_SECONDS);
          if (this.live.recoveries > recoveries) return false;
        }
      }
    }
    return this.perform(connection, lateral, plan.dropStyle);
  }

  /** The kid model's plan for this leg, from the live game state. */
  private plan(connection: AuthoredConnection): { plan: RouteLegPlan; summary: string } {
    const from = this.platform(connection.from);
    if (from.bounce) return { plan: {}, summary: "launched" };
    const simulation = createGrowthSimulation(
      this.level,
      this.live.stage,
      this.abilities(),
      { ...this.live.position },
      this.live.time - FRAME_SECONDS,
    );
    growthStep(simulation, { move: { moveX: 0, moveY: 0 } });
    const planned = planPatientLeg(this.level, simulation, connection);
    if (!planned) return { plan: {}, summary: "unplanned" };
    const { plan } = planned;
    const parts = [
      plan.waitBeforeFrames ? `wait ${(plan.waitBeforeFrames * FRAME_SECONDS).toFixed(2)}s` : null,
      plan.waitAtTakeoffFrames ? `wait at takeoff ${(plan.waitAtTakeoffFrames * FRAME_SECONDS).toFixed(2)}s` : null,
      plan.lateral ? `lateral ${plan.lateral}` : null,
      planned.detoured ? `detour ${plan.waypoints?.length ?? 0}` : null,
    ].filter(Boolean);
    return { plan, summary: parts.length ? parts.join(", ") : "direct" };
  }

  /** Waits until the player stands on something in an active phase. */
  async settle(maxSeconds = 30): Promise<void> {
    const deadline = this.live.time + maxSeconds;
    let frames = 0;
    while (frames < 800 && (!this.live.grounded || !this.live.supportId || !ACTIVE_PHASES.has(this.live.phase))) {
      await this.game.move(0, 0);
      await this.game.step(this.live.grounded ? CRUISE_MS : FINE_MS);
      frames += 1;
      if (this.live.time > deadline && ACTIVE_PHASES.has(this.live.phase)) break;
    }
  }

  /** Crosses one connection, re-planning from the source after a fall there. */
  async cross(connection: AuthoredConnection): Promise<boolean> {
    const label = `${connection.from}->${connection.to}`;
    this.game.debugLeg = label;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      if (this.live.supportId === connection.to) return true;
      // A pad's leg starts in the air, straight after its launch.
      if (this.live.supportId !== connection.from && !this.platform(connection.from).bounce) return false;
      const { plan, summary } = this.plan(connection);
      const ok = await this.runLeg(connection, plan);
      this.report.legs.push({
        leg: label,
        attempt,
        mode: connection.mode,
        ...(connection.requires ? { requires: connection.requires } : {}),
        planned: summary,
        ok,
      });
      if (ok) {
        this.mark("leg:crossed", { label, time: Math.round(this.live.time * 100) / 100, position: this.live.position, supportId: this.live.supportId });
        return true;
      }
      this.mark("leg:retry", { label, attempt, supportId: this.live.supportId, recoveries: this.live.recoveries });
      await this.settle();
      if (this.live.supportId !== connection.from || this.platform(connection.from).bounce) return false;
    }
    return false;
  }

  /** The connections from `fromId` to `toId`: the main path forward when it can, else a shortest route. */
  private routeBetween(fromId: string, toId: string): AuthoredConnection[] {
    const connections = this.level.graph.connections;
    const find = (from: string, to: string) => connections.find((entry) => entry.from === from && entry.to === to)!;
    const mainPath = this.chapter.level.mainPath;
    const fromIndex = this.mainIndex.get(fromId);
    const toIndex = this.mainIndex.get(toId);
    if (fromIndex !== undefined && toIndex !== undefined && fromIndex < toIndex)
      return mainPath.slice(fromIndex, toIndex).map((id, index) => find(id, mainPath[fromIndex + index + 1]!));
    const branchIds = new Set(this.chapter.level.branches.flat().filter((id) => !this.mainIndex.has(id)));
    for (const avoidBranches of [true, false]) {
      const queue: Array<{ at: string; path: AuthoredConnection[] }> = [{ at: fromId, path: [] }];
      const seen = new Set([fromId]);
      while (queue.length) {
        const next = queue.shift()!;
        for (const connection of connections) {
          if (connection.from !== next.at || seen.has(connection.to)) continue;
          if (avoidBranches && branchIds.has(connection.to) && connection.to !== toId) continue;
          const path = [...next.path, connection];
          if (connection.to === toId) return path;
          seen.add(connection.to);
          queue.push({ at: connection.to, path });
        }
      }
    }
    throw new Error(`no route from ${fromId} to ${toId}`);
  }

  /** Reaches a platform along the course, one planned leg at a time. */
  async reach(platformId: string): Promise<void> {
    let failures = 0;
    for (let guard = 0; guard < 200; guard += 1) {
      await this.settle();
      const supportId = this.live.supportId;
      assert.ok(supportId, "the player is not standing on the course");
      if (supportId === platformId) return;
      // Legs run back to back: a pad's launch flows straight into its landing.
      let crossed = true;
      for (const connection of this.routeBetween(supportId, platformId)) {
        if (!(await this.cross(connection))) {
          crossed = false;
          break;
        }
        await this.afterLeg?.();
      }
      if (!crossed) {
        failures += 1;
        assert.ok(failures <= 12, `could not reach ${platformId}: stuck near ${this.live.supportId}`);
      }
    }
    throw new Error(`could not reach ${platformId}`);
  }

  private async walkOnDeckTo(anchor: AuthoredAnchor, done: () => boolean, label: string): Promise<void> {
    for (let attempt = 0; attempt < 6 && !done(); attempt += 1) {
      await this.reach(anchor.platformId);
      await this.walkTo(anchor.position, { tolerance: attempt < 2 ? 0.12 : 0.05, fine: true, until: done });
      for (let frame = 0; frame < 40 && !done(); frame += 1) {
        await this.game.move(0, 0);
        await this.game.step(FINE_MS);
      }
    }
    assert.ok(done(), `${label} was not collected`);
  }

  async collectPickup(kind: string, anchor: AuthoredAnchor): Promise<void> {
    const collected = () => this.live.pickups.some((entry) => entry.kind === kind && entry.collected);
    await this.walkOnDeckTo(anchor, collected, `pickup ${kind}`);
    this.report.pickups.push(kind);
    this.mark("pickup", { kind });
  }

  async collectMemory(slot: string, anchor: AuthoredAnchor): Promise<void> {
    const nearest = [...this.live.memories].sort(
      (a, b) => planar(a, anchor.position) - planar(b, anchor.position),
    )[0]!;
    const collected = () =>
      ["revealed", "consumed"].includes(this.live.memories.find((entry) => entry.id === nearest.id)?.state ?? "") ||
      this.live.routeId !== this.chapter.routeId ||
      this.live.phase === "complete";
    await this.walkOnDeckTo(anchor, collected, `memory ${slot}`);
    this.report.memories.push({ slot, id: nearest.id });
    this.mark("memory", { slot, id: nearest.id });
  }

  /**
   * Approaches and defeats one encounter with the attack and secondary
   * controls. `onReached` runs once, beside the enemy, before the first strike.
   */
  async fight(
    slot: string,
    anchor: AuthoredEncounterAnchor,
    onReached: (role: string) => Promise<void>,
    onKnockedOut?: () => void,
  ): Promise<void> {
    const role = slot === "boss" ? "boss" : "ordinary";
    const encounterId = slot === "boss"
      ? `${this.chapter.routeId}-boss`
      : `${this.chapter.routeId}-encounter-${slot.slice("ordinary-".length)}`;
    const encounter = this.live.encounters.find((entry) => entry.id === encounterId);
    assert.ok(encounter && encounter.role === role, `${slot}: live required encounter is unavailable`);
    const current = () => this.live.encounters.find((entry) => entry.id === encounter.id)!;
    const record = { slot, encounterId: encounter.id, role, attacks: 0, bashes: 0, defeats: 0 };
    if (encounter.hp === 0) {
      // A pair may fall to the same ordinary attack. It is still a distinct
      // required victory, and the final route assertion checks every ID.
      this.report.fights.push(record);
      this.mark("fight:already-won", record);
      return;
    }
    let shotTaken = false;
    // A forced knockout (QUEST_E2E_JUMP_SCARE) stands still beside the enemy
    // until its attacks take the player to 0 HP, then fights normally.
    let knockoutPending = Boolean(onKnockedOut);
    let knockoutStarted: number | null = null;
    let knockoutLogged = Number.NEGATIVE_INFINITY;
    const deadline = this.live.time + 240;
    while (current().hp > 0) {
      assert.ok(this.live.time < deadline, `${slot}: combat timed out`);
      if (this.live.phase === "fallen") {
        record.defeats += 1;
        assert.ok(record.defeats <= 6, `${slot}: too many defeats`);
        this.mark("fight:defeated", { slot, defeats: record.defeats });
        if (knockoutPending) {
          knockoutPending = false;
          onKnockedOut!();
        }
        await this.settle(60);
        continue;
      }
      if (this.live.supportId !== anchor.platformId && this.live.grounded) {
        await this.reach(anchor.platformId);
        continue;
      }
      if (this.live.nearEncounterId !== encounter.id) {
        const blockingOrdinary = this.live.encounters.find((entry) =>
          entry.id === this.live.nearEncounterId && entry.role === "ordinary" && entry.hp > 0);
        if (role === "ordinary" && blockingOrdinary) {
          // In a paired group the other ordinary can reach the player first.
          // Fight it through the same controls, then finish this exact slot.
          await this.game.move(0, 0);
          if (!shotTaken) {
            shotTaken = true;
            await onReached(role);
          }
          if (this.live.attackReady && !this.live.requestBusy) {
            await this.game.press("f");
            record.attacks += 1;
          } else if (!patternProbe && !comboProbe && this.live.guardReady && !this.live.requestBusy) {
            await this.game.press("Shift");
            record.bashes += 1;
          }
          await this.game.step(FINE_MS);
          continue;
        }
        // Step toward the enemy, never past the deck's edge.
        const deck = sampledPlatform(this.course, anchor.platformId, this.live.time);
        const margin = 0.6;
        const target = {
          x: Math.max(deck.center.x - deck.size.x / 2 + margin, Math.min(deck.center.x + deck.size.x / 2 - margin, current().x)),
          z: Math.max(deck.center.z - deck.size.z / 2 + margin, Math.min(deck.center.z + deck.size.z / 2 - margin, current().z)),
        };
        const distance = planar(this.live.position, target);
        if (distance > 0.15)
          await this.game.move((target.x - this.live.position.x) / distance, -(target.z - this.live.position.z) / distance);
        else await this.game.move(0, 0);
        await this.game.step(FINE_MS);
        continue;
      }
      await this.game.move(0, 0);
      if (!shotTaken) {
        shotTaken = true;
        await onReached(role);
      }
      if (knockoutPending) {
        if (knockoutStarted === null || this.live.time - knockoutLogged >= 3) {
          knockoutLogged = this.live.time;
          this.mark("fight:knockout-wait", {
            slot,
            hp: this.live.playerHp,
            enemyPhase: current().phase,
            distance: Math.round(planar(current(), this.live.position) * 100) / 100,
          });
        }
        knockoutStarted ??= this.live.time;
        assert.ok(this.live.time - knockoutStarted < 90, `${slot}: the forced knockout never landed`);
        // An idle enemy cannot reach a player outside its arena: step up to
        // it until it wakes, then stand still and take the hits.
        const enemy = current();
        const gap = planar(enemy, this.live.position);
        if ((enemy.phase ?? "idle") === "idle" && gap > 1.1) {
          const deck = sampledPlatform(this.course, anchor.platformId, this.live.time);
          const margin = 0.45;
          const target = {
            x: Math.max(deck.center.x - deck.size.x / 2 + margin, Math.min(deck.center.x + deck.size.x / 2 - margin, enemy.x)),
            z: Math.max(deck.center.z - deck.size.z / 2 + margin, Math.min(deck.center.z + deck.size.z / 2 - margin, enemy.z)),
          };
          const distance = planar(this.live.position, target);
          if (distance > 0.15)
            await this.game.move((target.x - this.live.position.x) / distance, -(target.z - this.live.position.z) / distance);
          else await this.game.move(0, 0);
          await this.game.step(FINE_MS);
          continue;
        }
        await this.game.move(0, 0);
        // Standing still needs no fine frames; the lunge still spans many.
        await this.game.step(CRUISE_MS);
        continue;
      }
      if (this.live.attackReady && !this.live.requestBusy) {
        await this.game.press("f");
        record.attacks += 1;
      } else if (!patternProbe && !comboProbe && this.live.guardReady && !this.live.requestBusy) {
        await this.game.press("Shift");
        record.bashes += 1;
      }
      await this.game.step(FINE_MS);
    }
    assert.equal(current().hp, 0, `${slot}: required enemy was not defeated`);
    this.report.fights.push(record);
    this.mark("fight:won", record);
  }
}

async function playChapter(chapter: LevelEditorChapterV2): Promise<ChapterReport> {
  const started = Date.now();
  const document = chapter.level;
  const level = levels[chapter.routeId];
  assert.ok(level, `${chapter.routeId}: route does not resolve`);
  const mainIndex = new Map(document.mainPath.map((id, index) => [id, index]));
  const ordinarySlots = Object.entries(document.anchors.encounters)
    .filter(([slot]) => /^ordinary-\d+$/.test(slot))
    .sort(([left, leftAnchor], [right, rightAnchor]) =>
      (mainIndex.get(leftAnchor.platformId) ?? Infinity) - (mainIndex.get(rightAnchor.platformId) ?? Infinity) ||
      Number(left.slice("ordinary-".length)) - Number(right.slice("ordinary-".length)))
    .map(([slot, anchor]) => {
      assert.ok(mainIndex.has(anchor.platformId), `${slot}: required encounter is outside the main route`);
      assert.ok(chapter.encounterSlots[slot as keyof typeof chapter.encounterSlots], `${slot}: encounter roster is missing`);
      return slot;
    });
  assert.ok(ordinarySlots.length >= 4, `${chapter.routeId}: expected at least four required ordinaries`);
  if (expectDenseWorld) {
    const bonusSlots = Object.keys(document.anchors.encounters).filter((slot) => /^bonus-\d+$/.test(slot));
    assert.equal(ordinarySlots.length, 12, `${chapter.routeId}: dense world needs 12 main-route ordinaries`);
    assert.equal(bonusSlots.length, 4, `${chapter.routeId}: dense world needs four bonus foes`);
    assert.equal(Object.keys(chapter.encounterSlots).length, 17,
      `${chapter.routeId}: dense world needs 16 ordinary foes and one boss`);
    assert.ok(bonusSlots.every((slot) => Boolean(chapter.encounterSlots[slot as keyof typeof chapter.encounterSlots])),
      `${chapter.routeId}: bonus foe anchor is missing from the encounter roster`);
    assert.equal(chapter.bossPrerequisiteDefeats, 4, `${chapter.routeId}: dense world boss gate must require four wins`);
  }
  const encounterSlots = [...ordinarySlots, "boss"];
  const startAge = chapter.recoveredAge.fromYears;
  const report: ChapterReport = {
    chapterId: chapter.chapterId,
    routeId: chapter.routeId,
    name: chapter.name,
    theme: document.theme,
    startAge,
    growthMoves: [],
    appearanceStage: "",
    mediaFailed: 0,
    identities: [],
    legs: [],
    recoveries: 0,
    combatKnockouts: 0,
    routeBlockers: [],
    fights: [],
    pickups: [],
    memories: [],
    completed: false,
    stoppedAt: null,
    completion: null,
    screenshots: [],
    frames: null,
    pageErrors: [],
    consoleErrors: [],
    responseErrors: [],
    media: {},
    assetLoads: [],
    drawingBetweenCaptures: !skipDraw,
    scare: {
      declared: document.scare ?? 0,
      expected: scaryMoments === "off" ? 0 : (document.scare ?? 0),
      live: 0,
      blackouts: 0,
      flickers: 0,
      watcherMoves: 0,
      watcherCreaks: 0,
      jumpScares: 0,
      events: [],
      closestSpots: {},
      shots: {},
    },
    wallSeconds: 0,
    failure: null,
  };
  const mark = (event: string, details: Record<string, unknown> = {}) =>
    console.log(`[${chapter.chapterId}] ${event} ${JSON.stringify(details)}`);
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-dev-shm-usage"],
  });
  let game: LockstepGame | null = null;
  try {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: playScale });
    if (realtimeSample) await context.addInitScript({ content: `(() => {
      let calls = 0;
      let triangles = 0;
      Object.defineProperty(window, '__questDrawCalls', { get: () => calls });
      Object.defineProperty(window, '__questDrawTriangles', { get: () => triangles });
      for (const type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
        if (!type) continue;
        for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements']) {
          const original = type.prototype[name];
          if (typeof original !== 'function') continue;
          type.prototype[name] = function(...args) {
            calls += 1;
            const count = name === 'drawArrays' || name === 'drawArraysInstanced' ? args[2]
              : name === 'drawRangeElements' ? args[3] : args[1];
            const instances = name === 'drawArraysInstanced' ? args[3]
              : name === 'drawElementsInstanced' ? args[4] : 1;
            if (Number.isFinite(count) && Number.isFinite(instances)) {
              if (args[0] === this.TRIANGLES) triangles += Math.floor(count / 3) * instances;
              else if (args[0] === this.TRIANGLE_STRIP || args[0] === this.TRIANGLE_FAN)
                triangles += Math.max(0, count - 2) * instances;
            }
            return original.apply(this, args);
          };
        }
      }
    })();` });
    if (familyCard || patternProbe) await context.addCookies([{ name: "quest_test_session", value: "admin", url: url! }]);
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    let latestSave: SaveLike | null = null;
    let returnedProject: LevelEditorProjectV2 | null = null;
    let returnedFingerprint = "";
    const pendingAssetLoads: Promise<void>[] = [];
    let assetsReadyAt = 0;
    page.on("pageerror", (error) => report.pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") report.consoleErrors.push(message.text());
    });
    page.on("response", async (response) => {
      const path = new URL(response.url()).pathname;
      if (response.status() >= 400) report.responseErrors.push(`${response.status()} ${path}`);
      if (path.startsWith("/studio/assets/media/") && path.endsWith(".glb")) {
        report.media[path] = response.status();
        if (realtimeSample && response.ok()) pendingAssetLoads.push((async () => {
          const body = await response.body();
          const bytes = body.byteLength;
          const timing = response.request().timing();
          report.assetLoads.push({ path, bytes, sha256: createHash("sha256").update(body).digest("hex"), durationMs: Number((timing.responseEnd - timing.requestStart).toFixed(1)) });
        })());
      }
      if (response.request().method() !== "POST" || !response.ok()) return;
      const startsFamily = /^\/api\/children\/[^/]+\/play$/.test(path);
      if (path !== "/api/editor/playtests" && !startsFamily && !/^\/api\/saves\/[^/]+\/actions$/.test(path)) return;
      const payload = (await response.json().catch(() => null)) as (SaveLike & {
        save?: SaveLike;
        project?: LevelEditorProjectV2;
        fingerprint?: string;
      }) | null;
      if (path === "/api/editor/playtests" && payload?.project) {
        returnedProject = payload.project;
        returnedFingerprint = payload.fingerprint ?? "";
      }
      const save = path === "/api/editor/playtests" || startsFamily ? payload?.save : payload;
      if (/^\/api\/saves\/[^/]+\/actions$/.test(path) && save?.id && (report.patternProbe || report.comboProbe)) {
        const request = JSON.parse(response.request().postData() ?? "{}") as { action?: { type?: string; encounterId?: string } };
        const targetId = request.action?.encounterId ?? null;
        const actionRecord = { type: request.action?.type ?? "unknown", encounterId: targetId,
          playerHp: save.adventure?.playerHp ?? null,
          encounterHp: save.adventure?.activeLevel?.encounters?.find((entry) => entry.id === targetId)?.hp ?? null,
          comboStep: save.adventure?.attackComboStep ?? null };
        report.patternProbe?.actions.push(actionRecord);
        report.comboProbe?.actions.push(actionRecord);
      }
      if (save?.id) latestSave = save;
    });
    if (scaryMoments === "off")
      await context.addInitScript(() => {
        try {
          localStorage.setItem("quest-scary-moments-v1", "off");
        } catch {
          /* Storage is optional; the default stays on. */
        }
      });
    if (skipDraw) await page.addInitScript({ content: `(() => {
      globalThis.__questSkipDraw = false;
      for (const type of [globalThis.WebGL2RenderingContext, globalThis.WebGLRenderingContext]) {
        if (!type) continue;
        for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements', 'clear']) {
          const original = type.prototype[name];
          if (typeof original !== 'function') continue;
          type.prototype[name] = function(...args) {
            if (globalThis.__questSkipDraw) return;
            return original.apply(this, args);
          };
        }
      }
    })();` });
    await page.clock.install();
    if (!familyCard) await page.route("**/api/editor/playtests", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.continue({
        postData: JSON.stringify({ project, chapterId: chapter.chapterId, scope: "chapter" }),
        headers: { ...route.request().headers(), "content-type": "application/json" },
      });
    });
    await page.goto(url!, { waitUntil: "domcontentloaded" });
    if (familyCard) await page.locator(".family-journey-card").filter({ hasText: familyCard }).click({ timeout: 60_000 });
    else await page.getByRole("button", { name: "Enter Rat Casino", exact: true }).click({ timeout: 60_000 });
    await page.locator("canvas[data-quest-canvas=true]").waitFor({ timeout: 90_000 });
    game = new LockstepGame(page, cdp);
    const readyBy = Date.now() + 180_000;
    for (;;) {
      const live = await page.evaluate(inspectInPage, false).catch(() => null);
      if (live?.routeId === chapter.routeId && live.mediaLoading === 0 && live.supportId) break;
      assert.ok(Date.now() < readyBy, `${chapter.routeId} did not load`);
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }
    if (realtimeSample) {
      await Promise.all(pendingAssetLoads);
      report.assetLoads.sort((left, right) => left.path.localeCompare(right.path));
      assetsReadyAt = Date.now();
      report.realtime = { spawn: await sampleRealtime(page, report.assetLoads, assetsReadyAt) };
    }
    await game.pause();
    if (skipDraw) await page.evaluate("globalThis.__questSkipDraw=true");
    const opening = game.live;
    if (patternProbe) {
      const slot = ordinarySlots.find((candidate) => {
        const id = `${chapter.routeId}-encounter-${candidate.slice("ordinary-".length)}`;
        const pattern = opening.encounters.find((entry) => entry.id === id)?.attackPattern;
        return pattern === "charge" || pattern === "bolt";
      });
      assert.ok(slot, `${chapter.chapterId}: no charge or bolt on the required route`);
      const id = `${chapter.routeId}-encounter-${slot.slice("ordinary-".length)}`;
      const pattern = opening.encounters.find((entry) => entry.id === id)!.attackPattern!;
      report.patternProbe = { target: { slot, id, pattern }, action: patternAction, events: [], screenshots: [], actions: [],
        playerHpAtStart: opening.playerHp, playerHpAtEnd: null };
    }
    if (comboProbe) report.comboProbe = { actions: [], confirmed: false, screenshots: [] };
    report.growthMoves = opening.growthMoves;
    report.appearanceStage = opening.stage;
    report.mediaFailed = opening.mediaFailed;
    if (!familyCard) {
      assert.ok(returnedProject, "the server did not return the frozen editor project");
      const frozenChapter = (returnedProject as LevelEditorProjectV2).chapters.find(
        (entry) => entry.chapterId === chapter.chapterId,
      );
      assert.ok(frozenChapter, "the frozen chapter is unavailable");
      assert.deepEqual(frozenChapter.level, document, "the frozen level differs from the checked-in template");
      report.frozenProject = {
        projectId: (returnedProject as LevelEditorProjectV2).projectId,
        revision: (returnedProject as LevelEditorProjectV2).revision,
        fingerprint: returnedFingerprint,
        schemaVersion: frozenChapter.level.schemaVersion,
        theme: frozenChapter.level.theme,
        decorCount: frozenChapter.level.decor?.length ?? 0,
      };
    }
    assert.deepEqual(opening.growthMoves, [...abilitiesForAge(startAge)], "the chapter starts with its age's moves");
    assert.equal(opening.ageYears, startAge);
    assert.equal(opening.mediaFailed, 0, "chapter media failed to load");
    // The playtest froze the chapter's scare level, and the switch caps it.
    report.scare.live = opening.scare?.level ?? 0;
    assert.equal(report.scare.live, report.scare.expected, "the chapter plays at its declared scare level");
    const openingSave = latestSave as SaveLike | null;
    report.identities = (openingSave?.adventure?.activeLevel?.encounters ?? []).map(
      (entry) => ({
        id: entry.id,
        role: entry.role,
        asset: entry.content?.assetId ?? entry.content?.placeholder ?? null,
      }),
    );
    const shot = async (name: string) => {
      const file = `${shotDirectory}/${chapter.chapterId}-${name}.png`;
      await game!.screenshot(file);
      report.screenshots.push(file);
      mark("screenshot", { file });
    };
    await shot("01-spawn");
    if (VIEWPORT.width <= 430) {
      const controls = {
        move: page.getByTestId("joystick"),
        jump: page.getByRole("button", { name: "Jump", exact: true }),
        attack: page.getByRole("button", { name: "Attack", exact: true }),
      };
      const boxes: Record<string, { x: number; y: number; width: number; height: number }> = {};
      for (const [name, control] of Object.entries(controls)) {
        const box = await control.boundingBox();
        assert.ok(box, `${name} control is not visible in portrait`);
        assert.ok(box.x >= -1 && box.y >= -1 && box.x + box.width <= VIEWPORT.width + 1 &&
          box.y + box.height <= VIEWPORT.height + 1, `${name} control is clipped in portrait`);
        boxes[name] = box;
      }
      const scrollWidth = await page.evaluate(() => globalThis.document.documentElement.scrollWidth);
      assert.ok(scrollWidth <= VIEWPORT.width + 1, "portrait game scrolls horizontally");
      report.portraitLayout = { viewport: { ...VIEWPORT }, controls: boxes, scrollWidth };
    }

    // DESIGN-027 evidence: counters, events and the four scare screenshots.
    // Each encounter spawns on its anchor; a watcher never strays 1.5 m from it.
    const encounterAnchors = Object.values(document.anchors.encounters)
      .filter((anchor): anchor is AuthoredEncounterAnchor => Boolean(anchor))
      .map((anchor) => anchor.position);
    const spawns = new Map(
      opening.encounters.map((entry) => {
        const anchor = [...encounterAnchors].sort((a, b) => planar(a, entry) - planar(b, entry))[0]!;
        return [entry.id, { x: anchor.x, z: anchor.z }];
      }),
    );
    const scare = report.scare;
    const scareEvent = (event: string, details: Record<string, unknown> = {}) => {
      const entry = { event, time: Math.round(game!.live.time * 100) / 100, ...details };
      scare.events.push(entry);
      mark(`scare:${event}`, details);
    };
    const scareShot = async (name: string) => {
      const file = `${shotDirectory}/${chapter.chapterId}-scare-${name}.png`;
      const time = Math.round(game!.live.time * 100) / 100;
      await game!.screenshot(file);
      report.screenshots.push(file);
      const { width = VIEWPORT.width, height = VIEWPORT.height } = await sharp(file).metadata();
      const stats = await sharp(file)
        .extract({
          left: Math.round(width * 0.1),
          top: Math.round(height * 0.1),
          width: Math.round(width * 0.8),
          height: Math.round(height * 0.8),
        })
        .greyscale()
        .stats();
      const luma = Math.round(stats.channels[0]!.mean * 10) / 10;
      scare.shots[name] = { file, luma, time };
      mark("screenshot", { file, luma });
    };
    /**
     * The spawn watcher probe (D-04): face a sleeping ordinary, look away
     * until it can change, look back, and photograph it once it creaks.
     */
    const probeWatcher = async () => {
      const idler = new ChapterPilot(game!, level, chapter, report, mark);
      const player = { ...game!.live.position };
      const [watcher] = game!.live.encounters
        .filter((entry) => entry.role === "ordinary" && entry.hp > 0 && (entry.phase ?? "idle") === "idle")
        .map((entry) => ({ entry, distance: planar(entry, player) }))
        .filter((entry) => entry.distance >= 7 && entry.distance <= 18)
        .sort((a, b) => a.distance - b.distance);
      if (!watcher) return false;
      scareEvent("watcher-probe", { start: watcher.entry.id, supportId: game!.live.supportId, distance: Math.round(watcher.distance * 100) / 100 });
      const id = watcher.entry.id;
      let draggedPixels = 0;
      const turnTo = async (yaw: number) => {
        const current = -CAMERA_YAW_PER_PIXEL * draggedPixels;
        const delta = Math.atan2(Math.sin(yaw - current), Math.cos(yaw - current));
        const pixels = Math.round(-delta / CAMERA_YAW_PER_PIXEL);
        await game!.dragCamera(pixels);
        draggedPixels += pixels;
        // The camera eases toward its new angle; let it settle.
        await idler.idle(0.8);
      };
      const find = () => game!.live.encounters.find((entry) => entry.id === id)!;
      const face = Math.atan2(-(watcher.entry.x - player.x), -(watcher.entry.z - player.z));
      try {
        await turnTo(face);
        const before = { ...find() };
        await scareShot("03a-watcher-before");
        Object.assign(scare.shots["03a-watcher-before"]!, { watcher: id, distance: Math.round(watcher.distance * 100) / 100 });
        for (let attempt = 1; attempt <= 6 && !scare.shots["03-watcher-moved"]; attempt += 1) {
          const eventsBefore = scare.events.length;
          await turnTo(face + Math.PI);
          // Longer than the longest unseen spell before a change (3.5 s).
          await idler.idle(4.5);
          await turnTo(face);
          const creaked = scare.events
            .slice(eventsBefore)
            .some((entry) => entry.event === "watcher-creak" && entry.id === id);
          const now = find();
          const change = {
            watcher: id,
            attempt,
            shift: Math.round(planar(now, before) * 100) / 100,
            turned: now.facing !== null && before.facing !== null ? Math.round(Math.abs(now.facing - before.facing) * 100) / 100 : null,
            pose: [before.pose, now.pose],
            distance: Math.round(planar(now, game!.live.position) * 100) / 100,
          };
          scareEvent("watcher-probe", { creaked, ...change });
          // Prefer a shuffle; take a turn or pose change on the last try.
          if (creaked && (change.shift >= 0.3 || attempt === 6)) {
            await scareShot("03-watcher-moved");
            Object.assign(scare.shots["03-watcher-moved"]!, change);
          }
        }
      } finally {
        // Back to the starting angle exactly: the stick is camera-relative.
        await game!.dragCamera(-draggedPixels);
        draggedPixels = 0;
        await idler.idle(0.8);
      }
      return true;
    };
    const counted = { blackouts: 0, watcherMoves: 0, watcherCreaks: 0, jumpScares: 0 };
    const insideScriptedSpots = new Map<string, boolean>();
    const capturedLunges = new Set<string>();
    let lastLive: Live = opening;
    /** While the spawn watcher probe runs, it takes the watcher screenshots itself. */
    let probing = false;
    game.onFrame = async (live) => {
      const combo = report.comboProbe;
      if (combo && !combo.confirmed && combo.actions.some((action) => action.type === "attack" && action.comboStep === 3)) {
        combo.confirmed = true;
        const file = `${shotDirectory}/${chapter.chapterId}-confirmed-third-hit.png`;
        combo.screenshots.push(file);
        await game!.screenshot(file);
        report.screenshots.push(file);
        throw new StopAt("combo-probe");
      }
      const probe = report.patternProbe;
      const foe = probe && live.encounters.find((entry) => entry.id === probe.target.id);
      if (probe && foe && (foe.phase === "windup" || foe.phase === "strike" || foe.projectile)) {
        const previous = probe.events.at(-1);
        if (!previous || previous.phase !== foe.phase || Boolean(previous.projectile) !== Boolean(foe.projectile))
          probe.events.push({ time: Number(live.time.toFixed(3)), phase: foe.phase,
            progress: foe.windupProgress ?? null, target: foe.attackTarget,
            projectile: foe.projectile, playerHp: live.playerHp, player: { ...live.position } });
        const name = foe.phase === "windup" && foe.attackTarget && (foe.windupProgress ?? 0) >= 0.24 ? "charge-or-bolt-warning"
          : foe.projectile && planar(foe.projectile, live.position) < 2.4 ? "bolt-near"
            : foe.projectile ? "bolt-in-flight" : null;
        if (name && !probe.screenshots.some((file) => file.endsWith(`${name}.png`))) {
          const file = `${shotDirectory}/${chapter.chapterId}-${name}.png`;
          probe.screenshots.push(file);
          await game!.screenshot(file);
          report.screenshots.push(file);
        }
      }
      const state = live.scare;
      if (!state) return;
      for (const spot of document.scriptedScares ?? []) {
        const distance = planar(live.position, spot.position);
        const sameHeight = Math.abs(live.position.y - spot.position.y) <= 0.3;
        if (sameHeight && distance < (scare.closestSpots[spot.id]?.distance ?? Number.POSITIVE_INFINITY))
          scare.closestSpots[spot.id] = {
            distance,
            time: Math.round(live.time * 100) / 100,
            position: { ...live.position },
            grounded: live.grounded,
            supportId: live.supportId,
          };
        const inside = distance <= spot.radius && sameHeight;
        if (inside && !insideScriptedSpots.get(spot.id))
          scareEvent("scripted-spot-enter", {
            id: spot.id,
            encounterSlot: spot.encounterSlot,
            position: live.position,
            grounded: live.grounded,
            supportId: live.supportId,
            jumpScares: state.jumpScares,
          });
        insideScriptedSpots.set(spot.id, inside);
      }
      Object.assign(scare, {
        blackouts: state.blackouts,
        flickers: state.flickers,
        watcherMoves: state.watcherMoves,
        watcherCreaks: state.watcherCreaks,
        jumpScares: state.jumpScares,
      });
      if (state.blackouts > counted.blackouts) {
        counted.blackouts = state.blackouts;
        scareEvent("blackout", {
          count: state.blackouts,
          supportId: live.supportId,
          grounded: live.grounded,
          wasGrounded: lastLive.grounded,
        });
      }
      if (state.watcherMoves > counted.watcherMoves) {
        counted.watcherMoves = state.watcherMoves;
        const shifted = live.encounters
          .map((entry) => {
            const before = lastLive.encounters.find((item) => item.id === entry.id);
            return { id: entry.id, step: before ? planar(entry, before) : 0 };
          })
          .filter((entry) => entry.step > 0.01)
          .map((entry) => ({ id: entry.id, step: Math.round(entry.step * 100) / 100 }));
        scareEvent("watcher-move", { count: state.watcherMoves, shifted });
      }
      if (state.jumpScares > counted.jumpScares) {
        counted.jumpScares = state.jumpScares;
        const encounter = live.encounters.find((entry) => entry.id === state.lunge?.encounterId);
        scareEvent("jump-scare", {
          count: state.jumpScares,
          encounterId: state.lunge?.encounterId ?? null,
          position: live.position,
          grounded: live.grounded,
          supportId: live.supportId,
          playerHp: live.playerHp,
          encounterHp: encounter?.hp ?? null,
          encounterMaxHp: encounter?.maxHp ?? null,
        });
      }
      lastLive = live;
      if (!scare.shots["02-blackout"] && state.blackout >= 0.95 && (state.blackoutElapsed ?? 9) <= 0.8)
        await scareShot("02-blackout");
      if (state.watcherCreaks > counted.watcherCreaks) {
        counted.watcherCreaks = state.watcherCreaks;
        for (const id of state.lastWatcherCreakIds) {
          const now = live.encounters.find((entry) => entry.id === id);
          const spawn = spawns.get(id);
          const shift = now && spawn ? Math.round(planar(now, spawn) * 100) / 100 : null;
          const distance = now ? Math.round(planar(now, live.position) * 100) / 100 : null;
          scareEvent("watcher-creak", { count: state.watcherCreaks, id, shiftFromSpawn: shift, distance });
          // A creak counts only near enough to see: the frustum test ignores walls.
          if (!probing && !scare.shots["03-watcher-moved"] && shift !== null && shift >= 0.3 && distance !== null && distance <= 18) {
            await scareShot("03-watcher-moved");
            Object.assign(scare.shots["03-watcher-moved"]!, { watcher: id, shiftFromSpawn: shift, distance });
          }
        }
      }
      if (state.lunge && state.lunge.progress >= 0.25 && !capturedLunges.has(state.lunge.encounterId)) {
        const name = capturedLunges.size === 0 ? "04-jump-scare-lunge" : `04-jump-scare-lunge-${capturedLunges.size + 1}`;
        await scareShot(name);
        Object.assign(scare.shots[name]!, { encounterId: state.lunge.encounterId });
        capturedLunges.add(state.lunge.encounterId);
      }
    };
    if (report.scare.live > 0) await scareShot("01-dark-room");
    else if (scaryMoments === "off" && report.scare.declared > 0) await scareShot("01-switch-off");
    if (until === "spawn") {
      await new ChapterPilot(game, level, chapter, report, mark).idle(spawnIdleSeconds);
      throw new StopAt("spawn");
    }

    const pilot = new ChapterPilot(game, level, chapter, report, mark);
    let knockoutForced = false;
    let probeDone = !(watcherProbe && report.scare.live > 0);
    pilot.afterLeg = async () => {
      if (probeDone || !game!.live.grounded || !staticDeck(game!.live.supportId ?? "")) return;
      probing = true;
      try {
        probeDone = await probeWatcher();
      } finally {
        probing = false;
      }
      if (probeDone && until === "watcher-probe") throw new StopAt("watcher-probe");
    };
    let firstOrdinaryShot = false;
    const anchors = document.anchors;
    const captureFirstOrdinary = async (firstTargetId: string | null) => {
      if (firstOrdinaryShot) return;
      firstOrdinaryShot = true;
      await shot("02-first-ordinary-fight");
      if (realtimeSample && (until === "first-fight" || until === "chase-probe")) {
        await game!.releaseStick();
        await page.clock.resume();
        report.realtime!.firstFight = await sampleRealtime(page, report.assetLoads, assetsReadyAt);
      }
      if (until === "chase-probe") {
        assert.ok(firstTargetId, "first ordinary was not in contact range");
        const number = /-encounter-(\d+)$/.exec(firstTargetId)?.[1];
        assert.ok(number, "first target is not a required ordinary");
        const chaseSlot = `ordinary-${number}`;
        const chaseAnchor = anchors.encounters[chaseSlot as keyof typeof anchors.encounters];
        assert.ok(chaseAnchor, `${chaseSlot}: missing chase anchor`);
        report.chase = await probeRealtimeChase(game!, level, chaseSlot, chaseAnchor, firstTargetId);
        const file = `${shotDirectory}/${chapter.chapterId}-03-chase-gap-recovery.png`;
        await page.screenshot({ path: file });
        report.screenshots.push(file);
        throw new StopAt("chase-probe");
      }
      if (until === "first-fight") throw new StopAt("first-fight");
    };
    pilot.onBlockedEncounter = captureFirstOrdinary;
    const helper = friendlyAsset ? opening.friendlies.find((friend) => friend.assetId === friendlyAsset) : null;
    const helperAnchor = helper
      ? Object.values(anchors.friendlies).find((anchor) => planar(anchor.position, helper) < 0.01)
      : null;
    if (until === "friendly") assert.ok(helper && helperAnchor, "the exact friendly occupies an authored anchor");
    const exerciseFriend = async () => {
      assert.ok(helper && helperAnchor && openingSave);
      const readSave = async (): Promise<SaveLike> => {
        const response = await page.request.get(`${url}/api/saves/${openingSave.id}`);
        assert.ok(response.ok(), `read family save: ${response.status()}`);
        return response.json() as Promise<SaveLike>;
      };
      const friend = (save: SaveLike) => {
        const value = save.adventure?.activeLevel?.friendlies?.find((entry) => entry.id === helper.id);
        assert.ok(value && value.assetId === friendlyAsset);
        return value;
      };
      const settleUi = async (condition: () => Promise<boolean>, label: string) => {
        const deadline = Date.now() + 15_000;
        while (!(await condition())) {
          assert.ok(Date.now() < deadline, label);
          await game!.step(CRUISE_MS);
          await new Promise((wait) => setTimeout(wait, 30));
        }
      };
      const changed = async (revision: number) => {
        let save = await readSave();
        await settleUi(async () => {
          save = await readSave();
          return save.revision > revision;
        }, "friendly action did not persist");
        await game!.step(CRUISE_MS);
        return save;
      };
      const dialog = page.getByRole("dialog");
      const open = async () => {
        await settleUi(() => page.locator(".friendly-prompt").isVisible(), "friendly prompt not visible");
        await page.locator(".friendly-prompt").click({ force: true });
        await settleUi(() => dialog.isVisible(), "friendly dialog not visible");
      };
      assert.ok(await pilot.walkTo(helper, { tolerance: 1.1, until: () => game!.live.nearFriendlyId === helper.id }));
      await pilot.idle(0.2);
      await game!.releaseStick();
      assert.equal(game!.live.nearFriendlyId, helper.id);
      let save = await readSave();
      const before = structuredClone(save);
      assert.equal(friend(save).boonClaimed, false);
      const encounters = JSON.stringify(save.adventure?.activeLevel?.encounters);
      const cameraYaw = Math.atan2(-(helper.x - game!.live.position.x), -(helper.z - game!.live.position.z));
      const cameraPixels = Math.round(-cameraYaw / CAMERA_YAW_PER_PIXEL);
      await game!.dragCamera(cameraPixels);
      await pilot.idle(0.5);
      const capture = async (name: string) => {
        const desktop = { ...VIEWPORT };
        try {
          for (const viewport of [{ name: "desktop", width: 1280, height: 760 }, { name: "phone", width: 390, height: 844 }]) {
            VIEWPORT = { width: viewport.width, height: viewport.height };
            await page.setViewportSize(VIEWPORT);
            await game!.step(CRUISE_MS);
            await shot(`${name}-${viewport.name}`);
          }
        } finally {
          VIEWPORT = desktop;
          await page.setViewportSize(VIEWPORT);
          await game!.step(CRUISE_MS);
        }
      };
      await capture("friendly-idle");
      await game!.press("f");
      await pilot.idle(0.25);
      save = await readSave();
      assert.equal(save.revision, before.revision, "normal attack never targets this friend");
      assert.equal(friend(save).hp, friend(before).hp);
      await open();
      const fullHealthGiftPreserved = save.adventure?.playerHp === save.adventure?.maxPlayerHp;
      if (fullHealthGiftPreserved) {
        assert.equal(await dialog.getByRole("button", { name: "You’re already healthy", exact: true }).isDisabled(), true);
        assert.equal(friend(await readSave()).boonClaimed, false);
      }
      const harms: Array<{ friendHp: number; playerHp: number | undefined }> = [];
      while (!friend(save).defeated) {
        await dialog.getByRole("button", { name: "Hurt this friend…", exact: true }).click({ force: true });
        await settleUi(() => dialog.getByRole("button", { name: "Attack anyway", exact: true }).isVisible(), "harm warning missing");
        if (harms.length === 0) await capture("friendly-harm-warning");
        // Shared weapon deadlines use real server time even in lockstep.
        await new Promise((wait) => setTimeout(wait, 1_100));
        const revision = save.revision;
        await dialog.getByRole("button", { name: "Attack anyway", exact: true }).click({ force: true });
        save = await changed(revision);
        harms.push({ friendHp: friend(save).hp, playerHp: save.adventure?.playerHp });
        assert.ok(friend(save).penaltyActive);
        assert.equal(save.adventure?.playerHp, Math.max(1, before.adventure!.playerHp! - 2), "only first harm costs player health");
        await settleUi(async () => !(await dialog.isVisible()), "harm dialog did not close");
        await pilot.idle(2.2);
        if (!friend(save).defeated) await open();
        assert.ok(harms.length <= 4, "friendly defeat did not finish");
      }
      await capture("friendly-held-defeat");
      await open();
      await dialog.getByRole("button", { name: "Make amends", exact: true }).click({ force: true });
      save = await changed(save.revision);
      assert.deepEqual({ hp: friend(save).hp, defeated: friend(save).defeated, penalty: friend(save).penaltyActive, gift: friend(save).boonClaimed },
        { hp: friend(save).maxHp, defeated: false, penalty: false, gift: false });
      const hpBeforeHeal = save.adventure!.playerHp!;
      await settleUi(() => dialog.getByRole("button", { name: "Say hello · +2 health", exact: true }).isEnabled(), "healing did not become available after amends");
      await dialog.getByRole("button", { name: "Say hello · +2 health", exact: true }).click({ force: true });
      save = await changed(save.revision);
      assert.equal(save.adventure?.playerHp, Math.min(save.adventure!.maxPlayerHp!, hpBeforeHeal + 2));
      assert.equal(friend(save).boonClaimed, true);
      assert.equal(await dialog.getByRole("button", { name: "Gift already shared", exact: true }).isDisabled(), true);
      await capture("friendly-amends-healed");
      assert.equal(JSON.stringify(save.adventure?.activeLevel?.encounters), encounters, "friendship never changes enemies or boss gates");
      await dialog.getByRole("button", { name: "Keep exploring", exact: true }).click({ force: true });
      const repaired = structuredClone(friend(save));
      const healedHp = save.adventure?.playerHp;
      await page.clock.resume();
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator(".family-journey-card").filter({ hasText: familyCard }).click({ timeout: 30_000 });
      const readyBy = Date.now() + 90_000;
      for (;;) {
        const live = await page.evaluate(inspectInPage, false).catch(() => null);
        if (live?.routeId === chapter.routeId && live.mediaLoading === 0 && live.supportId) break;
        assert.ok(Date.now() < readyBy, "family reload did not load");
        await new Promise((wait) => setTimeout(wait, 100));
      }
      await game!.pause();
      if (skipDraw) await page.evaluate("globalThis.__questSkipDraw=true");
      save = await readSave();
      assert.deepEqual(friend(save), repaired, "reload preserves repaired friendship and consumed gift");
      assert.equal(save.adventure?.playerHp, healedHp);
      assert.equal(game!.live.friendlies.find((entry) => entry.id === helper.id)?.assetId, friendlyAsset);
      report.friendly = { assetId: friendlyAsset, id: helper.id, anchor: helperAnchor, placement: helper, fullHealthGiftPreserved,
        normalAttackIgnored: true, harms, amendsRestored: true, healedHp, giftOnceOnly: true, reloadPreserved: true,
        enemiesUnchanged: true, familyCard, initialSaveRevision: before.revision, finalSaveRevision: save.revision };
      mark("friendly:passed", report.friendly);
    };
    const mainPath = document.mainPath;
    const bossIndex = mainPath.indexOf(anchors.encounters.boss.platformId);
    // Mid-climb: the first main-path deck at least half as high as the boss deck.
    const tops = mainPath.map((id) => {
      const piece = level.course.platforms.find((platform) => platform.id === id)!;
      return piece.center.y + piece.size.y / 2;
    });
    const midTarget = tops[0]! + (tops[bossIndex]! - tops[0]!) * 0.5;
    const staticDeck = (id: string) => document.pieces.some((piece) => piece.id === id && piece.type === "platform");
    const midIndex = mainPath.findIndex(
      (id, index) => index > 0 && index < bossIndex && tops[index]! >= midTarget && staticDeck(id),
    );
    const anchored = new Set([
      ...Object.values(anchors.pickups).map((anchor) => anchor.platformId),
      anchors.memories["minor-one"].platformId,
      anchors.memories["minor-two"].platformId,
      ...encounterSlots.map((slot) => anchors.encounters[slot as keyof typeof anchors.encounters]!.platformId),
      ...(helperAnchor ? [helperAnchor.platformId] : []),
    ]);
    for (const [index, platformId] of mainPath.entries()) {
      // Pads, lifts and movers in between are crossed on the way.
      if (!anchored.has(platformId) && index !== midIndex && index !== mainPath.length - 1) continue;
      await pilot.reach(platformId);
      if (index === midIndex) await shot("02-mid-climb");
      for (const [kind, anchor] of Object.entries(anchors.pickups))
        if (anchor.platformId === platformId) await pilot.collectPickup(kind, anchor);
      for (const slot of encounterSlots) {
        const anchor = anchors.encounters[slot as keyof typeof anchors.encounters]!;
        if (anchor.platformId === platformId) {
          if (patternProbe && slot === report.patternProbe?.target.slot) {
            const probe = report.patternProbe;
            const foe = () => game!.live.encounters.find((entry) => entry.id === probe.target.id)!;
            const steer = async (x: number, z: number) => {
              const distance = Math.hypot(x, z);
              await game!.move(distance > 0 ? x / distance : 0, distance > 0 ? -z / distance : 0);
              await game!.step(FINE_MS);
            };
            // Wake the actual enemy with ordinary stick input before measuring pursuit.
            for (let tick = 0; tick < 240 && foe().phase === "idle"; tick += 1)
              await steer(foe().x - game.live.position.x, foe().z - game.live.position.z);
            assert.notEqual(foe().phase, "idle", `${slot}: special never aggroed`);
            const start = { player: { ...game.live.position }, enemy: { ...foe() }, gap: planar(game.live.position, foe()) };
            const deck = sampledPlatform(level.course, platformId, game.live.time);
            const away = { x: start.player.x - start.enemy.x, z: start.player.z - start.enemy.z };
            const magnitude = Math.hypot(away.x, away.z) || 1;
            const candidate = { x: start.player.x + away.x / magnitude * 2.5, z: start.player.z + away.z / magnitude * 2.5 };
            const target = {
              x: Math.max(deck.center.x - deck.size.x / 2 + 0.7, Math.min(deck.center.x + deck.size.x / 2 - 0.7, candidate.x)),
              z: Math.max(deck.center.z - deck.size.z / 2 + 0.7, Math.min(deck.center.z + deck.size.z / 2 - 0.7, candidate.z)),
            };
            for (let tick = 0; tick < 55; tick += 1) {
              if (planar(game.live.position, target) < 0.15 || foe().phase === "windup") break;
              await steer(target.x - game.live.position.x, target.z - game.live.position.z);
            }
            await game.move(0, 0);
            const after = foe();
            probe.retreat = {
              startGap: Number(start.gap.toFixed(2)), endGap: Number(planar(game.live.position, after).toFixed(2)),
              playerTravel: Number(planar(start.player, game.live.position).toFixed(2)),
              enemyTravel: Number(planar(start.enemy, after).toFixed(2)),
              startPhase: start.enemy.phase, endPhase: after.phase,
            };
            mark("pattern:retreat", probe.retreat);
            if (patternAction !== "combo") {
              // Re-enter range and let one whole warning/attack resolve without a strike.
              for (let tick = 0; tick < 300 && foe().phase !== "windup"; tick += 1) {
                const gap = planar(game.live.position, foe());
                if (gap > (probe.target.pattern === "bolt" ? 4.2 : 3.2))
                  await steer(foe().x - game.live.position.x, foe().z - game.live.position.z);
                else { await game.move(0, 0); await game.step(FINE_MS); }
              }
              assert.equal(foe().phase, "windup", `${slot}: special warning did not start`);
              const startHp = game.live.playerHp;
              const firstWarning = game.live.time;
              let jumpUsed = false;
              let sidestepUsed = false;
              let sawStrike = false;
              for (let tick = 0; tick < 200; tick += 1) {
                if (patternAction === "jump" && !jumpUsed &&
                    ((probe.target.pattern === "charge" && foe().phase === "windup" && (foe().windupProgress ?? 0) >= 0.7) ||
                     (probe.target.pattern === "bolt" && foe().projectile && planar(foe().projectile!, game.live.position) < 1.7))) {
                  await game.press("Space"); jumpUsed = true;
                }
                if (patternAction === "sidestep" && foe().attackTarget && foe().phase === "windup" && (foe().windupProgress ?? 0) >= 0.24) {
                  const aim = foe().attackTarget!;
                  const dx = aim.x - foe().x, dz = aim.z - foe().z;
                  const length = Math.hypot(dx, dz) || 1;
                  const side = dx >= 0 ? { x: -dz / length, z: dx / length } : { x: dz / length, z: -dx / length };
                  const sideTarget = { x: game.live.position.x + side.x, z: game.live.position.z + side.z };
                  const within = sideTarget.x > deck.center.x - deck.size.x / 2 + 0.4 && sideTarget.x < deck.center.x + deck.size.x / 2 - 0.4 &&
                    sideTarget.z > deck.center.z - deck.size.z / 2 + 0.4 && sideTarget.z < deck.center.z + deck.size.z / 2 - 0.4;
                  if (within) { await steer(side.x, side.z); sidestepUsed = true; continue; }
                }
                await game.move(0, 0);
                await game.step(FINE_MS);
                if (foe().phase === "strike" || foe().projectile) sawStrike = true;
                if (game.live.playerHp < startHp ||
                    (sawStrike && foe().phase === "windup" && game.live.time - firstWarning > 1) ||
                    (sawStrike && foe().phase === "chasing" && game.live.time - firstWarning > 1.4)) break;
              }
              probe.playerHpAtEnd = game.live.playerHp;
              probe.resolution = { startHp, endHp: game.live.playerHp, firstWarning, finalPhase: foe().phase,
                jumpUsed, sidestepUsed };
              assert.ok(probe.events.some((event) => event.phase === "windup"), `${slot}: warning not observed`);
              throw new StopAt("pattern-probe");
            }
          }
          const jumpsBefore = game.live.scare?.jumpScares ?? 0;
          await pilot.fight(
            slot,
            anchor,
            async (role) => {
              if (role === "boss") {
                await shot("03-boss-arena");
                if (until === "boss-arena") throw new StopAt("boss-arena");
              } else await captureFirstOrdinary(game!.live.nearEncounterId);
              if (comboProbe && (slot === ordinarySlots[0] || role === "boss")) {
                  // The server's combo window uses wall time. Resume the page
                  // clock and use only normal keyboard attacks for this probe.
                  await page.clock.resume();
                  const combo = report.comboProbe!;
                  const targetId = role === "boss" ? `${chapter.routeId}-boss`
                    : `${chapter.routeId}-encounter-${slot.slice("ordinary-".length)}`;
                  const sameDeckAlternates = Object.entries(anchors.encounters)
                    .filter(([candidate, candidateAnchor]) => candidate !== slot && candidateAnchor.platformId === anchor.platformId && /^ordinary-\d+$/.test(candidate))
                    .map(([candidate]) => `${chapter.routeId}-encounter-${candidate.slice("ordinary-".length)}`);
                  for (let strike = 0; strike < 8 && !combo.actions.some((action) => action.type === "attack" && action.comboStep === 3); strike += 1) {
                    const readyBy = Date.now() + 8_000;
                    for (;;) {
                      const live = await game!.read(false);
                      assert.ok(Date.now() < readyBy, "combo attack did not become ready");
                      assert.ok(live.playerHp > 0, "player fell during combo probe");
                      const firstStillAlive = (live.encounters.find((entry) => entry.id === targetId)?.hp ?? 0) > 0;
                      const currentTarget = firstStillAlive ? targetId : sameDeckAlternates
                        .map((id) => live.encounters.find((entry) => entry.id === id))
                        .filter((entry): entry is LiveEncounter => Boolean(entry && entry.hp > 0))
                        .sort((left, right) => planar(left, live.position) - planar(right, live.position))[0]?.id;
                      assert.ok(currentTarget, "no live same-deck target remains for third strike");
                      if (live.attackReady && !live.requestBusy && live.nearEncounterId === currentTarget) {
                        await game!.move(0, 0);
                        break;
                      }
                      if (strike >= 2 && live.nearEncounterId !== currentTarget) {
                        const foe = live.encounters.find((entry) => entry.id === currentTarget)!;
                        const dx = foe.x - live.position.x, dz = foe.z - live.position.z;
                        const gap = Math.hypot(dx, dz);
                        if (gap > 0.1) await game!.move(dx / gap, -dz / gap);
                      }
                      await new Promise((wait) => setTimeout(wait, 25));
                    }
                    const previous = combo.actions.filter((action) => action.type === "attack").length;
                    await game!.press("f");
                    const responseBy = Date.now() + 8_000;
                    while (combo.actions.filter((action) => action.type === "attack").length === previous) {
                      assert.ok(Date.now() < responseBy, "combo attack did not receive a server response");
                      await new Promise((wait) => setTimeout(wait, 30));
                    }
                  }
                  const attacks = combo.actions.filter((action) => action.type === "attack");
                  assert.equal(attacks.at(-1)?.comboStep, 3, "third strike was not server-confirmed as combo finisher");
                  const file = `${shotDirectory}/${chapter.chapterId}-confirmed-third-hit.png`;
                  if (skipDraw) {
                    await page.evaluate("globalThis.__questSkipDraw=false");
                    await new Promise((wait) => setTimeout(wait, 80));
                  }
                  await cdp.send("Emulation.setDeviceMetricsOverride", { ...VIEWPORT, deviceScaleFactor: 1, mobile: false });
                  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
                  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
                  await writeFile(file, Buffer.from(data, "base64"));
                  combo.screenshots.push(file);
                  combo.confirmed = true;
                  report.screenshots.push(file);
                  throw new StopAt("combo-probe");
              }
            },
            slot === jumpScareSlot && !knockoutForced
              ? () => {
                  knockoutForced = true;
                  scareEvent("forced-knockout", { slot });
                }
              : undefined,
          );
          if (patternProbe && slot === report.patternProbe?.target.slot) {
            report.patternProbe.playerHpAtEnd = game.live.playerHp;
            assert.ok(report.patternProbe.events.some((event) => event.phase === "windup"),
              `${slot}: special never displayed its locked warning`);
            throw new StopAt("pattern-probe");
          }
          // At level 2 the forced knockout had to become a lunge (D-05).
          if (slot === jumpScareSlot && report.scare.live === 2)
            assert.ok(
              (game.live.scare?.jumpScares ?? 0) > jumpsBefore,
              `${slot}: the forced knockout did not become a jump scare`,
            );
        }
      }
      // Clear required threats before walking toward a memory on their deck.
      for (const slot of ["minor-one", "minor-two"] as const)
        if (anchors.memories[slot].platformId === platformId) await pilot.collectMemory(slot, anchors.memories[slot]);
      if (until === "friendly" && helperAnchor?.platformId === platformId) {
        await exerciseFriend();
        throw new StopAt("friendly");
      }
      if (index === mainPath.length - 1) {
        await pilot.collectMemory("major", anchors.memories.major);
      }
    }
    // Completion: the major memory advances the age and closes the chapter.
    for (let frame = 0; frame < 120; frame += 1) {
      const save = latestSave as SaveLike | null;
      if (save && (save.ageYears > startAge || save.adventure?.phase === "complete")) break;
      await game.step(CRUISE_MS);
    }
    const finalSave = latestSave as SaveLike | null;
    report.completion = finalSave
      ? {
          ageYears: finalSave.ageYears,
          phase: finalSave.adventure?.phase ?? null,
          currentLevelId: finalSave.adventure?.currentLevelId ?? null,
          completedLevelIds: finalSave.adventure?.completedLevelIds ?? [],
          recoveredIds: finalSave.recoveredIds ?? [],
        }
      : null;
    report.completed =
      Boolean(finalSave) &&
      finalSave!.ageYears === chapter.recoveredAge.toYears &&
      (finalSave!.adventure?.completedLevelIds ?? []).includes(chapter.routeId);
    assert.deepEqual(report.fights.map((fight) => fight.slot), encounterSlots,
      `${chapter.routeId}: not every required ordinary and boss was defeated`);
    assert.equal(new Set(report.fights.map((fight) => fight.encounterId)).size, encounterSlots.length,
      `${chapter.routeId}: every required fight must defeat a distinct enemy`);
    await shot("04-finish");
    assert.ok(report.completed, `${chapter.chapterId} did not complete: ${JSON.stringify(report.completion)}`);
  } catch (error) {
    if (error instanceof StopAt) {
      report.stoppedAt = error.at;
      mark("stopped", { at: report.stoppedAt, fights: report.fights.length });
      return report;
    }
    report.failure = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
    if (game) {
      const file = `${shotDirectory}/${chapter.chapterId}-failure.png`;
      await game.screenshot(file).catch(() => undefined);
      report.screenshots.push(file);
    }
  } finally {
    report.recoveries = game?.live?.recoveries ?? 0;
    report.combatKnockouts = game?.combatKnockouts ?? 0;
    report.frames = game ? { ...game.stats } : null;
    report.wallSeconds = Math.round((Date.now() - started) / 1_000);
    await browser.close();
  }
  return report;
}

const reports: ChapterReport[] = [];
for (const chapter of selected) {
  const report = await playChapter(chapter);
  reports.push(report);
  await writeFile(`${reportDirectory}/${chapter.chapterId}.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    `[${chapter.chapterId}] ${report.completed ? "completed" : report.stoppedAt ? `stopped at ${report.stoppedAt}` : "FAILED"}: ${report.fights.length} fights, ` +
      `${report.memories.length} memories, ${report.legs.length} legs, ${report.recoveries} recoveries, ` +
      `${report.frames?.frames ?? 0} frames, ${report.wallSeconds}s wall; scare ${report.scare.live} ` +
      `(${report.scare.blackouts} blackouts, ${report.scare.flickers} flickers, ${report.scare.watcherMoves} watcher moves, ` +
      `${report.scare.watcherCreaks} creaks, ${report.scare.jumpScares} jump scares)`,
  );
}
const failed = reports.filter(
  (report) => !(report.completed || report.stoppedAt === until) ||
    report.pageErrors.length > 0 || report.consoleErrors.length > 0 || report.responseErrors.length > 0,
);
if (failed.length > 0) {
  for (const report of failed) console.error(`[${report.chapterId}] ${report.failure ?? report.pageErrors.join("; ")}`);
  process.exitCode = 1;
}
