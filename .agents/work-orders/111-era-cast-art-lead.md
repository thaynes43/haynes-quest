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

**Public repository.** Never include family names, birthdays, photos or likenesses. Characters are original parodies: recognizable silhouette and humor cues, with no copied names, logos, faces, costumes or audio. Keep everything kid-safe; for the Hazbin-inspired host, keep only a clean dapper radio-showman hook.

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
| 6 | B·3 (4–6) | `demon-band-idol` | ordinary (a and b) | A clean, sparkly demon boy-band idol with a microphone and horned hair, glam and not scary |
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

`clubhouse-bully-cat/v001` merged in PR85 and `honk-bus/v001` in PR89. Codex then reached its usage limit. A Claude Opus 5.5 Blender author built `gadget-helper/v001` from its Astra concept and released the Blender scene at `2026-09-26T04:30:53.639331+00:00`; no author holds the scene. Claude Opus 5.5 completed its catalog intake without changing the model. Selected concepts, self-contained briefs and durable artifacts are under `/home/dev/artifacts/haynes-quest/family-eras/`. The [delivery log](../evidence/era-cast-deliveries.json) supplies exact bounds, clips and hashes for coordinator integration. A delivery records its own merge receipt in the next checked status update; pending fields are not a deployment claim.

| Asset | Concept | Model | PR / SHA | Notes |
| --- | --- | --- | --- | --- |
| `clubhouse-bully-cat/v001` | Selected; durable concept and source record saved | Completed; lead intake and exact checks pass | [PR85](https://github.com/thaynes43/haynes-quest/pull/85) · merged `dd8b86a` | 2.5 m, 14,492 triangles, 1.25 s contact. Scene released; 86 matching artifact hashes. Catalog publication pending. |
| `honk-bus/v001` | Selected; durable concept and source record saved | Completed; lead intake and exact checks pass | [PR89](https://github.com/thaynes43/haynes-quest/pull/89) · merged `dd14ff2` | 2.097 m wide × 2.3 m tall × 2.465 m long (2.541 m with the horn raised), 14,642 triangles, 1.25 s contact. Scene released; 96 matching artifact hashes; Three.js adapter check rerun at intake. Catalog publication pending. |
| `gadget-helper/v001` | Selected; durable concept and source record saved | Completed by a Claude Opus 5.5 Blender author; lead intake and exact checks pass | Pending | 1.586 m wide × 1.118 m tall × 0.538 m deep, hovering 0.100 m at rest; 14,574 triangles, 1.25 s contact. Wrench arm on the left per the concept's front/back views. Scene released; 103 matching artifact hashes; Three.js adapter check rerun at intake. Catalog publication pending. |
| `yes-yes-veggie/v001` | Selected after one background/framing correction | Waiting for priority 1 | Pending | Original and revised concepts preserved; broad crown forms, leaf mittens and stubborn expression. |
