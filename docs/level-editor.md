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

## Connect the course

Geometry and route connections work together. In **Route**, connect platforms with **From**, **To** and **Mode**, then update **Main route** or **Branches** to include the intended path. **Safe landing** identifies a catch platform below a jump.

Validation checks whether jumps are reachable, landing areas are clear, checkpoints are supported, and required gameplay objects can be reached. It also checks the room needed for the Besties boss routine. A draft can stay unfinished while you edit; **Playtest** requires both levels to pass.

Use **Review issues** to find a problem and select its object. If moving a platform breaks a jump, move the adjoining platform or revise the route. Validation deliberately keeps jumps within the game's forgiving course limits.

## Try it in the game

Choose **Playtest**, then **From this level** or **Full adventure**. The game runs a snapshot of your draft with its normal controls and mechanics. **Back to editor** returns to the draft and its undo history. Changes made after starting a test take effect in the next test.

Reloading the page ends that test and reopens the saved draft. Playtest progress is temporary.

## Keep and share your work

**Saved in this browser** means this browser has a local copy. It does not sync to another device. Use **Export** to keep a portable JSON backup or hand your project to an agent. **Import** opens an exported project from a file or pasted JSON.

A failed import leaves your current project intact. A valid project with unfinished route checks opens for editing. If browser storage is unavailable, export before closing the page.

The MVP includes the current two chapters and their existing game assets. New campaign structures, additional mechanics, personal photos and shared publishing will build on this format later.
