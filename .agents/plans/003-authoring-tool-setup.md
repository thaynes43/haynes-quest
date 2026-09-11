# PLAN-003: Set up authoring dependencies before development

- **Status:** In progress
- **Owner direction:** Tom, 2026-09-10: prepare missing dependencies such as Blender first; use development agents with empty context windows
- **Related:** [DESIGN-002](../../docs/designs/002-asset-pipeline.md), [DESIGN-007](../../docs/designs/007-poc-development-loop.md), [DESIGN-008](../../docs/designs/008-audio-pipeline.md), [PLAN-002](002-foundation-prototype.md)

## Scope and sequence

1. Build a pinned Blender LTS toolchain into the dev-env image, with the matching pinned MCP add-on/server, Xvfb/software graphics, FFmpeg/ffprobe, glTF Transform, and the Khronos validator. Run Blender lazily with shared local artifact paths and a loopback-only connection. No new public service or GPU allocation is needed for this trial.
2. Test the built container as the runtime UID with a read-only root filesystem, writable home/tmp, no network, and the pod's 64Mi shared-memory budget. Verify MCP initialization/tool listing, scene commands, viewport screenshot, save/reopen, GLB export/import/validation, process restart, and a synthetic audio encoding probe. These fixtures are not final game assets or evidence of browser gameplay.
3. Keep image publication separate from runtime activation. The dev-env image/MCP activation restarts the current pod; prepare it as a held draft under the pod's explicit instructions, with exact image digest, checks, and post-roll verification instructions. Tom merges it at a natural break.
4. After activation, verify the tools through a fresh session, write/reopen a synthetic scene on persistent storage, and confirm both agents receive the GitOps MCP registration. Record live results before claiming Blender is ready for development.
5. For audio generation, select the local Stable Audio Small-SFX trial or hosted ElevenLabs alternative. The local model needs owner-granted Hugging Face access and accepted terms, protected token/egress, an isolated CPU environment, and a short measured quality/speed trial. No account, subscription, terms acceptance, or model download is assumed. FFmpeg is useful for either route.
6. Dispatch new Astra development agents with `fork_turns: "none"`, a self-contained work order, task worktree, required docs, stable contracts, and explicit acceptance evidence. Use the ready dependency inventory to begin PLAN-002; final asset promotion still needs Tom's review.

## Current evidence

- Planning/docs PR #14 is merged at `e19c6224c35c1f94c58b5ad035d2f1999ad3c5bd`.
- Before this setup, the live pod has Xvfb/Mesa, Node, pnpm, Python, and uv; Blender, FFmpeg/ffprobe, xauth, and glTF tooling are missing from PATH. No GPU is assigned to the pod. Main-container memory limit is 64Gi; rootfs is read-only, home PVC/tmp writable.
- [Image PR #2831](https://github.com/thaynes43/haynes-ops/pull/2831) merged at `ec05e47e13ef61f75a4fe7cd79611ac66364ea82`; [offline container smoke passed](https://github.com/thaynes43/haynes-ops/actions/runs/34544394268). It proved MCP, screenshot, save/reopen, GLB validation, restart, and audio encoding. [Main build/publication/signing passed](https://github.com/thaynes43/haynes-ops/actions/runs/34544898212), and the registry manifest hash was independently verified. Image `0.6.0@sha256:22029f8ffb0652c1caca744db9e97c3e4d874a6bd5253a6555254b2b2d541ea1` is ready for activation; no live readiness is claimed yet.
- [Activation PR #2833](https://github.com/thaynes43/haynes-ops/pull/2833) pins that image and registers Blender for both agents. It remains a held draft for Tom's natural-break merge because it restarts dev-env. Local manifest/render checks passed; see the PR for final Flux checks. Post-roll MCP/PVC checks are outstanding.
- [Log-access fix #2832](https://github.com/thaynes43/haynes-ops/pull/2832) merged and reconciled; the exact GitHub Actions log hostname now works from the pod.
- Audio selection/access is pending; the researched free/self-hosted choices and their conditions are in DESIGN-008. No generated audio is approved.

## Completion

Complete when authoring tools are live and their checks pass, the audio trial has either verified its selected route or has a clearly recorded owner-deferred scope, and the fresh-context development handoff is self-contained. A green image build alone does not prove the live MCP connection, and a held activation draft is not a deployed dependency.
