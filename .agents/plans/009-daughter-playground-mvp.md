# PLAN009: Longer playground adventures for the family MVP

Status: In progress, September 12, 2026. Lead: Astra max. Base: `7a5bce0ce1b86c306bbccfa05a7904b42235de76`. Worktree: `/home/dev/work/quest-daughter-levels`, branch `agent/quest-daughter-levels`.

Tom confirms the PLAN008 fixes resolve his reported problems and sound plays on his iPhone. Record this as owner device acceptance; preserve the earlier automated evidence and its browser limitations. The next MVP is designed for his six-year-old daughter. Longer and more enjoyable levels come first, then identity and curated personal photos. Personalization is required for the MVP, not optional long-term backlog; it is the next delivery stage after this level pass.

## Outcome

Rebuild the two private chapters as playful, varied adventures using the existing roster, foliage and equipment. Aim for roughly five to eight minutes of first-time exploration per chapter as a tuning hypothesis, not a measured child result. Use several short activities with safe breaks, broad landing pads, visible destinations, nearby checkpoints, optional side discoveries and goofy fights. Keep the Besties duo as the later climax. Do not lengthen the game by slowing movement, adding grinding, or making jumps unforgiving.

A shared authored-level document must supply the platforms, moving surfaces, hazards, safe checkpoints and placements consumed by rendering, collision, combat and memory interaction. Extract tested mechanics first; new layouts then reuse those rules. Implement a bounded schema/validator and a command usable by people and agents for checking the same document. The full visual editor and photo pickers are later work.

## Lead design defaults to ratify against the code audit

- Garden chapter: a safe tool pickup, generous stepping pads, a picnic memory/fight clearing, slow padded sweepers, a choice of woodland paths, a short ferry crossing and a broad dragon clearing.
- Besties chapter: a colorful playground with low stepping terraces, alternating side platforms, a slow ferry, a choice of a broad bridge or extra hops, safe resident visits and the duo arena.
- Keep two minor memories on the route and one major after victory. Visiting minor pictures does not age the player. Growth follows boss victory and the completed memory set.
- Jumping remains available at age zero; world tap/Space, contact pickups, Attack/Bash and the repaired sound/input paths stay the controls.
- Required jumps stay short and broad, hazards predictable, recovery near the failure, and required fights separate from jump landings. No new timers, currencies, dark/horror content or expensive model generation.
- Keep the synthetic identity and current fixture chronology during level construction unless the versioned contract explicitly changes it. The child's actual birthday and curated photo ranges belong to the following identity stage; do not infer them or import photos now.

## Work and acceptance

1. Record Tom's iPhone acceptance and MVP priority in the handoff, brief and designs. Correct stale DESIGN011 text that says age zero cannot jump.
2. Audit level/runtime coordinates, frozen progression contracts and browser traversal. Lead ratifies the reusable document and version boundaries before implementation. Native Sol xhigh lanes own bounded engineering, tests and evidence; Astra owns level/visual design, player copy and final integration.
3. Implement reusable piece resolution and validation; preserve previously frozen route layouts. Validate finite bounded geometry, stable IDs, supported kinds, safe spawn/checkpoints, connected supported routes, reachable required placements, arena clearance, required equipment before fights and a boss-gated major memory. Deterministic validation does not replace actual play.
4. Author two longer courses from those pieces. Keep render/collision and Besties world/attack coordinates consistent; extend scenery to the actual course while controlling mobile scene cost. No asset pipeline restart or new generation.
5. Verify meaningful geometry/recovery/version regressions and complete both chapters through actual controls. Exercise touch, camera/layout, sound, memory contact, equipment, enemies, boss attacks/defeat and paused artwork retry. Record route length, activity counts and real observed completion time without claiming the child finds it fun.
6. Update the guide, actual captures and catalog facts in the same PR; retain inspiration/model review pages and existing artifact versions. Use Opus 5 xhigh via `agent-run` for a needed adversarial review while Fable remains unavailable. Carry checked application and image-only private GitOps PRs through squash merge and verify the hosted result, preserving normal Quest and dev-env.
7. Hand the longer private levels to Tom for daughter-focused creative inspection. The following bounded identity/curated-photo stage needs a prepared subject, birthday, chosen memories and existing Authentik admission policy. Keep family media and credentials out of public git, static docs and test evidence.

No dev-env restart, host dependency changes, authoring jobs, new expense, real-photo access or OAuth ceremony belongs to this level pass. Existing saves stay intact; private playtests continue to start fresh. Keep durable checkpoints and preserve previous authoring masters.
