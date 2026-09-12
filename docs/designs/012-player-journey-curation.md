# DESIGN-012: Prepare each player's journey

- **Status:** Owner requirements recorded; the setup flow below is the lead's implementation proposal, not a shipped feature.
- **Source:** Tom, September 11, 2026: full name for Immich lookup, birthday, photos curated across each level's time period, configurable enemies and bosses, and admin corrections to period eligibility. Enemy production should be discussed before expensive modeling and reflect each child's interests.
- **Related:** [Photo and appearance boundary](009-overnight-contracts.md), [era catalog](005-era-enemy-catalog.md), [boss-gated growth](010-era-combat-loop.md), [forgiving obby](011-forgiving-obby.md).

## Parent setup

**September 12 amendment:** [DESIGN016](016-authored-levels.md) makes an authored level builder the central setup experience. Authors place integrated or manually uploaded memories and choose modular routes and encounters. Full name is an integration lookup aid, not an upload-only requirement. Each level suggests period-relevant photos and bosses; **Show more** permits deliberate wider selections without an admin ceremony for every local creative choice. Shared historical/relevance defaults remain administrator-managed. Original metadata, media authorization, asset readiness and progression gates still apply. The flow below is earlier setup groundwork to reuse under that direction.

A parent prepares the journey before the child starts playing. The setup presents four steps:

1. **Choose the person.** Enter the full name for Immich lookup, confirm the matched person and enter their birthday. A name is a search input, not a unique identity: ambiguous matches must be resolved before photos are selected. Keep a separate friendly display name for the game.
2. **Arrange the chapters.** Show an ordered timeline with each level's dates, corresponding ages and selected pictures. Suggest a manageable spread of memories, then allow the parent to include, exclude and assign pictures to the appropriate level. Display the real thumbnails so blank tiles cannot pass as a successful preview. Uncertain dates must be visible and correctable before confirmation.
3. **Choose the cast.** Each level has slots for ordinary encounters and a boss. Show era suggestions, the child's pinned favorites and excluded characters. A slot can use a chosen encounter or a surprise from a visible, eligible pool. Let the parent preview a candidate and its encounter before selecting it.
4. **Review and save.** Present the complete timeline, pictures, equipment, obstacles and cast. Check that each route is reachable with the abilities already available. Starting the journey freezes that selection so a later catalog change cannot reshuffle a child's existing game.

The date of a photo determines its place in the chronology. Birthday supplies the age calculation; neither the earliest photo nor appearance supplies a birthday. Photo selection and level boundaries are separate decisions from enemy choices. Beating a boss releases that level's selected memories; consuming the bundle advances age and starts the next period. A photo click during the level must not skip the boss or grow the avatar early.

Level boundaries and bundle size should be editable within a chronological, reachable journey. The current 0 → 4 → 7 fixture is a test case, not a permanent restriction on every family. Propose defaults and display the resulting ages before saving; never invent dates to fill an empty level.

## Interests and controlled surprises

Interests belong to an individual player's setup, not a universal roster. Tom's current examples establish priorities for discussion:

- Daughter: The Besties duo, based on Mackenzie Turner and Lael's recognizable Roblox personas.
- Son: FNAF-inspired characters are a better starting point than Skibidi Toilet.
- Occasional lead suggestions and random selection are welcome within the parent's chosen pool.

Use favorites and exclusions first. An unchecked interest is not a dislike; only an explicit exclusion removes an otherwise eligible choice. Do not infer interests from gender, photos, age or another sibling's settings. Keep these examples as product direction, not committed real child profiles.

Random selection draws from completed, permitted encounters that fit the level and current abilities. Resolve randomness when the parent confirms the journey; show the selected result and freeze it. A retry, reload or later catalog update must not roll different enemies. Missing artwork is unavailable, not a blank or silently substituted selection.

## Era suggestions and admin corrections

Treat cultural relevance as editable curation. Record original debut/source evidence separately from one or more suggested relevance windows. A character can have several periods of popularity or enduring appeal. A Michael Jackson-inspired boss can be deliberately included in a present-day chapter without rewriting historical release dates or pretending its origin is recent.

A parent chooses among the period's available entries by default. An administrator can adjust the shared relevance windows or permit an explicit out-of-period choice for a particular journey. Show which choice is an override and record who made it and why. A local exception should not silently change every family's defaults.

An era override affects roster relevance only. It cannot grant access to another person's photos, change birthdays or recovered ages, bypass boss gates, place an unreachable obstacle, or promote an unreviewed/missing asset. Check permissions and validate the completed plan on the server; a browser field named admin is never authority.

Changes to shared defaults apply to new drafts. Existing saves retain their original photo manifest, chapter boundaries, encounter definitions and exact artwork versions. Editing an unfinished draft creates a new revision; changing a started journey requires an explicit new journey or later designed migration, never an invisible rewrite.

## Photo privacy and access

Store the full name, resolved Immich person ID, birthday, source metadata, selections and preferences in private server storage. The child's play screen need not display the lookup name or full birth date. Public static docs, build outputs, model prompts and screenshots must remain synthetic. Restrict preview and image requests to the authorized manager/player relationship; changing a URL or person ID must not reveal another family's pictures.

OAuth and real-player admission are still deferred. The current fictional account is useful for implementing and testing this flow, but does not grant access to real Immich people or become an administrator. Define the eventual Authentik role/admission mapping before opening real setup; do not ask for private names or birthdays in the task chat to fill a committed fixture.

## Discuss before modeling

Use a short written encounter pitch first: recognizable reference, visual joke, obstacle/attack, intended period and which child it may suit. Tom selects the next entry and helps refine the look. Generate one concept for that agreed entry; inspect it together before committing to an expensive rig, animation set and full render catalog. Keep the lead's occasional surprise suggestions, but do not launch another unattended roster-sized production batch.

Tom selected **The Besties duo first** in the September 11 follow-up. Tom then approved a duo boss with alternating obstacle tricks and a shared recovery window. This does not approve a particular costume, finished asset or automatic batch of new models. [The agreed routine and reference limits](../../.agents/work-orders/036-besties-design-brief.md) are recorded before visual production. FNAF is the next interest to discuss, with the exact character still undecided.

Existing completed candidates remain a reusable optional library. Sir Flush-a-Lot is complete, Nap Captain is checkpointed with known unfinished corrections, and One-Star Diva has no built model. Their former assignment as a mandatory second-level roster is superseded by this curation work. Do not throw away completed work or quietly force an unwanted character into a child's journey to recover its production cost.

## Verification required before delivery

Test ambiguous and missing people, owner isolation, invalid or uncertain dates, unselected or revoked media, cross-level chronology, duplicate photos, insufficient coverage and unready models. Check real image decoding before confirmation. Verify defaults, favorites, exclusions, deterministic surprise selection, admin-only overrides and stable saved versions. Confirm that every configured level retains the obby/equipment/boss/memory order with actual keyboard and touch controls.

The configuration feature, admin permissions and editable chapter roster described here are not yet complete. Existing full-name lookup, birthday and bounded photo-selection foundations must be audited and extended rather than replaced blindly. See the technical intake when available.
