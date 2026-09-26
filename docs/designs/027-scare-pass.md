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

**D-07 Character direction.** Designs may be genuinely creepy when the era calls for it:
- the radio showman gets a too-wide sharp grin, glowing eyes and static;
- the Rat Casino animatronics get glowing eyes in the dark;
- a later demon-idol revision may be more demonic.

No gore, dismemberment or blood.

**D-08 Versioning.** Scare levels are template content: World A and World B get new template versions. Existing publications and saves keep their frozen plans, and Update world carries photos over.

## Validation

- **Unit tests:**
  - the blackout scheduler never fires in a forbidden state;
  - watcher moves stay out of frustum, inside the arena and off strips;
  - the jump-scare trigger and its cooldown;
  - the parent switch caps the level at 0;
  - scare 0 is byte-identical to today's scene and physics.
- **Browser:** a lockstep run completes A4 at level 2 with blackouts and a forced jump scare, and screenshots show the dark room, a blackout and the lunge. A3 and B3 are checked at level 1.
- **Owner check:** Tom judges the actual scariness with the kids.
