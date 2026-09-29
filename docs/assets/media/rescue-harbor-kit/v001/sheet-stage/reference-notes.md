# rescue-harbor-kit v001 · reference notes

**Source:** Blender reference sheet, no generated concept.
**Status:** Kit sheet ready for coordinator review before any modeling or GLB work. Tom's exact-version review is still open. Once modeled, the props carry "Awaiting Tom's review · used in the family release" (PRD-004 Q-03).
**Role:** WO111 priority 5, the World A chapter 2 kit (Harbor Rescue, the rescue-pup seaside town, ages 2–5) from the locked DESIGN-026 roster. Its chapter boss is `rival-mayor` and its ordinary is `mischief-kitten`.
**Scope:** The four `harbor` props in `src/shared/theme-kits.ts` on `origin/main`, with those exact ids: `lookout-tower-facade`, `pier-bollard`, `rescue-buoy-stand` and `small-boat`. Each blockout stays inside its registry box, so decor already placed in World A chapter 2 (`scripts/levels/family/a2.ts`) stays valid.
**Files:**

- `reference-sheet.png` (2048 × 1024).
- `rescue-harbor-kit-blockout.blend`: the master. It holds one collection per prop, `RH <prop-id>`, under `Rescue harbor kit blockout (master)`. Every prop is floor-centred at the world origin, so the four overlap; toggle the collections to see one at a time.
- `rescue-harbor-kit-reference-sheet.blend`: the same master plus the sheet scene.
- `preview/`: close-up renders, two per prop plus the boat from above, and the last half-size sheet preview.
- `source/`: the scripts.
- `blockout-measurements.json` and `part-measurements.json`: whole-prop and per-feature bounds.

## Kit direction

A bright, sunny rescue harbor for a preschool rescue-pup show era: chunky, toy-like and readable at a distance, with nothing sharp or menacing. Tom's September 26 ruling welcomes genuinely scary where the era fits (DESIGN-027), but Harbor Rescue is scare level 0 in DESIGN-027's table, so this kit stays cheerful.

The four props share one construction language:

- **rescue red and yellow** paint for everything that says "rescue": the tower cabin, roof and railing, the boat's hull and fender collar, the life rings and the bollard's safety cap;
- **weathered wood** for everything structural: the trestle, the piling, the stand's posts and the boat's interior, with a darker wet-wood tone where each prop meets the water;
- **sea blues** as accents: navy iron (bollard, telescope, motor, backboard), aqua glass and a sea-blue wave motif;
- three recurring motifs: the **red-and-cream life ring**, the **cartoon bone** and the **paw print** (the rescue-pup cues), plus waves.

There is no lettering, number, logo or badge anywhere. The paw prints are plain generic paw prints, never inside a shield.

The colours start from the registry's fallback colours and the harbor world theme (`src/game/world-themes.ts`): sky `#9fd4f0`, water `#2f7fb8`, platform sides `#a8835b` with `#d9c3a0` tops, yellow edges `#f7c948`, red rails `#d64533`, and the dock-ride boats in red, cream `#f2efe6`, yellow and navy `#2e4a62`. The props stand in that sea-blue water under that sky, so every prop leads with red, yellow or wood rather than blue, and the small boat matches the dock-ride boats' colour scheme.

## Orientation, scale and sheet conventions

- **Axes.** Blender +Z is up and each prop's visible front faces −Y. On export that becomes glTF +Y up with the front toward +Z, the registry's "+Z toward the player at rotation 0", as in `toon-clubhouse-kit`. The viewer's right is +X, and the origin is the floor centre of the footprint. Coordinates below are Blender metres (front at −y) unless marked glTF.
- **Two blocks at one scale.** A 7 m tower and a 0.8 m bollard share one orthographic scale: 22.292 m across the sheet, 91.9 px/m.
  - **Left:** the tower, front and three-quarter, on one ground line with a 0–7 m ruler.
  - **Right:** the bollard, buoy stand and boat in a FRONT row above a THREE-QUARTER row, each row with its own 0–2 m ruler.
  - **Plan view:** the boat also appears from directly above (top toward the camera, bow to the right, its +X side up), because the in-game chase camera sees the moored boats from overhead. The interior is not visible from eye level.
  - **Close-ups:** in `preview/`.
- **Front views.** Rotation 0, exactly as a level places the prop at rotation 0.
- **Three-quarter views.** Turned 40° anticlockwise seen from above, showing the front and the prop's −X side (the viewer's left).
- **Rulers and guides.** 10 cm ticks, labels every 1 m on the tower ruler and every 50 cm on the small rulers, plus faint guides every 50 cm.
- **Registry boxes.** Dashed honey lines outline each prop's box: its front face behind the front view, its turned silhouette behind the three-quarter view, and its footprint round the plan view.
- **Legend.** It lists the chapter's placements, from `a2.ts`.
- **Construction.** Every part is a plain bevelled primitive, lathe, sweep or outline slab; the hull is a lofted section. There are no booleans or metaballs. Small painted details stay out of the ink lineset (`sheet_no_ink`): the bone-sign paw, lens and loudhailer mouths, porthole pane, starfish, timber cracks, post grain, wave strip, floorboard seams and bow paws.

## Sizes against the registry boxes

Sizes are width (x) × height × depth, in metres. glTF bounds are Y-up, with +Z toward the player.

| Prop id | Registry box | Blockout | Fill (w / h / d) | glTF bounds (min → max) | Inside the box |
| --- | --- | --- | --- | --- | --- |
| `lookout-tower-facade` | 3.60 × 7.00 × 3.60 | 3.500 × 6.885 × 3.530 | 97% / 98% / 98% | (−1.750, 0, −1.750) → (1.750, 6.885, 1.780) | yes |
| `pier-bollard` | 0.60 × 0.80 × 0.60 | 0.567 × 0.787 × 0.567 | 94% / 98% / 94% | (−0.283, 0, −0.283) → (0.283, 0.787, 0.283) | yes |
| `rescue-buoy-stand` | 1.20 × 1.80 × 0.50 | 1.160 × 1.798 × 0.346 | 97% / 100% / 69% | (−0.580, 0, −0.120) → (0.580, 1.798, 0.226) | yes |
| `small-boat` | 2.40 × 1.10 × 5.20 | 2.249 × 1.080 × 5.167 | 94% / 98% / 99% | (−1.124, 0, −2.587) → (1.124, 1.080, 2.580) | yes |

No box needs to grow. The stand is only 0.35 m of its 0.50 m depth, which is harmless. After modeling, register the tight measured bounds, as the clubhouse kit did, but keep the height rules under **Placement rules** below.

## Placement rules from World A chapter 2

Every harbor prop in `a2.ts` stands with its origin on the scene's water plane (y = −1.4, 1.4 m below the dock top). `tests/levels/family-a2.test.ts` enforces a fake-foothold rule on the **registry** bounds: within 2.5 m of a walkable surface, a prop's top must be at least 0.5 m below that surface's lowest top, or at least 1.4 m above its highest.

| Prop | Placements | Rule | Consequence for the model |
| --- | --- | --- | --- |
| `pier-bollard` | 20 pilings: 10 beside the dock at scale 1.1, and 10 at the pier and market at scale 2 | tops ≥ 0.5 m below the decks | A lower top is always safe. The blockout's 0.787 m is under the box's 0.80 m. Never exceed 0.80 m. |
| `rescue-buoy-stand` | 6 at the dock and beach corners, scale 1.6, turned ±90° so they face the dock | tops ≥ 1.4 m above the dock | **The stand must stay at least 1.775 m tall** (1.775 × 1.6 − 1.4 = 1.44 m). The blockout is built to 1.798 m. A 1.715 m stand, registered at its measured height, would top out only 1.344 m above the dock and fail the test. |
| `small-boat` | 12 moored boats at scale 0.8, at every heading | tops ≥ 0.5 m below the dock | A lower top is safe. The blockout's 1.080 m is under the box's 1.10 m (0.864 m tall in game, top 0.536 m below the dock). |
| `lookout-tower-facade` | Rescue HQ beside spawn at scale 1.5 (10.3 m); the far lookout beyond the beacon crown at scale 3 (20.7 m); both at rotation 0 | far above every deck | Both face the player (+Z) at rotation 0. The far lookout is read across the chapter's 95 m era fog, so the silhouette matters most. |

**Waterline.** Because the origins sit on the water plane, the boat floats with its keel on the water, like a bath toy. Its cream stripe (0.15–0.235 m) is drawn where a real waterline would sit. If the coordinator wants it riding in the water, lower each boat by about 0.15 × scale in `a2.ts`; that is a level change and keeps the foothold rule. The other props mark where they meet the water in their own way: the bollard's wet tide band (0–0.13 m), the stand's wet feet (0–0.16 m) and the tower's stone footings (0–0.28 m).

## `lookout-tower-facade`

**Intent.** The town's rescue lookout: a red lifeguard-style cabin on a tall, splayed timber trestle, with a rescue ladder, a yellow balcony, a yellow hip roof and a beacon with loudhailer horns. A doghouse-arch door and a blank bone sign make it the rescue pups' HQ without copying any show's tower.

**Parts** (Blender metres; front at −y):

1. **Stone footings.** Four, 0.60 × 0.60 × 0.28 m, at (±1.45, ±1.45); grey stone.
2. **Timber legs.** Four, 0.24 m square: 1.45 m out at the footings, splaying in to 1.12 m under the deck (0.235–3.285 m); weathered wood.
3. **Bracing.** Driftwood X-bracing (0.09 × 0.05 m) on all four outer faces in two tiers (0.50–1.72 m and 1.88–3.10 m), with a wood girt at 1.80 m. The girts run 0.15 m past the legs, log-cabin style.
4. **Rescue ladder.** Up the front centre: yellow rails (0.08 m, 0.60 m apart) from the ground at y = −1.74 (their front edge at −1.78, 0.02 m inside the box), leaning to y = −1.44 at 4.20 m. The rails run on past the deck as grab handles, with red ball caps, and there are 11 wood rungs at 0.30 m.
5. **Deck.** A red fascia (3.04 m square, 3.25–3.39 m) under a 2.94 m driftwood plank top. The deck top is at 3.45 m.
6. **Balcony railing.** Yellow: 0.08 m posts, a top rail at 4.33 m and a mid rail at 3.90 m. It is open 0.84 m wide at the ladder.
7. **Balcony life ring.** Red-and-cream, eight segments, 0.63 m across, hung from the front-left top rail by a rope loop. A rope grab line is clipped at the four cream bands.
8. **Telescope.** A navy tube with yellow bands on a navy tripod at the front-right corner, pointing out to sea (top at 4.70 m).
9. **Cabin.** 2.20 × 2.20 × 2.00 m (3.45–5.45 m), rescue red.
10. **Window band.** 4.22–5.04 m. Cream frames with aqua panes: three panes on each side and the back, and one pane either side of the door on the front.
11. **Doghouse-arch door.** Yellow, 0.72 m wide, with a round arch to 4.98 m (its cream frame reaches 5.035 m). A cream porthole 0.26 m across with an aqua pane, and a navy knob.
12. **Bone sign.** A blank cream cartoon bone, 0.92 × 0.22 m, centred at 5.21 m under the eaves, with a small red paw print in its middle.
13. **Hip roof.** Yellow, eaves ±1.47 m at 5.51 m, apex at 6.30 m. A red fascia (5.39–5.51 m) and red hip ribs, which reach 6.36 m.
14. **Beacon.** A navy drum (r 0.20 m, 6.18–6.40 m); yellow lamp glass (r 0.16 m) with four cream bars (6.40–6.66 m); a red cap; a cream finial at 6.885 m, the prop's highest point.
15. **Loudhailer horns.** Two red horns with navy mouths on the drum, pointing ±X, 1.13 m tip to tip (6.22–6.46 m).

**Blockout:** 131 parts and 32,332 triangles.

## `pier-bollard`

**Intent.** A stout, weathered timber piling standing in the water, capped with a navy cast-iron mooring bollard painted safety yellow on top, with a mooring rope looped round it. The chapter uses it as the dock, pier and market pilings (scale 1.1 and 2), so it reads both as a piling and as a bollard.

**Parts:**

1. **Timber piling.** 0.49 m across (r 0.245 m), 0–0.55 m.
2. **Wet tide band.** Wet wood from 0 to about 0.13 m, with a wavy top edge (±0.018 m, seven waves round), so the waterline reads.
3. **Six cream barnacles** just above the tide line (front-left and front-right).
4. **One navy iron strap** at 0.47 m.
5. **Four painted cracks** in the timber.
6. **Coral starfish.** 0.16 m across, clinging to the front-left at 0.335 m.
7. **Base plate.** Navy iron, 0.57 m across (0.545–0.585 m).
8. **Bollard body.** A navy iron lathe with a waisted neck, 0.58–0.70 m.
9. **Bollard cap.** Safety yellow, 0.46 m across, 0.695–0.787 m.
10. **Mooring rope.** A tan loop round the waist and a tail that drapes over the plate edge and hangs down the piling's front-right, ending in a whipped end at 0.27 m.

**Blockout:** 20 parts and 8,408 triangles.

## `rescue-buoy-stand`

**Intent.** A dockside life-ring stand: two weathered posts, a bright yellow header board and a navy backboard that makes the red-and-cream ring pop, plus a coiled throw line. The chapter places six at the dock and beach corners at scale 1.6 (2.88 m tall), turned to face the dock.

**Parts:**

1. **Posts.** Two, 0.12 m square, at x = ±0.46 (0–1.66 m), with wet-wood feet (0–0.16 m) and painted grain lines.
2. **Red cap balls.** 0.16 m across, to 1.798 m, which sets the height rule above.
3. **Lower rail.** Wood, 0.86 × 0.08 m, at 0.42 m.
4. **Navy backboard.** 0.84 × 0.84 m (0.53–1.37 m), behind the ring.
5. **Header board.** Yellow, 1.14 × 0.26 m (1.34–1.60 m), in front of the posts. It has a red top trim to 1.635 m, a sea-blue wave strip along its lower edge and a small blank cream bone (0.38 m wide).
6. **Ring peg.** Navy, at 1.19 m, passing through the ring's hole.
7. **Life ring.** 0.71 m across (centre at 0.95 m), eight segments alternating red and cream, 0.13 m in front of the posts.
8. **Grab line.** A rope line clipped round the tube at the four cream bands and swagged between them.
9. **Throw line.** Three rope coils hanging on a navy hook on the right post (0.78–1.11 m).

**Blockout:** 35 parts and 15,836 triangles.

## `small-boat`

**Intent.** A chunky rescue rowboat in the same colours as the dock-ride boats: a red round-bilge hull with a fat yellow fender collar, a cream waterline stripe and a navy bottom. Inside are weathered floorboards, three thwarts and a pair of shipped oars, with a little outboard on the transom. It is decor only: twelve moored boats at scale 0.8, at every heading, seen mostly from above by the chase camera, so its interior is part of the design (see the plan view).

**Parts** (the length runs along the registry's Z; the bow points at the player at rotation 0):

1. **Hull.** A lofted round-bilge shell, 2.04 m in the beam and 4.72 m from stem to transom (Blender y from −2.48 to +2.24).
   - The sheer is 0.95 m at the bow, 0.74 m amidships and 0.78 m at the transom.
   - The bottom rocker rises 0.36 m at the forefoot, and the stem rakes forward 0.10 m.
   - Red topsides, a cream waterline stripe at 0.15–0.235 m, and navy below 0.15 m.
   - Inside: driftwood, with the floor at 0.36 m.
   - A cream foredeck (the first 12% of the length) and a cream aft motor deck (the last 7%) at sheer height.
2. **Fender collar.** Yellow, 0.14 m thick, running along the sheer and round the stem and transom. It sets the overall 2.25 m width and reaches 1.015 m.
3. **Three wood thwarts.** 0.30 m wide, with their tops at 0.58 m, at glTF z = +0.95, −0.15 and −1.30 m.
4. **Painted floorboard seams** on the floor.
5. **A pair of oars.** Driftwood shafts and red blades, resting on the thwarts with the blades forward.
6. **Navy oarlocks** on the collar amidships (top at 0.86 m).
7. **Two flank life rings.** 0.41 m across, red-and-cream, strapped to both sides just aft of amidships and tilted to follow the hull.
8. **Cream paw prints** on both bows.
9. **Outboard motor** on the transom:
   - a navy clamp, leg and lower unit;
   - a yellow three-blade propeller;
   - a yellow cowl with a red band, whose top at 1.080 m is the prop's highest point;
   - a red tiller with a navy grip.
10. **Bow.** A navy mooring eye on the stem and a two-turn rope coil on the foredeck.

**Blockout:** 54 parts and 28,240 triangles.

## Palette (sRGB hex; flat painted blockout materials)

| Swatch | Hex | Used for |
| --- | --- | --- |
| cream | `#f2efe6` | life-ring bands, window frames, door frame and porthole rim, bone signs, beacon bars and finial, boat waterline stripe and decks, bow paws, barnacles |
| red | `#d64533` | tower cabin, fascias, hip ribs, beacon cap, loudhailers, ladder caps; stand header trim and cap balls; boat topsides, oar blades, cowl band and tiller; life-ring bands; bone-sign paw |
| yellow | `#f7c948` | roof, railing, ladder rails, door, telescope bands, beacon glass; stand header; bollard cap; boat fender collar, cowl and propeller |
| coral | `#f08a5d` | the starfish |
| driftwood | `#d9c3a0` | deck planks, X-bracing, boat interior and floor, oar shafts |
| wood | `#a8835b` | tower legs, girts and rungs, the piling, stand posts and lower rail, boat thwarts |
| wet wood | `#6e5238` | the piling's tide band and cracks, the stand's wet feet and grain, the boat's floorboard seams |
| rope | `#dcc18c` | grab lines and clips, mooring rope, throw line, hanging loop, foredeck coil |
| aqua | `#8fd6e6` | window panes, door porthole and telescope lens (gloss) |
| sea | `#2f7fb8` | the stand header's wave strip |
| navy | `#2e4a62` | bollard plate and body, iron strap, telescope and tripod, beacon drum, loudhailer mouths, door knob; stand backboard, peg and hook; boat bottom, motor, oarlocks, mooring eye |
| stone | `#8c979f` | tower footings |

The blockout uses 15 materials: the 12 colours in matte paint, weathered wood, rope, satin iron and stone finishes, a gloss for glass and an emissive lamp finish for the beacon glass. The sheet parchment, ink and guide colours are sheet dressing, not prop colours: parchment `#f5ebdc`, ink `#342c46`, registry boxes `#c9953f`.

## Notes for the later modeling author

These are suggestions only; the coordinator's review of this sheet decides.

**Contract (WO111 props):**

- static meshes, one GLB per registry id;
- ≤ 5k triangles, ≤ 4 materials and ≤ 1.5 MiB each, self-contained (no Draco or meshopt);
- floor-centred, with the front toward glTF +Z (Blender −Y);
- record the tight measured bbox in the handoff for the theme-kit registry.

Follow `toon-clubhouse-kit/v001`'s route: vertex colours only, one joined mesh per prop, and Khronos validation with zero errors and zero warnings.

**Materials.** Use vertex colours with at most three or four materials per prop:

- one matte base for paint, weathered wood and rope (all props);
- an optional satin for the navy iron and the red paint (bollard, boat);
- **tower only:**
  - a gloss for the window panes and the lens;
  - a small emissive for the beacon glass, so the landmark still catches the eye at scale 3 through the era fog.

Bake soft occlusion into the vertex colours (as the veggie did). It keeps the trestle bracing, balcony, boat interior and bollard neck readable without the sheet's ink.

**Triangle budgets.** The blockout counts are far over budget in places. Where to cut:

- **Tower** (32.3k → about 4.8k):
  - **Balcony life ring** (7.4k in the blockout): one 16 × 8 torus with the red and cream bands in vertex colour, and the grab line either painted or as four 6-sided swags.
  - **Bone sign** (3.5k): one 24-point outline slab with the paw in vertex colour.
  - **Beacon** (3.5k): 16-sided.
  - **Window band** (3.0k): inset quads with aqua vertex colour.
  - **Railing and ladder** (4.3k): 6-sided or square rails and square rungs.
  - **Braces, girts and legs**: unbevelled boxes, 12 triangles each.
  - **Keep as geometry**, because at scale 3 (20.7 m tall) the far lookout is a silhouette: the splayed legs and X-bracing, the deck, the balcony rail, the cabin, the hip roof, the beacon and the horns.
- **Bollard** (8.4k → about 1.5k):
  - an 18–20-sided piling;
  - the wavy tide line as one band of about 32 segments, or painted into vertex colour on an added edge loop;
  - the barnacles as a few low bumps or paint, and the starfish as a 10-point slab or paint;
  - the rope loop as 8 × 24, and the tail as a 6-sided tube;
  - **keep** the waisted bollard neck and the flared yellow cap: they are what makes it read as a bollard.
- **Buoy stand** (15.8k → about 3k):
  - the life ring as one 24 × 10 torus with vertex-colour bands;
  - the grab line as a 6-sided tube, with the clips kept as small rings;
  - the throw line as two 6-sided loops;
  - the wave strip painted in vertex colour, and the bone as a 24-point slab;
  - the posts, header, backboard and cap balls are cheap boxes and spheres.
- **Boat** (28.2k → about 4.8k):
  - the hull as a loft of about 24 stations × 16 section points, including the rim and inner skin, with the waterline stripe on edge loops at 0.15 and 0.235 m;
  - the fender as an 8-sided tube on about 40 path points;
  - the flank rings as two 16 × 6 tori;
  - the bow paws and floorboard seams in vertex colour;
  - the motor at about 400 triangles, with the oars and thwarts as boxes;
  - the foredeck coil as one 8-sided ring.

**Height and placement rules are gameplay-visible** (see the table above):

- keep the buoy stand at least 1.775 m tall;
- never raise the bollard above 0.80 m or the boat above 1.10 m;
- keep the tower's front (ladder and door) toward +Z.

The boats are seen from above at every heading, so model the interior and both flanks with equal care.

**No animation is needed.** Optional later touches outside this contract: a slow beacon sweep or emissive pulse on the tower, and a gentle bob on the moored boats done in code (a vertical sine on the placed instance), which keeps the model static.

## What makes it original

- **Generic harbor and lifeguard types.** A trestle lifeguard lookout, a timber piling with a mushroom bollard, a life-ring stand and a rowboat with an outboard are universal seaside types.
- **No copied show design.** The lookout does not copy the era show's headquarters tower: there is no tall round tower, glass-topped observation deck, periscope or slide, and no vehicle bays. The rescue-pup cues are generic: a doghouse-arch door, cartoon bones and plain paw prints.
- **No lettering, numbers, logos or badges.** The signs are blank bones, and the boat carries no name or number.
- **Its own palette,** derived from the registry fallbacks and the harbor world theme, matching the chapter's dock-ride boats.
- **Kid-safe and cheerful** (scare level 0): rounded, chunky shapes with no damage, grime, gore or menace. The weathering is limited to wood tones, a tide line, barnacles and a starfish.
