import type { Ability, EncounterKind, EncounterRole } from "./contracts.js";

/** Lead-authored candidates. Versioned selection is separate from gameplay approval. */
export const PARODY_CATALOG_VERSIONS = [
  "parody-catalog-v1",
  "parody-catalog-v2",
  "parody-catalog-v3",
] as const;
export type ParodyCatalogVersion = (typeof PARODY_CATALOG_VERSIONS)[number];
export const PARODY_CATALOG_VERSION = "parody-catalog-v3" as const;
export type ParodyPeriodId =
  "block-party-v1" | "remix-runway-v1" | "remix-runway-v2" | "besties-obby-v1";
export type ObbyRouteId = "gentle-intro-v1" | "gentle-jump-v1";
export interface ParodyCatalogEntry {
  readonly id: string;
  readonly version: "v001";
  readonly title: string;
  readonly reference: string;
  readonly role: EncounterRole;
  readonly kind: EncounterKind;
  readonly periodId: ParodyPeriodId;
  readonly eligibleFrom: string;
  readonly eligibleThrough: string;
  readonly referenceAvailableBy: string;
  readonly requiredAbilities: readonly Ability[];
  readonly assetId: string;
  readonly assetVersion: "v001";
}

export const PARODY_PERIODS = {
  "block-party-v1": {
    title: "The Block Party",
    subtitle: "Party poppers, slippery peels and a very dramatic dragon",
    description:
      "Find your gear, weave past the party games and face the guests causing all the trouble.",
  },
  "remix-runway-v1": {
    title: "The Remix Runway",
    subtitle: "Big entrances, sleepy pranks and one very fussy judge",
    description:
      "Hop between the stages, dodge the silly stunts and take back the spotlight.",
  },
  "remix-runway-v2": {
    title: "The Remix Runway",
    subtitle: "Bubble notes, slippery stunts and a dragon encore",
    description:
      "Hop between the stages, dodge the silly stunts and face the returning party guests.",
  },
  "besties-obby-v1": {
    title: "Besties Obby",
    subtitle: "Pink, black and one missed high-five",
    description:
      "Two rivals take turns building obstacle tricks. Their missed high-five leaves them dizzy.",
  },
} as const;

/** Immutable first catalog: existing saves retain these exact identities and rules. */
const PARODY_CANDIDATES_V1: readonly ParodyCatalogEntry[] = [
  {
    id: "mister-hiss",
    version: "v001",
    title: "Mister Hiss",
    reference: "Minecraft Creeper",
    role: "ordinary",
    kind: "ordinary-a",
    periodId: "block-party-v1",
    eligibleFrom: "2020-01-01",
    eligibleThrough: "2023-12-31",
    referenceAvailableBy: "2017-05-15",
    requiredAbilities: ["move"],
    assetId: "mister-hiss",
    assetVersion: "v001",
  },
  {
    id: "peel-patrol",
    version: "v001",
    title: "Peel Patrol",
    reference: "Fortnite Peely",
    role: "ordinary",
    kind: "ordinary-b",
    periodId: "block-party-v1",
    eligibleFrom: "2020-01-01",
    eligibleThrough: "2023-12-31",
    referenceAvailableBy: "2019-02-28",
    requiredAbilities: ["move"],
    assetId: "peel-patrol",
    assetVersion: "v001",
  },
  {
    id: "drama-dragon",
    version: "v001",
    title: "The Drama Dragon",
    reference: "Minecraft Ender Dragon",
    role: "boss",
    kind: "boss",
    periodId: "block-party-v1",
    eligibleFrom: "2020-01-01",
    eligibleThrough: "2023-12-31",
    referenceAvailableBy: "2011-11-18",
    requiredAbilities: ["move"],
    assetId: "drama-dragon",
    assetVersion: "v001",
  },
  {
    id: "sir-flush-a-lot",
    version: "v001",
    title: "Sir Flush-a-Lot",
    reference: "Skibidi Toilet",
    role: "ordinary",
    kind: "ordinary-a",
    periodId: "remix-runway-v1",
    eligibleFrom: "2024-01-01",
    eligibleThrough: "2026-12-31",
    referenceAvailableBy: "2023-02-07",
    requiredAbilities: ["move"],
    assetId: "sir-flush-a-lot",
    assetVersion: "v001",
  },
  {
    id: "nap-captain",
    version: "v001",
    title: "Nap Captain",
    reference: "Poppy Playtime CatNap / Smiling Critters",
    role: "ordinary",
    kind: "ordinary-b",
    periodId: "remix-runway-v1",
    eligibleFrom: "2024-01-01",
    eligibleThrough: "2026-12-31",
    referenceAvailableBy: "2023-11-11",
    requiredAbilities: ["move"],
    assetId: "nap-captain",
    assetVersion: "v001",
  },
  {
    id: "one-star-diva",
    version: "v001",
    title: "The One-Star Diva",
    reference: "Roblox Dress to Impress",
    role: "boss",
    kind: "boss",
    periodId: "remix-runway-v1",
    eligibleFrom: "2024-01-01",
    eligibleThrough: "2026-12-31",
    referenceAvailableBy: "2023-12-22",
    requiredAbilities: ["move"],
    assetId: "one-star-diva",
    assetVersion: "v001",
  },
];

/** A complete playtest cast, reusing finished characters for the encore chapter. */
const PARODY_CANDIDATES_V2: readonly ParodyCatalogEntry[] = [
  ...PARODY_CANDIDATES_V1.filter(
    (entry) => entry.periodId === "block-party-v1",
  ),
  ...[
    { sourceId: "sir-flush-a-lot", id: "sir-flush-a-lot-encore" },
    { sourceId: "peel-patrol", id: "peel-patrol-encore" },
    { sourceId: "drama-dragon", id: "drama-dragon-encore" },
  ].map(({ sourceId, id }): ParodyCatalogEntry => {
    const source = PARODY_CANDIDATES_V1.find((entry) => entry.id === sourceId);
    if (!source) throw new Error("Playtest catalog source is missing");
    return {
      ...source,
      id,
      periodId: "remix-runway-v2",
      eligibleFrom: "2024-01-01",
      eligibleThrough: "2026-12-31",
    };
  }),
];

/** New journeys retain the authored cast and replace only chapter two's boss. */
function freezeV3Entry(entry: ParodyCatalogEntry): ParodyCatalogEntry {
  return Object.freeze({
    ...entry,
    requiredAbilities: Object.freeze([...entry.requiredAbilities]),
  });
}

const PARODY_CANDIDATES_V3: readonly ParodyCatalogEntry[] = Object.freeze([
  ...PARODY_CANDIDATES_V2.map(freezeV3Entry),
  ...PARODY_CANDIDATES_V2.filter(
    (entry) =>
      entry.periodId === "remix-runway-v2" && entry.role === "ordinary",
  ).map((entry) =>
    freezeV3Entry({
      ...entry,
      id:
        entry.kind === "ordinary-a"
          ? "sir-flush-a-lot-besties"
          : "peel-patrol-besties",
      periodId: "besties-obby-v1" as const,
    }),
  ),
  freezeV3Entry({
    id: "bickering-besties",
    version: "v001",
    title: "The Bickering Besties",
    reference: "Mackenzie Turner and Lael Roblox personas",
    role: "boss",
    kind: "boss",
    periodId: "besties-obby-v1",
    eligibleFrom: "2024-01-01",
    eligibleThrough: "2026-12-31",
    referenceAvailableBy: "2022-07-31",
    requiredAbilities: ["move", "jump"],
    assetId: "bickering-besties",
    assetVersion: "v001",
  }),
]);

export const PARODY_CATALOGS: Readonly<
  Record<ParodyCatalogVersion, readonly ParodyCatalogEntry[]>
> = {
  "parody-catalog-v1": PARODY_CANDIDATES_V1,
  "parody-catalog-v2": PARODY_CANDIDATES_V2,
  "parody-catalog-v3": PARODY_CANDIDATES_V3,
};
export const PARODY_CANDIDATES = PARODY_CATALOGS[PARODY_CATALOG_VERSION];
export const ALL_PARODY_CANDIDATES = Object.values(PARODY_CATALOGS).flat();
