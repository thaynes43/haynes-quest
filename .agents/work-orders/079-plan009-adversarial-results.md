# WO079 results: authored playground adversarial review

Reviewer: separate Claude Opus 5 (`claude-opus-5`, `xhigh`) session, per the TEAM.md quota override.
Candidate: **`f2bfe36`** ("Resolve authored playgrounds throughout runtime and scenery"), reviewed against base `7a5bce0`.
Review worktree: `/home/dev/work/haynes-quest-0912-144456`, branch `agent/haynes-quest-0912-144456`
(fast-forwarded to `f2bfe36`; the lead's worktree, the root browser lease and port 4400 were not touched).
Probes: `tests/review/079-probes/` — 25 vitest checks plus one standalone geometry audit script.

**Not a clean review.** One finding blocks the pending browser acceptance; two more are real content/validation
defects; the rest are bounded coverage gaps and version-boundary observations. Everything the candidate
*claims* to have verified does verify — the gaps are in things nothing verified.

## Baseline reproduced

```
git merge --ff-only f2bfe36
pnpm install --offline
pnpm typecheck   # clean
pnpm lint        # clean
pnpm test        # 46 files, 404 passed / 10 skipped
python3 scripts/docs/prepare.py && python3 scripts/docs/check_links.py .docs-build   # 181 files, clean
pnpm exec tsx scripts/levels/validate.ts   # both documents valid
```

`python3 -m mkdocs` is not installed in this worktree, so the strict site build was not re-run here; the
prepare + link stages pass. With the probes added: 52 files, 429 passed / 10 skipped; typecheck and lint stay clean.

---

## Findings

### F1 — HIGH: the new browser driver jumps with a control that no longer exists

`tests/e2e/authored-browser-driver.mjs:106-110`

```js
const button = await page.getByRole("button", { name: "Jump", exact: true }).boundingBox();
assert.ok(button, "touch Jump control is unavailable");
```

PLAN007 replaced the four-button cluster with world taps and PLAN008 removed the jump hint. The rendered
touch HUD for a route-memory save exposes exactly:

```
["Save & leave","Mute sound","Open your memories","How to play","Bash","Attack"]
```

There is no `Jump` button in any state (`src/client/GameScreen.tsx:711` renders only `Bash`/`Guard` beside
`Attack`; `main.tsx:187` says "**Jump** by tapping the world"). `jumpWhileHeld()` is the only jump path in the
driver and is called from three sites (`:324`, `:420`, `:483`); `tests/e2e/authored-playtest.mjs:291` builds
touch controls with no keyboard fallback. Every main-path edge in both authored documents is a `jump` or
`ride` edge, so the harness cannot leave the spawn platform. The current-generation pattern is
`tests/e2e/fresh-playtest.mjs:589` (`tapPointWhileHeld(held, await worldPoint())`); the new driver copied the
obsolete `journey-lib.mjs:337` pattern instead.

Consequence: WO078's remaining "actual-control two-chapter, branch, ferry, recovery and combat journeys"
acceptance cannot be produced by this harness as written. `tapButton("Attack")`/`tapButton("Bash")` are fine.

Evidence: `tests/review/079-probes/driver-controls.probe.test.tsx` renders the real `GameScreen` in jsdom with
a route-memory save and prints the rendered button names.

### F2 — MEDIUM: both shipped documents put a friendly resident inside an ordinary enemy's strike envelope

DESIGN017 promises "safe resident visits". Two of the six resident anchors are not safe:

| document | resident | anchor | fight | nearest arena point | distance | ordinary reach |
|---|---|---|---|---|---|---|
| `garden-playground-v1` | `friendly-2` | (-4, 0, -63) | `ordinary-3` arena x[-3,4] z[-67,-63] | (-3, -63) | **1.00 m** | 1.35 m |
| `besties-playground-v1` | `friendly-3` | (-4, 0, -88) | `ordinary-4` arena x[-4,4] z[-92,-89] | (-4, -89) | **1.00 m** | 1.35 m |

`combat.ts` clamps an ordinary to its arena and then attacks whenever `canReachPlayer(player, arena, 1.35)`
holds, so a player standing on either resident anchor is inside the strike band by 0.35 m.

The window is narrow but it is exactly the one the resident exists for: the boon only offers itself when
`playerHp < maxPlayerHp` (`createGame.ts:314-327`), i.e. after the player has been hurt in that same fight.
Approaching the resident *before* the fight is safe (the enemy spawns 6.32 m away, just outside the 6 m
activation radius), but once the fight has drawn the enemy to the near corner of its arena, retreating to the
creature keeps the player under fire. The friendly dialog pauses the game only *after* the player is already
standing there. The player can retreat further (the interaction radius is 1.7 m), but nothing in the layout or
the prompt tells a six-year-old to.

Evidence: `tests/review/079-probes/authored-playground.probe.test.ts` — the second probe lures the live
`EnemySimulation` to the arena corner, then places the player on the resident anchor and records the contact.

### F3 — MEDIUM: the validator's "safe content" rule uses the raw arena while its checkpoint rule uses the strike envelope

`src/shared/authored-level.ts`

- `:1100-1127` — checkpoint recovery points are tested against `encounterStrikeEnvelope()` (arena + 1.35 m, or + 2.25 m for a boss). Correct.
- `:1245-1266` — `protectedBeforeBoss` (spawn, both pickups, both minor memories, all three residents) is tested against `encounter.arena` only.

So the rule that is supposed to keep safe content away from fights is 1.35 m looser than the rule that keeps
recovery points away from them, and it is the reason F2 validates. A required anchor placed 0.05 m outside an
arena and 1.30 m inside the enemy's reach produces zero issues:

```
minor-two moved to (0, 0, -62.65) on memory-grove  ->  validateAuthoredLevelDocument() === []
```

Recommendation: use `encounterStrikeEnvelope()` in `protectedBeforeBoss` as well (and consider extending the
list to `major`, `rewardRespawn` and `finish` for symmetry).

Evidence: probe 3 in `authored-playground.probe.test.ts`.

### F4 — MEDIUM: validation accepts a route-blocking hazard, so "reachable required placements" is graph-only

`sweeperPieceSchema` (`src/shared/authored-level.ts:253-270`) makes both `motion` and `rotation` optional, so a
sweeper with neither is a permanently damaging fixed bar. No rule tests any hazard against the main-path
traversal corridor or against a required jump's landing strip — hazards are only checked against anchors,
checkpoint recovery points and encounter arenas.

Adding one piece to the garden document:

```json
{ "type": "sweeper", "id": "probe-wall", "center": { "x": 3, "y": 0.22, "z": -25.6 },
  "halfLength": 3, "radius": 0.4 }
```

`validateAuthoredLevelDocument()` returns `[]`. Driving the real controller (`stepObby`, route-memory tuning
`moveSpeed: 4`) off `picnic` toward `winding-east` never lands: the probe records repeated `recovered` events
and never reaches `supportId === "winding-east"`. The main path is graph-connected and geometrically legal and
the level is unfinishable.

DESIGN017 says "Deterministic validation does not replace actual play", which is honest — but PLAN009 item 3
lists "connected supported routes, reachable required placements" as a validator responsibility, and that
responsibility currently stops at the platform graph. A cheap improvement: reject a sweeper with no motion and
no rotation, and test each main-path edge's landing strip against the hazard envelopes already computed.

Evidence: probe 4 in `authored-playground.probe.test.ts`.

### F5 — LOW/MEDIUM: pickup, encounter, memory and reward ordering are only platform-granular

All ordering rules key on `mainIndex.get(anchor.platformId)` (`src/shared/authored-level.ts:1168-1244`), so every
anchor sharing a platform shares an index and `>` / `<` comparisons never fire. Moving the attack tool 2 m
*behind* its first fight on the same platform still validates:

```
attack-tool -> (-3, 0, -23.5) on picnic ; ordinary-1 at (2, 0, -21.5) on picnic
validateAuthoredLevelDocument() === []
```

Both shipped documents happen to be correctly ordered within each platform (garden `picnic`: entry at
z ≈ -16.5, guard tool at -18, fight at -21.5, exit at -24), so this is a latent authoring hazard rather than a
live bug — but the same platform hosts a pickup, a memory and a fight in both chapters, which is exactly where
a future author will trip on it. Ordering along the travel direction within a platform would close it.

### F6 — LOW: no arena-versus-arena check

Two encounters may declare identical arenas on the same platform and validate with no issues. Two ordinaries
clamped into one arena would fight over the same ground. Probe 5 in `authored-playground.probe.test.ts`.

### F7 — LOW: version-boundary smell in the new catalog identity

- `PARODY_CATALOGS["parody-catalog-v4"]` is deep-equal to `parody-catalog-v3` — the new version carries no new
  content, only a new identity (which is the stated intent).
- Consequently `ALL_PARODY_CANDIDATES` grew from 21 to **30 entries with 18 duplicate ids**. Every duplicate is
  byte-identical, so the `find`-by-id lookups in `scene-catalog.ts:42` and `client/era.ts:29` still resolve
  correctly. No functional break, but the list is now 43% redundant and a future non-identical v5 would make
  those lookups order-dependent.
- `createAdventurePlan` — the *archived* `era-level-plan-v2` builder still reachable through
  `domain.ts:165` when `planMode !== "route-memories"` — now stamps `catalogVersion: "parody-catalog-v4"` on a
  three-encounter, `gentle-*` plan. It still round-trips through `parseStoredAdventure` because
  `playgroundPlan` additionally requires `version === "era-level-plan-v3"`, but a v2 plan labelled with the
  playground catalog version reads as a contradiction and leaves the guard resting on one extra conjunct.

Evidence: `tests/review/079-probes/compat-and-besties.probe.test.ts`.

### F8 — LOW: the Besties disengage gate shrank from a half-plane to a small box

`createGame.ts:168-180` replaces `controller.position.z < -17.5` with the boss arena expanded by 1.5 m:
x ∈ [-5.3, 5.3], z ∈ [-115.5, -108.5] on a `besties-court` that spans x ∈ [-7, 7], z ∈ [-122, -102]. Leaving
that box drives `BestiesSimulation.step({ active: false })`, which calls `inactiveState()` — a full reset to
`phase: "inactive"`, `cycleIndex: 0`, no hazards, discarding the telegraph. The old half-plane could not be
side-stepped laterally; the new box can, on ~2 m of spare court in x and ~6 m in z. Boss HP is server-side, so
this is an escape valve rather than an exploit, and for a six-year-old it is arguably forgiving — flagging it
so the lead rules deliberately rather than inheriting it.

### F9 — INFORMATIONAL: `inspectLevel` deep-clones the whole authored document per call

`src/game/level.ts:322` adds `structuredClone(level.authored)` to every inspection, and `inspect()` runs in
production on each friendly-prompt tap (`GameScreen.tsx:755`). That is a ~730-line JSON clone per tap on the
phone. Harmless today; worth memoising if `inspect()` ever moves into a per-frame path.

---

## Verified — no defect found

**Both routes are completable under the real physics.** A naive auto-pilot (walk toward the next main-path
platform; jump only when the ground ahead runs out; steer around sampled sweeper capsules) driving `stepObby`
with the route-memory tuning reaches the reward platform on both chapters with **zero recoveries**:

| route | jumps | walked | simulated | ends on | last checkpoint |
|---|---|---|---|---|---|
| `garden-playground-v1` | 14 | 117.4 m | 29.4 s | `garden-reward` | `garden-reward-safe` |
| `besties-playground-v1` | 16 | 134.2 m | 33.5 s | `party-reward` | `party-reward-safe` |

Both declared branches traverse and rejoin with zero recoveries. Worst main-path edge: 1.3 m gap (jump), 1.3 m
gap (ferry ride), 0.22 m rise — inside the 1.4 m / 0.35 m contract, and inside the ~2.67 m a 4 m/s hop covers.

*Pacing note, not a defect:* an optimal run is ~30 s of walking per chapter, and the level-1 fights are 2–4
hits at a 400 ms cooldown (~5 s of presses total). The 5–8 minute target therefore depends entirely on
exploratory child play; an adult verification run will not resemble it. PLAN009 already calls the target a
tuning hypothesis — recording the measured floor so the eventual observed time can be read against it.

**Checkpoint arming and retry.** Every one of the 16 authored checkpoints re-arms **1 frame** after a fresh
controller respawns on it, so a second consecutive fall does not silently regress to the reload fallback.
`checkpointForSave`'s authored branch behaves as its comment describes:

```
defeated encounters -> reload respawn z (garden): 0->1, 1->-16.8, 2->-39.8, 3->-59, 4->-78.3, 5->-90.5
```

It never grants unvisited progress. It also never grants *visited* progress: a player who reaches
`pond-safe` without defeating anything reloads 91.5 m back at spawn. That is intentional and, because PLAN007
private tests start fresh, largely unreachable — noting it so it is a decision rather than an accident.

**Translated Besties combat is sound.** With the authored origin (0, 0, -112):

```
arena          x[-3.8, 3.8]  z[-114,   -110]
hazard envelope x[-6,   6]   z[-116.5, -108.15]   (aimed, sampled over 30 s at both activation corners)
besties-court  x[-7,   7]   z[-122,   -102]
```

Every translated hazard stays on the supporting court. `nearestBestiesActor` resolves both actors in world
space around the origin; the local aim clamps (`pinkZ` ∈ [-23.5,-19.5], `blackX` ∈ [±3.75]) plus their half
extents still cover the whole ±1.5 m activation box, so there is no standing spot inside the fight that
neither attack can reach. Note that the routine reaches 2.2 m outside its own declared arena in x and 2.5 m in
z — it fits here only because `besties-court` is 14 × 20 m, and the validator does not check a boss routine's
footprint against its support. Worth an explicit note in DESIGN017 if the boss is ever relocated.

**Encounter binding.** Both chapters bind five slots by role + stable ordinal: kinds
`[ordinary-a, ordinary-b, ordinary-a, ordinary-b, boss]` match the anchors, all five instance ids are
distinct, repeated artwork lands at distinct positions, and the boss binds to the boss anchor.

**Archived routes and plans are unchanged.** `src/game/obby.ts` and `src/game/obby-layout.ts` have an empty
diff against `7a5bce0`. An archived route-memory plan (`createRouteMemoryPlan(..., "parody-catalog-v3")`) still
produces `gentle-jump-v1` × 2 with three encounters each, round-trips `parseStoredAdventure`, and
`authoredLevelLayout` returns `null` for both of its levels. Cross-version tampering is rejected in both
directions (v3 plan relabelled v4, and v4 plan relabelled v3).

**Scenery budget** (instanced, so draw calls are unchanged; vertex load is not):

| route | static platforms | grass candidates | grass rendered | flowers | trees | hills |
|---|---|---|---|---|---|---|
| `garden-playground-v1` | 18 | 4855 | 4400 (capped) | 339 | 28 | 12 |
| `besties-playground-v1` | 19 | 6238 | 4400 (capped) | 339 | 28 | 12 |
| `gentle-jump-v1` (archived) | 4 | 993 | 993 | 77 | 16 | 8 |

4.4× the archived grass over a 110–130 m course, bounded by the new `maxInstances` cap and sampled evenly, so
the far end is not bare. Flagging the multiple for the physical-device pass, not as a defect.

---

## Reproducing

```bash
cd /home/dev/work/haynes-quest-0912-144456
pnpm exec vitest run tests/review/079-probes --reporter=verbose   # 25 checks, evidence on stdout
node tests/review/079-probes/geometry-audit.mjs                   # per-edge gaps/rises, strike overlaps
```

| probe file | covers |
|---|---|
| `authored-playground.probe.test.ts` | F2, F3, F4, F5, F6 |
| `authored-traversal.probe.test.ts` | real-physics main path + branch traversal, route length |
| `compat-and-besties.probe.test.ts` | F7, F8, encounter binding, archived plans, Besties translation |
| `checkpoint-and-scene.probe.test.ts` | checkpoint arming, reload fallback, scenery budget |
| `driver-controls.probe.test.tsx` | F1 |
| `geometry-audit.mjs` | per-edge geometry and strike/hazard overlap audit |

The probes are review evidence, not proposed production tests: several assert current behaviour that the
lead may choose to change, and their titles say so.

## Out of scope for this review

No production file, document, fixture or deployment was touched; nothing was merged. The guide not yet
matching the new layouts is the known pending task named in WO079 and is not reported as a finding. UX, copy
and the physical-device/creative inspection remain the lead's.

---

## Status against the lead's later checkpoint `629c21e`

The lead advanced past the reviewed candidate while this review ran. The findings above are stated against
`f2bfe36` as the work order requires; this section records what I **re-verified** by running the same probe
suite unchanged in a throwaway worktree at `629c21e` (19 passed, 6 failed — every failure is a probe asserting
a defect that has since been fixed). That worktree has been removed.

| finding | status at `629c21e` | evidence |
|---|---|---|
| **F1** driver cannot jump | **fixed** | `authored-browser-driver.mjs` now has `jumpToward()` issuing a real world tap beside the held joystick (`:136-166`) plus a keyboard `Space` variant (`:223-236`). The `getByRole("button", { name: "Jump" })` dependency is gone; my probe fails on its own source assertion. |
| **F2** residents in strike range | **fixed** | `5b2a3cd` moved garden `friendly-2` to (-4.5, 0, -59.5) and party `friendly-3` to (-5.3, 0, -85.6). The live-`EnemySimulation` probe records no contact at either anchor. |
| **F3** safe-content rule too loose | **fixed** | `98a699a` switches `protectedBeforeBoss` to `encounterStrikeEnvelope()` and renames the issue to `Safe content anchor is within an encounter strike envelope`. My "0.05 m outside the arena" mutation is now rejected. |
| **F6** no arena-vs-arena check | **fixed** | `98a699a` adds `rectanglesHaveInteriorOverlap` and the `arena.overlap` code. |
| **F5** platform-granular ordering | **downgraded, residual** | `mainIndex.get(anchor.platformId)` still gives every anchor on a platform one index, so relative order along the route within a platform is unvalidated. But the strengthened clearance rules now cover the space directly behind a fight: I could not construct a misordered-but-valid placement at `629c21e` (both the "attack tool behind ordinary-1" and "ordinary-2 ahead of ordinary-1 on `picnic`" mutations are now rejected by `clearance.encounter`). Worth closing in code, no longer a reachable authoring hazard in these layouts. |
| **F4** route-blocking static sweeper | **still open** | The probe still passes at `629c21e`: a sweeper with neither `motion` nor `rotation` laid across the sole landing of a required jump validates with zero issues, and the real controller never reaches `winding-east`. |
| **F7** catalog version boundary | unchanged | |
| **F8** Besties disengage box | unchanged | |
| **F9** `inspectLevel` deep clone | unchanged | |

Everything in "Verified — no defect found" still holds at `629c21e` with identical numbers (traversal 117.4 m /
29.4 s / 14 jumps and 134.2 m / 33.5 s / 16 jumps at zero recoveries; all 16 checkpoints re-arm in one frame;
the reload-fallback table is unchanged; the Besties hazard envelope is unchanged; encounter binding and
archived-plan behaviour are unchanged). Only the raw grass candidate counts shift slightly (4837 / 6267) because
the resident anchors moved.

**Remaining for the lead from this review: F4, and optionally F5, F7, F8, F9.**


## Lead adjudication after review

The original report above is preserved from review commit `9d5f576` and draft evidence PR #40. Its defect-asserting probes remain on that review branch; they are not imported as production regression tests. The final release must use the later root checks and the following decisions.

- F1, F2, F3 and F6 have verified fixes as the reviewer records. The root browser route uses normal keyboard movement/jumps and real touch combat; the separate touch diagnostic covers held-stick/world-tap input. Do not describe the long route as uninterrupted touch traversal.
- F4 identifies a real missing forgiving-landing constraint, but its claim that the example is unfinishable is unsupported. The review probe uses `moveY: -1` with `cameraYaw: 0`, moving away from the destination, and restricts jumps to grounded frames. Correct-direction `stepObby` checks at 30/60/120 Hz show that the modified level remains traversable from a roughly 0.4m late-edge/coyote takeoff band; a normal inset takeoff fails. That precision requirement is unsuitable for the daughter design. The bounded shared-lane entry/exit guard is integrated as `cfaddf4`: the exact mutant is rejected at `$.connections[4]`, while both shipped documents validate. Its 19 focused cases cover motion envelopes, alternate lanes and vertical boundaries; the full native suite passes 442 tests with 10 Postgres cases reserved for CI. It is not a general reachability solver.
- F5 is an explicitly retained v1 limitation: main-path platform ordering is checked, while relative ordering of two points on one platform requires placement review and actual play. The real courses put the attack tool on the welcome platform and the shield before the first fight; stricter strike clearance protects those pickups. No global Z ordering is introduced into a document format that supports turns and branches.
- F7 is accepted without expanding this pass: v4 deliberately versions roster cardinality and route selection while reusing identical art entries. Legacy v2 plans still use their original route/cardinality contract and parse correctly. A future catalog with different same-ID definitions must introduce version-aware lookup before publishing that change.
- F8 is an intentional retreat option for a young player. Retreat clears the local Besties routine without restoring server-side boss HP. The later activation fix also starts the routine whenever the wand can reach a visible actor, so the entry cannot present an inert hittable boss.
- F9 remains a bounded read-only diagnostic cost. The defensive clone prevents inspection callers from mutating the resolved document and does not run in the render loop. Revisit if inspection becomes frequent.

The measured traversal floor and software-browser completion times are retained as engineering evidence. Neither proves five-to-eight-minute child pacing, enjoyable difficulty or physical iPhone frame rate. Those require the family playtest.
