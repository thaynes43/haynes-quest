# DESIGN-005: Era-based enemies and bosses

- **Status:** Current two-period combat implemented for review; broader catalog proposed
- **Last updated:** 2026-09-11
- **Source:** Tom's era-based pop-culture enemy and boss brief
- **Satisfies:** [PRD-001 R-20–R-34](../prds/001-project-brief.md)
- **Related:** [Memory journey](004-memory-journey.md), [saved games](001-technical-foundation.md), [asset authoring](002-asset-pipeline.md), [memory-age abilities](006-memory-age-and-abilities.md)

## Owner correction: recognizable parody

Tom clarified on September 11 that the enemies must be **recognizable, funny pop-culture parodies** from the periods represented by the photos, like the playful use of recognizable references he sees in Roblox. His South Park comparison describes the freedom and recognizability of parody; it does not request adult humor. The intended family game uses playful exaggeration and slapstick.

The friendly cast—Blockling, Signal Moth, Buffer Baron, Loop Dancer, Prism Mimic and Trendweaver—offers optional healing and recoverable consequences for harm under [DESIGN013](013-friendly-characters.md). Their masters, source concepts and animated previews belong in the friendly category. Enemy selection uses the separately curated parody roster.

[DESIGN-010](010-era-combat-loop.md) retains the correct gameplay order: useful equipment, period enemies, boss victory, released memory bundle, consumption, age advancement and the next period. The replacement roster must name the specific cultural reference and supported dates, explain the recognizable visual joke and express it in the encounter behavior before modeling starts. Broad labels such as livestreaming or remix culture are insufficient.

Photo capture metadata establishes the represented calendar period. The person's birthday establishes their age at capture and the age brackets through which the journey progresses. A birthday does not by itself identify pop culture; an upload timestamp does not date the photographed memory. Selection must use those facts together and preserve them with the saved journey.

The current 2020/2024 fictional fixture is a test library, not the only supported date rule. Root is auditing the actual date/age/selection contract before replacing the cast. A year threshold that sends every later photograph to the same generic trio is not a finished era catalog.

## Player experience

The player recovers memories while encountering enemies and bosses inspired by the culture of the years those memories represent. Someone whose baby photos are from the 1990s begins with that period's influences; a childhood in a later decade draws from a different set. As the journey reaches later photos, its enemy cast changes with the calendar era. The game ends at the latest available memories, which need not be the present day.

Tom cited Ninja Turtles and Power Rangers as examples of the kind of nostalgic association he means. The intended enemies are authored parodies whose specific pop-culture references are recognizable in their appearance and behavior. Television, animation, games, and historically relevant YouTube or other internet culture can inform the authored catalog. Specific references, enemies, and boss designs will be selected later.

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

## Parody and reference handling

Each enemy brief names its target reference and the joke: what is being exaggerated, how a player will recognize it, and how that exaggeration changes the fight. The model should retain enough recognizable visual language for the reference to read without an explanatory caption. Inventing a generic creature and attaching a cultural label afterward fails this requirement.

Author the game models, animation, effects and sound deliberately; preserve the concept references and production provenance. A coherent world palette may unify rendering without turning every reference into the same wooden woodland creature. Do not substitute a blanket rule against recognizable franchise parody for Tom's direction, and do not represent the comparison to another game or show as a legal clearance determination.

## Validation scenarios

- Two subjects pictured at the same age in different decades receive different era-eligible pools. Era eligibility remains consistent even when the subjects' ages differ, while encounter solutions respect their current abilities.
- A journey starting in the 1990s and continuing into later eras changes its eligible cast chronologically, with no later-created influence appearing early. Use fictional dated catalog fixtures until historical entries are researched.
- Test mid-decade debuts, revival windows, a chapter crossing decades, an old photo imported recently, and a library ending before the present day.
- Different manually entered settings can vary selection within an era without excluding the mixed catalog or changing difficulty. Unknown settings have a supported path, with no image-based gender inference.
- An age-zero ability set can reach its first memory; required later encounters have solutions using the abilities already unlocked. Test an apparent ability/obstacle dependency cycle and a child journey without adult abilities.
- Ordinary enemies and bosses obey the same date rules. Missing coverage uses the designed fallback or clear setup state without removing memories or making up a reference.
- Save/resume, another device, updated preferences, and catalog releases preserve the chosen encounter identities and photo/boss progress. Withdrawn assets do not bypass their availability checks.
- Each authored entry has period evidence, parody design/provenance records, prepared asset versions, and the asset validation required by DESIGN-002. Runtime play needs no trend feed, reference-media download, or generation job.

## Decisions remaining

| ID | Decision | Status |
| --- | --- | --- |
| Q-01 | Which references and original enemies/bosses cover the initial eras? | Active correction: use dated, recognizable parody briefs for each new enemy. |
| Q-02 | How should gender/interests influence selection, and which setup fields are required? | Manual entry for the journey subject is the direction; exact UI, weighting, and overrides remain proposed. |
| Q-03 | How do decade/proportional chapters transition between enemy eras? | Calendar-period matching is required; exact chapter grouping and encounter transitions remain for level design. |
| Q-04 | How do enemy encounters and bosses work? | Owner-confirmed equipment → combat → boss → memories → age/period loop. DESIGN-010 implements provisional health, guard, attack, defeat/retry and one boss after two ordinary encounters per current level. Final balance remains open. |

The current combat implementation and unfinished required assets belong to PLAN-005. [BL-02](../BACKLOG.md#bl-02-combat-bosses-and-encounter-content) covers broader roster production and final balance after the corrected slice; it does not defer the boss or equipment needed by the current coming-of-age arc.

## Ratified replacement slice and frozen selection

### Haynesnightmares studio cast and gameplay gate · September 23, 2026

Tom selected a full original FNAF-esque animatronic parody cast with Rat Casino and Halloween Haynesnightmares themes, with Blender models before new levels. The [v003 six-character concept](../assets/reviews/rat-casino-ensemble/v003.md) carries his central-rat/side-Chick-flia hierarchy and classic original-era mood after he rejected the [v002 glam-rock treatment](../assets/reviews/rat-casino-ensemble/v002.md). [Completed PLAN015](../../.agents/plans/completed/015-haynesnightmares-asset-first.md) and its [release record](../../.agents/evidence/classic-cast-release.json) document six separate Blender candidates published in the private studio; no member has a runtime encounter ID yet. The retro casino setting is an art choice, not evidence that the parody belongs in a 1990s photo period. The [original game's publisher listing](https://store.steampowered.com/app/319510/Five_Nights_at_Freddys/) dates the first Five Nights at Freddy's release to August 18, 2014. Treat that as the earliest possible source date for the broad reference; any later-specific character influence needs its own source and curated window. An eventual local period override must retain its explicit reason and all asset/progression gates. No proposed encounter enters a saved journey until its behavior is ability-safe and its exact model version has Tom's review.

The lead's replacement candidates below name concrete recognizable references. These are production briefs, not owner approvals. [WO-022](../../.agents/work-orders/022-parody-period-evidence.md) records primary historical sources. The initial catalog supports bounded 2020–2023 and 2024–2026 curation windows; those are authored coverage choices, not claims that a reference debuted or peaked at either boundary. References are available before every supported day. Broader coverage must be curated explicitly; unknown dates cannot silently borrow a modern cast.

| Candidate | Recognizable target and joke | Readable encounter |
| --- | --- | --- |
| Mister Hiss | Minecraft Creeper as an overconfident paper party popper; cuboid head, tall armless body, four feet and pixel face | Puff-up, short confetti sneeze, dizzy recovery; sidestep without jumping |
| Peel Patrol | Fortnite Peely as a self-important banana patrol officer; banana head/peel, oval dark eyes and skinny limbs | Points sternly, slips into a clumsy lunge, regains balance |
| The Drama Dragon | Minecraft Ender Dragon as a crown-wearing tantrum thrower; black voxel dragon, purple eyes, broad angular wings and long tail | Obvious wing-raise before an oversized landing stomp; lengthy sulking recovery |
| Sir Flush-a-Lot | Skibidi Toilet as an operatic toilet-head show-off; porcelain bowl, human head emerging from it and exaggerated grin | Leans back theatrically, splutters a short bubble burst, ducks into the bowl |
| Nap Captain | CatNap / Smiling Critters as an overenthusiastic naptime monitor; purple plush cat, crescent pendant, long limbs and broad grin | Squashes into a sleepy crouch, pillow-like pounce, sits down yawning; playful rather than frightening |
| The One-Star Diva | Dress to Impress voting and runway behavior exaggerated into a fussy fashion boss; Roblox-style fashion proportions, enormous outfit and one-star paddle | Prolonged runway pose, big sweeping twirl, trips over her own pose and fusses with the outfit |

Different materials preserve each reference: paper/voxel, banana, dark angular dragon, porcelain, plush and fashion cloth. A common lighting/rendering treatment unifies the world; the palette must not erase their recognizable identities. The first concept is [Mister Hiss](../assets/reviews/mister-hiss/v001.md). The remaining briefs require their own serial lead concepts before Blender production.

### Plan v2 contract

New saves use `era-level-plan-v2` and pin `parody-catalog-v2`. The bounded two-chapter playtest uses completed Mister Hiss, Peel Patrol and Drama Dragon first, then Sir Flush-a-Lot and returning Peel Patrol/Drama Dragon. The original `parody-catalog-v1` remains an immutable registry for existing saves, including its paused candidates. Validate each saved plan against its own catalog; do not substitute the current cast when resuming an old journey.

Each level freezes its exact `startDate`, derived year, period/environment ID, `gentle-intro-v1` or `gentle-jump-v1` route ID, and selected encounter content identities (catalog entry/version and asset ID/version). Select by exact date window and available starting abilities; then deterministic kind/role coverage. No client `>=2024` decision can choose enemy identity. Required ordinary-a, ordinary-b and boss coverage must all exist before creating the journey. Missing coverage yields `ERA_CATALOG_UNAVAILABLE`, without allocating a partial save or selecting a later reference.

Preserve `era-level-plan-v1` and `era-combat-state-v2` records. Existing state shape, age-zero no-jump and age-four jump rules stay unchanged. No in-place historical plan rewrite or invented asset selection occurs. New content fields are required only by the new strict plan schema and are exposed in save views. Resolve new UI titles and models from the frozen identity, with recoverable missing assets; keep old technical prototypes readable. Pin source selections rather than rerolling against the newest catalog on resume.

The birthday is the explicit age source. This change retains the currently versioned gameplay date already frozen by the adapter; source-local timestamp/precision mapping remains a separate required decision before real Immich admission. An obby fall is local recovery and must not call the combat `retry-level` action. Session checkpoints remain local; persisted resume uses safe progression-derived positions until a durable checkpoint version is explicitly introduced.
