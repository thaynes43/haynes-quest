import type {
  AdventurePhase,
  EncounterKind,
  EncounterView,
  FrozenEncounterContent,
  MemoryState,
  SaveView,
} from "../../src/shared/contracts";
import type { ObbyRouteId } from "../../src/shared/parody-catalog";
import { makeEraSave } from "./fixtures";

export type AuthoredRouteId = Extract<
  ObbyRouteId,
  | "garden-playground-v1"
  | "besties-playground-v1"
  | "garden-playground-v2"
  | "besties-playground-v2"
>;

interface AuthoredSaveOptions {
  routeId?: AuthoredRouteId;
  revision?: number;
  phase?: AdventurePhase;
  defeatedOrdinaryCount?: number;
  bossDefeated?: boolean;
  saveId?: string;
  levelId?: string;
}

const memoryAges = [0, 2, 4, 5, 6, 7] as const;

function contentFor(
  routeId: AuthoredRouteId,
  kind: EncounterKind,
): FrozenEncounterContent {
  const entry = routeId.startsWith("garden-playground-")
    ? kind === "ordinary-a"
      ? "mister-hiss"
      : kind === "ordinary-b"
        ? "peel-patrol"
        : "drama-dragon"
    : kind === "ordinary-a"
      ? "sir-flush-a-lot-besties"
      : kind === "ordinary-b"
        ? "peel-patrol-besties"
        : "bickering-besties";
  const assetId =
    entry === "sir-flush-a-lot-besties"
      ? "sir-flush-a-lot"
      : entry === "peel-patrol-besties"
        ? "peel-patrol"
        : entry;
  return {
    catalogEntryId: entry,
    catalogEntryVersion: "v001",
    assetId,
    assetVersion: "v001",
  };
}

export function makeAuthoredSave(options: AuthoredSaveOptions = {}): SaveView {
  const routeId = options.routeId ?? "garden-playground-v1";
  const besties = routeId.startsWith("besties-playground-");
  const catalogVersion = routeId.endsWith("-v2")
    ? "parody-catalog-v5"
    : "parody-catalog-v4";
  const levelIndex = besties ? 1 : 0;
  const phase = options.phase ?? "exploring";
  const levelId = options.levelId ?? "level-authored-fixture";
  const activeMemoryIndexes = besties ? [3, 4, 5] : [0, 1, 2];
  const activeMemoryIds = activeMemoryIndexes.map(
    (index) => `authored-memory-${index + 1}`,
  ) as [string, string, string];
  const memories = memoryAges.map((ageYears, index) => {
    let state: MemoryState = "locked";
    if (index < activeMemoryIndexes[0]!) state = "consumed";
    else if (index === activeMemoryIndexes[0]) state = "revealed";
    else if (index === activeMemoryIndexes[1]) state = "released";
    else if (index === activeMemoryIndexes[2] && phase === "memory-released")
      state = "released";
    return {
      id: `authored-memory-${index + 1}`,
      date: `${2020 + ageYears}-01-01`,
      ageYears,
      label: `Authored memory ${index + 1}`,
      role: index % 3 === 2 ? ("major" as const) : ("minor" as const),
      state,
      ...(state === "locked"
        ? {}
        : { mediaUrl: `/fixture/authored-memory-${index + 1}.svg` }),
    };
  });
  const pickups = (["attack-tool", "guard-tool"] as const).map((kind) => ({
    id: `${levelId}-${kind}`,
    pickupId: `${levelId}-pickup-${kind}`,
    kind,
    tier: levelIndex + 1,
    damage: kind === "attack-tool" ? 2 + levelIndex : 0,
    guardReduction: kind === "guard-tool" ? 2 : 0,
    collected: false,
  }));
  const ordinaryKinds = [
    "ordinary-a",
    "ordinary-b",
    "ordinary-a",
    "ordinary-b",
  ] as const;
  const defeatedOrdinaryCount = options.defeatedOrdinaryCount ?? 0;
  const encounters: EncounterView[] = ordinaryKinds.map((kind, index) => {
    const defeated = index < defeatedOrdinaryCount;
    return {
      id: `${levelId}-encounter-${index + 1}`,
      role: "ordinary" as const,
      kind,
      content: contentFor(routeId, kind),
      maxHp: 4,
      hp: defeated ? 0 : 4,
      attackDamage: 2,
      defeated,
      available: !defeated,
    };
  });
  const ordinaryDefeated = encounters.every((encounter) => encounter.defeated);
  const bossDefeated = options.bossDefeated ?? false;
  encounters.push({
    id: `${levelId}-boss`,
    role: "boss",
    kind: "boss",
    content: contentFor(routeId, "boss"),
    maxHp: 8,
    hp: bossDefeated ? 0 : 8,
    attackDamage: besties ? 2 : 3,
    defeated: bossDefeated,
    available: !bossDefeated && (routeId.endsWith("-v2") || ordinaryDefeated),
  });

  const base = makeEraSave({
    id: options.saveId ?? "save-authored-fixture",
    levelIndex,
    phase,
    revision: options.revision ?? 0,
  });
  if (!base.adventure)
    throw new Error("Authored fixture requires an adventure");
  return {
    ...base,
    memories,
    recoveredIds: memories
      .filter(
        (memory) => memory.state === "revealed" || memory.state === "consumed",
      )
      .map((memory) => memory.id),
    ageYears: besties ? 4 : 0,
    abilities: ["move", "interact", "jump"],
    appearance: { ...base.appearance, stage: besties ? "child" : "infant" },
    adventure: {
      ...base.adventure,
      planVersion: "era-level-plan-v3",
      catalogVersion,
      activeLevelIndex: levelIndex,
      currentLevelId: levelId,
      activeLevel: {
        id: levelId,
        index: levelIndex,
        totalLevels: 2,
        startAgeYears: besties ? 4 : 0,
        targetAgeYears: besties ? 7 : 4,
        startDate: besties ? "2024-01-01" : "2020-01-01",
        eraYear: besties ? 2024 : 2020,
        periodId: besties ? "besties-obby-v1" : "block-party-v1",
        routeId,
        memoryIds: activeMemoryIds,
        minorMemoryIds: [activeMemoryIds[0], activeMemoryIds[1]],
        majorMemoryId: activeMemoryIds[2],
        pickups,
        encounters,
        bossId: `${levelId}-boss`,
      },
      completedLevelIds: besties ? ["level-authored-one"] : [],
      consumedMemoryIds: memories
        .filter((memory) => memory.state === "consumed")
        .map((memory) => memory.id),
      inventory: [],
      equippedId: null,
      secondaryCooldownRemainingMs: 0,
    },
    versions: {
      ...base.versions,
      journey: "era-level-plan-v3",
      progression: "route-major-recovery-v3",
      catalog: catalogVersion,
    },
  };
}

export function makeArchivedRoutedSave(): SaveView {
  const save = makeEraSave();
  const adventure = save.adventure;
  const activeLevel = adventure?.activeLevel;
  if (!adventure || !activeLevel)
    throw new Error("Archived fixture requires an active level");
  return {
    ...save,
    adventure: {
      ...adventure,
      planVersion: "era-level-plan-v2",
      catalogVersion: "parody-catalog-v2",
      activeLevel: {
        ...activeLevel,
        periodId: "block-party-v1",
        routeId: "gentle-intro-v1",
        encounters: activeLevel.encounters.map((encounter) => ({
          ...encounter,
          content: contentFor("garden-playground-v1", encounter.kind),
        })),
      },
    },
    versions: { ...save.versions, catalog: "parody-catalog-v2" },
  };
}
