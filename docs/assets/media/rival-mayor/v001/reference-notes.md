# rival-mayor v001 · reference notes

**Source:** Blender reference sheet, no generated concept.
**Status:** Sheet ready for coordinator review before any detailing, rigging or GLB work. Tom's exact-version review is still open. Once modeled, the candidate carries "Awaiting Tom's review · used in the family release" (PRD-004 Q-03).
**Role:** WO111 priority 4, World A chapter 2 boss (ages 2–5 era), from the locked DESIGN-026 roster.
**Files:** `reference-sheet.png` (2048 × 1024) and `rival-mayor-blockout.blend` (the blockout master at the origin). `rival-mayor-reference-sheet.blend` holds the same master plus the sheet scene. Scripts are in `source/`.

## Design intent

He is a pompous schemer from the next town over who wants to be the boss of everything. He is sneaky and full of himself, and he keeps losing to his own gadget, so the fight should play as a joke on him. The age band is 2–5, so the shapes stay big, round and readable, and his face is smug rather than menacing. Size comes from the tall hat and wide mustache, not from sharp or scary forms.

Silhouette, from top to bottom:

1. **Tall stovepipe hat**, tipped at a jaunty angle toward his remote hand. It is his tallest feature and roughly a fifth of his height.
2. **Egg-shaped head** with a long nose that ends in a round rosy tip.
3. **Huge curly handlebar mustache**, about 0.71 m tip to tip. It sticks out well past the head and is the main read in every view.
4. **Pear-shaped tailcoat**: narrow padded shoulders, a big round belly, and swallow tails at the back.
5. **Very skinny pinstripe legs** in cream spats and long pointed shoes. The contrast with the heavy top half is part of the joke.
6. **Asymmetric pose**: left fist on his hip, right hand holding the remote out to the side with the antenna up. This leaves clear gaps between the arms and body in front and three-quarter views, which helps readability at phone size.

## Parody hooks

These are recognizable cues. None is a copied design.

| Hook | How it appears here |
| --- | --- |
| Scheming rival mayor | Tall stovepipe hat, raspberry mayoral sash with a pleated rosette, formal tailcoat and waistcoat. |
| Big villain mustache | Oversized curling handlebar mustache; smug side-glance; one skeptical eyebrow raised and the other slanted. |
| Remote-control contraption | Chunky teal handheld box with a big raspberry button, two honey dials, a brass side crank and a coiled brass spring antenna. The antenna ends in a honey ball and a tiny cream propeller. |
| Kitten crew | Small cream kitten-face badges on the hat band and the sash rosette. They tie him to `mischief-kitten`, his ordinary crew. |

## What makes it original

- **No copied names, text, logos, faces or costume.** The sheet has no lettering on the character, and his name stays generic ("rival mayor").
- **The palette comes from our own storybook brief** (plum ink, honey, teal, parchment), not from any show's character colors. The aubergine coat, honey waistcoat, raspberry sash, teal remote and plum-grey pinstripes are our combination.
- **Several shapes are our own inventions:** the pear-bodied, skinny-legged build, the tilted stovepipe, the spring-and-propeller antenna, the kitten rosette and the side-glance expression. None comes from a model sheet.
- **Kid-safe:** no weapons, and the remote only makes gadgets misbehave. The eyes are half-lidded and sly rather than angry, with a smirk and a clown-rosy nose. No teeth or claws are shown.

## Colors (sRGB hex; flat painted blockout materials)

| Part | Hex |
| --- | --- |
| Tailcoat, sleeves, shoulders, coat tails | `#5b3b6a` aubergine |
| Hat, lapels | `#2f2740` deep plum ink |
| Sash, rosette, remote button | `#b54a5a` muted raspberry |
| Waistcoat, hat band, rosette disc, antenna ball, dials | `#dca953` honey |
| Remote box, bow tie | `#3f7f7a` teal |
| Gloves, spats, collar, kitten badges, propeller | `#f3e6cf` cream |
| Skin | `#efc9a4` warm peach |
| Nose tip | `#e39a88` rosy |
| Mustache, brows, hair tufts, smirk | `#2b2238` plum-black |
| Shoes, buttons, pupils | `#342c46` plum ink |
| Buckles, crank, antenna spring, back buttons | `#c9923e` brass |
| Trouser pinstripes | `#3a2e4d` with `#8a7c96` stripes |
| Eye whites | `#fbf6ec` |

## Proportions (measured from the blockout; metres, floor at 0)

- **Overall:** 2.474 m tall to the top of the hat. The bounding box is 1.32 wide (X, elbow to crank) × 0.75 deep (Y, nose to coat tails) × 2.47 high. The body alone, without arms or remote, is about 0.74 m wide at the belly.
- **Hat:** brim about 0.57 m across at about 1.91–2.00 m (tilted); crown to 2.47 m, flaring slightly toward the top; honey band about 0.07 m tall.
- **Head:** 1.50–2.00 m, about 0.38 m wide. Eyes are at about 1.83 m. The nose reaches about 0.39 m forward of the body axis.
- **Mustache:** 1.61–1.82 m tall, curls included; about 0.71 m tip to tip.
- **Coat:** hem at 0.64 m, widest at the belly (about 0.95 m high), shoulders at about 1.40 m. The swallow tails hang to about 0.30 m.
- **Legs:** 0.12–0.74 m, visible below the hem from 0.64 m, about 0.12–0.16 m in diameter. Shoes are about 0.42 m long including the upturned toe, spats 0.09–0.22 m.
- **Remote:** box about 0.17 × 0.09 × 0.27 m held at about 0.85–1.13 m; antenna tip with propeller at about 1.54 m.
- **Head-plus-hat to body ratio:** roughly 1 : 1.5, which keeps the storybook-chunky read at gameplay distance.

## Orientation and scale conventions

The blockout uses the WO111 authoring convention so the modeling author can keep it: Blender +Z up and the character facing Blender +Y, which becomes glTF +Y up / −Z forward on export. The root is floor-centred at the origin, and the character's right hand is +X.

The sheet shows four linked-data copies of one master at exactly the same orthographic scale, rotated 180° (front), −90° (side, facing right), 0° (back) and −135° (three-quarter). The height marker and dashed guides are in metres.

## Notes for the later modeling author

These are suggestions only; the coordinator's review of this sheet decides.

- **Budget:** the blockout is about 45k triangles of primitives and curves, far over budget. The final model must meet the WO099 contract: ≤ 15k triangles, ≤ 2 materials, one ≤ 1024 atlas, one skin with ≤ 4 influences, ≤ 2 MiB GLB, and exactly the clips `idle`, `move`, `attack`, `hit` and `defeat`.
- **Separate parts to retopologize:** keep the mustache, hat and remote as distinct parts. The remote should be rigidly weighted to the right hand, and the hat to a head-child bone.
- **Tails:** from the side, the swallow tails should be thin cloth panels close to the back of the thighs.
- **Arm pose:** the arms are posed for design. Rebuild them in a rig-friendly A-pose and recreate the fist-on-hip and remote poses in animation.
- **Possible acting:**
  - `idle`: twirls a mustache tip and gives a smug bob.
  - `move`: a strutting walk.
  - `attack` (about 2.0 s): raises the remote high while the propeller spins, a readable wind-up, then jabs the big button at about 1.25 s contact with a forward lean.
  - `hit`: the hat pops up and the mustache boings.
  - `defeat`: the hat slides down over his eyes, he plops onto his coat tails, and the antenna droops. The pose is held.

## Provenance

- **Authoring:** Claude Opus 5.5 (`claude-opus-5-5`) through the cluster Blender MCP service (Blender 4.5.13 LTS), under Tom's September 26 ruling. Opus continues WO111 Blender work after Codex's usage limit, and assets without an Astra concept are modeled from a painted Blender reference sheet.
- **No image generation:** no image-generation model, external asset API, photo or third-party artwork was used. Every pixel comes from the procedural blockout rendered with Cycles on CPU, with Freestyle plum-ink outlines and a Standard view transform, so the parchment backdrop renders exactly as `#f5ebdc`.
- **Scripts:** `source/build_blockout.py` builds the blockout, `source/sheet.py` builds and renders the sheet, `source/sheet_preview.py` renders the half-size preview, and `source/run.py` handles the MCP transfer and execution.
- **Scene lease:** see `scene-lease.json` and `scene-release.json`. This task took over a stale `gadget-helper` lease left when the Codex art lead hit its usage limit at 2026-09-26T01:42Z. The pre-takeover scene is preserved as `pre-takeover-live-scene.blend`. No gadget-helper file was changed, and that model has not been started.
