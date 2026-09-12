# WO068 results: Fable adversarial review of PLAN007

- **Reviewed commit:** `b11f97a` (`Implement ephemeral chapters, route memories, secondary attacks and sound mix`) on `agent/quest-playtest-reset`, fast-forwarded onto this worktree's branch `agent/haynes-quest-0911-212453` from `ed7ae72`.
- **Reviewer:** Claude Fable 5.1 (`claude-fable-5-1`, xhigh) via `agent-run`; source gathering and two probe lanes (audio lifecycle, server isolation) by native Opus 5 subagents (`claude-opus-5`, each report's first line confirmed the model id). Every subagent finding below was re-read and re-run by the reviewer before ranking; the rankings here are the reviewer's, not the subagents'.
- **Scope honoured:** source-only. No browser, Playwright, Blender, cluster, canonical clone, root worktree (`/home/dev/work/quest-playtest-reset`), fixture 4397 or 4392 was touched. No game code, docs or catalog changed; only probe tests under `tests/review/068-probes/` and this record were added.
- **Lead-tree drift check (read-only):** root has uncommitted edits to `tests/game/runtime.test.ts` and `tests/game/runtime-obby.test.ts` plus untracked WO064/WO066 records and `tests/e2e/fresh-playtest.mjs`; no `src/` drift. The two stale assertions are the ones the work order excluded.

## Verdict

**No blocker found.** The integrated candidate does what PLAN007/DESIGN015 claim at the source level: a fresh ephemeral run at age zero jumps, collects gear and both minor memories on contact, beats the ordinary guests and the dragon, and the post-boss major memory advances 0 → 4 atomically; the direct Besties shortcut lands on an authoritative chapter two and plays through to age 7 with Bash gated on the dizzy window; ownership, CSRF, media locking, v1/v2 plan and reducer behaviour, revision receipts and the empty save list all hold. This was proven without a browser by driving `createGame` against the real Hono app (session cookie, Origin/CSRF headers, `/api/playtest/start`, `/api/saves/:id/actions`) with only the Three.js scene mocked.

Two medium findings deserve a decision before the private release (studio artwork has no cache policy; the ephemeral store can lock everyone out for seven days once its cap is hit). The rest are low-severity correctness nits and one inaccurate claim in WO063. Physical-device audibility, Safari behaviour and frame times remain unverified here, as the work order expected.

## Findings, ranked

| # | Severity | Area | Where | Reproducer |
| --- | --- | --- | --- | --- |
| M1 | Medium | Catalog/runtime consistency, artwork gate hypothesis | `src/server/app.ts:269-281` | `server-static-cache.test.ts` |
| M2 | Medium | Ephemeral isolation / availability | `src/server/db/memory-store.ts:218-232`, `src/server/security.ts:8` | `server-capacity.test.ts` |
| L1 | Low | Stale client → 5xx | `src/server/app.ts:203`, `src/shared/adventure.ts:254`, `src/server/errors.ts:14` | `server-stale-client.test.ts` |
| L2 | Low | Attack timing after harming a friend (v3) | `src/shared/friendly.ts:240,263`, `src/shared/adventure.ts:336-340,392-395` | `server-reducer.test.ts` |
| L3 | Low | Audio source budget leak | `src/client/audio.ts:500-511` | `audio-source-leak.test.ts` |
| L4 | Low | Celebration cue gate never retried | `src/client/GameScreen.tsx:448-458` | `audio-celebration-gate.test.tsx` |
| L5 | Low | Volume 0 reports ready/played | `src/client/audio.ts:291-304`, `GameScreen.tsx:540-547` | `audio-silent-ready.test.ts` |
| L6 | Low | Phantom guard cooldown in v3 view | `src/shared/adventure.ts:534` | `server-reducer.test.ts` |
| L7 | Low (latent) | Immutable cache on unhashed `/assets/*` names | `src/server/app.ts:395-397` | `server-static-cache.test.ts` |
| L8 | Low | Unauthenticated, unmetered fixture media route | `src/server/app.ts:143-147` | `server-ownership.test.ts` (observation) |
| N1–N4 | Note | Cosmetic / claim accuracy | see below | — |

### M1. Studio artwork and cues are served with no `Cache-Control` at all

`/studio/*` gets only the `.wav` content-type middleware and `serveStatic` (`app.ts:269-281`); the response carries `Last-Modified` and no freshness directive, so browsers apply heuristic freshness (typically 10% of the file's age) with no revalidation. Every runtime GLB and the four cue WAVs load from `/studio/assets/media/<asset>/<version>/…` (`src/game/scene-assets.ts:6-12`, `src/game/scene-catalog.ts:59-87`, `src/client/audio.ts:26-59`). WO063's statement "Studio media keeps its existing revalidation behavior" is inaccurate: there is no revalidation behaviour to keep. The versioned directories mitigate this as long as bytes never change under an existing version path; any same-path re-export (or a future manifest fetched at a fixed path) would stay stale on an iPad for weeks. Given PLAN007 explicitly lists a stale device client as the leading unexplained cause of Tom's artwork gate, the root HTML `no-store` fix should be paired with an explicit policy here (`no-cache` or `public, max-age=…, must-revalidate`; the paths are already version-addressed, so a long TTL is also defensible if the catalog process guarantees immutability). Observed headers: `content-type: model/gltf-binary`, `last-modified`, no `cache-control`, no `etag`.

### M2. The ephemeral store's caps become a seven-day lockout for everyone

Every `POST /api/playtest/start` mints a new preview and save (`app.ts:150-174`); nothing retires an owner's superseded runs. Capacity is reclaimed only by `pruneOrphanedEphemeralRecords` (`memory-store.ts:218-226`), which frees records solely when the owner's session is gone, and the fixture cookie lives seven days (`security.ts:8`). With `maxSaves: 2` in the probe, the third start by the same owner and the first start by a *different* fresh cookie both return `503 STORE_CAPACITY`, and `maintainFixtureRecords` reclaims nothing (`{"sessionsDeleted":0,"previewsDeleted":0}`). In production the cap is 1000 saves: one household pressing "Play from the beginning" / "Play again" a thousand times in a week (or a cookie-less loop at the 120/min issuance limit filling 1000 sessions in ~9 minutes) locks out every player until sessions expire or the pod restarts. Each failed start also strands its preview. A per-owner retention of the most recent N runs (or evicting the oldest save at the cap) removes the lockout without weakening the caps.

### L1. A stale client's checkbox selection becomes a 503 plus a diagnostic

In ephemeral mode `POST /api/saves` forces `planMode: 'route-memories'` (`app.ts:203`); `createRouteMemoryPlan` throws a bare `RangeError` for anything but exactly six memories (`adventure.ts:254`); `createAdventureForSave` only maps the catalog error (`domain.ts:173-178`); `asAppError` turns the rest into `503 SERVICE_UNAVAILABLE` (`errors.ts:14`) and emits `{"event":"api_request_failed","errorClass":"range-error","route":"/api/saves"}`. Reachable only from a tab still running the pre-PLAN007 client (root HTML is now `no-store`, so it cannot survive a reload) that deselects a picture on the old Setup page. Should be a 422 `INVALID_SELECTION`.

### L2. `attack-friendly` inverts the v3 attack cooldown

`reduceFriendlyAction` writes `attackReadyAtMs = now + 600` (`friendly.ts:263`, `ATTACK_COOLDOWN_MS`), while the v3 enemy attack bounds that deadline by `ROUTE_ATTACK_COOLDOWN_MS = 400` (`adventure.ts:392-395`). `boundedRemainingMs` (`adventure.ts:336-340`) treats a remainder above the bound as clock skew, so for the first 200 ms after harming a friend an enemy attack is accepted immediately, and from +200 ms to +600 ms the legitimate attack is refused (`ATTACK_COOLDOWN`). The view reports `attackCooldownRemainingMs: 0` during the free window, so the client would send it. Gameplay impact is negligible (harming a friend needs a confirmed dialog), but the reducer contract is wrong; the friendly path should use the plan's cooldown.

### L3. A failed `source.start()` leaks a source slot

`playCue` adds the `ActiveSource` to `this.sources` (`audio.ts:500`) before `source.start()` (`:501`); the catch block (`:503-511`) disconnects nodes but never deletes the entry, and `onended` cannot fire for a never-started node. Leaked entries keep their cue's priority, so once the four-slot budget holds leaked high-priority entries (`memory-collected`, `ability-unlocked`), lower-priority jump/attack/impact/landing cues are refused while `status().ready` stays `true`. Cleared by any `stopAll()` (modal, mute, background). Rated low because `start()` throwing on a fresh node is rare in practice; the fix is one `this.sources.delete(active)` in the catch.

### L4. The chapter/completion celebration is skipped for good if audio is not running at that instant

`GameScreen.tsx:448-458` calls `audition("ability-unlocked")` only when `status().contextState === "running"` inside an effect keyed on `[modalOpen, activeModal]`; it never re-runs when a later gesture unlocks audio. `audition()` itself resumes the context (`audio.ts:335-338`), so the guard is what suppresses it. In normal play the context is running (the child was touching the stick to walk into the major memory), so the window is narrow: an iOS interruption right before the pickup, or `resume()` still pending from the re-unlocking gesture. Low impact, but this is the only place the `ability-unlocked` cue plays in v3.

### L5. Volume 0 reports playable audio

`status().ready` (`audio.ts:291-304`) and `playCue` ignore `volume`; with the Help slider at 0 the master gain is 0 yet cues resolve `true`. The Help "Play a test sound" button forces `volume || 0.8` (`GameScreen.tsx:889`) so it is safe, but the header toggle (`GameScreen.tsx:540-547`) relabels to "Sound on" and replays a 0-gain confirmation. Suggest treating `volume === 0` as not ready or clamping on unmute.

### L6. Phantom `guardCooldownRemainingMs` in the v3 view

`toAdventureView` always emits `guardCooldownRemainingMs` from `guardReadyAtMs` bounded by 1500 (`adventure.ts:534`), which the v3 Bash also writes; after a Bash the view reports a 1000 ms *guard* cooldown in a mode where `guard` is rejected outright. Harmless today (the client only reads it in the non-route path) but misleading for any consumer.

### L7. `isHashedClientAsset` is broader than Vite's hash pattern

`app.ts:395-397` marks any `name-suffix.ext` with an 8+ character second segment immutable for a year: `memory-keepsake.glb`, `arrival-landmark.glb` would qualify. Latent, because only Vite-hashed bundles exist under `dist/client/assets` today; the first unhashed file added there would be pinned on devices for a year. Anchor the regex to Vite's 8-character base64url hash before the extension.

### L8. `GET /api/fixture-media/:memoryId` needs no session and takes no limiter slot

`app.ts:143-147`. Content is fictional SVG already published in `docs/`, so this is an unmetered LAN CPU sink rather than a data exposure; every other read takes `limiter.take`. Worth a limiter key for symmetry.

### Notes (cosmetic, no action required unless root wants them)

- **N1.** The chapter-two shortcut applies its nine attacks at `startedAt + n×400 ms` (`app.ts:432`), so the returned save's `updatedAt` and receipts lead the wall clock by 3.6 s. Verified harmless: `completeLevel` zeroes all cooldowns and the next real action is accepted (`server-chapter-media.test.ts`). The in-memory store also compares preview expiry with `new Date()` rather than the injected `now` (`memory-store.ts:82,98,124`); only a test-clock or wall-clock skew of 30+ minutes can surface that.
- **N2.** Jump and landing cues are emitted from `onStatus`, which is throttled to the 100 ms status interval of simulated time (`createGame.ts:37,417-422,932,1066`); attack feedback is forced immediately. The audio acknowledgement of a jump therefore lags up to one status interval; the visual stretch is immediate.
- **N3.** The objective panel (`styles.css:1869`) and boss health bar (`:1890`) sit above the canvas without `data-quest-ui` or `pointer-events: none`, so a tap on them neither jumps nor does anything else; the vignette and hints do pass taps through. Small dead zones, not a control conflict.
- **N4.** The Besties dizzy window is a client-side gate only (server accepts a forged `secondary-attack` during their routine, confirmed in `runtime-route.test.ts`). Pre-existing for the primary attack and documented in WO056; noted because DESIGN015 says Bash "shares Besties' dizzy window".

## Claims checked and confirmed

- **Fresh route, age zero jumps, contact pickups, minors do not age, major after boss advances 0 → 4** — `runtime-route.test.ts` "plays chapter one…": 14 authoritative actions (`collect-equipment ×2, recover-memory@-6.2, secondary-attack, attack, recover-memory@-12.2, …, recover-memory@-22.7`), both minors `revealed` and age still 0 after the boss, then age 4, `activeLevelIndex 1`, `exploring`, `child`, `['move','interact','jump']`, level-one memories consumed, scene rebuilt for `level-2-2024`, player reset to the start, zero request errors. Route `gentle-jump-v1`, period `block-party-v1`. No hit taken, no retry.
- **Direct Besties chapter to age 7** — chapter two starts at age 4 with only the attack tool, period `besties-obby-v1`; the run collects the level-two shield and memories, uses Bash only in the dizzy window (zero `guarded` refusals from the scripted player), takes one hit, completes at age 7 with `phase: complete`.
- **Attack/Bash gating on the Besties** — outside dizzy: `performAction` returns `false` with `guarded` (primary) and `guarded`+`kind: secondary`, no request sent.
- **400 ms authoritative cadence under a mashed button** — 24 taps over 450 ms: 2 accepted, 7 `cooldown`, 0 `busy`, exactly 2 requests, no server rejection.
- **Background time never becomes catch-up** — hidden for 10 s then visible: displacement < 0.05 m; two subsequent 50 ms frames move exactly 0.4 m at the route's 4 m/s.
- **Ownership/CSRF** — second session gets 404 on `GET /api/saves/:id`, `/media/:memoryId`, `POST /actions`; `/api/playtest/start` rejects missing Origin (403), wrong Origin (403), missing `X-Quest-Request` (403), no cookie (401); `/api/saves` returns `[]` while `GET /api/saves/:id` still serves the active run.
- **Session renewal** — an unknown signed cookie yields a new player id and new `HttpOnly` cookie; the old value appears nowhere in the response.
- **v3 reducer matrix** — major while exploring `ACTION_NOT_AVAILABLE`; major without minors `MEMORY_BUNDLE_INCOMPLETE`; level-two minor during level one `MEMORY_NOT_FOUND`; minors collectible in `memory-released`; `attack`/`take-hit` rejected in `memory-released`; `guard`/`consume-memory-bundle` rejected on v3; `secondary-attack` rejected on v2.
- **Media gating over HTTP** — minor before pickup 200 (`no-store`), major before boss 409 `MEDIA_LOCKED`, level-two memory during level one 409, unknown id 404.
- **v1/v2 preservation** — `createAdventurePlan` still yields `era-level-plan-v2` with `gentle-intro-v1` and age-0 abilities `['move','interact']`; a stored v2 record re-validates; the persistent `FixturePhotoSource(false)` still offers the legacy three pictures; `POST /api/playtest/start` is absent in persistent mode (existing `app.test.ts`).
- **Cache headers** — root shell `no-store`; hashed bundle `public, max-age=31536000, immutable`; `/api/*` responses `no-store` including 401/404.
- **Audio lifecycle (checked, OK)** — one tap's four gesture listeners produce exactly one `resume()` and one confirmation (`confirmationPromise` is set before the first await); page-hide vs pending resume loses the race correctly and re-suspends; `interrupted` clears `unlocked`; closed contexts drop buffers/loads; `audition()` works while paused and refuses while muted; `dispose()` during a pending load writes nothing; `quest-audio-v2` ignores the legacy key.
- **Catalog/runtime consistency** — the four cue SHA-256 values in `audio.ts` match `docs/assets/media/*/v001/cue.wav`; the six fixture SVG checksums and contact sheet pass `tests/server/fixture-catalog.test.ts`; 37 catalog cards, 54 thumbnails, the fixture entry is in the nav and inventory; `reloadRequired` is hard-disabled with fallback study geometry (`scene.ts:542`, `:417-471`) — verified by reading only, the scene is mocked in every probe.
- **Movement 4 m/s, bounded slices** — `foregroundSimulationSteps` (0.2 s cap, 0.05 s steps) plus `tuning.moveSpeed = 4` only on route-memory courses.

## Tests actually run

All from this worktree at `b11f97a` with `pnpm install --frozen-lockfile --offline --ignore-scripts` (no package changes):

| Command | Result |
| --- | --- |
| `node_modules/.bin/tsc --noEmit` | pass (also with the 13 probe files present) |
| `node_modules/.bin/eslint src tests --max-warnings 0` | pass; probes lint clean |
| `node_modules/.bin/vitest run` (baseline) | 313 passed, 10 skipped (Postgres), **2 failed** = the known stale assertions in `tests/game/runtime.test.ts` (bounded step now 0.62 m at 4 m/s) and `tests/game/runtime-obby.test.ts` (artwork gate removed); excluded per the work order |
| `node_modules/.bin/vitest run tests/review/068-probes` | 31 tests: 20 pass (checks), **11 fail by design** = the reproducers for M1, M2, L1, L2 (two assertions), L3, L4, L5, L6, L7 and N1; runtime file 5/5 pass in ~4 s |

The probe files stay on this branch as evidence; they are not proposed for merge as-is (the failing ones should flip to passing when root fixes the item, or be dropped).

## Limitations

- No browser, Playwright, WebKit, physical iPad/iPhone, speaker or frame-time evidence; the scene (`GardenScene`) is mocked in every runtime probe, so foliage visibility, artwork fallback geometry, attack animation and touch stacking were verified only by reading.
- No Postgres (`QUEST_TEST_DATABASE_URL` unset; 10 integration tests skipped) and no MkDocs strict build (module absent offline); catalog checks are file-level.
- No deployed-host header checks; M1 describes the app's own behaviour and ignores whatever the ingress may add.
- Root's WO066 browser lane and its updated runtime tests were not read or reconciled.

## Probe inventory

`tests/review/068-probes/`: `runtime-route.test.ts` (reviewer; real app + real reducer/enemies/Besties, mocked scene), `server-*.test.ts` + `helpers.ts` (Opus server lane), `audio-*.test.ts(x)` + `fakes.ts` (Opus audio lane). Run one with `node_modules/.bin/vitest run tests/review/068-probes/<file>`; each failing probe prints an `OBSERVED …` line with the raw values.
