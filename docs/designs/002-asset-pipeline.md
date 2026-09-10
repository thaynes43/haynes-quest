# DESIGN-002: Character and world asset pipeline

- **Status:** Proposed
- **Last updated:** 2026-09-10
- **Satisfies:** [PRD-001 R-03, R-07–R-09, R-12, R-14–R-16](../prds/001-project-brief.md)
- **Governed by:** [Proposed ADR-002](../adrs/002-web-game-stack.md)

## Overview

Use generated character reference images to guide editable Blender models, then export optimized GLB files for the game. Keep the editable master so proportions, clothing, deformation, and animations can be corrected throughout development. Image generation establishes the appearance; it does not produce a finished animated game character by itself.

**Now:** use two distinguishable synthetic placeholders to prove the runtime contract. **Later:** build Jackson and Penelope's likenesses from the family-provided photos. Character modeling is explicitly deferred by Tom.

## Production workflow

| ID | Stage | Output and review |
| --- | --- | --- |
| D-01 | Synthetic prototype | Two named character entries using clearly fictional placeholder art. Stable IDs `jackson` and `penelope` survive every subsequent model revision. |
| D-02 | Photos to visual references, later | Use selected family photos to generate stylized full-body reference images. Develop consistent front, side, and back views, clothing, colors, and neutral poses. Tom reviews the appearance before modeling; unseen details are artistic choices to resolve, not facts recovered from one photo. |
| D-03 | References to editable geometry | Construct or adapt low-poly humanoids in Blender. Preserve distinct proportions and recognizable styling for each character. Retain editable `.blend` masters and reusable Python construction/export scripts where useful. |
| D-04 | Rigging and animation | Use compatible skeleton naming and a consistent clip contract. The prototype exercises idle and locomotion; later gameplay determines the final actions. Check deformation and foot contact for each character's proportions. |
| D-05 | Export | Produce GLB/glTF 2.0 with tested materials, a documented orientation, normalized scale, skeleton, and named clips. Bake/export supported animation channels and inspect them in the engine. |
| D-06 | Optimize and validate | Inspect geometry/materials/textures, apply measured reductions, run the Khronos validator, and compare the optimized model with the master in the game. Record tool versions, checksums, license/source, and validation results. |
| D-07 | Integrate | Replace the asset mapped to the same character ID. Check its camera framing, collider fit, animation, and touch-device performance without changing saved games. |

Blender supports [background execution and Python scripts](https://docs.blender.org/manual/en/4.0/advanced/command_line/arguments.html), enabling a repeatable asset build. Its [glTF exporter](https://docs.blender.org/manual/en/dev/addons/scene_gltf2.html) documents the supported materials and animation channels. These manual editions are capability references, not the version pin: choose a supported release and verify its export settings when building the toolchain. Keep unsupported procedural effects out of the runtime contract or bake them deliberately.

## Tools and asset sources

**Blender is the primary modeling, cleanup, rigging, and export tool.** A controlled low-poly model or a suitable base mesh is the default path. An image-to-3D service can accelerate a draft; it is not a prerequisite or a substitute for editable geometry and animation checks.

Meshy's [Image-to-3D API](https://docs.meshy.ai/en/api/image-to-3d) offers GLB output and remeshing. Its [rigging API](https://docs.meshy.ai/en/api/rigging) expects suitable textured humanoids with clear limbs and has additional input limits. If evaluated later, feed it the approved stylized reference, import the output into Blender, and apply the same quality checks. Account access, credits, terms, and service suitability would need checking for that evaluation; none have been assumed or used.

For technical placeholders and animation references, [Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) and the [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) provide CC0 options. Check the files and tier of the actual download: editable source editions or larger bundles can differ. Their stock proportions are not the final character design. Simple scene geometry can be made directly in code; select reusable world packs after the world's visual direction is known.

Use [glTF Transform](https://gltf-transform.dev/cli) for inspection and selected optimization, and the [Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator) for format validation. A valid file can still look wrong or run poorly, so retain the in-game visual and device checks.

## Runtime contract and trial budgets

Each character manifest maps its stable ID to a versioned GLB, required clip names, and loading metadata. Locomotion/controller state is separate from the visible mesh. Document export-to-engine orientation with a fixture; test animation retargeting rather than assuming identically named bones are sufficient.

Start the prototype with provisional ceilings of **15,000 triangles and two materials per character, with textures no larger than 1024 pixels in either dimension**. These are working budgets, not owner requirements or performance guarantees. Measure download size, draw calls, animation cost, and memory before finalizing them. Load the selected character's full asset when needed; selection previews do not need both full models running continuously.

Choose compression after the basic model works. Babylon's [glTF loader documentation](https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/importers/glTF.md) describes Draco, Meshopt, and KTX2 support and CDN defaults. Package any required decoder/transcoder files locally and verify their requests. Do not add every compression system by default.

## Storage and provenance

This repository is public. Keep family source photos, generated likeness reference sheets, and identifiable character masters/runtime exports in private asset storage, delivered to admitted players through the application. Public source control and build images contain code, synthetic fixtures, nonpersonal licensed assets, and metadata appropriate for publication. Git LFS does not make a public repository private.

Immich collectible photos are a separate runtime integration, not images baked into character models or bundled into a release. Reference-sheet generation and model building happen during asset production, not each time a child starts a game.

Record each asset's source, license or generation provenance, tools/versions, editable master location, export settings, checksum, clip list, and review result. Public manifests must not contain private storage URLs, personal metadata, or credentials.

## Tooling readiness and validation

The dev pod currently provides Node, pnpm, and Python. Blender, glTF Transform, and a KTX texture encoder were not installed when checked on 2026-09-10. Use a pinned asset-builder image/job for Blender and any required native tooling; record its build and deployment path in `haynes-ops` when implementing it. Do not mutate the running pod as the durable installation method.

The first asset trial must reproduce an exported synthetic GLB, play its animations in the chosen engine, pass format validation, survive the same optimization path as final assets, and run acceptably on the selected touch hardware. Likeness generation, final models, and third-party model-service evaluation are later work.
