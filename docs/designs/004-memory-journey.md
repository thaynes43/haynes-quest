# DESIGN-004: Memory journey and life chapters

- **Status:** Proposed
- **Last updated:** 2026-09-10
- **Source:** Tom's generic-avatar, chronological-photo, decade/proportional level, and era-based enemy brief
- **Satisfies:** [PRD-001 R-03, R-12–R-14, R-18, R-20–R-29](../prds/001-project-brief.md)
- **Related:** [Saved games](001-technical-foundation.md), [photo connections and people](003-photo-connections-and-people.md), [asset authoring](002-asset-pipeline.md), [era enemy catalog](005-era-enemy-catalog.md)

## Player experience

The player starts as a generic, mysterious character with no memory. Before entering the world, they select whose memories they will explore. The game uses that person's photos to create a chronological journey: babyhood when photos cover it, then later represented periods, ending with the latest memories available.

Collecting a photo recovers a memory and advances the journey. The experience changes with the years represented in the library, so a child's short history and an adult's decades of photos can both form a complete journey. The avatar's appearance does not need to match the selected person or age through their life. The exact relationship between the avatar and that person, including any identity reveal, remains a story decision.

Tom's latest direction groups levels around decades or proportions of the available history and selects enemies and bosses from a static catalog inspired by the culture of each represented era. Gender can be entered for the selected subject at new-game setup. Exact chapter counts, boundaries, preference rules, and encounter mechanics remain for design. Pop-culture influences come from the photo dates; they do not assert what the person watched or experienced. World layout, movement, photo presentation, chapter completion thresholds, and the ending remain open.

## New and resumed games

1. Sign in through Authentik and choose an existing save or New game.
2. For a new game, choose a resolved person from the configured photo connection. Name collisions must be resolved during setup.
3. Enter the selected subject's gender through the setup form; exact options and whether a response is required remain for UX design. Preview usable photo coverage and the era/chapter outline. Distinguish actual photo years from age labels; show missing dates or insufficient content clearly.
4. Begin with the shared mysterious avatar in the earliest available chapter. Adding a person with usable photos needs no new 3D model.
5. Collect that chapter's memories and face era-appropriate enemies and bosses under the eventual gameplay rules. The cast changes with the represented calendar period as the journey advances.
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
| D-11 | Group levels around decades or proportions of available photo coverage, accounting for known age and usable memories. Exact count and boundaries remain open; no fixed ten-level rule is accepted. Short histories can contain multiple levels within an era, while long histories cross eras. |
| D-12 | Support explicit gender entry for the selected journey subject at setup. Do not infer gender from names, photographs, or the generic avatar. The catalog includes variety across genders; exact preference selection remains open. Separate personalization from difficulty and retain selected settings with the saved journey. |
| D-13 | Select ordinary enemies and bosses from a prepared catalog using the actual calendar periods of the memories they accompany. Later-era references cannot appear before their curated eligibility window. DESIGN-005 owns catalog provenance, selection, fallback, and versioned encounter identity. |

Age-dependent chapter names describe the person in the photos. They do not determine the player's ability or game difficulty; a child can explore an adult's journey. Difficulty and child-friendly controls need their own gameplay decisions.

For example, a library with dated photos only from later childhood begins there. A library spanning several decades with long gaps can use fewer chapters across the represented periods. Neither case requires inventing baby photos, forcing an empty adolescence chapter, or extending to the person's present age when the latest photos are older.

## Level structure and era boundaries

For this proposal, a chapter is one playable level covering a chronological portion of the photo history. Tom's direction is decade-like or proportional levels whose content changes with the selected person's history. A hub, smaller stages within chapters, and the physical layout of levels have not been chosen.

| Structure | Fit | Remaining choice |
| --- | --- | --- |
| Decade-aligned periods | Clear changes in the cultural influences available to the enemy catalog. | A short history may stay within one decade, so a decade cannot automatically equal one entire level. |
| Proportional periods | Spreads a short or long available history across a manageable number of levels. | A level may cross eras; content must still match the dated memories it accompanies. |
| Proportional pacing with era-aware boundaries | Proposed starting approach: use photo coverage to pace the journey and adjust boundaries or encounter sections around cultural-era changes. | Exact counts, minimum content, and boundary/transition rules require gameplay design. |

A short childhood history can produce several levels within the same cultural era. A history spanning decades can move through successive casts. If a chapter crosses a decade boundary or a reference's debut, split its encounter sections or adjust its boundary so a later influence is not shown alongside earlier memories. [DESIGN-005](005-era-enemy-catalog.md) defines date eligibility more precisely than decade labels alone.

Use the earliest and latest eligible photo dates to propose periods; known birth information supplies age labels and can inform pacing. A birth year alone neither establishes photo coverage nor supplies missing baby photos. No fixed ten-level count, exact decade boundaries, or percentage of an assumed lifespan has been selected.

Assign each selected dated memory to one chronological chapter, combine sparse adjacent periods, and omit empty periods without dropping represented coverage. Do not duplicate photos to fill a quota. Each chapter needs a bounded selection of memories so a photo-heavy year does not dominate the adventure. Exact content thresholds, burst/duplicate filtering, collection targets, and intended play time remain to be designed. A preview shows the resulting periods and actual chapter count.

Displayed journey progress measures chapters or objectives completed; it does not claim a percentage of someone's whole life. Library and grouping-rule changes follow D-07–D-09 rather than resizing an existing save silently.

## Era-based enemy personalization

The primary selection rule is now the calendar era of the memories. The game draws enemies and bosses from a curated, static pop-culture-inspired catalog, including period-relevant television, animation, games, YouTube, and internet influences. The runtime chooses prepared entries; catalog research and asset authoring happen before deployment. [DESIGN-005](005-era-enemy-catalog.md) records the detailed contract and original-art direction.

Tom's setup direction allows manual gender entry for the selected person. Use that explicit input; do not derive gender from images. The roster should offer variety across genders within each era. Optional interests and overridable presets remain proposed refinements, not fixed gender-to-franchise mappings or extra confirmed setup requirements. The exact field options and requiredness remain open, with a supported path for unknown information.

Personalization can vary eligible encounter choices without changing their historical eligibility. Difficulty and any progression curve remain separate from gender and the subject's age. The same age at different calendar dates can select different enemies; the same historical era can serve subjects of different ages. Save selected catalog/encounter identities and setup choices so resume preserves the adventure. Boss counts, combat/evasion rules, rewards, and chapter gates still need design.

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
- Compare decade-aligned and proportional grouping for short, long, sparse, and single-year histories. A short history can support multiple levels within an era; sparse periods create no mandatory empty chapters and dense bursts do not dominate the journey.
- Check that each selected dated memory belongs to one chapter, date boundaries preserve chronology, and the preview matches the journey retained by the save.
- Test explicit subject gender/settings and unknown information without deriving gender from names or photos. The same age in different calendar periods selects era-appropriate enemy and boss pools; catalog updates and resume preserve encounters and memories without changing difficulty.

## Decisions still in the requirements phase

| ID | Decision | Status |
| --- | --- | --- |
| Q-01 | Optional or required birth-date setup? | Asked Tom on 2026-09-10. Proposed default is optional, with calendar-year fallback; not yet confirmed. |
| Q-02 | How do represented years become chapters, and how many memories complete each one? | Revised by Tom on 2026-09-10: decade-like or proportional levels, with enemy eras following the represented calendar periods. Exact counts, grouping, and completion quotas remain open; ten levels is not a requirement. |
| Q-03 | What does the avatar discover about its identity, and what concludes the journey? | Deferred to story design; generic appearance and initial amnesia are the current direction. |
| Q-04 | How are timeline previews corrected and existing saves refreshed after library changes? | Deferred to setup/collection design; preserve identities and progress under D-07–D-09. |
| Q-05 | Whose gender or preferences choose the enemy set? | Direction clarified by Tom on 2026-09-10: the selected person's gender can be entered at game setup; use explicit input. The era selects the eligible enemy/boss catalog, with variety across genders. Input options, requiredness, preference weighting, and overrides remain for DESIGN-005/setup design. |

This is documentation only. Finish technical and nontechnical requirements before tool setup, asset production, or prototype execution. Automatic person-specific character generation remains conditional future [BL-01](../BACKLOG.md), and would require a new product decision about its fit with this premise.
