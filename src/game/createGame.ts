import type {
  AdventureView,
  GameplayAction,
  SaveView,
} from "../shared/contracts";
import {
  BestiesSimulation,
  BESTIES_ARENA_CENTER,
  nearestBestiesActor,
  type BestieActorId,
} from "./besties";
import { ActionCoordinator, type ActionRequestState } from "./actions";
import {
  bossIsActive,
  enemyAttackRange,
  EnemySimulation,
  findAttackTarget,
  withinEnemyStrikeHeight,
} from "./combat";
import { getAvatarProportions, stepController } from "./controller";
import { foregroundSimulationSteps } from "./frame-step";
import { createObbyState, sampleObby, stepObby } from "./obby";
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
const primaryAttackAnimationSeconds = 0.38;
const secondaryAttackAnimationSeconds = 0.4;
const interactionAnimationSeconds = 0.45;
const secondaryAttackRange = 2.25;
const maxPlayerAttackFeetDelta = 1;
const autoInteractionRetryMs = 750;

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

function isRouteMemoryAdventure(save: SaveView): boolean {
  return Boolean(requireAdventure(save).activeLevel?.majorMemoryId);
}

function facingDifference(from: number, to: number): number {
  let difference = from - to;
  while (difference > Math.PI) difference -= Math.PI * 2;
  while (difference < -Math.PI) difference += Math.PI * 2;
  return Math.abs(difference);
}

export function createGame(options: CreateGameOptions): GameHandle {
  requireAdventure(options.save);
  let save = options.save;
  let level = createLevelLayout(save);
  let retainedActiveLevel = requireAdventure(save).activeLevel;
  let checkpoint = checkpointForSave(save, level);
  let controller = createObbyState(checkpoint);
  controller.grounded = true;
  let courseTime = 0;
  let traversalRecoveries = 0;
  const input = new GameInputState();
  const scene = new GardenScene(options.container, level, save) as RuntimeScene;
  const stopBrowserInput = bindBrowserInput({ target: scene.canvas, input });
  const windowTarget = options.container.ownerDocument.defaultView;
  if (!windowTarget) {
    scene.dispose();
    throw new Error("Game requires a window");
  }

  const enemies = new EnemySimulation(level, save);
  let besties = new BestiesSimulation();
  const bestiesEncounter = () =>
    requireAdventure(save).activeLevel?.encounters.find(
      (entry) => entry.content?.assetId === "bickering-besties",
    );
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
  let attackAnimationKind: "primary" | "secondary" = "primary";
  let attackTargetId: string | null = null;
  let bestiesHitActorId: BestieActorId | null = null;
  let interactionAnimationUntil = 0;
  let interactionSequence = 0;
  let jumpSequence = 0;
  let attackFeedback: GameStatus["attackFeedback"] = null;
  let attackFeedbackSequence = 0;
  let attackCooldownUntil =
    lastTime + requireAdventure(save).attackCooldownRemainingMs;
  let guardActiveUntil =
    lastTime + requireAdventure(save).guardActiveRemainingMs;
  let guardCooldownUntil =
    lastTime + requireAdventure(save).guardCooldownRemainingMs;
  let secondaryCooldownUntil =
    lastTime + (requireAdventure(save).secondaryCooldownRemainingMs ?? 0);
  let autoInteractionKey: string | null = null;
  let autoInteractionRetryAt = 0;
  let suppressedAutoFriendlyId: string | null = null;
  let requestState: ActionRequestState = {
    requestState: "idle",
    requestError: null,
    requestErrorCode: null,
  };
  const suspendWorldClock = (): void => {
    worldWasActive = false;
    lastTime = windowTarget.performance.now();
    if (options.container.ownerDocument.visibilityState !== "visible") {
      besties.restartThreatenedTrick();
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

  const enemyFrames = (): EnemyFrame[] =>
    enemies.frames().map((enemy) => {
      if (enemy.id !== bestiesEncounter()?.id) return enemy;
      const routine = besties.frame();
      return {
        ...enemy,
        position: { ...BESTIES_ARENA_CENTER },
        facing: Math.PI,
        phase:
          enemy.hp === 0
            ? "defeated"
            : routine.vulnerable
              ? "cooldown"
              : "idle",
      };
    });
  const nearestFriendlyId = (): string | null => {
    if (
      !["exploring", "memory-released"].includes(requireAdventure(save).phase)
    )
      return null;
    if (!controller.grounded || controller.recoveryRemaining > 0) return null;
    return (
      nearestWithin(
        controller.position,
        level.friendlies ?? [],
        interactionRadius + 0.3,
      )?.id ?? null
    );
  };

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
    const adventure = requireAdventure(save);
    const activeLevel = adventure.activeLevel;
    const routeMemories = activeLevel?.minorMemoryIds;
    if (
      routeMemories
        ? adventure.phase !== "exploring" &&
          adventure.phase !== "memory-released"
        : adventure.phase !== "memory-released"
    )
      return null;
    const eligibleMemoryIds = routeMemories
      ? new Set([
          ...routeMemories,
          ...(adventure.phase === "memory-released" &&
          routeMemories.every(
            (id) =>
              save.memories.find((memory) => memory.id === id)?.state ===
              "revealed",
          ) &&
          activeLevel.majorMemoryId
            ? [activeLevel.majorMemoryId]
            : []),
        ])
      : null;
    return (
      nearestWithin(
        controller.position,
        level.memories.filter(
          (memory) =>
            memory.state === "released" &&
            (!eligibleMemoryIds || eligibleMemoryIds.has(memory.id)),
        ),
        interactionRadius,
      )?.id ?? null
    );
  };

  const nearestEligibleFriendlyId = (): string | null => {
    const adventure = requireAdventure(save);
    if (!controller.grounded || controller.recoveryRemaining > 0) return null;
    return (
      nearestWithin(
        controller.position,
        (level.friendlies ?? []).filter(
          (friend) =>
            friend.penaltyActive ||
            (!friend.boonClaimed && adventure.playerHp < adventure.maxPlayerHp),
        ),
        interactionRadius + 0.3,
      )?.id ?? null
    );
  };

  const attackTargetFrames = (): EnemyFrame[] =>
    enemyFrames().map((enemy) =>
      enemy.id === bestiesEncounter()?.id
        ? {
            ...enemy,
            position: nearestBestiesActor(besties.frame(), controller.position)
              .position,
          }
        : enemy,
    );

  const nearestEncounter = (autoFace: boolean) =>
    findAttackTarget(
      save,
      attackTargetFrames(),
      controller.position,
      controller.facing,
      autoFace,
    );

  const nearestSecondaryEncounter = (autoFace: boolean) => {
    const adventure = requireAdventure(save);
    const encounters = new Map(
      (adventure.activeLevel?.encounters ?? []).map((encounter) => [
        encounter.id,
        encounter,
      ]),
    );
    const candidates = attackTargetFrames().flatMap((enemy) => {
      const encounter = encounters.get(enemy.id);
      if (
        !encounter ||
        encounter.defeated ||
        encounter.available === false ||
        (encounter.role === "boss" && !bossIsActive(save))
      )
        return [];
      const distance = horizontalDistance(controller.position, enemy.position);
      if (
        distance > secondaryAttackRange ||
        Math.abs(controller.position.y - enemy.position.y) >
          maxPlayerAttackFeetDelta
      )
        return [];
      const facing = Math.atan2(
        controller.position.x - enemy.position.x,
        controller.position.z - enemy.position.z,
      );
      if (
        !autoFace &&
        facingDifference(facing, controller.facing) > Math.PI / 3
      ) {
        return [];
      }
      return [{ id: enemy.id, facing, distance }];
    });
    candidates.sort((left, right) => left.distance - right.distance);
    return candidates[0] ?? null;
  };

  const canConsume = (): boolean => {
    const adventure = requireAdventure(save);
    if (adventure.phase !== "memory-released" || !adventure.activeLevel) {
      return false;
    }
    if (adventure.activeLevel.majorMemoryId) return false;
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
    const routeMemories = isRouteMemoryAdventure(save);
    const secondaryTarget = routeMemories
      ? nearestSecondaryEncounter(true)
      : null;
    const media = mediaState();
    const requestBusy = requestState.requestState === "acting";
    return {
      nearFriendlyId: nearestFriendlyId(),
      bestiesPhase: bestiesEncounter() ? besties.frame().phase : undefined,
      nearPickupId: nearestPickupId(),
      nearEncounterId: target?.id ?? secondaryTarget?.id ?? null,
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
        (target?.id !== bestiesEncounter()?.id || besties.frame().vulnerable) &&
        now >= attackCooldownUntil &&
        !requestBusy,
      attackFeedback,
      jumpSequence,
      interactionSequence,
      guardActive: now < guardActiveUntil,
      guardReady:
        adventure.phase === "exploring" &&
        hasEquipment(save, "guard-tool") &&
        (routeMemories
          ? Boolean(secondaryTarget) &&
            (secondaryTarget?.id !== bestiesEncounter()?.id ||
              besties.frame().vulnerable) &&
            now >= secondaryCooldownUntil
          : now >= guardCooldownUntil) &&
        !requestBusy,
      requestBusy,
      requestState: requestState.requestState,
      requestError: requestState.requestError,
      requestErrorCode: requestState.requestErrorCode,
      mediaLoading: media.loading,
      mediaFailed: media.failed,
      mediaReloadRequired: media.reloadRequired ?? false,
    };
  };

  const emitStatus = (force = false): void => {
    if (disposed || !options.onStatus) return;
    if (!force && timeSinceStatus < statusIntervalSeconds) return;
    timeSinceStatus = 0;
    options.onStatus(getStatus());
  };

  const recordAttackFeedback = (
    outcome: NonNullable<GameStatus["attackFeedback"]>["outcome"],
    kind?: "primary" | "secondary",
  ): false => {
    attackFeedback = {
      sequence: ++attackFeedbackSequence,
      outcome,
      ...(kind === "secondary" ? { kind } : {}),
    };
    emitStatus(true);
    return false;
  };

  const beginAttackAnimation = (
    kind: "primary" | "secondary",
    targetId: string | null,
  ): void => {
    attackAnimationKind = kind;
    attackAnimationUntil =
      windowTarget.performance.now() +
      (kind === "primary"
        ? primaryAttackAnimationSeconds
        : secondaryAttackAnimationSeconds) *
        1000;
    attackTargetId = targetId;
    if (targetId === bestiesEncounter()?.id)
      bestiesHitActorId = nearestBestiesActor(
        besties.frame(),
        controller.position,
      ).id;
  };

  const beginInteractionAnimation = (): void => {
    interactionAnimationUntil =
      windowTarget.performance.now() + interactionAnimationSeconds * 1000;
    interactionSequence += 1;
  };

  const resetController = (nextCheckpoint: PositionSnapshot): void => {
    controller = createObbyState(nextCheckpoint);
    controller.grounded = true;
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
    if (
      !level.course ||
      identityChanged ||
      retried ||
      nextAdventure.phase === "memory-released"
    ) {
      checkpoint = nextCheckpoint;
    }
    if (identityChanged || retried) {
      courseTime = 0;
      traversalRecoveries = 0;
      attackAnimationUntil = 0;
      attackTargetId = null;
      interactionAnimationUntil = 0;
      suppressedAutoFriendlyId = null;
      attackFeedback = null;
      resetController(checkpoint);
      enemies.reset(level, save);
      besties = new BestiesSimulation();
      scene.rebuildRoute(level, save);
      scene.cameraYaw = 0;
    } else {
      enemies.sync(level, sceneSave);
      if (
        previousPhase !== "memory-released" &&
        nextSave.adventure.phase === "memory-released"
      ) {
        if (level.course) {
          // Let the player see the boss's defeat. Only recovery/reload moves to the safe reward area.
          controller.checkpoint = { ...checkpoint };
          controller.checkpointId = null;
        } else resetController(checkpoint);
      }
      scene.updateProgress(sceneSave);
    }
    const now = windowTarget.performance.now();
    attackCooldownUntil = now + nextSave.adventure.attackCooldownRemainingMs;
    guardActiveUntil = now + nextSave.adventure.guardActiveRemainingMs;
    guardCooldownUntil = now + nextSave.adventure.guardCooldownRemainingMs;
    secondaryCooldownUntil =
      now + (nextSave.adventure.secondaryCooldownRemainingMs ?? 0);
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
      if (state.requestState === "error" && autoInteractionKey) {
        autoInteractionRetryAt =
          windowTarget.performance.now() + autoInteractionRetryMs;
      }
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
    if (controller.recoveryRemaining > 0) return false;
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
    if (!withinEnemyStrikeHeight(controller.position, frame.position))
      return false;
    const range = enemyAttackRange(encounter.role);
    return horizontalDistance(controller.position, frame.position) <= range;
  };

  const performAction = (action: GameplayAction): boolean => {
    const adventure = requireAdventure(save);
    const attackKind =
      action.type === "secondary-attack"
        ? "secondary"
        : action.type === "attack"
          ? "primary"
          : null;
    if (action.type === "attack" || action.type === "secondary-attack") {
      beginAttackAnimation(attackKind!, action.encounterId);
    }
    if (!validLevelAction(action))
      return attackKind
        ? recordAttackFeedback("unavailable", attackKind)
        : false;
    if (
      paused &&
      action.type !== "recover-memory" &&
      action.type !== "consume-memory-bundle" &&
      action.type !== "retry-level" &&
      action.type !== "interact-friendly" &&
      action.type !== "attack-friendly"
    ) {
      return attackKind
        ? recordAttackFeedback("unavailable", attackKind)
        : false;
    }
    switch (action.type) {
      case "interact-friendly":
      case "attack-friendly":
        if (nearestFriendlyId() !== action.friendlyId) return false;
        if (
          action.type === "attack-friendly" &&
          windowTarget.performance.now() < attackCooldownUntil
        )
          return false;
        break;
      case "collect-equipment":
        if (
          adventure.phase !== "exploring" ||
          nearestPickupId() !== action.pickupId
        ) {
          return false;
        }
        break;
      case "attack": {
        if (adventure.phase !== "exploring")
          return recordAttackFeedback("unavailable");
        if (!hasEquipment(save, "attack-tool"))
          return recordAttackFeedback("unarmed");
        if (requestState.requestState === "acting")
          return recordAttackFeedback("busy");
        if (windowTarget.performance.now() < attackCooldownUntil)
          return recordAttackFeedback("cooldown");
        const target = nearestEncounter(false);
        if (target?.id !== action.encounterId)
          return recordAttackFeedback("no-target");
        if (target.id === bestiesEncounter()?.id && !besties.frame().vulnerable)
          return recordAttackFeedback("guarded");
        break;
      }
      case "secondary-attack": {
        if (!isRouteMemoryAdventure(save) || adventure.phase !== "exploring")
          return recordAttackFeedback("unavailable", "secondary");
        if (!hasEquipment(save, "guard-tool"))
          return recordAttackFeedback("unarmed", "secondary");
        if (requestState.requestState === "acting")
          return recordAttackFeedback("busy", "secondary");
        if (windowTarget.performance.now() < secondaryCooldownUntil)
          return recordAttackFeedback("cooldown", "secondary");
        const target = nearestSecondaryEncounter(false);
        if (target?.id !== action.encounterId)
          return recordAttackFeedback("no-target", "secondary");
        if (target.id === bestiesEncounter()?.id && !besties.frame().vulnerable)
          return recordAttackFeedback("guarded", "secondary");
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
          isRouteMemoryAdventure(save) ||
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
        const routeMemories = adventure.activeLevel?.minorMemoryIds;
        if (routeMemories) {
          if (
            nearestMemoryId() !== action.memoryId ||
            memory?.state !== "released"
          ) {
            return false;
          }
        } else if (
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
    if (
      action.type === "attack" ||
      action.type === "secondary-attack" ||
      action.type === "attack-friendly"
    ) {
      const acceptedKind =
        action.type === "secondary-attack" ? "secondary" : "primary";
      if (!accepted) return recordAttackFeedback("unavailable", acceptedKind);
      if (action.type === "attack-friendly") {
        beginAttackAnimation("primary", action.friendlyId);
      }
      if (action.type === "attack-friendly") {
        suppressedAutoFriendlyId = action.friendlyId;
        const friend = level.friendlies?.find(
          (entry) => entry.id === action.friendlyId,
        );
        if (friend)
          controller.facing = Math.atan2(
            controller.position.x - friend.position.x,
            controller.position.z - friend.position.z,
          );
      }
      attackFeedback = {
        sequence: ++attackFeedbackSequence,
        outcome: "accepted",
        ...(action.type === "secondary-attack"
          ? { kind: "secondary" as const }
          : {}),
      };
      emitStatus(true);
    }
    if (
      accepted &&
      (action.type === "collect-equipment" ||
        action.type === "recover-memory" ||
        action.type === "interact-friendly")
    ) {
      beginInteractionAnimation();
      emitStatus(true);
    }
    return accepted;
  };

  const performAutoInteraction = (now: number): boolean => {
    const adventure = requireAdventure(save);
    if (
      !isRouteMemoryAdventure(save) ||
      !controller.grounded ||
      controller.recoveryRemaining > 0 ||
      pendingHit ||
      requestState.requestState === "acting" ||
      !adventure.currentLevelId
    )
      return false;
    const currentFriendlyId = nearestFriendlyId();
    if (
      suppressedAutoFriendlyId &&
      currentFriendlyId !== suppressedAutoFriendlyId
    ) {
      suppressedAutoFriendlyId = null;
    }
    const pickupId = nearestPickupId();
    const memoryId = pickupId ? null : nearestMemoryId();
    const eligibleFriendlyId =
      pickupId || memoryId ? null : nearestEligibleFriendlyId();
    const friendlyId =
      eligibleFriendlyId === suppressedAutoFriendlyId
        ? null
        : eligibleFriendlyId;
    const action: GameplayAction | null = pickupId
      ? {
          type: "collect-equipment",
          levelId: adventure.currentLevelId,
          pickupId,
        }
      : memoryId
        ? {
            type: "recover-memory",
            levelId: adventure.currentLevelId,
            memoryId,
          }
        : friendlyId
          ? {
              type: "interact-friendly",
              levelId: adventure.currentLevelId,
              friendlyId,
            }
          : null;
    const key = action
      ? `${action.type}:${
          "pickupId" in action
            ? action.pickupId
            : "memoryId" in action
              ? action.memoryId
              : action.friendlyId
        }`
      : null;
    if (!action || !key) {
      autoInteractionKey = null;
      autoInteractionRetryAt = 0;
      return false;
    }
    if (autoInteractionKey !== key) {
      autoInteractionKey = key;
      autoInteractionRetryAt = 0;
    }
    if (now < autoInteractionRetryAt) return false;
    const accepted = performAction(action);
    autoInteractionRetryAt = now + autoInteractionRetryMs;
    return accepted;
  };

  const frame = (now: number): void => {
    if (disposed) return;
    const rawDeltaSeconds = Math.max(0, (now - lastTime) / 1000);
    lastTime = now;
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
    const simulationSteps = foregroundSimulationSteps(
      rawDeltaSeconds,
      worldActive && worldWasActive,
    );
    const deltaSeconds = simulationSteps.reduce(
      (total, step) => total + step,
      0,
    );
    worldWasActive = worldActive;
    elapsed += deltaSeconds;
    timeSinceStatus += deltaSeconds;
    if (!worldActive) input.clear();
    const currentInput = input.snapshot();
    const pointerLook = input.consumePointerLook();
    // A save/resume frame resets the clock. Keep a quick tap until physics can step.
    const actions = input.consumeActions(!!level.course && deltaSeconds === 0);
    if (worldActive) {
      scene.adjustCamera(
        currentInput.lookX,
        currentInput.lookY,
        deltaSeconds,
        pointerLook.x,
        pointerLook.y,
      );
      const duo = bestiesEncounter();
      for (const [stepIndex, stepSeconds] of simulationSteps.entries()) {
        const velocityBeforeStep = controller.velocityY;
        if (level.course) {
          courseTime += stepSeconds;
          const dimensions = getAvatarProportions(save.appearance.stage);
          const course =
            adventure.phase === "memory-released"
              ? { ...level.course, checkpoints: [] }
              : level.course;
          const traversal = stepObby(controller, currentInput, course, {
            deltaSeconds: stepSeconds,
            timeSeconds: courseTime,
            cameraYaw: scene.cameraYaw,
            canJump: true,
            jumpPressed: actions.jump && stepIndex === 0,
            radius: dimensions.colliderRadius,
            height: dimensions.height,
            ...(isRouteMemoryAdventure(save)
              ? { tuning: { moveSpeed: 4 } }
              : {}),
          });
          if (traversal.checkpointChanged || traversal.recovered) {
            checkpoint = { ...controller.checkpoint };
          }
          if (traversal.recovered) {
            traversalRecoveries++;
            besties.restartThreatenedTrick();
            if (isRouteMemoryAdventure(save)) input.clearActions();
            else input.clear();
            pendingHit = null;
            enemies.restartThreatenedAttacks();
          }
        } else {
          stepController(
            controller,
            currentInput,
            level,
            stepSeconds,
            scene.cameraYaw,
            true,
            actions.jump && stepIndex === 0,
          );
        }
        if (velocityBeforeStep <= 0 && controller.velocityY > 0) {
          jumpSequence += 1;
        }
        if (controller.recoveryRemaining <= 0) {
          enemies.resolvePlayerCollision(controller.position, level);
        }
        const duoStep = besties.step({
          player: controller.position,
          deltaSeconds: stepSeconds,
          active: Boolean(
            duo &&
            combatActive &&
            bossIsActive(save) &&
            controller.position.z < -17.5,
          ),
          paused: controller.recoveryRemaining > 0,
          defeated: duo?.defeated ?? false,
          aimAtPlayer: isRouteMemoryAdventure(save),
        });
        const contacts = enemies.step(
          {
            player: controller.position,
            deltaSeconds: stepSeconds,
            active: combatActive && controller.recoveryRemaining <= 0,
          },
          save,
        );
        if (duoStep.hit && duo && !pendingHit && adventure.currentLevelId) {
          pendingHit = {
            levelId: adventure.currentLevelId,
            encounterId: duo.id,
          };
        }
        if (!pendingHit && contacts[0] && adventure.currentLevelId) {
          pendingHit = {
            levelId: adventure.currentLevelId,
            encounterId: contacts[0],
          };
        }
      }
      if (simulationSteps.length === 0) {
        enemies.step(
          { player: controller.position, deltaSeconds: 0, active: false },
          save,
        );
      }
      if (controller.recoveryRemaining <= 0) flushPendingHit();
      const collectedByContact = performAutoInteraction(now);
      if (actions.interact && !isRouteMemoryAdventure(save)) {
        const pickupId = nearestPickupId();
        const memoryId = nearestMemoryId();
        const friendlyId = nearestFriendlyId();
        if (pickupId && adventure.currentLevelId) {
          performAction({
            type: "collect-equipment",
            levelId: adventure.currentLevelId,
            pickupId,
          });
        } else if (friendlyId && adventure.currentLevelId) {
          const friend = adventure.activeLevel?.friendlies?.find(
            (entry) => entry.id === friendlyId,
          );
          if (
            friend &&
            (friend.penaltyActive ||
              (!friend.boonClaimed &&
                adventure.playerHp < adventure.maxPlayerHp))
          )
            performAction({
              type: "interact-friendly",
              levelId: adventure.currentLevelId,
              friendlyId,
            });
        } else if (memoryId && adventure.currentLevelId) {
          performAction({
            type: "recover-memory",
            levelId: adventure.currentLevelId,
            memoryId,
          });
        }
      }
      if (actions.attack && !collectedByContact && adventure.currentLevelId) {
        const target = nearestEncounter(true);
        if (target) {
          controller.facing = target.facing;
          performAction({
            type: "attack",
            levelId: adventure.currentLevelId,
            encounterId: target.id,
          });
        } else {
          beginAttackAnimation("primary", null);
          recordAttackFeedback("no-target");
        }
      }
      if (actions.guard && !collectedByContact && adventure.currentLevelId) {
        if (isRouteMemoryAdventure(save)) {
          const target = nearestSecondaryEncounter(true);
          if (target) {
            controller.facing = target.facing;
            performAction({
              type: "secondary-attack",
              levelId: adventure.currentLevelId,
              encounterId: target.id,
            });
          } else {
            beginAttackAnimation("secondary", null);
            recordAttackFeedback("no-target", "secondary");
          }
        } else {
          performAction({ type: "guard", levelId: adventure.currentLevelId });
        }
      }
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
      attacking:
        attackAnimationKind === "primary" && now < attackAnimationUntil,
      attackSequence: attackFeedbackSequence,
      secondaryAttacking:
        attackAnimationKind === "secondary" && now < attackAnimationUntil,
      attackTargetId: now < attackAnimationUntil ? attackTargetId : null,
      interacting: now < interactionAnimationUntil,
      guarding: now < guardActiveUntil,
      enemies: frames,
      currentTarget: target?.id ?? null,
      besties: bestiesEncounter() ? besties.frame() : undefined,
      bestiesHitActorId,
      obby: level.course ? sampleObby(level.course, courseTime) : undefined,
      checkpointId: controller.checkpointId,
      recovering: controller.recoveryRemaining > 0,
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
    cancelInput(action): void {
      if (!disposed) input.cancel(action);
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
        obby: level.course
          ? {
              ...sampleObby(level.course, courseTime),
              routeId: level.routeId!,
              checkpointId: controller.checkpointId,
              supportId: controller.supportId,
              recoveryRemaining: controller.recoveryRemaining,
              recoveries: traversalRecoveries,
            }
          : undefined,
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
