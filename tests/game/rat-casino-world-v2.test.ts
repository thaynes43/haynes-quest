import { describe, expect, it } from "vitest";

import { enemyAttackRange } from "../../src/game/combat";
import { resolveLevelEditorProject } from "../../src/shared/editor-project";
import original from "../../src/shared/levels/rat-casino-world-v1.json";
import current from "../../src/shared/levels/rat-casino-world-v2.json";

describe("Rat Casino optional Golden route", () => {
  it("retains the five existing encounters and course while adding a separated side fight", () => {
    const old = resolveLevelEditorProject(original).levels["rat-casino-v1"]!;
    const next = resolveLevelEditorProject(current).levels["rat-casino-v2"]!;
    expect(next.document.pieces).toEqual(old.document.pieces);
    expect(next.document.connections).toEqual(old.document.connections);
    expect(next.document.mainPath).toEqual(old.document.mainPath);
    expect(next.document.branches).toEqual(old.document.branches);
    for (const slot of ["ordinary-1", "ordinary-2", "ordinary-3", "ordinary-4", "boss"] as const) {
      expect(next.document.anchors.encounters[slot]).toEqual(old.document.anchors.encounters[slot]);
    }

    const bonus = next.document.anchors.encounters["bonus-1"]!;
    const boss = next.document.anchors.encounters.boss;
    const stage = next.course.platforms.find((piece) => piece.id === "rat-pit-stage")!;
    expect(bonus.position).toEqual({ x: 5.7, y: 3, z: -117.7 });
    expect(bonus.platformId).toBe(stage.id);
    expect(bonus.arena.minX).toBeGreaterThan(boss.arena.maxX);
    // Combat wakes each encounter beyond its drawn arena. Keep their actual
    // player activation envelopes apart so Golden and Rat never chase together.
    const xGap = Math.max(0, bonus.arena.minX - boss.arena.maxX);
    const zGap = Math.max(0, bonus.arena.minZ - boss.arena.maxZ);
    expect(Math.hypot(xGap, zGap)).toBeGreaterThan(
      enemyAttackRange("boss") + enemyAttackRange("ordinary"),
    );
    expect(bonus.arena.minX).toBeGreaterThan(stage.center.x - stage.size.x / 2);
    expect(bonus.arena.maxX).toBeLessThan(stage.center.x + stage.size.x / 2);
    expect(bonus.arena.minZ).toBeGreaterThan(stage.center.z - stage.size.z / 2);
    expect(bonus.arena.maxZ).toBeLessThan(stage.center.z + stage.size.z / 2);
    expect(current.chapters[2]!.encounterSlots["bonus-1"]).toMatchObject({
      source: "catalog",
      catalogEntryId: "golden-after-hours-rat",
      catalogEntryVersion: "v001",
    });
  });
});
