# ADR004: Versioned complete-world projects

- **Status:** Proposed, September 23, 2026
- **Deciders:** Astra implementation decision pending verification of the first complete-world slice
- **Related requirements:** [PRD003](../prds/003-complete-world-authoring.md) R-01–R-09
- **Amends:** [ADR003](003-shared-level-editor-documents.md) for future editor projects; its two published template routes and preview behavior remain valid for archived projects

## Context

The editor's first project contract is a two-element tuple. Its level IDs are the published route IDs, and its preview creates a hardcoded two-level synthetic plan. Merely adding an editor button would either overwrite a shipped route or display geometry that the saved encounter plan cannot use. Authors also need an explicit way to select a prepared cast without embedding remote assets or runtime scripts in portable JSON.

## Decision

Introduce a new bounded project version with ordered chapters and stable project-local route IDs. Keep existing project imports readable and published route documents immutable. Each chapter owns its authored layout, represented dates and frozen encounter-slot selections; its source template is provenance, not its identity. Shared pure commands, validators and CLI schema remain the authority for browser and agent edits.

The isolated preview service validates the entire project and constructs a frozen synthetic plan from exactly those chapters and selections. It accepts only fixture sessions and retains origin, size, duration and concurrent-run limits. New draft enemy definitions carry IDs, dates and one of the supported behavior presets. They produce obvious placeholders until a curated asset identity is available; project JSON never carries arbitrary URLs, scripts, approval claims or private media. The normal game registry accepts an exact asset version only after the separately recorded owner decision.

Personalized media admission, account-owned drafts and shared publishing remain governed by PLAN010 and later identity decisions. This project version is a portable authoring and private playtest format, not permission to expose family photos or change started journeys.

## Consequences

| ID | Consequence |
| --- | --- |
| C-01 | A new level can have its own stable identity and frozen preview without replacing a shipped route. |
| C-02 | Old imports are migrated or read with their existing meaning; current saved journeys remain pinned. |
| C-03 | Candidate cast and scenery can be explored without treating a placeholder or catalog card as final artwork approval. |
| C-04 | Level count, scene cost, media roles and known behavior presets remain bounded and validated. |
| C-05 | A later owner-scoped publish service can consume a validated export without inheriting browser-local storage as its authority. |
