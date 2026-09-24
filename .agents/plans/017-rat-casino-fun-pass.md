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
- **Deployment:** app PR67 merged at `dc52e4b`. [Ops PR3169](https://github.com/thaynes43/haynes-ops/pull/3169) pinned the signed image `sha256:e8a4aba0…7521` to the private playtest only and merged at `5a25d6f`. The rollout has not been verified from the cloud session.
- **Open:** a hosted check from the home network, including the full-course journey, plus physical-device feel and sound, and the children's reactions.
