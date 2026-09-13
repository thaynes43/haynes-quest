import { describe, expect, it } from "vitest";
import { authoredRoute } from "../../../src/game/authored-layout";

describe("WO083 probe: unique safe checkpoint per memory platform", () => {
  for (const routeId of ["garden-playground-v1", "besties-playground-v1"] as const) {
    it(`reports checkpoint coverage for ${routeId}`, () => {
      const route = authoredRoute(routeId)!;
      expect(route).toBeTruthy();
      const cps = route.course.checkpoints;
      console.log(`\n[${routeId}] checkpoints:`);
      for (const c of cps)
        console.log(
          `  ${c.id} triggerPlatformId=${c.triggerPlatformId ?? "-"} pos=${JSON.stringify(c.position)}`,
        );
      for (const slot of ["minor-one", "minor-two"] as const) {
        const platformId = route.anchors.memories[slot].platformId;
        const matches = cps.filter((c) => c.triggerPlatformId === platformId);
        console.log(
          `  ${slot}: platform=${platformId} matches=[${matches.map((m) => m.id).join(",")}] count=${matches.length}`,
        );
      }
    });
  }
});
