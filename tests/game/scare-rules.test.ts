/**
 * DESIGN-027 validation (pure rules): the blackout scheduler never fires in a
 * forbidden state, watchers change only unseen, inside their arena and off
 * connection strips, and the jump-scare gate keeps its cooldown.
 */
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createObbyState, sampleObby, stepObby } from "../../src/game/obby";
import {
  blackoutAllowed,
  blackoutDarkness,
  blackoutHazardZones,
  effectiveScareLevel,
  insideZone,
  isRadioShowman,
  JumpScareGate,
  lungeDurationMs,
  nearBlackoutHazard,
  insideScriptedScareSpot,
  SCARE_TIMING,
  ScareDirector,
  scareRandom,
  scareSeed,
  WATCHER_POSES,
  WATCHER_VIEW,
  WatcherDirector,
  watcherBlockedZones,
  watcherBody,
  type WatcherCandidate,
  type WatcherView,
} from "../../src/game/scare";
import {
  authoredScareLevel,
  resolveAuthoredLevelDocument,
  validateAuthoredLevelDocument,
} from "../../src/shared/authored-level";
import { resolveLevelEditorProject } from "../../src/shared/editor-project";
import familyWorldA from "../../src/shared/levels/family-world-a-v2.json";
import familyWorldAV4 from "../../src/shared/levels/family-world-a-v4.json";

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

describe("authored scripted scare spots", () => {
  const a4 = familyWorldAV4.chapters.find((chapter) => chapter.chapterId === "family-a4")!.level;
  const first = {
    id: "ticket-counter-surprise",
    encounterSlot: "ordinary-1",
    position: { x: 0, y: 0, z: -31.5 },
    radius: 1.3,
  };

  it("accepts a supported A4 level-2 spot without changing the frozen v4 template", () => {
    expect(a4).not.toHaveProperty("scriptedScares");
    expect(validateAuthoredLevelDocument({ ...a4, scriptedScares: [first] })).toEqual([]);
    expect(insideScriptedScareSpot(first, { x: 1.3, y: 0, z: -31.5 })).toBe(true);
    expect(insideScriptedScareSpot(first, { x: 0, y: 4, z: -31.5 })).toBe(false);
  });

  it("rejects wrong scare levels, duplicate ids, missing slots and unsupported centres", () => {
    const bad = validateAuthoredLevelDocument({
      ...a4,
      scare: 1,
      scriptedScares: [first, { ...first, position: { x: 240, y: 0, z: 240 } }],
    });
    expect(bad.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      "scare.level", "scare.duplicate-id", "scare.support",
    ]));
    const missingSlot = validateAuthoredLevelDocument({
      ...a4,
      scriptedScares: [{ ...first, encounterSlot: "bonus-2" }],
    });
    expect(missingSlot.some((entry) => entry.path.endsWith("encounterSlot"))).toBe(true);
  });
});

describe("blackout safety", () => {
  const safe = {
    airborne: false,
    riding: false,
    sinceLaunch: 5,
    sinceSettled: 5,
    sinceRecovery: 20,
    nearHazard: false,
  };

  it("allows a blackout only on safe, settled footing", () => {
    expect(blackoutAllowed(safe)).toBe(true);
    expect(blackoutAllowed({ ...safe, airborne: true })).toBe(false);
    expect(blackoutAllowed({ ...safe, riding: true })).toBe(false);
    expect(blackoutAllowed({ ...safe, sinceLaunch: 1.99 })).toBe(false);
    expect(blackoutAllowed({ ...safe, sinceLaunch: 2 })).toBe(true);
    expect(blackoutAllowed({ ...safe, sinceSettled: 0.99 })).toBe(false);
    expect(blackoutAllowed({ ...safe, sinceSettled: 1 })).toBe(true);
    expect(blackoutAllowed({ ...safe, sinceRecovery: 9.99 })).toBe(false);
    expect(blackoutAllowed({ ...safe, sinceRecovery: 10 })).toBe(true);
    expect(blackoutAllowed({ ...safe, nearHazard: true })).toBe(false);
  });

  const a4Chapter = familyWorldAV4.chapters.find((chapter) => chapter.chapterId === "family-a4")!;
  const a4 = resolveAuthoredLevelDocument(
    a4Chapter.level as Parameters<typeof resolveAuthoredLevelDocument>[0],
  ).course;

  it("waits a second after landing a glide that outlasts the launch guard (A4)", () => {
    // The real A4 legs whose age 9+ glides last longer than 2 s.
    for (const [from, to, startX, startZ] of [
      ["high-board", "spotlight-trapeze", -15.5, -117],
      ["spotlight-trapeze", "rat-pit-stage", -25.5, -116],
      ["glide-landing", "ticket-counter", -1.2, -22],
    ] as const) {
      const leg = `${from} -> ${to}`;
      const top = a4.platforms.find((platform) => platform.id === from)!;
      const state = createObbyState({ x: startX, y: top.center.y + top.size.y / 2, z: startZ });
      const director = new ScareDirector(2, scareRandom(1));
      director.step(30, false, false);
      const move = to === "spotlight-trapeze" ? { moveX: -1, moveY: 0 } : { moveX: 0, moveY: 1 };
      let time = 0;
      let launched = false;
      let landedAt: number | null = null;
      for (let frame = 0; frame < 60 * 12; frame += 1) {
        time += FRAME;
        const grounded = state.grounded;
        const edgeAhead =
          to === "spotlight-trapeze"
            ? state.position.x < top.center.x - top.size.x / 2 + 0.45
            : state.position.z < top.center.z - top.size.z / 2 + 0.45;
        const result = stepObby(state, landedAt === null ? move : { moveX: 0, moveY: 0 }, a4, {
          deltaSeconds: FRAME,
          timeSeconds: time,
          cameraYaw: 0,
          canJump: true,
          jumpPressed: !launched && edgeAhead,
          jumpHeld: launched && landedAt === null,
          abilities: { jumpVelocity: 5.9, airJumpVelocity: 4.6, glideFallSpeed: 1.6 },
          radius: 0.24,
          height: 1.22,
        });
        expect(result.recovered, leg).toBe(false);
        if (grounded && !state.grounded) {
          launched = true;
          director.noteLaunch();
        }
        director.step(FRAME, !state.grounded, false);
        if (!launched || !state.grounded) continue;
        landedAt ??= director.time;
        // Ignore the hazard zones here: this is the landing rule alone.
        const safety = director.safety(false, false);
        const sinceLanding = director.time - landedAt;
        if (sinceLanding === 0) {
          expect(safety.sinceLaunch, `${leg} airtime`).toBeGreaterThan(SCARE_TIMING.launchGuard);
          expect(state.supportId, leg).toBe(to);
        }
        const at = `${leg} at ${sinceLanding.toFixed(2)} s`;
        if (sinceLanding < SCARE_TIMING.settleGuard - 2 * FRAME)
          expect(blackoutAllowed(safety), at).toBe(false);
        if (sinceLanding > SCARE_TIMING.settleGuard + FRAME) {
          expect(blackoutAllowed(safety), at).toBe(true);
          break;
        }
      }
      expect(landedAt, leg).not.toBeNull();
      expect(director.time - landedAt!, leg).toBeGreaterThan(SCARE_TIMING.settleGuard);
    }
  });

  it("keeps blackouts away from A4's sweepers and movers, and leaves most of the course open", () => {
    const zones = blackoutHazardZones(a4);
    const sweepers = a4.hazards.map((hazard) => hazard.id);
    const movers = a4.platforms.filter((platform) => platform.motion).map((platform) => platform.id);
    expect(sweepers.length).toBe(3);
    expect(zones.map((zone) => zone.id).sort()).toEqual([...sweepers, ...movers].sort());
    // Crumbling platforms and bounce pads hold still until touched.
    for (const platform of a4.platforms.filter((entry) => !entry.motion))
      expect(zones.some((zone) => zone.id === platform.id)).toBe(false);
    // Every point a sweeper's bar can reach is guarded, at its height.
    for (const hazard of a4.hazards) {
      for (let seconds = 0; seconds < 12; seconds += 0.25) {
        const bar = sampleObby(a4, seconds).hazards.find((entry) => entry.id === hazard.id)!;
        for (const end of [bar.start, bar.center, bar.end])
          expect(nearBlackoutHazard(zones, { x: end.x, y: end.y - 0.5, z: end.z })).toBe(true);
      }
    }
    // The review's ledge: fox-card-room's west edge, 1 m from card-shuffle-one.
    expect(nearBlackoutHazard(zones, { x: -8.75, y: 7.4, z: -80.5 })).toBe(true);
    // Still most of the course's standing room can black out.
    let total = 0;
    let guarded = 0;
    for (const platform of a4.platforms) {
      if (platform.motion || platform.crumble) continue;
      const top = platform.center.y + platform.size.y / 2;
      for (let x = platform.center.x - platform.size.x / 2 + 0.25; x < platform.center.x + platform.size.x / 2; x += 0.5)
        for (let z = platform.center.z - platform.size.z / 2 + 0.25; z < platform.center.z + platform.size.z / 2; z += 0.5) {
          total += 1;
          if (nearBlackoutHazard(zones, { x, y: top, z })) guarded += 1;
        }
    }
    expect(guarded / total).toBeGreaterThan(0.05);
    expect(guarded / total).toBeLessThan(0.4);
    expect(blackoutHazardZones(undefined)).toEqual([]);
  });

  it("never blacks out while the player waits at the mover ledge in A4", () => {
    const zones = blackoutHazardZones(a4);
    const riding = new Set(a4.platforms.filter((p) => p.motion || p.crumble).map((p) => p.id));
    const state = createObbyState({ x: -8.75, y: 7.4, z: -80.5 });
    const director = new ScareDirector(2, scareRandom(scareSeed(`${a4Chapter.routeId}:level-4`)));
    let time = 0;
    for (let frame = 0; frame < 60 * 240; frame += 1) {
      time += FRAME;
      const grounded = state.grounded;
      stepObby(state, { moveX: 0, moveY: 0 }, a4, {
        deltaSeconds: FRAME,
        timeSeconds: time,
        cameraYaw: 0,
        canJump: true,
        jumpPressed: false,
        radius: 0.24,
        height: 1.22,
      });
      if (grounded && !state.grounded) director.noteLaunch();
      const onRide = state.supportId !== null && riding.has(state.supportId);
      const events = director.step(FRAME, !state.grounded, onRide, {
        nearHazard: nearBlackoutHazard(zones, state.position),
      });
      expect(events.blackoutStarted).toBe(false);
    }
    expect(state.supportId).toBe("fox-card-room");
    expect(director.flickers).toBeGreaterThan(0);
  });

  it("guards a turning sweeper's whole disc and a mover's whole travel", () => {
    const zones = blackoutHazardZones({
      hazards: [
        { id: "spin", center: { x: 0, y: 1, z: 0 }, halfLength: 3, radius: 0.3, rotation: { period: 4 } },
        { id: "still", center: { x: 50, y: 1, z: 0 }, halfLength: 3, radius: 0.3 },
      ],
      platforms: [
        {
          id: "slide",
          center: { x: 0, y: 0, z: 50 },
          size: { x: 2, y: 0.5, z: 2 },
          motion: { axis: "x", distance: 3, period: 5 },
        },
        { id: "still-deck", center: { x: 0, y: 0, z: 90 }, size: { x: 4, y: 0.5, z: 4 } },
        {
          id: "frozen",
          center: { x: 0, y: 0, z: 130 },
          size: { x: 2, y: 0.5, z: 2 },
          motion: { axis: "x", distance: 3, period: 0 },
        },
      ],
    });
    expect(zones.map((zone) => zone.id)).toEqual(["spin", "still", "slide"]);
    const clear = SCARE_TIMING.hazardClearance;
    // Turning: the full disc of radius halfLength + radius, plus the clearance.
    expect(nearBlackoutHazard(zones, { x: 0, y: 0.5, z: 3.3 + clear - 0.01 })).toBe(true);
    expect(nearBlackoutHazard(zones, { x: 0, y: 0.5, z: 3.3 + clear + 0.01 })).toBe(false);
    // Still: only along its length (phase 0 lies along x).
    expect(nearBlackoutHazard(zones, { x: 50, y: 0.5, z: 0.3 + clear + 0.01 })).toBe(false);
    expect(nearBlackoutHazard(zones, { x: 53.3 + clear - 0.01, y: 0.5, z: 0 })).toBe(true);
    // Height band: far above or below is not near.
    expect(nearBlackoutHazard(zones, { x: 0, y: 1.3 + SCARE_TIMING.hazardHeightBand + 0.01, z: 0 })).toBe(false);
    expect(nearBlackoutHazard(zones, { x: 0, y: 0.7 - SCARE_TIMING.hazardHeightBand - 0.01, z: 0 })).toBe(false);
    // A mover's whole travel (±3 m on x) plus the clearance.
    expect(nearBlackoutHazard(zones, { x: 4 + clear - 0.01, y: 0.25, z: 50 })).toBe(true);
    expect(nearBlackoutHazard(zones, { x: 4 + clear + 0.01, y: 0.25, z: 50 })).toBe(false);
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

  it("never starts a blackout airborne, riding, near a hazard, within 2 s of a launch, 1 s of landing or 10 s of a recovery", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const random = scareRandom(seed * 7919);
      const director = new ScareDirector(2, scareRandom(seed));
      let airborneFor = 0;
      let ridingFor = 0;
      let launchedAt = Number.NEGATIVE_INFINITY;
      let recoveredAt = Number.NEGATIVE_INFINITY;
      let unsettledAt = Number.NEGATIVE_INFINITY;
      let nearHazardFor = 0;
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
        if (nearHazardFor <= 0 && random() < 0.002) nearHazardFor = 1 + random() * 8;
        const airborne = airborneFor > 0;
        const riding = ridingFor > 0;
        const nearHazard = nearHazardFor > 0;
        const events = director.step(FRAME, airborne, riding, { nearHazard });
        if (airborne || riding) unsettledAt = director.time;
        if (events.blackoutStarted) {
          started += 1;
          expect(airborne).toBe(false);
          expect(riding).toBe(false);
          expect(nearHazard).toBe(false);
          expect(director.time - launchedAt).toBeGreaterThanOrEqual(SCARE_TIMING.launchGuard);
          expect(director.time - unsettledAt).toBeGreaterThanOrEqual(SCARE_TIMING.settleGuard);
          expect(director.time - recoveredAt).toBeGreaterThanOrEqual(SCARE_TIMING.recoveryGuard);
        }
        airborneFor -= FRAME;
        ridingFor -= FRAME;
        nearHazardFor -= FRAME;
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
      expect(director.step(FRAME, false, false, { holdBlackouts: true }).blackoutStarted).toBe(false);
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
      ...overrides,
    };
  }
  const hidden: WatcherView = { inView: () => false };
  const visible: WatcherView = { inView: () => true };

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
      const step = director.step(FRAME, [candidate()], player, visible);
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
      const step = director.step(FRAME, [current], player, hidden);
      for (const move of step.moves) {
        moves += 1;
        current = { ...current, position: move.position, facing: move.facing, pose: move.pose };
      }
      expect(step.creaks).toEqual([]);
    }
    expect(moves).toBe(1);
    const seen = director.step(FRAME, [current], player, visible);
    expect(seen.creaks).toEqual(["watcher"]);
    expect(director.step(FRAME, [current], player, visible).creaks).toEqual([]);
    // A new unseen spell may change it again.
    let again = 0;
    for (let frame = 0; frame < 60 * 10; frame += 1)
      again += director.step(FRAME, [current], player, hidden).moves.length;
    expect(again).toBe(1);
  });

  it("seeing a watcher that has not changed yet plays no creak", () => {
    const director = new WatcherDirector(scareRandom(3), zones);
    const player = { x: 0, y: 0, z: 0 };
    director.step(0.5, [candidate()], player, hidden);
    expect(director.step(FRAME, [candidate()], player, visible)).toEqual({ moves: [], creaks: [] });
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
      const step = director.step(
        SCARE_TIMING.watcherUnseen[1] + 0.1,
        [candidate({ position, spawn })],
        player,
        hidden,
      );
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
      const step = director.step(5, [candidate()], { x: 40, y: 0, z: 40 }, hidden);
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
      const [move] = director.step(5, [candidate()], player, hidden).moves;
      if (move?.change !== "turn") continue;
      // A facing of θ looks along (−sin θ, −cos θ): toward +x means θ = −π/2.
      expect(move.facing).toBeCloseTo(-Math.PI / 2);
    }
  });

  /** GardenScene.isInView's test: a sphere around a body cylinder at the feet. */
  function frustumView(camera: THREE.PerspectiveCamera) {
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    );
    return (at: { x: number; y: number; z: number }, radius: number, height: number) =>
      frustum.intersectsSphere(
        new THREE.Sphere(new THREE.Vector3(at.x, at.y + height / 2, at.z), Math.hypot(radius, height / 2)),
      );
  }

  it("never shuffles into the frame, even from just past its edge", () => {
    // The chase camera behind and above a player at the origin, looking down −z.
    const camera = new THREE.PerspectiveCamera(48, 1280 / 760, 0.08, 100);
    camera.position.set(0, 3.2, 5.5);
    camera.lookAt(0, 1, -4);
    const test = frustumView(camera);
    // A4's tallest ordinary, the 1.96 m drummer, measured as createGame sizes it.
    const body = watcherBody(1.96);
    const view: WatcherView = {
      inView: (_candidate, at) =>
        test(at, body.radius + WATCHER_VIEW.margin, body.height + WATCHER_VIEW.margin),
    };
    const player = { x: 0, y: 0, z: 0 };
    let shuffles = 0;
    for (let seed = 1; seed <= 2000; seed += 1) {
      for (const side of [1, -1]) {
        // 8 m ahead, slid sideways until even the padded body leaves the frame.
        const start = { x: 0, y: 0, z: -8 };
        while (view.inView(candidate(), start)) start.x += side * 0.05;
        start.x += side * 0.05;
        const director = new WatcherDirector(scareRandom(seed), []);
        const watcher = candidate({
          position: start,
          spawn: { ...start },
          arena: { minX: start.x - 3, maxX: start.x + 3, minZ: -11, maxZ: -5 },
        });
        const step = director.step(SCARE_TIMING.watcherUnseen[1] + 0.1, [watcher], player, view);
        const move = step.moves[0];
        if (move?.change !== "shuffle") continue;
        shuffles += 1;
        // The real 1.96 m body (plus its health bar) stays out of the frame.
        expect(test(move.position, Math.max(0.6, 1.96 * 0.45), 1.96 + 0.3), `seed ${seed}`).toBe(false);
        expect(view.inView(watcher, move.position)).toBe(false);
      }
    }
    expect(shuffles).toBeGreaterThan(400);
  });

  it("sizes a watcher's view body from its model height", () => {
    expect(watcherBody(1.72)).toEqual({ radius: 1.72 * 0.45, height: 1.72 + 0.3 });
    expect(watcherBody(1.96).height).toBeCloseTo(2.26);
    expect(watcherBody(1)).toEqual({ radius: 0.6, height: 1.3 });
    // Unknown art falls back to the 1.35 m placeholder study.
    expect(watcherBody(null)).toEqual(watcherBody(1.35));
    expect(watcherBody(Number.NaN)).toEqual(watcherBody(1.35));
  });

  it("creaks only once the player really sees it, not while it hides in the frustum", () => {
    const director = new WatcherDirector(scareRandom(4), zones);
    const player = { x: ordinary.position.x + 5, y: ordinary.position.y, z: ordinary.position.z + 5 };
    let current = candidate();
    for (let frame = 0; frame < 60 * 5; frame += 1)
      for (const move of director.step(FRAME, [current], player, hidden).moves)
        current = { ...current, position: move.position, facing: move.facing, pose: move.pose };
    expect(director.moves).toBe(1);
    // Back in the frustum, but behind a pillar (or too far): no creak yet, and
    // no change either, however long it stays there.
    let asked = 0;
    const behindPillar: WatcherView = {
      inView: () => true,
      seen: () => {
        asked += 1;
        return false;
      },
    };
    for (let frame = 0; frame < 60 * 10; frame += 1) {
      const step = director.step(FRAME, [current], player, behindPillar);
      expect(step).toEqual({ moves: [], creaks: [] });
    }
    // It asks about ten times a second, not every frame.
    expect(asked).toBeGreaterThanOrEqual(95);
    expect(asked).toBeLessThanOrEqual(105);
    // Out of view again it may change again; its creak still waits to be seen.
    for (let frame = 0; frame < 60 * 5; frame += 1)
      for (const move of director.step(FRAME, [current], player, hidden).moves)
        current = { ...current, position: move.position, facing: move.facing, pose: move.pose };
    expect(director.moves).toBe(2);
    const inSight: WatcherView = { inView: () => true, seen: () => true };
    expect(director.step(FRAME, [current], player, inSight).creaks).toEqual(["watcher"]);
    expect(director.step(FRAME, [current], player, inSight).creaks).toEqual([]);
    expect(director.creaks).toBe(1);
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
