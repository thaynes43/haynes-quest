import { describe, expect, it } from "vitest";
import { EnemyGroundNavigation } from "../../src/game/enemy-navigation";
import type { ObbyPlatform } from "../../src/game/obby";

function ground(id: string, x: number, z: number, width: number, depth: number): ObbyPlatform {
  return {
    id,
    center: { x, y: -0.3, z },
    size: { x: width, y: 0.6, z: depth },
  };
}

describe("ordinary enemy ground route", () => {
  it("chooses another connected corridor when a higher solid blocks a direct portal", () => {
    const navigation = new EnemyGroundNavigation({
      platforms: [
        ground("left", -2, 0, 4, 4),
        ground("right", 2, 0, 4, 4),
        ground("upper-corridor", 0, 2, 2, 2),
        { id: "wall", center: { x: 0, y: 0.75, z: 0 }, size: { x: 0.5, y: 0.5, z: 1 } },
      ],
      hazards: [], checkpoints: [],
    });
    expect(navigation.next({ x: -3, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }))
      .toMatchObject({ z: 1.5 });
  });

  it("refuses melee through a narrow gap even when both feet are within reach", () => {
    const navigation = new EnemyGroundNavigation({
      platforms: [
        ground("left", -1, 0, 2, 3),
        ground("right", 1.12, 0, 2, 3),
      ],
      hazards: [], checkpoints: [],
    });
    const enemy = { x: -0.1, y: 0, z: 0 };
    const player = { x: 0.12, y: 0, z: 0 };
    expect(navigation.next(enemy, player)).toBeNull();
    expect(navigation.canStrike(enemy, player)).toBe(false);
  });
});
