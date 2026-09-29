# Rebuild Rooftop City v001

Use a new exclusive lease on Blender instance 2. Never rerun `claim.py` over an existing candidate directory; it intentionally refuses that condition. Inspect the live scene and preserve predecessor hashes first. The shared MCP transport uses the documented instance-2 Host header, while the TCP destination is the instance-2 service.

`common.py` supplies original primitives; `design.py` contains the four editable prop designs. `reference_sheet.py` creates the reference master and eight rendered views. `compose-reference.mjs` composes those views. `build_model.py` requires an approved `source.json` whose SHA-256 matches the sheet, then creates the editable production master and exact GLBs from the open reference scene. Existing export generations must be preserved before any revision.

The author used `run.py` to upload and execute each Blender script after the lease check. `validate.mjs` uses the authoring pod's pinned global Khronos validator; `reimport.py` round-trips exact GLB bytes. `inspect-three.mjs` runs locally with `tsx` and checks the real SceneAssets adapter and A3 placements. `preview.mjs` captures exact GLBs in Chromium. `compose.mjs` builds the comparison sheets. `a3-camera-audit.mjs` extends the ordinary-input route harness with camera-only inspections; run it against an isolated fixture with `QUEST_E2E_URL`. It removes its temporary harness on exit. `review_audit.mjs` inspects the four final catalog cards and model-viewer controls on desktop and phone. All browsers require the coordinator's serial lease.

`release_scene.py` verifies the exact technical report hashes, rehashes all predecessor masters/GLBs, saves a separate release master and relinquishes the lease. Never save over a predecessor file. The task's editable checkout is authoritative; the artifact mirror is a backup.

The static sources accompanying this page are identical to the repository's `scripts/assets/rooftop-city-kit/v001/` sources. No external art, private media or credentials are inputs.
