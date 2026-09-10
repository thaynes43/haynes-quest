# DESIGN-005: Era-based enemies and bosses

- **Status:** Proposed
- **Last updated:** 2026-09-10
- **Source:** Tom's era-based pop-culture enemy and boss brief
- **Satisfies:** [PRD-001 R-20–R-34](../prds/001-project-brief.md)
- **Related:** [Memory journey](004-memory-journey.md), [saved games](001-technical-foundation.md), [asset authoring](002-asset-pipeline.md), [memory-age abilities](006-memory-age-and-abilities.md)

## Player experience

The player recovers memories while encountering enemies and bosses inspired by the culture of the years those memories represent. Someone whose baby photos are from the 1990s begins with that period's influences; a childhood in a later decade draws from a different set. As the journey reaches later photos, its enemy cast changes with the calendar era. The game ends at the latest available memories, which need not be the present day.

Tom cited Ninja Turtles and Power Rangers as examples of the kind of nostalgic association he means. The intended assets are original Haynes Quest characters inspired by broad period influences, rather than imported franchise characters. Television, animation, games, and historically relevant YouTube or other internet culture can inform the authored catalog. Specific references, enemies, and boss designs will be selected later.

The catalog is a finite, static collection of prepared characters and behaviors. The game dynamically selects and arranges entries using the journey's dates and setup choices. It does not scrape trends, contact YouTube, or generate a new enemy model during play. This keeps era coverage and asset quality reviewable before release while allowing different people to experience different journeys.

## Dates, age, and preferences

| Input | What it controls |
| --- | --- |
| Actual calendar dates of chapter memories | Which era influences and catalog entries are eligible. The source photograph's date matters, not when it was uploaded. |
| Supported age source and recovered memories | Character age and unlocked abilities under DESIGN-006, plus age labels and pacing under DESIGN-004. Encounter solutions must fit those abilities; age alone does not identify a cultural era. |
| The selected subject's explicitly entered gender and any chosen interests | Personalization within the era-eligible pool. Exact options and selection weights remain for setup design. These fields do not establish difficulty or what the subject actually watched. |
| Player challenge settings and chapter progression | Challenge tuning within the currently available ability set. Gender and subject age do not establish human player skill; memory age does determine character capabilities. |

New-game setup supports explicitly entering the selected subject's gender. Do not infer it from photographs, names, appearance, or the generic avatar. Tom supplied manual entry as an available path; the input controls, whether a response is required, and any preference override remain for setup design. A mixed catalog and a supported path for unknown information prevent a missing setting from creating an empty enemy pool.

Curate variety intended to appeal across genders. Gender can inform a proposed preference preset without defining exclusive rosters or asserting that everyone of a gender likes the same shows. Explicit interests or a player override are proposed refinements, not confirmed extra setup requirements. Era eligibility always applies before preference selection; an interest cannot introduce a reference before its time.

## Catalog and selection contract

The fields below are a proposed implementation contract. The final schema and content inventory will follow gameplay design.

| ID | Record or rule | Proposed contract |
| --- | --- | --- |
| D-01 | Catalog identity | Stable catalog, enemy, and boss IDs with versioned definitions and asset references. A display name or current GLB URL is not the identity saved in a journey. |
| D-02 | Era eligibility | Each entry has curated supported date windows and provenance for the period influence. Record earliest eligibility separately from later popularity or revivals. A broad decade label alone cannot place a late-decade influence into an earlier year. |
| D-03 | Cultural references | Record reference titles/links, medium, and the historical window being evoked. Verify period claims when curating each entry. A show's debut is not proof of its peak popularity, and an old clip uploaded later is not proof of an earlier YouTube trend. |
| D-04 | Encounter role and behavior | Identify ordinary-enemy and boss roles, gameplay behaviors, animation requirements, and difficulty parameters separately from visual/theme tags. Both enemies and bosses must satisfy the same era constraints and offer solutions compatible with the abilities available at that point. Boss counts, placement, and victory conditions are undecided. |
| D-05 | Original authored assets | Use the imagegen → Blender → validated GLB workflow in DESIGN-002. Keep original design briefs and provenance with each entry; reference links do not grant asset rights. Runtime images, audio, and models are authored or appropriately licensed game content. |
| D-06 | Selection order | Select eligible entries by represented calendar period first, then choose encounter variants/solutions compatible with unlocked abilities and apply the agreed preference and variety rules. A later-era entry never becomes a fallback for an earlier period merely because it matches a preference. |
| D-07 | Chapters crossing eras | Align encounter selections with the dated memories or subperiod they accompany. A chapter spanning a boundary can change its cast as its timeline advances; alternatively, the grouping design can split it. Do not expose a modern pool throughout an earlier chapter just because its final photos are newer. Exact transitions remain a level-design choice. |
| D-08 | Missing catalog coverage | Preserve the photo timeline. Use an explicitly authored, period-neutral fallback suitable for ordinary/boss roles and the current ability set, or show an actionable content-availability state before play. Do not skip someone's memories, fabricate a historical reference, or silently select an incompatible era. The fallback roster and UI remain to be designed. |
| D-09 | Stable saved encounters | Retain the selected catalog version, enemy/boss identities, personalization settings, and encounter progress with the journey. Catalog additions, renames, avatar replacement, or profile edits must not reroll an active save or reset photo/boss progress. Store an encounter plan or a seed with pinned selection rules; exact representation remains open. |
| D-10 | Catalog updates | New games may use new catalog versions. Existing journeys keep their selections unless an explicit compatible migration is required. An unavailable/withdrawn asset needs a safe replacement or recoverable state while preserving progress; version pinning is not a reason to keep serving withdrawn content. |
| D-11 | Ability-compatible encounters | Record required actions or valid solution paths for encounters. The age-zero opening and all later required enemies/bosses must be solvable using already-unlocked abilities. No encounter can require the ability obtained only from the memory it blocks. A child journey must finish with its own reachable abilities. |

The final content plan must bound how many assets are loaded at once and reuse prepared behaviors where useful. A static catalog does not imply loading every decade's models or running every enemy at the same time. Difficulty, combat/evasion, checkpoints, respawn, boss rewards, and whether bosses gate chapters still need functional requirements.

## Originality and reference handling

Use references to identify broad ideas—team action, transformation spectacles, collectible creatures, toy adventures, internet absurdity—and develop original names, silhouettes, costumes, personalities, effects, and sound. The asset brief should describe the intended era feeling and the game's own design. A renamed or recolored recognizable franchise character is not the authoring target.

The U.S. Copyright Office distinguishes ideas from their protected expression and notes that adaptations can fall within a copyright owner's rights. Consequently, “loosely based on” is not a guarantee that a finished design is cleared. This is an original-art production rule, not a legal determination about an unmade asset. See the [Copyright Office protection FAQ](https://www.copyright.gov/help/faq/faq-protect.html) and [derivative-work guidance](https://www.copyright.gov/eco/help-limitation.html), reviewed 2026-09-10. DESIGN-002 applies the rule during authoring and records source/licensing provenance.

## Validation scenarios

- Two subjects pictured at the same age in different decades receive different era-eligible pools. Era eligibility remains consistent even when the subjects' ages differ, while encounter solutions respect their current abilities.
- A journey starting in the 1990s and continuing into later eras changes its eligible cast chronologically, with no later-created influence appearing early. Use fictional dated catalog fixtures until historical entries are researched.
- Test mid-decade debuts, revival windows, a chapter crossing decades, an old photo imported recently, and a library ending before the present day.
- Different manually entered settings can vary selection within an era without excluding the mixed catalog or changing difficulty. Unknown settings have a supported path, with no image-based gender inference.
- An age-zero ability set can reach its first memory; required later encounters have solutions using the abilities already unlocked. Test an apparent ability/obstacle dependency cycle and a child journey without adult abilities.
- Ordinary enemies and bosses obey the same date rules. Missing coverage uses the designed fallback or clear setup state without removing memories or making up a reference.
- Save/resume, another device, updated preferences, and catalog releases preserve the chosen encounter identities and photo/boss progress. Withdrawn assets do not bypass their availability checks.
- Each authored entry has period evidence, original design/provenance records, prepared asset versions, and the asset validation required by DESIGN-002. Runtime play needs no trend feed, reference-media download, or generation job.

## Decisions remaining

| ID | Decision | Status |
| --- | --- | --- |
| Q-01 | Which references and original enemies/bosses cover the initial eras? | Deferred to content curation after the remaining requirements; no historical roster has been selected or verified. |
| Q-02 | How should gender/interests influence selection, and which setup fields are required? | Manual entry for the journey subject is the direction; exact UI, weighting, and overrides remain proposed. |
| Q-03 | How do decade/proportional chapters transition between enemy eras? | Calendar-period matching is required; exact chapter grouping and encounter transitions remain for level design. |
| Q-04 | How do enemy encounters and bosses work? | Deferred; no combat mechanics, boss-per-level quota, or difficulty curve is selected. |

This design is documentation only. Tool setup, asset production, catalog implementation, and gameplay prototypes remain deferred until the technical and nontechnical requirements phase is complete.
