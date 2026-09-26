# magic-house v001 · reference notes

**Source:** Blender reference sheet, no generated concept.
**Status:** Sheet ready for coordinator review before any detailing, rigging or GLB work. Tom's exact-version review is still open. Once modeled, the candidate carries "Awaiting Tom's review · used in the family release" (PRD-004 Q-03).
**Role:** WO111 priority 4, World B chapter 2 boss (ages 2–4 era: Bluey and Encanto), from the locked DESIGN-026 roster.
**Files:**

- `reference-sheet.png` (2048 × 1024): front, side, back and three-quarter views.
- `magic-house-blockout.blend`: the blockout master at the origin.
- `magic-house-reference-sheet.blend`: the same master plus the sheet scene.
- Close-up review renders of the same scene in `preview/`: whole front, face, side and three-quarter views at 1024 px, plus a half-size sheet.
- Scripts in `source/`.

## Design intent

The magic house is a small living cottage that loves to show off. It is cheeky rather than scary: it grins, sticks out its doormat tongue and gives you a sly side-eye while its roof tiles hop about. The boss fight should feel like a game of tag with a playful house. Its age band is 2–4, so every feature is big, round and easy to name: eyes, mouth, tongue, feet and roof.

Silhouette, from top to bottom:

1. **Hopping roof tiles.** Five barrel tiles and one ridge cap have popped out of their rows and hover, twisting, 0.24–0.33 m above their empty slots. In every view they break the roofline, which is the main "magic" read.
2. **A steep front gable with a big overhang.** This is the triangle-on-a-box house that a small child draws. The roof is terracotta barrel tile on a timber deck. A chimney wearing a little tile hat leans jauntily out of the house's left slope.
3. **A candle niche** glows in the gable above the face like a little heart.
4. **The face** fills the front wall:
   - two big arched windows for eyes, with blue louvred shutter lids and flung-open side shutters as lashes;
   - flower boxes under the eyes as rosy cheeks;
   - a grin-shaped double doorway for a mouth, with its honey doors thrown open.
5. **A striped doormat tongue** hangs out over the front step and down between the legs, with a curled tip.
6. **Two stubby timber-stump legs** end in round teal clogs. The house stands on them with a visible gap underneath. They give it a waddle and a readable walk.
7. **Asymmetry for readability:** a blue balcony with flower pots on the house's right, a bougainvillea vine up its left front corner, and the chimney on the left slope. The front view therefore never reads as a flat, symmetric box.

**Expression.** The house's left lid is lowered, with its inner edge tilted down so it cuts the top of the pupil: the sly eye. Its right lid is raised with the inner edge tilted up: the cheeky brow. Both pupils glance to the house's right. With the wide grin and the tongue, the face reads as "hehe, catch me".

## Parody hooks

These are recognizable cues. None is a copied design.

| Hook | How it appears here |
| --- | --- |
| A living house that talks with its shutters, doors and tiles | These parts become an actual face: the shutters are eyes and lids, the doorway is a grinning mouth, and the roof tiles dance on their own. |
| Dancing tiles | Barrel tiles hop out of their rows. The empty slots show the timber deck beneath, and the ridge tile hops highest. |
| The magic candle | A cream candle glows in an arched plum niche in the gable. |
| Butterflies | Two small coral-and-honey butterflies flutter by the eaves. |
| Warm Colombian-style casita | Apricot stucco over a teal painted base band (zócalo), terracotta barrel tiles, blue louvred shutters, a wooden balcony with pots, round viga beam ends under the eaves, and bougainvillea. |
| Gentle Bluey-era nod | Like a Queenslander, the house is raised on timber stumps, and the stumps have become its stubby legs. This nod stays subtle; the `bin-chicken` ordinary carries the Australian hook. |

## What makes it original

- **No copied names, text, logos, faces or designs.** The sheet has no lettering on the character, and its name stays generic ("magic house").
- **It takes the idea of an expressive house, not a film's architecture.** It is a small single-storey gabled cottage on legs, with our own face construction: arched-window eyes, a Bahama-shutter lid on each, flower-box cheeks, a grin doorway and a doormat tongue. It has no copied door designs, courtyard, tower, symbols or characters.
- **The palette comes from our storybook brief.** Apricot stucco, teal, terracotta, honey, plum ink and a muted blue are anchored on the brief's honey and plum and on its warm, soft light.
- **Our own inventions:** the stump legs and clogs, the doormat tongue, the lid-and-shutter eyes, the tile-hatted leaning chimney, and hopping tiles that leave visible empty slots.
- **Kid-safe:** it has no teeth, claws or weapons. The mouth is a grin with a tongue out, the eyes are sly rather than angry, and the "magic" is tiles, flowers, a candle and butterflies.

## Colors (sRGB hex; flat painted blockout materials)

| Part | Hex |
| --- | --- |
| Walls, gable, chimney stack | `#f1c28c` apricot stucco |
| Zócalo base band, clog feet, one dancing tile | `#3f7f7a` teal |
| Window and door frames, lower lip, step, flower boxes, pots, chimney cap | `#c4643f` terracotta trim |
| Floor slab | `#9a4a32` deep terracotta |
| Roof tiles (three alternating shades) | `#c2583a`, `#a8472f`, `#cf6c45` |
| Ridge caps, chimney tile hat | `#963f2b` |
| Roof deck, stump legs, balcony floor and corbels, vigas | `#7a4a2e` timber |
| Shutters, eyelids, balcony railing, side door, one dancing tile | `#4e8ab8` blue, with `#3d6f99` louvres |
| Door leaves | `#e3a33f` honey-orange |
| Mouth interior, candle niche, back vent | `#3a2842` plum |
| Doormat tongue | `#c9506a` raspberry with `#dca953` honey stripes |
| Eye whites, pupil sparkle | `#fbf6ec` |
| Pupils, butterfly bodies | `#342c46` plum ink |
| Foot bands, door knobs, one dancing tile | `#dca953` honey |
| Door flowers, one dancing tile, butterfly wings | `#e07a5f` coral with `#f3e6cf` cream |
| Flowers and bougainvillea | `#d24f86` magenta, `#ee8fb0` pink, `#f2cf5b` yellow |
| Vine and leaves | `#557363`, `#6f9a5e` |
| Candle / flame / glow | `#f3e6cf` / `#ffcf6b` (emissive) / `#f6c768` (soft emissive) |

## Proportions (measured from the blockout; metres, floor at 0)

- **Overall:**
  - 2.90 m to the top of the hopping ridge tile; 2.80 m solid, to the top of the chimney's tile hat.
  - The bounding box is 2.56 wide (X: −1.26 at the left eave tiles to +1.30 at the balcony flower pots) × 1.96 deep (Y: −0.86 at the back eave to +1.10 at the tongue tip) × 2.90 high.
  - Without the balcony, eaves and tongue, the wall body is about 1.86 × 1.40 m.
- **Legs and feet:**
  - The stumps run from 0.11 to 0.41 m at x = ±0.48, about 0.24 m in diameter, with a honey band at the ankle.
  - The clogs are about 0.36 wide × 0.54 long × 0.17 tall.
  - Floor slab: 0.38–0.52 m, about 1.96 × 1.48 m.
- **Walls:** 0.50–1.80 m, with a slight adobe flare at the foot. The teal zócalo band runs 0.50–0.80 m.
- **Roof:**
  - The gable runs from 1.80 m to the ridge at 2.52 m, a pitch of about 38.7°.
  - The timber deck overhangs about 0.25 m at the sides and 0.19 m at the front and back.
  - The deck top is about 2.61 m at the ridge, and the ridge caps reach about 2.66 m.
  - The chimney stack is 0.26 × 0.26 m and leans outward over the house's left slope.
- **Eyes:**
  - Arched windows 0.49 wide × 0.58 tall, 1.17–1.75 m, centred at x = ±0.47.
  - Pupils about 0.18 × 0.22 m.
  - Lids: the house's right one sits at about 1.57 m (raised), its left one at about 1.47 m (lowered).
  - Side shutters 0.15 × 0.51 m, open about 35° off the wall.
- **Mouth:**
  - The grin doorway is 0.72 m wide, from the lower-lip bottom at 0.52 m to the crown at 0.98 m, with corners at 0.80–0.88 m.
  - The honey door leaves are opened about 140°. Their free edges stand about 0.23 m out from the wall.
- **Tongue:** 0.26 m wide at the root, widening to 0.38 m. It lies over the step, then hangs to about 0.19 m with a forward curl.
- **Candle niche:** about 0.20 × 0.24 m at 1.96–2.20 m.
- **Balcony:** on the house's right side. The floor is at 1.15 m, it projects 0.36 m, and the top rail is at 1.42 m.
- **Mass split:** legs about 14% of the solid height (0–0.38 m), slab and face walls about 51% (0.38–1.80 m), roof and chimney about 36% (1.80–2.80 m). This keeps the face large at gameplay distance.

## Orientation and scale conventions

- The blockout uses the WO111 authoring convention so the modeling author can keep it.
  - Blender +Z is up and the house faces Blender +Y, which becomes glTF +Y up / −Z forward on export.
  - The root is floor-centred at the origin, and the house's right is +X.
- The sheet shows four linked-data copies of one master at exactly the same orthographic scale:
  - front: rotated 180°;
  - side: −90°, showing the house's right side with the balcony, facing right;
  - back: 0°;
  - three-quarter: −135°, showing the front and the right side.
- The height marker and dashed guides are in metres. The short second tick on the ruler marks the 2.80 m solid top.

## Notes for the later modeling author

These are suggestions only; the coordinator's review of this sheet decides.

- **Budget:** the blockout is about 45k triangles of primitives and curves, far over budget. The final model must meet the WO099 contract: ≤ 15k triangles, ≤ 2 materials, one ≤ 1024 atlas, one skin with ≤ 4 influences, ≤ 2 MiB GLB, and exactly the clips `idle`, `move`, `attack`, `hit` and `defeat`.
  - Replace the roughly 180 static barrel tiles with a few low-relief roof strips and paint the tile rows into the atlas. Keep only the six dancing tiles as real geometry.
  - Paint the louvres into the atlas as well, and reduce the flowers to a few low-poly clumps.
  - The candle glow can be painted or vertex-lit into the atlas, so no third material is needed.
- **Parts to rig:** a root bone, and a body bone for squash and stretch. Add:
  - the two legs and clogs;
  - the roof, and a chimney child bone;
  - one bone per dancing tile;
  - the two lids and four side shutters;
  - the two door leaves, plus a lower-lip (jaw) bone so the grin can open and close;
  - a 3-bone tongue chain.
  - The butterflies are optional. Drop them if the budget is tight; the casita kit's candle-and-butterfly arch can carry that motif.
- **Possible acting:**
  - `idle`: the tiles bob in a ripple across the roof, the lids blink out of step, and the house sways on its stumps.
  - `move`: a waddle-hop on the stumps with the doors flapping and the tongue swinging.
  - `attack` (about 2.0 s): the wind-up is readable. The house leans back, flings its shutters wide and lifts its tiles. At about 1.25 s contact, the doormat tongue slaps forward and unrolls along the floor as a low sweep a child can jump, then it slurps back. A tile-toss variant is possible: tiles pop up and plop down in a telegraphed ring.
  - `hit`: the shutters slam shut and spring open, the tiles jump and the house wobbles like jelly.
  - `defeat`: the roof tiles slide down over its eyes like a floppy hat, the stumps splay, and it plops down with the tongue out while the candle shrinks to a tiny warm ember. The pose is held.

## Provenance

- **Authoring:** Claude Opus 5.5 (`claude-opus-5-5`) through the cluster Blender MCP service (Blender 4.5.13 LTS), under Tom's September 26 ruling. Opus continues WO111 Blender work after Codex's usage limit, and assets without an Astra concept are modeled from a painted Blender reference sheet.
- **No image generation:** no image-generation model, external asset API, photo or third-party artwork was used.
  - Every pixel comes from the procedural blockout rendered with Cycles on CPU at 48 samples, with Freestyle plum-ink outlines and a Standard view transform.
  - The parchment backdrop measured `#f5ebdc` (245, 235, 220) in the saved PNG, within one level at one corner.
- **Scripts:**
  - `source/build_blockout.py` builds the blockout and saves the master and `blockout-measurements.json`.
  - `source/sheet.py` builds and renders the sheet, adapted from the rival-mayor sheet.
  - `source/sheet_preview.py` renders the half-size preview.
  - `source/crops.py` renders the review crops and restores the sheet camera.
  - `source/release.py` performs the saved scene release.
  - `source/run.py` handles the MCP transfer and execution, guarded by the lease.
- **Scene lease:** see `scene-lease.json` and `scene-release.json`. This task claimed the scene at 2026-09-26T02:30:02Z. The predecessor was the rival-mayor v001 release: saved live scene `3c8a63ed…`, released 02:28:08Z, with no active lease. No other asset's files were changed.
