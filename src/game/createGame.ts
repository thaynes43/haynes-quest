import type { SaveView } from "../shared/contracts";
import { createControllerState, stepController } from "./controller";
import { bindBrowserInput, GameInputState } from "./input";
import {
  checkpointForSave,
  contiguousRecoveredCount,
  createLevelLayout,
  inspectLevel,
  type LevelLayout,
} from "./level";
import { AuthoritativeProgression, type ProgressionState } from "./progression";
import { GardenScene } from "./scene";
import type { CreateGameOptions, GameHandle, GameStatus } from "./types";

const interactionRadius = 1.35;
const statusIntervalSeconds = 0.1;

function horizontalDistance(
  first: { x: number; z: number },
  second: { x: number; z: number },
): number {
  return Math.hypot(first.x - second.x, first.z - second.z);
}

function routeIdentity(save: SaveView): string {
  return `${save.id}:${save.memories.map((memory) => memory.id).join(",")}`;
}

export function createGame(options: CreateGameOptions): GameHandle {
  let save = options.save;
  let level: LevelLayout = createLevelLayout(save);
  let checkpoint = checkpointForSave(save, level);
  const controller = createControllerState(checkpoint);
  const input = new GameInputState();
  const scene = new GardenScene(options.container, level, save);
  const stopBrowserInput = bindBrowserInput({ target: scene.canvas, input });
  const windowTarget = options.container.ownerDocument.defaultView;
  if (!windowTarget) {
    scene.dispose();
    throw new Error("Game requires a window");
  }

  let disposed = false;
  let paused = false;
  let animationFrame = 0;
  let lastTime = windowTarget.performance.now();
  let elapsed = 0;
  let timeSinceStatus = statusIntervalSeconds;
  let previousJump = false;
  let previousInteract = false;
  let progressionState: ProgressionState = {
    requestState: "idle",
    requestError: null,
  };

  const getStatus = (): GameStatus => {
    const recoveredCount = contiguousRecoveredCount(save);
    const nextMemory = level.memories[recoveredCount] ?? null;
    const allRecovered = recoveredCount === level.memories.length;
    const nearMemoryId =
      nextMemory &&
      horizontalDistance(controller.position, nextMemory.position) <=
        interactionRadius
        ? nextMemory.id
        : null;
    const nearFinish =
      allRecovered &&
      horizontalDistance(controller.position, level.finish) <=
        interactionRadius;
    return {
      nearMemoryId,
      nearFinish,
      position: { ...controller.position },
      ageYears: save.ageYears,
      appearanceStage: save.appearance.stage,
      abilities: [...save.abilities],
      grounded: controller.grounded,
      recovering: progressionState.requestState === "recovering",
      requestState: progressionState.requestState,
      requestError: progressionState.requestError,
    };
  };

  const emitStatus = (force = false): void => {
    if (disposed || !options.onStatus) return;
    if (!force && timeSinceStatus < statusIntervalSeconds) return;
    timeSinceStatus = 0;
    options.onStatus(getStatus());
  };

  const applySave = (nextSave: SaveView): void => {
    if (disposed) return;
    const routeChanged = routeIdentity(nextSave) !== routeIdentity(save);
    save = nextSave;
    if (routeChanged) {
      level = createLevelLayout(save);
      checkpoint = checkpointForSave(save, level);
      controller.position = { ...checkpoint };
      controller.velocityY = 0;
      controller.grounded = true;
      scene.rebuildRoute(level, save);
    } else {
      checkpoint = checkpointForSave(save, level);
      scene.updateProgress(save);
    }
    emitStatus(true);
  };

  const progression = new AuthoritativeProgression({
    onRecover: options.onRecover,
    onFinish: options.onFinish,
    onApply: applySave,
    onState: (state) => {
      progressionState = state;
      emitStatus(true);
    },
  });

  const frame = (now: number): void => {
    if (disposed) return;
    const deltaSeconds = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    elapsed += deltaSeconds;
    timeSinceStatus += deltaSeconds;
    if (paused) input.clear();
    const currentInput = input.snapshot();
    const pointerLook = input.consumePointerLook();
    scene.adjustCamera(
      currentInput.lookX,
      currentInput.lookY,
      deltaSeconds,
      pointerLook.x,
      pointerLook.y,
    );
    const actions = input.consumeActions();
    const jumpPressed = actions.jump || (currentInput.jump && !previousJump);
    const interactPressed =
      actions.interact || (currentInput.interact && !previousInteract);
    stepController(
      controller,
      currentInput,
      level,
      deltaSeconds,
      scene.cameraYaw,
      save.abilities.includes("jump"),
      jumpPressed,
    );
    previousJump = currentInput.jump;
    previousInteract = currentInput.interact;

    if (
      interactPressed &&
      progressionState.requestState !== "recovering" &&
      progressionState.requestState !== "finishing"
    ) {
      const status = getStatus();
      if (status.nearMemoryId) progression.recover(status.nearMemoryId);
      else if (status.nearFinish) progression.finish();
    }
    scene.render(controller.position, controller.facing, elapsed);
    emitStatus();
    animationFrame = windowTarget.requestAnimationFrame(frame);
  };

  emitStatus(true);
  animationFrame = windowTarget.requestAnimationFrame(frame);

  return {
    updateSave(nextSave): void {
      if (disposed) return;
      progression.authoritativeUpdate(nextSave);
    },
    setInput(action, value): void {
      if (!disposed) input.set(action, value);
    },
    setPaused(value): void {
      paused = value;
      input.clear();
      previousJump = false;
      previousInteract = false;
    },
    clearInput(): void {
      input.clear();
      previousJump = false;
      previousInteract = false;
    },
    inspect() {
      return {
        status: getStatus(),
        input: input.snapshot(),
        checkpoint: { ...checkpoint },
        level: inspectLevel(level),
        disposed,
      };
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      windowTarget.cancelAnimationFrame(animationFrame);
      progression.dispose();
      stopBrowserInput();
      input.clear();
      scene.dispose();
    },
  };
}
