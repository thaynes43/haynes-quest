# DDD-001: Ubiquitous language

- **Status:** Draft
- **Last updated:** 2026-09-10

These terms describe the initial brief. Add specific gameplay terms when the game design establishes them.

| ID | Term | Meaning |
| --- | --- | --- |
| T-01 | Player | A person playing the game; initially one of Tom's kids. |
| T-02 | Source photo | A photo obtained from a configured photo connection with usable date metadata where available, supplying memories for a selected journey. |
| T-03 | Collectible | An in-game item the player can collect. Real photos represent recoverable memories; their presentation and exact collection rules remain for design. |
| T-04 | Immich | The first supported self-hosted photo service, providing people records and source photos through a configured URL and API key. |
| T-05 | On-screen controls | Touch-operated gameplay controls displayed on the screen for touchscreen play. Their layout and actions will follow the gameplay design. |
| T-06 | Authentik | The existing identity provider used by Haynes Network and the sole sign-in provider selected for Haynes Quest. Successful sign-in identifies a person; the game's admission policy determines whether that person may play. |
| T-07 | Playable character | The shared generic, mysterious avatar who begins a journey at memory age zero, without memories and with baby abilities. Its artwork and identity are independent of the signed-in player and selected photo-library person; no likeness model is required. |
| T-08 | Saved game | One player's resumable game, retaining the selected subject, journey definition, chapter, memory age, unlocked abilities, collected-memory progress, and selected enemy/boss encounters. A player may have multiple saved games. |
| T-09 | Character asset | The model, rig, materials, and animation clips used to display a playable character. The shared avatar asset has its own version; replacement preserves subject identity and saved journeys. |
| T-10 | Photo connection | A user's configured service type, base URL, and protected credential reference used by the server to access a photo library. Account-private ownership is the proposed default. |
| T-11 | Configured person | A person selected by name in a photo connection and resolved to a stable upstream person ID within that connection. The same name can refer to different people or libraries. A configured person can be selected as a journey subject. |
| T-12 | Generation job | Conditional future concept under [BL-01](../BACKLOG.md), not a PoC data object: a persisted background operation producing a validated character asset from a person's photos, with progress and recoverable failure. |
| T-13 | Journey subject | The selected configured person whose photos supply a memory journey. This need not be the player and does not select an avatar model. |
| T-14 | Memory | A recoverable collectible with a stable game-owned identity linked to an authorized source photo in a journey. It does not imply a complete biography or an inferred life event. |
| T-15 | Chapter | A chronological part of a journey covering a represented period. Proposed as one playable level; decade-like or proportional grouping and completion rules remain for design. Photo coverage and any known birth information inform its labels. |
| T-16 | Memory journey | The ordered chapters and memories for one selected subject. A saved game retains its journey definition and progress. |
| T-17 | Photo coverage | The earliest-to-latest usable dated photos available for a subject, distinct from birth, current age, or a complete lifespan. |
| T-18 | Enemy theme | A set of authored enemy appearances and behaviors associated with period influences. Calendar dates determine eligibility; explicit subject settings can inform selection within that pool. Theme and difficulty remain separate. |
| T-19 | Difficulty | Gameplay challenge settings such as enemy speed, aggression, and action complexity. Subject age and gender do not establish human player skill. Encounter solutions must still respect the character abilities unlocked by memory age. Exact settings and progression remain for design. |
| T-20 | Cultural era | The historical calendar period whose influences inform a set of enemies and bosses. It is distinct from the subject's age; eligibility can be narrower than a decade. |
| T-21 | Enemy catalog | The finite, authored and versioned collection of prepared ordinary enemies and bosses, with historical eligibility, behavior, asset, and provenance metadata. Runtime selection uses this catalog. |
| T-22 | Boss | An enemy assigned a major encounter role in the catalog. Its era must match the memories it accompanies; counts, combat rules, rewards, and chapter-gating behavior remain open. |
| T-23 | Encounter plan | Proposed saved selections and progress for enemies and bosses in a journey, retaining catalog/rule versions so updates do not silently change an existing adventure. |
| T-24 | Memory age | The age recovered by the avatar through valid chronological memories. It starts at zero and advances according to the subject's age in the collected photos; it is distinct from calendar year, elapsed play time, and the human player's age. |
| T-25 | Ability | A stable game-defined action or capability unlocked by memory-age progression. Earlier abilities carry into later periods; exact actions and thresholds remain for design. |
| T-26 | Age source | Explicit birth information or another accepted age anchor that maps dated photos to the subject's age. Its revision is retained with a journey; the supported setup policy is pending in DESIGN-006. |
| T-27 | Progression rule set | Versioned rules connecting ordered memory recovery, age thresholds, ability prerequisites, and unlocks. Saved journeys retain the rules needed to reproduce their progression. |

Immich's photo records and the game's collection state are separate concepts. This distinction does not choose a persistence model or require copying full photo originals.
