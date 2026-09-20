/**
 * Gameplay guards for authored levels that the structural validator in
 * `authored-level.ts` cannot express.
 *
 * `validateAuthoredLevelDocument` checks a document against itself: ids resolve,
 * the graph is connected, anchors sit on supported ground, arenas fit their
 * support platform. It has no way to check a document against a *scripted*
 * encounter, because the scripts live in the game runtime and are selected by
 * `routeId`, not by anything the document says.
 *
 * The Besties duo is the only such encounter today, and it is the one the level
 * editor makes dangerous: the editor lets an author move, resize or re-anchor
 * the boss court, while the duo's routine is authored in fixed local
 * coordinates around `BESTIES_ARENA_CENTER` and is merely *translated* to the
 * boss anchor. The routine provably overhangs the authored arena, so
 * `arena.outside-support` does not protect it.
 *
 * These guards are deliberately separate from the published validator: the four
 * shipped documents and their validation results must stay byte-for-byte and
 * issue-for-issue unchanged. Only the level editor's project validator calls
 * this module.
 */
import {
  AUTHORED_LEVEL_LIMITS,
  type AuthoredLevelDocument,
  type AuthoredLevelIssue,
  type AuthoredMovingPlatformPiece,
  type AuthoredPlatformPiece,
  type AuthoredPosition,
  type AuthoredSweeperPiece,
} from "./authored-level.js";

const EPSILON = 1e-6;

interface HorizontalBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

interface VerticalBounds {
  readonly minY: number;
  readonly maxY: number;
}

/**
 * The Besties routine's horizontal reach, expressed relative to the boss
 * anchor. Every number is measured from `src/game/besties.ts`, which keeps all
 * of it module-private; `src/shared` must not import `src/game`, so the values
 * are mirrored here *and pinned by a test* that drives the real
 * `BestiesSimulation` through every phase at both aim extremes and asserts each
 * emitted frame fits inside this box. If the routine changes, that test fails
 * rather than this guard silently going stale.
 *
 * Derivation (all local, then translated by `bossAnchor - BESTIES_ARENA_CENTER`):
 *
 * | element | source | Δx | Δz |
 * | --- | --- | --- | --- |
 * | actor anchors | `±pinkActorOffset.x` 1.25, high-five slide 0.8 inward, 0.45 trick step-in | ±1.25 | [0, +0.45] |
 * | foam bar, aimed | sweep x −5.4→+5.4, `foamHalfExtents` {0.3, ·, 1.35}, `pinkZ` clamp [−23.5, −19.5] | ±5.7 | [−2.85, +3.85] |
 * | floor lane, aimed | `blackX` clamp ±3.75, `laneHalfExtents` {2.25, ·, 3.75}, lane centre z −22.75 | ±6.0 | [−4.5, +3.00] |
 *
 * The union of the rendered geometry is x ±6.0, Δz [−4.5, +3.85]. Contact is
 * then resolved against that geometry expanded by `BESTIES_PLAYER_RADIUS`
 * (0.3), because the test compares the player's *centre* to an inflated box —
 * so the band a dodging player's centre can legitimately occupy is x ±6.3,
 * Δz [−4.8, +4.15]. That inflated band is what must be standable, and is what
 * this footprint records.
 */
export const BESTIES_ROUTINE_SUPPORT_FOOTPRINT: HorizontalBounds = Object.freeze({
  minX: -6.3,
  maxX: 6.3,
  minZ: -4.8,
  maxZ: 4.15,
});

/**
 * Levels whose boss slot runs the Besties routine.
 *
 * Nothing in a level document declares this. At runtime the duo is selected by
 * `content.assetId === "bickering-besties"`, which the parody catalog attaches
 * to the `besties-obby-v1` period, which `selectRouteMemoryLevel` maps to one of
 * these two route ids. A test pins that derivation for both shipped catalog
 * versions, so adding a third Besties-hosting route without updating this set
 * fails a check instead of silently shipping an unguarded court.
 *
 * When the editor decouples route ids from the published enum, this should
 * become an explicit per-level field rather than an allowlist — the same fix
 * `bossRequiresOrdinaryDefeats`'s silent legacy default needs. Until then,
 * `hostsBestiesRoutine` is the override seam.
 */
export const BESTIES_ROUTINE_LEVEL_IDS: readonly string[] = Object.freeze([
  "besties-playground-v1",
  "besties-playground-v2",
]);

export interface EditorGameplayGuardOptions {
  /**
   * Overrides the id-based lookup. Set it when a document's boss slot is known
   * to run (or not run) the Besties routine for a reason the id cannot carry.
   */
  readonly hostsBestiesRoutine?: boolean;
}

function staticPlatformBounds(
  platform: AuthoredPlatformPiece | AuthoredMovingPlatformPiece,
): HorizontalBounds {
  return {
    minX: platform.center.x - platform.size.x / 2,
    maxX: platform.center.x + platform.size.x / 2,
    minZ: platform.center.z - platform.size.z / 2,
    maxZ: platform.center.z + platform.size.z / 2,
  };
}

function platformTop(
  platform: AuthoredPlatformPiece | AuthoredMovingPlatformPiece,
): number {
  return platform.center.y + platform.size.y / 2;
}

function platformVerticalBounds(
  platform: AuthoredPlatformPiece | AuthoredMovingPlatformPiece,
): VerticalBounds {
  return {
    minY: platform.center.y - platform.size.y / 2,
    maxY: platform.center.y + platform.size.y / 2,
  };
}

function sweeperVerticalBounds(hazard: AuthoredSweeperPiece): VerticalBounds {
  return {
    minY: hazard.center.y - hazard.radius,
    maxY: hazard.center.y + hazard.radius,
  };
}

/** Full travel envelope of a moving platform, both directions on its axis. */
function movingPlatformEnvelope(
  platform: AuthoredMovingPlatformPiece,
): HorizontalBounds {
  const bounds = staticPlatformBounds(platform);
  const travelX = platform.motion.axis === "x" ? platform.motion.distance : 0;
  const travelZ = platform.motion.axis === "z" ? platform.motion.distance : 0;
  return {
    minX: bounds.minX - travelX,
    maxX: bounds.maxX + travelX,
    minZ: bounds.minZ - travelZ,
    maxZ: bounds.maxZ + travelZ,
  };
}

/**
 * Swing-and-travel envelope of a sweeper. Mirrors the published validator's own
 * `hazardEnvelope`: a rotating sweeper reaches `halfLength + radius` on both
 * axes, a fixed one only reaches `radius` across its bar.
 */
function sweeperEnvelope(hazard: AuthoredSweeperPiece): HorizontalBounds {
  const travelX = hazard.motion?.axis === "x" ? hazard.motion.distance : 0;
  const travelZ = hazard.motion?.axis === "z" ? hazard.motion.distance : 0;
  const reachX = hazard.halfLength + hazard.radius;
  const reachZ = hazard.rotation ? hazard.halfLength + hazard.radius : hazard.radius;
  return {
    minX: hazard.center.x - travelX - reachX,
    maxX: hazard.center.x + travelX + reachX,
    minZ: hazard.center.z - travelZ - reachZ,
    maxZ: hazard.center.z + travelZ + reachZ,
  };
}

function translateFootprint(
  footprint: HorizontalBounds,
  anchor: AuthoredPosition,
): HorizontalBounds {
  return {
    minX: anchor.x + footprint.minX,
    maxX: anchor.x + footprint.maxX,
    minZ: anchor.z + footprint.minZ,
    maxZ: anchor.z + footprint.maxZ,
  };
}

function rectangleContains(
  outer: HorizontalBounds,
  inner: HorizontalBounds,
  clearance: number,
): boolean {
  return (
    inner.minX >= outer.minX + clearance - EPSILON &&
    inner.maxX <= outer.maxX - clearance + EPSILON &&
    inner.minZ >= outer.minZ + clearance - EPSILON &&
    inner.maxZ <= outer.maxZ - clearance + EPSILON
  );
}

function rectanglesHaveInteriorOverlap(
  first: HorizontalBounds,
  second: HorizontalBounds,
): boolean {
  return (
    Math.min(first.maxX, second.maxX) - Math.max(first.minX, second.minX) > EPSILON &&
    Math.min(first.maxZ, second.maxZ) - Math.max(first.minZ, second.minZ) > EPSILON
  );
}

function verticalBoundsHaveInteriorOverlap(
  first: VerticalBounds,
  second: VerticalBounds,
): boolean {
  return (
    Math.min(first.maxY, second.maxY) - Math.max(first.minY, second.minY) >
    EPSILON
  );
}

function describeBounds(bounds: HorizontalBounds): string {
  const round = (value: number): string => String(Number(value.toFixed(6)));
  return `x[${round(bounds.minX)}, ${round(bounds.maxX)}] z[${round(bounds.minZ)}, ${round(bounds.maxZ)}]`;
}

function hostsBestiesRoutine(
  document: AuthoredLevelDocument,
  options: EditorGameplayGuardOptions,
): boolean {
  return options.hostsBestiesRoutine ?? BESTIES_ROUTINE_LEVEL_IDS.includes(document.id);
}

/**
 * Gameplay guards the level editor applies on top of
 * `validateAuthoredLevelDocument`. Pure, allocation-light and order-stable:
 * issues come back sorted by `path` then `code`, matching the published
 * validator's contract so both lists can be concatenated and rendered together.
 *
 * A document that is semantically invalid is still accepted here — the editor
 * keeps repairable drafts (ADR003 C-05) — so every lookup degrades to "skip this
 * check" rather than throwing.
 */
export function validateEditorGameplayGuards(
  document: AuthoredLevelDocument,
  options: EditorGameplayGuardOptions = {},
): AuthoredLevelIssue[] {
  const issues: AuthoredLevelIssue[] = [];
  if (hostsBestiesRoutine(document, options)) {
    collectBestiesCourtIssues(document, issues);
  }
  return issues.sort(
    (left, right) =>
      left.path.localeCompare(right.path) || left.code.localeCompare(right.code),
  );
}

function collectBestiesCourtIssues(
  document: AuthoredLevelDocument,
  issues: AuthoredLevelIssue[],
): void {
  const boss = document.anchors?.encounters?.boss;
  if (!boss) return;
  const path = '$.anchors.encounters["boss"]';

  const statics = new Map<string, AuthoredPlatformPiece>();
  const moving: AuthoredMovingPlatformPiece[] = [];
  const sweepers: AuthoredSweeperPiece[] = [];
  for (const piece of document.pieces) {
    if (piece.type === "platform") statics.set(piece.id, piece);
    else if (piece.type === "moving-platform") moving.push(piece);
    else if (piece.type === "sweeper") sweepers.push(piece);
  }

  const support = statics.get(boss.platformId);
  // A missing or non-static support already raises `reference.static-platform`.
  if (!support) return;

  const footprint = translateFootprint(BESTIES_ROUTINE_SUPPORT_FOOTPRINT, boss.position);
  const clearance = AUTHORED_LEVEL_LIMITS.supportEdgeClearance;
  const supportBounds = staticPlatformBounds(support);
  if (!rectangleContains(supportBounds, footprint, clearance)) {
    issues.push({
      path: `${path}.position`,
      code: "besties.support-footprint",
      message:
        `The Besties routine sweeps ${describeBounds(footprint)}, which must fit ` +
        `${JSON.stringify(boss.platformId)} with ${clearance}m edge clearance. ` +
        "Move the boss anchor and its support platform together, or widen the platform.",
    });
  }

  const supportTop = platformTop(support);
  const actorBand: VerticalBounds = {
    minY: supportTop,
    maxY: supportTop + AUTHORED_LEVEL_LIMITS.actorHeight,
  };
  for (const piece of statics.values()) {
    if (piece.id === support.id) continue;
    if (!rectanglesHaveInteriorOverlap(staticPlatformBounds(piece), footprint)) continue;
    if (!verticalBoundsHaveInteriorOverlap(platformVerticalBounds(piece), actorBand))
      continue;
    // Contact is gated on the player's feet staying within 0.35m of the arena
    // origin, and every hazard is drawn on the support surface. A platform
    // protruding into the actor-height band makes the duo un-hittable from it
    // and floats the floor lane. Geometry wholly below the floor or above the
    // avatar's head cannot obstruct this routine.
    issues.push({
      path: `${path}.position`,
      code: "besties.footprint-height",
      message:
        `Platform ${JSON.stringify(piece.id)} stands above ` +
        `${JSON.stringify(boss.platformId)} inside the Besties routine footprint ` +
        `${describeBounds(footprint)}; the routine needs one flat support surface.`,
    });
  }

  for (const piece of moving) {
    if (!rectanglesHaveInteriorOverlap(movingPlatformEnvelope(piece), footprint)) continue;
    if (!verticalBoundsHaveInteriorOverlap(platformVerticalBounds(piece), actorBand))
      continue;
    issues.push({
      path: `${path}.position`,
      code: "besties.footprint-obstructed",
      message:
        `Moving platform ${JSON.stringify(piece.id)} travels through the Besties routine ` +
        `footprint ${describeBounds(footprint)}.`,
    });
  }
  for (const piece of sweepers) {
    if (!rectanglesHaveInteriorOverlap(sweeperEnvelope(piece), footprint)) continue;
    if (!verticalBoundsHaveInteriorOverlap(sweeperVerticalBounds(piece), actorBand))
      continue;
    issues.push({
      path: `${path}.position`,
      code: "besties.footprint-obstructed",
      message:
        `Sweeper ${JSON.stringify(piece.id)} swings through the Besties routine ` +
        `footprint ${describeBounds(footprint)}.`,
    });
  }
}
