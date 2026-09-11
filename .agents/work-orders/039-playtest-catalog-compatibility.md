# WO-039: Preserve archived catalog saves for the bounded playtest

- **Status:** Complete
- **Model / dispatch:** Native GPT-5.6 Sol, `xhigh`
- **Context:** Fresh development agent; native `fork_turns: "none"`
- **Required reading:** `AGENTS.md`, `.agents/TEAM.md`, `.agents/HANDOFF.md`, WO-037 and DESIGN-005
- **Worktree / branch / base commit:** `/home/dev/work/quest-playtest-catalog`, `agent/quest-playtest-catalog`, `35c6c62`
- **Depends on / stable contracts:** `era-level-plan-v2`, `era-combat-state-v2`, immutable `parody-catalog-v1`, current `parody-catalog-v2`
- **Owned paths:** Catalog planner/parser compatibility and focused server/runtime regressions named in the dispatch. No Blender, deployment, private media, UI copy or root-owned catalog edits.

## Outcome and scope

New synthetic journeys select the complete v2 playtest roster. Stored v2 plans remain validated against the exact catalog version they froze, including the original v1 identities and their date, role and ability gates. Unknown catalog versions and identities remain invalid. No save-format, state-shape or database migration is introduced.

## Deliverables and verification

Update the shared planner types and selection boundary, make server parsing address the immutable catalog registry, and cover the current v2 aliases plus a real archived `parody-catalog-v1` plan. Update existing focused fixtures to name encounter aliases separately from reused asset IDs. Run the focused Vitest files and `pnpm typecheck`.

## Handoff and recovery

The planner now pins the active v2 registry for new plans, while the parser accepts only the two declared catalog versions and validates every frozen encounter against the exact archived registry. Tests cover current encore entry/asset pairs, an archived v1 save with its original second-era identities, date and identity corruption, and unknown catalog rejection. The runtime fixture now keeps encounter IDs separate from reused asset IDs.

Verification completed in `/home/dev/work/quest-playtest-catalog`:

- `pnpm test`: 28 files passed, 1 skipped; 208 tests passed, 9 PostgreSQL tests skipped.
- `pnpm lint`: passed with zero warnings.
- `pnpm typecheck`: passed.

Root still owns broader builds and browser playtests. During focused verification, two root-owned `remix-runway-v2` consumers were reported to the coordinator: client story period recognition and the scene's later-era environment choice.
