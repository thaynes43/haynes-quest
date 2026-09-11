# WO-018 results: bounded server review fixes

- Lane: separate Fable 5.1 (`claude-fable-5-1`, xhigh) task session via `agent-run`, worktree `agent/haynes-quest-0911-095948`, based on root commit `f0756bc`.
- Scope held to the owned paths: `src/shared/adventure.ts`, `src/server/app.ts`, `src/server/domain.ts`, server tests, this report. `src/server/adventure-schema.ts` needed no change; its existing validation is reused as the pre-write check. No browser, Blender, live data, OAuth, DB or dev-env work.
- Root integrates this commit into PR #26. No competing PR was opened.

## Findings implemented

### 1. `app.onError` now emits the safe diagnostic for every 5xx, including AppError ones

`src/server/app.ts`: the handler resolves the failure first and emits `api_request_failed` whenever the response status is 500 or above, so `SAVE_DATA_INVALID`, `MEDIA_UNAVAILABLE`, `PHOTO_SETUP_UNAVAILABLE` and `MEDIA_INVALID` are no longer silent. 4xx behaviour is unchanged (no diagnostic). The record gained two optional fields for AppError failures, `code` and `status`, both fixed constants from the codebase (every `new AppError(...)` site uses a literal or an `AdventureRuleCode` union member; verified by grep). `classifyError` reports `'app-error'` for them. Nothing request-derived is logged: no body, save id, subject, date, cookie or exception text.

Test: `tests/server/app.test.ts` "records a bounded diagnostic for server-side AppError failures and none for client errors" drives a real read-path failure (a corrupted stored record makes `validateSaveRecord` fail closed on GET), asserts the exact diagnostic, asserts a 404 and a 422 emit nothing, and asserts the serialized diagnostics contain neither the save id, the cookie, the birth year nor the subject label. The existing TypeError diagnostic test still passes unchanged.

### 2. Every `toSaveView` call uses the injected application clock

`src/server/app.ts`: one `now()` closure over `options.now` feeds the create route, the read route and the action route (which passes the same instant to the store and the view). `src/server/domain.ts`: `toSaveView(save, now)` no longer defaults to `new Date()`, so the compiler rejects any future call that skips the clock.

Test: `tests/server/clock.test.ts` "renders cooldowns on the read path from the same injected clock as the action route" proves under a fake clock that GET reports the same remaining cooldown as the action response, counts it down as the fake clock advances, that the action route rejects with `ATTACK_COOLDOWN` at the same instant GET shows time remaining, and that both agree on expiry. Against the old code GET used wall-clock time and reported 0.

### 3. Persisted deadlines are bounded so a backward wall-clock step cannot lock a save

`src/shared/adventure.ts`: new exported `boundedRemainingMs(deadlineMs, nowMs, maxDurationMs)`. A deadline in the past is expired; a remaining interval larger than the action's full duration is clock skew and is also expired. The same function now governs attack eligibility (`ATTACK_COOLDOWN_MS`), enemy-hit eligibility (`ENEMY_HIT_COOLDOWN_MS`), guard eligibility (`GUARD_COOLDOWN_MS`), the active-guard damage reduction (`GUARD_ACTIVE_MS`) and the three `*RemainingMs` view fields. No client timestamp fields were added and the persisted state shape is unchanged. Forward passage expires cooldowns exactly as before.

Bound chosen: the durations are the constants used when each deadline was written, so at the instant of writing the remaining interval equals the bound and is still on cooldown. Any backward step, however small, makes the interval exceed the bound; the worst case a player gains is one early action per affected deadline, rather than a save locked for hours.

Tests, `tests/server/clock.test.ts`:
- "treats a backward wall-clock step as expired cooldowns instead of locking the save" (HTTP): attack, guard and a guarded hit at T, then the clock steps back two hours. GET reports all three remaining values as 0; a hit is accepted at full damage (guard window skew-expired); attack and guard are accepted and set fresh deadlines. Old code returned two-hour remaining values and `ENEMY_HIT_COOLDOWN`.
- "rejects each action just before its deadline, accepts it at the deadline, and clears it on skew" (reducer unit): for attack, guard, guard-active and enemy-hit, one millisecond before the deadline is rejected or still guarded, the deadline itself is accepted or unguarded, and a backward step is treated as expired.
- "expires past deadlines and any interval longer than the action could grant": `boundedRemainingMs` boundaries directly.

### 4. The reduced adventure is validated before any store writes it

`src/server/domain.ts`: `applyGameplayActionToSave` now returns `validateSaveRecord(next)` for a non-replay action. Both stores use that result as the value they write, so an impossible reducer result throws `SAVE_DATA_INVALID` (503, now diagnosable by finding 1) inside the memory store's exclusive section or the Postgres transaction, before the write. Replays are untouched. Frozen-plan semantics are unchanged: `validateSaveRecord` checks structure and invariants only and never recomputes plan combat numbers from today's `createEquipment`/`createEncounters` defaults.

Tests, `tests/server/domain.test.ts`:
- "fails the action before the store writes an impossible reducer result": a one-shot mocked reducer returns `playerHp > maxPlayerHp`; the store rejects with an `AppError` 503 `SAVE_DATA_INVALID`, the record still reads at revision 0 with no receipts, and the same request then succeeds normally. Against the old code the bad state was persisted and the next `getSave` blew up in `cloneSave`, which is the exact failure mode this closes.
- "keeps the frozen plan authoritative over current combat defaults when validating a write": a plan with attack damage and enemy HP that today's defaults would not produce is accepted by the pre-write validation, and the attack result follows the frozen numbers. This test also passes on the old code, as intended.

## Not changed, per the order

- Save-list shape and fail-closed list behaviour: untouched; root records the repair limitation.
- Synthetic fixture-art route: still a fixture preview; not connected to private media.
- Receipt window: still bounded by `MAX_ACTION_RECEIPTS`; an exact retry still carries its original `expectedRevision` in the hashed payload, and a changed revision is a different payload. No receipt storage growth, no invented timestamps.
- `src/server/adventure-schema.ts`: no edits needed.

## Verification (this worktree, 2026-09-11)

| Check | Command | Result |
|---|---|---|
| Typecheck | `node_modules/.bin/tsc --noEmit` | exit 0 |
| Lint | `node_modules/.bin/eslint src tests --max-warnings 0` | exit 0 |
| Focused server tests | `vitest run tests/server/{clock,domain,app,adventure}.test.ts` | 4 files, all passing |
| Full local suite | `node_modules/.bin/vitest run` | 15 files passed, 1 skipped; 74 tests passed, 8 skipped |
| Regression proof | new tests against `f0756bc` sources | 6 of 7 new tests fail on the old code (the frozen-plan guard passes on both, as designed); edits restored and verified with `cmp` |
| Build | `vite build` + `tsup src/server/index.ts ...` | both exit 0 (pre-existing chunk-size warning only) |
| Postgres integration | `tests/server/postgres.integration.test.ts` | skipped locally (no `QUEST_TEST_DATABASE_URL`), per the order; real Postgres coverage stays with the server lane and PR CI |

`pnpm` scripts were not used directly because dependencies were installed offline from the pnpm store in this worktree; the `.bin` binaries run the same commands as `package.json`.

## Notes for root integration

- `toSaveView` now requires its `now` argument. Only `src/server/app.ts` calls it; root's uncommitted client and rendering work is unaffected.
- `SafeDiagnostic` gained optional `code` and `status`, and `SafeErrorClass` gained `'app-error'`. `src/server/index.ts` compiles unchanged; its maintenance/startup diagnostics keep their shape.
- Docs are root-owned: DESIGN-010's command-validation paragraph could gain one sentence on bounded cooldowns (a backward server clock step expires a cooldown rather than locking the save) and on 5xx diagnostics now covering `SAVE_DATA_INVALID`.
- The commit is on branch `agent/haynes-quest-0911-095948` in this pod's shared repository, so root can cherry-pick it into `agent/quest-era-boss-loop` without a fetch.
