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

The source-confirmed in-cluster Immich server address is `http://immich-server.photos.svc.cluster.local:2283`. The future integration design must decide eligible photos, credential delivery, browser image access, caching, and behavior when Immich is unavailable.

The review did not read family photos or personal asset metadata. This bootstrap creates no Immich credential or runtime integration.

## Decisions for the implementation stage

Host name, namespace, runtime image, app health endpoint, resource budget, and persistence will be recorded with the deployment design. Local hosting does not imply adding a public ingress.

[ADR-001](../adrs/001-authentik-sign-in.md) establishes Authentik OIDC as the sole player sign-in method, following Haynes Network. Plan a dedicated game application/client in the existing Authentik service. Its registration values, callbacks, secret delivery, and allowed-player policy must be designed before provisioning. Authentication does not change the planned local hosting boundary. No game authentication resources exist yet.

Deployment completion will require a published image, a merged `haynes-ops` change, a successful Flux rollout, and the agreed live browser checks.
