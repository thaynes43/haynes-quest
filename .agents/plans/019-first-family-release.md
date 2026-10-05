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

Tom started this plan in a Claude Code session on September 25. The lane table below records those original assignments and start conditions. Current sessions follow [TEAM.md](../TEAM.md), including the October 5 Codex Blender exception; the driving coordinator retains architecture, UX, user-visible copy, integration and final review.

- **Bounded code lanes:** native GPT-6 Sol (`gpt-6-sol`, `xhigh`) from a Codex driver or Sonnet 5.5 from Claude Code, each in a task worktree under `/home/dev/work` on an `agent/<slug>` branch.
- **Concept images and Blender work:** the driving Astra session owns sequential concepts, art direction and final visual review. Tom's October 5 [TEAM.md](../TEAM.md) ruling now permits fresh native GPT-6.1 Sol (`gpt-6.1-sol`, `xhigh`) authors for useful remaining Blender work, one exclusive scene lease per bounded work order. Historical Astra/Opus assignments below record prior deliveries, not the current Codex routing.
- **Review:** use the current driving provider's bounded review lane in TEAM.md, followed by coordinator review. Do not routinely start another Opus session under the current quota direction.

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

## Progress (September 29, final signed image)

- **Live:** at the final gameplay checkpoint, app main `24bc5105cfc253ab5c1472eb44693546ea04e0d6` passed verification, image provenance and signing and was pinned in both releases at OCI digest `sha256:0dd8f0d1687427e33b536328dfd7415cde1122e4e80bf6ff2e5bbdaa56cb5207` by [haynes-ops #3260](https://github.com/thaynes43/haynes-ops/pull/3260). [Ops #3261](https://github.com/thaynes43/haynes-ops/pull/3261) raised both HelmRelease timeouts to 20 minutes for this large image. Flux, both HelmReleases and exact-image pods were Ready, with zero pod restarts. World A is template v6/publication r6 with 12/12 photos decoded; World B remains v5/r5 with 9/9. Started runs remain frozen until **Start fresh**. [The final gameplay release record](../evidence/family-world-final-release.json) preserves the dated deployment and hosted checks; read live pod imageIDs before treating a checkpoint as current.
- **Content:** catalog v11 places exact v001 Inator Monster, Putty Grunt, Lab Robot, Demon Band Idol and Radio Host Showman as labeled private candidates. A4 has two authored scare spots; Playroom, [Rescue Harbor #135](https://github.com/thaynes43/haynes-quest/pull/135), [Casita #137](https://github.com/thaynes43/haynes-quest/pull/137) and [Rooftop City #139](https://github.com/thaynes43/haynes-quest/pull/139) kits are wired and live. [Web-slinger Helper #136](https://github.com/thaynes43/haynes-quest/pull/136) is the A3 second friendly only in World A v6. The hosted A3 and B2 synthetic editor routes completed all required legs, fights and memories with zero recoveries or browser/media errors, and all eight Casita/Rooftop GLBs matched source hashes. The [v5 release record](../evidence/family-world-v5-release.json) and [Helper hosted check](../evidence/web-slinger-hosted-a3.json) preserve their earlier checkpoints. Tom's exact-version reviews remain pending under PRD-004 Q-03.
- **Owner gates:** [haynes-ops #3214](https://github.com/thaynes43/haynes-ops/issues/3214), Tom's real sign-in/portal/photo check, exact model and audio review, listening and physical Safari play with the children. The fixture checks use synthetic media and lockstep Chromium; they are not authenticated family journeys, real-time frame-cost tests or physical-device feel measurements. Its editor A3 route uses the v1 friendly roster, so the local v6 family-card check remains the Helper interaction evidence.

## Result

In progress. See [HANDOFF](../HANDOFF.md).
