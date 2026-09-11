# DESIGN-006: Memory age and accumulating abilities

- **Status:** Owner-confirmed loop; provisional age bands and abilities implemented for PLAN-005
- **Last updated:** 2026-09-11
- **Source:** Tom's correction: equipment and era combat precede the boss; memories consumed after victory advance age and the next period.
- **Satisfies:** [PRD-001 R-12, R-20–R-24, R-27, R-30–R-35](../prds/001-project-brief.md)
- **Related:** [Memory journey](004-memory-journey.md), [era enemies](005-era-enemy-catalog.md), [combat contract](010-era-combat-loop.md), [asset authoring](002-asset-pipeline.md)

## The coming-of-age arc

Every new journey begins at memory age zero. The player explores the current period, finds useful equipment and uses it against that period's enemies. Defeating the boss releases the level's memories. The player remembers those pictures, then deliberately absorbs enough memories to advance to the next age bracket. The next level takes place in the calendar period corresponding to the age they have reached.

```mermaid
flowchart LR
    A[Current age and period] --> B[Explore and find equipment]
    B --> C[Face period enemies and the boss]
    C --> D[Boss releases memories]
    D --> E[Remember the pictures]
    E --> F[Absorb the completed bundle]
    F --> G[Grow and retain abilities]
    G --> A
```

**Boss victory alone does not change age. Viewing or revealing one picture does not change age.** Consumption of the completed, released bundle is the age transition. This corrects the earlier prototype, which aged the traveler on individual photo recovery. Those old saves remain readable as legacy records; they are not converted into invented boss victories.

Equipment and learned abilities have different sources. A tool found during exploration enables attacks in that level. A shield enables guarding. Age-based abilities are retained across periods; the fixture introduces jumping at age four. Finding a weapon never grants age, and beginning a new level never grants the age of its unrecovered final picture.

## Bounded implementation

The provisional age thresholds are **4, 8, 13, 18, 25, 35, 50 and 65**. These are game pacing defaults, not biological milestones or owner-approved final balance. Starting above the current age, the frozen planner assigns consecutive selected memories through the first one reaching the next threshold. If no such memory remains, the final bundle ends at the last selected memory. It does not fabricate pictures or future levels to fill a bracket.

The current fictional dates demonstrate two levels:

| Level | Starting state | Released memory ages | State after consumption |
| --- | --- | --- | --- |
| The Pixel Orchard | Age 0, period 2020 | 0 and 4 | Age 4, child appearance, jumping; enter 2024 |
| The Looplight Fair | Age 4, period 2024 | 7 | Age 7; journey complete within childhood |

The planner uses the explicit fictional birth date for the opening period, and the prior consumed bundle's last photo date for the next period. Actual photo dates determine mapped age; upload time, play time, picture count and the person's present age do not substitute for it. Sparse bundles can cross several thresholds. Every required fight and route must still be possible with the actions already available before that fight.

## Progression contract

| ID | Rule |
| --- | --- |
| D-01 | New journeys start at age zero with movement and interaction, no inventory and no remembered pictures. Another save does not supply abilities or equipment. |
| D-02 | Equipment is collected from the active level. Server-owned definitions determine its attack strength and guard protection. The client never supplies damage values, granted abilities or an age. |
| D-03 | The active level's ordinary encounters precede boss damage. Only server-confirmed boss defeat releases its bundle. Later-level pictures stay locked. |
| D-04 | Revealing a released picture records memory recovery without changing age, appearance or abilities. Pictures remain readable after revelation and consumption. |
| D-05 | Consumption requires boss victory and every required picture in the current bundle to be revealed. One transaction records consumed memories, completed level, mapped age, eligible abilities, appearance and next level or completion. |
| D-06 | Retain earlier abilities and equipment. Revisiting pictures, retries and stale commands cannot decrease age or grant progress twice. Reaching an era does not grant all abilities of that era's final memory. |
| D-07 | Expose the same actions on keyboard/mouse and touch. Introduce a newly learned action before a route requires it; an opening boss cannot require jumping earned only after that boss. |
| D-08 | Save frozen level definitions and mutable combat/progression separately, with rule versions, durable action IDs and expected revisions. Resume restores health, inventory, encounters, phase, revealed/consumed pictures and age. |
| D-09 | Defeat and retry preserve inventory and earlier completed levels. Retry restores the current fight safely; it does not award memories or erase an earlier bundle. |
| D-10 | Library edits, age-source corrections, catalog updates and art replacement cannot silently recalculate an existing journey. Revoked source media stays inaccessible without deleting recorded progress. |
| D-11 | The selected library bounds the ending. A child or single-period journey can finish without adulthood, invented empty years or unrepresented future abilities. |
| D-12 | The synthetic avatar expresses growth with authored infant/child meshes and clips. It remains separate from person identity; automatic likeness generation and later stages are still additional work. |

For the current bounded slice, the course remains gentle. Tom's future [lifetime campaign direction, BL-06](../BACKLOG.md#bl-06-a-lifetime-campaign-that-grows-with-the-player) supersedes a blanket separation of challenge from recovered age: later recovered life stages should combine more abilities and harder obstacles and encounters. The human player's experience and assistance needs remain distinct from that progression; gender does not determine difficulty. The same recovered age in different calendar periods can use the same learned actions with different era enemies.

## Future real-life continuation

BL-06 adds a future distinction between completing the currently curated journey and having later life chapters available. In a journey through one's own life, recovered age cannot advance into an unlived stage or unsupported future photos. Reaching the current endpoint may mean waiting for real life and new memories, then explicitly extending the saved journey. Time passing alone does not defeat a boss, consume a photo or grant an ability. The existing finite-save behavior remains unchanged until that continuation contract is designed.

## Real-photo age source and remaining decisions

The fictional fixture has a known birth date. Tom has clarified the birthday as the age source. Real-person setup still needs authenticated media admission and the source-local capture-date policy. No age is inferred from appearance, and the earliest available picture is never assumed to depict birth. An approximate anchor would require an explicit precision policy.

Broader age abilities, within-infancy progression, missing-period introductions, additional appearance stages and final difficulty balance remain to be designed and reviewed. They do not change the owner-confirmed ordering above. [DESIGN-010](010-era-combat-loop.md) records the current combat and persistence implementation; [PLAN-005](../../.agents/plans/005-era-combat-loop.md) records its actual acceptance status.

## Validation

Verify age remains unchanged after boss defeat and each picture reveal, then advances exactly once after bundle consumption. Exercise missing infancy, same-age pictures, sparse thresholds and a childhood endpoint. Check forged ages/damage, out-of-order bundles, duplicate/stale commands, simultaneous consumption, defeat/retry and server restart. Play the complete two-period sequence with keyboard and touch, observing the changed appearance, retained gear and next period. Browser emulation does not establish physical iPhone/iPad Safari quality or performance.
