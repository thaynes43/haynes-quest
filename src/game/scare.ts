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
  type AuthoredSurfacePiece,
} from "../shared/authored-level";
import { connectionStrips } from "../shared/family-world-lint";
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
  /** Seconds since the last checkpoint recovery. */
  readonly sinceRecovery: number;
}

export function blackoutAllowed(safety: BlackoutSafety): boolean {
  return (
    !safety.airborne &&
    !safety.riding &&
    safety.sinceLaunch >= SCARE_TIMING.launchGuard &&
    safety.sinceRecovery >= SCARE_TIMING.recoveryGuard
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

  safety(airborne: boolean, riding: boolean): BlackoutSafety {
    return {
      airborne,
      riding,
      sinceLaunch: this.clock - this.lastLaunchAt,
      sinceRecovery: this.clock - this.lastRecoveryAt,
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
    holdBlackouts = false,
  ): ScareStepEvents {
    if (this.level === 0) return NO_EVENTS;
    const delta = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
    this.clock += delta;
    const now = this.clock;
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
      !holdBlackouts &&
      now >= this.nextBlackoutAt &&
      blackoutAllowed(this.safety(airborne, riding))
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

/** A dormant ordinary enemy the watcher rules may change this frame. */
export interface WatcherCandidate {
  readonly id: string;
  readonly position: PositionSnapshot;
  /** Where the chapter placed it; every shuffle stays within 1.5 m of here. */
  readonly spawn: PositionSnapshot;
  readonly facing: number;
  readonly pose: number;
  readonly arena?: AuthoredArena;
  /** Whether any part of it is inside the camera frustum this frame. */
  readonly inView: boolean;
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

/**
 * Decides when an unwatched sleeping animatronic turns, changes pose or
 * shuffles. It only ever changes a watcher while it is outside the camera
 * frustum, at most once per unseen spell, and reports a creak the first time
 * it is seen again.
 */
export class WatcherDirector {
  private readonly unseen = new Map<string, { seconds: number; threshold: number; changed: boolean }>();
  moves = 0;

  constructor(
    private readonly random: () => number,
    private readonly blocked: readonly Rect[],
  ) {}

  /** Forget a watcher, for example once it wakes or the level resets. */
  forget(id?: string): void {
    if (id === undefined) this.unseen.clear();
    else this.unseen.delete(id);
  }

  step(
    deltaSeconds: number,
    candidates: readonly WatcherCandidate[],
    player: PositionSnapshot,
  ): WatcherStep {
    const moves: WatcherMove[] = [];
    const creaks: string[] = [];
    const present = new Set<string>();
    for (const candidate of candidates) {
      present.add(candidate.id);
      let state = this.unseen.get(candidate.id);
      if (candidate.inView) {
        if (state?.changed) creaks.push(candidate.id);
        this.unseen.delete(candidate.id);
        continue;
      }
      if (!state) {
        state = {
          seconds: 0,
          threshold: between(this.random, SCARE_TIMING.watcherUnseen),
          changed: false,
        };
        this.unseen.set(candidate.id, state);
      }
      state.seconds += Math.max(0, deltaSeconds);
      if (state.changed || state.seconds < state.threshold) continue;
      const move = this.choose(candidate, player);
      state.changed = true;
      if (move) {
        this.moves += 1;
        moves.push(move);
      }
    }
    for (const id of [...this.unseen.keys()]) if (!present.has(id)) this.unseen.delete(id);
    return { moves, creaks };
  }

  private choose(candidate: WatcherCandidate, player: PositionSnapshot): WatcherMove | null {
    const roll = this.random();
    const towardPlayer = facingToward(candidate.position, player);
    if (roll < 0.45) {
      const position = this.shuffleTarget(candidate, player);
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
      return { x, y: candidate.position.y, z };
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
