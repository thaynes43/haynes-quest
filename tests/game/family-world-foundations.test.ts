/**
 * Family world foundations (PLAN-019): era themes, the shared prop kit, the
 * era periods and frozen catalog v7, and the commands a generator uses to own
 * a whole world. Everything here is opt-in for authored-level-v4 world
 * projects; published routes and v1–v3 documents are unchanged.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as THREE from "three";

import ratCasinoWorldV2 from "../../src/shared/levels/rat-casino-world-v2.json";
import {
  AUTHORED_LEVEL_V4_ONLY_THEMES,
  AUTHORED_LEVEL_WORLD_THEMES,
  validateAuthoredLevelDocument,
  type AuthoredDecor,
  type AuthoredLevelDocument,
} from "../../src/shared/authored-level";
import {
  applyLevelEditorCommand,
  applyLevelEditorCommands,
  createWorldEditorProject,
  LEVEL_EDITOR_CATALOG_VERSIONS,
  levelEditorPreparedEnemies,
  parseLevelEditorProject,
  serializeLevelEditorProject,
  validateLevelEditorProject,
  type LevelEditorChapterV2,
  type LevelEditorProjectV2,
} from "../../src/shared/editor-project";
import {
  FAMILY_ERA_PERIOD_IDS,
  PARODY_CATALOGS,
  PARODY_PERIODS,
} from "../../src/shared/parody-catalog";
import {
  placeableThemeKitProps,
  SHARED_THEME_KIT,
  sharedThemeKitProps,
  THEME_KIT_PROPS,
  themeKitProp,
  themeKitPropsFor,
} from "../../src/shared/theme-kits";
import { DecorScene } from "../../src/game/decor-scene";
import { THEME_KITS } from "../../src/game/theme-kits";
import { resolveRuntimeWorldTheme, WORLD_THEMES } from "../../src/game/world-themes";
import { eraStory } from "../../src/client/era";
import { chapterCommands, lift, platform, ride, worldShellCommands } from "../../scripts/levels/lib/growth-kit";
import {
  buildFamilyFixtureWorld,
  familyFixtureHarborLevel,
  familyFixtureWorldCommands,
  FAMILY_FIXTURE_CHAPTERS,
  FAMILY_FIXTURE_PROJECT_ID,
  fixtureCandidate,
  gardenOrdinaryAs,
} from "../family-world-fixtures";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const demo = JSON.parse(
  readFileSync(
    new URL("../../scripts/levels/examples/vertical-v4-demo.project.json", import.meta.url),
    "utf8",
  ),
);
const v4Level: AuthoredLevelDocument = demo.chapters[1].level;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function codes(document: unknown): string[] {
  return validateAuthoredLevelDocument(document).map((entry) => entry.code);
}

function place(id: string, kitPropId: string, x: number, z: number): AuthoredDecor {
  return { id, kitPropId, position: { x, y: 0, z }, rotationY: 0, scale: 1 };
}

describe("era themes (v4 only)", () => {
  const trailNames = {
    clubhouse: { token: "toon star", tokens: "toon stars", ticket: "golden gadget", tickets: "golden gadgets" },
    harbor: { token: "rescue badge", tokens: "rescue badges", ticket: "golden bone", tickets: "golden bones" },
    rooftop: { token: "city coin", tokens: "city coins", ticket: "golden gizmo", tickets: "golden gizmos" },
    playroom: { token: "bubble", tokens: "bubbles", ticket: "golden rattle", tickets: "golden rattles" },
    casita: { token: "butterfly", tokens: "butterflies", ticket: "golden candle", tickets: "golden candles" },
  } as const;

  it("adds exactly the five era themes to authored-level-v4 only", () => {
    expect(AUTHORED_LEVEL_V4_ONLY_THEMES).toEqual(["clubhouse", "harbor", "rooftop", "playroom", "casita"]);
    expect(AUTHORED_LEVEL_WORLD_THEMES).toEqual(["garden", "party", "arcade", "toybox", "casino"]);
    // The demo's party-kit decor would belong to another theme; drop it.
    const { decor: _partyDecor, ...undecorated } = clone(v4Level);
    for (const theme of AUTHORED_LEVEL_V4_ONLY_THEMES) {
      expect(codes({ ...undecorated, theme }), theme).toEqual([]);
      const v3 = { ...undecorated, theme, schemaVersion: "authored-level-v3" };
      expect(codes(v3).some((code) => code.startsWith("schema.")), theme).toBe(true);
    }
  });

  it("registers a bright world, era fog, exact trail names and no automatic scenery", () => {
    for (const theme of AUTHORED_LEVEL_V4_ONLY_THEMES) {
      const world = WORLD_THEMES[theme];
      expect(world.id).toBe(theme);
      expect(world.environment).toEqual({
        state: "pending-kit",
        assets: null,
        fallbackName: `${theme}-pending-kit-fallback`,
      });
      expect(world.usesPathTiles).toBe(false);
      const kit = THEME_KITS[theme];
      expect(kit.world).toBe(world);
      expect(kit.fog).toEqual({ near: 30, far: 95 });
      expect(kit.scenery).toBeNull();
      expect(kit.exitGate).toBeNull();
      expect(kit.trail.names).toEqual(trailNames[theme]);
      expect(kit.props.length).toBeGreaterThanOrEqual(4);
      expect(kit.props.length).toBeLessThanOrEqual(6);
      for (const prop of kit.props) {
        expect(prop.theme).toBe(theme);
        expect(prop.glb).toBeNull();
      }
      expect(resolveRuntimeWorldTheme({ schemaVersion: "authored-level-v4", theme }, false)).toBe(world);
    }
  });

  it("lets chapter.details.set pick an era theme only for a v4 chapter", () => {
    const project = createWorldEditorProject({ projectId: "era-theme-project" });
    const chapter = project.chapters[1]!;
    const details = {
      type: "chapter.details.set" as const,
      chapterId: chapter.chapterId,
      subtitle: chapter.subtitle,
      description: chapter.description,
      theme: "casita" as const,
      representedDateRange: chapter.representedDateRange,
      recoveredAge: chapter.recoveredAge,
      previewMemories: chapter.previewMemories,
    };
    const rejected = applyLevelEditorCommand(project, details);
    expect(rejected.ok).toBe(false);
    expect(rejected.project).toEqual(project);
    const upgraded = applyLevelEditorCommands(project, {
      expectedRevision: 0,
      commands: [chapterCommands(chapter.chapterId).upgrade(), details],
    });
    expect(upgraded.ok).toBe(true);
    expect((upgraded.project as LevelEditorProjectV2).chapters[1]!.level.theme).toBe("casita");
  });

  it("adds concert props to the party kit for the Besties finale", () => {
    expect(themeKitPropsFor("party").map((prop) => prop.id)).toEqual(
      expect.arrayContaining(["stage-speaker", "light-truss", "star-backdrop"]),
    );
  });
});

/** Floor-centred bounds of a GLB: accessor extents through the node transforms. */
function glbBounds(file: URL): { min: number[]; max: number[] } {
  const bytes = readFileSync(file);
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8")) as {
    scene?: number;
    scenes: Array<{ nodes: number[] }>;
    nodes: Array<{ mesh?: number; children?: number[]; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }>;
    meshes: Array<{ primitives: Array<{ attributes: { POSITION: number } }> }>;
    accessors: Array<{ min: number[]; max: number[] }>;
  };
  const box = new THREE.Box3();
  const visit = (index: number, parent: THREE.Matrix4) => {
    const node = json.nodes[index]!;
    const local = node.matrix
      ? new THREE.Matrix4().fromArray(node.matrix)
      : new THREE.Matrix4().compose(
          new THREE.Vector3(...((node.translation ?? [0, 0, 0]) as [number, number, number])),
          new THREE.Quaternion(...((node.rotation ?? [0, 0, 0, 1]) as [number, number, number, number])),
          new THREE.Vector3(...((node.scale ?? [1, 1, 1]) as [number, number, number])),
        );
    const world = parent.clone().multiply(local);
    if (node.mesh !== undefined)
      for (const primitive of json.meshes[node.mesh]!.primitives) {
        const accessor = json.accessors[primitive.attributes.POSITION]!;
        box.union(
          new THREE.Box3(
            new THREE.Vector3(...(accessor.min as [number, number, number])),
            new THREE.Vector3(...(accessor.max as [number, number, number])),
          ).applyMatrix4(world),
        );
      }
    for (const child of node.children ?? []) visit(child, world);
  };
  for (const node of json.scenes[json.scene ?? 0]!.nodes) visit(node, new THREE.Matrix4());
  return { min: box.min.toArray(), max: box.max.toArray() };
}

describe("shared prop kit", () => {
  const sharedIds = [
    "clearing-tree",
    "clearing-stone",
    "arrival-landmark",
    "toybox-block-tower",
    "toybox-safety-rail",
    "toybox-windup-lantern",
    "midnight-ticket-arch",
    "midnight-arcade-cabinet",
    "midnight-joystick-bollard",
  ];

  it("registers the nine exact GLB props with tight bounds around each measured model", () => {
    expect(sharedThemeKitProps().map((prop) => prop.id)).toEqual(sharedIds);
    for (const prop of sharedThemeKitProps()) {
      expect(prop.theme).toBe(SHARED_THEME_KIT);
      const file = new URL(`../../docs${prop.glb!.url.replace("/studio", "")}`, import.meta.url);
      expect(createHash("sha256").update(readFileSync(file)).digest("hex")).toBe(prop.glb!.sha256);
      const measured = glbBounds(file);
      const registered = [prop.bounds.min, prop.bounds.max].map((point) => [point.x, point.y, point.z]);
      for (let axis = 0; axis < 3; axis += 1) {
        expect(registered[0]![axis]!, `${prop.id} min ${axis}`).toBeLessThanOrEqual(measured.min[axis]! + 1e-6);
        expect(registered[1]![axis]!, `${prop.id} max ${axis}`).toBeGreaterThanOrEqual(measured.max[axis]! - 1e-6);
        // Rounded outward to the millimetre, never padded further.
        expect(measured.min[axis]! - registered[0]![axis]!).toBeLessThan(0.0011);
        expect(registered[1]![axis]! - measured.max[axis]!).toBeLessThan(0.0011);
      }
    }
  });

  it("is placeable in every v4 theme, while other kits stay theme-bound", () => {
    // Beside the demo course, clear of every surface and lane.
    for (const theme of ["party", "clubhouse", "casino", "garden"] as const) {
      const document = { ...clone(v4Level), theme, decor: [place("shared-tree", "clearing-tree", 20, -6)] };
      expect(document.decor).toHaveLength(1);
      expect(codes(document), theme).toEqual([]);
    }
    const foreign = { ...clone(v4Level), decor: [place("foreign", "curly-slide", 20, -6)] };
    expect(validateAuthoredLevelDocument(foreign)).toEqual([
      expect.objectContaining({
        code: "decor.theme",
        message: 'Prop "curly-slide" belongs to the clubhouse kit, not party or the shared kit',
      }),
    ]);
    expect(placeableThemeKitProps("clubhouse").map((prop) => prop.id)).toEqual([
      ...themeKitPropsFor("clubhouse").map((prop) => prop.id),
      ...sharedIds,
    ]);
    // Ids stay unique across every kit.
    const ids = THEME_KIT_PROPS.map((prop) => prop.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("draws each new procedural stand-in inside its prop's bounds", () => {
    const shapes = ["sphere", "tank", "stack", "board"] as const;
    for (const shape of shapes) {
      const prop = THEME_KIT_PROPS.find((entry) => entry.fallback.shape === shape)!;
      const scene = new DecorScene(
        [{ id: "sample", kitPropId: prop.id, position: { x: 0, y: 0, z: 0 }, rotationY: 0, scale: 1 }],
        { attachInstances: () => undefined },
        () => true,
      );
      const batch = scene.root.getObjectByName(`decor-fallback-${prop.id}`)!;
      const meshes = batch.children as THREE.InstancedMesh[];
      expect(meshes.length, shape).toBeGreaterThanOrEqual(2);
      const union = new THREE.Box3();
      for (const mesh of meshes) {
        mesh.geometry.computeBoundingBox();
        const matrix = new THREE.Matrix4();
        mesh.getMatrixAt(0, matrix);
        union.union(mesh.geometry.boundingBox!.clone().applyMatrix4(matrix));
      }
      const { min, max } = prop.bounds;
      expect(union.min.x, shape).toBeGreaterThanOrEqual(min.x - 1e-6);
      expect(union.min.y, shape).toBeGreaterThanOrEqual(min.y - 1e-6);
      expect(union.min.z, shape).toBeGreaterThanOrEqual(min.z - 1e-6);
      expect(union.max.x, shape).toBeLessThanOrEqual(max.x + 1e-6);
      expect(union.max.y, shape).toBeLessThanOrEqual(max.y + 1e-6);
      expect(union.max.z, shape).toBeLessThanOrEqual(max.z + 1e-6);
      // The stand-in fills the full height of the prop.
      expect(union.max.y - union.min.y).toBeCloseTo(max.y - min.y, 6);
    }
    expect(themeKitProp("water-tower")?.fallback.shape).toBe("tank");
  });
});

describe("era periods and catalog v7", () => {
  it("copies the family-world period text exactly", () => {
    expect(FAMILY_ERA_PERIOD_IDS).toEqual([
      "toon-clubhouse-v1",
      "rescue-harbor-v1",
      "hero-city-v1",
      "sing-along-playroom-v1",
      "magic-house-v1",
    ]);
    expect(Object.fromEntries(FAMILY_ERA_PERIOD_IDS.map((id) => [id, PARODY_PERIODS[id]]))).toEqual({
      "toon-clubhouse-v1": {
        title: "Clubhouse Capers",
        subtitle: "Runaway gadgets and a very grumpy cat captain",
        description:
          "Climb the toon clubhouse, round up the runaway gadgets and stand up to the bully on the tower deck.",
      },
      "rescue-harbor-v1": {
        title: "Harbor Rescue",
        subtitle: "Mischief kittens and a mayor with a plan",
        description: "Ride the boats, hop the rooftops and climb the lookout to stop the rival mayor.",
      },
      "hero-city-v1": {
        title: "Hero City",
        subtitle: "Putty grunts, runaway robots and a monster-inator",
        description:
          "Leap across the rooftops, bounce off the vents and take down the scientist's giant monster.",
      },
      "sing-along-playroom-v1": {
        title: "Sing-Along Playroom",
        subtitle: "Stubborn veggies and a honking bus",
        description:
          "Climb the block towers of the playroom and cheer up the grumpy bus on the toy shelf.",
      },
      "magic-house-v1": {
        title: "The Magic House",
        subtitle: "Cheeky bin chickens and a house that won't stop dancing",
        description: "Climb the garden terraces and calm the dancing house at the top.",
      },
    });
  });

  it("shows an era period's story in the game", () => {
    const story = eraStory(2016, {
      periodId: "toon-clubhouse-v1",
      encounters: [],
    } as unknown as Parameters<typeof eraStory>[1]);
    expect(story).toMatchObject({ title: "Clubhouse Capers", subtitle: "2016 · Runaway gadgets and a very grumpy cat captain" });
  });

  it("freezes v7 as the v6 identities with the Rat Casino window parent-locked to 2014-08-18", () => {
    const v6 = PARODY_CATALOGS["parody-catalog-v6"];
    const v7 = PARODY_CATALOGS["parody-catalog-v7"];
    expect(v7.map((entry) => entry.id)).toEqual(v6.map((entry) => entry.id));
    v7.forEach((entry, index) => {
      const before = v6[index]!;
      if (entry.periodId !== "rat-casino-v1") {
        expect(entry).toEqual(before);
        return;
      }
      expect(before.eligibleFrom).toBe("2024-01-01");
      const { eligibleFrom, relevanceLock, ...rest } = entry;
      const { eligibleFrom: _previous, ...beforeRest } = before;
      expect(rest).toEqual(beforeRest);
      expect(eligibleFrom).toBe("2014-08-18");
      expect(eligibleFrom).toBe(entry.referenceAvailableBy);
      expect(relevanceLock).toMatchObject({ lockedBy: "parent", previousEligibleFrom: "2024-01-01" });
      expect(relevanceLock!.reason).toMatch(/DESIGN-026/);
      expect(Object.isFrozen(entry)).toBe(true);
    });
    expect(v6.filter((entry) => entry.periodId === "rat-casino-v1").every((entry) => entry.eligibleFrom === "2024-01-01")).toBe(true);
    expect(LEVEL_EDITOR_CATALOG_VERSIONS).toEqual(["parody-catalog-v5", "parody-catalog-v6", "parody-catalog-v7"]);
    expect(levelEditorPreparedEnemies("parody-catalog-v7").map((entry) => entry.id)).toEqual(
      levelEditorPreparedEnemies("parody-catalog-v6").map((entry) => entry.id),
    );
  });

  it("lets a Rat Casino chapter start before 2024 only under v7", () => {
    const rat = clone(ratCasinoWorldV2.chapters[2]) as unknown as LevelEditorChapterV2;
    const project = (catalogVersion: string) => ({
      ...clone(ratCasinoWorldV2),
      catalogVersion,
      fictionalBirthDate: "2023-01-01",
      chapters: [
        {
          ...rat,
          representedDateRange: { startDate: "2023-01-01", endDate: "2024-01-01" },
          recoveredAge: { fromYears: 0, toYears: 1 },
          previewMemories: [
            { slotId: "minor-one", date: "2023-05-01", label: "A worn token" },
            { slotId: "minor-two", date: "2023-09-01", label: "A dim marquee" },
            { slotId: "major", date: "2024-01-01", label: "Turning one" },
          ],
        },
      ],
    });
    expect(
      validateLevelEditorProject(project("parody-catalog-v6")).map((entry) => entry.code),
    ).toContain("encounter.date-eligibility");
    expect(validateLevelEditorProject(project("parody-catalog-v7"))).toEqual([]);
  });

  it("lets a project candidate take the Rat Casino bonus slot", () => {
    const project = parseLevelEditorProject(ratCasinoWorldV2) as LevelEditorProjectV2;
    const showman = fixtureCandidate(
      "fixture-radio-showman",
      "Radio Showman",
      "rat-casino-v1",
      "ordinary-a",
      { startDate: "2019-10-28", endDate: "2026-12-31" },
    );
    const result = applyLevelEditorCommand(project, chapterCommands("rat-casino").addCandidate("bonus-1", showman));
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect((result.project as LevelEditorProjectV2).chapters[2]!.encounterSlots["bonus-1"]).toEqual({
      source: "candidate",
      candidateId: "fixture-radio-showman",
    });
  });

  it("lets Besties-period candidates fill every ordinary slot beside the catalog Besties boss", () => {
    const project = createWorldEditorProject({ projectId: "besties-candidates", catalogVersion: "parody-catalog-v7" });
    const besties = chapterCommands("chapter-2");
    const bestiesLevel = project.chapters[1]!.level;
    const idol = fixtureCandidate("fixture-band-idol", "Band Idol", "besties-obby-v1", "ordinary-a", {
      startDate: "2024-01-01",
      endDate: "2026-12-31",
    });
    const oneKind = (slot: "ordinary-2" | "ordinary-4") => ({
      ...clone(bestiesLevel.anchors.encounters[slot]),
      kind: "ordinary-a" as const,
    });
    const result = applyLevelEditorCommands(project, {
      expectedRevision: 0,
      commands: [
        besties.setAnchor("encounter.ordinary-2", oneKind("ordinary-2")),
        besties.setAnchor("encounter.ordinary-4", oneKind("ordinary-4")),
        besties.addCandidate("ordinary-1", idol),
        besties.assign("ordinary-2", { source: "candidate", candidateId: idol.id }),
        besties.assign("ordinary-3", { source: "candidate", candidateId: idol.id }),
        besties.assign("ordinary-4", { source: "candidate", candidateId: idol.id }),
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    const chapter = (result.project as LevelEditorProjectV2).chapters[1]!;
    expect(chapter.encounterSlots.boss).toMatchObject({ source: "catalog", catalogEntryId: "bickering-besties" });
    // A candidate outside its own window is still rejected.
    const late = applyLevelEditorCommand(
      result.project,
      besties.addCandidate("ordinary-1", { ...idol, id: "fixture-late-idol", eligibility: { startDate: "2025-01-01", endDate: "2026-12-31" } }),
    );
    expect(late.issues.map((entry) => entry.code)).toContain("encounter.date-eligibility");
  });
});

describe("generator commands for a whole world", () => {
  it("builds an N-chapter v4 world from createWorldEditorProject, deterministically", () => {
    const first = buildFamilyFixtureWorld();
    expect(validateLevelEditorProject(first)).toEqual([]);
    expect(first.chapters.map((chapter) => [chapter.chapterId, chapter.routeId, chapter.level.schemaVersion, chapter.level.theme])).toEqual(
      FAMILY_FIXTURE_CHAPTERS.map((chapter) => [chapter.chapterId, chapter.routeId, "authored-level-v4", chapter.theme]),
    );
    expect(first.catalogVersion).toBe("parody-catalog-v7");
    expect(first.fictionalBirthDate).toBe("2015-03-01");
    expect(first.chapters[1]!.level).toEqual(familyFixtureHarborLevel());
    expect(serializeLevelEditorProject(buildFamilyFixtureWorld())).toBe(serializeLevelEditorProject(first));
    // One identity serves all four ordinary slots in chapter one.
    expect(Object.values(first.chapters[0]!.level.anchors.encounters).map((anchor) => anchor!.kind)).toEqual([
      "ordinary-a",
      "ordinary-a",
      "ordinary-a",
      "ordinary-a",
      "boss",
    ]);
  });

  it("keeps the whole chapter list inside the chapter limit", () => {
    const chapters = Array.from({ length: 8 }, (_, index) => ({
      ...FAMILY_FIXTURE_CHAPTERS[0]!,
      chapterId: `c${index + 1}`,
      routeId: `c${index + 1}-route`,
      representedDateRange: { startDate: `${2015 + index}-03-01`, endDate: `${2016 + index}-03-01` },
      recoveredAge: { fromYears: index, toYears: index + 1 },
      previewMemories: [
        { slotId: "minor-one" as const, date: `${2015 + index}-06-01`, label: "One" },
        { slotId: "minor-two" as const, date: `${2015 + index}-09-01`, label: "Two" },
        { slotId: "major" as const, date: `${2016 + index}-03-01`, label: "Three" },
      ] as LevelEditorChapterV2["previewMemories"],
    }));
    const result = applyLevelEditorCommands(createWorldEditorProject({ projectId: "eight" }), {
      expectedRevision: 0,
      commands: worldShellCommands({ fictionalBirthDate: "2015-03-01", chapters }),
    });
    expect(result.ok).toBe(true);
    expect((result.project as LevelEditorProjectV2).chapters.map((chapter) => chapter.chapterId)).toEqual(
      chapters.map((chapter) => chapter.chapterId),
    );
    expect(() => worldShellCommands({ fictionalBirthDate: "2015-03-01", chapters: [{ ...chapters[0]!, chapterId: "chapter-1" }] })).toThrow(
      /collide/,
    );
  });

  it("replaces a v4 chapter's level and refuses v3 chapters, wrong ids and v3 documents", () => {
    const world = buildFamilyFixtureWorld();
    const harbor = familyFixtureHarborLevel();
    const withLift = {
      ...harbor,
      pieces: [
        ...harbor.pieces,
        lift("harbor-lift", { x: 40, z: -24, sizeX: 3, sizeZ: 3, bottomTop: 1, distance: 3, period: 8, dwell: 2 }),
        platform("harbor-crow", { x: 40, z: -28, sizeX: 4, sizeZ: 4, top: 4 }),
      ],
      connections: [...harbor.connections, ride("harbor-lookout-ledge", "harbor-lift"), ride("harbor-lift", "harbor-crow")],
    };
    const replaced = applyLevelEditorCommand(world, chapterCommands("a2-harbor").replaceLevel(withLift));
    expect(replaced.ok).toBe(true);
    expect(replaced.issues).toEqual([]);
    const chapter = (replaced.project as LevelEditorProjectV2).chapters[1]!;
    expect(chapter.level).toEqual(withLift);
    // The cast assignments are kept.
    expect(chapter.encounterSlots).toEqual(world.chapters[1]!.encounterSlots);

    const wrongId = applyLevelEditorCommand(world, chapterCommands("a2-harbor").replaceLevel({ ...harbor, id: "elsewhere" }));
    expect(wrongId.issues).toEqual([expect.objectContaining({ code: "route.level-id", path: "$.commands[0].level.id" })]);
    const v3Document = applyLevelEditorCommand(
      world,
      chapterCommands("a2-harbor").replaceLevel({ ...harbor, schemaVersion: "authored-level-v3" } as never),
    );
    expect(v3Document.ok).toBe(false);
    const v3Chapter = applyLevelEditorCommand(
      createWorldEditorProject({ projectId: "v3-chapter" }),
      chapterCommands("chapter-1").replaceLevel({ ...harbor, id: "chapter-1-route" }),
    );
    expect(v3Chapter.issues).toEqual([expect.objectContaining({ code: "level.version" })]);
    // A replacement that breaks a validator rule is reported like any edit.
    const broken = clone(harbor) as unknown as { mainPath: string[] };
    broken.mainPath = broken.mainPath.slice(1);
    const brokenResult = applyLevelEditorCommand(world, chapterCommands("a2-harbor").replaceLevel(broken as never));
    expect(brokenResult.ok).toBe(true);
    expect(brokenResult.issues.map((entry) => entry.code)).toContain("ordering.spawn");
  });

  it("exposes the chapter level, dwell and shared props through the editor CLI", async () => {
    const directory = await mkdtemp(join(tmpdir(), "quest-family-cli-"));
    try {
      const harbor = familyFixtureHarborLevel();
      const project = applyLevelEditorCommand(
        buildFamilyFixtureWorld(),
        chapterCommands("a2-harbor").replaceLevel({
          ...harbor,
          pieces: [
            ...harbor.pieces,
            lift("harbor-lift", { x: 40, z: -24, sizeX: 3, sizeZ: 3, bottomTop: 1, distance: 3, period: 8, dwell: 2 }),
            platform("harbor-crow", { x: 40, z: -28, sizeX: 4, sizeZ: 4, top: 4 }),
          ],
          connections: [...harbor.connections, ride("harbor-lookout-ledge", "harbor-lift"), ride("harbor-lift", "harbor-crow")],
        }),
      ).project;
      const projectPath = join(directory, "project.json");
      await writeFile(projectPath, serializeLevelEditorProject(project), "utf8");
      const run = (...args: string[]) =>
        spawnSync("pnpm", ["exec", "tsx", "scripts/levels/editor.ts", ...args], {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
        });
      const inspection = run("inspect", projectPath);
      expect(inspection.stderr).toBe("");
      const report = JSON.parse(inspection.stdout) as {
        growth: { limits: { maxLiftDwell: number; drop: unknown } };
        chapters: Array<{
          chapterId: string;
          spatial: {
            platforms: Array<{ id: string; dwellSeconds?: number; cycleSeconds?: number }>;
            themeKitProps: Array<{ id: string; kit: string; model: string | null }>;
          };
        }>;
        issues: unknown[];
      };
      expect(report.issues).toEqual([]);
      expect(report.growth.limits.maxLiftDwell).toBe(3);
      expect(report.growth.limits.drop).toEqual({ minDescent: 0.36, maxDescent: 3, maxGap: 1.4 });
      const harborReport = report.chapters.find((chapter) => chapter.chapterId === "a2-harbor")!;
      expect(harborReport.spatial.platforms.find((entry) => entry.id === "harbor-lift")).toMatchObject({
        dwellSeconds: 2,
        cycleSeconds: 12,
      });
      expect(harborReport.spatial.themeKitProps).toContainEqual({
        id: "clearing-tree",
        kit: "shared",
        bounds: expect.any(Object),
        model: "/studio/assets/media/clearing-tree/v001/clearing-tree.glb",
      });
      expect(harborReport.spatial.themeKitProps[0]).toMatchObject({ id: "lookout-tower-facade", kit: "harbor", model: null });

      const level = run("level", projectPath, "a2-harbor");
      expect(level.stderr).toBe("");
      expect(JSON.parse(level.stdout)).toEqual((project as LevelEditorProjectV2).chapters[1]!.level);
      const missing = run("level", projectPath, "nowhere");
      expect(missing.status).toBe(1);
      expect(JSON.parse(missing.stderr)).toMatchObject({ ok: false, issues: [{ code: "chapter.missing" }] });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("keeps the fixture free of v1–v3 content and seeded chapters", () => {
    const commands = familyFixtureWorldCommands().commands;
    expect(commands.filter((command) => command.type === "chapter.remove").map((command) => (command as { chapterId: string }).chapterId)).toEqual([
      "chapter-1",
      "chapter-2",
    ]);
    expect(createWorldEditorProject({ projectId: FAMILY_FIXTURE_PROJECT_ID }).chapters).toHaveLength(2);
    expect(gardenOrdinaryAs("ordinary-2", "ordinary-a").kind).toBe("ordinary-a");
  });
});
