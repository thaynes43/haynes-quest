# WO-007: Storybook traveler pair

- **Status:** In progress
- **Model:** native GPT-6 Astra, max; fresh context
- **Inputs:** `docs/assets/media/storybook-reference/v001/traveler-ages.png`, environment and props/material references, DESIGN-009
- **Exclusive scene lease:** This work order owns the live Blender scene from dispatch until its final saved handoff. No other Blender author is authorized concurrently.
- **Remote:** `http://blender-authoring.dev.svc.cluster.local:8000/mcp`; save under `/workspace/haynes-quest/travelers/v001`; download via `/artifacts/haynes-quest/travelers/v001/<file>`.
- **Deliverables:** infant and child .blend masters/GLBs, front/side/back/three-quarter stills, age comparison, visible clips idle/move/interact (both) and jump (child), reproducible scripts and measured geometry/size/clip/checksum manifest. No gameplay integration. Owner review pending.
- **Lead concept ruling:** Both figures are fictional faceless plum-hood travelers, leaf tunic, honey round clasp, brown satchel at wearer-right hip, muted boots. Infant 0.75 m with head-dominant low proportions; child 1.20 m upright. Keep silhouette and proportions; simplify embroidery and high-frequency detail for mobile. Hood opening must be actual recessed dark area, not painted eyes. Three.js export Y-up/meters, feet at origin. Child forward -Z. Root movement/collider remains independent of mesh scale.
- **Budget:** target <=12k triangles per avatar, <=8 materials, <=2 MiB GLB, embedded local resources. No mesh compression/CDN dependencies. Record actual results and any deviations.
