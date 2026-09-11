# Documentation process

Use the same progression as `haynesnetwork`:

```text
PRD → ADR → domain language → design → plan → implementation → validation
```

A change should use the existing documents where they already cover its requirements and decisions. Create a new ADR when a significant choice needs a durable rationale. A small correction does not need a new set of documents.

Apply this progression to the next bounded slice. Tom's current priority is the playable PoC in [DESIGN-007](designs/007-poc-development-loop.md); unfinished full-game story, combat, or content design does not block it. PLAN-003 tool setup is complete. Specify each new slice's contracts before dispatch and use placeholders while exact candidate versions await owner review.

## Document conventions

- Copy the relevant `000-template.md`. Use three-digit document numbers and stable IDs: `R-NN`, `US-NN`, `AC-NN`, `Q-NN`, `C-NN`, `T-NN`, and `D-NN`.
- Use `Draft → Proposed → Accepted → Superseded / Deprecated` for product, architecture, and design documents. Attribute owner rulings accurately; do not mark an unresolved proposal Accepted.
- Accepted ADR decisions are immutable. A later ADR supersedes or amends one, with a status link added to the earlier document.
- Update living PRDs, designs, the glossary, and runbooks in the same PR as the behavior they describe. Keep IDs stable when text changes.
- Ask one concrete owner question when a decision is needed. Record the question and answer in the relevant document. Decisions the owner explicitly defers stay deferred until their stage; do not interrupt the bootstrap with the full game questionnaire.
- Keep an app's current release and task status in one place. The README points to `.agents/HANDOFF.md` instead of copying a running history.

## Plans and delivery

Executable plans live in `.agents/plans/`. Each states its scope, dependencies, steps, and observable completion evidence. Use `Draft`, `Ready`, `In progress`, `Completed`, or `Blocked` for plan status.

For an implementation task, follow the authorized scope through docs, code, relevant tests, PR, required checks, squash merge, release/deploy when included, and live verification. Record evidence before marking the plan Completed, then move it to `completed/` without changing its number.

The bootstrap and private overnight MVP are complete. [PLAN-002](../.agents/plans/002-foundation-prototype.md) retains the broader player-ready foundation gates; the handoff links current implementation and deployment evidence.

Astra coordinates under the project [team policy](../.agents/TEAM.md): native Sol at `xhigh` for default bounded work, native Astra for all Blender work, and explicitly authorized Fable 5.1 at `xhigh` through `agent-run` for coding/adversarial review. Driving Astra owns sequential image generation and the visual direction. Start development agents with empty conversation context (`fork_turns: "none"`) and the named repository readings/inputs. Use the [work-order template](../.agents/work-orders/000-template.md) for self-contained bounded parallel tasks and the [asset-review template](assets/000-review-template.md) for final visual/audio candidates. Tom's explicit instruction requires his review before final assets enter gameplay. Technical checks and agent review precede that concrete review package; record his decision against the exact version. This requirement governs asset promotion, not ordinary documentation/code PR merges. Pending assets leave placeholders or the prior approved version usable. Coordinator-selected concepts can proceed through modeling and iteration without waiting for Tom. Publish every scoped candidate in the MkDocs Material asset studio, with source images, model/audio previews, exact version and separate agent/owner decisions. Run the documented strict site build and link/media checks for documentation changes; keep plans canonical in `.agents/` and all private media outside static site inputs.
