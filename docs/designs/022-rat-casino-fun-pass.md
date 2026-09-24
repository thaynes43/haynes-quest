# DESIGN-022: Rat Casino fun pass

- **Status:** Accepted direction, September 24, 2026
- **Source:** Tom: "It needs a lot of work, it's very boring. We are targeting 6–12 year olds (my kids) and it needs to be engaging." He approved starting with a Rat Casino fun pass.
- **Requirements:** [PRD-001 R-07](../prds/001-project-brief.md), [BL-02, BL-03, BL-05 and BL-06](../BACKLOG.md)
- **Related:** [DESIGN-011](011-forgiving-obby.md), [DESIGN-018](018-familiar-touch-and-recovery.md), [DESIGN-021](021-rat-casino-level.md)
- **Plan:** [PLAN-017](../../.agents/plans/017-rat-casino-fun-pass.md)

## Problem

The current code explains why play feels flat:

- **Nothing takes skill.** Authored jumps may span at most 1.4 m and rise 0.35 m, while a jump reaches about 0.83 m high and 2.7 m across. Falling costs nothing.
- **Fights carry no threat.** Enemies chase at 0.85 m/s against the traveler's 4 m/s. Attacks aim themselves, and every ordinary enemy falls in two or three hits.
- **There is little to find.** A chapter holds five pickups, all on the main path. Side routes hold only a friendly healer. There are no collectibles, score or secrets.
- **Contact feels late.** A hit shows no flinch or impact sound until the server responds, and presses made while any request is in flight are dropped as busy. Most actions share one click sound. There are no particles, hit-stop or camera shake.
- **Nothing new unlocks.** Current chapters grant every age the same three abilities on one course template.

## Principles for ages 6–12

1. Something happens every few seconds: a reward, a jump, a choice or a threat.
2. Every press gets immediate, physical feedback. The server remains the authority for health, defeat and progress, but the player sees and hears contact at once.
3. The required route stays forgiving for the six-year-old. Richer rewards and harder moves live on optional routes for the eleven-year-old. There is no lost progress and no time pressure on the main path.
4. A reward reads through shape, motion and sound without reading. Numbers are a bonus for older players.
5. Camera shake and hit-stop follow the operating system's reduced-motion setting.
6. Casino tokens are a visual joke of the theme ([DESIGN-021](021-rat-casino-level.md)). They are never wagered, bought or spent on chance.

## Slice 1: feel and rewards

### Scope

Tokens and golden tickets appear only in chapters whose authored theme is `casino`. The garden and Besties courses keep their content, as [BL-06](../BACKLOG.md) requires for the gentle opening. The responsiveness fixes apply to every chapter because they change feedback timing, not course content.

### Instant contact

- **Predicted contact.** When the client accepts an attack, the swing's contact moment (about 0.1 s later) plays:
  - the target's hit reaction
  - a spark burst
  - the impact sound
  - a 70 ms hit-stop and a small camera shake

  The server response still sets health and defeat. The confirmed hit does not repeat the flinch or the impact sound. If the server rejects the action, health does not change and the predicted reaction expires.
- **Buffered presses.** An attack pressed while another request is in flight, or during the last 0.25 s of cooldown, is held once for up to 0.3 s. It is sent as soon as it is allowed, instead of being dropped. Three presses are not held:
  - one made while the traveler's own attack still awaits its reply, which is refused as busy so that one swing never queues another
  - one made in the same frame as a pickup or memory contact, which yields to that contact
  - one made earlier in the cooldown, which shows the cooldown notice as before
- **Defeat.** A defeated enemy releases a confetti burst and a short sparkle sound.
- **Motion scope.** Hit-stop slows only visual animation time. Physics, enemy simulation and server timers keep wall-clock time, so recovery, fall and cooldown rules are unchanged.

### Casino tokens and golden tickets

Slice 1 places collectibles deterministically from the authored route and does not change the level schema.

- **Jump connections** carry an arc of one to three tokens across the gap. The arc sits at a height the traveler's body passes through when jumping or stepping down.
- **Route platforms** carry a trail every 1.5 m, from where the route enters to where it leaves. Branches get the same trails, which rewards exploring.
- **Clearances:**
  - at least 0.4 m from platform edges
  - at least 1.2 m from spawn, finish, memories, pickups, friends and enemy start positions
  - outside sweeper sweep areas
  - none on moving platforms
  - never inside a platform, and never on a strip of floor that a higher, overlapping platform covers. Authored rooms may overlap where they meet, and that strip belongs to the higher room. Overlapping platforms meet at a step, so they get no jump arc.
- **Golden tickets:** one per branch, up to three, on the branch's highest platform that is not on the main route. The ticket takes that platform's centre, or else its first inset corner that is clear of anchors and open floor; if none qualifies, the next highest platform is tried. In Rat Casino these are the ticket loft, the golden-view balcony and the roulette bypass.
- **Collection:** walking or jumping into a token collects it (touch radius about 0.6 m around the traveler's body). Tokens and tickets count per run on the client. They are kept through falls and retries and reset for a new chapter or run. Fresh playtests reset anyway, so slice 1 stores nothing on the server. Lasting rewards such as cosmetics need a server contract later.
- **Feedback:**
  - Each token plays a short chime and a sparkle. Tokens taken within 0.7 s of each other form a streak, and each one plays a little higher.
  - A golden ticket plays the existing fanfare cue with a larger burst and a small camera shake.
  - The HUD shows a gold coin with the token count and one slot per golden ticket, which fills when that ticket is found.
  - The chapter's closing card adds a tally, for example: "You grabbed 83 of 145 casino tokens and 2 of 3 golden tickets."
- **Audio:** slice 1 reuses the existing candidate cues at other pitches and adds no audio asset. Tokens use `ui-confirmed`, golden tickets `ability-unlocked`, and defeats `memory-collected`. Their review pages record this use, and their listening review remains open.
- **Art:** tokens are code-native gold discs with a plum rim. Tickets are code-native golden cards in the art brief's palette. Any later Blender version follows the normal catalog and review flow.

## Later slices

Each later slice is a separate change. Items marked with ★ need Tom's decision first.

1. **Editor vocabulary:**
   - Collectible and golden-ticket pieces, placeable from the UI and the CLI. A "Generate token trail" command replaces runtime generation for authored projects.
   - Bounce pads, moving lifts, and rotating or crumbling platforms.
   - A `levels:pacing` report that flags stretches with no reward, jump or threat for too long.
2. **Movement:**
   - Optional routes use more of the jump's real reach, with bounce pads.
   - ★ Double jump as an age-unlocked ability. BL-06 does not yet allow runtime age gates.
3. **Fights:**
   - Enemies pursue at a meaningful speed. The traveler can stomp to bop an enemy, and hits cause knockback and a hurt reaction.
   - ★ Bosses take damage only in vulnerable windows. This changes server rules, so the plan version must change and older saves stay as they are.
4. **Sound and music:** produced through the audio pipeline ([DESIGN-008](008-audio-pipeline.md)), with Tom's listening review before use.

## Acceptance for slice 1

- **Unit tests** cover:
  - token placement: deterministic, within reach, respecting clearances, tickets only on branches
  - collection: touch radius, no double counting, kept through recovery
  - effect timing: hit-stop duration, shake decay, reduced motion
  - attack buffering
  - a predicted hit that the server confirms without a second flinch
- **In the browser, Rat Casino played with ordinary controls:**
  - collects tokens and at least one golden ticket
  - shows the counter and the completion tally
  - reports no page, console or network errors
- **Garden and Besties** show no tokens.
- **Left to Tom:** feel on physical devices, the sound mix and the children's reactions.
