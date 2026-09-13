const UNLOCKED_BOSS_ROUTE_IDS = new Set<string>([
  "garden-playground-v2",
  "besties-playground-v2",
]);

/**
 * Legacy and unknown routes keep the original progression gate. Only the
 * explicitly versioned playground routes let their boss engage independently.
 */
export function bossRequiresOrdinaryDefeats(
  routeId: string | undefined,
): boolean {
  return !routeId || !UNLOCKED_BOSS_ROUTE_IDS.has(routeId);
}
