import type { Ability, EncounterKind, EncounterRole } from './contracts.js';

/** Lead-authored candidates. Versioned selection is separate from gameplay approval. */
export const PARODY_CATALOG_VERSION = 'parody-catalog-v1' as const;
export type ParodyPeriodId = 'block-party-v1' | 'remix-runway-v1';
export type ObbyRouteId = 'gentle-intro-v1' | 'gentle-jump-v1';
export interface ParodyCatalogEntry {
  readonly id: string;
  readonly version: 'v001';
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
  readonly assetVersion: 'v001';
}

export const PARODY_PERIODS = {
  'block-party-v1': {
    title: 'The Block Party',
    subtitle: 'Party poppers, slippery peels and a very dramatic dragon',
    description: 'Find your gear, weave past the party games and face the guests causing all the trouble.',
  },
  'remix-runway-v1': {
    title: 'The Remix Runway',
    subtitle: 'Big entrances, sleepy pranks and one very fussy judge',
    description: 'Hop between the stages, dodge the silly stunts and take back the spotlight.',
  },
} as const;

export const PARODY_CANDIDATES: readonly ParodyCatalogEntry[] = [
  { id: 'mister-hiss', version: 'v001', title: 'Mister Hiss', reference: 'Minecraft Creeper', role: 'ordinary', kind: 'ordinary-a', periodId: 'block-party-v1', eligibleFrom: '2020-01-01', eligibleThrough: '2023-12-31', referenceAvailableBy: '2017-05-15', requiredAbilities: ['move'], assetId: 'mister-hiss', assetVersion: 'v001' },
  { id: 'peel-patrol', version: 'v001', title: 'Peel Patrol', reference: 'Fortnite Peely', role: 'ordinary', kind: 'ordinary-b', periodId: 'block-party-v1', eligibleFrom: '2020-01-01', eligibleThrough: '2023-12-31', referenceAvailableBy: '2019-02-28', requiredAbilities: ['move'], assetId: 'peel-patrol', assetVersion: 'v001' },
  { id: 'drama-dragon', version: 'v001', title: 'The Drama Dragon', reference: 'Minecraft Ender Dragon', role: 'boss', kind: 'boss', periodId: 'block-party-v1', eligibleFrom: '2020-01-01', eligibleThrough: '2023-12-31', referenceAvailableBy: '2011-11-18', requiredAbilities: ['move'], assetId: 'drama-dragon', assetVersion: 'v001' },
  { id: 'sir-flush-a-lot', version: 'v001', title: 'Sir Flush-a-Lot', reference: 'Skibidi Toilet', role: 'ordinary', kind: 'ordinary-a', periodId: 'remix-runway-v1', eligibleFrom: '2024-01-01', eligibleThrough: '2026-12-31', referenceAvailableBy: '2023-02-07', requiredAbilities: ['move'], assetId: 'sir-flush-a-lot', assetVersion: 'v001' },
  { id: 'nap-captain', version: 'v001', title: 'Nap Captain', reference: 'Poppy Playtime CatNap / Smiling Critters', role: 'ordinary', kind: 'ordinary-b', periodId: 'remix-runway-v1', eligibleFrom: '2024-01-01', eligibleThrough: '2026-12-31', referenceAvailableBy: '2023-11-11', requiredAbilities: ['move'], assetId: 'nap-captain', assetVersion: 'v001' },
  { id: 'one-star-diva', version: 'v001', title: 'The One-Star Diva', reference: 'Roblox Dress to Impress', role: 'boss', kind: 'boss', periodId: 'remix-runway-v1', eligibleFrom: '2024-01-01', eligibleThrough: '2026-12-31', referenceAvailableBy: '2023-12-22', requiredAbilities: ['move'], assetId: 'one-star-diva', assetVersion: 'v001' },
];
