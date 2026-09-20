# PLAN013: Floating platforms and vertical course building

- **Status:** Completed, September 20, 2026
- **Depends on:** Completed PLAN012
- **Requirements/designs:** PRD002 R-03/R-04/R-06; DESIGN011/016/019; ADR003

## Outcome and scope

Tom's floating-platform screenshot exposes a route bookkeeping restriction that prevents ordinary optional geometry from reaching Playtest. Permit optional v2 geometry without changing required progression checks, and deliver a shared human/agent building tool for varied elevated obby sections. Preserve immutable shipped documents, existing mechanics and the private fixture boundary.

## Contract

An authored-level-v2 platform need not occur in mainPath or branches. Every platform remains collision geometry. Keep v1 validation unchanged. Anchors still require authored routes; required progression anchors still require ordered main-path membership. Explicit connections retain all existing gap, rise, gateway and safe-miss checks. Optional geometry is not a promise of reachability. All object budgets, support and capsule checks remain.

Build climbing sections from broad static platforms within existing 0.35m rise / 1.4m gap limits; no jump-physics retuning. UI and CLI must use the same deterministic atomic command, with ordinary editable pieces and reversible edits. Record the detailed builder contract before its implementation. New geometry must be tested through the actual controller and visible authoring/playtest flow, not just schema validation.

## Steps

1. Audit route validation, runtime vertical support and authoring commands.
2. Implement the v2 optional-platform correction and regression coverage.
3. Define and implement reusable vertical section building, inspection and human UI.
4. Verify representative generated geometry, imports/undo, controller traversal and hosted authoring.
5. Complete green app PR/merge and private GitOps release; record exact evidence and update the guide/handoff.

## Completion evidence

Screenshot-equivalent added floating geometry can preview. Required objective safety and v1 behavior remain covered. Reusable sections demonstrably climb and change direction, with connected routes and working landing/recovery. Full required checks, independent review, immutable course validation, exact published image and hosted browser checks pass.

## Result

[App PR54](https://github.com/thaynes43/haynes-quest/pull/54) merged as `c7f034af16ff39f0007d76697569db382a83d562`. [Ops PR2992](https://github.com/thaynes43/haynes-ops/pull/2992) deployed it through Flux as `275b0f8d087a87cd3d11b12e019c21bce6470071`. The exact image and served assets match the verified candidate; normal Quest and dev-env remained unchanged.

757 CI tests pass, including PostgreSQL, alongside all required checks. Local browser coverage passes the new vertical flow, all 18 editor scenarios and three authoring groups. Hosted Chromium repeats optional-platform persistence/runtime resolution, section undo/redo, all eight generated jumps, deliberate crest recovery, and phone/tablet authoring controls with no page, console or HTTP errors. The separate 12-step example creates 23 platforms/checkpoints and reaches 3.6 units, with exact preview geometry. Controller tests cover both avatar stages and preserved original routes. Physical Safari acceptance remains a device playtest.

[WO092](../../work-orders/092-vertical-authoring.md) and the [release index](../../evidence/vertical-authoring-release.json) retain exact evidence. The local fixture and browser contexts are closed; the scoped activity is ended. No new assets, family media or gameplay physics changes were made.
