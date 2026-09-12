# PLAN010: A parent-prepared personal journey

- **Status:** Draft, September 12, 2026. Required next MVP stage after the longer playgrounds; authentication and media contracts must be ratified before implementation exposes personal content.
- **Depends on:** [PLAN009](009-daughter-playground-mvp.md) and its hosted acceptance; [identity readiness](../work-orders/080-identity-curation-readiness.md).
- **Requirements/designs:** [Authentik only](../../docs/adrs/001-authentik-sign-in.md), [parent curation](../../docs/designs/012-player-journey-curation.md), [authored levels](../../docs/designs/016-authored-levels.md), [photo boundary](../../docs/designs/009-overnight-contracts.md).

## Outcome and scope

A parent signs in, prepares a journey for their daughter, chooses actual pictures for two little memories and a big post-boss memory in each chapter, previews the resulting ages and starts that personal adventure. The child can play on the parent's prepared device without needing a separate identity-provider account. Account ownership and the journey subject are distinct. This is the lead's proposed first family workflow, not a claim that admission or personal setup is shipped.

Use the longer playgrounds as the starting templates and retain their validated mechanics. Birthday, represented periods, picture roles and completed encounter choices belong to a durable draft. Do not derive the daughter's birthday or final recovered age from the fictional 0 → 4 → 7 test. Keep manual uploads as a real source alongside Immich; an upload-only journey does not require Immich name lookup.

The parent sees thumbnails before choosing or publishing, can assign and replace named memories, and reviews the chapter transitions. Period-based suggestions offer Show more for other authorized pictures and available bosses. Source dates remain factual, and any explicitly corrected dates retain provenance. Wider selections do not bypass chronology, authorization, geometry, equipment or asset-readiness rules. Published content freezes at a revision; changing a draft cannot alter a journey already started.

This stage does not require the full visual editor, a public account system, a lifetime campaign, a new enemy batch or a bespoke avatar. Personal progression must be deliberate and durable; the separate fictional playtest continues to start fresh without saved-progress UI.

## Steps

1. Ratify the concrete family manager admission rule, Authentik callback/session/immutable issuer-and-subject mapping, source ownership and shared-device logout behavior. Follow ADR001; no email/name identity keys, forwarded-header trust or implicit real-media access for fixture sessions. Prepare missing provider/secret/egress configuration through reviewed GitOps; no dev-env changes.
2. Merge and verify the bounded PostgreSQL initializer repair in WO080 so route-memory saves retain the requested plan mode, returned versions and initial jumping ability. It does not by itself implement identity or photo setup.
3. Define durable owner-scoped subject and draft records with revision checks, named `{minorOne, minorTwo, major}` selections per chapter and an atomic, idempotent publish boundary. Verify whether the existing v3 plan represents the chosen periods/routes/cast without changing its historical semantics; version any new frozen contract explicitly rather than encoding an authored choice as guessed photo-era selection.
4. Wire admitted source grants and private sanitized candidate thumbnails. Reuse the existing Immich ambiguity, bounded discovery, source authorization and sanitizer code. Add bounded manual image admission and private storage. Keep upstream identifiers, credentials, original private bytes and actual family details out of public static files, logs, git and test artifacts.
5. Implement the parent flow: person/display name and explicit birthday; two chapter cards with period and route; visible little/little/big photo slots; available encounter choices with suggestions/Show more; review and publish. Keep the main screen practical on an iPad and use the same preview runtime as the published game. Root Astra owns layout and all user-visible copy.
6. Verify owner separation, rejected/unadmitted sessions, sign-in callback tampering, expiry/logout, revoked media, ambiguous lookup, invalid/corrected dates, source failure, duplicate or missing role assignment, draft races, upload limits and exact frozen content after publish/reload. Run meaningful tests in disposable PostgreSQL, synthetic browser journeys and an Opus 5 adversarial review if needed while Fable remains unavailable.
7. Carry checked application and narrowly scoped operations PRs through merge and live verification. Configure real names, dates, secrets and selections through approved private setup. The parent completes identity-provider login and chooses the daughter's actual memories; never fabricate completion of those actions. Then verify the family journey on the physical iPhone/iPad with no public screenshots of personal photos.

## Completion evidence

An admitted parent can sign in and later sign out; other identities and fixture sessions cannot access that parent's drafts or media. Each selected photo actually decodes in private setup and in its assigned game location. The final major memory produces the birthday-derived age shown before publication. Both authored routes remain playable with contact collection, boss-gated growth and the accepted touch/sound controls. Draft/published revisions and progression survive restart without reshuffling the cast or photos. Current source revocation prevents further private-byte access. The required checked releases, safe live evidence and parent-owned configuration are recorded in the handoff.

## Result

Not delivered. WO080 records source audits and the bounded persistence repair. The newly deployed playground is still a fictional test; personal identity, private thumbnails, curation, manual uploads and published family journeys remain required work.
