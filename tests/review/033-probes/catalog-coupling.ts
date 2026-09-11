// WO-033 probe R-4: a stored v2 plan must still match the LIVE catalog table on every read.
import { createAdventurePlan, createInitialAdventureState } from "../../../src/shared/adventure";
import { parseStoredAdventure } from "../../../src/server/adventure-schema";

function plan() {
  return createAdventurePlan("2020-01-01", [
    { id: "zero", date: "2020-07-01", ageYears: 0 },
    { id: "four", date: "2024-01-01", ageYears: 4 },
  ]);
}

function outcome(label: string, storedPlan: unknown): void {
  try {
    parseStoredAdventure(storedPlan, createInitialAdventureState(plan()));
    console.log(`OK    ${label}`);
  } catch (error) {
    const failure = error as { status?: number; code?: string };
    console.log(`503?  ${label} -> ${failure.status} ${failure.code}`);
  }
}

outcome("plan exactly as created", plan());

// Equivalent to the live entry moving from assetVersion v001 to v002 after this save was frozen.
const movedAsset = plan();
(movedAsset.levels[0]!.encounters[0]!.content as { assetVersion: string }).assetVersion = "v000-was-live-when-frozen";
outcome("frozen assetVersion no longer equals the live entry's assetVersion", movedAsset);

// Equivalent to renaming or retiring the entry id in the live table.
const retired = plan();
(retired.levels[0]!.encounters[0]!.content as { catalogEntryId: string }).catalogEntryId = "mister-hiss-was-live-when-frozen";
outcome("frozen catalogEntryId no longer present in the live table", retired);

// Equivalent to bumping PARODY_CATALOG_VERSION: every save frozen under the old constant.
const olderCatalog = plan() as unknown as { catalogVersion: string };
olderCatalog.catalogVersion = "parody-catalog-v0";
outcome("frozen catalogVersion differs from the live constant", olderCatalog);
