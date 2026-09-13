# WO083 results: Controls and recovery adversarial review

Reviewer: separate Claude Opus 5 (`claude-opus-5`, effort `xhigh`) via `agent-run`, task
`haynes-quest-0912-222128`, worktree `/home/dev/work/haynes-quest-0912-222128`, branch
`agent/haynes-quest-0912-222128` reset to the exact inspected commit.

Inspected commit: **`e278f41`** ("game: raise memory and boss terraces with supported approaches").
Compared against merged base `8b3a24d` for the whole PLAN011 range
(`9e7eedb 6d2c2aa 6dd2ee2 c283c20 e56375d 80f0f93 ab9d1f9 1417fd9 9d2dcbf e278f41`).

No source, docs, infrastructure or lead-worktree file was changed by this review (this results
file only). No browser was started; no private media was touched.

## Verdict

`pnpm typecheck`, `pnpm lint` and `pnpm build` pass. **`pnpm test` fails: 8 tests in 5 files.**
CI runs `pnpm test` (`.github/workflows/app.yml:36`), so this commit cannot merge as it stands.
Beyond the red suite, five behaviour findings are proven by minimal reproductions, the most
serious being a defeat-recovery dead end with no timeout and no reachable control.

Severity key: **High** = blocks merge or can strand the player; **Medium** = wrong behaviour a
playtester will hit; **Low** = correctness/hygiene with limited player impact.

---

## F1 — High (proven): the integrated suite is red, and the archived-route boss gate lost its coverage

`pnpm test` at `e278f41`: `Test Files 5 failed | 46 passed | 1 skipped (52)`, `Tests 8 failed |
464 passed | 11 skipped (483)`.

Minimal reproduction:

```bash
git -C <worktree> reset --hard e278f41
pnpm install --offline --frozen-lockfile
pnpm test          # exit 1
```

Two independent root causes, both introduced inside this range:

**(a) `1417fd9` bumped the default catalog without updating its dependants.**
`src/shared/parody-catalog.ts:12` now reads `PARODY_CATALOG_VERSION = "parody-catalog-v5"`, and
`src/shared/parody-selection.ts:113-119` maps v5 to the **v2** routes. Every new save therefore
selects `garden-playground-v2` / `besties-playground-v2`. Five expectations were left behind:

| Failing assertion | Expected → actual |
| --- | --- |
| `tests/server/parody-selection.test.ts:220` | `parody-catalog-v4` → `parody-catalog-v5` |
| `tests/server/parody-selection.test.ts:141` | `garden-playground-v1` → `garden-playground-v2` |
| `tests/server/route-memory.test.ts:142` | `parody-catalog-v4` → `parody-catalog-v5` |
| `tests/server/adventure.test.ts:153` | `catalog: parody-catalog-v4` → `parody-catalog-v5` |
| `tests/server/app.test.ts:220` | fresh Besties boss `available: false` → `true` |

**(b) The same bump silently neutered the Besties lane's own new negative assertion.**
`tests/server/route-memory.test.ts:195` — "allows a v2 playground boss attack with ordinary
encounters remaining while v1 stays gated" — builds its "legacy" arm with the helper
`routePlan()` (`tests/server/route-memory.test.ts:40`), which uses the *default* catalog. After
`1417fd9` that helper returns a **v5 / `garden-playground-v2`** plan, so the arm that is supposed
to prove `available: false` + `ENCOUNTER_NOT_ACTIVE` for an archived route now runs against an
unlocked route and fails. **Net effect: no server test still covers the frozen v1 gate that
DESIGN018 requires to stay in place.** Fix the arm by pinning
`createRouteMemoryPlan('2020-01-01', MEMORIES, 'parody-catalog-v4')` rather than by relaxing the
expectation.

I confirmed the *behaviour* is still correct, so this is lost coverage, not a broken gate
(probe `tests/review/083-probes/boss-availability.test.ts`):

```
parody-catalog-v4 -> garden-playground-v1, besties-playground-v1 ; boss.available = false ; attack throws ENCOUNTER_NOT_ACTIVE
parody-catalog-v5 -> garden-playground-v2, besties-playground-v2 ; boss.available = true  ; attack accepted
```

**(c) `c283c20` regressed two *unmodified* pre-existing regression tests.** The diff of
`tests/game/authored-runtime.test.ts` over this range contains additions only — no line was
removed — so both failures are behaviour changes against merged main:

- `tests/game/authored-runtime.test.ts:226` "keeps the visited checkpoint through same-level
  fallen and retry saves": expected `garden-start`, got `picnic-safe`. This is the deliberate
  DESIGN018 change (see **F3**); the test encodes the superseded PLAN007/PLAN008 contract and
  must be rewritten, not deleted, so the new rule stays pinned.
- `tests/game/authored-runtime.test.ts:177` "rebuilds when only the authoritative route identity
  changes": expected spawn `z: 1` / `checkpointId: null`, got `z: -17.5` /
  `checkpointId: "party-picnic-safe"`. Root cause is fixture shape, not runtime logic:
  `makeAuthoredSave` (`tests/game/authored-fixtures.ts:70-78,144-148`) marks the *incoming*
  chapter's `minor-one` as already `revealed`/recovered, so `memoryCheckpointForSave` legitimately
  resolves it on the identity change. A real chapter advance never carries a recovered minor of
  the new chapter, so the fixture — not DESIGN018's "old chapter memories must never select its
  checkpoint" rule — is what needs correcting.

---

## F2 — Medium-High (proven): a recovery request that never settles leaves the player with no control at all

Locations: `src/client/GameScreen.tsx:351-377` (auto-retry effect), `:1041-1051`
(`.checkpoint-return` overlay), `:480` (leave button `disabled={busy || requestBusy.current}`),
`src/client/styles.css:2884-2891` (`position: absolute; inset: 0; z-index: 25`, no
`pointer-events: none`), `src/client/api.ts:2-20` (`fetch` with **no timeout / AbortController**).

The effect refuses to schedule anything while `status?.requestBusy` is true (`:357`) and has no
timeout of its own; `recoveryRequested.current` is already set to the current
`save.id:save.revision`, so later re-runs only re-arm `recoveryBlocked` when
`status.requestState === "error"` (`:359-361`). If the retry POST is accepted but never resolves
— dropped Wi-Fi, a backgrounded phone, a stalled proxy — none of those three things happen.

Reproduction (`tests/review/083-probes/recovery-stuck.test.tsx`, jsdom): render at
`phase: "fallen"`, advance 650 ms so the retry dispatches, then report
`{ requestBusy: true, requestState: "acting" }` and advance 5 minutes:

```
overlay present: true
dialog present: false
buttons: [ 'Leave playtest [disabled]', 'Mute sound', 'Open your memories', 'How to play' ]
performAction calls: 1
```

The four header buttons are outside `.checkpoint-return` in the DOM, and the leave button is
additionally disabled. The only escape is a page reload — and for the ephemeral private playtest
a reload starts a brand-new save, i.e. exactly the "restarted after death" complaint PLAN011
exists to remove. Before this change the fallen modal always offered both "Try this level again"
and "Play again"/"Save & leave".

Proven by the probe: the overlay stays, no dialog appears, no further request is made, and the
leave button is disabled. **Hypothesis (not browser-verified, per the read-only scope):** the
overlay also visually covers and pointer-blocks the header, because `.game-header`
(`styles.css:867-876`) is positioned with no `z-index` and is painted before a later sibling at
`z-index: 25`. jsdom performs no layout or hit testing, so please confirm that part in Safari.

Suggested shape of a fix (Astra's call): a bounded wait (e.g. 8–10 s) after which the overlay
degrades to the existing `recoveryBlocked` modal, plus `pointer-events: none` on the overlay or a
`z-index` on the header so Help/Leave stay reachable.

---

## F3 — Medium (proven): defeat discards the visited local checkpoint on exactly the levels the child plays

`src/game/createGame.ts:599-612` adds `&& !routeMemoryLevel` to the "prefer the last actually
visited safe checkpoint" branch, and `src/game/level.ts:316-321` short-circuits
`checkpointForSave` to the minor-memory checkpoint for any level with `minorMemoryIds`. For
route-memory levels the retry therefore ignores every checkpoint the player actually reached.

Reproduction (`tests/review/083-probes/defeat-checkpoint.test.ts`): `garden-playground-v1`,
`minor-one` collected, session started standing on the boss-side `dragon-clearing`:

```
armed checkpoint: dragon-safe        position: { x: 0, y: 0, z: -90.5 }
after retry:      picnic-safe        position: { x: 0, y: 0, z: -16.8 }
```

**73.7 m and six intervening checkpoints are lost on one defeat.** Even with both minors
collected the gap stays large — garden `grove-safe` z −59 → dragon clearing z −90.5 (31.5 m);
besties `party-grove-safe` z −68 → `besties-court` z −103 (35 m). Since the boss is the most
likely place to die, this is the common case, and it reproduces the "starting over" feeling the
plan set out to fix.

This *is* DESIGN018 as written ("return to the safe point associated with the furthest collected
minor memory"), so the ruling is Astra's, not a code bug — but the design and the code currently
discard information the runtime already has. A `max(memoryCheckpoint, visitedCheckpoint)` by
route order would satisfy both DESIGN018's floor and the forgiveness goal.

Definite defect in the same place: `src/game/level.ts:331-332` still says "Session retries prefer
the last actually visited safe checkpoint in createGame", which is now false for every
route-memory level. Stale comments in checkpoint code are how the next lane reintroduces the old
behaviour.

---

## F4 — Medium (proven): the boss health bar is shown from the chapter spawn on the new routes

`src/client/GameScreen.tsx:579-595` replaced the `ordinaryLeft === 0` gate with
`boss.available !== false && view.phase === "exploring" && status?.bestiesPhase !== "inactive"`.
On a v2 route the server reports `available: true` immediately (`src/shared/adventure.ts:731-757`),
and on the garden route there is no Besties encounter, so `status.bestiesPhase` is `undefined`
(`src/game/createGame.ts:428`) and `undefined !== "inactive"` is true.

Reproduction (`tests/review/083-probes/boss-hud.test.tsx`):

```
bossAvailable=true   boss-hud rendered=true   "The Buffer Baron 8 / 8"
bossAvailable=false  boss-hud rendered=false
```

So a child standing on the welcome platform of `garden-playground-v2` sees a full boss health bar
for the entire course. The Besties route is unaffected (`bestiesPhase === "inactive"` until she
nears the arena). Gate it on proximity/engagement rather than server availability — the visible
presentation decision is Astra's.

---

## F5 — Medium (proven): any `resize` kills a held movement stick until the finger is lifted

New listeners: `src/client/GameScreen.tsx:1238` (`Joystick` → `clear`, which sets
`pointer.current = undefined`) and `src/game/input.ts:290` (`bindBrowserInput` → `clearAll`).
After `clear()`, `onPointerMove` (`GameScreen.tsx:1296-1299`) drops every event for the still-held
`pointerId`, and `onPointerUp`/`onLostPointerCapture` are no-ops because the id no longer matches.

Reproduction (`tests/review/083-probes/joystick-resize.test.tsx`):

```
moveX after press + move:                       [ 'moveX', 0.5547 ]
setInput on resize:                             [ ['moveX', 0], ['moveY', 0] ]
setInput for the still-held finger after resize: []          <-- stick dead
after lift + re-press:                          [ 'moveX', -0.7071 ]
```

DESIGN018 asks for cleanup on "cancellation, blur, pause and rotation". `resize` is broader than
rotation: on iOS Safari it also fires for visual-viewport/toolbar changes, and on desktop it
fires continuously while a window is dragged. The stale-bounds problem the listener targets is
better solved by recomputing `origin.current` / `travel.current` from a fresh
`getBoundingClientRect()` and keeping the captured pointer, rather than dropping it. There is no
test for either new `resize` listener (`grep -rn resize tests/` matches only `tests/e2e/studio.mjs`),
so the "orientation cleanup" contract item is currently unproven either way.

---

## F6 — Low-Medium (proven): a refused retry dispatch shows the failure modal with no error

`src/client/GameScreen.tsx:363-366` treats a falsy `performAction` return as failure and sets
`recoveryBlocked`, but nothing calls `setError`, so the modal (`:1016-1040`) renders with an empty
`notice`. `ActionCoordinator.perform` returns `false` for a busy coordinator or a client/server
phase mismatch without recording any error (`src/game/actions.ts:106`), and
`createGame.performAction` returns `false` for `retry-level` when its own `save` is not yet
`fallen` (`src/game/createGame.ts:843-844`).

Reproduction (`tests/review/083-probes/recovery-stuck.test.tsx`, second case, `performAction`
stubbed to `false`):

```
dialog text: LET'S TRY AGAIN / Your adventure is safe / We couldn't return you to your checkpoint yet. / Return to checkpoint
```

DESIGN018 requires "offer a single retry action with **the actual error**". The manual button does
work, so the player is not stranded — but the cause is invisible, which will make a real field
failure unreportable. `tests/game/game-screen-memory-notice.test.tsx:159` mocks
`performAction: vi.fn(() => true)`, so this branch has no coverage at all; the existing failure
test drives `requestState: "error"` instead, which is the *other* path.

---

## F7 — Low (proven): `scripts/levels/validate.ts` now exits 1

`scripts/levels/validate.ts:5-11` was changed in this range to validate all four documents by
default, but `src/shared/authored-level.ts:7-8` still pins `authored-level-v1` and the v1 route ids:

```
$ npx tsx scripts/levels/validate.ts        # exit 1
garden-playground-v1: valid ... 8 checkpoints
besties-playground-v1: valid ... 8 checkpoints
garden-playground-v2: Authored level is invalid: $.connections[0..6]: Unrecognized key:
  "safeMissPlatformId"; $.id: Invalid option: expected one of "garden-playground-v1"|
  "besties-playground-v1"; $.schemaVersion: Invalid input: expected "authored-level-v1"
besties-playground-v2: (same)
```

This is the downstream face of the known height-lane staging dependency, not a fresh design
defect — recorded only because the validator change landed **here** while the schema did not, and
DESIGN017 documents the command for authors (`docs/designs/017-daughter-playgrounds.md:37`). It is
not wired into CI. Sequence the merge so the schema lands with, or before, this validator change.

---

## F8 — Low (proven): DESIGN018 is not reachable from the docs navigation

`docs/designs/018-familiar-touch-and-recovery.md` is absent from `mkdocs.yml` (nav ends at
`designs/017-daughter-playgrounds.md`, line 59) and from the `Designs` row of `docs/README.md`.
Its only inbound repository link is `.agents/work-orders/082-familiar-controls.md:27`. Because
`mkdocs.yml:118-123` configures `validation.links` but not `validation.nav`, an omitted file stays
at MkDocs' default `info` level, so `--strict` will **not** fail on it — the page is simply
invisible in the sidebar. The work order states root is still adding docs, so this is a reminder,
not a surprise.

---

## Coverage gaps — no defect proven, but the claims do not hold up

- **C1. The new memory-checkpoint feature is inert on the routes the default catalog now selects.**
  `authoredRoute()` (`src/game/authored-layout.ts:11-27`) registers v1 documents only, so for a
  v2 route `authoredLevelLayout` returns `null`, `createLevelLayout` falls through to the
  procedural branch, and `createObbyCourse` (`src/game/obby-layout.ts:71-94`) returns the
  `gentle-jump`-style five-island / 27 m course. With `level.authored` undefined,
  `memoryCheckpointForSave` returns `null` at its first guard (`src/game/level.ts:281-288`), so
  `checkpointForSave` falls back to the *old* encounter-based ids (`start` / `second-clearing` /
  `boss-landing`). Every checkpoint test in `tests/game/memory-checkpoint.test.ts` and
  `tests/game/authored-runtime.test.ts` runs on v1 routes. The defeat-recovery behaviour on the
  route a fresh playtest actually gets is therefore **untested and different**, and must be
  re-verified after the height lane registers the v2 documents. (Root cause is the excluded
  staging dependency; the *coverage* consequence is what needs tracking.)
- **C2. The v2 boss unlock has no runtime coverage.** The only proofs are the unit test
  `tests/game/combat.test.ts:210-227` (route ids hand-written onto a fixture) and the server test
  broken in F1(b). The twelve new `it.each` cases at `tests/game/runtime-obby.test.ts:1141` build
  their save through `bestiesRoutedSave` (`:263-273`), which passes
  `defeatedIds: [ordinary-a, ordinary-b]` — every ordinary is already dead, so the boss would be
  active under the *old* gate too. They prove "both attacks damage in all six phases" (which they
  do, cleanly) but not WO082's "an ordinary left behind". `authored-runtime.test.ts:465` (second
  runtime) and `:518` (death retry) likewise run on `besties-playground-v1`.
- **C3. DESIGN018's "exactly one validated safe checkpoint per minor-memory platform" is not
  enforced anywhere.** `memoryCheckpointForSave` silently returns `null` when
  `matches.length !== 1` (`src/game/level.ts:302`), and
  `tests/game/memory-checkpoint.test.ts:204` pins that silent fallback rather than rejecting a
  bad document. `scripts/levels/validate.ts` does not check the invariant. I verified both
  registered documents satisfy it today (probe `tests/review/083-probes/checkpoint-invariant.test.ts`):
  garden `picnic → picnic-safe`, `memory-grove → grove-safe`; besties
  `party-picnic → party-picnic-safe`, `party-grove → party-grove-safe`, one match each. The v2
  documents cannot be checked yet (F7). When the height lane adds the invariant, make it a
  *validator rejection*, because the runtime's silent `null` degrades a forgiving checkpoint into
  a full chapter restart with no diagnostic.
- **C4. No coverage of either new `resize` listener** (F5) or of the refused-dispatch retry branch
  (F6).

## Claims from the work order, re-checked

| Claim | Result |
| --- | --- |
| "Root's focused input/UI suite passes 26 tests" | **True.** `input.test.ts` 11 + `game-screen-feedback.test.tsx` 11 + `game-screen-memory-notice.test.tsx` 4 = 26, all passing. |
| "native checkpoint suite passes seven" | **True.** `tests/game/memory-checkpoint.test.ts` = 7 passing. |
| "the Besties implementation lane passed focused phase/reset/availability tests" | **Not true at this commit.** The phase/reset tests pass, but the lane's own availability test (`tests/server/route-memory.test.ts:195`) fails — see F1(b). |
| "No central attack prose" | **True.** `bestiesInstructions`, `era-objective`, `target-hint` and `attack-notice` are all gone; 10 consecutive `no-target` feedbacks render no prose and no dialog (`game-screen-memory-notice.test.tsx:186`). |
| "Both attacks damage Besties across all six routine phases" | **True.** No `vulnerable` gate survives in gameplay: `grep -n vulnerable src/game/*.ts src/client/*.tsx` leaves only `besties.ts:341` (the flag), `besties-scene.ts:203,237` (stars) and `createGame.ts:257` (the reported visual `cooldown` phase). Readiness (`createGame.ts:447,457`) and dispatch (`:784,:798`) no longer consult it. |
| "Activation uses actor-relative inclusive height" | **True and consistent.** `nearBesties` uses `Math.abs(controller.y - actor.y) <= 1` (`createGame.ts:179-181`); `findAttackTarget` uses `verticalDistance > 1 → reject` (`combat.ts:459`); both resolve the Besties to the nearest actor (`attackTargetFrames`, `createGame.ts:342-351`). |
| "Scenery taps no longer jump / Space still jumps" | **True.** The tap-to-jump branch is removed from `stopPointer` (`input.ts:271-276`); `buttonForCode.Space = "jump"` (`input.ts:22`); covered by `input.test.ts:280-330`. |
| "Jump never depends on age or equipment" | **True.** The Jump `ActionButton` has no `disabled` prop (`GameScreen.tsx:605-621`) and the frame loop passes `canJump: true` unconditionally (`createGame.ts:1027`). |
| "Each press queues one jump" | **True**, and strictly one — `consumeActions` already delivers an edge and `obby.ts:745-747` enforces `pressEdge`. Note for Astra: **holding** the Jump button therefore does *not* re-jump on landing, unlike Roblox's mobile Jump button. That is DESIGN018 as written; flagging it only because "familiar to a Roblox player" is the stated goal. |
| "Existing server retry restores health, retains gear/memories/beaten encounters, resets undefeated encounters" | **True**, covered by `tests/server/route-memory.test.ts:291-360` (passes). |
| "Automatic retry after 650 ms, one request, bounded manual retry, unmount cleanup" | **True for the happy path and for the `requestState: "error"` path** (4 tests, passing). Not true for a never-settling request (F2) or a refused dispatch (F6). |

## Tested scope and explicit limits

Ran, in the review worktree at `e278f41`:

```bash
pnpm install --offline --frozen-lockfile   # ok
pnpm typecheck                             # ok
pnpm lint                                  # ok (eslint src tests --max-warnings 0)
pnpm test                                  # FAIL: 8 tests / 5 files
pnpm build                                 # ok (vite + tsup)
npx tsx scripts/levels/validate.ts         # FAIL: exit 1 (F7)
python3 scripts/docs/prepare.py            # ok, 1050 files
python3 scripts/docs/check_links.py .docs-build   # ok, 190 files + local media
npx vitest run tests/review/083-probes/... # 5 probe files, 8 assertions
```

Limits:

- **No browser, by instruction.** Every layout/stacking/orientation statement is read from
  `src/client/styles.css` and reproduced in jsdom, which does no layout or hit testing. Requests
  for root: (1) confirm in Safari that `.checkpoint-return` visually covers and pointer-blocks
  `.game-header` (F2); (2) confirm on a real iPhone whether the 6-year-old's thumb resting near
  the toolbar triggers `resize` often enough for F5 to bite; (3) capture portrait/landscape phone
  and tablet screenshots of the new cluster — I verified arithmetically that at 320/390/600/956 px
  the stick and the three buttons neither overlap nor overflow `.game-bottom`, but not visually.
- **MkDocs itself was not run**: `python3 -m mkdocs` reports "No module named mkdocs" and the
  pinned install needs network the pod denies. Only `prepare.py` and `check_links.py` ran; the
  `--strict` build is unverified here. The F8 conclusion (an omitted nav file is `info`, not a
  strict failure) is read from `mkdocs.yml:118-123` plus MkDocs' documented default.
- **No Postgres**: `QUEST_TEST_DATABASE_URL` was not set, so 11 tests skipped (the same 11 skip on
  the base commit; none of the 8 failures are in that set).
- **The known height-lane staging dependency was not reported as a fresh defect.** F7 and C1 record
  only its consequences for checks and coverage at this exact commit. I did not attempt to
  register or repair the v2 documents.
- **No physical-device, hosted, audio or visual-quality judgement** is offered; none was in scope.
- I did not review the 1 638 new lines of v2 route JSON for geometry correctness — that belongs to
  the height lane's schema and validators, which do not exist yet (F7).

Probe sources are committed as `0ba9044` on pushed branch `agent/haynes-quest-0912-222128` (parent `e278f41`) under
`tests/review/083-probes/` (`boss-availability`, `checkpoint-invariant`, `defeat-checkpoint`,
`recovery-stuck`, `boss-hud`, `joystick-resize`). They are review evidence, not proposed tests —
no PR was opened, per this work order.

## Suggested order of work

1. Fix F1 before anything else; CI gates the branch. Pin `parody-catalog-v4` in the route-memory
   negative arm (F1b) rather than relaxing it, and rewrite — do not delete — the two
   `authored-runtime` regressions (F1c).
2. Rule on F3 (recovery distance) and F4 (boss HUD), since both are visible to the playtester and
   both are Astra's presentation/gameplay calls; fix the stale comment at `level.ts:331-332` either way.
3. F2 and F5 are mechanical and independent of the height lane.
4. F6, F7, F8 and the C1–C4 coverage gaps can ride along with the height-lane integration, but C1
   must not be closed by assertion — the v2 routes need their own checkpoint and boss-unlock runs
   once they are registered.
