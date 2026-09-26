import type { Ability, EncounterKind, EncounterRole } from "./contracts.js";

/** Lead-authored candidates. Versioned selection is separate from gameplay approval. */
export const PARODY_CATALOG_VERSIONS = [
  "parody-catalog-v1",
  "parody-catalog-v2",
  "parody-catalog-v3",
  "parody-catalog-v4",
  "parody-catalog-v5",
  "parody-catalog-v6",
  "parody-catalog-v7",
] as const;
export type ParodyCatalogVersion = (typeof PARODY_CATALOG_VERSIONS)[number];
export const PARODY_CATALOG_VERSION = "parody-catalog-v5" as const;
export type ParodyPeriodId =
  | "block-party-v1"
  | "remix-runway-v1"
  | "remix-runway-v2"
  | "besties-obby-v1"
  | "rat-casino-v1"
  | "toon-clubhouse-v1"
  | "rescue-harbor-v1"
  | "hero-city-v1"
  | "sing-along-playroom-v1"
  | "magic-house-v1";
/**
 * Family-world era periods (DESIGN-026). Their casts are project enemy
 * candidates with neutral placeholder art until the WO111 models land; no
 * frozen catalog version lists an entry in them yet.
 */
export const FAMILY_ERA_PERIOD_IDS = [
  "toon-clubhouse-v1",
  "rescue-harbor-v1",
  "hero-city-v1",
  "sing-along-playroom-v1",
  "magic-house-v1",
] as const satisfies readonly ParodyPeriodId[];
export type ObbyRouteId =
  | "gentle-intro-v1"
  | "gentle-jump-v1"
  | "garden-playground-v1"
  | "besties-playground-v1"
  | "garden-playground-v2"
  | "besties-playground-v2";
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
  readonly assetVersion: "v001" | "v002";
  /**
   * A parent-locked relevance window (DESIGN-012, DESIGN-026 "Eligibility"):
   * the frozen reason `eligibleFrom` differs from the entry's earlier catalog
   * window. Present only on entries a later catalog widened.
   */
  readonly relevanceLock?: ParodyRelevanceLock;
}

export interface ParodyRelevanceLock {
  readonly lockedBy: "parent";
  /** The window start in the catalog version this entry was copied from. */
  readonly previousEligibleFrom: string;
  readonly reason: string;
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
  "rat-casino-v1": {
    title: "Rat Casino",
    subtitle: "Worn mascots, old tokens and an after-hours pit boss",
    description:
      "Cross the quiet casino floor, outlast its supporting cast and face the Rat Pit Boss.",
  },
  "toon-clubhouse-v1": {
    title: "Clubhouse Capers",
    subtitle: "Runaway gadgets and a very grumpy cat captain",
    description:
      "Climb the toon clubhouse, round up the runaway gadgets and stand up to the bully on the tower deck.",
  },
  "rescue-harbor-v1": {
    title: "Harbor Rescue",
    subtitle: "Mischief kittens and a mayor with a plan",
    description:
      "Ride the boats, hop the rooftops and climb the lookout to stop the rival mayor.",
  },
  "hero-city-v1": {
    title: "Hero City",
    subtitle: "Putty grunts, runaway robots and a monster-inator",
    description:
      "Leap across the rooftops, bounce off the vents and take down the scientist's giant monster.",
  },
  "sing-along-playroom-v1": {
    title: "Sing-Along Playroom",
    subtitle: "Stubborn veggies and a honking bus",
    description:
      "Climb the block towers of the playroom and cheer up the grumpy bus on the toy shelf.",
  },
  "magic-house-v1": {
    title: "The Magic House",
    subtitle: "Cheeky bin chickens and a house that won't stop dancing",
    description:
      "Climb the garden terraces and calm the dancing house at the top.",
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

/**
 * New playground journeys reuse the reviewed v3 cast and assets. The new
 * catalog identity freezes the expanded encounter-selection contract without
 * changing any archived v3 entry in place.
 */
const PARODY_CANDIDATES_V4: readonly ParodyCatalogEntry[] = Object.freeze(
  PARODY_CANDIDATES_V3.map(freezeV3Entry),
);

/** V5 freezes the safe-practice routes; it reuses the same candidate artwork. */
const PARODY_CANDIDATES_V5: readonly ParodyCatalogEntry[] = Object.freeze(
  PARODY_CANDIDATES_V4.map(freezeV3Entry),
);

/**
 * V6 preserves every v5 identity and adds the exact Rat Casino studio cast.
 * Golden After-Hours Rat is intentionally retained as a reserved cameo: it is
 * catalog-addressable and renderable, but the editor's prepared encounter
 * allowlist does not assign it to one of the five combat slots.
 */
const PARODY_CANDIDATES_V6: readonly ParodyCatalogEntry[] = Object.freeze([
  ...PARODY_CANDIDATES_V5.map(freezeV3Entry),
  freezeV3Entry({
    id: "chick-flia",
    version: "v001",
    title: "Chick-flia",
    reference: "Classic worn family-venue hen animatronic parody",
    role: "ordinary",
    kind: "ordinary-a",
    periodId: "rat-casino-v1",
    eligibleFrom: "2024-01-01",
    eligibleThrough: "2026-12-31",
    referenceAvailableBy: "2014-08-18",
    requiredAbilities: ["move"],
    assetId: "chick-flia",
    assetVersion: "v001",
  }),
  freezeV3Entry({
    id: "jackrabbit-drummer",
    version: "v001",
    title: "Jackrabbit Drummer",
    reference: "Classic worn family-venue rabbit animatronic parody",
    role: "ordinary",
    kind: "ordinary-b",
    periodId: "rat-casino-v1",
    eligibleFrom: "2024-01-01",
    eligibleThrough: "2026-12-31",
    referenceAvailableBy: "2014-08-18",
    requiredAbilities: ["move"],
    assetId: "jackrabbit-drummer",
    assetVersion: "v001",
  }),
  freezeV3Entry({
    id: "fox-card-shark",
    version: "v001",
    title: "Fox Card Shark",
    reference: "Classic worn family-venue fox animatronic parody",
    role: "ordinary",
    kind: "ordinary-a",
    periodId: "rat-casino-v1",
    eligibleFrom: "2024-01-01",
    eligibleThrough: "2026-12-31",
    referenceAvailableBy: "2014-08-18",
    requiredAbilities: ["move"],
    assetId: "fox-card-shark",
    assetVersion: "v001",
  }),
  freezeV3Entry({
    id: "moth-projectionist",
    version: "v001",
    title: "Moth Projectionist",
    reference: "Classic worn family-venue moth animatronic parody",
    role: "ordinary",
    kind: "ordinary-b",
    periodId: "rat-casino-v1",
    eligibleFrom: "2024-01-01",
    eligibleThrough: "2026-12-31",
    referenceAvailableBy: "2014-08-18",
    requiredAbilities: ["move"],
    assetId: "moth-projectionist",
    assetVersion: "v001",
  }),
  freezeV3Entry({
    id: "rat-pit-boss",
    version: "v001",
    title: "Rat Pit Boss",
    reference: "Classic worn family-venue lead rat animatronic parody",
    role: "boss",
    kind: "boss",
    periodId: "rat-casino-v1",
    eligibleFrom: "2024-01-01",
    eligibleThrough: "2026-12-31",
    referenceAvailableBy: "2014-08-18",
    requiredAbilities: ["move"],
    assetId: "rat-pit-boss",
    assetVersion: "v002",
  }),
  freezeV3Entry({
    id: "golden-after-hours-rat",
    version: "v001",
    title: "Golden After-Hours Rat",
    reference: "Classic worn family-venue spare rat animatronic parody",
    role: "ordinary",
    kind: "ordinary-a",
    periodId: "rat-casino-v1",
    eligibleFrom: "2024-01-01",
    eligibleThrough: "2026-12-31",
    referenceAvailableBy: "2014-08-18",
    requiredAbilities: ["move"],
    assetId: "golden-after-hours-rat",
    assetVersion: "v001",
  }),
]);

/**
 * V7 keeps every v6 identity and widens only the Rat Casino entries' window
 * back to the franchise debut already recorded as `referenceAvailableBy`
 * (2014-08-18). That is DESIGN-026's recorded parent lock: the older child's
 * final family chapter spans the debut. Every other field is unchanged, and
 * v1–v6 stay frozen.
 */
const RAT_CASINO_PARENT_LOCK_FROM = "2014-08-18";
const PARODY_CANDIDATES_V7: readonly ParodyCatalogEntry[] = Object.freeze(
  PARODY_CANDIDATES_V6.map((entry) =>
    entry.periodId === "rat-casino-v1"
      ? Object.freeze({
          ...freezeV3Entry(entry),
          eligibleFrom: RAT_CASINO_PARENT_LOCK_FROM,
          relevanceLock: Object.freeze({
            lockedBy: "parent" as const,
            previousEligibleFrom: entry.eligibleFrom,
            reason:
              "DESIGN-026: the family release's final Rat Casino chapter may start before 2024; the window reaches back to the franchise debut",
          }),
        })
      : freezeV3Entry(entry),
  ),
);

export const PARODY_CATALOGS: Readonly<
  Record<ParodyCatalogVersion, readonly ParodyCatalogEntry[]>
> = {
  "parody-catalog-v1": PARODY_CANDIDATES_V1,
  "parody-catalog-v2": PARODY_CANDIDATES_V2,
  "parody-catalog-v3": PARODY_CANDIDATES_V3,
  "parody-catalog-v4": PARODY_CANDIDATES_V4,
  "parody-catalog-v5": PARODY_CANDIDATES_V5,
  "parody-catalog-v6": PARODY_CANDIDATES_V6,
  "parody-catalog-v7": PARODY_CANDIDATES_V7,
};
export const PARODY_CANDIDATES = PARODY_CATALOGS[PARODY_CATALOG_VERSION];
export const ALL_PARODY_CANDIDATES = Object.values(PARODY_CATALOGS).flat();
