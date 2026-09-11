# WO056 results: Fable 5.1 adversarial review of the PLAN006 checkpoint

- **Status:** Review complete; findings for root resolution. No product file changed, no commit, no PR, no browser, no deploy, no dev-env restart, no OAuth.
- **Model / dispatch:** `claude-fable-5-1`, effort `xhigh`, via `agent-run` (task `haynes-quest-0911-190446`).
- **Reviewed commit:** `3ba5a0ccb0e1c36b13f9cd84546706d48c5093d2` "Integrate touch combat, Besties and friendly residents with review catalog", fast-forwarded from main `698c9c7` onto branch `agent/haynes-quest-0911-190446`.
- **Worktree:** `/home/dev/work/haynes-quest-0911-190446` (own; dependencies installed offline from the pnpm store in 0.8 s).
- **Evidence:** logs under `/tmp/fable-056/` (`typecheck.log`, `vitest-full.log`, `eslint.log`, `vite-build.log`, `prettier.log`); probe tests under `tests/review/056-probes/` in this worktree (uncommitted, review artifacts only).

## Checks actually run on 3ba5a0c

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `node_modules/.bin/tsc --noEmit` | passed |
| Lint (CI scope) | `node_modules/.bin/eslint src tests --max-warnings 0` | passed |
| Unit/integration | `node_modules/.bin/vitest run` | 34 files passed, 1 skipped; **264 tests passed, 10 skipped** (all 10 are the Postgres suite; `QUEST_TEST_DATABASE_URL` unset here, as in every lane so far) |
| Client build | `node_modules/.bin/vite build` | passed; emits `dist/client/assets/index-DROwbqTs.js`, 1,027,473 bytes, SHA256 `49a4acdb670a05eb3775aeab647839bf2d67b3038021a1d601de6dfc921eed58` |
| Whitespace | `git diff --check 698c9c7..HEAD` | one hit: `scripts/assets/bickering-besties/common.py:140` new blank line at EOF (not CI-enforced) |
| Prettier | `prettier --check .` | 354 files flagged repo-wide; not part of CI (`app.yml` runs typecheck/lint/test/build only), so informational |
| Asset hashes | `sha256sum` | Pink GLB 956,924 B `0f7020f5…aea96ae`, Black GLB 928,000 B `0819c67a…e898d80f05`, concept PNG `1fb8f525…ffdb40beaa0aee1` all match WO057/HANDOFF/review page; `tests/game/playtest-artwork-contract.test.ts` pins all 23 runtime GLBs and 4 cues to the inventory and passes |
| WO056 probes | `node_modules/.bin/vitest run tests/review/056-probes` | 4 files, **13 tests passed** (details per finding below) |

Not run: MkDocs strict docs build (pip/uvx packages unavailable offline in this pod), Postgres suite (no test database), any browser or physical-device journey (Sol holds the browser lease), audio listening.

## Findings, most severe first

### F1 — Medium · delivery claim: the "final current client" bundle is not the reviewed commit's bundle, and the lead tree has already drifted past it

- **Where:** `.agents/work-orders/057-plan006-integration.md:20` and `.agents/HANDOFF.md:5` name `index-BwiNr1P8.js` (SHA256 `4af858ba…`) as the final client under WO055 test.
- **Evidence:** a clean `vite build` of 3ba5a0c yields `index-DROwbqTs.js` (`49a4acdb…`). The lead worktree at the same HEAD has **uncommitted** changes (`src/game/combat.ts` +7/-1 adding a second windup trigger when the arena edge blocks the close approach, `tests/game/combat.test.ts`, `docs/assets/playtest.md`, WO057, HANDOFF, plus two untracked e2e files) and its own `dist/` holds a third bundle, `index-Du0GDcj6.js` (`bce16cfc…`). None of the three hashes agree.
- **Impact:** WO055's "final-bundle" touch/audio/friendly/dragon results and the hash in the handoff cannot be tied to any commit. This review covers 3ba5a0c only; the combat behaviour in F2 is being edited concurrently and must be re-reviewed after commit.
- **Ask:** commit the drift, rebuild, record the hash that the released image will actually carry, and re-run the focused WO055 checks against that commit.

### F2 — Medium · property 2: the Prism wand out-ranges the dragon by 2 m, so the "visible retaliation" only holds in a 25 cm band; a child who steps back or kites kills it unanswered

- **Where:** `src/game/combat.ts:60-61` (boss stop 2.1 m, strike 2.25 m), `:105-113` (`canReachPlayer` uses `attackRange`), `:254-263` (idle/chasing gate on `playerReachable`), `:408` (wand 4.25 m). Arena clamps the dragon to z ≤ -21; the boss island starts at z = -18.5 (`src/game/obby-layout.ts:79`), the ferry dock reaches z ≈ -17.9.
- **Confirmed by** `tests/review/056-probes/wand-outranges-dragon.test.ts` (4 tests):
  - z = -19 (resume checkpoint): dragon reaches 2.1 m, strikes, contact registered (matches WO049's test).
  - z = -18.6 (still on the boss island): 30 s simulated, zero contacts, dragon never leaves `idle` at spawn, while `findAttackTarget` returns the boss at 3.4 m for the wand.
  - Kiting: approach to -19 (dragon parks at z = -21.1), then back off to the ferry dock z = -17.6: dragon drops windup→chasing→idle within two frames and stays idle for 30 s **without returning to spawn**; wand still targets it at 3.5 m.
  - Mallet-only save (chapter-one tool, chapter-two wand not collected): the dragon still hits, but the mallet (boss reach 2.0 m) cannot answer from the checkpoint until the player steps 0.2 m forward. No softlock, but the "Move closer" notice is the only cue.
- **Impact:** the dragon's threat zone is z ≤ -18.75; the wand's is z ≥ -25.35 from the centre. Any position in (-18.75, -17.5] is free damage against a boss that visibly gives up. For the age-six brief this is forgiving rather than broken, but it contradicts PLAN006 §1 ("see hits and retaliation") and Tom's complaint that the dragon paces without attacking: from 25 cm behind the resume point it still does. The lead's uncommitted combat edit addresses the approach-vs-clamp case at the checkpoint, not this reach mismatch.
- **Options for root (not prescribed):** compute `canReachPlayer` against the equipped weapon's range rather than the boss strike range, let the boss leave the island to the landing, or extend its reach; keep the arena/gap constraints.

### F3 — Low · property 3: the same strip is a safe attack position against the Besties

- **Where:** `src/game/createGame.ts:744` activates the routine for z < -17.5; hazards reach z ≥ -18.75 (pink bar, `src/game/besties.ts` `pinkSweepFrom/foamHalfExtents` + 0.3 radius) and z ≥ -18.7 (black lane).
- **Confirmed by** `tests/review/056-probes/besties-runtime-contact.test.ts` third case: player parked at z ≈ -18.6 through a full 13 s cycle receives zero `take-hit` commands, `attackReady` becomes true in `dizzy`, and one authoritative `attack` is dispatched.
- **Impact:** with the wand (4.25 m from the arena centre at z = -22, i.e. z ≥ -17.75) the whole strip (-18.75, -17.75] hits without risk. Cosmetically fine for a six-year-old; note it as intended forgiveness or close it together with F2.

### F4 — Low · property 7: `docs/assets/playtest.md` at this commit contradicts the code and the catalog

- **Where:** `docs/assets/playtest.md:17` ("Four completed character candidates"), `:19` ("Sound is currently off while the sound candidates await listening review"), `:34-41` (cast table with the returning Drama Dragon, "All four use…"). Last touched in `9ccc7a8`. Meanwhile `docs/assets/catalog.md` and `scripts/assets/catalog-inventory.json` describe the Besties and the six residents as "in the PLAN006 playtest" and `src/client/audio.ts` wires four cues.
- **Impact:** the mandatory same-PR catalog rule (AGENTS.md) is not met at the reviewed commit; the page Tom is pointed to for "what is in the playtest" describes the old scope. The lead's uncommitted edits touch this file (59 lines), so this is likely already in flight; it must land in the same PR.

### F5 — Low · property 4: a friend dialog opened while airborne is a silent dead end

- **Where:** `src/game/createGame.ts:204` (`nearestFriendlyId` returns null unless grounded) and `:517` (`performAction` rejects friendly actions unless the friend is currently nearest); the world stops stepping while paused, so `grounded` never becomes true again until the dialog closes.
- **Confirmed by** `tests/review/056-probes/friendly-airborne-dialog.test.ts`: near a friend, tap Jump, pause within the 100 ms status tick (the prompt is still on screen), `performAction` for both `interact-friendly` and `attack-friendly` returns false with no `attackFeedback`, no `requestErrorCode`, and remains false for 2 s of dialog time.
- **Impact:** "Say hello" / "Make amends" / "Attack anyway" do nothing until the child closes and reopens the dialog. Narrow window on touch, easier with keyboard (Space then E). Fix options: capture the friend id at dialog-open time and skip the grounded gate while paused, or surface a message.

### F6 — Low · property 3 coherence: fall recovery re-telegraphs enemies but resumes a Besties trick mid-swing

- **Where:** `src/game/createGame.ts:669-673` calls `enemies.restartThreatenedAttacks()` on recovery; the Besties routine only gets `paused: controller.recoveryRemaining > 0` (`:746`) and continues from the frozen phase progress.
- **By reading (PLAUSIBLE, no probe):** a player who falls during `pink-trick` recovers onto the boss-landing checkpoint (0, 0, -19), which is inside the bar's z range, and the bar resumes from wherever it froze, so a contact can register within a fraction of a second of regaining control with no fresh 1.2 s warning. Generic enemies do not do this. Consider restarting the current trick's warning on recovery.

### F7 — Low · property 3 feedback: the wand beam and impact flash terminate at the invisible centre between the two Besties

- **Where:** `src/game/createGame.ts` `enemyFrames()` overrides the logical enemy position to `BESTIES_ARENA_CENTER` (0, 0, -22); `src/game/scene.ts:580-586` aims the spell at that frame position. Actors stand at x = ±1.25 (`src/game/besties.ts` actor offsets).
- **Impact:** every accepted wand hit on the Besties draws a beam into empty air 1.25 m from either character. Visual only; the health bar and hit clips still react. Aim at the nearer actor (or the active/dizzy pair midpoint on the actor line) for readable feedback.

### F8 — Low · property 6 latent trap: the duo renderer ignores the matched entry's `assetVersion`

- **Where:** `src/game/scene-catalog.ts:52-64` returns hard-coded `bestie-pink/v001` and `bestie-black/v001` URLs for any `bickering-besties` entry that matches. Today the only entry is `bickering-besties@v001`, and `tests/review/033-frozen-content-resolution.test.ts` proves unknown identities return null, so current behaviour is safe.
- **Impact:** a future `bickering-besties@v002` catalog entry would silently render v001 actors. Derive the URLs from `entry.assetVersion` or add a version map.

### F9 — Info · property 5: audio unlock is only wired to `pointerdown` and `keydown`

- **Where:** `src/client/GameScreen.tsx:174-178`.
- **By reading (PLAUSIBLE):** the HTML "activation-triggering input events" are keydown, mousedown, `pointerdown` only for `pointerType === "mouse"`, `pointerup` for other pointer types, and `touchend`. A touch `pointerdown` handler therefore runs without transient activation under the spec model; whether WebKit still honours `AudioContext.resume()` there is exactly the physical-Safari check that is already listed as open. Adding `pointerup`/`touchend`/`click` listeners to the same `start()` call is a cheap belt-and-braces change; `QuestAudio.start()` is idempotent when already running.
- **Verified as correct by reading:** same-origin check with `redirect: "error"`, four-source cap with priority eviction, per-cue instance caps, `visibilitychange` suspend, `setPreferences` mute stops transients and persists, disposal blocks revival, shared pending decode with fresh retry after failure, context-recreation guard in `cue()`. Modal handling uses `suspend()` (not `setPaused`), so a tap inside a Help/Album/Friend dialog re-unlocks the context while the world stays paused; no cue path fires while paused except the intended memory/absorb ones from the victory modal.

### F10 — Info: whitespace nit

`scripts/assets/bickering-besties/common.py:140` has a trailing blank line (`git diff --check`). Not enforced by CI.

## Properties checked with no defect found

1. **Touch actions vs. held movement.** `src/game/input.ts` cancels only the named channel; `pointercancel` on the window only drops the camera pointer; `ActionButton` queues the press before `setPointerCapture` and ignores `click` unless `detail === 0` (keyboard); `touch-activation.ts` leaves `[data-quest-pointer-action]` controls alone so no synthesized duplicate click reaches Attack/Jump/Guard/Interact. A second finger on the same button cannot double-queue (`set()` only arms `pending` on a false→true edge). Existing tests: `tests/game/input.test.ts` (cancel without erasing joystick), `tests/game/runtime-obby.test.ts` (wand cast with joystick held).
2. **One authority, no double hit.** Probe case 1: two full cycles at the checkpoint produce exactly two `take-hit` commands, both from Pink's swept bar; the logical enemy frame only ever reports `idle`/`cooldown`, never `strike`; probe case 2: standing on the boss's collision centre for a cycle yields exactly one contact and no displacement, so the scripted enemy body neither pushes nor strikes. `attack` on the duo outside `dizzy` returns `guarded` (existing runtime test). The server holds one HP/defeat/reward on `level-2-2024-boss` (`src/shared/adventure.ts` `createEncounters`), and the client's `attackReady` and `performAction` both gate on `frame.vulnerable`.
3. **Friendlies outside targeting and gates.** `findAttackTarget` only iterates `EnemySimulation` frames built from `level.encounters`; `level.friendlies` is a separate array; `bossIsActive` reads encounters only. All three placements per chapter sit on islands for both routes (`level.ts:172-180` vs. `obby-layout.ts`).
4. **Friendly server rules.** `tests/review/056-probes/friendly-server-edges.test.ts`: first-harm floor at HP 2→1, 3→1, 4→2 without `fallen`; after boss victory `attack-friendly` → `ACTION_NOT_AVAILABLE` while amends and healing still work; amends succeeds at full player health; a penalty re-applies after amends (second "first harm"); `boonClaimed` survives repair; sidecars with `penaltyActive` disagreeing with `hp < maxHp`, or `defeated` disagreeing with `hp === 0`, are rejected as `SAVE_DATA_INVALID`. Existing tests cover null sidecar defaults, first-action persistence, replay, owner isolation, malformed sidecar, future-chapter progress, retry and advancement. Postgres path: single `SELECT … FOR UPDATE` + revision CAS writes `friendly_state` in the same UPDATE (`src/server/db/postgres-store.ts` `applyGameplayAction`); migration `0004` is additive and nullable, and `migrate.ts` applies files by name so no journal update was needed.
5. **Catalog identity.** v1/v2 arrays untouched; v3 adds frozen copies plus `sir-flush-a-lot-besties`, `peel-patrol-besties`, `bickering-besties` with `requiredAbilities: ["move","jump"]`; `selectParodyLevel` sorts period ids so "besties-obby-v1" wins for 2024 + jump and falls through to `remix-runway-v2` without jump (`tests/server/parody-selection.test.ts`). `validateSaveRecord` still requires `versions.catalog === plan.catalogVersion`, so old v2 rows keep v2 rendering (`drama-dragon-encore` → `drama-dragon/v001`).
6. **Catalog and evidence claims.** Inventory counts (36 entries, 26 models, 25 complete, 1 partial, 1 concept-only, 4 audio, 1 owner-approved) match `catalog.md`'s header and the artwork-contract test; the only owner-approved entry is the `bickering-besties` reference (joint look), and both actor entries and all six residents say "exact final model/artwork review pending". `first-touch-evidence.json` honestly names its earlier bundle (`index-FHZzpTqN.js`) and the pre-revision Black hash (`7022d6b4…`), and records Chromium/CDP, not Safari.

## Explicit untested limits

- No browser of any kind was launched; nothing here is evidence of physical iPhone/iPad Safari behaviour, touch feel, audio audibility, frame time or camera framing.
- MkDocs strict build and link/media checks did not run (offline). CI `docs.yml` remains the gate.
- The 10 Postgres tests were skipped; the atomic friendly replay/owner test and the 0003/0004 migration test exist but only CI's disposable database exercises them.
- F6 and F9 are by-reading (PLAUSIBLE); every other finding has a runnable test or a reproducible command above.
- The lead's uncommitted `combat.ts` change was not reviewed (out of scope: not in 3ba5a0c). It does not change the F2 reach mismatch by inspection of the diff, but that should be re-checked once committed.
