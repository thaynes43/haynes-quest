# Work order 111: Era casts and themed kits (art lead)

- **Status:** In progress (started September 26, 2026, after Tom locked DESIGN-026)
- **Model / dispatch:** A separate Codex session on **GPT-6 Astra** (`gpt-6-astra`, effort `max`) started by the PLAN-019 Claude coordinator through `agent-run`. Within this lane it is the **driving Astra**:
  - it alone generates concept images, one at a time, with its built-in image tool;
  - every Blender task goes to a fresh native Astra subagent (`model: "gpt-6-astra"`, `reasoning_effort: "max"`, `fork_turns: "none"`), one exclusive scene lease at a time, per [TEAM.md](../TEAM.md);
  - never route Blender to Sol.
  - **Update, September 26:** Codex hit its usage limit (reset September 30) after delivering Clubhouse Bully Cat v001 (PR85), the Honk Bus v001 model and concepts for the gadget helper and the veggie. Tom clarified that the Astra rule only meant Astra over Sol. The remaining roster continues with Claude Opus 5.5 Blender authors under the PLAN-019 coordinator.
- **Required reading:**
  - `AGENTS.md` and [TEAM.md](../TEAM.md);
  - [DESIGN-026](../../docs/designs/026-personal-era-casts.md), the **locked** roster;
  - [PRD-004](../../docs/prds/004-family-release.md) Q-03 on unreviewed candidates in the family release;
  - DESIGN-002, DESIGN-005, DESIGN-007 and DESIGN-008;
  - [PROCESS.md, asset catalog](../../docs/PROCESS.md#asset-catalog-must-stay-current), the art brief `docs/assets/art-direction.md` and the review template;
  - WO099–WO105, the Rat Casino cast precedents, and their scripts under `scripts/assets/<asset>/v001/`;
  - `src/game/enemy-animation.ts` and `src/game/scene-catalog.ts`.
- **Worktrees:** the one `agent-run` creates. Use a fresh `agent/<slug>` branch from `origin/main` per delivery PR.
- **Owned paths and resources:**
  - `docs/assets/**` for new ids and the catalog, plus `scripts/assets/<new ids>/**` and `scripts/assets/catalog-inventory.json`;
  - the hard-coded catalog counts in `tests/game/playtest-artwork-contract.test.ts` and `tests/e2e/visual-catalog.mjs`;
  - the DESIGN-005 roster section, and `.agents/evidence/era-cast-deliveries.json` (new);
  - the Blender service (one exclusive lease at a time), the audio service if used, and `/home/dev/artifacts/haynes-quest/family-eras/**`.
- **Not owned** (the coordinator integrates these): `src/**` runtime code, parody catalog versions, the theme-kit registry, levels and world templates.

## Outcome and scope

Produce original-parody candidates for Tom's locked era casts and matching themed prop kits, in priority order. Every delivery is its own small PR carrying its full catalog update. Those PRs merge on green checks, since this repo has no required checks: wait for `gh pr checks <n> --watch` to pass before `gh pr merge --squash`.

Per PRD-004 Q-03, candidates may be used in the children's levels before Tom reviews them. Label each review page and catalog card **"Awaiting Tom's review · used in the family release"**. Tom's exact-version decision stays open.

**Public repository.** Never include family names, birthdays, photos or likenesses. Characters are original parodies: recognizable silhouette and humor cues, with no copied names, logos, faces, costumes or audio. Per Tom's September 26 ruling (DESIGN-027), characters may be genuinely creepy where the era calls for it (the radio showman's too-wide grin, glowing eyes and static; glowing animatronic eyes). There is still no gore.

## Locked roster and asset ids

| Pri | World · ch | Asset id | Role / kind | Brief |
| --- | --- | --- | --- | --- |
| 1 | A·1 (0–2) | `clubhouse-bully-cat` | boss | Big blustery cartoon-cat captain bully with a peg-leg swagger, in a classic rubber-hose toon style; comic, not scary |
| 1 | B·1 (0–2) | `honk-bus` | boss | A big cheerful-grumpy toddler-show school bus with a giant grin and honking horn, a nursery-rhyme vibe |
| 2 | A·1 | `gadget-helper` | ordinary (serves a and b) | A runaway floating toolbox-helper gadget with a silly arm contraption |
| 2 | B·1 | `yes-yes-veggie` | ordinary (a and b) | A bouncing cartoon vegetable (broccoli or pea-pod) with a stubborn "no!" face |
| 3 | A·1 kit | `toon-clubhouse-kit` | props | 3–5 static props: a mouse-ear-free original clubhouse tower facade, a curly slide, a gadget toolbox stand, rounded hedges, a hot-dog-dance stage marker |
| 3 | B·1 kit | `playroom-kit` | props | 3–4 static props: stacking-block tower, a toy bus garage, crib-rail fence and a giant plush ball. The existing skyline toybox kit may be reused and extended |
| 4 | A·2 (2–5) | `rival-mayor` | boss | A scheming, mustached rival-town mayor in a tall hat and sash, with a remote-control contraption |
| 4 | A·2 | `mischief-kitten` | ordinary (a and b) | His mischievous kitten crew: one small, bouncy, pouncing kitten model |
| 4 | B·2 (2–4) | `magic-house` | boss | A magical living house with shutters for eyes, a door mouth and dancing tiles, in a warm colorful casita style |
| 4 | B·2 | `bin-chicken` | ordinary (a and b) | A cheeky long-beaked ibis ("bin chicken") that raids bins |
| 5 | A·2 kit | `rescue-harbor-kit` | props | Rescue lookout tower facade, pier bollards, a rescue buoy stand, a small boat |
| 5 | B·2 kit | `casita-kit` | props | Colorful house terrace pieces, flower planters, a patterned door, a candle-and-butterfly arch |
| 6 | A·3 (5–9) | `inator-monster` | boss | A giant rubber-suit monster (a single model) with the evil scientist riding a cockpit on its back, holding an "-inator" remote |
| 6 | A·3 | `putty-grunt` | ordinary-a | A goofy clay putty foot-soldier |
| 6 | B·3 (4–6) | `demon-band-idol` | ordinary (a and b) | A sparkly demon boy-band idol with a microphone and horned hair. Glam; per DESIGN-027 it may be creepier in a later revision |
| 7 | A·3 kit | `rooftop-city-kit` | props | Water tower, rooftop AC units, a crane hook and a billboard frame. The skyline toybox kit may inform it |
| 7 | A·3 | `lab-robot` | ordinary-b | A runaway lab robot |
| 8 | A·4 (9–11) | `radio-host-showman` | bonus (ordinary) | A dapper vintage radio-host showman with a microphone cane and a huge grin |
| 8 | A·3 | `web-slinger-helper` | friendly | An original masked, web-slinging kid hero helper (friendly-character rules, DESIGN-013) |

Existing casts cover the rest: Rat Casino for A·4, and the Besties plus remix entries for B·3.

**Order.** Work in priority order: concepts for each priority row, then its Blender models. While a Blender author holds the scene, the driving Astra may concept the next row. Keep going through as much of the list as capacity allows; ship each asset as soon as it passes.

## Authoring contract

- **Characters** follow the WO099 contract:
  - Y-up and forward −Z, with a floor-centered root and no root motion;
  - ≤ 15k triangles, ≤ 2 materials, one ≤ 1024 embedded atlas, and ≤ 2 MiB self-contained GLB (no Draco or meshopt);
  - one skin with ≤ 4 influences per vertex;
  - exactly the clips `idle`, `move`, `attack`, `hit` and `defeat`. Attack is about 2.0 s with contact near 1.25 s; defeat ends in a held funny pose. Record the actual contact time.
  - Bosses are about 2–3 m tall and ordinaries about 0.8–1.4 m. The honk bus and magic house may be wider; record their bounds.
- **Friendly characters** also follow DESIGN-013's clip needs.
- **Props:** static, ≤ 5k triangles, ≤ 4 materials, ≤ 1.5 MiB, floor-centered. Record a tight bounding box in the handoff; the theme-kit registry needs it.
- **Evidence per asset** (as in WO099–104):
  - the `.blend` master and scripts;
  - the exact GLB and matched stills;
  - a motion sheet;
  - Khronos validation with zero errors and zero warnings;
  - the Three.js adapter check;
  - a Chromium viewer check;
  - a SHA-256 manifest;
  - a scene release.
- **Durable copies:** keep them under `/home/dev/artifacts/haynes-quest/family-eras/<asset>/<version>/`.

## Delivery PR checklist (each asset or kit)

1. Put the media in `docs/assets/media/<id>/v001/`: the concept, `prompt.txt`, `source.json`, the GLB, stills and evidence JSON.
2. Write the review page `docs/assets/reviews/<id>/v001.md` with the concept-vs-render figure, a `<model-viewer>` with clips, downloads and checksums, provenance and the **Awaiting Tom's review · used in the family release** status.
3. Add the entry to `scripts/assets/catalog-inventory.json` with `gameplay_use: "private-candidate"`, and update its counts.
4. Run `node scripts/assets/catalog-thumbnails.mjs`, then add the catalog card in `docs/assets/catalog.md` under a new **Family eras** section, grouped by world and chapter.
5. Bump the hard-coded counts in the two test files.
6. Run the strict docs build and `node tests/e2e/visual-catalog.mjs` against the local preview, plus `pnpm test`.
7. Append a record to `.agents/evidence/era-cast-deliveries.json`:

   ```json
   {
     "assetId": "...",
     "version": "v001",
     "role": "...",
     "world": "A|B",
     "chapter": 1,
     "glb": "docs/assets/media/...",
     "sha256": "...",
     "heightM": 0,
     "bounds": {},
     "attackContactS": 0,
     "clips": [],
     "prMerged": "<sha>"
   }
   ```

   Props also record per-prop `bbox` values. The coordinator integrates from this file.
8. Open the PR, wait for green checks, then squash-merge.

## Handoff and recovery

After each delivery, update this work order's status table below with the asset, PR and SHA. On a usage limit or tool failure: save the partial work and scene checkpoint, release the scene, record the exact error here, and stop cleanly. Do not downgrade the Blender model.

## Delivery status

`clubhouse-bully-cat/v001` merged in PR85 and `honk-bus/v001` in PR89. Codex then reached its usage limit. A Claude Opus 5.5 Blender author built `gadget-helper/v001` from its Astra concept and released the Blender scene at `2026-09-26T04:30:53.639331+00:00` (merged in PR93). Another Claude Opus 5.5 author built `rival-mayor/v001` from a coordinator-approved Blender reference sheet (PRD-004 Q-07) on `blender-authoring-2` and released that scene at `2026-09-26T15:00:25.390761+00:00` (merged in PR96). A third Claude Opus 5.5 author built `yes-yes-veggie/v001` from its Astra concept on the primary service and released that scene at `2026-09-26T14:47:26.336971+00:00` (merged in PR98). An earlier Opus 5.5 veggie run had stopped after a static checkpoint without releasing its lease or leaving an error; the delivering author recorded the takeover in the veggie's scene lease and preserved that checkpoint. A fourth author built `magic-house/v001` from a coordinator-approved Blender reference sheet on `blender-authoring-2` and released that scene at `2026-09-26T15:51:36.783303+00:00` (merged in PR99). A fifth author built `mischief-kitten/v001` from a coordinator-approved Blender reference sheet on `blender-authoring-2` and released that scene at `2026-09-26T16:28:06.825536+00:00` (merged in PR105). A sixth author built `bin-chicken/v001` from a coordinator-approved Blender reference sheet on `blender-authoring-2` and released that scene at `2026-09-26T17:04:51.022420+00:00` (merged in PR108); it filed the runtime skinned-mesh culling gap it measured as [issue 103](https://github.com/thaynes43/haynes-quest/issues/103) for the coordinator. A seventh author built `inator-monster/v001` from a coordinator-approved Blender reference sheet on `blender-authoring-2` and released that scene at `2026-09-26T18:52:00.346687+00:00` (merged in PR112). An eighth author built `demon-band-idol/v001` from a coordinator-approved Blender reference sheet on `blender-authoring-2` and released that scene at `2026-09-26T19:41:42.760703+00:00` (merged in PR114). A ninth author built the five `toon-clubhouse-kit/v001` props from the Astra concept draft on the primary service and released that scene at `2026-09-26T20:04:57.937358+00:00`; its intake also wired the props into the clubhouse theme kit (merged in PR116). A tenth author built `putty-grunt/v001` from a coordinator-approved Blender reference sheet on `blender-authoring-2`; its first session stopped at a usage limit after a geometry checkpoint without releasing the lease, and a second session of the same task recorded the takeover in the scene lease, finished the model and released that scene at `2026-09-26T21:23:53.210834+00:00` (merged in PR117). An eleventh author built `radio-host-showman/v001` on the primary service: its reference sheet (17:45–18:08 UTC) and, after the coordinator approved the sheet and revised the model notes under Tom's DESIGN-027 ruling, the creepier full model, whose scene it released at `2026-09-26T22:43:30.044547+00:00` (merged in PR121). A twelfth author built `lab-robot/v001` on the primary service: its reference sheet (18:12–18:36 UTC) and, after the coordinator approved the sheet with spooky-level-1 model notes under DESIGN-027, the full model, whose scene it released at `2026-09-26T23:30:56.513530+00:00`. Claude Opus 5.5 completed all twelve catalog intakes without changing the models. Selected concepts, self-contained briefs and durable artifacts are under `/home/dev/artifacts/haynes-quest/family-eras/`. The [delivery log](../evidence/era-cast-deliveries.json) supplies exact bounds, clips and hashes for coordinator integration. A delivery records its own merge receipt in the next checked status update; pending fields are not a deployment claim.

| Asset | Concept | Model | PR / SHA | Notes |
| --- | --- | --- | --- | --- |
| `clubhouse-bully-cat/v001` | Selected; durable concept and source record saved | Completed; lead intake and exact checks pass | [PR85](https://github.com/thaynes43/haynes-quest/pull/85) · merged `dd8b86a` | 2.5 m, 14,492 triangles, 1.25 s contact. Scene released; 86 matching artifact hashes. Catalog publication pending. |
| `honk-bus/v001` | Selected; durable concept and source record saved | Completed; lead intake and exact checks pass | [PR89](https://github.com/thaynes43/haynes-quest/pull/89) · merged `dd14ff2` | 2.097 m wide × 2.3 m tall × 2.465 m long (2.541 m with the horn raised), 14,642 triangles, 1.25 s contact. Scene released; 96 matching artifact hashes; Three.js adapter check rerun at intake. Catalog publication pending. |
| `gadget-helper/v001` | Selected; durable concept and source record saved | Completed by a Claude Opus 5.5 Blender author; lead intake and exact checks pass | [PR93](https://github.com/thaynes43/haynes-quest/pull/93) · merged `0fdf3bc` | 1.586 m wide × 1.118 m tall × 0.538 m deep, hovering 0.100 m at rest; 14,574 triangles, 1.25 s contact. Wrench arm on the left per the concept's front/back views. Scene released; 103 matching artifact hashes; Three.js adapter check rerun at intake. Catalog publication pending. |
| `yes-yes-veggie/v001` | Selected after one background/framing correction; original and revised concepts preserved | Completed by a Claude Opus 5.5 Blender author; lead intake and exact checks pass | [PR98](https://github.com/thaynes43/haynes-quest/pull/98) · merged `e9c98c8` | 0.747 m wide × 0.998 m tall × 0.542 m deep, feet on the floor; 14,354 triangles, 1.25 s contact. Rebuilt from a stopped run's static checkpoint, which is preserved. Baked soft occlusion ships as vertex colours. Scene released; 118 matching artifact hashes; Three.js adapter check rerun at intake. Catalog publication pending. |
| `rival-mayor/v001` | Blender reference sheet, no generated concept; coordinator approved September 26 | Completed by a Claude Opus 5.5 Blender author on `blender-authoring-2`; coordinator intake and exact checks pass | [PR96](https://github.com/thaynes43/haynes-quest/pull/96) · merged `f5b27b9` | 2.4745 m to the hat top, 14,548 triangles, 28 joints, 1.25 s contact. Mustache enlarged 12% per the sheet note. Scene released; 125 matching artifact hashes; Three.js adapter check rerun at intake. Catalog publication pending. |
| `magic-house/v001` | Blender reference sheet, no generated concept; coordinator approved September 26 | Completed by a Claude Opus 5.5 Blender author on `blender-authoring-2`; coordinator intake and exact checks pass | [PR99](https://github.com/thaynes43/haynes-quest/pull/99) · merged `b71b630` | 2.51 m wide × 2.898 m tall to the hopping ridge tile (2.80 m solid) × 1.98 m deep; thrown tiles reach 2.10 m in front. 12,122 triangles, 32 joints, 1.25 s contact. Shimmy/hop tile-throw attack and sheepish-slump defeat per the sheet notes. Scene released; 129 matching artifact hashes; Three.js adapter check rerun at intake. Catalog publication pending. |
| `mischief-kitten/v001` | Blender reference sheet, no generated concept; coordinator approved September 26 | Completed by a Claude Opus 5.5 Blender author on `blender-authoring-2`; coordinator intake and exact checks pass | [PR105](https://github.com/thaynes43/haynes-quest/pull/105) · merged `cfd4bbd` | 0.726 m wide × 0.919 m tall to the hat top × 0.928 m deep, paws 3 mm above the floor; 14,174 triangles, 32 joints, 1.25 s contact. Wiggle-and-pounce attack and dizzy seated defeat; idle starts in the sheet tiptoe. Scene released; 143 matching artifact hashes; Three.js adapter check rerun at intake. Catalog publication pending. |
| `bin-chicken/v001` | Blender reference sheet, no generated concept; coordinator approved September 26 | Completed by a Claude Opus 5.5 Blender author on `blender-authoring-2`; coordinator intake and exact checks pass | [PR108](https://github.com/thaynes43/haynes-quest/pull/108) · merged `5afce0b` | 0.425 m wide × 1.257 m tall to the banana-peel stem tip × 1.006 m deep, soles 1.7 mm above the floor; 11,196 triangles, 29 joints, 1.25 s contact. Legs thickened to 0.044–0.050 m with 0.07 m knee knobs per the sheet note; rear-back-and-beak-jab attack; the defeat drops the chip and flops belly-down. Runtime culling gap filed as [issue 103](https://github.com/thaynes43/haynes-quest/issues/103). Scene released; 146 matching artifact hashes; Three.js adapter check rerun at intake. Catalog publication pending. |
| `inator-monster/v001` | Blender reference sheet, no generated concept; coordinator approved September 26 | Completed by a Claude Opus 5.5 Blender author on `blender-authoring-2`; coordinator intake and exact checks pass | [PR112](https://github.com/thaynes43/haynes-quest/pull/112) · merged `9666be5` | 1.675 m wide × 3.217 m tall to the antenna ball (monster mass 2.49 m, dome top 2.82 m) × 3.181 m deep including the floor-resting tail; 14,575 triangles (375 of them glass), 41 joints for the monster and pilot in one skin, 1.25 s contact. Opaque atlas plus alpha-blended bubble glass; the pilot stays visible from all six chase-camera angles at rest. Stomp-and-roar attack while the scientist jabs the remote; the defeat slumps and pops the dome open, held. The popped dome leaves its idle culling sphere by up to 1.05 m (issue 103). Scene released; 157 matching artifact hashes; Three.js adapter check rerun at intake. Catalog publication pending. |
| `demon-band-idol/v001` | Blender reference sheet, no generated concept; coordinator approved September 26 | Completed by a Claude Opus 5.5 Blender author on `blender-authoring-2`; coordinator intake and exact checks pass | [PR114](https://github.com/thaynes43/haynes-quest/pull/114) · merged `2200272` | 1.401 m tall to the horn tips in the sheet pose at idle 0 s (1.396 m in the neutral bind pose, whose A-pose arms make it 0.976 m wide; the sheet pose is about 0.66 m wide) × 0.522 m deep, soles 3 mm above the floor; 12,308 triangles, 36 joints, 1.25 s contact. Mic-spin attack with a sparkle burst that opens round the grille (model geometry, opened by bone scale); dramatic dizzy bow, held. Heart-tipped tail thickened 20% per the sheet note. The burst leaves its idle culling sphere by only 0.077 m (issue 103). Scene released; 174 matching artifact hashes; Three.js adapter check rerun at intake. Catalog publication pending. |
| `toon-clubhouse-kit/v001` | Astra concept draft (generated); its requested background revision was never produced | Five static props completed by a Claude Opus 5.5 Blender author on the primary service; coordinator intake and exact checks pass | [PR116](https://github.com/thaynes43/haynes-quest/pull/116) · merged `92d425e` | Tower facade 4.285 × 6.36 × 1.198 m, curly slide 2.364 × 3.19 × 2.375 m, gadget toolbox stand 1.19 × 1.016 × 0.859 m, rounded hedges 2.16 × 1.146 × 1.007 m, dance stage marker 1.78 × 0.262 × 0.90 m; 16,662 triangles in all, vertex colour only, front +Z. Registered in `src/shared/theme-kits.ts` with exact GLBs and tightened measured bounds; World A chapter 1 places all but the marker. Scene released; 98 matching artifact hashes; Three.js adapter check rerun at intake against the tightened registry. Catalog publication pending. |
| `putty-grunt/v001` | Blender reference sheet, no generated concept; coordinator approved September 26 | Completed by a Claude Opus 5.5 Blender author on `blender-authoring-2` (two sessions under one lease); coordinator intake and exact checks pass | [PR117](https://github.com/thaynes43/haynes-quest/pull/117) · merged `010f374` | 0.796 m wide × 1.379 m tall to the antenna ball × 0.543 m deep in the sheet guard at idle 0 s (1.4005 m tall in the A-pose bind pose, which is 1.181 m wide), soles 3 mm above the floor; 14,528 triangles, 27 joints, 1.25 s contact. Eyes 12% larger and a warmer gold buckle per the sheet note; clumsy double-fist swing attack; the defeat melts into a held clay puddle with the eyes, belt ring and antenna sticking up. Squash and stretch are glTF scale channels. The melting eyes leave their idle culling sphere by up to 0.40 m (issue 103). Scene released; 157 matching artifact hashes; Three.js adapter check rerun at intake. Catalog publication pending. |
| `radio-host-showman/v001` | Blender reference sheet, no generated concept; coordinator approved September 26, model notes revised after DESIGN-027 | Completed by a Claude Opus 5.5 Blender author on the primary service; coordinator intake and exact checks pass | [PR121](https://github.com/thaynes43/haynes-quest/pull/121) · merged `45fcc4f` | 2.003 m tall to the tufts and halo in the bind pose (1.108 m wide × 0.519 m deep); 1.181 m wide × 2.001 m tall × 0.447 m deep in the sheet pose at idle 0 s; soles and cane tip 1.9 mm above the floor; 10,900 triangles (1,016 glowing), 28 joints, 1.25 s contact. Creepier than the sheet per DESIGN-027: a 17% wider sharp-toothed grin, hollow sockets, red irises and on-air bulb that glow in the dark, a faint static halo. Overhead mic-cane sweep with a radio-static starburst at contact; jerky stepped bow frozen mid-grin, held. Taller than the WO111 ordinary band, per his own ~2 m brief (coordinator sizing call). The glowing part leaves its idle culling sphere by up to 0.95 m in the attack and 0.33 m in the held bow (issue 103). Scene released; 180 matching artifact hashes; Three.js adapter check rerun at intake. Catalog publication pending. |
| `lab-robot/v001` | Blender reference sheet, no generated concept; coordinator approved September 26 with spooky-level-1 model notes under DESIGN-027 | Completed by a Claude Opus 5.5 Blender author on the primary service; coordinator intake and exact checks pass | [PR124](https://github.com/thaynes43/haynes-quest/pull/124) | 1.2919 m tall to the warning-light cage; 0.894 m wide × 1.292 m tall × 1.086 m deep in the sheet pose at idle 0 s (1.199 m wide × 0.896 m deep in the A-pose bind pose); tread lugs 0.3 mm above the floor; 13,420 triangles (516 glowing), 46 joints, 1.25 s contact. Red pupil core and attack target glare glow in the dark for Hero City's scare level 1; the warning light spins, then a slinky-arm pincer lunge snaps shut 0.88 m in front; the defeat bonks its own self-destruct button, sparks, pops the dome lid and slumps smoking, held. The sparks leave the glow part's idle culling sphere by up to 0.55 m and the popped lid's warning light stays 0.37 m out in the held pose (issue 103). Scene released; 179 matching artifact hashes; Three.js adapter check rerun at intake. Catalog publication pending. |


## Playroom kit production delivery · September 29, 2026

Fresh `gpt-6-astra` / `max` author on branch `agent/hq-playroom-kit`, from `1267904`, used only Blender instance 1. The coordinator approved the retained sheet on September 29 and then passed the exact four-model kit preview. The [v001 review](../../docs/assets/reviews/playroom-kit/v001.md) includes separate exact-GLB viewers, reference comparison, 20 browser stills, a static contact sheet, downloads and checksums. Tom's exact-version decision remains pending under PRD-004 Q-03.

The four `playroom` registry ids are pinned to exact GLBs with all planning boxes unchanged. Existing B1 v4 templates place 30 towers, one garage, four fence panels and 15 plush balls; no template or personal-media file was edited. Each model is static, 4,344–4,904 triangles, 1–2 materials and 106,928–121,300 bytes. Khronos reports zero errors, warnings, infos and hints on all four. Blender reimport, all 32 Three.js adapter placements, Chromium captures and targeted placement/fallback regressions pass. Inventory now has 93 entries, 64 models (62 completed plus two partial), and 132 thumbnails.

Instance 1 released at `2026-09-29T03:30:25.120846+00:00`; prior Web-slinger Helper source hash unchanged. Editable master: `/workspace/haynes-quest/family-eras/playroom-kit/v001/playroom-kit.blend`, SHA-256 `e187a58013120e93268895951bac1ec252e1e38d6c72ff7ad1aa867a9928f7ce`. Mirrored sources/evidence: `/home/dev/artifacts/haynes-quest/family-eras/playroom-kit/v001/`. Earlier sheet sources and checkpoints remain in `sheet-stage/`. The [delivery record](../evidence/era-cast-deliveries.json) contains per-prop bounds and exact hashes. The coordinator owns PR review/merge and deployment; publication is pending until its release receipt is recorded.

[PR131](https://github.com/thaynes43/haynes-quest/pull/131), implementation commit `c1954fe`, is rebased onto `a540ad7`. Its full CI suite passes; local typecheck, lint, production build, strict docs/media links and 47 focused tests pass. The complete 900-second-budget catalog audit finishes successfully: 93 entries, 132 thumbnails, 68 review pages, 64 exact model deliveries and 38 animated candidate viewer checks; zero page, console, HTTP, request or external errors. All 32 runtime placements were rechecked against the rebased scene code. The [final verification record](../../docs/assets/media/playroom-kit/v001/final-verification.json) distinguishes the SIGTERM-interrupted local full-suite attempt from the successful CI suite. No further browser run is pending. Coordinator owns merge and deployment; owner exact-version review and physical Safari remain pending.
