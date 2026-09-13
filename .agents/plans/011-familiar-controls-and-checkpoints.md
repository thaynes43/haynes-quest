# PLAN011: Familiar controls and forgiving checkpoints

Status: In progress. Owner feedback after the longer-course child playtest, September 12, 2026.

Tom reports that jumping was hard to discover despite familiarity with Roblox, the joystick was small, attack prose obscured the player, death led to starting over, and a later Besties attempt stayed idle and rejected hits. He requests memory checkpoints, damage whenever an attack is in range, familiar phone/tablet controls and safe upward/downward jumping practice. This pass precedes the still-required private identity and photo workflow in PLAN010.

## Contract

1. Put a dedicated, always-available Jump button at the lower right and a larger movement stick at the lower left. Keep Attack larger than Secondary, above the Jump corner. Support portrait and either landscape orientation on phones and tablets with safe-area spacing. Space still jumps. World dragging controls the camera; tapping empty scenery no longer jumps. Ordinary actions do not require reading instructions over the avatar.
2. Every collected route memory establishes a safe death checkpoint. Defeat automatically returns the player nearby with health restored, preserving the chapter, collected equipment/memories and beaten encounters. Use chapter start before the first memory; chapter advancement starts the new chapter. Keep deliberate leaving/reloading of the private fixture as a fresh start. Ordinary death must not offer a confusing whole-journey restart choice.
3. The Besties retain their alternating tricks and missed high-five animation. Primary and Secondary can damage them in every active phase when equipped, ready and in range. New v2 courses also remove the ordinary-before-boss lock, so a passed small enemy cannot leave the boss idle and immune. Preserve authoritative damage/cooldown rules and archived route gates. Verify a fresh second playthrough and death retry independently.
4. Add supported, forgiving up/down practice and scenery height variation through the shared authored-level contract. Preserve immutable existing route IDs; new layouts get new versions. Missed practice hops land on safe supported ground. Test actual controller trajectories and a normal-control browser journey, including simultaneous stick and Jump. Document and validate the supported builder geometry rather than adding per-level physics exceptions.
5. Reuse current art/audio. Keep the public-safe playtest guide and catalog behavior descriptions current. Do not generate assets, query family photos, restart dev-env or treat browser emulation as a physical-device pass.

## Delivery

- Root Astra owns UX, copy, layout design, contract ratification, integration and final review. Sol lanes audit/implement bounded combat, recovery and geometry work with isolated worktrees and explicit owned paths.
- Record the detailed design and audit findings before implementation. Verify meaningful regressions, typecheck, lint, tests, production build and strict MkDocs/media checks.
- Exercise phone portrait/landscape and tablet portrait/landscape; retain actual screenshots, input/respawn/second-run evidence and limitations. Use Opus 5 xhigh through agent-run only if a separate adversarial review is needed; Fable remains unavailable until the reported Monday reset.
- Carry checked application and private image-only GitOps PRs through squash merge. Verify the exact hosted client and gameplay plus normal Quest/dev-env isolation before closing this plan.

Current root worktree: `/home/dev/work/quest-familiar-controls`, branch `agent/quest-familiar-controls`, base `8b3a24d`. No new authoring or private-media access is part of this pass.
