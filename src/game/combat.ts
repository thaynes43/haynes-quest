import type { EncounterView, SaveView } from "../shared/contracts";
import { bossIsAvailable } from "../shared/encounter-availability";
import { EnemyGroundNavigation } from "./enemy-navigation";
import type { EncounterPlacement, LevelLayout } from "./level";
import type { EnemyFrame, EnemyPhase, PositionSnapshot } from "./types";

type RuntimeEncounterView = EncounterView & { available?: boolean };

export const enemyActivationRadius = 6;
const ordinaryActivationRadius = 8;
const ordinaryPursuitRadius = 14;
const ordinarySpawnLeash = 20;
const maxOrdinaryAttackers = 2;
const waitingStopRange = 2.1;
const friendlyHealingRadius = 1.7;
const friendlySafetyRadius = 3.2;
const pursuitLeadSeconds = 0.4;
const maxLeadDistance = 1.6;
const windupClosingSpeed = 4;
const windupStopRange = 0.9;
export const enemyStrikeSeconds = 0.18;
export const enemyCooldownSeconds = 1.4;
export const playerHitCooldownSeconds = 0.9;

const maxEnemyContactFeetDelta = 0.3;
const maxPlayerAttackFeetDelta = 1;
const distanceEpsilon = 0.000001;

type EnemyArena = NonNullable<EncounterPlacement["arena"]>;

interface EnemyTuning {
  speed: number;
  legacySpeed: number;
  stopRange: number;
  attackRange: number;
  windupSeconds: number;
  collisionRadius: number;
}

interface LocalEnemy {
  id: string;
  role: EncounterView["role"];
  arena?: EnemyArena;
  spawn: PositionSnapshot;
  position: PositionSnapshot;
  facing: number;
  phase: EnemyPhase;
  phaseSeconds: number;
  windupTarget: PositionSnapshot | null;
  contactedDuringStrike: boolean;
  hp: number;
  maxHp: number;
  defeated: boolean;
  scripted: boolean;
  /** Has chased the player since it last spawned (DESIGN-027 watchers sleep until then). */
  awake: boolean;
  returning: boolean;
  /** DESIGN-027 D-04 idle pose; 0 is the authored stance. */
  pose: number;
}

/** A sleeping ordinary enemy that DESIGN-027 watcher rules may change unseen. */
export interface DormantWatcher {
  id: string;
  position: PositionSnapshot;
  spawn: PositionSnapshot;
  facing: number;
  pose: number;
  arena?: EnemyArena;
}

export interface EnemyStepOptions {
  player: PositionSnapshot;
  deltaSeconds: number;
  active: boolean;
  /** Local fall recovery protects the checkpoint and releases any pursuit. */
  recovering?: boolean;
}

const ordinaryTuning: EnemyTuning = {
  speed: 4.4,
  legacySpeed: 4.4,
  stopRange: 1.1,
  attackRange: 1.35,
  windupSeconds: 0.8,
  collisionRadius: 0.42,
};
const bossTuning: EnemyTuning = {
  speed: 1.4,
  legacySpeed: 0.65,
  // The routed boss island resumes at z=-19 while its safe arena ends at
  // z=-21. Its reach must bridge that two-metre boundary or it walks against
  // the clamp forever without ever telegraphing an attack.
  stopRange: 2.1,
  attackRange: 2.25,
  windupSeconds: 1.2,
  collisionRadius: 0.68,
};

function tuningFor(role: EncounterView["role"]): EnemyTuning {
  return role === "boss" ? bossTuning : ordinaryTuning;
}

/** Shared by contact checks and the visible full-reach attack warning. */
export function enemyAttackRange(role: EncounterView["role"]): number {
  return tuningFor(role).attackRange;
}

/** Once a fall takes the player below the fight floor, recovery owns the miss. */
export function withinEnemyStrikeHeight(
  player: PositionSnapshot,
  enemy: PositionSnapshot,
): boolean {
  const feetDelta = player.y - enemy.y;
  return feetDelta >= -0.000001 && feetDelta <= maxEnemyContactFeetDelta;
}

function distance(first: PositionSnapshot, second: PositionSnapshot): number {
  return Math.hypot(first.x - second.x, first.z - second.z);
}

function verticalDistance(
  first: PositionSnapshot,
  second: PositionSnapshot,
): number {
  return Math.abs(first.y - second.y);
}

function copyArena(arena: EncounterPlacement["arena"]): EnemyArena | undefined {
  return arena ? { ...arena } : undefined;
}

function clampToArena(position: PositionSnapshot, arena?: EnemyArena): void {
  if (!arena) return;
  position.x = Math.max(arena.minX, Math.min(arena.maxX, position.x));
  position.z = Math.max(arena.minZ, Math.min(arena.maxZ, position.z));
}

function canReachPlayer(
  player: PositionSnapshot,
  arena: EnemyArena | undefined,
  attackRange: number,
): boolean {
  if (!arena) return true;
  const nearest = { ...player };
  clampToArena(nearest, arena);
  return distance(player, nearest) <= attackRange;
}

function spawnFor(
  placement: EncounterPlacement,
  arena?: EnemyArena,
): PositionSnapshot {
  const spawn = { ...placement.position };
  clampToArena(spawn, arena);
  return spawn;
}

function facingToward(from: PositionSnapshot, to: PositionSnapshot): number {
  return Math.atan2(-(to.x - from.x), -(to.z - from.z));
}

function normalizedAngle(angle: number): number {
  let result = angle;
  while (result > Math.PI) result -= Math.PI * 2;
  while (result < -Math.PI) result += Math.PI * 2;
  return result;
}

function encounterMap(save: SaveView): Map<string, RuntimeEncounterView> {
  return new Map(
    (save.adventure?.activeLevel?.encounters ?? []).map((encounter) => [
      encounter.id,
      encounter,
    ]),
  );
}

function friendlyPositionsFor(level: LevelLayout): PositionSnapshot[] {
  return [
    ...Object.values(level.authored?.anchors.friendlies ?? {}).map((anchor) => ({ ...anchor.position })),
    ...(level.friendlies ?? []).map((friendly) => ({ ...friendly.position })),
  ];
}

export function bossIsActive(save: SaveView): boolean {
  const level = save.adventure?.activeLevel;
  const encounters = level?.encounters ?? [];
  const boss = encounters.find((encounter) => encounter.role === "boss") as
    RuntimeEncounterView | undefined;
  return (
    bossIsAvailable(level?.routeId, level?.bossGate,
      level?.bossPrerequisiteDefeats, encounters) &&
    boss?.available !== false
  );
}

export class EnemySimulation {
  private enemies = new Map<string, LocalEnemy>();
  private groundNavigation: EnemyGroundNavigation | null = null;
  private friendlyPositions: PositionSnapshot[] = [];
  private hitCooldownSeconds = 0;
  private lastPlayer: PositionSnapshot | null = null;
  /**
   * DESIGN-027 D-04, scare level 1+: a sleeping ordinary enemy holds its
   * facing instead of tracking the player, so it only changes while unseen.
   * Off (level 0) keeps the exact published behavior.
   */
  private watchers = false;

  constructor(level: LevelLayout, save: SaveView) {
    this.reset(level, save);
  }

  reset(level: LevelLayout, save: SaveView): void {
    this.enemies.clear();
    this.groundNavigation = level.course ? new EnemyGroundNavigation(level.course) : null;
    this.friendlyPositions = friendlyPositionsFor(level);
    this.lastPlayer = null;
    const authoritative = encounterMap(save);
    for (const placement of level.encounters) {
      const encounter = authoritative.get(placement.id);
      if (!encounter) continue;
      this.addEnemy(placement, encounter);
    }
    this.hitCooldownSeconds = 0;
  }

  sync(level: LevelLayout, save: SaveView): void {
    this.groundNavigation = level.course ? new EnemyGroundNavigation(level.course) : null;
    this.friendlyPositions = friendlyPositionsFor(level);
    const authoritative = encounterMap(save);
    const placementById = new Map(
      level.encounters.map((placement) => [placement.id, placement]),
    );
    for (const id of [...this.enemies.keys()]) {
      if (!authoritative.has(id) || !placementById.has(id))
        this.enemies.delete(id);
    }
    for (const [id, encounter] of authoritative) {
      const current = this.enemies.get(id);
      const placement = placementById.get(id);
      if (!placement) continue;
      if (!current) {
        this.addEnemy(placement, encounter);
        continue;
      }
      current.arena = copyArena(placement.arena);
      if (current.arena) {
        current.spawn = spawnFor(placement, current.arena);
        if (current.role === "boss") clampToArena(current.position, current.arena);
      }
      const revived = current.defeated && !encounter.defeated;
      current.hp = encounter.hp;
      current.maxHp = encounter.maxHp;
      current.defeated = encounter.defeated;
      if (encounter.defeated) {
        current.phase = "defeated";
        current.phaseSeconds = 0;
        current.windupTarget = null;
        current.contactedDuringStrike = false;
      } else if (revived) {
        current.spawn = spawnFor(placement, current.arena);
        current.position = { ...current.spawn };
        current.facing = 0;
        current.awake = false;
        current.returning = false;
        current.pose = 0;
        current.phase = "idle";
        current.phaseSeconds = 0;
        current.windupTarget = null;
        current.contactedDuringStrike = false;
        this.hitCooldownSeconds = 0;
      }
    }
  }

  /** Scare level 1+ turns the watcher rules on; level 0 leaves them off. */
  setWatchers(enabled: boolean): void {
    this.watchers = enabled;
  }

  /** Sleeping ordinary enemies: idle, never woken since spawning, alive. */
  dormantWatchers(): DormantWatcher[] {
    if (!this.watchers) return [];
    return [...this.enemies.values()].flatMap((enemy) =>
      this.isDormantWatcher(enemy)
        ? [
            {
              id: enemy.id,
              position: { ...enemy.position },
              spawn: { ...enemy.spawn },
              facing: enemy.facing,
              pose: enemy.pose,
              ...(enemy.arena ? { arena: { ...enemy.arena } } : {}),
            },
          ]
        : [],
    );
  }

  /**
   * Applies a watcher change. The position is clamped to the arena again, and
   * an enemy that has woken since the change was chosen is left alone.
   */
  applyWatcherMove(
    id: string,
    change: { position: PositionSnapshot; facing: number; pose: number },
  ): boolean {
    const enemy = this.enemies.get(id);
    if (!enemy || !this.isDormantWatcher(enemy)) return false;
    enemy.position = { ...change.position, y: enemy.position.y };
    clampToArena(enemy.position, enemy.arena);
    enemy.facing = change.facing;
    enemy.pose = change.pose;
    return true;
  }

  private isDormantWatcher(enemy: LocalEnemy): boolean {
    return (
      this.watchers &&
      enemy.role === "ordinary" &&
      !enemy.awake &&
      !enemy.returning &&
      !enemy.defeated &&
      !enemy.scripted &&
      enemy.phase === "idle"
    );
  }

  restartThreatenedAttacks(): void {
    for (const enemy of this.enemies.values()) {
      if (enemy.phase !== "windup" && enemy.phase !== "strike") continue;
      enemy.phase = "windup";
      enemy.phaseSeconds = 0;
      enemy.windupTarget = null;
      enemy.contactedDuringStrike = false;
    }
  }

  step(options: EnemyStepOptions, save: SaveView): string[] {
    if (!options.active) {
      this.lastPlayer = null;
      if (options.recovering) {
        for (const enemy of this.enemies.values()) {
          if (enemy.defeated || enemy.scripted) continue;
          enemy.position = { ...enemy.spawn };
          enemy.phase = "idle";
          enemy.phaseSeconds = 0;
          enemy.windupTarget = null;
          enemy.contactedDuringStrike = false;
          enemy.awake = false;
          enemy.returning = false;
          enemy.pose = 0;
        }
      }
      return [];
    }
    const dt = Math.max(0, Math.min(0.05, options.deltaSeconds));
    // A short lead makes a moving foe cut across the route instead of chasing
    // the player's old position. Ignore teleports/recovery and cap the lead so
    // a single delayed frame cannot send an enemy across its whole arena.
    const previousPlayer = this.lastPlayer;
    const playerTravel = previousPlayer
      ? distance(options.player, previousPlayer)
      : 0;
    const lead =
      dt > 0 && previousPlayer && playerTravel <= dt * 8
        ? Math.min(
            pursuitLeadSeconds / dt,
            maxLeadDistance / Math.max(playerTravel, distanceEpsilon),
          )
        : 0;
    const pursuitTarget = {
      x:
        options.player.x +
        (options.player.x - (previousPlayer?.x ?? options.player.x)) * lead,
      y: options.player.y,
      z:
        options.player.z +
        (options.player.z - (previousPlayer?.z ?? options.player.z)) * lead,
    };
    this.lastPlayer = { ...options.player };
    this.hitCooldownSeconds = Math.max(0, this.hitCooldownSeconds - dt);
    const contacts: string[] = [];
    const bossActive = bossIsActive(save);
    let ordinaryAttackers = [...this.enemies.values()].filter((enemy) =>
      enemy.role === "ordinary" && !enemy.defeated &&
      (enemy.phase === "windup" || enemy.phase === "strike")
    ).length;
    for (const enemy of this.enemies.values()) {
      if (enemy.defeated) {
        enemy.phase = "defeated";
        continue;
      }
      if (enemy.role === "boss" && !bossActive) {
        enemy.position = { ...enemy.spawn };
        clampToArena(enemy.position, enemy.arena);
        enemy.phase = "idle";
        enemy.phaseSeconds = 0;
        enemy.contactedDuringStrike = false;
        continue;
      }
      if (enemy.scripted) continue;
      const tuning = tuningFor(enemy.role);
      const playerDistance = distance(enemy.position, options.player);
      const ordinary = enemy.role === "ordinary";
      const activationRadius = ordinary ? ordinaryActivationRadius : enemyActivationRadius;
      const pursuitRadius = ordinary ? ordinaryPursuitRadius : enemyActivationRadius;
      const outsideLeash = ordinary && distance(enemy.spawn, options.player) > ordinarySpawnLeash;
      const needsGroundRoute = !outsideLeash && (
        enemy.phase === "windup" ||
        (enemy.phase === "idle" && playerDistance <= activationRadius) ||
        ((enemy.phase === "chasing" || enemy.phase === "cooldown") &&
          playerDistance <= pursuitRadius)
      );
      const groundTarget = ordinary && this.groundNavigation && needsGroundRoute
        ? this.groundNavigation.next(enemy.position, options.player)
        : null;
      const pursuitReachable = ordinary && this.groundNavigation
        ? groundTarget !== null && verticalDistance(enemy.position, options.player) <= 1.25 &&
          !this.nearFriendly(options.player, friendlyHealingRadius)
        : canReachPlayer(options.player, enemy.arena,
          ordinary ? tuning.attackRange + 2.5 : tuning.attackRange) &&
          (!ordinary || !enemy.arena ||
            verticalDistance(enemy.position, options.player) <= 1.25);
      const sleeping = this.isDormantWatcher(enemy);
      if (!sleeping && !enemy.returning) enemy.facing = facingToward(enemy.position, options.player);
      switch (enemy.phase) {
        case "idle":
          if (playerDistance <= activationRadius && !outsideLeash && pursuitReachable) {
            enemy.phase = "chasing";
            enemy.phaseSeconds = 0;
            enemy.awake = true;
            enemy.returning = false;
            if (sleeping) {
              enemy.facing = facingToward(enemy.position, options.player);
              enemy.pose = 0;
            }
          } else if (enemy.returning) {
            const reached = this.moveToward(enemy, enemy.spawn, tuning.speed * dt);
            enemy.facing = facingToward(enemy.position, enemy.spawn);
            if (reached) {
              enemy.position = { ...enemy.spawn };
              enemy.returning = false;
              enemy.awake = false;
              enemy.pose = 0;
            }
          }
          break;
        case "chasing":
          if (playerDistance > pursuitRadius || outsideLeash || !pursuitReachable) {
            enemy.phase = "idle";
            enemy.phaseSeconds = 0;
            enemy.windupTarget = null;
            enemy.returning = ordinary;
          } else if (
            (ordinaryAttackers < maxOrdinaryAttackers || !ordinary) &&
            (playerDistance <= tuning.stopRange + distanceEpsilon ||
            // Outside the arena, the clamped approach can converge on the
            // preferred stopping distance for seconds. Use the visible strike
            // area there so reaching the edge produces a full warning promptly.
            (playerDistance <= tuning.attackRange &&
              !canReachPlayer(options.player, enemy.arena, 0)))
          ) {
            enemy.phase = "windup";
            enemy.phaseSeconds = 0;
            if (ordinary) ordinaryAttackers += 1;
            if (ordinary) {
              enemy.windupTarget = {
                x: options.player.x + (pursuitTarget.x - options.player.x) * 2,
                y: options.player.y,
                z: options.player.z + (pursuitTarget.z - options.player.z) * 2,
              };
              if (this.groundNavigation && !this.groundNavigation.next(enemy.position, enemy.windupTarget)) {
                enemy.windupTarget = { ...options.player };
              }
            }
          } else {
            const target = ordinary &&
              (!this.groundNavigation || this.groundNavigation.next(enemy.position, pursuitTarget))
              ? pursuitTarget : options.player;
            const waitForAttackSlot = ordinary && ordinaryAttackers >= maxOrdinaryAttackers;
            this.moveToward(enemy, target,
              Math.max(0, Math.min((enemy.arena ? tuning.speed : tuning.legacySpeed) * dt,
                waitForAttackSlot
                  ? playerDistance - waitingStopRange
                  : distance(enemy.position, target) - tuning.stopRange)));
          }
          break;
        case "windup":
          if (ordinary && (outsideLeash || !pursuitReachable)) {
            enemy.phase = "idle";
            enemy.phaseSeconds = 0;
            enemy.windupTarget = null;
            enemy.returning = true;
            ordinaryAttackers -= 1;
          } else if (
            (enemy.role === "boss" || !enemy.arena) &&
            playerDistance > tuning.attackRange
          ) {
            enemy.phase = "chasing";
            enemy.phaseSeconds = 0;
            if (ordinary) ordinaryAttackers -= 1;
          } else {
            if (enemy.windupTarget) {
              const targetDistance = distance(enemy.position, enemy.windupTarget);
              this.moveToward(enemy, enemy.windupTarget,
                Math.min(windupClosingSpeed * dt,
                  Math.max(0, targetDistance - windupStopRange)));
            }
            enemy.phaseSeconds += dt;
            if (enemy.phaseSeconds >= tuning.windupSeconds) {
              enemy.phase = "strike";
              enemy.phaseSeconds = 0;
              enemy.contactedDuringStrike = false;
            }
          }
          break;
        case "strike":
          if (
            !enemy.contactedDuringStrike &&
            playerDistance <= tuning.attackRange &&
            (!ordinary || !outsideLeash) &&
            withinEnemyStrikeHeight(options.player, enemy.position) &&
            (!ordinary || !this.nearFriendly(options.player, friendlyHealingRadius)) &&
            (!ordinary || !this.groundNavigation ||
              this.groundNavigation.canStrike(enemy.position, options.player)) &&
            this.hitCooldownSeconds <= 0
          ) {
            contacts.push(enemy.id);
            enemy.contactedDuringStrike = true;
          }
          enemy.phaseSeconds += dt;
          if (enemy.phaseSeconds >= enemyStrikeSeconds) {
            enemy.phase = "cooldown";
            enemy.phaseSeconds = 0;
            if (ordinary) ordinaryAttackers -= 1;
          }
          break;
        case "cooldown":
          enemy.phaseSeconds += dt;
          if (enemy.phaseSeconds >= enemyCooldownSeconds) {
            enemy.phase =
              playerDistance <= pursuitRadius && !outsideLeash && pursuitReachable
                ? "chasing"
                : "idle";
            enemy.returning = ordinary && enemy.phase === "idle";
            enemy.phaseSeconds = 0;
          }
          break;
        case "defeated":
          break;
      }
    }
    return contacts;
  }

  noteHitDispatched(): void {
    this.hitCooldownSeconds = playerHitCooldownSeconds;
  }

  private nearFriendly(position: PositionSnapshot, radius: number): boolean {
    return this.friendlyPositions.some((friendly) =>
      verticalDistance(position, friendly) <= maxEnemyContactFeetDelta &&
      distance(position, friendly) < radius
    );
  }

  private moveToward(enemy: LocalEnemy, goal: PositionSnapshot, travel: number): boolean {
    const target = enemy.role === "ordinary" && this.groundNavigation
      ? this.groundNavigation.next(enemy.position, goal)
      : goal;
    if (!target) return false;
    const remaining = distance(enemy.position, target);
    if (remaining <= distanceEpsilon) return distance(enemy.position, goal) <= 0.1;
    const move = Math.min(travel, remaining);
    const candidate = {
      x: enemy.position.x + (target.x - enemy.position.x) / remaining * move,
      y: enemy.role === "ordinary" && this.groundNavigation
        ? target.y : enemy.position.y,
      z: enemy.position.z + (target.z - enemy.position.z) / remaining * move,
    };
    if (enemy.role === "ordinary" && this.groundNavigation) {
      if (!this.groundNavigation.canWalk(enemy.position, candidate)) return false;
      if (this.nearFriendly(candidate, friendlySafetyRadius)) return false;
    } else {
      clampToArena(candidate, enemy.arena);
    }
    if (enemy.role === "ordinary" &&
      distance(candidate, enemy.spawn) > ordinarySpawnLeash) return false;
    enemy.position = candidate;
    return distance(enemy.position, goal) <= 0.1;
  }

  frames(): EnemyFrame[] {
    return [...this.enemies.values()].map((enemy) => {
      const tuning = tuningFor(enemy.role);
      return {
        id: enemy.id,
        position: { ...enemy.position },
        facing: enemy.facing,
        phase: enemy.phase,
        windupProgress:
          enemy.phase === "windup"
            ? Math.min(1, enemy.phaseSeconds / tuning.windupSeconds)
            : 0,
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        // Only scare levels 1+ report a pose, so level 0 frames are unchanged.
        ...(this.watchers ? { pose: enemy.pose } : {}),
      };
    });
  }

  resolvePlayerCollision(position: PositionSnapshot, level: LevelLayout): void {
    for (const enemy of this.enemies.values()) {
      if (enemy.defeated || enemy.scripted) continue;
      if (verticalDistance(position, enemy.position) > maxEnemyContactFeetDelta)
        continue;
      const minimumDistance = tuningFor(enemy.role).collisionRadius + 0.25;
      const dx = position.x - enemy.position.x;
      const dz = position.z - enemy.position.z;
      const currentDistance = Math.hypot(dx, dz);
      if (currentDistance >= minimumDistance) continue;
      const normalX = currentDistance > 0.0001 ? dx / currentDistance : 0;
      const normalZ = currentDistance > 0.0001 ? dz / currentDistance : 1;
      const resolved = {
        x: Math.max(level.minX,
          Math.min(level.maxX, enemy.position.x + normalX * minimumDistance)),
        y: position.y,
        z: Math.max(level.minZ,
          Math.min(level.maxZ, enemy.position.z + normalZ * minimumDistance)),
      };
      if (this.groundNavigation && enemy.role === "ordinary" &&
        !this.groundNavigation.canWalk(position, resolved)) continue;
      position.x = resolved.x;
      position.z = resolved.z;
    }
  }

  private addEnemy(
    placement: EncounterPlacement,
    encounter: EncounterView,
  ): void {
    const arena = copyArena(placement.arena);
    const spawn = spawnFor(placement, arena);
    this.enemies.set(placement.id, {
      id: placement.id,
      role: placement.role,
      arena,
      spawn,
      position: { ...spawn },
      facing: 0,
      phase: encounter.defeated ? "defeated" : "idle",
      phaseSeconds: 0,
      windupTarget: null,
      contactedDuringStrike: false,
      hp: encounter.hp,
      maxHp: encounter.maxHp,
      defeated: encounter.defeated,
      scripted: encounter.content?.assetId === "bickering-besties",
      awake: false,
      returning: false,
      pose: 0,
    });
  }
}

export interface AttackTarget {
  id: string;
  facing: number;
  distance: number;
}

const malletAttackRange = {
  ordinary: 1.7,
  boss: 2,
} as const;
const routeMemoryMeleeRange = 2.4;
const prismWandAttackRange = 4.25;

function equippedAttackTier(save: SaveView): number {
  const adventure = save.adventure;
  const equipment = adventure?.inventory.find(
    (item) =>
      item.id === adventure.equippedId &&
      item.kind === "attack-tool" &&
      item.collected,
  );
  return equipment?.tier ?? 0;
}

/** The tier-two Prism wand is ranged; route-memory melee reaches past Bash. */
export function playerAttackRange(
  save: SaveView,
  role: EncounterView["role"],
): number {
  if (equippedAttackTier(save) >= 2) return prismWandAttackRange;
  if (save.adventure?.activeLevel?.majorMemoryId) return routeMemoryMeleeRange;
  return malletAttackRange[role];
}

export function findAttackTarget(
  save: SaveView,
  enemies: EnemyFrame[],
  player: PositionSnapshot,
  playerFacing: number,
  autoFace: boolean,
): AttackTarget | null {
  const authoritative = encounterMap(save);
  const bossActive = bossIsActive(save);
  const candidates = enemies.flatMap((enemy) => {
    const encounter = authoritative.get(enemy.id);
    if (!encounter || encounter.defeated) return [];
    if (encounter.available === false) return [];
    if (encounter.role === "boss" && !bossActive) return [];
    const targetDistance = distance(player, enemy.position);
    const range = playerAttackRange(save, encounter.role);
    if (targetDistance > range) return [];
    if (verticalDistance(player, enemy.position) > maxPlayerAttackFeetDelta)
      return [];
    const facing = facingToward(player, enemy.position);
    const inArc =
      Math.abs(normalizedAngle(facing - playerFacing)) <= Math.PI / 3;
    if (!autoFace && !inArc) return [];
    return [{ id: enemy.id, facing, distance: targetDistance }];
  });
  candidates.sort((first, second) => first.distance - second.distance);
  return candidates[0] ?? null;
}
