# DESIGN-021: Rat Casino playtest level

- **Status:** Authoring decision, September 23, 2026
- **Source:** Tom's direction to move forward with the Rat Casino level after reviewing the classic mascot cast
- **Requirements:** [PRD-003](../prds/003-complete-world-authoring.md)
- **Builder contract:** [ADR-004](../adrs/004-versioned-world-projects.md), [DESIGN-020](020-complete-world-builder.md)

## Playground revision · September 24

Tom's review of the first hosted Rat Casino images found the course barren and flat. The next private revision must make height and scenery obvious on the **required** route, including the approach to the Rat Pit Boss. A raised optional branch alone does not satisfy this requirement.

Keep the course's checked-in project and shared editor commands as the source of collision. Give the required route a readable succession of broad ascending and descending decks: ticket hall, elevated cabinet run, card room, backstage climb and a final stage several metres above the entrance. Every upward connection must stay within the existing 0.35 m jump-rise limit, with broad takeoff and landing areas. Preserve the two minor memories, five encounters, tool pickups, checkpoints, side choices and synthetic date/asset rules. A fall must return to a nearby safe checkpoint without health loss on the practice area or lost progress. Box collision has no slope support, so use visibly distinct terraced hills and jumps rather than a decorative ramp that appears walkable but is not.

The middle token tray should be wider than the inherited ferry, reducing the boarding gap on both sides while retaining its slow sideways drift. Its scripted recovery remains nearby if a jump is missed.

The world should feel occupied from the player's camera: use the already delivered marquee arch, roulette dais and cabinets repeatedly where they remain recognizable, then add light-weight non-colliding venue scenery. Place layered brass and plum porticos, low cabinet clusters, light bulbs, rails, curtain or wall silhouettes and floor markings around the course. Give the boss arena a framed elevated stage, clear central space for Rat and unobstructed sightlines to Golden and the exit. Scenery must stay outside movement and fight lanes, avoid unbounded draw calls or lights, and never substitute for authored platforms or hazards. Review entrance, midcourse, boss and narrow-screen captures, plus an ordinary-control traversal and missed-jump recovery before publishing.

The roulette dais sits in the left stage wing, clear of Rat's fight arena and the straight route to the major memory. Golden remains on the right; Rat owns the center. Overhead room trim must clear the trailing player camera at the next platform, including in portrait view.

## One new world in a portable project

The first Rat Casino course is an independently identified third chapter in a checked-in `level-editor-project-v2` fictional project. Its local route is `rat-casino-v1`. The normal level editor can inspect, change, export and preview it through the same commands and validators as any other project. The private playtest offers a direct start at this chapter using the editor preview service's frozen project path. Published garden and Besties routes, their saved plans and the regular two-chapter fictional start remain unchanged.

The new chapter follows the existing accessible objective rhythm: pick up attack and guard equipment, collect two minor memories, pass four ordinary encounters, face the Rat Pit Boss, then collect the major memory to advance age. All traversal challenges have broad landings, visible checkpoint recovery and a safe way back from a missed jump. The course should feel like a worn family arcade after closing: plum carpet, faded brass, amber bulbs, token stepping stones, cabinet alcoves and a dim central stage. Its spooky tone uses silhouette and suspense without gore, surprise flashes or a forced jump scare. Casino imagery is a visual joke; there is no wagering or purchase mechanic.

## Cast and scene

Rat Pit Boss v002 is the sole boss and visually owns the final stage. Chick-flia v001, Jackrabbit Drummer v001, Fox Card Shark v001 and Moth Projectionist v001 fill the four tested ordinary encounter kinds in that order. Golden After-Hours Rat v001 appears as a noncombat spare mascot in an optional stage alcove, so the complete six-character lineup is visible without silently changing the five-slot encounter contract. The three Rat Casino v001 props provide the entrance arch, low roulette landmark and side cabinets. Their placement is scenic; authored collision, encounter anchors and progression are the authority for play.

All five fights use existing telegraphed behavior presets and the models' authored idle, move, attack, hit and defeat clips. The golden cameo uses only an idle loop and cannot be targeted, damage the player or block progress. The exact asset IDs, versions and hashes are pinned in their [versioned reviews](../assets/catalog.md), with no remote URLs in the portable project.

## Fictional dates and eligibility

The project uses synthetic memories only. Its Rat Casino chapter starts in 2025 and finishes in 2026, within a curated modern relevance window. The first game's [official 2014 listing](https://store.steampowered.com/app/319510/Five_Nights_at_Freddys/) establishes an earliest source date for the broad inspiration. A retro casino look does not make this cast eligible for a pre-2014 photo period. The prepared roster has a distinct frozen catalog version and period ID; old plans retain their exact entries. An editor choice outside the curated dates fails validation and cannot be rescued by a theme change. Any later override requires the explicit admin policy in DESIGN-012.

## Review and acceptance

Tom's “Looks great, let’s move forward to the rat casino level” followed review of the displayed exact classic cast. It authorizes these versions for the private fictional level trial. Keep that decision, the exact hashes and gameplay status on the versioned asset pages and catalog. Physical iPhone/iPad Safari visual quality, frame time and combat feel remain separate trial results and must be reported from devices, not browser emulation.

Accept the level when the checked-in project validates through the shared CLI and browser, the direct start and full journey freeze the same identities, all five encounters and three memories can be completed with ordinary controls, a missed jump recovers, and every exact model and prop loads without external requests. Record the model/artifact identity, route fingerprint, browser error arrays and hosted release revision.
