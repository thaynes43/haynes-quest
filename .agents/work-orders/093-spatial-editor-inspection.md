# WO093: Spatial inspection for building agents

- **Status:** Completed
- **Dispatch:** Authorized Opus 5 xhigh separate session
- **Owned paths:** `scripts/levels/editor.ts` and existing CLI test file only. No shared editor-command source, UI, guide, other docs, deploy or browser.

Extend the existing `levels:editor inspect` output, preserving current fields, with bounded per-chapter spatial data useful for cheap building agents: bounds including platform top min/max and horizontal bounds; each platform's ID/type/center/size/topY/mainPath index/branch indices, checkpoint IDs; explicit connections and mainPath/branches; anchor slots and support/position; the current authored gap/rise/support/actor-height/budget limits. Avoid duplicated huge serialized levels or generated scripts. Optional geometry should be identifiable by route membership. All data derives from the same parsed project, no separate physics rules.

Use meaningful CLI subprocess tests against shifted/elevated edited geometry and bounded invalid input. Root owns user-facing guide/copy; output keys are machine interface implementation. Read AGENTS.md, docs/PROCESS.md and PLAN013. Commit only your owned paths in your own worktree and report commit/tests in `/home/dev/work/quest-vertical-authoring/.private/spatial-inspection-result.md`; no PR/merge, coordinator integrates. Return results, not file dumps.


## Final intake

Delivered in app PR54 and verified under [WO092](092-vertical-authoring.md). The release index and archived reports there supersede the temporary worktree/report paths in this dispatch. All owned implementation is integrated; no work remains in the original agent worktree.
