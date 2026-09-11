# WO-033 results: corrected parody/obby adversarial review

- **Review base:** `f265a32` (`Preserve quick jump taps and show full enemy danger areas`), with the abandoned Fable worktree at `eaa7eb3` used only as an evidence source.
- **Reviewer status:** the original Fable 5.1 session did not complete the review. Its durable log ended `TASK-EXIT 0` after reporting `hit session limit · resets 2:20pm (America/New_York)`, and it left no final report. Three Opus 5 subagent transcripts and untracked review probes were recoverable. This report independently checked their concrete claims rather than treating the interrupted session as approval.
- **Scope:** the seven requested probes, one recovered authored-animation issue, and direct checks of DESIGN-005/010/011. Known pending models, real-photo/OAuth admission, physical Safari/child testing and final owner asset review remain milestones rather than findings.

## Confirmed defects

### R-2 — Unknown frozen artwork takes down the scene (medium)

`parodyArtwork` throws for an identity/version absent from either the shared catalog or the separate `parodyMotion` table (`src/game/scene-catalog.ts:17-30`). `GardenScene.rebuildRoute` calls it without a recoverable branch (`src/game/scene.ts:344-353`). The review test reproduces a future `mister-hiss` v002 identity throwing even though the chapter-title resolver already degrades unknown content to a generic name.

Same-build saves cannot currently reach this case because the server rejects identities outside its v1 catalog. It remains reachable across a deployment when a stale open client receives a plan from a newer server, and the second hand-maintained motion table can drift when a catalog entry is added. DESIGN-005 D-10 explicitly requires an unavailable asset to have a safe replacement or recoverable state.

**Narrow fix:** make artwork resolution return a recoverable absence, render a visible placeholder, and retain the existing asset retry/error state. Add a completeness check tying every supported catalog identity to runtime motion metadata.

### R-3 — A held keyboard key becomes a fresh press after input clear (medium; fixed by root)

On the review base, `GameInputState.clear()` empties its physical-key set (`src/game/input.ts:157-173`), while browser `keydown` forwards auto-repeat without inspecting `event.repeat` (`src/game/input.ts:196-207`). After a traversal recovery or pause clear, the next repeat re-adds held `W` and creates a second Space press edge. The bound-DOM reproduction covers both movement and jump.

Root fixed this after review in `45425b9`: the binding prevents the browser default and ignores repeated keydown events, with a regression confirming that an actual release and new press still work.

### R-5 — An island enemy can hit a player already falling into the gap (medium)

The authored `gentle-jump-v1` reproduction dwells at the south edge of `first-clearing-island`, then steps off during `ordinary-a`'s strike. At 2.45 seconds it records contact at `{ y: -0.0187, z: -9.788 }`, after the player has left every platform. Enemy contact only checks horizontal range and a 0.3 m feet-height delta (`src/game/combat.ts:265-274`). The runtime records and flushes that contact in the same frame (`src/game/createGame.ts:616-630`), well before the local fall threshold at y < -2 can recover the player. The result is a server `take-hit` followed by the local checkpoint reset for one slip.

**Narrow fix:** reject enemy contacts once the player's feet are below the encounter arena floor. This addresses falling without granting general invulnerability to a player jumping above the floor. Apply the same condition in simulation and final strike validation.

### R-6 — Center-point checkpoints miss safe wide landings (medium; core support implemented)

Every authored checkpoint is circular and center-aligned (`src/game/obby-layout.ts:19-35`). `first-clearing` has a 1.30 m trigger diameter on a 12 m-wide island. The course probe shows only x = 0 and x = 0.3 arm it; x = 0.6 and wider safe lanes reach the second gap without it, then recover to the start and must replay the first gap. This conflicts with DESIGN-011's nearby recovery and broad-landing requirements.

Commit `b13ce75` adds optional axis-aligned `triggerHalfExtents: { x, z }` support to `ObbyCheckpoint`, retaining the circular `triggerRadius` path unchanged. Its unit test proves a broad off-center landing arms while the preceding shore does not. Root integrated that core as `3b957b2`; the authored layout and stripe visual remain root-owned follow-up work.

### R-7 — Walking backward after boss defeat replaces the reward checkpoint (low)

The transition to `memory-released` sets the safe reward point at z = -23.5 but clears `checkpointId` (`src/game/createGame.ts:348-356`). Since the obby core only skips the currently named checkpoint, walking north for four seconds re-arms `boss-landing` and replaces the reward point with z = -19. A later local recovery puts the child 4.5 m away from the released memory bundle.

**Narrow fix:** keep ordinary traversal and moving obstacles active in `memory-released`, but suppress regular course-checkpoint activation until the bundle is consumed. The safe reward checkpoint should remain the recovery destination.

### R-8 — Authored enemy hit animation is discarded during windup/strike (low-medium)

`EnemyAnimation.updateAlive` detects an HP drop, but its windup and strike branches always keep the attack clip and never use that signal (`src/game/enemy-animation.ts:227-260`). `lastHp` advances after the frame, so the hit is not replayed later. The scene's procedural squash is disabled for authored enemies (`src/game/scene.ts:778-795`). The review rig reproduces no hit-clip motion for HP loss in windup and strike while its cooldown control plays the clip.

The attack warning should remain readable, so blindly interrupting the telegraph is not required. **Narrow fix:** queue the hit reaction until the strike resolves, or add equivalent authored feedback that does not erase the attack tell.

## Bounded limitations and future constraints

### R-1 — Birthday selection is intentional; catalog coverage is narrow

The planner deliberately starts level zero at age zero on the birth date (`src/shared/adventure.ts:159-190`), and save validation requires the first `startDate` to equal that date (`src/server/domain.ts:349-364`). This matches DESIGN-004/006/010. Selecting the first photo's era instead would contradict the ratified progression, so the birthday-versus-photo result is not an algorithm defect.

The concrete limitation is catalog coverage: the only complete periods begin on 2020-01-01 and end on 2026-12-31. A child born 2019-10-01 cannot create a journey even when every selected photo is in 2024–2026; the same photos succeed for birth 2020-03-01. A level whose next start date is in 2027 also fails, while a 2027 final memory can be consumed from a 2024-start level. These are expected `ERA_CATALOG_UNAVAILABLE` outcomes under the explicitly bounded v1 roster, but they are an admission blocker for any intended player whose required level starts fall outside it. Resolve with researched coverage, an authored neutral fallback, or a clear setup state before real admission; do not change the birthday anchor or borrow a later cast.

### R-4 — Current validation rejects corruption; archive v1 before a catalog v2

The recovered probe changes a stored v1 plan to asset/version/entry values that have never been supported. The current parser's rejection is useful integrity checking, not evidence that a presently valid save has broken. There is only one catalog version today.

The code does impose a concrete upgrade constraint: the schema accepts only `PARODY_CATALOG_VERSION` (`src/server/adventure-schema.ts:87-96`), and validation rechecks frozen identities against only the live `PARODY_CANDIDATES` table (`src/server/adventure-schema.ts:212-243`). Replacing that constant/table in place would make valid v1-catalog saves unreadable, contrary to DESIGN-005 D-09/D-10. Before introducing `parody-catalog-v2`, retain the complete v1 definitions in a version-keyed historical registry and dispatch validation by each stored plan's `catalogVersion`. No current production change is justified by the mutation probe alone.

## Rejected or non-defect recovered claims

- Changing `expectedRevision` while reusing an action ID changes the request being identified. Returning `ACTION_ID_REUSED` is consistent with the present idempotency contract; a re-synced new attempt should use a new action ID.
- Anonymous fixture-media access serves only repository-owned synthetic fixture art, and fixture mode excludes private media. It does not bypass the private save-media route for real photos.
- Missing five pending parody GLBs, final asset approval, real-photo admission and physical-device validation were already explicit milestones in WO-033 and are not implementation regressions.
- The f265a32 quick-tap deferral, full-size attack warning, and touch Jump availability during `memory-released` were inspected and are covered by their focused root regressions; none of the recovered probes overturns them.

## Evidence and checks

- `pnpm exec vitest run tests/review`: 4 files passed; 3 ordinary assertions passed and 5 review-base defect assertions passed as expected failures (R-2, two R-3 cases, R-5 and R-8).
- `pnpm exec vitest run tests/game/obby.test.ts`: 43/43 passed with the rectangular-trigger regression.
- `pnpm typecheck`: passed.
- `pnpm lint -- src/game/obby.ts tests/game/obby.test.ts`: passed.
- `tests/review/033-probes/coverage-by-birth-date.ts`: reproduced the 2019 birth-date rejection and the distinct 2027 start-date boundary.
- `tests/review/033-probes/catalog-coupling.ts`: exact v1 plan accepted; deliberately altered entry/asset/catalog identities rejected as `503 SAVE_DATA_INVALID`.
- `tests/review/033-probes/checkpoint-arming.ts`: 1.30 m trigger on 12 m island; x >= 0.6 missed `first-clearing` and recovered to start after the second gap.
- `tests/review/033-probes/reward-checkpoint-rearm.ts`: after four seconds north, checkpoint changed from reward z = -23.5 to `boss-landing` z = -19.

The review files are intentionally isolated under `tests/review`. Tests marked `it.fails` describe the review-base failure and must be converted to normal regressions as each root fix lands.
