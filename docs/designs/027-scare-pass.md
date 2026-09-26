# DESIGN-027: Scary moments

- **Status:** Accepted, September 26, 2026 (owner ruling [PRD-004 Q-08](../prds/004-family-release.md#owner-decisions))
- **Last updated:** 2026-09-26
- **Satisfies:** PRD-004 R-09, R-11
- **Amends:** DESIGN-021/022, which held the Rat Casino to "spooky without gore or jump scares", and DESIGN-026's "kid-safe" limit on era casts

## Overview

Tom: *"Stuff doesn't have to be kid safe. Scary levels can be genuinely scary; my kids love that."*

Chapters can now be genuinely frightening in the Five Nights at Freddy's tradition: darkness, flicker, creeping animatronics, sudden lunges and creepy sound. Horror comes from atmosphere and surprise. There is still **no gore, blood or injury imagery**.

Each chapter declares a scare level. A per-device parent switch can turn scary moments off without touching the published journey.

## Detailed design

**D-01 Scare levels.** A v4 level may declare `scare: 0 | 1 | 2`, frozen into `family-world-plan-v1` chapters. Older documents and plans are level 0.

- **0:** none. Today's behavior.
- **1, spooky:**
  - darker lighting and flickering practical lights;
  - a creepy ambient loop;
  - sleeping animatronics that shift while unwatched (D-04).
- **2, scary:** everything in level 1, plus blackouts (D-03) and jump scares (D-05).

Initial assignment:

| Chapter | Level |
| --- | --- |
| A4 (Rat Casino After Hours) | 2 |
| A3 (Hero City) | 1 (night city, monster boss) |
| B3 (Besties' Big Stage) | 1 (demon idols) |
| All others | 0 |

**D-02 Parent switch.** The family home menu shows a **Scary moments** toggle, described as "Blackouts, jump scares and creepy sounds in spooky chapters." It defaults to **on** and is stored per device. Turning it off plays every chapter at level 0. Admins and family members can both change it.

**D-03 Lighting and blackouts.**
- **Level 1:**
  - ambient and hemisphere light at about 55%;
  - colder, closer fog;
  - practical bulbs and emissive trim flicker in short random dips of 0.1–0.4 s every 3–9 s.
- **Level 2 blackouts:**
  - every 35–60 s the room goes dark for about 1.2 s;
  - only animatronic eyes and the golden-collectible glow stay lit;
  - a light-buzz cue brings the lights back.
- **Blackout safety:** a blackout never starts while the player is airborne, riding a mover or lift, within 2 s of starting a jump/drop/bounce connection, or in the first 10 s after a checkpoint recovery.

**D-04 Watchers.** From level 1, a not-yet-awake ordinary animatronic changes only while it is outside the camera frustum. It can turn to face the player, switch to a different idle pose, or shuffle up to 1.5 m, always inside its own arena and never onto a connection strip. When seen again it is simply standing somewhere slightly different, and a servo-creak cue plays once.

**D-05 Jump scares** (level 2):
- **Trigger:** an animatronic or boss attack reduces the player to 0 HP.
- **The lunge:** the camera snaps to a close shot of that enemy's face for about 0.9 s, with the jump-scare sting and a hard camera shake. Reduced motion turns this into a 0.5 s cut with no shake.
- **Afterwards:** normal recovery to the memory checkpoint.
- **Limits:** at most once per 60 s, and never during a blackout's first 0.3 s.

**D-06 Sound.** New cues from the self-hosted audio service, with the usual catalog steps:

| Cue | Length | Use |
| --- | --- | --- |
| `jump-scare-sting` | about 1.0 s | Jump scares |
| `servo-creak` | about 0.8 s | Watchers |
| `light-buzz` | about 2 s | Blackout return |
| `distant-laugh` | about 1.5 s | Mechanical animatronic laugh, no words; random ambience at level 2 |
| `radio-static` | about 0.8 s | Radio showman attack |
| `casino-hum` | about 8 s loop | Level 1–2 ambience |

The v001 candidates are in the [catalog](../assets/catalog.md#sound-auditions), awaiting Tom's exact-version review. [DESIGN-008](008-audio-pipeline.md#scary-moments-cues) records their processing, manifest and mix.

**D-07 Character direction.** Designs may be genuinely creepy when the era calls for it:
- the radio showman gets a too-wide sharp grin, glowing eyes and static;
- the Rat Casino animatronics get glowing eyes in the dark;
- a later demon-idol revision may be more demonic.

No gore, dismemberment or blood.

**D-08 Versioning.** Scare levels are template content: World A and World B get new template versions, `family-world-a@v4` and `family-world-b@v4` ([Template versions](#template-versions)). Existing publications and saves keep their frozen plans, and Update world carries photos over.

## Runtime

The engine implements D-01 to D-06, and the template versions below implement D-08. New art (D-07) follows separately.

- **Where it lives.** `src/game/scare.ts` holds the timing and placement rules, `src/game/scare-scene.ts` the lighting, eyes and key light, and `createGame` the clocks. The switch is `src/client/scary-moments.ts` (`localStorage` key `quest-scary-moments-v1`, read once per game) with its toggle in the family home and on the fixture playtest's start screen.
- **Level 0 builds nothing.** A chapter without `scare`, with `scare: 0`, or with the switch off creates no scare objects, lights or events. Tests pin the Rat Casino and theme scene fingerprints and a scripted runtime run to their values from before this design.
- **The field.** `scare` exists only on `authored-level-v4` documents. `chapter.scare.set` sets it, and `0` removes it. `inspect` reports it per chapter. It freezes with the chapter's geometry in `family-world-plan-v1` and in editor playtest snapshots.
- **Lighting.** Level 1 scales the hemisphere, sun and environment light to 55%. It moves fog to half its start and 60% of its end distance, and mixes the sky and fog toward cold night. The practical lights are the scenery kit, placed decor and placeholder scenery, meaning their unlit bulbs and emissive trim. A flicker dip drops them to 12% and the scene light to 80%.
- **Blackouts.** Scene light falls to 3%, the environment light goes out, the sky and fog go black and the practicals go dark. Gameplay markers stay visible for fairness: attack warnings, checkpoints, rings and health bars. The animatronics' eyes (small red emissive pairs fitted to each model's face) and the golden glow stay visible too.
  - The 2 s launch guard counts any departure from the ground (a jump, a walk-off drop or a bounce), a superset of starting a connection.
  - "Riding" also covers crumbling platforms.
  - A blackout that falls due waits for safe footing.
  - A recovery or a lunge ends a blackout early, without the light-buzz cue.
- **Watchers.** A watcher is an ordinary enemy that is idle and has not chased the player since it spawned. From level 1 it holds its facing instead of tracking the player. After 1.2–3.5 s out of view it changes once per unseen spell: it turns to the player, rolls into another idle pose, or shuffles. A shuffle ends within 1.5 m of the watcher's spawn, inside its arena, at least 1.6 m from the player, and off every connection strip widened by the 0.42 m body radius. When the watcher is seen again, its creak plays once.
- **Jump scares.** A take-hit that the server answers with 0 HP and the fallen phase within 3 s becomes a lunge at level 2. A key light and the eyes frame the face. The game screen holds the checkpoint return, and keeps the sound unpaused, until the lunge ends.
- **Sound.** [DESIGN-008](008-audio-pipeline.md#scary-moments-wiring) lists the six events and their cues. The radio showman's static and the ambience also need level 1 or 2.
- **Checked so far.** Unit and jsdom tests cover every Validation unit case below. A headless Chromium smoke run of a draft A4 at level 2, standing at the start, reached a blackout after about 190 s of wall time (software rendering runs the scare clock slowly): the practicals went dark, the six eyes and the tokens' golden glow stayed lit, and the page logged no errors. With the switch off, the same draft built no scare runtime. The browser Validation on the D-08 templates is under [Template versions](#template-versions).

## Template versions

`family-world-a@v4` and `family-world-b@v4` are v3 exactly plus the initial assignment in D-01. Each world generator declares a `scare` level per chapter and emits one `chapter.scare.set` after a nonzero chapter's cast:

| Template | Chapter | Level |
| --- | --- | --- |
| `family-world-a@v4` | A1 The Toon Clubhouse, A2 Harbor Rescue | 0 (no field) |
| `family-world-a@v4` | A3 Hero City | 1 |
| `family-world-a@v4` | A4 Rat Casino After Hours | 2 |
| `family-world-b@v4` | B1 The Sing-Along Playroom, B2 The Magic House | 0 (no field) |
| `family-world-b@v4` | B3 Besties' Big Stage | 1 |

- **Nothing else changes.** The catalog (`parody-catalog-v10`), casts, geometry, chapter ids, routes, dates, age bands and copy are v3's. A level-0 chapter is byte for byte v3's, so v4 is offered to exactly v3's children and **Update world** carries every photo from any earlier version.
- **Older versions stay.** v1 to v3 stay registered, replay byte for byte from their own command histories and keep their published fingerprints. A journey on them plays at level 0 until an administrator moves it to v4, publishes and starts fresh.
- **The plan freezes it.** The scare level is part of each chapter's `authoredLevel` in `family-world-plan-v1`, so the geometry fingerprint covers it: dropping or raising it in a stored plan fails validation.
- **Tests.** `tests/levels/family-world-a.test.ts` and `family-world-b.test.ts` check the generators, the frozen v3 files and the one-field difference. `tests/server/family/family-worlds-v4.test.ts` checks the registry, offers, rebasing and an Update world from v3 to v4 with every photo, and the frozen scare levels in the published plan.
- **Browser check.** `tests/e2e/family-world-lockstep.ts` ran the v4 chapters through the fixture editor playtest in lockstep Chromium (software WebGL). It asserts each chapter plays at its declared level and records the scare counters. Brightness is the mean grey level of the screenshot's central 80%, out of 255.
  - **A4 at level 2, complete.** Ages 9 to 11, all five fights and all three memories, with no traversal recovery and no page, console or response error. A forced knockout by the first ordinary (`QUEST_E2E_JUMP_SCARE=ordinary-1`) became the one jump scare: the chick's face in close-up, mid-lunge, then the normal recovery. Two blackouts started on firm footing, 55 s of course time apart. The first dropped brightness from 67.9 in the dark room to 11.7, with the tokens and a pair of eyes still lit. The run also saw 17 flickers, 6 watcher changes and 5 creaks in 119 s of page time.
  - **Watchers.** A watcher probe (`QUEST_E2E_WATCHER_PROBE`) faced the first ordinary from 13.3 m away and looked away for 4.5 s. When it looked back, the chick creaked: it had shuffled 1.42 m, turned and was standing behind the arch's pillar.
  - **A3 and B3 at level 1.** Both load at level 1. In 30 s at spawn A3 flickered 4 times and moved 4 watchers, B3 flickered 4 times, and neither blacked out. Dimming takes the spawn view from 142.0 to 104.2 in A3 and from 156.1 to 126.4 in B3; A4 goes from 97.0 to 67.9 at level 2. With the switch off, all three build no scare runtime.
  - **Found.** The fitted eyes float in front of the face in the close shot ([#118](https://github.com/thaynes43/haynes-quest/issues/118), an art decision under D-07). Separately, and unrelated to the scare levels, the A4 ticket-room arch hides the player from the default camera at the first ordinary fight ([#119](https://github.com/thaynes43/haynes-quest/issues/119)). The screenshots stay outside git.

## Validation

- **Unit tests:**
  - the blackout scheduler never fires in a forbidden state;
  - watcher moves stay out of frustum, inside the arena and off strips;
  - the jump-scare trigger and its cooldown;
  - the parent switch caps the level at 0;
  - scare 0 is byte-identical to today's scene and physics.
- **Browser:** a lockstep run completes A4 at level 2 with blackouts and a forced jump scare, and screenshots show the dark room, a blackout and the lunge. A3 and B3 are checked at level 1.
- **Owner check:** Tom judges the actual scariness with the kids.
