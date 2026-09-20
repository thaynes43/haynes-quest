# DESIGN019: Level editor workspace

Status: Astra's implementation contract for PLAN012, September 20, 2026. PRD002 and ADR003 govern scope. The task uses current artwork and mechanics; no new asset production is required.

## Workspace and flow

Expose **Level editor** from the private playtest start screen and serve the app at `/editor`. Keep `/studio` as the separate asset/documentation catalog. The editor is available only in the isolated ephemeral fictional fixture. On a surface without that capability show **The level editor is available in the private playtest.** and **Back to game**.

Desktop layout: a full-height workspace, 60px header, 240px left rail, flexible central 3D view and 300px right inspector. Use the existing ivory/paper, ink and forest-green palette; subtle borders, compact readable controls, selected objects in honey/gold. Editing text is at least 16px on touch. The center has a grid, axes, selection highlight and visible route connections. Keep the viewport large; do not present a decorative landing page before the tools.

Header: **Haynes Quest · Level editor**, editable project name, storage status, **Undo**, **Redo**, **Import**, **Export**, **Playtest**. Secondary controls: chapter selector (**Level 1 — The Block Party**, **Level 2 — Besties Obby**, then edited chapter names), **New project**, **Validate**, **Frame level**, **Frame selection**, **Snap** with Off/0.25/0.5/1 units. Show **Draft** or **Ready to play** based on validation. Both chapter documents belong to one portable project; chapter selection does not discard edits.

The initial project contains exact copies of both shipped v2 templates. New project returns to those templates after confirming **Start a new project? Export your current draft first if you want to keep it.** The name defaults to **Untitled adventure**. Authors can retain a safe template and modify it incrementally; no blank world with missing mandatory gameplay slots is required for this MVP.

The left rail has **Objects** and **Add** tabs. Objects group **Platforms**, **Hazards**, **Checkpoints**, **Gameplay** and provide search by ID. Gameplay includes spawn, exit, reward respawn, two tools, three memories, four enemies, boss and three friends. Selecting an item frames/highlights the corresponding object and opens its properties. Add offers **Platform**, **Moving platform**, **Sweeper**, **Checkpoint** with safe preset dimensions, unique IDs and placement near selection or view center. Explain **Gameplay objects are included with the template.** Fixed slots remain movable; changing the encounter roster is outside this layout MVP.

The center uses orbit, pan and camera distance controls, plus click selection and a translate gizmo. Hint: **Drag to orbit · Right-drag to pan · Wheel to move closer**. This changes the editor camera, never browser zoom. Prevent camera and gizmo gestures from competing; dispose controls, resources and listeners on unmount. Positions remain editable numerically, including on touch screens. Existing GLB assets may be used where convenient; clear labeled markers are acceptable in edit mode because **Playtest** uses the real game artwork and mechanics.

The inspector contains **Properties** and **Route**. Properties exposes the selected object's stable ID/type, position, platform dimensions, supported motion/rotation parameters, checkpoint support/activation, anchor support and encounter arena/checkpoint as applicable. Labels: **X**, **Y**, **Z**, **Width**, **Height**, **Depth**, **Axis**, **Travel**, **Period**, **Phase**, **Platform**, **Checkpoint**, **Radius**, **Half length**, **Min X**, **Max X**, **Min Z**, **Max Z**. Use selects for enumerated/reference values and numeric inputs for numbers. Provide **Duplicate** and **Delete** only where structurally allowed. Gameplay slots cannot be deleted. For moving a platform, **Move attached objects** defaults on: its supported anchors, arenas and checkpoint positions translate together. Geometry errors remain visible when the move invalidates a route.

Route editing exposes connections with **From**, **To**, **Mode**, **Safe landing** and **Add connection**/**Remove connection**. Show **Main route** and **Branches** as editable ID sequences, with current IDs available for reference. Never silently regenerate topology or discard invalid-but-editable routes. The visual route lines and the same validator support deliberate repairs. An **Object JSON** disclosure may support precise advanced edits, but numeric properties and connection controls must remain usable without JSON.

## Edits, saving and errors

Every deliberate edit is one undo transaction. A gizmo drag commits once on release; numeric fields commit on Enter/blur and retain unfinished text while typing. Undo/redo is bounded and restores selection safely. Ctrl/Cmd-Z and Shift-Ctrl/Cmd-Z work outside text fields; typing and native text undo inside inputs are preserved. Delete acts only when the workspace owns focus, never while typing.

Autosave only the current project, not a running test or credentials. Storage status copy: **Saved in this browser**, **Saving…**, **Browser storage is unavailable. Export your draft to keep it.** A corrupt prior draft is not silently overwritten: show **The saved draft could not be opened. Import a backup or start a new project.** with the original text available for download if safe. Export works even when local storage fails. Store versioned data, parse with the shared bounded structural parser, and do not execute imported content.

Import supports a JSON file and paste text, with **Import project**, **Choose file**, **Paste JSON**, **Cancel** and **Import**. Reject oversized/malformed/structurally unsafe data without replacing the current draft. A structurally valid project with semantic errors imports as an editable draft. A successful import is undoable. Export names a readable `.json` file and uses deterministic canonical serialization; it must preserve all supported fields. Validation errors use the existing shared issue messages with object/path context, not an opaque stack trace.

Validation summary: **Ready to play** or a **{count} issues to fix** button that opens the issues panel. Issue rows select the affected chapter/object where possible. Semantic validation can update after edits with a short debounce; it must not freeze the viewport. **Playtest** validates both chapters and, on error, opens the issues panel with **Fix these issues before playtesting.** Runtime/server failures show **Could not start the playtest. Your draft is safe.** plus a concise safe error detail.

## Playtest and smaller screens

Playtest offers **From this level** and **Full adventure**. The server validates and freezes the complete project and starts the normal fictional runtime in the selected chapter. Keep the draft/selection/history when testing; leave returns to the editor through **Back to editor**, without replacing the draft with gameplay state. A document edit after snapshot creation cannot change current collisions, encounters or chapter two. Full adventure uses both edited chapters with existing progression rules.

Below desktop width, collapse rails into **Objects**, **Properties**, **Checks** tabs or drawers around the central **View**. Keep toolbar controls wrapped and reachable; no horizontal page overflow at phone width. Numeric properties and explicit camera frame controls provide a usable fallback to precision gizmos. Menus/rails scroll normally, the canvas owns its gestures, and app-wide browser zoom remains disabled. Desktop is the primary authoring surface; do not claim mobile-device precision or performance based on emulation.

## Verification

Test both untouched template documents resolving identically to current shipped levels. Use actual UI editing to change a platform/anchor in a valid way, undo/redo it, export/import, reload the draft and see that placement in the real playtest inspection. Test malformed import, semantic errors, storage failure, scene disposal, pointer interaction, preview snapshot isolation and return-to-editor preservation. Complete both chapters through the shared preview path using normal controls and retain the ordinary private playtest as a regression boundary.

## Optional geometry and vertical building (PLAN013)

Tom's subsequent floating-platform feedback corrects the MVP's blanket route-membership restriction. In v2 documents, adding a static or moving platform does not require listing it in Main route or Branches. It is ordinary visible, solid geometry and can be used for exploration or decoration. Explicit connections still receive jump/walk safety checks. Gameplay anchors retain route membership and required progression retains main-route ordering, so the change does not allow stranding required memories or encounters. V1 documents keep their original validation semantics.

Broad climbing platforms use the existing jump mechanics and conservative connection limits. Reusable section tooling will add ordinary editable geometry and connections in one undo transaction through the same command contract used by agents. Optional geometry does not guarantee reachability or a collision-free camera; actual Playtest remains part of building.
