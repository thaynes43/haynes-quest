# WO074 results: Fable adversarial review of mobile reliability

- **Reviewed commit:** `717cfe6` "Repair contact feedback and integrate visible boss and audio recovery" (base `d461cda`), fast-forwarded into `/home/dev/work/haynes-quest-0912-113435`, branch `agent/haynes-quest-0912-113435`.
- **Reviewer:** Claude Fable 5.1 (`claude-fable-5-1`, xhigh) via `agent-run`, September 12, 2026.
- **Owned outputs:** this file and `tests/review/074-probes/` (probes, harness, evidence). No runtime, docs, copy, fixture 4392/4398, MCP, OAuth or dev-env change. No PR opened.
- **Read:** AGENTS.md, TEAM, HANDOFF, PLAN008, WO071, WO072, DESIGN014/015/016, the full `d461cda..717cfe6` source diff and the changed tests.

## Checks run on 717cfe6

| Check                                                                | Result                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile --offline --ignore-scripts`          | ok                                                                                                                                                                                                                                                                                        |
| `tsc --noEmit` (with the probes)                                     | pass                                                                                                                                                                                                                                                                                      |
| `eslint src tests --max-warnings 0` (with the probes)                | pass                                                                                                                                                                                                                                                                                      |
| `vitest run --exclude 'tests/review/**'`                             | 38 files passed, 1 skipped; 342 tests passed, 10 skipped (Postgres skipped, no `QUEST_TEST_DATABASE_URL`)                                                                                                                                                                                 |
| `vite build`                                                         | `dist/client/assets/index-CD5h8vpi.js`, 1,045,714 bytes, SHA256 `c7c7861fe9af5b92aed71cef5f0157c8a5796f133902f7cfcff69de9c1fb7111`                                                                                                                                                        |
| `docs:build` (mkdocs strict)                                         | not run; the reviewer did not have MkDocs in that worktree; the lead uses the existing docs virtualenv and separately runs the strict build                                                                                                                                                                                                                                        |
| Lead e2e `tests/e2e/mobile-reliability.mjs` against the exact bundle | **passed**: Help scrolled 0→345 px under CDP touch, two `AudioBufferSource.start` calls in a `running` context (0.3 s confirmation, 1.2 s chime), repeat tap ok, Attack opened no dialog, Leave returned home. `tests/review/074-probes/evidence/lead-mobile-reliability-e2e-report.json` |

**Fixture note.** Root's 4398 served `index-CD5h8vpi.js` at 15:36 UTC and `index-BAlwKx8V.js` (1,045,618 bytes, SHA256 `8202c24ba6c8b9670e3bd51a084a8dd29a057a89a3a0825a63836fcc1bcb3877`, lead tree at `73a9acd`) by 15:46 UTC, so it was not used for evidence. All browser evidence used my own fixture of the exact 717cfe6 build on `127.0.0.1:4402` (`tests/review/074-probes/serve-ephemeral-fixture.ts`: ephemeral playtest mode, which `tests/e2e/serve-fixture.ts` never enables, with `/studio/assets/media` symlinked to `docs/assets/media` because no `site/` exists offline). That fixture was stopped after the review. Chromium 153.0.8010.12, SwiftShader, 390×844 touch emulation.

## Probe suite (`tests/review/074-probes/`)

Run with `node_modules/.bin/vitest run --reporter=verbose tests/review/074-probes`. Two failures are deliberate demonstrations of findings F1 and F2; the assertions state the intended behaviour. Vitest collects `tests/**`, so these files must not ride along into `main` unchanged.

| File                                           | What it exercises                                                                                                                                                                                            | 717cfe6                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| `besties-glb-mixer.test.ts` (node)             | The real `bestie-pink`/`bestie-black` v001 GLBs through the production `SceneAssets.attach` clone path, `BestiesScene` and `BestiesSimulation`; sampled skinned vertices per frame                           | 7/7 pass                            |
| `runtime-besties.test.ts` (jsdom)              | `createGame` against the real Hono app (`/api/playtest/start`, action route, cookies/CSRF), real reducer/enemy/Besties simulations, scene mocked; scripted, dodging and stationary children; gated responses | 3 pass, **1 fail (F2)**             |
| `game-screen-notice.test.tsx` (jsdom)          | `GameScreen` notice lifecycle after a minor pickup                                                                                                                                                           | 1 pass (control), **1 fail (F1)**   |
| `scene-memory-visibility.test.ts` (jsdom)      | `GardenScene.prototype.updateProgress` keepsake visibility rule, real method on a minimal receiver                                                                                                           | 2/2 pass                            |
| `touch-action-probe.mjs`                       | Own Chromium: computed `touch-action`, CDP double-tap/pinch on canvas, objective and HUD, with and without `.game-canvas{touch-action:none}`                                                                 | `evidence/touch-action-report.json` |
| `runtime-lib.ts`, `serve-ephemeral-fixture.ts` | Harness (derived from the WO068 harness) and exact-build fixture                                                                                                                                             | —                                   |
| `evidence/`                                    | Captured probe output and the two JSON reports                                                                                                                                                               | —                                   |

## Findings, most severe first

### F1 · Medium · The collected keepsake's picture comes back on every later attack notice (the reported "popup"); 717cfe6 does not fix it

- **Source:** `src/client/GameScreen.tsx:319-329` sets `pickupMemoryId` and a 2.3 s `noticeTimer` that clears both the notice and the id. `:396-402` (attack feedback), `:238-241` (gear), `:266-269` (friendly) and `:281-284` (friendly harm) all `clearTimeout(noticeTimer)` and arm a timer that clears **only** `attackNotice`. The notice renders `{pickupMemoryId && <MemoryImage/>}` at `:674-680`.
- **Mechanism:** any notice arriving within 2.3 s of a minor pickup cancels the pickup timer; `pickupMemoryId` then stays set until the next minor pickup, so every later attack notice ("Move closer to a glowing enemy…", "Whack!", "Ready in a moment.", gear/friend notices) renders with the memory picture box above the Attack button. Pickup then immediately tapping Attack at the next enemy is the ordinary sequence.
- **Probe:** `game-screen-notice.test.tsx › does not resurrect the collected minor's picture on later attack notices` fails on 717cfe6: `30 s later a plain attack notice still carries the keepsake picture=true` (`<img alt="Route memory 1" src="/fixture/route-memory-1.svg">` inside `.attack-notice`). The control case (no interruption) clears correctly.
- **Why the commit missed it:** the `collectedByContact` gate (`src/game/createGame.ts:1074`) only suppresses an attack press in the same simulation frame as the accepted contact, and hiding revealed keepsakes removes the visual lure; neither touches the stale-id path. The lead's e2e taps Attack after Help and asserts `role=dialog` count 0; this popup is a `role=status` notice, not a dialog.
- **Fix direction (lead's call):** clear `pickupMemoryId` whenever `attackNotice` is replaced or cleared, or give the picture its own timer.

### F2 · Low–Medium · The struck-actor hit clip follows the last Attack press, not the accepted hit

- **Source:** `src/game/createGame.ts:669-679` calls `beginAttackAnimation` before acceptance; `:480-484` overwrites `bestiesHitActorId` with the actor nearest the player on every press, including presses rejected as `busy`/`cooldown`/`no-target`. `BestiesScene.update` (`src/game/besties-scene.ts:134-137`) captures whatever id is current on the frame the authoritative HP drop arrives.
- **Probe:** `runtime-besties.test.ts › animates the hit on the actor nearest the ACCEPTED attack…` fails on 717cfe6 against the real app with a gated response: `accepted attack was aimed at bestie-pink; after the rejected (busy) press bestiesHitActorId=bestie-black; on the HP-drop frame the renderer received bestiesHitActorId=bestie-black`.
- **Impact:** DESIGN014's "an accepted hit animates the struck actor" fails whenever a child mashes Attack while moving between the actors during a round trip or the 400 ms cooldown; the actors are 2.5 m apart and 0.15 s at 4 m/s flips "nearest". Health is unaffected; only feedback lands on the wrong body.
- **Fix direction:** capture the actor id only when the coordinator accepts the attack, pair it with that request, and hand the renderer the id only on the frame its HP drop is applied.

### F3 · Medium (balance, not a code defect) · Aimed tricks, 4-damage contacts and retry health make the fight unwinnable for a child who cannot dodge

- **Evidence (real app, stationary child at x 0, z −20.8, no inputs):** hp 10→6 at 1.25 s (Pink's bar), 6→2 at 3.57 s (Black's lane), dizzy 7.2–12.2 s, knocked out at 14.3 s by cycle 2's Pink bar, `retry-level` restores hp 10 and restarts the routine from the checkpoint at z −19; the boss stays 11/11. Auto-attacking child on the middle path: 2 contacts (hp 2/10), boss killed in the first dizzy window with 9 accepted attacks. Dodging child (2.4 m deeper than the aimed bar, 3.1 m off the aimed lane): 0 contacts. `evidence/runtime-output.txt`.
- **Source:** boss `attackDamage: 3 + levelIndex` = 4 at the Besties chapter (`src/shared/adventure.ts:661`), `maxHp: 8 + levelIndex * 3` = 11 (`:660`), `take-hit` subtracts it (`:436-446`), `retry-level` restores player health and resets every non-defeated encounter, the boss included, to `maxHp` (`:352-366`; v3 keeps only defeated ones). Player damage per swing: wand 3 (`:625`), mallet 2, Bash two thirds; 400 ms cadence allows at most 12 attacks per 5 s dizzy window.
- **Reading:** WO072 found the tricks never connected; 717cfe6 makes them connect at the dragon-tier cost. A child who neither dodges nor lands ≥4 wand hits inside one dizzy window is knocked out on the third contact and restarts against a full-health boss. DESIGN014's "without raising damage" is literally true, but effective difficulty went from zero to high for the six-year-old target. Options for the lead: lower the duo's `attackDamage` (2 is one contact per trick with room for two cycles), cap one contact per cycle, or keep boss HP across fresh-playtest retries.

### F4 · Low · `touch-action: auto` on `.game-screen`: no canvas regression demonstrated; the Help scroll fix is WebKit-specific

- **Facts:** the WebGL canvas element still declares `touch-action: none` (`src/game/scene.ts:144`), and `.game-vignette`, `.era-hud`, `.era-objective`, `.attack-notice` are `pointer-events: none`, so world taps hit the canvas. Chromium double-taps on the canvas, objective and HUD kept `visualViewport.scale` at 1.0 with and without an injected `.game-canvas{touch-action:none}`; the synthetic pinch zoomed to 2.5 in both configurations (Chromium's synthetic pinch ignores `touch-action`, inconclusive). Surfaces that now allow default gestures: header buttons, friendly/pickup prompts, placeholder label.
- **Why the change was needed:** WebKit intersects `touch-action` down the tree (`RenderStyle::computeEffectiveTouchActions`), so `none` on `.game-screen` blocked the modal's `pan-y` scroll on the iPhone and left the sound button below the fold, while Chromium's spec algorithm scrolled fine, which is why the earlier suite passed. This is inferred from WebKit source behaviour, not observed; physical iPhone confirmation is still required.
- **Tighter option:** `.game-screen{touch-action:pan-y}` scrolls the modal on WebKit while still refusing pinch/double-tap on the chrome.

### F5 · Low · A same-frame Attack press is dropped silently on a contact pickup (by design, now documented)

`runtime-besties.test.ts › drops an Attack press silently…` passes: attack feedback sequence 2→3→3 around the `collect-equipment` frame. Acceptable for the reported popup; note a press coinciding with a friendly auto-heal contact is lost the same way.

### F6 · Low · Pickup prompt can overlap the Bash button (CSS arithmetic, not browser-measured)

At 390×844 with a 34 px bottom inset: combat block bottom 54–228 px, Bash 68 px at x 302–370 / y 160–228; `.pickup-prompt` (bottom 205 px, up to 310 px wide, pointer events on) can cover Bash's top-left ≈48×23 px whenever a pickup prompt shows while Bash exists (chapter-2 wand/shield pickups after chapter-1 gear). The moved friendly prompt (246 px) clears Bash by 18 px in portrait and landscape.

### F7 · Info · Sound module

Source review of `src/client/audio.ts` found no demonstrable defect: the shared bounded resume (1.5 s), bounded load (5 s, abortable), retirement on suspend/interrupted/closed and fresh-gesture rebuild are coherent, and the commit's 17 audio tests cover the lifecycle. Observations: every background→foreground cycle closes the context and refetches the four WAVs (≈630 KB, `no-cache` revalidation); the Help status text persists ("Test sound played…") across reopen and after a background retirement; a slow-but-successful resume beyond 1.5 s is reported as "couldn't start" until the next tap. Physical speaker output cannot be verified here.

### F8 · Info · WO072's "visibly block the route exit" is not in 717cfe6

No blocking geometry was added. This is not a progression bypass: the major memory stays `locked` until the boss is defeated and `retry-level` returns the child to the boss-landing checkpoint. A child running off the island's far edge (z −27) or sides restarts the current trick's warning on every fall (DESIGN014), which my first harness run hit by accident.

## Verified positive on 717cfe6 (real GLBs and real app)

- Both v001 GLBs load through `SceneAssets.attach` (real clone path); eight clips with authored durations (idle 2.4, move 1.2, attack 1.6, hit 0.6, defeat 2.0, cheer 2.0, high-five 1.6, dizzy 2.4 s).
- Sampled skinned vertices move on ≥79% of frames in every routine phase across two full cycles, including the scrubbed attack and the second cycle after paused actions; static frames equal the authored end holds (attack 0.12 s, hit 0.165 s, defeat 0.45 s). No frozen mixer. `evidence/glb-mixer-output.txt`.
- Real hit clip lands on the struck actor only (Pink identical to control on all 33 frames, Black diverged on 33/33); a `null` recipient (the runtime's initial value) applies no hit clip.
- Defeat after `active:false, defeated:true`: both actors animate then hide at exactly 2.000 s; hazard and warning hidden; defeat also processed while paused for recovery; a recovery restart keeps the aimed geometry.
- Rendered actor anchors equal `nearestBestiesActor` anchors to 1e-9 during the warning step, mid high-five and dizzy; the authored −Z face turns toward the player; `targetPosition` agrees.
- Post-victory `SceneFrame.besties.phase` stays `defeated` for 60 consecutive frames (3 s) after `memory-released` against the real app.
- Aimed geometry threatens the middle path (2 contacts on a stationary or auto-attacking child); it is dodgeable within the warning.
- v3 keepsake visibility: revealed minors hidden, released visible, locked major hidden; archived v2 revealed keepsakes stay visible.
- Lead e2e passes on the exact bundle (scrolled Help, decoded cue start, repeat tap, no dialog after Attack, Leave).

## Material limits

- No WebKit here: iPhone speaker output, Safari's `touch-action` intersection, `resume()` stalls and Audio Session behaviour are not verified; F4 is source-inferred.
- Browser evidence is headless Chromium/SwiftShader on my exact-build fixture; root's 4398 advanced mid-review and was not used.
- Runtime probes mock the Three.js scene; the GLB probes run in Node without a GPU. The strict docs build and Postgres suite were not run offline.
- No physical-device timing or frame-time claims are made.

## Output paths

- `.agents/work-orders/074-fable-mobile-reliability-results.md` (this record)
- `tests/review/074-probes/{besties-glb-mixer.test.ts,runtime-besties.test.ts,game-screen-notice.test.tsx,scene-memory-visibility.test.ts,runtime-lib.ts,serve-ephemeral-fixture.ts,touch-action-probe.mjs}`
- `tests/review/074-probes/evidence/{glb-mixer-output.txt,runtime-output.txt,touch-action-report.json,lead-mobile-reliability-e2e-report.json}`
- Ignored on the pod: `test-results/074-touch-action/*.png`, `test-results/074-lead-e2e/help-sound.png`, `/tmp/wo074/*.log`

## Lead disposition after integration

F1 is fixed by atomic notice text/photo state (`3252adf`) and two lifecycle regressions. F2 is fixed by capturing the actor only for accepted requests (`68a522a`) and a delayed-response, cross-position regression. F3 is accepted as opening-playtest tuning: fresh v3 Besties plans use two damage per contact; archived plans and other bosses retain their values. F4 needs no further canvas change; real modal scrolling is covered by the lead's touch test and physical Safari remains explicit inspection. F5 remains the intended single-contact-frame behavior. F6 is addressed by lifting the passive pickup hint above the combat controls in both orientations and disabling pointer events on that hint. It cannot cover or intercept Bash. F7's sound limitations remain; the later native audit additionally corrected touch/pen gesture ordering and accurate startup wording. F8 is accepted: no physical wall was added and the major-memory progression gate remains in force.

The original probes and raw review evidence remain committed on the pushed review branch at `09fda06`. The lead adopts the actual-GLB animation regressions into the normal suite, with notice/accepted-hit regressions integrated in the existing game tests. Headless geometry motion and source scheduling do not establish physical Safari rendering or speaker output.

The lead temporarily merged `f8203f0` into the review worktree and reran all four probe files: **15/15 passed**, including the originally failing F1/F2 probes. This verification precedes the later two-damage balance and pointer-timestamp changes; their separate regressions and final browser run govern those changes. Evidence is retained at `test-results/fable-reviews/074/integrated-probes.log` in the implementation worktree. The temporary merge is aborted before reaping the reviewer.
