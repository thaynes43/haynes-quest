# putty-grunt v001 · reference notes

**Source:** Blender reference sheet, no generated concept.
**Status:** Sheet ready for coordinator review before any detailing, rigging or GLB work. Tom's exact-version review is still open. Once modeled, the candidate carries "Awaiting Tom's review · used in the family release" (PRD-004 Q-03).
**Role:** WO111 priority 6, World A chapter 3 ordinary-a (ages 5–9, the rooftop Hero City chapter), from the locked DESIGN-026 roster. The chapter boss is `inator-monster`; `lab-robot` is ordinary-b.
**Files:** `reference-sheet.png` (2048 × 1024) and `putty-grunt-blockout.blend` (the blockout master at the origin). `putty-grunt-reference-sheet.blend` holds the same master plus the sheet scene. Close-up renders are in `preview/`, the scripts are in `source/`, and per-part bounds are in `part-measurements.json`.

## Design intent

A goofy clay "putty" foot-soldier, the kind of grunt a hero-show villain sends in by the dozen. It is one lumpy lump of grey-lavender modelling clay, squished into shape in a hurry, and it is ready to fight in the least convincing way possible. It stands in a wobbly "hi-yah!" guard with its right mitten fist up in front of its chest, its left fist low and out, and its knees bent on big flat feet. Its big round blank eyes don't match in size, and a lopsided grin hangs open with the tongue poking out. The age band is 5–9, so it reads as a funny henchman first and an enemy second. It has no teeth, claws, weapons or angry face.

Silhouette, from top to bottom:

1. **A pinched clay antenna** grows from the crown. It leans toward its right with the tilted head and ends in a clay ball with a little pinch on top. The ball is the highest point, at 1.40 m.
2. **A big neckless head** shaped like a lumpy bean (0.34 m across, about 27% of its height to the crown). It tilts about 8° toward its right. The face has three parts:
   - two **blank round cream eyes** with no pupils. Its right eye is 17% bigger and sits a little lower;
   - two worm-of-clay **brows**. Its left brow arches high ("huh?") and the right lies flat;
   - a **nub nose**, then a **lopsided dopey grin**, higher at its right corner, with a **pink tongue** hanging over the lower lip.
3. **Thumbprint dents** are pressed all over the clay: forehead, right cheek, belly, back of the head, shoulder blade, lower back, left upper arm, right forearm, right thigh and left calf. Each is a shallow dimple with a painted spiral whorl. The biggest sits in the middle of the chest, where a hero-show grunt would wear its emblem.
4. **A pot-bellied torso** (0.51 m across the shoulder lumps). The belly pushes forward a little off-centre, with extra clay lumps on the sides and back.
5. **A rolled clay-coil belt** in dark plum clay. It rides at 0.56 m at the back and dips under the belly to 0.45 m in front, where a round honey buckle sits (0.10 m across, with a pressed centre).
6. **Noodly arms with oversized mitten fists.** Each fist is a round clay lump with a knuckle row and a thumb wrapped over the curled fingers, about 1.5 times the forearm's thickness. The raised right fist tops out at 0.92 m, below the grin. The low left fist hangs out at the side, leaving clear negative space in the front and back views.
7. **Short stumpy legs** on flat, squashed **pancake feet** with three toe bumps each, splayed 15° outward in a bow-legged stance.

## Parody hooks

These are recognizable cues. None is a copied design.

| Hook | How it appears here |
| --- | --- |
| The morphing-hero-show clay grunt | DESIGN-026 merges World A chapter 3's cast from the Power Rangers (Beast Morphers, Dino Fury, Cosmic Fury), Spider-Man and Phineas and Ferb era, and its ordinaries include clay "putty" grunts. We use the premise only: a villain's foot-soldier made of clay that arrives in squads, flails, gets bonked and falls apart. |
| The chest emblem | Hero-show grunts often carry a badge on the chest. Ours has a giant thumbprint instead, as if the villain pressed it there to say "done". It is a funny stand-in, not a letter, logo or symbol from any show. |
| Clumsy martial arts | A wobbly "hi-yah!" guard with one fist up, knees bent and tongue out in concentration. It is the henchman who plainly has never won a fight. |
| Made of clay | Grey-lavender putty, lumpy hand-worked surfaces, thumbprints everywhere, a rolled-coil belt and a pinched antenna. It is a modelling-clay figure, not a suited actor. |

## What makes it original

- **No copied names, text, logos, faces or costumes.** It has no letter or badge on the chest (the thumbprint takes that place), no helmet, mask or textured suit, and no show's grey-and-silver colour scheme. The name stays generic ("putty grunt"), and there is no lettering anywhere.
- **Its own design.** The big neckless bean head, mismatched blank eyes, worm brows, dopey tongue-out grin, antenna, coil belt with a honey buckle, mitten fists and pancake feet are our choices. None comes from a model sheet.
- **Its own palette.** Grey-lavender clay with plum and honey accents comes from our storybook brief (plum ink `#342c46` and honey `#dca953` are brief anchors).
- **Kid-safe.** There are no teeth, claws or weapons, and the expression is dopey rather than angry. The eyes are blank but big and mismatched under a raised brow, so they read as dim and goofy, not spooky. The mitten fists are round and soft, and its "attack" is a clumsy bonk.

## Colors (sRGB hex; flat painted blockout materials)

| Part | Hex |
| --- | --- |
| Clay body, arms, legs, antenna, brows | `#a39db6` grey-lavender |
| Thumbprint dent patches | `#9690ab` |
| Thumbprint whorl ridges | `#6d6687` |
| Rolled clay-coil belt | `#5e5775` plum clay |
| Buckle | `#dca953` honey |
| Buckle's pressed centre | `#b98a35` |
| Blank eyes | `#fbf6ea` cream |
| Grin (mouth interior) | `#3b3049` |
| Tongue | `#e8909f` pink |

## Proportions (measured from the blockout; metres, floor at 0)

- **Overall:** 1.402 m tall to the antenna ball and 1.292 m to the crown. The bounding box is 0.80 m wide (X, fist to fist) × 0.52 m deep (Y, back of the belt to the guard fist) × 1.40 m high, inside the brief's 1.3–1.5 m. The work order's 0.8–1.4 m ordinary band holds at the crown.
- **Head:** 0.344 m wide × 0.336 m deep × 0.342 m tall above the neck pinch (0.95–1.29 m), tilted about 8° toward its right. There is no separate neck: the head blends into the shoulders through a thick clay pinch.
- **Eyes:** blank ellipsoids with no pupils. Its right eye is 0.103 m wide × 0.109 m tall, centred at about 1.12 m; its left is 0.088 × 0.094 m at about 1.14 m. They bulge out of the face to y = 0.165 m.
- **Brows:** worm-of-clay sweeps about 0.02 m thick. The left arches to 1.236 m, and the right lies flat at about 1.19 m.
- **Nose:** a nub 0.07 m wide and 0.08 m tall at 1.03–1.12 m. Its tip, at y = 0.188 m, is the front-most point of the face.
- **Grin:** 0.128 m wide, spanning 0.965–1.045 m, with its right corner 0.03 m higher than its left and up to 0.034 m deep in the middle. The tongue is 0.04 m wide and hangs down to 0.935 m.
- **Antenna:** 0.15 m from the crown (1.25 m) to the top, leaning 0.1 m toward its right. The stalk tapers from 0.044 to 0.022 m, and the ball is 0.06 m across.
- **Torso:** 0.51 m wide × 0.39 m deep, from the crotch at 0.37 m to the neck pinch at 0.95 m, with the pot belly pushed forward.
- **Belt:** a coil about 0.048 m thick and 0.51 m across, from 0.56 m at the back down to 0.45 m in front. The buckle is 0.10 m across and 0.035 m deep, centred at 0.47 m.
- **Arms:** the upper arms are about 0.10 m thick and the forearms 0.09 m. The raised right fist is about 0.14 m across, from 0.74 to 0.92 m, centred 0.23 m forward of the body axis in front of its right chest. The left fist hangs from 0.41 to 0.59 m, out to x = −0.40 m.
- **Legs:** the thighs are about 0.14 m thick, with the knees bent 0.055 m forward at about 0.25 m. From the crotch at 0.37 m, the legs make up about 26% of the height.
- **Feet:** flat pancake soles resting exactly on the floor, each about 0.31 m long × 0.21 m wide × 0.10 m high, with three toe bumps and 15° outward splay. The stance is 0.61 m across the feet.
- **Blockout size:** 134,030 triangles (metaball clay voxel-remeshed at about 8 mm, plus sweeps and primitives), 44 parts and 9 flat materials.

## Orientation and scale conventions

The blockout uses the WO111 authoring convention so the modeling author can keep it: Blender +Z up and the character facing Blender +Y, which becomes glTF +Y up / −Z forward on export. The root is floor-centred at the origin, and the character's right is +X. The clay masses (`Clay body mass`, `Clay arm right (guard)`, `Clay arm left (low)`, `Clay leg right`, `Clay leg left`) are plain meshes baked from metaballs, and each carries the shared `Clay hand-worked noise` Displace modifier in local coordinates. The thumbprint whorls and dent patches are thin painted decals ray-cast onto that surface; the sheet keeps them out of the ink lineset.

The sheet shows four linked-data copies of one master at exactly the same orthographic scale, rotated 180° (front), −90° (side, showing its right side and facing right), 0° (back) and −135° (three-quarter). The height marker has 5 cm ticks with labels every 25 cm, plus dashed guides. The frame is sized from the figure height (the figures fill about 45% of the sheet height).

## Notes for the later modeling author

These are suggestions only; the coordinator's review of this sheet decides.

- **Budget:** the blockout is about 134k triangles, far over budget. The final model must meet the WO099 contract: ≤ 15k triangles, ≤ 2 materials, one ≤ 1024 atlas, one skin with ≤ 4 influences, ≤ 2 MiB GLB, and exactly the clips `idle`, `move`, `attack`, `hit` and `defeat`. One continuous clay body (head, torso, arms and legs) retopologized from the blockout should fit easily.
- **Paint rather than model the small details.** The thumbprint whorls, dent patches, grin, tongue interior and buckle centre can all go into the atlas. Bake a soft occlusion or dimple shading so the thumbprints still read as pressed in. Keep the eyes, nose nub, fists with their knuckles and thumbs, antenna and ball, belt coil, buckle, protruding tongue tip and pancake feet as geometry, because they carry the silhouette. The brows can be painted if the budget is tight, but a slight raised ridge keeps the "huh?" read in the three-quarter view.
- **Clay look:** keep the surface lumpy and hand-worked, not smooth vinyl. A low-frequency normal or vertex-colour variation in the atlas carries it once the geometry is simplified.
- **Rig:** use a humanoid with a hip root, a 2–3 bone spine plus a belly bone for squash, a head bone, and a 2-bone antenna chain for lagging jiggle. Each arm needs upper arm, forearm (a twist or stretch bone helps) and fist. Each leg needs thigh, shin and foot, with the soles kept flat. Weight the belt and buckle to the spine and belly, and the eyes and tongue rigidly to the head. Clay squash-and-stretch works best as bone scale, which glTF supports.
- **Pose:** the guard stance, head tilt and bow-legged splay are design poses. Build the rest pose with the head straight, both arms relaxed in an A-pose and the feet flat, then recreate the guard in `idle`.
- **Possible acting:**
  - `idle`: a wobbly bounce in the guard, with little "hi-yah" feints of the right fist. The antenna jiggles a beat behind, and the body squashes slightly on each bounce.
  - `move`: a bouncy, bow-legged waddle-jog. The pancake feet squash flat on every step, the arms pump and the antenna flops.
  - `attack` (2.0 s, **contact at 1.25 s**):
    - 0–0.6 s: it hops back and winds its right fist far behind its head, the clay arm stretching long. Its tongue sticks out in concentration, and it leans back on its heels.
    - 0.6–1.1 s: a wobbly "hi-yah" wind-up, where it teeters forward onto its toes.
    - 1.25 s: contact, a big clumsy overhead mitten bonk with the arm stretched about 30% longer. The fist squashes flat against the target.
    - 1.25–2.0 s: the arm snaps back like elastic ("boing"). It nearly falls over, windmills its left arm, then settles back into the guard.
  - `hit`: its whole body squashes sideways like poked clay, with a big dent in the belly. The eyes squeeze and the antenna springs, then it wobbles back into shape.
  - `defeat`: it tips backward and splats into a lumpy clay pancake. Only its antenna (now drooping), its two blank eyes and the belt ring stick up out of the puddle, and the pose is held.

## Provenance

- **Authoring:** Claude Opus 5.5 (`claude-opus-5-5`) through the cluster Blender MCP service, instance 1 (`blender-authoring`, Blender 4.5.13 LTS), under Tom's September 26 ruling. Opus continues WO111 Blender work, and assets without an Astra concept are modeled from a painted Blender reference sheet that the coordinator reviews before detailing.
- **No image generation:** no image-generation model, external asset API, photo or third-party artwork was used. Every pixel comes from the procedural blockout rendered with Cycles on CPU (48 samples, denoised), with Freestyle plum-ink outlines and a Standard view transform, so the parchment backdrop renders exactly as `#f5ebdc`.
- **Construction:** the clay masses are Blender metaballs (balls, ellipsoids and capsules) evaluated and voxel-remeshed into plain meshes, relaxed, and given a light local-coordinate Displace. The thumbprint dimples are pressed into the vertices. The whorls, dent patches, grin and tongue interior are decals ray-cast onto the evaluated surface.
- **Scripts:**
  - `source/build_blockout.py` builds and saves the blockout master and `blockout-measurements.json`;
  - `source/sheet.py` builds and renders the sheet and writes `sheet-render.json`;
  - `source/crops.py` renders the close-ups;
  - `source/measure_parts.py` writes `part-measurements.json`;
  - `source/iterate_preview.py` was the design-iteration helper, and `source/final_render.py` ran the final pass;
  - `source/claim.py` and `source/release.py` claim and release the scene;
  - `source/transfer.py` and `source/run.py` handle the MCP transfer and execution;
  - `source/collect.py` makes the durable copy and manifest.

  The scripts are adapted from the demon-band-idol, bin-chicken and rival-mayor v001 sheet scripts. The sheet differs in two ways: its Freestyle crease angle is 105° instead of 128°, because the baked clay is smooth, and the painted thumbprint decals render outside the ink lineset.
- **Iteration record:** four design passes. Each one was checked against the half-size sheet preview and close-ups:
  1. The first metaball blockout had stray ink ticks on the clay, a forehead thumbprint that had landed on the chest, a guard fist covering the grin in the three-quarter view, a ball-shaped tongue and a flat plate brow.
  2. The guard fist was lowered and moved outward, the plate brow became two worm-of-clay brows, the tongue was re-rooted and the dent patches were lightened.
  3. Spiral whorls replaced concentric bullseye rings, so the dents read as thumbprints. The brow ends were rounded and the feet enlarged.
  4. A voxel remesh of the metaball clay removed the tessellation folds that caused the ink ticks. A painted tongue patch inside the grin joined the tongue to the mouth, and the stance was widened.

  `preview/sheet-preview.png` is the last half-size iteration preview; `reference-sheet.png` is the final render of the same scene.
- **Scene lease:** see `scene-lease.json` and `scene-release.json`. The scene was claimed on instance 1 from the released demon-band-idol v001 scene (`claim-checkpoint.blend` keeps a copy of it). No earlier asset file was changed, and instance 2 was not touched.
