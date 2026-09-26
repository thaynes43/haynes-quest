/**
 * DESIGN-027 validation (pure rules): the blackout scheduler never fires in a
 * forbidden state, watchers change only unseen, inside their arena and off
 * connection strips, and the jump-scare gate keeps its cooldown.
 */
import { describe, expect, it } from "vitest";
import {
  blackoutAllowed,
  blackoutDarkness,
  effectiveScareLevel,
  insideZone,
  isRadioShowman,
  JumpScareGate,
  lungeDurationMs,
  SCARE_TIMING,
  ScareDirector,
  scareRandom,
  scareSeed,
  WATCHER_POSES,
  WatcherDirector,
  watcherBlockedZones,
  type WatcherCandidate,
} from "../../src/game/scare";
import { authoredScareLevel } from "../../src/shared/authored-level";
import { resolveLevelEditorProject } from "../../src/shared/editor-project";
import familyWorldA from "../../src/shared/levels/family-world-a-v2.json";

const FRAME = 1 / 60;

describe("scare levels and the parent switch", () => {
  it("reads absent, zero and unknown values as level 0", () => {
    expect(authoredScareLevel(undefined)).toBe(0);
    expect(authoredScareLevel({})).toBe(0);
    expect(authoredScareLevel({ scare: 0 })).toBe(0);
    expect(authoredScareLevel({ scare: 1 })).toBe(1);
    expect(authoredScareLevel({ scare: 2 })).toBe(2);
    expect(authoredScareLevel({ scare: 3 as never })).toBe(0);
    expect(authoredScareLevel({ scare: "2" as never })).toBe(0);
  });

  it("caps every chapter at level 0 when the switch is off", () => {
    for (const scare of [0, 1, 2] as const) {
      expect(effectiveScareLevel({ scare }, false)).toBe(0);
      expect(effectiveScareLevel({ scare }, true)).toBe(scare);
    }
    expect(effectiveScareLevel(undefined, true)).toBe(0);
  });
});

describe("blackout safety", () => {
  const safe = { airborne: false, riding: false, sinceLaunch: 5, sinceRecovery: 20 };

  it("allows a blackout only on safe, settled footing", () => {
    expect(blackoutAllowed(safe)).toBe(true);
    expect(blackoutAllowed({ ...safe, airborne: true })).toBe(false);
    expect(blackoutAllowed({ ...safe, riding: true })).toBe(false);
    expect(blackoutAllowed({ ...safe, sinceLaunch: 1.99 })).toBe(false);
    expect(blackoutAllowed({ ...safe, sinceLaunch: 2 })).toBe(true);
    expect(blackoutAllowed({ ...safe, sinceRecovery: 9.99 })).toBe(false);
    expect(blackoutAllowed({ ...safe, sinceRecovery: 10 })).toBe(true);
  });
});

describe("the scare director", () => {
  it("does nothing at level 0", () => {
    const director = new ScareDirector(0, scareRandom(1));
    for (let frame = 0; frame < 60 * 180; frame += 1) {
      expect(director.step(FRAME, false, false)).toEqual({
        blackoutStarted: false,
        blackoutEnded: false,
        laugh: false,
      });
    }
    expect(director.lighting()).toEqual({ level: 0, flicker: 0, blackout: 0, blackoutElapsed: null });
    expect(director.flickers).toBe(0);
    expect(director.blackouts).toBe(0);
  });

  it("flickers practical lights in 0.1–0.4 s dips every 3–9 s at level 1, with no blackouts", () => {
    const director = new ScareDirector(1, scareRandom(7));
    const dips: Array<{ start: number; length: number }> = [];
    let dipStart: number | null = null;
    for (let frame = 0; frame < 60 * 600; frame += 1) {
      const events = director.step(FRAME, false, false);
      expect(events.blackoutStarted).toBe(false);
      expect(events.laugh).toBe(false);
      const lit = director.lighting();
      expect(lit.blackout).toBe(0);
      if (lit.flicker && dipStart === null) dipStart = director.time;
      if (!lit.flicker && dipStart !== null) {
        dips.push({ start: dipStart, length: director.time - dipStart });
        dipStart = null;
      }
    }
    expect(dips.length).toBeGreaterThan(600 / 13);
    for (const dip of dips) {
      expect(dip.length).toBeGreaterThanOrEqual(0.1 - FRAME);
      expect(dip.length).toBeLessThanOrEqual(0.4 + FRAME);
    }
    for (let index = 1; index < dips.length; index += 1) {
      const gap = dips[index]!.start - (dips[index - 1]!.start + dips[index - 1]!.length);
      expect(gap).toBeGreaterThanOrEqual(3 - 2 * FRAME);
      expect(gap).toBeLessThanOrEqual(9 + 2 * FRAME);
    }
    expect(director.blackouts).toBe(0);
  });

  it("blacks out for about 1.2 s every 35–60 s at level 2 and brings the lights back", () => {
    const director = new ScareDirector(2, scareRandom(11));
    director.noteRecovery();
    const starts: number[] = [];
    const ends: number[] = [];
    for (let frame = 0; frame < 60 * 900; frame += 1) {
      const events = director.step(FRAME, false, false);
      if (events.blackoutStarted) starts.push(director.time);
      if (events.blackoutEnded) ends.push(director.time);
    }
    expect(starts.length).toBeGreaterThanOrEqual(900 / 61);
    expect(ends.length).toBe(starts.length);
    starts.forEach((start, index) => {
      expect(ends[index]! - start).toBeCloseTo(SCARE_TIMING.blackoutSeconds, 1);
      if (index > 0) {
        const gap = start - ends[index - 1]!;
        expect(gap).toBeGreaterThanOrEqual(35 - 2 * FRAME);
        expect(gap).toBeLessThanOrEqual(60 + 2 * FRAME);
      }
    });
  });

  it("never starts a blackout airborne, riding, within 2 s of a launch or 10 s of a recovery", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const random = scareRandom(seed * 7919);
      const director = new ScareDirector(2, scareRandom(seed));
      let airborneFor = 0;
      let ridingFor = 0;
      let launchedAt = Number.NEGATIVE_INFINITY;
      let recoveredAt = Number.NEGATIVE_INFINITY;
      let started = 0;
      for (let frame = 0; frame < 60 * 1200; frame += 1) {
        // A restless player: jumps, rides, falls and recovers at random.
        if (airborneFor <= 0 && random() < 0.004) {
          airborneFor = 0.4 + random() * 1.2;
          launchedAt = director.time;
          director.noteLaunch();
        }
        if (ridingFor <= 0 && airborneFor <= 0 && random() < 0.002) ridingFor = 1 + random() * 6;
        if (random() < 0.0004) {
          recoveredAt = director.time;
          director.noteRecovery();
        }
        const airborne = airborneFor > 0;
        const riding = ridingFor > 0;
        const events = director.step(FRAME, airborne, riding);
        if (events.blackoutStarted) {
          started += 1;
          expect(airborne).toBe(false);
          expect(riding).toBe(false);
          expect(director.time - launchedAt).toBeGreaterThanOrEqual(SCARE_TIMING.launchGuard);
          expect(director.time - recoveredAt).toBeGreaterThanOrEqual(SCARE_TIMING.recoveryGuard);
        }
        airborneFor -= FRAME;
        ridingFor -= FRAME;
      }
      expect(started, `seed ${seed}`).toBeGreaterThan(0);
    }
  });

  it("waits for safe footing when a blackout falls due, then starts at once", () => {
    const director = new ScareDirector(2, scareRandom(3));
    let frames = 0;
    // Stay airborne well past the latest possible due time.
    while (director.time < 65) {
      expect(director.step(FRAME, true, false).blackoutStarted).toBe(false);
      frames += 1;
    }
    expect(frames).toBeGreaterThan(0);
    director.noteLaunch();
    for (let frame = 0; frame < 119; frame += 1)
      expect(director.step(FRAME, false, false).blackoutStarted).toBe(false);
    let startedAfter = 0;
    for (let frame = 0; frame < 10; frame += 1)
      if (director.step(FRAME, false, false).blackoutStarted) startedAfter = frame + 1;
    expect(startedAfter).toBeGreaterThan(0);
  });

  it("ends a blackout early for a lunge or a recovery without the return cue", () => {
    const director = new ScareDirector(2, scareRandom(5));
    while (!director.step(FRAME, false, false).blackoutStarted);
    expect(director.lighting().blackoutElapsed).not.toBeNull();
    director.endBlackout();
    expect(director.lighting()).toMatchObject({ blackout: 0, blackoutElapsed: null });
    while (!director.step(FRAME, false, false).blackoutStarted);
    director.noteRecovery();
    expect(director.lighting().blackoutElapsed).toBeNull();
    for (let frame = 0; frame < 120; frame += 1)
      expect(director.step(FRAME, false, false).blackoutEnded).toBe(false);
  });

  it("holds new blackouts while a lunge plays", () => {
    const director = new ScareDirector(2, scareRandom(9));
    for (let frame = 0; frame < 60 * 120; frame += 1)
      expect(director.step(FRAME, false, false, true).blackoutStarted).toBe(false);
  });

  it("laughs in the distance every 20–45 s at level 2 only", () => {
    const scary = new ScareDirector(2, scareRandom(13));
    const spooky = new ScareDirector(1, scareRandom(13));
    const laughs: number[] = [];
    for (let frame = 0; frame < 60 * 600; frame += 1) {
      if (scary.step(FRAME, true, false).laugh) laughs.push(scary.time);
      expect(spooky.step(FRAME, true, false).laugh).toBe(false);
    }
    expect(laughs.length).toBeGreaterThanOrEqual(600 / 46);
    for (let index = 1; index < laughs.length; index += 1) {
      expect(laughs[index]! - laughs[index - 1]!).toBeGreaterThanOrEqual(20 - FRAME);
      expect(laughs[index]! - laughs[index - 1]!).toBeLessThanOrEqual(45 + FRAME);
    }
  });

  it("drops the lights fast, holds them dark and stutters them back", () => {
    expect(blackoutDarkness(-0.1)).toBe(0);
    expect(blackoutDarkness(0)).toBe(0);
    expect(blackoutDarkness(0.03)).toBeCloseTo(0.5);
    expect(blackoutDarkness(0.5)).toBe(1);
    expect(blackoutDarkness(1.0)).toBeLessThan(1);
    expect(blackoutDarkness(1.2)).toBe(0);
    expect(blackoutDarkness(5)).toBe(0);
  });

  it("replays exactly from the same seed", () => {
    const run = (seed: number) => {
      const director = new ScareDirector(2, scareRandom(seed));
      const trace: number[] = [];
      for (let frame = 0; frame < 60 * 200; frame += 1) {
        const events = director.step(FRAME, false, false);
        if (events.blackoutStarted || events.laugh) trace.push(frame);
      }
      return trace;
    };
    expect(run(scareSeed("family-a4-route:level-1"))).toEqual(run(scareSeed("family-a4-route:level-1")));
    expect(scareSeed("a")).not.toBe(scareSeed("b"));
  });
});

describe("jump scares", () => {
  it("allows one per 60 s of wall time and none in a blackout's first 0.3 s", () => {
    const gate = new JumpScareGate();
    expect(gate.allowed(100, null)).toBe(true);
    expect(gate.allowed(100, 0.1)).toBe(false);
    expect(gate.allowed(100, 0.29)).toBe(false);
    expect(gate.allowed(100, 0.3)).toBe(true);
    gate.trigger(100);
    expect(gate.allowed(159.9, null)).toBe(false);
    expect(gate.allowed(160, null)).toBe(true);
    expect(gate.allowed(160, 0.2)).toBe(false);
  });

  it("lunges for 0.9 s, or cuts for 0.5 s with reduced motion", () => {
    expect(lungeDurationMs(false)).toBe(900);
    expect(lungeDurationMs(true)).toBe(500);
  });
});

describe("watchers", () => {
  const world = resolveLevelEditorProject(familyWorldA);
  const casino = world.levels["family-a4-casino"]!;
  const zones = watcherBlockedZones(casino.document);
  const ordinary = casino.anchors.encounters["ordinary-1"];

  function candidate(overrides: Partial<WatcherCandidate> = {}): WatcherCandidate {
    return {
      id: "watcher",
      position: { ...ordinary.position },
      spawn: { ...ordinary.position },
      facing: 0,
      pose: 0,
      arena: ordinary.arena,
      inView: false,
      ...overrides,
    };
  }

  it("builds blocked zones from every connection strip of a real chapter", () => {
    expect(zones.length).toBeGreaterThanOrEqual(casino.document.connections.length);
    for (const zone of zones) {
      expect(zone.maxX).toBeGreaterThan(zone.minX);
      expect(zone.maxZ).toBeGreaterThan(zone.minZ);
    }
    expect(watcherBlockedZones(undefined)).toEqual([]);
  });

  it("never changes a watcher the camera can see", () => {
    const director = new WatcherDirector(scareRandom(1), zones);
    const player = { x: ordinary.position.x + 5, y: ordinary.position.y, z: ordinary.position.z + 5 };
    for (let frame = 0; frame < 60 * 60; frame += 1) {
      const step = director.step(FRAME, [candidate({ inView: true })], player);
      expect(step.moves).toEqual([]);
      expect(step.creaks).toEqual([]);
    }
    expect(director.moves).toBe(0);
  });

  it("changes once per unseen spell and creaks once when seen again", () => {
    const director = new WatcherDirector(scareRandom(2), zones);
    const player = { x: ordinary.position.x + 5, y: ordinary.position.y, z: ordinary.position.z + 5 };
    let current = candidate();
    let moves = 0;
    for (let frame = 0; frame < 60 * 10; frame += 1) {
      const step = director.step(FRAME, [current], player);
      for (const move of step.moves) {
        moves += 1;
        current = { ...current, position: move.position, facing: move.facing, pose: move.pose };
      }
      expect(step.creaks).toEqual([]);
    }
    expect(moves).toBe(1);
    const seen = director.step(FRAME, [{ ...current, inView: true }], player);
    expect(seen.creaks).toEqual(["watcher"]);
    expect(director.step(FRAME, [{ ...current, inView: true }], player).creaks).toEqual([]);
    // A new unseen spell may change it again.
    let again = 0;
    for (let frame = 0; frame < 60 * 10; frame += 1) again += director.step(FRAME, [current], player).moves.length;
    expect(again).toBe(1);
  });

  it("seeing a watcher that has not changed yet plays no creak", () => {
    const director = new WatcherDirector(scareRandom(3), zones);
    const player = { x: 0, y: 0, z: 0 };
    director.step(0.5, [candidate()], player);
    expect(director.step(FRAME, [candidate({ inView: true })], player)).toEqual({ moves: [], creaks: [] });
  });

  it("shuffles at most 1.5 m, inside its arena, off every strip and clear of the player", () => {
    const changes = new Map<string, number>();
    for (let seed = 1; seed <= 400; seed += 1) {
      const director = new WatcherDirector(scareRandom(seed), zones);
      const random = scareRandom(seed + 10_000);
      const arena = ordinary.arena;
      // Start anywhere legal in the arena, sometimes already moved from spawn.
      const position = {
        x: arena.minX + random() * (arena.maxX - arena.minX),
        y: ordinary.position.y,
        z: arena.minZ + random() * (arena.maxZ - arena.minZ),
      };
      const spawn = random() < 0.5 ? { ...position } : { ...ordinary.position };
      const player = { x: position.x + (random() - 0.5) * 6, y: position.y, z: position.z + (random() - 0.5) * 6 };
      const step = director.step(SCARE_TIMING.watcherUnseen[1] + 0.1, [candidate({ position, spawn })], player);
      expect(step.moves.length).toBe(1);
      const move = step.moves[0]!;
      changes.set(move.change, (changes.get(move.change) ?? 0) + 1);
      expect(move.pose).toBeGreaterThanOrEqual(0);
      expect(move.pose).toBeLessThan(WATCHER_POSES);
      expect(move.position.y).toBe(position.y);
      if (move.change !== "shuffle") {
        expect(move.position).toEqual(position);
        continue;
      }
      expect(Math.hypot(move.position.x - spawn.x, move.position.z - spawn.z)).toBeLessThanOrEqual(1.5 + 1e-9);
      expect(Math.hypot(move.position.x - position.x, move.position.z - position.z)).toBeLessThanOrEqual(1.5 + 1e-9);
      expect(move.position.x).toBeGreaterThanOrEqual(arena.minX);
      expect(move.position.x).toBeLessThanOrEqual(arena.maxX);
      expect(move.position.z).toBeGreaterThanOrEqual(arena.minZ);
      expect(move.position.z).toBeLessThanOrEqual(arena.maxZ);
      expect(insideZone(zones, move.position.x, move.position.z)).toBe(false);
      expect(Math.hypot(move.position.x - player.x, move.position.z - player.z)).toBeGreaterThanOrEqual(
        SCARE_TIMING.watcherPlayerClearance,
      );
    }
    for (const change of ["turn", "pose", "shuffle"]) expect(changes.get(change) ?? 0).toBeGreaterThan(20);
  });

  it("falls back to turning when every nearby spot is a strip", () => {
    const everywhere = [{ minX: -1e3, maxX: 1e3, minZ: -1e3, maxZ: 1e3 }];
    for (let seed = 1; seed <= 100; seed += 1) {
      const director = new WatcherDirector(scareRandom(seed), everywhere);
      const step = director.step(5, [candidate()], { x: 40, y: 0, z: 40 });
      for (const move of step.moves) {
        expect(move.change).not.toBe("shuffle");
        expect(move.position).toEqual(ordinary.position);
      }
    }
  });

  it("faces the player when it turns", () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const director = new WatcherDirector(scareRandom(seed), []);
      const player = { x: ordinary.position.x + 3, y: ordinary.position.y, z: ordinary.position.z };
      const [move] = director.step(5, [candidate()], player).moves;
      if (move?.change !== "turn") continue;
      // A facing of θ looks along (−sin θ, −cos θ): toward +x means θ = −π/2.
      expect(move.facing).toBeCloseTo(-Math.PI / 2);
    }
  });
});

describe("the radio showman", () => {
  it("is recognized by its model, catalog entry or placeholder candidate", () => {
    expect(isRadioShowman({ assetId: "radio-host-showman" })).toBe(true);
    expect(isRadioShowman({ catalogEntryId: "radio-host-showman" })).toBe(true);
    expect(isRadioShowman({ catalogEntryId: "editor-candidate-radio-host-showman", assetId: "neutral-enemy-placeholder" })).toBe(true);
    expect(isRadioShowman({ assetId: "honk-bus", catalogEntryId: "honk-bus" })).toBe(false);
    expect(isRadioShowman(undefined)).toBe(false);
  });
});
