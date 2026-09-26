// Lockstep Chromium playthrough of a checked-in family world template
// (PLAN-019), one chapter at a time through the ephemeral editor playtest.
//
// Serve a fresh build in the ephemeral fixture mode (docs/ops/002-private-
// preview.md): QUEST_EPHEMERAL_PLAYTEST=true, QUEST_FIXTURE_MODE=true,
// NODE_ENV=development, then `node dist/server/index.js`, after the strict
// docs build so `/studio` serves the model files.
//
// The private home's Rat Casino CTA posts a project to the editor playtest.
// This script swaps that request for the family world template and one of its
// chapters, so the server validates and freezes the chapter exactly as it
// would any editor project. Once the level is ready the page clock stops
// (lockstep-control.mjs) and page time only moves in whole 16 ms animation
// frames.
//
// Movement uses the game's public analog input (`GameHandle.setInput`, the
// surface the touch stick drives). Before each crossing the harness copies the
// live traversal state and course clock out of the game's read-only
// inspection and plans the crossing with the same `stepObby` and the patient
// scripted-kid planner the chapter tests use (`planPatientLeg`, 16 ms frames).
// The planned stick and Jump presses are keyed by course time; a small
// in-page animation-frame hook applies the entry for the next frame, and
// records where each frame left the player. The harness compares every
// recorded frame with the plan; a drift, fall or HP defeat stops the replay
// and it re-plans from the live state. Nothing moves the player or edits game
// state except that input.
//
// It collects both tools, fights all four ordinaries and the boss with the
// Attack control, recovers both minor memories and then the major memory, and
// confirms the chapter completes in the save. Screenshots of the spawn view, a
// mid-climb view and the boss arena land in QUEST_E2E_OUTPUT_DIR.
//
// Lockstep proves route logic, collisions, combat rules and completion under
// ordinary analog input. It is not a frame-time or feel measurement, and it
// makes no physical Safari claim.
//
//   QUEST_E2E_URL             base origin of the candidate build (required)
//   QUEST_FAMILY_WORLD        world key (default b: family-world-b-v1.json)
//   QUEST_E2E_CHAPTERS        comma-separated chapter ids (default: every chapter)
//   QUEST_E2E_OUTPUT_DIR      screenshots and report.json (default test-results/family-world/<key>)
//   QUEST_E2E_LOCKSTEP_SCALE  device scale factor (default 0.5)
//   QUEST_E2E_DRAW_EVERY      draw every Nth frame between screenshots (default 1)
//
// On a shared software renderer every drawn frame can cost several hundred
// milliseconds. QUEST_E2E_DRAW_EVERY=N skips the WebGL draw and clear calls on
// the other frames: the game still runs every frame (input, physics, combat,
// saves and the render loop itself), only the rasterization is thinned, and
// each screenshot draws two full frames first. The report records N.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium, type Browser, type Page } from "playwright";

import { abilitiesForAge, type AbilitySet } from "../../src/shared/abilities";
import {
  resolveAuthoredLevelDocument,
  type AuthoredConnection,
  type AuthoredLevelDocument,
  type ResolvedAuthoredLevel,
} from "../../src/shared/authored-level";
import type { ObbyState } from "../../src/game/obby";
import type { AppearanceStage } from "../game/authored-traversal-lib";
import { planPatientLeg } from "../game/family-kid-lib";
import {
  walkTo,
  type GrowthSimulation,
  type GrowthTraceFrame,
} from "../game/growth-traversal-lib";
// @ts-expect-error The lockstep helper is executable JavaScript by design.
import { createLockstep } from "./lockstep-control.mjs";

const url = process.env.QUEST_E2E_URL;
assert.ok(url, "QUEST_E2E_URL is required; never test a stale implicit server");
const worldKey = process.env.QUEST_FAMILY_WORLD ?? "b";
const scale = Number(process.env.QUEST_E2E_LOCKSTEP_SCALE ?? 0.5);
const outputDir = process.env.QUEST_E2E_OUTPUT_DIR ?? `test-results/family-world/${worldKey}`;
const drawEvery = Number(process.env.QUEST_E2E_DRAW_EVERY ?? 1);
assert.ok(Number.isInteger(drawEvery) && drawEvery >= 1, "QUEST_E2E_DRAW_EVERY must be a whole number from 1");
await fs.mkdir(outputDir, { recursive: true });

/** One lockstep animation frame; the game steps the obby once per frame. */
const FRAME_MS = 16;
const FRAME_SECONDS = FRAME_MS / 1000;
/** Frames rendered between checks of the recorded frames. */
const CHUNK_FRAMES = 30;
/** Largest replay divergence from the plan before the harness re-plans. */
const DRIFT_LIMIT = 0.04;

interface ChapterSource {
  readonly chapterId: string;
  readonly routeId: string;
  readonly name: string;
  readonly recoveredAge: { readonly fromYears: number; readonly toYears: number };
  readonly level: AuthoredLevelDocument;
}

interface WorldSource {
  readonly schemaVersion: string;
  readonly projectId: string;
  readonly chapters: readonly ChapterSource[];
}

const project = JSON.parse(
  await fs.readFile(new URL(`../../src/shared/levels/family-world-${worldKey}-v1.json`, import.meta.url), "utf8"),
) as WorldSource;
assert.equal(project.schemaVersion, "level-editor-project-v2");
const requested = process.env.QUEST_E2E_CHAPTERS?.split(",").filter(Boolean);
const chapters = project.chapters.filter(
  (chapter) => !requested || requested.includes(chapter.chapterId),
);
assert.ok(chapters.length > 0, "no chapter selected");

// ---------------------------------------------------------------------------
// In-page hook: the game handle, clock-keyed input and a per-frame record.
// ---------------------------------------------------------------------------

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** One planned frame's input, keyed by the course time that frame steps to. */
interface TimedInput {
  readonly t: number;
  readonly moveX: number;
  readonly moveY: number;
  readonly jump?: boolean;
  readonly attack?: boolean;
  /** The Secondary control (the game's `guard` input; a guard-tool strike on route-memory worlds). */
  readonly secondary?: boolean;
}

/** Where one rendered frame left the player (course time after the frame). */
interface FrameRecord {
  readonly t: number;
  readonly position: Vec3;
  readonly grounded: boolean;
  readonly supportId: string | null;
  readonly recoveries: number;
  readonly phase: string;
  readonly playerHp: number;
  readonly nearEncounterId: string | null;
  readonly attackReady: boolean;
}

interface FullInspection extends FrameRecord {
  readonly state: ObbyState;
  readonly routeId: string | null;
  readonly mediaLoading: number;
  readonly mediaFailed: number;
  readonly appearanceStage: AppearanceStage;
  readonly growthMoves: string[] | null;
  readonly encounters: ReadonlyArray<{ id: string; role: string; x: number; y: number; z: number; hp: number }>;
}

/**
 * Runs in the page. Finds the React ref holding the game handle, then
 * registers an animation-frame callback that records each frame's result and
 * applies the planned input for the next course step. Idempotent.
 */
function installHook(frameSeconds: number): boolean {
  type Handle = {
    inspect(): {
      status: {
        position: Vec3;
        grounded: boolean;
        phase: string;
        playerHp: number;
        nearEncounterId: string | null;
        attackReady: boolean;
      };
      obby?: { supportId: string | null; timeSeconds: number; recoveries: number };
    };
    setInput(action: string, value: number | boolean): void;
  };
  type Ref = { current?: Handle | null };
  type Fiber = { memoizedState?: unknown; return?: Fiber | null };
  type Hook = { memoizedState?: Ref; next?: Hook | null };
  type Plan = { frames: TimedInput[]; index: number };
  type HookState = {
    ref: Ref;
    plan: Plan;
    log: FrameRecord[];
    lastT: number;
    frame: number;
    apply?: (handle: Handle, time: number) => void;
  };
  const scope = window as unknown as { __familyWorld?: HookState };
  if (scope.__familyWorld?.ref.current) return true;
  const canvas = document.querySelector("canvas[data-quest-canvas=true]");
  if (!canvas) return false;
  let element: Element | null = canvas;
  let fiber: Fiber | null = null;
  while (element && !fiber) {
    const key = Object.keys(element).find((name) => name.startsWith("__reactFiber$"));
    fiber = key ? ((element as unknown as Record<string, Fiber | undefined>)[key] ?? null) : null;
    element = element.parentElement;
  }
  let ref: Ref | null = null;
  while (fiber && !ref) {
    let hook = (fiber.memoizedState ?? null) as Hook | null;
    while (hook && !ref) {
      const candidate = hook.memoizedState;
      if (candidate?.current && typeof candidate.current.inspect === "function") ref = candidate;
      hook = hook.next ?? null;
    }
    fiber = fiber.return ?? null;
  }
  if (!ref) return false;
  const existing = scope.__familyWorld;
  if (existing) {
    existing.ref = ref;
    return true;
  }
  const state: HookState = { ref, plan: { frames: [], index: 0 }, log: [], lastT: -1, frame: 0 };
  scope.__familyWorld = state;
  state.apply = (handle: Handle, time: number) => {
    const plan = state.plan;
    const target = time + frameSeconds;
    while (plan.index < plan.frames.length && plan.frames[plan.index]!.t < target - 1e-7) plan.index += 1;
    const entry = plan.frames[plan.index];
    const input = entry && Math.abs(entry.t - target) <= 1e-7 ? entry : null;
    for (const button of ["jump", "attack", "guard"]) handle.setInput(button, false);
    handle.setInput("moveX", input?.moveX ?? 0);
    handle.setInput("moveY", input?.moveY ?? 0);
    if (input?.jump) handle.setInput("jump", true);
    if (input?.attack) handle.setInput("attack", true);
    if (input?.secondary) handle.setInput("guard", true);
  };
  const tick = () => {
    // Draw thinning (QUEST_E2E_DRAW_EVERY): decides whether the next frame rasterizes.
    const draw = globalThis as unknown as { __questDrawEvery?: number; __questSkipDraw?: boolean };
    state.frame += 1;
    const every = draw.__questDrawEvery ?? 1;
    draw.__questSkipDraw = every > 1 && state.frame % every !== 0;
    const handle = state.ref.current;
    if (handle) {
      const inspection = handle.inspect();
      const status = inspection.status;
      const time = inspection.obby?.timeSeconds ?? 0;
      if (time !== state.lastT) {
        state.lastT = time;
        state.log.push({
          t: time,
          position: { ...status.position },
          grounded: status.grounded,
          supportId: inspection.obby?.supportId ?? null,
          recoveries: inspection.obby?.recoveries ?? 0,
          phase: status.phase,
          playerHp: status.playerHp,
          nearEncounterId: status.nearEncounterId,
          attackReady: status.attackReady,
        });
        if (state.log.length > 5_000) state.log.splice(0, 2_500);
      }
      state.apply?.(handle, time);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return true;
}

/** Runs in the page: replaces the plan and applies its first entry at once. */
function loadPlan(frames: TimedInput[]): boolean {
  const scope = window as unknown as {
    __familyWorld?: {
      ref: { current?: { inspect(): { obby?: { timeSeconds: number } } } | null };
      plan: { frames: TimedInput[]; index: number };
      apply?: (handle: unknown, time: number) => void;
    };
  };
  const state = scope.__familyWorld;
  const handle = state?.ref.current;
  if (!state || !handle) return false;
  state.plan = { frames, index: 0 };
  state.apply?.(handle, handle.inspect().obby?.timeSeconds ?? 0);
  return true;
}

/** Runs in the page: waits for the drawn frame, then drains the frame record. */
function drainLog(): FrameRecord[] {
  const canvas = document.querySelector("canvas[data-quest-canvas=true]") as HTMLCanvasElement | null;
  const gl = canvas?.getContext("webgl2");
  if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  const scope = window as unknown as { __familyWorld?: { log: FrameRecord[] } };
  return scope.__familyWorld?.log.splice(0) ?? [];
}

/** Runs in the page: the full read-only inspection subset used for planning. */
function inspectFull(): FullInspection | null {
  const scope = window as unknown as {
    __familyWorld?: { ref: { current?: { inspect(): unknown } | null } };
  };
  const handle = scope.__familyWorld?.ref.current;
  if (!handle) return null;
  const inspection = handle.inspect() as {
    status: FrameRecord & {
      mediaLoading: number;
      mediaFailed: number;
      appearanceStage: AppearanceStage;
      growthMoves?: string[];
    };
    obby?: { supportId: string | null; timeSeconds: number; recoveries: number; state: ObbyState };
    level: { authored?: { id: string }; encounterPositions: FullInspection["encounters"] };
  };
  const status = inspection.status;
  if (!inspection.obby) return null;
  return {
    t: inspection.obby.timeSeconds,
    position: { ...status.position },
    grounded: status.grounded,
    supportId: inspection.obby.supportId,
    recoveries: inspection.obby.recoveries,
    phase: status.phase,
    playerHp: status.playerHp,
    nearEncounterId: status.nearEncounterId,
    attackReady: status.attackReady,
    state: inspection.obby.state,
    routeId: inspection.level.authored?.id ?? null,
    mediaLoading: status.mediaLoading,
    mediaFailed: status.mediaFailed,
    appearanceStage: status.appearanceStage,
    growthMoves: status.growthMoves ?? null,
    encounters: inspection.level.encounterPositions,
  };
}

// ---------------------------------------------------------------------------
// Saves, as the server returns them.
// ---------------------------------------------------------------------------

interface SaveLevel {
  readonly id: string;
  readonly pickups: ReadonlyArray<{ pickupId: string; kind: string; collected: boolean }>;
  readonly encounters: ReadonlyArray<{ id: string; role: string; hp: number; defeated: boolean }>;
  readonly minorMemoryIds?: readonly string[];
  readonly majorMemoryId?: string;
  readonly bossId?: string;
}

interface SaveSnapshot {
  readonly id: string;
  readonly revision: number;
  readonly completed: boolean;
  readonly ageYears: number;
  readonly memories: ReadonlyArray<{ id: string; state: string }>;
  readonly adventure: {
    readonly phase: string;
    readonly currentLevelId: string | null;
    readonly completedLevelIds: readonly string[];
    readonly activeLevel: SaveLevel | null;
  };
}

// ---------------------------------------------------------------------------
// One chapter.
// ---------------------------------------------------------------------------

interface ChapterReport {
  chapterId: string;
  routeId: string;
  name: string;
  result: "running" | "passed" | "failed";
  error?: string;
  abilities?: AbilitySet;
  appearanceStage?: string;
  legs: Array<{ edge: string; frames: number; plans: number }>;
  replans: number;
  maxDrift: number;
  falls: number;
  hpDefeats: number;
  pickups: string[];
  memories: Array<{ slot: string; id: string; byContact?: boolean }>;
  fights: Array<{ slot: string; id: string; attacks: number; secondaries: number; hpDefeats: number }>;
  screenshots: string[];
  completedLevelIds?: readonly string[];
  frames: number;
  drawEvery: number;
  pageSeconds?: number;
  wallSeconds?: number;
  notes: string[];
  failures: string[];
}

type Lockstep = { install(): Promise<void>; pause(): Promise<void> };

async function playChapter(browser: Browser, chapter: ChapterSource): Promise<ChapterReport> {
  const started = Date.now();
  const report: ChapterReport = {
    chapterId: chapter.chapterId,
    routeId: chapter.routeId,
    name: chapter.name,
    result: "running",
    legs: [],
    replans: 0,
    maxDrift: 0,
    falls: 0,
    hpDefeats: 0,
    pickups: [],
    memories: [],
    fights: [],
    screenshots: [],
    frames: 0,
    drawEvery,
    notes: [],
    failures: [],
  };
  const short = chapter.chapterId.replace(/^family-/, "");
  const log = (message: string) =>
    console.log(`[${short} ${((Date.now() - started) / 1000).toFixed(0)}s] ${message}`);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 760 },
    deviceScaleFactor: scale,
  });
  const page: Page = await context.newPage();
  let latestSave: SaveSnapshot | null = null;
  page.on("pageerror", (error) => report.failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") report.failures.push(`console: ${message.text()}`);
  });
  page.on("response", async (response) => {
    const path = new URL(response.url()).pathname;
    if (response.status() >= 400) report.failures.push(`http ${response.status()} ${path}`);
    if (!response.ok() || response.request().method() !== "POST") return;
    const playtest = path === "/api/editor/playtests";
    if (!playtest && !/^\/api\/saves\/[^/]+\/actions$/.test(path)) return;
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    const save = (playtest ? payload?.save : payload) as SaveSnapshot | undefined;
    if (save?.id && Number.isInteger(save.revision) && (!latestSave || save.revision >= latestSave.revision))
      latestSave = save;
  });
  // tsx compiles this file with esbuild's keepNames, which wraps named
  // functions in the page callbacks below in a `__name` helper; give the page
  // an identity helper so those callbacks run unchanged.
  await page.addInitScript({ content: "globalThis.__name = (target) => target;" });
  // QUEST_E2E_DRAW_EVERY: skippable WebGL draw and clear calls (see the header).
  await page.addInitScript({
    content: `(() => {
      for (const type of [globalThis.WebGL2RenderingContext, globalThis.WebGLRenderingContext]) {
        if (!type) continue;
        for (const name of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced", "drawRangeElements", "clear"]) {
          const original = type.prototype[name];
          if (typeof original !== "function") continue;
          type.prototype[name] = function (...args) {
            if (globalThis.__questSkipDraw) return undefined;
            return original.apply(this, args);
          };
        }
      }
    })();`,
  });
  const lockstep = createLockstep(page, { cruiseFrameMs: 48 }) as Lockstep;
  await lockstep.install();
  await page.route("**/api/editor/playtests", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.continue();
    await route.continue({
      postData: JSON.stringify({ project, chapterId: chapter.chapterId, scope: "chapter" }),
      headers: { ...request.headers(), "content-type": "application/json" },
    });
  });

  const document = chapter.level;
  const level: ResolvedAuthoredLevel = resolveAuthoredLevelDocument(document);
  const abilities = abilitiesForAge(chapter.recoveredAge.fromYears);
  report.abilities = abilities;
  let shotIndex = 0;
  let last: FrameRecord | null = null;

  const readFull = async (): Promise<FullInspection> => {
    const full = (await page.evaluate(inspectFull)) as FullInspection | null;
    assert.ok(full, "game inspection unavailable");
    return full;
  };
  const plan = async (frames: TimedInput[]) => {
    assert.ok(await page.evaluate(loadPlan, frames), "input hook unavailable");
  };
  /** Renders up to `count` frames in chunks, returning every recorded frame. */
  const render = async (count: number, stop?: (records: FrameRecord[]) => boolean): Promise<FrameRecord[]> => {
    const records: FrameRecord[] = [];
    let remaining = count;
    while (remaining > 0) {
      const chunk = Math.min(CHUNK_FRAMES, remaining);
      await page.clock.runFor(chunk * FRAME_MS);
      remaining -= chunk;
      report.frames += chunk;
      const drained = (await page.evaluate(drainLog)) as FrameRecord[];
      records.push(...drained);
      if (drained.length) last = drained.at(-1)!;
      if (stop?.(drained)) break;
    }
    return records;
  };
  const idle = async (count: number, stop?: (record: FrameRecord) => boolean) => {
    await plan([]);
    return render(count, stop ? (records) => records.some(stop) : undefined);
  };
  const drawing = (every: number) =>
    page.evaluate((value) => {
      (globalThis as unknown as { __questDrawEvery?: number }).__questDrawEvery = value;
    }, every);
  const shot = async (name: string) => {
    let best: Buffer | null = null;
    await drawing(1);
    await idle(2);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (attempt > 0) await idle(1);
      const image = await page.screenshot();
      if (!best || image.length > best.length) best = image;
      if (image.length > 60_000) break;
    }
    await drawing(drawEvery);
    const file = `${outputDir}/${short}-${String(++shotIndex).padStart(2, "0")}-${name}.png`;
    await fs.writeFile(file, best!);
    report.screenshots.push(file);
    log(`screenshot ${file}`);
  };

  const simulationFrom = (inspection: FullInspection): GrowthSimulation => ({
    course: level.course,
    stage: inspection.appearanceStage,
    abilities,
    state: structuredClone(inspection.state),
    timeSeconds: inspection.t,
    bounces: [],
    recoveries: 0,
    maxFeetY: inspection.state.position.y,
    frameSeconds: FRAME_SECONDS,
    trace: [],
  });

  /**
   * Replays planned frames through the in-page hook. Returns false on a drift
   * past the limit, a fall or an HP defeat; the caller re-plans from there.
   */
  const replay = async (
    trace: readonly GrowthTraceFrame[],
    label: string,
    recoveriesBefore: number,
  ): Promise<boolean> => {
    if (trace.length === 0) return true;
    const byTime = new Map(trace.map((frame) => [frame.timeSeconds, frame]));
    const finalTime = trace.at(-1)!.timeSeconds;
    await plan(
      trace.map((frame) => ({
        t: frame.timeSeconds,
        moveX: frame.control.move.moveX,
        moveY: frame.control.move.moveY,
        ...(frame.control.jumpPressed ? { jump: true } : {}),
      })),
    );
    let failure: string | null = null;
    let reachedEnd = false;
    // The plan plus slack: a paused world (a card or a server reply) freezes the course clock.
    await render(trace.length + 240, (records) => {
      for (const record of records) {
        const planned = byTime.get(record.t);
        if (planned) {
          const drift = Math.hypot(
            record.position.x - planned.position.x,
            record.position.y - planned.position.y,
            record.position.z - planned.position.z,
          );
          report.maxDrift = Math.max(report.maxDrift, drift);
          if (drift > DRIFT_LIMIT) failure = `drifted ${drift.toFixed(3)} m at t=${record.t.toFixed(3)}`;
        }
        if (record.recoveries > recoveriesBefore) failure = "fell and recovered";
        if (record.phase === "fallen") failure = "HP defeat";
        if (record.t >= finalTime - 1e-9) reachedEnd = true;
        if (failure) break;
      }
      return failure !== null || reachedEnd;
    });
    await plan([]);
    if (failure || !reachedEnd) {
      report.replans += 1;
      report.notes.push(`${label}: ${failure ?? "plan did not finish"}`);
      log(`replay stopped: ${label}: ${failure ?? `plan did not finish (last t=${last?.t}, final t=${finalTime})`}`);
      return false;
    }
    return true;
  };

  /** Renders until the player stands on a surface in active play. */
  const settle = async (label: string): Promise<FrameRecord> => {
    const isSettled = (record: FrameRecord) =>
      record.grounded && record.supportId !== null && record.phase !== "fallen";
    const now = await readFull();
    if (isSettled(now)) return now;
    await idle(60 * 40, isSettled);
    assert.ok(last && isSettled(last), `${label}: the player never settled on a surface`);
    return last;
  };

  const connection = (from: string, to: string): AuthoredConnection => {
    const found = level.graph.connections.find((entry) => entry.from === from && entry.to === to);
    assert.ok(found, `no connection ${from}->${to}`);
    return found;
  };

  /** Shortest platform path along authored connections (any mode). */
  const pathBetween = (from: string, to: string): string[] | null => {
    const previous = new Map<string, string | null>([[from, null]]);
    const queue = [from];
    while (queue.length) {
      const current = queue.shift()!;
      if (current === to) break;
      for (const entry of level.graph.connections)
        if (entry.from === current && !previous.has(entry.to)) {
          previous.set(entry.to, current);
          queue.push(entry.to);
        }
    }
    if (!previous.has(to)) return null;
    const path: string[] = [];
    for (let at: string | null = to; at; at = previous.get(at) ?? null) path.unshift(at);
    return path;
  };

  /** Plans and replays one connection from the live state, re-planning after a drift. */
  const crossLeg = async (edge: AuthoredConnection): Promise<boolean> => {
    const label = `${edge.from}->${edge.to}`;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const inspection = await readFull();
      if (inspection.phase === "fallen") return false;
      const leg = planPatientLeg(level, simulationFrom(inspection), edge, {});
      if (!leg) {
        report.notes.push(`${label}: no plan (attempt ${attempt + 1})`);
        await idle(15);
        continue;
      }
      const trace = leg.simulation.trace ?? [];
      if (await replay(trace, label, inspection.recoveries)) {
        report.legs.push({ edge: label, frames: trace.length, plans: attempt + 1 });
        log(`crossed ${label} (${trace.length} frames, plan ${attempt + 1})`);
        return true;
      }
      const now = await readFull();
      if (now.recoveries > inspection.recoveries || now.phase === "fallen") return false;
      if (!now.grounded) {
        const settled = await settle(label);
        if (settled.supportId !== edge.from) return settled.supportId === edge.to;
      }
    }
    return false;
  };

  /** Walks on the current support toward a point for at most `frames` planned frames. */
  const walkToward = async (target: { x: number; z: number }, frames = 60 * 8): Promise<boolean> => {
    const inspection = await readFull();
    const simulation = simulationFrom(inspection);
    walkTo(simulation, target, frames);
    return replay(
      simulation.trace ?? [],
      `walk to ${target.x.toFixed(1)},${target.z.toFixed(1)}`,
      inspection.recoveries,
    );
  };

  /** A point on `platformId`'s top, pulled at least `inset` inside its edges. */
  const insideTop = (platformId: string, point: { x: number; z: number }, inset = 0.45) => {
    const platform = level.course.platforms.find((entry) => entry.id === platformId)!;
    const clamp = (value: number, centre: number, half: number) =>
      Math.min(centre + half - inset, Math.max(centre - half + inset, value));
    return {
      x: clamp(point.x, platform.center.x, platform.size.x / 2),
      z: clamp(point.z, platform.center.z, platform.size.z / 2),
    };
  };

  const save = (): SaveSnapshot => {
    assert.ok(latestSave, "no save yet");
    return latestSave;
  };
  const activeLevel = (): SaveLevel => {
    const active = save().adventure.activeLevel;
    assert.ok(active, "no active level");
    return active;
  };
  let activeLevelId = "";
  const finished = () =>
    latestSave !== null &&
    (latestSave.completed ||
      latestSave.adventure.completedLevelIds.includes(activeLevelId) ||
      latestSave.adventure.currentLevelId !== activeLevelId);

  /** Walks into an anchor (tool or memory) until the save shows it taken. */
  const collect = async (
    label: string,
    platformId: string,
    position: { x: number; z: number },
    taken: () => boolean,
  ): Promise<"done" | "moved"> => {
    for (let attempt = 0; attempt < 6 && !taken(); attempt += 1) {
      const live = await readFull();
      if (live.supportId !== platformId) return "moved";
      await walkToward(insideTop(platformId, position, 0.3));
      await idle(90, () => taken());
    }
    assert.ok(taken(), `${label}: never collected`);
    return "done";
  };

  /**
   * Fights one encounter until the save marks it defeated. It walks in to
   * mallet range (the Secondary reaches a little further, so the target hint
   * alone does not mean Attack can land), then presses Attack whenever the
   * game reports it ready, with the Secondary guard-tool strike alongside.
   */
  const fight = async (
    slot: string,
    encounterId: string,
    platformId: string,
  ): Promise<"done" | "fallen" | "moved"> => {
    let entry = report.fights.find((item) => item.id === encounterId);
    if (!entry) {
      entry = { slot, id: encounterId, attacks: 0, secondaries: 0, hpDefeats: 0 };
      report.fights.push(entry);
    }
    const defeated = () => activeLevel().encounters.find((item) => item.id === encounterId)?.defeated === true;
    const reach = slot === "boss" ? 1.4 : 1.1;
    let bossShot = slot !== "boss";
    for (let round = 0; round < 1_500 && !defeated(); round += 1) {
      const live = await readFull();
      if (live.phase === "fallen") {
        entry.hpDefeats += 1;
        report.hpDefeats += 1;
        log(`HP defeat during ${slot}`);
        await settle(`${slot}-retry`);
        return "fallen";
      }
      if (live.supportId && live.supportId !== platformId) return "moved";
      const enemy = live.encounters.find((item) => item.id === encounterId);
      assert.ok(enemy, `${slot}: encounter ${encounterId} is not rendered`);
      const dx = enemy.x - live.position.x;
      const dz = enemy.z - live.position.z;
      const distance = Math.hypot(dx, dz);
      if (live.nearEncounterId !== encounterId || (!live.attackReady && distance > reach)) {
        // Stop just short of the enemy, on the line from it to the player.
        const stand = distance > 1e-6 ? Math.max(0, distance - reach * 0.7) / distance : 0;
        await walkToward(
          insideTop(platformId, { x: live.position.x + dx * stand, z: live.position.z + dz * stand }, 0.6),
          12,
        );
        continue;
      }
      if (!bossShot) {
        await shot("boss-arena");
        bossShot = true;
      }
      if (live.attackReady) {
        entry.attacks += 1;
        entry.secondaries += 1;
        await plan([{ t: live.t + FRAME_SECONDS, moveX: 0, moveY: 0, attack: true, secondary: true }]);
        await render(8);
      } else {
        entry.secondaries += 1;
        await plan([{ t: live.t + FRAME_SECONDS, moveX: 0, moveY: 0, secondary: true }]);
        await render(4);
      }
    }
    assert.ok(defeated(), `${slot}: combat timed out`);
    return "done";
  };

  // Everything a platform holds, in play order: tools, minor memories, the
  // ordinaries, the boss, then the major memory.
  const processPlatform = async (platformId: string): Promise<"done" | "fallen" | "moved"> => {
    const anchors = document.anchors;
    for (const [kind, anchor] of Object.entries(anchors.pickups)) {
      if (anchor.platformId !== platformId) continue;
      const taken = () => activeLevel().pickups.some((pickup) => pickup.kind === kind && pickup.collected);
      if (taken()) {
        // Walking into a pickup collects it, so a crossing can take it first.
        if (!report.pickups.includes(kind)) report.pickups.push(kind);
        continue;
      }
      if ((await collect(`pickup ${kind}`, platformId, anchor.position, taken)) === "moved") return "moved";
      report.pickups.push(kind);
      log(`collected ${kind}`);
    }
    const memoryIds: Record<string, string | undefined> = {
      "minor-one": activeLevel().minorMemoryIds?.[0],
      "minor-two": activeLevel().minorMemoryIds?.[1],
      major: activeLevel().majorMemoryId,
    };
    for (const slot of ["minor-one", "minor-two"] as const) {
      const anchor = anchors.memories[slot];
      if (anchor.platformId !== platformId) continue;
      const id = memoryIds[slot];
      assert.ok(id, `${slot}: runtime memory id missing`);
      const taken = () =>
        ["revealed", "consumed"].includes(save().memories.find((memory) => memory.id === id)?.state ?? "");
      if (taken()) {
        if (!report.memories.some((memory) => memory.id === id)) {
          report.memories.push({ slot, id, byContact: true });
          log(`recovered ${slot} by contact on the way`);
        }
        continue;
      }
      if ((await collect(slot, platformId, anchor.position, taken)) === "moved") return "moved";
      report.memories.push({ slot, id });
      log(`recovered ${slot}`);
    }
    const slots = Object.entries(anchors.encounters)
      .filter(([, anchor]) => anchor?.platformId === platformId)
      .sort(([left], [right]) => Number(left === "boss") - Number(right === "boss"));
    for (const [slot] of slots) {
      const id =
        slot === "boss"
          ? (activeLevel().bossId ?? `${chapter.routeId}-boss`)
          : `${chapter.routeId}-encounter-${slot.replace("ordinary-", "")}`;
      assert.ok(activeLevel().encounters.some((item) => item.id === id), `${slot}: frozen encounter ${id} missing`);
      const outcome = await fight(slot, id, platformId);
      log(`fight ${slot}: ${outcome}`);
      if (outcome !== "done") return outcome;
    }
    const major = anchors.memories.major;
    if (major.platformId === platformId) {
      const id = memoryIds.major;
      assert.ok(id, "major: runtime memory id missing");
      for (let attempt = 0; attempt < 4 && !finished(); attempt += 1) {
        await walkToward(insideTop(platformId, major.position, 0.3));
        await idle(120, () => finished());
      }
      assert.ok(finished(), "the major memory did not complete the chapter");
      report.memories.push({ slot: "major", id });
      log("recovered major; chapter complete");
    }
    return "done";
  };

  try {
    await page.goto(url!, { waitUntil: "domcontentloaded" });
    const enter = page.getByRole("button", { name: "Enter Rat Casino", exact: true });
    await enter.waitFor({ state: "visible", timeout: 30_000 });
    await enter.click();
    await page.locator("canvas[data-quest-canvas=true]").waitFor({ timeout: 60_000 });
    let opening: FullInspection | null = null;
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      if (await page.evaluate(installHook, FRAME_SECONDS).catch(() => false)) {
        opening = (await page.evaluate(inspectFull).catch(() => null)) as FullInspection | null;
        if (opening?.routeId === chapter.routeId && opening.mediaLoading === 0 && latestSave) break;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.equal(opening?.routeId, chapter.routeId, "chapter route did not load");
    assert.deepEqual(opening!.growthMoves ?? ["jump"], [...abilities], "start-age moves differ");
    report.appearanceStage = opening!.appearanceStage;
    activeLevelId = activeLevel().id;
    await lockstep.pause();
    await drawing(drawEvery);
    await settle("spawn");
    await shot("spawn");

    const mainPath = document.mainPath;
    const midIndex = Math.floor(mainPath.length / 2);
    let index = 0;
    let midShot = false;
    let steps = 0;
    let airborneLeg = false;
    let outcome = await processPlatform(mainPath[0]!);
    while (!finished()) {
      steps += 1;
      assert.ok(steps < 500, "route exceeded its step bound");
      if (!airborneLeg) {
        const live = await readFull();
        if (outcome !== "done" || !live.grounded || !live.supportId || live.phase === "fallen") {
          const settled = await settle("resume");
          const at = mainPath.indexOf(settled.supportId!);
          if (at < 0) {
            // Off the main path (a catch floor or a branch): walk back to it.
            const back = mainPath
              .map((id) => pathBetween(settled.supportId!, id))
              .filter((path): path is string[] => path !== null)
              .sort((left, right) => left.length - right.length)[0];
            assert.ok(back, `no way back to the main path from ${settled.supportId}`);
            log(`back to the main path from ${settled.supportId}`);
            for (let step = 0; step + 1 < back.length; step += 1)
              if (!(await crossLeg(connection(back[step]!, back[step + 1]!)))) break;
            outcome = "moved";
            continue;
          }
          index = at;
          outcome = await processPlatform(mainPath[index]!);
          continue;
        }
        const at = mainPath.indexOf(live.supportId);
        if (at < 0) {
          outcome = "moved";
          continue;
        }
        index = at;
      }
      airborneLeg = false;
      if (index + 1 >= mainPath.length) {
        outcome = await processPlatform(mainPath[index]!);
        if (!finished()) throw new Error("reached the final platform without completing the chapter");
        break;
      }
      const edge = connection(mainPath[index]!, mainPath[index + 1]!);
      if (!(await crossLeg(edge))) {
        report.falls += 1;
        log(`did not cross ${edge.from}->${edge.to}; resuming from the live state`);
        outcome = "moved";
        continue;
      }
      index += 1;
      const target = level.course.platforms.find((platform) => platform.id === mainPath[index]);
      // A pad launches on contact: the next crossing starts mid-air.
      if (target?.bounce) {
        airborneLeg = true;
        continue;
      }
      if (!midShot && index >= midIndex) {
        await shot("mid-climb");
        midShot = true;
      }
      outcome = await processPlatform(mainPath[index]!);
    }
    await idle(45);
    await shot("complete");
    const final = save();
    report.completedLevelIds = final.adventure.completedLevelIds;
    assert.ok(final.adventure.completedLevelIds.includes(activeLevelId), "chapter not completed in the save");
    assert.equal(report.memories.filter((memory) => memory.slot.startsWith("minor")).length, 2);
    assert.equal(report.memories.filter((memory) => memory.slot === "major").length, 1);
    assert.equal(report.fights.length, 5);
    for (const memory of report.memories) {
      const state = final.memories.find((entry) => entry.id === memory.id)?.state;
      assert.ok(state === "revealed" || state === "consumed", `${memory.slot} is ${state} in the final save`);
    }
    report.result = "passed";
  } catch (error) {
    report.result = "failed";
    report.error = error instanceof Error ? (error.stack ?? error.message) : String(error);
    await shot("failure").catch(() => undefined);
  } finally {
    report.pageSeconds = Math.round(report.frames * FRAME_SECONDS * 10) / 10;
    report.wallSeconds = Math.round((Date.now() - started) / 100) / 10;
    await context.close();
  }
  return report;
}

const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage",
  ],
});
const reports: ChapterReport[] = [];
try {
  for (const chapter of chapters) {
    const report = await playChapter(browser, chapter);
    reports.push(report);
    console.log(
      JSON.stringify({
        chapter: report.chapterId,
        result: report.result,
        error: report.error?.split("\n")[0],
        legs: report.legs.length,
        replans: report.replans,
        maxDrift: Number(report.maxDrift.toFixed(4)),
        falls: report.falls,
        hpDefeats: report.hpDefeats,
        fights: report.fights.map((fight) => `${fight.slot}:${fight.attacks}`),
        memories: report.memories.map((memory) => memory.slot),
        pageSeconds: report.pageSeconds,
        wallSeconds: report.wallSeconds,
      }),
    );
  }
} finally {
  await browser.close();
  await fs.writeFile(
    `${outputDir}/report.json`,
    `${JSON.stringify({ world: project.projectId, url, chapters: reports }, null, 2)}\n`,
  );
}
if (reports.some((report) => report.result !== "passed")) process.exitCode = 1;
