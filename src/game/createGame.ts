import type {
  AdventureView,
  GameplayAction,
  SaveView,
} from "../shared/contracts";
import { ActionCoordinator, type ActionRequestState } from "./actions";
import { bossIsActive, EnemySimulation, findAttackTarget } from "./combat";
import { createControllerState, stepController } from "./controller";
import { bindBrowserInput, GameInputState } from "./input";
import {
  checkpointForSave,
  createLevelLayout,
  inspectLevel,
  type LevelLayout,
} from "./level";
import { GardenScene } from "./scene";
import type {
  CreateGameOptions,
  EnemyFrame,
  GameHandle,
  GameStatus,
  PositionSnapshot,
  SceneFrame,
  SceneMediaState,
} from "./types";

const interactionRadius = 1.4;
const statusIntervalSeconds = 0.1;
const attackAnimationSeconds = 0.28;

interface RuntimeScene {
  canvas: HTMLCanvasElement;
  cameraYaw: number;
  adjustCamera(
    lookX: number,
    lookY: number,
    deltaSeconds: number,
    pointerX: number,
    pointerY: number,
  ): void;
  rebuildRoute(level: LevelLayout, save: SaveView): void;
  updateProgress(save: SaveView): void;
  render(
    position: PositionSnapshot,
    facing: number,
    elapsed: number,
    frame?: SceneFrame,
  ): void;
  getMediaState?(): SceneMediaState;
  retryMedia?(): void;
  dispose(): void;
}

function horizontalDistance(
  first: { x: number; z: number },
  second: { x: number; z: number },
): number {
  return Math.hypot(first.x - second.x, first.z - second.z);
}

function levelIdentity(save: SaveView): string {
  return `${save.id}:${save.adventure?.currentLevelId ?? "complete"}`;
}

function requireAdventure(save: SaveView): AdventureView {
  if (save.format !== "era-combat-v2" || !save.adventure) {
    throw new Error("The era game runtime requires an era-combat-v2 save");
  }
  return save.adventure;
}

function nearestWithin<T extends { position: PositionSnapshot }>(
  position: PositionSnapshot,
  candidates: T[],
  radius: number,
): T | null {
  let nearest: T | null = null;
  let nearestDistance = radius;
  for (const candidate of candidates) {
    const candidateDistance = horizontalDistance(position, candidate.position);
    if (candidateDistance <= nearestDistance) {
      nearest = candidate;
      nearestDistance = candidateDistance;
    }
  }
  return nearest;
}

function hasEquipment(
  save: SaveView,
  kind: "attack-tool" | "guard-tool",
): boolean {
  const adventure = requireAdventure(save);
  if (kind === "attack-tool") {
    return adventure.inventory.some(
      (item) =>
        item.id === adventure.equippedId &&
        item.kind === "attack-tool" &&
        item.collected,
    );
  }
  return adventure.inventory.some(
    (item) => item.kind === "guard-tool" && item.collected,
  );
}

export function createGame(options: CreateGameOptions): GameHandle {
  requireAdventure(options.save);
  let save = options.save;
  let level = createLevelLayout(save);
  let retainedActiveLevel = requireAdventure(save).activeLevel;
  let checkpoint = checkpointForSave(save, level);
  const controller = createControllerState(checkpoint);
  const input = new GameInputState();
  const scene = new GardenScene(options.container, level, save) as RuntimeScene;
  const stopBrowserInput = bindBrowserInput({ target: scene.canvas, input });
  const windowTarget = options.container.ownerDocument.defaultView;
  if (!windowTarget) {
    scene.dispose();
    throw new Error("Game requires a window");
  }

  const enemies = new EnemySimulation(level, save);
  let pendingHit: { levelId: string; encounterId: string } | null = null;
  let disposed = false;
  let paused = false;
  let combatNeedsFreshTelegraph = false;
  let animationFrame = 0;
  let lastTime = windowTarget.performance.now();
  let elapsed = 0;
  let timeSinceStatus = statusIntervalSeconds;
  let worldWasActive = false;
  let attackAnimationUntil = 0;
  let attackCooldownUntil =
    lastTime + requireAdventure(save).attackCooldownRemainingMs;
  let guardActiveUntil =
    lastTime + requireAdventure(save).guardActiveRemainingMs;
  let guardCooldownUntil =
    lastTime + requireAdventure(save).guardCooldownRemainingMs;
  let requestState: ActionRequestState = {
    requestState: "idle",
    requestError: null,
    requestErrorCode: null,
  };
  const suspendWorldClock = (): void => {
    worldWasActive = false;
    lastTime = windowTarget.performance.now();
    if (options.container.ownerDocument.visibilityState !== "visible") {
      pendingHit = null;
      combatNeedsFreshTelegraph = true;
    } else if (combatNeedsFreshTelegraph && !paused) {
      enemies.restartThreatenedAttacks();
      combatNeedsFreshTelegraph = false;
    }
  };
  options.container.ownerDocument.addEventListener(
    "visibilitychange",
    suspendWorldClock,
  );

  const mediaState = (): SceneMediaState =>
    scene.getMediaState?.() ?? { loading: 0, failed: 0 };

  const enemyFrames = (): EnemyFrame[] => enemies.frames();

  const nearestPickupId = (): string | null => {
    if (requireAdventure(save).phase !== "exploring") return null;
    return (
      nearestWithin(
        controller.position,
        level.pickups.filter((pickup) => !pickup.collected),
        interactionRadius,
      )?.id ?? null
    );
  };

  const nearestMemoryId = (): string | null => {
    if (requireAdventure(save).phase !== "memory-released") return null;
    return (
      nearestWithin(
        controller.position,
        level.memories.filter((memory) => memory.state === "released"),
        interactionRadius,
      )?.id ?? null
    );
  };

  const nearestEncounter = (autoFace: boolean) =>
    findAttackTarget(
      save,
      enemyFrames(),
      controller.position,
      controller.facing,
      autoFace,
    );

  const canConsume = (): boolean => {
    const adventure = requireAdventure(save);
    if (adventure.phase !== "memory-released" || !adventure.activeLevel) {
      return false;
    }
    const memories = new Map(
      save.memories.map((memory) => [memory.id, memory]),
    );
    return adventure.activeLevel.memoryIds.every(
      (id) => memories.get(id)?.state === "revealed",
    );
  };

  const getStatus = (): GameStatus => {
    const adventure = requireAdventure(save);
    const now = windowTarget.performance.now();
    const target = nearestEncounter(true);
    const media = mediaState();
    const requestBusy = requestState.requestState === "acting";
    return {
      nearPickupId: nearestPickupId(),
      nearEncounterId: target?.id ?? null,
      nearMemoryId: nearestMemoryId(),
      nearFinish:
        canConsume() &&
        horizontalDistance(controller.position, level.finish) <=
          interactionRadius,
      canConsume: canConsume(),
      position: { ...controller.position },
      ageYears: save.ageYears,
      appearanceStage: save.appearance.stage,
      abilities: [...save.abilities],
      grounded: controller.grounded,
      playerHp: adventure.playerHp,
      maxPlayerHp: adventure.maxPlayerHp,
      phase: adventure.phase,
      activeLevelId: adventure.currentLevelId,
      eraYear: adventure.activeLevel?.eraYear ?? null,
      attackReady:
        adventure.phase === "exploring" &&
        hasEquipment(save, "attack-tool") &&
        Boolean(target) &&
        now >= attackCooldownUntil &&
        !requestBusy,
      guardActive: now < guardActiveUntil,
      guardReady:
        adventure.phase === "exploring" &&
        hasEquipment(save, "guard-tool") &&
        now >= guardCooldownUntil &&
        !requestBusy,
      requestBusy,
      requestState: requestState.requestState,
      requestError: requestState.requestError,
      requestErrorCode: requestState.requestErrorCode,
      mediaLoading: media.loading,
      mediaFailed: media.failed,
    };
  };

  const emitStatus = (force = false): void => {
    if (disposed || !options.onStatus) return;
    if (!force && timeSinceStatus < statusIntervalSeconds) return;
    timeSinceStatus = 0;
    options.onStatus(getStatus());
  };

  const resetController = (nextCheckpoint: PositionSnapshot): void => {
    controller.position = { ...nextCheckpoint };
    controller.velocityY = 0;
    controller.grounded = true;
    controller.facing = 0;
  };

  const applySave = (nextSave: SaveView): void => {
    if (
      disposed ||
      nextSave.format !== "era-combat-v2" ||
      !nextSave.adventure
    ) {
      return;
    }
    const previousIdentity = levelIdentity(save);
    const previousAdventure = requireAdventure(save);
    const previousPhase = previousAdventure.phase;
    const nextIdentity = levelIdentity(nextSave);
    const nextAdventure = nextSave.adventure;
    const revivedEncounter = nextAdventure.activeLevel?.encounters.some(
      (nextEncounter) =>
        !nextEncounter.defeated &&
        previousAdventure.activeLevel?.encounters.find(
          (previousEncounter) => previousEncounter.id === nextEncounter.id,
        )?.defeated,
    );
    if (nextAdventure.activeLevel) {
      retainedActiveLevel = nextAdventure.activeLevel;
    }
    const retainCompletedWorld =
      nextAdventure.phase === "complete" &&
      !nextAdventure.activeLevel &&
      level.id !== null &&
      retainedActiveLevel !== null;
    save = nextSave;
    const sceneSave = retainCompletedWorld
      ? {
          ...nextSave,
          adventure: {
            ...nextAdventure,
            activeLevel: retainedActiveLevel,
          },
        }
      : nextSave;
    const nextLevel = retainCompletedWorld
      ? level
      : createLevelLayout(nextSave);
    const nextCheckpoint = retainCompletedWorld
      ? checkpoint
      : checkpointForSave(save, nextLevel);
    const identityChanged =
      !retainCompletedWorld && previousIdentity !== nextIdentity;
    const retried =
      (previousPhase === "fallen" &&
        nextSave.adventure.phase === "exploring") ||
      revivedEncounter === true;
    if (identityChanged || retried || nextAdventure.phase !== "exploring") {
      pendingHit = null;
    }
    level = nextLevel;
    checkpoint = nextCheckpoint;
    if (identityChanged || retried) {
      resetController(checkpoint);
      enemies.reset(level, save);
      scene.rebuildRoute(level, save);
      scene.cameraYaw = 0;
    } else {
      enemies.sync(level, sceneSave);
      if (
        previousPhase !== "memory-released" &&
        nextSave.adventure.phase === "memory-released"
      ) {
        resetController(checkpoint);
      }
      scene.updateProgress(sceneSave);
    }
    const now = windowTarget.performance.now();
    attackCooldownUntil = now + nextSave.adventure.attackCooldownRemainingMs;
    guardActiveUntil = now + nextSave.adventure.guardActiveRemainingMs;
    guardCooldownUntil = now + nextSave.adventure.guardCooldownRemainingMs;
    worldWasActive = false;
    emitStatus(true);
  };

  const coordinator = new ActionCoordinator({
    initialSave: save,
    onAction: options.onAction,
    onRefresh: options.onRefresh,
    onApply: applySave,
    onState: (state) => {
      requestState = state;
      emitStatus(true);
    },
  });

  const flushPendingHit = (): void => {
    if (!pendingHit || requestState.requestState === "acting") return;
    const hit = pendingHit;
    const adventure = requireAdventure(save);
    const encounter = adventure.activeLevel?.encounters.find(
      (candidate) => candidate.id === hit.encounterId,
    );
    if (
      adventure.phase !== "exploring" ||
      adventure.currentLevelId !== hit.levelId ||
      !encounter ||
      encounter.defeated ||
      (encounter as { available?: boolean }).available === false ||
      (encounter.role === "boss" && !bossIsActive(save))
    ) {
      pendingHit = null;
      return;
    }
    if (
      coordinator.perform({
        type: "take-hit",
        levelId: hit.levelId,
        encounterId: hit.encounterId,
      })
    ) {
      pendingHit = null;
      enemies.noteHitDispatched();
    } else {
      pendingHit = null;
    }
  };

  const validLevelAction = (action: GameplayAction): boolean =>
    action.levelId === requireAdventure(save).currentLevelId;

  const validStrike = (encounterId: string): boolean => {
    if (controller.position.y > 0.3) return false;
    const encounter = requireAdventure(save).activeLevel?.encounters.find(
      (candidate) => candidate.id === encounterId,
    );
    const frame = enemyFrames().find(
      (candidate) => candidate.id === encounterId,
    );
    if (
      !encounter ||
      !frame ||
      frame.phase !== "strike" ||
      encounter.defeated
    ) {
      return false;
    }
    const range = encounter.role === "boss" ? 1.75 : 1.35;
    return horizontalDistance(controller.position, frame.position) <= range;
  };

  const performAction = (action: GameplayAction): boolean => {
    const adventure = requireAdventure(save);
    if (!validLevelAction(action)) return false;
    if (
      paused &&
      action.type !== "recover-memory" &&
      action.type !== "consume-memory-bundle" &&
      action.type !== "retry-level"
    ) {
      return false;
    }
    switch (action.type) {
      case "collect-equipment":
        if (
          adventure.phase !== "exploring" ||
          nearestPickupId() !== action.pickupId
        ) {
          return false;
        }
        break;
      case "attack": {
        if (
          adventure.phase !== "exploring" ||
          !hasEquipment(save, "attack-tool") ||
          windowTarget.performance.now() < attackCooldownUntil
        ) {
          return false;
        }
        const target = nearestEncounter(false);
        if (target?.id !== action.encounterId) return false;
        break;
      }
      case "take-hit":
        if (
          adventure.phase !== "exploring" ||
          !validStrike(action.encounterId)
        ) {
          return false;
        }
        break;
      case "guard":
        if (
          adventure.phase !== "exploring" ||
          !hasEquipment(save, "guard-tool") ||
          windowTarget.performance.now() < guardCooldownUntil
        ) {
          return false;
        }
        break;
      case "recover-memory": {
        const memory = save.memories.find(
          (candidate) => candidate.id === action.memoryId,
        );
        if (
          adventure.phase !== "memory-released" ||
          !adventure.activeLevel?.memoryIds.includes(action.memoryId) ||
          memory?.state !== "released"
        ) {
          return false;
        }
        break;
      }
      case "consume-memory-bundle":
        if (!canConsume()) return false;
        break;
      case "retry-level":
        if (adventure.phase !== "fallen") return false;
        break;
    }
    const accepted = coordinator.perform(action);
    if (accepted && action.type === "attack") {
      attackAnimationUntil =
        windowTarget.performance.now() + attackAnimationSeconds * 1000;
    }
    return accepted;
  };

  const frame = (now: number): void => {
    if (disposed) return;
    const rawDeltaSeconds = Math.max(0, (now - lastTime) / 1000);
    const wallDeltaSeconds = Math.min(0.05, rawDeltaSeconds);
    lastTime = now;
    elapsed += wallDeltaSeconds;
    timeSinceStatus += wallDeltaSeconds;
    const adventure = requireAdventure(save);
    const visible =
      options.container.ownerDocument.visibilityState === "visible";
    const worldActive =
      !paused &&
      visible &&
      (adventure.phase === "exploring" ||
        adventure.phase === "memory-released");
    const combatActive = worldActive && adventure.phase === "exploring";
    if (!visible && worldWasActive) {
      pendingHit = null;
      combatNeedsFreshTelegraph = true;
    } else if (worldActive && combatNeedsFreshTelegraph) {
      enemies.restartThreatenedAttacks();
      combatNeedsFreshTelegraph = false;
    }
    const deltaSeconds = worldActive && worldWasActive ? wallDeltaSeconds : 0;
    worldWasActive = worldActive;
    if (!worldActive) input.clear();
    const currentInput = input.snapshot();
    const pointerLook = input.consumePointerLook();
    const actions = input.consumeActions();
    if (worldActive) {
      scene.adjustCamera(
        currentInput.lookX,
        currentInput.lookY,
        deltaSeconds,
        pointerLook.x,
        pointerLook.y,
      );
      stepController(
        controller,
        currentInput,
        level,
        deltaSeconds,
        scene.cameraYaw,
        save.abilities.includes("jump"),
        actions.jump,
      );
      enemies.resolvePlayerCollision(controller.position, level);
      if (actions.interact) {
        const pickupId = nearestPickupId();
        const memoryId = nearestMemoryId();
        if (pickupId && adventure.currentLevelId) {
          performAction({
            type: "collect-equipment",
            levelId: adventure.currentLevelId,
            pickupId,
          });
        } else if (memoryId && adventure.currentLevelId) {
          performAction({
            type: "recover-memory",
            levelId: adventure.currentLevelId,
            memoryId,
          });
        }
      }
      if (actions.attack && adventure.currentLevelId) {
        const target = nearestEncounter(true);
        if (target) {
          controller.facing = target.facing;
          performAction({
            type: "attack",
            levelId: adventure.currentLevelId,
            encounterId: target.id,
          });
        }
      }
      if (actions.guard && adventure.currentLevelId) {
        performAction({ type: "guard", levelId: adventure.currentLevelId });
      }
      const contacts = enemies.step(
        { player: controller.position, deltaSeconds, active: combatActive },
        save,
      );
      if (!pendingHit && contacts[0] && adventure.currentLevelId) {
        pendingHit = {
          levelId: adventure.currentLevelId,
          encounterId: contacts[0],
        };
      }
      flushPendingHit();
    } else {
      enemies.step(
        { player: controller.position, deltaSeconds: 0, active: false },
        save,
      );
    }
    const frames = enemyFrames();
    const target = nearestEncounter(true);
    scene.render(controller.position, controller.facing, elapsed, {
      deltaSeconds,
      moving:
        worldActive &&
        Math.hypot(currentInput.moveX, currentInput.moveY) > 0.01,
      grounded: controller.grounded,
      attacking: now < attackAnimationUntil,
      guarding: now < guardActiveUntil,
      enemies: frames,
      currentTarget: target?.id ?? null,
    });
    emitStatus();
    animationFrame = windowTarget.requestAnimationFrame(frame);
  };

  emitStatus(true);
  animationFrame = windowTarget.requestAnimationFrame(frame);

  return {
    updateSave(nextSave): void {
      if (disposed || nextSave.format !== "era-combat-v2") return;
      coordinator.authoritativeUpdate(nextSave);
    },
    setInput(action, value): void {
      if (!disposed) input.set(action, value);
    },
    setPaused(value): void {
      if (paused === value) return;
      paused = value;
      worldWasActive = false;
      input.clear();
      if (paused) {
        pendingHit = null;
        combatNeedsFreshTelegraph = true;
      } else if (combatNeedsFreshTelegraph) {
        enemies.restartThreatenedAttacks();
        combatNeedsFreshTelegraph = false;
      }
    },
    clearInput(): void {
      input.clear();
    },
    performAction(action): boolean {
      return !disposed && performAction(action);
    },
    retryMedia(): void {
      if (disposed) return;
      scene.retryMedia?.();
      emitStatus(true);
    },
    inspect() {
      const frames = enemyFrames();
      const byId = new Map(frames.map((enemy) => [enemy.id, enemy]));
      const levelInspection = inspectLevel(level);
      levelInspection.encounterPositions =
        levelInspection.encounterPositions.map((encounter) => {
          const enemy = byId.get(encounter.id);
          return enemy
            ? {
                ...encounter,
                ...enemy.position,
                hp: enemy.hp,
                maxHp: enemy.maxHp,
                localPhase: enemy.phase,
              }
            : encounter;
        });
      return {
        status: getStatus(),
        input: input.snapshot(),
        checkpoint: { ...checkpoint },
        level: levelInspection,
        enemies: frames,
        disposed,
      };
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      pendingHit = null;
      windowTarget.cancelAnimationFrame(animationFrame);
      options.container.ownerDocument.removeEventListener(
        "visibilitychange",
        suspendWorldClock,
      );
      coordinator.dispose();
      stopBrowserInput();
      input.clear();
      scene.dispose();
    },
  };
}
