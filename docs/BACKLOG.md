# Future backlog

## BL-07: Shared level authoring and publication

- **Status:** The fictional editor and shared agent CLI are deployed under [PLAN012](../.agents/plans/completed/012-level-editor-mvp.md) and [completed PLAN014](../.agents/plans/completed/014-complete-world-builder.md). Rat Casino is the first checked-in and hosted private candidate world. Parent admission and shared publication remain future work.
- **Contract:** [DESIGN016](designs/016-authored-levels.md), [DESIGN020](designs/020-complete-world-builder.md), PRD R-44–R-45.

Humans and agents now use the same versioned level document to place platforms, obby sections, checkpoints, equipment, encounters, friends and fictional memories. The World panel and agent CLI can add, reorder and validate one to eight chapters, create named enemy candidates and assign them to encounter slots. A new candidate previews with neutral placeholder art until its exact asset version is approved and registered. Current drafts remain browser-local, with JSON export for backup or transfer; the private full-world preview is ephemeral. Keep the youngest child's opening forgiving; later recovered ages can support more demanding content.

The next stage needs an owner-scoped promotion path for validated exported worlds, parent-selected media, approved exact model/audio versions and immutable published revisions. The private Rat Casino trial supplies its own `parody-catalog-v6` period/date window, editor-ready identities, Rat Pit Boss `v002` asset mapping and prepared environment kit while keeping v5 project exports readable from their pinned catalog. Tom's review prompted this fictional trial; physical-device and final art acceptance remain open. Preserve source dates and private media access throughout later publication.

The current equipment, enemies and bosses are required by [PLAN-005](../.agents/plans/completed/005-era-combat-loop.md), following Tom’s September 11 correction. The broader items below do not replace that work. BL-01 defers automatic generation while authored age/likeness evolution remains product direction; the later gameplay/content items can return within the family project after the core loop is evaluated.

## BL-01: Automatic playable-character generation

- **Status:** Automatic generation remains deferred; Tom has now reintroduced age/likeness evolution as product direction for the family game.
- **Revisit after:** The overnight age-growth and private appearance-variant contract in [PLAN-004](../.agents/plans/completed/004-overnight-mvp.md) is playable.
- **Requirement:** [PRD-001 R-15](prds/001-project-brief.md)
- **Future acceptance criterion:** PRD-001 AC-10

The mysterious avatar should evolve toward the recovered person's age and likeness. The overnight MVP uses synthetic authored age stages and a versioned private appearance mapping. This establishes progression without requiring automatic photo-to-3D generation or a new likeness model before adding a test subject.

Later, design the complete private references → geometry → rig/animation → validated age variants workflow. Image generation and Blender support developer authoring; they do not by themselves establish automatic runtime generation. Evaluate quality, compute, privacy, saved-variant compatibility, failures and the owner-review workflow before introducing a worker or provider. Keep likeness references and artifacts out of public repositories. The former broader-release-only condition is superseded by the new product direction; automatic generation remains a later implementation choice.

## BL-02: Combat, bosses, and encounter content

- **Status:** Current two-period equipment/combat/boss implementation is in PLAN-005; broader production and final balance remain future work
- **Revisit after:** The corrected equipment → boss → memories → age/period loop is playable and evaluated
- **References:** PRD-001 R-27–R-29, R-33; DESIGN-005 and DESIGN-006

Extend the bounded health, attack, guard, defeat/retry and boss-release rules in DESIGN-010 after play review. Curate additional historical periods, enemy behaviors, equipment, animation and audio. Preserve period eligibility and current-ability reachability. Finished assets required by the current two levels remain active work; this backlog cannot be used to postpone them.

## BL-03: Other collectibles and level activities

- **Status:** Optional activities remain deferred; useful combat equipment is required in the current levels
- **Revisit after:** The corrected equipment/combat/growth loop is evaluated

Decide whether levels include secondary pickups, optional objectives, puzzles, secrets, rewards, or other activities. Then define their purpose, saved state, and relationship to memories. Fill out environments after scale, movement, and performance are tested; no currency, crafting system, or collectible quota is established here.

## BL-04: Full story and campaign structure

- **Status:** Deferred from the initial PoC under the current scope proposal
- **Revisit after:** The playable loop supports a useful story/content discussion

Develop the world, narrative arc, characters, dialogue, chapter transitions, and ending. The current premise is sufficient for the first slice: an amnesiac avatar recovers photos and gains abilities. Whether the avatar is ultimately the selected person remains undecided. Keep initial objective text small and consistent; no full script or lore bible gates coding.

## BL-05: Music, narration, and the broader audio catalog

- **Status:** Deferred from the initial cue trial
- **Revisit when:** Scene/story/combat needs justify audio beyond the cues in [DESIGN-008](designs/008-audio-pipeline.md)

Choose music direction, any fictional/stock narration, enemy voices, and additional effects after their triggers and creative purpose are defined. Check the selected service's specific game-use/API/export terms before producing final music. The first PoC needs only a small prepared cue set; music and spoken dialogue are optional. Every final version still receives Tom's review before integration.

## BL-06: A lifetime campaign that grows with the player

- **Status:** Owner-confirmed future direction, September 11, 2026; deferred from the current MVP
- **Revisit after:** The bounded obby, equipment, boss and post-victory memory loop is playable and evaluated
- **References:** [PRD-001 R-42–R-43](prds/001-project-brief.md), [memory journey](designs/004-memory-journey.md), [abilities](designs/006-memory-age-and-abilities.md)

The player's actual life supplies the campaign. Recovering older memories grows the character, unlocks lasting abilities and makes later levels more demanding. Childhood and adulthood should offer meaningfully different challenges. Tom's eleven-year-old son is an experienced gamer: later childhood chapters should give him more engaging play than the gentle opening intended for his younger sister. Adults should have a longer and richer progression through their own history.

Increase the complexity of obby routes, enemy patterns and combinations of learned abilities as recovered age advances. Teach an ability before requiring it, retain earlier actions and preserve the boss → released memories → consumption → age/period transition. Exact age bands, mechanics, difficulty curves and assistance settings remain future design; these examples do not establish biological skill milestones or make chronological age a substitute for the human player's experience. Gender does not determine difficulty.

For a journey through one's own life, distinguish three values:

- **Recovered age:** earned through consuming boss-released memories; controls current progression and abilities.
- **Real current age:** derived from the birthday and current date; bounds the life that has actually happened.
- **Curated photo coverage:** the dated memories available to support chapters; a birthday alone does not create a new memory.

A child can catch up to the available part of their life and reach a satisfying stopping point. Continuing into a later life stage may require waiting a couple of real years and then curating new photos. This is a future continuation state, not an invented adult chapter or an artificial cooldown on memories that already exist. An adult with decades of dated photos can play from infancy through those existing adult years without waiting those years again.

Design continuation as an explicit extension of the same journey: preview and confirm newly available chapters, retain completed memories, abilities and victories, and version the added photo/encounter selections. New uploads or catalog edits must not silently rewrite the frozen past. Distinguish a life stage not yet lived from missing photos and unavailable authored game content; those situations need different explanations and remedies. Handle later-life photos, older photos uploaded late, corrected dates and revoked photos separately; saved progress never restores access to revoked media. The birthday/date evaluation policy, when an extension becomes eligible, and rules for playing someone else's history remain deferred decisions. The signed-in player, selected photo subject and avatar remain separate concepts; a self-journey is the motivating case, not a change to that identity contract.

**Future validation:** use a synthetic archive spanning 37 years to exercise infancy, childhood, adolescence and adulthood, escalating challenge and accumulated abilities. Tom has offered his own 37-year photo archive for a later private full-life playthrough; record this as a prospective test, not a completed import or evidence of continuous coverage. Use his real photos only through the separately prepared private setup and admission flow. Also test a child reaching the current endpoint, waiting across a real-age boundary without automatically gaining memories, and explicitly extending the save when appropriate photos and content are available.

This backlog entry authorizes documentation of the vision. It does not add runtime age gates, change the current gentle course, start historical asset production, query the real photo library or make the lifetime campaign an MVP acceptance requirement.
