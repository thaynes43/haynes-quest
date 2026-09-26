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
 * fall. It collects both pickups, both minor memories, fights all four
 * ordinaries and the boss, and finishes on the major memory. The optional
 * branches and bonus fights are left for players.
 *
 * Lockstep proves route logic, collisions, combat rules and completion under
 * ordinary input on the real client. It is not a frame-time or feel
 * measurement; software WebGL draws a few frames a second.
 *
 *   QUEST_E2E_URL        origin of an ephemeral playtest build (required)
 *   QUEST_E2E_PROJECT    template project (default src/shared/levels/family-world-a-v2.json)
 *   QUEST_E2E_CHAPTERS   comma-separated chapter ids (default: every chapter)
 *   QUEST_E2E_RUN_LABEL  report folder under test-results/family-world (default candidate)
 *   QUEST_E2E_SHOTS      screenshot folder (default the report folder)
 *   QUEST_E2E_SCALE      device scale while playing (default 0.25; screenshots use 1)
 *
 *   pnpm build && QUEST_EPHEMERAL_PLAYTEST=true QUEST_FIXTURE_MODE=true \
 *     NODE_ENV=development BETTER_AUTH_SECRET=... QUEST_APP_ORIGIN=http://127.0.0.1:3000 \
 *     node dist/server/index.js
 *   QUEST_E2E_URL=http://127.0.0.1:3000 pnpm exec tsx tests/e2e/family-world-lockstep.ts
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type CDPSession, type Page } from "playwright";
import { abilitiesForAge, growthMovesFrom, type AbilitySet } from "../../src/shared/abilities";
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
const projectPath = resolve(process.env.QUEST_E2E_PROJECT ?? "src/shared/levels/family-world-a-v2.json");
const reportDirectory = resolve(`test-results/family-world-lockstep/${runLabel}`);
const shotDirectory = resolve(process.env.QUEST_E2E_SHOTS ?? reportDirectory);
const playScale = Number(process.env.QUEST_E2E_SCALE ?? 0.25);
assert.ok(playScale >= 0.1 && playScale <= 1, "QUEST_E2E_SCALE must be 0.1 to 1");
await mkdir(reportDirectory, { recursive: true });
await mkdir(shotDirectory, { recursive: true });

const project = JSON.parse(await readFile(projectPath, "utf8")) as LevelEditorProjectV2;
const { levels } = resolveLevelEditorProject(project);
const chapters = project.chapters as readonly LevelEditorChapterV2[];
const requested = (process.env.QUEST_E2E_CHAPTERS ?? "").split(",").filter(Boolean);
const selected = requested.length ? chapters.filter((entry) => requested.includes(entry.chapterId)) : chapters;
assert.equal(selected.length, requested.length || chapters.length, "unknown chapter requested");

const VIEWPORT = { width: 1280, height: 760 };
const FINE_MS = 16;
const CRUISE_MS = 48;
const IDLE_MS = 192;
const ACTIVE_PHASES = new Set(["exploring", "memory-released"]);
/** A pad launches at 7.5 or 9 m/s; the fastest jump is 5.9 m/s. */
const PAD_LAUNCH_SPEED = 6.6;
/** Stick drag radius in CSS pixels, beyond the stick's travel so the vector is full strength. */
const STICK_REACH = 90;

type Point = { x: number; z: number };

interface LiveEncounter {
  id: string;
  role: string;
  kind: string;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  z: number;
}

interface Live {
  position: { x: number; y: number; z: number };
  grounded: boolean;
  phase: string;
  playerHp: number;
  nearEncounterId: string | null;
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
}

/** The inspection fields this harness reads (src/game/types.ts GameInspection). */
interface PageInspection {
  status: {
    position: Live["position"];
    grounded: boolean;
    phase: string;
    playerHp: number;
    nearEncounterId: string | null;
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
  level: {
    authored?: { id: string };
    encounterPositions: LiveEncounter[];
    memoryPositions: Live["memories"];
    pickupPositions: Live["pickups"];
  };
  obby?: { timeSeconds: number; supportId: string | null; recoveries: number };
}

/** The parts of a save view the report records. */
interface SaveLike {
  id: string;
  ageYears: number;
  recoveredIds?: string[];
  adventure?: {
    phase?: string;
    currentLevelId?: string;
    completedLevelIds?: string[];
    activeLevel?: {
      encounters?: Array<{ id: string; role: string; content?: { assetId?: string; placeholder?: string } }>;
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
  const { status, level, obby } = inspection;
  return {
    position: status.position,
    grounded: status.grounded,
    phase: status.phase,
    playerHp: status.playerHp,
    nearEncounterId: status.nearEncounterId,
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
  /** Vertical speed over the last frame, from the feet position. */
  verticalSpeed = 0;
  readonly stats: FrameStats = { frames: 0, fineFrames: 0, pageMs: 0, wallMs: 0 };
  private stickCenter: Point | null = null;
  private stickTarget: Point | null = null;
  private intended: { moveX: number; moveY: number } = { moveX: 0, moveY: 0 };
  private mismatches = 0;
  private jiggle = 0;
  private readonly held = new Set<string>();

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
    const previousY = this.live?.position.y ?? null;
    if (milliseconds === FINE_MS) await this.page.clock.runFor(milliseconds);
    else await this.page.clock.fastForward(milliseconds);
    const live = await this.read(true);
    this.stats.frames += 1;
    if (milliseconds === FINE_MS) this.stats.fineFrames += 1;
    this.stats.pageMs += milliseconds;
    this.stats.wallMs += Date.now() - started;
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
    return live;
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

  async press(key: string): Promise<void> {
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
  fights: Array<{ slot: string; encounterId: string; role: string; attacks: number; bashes: number; defeats: number }>;
  pickups: string[];
  memories: Array<{ slot: string; id: string }>;
  completed: boolean;
  completion: Record<string, unknown> | null;
  screenshots: string[];
  frames: FrameStats | null;
  pageErrors: string[];
  consoleErrors: string[];
  responseErrors: string[];
  media: Record<string, number>;
  wallSeconds: number;
  failure: string | null;
}

/** Plays one chapter's required route with ordinary controls. */
class ChapterPilot {
  private readonly course: ResolvedAuthoredLevel["course"];
  private readonly platforms: Map<string, ObbyPlatform>;
  private readonly mainIndex: Map<string, number>;

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
    const recoveries = this.live.recoveries;
    const deadline = this.live.time + maxSeconds;
    let stalled = 0;
    while (this.live.time < deadline && stalled < 600) {
      const distance = planar(this.live.position, target);
      if (distance <= tolerance || until?.()) return true;
      if (this.live.recoveries > recoveries) return false;
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
        const entry = edgeEntry(this.course, connection, this.live.time, inset, lateral);
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
      if (ok) return true;
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
      for (const connection of this.routeBetween(supportId, platformId))
        if (!(await this.cross(connection))) {
          crossed = false;
          break;
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

  /** Approaches and defeats one encounter with the attack and secondary controls. */
  async fight(slot: string, anchor: AuthoredEncounterAnchor, onBossReached: () => Promise<void>): Promise<void> {
    const role = slot === "boss" ? "boss" : "ordinary";
    const encounter = [...this.live.encounters]
      .filter((entry) => entry.role === role)
      .sort((a, b) => planar(a, anchor.position) - planar(b, anchor.position))[0]!;
    const current = () => this.live.encounters.find((entry) => entry.id === encounter.id)!;
    const record = { slot, encounterId: encounter.id, role, attacks: 0, bashes: 0, defeats: 0 };
    let shotTaken = false;
    const deadline = this.live.time + 240;
    while (current().hp > 0) {
      assert.ok(this.live.time < deadline, `${slot}: combat timed out`);
      if (this.live.phase === "fallen") {
        record.defeats += 1;
        assert.ok(record.defeats <= 6, `${slot}: too many defeats`);
        this.mark("fight:defeated", { slot, defeats: record.defeats });
        await this.settle(60);
        continue;
      }
      if (this.live.supportId !== anchor.platformId && this.live.grounded) {
        await this.reach(anchor.platformId);
        continue;
      }
      if (this.live.nearEncounterId !== encounter.id) {
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
      if (!shotTaken && role === "boss") {
        shotTaken = true;
        await onBossReached();
      }
      if (this.live.attackReady && !this.live.requestBusy) {
        await this.game.press("f");
        record.attacks += 1;
      } else if (this.live.guardReady && !this.live.requestBusy) {
        await this.game.press("Shift");
        record.bashes += 1;
      }
      await this.game.step(FINE_MS);
    }
    this.report.fights.push(record);
    this.mark("fight:won", record);
  }
}

const ENCOUNTER_SLOTS = ["ordinary-1", "ordinary-2", "ordinary-3", "ordinary-4", "boss"] as const;

async function playChapter(chapter: LevelEditorChapterV2): Promise<ChapterReport> {
  const started = Date.now();
  const document = chapter.level;
  const level = levels[chapter.routeId];
  assert.ok(level, `${chapter.routeId}: route does not resolve`);
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
    fights: [],
    pickups: [],
    memories: [],
    completed: false,
    completion: null,
    screenshots: [],
    frames: null,
    pageErrors: [],
    consoleErrors: [],
    responseErrors: [],
    media: {},
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
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    let latestSave: SaveLike | null = null;
    page.on("pageerror", (error) => report.pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") report.consoleErrors.push(message.text());
    });
    page.on("response", async (response) => {
      const path = new URL(response.url()).pathname;
      if (response.status() >= 400) report.responseErrors.push(`${response.status()} ${path}`);
      if (path.startsWith("/studio/assets/media/") && path.endsWith(".glb")) report.media[path] = response.status();
      if (response.request().method() !== "POST" || !response.ok()) return;
      if (path !== "/api/editor/playtests" && !/^\/api\/saves\/[^/]+\/actions$/.test(path)) return;
      const payload = (await response.json().catch(() => null)) as (SaveLike & { save?: SaveLike }) | null;
      const save = path === "/api/editor/playtests" ? payload?.save : payload;
      if (save?.id) latestSave = save;
    });
    await page.clock.install();
    await page.route("**/api/editor/playtests", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.continue({
        postData: JSON.stringify({ project, chapterId: chapter.chapterId, scope: "chapter" }),
        headers: { ...route.request().headers(), "content-type": "application/json" },
      });
    });
    await page.goto(url!, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Enter Rat Casino", exact: true }).click({ timeout: 60_000 });
    await page.locator("canvas[data-quest-canvas=true]").waitFor({ timeout: 90_000 });
    game = new LockstepGame(page, cdp);
    const readyBy = Date.now() + 180_000;
    for (;;) {
      const live = await page.evaluate(inspectInPage, false).catch(() => null);
      if (live?.routeId === chapter.routeId && live.mediaLoading === 0 && live.supportId) break;
      assert.ok(Date.now() < readyBy, `${chapter.routeId} did not load`);
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }
    await game.pause();
    const opening = game.live;
    report.growthMoves = opening.growthMoves;
    report.appearanceStage = opening.stage;
    report.mediaFailed = opening.mediaFailed;
    assert.deepEqual(opening.growthMoves, [...abilitiesForAge(startAge)], "the chapter starts with its age's moves");
    assert.equal(opening.ageYears, startAge);
    assert.equal(opening.mediaFailed, 0, "chapter media failed to load");
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

    const pilot = new ChapterPilot(game, level, chapter, report, mark);
    const anchors = document.anchors;
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
      ...ENCOUNTER_SLOTS.map((slot) => anchors.encounters[slot].platformId),
    ]);
    for (const [index, platformId] of mainPath.entries()) {
      // Pads, lifts and movers in between are crossed on the way.
      if (!anchored.has(platformId) && index !== midIndex && index !== mainPath.length - 1) continue;
      await pilot.reach(platformId);
      if (index === midIndex) await shot("02-mid-climb");
      for (const [kind, anchor] of Object.entries(anchors.pickups))
        if (anchor.platformId === platformId) await pilot.collectPickup(kind, anchor);
      for (const slot of ["minor-one", "minor-two"] as const)
        if (anchors.memories[slot].platformId === platformId) await pilot.collectMemory(slot, anchors.memories[slot]);
      for (const slot of ENCOUNTER_SLOTS) {
        const anchor = anchors.encounters[slot];
        if (anchor.platformId === platformId)
          await pilot.fight(slot, anchor, () => shot("03-boss-arena"));
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
    await shot("04-finish");
    assert.ok(report.completed, `${chapter.chapterId} did not complete: ${JSON.stringify(report.completion)}`);
  } catch (error) {
    report.failure = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
    if (game) {
      const file = `${shotDirectory}/${chapter.chapterId}-failure.png`;
      await game.screenshot(file).catch(() => undefined);
      report.screenshots.push(file);
    }
  } finally {
    report.recoveries = game?.live?.recoveries ?? 0;
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
    `[${chapter.chapterId}] ${report.completed ? "completed" : "FAILED"}: ${report.fights.length} fights, ` +
      `${report.memories.length} memories, ${report.legs.length} legs, ${report.recoveries} recoveries, ` +
      `${report.frames?.frames ?? 0} frames, ${report.wallSeconds}s wall`,
  );
}
const failed = reports.filter((report) => !report.completed || report.pageErrors.length > 0);
if (failed.length > 0) {
  for (const report of failed) console.error(`[${report.chapterId}] ${report.failure ?? report.pageErrors.join("; ")}`);
  process.exitCode = 1;
}
