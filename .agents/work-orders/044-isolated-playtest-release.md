# WO044: Host the candidate for private inspection

- Decision: root Astra, September11,2026,20:02UTC.
- User request: finish agentic testing/polish, then bring Tom in for deeper inspection and creative direction.
- Outcome: a separate LAN-only review deployment at `https://haynes-quest-playtest.haynesops.com`, using the checked final immutable image, fictional fixture data and the existing explicit candidate-artwork labels. Do not claim it is available until rollout/live checks pass.

## Review boundary

DESIGN007 expressly permits: “Candidates may be shown in an isolated, clearly labeled review preview.” Its preceding scope also permits prepared catalog models in the local candidate while retaining the exact-version owner gate for the normal private demo. This separate host extends that candidate review to Tom's own browser; it does not record approval or promote these assets into the normal demo. The exact15-GLB list and all review statuses remain unchanged. No final art, sound, physical-Safari or creative acceptance is inferred from automated testing.

The original proposed normal-demo image-pin promotion would have required Tom's exact artwork decision before he could inspect the corrected game at that address. The isolated candidate preview makes the actual game reviewable first, within the already allowed review workflow. Ordinary checked app and review-deployment PRs remain authorized under the original end-to-end MVP request. No new permission question is needed to provide this bounded review.

## Verified deployment design

Add a distinct HelmRelease/Service, internal Traefik route and Cilium policy inside the existing Haynes Quest app Kustomization. Review name/selectors: `haynes-quest-playtest`; origin matches its hostname; fixture mode stays true; runtime mounts only the existing app session/database Secret. No Immich, OAuth, new public route or dev-env change. Internal DNS targets `internal.haynesops`, internal Traefik has RFC1918 address192.168.40.203, Cloudflare DNS excludes this zone, and the existing wildcard TLS Secret covers the hostname.

Cookies have no Domain and are therefore host-only; each host creates its own random fixture owner. Save operations still check owner identity. Sharing the app secret/database is suitable for this owner's synthetic review, not a claim of cryptographic tenant separation. Manually copying a cookie is outside ordinary host isolation.

Starting the new image applies the additive0003 migration to the shared database. Advisory locking/checksum tracking/transactions protect concurrent migration; new nullable/defaulted columns preserve the old application's inserts and reads. The migration persists and may briefly wait on save traffic. This is authorized MVP database work; declare activity for frontend and both Quest names during rollout. Never restart the normal or dev-env pod manually.

## Completion checks

Finish WO042/043 corrections and actual browser proof, merge the checked app PR, and verify its main publication/provenance/sign jobs plus the anonymous immutable image digest. Root then replaces the scaffold's inherited old pin with this exact image before opening the review-deployment PR. Inspect rendered distinct selectors, private ingress and restricted egress; carry all Flux Local checks through squash merge and targeted reconcile.

Verify both normal and review host routing, new review image/health/readiness, actual new journey and save/resume, decoded fictional pictures and reviewed catalog media. Record the normal image/pod remaining stable and dev-env UID/restarts. End scoped activity. Deliver Tom the working playtest link and the short included/open guide; normal final-art promotion remains a later exact-version decision after his review.
