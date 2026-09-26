# DESIGN-026: Personal era casts for the family worlds

- **Status:** Accepted. Tom locked the table on September 26, 2026, with World A at four chapters ([PRD-004 Q-05](../prds/004-family-release.md#owner-decisions)). Asset production may start from this table
- **Last updated:** 2026-09-25
- **Satisfies:** PRD-004 R-09, R-10
- **Builds on:** [DESIGN-005](005-era-enemy-catalog.md) (original-art provenance, date eligibility), [DESIGN-012](012-player-journey-curation.md) (child favorites, editable relevance windows), [DESIGN-025](025-growth-moves-and-vertical-courses.md) (themes and moves)

## Overview

Each child's world follows their own age bands and favorite shows, not a generic calendar roster. Tom listed the older child's favorites and asked for correct age associations. For the younger child he kept the Besties and asked for proposals for her earlier years.

Chapters are age bands. Their calendar dates come only from the private birthday at publish time (DESIGN-024 D-03), so this public table names no child and gives no birth date. Every character is an **original parody**: recognizable silhouette cues and humor, but no copied names, logos, likenesses or audio. All content stays kid-safe; a parody of a mature show keeps only its clean visual hook.

## Proposed table

Moves unlock when the chapter's big memory is recovered. They are available from the next chapter on: age 2 high jump, age 4 double jump, age 8 glide. In World A, chapter 2 has the high jump, chapter 3 the double jump and chapter 4 the glide. In World B, chapter 2 has the high jump and chapter 3 the double jump.

### World A (older child, four chapters)

| Ch | Age band | Inspiration (public air dates) | Locked cast (original parodies) | Theme / course idea |
| --- | --- | --- | --- | --- |
| 1 | 0 → 2 | Mickey Mouse Clubhouse (Disney Junior, May 2006 – Nov 2016) | Boss: a bullying cartoon-cat captain with a peg-leg swagger. Ordinaries: runaway gadget helpers ("Toodle"-style floating toolboxes) | Toon clubhouse on a hill, with a tall clubhouse tower and slide |
| 2 | 2 → 5 | Paw Patrol (Nickelodeon, Aug 2013 –) | Boss: a scheming mustached rival mayor. Ordinaries: his mischievous kitten crew | Seaside rescue town climbing to a lookout tower |
| 3 | 5 → 9 | One merged cast: Power Rangers (Beast Morphers 2019–20, Dino Fury 2021–22, Cosmic Fury 2023); Spider-Man (Into the Spider-Verse Dec 2018, No Way Home Dec 2021, Across the Spider-Verse Jun 2023, Spidey and His Amazing Friends Aug 2021 –); Phineas and Ferb (2007–15, streaming; revival Jun 2025) | Boss: an evil scientist with a ridiculous "-inator" machine that unleashes a giant rubber-suit monster. Ordinaries: clay "putty" grunts and runaway lab robots. A web-slinging friendly helper where a gap needs one | Rooftop city skyline with water towers, cranes and billboards, and the scientist's tower on top |
| 4 | 9 → 11 | Five Nights at Freddy's (Aug 2014 –; movie Oct 2023) with The Living Tombstone's songs; Hazbin Hotel (pilot Oct 2019; series Jan 2024, season 2 Oct 2025) | The existing Rat Casino cast and Rat Pit Boss. Optional bonus: a dapper radio-host showman parody (clean) | The existing Rat Casino, extended with the new mechanics |

The earlier five-chapter proposal split chapter 3 into Power Rangers with T.O.T.S. (ages 5–7) and Spider-Man, Phineas and Ferb and The Thundermans (ages 7–9). Tom chose the merged four-chapter version.

### World B (younger child, three chapters)

| Ch | Age band | Inspiration (public air dates) | Proposed cast (original parodies) | Theme / course idea |
| --- | --- | --- | --- | --- |
| 1 | 0 → 2 | Cocomelon (YouTube; Netflix from Jun 2020) | Boss: a honking big school-bus. Ordinaries: bouncing "yes-yes" vegetables | Toddler playroom and nursery, with block towers (the existing toybox kit fits) |
| 2 | 2 → 4 | Bluey (Disney Junior US from Sep 2019); Encanto (Nov 2021; "We Don't Talk About Bruno" #1 in Feb 2022) | Boss: a magical dancing house with shutters and tiles. Ordinaries: bin-chicken birds | Colorful magical house and garden, with terraces up the casita |
| 3 | 4 → 6 | Wicked (film Nov 2024); KPop Demon Hunters (Jun 2025) | The existing Bickering Besties (approved joint look). Ordinaries: a demon boy-band trio parody | The existing Besties playground with a concert stage |

## Eligibility

The new casts go in a new frozen parody catalog version (v7). Each entry records:

- its **debut or source evidence** (the dates above);
- a **parent-locked relevance window**, per DESIGN-012, covering the age band it serves.

The validator checks the rebased chapter start against that window. A window may extend back before a debut only through an explicit parent lock, recorded with its reason, for example when a chapter spans the debut. The Rat Casino entries gain a parent-locked window from 2014-08-18, the franchise debut already recorded as `referenceAvailableBy`, so the older child's fifth chapter is eligible.

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
