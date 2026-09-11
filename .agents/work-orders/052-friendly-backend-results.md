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
- `pnpm exec vitest run tests/server/friendly.test.ts` — seven tests passed.
- `pnpm test` — 250 tests passed; ten PostgreSQL tests skipped because `QUEST_TEST_DATABASE_URL` was not available in this session.
- `git diff --check` — passed.

Focused coverage includes immutable catalog separation and chapter assignment, null-sidecar read compatibility, first-successful-action persistence, full-health boon preservation, bounded once-only healing, duplicate replay, weapon damage/cooldown, first-harm penalty, defeat/making amends, owner isolation, one-HP floor, malformed sidecars, retry persistence and advancement with an unrepaired friend. The PostgreSQL suite now includes atomic duplicate replay/owner isolation for a friendly attack and verifies that migrations 0003/0004 leave an existing legacy row with a null sidecar; those cases require the repository's real test database to execute.

An adversarial follow-up found that structurally valid friendly progress for an unopened chapter could pass storage validation even though no server action can create it. Validation now relates the sidecar to the authoritative adventure state and requires every chapter after `activeLevelIndex` to retain pristine friendly defaults. Current and completed-chapter history remains valid, including the `activeLevelIndex === levels.length` completion convention.

Follow-up verification passed TypeScript, scoped ESLint and 20 focused server tests across friendly behavior, domain transaction failure and archived catalog compatibility. The server-wide run passed 61 tests in 11 files; ten PostgreSQL cases in one file were skipped. The same audit reran 29 focused friendly/combat/input/audio tests successfully. `QUEST_TEST_DATABASE_URL` is unset in this worktree, and repository guidance says the PostgreSQL tests truncate Quest tables, so no shared or unrelated database was touched. The required durability check is the existing CI setup: PostgreSQL 16 (`postgres:16-alpine`), disposable `quest_test` database/role, `QUEST_TEST_DATABASE_URL=postgres://quest_test@127.0.0.1:5432/quest_test`, then `pnpm test` (or `pnpm test:db` for the server-only filter).

No browser, asset generation, deployment, database mutation, commit or PR was performed.
