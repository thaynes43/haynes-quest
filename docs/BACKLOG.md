# Future backlog

The current equipment, enemies and bosses are required by [PLAN-005](../.agents/plans/005-era-combat-loop.md), following Tom’s September 11 correction. The broader items below do not replace that work. BL-01 defers automatic generation while authored age/likeness evolution remains product direction; the later gameplay/content items can return within the family project after the core loop is evaluated.

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
