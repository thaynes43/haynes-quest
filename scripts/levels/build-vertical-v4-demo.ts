/**
 * Generates the DESIGN-025 vertical demo world (WO107).
 *
 * Usage: tsx scripts/levels/build-vertical-v4-demo.ts [--write]
 *
 * The generator reshapes chapter 2 of the default world template (start age
 * 4, so jump, high jump and double jump are unlocked) into an
 * authored-level-v4 climb:
 *
 *   spawn deck --high jump--> ledge --double jump--> ledge --walk--> bounce pad
 *   --bounce--> sky balcony --ride--> lift (down) --ride--> dock --> picnic
 *
 * Both first uses of a new move sit over a catch floor (practice stretches).
 * An optional branch climbs past the pad with two double jumps to a perch
 * that holds the golden collectible; a second hops across two crumbling
 * platforms beside the dock. Party-kit props frame the spawn deck.
 *
 * Without `--write` it prints the command batch. With it, it rewrites the
 * checked-in commands and project fixture that `pnpm levels:validate` replays.
 */
import { writeFile } from "node:fs/promises";
import {
  applyLevelEditorCommands,
  createWorldEditorProject,
  serializeLevelEditorProject,
  validateLevelEditorProject,
  type LevelEditorCommand,
  type LevelEditorCommandBatch,
} from "../../src/shared/editor-project.js";
import {
  bounce,
  bouncePad,
  chapterCommands,
  crumble,
  decor,
  jump,
  lift,
  platform,
  platformCheckpoint,
  ride,
  walk,
} from "./lib/growth-kit.js";

export const VERTICAL_DEMO_PROJECT_ID = "vertical-v4-demo";
export const VERTICAL_DEMO_CHAPTER_ID = "chapter-2";

export function verticalDemoCommands(): LevelEditorCommandBatch {
  const chapter = chapterCommands(VERTICAL_DEMO_CHAPTER_ID);
  const commands: LevelEditorCommand[] = [
    { type: "project.rename", name: "Vertical Growth Demo" },
    chapter.upgrade(),

    // Reuse the template's practice pieces under clearer names; renames keep
    // every connection, path and checkpoint reference intact.
    chapter.rename("besties-practice-ground", "catch-floor"),
    chapter.rename("party-terrace-1", "hj-ledge"),
    chapter.rename("party-terrace-2", "dj-ledge"),
    chapter.rename("besties-practice-down-1", "sky-balcony"),
    chapter.rename("besties-practice-down-3", "lift-dock"),

    // Drop the old terrace chain that the climb replaces.
    chapter.disconnect({ from: "dj-ledge", to: "party-terrace-3", mode: "jump" }),
    chapter.disconnect({ from: "party-terrace-3", to: "sky-balcony", mode: "jump" }),
    chapter.disconnect({ from: "sky-balcony", to: "besties-practice-down-2", mode: "jump" }),
    chapter.disconnect({ from: "besties-practice-down-2", to: "lift-dock", mode: "jump" }),
    chapter.remove("party-terrace-3"),
    chapter.remove("besties-practice-down-2"),

    // The catch floor now only spans the two practice jumps.
    chapter.update(platform("catch-floor", { x: 0, z: -8, sizeX: 12, sizeZ: 11, top: 0 })),
    chapter.update(platform("hj-ledge", { x: 0, z: -6.4, sizeX: 5, sizeZ: 3.6, top: 0.6 })),
    chapter.update(platform("dj-ledge", { x: 0, z: -10.8, sizeX: 5, sizeZ: 3.6, top: 1.8 })),
    chapter.update(platform("sky-balcony", { x: 1.5, z: -17, sizeX: 9, sizeZ: 4.8, top: 4 })),
    chapter.update(platform("lift-dock", { x: 0, z: -26.15, sizeX: 6, sizeZ: 7.3, top: 0 })),
    chapter.add(
      bouncePad("spring-pad", {
        x: 0,
        z: -13.4,
        sizeX: 1.8,
        sizeZ: 1.6,
        top: 1.8,
        strength: "big",
      }),
    ),
    chapter.add(
      lift("sky-lift", {
        x: 0,
        z: -21,
        sizeX: 3,
        sizeZ: 2.8,
        bottomTop: 0,
        distance: 4,
        period: 8,
        thickness: 0.4,
      }),
    ),
    chapter.add(platform("golden-perch", { x: 4.5, z: -12.4, sizeX: 3, sizeZ: 3, top: 3 })),
    chapter.add(platformCheckpoint("dj-ledge-safe", "dj-ledge", { x: 0, y: 1.8, z: -10.8 })),
    chapter.add(platformCheckpoint("balcony-safe", "sky-balcony", { x: 0, y: 4, z: -16.2 })),

    // Practice stretches: the first high jump and double jump over the floor.
    chapter.reconnect(
      { from: "party-welcome", to: "hj-ledge", mode: "jump" },
      jump("party-welcome", "hj-ledge", {
        requires: "high-jump",
        safeMissPlatformId: "catch-floor",
      }),
    ),
    chapter.reconnect(
      { from: "hj-ledge", to: "dj-ledge", mode: "jump" },
      jump("hj-ledge", "dj-ledge", {
        requires: "double-jump",
        safeMissPlatformId: "catch-floor",
      }),
    ),
    chapter.connect(walk("dj-ledge", "spring-pad")),
    chapter.connect(bounce("spring-pad", "sky-balcony")),
    chapter.connect(ride("sky-balcony", "sky-lift")),
    chapter.connect(ride("sky-lift", "lift-dock")),
    chapter.reconnect(
      { from: "lift-dock", to: "party-picnic", mode: "jump" },
      walk("lift-dock", "party-picnic"),
    ),
    // The older child's side route past the pad.
    chapter.connect(jump("dj-ledge", "golden-perch", { requires: "double-jump" })),
    chapter.connect(jump("golden-perch", "sky-balcony", { requires: "double-jump" })),

    chapter.mainPath([
      "party-welcome",
      "hj-ledge",
      "dj-ledge",
      "spring-pad",
      "sky-balcony",
      "sky-lift",
      "lift-dock",
      "party-picnic",
      "ribbon-lane",
      "ribbon-rest",
      "party-ferry",
      "party-dock",
      "zigzag-hop-1",
      "zigzag-hop-2",
      "party-grove",
      "turnstile-deck",
      "party-fair",
      "final-hop-1",
      "final-hop-2",
      "besties-court",
      "party-reward",
    ]),
    chapter.branch(["dj-ledge", "golden-perch", "sky-balcony"]),

    // A crumbling detour beside the dock: keep moving or drop.
    chapter.add(crumble("crumble-a", { x: 4.8, z: -24, sizeX: 2.4, sizeZ: 2.4, top: 0.3 })),
    chapter.add(crumble("crumble-b", { x: 4.8, z: -27.4, sizeX: 2.4, sizeZ: 2.4, top: 0.3 })),
    chapter.connect(jump("lift-dock", "crumble-a")),
    chapter.connect(jump("crumble-a", "crumble-b")),
    chapter.connect(jump("crumble-b", "party-picnic")),
    chapter.branch(["lift-dock", "crumble-a", "crumble-b", "party-picnic"]),

    // Party-kit props beside the route (never on a walkable surface).
    chapter.addDecor(decor("welcome-arch", "party-arch", { x: 0, y: 0, z: 4.7 }, { scale: 1.2 })),
    chapter.addDecor(decor("welcome-balloons-left", "party-balloon-post", { x: -5.6, y: 0, z: 1.5 })),
    chapter.addDecor(decor("welcome-balloons-right", "party-balloon-post", { x: 5.6, y: 0, z: 1.5 })),
    chapter.addDecor(
      decor("floor-gifts", "party-gift-stack", { x: -6.9, y: 0, z: -8 }, { rotationY: 0.4 }),
    ),
  ];
  return { expectedRevision: 0, commands };
}

export function buildVerticalDemoProject() {
  const base = createWorldEditorProject({ projectId: VERTICAL_DEMO_PROJECT_ID });
  const result = applyLevelEditorCommands(base, verticalDemoCommands());
  if (!result.ok)
    throw new Error(
      `Vertical demo commands failed: ${result.issues.map((entry) => `${entry.path}: ${entry.message}`).join("; ")}`,
    );
  const issues = validateLevelEditorProject(result.project);
  if (issues.length > 0)
    throw new Error(
      `Vertical demo project is invalid: ${issues.map((entry) => `${entry.path}: ${entry.message} (${entry.code})`).join("; ")}`,
    );
  return result.project;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const commands = `${JSON.stringify(verticalDemoCommands(), null, 2)}\n`;
  if (process.argv.includes("--write")) {
    const project = serializeLevelEditorProject(buildVerticalDemoProject());
    await writeFile(
      new URL("./examples/vertical-v4-demo.commands.json", import.meta.url),
      commands,
    );
    await writeFile(
      new URL("./examples/vertical-v4-demo.project.json", import.meta.url),
      project,
    );
    process.stdout.write("Wrote vertical-v4-demo commands and project fixture\n");
  } else {
    buildVerticalDemoProject();
    process.stdout.write(commands);
  }
}
