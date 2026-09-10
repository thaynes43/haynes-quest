# DESIGN-004: Memory journey and life chapters

- **Status:** Proposed
- **Last updated:** 2026-09-10
- **Source:** Tom's generic-avatar, chronological-photo, level-pacing, and enemy-personalization brief
- **Satisfies:** [PRD-001 R-03, R-12–R-14, R-18, R-20–R-26](../prds/001-project-brief.md)
- **Related:** [Saved games](001-technical-foundation.md), [photo connections and people](003-photo-connections-and-people.md), [asset authoring](002-asset-pipeline.md)

## Player experience

The player starts as a generic, mysterious character with no memory. Before entering the world, they select whose memories they will explore. The game uses that person's photos to create a chronological journey: babyhood when photos cover it, then later represented periods, ending with the latest memories available.

Collecting a photo recovers a memory and advances the journey. The experience changes with the years represented in the library, so a child's short history and an adult's decades of photos can both form a complete journey. The avatar's appearance does not need to match the selected person or age through their life. The exact relationship between the avatar and that person, including any identity reveal, remains a story decision.

Tom is considering one year per level or a percentage of the person's history per level, and wants different enemies tailored for different genders. The sections below compare progression options and propose how to personalize enemies. A ten-chapter target and the source of gender/preferences are not settled. World themes, movement, enemy interactions, the presentation of a recovered photo, chapter completion thresholds, and the ending still need design. Do not infer a fixed list of life milestones from the person's age or fabricate biographical events from photo gaps.

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
| D-05 | Tailor chapter count and grouping to the represented periods and usable photos. Begin at the earliest available period, skip empty periods or combine sparse periods, and end at the latest represented period. Exact age bands and minimum photo counts remain design choices. |
| D-06 | With one represented year, support a short journey. With no eligible dated photos, explain the setup problem and keep existing saves accessible. Missing infancy does not prevent a later-life journey or turn its first chapter into babyhood. |
| D-07 | Keep the selected subject, chapter identities, memory identities, and collection progress stable within a saved journey. Display names, temporary URLs, and chapter array positions are not durable identifiers. |
| D-08 | Later uploads, date corrections, person changes, and timeline-rule changes must not silently rewrite completed chapters or clear progress. Define explicit refresh/reconciliation behavior before implementing it. New games may use the current library coverage. |
| D-09 | An inaccessible or removed photo keeps its recorded collection state; show recoverable unavailability instead of silently awarding it again or deleting the save. A saved timeline never bypasses current photo authorization. |
| D-10 | Avatar artwork is shared game content with its own asset version. Replacing it preserves all subject and memory progress. The memory library does not supply a required avatar model or a runtime generation task. |
| D-11 | Compare annual levels with proportional chapters using short, long, and sparse libraries. The proposed starting point is up to ten chapters across available photo coverage, adjusted for usable memories. This is a pacing proposal, not a fixed chapter-count requirement or ten percent of an assumed lifespan. |
| D-12 | Support different enemy sets. The source of personalization—player choice, the subject's explicitly configured gender, or the player's explicitly configured gender—is awaiting clarification. Do not infer gender from names, photographs, or the generic avatar. Separate enemy theme from difficulty and retain any selected setting with the saved journey. |

Age-dependent chapter names describe the person in the photos. They do not determine the player's ability or game difficulty; a child can explore an adult's journey. Difficulty and child-friendly controls need their own gameplay decisions.

For example, a library with dated photos only from later childhood begins there. A library spanning several decades with long gaps can use fewer chapters across the represented periods. Neither case requires inventing baby photos, forcing an empty adolescence chapter, or extending to the person's present age when the latest photos are older.

## Comparing level structures

For this proposal, a chapter is one playable level covering a chronological portion of the photo history. A hub, smaller stages within chapters, and the physical layout of levels have not been chosen.

| Structure | What it provides | Tradeoff |
| --- | --- | --- |
| One calendar year per level | Clear year labels and a natural fit for a short history. | Longer histories create many more levels; missing years and uneven photo counts need separate handling. |
| Ten equal time slices | A similar number of levels across different history lengths; each initially covers about ten percent of the available span. | Dense periods and photo gaps can produce very different amounts of content per level. Equal time does not mean equal play time. |
| Up to ten chapters adjusted for usable photos | A manageable journey length with chronological coverage and fewer sparse or empty levels. | Final boundaries may cover unequal spans; minimum content and merging rules need a prototype. This is Astra's recommended starting proposal. |

Use the earliest and latest eligible photo dates to propose boundaries. A six-year span with ample coverage would initially divide into ten periods of about seven months; an eleven-year span into periods of about thirteen months; a forty-year span into periods of about four years. These examples describe available history, not the person's current age. Known birth information adds age labels under D-04; it does not fill missing years with photos.

Start with roughly equal time windows, assign each eligible dated memory to one chronological chapter, combine sparse adjacent windows, and omit empty windows without dropping represented periods. Do not duplicate photos to fill a quota or force ten chapters on a tiny library. A single represented year can remain a short journey under D-06. Exact minimum content, boundary rounding, and merge rules remain proposed implementation details. A preview should show the resulting periods and actual chapter count before starting.

Each chapter should have a bounded selection of memories so thousands of photos from one year do not create thousands of required collectibles. Preserve coverage of represented periods rather than dividing the library into ten equal groups of photos, which could give a single busy year most of the adventure. Selection quality, burst/duplicate filtering, collection targets, and the intended play time per chapter remain to be designed.

The displayed journey progress measures chapters or objectives completed. It must not claim that the player has recovered a percentage of someone's whole life. Later uploads and changed grouping rules follow D-07–D-09 rather than resizing an existing save silently.

## Enemy personalization

Tom requested different enemies tailored for different genders. Clarification has been asked about whose gender or preferences should select the set: the player or the person in the photos. Neither the shared avatar nor Authentik login establishes that information.

The proposed implementation concept is an **enemy theme**: a selected set of enemy appearances and behaviors. Illustrative directions include mischievous robots, enchanted toys, woodland monsters, or shadow creatures obscuring memories. These are unassigned creative examples, not selected assets or claims about what a gender likes. Enemies can vary across chapters without depicting real people or asserting that the subject experienced particular fears or events.

Astra recommends letting the player choose the theme. If gender-based presets are wanted, use explicitly supplied information to suggest a theme and allow an override; missing information can lead to a theme chooser or general default. Which identity supplies a preset remains unresolved. Save the chosen theme with the journey so another device or a profile edit does not silently change the adventure. Whether themes can be changed during a journey remains a UX decision.

Enemy theme and challenge settings are separate. The same movement/attack patterns can be reused across different art sets where appropriate. Speed, aggression, complexity, and any chapter difficulty curve follow gameplay settings, not gender or the subject's age. Evasion, combat, noncombat ways to clear enemies, bosses, and specific enemy rosters remain unselected. This request adds enemy design to the requirements phase; it does not start enemy asset production or a combat prototype.

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
- Compare annual and proposed proportional grouping for six-, eleven-, and forty-year spans, plus a single-year library. Sparse windows create no mandatory empty chapters; dense bursts do not consume the whole journey or force duplicate collection credit.
- Check that each selected dated memory belongs to one chapter, date boundaries preserve chronology, and the preview matches the journey retained by the save.
- Under the eventual personalization choice, test different player/subject settings and missing gender information without deriving gender from names or photos. Theme choice survives resume; changing a theme must not reset memories or silently select a harder difficulty.

## Decisions still in the requirements phase

| ID | Decision | Status |
| --- | --- | --- |
| Q-01 | Optional or required birth-date setup? | Asked Tom on 2026-09-10. Proposed default is optional, with calendar-year fallback; not yet confirmed. |
| Q-02 | How do represented years become chapters, and how many memories complete each one? | Tom proposed annual or percentage-based levels. Astra recommends up to ten chapters over available photo coverage, adjusted for sparse periods. The chapter target, exact grouping rules, and completion quota remain proposed. |
| Q-03 | What does the avatar discover about its identity, and what concludes the journey? | Deferred to story design; generic appearance and initial amnesia are the current direction. |
| Q-04 | How are timeline previews corrected and existing saves refreshed after library changes? | Deferred to setup/collection design; preserve identities and progress under D-07–D-09. |
| Q-05 | Whose gender or preferences choose the enemy set? | Asked Tom on 2026-09-10: player-selected theme, the subject's explicitly configured gender, or the player's explicitly configured gender. A selectable theme with overridable presets is the recommendation pending his answer. |

This is documentation only. Finish technical and nontechnical requirements before tool setup, asset production, or prototype execution. Automatic person-specific character generation remains conditional future [BL-01](../BACKLOG.md), and would require a new product decision about its fit with this premise.
