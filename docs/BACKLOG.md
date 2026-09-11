# Future backlog

These items do not gate the initial playable loop in [DESIGN-007](designs/007-poc-development-loop.md). BL-01 is conditional work beyond the family PoC; the later gameplay/content items can return within the family project after the core loop is evaluated.

## BL-01: Automatic playable-character generation

- **Status:** Automatic generation remains deferred; Tom has now reintroduced age/likeness evolution as product direction for the family game.
- **Revisit after:** The overnight age-growth and private appearance-variant contract in [PLAN-004](../.agents/plans/004-overnight-mvp.md) is playable.
- **Requirement:** [PRD-001 R-15](prds/001-project-brief.md)
- **Future acceptance criterion:** PRD-001 AC-10

The mysterious avatar should evolve toward the recovered person's age and likeness. The overnight MVP uses synthetic authored age stages and a versioned private appearance mapping. This establishes progression without requiring automatic photo-to-3D generation or a new likeness model before adding a test subject.

Later, design the complete private references → geometry → rig/animation → validated age variants workflow. Image generation and Blender support developer authoring; they do not by themselves establish automatic runtime generation. Evaluate quality, compute, privacy, saved-variant compatibility, failures and the owner-review workflow before introducing a worker or provider. Keep likeness references and artifacts out of public repositories. The former broader-release-only condition is superseded by the new product direction; automatic generation remains a later implementation choice.

## BL-02: Combat, bosses, and encounter content

- **Status:** Detailed fighting deferred by Tom on 2026-09-10; broader encounter production follows the core PoC
- **Revisit after:** The memory-to-ability loop is playable and evaluated
- **References:** PRD-001 R-27–R-29, R-33; DESIGN-005 and DESIGN-006

Decide how the character fights or avoids enemies, how age abilities affect those interactions, damage/recovery, defeat/respawn, boss rules, rewards, and difficulty. Curate the original era roster and required animations/audio afterward. Preserve historical eligibility and current-ability reachability. Enemies remain part of the game direction; a full combat system is not required to test collection and one movement unlock.

## BL-03: Other collectibles and level activities

- **Status:** Deferred by Tom on 2026-09-10
- **Revisit after:** The initial route establishes movement, collection, and progression feel

Decide whether levels include secondary pickups, optional objectives, puzzles, secrets, rewards, or other activities. Then define their purpose, saved state, and relationship to memories. Fill out environments after scale, movement, and performance are tested; no currency, crafting system, or collectible quota is established here.

## BL-04: Full story and campaign structure

- **Status:** Deferred from the initial PoC under the current scope proposal
- **Revisit after:** The playable loop supports a useful story/content discussion

Develop the world, narrative arc, characters, dialogue, chapter transitions, and ending. The current premise is sufficient for the first slice: an amnesiac avatar recovers photos and gains abilities. Whether the avatar is ultimately the selected person remains undecided. Keep initial objective text small and consistent; no full script or lore bible gates coding.

## BL-05: Music, narration, and the broader audio catalog

- **Status:** Deferred from the initial cue trial
- **Revisit when:** Scene/story/combat needs justify audio beyond the cues in [DESIGN-008](designs/008-audio-pipeline.md)

Choose music direction, any fictional/stock narration, enemy voices, and additional effects after their triggers and creative purpose are defined. Check the selected service's specific game-use/API/export terms before producing final music. The first PoC needs only a small prepared cue set; music and spoken dialogue are optional. Every final version still receives Tom's review before integration.
