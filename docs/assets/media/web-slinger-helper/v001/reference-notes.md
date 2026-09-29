# web-slinger-helper v001 · reference notes

**Source:** Blender reference sheet, no generated concept.
**Status:** Sheet ready for coordinator review before any detailing, rigging or GLB work. Tom's exact-version review is still open. Once modeled, the candidate carries "Awaiting Tom's review · used in the family release" (PRD-004 Q-03).
**Role:** WO111 priority 8, World A chapter 3 **friendly** helper (ages 5–9, the rooftop Hero City chapter), from the locked DESIGN-026 roster. It follows DESIGN-013's friendly rules: it heals the player, it is never an enemy, and it stays out of enemy targeting and boss gates. The chapter's hostile cast is `inator-monster` (boss), `putty-grunt` and `lab-robot`.
**Files:** `reference-sheet.png` (2048 × 1024) and `web-slinger-helper-blockout.blend` (the blockout master at the origin). `web-slinger-helper-reference-sheet.blend` holds the same master plus the sheet scene. Close-up renders are in `preview/`, the scripts are in `source/`, and per-part bounds are in `part-measurements.json`.

## Design intent

An original masked kid hero who helps the player on the rooftops. The era's web-slinging cartoons and films inspired the character, but the design is its own. He is waving hello with his right hand, his left fist is on his hip, and his head tilts toward the wave. He has a big open grin, so the first read is "a friend who is happy to see you". The age band is 5–9, so he looks like a kid in a homemade-looking hero suit, not a grown-up superhero. He has no weapons, no angry face and no threatening pose.

**Friendly, and clearly not an enemy.** The palette is warm and bright: cobalt, sunny yellow and tangerine. The chapter's enemies are a green rubber-suit monster, a lavender clay grunt and a teal tin robot. He is the only chapter 3 character with a visible human face, and his body language is open. The two pink heart buttons on his web-shooters are the healer's cue. In game, DESIGN-013's friendly marker and greeting sit on top of this design.

Silhouette, from top to bottom:

1. **Open-face cobalt hood**, a round cowl over the whole head (0.37 m wide, 0.40 m tall, about a third of his height). The hood top is the highest point: 1.184 m for the shell and 1.191 m with the web strands. A soft rolled rim frames the face opening, which is 0.256 m wide × 0.276 m tall.
2. **The dew-drop web on the hood**, in cream. Eight strands run from a small knot on the crown down to about 74° from the crown, each ending in a round dew drop. Two sagging rings cross them. The strands stop at the face rim. The lower half of the hood stays plain cobalt.
3. **The face:** a round skin-toned face that bulges slightly out of the hood.
   - A **tangerine domino mask** arches up over each eye like raised happy brows, with its wings running under the hood rim.
   - **Two big friendly eyes** sit on the mask: cream whites, warm brown irises, plum pupils and two glints each.
   - Below them are a **button nose**, a **big open grin** with a single rounded strip of top teeth and a pink tongue, and **pink cheeks**.
   - A **chestnut fringe** of three locks spills out under the hood rim over the mask's top edge.
4. **A cobalt kid body** in one suit, with a slight tummy.
5. **A sunny star emblem** on the chest, tilted 10°, sits where a spider would sit in a web. The cream chest web radiates from it: ten rays and two sagging scallop rings, with dew drops where rays end on open suit. The back has a smaller star with its own web.
6. **A tangerine belt** with a round sunny buckle. A **coil of cream web rope** hangs on a tangerine clip at the right hip.
7. **Sunny mitten gloves** with flared cuffs, and chunky **tangerine web-shooter cuffs**. Each cuff has a **pink heart button** and a small cream nozzle. The raised right mitten is open palm-forward in a wave, with three painted finger grooves and the thumb toward the head. The left hand is a fist pressed onto the hip just above the belt.
8. **Cobalt leggings** and **sunny rain-boot-style boots** with rolled cuffs and plum soles. The left toe is turned out 15° and the right 8°, in a relaxed hero stance.

## Parody hooks

These are recognizable cues. None is a copied design.

| Hook | How it appears here |
| --- | --- |
| The web-slinging kid heroes | DESIGN-026 merges World A chapter 3's cast from the Power Rangers, Spider-Man and Phineas and Ferb era. The cast includes Spider-Man films and a preschool Spider-Man show, and calls for "a web-slinging friendly helper where a gap needs one". We use the idea only: a friendly masked kid with a web motif and web-shooters. |
| Web-shooters | Chunky tangerine wrist cuffs with a nozzle. The heart button on each cuff turns the gadget into a healer's tool. |
| The web pattern | Cream web lines on the suit, in our own arrangement: dew-drop strands from the crown of the hood, and a web on the chest that radiates from a star. |
| A star where the spider would be | The emblem at the centre of the web is a tilted sunny star, not a spider. |
| Masked hero | A domino mask and a hood, with the face left open so the child sees a friendly smile. |
| Web rope | A coil of web rope clipped to the belt, ready to swing or to throw a helping line. |

## What makes it original

- **No spider anywhere.** There is no spider logo, spider shape, legs or eyes on any part.
- **No copied suit.** It avoids these familiar features:
  - a red-and-blue or black-and-red suit;
  - black or raised web lines covering the whole body;
  - a full-face mask with big white lenses;
  - hood or colour schemes from the franchise's other web heroes.

  Instead, his own design combines an open-face hood, a domino mask, mitten gloves, rain-boot boots, a dew-drop web, a star emblem, heart-button cuffs and a rope coil.
- **Not another star hero either.** There are no red-and-white stripes, no shield, and no white star on blue. The star is sunny yellow, tilted, and sits inside a web.
- **No copied names, text, logos or faces.** There is no lettering anywhere, and the name stays generic ("web-slinger helper"). The face is a generic cartoon kid, not anyone's likeness. It is not a per-person avatar, and it carries no family detail.
- **Its own palette.** Cobalt, sunny yellow and tangerine with cream, chosen to read warm and friendly beside the chapter's cool-toned enemies. Plum ink `#342c46` is an anchor from the storybook brief.
- **Kid-safe.** He has no weapons, and the web is a helping line. His expression is a big smile under raised "brows", and his teeth are one rounded strip with no points. The heart buttons and cheek blush keep the read gentle.

## Colors (sRGB hex; flat painted blockout materials)

| Part | Hex |
| --- | --- |
| Suit: hood, face rim, body, sleeves, leggings, neck | `#3b7dd8` cobalt |
| Web strands, rings, dew drops, rope coil, eye whites, teeth, nozzles, glints | `#fbf6ea` cream |
| Star emblems, mitten gloves, glove flares, boots, belt buckle | `#f7c64a` sunny yellow |
| Domino mask, web-shooter cuffs, belt, coil clip | `#f28c3a` tangerine |
| Face and nose | `#f0c7a0` |
| Fringe | `#7a4a30` chestnut |
| Heart buttons | `#e8566f` (a slight glow in the sheet) |
| Boot soles | `#4a3f63` plum |
| Pupils, grin, finger grooves | `#342c46` ink |
| Irises | `#7b5234` warm brown |
| Tongue | `#ef8f98` |
| Cheek blush | `#f4a79d` |

## Proportions (measured from the blockout; metres, floor at 0)

- **Overall:** 1.191 m tall to the hood's web strands, 1.184 m to the hood shell, 1.122 m to the waving mitten, 0.808 m to the top of the body and 0.719 m to the top of the star emblem. The bounding box is 0.718 m wide (X, from the left elbow at −0.333 to the waving mitten at +0.385) × 0.383 m deep (Y, from the back of the hood at −0.178 to the eyes at +0.205) × 1.191 m high. This matches the brief's "about 1.2 m" and falls within the work order's 0.8–1.4 m band for small characters.
- **Head** (hood, face and web): 0.37 m wide × 0.38 m deep × 0.397 m tall (0.794–1.191 m), 33% of the height.
  - **Hood:** an ellipsoid with radii 0.185 × 0.178 × 0.195 m, centred at 0.99 m before the tilt.
  - **Face opening:** 0.256 × 0.276 m, centred at 0.96 m. The rolled rim is 0.027 m thick.
  - **Tilt:** the whole head tilts 6° toward its right (the waving side) about a pivot empty at the neck top, (0, 0, 0.815).
- **Face:** an ellipsoid 0.31 m wide × 0.324 m tall, centred at 0.972 m. It bulges 6 mm out of the front of the hood.
- **Domino mask:** about 0.25 m across, running under the rim, from 0.925 to 1.083 m. It arches to about 1.076 m over each eye before the tilt. The nose bridge spans 0.966–1.046 m, and the mask stands about 6 mm proud of the face.
- **Eyes:** each 0.076 m wide × 0.092 m tall, centred 0.052 m either side of the midline at 1.0 m, standing 0.024 m out from the face. The irises are 0.05 × 0.058 m and the pupils 0.03 × 0.036 m.
- **Nose:** 0.038 × 0.03 m, at 0.942 m.
- **Grin:** 0.12 m wide and 0.056 m deep (0.856–0.912 m before the tilt), with the corners up. The teeth strip is 0.086 × 0.0105 m and the tongue 0.054 × 0.026 m. The **cheeks** are 0.042 × 0.024 m, at x = ±0.088 m and 0.914 m.
- **Fringe:** three locks, 0.166 m across, 1.045–1.133 m.
- **Hood web:** strands 0.008 m thick, with 0.019 m dew drops. The two rings sit at about 30° and 57° from the crown.
- **Neck:** 0.112 m thick, 0.765–0.85 m, mostly under the hood.
- **Torso:** 0.303 m wide × 0.224 m deep, 0.395–0.808 m. The shoulder balls span 0.436 m at 0.742 m.
- **Belt:** 0.452–0.492 m, 0.309 × 0.229 m, with a 0.048 m buckle.
- **Chest star:** 0.123 m across (outer radius 0.075 m, inner 0.037 m), centred at 0.655 m and 7 mm proud. The **back star** is 0.086 m across.
- **Chest web:** 0.501–0.787 m. It wraps 90% of the way to each side, where it meets the back web.
- **Web-rope coil:** three loops, 0.088 m across and 0.118 m tall (0.369–0.487 m), on the right hip.
- **Right arm (waving):**
  - The elbow is at (0.296, 0.012, 0.862) and the wrist at (0.327, 0.024, 1.0). The sleeve is 0.08–0.096 m thick.
  - The mitten is 0.096 × 0.06 × 0.132 m, palm forward and turned 29° outward, with its top at 1.122 m.
  - The whole arm spans x = 0.10–0.385 m.
- **Left arm (on the hip):** the elbow is at (−0.292, −0.03, 0.625). The fist is 0.088 m across, pressed onto the hip at 0.476–0.563 m, just above the belt.
- **Web-shooter cuffs:** 0.112 m across and 0.046 m long, with 0.104 m glove flares below them. The heart buttons are 0.044 m wide and 9 mm thick. The right heart faces forward and the left faces out and forward. The nozzles are 0.019 m across.
- **Legs:** 0.142 m thick at the hip, tapering to 0.11 m at the ankle. The knees are at 0.285 m.
- **Boots:** 0.187 m tall to the rolled cuff, and about 0.13 m wide × 0.21 m long at the sole. The plum soles touch z = 0. The stance is 0.36 m wide across both boots.
- **Blockout size:** 120,352 triangles, 157 parts and 12 flat materials.

## Orientation and scale conventions

The blockout uses the WO111 authoring convention so the modeling author can keep it: Blender +Z up and the character facing Blender +Y, which becomes glTF +Y up / −Z forward on export. The root is floor-centred at the origin, the boot soles touch z = 0, and the character's right is +X. The head group hangs from one pivot empty, `Head tilt pivot`, so the tilt can be zeroed for a rest pose.

Every part is a plain primitive, lathe, sweep or surface decal, with no booleans. The hood is one open-face mesh whose rows run from the opening's exact rim to the back of the head. The small painted details stay out of the sheet's ink lineset (`sheet_no_ink`):

- the web strands, rings and dew drops;
- the glints;
- the teeth, tongue and blush;
- the finger grooves.

The sheet shows four linked-data copies of one master at exactly the same orthographic scale:

- front, rotated 180°;
- side, rotated −90°, showing its right side and facing right;
- back, rotated 0°;
- three-quarter, rotated −135°.

The height marker has 5 cm ticks with labels every 25 cm, plus dashed guides. The frame is sized from the figure height, so the figures fill about 45% of the sheet height (a 5.295 m ortho width).

## Notes for the later modeling author

These are suggestions only; the coordinator's review of this sheet decides.

- **Budget:** the blockout is about 120k triangles, far over budget. Most of that is the 95 round web strands, rings and dew drops, plus the dense decal rings. The final model must meet the WO099 contract: ≤ 15k triangles, ≤ 2 materials, one ≤ 1024 atlas, one skin with ≤ 4 influences, ≤ 2 MiB GLB, and exactly the clips `idle`, `move`, `attack`, `hit` and `defeat`. A 1.2 m friendly should come in well under the cap.
- **Paint rather than model the small details.** Paint these into the atlas:
  - the whole web pattern: strands, rings and most dew drops (keep the six hood drops as small bumps if they help the silhouette);
  - the finger grooves, cheek blush, teeth, tongue and iris glints;
  - the nose shading.

  Keep these as geometry, because they carry the silhouette or the character:
  - the hood with its face opening and rim;
  - the eyes, which should stand out from the face;
  - the mask (a thin shell) and the fringe locks;
  - the mitten and thumb, the fist, the cuffs and heart buttons;
  - the star emblem (slightly raised), the belt, the rope coil (one low-poly ring stack) and the boots.
- **Face read at play distance:** the eyes and grin carry the friendliness. Keep the eye whites at least this big, and keep the mask's raised arches.
- **Rig:**
  - a floor root, hips, a two-bone spine, a chest bone, a neck bone and a head bone (the hood, face, mask and fringe weighted rigidly to the head);
  - one fringe bone for a bounce;
  - an eye bone or two (scale for blinks and squints) if the budget allows; the mouth stays one painted open grin;
  - per arm, clavicle, upper arm, forearm and hand bones, with a thumb bone and one mitten-finger bone;
  - per leg, thigh, shin, foot and toe bones;
  - one bone on the rope coil so it can swing and unspool.
- **Pose:** the wave, the hand on the hip and the head tilt are design poses. Build the rest pose with the head straight, the arms in a relaxed A-shape with open mittens, and the feet parallel. Recreate the sheet pose in `idle`.
- **Clip use:** the runtime friendly scene (`src/game/friendly-scene.ts`) loops `idle`, plays `hit` when the friend loses health, and holds the end of `defeat` so "Make amends" has a visible target. The contract still needs all five clips, so `move` and `attack` should suit a helper.
- **Possible acting:**
  - `idle`: a bouncy weight shift with the big wave from the sheet. The head bobs, the fringe bounces, the heart buttons pulse gently, and every few loops he gives a little fist pump. This doubles as the greeting.
  - `move`: a skippy kid jog, with the arms swinging, the coil bouncing on his hip and the hood bobbing. There is no root motion.
  - `attack` (2.0 s, **contact at 1.25 s**), acted as his helping "heal toss" rather than a hit, since a friendly never attacks the player:
    - 0–0.45 s: he spots you, points with his right mitten, and the heart buttons blink. This is the tell.
    - 0.45–1.0 s: he crouches a little, pulls his right arm back beside his hood, and taps the cuff's heart button with his left hand ("charging up").
    - 1.25 s: contact. He makes a big overhand "thwip!" throw: the right arm snaps fully forward at a child's chest height, the mitten opens and the cuff nozzle points at the target. A cream web line with a heart on the end can be a runtime effect here; it is not part of the model.
    - 1.25–2.0 s: he follows through, gives a double thumbs-up or a fist pump with a hop, and settles into `idle`.
  - `hit` (used only when the player deliberately harms him; DESIGN-013 applies the penalty): an "ow!" flinch. He hops back on one foot with both mittens up by his hood, his eyes squeeze shut and his hood bounces. He is sheepish, not hurt-looking.
  - `defeat`: a cartoon plop with no gore. His rope coil unspools, and he sits down with a bump, loosely tangled in his own web rope. His mask is askew and his head is tilted, but his grin is still sheepish. The pose is held until he is repaired with Make amends.

## Provenance

- **Authoring:** Claude Opus 5.5 (`claude-opus-5-5`) through the cluster Blender MCP service, instance 1 (`blender-authoring`, Blender 4.5.13 LTS), under Tom's September 26 ruling. Opus continues WO111 Blender work, and assets without an Astra concept are modeled from a painted Blender reference sheet that the coordinator reviews before detailing. Instance 2 (`blender-authoring-2`) was not touched.
- **No image generation:** no image-generation model, external asset API, photo or third-party artwork was used. Every pixel comes from the procedural blockout rendered with Cycles on CPU (48 samples, denoised), with Freestyle plum-ink outlines (128° crease) and a Standard view transform, so the parchment backdrop renders exactly as `#f5ebdc`.
- **Construction:**
  - lathes: the torso and belt, as ellipses with a 0.74 depth ratio;
  - an open-face hood mesh built along great circles from the opening's rim to the back pole, with a solidify modifier;
  - Catmull-Rom sweeps: the sleeves, leggings, rim, fringe and web strands;
  - closed ring sweeps: the boot cuffs and the rope coil;
  - bevelled cylinders: the cuffs, boots and flares;
  - ellipsoids: the face, eyes, hands, shoulders and feet;
  - an extruded heart prism;
  - thin decals mapped onto the face and torso: the mask, grin, tongue, blush and stars (concentric rings from the centroid), and the teeth (a strip between two curves). Torso decals use true arc length around the elliptical body, so the stars are not squashed.
- **Scripts:**
  - `source/build_blockout.py` builds and saves the blockout master and `blockout-measurements.json`;
  - `source/sheet.py` builds and renders the sheet and writes `sheet-render.json`;
  - `source/crops.py` renders the close-ups;
  - `source/measure_parts.py` writes `part-measurements.json`;
  - `source/iterate_preview.py` was the design-iteration helper, and `source/final_render.py` ran the final pass;
  - `source/claim.py` and `source/release.py` claim and release the scene;
  - `source/transfer.py` and `source/run.py` handle the MCP transfer and execution (`run.py` checks `/readyz` before the claim), and `source/fetchprev.py` downloaded previews for review;
  - `source/collect.py` makes the durable copy and manifest.

  The scripts are adapted from the lab-robot, radio-host-showman, putty-grunt, demon-band-idol, bin-chicken and rival-mayor v001 sheet scripts. The sheet format, frame, dressing and palette row are unchanged.
- **Iteration record:** four design passes. Each one was checked against the half-size sheet preview and close-ups:
  1. The first blockout had three problems:
     - web lines covered the whole hood, which read too close to a copied web-head mask;
     - the top-teeth decal folded into points that read as fangs, because a centroid fan cannot follow a thin crescent;
     - the glove, wrist and cuff stacked up as three blocky cylinders.
  2. Pass two fixed them and made some adjustments:
     - the hood web became eight crown strands with dew-drop tips and two rings;
     - the chest and back webs lost their outer ring and gained dew drops;
     - the teeth were rebuilt as one rounded strip between two curves;
     - the wrist became one flare under the cuff;
     - the hearts and chest star were enlarged, and the waving hand moved back.
  3. The left fist moved up onto the hip above the belt (it had floated beside the belt). The coil was turned to face forward.
  4. The rope's dangling end was removed, because it read as a magnifying glass. The mitten was thickened and turned further outward so it reads in profile, and the legs were thickened.

  `preview/sheet-preview.png` is the last half-size iteration preview; `reference-sheet.png` is the final render of the same scene.
- **Scene lease:** see `scene-lease.json` and `scene-release.json`. The scene was claimed on instance 1 at 18:41:35 UTC from the released lab-robot v001 scene (`claim-checkpoint.blend` keeps a copy of it). `/readyz` reported ready and not busy at the claim. No earlier asset file was changed.
