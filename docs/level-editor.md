# Build a level

The private level editor starts with editable copies of **The Block Party** and **Besties Obby**. You can add more levels, give each its own story and cast, then shape and playtest the whole adventure without writing game code. New levels remain private fictional drafts until their content and assets pass review.

Open **Level editor** from the private playtest's start screen, or visit `/editor` on that host. A computer with a mouse is the easiest way to build. On a narrow screen, use **View**, **Objects**, **Properties**, **World** and **Checks** to switch panels.

**Open Rat Casino sample** loads the checked-in fictional three-level project with the optional Golden fight and the exact private-trial cast. The editor asks before replacing your current view, downloads your current draft first and keeps it in Undo history. You can also enter the Rat Casino level directly from the playtest start screen. The current portable sample is `src/shared/levels/rat-casino-world-v2.json`; its deterministic command batch is `scripts/levels/rat-casino-world-v2.commands.json` in the source repository. The original v1 sample and command batch remain available there as history.

## Make your first change

1. Choose a level in the toolbar. Select an object in **Objects**, or click it in the scene.
2. Use **Frame selection** to bring it into view. Drag to orbit the camera, right-drag to pan, and use the wheel to move closer.
3. Move the object with its handles or edit **X**, **Y** and **Z** in **Properties**. **Snap** sets the spacing for handle movements. Platform dimensions use **Width**, **Height** and **Depth**.
4. Keep **Move attached objects** on when moving a platform. Its supported gameplay objects and checkpoints move with it.
5. Use **Undo** and **Redo** to compare changes. One completed drag is one undo step.

To add a course piece, use **Add** in the left panel. Platforms, moving platforms, sweepers and checkpoints are available. Memories, equipment, encounters and friends can be repositioned. Each course keeps its five required encounter *slots*, while **World** lets you change which character fills each slot or add one optional side encounter.

## Add a world

Choose **Add level** beside the level picker, then **From garden course** or **From obby course**. The new level copies a complete playable course with its own route ID. Select **World** to change its story, theme, dates and cast. **Duplicate this level** makes an independent copy; **Move earlier**, **Move later** and **Remove level** change the adventure order. Removing a level asks for confirmation and can be undone.

Five themes are available. **Storybook garden** and **Block party** retain the current scenery. **Midnight arcade** and **Skyline toybox** have distinct preview colors and simple placeholder scenery while their exact art is reviewed. **Rat Casino** uses its reviewed v001 marquee, roulette dais and cabinet models in the private fixture trial. Theme choices change the look, not the collision or required route.

Set the fictional birth date and each level's **Period starts**, **Period ends**, **Age from** and **Age after boss** in World. Enter dates as `YYYY-MM-DD`. The two small preview memories must occur in order; the boss memory closes the period. A level starts on the previous level's end date and carries its recovered age forward. These are fictional test records; the editor does not search family photos or publish a real person's journey.

Each encounter slot offers prepared characters that match the level's start date. **Show more prepared characters** exposes the broader catalog, but choosing an ineligible character still leaves a validation issue. **New candidate for this slot** records a stable, editable ID, name, recognizable reference, visual joke, move pattern and eligible dates. The ID travels with the exported project and later asset review. The draft uses an existing tested combat pattern and a neutral placeholder in the isolated playtest. A new enemy's short encounter pitch and concept need Tom's feedback before expensive Blender modeling; the exact model still needs review before ordinary gameplay use. Friendly creatures cannot be assigned as enemies.

**Add an optional enemy** in World to give a side platform an independent fight. Choose an eligible character and platform, then set X, Z and the arena half-width clear of existing fights and objectives. After adding it, select its marker to drag it or edit its arena in Properties. The optional fight can be removed or undone; it never blocks the boss or final memory. The agent CLI uses `encounter.bonus.add` and `encounter.bonus.remove` with the same validated anchor and candidate contract. Rat Casino's current sample uses Golden After-Hours Rat in this slot.

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

### Growth moves and vertical pieces

New world chapters can opt into `authored-level-v4` (DESIGN-025, growth moves and vertical courses). The upgrade keeps the level's content and validation, and unlocks the growth pieces and ability-aware jumps. Published routes and v1–v3 levels never accept them.

```json
{ "type": "chapter.level.upgrade", "chapterId": "chapter-2", "schemaVersion": "authored-level-v4" }
```

Add pieces with `piece.add`:

- `{"type": "lift", "id": "sky-lift", "center": {...}, "size": {...}, "travel": {"distance": 4, "period": 8, "dwell": 2}}` is a platform that moves straight up and down. `center` is the bottom stop; the top stop is `distance` metres higher (0.5–8 m, period 4–20 s). The optional `dwell` (0–3 s) makes it wait at each stop, so one cycle takes `period + 2 × dwell`; without it the lift never pauses. Connections touching it use `ride`, and both stops need a `ride` connection to a landing within jump height.
- `{"type": "bounce-pad", "id": "spring-pad", "center": {...}, "size": {...}, "strength": "small" | "big"}` launches the player straight up on contact (apex about 1.9 m or 2.7 m). It is at least 1.2 × 1.2 m, needs a clear launch column, and every connection leaving it uses `"mode": "bounce"`: rise at most 1.3 m (`small`) or 2.6 m (`big`), gap at most 2.2 m.

- `{"type": "crumble", "id": "crumble-a", "center": {...}, "size": {...}}` shakes for 0.8 s after the first touch, drops away and returns 3 s later. Use it only on optional branches, never on the main route and never under or over an objective, fight area or checkpoint.

A `"mode": "drop"` connection steps or hops down to a lower surface that does not move, at any age: it descends 0.36–3 m across a gap of at most 1.4 m, with the same take-off and landing strips as a jump. The lower surface may reach back under the upper one, but at least 1.05 m of it must lie beyond the take-off edge, so the landing is never hidden under the deck; a `glide` follows the same rule. Use a drop for a descent instead of spending a growth move. A `bounce` may also declare a `safeMissPlatformId` catch floor for a practice bounce; its retry connection may lead to the deck that leads onto the pad.

Place scenery with `decor.add` and `decor.remove` (`"decorId"`). A prop is `{"id": "welcome-arch", "kitPropId": "party-arch", "position": {"x": 0, "y": 0, "z": 4.7}, "rotationY": 0, "scale": 1.2}`, where `position` is the prop's floor centre, `rotationY` is in radians and `scale` runs from 0.25 to 4. A level holds at most 200 props, each from its own theme's kit or the shared kit of existing exact models (`inspect` lists both under `themeKitProps`, with each prop's `kit`). Props never collide, so the validator keeps them out of the space the player moves through. A prop can't overlap any surface's walkable space, a connection's lane or a fight area, unless it sits entirely at least 3 m above the highest standing height there. Props beside or below the route are fine. `inspect` reports each placed prop's `worldBounds`.

A `jump` connection may declare `"requires": "high-jump" | "double-jump" | "glide"`. High jump allows 0.70 m rise and 1.7 m gap; double jump 1.30 m and 2.4 m; glide must descend at least 0.8 m and allows a 4 m gap. Every `requires` must be unlocked at the chapter's recovered start age (`inspect` reports `growthMoves` per chapter), and the first main-route use of a move that is new in that chapter needs a `safeMissPlatformId` catch floor as its practice stretch.

Theme kits are registered in `src/game/theme-kits.ts` (palette, fog, trail look and any prepared scenery) with their props in `src/shared/theme-kits.ts` (bounding box, procedural fallback and, once reviewed, the exact GLB and its SHA-256). A prop without a model, or one whose model fails to load, draws its procedural stand-in. On v4 levels every theme shows a collectible trail with its own look and names, and places the rare collectible on the highest optional-route platform.

`inspect` also reports a top-level `growth` block with these limits, unlock ages and launch speeds, lift `stopTops`, `dwellSeconds` and `cycleSeconds`, and pad `launchApex`. `scripts/levels/build-vertical-v4-demo.ts` is a worked generator: it uses the helpers in `scripts/levels/lib/growth-kit.ts` to emit `scripts/levels/examples/vertical-v4-demo.commands.json`, which `pnpm levels:validate` replays into the checked-in example project.

V4 levels may also use the family-world era themes `clubhouse`, `harbor`, `rooftop`, `playroom` and `casita` through `chapter.details.set`; a v3 level rejects them.

### Generate a whole world

A generator can own a world's chapter list. Start the project on the catalog the world's casts use. The family worlds use `parody-catalog-v8`, which adds the landed family-era models to v7, or `parody-catalog-v9`, which is v8 plus the Besties' parent lock (World B v2):

```bash
pnpm --silent levels:editor world-template family-world "Family world" --catalog parody-catalog-v8 > project.json
```

A TypeScript generator passes the same choice as `createWorldEditorProject({ projectId, catalogVersion: "parody-catalog-v8" })`. `worldShellCommands` in `growth-kit.ts` turns the project's two seeded chapters into the chapters it lists, in order: it adds each chapter, removes the seeds, upgrades each to v4 and sets its theme, dates, ages and preview memories. Chapter and route ids must be unique, and a chapter may reuse a seeded route id (`chapter-1-route` or `chapter-2-route`) in any position. The generator then replaces each chapter's level whole with `chapter.level.replace` and assigns the cast:

```json
{ "type": "chapter.level.replace", "chapterId": "a1-clubhouse", "level": { "schemaVersion": "authored-level-v4", "id": "a1-clubhouse-route", "...": "..." } }
```

The chapter must already be v4, and the level's `id` must equal the chapter's route id. The replacement is validated like any other edit, and the chapter keeps its encounter assignments. `pnpm --silent levels:editor level project.json <chapter-id>` prints one chapter's level for editing.

A cast member whose Blender model has landed is a prepared catalog entry; assign it with its exact reference, for example `{ "type": "encounter.assign", "chapterId": "a1-clubhouse", "slot": "boss", "encounter": { "source": "catalog", "catalogEntryId": "clubhouse-bully-cat", "catalogEntryVersion": "v001" } }`. Anyone not yet modeled stays a project candidate (`enemy.add`) with neutral placeholder art. [DESIGN-026](designs/026-personal-era-casts.md#eligibility) lists the registered models and their windows.

Check a generated world in three ways:

- Check it in as `scripts/levels/examples/<name>.project.json` beside `<name>.commands.json`. `pnpm levels:validate` replays every such pair byte-identically from a fresh world project with the project's own id and catalog. The command file may hold one batch or an array of batches applied in order, which keeps a whole world under the per-batch size limit.
- Run `lintFamilyChapter` from `src/shared/family-world-lint.ts` over each chapter in the generator's tests (DESIGN-025 D-08).
- Use the kid-model helpers in `tests/game/family-kid-lib.ts`. `bounceWalkOn` walks onto each required pad at stick 0.4–1.0 (`R2_STICKS`). `liftWalkIn` counts how often a child walking toward a lift falls into its open shaft. `runGrowthRouteWithWaits` runs the required route while waiting for sweepers and walking around them, and its `seconds` are the pacing measurement.

### Family worlds

The family world templates are generated worlds like this, checked in and served to administrators by the family template registry. Each template has three parts:

- **Chapter generators.** `scripts/levels/family/<chapter>.ts` (for example `a1.ts` to `a4.ts` for World A) each export one pure function that returns the chapter's whole `authored-level-v4` document, plus its cast and constants. Each chapter's test in `tests/levels/family-<chapter>.test.ts` proves the level with the validators, the family lints and the kid model.
- **The world generator.** `scripts/levels/build-family-world-a.ts` owns World A (`family-world-a@v1`, "Clubhouse to Casino"). It starts a world project on `parody-catalog-v8`, runs `worldShellCommands` for the chapter list, names, themes, fictional birth date, contiguous dates, ages and fictional preview memories, then replaces each chapter's level with `chapter.level.replace` and assigns its cast. A cast member with a landed model uses its catalog reference (`encounter.assign`). Everyone else is a project candidate (`enemy.add`) with neutral placeholder art. Friendly creatures need no command: each level's friendly anchors take the chapter's creatures from the frozen friendly catalog.
- **The checked-in output.** `pnpm exec tsx scripts/levels/build-family-world-a.ts --write` rewrites the command history `scripts/levels/family-world-a.commands.json` and the template project `src/shared/levels/family-world-a-v1.json`. `pnpm levels:validate` replays every `src/shared/levels/family-world-<key>-v<N>.json` from its command file and fails if a byte differs. `CHECKED_IN_FAMILY_TEMPLATES` in `src/server/family/templates.ts` registers the project as `id@version`, and the project's `name` is what administrators see when they choose a world for a child.

A published family journey freezes the template's fingerprint, so a template is never edited in place: a changed world is a new version with its own project file and registry entry. `tests/levels/family-world-a.test.ts` checks the assembled world and `tests/server/family/family-world-a.test.ts` checks the template flow for a synthetic child. `tests/e2e/family-world-lockstep.ts` plays each chapter in Chromium through the ephemeral playtest with the on-screen stick and keyboard ([private-preview runbook](ops/002-private-preview.md)).

World B (`family-world-b@v2`, "Playroom to Big Stage") follows the same pattern:

- `scripts/levels/family/b1.ts`, `b2.ts` and `b3.ts` return its chapters (`familyB1Level()`, `buildB2Level()`, `familyB3Level()`), each proved by its own test under `tests/levels/`.
- `scripts/levels/build-family-world-b.ts` uses the fictional birth date 2020-06-01 and contiguous chapters at ages 0→2, 2→4 and 4→6. The landed Big Honk Bus and the Besties use catalog references; the rest of the cast are project candidates. Each chapter has one ordinary identity, which fills all four ordinary slots.
- `pnpm exec tsx scripts/levels/build-family-world-b.ts --write` rewrites `scripts/levels/family-world-b-v2.commands.json` and `src/shared/levels/family-world-b-v2.json` on `parody-catalog-v9`.
- The frozen v1, `family-world-b.commands.json` and `family-world-b-v1.json` on `parody-catalog-v8`, is never regenerated. It stays registered, so a journey that pinned it still loads. `tests/levels/family-world-b.test.ts` replays it byte for byte and checks that v2 differs from it only in the catalog version, the Demon Idol window and the two deeper lift cars.

A template is offered only when its rebased world validates for the child: the final chapter's big memory must already be due, and every cast window must hold at each chapter's rebased start. Chapter three starts on the child's fourth birthday. In v2 the Demon Idol and the Besties (parent-locked in `parody-catalog-v9`) open on 2022-07-31, so World B v2 serves any child who is at least six and was born on or after 2018-07-31. v1's windows opened on 2024-01-01, so it served only children born in 2020 or later.

`tests/levels/family-world-b.test.ts` checks the replay, the whole-world validator, the copy, dates and casts, and each chapter's lints inside the world. `tests/server/family-world-b.test.ts` offers the template to synthetic children, rebases it, builds a family-world plan and plays its first chapter through the in-memory stores.

`tests/e2e/family-world.ts` is World B's browser pilot. Serve a fresh build in the ephemeral fixture mode described in the [private-preview runbook](ops/002-private-preview.md), then run `QUEST_E2E_URL=http://127.0.0.1:3000 node_modules/.bin/tsx tests/e2e/family-world.ts`. It plays each chapter through the editor playtest with the page clock in lockstep, and drives the game only through its analog input (`GameHandle.setInput`). Before each crossing it plans the moves with the chapter tests' patient-kid planner, starting from the game's own traversal state and course clock, then replays the planned stick frame by frame. It collects both tools and fights every encounter: it walks into mallet range, because the Secondary reaches further than Attack, then presses Attack with the Secondary. It recovers both minor memories and the major memory, and saves the spawn, mid-climb and boss-arena screenshots with a `report.json`. `QUEST_E2E_CHAPTERS` picks chapters, `QUEST_FAMILY_WORLD_VERSION` picks a template version (the newest checked in by default), and `QUEST_E2E_DRAW_EVERY=4` draws every fourth frame on a slow software renderer. This proves route logic and rules under ordinary input, not frame time or feel on a device.
