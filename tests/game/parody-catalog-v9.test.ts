/**
 * Frozen parody-catalog-v9 (DESIGN-026, World B v2): v8 with one change, the
 * Bickering Besties' parent-locked window. World B's final chapter starts on
 * the child's fourth birthday; for a six-year-old born late in 2019 that is
 * late 2023, before v8's 2024-01-01 window, so v9 reaches the window back to
 * the Besties' recorded reference date. Every other entry is v8's, and v1-v8
 * stay frozen. Only fictional dates appear here.
 */
import { describe, expect, it } from "vitest";
import {
  LEVEL_EDITOR_CATALOG_VERSIONS,
  levelEditorPreparedBonusEnemies,
  levelEditorPreparedEnemies,
} from "../../src/shared/editor-project";
import {
  BESTIES_PARENT_LOCK_FROM,
  PARODY_CATALOG_VERSIONS,
  PARODY_CATALOGS,
  type ParodyCatalogEntry,
} from "../../src/shared/parody-catalog";

const ids = (entries: readonly ParodyCatalogEntry[]) => entries.map((entry) => `${entry.id}@${entry.version}`);

describe("parody-catalog-v9", () => {
  const v8 = PARODY_CATALOGS["parody-catalog-v8"];
  const v9 = PARODY_CATALOGS["parody-catalog-v9"];

  it("is the newest catalog and an editor catalog", () => {
    expect(PARODY_CATALOG_VERSIONS.at(-1)).toBe("parody-catalog-v9");
    expect(LEVEL_EDITOR_CATALOG_VERSIONS.at(-1)).toBe("parody-catalog-v9");
  });

  it("is v8 with only the Besties' window widened to their reference date", () => {
    expect(Object.isFrozen(v9)).toBe(true);
    expect(ids(v9)).toEqual(ids(v8));
    v9.forEach((entry, index) => {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.requiredAbilities)).toBe(true);
      if (entry.id !== "bickering-besties") expect(entry).toEqual(v8[index]);
    });
    const before = v8.find((entry) => entry.id === "bickering-besties")!;
    const after = v9.find((entry) => entry.id === "bickering-besties")!;
    expect(before.eligibleFrom).toBe("2024-01-01");
    expect(before.relevanceLock).toBeUndefined();
    expect(BESTIES_PARENT_LOCK_FROM).toBe("2022-07-31");
    const { eligibleFrom, relevanceLock, ...rest } = after;
    const { eligibleFrom: _previous, ...beforeRest } = before;
    expect(rest).toEqual(beforeRest);
    expect(eligibleFrom).toBe(BESTIES_PARENT_LOCK_FROM);
    expect(eligibleFrom).toBe(after.referenceAvailableBy);
    expect(relevanceLock).toMatchObject({ lockedBy: "parent", previousEligibleFrom: "2024-01-01" });
    // The Rat Casino lock carries over; the Besties lock is the only new one.
    expect(v9.filter((entry) => entry.relevanceLock).map((entry) => entry.id).sort()).toEqual(
      [...v8.filter((entry) => entry.relevanceLock).map((entry) => entry.id), "bickering-besties"].sort(),
    );
  });

  it("prepares exactly v8's editor identities", () => {
    expect(ids(levelEditorPreparedEnemies("parody-catalog-v9"))).toEqual(
      ids(levelEditorPreparedEnemies("parody-catalog-v8")),
    );
    expect(ids(levelEditorPreparedBonusEnemies("parody-catalog-v9"))).toEqual(
      ids(levelEditorPreparedBonusEnemies("parody-catalog-v8")),
    );
  });
});
