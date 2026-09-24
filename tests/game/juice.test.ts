import { describe, expect, it } from "vitest";

import { EffectsScene } from "../../src/game/effects-scene";
import {
  CameraShake,
  HIT_STOP_SECONDS,
  HitStop,
  ParticlePool,
  PressBuffer,
  prefersReducedMotion,
} from "../../src/game/juice";

describe("hit-stop", () => {
  it("freezes visual time for the stop and then resumes exactly", () => {
    const stop = new HitStop();
    stop.trigger();
    let visual = 0;
    let wall = 0;
    while (wall < HIT_STOP_SECONDS - 1e-9) {
      visual += stop.step(0.016);
      wall += 0.016;
    }
    // Only the part of the last frame after the stop ends advances visuals.
    expect(visual).toBeCloseTo(wall - HIT_STOP_SECONDS, 9);
    expect(stop.active).toBe(false);
    expect(stop.step(0.016)).toBeCloseTo(0.016, 9);
  });

  it("keeps the longer of overlapping stops and ignores invalid input", () => {
    const stop = new HitStop();
    stop.trigger(0.05);
    stop.trigger(0.02);
    expect(stop.step(0.04)).toBe(0);
    expect(stop.step(0.04)).toBeCloseTo(0.03, 9);
    stop.trigger(Number.NaN);
    expect(stop.active).toBe(false);
    expect(stop.step(Number.NaN)).toBe(0);
  });

  it("never freezes when reduced motion is requested", () => {
    const stop = new HitStop(false);
    stop.trigger(0.2);
    expect(stop.active).toBe(false);
    expect(stop.step(0.016)).toBeCloseTo(0.016, 9);
  });
});

describe("camera shake", () => {
  it("offsets the camera briefly and settles to exactly zero", () => {
    const shake = new CameraShake();
    expect(shake.offset(1)).toEqual({ x: 0, y: 0, z: 0 });
    shake.add(0.3);
    const offsets = [0.01, 0.05, 0.09].map((time) => shake.offset(time));
    expect(
      offsets.some((offset) => Math.hypot(offset.x, offset.y, offset.z) > 0),
    ).toBe(true);
    for (const offset of offsets)
      expect(Math.hypot(offset.x, offset.y, offset.z)).toBeLessThan(0.1);
    shake.update(1);
    expect(shake.level).toBe(0);
    expect(shake.offset(2)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("caps trauma and stays still under reduced motion", () => {
    const shake = new CameraShake();
    shake.add(5);
    expect(shake.level).toBe(1);
    const calm = new CameraShake(false);
    calm.add(1);
    expect(calm.level).toBe(0);
    expect(calm.offset(0.3)).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe("press buffer", () => {
  it("holds one press within its window and discards a stale press", () => {
    const buffer = new PressBuffer<"primary" | "secondary">(300);
    expect(buffer.peek(0)).toBeNull();
    buffer.hold("primary", 1000);
    expect(buffer.peek(1200)).toBe("primary");
    buffer.hold("secondary", 1250);
    expect(buffer.peek(1500)).toBe("secondary");
    expect(buffer.peek(1551)).toBeNull();
    expect(buffer.peek(1552)).toBeNull();
    buffer.hold("primary", 2000);
    buffer.clear();
    expect(buffer.peek(2001)).toBeNull();
  });
});

describe("particle pool", () => {
  const burst = {
    origin: { x: 1, y: 2, z: 3 },
    count: 12,
    colors: [0xffcc00, 0xaa66ff],
    speed: 3,
    lift: 1,
    lifeSeconds: 0.5,
    size: 0.1,
  };

  it("emits, moves, shrinks and retires a burst without growing", () => {
    const pool = new ParticlePool(32);
    pool.burst(burst);
    expect(pool.aliveCount).toBe(12);
    const alive = pool.particles.filter((particle) => particle.alive);
    expect(new Set(alive.map((particle) => particle.color))).toEqual(
      new Set([0xffcc00, 0xaa66ff]),
    );
    pool.step(0.05);
    expect(alive.every((particle) => particle.y > 2)).toBe(true);
    expect(alive.every((particle) => ParticlePool.scaleOf(particle) > 0)).toBe(
      true,
    );
    for (let frame = 0; frame < 40; frame++) pool.step(0.02);
    expect(pool.aliveCount).toBe(0);
    expect(ParticlePool.scaleOf(alive[0]!)).toBe(0);
  });

  it("reuses the oldest slots when bursts exceed its capacity", () => {
    const pool = new ParticlePool(16);
    pool.burst({ ...burst, count: 12 });
    pool.burst({ ...burst, count: 12 });
    expect(pool.aliveCount).toBe(16);
    expect(pool.particles).toHaveLength(16);
    pool.clear();
    expect(pool.aliveCount).toBe(0);
  });

  it("repeats the same burst deterministically", () => {
    const first = new ParticlePool(8);
    const second = new ParticlePool(8);
    first.burst({ ...burst, count: 8 });
    second.burst({ ...burst, count: 8 });
    expect(second.particles).toEqual(first.particles);
  });
});

describe("reduced motion preference", () => {
  it("reads the media query and tolerates browsers without it", () => {
    const view = (matches: boolean) => ({
      matchMedia: () => ({ matches }) as MediaQueryList,
    });
    expect(prefersReducedMotion(view(true))).toBe(true);
    expect(prefersReducedMotion(view(false))).toBe(false);
    expect(prefersReducedMotion(undefined)).toBe(false);
    expect(
      prefersReducedMotion({
        matchMedia: () => {
          throw new Error("unsupported");
        },
      }),
    ).toBe(false);
  });
});

describe("effects scene", () => {
  it("draws bursts only while particles live", () => {
    const effects = new EffectsScene();
    const mesh = effects.root.getObjectByName("effect-particles")!;
    expect(mesh.visible).toBe(false);
    effects.emit("hit", { x: 0, y: 1, z: 0 });
    expect(mesh.visible).toBe(true);
    effects.update(0.1);
    expect(effects.aliveCount).toBeGreaterThan(0);
    expect(mesh.visible).toBe(true);
    for (let frame = 0; frame < 30; frame++) effects.update(0.05);
    expect(effects.aliveCount).toBe(0);
    expect(mesh.visible).toBe(false);
    effects.dispose();
  });
});
