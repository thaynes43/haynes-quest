# WO-005: Server persistence and Immich adapter

- **Status:** In progress
- **Model / dispatch:** Native GPT-5.6 Sol, `xhigh`, delegated by the overnight Astra coordinator
- **Context:** Fresh development agent with a self-contained server work order
- **Required reading:** `AGENTS.md`, `.agents/TEAM.md`, `.agents/plans/004-overnight-mvp.md`, `docs/designs/009-overnight-contracts.md`, `docs/reference/immich-appdaemon.md`, and relevant photo/persistence designs
- **Worktree / branch / base commit:** `/home/dev/work/quest-server`; `agent/quest-server`; `bd55863`
- **Depends on / stable contracts:** DESIGN-009 HTTP and persistence contracts; coordinator-owned `src/shared/contracts.ts` and root package/tooling scaffold
- **Owned paths:** `src/server/**`, `tests/server/**`, `migrations/**`, `scripts/db/**`, and this work order

## Outcome and scope

Implement the Hono/Node server, Postgres/Drizzle persistence, development-only signed fixture identity, bounded frozen journey manifests, atomic monotonic memory recovery, protected media delivery, and an injectable fail-closed Immich adapter. Fixture access is forbidden in production and cannot coexist with Immich credentials. OAuth is deferred. Real personal data and credentials never enter repository fixtures, prompts, logs, or error responses.

## Inputs and implementation contract

Use DESIGN-009 as the exact route and wire contract. Identity is always server assigned. Mutations require same-origin JSON plus `X-Quest-Request: 1`; every private record is owner scoped. Finite manifests freeze stable source asset IDs, capture dates, age values, versions, and allowed recovery order. Recovery uses a transaction, compare-and-swap revision, and an idempotency key so a retried response cannot duplicate or reorder progress. Upstream discovery and media calls have explicit item/page/byte/time limits and verify person, media kind, capture date, and archive/trash state. Missing or ambiguous person names fail closed.

The real Immich adapter is dependency injected and is never available to fixture routes or processes. Repository tests use fictional identities and synthetic bytes only. Package dependency requests and shared-type concerns are sent to the coordinator before integration.

## Deliverables and verification

- Runnable server modules and Drizzle migration/schema.
- Unit and route tests for identity, CSRF, owner isolation, fixture/production separation, finite manifests, stale revisions, duplicate and out-of-order recovery, and protected media.
- Immich adapter tests for exact/missing/ambiguous names, bounded pagination/time/bytes, filters, and safe upstream failures.
- Real Postgres integration coverage when a disposable database is available; otherwise record the exact blocker and retain executable tests.
- Exact test/typecheck commands, results, dependency list, and known limitations.

## Checkpoints

1. Worktree created at the accepted contract commit; applicable repository/team instructions read.
2. Coordinator scaffold commit `948d917` integrated for the fixed shared types and dependencies. Server implements the exact DESIGN-009 routes, fixture identity boundary, owner-scoped storage, finite manifests, monotonic transaction semantics, protected media, and static client/studio serving.
3. Immich calls were checked against the repository-pinned official OpenAPI snapshot at `immich-app/immich@2a626220`: `GET /api/people`, paginated `POST /api/search/metadata`, `GET /api/assets/{id}`, and `GET /api/assets/{id}/thumbnail?size=preview`. The adapter accepts an injected authorized caller, pins destinations to an allowlisted origin, issues connection-scoped opaque IDs, and bounds pages, candidates, JSON/media bytes, and total time.
4. Current verification: TypeScript strict check passed; ESLint passed with zero warnings; 19 route/config/adapter tests passed; Node 24 server bundle succeeded. Two real-Postgres tests are executable and temporarily skipped until ops supplies the disposable database process environment.

## Handoff and recovery

Commit completed work to `agent/quest-server` for coordinator cherry-pick. Do not edit coordinator-owned package, shared contract, client, game, docs, deployment, dev-env, or AppDaemon paths. Record the commit, checks, unresolved integration needs, and exact next action here before handoff.

Current limitation: OAuth/admitted production identity remains deferred by PLAN-004, so production registers no fixture session route and all protected API routes fail closed. Private Immich media also requires an injected decode/reencode sanitizer; without it the adapter returns `MEDIA_SANITIZER_REQUIRED` rather than forwarding metadata-bearing bytes.
