# lab-robot v001 · reference notes

**Source:** Blender reference sheet, no generated concept.
**Status:** Sheet ready for coordinator review before any detailing, rigging or GLB work. Tom's exact-version review is still open. Once modeled, the candidate carries "Awaiting Tom's review · used in the family release" (PRD-004 Q-03).
**Role:** WO111 priority 7, World A chapter 3 ordinary-b (ages 5–9, the rooftop Hero City chapter), from the locked DESIGN-026 roster. The chapter boss is `inator-monster`, whose scientist pilot built this robot; `putty-grunt` is ordinary-a.
**Files:** `reference-sheet.png` (2048 × 1024) and `lab-robot-blockout.blend` (the blockout master at the origin). `lab-robot-reference-sheet.blend` holds the same master plus the sheet scene. Close-up renders are in `preview/`, the scripts are in `source/`, and per-part bounds are in `part-measurements.json`.

## Design intent

The scientist's runaway lab robot. It was built in the villain's tower to fetch and carry, but it yanked its own plug out of the wall and rolled off to cause trouble on the rooftops. It is a boxy tin toy on tank treads with one big curious lens eye, and it is plainly more pleased with itself than dangerous. It holds its right pincer up in a "snip-snip!" pose and reaches forward with its left, and it gives a cheeky sideways look from under a tilted eyelid. The age band is 5–9, so it reads as a funny gadget first and an enemy second. It has no teeth, blades, lasers, weapons or angry face, and it always warns you before it moves.

Silhouette, from top to bottom:

1. **A caged amber warning light** on the crown: a brass base, an amber glass dome and two crossed steel cage wires. This is the gameplay tell: it flashes and the robot beeps before every move or attack. The cage top is the highest point, at 1.29 m.
2. **A pale tin dome head** (0.41 m across, 0.51 m with its ears): a cylindrical band under a half-dome, with plum trim rings at the bottom and at the seam (the seam ring carries ten brass rivets), and brass ear discs with steel bolt nubs.
3. **One big camera-lens eye** in the front of the head, 0.216 m across the brass bezel, about half the head's width. A steel lens barrel pushes it out of the head, so it also reads in profile. Behind the domed pale-blue glass is a darker iris ring and a big plum pupil with two cream glints. The pupil sits a little low and toward its right, so the eye glances sideways.
4. **A tilted plum eyelid** shutter covers the top of the lens and is raised 11° on its left. This gives the cheeky "who, me?" look.
5. **A speaker-grille smile** below the eye: a plum crescent with three little brass grille bars.
6. **A plum rubber neck bellows**, an accordion that lets the head bob, wobble and pop up for the defeat gag.
7. **A boxy teal tin body** (0.51 m wide × 0.38 m deep × 0.50 m tall), slightly wider at the top, like a pressed-tin toy. On the front:
   - a pale tin **control panel** with four brass rivets;
   - three **indicator lights** (red, blue and amber);
   - two brass **gauge dials** with plum needles;
   - in the middle, a big candy-red **self-destruct button** in a brass-and-plum **hazard ring**;
   - below the panel, a brass **hazard kick plate** with plum stripes.

   The sides carry four plum louvers each. The back has a tin hatch with a handle and four rivets, and a brass grommet where the cord comes out.
8. **Slinky-spring arms** in steel, from brass ball shoulder sockets, ending in **round brass pincer claws**: a steel cuff, a brass palm and two curved jaws with ball tips. The raised right claw is open in a V beside the head, and the left claw reaches forward at belly height.
9. **A steel swivel waist** with a brass ring, on a plum chassis crossbar.
10. **Two plum rubber tank treads** with floor lugs, teal housing plates and four steel road wheels each, with brass hubcaps on the outside. There is clear negative space between the treads under the crossbar.
11. **The yanked-out power cord** leaves the brass grommet low on its back. It drops behind the treads, trails along the floor toward its right, and curls up beside its right tread like a tail, with a brass two-prong plug on the end.

## Parody hooks

These are recognizable cues. None is a copied design.

| Hook | How it appears here |
| --- | --- |
| The evil scientist's runaway lab robot | DESIGN-026 merges World A chapter 3's cast from the Power Rangers, Spider-Man and Phineas and Ferb era. Its ordinaries include runaway lab robots from the backyard-inventor cartoons, where the villain's gadgets escape and misbehave. We use the premise only: a robot built in the scientist's tower that has rolled off on its own. The plum trim echoes the purple cockpit of our `inator-monster` scientist. |
| The self-destruct button | Cartoon evil scientists always build a self-destruct button into their machines. Ours is a big candy-red button in a hazard ring in the middle of the chest, set up for the defeat gag. It has no lettering. |
| The vintage wind-up tin toy robot | Boxy pressed-tin body, rivets, chest dials and lights, a dome head, slinky arms, pincer claws and tank treads: the classic toy-shop robot silhouette. |
| "Beep beep, coming through!" | The caged warning light on its head flashes, and the robot beeps before it moves. It works like a forklift or a lab alarm, and it gives children a fair, readable warning. |
| Runaway | It pulled its own power cord out of the wall to escape, and now drags the cord behind it like a tail. |

## What makes it original

- **No copied names, text, logos, faces or costumes.** There is no lettering, badge or company mark anywhere; the panel carries only generic lights, dials and the button. The name stays generic ("lab robot").
- **Its own design.** None of these choices comes from a model sheet: the domed head with a single protruding lens barrel, the tilted eyelid, the grille smile, the caged beacon, the teal-and-tin two-tone, the hazard-ring button, the slinky arms with ball-tipped brass pincers, the plum treads and the plug tail. It resembles no specific robot from the inspiring shows.
- **Its own palette.** Teal tin, pale tin, steel and plum with honey-brass accents comes from our storybook brief (plum ink `#342c46` and honey `#dca953` are brief anchors; the brass is honey).
- **Kid-safe.** There are no teeth, blades, lasers, sparks or weapons. The pincers have ball tips, and its "attack" is a stretchy snip. The eye has glints and a smile under it, and the eyelid tilts into a cheeky look, not a frown. The warning light makes every move predictable, and the self-destruct joke ends in a comic pop-up, not an explosion.

## Colors (sRGB hex; flat painted blockout materials)

| Part | Hex |
| --- | --- |
| Tin body, tread housing plates | `#5f9ea3` teal tin |
| Dome head, head band, control panel, back hatch | `#dde2d9` pale tin |
| Slinky arms, waist, lens barrel, road wheels, cage wires, ear bolts, plug prongs | `#8e98a2` steel |
| Pincer claws, shoulder sockets, bezel, rivets, hubcaps, dial rims, kick plate, plug, beacon base | `#dca953` brass (honey) |
| Trim rings, eyelid, smile, louvers, hazard stripes, chassis crossbar, dial needles | `#4a3f63` plum |
| Treads, lugs, neck bellows, power cord | `#3a3446` rubber |
| Warning light | `#f39a3d` amber (a slight glow in the sheet) |
| Self-destruct button, red indicator light | `#e0544b` tomato |
| Lens glass, blue indicator light | `#9fd6e3` |
| Iris ring | `#5a9cb4` |
| Pupil | `#2e2840` |
| Glints, button shine, dial faces | `#fbf6ea` cream |

## Proportions (measured from the blockout; metres, floor at 0)

- **Overall:** 1.293 m tall to the beacon cage (1.278 m to the amber glass, 1.18 m to the dome head, 1.21 m to the raised pincer tips, 0.79 m to the top of the body). The bounding box is 0.896 m wide (X, from the reaching left arm to the raised right arm) × 1.087 m deep (Y, from the plug tail at −0.616 to the reaching pincer tips at +0.471) × 1.293 m high. It sits inside the brief's 1.1–1.3 m and the work order's 0.8–1.4 m ordinary band. Without the cord, the robot is 0.726 m deep.
- **Head:** 0.41 m across the band and dome (0.51 m with the ear bolts), from 0.831 m (bottom trim) to 1.18 m, about 27% of the height. The band runs 0.835–0.975 m and the half-dome 0.975–1.18 m, with a radius of 0.205 m.
- **Lens eye:** the bezel is 0.216 m across, centred at 1.02 m (0.912–1.128 m). The glass is 0.172 m across, the iris ring 0.112 m and the pupil 0.072 m. The pupil is centred about 6 mm toward its right and 10 mm below the lens centre. The glass front reaches y = 0.266 m, 0.061 m in front of the head band.
- **Eyelid:** 0.172 m wide and 0.069 m tall (1.055–1.124 m), 0.035 m thick, covering the top fifth of the glass and tilted 11° up on its left.
- **Smile:** 0.164 m wide, 0.857–0.898 m, with three brass grille bars at x = −0.036, 0 and +0.036 m.
- **Warning light:** 0.127 m across the brass base, from 1.168 to 1.293 m. The amber glass is 0.096 m across, with its top at 1.278 m.
- **Neck bellows:** 0.255 m across at the ridges, 0.778–0.844 m, with three accordion ridges.
- **Body:** 0.511 m wide at the top (0.475 m at the bottom) × 0.38 m deep × 0.50 m tall (0.29–0.79 m), with 0.05 m rounded edges.
  - **Control panel:** 0.34 × 0.28 m (0.40–0.68 m).
  - **Self-destruct button:** 0.10 m across, centred at 0.515 m. It reaches y = 0.252 m, 0.062 m proud of the body, inside a 0.156 m hazard ring.
  - **Dials:** 0.068 m across at x = ±0.125 m. The **indicator lights** are 0.036 m across at 0.635 m.
  - **Kick plate:** 0.40 × 0.048 m (0.337–0.385 m).
- **Shoulders:** brass sockets 0.108 m across at x = ±0.262 m, z = 0.705 m.
- **Arms:** slinky coils about 0.095 m thick (coil radius 0.038 m, wire 0.019 m, 21 mm pitch).
  - The raised right arm rises to its cuff at about 1.0 m; its open claw spans x = 0.31–0.465 m and tops out at 1.21 m, level with the dome.
  - The left arm reaches forward and down; its claw spans z = 0.355–0.515 m and reaches y = 0.471 m.
- **Claws:** 0.10 m palm, jaws about 0.13 m long, opening about 0.11 m at mid-jaw, with 0.034 m ball tips.
- **Waist:** 0.244 m across, 0.185–0.30 m. The chassis crossbar is 0.256 m wide at 0.138–0.193 m.
- **Treads:** each 0.134 m wide × 0.51 m long × 0.21 m high with lugs, resting exactly on the floor; 0.534 m across both, including hubcaps. The gap between them is 0.222 m. The end wheels are 0.132 m across and the middle wheels 0.088 m.
- **Power cord:** 0.034 m thick. It leaves the back at 0.38 m and curls up at x = 0.305 m, y = −0.60 m. The plug is 0.05 × 0.036 m with 0.036 m prongs, and its top is at 0.34 m.
- **Blockout size:** 80,272 triangles, 201 parts and 12 flat materials.

## Orientation and scale conventions

The blockout uses the WO111 authoring convention so the modeling author can keep it: Blender +Z up and the character facing Blender +Y, which becomes glTF +Y up / −Z forward on export. The root is floor-centred at the origin, the tread lugs touch z = 0, and the character's right is +X. Every part is a plain bevelled primitive, lathe or sweep, with no metaballs or booleans. Small painted details stay out of the sheet's ink lineset (`sheet_no_ink`): rivets, hazard stripes and wedges, tread lugs, grille bars, glints and the button shine.

The sheet shows four linked-data copies of one master at exactly the same orthographic scale:

- front, rotated 180°;
- side, rotated −90°, showing its right side and facing right;
- back, rotated 0°;
- three-quarter, rotated −135°.

The height marker has 5 cm ticks with labels every 25 cm, plus dashed guides. The frame is sized from the figure height, so the figures fill about 45% of the sheet height.

## Notes for the later modeling author

These are suggestions only; the coordinator's review of this sheet decides.

- **Budget:** the blockout is about 80k triangles, far over budget. The two helical slinky coils alone are about 15.5k, and the bevelled road wheels, hubcaps and bolts another 10k. The final model must meet the WO099 contract: ≤ 15k triangles, ≤ 2 materials, one ≤ 1024 atlas, one skin with ≤ 4 influences, ≤ 2 MiB GLB, and exactly the clips `idle`, `move`, `attack`, `hit` and `defeat`.
- **Slinky arms:** rebuild each coil as a ribbed tube (a lathe with alternating ring radii, about 12–14 ridges per arm, 8–10 sides). With a painted groove shadow in the atlas, it reads as a spring at play distance and stretches cleanly with bone scale.
- **Paint rather than model the small details:** rivets, hazard stripes, the dial faces and needles, the louvers, the grille bars, the iris and glints can all go into the atlas. Keep these as geometry, because they carry the silhouette or the gags:
  - the lens barrel and bezel, the eyelid and the dome;
  - the warning light (the cage can be two thin flattened hoops);
  - the ear nubs, claw jaws and ball tips;
  - the button and its ring;
  - the tread belts (paint the lugs, keeping a few low bumps on the bottom run), the hubcaps, and the cord and plug.
- **Warning light:** it is round, so spinning it would not show. Add a small reflector fin inside the amber glass so a rotation bone reads, or pulse the dome's scale. Pair it in game with a short two-tone "beep-beep" cue from the audio service (DESIGN-008) before `move` and `attack`.
- **Rig:**
  - a floor root, a tread-bob bone per tread (or one chassis bone) and a wheel-spin bone per tread driving its hubcaps;
  - a waist-swivel bone and a body bone;
  - a neck-stretch bone in the bellows (scale Z for the pop-up), a head bone and an eyelid hinge bone;
  - an iris/pupil bone (scale for focus, small translation for glances) and a beacon bone;
  - per arm, a 3–4 bone chain from shoulder to wrist with stretch, plus a palm bone and one bone per jaw;
  - a 4-bone cord chain with the plug on the last bone.

  Weight the rigid tin parts 100% to one bone each, so they never bend like rubber.
- **Pose:** the raised claw, the reaching claw and the glance are design poses. Build the rest pose with both arms hanging in a relaxed A-shape, both claws half open, the eyelid level and the cord lying straight back on the floor. Then recreate the sheet pose in `idle`.
- **Possible acting:**
  - `idle`: it bobs gently on its treads and wiggles at the waist, and both claws snip idly. The iris dilates and narrows, the eyelid blinks as a shutter, and the plug tail wags. The warning light stays dim.
  - `move`: the light flashes twice with a beep-beep, then it rolls. The wheels spin, it leans back like a startled go-kart, the arms flail up and the cord bounces behind. There is no root motion.
  - `attack` (2.0 s, **contact at 1.25 s**):
    - 0–0.45 s: it stops, the warning light flashes three times (beep-beep-beep), the eyelid snaps up and the iris narrows onto the target. This is the tell.
    - 0.45–1.0 s: it rocks back on its treads and swivels at the waist. The raised right slinky arm squashes short, and its claw snips open and shut twice.
    - 1.25 s: contact. It rocks forward from the waist and treads (still no root motion), the right arm springs forward and down about 40% longer than its rest length, and the pincer snaps shut at a child's chest height in front of it with a "snip!".
    - 1.25–2.0 s: the arm boings back with an overshoot wobble. The robot rocks back, the light spins, and it gives a proud "beep-boop" before settling into `idle`.
  - `hit`: it jolts back on its treads and the dome wobbles on the bellows. The iris shrinks to a dot, the eyelid pops open and the light flickers with a deflating "bwoop".
  - `defeat`: it fumbles, and its left claw bonks its own self-destruct button. The dome head pops straight up on the stretched bellows like a jack-in-the-box ("sproing!") while the light spins. Then it slumps sideways onto one tread, with the head drooping on its spring, the eyelid half shut, the iris small and dizzy, and one sad "boop". The pose is held. There is no explosion, smoke or sparks.

## Provenance

- **Authoring:** Claude Opus 5.5 (`claude-opus-5-5`) through the cluster Blender MCP service, instance 1 (`blender-authoring`, Blender 4.5.13 LTS), under Tom's September 26 ruling. Opus continues WO111 Blender work, and assets without an Astra concept are modeled from a painted Blender reference sheet that the coordinator reviews before detailing. Instance 2 (`blender-authoring-2`) was not touched.
- **No image generation:** no image-generation model, external asset API, photo or third-party artwork was used. Every pixel comes from the procedural blockout rendered with Cycles on CPU (48 samples, denoised), with Freestyle plum-ink outlines (128° crease) and a Standard view transform, so the parchment backdrop renders exactly as `#f5ebdc`.
- **Construction:** bevelled boxes (the body with a slight top-wide taper), cylinders, lathes (the neck bellows), Catmull-Rom sweeps (claw jaws, cage wires, cord), helical wire sweeps around a rotation-minimising frame (the slinky arms), a closed stadium band for each tread belt with lugs on the outer surface, and a ray-cast strip for the smile on the head band.
- **Scripts:**
  - `source/build_blockout.py` builds and saves the blockout master and `blockout-measurements.json`;
  - `source/sheet.py` builds and renders the sheet and writes `sheet-render.json`;
  - `source/crops.py` renders the close-ups;
  - `source/measure_parts.py` writes `part-measurements.json`;
  - `source/iterate_preview.py` was the design-iteration helper, and `source/final_render.py` ran the final pass;
  - `source/claim.py` and `source/release.py` claim and release the scene;
  - `source/transfer.py` and `source/run.py` handle the MCP transfer and execution, and `source/fetchprev.py` downloaded previews for review;
  - `source/collect.py` makes the durable copy and manifest.

  The scripts are adapted from the radio-host-showman, putty-grunt, demon-band-idol, bin-chicken and rival-mayor v001 sheet scripts. The sheet format, frame, dressing and palette row are unchanged.
- **Iteration record:** four design passes. Each one was checked against the half-size sheet preview and close-ups:
  1. The first blockout had these problems:
     - the two beacon cage wires, set at 45°, merged into one arc in the front view;
     - a z-fighting seam crossed the amber glass;
     - the eyelid floated in front of the bezel;
     - a small glint under the pupil read as a tear;
     - the smile was small.
  2. The cage wires were set to 0° and 90°, the amber cylinder was narrowed and the eyelid was thickened back onto the bezel. The small glint moved beside the big one, and the smile was widened.
  3. The raised claw moved back so the lens barrel reads in the side view. The cord's loop between the treads, which read as a hanging handle in the front view, was re-routed toward its right.
  4. The cord's curl moved outboard of the right tread. The plug now reads as a tail in the front view instead of a stub peeking between tread and body.

  `preview/sheet-preview.png` is the last half-size iteration preview; `reference-sheet.png` is the final render of the same scene.
- **Scene lease:** see `scene-lease.json` and `scene-release.json`. The scene was claimed on instance 1 at 18:12:34 UTC from the released radio-host-showman v001 scene (`claim-checkpoint.blend` keeps a copy of it). No earlier asset file was changed.
