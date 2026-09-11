# Running the private preview

The deployed overnight build and corrected PLAN-005 review use **fictional illustrations**. The [handoff](../../.agents/HANDOFF.md) distinguishes their versions and actual release status. OAuth and real-player admission remain deferred. The Immich adapter exists behind a private server contract, but the fixture web process cannot receive its credentials or expose a real-photo route.

## Private cluster preview

The existing [Haynes Quest demo](https://haynes-quest.haynesops.com) remains available from the home network. The [asset catalog](https://haynes-quest.haynesops.com/studio/assets/catalog.html) lives beside the game. This route uses internal Traefik and LAN DNS; it is not a public internet deployment.

The earlier deployed MVP passed complete keyboard and Chromium touch-emulation journeys on September 11, 2026. A separate live test retained the same signed session and complete save state across replacement of the application pod. See the [verification record](004-overnight-verification.md) for exact versions, checks and limitations.

The corrected two-chapter candidate is prepared for a separate private review at [Haynes Quest Playtest](https://haynes-quest-playtest.haynesops.com). Check the [current release handoff](../../.agents/HANDOFF.md) for rollout status. Its [playtest guide](../assets/playtest.md) describes what is included and still open. The review uses its own host-only browser session, fictional data and visibly labeled candidate artwork; the normal demo retains its existing image until final artwork review.

## Local development

Use Node 24 and the repository’s pinned pnpm version. Install with `pnpm install --frozen-lockfile`. Start a dedicated disposable PostgreSQL database, then provide `DATABASE_URL`, a randomly generated `BETTER_AUTH_SECRET` (at least 32 characters), `QUEST_FIXTURE_MODE=true`, `NODE_ENV=development` and `QUEST_APP_ORIGIN=http://127.0.0.1:3000` in your shell or an untracked local environment file. Never use a real photo credential in this process.

Build the asset studio first using its documented Python environment and `pnpm docs:build`; the game models are served from `site/`. Run `pnpm build`, then `pnpm start` from the repository root. The server applies checksum-tracked migrations from `migrations/` before listening on port 3000. Open `http://127.0.0.1:3000`. A signed, HttpOnly browser cookie identifies a server-assigned fictional player; clearing it starts another preview player. New fixture sessions are capped globally at 120 per minute. A five-minute bounded maintenance pass removes expired sessions and unused previews, preserving all saves and their referenced previews. This temporary identity is not an additional production login method.

For client development, set the API origin to `http://localhost:5173`, run `pnpm dev:server` and `pnpm dev` in separate terminals, and open that exact origin. Vite proxies the API. Do not mix `localhost` and `127.0.0.1` origins within one session.

## Playing the corrected review

Choose **Start a journey**, preview Demo Adventurer’s fictional memories and begin. Keep all three selected to play both periods. The fictional birth date is January 1, 2020.

Move with WASD/arrows or the touch stick; drag the scene to look. Find the spark mallet and press E/**Take gear**. F/**Attack** strikes a nearby creature. Find the acorn shield and use Shift/**Guard** to soften an incoming hit. Step out of the expanding attack ring before the strike. Defeat both ordinary enemies to wake the boss.

After the boss falls, remember the pictures it releases. Their full images are available in the victory review. **Absorb memories** becomes available when every picture in the bundle is remembered; that changes age and the next period. The first bundle produces age four, the child model and Space/**Jump**. Gear and earlier abilities persist into 2024. The final bundle ends at age seven.

The server saves accepted gameplay events. **Save & leave** and resume restore equipment, health, encounters, phase, pictures, age and abilities. A fallen player can retry with full health while preserving gear and previous completed levels. Earlier v1 journeys remain read-only albums; start a new journey for the corrected loop.

Pictures that fail to load show a retry control. The source remains fictional illustrations until authenticated real-photo integration is configured; a working image response does not establish Immich access. The review is silent while audio candidates await approval. Mute and volume preferences remain available and persist locally.

## Asset studio

Build the documentation using [the documented commands](../README.md#build-and-preview-the-site). The app serves the generated `site/` directory at `/studio/`; its catalog is `/studio/assets/catalog.html`. The standalone MkDocs preview is also available through `scripts/docs/serve.sh` at loopback port 8000.

The static studio contains original fictional references, candidate media and the repository’s public-safe project documentation. It is isolated from application records and has no database or Immich access. Tom’s exact-version approval is required before candidate models, animation, materials or sounds are promoted into the normal demo. DESIGN007 permits the isolated, labeled candidate review used for this playtest. Pending approval does not prevent browsing or downloading the candidate package. WAV downloads and byte-range responses use `audio/wav` with `nosniff` retained. The 3D viewers use a 4:3 desktop frame and a square phone frame, with still images and direct downloads alongside them.

## Verification commands

- `pnpm typecheck` and `pnpm lint` check source and test code.
- `pnpm test` runs unit/failure-path tests. Set **only** `QUEST_TEST_DATABASE_URL` to a dedicated disposable database to include the real Postgres tests. Those tests truncate Quest test tables; never point them at the running game database.
- `pnpm build` builds the browser and Node server.
- `pnpm exec tsx tests/e2e/serve-fixture.ts` starts a synthetic browser-test harness on `127.0.0.1:4173`. Without `QUEST_TEST_DATABASE_URL` it uses memory storage, which is explicitly not durability evidence.
- In another terminal, `node tests/e2e/journey.mjs` runs keyboard and Chromium touch-emulation journeys against that harness. It saves synthetic screenshots and evidence under ignored `test-results/`. Browser binaries must be installed for Playwright. These checks do not establish physical iPhone/iPad Safari performance.
- `node tests/e2e/studio.mjs` checks every candidate page, GLB/clip, media download, decoded audio audition and portrait layout. Set `QUEST_E2E_URL` to the private app origin to check deployed delivery. This checks audio decoding, not listening quality.
- `scripts/docs/build.sh` runs the strict documentation build and local media/link checks using the pinned Python requirements.

The GitHub Application workflow runs these source/unit/database/build checks against a fresh PostgreSQL 16 service. Main builds publish an immutable `ghcr.io/thaynes43/haynes-quest:sha-<commit>` image with provenance. Deployment uses that image’s digest through haynes-ops GitOps; no application deploy changes dev-env.

## Hosting boundary and remaining work

Database preparation merged in haynes-ops [#2849](https://github.com/thaynes43/haynes-ops/pull/2849), with a pod-local DNS fix in [#2850](https://github.com/thaynes43/haynes-ops/pull/2850). The dedicated `haynes_quest` role owns its database and has no superuser/create-role/create-database privileges. Provisioning alone receives the administrator Secret. The fixture runtime receives only the prepared application Secret; it never receives the separate Immich Secret.

The deployment deliberately sets both `NODE_ENV=development` and `QUEST_FIXTURE_MODE=true`, with the exact HTTPS application origin. The default image refuses fixture mode under production. This is a private synthetic development workload; its ingress and Secret mounts enforce the additional separation from real photos.

The private route is live at `https://haynes-quest.haynesops.com` behind `traefik-internal`, whose LoadBalancer is LAN-only at `192.168.40.203`. The zone is managed by UniFi DNS and excluded from the public Cloudflare DNS controller. Deployment merged through haynes-ops [#2851](https://github.com/thaynes43/haynes-ops/pull/2851), with restart and ownership evidence in [#2852](https://github.com/thaynes43/haynes-ops/pull/2852). Check the [handoff](../../.agents/HANDOFF.md) for the current immutable image.

Tomorrow: configure the separate Authentik client and admitted-player policy, verify actual login/callback journeys, authorize real subject setup/media, settle birth-date/age-anchor and name-disambiguation previews, review exact asset versions, and play on physical iPad/iPhone Safari. Real photo-derived likeness remains private follow-on work; no private family reference has been sent to an external generator.
