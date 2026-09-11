# Running the private preview

The overnight build uses **fictional memories and temporary game art**. OAuth and real player admission remain tomorrow’s work. The Immich adapter exists behind a private server contract, but the fixture web process cannot receive its credentials or expose a real-photo route.

## Private cluster preview

Open [Haynes Quest](https://haynes-quest.haynesops.com) from the home network. The [asset catalog](https://haynes-quest.haynesops.com/studio/assets/catalog.html) lives beside the game. This route uses internal Traefik and LAN DNS; it is not a public internet deployment.

The deployed MVP passed complete keyboard and Chromium touch-emulation journeys on September 11, 2026. A separate live test retained the same signed session and complete save state across replacement of the application pod. See the [verification record](004-overnight-verification.md) for exact versions, checks and limitations.

## Local development

Use Node 24 and the repository’s pinned pnpm version. Install with `pnpm install --frozen-lockfile`. Start a dedicated disposable PostgreSQL database, then provide `DATABASE_URL`, a randomly generated `BETTER_AUTH_SECRET` (at least 32 characters), `QUEST_FIXTURE_MODE=true`, `NODE_ENV=development` and `QUEST_APP_ORIGIN=http://127.0.0.1:3000` in your shell or an untracked local environment file. Never use a real photo credential in this process.

Run `pnpm build`, then `pnpm start` from the repository root. The server applies checksum-tracked migrations from `migrations/` before listening on port 3000. Open `http://127.0.0.1:3000`. A signed, HttpOnly browser cookie identifies a server-assigned fictional player; clearing it starts another preview player. New fixture sessions are capped globally at 120 per minute. A five-minute bounded maintenance pass removes expired sessions and unused previews, preserving all saves and their referenced previews. This temporary identity is not an additional production login method.

For client development, set the API origin to `http://localhost:5173`, run `pnpm dev:server` and `pnpm dev` in separate terminals, and open that exact origin. Vite proxies the API. Do not mix `localhost` and `127.0.0.1` origins within one session.

## Playing

Choose **Start a journey**, preview Demo Adventurer’s memories, select the moments to include and begin. The fictional birth date is January 1, 2020. Move with WASD/arrow keys or the touch stick. Drag the scene to look around. Approach the next glowing frame and press E or **Remember**. Recovering the age-four memory grows the traveler and unlocks Space/**Jump**. Jump over the low step, find the last memory and reach the lantern gate.

Each recovery is saved by the server. **Save & leave** returns to the journey list; **Continue** restores the same frozen memories, age, abilities and safe checkpoint. The scene’s temporary movement shapes may change without changing saved identity or earned progress. A one-memory selection or a journey that never learns to jump uses a reachable flat route.

The preview is silent while sound candidates await review. Mute and volume preferences are retained locally; all required feedback is visible.

## Asset studio

Build the documentation using [the documented commands](../README.md#build-and-preview-the-site). The app serves the generated `site/` directory at `/studio/`; its catalog is `/studio/assets/catalog.html`. The standalone MkDocs preview is also available through `scripts/docs/serve.sh` at loopback port 8000.

The static studio contains original fictional references, candidate media and the repository’s public-safe project documentation. It is isolated from application records and has no database or Immich access. Tom’s exact-version approval is required before any candidate model, animation, material or sound enters gameplay. Pending approval does not prevent browsing or downloading the candidate package.

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
