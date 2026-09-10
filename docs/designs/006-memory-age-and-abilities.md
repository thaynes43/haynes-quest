# DESIGN-006: Memory age and accumulating abilities

- **Status:** Proposed
- **Last updated:** 2026-09-10
- **Source:** Tom's age-zero start and memory-driven ability progression brief
- **Satisfies:** [PRD-001 R-12, R-20–R-24, R-27, R-30–R-34](../prds/001-project-brief.md)
- **Related:** [Memory journey](004-memory-journey.md), [era enemies](005-era-enemy-catalog.md), [saved games](001-technical-foundation.md), [asset authoring](002-asset-pipeline.md)

## Gameplay loop

Every new game begins with the mysterious avatar at **memory age zero**, no collected memories, and a small set of baby abilities. Recovering photos advances the character through the selected person's life in chronological age order. Each newly reached stage adds abilities appropriate to that stage of the game. Earlier abilities carry forward into later periods.

```mermaid
flowchart LR
    A[Age zero and baby abilities] --> B[Reach the next memory]
    B --> C[Recover the age represented by that photo]
    C --> D[Keep learned abilities and unlock new ones]
    D --> E[Use abilities to overcome obstacles and encounters]
    E --> B
```

The player grows from simple movement and interaction into more capable traversal, tool use, and puzzle solving. Tom's description of becoming smarter is expressed through new gameplay actions and combinations; photos are not used to measure the real person's intelligence or developmental milestones. The precise abilities and unlock ages will be designed for play.

| Illustrative stage | Possible additions | Example use |
| --- | --- | --- |
| Baby opening | Scoot/crawl and simple grabbing or pushing | Reach a low memory, move a toy, or pass through a small opening. |
| Early childhood | Walking, jumping, and carrying objects | Cross a small gap or bring an object to a switch. |
| Later childhood | Climbing, simple tools, and multi-step interactions | Combine movement with a mechanism to open a route. |
| Later stages | More complex tools, planning, and ability combinations | Solve encounters using several skills already learned. |

These are illustrative ideas, not accepted age thresholds or an asset list. A short child journey only reaches its represented ages; it must still offer a complete, playable adventure with the available abilities. No adult stage or adult ability is a prerequisite for finishing a child's journey.

## Three separate progression inputs

- **Calendar period:** chooses the era-appropriate enemy/boss pool under DESIGN-005.
- **Recovered memory age:** determines which character abilities have become available.
- **Player difficulty settings:** tune challenge within the available abilities. Subject age and gender do not establish the human player's skill.

For example, two characters recovering memories at the same age can have the same ability set but face different era-inspired enemies. Entering a level that spans several ages does not immediately grant the abilities associated with its final photos. Age and abilities progress as the relevant memories are recovered within it.

## Age source and incomplete libraries

Ability age requires an explicit mapping from photo dates to the subject's age. The prior proposal of optional birth information with calendar-year labels alone is no longer sufficient for this mechanic. The recommended setup uses a birth date. Tom has been asked whether that should be required or whether an entered age at the earliest photo may serve as an alternative. This choice is pending; no age is inferred from appearance and the earliest photo is never assumed to depict birth.

Until age can be established under the selected policy, show a setup state for age-gated play. Calendar dates can still support a coverage preview and era selection, but cannot silently substitute for age. If an age-anchor alternative is selected, record its precision and uncertainty and use an explicit threshold policy; do not turn an approximate input into invented exact ages. Month-level progression within age zero may be useful and remains a gameplay choice.

Every save starts at zero even if the earliest available photo is older. The proposed missing-infancy path is a short opening reachable with the baby abilities, followed by the earliest real memory and a guided introduction to the abilities up to its known age. This can cross several stages without fabricating baby photos or requiring empty years. The exact catch-up sequence is proposed, not an owner ruling. Later gaps need the same treatment: each new action required by a route must be introduced before that route demands it.

## Progression contract

| ID | Rule |
| --- | --- |
| D-01 | A new save starts with memory age zero, no collected memories, and an explicitly defined baby ability set. The first memory is reachable using that set. Starting another journey does not inherit abilities from a different save. |
| D-02 | Only a valid memory recovery under the ordered journey can advance memory age. Use the photo's mapped age, not elapsed play time, photo count, chapter index, or the subject's present-day age. Later-age memories cannot bypass earlier required progression; the next eligible memory may itself raise age. |
| D-03 | Define stable ability IDs, unlock thresholds/prerequisites, and a versioned progression rule set. An age threshold can unlock several abilities, and many photos can share an age without each creating an unlock. Exact thresholds and within-stage collection order remain for design. |
| D-04 | Unlock only abilities eligible at the recovered age. Retain previously unlocked abilities across chapter and era transitions. Revisiting older memories cannot reduce age or remove abilities, and duplicate recovery cannot grant progress twice. No automatic age-related skill loss is part of this loop. |
| D-05 | Chapter entry does not grant the age or abilities of its newest photo. Level paths, objectives, ordinary enemies, and bosses must be completable using abilities available at that encounter, without needing an ability obtained only beyond that obstacle. |
| D-06 | Introduce newly unlocked actions through readable feedback and an opportunity to use them. Touch and keyboard/mouse expose the same available actions; locked actions cannot be used by calling an API or sending a game command directly. Exact control layouts remain for input design. |
| D-07 | Save memory age, the age-source revision, unlocked ability IDs, progression-rule version, and introduction/progression state alongside chapter, memory, and encounter progress. The server validates recovery and progression against the saved journey; client-supplied ages or unlock lists are not authoritative. |
| D-08 | Apply memory collection and its age/unlock changes as one logical save update with existing revision/idempotency rules. Interruptions, retries, stale tabs, and another device cannot award twice, lose an unlock, or save the photo without the corresponding progression. |
| D-09 | Library date edits, birth/age-source corrections, rule changes, or asset replacement must not silently recalculate an existing journey's age, revoke abilities, or change its subject. Preserve the saved rule/data revisions until an explicit reconciliation policy applies. A revoked photo remains inaccessible while recorded progression is retained. |
| D-10 | Missing infancy and later gaps must not create impossible ability gates or invented memories. One recovery can cross several thresholds; the proposed catch-up introduction covers required actions before they are needed. Final pacing for these gaps remains to be designed. |
| D-11 | The final reachable age is bounded by the eligible memories in the journey. A child's, sparse, or single-period library must have a viable endpoint with its available abilities; completion cannot require unrepresented future years or powers. |
| D-12 | The avatar remains generic and independent of the real person's likeness. Its posture, animation, controls, and abilities can express growth. Exact body changes, multiple age meshes, rig strategy, and final clips are deferred art/technical choices; automatic personal model generation stays outside the PoC. |

## Encounters and assets

The enemy catalog needs encounter variants or solutions compatible with the current ability set. Era eligibility still applies first; a limited baby ability set is not a reason to use an enemy from the wrong period. The selected difficulty setting can tune an encounter, but every required route must remain solvable with the current actions. Boss frequency, victory conditions, and combat/evasion mechanics remain open.

Asset authoring follows DESIGN-002 after requirements and tool setup. The later prototype should validate a small synthetic progression sequence and its animation/controller transitions before producing a full set of growth animations or enemies. A shared avatar does not imply one unchanging movement animation throughout the game, and age progression does not require a likeness model per person.

## Validation scenarios

- A new save starts at zero with no memories and only the baby abilities; it can reach its first collectible with touch and with keyboard/mouse.
- An ordered set of synthetic photos advances age and grants only eligible abilities. Same-age photos, duplicate requests, older revisits, and attempts to recover a future stage do not bypass the rules.
- Unlocks persist into later chapters and eras. A new decade does not reset abilities or grant all abilities at the chapter's final age.
- Sparse timelines, missing baby photos, several thresholds crossed at once, and child/single-period endpoints have reachable paths and introductions for every required action.
- Enemies and bosses in different eras have solutions compatible with the same available ability set. A required encounter never gates the memory needed to acquire its only solution.
- Resuming on another device restores age, abilities, memories, and encounters. Failed/retried writes and stale tabs cannot split or duplicate the progression update.
- Birth-date/age-anchor corrections, date edits, rule updates, unavailable photos, and avatar replacement preserve the saved progression under the explicit reconciliation policy.

## Decisions remaining

| ID | Decision | Status |
| --- | --- | --- |
| Q-01 | Require a birth date, or also allow an entered age for the earliest photo? | Asked Tom on 2026-09-10 because ages now unlock abilities. Birth date is recommended; an age-anchor alternative and its precision policy are not yet selected. |
| Q-02 | Which abilities unlock at which ages, and how does progression work within age zero? | Deferred to gameplay design; examples above do not set biological milestones or exact age bands. |
| Q-03 | How are missing infancy and large time jumps introduced? | Short baby opening and guided catch-up are proposed. No fabricated memories or mandatory empty chapters. |
| Q-04 | How does the generic avatar visibly grow? | Deferred to art/controller design; no likeness generation or fixed count of age models is selected. |

This is documentation only. Tool setup, ability implementations, assets, and prototype execution remain deferred until technical and nontechnical requirements are documented.
