import { describe, expect, it } from "vitest";
import {
  BESTIES_PARENT_LOCK_FROM,
  PARODY_CATALOGS,
  PARODY_CATALOG_VERSIONS,
} from "../../src/shared/parody-catalog";
import { LEVEL_EDITOR_CATALOG_VERSIONS } from "../../src/shared/editor-project";

const additions = [
  ["gadget-hammer-hopper", "toon-clubhouse-v1", "ordinary-a", "2006-05-05"],
  ["mischief-kitten-skater", "rescue-harbor-v1", "ordinary-a", "2013-08-12"],
  ["lab-robot-sentry", "hero-city-v1", "ordinary-b", "2018-12-14"],
  ["broccoli-bouncer", "sing-along-playroom-v1", "ordinary-a", "2018-01-01"],
  ["bin-chicken-flower-thief", "magic-house-v1", "ordinary-a", "2019-09-01"],
  ["demon-idol-drummer", "besties-obby-v1", "ordinary-a", BESTIES_PARENT_LOCK_FROM],
] as const;

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
});
