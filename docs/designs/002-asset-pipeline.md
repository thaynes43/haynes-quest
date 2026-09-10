# DESIGN-002: Character and world asset pipeline

- **Status:** Proposed
- **Last updated:** 2026-09-10
- **Satisfies:** [PRD-001 R-03, R-07–R-09, R-12, R-14–R-18](../prds/001-project-brief.md)
- **Governed by:** [Proposed ADR-002](../adrs/002-web-game-stack.md)

## Overview

The application generates playable characters from photos of people configured in a self-hosted photo connection. Preparation runs in the background: retrieve suitable photos, generate stylized references, generate and rig the model, validate it, and publish a reusable GLB asset. [DESIGN-003](003-photo-connections-and-people.md) owns the connection, person, character, and job lifecycle.

**Current phase:** finish documenting the technical and nontechnical requirements. Tom will arrange the asset-tool setup afterward. The planned foundation then uses synthetic libraries, arbitrary roster entries, and a simulated generator; a later trial validates real automated character generation. Each user-added person must be supported by the application workflow. Image generation alone does not establish working geometry, rigging, or animation.

## Preferred authoring workflow

Tom proposed **image generation for asset sketches, followed by Blender controlled through MCP** on 2026-09-10. This is the recommended workflow for authoring the game's shared art and developing its reusable character components. The specific bridge and host remain to be selected and tested after requirements documentation is complete.

1. **Sketch and choose a direction.** Generate concept images for props, modular environment pieces, character templates, and other needed art. For a model reference, use consistent views, readable proportions, and clear materials; record the selected prompt and reference images so revisions preserve the design.
2. **Build in Blender through MCP.** The agent creates or adjusts geometry and materials, inspects scene data and viewport images, and iterates. Retain editable Blender files and reusable construction scripts.
3. **Prepare game behavior.** Add UVs, suitable textures, a rig, and the animations needed by the asset. Static props do not need a character rig. Test deformation and motion rather than judging only a still render.
4. **Export and validate.** Export GLB, apply the agreed geometry/material/texture budgets, and verify appearance and animation in Babylon on iPad, iPhone, and PC. A Blender render alone is not the runtime acceptance check.

This is a practical authoring approach for stylized assets. A sketch guides construction; it does not uniquely specify hidden geometry or produce an animation-ready model automatically. Complexity determines how much iteration an asset needs.

### Relationship to generated player characters

Use the authoring workflow to build base meshes, materials, rigs, animation sets, and repeatable generation recipes. The application's open-ended, photo-derived character feature still follows [DESIGN-003](003-photo-connections-and-people.md): configured people become characters through a persisted preparation workflow.

Interactive image-generation and Blender MCP tools used by a developer session do not automatically become APIs available to the deployed game. A runtime generation service or reproducible job must be integrated and validated separately. Capture successful Blender operations as reusable scripts or templates where possible; normal user setup must not depend on an interactive developer session modeling each person.

## Production workflow

| ID | Stage | Output and review |
| --- | --- | --- |
| D-01 | Synthetic prototype | Use data-configured characters with fictional placeholder art and opaque game-owned IDs. Exercise empty, small, and larger rosters, including additions and name changes, without editing application code. |
| D-02 | Photos to visual references | Fetch the resolved person's suitable photos through the configured adapter and generate consistent stylized reference images. Define reference selection, pose, clothing, and preview controls during the real generation trial. Unseen details are artistic choices, not facts recovered from one photo. |
| D-03 | References to geometry | Evaluate an automated generator or a controlled customizable humanoid pipeline. Preserve the person's recognizable styling and produce geometry suitable for animation. Blender can support recipe development, automated processing, and diagnostic cleanup; manual per-person edits cannot be required for normal setup. |
| D-04 | Rigging and animation | Use compatible skeleton naming and a consistent clip contract. The prototype exercises idle and locomotion; later gameplay determines the final actions. Check deformation and foot contact for each character's proportions. |
| D-05 | Export | Produce GLB/glTF 2.0 with tested materials, a documented orientation, normalized scale, skeleton, and named clips. Bake/export supported animation channels and inspect them in the engine. |
| D-06 | Optimize and validate | Apply automated geometry/material/texture checks and measured reductions, then run the Khronos validator. Validate the recipe visually and on devices during development; retain private intermediate assets for diagnosis. Record tool versions, checksums, source provenance, and validation results. |
| D-07 | Integrate | Publish a ready asset version for the same character ID only after checks pass. Failed preparation shows a recoverable state and preserves an existing good version. Recipe acceptance includes camera framing, collider fit, animation, and device performance. |

Blender supports [background execution and Python scripts](https://docs.blender.org/manual/en/4.0/advanced/command_line/arguments.html), enabling a repeatable asset build. Its [glTF exporter](https://docs.blender.org/manual/en/dev/addons/scene_gltf2.html) documents the supported materials and animation channels. These manual editions are capability references, not the version pin: choose a supported release and verify its export settings when building the toolchain. Keep unsupported procedural effects out of the runtime contract or bake them deliberately.

## Tools and asset sources

**Image generation plus Blender MCP is the preferred authoring direction; the automatic generation backend is not yet selected.** Compare a controlled customizable base-character pipeline with a photo/reference-to-3D generator, including how each supplies a usable rig and consistent animation. Choose only after demonstrating acceptable character quality and repeatable automation. Retain editable base assets and reproducible scripts where the recipe uses them.

Meshy's [Image-to-3D API](https://docs.meshy.ai/en/api/image-to-3d) offers GLB output and remeshing. Its [rigging API](https://docs.meshy.ai/en/api/rigging) expects suitable textured humanoids with clear limbs and has additional input limits. It is one possible trial candidate, not the chosen backend. Evaluate the complete automated reference/model/rig path and reject unusable results rather than assuming a manual cleanup step can finish every user request. Account access, credits, terms, and service suitability would need checking for that evaluation; none have been assumed or used. A self-hosted photo source does not select where generation runs.

For technical placeholders and animation references, [Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) and the [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) provide CC0 options. Check the files and tier of the actual download: editable source editions or larger bundles can differ. Their stock proportions are not the final character design. Simple scene geometry can be made directly in code; select reusable world packs after the world's visual direction is known.

Use [glTF Transform](https://gltf-transform.dev/cli) for inspection and selected optimization, and the [Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator) for format validation. A valid file can still look wrong or run poorly, so retain the in-game visual and device checks.

## Runtime contract and trial budgets

Each character manifest maps its opaque game ID to a versioned GLB, required clip names, and loading metadata. Names are editable labels and upstream person IDs are scoped to their photo connection. Locomotion/controller state is separate from the visible mesh. Document export-to-engine orientation with a fixture; test animation retargeting rather than assuming identically named bones are sufficient.

Start the prototype with provisional ceilings of **15,000 triangles and two materials per character, with textures no larger than 1024 pixels in either dimension**. These are working budgets, not owner requirements or performance guarantees. Measure download size, draw calls, animation cost, and memory before finalizing them. Load the selected character's full asset when needed; selection previews should not load or animate the entire roster continuously.

Choose compression after the basic model works. Babylon's [glTF loader documentation](https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/importers/glTF.md) describes Draco, Meshopt, and KTX2 support and CDN defaults. Package any required decoder/transcoder files locally and verify their requests. Do not add every compression system by default.

## Storage and provenance

This repository is public. Keep family source photos, generated likeness reference sheets, and identifiable character masters/runtime exports in private asset storage, delivered to admitted players through the application. Public source control and build images contain code, synthetic fixtures, nonpersonal licensed assets, and metadata appropriate for publication. Git LFS does not make a public repository private.

Character references and collectible photos use the configured connection and people, with potentially different filters for each game use. Original photo libraries are not bundled into releases. Reference generation and model building run as persisted preparation jobs, typically after configuration or regeneration requests, and the ready result is reused when a saved game starts.

Record each asset's source, license or generation provenance, tools/versions, editable master location, export settings, checksum, clip list, and review result. Public manifests must not contain private storage URLs, personal metadata, or credentials.

## Tooling readiness and validation

Image generation is available in the current agent session. No Blender MCP tools are connected. The dev pod provides Node, pnpm, and Python; Blender, glTF Transform, and a KTX texture encoder were not installed when checked on 2026-09-10. **Setup is deferred until technical and nontechnical requirements are documented**, at Tom's direction. No images, models, software installations, or connections were created during this workflow review.

A concrete bridge candidate is [ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp/tree/5f8ddaf6e987c4aa0c3467fcc548838b28f64477). Its [MCP implementation](https://github.com/ahujasid/blender-mcp/blob/5f8ddaf6e987c4aa0c3467fcc548838b28f64477/src/blender_mcp/server.py) supports scene/object inspection, viewport screenshots, and Python execution. This supplies the build/inspect/adjust loop; Blender's Python operators provide the modeling and export operations. It is a third-party bridge, not a model-generation guarantee or a selected production dependency.

Record these requirements for later setup:

- **Blender host and display:** the candidate's [add-on](https://github.com/ahujasid/blender-mcp/blob/5f8ddaf6e987c4aa0c3467fcc548838b28f64477/addon.py) expects a running Blender session and explicitly rejects background `-b` mode. Choose a workstation or a tested graphical/virtual-display homelab host. This restriction is specific to this interactive bridge; Blender's separate background export capability remains useful for jobs.
- **Transport and files:** its MCP process uses stdio and communicates with the add-on over a TCP socket, defaulting to loopback port 9876. The [screenshot implementation](https://github.com/ahujasid/blender-mcp/blob/5f8ddaf6e987c4aa0c3467fcc548838b28f64477/src/blender_mcp/server.py#L461) writes on Blender's filesystem and reads from the MCP process's filesystem. Colocation or a tested shared-file/transfer arrangement is required. Changing a host setting alone does not establish remote authoring; the exact private connection from the dev pod remains to be designed.
- **Private workspace:** agree where source references, editable files, renders, and exports live. Configure the candidate's documented `DISABLE_TELEMETRY=true` before using private art, and verify it during setup. See its [setup and telemetry documentation](https://github.com/ahujasid/blender-mcp/blob/5f8ddaf6e987c4aa0c3467fcc548838b28f64477/README.md).
- **Pod registration:** record the bridge in haynes-ops's GitOps-managed `kubernetes/main/apps/dev/dev-env/app/resources/config/claude/mcp.json`, following that repo's session-restart workflow when the later setup task happens. Do not register a one-off server in this pod's generated config. Pin and test matching bridge/add-on versions.
- **First connection check:** inspect a synthetic scene, create a simple object, retrieve a viewport image, save/reopen the editable file, and export/load a GLB. Establish the complete loop before introducing personal references or complex character work.

Use pinned worker/builder images for whichever native tools the eventual runtime recipe needs; manage their deployment and compute through `haynes-ops`. Tool setup and the interactive authoring connection are not evidence that automatic game character generation works.

The foundation trial must reproduce an exported synthetic GLB, play its animations in the chosen engine, pass format validation, and exercise simulated background job failures/retries and atomic asset replacement. The real generation trial must additionally turn photos of varied configured people into usable characters without developer intervention per person, with measured quality, latency, compute/cost, and actual-device results. Passing the synthetic trial does not complete PRD-001 AC-10.
