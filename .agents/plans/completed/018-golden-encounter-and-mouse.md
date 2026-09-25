# PLAN018: Golden stage encounter and desktop mouse combat

- **Status:** Completed
- **Depends on:** [PLAN014](014-complete-world-builder.md), [PLAN017](../017-rat-casino-fun-pass.md)
- **Requirements/designs:** [DESIGN-023](../../../docs/designs/023-golden-optional-encounter-and-mouse.md)

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

Completed September 25, 2026. [App PR73](https://github.com/thaynes43/haynes-quest/pull/73) merged at
`66c64d41e9f741285b49ccb6f1cd57d1ce5947fe` after its PostgreSQL application,
container and documentation checks passed. Local typecheck, lint, 851 tests with
12 PostgreSQL cases skipped, production build, level validation and strict
docs/media checks passed. Trusted Chromium input checks and both full lockstep
Rat Casino routes passed: one defeated all six encounters with Golden primary
and secondary hits, and the other left Golden untouched while completing the
five required fights. Both recovered three memories without browser, console or
HTTP errors. The earlier failed run remains recorded as the harness stopping
outside Golden's reachable arena.

The merged main commit published signed image digest
`sha256:e6599b23b702512716843a938e8f1016fca443ba6ba2bfd00b435a98e11b504d`.
[Ops PR3184](https://github.com/thaynes43/haynes-ops/pull/3184) pinned only the
isolated playtest. Flux applied `80d4c69dcb1c0faf569af5b90b3fb0ce058db749`;
the HelmRelease and exact-image pod were Ready with zero restarts, while Normal
Quest and dev-env kept their prior identities, generations and images.

Hosted headless Chromium passed the mouse/touch contract, bonus-editor
add/remove and placement rejection, the six-fight Golden route and the
five-fight skip route. Both journeys recovered three memories and completed
without page, console, response, request or external errors. The first hosted
skip attempt exited 143 after reaching the finish trigger but before writing its
report; its cause remains unknown, and a clean detached retry passed. The
[release record](../../evidence/rat-casino-golden-mouse-release.json) preserves
the exact CI, image, rollout, report hashes, failed attempts and limitations.

These lockstep browser journeys establish hosted route logic rather than
real-time device feel. PLAN017's separate real-time route gate remains open.
Physical Safari and exact final-art review remain owner gates.
