import { describe, expect, it } from "vitest";
import { createObbyCourse } from "../../src/game/obby-layout";
import { grassPlacements } from "../../src/game/foliage";
import { authoredRoute } from "../../src/game/authored-layout";

describe("visible course planting", () => {
  it.each(["garden-playground-v1", "besties-playground-v1"] as const)(
    "plants the full %s course within budget and outside encounter clearances",
    (routeId) => {
      const route = authoredRoute(routeId)!;
      const clearZones = Object.values(route.anchors.encounters).map(
        (entry) => entry.arena,
      );
      const grass = grassPlacements(route.course, {
        clearZones,
        maxInstances: 4400,
      });
      expect(grass.length).toBeGreaterThan(1000);
      expect(grass.length).toBeLessThanOrEqual(4400);
      expect(grass.some((blade) => blade.z > -4)).toBe(true);
      expect(
        grass.some(
          (blade) => blade.z < route.anchors.encounters.boss.position.z,
        ),
      ).toBe(true);
      for (const blade of grass) {
        expect(
          clearZones.some(
            (zone) =>
              blade.x >= zone.minX &&
              blade.x <= zone.maxX &&
              blade.z >= zone.minZ &&
              blade.z <= zone.maxZ,
          ),
        ).toBe(false);
        expect(
          route.course.platforms.some(
            (platform) =>
              !platform.motion &&
              Math.abs(blade.x - platform.center.x) < platform.size.x / 2 &&
              Math.abs(blade.z - platform.center.z) < platform.size.z / 2 &&
              Math.abs(
                blade.y - (platform.center.y + platform.size.y / 2 + 0.012),
              ) < 1e-6,
          ),
        ).toBe(true);
      }
    },
  );

  it.each(["gentle-intro-v1", "gentle-jump-v1"] as const)(
    "keeps %s grass on static surfaces and visible shoulders",
    (route) => {
      const course = createObbyCourse(route);
      const grass = grassPlacements(course);
      expect(grass.length).toBeGreaterThan(900);
      expect(grass.some((blade) => Math.abs(blade.x) < 2 && blade.z > -3)).toBe(
        true,
      );
      for (const blade of grass) {
        expect(Math.abs(blade.x)).toBeGreaterThanOrEqual(1.65);
        expect(
          course.platforms.some(
            (platform) =>
              !platform.motion &&
              Math.abs(blade.x - platform.center.x) < platform.size.x / 2 &&
              Math.abs(blade.z - platform.center.z) < platform.size.z / 2 &&
              Math.abs(
                blade.y - (platform.center.y + platform.size.y / 2 + 0.012),
              ) < 1e-6,
          ),
        ).toBe(true);
      }
    },
  );
});
