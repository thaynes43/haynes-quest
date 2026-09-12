# Work order 063: fresh ephemeral playtest sessions

- **Status:** Ready for coordinator review
- **Model / dispatch:** Native GPT-5.6 Sol, `xhigh`, fresh context
- **Required reading:** `AGENTS.md`, `.agents/TEAM.md`, `.agents/HANDOFF.md`, PLAN007
- **Worktree / branch / base:** `/home/dev/work/quest-playtest-reset`, `agent/quest-playtest-reset`, `ed7ae72963d9d9902cb42f1fec545d15e659fe25`
- **Owned paths:** `src/server/config.ts`, `src/server/index.ts`, `src/server/app.ts`, `src/server/db/memory-store.ts`, focused server tests, the `SessionView.progressMode` field, and this record
- **Depends on:** WO064's opt-in `route-memories` plan mode, six-picture fixture, action reducer and strict `playtestStartSchema`

## Result

`QUEST_EPHEMERAL_PLAYTEST=true` is an explicit fixture-development-only mode. It does not require `DATABASE_URL`; startup selects a bounded `InMemoryQuestStore` and skips PostgreSQL connection and migration. Normal persistent startup still requires the database and keeps its existing PostgreSQL behavior. App construction also rejects an ephemeral flag paired with production/private mode or a non-memory store.

The signed fixture cookie continues to carry identity only. A cookie from the persistent deployment has no matching record in the process-local store, so the server issues a new isolated player identity without reading, changing or deleting old database records. Ephemeral save discovery always returns an empty list, which makes a reload enter the fresh path even for an older client. Direct reads, media and gameplay actions retain owner checks, server-issued state, expected revisions and action receipt behavior for the active page. Expired identities cause their in-memory previews and saves to be reclaimed. Hard caps bound sessions, previews and saves if request-rate limits alone are insufficient.

`SessionView` adds optional `progressMode: 'ephemeral' | 'persistent'`. The existing `mode: 'fixture'` and CSRF contract stay unchanged, and the optional field preserves compatibility with older clients and serialized fixtures.

The ephemeral-only `POST /api/playtest/start` accepts a strict same-origin JSON body `{ chapter: 1 | 2 }`. Every call creates a new six-picture route journey. Chapter 1 returns its untouched starting state. Chapter 2 is a testing shortcut: it collects the issued attack tool, recovers both minor memories, defeats each encounter through revision-controlled store actions at the real cooldown, then recovers the major memory so the authoritative reducer advances to the second chapter. It never manufactures state or writes directly to storage. The route is absent in normal persistent mode.

The root app shell now sends `Cache-Control: no-store`. Vite-style content-hashed client assets receive a one-year immutable policy; unhashed client assets require revalidation. This prevents a refreshed browser from pairing an old HTML shell with a new server while retaining safe caching for immutable bundles. Studio pages and media explicitly require revalidation (`Cache-Control: no-cache`). WO068 identified that the earlier checkpoint had incorrectly described an existing policy; the review follow-up adds it.

## Verification

- `pnpm exec vitest run tests/server/app.test.ts tests/server/config.test.ts tests/server/maintenance.test.ts` — 22 tests passed.
- `pnpm exec vitest run tests/server` — 74 tests passed; ten PostgreSQL tests skipped because `QUEST_TEST_DATABASE_URL` was not set.
- Scoped ESLint over every owned implementation and test file — passed with zero warnings.
- `pnpm typecheck` — passed after the shared WO064 contract settled.
- `pnpm build` — passed; Vite reported the existing large-client-chunk advisory and the Node server bundle completed.
- Built-server no-database probe — started with `DATABASE_URL` absent, returned ready, established an ephemeral session and created a validated chapter-two route through `/api/playtest/start`; graceful interrupt exited zero.
- Focused evidence covers startup without database configuration, invalid mode combinations, old-cookie renewal, persistent-record non-mutation, empty reload-facing discovery, active owner/revision actions, fresh IDs on repeated starts, authoritative chapter-two preparation, state expiry/capacity recovery and cache headers.

## Handoff

The coordinator owns integration, full checks, deployment configuration and live validation. The playtest deployment must set `NODE_ENV=development`, `QUEST_FIXTURE_MODE=true` and `QUEST_EPHEMERAL_PLAYTEST=true`; it should omit database access from the resulting workload. The normal deployment must omit the new flag. No database, private photo source, OAuth path, cluster configuration, browser lease, commit, PR or deployment was touched in this lane.

## Follow-up: bounded world-tap and security verification

Five synthetic pointer tests were added in `tests/game/input.test.ts` without changing the coordinator-owned input implementation. They prove that a touch ending at the exact 10-pixel and 500-millisecond limits queues one jump without camera motion; travel beyond 10 pixels rotates the camera and cannot jump on release; cancellation and a 501-millisecond hold cannot jump; contacts originating in `[data-quest-ui]` are excluded; and a world tap from a second pointer queues jump while the first pointer's joystick movement remains held. The focused file now passes all nine tests. No production input bug was found in these cases.

The ephemeral start route was reviewed for authentication, request integrity, isolation and resource bounds. It is registered only in ephemeral fixture mode, requires a valid signed owner session, exact same-origin mutation header, strict JSON with only chapter 1 or 2, and the existing per-owner write limiter. Its photo request and plan mode are server-selected, responses are covered by API `no-store`, fresh records are capped by the ephemeral store, and chapter preparation persists only validated revision-controlled actions. Added endpoint assertions reject a missing session, missing origin, chapter 3 and an extra client-supplied save ID; persistent mode returns 404. No concrete security regression was found.

Follow-up verification: `pnpm exec vitest run tests/server/app.test.ts tests/game/input.test.ts` passed 23 tests, scoped ESLint passed with zero warnings, and `pnpm typecheck` remained green.
