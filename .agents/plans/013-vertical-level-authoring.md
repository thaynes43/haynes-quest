# PLAN013: Floating platforms and vertical course building

- **Status:** In progress
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

In progress.
