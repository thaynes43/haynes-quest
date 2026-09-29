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

/** The frozen boss rule, shared by saved actions, client combat and rendering. */
export function bossIsAvailable(
  routeId: string | undefined,
  bossGate: BossGate | undefined,
  prerequisiteDefeats: number | undefined,
  encounters: readonly { role: string; defeated: boolean }[],
): boolean {
  const ordinary = encounters.filter((encounter) => encounter.role === "ordinary");
  if (bossRequiresOrdinaryDefeats(routeId, bossGate))
    return ordinary.every((encounter) => encounter.defeated);
  const required = prerequisiteDefeats ?? 0;
  return ordinary.filter((encounter) => encounter.defeated).length >= required;
}
