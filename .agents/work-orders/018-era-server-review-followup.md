# WO-018: Bounded server review fixes

- Assigned lane: explicitly authorized separate Fable 5.1 `claude-fable-5-1`, xhigh, through `agent-run`.
- Base: root branch `agent/quest-era-boss-loop`, pushed commit `f0756bc`; create your own task worktree with the launcher. Root has newer uncommitted UI/rendering work; do not touch it.
- Own only: `src/shared/adventure.ts`, `src/server/app.ts`, `src/server/domain.ts`, `src/server/adventure-schema.ts`, focused existing/new server tests, and `.agents/work-orders/018-era-server-review-results.md`.

The earlier Fable review of `faa8bab` completed two technical lanes but its top-level print session ended after the 600-second background wait ceiling while a browser lane was unfinished. Do not repeat that browser work or leave background agents pending at exit. Root is fixing the client findings and has separate successful actual keyboard/touch routes. This task is a small server patch and report, not a broad reimplementation.

Implement and meaningfully validate these bounded findings:

1. `app.onError` currently logs only non-AppError failures. Emit the existing privacy-safe diagnostic for AppError status >=500 as well, including `SAVE_DATA_INVALID`. Never log request bodies, save IDs, subject names, dates, credentials or raw exceptions. Keep 4xx behavior unchanged.
2. All `toSaveView` calls must use the same injected application clock as action authority, including create/read paths. A test should prove the GET cooldown agrees with the action route under a fake clock.
3. Persisted attack, guard and enemy-hit deadlines can lock a save for hours after a backward wall-clock step. Use one explicitly bounded remaining-time function: a deadline in the past is expired; a remaining interval larger than that action's full allowed duration is clock skew and is also treated as expired. Apply the same rule in reducer eligibility, active guarding and returned remaining durations. No client timestamp fields. Test a backward step and normal near-deadline rejection; forward passage naturally expires cooldowns.
4. Validate the reduced adventure before the store writes it, so a future impossible reducer result fails the transaction instead of persisting unreadable state. Keep existing frozen-plan semantics: do NOT recompute old plan combat numbers from today's defaults. The versioned plan is the authority for those values.

Do not change the save-list shape or silently hide a corrupt record. Root retains fail-closed list behavior for now and will record its repair limitation. The synthetic fixture-art route is deliberately a fixture preview; do not connect it to private media. The receipt window is bounded: an exact retry includes its original expectedRevision; changing that revision creates a different payload. No unbounded receipt storage or invented UUID timestamps.

Run focused tests, typecheck/lint and the relevant full local suite. Real PostgreSQL already passed in the server lane and PR CI; do not touch the live DB or create infrastructure for this task. Use no secrets, private media, OAuth, Blender or dev-env changes. Return a scoped commit and concise findings/evidence report; root integrates and merges PR #26. Do not open a competing implementation PR. If delegating, obey Claude's exact native Opus policy and complete all delegated work before returning.
