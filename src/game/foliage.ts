import type { ObbyCourse } from "./obby";
import type { PositionSnapshot } from "./types";

export interface GrassPlacement extends PositionSnapshot {
  scale: number;
  rotation: number;
}

/** Plant visible shoulders on actual island tops, leaving the middle route clear. */
export function grassPlacements(
  course?: ObbyCourse,
  options?: {
    clearZones: readonly {
      minX: number;
      maxX: number;
      minZ: number;
      maxZ: number;
    }[];
    maxInstances: number;
  },
): GrassPlacement[] {
  const platforms = course?.platforms.filter(
    (platform) => !platform.motion,
  ) ?? [
    {
      center: { x: 0, y: -0.3, z: -12 },
      size: { x: 12, y: 0.6, z: 30 },
    },
  ];
  const placements: GrassPlacement[] = [];
  for (const platform of platforms) {
    const top = platform.center.y + platform.size.y / 2;
    const near = platform.center.z + platform.size.z / 2 - 0.35;
    const far = platform.center.z - platform.size.z / 2 + 0.35;
    const halfWidth = platform.size.x / 2 - 0.35;
    for (let z = far; z <= near; z += 0.25) {
      for (const side of [-1, 1]) {
        for (let strand = 0; strand < 8; strand++) {
          const i = placements.length;
          // The inner border is visible beside the avatar in portrait view.
          const x =
            platform.center.x +
            side *
              (1.65 + (((i * 43) % 97) / 97) * Math.min(3.4, halfWidth - 1.65));
          if (Math.abs(x - platform.center.x) > halfWidth) continue;
          // Keep the boss's central arena and its warning shapes unobscured.
          if (options) {
            if (
              options.clearZones.some(
                (zone) =>
                  x >= zone.minX &&
                  x <= zone.maxX &&
                  z >= zone.minZ &&
                  z <= zone.maxZ,
              )
            )
              continue;
          } else if (z < -18.5 && Math.abs(x) < 3.1) continue;
          placements.push({
            x,
            y: top + 0.012,
            z,
            scale: 0.85 + (i % 9) / 14,
            rotation: i * 1.7,
          });
        }
      }
    }
  }
  if (options && placements.length > options.maxInstances) {
    // Sample the entire course evenly; a budget must not leave its far end bare.
    return Array.from(
      { length: options.maxInstances },
      (_, index) =>
        placements[
          Math.floor((index * placements.length) / options.maxInstances)
        ]!,
    );
  }
  return placements;
}
