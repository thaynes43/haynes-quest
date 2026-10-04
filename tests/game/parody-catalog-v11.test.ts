import { describe, expect, it } from "vitest";
import { levelEditorPreparedBonusEnemies, levelEditorPreparedEnemies, LEVEL_EDITOR_CATALOG_VERSIONS } from "../../src/shared/editor-project";
import { PARODY_CATALOGS, PARODY_CATALOG_VERSIONS } from "../../src/shared/parody-catalog";

const EXPECTED = [
  ["inator-monster", "The Monster-inator", "boss", "boss", "hero-city-v1", "2018-12-14"],
  ["demon-band-idol", "Demon Idol", "ordinary", "ordinary-a", "besties-obby-v1", "2022-07-31"],
  ["putty-grunt", "Putty Grunt", "ordinary", "ordinary-a", "hero-city-v1", "2018-12-14"],
  ["radio-host-showman", "The Radio Showman", "ordinary", "ordinary-a", "rat-casino-v1", "2019-10-28"],
  ["lab-robot", "Lab Robot", "ordinary", "ordinary-b", "hero-city-v1", "2018-12-14"],
] as const;

describe("parody-catalog-v11", () => {
  const v10 = PARODY_CATALOGS["parody-catalog-v10"];
  const v11 = PARODY_CATALOGS["parody-catalog-v11"];

  it("appends the five merged v001 identities without changing v10", () => {
    expect(PARODY_CATALOG_VERSIONS).toContain("parody-catalog-v11");
    expect(LEVEL_EDITOR_CATALOG_VERSIONS).toContain("parody-catalog-v11");
    expect(Object.isFrozen(v11)).toBe(true);
    expect(v11.slice(0, v10.length)).toEqual(v10);
    expect(v11.slice(v10.length).map((entry) => [entry.id, entry.title, entry.role, entry.kind, entry.periodId, entry.eligibleFrom])).toEqual(EXPECTED);
    for (const entry of v11.slice(v10.length)) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(entry).toMatchObject({
        version: "v001", assetId: entry.id, assetVersion: "v001",
        eligibleThrough: "2026-12-31", referenceAvailableBy: entry.eligibleFrom,
        requiredAbilities: ["move"],
      });
      expect(v10.some((old) => old.id === entry.id)).toBe(false);
    }
  });

  it("prepares all five for their combat slots and ordinary models for bonus fights", () => {
    const newIds = EXPECTED.map(([id]) => id);
    expect(levelEditorPreparedEnemies("parody-catalog-v11").slice(-5).map((entry) => entry.id)).toEqual(newIds);
    expect(levelEditorPreparedBonusEnemies("parody-catalog-v11").map((entry) => entry.id)).toEqual(expect.arrayContaining([
      "putty-grunt", "demon-band-idol", "radio-host-showman", "lab-robot",
    ]));
    expect(levelEditorPreparedBonusEnemies("parody-catalog-v11").map((entry) => entry.id)).not.toContain("inator-monster");
    for (const id of newIds) expect(levelEditorPreparedEnemies("parody-catalog-v10").some((entry) => entry.id === id)).toBe(false);
  });
});
