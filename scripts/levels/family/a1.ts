/**
 * World A, chapter 1: The Toon Clubhouse (PLAN-019, family world build).
 *
 * A deterministic generator for the chapter's whole authored-level-v4
 * document. It follows the A1 blueprint (Toon Clubhouse Hill) with every
 * mandatory critique fix and coordinator ruling applied; where they conflict,
 * the rulings win:
 *
 * - R1: the three-pad boing slide is the victory lap after the boss, and the
 *   major memory, the reward respawn and the finish share the party lawn at
 *   its foot, the final platform. Nothing leaves it.
 * - R2: every pad sits flush on its approach deck and 0.35 m from a landing
 *   whose side reaches down to the pad, so a partial stick always lands.
 * - R3: every required step heads −z or sideways; none heads toward the camera.
 * - R4: each strike envelope keeps at least 0.5 m inside its deck and off
 *   every exit strip and lift or pad approach.
 * - R5: minor-two sits on the tower balcony, the deck before the boss boing,
 *   and minor-one sits on the gear garden, one lift short of ordinary-3.
 * - R6: both lifts dwell 2 s at each stop beside flush landings (0.05 m).
 * - R7: the golden treetops end in a drop, not a spent move or a down-pad.
 * - R9: the chapter keeps the sandbox hops; its signature is the boing-slide
 *   descent into the memory. The windmill walk has one windmill, so World A
 *   keeps its twin-spinner lane for a later chapter.
 * - R10/D-07: three optional golden routes (a pad and skill route each, as the
 *   age-0 amendment allows), in route order: the toy stump (ticket 1), the
 *   golden treetops (ticket 2) and the crumbling hedge tops (ticket 3).
 * - R11: one ordinary identity, so all four ordinary anchors are ordinary-a.
 * - R12: decor uses only registered clubhouse-kit and shared props.
 *
 * Axes: x east, y up, the route runs toward −z. The course ground is y = −1.4.
 * Pieces are emitted in route order because checkpoint fallback walks the
 * piece array. No real names, dates or photos appear anywhere here.
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
  drop,
  jump,
  lift,
  mm,
  ride,
  walk,
  type WorldShellChapter,
} from "../lib/growth-kit.js";
import {
  A1_GROUND,
  anchorOn,
  block,
  checkpointOn,
  crumbleColumn,
  edges,
  encounterOn,
  groundProp,
  sandBlock,
  sized,
  slab,
  slider,
  spinner,
  tray,
  type A1Rect,
} from "./lib-a1.js";

export const FAMILY_A1_ROUTE_ID = "family-a1-clubhouse";
export const FAMILY_A1_THEME = "clubhouse" as const;

/**
 * The route claims the chapter test proves (the blueprint as amended): the
 * distinct standing levels the required route visits in order, its peak, and
 * the net height of the final platform.
 */
export const FAMILY_A1_CLAIMS = Object.freeze({
  /** Standing tiers (m) the required route reaches, ground to tower top. */
  levels: Object.freeze([0, 3, 7.6, 12.4, 14.8] as const),
  peak: 14.8,
  finishTop: 7,
  /** Big vertical moments on the required route, in order. */
  climbs: Object.freeze({
    hillBoing: 2.4,
    cliffLift: 4,
    towerLift: 3.6,
    towerBoing: 2.4,
    /** The boing slide: three pad descents from the tower top to the party lawn. */
    slideDescent: 7.8,
  }),
});

// Standing heights.
const MEADOW = 0;
const SAND = -0.3;
const GREEN = 0.3;
const HILL = 3;
const WINDMILL = 3.3;
const PLATEAU = 3.6;
const PORCH = 7.6;
const CLUBHOUSE = 8.8;
const BALCONY = 12.4;
const TOWER = 14.8;
const CUSHION_1 = 12.2;
const CUSHION_2 = 9.6;
const PARTY = 7;

/** R2: the gap from each pad to its landing. */
const PAD_GAP = 0.35;
/** R6: flush lift landings. */
const LIFT_GAP = 0.05;
/** R6: seconds each lift waits at both stops (World A needs at least 1.5 s). */
const LIFT_DWELL = 2;

// ---------------------------------------------------------------------------
// Footprints (edges in metres).
// ---------------------------------------------------------------------------

const R = {
  meadow: sized(0, 0, 12, 10),
  sandpit: sized(0, -15.2, 12, 21.6),
  hop1: sized(1.2, -7, 5, 3.2),
  hop2: sized(-1.2, -11, 5, 3.2),
  hop3: sized(1.2, -15, 5, 3.2),
  hop4: sized(-1.2, -19, 5, 3.2),
  hop5: sized(1.2, -23, 5, 3.2),
  green: sized(0, -29.4, 10, 8),
  curl1: sized(-7.4, -31.4, 4, 4),
  curl2: sized(-8.4, -36.4, 4, 4),
  curl3: sized(-6.4, -41.4, 4, 4),
  lawn: sized(-3.4, -47.4, 7, 6),
  hillPad: edges(-4.4, -2.4, -52.4, -50.4),
  hill: edges(-10.4, 3.6, -65, -52.4 - PAD_GAP),
  windmill: sized(-3.4, -72, 7, 12),
  picnic: sized(-3.4, -83.5, 12, 9),
  tray1: sized(-3.4, -91, 4.4, 4),
  island: sized(-3.4, -96, 7, 4),
  tray2: sized(-3.4, -101, 4.4, 4),
  garden: sized(-3.4, -109.5, 14, 11),
  cliffLift: edges(-5, -1.8, -118.4 + LIFT_GAP, -115 - LIFT_GAP),
  porch: sized(-3.4, -124.4, 14, 12),
  cup1: sized(-12.8, -126.4, 4, 4),
  teacup: sized(-19.8, -126.4, 8, 8),
  cup3: sized(-19.8, -133.4, 4, 4),
  clubhouse: sized(-19.8, -141, 12, 10),
  towerLift: edges(-29.2 + LIFT_GAP, -25.8 - LIFT_GAP, -143.5, -140.5),
  balcony: edges(-43.2, -29.2, -147, -135),
  towerPad: edges(-36.2, -34.2, -149, -147),
  tower: edges(-43.2, -27.2, -163.6, -149 - PAD_GAP),
  slideTop: edges(-40.2, -30.2, -169.6, -163.6),
  slidePad1: edges(-30.2, -28.2, -167.6, -165.6),
  cushion1: edges(-28.2 + PAD_GAP, -21.85, -169.6, -163.6),
  slidePad2: edges(-21.85, -19.85, -167.6, -165.6),
  cushion2: edges(-19.85 + PAD_GAP, -13.5, -169.6, -163.6),
  slidePad3: edges(-13.5, -11.5, -167.6, -165.6),
  party: edges(-11.5 + PAD_GAP, 0.85, -171.6, -161.6),
  // B3: the toy-stump lookout beside the curly path (east).
  b3Pad: edges(5, 7, -32.4, -30.4),
  b3Stump: edges(7 + PAD_GAP, 10.35, -32.9, -29.9),
  b3Hop1: sized(8.85, -35.6, 3, 3),
  b3Hop2: sized(8.2, -39.8, 3, 3),
  b3Hop3: sized(6.8, -44, 3, 3),
  b3Hop4: sized(2.6, -46, 4, 3),
  // B1: the golden treetops west of the picnic plateau.
  b1Pad: edges(-11.4, -9.4, -84.5, -82.5),
  b1Deck: edges(-16.75, -11.4 - PAD_GAP, -86.5, -80.5),
  b1Perch: sized(-13, -89.2, 3, 3),
  b1Plank: sized(-11.4, -93.6, 4, 3),
  b1Golden: sized(-9.9, -97.6, 4, 3),
  // B2: the crumbling hedge tops past the teacups.
  b2Hedge1: sized(-6.4, -132.2, 2.4, 2.4),
  b2Hedge2: sized(-10, -133.6, 2.4, 2.4),
  b2Hedge3: sized(-11.6, -137.4, 3, 3),
} satisfies Record<string, A1Rect>;

// ---------------------------------------------------------------------------
// Static decks, shared by the piece list and the anchors.
// ---------------------------------------------------------------------------

const P = {
  meadow: block("meadow-start", R.meadow, MEADOW),
  sandpit: slab("sandpit", R.sandpit, SAND, 1.1),
  hop1: sandBlock("hop-1", R.hop1, 0.3, SAND),
  hop2: sandBlock("hop-2", R.hop2, 0.6, SAND),
  hop3: sandBlock("hop-3", R.hop3, 0.9, SAND),
  hop4: sandBlock("hop-4", R.hop4, 0.6, SAND),
  hop5: sandBlock("hop-5", R.hop5, 0.3, SAND),
  green: block("toolshed-green", R.green, GREEN),
  curl1: block("curl-1", R.curl1, 0.6),
  curl2: block("curl-2", R.curl2, 0.9),
  curl3: block("curl-3", R.curl3, 0.9),
  lawn: block("bounce-lawn", R.lawn, 0.6),
  hill: block("hill-terrace", R.hill, HILL),
  windmill: block("windmill-walk", R.windmill, WINDMILL),
  picnic: block("picnic-plateau", R.picnic, PLATEAU),
  island: block("gear-island", R.island, PLATEAU),
  garden: block("gear-garden", R.garden, PLATEAU),
  porch: block("porch-lawn", R.porch, PORCH),
  cup1: block("cup-1", R.cup1, 7.9),
  teacup: block("teacup-deck", R.teacup, 8.2),
  cup3: block("cup-3", R.cup3, 8.5),
  clubhouse: block("clubhouse-porch", R.clubhouse, CLUBHOUSE),
  balcony: block("tower-balcony", R.balcony, BALCONY),
  tower: block("tower-top", R.tower, TOWER),
  slideTop: block("slide-top", R.slideTop, TOWER),
  cushion1: block("cushion-1", R.cushion1, CUSHION_1),
  cushion2: block("cushion-2", R.cushion2, CUSHION_2),
  party: block("party-lawn", R.party, PARTY),
  b3Stump: block("b3-stump", R.b3Stump, 1.6),
  b3Hop1: block("b3-hop-1", R.b3Hop1, 1.3),
  b3Hop2: block("b3-hop-2", R.b3Hop2, 1),
  b3Hop3: block("b3-hop-3", R.b3Hop3, 0.7),
  b3Hop4: block("b3-hop-4", R.b3Hop4, 0.7),
  b1Deck: block("b1-deck", R.b1Deck, 4.9),
  b1Perch: block("b1-perch-1", R.b1Perch, 5.2),
  b1Golden: block("b1-golden-perch", R.b1Golden, 5.5),
  b2Hedge3: block("b2-hedge-3", R.b2Hedge3, 8.5),
};

function pad(id: string, rect: A1Rect, top: number, strength: "small" | "big") {
  return bouncePad(id, {
    x: mm((rect.minX + rect.maxX) / 2),
    z: mm((rect.minZ + rect.maxZ) / 2),
    sizeX: mm(rect.maxX - rect.minX),
    sizeZ: mm(rect.maxZ - rect.minZ),
    top,
    thickness: mm(top - A1_GROUND),
    strength,
  });
}

function liftBetween(
  id: string,
  rect: A1Rect,
  bottomTop: number,
  distance: number,
) {
  return lift(id, {
    x: mm((rect.minX + rect.maxX) / 2),
    z: mm((rect.minZ + rect.maxZ) / 2),
    sizeX: mm(rect.maxX - rect.minX),
    sizeZ: mm(rect.maxZ - rect.minZ),
    bottomTop,
    distance,
    period: 8,
    thickness: 0.4,
    dwell: LIFT_DWELL,
  });
}

/** Every piece in route order: checkpoint fallback walks this array. */
function pieces(): AuthoredLevelPiece[] {
  return [
    // S0 Meadow start: spawn, mallet, friendly-1.
    P.meadow,
    checkpointOn("cp-meadow", P.meadow, 0, 2.5),
    // S1 Sandbox hops over the sandpit catch floor (the practice strip).
    P.sandpit,
    P.hop1,
    P.hop2,
    P.hop3,
    P.hop4,
    P.hop5,
    P.green,
    checkpointOn("cp-green", P.green, 0, -26.6),
    // S2 Curly path, bending west then north.
    P.curl1,
    P.curl2,
    P.curl3,
    // S3 Bounce lawn and the big boing up the hill.
    P.lawn,
    checkpointOn("cp-lawn", P.lawn, -3.4, -45.4),
    pad("hill-pad", R.hillPad, 0.6, "big"),
    // S4 Hill terrace: fight 1.
    P.hill,
    checkpointOn("cp-hill", P.hill, -3.4, -54.4),
    // S5 Windmill walk: one big windmill with side lanes.
    P.windmill,
    checkpointOn("cp-windmill", P.windmill, -5.9, -66.8),
    spinner("windmill", { x: -3.4, z: -72 }, WINDMILL, 1.8, 10),
    // S6 Picnic plateau: the golden treetops fork.
    P.picnic,
    checkpointOn("cp-picnic", P.picnic, -3.4, -80.2),
    // S7 Gizmo trays and the rest island.
    tray("tray-1", R.tray1, PLATEAU, { axis: "x", distance: 1.2, period: 9 }),
    P.island,
    checkpointOn("cp-island", P.island, -3.4, -96),
    tray("tray-2", R.tray2, PLATEAU, { axis: "x", distance: 1.2, period: 9, phase: Math.PI }),
    // S8 Gear garden: minor-one at the entry, then fight 2.
    P.garden,
    checkpointOn("cp-gear", P.garden, 0.6, -105.2),
    // S9 Cliff lift up to the porch lawn.
    liftBetween("cliff-lift", R.cliffLift, PLATEAU, PORCH - PLATEAU),
    // S10 Porch lawn: fight 3 and the hedge-top fork.
    P.porch,
    checkpointOn("cp-porch", P.porch, -3.4, -119.8),
    // S11 Teacup hops around the deck spinner.
    P.cup1,
    P.teacup,
    checkpointOn("cp-teacup", P.teacup, -16.6, -123.2),
    spinner("teacup-spinner", { x: -19.8, z: -126.4 }, 8.2, 2, 10),
    P.cup3,
    // S12 Clubhouse porch: friendly-2 before the tower.
    P.clubhouse,
    checkpointOn("cp-clubhouse", P.clubhouse, -19.8, -137.2),
    // S13 Tower lift (lateral) and the balcony: minor-two and fight 4.
    liftBetween("tower-lift", R.towerLift, CLUBHOUSE, BALCONY - CLUBHOUSE),
    P.balcony,
    checkpointOn("cp-balcony", P.balcony, -31.2, -141),
    slider("mop-sweeper", { x: -35.2, z: -146.2 }, BALCONY, 1.2, {
      axis: "x",
      distance: 3,
      period: 7,
      phase: Math.PI / 2,
    }),
    // S14 The tower boing.
    pad("tower-pad", R.towerPad, BALCONY, "big"),
    // S15 Tower top: the boss.
    P.tower,
    checkpointOn("cp-boss", P.tower, -35.2, -150.8),
    // S16 Slide top and the boing slide down to the party lawn (R1: the
    // victory lap into the major memory; checkpoints are cleared after the
    // boss, so this stretch carries none).
    P.slideTop,
    pad("slide-pad-1", R.slidePad1, TOWER, "big"),
    P.cushion1,
    pad("slide-pad-2", R.slidePad2, CUSHION_1, "big"),
    P.cushion2,
    pad("slide-pad-3", R.slidePad3, CUSHION_2, "big"),
    P.party,
    // B3 Toy-stump lookout (golden ticket 1 on the stump).
    pad("b3-pad", R.b3Pad, GREEN, "small"),
    P.b3Stump,
    P.b3Hop1,
    P.b3Hop2,
    P.b3Hop3,
    P.b3Hop4,
    // B1 Golden treetops (golden ticket 2), ending in a drop to the island.
    pad("b1-pad", R.b1Pad, PLATEAU, "small"),
    P.b1Deck,
    checkpointOn("cp-b1", P.b1Deck, -14.25, -81.6),
    P.b1Perch,
    tray("b1-plank", R.b1Plank, 5.2, { axis: "x", distance: 0.8, period: 7 }),
    P.b1Golden,
    // B2 Hedge tops (golden ticket 3 on the last, solid hedge).
    crumbleColumn("b2-hedge-1", R.b2Hedge1, 7.9),
    crumbleColumn("b2-hedge-2", R.b2Hedge2, 8.2),
    P.b2Hedge3,
  ];
}

function connections(): AuthoredConnection[] {
  const practice = { safeMissPlatformId: "sandpit" } as const;
  return [
    // Practice strip: every hop over the sandpit may be missed safely.
    jump("meadow-start", "hop-1", practice),
    jump("hop-1", "hop-2", practice),
    jump("hop-2", "hop-3", practice),
    jump("hop-3", "hop-4", practice),
    jump("hop-4", "hop-5", practice),
    jump("hop-5", "toolshed-green"),
    jump("sandpit", "meadow-start"),
    // Required route.
    jump("toolshed-green", "curl-1"),
    jump("curl-1", "curl-2"),
    jump("curl-2", "curl-3"),
    jump("curl-3", "bounce-lawn"),
    walk("bounce-lawn", "hill-pad"),
    bounce("hill-pad", "hill-terrace"),
    jump("hill-terrace", "windmill-walk"),
    jump("windmill-walk", "picnic-plateau"),
    ride("picnic-plateau", "tray-1"),
    ride("tray-1", "gear-island"),
    ride("gear-island", "tray-2"),
    ride("tray-2", "gear-garden"),
    ride("gear-garden", "cliff-lift"),
    ride("cliff-lift", "porch-lawn"),
    jump("porch-lawn", "cup-1"),
    jump("cup-1", "teacup-deck"),
    jump("teacup-deck", "cup-3"),
    jump("cup-3", "clubhouse-porch"),
    ride("clubhouse-porch", "tower-lift"),
    ride("tower-lift", "tower-balcony"),
    walk("tower-balcony", "tower-pad"),
    bounce("tower-pad", "tower-top"),
    walk("tower-top", "slide-top"),
    walk("slide-top", "slide-pad-1"),
    bounce("slide-pad-1", "cushion-1"),
    walk("cushion-1", "slide-pad-2"),
    bounce("slide-pad-2", "cushion-2"),
    walk("cushion-2", "slide-pad-3"),
    bounce("slide-pad-3", "party-lawn"),
    // B3 Toy-stump lookout.
    walk("toolshed-green", "b3-pad"),
    bounce("b3-pad", "b3-stump"),
    jump("b3-stump", "b3-hop-1"),
    jump("b3-hop-1", "b3-hop-2"),
    jump("b3-hop-2", "b3-hop-3"),
    jump("b3-hop-3", "b3-hop-4"),
    jump("b3-hop-4", "bounce-lawn"),
    // B1 Golden treetops.
    walk("picnic-plateau", "b1-pad"),
    bounce("b1-pad", "b1-deck"),
    jump("b1-deck", "b1-perch-1"),
    ride("b1-perch-1", "b1-plank"),
    ride("b1-plank", "b1-golden-perch"),
    drop("b1-golden-perch", "gear-island"),
    // B2 Hedge tops.
    jump("porch-lawn", "b2-hedge-1"),
    jump("b2-hedge-1", "b2-hedge-2"),
    jump("b2-hedge-2", "b2-hedge-3"),
    jump("b2-hedge-3", "clubhouse-porch"),
  ];
}

const MAIN_PATH = [
  "meadow-start",
  "hop-1",
  "hop-2",
  "hop-3",
  "hop-4",
  "hop-5",
  "toolshed-green",
  "curl-1",
  "curl-2",
  "curl-3",
  "bounce-lawn",
  "hill-pad",
  "hill-terrace",
  "windmill-walk",
  "picnic-plateau",
  "tray-1",
  "gear-island",
  "tray-2",
  "gear-garden",
  "cliff-lift",
  "porch-lawn",
  "cup-1",
  "teacup-deck",
  "cup-3",
  "clubhouse-porch",
  "tower-lift",
  "tower-balcony",
  "tower-pad",
  "tower-top",
  "slide-top",
  "slide-pad-1",
  "cushion-1",
  "slide-pad-2",
  "cushion-2",
  "slide-pad-3",
  "party-lawn",
] as const;

/** Branches in route order, so the trail planner numbers the tickets 1–3 along the way. */
const BRANCHES = [
  ["toolshed-green", "b3-pad", "b3-stump", "b3-hop-1", "b3-hop-2", "b3-hop-3", "b3-hop-4", "bounce-lawn"],
  ["picnic-plateau", "b1-pad", "b1-deck", "b1-perch-1", "b1-plank", "b1-golden-perch", "gear-island"],
  ["porch-lawn", "b2-hedge-1", "b2-hedge-2", "b2-hedge-3", "clubhouse-porch"],
] as const;

function anchors(): WorldEditorLevelDocument["anchors"] {
  return {
    spawn: anchorOn(P.meadow, 0, 2.5),
    finish: anchorOn(P.party, -0.8, -168.6),
    rewardRespawn: anchorOn(P.party, -8.2, -165),
    pickups: {
      "attack-tool": anchorOn(P.meadow, 1.5, -1.5),
      "guard-tool": anchorOn(P.green, -2, -30.2),
    },
    memories: {
      // R5: at the gear-garden entry, collected before fight 2 and one lift
      // short of fight 3.
      "minor-one": anchorOn(P.garden, -3.4, -105.8),
      // R5: on the deck before the boss boing.
      "minor-two": anchorOn(P.balcony, -31.2, -138.2),
      // R1: the major memory ends the chapter on the final platform.
      major: anchorOn(P.party, -4.2, -166.6),
    },
    encounters: {
      "ordinary-1": encounterOn(P.hill, "ordinary-a", edges(-7.4, 0.6, -62, -58), "cp-hill"),
      "ordinary-2": encounterOn(P.garden, "ordinary-a", edges(-7.4, 0.6, -112, -108), "cp-gear"),
      "ordinary-3": encounterOn(P.porch, "ordinary-a", edges(-7.4, 0.6, -127.5, -123.5), "cp-porch"),
      "ordinary-4": encounterOn(P.balcony, "ordinary-a", edges(-41, -35, -141.5, -137.5), "cp-balcony"),
      boss: encounterOn(P.tower, "boss", edges(-39.2, -31.2, -159.6, -154.6), "cp-boss"),
    },
    friendlies: {
      "friendly-1": anchorOn(P.meadow, -3.5, 2.5),
      "friendly-2": anchorOn(P.clubhouse, -16.2, -139.4),
      // An optional healer on the golden treetops.
      "friendly-3": anchorOn(P.b1Deck, -15.25, -85),
    },
  };
}

const QUARTER = Math.PI / 2;

/** One prop per z value, all at the same x, scale and turn. */
function row(
  prefix: string,
  kitPropId: string,
  x: number,
  zs: readonly number[],
  options: { readonly rotationY?: number; readonly scale?: number },
): AuthoredDecor[] {
  return zs.map((z, index) => groundProp(`${prefix}-${index + 1}`, kitPropId, x, z, options));
}

/**
 * Placed props (R12): only the clubhouse kit and the shared kit, all standing
 * on the course ground beside the decks, never inside a walkable volume,
 * connection strip or fight area (the validator's decor rule), and never
 * across a lane. The clubhouse props draw their procedural stand-ins until
 * the WO111 kit lands, at exactly these registered bounds.
 */
function decorPlacements(): AuthoredDecor[] {
  const tree = "clearing-tree";
  const hedge = "rounded-hedge";
  return [
    // Meadow and sandbox: a tree line, giant toy blocks in the sand margins
    // and two wind-up lanterns beside the spawn.
    ...row("meadow-tree-west", tree, -9.5, [3, -4, -11, -18, -25], { scale: 1.4 }),
    ...row("meadow-tree-east", tree, 9.5, [3, -4, -11, -18], { scale: 1.4 }),
    groundProp("sand-blocks-1", "toybox-block-tower", -7.8, -7, { scale: 1.3 }),
    groundProp("sand-blocks-2", "toybox-block-tower", 7.8, -14.6, { rotationY: QUARTER, scale: 1.3 }),
    groundProp("sand-blocks-3", "toybox-block-tower", -7.8, -20.5, { scale: 1.3 }),
    groundProp("meadow-lantern-west", "toybox-windup-lantern", -7.6, 4.6, { scale: 2.2 }),
    groundProp("meadow-lantern-east", "toybox-windup-lantern", 7.6, 4.6, { scale: 2.2 }),
    groundProp("toolshed-stand", "gadget-toolbox-stand", 7.8, -26.8, { scale: 2 }),
    // Curly path: stones, then hedges where it turns north to the lawn.
    ...row("curl-stone", "clearing-stone", -13.2, [-31, -36, -41], { scale: 1.5 }),
    groundProp("curl-hedge-1", hedge, -11.8, -45.2, { rotationY: QUARTER, scale: 1.2 }),
    groundProp("curl-hedge-2", hedge, -9.2, -47.6, { scale: 1.2 }),
    // Hill, windmill and picnic cliffs: hedges at the foot, woods beyond.
    ...row("hill-hedge-east", hedge, 4.6, [-55.5, -60, -64], { rotationY: QUARTER, scale: 1.5 }),
    ...row("hill-hedge-west", hedge, -11.4, [-55.5, -60, -64], { rotationY: QUARTER, scale: 1.5 }),
    ...row("windmill-hedge-east", hedge, 1.2, [-68, -72, -76], { rotationY: QUARTER, scale: 1.5 }),
    ...row("windmill-hedge-west", hedge, -8, [-68, -72, -76], { rotationY: QUARTER, scale: 1.5 }),
    ...row("picnic-hedge-east", hedge, 3.6, [-81, -86], { rotationY: QUARTER, scale: 1.5 }),
    groundProp("picnic-hedge-west", hedge, -10.4, -80.2, { rotationY: QUARTER, scale: 1.2 }),
    ...row("hill-tree-east", tree, 10, [-56, -64, -72, -80], { scale: 2 }),
    ...row("hill-tree-west", tree, -16, [-58, -66, -74], { scale: 2 }),
    // Gizmo trays: the runaway gadgets' toolboxes on the ground below.
    groundProp("tray-toolbox-east", "gadget-toolbox-stand", 3.8, -96, { rotationY: QUARTER, scale: 2.5 }),
    groundProp("tray-toolbox-west", "gadget-toolbox-stand", -8.4, -89.9, { scale: 1.6 }),
    // Golden treetops: the canopy the treetop route hops across.
    ...[
      [-19.6, -82],
      [-19.2, -89],
      [-17.6, -96],
    ].map(([x, z], index) => groundProp(`treetop-${index + 1}`, tree, x!, z!, { scale: 1.8 })),
    // Gear garden and the cliff: woods on both sides.
    ...row("garden-tree-east", tree, 10.5, [-104, -112], { scale: 2.4 }),
    ...row("garden-tree-west", tree, -15, [-106, -113], { scale: 2.4 }),
    // Porch lawn: hedges along the cliff top edge, tall woods below it.
    ...row("porch-hedge-east", hedge, 4.6, [-121, -125, -129], { rotationY: QUARTER, scale: 1.5 }),
    ...row("porch-tree-east", tree, 10, [-120, -128], { scale: 3 }),
    ...row("teacup-hedge-west", hedge, -24.8, [-124, -128.6], { rotationY: QUARTER, scale: 1.5 }),
    // The clubhouse behind its porch, and the tower's walls. The tower and
    // balcony walls stop about 2 m below their decks, so no wall top reads
    // as a ledge beside a deck (decor has no collision).
    groundProp("clubhouse-facade", "clubhouse-tower-facade", -19.8, -147.4, { scale: 2.2 }),
    groundProp("balcony-facade-west", "clubhouse-tower-facade", -44.4, -141, { rotationY: QUARTER, scale: 1.8 }),
    groundProp("tower-facade-west", "clubhouse-tower-facade", -44.6, -156.5, { rotationY: QUARTER, scale: 2.2 }),
    groundProp("tower-facade-east", "clubhouse-tower-facade", -25.8, -156.5, { rotationY: QUARTER, scale: 2.2 }),
    // The curly slide stands west of the slide top, away from the boing
    // slide's eastward line (it has no collision).
    groundProp("curly-slide", "curly-slide", -46.4, -169, { scale: 4 }),
    // Party lawn: the arrival sign across the void behind it and giant toy
    // blocks well beyond jumping reach beside it.
    groundProp("party-arrival", "arrival-landmark", -5.2, -175.5, { scale: 3.5 }),
    groundProp("party-blocks-east-1", "toybox-block-tower", 6.8, -163.4, { scale: 4 }),
    groundProp("party-blocks-east-2", "toybox-block-tower", 6.4, -169.6, { scale: 3.4 }),
    // Toy-stump lookout: trees and stones east of the stump hops.
    ...row("b3-tree", tree, 13.8, [-34, -42], { scale: 1.3 }),
    ...row("b3-stone", "clearing-stone", 12, [-28.4, -37.2, -39.6], { scale: 1.2 }),
  ];
}

/**
 * The complete authored-level-v4 document for World A chapter 1. Pure: every
 * call returns a fresh, equal document that shares nothing with the module,
 * so the world assembler replays byte-identically.
 */
export function familyA1Level(): WorldEditorLevelDocument {
  return structuredClone({
    schemaVersion: "authored-level-v4",
    id: FAMILY_A1_ROUTE_ID,
    theme: FAMILY_A1_THEME,
    pieces: pieces(),
    connections: connections(),
    mainPath: [...MAIN_PATH],
    branches: BRANCHES.map((branch) => [...branch]),
    anchors: anchors(),
    decor: decorPlacements(),
  } satisfies WorldEditorLevelDocument);
}

// ---------------------------------------------------------------------------
// World-assembly data (WORLD-SPEC copy, verbatim). The world assembler owns
// the chapter list; these are the A1 rows it needs.
// ---------------------------------------------------------------------------

/** The fictional template birth date for World A (template validation only). */
export const FAMILY_WORLD_A_FICTIONAL_BIRTH_DATE = "2015-01-15";

/** A1's world-shell row: ages 0 → 2 from the fictional birth date. */
export function familyA1ShellChapter(chapterId: string): WorldShellChapter {
  return {
    chapterId,
    routeId: FAMILY_A1_ROUTE_ID,
    name: "The Toon Clubhouse",
    subtitle: "Gadgets on the loose",
    description:
      "Bounce up the hill, ride the cliff lift and climb the clubhouse tower to face the bully cat.",
    theme: FAMILY_A1_THEME,
    representedDateRange: { startDate: "2015-01-15", endDate: "2017-01-15" },
    recoveredAge: { fromYears: 0, toYears: 2 },
    previewMemories: [
      { slotId: "minor-one", date: "2015-09-20", label: "Sandbox morning" },
      { slotId: "minor-two", date: "2016-06-18", label: "Summer picnic" },
      { slotId: "major", date: "2017-01-15", label: "Turning 2!" },
    ],
  };
}

/**
 * A1's cast as project candidates (catalog v7 has no toon-clubhouse entries
 * yet): one ordinary identity for all four ordinary slots (R11) and the boss.
 */
export const FAMILY_A1_CAST: Readonly<{
  ordinary: LevelEditorEnemyCandidate;
  boss: LevelEditorEnemyCandidate;
}> = Object.freeze({
  ordinary: {
    id: "gadget-helper",
    name: "Runaway Gadget",
    periodId: "toon-clubhouse-v1",
    recognizableReference: "clubhouse toolbox helper gone haywire",
    visualJoke: "its silly arm grabs the wrong tool",
    obstacleOrAttack: "swings a wrench arm",
    eligibility: { startDate: "2006-05-05", endDate: "2016-11-06" },
    role: "ordinary",
    kind: "ordinary-a",
    behaviorPreset: "ordinary-a",
  },
  boss: {
    id: "clubhouse-bully-cat",
    name: "Captain Bully Cat",
    periodId: "toon-clubhouse-v1",
    recognizableReference: "classic toon-clubhouse bully cat captain",
    visualJoke: "peg-leg swagger and a big belly bounce",
    obstacleOrAttack: "stomps and belly-bumps",
    eligibility: { startDate: "2006-05-05", endDate: "2016-11-06" },
    role: "boss",
    kind: "boss",
    behaviorPreset: "boss",
  },
});
