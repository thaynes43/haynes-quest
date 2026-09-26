/**
 * World B, chapter 1: "The Sing-Along Playroom" (PLAN-019, blueprint B1 as
 * amended by the critique and coordinator rulings R1–R14).
 *
 * Usage: tsx scripts/levels/family/b1.ts            prints the level JSON
 *
 * `familyB1Level()` is a pure function returning the complete
 * authored-level-v4 document for route `family-b1-playroom`. The World B
 * assembler places it with `chapterCommands(id).replaceLevel(...)` inside a
 * world built by `worldShellCommands`, then assigns the cast.
 *
 * The gentlest chapter of World B (R8): the avatar is age 0 with jump only,
 * the highest standing surface is 6.9 m, every required mover and sweeper
 * stands at or below 2.7 m, and there is exactly one required lift.
 *
 *   rug walk -> toy steps (practice jumps over a catch mat) -> practice
 *   bounce -> play mat (ordinary 1) -> snack table (ordinary 2) -> crib rail
 *   (spinning mobile) -> alphabet-block bridge -> book shelf (sliding
 *   bookend) -> toy train -> station -> toy elevator -> dresser (minor one)
 *   -> music box (ordinary 3) -> xylophone keys -> toy piano (ordinary 4) ->
 *   pillow bounce chain -> top shelf (minor two) -> Honk Bus rug (boss) ->
 *   toy chest (major memory, reward respawn and finish)
 *
 * HP defeats return to the furthest minor memory (DESIGN-018), so the first
 * two fights sit close to spawn, minor one sits just before ordinaries 3 and
 * 4 on the lift's top landing, and minor two waits on the top shelf beside
 * the boss rug.
 *
 * The camera faces -z and never turns on its own (R3), so the whole
 * required route runs -z or sideways. The signature moment is the pillow
 * bounce chain up to the shelf; the boss is reached by bounce, not by lift
 * (R9). Two optional routes hold golden rattles: a block tower beside the
 * play mat and a pillow-fort bounce off the crib rail (B1's age-0 pad route,
 * R10).
 */
import type {
  AuthoredAnchor,
  AuthoredCheckpointPiece,
  AuthoredConnection,
  AuthoredDecor,
  AuthoredEncounterAnchor,
  AuthoredLevelPiece,
  AuthoredPlatformPiece,
} from "../../../src/shared/authored-level.js";
import type {
  LevelEditorEncounterReference,
  LevelEditorEnemyCandidate,
  WorldEditorLevelDocument,
} from "../../../src/shared/editor-project.js";
import {
  bounce,
  decor,
  drop,
  jump,
  mm,
  platformCheckpoint,
  ride,
  walk,
  type WorldShellChapter,
} from "../lib/growth-kit.js";
import {
  B1_CARPET_Y,
  liftAt,
  moverAt,
  padAt,
  ring,
  slab,
  slider,
  spinner,
  stiltsUnder,
} from "./lib-b1.js";

export const FAMILY_B1_ROUTE_ID = "family-b1-playroom";
export const FAMILY_B1_THEME = "playroom" as const;

/** World B's fictional birth date (WORLD-SPEC; template validation only). */
export const FAMILY_WORLD_B_FICTIONAL_BIRTH_DATE = "2020-06-01";

/** Fictional preview captions; they never reach a family journey. */
const B1_PREVIEW_MEMORIES: WorldShellChapter["previewMemories"] = [
  { slotId: "minor-one", date: "2021-01-15", label: "Bath-time bubbles" },
  { slotId: "minor-two", date: "2021-08-01", label: "Summer picnic" },
  { slotId: "major", date: "2022-06-01", label: "Turning 2!" },
];

/**
 * The chapter's world-shell entry: WORLD-SPEC copy verbatim, ages 0 -> 2 and
 * the represented range from the fictional birthday to the second birthday.
 */
export const FAMILY_B1_SHELL_CHAPTER: WorldShellChapter = Object.freeze({
  chapterId: "family-b1",
  routeId: FAMILY_B1_ROUTE_ID,
  name: "The Sing-Along Playroom",
  subtitle: "Block towers and bouncy beds",
  description: "Climb the playroom towers, bounce on the beds and cheer up the grumpy bus.",
  theme: FAMILY_B1_THEME,
  representedDateRange: { startDate: "2020-06-01", endDate: "2022-06-01" },
  recoveredAge: { fromYears: 0, toYears: 2 },
  previewMemories: B1_PREVIEW_MEMORIES,
});

/**
 * Big Honk Bus, the boss: its Blender model landed in parody-catalog-v8, so
 * the chapter uses the exact catalog entry (period sing-along-playroom-v1,
 * window 2018-01-01 to 2026-12-31).
 */
export const FAMILY_B1_BOSS: LevelEditorEncounterReference = Object.freeze({
  source: "catalog",
  catalogEntryId: "honk-bus",
  catalogEntryVersion: "v001",
});

/**
 * The WORLD-SPEC ordinary as a project candidate (no catalog model yet):
 * Yes-Yes Veggie in all four ordinary slots, in the boss's period.
 */
export const FAMILY_B1_CAST: Readonly<Record<"ordinary", LevelEditorEnemyCandidate>> =
  Object.freeze({
    ordinary: Object.freeze({
      id: "yes-yes-veggie",
      name: "Yes-Yes Veggie",
      periodId: "sing-along-playroom-v1",
      recognizableReference: 'the veggies from the "yes yes" eating song',
      visualJoke: "stubbornly says no",
      obstacleOrAttack: "bouncy head-butt",
      eligibility: { startDate: "2018-01-01", endDate: "2026-12-31" },
      role: "ordinary",
      kind: "ordinary-a",
      behaviorPreset: "ordinary-a",
    }),
  });

/** Heights the chapter is built around (metres). */
export const FAMILY_B1_HEIGHTS = Object.freeze({
  /** Standing height of the top shelf, the boss rug and the toy chest. */
  peak: 6.9,
  /** The highest deck that carries a required mover or sweeper. */
  lowZoneTop: 2.7,
  /** The toy elevator's stops. */
  liftBottom: 2.7,
  liftTop: 4.5,
});

// ---------------------------------------------------------------------------
// Surfaces, in route order.
// ---------------------------------------------------------------------------

function surfaces(): AuthoredLevelPiece[] {
  return [
    // S1 Nap rug and rug walk (spawn, mallet, first friend).
    slab("rug-start", { x0: -6, x1: 6, z0: -5, z1: 7, top: 0, thick: "floor" }),
    slab("rug-runner", { x0: -2.5, x1: 2.5, z0: -23, z1: -5, top: 0, thick: "floor" }),

    // S2 Toy steps: three practice jumps and a practice bounce over a soft
    // catch mat, which reaches back under the runner for the retry hop.
    slab("practice-mat", { x0: -5, x1: 6.5, z0: -44.4, z1: -22.5, top: -0.3, thick: "floor" }),
    slab("toy-step-1", { x0: -1.2, x1: 3.6, z0: -27.6, z1: -24, top: 0.3, thick: 0.6 }),
    slab("toy-step-2", { x0: -3.6, x1: 1.2, z0: -32.2, z1: -28.6, top: 0.6, thick: 0.9 }),
    slab("toy-step-3", { x0: -1.2, x1: 3.6, z0: -36.8, z1: -33.2, top: 0.9, thick: 1.2 }),
    padAt("bed-pad", { x0: 0, x1: 3, z0: -39.2, z1: -36.8, top: 0.9, thick: 1.2 }, "small"),
    // The practice bounce's landing reaches down to the pad top (R2) and is
    // narrow, so a deliberate sideways miss clears it onto the mat.
    slab("bounce-block", { x0: -0.5, x1: 3.5, z0: -43.94, z1: -39.54, top: 1.8, thick: 2.1 }),

    // S3 Play mat (ordinary 1) and snack table (ordinary 2), close to spawn.
    slab("play-mat", { x0: -8, x1: 8, z0: -57.94, z1: -44.94, top: 1.8, thick: "floor" }),
    slab("snack-table", { x0: -24, x1: -9, z0: -58, z1: -45, top: 2.1, thick: "floor" }),

    // S4 Crib rail with the spinning mobile, an alphabet-block bridge, the
    // book shelf with a sliding bookend, then the toy train to the station.
    slab("crib-rail", { x0: -22, x1: -11, z0: -69, z1: -59, top: 2.4, thick: "floor" }),
    slab("block-bridge-1", { x0: -17.7, x1: -12.9, z0: -73.6, z1: -70, top: 2.4, thick: "floor" }),
    slab("block-bridge-2", { x0: -20.1, x1: -15.3, z0: -78.2, z1: -74.6, top: 2.7, thick: "floor" }),
    slab("block-bridge-3", { x0: -17.7, x1: -12.9, z0: -82.8, z1: -79.2, top: 2.7, thick: "floor" }),
    slab("book-shelf", { x0: -30, x1: -11, z0: -94.8, z1: -83.8, top: 2.7, thick: "floor" }),
    moverAt(
      "toy-train",
      { x0: -10, x1: -6.4, z0: -91.5, z1: -87.1, top: 2.7, thick: 0.5 },
      { axis: "z", distance: 1.2, period: 10 },
    ),
    slab("train-station", { x0: -5.4, x1: 6.6, z0: -95.8, z1: -82.8, top: 2.7, thick: "floor" }),

    // S5 The toy elevator (the one required lift) up to the dresser. The car
    // is 1.2 m deep (v2), like B2's garden lift: at its top stop its underside
    // hangs 0.6 m above the station, lower than the infant avatar (0.88 m), so
    // a toddler who walks at the empty shaft meets the car's side instead of
    // falling in.
    liftAt(
      "toy-elevator",
      { x0: -0.9, x1: 2.1, z0: -98.9, z1: -95.9, top: 2.7, thick: 1.2 },
      { distance: 1.8, period: 8, dwell: 2.5 },
    ),
    slab("dresser", { x0: -5.4, x1: 6.6, z0: -109, z1: -99, top: 4.5, thick: "floor" }),

    // S6 Music box (ordinary 3), three xylophone keys, toy piano (ordinary 4).
    slab("music-box", { x0: 7.6, x1: 21.6, z0: -110, z1: -98, top: 4.5, thick: "floor" }),
    slab("xylophone-key-1", { x0: 22.6, x1: 26.2, z0: -106.2, z1: -101.8, top: 4.8, thick: "floor" }),
    slab("xylophone-key-2", { x0: 27.2, x1: 30.8, z0: -107.2, z1: -102.8, top: 5.1, thick: "floor" }),
    slab("xylophone-key-3", { x0: 31.8, x1: 35.4, z0: -108.2, z1: -103.8, top: 4.8, thick: "floor" }),
    slab("toy-piano", { x0: 36.4, x1: 50.4, z0: -113, z1: -100, top: 4.5, thick: "floor" }),

    // S7 The pillow bounce chain up to the top shelf (the signature).
    padAt("pillow-pad-1", { x0: 41.9, x1: 44.9, z0: -115.4, z1: -113, top: 4.5, thick: 0.4 }, "small"),
    slab("pillow-pile", { x0: 38.4, x1: 48.4, z0: -123.74, z1: -115.74, top: 5.7, thick: "floor" }),
    padAt("pillow-pad-2", { x0: 41.9, x1: 44.9, z0: -126.14, z1: -123.74, top: 5.7, thick: 0.4 }, "small"),
    slab("top-shelf", { x0: 36.4, x1: 50.4, z0: -136.48, z1: -126.48, top: 6.9, thick: "floor" }),

    // S8 Honk Bus rug (boss) and the toy chest (the chapter ends here, R1).
    slab("boss-rug", { x0: 18.4, x1: 35.4, z0: -140, z1: -124, top: 6.9, thick: "floor" }),
    slab("toy-chest", { x0: 21.9, x1: 31.9, z0: -145, z1: -140, top: 6.9, thick: "floor" }),

    // Optional A: block tower beside the play mat (golden rattle 1).
    slab("tower-block-1", { x0: -6.6, x1: -2.6, z0: -62.94, z1: -58.94, top: 2.1, thick: "floor" }),
    slab("tower-block-2", { x0: -6.6, x1: -2.6, z0: -67.94, z1: -63.94, top: 2.4, thick: "floor" }),
    slab("tower-block-3", { x0: -10.6, x1: -7.6, z0: -68, z1: -64, top: 2.7, thick: "floor" }),

    // Optional B: a pillow-fort bounce off the crib rail that skips the block
    // bridge and drops onto the book shelf (golden rattle 2).
    padAt("fort-pad", { x0: -22.6, x1: -19.6, z0: -71.4, z1: -69, top: 2.4, thick: 0.4 }, "small"),
    slab("pillow-fort", { x0: -30, x1: -20.6, z0: -83, z1: -71.74, top: 3.6, thick: "floor" }),
  ];
}

function hazards(): AuthoredLevelPiece[] {
  return [
    spinner("crib-mobile", { x: -16.5, z: -64, deckTop: 2.4 }, { halfLength: 1.3, radius: 0.18, period: 13 }),
    slider(
      "book-slider",
      { x: -15, z: -89.3, deckTop: 2.7 },
      { halfLength: 1.5, radius: 0.18, axis: "z", distance: 2.5, period: 10 },
    ),
  ];
}

function checkpoints(): AuthoredCheckpointPiece[] {
  return [
    platformCheckpoint("cp-start", "rug-start", { x: 3, y: 0, z: 4.5 }),
    platformCheckpoint("cp-block", "bounce-block", { x: 0.4, y: 1.8, z: -40.4 }),
    platformCheckpoint("cp-play", "play-mat", { x: -6.5, y: 1.8, z: -46.5 }),
    platformCheckpoint("cp-snack", "snack-table", { x: -11, y: 2.1, z: -46.5 }),
    platformCheckpoint("cp-crib", "crib-rail", { x: -12.5, y: 2.4, z: -60.5 }),
    platformCheckpoint("cp-shelf", "book-shelf", { x: -20.5, y: 2.7, z: -85.5 }),
    platformCheckpoint("cp-station", "train-station", { x: -3.5, y: 2.7, z: -85 }),
    platformCheckpoint("cp-dresser", "dresser", { x: -3.5, y: 4.5, z: -101 }),
    platformCheckpoint("cp-music", "music-box", { x: 8.3, y: 4.5, z: -99.3 }),
    platformCheckpoint("cp-piano", "toy-piano", { x: 37.3, y: 4.5, z: -101 }),
    platformCheckpoint("cp-pillow", "pillow-pile", { x: 39.8, y: 5.7, z: -117.5 }),
    platformCheckpoint("cp-top", "top-shelf", { x: 48.4, y: 6.9, z: -128.5 }),
    platformCheckpoint("cp-boss-gate", "boss-rug", { x: 34.7, y: 6.9, z: -125 }),
  ];
}

// ---------------------------------------------------------------------------
// Graph.
// ---------------------------------------------------------------------------

export const FAMILY_B1_MAIN_PATH = Object.freeze([
  "rug-start",
  "rug-runner",
  "toy-step-1",
  "toy-step-2",
  "toy-step-3",
  "bed-pad",
  "bounce-block",
  "play-mat",
  "snack-table",
  "crib-rail",
  "block-bridge-1",
  "block-bridge-2",
  "block-bridge-3",
  "book-shelf",
  "toy-train",
  "train-station",
  "toy-elevator",
  "dresser",
  "music-box",
  "xylophone-key-1",
  "xylophone-key-2",
  "xylophone-key-3",
  "toy-piano",
  "pillow-pad-1",
  "pillow-pile",
  "pillow-pad-2",
  "top-shelf",
  "boss-rug",
  "toy-chest",
] as const);

export const FAMILY_B1_BRANCHES = Object.freeze([
  Object.freeze(["play-mat", "tower-block-1", "tower-block-2", "tower-block-3", "crib-rail"] as const),
  Object.freeze(["crib-rail", "fort-pad", "pillow-fort", "book-shelf"] as const),
]);

function connections(): AuthoredConnection[] {
  const mat = { safeMissPlatformId: "practice-mat" } as const;
  return [
    walk("rug-start", "rug-runner"),
    jump("rug-runner", "toy-step-1", mat),
    jump("toy-step-1", "toy-step-2", mat),
    jump("toy-step-2", "toy-step-3", mat),
    walk("toy-step-3", "bed-pad"),
    bounce("bed-pad", "bounce-block", mat),
    // Retry hop off the catch mat, back onto the runner.
    jump("practice-mat", "rug-runner"),
    jump("bounce-block", "play-mat"),
    jump("play-mat", "snack-table"),
    jump("snack-table", "crib-rail"),
    jump("crib-rail", "block-bridge-1"),
    jump("block-bridge-1", "block-bridge-2"),
    jump("block-bridge-2", "block-bridge-3"),
    jump("block-bridge-3", "book-shelf"),
    ride("book-shelf", "toy-train"),
    ride("toy-train", "train-station"),
    ride("train-station", "toy-elevator"),
    ride("toy-elevator", "dresser"),
    jump("dresser", "music-box"),
    jump("music-box", "xylophone-key-1"),
    jump("xylophone-key-1", "xylophone-key-2"),
    jump("xylophone-key-2", "xylophone-key-3"),
    jump("xylophone-key-3", "toy-piano"),
    walk("toy-piano", "pillow-pad-1"),
    bounce("pillow-pad-1", "pillow-pile"),
    walk("pillow-pile", "pillow-pad-2"),
    bounce("pillow-pad-2", "top-shelf"),
    jump("top-shelf", "boss-rug"),
    walk("boss-rug", "toy-chest"),
    // Optional A: block tower.
    jump("play-mat", "tower-block-1"),
    jump("tower-block-1", "tower-block-2"),
    jump("tower-block-2", "tower-block-3"),
    jump("tower-block-3", "crib-rail"),
    // Optional B: pillow fort.
    walk("crib-rail", "fort-pad"),
    bounce("fort-pad", "pillow-fort"),
    drop("pillow-fort", "book-shelf"),
  ];
}

// ---------------------------------------------------------------------------
// Anchors.
// ---------------------------------------------------------------------------

function at(platformId: string, x: number, y: number, z: number): AuthoredAnchor {
  return { platformId, position: { x, y, z } };
}

function fight(
  platformId: string,
  position: readonly [number, number, number],
  arena: readonly [number, number, number, number],
  checkpointId: string,
  kind: AuthoredEncounterAnchor["kind"],
): AuthoredEncounterAnchor {
  const [x, y, z] = position;
  const [minX, maxX, minZ, maxZ] = arena;
  return { platformId, position: { x, y, z }, kind, arena: { minX, maxX, minZ, maxZ }, checkpointId };
}

function anchors(): WorldEditorLevelDocument["anchors"] {
  // One ordinary identity (Yes-Yes Veggie) in all four slots (R11).
  const ordinary = "ordinary-a" as const;
  return {
    spawn: at("rug-start", 0, 0, 4),
    finish: at("toy-chest", 26.9, 6.9, -144.2),
    rewardRespawn: at("toy-chest", 30.4, 6.9, -141),
    pickups: {
      "attack-tool": at("rug-start", -2.5, 0, 0.5),
      "guard-tool": at("bounce-block", 2.4, 1.8, -42.6),
    },
    memories: {
      "minor-one": at("dresser", -3, 4.5, -106),
      "minor-two": at("top-shelf", 39.5, 6.9, -133),
      major: at("toy-chest", 26.9, 6.9, -142.5),
    },
    encounters: {
      "ordinary-1": fight("play-mat", [0, 1.8, -52.5], [-3.5, 3.5, -55.2, -49.8], "cp-block", ordinary),
      "ordinary-2": fight("snack-table", [-17, 2.1, -51.5], [-20.5, -13.5, -54.5, -48.5], "cp-play", ordinary),
      "ordinary-3": fight("music-box", [14.6, 4.5, -104], [10.6, 18.6, -106.5, -101.5], "cp-dresser", ordinary),
      "ordinary-4": fight("toy-piano", [43.5, 4.5, -106.5], [40, 47.5, -110, -103.5], "cp-music", ordinary),
      boss: fight("boss-rug", [26.5, 6.9, -132], [22, 31, -136, -128], "cp-boss-gate", "boss"),
    },
    friendlies: {
      "friendly-1": at("rug-start", -4, 0, 4),
      "friendly-2": at("dresser", 3.5, 4.5, -107),
      "friendly-3": at("top-shelf", 47.5, 6.9, -134),
    },
  };
}

// ---------------------------------------------------------------------------
// Decor: playroom-kit props only (R12), beside, below or well above the route.
// ---------------------------------------------------------------------------

const BLOCK_TOWER = { kitPropId: "stacking-block-tower", height: 2.4, halfWidth: 0.7 } as const;
const HALF_TURN = mm(Math.PI / 2);

function boardOf(pieces: readonly AuthoredLevelPiece[], id: string): AuthoredPlatformPiece {
  const piece = pieces.find((candidate) => candidate.id === id);
  if (!piece || !("size" in piece)) throw new Error(`B1 decor needs board ${id}`);
  return piece as AuthoredPlatformPiece;
}

/** A tall landmark: `levels` stacking-block towers on the carpet. */
function landmark(id: string, x: number, z: number, scale: number, levels: number): AuthoredDecor[] {
  return Array.from({ length: levels }, (_, level) =>
    decor(`${id}-${level + 1}`, BLOCK_TOWER.kitPropId, { x, y: mm(B1_CARPET_Y + level * BLOCK_TOWER.height * scale), z }, { scale }),
  );
}

function ball(id: string, x: number, z: number, scale: number, y = B1_CARPET_Y): AuthoredDecor {
  return decor(id, "giant-plush-ball", { x, y, z }, { scale });
}

/** Crib-rail fence skirts on a deck's side face, hanging just below its top. */
function fence(id: string, x: number, deckTop: number, z: number, alongZ: boolean): AuthoredDecor {
  return decor(id, "crib-rail-fence", { x, y: mm(deckTop - 0.05 - 0.9), z }, alongZ ? { rotationY: HALF_TURN } : {});
}

function decorFor(pieces: readonly AuthoredLevelPiece[]): AuthoredDecor[] {
  return [
    // The Honk Bus's garage beside the nap rug: the first thing in view.
    decor("bus-garage", "toy-bus-garage", { x: 11, y: B1_CARPET_Y, z: 2 }, { rotationY: -HALF_TURN, scale: 1.9 }),
    // Soft plush balls scattered on the carpet around the low playroom.
    ball("ball-rug-east", 12.5, -12, 3),
    ball("ball-rug-west", -12, -9, 2.6),
    ball("ball-steps-east", 14.5, -30, 2.2),
    ball("ball-steps-west", -13, -30, 2),
    ball("ball-mat-east", 13, -48, 1.6),
    ball("ball-snack-west", -31, -52, 2.8),
    ball("ball-bridge-east", -6, -76, 2.2),
    ball("ball-station-east", 14, -84, 2.6),
    ball("ball-keys-south", 30, -93, 2.2),
    ball("ball-piano-east", 56, -106, 3),
    // Crib-rail skirts on the crib deck's open sides.
    fence("crib-fence-west-1", -22.2, 2.4, -60.9, true),
    fence("crib-fence-west-2", -22.2, 2.4, -64.1, true),
    fence("crib-fence-west-3", -22.2, 2.4, -67.3, true),
    fence("crib-fence-east", -10.8, 2.4, -61.5, true),
    // A hanging mobile high above the spinning crib bar.
    ball("crib-mobile-hub", -16.5, -64, 0.8, 6.4),
    ...ring("crib-mobile-toy", "giant-plush-ball", { x: -16.5, y: 6.1, z: -64 }, 1.3, 4, 0.45),
    // Block-tower frame posts on both sides of the toy elevator shaft.
    ...landmark("elevator-post-west", -2.4, -97.4, 1, 3),
    ...landmark("elevator-post-east", 3.6, -97.4, 1, 3),
    // Block stacks under the floating pillow pads.
    ...stiltsUnder("pad-1-stack", boardOf(pieces, "pillow-pad-1"), BLOCK_TOWER),
    ...stiltsUnder("pad-2-stack", boardOf(pieces, "pillow-pad-2"), BLOCK_TOWER),
    ...stiltsUnder("fort-pad-stack", boardOf(pieces, "fort-pad"), BLOCK_TOWER),
    // Block towers framing the nap rug, and beside the bounce chain so its
    // height reads from the toy piano.
    ...landmark("rug-post-west", -9.5, 5.5, 1.6, 2),
    ...landmark("chain-tower-west", 35.5, -117, 1.5, 3),
    ...landmark("chain-tower-east", 53, -119.7, 2.5, 2),
    // Tall block towers far out on the carpet: landmarks through the fog.
    ...landmark("landmark-west-near", -40, -24, 3.5, 2),
    ...landmark("landmark-east-near", 26, -40, 3, 2),
    ...landmark("landmark-west-far", -42, -100, 4, 2),
    ...landmark("landmark-east-far", 62, -70, 4, 2),
    ...landmark("landmark-north", 12, -156, 4, 2),
  ];
}

// ---------------------------------------------------------------------------

/** The complete, deterministic authored-level-v4 document for chapter B1. */
export function familyB1Level(): WorldEditorLevelDocument {
  const pieces = [...surfaces(), ...hazards(), ...checkpoints()];
  return {
    schemaVersion: "authored-level-v4",
    id: FAMILY_B1_ROUTE_ID,
    theme: FAMILY_B1_THEME,
    pieces,
    connections: connections(),
    mainPath: [...FAMILY_B1_MAIN_PATH],
    branches: FAMILY_B1_BRANCHES.map((branch) => [...branch]),
    anchors: anchors(),
    decor: decorFor(pieces),
  };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) process.stdout.write(`${JSON.stringify(familyB1Level(), null, 2)}\n`);
