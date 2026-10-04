import { describe, expect, it } from "vitest";
import {
  BESTIES_PARENT_LOCK_FROM,
  PARODY_CATALOGS,
  PARODY_CATALOG_VERSIONS,
} from "../../src/shared/parody-catalog";
import {
  LEVEL_EDITOR_CATALOG_VERSIONS,
  levelEditorPreparedEnemies,
} from "../../src/shared/editor-project";
import { parodyArtwork } from "../../src/game/scene-catalog";

const additions = [
  ["gadget-hammer-hopper", "toon-clubhouse-v1", "ordinary-a", "2006-05-05"],
  ["mischief-kitten-skater", "rescue-harbor-v1", "ordinary-a", "2013-08-12"],
  ["lab-robot-sentry", "hero-city-v1", "ordinary-b", "2018-12-14"],
  ["broccoli-bouncer", "sing-along-playroom-v1", "ordinary-a", "2018-01-01"],
  ["bin-chicken-flower-thief", "magic-house-v1", "ordinary-a", "2019-09-01"],
  ["demon-idol-drummer", "besties-obby-v1", "ordinary-a", BESTIES_PARENT_LOCK_FROM],
] as const;

const deliveredHeights = {
  "gadget-hammer-hopper": 1.5414782316099696,
  "broccoli-bouncer": 1.527886152267456,
  "bin-chicken-flower-thief": 1.4803972244262695,
  "demon-idol-drummer": 1.5699700117111206,
} as const;

describe("parody-catalog-v12", () => {
  const v11 = PARODY_CATALOGS["parody-catalog-v11"];
  const v12 = PARODY_CATALOGS["parody-catalog-v12"];

  it("preserves every older identity and makes six chapter variants available only in v12", () => {
    expect(PARODY_CATALOG_VERSIONS.at(-1)).toBe("parody-catalog-v12");
    expect(LEVEL_EDITOR_CATALOG_VERSIONS.at(-1)).toBe("parody-catalog-v12");
    expect(Object.isFrozen(v12)).toBe(true);
    expect(v12.slice(0, v11.length)).toEqual(v11);
    for (const [index, old] of v11.entries()) expect(v12[index]).toBe(old);

    const fresh = v12.slice(v11.length);
    expect(fresh.map(({ id, periodId, kind, eligibleFrom }) => [
      id, periodId, kind, eligibleFrom,
    ])).toEqual(additions);
    for (const entry of fresh) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.requiredAbilities)).toBe(true);
      expect(entry).toMatchObject({
        version: "v001",
        role: "ordinary",
        assetId: entry.id,
        assetVersion: "v001",
        referenceAvailableBy: entry.eligibleFrom,
        requiredAbilities: ["move"],
      });
      expect(v11.some((old) => old.id === entry.id)).toBe(false);
    }
  });

  it("prepares only inspected v001 variants and resolves their measured artwork contracts", () => {
    const fresh = v12.slice(v11.length);
    const prepared = levelEditorPreparedEnemies("parody-catalog-v12");
    for (const entry of fresh) {
      const content = {
        catalogEntryId: entry.id,
        catalogEntryVersion: entry.version,
        assetId: entry.assetId,
        assetVersion: entry.assetVersion,
      };
      if (entry.id in deliveredHeights) {
        const height = deliveredHeights[entry.id as keyof typeof deliveredHeights];
        expect(prepared).toContain(entry);
        expect(parodyArtwork(content)).toEqual({
          id: entry.id,
          kind: "single",
          contactFraction: 0.625,
          height,
          url: `/studio/assets/media/${entry.id}/v001/${entry.id}.glb`,
        });
      } else {
        expect(prepared).not.toContain(entry);
        expect(parodyArtwork(content)).toBeNull();
      }
      expect(parodyArtwork({ ...content, assetVersion: "v002" })).toBeNull();
    }
    expect(levelEditorPreparedEnemies("parody-catalog-v11")).toEqual(v11.filter((entry) => prepared.includes(entry)));
  });
});
