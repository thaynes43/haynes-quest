# radio-host-showman v001 · reference notes

**Source:** Blender reference sheet, no generated concept.
**Status:** Sheet ready for coordinator review before any detailing, rigging or GLB work. Tom's exact-version review is still open. Once modeled, the candidate carries "Awaiting Tom's review · used in the family release" (PRD-004 Q-03).
**Role:** WO111 priority 8, World A chapter 4 (ages 9–11, Rat Casino After Hours) optional **bonus** encounter, `bonus (ordinary)` in the locked DESIGN-026 roster.
**Files:** `reference-sheet.png` (2048 × 1024) and `radio-host-showman-blockout.blend` (the blockout master at the origin). `radio-host-showman-reference-sheet.blend` holds the same master plus the sheet scene. Close-up review crops are in `preview/`. Scripts are in `source/`.

## Design intent

He is the after-hours casino's master of ceremonies: a tall, lanky, old-time radio host who treats every fight as his big broadcast. He is delighted to see you, always "on air", and a little too theatrical. The age band is 9–11, so he can be sharper and more stylish than the toddler-era cast, but he stays a friendly showman. He is never a demon and never scary. His size comes from his height, the planted mic cane and the waving hand, not from spiky or threatening forms.

Silhouette, from top to bottom:

1. **Two small hair tufts.** These are little bunches of soft, tapered wisps that spring up at the crown and flick out and back. The right tuft is slightly larger, so the pair is asymmetric. Each tuft is several strands in the hair colour, so it reads as hair from every view, not as horns or ears.
2. **Slicked auburn hair** with a close, smooth cap, sideburn tabs and a neat nape line.
3. **Big round head** with a **huge permanent grin** (about 0.26 m wide, lifted toward the cheeks), big friendly eyes, high arched brows, a button nose and rosy cheeks.
4. **Big black bow tie** on a white shirt collar.
5. **Red-and-cream candy-stripe jacket**, slim at the waist, with a black shawl collar, two brass buttons and a rounded morning-coat cutaway at the hem.
6. **Long, slim black trousers** with a red showman side stripe, over cream-and-black spectator shoes.
7. **Asymmetric showman pose.** His right hand plants a tall black cane topped by an old-time silver broadcast microphone at head height. His left hand is raised in an open-palm "welcome, folks!" wave. Both hands sit well clear of the body in the front, back and three-quarter views, so each reads at phone size.

## Parody hooks

These are recognizable cues. None is a copied design.

| Hook | How it appears here |
| --- | --- |
| Dapper vintage radio host | Slicked hair, a big bow tie, a bold striped jacket and white showman gloves: 1930s–40s broadcast-era styling. |
| The permanent showman grin | A huge, open, permanent smile with a smooth tooth band and a pink tongue, with big delighted eyes above it. |
| Two little hair tufts | Two small, asymmetric tufts of wispy hair at the crown. They are hair only. |
| Microphone on a cane | A tall black cane whose top is an old-time pill-shaped silver ribbon microphone in a brass yoke, with a small red on-air bulb. |
| Radio-era details | A tiny brass cathedral-radio lapel pin, a honey pocket square, spectator shoes and a vintage back half-belt. |

## What makes it original and kid-safe

- **No copied names, text, logos, faces, costumes or songs.** The sheet has no lettering on the character, and his name stays generic ("radio host showman").
- **The costume is our own combination.** He wears a red-and-cream candy-stripe blazer (a vaudeville boater-jacket idea) with a black shawl collar, black side-striped trousers and spectator shoes. That is deliberately unlike a dark pinstripe coat. The pill microphone in a brass yoke is a generic 1930s broadcast mic, not a staff design from any show.
- **Every demonic trait is left out.** He has no horns or antlers, and the tufts are built from several hair wisps in the hair colour. He has no sharp or pointed teeth, only one smooth rounded tooth band. His eyes are big, round and dark with white highlights, with no red eyes, glow or dial pupils. There are no shadows, tendrils, sigils, static effects or dark aura.
- **Friendly body language:** high happy brows, rosy cheeks, an open waving hand and a relaxed upright stance. The mic cane is a performer's prop, not a weapon. Its "attack" is a comic booming announcement (see below).

## Colours (sRGB hex; flat painted blockout materials)

| Part | Hex |
| --- | --- |
| Jacket stripes (red) | `#c0463e` muted storybook red |
| Jacket stripes (cream) | `#f3e6cf` cream |
| Trousers, shawl collar, bow tie, cane shaft, shoe toe caps, heels and soles, cuffs, pocket welt, half-belt | `#2a2230` plum-black |
| Hair | `#6f2f32` deep auburn |
| Brows, lash lines | `#3a2230` / `#342c46` dark plum |
| Skin | `#efc9a4` warm peach |
| Button nose | `#e0a98a` |
| Rosy cheeks | `#e89a8f` |
| Gloves, shirt, collar, eye whites, tooth band | `#fbf6ec` warm white |
| Spectator shoe uppers | `#f3e6cf` cream |
| Microphone capsule | `#c9ccd6` silver, with `#7d8196` grille bands |
| Mic yoke, cane collar and ferrule, buttons, pocket square, lapel pin | `#dca953` honey brass |
| On-air bulb | `#d9463d` |
| Mouth | `#4a2537` |
| Tongue | `#e8909f` |
| Trouser side stripe | `#c0463e` |

## Proportions (measured from the blockout; metres, floor at 0)

- **Overall:** **1.994 m** to the tips of the hair tufts, inside the brief's 1.9–2.1 m. The slicked hair tops out at 1.93 m and the head skin at 1.91 m. The bounding box is 1.18 wide (X, waving fingertips at −0.627 to mic yoke at +0.553) × 0.39 deep (Y, −0.163 to +0.222 at the shoe toes) × 1.99 high. The body alone, without arms or cane, is about 0.40 m wide at the shoes and 0.38 m at the jacket.
- **Head group** (scaled 1.08 and tilted 4° toward the mic about a neck pivot at 1.49 m): chin 1.50 m, head about 0.35 m wide. Eyes at 1.70–1.81 m, brows up to 1.85 m, nose at about 1.68 m. The grin spans about 1.55–1.66 m and is about 0.26 m wide; the tooth band is about 0.21 m wide. Ears are at 1.65–1.79 m.
- **Hair tufts:** they rise from 1.88 m to 1.99 m. The right tuft is about 0.11 wide × 0.12 m tall, the left about 0.09 × 0.105 m. Both sit behind the hairline (Y −0.03 to −0.16).
- **Neck and collar:** 1.45–1.56 m. The **bow tie** is about 0.225 m wide at 1.42–1.49 m.
- **Jacket:** from the hem at 0.80 m to the shoulders at about 1.40–1.49 m. It is narrowest at the waist, about 0.98 m. It measures 0.38 m wide × 0.27 m deep at the chest. The shawl lapels run from 1.12 to 1.46 m, and the buttons sit at 1.00 and 1.08 m.
- **Arms:** the right sleeve drops from the shoulder to a fist gripping the cane at about 1.03 m (glove 0.97–1.11 m, x ≈ 0.47). The left forearm rises to an open waving glove at 1.39–1.59 m (x ≈ −0.45 to −0.63).
- **Legs:** trousers 0.10–0.95 m, about 0.12–0.14 m across. Shoes are about 0.31 m long and 0.11 m high, with toes turned out 12°.
- **Mic cane:** the tip is on the floor at (0.53, 0.19) and the shaft leans slightly in to 1.40 m. The mic head, with its capsule, yoke and bulb, spans 1.41–1.70 m. The capsule is about 0.14 wide × 0.10 deep × 0.22 m tall (1.45–1.67 m). The red bulb tops out at 1.70 m, level with his cheeks, about 0.45 m to his right.

## Size note for the coordinator

The WO111 authoring contract puts ordinaries at about 0.8–1.4 m and bosses at 2–3 m. This bonus encounter follows its own brief instead (about 1.9–2.1 m), so the blockout is 1.99 m. If the encounter adapter needs ordinary-band sizing, the final model can be scaled uniformly at export or integration, because every proportion above scales with it. The coordinator should confirm the target height before detailing.

## Orientation and scale conventions

The blockout uses the WO111 authoring convention so the modeling author can keep it: Blender +Z up and the character facing Blender +Y, which becomes glTF +Y up / −Z forward on export. The root is floor-centred at the origin, and the character's right hand is +X. The cane is in his right hand, so it appears on the viewer's left in the front view. The waving hand is his left.

The sheet shows four linked-data copies of one master at exactly the same orthographic scale, rotated 180° (front), −90° (side), 0° (back) and −135° (three-quarter). The height marker (5 cm ticks, labelled every 25 cm) and dashed guides are in metres.

## Notes for the later modeling author

These are suggestions only; the coordinator's review of this sheet decides.

- **Budget:** the blockout is about 87k triangles of lathes, sweeps and decals, far over budget. The final model must meet the WO099 contract: ≤ 15k triangles, ≤ 2 materials, one ≤ 1024 atlas, one skin with ≤ 4 influences, ≤ 2 MiB GLB, and exactly the clips `idle`, `move`, `attack`, `hit` and `defeat`.
- **Paint, not geometry:** paint the candy stripes, grin, tooth band, tongue, eyes, cheeks, brows, lapel pin, side stripes and mic grille bands into the atlas. Keep the lapels, bow tie and pocket square as low, simple shells.
- **Separate parts to keep:**
  - the mic cane as a rigid prop weighted to the right hand, with its own bone so it can twirl;
  - each hair tuft as two or three low-poly wisps on a small chain, so it can boing;
  - the bow tie as a separate shell.
- **Permanent grin:** the grin is part of the joke and never changes. Carry the acting with the eyes (a scale bone per eye for wide surprise), the brows, the tufts and the body.
- **Arm pose:** the arms are posed for design. Rebuild them in a rig-friendly A-pose and recreate the cane grip and the wave in animation.
- **Side view:** the mic head overlaps the jaw in the pure side view. At gameplay angles, keep it about 0.45 m to his right at cheek height so the face stays visible.
- **Suggested acting:**
  - `idle`: a heel-toe bounce with a small cane tap on each beat, the tufts bobbing, and an occasional eyebrow waggle.
  - `move`: a jaunty tap-dance strut. The cane swings forward on each step like a vaudeville walk, and the free hand pumps.
  - `attack` (2.0 s, contact at about **1.25 s**):
    - 0.00–0.30 s: a quick one-hand cane twirl and a heel click (anticipation).
    - 0.30–0.95 s: the wind-up. He lifts the mic head up to his grin and cups his left glove beside his mouth ("Ladies and gentlemen…"). He leans back onto his toes while the tufts perk up.
    - 0.95–1.25 s: he lunges forward on the right foot and tips the mic toward the player to boom his announcement. **Contact is at 1.25 s**, with the mic head at its furthest forward point, about 0.5–0.6 m in front of the chest. An optional sound-ring or music-note puff from the mic is the coordinator's call.
    - 1.25–1.60 s: he holds the note with a small vibrato wobble.
    - 1.60–2.00 s: he recovers with a quick bow and swings the cane back to the planted pose.
  - `hit`: he jolts back with his eyes popping wide. The tufts squash flat and then boing up, and the mic wobbles. The grin stays.
  - `defeat`: a little feedback wobble, then a grand theatrical bow that keeps going until he sits on the floor with his legs out and the mic cane across his lap. He is still grinning, with dizzy eyes, and gives a small "goodnight, folks!" wave. The pose is held.

## Provenance

- **Authoring:** Claude Opus 5.5 (`claude-opus-5-5`) through the cluster Blender MCP service (Blender 4.5.13 LTS, **instance 1**, `blender-authoring`), under Tom's September 26 rulings. Opus does the WO111 Blender work, and assets without an Astra concept follow a painted Blender reference sheet reviewed by the coordinator first.
- **No image generation:** no image-generation model, external asset API, photo or third-party artwork was used. Every pixel comes from the procedural blockout rendered with Cycles on CPU, with Freestyle plum-ink outlines and a Standard view transform, so the parchment backdrop renders exactly as `#f5ebdc`.
- **Scripts:**
  - `source/build_blockout.py` builds the blockout and records bounds and feature tops.
  - `source/sheet.py` builds and renders the sheet.
  - `source/crops.py` renders the close-ups.
  - `source/measure_parts.py` writes `part-measurements.json`.
  - `source/iterate_preview.py` and `source/final_render.py` are the preview and final passes.
  - `source/claim.py` and `source/release.py` handle the scene lease.
  - Local-only helpers, never executed in Blender: `source/run.py` and `source/transfer.py` (MCP transfer and execution), `source/upload_notes.py`, `source/collect.py` and `source/fetchprev.py`.
- **Scene lease:** see `scene-lease.json` and `scene-release.json`. The lease was claimed on instance 1 from the released `putty-grunt` v001 scene, which is kept as `claim-checkpoint.blend`. No earlier family-era file was changed; the release script checks all 52 fingerprints. Instance 2 (`blender-authoring-2`) was not touched.
