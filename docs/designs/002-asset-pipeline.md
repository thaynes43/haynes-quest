# DESIGN-002: Character and world asset pipeline

- **Status:** Proposed
- **Last updated:** 2026-09-10
- **Satisfies:** [PRD-001 R-03, R-07–R-09, R-12, R-14–R-18](../prds/001-project-brief.md)
- **Governed by:** [Proposed ADR-002](../adrs/002-web-game-stack.md)

## Overview

The application generates playable characters from photos of people configured in a self-hosted photo connection. Preparation runs in the background: retrieve suitable photos, generate stylized references, generate and rig the model, validate it, and publish a reusable GLB asset. [DESIGN-003](003-photo-connections-and-people.md) owns the connection, person, character, and job lifecycle.

**Now:** use synthetic libraries, arbitrary roster entries, and a simulated generator to prove the runtime/job contract. **Later:** validate and implement real automated character generation. Each user-added person must be supported by the application workflow; a developer hand-modeling every character is not the product design. Image generation alone does not establish working geometry, rigging, or animation.

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

**Blender remains the proposed prototyping and asset-processing tool; the automatic generation backend is not yet selected.** Compare a controlled customizable base-character pipeline with a photo/reference-to-3D generator, including how each supplies a usable rig and consistent animation. Choose only after demonstrating acceptable character quality and repeatable automation. Retain editable base assets and reproducible scripts where the recipe uses them.

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

The dev pod currently provides Node, pnpm, and Python. Blender, glTF Transform, and a KTX texture encoder were not installed when checked on 2026-09-10. Use pinned worker/builder images for whichever native tools the selected recipe needs; manage their deployment and compute through `haynes-ops`. Do not mutate the running pod as the durable installation method.

The foundation trial must reproduce an exported synthetic GLB, play its animations in the chosen engine, pass format validation, and exercise simulated background job failures/retries and atomic asset replacement. The real generation trial must additionally turn photos of varied configured people into usable characters without developer intervention per person, with measured quality, latency, compute/cost, and actual-device results. Passing the synthetic trial does not complete PRD-001 AC-10.
