# Work order 110: Haynes Network portal tile

- **Status:** Complete. haynesnetwork [PR578](https://github.com/thaynes43/haynesnetwork/pull/578) was released in v0.99.0 and deployed by [ops PR3190](https://github.com/thaynes43/haynes-ops/pull/3190). The tile row is live and granted to Family, and admins see it too
- **Model / dispatch:** Native Claude Code subagent `claude-opus-5-5` (xhigh)
- **Required reading:** the haynesnetwork repo's `CLAUDE.md`/`AGENTS.md` (docs-first rules, immutable ADRs, catalog admin-curation rule), `packages/db/src/schema/app-catalog.ts`, the per-slug seed precedent `0037_books_library_ledger.sql`, `packages/db/__tests__/migrations.test.ts` (`SEED_SLUGS`), `packages/ui/src/icons/registry.ts` and `components.tsx`, `packages/domain/src/effective-apps.ts`, and that repo's deploy path to haynes-ops
- **Worktree / branch:** `~/work/haynesnetwork-quest-link` on `agent/haynes-quest-link`
- **Owned paths:** a new seed migration, an icon registry entry, tests, and the minimal docs that repo's process requires

## Outcome and scope

The portal shows a **Haynes Quest** tile: slug `haynes-quest`, URL `https://quest.haynesnetwork.com`, a short description such as "Our family adventure game", and a friendly icon. It is granted to the Family role, and admins see it by default. Follow the repo's own conventions for seeding a catalog row and a role grant, and for any required PRD/ADR/plan notes. Deploy through that repo's normal chain (CI image, then the haynes-ops pin if that is how it deploys) and verify the tile renders in the live catalog data. Access to the game is still enforced by the Authentik application bindings (ADR-005), not by the tile.

## Verification

- That repo's full check suite passes; open a PR, get green checks and squash-merge.
- Carry out the deploy steps and verify: the migration applied, and the row is visible through the portal's read path.
- Report the SHAs and deploy evidence.
