import type {
  Ability,
  AdventurePhase,
  AppearanceStage,
  EquipmentKind,
  MemoryState,
  SaveView,
} from "../../src/shared/contracts";

export function makeSave(
  ages: number[],
  options: {
    recoveredCount?: number;
    abilities?: Ability[];
    stage?: AppearanceStage;
    completed?: boolean;
    id?: string;
  } = {},
): SaveView {
  const memories = ages.map((ageYears, index) => ({
    id: `memory-${index + 1}`,
    date: `${2020 + ageYears}-01-01`,
    ageYears,
    label: `Synthetic ${index + 1}`,
    mediaUrl: `/fixture/${index + 1}.svg`,
    state: (index < (options.recoveredCount ?? 0)
      ? "revealed"
      : "released") as MemoryState,
  }));
  const recoveredCount = options.recoveredCount ?? 0;
  return {
    id: options.id ?? "save-fixture",
    title: "Synthetic route",
    subject: { id: "demo-adventurer", label: "Demo Adventurer" },
    memories,
    recoveredIds: memories.slice(0, recoveredCount).map((memory) => memory.id),
    ageYears:
      recoveredCount > 0 ? (memories[recoveredCount - 1]?.ageYears ?? 0) : 0,
    abilities: options.abilities ?? ["move", "interact"],
    appearance: {
      contractVersion: "synthetic-traveler-v1",
      subjectAppearanceId: "demo-adventurer",
      stage: options.stage ?? "infant",
    },
    completed: options.completed ?? false,
    format: "legacy-v1",
    adventure: null,
    revision: recoveredCount,
    createdAt: "2026-09-11T00:00:00.000Z",
    updatedAt: "2026-09-11T00:00:00.000Z",
    versions: {
      journey: "journey-v1",
      age: "age-v1",
      progression: "progression-v1",
      appearance: "synthetic-traveler-v1",
    },
  };
}

export interface EraSaveOptions {
  id?: string;
  revision?: number;
  levelIndex?: number;
  phase?: AdventurePhase;
  defeatedIds?: string[];
  collectedKinds?: EquipmentKind[];
  revealedCount?: number;
  playerHp?: number;
  attackCooldownRemainingMs?: number;
  guardActiveRemainingMs?: number;
  guardCooldownRemainingMs?: number;
  completed?: boolean;
}

export function makeEraSave(options: EraSaveOptions = {}): SaveView {
  const levelIndex = options.levelIndex ?? 0;
  const phase = options.phase ?? "exploring";
  const complete = options.completed ?? phase === "complete";
  const levelNumber = levelIndex + 1;
  const levelId = `level-${levelNumber}-${levelIndex === 0 ? 2020 : 2024}`;
  const memoryStart = levelIndex === 0 ? 1 : 3;
  const activeMemoryIds =
    levelIndex === 0 ? ["memory-1", "memory-2"] : ["memory-3"];
  const defeated = new Set(options.defeatedIds ?? []);
  const collected = new Set(options.collectedKinds ?? []);
  const memories = [0, 4, 7].map((ageYears, index) => {
    const inActiveLevel = activeMemoryIds.includes(`memory-${index + 1}`);
    let state: MemoryState = "locked";
    if (index < memoryStart - 1) state = "consumed";
    else if (inActiveLevel && phase === "memory-released") {
      const activeIndex = activeMemoryIds.indexOf(`memory-${index + 1}`);
      state =
        activeIndex < (options.revealedCount ?? 0) ? "revealed" : "released";
    }
    return {
      id: `memory-${index + 1}`,
      date: `${2020 + ageYears}-01-01`,
      ageYears,
      label: `Synthetic ${index + 1}`,
      state,
      ...(state === "locked" ? {} : { mediaUrl: `/fixture/${index + 1}.svg` }),
    };
  });
  const pickups = (["attack-tool", "guard-tool"] as const).map((kind) => ({
    id: `${levelId}-${kind}`,
    pickupId: `${levelId}-pickup-${kind}`,
    kind,
    tier: levelNumber,
    damage: kind === "attack-tool" ? 2 + levelIndex : 0,
    guardReduction: kind === "guard-tool" ? 2 : 0,
    collected: collected.has(kind),
  }));
  const encounters = (["ordinary-a", "ordinary-b", "boss"] as const).map(
    (kind, index) => ({
      id: `${levelId}-${kind}`,
      role: kind === "boss" ? ("boss" as const) : ("ordinary" as const),
      kind,
      maxHp: kind === "boss" ? 8 : 4,
      hp: defeated.has(`${levelId}-${kind}`) ? 0 : kind === "boss" ? 8 : 4,
      attackDamage: kind === "boss" ? 3 : 2,
      defeated: defeated.has(`${levelId}-${kind}`),
      available:
        kind !== "boss" ||
        (defeated.has(`${levelId}-ordinary-a`) &&
          defeated.has(`${levelId}-ordinary-b`)),
      order: index,
    }),
  );
  const inventory = pickups.filter((pickup) => pickup.collected);
  return {
    id: options.id ?? "save-era-fixture",
    title: "Synthetic era route",
    subject: { id: "demo-adventurer", label: "Demo Adventurer" },
    memories,
    recoveredIds: memories
      .filter(
        (memory) => memory.state === "revealed" || memory.state === "consumed",
      )
      .map((memory) => memory.id),
    ageYears: levelIndex === 0 ? 0 : 4,
    abilities:
      levelIndex === 0 ? ["move", "interact"] : ["move", "interact", "jump"],
    appearance: {
      contractVersion: "synthetic-traveler-v1",
      subjectAppearanceId: "demo-adventurer",
      stage: levelIndex === 0 ? "infant" : "child",
    },
    completed: complete,
    format: "era-combat-v2",
    adventure: {
      phase,
      activeLevelIndex: levelIndex,
      currentLevelId: complete ? null : levelId,
      activeLevel: complete
        ? null
        : {
            id: levelId,
            index: levelIndex,
            totalLevels: 2,
            startAgeYears: levelIndex === 0 ? 0 : 4,
            targetAgeYears: levelIndex === 0 ? 4 : 7,
            startDate: levelIndex === 0 ? "2020-01-01" : "2024-01-01",
            eraYear: levelIndex === 0 ? 2020 : 2024,
            memoryIds: activeMemoryIds,
            pickups,
            encounters,
            bossId: `${levelId}-boss`,
          },
      completedLevelIds: levelIndex === 0 ? [] : ["level-1-2020"],
      consumedMemoryIds: memories
        .filter((memory) => memory.state === "consumed")
        .map((memory) => memory.id),
      inventory,
      equippedId:
        inventory.find((item) => item.kind === "attack-tool")?.id ?? null,
      playerHp: options.playerHp ?? 10,
      maxPlayerHp: 10,
      attackCooldownRemainingMs: options.attackCooldownRemainingMs ?? 0,
      guardActiveRemainingMs: options.guardActiveRemainingMs ?? 0,
      guardCooldownRemainingMs: options.guardCooldownRemainingMs ?? 0,
    },
    revision: options.revision ?? 0,
    createdAt: "2026-09-11T00:00:00.000Z",
    updatedAt: "2026-09-11T00:00:00.000Z",
    versions: {
      journey: "journey-v2",
      age: "age-v1",
      progression: "era-progression-v2",
      appearance: "synthetic-traveler-v1",
      catalog: "fixture-era-v1",
      combat: "combat-v1",
    },
  };
}
