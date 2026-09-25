# DESIGN-023: Golden stage encounter and desktop mouse combat

- **Status:** Implemented in the private playtest, September 25, 2026; final owner preference pending
- **Source:** Tom's Rat Casino playtest: the golden character stood still at close range; desktop clicking should attack, while touch scenery taps must not.
- **Satisfies:** [DESIGN-021](021-rat-casino-level.md), [DESIGN-018](018-familiar-touch-and-recovery.md), [DESIGN-022](022-rat-casino-fun-pass.md)
- **Plan:** [PLAN-018](../../.agents/plans/completed/018-golden-encounter-and-mouse.md)

## Player journey

A PC player can left click for Attack and right click for Secondary while the pointer is on the game. Dragging either mouse button looks around without swinging. A touch player still uses the visible Attack and Bash buttons; touching the scenery only looks around.

In the Rat Casino stage wing, Golden After-Hours Rat becomes a clearly signaled optional opponent. Entering its side space wakes it and its existing move and attack animations communicate the threat. The player can target, damage and defeat it using the ordinary combat rules. The Rat Pit Boss remains center stage, with four earlier mascot fights unchanged. Golden never gates Rat, the major memory or completion. The player can leave its side space without losing the main route. This adds no wagering or surprise flash.

## Contract

1. Keep `rat-casino-v1`, the five-slot editor project format and existing frozen `editor-world-plan-v1` saves readable and unchanged. A forged sixth v1 encounter must still fail validation.
2. Add an explicit optional encounter slot to a new `rat-casino-v2` route/project and a new frozen editor-world plan version. Old projects omit the slot. The authored anchor supplies position, arena and retry checkpoint; the assignment supplies an eligible ordinary candidate. The editor and CLI expose the same optional encounter choice and placement. The server freezes its exact candidate, stats, asset identity and optional status; client rendering is not the source of progression truth.
3. A bonus encounter is independent of the required four ordinary fights and the boss. It must be fought before Rat falls, because the post-boss memory phase does not allow combat. Place Golden so its arena and activation space do not overlap Rat's active fight lane. Suppress the scenic cameo when its exact model is a live combat encounter, so only one Golden appears.
4. Keep the actual Golden v001 GLB and its five existing clips. Its exact art remains a private playtest candidate; this behavior change does not claim final device or art approval. Update its review and catalog use text with the new role.
5. Queue one mouse action only for a short, un-dragged, completed `pointerType === "mouse"` contact on the canvas: left is Attack, right is Secondary. Cancellation, loss of focus, hidden page and game UI contacts do not fire. The canvas suppresses its context menu. Touch and pen scenery contacts never queue combat, even if a browser later emits a compatibility click.

## Validation

- Parse and replay old projects and saves. Reject a forged Golden encounter under v1. Export/import and preview the new project with its optional slot intact.
- In the private browser, approach Golden, observe it wake and attack, land hits, and defeat it. Also skip Golden and finish Rat's main route. Check stage separation, fall recovery and no duplicate Golden model.
- In desktop Chromium, real left and right mouse clicks dispatch distinct actions; drags and cancellations do not. In touch emulation, a scenery tap does not attack and the visible Attack button still works. Physical Safari and device combat feel remain Tom's review.

## Decision record

| ID | Question | Status |
| --- | --- | --- |
| Q-01 | Should Golden remain an optional fight or become a reactive scenic secret? | The September 25 private trial uses an optional fight in response to Tom's “enemy didn't do anything” report. Tom's playtest preference for the lasting version remains open. |
