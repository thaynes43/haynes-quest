# DESIGN-003: Photo connections, people, and authored characters

- **Status:** Proposed
- **Last updated:** 2026-09-10
- **Satisfies:** [PRD-001 R-03, R-12, R-14, R-17, R-18](../prds/001-project-brief.md)
- **Governed by:** [ADR-001](../adrs/001-authentik-sign-in.md); [proposed ADR-002](../adrs/002-web-game-stack.md)

## Overview

The photo library drives the character roster and game imagery. A user configures a self-hosted photo-service URL, API key, and people's names. The application resolves those people and retrieves their eligible photos. For the family PoC, developer-authored models are assigned to the resulting character records. Immich is the first adapter; supporting another photo service requires an adapter with equivalent capabilities, not just substituting a URL.

Connections, configured people, characters, and personal assets are account-private by default in this proposal. Household sharing can be designed later; configuring a person does not create a login account or grant anyone access to the game.

## Setup and player journey

1. Sign in, then configure the photo-service URL and API key. The server validates connectivity and the required read capabilities; the UI shows connection status without returning the saved key.
2. Enter people's names. Resolve each against the connected library's people records. When a name is ambiguous, present the available matches for selection. A missing name stays unresolved with guidance to check the library's people naming/indexing.
3. Create roster entries for resolved people. Assign validated assets made through the [developer authoring workflow](002-asset-pipeline.md). Adding a person alone does not make a character model; an entry without an asset explains that character setup is incomplete.
4. Offer available characters for a new game. Keep existing saves visible if an asset or photo connection is unavailable. Missing photos have a recoverable setup state without implying that a new model is being generated.
5. Reuse authored assets across games. A developer can replace an asset with a validated version while retaining the character ID and existing saves. Asset assignment must check ownership and validity; the exact authoring/import interface will be designed for the family PoC.

## Data and ownership contract

| ID | Record or boundary | Proposed rule |
| --- | --- | --- |
| D-01 | Photo connection | Store a game-owned connection ID, owner ID, provider type, normalized base URL, protected credential reference, configuration revision, and capability/status metadata. Never substitute the household's endpoint for a user's failed connection. |
| D-02 | Configured person | Store a game-owned person ID, owner/connection IDs, upstream person ID, and display name. Resolve names during setup; subsequent photo queries use the resolved ID scoped to that connection. |
| D-03 | Playable character | Assign an opaque game-owned character ID linked to the configured person. Keep this ID stable across name edits and authored-asset replacement. Source-person IDs from different connections are not interchangeable. |
| D-04 | Saved game | Reference the character ID and validate its ownership/readiness on creation. Resume preserves character identity and progress. Do not replace a missing person with another search result or delete saves on connection failures. |
| D-05 | Photo retrieval | Scope every request by owner, connection, and resolved people, then apply the agreed game-use filter. Paginate and bound retrieval. Character references and collectibles may use different subsets of the same person's photos. |
| D-06 | Credential handling | The authenticated setup form submits the API key to the server over the app's protected origin. Encrypt stored keys with key material delivered outside the database, support replacement/removal, and redact them from read responses, logs, browser storage, game code, and art assets. |
| D-07 | Destination handling | User URLs must be reachable from the server and permitted by deployment policy. Allow the intended private photo hosts explicitly; validate scheme, origin, DNS resolution, redirects, and time/size limits. Bind credentials to that origin and reject unrelated local services or metadata endpoints. This is a photo adapter, not a general URL-fetch proxy. |
| D-08 | Data access | Apply owner checks to connection, person, character, save, and asset operations. Knowing an upstream ID or private asset path is not authorization. Photo-service permissions remain the maximum upstream access available to the adapter. |

Source-person rename updates display metadata without changing the character. A source-person deletion/merge or a connection pointed at a different library requires explicit reconciliation; preserve the old identity and saves rather than silently rebinding them. Connection removal blocks new upstream work. The retention/deletion policy for private photos and authored assets remains to be settled before implementing destructive cleanup.

## Authored-asset lifecycle and future automation

Assign an asset version only after its [asset checks](002-asset-pipeline.md) pass. Update the character's asset-version pointer atomically; failed export or validation leaves the previous good asset intact. Browser play uses the prepared asset. Personal reference images, editable models, and runtime exports remain private.

Automatic photo-to-character generation is [BL-01](../BACKLOG.md#bl-01-automatic-playable-character-generation), deferred unless Tom chooses a release beyond the family PoC. Generation jobs, queues, progress UI, retries, and provider trials are outside this PoC design, including simulated implementations.

## Immich adapter evidence

Immich documents named people and retrieving the assets containing a person in its [people feature](https://docs.immich.app/features/facial-recognition/). The reviewed [OpenAPI snapshot](https://github.com/immich-app/immich/blob/2a626220415ea4f22da6846e26d37852664254bf/open-api/immich-openapi-specs.json) includes name lookup through `GET /search/person`, people listing, metadata search with person filters, image retrieval, and header-based `x-api-key` authentication. The routes are relative to the configured API base.

That snapshot advertises `3.2.0-rc.0` and marks some legacy search/pagination fields deprecated. It is capability evidence, not a version recommendation or proof of the household deployment's version. Pin and test the adapter against supported server versions, including pagination, required key permissions, name collisions, and person-filter semantics. Do not assume a display name or unrestricted text search selects the intended person's photos.

No live photo library, personal people records, or API credentials were accessed for this design.

## Validation and deferred decisions

Use synthetic libraries to test empty, single-person, and larger rosters; duplicate/missing names; identical upstream IDs across connections; renamed/deleted people; and key/URL replacement. Test cross-account access for all records and assets, blocked destinations and redirects, missing permissions, pagination, no-photo results, and missing or invalid authored assets. Verify that valid asset replacement and rejected replacements both preserve character identity and saved progress, with the previous asset retained when replacement fails.

Reference-selection rules, final photo filters, the authored-asset assignment interface, roster/resource limits, and private-data retention still need design. Open-ended means data-configured rather than an unbounded resource promise. Immich is the first integration; public signup, shared household connections, and other providers have not been selected.
