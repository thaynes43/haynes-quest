# DESIGN-024: Family journeys with real memories

- **Status:** Accepted for the first family release, September 25, 2026
- **Last updated:** 2026-09-26
- **Satisfies:** [PRD-004](../prds/004-family-release.md) R-02, R-04–R-08, R-12, R-13
- **Governed by:** [ADR-001](../adrs/001-authentik-sign-in.md), [ADR-005](../adrs/005-family-sign-in-and-admission.md) as amended by [ADR-006](../adrs/006-release-isolation-and-public-surface.md), [ADR-004](../adrs/004-versioned-world-projects.md)
- **Builds on:** DESIGN-003, 004, 006, 009, 012, 016, 020; supersedes [PLAN-010](../../.agents/plans/010-parent-prepared-memories.md)'s unratified identity proposals where they differ

## Overview

A family journey is an authored multi-chapter world, rebased onto a real child's birthday and filled with that child's Immich photos. It is built from three parts:

1. **World template.** A checked-in, name-free `level-editor-project-v2` world. Its chapters carry age bands, geometry, themes, casts and fictional preview memories. Templates are public and contain no family data.
2. **Child profile.** A private database record: display name, Immich lookup name and person, explicit birthday, and the chosen template.
3. **Memory selection.** A private, revisioned choice of one Immich photo per memory slot (`minor-one`, `minor-two`, `major`) per chapter, with captions.

Publishing freezes these three parts into a `family-world-plan-v1` snapshot. The child plays that snapshot through the existing save/action/media path.

## Player and operator journey

**Parent / administrator (first run).**

1. Tap Haynes Quest in the portal and sign in (silently, if the Authentik session exists).
2. The home screen shows "Set up your family" for an administrator.
3. **Add a child:** type the name used in Immich, and choose the match if it is ambiguous. The birthday is prefilled from Immich's explicitly entered person birth date. The administrator confirms or corrects it, sets the friendly display name, and picks the world template offered for that child's age.
4. The game rebases the chapters and auto-picks every memory photo.
5. The **Memories** screen shows each chapter as a card (era name, age band, cast portrait) with three photo slots: two little, one big. Each slot shows a private thumbnail, date and caption. **Swap** opens suggestions for that slot's allowed dates, with **Show more**. **Edit caption** fixes the text.
6. **Publish** makes the journey playable.

Later edits create a new revision; a run already in progress keeps its photos unless the administrator chooses **Start fresh with these photos**. A fresh run starts on the latest publication, so that button appears only once the draft on screen is published.

When a newer version of the child's world is registered, the Memories screen shows "A new version of this world is ready." with **Update world**. Updating keeps the photos and captions of chapters that did not change and picks photos for the rest (D-11); **Publish** then makes the new version playable.

**Child.** The home screen shows one big card per published journey (display name, current chapter, age). Tap it to play. Memory pickups show the real photo with the caption and age. After the boss, the big memory shows "Turning N!", the avatar grows, and a new-move card teaches any unlocked move.

**Family member (non-admin).** Sees and plays the published journeys; no setup or swap controls.

## Detailed design

**D-01 Private data.** Real names, birthdays, Immich person/asset ids, captions and photo bytes live only in Postgres and the private media path. Server logs record opaque ids and error codes only. Client payloads never carry upstream ids: photos are addressed by opaque slot or candidate tokens. Tests, fixtures, screenshots and docs use synthetic children only. Commit messages and PRs never name the children.

Private values also stay out of every record kept outside the app:

- **URLs.** The Cloudflare edge and the `traefik-external` access log (shipped to Loki) record each request line, query string included. A name or birthday therefore travels only in a JSON body: the setup lookups are `POST` (D-08).
- **Command lines.** `kubectl exec` puts every argument in the exec URL, and the kube-apiserver audit log keeps it on the control-plane nodes. The operator CLI therefore reads names and birthdays from stdin (D-09).
- **Crash output.** Every database pool listens for connection errors, and each connection keeps its own listener while it is checked out. A connection that Postgres ends, as in a CNPG switchover, is reported as `{"event":"database_connection_lost","errorClass":…}`. It no longer crashes the process with an unfiltered dump of the database client.

**D-02 Tables.** New migrations add:

- **Auth:** Better Auth's user, session, account and verification tables. `quest_players` gains a unique `(issuer, subject)` pair, an `is_admin` snapshot and a `groups_checked_at` timestamp.
- **`quest_children`:** household child profiles with revision; the fields listed in the overview.
- **`quest_journey_drafts`:** child, template id/version, the rebased chapter dates, slot selections (asset id, local date, caption, pick reason), revision.
- **`quest_journey_publications`:** child, monotonically increasing revision, frozen `family-world-plan-v1`, `published_by`, `published_at`.
- **`quest_saves`:** gains a `publication_id`. A family save is household-owned: `player_id` records who started it, while access is by household admission.

Revision checks use compare-and-set; publishing is idempotent per request id.

**D-03 Age bands and rebase.** A template chapter's age band is derived from its fictional dates: `startAge = wholeYears(fictionalBirthDate, startDate)`, and `recoveredAge` is the chapter's end age. For a child with birthday `B`:

- the chapter starts at `B + startAge` years. That start date is also the date cast eligibility is checked against;
- the target big-memory date is `B + recoveredAge` years, the birthday on which the child turns that age;
- chapter `k+1` starts on chapter `k`'s big-memory date, as in plan v3.

February 29 birthdays fall on February 28 in common years. A template whose last `recoveredAge` exceeds the child's current age is not offered. The rebased project must pass the full world validator with real dates, including cast date eligibility under the parent-locked windows of DESIGN-026.

**D-04 Automatic picks.** All discovery is bounded (≤ 8 search pages per slot, 250 ms spacing, 20 s deadline) and uses the existing Immich caller's origin pinning.

Eligible photos:

- `type IMAGE`, `visibility timeline`, not trashed, archived or offline;
- the child's Immich person is on the asset;
- dated by `localDateTime`'s local calendar date (this resolves DESIGN-009's open UTC item);
- dated on or after the birthday and within the slot's window.

Slot windows:

- **Big memory:** `[birthday turning N, +30 days]`, preferring the birthday itself. Ranking takes Immich smart-search results for "birthday cake", "birthday party" and "blowing out candles" in that window, then any eligible photo. For the final chapter, N is the child's current age, so the window is the most recent birthday.
- **Little memories:** two photos strictly after the chapter start and before the big memory. Target the ⅓ and ⅔ points of the chapter, each drawn from a window of ±20% of the chapter length. They come from different days and, when possible, different months. Ranking uses smart-search queries for memorable moments: "child playing outside", "holiday", "halloween costume", "christmas morning", "beach", "first day of school", "playground", "swimming".

Scoring prefers:

- fewer people on the asset;
- a larger face box for the child (`GET /api/faces?id=`);
- landscape or square framing;
- not a screenshot (Immich type/filename heuristics).

Search details:

- **Smart search people.** Immich's smart search does not load people. It sends an empty `people` list on every result, so the adapter treats a smart result's people as unknown. The request's person filter still applies, and a smart candidate counts only once the child's face box confirms it, or once a metadata result for the same photo lists the child. Metadata search requests people, so there an empty list does mean that the child is absent.
- **Reading outward from the target.** A metadata pass splits its window at the slot's target date. It reads later photos in ascending date order and earlier photos in descending order, one page from each side per round. A dense library, with thousands of photos in a ±20% window, therefore still gives candidates around the ⅓ and ⅔ points and the birthday, not only from the window's first weeks. **Show more** pages the same way: each page holds the next photos on both sides of the slot's target.

Picks are deterministic for a given draft seed. The pick reason is stored. If a window has no eligible photo, widen it once within the chapter bounds; if it is still empty, mark the slot `needs-photo`. Publishing is blocked until every slot is filled; an administrator can pick manually through **Show more**.

**D-05 Captions.** Default captions:

- little memories: `"<Season> <year> · age <n>"`;
- big memories: `"Turning <n>!"`.

The display name is never in a default caption. Administrators edit captions: 1–60 characters, plain text, rendered as text only.

**D-06 Private media.**

- **Candidate thumbnails** use short-lived opaque tokens, served only to administrators. The tokens are AES-GCM encrypted rather than only HMAC-signed, so the Immich asset id never reaches the browser. The key is derived per ADR-005 D-08.
- **Published photos** are served through `/api/saves/:id/media/:memoryId`, with the membership, visibility and release rechecks that exist today.
- **Sanitization:** bytes pass the existing sanitizer (re-encode to WebP, metadata stripped, ≤1600 px) and are served `no-store` with `nosniff`. An Immich failure is a friendly placeholder card in the game and an explicit error on the admin screen, never an upstream URL.

**D-07 Plan.** `family-world-plan-v1` freezes:

- the rebased chapters, with their dates and recovered ages;
- level geometry and anchors;
- the cast identities and stats;
- the ability ladder in force (DESIGN-025);
- per-slot memory sources `{kind: 'immich', opaque}` with captions and dates.

It reuses the frozen editor-world runtime (anchors, encounters, bonus slot, route ordering) so the game code path is shared. It is accepted in production mode only through a publication; ephemeral editor playtests keep their fixture-only plan types. `validateSaveRecord` re-derives its invariants on load, including the cast rules the builder applied:

- a catalog encounter is checked against the prepared catalog;
- a neutral candidate is checked against the candidate table of the template named by the plan's frozen fingerprint. Its name, period, role and kind must match, and the rebased chapter start must fall inside its eligibility window. A plan whose template is unknown fails. Minor memories release on contact, and the major releases after the boss. Recovering the major runs the existing atomic level completion, which sets age to the chapter's `recoveredAge` and grants the ladder's moves.

**D-08 Routes.**

| Route | Method | Purpose | Access |
| --- | --- | --- | --- |
| `/api/auth/*` | — | Better Auth | Public |
| `/api/session` | GET | Session view, extended to `mode: 'family'` with role | Admitted |
| `/api/children` | GET | Published journeys and their saves | Admitted |
| `/api/admin/children` | GET, POST | Child profiles | Admin |
| `/api/admin/immich/people` | POST `{name}` | Person lookup, through Immich's name search (`/api/search/person`) with an exact, case-insensitive filter. The name travels in the body, never the URL (D-01). | Admin |
| `/api/admin/templates` | POST `{birthDate}` | World templates that fit a birthday. The birthday travels in the body, never the URL (D-01). | Admin |
| `/api/admin/children/:id/draft` | GET, PUT | Draft read and edit | Admin |
| `/api/admin/children/:id/draft/slots/:chapter/:slot/suggestions?cursor=` | GET | Swap suggestions | Admin |
| `/api/admin/candidates/:token/image` | GET | Candidate thumbnail | Admin |
| `/api/admin/children/:id/publish` | POST | Publish the draft | Admin |
| `/api/admin/children/:id/template` | POST | **Update world** to a newer version of the same template (D-11) | Admin |
| `/api/children/:id/play` | POST | Resume or create the household save for the latest publication | Admitted |

Save routes are unchanged in shape. The two `POST` lookups change nothing, but they carry the same exact-Origin and `X-Quest-Request` guard as every other `POST`. On the family host, `/studio/*` also needs a family session. Only the sign-in start, `/api/auth/*`, `/healthz` and `/readyz` answer without one ([ADR-006](../adrs/006-release-isolation-and-public-surface.md) D-02).

**D-08a Background picking.** Automatic picking runs as a background job, and its request returns 202, because a full pick can take longer than Cloudflare's 100 s request limit. The admin screen shows progress. A pick saves compare-and-set on the draft revision and on the child revision it was rebased from. A template or birthday change that commits while it runs refuses it with `409 DRAFT_CONFLICT` or `CHILD_CONFLICT`, and never pairs the changed child with a draft built on the old one. This also covers the operator CLI's `auto-pick`, which takes the current draft revision itself.

**D-08b Time zone.** `QUEST_HOUSEHOLD_TIME_ZONE` (America/New_York in production) defines "today" for the final chapter's end and for pick windows.

**D-09 Operator CLI.** For the first overnight setup, an operator runs `node dist/server/admin.js` inside the family pod. It performs the same service calls as the admin screen (create child from Immich name, confirm birthday, choose template, auto-pick, update world, publish). It prints only opaque ids and counts, never names, dates or photo ids. This does not bypass validation.

The Immich name, the display name and the birthday arrive as one JSON object on stdin (`kubectl exec -i … < private.json`), never as arguments. `--name`, `--display-name` and `--birth-date` are refused with `PRIVATE_OPTION_REFUSED`. Only opaque ids, template keys and fixed flags go on the command line. A template fix ships as a new version, and published journeys keep their frozen one; `set-template` moves a child onto a newer version of the same world under D-11's rules, and a started run keeps its publication until an administrator starts a fresh run.

**D-10 Copy.** Fixture-only strings ("Fictional illustration", fictional help text) stay in fixture mode only. Family mode shows the caption and the child's age. All user-visible copy is authored by the coordinator.

**D-11 Update world (template upgrades).** Registered templates are immutable, so an improved world arrives as a newer version of the same template id (for example `family-world-b@v1` → `@v2`). An administrator moves an existing child onto it without losing the photo choices.

- **Eligibility.** The target must be a newer version of the child's own template id (versions compare as numbers, so `v12` is newer than `v9`) and must be offered for the child's birthday under D-03. Anything else is refused with `422 TEMPLATE_UPGRADE_UNAVAILABLE`: another template, the same or an older version, an unknown version, or one whose ages do not fit. `GET /api/admin/children` and `GET /api/admin/children/:id/draft` report `newerTemplate`: the newest such version, or `null`.
- **Compare-and-set.** The request carries the draft revision the administrator saw (`null` when the child has no draft yet). A stale revision is `409 DRAFT_CONFLICT`. The child row (template id and version) and the rebuilt draft are written in one transaction, compare-and-set on both the child and draft revisions; a conflict on either leaves both unchanged.
- **Rebuild.** The draft is rebased on the new template with the child's birthday and today's date, keeping its seed. A chapter is *unchanged* when its chapter id and its template age band (the template's own `startAge` and `recoveredAge`, D-03) are the same in the draft's template and the target. The draft must also carry the child's birthday; otherwise every chapter counts as changed.
  - **Unchanged chapters** keep each slot's current photo, caption and pick reason when the photo's date still fits that slot under the new template. "Fits" is the same rule a swap must meet: the slot's widened window, after the photos kept before it in journey order. Slots are checked in journey order, so every kept photo also fits once its later neighbours are kept. A slot that no longer fits, or that already needed a photo, becomes `needs-photo`. For example, a final chapter now rebased to a later birthday keeps its little memories, but its old big-memory photo is dropped.
  - **New or changed chapters** are auto-picked (D-04) for their slots only, around the kept photos. New picks never reuse a kept photo. A picked big memory ends before the next chapter's kept little memories, and picked little memories follow the previous chapter's big memory, whether kept or picked.
- **Background job.** Picking can outlast a request (D-08a), so the route validates eligibility and the revision, answers `202` and runs the rebuild as the child's one background job. Auto-pick, edits and publishing wait for it (`409 AUTO_PICK_RUNNING`). A failure, such as losing a race to an edit, is kept as `lastPickError` with a fixed code: the `AppError` code, or `TEMPLATE_UPGRADE_FAILED` for any other failure (`AUTO_PICK_FAILED` for a pick). Job status is shared by all of the child's administrators, and starting any job clears the last failure. The Memories screen therefore reports the update as done only when the draft it reads back is on the requested version. Otherwise it keeps offering **Update world**.
- **Publishing and saves.** The update changes only the child profile and the draft. Existing publications are immutable, and every started save stays pinned to its publication: a run in progress keeps its version until an administrator chooses **Start fresh**. Publishing the rebuilt draft is a separate, explicit step. **Start fresh** plays the latest publication, so the draft read reports `publishedDraftRevision`, the draft revision that publication froze (`null` before the first publish). The Memories screen offers **Start fresh with these photos** only while it equals the draft's revision, so after **Update world** or an edit the administrator publishes first.
- **Audit and privacy.** The child and draft rows record the acting player id in `updated_by` (`null` for the operator CLI), as other admin actions do. A failed background update emits only the diagnostic `{event: "template_upgrade_failed", errorClass, code}`: the failure's class (`app-error`, `type-error` and so on) and its fixed code. A failed automatic pick emits `auto_pick_failed` in the same shape. Responses and logs never carry names, dates or upstream ids.
- **Operator CLI.** `set-template --child <id> --template <id>@<version>` runs the same service call from the current draft revision. It prints only `draft r<N> carried <kept>/<total> needs-photo <k>`, where `kept` counts slots whose photo and caption were kept, `total` counts every slot of the rebuilt draft, and `k` counts slots that now need a photo.
- **Copy (final).** The Memories screen shows "A new version of this world is ready." with **Update world**. It confirms with "Update to the new version of this world? Photos and captions stay where the chapters match. A run already in progress keeps its version until you choose Start fresh." After the background update it shows "World updated. Publish to make it playable." `TEMPLATE_UPGRADE_UNAVAILABLE` reads "There's no newer version of this world yet."

## Limits and failure behavior

- **Immich unavailable:** the admin screen shows a retryable error. Published journeys keep playing, and photos show a placeholder card until Immich returns.
- **Photo revoked** (deleted, archived, or the person removed): its slot shows a placeholder in play, and progress is kept (DESIGN-004 D-10). The admin screen flags the slot for a swap.
- **Ambiguous or missing person:** setup requires an explicit choice.
- **Birthday missing in Immich:** the administrator must enter one.
- **Insufficient photos:** the slot is `needs-photo`, and publishing is blocked with the chapter named.

## Validation

- **Unit:**
  - rebase ages and dates, including a Feb 29 birthday;
  - pick windows and ranking against a fake Immich caller;
  - deterministic picks;
  - `needs-photo`;
  - caption bounds;
  - token expiry and tamper rejection;
  - **Update world** (D-11): carry-over of unchanged chapters with captions, `needs-photo` when a kept date no longer fits, auto-picks for new and changed chapters around kept photos, refusal of another template or an older, equal, unknown or unoffered version, and a revision race;
  - an operator `auto-pick` refused when an update commits while it runs;
  - failure codes and diagnostic labels for unexpected background failures;
  - the operator CLI's output shape, its stdin-only private input and its refusal of private arguments;
  - lookups that keep names and birthdays out of URLs;
  - smart results with an empty `people` list, and metadata picks and **Show more** pages centred on the target in a dense library;
  - a frozen plan whose candidate cast breaks its template's period, name or eligibility window;
  - a database connection lost while idle or checked out.
- **PostgreSQL:**
  - draft compare-and-set races;
  - idempotent publish;
  - a new revision does not alter a started save;
  - **Update world** writes the child and draft atomically, lets one of two racing updates land, and leaves a started save pinned until **Start fresh**;
  - a draft save built from the child refuses a changed child, and never lands together with a racing template change;
  - household access;
  - admin-only routes;
  - fixture sessions see nothing.
- **Browser (synthetic child, fake Immich):**
  - admin creates, swaps, recaptions and publishes;
  - admin confirms **Update world**, waits for the background update and is asked to publish (jsdom);
  - with two administrators, a failed update is never reported as done and a landed one always is, and **Start fresh** waits until the draft on screen is published (jsdom, real routes);
  - child plays through a chapter;
  - the big memory advances age and shows the move card;
  - the non-admin sees no setup;
  - signed-out requests get 401.
- **Live (private):** the operator publishes both children's journeys in the pod. A server-side check decodes every chosen photo through the sanitizer and reports counts only. Tom's own sign-in and the children's physical-device play are owner checks, reported as pending until they happen.
