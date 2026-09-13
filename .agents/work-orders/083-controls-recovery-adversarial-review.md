# WO083: Controls and recovery adversarial review

Status: Dispatched through agent-run as `haynes-quest-0912-222128`, separate Claude Opus 5 at xhigh; the live process arguments confirm the requested exact model/effort. Fable is unavailable under TEAM.md's temporary quota override. Review results remain pending.

## Exact scope

Read the repository AGENTS.md and TEAM.md. Review application commit `e278f41` from the shared git object store in your own agent-run task worktree. The lead worktree is `/home/dev/work/quest-familiar-controls`. This is a read-only review: do not change source, open a PR, publish, use private media, author assets, restart dev-env or start the shared browser. Record findings in `/home/dev/work/quest-familiar-controls/.agents/work-orders/083-controls-recovery-adversarial-results.md` with exact source locations, minimal reproductions and severity. Distinguish proven defects from hypotheses; a clean review requires explicit tested scope and limits.

The six-year-old playtester could not discover world-tap jumping, found the stick small, saw constant empty-attack instructions, restarted after death, and encountered an idle/immune Besties fight. DESIGN018 and PLAN011 govern the implemented correction:

- Dedicated Jump lower right; larger responsive stick lower left; Attack above/left and smaller Bash above/right. Simultaneous stick+Jump, keyboard Space, camera drag, pointer cancellation/pause/orientation cleanup. Scenery taps no longer jump. No central attack prose; small collected-picture HUD indicators.
- GameScreen automatically requests retry after 650ms at HP defeat, with a bounded manual retry on failure. No restart-the-whole-journey button in the defeat flow. Existing server retry restores health, retains gear/memories/beaten encounters and resets undefeated encounters. Position is derived from active frozen minor-memory order plus saved recovered IDs; memory collection promotes local fall recovery without teleporting. Deliberately leaving/reloading the private fixture remains fresh.
- Both attacks damage Besties across all six routine phases, keeping tricks/range/equipment/cooldowns. A shared exact-route helper opens bosses on new v2 courses despite earlier ordinary enemies remaining; archived/unknown routes remain gated. Routine activation uses actor-relative inclusive height.

Focus on input loss/duplication, stuck or repeated recovery requests, stale-state/unmount races, incorrect checkpoint selection/promotion, server/client boss availability mismatch, and tests that claim more than they prove. Root's focused input/UI suite passes 26 tests; native checkpoint suite passes seven; the Besties implementation lane passed focused phase/reset/availability tests. Review these claims critically.

Known incomplete work outside this review: new v2 course JSON/catalog selection is present, but the height lane has not yet integrated its schema/registry/contact-height implementation. The new layouts are not claimed runnable or deployed at this commit. Do not report this known staging dependency as a fresh defect. Root is adding docs/catalog updates and will run integrated browser/CI/release acceptance afterwards. No physical-device pass is claimed. If your scope requires a browser to prove a suspected issue, report the precise requested check to root instead of taking the browser lease.

Return concise findings/results, exact inspected commit and commands. Do not implement UX/copy changes; Astra owns those decisions.
