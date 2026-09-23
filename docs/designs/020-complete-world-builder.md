# DESIGN020: Build and preview complete worlds

- **Status:** Proposed implementation design, September 23, 2026
- **Requirements:** [PRD003](../prds/003-complete-world-authoring.md)
- **Decision:** [ADR004](../adrs/004-versioned-world-projects.md)

## Editor flow

The existing 3D workspace remains the place to shape a level. Beside the level picker, add **Add level**. It opens two starts, **From garden course** and **From obby course**. A new level gets a unique local ID and a copy of the chosen geometry and required gameplay anchors; it never receives a published route ID. Select it immediately so the author can reshape it. **Duplicate level** makes another independent copy. **Move earlier**, **Move later** and **Remove level** live in its World panel. Removing a level confirms the loss of that level's draft data and remains undoable.

Add **World** beside **Properties** and **Route** in the right rail. It shows the selected level's name, theme, represented date range, three fictional preview memory dates (minor one, minor two, major), and the five encounter slots. The date controls are labeled **Fictional preview dates**; the panel explains that real family media is unavailable in this editor. The author can keep an unfinished date or cast choice and export the draft, but Playtest gives an issue at the specific field.

Each encounter slot offers the prepared, date-compatible catalog first, with a **Show more** control for other prepared entries. The wider list does not bypass availability or an explicit period override rule. A selected entry shows its title, kind and asset review state. **Create enemy candidate** opens a small form for stable ID, name, recognizable reference, visual joke, attack or obstacle, eligible dates and a known behavior preset. The candidate can be assigned to a compatible ordinary or boss slot. It has a plainly labeled neutral placeholder in an isolated preview and no model URL in the portable project. Modeling and exact-version approval happen in the asset studio, outside the editor.

The toolbar retains validation, local autosave, import/export and Playtest. Playtest offers **From this level** and **Full adventure** for any valid project. Starting a run freezes geometry, chosen cast and fictional memories together. Returning to the editor restores the draft and undo history; a later draft edit cannot change the run already started.

## Visual and content behavior

Preserve the current storybook editing palette and large central viewport. A level's theme selects a prepared kit and palette; an unavailable or pending kit uses named neutral geometry rather than hiding a platform or pretending art is approved. Combat and collision continue to use the authored anchor and arena coordinates. Enemy name and visible placeholder refer to the same frozen encounter identity. Keep the same forgiving section builder, checkpoint and memory gates in every new level.

New enemy behaviors use existing tested presets until a separate mechanic is designed and validated. A candidate's prose is a creative brief, not executable attack code. The preview labels the current nearby draft target from its frozen encounter ID so two candidates with the same move pattern remain distinguishable. Prepared cast entries are pinned by exact catalog ID/version and asset ID/version. The six friendly creatures remain outside enemy assignment and boss gates. Extra combatants beyond the five current slots require a separate gameplay contract; new character identities and assignments do not.

## Validation and compatibility

Bound levels, geometry and serialized bytes. Check unique chapter and route IDs, date order across the project, each slot's role/kind and date eligibility, ready asset identity when final gameplay art is requested, required objective order and route reachability. An out-of-period choice must be visible and authorized; the first implementation can reject it with an actionable issue while the admin policy is unfinished. Avoid auto-correcting dates or silently changing a catalog identity.

Keep v1 exports readable, published routes immutable and running saves pinned. The new project format is private fixture authoring only. A later server-backed ownership/publish workflow will require PLAN010's admission/media decisions and must not be inferred from a successful local playtest.

## Acceptance journey

Use the browser to add a new level from a course, rename it, set its fictional dates, choose or create a candidate encounter, build a side route, export and import, then play **From this level**. Repeat the substantive edits through shared CLI commands. Complete a multi-level journey with normal movement/combat and confirm the post-boss major memory advances to the next level. Miss a jump deliberately and verify recovery. Inspect editor panels and catalog pages at desktop and phone viewport widths; record actual physical Safari testing separately.
