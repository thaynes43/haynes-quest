# A fresh two-chapter playtest

Choose **Play from the beginning** for the full age 0 → 4 → 7 route, or **Try the Besties chapter** to jump straight to chapter two. Every test starts fresh. Leaving or reloading resets the run; there is no save or resume list in this playtest.

This private review uses [six fictional pictures](reviews/fixture-route-memories/v001.md). Longer, forgiving adventures for a six-year-old are the current focus. Identity and curated family photos are the next required part of the MVP; this fixture's ages and pictures are still fictional.

## How to play

| Action | Touch | Keyboard |
| --- | --- | --- |
| Move | Left stick | WASD or arrow keys |
| Jump, at every age | Tap the world | Space |
| Look around | Drag the world | Drag with the mouse |
| Attack | Large **Attack** button | F |
| Secondary attack | Smaller **Bash** button, after finding a shield | Shift |
| Collect gear or memories | Walk into them | Walk into them |

Hold the movement stick while tapping elsewhere to jump or attack. Dragging the camera and touching a menu do not jump. Bash adds a close-range hit with a separate recharge; future gear can add other secondary attacks.

Find two little memories along each route. Their keepsakes disappear on collection; a brief picture confirms the pickup without stopping the action or aging the player. You can revisit collected pictures in Memories. Beat the boss, then walk into the big memory beyond it: collecting all three advances your age and opens the next chapter. Missing little memories remain on the path after victory.

## What changed for this test

The two chapters now have different, much longer playground routes. Each mixes short jumping activities with safe stopping places, four goofy enemy encounters, two little memories and a boss. An optional side path lets you visit a friendly resident before rejoining the adventure.

| Chapter | Places to explore |
| --- | --- |
| The Block Party | Garden stepping pads, a picnic clearing, winding padded sweepers, a woodland side path, a low rise and a small ferry before the dragon. |
| Besties Obby | Low party terraces, a ribbon lane, a sideways ferry, a choice of stepping pads or a broad side bridge, a slow turnstile and the Besties court. |

Jump onto the ferries, ride along, then jump to the next landing. Broad platforms leave room to line up a jump. A slip returns you nearby with your gear and memories; there is no lives counter or race timer. Grass, flowers and the existing trees extend through the longer routes, with clear space around fights and memories.

The mobile controls and sound repairs accepted on Tom's iPhone are retained. Jumping works from age zero, contact collects things, and recovered little keepsakes disappear. **Sound on/off** controls mute; **Help → Play a test sound** auditions the output and offers a retry if needed. The source cues and mix are unchanged. A missing model still shows a retryable warning while play continues.

## In the game

![The age-zero route with visible grass, fictional memories and the Attack control](media/playtest/v004/age-zero-route.png){ width="300" }

This earlier mobile-repair capture shows the same traveler, grass, tool and memory artwork. New playground captures will accompany the checked level release.

![The Besties during their shared dizzy window, with Attack and the smaller Bash control](media/playtest/v004/besties-dizzy.png){ width="300" }

The Besties share a recovery window after their missed high-five. The small Bash button appears after you collect a shield. These are actual browser captures from the mobile repair candidate; their [capture record](media/playtest/v004/captures.json) identifies the tested versions.

![Help after a successful test tap, with a repeatable sound button and visible status](media/playtest/v004/help-sound.png){ width="300" }

Help scrolls on touch, and the sound button confirms a test or offers a retry. Artwork retries also update their result while a menu or the game-over screen is open; they do not require a second tap. The [sound check](media/playtest/v004/mobile-audio-local.json) records the earlier button/input verification; Tom subsequently confirmed audible sound on his iPhone.

## The encounters

Watch the padded sweepers and short gaps. A slip returns you to a nearby safe spot with your gear and collected memories. If you keep holding the stick, movement resumes after you recover. Green hearts mark friends who can heal you. Deliberately hurting one costs health; returning to make amends restores their help. Friends never block chapter progression.

If you lose all your health, retrying keeps your gear, memories and defeated enemies. Enemies still standing regain their health, so you can try the boss again without repeating the earlier fights.

The Besties alternate a pink foam sweeper and a purple floor lane. Each warning chooses your position once, then stays fixed: jump or move to clear ground. The pair turn toward you, step into their tricks, react to hits and disappear after their defeat animation. When they miss their high-five, both become dizzy for five seconds: that is your chance to attack.

For the next family test, watch whether the destinations are clear, whether the jumps feel forgiving and where your daughter wants to explore. Her response will guide the next content pass. The [earlier hosted route check](media/release/v004/final-live-route.json) and its [touch](media/release/v004/final-live-controls.json), [landscape](media/release/v004/final-live-landscape.json) and [sound-button recovery](media/release/v004/final-live-audio.json) records describe the shorter mobile-repair release, not completion of these new playgrounds. Check the [current handoff](../../.agents/HANDOFF.md) for the exact deployed version and new acceptance evidence.

## Still to come

Identity, birthday setup and curated personal photos follow the longer levels as required MVP work. A parent will choose the little memories and the big memory for each chapter; the daughter's actual chronology will replace the fixture's 0 → 4 → 7 sequence. Authorized photo integrations and manual uploads belong to that personalized experience.

The new courses share validated, reusable pieces as the foundation for a level builder. A visual editor, freely placed memories, period suggestions with Show more, more chapters and the full baby-to-adult journey remain later extensions. The Besties shortcut prepares the first chapter for testing; it is not a saved journey.

## Cast and artwork

| Chapter in a new journey | Ordinary enemies | Boss | Friendly residents |
| --- | --- | --- | --- |
| The Block Party | Two [Mister Hiss](reviews/mister-hiss/v001.md) and two [Peel Patrol](reviews/peel-patrol/v001.md) encounters | [Drama Dragon](reviews/drama-dragon/v001.md) | [Blockling](reviews/blockling/v001.md), [Signal Moth](reviews/signal-moth/v001.md), [Buffer Baron](reviews/buffer-baron/v001.md) |
| Besties Obby | Two [Sir Flush-a-Lot](reviews/sir-flush-a-lot/v001.md) and two returning Peel Patrol encounters | [The Bickering Besties](reviews/bickering-besties/v001.md) | [Loop Dancer](reviews/loop-dancer/v001.md), [Prism Mimic](reviews/prism-mimic/v001.md), [Trendweaver](reviews/trendweaver/v001.md) |

[Browse the full visual catalog](catalog.md) for inspiration images, models, motion, the six fictional pictures and sound previews. The playtest uses the same 23 GLBs and four source WAVs recorded in the [artwork list](media/playtest/v002/artwork.json), with a revised runtime sound mix. The [hosted phone and desktop catalog audit](media/release/v004/final-catalog-live.json) checks the thumbnails, reviews and model viewers. The joint Besties look is approved; exact model and sound versions remain available for final review.
