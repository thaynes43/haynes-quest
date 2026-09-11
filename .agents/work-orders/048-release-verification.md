# WO048 — Final private playtest and catalog release

Status: Completed, September 11, 2026. This record closes the requested Fable-assisted playtest/polish and complete visual catalog delivery. The final source-record update is documentation only; it does not change the deployed image.

## Delivered links

Use these from the home network:

- [Playtest](https://haynes-quest-playtest.haynesops.com/)
- [Visual asset catalog](https://haynes-quest-playtest.haynesops.com/studio/assets/catalog.html)
- [What is included and still open](https://haynes-quest-playtest.haynesops.com/studio/assets/playtest.html)

Choose Demo Adventurer and keep all three fictional pictures to test both chapters. No real family photos, admitted login or new artwork approval is implied. The normal demo address retains the older prototype.

## Release evidence

App PR28 merged `9ccc7a8d89210f6da9ba12e031e124eade52ba6b`; PR30 merged `b15bc98f1a6bec1108815bdea75794f86e1323db`. [Main Application 34649668374](https://github.com/thaynes43/haynes-quest/actions/runs/34649668374) and [Documentation 34649668390](https://github.com/thaynes43/haynes-quest/actions/runs/34649668390) passed. There were 236 tests, including nine real PostgreSQL cases. Image publication, provenance attestation and cosign signing succeeded; anonymous exact-tag GHCR lookup returned 200 with the matching digest. This records those checks, not a separate independent attestation verification.

Exact deployed image: `ghcr.io/thaynes43/haynes-quest:sha-b15bc98f1a6bec1108815bdea75794f86e1323db@sha256:d7eddba8db5ccf60ea03bdcb7ba921e7486106b1ab34e7380c53929a355d4599`.

[Ops PR2857](https://github.com/thaynes43/haynes-ops/pull/2857) added the isolated review under WO044. [Ops PR2858](https://github.com/thaynes43/haynes-ops/pull/2858) passed all nine checks; its rendered diff changed only the review image. Root merged exact head `cd7cbd2344b3405e91c06311cf67e340141a6c63` as `f1e5133ada07014c225fdff32129ab320cd5ecd5`, declared scoped activity and reconciled `frontend/haynes-quest`. Flux applied the same revision. New review pod UID `96a8569c-5397-41df-b85e-36f3e4cc6ecc` was Ready with zero restarts and the exact digest.

## Actual live checks

The first private release, on 9ccc/787262, passed at 21:29 UTC:

- Ordinary DNS resolved through all three CoreDNS replicas and TLS was valid. The initial pre-record NXDOMAIN cache expired naturally; no DNS workaround or restart was used.
- Health/readiness 200, exact game bundle, all 15 gameplay GLB hashes, four review pages and the guide.
- Real held-joystick Help/album/sound/Save interactions, exactly one retained save and zero page errors.
- Actual-control boss defeat, visible fictional pictures, reload/resume, deliberate absorption to age four and jumping, entry into 2024 and saved-resume of that chapter. Two targeted probes passed with zero page errors.

The catalog-only release retained the unchanged game bundle: `index-BPeATrrp.js`, 1,001,106 bytes, SHA256 `15487f825f0f7d8125144d3a1eb49c37e5212bf6c7d0bb8de8f368f141bc6051`. Its [final live report](../../docs/assets/media/release/v001/catalog-live.json), captured at 21:41 UTC on the exact deployed image, passed:

- All 26 review pages and 15 known fragments.
- All 50 WebP files: exact bytes, MIME and hashes. All 24 GLBs: exact hashes and MIME.
- Desktop and phone: 33 cards, 15 “In playtest” labels, 57 rendered image elements from 50 unique derivatives, no overflow and no model/audio loading from the landing page.
- An actual phone tap into Nap's paused-checkpoint link, a visible partial model with 356px canvas and all five expected clips.
- No page, console, HTTP, request or external-request errors. This final check did not replay gameplay, video or audio, or run authoring.

[Runtime snapshot](../../docs/assets/media/release/v001/runtime-state.json) confirms the final review pod plus unchanged normal app UID `d3e0117d-9dc5-4716-9343-2a740147171b` and dev-env UID `c3a94756-af35-405e-93bc-eb05c2979d3a`, all Ready with zero restarts. Initial activity `act-205400-187494` ended at 21:29:39 UTC; catalog activity `act-213939-197262` ended at 21:41:38 UTC. Browser leases are released.

## Scope and retained evidence

[WO046](046-coordinator-final-playtest.md) retains full two-chapter keyboard and saved/resumed touch acceptance, including harness limitations. [WO043](043-touch-menu-regression-results.md) covers corrected multi-touch menus. [WO047](047-visual-asset-catalog.md) covers all 33 catalog entries, local browser proof, inventory and Nap's defects. Its earlier local audit recorded 11 MP4 metadata cancellations without independently establishing their cause; video playback was outside that audit. The final live report has no such cancellations. The committed report corrects the raw report's mistyped `sourceCommit` (`30b15bc98`) to the verified full catalog merge SHA; its deployed image and observed checks are unchanged. The original raw report remains preserved on the PVC.

Raw local evidence remains on the PVC: game `/home/dev/work/quest-parody-obby/test-results/live-review/live/`; catalog `/home/dev/work/quest-visual-catalog/test-results/catalog-live/`; publication `/home/dev/work/quest-visual-catalog/test-results/catalog-publication.json`. Full Fable logs, bundle and outputs remain in the game worktree's `test-results/fable-042/`. No credential or family photo is included in the committed evidence.

The bounded PLAN005 is complete. Physical Safari/device performance, child playtests, exact final artwork approval, audio listening, real photos and admission, parent/admin curation, The Besties and broader lifetime progression remain the explicit next work in the handoff. No further model production was performed to finish this release.
