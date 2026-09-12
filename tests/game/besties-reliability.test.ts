import { describe, expect, it } from "vitest";
import { BestiesSimulation, nearestBestiesActor } from "../../src/game/besties";

const entry = { x: 0, y: 0, z: -19.5 };
function tick(simulation: BestiesSimulation, player = entry, dt = 0.05) {
  return simulation.step({
    player,
    deltaSeconds: dt,
    active: true,
    defeated: false,
    aimAtPlayer: true,
  });
}

describe("Besties physical-playtest regressions", () => {
  it("finishes defeat after the authoritative victory disables combat", () => {
    const simulation = new BestiesSimulation();
    tick(simulation);
    const defeated = simulation.step({
      player: entry,
      deltaSeconds: 0.05,
      active: false,
      defeated: true,
    });
    expect(defeated.frame.phase).toBe("defeated");
    expect(
      defeated.frame.actors.every((actor) => actor.clip === "defeat"),
    ).toBe(true);
    expect(defeated.frame.hazards).toEqual([]);
    expect(
      simulation.step({
        player: entry,
        deltaSeconds: 1,
        active: false,
        defeated: true,
      }).phaseEntered,
    ).toBeNull();
  });

  it("warns at the player's depth, keeps that warning fixed and threatens the center path", () => {
    const simulation = new BestiesSimulation();
    const opening = tick(simulation, entry, 0).frame;
    expect(opening.hazards[0]!.center.z).toBe(entry.z);
    expect(opening.hazards[0]!.damaging).toBe(false);
    tick(simulation, { ...entry, z: -23 }, 0.1);
    expect(simulation.frame().hazards[0]!.center.z).toBe(entry.z);
    const hits: string[] = [];
    for (let i = 0; i < 135; i++) {
      const result = tick(simulation);
      if (result.hit) hits.push(result.hitBy!);
    }
    expect(hits).toEqual(["bestie-pink", "bestie-black"]);
  });

  it("leaves an escape from the fixed lane and jumping avoids each contact", () => {
    for (const jump of [false, true]) {
      const simulation = new BestiesSimulation();
      tick(simulation, entry, 0);
      let hits = 0;
      for (let i = 0; i < 145; i++) {
        const phase = simulation.frame().phase;
        const player = jump
          ? { ...entry, y: 0.7 }
          : {
              x: phase.startsWith("black") ? 5.8 : 0,
              y: 0,
              z: phase.startsWith("pink") ? -23.5 : -19.5,
            };
        // Enter Black's warning at the original position, then leave it.
        const result = tick(
          simulation,
          phase === "pink-trick" ? { ...player, x: 0 } : player,
        );
        if (result.hit) hits++;
      }
      expect(hits).toBe(0);
    }
  });
});

describe("authored Besties placement", () => {
  it("relocates warned geometry, targets and contact together through the complete routine", () => {
    const original = new BestiesSimulation();
    const origin = { x: 8, y: 0, z: -112 };
    const relocated = new BestiesSimulation(origin);
    const translatedPlayer = { x: entry.x + 8, y: entry.y, z: entry.z - 90 };
    const contacts: string[] = [];
    for (let i = 0; i < 280; i++) {
      const first = tick(original, entry);
      const second = tick(relocated, translatedPlayer);
      expect(second.hitBy).toBe(first.hitBy);
      if (second.hitBy) contacts.push(second.hitBy);
      expect(second.frame.phase).toBe(first.frame.phase);
      expect(second.frame.arenaOrigin).toEqual(origin);
      const firstTarget = nearestBestiesActor(first.frame, entry);
      const secondTarget = nearestBestiesActor(second.frame, translatedPlayer);
      expect(secondTarget.id).toBe(firstTarget.id);
      expect(secondTarget.position.x).toBeCloseTo(
        firstTarget.position.x + 8,
        8,
      );
      expect(secondTarget.position.z).toBeCloseTo(
        firstTarget.position.z - 90,
        8,
      );
      first.frame.hazards.forEach((hazard, index) => {
        const other = second.frame.hazards[index]!;
        expect(other.center.x).toBeCloseTo(hazard.center.x + 8, 8);
        expect(other.center.z).toBeCloseTo(hazard.center.z - 90, 8);
        expect(other.halfExtents).toEqual(hazard.halfExtents);
      });
    }
    expect(contacts).toContain("bestie-pink");
    expect(contacts).toContain("bestie-black");
  });

  it("never hits a player left behind at the archived arena and freezes on pause", () => {
    const simulation = new BestiesSimulation({ x: 8, y: 0, z: -112 });
    for (let i = 0; i < 280; i++) expect(tick(simulation).hit).toBe(false);
    const before = simulation.frame();
    const result = simulation.step({
      player: entry,
      deltaSeconds: 1,
      active: true,
      defeated: false,
      paused: true,
    });
    expect(result.frame).toEqual(before);
    expect(result.hit).toBe(false);
  });
});
