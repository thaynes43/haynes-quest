# DESIGN-004: Memory journey and life chapters

- **Status:** Owner-confirmed arc; broader campaign grouping remains proposed
- **Last updated:** 2026-09-11
- **Source:** Tom's chronological-photo, era-enemy and coming-of-age brief, corrected after review of the first prototype
- **Satisfies:** [PRD-001 R-03, R-12–R-14, R-18, R-20–R-35](../prds/001-project-brief.md)
- **Related:** [Photo connections](003-photo-connections-and-people.md), [era catalog](005-era-enemy-catalog.md), [memory age](006-memory-age-and-abilities.md), [combat loop](010-era-combat-loop.md), [saved games](001-technical-foundation.md)

## Player experience

The player starts as a small, mysterious character at memory age zero. A selected person's dated memories give the journey its chronology and reachable ending. Each level begins in the period associated with the character's current age. The player explores for useful equipment, fights that period's pop-culture-inspired enemies, and defeats its boss. Only then are that level's memories released.

After victory, the player takes time with the pictures and absorbs the completed memory bundle. That advances the character to the next represented age bracket, retaining earlier equipment and learned abilities. The next level belongs to the calendar period corresponding to the age reached. A child's short history and an adult's decades can both form complete journeys; reaching adulthood is not a universal completion condition.

The earlier prototype incorrectly made every recovered photo an age transition and postponed the fights. That behavior is superseded. The current arc requires exploration, useful gear, period enemies, a boss and post-boss memory consumption. [DESIGN-010](010-era-combat-loop.md) freezes those boundaries for the corrected implementation.

## New and resumed journeys

1. In the eventual family release, sign in through Authentik and choose an existing journey or create one. The current private fixture uses a server-assigned fictional identity; it is not production admission.
2. Resolve the selected person within their authorized photo connection. Name collisions and an explicit age source must be settled before a real-person journey is generated. The fixture uses Demo Adventurer and a known fictional birth date.
3. Preview usable dated memories and choose a bounded selection. The frozen journey retains their source identities, chronology, level bundles and rule versions. No generator receives private family photos to make the synthetic assets.
4. Begin at age zero with movement and interaction. Find equipment that makes the opening fight possible with those starting abilities.
5. Complete the equipment → encounters → boss → released pictures → consumption → growth sequence. The next level changes period after that transition, rather than advancing the setting when the player merely opens a picture.
6. Resume the same subject, level, health, inventory, encounters, memory state, age and learned actions. Starting a different subject creates a separate journey.

## Timeline and save rules

| ID | Rule |
| --- | --- |
| D-01 | Use eligible dated photos of the resolved subject within the authorized connection. Similar names are not equivalent identities. |
| D-02 | Capture/event dates determine chronology, not upload order. Missing or conflicting dates need correction or exclusion; they are not invented. |
| D-03 | Photo coverage does not establish birth, current age or a complete life history. Real age-gated play needs an accepted explicit age source. |
| D-04 | Freeze a bounded chronological selection. Assign each selected memory to exactly one level bundle; do not duplicate pictures to fill a quota. |
| D-05 | Begin at age zero even when infant photos are absent. Sparse coverage can advance through several age bands after the opening boss, without fabricating baby pictures or mandatory empty years. |
| D-06 | A level's starting age/period determines its encounters. Its final memory age is an eventual reward, not an ability granted on entry. |
| D-07 | The current boss releases the current bundle. Revelation records pictures; consumption advances age and the next level in one authoritative save operation. |
| D-08 | Stable subject, level, memory, equipment and encounter IDs survive resume. Temporary media URLs, display labels and array positions are not durable identity. |
| D-09 | Later uploads, date corrections, subject changes and rule/catalog updates do not silently rewrite an existing journey. Reconciliation needs its own explicit policy. |
| D-10 | Revoked media remains inaccessible while recorded progress is preserved. Saved chronology never overrides current authorization. |
| D-11 | Shared game artwork has independent versions. Replacing it cannot rewrite the subject or grant abilities. Final art still needs exact-version owner review. |
| D-12 | Explicit subject preferences may guide future roster selection, but are not inferred from pictures or names. Historical eligibility and player difficulty remain separate. |
| D-13 | Child, sparse and single-period libraries have viable endpoints with their represented ages and available abilities. No future life stage is fabricated to force completion. |

## Current two-period slice

The implementation uses provisional age thresholds rather than a fixed ten-level or one-decade-per-level rule. Consecutive selected memories form the bundle through the first memory reaching the next threshold; a remaining tail becomes the final bundle. [DESIGN-006](006-memory-age-and-abilities.md) defines the exact current defaults and sparse behavior.

The existing three fictional memory ages, 0, 4 and 7, form a 2020 opening and a 2024 childhood level. Each has two ordinary encounters, one boss and useful attack/guard pickups. Defeating the first boss and revealing both released pictures keeps the traveler at age zero. Absorbing them produces age four, a child appearance and jumping, and starts the 2024 level. The last bundle ends the journey at age seven.

The first period's original encounter studies evoke block-building games and livestreaming; the second uses repeating ribbon performers, reflective masks and a spool-like boss to evoke remix culture. These are authored curation choices, not claims about the subject's interests. The full historical roster and finished new enemy assets remain incomplete. See the [catalog](../assets/catalog.md) and active work orders for actual authoring status.

## Broader campaign and story

Tom's September 11 [future lifetime campaign direction](../BACKLOG.md#bl-06-a-lifetime-campaign-that-grows-with-the-player) connects recovered age to increasing challenge and the actual life timeline. A child may reach the end of the memories currently available and continue years later; an adult can progress through decades already represented in their archive. Future extension must preserve the completed journey and deliberately add curated chapters. This does not change the current frozen, finite-save behavior or fabricate future stages.

Tom's earlier decade/proportional grouping direction remains useful for pacing a larger library. The later clarification makes age advancement and its corresponding calendar period the transition rule. A decade does not automatically equal one level, and dense photos cannot force an entire library into the objective. Broader photo selection, sublevels, explicit preview of chapter counts and duplicate/burst filtering remain additional design work.

The avatar's relationship to the selected person, eventual identity reveal, world history and final narrative remain story decisions. Current UI should communicate the concrete loop without inventing a completed lifetime campaign. Journey progress measures selected chapters and objectives, not a percentage of a person's whole life.

Actual Authentik admission, real-person age policy, source revocation, physical Safari checks and owner approval of integrated artwork are separate acceptance boundaries. The earlier deployed fixture and its technical tests remain historical evidence; [PLAN-005](../../.agents/plans/completed/005-era-combat-loop.md) and the [handoff](../../.agents/HANDOFF.md) state what the corrected game has actually completed.
