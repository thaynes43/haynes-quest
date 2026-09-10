# Future backlog

These items do not gate the family proof of concept. Revisit them only when their stated condition becomes relevant.

## BL-01: Automatic playable-character generation

- **Status:** Deferred by Tom on 2026-09-10
- **Revisit if:** Tom chooses a broader release and separately decides to reintroduce person-specific playable avatars
- **Requirement:** [PRD-001 R-15](prds/001-project-brief.md)
- **Future acceptance criterion:** PRD-001 AC-10

Let the application retrieve a configured person's photos and produce a usable playable-character model without developer authoring for each person. This would reuse the photo/person integration but also change the current generic-avatar premise; a broader release alone does not require it.

The family PoC uses a shared generic mysterious avatar authored with image-generated concepts and Blender MCP. Configured people supply chronological photo journeys. Adding an eligible person needs no new model. No generation worker, queue, job-state simulator, provider comparison, or real-generation trial is required for the PoC.

If revisited, evaluate the complete references → geometry → rig/animation → validated GLB workflow. Establish quality, latency, compute/cost, private-data handling, and a suitable generation service before choosing infrastructure. Interactive authoring tools alone do not establish this runtime capability.

Retain these design considerations for that future work: private source/output storage; persisted progress and recoverable failures; deduplicated requests; bounded concurrency and restart-safe retries; access checks after connection/key changes; versioned output published only after validation; and failed regeneration preserving an existing usable asset and save. These are notes for future design, not PoC implementation work.
