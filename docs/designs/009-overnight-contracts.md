# DESIGN-009: Overnight implementation contracts

- **Status:** Accepted for the provisional PLAN-004 implementation defaults by the Astra coordinator; owner product questions remain deferred
- **Date:** 2026-09-11
- **Scope:** Historical private synthetic MVP, adapter implementation, server persistence and isolated asset studio
- **Superseded gameplay:** Tom’s later correction in [DESIGN-010](010-era-combat-loop.md) replaces this document’s individual-memory age updates and memory-path-only level. The runtime privacy boundary remains until authenticated integration is authorized/configured.

## Runtime and identity

Use TypeScript, pnpm, React/Vite, direct Three.js, Hono/Node, Postgres/Drizzle and a pinned Better Auth dependency for tomorrow's OIDC work. Per-frame simulation stays outside React. A single server serves the built client and API. No application identity is accepted from a client header, request body or query. Fixture sessions use a random server-assigned identity in a signed HttpOnly SameSite cookie, a dedicated session secret and database persistence. Fixture startup requires explicit `QUEST_FIXTURE_MODE=true` and refuses `NODE_ENV=production`. The private preview deployment deliberately sets `NODE_ENV=development` as well as that flag; the default image stays fail-closed. The fixture process refuses Immich credentials. It only returns fictional data. Production has no placeholder session route. OAuth and admission remain disabled pending tomorrow; do not present a fake sign-in button.

The private preview is a distinct development workload. It receives only its prepared application database/session Secret, never the Immich or database administrator Secret. Prefer a cluster-only service and private access path; any ingress must demonstrably use the internal ingress boundary. The review studio is served at `/studio/`, contains original synthetic candidates and public-safe project documentation, and cannot read runtime private data. Mutations require same-origin requests, JSON and an explicit CSRF header. Rate/size limits, bounded upstream calls, safe errors and no private logging are required.

## Current shared data and HTTP contract

Shared types live in `src/shared/contracts.ts`. Server endpoints return JSON directly; errors are `{error: {code, message}}`. Client uses same-origin cookies and `X-Quest-Request: 1` for mutations. API routes:

- `GET /api/session` returns `{player: {id, label}, mode: 'fixture', csrfHeader: 'X-Quest-Request'}` and establishes a fixture session if permitted.
- `GET /api/saves` returns `{saves: SaveSummary[]}`.
- `POST /api/setup/preview` accepts `{name, birthDate, fromDate?, toDate?, limit?}` and returns `{previewId, subjects: SubjectOption[], candidates: MemoryPreview[], coverage: {fromDate, toDate, incomplete, scanned}, selectedIds: string[]}`. An unresolved name fails closed; ambiguous names return subject choices without a library-wide asset search. A second preview request may include `subjectId` selected from the issued choices. Defaults select chronologically spaced images, cap selection at 24 and cap discovery independently.
- `POST /api/saves` accepts `{previewId, selectedIds, title?}` and returns `SaveView`; confirmation freezes subject, ordered assets/dates, explicit age source and all rule versions. Require 1–24 available selected images, no duplicate/unissued IDs.
- `GET /api/saves/:id` returns `SaveView` only to its owner.
- `POST /api/saves/:id/actions` accepts the strict `GameplayActionRequest` below and returns the current authoritative `SaveView`. The server derives combat and progression from the frozen plan.
- `POST /api/saves/:id/recover` and `/finish` are retired. They return `409 ACTION_ROUTE_RETIRED` for v2 saves, or `409 LEGACY_SAVE_READ_ONLY` for preserved v1 saves. They never mutate either format.
- `GET /api/saves/:id/media/:memoryId` checks owner, frozen manifest membership and boss-release state before delivering bounded image bytes. Locked v2 pictures have no `mediaUrl` in the save and return `409 MEDIA_LOCKED`; legacy media preserves its prior owner-only availability. Fixture media is clearly synthetic SVG; private upstream media must be validated, stripped of metadata by decoding/reencoding where appropriate, no-store, nosniff and never return upstream URLs/keys.
- `GET /healthz` reports liveness; `GET /readyz` verifies database readiness without credentials in output.

A mutation has exactly these fields:

```json
{
  "actionId": "3c1f7e18-988a-4c7b-ae44-ae0100da5379",
  "expectedRevision": 5,
  "action": {
    "type": "attack",
    "levelId": "level-1-2020",
    "encounterId": "level-1-2020-ordinary-a"
  }
}
```

`actionId` is a UUID; `expectedRevision` is a nonnegative integer. Unknown fields and forged damage, health, age or abilities fail strict validation. Every action requires `levelId`:

| Action type | Additional fields | Result |
| --- | --- | --- |
| `collect-equipment` | `pickupId` | Collect and equip the frozen tool; no client-supplied stats. |
| `attack` | `encounterId` | Apply the equipped tool’s damage after prerequisites and cooldown. |
| `take-hit` | `encounterId` | Apply encounter damage and current guarding after eligibility/cooldown. Spatial contact is detected locally. |
| `guard` | None | Open a bounded guard window with the strongest owned shield. |
| `recover-memory` | `memoryId` | Reveal one released picture; age stays unchanged. |
| `consume-memory-bundle` | None | Consume the fully revealed bundle and atomically advance age, abilities, appearance and period. |
| `retry-level` | None | Restart a fallen level with full health and restored encounters, retaining equipment and earlier progress. |

Receipts preserve the latest 128 accepted actions per save. An exact retry reuses the entire original payload, including its revision, and does not apply twice. Reusing a retained UUID with a changed payload returns `ACTION_ID_REUSED`; an outdated revision returns `SAVE_REVISION_STALE`. After receipt pruning, the original retry still has an old revision and cannot reapply. A caller that changes the revision of a pruned UUID is submitting a new payload; the bounded ledger does not promise lifetime UUID recognition. Level and progression prerequisites still prevent duplicate bundle consumption.

Errors retain the `{error:{code,message}}` envelope. `INVALID_REQUEST` is 422; authentication/CSRF/ownership use 401/403/404 without leaking another owner’s state; limits use 429. Rule conflicts use 409, including the cooldown/tool/encounter prerequisites, `MEMORY_BUNDLE_INCOMPLETE`, `LEVEL_NOT_ACTIVE`, `ACTION_NOT_AVAILABLE`, the receipt codes above, `MEDIA_LOCKED`, `LEGACY_SAVE_READ_ONLY` and `ACTION_ROUTE_RETIRED`. Invalid stored records fail closed with `503 SAVE_DATA_INVALID`. The synthetic `/api/fixture-media/:memoryId` route also supports setup previews; its illustrations are public fixture content, not a private-photo delivery path.

The private Immich adapter is implemented/tested behind an injected authorized caller contract; it is never reachable via fixture routes. Real setup requires an admitted identity and explicit connection/subject grant once OAuth exists. Private read-only live smoke can validate endpoint schemas separately with redacted counts only. Discovery scans at most eight person-filtered pages of 100 images, then chronologically samples at most 96 candidates across that bounded scan; selection freezes at most 24. A longer library remains explicitly incomplete, with actual coverage dates and date-range refinement. The provisional adapter uses the UTC calendar date from `fileCreatedAt`; real-person activation must settle source-local date/timezone and age-anchor policy. Later upstream date corrections do not alter a frozen save or revoke media by themselves; person membership, visibility and availability are rechecked on every fetch.

## Journey, appearance and level

The fictional subject is **Demo Adventurer**, born `2020-01-01`; default memories are `2020-07-01`, `2024-01-01`, `2027-01-01` (ages 0, 4 and 7 in whole years). These dates/thresholds are demonstration rules, not developmental claims. Memory IDs are stable within the frozen save. A save starts at age zero, empty recovery and `move, interact`. `jump` unlocks when post-boss bundle consumption reaches age 4. Earlier abilities persist. Appearance contract `synthetic-traveler-v1` selects `infant` below 4 and `child` from 4; an explicit private subject-appearance ID can later map to reviewed age variants. Never infer age, gender or likeness from a photo, name, photo count or library coverage. A journey ends at its last represented age.

`SaveView` contains identity/title/subject, memories with `state` (`locked`, `released`, `revealed`, `consumed`) and optional owner media URLs, recovery IDs, age, abilities, appearance, completion, revision/timestamps and rule versions. It also includes `format` (`legacy-v1` or `era-combat-v2`) and nullable `adventure`. The adventure exposes phase, active level, completed level and consumed-memory IDs, collected inventory/equipped ID, player health and remaining cooldown durations. Active levels include dates/age targets, memory IDs, frozen pickups and encounters with authoritative health/availability. `SaveSummary` includes the save format. [Shared TypeScript contracts](../../src/shared/contracts.ts) define exact fields; dates and labels are private runtime data, never diagnostics.

The corrected fixture has a 2020 opening level at age zero and a 2024 level entered at age four. Each has useful equipment, two ordinary encounters and a boss. Boss victory releases pictures; individual revelation keeps age unchanged. Full-bundle consumption advances to four, then seven at the selected journey’s end. Earlier equipment and abilities persist. Legacy memory-walking saves remain read-only records, not fabricated boss completions.

Scene axes are Three.js Y-up, meters, forward -Z. Movement is camera-relative WASD/arrows or a captured virtual stick; E uses, F attacks, Shift guards, Space jumps when unlocked. Dragging the world rotates the camera independently of the stick/action pointers. Clamp simulation delta, handle pause/visibility explicitly, clear input on blur/cancellation, and dispose listeners, animation frames and GPU/audio resources on exit. Local spatial simulation is not an authoritative anti-cheat system.

The isolated candidate review loads catalog traveler/environment GLBs and temporary encounter/equipment studies. New authored creatures and equipment are in production. Private release of candidate artwork still requires the recorded exact-version review; no owner approval is inferred from a code merge. The approved audio map remains empty, so the game is silent with persistent mute/volume preferences.


## Lead art and interface decisions

Working style `storybook-v001`: parchment #f5ebdc, plum #342c46, leaf #557363, honey #dca953; warm sunlight, blue shade, rounded matte silhouettes. Traveler is a fictional faceless cloth pilgrim with a plum hood, leaf tunic, honey clasp and small satchel; infant has a large hood/head, short limbs and low waddling posture, child has longer limbs and upright posture. Shared motifs avoid any franchise costume. Landmark is a timber crescent gateway holding a small amber lantern; memory keepsake is a thick rounded wooden frame with a honey corner token. Ground/path/step are independent kit pieces. Required clips: `idle`, `move`, `interact` at both ages; child adds `jump`. Blender works in meters with documented glTF export conversion to Y-up.

Lead owns UI composition and copy. The current interface has a parchment home/setup surface, saved journeys, finite photo selection, a combat HUD, equipment and encounter feedback, and a post-victory picture panel. The grow action explicitly names the target age. The next-period panel identifies the new year and only announces actually unlocked abilities. Errors and artwork retries stay accessible inside an open dialog. Fictional illustrations, candidate artwork and the unconnected photo library are described honestly without exposing OAuth implementation details in player flows.


## Evidence required

Test ownership, session forgery, CSRF, duplicate/stale/forged actions, boss/reveal/consumption ordering, concurrent requests, frozen manifests, no-match/ambiguous people, bounded pagination, media revocation/format/size and adapter fixture isolation. Use disposable real Postgres integration tests and verify persistence across server restart. Browser automation exercises keyboard and simultaneous touch, refresh/resume and scene cleanup; state exact engine/browser coverage, never equate emulation with physical Safari. Build app and strict docs, review exact commits, merge checked PRs and audit deployed image/route/database boundary. Candidate reviews record actual media, checksums, provenance and separate coordinator/owner decisions.
