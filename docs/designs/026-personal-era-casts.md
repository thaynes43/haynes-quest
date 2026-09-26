# DESIGN-026: Personal era casts for the family worlds

- **Status:** Accepted. Tom locked the table on September 26, 2026, with World A at four chapters ([PRD-004 Q-05](../prds/004-family-release.md#owner-decisions)). Asset production may start from this table
- **Last updated:** 2026-09-26
- **Satisfies:** PRD-004 R-09, R-10
- **Builds on:** [DESIGN-005](005-era-enemy-catalog.md) (original-art provenance, date eligibility), [DESIGN-012](012-player-journey-curation.md) (child favorites, editable relevance windows), [DESIGN-025](025-growth-moves-and-vertical-courses.md) (themes and moves)

## Overview

Each child's world follows their own age bands and favorite shows, not a generic calendar roster. Tom listed the older child's favorites and asked for correct age associations. For the younger child he kept the Besties and asked for proposals for her earlier years.

Chapters are age bands. Their calendar dates come only from the private birthday at publish time (DESIGN-024 D-03), so this public table names no child and gives no birth date. Every character is an **original parody**: recognizable silhouette cues and humor, but no copied names, logos, likenesses or audio. All content stays kid-safe; a parody of a mature show keeps only its clean visual hook.

## Proposed table

Moves unlock when the chapter's big memory is recovered. They are available from the next chapter on: age 2 high jump, age 4 double jump, age 8 glide. In World A, chapter 2 has the high jump, chapter 3 the double jump and chapter 4 the glide. In World B, chapter 2 has the high jump and chapter 3 the double jump.

### World A (older child, four chapters)

| Ch | Age band | Inspiration (public air dates) | Locked cast (original parodies) | Theme / course idea | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | 0 → 2 | Mickey Mouse Clubhouse (Disney Junior, May 2006 – Nov 2016) | Boss: a bullying cartoon-cat captain with a peg-leg swagger. Ordinaries: runaway gadget helpers ("Toodle"-style floating toolboxes) | Toon clubhouse on a hill, with a tall clubhouse tower and slide | Built: The Toon Clubhouse (`clubhouse`) in `family-world-a@v1`. Boss: catalog `clubhouse-bully-cat@v001`. Gadget helpers: candidate |
| 2 | 2 → 5 | Paw Patrol (Nickelodeon, Aug 2013 –) | Boss: a scheming mustached rival mayor. Ordinaries: his mischievous kitten crew | Seaside rescue town climbing to a lookout tower | Built: Harbor Rescue (`harbor`). Mayor and kittens: candidates |
| 3 | 5 → 9 | One merged cast: Power Rangers (Beast Morphers 2019–20, Dino Fury 2021–22, Cosmic Fury 2023); Spider-Man (Into the Spider-Verse Dec 2018, No Way Home Dec 2021, Across the Spider-Verse Jun 2023, Spidey and His Amazing Friends Aug 2021 –); Phineas and Ferb (2007–15, streaming; revival Jun 2025) | Boss: an evil scientist with a ridiculous "-inator" machine that unleashes a giant rubber-suit monster. Ordinaries: clay "putty" grunts and runaway lab robots. A web-slinging friendly helper where a gap needs one | Rooftop city skyline with water towers, cranes and billboards, and the scientist's tower on top | Built: Hero City (`rooftop`). Grunts, robots and monster: candidates |
| 4 | 9 → 11 | Five Nights at Freddy's (Aug 2014 –; movie Oct 2023) with The Living Tombstone's songs; Hazbin Hotel (pilot Oct 2019; series Jan 2024, season 2 Oct 2025) | The existing Rat Casino cast and Rat Pit Boss. Optional bonus: a dapper radio-host showman parody (clean) | The existing Rat Casino, extended with the new mechanics | Built: Rat Casino After Hours (`casino`). Rat Casino catalog cast; Radio Showman bonus: candidate; Golden: scenic cameo |

World A is assembled as the family template `family-world-a@v1`, "Clubhouse to Casino", by `scripts/levels/build-family-world-a.ts` ([level editor: family worlds](../level-editor.md#family-worlds)). Its chapters climb to 14.8, 13.4, 15.0 and 22.3 m, and the casino finale has the tallest climb and the longest traversal. The web-slinging helper is future vocabulary: no friendly assist mechanic exists yet, so Hero City places the ordinary friendly creatures, one beside the vent bounce. Every Blender model's exact-version review remains open.

The earlier five-chapter proposal split chapter 3 into Power Rangers with T.O.T.S. (ages 5–7) and Spider-Man, Phineas and Ferb and The Thundermans (ages 7–9). Tom chose the merged four-chapter version.

### World B (younger child, three chapters)

| Ch | Age band | Inspiration (public air dates) | Proposed cast (original parodies) | Theme / course idea |
| --- | --- | --- | --- | --- |
| 1 | 0 → 2 | Cocomelon (YouTube; Netflix from Jun 2020) | Boss: a honking big school-bus. Ordinaries: bouncing "yes-yes" vegetables | Toddler playroom and nursery, with block towers (the existing toybox kit fits) |
| 2 | 2 → 4 | Bluey (Disney Junior US from Sep 2019); Encanto (Nov 2021; "We Don't Talk About Bruno" #1 in Feb 2022) | Boss: a magical dancing house with shutters and tiles. Ordinaries: bin-chicken birds | Colorful magical house and garden, with terraces up the casita |
| 3 | 4 → 6 | Wicked (film Nov 2024); KPop Demon Hunters (Jun 2025) | The existing Bickering Besties (approved joint look). Ordinaries: a demon boy-band trio parody | The existing Besties playground with a concert stage |

**World B build status.** All three chapters are built into the registered template `family-world-b@v1`, "Playroom to Big Stage" (PLAN-019; see [Family worlds](../level-editor.md#family-worlds)). The template pins `parody-catalog-v8`. Each chapter has one ordinary identity in all four ordinary slots.

| Ch | Chapter and route | Theme | Cast as built | Status |
| --- | --- | --- | --- | --- |
| 1 | The Sing-Along Playroom, `family-b1-playroom` | `playroom` | Boss: Big Honk Bus, catalog `honk-bus@v001` (landed model). Ordinaries: Yes-Yes Veggie, project candidate | Built; the veggie model is pending |
| 2 | The Magic House, `family-b2-casita` | `casita` | Boss: The Dancing House. Ordinaries: Bin Chicken. Both are project candidates | Built; both models are pending |
| 3 | Besties' Big Stage, `family-b3-stage` | `party` | Boss: Bickering Besties, catalog `bickering-besties@v001`. Ordinaries: Demon Idol, project candidate | Built; the idol model is pending |

Project candidates use neutral placeholder art. A model that lands later joins a new catalog version and a new template version, because published journeys freeze `family-world-b@v1`.

## Eligibility

The new casts go in new frozen parody catalog versions: v7 carries the windows, and v8 onward registers each model as it lands. Each entry records:

- its **debut or source evidence** (the dates above);
- a **parent-locked relevance window**, per DESIGN-012, covering the age band it serves.

The validator checks the rebased chapter start against that window. A window may extend back before a debut only through an explicit parent lock, recorded with its reason, for example when a chapter spans the debut. The Rat Casino entries gain a parent-locked window from 2014-08-18, the franchise debut already recorded as `referenceAvailableBy`, so the older child's final chapter is eligible.

**Implemented foundations.** Frozen `parody-catalog-v7` holds every v6 identity unchanged, except that the six Rat Casino entries' `eligibleFrom` moves from 2024-01-01 to 2014-08-18. Each widened entry records a `relevanceLock` with `lockedBy: "parent"`, its `previousEligibleFrom` and the reason. Catalogs v1–v6 stay frozen, and v7 joins the editor's catalog versions.

Five era periods carry each new chapter's title and story:

| Period | Title | Subtitle |
| --- | --- | --- |
| `toon-clubhouse-v1` | Clubhouse Capers | Runaway gadgets and a very grumpy cat captain |
| `rescue-harbor-v1` | Harbor Rescue | Mischief kittens and a mayor with a plan |
| `hero-city-v1` | Hero City | Putty grunts, runaway robots and a monster-inator |
| `sing-along-playroom-v1` | Sing-Along Playroom | Stubborn veggies and a honking bus |
| `magic-house-v1` | The Magic House | Cheeky bin chickens and a house that won't stop dancing |

Until a cast member's WO111 model lands, it is a project enemy candidate with neutral placeholder art. Each candidate carries its relevance window as data (`eligibility`), and every slot in a chapter shares one period. Candidates can fill:

- the ordinary slots of the new eras;
- the Rat Casino chapter's optional bonus slot, for the radio-host showman;
- the Besties chapter's ordinary slots beside the catalog Besties boss, for the demon boy-band trio.

A chapter with one ordinary identity gives all four ordinary anchors that identity's kind. Editor-world and family plans accept either ordinary kind in each ordinary slot, and the frozen stats follow the actual kind.

**Gameplay-registered models (parody-catalog-v8).** Frozen `parody-catalog-v8` keeps every v7 entry unchanged, including the Rat Casino lock, and adds each family-era Blender model that has merged. These entries are prepared enemies: the editor, editor-world plans and family plans all accept them. Catalogs v1–v7 stay frozen. A world generator assigns an entry by its exact reference, `{ "source": "catalog", "catalogEntryId": "<id>", "catalogEntryVersion": "v001" }`.

| Entry | Name | Role and kind | Period | Window | Model |
| --- | --- | --- | --- | --- | --- |
| `clubhouse-bully-cat@v001` | Captain Bully Cat | boss | `toon-clubhouse-v1` | 2006-05-05 → 2016-11-06 | [v001](../assets/reviews/clubhouse-bully-cat/v001.md): 2.5 m tall, contact at 1.25 s of the 2.0 s attack |
| `honk-bus@v001` | Big Honk Bus | boss | `sing-along-playroom-v1` | 2018-01-01 → 2026-12-31 | [v001](../assets/reviews/honk-bus/v001.md): 2.3 m tall, contact at 1.25 s of the 2.0 s attack |

Each window starts no earlier than the show's public availability, so `referenceAvailableBy` equals `eligibleFrom` and neither entry needs a parent lock. The window is judged at the rebased chapter start. The bully cat can serve a first chapter that starts by November 6, 2016, and the bus one that starts in 2018 or later; a template outside those windows is not offered to that child. The scene loads the exact GLB and places the health bar above its measured height. The strike lands at the logged contact time.

Every other cast member stays a project candidate until its model merges. That includes the gadget helper and the yes-yes veggie, whose concepts are selected. Each later model joins a new frozen catalog version; v8 is never edited. Tom's exact-version review of each model remains pending ([PRD-004 Q-03](../prds/004-family-release.md#owner-decisions)). A rejection returns the slot to a placeholder.

## Production order after the lock

1. Driving Astra records the final roster in DESIGN-005, then generates concepts one at a time: chapter 1 of both worlds, then chapter 2, and so on.
2. Fresh top-tier Blender authors build one character per exclusive scene lease: Astra `max` under the Codex art lead, and Opus 5.5 after Codex's September 26 usage limit, per Tom's ruling. Bosses come first, then one ordinary per chapter; a second ordinary is a stretch goal.
3. Themed prop kits follow each chapter's cast.
4. Every candidate lands in the catalog in the same PR, labeled "awaiting review" (PRD-004 Q-03).
5. Until a model lands, levels use the project's neutral placeholder enemy art, and themes use their procedural fallback.

## Decision record

| ID | Question | Status |
| --- | --- | --- |
| Q-01 | Lock this table, or edit rows? | **Locked** by Tom on September 26. He confirmed the lock a second time after saying he had missed the question. |
| Q-02 | World A: five chapters as proposed, or merge chapters 3 and 4? | **Merged:** World A has four chapters, and chapter 3 covers ages 5–9 with one merged Power Rangers, Spider-Man and Phineas and Ferb cast (Tom, September 26). |
