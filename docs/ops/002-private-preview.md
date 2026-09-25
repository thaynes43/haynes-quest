# Running the private preview

The private playtest uses **fictional illustrations**. PLAN007 adds fresh sessions, contact collection and jumping at every age. The [handoff](../../.agents/HANDOFF.md) distinguishes their versions and actual release status. OAuth and real-player admission remain deferred. The Immich adapter exists behind a private server contract, but the fixture web process cannot receive its credentials or expose a real-photo route.

## Private cluster preview

The existing [Haynes Quest demo](https://haynes-quest.haynesops.com) remains available from the home network. The [asset catalog](https://haynes-quest.haynesops.com/studio/assets/catalog.html) lives beside the game. This route uses internal Traefik and LAN DNS; it is not a public internet deployment.

The earlier deployed MVP passed complete keyboard and Chromium touch-emulation journeys on September 11, 2026. A separate live test retained the same signed session and complete save state across replacement of the application pod. See the [verification record](004-overnight-verification.md) for exact versions, checks and limitations.

The separate private review runs at [Haynes Quest Playtest](https://haynes-quest-playtest.haynesops.com). Check the [current release handoff](../../.agents/HANDOFF.md) for rollout status. Its [playtest guide](../assets/playtest.md) describes the established two-chapter run and the Rat Casino fictional project. The review uses its own host-only browser session, fictional data and visibly labeled candidate artwork; the normal demo retains its existing image until final artwork review.

## Local development

Use Node 24 and the repository's pinned pnpm version. Install with `pnpm install --frozen-lockfile`. For the current fresh playtest, provide `QUEST_EPHEMERAL_PLAYTEST=true`, `QUEST_FIXTURE_MODE=true`, `NODE_ENV=development`, a randomly generated `BETTER_AUTH_SECRET` (at least 32 characters), and `QUEST_APP_ORIGIN=http://127.0.0.1:3000` in your shell or an untracked local environment file. No database URL is needed. Never provide real photo credentials to this process.

Build the asset studio with its documented Python environment and `pnpm docs:build`; the game models are served from `site/`. Run `pnpm build`, then `pnpm start` from the task worktree. Open `http://127.0.0.1:3000`. The explicit ephemeral mode uses bounded memory storage, skips database connections and migrations, and omits save discovery. A signed, HttpOnly cookie identifies the synthetic player; leaving or reloading the page starts a new run. An expired session loses its orphaned test records during maintenance. This temporary identity is not a production login method.

To develop the older persistent fixture flow, omit `QUEST_EPHEMERAL_PLAYTEST` and use a dedicated disposable PostgreSQL database through `DATABASE_URL`. That mode applies checksum-tracked migrations before listening and preserves accepted saves. Existing deployed persistent records are not deleted by the fresh playtest mode.

For client development, set the API origin to `http://localhost:5173`, run `pnpm dev:server` and `pnpm dev` in separate terminals, and open that exact origin. Vite proxies the API. Do not mix `localhost` and `127.0.0.1` origins within one session.

## Playing the current review

Choose **Enter Rat Casino** for the new fictional level, **Play from the beginning** for the established two-chapter route, or **Try the Besties chapter** for its second-chapter shortcut. The [level editor](../level-editor.md) can open the complete Rat Casino sample and play all three of its fictional chapters. The [playtest guide](../assets/playtest.md) describes the current controls and loop. Move with the touch stick or WASD/arrows; press the dedicated Jump button or Space to jump at every age. Drag to look. Walk into gear and pictures to collect them. F, a short left mouse click on the game, or the large Attack button swings the equipped tool; Shift, a short right mouse click on the game, or the smaller Bash button uses the shield for a secondary attack. Touch scenery taps do not attack.

Two minor memories lie along each route. The major memory appears after its boss and advances the chapter once both minors are collected. The established fixture progresses age 0 → 4 → 7; the separate Rat Casino sample continues from fictional age five to six. Leaving or reloading returns to the fresh start screen. Earlier saved journeys remain outside this playtest's discovery UI.

The four existing sound candidates play in the isolated review with a revised mix. The labeled sound control mutes/unmutes; Help provides volume and a repeatable test sound. Physical iPhone/iPad listening remains necessary. Missing artwork uses a recoverable warning and visible encounter fallback, without freezing play or requiring save-and-leave.

## Asset studio

Build the documentation using [the documented commands](../README.md#build-and-preview-the-site). The app serves the generated `site/` directory at `/studio/`; its catalog is `/studio/assets/catalog.html`. The standalone MkDocs preview is also available through `scripts/docs/serve.sh` at loopback port 8000.

The static studio contains original fictional references, candidate media and the repository’s public-safe project documentation. It is isolated from application records and has no database or Immich access. Tom’s exact-version approval is required before candidate models, animation, materials or sounds are promoted into the normal demo. DESIGN007 permits the isolated, labeled candidate review used for this playtest. Pending approval does not prevent browsing or downloading the candidate package. WAV downloads and byte-range responses use `audio/wav` with `nosniff` retained. The 3D viewers use a 4:3 desktop frame and a square phone frame, with still images and direct downloads alongside them.

## Verification commands

- `pnpm typecheck` and `pnpm lint` check source and test code.
- `pnpm test` runs unit/failure-path tests. Set **only** `QUEST_TEST_DATABASE_URL` to a dedicated disposable database to include the real Postgres tests. Those tests truncate Quest test tables; never point them at the running game database.
- `pnpm build` builds the browser and Node server.
- `pnpm exec tsx tests/e2e/serve-fixture.ts` starts a synthetic browser-test harness on `127.0.0.1:4173`. Without `QUEST_TEST_DATABASE_URL` it uses memory storage, which is explicitly not durability evidence.
- For the older persistent contracts, `node tests/e2e/journey.mjs` runs keyboard and Chromium touch-emulation journeys against that harness. It saves synthetic screenshots and evidence under ignored `test-results/`. Browser binaries must be installed for Playwright. These checks do not establish physical iPhone/iPad Safari performance.
- `QUEST_E2E_URL=http://127.0.0.1:3000 node tests/e2e/fresh-playtest.mjs` checks the new fresh-start route against the built ephemeral server. Follow WO066 for its exact scenarios and evidence.
- `QUEST_E2E_URL=http://127.0.0.1:3000 node tests/e2e/rat-casino.mjs` plays the whole Rat Casino chapter from the home CTA: a deliberate fall, all three memories, the five required fights plus optional Golden, the golden-view ticket and the closing haul, then the editor sample and a 390×844 view. Add `QUEST_E2E_SKIP_GOLDEN=1` to prove the main route completes while Golden stays undefeated. Add `QUEST_E2E_LOCKSTEP=1` to play the course in lockstep (see below).
- `QUEST_E2E_URL=http://127.0.0.1:3000 node tests/e2e/mouse-combat.mjs` checks trusted desktop left/right clicks, mouse drags, touch scenery and the touch Attack button against the actual game canvas.
- `QUEST_E2E_URL=http://127.0.0.1:3000 node tests/e2e/bonus-editor.mjs` removes and cleanly re-adds Golden through the editor, then checks that an unreachable post-boss placement is rejected.
- `QUEST_E2E_URL=http://127.0.0.1:3000 node tests/e2e/casino-rewards.mjs` checks the casino tokens, the loft's golden ticket, contact before the server's reply, and the HUD tally at 390×844.
- `node tests/e2e/studio.mjs` checks every candidate page, GLB/clip, media download, decoded audio audition and portrait layout. Set `QUEST_E2E_URL` to the private app origin to check deployed delivery. This checks audio decoding, not listening quality.
- `scripts/docs/build.sh` runs the strict documentation build and local media/link checks using the pinned Python requirements.

The GitHub Application workflow runs these source/unit/database/build checks against a fresh PostgreSQL 16 service. Main builds publish an immutable `ghcr.io/thaynes43/haynes-quest:sha-<commit>` image with provenance. Deployment uses that image’s digest through haynes-ops GitOps; no application deploy changes dev-env.

### Real time and lockstep

Browser journeys use one of two clocks.

- **Real time** is the default and matches a player's device: page time flows, and the harness holds keys for short real intervals. It is the only mode that says anything about frame time. On software WebGL a frame can take a fifth of a second or more. The game clamps each frame to 0.2 s, so at 4 m/s the traveler can move about 0.8 m between readings. Takeoffs need 0.5 m, so long real-time journeys on such renderers fail intermittently. Run them on real GPUs or the hosted playtest.
- **Lockstep** installs the Playwright page clock before navigation and pauses it once the course is ready. The harness then renders one frame at a time, waits until the GPU has drawn it, and chooses keyboard input between frames. It uses 16 ms frames near takeoffs, targets, sweepers and on moving platforms, 32 ms frames in flight, and 48 ms frames on open floor and while waiting. Walks plan around raised neighbouring platforms and sweeper paths. Jumps steer toward a point past the far edge. Ride edges step frames until the moving platform comes within reach. The game sees the same frames however slowly the renderer draws. Lockstep proves route logic, layout, collisions, combat rules and UI state under ordinary keyboard input. It does not show frame time or how play feels on a device.

| Check | Clock |
| --- | --- |
| `journey.mjs`, `fresh-playtest.mjs`, `studio.mjs` and the other browser checks | Real time |
| `rat-casino.mjs` (default) | Real time |
| `rat-casino.mjs` with `QUEST_E2E_LOCKSTEP=1` | Lockstep from the ready course through the closing haul. The boss-stage frame-time sample is skipped, because a paused page clock cannot measure it. The editor sample, the three-chapter start with its garden frame sample, and the 390×844 check open new real-time pages. |
| `casino-rewards.mjs` | The foyer token trail and the 390×844 layout run in real time. The ticket-loft climb, the contact check and the defeat always run in lockstep with 16 ms frames. |
| `pnpm test` (`tests/e2e/lockstep-control.test.ts`) | Runs the lockstep driver on the checked-in Rat Casino course using the game's real movement code, without a browser. |

Hosted and release runs keep the real-time default. Use lockstep locally when the renderer is slow, and treat it as logic evidence only. Lockstep takes as long as the renderer needs for each frame. `QUEST_E2E_LOCKSTEP_CRUISE_MS=16` makes every lockstep frame 16 ms, which is slower but closest to 60 Hz. `QUEST_E2E_LOCKSTEP_SCALE=0.5` keeps the 1280×760 page layout but draws a quarter of the pixels. It roughly halves software-rendering time, and screenshots are then 640×380. In lockstep, `QUEST_E2E_TIMEOUT_MS` defaults to one hour. The report's `clock` field records the mode, scale, frame counts, page time and wall time.

## Hosting boundary and remaining work

Database preparation merged in haynes-ops [#2849](https://github.com/thaynes43/haynes-ops/pull/2849), with a pod-local DNS fix in [#2850](https://github.com/thaynes43/haynes-ops/pull/2850). The dedicated `haynes_quest` role owns its database and has no superuser/create-role/create-database privileges. Provisioning alone receives the administrator Secret. The fixture runtime receives only the prepared application Secret; it never receives the separate Immich Secret.

The deployment deliberately sets both `NODE_ENV=development` and `QUEST_FIXTURE_MODE=true`, with the exact HTTPS application origin. The default image refuses fixture mode under production. This is a private synthetic development workload; its ingress and Secret mounts enforce the additional separation from real photos.

The private route is live at `https://haynes-quest.haynesops.com` behind `traefik-internal`, whose LoadBalancer is LAN-only at `192.168.40.203`. The zone is managed by UniFi DNS and excluded from the public Cloudflare DNS controller. Deployment merged through haynes-ops [#2851](https://github.com/thaynes43/haynes-ops/pull/2851), with restart and ownership evidence in [#2852](https://github.com/thaynes43/haynes-ops/pull/2852). Check the [handoff](../../.agents/HANDOFF.md) for the current immutable image.

Future admission work: configure the separate Authentik client and admitted-player policy, verify actual login/callback journeys, authorize real subject setup/media, settle birth-date/age-anchor and name-disambiguation previews, review exact asset versions, and play on physical iPad/iPhone Safari. Real photo-derived likeness remains private follow-on work; no private family reference has been sent to an external generator.
