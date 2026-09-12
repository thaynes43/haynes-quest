# WO080: Required identity and photo stage readiness

Status: Read-only preparation and the first bounded persistence repair are complete; identity and curation implementation remain the required next stage. September 12, 2026. Native Sol xhigh audit at base `624478e`, retained at `/home/dev/work/quest-identity-readiness/test-results/identity-readiness-audit.md`. The audit made no private-photo, credential, OAuth, browser or production request.

The daughter's MVP is incomplete without identity and curated personal memories. PLAN009 delivers the longer courses first; this record prevents the next required stage from being mistaken for optional campaign backlog.

## Verified foundations and gaps

- Authentik-only is accepted in ADR001, but real sign-in and admission do not exist in the runtime. Outside fixture mode, protected routes currently fail closed with 401. The installed Better Auth dependency is not wired into server startup.
- Current fixture sessions provide owner-scoped previews, saves, actions and released media. They must remain isolated from real photo credentials and content.
- The Immich adapter implements exact-name resolution, ambiguity handling, opaque person identifiers, bounded person/date-filtered discovery, current-authorization checks and sanitized derivatives. Startup does not construct it. There is no authenticated pre-publication thumbnail endpoint.
- Setup currently offers a temporary preview and a flat selected-ID array. It cannot persist a prepared player profile or named little/big memory assignments. Durable drafts, explicit role assignment and the parent/player relationship need design and implementation. Manual uploads are also unimplemented.
- The existing v3 plan can remain the initial published journey contract: two explicit `{minorOne, minorTwo, major}` assignments flatten server-side to six validated, chronological memories. Keep published routes, selected assets and started progression frozen.

## First bounded engineering repair

The audit found that `PostgresQuestStore.createSave` in `src/server/db/postgres-store.ts` dropped `command.planMode`, the returned rule versions and the initial adventure abilities. The in-memory implementation already retains these. A requested durable route-memory save therefore becomes the default v2 plan; fixing only the mode would leave inconsistent v3 abilities/versions.

The repair below corrects all three fields together and adds a real disposable-Postgres test covering v3 creation, reload and progression with the authored routes, initial jumping, exact memory roles and catalog v4. Preserve existing records and v2 defaults. This bug does not affect the ephemeral playground fixture, whose configuration requires the in-memory store.

## PostgreSQL initialization checkpoint

The first repair merged in [PR42](https://github.com/thaynes43/haynes-quest/pull/42) as `8dbfec295a3f16ec181f2bc595a6580f271f956d` after exact-head review at `5099cf1`. `src/server/db/postgres-store.ts` now passes the requested plan mode into `createAdventureForSave` and stores the constructor's returned rule versions and initial abilities. The default call path remains the v2 path, and stored rows still load through the existing versioned validation without a migration.

`tests/server/postgres.integration.test.ts` adds a disposable-Postgres regression for route-memory v3 creation, two store reopenings and first-chapter progression. It checks catalog v4, both authored route IDs, four ordinary encounter instances plus the boss, the two-minor/one-major memory roles, initial jumping and the persisted age-zero-to-four transition. TypeScript, scoped lint, the production build and 442 local tests pass. All 11 PostgreSQL cases were discovered but skipped locally because `QUEST_TEST_DATABASE_URL` was unset; the pull request's dedicated PostgreSQL CI then passed all 11 cases and 453 total tests (Application run `34716760627`, verify job `103615295399`). The container and Documentation checks passed. This server-only repair is not part of the separately pinned ephemeral playground release and does not wire real sign-in or photos.

## Lead decisions and next implementation

Keep account identity separate from the journey's subject: the child's birthday and personal chronology cannot come from an account label, photo coverage or this synthetic fixture. Ratify the smallest parent-prepared family workflow and admission rule before opening private media endpoints. The first slice does not need a general public account system or a child-owned OAuth account merely to play a parent-prepared journey.

Then add authenticated owner-scoped profile/draft resources, source grants and sanitized candidate thumbnails; accept named assignments instead of an unordered selection; publish atomically with revision/idempotency checks. Current authorization must still govern private bytes after publication. The full visual editor and lifetime campaign remain separate.

The private setup needs an explicitly supplied birthday, selected subject and chosen images with trustworthy or deliberately corrected dates. Do not infer the daughter's date from “six years old,” assume the fixture's endpoint of seven, or query the family library during the level pass. Keep real names, dates, image bytes, upstream IDs and credentials out of published docs and diagnostic artifacts.

## Source-only deployment readiness

A second read-only audit at operations main `98ef332` finds no Quest OIDC provider, app, client secret, middleware or environment wiring in Git. This is source evidence, not a claim about uninspected live Authentik state. Existing Authentik blueprints support a confidential authorization-code provider with strict callback and immutable subject; the Cigar Journal blueprint is the relevant precedent. Quest's Immich ExternalSecret is fully declared but neither workload mounts it, and normal Quest lacks Authentik/Immich egress. Both workloads remain fixture mode.

Use application-managed OIDC and a unique issuer/subject ownership mapping, with an explicit manager admission policy; never trust forwarded identity headers or make email/display name the owner key. Keep the synthetic playtest separate when enabling the normal app. Exact callback, provider configuration, secret provisioning, constrained egress, current authorization and private-adapter wiring belong to the next-stage acceptance. Credentials and family details must enter through approved private setup, not this record. The sanitized source audit is `/home/dev/work/quest-authentik-readiness/test-results/quest-authentik-readiness/audit.json`. No private media, Secrets, OAuth ceremony or cluster mutation occurred.

## Runtime authentication implementation audit

A bounded native source audit at app `ee46810` recommends the installed `better-auth@1.7.4` generic OAuth plugin with PostgreSQL sessions and the existing pool; no new direct runtime library is needed. Local package code and official documentation support discovery/JWKS ID-token verification, state, PKCE, nonce and raw Hono handler mounting. Configure verified ID tokens, explicit PKCE, no IdP-initiated sign-in, static origin, no account linking, encrypted provider tokens and no offline refresh scope. Those are implementation recommendations, not currently enforced behavior.

Use separate auth tables plus a unique exact `(issuer, subject)` identity mapping to the existing owner ID. Add a database uniqueness constraint on `(provider_id, account_id)`; library lookup handling alone does not supply it. Fixture mode must reject real identity/media configuration and never construct the auth handler. Keep durable application sessions and re-check the application's explicit admission rule on protected requests.

For the first family manager slice, the audit proposes a single configured immutable admitted subject plus a dedicated confidential Authentik client bound to the existing administrators group. The lead has not ratified that audience, the proposed 12-hour local session lifetime or logout/revocation semantics. An upstream group removal does not by itself revoke an existing local session; do not claim immediate IdP revocation without implementing and testing it. Settle these rules before opening any personal media endpoint. Actual identity/secret values belong in approved private configuration.

Source references: [generic OAuth](https://better-auth.com/docs/plugins/generic-oauth), [Hono integration](https://better-auth.com/docs/integrations/hono), [PostgreSQL adapter](https://better-auth.com/docs/adapters/postgresql), [Authentik OAuth2 provider](https://docs.goauthentik.io/add-secure-apps/providers/oauth2/), and [Authentik bindings](https://docs.goauthentik.io/add-secure-apps/bindings-overview/). The detailed audit is retained on the PVC at `/home/dev/work/quest-identity-runtime-contract/test-results/identity-runtime-contract.md`. It made no production edits, credential or live-identity calls, private-photo requests or cluster mutations.
