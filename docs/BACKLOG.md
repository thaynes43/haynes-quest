# Future backlog

These items do not gate the initial playable loop in [DESIGN-007](designs/007-poc-development-loop.md). BL-01 is conditional work beyond the family PoC; the later gameplay/content items can return within the family project after the core loop is evaluated.

## BL-01: Automatic playable-character generation

- **Status:** Deferred by Tom on 2026-09-10
- **Revisit if:** Tom chooses a broader release and separately decides to reintroduce person-specific playable avatars
- **Requirement:** [PRD-001 R-15](prds/001-project-brief.md)
- **Future acceptance criterion:** PRD-001 AC-10

Let the application retrieve a configured person's photos and produce a usable playable-character model without developer authoring for each person. This would reuse the photo/person integration but also change the current generic-avatar premise; a broader release alone does not require it.

The family PoC uses a shared generic mysterious avatar authored with image-generated concepts and Blender MCP. Configured people supply chronological photo journeys. Adding an eligible person needs no new model. No generation worker, queue, job-state simulator, provider comparison, or real-generation trial is required for the PoC.

If revisited, evaluate the complete references → geometry → rig/animation → validated GLB workflow. Establish quality, latency, compute/cost, private-data handling, and a suitable generation service before choosing infrastructure. Interactive authoring tools alone do not establish this runtime capability.

Retain these design considerations for that future work: private source/output storage; persisted progress and recoverable failures; deduplicated requests; bounded concurrency and restart-safe retries; access checks after connection/key changes; versioned output published only after validation; and failed regeneration preserving an existing usable asset and save. These are notes for future design, not PoC implementation work.

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
