/**
 * World B, chapter 3: Besties' Big Stage (PLAN-019, blueprint B3 as amended
 * by the coordinator rulings R1–R14 and the critique's B3 items).
 *
 * A pure, deterministic generator: `familyB3Level()` returns the complete
 * authored-level-v4 document for route `family-b3-stage`. The World B
 * assembler replaces the chapter's level with it
 * (`chapterCommands(id).replaceLevel(familyB3Level())`) and assigns the cast
 * below. Nothing here applies, validates or bypasses anything; the shared
 * validator and the family-world lints stay the authority
 * (`tests/levels/family-b3.test.ts`).
 *
 * The chapter upgrades the Besties playground (`besties-playground-v2`) into
 * the grandest World B chapter: a concert stage 11.3 m up (R8). It runs as an
 * S in three acts, so the required route is long (R10) without ever heading
 * toward the camera (R3):
 *
 * 1. Toward -z at x≈0: the stage-door plaza opens onto the **fan walk** (R9),
 *    then two double-jump rungs over a soft practice floor (the new move, with
 *    a free double-jump crate beside them), the fan picnic (guard tool,
 *    fight 1), the ribbon runway's padded bar, the bandstand (fight 2), two
 *    relay hops and the Encore Trampoline up to the fan balcony (+2 m).
 * 2. Sideways toward +x: the speaker raft, the raft dock, the amp hops or the
 *    friend-balcony side path, the glitter grove (minor memory one, then
 *    fight 3), the turnstile and the merch fair (fight 4), so both late fights
 *    are a short retry from minor one (R5). Then the Confetti Cannon pops the
 *    player up to the sky bleachers, the catwalk and three glow-stick hops.
 * 3. Toward -z again at x≈103: the crowd bridge, the lift dock, the **rising
 *    stage lift** (+3.8 m, the chapter's signature, with dwell at both stops,
 *    R6), the stage wing (minor memory two, a short boss retry, R5), two stage
 *    stairs, the main stage (the Besties) and the encore riser, where the major
 *    memory ends the chapter (R1). The optional lighting rig climbs beside the
 *    lift with three double jumps to the golden perch.
 *
 * Template lineage: party-welcome became stage-door-plaza,
 * besties-practice-ground soft-practice-floor, party-terrace-3
 * spotlight-riser, besties-practice-down-1 rehearsal-loft, party-picnic
 * fan-picnic, ribbon-lane ribbon-runway, ribbon-rest ribbon-bandstand,
 * party-ferry speaker-raft, party-dock raft-dock, zigzag-hop-1/2 amp-hop-1/2,
 * party-grove glitter-grove, party-fair merch-fair, final-hop-1/2
 * stage-stair-1/2, besties-court main-stage and party-reward encore-riser.
 * The turnstile deck, the side path, both sweepers and all eight template
 * checkpoint ids keep their names.
 *
 * Every static deck is a tower from the course ground plane (y = -1.4) to its
 * standing top, so a landing's wall always reaches down past any pad beside
 * it (R2). The practice riser, loft and toy crate stand on the soft floor.
 */
import type {
  AuthoredCheckpointPiece,
  AuthoredConnection,
  AuthoredDecor,
  AuthoredEncounterAnchor,
  AuthoredLevelAnchors,
  AuthoredLevelPiece,
  AuthoredMovingPlatformPiece,
  AuthoredPlatformPiece,
  AuthoredSweeperPiece,
} from "../../../src/shared/authored-level.js";
import type {
  LevelEditorEnemyCandidate,
  LevelEditorEncounterReference,
  WorldEditorLevelDocument,
} from "../../../src/shared/editor-project.js";
import { BESTIES_PARENT_LOCK_FROM } from "../../../src/shared/parody-catalog.js";
import {
  bounce,
  bouncePad,
  drop,
  jump,
  lift,
  mm,
  platform,
  platformCheckpoint,
  ride,
  walk,
} from "../lib/growth-kit.js";
import {
  FAMILY_B3_HEIGHTS as H,
  FLOOR_BOTTOM,
  GROUND,
  familyB3Decor,
  r3,
  s2,
  s3,
  x3,
  z2,
  z3,
  type Range,
} from "./lib-b3.js";

export { FAMILY_B3_HEIGHTS } from "./lib-b3.js";

/** The chapter's route id; the level document's id. */
export const FAMILY_B3_ROUTE_ID = "family-b3-stage";
/** Recovered ages the chapter spans (World B, chapter 3). */
export const FAMILY_B3_AGES = Object.freeze({ fromYears: 4, toYears: 6 });

/** Final coordinator copy (WORLD-SPEC, verbatim). */
export const FAMILY_B3_COPY = Object.freeze({
  name: "Besties' Big Stage",
  subtitle: "Sparkles, stages and a missed high-five",
  description:
    "Dance past the demon idols and help the Besties finally land their high-five.",
  theme: "party" as const,
  periodId: "besties-obby-v1" as const,
});

/**
 * The Demon Idol's parent-locked window start (WORLD-SPEC: "the chapter spans
 * the 2025 debut"). The chapter starts on the child's fourth birthday, which
 * precedes 2024 for every six-year-old born before 2020, but it always closes
 * on a birthday after the debut. The lock reaches back to the Besties' own
 * parent lock in parody-catalog-v9, so the chapter's whole cast opens on one
 * date and World B serves every child born on or after 2018-07-31 (v1 opened
 * on 2024-01-01 and dropped late-2019 birthdays).
 */
export const FAMILY_B3_CAST_WINDOW_FROM = BESTIES_PARENT_LOCK_FROM;

/**
 * The chapter's one ordinary identity (WORLD-SPEC cast table): a project
 * candidate with neutral placeholder art until its catalog model lands. All
 * four ordinary anchors use its kind (R11).
 */
export const FAMILY_B3_ORDINARY: LevelEditorEnemyCandidate = Object.freeze({
  id: "demon-band-idol",
  name: "Demon Idol",
  periodId: "besties-obby-v1",
  recognizableReference: "a sparkly demon boy-band idol (clean)",
  visualJoke: "strikes a pose mid-fight",
  obstacleOrAttack: "microphone spin",
  eligibility: Object.freeze({ startDate: FAMILY_B3_CAST_WINDOW_FROM, endDate: "2026-12-31" }),
  role: "ordinary",
  kind: "ordinary-a",
  behaviorPreset: "ordinary-a",
});

/** The catalog Besties boss the chapter keeps (the bestie pair). */
export const FAMILY_B3_BOSS: LevelEditorEncounterReference = Object.freeze({
  source: "catalog",
  catalogEntryId: "bickering-besties",
  catalogEntryVersion: "v001",
});

// ---------------------------------------------------------------------------
// Geometry helpers. Ranges are [min, max] in metres; every value is rounded to
// the millimetre by growth-kit, so the output carries no float noise.
// ---------------------------------------------------------------------------

/** A static deck spanning `x` × `z` whose top face sits at `top`. */
function deck(
  id: string,
  x: Range,
  z: Range,
  top: number,
  bottom = GROUND,
): AuthoredPlatformPiece {
  return platform(id, {
    x: (x[0] + x[1]) / 2,
    z: (z[0] + z[1]) / 2,
    sizeX: x[1] - x[0],
    sizeZ: z[1] - z[0],
    top,
    thickness: top - bottom,
  });
}

function arena(x: Range, z: Range) {
  return { minX: x[0], maxX: x[1], minZ: z[0], maxZ: z[1] };
}

function at(x: number, y: number, z: number) {
  return { x: mm(x), y: mm(y), z: mm(z) };
}

function ordinary(
  platformId: string,
  position: ReturnType<typeof at>,
  arenaX: Range,
  arenaZ: Range,
  checkpointId: string,
): AuthoredEncounterAnchor {
  return {
    platformId,
    position,
    // One ordinary identity in all four slots (R11).
    kind: "ordinary-a",
    checkpointId,
    arena: arena(arenaX, arenaZ),
  };
}

/** A sweeper bar lying along x, 0.22 m above its deck's top like the template's. */
function bar(
  id: string,
  x: number,
  deckTop: number,
  z: number,
  options: {
    readonly halfLength: number;
    readonly motion?: AuthoredSweeperPiece["motion"];
    readonly rotation?: AuthoredSweeperPiece["rotation"];
  },
): AuthoredSweeperPiece {
  return {
    type: "sweeper",
    id,
    center: at(x, deckTop + 0.22, z),
    halfLength: options.halfLength,
    radius: 0.18,
    ...(options.motion ? { motion: options.motion } : {}),
    ...(options.rotation ? { rotation: options.rotation } : {}),
  };
}

// Stage lift: flush landings (0.15 m gaps), the dock 0.1 m above the bottom
// stop and the wing 0.1 m below the top stop, so a walking child steps down
// onto the lift and down off it (R6). Dwell 2 s at each stop, 8 s of travel.
// The riser is 3.1 m deep (v2), like B2's garden lift: at its top stop its
// underside hangs 0.6 m above the dock, lower than the infant avatar (0.88 m),
// so a child who walks at the empty shaft meets the riser's side instead of
// falling in.
const LIFT = Object.freeze({
  x: r3(-1.6, 1.6),
  z: s3(-22.55, -19.35),
  period: 8,
  dwell: 2,
  thickness: 3.1,
});

function pieces(): AuthoredLevelPiece[] {
  const liftPiece = lift("stage-lift", {
    x: (LIFT.x[0] + LIFT.x[1]) / 2,
    z: (LIFT.z[0] + LIFT.z[1]) / 2,
    sizeX: LIFT.x[1] - LIFT.x[0],
    sizeZ: LIFT.z[1] - LIFT.z[0],
    bottomTop: H.liftBottom,
    distance: H.liftTop - H.liftBottom,
    period: LIFT.period,
    dwell: LIFT.dwell,
    thickness: LIFT.thickness,
  });
  const raft: AuthoredMovingPlatformPiece = {
    type: "moving-platform",
    id: "speaker-raft",
    center: at(3.3, H.balcony - 0.3, z2(0)),
    size: at(3.6, 0.6, 4),
    // Wobbles along z while the route crosses it along x.
    motion: { axis: "z", distance: 1, period: 10 },
  };
  const checkpoint = (
    id: string,
    platformId: string,
    x: number,
    y: number,
    z: number,
  ): AuthoredCheckpointPiece => platformCheckpoint(id, platformId, at(x, y, z));

  // Pieces are listed in route order, each checkpoint right after its deck,
  // so the checkpoint array reads in route order too.
  return [
    // Act 1 — the stage door and the fan walk (L0).
    deck("stage-door-plaza", [-5, 5], [-4, 4], H.plaza),
    checkpoint("party-start", "stage-door-plaza", 0, H.plaza, 1),
    deck("fan-walk", [-2.5, 2.5], [-28, -4], H.plaza),
    // Double-jump practice over the soft floor. The floor reaches 0.3 m under
    // the fan walk so it contains rung 1's whole gateway corridor.
    deck("soft-practice-floor", [-8, 8], [-38, -27.7], H.floor, FLOOR_BOTTOM),
    deck("confetti-crate", [-3.8, -1.4], [-30.8, -28.4], H.riser, FLOOR_BOTTOM),
    deck("spotlight-riser", [-0.4, 5.2], [-32.2, -28.6], H.riser, FLOOR_BOTTOM),
    deck("rehearsal-loft", [-4.7, 2.3], [-37.7, -32.7], H.loft, FLOOR_BOTTOM),
    checkpoint("rehearsal-loft-safe", "rehearsal-loft", -1.2, H.loft, -33.4),
    // L1: the fan picnic, the ribbon runway, the bandstand and its relay hops.
    deck("fan-picnic", [-7, 7], [-49.5, -38.5], H.picnic),
    checkpoint("party-picnic-safe", "fan-picnic", -3, H.picnic, -39.4),
    deck("ribbon-runway", [-6.5, 0.5], [-57.3, -50.3], H.picnic),
    bar("ribbon-padded-bar", -3, H.picnic, -53.8, {
      halfLength: 1,
      motion: { axis: "x", distance: 2, period: 10 },
    }),
    deck("ribbon-bandstand", [-9, 3], [-68.1, -58.1], H.bandstand),
    checkpoint("ribbon-safe", "ribbon-bandstand", 1.6, H.bandstand, -59),
    deck("relay-hop-1", [-6.4, -2], [-71.7, -68.9], H.bandstand),
    deck("relay-hop-2", [-4, 0.4], [-75.3, -72.5], H.bandstand),
    // The Encore Trampoline: flush with its deck, 0.35 m short of the
    // balcony, whose tower wall reaches down past the pad (R2).
    deck("bounce-deck", [-5, -1], [-79.7, -76.1], H.bandstand),
    checkpoint("bounce-deck-safe", "bounce-deck", -3, H.bandstand, -76.8),
    bouncePad("encore-trampoline", {
      x: -3,
      z: -80.9,
      sizeX: 4,
      sizeZ: 2.4,
      top: H.bandstand,
      thickness: H.bandstand - GROUND,
      strength: "big",
    }),
    deck("fan-balcony", [-7, 1], s2(-2.5, 2.5), H.balcony),
    checkpoint("fan-balcony-safe", "fan-balcony", -5.4, H.balcony, z2(0)),
    // Act 2 — sideways (+x) across the speaker raft (L2).
    raft,
    deck("raft-dock", [5.6, 13.6], s2(-4, 4), H.balcony),
    checkpoint("party-dock-safe", "raft-dock", 7, H.balcony, z2(2.75)),
    deck("amp-hop-1", [14.6, 18.2], s2(-6.25, -1.25), H.hops),
    deck("amp-hop-2", [19.2, 22.8], s2(-8.25, -3.25), H.hops),
    // The friend-balcony side path (walks, then a 0.3 m hop up to the grove),
    // on the camera side of the hops.
    deck("wide-side-bridge", [13.6, 19.6], s2(-0.25, 4.75), H.balcony),
    deck("friend-balcony", [19.6, 23.8], s2(-0.25, 4.75), H.balcony),
    deck("glitter-grove", [23.8, 35.8], s2(-10.25, 2.75), H.hops),
    checkpoint("party-grove-safe", "glitter-grove", 25.2, H.hops, z2(1.55)),
    deck("turnstile-deck", [36.8, 46.8], s2(-8.25, -0.25), H.hops),
    bar("party-turnstile", 41.8, H.hops, z2(-4.25), {
      halfLength: 1.15,
      rotation: { period: 14 },
    }),
    // Fight 4 follows fight 3 closely, both a short retry from minor one (R5).
    deck("merch-fair", [47.6, 59.6], s2(-11, 0), H.hops),
    checkpoint("party-fair-safe", "merch-fair", 48.8, H.hops, z2(-9.8)),
    // The Confetti Cannon: a small pad pops the player one tier up to the
    // sky bleachers (same 0.35 m gap and full-height wall as the trampoline).
    deck("cannon-deck", [60.4, 64.4], s2(-6.25, -2.25), H.hops),
    checkpoint("cannon-deck-safe", "cannon-deck", 61.4, H.hops, z2(-4.25)),
    bouncePad("confetti-cannon", {
      x: 65.6,
      z: z2(-4.25),
      sizeX: 2.4,
      sizeZ: 4,
      top: H.hops,
      thickness: H.hops - GROUND,
      strength: "small",
    }),
    deck("sky-bleachers", [67.15, 75.15], s2(-7.25, -1.25), H.sky),
    checkpoint("sky-bleachers-safe", "sky-bleachers", 69, H.sky, z2(-4.25)),
    deck("sky-catwalk", [75.15, 91.15], s2(-6.25, -2.25), H.sky),
    deck("glow-hop-1", [91.95, 95.55], s2(-7.75, -2.75), H.sky),
    deck("glow-hop-2", [96.35, 99.95], s2(-9.25, -4.25), H.sky),
    deck("glow-hop-3", [100.75, 104.35], s2(-10.75, -5.75), H.sky),
    // Act 3 — the rising stage (L2 → L3), toward -z again.
    deck("crowd-bridge", r3(-2.5, 2.5), s3(-14.8, -0.8), H.sky),
    deck("lift-dock", r3(-4, 4), s3(-19.2, -14.8), H.sky),
    checkpoint("lift-dock-safe", "lift-dock", x3(0), H.sky, z3(-15.6)),
    liftPiece,
    // The lighting rig: an optional double-jump climb beside the lift shaft.
    deck("rig-truss-1", r3(-7.6, -5), s3(-18.9, -16.3), 8.0),
    deck("rig-truss-2", r3(-7.6, -5), s3(-22.7, -20.1), 9.2),
    deck("golden-perch", r3(-7.8, -4.8), s3(-26.9, -23.9), 10.1),
    deck("stage-wing", r3(-4, 4), s3(-27.1, -22.7), H.wing),
    checkpoint("stage-wing-safe", "stage-wing", x3(-2.6), H.wing, z3(-23.5)),
    deck("stage-stair-1", r3(-3.4, 1), s3(-30.9, -28.1), H.stair1),
    deck("stage-stair-2", r3(-1, 3.4), s3(-34.5, -31.7), H.stair2),
    deck("main-stage", r3(-8, 8), s3(-55.3, -35.3), H.stage),
    checkpoint("besties-safe", "main-stage", x3(0), H.stage, z3(-36.4)),
    deck("encore-riser", r3(-6, 6), s3(-61.3, -55.3), H.stage),
    checkpoint("party-reward-safe", "encore-riser", x3(0), H.stage, z3(-56.8)),
  ];
}

function connections(): AuthoredConnection[] {
  const floor = "soft-practice-floor";
  return [
    // Act 1.
    walk("stage-door-plaza", "fan-walk"),
    // The chapter's only required double jumps: two rungs over the floor.
    jump("fan-walk", "spotlight-riser", { requires: "double-jump", safeMissPlatformId: floor }),
    jump("spotlight-riser", "rehearsal-loft", {
      requires: "double-jump",
      safeMissPlatformId: floor,
    }),
    // Practice retry: hop from the floor back onto the fan walk.
    jump(floor, "fan-walk"),
    // The free double-jump crate beside rung 1 (an optional branch).
    jump("fan-walk", "confetti-crate", { requires: "double-jump" }),
    jump("confetti-crate", "rehearsal-loft", { requires: "double-jump" }),
    drop("confetti-crate", floor),
    jump("rehearsal-loft", "fan-picnic"),
    jump("fan-picnic", "ribbon-runway"),
    jump("ribbon-runway", "ribbon-bandstand"),
    jump("ribbon-bandstand", "relay-hop-1"),
    jump("relay-hop-1", "relay-hop-2"),
    jump("relay-hop-2", "bounce-deck"),
    walk("bounce-deck", "encore-trampoline"),
    bounce("encore-trampoline", "fan-balcony"),
    // Act 2.
    ride("fan-balcony", "speaker-raft"),
    ride("speaker-raft", "raft-dock"),
    jump("raft-dock", "amp-hop-1"),
    jump("amp-hop-1", "amp-hop-2"),
    jump("amp-hop-2", "glitter-grove"),
    walk("raft-dock", "wide-side-bridge"),
    walk("wide-side-bridge", "friend-balcony"),
    jump("friend-balcony", "glitter-grove"),
    jump("glitter-grove", "turnstile-deck"),
    jump("turnstile-deck", "merch-fair"),
    jump("merch-fair", "cannon-deck"),
    walk("cannon-deck", "confetti-cannon"),
    bounce("confetti-cannon", "sky-bleachers"),
    walk("sky-bleachers", "sky-catwalk"),
    jump("sky-catwalk", "glow-hop-1"),
    jump("glow-hop-1", "glow-hop-2"),
    jump("glow-hop-2", "glow-hop-3"),
    jump("glow-hop-3", "crowd-bridge"),
    // Act 3.
    walk("crowd-bridge", "lift-dock"),
    ride("lift-dock", "stage-lift"),
    ride("stage-lift", "stage-wing"),
    jump("lift-dock", "rig-truss-1", { requires: "double-jump" }),
    jump("rig-truss-1", "rig-truss-2", { requires: "double-jump" }),
    jump("rig-truss-2", "golden-perch", { requires: "double-jump" }),
    jump("golden-perch", "stage-wing"),
    jump("stage-wing", "stage-stair-1"),
    jump("stage-stair-1", "stage-stair-2"),
    jump("stage-stair-2", "main-stage"),
    walk("main-stage", "encore-riser"),
  ];
}

export const FAMILY_B3_MAIN_PATH: readonly string[] = Object.freeze([
  "stage-door-plaza",
  "fan-walk",
  "spotlight-riser",
  "rehearsal-loft",
  "fan-picnic",
  "ribbon-runway",
  "ribbon-bandstand",
  "relay-hop-1",
  "relay-hop-2",
  "bounce-deck",
  "encore-trampoline",
  "fan-balcony",
  "speaker-raft",
  "raft-dock",
  "amp-hop-1",
  "amp-hop-2",
  "glitter-grove",
  "turnstile-deck",
  "merch-fair",
  "cannon-deck",
  "confetti-cannon",
  "sky-bleachers",
  "sky-catwalk",
  "glow-hop-1",
  "glow-hop-2",
  "glow-hop-3",
  "crowd-bridge",
  "lift-dock",
  "stage-lift",
  "stage-wing",
  "stage-stair-1",
  "stage-stair-2",
  "main-stage",
  "encore-riser",
]);

/**
 * Branch 0 is the golden lighting rig (ticket 1); branch 1 the friend-balcony
 * walk (friendly-2); branch 2 the double-jump crate beside the practice rungs.
 */
export const FAMILY_B3_BRANCHES: readonly (readonly string[])[] = Object.freeze([
  Object.freeze(["lift-dock", "rig-truss-1", "rig-truss-2", "golden-perch", "stage-wing"]),
  Object.freeze(["raft-dock", "wide-side-bridge", "friend-balcony", "glitter-grove"]),
  Object.freeze(["fan-walk", "confetti-crate", "rehearsal-loft"]),
]);

function anchors(): AuthoredLevelAnchors {
  return {
    spawn: { platformId: "stage-door-plaza", position: at(0, H.plaza, 1) },
    pickups: {
      "attack-tool": { platformId: "stage-door-plaza", position: at(-0.7, H.plaza, -0.5) },
      "guard-tool": { platformId: "fan-picnic", position: at(-1, H.picnic, -41) },
    },
    memories: {
      // Minor one waits where the hops and the side path land, just before
      // fights 3 and 4 (R5).
      "minor-one": { platformId: "glitter-grove", position: at(24.9, H.hops, z2(-5)) },
      // Minor two is on the last deck before the boss approach (R5).
      "minor-two": { platformId: "stage-wing", position: at(x3(1.8), H.wing, z3(-24.9)) },
      major: { platformId: "encore-riser", position: at(x3(0), H.stage, z3(-58.3)) },
    },
    encounters: {
      "ordinary-1": ordinary(
        "fan-picnic",
        at(3.25, H.picnic, -44),
        [1.85, 4.65],
        [-46.15, -41.85],
        "party-picnic-safe",
      ),
      "ordinary-2": ordinary(
        "ribbon-bandstand",
        at(-4.25, H.bandstand, -63.1),
        [-6.5, -2],
        [-65.6, -60.6],
        "ribbon-safe",
      ),
      "ordinary-3": ordinary(
        "glitter-grove",
        at(30, H.hops, z2(-4.75)),
        [27.5, 32.5],
        s2(-7.25, -2.25),
        "party-grove-safe",
      ),
      "ordinary-4": ordinary(
        "merch-fair",
        at(53.5, H.hops, z2(-6.5)),
        [51.5, 55.5],
        s2(-8.6, -4.4),
        "party-fair-safe",
      ),
      boss: {
        platformId: "main-stage",
        position: at(x3(0), H.stage, z3(-45.3)),
        kind: "boss",
        checkpointId: "besties-safe",
        arena: arena(r3(-3.8, 3.8), s3(-47.3, -43.3)),
      },
    },
    friendlies: {
      "friendly-1": { platformId: "stage-door-plaza", position: at(-3, H.plaza, 1) },
      "friendly-2": { platformId: "friend-balcony", position: at(21.7, H.balcony, z2(2.25)) },
      "friendly-3": { platformId: "merch-fair", position: at(49.5, H.hops, z2(-1.2)) },
    },
    // The major memory ends the chapter: all three share the encore riser (R1).
    rewardRespawn: { platformId: "encore-riser", position: at(x3(0), H.stage, z3(-56.8)) },
    finish: { platformId: "encore-riser", position: at(x3(0), H.stage, z3(-59.8)) },
  };
}

/** The complete authored-level-v4 document for `family-b3-stage`. */
export function familyB3Level(): WorldEditorLevelDocument {
  const decor: AuthoredDecor[] = familyB3Decor();
  return {
    schemaVersion: "authored-level-v4",
    id: FAMILY_B3_ROUTE_ID,
    theme: FAMILY_B3_COPY.theme,
    pieces: pieces(),
    connections: connections(),
    mainPath: [...FAMILY_B3_MAIN_PATH],
    branches: FAMILY_B3_BRANCHES.map((branch) => [...branch]),
    anchors: anchors(),
    decor,
  };
}
