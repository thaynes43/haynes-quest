# PRD-004: First family release

- **Status:** Accepted for the first release, September 25, 2026; era casts locked September 26 (Q-05)
- **Owner:** Tom Haynes
- **Last updated:** 2026-09-25
- **Source:** Tom's September 25 direction to start the initial family release for his two children, and his answers to Q-01–Q-05 below

## Summary

Haynes Quest moves from a fictional private playtest to its first real family release. Tom configures his two children once. Each child gets a personalized journey. Its chapters follow that child's own age bands and the pop culture they loved at those ages. Actual Immich photos from those years are the memories the player recovers. The game runs online at a Haynes Network address behind Authentik and appears as a Haynes Network portal tile. The levels become taller and busier Roblox-style obby courses with themed scenery and goofy fights. Growing older unlocks lasting new moves.

Real names, birthdays, upstream photo identifiers and photo bytes are private household configuration. They live in the application database and the private photo path only. They never enter git, pull requests, logs, the static asset studio or test artifacts. This repository is public.

## Goals and scope

- Admitted household members sign in through Authentik and play in any supported browser.
- An administrator prepares one journey per child from the child's Immich person, explicit birthday and a world template matched to the child's era casts.
- The game selects memory photos automatically. An administrator can review, replace and recaption each photo.
- Each chapter recovers two little memories on the route and one big memory after its boss. The big memory advances age and unlocks that age's moves.
- New levels use real height and new obby mechanics. They are dressed with era-themed props, and each chapter's cast matches the era.
- The existing fictional playtest, published courses, editor and saves stay intact.

Out of scope for this release: manual photo uploads, multiple households, public accounts, native packaging and per-person avatar generation (BL-01).

## Requirements

| ID | Requirement | Priority | Source |
| --- | --- | --- | --- |
| R-01 | Serve the family release on the internet at `quest.haynesnetwork.com`, reachable only after Authentik sign-in. | Must | Tom, September 25 |
| R-02 | Admit members of the Authentik groups `authentik Admins` and `family`. Only `authentik Admins` members may configure children or change photos. | Must | Q-01 |
| R-03 | Add a Haynes Quest tile to the Haynes Network portal that opens the game and signs in through existing SSO. | Must | Tom, September 25 |
| R-04 | Configure a child from their Immich person and an explicit birthday confirmed by an administrator. Never infer the birthday or age from photos. | Must | DESIGN-004, DESIGN-006 |
| R-05 | Automatically choose each chapter's memory photos from that child's Immich photos in the chapter's years: two little memories on the route and one big memory on or just after the birthday that ends the chapter. | Must | Q-02 |
| R-06 | Let an administrator review every chosen photo as a private thumbnail, swap it for another suggestion ("Show more") within the same slot's allowed dates, and edit its caption. | Must | Q-02, DESIGN-012 |
| R-07 | Recovering a chapter's big memory advances age. Ages 2, 4 and 8 unlock a higher jump, a double jump and a short glide. The avatar grows visibly. | Must | Q-04 |
| R-08 | Required paths never need a move the child has not unlocked. Optional routes may use unlocked moves for harder challenges. | Must | Q-04, DESIGN-006 |
| R-09 | Each chapter's enemies, boss, theme and props match the era table the owner locks for that child. | Must | Q-05 |
| R-10 | New visual and audio candidates may enter the family release before owner review, labeled "awaiting review" in the asset studio. A rejected candidate reverts to a placeholder or the prior version. | Must | Q-03 |
| R-11 | Levels read as vertical obby courses rather than flat corridors: height on the required route, lifts, bounce pads, optional ability routes and themed scenery. | Must | Tom, September 25; DESIGN-022 |
| R-12 | Keep private data out of git, pull requests, logs, static docs, screenshots and test artifacts. Tests use synthetic subjects and photos. | Must | DESIGN-009, repository rule |
| R-13 | The fictional playtest and its fixture mode, the published courses and existing saves keep working unchanged. | Must | Repository rule |
| R-14 | Manual uploads and additional households. | Later | PLAN-010 |

## User stories

| ID | Story | Acceptance criteria |
| --- | --- | --- |
| US-01 | As a parent, I tap Haynes Quest in the portal and land in the game signed in, with each child's journey ready to play. | AC-01, AC-02 |
| US-02 | As a child, I pick my own journey, climb and fight through my eras, find my real photos and grow up with new moves. | AC-03, AC-04 |
| US-03 | As an administrator, I see every chosen photo, swap any of them and fix captions before the kids reach them. | AC-05 |
| US-04 | As an outsider without a family or admin account, I cannot reach the game or any photo. | AC-06 |

## Acceptance criteria

| ID | Observable result | Proves |
| --- | --- | --- |
| AC-01 | An unauthenticated request to `quest.haynesnetwork.com` only reaches the sign-in start. The Authentik application is bound to exactly the two admitted groups. | R-01, R-02 |
| AC-02 | The portal tile opens the game URL. | R-03 |
| AC-03 | A published family journey loads its chapters. Each memory pickup decodes the child's private sanitized photo, served `no-store` from the game's origin. | R-05, R-12 |
| AC-04 | Recovering each big memory raises age to the birthday-derived value and unlocks the ladder's moves. Automated traversal proves every required edge with only the moves unlocked by the chapter's start age. | R-07, R-08, R-11 |
| AC-05 | The admin memories screen shows three slots per chapter, swaps and recaptions a slot, and publishes a new revision without altering a started run. | R-06 |
| AC-06 | A session without an admitted group, a fixture session, or a tampered callback gets no family data or media. | R-02, R-12 |

## Owner decisions

| ID | Question | Answer |
| --- | --- | --- |
| Q-01 | Who may sign in and play? | Admins and the `family` group, the same gate as Tautulli. Only admins set up children and swap photos (Tom, September 25). |
| Q-02 | How are memory photos chosen, given almost no Immich favorites? | Automatic picks of well-framed photos from each chapter's years, each from a different day, favoring birthdays and holidays. An admin Memories screen can replace any photo (Tom, September 25). |
| Q-03 | Where may unreviewed new assets appear? | Straight in the children's levels, labeled "awaiting review" in the studio. Rejected assets revert to a placeholder or a prior version (Tom, September 25). |
| Q-04 | Should big memories unlock lasting moves? | Yes, as a ladder: age 2+ higher jump, 4+ double jump, 8+ glide. Required paths never need a locked move (Tom, September 25). |
| Q-05 | Which pop-culture casts belong to which age bands for each child? | Tom supplied the older child's favorites and asked for a date-verified table. He ruled that **no asset may be generated until the age-band associations are locked**, and that levels may be themed to match the assets. On September 26 he locked [DESIGN-026](../designs/026-personal-era-casts.md) with the older child's world at four chapters (0–2, 2–5, 5–9, 9–11) and the younger child's at three (0–2, 2–4, 4–6). |
