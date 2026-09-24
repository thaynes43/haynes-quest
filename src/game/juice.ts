import type { PositionSnapshot } from "./types";

// Pure game-feel state (DESIGN-022). Rendering lives in the scene; these
// classes only decide how much to freeze, shake and emit so they stay testable.

/** Seconds of visual freeze on a landed hit. */
export const HIT_STOP_SECONDS = 0.07;
/** Trauma added to the camera shake per hit kind. */
export const HIT_SHAKE_TRAUMA = { primary: 0.3, secondary: 0.42 } as const;
/** How long a blocked attack press is held before it is discarded. */
export const ATTACK_BUFFER_MS = 300;
/** A press this close to the end of cooldown is held instead of refused. */
export const ATTACK_BUFFER_LEAD_MS = 250;
/** Delay from an accepted swing to its contact moment. */
export const PREDICTED_CONTACT_MS = 90;

export function prefersReducedMotion(
  view: Pick<Window, "matchMedia"> | null | undefined,
): boolean {
  try {
    return Boolean(
      view?.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    );
  } catch {
    return false;
  }
}

/**
 * A short freeze of visual time on contact. Physics, enemy simulation and
 * server timers keep wall-clock time; only animation time is held.
 */
export class HitStop {
  private remaining = 0;

  constructor(private readonly enabled = true) {}

  trigger(seconds = HIT_STOP_SECONDS): void {
    if (!this.enabled || !(seconds > 0)) return;
    this.remaining = Math.max(this.remaining, seconds);
  }

  /** Returns the visual delta for a frame of `deltaSeconds` wall time. */
  step(deltaSeconds: number): number {
    const delta = Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0);
    if (this.remaining <= 0) return delta;
    const frozen = Math.min(this.remaining, delta);
    this.remaining = Math.max(0, this.remaining - delta);
    return delta - frozen;
  }

  get active(): boolean {
    return this.remaining > 0;
  }
}

/** Trauma-based camera shake with a smooth, deterministic offset. */
export class CameraShake {
  private trauma = 0;

  constructor(
    private readonly enabled = true,
    private readonly maxOffset = 0.09,
    private readonly decayPerSecond = 2.4,
  ) {}

  add(amount: number): void {
    if (!this.enabled || !(amount > 0)) return;
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(deltaSeconds: number): void {
    const delta = Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0);
    this.trauma = Math.max(0, this.trauma - this.decayPerSecond * delta);
  }

  /** Offset for the camera at `timeSeconds`; exactly zero when calm. */
  offset(timeSeconds: number): PositionSnapshot {
    const magnitude = this.trauma * this.trauma * this.maxOffset;
    if (magnitude === 0) return { x: 0, y: 0, z: 0 };
    return {
      x: magnitude * Math.sin(timeSeconds * 47.3 + 1.1),
      y: magnitude * Math.sin(timeSeconds * 53.9 + 2.3),
      z: magnitude * 0.5 * Math.cos(timeSeconds * 41.1 + 0.7),
    };
  }

  get level(): number {
    return this.trauma;
  }
}

/** Holds one press for a short window so a blocked press is sent, not dropped. */
export class PressBuffer<T> {
  private held: { value: T; expiresAt: number } | null = null;

  constructor(private readonly windowMs = ATTACK_BUFFER_MS) {}

  hold(value: T, nowMs: number): void {
    this.held = { value, expiresAt: nowMs + this.windowMs };
  }

  /** The held value while it is fresh; an expired press is discarded. */
  peek(nowMs: number): T | null {
    if (!this.held) return null;
    if (nowMs > this.held.expiresAt) {
      this.held = null;
      return null;
    }
    return this.held.value;
  }

  clear(): void {
    this.held = null;
  }
}

export interface ParticleBurst {
  origin: PositionSnapshot;
  count: number;
  /** RGB hex colors, cycled across the burst. */
  colors: readonly number[];
  speed: number;
  /** Extra upward speed so bursts read as a fountain rather than a ring. */
  lift?: number;
  gravity?: number;
  lifeSeconds: number;
  size: number;
}

export interface Particle {
  alive: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size: number;
  color: number;
  gravity: number;
  spin: number;
}

/**
 * A fixed pool of short-lived particles. Bursts reuse the oldest slots when
 * the pool is full, so a flurry of hits never allocates or grows unbounded.
 */
export class ParticlePool {
  readonly particles: Particle[];
  private cursor = 0;
  private seed = 0x2f6e2b1;

  constructor(readonly capacity = 192) {
    this.particles = Array.from({ length: capacity }, () => ({
      alive: false,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      age: 0,
      life: 1,
      size: 0,
      color: 0xffffff,
      gravity: 0,
      spin: 0,
    }));
  }

  /** Deterministic pseudo-random numbers keep bursts reproducible in tests. */
  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }

  burst(burst: ParticleBurst): void {
    const count = Math.max(0, Math.min(this.capacity, Math.floor(burst.count)));
    for (let index = 0; index < count; index++) {
      const particle = this.particles[this.cursor]!;
      this.cursor = (this.cursor + 1) % this.capacity;
      const angle = this.random() * Math.PI * 2;
      const elevation = this.random() * 0.9 + 0.1;
      const speed = burst.speed * (0.55 + this.random() * 0.45);
      particle.alive = true;
      particle.x = burst.origin.x;
      particle.y = burst.origin.y;
      particle.z = burst.origin.z;
      particle.vx = Math.cos(angle) * speed * (1 - elevation * 0.5);
      particle.vz = Math.sin(angle) * speed * (1 - elevation * 0.5);
      particle.vy = speed * elevation + (burst.lift ?? 0);
      particle.age = 0;
      particle.life = burst.lifeSeconds * (0.7 + this.random() * 0.3);
      particle.size = burst.size;
      particle.color = burst.colors[index % burst.colors.length] ?? 0xffffff;
      particle.gravity = burst.gravity ?? -6;
      particle.spin = (this.random() - 0.5) * 12;
    }
  }

  step(deltaSeconds: number): void {
    const delta = Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0);
    if (delta === 0) return;
    const drag = Math.exp(-2.2 * delta);
    for (const particle of this.particles) {
      if (!particle.alive) continue;
      particle.age += delta;
      if (particle.age >= particle.life) {
        particle.alive = false;
        continue;
      }
      particle.vy += particle.gravity * delta;
      particle.vx *= drag;
      particle.vz *= drag;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.z += particle.vz * delta;
    }
  }

  /** Remaining scale in 0..1: particles pop in quickly and shrink out. */
  static scaleOf(particle: Particle): number {
    if (!particle.alive) return 0;
    const t = particle.age / particle.life;
    const grow = Math.min(1, t / 0.12);
    return grow * (1 - t) * particle.size;
  }

  get aliveCount(): number {
    return this.particles.reduce(
      (total, particle) => total + (particle.alive ? 1 : 0),
      0,
    );
  }

  clear(): void {
    for (const particle of this.particles) particle.alive = false;
  }
}
