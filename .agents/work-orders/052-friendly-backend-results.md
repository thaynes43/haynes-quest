# Work order 052: friendly character backend

- **Status:** Ready for coordinator review
- **Model / dispatch:** Native GPT-5.6 Sol, `xhigh`, fresh context
- **Required reading:** `AGENTS.md`, `.agents/TEAM.md`, `.agents/HANDOFF.md`, PLAN006 and DESIGN013
- **Worktree / branch:** `/home/dev/work/quest-playtest-feedback`, `agent/quest-playtest-feedback`
- **Owned paths:** Shared friendly catalog/contracts; server validation, persistence and migration; focused server tests

## Result

Implemented the accepted friendly-character contract without changing the frozen adventure plan/state formats or either parody catalog. An immutable `friendly-catalog-v1` assigns Blockling, Signal Moth and Buffer Baron to even-numbered chapter indexes, and Loop Dancer, Prism Mimic and Trendweaver to odd-numbered indexes. Stable instance IDs combine the level and asset identities.

`quest_saves.friendly_state` is an additive nullable JSON sidecar. New saves initialize it immediately. Existing era saves derive the same defaults for reads without a write, then persist the sidecar with their next successful action. Legacy saves remain read-only and have no friendly state. Strict parsing checks the state/catalog versions, exact instance set, health bounds, defeat relationship and the relationship between harm and an active penalty.

The existing action endpoint now accepts `interact-friendly` and `attack-friendly`, each with the current `levelId` and server-issued `friendlyId`. Both use the existing owner lookup, expected revision, payload receipt and transaction/CAS behavior. Greeting heals two HP once when health is missing and does not consume the boon at full health. Equipped-weapon attacks use the shared attack cooldown and four-point friendly health. First harm removes two player HP with a floor of one and activates the penalty. Interaction with a hurt or defeated friendly restores it fully and clears the penalty without resetting an already claimed boon. Friendly state survives retry and level advancement and does not participate in enemy or boss gates.

The active save view always supplies three `FriendlyView` records under `activeLevel.friendlies`. The property remains optional in the TypeScript contract so older serialized views and fixtures continue to typecheck.

## Verification

- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm exec vitest run tests/server/friendly.test.ts` — six tests passed.
- `pnpm test` — 250 tests passed; ten PostgreSQL tests skipped because `QUEST_TEST_DATABASE_URL` was not available in this session.
- `git diff --check` — passed.

Focused coverage includes immutable catalog separation and chapter assignment, null-sidecar read compatibility, first-successful-action persistence, full-health boon preservation, bounded once-only healing, duplicate replay, weapon damage/cooldown, first-harm penalty, defeat/making amends, owner isolation, one-HP floor, malformed sidecars, retry persistence and advancement with an unrepaired friend. The PostgreSQL suite now includes atomic duplicate replay/owner isolation for a friendly attack and verifies that migrations 0003/0004 leave an existing legacy row with a null sidecar; those cases require the repository's real test database to execute.

No browser, asset generation, deployment, database mutation, commit or PR was performed.
