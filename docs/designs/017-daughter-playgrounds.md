# DESIGN017: Two playground adventures for a six-year-old

Status: Lead implementation contract for PLAN009, September 12, 2026. Tom accepts the prior iPhone repairs, including sound, and prioritizes longer enjoyable levels before identity and curated personal photos.

## Play and pacing

Build a garden adventure ending at Drama Dragon and a colorful playground ending at the Besties. Each has several short obstacle activities, safe memory clearings, resident visits and four small fights before its boss. Reuse the current cast, equipment, scenery and audio. The main route changes direction and includes generous hops, low terraces, predictable padded sweepers and a ferry. A visible side path rejoins the route and offers a friendly discovery; it is never required to find the two main-path minor memories.

Aim for five to eight minutes per chapter for a first-time child as an initial tuning hypothesis. Keep walking speed and controls unchanged. Broad surfaces, gaps no wider than 1.4 metres across the moving cycle, rises no higher than 0.35 metres, safe landings before fights and frequent checkpoints make room to learn. No lives counter, race timer, repeated grind or punishment for exploration. A missed obstacle keeps the same nearby recovery and preserved gear/memories.

Roblox’s [Classic Obby template](https://create.roblox.com/docs/resources/templates#classic-obby) uses reusable checkpoints and obstacle objects; its [building tutorial](https://create.roblox.com/docs/tutorials/curriculums/building/get-started) introduces moving and jumping platform challenges. Our arrangement and forgiving tuning are lead design choices. Roblox also recommends [testing with a player avatar](https://create.roblox.com/docs/tutorials/curriculums/building/test-and-save) to check actual jump distances; a graph validation pass alone is insufficient here.

## Shared document

New immutable route IDs are `garden-playground-v1` and `besties-playground-v1`. Store plain JSON documents under `src/shared/levels/`, with `schemaVersion: "authored-level-v1"`, `id`, `theme`, reusable `pieces`, explicit `connections`, an ordered `mainPath`, optional `branches`, and content-role `anchors`. The schema and resolver live in `src/shared/authored-level.ts`; the registry and client layout adapter resolve each published document once. Humans and agents edit and validate the same data. This is a foundation for the editor, not a claim that the visual editor exists.

Pieces use the existing tested physics: `platform` (a static box), `moving-platform` (box plus x/z sinusoidal motion), `sweeper` (horizontal capsule plus optional translation/rotation), and `checkpoint` (safe feet position on a named static platform). Box centers/full sizes, capsule centers/radii and foot anchors are explicit metres in one +Y-up world frame. IDs are unique across pieces. No executable code, arbitrary rotation, scaling or unimplemented collider appears in a document. Low terraces are normal platform instances; a ferry is a moving-platform instance. Presets may compose these primitives while preserving their validated behavior.

Connections refer to platform IDs and declare `walk`, `jump` or `ride`. `mainPath` starts on the spawn platform and ends on the finish platform. Each branch starts and rejoins at main-path platforms; every listed edge must exist and fit supported geometry throughout sampled motion. The path graph supplies reachability and ordering checks and read-only browser navigation; it does not move the player or simulate victory.

Role anchors bind runtime content to coordinates: spawn, finish, reward respawn; attack/guard pickups; minor-one/minor-two/major memories; ordinary-1 through ordinary-4 and boss encounters; friendly-1 through friendly-3. An anchor has a position and supporting platform ID. Encounters also have an XZ arena and a safe retry checkpoint ID. Encounter slots bind by role and stable ordinary ordinal, not duplicate `kind` values; instances have distinct IDs even when artwork repeats. Keep gameplay anchors at ground height zero in this pass, with tested supported clearance. Low elevated surfaces are traversal-only until layered interactions are explicitly implemented.

Validate bounded positive geometry/motion, stable IDs and references, main/branch graph connections, safe static support for all gameplay anchors/checkpoints, safe checkpoint clearance from hazard sweep envelopes and encounters, reachable required placements, pickup ordering before fights, two minor memories before the boss and the major/finish after it. Encounter arenas must fit their supporting surfaces. Bound document size, total platforms/hazards and the rendered foliage budget. Report precise document paths for invalid data. Tests must reject unsafe examples, not just mirror a successful document.

## Compatibility and runtime

Keep the existing `era-level-plan-v3` progression shape. A new parody catalog version selects the two new immutable route IDs and four ordinary encounter instances plus one boss. Archived catalog and old route IDs retain their original layouts, roster cardinality and behavior; do not edit them in place. New plan validation checks the new contract without weakening old frozen-plan checks. Existing save progress is not migrated or deleted.

The layout adapter binds live IDs, state and selected content to the authored coordinates, providing the existing `LevelLayout` and `ObbyCourse`. Include route identity in runtime rebuild decisions. Retry uses the authored safe checkpoint associated with progression; reward recovery uses its explicit anchor.

Translate the Besties simulation, visual roots, hazard geometry, aim and target selection by the same resolved boss origin. Activation comes from its arena proximity, not a global Z threshold. Keep legacy defaults for old routes and verify a relocated encounter. Derive scenery extent and clear zones from the resolved course. Preserve contact-memory behavior, attack separation, paused status updates and the iPhone-tested audio/input paths.

Expose immutable authored navigation metadata through the existing read-only inspection surface for previews and tests. The browser driver follows actual platforms and dispatches normal touch/keyboard inputs. It must demonstrate ferry support/motion, checkpoint recovery, primary/secondary combat, real boss attacks and all memories without teleporting or fabricating encounter outcomes.

## Authoring checks

Run `pnpm exec tsx scripts/levels/validate.ts` to validate both registered documents, or append a JSON path to check a proposed revision. Diagnostics identify the invalid document path and constraint. New published content needs a new route version; the command does not publish a level or change an existing save.

A checkpoint's trigger and recovery point have different roles. Landing anywhere on its named platform can arm it, while its actual recovery point must have supported avatar clearance outside the full sweeper envelope and enemy strike range. Same-platform gear/fight ordering still needs physical placement and play testing; a platform graph alone cannot prove the order of two points on that platform. A `ride` connection includes ordinary jump boarding and disembarking, not an assurance that walking across its gap is possible.

## Following MVP stage

Identity and curated photos are required after the longer levels are ready for family review. Prepare the daughter’s subject and birthday, then let the author choose two minor pictures and a major picture per level from her authorized integration or manual uploads. Exact dates and age transitions come from that curation, not the synthetic fixture or an inferred birthday. The current 0 → 4 → 7 fixture remains visibly fictional during layout construction. Real admission, private photo handling and the personalized endpoint are separate acceptance before calling the daughter’s MVP complete.
