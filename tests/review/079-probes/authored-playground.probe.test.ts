/**
 * WO079 adversarial probes for candidate f2bfe36 (PLAN009 / DESIGN017).
 *
 * These tests are review evidence, not proposed production tests. Each one
 * documents an observed behaviour of the shipped documents, validator or
 * runtime adapter and states in its title whether that behaviour is a defect.
 */
import { describe, expect, it } from "vitest";
import garden from "../../../src/shared/levels/garden-playground-v1.json";
import party from "../../../src/shared/levels/besties-playground-v1.json";
import {
  AUTHORED_LEVEL_LIMITS,
  resolveAuthoredLevelDocument,
  validateAuthoredLevelDocument,
  type AuthoredLevelDocument,
} from "../../../src/shared/authored-level";
import {
  EnemySimulation,
  enemyActivationRadius,
  enemyAttackRange,
} from "../../../src/game/combat";
import { createObbyState, stepObby, OBBY_TUNING } from "../../../src/game/obby";
import { authoredLevelLayout } from "../../../src/game/authored-layout";
import { checkpointForSave } from "../../../src/game/level";
import {
  createInitialAdventureState,
  createRouteMemoryPlan,
  toAdventureView,
  type AdventureMemory,
  type AdventurePlanV3,
} from "../../../src/shared/adventure";
import type { SaveView, ActiveLevelView } from "../../../src/shared/contracts";

const MEMORIES: AdventureMemory[] = [
  { id: "memory-age-0", date: "2020-07-01", ageYears: 0 },
  { id: "memory-age-2", date: "2022-01-01", ageYears: 2 },
  { id: "memory-age-4", date: "2024-01-01", ageYears: 4 },
  { id: "memory-age-5", date: "2025-01-01", ageYears: 5 },
  { id: "memory-age-6", date: "2026-01-01", ageYears: 6 },
  { id: "memory-age-7", date: "2027-01-01", ageYears: 7 },
];

const DOCS: Array<[string, AuthoredLevelDocument]> = [
  ["garden-playground-v1", garden as unknown as AuthoredLevelDocument],
  ["besties-playground-v1", party as unknown as AuthoredLevelDocument],
];

function clone(document: AuthoredLevelDocument): AuthoredLevelDocument {
  return JSON.parse(JSON.stringify(document)) as AuthoredLevelDocument;
}

interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ
  );
}

function strikeEnvelope(arena: Rect, reach: number): Rect {
  return {
    minX: arena.minX - reach,
    maxX: arena.maxX + reach,
    minZ: arena.minZ - reach,
    maxZ: arena.maxZ + reach,
  };
}

function saveFor(plan: AdventurePlanV3, levelIndex: number): SaveView {
  let state = createInitialAdventureState(plan);
  // Advance to the requested chapter by walking the plan's own level order.
  state = { ...state, activeLevelIndex: levelIndex };
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

describe("WO079 probe: shipped documents", () => {
  it("DEFECT: every friendly resident anchor that shares a platform with a fight sits inside that enemy's strike envelope", () => {
    const inside: string[] = [];
    for (const [id, document] of DOCS) {
      for (const [slot, friendly] of Object.entries(document.anchors.friendlies)) {
        const point: Rect = {
          minX: friendly.position.x - 0.3,
          maxX: friendly.position.x + 0.3,
          minZ: friendly.position.z - 0.3,
          maxZ: friendly.position.z + 0.3,
        };
        for (const [encounterSlot, encounter] of Object.entries(
          document.anchors.encounters,
        )) {
          const reach =
            encounterSlot === "boss"
              ? AUTHORED_LEVEL_LIMITS.bossAttackReach
              : AUTHORED_LEVEL_LIMITS.ordinaryAttackReach;
          // The validator's own safe-content rule only tests the raw arena.
          expect(overlaps(point, encounter.arena)).toBe(false);
          if (overlaps(point, strikeEnvelope(encounter.arena, reach)))
            inside.push(`${id}:${slot} in ${encounterSlot}`);
        }
      }
    }
    expect(inside).toEqual([
      "garden-playground-v1:friendly-2 in ordinary-3",
      "besties-playground-v1:friendly-3 in ordinary-4",
    ]);
  });

  it("DEFECT: after the fight draws the enemy across its arena, the live simulation strikes a player standing on that friendly anchor", () => {
    const plan = createRouteMemoryPlan("2020-01-01", MEMORIES);
    const observed: Array<[string, string, number]> = [];
    for (const [index, [id, document]] of DOCS.entries()) {
      const save = saveFor(plan, index);
      const active = save.adventure!.activeLevel as ActiveLevelView;
      const level = authoredLevelLayout(save, active)!;
      const slot = id === "garden-playground-v1" ? "friendly-2" : "friendly-3";
      const anchor =
        document.anchors.friendlies[
          slot as keyof typeof document.anchors.friendlies
        ];
      const encounterSlot =
        id === "garden-playground-v1" ? "ordinary-3" : "ordinary-4";
      const arena = document.anchors.encounters[encounterSlot].arena;
      const simulation = new EnemySimulation(level, save);
      // 1. The player fights at the near corner of the arena, as the route requires.
      const lure = {
        x: Math.max(arena.minX, anchor.position.x + 0.6),
        y: 0,
        z: encounterSlot === "ordinary-3" ? arena.maxZ - 0.4 : arena.maxZ - 0.4,
      };
      for (let frame = 0; frame < 600; frame++)
        simulation.step({ player: lure, deltaSeconds: 1 / 60, active: true }, save);
      // 2. Hurt, the player steps back onto the resident anchor to claim the boon.
      const player = { ...anchor.position };
      let struck: string | null = null;
      let frames = 0;
      for (; frames < 600 && struck === null; frames++) {
        const contacts = simulation.step(
          { player, deltaSeconds: 1 / 60, active: true },
          save,
        );
        if (contacts.length > 0) struck = contacts.join(",");
      }
      observed.push([`${id}:${slot}`, struck ?? "no-hit", frames]);
      expect(struck).not.toBeNull();
    }
    expect(observed.map(([where]) => where)).toEqual([
      "garden-playground-v1:friendly-2",
      "besties-playground-v1:friendly-3",
    ]);
    expect(enemyAttackRange("ordinary")).toBe(1.35);
    expect(enemyActivationRadius).toBe(6);
  });
});

describe("WO079 probe: validator coverage", () => {
  it("DEFECT: an anchor moved just outside an arena but well inside the strike envelope still validates", () => {
    const document = clone(garden as unknown as AuthoredLevelDocument);
    const arena = document.anchors.encounters["ordinary-3"].arena;
    // 0.05 m clear of the arena edge; the ordinary reach is 1.35 m.
    const unsafe = {
      platformId: "memory-grove",
      position: { x: 0, y: 0, z: arena.maxZ + 0.35 },
    };
    (document.anchors.memories as Record<string, unknown>)["minor-two"] = unsafe;
    expect(validateAuthoredLevelDocument(document)).toEqual([]);
    const point = {
      minX: unsafe.position.x - 0.3,
      maxX: unsafe.position.x + 0.3,
      minZ: unsafe.position.z - 0.3,
      maxZ: unsafe.position.z + 0.3,
    };
    expect(
      overlaps(
        point,
        strikeEnvelope(arena, AUTHORED_LEVEL_LIMITS.ordinaryAttackReach),
      ),
    ).toBe(true);
  });

  it("DEFECT: a permanently static sweeper laid across the only landing of a required jump validates and makes the route impassable", () => {
    const document = clone(garden as unknown as AuthoredLevelDocument);
    // winding-east is the sole main-path successor of picnic; block its landing edge.
    (document as unknown as { pieces: unknown[] }).pieces = [
      ...document.pieces,
      {
        type: "sweeper",
        id: "probe-wall",
        center: { x: 3, y: 0.22, z: -25.6 },
        halfLength: 3,
        radius: 0.4,
      },
    ];
    expect(validateAuthoredLevelDocument(document)).toEqual([]);

    const { course } = resolveAuthoredLevelDocument(document);
    // Drive the real controller straight at the landing from the picnic edge.
    const state = createObbyState({ x: 3, y: 0, z: -23.4 });
    state.grounded = true;
    let time = 0;
    let recoveries = 0;
    let reached = false;
    for (let frame = 0; frame < 1800; frame++) {
      time += 1 / 60;
      const result = stepObby(
        state,
        { moveX: 0, moveY: -1 },
        course,
        {
          deltaSeconds: 1 / 60,
          timeSeconds: time,
          cameraYaw: 0,
          canJump: true,
          jumpPressed: state.grounded && state.position.z <= -23.6,
          radius: 0.25,
          height: 0.88,
          tuning: { moveSpeed: 4 },
        },
      );
      if (result.recovered) recoveries++;
      if (state.supportId === "winding-east" && state.grounded) {
        reached = true;
        break;
      }
    }
    expect(reached).toBe(false);
    expect(recoveries).toBeGreaterThan(0);
    expect(OBBY_TUNING.recoverySeconds).toBe(0.8);
  });

  it("DEFECT: required equipment ordering is only platform-granular, so the attack tool may sit behind its first fight", () => {
    const document = clone(garden as unknown as AuthoredLevelDocument);
    const encounter = document.anchors.encounters["ordinary-1"];
    // picnic spans z[-24,-16]; put the attack tool 1.5 m past the fight.
    (document.anchors.pickups as Record<string, unknown>)["attack-tool"] = {
      platformId: "picnic",
      position: { x: -3, y: 0, z: -23.5 },
    };
    expect(validateAuthoredLevelDocument(document)).toEqual([]);
    expect(encounter.position.z).toBeGreaterThan(-23.5);
  });

  it("no overlap check exists between two encounter arenas", () => {
    const document = clone(garden as unknown as AuthoredLevelDocument);
    (document.anchors.encounters as Record<string, unknown>)["ordinary-2"] = {
      ...document.anchors.encounters["ordinary-2"],
      platformId: "picnic",
      position: { x: -2, y: 0, z: -21.5 },
      arena: { minX: -4, maxX: 4, minZ: -23, maxZ: -20 },
      checkpointId: "picnic-safe",
    };
    const issues = validateAuthoredLevelDocument(document);
    // Only the ordering rule fires; the coincident arenas themselves are accepted.
    expect(issues.map((issue) => issue.code)).toEqual([]);
  });
});

describe("WO079 probe: runtime adapter and retry", () => {
  it("binds both chapters and reports their retry checkpoints", () => {
    const plan = createRouteMemoryPlan("2020-01-01", MEMORIES);
    const observed: Record<string, unknown> = {};
    for (const [index, [id]] of DOCS.entries()) {
      const save = saveFor(plan, index);
      const active = save.adventure!.activeLevel as ActiveLevelView;
      const level = authoredLevelLayout(save, active)!;
      observed[id] = {
        route: level.routeId,
        encounters: level.encounters.map((enemy) => [
          enemy.kind,
          enemy.retryCheckpointId,
        ]),
        spawn: level.checkpoint,
        reload: checkpointForSave(save, level),
      };
    }
    expect(observed).toMatchInlineSnapshot(`
      {
        "besties-playground-v1": {
          "encounters": [
            [
              "ordinary-a",
              "party-picnic-safe",
            ],
            [
              "ordinary-b",
              "ribbon-safe",
            ],
            [
              "ordinary-a",
              "party-grove-safe",
            ],
            [
              "ordinary-b",
              "party-fair-safe",
            ],
            [
              "boss",
              "besties-safe",
            ],
          ],
          "reload": {
            "x": 0,
            "y": 0,
            "z": 1,
          },
          "route": "besties-playground-v1",
          "spawn": {
            "x": 0,
            "y": 0,
            "z": 1,
          },
        },
        "garden-playground-v1": {
          "encounters": [
            [
              "ordinary-a",
              "picnic-safe",
            ],
            [
              "ordinary-b",
              "woodland-safe",
            ],
            [
              "ordinary-a",
              "grove-safe",
            ],
            [
              "ordinary-b",
              "pond-safe",
            ],
            [
              "boss",
              "dragon-safe",
            ],
          ],
          "reload": {
            "x": 0,
            "y": 0,
            "z": 1,
          },
          "route": "garden-playground-v1",
          "spawn": {
            "x": 0,
            "y": 0,
            "z": 1,
          },
        },
      }
    `);
  });
});
