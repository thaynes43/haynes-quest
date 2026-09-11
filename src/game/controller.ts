import type { AppearanceStage } from '../shared/contracts';
import { groundHeightAt, type LevelLayout } from './level';
import type { AvatarProportions, GameInputSnapshot, PositionSnapshot } from './types';

export interface ControllerState {
  position: PositionSnapshot;
  velocityY: number;
  grounded: boolean;
  facing: number;
}

const gravity = -15;
const jumpVelocity = 5;
const moveSpeed = 3.1;
const maxDeltaSeconds = 0.05;

const proportions: Record<AppearanceStage, AvatarProportions> = {
  infant: {
    height: 0.88,
    colliderRadius: 0.25,
    headRadius: 0.22,
    torsoHeight: 0.3,
    legLength: 0.14,
    posture: 0.09,
    cameraTargetHeight: 0.58,
  },
  child: {
    height: 1.22,
    colliderRadius: 0.24,
    headRadius: 0.2,
    torsoHeight: 0.42,
    legLength: 0.34,
    posture: 0,
    cameraTargetHeight: 0.82,
  },
};

export function getAvatarProportions(stage: AppearanceStage): AvatarProportions {
  return { ...proportions[stage] };
}

export function createControllerState(position: PositionSnapshot): ControllerState {
  return { position: { ...position }, velocityY: 0, grounded: true, facing: 0 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function stepController(
  state: ControllerState,
  input: GameInputSnapshot,
  level: LevelLayout,
  deltaSeconds: number,
  cameraYaw: number,
  canJump: boolean,
  jumpPressed: boolean,
): void {
  const dt = clamp(deltaSeconds, 0, maxDeltaSeconds);
  if (jumpPressed && canJump && state.grounded) {
    state.velocityY = jumpVelocity;
    state.grounded = false;
  }

  if (!state.grounded) {
    state.velocityY += gravity * dt;
    state.position.y += state.velocityY * dt;
  }

  const forwardX = -Math.sin(cameraYaw);
  const forwardZ = -Math.cos(cameraYaw);
  const rightX = Math.cos(cameraYaw);
  const rightZ = -Math.sin(cameraYaw);
  const directionX = rightX * input.moveX + forwardX * input.moveY;
  const directionZ = rightZ * input.moveX + forwardZ * input.moveY;
  const movementLength = Math.hypot(directionX, directionZ);
  if (movementLength > 0.001) {
    const distance = moveSpeed * dt / Math.max(1, movementLength);
    const candidateX = clamp(state.position.x + directionX * distance, level.minX, level.maxX);
    const candidateZ = clamp(state.position.z + directionZ * distance, level.minZ, level.maxZ);
    const candidateGround = groundHeightAt(level, candidateZ);
    // The raised section is a real collision edge. It can only be entered while
    // the avatar's feet clear it; this keeps the jump demonstration required.
    if (candidateGround <= state.position.y + 0.015) {
      state.position.x = candidateX;
      state.position.z = candidateZ;
    } else {
      state.position.x = candidateX;
    }
    state.facing = Math.atan2(-directionX, -directionZ);
  }

  const ground = groundHeightAt(level, state.position.z);
  if (state.position.y <= ground) {
    state.position.y = ground;
    state.velocityY = 0;
    state.grounded = true;
  } else {
    // Leaving a raised surface removes support even without a jump. Gravity
    // must resume so returning along the route cannot leave the avatar hovering.
    state.grounded = false;
  }
}
