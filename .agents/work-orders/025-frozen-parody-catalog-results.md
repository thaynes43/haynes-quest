# WO-025 results: Frozen dated parody selection

- **Status:** Complete for root integration
- **Branch/worktree:** `agent/quest-frozen-parody-catalog` at `/home/dev/work/quest-frozen-parody-catalog`
- **Base:** `4910ca86052abc17f0f5b14fc55983beda746de0`
- **Implementation commit:** `fe7c9e1a9b15a6bc7f6605184796efbe4f605b2d`

## Delivered

- New saves create strict `era-level-plan-v2` plans pinned to `parody-catalog-v1`. Selection uses each level's frozen start date and starting abilities, requires complete `ordinary-a`, `ordinary-b`, and `boss` coverage in one period, and has no later-period fallback.
- Each v2 level freezes `periodId` and the ability-derived `gentle-intro-v1` or `gentle-jump-v1` route. Each encounter freezes `content.catalogEntryId`, `catalogEntryVersion`, `assetId`, and `assetVersion` while retaining the existing combat numbers and state machine.
- The fixture plan selects Mister Hiss, Peel Patrol, and The Drama Dragon at the 2020 start, then Sir Flush-a-Lot, Nap Captain, and The One-Star Diva after consuming the first bundle and entering the 2024 start.
- Stored v1 plans retain their strict old shape, generic views, state semantics, actions, and saved rule versions. V2 validation checks frozen identities against the immutable catalog version without rerunning deterministic selection or changing a stored identity.
- Missing create-time coverage returns bounded `422 ERA_CATALOG_UNAVAILABLE` and neither memory nor PostgreSQL stores insert a partial save. Existing saves are resolved before new selection, so retries of an already-created preview do not depend on current coverage.

The lead-authored `src/shared/parody-catalog.ts` is unchanged from the base commit.

## Verification

- `pnpm typecheck` — passed
- `pnpm lint` — passed with zero warnings
- `pnpm test` — 22 files passed, 1 PostgreSQL file skipped; 133 tests passed and 9 skipped
- `pnpm build` — passed; client and Node server bundles produced
- `git diff --check` — passed

The dedicated `QUEST_TEST_DATABASE_URL` was not configured in this worktree, so the nine PostgreSQL integration cases were left for root/CI. The added skipped case proves transaction rollback and no partial save when that database is available.

## Persistence and migration limit

No SQL migration is required or added. Migration `0003_era_combat_saves.sql` constrains `save_format` to the unchanged `era-combat-v2` value and requires `adventure_plan` and `adventure_state` to be JSON objects; it does not constrain the nested plan version. Both strict plan versions therefore fit the existing JSONB columns. The state remains `era-combat-state-v2`.

Catalog coverage remains deliberately bounded to the exact lead-authored 2020–2023 and 2024–2026 windows. Unsupported dates fail creation cleanly. No fallback roster, client selection, scene/UI work, assets, private data, infrastructure, deployment, or production database action is included.
