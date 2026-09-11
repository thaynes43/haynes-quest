# WO-009 results: adversarial MVP review of `ad4eedc`

- **Status:** Complete — findings recorded, no implementation edits, no merge
- **Reviewer:** separate Claude Code Fable 5.1 (`claude-fable-5-1`, xhigh) via `agent-run`, per TEAM.md
- **Reviewed commit:** `ad4eedc0c1b956a853c8364cd2e121154162238c` (`feat: integrate private journey interface and first-pass concepts`), canonical base `1b18f48`
- **Review branch / worktree:** `agent/haynes-quest-0911-001603` at `/home/dev/work/haynes-quest-0911-001603`, fast-forwarded to `ad4eedc`; this file is the only commit on top
- **Date:** 2026-09-11
- **Scope read:** AGENTS.md, TEAM.md, PLAN-004, DESIGN-009, HANDOFF, WO-004/005/006, `docs/ops/002-private-preview.md`, all of `src/**`, `tests/**`, `migrations/**`, `Dockerfile`, `.dockerignore`, both workflows, `mkdocs.yml`, `scripts/docs/*`, catalog/review/manifest files

## Verdict

No ownership, CSRF, session-isolation, manifest-forgery or private-media authorization break was found; every probe in those areas failed closed. The concrete defects are one gameplay physics bug that is visible on resume (F1), an e2e touch script whose jump sequence is wrong so the committed touch evidence is invalid (F2, the game itself passes once the script is corrected), and a set of build/deployment, adapter-scope, and UX-mapping issues below. OAuth deferral and synthetic-only fixture access are as authorized and are not findings.

## Findings (ordered by severity)

### F1 · Medium · Avatar hovers after leaving the raised step; step stops being a collision edge

- **Location:** `src/game/controller.ts:93-98` (ground resolution only snaps the avatar *up*; `grounded` is never cleared when the ground drops away) with `src/game/level.ts:82-92` (a legitimate resume checkpoint after the post-unlock memory sits on the step).
- **Reproduction (pure, deterministic):** `node_modules/.bin/tsx test-results/review/probe-controller.ts`
  - case 1 — start on the step (`y=0.32`), hold backward 120 frames: `{"z":-4.3,"y":0.32,"grounded":true}`; expected `y=0`.
  - case 2 — from that state hold forward with `canJump=false`: re-enters the raised section (`z=-16.7`, `onStep=true`); control case 3 from `y=0` is correctly blocked at `z=-9.965`.
  - case 4 — resume with all three memories recovered: checkpoint `{x:0.8,y:0.32,z:-10.85}`; walk backward to the start: `y` stays `0.32` at `z=2`.
- **Reproduction (browser):** corrected journey copy, after "3 / 3 memories" hold `S` 2.5 s → `test-results/review/hover-after-walking-back.png` shows the traveler floating above the flat path with its shadow detached beneath it.
- **Expected:** stepping off the raised section drops the avatar to the lower ground; the step remains a jump-required edge.
- **Actual:** the avatar stays at `y=0.32` for the rest of the session (until a jump), and walks back onto the step freely. Not a progression exploit (abilities are server-derived and the step only exists after the unlock), but it contradicts the "collisions" and "safe resume checkpoint" claims in DESIGN-009 / WO-006 and is easy for a child to trigger by exploring backward or resuming after the third memory.
- **Bounded fix:** after the horizontal move, if `state.position.y > ground + 0.015` set `state.grounded = false` so gravity applies (or snap down when the drop is ≤ step height and not mid-jump). Add a controller test "walking backward off the step lands on lower ground and cannot re-enter without jump".

### F2 · Medium · Committed touch e2e never holds stick + jump; touch and keyboard evidence do not pass at `ad4eedc`

- **Location:** `tests/e2e/journey.mjs:126-131` (jump attempt: `touchStart [1,3]` then `touchEnd [point(1)]`), `:76` (straight-line keyboard approach to memory 3).
- **Evidence:** committed script run against my harness fails at line 76 (`Memory unreachable using keyboard`, `test-results/review/journey-run1.log`); the lead worktree's `test-results/touch-failure.png` and my `touch-m3-fail.png` show the same stall at the step. Pointer log from `test-results/review/probe-touch.mjs` (capture-phase listeners on `window`): `pointerdown 6 joystick` → `pointerdown 7 action-button jump` → **`pointerup 6 joystick` / `lostpointercapture 6`** (the *stick* was released by `touchEnd [point(1)]`) while pointer 7 stays down until the final `touchEnd []`. Every later iteration re-presses the stick for ~130 ms bursts and never re-fires jump because `GameInputState.set` only queues an edge on false→true (`src/game/input.ts:73`).
- **Cause:** Chromium `Input.dispatchTouchEvent` `touchEnd` releases the *listed* points; an empty list releases all. The script assumed the list is "points that remain".
- **Corrected copy** (`test-results/review/journey-fixed.mjs`: release `point(3, …)` instead of `point(1, …)`, plus the lead's uncommitted 250 ms `d` steer before memory 3) **passes end to end** on headless Chromium 153: keyboard route, Save & leave, reload, Continue, growth to Age 4, jump, finish, canvas disposal; touch route with simultaneous stick/camera and stick/jump; portrait no overflow; `pageErrors: []` (`test-results/review/journey-evidence-fixed.json`).
- **Expected/actual:** the evidence JSON string "simultaneous stick/camera and stick/jump" is not exercised by the committed script.
- **Bounded fix:** change line 131 to release the jump point; keep the steer; note the keyboard x-offset reason (memory 3 sits at `x=0.8`, resume x is `-0.7`, interaction radius 1.35). Record that this is Chromium touch emulation only.

### F3 · Medium-low · Runtime image ships the whole dev toolchain and full client source maps

- **Location:** `Dockerfile:24` copies the complete build-stage `node_modules` (measured 350 MB in the lead worktree: `playwright-core`, two `typescript` versions, `vite`, `eslint`, `drizzle-kit`, `jsdom`, `prettier`, four `@esbuild` binaries); `vite.config.ts:5` `sourcemap: true` emits a 3.85 MB map next to a 0.8 MB bundle and `/assets/*` serves it.
- **Impact:** image size and pull time, larger supply-chain surface in the runtime container; no runtime benefit (tsup externalizes only `dependencies`).
- **Bounded fix:** add a deps stage with `pnpm install --prod --frozen-lockfile` (or `pnpm deploy --prod`) and copy that; use `sourcemap: 'hidden'` or drop client maps for the image. Not built here (no Docker daemon in the pod); reviewed statically.

### F4 · Medium-low · `NODE_ENV=production` in the image forbids the only playable mode

- **Location:** `Dockerfile:22` (`ENV NODE_ENV=production`), `src/server/config.ts:23-25` (fixture mode refused under production), `src/server/app.ts:67-80,170-174` (without fixture sessions `/api/session` is 404 and every protected route 401 — confirmed by `tests/server/app.test.ts:214-223`).
- **Impact:** at `ad4eedc` there is no other identity path, so the published `ghcr.io/thaynes43/haynes-quest:sha-…` image cannot serve the private preview unless the HelmRelease overrides `NODE_ENV` to a non-production value. That turns the "disabled in production" guard into a config toggle, while `docs/ops/002-private-preview.md:36` presents the image as the deployment artifact.
- **Decision for the lead:** either document that the private-preview workload deliberately runs `NODE_ENV=development` + `QUEST_FIXTURE_MODE=true` and why, or key the guard on an explicit deployment-intent variable validated against the secrets actually mounted (fixture preview must not see the Immich secret).

### F5 · Medium-low · Immich discovery collapses long histories into the earliest photos

- **Location:** `src/server/photos/immich.ts:186-235` (`order: 'asc'`, ≤ 8 pages × 100 scanned, ≤ 96 earliest eligible assets returned), `src/server/photos/setup.ts:34-36` (chronological spacing is applied only within that slice).
- **Reproduction (by contract):** a subject with 500 timeline photos across 2016–2026 yields candidates confined to the first 96 eligible assets (typically the first months/year), `coverage.toDate` early and `incomplete: true`; the only UI signal is "This is a limited preview…" (`src/client/main.tsx:473-477`).
- **Expected:** a chronological journey that spans the represented ages (PLAN-004 "chronological sampling"). **Actual:** honest but unusable coverage unless the user hand-tunes the date range.
- **Bounded fix:** bucketed discovery within the same caps (e.g. per-year `takenAfter/takenBefore` windows, one small page each), or make the preview's real coverage prominent and default `fromDate/toDate` per bucket.

### F6 · Low · Client error mapping does not match server codes

- **Location:** `src/client/api.ts:22-36`. No server code contains `VALIDATION` or `EXPIRED`, so those branches are dead. Probe (`test-results/review/probe-app.ts`): empty name, `limit: 0` (a cleared number field sends 0), `fromDate` before birth, and a reversed range all return `422 INVALID_REQUEST`; a range beyond the photos returns `422 NO_USABLE_PHOTOS`; both surface as "We couldn't save that change. Your earlier progress is safe…" on the setup screen. An expired 30-minute preview (`src/server/photos/setup.ts:6`) returns `PREVIEW_NOT_FOUND`, which matches the `NOT_FOUND` branch and shows "We couldn't find that journey…".
- **Bounded fix:** map `INVALID_REQUEST`, `NO_USABLE_PHOTOS`, `PREVIEW_NOT_FOUND` explicitly (copy stays lead-owned); guard the number input against empty.

### F7 · Low · Unbounded limiter map and unbounded fixture identity rows

- **Location:** `src/server/security.ts:73-85` prunes only on the existing-key path; `src/server/app.ts:69` keys `/api/session` by `user-agent`. Probe `test-results/review/probe-limiter.ts`: 20,000 distinct keys retained across an hour. Each cookieless `/api/session` inserts a player and a session row (`src/server/db/postgres-store.ts:68-75`); nothing deletes expired sessions/previews (`migrations/0001_quest_server.sql`).
- **Bounded fix:** prune on insert when the map exceeds its cap; key by client address too (trust `X-Forwarded-For` only from the internal ingress); add a periodic delete of expired sessions and previews.

### F8 · Low · `/studio/` serves project records, contrary to DESIGN-009

- **Location:** `scripts/docs/prepare.py:45-52` maps `.agents/**/*.md` and `AGENTS.md` into the site; `Dockerfile:15` copies `.agents` into the docs stage. Probe: `GET /studio/project/HANDOFF.html` → 200 (lead `site/`). DESIGN-009 line 11: the studio "contains only original synthetic candidates".
- **Impact:** the repository is public, so nothing new is disclosed, but internal ops details (LAN ingress IP, pod names, ExternalSecret and 1Password item names) become reachable on the game route.
- **Bounded fix:** exclude `project/` from the studio build variant served by the app, or amend DESIGN-009.

### F9 · Low · UTC date semantics in the adapter

- **Location:** `src/server/photos/immich.ts:329-331` derives the memory date from `fileCreatedAt` in UTC (evening photos in US zones roll to the next calendar day; whole-year ages can flip around a birthday). `immich.ts:247-254` revalidates media by requiring the asset's *current* UTC date to equal the frozen date, so a date correction in Immich turns a still-valid photo into `MEDIA_REVOKED` (progress intact, image gone).
- **Bounded fix:** use Immich `localDateTime` consistently for discovery and revalidation, or revalidate person/state only.

### F10 · Low · Unexpected errors become silent 503s

- **Location:** `src/server/app.ts:163-166`, `src/server/errors.ts:11-15`. Any non-`AppError` (database outage, programming error) is mapped to `503 SERVICE_UNAVAILABLE` with no log line, so runtime-storage failures are invisible in pod logs.
- **Bounded fix:** log `error.name` and stack (never request bodies or cookies) before mapping.

### F11 · Low · Catalog rows claim "concept selected" without review records

- **Location:** `docs/assets/catalog.md:10-16`; `docs/assets/media/{arrival-landmark,clearing-path-kit,clearing-stone,clearing-tree,memory-keepsake}/v001/` contain `concept.png` + `prompt.txt` only. Only `storybook-reference` has a review page and manifest. DESIGN-009 requires reviews to record media, checksums and provenance.
- **Verified:** `manifest.json` sha256 values match the three storybook PNGs on disk.
- **Bounded fix:** add v001 review pages and manifests for the five concepts, or word the rows "concept generated · review page pending".

### Informational

- **I1** Photos are loaded and shown on keepsakes before recovery (`src/game/scene.ts:353-386` textures every manifest memory at mount; unrecovered frames are visible with the picture). With Immich that is N sanitized upstream fetches per scene mount and N more on the finish modal (`src/client/main.tsx:899-903`). Product decision for the lead; no contract breach.
- **I2** The e2e journeys are not in CI (`.github/workflows/app.yml` runs typecheck/lint/test/build; no Playwright browsers). Each claim of browser coverage needs a recorded manual run.
- **I3** `pnpm` refuses scripts through a symlinked `node_modules` (`ERR_PNPM_UNSAFE_MODULES_DIR`); a review worktree must call `node_modules/.bin/*` directly. Worth one line in the ops doc.
- **I4** The Immich adapter is unit-tested but not wired: `src/server/index.ts` injects no `photoSource`/`privateMedia`, no `ImageSanitizer` implementation exists, and `loadConfig` has no `IMMICH_URL` allowlist. Docs/handoff state this honestly; keep saying "adapter implemented behind a contract, not exercised live" until a private read-only smoke runs.

## What held under probing

- **Identity/ownership:** no client identity accepted; HMAC-signed cookie with `timingSafeEqual`; tampered signature → 401; another player's save and media → 404; a memory id from another save → 404 `MEMORY_NOT_FOUND`.
- **CSRF/origin:** origin with trailing slash, uppercase, suffix domain, or `null` → 403; missing header → 403; wrong header value → 403; form/text bodies → 415; JSON with charset accepted.
- **Manifests:** reversed `selectedIds` stored in chronological order; duplicates/unissued → 422; 1–24 enforced in schema, store and DB CHECKs; a one-memory journey completes on a flat route at age 0 with baby abilities.
- **Recovery:** out-of-order → 409; forged `ageYears/abilities` → 422; duplicate → idempotent; concurrent identical requests → one revision (tests); Postgres uses `FOR UPDATE` + revision compare-and-swap.
- **Static delivery:** `..`, `%2e%2e`, `..%2f` under `/studio/*` and `/assets/*` → 404; `@hono/node-server` rejects dot segments and double slashes after decoding.
- **Fixture isolation:** production app has no session route and 401s; fixture app refuses a private source/media provider; config refuses `IMMICH_*` in fixture mode and fixture mode in production.
- **Immich adapter units:** missing name → no asset search; ambiguous → opaque ids; people page cap → fail closed; person/type/visibility filters on every page; malformed `nextPage`/`nextCursor` → rejected; media revalidation, sanitizer requirement, byte limit and total deadline all enforced.
- **Rate limit:** 429 after 120 reads/minute per player.

## Commands and results (this worktree)

```
git merge --ff-only ad4eedc                        # 1b18f48 → ad4eedc
ln -s /home/dev/work/haynes-quest-overnight-mvp/node_modules node_modules
node_modules/.bin/tsc --noEmit                     # exit 0
node_modules/.bin/eslint src tests --max-warnings 0  # exit 0
node_modules/.bin/vitest run                       # 32 passed, 2 skipped (Postgres), 7 files
node_modules/.bin/vite build                       # ok (799.58 kB js, 3.85 MB map)
node_modules/.bin/tsup src/server/index.ts --format esm --platform node --target node24 --out-dir dist/server --sourcemap   # ok
node_modules/.bin/tsx test-results/review/probe-controller.ts   # F1 evidence
node_modules/.bin/tsx test-results/review/probe-app.ts          # CSRF/origin/static/manifest probes
node_modules/.bin/tsx test-results/review/probe-limiter.ts      # F7 evidence
QUEST_E2E_PORT=4174 node_modules/.bin/tsx tests/e2e/serve-fixture.ts   # memory store harness
QUEST_E2E_URL=http://127.0.0.1:4174 node tests/e2e/journey.mjs          # FAILS at line 76 (keyboard, memory 3)
node test-results/review/probe-touch.mjs                               # pointer log → F2 cause
QUEST_E2E_URL=http://127.0.0.1:4174 node test-results/review/journey-fixed.mjs   # PASSES, 0 page errors
sha256sum docs/assets/media/storybook-reference/v001/*.png             # match manifest.json
```

Scratch probes and screenshots live under the git-ignored `test-results/review/` in this worktree (synthetic data only) and are intentionally not committed; their outputs are quoted above.

## Limitations

- No Postgres in this pod: the two integration tests were skipped here (ops ran them 2/2 on a disposable PG16 per the work order); restart persistence was not re-verified by me.
- No Docker daemon: the image was not built; Dockerfile and workflow reviewed statically.
- Browser evidence is headless Chromium 153 with SwiftShader and CDP touch emulation. No Safari, no physical iPad/iPhone; nothing here should be cited as Safari coverage.
- Immich behaviour was assessed against the adapter's test doubles and the pinned OpenAPI assumptions in `tests/server/immich.test.ts`; no live endpoint was contacted.
- Blender/audio/imagegen were out of scope and untouched.

## Checkpoints

1. 00:16 — worktree at `1b18f48`, work order and required docs read.
2. 00:17 — fast-forwarded to `ad4eedc`; full source, tests, Docker/CI read.
3. 00:24 — typecheck/lint/tests/build green via direct binaries.
4. 00:27–00:31 — controller, HTTP, limiter, touch probes and the corrected journey run; F1 and F2 confirmed with artifacts.
5. 00:33 — this record committed; no implementation edits, no merge.

## Addendum: status at the lead tip `05456e5` (delta check only, not a re-review)

The lead branch advanced seven commits past `ad4eedc` while this review ran. I diffed the files behind each finding; nothing else was re-verified.

| Finding | Status at `05456e5` | Basis |
| --- | --- | --- |
| F1 hover / step edge | **Open** | `src/game/controller.ts` unchanged |
| F2 touch e2e jump sequence | **Fixed** in `35bdd13` | `tests/e2e/journey.mjs` now releases `point(3, …)` with the same CDP rationale, adds the 250 ms `d` steer and a pointer trace |
| F3 dev toolchain + client maps in image | **Open** | `Dockerfile:24` and `vite.config.ts` unchanged (Dockerfile only gained `COPY scripts`; `sharp` joined `dependencies`, so the runtime copy also carries its platform binaries) |
| F4 `NODE_ENV=production` vs fixture-only playability | **Open** (decision) | `Dockerfile:22`, `src/server/config.ts`, `src/server/index.ts` unchanged |
| F5 earliest-96 discovery | **Open** | `src/server/photos/immich.ts` unchanged |
| F6 client error-code map | **Open** | `src/client/api.ts` unchanged |
| F7 limiter map growth | **Fixed** (limiter) / **Open** (row growth) | `src/server/security.ts` now prunes on insert and caps at 2,000 keys with `tests/server/limits.test.ts`; session/preview rows are still never purged |
| F8 studio serves project records | **Open** | `scripts/docs/prepare.py` unchanged |
| F9 UTC date semantics / date revalidation | **Open** | `immich.ts` unchanged |
| F10 silent 503 | **Open** | `src/server/app.ts`, `src/server/errors.ts` unchanged |
| F11 catalog rows without review records | **Open** for the five prop concepts | audio rows now link v001 review pages; prop rows unchanged |
| I4 adapter not wired / no sanitizer | **Partly addressed** | `src/server/photos/private.ts` factory + `SharpImageSanitizer` (`sanitizer.ts`, tests) added; `index.ts` still constructs no private source by design; HANDOFF records an isolated Immich 3.1.0 schema/transport smoke. "Adapter not exercised end-to-end in the app" still holds |
