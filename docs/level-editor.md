# Build a level

The private level editor starts with editable copies of **The Block Party** and **Besties Obby**. Both use the same movement, combat, memories and characters as the game. You can reshape their courses and move gameplay objects without writing game code.

Open **Level editor** from the private playtest's start screen, or visit `/editor` on that host. A computer with a mouse is the easiest way to build. On a narrow screen, use **Objects**, **Properties**, **Checks** and **View** to switch panels.

## Make your first change

1. Choose a level in the toolbar. Select an object in **Objects**, or click it in the scene.
2. Use **Frame selection** to bring it into view. Drag to orbit the camera, right-drag to pan, and use the wheel to move closer.
3. Move the object with its handles or edit **X**, **Y** and **Z** in **Properties**. **Snap** sets the spacing for handle movements. Platform dimensions use **Width**, **Height** and **Depth**.
4. Keep **Move attached objects** on when moving a platform. Its supported gameplay objects and checkpoints move with it.
5. Use **Undo** and **Redo** to compare changes. One completed drag is one undo step.

To add a course piece, use **Add** in the left panel. Platforms, moving platforms, sweepers and checkpoints are available. The template's memories, equipment, enemies and friends can be repositioned; their gameplay roles stay fixed in this MVP.

## Build a climbing section

In **Add → Build a section**, choose a **Raised arch** or **Zigzag ridge**, a **Start platform**, a **Rejoin platform** and a side. **Climbing steps** and **Rise per step** set the climb. Select **Add section** to create its platforms, connections, checkpoints and side route together. **Undo** removes the whole section; the individual pieces remain editable afterward.

Try `welcome` to `picnic` in Level 1 with the defaults. The route climbs and descends beside the opening course. Up to twelve climbing steps are available for taller routes; use a longer span to retain broad landings. A short span may not fit the requested number of broad steps; choose a farther rejoin platform or fewer steps. If a lane is occupied, try the other side or different endpoints. The builder shows its platform count and peak height before adding it. If the section does not fit, it explains what to change and leaves the draft intact.

Start with broad landings and an easy climb, add a bend or change in rhythm, and place a safe pause where the player can see the next jump. Mix quiet discovery areas with short obstacle sections. Height alone does not make a course interesting: walk the new route in Playtest, miss a jump deliberately, and check the recovery before adding more.

These sections are side routes. They preserve the template's main progression and gameplay objects. Use **Route** and **Properties** when deliberately changing the required journey. **Top surface Y** shows the standing height of a platform; **Snap → 0.3 units** matches the template's rise between steps.

## Connect the course

Floating platforms are supported. Add a **Platform** and raise its **Y** in Properties, or drag the green handle. Platform Y is its center; the standing surface is Y plus half its Height. Extra platforms can stay outside the named routes and still appear as solid platforms in Playtest.

Use **Route** for the intended course: connect platforms with **From**, **To** and **Mode**, then update **Main route** or **Branches**. Gameplay objects still need a route; required equipment, memories and fights belong on the main route in progression order. **Safe landing** identifies a catch platform below a jump.

Validation checks declared jump distances and rises, landing clearance, checkpoint support and required gameplay routes. Optional geometry is not automatically checked for a path to it. It also checks the room needed for the Besties boss routine. A draft can stay unfinished while you edit; **Playtest** requires both levels to pass.

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

The private playtest keeps two recent runs per browser session. Starting another can expire an older game tab; your saved editor draft is separate from those runs.

## Keep and share your work

**Saved in this browser** means this browser has a local copy. It does not sync to another device. Use **Export** to keep a portable JSON backup or hand your project to an agent. **Import** opens an exported project from a file or pasted JSON.

A failed import leaves your current project intact. A valid project with unfinished route checks opens for editing. If browser storage is unavailable, export before closing the page.

The MVP includes the current two chapters and their existing game assets. New campaign structures, additional mechanics, personal photos and shared publishing will build on this format later.

## Work with an agent

Agents use the same project JSON and validation as the browser editor. From the repository, create and inspect a template:

```bash
pnpm --silent levels:editor template garden-remix "Garden remix" > project.json
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

Commands cover names, adding, moving, updating, duplicating and removing pieces, gameplay anchors, encounter arenas, connections, main routes and branches. Platform moves carry supported objects by default; set `carryAttached: false` only for an intentional independent move. `schema project` describes the complete portable document. For an ambiguous connection, include its zero-based `index` together with `from`, `to` and `mode` in the command’s `match`; the index must still identify that connection. Keep array order intact, including the `pieces` array: checkpoint recovery uses its ordering.

Give a building agent the project, the command schema, and a concrete change such as “add a raised zigzag side route, keep the main progression intact, and verify every new jump.” Have it apply small batches, read validation issues, and export the result. New character models, encounter behavior and physics still belong in the asset and game-mechanics workflows.

### Build sections with one command

`inspect` includes `chapters[].spatial`: platform placements and `topY`, route membership (`mainPathIndex`, `branchIndices`, `optional`), connections, anchors and bounds. Its top-level `limits` comes from the shared validator. `optional` means outside the named routes; a catch floor can still be referenced by a jump’s safe landing, listed in `safeMissFor` by connection index. Use these to choose the start, rejoin and available space, then apply a section command:

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
