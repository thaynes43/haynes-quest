/**
 * Family World A, chapter A2 "Harbor Rescue" (PLAN-019; theme `harbor`;
 * recovered ages 2 -> 5; moves at the start: jump and high jump).
 *
 * A deterministic authored-level-v4 generator. The course is a staircase of
 * three legs, and no required step runs toward the default camera (ruling
 * R3: the camera faces -z at chapter start and on every retry):
 *
 *   Leg 1, the harbor (x = 0, heading -z). The chapter opens with a dock ride
 *   across three bobbing rescue boats (R9). Then come the high-jump practice
 *   dunes over a sandbar catch floor, the sea-wall fight, the barrel-boom
 *   pier, a tugboat hop and the fish-market fight.
 *
 *   Leg 2, the rooftops (heading -x). The cargo lift rises 3.6 m to the crane
 *   roof (the first minor memory). A chimney, the weathervane spinner, a
 *   rooftop trolley and the laundry-roof fight follow.
 *
 *   Leg 3, the lookout (x = -40, heading -z). The trampoline launches 2.4 m to
 *   the clock roof. Then come the awnings, the town-hall fight, the gondola,
 *   the signal boom and the plaza (the second minor memory). Four high jumps
 *   at the move's full 0.7 m rise climb the tower over a catch ring: the move
 *   practised on the dunes, reused at the climax. The rival mayor waits on
 *   the lookout deck, and one last high jump reaches the beacon crown, where
 *   the major memory ends the chapter (R1).
 *
 * Optional branches: the crow's nest (three high jumps up, a drop down and a
 * golden bone), the laundry annex (the bonus fight) and the water tower (a
 * small bounce, then down the signs).
 *
 * `familyA2Level()` returns the same plain JSON on every call. The world
 * assembler hands it to `chapterCommands(chapterId).replaceLevel(...)` and
 * assigns the cast: the mischief kitten to every ordinary slot and bonus-1
 * (kind ordinary-a, ruling R11), and the rival mayor to the boss. The shared
 * validator and the family lints decide whether the level is safe; see
 * `tests/levels/family-a2.test.ts`.
 */
import {
  AUTHORED_LEVEL_LIMITS,
  type AuthoredAnchor,
  type AuthoredArena,
  type AuthoredConnection,
  type AuthoredDecor,
  type AuthoredEncounterAnchor,
  type AuthoredLevelPiece,
  type AuthoredMovingPlatformPiece,
  type AuthoredPosition,
  type AuthoredSweeperPiece,
} from "../../../src/shared/authored-level.js";
import type {
  LevelEditorEnemyCandidate,
  WorldEditorLevelDocument,
} from "../../../src/shared/editor-project.js";
import { FAMILY_WORLD_LINT_PRESETS } from "../../../src/shared/family-world-lint.js";
import {
  bounce,
  bouncePad,
  decor,
  drop,
  jump,
  lift,
  mm,
  platform,
  platformCheckpoint,
  ride,
  walk,
  type SurfaceSpec,
} from "../lib/growth-kit.js";

export const FAMILY_A2_ROUTE_ID = "family-a2-harbor";
export const FAMILY_A2_THEME = "harbor" as const;
/** Recovered ages the chapter spans (World A, chapter 2). */
export const FAMILY_A2_AGES = Object.freeze({ fromYears: 2, toYears: 5 });

/** Metres from a standing top down to the scene's water plane (y = -1.4). */
const WATER_DEPTH = 1.4;
/** Strike reach beyond an arena. */
const ORDINARY_REACH = AUTHORED_LEVEL_LIMITS.ordinaryAttackReach;
const BOSS_REACH = AUTHORED_LEVEL_LIMITS.bossAttackReach;
/** R4 (World A): each strike envelope keeps this much inside its deck. */
const DECK_MARGIN = FAMILY_WORLD_LINT_PRESETS.a.strikeDeckMargin;
/**
 * An envelope keeps this far from a deck edge that carries an entry or exit
 * strip: the avatar radius plus the 0.75 m gateway strip, and 0.1 m to spare.
 */
const STRIP_CLEARANCE = AUTHORED_LEVEL_LIMITS.supportEdgeClearance + 0.75 + 0.1;

type Range = readonly [min: number, max: number];

const mid = (range: Range) => (range[0] + range[1]) / 2;
const span = (range: Range) => range[1] - range[0];
/** The next deck toward -z (or -x): `gap` beyond `previous`'s low edge, `size` deep. */
const beyond = (previous: Range, gap: number, size: number): Range => [
  previous[0] - gap - size,
  previous[0] - gap,
];
const alongX = (range: Range) => ({ x: mid(range), sizeX: span(range) });
const alongZ = (range: Range) => ({ z: mid(range), sizeZ: span(range) });

/** A static deck whose box reaches down to the water unless a thickness is given. */
function deck(
  id: string,
  spec: Omit<SurfaceSpec, "thickness"> & { readonly thickness?: number },
) {
  return platform(id, { ...spec, thickness: spec.thickness ?? spec.top + WATER_DEPTH });
}

function mover(
  id: string,
  x: number,
  top: number,
  z: number,
  size: readonly [x: number, z: number],
  motion: AuthoredMovingPlatformPiece["motion"],
): AuthoredMovingPlatformPiece {
  return {
    type: "moving-platform",
    id,
    center: at(x, top - 0.25, z),
    size: at(size[0], 0.5, size[1]),
    motion,
  };
}

function slider(id: string, x: number, top: number, z: number, period: number): AuthoredSweeperPiece {
  return {
    type: "sweeper",
    id,
    center: at(x, top + 0.22, z),
    halfLength: 1,
    radius: 0.18,
    motion: { axis: "x", distance: 2, period },
  };
}

function at(x: number, y: number, z: number): AuthoredPosition {
  return { x: mm(x), y: mm(y), z: mm(z) };
}

function anchor(platformId: string, x: number, y: number, z: number): AuthoredAnchor {
  return { platformId, position: at(x, y, z) };
}

function encounter(
  kind: AuthoredEncounterAnchor["kind"],
  platformId: string,
  position: AuthoredPosition,
  arena: AuthoredArena,
  checkpointId: string,
): AuthoredEncounterAnchor {
  const bounds = {
    minX: mm(arena.minX),
    maxX: mm(arena.maxX),
    minZ: mm(arena.minZ),
    maxZ: mm(arena.maxZ),
  };
  return { kind, platformId, position, arena: bounds, checkpointId };
}

/**
 * The largest arena whose strike envelope keeps `DECK_MARGIN` inside the
 * deck, and `STRIP_CLEARANCE` from each edge named in `strips` (an edge that
 * a connection, pad or lift uses).
 */
function fightArena(
  deckX: Range,
  deckZ: Range,
  reach: number,
  strips: Partial<Record<"minX" | "maxX" | "minZ" | "maxZ", true>>,
): AuthoredArena {
  const keep = (edge: "minX" | "maxX" | "minZ" | "maxZ") =>
    reach + (strips[edge] ? STRIP_CLEARANCE : DECK_MARGIN);
  return {
    minX: deckX[0] + keep("minX"),
    maxX: deckX[1] - keep("maxX"),
    minZ: deckZ[0] + keep("minZ"),
    maxZ: deckZ[1] - keep("maxZ"),
  };
}

// ---------------------------------------------------------------------------
// Geometry. Each deck is placed from the previous deck's edge and a gap, so
// the tables read like the route. Tops are standing heights.
// ---------------------------------------------------------------------------

const TOP = Object.freeze({
  dock: 0,
  boat: 0,
  beach: 0,
  sandbar: -0.01,
  dune1: 0.6,
  dune2: 1.2,
  dune3: 1.8,
  seaWall: 1.8,
  pier: 1.8,
  tug: 1.8,
  market: 1.8,
  crane: 5.4,
  chimney: 5.7,
  vane: 6.0,
  trolley: 6.3,
  laundry: 6.6,
  clock: 9.0,
  awning1: 9.3,
  awning2: 9.6,
  hall: 9.6,
  gondola: 9.6,
  signal: 9.6,
  plaza: 9.9,
  ring: 9.89,
  step1: 10.6,
  step2: 11.3,
  step3: 12.0,
  deck: 12.7,
  crown: 13.4,
});

/** Leg 1 runs down x = 0 toward -z: [minZ, maxZ] of each deck. */
const L1 = (() => {
  const dock: Range = [-5, 5];
  const boat1 = beyond(dock, 1, 3.6);
  const boat2 = beyond(boat1, 1, 3.6);
  const boat3 = beyond(boat2, 1, 3.6);
  const beach = beyond(boat3, 1, 7);
  const dune1 = beyond(beach, 0.6, 3.2);
  const dune2 = beyond(dune1, 0.6, 3.2);
  const dune3 = beyond(dune2, 0.6, 3.2);
  const seaWall = beyond(dune3, 0.6, 10);
  const pier = beyond(seaWall, 0.8, 11);
  const tug = beyond(pier, 0.8, 3.6);
  const market = beyond(tug, 0.8, 9);
  return { dock, boat1, boat2, boat3, beach, dune1, dune2, dune3, seaWall, pier, tug, market };
})();
const DOCK_X: Range = [-6, 6];
const SEA_WALL_X: Range = [-6, 6];
const MARKET_X: Range = [-6, 6];

/** Leg 2 runs toward -x at z = LEG2_Z: [minX, maxX] of each deck. */
const LEG2_Z = mid(L1.market) - 2.5;
const L2 = (() => {
  const lift = beyond(MARKET_X, 0.1, 3.2);
  const crane = beyond(lift, 0.1, 7);
  const chimney = beyond(crane, 0.7, 3);
  const vane = beyond(chimney, 0.7, 9);
  const trolley = beyond(vane, 0.8, 3);
  const laundry = beyond(trolley, 0.8, 9);
  return { lift, crane, chimney, vane, trolley, laundry };
})();
const CRANE_Z: Range = [LEG2_Z - 4, LEG2_Z + 4];
const VANE_Z: Range = [LEG2_Z - 4.5, LEG2_Z + 4.5];
/** The laundry roof reaches further toward -z, where the trampoline waits. */
const LAUNDRY_Z: Range = [LEG2_Z - 8, LEG2_Z + 6];

/** Leg 3 runs down x = LEG3_X toward -z. */
const LEG3_X = -40;
const L3 = (() => {
  const pad = beyond(LAUNDRY_Z, 0, 2);
  // R2: 0.33 m from the pad to its landing (at most 0.35 m; more than 0.3 m
  // keeps the landing out of the pad's launch column).
  const clock = beyond(pad, 0.33, 8);
  const awning1 = beyond(clock, 0.7, 3);
  const awning2 = beyond(awning1, 0.7, 3);
  const hall = beyond(awning2, 0.7, 10);
  const gondola = beyond(hall, 0.8, 3.6);
  const signal = beyond(gondola, 0.8, 9);
  const plaza = beyond(signal, 0.6, 10);
  // The climax: high jumps at the move's full 0.7 m rise across 1.6 m gaps,
  // beyond a plain jump's reach from a walking take-off.
  const step1 = beyond(plaza, 1.6, 2.6);
  const step2 = beyond(step1, 1.6, 2.6);
  const step3 = beyond(step2, 1.6, 2.6);
  const lookout = beyond(step3, 1.6, 14);
  const crown = beyond(lookout, 1, 6);
  return { pad, clock, awning1, awning2, hall, gondola, signal, plaza, step1, step2, step3, lookout, crown };
})();
const around3 = (width: number): Range => [LEG3_X - width / 2, LEG3_X + width / 2];
const CLOCK_X = around3(8);
const HALL_X = around3(12);
const LOOKOUT_X = around3(14);

function mainSurfaces(): AuthoredLevelPiece[] {
  const boat = (id: string, range: Range, phase?: number) =>
    mover(id, 0, TOP.boat, mid(range), [4.8, span(range)], {
      axis: "x",
      distance: 1,
      period: 8,
      ...(phase === undefined ? {} : { phase }),
    });
  const onSand = (id: string, x: number, range: Range, top: number) =>
    platform(id, { x, sizeX: 5.6, ...alongZ(range), top, thickness: top - TOP.sandbar });
  const onRing = (id: string, x: number, range: Range, top: number) =>
    platform(id, { x, sizeX: 5, ...alongZ(range), top, thickness: top - TOP.ring });
  return [
    // Leg 1: the harbor.
    deck("hq-dock", { ...alongX(DOCK_X), ...alongZ(L1.dock), top: TOP.dock }),
    boat("boat-1", L1.boat1),
    boat("boat-2", L1.boat2, Math.PI),
    boat("boat-3", L1.boat3),
    deck("beach", { x: 0, sizeX: 12, ...alongZ(L1.beach), top: TOP.beach }),
    // The practice catch floor reaches 0.3 m under the beach (the first jump's
    // corridor) and stops 0.3 m under the sea wall, clear of its fight.
    platform("sandbar", {
      x: 0,
      sizeX: 14,
      ...alongZ([L1.seaWall[1] - 0.3, L1.beach[0] + 0.3]),
      top: TOP.sandbar,
      thickness: 0.6,
    }),
    onSand("dune-1", -1.4, L1.dune1, TOP.dune1),
    onSand("dune-2", 1.4, L1.dune2, TOP.dune2),
    onSand("dune-3", -1.4, L1.dune3, TOP.dune3),
    deck("sea-wall", { ...alongX(SEA_WALL_X), ...alongZ(L1.seaWall), top: TOP.seaWall }),
    deck("pier", { x: 0, sizeX: 7, ...alongZ(L1.pier), top: TOP.pier }),
    mover("tugboat", 0, TOP.tug, mid(L1.tug), [4.4, span(L1.tug)], {
      axis: "x",
      distance: 1,
      period: 9,
      phase: Math.PI / 2,
    }),
    deck("fish-market", { ...alongX(MARKET_X), ...alongZ(L1.market), top: TOP.market }),
    // Leg 2: up to the rooftops. Flush landings and a 2 s dwell at each stop (R6).
    lift("cargo-lift", {
      ...alongX(L2.lift),
      z: LEG2_Z,
      sizeZ: 3.2,
      bottomTop: TOP.market,
      distance: TOP.crane - TOP.market,
      period: 8,
      dwell: 2,
      thickness: 0.4,
    }),
    deck("crane-roof", { ...alongX(L2.crane), ...alongZ(CRANE_Z), top: TOP.crane }),
    deck("chimney", { ...alongX(L2.chimney), z: LEG2_Z + 1.5, sizeZ: 4.4, top: TOP.chimney }),
    deck("vane-roof", { ...alongX(L2.vane), ...alongZ(VANE_Z), top: TOP.vane }),
    mover("rooftop-trolley", mid(L2.trolley), TOP.trolley, LEG2_Z + 1.5, [span(L2.trolley), 4.4], {
      axis: "z",
      distance: 0.8,
      period: 8,
    }),
    deck("laundry-roof", { ...alongX(L2.laundry), ...alongZ(LAUNDRY_Z), top: TOP.laundry }),
    // Leg 3: the trampoline, the town and the lookout.
    bouncePad("trampoline", {
      x: LEG3_X,
      sizeX: 2,
      ...alongZ(L3.pad),
      top: TOP.laundry,
      thickness: 0.4,
      strength: "big",
    }),
    deck("clock-roof", { ...alongX(CLOCK_X), ...alongZ(L3.clock), top: TOP.clock }),
    deck("awning-1", { x: LEG3_X + 1.4, sizeX: 4.4, ...alongZ(L3.awning1), top: TOP.awning1 }),
    deck("awning-2", { x: LEG3_X - 1.4, sizeX: 4.4, ...alongZ(L3.awning2), top: TOP.awning2 }),
    deck("town-hall", { ...alongX(HALL_X), ...alongZ(L3.hall), top: TOP.hall }),
    mover("gondola", LEG3_X, TOP.gondola, mid(L3.gondola), [4.4, span(L3.gondola)], {
      axis: "x",
      distance: 1.2,
      period: 9,
    }),
    deck("signal-walk", { x: LEG3_X, sizeX: 7, ...alongZ(L3.signal), top: TOP.signal }),
    deck("tower-plaza", { x: LEG3_X, sizeX: 14, ...alongZ(L3.plaza), top: TOP.plaza }),
    // The climax catch ring reaches 0.3 m under the plaza and the deck lip.
    deck("tower-ring", {
      x: LEG3_X,
      sizeX: 14,
      ...alongZ([L3.lookout[1] - 0.3, L3.plaza[0] + 0.3]),
      top: TOP.ring,
    }),
    onRing("tower-step-1", LEG3_X - 1.2, L3.step1, TOP.step1),
    onRing("tower-step-2", LEG3_X + 1.2, L3.step2, TOP.step2),
    onRing("tower-step-3", LEG3_X - 1.2, L3.step3, TOP.step3),
    deck("lookout-deck", { ...alongX(LOOKOUT_X), ...alongZ(L3.lookout), top: TOP.deck }),
    deck("beacon-crown", { x: LEG3_X, sizeX: 8, ...alongZ(L3.crown), top: TOP.crown }),
  ];
}

/** Optional routes, each clear of the main route and its fights. */
const B = (() => {
  // B1, the crow's nest: beside the pier and the tug, three high jumps up and
  // a drop down to the market.
  const nestZ: Range = [L1.market[1] + 0.3, L1.market[1] + 0.3 + 2.8];
  const crate2Z: Range = [nestZ[1] + 0.9, nestZ[1] + 0.9 + 3];
  const crate1Z: Range = [crate2Z[1] + 0.9, crate2Z[1] + 0.9 + 3];
  // B2, the laundry annex: flush beside the vane roof, then two hops west.
  const annexZ: Range = beyond(VANE_Z, 0, 8);
  const hopZ: Range = [LEG2_Z - 4.85 - 2.2, LEG2_Z - 4.85 + 2.2];
  // B3, the water tower: a small pad west of the clock roof, then down the signs.
  const towerPadX = beyond(CLOCK_X, 0, 2);
  const towerX = beyond(towerPadX, 0.33, 3.6);
  const towerZ: Range = [mid(L3.clock) - 1.8, mid(L3.clock) + 1.8];
  const sign1Z = beyond(towerZ, 0.8, 3);
  const sign2Z: Range = [L3.hall[1] + 0.9, sign1Z[0] - 0.8];
  return { nestZ, crate2Z, crate1Z, annexZ, hopZ, towerPadX, towerX, towerZ, sign1Z, sign2Z };
})();
const ANNEX_X = L2.vane;

function branchSurfaces(): AuthoredLevelPiece[] {
  return [
    deck("crate-1", { x: 5.5, sizeX: 3, ...alongZ(B.crate1Z), top: TOP.pier + 0.7 }),
    deck("crate-2", { x: 5.5, sizeX: 3, ...alongZ(B.crate2Z), top: TOP.pier + 1.4 }),
    deck("crows-nest", { x: 5.2, sizeX: 3.2, ...alongZ(B.nestZ), top: TOP.pier + 2.1 }),
    deck("laundry-annex", { ...alongX(ANNEX_X), ...alongZ(B.annexZ), top: TOP.vane }),
    deck("annex-hop", { ...alongX(L2.trolley), ...alongZ(B.hopZ), top: TOP.trolley }),
    bouncePad("tower-pad", {
      ...alongX(B.towerPadX),
      z: mid(L3.clock),
      sizeZ: 2,
      top: TOP.clock,
      thickness: 0.4,
      strength: "small",
    }),
    deck("water-tower", { ...alongX(B.towerX), ...alongZ(B.towerZ), top: TOP.clock + 1.2 }),
    deck("sign-hop-1", { ...alongX(B.towerX), ...alongZ(B.sign1Z), top: TOP.clock + 0.9 }),
    deck("sign-hop-2", { x: LEG3_X - 6.2, sizeX: 3.6, ...alongZ(B.sign2Z), top: TOP.clock + 0.6 }),
  ];
}

function hazards(): AuthoredLevelPiece[] {
  return [
    // A low barrel boom rolling across the pier.
    slider("barrel-boom", 0, TOP.pier, mid(L1.pier), 10),
    // The weathervane: one slow arm turning on the vane roof.
    {
      type: "sweeper",
      id: "vane-spinner",
      center: at(mid(L2.vane), TOP.vane + 0.22, LEG2_Z),
      halfLength: 1.3,
      radius: 0.18,
      rotation: { period: 12 },
    },
    // One signal boom sliding across the signal walk.
    slider("signal-boom", LEG3_X, TOP.signal, mid(L3.signal), 9),
  ];
}

function checkpoints(): AuthoredLevelPiece[] {
  return [
    platformCheckpoint("hq-start", "hq-dock", at(0, TOP.dock, 2.5)),
    platformCheckpoint("beach-safe", "beach", at(2.5, TOP.beach, L1.beach[1] - 1.2)),
    platformCheckpoint("sea-wall-safe", "sea-wall", at(3.5, TOP.seaWall, L1.seaWall[1] - 0.6)),
    platformCheckpoint("pier-safe", "pier", at(0, TOP.pier, L1.pier[1] - 1.2)),
    // The cargo lift's boarding checkpoint, beside the lift and out of the fight.
    platformCheckpoint("market-safe", "fish-market", at(MARKET_X[0] + 0.6, TOP.market, LEG2_Z)),
    // The first minor memory's only checkpoint.
    platformCheckpoint("crane-safe", "crane-roof", at(L2.crane[1] - 1.1, TOP.crane, LEG2_Z)),
    platformCheckpoint("laundry-safe", "laundry-roof", at(L2.laundry[1] - 2.3, TOP.laundry, LAUNDRY_Z[0] + 0.6)),
    platformCheckpoint("clock-safe", "clock-roof", at(LEG3_X, TOP.clock, L3.clock[1] - 1.2)),
    platformCheckpoint("town-hall-safe", "town-hall", at(LEG3_X + 4, TOP.hall, L3.hall[1] - 0.55)),
    platformCheckpoint("signal-safe", "signal-walk", at(LEG3_X, TOP.signal, L3.signal[1] - 1)),
    // The second minor memory's only checkpoint: an HP defeat restarts here,
    // at the foot of the tower stairs.
    platformCheckpoint("plaza-safe", "tower-plaza", at(LEG3_X + 3, TOP.plaza, L3.plaza[0] + 1.2)),
    platformCheckpoint("deck-safe", "lookout-deck", at(LEG3_X + 4, TOP.deck, L3.lookout[1] - 0.55)),
    platformCheckpoint("crown-safe", "beacon-crown", at(LEG3_X - 2, TOP.crown, L3.crown[1] - 1.2)),
    platformCheckpoint("annex-safe", "laundry-annex", at(ANNEX_X[0] + 0.45, TOP.vane, B.annexZ[0] + 1.4)),
  ];
}

function connections(): AuthoredConnection[] {
  const practice = { requires: "high-jump", safeMissPlatformId: "sandbar" } as const;
  const climax = { requires: "high-jump", safeMissPlatformId: "tower-ring" } as const;
  return [
    // Leg 1.
    ride("hq-dock", "boat-1"),
    ride("boat-1", "boat-2"),
    ride("boat-2", "boat-3"),
    ride("boat-3", "beach"),
    jump("beach", "dune-1", practice),
    jump("dune-1", "dune-2", practice),
    jump("dune-2", "dune-3", practice),
    walk("sandbar", "beach"),
    jump("dune-3", "sea-wall"),
    jump("sea-wall", "pier"),
    ride("pier", "tugboat"),
    ride("tugboat", "fish-market"),
    ride("fish-market", "cargo-lift"),
    ride("cargo-lift", "crane-roof"),
    // Leg 2.
    jump("crane-roof", "chimney"),
    jump("chimney", "vane-roof"),
    ride("vane-roof", "rooftop-trolley"),
    ride("rooftop-trolley", "laundry-roof"),
    walk("laundry-roof", "trampoline"),
    bounce("trampoline", "clock-roof"),
    // Leg 3.
    jump("clock-roof", "awning-1"),
    jump("awning-1", "awning-2"),
    jump("awning-2", "town-hall"),
    ride("town-hall", "gondola"),
    ride("gondola", "signal-walk"),
    jump("signal-walk", "tower-plaza"),
    jump("tower-plaza", "tower-step-1", climax),
    jump("tower-step-1", "tower-step-2", climax),
    jump("tower-step-2", "tower-step-3", climax),
    jump("tower-step-3", "lookout-deck", climax),
    walk("tower-ring", "tower-plaza"),
    jump("lookout-deck", "beacon-crown", { requires: "high-jump" }),
    // B1, the crow's nest.
    jump("pier", "crate-1", { requires: "high-jump" }),
    jump("crate-1", "crate-2", { requires: "high-jump" }),
    jump("crate-2", "crows-nest", { requires: "high-jump" }),
    drop("crows-nest", "fish-market"),
    // B2, the laundry annex.
    walk("vane-roof", "laundry-annex"),
    jump("laundry-annex", "annex-hop"),
    jump("annex-hop", "laundry-roof"),
    // B3, the water tower.
    walk("clock-roof", "tower-pad"),
    bounce("tower-pad", "water-tower"),
    jump("water-tower", "sign-hop-1"),
    jump("sign-hop-1", "sign-hop-2"),
    jump("sign-hop-2", "town-hall"),
  ];
}

export const FAMILY_A2_MAIN_PATH: readonly string[] = Object.freeze([
  "hq-dock",
  "boat-1",
  "boat-2",
  "boat-3",
  "beach",
  "dune-1",
  "dune-2",
  "dune-3",
  "sea-wall",
  "pier",
  "tugboat",
  "fish-market",
  "cargo-lift",
  "crane-roof",
  "chimney",
  "vane-roof",
  "rooftop-trolley",
  "laundry-roof",
  "trampoline",
  "clock-roof",
  "awning-1",
  "awning-2",
  "town-hall",
  "gondola",
  "signal-walk",
  "tower-plaza",
  "tower-step-1",
  "tower-step-2",
  "tower-step-3",
  "lookout-deck",
  "beacon-crown",
]);

/** Golden bones go to the highest branch platform of each (the first three branches). */
export const FAMILY_A2_BRANCHES: readonly (readonly string[])[] = Object.freeze([
  Object.freeze(["pier", "crate-1", "crate-2", "crows-nest", "fish-market"]),
  Object.freeze(["vane-roof", "laundry-annex", "annex-hop", "laundry-roof"]),
  Object.freeze(["clock-roof", "tower-pad", "water-tower", "sign-hop-1", "sign-hop-2", "town-hall"]),
]);

function anchors(): WorldEditorLevelDocument["anchors"] {
  // R11: one ordinary identity (the mischief kitten) in every ordinary slot.
  const kitten = "ordinary-a" as const;
  const marketArena = fightArena(MARKET_X, L1.market, ORDINARY_REACH, { minX: true, maxZ: true });
  const laundryArena = fightArena(L2.laundry, LAUNDRY_Z, ORDINARY_REACH, { maxX: true, minZ: true });
  const hallArena = fightArena(HALL_X, L3.hall, ORDINARY_REACH, { minZ: true, maxZ: true });
  const bossArena = fightArena(LOOKOUT_X, L3.lookout, BOSS_REACH, { minZ: true, maxZ: true });
  return {
    spawn: anchor("hq-dock", 0, TOP.dock, 2.5),
    finish: anchor("beacon-crown", LEG3_X, TOP.crown, L3.crown[0] + 1),
    rewardRespawn: anchor("beacon-crown", LEG3_X + 2, TOP.crown, L3.crown[1] - 1.2),
    pickups: {
      "attack-tool": anchor("hq-dock", -2.5, TOP.dock, -1),
      "guard-tool": anchor("beach", -3, TOP.beach, L1.beach[1] - 2),
    },
    memories: {
      // R5: a short way before the laundry and town-hall fights.
      "minor-one": anchor("crane-roof", mid(L2.crane) - 0.5, TOP.crane, LEG2_Z - 2),
      // R5: on the last deck before the boss approach, about 21 m of route
      // from the boss arena.
      "minor-two": anchor("tower-plaza", LEG3_X - 3.5, TOP.plaza, L3.plaza[0] + 1.5),
      major: anchor("beacon-crown", LEG3_X, TOP.crown, mid(L3.crown) - 0.3),
    },
    // R4: each strike envelope (arena + reach) keeps 0.5 m inside its deck
    // and stays off every entry and exit strip, lift approach and pad.
    encounters: {
      "ordinary-1": encounter(
        kitten,
        "sea-wall",
        at(1.5, TOP.seaWall, mid(L1.seaWall)),
        fightArena(SEA_WALL_X, L1.seaWall, ORDINARY_REACH, { minZ: true, maxZ: true }),
        "sea-wall-safe",
      ),
      "ordinary-2": encounter(
        kitten,
        "fish-market",
        at(1.5, TOP.market, mid(L1.market) - 0.5),
        marketArena,
        "market-safe",
      ),
      "ordinary-3": encounter(
        kitten,
        "laundry-roof",
        at(mid(L2.laundry), TOP.laundry, LEG2_Z - 1),
        laundryArena,
        "laundry-safe",
      ),
      "ordinary-4": encounter(
        kitten,
        "town-hall",
        at(LEG3_X + 1.5, TOP.hall, mid(L3.hall)),
        hallArena,
        "town-hall-safe",
      ),
      boss: encounter("boss", "lookout-deck", at(LEG3_X, TOP.deck, mid(L3.lookout)), bossArena, "deck-safe"),
      // The optional bonus fight on the laundry annex (branch B2).
      "bonus-1": encounter(
        kitten,
        "laundry-annex",
        at(mid(ANNEX_X) + 0.3, TOP.vane, mid(B.annexZ) - 0.6),
        fightArena(ANNEX_X, B.annexZ, ORDINARY_REACH, { minX: true, maxZ: true }),
        "annex-safe",
      ),
    },
    friendlies: {
      "friendly-1": anchor("hq-dock", 3.5, TOP.dock, 1.5),
      "friendly-2": anchor("clock-roof", LEG3_X + 2.5, TOP.clock, mid(L3.clock) + 1.5),
      "friendly-3": anchor("tower-plaza", LEG3_X - 5, TOP.plaza, mid(L3.plaza) + 2),
    },
  };
}

/** The water plane the scene draws under the course. */
const WATER = -WATER_DEPTH;
const QUARTER = Math.PI / 2;

/**
 * Placed props (R12): the harbor kit first, then a few shared props for the
 * shore and the town. None stands on a walkable top, in a jump corridor or in
 * a fight area; each prop within 2.5 m of a deck is either at least 0.5 m
 * below its top (pilings, moored boats, wall lanterns) or at least 1.4 m
 * above it (buoy posts, trees, the towers), so nothing reads as a foothold.
 * Every harbor prop is procedural until its model lands: posts, boards,
 * boxes and a tank on legs.
 */
function decorEntries(): AuthoredDecor[] {
  const entries: AuthoredDecor[] = [];
  const place = (
    kitPropId: string,
    x: number,
    y: number,
    z: number,
    options: { readonly rotationY?: number; readonly scale?: number } = {},
  ) => {
    entries.push(decor(`${kitPropId}-${entries.length + 1}`, kitPropId, { x, y, z }, options));
  };
  // Pilings beside the dock, pier and market (tops at least 0.5 m below the deck).
  const piling = (x: number, z: number, scale: number) => place("pier-bollard", x, WATER, z, { scale });
  for (const z of [-4, -2, 0, 2, 4]) {
    piling(DOCK_X[0] - 0.4, z, 1.1);
    piling(DOCK_X[1] + 0.4, z, 1.1);
  }
  for (const z of [-51, -53.4, -55.8, -58.2]) piling(-3.5 - 0.7, z, 2);
  for (const z of [-67, -69.4, -71.8, -74]) piling(MARKET_X[1] + 0.7, z, 2);
  for (const x of [-4, 4]) piling(x, L1.market[0] - 0.7, 2);
  // Rescue buoy posts at the dock and beach corners, well above the decks.
  const buoy = (x: number, z: number, rotationY: number) =>
    place("rescue-buoy-stand", x, WATER, z, { rotationY, scale: 1.6 });
  buoy(DOCK_X[0] - 1.2, 4, QUARTER);
  buoy(DOCK_X[1] + 1.2, 4, -QUARTER);
  buoy(DOCK_X[0] - 1.2, -4, QUARTER);
  buoy(DOCK_X[1] + 1.2, -4, -QUARTER);
  buoy(-7.4, L1.beach[1] - 1, QUARTER);
  buoy(7.4, L1.beach[1] - 1, -QUARTER);
  // Rescue HQ at spawn and the lookout beyond the crown: tall landmarks that
  // read across the 95 m era fog.
  place("lookout-tower-facade", DOCK_X[0] - 3 - 2.7, WATER, 0, { scale: 1.5 });
  place("lookout-tower-facade", LEG3_X, WATER, L3.crown[0] - 0.8 - 5.4, { scale: 3 });
  // Boats moored in the harbor (tops 0.5 m below the dock).
  for (const [x, z, rotationY] of [
    [-12, 8, 0.3],
    [12.5, -3, -0.2],
    [-13, -14, 1.2],
    [13, -18, 2.6],
    [-15, -34, 0.8],
    [-18, -46, 2],
    [14, -44, -0.6],
    [-18, -54, 0.4],
    [15, -70, 1.4],
    [-20, -96, 0.9],
    [-14, -118, 2.2],
    [-24, -140, -0.5],
  ] as const)
    place("small-boat", x, WATER, z, { rotationY, scale: 0.8 });
  // Rocks off the beach and the pier.
  for (const [x, z, rotationY] of [
    [-8.6, -21, -0.3],
    [8.8, -24.5, 0.3],
    [-9, -44, -2.4],
    [9.4, -41, 0.2],
    [-6.6, -52.6, -0.7],
    [-6.8, -58.4, 1.2],
  ] as const)
    place("clearing-stone", x, WATER, z, { rotationY });
  // Shore trees beside the beach and the sandbar (tops 1.4 m above the sand).
  for (const [x, z] of [
    [-10, -22],
    [10.2, -21],
    [-10.4, -30],
    [10.4, -33],
    [-11, -36],
  ] as const)
    place("clearing-tree", x, WATER, z, { rotationY: x < 0 ? 0.6 : -0.6, scale: 1.2 });
  // The harbor town: block towers north of the rooftops and west of the lookout.
  for (const [x, z, scale] of [
    [-14, -62.5, 3],
    [-25, -61, 3.4],
    [-37, -61, 3],
    [-50, -62, 3.4],
  ] as const)
    place("toybox-block-tower", x, WATER, z, { scale });
  for (const [z, scale] of [
    [-92, 3.2],
    [-104, 3.6],
    [-116, 3.2],
    [-128, 3.6],
    [-140, 3.2],
    [-152, 3.6],
    [-164, 3.2],
  ] as const)
    place("toybox-block-tower", -55.6, WATER, z, { rotationY: QUARTER, scale });
  // Wind-up lanterns on roof walls that carry no connection (0.6 m below each top).
  const lantern = (x: number, z: number, top: number, rotationY: number) =>
    place("toybox-windup-lantern", x, top - 0.6 - 0.98, z, { rotationY, scale: 1.2 });
  lantern(mid(L2.crane), CRANE_Z[0] - 0.3, TOP.crane, 0);
  lantern(mid(L2.vane), VANE_Z[1] + 0.3, TOP.vane, Math.PI);
  lantern(L2.laundry[0] - 0.3, LEG2_Z - 1, TOP.laundry, -QUARTER);
  lantern(CLOCK_X[1] + 0.3, mid(L3.clock), TOP.clock, QUARTER);
  lantern(HALL_X[1] + 0.3, L3.hall[0] + 2, TOP.hall, QUARTER);
  lantern(HALL_X[0] - 0.3, L3.hall[0] + 2, TOP.hall, -QUARTER);
  lantern(LOOKOUT_X[0] - 0.3, L3.lookout[1] - 4, TOP.deck, -QUARTER);
  lantern(LOOKOUT_X[1] + 0.3, L3.lookout[1] - 4, TOP.deck, QUARTER);
  lantern(LOOKOUT_X[0] - 0.3, L3.lookout[0] + 3, TOP.deck, -QUARTER);
  lantern(LOOKOUT_X[1] + 0.3, L3.lookout[0] + 3, TOP.deck, QUARTER);
  return entries;
}

/** The complete authored-level-v4 document for chapter A2. Pure and deterministic. */
export function familyA2Level(): WorldEditorLevelDocument {
  return {
    schemaVersion: "authored-level-v4",
    id: FAMILY_A2_ROUTE_ID,
    theme: FAMILY_A2_THEME,
    pieces: [...mainSurfaces(), ...branchSurfaces(), ...hazards(), ...checkpoints()],
    connections: connections(),
    mainPath: [...FAMILY_A2_MAIN_PATH],
    branches: FAMILY_A2_BRANCHES.map((branch) => [...branch]),
    anchors: anchors(),
    decor: decorEntries(),
  };
}

const HARBOR_WINDOW = Object.freeze({ startDate: "2013-08-12", endDate: "2026-12-31" });

/**
 * A2's cast (WORLD-SPEC, verbatim), as project candidates in the
 * rescue-harbor-v1 period until their models land. The mischief kitten is the
 * one ordinary identity: it fills all four ordinary slots and bonus-1 with
 * kind ordinary-a (R11). The rival mayor is the boss.
 */
export const FAMILY_A2_CAST: Readonly<{
  ordinary: LevelEditorEnemyCandidate;
  boss: LevelEditorEnemyCandidate;
}> = Object.freeze({
  ordinary: Object.freeze<LevelEditorEnemyCandidate>({
    id: "mischief-kitten",
    name: "Mischief Kitten",
    periodId: "rescue-harbor-v1",
    recognizableReference: "the mayor's naughty kitten crew",
    visualJoke: "pounces then gets distracted",
    obstacleOrAttack: "pounce",
    eligibility: HARBOR_WINDOW,
    role: "ordinary",
    kind: "ordinary-a",
    behaviorPreset: "ordinary-a",
  }),
  boss: Object.freeze<LevelEditorEnemyCandidate>({
    id: "rival-mayor",
    name: "Mayor Humdrum",
    periodId: "rescue-harbor-v1",
    recognizableReference: "scheming rival-town mayor from rescue-pup cartoons",
    visualJoke: "a remote that never does what he wants",
    obstacleOrAttack: "zaps with his remote contraption",
    eligibility: HARBOR_WINDOW,
    role: "boss",
    kind: "boss",
    behaviorPreset: "boss",
  }),
});
