# OPS-001: Hosting context

- **Status:** Draft
- **Last reviewed:** 2026-09-10
- **Deployment status:** Planned; no game workload exists

## Confirmed direction

Tom wants local hosting through `haynes-ops`. Application source belongs in this repository; cluster manifests belong in `thaynes43/haynes-ops`.

## Existing patterns to reuse when the application exists

The closest local web-app precedent is the `frontend` namespace, the shared app-template OCI chart, and an internal route such as `haynes-quest.haynesops.com`. The established local route uses `traefik-internal`, the internal DNS target, and the HaynesOps certificate. These are proposed deployment defaults, not manifests already applied for this game.

Sibling applications release versioned images to GHCR, then update the pinned image in `haynes-ops` through a separate PR. Their signed-image release pattern is the reference when this project gains executable code. Choose required probes, resources, storage, and network access from the eventual runtime design.

## Immich reference

The source-confirmed household Immich address is `http://immich-server.photos.svc.cluster.local:2283`. This is a deployment reference, not the game's fixed upstream. Users configure a photo-service URL and API key; the server accesses that connection's resolved people and eligible photos under [DESIGN-003](../designs/003-photo-connections-and-people.md). Deployment must allow the intended private photo destinations without granting a general network proxy.

The review did not read family photos or personal asset metadata. This bootstrap creates no Immich credential or runtime integration.

## Decisions for the implementation stage

Host name, namespace, runtime image, app health endpoint, resource budget, and persistence will be recorded with the deployment design. Local hosting does not imply adding a public ingress.

[ADR-001](../adrs/001-authentik-sign-in.md) establishes Authentik OIDC as the sole player sign-in method, following Haynes Network. Plan a dedicated game application/client in the existing Authentik service. Its registration values, callbacks, secret delivery, and allowed-player policy must be designed before provisioning. Authentication does not change the planned local hosting boundary. No game authentication resources exist yet.

[ADR-002](../adrs/002-web-game-stack.md) proposes a Node/Hono application serving the browser build and API, plus dedicated Postgres storage for configuration, characters, generation jobs, sessions, and saves. Automatic character preparation adds a separate worker/provider boundary; its concrete tooling and compute are not selected. Deployment design must cover migrations, encrypted API-key storage with separately delivered key material, backup/restore, private generated assets, job concurrency/recovery, and credential revocation. [DESIGN-002](../designs/002-asset-pipeline.md) describes the candidate processing tools. These resources have not been created.

Deployment completion will require a published image, a merged `haynes-ops` change, a successful Flux rollout, and the agreed live browser checks.
