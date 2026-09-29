# DESIGN-027: Scary moments

- **Status:** Accepted, September 26, 2026 (owner ruling [PRD-004 Q-08](../prds/004-family-release.md#owner-decisions))
- **Last updated:** 2026-09-26 (review fixes: watcher view, blackout safety, level 2 darkness)
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
- **Level 2 darkness** (amended September 26):
  - ambient and hemisphere light at about 38%, darker than level 1;
  - fog colder and closer again;
  - practical lights browned out to about 60% between dips;
  - every animatronic's eyes glow faintly red, and flare in flickers and blackouts.
- **Level 2 blackouts:**
  - every 35–60 s the room goes dark for about 1.2 s;
  - only animatronic eyes and the golden-collectible glow stay lit;
  - a light-buzz cue brings the lights back.
- **Blackout safety:** a blackout never starts:
  - while the player is airborne or riding a mover or lift;
  - within 2 s of starting a jump/drop/bounce connection, or within 1 s of landing (amended September 26: a long glide outlasts the 2 s);
  - within about 4 m of a sweeper's reach or a moving platform's travel, at a similar height (amended September 26: a blackout there hides the thing that knocks the player back);
  - in the first 10 s after a checkpoint recovery.

**D-04 Watchers.** From level 1, a not-yet-awake ordinary animatronic changes only while it is outside the camera frustum, and never moves to a spot the camera could see. It can turn to face the player, switch to a different idle pose, or shuffle up to 1.5 m, always inside its own arena and never onto a connection strip. When the player sees it again, it is simply standing somewhere slightly different, and a servo-creak cue plays once. "Sees" means on screen, within about 20 m and not hidden behind scenery (amended September 26).

**D-05 Jump scares** (level 2):
- **Trigger:** an animatronic or boss attack reduces the player to 0 HP.
- **Scripted set pieces (Tom's September 26 ruling on [#123](https://github.com/thaynes43/haynes-quest/issues/123)):** A4 adds 2–3 one-time lunges at authored spots in template v5 or later. The player must stand within the spot's radius at the same floor height, with the same safe-footing rules as a blackout: no airborne or riding state, recent jump/drop/bounce, recent landing, nearby sweeper or mover, or recent recovery. An unsafe arrival waits until the player is safe while still in the spot. A scripted lunge briefly holds gameplay, then resumes at the same spot without damage or checkpoint recovery. Knockout jump scares remain.
- **The lunge:** the camera snaps to a close shot of that enemy's face for about 0.9 s, with the jump-scare sting and a hard camera shake. Reduced motion turns this into a 0.5 s cut with no shake.
- **The look** (amended September 26):
  - the room drops almost black;
  - a cold light from below catches the face; fitted glow eyes stay hidden in the close shot so they cannot float in front of the model's real eyes;
  - the HUD, touch controls and prompts vanish behind a dark red vignette;
  - with full motion, a red flash opens the lunge.
- **Afterwards:** a knockout follows normal recovery to the memory checkpoint; a scripted set piece resumes play in place.
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
- **Scripted spot data.** A level-2 v4 document may optionally declare `scriptedScares` with up to three `{ id, encounterSlot, position, radius }` entries. The centre is a player-feet position on a static platform, the radius is 0.75–2 m, and the slot identifies the placed encounter whose face appears in the lunge. IDs must be unique. Earlier documents have no field and keep their frozen bytes and behavior. A4's new spots belong in `family-world-a@v5+`; v4 stays immutable.
- **Lighting.**
  - Level 1 scales the hemisphere, sun and environment light to 55%. It moves fog to half its start and 60% of its end distance, and mixes the sky and fog toward cold night.
  - Level 2 scales them to 38%, moves fog to 35% of its start and half its end distance, mixes the sky and fog 82% toward cold night (versus 62% at level 1), and holds the practical lights at 60%. Scenery that loads later joins the dimmed practicals within a second.
  - The practical lights are the scenery kit, placed decor and placeholder scenery, meaning their unlit bulbs and emissive trim. A flicker dip drops them to 12% of their level's value and the scene light to 80%.
  - At level 2 the eyes glow at 45% with a faint halo between scares, and at full strength in a dip or blackout. The fitted eyes hide during a lunge; the key light reveals the model's own face instead. This resolves the floating-eye close-up in [#118](https://github.com/thaynes43/haynes-quest/issues/118) without changing the blackout treatment.
- **Blackouts.** Scene light falls to 3%, the environment light goes out, the sky and fog go black and the practicals go dark. Gameplay markers stay visible for fairness: attack warnings, checkpoints, rings and health bars. The animatronics' eyes (small red emissive pairs fitted to each model's face) and the golden glow stay visible too.
  - The 2 s launch guard counts any departure from the ground (a jump, a walk-off drop or a bounce), a superset of starting a connection.
  - The 1 s landing guard counts from the last frame the player was airborne or riding.
  - The hazard guard covers each sweeper's whole reach (a turning bar's full circle) and each moving platform's or lift's whole travel, grown by 4 m sideways and 2.5 m up and down. The 4 m is about the ground a full-speed run covers in one blackout. Crumbling platforms and bounce pads hold still until touched, so only riding them counts. In A4 the guard covers about a fifth of the standing room.
  - "Riding" also covers crumbling platforms.
  - A blackout that falls due waits for safe footing.
  - A recovery or a lunge ends a blackout early, without the light-buzz cue.
- **Watchers.** A watcher is an ordinary enemy that is idle and has not chased the player since it spawned. From level 1 it holds its facing instead of tracking the player. After 1.2–3.5 s out of view it changes once per unseen spell: it turns to the player, rolls into another idle pose, or shuffles.
  - **Placement.** A shuffle ends within 1.5 m of the watcher's spawn, inside its arena, at least 1.6 m from the player, and off every connection strip widened by the 0.42 m body radius.
  - **Out of view.** The view test uses the watcher's own body: the loaded model measured by the scene, or before it loads a cylinder from its catalog height (radius the larger of 0.6 m and 45% of the height, plus 0.3 m of headroom for the health bar). Every test adds a 0.5 m margin, for an idle pose's lean and a frame of camera motion. A watcher changes only while that padded body is out of the frustum, and a shuffle tries only spots where it would still be out of it.
  - **Creak.** A changed watcher creaks once when the player really sees it. At least one of its knees, chest or head must be on screen within 20 m of the camera, with no course, scenery or decor between them. The game checks about ten times a second while it is in the frustum. A watcher that is in the frustum but hidden cannot change, and its creak waits.
- **Jump scares.** A take-hit that the server answers with 0 HP and the fallen phase within 3 s becomes a lunge at level 2. A scripted spot starts the same lunge only while the player is safely standing inside its radius. Both use the same 60 s cooldown, blackout-start guard, reduced-motion duration, sound and visuals. Each scripted spot fires at most once while that chapter is loaded, including retries within the loaded game. Refreshing the page creates a new runtime and can replay the spot.
  - The room falls to 90% of a blackout's darkness. A cold key light sits below the face, between it and the camera; fitted glow eyes stay hidden in the close shot.
  - The game screen hides everything marked as game UI while the lunge plays and darkens its edges.
  - A knockout holds the checkpoint return; a scripted lunge holds gameplay and input. The sting keeps playing until the lunge ends.
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
  - the blackout scheduler never fires in a forbidden state, including within 1 s of landing A4's long glides and beside its sweepers and movers;
  - watcher moves stay out of frustum, where the watcher stands and where it lands, inside the arena and off strips;
  - a changed watcher creaks only once it is really seen;
  - the jump-scare trigger and its cooldown;
  - the parent switch caps the level at 0;
  - scare 0 is byte-identical to today's scene and physics.
- **Browser:** a lockstep run completes A4 at level 2 with blackouts and a forced jump scare, and screenshots show the dark room, a blackout and the lunge. A3 and B3 are checked at level 1.
- **Owner check:** Tom judges the actual scariness with the kids.
