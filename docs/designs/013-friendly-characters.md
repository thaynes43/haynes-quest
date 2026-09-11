# DESIGN-013: Friendly characters and making amends

- **Status:** Accepted for the PLAN006 private playtest, September 11, 2026.
- **Owner direction:** Existing creature assets are friendly residents who provide player bonuses and should not be harmed. The player can deliberately attack/defeat them but receives a penalty. Exact numbers and implementation below are lead-selected defaults for testing.

## Player experience

Three friendly residents appear in each chapter, using all six existing models: Blockling, Signal Moth and Buffer Baron first; Loop Dancer, Prism Mimic and Trendweaver next. They have a distinct friendly marker and a greeting interaction. A greeting restores two health points once per resident per chapter. At full health, the greeting keeps that healing available for later.

Normal attack targeting always selects hostile encounters and never silently switches to a nearby friend. A separate deliberate interaction warns the player before sending an attack against a friend. Equipped weapon damage can hurt or defeat them; defeat is a cartoon collapse with no gore. On first harm, the player loses two health points, stopping at one, and that friend's healing is unavailable until the friendship is repaired.

Interacting with a hurt or defeated friend offers **Make amends**. This restores that friend to full health and clears its penalty, while retaining whether its one healing gift was already used. Repair is available during exploration and after boss victory. No friendly action removes recovered memories, age, abilities or equipment, changes boss requirements or blocks a chapter. Ordinary failed jumps/retries and save/reload preserve the friendly state.

## Durable contract

Keep friendlies separate from enemies: no new EncounterRole, no entries in the enemy array, EnemySimulation, automatic enemy targeting or boss gates. An immutable friendly catalog v1 names exact existing asset versions and provides deterministic per-level assignments. Stable instance IDs include the level ID and asset ID.

A nullable `friendly_state` JSON sidecar on the save stores its schema/catalog versions and per-instance HP, defeated, boonClaimed and penaltyActive. Existing saves receive deterministic defaults when read and persist that state on their next successful action; no invasive rewrite or backfill is needed. Existing AdventurePlan/state formats and parody catalog v1/v2 remain compatible.

`interact-friendly` and `attack-friendly` use the existing authenticated action endpoint, expected revision and bounded action receipt list. Owner checks, payload hashes, atomic updates and duplicate/stale/concurrent request semantics apply to health and friendly state together. Attack uses the shared weapon cooldown. Reject wrong-level, missing, malformed or out-of-phase actions; do not trust a supplied asset identity or bonus amount.

Expose the current level's friendly views (stable instance and asset/version, HP/maxHP, defeated, boonClaimed, penaltyActive) independently of encounter views. Catalog identity and state validation must reject mismatched instance sets, impossible health/defeat relationships and unknown versions. The client chooses labels/positions from known catalog IDs and does not invent earned rewards.

## Acceptance

Test once-only healing, full-health preservation, first-harm HP floor/penalty, defeat and amends, retry/reload, advancement with harmed friends, old/null-sidecar saves, malformed sidecars and exact legacy catalog retention. Add meaningful owner/revision/duplicate/concurrent PostgreSQL tests using existing transaction infrastructure. Real controls must show friendly markers, greetings, warning/intentional attacks, penalty feedback and recovery without stealing hostile targeting.

All six review pages, inventory entries and thumbnail cards describe friendly roles and match actual integration status. Final exact-model approval remains separate from the requested isolated playtest integration.
