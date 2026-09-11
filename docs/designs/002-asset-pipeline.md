# DESIGN-002: Character and world asset pipeline

- **Status:** Proposed implementation; owner-confirmed workflow
- **Last updated:** 2026-09-11
- **Satisfies:** [PRD-001 R-07, R-12, R-29, R-36, R-38, R-41](../prds/001-project-brief.md)
- **Read with:** [Art direction](../assets/art-direction.md), [team routing](../../.agents/TEAM.md), [PLAN-004](../../.agents/plans/completed/004-overnight-mvp.md), [audio pipeline](008-audio-pipeline.md)

## Direction and scope

Tom wants polished storybook visuals, with Disney Dreamlight Valley as a broad look-and-feel reference and Roblox-like gameplay. The [art brief](../assets/art-direction.md) establishes the project's original palette, shapes, surfaces and atmosphere. The lead maintains it as a versioned reference set rather than asking independent agents to invent a style for each asset.

The avatar begins mysterious at memory age zero and grows toward the represented person's age and likeness. Tonight uses fictional infant/child variants to prove visible growth and a private versioned appearance contract. Automatic photo-to-model generation remains deferred under [BL-01](../BACKLOG.md#bl-01-automatic-playable-character-generation). Do not send private family references to external generators as part of the synthetic milestone.

Tom authorizes the autonomous lead to produce **first-pass candidates for every asset needed by the current MVP**, with images for every visual asset, then models, iteration and audio candidates. The [catalog](../assets/catalog.md) bounds that initial inventory. The coordinator may select concepts and begin modeling before Tom reviews them. Tom's exact-version review still precedes final asset promotion into gameplay. Candidate production and an isolated review scene can continue overnight; placeholders keep the game usable.

## Production loop

1. **Establish direction, serially.** Driving Astra uses the built-in image generation tool to create the environment, character and material/prop references in the art brief, inspecting one result before generating the next. Record selected images, prompts, reference versions and checksums. Save project outputs into durable project storage; a transient tool preview is not a handoff. Never delegate or parallelize image generation.
2. **Sketch each asset.** Generate a concept with the same references and consistent proportions. Use matched front/side/back views where needed, label construction details, and reconcile contradictions. These sketches are guides, not editable mesh wireframes. The coordinator selects a candidate and records that decision independently of Tom's pending review.
3. **Dispatch an Astra Blender agent.** Every Blender task uses `gpt-6-astra` at `max` with an empty context and a self-contained work order. Supply actual image files, art-brief version, scale/orientation, required clips, budgets, artifact conventions and acceptance views. Grant exclusive ownership of the remote scene. Another asset can be sketched or coded concurrently, but another agent cannot mutate that scene.
4. **Build and return.** The Blender agent constructs geometry and materials, adds suitable UVs/textures, and rigs/animates assets that need movement. Retain the editable `.blend`, construction/export scripts, GLB, useful stills/turntable and named animation examples. Transfer the real files from the remote service and verify checksums; local worktree paths are not remote paths.
5. **Intake and iterate.** The coordinator compares renders to the selected concepts at matching angles, inspects the actual exported GLB in a browser review scene, and checks motion and gameplay-scale readability. Dispatch a fresh Astra Blender agent for a new revision task, with precise correction notes, prior work-order context and artifact versions. Fix silhouette/proportions before surface detail. Record technical evidence and limitations; keep prior versions.
6. **Catalog and review.** Publish public-safe source concepts alongside their models in the MkDocs Material [asset studio](../assets/README.md). Include local 3D viewing with still/download fallbacks, animation views and editable-master references. Audio uses the same version/status conventions with native audition controls. Mark the coordinator-selected candidate **Ready for Tom** only once its evidence is attached.
7. **Promote the reviewed version.** Record Tom's decision against the exact artifact set and checksums, then update runtime manifests for approved versions. Material revisions create a new review version. Ordinary code/docs/candidate-catalog PRs can merge autonomously; a merge is not asset approval.

The coordinator can produce the complete scoped first pass without awaiting intermediate owner choices. Required technical fixes come before repeated aesthetic variations; stop at a coherent reviewable candidate and retain a short list of options for Tom. If a tool/model limit blocks one lane, checkpoint it and continue independent work under the [team recovery rules](../../.agents/TEAM.md).

## Avatar growth and runtime behavior

[DESIGN-006](006-memory-age-and-abilities.md) owns memory-age progression and retained abilities. Asset versions supply compatible proportions, clips and appearance variants; they do not grant powers or alter saved age. A child journey may end as a child. Keep stable subject, journey and ability IDs separate from mesh identities.

Tonight demonstrates at least one visible growth transition with fictional references and known fictional birth dates. Inspect both stages side by side and in motion. Preserve camera framing, controller/collider fit, animation mappings and existing saves when a variant changes. Missing clips or assets produce a recoverable state instead of granting an action or losing progress. Later person-specific references and likeness variants remain private and require their own review.

## Era enemies and broader production

Current and later enemies/bosses follow [DESIGN-005](005-era-enemy-catalog.md): a finite authored catalog, calendar-period eligibility, original names/silhouettes/costumes/sounds, and source or license provenance. Television, games and online culture inform curation; runtime generation or reference-media downloading is not required. Renaming or recoloring a recognizable franchise character does not establish an original design or legal clearance. The current two-period equipment/enemy/boss assets belong to PLAN-005. A complete historical roster and additional worlds remain beyond that bounded slice; they do not remove the current authoring requirement.

## Runtime contract and trial budgets

The avatar manifest maps its asset identity to a versioned GLB, required clip names, loading metadata, and action/animation compatibility for the selected ability set. Enemy/boss catalog entries use the same versioned-asset pattern with their own identities and clip requirements. Person and journey identities belong to the photo/save contracts, independently of this manifest. Locomotion/controller state is separate from the visible mesh. Document export-to-engine orientation with a fixture; test animation retargeting rather than assuming identically named bones are sufficient.

Start the prototype with provisional ceilings of **15,000 triangles and two materials per character, with textures no larger than 1024 pixels in either dimension**. These are working budgets, not owner requirements or performance guarantees. Measure download size, draw calls, animation cost, and memory before finalizing them. Load the shared avatar when needed; do not eagerly load every chapter asset or photo into memory.

Choose compression after the basic model works. Three.js's [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) documents Draco, Meshopt, and KTX2 integration. Configure [Draco decoder paths](https://threejs.org/docs/pages/DRACOLoader.html) and [KTX2 transcoder paths](https://threejs.org/docs/pages/KTX2Loader.html) only for formats we actually use. Package the required resources locally and verify their requests. Do not add every compression system by default.

## Review records and storage

Use the [review template](../assets/000-review-template.md), with a stable asset/cue ID, immutable candidate version, concept references, all output checksums, actual authoring model/tool versions, build/export settings, technical results and separate coordinator/owner decisions. A new agent must be able to reproduce or revise the asset, and Tom must see the source-to-model relationship without searching session logs.

Public-safe concepts, previews and permitted small exports belong under `docs/assets/media/<asset-id>/<version>/`; review records belong under `docs/assets/reviews/<asset-id>/<version>.md`. Large editable masters stay on the persistent authoring workspace, with stable relative artifact IDs and checksums. The docs build is a review catalog, not a second editable source of the plans. Do not automatically apply the code license to third-party or generated media; retain applicable provenance/terms.

Never put family photos, real person labels, dates of birth, private likeness material, secrets or credential-bearing URLs into public git or the static site, including generated indexes and metadata. A hidden page or public Git LFS pointer is not private. Later personal review needs a separately authenticated media path; public catalog pages must not leak its identifiers. Photo delivery remains the application's authorized server responsibility.

## Dedicated authoring services

Blender runs independently of dev-env at `http://blender-authoring.dev.svc.cluster.local:8000/mcp`, with an editable `/workspace` PVC and downloads at `/artifacts/<relative-path>`. The interactive bridge uses Blender with Xvfb/software graphics; it is not a background-only Blender process. Only the internal MCP service is exposed; raw addon TCP remains loopback. Keep scene mutation exclusive and never assume a local file is visible remotely. Verify actual upload/transfer support before assigning reference paths.

The [Blender runbook](https://github.com/thaynes43/haynes-ops/blob/main/.agents/runbooks/blender-authoring.md) is authoritative for pins, supported operations and artifact transfer. [PLAN-003](../../.agents/plans/completed/003-authoring-tool-setup.md) records successful live scene, viewport, GLB validator, checksum and persistence checks. Native registration is staged pending the single dev-env activation; setup meshes are not approved game assets. Never edit generated MCP configuration or restart dev-env for routine authoring.

Audio is independently available at `http://audio-authoring.dev.svc.cluster.local:8000/mcp`; [DESIGN-008](008-audio-pipeline.md) and its ops runbook define jobs, downloads and processing. The game consumes prepared files and never depends on a live authoring scene or generator during play.

## Acceptance evidence

A first-pass asset is reviewable when its concept/audio source, editable master, runtime candidate, previews and exact version agree; the coordinator has checked it against the art brief; and real technical checks are recorded. For models, run the Khronos glTF validator and inspect GLB materials, required animation clips, orientation and scale in the engine. For sounds, validate format/levels and supply an audible export with loop notes. Do not claim listening review if no one/tool actually listened.

Actual iPad/iPhone Safari and PC rendering/performance checks remain necessary before calling an asset production-ready. Browser automation or a Blender still alone is insufficient evidence of physical-device behavior. Keep that distinction visible in the catalog while Tom reviews and fine-tunes the first pass.
