/**
 * DESIGN-027 scary moments: pure timing and placement rules. Rendering lives
 * in `scare-scene.ts`; `createGame` owns the clocks and feeds these classes the
 * player's state, so every rule here is deterministic and testable.
 *
 * Level 0 never constructs anything from this module's runtime classes, which
 * keeps an unscary chapter byte-identical to the game before DESIGN-027.
 */
import {
  authoredScareLevel,
  isAuthoredSurfacePiece,
  type AuthoredArena,
  type AuthoredLevelDocument,
  type AuthoredScareLevel,
  type AuthoredScriptedScare,
  type AuthoredSurfacePiece,
} from "../shared/authored-level";
import { connectionStrips } from "../shared/family-world-lint";
import type { ObbyCourse, ObbyMotion } from "./obby";
import type { PositionSnapshot } from "./types";

export type ScareLevel = AuthoredScareLevel;

/** DESIGN-027 timings, in seconds unless named otherwise. */
export const SCARE_TIMING = Object.freeze({
  /** Level 1+: practical lights dip every 3–9 s for 0.1–0.4 s (D-03). */
  flickerInterval: Object.freeze([3, 9] as const),
  flickerDip: Object.freeze([0.1, 0.4] as const),
  /** Level 2: a blackout every 35–60 s, about 1.2 s long (D-03). */
  blackoutInterval: Object.freeze([35, 60] as const),
  blackoutSeconds: 1.2,
  /** How long the lights take to die, and to stutter back at the end. */
  blackoutFadeOut: 0.06,
  blackoutReturn: 0.28,
  /** No blackout within this long of starting a jump, drop or bounce (D-03). */
  launchGuard: 2,
  /**
   * No blackout within this long of landing or stepping off a ride: a glide
   * can outlast the launch guard, and a player who just landed is often a
   * step from the next jump.
   */
  settleGuard: 1,
  /**
   * No blackout within this far (metres, horizontally) of a sweeper's reach
   * or a mover's travel: about the ground a full-speed run covers in one
   * blackout (1.2 s × 3.1 m/s) plus a body.
   */
  hazardClearance: 4,
  /** …at a similar height: within this far above or below its reach or travel. */
  hazardHeightBand: 2.5,
  /** No blackout in the first 10 s after a checkpoint recovery (D-03). */
  recoveryGuard: 10,
  /** Level 2 random distant laughter (D-06). */
  laughInterval: Object.freeze([20, 45] as const),
  /** Jump scares: at most once per 60 s, never in a blackout's first 0.3 s (D-05). */
  jumpScareCooldown: 60,
  jumpScareBlackoutGrace: 0.3,
  /** The lunge lasts about 0.9 s; reduced motion makes it a 0.5 s cut (D-05). */
  lungeMs: 900,
  reducedMotionLungeMs: 500,
  /** A watcher changes once per unseen spell, after this long out of view (D-04). */
  watcherUnseen: Object.freeze([1.2, 3.5] as const),
  /** Watchers move at most 1.5 m from where the chapter placed them (D-04). */
  watcherMaxShuffle: 1.5,
  /** A shuffle never lands closer than this to the player. */
  watcherPlayerClearance: 1.6,
});

/** The ordinary enemy body radius that must stay off connection strips. */
export const WATCHER_BODY_RADIUS = 0.42;

/** DESIGN-027 D-02: the parent switch caps every chapter at level 0. */
export function effectiveScareLevel(
  document: Pick<AuthoredLevelDocument, "scare"> | null | undefined,
  scaryMoments: boolean,
): ScareLevel {
  return scaryMoments ? authoredScareLevel(document) : 0;
}

/** A small deterministic generator (mulberry32) so timings replay in tests. */
export function scareRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable seed from text, such as a route id. */
export function scareSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function between(random: () => number, range: readonly [number, number]): number {
  return range[0] + random() * (range[1] - range[0]);
}

// ---------------------------------------------------------------------------
// Blackout safety (D-03)
// ---------------------------------------------------------------------------

export interface BlackoutSafety {
  /** The player is off the ground. */
  readonly airborne: boolean;
  /** The player stands on a moving platform, lift or crumbling platform. */
  readonly riding: boolean;
  /** Seconds since the player last left the ground (jump, drop or bounce). */
  readonly sinceLaunch: number;
  /** Seconds since the player was last airborne or riding: since landing. */
  readonly sinceSettled: number;
  /** Seconds since the last checkpoint recovery. */
  readonly sinceRecovery: number;
  /** The player stands near a sweeper or a mover (`nearBlackoutHazard`). */
  readonly nearHazard: boolean;
}

export function blackoutAllowed(safety: BlackoutSafety): boolean {
  return (
    !safety.airborne &&
    !safety.riding &&
    !safety.nearHazard &&
    safety.sinceLaunch >= SCARE_TIMING.launchGuard &&
    safety.sinceSettled >= SCARE_TIMING.settleGuard &&
    safety.sinceRecovery >= SCARE_TIMING.recoveryGuard
  );
}

/** A world-space box a blackout keeps clear of. */
export interface BlackoutHazardZone {
  readonly id: string;
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

function motionReach(motion: ObbyMotion | undefined, axis: "x" | "y" | "z"): number {
  if (!motion || motion.axis !== axis) return 0;
  if (!(Number.isFinite(motion.period) && motion.period > 0)) return 0;
  const distance = Math.abs(motion.distance);
  return Number.isFinite(distance) ? distance : 0;
}

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Where a blackout would hide something that can knock the player back to a
 * checkpoint (D-03 blackout safety): every sweeper's full reach and every
 * moving platform's or lift's full travel, grown by `hazardClearance`
 * horizontally and `hazardHeightBand` vertically. Crumbling platforms and
 * bounce pads stay put until touched, so only riding them holds a blackout.
 */
export function blackoutHazardZones(
  course: Pick<ObbyCourse, "platforms" | "hazards"> | null | undefined,
): readonly BlackoutHazardZone[] {
  if (!course) return [];
  const { hazardClearance: clear, hazardHeightBand: band } = SCARE_TIMING;
  const zones: BlackoutHazardZone[] = [];
  for (const hazard of course.hazards ?? []) {
    const halfLength = Math.abs(finite(hazard.halfLength));
    const radius = Math.abs(finite(hazard.radius));
    const rotating =
      hazard.rotation !== undefined &&
      Number.isFinite(hazard.rotation.period) &&
      hazard.rotation.period > 0;
    const angle = finite(hazard.rotation?.phase ?? 0);
    // A turning bar sweeps a disc; a still one lies along its phase angle.
    const reachX = (rotating ? halfLength : Math.abs(Math.cos(angle)) * halfLength) + radius;
    const reachZ = (rotating ? halfLength : Math.abs(Math.sin(angle)) * halfLength) + radius;
    const x = finite(hazard.center.x);
    const y = finite(hazard.center.y);
    const z = finite(hazard.center.z);
    const moveX = motionReach(hazard.motion, "x");
    const moveY = motionReach(hazard.motion, "y");
    const moveZ = motionReach(hazard.motion, "z");
    zones.push({
      id: String(hazard.id),
      minX: x - reachX - moveX - clear,
      maxX: x + reachX + moveX + clear,
      minY: y - radius - moveY - band,
      maxY: y + radius + moveY + band,
      minZ: z - reachZ - moveZ - clear,
      maxZ: z + reachZ + moveZ + clear,
    });
  }
  for (const platform of course.platforms ?? []) {
    const motion = platform.motion;
    if (!motion || !(Number.isFinite(motion.period) && motion.period > 0)) continue;
    if (!(Math.abs(finite(motion.distance)) > 0)) continue;
    const half = {
      x: Math.abs(finite(platform.size.x)) / 2,
      y: Math.abs(finite(platform.size.y)) / 2,
      z: Math.abs(finite(platform.size.z)) / 2,
    };
    const x = finite(platform.center.x);
    const y = finite(platform.center.y);
    const z = finite(platform.center.z);
    zones.push({
      id: String(platform.id),
      minX: x - half.x - motionReach(motion, "x") - clear,
      maxX: x + half.x + motionReach(motion, "x") + clear,
      minY: y - half.y - motionReach(motion, "y") - band,
      maxY: y + half.y + motionReach(motion, "y") + band,
      minZ: z - half.z - motionReach(motion, "z") - clear,
      maxZ: z + half.z + motionReach(motion, "z") + clear,
    });
  }
  return zones;
}

/** Whether a player standing at `position` (feet) is inside any hazard zone. */
export function nearBlackoutHazard(
  zones: readonly BlackoutHazardZone[],
  position: PositionSnapshot,
): boolean {
  return zones.some(
    (zone) =>
      position.x >= zone.minX &&
      position.x <= zone.maxX &&
      position.y >= zone.minY &&
      position.y <= zone.maxY &&
      position.z >= zone.minZ &&
      position.z <= zone.maxZ,
  );
}

/** A spot only catches a player whose feet are on its own floor. */
export function insideScriptedScareSpot(
  spot: Pick<AuthoredScriptedScare, "position" | "radius">,
  player: PositionSnapshot,
): boolean {
  return (
    Math.abs(player.y - spot.position.y) <= 0.3 &&
    Math.hypot(player.x - spot.position.x, player.z - spot.position.z) <= spot.radius
  );
}

// ---------------------------------------------------------------------------
// Lighting director (D-03, D-06)
// ---------------------------------------------------------------------------

export interface ScareLighting {
  readonly level: ScareLevel;
  /** 1 during a practical-light dip, else 0. */
  readonly flicker: number;
  /** 0 lit … 1 fully dark. */
  readonly blackout: number;
  /** Seconds since the current blackout started, or null outside one. */
  readonly blackoutElapsed: number | null;
}

export interface ScareStepEvents {
  readonly blackoutStarted: boolean;
  /** The lights came back on their own (a lunge ending one early does not count). */
  readonly blackoutEnded: boolean;
  readonly laugh: boolean;
}

const NO_EVENTS: ScareStepEvents = Object.freeze({
  blackoutStarted: false,
  blackoutEnded: false,
  laugh: false,
});

export interface ScareStepOptions {
  /** Hold any new blackout, as a lunge does. */
  readonly holdBlackouts?: boolean;
  /** The player stands near a sweeper or a mover (`nearBlackoutHazard`). */
  readonly nearHazard?: boolean;
}

/**
 * Owns the scare clock: flicker dips from level 1, blackouts and distant
 * laughter at level 2. The clock only advances while the world is active, so
 * a pause or a menu never counts toward the next scare.
 */
export class ScareDirector {
  private clock = 0;
  private nextFlickerAt: number;
  private dipUntil = -1;
  private nextBlackoutAt: number;
  private blackoutStart: number | null = null;
  private nextLaughAt: number;
  private lastLaunchAt = Number.NEGATIVE_INFINITY;
  private lastUnsettledAt = Number.NEGATIVE_INFINITY;
  private lastRecoveryAt = Number.NEGATIVE_INFINITY;
  /** Totals for inspection and tests. */
  blackouts = 0;
  flickers = 0;

  constructor(
    readonly level: ScareLevel,
    private readonly random: () => number,
  ) {
    this.nextFlickerAt = between(random, SCARE_TIMING.flickerInterval);
    this.nextBlackoutAt = between(random, SCARE_TIMING.blackoutInterval);
    this.nextLaughAt = between(random, SCARE_TIMING.laughInterval);
  }

  get time(): number {
    return this.clock;
  }

  /** The player just left the ground: a jump, a drop or a bounce. */
  noteLaunch(): void {
    this.lastLaunchAt = this.clock;
  }

  /**
   * A checkpoint recovery (a fall or a retry) just placed the player. Any
   * blackout ends with it: the player arrives in a lit room.
   */
  noteRecovery(): void {
    this.lastRecoveryAt = this.clock;
    this.endBlackout();
  }

  safety(airborne: boolean, riding: boolean, nearHazard = false): BlackoutSafety {
    return {
      airborne,
      riding,
      sinceLaunch: this.clock - this.lastLaunchAt,
      sinceSettled: airborne || riding ? 0 : this.clock - this.lastUnsettledAt,
      sinceRecovery: this.clock - this.lastRecoveryAt,
      nearHazard,
    };
  }

  /** Ends a running blackout at once, as a jump scare's lunge does. */
  endBlackout(): void {
    if (this.blackoutStart === null) return;
    this.blackoutStart = null;
    this.nextBlackoutAt = this.clock + between(this.random, SCARE_TIMING.blackoutInterval);
  }

  /**
   * Advances the clock by `deltaSeconds` of active world time. `airborne` and
   * `riding` describe the player now; a due blackout waits until it is safe.
   */
  step(
    deltaSeconds: number,
    airborne: boolean,
    riding: boolean,
    options: ScareStepOptions = {},
  ): ScareStepEvents {
    if (this.level === 0) return NO_EVENTS;
    const delta = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
    this.clock += delta;
    const now = this.clock;
    if (airborne || riding) this.lastUnsettledAt = now;
    if (now >= this.nextFlickerAt && now >= this.dipUntil) {
      this.dipUntil = now + between(this.random, SCARE_TIMING.flickerDip);
      this.nextFlickerAt = this.dipUntil + between(this.random, SCARE_TIMING.flickerInterval);
      this.flickers += 1;
    }
    if (this.level < 2) return NO_EVENTS;
    let blackoutStarted = false;
    let blackoutEnded = false;
    if (
      this.blackoutStart !== null &&
      now - this.blackoutStart >= SCARE_TIMING.blackoutSeconds
    ) {
      this.blackoutStart = null;
      this.nextBlackoutAt = now + between(this.random, SCARE_TIMING.blackoutInterval);
      blackoutEnded = true;
    }
    if (
      this.blackoutStart === null &&
      !blackoutEnded &&
      !options.holdBlackouts &&
      now >= this.nextBlackoutAt &&
      blackoutAllowed(this.safety(airborne, riding, options.nearHazard ?? false))
    ) {
      this.blackoutStart = now;
      this.blackouts += 1;
      blackoutStarted = true;
    }
    let laugh = false;
    if (now >= this.nextLaughAt) {
      this.nextLaughAt = now + between(this.random, SCARE_TIMING.laughInterval);
      laugh = true;
    }
    return blackoutStarted || blackoutEnded || laugh
      ? { blackoutStarted, blackoutEnded, laugh }
      : NO_EVENTS;
  }

  lighting(): ScareLighting {
    const elapsed = this.blackoutStart === null ? null : this.clock - this.blackoutStart;
    return {
      level: this.level,
      flicker: this.level >= 1 && this.clock < this.dipUntil ? 1 : 0,
      blackout: elapsed === null ? 0 : blackoutDarkness(elapsed),
      blackoutElapsed: elapsed,
    };
  }
}

/**
 * The darkness curve of one blackout: the lights die in 60 ms, stay dark and
 * stutter back over the last 0.28 s (on, off, on), under the light-buzz cue.
 */
export function blackoutDarkness(elapsed: number): number {
  const { blackoutSeconds, blackoutFadeOut, blackoutReturn } = SCARE_TIMING;
  if (!(elapsed >= 0) || elapsed >= blackoutSeconds) return 0;
  if (elapsed < blackoutFadeOut) return elapsed / blackoutFadeOut;
  const untilEnd = blackoutSeconds - elapsed;
  if (untilEnd > blackoutReturn) return 1;
  const phase = 1 - untilEnd / blackoutReturn;
  return phase < 0.3 ? 0.35 : phase < 0.55 ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Jump scares (D-05)
// ---------------------------------------------------------------------------

/** At most one jump scare per minute of wall time, never early in a blackout. */
export class JumpScareGate {
  private lastAtSeconds = Number.NEGATIVE_INFINITY;

  allowed(nowSeconds: number, blackoutElapsed: number | null): boolean {
    if (nowSeconds - this.lastAtSeconds < SCARE_TIMING.jumpScareCooldown) return false;
    return !(blackoutElapsed !== null && blackoutElapsed < SCARE_TIMING.jumpScareBlackoutGrace);
  }

  trigger(nowSeconds: number): void {
    this.lastAtSeconds = nowSeconds;
  }
}

export function lungeDurationMs(reducedMotion: boolean): number {
  return reducedMotion ? SCARE_TIMING.reducedMotionLungeMs : SCARE_TIMING.lungeMs;
}

/** The lunge the scene frames, with its progress from 0 to 1. */
export interface ScareLunge {
  readonly encounterId: string;
  readonly progress: number;
  readonly reducedMotion: boolean;
}

/** Everything the scene needs from the scare runtime for one frame. */
export interface ScareFrame extends ScareLighting {
  readonly lunge: ScareLunge | null;
}

// ---------------------------------------------------------------------------
// Watchers (D-04)
// ---------------------------------------------------------------------------

interface Rect {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/**
 * Every connection strip and pad/lift approach of a level (the same strips the
 * family-world lint keeps fights off), grown by a watcher's body radius.
 */
export function watcherBlockedZones(
  document: Pick<AuthoredLevelDocument, "pieces" | "connections"> | null | undefined,
): readonly Rect[] {
  if (!document) return [];
  const surfaces = new Map<string, AuthoredSurfacePiece>();
  for (const piece of document.pieces)
    if (isAuthoredSurfacePiece(piece)) surfaces.set(piece.id, piece);
  const zones: Rect[] = [];
  for (const connection of document.connections) {
    const from = surfaces.get(connection.from);
    const to = surfaces.get(connection.to);
    if (!from || !to) continue;
    for (const strip of connectionStrips(from, to))
      zones.push({
        minX: strip.minX - WATCHER_BODY_RADIUS,
        maxX: strip.maxX + WATCHER_BODY_RADIUS,
        minZ: strip.minZ - WATCHER_BODY_RADIUS,
        maxZ: strip.maxZ + WATCHER_BODY_RADIUS,
      });
  }
  return zones;
}

export function insideZone(zones: readonly Rect[], x: number, z: number): boolean {
  return zones.some(
    (zone) => x > zone.minX && x < zone.maxX && z > zone.minZ && z < zone.maxZ,
  );
}

function insideArena(arena: AuthoredArena | undefined, x: number, z: number): boolean {
  return (
    !arena ||
    (x >= arena.minX && x <= arena.maxX && z >= arena.minZ && z <= arena.maxZ)
  );
}

/**
 * How the watcher rules size a sleeping animatronic for the camera. The body
 * is a cylinder around the enemy's feet: `watcherBody` sizes it from the
 * model's height until the scene can measure the loaded model.
 */
export const WATCHER_VIEW = Object.freeze({
  /** Body radius: at least this, or this share of the model's height. */
  minRadius: 0.6,
  radiusPerHeight: 0.45,
  /** Room above the model for its health bar (drawn 0.2 m above the head). */
  headroom: 0.3,
  /**
   * Grown onto every "could the camera see it?" test, so a watcher never
   * changes at the frame's edge: for an idle pose's lean, a skinned idle and
   * one frame of camera motion.
   */
  margin: 0.5,
  /** Beyond this many metres from the camera a watcher is not "seen again". */
  seenRange: 20,
  /** How often a changed watcher in the frustum asks whether it is really seen. */
  seenCheckSeconds: 0.1,
});

/** A watcher's view body before the scene has measured its model. */
export function watcherBody(modelHeight: number | null | undefined): {
  readonly radius: number;
  readonly height: number;
} {
  const height =
    typeof modelHeight === "number" && Number.isFinite(modelHeight) && modelHeight > 0
      ? modelHeight
      : 1.35;
  return {
    radius: Math.max(WATCHER_VIEW.minRadius, height * WATCHER_VIEW.radiusPerHeight),
    height: height + WATCHER_VIEW.headroom,
  };
}

/** A dormant ordinary enemy the watcher rules may change this frame. */
export interface WatcherCandidate {
  readonly id: string;
  readonly position: PositionSnapshot;
  /** Where the chapter placed it; every shuffle stays within 1.5 m of here. */
  readonly spawn: PositionSnapshot;
  readonly facing: number;
  readonly pose: number;
  readonly arena?: AuthoredArena;
}

/** What the camera can see, as the watcher rules ask it (D-04). */
export interface WatcherView {
  /**
   * Whether any part of this watcher, standing at `position`, could be inside
   * the camera frustum. It must be conservative (padded by
   * `WATCHER_VIEW.margin`): a watcher changes only while this is false both
   * where it stands and where a shuffle would put it.
   */
  inView(candidate: WatcherCandidate, position: PositionSnapshot): boolean;
  /**
   * Whether the player really sees the watcher now: on screen, within
   * `WATCHER_VIEW.seenRange` and not hidden behind scenery. Only asked of a
   * changed watcher that `inView` reports; absent, `inView` is taken as seen.
   */
  seen?(candidate: WatcherCandidate): boolean;
}

export type WatcherChange = "turn" | "pose" | "shuffle";

export interface WatcherMove {
  readonly id: string;
  readonly change: WatcherChange;
  readonly position: PositionSnapshot;
  readonly facing: number;
  readonly pose: number;
}

export interface WatcherStep {
  readonly moves: readonly WatcherMove[];
  /** Watchers seen again after changing unseen; each creaks once. */
  readonly creaks: readonly string[];
}

/** The number of idle poses a watcher cycles through (0 is the authored stance). */
export const WATCHER_POSES = 4;

function facingToward(from: PositionSnapshot, to: PositionSnapshot): number {
  // Matches the enemy simulation: a facing of θ looks along (−sin θ, −cos θ).
  return Math.atan2(-(to.x - from.x), -(to.z - from.z));
}

interface WatcherState {
  /** The current unseen spell, or null while the watcher is in the frustum. */
  spell: { seconds: number; threshold: number; changed: boolean } | null;
  /** It changed unseen and has not been seen since: it creaks when it is. */
  pendingCreak: boolean;
  /** Seconds until the next `seen` check. */
  seenCheckIn: number;
}

/**
 * Decides when an unwatched sleeping animatronic turns, changes pose or
 * shuffles. It only ever changes a watcher while it is outside the camera
 * frustum, never moves one to where the camera could see it, changes it at
 * most once per unseen spell, and reports a creak the first time the player
 * really sees it again.
 */
export class WatcherDirector {
  private readonly states = new Map<string, WatcherState>();
  moves = 0;
  /** Creaks so far, and the watchers of the latest step that had any, for inspection. */
  creaks = 0;
  lastCreakIds: readonly string[] = [];

  constructor(
    private readonly random: () => number,
    private readonly blocked: readonly Rect[],
  ) {}

  /** Forget a watcher, for example once it wakes or the level resets. */
  forget(id?: string): void {
    if (id === undefined) this.states.clear();
    else this.states.delete(id);
  }

  step(
    deltaSeconds: number,
    candidates: readonly WatcherCandidate[],
    player: PositionSnapshot,
    view: WatcherView,
  ): WatcherStep {
    const delta = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
    const moves: WatcherMove[] = [];
    const creaks: string[] = [];
    const present = new Set<string>();
    for (const candidate of candidates) {
      present.add(candidate.id);
      const state = this.states.get(candidate.id);
      if (view.inView(candidate, candidate.position)) {
        if (!state) continue;
        state.spell = null;
        if (!state.pendingCreak) {
          this.states.delete(candidate.id);
          continue;
        }
        state.seenCheckIn -= delta;
        if (state.seenCheckIn > 1e-6) continue;
        state.seenCheckIn = WATCHER_VIEW.seenCheckSeconds;
        if (view.seen ? view.seen(candidate) : true) {
          creaks.push(candidate.id);
          this.states.delete(candidate.id);
        }
        continue;
      }
      const current = state ?? { spell: null, pendingCreak: false, seenCheckIn: 0 };
      if (!state) this.states.set(candidate.id, current);
      current.seenCheckIn = 0;
      current.spell ??= {
        seconds: 0,
        threshold: between(this.random, SCARE_TIMING.watcherUnseen),
        changed: false,
      };
      const spell = current.spell;
      spell.seconds += delta;
      if (spell.changed || spell.seconds < spell.threshold) continue;
      const move = this.choose(candidate, player, view);
      spell.changed = true;
      if (move) {
        current.pendingCreak = true;
        this.moves += 1;
        moves.push(move);
      }
    }
    for (const id of [...this.states.keys()]) if (!present.has(id)) this.states.delete(id);
    if (creaks.length > 0) {
      this.creaks += creaks.length;
      this.lastCreakIds = Object.freeze([...creaks]);
    }
    return { moves, creaks };
  }

  private choose(
    candidate: WatcherCandidate,
    player: PositionSnapshot,
    view: WatcherView,
  ): WatcherMove | null {
    const roll = this.random();
    const towardPlayer = facingToward(candidate.position, player);
    if (roll < 0.45) {
      const position = this.shuffleTarget(candidate, player, view);
      if (position)
        return {
          id: candidate.id,
          change: "shuffle",
          position,
          facing: facingToward(position, player),
          pose: candidate.pose,
        };
    }
    if (roll < 0.75) {
      return {
        id: candidate.id,
        change: "turn",
        position: { ...candidate.position },
        facing: towardPlayer,
        pose: candidate.pose,
      };
    }
    const pose = (candidate.pose + 1 + Math.floor(this.random() * (WATCHER_POSES - 1))) % WATCHER_POSES;
    return {
      id: candidate.id,
      change: "pose",
      position: { ...candidate.position },
      facing: towardPlayer,
      pose,
    };
  }

  private shuffleTarget(
    candidate: WatcherCandidate,
    player: PositionSnapshot,
    view: WatcherView,
  ): PositionSnapshot | null {
    const { watcherMaxShuffle, watcherPlayerClearance } = SCARE_TIMING;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const angle = this.random() * Math.PI * 2;
      const distance = 0.5 + this.random() * (watcherMaxShuffle - 0.5);
      const x = candidate.position.x + Math.sin(angle) * distance;
      const z = candidate.position.z + Math.cos(angle) * distance;
      if (Math.hypot(x - candidate.spawn.x, z - candidate.spawn.z) > watcherMaxShuffle) continue;
      if (Math.hypot(x - candidate.position.x, z - candidate.position.z) > watcherMaxShuffle) continue;
      if (!insideArena(candidate.arena, x, z)) continue;
      if (insideZone(this.blocked, x, z)) continue;
      if (Math.hypot(x - player.x, z - player.z) < watcherPlayerClearance) continue;
      const position = { x, y: candidate.position.y, z };
      // D-04: never step into the frame, even just past its edge.
      if (view.inView(candidate, position)) continue;
      return position;
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Radio showman static (D-06)
// ---------------------------------------------------------------------------

/** The radio showman's model id, and the candidate id its placeholder uses today. */
export const RADIO_SHOWMAN_ID = "radio-host-showman";

export function isRadioShowman(
  content: { readonly assetId?: string; readonly catalogEntryId?: string } | undefined,
): boolean {
  if (!content) return false;
  return (
    content.assetId === RADIO_SHOWMAN_ID ||
    content.catalogEntryId === RADIO_SHOWMAN_ID ||
    content.catalogEntryId === `editor-candidate-${RADIO_SHOWMAN_ID}`
  );
}
