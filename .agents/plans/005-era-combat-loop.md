# PLAN-005: Equipment, era combat and boss-gated growth

- **Status:** In progress
- **Owner correction:** Tom, 2026-09-11: the player finds useful equipment during a level to fight the pop culture of that period. After beating the boss, the player consumes enough memories to advance to the next age bracket. The next level takes place in the period corresponding to that advanced age. The existing blank/simple photo tiles and placeholder presentation are inadequate.
- **Precedence:** This corrects the coordinator's PLAN-004 interpretation. Equipment, period enemies, a boss and the post-boss age transition are the core loop, not optional content postponed until after a memory-walking demo. The earlier checks describe a working prototype of the wrong loop; they do not prove this acceptance.
- **Read with:** [TEAM](../TEAM.md), [DESIGN-010](../../docs/designs/010-era-combat-loop.md), [asset pipeline](../../docs/designs/002-asset-pipeline.md), [photo boundary](../../docs/designs/009-overnight-contracts.md), [current handoff](../HANDOFF.md).
- **Worktree:** `/home/dev/work/quest-parody-obby`, branch `agent/quest-parody-obby`, based on merged main `94aedfb`.

## Enemy direction correction

Tom rejected the six generic creature studies as enemies. The new requirement is recognizable pop-culture parody, using capture-date metadata and the person's birthday to establish period and age progression. The coordinator's unrequested broad-inspiration-only restriction is removed. All six existing models remain available for possible friendly/ambient use; none is selected as an enemy. Their live Blender leases and render jobs have ended. Six specific reference concepts are saved; four replacement models are complete. New production is paused under Tom's later cost/curation direction. Preserve useful equipment and reusable animation/loading work.

## Player curation and production correction

Tom's later September 11 request adds configurable parent setup: full-name Immich lookup, birthday, curated photos for each level, child-specific enemy/boss choices, era defaults and explicit admin overrides. [DESIGN-012](../../docs/designs/012-player-journey-curation.md) records the experience and privacy/versioning boundaries. The former six-entry roster is a candidate library, not a mandatory cast for every child. Finish independent gameplay and checked PR work, but pause new asset production for a short design discussion. Tom selected The Besties duo first; do not automatically finish Nap/Diva or generate FNAF without agreeing on the next brief.

## Obby requirement

Tom explicitly requires Roblox-style obstacle-course play mixed with goofy fights, approachable for his six-year-old daughter. [DESIGN-011](../../docs/designs/011-forgiving-obby.md) defines the main-route approach and acceptance: visible hazards, forgiving timing, jumps after the age-based unlock, safe checkpoints and no loss of equipment or memory progress from missed traversal. A flat combat corridor fails the intended loop.

## Immediate playtest

Tom asked to assess progress by playing. [WO037](../work-orders/037-playtest-release.md) bounds the first test to two synthetic chapters using four completed candidate models: Mister Hiss, Peel Patrol and Drama Dragon first, then Sir Flush-a-Lot with returning Peel Patrol and Drama Dragon. New plans use immutable catalog v2; historical v1 saves retain their exact identities. Nap Captain and One-Star Diva remain outside new playtest selection. The returning cast is temporary playtest curation, not a permanent family roster. No new modeling, parent/admin setup, Besties encounter or future lifetime campaign should delay this test. Complete actual controls/media checks, checked app merge and the isolated private review release in [WO044](../work-orders/044-isolated-playtest-release.md). DESIGN007 permits this labeled candidate preview; normal-demo final artwork promotion still requires the owner decision.

## Required result

A convincing bounded playable slice demonstrates two period levels, useful equipment pickups, active enemies and a boss, actual visible memory pictures after victory, deliberate memory consumption, visible age growth, retained earlier abilities, and entry into the next period. Improve scene composition, character animation, materials, lighting and feedback; functional tests alone do not establish visual quality. Show actual browser captures of the rebuilt game, rather than substituting catalog renders as game evidence.

The server must own inventory, encounter HP, boss defeat, bundle release/consumption, level order, age/ability/appearance changes and saves. Use strict idempotent commands and durable transactions. Existing prototype saves remain preserved as legacy records; they cannot be reinterpreted as completed boss victories.

The current fixture deployment intentionally cannot retrieve real Immich photos. Investigate the reported blank tiles honestly, distinguish delivered fictional illustrations from actual private photo integration, and fix silent media failure/retry handling. The private adapter remains available for the separate authenticated integration. OAuth/admission and real-person setup require their existing configuration; do not silently attach private credentials to placeholder access.

## Execution

1. Record Tom's corrected arc in the living brief, designs and guide; supersede the wrong memory-by-memory age rule.
2. Diagnose the current media path and retain browser-specific evidence and limits.
3. Ratify a finite level/encounter/equipment/command contract, implement persistence and boss-gated progression, and test forged/duplicate/stale/out-of-order operations.
4. Rebuild the actual scene, input, combat and UI around the new loop, including forgiving obstacle sections, timed jumps after the ability unlock, matching visible/collision geometry and local recovery that preserves saved progress. The lead owns visual design and writing. Native Sol handles bounded logic and verification; every Blender task remains fresh Astra max with one scene owner.
5. Complete integration and exact model/animation review for the four-model playtest cast above. Prepare and test the concrete rebuilt game for the isolated candidate review in WO044. The earlier pending visual question predates Tom’s explicit rejection of the generic cast and cannot authorize those enemies. DESIGN-002 still requires exact-version owner approval before normal-demo gameplay promotion; ordinary checked code/docs merges remain authorized.
6. Verify actual image decoding/rendering, combat interaction, defeat/retry, boss-before-growth, photo reveal/consumption, next-period transition and server-owned resume. Test keyboard and simultaneous touch through actual obstacles and fights, including deliberate missed jumps, hazard recovery and a moving-platform crossing; distinguish emulation from physical Safari.
7. Review actual game captures against the intended look and loop; fix material quality problems before declaring completion. Carry checked PRs through merge and private GitOps release, scoped activity and live checks. Do not restart dev-env.

## Deferred boundaries

The broader lifetime campaign, parent/admin curation setup, Besties and further enemy production, full historical rosters, automatic likeness generation and physical-device performance certification are not claimed by this bounded slice. Exact age brackets and combat numbers are explicit implementation defaults, not developmental facts or new owner rulings. The completed four-model cast and useful equipment must be delivered and verified in the playtest; deferred work does not replace that requirement.
