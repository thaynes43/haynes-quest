# DESIGN-002: Character and world asset pipeline

- **Status:** Proposed
- **Last updated:** 2026-09-10
- **Satisfies:** [PRD-001 R-03, R-07–R-09, R-12, R-14, R-16–R-18](../prds/001-project-brief.md)
- **Governed by:** [Proposed ADR-002](../adrs/002-web-game-stack.md)

## Overview

The family PoC uses developer-authored playable characters: create stylized references from suitable photos, build and rig models in Blender through MCP, validate them, and assign reusable GLB assets to stable character records. [DESIGN-003](003-photo-connections-and-people.md) owns the connection, person, character, and asset-assignment contract.

**Current phase:** finish documenting the technical and nontechnical requirements. Tom will arrange the asset-tool setup afterward. The planned foundation then uses synthetic libraries, data-configured roster entries, and prepared synthetic models. Family character authoring follows that validation. Automatic character generation is deferred to [BL-01](../BACKLOG.md#bl-01-automatic-playable-character-generation), conditional on a release beyond the family PoC. Image generation alone does not establish working geometry, rigging, or animation.

## Preferred authoring workflow

Tom proposed **image generation for asset sketches, followed by Blender controlled through MCP** on 2026-09-10. This is the recommended workflow for the game's shared art and the family's playable characters. The specific bridge and host remain to be selected and tested after requirements documentation is complete.

1. **Sketch and choose a direction.** Generate concept images for props, modular environment pieces, character templates, and other needed art. For a model reference, use consistent views, readable proportions, and clear materials; record the selected prompt and reference images so revisions preserve the design.
2. **Build in Blender through MCP.** The agent creates or adjusts geometry and materials, inspects scene data and viewport images, and iterates. Retain editable Blender files and reusable construction scripts.
3. **Prepare game behavior.** Add UVs, suitable textures, a rig, and the animations needed by the asset. Static props do not need a character rig. Test deformation and motion rather than judging only a still render.
4. **Export and validate.** Export GLB, apply the agreed geometry/material/texture budgets, and verify appearance and animation in Babylon on iPad, iPhone, and PC. A Blender render alone is not the runtime acceptance check.

This is a practical authoring approach for stylized assets. A sketch guides construction; it does not uniquely specify hidden geometry or produce an animation-ready model automatically. Complexity determines how much iteration an asset needs.

### Relationship to the character roster

Use the authoring workflow to build the PoC's meshes, materials, rigs, and animation sets. Assign each validated model to its configured character ID under [DESIGN-003](003-photo-connections-and-people.md). Names and roster size remain data-configured. Adding a person does not create a model; a developer supplies the asset before that character is playable.

Per-person authoring is valid for the family PoC. Capture reusable Blender scripts, meshes, and rigs when useful, while keeping character identity independent of its current model version. The deployed game loads prepared assets and does not need a connection to the authoring session. Automatic generation and its infrastructure are conditional future work in BL-01.

## Production workflow

| ID | Stage | Output and review |
| --- | --- | --- |
| D-01 | Synthetic prototype | Use data-configured characters with fictional placeholder art and opaque game-owned IDs. Exercise empty, small, and larger rosters, including additions and name changes, without editing application code. |
| D-02 | Photos to visual references | Select suitable photos for the configured person and generate consistent stylized reference images during developer authoring. Agree reference selection, pose, clothing, and appearance before making final assets. Unseen details are artistic choices, not facts recovered from one photo. |
| D-03 | References to geometry | Build and adjust geometry and materials in Blender through MCP. Preserve the chosen recognizable styling and produce geometry suitable for animation. Reuse base meshes where useful; per-person edits are part of PoC authoring. |
| D-04 | Rigging and animation | Use compatible skeleton naming and a consistent clip contract. The prototype exercises idle and locomotion; later gameplay determines the final actions. Check deformation and foot contact for each character's proportions. |
| D-05 | Export | Produce GLB/glTF 2.0 with tested materials, a documented orientation, normalized scale, skeleton, and named clips. Bake/export supported animation channels and inspect them in the engine. |
| D-06 | Optimize and validate | Apply geometry/material/texture checks and measured reductions, then run the Khronos validator. Validate the asset visually and on devices during development; retain private intermediate assets for diagnosis. Record tool versions, checksums, source provenance, and validation results. |
| D-07 | Integrate | Assign a new asset version to the same character ID only after checks pass. A failed export or validation leaves the existing good version in use. Acceptance includes camera framing, collider fit, animation, and device performance. |

Blender supports [background execution and Python scripts](https://docs.blender.org/manual/en/4.0/advanced/command_line/arguments.html), enabling a repeatable asset build. Its [glTF exporter](https://docs.blender.org/manual/en/dev/addons/scene_gltf2.html) documents the supported materials and animation channels. These manual editions are capability references, not the version pin: choose a supported release and verify its export settings when building the toolchain. Keep unsupported procedural effects out of the runtime contract or bake them deliberately.

## Tools and asset sources

**Image generation plus Blender MCP is the preferred PoC authoring direction.** Retain editable masters and reusable scripts, and validate a synthetic character before authoring personal assets. Automatic-generation provider comparisons belong to conditional backlog BL-01 and are not required to choose or validate this workflow.

For technical placeholders and animation references, [Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) and the [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) provide CC0 options. Check the files and tier of the actual download: editable source editions or larger bundles can differ. Their stock proportions are not the final character design. Simple scene geometry can be made directly in code; select reusable world packs after the world's visual direction is known.

Use [glTF Transform](https://gltf-transform.dev/cli) for inspection and selected optimization, and the [Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator) for format validation. A valid file can still look wrong or run poorly, so retain the in-game visual and device checks.

## Runtime contract and trial budgets

Each character manifest maps its opaque game ID to a versioned GLB, required clip names, and loading metadata. Names are editable labels and upstream person IDs are scoped to their photo connection. Locomotion/controller state is separate from the visible mesh. Document export-to-engine orientation with a fixture; test animation retargeting rather than assuming identically named bones are sufficient.

Start the prototype with provisional ceilings of **15,000 triangles and two materials per character, with textures no larger than 1024 pixels in either dimension**. These are working budgets, not owner requirements or performance guarantees. Measure download size, draw calls, animation cost, and memory before finalizing them. Load the selected character's full asset when needed; selection previews should not load or animate the entire roster continuously.

Choose compression after the basic model works. Babylon's [glTF loader documentation](https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/importers/glTF.md) describes Draco, Meshopt, and KTX2 support and CDN defaults. Package any required decoder/transcoder files locally and verify their requests. Do not add every compression system by default.

## Storage and provenance

This repository is public. Keep family source photos, generated likeness reference sheets, and identifiable character masters/runtime exports in private asset storage, delivered to admitted players through the application. Public source control and build images contain code, synthetic fixtures, nonpersonal licensed assets, and metadata appropriate for publication. Git LFS does not make a public repository private.

Character references and collectible photos use the configured connection and people, with potentially different filters for each game use. Original photo libraries are not bundled into releases. Reference images and models are prepared during developer authoring; the game reuses the validated export when a saved game starts.

Record each asset's source, license or generation provenance, tools/versions, editable master location, export settings, checksum, clip list, and review result. Public manifests must not contain private storage URLs, personal metadata, or credentials.

## Tooling readiness and validation

Image generation is available in the current agent session. No Blender MCP tools are connected. The dev pod provides Node, pnpm, and Python; Blender, glTF Transform, and a KTX texture encoder were not installed when checked on 2026-09-10. **Setup is deferred until technical and nontechnical requirements are documented**, at Tom's direction. No images, models, software installations, or connections were created during this workflow review.

A concrete bridge candidate is [ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp/tree/5f8ddaf6e987c4aa0c3467fcc548838b28f64477). Its [MCP implementation](https://github.com/ahujasid/blender-mcp/blob/5f8ddaf6e987c4aa0c3467fcc548838b28f64477/src/blender_mcp/server.py) supports scene/object inspection, viewport screenshots, and Python execution. This supplies the build/inspect/adjust loop; Blender's Python operators provide the modeling and export operations. It is a third-party bridge, not a model-generation guarantee or a selected production dependency.

Record these requirements for later setup:

- **Blender host and display:** the candidate's [add-on](https://github.com/ahujasid/blender-mcp/blob/5f8ddaf6e987c4aa0c3467fcc548838b28f64477/addon.py) expects a running Blender session and explicitly rejects background `-b` mode. Choose a workstation or a tested graphical/virtual-display homelab host. This restriction is specific to this interactive bridge; Blender's separate background export capability remains useful for repeatable asset builds.
- **Transport and files:** its MCP process uses stdio and communicates with the add-on over a TCP socket, defaulting to loopback port 9876. The [screenshot implementation](https://github.com/ahujasid/blender-mcp/blob/5f8ddaf6e987c4aa0c3467fcc548838b28f64477/src/blender_mcp/server.py#L461) writes on Blender's filesystem and reads from the MCP process's filesystem. Colocation or a tested shared-file/transfer arrangement is required. Changing a host setting alone does not establish remote authoring; the exact private connection from the dev pod remains to be designed.
- **Private workspace:** agree where source references, editable files, renders, and exports live. Configure the candidate's documented `DISABLE_TELEMETRY=true` before using private art, and verify it during setup. See its [setup and telemetry documentation](https://github.com/ahujasid/blender-mcp/blob/5f8ddaf6e987c4aa0c3467fcc548838b28f64477/README.md).
- **Pod registration:** record the bridge in haynes-ops's GitOps-managed `kubernetes/main/apps/dev/dev-env/app/resources/config/claude/mcp.json`, following that repo's session-restart workflow when the later setup task happens. Do not register a one-off server in this pod's generated config. Pin and test matching bridge/add-on versions.
- **First connection check:** inspect a synthetic scene, create a simple object, retrieve a viewport image, save/reopen the editable file, and export/load a GLB. Establish the complete loop before introducing personal references or complex character work.

Pin the authoring and export tools when setup occurs; manage any homelab-hosted tooling through `haynes-ops`. The family PoC does not require a runtime generation worker or simulated generation jobs.

The foundation trial must reproduce an exported synthetic GLB, play its animations in the chosen engine, pass format validation, and measure behavior on actual devices. Assigning a validated replacement asset must preserve character identity and saves; a rejected asset must leave the previous version usable. Deferred PRD-001 AC-10 belongs to BL-01 and is not a PoC completion criterion.
