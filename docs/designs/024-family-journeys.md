# DESIGN-024: Family journeys with real memories

- **Status:** Accepted for the first family release, September 25, 2026
- **Last updated:** 2026-09-26
- **Satisfies:** [PRD-004](../prds/004-family-release.md) R-02, R-04–R-08, R-12, R-13
- **Governed by:** [ADR-001](../adrs/001-authentik-sign-in.md), [ADR-005](../adrs/005-family-sign-in-and-admission.md), [ADR-004](../adrs/004-versioned-world-projects.md)
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

Later edits create a new revision; a run already in progress keeps its photos unless the administrator chooses **Start fresh with these photos**.

**Child.** The home screen shows one big card per published journey (display name, current chapter, age). Tap it to play. Memory pickups show the real photo with the caption and age. After the boss, the big memory shows "Turning N!", the avatar grows, and a new-move card teaches any unlocked move.

**Family member (non-admin).** Sees and plays the published journeys; no setup or swap controls.

## Detailed design

**D-01 Private data.** Real names, birthdays, Immich person/asset ids, captions and photo bytes live only in Postgres and the private media path. Server logs record opaque ids and error codes only. Client payloads never carry upstream ids: photos are addressed by opaque slot or candidate tokens. Tests, fixtures, screenshots and docs use synthetic children only. Commit messages and PRs never name the children.

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

It reuses the frozen editor-world runtime (anchors, encounters, bonus slot, route ordering) so the game code path is shared. It is accepted in production mode only through a publication; ephemeral editor playtests keep their fixture-only plan types. `validateSaveRecord` re-derives its invariants on load. Minor memories release on contact, and the major releases after the boss. Recovering the major runs the existing atomic level completion, which sets age to the chapter's `recoveredAge` and grants the ladder's moves.

**D-08 Routes.**

| Route | Method | Purpose | Access |
| --- | --- | --- | --- |
| `/api/auth/*` | — | Better Auth | Public |
| `/api/session` | GET | Session view, extended to `mode: 'family'` with role | Admitted |
| `/api/children` | GET | Published journeys and their saves | Admitted |
| `/api/admin/children` | GET, POST | Child profiles | Admin |
| `/api/admin/immich/people?name=` | GET | Person lookup, through Immich's name search (`/api/search/person`) with an exact, case-insensitive filter | Admin |
| `/api/admin/templates?birthDate=` | GET | World templates that fit a birthday | Admin |
| `/api/admin/children/:id/draft` | GET, PUT | Draft read and edit | Admin |
| `/api/admin/children/:id/draft/slots/:chapter/:slot/suggestions?cursor=` | GET | Swap suggestions | Admin |
| `/api/admin/candidates/:token/image` | GET | Candidate thumbnail | Admin |
| `/api/admin/children/:id/publish` | POST | Publish the draft | Admin |
| `/api/children/:id/play` | POST | Resume or create the household save for the latest publication | Admitted |

Save routes are unchanged in shape.

**D-08a Background picking.** Automatic picking runs as a background job, and its request returns 202, because a full pick can take longer than Cloudflare's 100 s request limit. The admin screen shows progress.

**D-08b Time zone.** `QUEST_HOUSEHOLD_TIME_ZONE` (America/New_York in production) defines "today" for the final chapter's end and for pick windows.

**D-09 Operator CLI.** For the first overnight setup, an operator runs `node dist/server/admin.js` inside the family pod. It performs the same service calls as the admin screen (create child from Immich name, confirm birthday, choose template, auto-pick, publish). It prints only opaque ids and counts, never names, dates or photo ids. This does not bypass validation. `set-template` moves a child onto another registered template version the child can play. A template fix ships as a new version, and published journeys keep their frozen one. When the new version rebases to the same chapters, the draft's photos and captions carry over to the next publish. A started run keeps its publication until an administrator starts a fresh run.

**D-10 Copy.** Fixture-only strings ("Fictional illustration", fictional help text) stay in fixture mode only. Family mode shows the caption and the child's age. All user-visible copy is authored by the coordinator.

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
  - token expiry and tamper rejection.
- **PostgreSQL:**
  - draft compare-and-set races;
  - idempotent publish;
  - a new revision does not alter a started save;
  - household access;
  - admin-only routes;
  - fixture sessions see nothing.
- **Browser (synthetic child, fake Immich):**
  - admin creates, swaps, recaptions and publishes;
  - child plays through a chapter;
  - the big memory advances age and shows the move card;
  - the non-admin sees no setup;
  - signed-out requests get 401.
- **Live (private):** the operator publishes both children's journeys in the pod. A server-side check decodes every chosen photo through the sanitizer and reports counts only. Tom's own sign-in and the children's physical-device play are owner checks, reported as pending until they happen.
