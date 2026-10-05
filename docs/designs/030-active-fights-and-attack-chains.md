# DESIGN-030: Active fights and attack chains

- Status: Implemented; deployment recorded separately
- Requested: October 5, 2026
- Builds on: [Action and inhabited worlds](029-action-and-inhabited-worlds.md), [Memory rescue and fights](028-memory-rescue-and-fights.md)

Tom's latest feedback is that the game is still terribly boring. Checking completed assets and updating agent guidance did not satisfy his request to improve it. This release changes how fights play: enemies demand different responses, repeated primary attacks build to a stronger finish, and new route revisions tighten the gaps between encounters. Use the existing checked models and animations; further Blender work is useful only when a concrete visual requirement needs it.

## Enemy patterns

Select ordinary-enemy patterns from frozen asset identities, without changing their saved health, damage, defeat flags or catalog entries. The new family minions get readable roles:

- Gadget Hammer Hopper and Broccoli Bouncer charge. They stop to aim for about 0.95 seconds, lock a visible narrow lane, then rush along it at about 7.5 m/s for at most 4 m. The target stays fixed; a side-step or jump avoids contact. A roughly 1.6-second recovery leaves a clear opportunity to hit back.
- Lab Robot Sentry, Lab Robot, Demon Idol Drummer and Radio Showman fire a slow bolt from about 5 m. A one-second stationary windup locks the shot direction, then a visible projectile moves at about 4.5 m/s for at most 6 m. It hits once and expires; its ground warning covers the full collision width (about 0.7 m). A side-step or jump dodges it; the enemy cannot immediately fire again.
- Mischief Kitten Skater and Bin Chicken Flower Thief use faster melee approaches with a longer recovery after a miss. They still show a full windup and do not deal extra damage.

In chapters containing the new variants, their older Gadget, Veggie, Kitten, Bird and Demon counterparts retain baseline melee so pairs mix roles. Earlier started family rosters without the new variants alternate a matched legacy asset's special role and baseline melee using stable encounter order; this gives existing runs variety without changing their frozen roster. Bosses stay unchanged.

All patterns retain the current two-attacker limit, hit cooldown, same-floor contact rule, navigation, leash and friendly healing protection. A fired bolt occupies its attack slot until it expires. Swept movement/contact checks prevent large frames from tunneling through a player or a gap. Charge and bolt paths cannot cross disconnected ground, moving supports or floor changes. Defeat, level change, recovery and loss of a valid attack path cancel hazards. Pausing cannot leave an invisible hazard advancing. Existing bosses and unrelated ordinary assets retain their current behavior.

Optional enemy frame fields expose the pattern, locked target and active projectile to the renderer. Charge warnings show a lane; bolt warnings show the shot line, followed by a bright low-poly projectile. The existing ring stays for melee attacks. Reuse authored attack clips, with distinct motion and readable contact effects.

## Primary attack chain

Repeated successful primary enemy hits build a three-hit chain on route-memory adventures. The third hit adds one damage to the equipped tool's normal damage, or to the existing basic strike when no tool is equipped. A tool remains the larger upgrade. Holding the touch Attack button or F repeats primary attacks at the existing cooldown, without repeating secondary attacks. Releasing, pausing, losing input focus or recovering clears the held attack. Canvas clicks retain their short-click versus drag behavior. No new button is required. Browser play exposed that the previous edge-only input did not actually repeat; the held-input behavior is part of this release.

The server counts accepted primary enemy hits using its clock. A gap longer than two seconds between accepted hits expires the chain. The window allows a child to hesitate briefly or wait through a slower response; the existing 400 ms attack cooldown and one extra point of final-hit damage remain unchanged. Secondary attacks, friendly attacks, death/retry and level changes reset it. The third hit completes the chain; the next begins at one. A missed local swing clears presentation, and no damage request is invented for a miss. Server state remains authoritative; clients cannot submit a combo count or bypass cooldowns. Store only bounded optional combo state so older saves load with an empty chain and existing frozen plans remain intact.

The scene presents alternating first/second strikes and a larger final impact, using the current weapon and animation system. Confirmed hits determine damage and success feedback. Keep the control labels simple; avoid a new tutorial or modal. These improvements apply after refresh to current started family runs using the matched cast, including earlier templates; no save reset is required for runtime combat changes.

## Encounter pacing

Build new immutable A9/B8 templates if placement changes are needed. Measure route distances before editing. Aim for shorter empty walks and mixed-role pairs on safe, broad supports; retain twelve core and four optional ordinary foes, the four-victory boss gate, equipment before the first pair and the existing photo slot identities. Add or adjust a safe fight support where necessary, rather than crowding protected jump landings. Keep earlier template bytes and started world plans unchanged. Published new routes apply to new adventures or an explicitly selected fresh start; do not reset anyone's run.

## Verification and release

Meaningful tests cover each hit and dodge, locked aim, swept contact, gap/floor/friendly safety, the two-attacker cap, hazard cancellation, combo timing/cooldown/idempotency and older saves. Browser play shows the actual charge lane, bolt, melee approach and three-hit finish using normal controls. Complete the seven new chapter journeys and validate authored placements, preserved older templates and photo slots. Record draw calls and limits without claiming physical phone performance from emulation.

Merge the checked implementation, deploy its signed image to the family service and isolated fixture, and carry existing photo assignments into any new publications without reading private photo bytes. Record the live image and health checks. Physical child play remains the measure of fun, but it does not block this authorized gameplay improvement.

The [seven synthetic chapter journeys](../../.agents/evidence/active-fights/a9-b8-routes-20261005.json) completed twelve core fights, the boss, two tools and three memories each. One B3 traversal required recovery and then finished. [Rendered combat evidence](../../.agents/evidence/active-fights/combat-patterns-20261005.json) records pursuit, grounded charge/bolt damage, successful sidestep/jump dodges and a real-time server-confirmed 5/5/6 wand chain. The screenshots also cover directional warnings, visible coral bolts and the confirmed finisher. These are emulated browser checks, not physical-device acceptance.

The new optional persisted `attackCombo` is readable by this release and older saves load without it. A pre-combo image's strict stored-state schema rejects saves containing that field. The GitOps promotion uses one pod/schema version at a time; rollback must retain the combo-aware schema rather than return to the pre-combo image. Exact image, rollout and carried publication counts belong in the [GitOps release record](https://github.com/thaynes43/haynes-ops/blob/main/.agents/evidence/quest-active-fights-20261005-release.json).
