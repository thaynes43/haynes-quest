# Current handoff

- **Updated:** 2026-09-11, core gameplay correction after Tom played the demo
- **Stage:** PLAN-005 in progress. Tom rejected the memory-walking demo as the wrong core loop and inadequate presentation. PLAN-004 remains historical implementation/test evidence, not acceptance of the intended game.
- **Team:** driving Astra max owns architecture, UI/copy, art judgment and serial image generation. [TEAM.md](TEAM.md): native Sol xhigh for ordinary work, fresh native Astra max for every Blender task, explicitly authorized separate Fable 5.1 xhigh review/coding.
- **Next work:** Finish PLAN-005 browser play/visual checks, current asset production and review, and checked release handling. OAuth/admission, audio listening and physical iPhone/iPad Safari checks remain deferred. No dev-env restart is authorized.

## Current task: correct the game loop

[PLAN-005](plans/005-era-combat-loop.md) and [DESIGN-010](../docs/designs/010-era-combat-loop.md) govern the rebuild: find useful equipment, fight period enemies, defeat the boss, then reveal/consume memories to advance age and enter the next period. Root works in `/home/dev/work/quest-era-boss-loop` on `agent/quest-era-boss-loop` from `3502ac7`. Sol `era_loop_code_audit` returned a read-only schema/authority review; Sol `photo_tile_diagnosis` reproduced working fixture images in deployed Chromium and prepared isolated CSP fix `50a738b`, with no physical Safari claim. Root owns contracts, visuals and writing. Demo use of existing candidates was asked through the question tool and is pending; no approval is inferred. Real Immich access remains separate from fixture mode. No dev-env restart.

### Rebuild checkpoint

Root integrated shared contracts `97aab9e`, game interfaces `2649e57`, server/reducer/migration `f7df719`, game loop `4b1bad4`, hidden-frame timing fix `a07db99`, and real PostgreSQL validation/fixes `d25377d`. The current root source also contains the new scene, GLB/texture loading, combat HUD, victory pictures and legacy album UI. Lead-written docs now correct the old per-picture age rule.

Actual checks so far: integrated typecheck/lint/build passed; 65 non-Postgres tests passed; the server lane ran eight integration tests against isolated PostgreSQL 16.14, including migration preservation, races, receipt pruning and invalid persisted data, then deleted its disposable Job and ended activity. Root's Chromium smoke renders the authored infant and six environment/model resources, with zero page errors. Full keyboard/touch boss-to-growth journeys are still being checked; do not infer their success from the smoke test.

Local candidate harness: root-owned `QUEST_E2E_PORT=4390 pnpm exec tsx tests/e2e/serve-fixture.ts`, listening on `127.0.0.1:4390`, memory storage, exec session `23536`. This is a local review, not persistence or private-live release evidence. Source dependencies are installed in the task worktree. Strict docs build passed using the old worktree's Python venv on PATH. Root screenshots are under ignored `test-results/` until selected for the durable verification record.

[WO-013](work-orders/013-era-combat-rebuild.md) owns the code rebuild. [WO-014](work-orders/014-blender-era-2020.md) is blocked before authoring: root and one Sol relay each received `agent thread limit reached` when dispatching the required fresh Astra. No scene owner exists and no Blender scene changed. Blockling and Signal Moth concepts/prompt/provenance are saved; remaining concepts, new enemy/equipment models and their review packages are unfinished. Root's procedural encounter/equipment studies are clearly temporary, not Blender candidate exports. Do not declare PLAN-005's visual acceptance complete.

Candidate demo-use approval remains unanswered. The current private deployment remains the previous `3502ac7` image (wedge catalog correction), digest `sha256:743bca475c2e19d2534ecd3be7f952e52d0d5adb5724599f1285218f91e87e37`. No PLAN-005 code or assets have been deployed. The new code can be checked and merged without treating that as asset approval; gameplay promotion still waits on the recorded exact-version review boundary.

## Latest review correction

[WO-012](work-orders/012-keepsake-wedge-reference.md) corrects the keepsake concept’s missing rear support in the BACK view. Root selected concept v002 after serial built-in image edits and independent Astra inspection confirmed the existing v001 GLB already has the grounded wedge. The original concept, exact model and its pending owner approval remain preserved. The correction branch is `agent/quest-keepsake-wedge-review` in `/home/dev/work/quest-keepsake-wedge-review`; checked image publication updates the private catalog through haynes-ops. This changes review material only. The [current GitOps image pin](https://github.com/thaynes43/haynes-ops/blob/main/kubernetes/main/apps/frontend/haynes-quest/app/helmrelease.yaml) and its deployment work order track subsequent catalog releases; the overnight audit below names its tested baseline.

## Open and play

From the home network, open the [private game](https://haynes-quest.haynesops.com) or [asset review catalog](https://haynes-quest.haynesops.com/studio/assets/catalog.html). [The runbook](../docs/ops/002-private-preview.md) gives local startup and controls; [the verification record](../docs/ops/004-overnight-verification.md) links safe live evidence.

The fictional journey starts at memory age zero, collects three chronological memories, grows from infant to child, unlocks jumping while retaining earlier actions, and reaches a finish. Keyboard/mouse and simultaneous touch controls, finite setup/selection, album, server-owned saves/resume and mute/volume preferences are implemented. Gameplay uses code-built placeholders and remains silent: no catalog candidate has Tom's approval.

## Verified overnight release baseline

- Application [PR #21](https://github.com/thaynes43/haynes-quest/pull/21) delivered the playable MVP as `6263dc42443eb5c33943d26f668da386df4900d4`. Catalog [PR #23](https://github.com/thaynes43/haynes-quest/pull/23) delivered all candidates, complete review pages and WAV/viewer delivery fixes as **`71c45b5fdba69cb38c59ccd336935218b322cd5c`**.
- Overnight baseline image: `ghcr.io/thaynes43/haynes-quest:sha-71c45b5fdba69cb38c59ccd336935218b322cd5c@sha256:2129b02e1d1804ffe3a89edc7e9e2e3eca9258cf18cdaca762130680d8f78675`. [Main workflow 34568145769](https://github.com/thaynes43/haynes-quest/actions/runs/34568145769) passed verification, publication, provenance and signing. Anonymous image manifest/configuration/layer retrieval passed.
- Final deployment [haynes-ops #2853](https://github.com/thaynes43/haynes-ops/pull/2853) merged `026deb4584dac21532547ec174f3a8c36058d66d`. Flux Kustomization Ready/Healthy at that exact revision, HelmRelease Ready, one Ready pod with zero restarts and matching image digest. Health/readiness/catalog, nine GLBs and four WAV MIME checks passed. [Ops evidence #2854](https://github.com/thaynes43/haynes-ops/pull/2854) merged `17ac580cea032b91a720043b35865df541214e06`; activity ended.
- PR #23 passed typecheck, lint, all **46 tests including three fresh PostgreSQL 16 integration tests**, client/server build, strict docs/media links and container build. Earlier Fable 5.1 xhigh adversarial findings and lead fixes are in [WO-009](work-orders/009-fable-review.md); its separate CLI session was reaped.
- Live PostgreSQL-backed keyboard/touch journeys passed at 05:13:46 UTC on the initial MVP image, including growth, jump, finish, refresh/resume, simultaneous touch inputs, pointer cancellation/blur, portrait layout and scene cleanup. Separate same-cookie application-pod replacement preserved identical saved state and then completed the route; another session received 404 for that save/media. [Ops evidence #2852](https://github.com/thaynes43/haynes-ops/pull/2852) records the persistence audit. Catalog changes did not change the game client.
- Full **live final-image studio audit** passed at 06:15:02 UTC: 12 pages, nine visible GLBs, seven playable/pausable clips, four decoded WAVs, 112 media files and seven exact manifests. Model hashes/sizes matched; every phone viewer measured 358 × 358 within 390 × 844. Two real touch-orbit checks passed; no page/console errors, failed responses or external requests. [WO-011](work-orders/011-catalog-verification.md) links evidence. Chromium 153 / Playwright 1.63 with SwiftShader establishes functional emulation, not physical Safari or performance.

The overnight completion record was written after its deployment. Later review-material releases keep their own image and live evidence in GitOps; the baseline image above identifies the original full audit.

## Privacy and persistence boundary

The reachable app is an explicitly enabled **development fixture**, with server-assigned fictional identities in signed HttpOnly/SameSite cookies. Same-origin JSON mutations require the CSRF header. Strict schemas, ownership, transactional monotonic progression, idempotency, frozen manifests, bounded requests/session issuance and expiry maintenance are implemented and tested. The runtime has only its dedicated application Secret, no Immich/admin Secret or service-account token, internal-Traefik ingress and DNS/Postgres egress. Public hosting is not enabled.

Prepared ExternalSecrets and dedicated database provisioning merged through haynes-ops #2848–#2850; initial deployment was #2851. Private audit cookies were removed and temporary Jobs cleaned. Audits left fictional saves intentionally; no direct database cleanup was used.

The separate Immich adapter implements fail-closed person resolution, opaque IDs, bounded filtered discovery (at most 800 assets → 96 spaced candidates → 24 frozen selections), explicit truncated coverage, permission revalidation and Sharp thumbnail sanitization. Frozen dates/ages survive source metadata edits. Fixture routes refuse Immich credentials and cannot activate this adapter. An isolated Immich 3.1.0 schema and one bounded JPEG transport smoke passed without retaining private values/media; this does not prove an admitted-player journey. Source-local dates/age anchors and real subject setup remain future decisions. No family reference entered image generation or the static site.

## Candidate inventory and resource ownership

[The complete v001 catalog](../docs/assets/catalog.md) includes eight original source concept images; two animated traveler GLBs; keepsake, ground tile, path tile, low step, tree, stone and arrival landmark GLBs; seven traveler clips; and four processed sound auditions with original takes, measurements and provenance. Root selected all visual candidates after source/export/render/browser intake. Every GLB passed Khronos with zero errors/warnings; the keepsake has one expected unused-UV info. Auditions decode, but this session could not listen to them. All exact-version owner approvals remain pending.

Travelers: [WO-007 evidence](work-orders/007-blender-travelers-evidence.md), durable masters `/workspace/haynes-quest/travelers/v001`. Static kit: [WO-010 evidence](work-orders/010-blender-clearing-kit-evidence.md), masters `/workspace/haynes-quest/clearing-kit/v001`. Manifests retain checksums and reproducible sources; root independently retrieved/hash-verified all seven prop masters. Do not regenerate completed candidates to resume this project.

Blender scene released at 05:33:31 UTC, no render jobs remain; audio generation queue is released. Artifacts live on the dedicated authoring PVCs, downloadable through their service `/artifacts/` routes. Never factory-reset the live Blender scene: it unloads the addon. Any next Blender task needs a fresh Astra owner and an explicit exclusive scene lease.

Root worktree `/home/dev/work/haynes-quest-overnight-mvp`, completion branch `agent/quest-completion`; durable history is [WO-004](work-orders/004-coordinator.md) and [completed PLAN-004](plans/completed/004-overnight-mvp.md). Native lanes have finalized. The root memory-only local harness on port 4173 was stopped by verified PID; no task-local server remains. The original dev-env UID `c3a94756-af35-405e-93bc-eb05c2979d3a` and zero container restart counts were rechecked after the final rollout. [Earlier pre-MVP activation](../docs/ops/003-authoring-activation-evidence.md) is historical; this task did not restart dev-env.

## Next bounded work

1. Configure Authentik OAuth/callback and settle admitted-player/sharing policy before real subject/media routes become reachable. Validate actual authenticated setup, ownership and cross-session/device resume.
2. Settle source-local date and explicit age-anchor behavior; plan private person-specific likeness without publishing family media or sending it to external generators.
3. Review the exact v001 visual/audio candidates, including listening. Promote only approved versions and verify their game integration.
4. Test actual iPad/iPhone Safari and selected PC hardware, recording device/browser versions and frame-time/load/memory behavior.

Broader combat, era enemies, story, additional biomes, music/voices, gamepad and automatic photo-to-3D remain backlog. [PLAN-002](plans/002-foundation-prototype.md) stays open; provisional defaults are not owner rulings.
