# Work order 109: Family journeys with real memories

- **Status:** In progress
- **Model / dispatch:** Native Claude Code subagent `claude-opus-5-5` (xhigh). The coordinator owns all user-visible copy and layout decisions.
- **Required reading:** `AGENTS.md`; [DESIGN-024](../../docs/designs/024-family-journeys.md), the contract; DESIGN-004/006/009/012/016; [ADR-005](../../docs/adrs/005-family-sign-in-and-admission.md); `src/server/photos/**`; `src/server/{app,domain,postgres-store,memory-store}.ts`; `src/shared/adventure*.ts`; `src/shared/editor-project.ts`; `src/server/editor-preview.ts`; `src/shared/parody-*.ts`; `tests/server/**`
- **Worktree / branch:** `~/work/hq-family-journeys` on `agent/hq-family-journeys` from `origin/main`; rebase onto WO106 once it merges
- **Owned paths:** `src/server/family/**` (new), `src/server/photos/**`, family migrations, `src/shared/family-plan.ts` (new), the save/plan validation additions, `src/client/family/**` (new), `src/server/admin.ts` (operator CLI), matching tests

## Outcome and scope

Implement DESIGN-024:

- **Tables (D-02) and age-band rebase (D-03).**
- **Bounded Immich auto-pick (D-04).** Use smart search, `localDateTime` and face boxes; the ranking needs a fake Immich caller for tests.
- **Captions (D-05).**
- **Private media (D-06).** Candidate tokens, plus reuse of `fetchMedia`, the sanitizer and the existing save media route.
- **`family-world-plan-v1` (D-07).** It reuses the frozen editor-world runtime, consumes `abilitiesForAge` from WO107 (stub it behind an interface until WO107 merges), and is accepted in production only through a publication.
- **Routes (D-08).** Admin routes are gated by the WO106 role.
- **Operator CLI (D-09).** It prints only opaque ids and counts.
- **Client screens,** functional, with `// COPY:` placeholders: an admin Memories screen (chapter cards × 3 slots, swap with Show more, caption edit, publish) and child journey cards.

**Phase 1 (now):** domain modules and tests that do not depend on WO106 (rebase, pick, plan builder, publication store). **Phase 2:** after WO106 merges, add routes, UI and CLI.

Fixture mode, the playtest and existing plans stay unchanged. The Rat Casino and Besties templates must be expressible as family templates. Chapter templates are resolved from a registry of checked-in world projects keyed by template id and version; the coordinator supplies World A and World B later.

## Deliverables and verification

- The DESIGN-024 validation list: unit tests, PostgreSQL tests under `QUEST_TEST_DATABASE_URL`, and a synthetic browser journey with fake Immich.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass.
- **Privacy:** synthetic children only; no real names, birthdays or photos anywhere. This repo is public.
- Open a PR, get green checks, squash-merge, and report the SHA, routes, CLI usage and env vars.

## Handoff and recovery

If context runs short, push the branch with a `NOTES.md` checkpoint, stating what is finished and what is next, and report.
