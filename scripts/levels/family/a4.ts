/**
 * World A, chapter 4: "Rat Casino After Hours" (PLAN-019, family-world-a@v1).
 *
 * A pure, deterministic generator for the chapter's authored-level-v4
 * document. It upgrades the Rat Casino v2 level (`rat-casino-v2`): the foyer,
 * the padded floor and token steps, the ticket counter, the beat lane and
 * drum break, the token tray, the cabinet landing, the Card Club, backstage,
 * the Projection Balcony, the last ticket, the Rat Pit Stage and the
 * after-hours exit keep their ids, cast and character, and the old casino
 * gains a second and third storey and the grown-up moves. As World A's
 * finale (ruling R8) the required route climbs to 22.3 m, uses every move
 * and course piece the world has taught, and is the world's longest.
 *
 *   foyer -> token steps -> GLIDE SCHOOL (pad, perch, two glides over the
 *   padded floor) -> ticket counter (Chick-flia) -> beat lane -> drum break
 *   (Jackrabbit Drummer) -> token tray -> cabinet landing -> SERVICE ELEVATOR
 *   (6.2 m) -> Card Club (minor one, Fox Card Shark) -> three shuffling cards
 *   -> backstage turnstile -> balcony pad -> Projection Balcony (Moth
 *   Projectionist) -> last ticket -> spotlight catwalk -> two sliding reels
 *   -> marquee ledge -> MARQUEE RIGGING (pad, two double-jump ups, the hoist,
 *   a double jump up to the spotlight bar and a glide across, a double jump
 *   and a high jump) -> the high board at 22.3 m -> THE DIVE (a glide across
 *   to the trapeze, where minor two waits, and a glide down into the Rat Pit
 *   Stage) -> Rat Pit Boss -> after-hours exit (the major memory ends the
 *   chapter).
 *
 * Optional routes, in golden-ticket order: the High-Roller Chip Stacks past
 * the service elevator, the On-Air stage with the Radio Showman bonus fight,
 * and the tray skip. Only casino-kit props dress the hall.
 *
 * The level id is the chapter's route id. Chapter copy, dates and the cast
 * assignment belong to the World A assembler; `FAMILY_A4_CAST` records this
 * chapter's cast for it. Nothing here reads files, clocks or photos.
 */
import type {
  AuthoredConnection,
  AuthoredDecor,
  AuthoredLevelPiece,
} from "../../../src/shared/authored-level.js";
import type {
  LevelEditorEncounterReference,
  LevelEditorEnemyCandidate,
  WorldEditorLevelDocument,
} from "../../../src/shared/editor-project.js";
import { bounce, decor, drop, jump, lift, ride, walk } from "../lib/growth-kit.js";
import {
  a4Anchor,
  a4Block,
  a4Checkpoint,
  a4Encounter,
  a4Mover,
  a4Pad,
  a4Rect,
  a4Slab,
  a4Sweeper,
  a4Top,
  A4_HALL_FLOOR,
} from "./lib-a4.js";

export const FAMILY_A4_ROUTE_ID = "family-a4-casino";
export const FAMILY_A4_THEME = "casino";

/** Standing heights of the required route's landmarks, in metres. */
export const FAMILY_A4_HEIGHTS = Object.freeze({
  foyer: 0,
  glidePerch: 2.6,
  glideLanding: 1.6,
  cabinet: 1.2,
  cardClub: 7.4,
  backstage: 7.7,
  projection: 9.7,
  catwalk: 10.3,
  hoistBottom: 14.9,
  hoistTop: 20.1,
  highBoard: 22.3,
  trapeze: 20.1,
  stage: 16.5,
});

/**
 * Lift start phases (radians). Any phase is fair to a real child, who reaches
 * a lift at an arbitrary moment; these give the scripted route run a wait
 * close to the mean over all arrival phases (service lift 13.3 s of board and
 * ride against a 15.2 s mean, hoist 13.0 s against 12.9 s), so its pacing
 * figure is neither lucky nor unlucky.
 */
const SERVICE_LIFT_PHASE = 3.272492;
const HOIST_PHASE = 2.879793;

type A4CastSlot = "ordinary-1" | "ordinary-2" | "ordinary-3" | "ordinary-4" | "boss";

const catalogEntry = (catalogEntryId: string): LevelEditorEncounterReference => ({
  source: "catalog",
  catalogEntryId,
  catalogEntryVersion: "v001",
});

/**
 * The chapter cast (WORLD-SPEC): the Rat Casino entries of parody catalog v7
 * (parent-locked window; rat-pit-boss v001 pins model v002) and the Radio
 * Showman, a project candidate for the bonus slot until a catalog entry lands.
 */
export const FAMILY_A4_CAST: Readonly<{
  readonly slots: Readonly<Record<A4CastSlot, LevelEditorEncounterReference>>;
  readonly bonus: LevelEditorEnemyCandidate;
}> = Object.freeze({
  slots: Object.freeze({
    "ordinary-1": catalogEntry("chick-flia"),
    "ordinary-2": catalogEntry("jackrabbit-drummer"),
    "ordinary-3": catalogEntry("fox-card-shark"),
    "ordinary-4": catalogEntry("moth-projectionist"),
    boss: catalogEntry("rat-pit-boss"),
  }),
  bonus: Object.freeze<LevelEditorEnemyCandidate>({
    id: "radio-host-showman",
    name: "The Radio Showman",
    periodId: "rat-casino-v1",
    recognizableReference: "a dapper vintage radio-show host (clean)",
    visualJoke: "never stops grinning into his microphone",
    obstacleOrAttack: "microphone-cane swing",
    eligibility: { startDate: "2019-10-28", endDate: "2026-12-31" },
    role: "ordinary",
    kind: "ordinary-a",
    behaviorPreset: "ordinary-a",
  }),
});

/** Every surface, by id, so connections and anchors reference real pieces. */
function surfaces() {
  const h = FAMILY_A4_HEIGHTS;
  return {
    // S0 Casino foyer (kept from v2): spawn, the tier-4 wand, friendly one.
    foyer: a4Slab("casino-foyer", a4Rect(-5, 5, -4, 4), h.foyer),
    // S1 Glide School over the padded floor. The floor now stops 4.2 m short
    // of the ticket counter, so the natural path runs through the school.
    floor: a4Slab("casino-padded-floor", a4Rect(-6, 6, -25.6, -2.5), 0),
    stepOne: a4Slab("token-step-one", a4Rect(-1.6, 4, -8, -4.4), 0.3),
    stepTwo: a4Slab("token-step-two", a4Rect(-4, 1.6, -12.2, -8.6), 0.6),
    schoolPad: a4Pad("glide-school-pad", a4Rect(-2.4, 0, -14.2, -12.2), 0.6, "big"),
    perch: a4Block("spotlight-perch", a4Rect(-4.7, 2.3, -17.7, -14.5), h.glidePerch, 0),
    landing: a4Block("glide-landing", a4Rect(-3.7, 1.3, -26.2, -20.2), h.glideLanding),
    // S2 Ticket counter: guard tool and Chick-flia.
    counter: a4Block("ticket-counter", a4Rect(-7, 7, -41.8, -29.8), 0),
    // S3 Beat lane (the padded bar) and drum break (Jackrabbit Drummer).
    beatLane: a4Block("jackrabbit-beat-lane", a4Rect(-6.5, 0.5, -49.8, -42.8), 0.3),
    drum: a4Block("drum-break", a4Rect(-8, 2, -59.8, -50.8), 0.6),
    // S4 Token tray and cabinet landing; the tray-skip stack beside the tray.
    tray: a4Mover("token-tray", a4Rect(-5.2, -0.8, -64.4, -60.2), 0.9, { axis: "x", distance: 0.6, period: 9 }),
    trayStack: a4Block("tray-skip-stack", a4Rect(0, 2.8, -63.7, -60.9), 1.8),
    cabinet: a4Block("cabinet-landing", a4Rect(-8, 2, -72.8, -64.8), h.cabinet),
    // S5 Service elevator between two slot-cabinet walls, up to the Card Club;
    // the High-Roller chip stacks climb beside it.
    lift: lift("service-lift", {
      x: -3,
      z: -74.4,
      sizeX: 3.2,
      sizeZ: 3.2,
      bottomTop: h.cabinet,
      distance: h.cardClub - h.cabinet,
      period: 12,
      dwell: 3,
      thickness: 0.4,
      phase: SERVICE_LIFT_PHASE,
    }),
    cardClub: a4Block("fox-card-room", a4Rect(-9, 3, -85, -76), h.cardClub),
    chipOne: a4Block("chip-stack-one", a4Rect(3.4, 6.2, -67.4, -64.6), 2.44),
    chipTwo: a4Block("chip-stack-two", a4Rect(4, 6.8, -71.2, -68.4), 3.68),
    chipThree: a4Block("chip-stack-three", a4Rect(3.4, 6.2, -75, -72.2), 4.92),
    chipFour: a4Block("chip-stack-four", a4Rect(4, 6.8, -78.8, -76), 6.16),
    // S6 Card shuffle: three cards sliding across the slot canyon, heading
    // left to backstage.
    cardOne: a4Mover("card-shuffle-one", a4Rect(-14, -10, -82.7, -78.3), 7.5, { axis: "z", distance: 1, period: 8 }),
    cardTwo: a4Mover("card-shuffle-two", a4Rect(-19, -15, -82.7, -78.3), 7.55, {
      axis: "z",
      distance: 1,
      period: 8,
      phase: 3.141593,
    }),
    cardThree: a4Mover("card-shuffle-three", a4Rect(-24, -20, -82.7, -78.3), 7.6, { axis: "z", distance: 1, period: 8 }),
    backstage: a4Block("backstage-turn", a4Rect(-37, -25, -84.5, -76.5), h.backstage),
    // S7 Balcony pad up to the Projection Balcony; the On-Air pad beside it.
    balconyPad: a4Pad("balcony-pad", a4Rect(-35.2, -32.8, -86.9, -84.5), h.backstage, "big"),
    onAirPad: a4Pad("on-air-pad", a4Rect(-27.6, -25.2, -86.9, -84.5), h.backstage, "big"),
    projection: a4Block("moth-projection-room", a4Rect(-40, -28, -98.2, -87.25), h.projection),
    onAir: a4Block("on-air-stage", a4Rect(-27.8, -19.8, -98.2, -87.25), 9.3),
    // S8 Last ticket, the spotlight catwalk, and the reel row: two sliding
    // reels heading right to the marquee ledge.
    lastTicket: a4Slab("last-ticket-one", a4Rect(-36.2, -31.8, -102, -99.2), 10),
    catwalk: a4Slab("spotlight-catwalk", a4Rect(-35.8, -30.2, -111, -103), h.catwalk),
    reelOne: a4Mover("reel-one", a4Rect(-29.2, -25.2, -111, -106.6), h.catwalk, { axis: "z", distance: 1, period: 8 }),
    reelTwo: a4Mover("reel-two", a4Rect(-24.2, -20.2, -111, -106.6), h.catwalk, {
      axis: "z",
      distance: 1,
      period: 8,
      phase: 3.141593,
    }),
    ledge: a4Block("marquee-ledge", a4Rect(-19.2, -14.2, -111.8, -105.8), h.catwalk),
    // S9 Marquee rigging, a switchback tower: row one climbs right, the
    // marquee hoist carries you up, and row two climbs back left to the high
    // board at the top of the casino.
    rigPad: a4Pad("rigging-pad", a4Rect(-14.2, -11.8, -111.4, -109), h.catwalk, "big"),
    rigOne: a4Block("rigging-deck-one", a4Rect(-11.45, -6.65, -112.2, -106.2), 12.5),
    rigTwo: a4Block("rigging-deck-two", a4Rect(-5.05, -1.05, -111.8, -107.8), 13.7),
    rigThree: a4Block("rigging-deck-three", a4Rect(0.55, 4.55, -111.8, -107.8), h.hoistBottom),
    hoist: lift("marquee-hoist", {
      x: 2.55,
      z: -113.4,
      sizeX: 3.2,
      sizeZ: 3.2,
      bottomTop: h.hoistBottom,
      distance: h.hoistTop - h.hoistBottom,
      period: 10,
      dwell: 3,
      thickness: 0.4,
      phase: HOIST_PHASE,
    }),
    rigFour: a4Block("rigging-deck-four", a4Rect(0.55, 4.55, -119, -115), h.hoistTop),
    // Double jump up to the spotlight bar, then glide across to deck five.
    spotBar: a4Slab("spotlight-bar", a4Rect(-3.05, -1.05, -119, -115), 21.3),
    rigFive: a4Block("rigging-deck-five", a4Rect(-8.55, -4.55, -119, -115), 20.5),
    // Deck six's wall stops a glide that overshoots deck five.
    rigSix: a4Block("rigging-deck-six", a4Rect(-12.55, -8.55, -119, -115), 21.7),
    board: a4Slab("high-board", a4Rect(-18.15, -14.15, -119, -115), h.highBoard, 0.8),
    // S10 The dive: a glide across to the long trapeze, then a glide down
    // into the Rat Pit Stage, whose runway outlasts any glide.
    trapeze: a4Slab("spotlight-trapeze", a4Rect(-34.65, -20.65, -119, -115), h.trapeze, 0.8),
    stage: a4Block("rat-pit-stage", a4Rect(-34.5, -16.5, -149.5, -121.5), h.stage),
    exit: a4Block("after-hours-exit", a4Rect(-31.5, -19.5, -155.5, -149.5), h.stage),
  } as const;
}

type Surfaces = ReturnType<typeof surfaces>;

function sweepers(s: Surfaces) {
  return [
    a4Sweeper("ribbon-padded-bar", { x: -3, z: -46.3 }, a4Top(s.beatLane), 1, {
      motion: { axis: "x", distance: 2, period: 10 },
    }, 0.18),
    a4Sweeper("party-turnstile", { x: -28.2, z: -80 }, a4Top(s.backstage), 1.3, { rotation: { period: 14 } }, 0.18),
    a4Sweeper("spotlight-sweep", { x: -33.5, z: -106.4 }, a4Top(s.catwalk), 1.5, {
      rotation: { period: 12, phase: 1.570796 },
    }),
  ];
}

/** In route order; every section has one before and after it (DESIGN-011). */
function checkpoints(s: Surfaces) {
  return [
    a4Checkpoint("party-start", s.foyer, 0, 1),
    a4Checkpoint("glide-landing-safe", s.landing, -1.2, -21),
    a4Checkpoint("party-picnic-safe", s.counter, -5.5, -31),
    a4Checkpoint("ribbon-safe", s.drum, -7.2, -51.3),
    a4Checkpoint("party-dock-safe", s.cabinet, -3, -65.6),
    a4Checkpoint("party-grove-safe", s.cardClub, -7.6, -76.6),
    a4Checkpoint("backstage-safe", s.backstage, -26, -77.2),
    a4Checkpoint("party-fair-safe", s.projection, -29, -88),
    a4Checkpoint("on-air-safe", s.onAir, -20.6, -87.9),
    a4Checkpoint("catwalk-safe", s.catwalk, -30.8, -103.8),
    a4Checkpoint("marquee-ledge-safe", s.ledge, -16.7, -106.5),
    a4Checkpoint("rigging-low-safe", s.rigOne, -9, -107.1),
    a4Checkpoint("rigging-mid-safe", s.rigThree, 2.55, -108.6),
    a4Checkpoint("rigging-high-safe", s.rigFour, 2.55, -118.3),
    a4Checkpoint("high-board-safe", s.board, -16.5, -115.9),
    a4Checkpoint("dive-safe", s.trapeze, -28.5, -118.3),
    a4Checkpoint("besties-safe", s.stage, -25.5, -122.25),
    a4Checkpoint("party-reward-safe", s.exit, -25.5, -151.15),
  ];
}

function connections(s: Surfaces): AuthoredConnection[] {
  const floor = s.floor.id;
  return [
    // Required route.
    jump(s.foyer.id, s.stepOne.id, { safeMissPlatformId: floor }),
    jump(s.stepOne.id, s.stepTwo.id, { safeMissPlatformId: floor }),
    walk(s.stepTwo.id, s.schoolPad.id),
    bounce(s.schoolPad.id, s.perch.id),
    // The first required glide is the practice: a miss lands on the floor.
    jump(s.perch.id, s.landing.id, { requires: "glide", safeMissPlatformId: floor }),
    jump(s.landing.id, s.counter.id, { requires: "glide" }),
    jump(s.counter.id, s.beatLane.id),
    jump(s.beatLane.id, s.drum.id),
    ride(s.drum.id, s.tray.id),
    ride(s.tray.id, s.cabinet.id),
    ride(s.cabinet.id, s.lift.id),
    ride(s.lift.id, s.cardClub.id),
    ride(s.cardClub.id, s.cardOne.id),
    ride(s.cardOne.id, s.cardTwo.id),
    ride(s.cardTwo.id, s.cardThree.id),
    ride(s.cardThree.id, s.backstage.id),
    walk(s.backstage.id, s.balconyPad.id),
    bounce(s.balconyPad.id, s.projection.id),
    jump(s.projection.id, s.lastTicket.id),
    jump(s.lastTicket.id, s.catwalk.id),
    ride(s.catwalk.id, s.reelOne.id),
    ride(s.reelOne.id, s.reelTwo.id),
    ride(s.reelTwo.id, s.ledge.id),
    walk(s.ledge.id, s.rigPad.id),
    bounce(s.rigPad.id, s.rigOne.id),
    jump(s.rigOne.id, s.rigTwo.id, { requires: "double-jump" }),
    jump(s.rigTwo.id, s.rigThree.id, { requires: "double-jump" }),
    ride(s.rigThree.id, s.hoist.id),
    ride(s.hoist.id, s.rigFour.id),
    jump(s.rigFour.id, s.spotBar.id, { requires: "double-jump" }),
    jump(s.spotBar.id, s.rigFive.id, { requires: "glide" }),
    jump(s.rigFive.id, s.rigSix.id, { requires: "double-jump" }),
    jump(s.rigSix.id, s.board.id, { requires: "high-jump" }),
    // THE DIVE: the new move returns at the climax, twice.
    jump(s.board.id, s.trapeze.id, { requires: "glide" }),
    jump(s.trapeze.id, s.stage.id, { requires: "glide" }),
    walk(s.stage.id, s.exit.id),
    // The Glide School's retry route.
    walk(floor, s.foyer.id),
    // Branch 0: High-Roller Chip Stacks past the service elevator.
    jump(s.cabinet.id, s.chipOne.id, { requires: "double-jump" }),
    jump(s.chipOne.id, s.chipTwo.id, { requires: "double-jump" }),
    jump(s.chipTwo.id, s.chipThree.id, { requires: "double-jump" }),
    jump(s.chipThree.id, s.chipFour.id, { requires: "double-jump" }),
    jump(s.chipFour.id, s.cardClub.id, { requires: "double-jump" }),
    // Branch 1: the On-Air stage and the Radio Showman.
    walk(s.backstage.id, s.onAirPad.id),
    bounce(s.onAirPad.id, s.onAir.id),
    jump(s.onAir.id, s.projection.id, { requires: "high-jump" }),
    // Branch 2: the tray skip, with a drop back down (ruling R7).
    jump(s.drum.id, s.trayStack.id, { requires: "double-jump" }),
    drop(s.trayStack.id, s.cabinet.id),
  ];
}

function mainPath(s: Surfaces): string[] {
  return [
    s.foyer,
    s.stepOne,
    s.stepTwo,
    s.schoolPad,
    s.perch,
    s.landing,
    s.counter,
    s.beatLane,
    s.drum,
    s.tray,
    s.cabinet,
    s.lift,
    s.cardClub,
    s.cardOne,
    s.cardTwo,
    s.cardThree,
    s.backstage,
    s.balconyPad,
    s.projection,
    s.lastTicket,
    s.catwalk,
    s.reelOne,
    s.reelTwo,
    s.ledge,
    s.rigPad,
    s.rigOne,
    s.rigTwo,
    s.rigThree,
    s.hoist,
    s.rigFour,
    s.spotBar,
    s.rigFive,
    s.rigSix,
    s.board,
    s.trapeze,
    s.stage,
    s.exit,
  ].map((piece) => piece.id);
}

function branches(s: Surfaces): string[][] {
  // Order matters: the first three branches carry the golden tickets.
  return [
    [s.cabinet, s.chipOne, s.chipTwo, s.chipThree, s.chipFour, s.cardClub],
    [s.backstage, s.onAirPad, s.onAir, s.projection],
    [s.drum, s.trayStack, s.cabinet],
  ].map((branch) => branch.map((piece) => piece.id));
}

function anchors(s: Surfaces): WorldEditorLevelDocument["anchors"] {
  return {
    spawn: a4Anchor(s.foyer, 0, 1),
    finish: a4Anchor(s.exit, -25.5, -154.85),
    rewardRespawn: a4Anchor(s.exit, -25.5, -151.15),
    pickups: {
      "attack-tool": a4Anchor(s.foyer, -0.7, -0.5),
      "guard-tool": a4Anchor(s.counter, -5, -34.5),
    },
    memories: {
      // R5: minor one waits by the lift, just before the Fox Card Shark;
      // minor two waits on the trapeze, one glide away from the boss.
      "minor-one": a4Anchor(s.cardClub, -6, -76.6),
      "minor-two": a4Anchor(s.trapeze, -25.5, -118.6),
      major: a4Anchor(s.exit, -25.5, -153.25),
    },
    encounters: {
      // Each strike envelope keeps 0.5 m on its deck and clear of every
      // exit strip and pad or lift approach (R4).
      "ordinary-1": a4Encounter("ordinary-a", s.counter, a4Rect(1.3, 5.1, -39.3, -32.3), { x: 3.2, z: -35.8 }, "party-picnic-safe"),
      "ordinary-2": a4Encounter("ordinary-b", s.drum, a4Rect(-6.1, 0.1, -57.3, -53.3), { x: -3, z: -55.3 }, "ribbon-safe"),
      "ordinary-3": a4Encounter("ordinary-a", s.cardClub, a4Rect(-6.5, 0.55, -83.1, -78.5), { x: -3, z: -80.8 }, "party-grove-safe"),
      "ordinary-4": a4Encounter("ordinary-b", s.projection, a4Rect(-37.5, -31, -95.5, -90), { x: -34.25, z: -92.75 }, "party-fair-safe"),
      // The boss waits at the back of its arena, so a full glide lands on the
      // runway short of its reach and the roulette dais and Golden's cameo,
      // which CasinoScene places behind it, stay out of reach too.
      boss: a4Encounter("boss", s.stage, a4Rect(-29.3, -21.7, -144, -140), { x: -25.5, z: -143.95 }, "besties-safe"),
      "bonus-1": a4Encounter("ordinary-a", s.onAir, a4Rect(-25.3, -21.7, -94.8, -89.75), { x: -23.5, z: -92.3 }, "on-air-safe"),
    },
    friendlies: {
      "friendly-1": a4Anchor(s.foyer, -3, 1),
      "friendly-2": a4Anchor(s.cardClub, 0.8, -76.6),
      "friendly-3": a4Anchor(s.projection, -39.2, -88),
    },
  };
}

/**
 * Casino-kit props only (ruling R12; the shared kit's props are still
 * studio-only candidates): slot-cabinet walls with marquee doorways along
 * the hall, slot-machine floors under the upper storeys (visible from the
 * rigging), roulette daises on the open hall floor and an exit marquee. Every
 * prop stands on the hall floor beside or below the route, except the exit
 * marquee, which stands at the exit's far edge.
 */
function decorRows(s: Surfaces): AuthoredDecor[] {
  const rows: AuthoredDecor[] = [];
  const cabinet = "casino-slot-cabinet";
  const arch = "casino-marquee-arch";
  const dais = "casino-roulette-dais";
  const floor = A4_HALL_FLOOR;
  const faceRight = -Math.PI / 2;
  const faceLeft = Math.PI / 2;
  // A wall of cabinets every 8 m; every fourth slot is a marquee doorway.
  const wall = (prefix: string, x: number, fromZ: number, count: number, rotationY: number) => {
    for (let index = 0; index < count; index += 1) {
      const z = fromZ - 8 * index;
      const id = `${prefix}-${index + 1}`;
      rows.push(
        index % 4 === 2
          ? decor(id, arch, { x, y: floor, z }, { rotationY, scale: 1.2 })
          : decor(id, cabinet, { x, y: floor, z }, { rotationY, scale: 2.4 }),
      );
    }
  };
  wall("ground-wall-left", -13, 2, 10, faceRight);
  wall("hall-wall-right", 10, 2, 20, faceLeft);
  wall("upper-wall-left", -44, -78, 10, faceRight);
  // Slot-machine floors below the upper storeys.
  for (const [row, z] of [-90, -96, -102].entries())
    for (const [column, x] of [-17, -12].entries())
      rows.push(decor(`reel-floor-${row + 1}-${column + 1}`, cabinet, { x, y: floor, z }, { scale: 2 }));
  for (const [row, z] of [-126, -134, -142, -150].entries())
    for (const [column, x] of [-11, -4, 3].entries())
      rows.push(decor(`stage-floor-${row + 1}-${column + 1}`, cabinet, { x, y: floor, z }, { scale: 2.4 }));
  rows.push(
    decor("roulette-west-one", dais, { x: -39, y: floor, z: -128 }, { scale: 1.4 }),
    decor("roulette-west-two", dais, { x: -39, y: floor, z: -140 }, { scale: 1.4 }),
    decor("roulette-east", dais, { x: 6, y: floor, z: -96 }, { scale: 1.4 }),
    // The exit marquee frames the major memory at the far edge of the exit.
    decor("exit-marquee", arch, { x: -25.5, y: a4Top(s.exit), z: -156.2 }, { scale: 1.3 }),
  );
  return rows;
}

/** The complete, validator-clean A4 level document. Pure: every call returns an equal new object. */
export function familyA4Level(): WorldEditorLevelDocument {
  const s = surfaces();
  const pieces: AuthoredLevelPiece[] = [...Object.values(s), ...sweepers(s), ...checkpoints(s)];
  return {
    schemaVersion: "authored-level-v4",
    id: FAMILY_A4_ROUTE_ID,
    theme: FAMILY_A4_THEME,
    pieces,
    connections: connections(s),
    mainPath: mainPath(s),
    branches: branches(s),
    anchors: anchors(s),
    decor: decorRows(s),
  };
}
