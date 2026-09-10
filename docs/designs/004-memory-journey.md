# DESIGN-004: Memory journey and life chapters

- **Status:** Proposed
- **Last updated:** 2026-09-10
- **Source:** Tom's generic-avatar and chronological-photo brief
- **Satisfies:** [PRD-001 R-03, R-12–R-14, R-18, R-20–R-24](../prds/001-project-brief.md)
- **Related:** [Saved games](001-technical-foundation.md), [photo connections and people](003-photo-connections-and-people.md), [asset authoring](002-asset-pipeline.md)

## Player experience

The player starts as a generic, mysterious character with no memory. Before entering the world, they select whose memories they will explore. The game uses that person's photos to create a chronological journey: babyhood when photos cover it, then later represented periods, ending with the latest memories available.

Collecting a photo recovers a memory and advances the journey. The experience changes with the years represented in the library, so a child's short history and an adult's decades of photos can both form a complete journey. The avatar's appearance does not need to match the selected person or age through their life. The exact relationship between the avatar and that person, including any identity reveal, remains a story decision.

This establishes the narrative and progression direction. World themes, movement, obstacles, puzzles or combat, the presentation of a recovered photo, chapter completion thresholds, and the ending are still to be designed. Do not infer a fixed list of life milestones from the person's age or fabricate biographical events from photo gaps.

## New and resumed games

1. Sign in through Authentik and choose an existing save or New game.
2. For a new game, choose a resolved person from the configured photo connection. Name collisions must be resolved during setup.
3. Preview the usable photo coverage and chapter outline. Distinguish actual photo years from age labels; show missing dates or insufficient content clearly.
4. Begin with the shared mysterious avatar in the earliest available chapter. Adding a person with usable photos needs no new 3D model.
5. Collect that chapter's memories and progress through later chapters under the eventual gameplay rules.
6. Resume the same subject, chapter, and collected memories from the save. Another subject starts a separate journey.

## Timeline requirements

| ID | Rule |
| --- | --- |
| D-01 | Use eligible photos of the selected, resolved person. Treat the connection and person as scoped identities; never substitute someone with a similar name. |
| D-02 | Base chronology on usable capture/event dates, not upload order. A newly imported old photo belongs to its historical period. Missing, implausible, or conflicting dates need correction or exclusion from chronological placement; do not invent an exact date. |
| D-03 | Photo coverage is the earliest-to-latest eligible dated content. It does not establish birth, current age, or the completeness of the person's life story. Avoid age inference from appearance. |
| D-04 | Proposed setup: birth date is optional. If supplied and consistent with the dates, it supports age-at-photo labels and life-stage grouping. Without it, use calendar years or neutral early/later chapter labels. This default is proposed pending Tom's answer, not an owner ruling. |
| D-05 | Tailor chapter count and grouping to the represented periods and usable photos. Begin at the earliest available period, skip or combine empty/sparse periods, and end at the latest represented period. Exact age bands and minimum photo counts remain design choices. |
| D-06 | With one represented year, support a short journey. With no eligible dated photos, explain the setup problem and keep existing saves accessible. Missing infancy does not prevent a later-life journey or turn its first chapter into babyhood. |
| D-07 | Keep the selected subject, chapter identities, memory identities, and collection progress stable within a saved journey. Display names, temporary URLs, and chapter array positions are not durable identifiers. |
| D-08 | Later uploads, date corrections, person changes, and timeline-rule changes must not silently rewrite completed chapters or clear progress. Define explicit refresh/reconciliation behavior before implementing it. New games may use the current library coverage. |
| D-09 | An inaccessible or removed photo keeps its recorded collection state; show recoverable unavailability instead of silently awarding it again or deleting the save. A saved timeline never bypasses current photo authorization. |
| D-10 | Avatar artwork is shared game content with its own asset version. Replacing it preserves all subject and memory progress. The memory library does not supply a required avatar model or a runtime generation task. |

Age-dependent chapter names describe the person in the photos. They do not determine the player's ability or game difficulty; a child can explore an adult's journey. Difficulty and child-friendly controls need their own gameplay decisions.

For example, a library with dated photos only from later childhood begins there. A library spanning several decades with long gaps can use fewer chapters across the represented periods. Neither case requires inventing baby photos, forcing an empty adolescence chapter, or extending to the person's present age when the latest photos are older.

## Collection and progress

Each recoverable memory links a game-owned memory identity to an authorized source asset in the selected connection. The game records collected memories and chapter progress; the exact objective for completing a chapter is not yet chosen. Photo abundance must not require collecting an entire library. Selection limits, duplicate/burst handling, replay behavior, and newly available photos belong to the detailed collection design.

The underlying source library can change while a game is in progress. The proposed technical approach is a versioned journey definition retained with the save, with explicit updates when needed. That records ordering and identity; it is not a permanent copy of every original photo or permission to display revoked content. [DESIGN-001](001-technical-foundation.md) owns the save boundary and [DESIGN-003](003-photo-connections-and-people.md) owns source access.

## Validation scenarios

- A short child timeline and a sparse adult timeline use the same avatar and produce different appropriate chapter coverage.
- Photos dated from infancy through later years appear in chronological chapters; upload order does not determine history.
- Missing infancy, long gaps, a single represented year, and no usable dated photos have defined outcomes.
- With birth information, check age labels around birthdays. Without it, show years without claiming exact ages. Invalid or contradictory dates do not create negative ages or false babyhood.
- Person rename, avatar replacement, reload, and another device session retain the same subject and memory progress.
- A late upload of an older photo, a corrected date, and removal or revocation of a collected photo do not silently reorder a completed journey or duplicate collection credit.

## Decisions still in the requirements phase

| ID | Decision | Status |
| --- | --- | --- |
| Q-01 | Optional or required birth-date setup? | Asked Tom on 2026-09-10. Proposed default is optional, with calendar-year fallback; not yet confirmed. |
| Q-02 | How do represented years become chapters, and how many memories complete each one? | Deferred to chapter and collection design; no fixed lifespan, age bands, or quota selected. |
| Q-03 | What does the avatar discover about its identity, and what concludes the journey? | Deferred to story design; generic appearance and initial amnesia are the current direction. |
| Q-04 | How are timeline previews corrected and existing saves refreshed after library changes? | Deferred to setup/collection design; preserve identities and progress under D-07–D-09. |

This is documentation only. Finish technical and nontechnical requirements before tool setup, asset production, or prototype execution. Automatic person-specific character generation remains conditional future [BL-01](../BACKLOG.md), and would require a new product decision about its fit with this premise.
