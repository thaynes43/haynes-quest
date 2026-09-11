import { describe, expect, it } from "vitest";
import {
  EnemySimulation,
  bossIsActive,
  findAttackTarget,
} from "../../src/game/combat";
import { createLevelLayout } from "../../src/game/level";
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
  });
});

describe("attack targeting", () => {
  const frame = (id: string, x: number, z: number): EnemyFrame => ({
    id,
    position: { x, y: 0, z },
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
});
