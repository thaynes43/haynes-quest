# WO-015: Recovered review findings and lead disposition

The separate Fable 5.1 xhigh review ran in task `haynes-quest-0911-092216` against exact commit `faa8bab`. Output metadata verified `claude-fable-5-1`; its three native lanes used `claude-opus-5`. The server and client technical lanes finished and removed their scratch tests. The top-level print session then ended at its 600-second background wait ceiling while the browser lane remained unfinished. **This is recovered partial technical review evidence, not a completed Fable browser acceptance.**

Root read the completed native reports from session `878b0cfc-1bc3-43d6-be8f-1b587170750e`, client lane `agent-ad2e36463fd50e2a8` and server lane `agent-aff4d78ae205541f3`. The independent reports found no request path that supplies its own age, HP, damage, equipment values, boss outcome or memory release. The tracked suite passed 65 tests with eight database tests skipped in that review environment; PostgreSQL was separately covered by the server lane and PR CI.

## Findings requiring fixes

| Finding | Lead disposition |
| --- | --- |
| Missing secure-context `crypto.randomUUID` throws on a LAN HTTP browser and stops the animation loop. | `79032a7`: secure `getRandomValues` UUIDv4 fallback; absent secure randomness becomes a visible request error instead of a thrown frame. |
| A revived enemy after another tab retries remains locally defeated and invisible. | `79032a7`: authoritative revival resets the local enemy to a live spawn/idle state; a stale-refresh regression exercises this path. |
| A real enemy contact is silently lost while another action occupies the request slot. | `79032a7`: retain at most one actual contact until the slot is free, revalidate it and clear it on lifecycle changes. No frame-event backlog. |
| Closing a dialog can resume a nearly completed wind-up or strike directly into damage. | `79032a7`: explicit pause/visibility resume restarts a full telegraph. |
| Cached image completion can be missed and a later effect hides the loaded picture indefinitely. | Root reproduced this in the real completion album and replaced passive load-state reset with a URL-keyed component plus synchronous completion check. Three regression cases cover cached success, changed URLs and cached failure/manual retry. |
| Failed model jobs retain obsolete scene objects; cloned materials share cached textures. | `34e009b`: validity-aware retry pruning, independent texture objects, exact instance disposal and visible construction-failure handling. |
| Errors/retries are hidden behind dialogs. | Independently found by the journey lane; `f0756bc` renders feedback inside the active dialog. |
| HTTP contract still describes retired recover/finish mutations and old save shapes. | Root updated DESIGN-009 with the action envelope, verbs, save/lock semantics, errors and bounded receipt guarantee. |
| Clock injection is missing from create/read views; persisted cooldowns can remain far in the future after clock skew. | `abee156`, bounded Fable WO-018 follow-up: one required clock argument and bounded remaining-time rules, with near-deadline and skew regressions. |
| Stored-data AppError failures produce no safe diagnostics; reduced states are not validated before writing. | `abee156`: safe 5xx diagnostics and pre-write invariant checks, retaining frozen-plan authority. |

Root also corrected stale-refresh wording, repeated-error notification, missing error mappings and a chapter message that announced jumping regardless of actual newly unlocked abilities. These are lead-owned UI decisions.

## Reviewed limits retained deliberately

- The save list fails closed if a stored record is corrupt. A partial-list repair interface is not implemented; no current API mutation was shown to create that corrupt record. WO-018 adds a safe diagnostic rather than silently hiding the record.
- Fixture preview art is intentionally accessible through its synthetic preview route; this is not a private-photo path. Fixture startup refuses private library credentials, and save-scoped release/ownership checks remain in force.
- The latest 128 action receipts provide bounded recognition. Exact retries include the original expected revision and cannot reapply after pruning. A changed revision is a different payload; the ledger does not promise lifetime UUID history.
- Frozen plan combat values are stored authority, not reconstructed from later code defaults. Arbitrary database writes are outside player API authority. State invariants remain validated; no current request can set its own plan stats or health ceiling.
- The action limiter remains 360/min/player. The runtime reports at most one hit per global 900 ms, so a report calculation assuming independent simultaneous hit streams overstates the implemented client’s sustained budget. No rate-limit failure was reproduced in the real journeys.
- General future exceptions inside an animation callback are not covered by an infinite retry loop. The demonstrated UUID exception is prevented, and model construction failures are explicitly reported.

The separate browser lane did not finish. Root’s actual control journeys and media tests provide their own evidence with exact source/build boundaries in [the verification record](../../docs/ops/005-era-combat-verification.md). Further fixes require their own checks; this report is not a rubber stamp for later commits.
