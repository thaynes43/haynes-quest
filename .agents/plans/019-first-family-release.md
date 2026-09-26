# PLAN-019: First family release

- **Status:** In progress (started September 25, 2026)
- **Depends on:** Completed PLAN-012–018; supersedes the unratified identity steps of [PLAN-010](010-parent-prepared-memories.md)
- **Requirements/designs:** [PRD-004](../../docs/prds/004-family-release.md), [ADR-005](../../docs/adrs/005-family-sign-in-and-admission.md), [DESIGN-024](../../docs/designs/024-family-journeys.md), [DESIGN-025](../../docs/designs/025-growth-moves-and-vertical-courses.md), [DESIGN-026](../../docs/designs/026-personal-era-casts.md)

## Outcome and scope

This plan is complete when all of the following hold:

- The family release runs at `https://quest.haynesnetwork.com` behind Authentik, admitting `authentik Admins` and `family`, with a Haynes Network portal tile.
- Two private child journeys are published from Immich: the older child on World A (four chapters) and the younger on World B (three chapters). Each has auto-picked photos an administrator can swap.
- Chapters are vertical obby courses with lifts, bounce pads, optional ability routes and themed decor. Big memories grow the avatar and unlock the move ladder.
- The locked era casts and themed props are produced as catalogued candidates and enter the levels as they land. Placeholders cover anything not yet modeled.
- The fictional playtest keeps working unchanged.

Private names, birthdays and photos never enter git, PRs, logs, docs or test artifacts.

## Team and lanes

A Claude Code session (`claude-opus-5-5`) started by Tom drives this plan. It keeps architecture, UX and all user-visible copy, integration and final review.

- **Bounded code lanes:** native Opus 5.5 subagents (`claude-opus-5-5`, xhigh), each in its own `~/work/<slug>` worktree on an `agent/<slug>` branch.
- **Concept images and all Blender work:** a separate Codex **Astra** art-lead session, `gpt-6-astra` at `max`, via `agent-run`, per [TEAM.md](../TEAM.md). It generates concepts serially and dispatches fresh native Astra `max` Blender subagents, one per exclusive scene lease.
- **Adversarial review:** a native Opus 5.5 reviewer at the end.

| Lane | Work order | Owner | Owned paths | Starts |
| --- | --- | --- | --- | --- |
| A. Family sign-in | [WO106](../work-orders/106-family-sign-in.md) | Opus subagent | `src/server/auth/**`, auth migrations, `config.ts`, `requirePlayer`, session contract, sign-in shell | Now |
| B. Growth moves and vertical pieces | [WO107](../work-orders/107-growth-moves-and-vertical-pieces.md) | Opus subagent | `src/game/obby.ts`, `src/shared/authored-level*.ts`, theme-kit registry, editor commands for the new pieces | Now |
| C. Hosting and Authentik (haynes-ops) | [WO108](../work-orders/108-family-hosting.md) | Coordinator | haynes-ops `frontend/haynes-quest/**`, `network/authentik/app/blueprints/**` | Drafted now; merged after A and D |
| D. Family journeys | [WO109](../work-orders/109-family-journeys.md) | Opus subagent | `src/server/family/**`, `src/server/photos/**`, family migrations, `src/client/family/**` (coordinator writes the UX copy) | Domain modules now; routes and UI after A merges |
| E. Portal tile | [WO110](../work-orders/110-portal-tile.md) | Opus subagent | haynesnetwork catalog seed plus icon, and its deploy pin | Now |
| F. Era casts and themed kits | [WO111](../work-orders/111-era-cast-art-lead.md) | Codex Astra via `agent-run` | `docs/assets/**`, `scripts/assets/<new ids>/**`, catalog inventory, DESIGN-005 roster | Started September 26 after Tom locked DESIGN-026 |
| G. Family worlds | WO112 | Opus subagent(s) | `scripts/levels/family-*`, world fixtures, traversal tests | After B lands and the table is locked; chapters with known casts (A5, B3) may start earlier |

## Steps

1. **Contracts.** Merge PRD-004, ADR-005, DESIGN-024–026, this plan and the work orders. *(This PR.)*
2. **Parallel build.** Run lanes A, B and E, plus D's domain modules: rebase, auto-pick, plan builder and fake-Immich tests. Prepare lane C's ops PR as a draft.
3. **Lock.** When Tom is back (about three hours after 17:40 UTC), re-ask Q-05 with the DESIGN-026 table. On lock, start lane F. The art lead records the roster, then produces concepts and models in chapter order. Start lane G's themed generators.
4. **Integrate.** Merge A, then D's routes and admin/child UI with coordinator copy. Integrate the family plan with the B ladder and the G worlds. Main CI (typecheck, lint, tests including PostgreSQL, build, levels, strict docs) must pass. Squash-merge each PR.
5. **Deploy.** Merge the ops PR:
   - the family release is pinned to the new signed image, fixture mode off, `QUEST_APP_ORIGIN` set to the new host;
   - the Immich secret is mounted;
   - the Authentik public provider and application are bound to the two groups;
   - `traefik-external` ingress and network policy are in place.

   Pin the playtest to the same image in fixture mode. Merge the portal tile. Verify through Flux: HelmRelease Ready, pod Ready, zero restarts, `/healthz` and `/readyz` returning 200, and the sign-in redirect reaching Authentik with the correct client id, PKCE and redirect.
6. **Private setup.** In the family pod, the operator CLI creates both children from Immich, confirms Immich's explicit birthdays, chooses the templates, auto-picks and publishes. It reports counts only. A server-side check decodes every chosen photo through the sanitizer.
7. **Assets flow in.** Each art-lead candidate PR adds the catalog and review, the kit or catalog v7 entry and the placeholder swap. Deploy it through the same image-pin path, then verify the live studio pages and media.
8. **Review and close out.** An Opus 5.5 adversarial review covers auth, admission, private media, progression and traversal claims. Fix its findings. Update HANDOFF, the asset catalog and the evidence record. Then report plainly which owner checks remain: Tom's first sign-in, photo review, asset review, and physical Safari play with the kids.

## Completion evidence

- CI and local check results for each merged PR; the image digest; the Flux revision; the HelmRelease generation; pod identity and restarts.
- A signed-out request is redirected to sign-in, and the Authentik authorize URL carries `client_id=haynes-quest`, `code_challenge_method=S256` and the exact redirect. The fake-IdP tests cover tampering, missing groups, non-admin access and logout.
- The operator publishes both journeys, reporting slot counts and zero `needs-photo`. All chosen photos decode through the sanitizer; only counts and hashes of sanitized output are recorded, and no identifiers.
- Autopilot traverses every required edge of all seven chapters using only the moves available at each chapter's start age. Lockstep browser completion runs for each world with synthetic photos.
- Every new asset appears in the catalog with its review page and live URLs verified.
- Owner checks that stay pending until Tom does them, never simulated: his real sign-in, the portal tile click, photo swaps, final art and audio review, and device play.

## Result

In progress. See [HANDOFF](../HANDOFF.md).
