import type { SaveView } from '../shared/contracts';
import type { LevelInspection, PositionSnapshot } from './types';

export interface MemoryPlacement {
  id: string;
  index: number;
  position: PositionSnapshot;
}

export interface StepPlacement {
  z: number;
  height: number;
  unlockMemoryId: string;
}

export interface LevelLayout {
  memories: MemoryPlacement[];
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

function memoryX(index: number): number {
  const offsets = [-0.7, 0.45, 0.8, -0.35, 0.15];
  return offsets[index % offsets.length] ?? 0;
}

export function createLevelLayout(save: Pick<SaveView, 'memories'>): LevelLayout {
  if (save.memories.length < 1 || save.memories.length > 24) {
    throw new RangeError('A garden route requires between 1 and 24 memories');
  }
  const unlockIndex = save.memories.findIndex((memory) => memory.ageYears >= 4);
  const hasPostUnlockMemory = unlockIndex >= 0 && unlockIndex < save.memories.length - 1;
  const stepZ = hasPostUnlockMemory
    ? -4 - (unlockIndex + 0.5) * memorySpacing
    : null;
  const step: StepPlacement | null = stepZ === null ? null : {
    z: stepZ,
    height: stepHeight,
    unlockMemoryId: save.memories[unlockIndex]?.id ?? '',
  };
  const memories = save.memories.map((memory, index) => {
    const z = -4 - index * memorySpacing;
    return {
      id: memory.id,
      index,
      position: { x: memoryX(index), y: step && z < step.z ? step.height : 0, z },
    };
  });
  const finishZ = -4 - save.memories.length * memorySpacing;
  return {
    memories,
    finish: { x: 0, y: step && finishZ < step.z ? step.height : 0, z: finishZ },
    step,
    minX: -pathWidth / 2,
    maxX: pathWidth / 2,
    minZ: finishZ - 2,
    maxZ: 2,
  };
}

export function groundHeightAt(level: LevelLayout, z: number): number {
  return level.step && z < level.step.z ? level.step.height : 0;
}

export function contiguousRecoveredCount(
  save: Pick<SaveView, 'memories' | 'recoveredIds'>,
): number {
  const recovered = new Set(save.recoveredIds);
  let count = 0;
  while (count < save.memories.length && recovered.has(save.memories[count]?.id ?? '')) count += 1;
  return count;
}

export function checkpointForSave(
  save: Pick<SaveView, 'memories' | 'recoveredIds'>,
  level: LevelLayout,
): PositionSnapshot {
  const recoveredCount = contiguousRecoveredCount(save);
  if (recoveredCount === 0) return { x: 0, y: 0, z: 0 };
  const placement = level.memories[recoveredCount - 1];
  if (!placement) return { x: 0, y: 0, z: 0 };
  const z = placement.position.z + 1.15;
  return { x: placement.position.x, y: groundHeightAt(level, z), z };
}

export function inspectLevel(level: LevelLayout): LevelInspection {
  return {
    memoryIds: level.memories.map((memory) => memory.id),
    memoryPositions: level.memories.map((memory) => ({ id: memory.id, ...memory.position })),
    finishPosition: { ...level.finish },
    step: level.step ? { ...level.step } : null,
  };
}
