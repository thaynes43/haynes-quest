# DESIGN-009: Overnight implementation contracts

- **Status:** Accepted for the provisional PLAN-004 implementation defaults by the Astra coordinator; owner product questions remain deferred
- **Date:** 2026-09-11
- **Scope:** Private synthetic MVP, adapter implementation, server persistence and isolated asset studio

## Runtime and identity

Use TypeScript, pnpm, React/Vite, direct Three.js, Hono/Node, Postgres/Drizzle and a pinned Better Auth dependency for tomorrow's OIDC work. Per-frame simulation stays outside React. A single server serves the built client and API. No application identity is accepted from a client header, request body or query. Fixture sessions use a random server-assigned identity in a signed HttpOnly SameSite cookie, a dedicated session secret and database persistence. Fixture startup requires explicit `QUEST_FIXTURE_MODE=true` and refuses `NODE_ENV=production`. The fixture process refuses Immich credentials. It only returns fictional data. Production has no placeholder session route. OAuth and admission remain disabled pending tomorrow; do not present a fake sign-in button.

The private preview is a distinct development workload. It receives only its prepared application database/session Secret, never the Immich or database administrator Secret. Prefer a cluster-only service and private access path; any ingress must demonstrably use the internal ingress boundary. The review studio is served at `/studio/`, contains only original synthetic candidates, and cannot read runtime private data. Mutations require same-origin requests, JSON and an explicit CSRF header. Rate/size limits, bounded upstream calls, safe errors and no private logging are required.

## Shared data and HTTP contract

Shared types live in `src/shared/contracts.ts`. Server endpoints return JSON directly; errors are `{error: {code, message}}`. Client uses same-origin cookies and `X-Quest-Request: 1` for mutations. API routes:

- `GET /api/session` returns `{player: {id, label}, mode: 'fixture', csrfHeader: 'X-Quest-Request'}` and establishes a fixture session if permitted.
- `GET /api/saves` returns `{saves: SaveSummary[]}`.
- `POST /api/setup/preview` accepts `{name, birthDate, fromDate?, toDate?, limit?}` and returns `{previewId, subjects: SubjectOption[], candidates: MemoryPreview[], coverage: {fromDate, toDate, incomplete, scanned}, selectedIds: string[]}`. An unresolved name fails closed; ambiguous names return subject choices without a library-wide asset search. A second preview request may include `subjectId` selected from the issued choices. Defaults select chronologically spaced images, cap selection at 24 and cap discovery independently.
- `POST /api/saves` accepts `{previewId, selectedIds, title?}` and returns `SaveView`; confirmation freezes subject, ordered assets/dates, explicit age source and all rule versions. Require 1–24 available selected images, no duplicate/unissued IDs.
- `GET /api/saves/:id` returns `SaveView` only to its owner.
- `POST /api/saves/:id/recover` accepts only `{memoryId}` and returns `SaveView`. An already recovered ID is an idempotent success; another save's ID and later memories fail. Server derives age, appearance and abilities atomically from frozen dates. Reject forged age/unlock/ownership fields.
- `POST /api/saves/:id/finish` accepts `{}` and returns `SaveView`; all memories must be recovered. Finishing is idempotent.
- `GET /api/saves/:id/media/:memoryId` checks owner and frozen manifest membership before delivering bounded image bytes. Fixture media is clearly synthetic SVG; private upstream media must be validated, stripped of metadata by decoding/reencoding where appropriate, no-store, nosniff and never return upstream URLs/keys.
- `GET /healthz` reports liveness; `GET /readyz` verifies database readiness without credentials in output.

The private Immich adapter is implemented/tested behind an injected authorized caller contract; it is never reachable via fixture routes. Real setup requires an admitted identity and explicit connection/subject grant once OAuth exists. Private read-only live smoke can validate endpoint schemas separately with redacted counts only.

## Journey, appearance and level

The fictional subject is **Demo Adventurer**, born `2020-01-01`; default memories are `2020-07-01`, `2024-01-01`, `2027-01-01` (ages 0, 4 and 7 in whole years). These dates/thresholds are demonstration rules, not developmental claims. Memory IDs are stable within the frozen save. A save starts at age zero, empty recovery and `move, interact`. `jump` unlocks at recovered age 4. Earlier abilities persist. Appearance contract `synthetic-traveler-v1` selects `infant` below 4 and `child` from 4; an explicit private subject-appearance ID can later map to reviewed age variants. Never infer age, gender or likeness from a photo, name, photo count or library coverage. A journey ends at its last represented age.

`SaveView` contains `{id,title,subject:{id,label},memories:[{id,date,ageYears,label,mediaUrl}],recoveredIds,ageYears,abilities,appearance:{contractVersion,subjectAppearanceId,stage},completed,revision,createdAt,updatedAt,versions:{journey,age,progression,appearance}}`. `SaveSummary` is its identity/title/subject/age/progress/completed/timestamps subset. Dates/labels returned to authorized gameplay are private runtime data, never diagnostics. Client optimistic pose does not become authoritative progression.

One bounded garden path places memories in manifest order. The initial route is flat and fully reachable by moving; after jump unlock a low step demonstrates the added action. If a journey never unlocks jump, it uses a flat route. A finish marker beyond the last memory requires interaction. Re-entry spawns at the last recovered safe checkpoint. Scene axes are Three.js Y-up, meters, avatar forward -Z. Movement is camera-relative WASD/arrows or a captured virtual stick, interact E/button, jump Space/button; right-side drag rotates camera independently of left-stick/action pointers. Cap dt and collisions, clear inputs on blur/visibility/pointercancel, and dispose all listeners, RAF, GPU and audio resources on exit.

Gameplay uses expressly temporary code-built shapes and synthetic photo drawings. Candidate art/audio remains only in `/studio/` until Tom approves exact versions. No candidate sound is silently promoted. User-started audio management supports persistent mute/volume and visual equivalents; an empty approved cue mapping remains silent and playable.

## Lead art and interface decisions

Working style `storybook-v001`: parchment #f5ebdc, plum #342c46, leaf #557363, honey #dca953; warm sunlight, blue shade, rounded matte silhouettes. Traveler is a fictional faceless cloth pilgrim with a plum hood, leaf tunic, honey clasp and small satchel; infant has a large hood/head, short limbs and low waddling posture, child has longer limbs and upright posture. Shared motifs avoid any franchise costume. Landmark is a timber crescent gateway holding a small amber lantern; memory keepsake is a thick rounded wooden frame with a honey corner token. Ground/path/step are independent kit pieces. Required clips: `idle`, `move`, `interact` at both ages; child adds `jump`. Blender works in meters with documented glTF export conversion to Y-up.

Lead owns all UI composition and copy. The app has a calm parchment home/setup surface, one clear primary action, save cards, a finite photo-selection view, and an immersive landscape scene with restrained HUD and large touch controls. Fixed copy: title “Haynes Quest”; subtitle “A little journey through memories.”; fixture banner “Private preview · Fictional memories”; start “Start a journey”; resume “Continue”; default journey title “The first clearing”; interaction “Remember”; finish “Complete journey”; return “Save & leave”; collection guidance “Follow the glow to your next memory.”; unlock “You remembered how to jump.”; finish heading “A little more of you, remembered.”; studio link “Asset studio”. Show no OAuth setup internals in the player flow.

## Evidence required

Test ownership, session forgery, CSRF, duplicate/out-of-order/forged recovery, concurrent requests, frozen manifests, no-match/ambiguous people, bounded pagination, media revocation/format/size and adapter fixture isolation. Use disposable real Postgres integration tests and verify persistence across server restart. Browser automation exercises keyboard and simultaneous touch, refresh/resume and scene cleanup; state exact engine/browser coverage, never equate emulation with physical Safari. Build app and strict docs, review exact commits, merge checked PRs and audit deployed image/route/database boundary. Candidate reviews record actual media, checksums, provenance and separate coordinator/owner decisions.
