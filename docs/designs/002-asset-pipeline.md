# DESIGN-002: Character and world asset pipeline

- **Status:** Proposed
- **Last updated:** 2026-09-10
- **Satisfies:** [PRD-001 R-03, R-07–R-09, R-12, R-14, R-16–R-18, R-20–R-34](../prds/001-project-brief.md)
- **Governed by:** [Proposed ADR-002](../adrs/002-web-game-stack.md)

## Overview

The family PoC uses a shared generic, mysterious avatar: create concept references, build and rig the model in Blender through MCP, validate it, obtain Tom's review of the final version, and publish the approved reusable GLB. The avatar needs no real-person likeness or personal photo reference. [DESIGN-003](003-photo-connections-and-people.md) owns photo connections and people; [DESIGN-004](004-memory-journey.md) defines their memory timelines independently of avatar artwork.

**Current phase:** establish the bounded playable loop in [DESIGN-007](007-poc-development-loop.md). Code can use synthetic memories and a generic placeholder while the tools for final candidates are arranged. Validate the small authoring loop before broader avatar/world production; Tom reviews final visual and audio versions before they enter gameplay. Automatic person-specific character generation is deferred to [BL-01](../BACKLOG.md#bl-01-automatic-playable-character-generation), conditional on a broader release and a separate decision to reintroduce person-specific avatars. Image generation alone does not establish working geometry, rigging, or animation.

## Preferred authoring workflow

Tom confirmed **image generation for asset sketches, followed by Blender controlled through MCP**, with his review before final assets are used. This is the agreed workflow for the game's shared avatar, enemy/boss catalog, and world art. The specific bridge and host remain to be selected and tested before their authoring milestone; code can proceed with placeholders.

The [Astra community-workflow review](../reference/astra-game-workflows.md) found a close firsthand precedent in AstraBurn: imagegen mocks, matching Blender models, then Three.js integration. Chess Cubed separately reports Blender MCP with Babylon. These support evaluating the workflow without making a particular bridge or engine mandatory for asset authoring; they do not prove our export quality or device performance.

1. **Sketch and choose a direction.** Generate concept images for props, modular environment pieces, character templates, and other needed art. Use consistent front, side, and back reference views where useful, with readable proportions and clear materials. These reference sheets or line-art guides are the planning images meant by “wireframes”; actual editable mesh topology is created in Blender. Record the selected prompt and references so revisions preserve the design.
2. **Build in Blender through MCP.** The agent creates or adjusts geometry and materials, inspects scene data and viewport images, and iterates. Compare renders with the selected references from matching camera angles, fixing silhouette and proportions before detail. Retain editable Blender files and reusable construction scripts.
3. **Prepare game behavior.** Add UVs, suitable textures, a rig, and the animations needed by the asset. Static props do not need a character rig. Test deformation and motion rather than judging only a still render.
4. **Export and validate.** Export GLB, apply the agreed geometry/material/texture budgets, and verify appearance and animation in an isolated Three.js review preview on iPad, iPhone, and PC. A Blender render alone is not the runtime acceptance check.
5. **Review and promote.** Present concrete renders, animation clips, and technical evidence to Tom using the [asset-review template](../assets/000-review-template.md). Record his decision against the exact version before gameplay integration. Material revisions return to review; placeholders or the previous approved version remain usable meanwhile.

This is a practical authoring approach for stylized assets. A sketch guides construction; it does not uniquely specify hidden geometry or produce an animation-ready model automatically. Complexity determines how much iteration an asset needs.

### Relationship to memory journeys

Use the authoring workflow to build the PoC's avatar, materials, rig, and animation set. Publish validated, Tom-approved versions under a stable avatar-asset identity. The same avatar can explore any configured person's memories; adding a person with usable photos requires no new art.

Capture reusable Blender scripts, meshes, and rigs when useful. Keep subject identity and journey progress independent of avatar versions. The deployed game loads prepared assets and does not need a connection to the authoring session. Personalized avatars and automatic generation would require a separate product decision under BL-01.

## Growth and ability animation

[DESIGN-006](006-memory-age-and-abilities.md) adds an age-zero baby start and abilities that accumulate as memories advance age. The avatar remains generic. Define animation/controller support for the chosen initial baby actions, later movement, tools, and puzzle interactions; the small PoC action pair comes before its final clip production, while the full ability/threshold catalog remains later design. Visual growth could use posture, proportions, or asset variants, but the number of meshes and rig strategy are not yet selected.

Stable ability IDs belong to game progression, with asset metadata mapping available actions to compatible animation clips and controller/collider behavior. A new mesh or animation version must preserve saved unlocks. Missing clips need a recoverable asset state rather than silently granting a different ability or removing progression. Test transitions, camera framing, collision fit, and retained earlier actions with synthetic assets on touch and PC before final art. Reusing an animation does not grant permission to invoke a locked action.

## Era-inspired enemy and boss assets

[DESIGN-005](005-era-enemy-catalog.md) adds a finite, authored catalog of enemies and bosses whose influences fit the years represented by the photo journey. Record a reference's historical eligibility and the broad period qualities the asset should evoke, then create an original concept, model, materials, and animation set through the same workflow. Television, animation, games, YouTube, and internet culture are curation sources; they are not runtime media downloads or model-generation inputs during play.

The concept brief must establish the game's own names, silhouettes, costumes, personalities, effects, and sound. Changing only the name or colors of a recognizable franchise character does not meet this authoring direction. Record original design provenance or appropriate licenses for reused assets. The copyright references and limits in DESIGN-005 explain why loose inspiration alone is not legal clearance; no finished enemy design is being cleared by this document.

Reuse rigs and behaviors where useful, while documenting each entry's ordinary-enemy/boss role, animation needs, and measured runtime cost. Validate active encounters on the target devices rather than assuming the avatar's provisional budget guarantees performance with many enemies. The catalog can expand through authored releases, with stable IDs and saved-encounter compatibility under DESIGN-005. No catalog entries or enemy assets are being created in the current documentation phase.

## Production workflow

| ID | Stage | Output and review |
| --- | --- | --- |
| D-01 | Synthetic prototype | Use fictional people/photos and one shared placeholder avatar. Exercise journeys for different subjects, including additions and name changes, without editing application code or authoring another model. |
| D-02 | Concepts to visual references | Generate consistent stylized references for the mysterious avatar, original enemies/bosses, and world assets. Agree silhouette, pose, clothing, and materials before final modeling. The avatar design is an artistic choice and does not require resemblance to a configured person. |
| D-03 | References to geometry | Build and adjust geometry and materials in Blender through MCP. Preserve the chosen styling and produce geometry suitable for animation. Reuse base meshes and construction scripts where useful. |
| D-04 | Rigging and animation | Use compatible skeleton naming and a consistent clip contract. The prototype exercises the agreed initial baby movement and a small later-ability transition alongside idle/locomotion; later gameplay determines the full action set. Check deformation and foot contact for the avatar's proportions. |
| D-05 | Export | Produce GLB/glTF 2.0 with tested materials, a documented orientation, normalized scale, skeleton, and named clips. Bake/export supported animation channels and inspect them in the engine. |
| D-06 | Optimize and validate | Apply geometry/material/texture checks and measured reductions, then run the Khronos validator. Validate the asset visually and on devices during development; retain private intermediate assets for diagnosis. Record tool versions, checksums, source provenance, and validation results. |
| D-07 | Review and integrate | Publish a new version under the same avatar-asset identity only after checks pass and Tom reviews and approves that exact final version, preserving every saved journey. Pending/rejected candidates and failed exports leave placeholders or the previous approved version in use. Acceptance includes camera framing, collider fit, animation, and device performance. |

Blender supports [background execution and Python scripts](https://docs.blender.org/manual/en/4.0/advanced/command_line/arguments.html), enabling a repeatable asset build. Its [glTF exporter](https://docs.blender.org/manual/en/dev/addons/scene_gltf2.html) documents the supported materials and animation channels. These manual editions are capability references, not the version pin: choose a supported release and verify its export settings when building the toolchain. Keep unsupported procedural effects out of the runtime contract or bake them deliberately.

## Tools and asset sources

**Image generation plus Blender MCP is the preferred PoC authoring direction.** Retain editable masters and reusable scripts, and validate a synthetic avatar before authoring final game assets. Automatic-generation provider comparisons belong to conditional backlog BL-01 and are not required to choose or validate this workflow.

For technical placeholders and animation references, [Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) and the [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) provide CC0 options. Check the files and tier of the actual download: editable source editions or larger bundles can differ. Their stock proportions are not the final character design. Simple scene geometry can be made directly in code; select reusable world packs after the world's visual direction is known.

Use [glTF Transform](https://gltf-transform.dev/cli) for inspection and selected optimization, and the [Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator) for format validation. A valid file can still look wrong or run poorly, so retain the in-game visual and device checks.

## Runtime contract and trial budgets

The avatar manifest maps its asset identity to a versioned GLB, required clip names, loading metadata, and action/animation compatibility for the selected ability set. Enemy/boss catalog entries use the same versioned-asset pattern with their own identities and clip requirements. Person and journey identities belong to the photo/save contracts, independently of this manifest. Locomotion/controller state is separate from the visible mesh. Document export-to-engine orientation with a fixture; test animation retargeting rather than assuming identically named bones are sufficient.

Start the prototype with provisional ceilings of **15,000 triangles and two materials per character, with textures no larger than 1024 pixels in either dimension**. These are working budgets, not owner requirements or performance guarantees. Measure download size, draw calls, animation cost, and memory before finalizing them. Load the shared avatar when needed; do not eagerly load every chapter asset or photo into memory.

Choose compression after the basic model works. Three.js's [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) documents Draco, Meshopt, and KTX2 integration. Configure [Draco decoder paths](https://threejs.org/docs/pages/DRACOLoader.html) and [KTX2 transcoder paths](https://threejs.org/docs/pages/KTX2Loader.html) only for formats we actually use. Package the required resources locally and verify their requests. Do not add every compression system by default.

## Storage and provenance

This repository is public. Keep personal photos, birth information, and private timeline metadata out of source control and published build artifacts. Deliver authorized photos through the application. Nonpersonal avatar/world art can be stored with the project when its license and provenance permit. Any future personal reference sheets or likeness models require private storage. Git LFS does not make a public repository private.

Collectible memories use the selected subject and configured photo connection. Original photo libraries are not bundled into releases. Avatar concepts are independent of those photos; references and models are prepared during developer authoring, and every journey reuses the validated export.

Record each asset's source, license or generation provenance, tools/versions, editable master location, export settings, checksum, clip list, and review result. Public manifests must not contain private storage URLs, personal metadata, or credentials. Audio candidates follow the same exact-version review rule, with source/distribution conditions and private master storage described in [DESIGN-008](008-audio-pipeline.md).

## Tooling readiness and validation

Image generation is available in the current agent session. No Blender MCP tools are connected. The dev pod provides Node, pnpm, and Python; Blender, glTF Transform, and a KTX texture encoder were not available on PATH when checked on 2026-09-10. Setup is a dependency of the authoring milestone in DESIGN-007, not a blanket gate on synthetic prototype code. No images, models, software installations, or connections were created during this workflow review.

A concrete bridge candidate is [ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp/tree/5f8ddaf6e987c4aa0c3467fcc548838b28f64477). Its [MCP implementation](https://github.com/ahujasid/blender-mcp/blob/5f8ddaf6e987c4aa0c3467fcc548838b28f64477/src/blender_mcp/server.py) supports scene/object inspection, viewport screenshots, and Python execution. This supplies the build/inspect/adjust loop; Blender's Python operators provide the modeling and export operations. It is a third-party bridge, not a model-generation guarantee or a selected production dependency.

Record these requirements for later setup:

- **Blender host and display:** the candidate's [add-on](https://github.com/ahujasid/blender-mcp/blob/5f8ddaf6e987c4aa0c3467fcc548838b28f64477/addon.py) expects a running Blender session and explicitly rejects background `-b` mode. Choose a workstation or a tested graphical/virtual-display homelab host. This restriction is specific to this interactive bridge; Blender's separate background export capability remains useful for repeatable asset builds.
- **Transport and files:** its MCP process uses stdio and communicates with the add-on over a TCP socket, defaulting to loopback port 9876. The [screenshot implementation](https://github.com/ahujasid/blender-mcp/blob/5f8ddaf6e987c4aa0c3467fcc548838b28f64477/src/blender_mcp/server.py#L461) writes on Blender's filesystem and reads from the MCP process's filesystem. Colocation or a tested shared-file/transfer arrangement is required. Changing a host setting alone does not establish remote authoring; the exact private connection from the dev pod remains to be designed.
- **Private workspace:** agree where source references, editable files, renders, and exports live. Configure the candidate's documented `DISABLE_TELEMETRY=true` before using private art, and verify it during setup. See its [setup and telemetry documentation](https://github.com/ahujasid/blender-mcp/blob/5f8ddaf6e987c4aa0c3467fcc548838b28f64477/README.md).
- **Pod registration:** record the bridge in haynes-ops's GitOps-managed `kubernetes/main/apps/dev/dev-env/app/resources/config/claude/mcp.json`, following that repo's session-restart workflow when the later setup task happens. Do not register a one-off server in this pod's generated config. Pin and test matching bridge/add-on versions.
- **First connection check:** inspect a synthetic scene, create a simple object, retrieve a viewport image, save/reopen the editable file, and export/load a GLB. Establish the complete loop before final avatar/world production. Personal references are not a PoC prerequisite.

Pin the authoring and export tools when setup occurs; manage any homelab-hosted tooling through `haynes-ops`. The family PoC does not require a runtime generation worker or simulated generation jobs.

The foundation trial must reproduce an exported synthetic GLB, play its animations in the chosen engine, pass format validation, and measure behavior on actual devices. Publishing a validated, Tom-approved avatar replacement must preserve the selected subject, chapter, and memories; a rejected asset must leave the previous version usable. Deferred PRD-001 AC-10 belongs to BL-01 and is not a PoC completion criterion.
