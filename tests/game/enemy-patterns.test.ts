import { describe, expect, it } from "vitest";
import { EnemySimulation } from "../../src/game/combat";
import { createLevelLayout, type LevelLayout } from "../../src/game/level";
import type { SaveView } from "../../src/shared/contracts";
import { makeEraSave } from "./fixtures";

const flatPlayer = { x: 4, y: 0, z: 0 };

function patternedFight(assetIds: string[]): { level: LevelLayout; save: SaveView } {
  const save = makeEraSave();
  const base = save.adventure!.activeLevel!.encounters.find((entry) => entry.role === "ordinary")!;
  save.adventure!.activeLevel!.encounters = assetIds.map((assetId, index) => ({
    ...base,
    id: `ordinary-${index + 1}`,
    content: {
      catalogEntryId: assetId,
      catalogEntryVersion: "v001",
      assetId,
      assetVersion: "v001",
    },
  }));
  const level: LevelLayout = {
    ...createLevelLayout(save),
    encounters: assetIds.map((_, index) => ({
      id: `ordinary-${index + 1}`,
      role: "ordinary" as const,
      kind: "ordinary-a" as const,
      position: { x: index * 0.3, y: 0, z: 0 },
    })),
    course: {
      platforms: [{
        id: "fight-floor",
        center: { x: 2, y: -0.3, z: 0 },
        size: { x: 20, y: 0.6, z: 10 },
      }],
      hazards: [],
      checkpoints: [],
    },
    friendlies: [],
  };
  return { level, save };
}

function run(
  simulation: EnemySimulation,
  save: SaveView,
  player: { x: number; y: number; z: number },
  frames: number,
): string[] {
  const contacts: string[] = [];
  for (let index = 0; index < frames; index++) {
    contacts.push(...simulation.step({ player, deltaSeconds: 0.05, active: true }, save));
  }
  return contacts;
}

describe("DESIGN-030 ordinary attack patterns", () => {
  it("keeps a new charge variant distinct from its old partner and locks its lane", () => {
    const { level, save } = patternedFight(["gadget-hammer-hopper", "gadget-helper"]);
    const simulation = new EnemySimulation(level, save);
    expect(simulation.frames().map((entry) => entry.attackPattern)).toEqual(["charge", undefined]);

    run(simulation, save, flatPlayer, 3);
    const warning = simulation.frames()[0]!;
    expect(warning.phase).toBe("windup");
    expect(warning.attackTarget?.x).toBeCloseTo(warning.position.x + 4);
    const locked = warning.attackTarget;
    const standing = warning.position;
    run(simulation, save, { x: 4, y: 0, z: 1.5 }, 12);
    expect(simulation.frames()[0]?.attackTarget).toEqual(locked);
    expect(simulation.frames()[0]?.position).toEqual(standing);
  });

  it("charges through a fixed lane once, while a side step or jump dodges", () => {
    const make = () => {
      const { level, save } = patternedFight(["broccoli-bouncer"]);
      return { simulation: new EnemySimulation(level, save), save };
    };
    const straight = make();
    expect(run(straight.simulation, straight.save, flatPlayer, 50)).toContain("ordinary-1");
    expect(straight.simulation.frames()[0]?.attackPattern).toBe("charge");

    const sidestep = make();
    run(sidestep.simulation, sidestep.save, flatPlayer, 5);
    expect(run(sidestep.simulation, sidestep.save, { x: 4, y: 0, z: 1.5 }, 50)).toEqual([]);

    const jump = make();
    run(jump.simulation, jump.save, flatPlayer, 5);
    expect(run(jump.simulation, jump.save, { x: 4, y: 2, z: 0 }, 27)).toEqual([]);
    expect(jump.simulation.frames()[0]?.position.x).toBeGreaterThan(1);
  });

  it("fires a visible finite bolt after a full fixed warning, and a jump clears it", () => {
    const make = () => {
      const { level, save } = patternedFight(["lab-robot-sentry"]);
      return { simulation: new EnemySimulation(level, save), save };
    };
    const straight = make();
    run(straight.simulation, straight.save, flatPlayer, 4);
    const warning = straight.simulation.frames()[0]!;
    expect(warning).toMatchObject({ phase: "windup", attackPattern: "bolt" });
    const target = warning.attackTarget;
    run(straight.simulation, straight.save, { x: 4, y: 0, z: 1 }, 10);
    expect(straight.simulation.frames()[0]?.attackTarget).toEqual(target);
    expect(straight.simulation.frames()[0]?.position.x).toBe(0);
    let contacts: string[] = [];
    for (let tick = 0; tick < 35 && contacts.length === 0; tick++) {
      contacts = run(straight.simulation, straight.save, flatPlayer, 1);
    }
    expect(contacts).toContain("ordinary-1");
    expect(straight.simulation.frames()[0]?.phase).toBe("cooldown");
    expect(straight.simulation.frames()[0]?.projectile).toBeUndefined();

    const jump = make();
    run(jump.simulation, jump.save, flatPlayer, 4);
    expect(run(jump.simulation, jump.save, { x: 4, y: 2, z: 0 }, 24)).toEqual([]);
    expect(jump.simulation.frames()[0]?.projectile).toBeDefined();
    expect(run(jump.simulation, jump.save, { x: 4, y: 2, z: 0 }, 25)).toEqual([]);
  });

  it("alternates special and baseline legacy twins in old started rosters", () => {
    const { level, save } = patternedFight([
      "mischief-kitten", "mischief-kitten", "mischief-kitten", "mischief-kitten",
    ]);
    const simulation = new EnemySimulation(level, save);
    expect(simulation.frames().map((entry) => entry.attackPattern))
      .toEqual(["agile", undefined, "agile", undefined]);
  });

  it("lets agile foes close faster, then leaves them recovering longer", () => {
    const agileFight = patternedFight(["mischief-kitten-skater"]);
    const plainFight = patternedFight(["putty-grunt"]);
    const agile = new EnemySimulation(agileFight.level, agileFight.save);
    const plain = new EnemySimulation(plainFight.level, plainFight.save);
    run(agile, agileFight.save, { x: 6, y: 0, z: 0 }, 8);
    run(plain, plainFight.save, { x: 6, y: 0, z: 0 }, 8);
    expect(agile.frames()[0]?.position.x).toBeGreaterThan(plain.frames()[0]!.position.x);
    expect(agile.frames()[0]?.attackPattern).toBe("agile");

    const runUntilCooldown = (simulation: EnemySimulation, save: SaveView) => {
      for (let frame = 0; frame < 50; frame++) {
        simulation.step({ player: { x: 1, y: 0.31, z: 0 }, deltaSeconds: 0.05, active: true }, save);
        if (simulation.frames()[0]?.phase === "cooldown") return;
      }
      throw new Error("Foe never reached cooldown");
    };
    runUntilCooldown(agile, agileFight.save);
    runUntilCooldown(plain, plainFight.save);
    run(agile, agileFight.save, flatPlayer, 30);
    run(plain, plainFight.save, flatPlayer, 30);
    expect(agile.frames()[0]?.phase).toBe("cooldown");
    expect(plain.frames()[0]?.phase).not.toBe("cooldown");
  });

  it("keeps no more than two ordinary warnings or live bolts at once", () => {
    const { level, save } = patternedFight([
      "lab-robot-sentry", "demon-idol-drummer", "lab-robot-sentry",
    ]);
    const simulation = new EnemySimulation(level, save);
    run(simulation, save, flatPlayer, 24);
    expect(simulation.frames().filter((entry) =>
      entry.phase === "windup" || entry.phase === "strike" || entry.projectile
    )).toHaveLength(2);
    expect(simulation.frames().filter((entry) => entry.projectile)).toHaveLength(2);
  });

  it("does not launch a charge or bolt across a gap or toward a protected friend", () => {
    for (const assetId of ["gadget-hammer-hopper", "lab-robot-sentry"]) {
      const across = patternedFight([assetId]);
      across.level.course!.platforms = [
        { id: "enemy", center: { x: 0, y: -0.3, z: 0 }, size: { x: 4, y: 0.6, z: 8 } },
        { id: "player", center: { x: 5, y: -0.3, z: 0 }, size: { x: 4, y: 0.6, z: 8 } },
      ];
      const blocked = new EnemySimulation(across.level, across.save);
      expect(run(blocked, across.save, { x: 4, y: 0, z: 0 }, 60)).toEqual([]);
      expect(blocked.frames()[0]).toMatchObject({ phase: "idle", position: { x: 0, y: 0, z: 0 } });

      const protectedFight = patternedFight([assetId]);
      protectedFight.level.friendlies = [{
        id: "safe-friend", assetId: "blockling", assetVersion: "v001",
        hp: 1, maxHp: 1, defeated: false, boonClaimed: false,
        penaltyActive: false, position: { x: 4, y: 0, z: 0 },
      }];
      const protectedEnemy = new EnemySimulation(protectedFight.level, protectedFight.save);
      expect(run(protectedEnemy, protectedFight.save, flatPlayer, 60)).toEqual([]);
      expect(protectedEnemy.frames()[0]?.phase).toBe("idle");
    }
  });

  it("caps charge travel and cancels a live bolt when its route becomes invalid", () => {
    const chargeFight = patternedFight(["gadget-hammer-hopper"]);
    const charge = new EnemySimulation(chargeFight.level, chargeFight.save);
    run(charge, chargeFight.save, { x: 4, y: 2, z: 0 }, 50);
    // The foe may close a short distance before it freezes the four-metre lane.
    expect(charge.frames()[0]?.position.x).toBeLessThanOrEqual(4.25);

    const boltFight = patternedFight(["lab-robot-sentry"]);
    const bolt = new EnemySimulation(boltFight.level, boltFight.save);
    run(bolt, boltFight.save, flatPlayer, 24);
    expect(bolt.frames()[0]?.projectile).toBeDefined();
    boltFight.level.course!.platforms = [
      { id: "enemy", center: { x: 0, y: -0.3, z: 0 }, size: { x: 4, y: 0.6, z: 8 } },
      { id: "player", center: { x: 5, y: -0.3, z: 0 }, size: { x: 4, y: 0.6, z: 8 } },
    ];
    bolt.sync(boltFight.level, boltFight.save);
    expect(bolt.step({ player: flatPlayer, deltaSeconds: 0.05, active: true }, boltFight.save)).toEqual([]);
    expect(bolt.frames()[0]?.projectile).toBeUndefined();
  });

  it("cancels special hazards on pause, recovery, defeat and level reset", () => {
    const { level, save } = patternedFight(["radio-host-showman"]);
    const simulation = new EnemySimulation(level, save);
    run(simulation, save, flatPlayer, 24);
    expect(simulation.frames()[0]?.projectile).toBeDefined();
    simulation.step({ player: flatPlayer, deltaSeconds: 0.05, active: false }, save);
    expect(simulation.frames()[0]?.projectile).toBeUndefined();
    run(simulation, save, flatPlayer, 24);
    expect(simulation.frames()[0]?.projectile).toBeDefined();
    simulation.step({ player: flatPlayer, deltaSeconds: 0.05, active: false, recovering: true }, save);
    expect(simulation.frames()[0]).toMatchObject({ phase: "idle", position: { x: 0, y: 0, z: 0 } });
    expect(simulation.frames()[0]?.projectile).toBeUndefined();
    run(simulation, save, flatPlayer, 24);
    save.adventure!.activeLevel!.encounters[0]!.defeated = true;
    simulation.sync(level, save);
    expect(simulation.frames()[0]).toMatchObject({ phase: "defeated" });
    expect(simulation.frames()[0]?.projectile).toBeUndefined();
    simulation.reset(level, save);
    expect(simulation.frames()[0]?.projectile).toBeUndefined();
  });
});
