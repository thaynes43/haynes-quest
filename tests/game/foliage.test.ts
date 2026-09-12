import { describe, expect, it } from "vitest";
import { createObbyCourse } from "../../src/game/obby-layout";
import { grassPlacements } from "../../src/game/foliage";

describe("visible course planting", () => {
  it.each(["gentle-intro-v1", "gentle-jump-v1"] as const)("keeps %s grass on static surfaces and visible shoulders", (route) => {
    const course = createObbyCourse(route);
    const grass = grassPlacements(course);
    expect(grass.length).toBeGreaterThan(900);
    expect(grass.some((blade) => Math.abs(blade.x) < 2 && blade.z > -3)).toBe(true);
    for (const blade of grass) {
      expect(Math.abs(blade.x)).toBeGreaterThanOrEqual(1.65);
      expect(course.platforms.some((platform) => !platform.motion &&
        Math.abs(blade.x - platform.center.x) < platform.size.x / 2 &&
        Math.abs(blade.z - platform.center.z) < platform.size.z / 2 &&
        Math.abs(blade.y - (platform.center.y + platform.size.y / 2 + 0.012)) < 1e-6,
      )).toBe(true);
    }
  });
});
