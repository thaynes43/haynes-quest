# A world remembered

Haynes Quest should feel like walking into a lovingly illustrated storybook: soft light, inviting paths, expressive shapes and small discoveries worth stopping for. Tom's reference is the polish and warmth of Disney Dreamlight Valley, paired with Roblox-like accessible exploration and controls. Build an original world with its own characters, architecture and motifs.

This is the starting art brief. The coordinator may refine its concrete choices while recording a new brief version; Tom has selected the overall direction, not approved finished artwork.

## Visual language

- **Shape:** rounded, deliberate silhouettes; chunky readable props; gently uneven crafted edges. Keep detail sparse enough to read at an iPhone's gameplay distance. The world should feel solid and tactile.
- **Surface:** painterly color variation, matte wood and stone, soft cloth, restrained metal and glass accents. Bake fine surface detail into supported textures. Avoid noisy realism, plastic shine and a flat unlit block aesthetic.
- **Light:** warm sunlight, soft shadows and cool shaded areas. A recovered memory can add a small honey-colored glow. Effects guide attention without hiding controls, routes or photos.
- **Color:** parchment `#f5ebdc`, deep plum ink `#342c46`, leaf `#557363`, honey `#dca953`, with muted blue shadows. These are provisional anchors, not mandatory colors for every asset. Reserve the brightest accents for interactions and progress.
- **App mark:** the sprout seal beside the header wordmark. Browser-tab and iPhone/iPad home-screen icons show it in honey on ink so it stays legible at 16 px. `pnpm brand:icons` regenerates `public/favicon.svg`, `favicon.ico` and `apple-touch-icon.png` from `scripts/brand/build-icons.ts`.
- **Place:** one small garden clearing with a winding path, rounded stone, a few sculpted trees and a modest arrival/finish landmark. Reuse a small modular kit with controlled variations before adding more biomes.
- **Character:** an original, mysterious traveler whose infant and later child stages share a recognizable design. Show age through proportions, posture and motion. Start with fictional reference sheets; preserve later private likeness variants without requiring them tonight.
- **Memories:** readable framed photographs or keepsakes with a consistent collection cue. Decorative framing must leave the image legible. Use clearly fictional images in every public prototype and review page.
- **Motion and sound:** gentle anticipation, responsive movement and warm short cues. Discovery should feel satisfying without startling a young player. Important feedback remains visible when muted.

Do not import Disney or Roblox characters, logos, costumes, music or distinctive locations. Record any licensed inputs separately. Later era enemies use the original-design brief in [DESIGN-005](../designs/005-era-enemy-catalog.md).

## Haynesnightmares · Rat Casino proposal (September 2026)

Tom has asked for a complete spooky animatronic parody lineup, a retro Rat Casino and a Halloween Haynesnightmares world. The first Midnight Arcade treatment felt too young; its arcade setting was still the right direction. Tom then clarified that the [v001](reviews/rat-casino-ensemble/v001.md) and [v002](reviews/rat-casino-ensemble/v002.md) lineup images, including v002's polished turnarounds, read as **glam rock**. His target is the **classic original Five Nights at Freddy's era**, while the rat remains the center-stage lead and Chick-flia a side character. Do not extend the v002 costume/material treatment into models.

The source comparison is the [original 2014 game's official listing](https://store.steampowered.com/app/319510/Five_Nights_at_Freddys/) and the [2021 Security Breach listing](https://store.steampowered.com/app/747660/Five_Nights_at_Freddys_Security_Breach/). The first establishes a modest children's restaurant, a small cast of animatronic entertainers, dim security cameras and night-time uncertainty. The second explicitly names Glamrock characters in a Mega Pizzaplex. Our design inference is to use squat or broad padded mascot shells, plain matte worn fabric and simple molded face plates, slight asymmetry, old repaired joints, unlit or weak glass eyes, stiff still poses and isolated pockets of practical light. Casino jokes live in faded token-machine props, a shabby dealer vest, cheap stage trim and original suit markings. Avoid tailored glitter dresses, slim fashion poses, neon light bars, ornate gold filigree, jewel-like eyes, glossy metal bodies and polished musical-show staging. Let shadow, distance, stillness and a small mechanical misbehavior carry the unease; use no gore, realistic injury or sudden full-screen scare. Long readable attack warnings and funny mechanical breakdowns preserve the younger player's route.

Keep the Rat Pit Boss larger and more commanding than the other performers through scale and placement, while giving him a clearly rat-shaped muzzle and tail rather than a borrowed bear face. Make the golden after-hours rat a dim, distinct optional mascot shell rather than a second ornate headliner. The [three-prop Rat Casino sheet](media/rat-casino-kit/v001/concept.png) supplies set pieces, but its lighting and finish may need dulling for the new cast. Preserve older concepts and construction studies as superseded records. The [v003 cast concept and Rat Pit Boss turnaround](reviews/rat-casino-ensemble/v003.md) establish the corrected look before further Blender work. Concept images do not constitute finished 3D assets; review each exact model separately before gameplay use.

## Establish the reference set first

The driving Astra generates and inspects these images **in sequence**:

1. One environment key image at the intended gameplay camera, establishing palette, light, scale and surface finish.
2. One fictional traveler reference sheet showing the starting and next playable age stage with consistent costume/design elements.
3. One small prop/material sheet: memory frame, path, tree, stone and landmark, all belonging in that same clearing.

Choose and version the coherent set as `storybook-v001`; use the actual chosen image files as references for later image edits/generations. These are coordinator-selected working references while Tom's review is pending. Capture prompt, references, tool/date, output path and checksum for each image. Inspect rather than assuming the model obeyed every instruction.

Generate a reviewable concept for **every modeled asset**, using front/side/back views at matching scale where construction needs them. Resolve contradictory views before handing them to Blender. A line drawing is a visual guide; editable mesh topology, hidden surfaces, rigging and animations still require deliberate Blender work. Keep a shared baseline scale, palette, lighting and camera description in each work order.

## Coordinator review

Compare matching concept/model views side by side: silhouette first, then proportions, materials, lighting and detail. Inspect the actual GLB as well as Blender renders. Check age variants together, in motion and at gameplay distance; a beautiful still does not prove readable movement or compatible collision.

Return a short, ordered correction list with screenshots and precise artifact versions. Correct a local problem without casually changing the whole visual direction. If the brief changes, version it and identify affected catalog entries. Stop iterating when the candidate is coherent and technically usable, preserve the rejected alternatives, and leave concrete choices for Tom's morning review.
