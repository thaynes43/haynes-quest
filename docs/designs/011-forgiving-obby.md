# DESIGN-011: A forgiving obby with goofy fights

- **Status:** Owner-confirmed gameplay pillar; first tuning values are lead implementation defaults
- **Source:** Tom, September 11, 2026: Roblox obstacle-course play mixed with goofy enemies, hazards and well-timed jumps; approachable for his six-year-old daughter
- **Related:** [Coming-of-age loop](010-era-combat-loop.md), [recognizable parody cast](005-era-enemy-catalog.md), [abilities](006-memory-age-and-abilities.md)

## Experience

Alternate short obstacle sections with small fights and safe discoveries. Traversal should be enjoyable in its own right: read an obstacle, make a movement or jump at the right moment, land somewhere inviting, and find something useful. A boss completes the level, then the player consumes the released memories and grows into the next period.

The ordinary route is approachable for a six-year-old. Use broad landing areas, short gaps, clear edges, slow predictable movement and long safe windows. Show the complete obstacle and destination from the normal camera. Teach one new idea safely before combining it with a fight. Main-path jumps do not require sprinting, camera tricks, narrow ledges or a precise frame. Optional harder paths can add exploration rewards after the required route works.

Examples for the bounded slice are broad stepping platforms, a slow moving platform and an oversized soft sweeper with a visible approach. Obstacles should take on the period's playful theme once the reference roster is selected. A hazard must be visibly present and behave consistently; decorative scenery is not proof of an obstacle system.

## Ability order

Keep the existing start at memory age zero and the post-boss ability progression. The first short level introduces movement timing with safe ramps, openings and dodgeable obstacles; it must not demand the jump unlocked by its own boss reward. After the first growth transition, teach the new jump on broad low platforms before using it over a gap or with a moving obstacle. This preserves the established ability dependency while making the second level a proper jumping obby. Future changes to starting abilities must be explicit rather than hidden in collision code.

## Forgiving controls and recovery

Use a short grace period after leaving an edge and a small buffered jump window before landing. These are implementation aids, not hidden extra jumps in midair. Touch and keyboard use the same movement rules. Timing pauses when the game is paused or backgrounded; returning must not drop the player into a newly advanced hazard.

Place a safe checkpoint before each new obstacle section and after completing it. A missed jump or obstacle bump returns the player nearby, with a brief clear recovery and protection from immediate repeated contact. It does not remove collected equipment, consumed memories, completed encounters or boss progress. Avoid repeated damage or bouncing loops while the player is recovering. Combat defeat remains a separate, clearly explained retry state.

Obstacle traversal checkpoints may be local within the current session; a persisted resume must start at a safe position derived from saved progression until a versioned checkpoint contract is implemented. Do not imply that an in-memory marker survives reload. The server continues to own combat and memory progression; local movement is not an anti-cheat system.

## Technical acceptance

The current controller only models a flat plane and one raised edge. Required work includes explicit walkable platforms, support and side collision, gaps/fall detection, moving surfaces carrying the player, timed hazard contact and local safe checkpoints. A shared simulation state drives collision and the visible obstacle poses, using the same bounded paused clock.

Test walking off and landing on platforms, undersides/sides, edge grace, buffered input, moving-platform support, hazard timing, recovery cooldown, modal/visibility pause and narrow-screen touch play. Verify that failed traversal preserves authoritative inventory and combat/memory state. The ordinary route must be completed through actual keyboard and touch controls; API-arranged state alone cannot establish playability. Record safe game captures and the limits of emulated Chromium versus a physical iPad or iPhone.

No physical playtest by Tom's daughter has been performed. The main-route tuning remains adjustable from her experience; software checks cannot establish that she finds the game fun or easy enough.
