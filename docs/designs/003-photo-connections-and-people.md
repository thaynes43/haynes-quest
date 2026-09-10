# DESIGN-003: Photo connections, people, and memory timelines

- **Status:** Proposed
- **Last updated:** 2026-09-10
- **Satisfies:** [PRD-001 R-03, R-12, R-14, R-17, R-18, R-20–R-24](../prds/001-project-brief.md)
- **Governed by:** [ADR-001](../adrs/001-authentik-sign-in.md); [proposed ADR-002](../adrs/002-web-game-stack.md)

## Overview

The photo library supplies the subjects and memories for chronological journeys. A user configures a self-hosted photo-service URL, API key, and people's names. The application resolves those people and retrieves eligible photos and dates under [DESIGN-004](004-memory-journey.md). Every subject can use the same generic avatar; selecting another person needs no new model. Immich is the first adapter; supporting another photo service requires an adapter with equivalent capabilities, not just substituting a URL.

Connections, configured people, journey timelines, memories, and personal photos are account-private by default in this proposal. Shared nonpersonal avatar artwork is separate from those records. Household sharing can be designed later; configuring a person does not create a login account or grant anyone access to the game.

## Setup and player journey

1. Sign in, then configure the photo-service URL and API key. The server validates connectivity and the required read capabilities; the UI shows connection status without returning the saved key.
2. Enter people's names. Resolve each against the connected library's people records. When a name is ambiguous, present the available matches for selection. A missing name stays unresolved with guidance to check the library's people naming/indexing.
3. Retrieve eligible photos and validate the dates needed for a chronological journey. Preview usable coverage and the proposed chapters. [DESIGN-006](006-memory-age-and-abilities.md) records the explicit age source needed for ability progression and the pending birth-date versus age-anchor choice; photo coverage alone does not establish age.
4. Offer resolved people with usable memories for a new game. Confirming a subject creates a journey using the shared avatar made through the [developer authoring workflow](002-asset-pipeline.md). Missing photo setup has a recoverable state.
5. Keep existing saves visible through connection or asset failures. A person rename or avatar replacement preserves the selected subject and collected memories. Later library changes follow an explicit timeline-update policy rather than silently rebuilding a saved journey.

## Data and ownership contract

| ID | Record or boundary | Proposed rule |
| --- | --- | --- |
| D-01 | Photo connection | Store a game-owned connection ID, owner ID, provider type, normalized base URL, protected credential reference, configuration revision, and capability/status metadata. Never substitute the household's endpoint for a user's failed connection. |
| D-02 | Configured person | Store a game-owned person ID, owner/connection IDs, upstream person ID, and display name. Resolve names during setup; subsequent photo queries use the resolved ID scoped to that connection. |
| D-03 | Journey subject and timeline | Use the stable game-owned configured-person ID as the subject identity. Keep journey definitions and chapter/memory identities stable under DESIGN-004, independently of the generic avatar asset. Source-person IDs from different connections are not interchangeable. |
| D-04 | Saved game | Reference the subject and versioned journey definition; validate ownership and usable content on creation. Resume preserves the subject, chapter, and memory progress. Do not replace a missing person with another search result or delete saves on connection failures. |
| D-05 | Photo retrieval | Scope every request by owner, connection, and resolved people, then apply the agreed game-use filter. Paginate and bound retrieval. Retain usable capture/event dates and their available precision for timeline construction; date validation and correction behavior follow DESIGN-004. |
| D-06 | Credential handling | The authenticated setup form submits the API key to the server over the app's protected origin. Encrypt stored keys with key material delivered outside the database, support replacement/removal, and redact them from read responses, logs, browser storage, game code, and art assets. |
| D-07 | Destination handling | User URLs must be reachable from the server and permitted by deployment policy. Allow the intended private photo hosts explicitly; validate scheme, origin, DNS resolution, redirects, and time/size limits. Bind credentials to that origin and reject unrelated local services or metadata endpoints. This is a photo adapter, not a general URL-fetch proxy. |
| D-08 | Data access | Apply owner checks to connection, person, journey, memory, save, and private-media operations. Knowing an upstream ID or private asset path is not authorization. Photo-service permissions remain the maximum upstream access available to the adapter. |

Source-person rename updates display metadata without changing the journey's subject. A source-person deletion/merge or a connection pointed at a different library requires explicit reconciliation; preserve the old identity and saves rather than silently rebinding them. Connection removal blocks new upstream work. The retention/deletion policy for private photos and timeline metadata remains to be settled before implementing destructive cleanup. Birth information and explicitly supplied gender/preferences are private subject or journey metadata under the eventual setup policy. Do not infer gender from photos or source names; [DESIGN-005](005-era-enemy-catalog.md) defines its use in enemy selection.

## Memory timeline and shared avatar

The proposed versioned journey definition retains chapter ordering and memory identity with a save. New uploads, corrected dates, and removed photos require the reconciliation behavior described in DESIGN-004. Retaining progress never grants access to a revoked photo.

Publish a shared avatar version only after its [asset checks](002-asset-pipeline.md) pass; failed export or validation leaves the previous good asset intact. Browser play uses the prepared model, independently of the selected person. Adding an eligible person is configuration and photo work, not an art-production task.

Automatic photo-to-character generation is [BL-01](../BACKLOG.md#bl-01-automatic-playable-character-generation), deferred unless Tom chooses a broader release and separately reintroduces person-specific avatars. Generation jobs, queues, progress UI, retries, and provider trials are outside this PoC design, including simulated implementations.

## Immich adapter evidence

Immich documents named people and retrieving the assets containing a person in its [people feature](https://docs.immich.app/features/facial-recognition/). The reviewed [OpenAPI snapshot](https://github.com/immich-app/immich/blob/2a626220415ea4f22da6846e26d37852664254bf/open-api/immich-openapi-specs.json) includes name lookup through `GET /search/person`, people listing, metadata search with person filters, image retrieval, and header-based `x-api-key` authentication. The routes are relative to the configured API base.

That snapshot advertises `3.2.0-rc.0` and marks some legacy search/pagination fields deprecated. It is capability evidence, not a version recommendation or proof of the household deployment's version. Pin and test the adapter against supported server versions, including pagination, required key permissions, name collisions, person-filter semantics, and date-field mapping/precision. Do not assume a display name or unrestricted text search selects the intended person's photos. Person lookup does not establish birth information or complete lifetime coverage.

No live photo library, personal people records, or API credentials were accessed for this design.

## Validation and deferred decisions

Use synthetic libraries to test empty, single-person, and larger configured-person lists; duplicate/missing names; identical upstream IDs across connections; renamed/deleted people; and key/URL replacement. Test cross-account access, blocked destinations and redirects, missing permissions, pagination, and no-photo results. Cover missing infancy, sparse years, a single year, missing/invalid dates, older photos uploaded later, and revoked photos. Verify that name edits, library changes, and valid or rejected avatar replacements preserve subject identity and saved progress, retaining the previous avatar when replacement fails.

Final photo filters, chapter grouping, birth-information setup, timeline refresh, resource limits, and private-data retention still need design. Open-ended means data-configured rather than an unbounded resource promise. Immich is the first integration; public signup, shared household connections, and other providers have not been selected.
