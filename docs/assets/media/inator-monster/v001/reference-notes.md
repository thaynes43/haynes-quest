# inator-monster v001 · reference notes

**Source:** Blender reference sheet, no generated concept.
**Status:** Sheet ready for coordinator review before any detailing, rigging or GLB work (PRD-004 Q-07). Tom's exact-version review is still open. Once modeled, the candidate carries "Awaiting Tom's review · used in the family release" (PRD-004 Q-03).
**Role:** WO111 priority 6, the World A chapter 3 boss (ages 5–9) from the locked DESIGN-026 roster. This is the merged hero-team, web-hero and backyard-inventor era, and the chapter is Hero City (`rooftop`). The chapter's ordinaries are `putty-grunt` and `lab-robot`, and its friendly helper is `web-slinger-helper`.
**Files:**
- `reference-sheet.png` (2048 × 1024).
- `inator-monster-blockout.blend`, the blockout master at the origin.
- `inator-monster-reference-sheet.blend`, the same master plus the sheet scene.

Close-up renders are in `preview/`, the scripts are in `source/`, and per-part bounds are in `part-measurements.json`.

## Design intent

The chapter boss is one model: a giant, goofy rubber-suit monster with a small cartoon evil scientist riding in a bubble cockpit strapped to its shoulders. The scientist is the brains and the monster is the muscle. The joke kids should get at a glance is that it's obviously a costume. Look for the zipper down its back, the baggy wrinkled ankles and the googly eyes that look glued on. The monster is big and silly, never scary. It has an open, happy, gormless grin with two square buck teeth and a pink tongue, and its eyes point in two different directions. The scientist is small, cheeky and mischievous. He has scheming eyebrows and a gleeful grin, points "Attack!" with one hand, and holds his "-inator" remote up high with the other. Its zig-zag antenna pokes out through a port in the top of the glass.

Silhouette, from top to bottom:

1. **Zig-zag antenna**, a yellow lightning-bolt rod with a pink ball tip. It is the highest point, at 3.22 m, and rises from a brass port in the upper right of the dome. Its zig-zag plane is turned so it reads in all four views.
2. **Bubble cockpit dome:** a clear glass half-sphere 0.96 m across, rising from 2.34 to 2.82 m, with a painted window glint. Inside is the scientist, from the waist up:
   - a bald round head with pointed white side-and-back frizz;
   - big brass-rimmed goggles, slanted white brows, a round nose and a cut-in grin with top teeth;
   - a lab coat with a mint high collar and a pocket of pens;
   - purple gloves.

   His right arm is raised with the remote under the port. His left arm points forward.
3. **Violet cockpit tub** under the dome, with a brass rim, rivets and three signal lights (green, yellow, red) on each side. It sits on the shoulders and is strapped on: four dark straps run down to a chest belt with a brass buckle.
4. **Big bean head,** carried low and forward like a kaiju and tilted slightly (chin up about 6°, cocked about 6°). It has a broad snout with an ear-to-ear open grin, two nostrils and pink cheek blushes. A lower jaw with a butter-yellow underside completes the gormless open mouth.
5. **Two giant googly eyes** stuck high on the head, 0.31–0.32 m across, with a grey plastic rim. The pupils don't match: the right one looks down and in, the left one up and out. They top out at 2.49 m.
6. **Pear-shaped torso** leaning forward about 8.6°. It has a big butter belly patch with five scute lines and tiny T-rex arms with mitten hands and cream claw nubs.
7. **Toy-colored back plates** in two staggered rows, like a stegosaur, cycling tangerine, sunshine, bubblegum and sky blue. They are rounded leaf spikes that lean back toward the tail. The costume zipper runs between the two rows.
8. **Costume zipper:** dark tape, silver teeth, a slider and a big dangling pull tab. It runs down the spine from just under the cockpit (1.83 m) to the tail root (1.04 m).
9. **Thick tail,** swept to the monster's left, dragging on the floor and ending in a curled-up tip. Smaller plates continue along it.
10. **Stumpy legs** in a baggy suit, with two darker ankle wrinkles each, on big round feet with three cream toe nubs.

## Parody hooks

These are recognizable cues. None is a copied design.

| Hook | How it appears here |
| --- | --- |
| Monster of the week in a rubber suit | The hero-team shows of the era (DESIGN-026 chapter 3) send a new costumed monster every episode, and it grows giant for the finale. We parody the man-in-a-suit look in general: a visible zipper, baggy ankle wrinkles, glued-on googly eyes and a slightly lumpy body. No real monster's design, name or suit is used. |
| Dinosaur kaiju | A chunky, upright, tail-dragging dinosaur-monster silhouette with back plates. This is a genre shape, and its dinosaur theme fits the era's dino hero-team seasons without using their suits, colours or emblems. |
| Toy-colored plates | Candy-colored plates, as if the monster came from a toy box. There is no color coding to any hero team. |
| The "-inator" | The backyard-inventor cartoon's running joke is an evil scientist's absurd invention with an "-inator" name. We use only the joke: a chunky generic remote with a big red button, two dials, a speaker grille and a zig-zag antenna. No lettering, jingle, catchphrase or specific invention appears. |
| Evil scientist rides his monster | A classic cartoon-villain setup: the small schemer in a glass bubble on the big brute's back. |

## What makes it original

- **No copied names, text, logos, faces or costumes.** Nothing on the model carries lettering. The monster is not any show's monster, and the scientist is not any show's scientist.
- **Our own scientist.** He is short and round and sits upright. He has a bald crown with pointed white side-and-back frizz, big round brass goggles, slanted white brows, a round pink nose, a lab coat with a mint high collar and pens, and purple gloves. We avoided the inspiration's distinctive silhouette: no hunch, no pointed nose, no dark tunic under the coat, and no signature hair. The pointed frizz stays below the crown line on purpose. An earlier pass had round tufts on top of the head, and they read as round ears, so they were removed.
- **Our own monster.** The googly-eyed bean head, the costume zipper between staggered toy plates, the strapped-on cockpit tub and the tail swept to one side are our choices, not taken from any model sheet.
- **Our own palette,** from our storybook brief. There is no hero-team primary-color scheme.
- **Kid-safe:**
  - The teeth are two square buck teeth and the claws are rounded cream nubs.
  - The plates have rounded tips.
  - There is no weapon, fire or laser.
  - Both faces are silly, and the villainy is mischief.

## Colours (sRGB hex; flat painted blockout materials)

| Part | Hex |
| --- | --- |
| Rubber suit (body, head, legs, arms, tail) | `#72a95c` apple green |
| Suit folds (ankle and wrist wrinkles) | `#4f7f48` |
| Belly patch and jaw underside, and scute lines | `#f0d58c`, `#d9b466` |
| Back plates | `#f08a3c` tangerine, `#f4c542` sunshine, `#ef7fa8` bubblegum, `#5eaee0` sky |
| Toe and claw nubs | `#f3e6cf` |
| Googly eye whites, rims and pupils | `#fbf8f2`, `#c9d3d8`, `#2b2238` |
| Mouth cavity, tongue, buck teeth, cheek blush | `#9c3a52`, `#ef8a9a`, `#fbf6ec`, `#f2a08f` |
| Zipper tape, and teeth, slider and pull tab | `#3a3548`, `#c9ccd3` |
| Cockpit tub | `#6b5b95` violet |
| Straps and belt, and brass (rim, rivets, buckle, port, goggle rims) | `#3a3548`, `#c9923e` |
| Signal lights | `#7cc26b`, `#f4c542`, `#e0524f` |
| Bubble glass tint (mostly clear; tinted toward the rim) | `#bfe6f0` |
| Lab coat and pocket | `#eef0ec`, `#cfd8d4` |
| Collar and one dial | `#3f9d9a` mint-teal |
| Skin, nose | `#f2cfae`, `#e8a08c` |
| Frizz and brows | `#dcd6ee` lavender-white |
| Goggle lenses | `#a9d8ea` |
| Gloves | `#7b5ea7` |
| Remote body, big button | `#4b4f63`, `#e0524f` |
| Antenna, antenna ball | `#f4c542`, `#ef7fa8` |

## Proportions (measured from the blockout; metres, floor at 0)

- **Overall:** 3.217 m to the antenna ball, 2.82 m to the top of the dome, 2.489 m to the googly eyes and 2.381 m to the top of the head. The bounding box is 1.675 m wide (X, from the tail tip at −0.965 to the right hand and belly at +0.71) × 3.18 m long (Y, from the tail tip at −1.92 to the buck teeth at +1.27) × 3.22 m high. That sits in the brief's 3.0–3.4 m.
- **Monster alone** (without the cockpit or pilot): 2.49 m tall, with the same 1.675 × 3.18 m footprint. Without the tail, the torso is 1.42 m wide and the feet spread 1.27 m.
- **Torso:** a pear 1.42 m wide × 1.24 m deep, from 0.56 to 2.16 m, widest (0.71 m radius) at about 1.25 m.
- **Belly patch:** 0.92 m wide, from 0.59 to 1.70 m.
- **Head:** cranium, snout and jaw together are 0.78 m wide × 1.06 m long, from 1.72 to 2.38 m.
  - The snout is 0.66 m wide and reaches forward to y = 1.26.
  - The grin opening is about 0.47 m wide.
  - The buck teeth are 0.07 m square each.
- **Googly eyes:** 0.31 m (right) and 0.32 m (left) across, with 0.14 m pupils. Their centres are about 0.36 m apart at about 2.33 m.
- **Tiny arms:** 1.04 m tip to tip. Each arm is about 0.4 m long with its mitten and 0.18 m thick at the shoulder, at 1.31–1.59 m. This is deliberately tiny against the torso.
- **Legs and feet:**
  - The legs are 0.53–0.56 m thick and visible from the feet to about 0.6 m.
  - The feet are 0.47 m wide × 0.66 m long × 0.27 m high, centred at x = ±0.40.
  - The toe nubs are 0.12 m wide.
- **Tail:** 0.72 m thick at the root and 0.12 m at the curled tip. It sweeps 0.97 m to the monster's left and 1.9 m back, resting on the floor.
- **Back plates:**
  - Torso: 8 plates, 0.24–0.48 m tall, from 0.87 to 2.25 m.
  - Tail: 6 plates, 0.08–0.22 m tall.
- **Zipper:** 0.068 m wide tape from 1.04 to 1.83 m. The pull tab is 0.10 × 0.21 m.
- **Cockpit:** the tub is 0.97 m across (0.91 m plus the rim), from 2.00 to 2.37 m, centred on (0, −0.12). The dome has a 0.48 m radius, from 2.34 to 2.82 m, and a 0.104 m port.
- **Scientist:** 0.46 m of visible height from the rim to the top of his head, with the remote held up to 2.72 m. His head with frizz is 0.32 m wide × 0.23 m tall (2.55–2.78 m), and the remote is 0.085 × 0.055 × 0.13 m. He is about a fifth of the monster's height, so the pair reads as brains and brawn.

## Orientation and scale conventions

The blockout uses the WO111 authoring convention so the modeling author can keep it: Blender +Z up and the character facing Blender +Y, which becomes glTF +Y up / −Z forward on export. The root is floor-centred at the origin, and the character's right is +X.

Frame empties make the pose easy to zero:

| Empty | Placement |
| --- | --- |
| `Head tilt frame` | (0, 0.60, 1.98), with 0.10 rad chin-up and 0.10 rad cock |
| `Cockpit frame` | The tub-rim centre, (0, −0.12, 2.34). The dome, tub, pilot and remote are its children |
| `Inator remote frame` | The remote |
| `Googly eye frame ±1` | One per eye |

The torso lean (−0.15 rad about X) is baked into the torso, belly, plates and zipper placements. Every pilot, remote and antenna part carries the custom property `in_dome = True`. The grin cavities and the antenna port are booleans baked into the meshes. Their cutters are kept, hidden and non-rendering, in `Blockout cutters (hidden, applied)`.

The sheet shows four linked-data copies of one master at exactly the same orthographic scale, rotated 180° (front), −90° (side, facing right), 0° (back) and −135° (three-quarter). The height marker has 10 cm ticks with labels every 0.5 m, plus dashed guides. The frame is sized from the figure height and the four view widths. The long side view sets it here, and the figures fill about 52% of the sheet height.

Freestyle treats the glass as an occluder. So the pilot, remote and antenna are copied into their own collection, which gets a second plum-ink lineset that accepts quantitative invisibility 0–1: seen through exactly one glass surface, or in the open. Every opaque blockout part is a closed volume, so the pilot's own hidden edges stay hidden.

## Notes for the later modeling author

These are suggestions only; the coordinator's review of this sheet decides.

- **Budget:** the blockout is about 79k triangles of primitives, lathes and sweeps, far over budget. The final model must meet the WO099 contract:
  - ≤ 15k triangles, ≤ 2 materials and one ≤ 1024 atlas;
  - one skin with ≤ 4 influences, and a ≤ 2 MiB self-contained GLB;
  - exactly the clips `idle`, `move`, `attack`, `hit` and `defeat`.
- **Glass:** the two-material limit fits this asset exactly. Use one opaque atlas material for everything else. The dome is the second material, alpha-blended with the tint rising toward the rim and the window glint painted in. In Three.js, render the glass after the opaque pilot and don't write depth, so the scientist stays visible.
- **Height:** the WO111 contract suggests bosses of about 2–3 m, but this brief asked for 3.0–3.4 m. The monster's own mass tops out at 2.49 m; only the dome (2.82 m) and the thin antenna (3.22 m) go above 3 m. Keep that split if gameplay bounds need a smaller collision height.
- **Paint rather than model the small details.** The following can all go into the atlas:
  - the scute lines, cheek blushes, nostrils and zipper teeth;
  - the rivets, the tub's signal lights and the remote's dials and grille;
  - the pocket pens.

  Keep these as geometry, because they carry the read at gameplay distance:
  - the googly eyes (with rims) and the buck teeth;
  - the plates, the zipper slider and pull tab, and the straps;
  - the dome and port, the scientist's goggles and frizz, the remote body and the zig-zag antenna.
- **Thin parts:** the antenna is 0.024 m thick and the scientist's fingers are small. Thicken the antenna a little (about 0.03 m) for a small screen, and keep its ball tip.
- **Floor:** the tail's lowest point dips 8 mm below the floor. Clamp it to z = 0 in the final mesh.
- **Rig:** use one skin for the monster and pilot together.
  - Monster: hip root, 3 spine bones (the cockpit rides the top one), neck, head and a jaw bone for the grin. Add a pupil bone for each googly eye so they can jiggle, and 2 bones per tiny arm. Each leg needs thigh, shin and foot, and the tail needs a 4–5 bone chain. Add one bone for the zipper pull tab so it can flip.
  - Pilot: a root weighted rigidly under the cockpit on the top spine bone, then spine, head, 2 bones per arm, a remote bone, and a 3-bone antenna chain so the zig-zag can wiggle and droop. The dome and tub are weighted rigidly to the top spine bone.
- **Pose:** the head tilt, the mismatched pupils and the pilot's raised and pointing arms are design poses. Build the rest pose with the head straight and the pilot's arms relaxed, then recreate the look in `idle`.
- **Possible acting:**
  - `idle`: a side-to-side costume waddle-sway with a lazy tail swish, while the googly pupils drift. The scientist taps the remote and his shoulders bob in a silent cackle.
  - `move`: a stompy, bouncy waddle with the baggy-suit legs, tail swaying and plates bobbing. The scientist points ahead.
  - `attack` (2.0 s):
    - 0.00–0.55 s: the scientist raises the remote and mashes the big red button, and the antenna wiggles.
    - 0.55–1.05 s: the monster rears back onto its tail with its tiny arms up and its grin wide.
    - 1.05–1.25 s: it drops forward into a big belly-bounce stomp. **Contact near 1.25 s**, when the right foot and belly hit the ground and make a shockwave.
    - 1.25–2.00 s: it wobbles back, its pupils spin, and the scientist is jostled and grabs the rim.
  - `hit`: the monster jolts, its googly pupils rattle, the zipper tab flips up, and the scientist bonks his head on the glass while the dome wobbles.
  - `defeat`: the suit goes floppy. The monster sits down hard on its tail, legs splayed, tongue out and pupils crossed, and slumps sideways. The antenna droops into a limp squiggle and the scientist shakes a tiny fist, a generic gesture with no catchphrase. The pose is held.

## Provenance

- **Authoring:** Claude Opus 5.5 (`claude-opus-5-5`) through the cluster Blender MCP service on instance 1 (`blender-authoring`, Blender 4.5.13 LTS), under Tom's September 26 ruling. Opus does the WO111 Blender work, and assets without an Astra concept follow a painted Blender reference sheet that the coordinator reviews before detailing.
- **No image generation:** no image-generation model, external asset API, photo or third-party artwork was used. Every pixel comes from the procedural blockout rendered with Cycles on CPU (48 samples, denoised). Plum-ink Freestyle outlines use two linesets (see above). The Standard view transform keeps the parchment backdrop exactly `#f5ebdc`.
- **Scripts:**
  - `source/claim.py` claims the scene and writes `scene-lease.json` and `claim-checkpoint.blend`.
  - `source/build_blockout.py` builds and saves the blockout master and `blockout-measurements.json`.
  - `source/sheet.py` builds and renders the sheet and writes `sheet-render.json`.
  - `source/sheet_preview.py`, `source/iterate_preview.py` and `source/crops_quick.py` are the iteration helpers.
  - `source/crops.py` renders the close-ups.
  - `source/measure_parts.py` writes `part-measurements.json`.
  - `source/final_render.py` and `source/final_crop_and_checkpoint.py` ran the final pass.
  - `source/release.py` saves and releases the scene.
  - `source/run.py` handles the MCP transfer and execution.

  The sheet script is adapted from the bin-chicken v001 sheet script, which came from the mischief-kitten, rival-mayor and magic-house sheets.
- **Iteration record:** three design passes. Each one was checked against the half-size sheet preview and 1024 px close-ups:
  1. The first pass had four problems:
     - The glass was milky and its glint too big.
     - The round hair tufts on the scientist's crown read as round ears.
     - The tube grin read as a mustache.
     - The remote, held at ear height, looked like a phone call.
  2. The second pass fixed them and tidied up:
     - The glass was cleared, with a small spot and a short arc streak fixed to the sheet camera.
     - An off-centre antenna port lets the scientist raise the remote up to his right.
     - Pointed side-and-back frizz replaced the tufts, and a cut-in grin with top teeth replaced the tube.
     - Straps now connect the tub to the chest belt, and the chin patch follows the jaw.
     - A stray neck-seam ring and the cylinder wall left by the hole-tolerant boolean were removed.
  3. The third pass made smaller adjustments:
     - The zig-zag plane was turned so it reads in the three-quarter view.
     - The top pair of plates was tried at a wide splay, which looked like blades in the back view. The splay was reduced.
     - The title was fitted to leave a gap before the palette.

  `preview/sheet-preview.png` is the last half-size preview of the final geometry; `reference-sheet.png` is the final render.
- **Scene lease:** see `scene-lease.json` and `scene-release.json`. The scene was claimed on instance 1 from the released yes-yes-veggie v001 scene, whose recovery copy is `claim-checkpoint.blend`. No earlier asset file was changed; the release checks every earlier family-era `.blend` and `.glb` hash. Instance 2 was not touched.

## Open points for the coordinator's review

1. The zipper is on the back, the classic costume gag. It reads in the back view and on the pull tab, but not from the front. Keep it there, or add a small front cue such as a visible neck seam?
2. The front view hides the back plates behind the head and cockpit. They read from the side, back and three-quarter views, which is how they read in the Hero City fight camera.
