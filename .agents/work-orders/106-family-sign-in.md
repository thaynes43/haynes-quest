# Work order 106: Family sign-in and admission

- **Status:** Complete. [PR76](https://github.com/thaynes43/haynes-quest/pull/76) merged at `092a822` and was live on the family release on September 25. The live sign-in start was verified up to Authentik's login flow; Tom's own sign-in is an owner check
- **Model / dispatch:** Native Claude Code subagent `claude-opus-5-5` (xhigh), dispatched by the PLAN-019 Claude coordinator
- **Context:** Fresh agent; self-contained brief
- **Required reading:** `AGENTS.md`, [ADR-001](../../docs/adrs/001-authentik-sign-in.md), [ADR-005](../../docs/adrs/005-family-sign-in-and-admission.md), [DESIGN-024](../../docs/designs/024-family-journeys.md) D-01/D-02/D-08, [WO080](080-identity-curation-readiness.md), `src/server/{config,app,index,security}.ts`, `src/server/db/**`, `migrations/**`, `tests/server/app.test.ts`; reference implementation in the cigar-journal repo (`packages/auth/src/auth.ts`, `packages/auth/src/oidc.test.ts`)
- **Worktree / branch:** `~/work/hq-family-sign-in` on `agent/hq-family-sign-in` from `origin/main`
- **Owned paths:** `src/server/auth/**` (new), auth migrations, `src/server/config.ts`, the `requirePlayer`/session parts of `src/server/app.ts`, `src/shared/contracts.ts` (SessionView), `src/client` sign-in/sign-out shell only, and matching tests

## Outcome and scope

A non-fixture server admits Authentik users per ADR-005:

- Better Auth 1.7.4 `genericOAuth`, provider `authentik`, public PKCE client `haynes-quest` (optional `QUEST_OIDC_CLIENT_SECRET`).
- Callback `/api/auth/callback/authentik`.
- The identity key is `(issuer, subject)`, unique in the database.
- Admission comes from the `groups` claim: `family` or `authentik Admins`; admin only for `authentik Admins`.
- Sessions are Postgres-backed, with a 7-day absolute lifetime and no rolling extension.
- Logout is local, with optional Authentik end-session.
- `requirePlayer` accepts a family session in family mode. `/api/session` returns `mode: 'family'` with `role: 'admin' | 'player'`.

**Fixture mode, the ephemeral playtest and every existing test stay unchanged.** Fixture and family sessions never cross.

New env vars:

- `QUEST_OIDC_DISCOVERY_URL`, `QUEST_OIDC_CLIENT_ID` (default `haynes-quest`), optional `QUEST_OIDC_CLIENT_SECRET`
- `QUEST_ADMITTED_GROUPS` (default `family,authentik Admins`), `QUEST_ADMIN_GROUPS` (default `authentik Admins`)
- `QUEST_AUTH_END_SESSION` (optional)

Rules:

- Non-fixture startup requires the discovery URL.
- The subject-id HMAC key is derived from the session secret with HKDF and a fixed label (export a helper for the family lane).
- Keep the exact-Origin plus `X-Quest-Request` write guard for app routes. Better Auth's own routes use its trusted-origins check with `QUEST_APP_ORIGIN`.

The client shows a minimal signed-out screen with a single "Sign in" button and a signed-in shell exposing `role`. The coordinator will replace the copy; use plain placeholder strings, clearly marked with `// COPY:` comments.

## Deliverables and verification

- Fake identity-provider tests in the style of cigar-journal's `oidc.test.ts`:
  - a successful admitted login;
  - login with no admitted group rejected, with no session created;
  - player vs admin role;
  - tampered state or code rejected;
  - an expired session returns 401;
  - logout clears the session;
  - fixture sessions are rejected in family mode, and family cookies in fixture mode.
- The PostgreSQL uniqueness test runs under `QUEST_TEST_DATABASE_URL`.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass.
- Open a PR (the body names no family members), wait for green checks, squash-merge, and report the merge commit and the exact callback path to the coordinator.
- **Privacy:** this repo is public. Use synthetic identities only.

## Handoff and recovery

Report the branch/PR, merge SHA, env var list, the callback path and any deviation from ADR-005. If blocked, push a WIP branch and report the exact error.
