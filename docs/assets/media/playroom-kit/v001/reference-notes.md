# playroom-kit v001 · reference notes

**Source:** Blender reference sheet, no generated concept.
**Status:** Kit sheet ready for coordinator review before any modeling or GLB work. Tom's exact-version review is still open. Once modeled, the props carry "Awaiting Tom's review · used in the family release" (PRD-004 Q-03).
**Role:** WO111 priority 3, the World B chapter 1 kit (the toddler sing-along playroom, ages 0–2) from the locked DESIGN-026 roster. Its chapter boss is `honk-bus` and its ordinary is `yes-yes-veggie`.
**Scope:** The four `playroom` props in `src/shared/theme-kits.ts` on `origin/main`, with those exact ids: `stacking-block-tower`, `toy-bus-garage`, `crib-rail-fence` and `giant-plush-ball`. Each blockout stays inside its registry box, so decor already placed in World B chapter 1 (`scripts/levels/family/b1.ts`) stays valid.
**Files:**

- `reference-sheet.png` (2048 × 1024).
- `playroom-kit-blockout.blend`: the master. It holds one collection per prop, `PK <prop-id>`, under `Playroom kit blockout (master)`. Every prop is floor-centred at the world origin, so the four overlap; toggle the collections to see one at a time.
- `playroom-kit-reference-sheet.blend`: the same master plus the sheet scene.
- `preview/`: close-up renders, two per prop.
- `source/`: the scripts.
- `blockout-measurements.json` and `part-measurements.json`: whole-prop and per-feature bounds.

## Kit direction

A soft pastel nursery, as a toddler would see it: big, chunky, rounded toys, with nothing sharp, thin or scary. Tom's September 26 ruling allows genuinely scary where the era fits (DESIGN-027), but the toddler sing-along playroom is not that era, so this kit stays gentle.

The four props share one construction language:

- generous bevels, like soft vinyl foam or painted toy wood;
- flat pastel colour with a few deeper accents (rose, blue, honey, night);
- raised appliqué shapes (stars, hearts, circles, triangles) as the recurring motif.

There is no lettering, logo, brand toy design or face anywhere. The garage deliberately has no pair of windows beside its door, so it never reads as a face competing with the Honk Bus.

The pastels start from the registry's fallback colours and the playroom world theme: sky `#fde8f0`, carpet `#f3d9c6`, baby-blue platforms with cream tops and pink edges. The props sit on that carpet and on those decks, so each one also carries a darker accent for value contrast in game, where the sheet's ink outlines do not exist.

## Orientation, scale and sheet conventions

- **Axes.** Blender +Z is up and each prop's visible front faces −Y. On export that becomes glTF +Y up with the front toward +Z, the registry's "+Z toward the player at rotation 0", as in `toon-clubhouse-kit`. The viewer's right is +X, and the origin is the floor centre of the footprint. Coordinates below are Blender metres (front at −y).
- **Front row.** Rotation 0, exactly as the level places the prop at rotation 0.
- **Three-quarter row.** Turned 40° anticlockwise seen from above. It shows the front and the prop's −X side (the viewer's left).
- **Scale.** All eight figures share one orthographic scale: 15.901 m across the sheet, 128.8 px/m.
- **Rulers and guides.** Each row has a metre ruler with 10 cm ticks and labels every 50 cm, plus faint guides every 50 cm.
- **Registry boxes.** Dashed honey lines outline each prop's box: its front face behind the front view, and its turned silhouette behind the three-quarter view.
- **Construction.** Every part is a plain bevelled primitive, lathe, sweep or outline slab, with no booleans or metaballs. Small painted details stay out of the ink lineset (`sheet_no_ink`): the post hearts, road dashes, pictogram windows, traffic lamps and garage interior.

## Sizes against the registry boxes

Sizes are width (x) × height × depth, in metres.

| Prop id | Registry box | Blockout | glTF bounds (min → max) | Inside the box |
| --- | --- | --- | --- | --- |
| `stacking-block-tower` | 1.40 × 2.40 × 1.40 | 1.358 × 2.400 × 1.358 | (−0.679, 0, −0.679) → (0.679, 2.400, 0.679) | yes |
| `toy-bus-garage` | 4.00 × 2.20 × 3.20 | 3.974 × 2.195 × 3.160 | (−1.994, 0, −1.580) → (1.980, 2.195, 1.580) | yes |
| `crib-rail-fence` | 3.20 × 0.90 × 0.24 | 3.200 × 0.900 × 0.182 | (−1.600, 0, −0.085) → (1.600, 0.900, 0.097) | yes |
| `giant-plush-ball` | 1.80 × 1.80 × 1.80 | 1.771 × 1.765 × 1.771 | (−0.894, 0.001, −0.877) → (0.877, 1.765, 0.894) | yes |

Every blockout is within 3% of its box on each axis, except the fence, which is 0.18 of its 0.24 m depth. No box needs to grow. After modeling, register the tight measured bounds, as the clubhouse kit did.

## `stacking-block-tower`

**Intent.** A wobbly tower of three giant soft foam play blocks, like the squashy shape blocks toddlers stack and knock over. It is the chapter's landmark and stilt prop.

**Placement it must survive.** World B chapter 1 stacks this prop in columns **2.4 m apart** (`landmark()`, up to three units high at scales of 1–4). It also stands it under the floating pillow pads as stilts (`stiltsUnder()`, which scales from the 0.7 m half-width). So:

- the tower is exactly 2.40 m tall;
- its top and bottom faces are flat and level;
- nothing rises above 2.40 m or dips below 0;
- each block is exactly 0.80 m tall, so stacked units read as one continuous tower.

**Parts:**

1. **Bottom block, pink.** 1.24 m square, turned +7°.
2. **Middle block, sky.** 1.16 m square, turned −9° and nudged 0.03 m toward +X.
3. **Top block, mint.** 1.20 m square, turned +4° and nudged 0.03 m toward −X.

Each block is 0.80 m tall with a 0.10 m, five-segment soft bevel. The alternating turns give the playful wobble while every corner stays inside ±0.70 m (measured ±0.679 m).

Each side face carries one **raised appliqué shape**, 0.03 m proud with a soft edge and rounded points: a star (0.43 m across), a heart (0.44 m wide), a circle (0.38 m) or a triangle (drawn on a 0.46 m side before its corners are rounded). The colours contrast with the block:

| Block | Front | +X | Back | −X |
| --- | --- | --- | --- | --- |
| 1 (pink) | honey star | sky circle | mint triangle | blue heart |
| 2 (sky) | rose heart | pink triangle | cream star | honey circle |
| 3 (mint) | lilac triangle | honey heart | blue circle | rose star |

**Blockout:** 15 parts and 7,068 triangles.

## `toy-bus-garage`

**Intent.** The Honk Bus's home: a chunky toddler-playset garage with a big open doorway, a round bus-sign badge, a traffic-light tower and a squeeze-bulb honk horn. It is the first thing in view in World B chapter 1, placed beside the nap rug at **scale 1.9** and turned −90° (`decor("bus-garage", …)`).

**Honk Bus fit.** The doorway is 1.50 m wide × 1.35 m tall, with 0.32 m rounded top corners. The interior is 2.12 m deep. At the placed scale of 1.9 that becomes 2.85 × 2.57 m, 4.0 m deep. The `honk-bus` v001 boss (2.097 × 2.30 × 2.465 m) would fit inside, so the garage reads as its home at the right size.

**Parts:**

1. **Base tray, mint.** 3.96 × 0.08 × 3.16 m with 0.30 m rounded corners: the toy's plastic base.
2. **Toy road, blue.** 1.40 m wide and 0.014 m high, running from the tray's front edge (y = −1.50) in through the door to y = +1.25, with four cream dashes.
3. **Garage body, butter.** A hollow shell of 0.14 m walls on x −1.90…0.76 (2.66 m wide, centred at x = −0.57) and y −0.95…1.45 (2.40 m deep). The walls stand to 1.62 m. The front and back walls rise into elliptic gables that reach 2.10 m.
4. **Doorway.** A notch in the front wall, centred on the body, from the tray top (0.08 m) to 1.43 m. A dark night-lilac liner (open at the front) lines the inside, so the doorway reads as a deep garage.
5. **Pink door-frame piping.** A 0.12 m round tube around the doorway.
6. **Pink corner posts.** At both front corners, 0.17 m thick, with 0.20 m balls on top (to 1.72 m).
7. **Half-raised roll-up door.** Three slats (blue, cream, blue), each 0.115 m tall, filling the top 0.37 m of the doorway (1.06–1.42 m).
8. **Barrel roof, lilac.** An elliptic shell, 0.08 m thick, with outer semi-axes of 1.41 × 0.56 m. It overhangs 0.07 m front and back (y −1.02…1.52). The shell top is at 2.18 m.
9. **Four pink piping ribs.** One at each roof edge and two across the middle. They top out at 2.195 m, the highest point of the prop.
10. **Gable badge.** A 0.52 m cream-rimmed disc centred at 1.81 m, with a 0.43 m blue face. On it is a cream bus pictogram (0.30 × 0.15 m) with three blue windows and two night wheels. It carries no lettering.
11. **Two portholes on the −X side wall.** Cream frames 0.40 m across with sky panes, at z = 0.98 m and y = −0.25 and +0.65. They show in the three-quarter view.
12. **Traffic-light tower.** Standing at (1.42, −0.30):
    - a 0.84 m mint drum (0.08–1.50 m);
    - a cream band;
    - a rose dome to 1.90 m;
    - on its front, a cream traffic light 0.27 × 0.68 m (0.68–1.36 m) with 0.15 m lamps in rose, honey and mint.
13. **Honk horn.** On top of the dome: a rose squeeze bulb and a honey trumpet pointing at the player, with a 0.21 m bell mouth. Its top is at 2.094 m. It nods to the boss's roof trumpet and gives the garage a honk sound cue.

**Blockout:** 46 parts and 27,500 triangles.

## `crib-rail-fence`

**Intent.** One panel of a nursery crib rail: soft, rounded and safe-looking, with a bead-slide toy in the middle bay. World B chapter 1 hangs it as a skirt on the crib deck's open sides:

- its top sits 0.05 m below the deck top;
- it is turned 90° along decks that run in Z;
- runs of panels are placed **3.2 m apart**: `crib-fence-west-1…3` at z −60.9, −64.1 and −67.3.

So it must **tile end to end**.

**Parts:**

1. **End posts, sky.** 0.12 × 0.76 × 0.17 m, centred at x = ±1.54 and flush with the panel ends. Two tiled panels meet in a chunky double post.
2. **Tiny rose hearts** on the front of each post, as painted details.
3. **Soft teether top rail, mint.** The full 3.20 m length, 0.14 m tall and 0.17 m deep (0.76–0.90 m), with a 0.06 m round bevel. Tiled rails join with a small rounded notch every 3.2 m.
4. **Bottom rail, cream.** 0.11 × 0.10 m at 0.06–0.16 m. It is 3.04 m long with its ends buried in the posts; an earlier full-length rail z-fought with the post faces.
5. **Ten cream spindles.** 0.056 m across, at a 0.197 m pitch, 0.14–0.78 m.
6. **Bead slide.** The two middle spindle pairs are left out, leaving a 0.99 m bay. Two lilac rods cross it at 0.36 and 0.56 m, with five chunky beads each (0.12 × 0.15 × 0.15 m) in pink, honey, mint, sky and rose. The beads are pushed to the sides as if a toddler had been playing.

The posts start at the floor, so the panel can also stand on the carpet as a low fence.

**Blockout:** 28 parts and 13,240 triangles.

## `giant-plush-ball`

**Intent.** A huge, squashy, eight-panel plush ball with piped seams and felt appliqués. World B chapter 1 uses it in two ways:

- scattered on the carpet at **scales of 1.6–3.0**, so the balls are 2.8–5.3 m across in game;
- as a **crib mobile** high above the spinning crib bar: a hub at scale 0.8 and a ring of four at scale 0.45.

It has to read both as a giant soft toy and as a small hanging one.

**Parts:**

1. **Eight plush panels.** Pink, sky, butter and mint, twice round, with the pink panel centred on the front. Built on a 0.835 m sphere squashed 2.5% vertically, each panel puffs 5% at its middle (to a 0.877 m radius), so the seams read pinched in and the silhouette is faintly lobed.
2. **Cream seam piping.** A 0.044 m round cord along every seam.
3. **Cream button caps.** 0.22 m across, at both poles. The bottom cap and piping just touch the floor.
4. **Lilac ribbon tag loop.** 0.19 m wide × 0.13 m tall on top, to 1.765 m. It is what the mobile balls hang by.
5. **Felt appliqués.** A honey star (0.38 m) on the front pink panel and a rose heart (0.35 m) on the butter panel facing −X, both following the puffed surface.

**Blockout:** 21 parts and 23,840 triangles.

## Palette (sRGB hex; flat painted blockout materials)

| Swatch | Hex | Used for |
| --- | --- | --- |
| cream | `#fdf6ec` | spindles, bottom rail, badge rim and pictogram, road dashes, traffic-light housing, tower band, ball piping and caps, one block star |
| pink | `#f4a7b9` | block 1, garage piping, ribs and corner posts, ball panels, one block triangle |
| rose | `#e8829f` | block hearts and star, tower dome, horn bulb, stop lamp, fence post hearts, fence beads, ball heart |
| sky | `#a7d8f4` | block 2, fence posts, porthole panes, ball panels, fence beads, one block circle |
| blue | `#6fb1e3` | toy road, roll-up door slats, badge face, pictogram windows, one block heart and one block circle |
| butter | `#fbe3a1` | garage walls, ball panels |
| honey | `#f2c65c` | block star, circle and heart, horn trumpet, amber lamp, fence beads, ball star |
| lilac | `#b9a7f4` | garage roof, bead rods, ribbon loop, one block triangle |
| mint | `#a7e0c8` | block 3, base tray, tower drum, teether rail, go lamp, ball panels, fence beads, one block triangle |
| night | `#5a4a7c` | garage interior, pictogram wheels |

The blockout uses 21 materials: 10 colours in a matte foam finish, a plush finish with sheen, and a gloss finish for lamps and panes. The sheet parchment, ink and guide colours are sheet dressing, not prop colours: parchment `#f5ebdc`, ink `#342c46`, registry boxes `#c9953f`.

## Notes for the later modeling author

These are suggestions only; the coordinator's review of this sheet decides.

**Contract (WO111 props):**

- static meshes, one GLB per registry id;
- ≤ 5k triangles, ≤ 4 materials and ≤ 1.5 MiB each, self-contained;
- floor-centred, with the front toward glTF +Z (Blender −Y);
- record the tight measured bbox in the handoff for the theme-kit registry.

Follow `toon-clubhouse-kit/v001`'s route: vertex colours only, one joined mesh per prop, and Khronos validation with zero errors and zero warnings.

**Materials.** Use vertex colours with at most three or four materials per prop:

- a soft matte for foam and painted toy wood (all props);
- a plush fabric, with high roughness and sheen, for the ball;
- an optional gloss for the traffic lamps and porthole panes;
- a dark unlit-looking interior for the garage liner.

Bake soft occlusion into the vertex colours (as the veggie did). The playroom is pastel on pastel, and occlusion in the creases (block seams, door jamb, spindle bays, ball seams) is what keeps the shapes readable without the sheet's ink.

**Triangle budgets.** The blockout counts are far over budget in places. Where to cut:

- **Tower** (7.1k → about 2.5k):
  - three bevel segments instead of five;
  - 16–24-point appliqué outlines;
  - keep the top and bottom faces flat and exactly 2.40 m apart.
- **Garage** (27.5k → about 4.5k):
  - The roof ribs are 7.7k in the blockout. Make them 8-sided tubes on about 24 segments, or model them as raised bands.
  - Drop the badge to 32 segments and paint the pictogram in vertex colour.
  - Use 24-segment portholes.
  - Use low discs for the lamps.
  - Paint the road and dashes on the tray top.
  - Keep the liner as five quads.
- **Fence** (13.2k → about 2k):
  - The beads are 7.4k. Use 12 × 8 spheres or rounded octagon prisms.
  - Use 8-sided spindles without bevels.
  - Keep the rounded top rail. It is the silhouette.
- **Ball** (23.8k → about 4k):
  - one welded sphere of about 32 × 20 with the panel colours as vertex-colour bands;
  - puff by displacing the vertices;
  - seams as 6-sided piping tubes or a painted groove plus a slight crease;
  - the appliqués as roughly 100-triangle raised patches;
  - a thin torus for the tag loop.

**Keep as geometry**, because each carries the silhouette or the read:

- the block wobble and the raised shapes;
- the garage doorway depth, piping, corner posts, barrel roof, badge disc, tower, dome, traffic-light housing and horn;
- the fence posts, rails, spindles and beads;
- the ball's lobed panels, piping, caps and tag loop.

**Tiling and stacking are gameplay-visible:**

- The tower must stack seamlessly every 2.40 m.
- The fence must tile every 3.20 m with its posts flush to x = ±1.60 and the teether rail running the full length.
- The ball's tag loop must stay on top, since the mobile hangs from it.

The garage doorway must stay at least 1.35 m tall and 1.40 m wide locally, so the Honk Bus still fits at the placed scale of 1.9.

**No animation is needed.** An optional later touch, outside this contract: the traffic light could cycle in game via a material swap, and the horn could squeeze once when the Honk Bus fight starts. Pair any honk with the audio service (DESIGN-008).

## What makes it original

- **Generic nursery toys.** Foam shape blocks, a toy garage, a crib rail with a bead slide and a panelled plush ball are universal toddler-toy types. None copies a brand's playset, block set or plush design.
- **No lettering or logos.** No numbers, alphabet blocks, brand marks or signage text. The garage badge uses a generic bus pictogram.
- **No faces or characters.** The friendly and enemy cast stay the only characters in the room.
- **Its own palette,** derived from the registry fallbacks and the playroom world theme, plus deeper accents for readability.
- **Kid-safe:**
  - everything is rounded and soft, with no sharp edges, small detached parts or thin spikes;
  - the doorway is dark but framed in pink with a striped half-open door, so it reads as a garage and not a scary opening;
  - there is no gore, damage, grime or menace.
