# PLAN018: Golden stage encounter and desktop mouse combat

- **Status:** In progress
- **Depends on:** [PLAN014](completed/014-complete-world-builder.md), [PLAN017](017-rat-casino-fun-pass.md)
- **Requirements/designs:** [DESIGN-023](../../docs/designs/023-golden-optional-encounter-and-mouse.md)

## Outcome and scope

Rat Casino offers a real optional Golden encounter while retaining its five existing fights and main completion route. A desktop player uses short left/right mouse clicks for Attack/Secondary; touch scenery taps stay noncombat. Existing projects, frozen saves and normal Quest stay compatible.

## Steps

1. Record the user feedback and the optional encounter/control contract.
2. Implement the versioned optional encounter, new Rat Casino fixture, editor/CLI support and runtime presentation. Update Golden's asset review and catalog use.
3. Implement and verify separate mouse and touch behavior.
4. Run typecheck, lint, tests with PostgreSQL, build, level validation and strict docs/media checks. Play both the Golden fight and the skip route in a browser, and check mouse and touch with trusted input.
5. Merge the application PR after CI, pin only the private playtest image through a haynes-ops PR, and verify its rollout and hosted browser behavior. Record results and update the handoff.

## Completion evidence

Record PRs, source/image digests, CI, exact hosted browser checks, pod readiness/restarts and Normal Quest/dev-env isolation. Keep failed checks and limitations in the release record. Physical Safari and final art review are separate owner gates.

## Result

In progress.
