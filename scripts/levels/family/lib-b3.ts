/**
 * Layout constants and decor for World B chapter 3, Besties' Big Stage
 * (`b3.ts` builds the course from the same constants).
 *
 * Decor uses only the party kit's own props (R12, `placeableThemeKitProps`),
 * so no shared GLB enters gameplay here. Every prop stands on the course
 * ground plane (y = -1.4) beside the towers, never on a deck, in a jump
 * corridor, a fight area, a pad's launch column or the lift shaft, and never
 * behind the spawn where the follow camera sits. No arch spans a lane. Along
 * the sideways act 2 the tall props stand on the far (-z) side, so they frame
 * the route without coming between it and the camera. Sizes come from a
 * target height: scale = target / the registry box height, clamped to the
 * validator's 0.25–4.
 */
import type { AuthoredDecor } from "../../../src/shared/authored-level.js";
import { themeKitProp } from "../../../src/shared/theme-kits.js";
import { decor, mm } from "../lib/growth-kit.js";

export type Range = readonly [number, number];

/** The course ground plane: every static deck is a tower down to it. */
export const GROUND = -1.4;
/** The soft practice floor's slab; practice pieces stand on its underside. */
export const FLOOR_BOTTOM = -0.6;

/**
 * Standing heights (tops). L0 0–0.3 · practice 1.5/2.7 · L1 3.0–3.3 ·
 * L2 5.3–6.8 · L3 10.4–11.3. The required route climbs from 0.3 to 11.3.
 */
export const FAMILY_B3_HEIGHTS = Object.freeze({
  plaza: 0.3,
  floor: 0,
  riser: 1.5,
  loft: 2.7,
  picnic: 3.0,
  bandstand: 3.3,
  balcony: 5.3,
  hops: 5.6,
  sky: 6.8,
  liftBottom: 6.7,
  liftTop: 10.5,
  wing: 10.4,
  stair1: 10.7,
  stair2: 11.0,
  stage: 11.3,
});

/**
 * Act 2 runs sideways (+x) along the line `z = ACT2_Z`, the fan balcony's and
 * speaker raft's centre line; its decks are placed at offsets from it.
 */
export const ACT2_Z = -84.95;
export const z2 = (dz: number): number => ACT2_Z + dz;
export const s2 = (min: number, max: number): Range => [z2(min), z2(max)];

/**
 * Act 3 runs toward -z from the last glow hop. Its pieces are placed relative
 * to the centre line `x` and that hop's far (-z) edge `z`.
 */
export const ACT3 = Object.freeze({ x: 102.55, z: -95.7 });
export const x3 = (dx: number): number => ACT3.x + dx;
export const z3 = (dz: number): number => ACT3.z + dz;
export const r3 = (min: number, max: number): Range => [x3(min), x3(max)];
export const s3 = (min: number, max: number): Range => [z3(min), z3(max)];

type PartyProp =
  | "party-gift-stack"
  | "party-balloon-post"
  | "party-arch"
  | "stage-speaker"
  | "light-truss"
  | "star-backdrop";

/** A quarter turn: the prop's front (+z) faces +x, its width runs along z. */
const SIDEWAYS = mm(Math.PI / 2);

/**
 * A party prop standing on the ground plane at (x, z), sized so its top sits
 * `height` metres above the ground plane.
 */
function ground(
  id: string,
  kitPropId: PartyProp,
  x: number,
  z: number,
  height: number,
  rotationY = 0,
): AuthoredDecor {
  const prop = themeKitProp(kitPropId);
  if (!prop) throw new Error(`Party prop ${kitPropId} is not registered`);
  const scale = Math.min(4, Math.max(0.25, Math.round((height / prop.bounds.max.y) * 100) / 100));
  return decor(id, kitPropId, { x, y: GROUND, z }, { rotationY, scale });
}

/** Mirrored pairs share a height and turn to face the lane between them. */
function pair(
  id: string,
  kitPropId: PartyProp,
  xs: readonly [number, number],
  z: number,
  height: number,
  sideways = false,
): AuthoredDecor[] {
  return [
    ground(`${id}-left`, kitPropId, xs[0], z, height, sideways ? SIDEWAYS : 0),
    ground(`${id}-right`, kitPropId, xs[1], z, height, sideways ? -SIDEWAYS : 0),
  ];
}

export function familyB3Decor(): AuthoredDecor[] {
  const fanWalkRows = [-7, -11, -15, -19, -23];
  return [
    // Act 1: the stage door, framed by speakers and balloons (none behind the
    // spawn, where the camera sits).
    ...pair("door-speaker", "stage-speaker", [-6.4, 6.4], -1.5, 3.2),
    ...pair("door-balloons", "party-balloon-post", [-5.9, 5.9], -3.3, 4.2),
    ground("door-gifts", "party-gift-stack", -7.2, 0.9, 2.4),
    // The fan walk: rows of cheering "fans" (speakers and balloons) on both
    // sides of the carpet.
    ...fanWalkRows.flatMap((z, row) =>
      row % 2 === 0
        ? pair(`fan-speaker-${row + 1}`, "stage-speaker", [-3.7, 3.7], z, 3.1, true)
        : pair(`fan-balloons-${row + 1}`, "party-balloon-post", [-3.4, 3.4], z, 4.4),
    ),
    // Practice: spotlight rigs beside the soft floor.
    ...pair("practice-rig", "light-truss", [-9.6, 9.6], -33, 5, true),
    ...pair("practice-balloons", "party-balloon-post", [-9, 9], -28.6, 4.4),
    // L1: the fan picnic, the runway and the bandstand.
    ...pair("picnic-balloons-a", "party-balloon-post", [-8, 8], -40.2, 5.4),
    ...pair("picnic-balloons-b", "party-balloon-post", [-8, 8], -47.8, 5.4),
    ground("picnic-gifts", "party-gift-stack", 9.4, -44, 3.5),
    ...pair("runway-speaker", "stage-speaker", [-8.3, 2.3], -53.8, 4.6, true),
    ground("bandstand-rig", "light-truss", 4.8, -63, 6.5, SIDEWAYS),
    ground("bandstand-balloons-a", "party-balloon-post", -10.2, -60, 5.6),
    ground("bandstand-balloons-b", "party-balloon-post", -10.2, -66.2, 5.6),
    ground("relay-gifts-a", "party-gift-stack", 2.6, -72.2, 3.6),
    ground("relay-gifts-b", "party-gift-stack", -8.8, -73, 3.6),
    ...pair("trampoline-balloons", "party-balloon-post", [-6.6, 0.7], -78.4, 6),
    // The fan balcony, the corner of the course.
    ground("balcony-rig", "light-truss", -3, -89.6, 8),
    ground("balcony-speaker", "stage-speaker", -9.6, -84.95, 6.5, SIDEWAYS),
    // Act 2: a concert wall far behind the sideways route (-z side), and low
    // gifts on the camera side, below deck height.
    ground("wall-stars-1", "star-backdrop", 10, -100.5, 9.9),
    ground("wall-rig-1", "light-truss", 24, -100.5, 10),
    ground("wall-stars-2", "star-backdrop", 38, -100.5, 9.9),
    ground("wall-rig-2", "light-truss", 52, -100.5, 10),
    ground("wall-stars-3", "star-backdrop", 66, -100.5, 9.9),
    ground("wall-rig-3", "light-truss", 80, -100.5, 10),
    ground("dock-gifts", "party-gift-stack", 9.6, z2(6), 3.2),
    ground("grove-gifts", "party-gift-stack", 30, z2(4.8), 3.2),
    ground("grove-balloons", "party-balloon-post", 34.6, z2(4.4), 6),
    ground("fair-gifts", "party-gift-stack", 53.6, z2(2.4), 3.4),
    ground("bleacher-gifts", "party-gift-stack", 71.2, z2(1.6), 3.4),
    ground("catwalk-balloons-a", "party-balloon-post", 80, z2(-8.2), 7.4),
    ground("catwalk-balloons-b", "party-balloon-post", 88, z2(-8.2), 7.4),
    // Act 3: the crowd under the bridge, the lift tower and the big stage.
    ...[-3.6, -7.6, -11.6].flatMap((dz, row) =>
      pair(
        `crowd-${row + 1}`,
        row % 2 === 0 ? "stage-speaker" : "party-balloon-post",
        [x3(-4.6), x3(4.6)],
        z3(dz),
        row % 2 === 0 ? 4.4 : 5.6,
        row % 2 === 0,
      ),
    ),
    ground("lift-tower", "light-truss", x3(5.3), z3(-21), 12, SIDEWAYS),
    // Two 17 m light rigs flank the Besties' stage; speaker stacks stand
    // outside them.
    ...pair("stage-rig", "light-truss", [x3(-9.7), x3(9.7)], z3(-45.3), 14.5, true),
    ...pair("stage-speaker-front", "stage-speaker", [x3(-12.8), x3(12.8)], z3(-38.5), 7.2, true),
    ...pair("stage-speaker-back", "stage-speaker", [x3(-12.8), x3(12.8)], z3(-52), 7.2, true),
    ground("encore-stars", "star-backdrop", x3(0), z3(-63.4), 15.3),
  ];
}
