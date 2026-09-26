/**
 * Chapter B2 of World B, "The Magic House" (PLAN-019; blueprint B2 as
 * amended by the critique and coordinator rulings R1–R14).
 *
 * Ages 2 -> 4: the avatar starts with jump and high jump, and this is the
 * first chapter that has high jump. The course climbs a magic house's
 * garden from a flagstone path to a sky courtyard about 9 m up:
 *
 *   garden path -> two practice high jumps over the clover lawn -> flower
 *   terrace -> sprinkler alley -> petal pad (small bounce) -> veranda ->
 *   planter hops -> garden lift -> eave balcony -> bloom pad (big bounce) ->
 *   roof (weathervane walk) -> chimney garden -> the dancing-tile staircase
 *   (three tiles, a landing, two tiles) -> sky courtyard (the Dancing House)
 *   -> sunset overlook (major memory, reward respawn, finish).
 *
 * The optional butterfly arch climbs four high jumps from the balcony to a
 * golden perch and rejoins on the roof before ordinary-3.
 *
 * Changes from the blueprint (critique must-fixes and rulings):
 * - The final climb to the boss is the dancing-tile staircase, the chapter's
 *   signature, instead of a tower lift (R9: B1 and B3 reach their bosses by
 *   lift). The one lift now lifts the route mid-course, with a 2.5 s dwell,
 *   0.05 m landings, a boarding checkpoint (R6) and a deep car that keeps
 *   the shaft closed at walking height.
 * - The course peaks at 8.9 m, not 10 m (R8: about 9 m).
 * - minor-two sits on the staircase landing, about 16 m from the boss arena,
 *   and minor-one on the balcony just before ordinary-3 (R5).
 * - Every strike envelope keeps 1 m inside its deck and clear of every
 *   strip (R4); all four ordinaries are ordinary-a (R11).
 * - The walk-only hammock nook is gone, so its free golden ticket is too;
 *   the golden candle sits only on the high-jump arch (R10). A single
 *   sprinkler and a single weathervane replace the twin-sprinkler lane (R9).
 * - A winding garden path opens the chapter (R9) and lengthens the route to
 *   about 79 s of scripted play (R10).
 *
 * `buildB2Level()` is pure: it returns the same authored-level-v4 document
 * on every call. The World assembler places it with
 * `chapterCommands(chapterId).replaceLevel(...)` and assigns the cast.
 */
import type {
  AuthoredConnection,
  AuthoredDecor,
  AuthoredLevelPiece,
} from "../../../src/shared/authored-level.js";
import type {
  LevelEditorEnemyCandidate,
  WorldEditorLevelDocument,
} from "../../../src/shared/editor-project.js";
import {
  bounce,
  bouncePad,
  decor,
  jump,
  lift,
  ride,
  walk,
  type WorldShellChapter,
} from "../lib/growth-kit.js";
import {
  anchorOn,
  block,
  centred,
  checkpointOn,
  encounterOn,
  GROUND,
  rect,
  spinner,
  tile,
} from "./lib-b2.js";

export const B2_ROUTE_ID = "family-b2-casita";
export const B2_THEME = "casita" as const;

// ---------------------------------------------------------------------------
// Surfaces (tops in metres; every block stands on the ground plane).
// ---------------------------------------------------------------------------

/**
 * S0 garden path (R9: B2 opens on a garden path): the spawn gate, then a
 * winding flagstone walk north, east along the flower beds and north again
 * to the clover lawn. Every turn is sideways or away from the camera (R3).
 */
const gardenGate = block("garden-gate", rect(-18, -10, 8, 16), 0);
const gardenPath = block("garden-path", rect(-15.6, -12.4, -2, 8), 0);
const pathCornerWest = block("path-corner-west", rect(-15.6, -12.4, -5.2, -2), 0);
const flagstoneBend = block("flagstone-bend", rect(-12.4, -1.6, -5.2, -2), 0);
const pathCornerEast = block("path-corner-east", rect(-1.6, 1.6, -5.2, -2), 0);
const roseWalk = block("rose-walk", rect(-1.6, 1.6, -13, -5.2), 0);

/** S1 practice: three pots on the soft clover lawn, the catch floor. */
const cloverLawn = block("clover-lawn", rect(-6, 6, -24.6, -13), 0);
const pot1 = block("pot-1", centred(1.2, -15.2, 4, 3), 0.3, 0);
const pot2 = block("pot-2", centred(-1, -19.2, 4.4, 3.2), 0.9, 0);
const pot3 = block("pot-3", centred(1.2, -23, 4.4, 3.2), 1.5, 0);

/** S2 terrace and sprinkler alley (1.5 m). */
const flowerTerrace = block("flower-terrace", rect(-7, 7, -35.4, -24.6), 1.5);
const sprinklerAlley = block("sprinkler-alley", rect(7, 21, -33.5, -26.5), 1.5);
const sprinkler = spinner("sprinkler", { x: 13.5, z: -30 }, 1.5, 1.3, 10);
const petalPad = bouncePad("petal-pad", {
  x: 21.9,
  z: -30,
  sizeX: 1.8,
  sizeZ: 2,
  top: 1.5,
  thickness: 0.4,
  strength: "small",
});

/** S3 veranda (2.7 m) and the planter hops. */
const verandaSouth = block("veranda-south", rect(23.15, 35.15, -38, -23), 2.7);
const planterHop1 = block("planter-hop-1", centred(26.15, -39.9, 4, 2.6), 3);
const planterHop2 = block("planter-hop-2", centred(28.15, -43.1, 4, 2.6), 3);
const verandaNorth = block("veranda-north", rect(23.15, 39.15, -52, -45), 2.7);

/**
 * S4 garden lift up to the eave balcony (4.2 m): dwell 2.5 s at each stop
 * (R6, World B needs 2 s) and landings 0.05 m away at both stops. The car is
 * 0.9 m deep, so at its top stop its underside hangs only 0.6 m above the
 * boarding landing: lower than the infant avatar (0.88 m), so a toddler who
 * walks at the empty shaft meets the car's side instead of falling in.
 */
const gardenLift = lift("garden-lift", {
  x: 21.5,
  z: -48.5,
  sizeX: 3.2,
  sizeZ: 3.2,
  bottomTop: 2.7,
  distance: 1.5,
  period: 6,
  dwell: 2.5,
  thickness: 0.9,
});
const eaveBalcony = block("eave-balcony", rect(12.85, 19.85, -51.5, -44.5), 4.2);

/** S5 bloom pad (big) up to the roof (6.5 m), the weathervane walk and the chimney garden (6.8 m). */
const bloomPad = bouncePad("bloom-pad", {
  x: 16.35,
  z: -52.3,
  sizeX: 1.8,
  sizeZ: 1.6,
  top: 4.2,
  thickness: 0.4,
  strength: "big",
});
const roofWest = block("roof-west", rect(8.35, 22.35, -63.45, -53.45), 6.5);
const roofWalk = block("roof-walk", rect(22.35, 34.35, -61.45, -53.45), 6.5);
const weathervane = spinner("weathervane", { x: 28.35, z: -57.45 }, 6.5, 1.2, 12);
const chimneyGarden = block("chimney-garden", rect(34.95, 46.95, -65, -53), 6.8);

/** S6 the dancing-tile staircase: tiles sway along x while the route climbs toward -z. */
const TILE_X = 41;
/** A gentle sway: 0.8 m each way over 8 s (peak 0.63 m/s); neighbours move in opposite phase. */
const tileMotion = (phase?: number) => ({
  axis: "x" as const,
  distance: 0.8,
  period: 8,
  ...(phase === undefined ? {} : { phase }),
});
const danceTile1 = tile("dance-tile-1", centred(TILE_X, -67, 3.6, 2.8), 7.1, tileMotion());
const danceTile2 = tile("dance-tile-2", centred(TILE_X, -70.4, 3.6, 2.8), 7.4, tileMotion(Math.PI));
const danceTile3 = tile("dance-tile-3", centred(TILE_X, -73.8, 3.6, 2.8), 7.7, tileMotion());
const tileRest = block("tile-rest", rect(38, 44, -80.8, -75.8), 8);
const danceTile4 = tile("dance-tile-4", centred(TILE_X, -82.8, 3.6, 2.8), 8.3, tileMotion());
const danceTile5 = tile("dance-tile-5", centred(TILE_X, -86.2, 3.6, 2.8), 8.6, tileMotion(Math.PI));

/** S7 the sky courtyard (boss) and the sunset overlook where the chapter ends (R1). */
const skyCourtyard = block("sky-courtyard", rect(33, 49, -106.2, -88.2), 8.9);
const sunsetOverlook = block("sunset-overlook", rect(35, 47, -113.2, -106.2), 8.9);

/** Optional butterfly arch: four high jumps to the golden perch, rejoining on the roof. */
const archStep1 = block("arch-step-1", centred(10.3, -47.2, 3.2, 3.2), 4.8);
const archStep2 = block("arch-step-2", centred(6.3, -49, 3.2, 3.2), 5.4);
const goldenPerch = block("golden-perch", centred(6.3, -53.8, 3.2, 3.2), 6);

// ---------------------------------------------------------------------------
// Checkpoints, in route order (DESIGN-011: before and after each section).
// ---------------------------------------------------------------------------

const cpGate = checkpointOn("cp-gate", gardenGate, -12.5, 13.5);
const cpTerrace = checkpointOn("cp-terrace", flowerTerrace, 4.6, -26.4);
const cpAlley = checkpointOn("cp-alley", sprinklerAlley, 19.2, -30);
const cpVeranda = checkpointOn("cp-veranda", verandaSouth, 25.2, -35.2);
/** The lift's boarding landing holds a checkpoint (World B lint), so a shaft fall is a short retry. */
const cpVerandaNorth = checkpointOn("cp-veranda-north", verandaNorth, 25.6, -48.5);
/** The only checkpoint on the minor-one platform. */
const cpBalcony = checkpointOn("cp-balcony", eaveBalcony, 18.3, -46);
const cpPerch = checkpointOn("cp-perch", goldenPerch, 6.3, -53.8);
const cpRoof = checkpointOn("cp-roof", roofWest, 20.3, -55.6);
const cpRoofWalk = checkpointOn("cp-roof-walk", roofWalk, 33, -60);
const cpChimney = checkpointOn("cp-chimney", chimneyGarden, 36.2, -55);
/** The only checkpoint on the minor-two platform, the staircase landing (R5). */
const cpRest = checkpointOn("cp-rest", tileRest, 42.8, -78.3);
const cpCourt = checkpointOn("cp-court", skyCourtyard, 41, -89.8);

const PIECES: readonly AuthoredLevelPiece[] = [
  gardenGate,
  cpGate,
  gardenPath,
  pathCornerWest,
  flagstoneBend,
  pathCornerEast,
  roseWalk,
  cloverLawn,
  pot1,
  pot2,
  pot3,
  flowerTerrace,
  cpTerrace,
  sprinklerAlley,
  sprinkler,
  cpAlley,
  petalPad,
  verandaSouth,
  cpVeranda,
  planterHop1,
  planterHop2,
  verandaNorth,
  cpVerandaNorth,
  gardenLift,
  eaveBalcony,
  cpBalcony,
  bloomPad,
  archStep1,
  archStep2,
  goldenPerch,
  cpPerch,
  roofWest,
  cpRoof,
  roofWalk,
  weathervane,
  cpRoofWalk,
  chimneyGarden,
  cpChimney,
  danceTile1,
  danceTile2,
  danceTile3,
  tileRest,
  cpRest,
  danceTile4,
  danceTile5,
  skyCourtyard,
  cpCourt,
  sunsetOverlook,
];

// ---------------------------------------------------------------------------
// Route graph.
// ---------------------------------------------------------------------------

export const B2_MAIN_PATH: readonly string[] = [
  gardenGate.id,
  gardenPath.id,
  pathCornerWest.id,
  flagstoneBend.id,
  pathCornerEast.id,
  roseWalk.id,
  pot1.id,
  pot2.id,
  pot3.id,
  flowerTerrace.id,
  sprinklerAlley.id,
  petalPad.id,
  verandaSouth.id,
  planterHop1.id,
  planterHop2.id,
  verandaNorth.id,
  gardenLift.id,
  eaveBalcony.id,
  bloomPad.id,
  roofWest.id,
  roofWalk.id,
  chimneyGarden.id,
  danceTile1.id,
  danceTile2.id,
  danceTile3.id,
  tileRest.id,
  danceTile4.id,
  danceTile5.id,
  skyCourtyard.id,
  sunsetOverlook.id,
];

/** The one optional branch: the butterfly arch, holding the golden candle (R10). */
export const B2_BRANCHES: readonly (readonly string[])[] = [
  [eaveBalcony.id, archStep1.id, archStep2.id, goldenPerch.id, roofWest.id],
];

const practice = { requires: "high-jump", safeMissPlatformId: cloverLawn.id } as const;

const CONNECTIONS: readonly AuthoredConnection[] = [
  walk(gardenGate.id, gardenPath.id),
  walk(gardenPath.id, pathCornerWest.id),
  walk(pathCornerWest.id, flagstoneBend.id),
  walk(flagstoneBend.id, pathCornerEast.id),
  walk(pathCornerEast.id, roseWalk.id),
  jump(roseWalk.id, pot1.id),
  // The chapter's only two required high jumps: the practice stretch over the lawn.
  jump(pot1.id, pot2.id, practice),
  jump(pot2.id, pot3.id, practice),
  walk(pot3.id, flowerTerrace.id),
  // The retry route off the catch floor: a 0.3 m hop back onto the first pot.
  jump(cloverLawn.id, pot1.id),
  walk(flowerTerrace.id, sprinklerAlley.id),
  walk(sprinklerAlley.id, petalPad.id),
  bounce(petalPad.id, verandaSouth.id),
  jump(verandaSouth.id, planterHop1.id),
  jump(planterHop1.id, planterHop2.id),
  jump(planterHop2.id, verandaNorth.id),
  ride(verandaNorth.id, gardenLift.id),
  ride(gardenLift.id, eaveBalcony.id),
  walk(eaveBalcony.id, bloomPad.id),
  bounce(bloomPad.id, roofWest.id),
  walk(roofWest.id, roofWalk.id),
  jump(roofWalk.id, chimneyGarden.id),
  ride(chimneyGarden.id, danceTile1.id),
  ride(danceTile1.id, danceTile2.id),
  ride(danceTile2.id, danceTile3.id),
  ride(danceTile3.id, tileRest.id),
  ride(tileRest.id, danceTile4.id),
  ride(danceTile4.id, danceTile5.id),
  ride(danceTile5.id, skyCourtyard.id),
  walk(skyCourtyard.id, sunsetOverlook.id),
  // The butterfly arch (branch): every step needs high jump.
  jump(eaveBalcony.id, archStep1.id, { requires: "high-jump" }),
  jump(archStep1.id, archStep2.id, { requires: "high-jump" }),
  jump(archStep2.id, goldenPerch.id, { requires: "high-jump" }),
  jump(goldenPerch.id, roofWest.id, { requires: "high-jump" }),
];

// ---------------------------------------------------------------------------
// Anchors. Arenas are 4 x 4 (8 x 5 for the boss); every strike envelope keeps
// at least 1 m inside its deck and clear of every exit strip (R4, World B).
// ---------------------------------------------------------------------------

function anchors(): WorldEditorLevelDocument["anchors"] {
  return {
    spawn: anchorOn(gardenGate, -14, 14.2),
    finish: anchorOn(sunsetOverlook, 41, -111.8),
    rewardRespawn: anchorOn(sunsetOverlook, 41, -107.4),
    pickups: {
      "attack-tool": anchorOn(gardenGate, -15.8, 11.2),
      "guard-tool": anchorOn(flowerTerrace, 2.8, -27),
    },
    memories: {
      // R5: minor-one just before ordinary-3/4; minor-two on the staircase landing.
      "minor-one": anchorOn(eaveBalcony, 18.3, -49.8),
      "minor-two": anchorOn(tileRest, 39.2, -78.3),
      // R1: the major memory ends the chapter on the final platform.
      major: anchorOn(sunsetOverlook, 41, -109.6),
    },
    encounters: {
      "ordinary-1": encounterOn(flowerTerrace, "ordinary-a", rect(-4.55, -0.55, -32.95, -28.95), cpTerrace.id),
      "ordinary-2": encounterOn(verandaSouth, "ordinary-a", rect(28.55, 32.55, -29.45, -25.45), cpVeranda.id),
      "ordinary-3": encounterOn(roofWest, "ordinary-a", rect(12.35, 16.35, -60.95, -56.95), cpRoof.id),
      "ordinary-4": encounterOn(chimneyGarden, "ordinary-a", rect(39.85, 43.85, -59.65, -55.65), cpChimney.id),
      boss: encounterOn(skyCourtyard, "boss", rect(37, 45, -99.25, -94.25), cpCourt.id),
    },
    friendlies: {
      "friendly-1": anchorOn(gardenGate, -16.6, 14.2),
      "friendly-2": anchorOn(verandaNorth, 36.6, -48.5),
      "friendly-3": anchorOn(chimneyGarden, 36.6, -63.4),
    },
  };
}

// ---------------------------------------------------------------------------
// Decor: casita kit and shared props only (R12), all beside the route.
// ---------------------------------------------------------------------------

const HALF_PI = Math.PI / 2;

/** A flower bed on the ground beside a deck; at scale 2 it rises 0.4 m above the path. */
function bed(id: string, x: number, z: number, scale = 2): AuthoredDecor {
  return decor(id, "flower-planter", { x, y: GROUND, z }, { scale });
}

function tree(id: string, x: number, z: number, scale: number, rotationY = 0): AuthoredDecor {
  return decor(id, "clearing-tree", { x, y: GROUND, z }, { rotationY, scale });
}

/** A floating golden candle (the shared wind-up lantern) beside a deck edge. */
function candle(id: string, x: number, y: number, z: number, rotationY = 0): AuthoredDecor {
  return decor(id, "toybox-windup-lantern", { x, y, z }, { rotationY, scale: 1.2 });
}

/** A casita door on a block's camera-facing (south) face, standing on the ground. */
function door(id: string, x: number, faceZ: number, scale: number): AuthoredDecor {
  return decor(id, "patterned-door", { x, y: GROUND, z: faceZ + 0.2 * scale + 0.05 }, { scale });
}

/** A terrace wall along a block's south face, below the deck top. */
function southWall(id: string, x: number, faceZ: number, scale: number): AuthoredDecor {
  return decor(id, "casita-terrace-wall", { x, y: GROUND, z: faceZ + 0.35 * scale + 0.03 }, { scale });
}

/** A terrace wall along a block's east or west face. */
function sideWall(id: string, faceX: number, z: number, side: 1 | -1, scale: number): AuthoredDecor {
  return decor(
    id,
    "casita-terrace-wall",
    { x: faceX + side * (0.35 * scale + 0.03), y: GROUND, z },
    { rotationY: side * HALF_PI, scale },
  );
}

/**
 * 88 props: the casita kit (terrace walls, flower beds, patterned doors and
 * butterfly arches) plus shared trees, stones and wind-up lanterns, which
 * float beside the upper decks as the house's golden candles (R12). Every
 * prop stands on the ground or floats beside a deck, below the decks it
 * touches, so none sits in a walkable volume, connection corridor or strike
 * envelope, and each reads the same with its procedural fallback. No arch
 * straddles a lane.
 */
function decorPlacements(): AuthoredDecor[] {
  return [
    // Arrival: a butterfly arch beside the gate and beds along the winding path.
    decor("gate-arch", "butterfly-arch", { x: -6.6, y: GROUND, z: 10 }, { scale: 1.4 }),
    tree("gate-tree-west", -21.2, 12.5, 1.8),
    tree("gate-tree-south-west", -21.2, 4.5, 1.6, 0.6),
    tree("gate-tree-east", -5.4, 15.2, 1.6, 1.1),
    bed("path-bed-west-1", -17.15, 5.5),
    bed("path-bed-west-2", -17.15, 2.3),
    bed("path-bed-west-3", -17.15, -0.9),
    bed("path-bed-west-4", -17.15, -4.1),
    bed("path-bed-east-1", -10.85, 5.5),
    bed("path-bed-east-2", -10.85, 2.3),
    bed("bend-bed-south-1", -7.6, -0.45),
    bed("bend-bed-south-2", -4.4, -0.45),
    bed("bend-bed-south-3", 0, -0.45),
    bed("bend-bed-north-1", -10.4, -6.75),
    bed("bend-bed-north-2", -7.2, -6.75),
    bed("corner-bed-east", 3.15, -3.6),
    bed("rose-bed-west-1", -3.15, -8.6),
    bed("rose-bed-west-2", -3.15, -11.6),
    bed("rose-bed-east-1", 3.15, -7.4),
    bed("rose-bed-east-2", 3.15, -11.4),
    // The clover lawn and the terrace: trees and stones framing the practice pots.
    tree("lawn-tree-west-1", -9, -16, 1.8, 0.3),
    tree("lawn-tree-west-2", -9.6, -22.2, 2),
    tree("lawn-tree-east-1", 9.2, -15.6, 1.6, 0.9),
    tree("lawn-tree-east-2", 10.2, -21.4, 1.8, 0.2),
    decor("lawn-stone-west", "clearing-stone", { x: -7.6, y: GROUND, z: -12.2 }, { rotationY: 0.5, scale: 1.4 }),
    decor("lawn-stone-east", "clearing-stone", { x: 7.4, y: GROUND, z: -11.6 }, { rotationY: 1.9, scale: 1.2 }),
    tree("terrace-tree-west-1", -11.6, -28.4, 2.2, 0.4),
    tree("terrace-tree-west-2", -11.2, -34.4, 2),
    sideWall("terrace-wall-west-1", -7, -27.3, -1, 1.1),
    sideWall("terrace-wall-west-2", -7, -32.7, -1, 1.1),
    // The alley and the veranda: the house's first doors.
    tree("alley-tree-south-1", 15.8, -22.6, 1.8, 0.7),
    tree("alley-tree-south-2", 20.2, -21.6, 1.5, 1.4),
    tree("garden-tree-1", 10.2, -38.2, 2, 0.2),
    tree("garden-tree-2", 17, -39.2, 2.2, 1),
    southWall("veranda-wall-1", 25.8, -23, 1.2),
    southWall("veranda-wall-2", 32.5, -23, 1.2),
    decor("veranda-door", "patterned-door", { x: 29.15, y: GROUND, z: -21.9 }, { scale: 1.2 }),
    bed("veranda-bed-1", 23.6, -20.8, 1.5),
    bed("veranda-bed-2", 34.7, -20.8, 1.5),
    tree("veranda-tree-east-1", 38.6, -27.2, 2),
    tree("veranda-tree-east-2", 38.6, -34, 2.2, 0.8),
    sideWall("veranda-north-wall-east", 39.15, -48.5, 1, 1.2),
    // The balcony, the lift and the golden route.
    door("balcony-door", 16.35, -44.5, 1.3),
    bed("balcony-bed-west", 13.9, -43.55, 1.5),
    bed("balcony-bed-east", 18.8, -43.55, 1.5),
    decor("golden-arch", "butterfly-arch", { x: 2.6, y: GROUND, z: -47.2 }, { rotationY: HALF_PI, scale: 1.8 }),
    tree("perch-tree", 0.6, -57.6, 2.4),
    tree("roof-tree-west", 3.2, -63.4, 2.6, 1.2),
    // Roof, chimney garden and the staircase: floating golden candles.
    candle("roof-candle-1", 11, 7.8, -64.1),
    candle("roof-candle-2", 15, 7.8, -64.1),
    candle("roof-candle-3", 19, 7.8, -64.1),
    candle("roof-walk-candle-1", 26, 7.8, -62.1),
    candle("roof-walk-candle-2", 31, 7.8, -62.1),
    door("chimney-door", 43, -53, 1.4),
    sideWall("chimney-wall-east-1", 46.95, -56.1, 1, 1.2),
    sideWall("chimney-wall-east-2", 46.95, -61.9, 1, 1.2),
    candle("chimney-candle-1", 47.7, 8.1, -55.6, HALF_PI),
    candle("chimney-candle-2", 47.7, 8.1, -62.4, HALF_PI),
    candle("stair-candle-west-1", 37.3, 8.1, -67, -HALF_PI),
    candle("stair-candle-east-1", 44.7, 8.1, -67, HALF_PI),
    candle("stair-candle-west-2", 37.3, 8.4, -70.4, -HALF_PI),
    candle("stair-candle-east-2", 44.7, 8.4, -70.4, HALF_PI),
    candle("stair-candle-west-3", 37.3, 8.7, -73.8, -HALF_PI),
    candle("stair-candle-east-3", 44.7, 8.7, -73.8, HALF_PI),
    candle("rest-candle-west", 37.2, 9.2, -78.3, -HALF_PI),
    candle("rest-candle-east", 44.8, 9.2, -78.3, HALF_PI),
    door("rest-door", 41, -75.8, 1.2),
    candle("stair-candle-west-4", 37.3, 9.3, -82.8, -HALF_PI),
    candle("stair-candle-east-4", 44.7, 9.3, -82.8, HALF_PI),
    candle("stair-candle-west-5", 37.3, 9.6, -86.2, -HALF_PI),
    candle("stair-candle-east-5", 44.7, 9.6, -86.2, HALF_PI),
    tree("stair-tree-east", 51, -72, 3, 0.4),
    tree("stair-tree-west", 30.6, -78, 2.8, 1.3),
    // The sky courtyard and the sunset overlook.
    southWall("court-wall-west", 36.9, -88.2, 1.6),
    southWall("court-wall-east", 45.1, -88.2, 1.6),
    candle("court-candle-west-1", 32.4, 10.2, -91, -HALF_PI),
    candle("court-candle-west-2", 32.4, 10.2, -96, -HALF_PI),
    candle("court-candle-west-3", 32.4, 10.2, -101, -HALF_PI),
    candle("court-candle-west-4", 32.4, 10.2, -105, -HALF_PI),
    candle("court-candle-east-1", 49.6, 10.2, -91, HALF_PI),
    candle("court-candle-east-2", 49.6, 10.2, -96, HALF_PI),
    candle("court-candle-east-3", 49.6, 10.2, -101, HALF_PI),
    candle("court-candle-east-4", 49.6, 10.2, -105, HALF_PI),
    tree("court-tree-west-1", 28.4, -93, 2.6),
    tree("court-tree-west-2", 28.4, -102.6, 2.8, 0.7),
    tree("court-tree-east-1", 53.6, -95, 3, 1.1),
    tree("court-tree-east-2", 53.6, -104.6, 3.2, 0.2),
    // R12: the grand arch stands behind the finish, off the lane.
    decor("finish-arch", "butterfly-arch", { x: 41, y: GROUND, z: -114.3 }, { scale: 3.4 }),
  ];
}

/** The complete, validator-clean authored-level-v4 document for chapter B2. */
export function buildB2Level(): WorldEditorLevelDocument {
  return {
    schemaVersion: "authored-level-v4",
    id: B2_ROUTE_ID,
    theme: B2_THEME,
    pieces: structuredClone(PIECES) as AuthoredLevelPiece[],
    connections: structuredClone(CONNECTIONS) as AuthoredConnection[],
    mainPath: [...B2_MAIN_PATH],
    branches: B2_BRANCHES.map((branch) => [...branch]),
    anchors: anchors(),
    decor: decorPlacements(),
  };
}

// ---------------------------------------------------------------------------
// World data for the assembler and the chapter test (WORLD-SPEC copy, verbatim).
// ---------------------------------------------------------------------------

/** World B's fictional birth date (template validation only). */
export const WORLD_B_FICTIONAL_BIRTH_DATE = "2020-06-01";

/** B2's world-shell entry: ages 2 -> 4 on the fictional birthday. */
export const B2_SHELL_CHAPTER: WorldShellChapter = {
  chapterId: "family-b2",
  routeId: B2_ROUTE_ID,
  name: "The Magic House",
  subtitle: "Garden terraces and dancing tiles",
  description: "Climb the garden terraces and calm the dancing house at the top.",
  theme: B2_THEME,
  representedDateRange: { startDate: "2022-06-01", endDate: "2024-06-01" },
  recoveredAge: { fromYears: 2, toYears: 4 },
  previewMemories: [
    { slotId: "minor-one", date: "2022-11-12", label: "Garden picnic" },
    { slotId: "minor-two", date: "2023-08-19", label: "Splash day" },
    { slotId: "major", date: "2024-06-01", label: "Turning 4!" },
  ],
};

export const B2_PERIOD_ID = "magic-house-v1" as const;

const B2_ELIGIBILITY = { startDate: "2019-09-01", endDate: "2026-12-31" } as const;

/** R11: one ordinary identity, so all four ordinary anchors use its kind. */
export const B2_CAST: Readonly<{
  ordinary: LevelEditorEnemyCandidate;
  boss: LevelEditorEnemyCandidate;
}> = {
  ordinary: {
    id: "bin-chicken",
    name: "Bin Chicken",
    periodId: B2_PERIOD_ID,
    recognizableReference: "the cheeky bin-raiding ibis from a backyard cartoon dog family",
    visualJoke: "snatches snacks",
    obstacleOrAttack: "beak peck",
    eligibility: B2_ELIGIBILITY,
    role: "ordinary",
    kind: "ordinary-a",
    behaviorPreset: "ordinary-a",
  },
  boss: {
    id: "magic-house",
    name: "The Dancing House",
    periodId: B2_PERIOD_ID,
    recognizableReference: "a magical family house that dances",
    visualJoke: "shutters blink, tiles wiggle",
    obstacleOrAttack: "tile shimmy shockwave",
    eligibility: B2_ELIGIBILITY,
    role: "boss",
    kind: "boss",
    behaviorPreset: "boss",
  },
};

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) process.stdout.write(`${JSON.stringify(buildB2Level(), null, 2)}\n`);
