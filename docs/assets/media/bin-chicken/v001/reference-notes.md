# bin-chicken v001 · reference notes

**Source:** Blender reference sheet, no generated concept.
**Status:** Sheet ready for coordinator review before any detailing, rigging or GLB work. Tom's exact-version review is still open. Once modeled, the candidate carries "Awaiting Tom's review · used in the family release" (PRD-004 Q-03).
**Role:** WO111 priority 4, World B chapter 2 ordinary enemy (ages 2–4 era), serving variants a and b, from the locked DESIGN-026 roster. The chapter boss is `magic-house`.
**Files:** `reference-sheet.png` (2048 × 1024) and `bin-chicken-blockout.blend` (the blockout master at the origin). `bin-chicken-reference-sheet.blend` holds the same master plus the sheet scene. Close-up renders are in `preview/`, the scripts are in `source/`, and per-part bounds are in `part-measurements.json`.

## Design intent

A cheeky, goofy Australian white ibis, the "bin chicken", caught in the act. It has clearly just raided a bin and a chip shop. A banana peel sits on its head like a hat, and one stolen hot chip hangs crosswise in its beak. It hides a paper cone of more chips behind its back, clasped in its crossed black wing tips, while it tiptoes forward with a "who, me?" face. The age band is 2–4, so it reads as silly first and naughty second. It has big round googly eyes, a pink grin, knobbly stilt legs and big floppy feet. It has no teeth, claws, weapons or angry face.

Silhouette, from top to bottom:

1. **Banana-peel hat:** a yellow stem and cap on the crown, with three long flaps drooping over the sides and back of the head and one short flap behind. The face stays clear. The stem tip is the highest point, at 1.25 m.
2. **Big bald black head** (0.24 m wide), turned about 17° toward its right and tilted about 7°. It has two big googly eyes that bulge above the head line: the right eye is wide open under a raised brow, the left is half-lidded, and both pupils glance to its right.
3. **Long down-curved beak**, about 0.3 m of it clear of the face, sweeping down to 0.84 m. A golden chip crosses it near the tip. The beak is the strongest "ibis" read in the side view.
4. **Bare black S-neck** rising out of a scruffy white feather ruff.
5. **Round grubby-white egg body** with its chest raised. The folded white wings lie along its sides with black tips. Beige bin-grime smudges mark the chest, belly and back.
6. **The loot behind its back:** the black wing tips cross over the tail like hands clasped behind the back. They hold a blue-and-white striped paper cone of chips tilted to its left, above a lacy black plume tail. This reads clearly in the side and back views and peeks over the shoulder in the front view.
7. **Stilt legs:** feathered white thighs, thin mauve legs with knobbly backward "knees", and big three-toed feet. The right foot is planted and the left is on tiptoe mid-sneak.

## Parody hooks

These are recognizable cues. None is a copied design.

| Hook | How it appears here |
| --- | --- |
| The "bin chicken" | The real Australian white ibis, famous for raiding bins and picnics. It has a white body, a bare black head and neck, a long down-curved black beak, black wing tips and lacy black plumes over the tail. The nickname and the bird are real-world, not anyone's character. |
| The era's backyard suburbs | DESIGN-026 sets World B chapter 2 in the 2019–2022 preschool era, whose inspiration is set in a Brisbane backyard suburb. Ibises are that setting's everyday pest. We use the bird and the suburb joke only: no dog family, no show characters, names, fonts, palette or locations. |
| Bin raider | A banana peel worn as a hat and beige grime smudges on the white feathers. |
| Chip thief | One hot chip in the beak and a whole cone of chips "hidden" behind its back. Stolen hot chips are the ibis's best-known crime. |
| "Who, me?" | Innocent tiptoe, a sideways glance, a half-lid and a raised brow, while the evidence sticks out of its beak. |

## What makes it original

- **No copied names, text, logos, faces or costumes.** The chip cone is plain blue-and-white stripes with no lettering or brand. The name stays generic ("bin chicken" is a common nickname for the bird).
- **Its own design.** The googly-eyed bald head, the banana-peel hat, the crosswise chip, the crossed-wing loot pose and the tiptoe are our choices, and none comes from a model sheet.
- **Its own palette,** from our storybook brief and the real bird, not from any show.
- **Kid-safe.** No teeth, claws, weapons or injuries. The grime is beige smudges, not stains that could read as blood, and the mischief is theft of chips. A red sauce smear was considered and left out for that reason.

## Colors (sRGB hex; flat painted blockout materials)

| Part | Hex |
| --- | --- |
| Feathers (body, wings, thighs, ruff) | `#f1f0ea` cool off-white |
| Bin-grime smudges and crumbs | `#c9bca6` |
| Bare head and neck, wing tips, plume tail, pupils, lid, brow, nostrils | `#2e2a38` plum-black |
| Beak | `#4c4657` graphite |
| Legs and feet | `#7d6c7a` mauve-grey |
| Gape grin | `#e3998d` dusty pink |
| Eye whites and highlights | `#fbf8f2` |
| Irises | `#a8683e` amber-brown |
| Banana peel outside, and inside | `#f2c94c`, `#f7e7b4` |
| Peel speckles, flap tips, stem tip | `#7a5634` |
| Chips (in the beak and the cone) | `#e7b451` |
| Chip-cone paper, and stripes | `#f6f0e2`, `#5d8fbf` |

## Proportions (measured from the blockout; metres, floor at 0)

- **Overall:** 1.254 m tall to the banana-peel stem tip, 1.183 m to the top of the head and the googly eyes (1.184 m). The bounding box is 0.42 m wide (X, wing to wing) × 0.99 m long (Y, plume tail to beak tip) × 1.25 m high. It sits in the 1.0–1.3 m brief.
- **Head:** a 0.24 × 0.26 × 0.22 m ellipsoid (unturned radii 0.118 × 0.13 × 0.108 m), centred at 1.075 m. It is about 17% of the total height, big for an ibis on purpose.
- **Eyes:** about 0.125 m wide × 0.147 m tall (right, 8% larger) and 0.116 × 0.136 m (left), centred at about 1.12 m, nearly touching in the middle. The iris is amber with a big plum-black pupil and two highlights. The left lid covers the top 40%.
- **Beak:** about 0.07 m thick where it leaves the face, tapering to a rounded tip 0.016 m across at (0.10, 0.58, 0.84) after the head turn. It spans 1.09 down to 0.83 m. The beak chip is 0.13 m long.
- **Neck:** 0.10 m thick, visible from the ruff (about 0.8 m) to the head (about 0.97 m).
- **Body:** an egg 0.38 m wide × 0.51 m long × 0.42 m tall, from 0.395 to 0.814 m, with the chest end raised about 14°.
- **Wings:** folded lathe shapes along the sides, 0.36 m long × 0.22 m tall, reaching ±0.21 m. The black tips cross over the tail at about 0.54–0.69 m.
- **Loot cone:** 0.18 m tall with a 0.13 m mouth, tilted toward its left, from 0.56 to 0.75 m. The chips stick up to 0.81 m.
- **Plume tail:** three lacy black drapes hanging from 0.59 to 0.36 m behind the tail.
- **Legs:** white thighs at 0.35–0.52 m, knees at about 0.2 m, and legs about 0.04 m thick. The front toes are 0.12–0.155 m long. The right foot is flat, and the left heel is lifted to 0.07 m.
- **Banana peel:** 0.31 m across its drooping side flaps. The flaps are up to 0.088 m wide, with the stem 0.07 m above the crown.

## Orientation and scale conventions

The blockout uses the WO111 authoring convention so the modeling author can keep it: Blender +Z up and the character facing Blender +Y, which becomes glTF +Y up / −Z forward on export. The root is floor-centred at the origin, and the character's right is +X. The head group hangs from one pivot empty, `Head turn pivot`, at the neck top (0, 0.165, 1.0 m), so the turn and tilt can be zeroed for a rest pose.

The sheet shows four linked-data copies of one master at exactly the same orthographic scale, rotated 180° (front), −90° (side, facing right), 0° (back) and −135° (three-quarter). The height marker has 5 cm ticks with labels every 25 cm, plus dashed guides. The frame is sized from the figure height (the figures fill about 45% of the sheet height).

## Notes for the later modeling author

These are suggestions only; the coordinator's review of this sheet decides.

- **Budget:** the blockout is about 69k triangles of primitives, lathes and sweeps, far over budget. The final model must meet the WO099 contract: ≤ 15k triangles, ≤ 2 materials, one ≤ 1024 atlas, one skin with ≤ 4 influences, ≤ 2 MiB GLB, and exactly the clips `idle`, `move`, `attack`, `hit` and `defeat`. An ordinary this size should come in well under the cap.
- **Paint rather than model the small details.** Grime smudges, peel speckles, the flap tips, the nostrils, the grin line and the cone stripes can all go into the atlas. Keep the eyes, beak, peel flaps, wing tips and chips as geometry, because they carry the silhouette.
- **Thin parts:** the legs (about 0.04 m thick) and the beak tip are thin. Keep them readable at gameplay distance, perhaps slightly thicker than the blockout, and keep the knee knobs.
- **Rig:** use a biped bird skeleton with a hip root, a 2–3 bone spine, a 4–5 bone neck chain, and a head bone with the peel and beak chip weighted rigidly to it (the beak could get its own bone for a peck-snap). Each leg needs thigh, shin, shank, foot and one toe bone. Each wing needs 2 bones, so the tips can hold the cone. Add a tail bone for the plumes, and parent the cone rigidly to one wing-tip bone.
- **Pose:** the head turn and tilt, the left-foot tiptoe and the crossed wing tips are design poses. Build the rest pose with the head straight, both feet flat and the wings folded, then recreate the sneaky look in `idle`.
- **Possible acting:**
  - `idle`: tiptoe shuffle, head bobs and side glances, and the chip in its beak wiggling.
  - `move`: a jerky, head-bobbing strut on stilt legs, with the peel flaps flopping.
  - `attack` (about 2.0 s): it rears back with its neck coiled and eyes squinting, then lunges with a long beak jab (a "chip snatch") at about 1.25 s contact and recovers with a smug gulp of the chip.
  - `hit`: feathers puff, the peel pops up off its head, and chips fly out of the cone.
  - `defeat`: it flops belly-down with its legs splayed and its neck draped along the floor. The peel slides over its eyes and the cone spills. The pose is held.

## Provenance

- **Authoring:** Claude Opus 5.5 (`claude-opus-5-5`) through the cluster Blender MCP service (Blender 4.5.13 LTS), under Tom's September 26 ruling. Opus continues WO111 Blender work after Codex's usage limit, and assets without an Astra concept are modeled from a painted Blender reference sheet that the coordinator reviews before detailing.
- **No image generation:** no image-generation model, external asset API, photo or third-party artwork was used. Every pixel comes from the procedural blockout rendered with Cycles on CPU (48 samples, denoised), with Freestyle plum-ink outlines and a Standard view transform, so the parchment backdrop renders exactly as `#f5ebdc`.
- **Scripts:**
  - `source/build_blockout.py` builds and saves the blockout master and `blockout-measurements.json`;
  - `source/sheet.py` builds and renders the sheet and writes `sheet-render.json`;
  - `source/sheet_preview.py` renders the half-size preview;
  - `source/crops.py` renders the close-ups;
  - `source/measure_parts.py` writes `part-measurements.json`;
  - `source/iterate_preview.py` was the design-iteration helper;
  - `source/release.py` saves and releases the scene;
  - `source/run.py` handles the MCP transfer and execution.

  The scripts are adapted from the mischief-kitten, rival-mayor and magic-house v001 sheet scripts.
- **Iteration record:** four design passes. Each one was checked against the sheet preview and close-ups:
  1. A bigger head and eyes.
  2. Broad drooping peel flaps replaced thin antenna-like ones.
  3. The pink nape band was removed, and the back composition changed to crossed wing tips and soft plume drapes. The first back view read as a face.
  4. The half-lid was corrected, and the peel speckles were seated on the flap surface.

  `preview/sheet-preview.png` is the last half-size iteration preview; `reference-sheet.png` is the final render of the same scene.
- **Scene lease:** see `scene-lease.json` and `scene-release.json`. The scene was claimed from the released mischief-kitten v001 scene; no earlier asset file was changed.
