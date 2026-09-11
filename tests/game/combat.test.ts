import { describe, expect, it } from "vitest";
import {
  EnemySimulation,
  bossIsActive,
  findAttackTarget,
} from "../../src/game/combat";
import {
  createLevelLayout,
  type EncounterPlacement,
  type LevelLayout,
} from "../../src/game/level";
import type { EnemyFrame } from "../../src/game/types";
import { makeEraSave } from "./fixtures";

function stepMany(
  simulation: EnemySimulation,
  save: ReturnType<typeof makeEraSave>,
  player: { x: number; y: number; z: number },
  frames: number,
): string[] {
  const contacts: string[] = [];
  for (let index = 0; index < frames; index += 1) {
    contacts.push(
      ...simulation.step({ player, deltaSeconds: 0.05, active: true }, save),
    );
  }
  return contacts;
}

function levelWithFirstOrdinary(
  save: ReturnType<typeof makeEraSave>,
  changes: Partial<EncounterPlacement> = {},
): LevelLayout {
  const level = createLevelLayout(save);
  const placement = level.encounters.find((enemy) =>
    enemy.id.endsWith("ordinary-a"),
  );
  if (!placement) throw new Error("Fixture has no first ordinary encounter");
  return {
    ...level,
    encounters: [
      {
        ...placement,
        ...changes,
        position: changes.position
          ? { ...changes.position }
          : { ...placement.position },
      },
    ],
  };
}

describe("enemy combat simulation", () => {
  it("chases, telegraphs, freezes while paused, and damages only during contact", () => {
    const save = makeEraSave();
    const simulation = new EnemySimulation(createLevelLayout(save), save);
    const player = { x: -2, y: 0, z: -7 };

    stepMany(simulation, save, player, 2);
    expect(
      simulation.frames().find((enemy) => enemy.id.endsWith("ordinary-a"))
        ?.phase,
    ).toBe("windup");
    stepMany(simulation, save, player, 10);
    const beforePause = simulation
      .frames()
      .find((enemy) => enemy.id.endsWith("ordinary-a"));
    simulation.step({ player, deltaSeconds: 40, active: false }, save);
    const afterPause = simulation
      .frames()
      .find((enemy) => enemy.id.endsWith("ordinary-a"));
    expect(afterPause).toEqual(beforePause);

    stepMany(simulation, save, player, 6);
    expect(
      simulation.frames().find((enemy) => enemy.id.endsWith("ordinary-a"))
        ?.phase,
    ).toBe("strike");
    const contacts = simulation.step(
      { player, deltaSeconds: 0.05, active: true },
      save,
    );
    expect(contacts).toEqual(["level-1-2020-ordinary-a"]);
    simulation.noteHitDispatched();
    expect(
      simulation.step({ player, deltaSeconds: 0.05, active: true }, save),
    ).toEqual([]);
  });

  it("lets a jump clear the entire active strike area", () => {
    const save = makeEraSave();
    const simulation = new EnemySimulation(createLevelLayout(save), save);
    const airborne = { x: -2, y: 0.31, z: -7 };
    const contacts = stepMany(simulation, save, airborne, 24);
    expect(contacts).toEqual([]);
    expect(
      simulation.frames().find((enemy) => enemy.id.endsWith("ordinary-a"))
        ?.phase,
    ).toBe("cooldown");
  });

  it("uses the enemy floor height for strike contact", () => {
    const save = makeEraSave();
    const elevatedLevel = levelWithFirstOrdinary(save, {
      position: { x: -2, y: 2, z: -8 },
    });
    const sameFloor = new EnemySimulation(elevatedLevel, save);
    expect(stepMany(sameFloor, save, { x: -2, y: 2, z: -7 }, 24)).toEqual([
      "level-1-2020-ordinary-a",
    ]);

    const belowIsland = new EnemySimulation(elevatedLevel, save);
    expect(stepMany(belowIsland, save, { x: -2, y: 0, z: -7 }, 24)).toEqual([]);
    const justFellOff = new EnemySimulation(elevatedLevel, save);
    expect(stepMany(justFellOff, save, { x: -2, y: 1.98, z: -7 }, 24)).toEqual(
      [],
    );
    const aboveContact = new EnemySimulation(elevatedLevel, save);
    expect(stepMany(aboveContact, save, { x: -2, y: 2.31, z: -7 }, 24)).toEqual(
      [],
    );
  });

  it("keeps bounded enemies idle across gaps while legacy enemies keep chasing", () => {
    const save = makeEraSave();
    const arena = { minX: -2.25, maxX: -1.75, minZ: -8.5, maxZ: -7.5 };
    const boundedLevel = levelWithFirstOrdinary(save, { arena });
    const playerAcrossGap = { x: -2, y: 0, z: -3 };
    const bounded = new EnemySimulation(boundedLevel, save);

    stepMany(bounded, save, playerAcrossGap, 40);
    expect(bounded.frames()[0]).toMatchObject({
      position: { x: -2, y: 0, z: -8 },
      phase: "idle",
    });

    const narrowedLevel = levelWithFirstOrdinary(save, {
      arena: { ...arena, maxZ: -7.75 },
    });
    bounded.sync(narrowedLevel, save);
    expect(bounded.frames()[0]?.position.z).toBe(-8);
    bounded.reset(boundedLevel, save);
    expect(bounded.frames()[0]?.position).toEqual({ x: -2, y: 0, z: -8 });

    const legacy = new EnemySimulation(levelWithFirstOrdinary(save), save);
    stepMany(legacy, save, playerAcrossGap, 40);
    expect(legacy.frames()[0]?.position.z).toBeCloseTo(-6.3425, 6);
    expect(legacy.frames()[0]?.position.z).toBeGreaterThan(arena.maxZ);
  });

  it("restarts a threatened attack with a full telegraph after resume", () => {
    const save = makeEraSave();
    const simulation = new EnemySimulation(createLevelLayout(save), save);
    const player = { x: -2, y: 0, z: -7 };
    stepMany(simulation, save, player, 2);
    while (
      simulation.frames().find((enemy) => enemy.id.endsWith("ordinary-a"))
        ?.phase === "windup"
    ) {
      simulation.step({ player, deltaSeconds: 0.05, active: true }, save);
    }
    expect(
      simulation.frames().find((enemy) => enemy.id.endsWith("ordinary-a"))
        ?.phase,
    ).toBe("strike");

    simulation.restartThreatenedAttacks();
    const restarted = simulation
      .frames()
      .find((enemy) => enemy.id.endsWith("ordinary-a"));
    expect(restarted).toMatchObject({
      phase: "windup",
      windupProgress: 0,
    });
    expect(
      simulation.step({ player, deltaSeconds: 0, active: true }, save),
    ).toEqual([]);
    expect(stepMany(simulation, save, player, 16)).toEqual([]);
    expect(
      simulation.step({ player, deltaSeconds: 0.05, active: true }, save),
    ).toEqual(["level-1-2020-ordinary-a"]);
  });

  it("keeps the boss dormant until both ordinary encounters are defeated", () => {
    const initial = makeEraSave();
    const level = createLevelLayout(initial);
    const simulation = new EnemySimulation(level, initial);
    const player = { x: 0, y: 0, z: -20 };
    stepMany(simulation, initial, player, 4);
    const dormantBoss = simulation
      .frames()
      .find((enemy) => enemy.id.endsWith("boss"));
    expect(dormantBoss).toMatchObject({
      phase: "idle",
      position: { x: 0, y: 0, z: -21 },
    });
    expect(bossIsActive(initial)).toBe(false);

    const unlocked = makeEraSave({
      defeatedIds: ["level-1-2020-ordinary-a", "level-1-2020-ordinary-b"],
    });
    simulation.sync(createLevelLayout(unlocked), unlocked);
    stepMany(simulation, unlocked, player, 2);
    expect(bossIsActive(unlocked)).toBe(true);
    expect(
      simulation.frames().find((enemy) => enemy.id.endsWith("boss"))?.phase,
    ).toBe("windup");
  });

  it.each([-19, -18.8])(
    "lets the routed boss threaten the landing at z=%s without leaving its island",
    (z) => {
      const base = makeEraSave({
        levelIndex: 1,
        defeatedIds: ["level-2-2024-ordinary-a", "level-2-2024-ordinary-b"],
      });
      const save = {
        ...base,
        adventure: {
          ...base.adventure!,
          activeLevel: {
            ...base.adventure!.activeLevel!,
            routeId: "gentle-jump-v1" as const,
          },
        },
      };
      const simulation = new EnemySimulation(createLevelLayout(save), save);
      const player = { x: 0, y: 0, z };

      const contacts = stepMany(simulation, save, player, 80);
      const boss = simulation
        .frames()
        .find((enemy) => enemy.id === "level-2-2024-boss");
      expect(contacts).toContain("level-2-2024-boss");
      expect(boss?.position.z).toBeGreaterThanOrEqual(-24);
      expect(boss?.position.z).toBeLessThanOrEqual(-21);
    },
  );

  it("keeps the player outside living enemy colliders", () => {
    const save = makeEraSave();
    const level = createLevelLayout(save);
    const simulation = new EnemySimulation(level, save);
    const player = { x: -2, y: 0, z: -8 };
    simulation.resolvePlayerCollision(player, level);
    expect(Math.hypot(player.x + 2, player.z + 8)).toBeCloseTo(0.67, 6);

    const defeated = makeEraSave({
      defeatedIds: ["level-1-2020-ordinary-a"],
    });
    simulation.sync(createLevelLayout(defeated), defeated);
    const throughDefeated = { x: -2, y: 0, z: -8 };
    simulation.resolvePlayerCollision(throughDefeated, level);
    expect(throughDefeated).toEqual({ x: -2, y: 0, z: -8 });

    simulation.sync(level, save);
    expect(
      simulation.frames().find((enemy) => enemy.id.endsWith("ordinary-a")),
    ).toMatchObject({
      position: { x: -2, y: 0, z: -8 },
      facing: 0,
      phase: "idle",
      windupProgress: 0,
      hp: 4,
    });
    simulation.resolvePlayerCollision(throughDefeated, level);
    expect(
      Math.hypot(throughDefeated.x + 2, throughDefeated.z + 8),
    ).toBeCloseTo(0.67, 6);
  });

  it("does not push a player whose feet are vertically clear of an enemy", () => {
    const save = makeEraSave();
    const level = levelWithFirstOrdinary(save, {
      position: { x: -2, y: 2, z: -8 },
    });
    const simulation = new EnemySimulation(level, save);

    const sameFloor = { x: -2, y: 2, z: -8 };
    simulation.resolvePlayerCollision(sameFloor, level);
    expect(sameFloor).toEqual({ x: -2, y: 2, z: -7.33 });

    const airborne = { x: -2, y: 2.31, z: -8 };
    simulation.resolvePlayerCollision(airborne, level);
    expect(airborne).toEqual({ x: -2, y: 2.31, z: -8 });

    const belowIsland = { x: -2, y: 0, z: -8 };
    simulation.resolvePlayerCollision(belowIsland, level);
    expect(belowIsland).toEqual({ x: -2, y: 0, z: -8 });
  });
});

describe("attack targeting", () => {
  const frame = (id: string, x: number, z: number, y = 0): EnemyFrame => ({
    id,
    position: { x, y, z },
    facing: 0,
    phase: "idle",
    windupProgress: 0,
    hp: 4,
    maxHp: 4,
  });

  it("uses the nearest target in the 120 degree facing arc and gates the boss", () => {
    const save = makeEraSave();
    const enemies = [
      frame("level-1-2020-ordinary-a", 0, -1.5),
      frame("level-1-2020-ordinary-b", 1, -1.3),
      frame("level-1-2020-boss", 0, -1),
    ];
    expect(
      findAttackTarget(save, enemies, { x: 0, y: 0, z: 0 }, 0, false)?.id,
    ).toBe("level-1-2020-ordinary-a");
  });

  it("can auto-face a nearby target and admits the boss only after its gate", () => {
    const oneOrdinaryLeft = makeEraSave({
      defeatedIds: ["level-1-2020-ordinary-a"],
    });
    const behind = [frame("level-1-2020-ordinary-b", 0, 1.2)];
    expect(
      findAttackTarget(oneOrdinaryLeft, behind, { x: 0, y: 0, z: 0 }, 0, false),
    ).toBeNull();
    expect(
      findAttackTarget(oneOrdinaryLeft, behind, { x: 0, y: 0, z: 0 }, 0, true)
        ?.id,
    ).toBe("level-1-2020-ordinary-b");

    const bossUnlocked = makeEraSave({
      defeatedIds: ["level-1-2020-ordinary-a", "level-1-2020-ordinary-b"],
    });
    expect(
      findAttackTarget(
        bossUnlocked,
        [frame("level-1-2020-boss", 0, -1.8)],
        { x: 0, y: 0, z: 0 },
        0,
        false,
      )?.id,
    ).toBe("level-1-2020-boss");
  });

  it("allows normal jumping attacks but rejects targets on another height", () => {
    const save = makeEraSave();
    const id = "level-1-2020-ordinary-a";

    expect(
      findAttackTarget(
        save,
        [frame(id, 0, -1.5, 0)],
        { x: 0, y: 0.84, z: 0 },
        0,
        false,
      )?.id,
    ).toBe(id);
    expect(
      findAttackTarget(
        save,
        [frame(id, 0, -1.5, 2)],
        { x: 0, y: 0, z: 0 },
        0,
        false,
      ),
    ).toBeNull();
  });

  it("gives the Prism wand ranged reach while retaining the mallet's melee reach", () => {
    const bossId = "level-2-2024-boss";
    const prism = makeEraSave({
      levelIndex: 1,
      collectedKinds: ["attack-tool"],
      defeatedIds: ["level-2-2024-ordinary-a", "level-2-2024-ordinary-b"],
    });
    expect(
      findAttackTarget(
        prism,
        [frame(bossId, 0, -4.2)],
        { x: 0, y: 0, z: 0 },
        0,
        true,
      )?.id,
    ).toBe(bossId);
    expect(
      findAttackTarget(
        prism,
        [frame(bossId, 0, -4.26)],
        { x: 0, y: 0, z: 0 },
        0,
        true,
      ),
    ).toBeNull();

    const malletBoss = makeEraSave({
      collectedKinds: ["attack-tool"],
      defeatedIds: ["level-1-2020-ordinary-a", "level-1-2020-ordinary-b"],
    });
    expect(
      findAttackTarget(
        malletBoss,
        [frame("level-1-2020-boss", 0, -2.01)],
        { x: 0, y: 0, z: 0 },
        0,
        true,
      ),
    ).toBeNull();
  });
});
