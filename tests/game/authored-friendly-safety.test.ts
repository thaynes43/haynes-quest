import { describe, expect, it } from "vitest";
import { authoredRoute } from "../../src/game/authored-layout";
import { EnemySimulation, enemyAttackRange } from "../../src/game/combat";
import { createLevelLayout } from "../../src/game/level";
import type { PositionSnapshot } from "../../src/game/types";
import { makeAuthoredSave } from "./authored-fixtures";

describe("authored friendly visits", () => {
  it.each([
    ["garden-playground-v1", "friendly-2", "ordinary-3", 2],
    ["besties-playground-v1", "friendly-3", "ordinary-4", 3],
  ] as const)(
    "keeps %s healing outside an alerted enemy's reach",
    (routeId, friendlySlot, enemySlot, ordinal) => {
      const route = authoredRoute(routeId)!;
      const save = makeAuthoredSave({ routeId });
      const layout = createLevelLayout(save);
      const enemyId = layout.encounters[ordinal]!.id;
      const friendly = route.anchors.friendlies[friendlySlot].position;
      const arena = route.anchors.encounters[enemySlot].arena;
      const lure = { x: arena.minX + 0.1, y: 0, z: arena.maxZ - 0.4 };
      const hitsAfterRetreat = (position: PositionSnapshot) => {
        const enemies = new EnemySimulation(layout, save);
        // First draw the real enemy to this corner; testing only its distant
        // starting position would miss the unsafe healing visit.
        for (let frame = 0; frame < 600; frame++) {
          enemies.step(
            { player: lure, active: true, deltaSeconds: 1 / 60 },
            save,
          );
        }
        let hits = 0;
        for (let frame = 0; frame < 600; frame++) {
          hits += enemies
            .step(
              { player: position, active: true, deltaSeconds: 1 / 60 },
              save,
            )
            .filter((id) => id === enemyId).length;
        }
        return hits;
      };
      expect(
        hitsAfterRetreat({ x: arena.minX - 0.6, y: 0, z: lure.z }),
      ).toBeGreaterThan(0);
      expect(hitsAfterRetreat(friendly)).toBe(0);
      const nearestArenaPoint = {
        x: Math.max(arena.minX, Math.min(arena.maxX, friendly.x)),
        z: Math.max(arena.minZ, Math.min(arena.maxZ, friendly.z)),
      };
      // Leave the 1.7m contact-healing area outside the enemy's maximum reach.
      expect(
        Math.hypot(
          friendly.x - nearestArenaPoint.x,
          friendly.z - nearestArenaPoint.z,
        ),
      ).toBeGreaterThan(1.7 + enemyAttackRange("ordinary"));
    },
  );
});
