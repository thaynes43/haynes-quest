"""Action minions A v001: write the review-page draft and the catalog intake record for one delivered candidate.

  python3 review_draft.py <asset-id>

Numbers come from the delivered records (validation, three-inspection, browser-inspection, provenance, manifest)
in docs/assets/media/<asset-id>/v001/, so the page cannot drift from the checked bytes. The coordinator owns the
catalog card, inventory, parody catalog and scene manifests; this writes only the asset's own review page and
an intake JSON under the durable pack directory and the asset's media directory.
"""
import json, sys, hashlib
from pathlib import Path
sys.dont_write_bytecode = True
from client import LOCAL, DURABLE
REPO = LOCAL.parents[3]
asset = sys.argv[1]
M = REPO / 'docs/assets/media' / asset / 'v001'
J = lambda n: json.loads((M / n).read_text())
val, ins, bro, prov, man, con = J('validation.json'), J('three-inspection.json'), J('browser-inspection.json'), J('provenance.json'), J('sha256-manifest.json'), J('construction.json')
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()

TEXT = {
 'gadget-hammer-hopper': {
  'title': 'Gadget Hammer Hopper', 'cast': 'Clubhouse', 'period': 'toon-clubhouse-v1', 'window': ['2006-05-05', '2016-11-06'], 'kind': 'ordinary-a',
  'reference': 'a runaway cartoon toolbox gadget on a pogo spring with a giant rubber mallet',
  'placement': 'World A chapter 1, Clubhouse Capers (`clubhouse`): the Toon Clubhouse ordinaries beside the existing Runaway Gadget, under Captain Bully Cat. It shares the gadget helper\'s era window.',
  'intro': "This runaway toolbox is a new ordinary enemy for the Clubhouse cast in [DESIGN-029](../../../designs/029-action-and-inhabited-worlds.md). It is a bigger, rowdier cousin of the [Runaway Gadget](../gadget-helper/v001.md): it bounces after the player on one coiled spring and swings a soft giant rubber mallet.",
  'looks': ["a teal toolbox body with an ochre lid, a dark carry handle, grey latches and a split back panel;",
            "a naughty face on the front: big cream eyes with side-eye pupils, thick slanted brows, and a lopsided dark-red grin with two buck teeth and a pink tongue;",
            "corrugated hose arms from round sockets, chunky teal mitten fists, and a soft rubber mallet with orange caps in the right fist;",
            "one coiled spring leg ending in a chunky ochre work boot with a lugged dark sole, laces and a padded collar."],
  'motion': {
   'idle': 'from the concept pose it bounces twice on its spring, the box sways, the lid clacks at each bounce, the carry handle wobbles, it twirls the mallet and pumps its left fist, side-eyes across, raises one brow and blinks.',
   'move': 'one big pogo hop per loop: crouch, push off, the boot leaves the floor with the toe pointed, then lands; it leans into the hop with the arms swinging, the eyes wide and the lid flapping on landing.',
   'attack': 'the tell (to 0.45 s): the brows slam into a V, the eyes narrow, the grin widens, the lid rattles and the box shivers while the mallet lifts and twists. The wind-up (0.45–0.9 s) squashes the spring, leans back and hauls the mallet up behind its head. The downswing goes over the top, outside the lid, and an orange rubber cap hits the floor in front at **1.25 seconds**. The cap squashes, the eyes pop and the lid bangs open, then it recovers to the concept pose by 2.0 s.',
   'hit': 'it jolts back on the spring with its eyes squeezed shut, the lid pops open, the brows shoot up and the arms fling out before it settles.',
   'defeat': 'it jolts, then boings up and spins a full turn. The lid flies open and a wrench pops out and clatters onto the floor. It lands, wobbles and topples onto its back with the boot kicking up in the air, the arms and mallet flopped on the floor, cross-eyed and gaping. The pose is held from 1.95 s.'},
  'departures': ["**Wrench.** The concept has no defeat props. A wrench hidden inside the closed box pops out in `defeat` for a funny exit. It is checked to stay inside the box in the other four clips.",
                 "**Boot sole.** The concept's tread is suggested with ten lug blocks round the sole and a welt band, not sculpted tread.",
                 "**Scuffs and seams.** The concept's clay scuffs, chips and rivets are reduced to soft atlas mottling, two scuff patches and the back panel seam; the latches and their rivets are geometry.",
                 "**Defeat pose.** Lying on its back puts the face up toward the gameplay camera. From a low front view you see the box bottom and the kicking boot."],
  'fixes': ["The first downswing passed the right fist and mallet through the lid's front corner, and the recovery grazed it again. The swing now passes outside the lid, and the clearance checks report no overlaps in any clip.",
            "Early in the topple, the boot heel dipped 1.7 cm below the floor and the back latches went 1.3 cm under it. The drop is now eased behind the rotation and the box rests 5 cm higher, so nothing goes below the floor.",
            "The first export was 15,780 triangles. Trimming coil, hose, eye and handle resolution brought it under the 15k budget, and the fist, sole and grin pass afterwards keeps it there.",
            "Against the concept the fists were small, the boot slipper-like and the grin narrow; the fists are now 28% chunkier, the sole is thick and lugged, and the grin is 32% wider."]},

 'mischief-kitten-skater': {
  'title': 'Mischief Kitten Skater', 'cast': 'Harbor', 'period': 'rescue-harbor-v1', 'window': ['2013-08-12', '2026-12-31'], 'kind': 'ordinary-a',
  'reference': "one of the rival mayor's mischief kittens, on roller skates",
  'placement': 'World A chapter 2, Harbor Rescue (`harbor`): a faster skating member of the mischief kitten crew beside the existing Mischief Kitten, under Mayor Humdrum. It shares the kitten\'s era window.',
  'intro': "This roller-skating kitten is a new ordinary enemy for the Harbor cast in [DESIGN-029](../../../designs/029-action-and-inhabited-worlds.md). It is a bigger, faster member of the mayor's [mischief kitten](../mischief-kitten/v001.md) crew: it skates after the player on four roller skates and stomps them flat.",
  'looks': ["a lilac tabby with darker purple stripes on its back, tail, forehead and the back of its head, a cream chest and muzzle, and a big chibi head;",
            "big amber eyes glancing sideways under a dark lash line, naughty arched brows, a pink nose and a smirking open mouth with two tiny fangs and whiskers;",
            "tall ears with pink insides and white tufts, and a plum mini stovepipe with a raspberry band tilted toward its left ear;",
            "a raspberry collar with a gold bell, an arched striped tail, and teal roller skates with cream wheels, dark raspberry plates and hubs, and cream laces on all four feet."],
  'motion': {
   'idle': 'from the concept stance it rolls a little forward and back on its skates with the wheels turning, bobs, tilts its big head, flicks an ear, side-eyes across, raises a brow, blinks, and sways its tail while the bell swings.',
   'move': 'it skates: two alternating hind-skate strokes per loop push out and back, lift and return, while the front skates glide. The body leans in and sways with each stroke, all sixteen wheels roll three turns per loop, and the tail streams back with the ears and hat pressed back.',
   'attack': 'the tell (to 0.45 s): it crouches and wiggles its bottom, the ears flatten, the eyes narrow, the brows drop, it hisses and lashes its tail. The wind-up (0.45–1.0 s) rears it up on its hind skates with the front skates raised. Then it dashes forward on all four skates and stomps both front skates down in front at **1.25 seconds**, mouth wide, before rolling back to the concept stance.',
   'hit': 'it recoils backwards on its skates with its eyes squeezed shut and ears flat, its tail bristles straight back, and the hat pops up and lands again.',
   'defeat': 'the hat flies off, its skates slide apart and it spins round dizzily, then flops onto its side with all four skates sticking out. The hat lands upright on the floor; the kitten is cross-eyed with its tongue out. The pose is held from 1.95 s.'},
  'departures': ["**Head turn.** The concept turns the head toward the viewer; the model faces forward in its rest pose and turns its head in `idle`.",
                 "**Collar.** The concept's flat collar band is a round raspberry ring with a gold bell; the bell swings in every clip.",
                 "**Stripes and fur.** Stripes are crisp geometry bands painted from flat atlas tiles; the concept's soft fur texture and cheek tufts are reduced to a few tuft shapes.",
                 "**Legs.** The legs are short and thick so that a real two-bone leg plugs into each skate; the exported ankle never leaves its skate (the largest measured gap is under 1 µm)."],
  'fixes': ["The first build was leggy with a small head and an exposed neck; it was re-proportioned to the concept's big-headed chibi kitten, with the head seated on the shoulders and the collar under the chin.",
            "Bands across the cheeks read as a barcode and were removed; stripes across the back of the head were added to match the concept's back view.",
            "The legs first overreached their skates by up to 5 cm in `hit` and `defeat`, which would have left gaps. The skates now move with the body and every leg stays attached.",
            "While rearing, the raised front skate dipped into the chest, and the knocked-out head floated 3.7 cm above the floor. Both were corrected and are now checked.",
            "The first skates were tall narrow boots on small wheels. They were rebuilt as the concept's low chunky boots on 5 cm cream wheels, staying under the 15k triangle budget."]},

 'lab-robot-sentry': {
  'title': 'Lab Robot Sentry', 'cast': 'Hero City', 'period': 'hero-city-v1', 'window': ['2018-12-14', '2026-12-31'], 'kind': 'ordinary-b',
  'reference': "the scientist's broad one-eyed sentry robot with pincer hands",
  'placement': "World A chapter 3, Hero City (`rooftop`): a heavier guard beside the existing Lab Robot and Putty Grunt, under the Monster-inator. It shares the lab robot's era window and `ordinary-b` kind.",
  'intro': "This broad toy robot is a new ordinary enemy for the Hero City cast in [DESIGN-029](../../../designs/029-action-and-inhabited-worlds.md). It is the bigger, slower guard model of the scientist's [Lab Robot](../lab-robot/v001.md): it stomps after the player and clamps both pincers shut in front of its lens.",
  'looks': ["a rounded cream shell that is head and body in one, with teal side bands, a teal top visor and a teal bottom band, grey screws and a slatted back vent;",
            "one big round orange lens with a glint, set in a thick dark bezel and housing, and a springy antenna with a teal ball on top;",
            "plum shoulder spheres, chunky plum arms with teal joint discs, and big teal C-shaped pincers that open and clamp at the wrists;",
            "a dark grey pelvis, stocky plum legs with teal knee caps and ankle discs, and big plum boots with teal toe caps and dark soles."],
  'motion': {
   'idle': 'from the concept stance it bobs on its knees and scans left and right; the lens glances and pulses, the antenna wobbles on its spring and each pincer snips once.',
   'move': 'a stompy march in place: each boot lifts, swings forward and plants while the other slides back. The pelvis bobs and sways, the shell counter-rolls, the arms swing, the pincers clack and the antenna bounces.',
   'attack': 'the tell (to 0.45 s): the lens flares and flickers, the antenna buzzes, it crouches and spreads both pincers wide open. The wind-up (0.45–1.0 s) leans back with both pincers raised high behind its shell. Then it lunges a step forward and swings both pincers down together, clamping shut in front of its lens at **1.25 seconds**, before stepping back to the concept stance.',
   'hit': 'it jolts back and the lens shrinks to a dot, the antenna whips, and the pincers snap open before it settles.',
   'defeat': 'it sputters: the shell twitches, the lens flickers and dims and the antenna droops. Its knees buckle and it sits down hard, then tips over onto its back with both boots in the air and the pincers flopped open on the floor. The pose is held from 1.95 s with the lens shrunk and the antenna drooped.'},
  'departures': ["**Lens.** The model has no emissive glow; the lens is glossy orange and its pulses, flicker and dimming are scale changes inside a dark socket.",
                 "**Panel detail.** The concept's panel seams and chips are reduced to one seam line, the teal bands and four screws; the pincers are smooth rounded C shapes.",
                 "**Rigid parts.** It is a robot, so every part except the antenna stem is rigidly skinned to one joint, and the legs are two-bone IK chains that keep the boots planted."],
  'fixes': ["The first shell was a rounded cube; it was rebuilt as the concept's domed egg with an eye housing, and the teal bands were moved out to the side edges.",
            "The limb boxes first used a placeholder 1 m length, which put the shins 0.2 m under the floor; they now span their joints.",
            "The first strike swung one pincer overhead and flung the other sideways, because three arm rotations had inverted signs and the inward swing ran about the arm's own axis. Both pincers now meet in front of the lens at chest height and clamp to under half their open gap; this is checked.",
            "While sitting in `defeat`, the knees folded through the floor; the knee pole now turns upward as it sits.",
            "When the lens shrank, the shell showed through the bezel like a fried egg; a dark socket now sits behind the lens, and the lens shrinks toward its face."]},
}

T = TEXT[asset]; checks_k = [k for k, v in val['checks'].items()]; checks_t = list(ins['checks']); checks_b = list(bro['checks'])
H = ins['height_m']; rb = ins['rest_bounds_y_up']; ab = ins['all_animation_bounds_y_up']
dims = [rb['max'][i] - rb['min'][i] for i in range(3)]
clips = {c['name']: c for c in con['clips']}
mf = {f['path']: f for f in man['files']}
rel = lambda n: '../../media/%s/v001/%s' % (asset, n)
page = f"""# {T['title']} · v001

**Awaiting Tom's exact-version review · DESIGN-029 action-worlds candidate.** {T['intro']} Under [PRD-004 Q-03](../../../prds/004-family-release.md#owner-decisions) it may appear in the children's levels while labelled awaiting review here. Coordinator review and owner approval remain separate.

It is built from row {1 + list(TEXT).index(asset) if asset in TEXT else '?'} of the coordinator's construction reference:

""" + '\n'.join('- ' + x for x in T['looks']) + f"""

**Source: coordinator-generated concept, built as an original Blender model.** The concept is build direction only; no image is projected or pasted onto the model. Every part is modelled geometry painted from one original 1024 × 1024 colour atlas. There are no copied meshes, logos or lettering, and no gore.

[Full concept sheet](../../media/action-minions-a/v001/concept.png) · [Model provenance]({rel('provenance.json')}) · [Construction record]({rel('construction.json')})

![The coordinator concept row above the exact v001 export at matching views]({rel('concept-vs-export.png')})

<model-viewer src="{rel(asset + '.glb')}" poster="{rel('beauty.png')}" alt="Orbit the {T['title']} and inspect its five animations" camera-controls touch-action="pan-y" data-quest-clips shadow-intensity="0.7" camera-orbit="155deg 78deg auto"></model-viewer>

[Download exact GLB]({rel(asset + '.glb')}) · [Editable Blender master]({rel(asset + '.blend')}) · [Review video (WebM, {bro['video']['bytes'] // 1024} KiB)]({rel('review.webm')}) · [Artifact manifest]({rel('sha256-manifest.json')})

<div class="studio-comparison">
<figure><img src="{rel('front.png')}" alt="Front of the exact {T['title']} model"><figcaption>Front</figcaption></figure>
<figure><img src="{rel('side.png')}" alt="Right side of the exact {T['title']} model"><figcaption>Side</figcaption></figure>
<figure><img src="{rel('back.png')}" alt="Back of the exact {T['title']} model"><figcaption>Back</figcaption></figure>
<figure><img src="{rel('threequarter.png')}" alt="Three-quarter view of the exact {T['title']} model"><figcaption>Three-quarter</figcaption></figure>
</div>

| Exact exported model | Result |
| --- | --- |
| Size and placement | {H:.3f} m tall in the concept pose, {dims[0]:.3f} m wide and {dims[2]:.3f} m deep. Across all clips it spans {ab['min'][0]:.2f} to {ab['max'][0]:.2f} m across, up to {ab['max'][1]:.2f} m high and {ab['min'][2]:.2f} to {ab['max'][2]:.2f} m front to back; nothing goes below the floor. Metre scale, Y-up, forward −Z, floor-centred stationary root, character right +X |
| Geometry | {val['triangles']:,} triangles; one skin with {len(val['joints'])} joints and at most {ins['max_skin_influences']} influences per vertex |
| Materials | {len(val['materials'])} opaque materials sampling one atlas: {', '.join(m['name'] for m in val['materials'])}; one draw primitive each |
| Texture | One original embedded 1024 × 1024 PNG atlas ({val['images'][0]['bytes']:,} bytes), painted procedurally in Blender Python; no external resource or required decoder |
| Download | {val['bytes']:,} bytes; below the 2 MiB budget |
| GLB SHA-256 | `{val['sha256']}` |
| Blender master SHA-256 | `{mf[asset + '.blend']['sha256']}` |

## Motion and checks

![The exact model across idle, move, attack, hit and defeat]({rel('motion-contact-sheet.png')})

The viewer exposes """ + ', '.join(f"`{n}` ({clips[n]['duration_s']:g} s)" for n in ['idle', 'move', 'attack', 'hit', 'defeat']) + """:

""" + '\n'.join(f"- **{n.capitalize()}:** {T['motion'][n]}" for n in ['idle', 'move', 'attack', 'hit', 'defeat']) + f"""

The clips keep the root still; gameplay moves and turns the enemy. In the game, the wind-up plays the attack from its start to the 1.25 second contact at the enemy's wind-up speed, so the tell and the wind-up both show.

![The attack at 35% gameplay scale]({rel('attack-gameplay-scale.png')})

<div class="studio-comparison">
<figure><img src="{rel('attack-windup-side.png')}" alt="Side view of the attack wind-up"><figcaption>Attack wind-up</figcaption></figure>
<figure><img src="{rel('attack-contact-side.png')}" alt="Side view of the attack at the 1.25 second contact"><figcaption>Contact, 1.25 s</figcaption></figure>
<figure><img src="{rel('defeat-held.png')}" alt="The held defeat pose"><figcaption>Held defeat</figcaption></figure>
<figure><img src="{rel('defeat-held-front.png')}" alt="The held defeat pose from the front"><figcaption>Held defeat, front</figcaption></figure>
</div>

[Khronos validation]({rel('validation.json')}) reports {val['validator']['issues']['numErrors']} errors, {val['validator']['issues']['numWarnings']} warnings, {val['validator']['issues']['numInfos']} infos and {val['validator']['issues']['numHints']} hints (gltf-validator {val['validator'].get('validatorVersion')}, run in the Blender pod on the exact bytes), and all {len(checks_k)} contract checks pass.

[Three.js inspection]({rel('three-inspection.json')}) reimported the exact GLB with three r{ins['three_revision']} and the real `src/game/enemy-animation.ts` adapter. It sampled all {ins['animations']['idle']['vertices_per_sample']:,} exported vertices at 60 Hz in every clip and passed all {len(checks_t)} checks:

- every track resolves below the scene root, the root never moves, and the weights are normalised with at most four influences;
- `idle` and `move` loop seamlessly, `defeat` holds its final pose, and no clip goes below the floor;
- the culling envelope stored in the model covers every pose;
- it stands {H:.2f} m tall on the floor, inside the 1.3–1.6 m band, and `idle` starts in the concept pose;
- the adapter's wind-up contact pose matches the clip at 1.25 s, the defeat vanishes, and clones animate independently;
- part clearance: """ + '; '.join(k.replace('clear_', '').replace('_', ' ') for k in checks_t if k.startswith('clear_')) + """ (rest-space part boxes; a proxy, not triangle collision);
- asset beats: """ + '; '.join(k.replace('_', ' ') for k in checks_t if not k.startswith('clear_') and k not in ('five_exact_clips', 'attack_2_s', 'all_tracks_resolve_below_scene_root', 'no_root_motion', 'all_clips_move_vertices', 'idle_move_seamless', 'held_defeat', 'no_floor_penetration', 'at_most_four_influences', 'normalized_weights', 'height_1_3_to_1_6_m', 'standing_on_floor', 'floor_centred_body', 'one_1024_atlas', 'two_draw_primitives', 'exported_bounds_cover_all_poses', 'actual_adapter_contact_pose', 'actual_adapter_defeat_vanish', 'adapter_root_identity', 'independent_skeleton_clone')) + f""".

[Chromium playback]({rel('browser-inspection.json')}) (Chromium {bro['browser']}, ANGLE SwiftShader) rendered changing frames for all five clips at full and 35% scale, played each clip in real time at both scales, and drew the character in two draw calls. There were no console, HTTP or WebGL errors and no external requests. The review video is rendered from the exact GLB at 30 fps. No physical-device test has been run.

The author departed from the concept in these deliberate ways:

""" + '\n'.join('- ' + x for x in T['departures']) + """

The author also fixed these problems along the way:

""" + '\n'.join('- ' + x for x in T['fixes']) + f"""

## Catalog intake

- **Suggested placement:** {T['placement']}
- **Suggested catalog entry:** `{asset}@v001`, "{T['title']}", ordinary, `{T['kind']}`, period `{T['period']}`, window {T['window'][0]} → {T['window'][1]}.
- **Scene motion:** `contactFraction: 0.625`, `height: {H:.6f}`.
- **Clip mapping:** idle → `idle`, chasing → `move`, wind-up and strike → `attack` (contact 1.25 s), HP drop → `hit`, defeated → `defeat` (held from {clips['defeat'].get('held_final_pose_from_s')} s).
"""
dest = REPO / 'docs/assets/reviews' / asset; dest.mkdir(parents=True, exist_ok=True); (dest / 'v001.md').write_text(page)
media = lambda names: ['docs/assets/media/%s/v001/%s' % (asset, n) for n in names]
intake = {'id': asset, 'title': T['title'], 'category': 'action-minions', 'review': 'docs/assets/reviews/%s/v001.md' % asset,
  'concept_images': ['docs/assets/media/action-minions-a/v001/concept.png'] + media(['concept-row.png', 'concept-vs-export.png']),
  'model_images': media(['beauty.png', 'front.png', 'side.png', 'back.png', 'threequarter.png', 'motion-contact-sheet.png', 'attack-gameplay-scale.png', 'defeat-held.png']),
  'models': media([asset + '.glb']), 'videos': media(['review.webm']), 'audio': [], 'thumbnail': None, 'version': 'v001',
  'state': "completed model candidate from the coordinator's action-minions-a concept (row %d); technically checked; awaiting Tom's exact-version review" % (list(TEXT).index(asset) + 1),
  'gameplay_use': 'private-candidate',
  'description': T['reference'],
  'checksums': {'docs/assets/media/%s/v001/%s' % (asset, f['path'].split('/')[-1]): f['sha256'] for f in man['files'] if not f['path'].startswith('source/') and (M / f['path'].split('/')[-1]).exists()},
  'parody_catalog_suggestion': {'id': asset, 'title': T['title'], 'reference': T['reference'], 'role': 'ordinary', 'kind': T['kind'], 'periodId': T['period'], 'eligibleFrom': T['window'][0], 'eligibleThrough': T['window'][1], 'assetVersion': 'v001'},
  'scene_catalog_motion': {asset: {'contactFraction': .625, 'height': H}},
  'clip_mapping': {'idle': 'idle', 'chasing': 'move', 'windup': 'attack (0 → 1.25 s contact)', 'strike': 'attack', 'hit': 'hit', 'defeated': 'defeat'},
  'clips': {n: {'duration_s': clips[n]['duration_s'], 'loop': clips[n]['loop']} for n in clips},
  'suggested_placement': T['placement'], 'glb_sha256': val['sha256'], 'master_sha256': mf[asset + '.blend']['sha256'], 'triangles': val['triangles'], 'glb_bytes': val['bytes'],
  'height_m': H, 'review_page_sha256': sha(dest / 'v001.md'),
  'review_state': "Awaiting Tom's review (PRD-004 Q-03)", 'durable_root': str(DURABLE / asset)}
for p in (M / 'catalog-intake.json', DURABLE / asset / 'catalog-intake.json'): p.write_text(json.dumps(intake, indent=2) + '\n')
print(json.dumps({'review': str(dest / 'v001.md'), 'bytes': len(page), 'intake_checksums': len(intake['checksums'])}))
