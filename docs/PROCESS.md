# Documentation process

Use the same progression as `haynesnetwork`:

```text
PRD → ADR → domain language → design → plan → implementation → validation
```

A change should use the existing documents where they already cover its requirements and decisions. Create a new ADR when a significant choice needs a durable rationale. A small correction does not need a new set of documents.

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

The bootstrap is documentation-only. Its plan completes when the named repository contains the reviewed scaffold; a running game and cluster deployment belong to later plans.
