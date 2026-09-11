/**
 * WO-033 review regression (finding R-2). The scene resolves a frozen v2
 * encounter identity through `parodyArtwork`, which consults two hand-maintained
 * tables: `PARODY_CANDIDATES` (shared with the server) and the scene-only
 * `parodyMotion` map. The first cases guard the two tables against drifting
 * apart. Unknown exact identities must never resolve a different asset or an
 * arbitrary URL; the scene counts them as a blocking reload state.
 */
import { describe, expect, it } from "vitest";
import { eraStory } from "../../src/client/era";
import { GardenScene } from "../../src/game/scene";
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
      expect(artwork).not.toBeNull();
      if (!artwork) throw new Error(`Missing artwork for ${entry.id}`);
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

  it("returns no artwork for an identity this bundle does not know", () => {
    expect(
      parodyArtwork({
        catalogEntryId: "mister-hiss",
        catalogEntryVersion: "v002",
        assetId: "mister-hiss",
        assetVersion: "v002",
      }),
    ).toBeNull();
  });

  it("does not substitute an asset when any frozen identity field differs", () => {
    const content = {
      catalogEntryId: "mister-hiss",
      catalogEntryVersion: "v001",
      assetId: "mister-hiss",
      assetVersion: "v001",
    } as const;
    expect(parodyArtwork({ ...content, catalogEntryVersion: "v002" })).toBeNull();
    expect(parodyArtwork({ ...content, assetId: "untrusted-model" })).toBeNull();
    expect(parodyArtwork({ ...content, assetVersion: "v002" })).toBeNull();
  });

  it("counts unsupported content as a blocking media failure", () => {
    const scene = Object.create(GardenScene.prototype) as GardenScene;
    Object.assign(scene as unknown as Record<string, unknown>, {
      assets: { getState: () => ({ loading: 2, failed: 1 }) },
      photos: new Map([
        ["loading", { loading: true, timer: undefined, failed: false }],
        ["failed", { loading: false, timer: undefined, failed: true }],
      ]),
      unsupportedContentCount: 2,
    });

    expect(scene.getMediaState()).toEqual({
      loading: 3,
      failed: 4,
      reloadRequired: true,
    });

    Object.assign(scene as unknown as Record<string, unknown>, {
      unsupportedContentCount: 0,
    });
    expect(scene.getMediaState()).toEqual({
      loading: 3,
      failed: 2,
      reloadRequired: false,
    });
  });
});
