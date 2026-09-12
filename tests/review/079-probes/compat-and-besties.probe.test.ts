/**
 * WO079 adversarial probes: version compatibility, archived-plan immutability,
 * encounter binding and the translated Besties encounter.
 */
import { describe, expect, it } from "vitest";
import party from "../../../src/shared/levels/besties-playground-v1.json";
import {
  ALL_PARODY_CANDIDATES,
  PARODY_CATALOGS,
  PARODY_CATALOG_VERSION,
} from "../../../src/shared/parody-catalog";
import {
  createAdventurePlan,
  createInitialAdventureState,
  createRouteMemoryPlan,
  toAdventureView,
  type AdventureMemory,
  type AdventurePlanV3,
} from "../../../src/shared/adventure";
import { parseStoredAdventure } from "../../../src/server/adventure-schema";
import { authoredLevelLayout, authoredRoute } from "../../../src/game/authored-layout";
import {
  BESTIES_ARENA_CENTER,
  BESTIES_PHASE_SECONDS,
  BestiesSimulation,
  nearestBestiesActor,
} from "../../../src/game/besties";
import type { ActiveLevelView, SaveView } from "../../../src/shared/contracts";

const MEMORIES: AdventureMemory[] = [
  { id: "memory-age-0", date: "2020-07-01", ageYears: 0 },
  { id: "memory-age-2", date: "2022-01-01", ageYears: 2 },
  { id: "memory-age-4", date: "2024-01-01", ageYears: 4 },
  { id: "memory-age-5", date: "2025-01-01", ageYears: 5 },
  { id: "memory-age-6", date: "2026-01-01", ageYears: 6 },
  { id: "memory-age-7", date: "2027-01-01", ageYears: 7 },
];

function saveFor(plan: AdventurePlanV3, levelIndex: number): SaveView {
  const state = {
    ...createInitialAdventureState(plan),
    activeLevelIndex: levelIndex,
  };
  const adventure = toAdventureView(plan, state, Date.now());
  return {
    id: "save-probe",
    title: "probe",
    subject: { id: "fixture", label: "Fixture" },
    birthDate: "2020-01-01",
    memories: MEMORIES.map((memory) => ({
      ...memory,
      label: memory.id,
      state: "released" as const,
    })),
    recoveredIds: [],
    ageYears: 0,
    abilities: ["move", "interact", "jump"],
    appearance: { stage: "infant" },
    completed: false,
    format: "era-combat-v2",
    adventure,
    revision: 0,
  } as unknown as SaveView;
}

describe("WO079 probe: catalog and plan version boundaries", () => {
  it("parody-catalog-v4 is byte-identical to the archived v3 catalog", () => {
    expect(PARODY_CATALOG_VERSION).toBe("parody-catalog-v4");
    expect(PARODY_CATALOGS["parody-catalog-v4"]).toEqual(
      PARODY_CATALOGS["parody-catalog-v3"],
    );
    expect(PARODY_CATALOGS["parody-catalog-v4"]).not.toBe(
      PARODY_CATALOGS["parody-catalog-v3"],
    );
  });

  it("ALL_PARODY_CANDIDATES now carries duplicate catalog entry ids", () => {
    const ids = ALL_PARODY_CANDIDATES.map((entry) => entry.id);
    const duplicated = ids.filter(
      (id, index) => ids.indexOf(id) !== index,
    );
    expect({
      total: ids.length,
      unique: new Set(ids).size,
      repeats: duplicated.length,
    }).toMatchInlineSnapshot(`
      {
        "repeats": 18,
        "total": 30,
        "unique": 12,
      }
    `);
    // Every duplicate resolves to an identical entry, so id lookups stay correct.
    for (const id of new Set(duplicated)) {
      const matches = ALL_PARODY_CANDIDATES.filter((entry) => entry.id === id);
      expect(matches.every((entry) => JSON.stringify(entry) === JSON.stringify(matches[0]))).toBe(true);
    }
  });

  it("SMELL: the archived v2 plan builder now stamps the playground catalog version", () => {
    const plan = createAdventurePlan("2020-01-01", MEMORIES);
    expect(plan.version).toBe("era-level-plan-v2");
    expect(plan.catalogVersion).toBe("parody-catalog-v4");
    // The routes and roster stay archived, and it still round-trips.
    expect(plan.levels.map((level) => level.routeId)).toEqual([
      "gentle-intro-v1",
      "gentle-jump-v1",
    ]);
    expect(plan.levels.every((level) => level.encounters.length === 3)).toBe(true);
    expect(parseStoredAdventure(plan, createInitialAdventureState(plan))).not.toBeNull();
  });

  it("keeps an archived v3 route-memory plan on its original short route", () => {
    const archived = createRouteMemoryPlan("2020-01-01", MEMORIES, "parody-catalog-v3");
    expect(archived.levels.map((level) => level.routeId)).toEqual([
      "gentle-jump-v1",
      "gentle-jump-v1",
    ]);
    expect(archived.levels.map((level) => level.encounters.length)).toEqual([3, 3]);
    expect(
      parseStoredAdventure(archived, createInitialAdventureState(archived)),
    ).not.toBeNull();
    for (const index of [0, 1]) {
      const save = saveFor(archived, index);
      expect(
        authoredLevelLayout(save, save.adventure!.activeLevel as ActiveLevelView),
      ).toBeNull();
    }
  });

  it("rejects cross-version tampering in both directions", () => {
    const playground = createRouteMemoryPlan("2020-01-01", MEMORIES);
    const downgraded = {
      ...playground,
      catalogVersion: "parody-catalog-v3" as const,
    };
    expect(() =>
      parseStoredAdventure(downgraded, createInitialAdventureState(playground)),
    ).toThrow(/Save unavailable/);
    const archived = createRouteMemoryPlan("2020-01-01", MEMORIES, "parody-catalog-v3");
    const upgraded = { ...archived, catalogVersion: "parody-catalog-v4" as const };
    expect(() =>
      parseStoredAdventure(upgraded, createInitialAdventureState(archived)),
    ).toThrow(/Save unavailable/);
  });

  it("binds the five playground encounter slots by stable ordinal, not by kind", () => {
    const plan = createRouteMemoryPlan("2020-01-01", MEMORIES);
    for (const index of [0, 1]) {
      const save = saveFor(plan, index);
      const active = save.adventure!.activeLevel as ActiveLevelView;
      const level = authoredLevelLayout(save, active)!;
      const route = authoredRoute(active.routeId)!;
      expect(level.encounters.map((enemy) => enemy.kind)).toEqual([
        "ordinary-a",
        "ordinary-b",
        "ordinary-a",
        "ordinary-b",
        "boss",
      ]);
      // Distinct instance ids share artwork; positions come from the ordinal slot.
      expect(new Set(level.encounters.map((enemy) => enemy.id)).size).toBe(5);
      expect(level.encounters[0]!.position).not.toEqual(
        level.encounters[2]!.position,
      );
      expect(level.encounters[4]!.position).toEqual(
        route.anchors.encounters.boss.position,
      );
    }
  });
});

describe("WO079 probe: translated Besties encounter", () => {
  const origin = party.anchors.encounters.boss.position;
  const court = party.pieces.find((piece) => piece.id === "besties-court")!;

  function courtBounds() {
    const center = (court as { center: { x: number; z: number } }).center;
    const size = (court as { size: { x: number; z: number } }).size;
    return {
      minX: center.x - size.x / 2,
      maxX: center.x + size.x / 2,
      minZ: center.z - size.z / 2,
      maxZ: center.z + size.z / 2,
    };
  }

  it("keeps every translated hazard inside the supporting court", () => {
    const simulation = new BestiesSimulation(origin);
    const bounds = courtBounds();
    const seen: Array<{ kind: string; minX: number; maxX: number; minZ: number; maxZ: number }> = [];
    // Aim at the extreme corners of the activation box the runtime uses.
    const arena = party.anchors.encounters.boss.arena;
    for (const player of [
      { x: arena.minX - 1.5, y: 0, z: arena.minZ - 1.5 },
      { x: arena.maxX + 1.5, y: 0, z: arena.maxZ + 1.5 },
    ]) {
      for (let frame = 0; frame < 60 * 30; frame++) {
        const step = simulation.step({
          player,
          deltaSeconds: 1 / 60,
          active: true,
          aimAtPlayer: true,
          paused: false,
          defeated: false,
        });
        for (const hazard of step.frame.hazards) {
          const half = hazard.halfExtents;
          const xs =
            hazard.kind === "foam-bar"
              ? [hazard.sweep.from.x, hazard.sweep.to.x]
              : [hazard.center.x];
          seen.push({
            kind: hazard.kind,
            minX: Math.min(...xs) - half.x,
            maxX: Math.max(...xs) + half.x,
            minZ: hazard.center.z - half.z,
            maxZ: hazard.center.z + half.z,
          });
        }
      }
    }
    const envelope = seen.reduce(
      (total, rect) => ({
        minX: Math.min(total.minX, rect.minX),
        maxX: Math.max(total.maxX, rect.maxX),
        minZ: Math.min(total.minZ, rect.minZ),
        maxZ: Math.max(total.maxZ, rect.maxZ),
      }),
      { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
    );
     
    console.log(
      JSON.stringify({ origin, arena, court: bounds, hazardEnvelope: envelope }),
    );
    expect(envelope.minX).toBeGreaterThanOrEqual(bounds.minX);
    expect(envelope.maxX).toBeLessThanOrEqual(bounds.maxX);
    expect(envelope.minZ).toBeGreaterThanOrEqual(bounds.minZ);
    expect(envelope.maxZ).toBeLessThanOrEqual(bounds.maxZ);
    // The routine reaches well outside its declared arena, which the validator
    // never checks against the supporting surface.
    expect(envelope.minX).toBeLessThan(arena.minX);
    expect(envelope.maxX).toBeGreaterThan(arena.maxX);
  });

  it("targets both actors in world space around the authored origin", () => {
    const simulation = new BestiesSimulation(origin);
    const frame = simulation.frame();
    expect(frame.arenaOrigin).toEqual(origin);
    const left = nearestBestiesActor(frame, { x: origin.x - 2, y: 0, z: origin.z });
    const right = nearestBestiesActor(frame, { x: origin.x + 2, y: 0, z: origin.z });
    expect(left.id).toBe("bestie-black");
    expect(right.id).toBe("bestie-pink");
    expect(left.position.z).toBeCloseTo(origin.z, 6);
    expect(BESTIES_ARENA_CENTER.z).toBe(-22);
  });

  it("FORGIVENESS NOTE: stepping 1.6 m out of the arena resets the whole routine", () => {
    const simulation = new BestiesSimulation(origin);
    const inside = { x: origin.x, y: 0, z: origin.z };
    let seconds = 0;
    while (seconds < BESTIES_PHASE_SECONDS["pink-warning"] + 0.5) {
      simulation.step({
        player: inside,
        deltaSeconds: 1 / 60,
        active: true,
        aimAtPlayer: true,
        paused: false,
        defeated: false,
      });
      seconds += 1 / 60;
    }
    expect(simulation.frame().phase).toBe("pink-trick");
    // The runtime gate is arena ± 1.5 m (createGame.ts nearBesties).
    const stepOut = simulation.step({
      player: inside,
      deltaSeconds: 1 / 60,
      active: false,
      aimAtPlayer: true,
      paused: false,
      defeated: false,
    });
    expect(stepOut.frame.phase).toBe("inactive");
    expect(stepOut.frame.cycleIndex).toBe(0);
    expect(stepOut.frame.hazards).toEqual([]);
  });
});
