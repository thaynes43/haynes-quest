# PLAN016: Rat Casino playground and scenery revision

- **Status:** Completed
- **Date:** 2026-09-24
- **Source:** Tom's review that the first hosted Rat Casino image looks barren and flat
- **Decision:** [DESIGN021 playground revision](../../../docs/designs/021-rat-casino-level.md#playground-revision-september-24)

## Scope

1. Revise only the Rat Casino fictional project's required path with forgiving terraced height changes, preserving its encounters, memories, alternate paths, editor identity and published older courses.
2. Frame the course with plentiful lightweight casino scenery and an elevated final stage using the prepared kit and code-native non-colliding decor. Keep the Rat central and Golden scenic.
3. Validate shared authoring, gameplay, docs and media; inspect local browser images at entrance, middle, boss and phone sizes; complete the level with ordinary controls and a fall recovery.
4. Update the playtest guide, release evidence and handoff. Merge checked PRs, deploy the exact game image to the isolated playtest through GitOps and repeat the hosted visual and journey checks. Record physical-device limits honestly.

This revision changes the world layout and staging, not the exact Blender model files or their final-art approval state. The prior two published courses and family-photo boundary remain unchanged.

## Completion evidence

- [App PR64](https://github.com/thaynes43/haynes-quest/pull/64) merged at `cf2ae28ba816328d3978f1628d62a9e41f8dc2db`; source, real PostgreSQL, container, authored-level and strict documentation checks passed. The local exact-source browser journey and all 789 non-database unit tests passed.
- [Ops PR3152](https://github.com/thaynes43/haynes-ops/pull/3152) merged at `dd0c59aa9e1dc7f2a74b5f02ba9fe9c3eee0c193`; both rendered diffs changed only the isolated playtest image. Flux applied that revision, the HelmRelease is Ready at generation 19 and the new pod runs the exact signed image digest with zero restarts. Normal Quest and dev-env identities and images were unchanged.
- The hosted ordinary-control Chromium journey completed all four supporting fights, Rat, three fictional memories, the editor sample and 390×844 layout; a deliberate fall preserved progress. All browser/network error arrays were empty. All nine existing Rat Casino GLBs and six new playtest captures matched the checked source hashes. [The release record](../../evidence/rat-casino-playground-release.json) retains exact checksums, run IDs, pod state and limits.
- Physical iPhone/iPad Safari feel and exact final-art owner acceptance remain open before broader gameplay promotion. No family photos were used.
