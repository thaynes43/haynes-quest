import {
  ATTACK_COOLDOWN_MS,
  ROUTE_ATTACK_COOLDOWN_MS,
  AdventureRuleError,
  boundedRemainingMs,
  usesRouteMemoryRules,
  type AdventurePlan,
  type AdventureState,
} from './adventure.js';
import type { FriendlyView, GameplayAction } from './contracts.js';

export const FRIENDLY_CATALOG_VERSIONS = ['friendly-catalog-v1'] as const;
export type FriendlyCatalogVersion = (typeof FRIENDLY_CATALOG_VERSIONS)[number];
export const FRIENDLY_CATALOG_VERSION = 'friendly-catalog-v1' as const;
export const FRIENDLY_STATE_VERSION = 'friendly-state-v1' as const;
export const FRIENDLY_MAX_HP = 4;
export const FRIENDLY_HEAL_HP = 2;
export const FRIENDLY_HARM_PENALTY_HP = 2;

export interface FriendlyCatalogEntry {
  readonly id: string;
  readonly version: 'v001';
  readonly title: string;
  readonly assetId: string;
  readonly assetVersion: 'v001';
  readonly chapterGroup: 0 | 1;
  readonly maxHp: number;
}

/** Immutable identities for the six owner-selected friendly residents. */
export const FRIENDLY_CATALOG_V1 = [
  {
    id: 'blockling',
    version: 'v001',
    title: 'Blockling',
    assetId: 'blockling',
    assetVersion: 'v001',
    chapterGroup: 0,
    maxHp: FRIENDLY_MAX_HP,
  },
  {
    id: 'signal-moth',
    version: 'v001',
    title: 'Signal Moth',
    assetId: 'signal-moth',
    assetVersion: 'v001',
    chapterGroup: 0,
    maxHp: FRIENDLY_MAX_HP,
  },
  {
    id: 'buffer-baron',
    version: 'v001',
    title: 'Buffer Baron',
    assetId: 'buffer-baron',
    assetVersion: 'v001',
    chapterGroup: 0,
    maxHp: FRIENDLY_MAX_HP,
  },
  {
    id: 'loop-dancer',
    version: 'v001',
    title: 'Loop Dancer',
    assetId: 'loop-dancer',
    assetVersion: 'v001',
    chapterGroup: 1,
    maxHp: FRIENDLY_MAX_HP,
  },
  {
    id: 'prism-mimic',
    version: 'v001',
    title: 'Prism Mimic',
    assetId: 'prism-mimic',
    assetVersion: 'v001',
    chapterGroup: 1,
    maxHp: FRIENDLY_MAX_HP,
  },
  {
    id: 'trendweaver',
    version: 'v001',
    title: 'Trendweaver',
    assetId: 'trendweaver',
    assetVersion: 'v001',
    chapterGroup: 1,
    maxHp: FRIENDLY_MAX_HP,
  },
] as const satisfies readonly FriendlyCatalogEntry[];

export const FRIENDLY_CATALOGS: Readonly<
  Record<FriendlyCatalogVersion, readonly FriendlyCatalogEntry[]>
> = {
  'friendly-catalog-v1': FRIENDLY_CATALOG_V1,
};

export interface FriendlyDefinition {
  id: string;
  levelId: string;
  catalogEntryId: string;
  catalogEntryVersion: string;
  assetId: string;
  assetVersion: string;
  maxHp: number;
}

export interface FriendlyProgress {
  hp: number;
  defeated: boolean;
  boonClaimed: boolean;
  penaltyActive: boolean;
}

export interface FriendlyState {
  version: typeof FRIENDLY_STATE_VERSION;
  catalogVersion: FriendlyCatalogVersion;
  friendlies: Record<string, FriendlyProgress>;
}

export type FriendlyAction = Extract<
  GameplayAction,
  { type: 'interact-friendly' | 'attack-friendly' }
>;

export function friendlyDefinitionsForLevel(
  levelId: string,
  levelIndex: number,
  catalogVersion: FriendlyCatalogVersion = FRIENDLY_CATALOG_VERSION,
): FriendlyDefinition[] {
  const chapterGroup = (levelIndex % 2) as 0 | 1;
  return FRIENDLY_CATALOGS[catalogVersion]
    .filter((entry) => entry.chapterGroup === chapterGroup)
    .map((entry) => ({
      id: `${levelId}-friendly-${entry.id}`,
      levelId,
      catalogEntryId: entry.id,
      catalogEntryVersion: entry.version,
      assetId: entry.assetId,
      assetVersion: entry.assetVersion,
      maxHp: entry.maxHp,
    }));
}

export function friendlyDefinitionsForPlan(
  plan: AdventurePlan,
  catalogVersion: FriendlyCatalogVersion = FRIENDLY_CATALOG_VERSION,
): FriendlyDefinition[] {
  return plan.levels.flatMap((level) =>
    friendlyDefinitionsForLevel(level.id, level.index, catalogVersion),
  );
}

export function createInitialFriendlyState(plan: AdventurePlan): FriendlyState {
  return {
    version: FRIENDLY_STATE_VERSION,
    catalogVersion: FRIENDLY_CATALOG_VERSION,
    friendlies: Object.fromEntries(
      friendlyDefinitionsForPlan(plan).map((friendly) => [
        friendly.id,
        {
          hp: friendly.maxHp,
          defeated: false,
          boonClaimed: false,
          penaltyActive: false,
        },
      ]),
    ),
  };
}

export function friendlyViewsForLevel(
  levelId: string,
  levelIndex: number,
  state: FriendlyState,
): FriendlyView[] {
  return friendlyDefinitionsForLevel(levelId, levelIndex, state.catalogVersion).map(
    (friendly) => {
      const progress = state.friendlies[friendly.id];
      if (!progress) throw new Error('Friendly state is missing a catalog instance');
      return {
        id: friendly.id,
        assetId: friendly.assetId,
        assetVersion: friendly.assetVersion,
        maxHp: friendly.maxHp,
        hp: progress.hp,
        defeated: progress.defeated,
        boonClaimed: progress.boonClaimed,
        penaltyActive: progress.penaltyActive,
      };
    },
  );
}

export function reduceFriendlyAction(
  plan: AdventurePlan,
  currentAdventure: AdventureState,
  currentFriendly: FriendlyState,
  action: FriendlyAction,
  nowMs: number,
): { adventureState: AdventureState; friendlyState: FriendlyState } {
  const adventureState = structuredClone(currentAdventure);
  const friendlyState = structuredClone(currentFriendly);
  const level = plan.levels[adventureState.activeLevelIndex];
  if (!level || action.levelId !== level.id) {
    throw new AdventureRuleError('LEVEL_NOT_ACTIVE');
  }
  if (adventureState.phase === 'fallen' || adventureState.phase === 'complete') {
    throw new AdventureRuleError('ACTION_NOT_AVAILABLE');
  }
  const definition = friendlyDefinitionsForLevel(
    level.id,
    level.index,
    friendlyState.catalogVersion,
  ).find((candidate) => candidate.id === action.friendlyId);
  if (!definition) throw new AdventureRuleError('FRIENDLY_NOT_FOUND');
  const progress = friendlyState.friendlies[definition.id];
  if (!progress) throw new AdventureRuleError('FRIENDLY_NOT_FOUND');

  if (action.type === 'interact-friendly') {
    if (progress.penaltyActive) {
      progress.hp = definition.maxHp;
      progress.defeated = false;
      progress.penaltyActive = false;
      return { adventureState, friendlyState };
    }
    if (progress.boonClaimed) {
      throw new AdventureRuleError('FRIENDLY_BOON_ALREADY_CLAIMED');
    }
    if (adventureState.playerHp >= adventureState.maxPlayerHp) {
      throw new AdventureRuleError('FRIENDLY_HELP_NOT_NEEDED');
    }
    adventureState.playerHp = Math.min(
      adventureState.maxPlayerHp,
      adventureState.playerHp + FRIENDLY_HEAL_HP,
    );
    progress.boonClaimed = true;
    return { adventureState, friendlyState };
  }

  if (adventureState.phase !== 'exploring') {
    throw new AdventureRuleError('ACTION_NOT_AVAILABLE');
  }
  if (progress.defeated) throw new AdventureRuleError('FRIENDLY_NOT_ACTIVE');
  const attackCooldownMs = usesRouteMemoryRules(plan)
    ? ROUTE_ATTACK_COOLDOWN_MS
    : ATTACK_COOLDOWN_MS;
  if (
    boundedRemainingMs(adventureState.attackReadyAtMs, nowMs, attackCooldownMs) > 0
  ) {
    throw new AdventureRuleError('ATTACK_COOLDOWN');
  }
  const equipment = plan.levels
    .flatMap((candidate) => candidate.pickups)
    .find((candidate) => candidate.id === adventureState.equippedId);
  if (
    !equipment ||
    equipment.kind !== 'attack-tool' ||
    !adventureState.inventoryIds.includes(equipment.id)
  ) {
    throw new AdventureRuleError('ATTACK_TOOL_REQUIRED');
  }
  progress.hp = Math.max(0, progress.hp - equipment.damage);
  progress.defeated = progress.hp === 0;
  if (!progress.penaltyActive && progress.hp < definition.maxHp) {
    progress.penaltyActive = true;
    adventureState.playerHp = Math.max(
      1,
      adventureState.playerHp - FRIENDLY_HARM_PENALTY_HP,
    );
  }
  adventureState.attackReadyAtMs = nowMs + attackCooldownMs;
  return { adventureState, friendlyState };
}
