import type { EncounterView, SaveView } from "../shared/contracts";
import type { EncounterPlacement, LevelLayout } from "./level";
import type { EnemyFrame, EnemyPhase, PositionSnapshot } from "./types";

type RuntimeEncounterView = EncounterView & { available?: boolean };

export const enemyActivationRadius = 6;
export const enemyStrikeSeconds = 0.18;
export const enemyCooldownSeconds = 1.4;
export const playerHitCooldownSeconds = 0.9;

const maxEnemyContactFeetDelta = 0.3;
const maxPlayerAttackFeetDelta = 1;

type EnemyArena = NonNullable<EncounterPlacement["arena"]>;

interface EnemyTuning {
  speed: number;
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
  contactedDuringStrike: boolean;
  hp: number;
  maxHp: number;
  defeated: boolean;
}

export interface EnemyStepOptions {
  player: PositionSnapshot;
  deltaSeconds: number;
  active: boolean;
}

const ordinaryTuning: EnemyTuning = {
  speed: 0.85,
  stopRange: 1.1,
  attackRange: 1.35,
  windupSeconds: 0.8,
  collisionRadius: 0.42,
};
const bossTuning: EnemyTuning = {
  speed: 0.65,
  stopRange: 1.5,
  attackRange: 1.75,
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

export function bossIsActive(save: SaveView): boolean {
  const encounters = save.adventure?.activeLevel?.encounters ?? [];
  const ordinaryDefeated = encounters
    .filter((encounter) => encounter.role === "ordinary")
    .every((encounter) => encounter.defeated);
  const boss = encounters.find((encounter) => encounter.role === "boss") as
    RuntimeEncounterView | undefined;
  return ordinaryDefeated && boss?.available !== false;
}

export class EnemySimulation {
  private enemies = new Map<string, LocalEnemy>();
  private hitCooldownSeconds = 0;

  constructor(level: LevelLayout, save: SaveView) {
    this.reset(level, save);
  }

  reset(level: LevelLayout, save: SaveView): void {
    this.enemies.clear();
    const authoritative = encounterMap(save);
    for (const placement of level.encounters) {
      const encounter = authoritative.get(placement.id);
      if (!encounter) continue;
      this.addEnemy(placement, encounter);
    }
    this.hitCooldownSeconds = 0;
  }

  sync(level: LevelLayout, save: SaveView): void {
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
        clampToArena(current.position, current.arena);
      }
      const revived = current.defeated && !encounter.defeated;
      current.hp = encounter.hp;
      current.maxHp = encounter.maxHp;
      current.defeated = encounter.defeated;
      if (encounter.defeated) {
        current.phase = "defeated";
        current.phaseSeconds = 0;
        current.contactedDuringStrike = false;
      } else if (revived) {
        current.spawn = spawnFor(placement, current.arena);
        current.position = { ...current.spawn };
        current.facing = 0;
        current.phase = "idle";
        current.phaseSeconds = 0;
        current.contactedDuringStrike = false;
        this.hitCooldownSeconds = 0;
      }
    }
  }

  restartThreatenedAttacks(): void {
    for (const enemy of this.enemies.values()) {
      if (enemy.phase !== "windup" && enemy.phase !== "strike") continue;
      enemy.phase = "windup";
      enemy.phaseSeconds = 0;
      enemy.contactedDuringStrike = false;
    }
  }

  step(options: EnemyStepOptions, save: SaveView): string[] {
    if (!options.active) return [];
    const dt = Math.max(0, Math.min(0.05, options.deltaSeconds));
    this.hitCooldownSeconds = Math.max(0, this.hitCooldownSeconds - dt);
    const contacts: string[] = [];
    const bossActive = bossIsActive(save);
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
      const tuning = tuningFor(enemy.role);
      const playerDistance = distance(enemy.position, options.player);
      enemy.facing = facingToward(enemy.position, options.player);
      switch (enemy.phase) {
        case "idle":
          if (playerDistance <= enemyActivationRadius) {
            enemy.phase = "chasing";
            enemy.phaseSeconds = 0;
          }
          break;
        case "chasing":
          if (playerDistance > enemyActivationRadius) {
            enemy.phase = "idle";
            enemy.phaseSeconds = 0;
          } else if (playerDistance <= tuning.stopRange) {
            enemy.phase = "windup";
            enemy.phaseSeconds = 0;
          } else {
            const travel = Math.min(
              tuning.speed * dt,
              Math.max(0, playerDistance - tuning.stopRange),
            );
            if (playerDistance > 0) {
              enemy.position.x +=
                ((options.player.x - enemy.position.x) / playerDistance) *
                travel;
              enemy.position.z +=
                ((options.player.z - enemy.position.z) / playerDistance) *
                travel;
              clampToArena(enemy.position, enemy.arena);
            }
          }
          break;
        case "windup":
          if (playerDistance > tuning.attackRange) {
            enemy.phase = "chasing";
            enemy.phaseSeconds = 0;
          } else {
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
            verticalDistance(options.player, enemy.position) <=
              maxEnemyContactFeetDelta &&
            this.hitCooldownSeconds <= 0
          ) {
            contacts.push(enemy.id);
            enemy.contactedDuringStrike = true;
          }
          enemy.phaseSeconds += dt;
          if (enemy.phaseSeconds >= enemyStrikeSeconds) {
            enemy.phase = "cooldown";
            enemy.phaseSeconds = 0;
          }
          break;
        case "cooldown":
          enemy.phaseSeconds += dt;
          if (enemy.phaseSeconds >= enemyCooldownSeconds) {
            enemy.phase =
              playerDistance <= enemyActivationRadius ? "chasing" : "idle";
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
      };
    });
  }

  resolvePlayerCollision(position: PositionSnapshot, level: LevelLayout): void {
    for (const enemy of this.enemies.values()) {
      if (enemy.defeated) continue;
      if (verticalDistance(position, enemy.position) > maxEnemyContactFeetDelta)
        continue;
      const minimumDistance = tuningFor(enemy.role).collisionRadius + 0.25;
      const dx = position.x - enemy.position.x;
      const dz = position.z - enemy.position.z;
      const currentDistance = Math.hypot(dx, dz);
      if (currentDistance >= minimumDistance) continue;
      const normalX = currentDistance > 0.0001 ? dx / currentDistance : 0;
      const normalZ = currentDistance > 0.0001 ? dz / currentDistance : 1;
      position.x = Math.max(
        level.minX,
        Math.min(level.maxX, enemy.position.x + normalX * minimumDistance),
      );
      position.z = Math.max(
        level.minZ,
        Math.min(level.maxZ, enemy.position.z + normalZ * minimumDistance),
      );
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
      contactedDuringStrike: false,
      hp: encounter.hp,
      maxHp: encounter.maxHp,
      defeated: encounter.defeated,
    });
  }
}

export interface AttackTarget {
  id: string;
  facing: number;
  distance: number;
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
    const range = encounter.role === "boss" ? 2 : 1.7;
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
