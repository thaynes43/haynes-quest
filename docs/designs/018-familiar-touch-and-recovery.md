# DESIGN018: Familiar touch controls and memory recovery

Status: Lead implementation contract for PLAN011, based on Tom's child playtest, September 12, 2026. This supersedes world-tap-only jumping, central attack reminders and dizzy-only Besties damage in earlier designs.

## Controls and feedback

Reserve the lower-left corner for movement and the lower-right corner for Jump. The Jump icon is an upward arrow inside a large round button. Attack sits above and to its left; the smaller Secondary sits above and to the right of Attack. Their positions stay anchored to the corners when the device rotates. Preserve the world view between the two thumbs for camera dragging and looking ahead. A scenery tap does not trigger a jump or interaction. Space remains Jump, F Attack and Shift Secondary; walking into pickups still collects them.

The portrait phone stick grows with viewport width to roughly 170–184 CSS pixels, with a smaller lower bound for narrow phones. Tablets use a 200-pixel stick and larger action buttons. Short landscape phones retain a 140-pixel stick. Scale the knob's travel with the actual control bounds, keep a small dead zone, and clear captured input on cancellation, blur, pause and rotation. A second finger can press Jump while the stick remains held. Each press queues one jump; the existing coyote time and landing buffer remain. Jump never depends on age or equipment.

Empty attacks still animate and sound, but show no prose reminder. Keep the avatar clear of notices. Health, collected-memory thumbnails, equipment and boss health belong at the screen edges; instructions belong in Help. Collected pictures update the small album indicators without interrupting movement. Damage remains legible through the existing hit reaction, health bars and audio.

Roblox's current [default bindings](https://github.com/Roblox/creator-docs/blob/main/content/en-us/includes/default-bindings.md) use a virtual movement stick, a Jump button and touch-drag camera control. Its [layout guidance](https://create.roblox.com/docs/tutorials/curriculums/user-interface-design/wireframe-your-layouts) places the stick lower left and Jump lower right. [Positioning guidance](https://create.roblox.com/docs/ui/position-and-size) keeps frequent actions near those thumb areas on both phones and tablets. [Mobile orientation guidance](https://create.roblox.com/docs/input/mobile) documents landscape as the default and optional portrait support. These establish the convention; our sizes, icon artwork and combat arrangement are lead choices to validate in this game. Screenshot searches located phone/tablet examples and the historical portrait announcement; exact current device measurements are not claimed from those examples.

## Defeat and memory checkpoints

After HP defeat, briefly pause and automatically request the existing authoritative level retry. Restore health and return to the safe point associated with the furthest collected minor memory in the active frozen route. Before any minor is collected, use chapter spawn. Resolve the safe checkpoint on the memory's supporting platform, not the frame's physical position. Every minor memory platform must identify exactly one validated safe checkpoint. This derives from existing saved recovered IDs and needs no new client coordinates or persistence format.

Keep the active chapter, collected gear and pictures, abilities and already beaten encounters. Undefeated encounters regain their full health for the next attempt. Collecting a minor also promotes local fall recovery immediately. Routine obstacle falls keep their nearby supported recovery without health loss or server revision changes. Major memory collection advances to the next chapter's spawn; old chapter memories must never select its checkpoint.

Do not offer a whole-journey restart on the normal defeat transition. If the retry request fails, keep the paused journey and offer a single retry action with the actual error; do not repeatedly submit in the background. Deliberately leaving/reloading the fictional private playtest still starts fresh.

## Besties

Both attacks can damage an available Besties boss during every phase when in range and off cooldown. Their alternating tricks and missed high-five remain visual and obstacle behavior; dizziness is not a damage permission. Preserve the ordinary-encounter prerequisite, original damage amounts, equipment checks and server validation. Activate their routine consistently at relative actor height, including the inclusive targeting boundary. Validate a second independent playthrough and death retry, not just the first encounter.

## Safe height practice

New course revisions add upward and downward traversal over supported ground before dangerous challenges. A missed training hop lands safely and can be retried immediately. Use shared box-platform collision and validated route data, not special movement code per level. Higher scenery and stepped terrain make the height change visible. Existing route IDs and frozen geometry remain immutable. The detailed geometry contract and actual-physics/browser evidence must be recorded before release; this is not a claim that the visual level editor exists.

Use `authored-level-v2` for new `garden-playground-v2` and `besties-playground-v2` documents. V1 documents and catalog v4 remain frozen. A new catalog revision selects the new layouts. V2 retains the 0.35m connection rise/descent limit and tested box collision, permits supported anchors/checkpoints above zero, and adds optional `safeMissPlatformId` to jump connections. The reference names a static catch platform below or level with the lower endpoint, above the course fall threshold, covering the avatar-expanded jump gateway corridor and clear of hazard/strike envelopes. It must have a declared traversable retry connection back toward the practice start. Only referenced safe supports may sit outside main/branch paths; validate their outgoing recovery route. Reject missing, partial, hazardous or unreachable catches.

Gameplay contacts on elevated surfaces require matching supported feet height; walking underneath a raised memory must not collect it. Keep encounter arenas planar at their anchor's height and retain conservative XZ exclusion between gameplay zones. This release does not admit overlapping fights on stacked floors. The existing Besties translation, rendered anchors, platform foliage and camera consume world Y; do not flatten them in an adapter. Require exactly one safe checkpoint on each minor-memory platform in both registered document versions.
