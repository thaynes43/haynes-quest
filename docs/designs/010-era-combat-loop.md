# DESIGN-010: Fight through a period, then grow

- **Status:** Owner-confirmed progression order; implementation details being ratified
- **Source:** Tom's September 11 correction of the first demo
- **Supersedes:** DESIGN-009's individual-photo age updates and memory-path-only level
- **Plan:** [PLAN-005](../../.agents/plans/005-era-combat-loop.md)

## The loop

The player enters a level at the current age, in the corresponding calendar period. Explore to find useful equipment, then use it and retained abilities against that period's enemies. Defeat the boss to release the level's memories. Reveal the pictures and consume the required bundle to advance to the next age bracket. Growth changes the avatar and available abilities, and the next level takes place in the newly reached period.

```mermaid
flowchart LR
    A[Current age and period] --> B[Find useful equipment]
    B --> C[Fight period enemies]
    C --> D[Defeat the boss]
    D --> E[Reveal and consume memories]
    E --> F[Grow into the next age bracket]
    F --> A
```

A photo pickup or reveal cannot change age mid-level. Boss defeat alone cannot silently skip the photo/memory moment. The transition applies age, appearance, retained/new abilities, consumed memories and the next frozen level together. A journey ends at its latest represented age; it does not force a child into an adult level or invent future photos.

## Presentation

Equipment must be visible and useful: a starting attack tool, protective equipment and later improvement demonstrate a reason to explore. Enemies need readable attack preparation, hits, health and defeat feedback, with a larger boss that changes the level's objective. Touch movement, camera and combat actions must work together. Failure offers a clear retry without deleting acquired equipment, finished levels or remembered photos.

After victory, the boss finishes its defeat motion and the player can choose **Reclaim your memories** to open the reward. The reward panel gives the actual memory pictures space on screen. It does not automatically pause the world in the middle of the boss's defeat. Distinguish locked, revealed and consumed states; communicate failed image loads and offer retry instead of showing an unexplained blank tile. The next period is visibly introduced with its age/year and changed enemies/environment accents. The character remains at the level's starting age throughout combat.

The authored traveler and clearing candidates can materially improve the current scene; demo integration is awaiting the explicit owner decision recorded in PLAN-005. Creature/equipment direction remains original and consistent with the storybook palette. Preserve exact asset versions and avoid treating a gameplay code merge as final art approval.

## Persistence and authority

Freeze the bounded chronological level plan and encounter/equipment definitions when creating the journey. Keep the plan separate from mutable combat state. Store inventory, current level, enemy/boss HP, player health, phase, released/revealed/consumed memories and completed levels with monotonic revision and pinned rule/catalog versions.

Commands carry a unique action ID and expected revision. The server validates owner, current level, equipment/encounter prerequisites and cooldowns, computes damage and health, and derives boss defeat and progression. The browser cannot submit an age, unlock list, damage amount, enemy HP, boss-win flag or arbitrary next level. Retries must not apply damage or consume a bundle twice. Stale concurrent tabs cannot overwrite progress. Validate reduced state before writing it, retaining the frozen plan’s combat values as authority. Save views and action checks share one application clock; a remaining cooldown longer than its full permitted duration is treated as clock skew and expires rather than locking a save for hours. Server-side errors, including invalid stored state, emit bounded diagnostics without private identifiers. [DESIGN-009](009-overnight-contracts.md#current-shared-data-and-http-contract) defines the current wire envelope, actions, errors and bounded receipt guarantee.

Movement and spatial hit detection may remain local for this private single-player slice; that does not establish server-authoritative physics or cheating resistance. Discrete validated combat events avoid a per-frame database write loop. A separate bounded action rate limit must support responsive combat without relaxing setup/session controls.

Prototype v1 records used incompatible age/completion semantics. Preserve them as legacy viewable records; do not manufacture boss victories or erase them during migration. New journeys use the new version. Media from a v2 locked bundle remains inaccessible through its save route until the boss releases it; owned legacy/previously revealed memories retain their existing access and revocation behavior.

## Photo investigation

The deployed Chromium reproduction retrieved and decoded all three fixture SVGs, including three successful WebGL uploads. These are simple fictional drawings, not photographs pulled from Immich. That successful desktop result does not reproduce or dismiss Tom's blank tiles on his browser. The current loader swallows failures and marks the URL attempted before success, preventing a useful retry. A fixture SVG CSP change that preserves its same origin addresses a compatibility risk; actual WebKit execution was unavailable in the pod, so it is not a proven Safari root cause.

Real private photos still need admitted-player access and connection/subject configuration. The fixture web process must not receive the Immich secret or gain a placeholder route to family media. Keep this limitation explicit until the actual integration is exercised.

## Authored visual intake

The isolated candidate scene replaces temporary encounter and gear studies with versioned GLBs. Enemy idle/move clips repeat; attack timing follows the simulation wind-up and contact pose; hit/defeat play once. Previously defeated enemies stay hidden on resume. Traveler equipment is parented to the actual hand bones at measured grip centers, with procedural arm/wrist motion applied after the authored traveler clip. The strongest collected shield is displayed, and a stronger attack tool replaces the held tool. GLTFLoader preserves original dotted bone names in `userData.name` while sanitizing runtime node names; socket lookup uses the authored identity. Each scene owns its geometry/material/texture copies, while decoded source images remain cache-owned until final scene disposal. Final owner approval and actual game/browser evidence remain separate from these integration contracts.
