# Build a level

The private level editor starts with editable copies of **The Block Party** and **Besties Obby**. You can add more levels, give each its own story and cast, then shape and playtest the whole adventure without writing game code. New levels remain private fictional drafts until their content and assets pass review.

Open **Level editor** from the private playtest's start screen, or visit `/editor` on that host. A computer with a mouse is the easiest way to build. On a narrow screen, use **View**, **Objects**, **Properties**, **World** and **Checks** to switch panels.

## Make your first change

1. Choose a level in the toolbar. Select an object in **Objects**, or click it in the scene.
2. Use **Frame selection** to bring it into view. Drag to orbit the camera, right-drag to pan, and use the wheel to move closer.
3. Move the object with its handles or edit **X**, **Y** and **Z** in **Properties**. **Snap** sets the spacing for handle movements. Platform dimensions use **Width**, **Height** and **Depth**.
4. Keep **Move attached objects** on when moving a platform. Its supported gameplay objects and checkpoints move with it.
5. Use **Undo** and **Redo** to compare changes. One completed drag is one undo step.

To add a course piece, use **Add** in the left panel. Platforms, moving platforms, sweepers and checkpoints are available. Memories, equipment, encounters and friends can be repositioned. Each course keeps its five encounter *slots*, while **World** lets you change which character fills each slot.

## Add a world

Choose **Add level** beside the level picker, then **From garden course** or **From obby course**. The new level copies a complete playable course with its own route ID. Select **World** to change its story, theme, dates and cast. **Duplicate this level** makes an independent copy; **Move earlier**, **Move later** and **Remove level** change the adventure order. Removing a level asks for confirmation and can be undone.

Four themes are available. **Storybook garden** and **Block party** retain the current scenery. **Midnight arcade** and **Skyline toybox** have distinct preview colors and simple placeholder scenery while their exact art is reviewed. Theme choices change the look, not the collision or required route.

Set the fictional birth date and each level's **Period starts**, **Period ends**, **Age from** and **Age after boss** in World. Enter dates as `YYYY-MM-DD`. The two small preview memories must occur in order; the boss memory closes the period. A level starts on the previous level's end date and carries its recovered age forward. These are fictional test records; the editor does not search family photos or publish a real person's journey.

Each encounter slot offers prepared characters that match the level's start date. **Show more prepared characters** exposes the broader catalog, but choosing an ineligible character still leaves a validation issue. **New candidate for this slot** records a stable, editable ID, name, recognizable reference, visual joke, move pattern and eligible dates. The ID travels with the exported project and later asset review. The draft uses an existing tested combat pattern and a neutral placeholder in the isolated playtest. A new enemy's short encounter pitch and concept need Tom's feedback before expensive Blender modeling; the exact model still needs review before ordinary gameplay use. Friendly creatures cannot be assigned as enemies.

An added level may remain a **Draft** while its dates or cast need attention. Export it safely, use **Review issues** to locate each conflict, and playtest when the whole project reads **Ready to play**.

## Build a climbing section

In **Add → Build a section**, choose a **Raised arch** or **Zigzag ridge**, a **Start platform**, a **Rejoin platform** and a side. **Climbing steps** and **Rise per step** set the climb. Select **Add section** to create its platforms, connections, checkpoints and side route together. **Undo** removes the whole section; the individual pieces remain editable afterward.

Try `welcome` to `picnic` in Level 1 with the defaults. The route climbs and descends beside the opening course. Up to twelve climbing steps are available for taller routes; use a longer span to retain broad landings. A short span may not fit the requested number of broad steps; choose a farther rejoin platform or fewer steps. If a lane is occupied, try the other side or different endpoints. The builder shows its platform count and peak height before adding it. If the section does not fit, it explains what to change and leaves the draft intact.

For a taller example, start with a fresh Level 1 and build a **Raised arch** from `welcome` to `woodland-rest`, on the **Left**, with **12** climbing steps and **0.3** rise. Its crest stands 3.6 units above the starting platform, with a checkpoint on every landing. Use a fresh draft for each example so the earlier section does not occupy the same space.

Start with broad landings and an easy climb, add a bend or change in rhythm, and place a safe pause where the player can see the next jump. Mix quiet discovery areas with short obstacle sections. Height alone does not make a course interesting: walk the new route in Playtest, miss a jump deliberately, and check the recovery before adding more.

These sections are side routes. They preserve the template's main progression and gameplay objects. Use **Route** and **Properties** when deliberately changing the required journey. **Top surface Y** shows the standing height of a platform; **Snap → 0.3 units** matches the template's rise between steps.

## Connect the course

Floating platforms are supported. Add a **Platform** and raise its **Y** in Properties, or drag the green handle. Platform Y is its center; the standing surface is Y plus half its Height. Extra platforms can stay outside the named routes and still appear as solid platforms in Playtest.

Use **Route** for the intended course: connect platforms with **From**, **To** and **Mode**, then update **Main route** or **Branches**. Gameplay objects still need a route; required equipment, memories and fights belong on the main route in progression order. **Safe landing** identifies a catch platform below a jump.

Validation checks declared jump distances and rises, landing clearance, checkpoint support and required gameplay routes. Optional geometry is not automatically checked for a path to it. It also checks the room needed wherever the Besties boss routine is assigned. A draft can stay unfinished while you edit; **Playtest** requires every level to pass.

Select the **issues to fix** button to find a problem and select its object. If moving a platform breaks a jump, move the adjoining platform or revise the route. Declared jumps allow up to 0.35 units of height change and 1.4 units of gap. Build a climb from several broad steps; a platform directly above another can block the jump with its underside. Leave space above the player and test both climbing and returning.

The Besties encounter needs a flat, clear court for its scripted attacks. These checks explain edits that would break that routine:

| Issue code | How to repair it |
| --- | --- |
| `besties.support-footprint` | Widen the support platform, or move it and the boss together so the full attack area stays supported. |
| `besties.footprint-height` | Move or lower a platform protruding into the court's playable space. |
| `besties.footprint-obstructed` | Move the sweeper or moving platform out of the attack area. |

## Try it in the game

Choose **Playtest**, then **From this level** or **Full adventure**. The game runs a snapshot of your draft with its normal controls and mechanics. **Back to editor** returns to the draft and its undo history. Changes made after starting a test take effect in the next test.

Reloading the page ends that test and reopens the saved draft. Playtest progress is temporary.

The private playtest keeps two recent runs per browser session. Starting another can expire an older game tab; your saved editor draft is separate from those runs. **From this level** starts at the selected level with earlier fictional memories already consumed. **Full adventure** starts at the first level.

## Keep and share your work

**Saved in this browser** means this browser has a local copy. It does not sync to another device. Use **Export** to keep a portable JSON backup or hand your project to an agent. **Import** opens an exported project from a file or pasted JSON.

A failed import leaves your current project intact. A valid project with unfinished route checks opens for editing. If browser storage is unavailable, export before closing the page.

Earlier two-level exports still open. Their **World** tab offers **Upgrade this draft**, which carries over the edited geometry into the expanded project format. Importing never promotes a draft to a shared or public level. Personal photos and shared publishing remain a separate future workflow.

## Work with an agent

Agents use the same project JSON and validation as the browser editor. From the repository, create and inspect a template:

```bash
pnpm --silent levels:editor world-template garden-remix "Garden remix" > project.json
pnpm --silent levels:editor inspect project.json
pnpm --silent levels:editor schema commands > commands.schema.json
```

Ask the agent to produce a command batch using that schema. Set `expectedRevision` to the revision reported by `inspect`. A batch either applies in full or leaves the project unchanged. For example:

```json
{
  "expectedRevision": 0,
  "commands": [
    { "type": "project.rename", "name": "Garden remix" },
    {
      "type": "anchor.move",
      "chapterId": "chapter-1",
      "slot": "friendly.friendly-1",
      "position": { "x": -2.75, "y": 0, "z": 1 }
    }
  ]
}
```

Save the batch as `commands.json`. Apply it to a new file, inspect its result, and validate before importing it into the browser:

```bash
pnpm --silent levels:editor apply project.json commands.json > result.json
jq -e 'select(.ok == true) | .project' result.json > revised-project.json
pnpm --silent levels:editor validate revised-project.json
pnpm --silent levels:editor export revised-project.json > import-this-project.json
```

The example uses `jq` to extract the updated project from the result envelope. `ok: true` means the commands applied; `issues` may still describe an unfinished route. Validation must return `ok: true` before Playtest. If a command fails, use the returned issue path and code to repair it and retry against the unchanged revision.

Commands cover names, levels, dates, cast assignments, candidate enemies, pieces, gameplay anchors, encounter arenas, connections, main routes and branches. For a new level, apply `chapter.add` with distinct `newChapterId` and `newRouteId` and a `sourceTemplateId` of `garden-playground-v2` or `besties-playground-v2`. The command starts its fictional dates after the previous level, but a prepared cast may be out of period and need replacing before Playtest. Use `chapter.details.set`, `encounter.assign` and `enemy.add` for the same world controls the browser offers; `schema commands` gives their exact shapes. Platform moves carry supported objects by default; set `carryAttached: false` only for an intentional independent move. `schema project` describes the complete portable document. For an ambiguous connection, include its zero-based `index` together with `from`, `to` and `mode` in the command’s `match`; the index must still identify that connection. Keep array order intact, including the `pieces` array: checkpoint recovery uses its ordering.

Give a building agent the project, the command schema, and a concrete change such as “add a third arcade level with a raised zigzag side route, fictional dates and a candidate cast; verify every new jump.” Have it apply small batches, read validation issues, and export the result. New character models, new combat behavior and physics still belong in the asset and game-mechanics workflows.

### Build sections with one command

`inspect` includes `chapters[].spatial`: platform placements and `topY`, route membership (`mainPathIndex`, `branchIndices`, `optional`), connections, anchors and bounds. Its top-level `limits` comes from the shared validator; `sectionLimits` reports the builder’s defaults and bounds. `optional` means outside the named routes; a catch floor can still be referenced by a jump’s safe landing, listed in `safeMissFor` by connection index. Use these to choose the start, rejoin and available space, then apply a section command:

```json
{
  "expectedRevision": 0,
  "commands": [{
    "type": "section.add",
    "chapterId": "chapter-1",
    "idPrefix": "sky-garden",
    "fromPlatformId": "welcome",
    "toPlatformId": "picnic",
    "pattern": "arch",
    "side": "left",
    "steps": 4,
    "rise": 0.3
  }]
}
```

Use `zigzag` for a ridge with alternating lateral steps. Choose a fresh `idPrefix` for each section. The command adds a branch between ordered static main-route platforms, preserves existing anchors and geometry, and rejects unsafe placements or exceeded scene limits atomically. It uses the game's existing platforms and collision rules, so the result needs no custom script, asset or rebuild. Validate and playtest the exported project before treating it as a finished level.
