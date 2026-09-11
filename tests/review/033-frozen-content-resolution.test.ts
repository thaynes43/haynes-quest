/**
 * WO-033 review regression (finding R-2). The scene resolves a frozen v2
 * encounter identity through `parodyArtwork`, which consults two hand-maintained
 * tables: `PARODY_CANDIDATES` (shared with the server) and the scene-only
 * `parodyMotion` map. The first case guards the two tables against drifting
 * apart. The second case reproduces the defect at eaa7eb3: an identity the
 * client bundle does not know (server newer than the loaded bundle, or a future
 * catalog version) throws from inside `GardenScene.rebuildRoute` and takes the
 * whole game down instead of degrading to a recoverable missing-asset state as
 * DESIGN-005 D-10 requires. Flip `it.fails` to `it` once unknown content degrades.
 */
import { describe, expect, it } from "vitest";
import { eraStory } from "../../src/client/era";
import { parodyArtwork } from "../../src/game/scene-catalog";
import { PARODY_CANDIDATES } from "../../src/shared/parody-catalog";
import type { ActiveLevelView } from "../../src/shared/contracts";

describe("frozen parody content resolution", () => {
  it("resolves every catalog identity to a versioned asset URL, a height and a contact fraction", () => {
    for (const entry of PARODY_CANDIDATES) {
      const artwork = parodyArtwork({
        catalogEntryId: entry.id,
        catalogEntryVersion: entry.version,
        assetId: entry.assetId,
        assetVersion: entry.assetVersion,
      });
      expect(artwork.id).toBe(entry.assetId);
      expect(artwork.url).toBe(
        `/studio/assets/media/${entry.assetId}/${entry.assetVersion}/${entry.assetId}.glb`,
      );
      expect(artwork.height).toBeGreaterThan(0);
      expect(artwork.contactFraction).toBeGreaterThan(0);
      expect(artwork.contactFraction).toBeLessThan(1);
    }
  });

  it("names every catalog identity by its frozen title in the chapter story", () => {
    for (const periodId of ["block-party-v1", "remix-runway-v1"] as const) {
      const entries = PARODY_CANDIDATES.filter((entry) => entry.periodId === periodId);
      const level = {
        periodId,
        encounters: entries.map((entry, index) => ({
          id: `encounter-${index}`,
          role: entry.role,
          kind: entry.kind,
          maxHp: 1,
          hp: 1,
          attackDamage: 1,
          defeated: false,
          content: {
            catalogEntryId: entry.id,
            catalogEntryVersion: entry.version,
            assetId: entry.assetId,
            assetVersion: entry.assetVersion,
          },
        })),
      } as unknown as ActiveLevelView;
      const story = eraStory(2021, level);
      for (const entry of entries) expect(story.enemies[entry.kind]).toBe(entry.title);
    }
  });

  it.fails("degrades an identity this bundle does not know instead of throwing", () => {
    expect(() =>
      parodyArtwork({
        catalogEntryId: "mister-hiss",
        catalogEntryVersion: "v002",
        assetId: "mister-hiss",
        assetVersion: "v002",
      }),
    ).not.toThrow();
  });
});
