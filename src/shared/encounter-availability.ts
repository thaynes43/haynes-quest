const UNLOCKED_BOSS_ROUTE_IDS = new Set<string>([
  "garden-playground-v2",
  "besties-playground-v2",
]);

export type BossGate = "independent" | "after-ordinaries";

/**
 * Legacy and unknown routes keep the original progression gate. Only the
 * explicitly versioned playground routes let their boss engage independently.
 */
export function bossRequiresOrdinaryDefeats(
  routeId: string | undefined,
  bossGate?: BossGate,
): boolean {
  if (bossGate === "independent") return false;
  if (bossGate === "after-ordinaries") return true;
  return !routeId || !UNLOCKED_BOSS_ROUTE_IDS.has(routeId);
}
