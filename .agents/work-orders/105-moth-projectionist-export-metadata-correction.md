# WO105 · Moth Projectionist v001 exact export metadata correction

- **Status:** Ready only after WO104 explicitly releases the single Blender scene
- **Owner:** One fresh native GPT-6 Astra subagent at max, `fork_turns: "none"`
- **Asset/version:** `moth-projectionist/v001`, corrected exact export; no visual or animation redesign
- **Scene lease:** Exclusive shared Blender scene from the first mutation through saved release; work only under `/workspace/haynes-quest/rat-casino-cast/moth-projectionist/v001/`

## Defect and narrow scope

The first validated GLB has scene extras `work_order: "WO103"` beside an inherited `candidate_status` beginning `WO102 v001`. The WO103 release script corrected the later saved `.blend` but did not re-export the GLB. The draft PR review caught this before merge. Correct the source script to set the WO103 candidate status before export, then create an exact Blender export with correct metadata. Preserve the reviewed mesh, atlas, rig, five clips, scale and appearance; do not modify another character or any game level.

Start only after the WO104 golden-rat author returns an explicit scene-release marker. Independently verify Blender health, idle authoring/render jobs, current scene identity and the existing WO104 master backup. Claim the scene exclusively. Inspect the v001 Moth master and source at `docs/assets/media/moth-projectionist/v001/` and `scripts/assets/moth-projectionist/v001/`, the [review](../../docs/assets/reviews/moth-projectionist/v001.md), [WO103](103-moth-projectionist-classic.md) and the Blender runbook in haynes-ops. Keep the original GLB and reports as immutable correction input outside the versioned final media directory if necessary; the coordinator will update review hashes.

## Deliverable and release

Load the saved WO103 `.blend` in the exclusive service scene, set correct `candidate_status` before export, and export `moth-projectionist.glb` with the original export settings. Confirm scene extras say WO103 and Moth, not WO102. The mesh and animation should remain semantically identical; report any byte/bound difference that is more than metadata. Save the matching corrected `.blend` master and a backup without overwriting another candidate. Run Khronos validation (zero errors/warnings), exact Three.js + `EnemyAnimation` all-clip checks, browser playback at normal and 35% scale, and remote/local SHA-256 transfer checks. Regenerate every report and manifest whose hash or claims refer to the old GLB. Return exact hashes, paths, byte/bound comparison, clip timings, validation/adapter/browser results, and an explicit saved scene-release marker.

The lead owns review/catalog/inventory/thumbnail/test corrections in the same PR. No owner art approval or gameplay mapping follows from this metadata fix.
