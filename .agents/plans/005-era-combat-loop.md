# PLAN-005: Equipment, era combat and boss-gated growth

- **Status:** In progress
- **Owner correction:** Tom, 2026-09-11: the player finds useful equipment during a level to fight the pop culture of that period. After beating the boss, the player consumes enough memories to advance to the next age bracket. The next level takes place in the period corresponding to that advanced age. The existing blank/simple photo tiles and placeholder presentation are inadequate.
- **Precedence:** This corrects the coordinator's PLAN-004 interpretation. Equipment, period enemies, a boss and the post-boss age transition are the core loop, not optional content postponed until after a memory-walking demo. The earlier checks describe a working prototype of the wrong loop; they do not prove this acceptance.
- **Read with:** [TEAM](../TEAM.md), [DESIGN-010](../../docs/designs/010-era-combat-loop.md), [asset pipeline](../../docs/designs/002-asset-pipeline.md), [photo boundary](../../docs/designs/009-overnight-contracts.md), [current handoff](../HANDOFF.md).
- **Worktree:** `/home/dev/work/quest-parody-obby`, branch `agent/quest-parody-obby`, based on merged main `94aedfb`.

## Enemy direction correction

Tom rejected the six generic creature studies as enemies. The new requirement is recognizable pop-culture parody, using capture-date metadata and the person's birthday to establish period and age progression. The coordinator's unrequested broad-inspiration-only restriction is removed. All six existing models remain available for possible friendly/ambient use; none is selected as an enemy. Their live Blender leases and render jobs have ended. Root has now written six specific recognizable references, primary-sourced historical eligibility, visual jokes and encounter behaviors. All six construction concepts are selected and saved; replacement models are in active production under WO027/028/032. Preserve useful equipment and reusable animation/loading work.

## Obby requirement

Tom explicitly requires Roblox-style obstacle-course play mixed with goofy fights, approachable for his six-year-old daughter. [DESIGN-011](../../docs/designs/011-forgiving-obby.md) defines the main-route approach and acceptance: visible hazards, forgiving timing, jumps after the age-based unlock, safe checkpoints and no loss of equipment or memory progress from missed traversal. A flat combat corridor fails the intended loop.

## Required result

A convincing bounded playable slice demonstrates two period levels, useful equipment pickups, active enemies and a boss, actual visible memory pictures after victory, deliberate memory consumption, visible age growth, retained earlier abilities, and entry into the next period. Improve scene composition, character animation, materials, lighting and feedback; functional tests alone do not establish visual quality. Show actual browser captures of the rebuilt game, rather than substituting catalog renders as game evidence.

The server must own inventory, encounter HP, boss defeat, bundle release/consumption, level order, age/ability/appearance changes and saves. Use strict idempotent commands and durable transactions. Existing prototype saves remain preserved as legacy records; they cannot be reinterpreted as completed boss victories.

The current fixture deployment intentionally cannot retrieve real Immich photos. Investigate the reported blank tiles honestly, distinguish delivered fictional illustrations from actual private photo integration, and fix silent media failure/retry handling. The private adapter remains available for the separate authenticated integration. OAuth/admission and real-person setup require their existing configuration; do not silently attach private credentials to placeholder access.

## Execution

1. Record Tom's corrected arc in the living brief, designs and guide; supersede the wrong memory-by-memory age rule.
2. Diagnose the current media path and retain browser-specific evidence and limits.
3. Ratify a finite level/encounter/equipment/command contract, implement persistence and boss-gated progression, and test forged/duplicate/stale/out-of-order operations.
4. Rebuild the actual scene, input, combat and UI around the new loop, including forgiving obstacle sections, timed jumps after the ability unlock, matching visible/collision geometry and local recovery that preserves saved progress. The lead owns visual design and writing. Native Sol handles bounded logic and verification; every Blender task remains fresh Astra max with one scene owner.
5. Complete the recognizable replacement cast and its exact model/animation review catalog. Prepare and test the concrete rebuilt game before a final promotion question. The earlier pending visual question predates Tom’s explicit rejection of the generic cast and cannot authorize those enemies. DESIGN-002 still requires exact-version owner approval before private gameplay promotion; ordinary checked code/docs merges remain authorized.
6. Verify actual image decoding/rendering, combat interaction, defeat/retry, boss-before-growth, photo reveal/consumption, next-period transition and server-owned resume. Test keyboard and simultaneous touch through actual obstacles and fights, including deliberate missed jumps, hazard recovery and a moving-platform crossing; distinguish emulation from physical Safari.
7. Review actual game captures against the intended look and loop; fix material quality problems before declaring completion. Carry checked PRs through merge and private GitOps release, scoped activity and live checks. Do not restart dev-env.

## Deferred boundaries

The broader lifetime campaign, full historical rosters, automatic likeness generation and physical-device performance certification are not claimed by this bounded slice. Exact age brackets and combat numbers are explicit implementation defaults, not developmental facts or new owner rulings. Required current equipment/enemy/boss production belongs to this plan; it cannot be silently moved back to the backlog.
