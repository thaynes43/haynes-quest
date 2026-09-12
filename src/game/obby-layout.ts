import type { ObbyRouteId } from "../shared/parody-catalog";
import type { ObbyCourse, ObbyPlatform } from "./obby";
import { authoredRoute } from "./authored-layout";

function island(
  id: string,
  nearZ: number,
  farZ: number,
  width = 12,
): ObbyPlatform {
  return {
    id,
    center: { x: 0, y: -0.3, z: (nearZ + farZ) / 2 },
    size: { x: width, y: 0.6, z: nearZ - farZ },
  };
}

/** Lead-authored generous main routes. The sampled boxes also drive their visible surfaces. */
export function createObbyCourse(routeId: ObbyRouteId): ObbyCourse {
  const authored = authoredRoute(routeId);
  if (authored) return authored.course;
  const checkpoints = [
    { id: "start", position: { x: 0, y: 0, z: 1 }, triggerRadius: 1.25 },
    {
      id: "first-clearing",
      triggerPlatformId:
        routeId === "gentle-jump-v1" ? "first-clearing-island" : undefined,
      position: { x: 0, y: 0, z: -4.8 },
      triggerRadius: 0.65,
      triggerHalfExtents: { x: 6, z: 0.35 },
    },
    {
      id: "second-clearing",
      triggerPlatformId:
        routeId === "gentle-jump-v1" ? "second-clearing-island" : undefined,
      position: { x: 0, y: 0, z: -10.6 },
      triggerRadius: 0.55,
      triggerHalfExtents: { x: 6, z: 0.35 },
    },
    {
      id: "boss-landing",
      triggerPlatformId:
        routeId === "gentle-jump-v1" ? "boss-island" : undefined,
      position: { x: 0, y: 0, z: -19 },
      triggerRadius: 0.65,
      triggerHalfExtents: { x: 6, z: 0.35 },
    },
  ];
  if (routeId === "gentle-intro-v1") {
    return {
      platforms: [island("intro-ground", 3, -27)],
      hazards: [
        {
          id: "first-soft-sweeper",
          center: { x: 0, y: 0.24, z: -3.4 },
          halfLength: 1.2,
          radius: 0.2,
          motion: { axis: "x", distance: 3.8, period: 8, phase: Math.PI / 2 },
        },
        {
          id: "second-soft-sweeper",
          center: { x: 0, y: 0.24, z: -9.1 },
          halfLength: 1.2,
          radius: 0.2,
          motion: { axis: "x", distance: 3.8, period: 9, phase: -Math.PI / 2 },
        },
      ],
      checkpoints,
    };
  }
  return {
    platforms: [
      island("welcome-island", 3, -3.5),
      island("first-clearing-island", -4.2, -9.5),
      island("second-clearing-island", -10.2, -15.5),
      {
        id: "ferry-platform",
        center: { x: 0, y: -0.3, z: -17 },
        size: { x: 3.2, y: 0.6, z: 1.8 },
        motion: { axis: "z", distance: 0.35, period: 7 },
      },
      island("boss-island", -18.5, -27),
    ],
    hazards: [
      {
        id: "runway-sweeper",
        center: { x: 0, y: 0.2, z: -13.3 },
        halfLength: 0.75,
        radius: 0.18,
        rotation: { period: 10 },
      },
    ],
    checkpoints,
  };
}
