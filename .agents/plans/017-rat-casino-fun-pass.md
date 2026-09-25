# PLAN017: Rat Casino fun pass

- **Status:** In progress
- **Depends on:** [PLAN016](completed/016-rat-casino-playground.md)
- **Requirements/designs:** [DESIGN-022](../../docs/designs/022-rat-casino-fun-pass.md), [DESIGN-021](../../docs/designs/021-rat-casino-level.md), [BL-02/BL-03/BL-06](../../docs/BACKLOG.md)

## Outcome and scope

Slice 1 makes play respond instantly and gives Rat Casino something to chase:

- Hits show contact at once.
- Presses are no longer dropped while a request is in flight.
- Particles, hit-stop and camera shake follow the reduced-motion setting.
- Casino tokens and golden tickets appear along the casino route, with a HUD counter and a completion tally.

The garden and Besties courses keep their content. Later slices, listed in DESIGN-022, get their own plans or amendments. The items that need Tom's decision stay open until he rules on them.

## Steps

1. Record DESIGN-022 and this plan.
2. Implement predicted contact, attack buffering and the effects module, with unit tests.
3. Implement deterministic token and ticket placement, collection, rendering, HUD and tally, with unit tests.
4. Run typecheck, lint, the full tests with PostgreSQL, the build, `levels:validate` and the strict docs build. Play Rat Casino in the browser with ordinary controls and capture screenshots.
5. Update the playtest guide and handoff. Open a PR, get the checks green, merge, and pin the playtest image through haynes-ops.

## Completion evidence

- A PR with green checks and a squash merge.
- Local browser captures of tokens, a golden ticket, the HUD counter and the completion tally, with no page, console or network errors.
- The playtest image pinned through a haynes-ops PR.
- Hosted verification from the home network, recorded separately when it is available.
- Feel on physical devices and the children's reactions, reported by Tom.

## Result

Slice 1 is implemented and verified locally; the playtest deployment and hosted check follow the merge.

- **Runtime:** `juice.ts` (hit-stop, shake, press buffer, particle pool), `effects-scene.ts`, `casino-tokens.ts` (placement and collection), `token-scene.ts`, and changes to `createGame.ts`, `scene.ts` and `enemy-animation.ts`. `GameScreen.tsx` adds the HUD counter, the closing haul and the sound mapping.
- **Checks:** typecheck, lint, all 832 tests including real PostgreSQL, the production build, `levels:validate` (all five level files unchanged) and the strict docs build passed.
- **Browser:** `tests/e2e/casino-rewards.mjs` passed in local Chromium with software WebGL and ordinary keyboard input.
  - Walking the foyer trail collected tokens, and the HUD and rendered tokens updated.
  - Eleven Space jumps up the ticket loft, with no falls, collected 20 tokens and the golden ticket.
  - At the first mascot, contact sparks appeared 112 ms after the swing while the server's reply was held back. The server then confirmed the hit, and the defeat released confetti.
  - The counter fits the 390×844 HUD.
  - There were no page, console or network errors.
  - The [capture record](../../docs/assets/media/playtest/v009/captures.json) holds the images and hashes. This renderer draws about five frames a second, so the loft and fight parts step the page clock 16 ms per frame.
- **Full course:** the extended `tests/e2e/rat-casino.mjs` takes the golden-view side route and asserts the closing haul.
  - Its first local run found a placement bug. The golden-view ticket stood on a strip of balcony that the fox card room covers 0.3 m higher. Placement now keeps every item out of platforms and off covered floor, with a regression test.
  - A real-time run with ordinary keyboard play then made 13 route crossings, won two fights and took the corrected ticket (30 tokens, 1 of 3 tickets).
  - The other attempts stopped at the seventh jump's takeoff. That is a limit of the route driver at about five frames a second, and it also stopped earlier runs on unmodified code. The complete course and its closing haul still need the hosted run on faster hardware.
- **Lockstep journey:** the route driver now has an opt-in lockstep mode (`tests/e2e/lockstep-control.mjs`). The [runbook](../../docs/ops/002-private-preview.md#real-time-and-lockstep) lists which checks use real time and which use lockstep.
  - The real-time driver has two faults on software WebGL. Coarse frames overshoot takeoffs, and one-axis pulses walk into raised neighbours. In a later cloud session the renderer drew under one frame a second. A real-time baseline fell short on the first jump, then stalled 8.28 m from the foyer in the 0.6 m gap between two token steps.
  - With `QUEST_E2E_LOCKSTEP=1`, `tests/e2e/rat-casino.mjs` pauses the page clock once the course is ready. It then renders one frame at a time, waits for the GPU to draw it, and chooses keys between frames. Walks plan around raised neighbours, including the card room beside the golden-view ticket. Jumps over the ribbon bar are timed from its predicted motion.
  - A local run with only `QUEST_E2E_LOCKSTEP=1` passed the whole journey in 28 minutes. That run is in this container's headless Chromium with SwiftShader WebGL at 1280×760, about 1.2 s a frame. It covered the deliberate fall and 20 route crossings with no other recovery, and all five fights without a retry. It collected the three memories and the golden-view ticket and read the closing haul: 61 of 145 tokens and 1 of 3 tickets. The editor sample, the three-chapter start and the 390×844 view followed, with no page, console or network errors. The course took 1,320 frames and 50.7 s of page time.
  - A second run at `QUEST_E2E_LOCKSTEP_SCALE=0.5` draws a quarter of the pixels. It passed in 16 minutes with the same outcome: the same haul and the same hits in each fight. It took 1,314 frames at about 0.6 s a frame.
  - Lockstep proves route logic and layout, not frame time or feel. It skips the boss-stage frame sample, and real time stays the default.
  - `tests/e2e/lockstep-control.test.ts` runs the lockstep driver over the checked-in course with the game's movement code and no browser. It covers the explorer route, a deliberate miss and the walk back from the padded floor.
  - Checks for this change passed: typecheck, lint, 831 tests, the build, `levels:validate` and the strict docs build. The 12 PostgreSQL cases were skipped because no `QUEST_TEST_DATABASE_URL` was set.
  - Real-time play is unchanged, and it still cannot finish on this renderer. Both runs of the original code stopped the same way, and so did one of two runs with this change: the first jump fell short, then the walk back stalled 8.28 m from the foyer. The other run stopped 0.97 m short of the first takeoff. At under one frame a second, most key pulses end between frames.
- **Deployment:** app PR67 merged at `dc52e4b`. [Ops PR3169](https://github.com/thaynes43/haynes-ops/pull/3169) pinned the signed image `sha256:e8a4aba0…7521` to the private playtest only and merged at `5a25d6f`. The rollout has not been verified from the cloud session.
- **Open:** a hosted real-time check from the home network, including the full-course journey, plus physical-device feel and sound, and the children's reactions. Lockstep covers the course's logic locally but not these.
