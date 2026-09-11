import { describe, expect, it } from 'vitest';
import {
  createControllerState,
  getAvatarProportions,
  stepController,
} from '../../src/game/controller';
import { checkpointForSave, createLevelLayout } from '../../src/game/level';
import type { GameInputSnapshot } from '../../src/game/types';
import { makeSave } from './fixtures';

const forwardInput: GameInputSnapshot = {
  moveX: 0,
  moveY: 1,
  lookX: 0,
  lookY: 0,
  jump: false,
  interact: false,
};

describe('garden controller and route', () => {
  it('keeps both pre-unlock memories reachable on flat ground and requires the unlocked jump for the step', () => {
    const save = makeSave([0, 4, 7]);
    const level = createLevelLayout(save);
    const controller = createControllerState({ x: 0, y: 0, z: 0 });
    const closest = [Infinity, Infinity, Infinity];

    for (let frame = 0; frame < 360; frame += 1) {
      stepController(controller, forwardInput, level, 1 / 60, 0, false, false);
      level.memories.forEach((memory, index) => {
        closest[index] = Math.min(closest[index] ?? Infinity, Math.hypot(
          controller.position.x - memory.position.x,
          controller.position.z - memory.position.z,
        ));
      });
    }

    expect(level.step).toMatchObject({ unlockMemoryId: 'memory-2', height: 0.32 });
    expect(closest[0]).toBeLessThan(0.75);
    expect(closest[1]).toBeLessThan(0.75);
    expect(controller.position.z).toBeGreaterThan(level.step?.z ?? -Infinity);
    expect(closest[2]).toBeGreaterThan(1.5);

    for (let frame = 0; frame < 180; frame += 1) {
      stepController(controller, forwardInput, level, 1 / 60, 0, true, frame === 0);
      closest[2] = Math.min(closest[2] ?? Infinity, Math.hypot(
        controller.position.x - (level.memories[2]?.position.x ?? 0),
        controller.position.z - (level.memories[2]?.position.z ?? 0),
      ));
    }

    expect(closest[2]).toBeLessThan(0.9);
    expect(controller.position.z).toBeLessThan(level.step?.z ?? Infinity);
    expect(controller.position.y).toBeCloseTo(0.32, 5);
  });

  it('places all 24 memories in manifest order and keeps a no-unlock journey flat', () => {
    const save = makeSave(Array.from({ length: 24 }, () => 0));
    const level = createLevelLayout(save);
    expect(level.memories).toHaveLength(24);
    expect(level.memories.map((memory) => memory.id)).toEqual(save.memories.map((memory) => memory.id));
    for (let index = 1; index < level.memories.length; index += 1) {
      expect(level.memories[index]?.position.z).toBeLessThan(level.memories[index - 1]?.position.z ?? -Infinity);
      expect(level.memories[index]?.position.y).toBe(0);
    }
    expect(level.step).toBeNull();
    expect(level.finish.y).toBe(0);
  });

  it('resumes behind the last contiguous recovered memory at a safe surface height', () => {
    const save = makeSave([0, 4, 7], { recoveredCount: 3, abilities: ['move', 'interact', 'jump'], stage: 'child' });
    const level = createLevelLayout(save);
    const checkpoint = checkpointForSave(save, level);
    expect(checkpoint.z).toBeGreaterThan(level.memories[2]?.position.z ?? 0);
    expect(checkpoint.y).toBe(level.step?.height);

    const forgedGap = { ...save, recoveredIds: ['memory-1', 'memory-3'] };
    const guardedCheckpoint = checkpointForSave(forgedGap, level);
    expect(guardedCheckpoint.z).toBeGreaterThan(level.memories[0]?.position.z ?? 0);
    expect(guardedCheckpoint.z).toBeGreaterThan(level.step?.z ?? 0);
  });

  it('changes visible age proportions while retaining the same foot-anchored controller scale', () => {
    const infant = getAvatarProportions('infant');
    const child = getAvatarProportions('child');
    expect(child.height).toBeGreaterThan(infant.height);
    expect(infant.headRadius / infant.height).toBeGreaterThan(child.headRadius / child.height);
    expect(infant.legLength).toBeLessThan(child.legLength);
    expect(infant.posture).toBeGreaterThan(child.posture);
    expect(infant.colliderRadius).toBeCloseTo(child.colliderRadius, 1);
  });

  it('moves relative to camera yaw and caps a stalled-frame delta', () => {
    const level = createLevelLayout(makeSave([0, 0, 0]));
    const controller = createControllerState({ x: 0, y: 0, z: 0 });
    stepController(controller, forwardInput, level, 1, Math.PI / 2, false, false);
    expect(controller.position.x).toBeLessThan(-0.14);
    expect(controller.position.x).toBeGreaterThan(-0.17);
    expect(controller.position.z).toBeCloseTo(0, 5);
  });
});
