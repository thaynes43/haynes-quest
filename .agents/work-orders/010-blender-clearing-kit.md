# WO-010: First-pass clearing prop kit

- **Status:** Dispatch authorized after WO-007 released the scene at 2026-09-11 04:37:50 UTC. This work order owns the next exclusive scene lease.
- **Author:** fresh native GPT-6 Astra, max; all Blender modeling/scripts/materials/export/render/optimization stay in that lane.
- **Scope:** one coherent bounded static prop kit covering the five remaining catalog IDs. No extra biome, character, texture generation, gameplay integration or user-facing page writing.
- **Inputs:** exact selected `storybook-reference/v001/{environment,props-materials}.png` plus each asset's `v001/concept.png` and retained prompt in `docs/assets/media/`. Inspect actual images before authoring. Original fictional content only.
- **Scene lease:** WO-010 is the sole writer from dispatch until its explicit saved release. WO-007 masters, exports and media were saved and SHA-verified before handoff. Dedicated endpoint `http://blender-authoring.dev.svc.cluster.local:8000/mcp`. Save all masters/scripts/checks under `/workspace/haynes-quest/clearing-kit/v001`; transfer via `/artifacts/haynes-quest/clearing-kit/v001/<file>`. Never factory-reset Blender: that unloads the MCP addon. Clear only authored scene objects/data as needed. No dev-env restart.

## Lead construction decisions

Shared palette: parchment `#f5ebdc`, plum `#342c46`, leaf `#557363`, honey `#dca953`, matte warm walnut and pale sandstone. Rounded handcrafted silhouettes, sparse broad material variation, readable at mobile gameplay distance. These are simplified mobile candidates; preserve silhouette/material hierarchy, omit tiny grain/leaf/embroidery detail rather than inventing extra ornament. Soft warm key and cool shadow for all review renders. Y-up meters GLB, footprint center at origin, feet/ground at Y=0; fronts face -Z. No external textures or required compression extensions. Closed hidden surfaces. No family references.

| Catalog ID | Required files / construction | Hard first-pass budget |
| --- | --- | --- |
| `memory-keepsake` | One `memory-keepsake.glb`; 0.65m high × 0.42m wide × 0.10m deep. Matte walnut pointed-rounded arch, honey token, stable wedge foot, discreet braces. A separate flat named `PhotoSurface` mesh/material with UVs for replacement; fictional amber tree insert, never a person. Keep useful image area unobstructed. | <=3000 triangles, <=6 materials, <=1 MiB |
| `clearing-path-kit` | Three individually exported `ground-tile.glb`, `path-tile.glb`, `low-step.glb`. Ground 2×2m and 0.12m high, soil side/grass top; Path 2×2m and 0.08m high, few broad pale sandstone pavers; Step 2m wide × 0.6m deep × 0.22m high, solid sandstone. Exact butt-able rectangular outer footprint and no seam holes. Show joined 2×2 tiles plus each piece clearly. | <=2000 triangles and <=4 materials per piece, <=500 KiB each |
| `clearing-tree` | One `clearing-tree.glb`; 3m high, about 2.5m canopy width. Curved warm trunk and four broad cushion-like leaf masses; broad sparse color variation. No individual leaf mesh clutter. Rotation/scale examples from this same file count as economical variations, no duplicate exports. | <=5000 triangles, <=5 materials, <=1 MiB |
| `clearing-stone` | One `clearing-stone.glb`; 1.05m wide × 0.75m deep × 0.8m high. Rounded muted lavender stone, asymmetric broad facets and stable bottom. Show rotation/scale reuse. | <=1500 triangles, <=3 materials, <=500 KiB |
| `arrival-landmark` | One `arrival-landmark.glb`; 2.8m high × 2.4m outer width × 0.55m deep, clear passable opening >=1.6m. Two inward-curving walnut crescent uprights in sandstone feet; thin bronze crossbar, amber lantern approximately 0.24×0.38m. No door or blocking platform. Restrained emissive material only, no bloom dependency. | <=6000 triangles, <=6 materials, <=1 MiB |

## Deliverables and evidence

Retain each editable `.blend` master on the authoring PVC with exact SHA256, bytes and artifact ID. Commit source scripts, artifact manifest, source-concept SHA256s, exported GLBs and useful review media to the task worktree. Use `docs/assets/media/<catalog-id>/v001/` and `scripts/assets/blender/clearing-kit-v001/`. Do not overwrite concept files; bring the root's latest committed concepts into the new task worktree first.

Every separate model needs matching front/side/back/beauty or useful orthographic views, a scale reference, actual exported GLB re-import check/render, triangles/materials/dimensions/bounds/bytes/hash, and a Khronos validator result. Show an H.264 turntable or a compact visual equivalent for each standalone asset and each distinct path-kit piece; no audio/autoplay. Provide a kit scene beauty view for coherence and 2×2 joins. Include a still fallback alongside every GLB. Inspect actual exports, not only source scenes. Preserve intermediate issues and corrections in a concise machine-readable/source handoff. No claims of browser or Tom review that have not occurred.

The lead writes review pages and final copy, inspects candidates against concepts, checks the actual viewer and decides whether a fresh bounded correction task is needed. Return commit, exact artifact inventory, checks and limitations, then explicitly release the live scene. Tom exact-version approval remains pending for every file.
