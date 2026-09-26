/**
 * World A, chapter three: "Hero City" (PLAN-019, DESIGN-025 D-06).
 *
 * A pure, deterministic generator for the chapter's whole authored-level-v4
 * document. The World A assembler places it with
 * `chapterCommands(chapterId).replaceLevel(familyA3Level())` and casts it
 * with `familyA3CastCommands(chapterId)`; nothing here applies or validates
 * a command, and the shared validators stay the authority.
 *
 * Age band 5 → 9: jump, high jump and double jump are unlocked at the start,
 * and this is the first chapter with the double jump. The route (spawn to
 * finish, the player facing −z), climbing 15 m and never descending:
 *
 *   street deck ─ride─ freight elevator (+3 m, R9's opening elevator)
 *   → rooftop practice over a catch mattress (a high jump, then two double
 *     jumps) → pigeon roof (guard tool, putty fight 1)
 *   → a zig-zag of chimney hops west → water-tower roof (crane option in
 *     view) → two window-washer gondolas → satellite roof (robot fight 2)
 *   → two skylight hops → vent ledge ─walk─ big AC-vent pad ─bounce (+2.4 m)─
 *     billboard balcony (billboard-climb option)
 *   → a narrow neon-sign walk through a spinning fan → a pipe-roller catwalk
 *     → two pigeon-coop hops → putty plaza (minor one, fight 3)
 *   → two scaffold high jumps east → the crane-hook walk → scaffold deck
 *     (robot fight 4) → a window-washer cradle and three antenna hops
 *   → tower porch (minor two, a heal) → the double-jump tower climb over a
 *     catch net → tower top (the Monster-inator) ─walk─ helipad (major
 *     memory, reward respawn, finish).
 *
 * Optional routes, in golden-ticket order: B1 crane climb (double jumps, a
 * drop back), B2 billboard climb (high jump, double jumps, drops along the
 * billboard walkway past the neon fan), B3 water tank (small bounce, double
 * jump, a drop, the bonus lab-robot prototype).
 *
 * Every required connection heads away from the default camera or sideways
 * (R3); the chapter peaks at 15 m, below A4's 16 m finale (R8); the only
 * lift is the opening elevator (R9), with a 1.5 s dwell and flush landings
 * (R6); both pads leave a 0.35 m gap to their landing (R2); descents use
 * `drop` (R7); minor two waits on the porch at the foot of the boss climb
 * (R5); and the major memory, reward respawn and finish share the helipad,
 * with nothing after it (R1). Decor comes only from the rooftop kit and the
 * shared kit (R12).
 */
import type {
  AuthoredConnection,
  AuthoredDecor,
  AuthoredLevelPiece,
  AuthoredPlatformPiece,
} from "../../../src/shared/authored-level.js";
import type {
  LevelEditorCommand,
  LevelEditorEnemyCandidate,
  WorldEditorLevelDocument,
} from "../../../src/shared/editor-project.js";
import { chapterCommands, drop, jump, mm, ride, walk, bounce } from "../lib/growth-kit.js";
import {
  acceptDecor,
  anchorOn,
  building,
  checkpointOn,
  decorKeepOuts,
  encounterOn,
  liftCar,
  mover,
  padBlock,
  propHeight,
  rect,
  rectOf,
  slab,
  slider,
  spinner,
  standingProp,
  topOf,
  unitHash,
  wallProp,
  A3_STREET_Y,
  type Face,
  type Rect,
} from "./lib-a3.js";

export const FAMILY_A3_ROUTE_ID = "family-a3-rooftop";
export const FAMILY_A3_THEME = "rooftop" as const;
/** The chapter's recovered age band (WORLD-SPEC World A: 5 → 9). */
export const FAMILY_A3_AGES = Object.freeze({ fromYears: 5, toYears: 9 });

/**
 * What the chapter claims about its required route, for its test: the
 * standing heights the main path climbs through, in order, never
 * descending, and the peak (the boss tower and helipad).
 */
export const FAMILY_A3_CLAIMS = Object.freeze({
  peak: 15,
  climb: 15,
  requiredLevels: Object.freeze([
    0, 3, 3.6, 4.8, 6, 6.3, 6.6, 6.9, 9.3, 9.6, 10.2, 10.8, 11.1, 11.4, 12.6, 13.8, 15,
  ]),
});

// ---------------------------------------------------------------------------
// Geometry. Heights are standing tops; every static block rests on the street.
// ---------------------------------------------------------------------------

// S1: street deck and the opening freight elevator (+3 m).
const launchDeck = building("launch-deck", rect(-6, 6, -5, 5), 0);
const freightElevator = liftCar("freight-elevator", rect(-1.6, 1.6, -8.2, -5), 0, 3, 8, 1.5);
const elevatorRoof = building("elevator-roof", rect(-4, 4, -13.4, -8.2), 3);

// S2: practice over a catch mattress 0.3 m below the practice start; it runs
// 0.4 m under the start and the pigeon roof so it holds every jump corridor.
const rooftopMattress = slab("rooftop-mattress", rect(-5, 5, -23.8, -13), 2.7);
const fireEscape1 = building("fire-escape-1", rect(-2.5, 2.5, -17.6, -14.8), 3.6);
const fireEscape2 = building("fire-escape-2", rect(-2.5, 2.5, -22, -19.2), 4.8);
const pigeonRoof = building("pigeon-roof", rect(-7, 7, -35.4, -23.4), 6);

// S3: a zig-zag of chimney hops west, the water-tower roof and two
// window-washer gondolas swaying across the lane.
const chimney1 = building("chimney-1", rect(-11.2, -8, -33.7, -30.1), 6.3);
const chimney2 = building("chimney-2", rect(-15.4, -12.2, -34.9, -31.3), 6.3);
const chimney3 = building("chimney-3", rect(-19.6, -16.4, -33.7, -30.1), 6.6);
const chimney4 = building("chimney-4", rect(-23.8, -20.6, -34.9, -31.3), 6.6);
const waterTowerRoof = building("water-tower-roof", rect(-35.8, -24.8, -37, -28), 6.6);
const gondola1 = mover("gondola-1", rect(-40.4, -36.8, -34.7, -30.3), 6.6, {
  axis: "z",
  distance: 1,
  period: 8,
});
const gondola2 = mover("gondola-2", rect(-45, -41.4, -34.7, -30.3), 6.6, {
  axis: "z",
  distance: 1,
  period: 8,
  phase: mm(Math.PI),
});
const satelliteRoof = building("satellite-roof", rect(-58, -46, -44, -26), 6.6);

// S4: two skylight hops, the vent ledge, the big AC-vent pad and the
// billboard balcony (+2.4 m).
const skylight1 = building("skylight-1", rect(-55, -51.8, -48.2, -45), 6.6);
const skylight2 = building("skylight-2", rect(-53.4, -50.2, -52.4, -49.2), 6.6);
const ventLedge = building("vent-ledge", rect(-54, -50, -56.6, -53.4), 6.9);
const acVentPad = padBlock("ac-vent-pad", rect(-53.4, -50.6, -58.2, -56.6), 6.9, "big");
// R2: 0.35 m from the pad, and the balcony's wall reaches the street.
const billboardBalcony = building("billboard-balcony", rect(-58, -46, -67.55, -58.55), 9.3);

// S5: a narrow neon-sign walk through a spinning fan, a sliding pipe roller,
// two pigeon-coop stepping stones and the putty plaza.
const neonWalk = building("neon-walk", rect(-53.5, -50.5, -86.55, -68.55), 9.6);
const rollerCatwalk = building("roller-catwalk", rect(-55.5, -48.5, -96.55, -87.55), 9.6);
const pigeonCoop1 = building("pigeon-coop-1", rect(-54.4, -51.2, -101.15, -97.55), 9.6);
const pigeonCoop2 = building("pigeon-coop-2", rect(-52.8, -49.6, -105.75, -102.15), 9.6);
const puttyPlaza = building("putty-plaza", rect(-58, -46, -118.75, -106.75), 9.6);

// S6: scaffold high jumps east, the crane-hook walk and the scaffold deck.
const scaffold1 = building("scaffold-1", rect(-44.6, -41.4, -118.4, -114.4), 10.2);
const scaffold2 = building("scaffold-2", rect(-39.8, -36.6, -118.4, -114.4), 10.8);
const craneWalk = building("crane-walk", rect(-35.2, -25.2, -118.9, -113.9), 10.8);
const scaffoldDeck = building("scaffold-deck", rect(-23.8, -11.8, -122.4, -110.4), 10.8);

// S7: a window-washer cradle and antenna hops to the tower porch, then the
// double-jump tower climb over a catch net.
const windowCradle = mover("window-cradle", rect(-10.8, -7.2, -118.6, -114.2), 10.8, {
  axis: "z",
  distance: 1,
  period: 8,
});
const antenna1 = building("antenna-1", rect(-6.2, -3.4, -118.6, -115.8), 11.1);
const antenna2 = building("antenna-2", rect(-2.4, 0.4, -117, -114.2), 11.4);
const antenna3 = building("antenna-3", rect(1.4, 4.2, -118.6, -115.8), 11.4);
const towerPorch = building("tower-porch", rect(5.2, 12.2, -120.4, -112.4), 11.4);
const towerLedge1 = building("tower-ledge-1", rect(13.8, 17, -118.4, -114.4), 12.6);
const towerLedge2 = building("tower-ledge-2", rect(13.8, 17, -123.6, -120), 13.8);
const climbNet = slab("climb-net", rect(11.8, 19, -124.4, -113.4), 11.1);
const towerTop = building("tower-top", rect(18.6, 36.6, -132.4, -114.4), 15);
const helipad = building("helipad", rect(36.6, 44.6, -127.4, -119.4), 15);

// B1: the crane climb (double jumps) and a drop back to the satellite roof.
const craneMast1 = building("crane-mast-1", rect(-34, -30.8, -41.2, -38.4), 7.8);
const craneMast2 = building("crane-mast-2", rect(-39.2, -36, -41.2, -38.4), 9);
const craneJib = slab("crane-jib", rect(-44.6, -41.2, -41.2, -38.4), 9, 0.8);

// B2: the billboard climb east of the neon walk, then drops along the
// billboard walkway to the roller catwalk (it skips the neon fan).
const billboardLedge1 = building("billboard-ledge-1", rect(-44.6, -41.4, -65.9, -62.9), 10);
const billboardLedge2 = building("billboard-ledge-2", rect(-44.6, -41.4, -71.1, -67.5), 11.2);
const billboardTop = building("billboard-top", rect(-44.8, -41.2, -76.6, -72.7), 12.4);
const billboardWalkway = building("billboard-walkway", rect(-47.1, -41.1, -94, -78), 11.1);

// B3: the water tank (small bounce, double jump, drop) with the bonus robot.
const tankPad = padBlock("tank-pad", rect(-46, -44, -111.4, -109.4), 9.6, "small");
const tankCatwalk = building("tank-catwalk", rect(-43.65, -33.65, -113.4, -103.4), 10.8);
const tankTop = building("tank-top", rect(-32.05, -28.45, -112, -108.4), 12);
const tankLadder = building("tank-ladder", rect(-27.45, -24.8, -112.9, -108.9), 10.8);

const surfaces = [
  launchDeck,
  freightElevator,
  elevatorRoof,
  rooftopMattress,
  fireEscape1,
  fireEscape2,
  pigeonRoof,
  chimney1,
  chimney2,
  chimney3,
  chimney4,
  waterTowerRoof,
  gondola1,
  gondola2,
  satelliteRoof,
  skylight1,
  skylight2,
  ventLedge,
  acVentPad,
  billboardBalcony,
  neonWalk,
  rollerCatwalk,
  pigeonCoop1,
  pigeonCoop2,
  puttyPlaza,
  scaffold1,
  scaffold2,
  craneWalk,
  scaffoldDeck,
  windowCradle,
  antenna1,
  antenna2,
  antenna3,
  towerPorch,
  towerLedge1,
  towerLedge2,
  climbNet,
  towerTop,
  helipad,
  craneMast1,
  craneMast2,
  craneJib,
  billboardLedge1,
  billboardLedge2,
  billboardTop,
  billboardWalkway,
  tankPad,
  tankCatwalk,
  tankTop,
  tankLadder,
] as const;

// Sweepers. The neon fan spins across the narrow walk like a turnstile, so a
// child waits for it to pass; the pipe roller slides across the catwalk (wait
// or hop it); the crane hook pivots 1.2 m south of the crane walk's lane and
// sweeps across it, leaving the walk's north edge clear.
const neonFan = spinner("neon-fan", { x: -52, z: -77.55 }, 9.6, 1.9, 10);
const pipeRoller = slider("pipe-roller", { x: -52, z: -92.05 }, 9.6, 1.1, {
  axis: "x",
  distance: 2,
  period: 9,
});
const craneHook = spinner("crane-hook", { x: -30.2, z: -117.6 }, 10.8, 1.8, 14, mm(Math.PI / 2), 0.25);

// Checkpoints (all armed anywhere on their platform).
const checkpoints = [
  checkpointOn("cp-launch", launchDeck, 0, 3),
  checkpointOn("cp-elevator-roof", elevatorRoof, 0, -10),
  checkpointOn("cp-pigeon", pigeonRoof, -4, -26.5),
  checkpointOn("cp-water-tower", waterTowerRoof, -26.4, -31),
  checkpointOn("cp-satellite", satelliteRoof, -47.9, -28),
  checkpointOn("cp-billboard", billboardBalcony, -48.4, -60.9),
  checkpointOn("cp-neon-walk", neonWalk, -52, -69.9),
  checkpointOn("cp-plaza", puttyPlaza, -49.4, -109),
  checkpointOn("cp-scaffold", scaffoldDeck, -21.9, -112.4),
  checkpointOn("cp-porch", towerPorch, 6.2, -116.4),
  checkpointOn("cp-tower", towerTop, 19.4, -116.4),
  checkpointOn("cp-tank", tankCatwalk, -43, -104.4),
] as const;

const pieces: AuthoredLevelPiece[] = [
  ...surfaces,
  neonFan,
  pipeRoller,
  craneHook,
  ...checkpoints,
];

// ---------------------------------------------------------------------------
// Connections, main path and branches.
// ---------------------------------------------------------------------------

const practice = { safeMissPlatformId: rooftopMattress.id } as const;
const net = { safeMissPlatformId: climbNet.id } as const;

const connections: AuthoredConnection[] = [
  // S1
  ride(launchDeck.id, freightElevator.id),
  ride(freightElevator.id, elevatorRoof.id),
  // S2: the practice stretch, then its retry from the mattress.
  jump(elevatorRoof.id, fireEscape1.id, { requires: "high-jump", ...practice }),
  jump(fireEscape1.id, fireEscape2.id, { requires: "double-jump", ...practice }),
  jump(fireEscape2.id, pigeonRoof.id, { requires: "double-jump", ...practice }),
  jump(rooftopMattress.id, elevatorRoof.id),
  // S3
  jump(pigeonRoof.id, chimney1.id),
  jump(chimney1.id, chimney2.id),
  jump(chimney2.id, chimney3.id),
  jump(chimney3.id, chimney4.id),
  jump(chimney4.id, waterTowerRoof.id),
  ride(waterTowerRoof.id, gondola1.id),
  ride(gondola1.id, gondola2.id),
  ride(gondola2.id, satelliteRoof.id),
  // S4
  jump(satelliteRoof.id, skylight1.id),
  jump(skylight1.id, skylight2.id),
  jump(skylight2.id, ventLedge.id),
  walk(ventLedge.id, acVentPad.id),
  bounce(acVentPad.id, billboardBalcony.id),
  // S5
  jump(billboardBalcony.id, neonWalk.id),
  jump(neonWalk.id, rollerCatwalk.id),
  jump(rollerCatwalk.id, pigeonCoop1.id),
  jump(pigeonCoop1.id, pigeonCoop2.id),
  jump(pigeonCoop2.id, puttyPlaza.id),
  // S6
  jump(puttyPlaza.id, scaffold1.id, { requires: "high-jump" }),
  jump(scaffold1.id, scaffold2.id, { requires: "high-jump" }),
  jump(scaffold2.id, craneWalk.id),
  jump(craneWalk.id, scaffoldDeck.id),
  // S7: the climb reuses the double jump at the climax, over a catch net.
  ride(scaffoldDeck.id, windowCradle.id),
  ride(windowCradle.id, antenna1.id),
  jump(antenna1.id, antenna2.id),
  jump(antenna2.id, antenna3.id),
  jump(antenna3.id, towerPorch.id),
  jump(towerPorch.id, towerLedge1.id, { requires: "double-jump", ...net }),
  jump(towerLedge1.id, towerLedge2.id, { requires: "double-jump", ...net }),
  jump(towerLedge2.id, towerTop.id, { requires: "double-jump", ...net }),
  jump(climbNet.id, towerPorch.id),
  walk(towerTop.id, helipad.id),
  // B1
  jump(waterTowerRoof.id, craneMast1.id, { requires: "double-jump" }),
  jump(craneMast1.id, craneMast2.id, { requires: "double-jump" }),
  jump(craneMast2.id, craneJib.id, { requires: "double-jump" }),
  drop(craneJib.id, satelliteRoof.id),
  // B2
  jump(billboardBalcony.id, billboardLedge1.id, { requires: "high-jump" }),
  jump(billboardLedge1.id, billboardLedge2.id, { requires: "double-jump" }),
  jump(billboardLedge2.id, billboardTop.id, { requires: "double-jump" }),
  drop(billboardTop.id, billboardWalkway.id),
  drop(billboardWalkway.id, rollerCatwalk.id),
  // B3
  walk(puttyPlaza.id, tankPad.id),
  bounce(tankPad.id, tankCatwalk.id),
  jump(tankCatwalk.id, tankTop.id, { requires: "double-jump" }),
  drop(tankTop.id, tankLadder.id),
  jump(tankLadder.id, scaffoldDeck.id),
];

const mainPath = [
  launchDeck,
  freightElevator,
  elevatorRoof,
  fireEscape1,
  fireEscape2,
  pigeonRoof,
  chimney1,
  chimney2,
  chimney3,
  chimney4,
  waterTowerRoof,
  gondola1,
  gondola2,
  satelliteRoof,
  skylight1,
  skylight2,
  ventLedge,
  acVentPad,
  billboardBalcony,
  neonWalk,
  rollerCatwalk,
  pigeonCoop1,
  pigeonCoop2,
  puttyPlaza,
  scaffold1,
  scaffold2,
  craneWalk,
  scaffoldDeck,
  windowCradle,
  antenna1,
  antenna2,
  antenna3,
  towerPorch,
  towerLedge1,
  towerLedge2,
  towerTop,
  helipad,
].map((piece) => piece.id);

/** Golden tickets go to the first three branches, in this order. */
const branches = [
  [waterTowerRoof, craneMast1, craneMast2, craneJib, satelliteRoof],
  [billboardBalcony, billboardLedge1, billboardLedge2, billboardTop, billboardWalkway, rollerCatwalk],
  [puttyPlaza, tankPad, tankCatwalk, tankTop, tankLadder, scaffoldDeck],
].map((branch) => branch.map((piece) => piece.id));

// ---------------------------------------------------------------------------
// Anchors. Arenas keep their strike envelopes (arena + 1.35 m, boss 2.25 m)
// at least 0.5 m inside their deck and clear of every exit strip (R4).
// ---------------------------------------------------------------------------

const cp = Object.fromEntries(checkpoints.map((piece) => [piece.id, piece.id]));

const anchors: WorldEditorLevelDocument["anchors"] = {
  spawn: anchorOn(launchDeck, 0, 3),
  finish: anchorOn(helipad, 43.1, -123.4),
  rewardRespawn: anchorOn(helipad, 38.6, -123.4),
  pickups: {
    "attack-tool": anchorOn(launchDeck, -2.5, 0.5),
    "guard-tool": anchorOn(pigeonRoof, -4.5, -29),
  },
  memories: {
    // R5: minor one sits on the fight-3 deck, minor two at the foot of the
    // boss climb, about 21 m of route from the boss arena.
    "minor-one": anchorOn(puttyPlaza, -49.4, -115.5),
    "minor-two": anchorOn(towerPorch, 7.2, -114.4),
    major: anchorOn(helipad, 40.6, -123.4),
  },
  encounters: {
    "ordinary-1": encounterOn("ordinary-a", pigeonRoof, rect(1, 4.5, -33, -29), cp["cp-pigeon"]!),
    "ordinary-2": encounterOn("ordinary-b", satelliteRoof, rect(-55.8, -51.8, -32, -28), cp["cp-satellite"]!),
    "ordinary-3": encounterOn("ordinary-a", puttyPlaza, rect(-56, -52, -115.9, -111.9), cp["cp-plaza"]!),
    "ordinary-4": encounterOn("ordinary-b", scaffoldDeck, rect(-20.05, -15.55, -120.4, -115.9), cp["cp-scaffold"]!),
    boss: encounterOn("boss", towerTop, rect(22.2, 30.2, -127.4, -119.4), cp["cp-tower"]!),
    // The optional lab-robot prototype on the water-tank catwalk (B3).
    "bonus-1": encounterOn("ordinary-b", tankCatwalk, rect(-41.2, -37.2, -109.8, -105.8), cp["cp-tank"]!),
  },
  friendlies: {
    "friendly-1": anchorOn(launchDeck, -4, 2.5),
    // A visual cue where the skylight hops lead to the vent bounce ("gap
    // helper" is future vocabulary).
    "friendly-2": anchorOn(satelliteRoof, -55.9, -42.5),
    // A heal at the foot of the boss climb.
    "friendly-3": anchorOn(towerPorch, 10.7, -118.9),
  },
};

// ---------------------------------------------------------------------------
// Decor: the rooftop kit first, then shared props. Every placement keeps out
// of walkable space, connection corridors and fight envelopes; nothing
// stands on a roof, so wall props hang on faces and landmarks stand on the
// street or on a skyline block.
// ---------------------------------------------------------------------------

type Candidate = { readonly entry: AuthoredDecor; readonly stackedOn?: string };

const ROOF_FACES: readonly Face[] = ["nz", "nx", "px", "pz"];

function faceLength(area: Rect, face: Face): number {
  return face === "px" || face === "nx" ? area.maxZ - area.minZ : area.maxX - area.minX;
}

/** Props hung on the faces of the named roofs, at `alongs` along each face. */
function onFaces(
  prefix: string,
  kitPropId: string,
  roofs: readonly AuthoredPlatformPiece[],
  alongs: (length: number) => readonly number[],
  yOffset: number,
  options: { readonly scale?: number; readonly inward?: boolean; readonly faces?: readonly Face[] } = {},
): Candidate[] {
  const candidates: Candidate[] = [];
  for (const roof of roofs) {
    const area = rectOf(roof);
    for (const face of options.faces ?? ROOF_FACES)
      alongs(faceLength(area, face)).forEach((along, index) =>
        candidates.push({
          entry: wallProp(
            `${prefix}-${roof.id}-${face}-${index}`,
            kitPropId,
            area,
            topOf(roof),
            face,
            along,
            yOffset,
            options,
          ),
        }),
      );
  }
  return candidates;
}

/** Street-level skyline blocks on an 8 m grid, nearest the course first. */
function skyline(footprints: readonly Rect[]): Candidate[] {
  const cells: Array<{ x: number; z: number; index: number; distance: number }> = [];
  let index = 0;
  for (let z = 17; z >= -120; z -= 8)
    for (let x = -80; x <= 56; x += 8) {
      index += 1;
      const distance = Math.min(
        ...footprints.map((area) =>
          Math.hypot(
            Math.max(area.minX - x, 0, x - area.maxX),
            Math.max(area.minZ - z, 0, z - area.maxZ),
          ),
        ),
      );
      if (distance < 3.5 || distance > 22) continue;
      cells.push({ x, z, index, distance });
    }
  cells.sort((left, right) => left.distance - right.distance || left.index - right.index);
  const candidates: Candidate[] = [];
  for (const cell of cells) {
    const scale = mm(2.2 + 1.4 * unitHash(cell.index));
    const rotationY = mm((Math.floor(4 * unitHash(cell.index + 7)) * Math.PI) / 2);
    const id = `skyline-${cell.index}`;
    candidates.push({
      entry: standingProp(id, "toybox-block-tower", cell, { rotationY, scale }),
    });
    if (cell.index % 3 === 0)
      candidates.push({
        entry: standingProp(`${id}-tank`, "water-tower", cell, {
          rotationY,
          scale: mm(0.8 + 0.3 * unitHash(cell.index + 3)),
          baseY: mm(A3_STREET_Y + propHeight("toybox-block-tower", scale)),
        }),
        stackedOn: id,
      });
  }
  return candidates;
}

/**
 * A landmark water tower on a stack of skyline blocks just outside a named
 * roof's face. The blocks turn their long side away from the wall, the stack
 * ends 1 m under the roof, and the tank sits on its top, so it reads as a
 * neighbouring building's tank rising well above the roofline.
 */
function heroTower(
  roof: AuthoredPlatformPiece,
  face: Face,
  along: number,
  tankScale: number,
): Candidate[] {
  const area = rectOf(roof);
  const height = topOf(roof) - 1 - A3_STREET_Y;
  const unit = propHeight("toybox-block-tower", 1);
  const blocks = Math.ceil(height / (unit * 3.5));
  const blockScale = mm(height / blocks / unit);
  // The block's local x (1.7 m per unit scale) points away from the wall.
  const across = 1.7 * blockScale;
  const alongWidth = 0.912 * blockScale;
  const out = across / 2 + 0.05;
  const midX = (area.minX + area.maxX) / 2;
  const midZ = (area.minZ + area.maxZ) / 2;
  const at =
    face === "px"
      ? { x: area.maxX + out, z: midZ + along }
      : face === "nx"
        ? { x: area.minX - out, z: midZ + along }
        : face === "pz"
          ? { x: midX + along, z: area.maxZ + out }
          : { x: midX + along, z: area.minZ - out };
  const rotationY = face === "px" || face === "nx" ? 0 : mm(Math.PI / 2);
  const candidates: Candidate[] = [];
  let base = A3_STREET_Y;
  let below: string | undefined;
  for (let index = 0; index < blocks; index += 1) {
    const block = standingProp(`hero-block-${roof.id}-${index}`, "toybox-block-tower", at, {
      rotationY,
      scale: blockScale,
      baseY: mm(base),
    });
    candidates.push(below === undefined ? { entry: block } : { entry: block, stackedOn: below });
    below = block.id;
    base += propHeight("toybox-block-tower", blockScale);
  }
  const scale = mm(Math.min(tankScale, (0.95 * alongWidth) / 2.8));
  candidates.push({
    entry: standingProp(`hero-tank-${roof.id}`, "water-tower", at, { rotationY, scale, baseY: mm(base) }),
    stackedOn: below!,
  });
  return candidates;
}

/** The most decor the chapter places (the validator allows 200). */
export const FAMILY_A3_DECOR_LIMIT = 150;

function decorFor(level: Omit<WorldEditorLevelDocument, "decor">): AuthoredDecor[] {
  const keepOuts = decorKeepOuts(level);
  const mainRoofs = [
    elevatorRoof,
    pigeonRoof,
    waterTowerRoof,
    satelliteRoof,
    billboardBalcony,
    neonWalk,
    puttyPlaza,
    scaffoldDeck,
    towerPorch,
    towerTop,
    helipad,
  ];
  const footprints = surfaces.map((piece) => rectOf(piece));
  type Box = { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
  const overlaps = (box: Box, area: Rect) =>
    Math.min(box.maxX, area.maxX) - Math.max(box.minX, area.minX) > 0 &&
    Math.min(box.maxZ, area.maxZ) - Math.max(box.minZ, area.minZ) > 0;
  // The yaw-0 camera trails about 6 m toward +z of the player and 3 m up:
  // nothing taller than a parapet may stand in that band behind a main deck.
  const cameraBands = level.mainPath.map((id) => {
    const surface = surfaces.find((piece) => piece.id === id)!;
    const area = rectOf(surface);
    const top = surface.type === "lift" ? topOf(surface) + surface.travel.distance : topOf(surface);
    return { area: rect(area.minX - 2, area.maxX + 2, area.maxZ, area.maxZ + 7), top };
  });
  const inCameraBand = (box: Box) =>
    cameraBands.some((band) => box.maxY > band.top + 1 && overlaps(box, band.area));
  // Street props must not hide inside a building or an alley between roofs.
  const nearRoof = (box: Box) =>
    box.minY <= A3_STREET_Y + 1e-6 &&
    footprints.some((area) => overlaps(box, rect(area.minX - 1, area.maxX + 1, area.minZ - 1, area.maxZ + 1)));
  const farFaces: readonly Face[] = ["nz", "nx", "px"];
  const passes: ReadonlyArray<{
    readonly candidates: readonly Candidate[];
    readonly limit?: number;
    readonly spacing?: number;
    readonly street?: boolean;
  }> = [
    // Tier 1: landmark water towers, billboards, crane hooks and lab consoles.
    {
      candidates: [
        ...heroTower(waterTowerRoof, "nz", 3, 1.2),
        ...heroTower(satelliteRoof, "nx", 6, 1.1),
        ...heroTower(puttyPlaza, "nx", -2, 1.1),
        ...heroTower(towerTop, "nz", 4, 1.3),
      ],
    },
    {
      candidates: onFaces(
        "sign",
        "billboard-frame",
        [pigeonRoof, satelliteRoof, billboardBalcony, puttyPlaza, scaffoldDeck, towerTop],
        () => [0],
        -0.8,
        { scale: 1.1, faces: farFaces },
      ),
      limit: 8,
    },
    { candidates: onFaces("hook", "crane-hook", [craneMast1, craneMast2, craneJib], () => [0], -2.2, { faces: ["pz", "nz"] }) },
    {
      candidates: onFaces("console", "midnight-arcade-cabinet", [towerTop], () => [-6, -2, 2, 6], -0.9, {
        faces: ["nz"],
        inward: true,
      }),
    },
    // Tier 2: wall units, parapet posts, rails and lamps.
    {
      candidates: onFaces(
        "ac",
        "rooftop-ac-unit",
        [pigeonRoof, waterTowerRoof, satelliteRoof, billboardBalcony, puttyPlaza, scaffoldDeck, towerPorch, towerTop],
        () => [0],
        -2.2,
      ),
      limit: 16,
    },
    {
      candidates: onFaces("bollard", "midnight-joystick-bollard", [towerTop, helipad], () => [-6, -2, 2, 6], -0.4, {
        faces: ["nz", "px"],
      }),
    },
    {
      candidates: onFaces("rail", "toybox-safety-rail", mainRoofs, (length) => (length >= 6.4 ? [-1.35, 1.35] : [0]), -0.1),
      limit: 28,
    },
    {
      candidates: onFaces(
        "lamp",
        "toybox-windup-lantern",
        [billboardBalcony, towerPorch, towerTop, helipad],
        (length) => [-(length / 2 - 0.4), length / 2 - 0.4],
        -0.1,
      ),
      limit: 24,
    },
    // The skyline fills the rest.
    { candidates: skyline(footprints), spacing: 0.5, street: true },
  ];
  let placed: AuthoredDecor[] = [];
  for (const pass of passes) {
    const room = FAMILY_A3_DECOR_LIMIT - placed.length;
    const limit = Math.min(room, pass.limit ?? room);
    const accepted = acceptDecor(pass.candidates, keepOuts, {
      existing: placed,
      limit,
      spacing: pass.spacing ?? 0.1,
      reject: (box) => inCameraBand(box) || (pass.street === true && nearRoof(box)),
    });
    placed = [...placed, ...accepted];
  }
  return placed;
}

/**
 * The chapter's complete authored-level-v4 document. Pure and
 * deterministic: every call returns an equal, freshly built object.
 */
export function familyA3Level(): WorldEditorLevelDocument {
  const level: Omit<WorldEditorLevelDocument, "decor"> = {
    schemaVersion: "authored-level-v4",
    id: FAMILY_A3_ROUTE_ID,
    theme: FAMILY_A3_THEME,
    pieces: structuredClone(pieces),
    connections: structuredClone(connections),
    mainPath: [...mainPath],
    branches: branches.map((branch) => [...branch]),
    anchors: structuredClone(anchors),
  };
  return { ...level, decor: decorFor(level) };
}

// ---------------------------------------------------------------------------
// Cast (WORLD-SPEC, verbatim): two ordinary identities and the boss, as
// project candidates in the hero-city-v1 period until catalog entries land.
// ---------------------------------------------------------------------------

const heroCity = { startDate: "2018-12-14", endDate: "2026-12-31" } as const;

export const FAMILY_A3_CAST = Object.freeze({
  puttyGrunt: Object.freeze({
    id: "putty-grunt",
    name: "Putty Grunt",
    periodId: "hero-city-v1",
    recognizableReference: "clay foot-soldier from morphing-hero shows",
    visualJoke: "flops like dough when hit",
    obstacleOrAttack: "clumsy punches",
    eligibility: heroCity,
    role: "ordinary",
    kind: "ordinary-a",
    behaviorPreset: "ordinary-a",
  }),
  labRobot: Object.freeze({
    id: "lab-robot",
    name: "Lab Robot",
    periodId: "hero-city-v1",
    recognizableReference: "the scientist's runaway lab robot",
    visualJoke: "beeps a warning before every move",
    obstacleOrAttack: "claw pinch",
    eligibility: heroCity,
    role: "ordinary",
    kind: "ordinary-b",
    behaviorPreset: "ordinary-b",
  }),
  inatorMonster: Object.freeze({
    id: "inator-monster",
    name: "The Monster-inator",
    periodId: "hero-city-v1",
    recognizableReference: "a cartoon evil scientist riding his giant rubber-suit monster",
    visualJoke: 'the "-inator" remote keeps backfiring',
    obstacleOrAttack: "monster stomp and roar",
    eligibility: heroCity,
    role: "boss",
    kind: "boss",
    behaviorPreset: "boss",
  }),
} satisfies Record<string, LevelEditorEnemyCandidate>);

/**
 * Casts the chapter after its level is in place (R11): putty grunts in
 * ordinary-1 and ordinary-3, lab robots in ordinary-2, ordinary-4 and the
 * bonus prototype, and the Monster-inator boss.
 */
export function familyA3CastCommands(chapterId: string): LevelEditorCommand[] {
  const chapter = chapterCommands(chapterId);
  const candidate = (id: string) => ({ source: "candidate" as const, candidateId: id });
  const cast = FAMILY_A3_CAST;
  return [
    chapter.addCandidate("ordinary-1", cast.puttyGrunt),
    chapter.addCandidate("ordinary-2", cast.labRobot),
    chapter.assign("ordinary-3", candidate(cast.puttyGrunt.id)),
    chapter.assign("ordinary-4", candidate(cast.labRobot.id)),
    chapter.addCandidate("boss", cast.inatorMonster),
    chapter.assign("bonus-1", candidate(cast.labRobot.id)),
  ];
}
