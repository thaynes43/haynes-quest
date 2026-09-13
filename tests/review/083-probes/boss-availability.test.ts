import { describe, expect, it } from "vitest";
import {
  createInitialAdventureState,
  createRouteMemoryPlan,
  reduceAdventureAction,
  toAdventureView,
  type AdventureMemory,
  type AdventurePlanV3,
  type AdventureState,
} from "../../../src/shared/adventure.js";
import { PARODY_CATALOG_VERSION } from "../../../src/shared/parody-catalog.js";

const MEMORIES: AdventureMemory[] = [
  { id: "memory-age-0", date: "2020-07-01", ageYears: 0 },
  { id: "memory-age-2", date: "2022-01-01", ageYears: 2 },
  { id: "memory-age-4", date: "2024-01-01", ageYears: 4 },
  { id: "memory-age-5", date: "2025-01-01", ageYears: 5 },
  { id: "memory-age-6", date: "2026-01-01", ageYears: 6 },
  { id: "memory-age-7", date: "2027-01-01", ageYears: 7 },
];

function equip(plan: AdventurePlanV3, state: AdventureState): AdventureState {
  const level = plan.levels[0]!;
  const pickup = level.pickups.find((item) => item.kind === "attack-tool")!;
  return reduceAdventureAction(
    plan,
    state,
    { type: "collect-equipment", levelId: level.id, pickupId: pickup.pickupId },
    0,
  );
}

describe("WO083 probe: boss availability by catalog version", () => {
  it("records the default catalog version and the routeId it selects", () => {
    console.log("PARODY_CATALOG_VERSION =", PARODY_CATALOG_VERSION);
    for (const version of ["parody-catalog-v4", "parody-catalog-v5"] as const) {
      const plan = createRouteMemoryPlan("2020-01-01", MEMORIES, version);
      console.log(
        version,
        "->",
        plan.levels.map((level) => (level as unknown as { routeId: string }).routeId).join(", "),
      );
    }
  });

  it("keeps the archived v1 route boss gated and unlocks the v2 route boss", () => {
    for (const [version, expected] of [
      ["parody-catalog-v4", false],
      ["parody-catalog-v5", true],
    ] as const) {
      const plan = createRouteMemoryPlan("2020-01-01", MEMORIES, version);
      const level = plan.levels[0]!;
      const boss = level.encounters.find((e) => e.role === "boss")!;
      const state = equip(plan, createInitialAdventureState(plan));
      const view = toAdventureView(plan, state, 0).activeLevel!;
      const bossView = view.encounters.find((e) => e.id === boss.id)!;
      console.log(
        version,
        "routeId=",
        (level as unknown as { routeId: string }).routeId,
        "boss.available=",
        bossView.available,
      );
      expect(bossView.available).toBe(expected);
      const attack = () =>
        reduceAdventureAction(
          plan,
          state,
          { type: "attack", levelId: level.id, encounterId: boss.id },
          0,
        );
      if (expected) expect(attack).not.toThrow();
      else expect(attack).toThrow("ENCOUNTER_NOT_ACTIVE");
    }
  });
});
