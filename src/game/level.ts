import type {
  EncounterKind,
  EncounterRole,
  EquipmentKind,
  MemoryState,
  SaveView,
} from "../shared/contracts";
import type { LevelInspection, PositionSnapshot } from "./types";

export interface MemoryPlacement {
  id: string;
  index: number;
  position: PositionSnapshot;
  state: MemoryState;
}

export interface PickupPlacement {
  id: string;
  equipmentId: string;
  kind: EquipmentKind;
  position: PositionSnapshot;
  collected: boolean;
}

export interface EncounterPlacement {
  id: string;
  role: EncounterRole;
  kind: EncounterKind;
  position: PositionSnapshot;
}

export interface StepPlacement {
  z: number;
  height: number;
  unlockMemoryId: string;
}

export interface LevelLayout {
  id: string | null;
  memories: MemoryPlacement[];
  pickups: PickupPlacement[];
  encounters: EncounterPlacement[];
  checkpoint: PositionSnapshot;
  finish: PositionSnapshot;
  step: StepPlacement | null;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const pathWidth = 5.2;
const memorySpacing = 4;
const stepHeight = 0.32;

const eraCheckpoint: PositionSnapshot = { x: 0, y: 0, z: 1 };
const eraFinish: PositionSnapshot = { x: 0, y: 0, z: -25 };
const eraPickupPositions: Record<EquipmentKind, PositionSnapshot> = {
  "attack-tool": { x: -2, y: 0, z: -2 },
  "guard-tool": { x: 3, y: 0, z: -6 },
};
const eraEncounterPositions: Record<EncounterKind, PositionSnapshot> = {
  "ordinary-a": { x: -2, y: 0, z: -8 },
  "ordinary-b": { x: 2, y: 0, z: -13 },
  boss: { x: 0, y: 0, z: -21 },
};

function memoryX(index: number): number {
  const offsets = [-0.7, 0.45, 0.8, -0.35, 0.15];
  return offsets[index % offsets.length] ?? 0;
}

function createLegacyLevelLayout(
  save: Pick<SaveView, "memories" | "recoveredIds">,
): LevelLayout {
  if (save.memories.length < 1 || save.memories.length > 24) {
    throw new RangeError("A garden route requires between 1 and 24 memories");
  }
  const unlockIndex = save.memories.findIndex((memory) => memory.ageYears >= 4);
  const hasPostUnlockMemory =
    unlockIndex >= 0 && unlockIndex < save.memories.length - 1;
  const stepZ = hasPostUnlockMemory
    ? -4 - (unlockIndex + 0.5) * memorySpacing
    : null;
  const step: StepPlacement | null =
    stepZ === null
      ? null
      : {
          z: stepZ,
          height: stepHeight,
          unlockMemoryId: save.memories[unlockIndex]?.id ?? "",
        };
  const memories: MemoryPlacement[] = save.memories.map((memory, index) => {
    const z = -4 - index * memorySpacing;
    return {
      id: memory.id,
      index,
      position: {
        x: memoryX(index),
        y: step && z < step.z ? step.height : 0,
        z,
      },
      state: save.recoveredIds.includes(memory.id) ? "revealed" : "released",
    };
  });
  const finishZ = -4 - save.memories.length * memorySpacing;
  return {
    id: null,
    memories,
    pickups: [],
    encounters: [],
    checkpoint: { x: 0, y: 0, z: 0 },
    finish: { x: 0, y: step && finishZ < step.z ? step.height : 0, z: finishZ },
    step,
    minX: -pathWidth / 2,
    maxX: pathWidth / 2,
    minZ: finishZ - 2,
    maxZ: 2,
  };
}

function memoryBundleX(index: number, count: number): number {
  if (count <= 1) return 0;
  return -1.1 + (index * 2.2) / (count - 1);
}

function createEraLevelLayout(save: SaveView): LevelLayout {
  const activeLevel = save.adventure?.activeLevel ?? null;
  if (!activeLevel) {
    return {
      id: null,
      memories: [],
      pickups: [],
      encounters: [],
      checkpoint: { ...eraCheckpoint },
      finish: { ...eraFinish },
      step: null,
      minX: -6,
      maxX: 6,
      minZ: -27,
      maxZ: 3,
    };
  }
  const memoriesById = new Map(
    save.memories.map((memory) => [memory.id, memory]),
  );
  const memories = activeLevel.memoryIds.map((id, index) => ({
    id,
    index,
    position: {
      x: memoryBundleX(index, activeLevel.memoryIds.length),
      y: 0,
      z: -22,
    },
    state: memoriesById.get(id)?.state ?? "locked",
  }));
  return {
    id: activeLevel.id,
    memories,
    pickups: activeLevel.pickups.map((pickup) => ({
      id: pickup.pickupId,
      equipmentId: pickup.id,
      kind: pickup.kind,
      position: { ...eraPickupPositions[pickup.kind] },
      collected: pickup.collected,
    })),
    encounters: activeLevel.encounters.map((encounter) => ({
      id: encounter.id,
      role: encounter.role,
      kind: encounter.kind,
      position: { ...eraEncounterPositions[encounter.kind] },
    })),
    checkpoint: { ...eraCheckpoint },
    finish: { ...eraFinish },
    step: null,
    minX: -6,
    maxX: 6,
    minZ: -27,
    maxZ: 3,
  };
}

export function createLevelLayout(save: SaveView): LevelLayout {
  return save.format === "era-combat-v2"
    ? createEraLevelLayout(save)
    : createLegacyLevelLayout(save);
}

export function groundHeightAt(level: LevelLayout, z: number): number {
  return level.step && z < level.step.z ? level.step.height : 0;
}

export function contiguousRecoveredCount(
  save: Pick<SaveView, "memories" | "recoveredIds">,
): number {
  const recovered = new Set(save.recoveredIds);
  let count = 0;
  while (
    count < save.memories.length &&
    recovered.has(save.memories[count]?.id ?? "")
  )
    count += 1;
  return count;
}

export function checkpointForSave(
  save: SaveView,
  level: LevelLayout,
): PositionSnapshot {
  if (save.format === "era-combat-v2") {
    return save.adventure?.phase === "memory-released"
      ? { x: 0, y: 0, z: -23.5 }
      : { ...level.checkpoint };
  }
  const recoveredCount = contiguousRecoveredCount(save);
  if (recoveredCount === 0) return { x: 0, y: 0, z: 0 };
  const placement = level.memories[recoveredCount - 1];
  if (!placement) return { x: 0, y: 0, z: 0 };
  const z = placement.position.z + 1.15;
  return { x: placement.position.x, y: groundHeightAt(level, z), z };
}

export function inspectLevel(level: LevelLayout): LevelInspection {
  return {
    id: level.id,
    memoryIds: level.memories.map((memory) => memory.id),
    memoryPositions: level.memories.map((memory) => ({
      id: memory.id,
      state: memory.state,
      ...memory.position,
    })),
    pickupPositions: level.pickups.map((pickup) => ({
      id: pickup.id,
      equipmentId: pickup.equipmentId,
      kind: pickup.kind,
      collected: pickup.collected,
      ...pickup.position,
    })),
    encounterPositions: level.encounters.map((encounter) => ({
      id: encounter.id,
      role: encounter.role,
      kind: encounter.kind,
      hp: 0,
      maxHp: 0,
      localPhase: "idle",
      ...encounter.position,
    })),
    finishPosition: { ...level.finish },
    step: level.step ? { ...level.step } : null,
  };
}
