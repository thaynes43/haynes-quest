import type { AuthoredLevelDocument } from "../shared/authored-level";
import {
  authoredLevelLayout,
  authoredRoute,
  type AuthoredLevelResolver,
} from "./authored-layout";
import type {
  EncounterKind,
  EncounterRole,
  EquipmentKind,
  FriendlyView,
  MemoryState,
  SaveView,
} from "../shared/contracts";
import type { LevelInspection, PositionSnapshot } from "./types";
import type { ObbyCourse } from "./obby";
import { createObbyCourse } from "./obby-layout";

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
  arena?: { minX: number; maxX: number; minZ: number; maxZ: number };
  retryCheckpointId?: string;
}

export interface StepPlacement {
  z: number;
  height: number;
  unlockMemoryId: string;
}

export interface LevelLayout {
  id: string | null;
  routeId?: string;
  course?: ObbyCourse;
  authored?: AuthoredLevelDocument;
  memories: MemoryPlacement[];
  pickups: PickupPlacement[];
  encounters: EncounterPlacement[];
  friendlies?: Array<FriendlyView & { position: PositionSnapshot }>;
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

function createEraLevelLayout(
  save: SaveView,
  resolver: AuthoredLevelResolver,
): LevelLayout {
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
  const authored = authoredLevelLayout(save, activeLevel, resolver);
  if (authored) return authored;
  const memoriesById = new Map(
    save.memories.map((memory) => [memory.id, memory]),
  );
  const memories = activeLevel.memoryIds.map((id, index) => ({
    id,
    index,
    position: {
      x: activeLevel.majorMemoryId
        ? 0
        : memoryBundleX(index, activeLevel.memoryIds.length),
      y: 0,
      z: activeLevel.majorMemoryId
        ? id === activeLevel.majorMemoryId
          ? -24
          : index === 0
            ? -6.3
            : -12.0
        : -22,
    },
    state: memoriesById.get(id)?.state ?? "locked",
  }));
  return {
    id: activeLevel.id,
    ...(activeLevel.routeId
      ? {
          routeId: activeLevel.routeId,
          course: createObbyCourse(activeLevel.routeId, resolver),
        }
      : {}),
    memories,
    friendlies: (activeLevel.friendlies ?? []).map((friendly, index) => ({
      ...friendly,
      position: [
        { x: 3.7, y: 0, z: 0.2 },
        { x: -4.1, y: 0, z: -7.4 },
        { x: 4.1, y: 0, z: -20.2 },
      ][index % 3]!,
    })),
    pickups: activeLevel.pickups.map((pickup) => ({
      id: pickup.pickupId,
      equipmentId: pickup.id,
      kind: pickup.kind,
      position: activeLevel.majorMemoryId
        ? {
            x: pickup.kind === "attack-tool" ? -0.7 : 1.0,
            y: 0,
            z: pickup.kind === "attack-tool" ? -0.5 : -5.8,
          }
        : { ...eraPickupPositions[pickup.kind] },
      collected: pickup.collected,
    })),
    encounters: activeLevel.encounters.map((encounter) => ({
      id: encounter.id,
      role: encounter.role,
      kind: encounter.kind,
      position: activeLevel.routeId
        ? {
            ...eraEncounterPositions[encounter.kind],
            z:
              encounter.kind === "boss"
                ? -22
                : encounter.kind === "ordinary-b"
                  ? -14
                  : -8,
          }
        : { ...eraEncounterPositions[encounter.kind] },
      ...(activeLevel.routeId
        ? {
            arena:
              encounter.kind === "boss"
                ? { minX: -3.8, maxX: 3.8, minZ: -24, maxZ: -21 }
                : encounter.kind === "ordinary-b"
                  ? { minX: -4.5, maxX: 4.5, minZ: -15, maxZ: -13.5 }
                  : { minX: -4.5, maxX: 4.5, minZ: -8.9, maxZ: -6.3 },
          }
        : {}),
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

/**
 * Build the one layout every consumer of this level reads. An editor preview
 * passes its frozen per-project resolver; omitting it uses the immutable
 * published route registry, which is what ordinary play does.
 */
export function createLevelLayout(
  save: SaveView,
  resolver: AuthoredLevelResolver = authoredRoute,
): LevelLayout {
  return save.format === "era-combat-v2"
    ? createEraLevelLayout(save, resolver)
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

export interface MemoryCheckpoint {
  id: string;
  position: PositionSnapshot;
}

/**
 * Resolve the durable death checkpoint established by the furthest recovered
 * minor memory in the active authored level. The frozen level orders the two
 * milestones; `recoveredIds` only proves which milestones were collected.
 */
export function memoryCheckpointForSave(
  save: SaveView,
  level: LevelLayout,
): MemoryCheckpoint | null {
  const activeLevel = save.adventure?.activeLevel;
  if (
    save.format !== "era-combat-v2" ||
    !activeLevel?.minorMemoryIds ||
    !level.authored ||
    !level.course
  ) {
    return null;
  }
  const recovered = new Set(save.recoveredIds);
  const recoveredIndex = activeLevel.minorMemoryIds.findLastIndex((memoryId) =>
    recovered.has(memoryId),
  );
  if (recoveredIndex < 0) return null;

  const slot = recoveredIndex === 0 ? "minor-one" : "minor-two";
  const platformId = level.authored.anchors.memories[slot].platformId;
  const matches = level.course.checkpoints.filter(
    (candidate) => candidate.triggerPlatformId === platformId,
  );
  if (matches.length !== 1) return null;
  const checkpoint = matches[0]!;
  return { id: checkpoint.id, position: { ...checkpoint.position } };
}

export function checkpointForSave(
  save: SaveView,
  level: LevelLayout,
): PositionSnapshot {
  if (save.format === "era-combat-v2") {
    if (level.authored && level.course) {
      if (save.adventure?.phase === "memory-released") {
        return { ...level.authored.anchors.rewardRespawn.position };
      }
      if (save.adventure?.activeLevel?.minorMemoryIds) {
        return {
          ...(memoryCheckpointForSave(save, level)?.position ??
            level.checkpoint),
        };
      }
      const completed = save.adventure?.activeLevel?.encounters.findLast(
        (enemy) => enemy.defeated,
      );
      const binding = level.encounters.find(
        (enemy) => enemy.id === completed?.id,
      );
      const safe = level.course.checkpoints.find(
        (entry) => entry.id === binding?.retryCheckpointId,
      );
      // Non-memory routes retain their prior encounter fallback on reload and
      // prefer a visited local checkpoint for same-session retries in createGame.
      const anyDefeated = save.adventure?.activeLevel?.encounters.some(
        (enemy) => enemy.defeated,
      );
      return { ...(anyDefeated && safe ? safe.position : level.checkpoint) };
    }
    if (save.adventure?.phase === "memory-released")
      return { x: 0, y: 0, z: -23.5 };
    if (level.course) {
      const ordinary =
        save.adventure?.activeLevel?.encounters.filter(
          (entry) => entry.role === "ordinary",
        ) ?? [];
      const id =
        ordinary.length === 2 && ordinary.every((entry) => entry.defeated)
          ? "boss-landing"
          : ordinary.find((entry) => entry.kind === "ordinary-a")?.defeated
            ? "second-clearing"
            : "start";
      const safe = level.course.checkpoints.find((entry) => entry.id === id);
      if (safe) return { ...safe.position };
    }
    return { ...level.checkpoint };
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
    ...(level.authored ? { authored: structuredClone(level.authored) } : {}),
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
    friendlyPositions: (level.friendlies ?? []).map((friend) => ({
      id: friend.id,
      assetId: friend.assetId,
      ...friend.position,
    })),
    finishPosition: { ...level.finish },
    step: level.step ? { ...level.step } : null,
  };
}
