import type {
  Ability,
  EncounterKind,
  EncounterRole,
  FrozenEncounterContent,
} from './contracts.js';
import {
  PARODY_CATALOGS,
  PARODY_CATALOG_VERSION,
  type ObbyRouteId,
  type ParodyCatalogVersion,
  type ParodyCatalogEntry,
  type ParodyPeriodId,
} from './parody-catalog.js';

export interface SelectedParodyEncounter {
  role: EncounterRole;
  kind: EncounterKind;
  content: FrozenEncounterContent;
}

export interface ParodyLevelSelection {
  periodId: ParodyPeriodId;
  routeId: ObbyRouteId;
  encounters: [SelectedParodyEncounter, SelectedParodyEncounter, SelectedParodyEncounter];
}

export class ParodyCatalogUnavailableError extends Error {
  constructor() {
    super('Parody catalog has no complete compatible period');
    this.name = 'ParodyCatalogUnavailableError';
  }
}

const REQUIRED_SLOTS = [
  { kind: 'ordinary-a', role: 'ordinary' },
  { kind: 'ordinary-b', role: 'ordinary' },
  { kind: 'boss', role: 'boss' },
] as const satisfies readonly { kind: EncounterKind; role: EncounterRole }[];

/**
 * Selects one complete authored period for the level's frozen start date and
 * starting abilities. Ordering the identities makes selection independent of
 * catalog source order while leaving already-frozen plans untouched.
 */
export function selectParodyLevel(
  startDate: string,
  startingAbilities: readonly Ability[],
  catalogVersion: ParodyCatalogVersion = PARODY_CATALOG_VERSION,
  catalog: readonly ParodyCatalogEntry[] = PARODY_CATALOGS[catalogVersion],
): ParodyLevelSelection {
  const abilities = new Set(startingAbilities);
  const eligible = catalog.filter((entry) =>
    entry.eligibleFrom <= startDate &&
    startDate <= entry.eligibleThrough &&
    entry.referenceAvailableBy <= startDate &&
    entry.requiredAbilities.every((ability) => abilities.has(ability)),
  );
  const periodIds = [...new Set(eligible.map((entry) => entry.periodId))].sort();

  for (const periodId of periodIds) {
    const periodEntries = eligible.filter((entry) => entry.periodId === periodId);
    const selected = REQUIRED_SLOTS.map(({ kind, role }) =>
      periodEntries
        .filter((entry) => entry.kind === kind && entry.role === role)
        .toSorted(compareIdentity)[0],
    );
    if (selected.every((entry): entry is ParodyCatalogEntry => entry !== undefined)) {
      return {
        periodId,
        routeId: abilities.has('jump') ? 'gentle-jump-v1' : 'gentle-intro-v1',
        encounters: selected.map(freezeIdentity) as ParodyLevelSelection['encounters'],
      };
    }
  }

  throw new ParodyCatalogUnavailableError();
}

function compareIdentity(left: ParodyCatalogEntry, right: ParodyCatalogEntry): number {
  const leftKey = [left.id, left.version, left.assetId, left.assetVersion].join('\0');
  const rightKey = [right.id, right.version, right.assetId, right.assetVersion].join('\0');
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
}

function freezeIdentity(entry: ParodyCatalogEntry): SelectedParodyEncounter {
  return {
    role: entry.role,
    kind: entry.kind,
    content: {
      catalogEntryId: entry.id,
      catalogEntryVersion: entry.version,
      assetId: entry.assetId,
      assetVersion: entry.assetVersion,
    },
  };
}
