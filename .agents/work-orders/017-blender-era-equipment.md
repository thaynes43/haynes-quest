# WO-017: Useful equipment candidates

- Status: Queued for an exclusive scene lease after the active enemy authoring.
- Required author: fresh native `gpt-6-astra`, `max`, `fork_turns: "none"`.
- Own: `scripts/assets/era-equipment/`, new model/render/intake files under `docs/assets/media/era-equipment/v001/` except lead concept/prompt/provenance, and an evidence sibling to this work order. Root owns UI, art direction and review prose.
- Remote directory: `/workspace/haynes-quest/era-equipment/v001`.

Inspect both actual selected equipment sheets in [the concept review](../../docs/assets/reviews/era-combat/v001.md). Build four distinct original props matching their silhouettes, carved relief, rounded edges and walnut/brass/sage/plum materials:

| Export ID | Dimensions | Required construction |
| --- | --- | --- |
| `spark-mallet` | 0.55 m overall length | Barrel-shaped wooden head with amber ends, centered handle, brass rims and plum grip. |
| `acorn-shield` | 0.40 m height | Convex wooden shield, raised sage leaf, brass rim, actual rear forearm strap and hand grip. |
| `prism-wand` | 0.65 m overall length | Blunt amber/plum crystal in a four-prong wooden/brass cradle, sage grip, two small plum ribbon tails. |
| `ribbon-shield` | 0.48 m height | Convex oval shield, sage/plum crossed inlay, central brass medallion, separate rear forearm strap and hand grip. |

Meter scale, +Y up, forward -Z; center each prop at a documented grip/attachment origin rather than arbitrary mesh bounds. Record a ground-display transform and left/right hand attachment guidance. Shields face -Z with rear straps on +Z. All attachments are physical geometry; do not repeat the keepsake reference's omitted rear-support mistake. These rigid props do not need skeleton clips; player motion supplies animation. They do need front/side/back/beauty previews and actual exported-browser intake.

Target under 5k triangles, five materials and 1 MiB per GLB, with measured justification for exceptions. No external textures/decoders. Retain editable masters, construction/export scripts, exact GLBs, Khronos results, re-imported dimensions and material/triangle counts, hashes and browser proof. Confirm the source and exported props agree, including all rear grips. Preserve lead concept files and original remote masters.

One exclusive live scene; claim it before mutation and release it at completion. Never factory-reset or unload the addon. No image generation, private media, OAuth or dev-env changes. Candidate production is authorized; exact-version owner approval remains separate from coordinator selection and gameplay promotion.


## Final continuation status

WO-017 completed: source commits d7ef884/fe09318, integrated 880d955/e1c2c13. Live scene released 15:08:52 UTC; no running jobs. All four equipment candidates selected by lead; exact owner approval pending.
